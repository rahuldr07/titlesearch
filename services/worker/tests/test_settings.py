"""The worker's configuration, and the two bounds only it carries.

Both halves of the merge are asserted here, because the risk of collapsing two
settings modules into one is not that it fails to import — it is that a bound
quietly stops existing and nothing says so.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from titlepipe_domain import Environment, LogRenderer, ServiceName
from titlepipe_worker.settings import ENV_PREFIX, WorkerSettings


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """No ambient TITLEPIPE_WORKER_* variable may reach these tests."""
    import os

    for key in list(os.environ):
        if key.startswith(ENV_PREFIX):
            monkeypatch.delenv(key, raising=False)


def test_the_worker_is_one_deployable_with_one_name() -> None:
    settings = WorkerSettings(environment=Environment.DEVELOPMENT)
    assert settings.service_name is ServiceName.WORKER
    assert settings.service_name.value == "worker"


def test_the_concurrency_bound_is_the_stricter_of_the_two_it_replaced() -> None:
    """THE RULING, asserted rather than asserted-in-prose.

    extraction-svc declared `default=4, le=64`; render-svc declared
    `default=2, le=32`. One pool now serves both kinds of work, so the merged
    bound is render's — a merge must not raise a ceiling as a side effect, and
    a render job holds a Gotenberg slot for its whole conversion while an
    extraction job is mostly waiting on a provider.

    If someone later wants four, that is a decision and this test is where it
    is recorded as one.
    """
    assert WorkerSettings(environment=Environment.DEVELOPMENT).max_concurrent_jobs == 2

    field = WorkerSettings.model_fields["max_concurrent_jobs"]
    bounds = {type(m).__name__: getattr(m, "le", getattr(m, "ge", None)) for m in field.metadata}
    assert bounds.get("Le") == 32, "the merged ceiling must be render's 32, not extraction's 64"
    assert bounds.get("Ge") == 1

    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, max_concurrent_jobs=33)
    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, max_concurrent_jobs=0)


def test_the_provider_call_bound_survived_the_merge() -> None:
    """extraction-svc's, unchanged: this is the bound on the paid work, and it
    is the reason dropping max_concurrent_jobs to 2 does not halve throughput."""
    assert WorkerSettings(environment=Environment.DEVELOPMENT).max_concurrent_provider_calls == 8
    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, max_concurrent_provider_calls=129)


def test_a_per_order_ceiling_above_the_daily_one_is_refused() -> None:
    """extraction-svc's validator. It would never bind, which is a bound that
    only looks like one."""
    with pytest.raises(ValidationError, match="would never bind"):
        WorkerSettings(
            environment=Environment.DEVELOPMENT,
            daily_spend_ceiling_usd=Decimal("5.00"),
            per_order_spend_ceiling_usd=Decimal("10.00"),
        )


def test_spend_ceilings_are_decimal_not_float() -> None:
    """Money is never binary floating point, including a ceiling."""
    settings = WorkerSettings(environment=Environment.DEVELOPMENT)
    assert isinstance(settings.daily_spend_ceiling_usd, Decimal)
    assert isinstance(settings.per_order_spend_ceiling_usd, Decimal)
    assert settings.daily_spend_ceiling_usd == Decimal("25.00")
    assert settings.per_order_spend_ceiling_usd == Decimal("2.50")


@pytest.mark.parametrize(
    "url",
    [
        "http://gotenberg:3000",
        "http://gotenberg.internal:3000",
        "http://convert.svc:3000",
        "http://convert.cluster.local:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)
def test_an_internal_converter_is_accepted(url: str) -> None:
    assert WorkerSettings(environment=Environment.DEVELOPMENT, gotenberg_url=url).gotenberg_url


@pytest.mark.parametrize(
    "url",
    [
        "https://demo.gotenberg.dev",
        "https://api.example.com/convert",
        "http://203.0.113.10:3000",
    ],
)
def test_a_public_converter_is_refused_in_every_environment(url: str) -> None:
    """render-svc's validator, and it is checked in DEVELOPMENT too on purpose:
    pointing a laptop at a hosted converter sends client documents to a third
    party, which is exactly the exposure the rule exists to prevent."""
    with pytest.raises(ValidationError, match="not an internal address"):
        WorkerSettings(environment=Environment.DEVELOPMENT, gotenberg_url=url)


def test_a_converter_url_with_no_host_is_refused() -> None:
    with pytest.raises(ValidationError, match="no host"):
        WorkerSettings(environment=Environment.DEVELOPMENT, gotenberg_url="not-a-url")


def test_the_conversion_timeout_is_bounded() -> None:
    assert WorkerSettings(environment=Environment.DEVELOPMENT).gotenberg_timeout_seconds == 120.0
    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, gotenberg_timeout_seconds=0)
    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, gotenberg_timeout_seconds=901)


def test_the_inherited_deployed_refusal_still_applies() -> None:
    """It comes from BaseServiceSettings now. The point of checking it here is
    that the worker did not lose it by inheriting instead of copying."""
    with pytest.raises(ValidationError, match="debug is enabled"):
        WorkerSettings(environment=Environment.PRODUCTION, debug=True)
    with pytest.raises(ValidationError, match="log redaction is disabled"):
        WorkerSettings(environment=Environment.PRODUCTION, redaction_enabled=False)


def test_an_unknown_variable_is_refused() -> None:
    """`extra="forbid"` is inherited, not redeclared. A typo'd worker variable
    must fail startup rather than be silently ignored."""
    with pytest.raises(ValidationError):
        WorkerSettings(environment=Environment.DEVELOPMENT, max_concurrent_job=2)  # pyright: ignore[reportCallIssue]  # rules-allow(any-type): the point of the test is to pass a field the model does not declare


def test_renderer_follows_the_environment_when_unset() -> None:
    assert (
        WorkerSettings(environment=Environment.DEVELOPMENT).effective_log_renderer
        is LogRenderer.CONSOLE
    )
    assert (
        WorkerSettings(environment=Environment.PRODUCTION).effective_log_renderer
        is LogRenderer.JSON
    )


def test_the_environment_has_no_default() -> None:
    """A forgotten variable must not silently mean development."""
    with pytest.raises(ValidationError):
        WorkerSettings.from_environment()


def test_settings_read_the_worker_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    """The prefix is the merged one. Neither dead prefix is read any more."""
    monkeypatch.setenv(f"{ENV_PREFIX}ENVIRONMENT", "development")
    monkeypatch.setenv(f"{ENV_PREFIX}MAX_CONCURRENT_JOBS", "7")
    monkeypatch.setenv("TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS", "64")
    monkeypatch.setenv("TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS", "32")

    settings = WorkerSettings.from_environment()
    assert settings.max_concurrent_jobs == 7

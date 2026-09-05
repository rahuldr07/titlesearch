"""The worker's configuration, and the two bounds only it carries.

Both halves of the merge are asserted here, because the risk of collapsing two
settings modules into one is not that it fails to import — it is that a bound
quietly stops existing and nothing says so.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import SecretStr, ValidationError

from titlepipe_domain import Environment, LogRenderer, ServiceName
from titlepipe_worker.settings import ENV_PREFIX, QUEUE_MAINTENANCE, WorkerSettings

# A syntactically real DSN for the tests that need a deployed-shaped settings
# object. Nothing connects to it; `titlepipe_worker` is the role revision 0060
# grants the queue to, and spelling the right role here keeps the fixture from
# quietly documenting the wrong one.
DEPLOYED_DSN = "postgresql+psycopg://titlepipe_worker:secret@db.internal:5432/titlepipe"


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
    """The production half carries a DSN, and it is not decoration.

    `additional_unsafe_for_deployment` refuses a deployed worker with no
    `database_url` — a process that starts, reports a valid configuration and
    consumes nothing. This test is about the renderer, so it satisfies that
    refusal rather than working around it; a deployed settings object without a
    DSN is not a thing that can exist, and a test that built one would be
    asserting the renderer of a configuration the service rejects.
    """
    assert (
        WorkerSettings(environment=Environment.DEVELOPMENT).effective_log_renderer
        is LogRenderer.CONSOLE
    )
    assert (
        WorkerSettings(
            environment=Environment.PRODUCTION,
            database_url=SecretStr(DEPLOYED_DSN),
        ).effective_log_renderer
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


# --- the queue fields -------------------------------------------------------
#
# Four claims the module docstring and the field comments make, each asserted
# against the model rather than trusted. Three of them are refusals, and a
# refusal that is only described is a refusal nobody has run.


def test_the_queue_dsn_is_optional_locally_and_refused_when_deployed() -> None:
    """A deployed worker with no DSN starts, validates, and consumes nothing.

    That is the exact failure `command_run` was written to refuse to imitate —
    a process that looks healthy on every dashboard while doing no work — so
    the configuration that produces it is refused before the process gets that
    far. Locally the `None` is load-bearing: `check` has to be runnable in CI
    and in a container probe with no database anywhere near it.
    """
    assert WorkerSettings(environment=Environment.DEVELOPMENT).database_url is None

    with pytest.raises(ValidationError) as refusal:
        WorkerSettings(environment=Environment.PRODUCTION)
    assert "database_url is not set" in str(refusal.value)

    deployed = WorkerSettings(
        environment=Environment.PRODUCTION, database_url=SecretStr(DEPLOYED_DSN)
    )
    assert deployed.database_url is not None
    assert deployed.database_url.get_secret_value() == DEPLOYED_DSN


def test_the_dsn_does_not_appear_in_the_models_repr() -> None:
    """`SecretStr`, because a DSN carries the worker role's password.

    The module's opening rule is that settings objects are never logged, and
    this is the half of it the type system can enforce: a plain `str` would put
    the credential into every `repr` of the model, which is what any traceback
    formatter reaches for first.
    """
    settings = WorkerSettings(
        environment=Environment.PRODUCTION, database_url=SecretStr(DEPLOYED_DSN)
    )
    assert "secret" not in repr(settings)
    assert "titlepipe_worker" not in repr(settings)


def test_queues_are_read_as_a_comma_separated_list(monkeypatch: pytest.MonkeyPatch) -> None:
    """`NoDecode` plus the before-validator, asserted from the environment.

    MEASURED against pydantic-settings 2.14 while writing this: WITHOUT
    `NoDecode` on the annotation, `EnvSettingsSource` JSON-decodes a tuple-typed
    field before any validator on the model runs, and `local,cloud` raises
    `SettingsError: error parsing value for field "queues"` out of `json.loads`
    — an error that names neither the field's syntax nor JSON. This test goes
    through the environment, not through `__init__`, because that decoding is a
    property of the SOURCE and a direct construction never reaches it.
    """
    monkeypatch.setenv(f"{ENV_PREFIX}ENVIRONMENT", "development")
    monkeypatch.setenv(f"{ENV_PREFIX}QUEUES", " local , cloud ")
    assert WorkerSettings.from_environment().queues == ("local", "cloud")


def test_the_default_queue_is_the_one_a_task_is_registered_on() -> None:
    """The default must name a queue something actually writes to.

    A default naming a pool that no task is registered on would give a worker
    that starts, listens, and never receives anything — indistinguishable from
    a healthy idle one. `QUEUE_MAINTENANCE` is where the sweep task lives.
    """
    assert WorkerSettings(environment=Environment.DEVELOPMENT).queues == (QUEUE_MAINTENANCE,)


def test_an_empty_queue_list_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty means "every queue" to procrastinate, which is the one value an
    operator must not reach by accident: it puts GPU work and cloud work through
    one bounded pool and silently undoes the split PLAN §6 requires."""
    monkeypatch.setenv(f"{ENV_PREFIX}ENVIRONMENT", "development")
    monkeypatch.setenv(f"{ENV_PREFIX}QUEUES", "")
    with pytest.raises(ValidationError):
        WorkerSettings.from_environment()


def test_a_stall_timeout_below_twice_the_heartbeat_is_refused() -> None:
    """The refusal is against duplicate execution, not against a late alert.

    A worker is judged stalled by the age of its heartbeat row. With the timeout
    at or below the interval, a healthy worker is stale for part of every cycle,
    so the sweep moves its in-flight job back to `todo` while the original is
    still running it. Here a job is a paid provider call against a client
    document: it is billed twice and writes two readings for one page.
    """
    with pytest.raises(ValidationError) as refusal:
        WorkerSettings(
            environment=Environment.DEVELOPMENT,
            heartbeat_interval_seconds=20.0,
            stalled_worker_timeout_seconds=30.0,
        )
    assert "below twice heartbeat_interval_seconds" in str(refusal.value)

    # The defaults are procrastinate's own, and they are three times over, not
    # two. The floor is a floor.
    defaults = WorkerSettings(environment=Environment.DEVELOPMENT)
    assert defaults.heartbeat_interval_seconds == 10.0
    assert defaults.stalled_worker_timeout_seconds == 30.0

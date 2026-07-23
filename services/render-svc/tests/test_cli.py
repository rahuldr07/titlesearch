"""The worker's command contract.

`check` is called by a container probe and a deploy gate, so its exit codes are
the interface. These tests assert that a configuration failure is deterministic,
distinguishable from a crash, and safe to log — plus the converter-isolation
rule that is specific to this worker.
"""

from __future__ import annotations

import json

import pytest
import structlog
from pydantic import ValidationError

from titlepipe_domain import Environment, LogRenderer
from titlepipe_render.cli import (
    EXIT_INVALID_CONFIGURATION,
    EXIT_NOT_IMPLEMENTED,
    EXIT_OK,
    build_parser,
    main,
)
from titlepipe_render.settings import RenderSettings

VALID_ENVIRONMENT = {
    "TITLEPIPE_RENDER_ENVIRONMENT": "test",
    "TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS": "2",
    "TITLEPIPE_RENDER_GOTENBERG_URL": "http://gotenberg:3000",
}


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """No ambient TITLEPIPE_RENDER_* variable may reach these tests."""
    import os

    for key in list(os.environ):
        if key.startswith("TITLEPIPE_RENDER_"):
            monkeypatch.delenv(key, raising=False)


@pytest.fixture(autouse=True)
def _reset_structlog() -> object:
    yield
    structlog.reset_defaults()


def apply(monkeypatch: pytest.MonkeyPatch, values: dict[str, str]) -> None:
    for key, value in values.items():
        monkeypatch.setenv(key, value)


def test_check_succeeds_on_a_valid_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    apply(monkeypatch, VALID_ENVIRONMENT)
    assert main(["check"]) == EXIT_OK


def test_check_fails_with_a_distinct_code_on_invalid_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Distinct from a crash: a deploy gate must be able to tell "you
    misconfigured it" from "it broke"."""
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS": "0"})
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION
    assert EXIT_INVALID_CONFIGURATION != EXIT_OK


def test_check_is_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    """Same input, same exit code, every time — a probe that flaps is worse
    than one that fails."""
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS": "0"})
    assert {main(["check"]) for _ in range(5)} == {EXIT_INVALID_CONFIGURATION}


def test_a_configuration_failure_logs_field_names_and_never_values(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A rejected setting may be a credential. `check` runs in CI and in a
    container probe, so its failure output must be safe by construction."""
    apply(
        monkeypatch,
        {
            **VALID_ENVIRONMENT,
            "TITLEPIPE_RENDER_LOG_RENDERER": "json",
            "TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS": "not-a-number",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    captured = capsys.readouterr().out
    assert "configuration_invalid" in captured
    assert "max_concurrent_jobs" in captured
    assert "not-a-number" not in captured


def test_run_refuses_until_the_queue_exists(monkeypatch: pytest.MonkeyPatch) -> None:
    """A worker that starts, finds nothing and loops quietly looks healthy on
    every dashboard while doing nothing."""
    apply(monkeypatch, VALID_ENVIRONMENT)
    assert main(["run"]) == EXIT_NOT_IMPLEMENTED


def test_run_reports_the_configuration_failure_first(monkeypatch: pytest.MonkeyPatch) -> None:
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_RENDER_MAX_CONCURRENT_JOBS": "0"})
    assert main(["run"]) == EXIT_INVALID_CONFIGURATION


def test_an_unknown_command_is_rejected_by_the_parser() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args(["nonsense"])


def test_a_missing_command_is_rejected() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


@pytest.mark.parametrize(
    "url",
    [
        "https://demo.gotenberg.dev",
        "http://api.example.com:3000",
        "https://converter.somevendor.io",
    ],
)
def test_a_public_converter_is_refused(url: str) -> None:
    """A hosted converter means client documents leave the deployment. Refused
    in every environment, including development — it is not less of an exposure
    because it happened on a laptop."""
    for environment in (Environment.DEVELOPMENT, Environment.PRODUCTION):
        with pytest.raises(ValidationError, match="not an internal address"):
            RenderSettings(environment=environment, gotenberg_url=url)


@pytest.mark.parametrize(
    "url",
    [
        "http://gotenberg:3000",
        "http://gotenberg.internal:3000",
        "http://render.svc:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
)
def test_an_internal_converter_is_accepted(url: str) -> None:
    assert (
        RenderSettings(environment=Environment.DEVELOPMENT, gotenberg_url=url).gotenberg_url == url
    )


def test_a_converter_url_without_a_host_is_refused() -> None:
    with pytest.raises(ValidationError, match="no host"):
        RenderSettings(environment=Environment.DEVELOPMENT, gotenberg_url="not-a-url")


def test_production_refuses_debug_and_disabled_redaction() -> None:
    with pytest.raises(ValidationError, match="debug is enabled"):
        RenderSettings(environment=Environment.PRODUCTION, debug=True)
    with pytest.raises(ValidationError, match="log redaction is disabled"):
        RenderSettings(environment=Environment.PRODUCTION, redaction_enabled=False)


def test_the_worker_logs_json_when_deployed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_RENDER_LOG_RENDERER": "json"})
    assert main(["check"]) == EXIT_OK
    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["event"] == "configuration_valid"
    assert record["service_name"] == "render-worker"


def test_renderer_follows_the_environment_when_unset() -> None:
    assert (
        RenderSettings(environment=Environment.DEVELOPMENT).effective_log_renderer
        is LogRenderer.CONSOLE
    )
    assert (
        RenderSettings(environment=Environment.PRODUCTION).effective_log_renderer
        is LogRenderer.JSON
    )

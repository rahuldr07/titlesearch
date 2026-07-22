"""The worker's command contract.

`check` is called by a container probe and a deploy gate, so its exit codes are
the interface. These tests assert that a configuration failure is deterministic,
distinguishable from a crash, and safe to log.
"""

from __future__ import annotations

import json
from decimal import Decimal

import pytest
import structlog
from pydantic import ValidationError

from titlepipe_domain import Environment, LogRenderer
from titlepipe_extraction.cli import (
    EXIT_INVALID_CONFIGURATION,
    EXIT_NOT_IMPLEMENTED,
    EXIT_OK,
    build_parser,
    main,
)
from titlepipe_extraction.settings import ExtractionSettings

VALID_ENVIRONMENT = {
    "TITLEPIPE_EXTRACTION_ENVIRONMENT": "test",
    "TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS": "4",
    "TITLEPIPE_EXTRACTION_DAILY_SPEND_CEILING_USD": "25.00",
    "TITLEPIPE_EXTRACTION_PER_ORDER_SPEND_CEILING_USD": "2.50",
}


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """No ambient TITLEPIPE_EXTRACTION_* variable may reach these tests."""
    import os

    for key in list(os.environ):
        if key.startswith("TITLEPIPE_EXTRACTION_"):
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
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS": "0"})
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION
    assert EXIT_INVALID_CONFIGURATION != EXIT_OK


def test_check_is_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    """Same input, same exit code, every time — a probe that flaps is worse
    than one that fails."""
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS": "0"})
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
            "TITLEPIPE_EXTRACTION_LOG_RENDERER": "json",
            "TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS": "not-a-number",
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
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_EXTRACTION_MAX_CONCURRENT_JOBS": "0"})
    assert main(["run"]) == EXIT_INVALID_CONFIGURATION


def test_an_unknown_command_is_rejected_by_the_parser() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args(["nonsense"])


def test_a_missing_command_is_rejected() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_a_per_order_ceiling_above_the_daily_one_is_refused() -> None:
    """It would never bind, which is a bound that only looks like one."""
    with pytest.raises(ValidationError, match="would never bind"):
        ExtractionSettings(
            daily_spend_ceiling_usd=Decimal("5.00"),
            per_order_spend_ceiling_usd=Decimal("10.00"),
        )


def test_spend_ceilings_are_decimal_not_float() -> None:
    """Money is never binary floating point, including a ceiling."""
    settings = ExtractionSettings()
    assert isinstance(settings.daily_spend_ceiling_usd, Decimal)
    assert isinstance(settings.per_order_spend_ceiling_usd, Decimal)


def test_production_refuses_debug_and_disabled_redaction() -> None:
    with pytest.raises(ValidationError, match="debug is enabled"):
        ExtractionSettings(environment=Environment.PRODUCTION, debug=True)
    with pytest.raises(ValidationError, match="log redaction is disabled"):
        ExtractionSettings(environment=Environment.PRODUCTION, redaction_enabled=False)


def test_the_worker_logs_json_when_deployed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    apply(monkeypatch, {**VALID_ENVIRONMENT, "TITLEPIPE_EXTRACTION_LOG_RENDERER": "json"})
    assert main(["check"]) == EXIT_OK
    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["event"] == "configuration_valid"
    assert record["service_name"] == "extraction-worker"


def test_renderer_follows_the_environment_when_unset() -> None:
    assert ExtractionSettings().effective_log_renderer is LogRenderer.CONSOLE
    assert (
        ExtractionSettings(environment=Environment.PRODUCTION).effective_log_renderer
        is LogRenderer.JSON
    )

"""The worker's command contract.

`check` is called by a container probe and a deploy gate, so its exit codes are
the interface. These tests assert that a configuration failure is deterministic,
distinguishable from a crash, and safe to log.
"""

from __future__ import annotations

import json

import pytest
import structlog

from titlepipe_domain import Environment
from titlepipe_worker.cli import (
    CROSS_FIELD_RULE,
    EXIT_INVALID_CONFIGURATION,
    EXIT_NOT_IMPLEMENTED,
    EXIT_OK,
    build_parser,
    environment_for_failed_configuration,
    main,
)
from titlepipe_worker.settings import ENV_PREFIX

VALID_ENVIRONMENT = {
    f"{ENV_PREFIX}ENVIRONMENT": "test",
    f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "2",
    f"{ENV_PREFIX}DAILY_SPEND_CEILING_USD": "25.00",
    f"{ENV_PREFIX}PER_ORDER_SPEND_CEILING_USD": "2.50",
    f"{ENV_PREFIX}GOTENBERG_URL": "http://gotenberg:3000",
}


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """No ambient TITLEPIPE_WORKER_* variable may reach these tests."""
    import os

    for key in list(os.environ):
        if key.startswith(ENV_PREFIX):
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
    apply(monkeypatch, {**VALID_ENVIRONMENT, f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "0"})
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION
    assert EXIT_INVALID_CONFIGURATION != EXIT_OK


def test_check_is_deterministic(monkeypatch: pytest.MonkeyPatch) -> None:
    """Same input, same exit code, every time — a probe that flaps is worse
    than one that fails."""
    apply(monkeypatch, {**VALID_ENVIRONMENT, f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "0"})
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
            f"{ENV_PREFIX}LOG_RENDERER": "json",
            f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "not-a-number",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    captured = capsys.readouterr().out
    assert "configuration_invalid" in captured
    assert "max_concurrent_jobs" in captured
    assert "not-a-number" not in captured


def test_a_rejected_converter_is_reported_as_a_rule_and_never_echoed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The render half's refusal, through the merged CLI.

    A `model_validator(mode="after")` reaches pydantic with an empty `loc`, so
    the field-name report has nothing to name — this used to log
    `invalid_fields: [""]`, which is the shape of an answer without being one.
    It now reports CROSS_FIELD_RULE.

    The URL itself still must not appear anywhere in the output: a converter
    URL can carry credentials in its userinfo, and this command runs in CI and
    in a container probe.
    """
    apply(
        monkeypatch,
        {
            **VALID_ENVIRONMENT,
            f"{ENV_PREFIX}ENVIRONMENT": "production",
            f"{ENV_PREFIX}GOTENBERG_URL": "https://svc-user:hunter2@convert.example.com",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    captured = capsys.readouterr().out
    record = json.loads(captured.strip().splitlines()[-1])
    assert record["event"] == "configuration_invalid"
    assert record["invalid_fields"] == [CROSS_FIELD_RULE]
    assert "" not in record["invalid_fields"]
    assert "hunter2" not in captured
    assert "convert.example.com" not in captured


def test_a_rejected_spend_ceiling_is_reported_as_a_rule_too(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The extraction half's cross-field refusal, same shape. Both of the
    worker's model-level rules go through the same reporting path, so both are
    asserted rather than one standing in for the other."""
    apply(
        monkeypatch,
        {
            **VALID_ENVIRONMENT,
            f"{ENV_PREFIX}ENVIRONMENT": "production",
            f"{ENV_PREFIX}DAILY_SPEND_CEILING_USD": "5.00",
            f"{ENV_PREFIX}PER_ORDER_SPEND_CEILING_USD": "10.00",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["invalid_fields"] == [CROSS_FIELD_RULE]


def test_a_field_error_hides_the_cross_field_rules_behind_it(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Recorded because it is surprising, not because it is desirable.

    A `model_validator(mode="after")` runs only once every field has validated
    on its own, so a single bad field SUPPRESSES both cross-field rules — here
    a converter URL that is also wrong is not reported at all. An operator
    fixing configuration therefore gets the field errors first and the rule
    errors on the next attempt, which is two rounds rather than one.

    Nothing in this repository can change that: it is pydantic's construction
    order. Asserting it is how the two-round behaviour stays a known property
    instead of being rediscovered against a deploy gate.
    """
    apply(
        monkeypatch,
        {
            **VALID_ENVIRONMENT,
            f"{ENV_PREFIX}ENVIRONMENT": "production",
            f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "0",
            f"{ENV_PREFIX}GOTENBERG_URL": "https://convert.example.com",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["invalid_fields"] == ["max_concurrent_jobs"]
    assert CROSS_FIELD_RULE not in record["invalid_fields"]
    # And the bad URL is still not echoed on the path where it was not reached.
    assert "convert.example.com" not in capsys.readouterr().out


@pytest.mark.parametrize(
    ("declared", "expected"),
    [
        ("production", Environment.PRODUCTION),
        ("staging", Environment.STAGING),
        ("development", Environment.DEVELOPMENT),
        # Unusable values all resolve the same way: closed.
        ("", Environment.PRODUCTION),
        ("prod", Environment.PRODUCTION),
        ("PRODUCTION ", Environment.PRODUCTION),
        ("nonsense", Environment.PRODUCTION),
    ],
)
def test_an_unusable_configuration_still_resolves_its_environment(
    monkeypatch: pytest.MonkeyPatch, declared: str, expected: Environment
) -> None:
    """The failure path must not silently become a development process.

    `configure_logging()` with no arguments means blocklist redaction, kept
    exception messages and a console renderer. Taking that default on the one
    path where settings could not be read gives the weakest redaction to the
    process least able to justify it — a misconfigured production worker, whose
    traceback is exactly where a DSN turns up.
    """
    if declared:
        monkeypatch.setenv(f"{ENV_PREFIX}ENVIRONMENT", declared)
    assert environment_for_failed_configuration() is expected


def test_a_production_configuration_failure_is_redacted_and_shippable(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Production rules apply even though the settings object never existed."""
    apply(
        monkeypatch,
        {
            f"{ENV_PREFIX}ENVIRONMENT": "production",
            f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "not-a-number",
        },
    )
    assert main(["check"]) == EXIT_INVALID_CONFIGURATION

    captured = capsys.readouterr().out
    # JSON, because a deployed environment has a log shipper reading this.
    record = json.loads(captured.strip().splitlines()[-1])
    assert record["event"] == "configuration_invalid"
    assert "max_concurrent_jobs" in record["invalid_fields"]
    assert "not-a-number" not in captured


def test_run_refuses_until_the_queue_exists(monkeypatch: pytest.MonkeyPatch) -> None:
    """A worker that starts, finds nothing and loops quietly looks healthy on
    every dashboard while doing nothing."""
    apply(monkeypatch, VALID_ENVIRONMENT)
    assert main(["run"]) == EXIT_NOT_IMPLEMENTED


def test_run_reports_the_configuration_failure_first(monkeypatch: pytest.MonkeyPatch) -> None:
    apply(monkeypatch, {**VALID_ENVIRONMENT, f"{ENV_PREFIX}MAX_CONCURRENT_JOBS": "0"})
    assert main(["run"]) == EXIT_INVALID_CONFIGURATION


def test_an_unknown_command_is_rejected_by_the_parser() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args(["nonsense"])


def test_a_missing_command_is_rejected() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_the_worker_logs_json_when_deployed(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    apply(monkeypatch, {**VALID_ENVIRONMENT, f"{ENV_PREFIX}LOG_RENDERER": "json"})
    assert main(["check"]) == EXIT_OK
    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["event"] == "configuration_valid"
    assert record["service_name"] == "worker"


def test_check_reports_both_halves_bounds(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The two shells each logged the one bound they cared about. Merging them
    must report strictly more than either did, not pick a side — this record is
    the only place an operator sees what the process actually resolved."""
    apply(monkeypatch, {**VALID_ENVIRONMENT, f"{ENV_PREFIX}LOG_RENDERER": "json"})
    assert main(["check"]) == EXIT_OK
    record = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert record["max_concurrent_jobs"] == 2
    assert record["max_concurrent_provider_calls"] == 8
    assert record["gotenberg_timeout_seconds"] == 120.0

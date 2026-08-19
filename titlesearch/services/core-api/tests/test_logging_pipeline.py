"""The logging pipeline.

The redaction *rules* are tested in `libs/domain`. What is tested here is that
this service's chain applies them to everything the record ends up containing —
which is the part that was wrong before review.
"""

from __future__ import annotations

import json

import pytest
import structlog

from titlepipe_core.telemetry.logging import configure_logging, get_logger
from titlepipe_domain import Environment, LogRenderer
from titlepipe_domain.redaction import REDACTED

SIGNED_URL = (
    "https://packages.r2.example/quarantine/abc123.pdf"
    "?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA%2F20260722"
)
DSN = "postgresql://titlepipe:hunter2@db.internal:5432/core"


@pytest.fixture(autouse=True)
def _reset_structlog() -> object:
    """structlog configuration is process-global."""
    yield
    structlog.reset_defaults()


def last_record(captured: str) -> dict[str, object]:
    return json.loads(captured.strip().splitlines()[-1])


def test_sensitive_fields_are_removed_before_rendering(
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.PRODUCTION)
    get_logger("test").info(
        "upload_finalised",
        grantor="TIMOTHY BUCHANAN",
        presigned_url=SIGNED_URL,
        page_count=181,
    )
    captured = capsys.readouterr().out
    assert "TIMOTHY BUCHANAN" not in captured
    assert "deadbeef" not in captured

    record = last_record(captured)
    assert record["event"] == "upload_finalised"
    assert record["grantor"] == REDACTED
    assert record["page_count"] == 181


def test_a_traceback_does_not_leak_its_message_when_deployed(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The defect found in review.

    `format_exc_info` builds the traceback *after* the processors preceding it.
    With redaction running first, the exception text was never inspected and
    reached stdout verbatim — and `handle_unexpected` calls `log.exception` on
    every unhandled error in production.
    """
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.PRODUCTION)
    try:
        raise RuntimeError(f"connect failed for TIMOTHY BUCHANAN at {DSN}")
    except RuntimeError:
        get_logger("test").exception("unhandled_exception")

    captured = capsys.readouterr().out
    assert "TIMOTHY BUCHANAN" not in captured
    assert "hunter2" not in captured

    record = last_record(captured)
    formatted = str(record["exception"])
    # The frame survives: it is code structure, and it is what makes a
    # traceback worth keeping.
    assert "RuntimeError" in formatted
    assert "test_logging_pipeline.py" in formatted
    # The echoed source line does not: it can carry a literal, and the file and
    # line number already say where to look.
    assert "raise RuntimeError" not in formatted


def test_a_traceback_keeps_its_message_locally(capsys: pytest.CaptureFixture[str]) -> None:
    """There is no real NPI in development and a redacted traceback wastes an
    afternoon. Credentials are masked even so."""
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.DEVELOPMENT)
    try:
        raise RuntimeError(f"connect failed at {DSN}")
    except RuntimeError:
        get_logger("test").exception("unhandled_exception")

    captured = capsys.readouterr().out
    assert "connect failed" in captured
    assert "hunter2" not in captured


def test_a_connection_string_is_masked_under_any_key(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """The second defect found in review: `database_url` and
    `connection_string` matched no key rule and passed through."""
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.PRODUCTION)
    get_logger("test").info(
        "dsn_check",
        database_url=DSN,
        connection_string="Server=db;Database=core;Password=hunter2;",
        detail=f"pool exhausted for {DSN}",
    )
    assert "hunter2" not in capsys.readouterr().out


def test_the_redaction_processor_is_what_removes_the_value(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Control case. With redaction off the value appears, which proves the
    tests above are the processor's doing and not an accident of formatting."""
    configure_logging(
        renderer=LogRenderer.JSON,
        redaction_enabled=False,
        environment=Environment.PRODUCTION,
    )
    get_logger("test").info("upload_finalised", grantor="TIMOTHY BUCHANAN")
    assert "TIMOTHY BUCHANAN" in capsys.readouterr().out


def test_redaction_applies_to_the_console_renderer_too(
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_logging(renderer=LogRenderer.CONSOLE, environment=Environment.PRODUCTION)
    get_logger("test").info("upload_finalised", grantor="TIMOTHY BUCHANAN")
    assert "TIMOTHY BUCHANAN" not in capsys.readouterr().out


def test_nothing_runs_after_redaction_except_the_renderer() -> None:
    """The ordering property the whole control rests on, asserted structurally
    rather than inferred from output. A processor appended after redaction
    would reintroduce exactly the defect review found."""
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.PRODUCTION)
    processors = structlog.get_config()["processors"]

    assert type(processors[-1]).__name__ == "JSONRenderer"
    # The redaction processor is the closure built by build_redaction_processor.
    assert getattr(processors[-2], "__name__", "") == "processor", (
        "redaction is not immediately before the renderer: "
        f"{[getattr(p, '__name__', type(p).__name__) for p in processors]}"
    )


def test_exception_formatting_precedes_redaction() -> None:
    """If exception rendering ran after redaction, the traceback it creates
    would never be inspected — the defect, stated as an ordering assertion.

    Identified by type: `structlog.processors.format_exc_info` is an
    `ExceptionRenderer` instance, not a plain function, so it has no
    `__name__`.
    """
    configure_logging(renderer=LogRenderer.JSON, environment=Environment.PRODUCTION)
    processors = structlog.get_config()["processors"]
    type_names = [type(p).__name__ for p in processors]

    assert "ExceptionRenderer" in type_names, type_names
    # Strictly before the redaction processor, which is second from the end.
    assert type_names.index("ExceptionRenderer") < len(processors) - 2


def test_event_names_are_identical_across_renderers(
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_logging(renderer=LogRenderer.JSON)
    get_logger("test").info("upload_finalised", page_count=1)
    json_out = capsys.readouterr().out

    configure_logging(renderer=LogRenderer.CONSOLE)
    get_logger("test").info("upload_finalised", page_count=1)
    console_out = capsys.readouterr().out

    assert "upload_finalised" in json_out
    assert "upload_finalised" in console_out

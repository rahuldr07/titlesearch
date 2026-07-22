"""Redaction.

These assert the property the compliance posture rests on: a value that must
not be logged is gone *before* any renderer sees the record.
"""

from __future__ import annotations

import json

import pytest
import structlog

from titlepipe_core.telemetry.logging import configure_logging, get_logger
from titlepipe_core.telemetry.redaction import (
    REDACTED,
    is_sensitive_key,
    redact_mapping,
    scrub_signed_url,
)
from titlepipe_domain import LogRenderer

SIGNED_URL = (
    "https://packages.r2.example/quarantine/abc123.pdf"
    "?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA%2F20260722"
)


@pytest.mark.parametrize(
    "key",
    [
        "grantor",
        "grantor_name",
        "mortgagor_names",
        "plaintiff_attorney",
        "borrower",
        "street_address",
        "legal_description",
        "dob",
        "ssn",
        "source_snippet",
        "document_text",
        "prompt",
        "authorization",
        "cookie_seal_password",
        "api_key",
        "presigned_url",
    ],
)
def test_sensitive_keys_are_recognised(key: str) -> None:
    assert is_sensitive_key(key)


@pytest.mark.parametrize(
    "key",
    [
        "event",
        "request_id",
        "service_name",
        "status_code",
        "duration_ms",
        "page_count",
        "document_count",
        "error_code",
        "content_length",
    ],
)
def test_diagnostic_keys_survive(key: str) -> None:
    """Redaction that eats the diagnostic fields gets switched off by whoever
    is on call. Keeping these is what makes the rest enforceable."""
    assert not is_sensitive_key(key)


def test_sensitive_values_are_replaced_not_merely_masked() -> None:
    out = redact_mapping({"grantor": "TIMOTHY BUCHANAN", "page_count": 181})
    assert out == {"grantor": REDACTED, "page_count": 181}


def test_redaction_reaches_into_nested_structures() -> None:
    out = redact_mapping({"order": {"page_count": 3, "parties": {"grantee": "YETTA BUCHANAN"}}})
    assert out["order"]["parties"]["grantee"] == REDACTED
    assert out["order"]["page_count"] == 3


def test_redaction_reaches_into_lists() -> None:
    """`pages` is a safe key, so the list survives and each element is scrubbed."""
    out = redact_mapping({"pages": [{"grantor": "X"}, {"grantor": "Y"}]})
    assert [page["grantor"] for page in out["pages"]] == [REDACTED, REDACTED]


def test_a_sensitive_container_key_is_replaced_wholesale() -> None:
    """`documents` is itself sensitive, so nothing inside it is even walked —
    the conservative direction."""
    out = redact_mapping({"documents": [{"grantor": "X"}]})
    assert out["documents"] == REDACTED


def test_a_presigned_url_is_scrubbed_whatever_key_it_arrives_under() -> None:
    """Key-based redaction alone would miss this. A signed URL is a bearer
    credential regardless of what it is called."""
    out = redact_mapping({"location": SIGNED_URL})
    assert "X-Amz-Signature" not in out["location"]
    assert "deadbeef" not in out["location"]
    assert out["location"].startswith("https://packages.r2.example/quarantine/abc123.pdf")


def test_an_ordinary_url_survives() -> None:
    """Knowing which upstream was called is diagnostic, not sensitive."""
    url = "https://api.workos.com/sso/authorize"
    assert scrub_signed_url(url) == url


def test_redaction_is_depth_bounded() -> None:
    """A cyclic structure must not turn a log call into a hang."""
    cyclic: dict[str, object] = {"page_count": 1}
    cyclic["self"] = cyclic
    out = redact_mapping(cyclic)
    assert out is not None


def test_redaction_runs_before_the_json_renderer(capsys: pytest.CaptureFixture[str]) -> None:
    """The end-to-end property: what reaches stdout is already clean."""
    configure_logging(renderer=LogRenderer.JSON, redaction_enabled=True)
    get_logger("test").info(
        "upload_finalised",
        grantor="TIMOTHY BUCHANAN",
        presigned_url=SIGNED_URL,
        page_count=181,
    )
    captured = capsys.readouterr().out
    assert "TIMOTHY BUCHANAN" not in captured
    assert "deadbeef" not in captured

    record = json.loads(captured.strip().splitlines()[-1])
    assert record["event"] == "upload_finalised"
    assert record["grantor"] == REDACTED
    assert record["page_count"] == 181


def test_redaction_runs_before_the_console_renderer(
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_logging(renderer=LogRenderer.CONSOLE, redaction_enabled=True)
    get_logger("test").info("upload_finalised", grantor="TIMOTHY BUCHANAN")
    assert "TIMOTHY BUCHANAN" not in capsys.readouterr().out


def test_the_redaction_processor_is_what_removes_the_value(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Control case. With redaction off the value appears — which proves the
    passing tests above are the processor's doing and not an accident of
    formatting somewhere downstream."""
    configure_logging(renderer=LogRenderer.JSON, redaction_enabled=False)
    get_logger("test").info("upload_finalised", grantor="TIMOTHY BUCHANAN")
    assert "TIMOTHY BUCHANAN" in capsys.readouterr().out


def test_event_names_are_identical_across_renderers(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Rendering changes between environments; the greppable identity does not."""
    configure_logging(renderer=LogRenderer.JSON)
    get_logger("test").info("upload_finalised", page_count=1)
    json_out = capsys.readouterr().out

    configure_logging(renderer=LogRenderer.CONSOLE)
    get_logger("test").info("upload_finalised", page_count=1)
    console_out = capsys.readouterr().out

    assert "upload_finalised" in json_out
    assert "upload_finalised" in console_out


@pytest.fixture(autouse=True)
def _reset_structlog() -> object:
    """structlog configuration is process-global. Reset it so a renderer chosen
    by one test cannot leak into the next."""
    yield
    structlog.reset_defaults()

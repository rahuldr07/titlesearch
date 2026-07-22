"""Redaction rules.

The shared implementation. Every service depends on these holding, which is
why they live beside the code rather than in one service's suite.
"""

from __future__ import annotations

import pytest

from titlepipe_domain.redaction import (
    REDACTED,
    is_sensitive_key,
    redact_mapping,
    sanitise_exception,
    scrub_credentials,
    scrub_signed_url,
)

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
        # Added after review: these carry credentials and were passing through.
        "database_url",
        "connection_string",
        "core_database_url",
        "worker_dsn",
        "conn_str",
        "pwd",
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
    assert not is_sensitive_key(key)


def test_extra_parts_extend_the_rules_without_replacing_them() -> None:
    extra = frozenset({"engine"})
    assert is_sensitive_key("engine_id", extra_parts=extra)
    assert is_sensitive_key("grantor", extra_parts=extra)
    assert not is_sensitive_key("engine_id")


def test_sensitive_values_are_replaced() -> None:
    assert redact_mapping({"grantor": "TIMOTHY BUCHANAN", "page_count": 181}) == {
        "grantor": REDACTED,
        "page_count": 181,
    }


def test_redaction_reaches_into_nested_structures() -> None:
    out = redact_mapping({"order": {"page_count": 3, "parties": {"grantee": "YETTA B"}}})
    assert out["order"]["parties"]["grantee"] == REDACTED
    assert out["order"]["page_count"] == 3


def test_redaction_reaches_into_lists() -> None:
    out = redact_mapping({"pages": [{"grantor": "X"}, {"grantor": "Y"}]})
    assert [page["grantor"] for page in out["pages"]] == [REDACTED, REDACTED]


def test_a_sensitive_container_key_is_replaced_wholesale() -> None:
    assert redact_mapping({"documents": [{"grantor": "X"}]})["documents"] == REDACTED


def test_redaction_is_depth_bounded() -> None:
    cyclic: dict[str, object] = {"page_count": 1}
    cyclic["self"] = cyclic
    assert redact_mapping(cyclic) is not None


def test_a_presigned_url_is_scrubbed_under_any_key() -> None:
    out = redact_mapping({"location": SIGNED_URL})
    assert "deadbeef" not in out["location"]
    assert out["location"].startswith("https://packages.r2.example/quarantine/abc123.pdf")


def test_an_ordinary_url_survives() -> None:
    url = "https://api.workos.com/sso/authorize"
    assert scrub_signed_url(url) == url


# --- credentials by shape, not by key ---------------------------------------
#
# Found in review: a DSN logged under a key the name rules did not cover
# reached stdout in full.


@pytest.mark.parametrize(
    ("value", "leaked"),
    [
        ("postgresql://titlepipe:hunter2@db.internal/core", "hunter2"),
        ("postgres://u:p4ss@127.0.0.1:5432/blind", "p4ss"),
        ("amqp://guest:guest@broker:5672/", "guest:guest"),
        ("https://admin:s3cret@api.example.com/v1", "s3cret"),
        ("Server=db;Database=core;Password=hunter2;", "hunter2"),
        ("api_key=sk-live-abcdef123456&scope=read", "sk-live-abcdef123456"),
        ("token=eyJhbGciOi;other=1", "eyJhbGciOi"),
    ],
)
def test_credentials_are_masked_wherever_they_appear(value: str, leaked: str) -> None:
    assert leaked not in scrub_credentials(value)
    assert REDACTED in scrub_credentials(value)


def test_a_credential_is_masked_even_under_an_innocuous_key() -> None:
    """The exact defect found in review: the key rules did not name it, so the
    value went out verbatim."""
    out = redact_mapping({"detail": "connect failed: postgresql://u:hunter2@db/core"})
    assert "hunter2" not in out["detail"]


def test_the_host_survives_credential_masking() -> None:
    """Which database was unreachable is the diagnostic value of the message."""
    out = scrub_credentials("postgresql://titlepipe:hunter2@db.internal:5432/core")
    assert "db.internal" in out
    assert "hunter2" not in out


# --- exception text ----------------------------------------------------------


def test_a_deployed_traceback_keeps_frames_and_drops_messages() -> None:
    """Frames are code structure and identify no one. The message is arbitrary
    data-controlled text and routinely carries a DSN or a party name."""
    traceback_text = (
        "Traceback (most recent call last):\n"
        '  File "/app/titlepipe_core/api/errors.py", line 42, in handler\n'
        "    raise RuntimeError(...)\n"
        "RuntimeError: connect failed for TIMOTHY BUCHANAN at "
        "postgresql://u:hunter2@db/core"
    )
    safe = sanitise_exception(traceback_text, keep_messages=False)

    assert "TIMOTHY BUCHANAN" not in safe
    assert "hunter2" not in safe
    # Kept: the frame and the exception type.
    assert "errors.py" in safe
    assert "line 42" in safe
    assert "RuntimeError" in safe


def test_a_local_traceback_keeps_its_message_but_still_masks_credentials() -> None:
    traceback_text = "RuntimeError: postgresql://u:hunter2@db/core"
    safe = sanitise_exception(traceback_text, keep_messages=True)
    assert "hunter2" not in safe
    assert "RuntimeError" in safe

"""Redaction, applied before anything else touches a log record.

This is the first processor in the structlog chain, not the last. A processor
that renders, formats or exports before redaction has already put the value
somewhere — a console buffer, an exception's `__context__`, a shipper's queue —
and removing it afterwards removes only the copy you can see.

Two mechanisms, because key-based redaction alone is not enough:

1. **By key.** A field whose name says it holds a person, a document, a
   credential or a location is replaced wholesale. Matching is on a normalised
   key, and substring-based, so `grantor`, `grantor_name` and `mortgagor_names`
   all match without an exhaustive list.

2. **By shape.** A presigned URL is a credential regardless of the key it
   arrived under. `https://bucket.r2.../doc.pdf?X-Amz-Signature=...` in a field
   called `location` is exactly the leak this exists to stop, so any URL
   carrying signing parameters is truncated to its path.

What is deliberately *not* redacted: request/correlation IDs, event names, log
levels, service names, durations, counts, status codes and error codes. Those
are how an incident gets diagnosed, and none of them identifies a person.

**This service redacts more than Core does.** A blind typist must never see
model output or the other seat's entry, and the guarantee is topological — the
data is not reachable from here. Anything named for an engine, a reading, a
confidence or the other seat therefore should not exist in this process at all,
and if one ever appears in a log record it is a boundary failure. Redacting it
keeps the failure out of the log shipper; `tests/test_boundaries.py` is what
keeps it out of the code.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any, Final, cast
from urllib.parse import urlsplit

REDACTED: Final = "[redacted]"
MAX_REDACTION_DEPTH: Final = 6

# Substrings that mark a key as carrying NPI, document content or a credential.
SENSITIVE_KEY_PARTS: Final[frozenset[str]] = frozenset(
    {
        # credentials and session material
        "password",
        "secret",
        "token",
        "authorization",
        "cookie",
        "credential",
        "api_key",
        "apikey",
        "signature",
        "seal",
        # people
        "name",
        "grantor",
        "grantee",
        "mortgagor",
        "mortgagee",
        "borrower",
        "lender",
        "trustee",
        "debtor",
        "creditor",
        "plaintiff",
        "defendant",
        "attorney",
        "owner",
        "email",
        "phone",
        # personal identifiers
        "dob",
        "birth",
        "ssn",
        "tax_id",
        "bankruptcy",
        # location
        "address",
        "street",
        "zip",
        "postal",
        "legal_description",
        "parcel",
        # document and model content
        "snippet",
        "text",
        "content",
        "prompt",
        "completion",
        "body",
        "payload",
        "document",
        "page_image",
        "filename",
        "presigned",
        "signed_url",
        # model output and cross-seat data — must never exist in this process
        "engine",
        "reading",
        "confidence",
        "model",
        "extraction",
        "auto_confirm",
        "other_seat",
        "seat_a",
        "seat_b",
        "golden",
        "reconciliation",
    }
)

# Keys that contain a sensitive substring but are safe and diagnostically
# valuable. Checked before the substring rule, so this wins.
SAFE_KEY_EXCEPTIONS: Final[frozenset[str]] = frozenset(
    {
        "event",
        "event_name",
        "service_name",
        "logger_name",
        "exception_name",
        "error_name",
        "renderer_name",
        "text_layer_present",
        "content_length",
        "content_type",
        "document_count",
        "page_count",
    }
)

# Query parameters that make a URL a bearer credential.
_SIGNING_PARAMS: Final[frozenset[str]] = frozenset(
    {
        "x-amz-signature",
        "x-amz-credential",
        "x-amz-security-token",
        "signature",
        "sig",
        "token",
        "accesskeyid",
    }
)

_URL_RE: Final = re.compile(r"^https?://", re.IGNORECASE)


def is_sensitive_key(key: str) -> bool:
    """Whether a log field name marks its value as unloggable."""
    normalised = key.strip().lower().lstrip("_")
    if normalised in SAFE_KEY_EXCEPTIONS:
        return False
    return any(part in normalised for part in SENSITIVE_KEY_PARTS)


def scrub_signed_url(value: str) -> str:
    """Truncate a URL to scheme, host and path if it carries signing parameters.

    Leaves ordinary URLs intact — knowing which upstream was called is useful
    and is not a credential.
    """
    if not _URL_RE.match(value):
        return value
    try:
        parts = urlsplit(value)
    except ValueError:
        return REDACTED
    if not parts.query:
        return value
    param_names = {pair.split("=", 1)[0].strip().lower() for pair in parts.query.split("&") if pair}
    if param_names & _SIGNING_PARAMS:
        return f"{parts.scheme}://{parts.netloc}{parts.path}?{REDACTED}"
    return value


def redact_value(value: Any, *, depth: int = 0) -> Any:
    """Recursively scrub a value that is kept because its key is safe.

    Depth is bounded: a cyclic or pathologically nested structure must not turn
    a log call into a hang.
    """
    if depth >= MAX_REDACTION_DEPTH:
        return REDACTED
    if isinstance(value, str):
        return scrub_signed_url(value)
    if isinstance(value, dict):
        return redact_mapping(cast("dict[str, Any]", value), depth=depth + 1)
    if isinstance(value, (list, tuple, set, frozenset)):
        items = cast("Iterable[Any]", value)
        scrubbed: list[Any] = [redact_value(item, depth=depth + 1) for item in items]
        # A tuple stays a tuple so a caller comparing shapes is not surprised;
        # sets and frozensets become lists because a scrubbed element may not
        # be hashable.
        return tuple(scrubbed) if isinstance(value, tuple) else scrubbed
    return value


def redact_mapping(mapping: dict[str, Any], *, depth: int = 0) -> dict[str, Any]:
    """Apply both mechanisms across one mapping."""
    if depth >= MAX_REDACTION_DEPTH:
        return {"truncated": REDACTED}
    result: dict[str, Any] = {}
    for key, value in mapping.items():
        if is_sensitive_key(str(key)):
            result[key] = REDACTED
        else:
            result[key] = redact_value(value, depth=depth)
    return result


def redaction_processor(
    _logger: Any, _method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor. Must be first in the chain."""
    return redact_mapping(event_dict)

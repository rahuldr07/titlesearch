"""Redaction of log records.

Framework-free by design and deliberately shared. This is a compliance control
that must be **identical** in every process: a copy of it that drifts is a leak
in whichever service holds the stale copy, and that is not hypothetical — the
first version of this code lived in four copies and carried the same two defects
in all four.

## Where this runs in the chain

**Last, immediately before the renderer.** Not first.

An earlier version ran redaction first, on the theory that nothing downstream
could then see an unredacted value. That was wrong in a way that mattered:
processors *after* it generate new fields. `format_exc_info` builds the
traceback string after redaction has already run, so an exception message
carrying a connection string or a party name reached stdout verbatim.

The property that actually matters is that **no processor runs after redaction
except the renderer**. Everything the record will ever contain exists by then.

## What it removes

1. **By key** — substring match on a normalised key. `grantor`, `grantor_name`
   and `mortgagor_names` all match without an exhaustive list.

2. **By shape, in any string value, whatever key it arrived under** — because a
   credential does not become safe by being logged under a friendly name:
   - presigned URLs (signing parameters in the query string),
   - credentials embedded in a URL or DSN (`scheme://user:password@host`),
   - `password=` / `token=` / `secret=` style pairs in connection strings.

3. **Exception text** — see `sanitise_exception`.

## What it deliberately keeps

Request and correlation IDs, event names, levels, timestamps, service names,
durations, counts, status codes and error codes. Redaction that eats the
diagnostics gets switched off by whoever is on call, and then none of the rest
is enforced either.
"""

from __future__ import annotations

import re
from typing import Final
from urllib.parse import urlsplit

# One exemption, and one that used to be here.
#
# `Any` is gone. This module walks arbitrary log-record values, so `object` — not
# `Any` — is the correct annotation, and the whole file now carries it: no `Any`,
# no `cast`, and no file-wide licence to reintroduce either. What survives is
# three line-scoped exemptions inside `redact_value`, each on the one expression
# that consumes a container pyright narrowed out of `object`. That narrowing is
# where the type genuinely stops being knowable: `isinstance(value, dict)` proves
# the class and says nothing about the key or value types, so pyright infers
# `dict[Unknown, Unknown]`, and *every* expression that then reads it is reported
# — including the constructor call that would widen it. Widening by construction,
# which is what replaced the cast in `api/errors.py`, does not reach this case:
# there the input type was known and merely too narrow; here the input type is
# unknown, and the flagged thing is the argument going in, not the value coming
# out. The suppressions therefore record an absence of information rather than
# assert a shape, which is why each is a targeted checker suppression naming the
# one diagnostic it answers, and not a `cast` claiming a type nobody verified.
#
# Length: over the 400-line cap. Splitting is not obviously the fix — the
# module docstring records that this control previously lived in four copies and
# carried the same two defects in all four, so a split that lets two halves drift
# is the failure it exists to prevent. Deciding that is a change of its own.
# rules-allow-file(file-length): splitting a shared compliance control is the drift this module was written to end, so it needs a decision rather than a refactor

REDACTED: Final = "[redacted]"
MAX_REDACTION_DEPTH: Final = 6

# Substrings that mark a key as carrying NPI, document content or a credential.
SENSITIVE_KEY_PARTS: Final[frozenset[str]] = frozenset(
    {
        # credentials, session material and connection strings
        "password",
        "passwd",
        "pwd",
        "secret",
        "token",
        "authorization",
        "cookie",
        "credential",
        "api_key",
        "apikey",
        "signature",
        "seal",
        "dsn",
        "database_url",
        "connection_string",
        "conn_str",
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
    }
)

# Keys that contain a sensitive substring but are safe and diagnostically
# valuable. Checked first, so this wins.
#
# Every entry here must be an exact key, never a fragment: the point is to
# readmit one named field, not to open a hole the width of a substring.
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
        # Work identity, not a person. Both contain `name` and were therefore
        # redacted in every environment despite being on the allowlist below —
        # the two tables are maintained separately and had contradicted each
        # other unnoticed. `test_every_allowlisted_diagnostic_actually_survives`
        # now covers the whole table rather than a hand-picked sample.
        "job_name",
        "queue_name",
    }
)

# --------------------------------------------------------------- the allowlist
#
# Everything above is a *blocklist*: it names what must not be logged. A
# blocklist is the wrong default for a deployed environment, because it is only
# ever as good as the last field someone thought of. Review demonstrated the
# gap — `field_value`, `party`, `result` and `reason` all carried a party name
# straight to stdout, because none of those words is in the list above and none
# of them looks alarming.
#
# So in a deployed environment the rule inverts: **a field is dropped unless it
# is named here.** New code that wants a field in production logs has to add it
# deliberately, which is a review conversation rather than a silent leak.
#
# Development keeps the blocklist, because a developer debugging their own
# synthetic data needs to see their own fields, and there is no real NPI there.

SAFE_DIAGNOSTIC_KEYS: Final[frozenset[str]] = frozenset(
    {
        # structlog's own
        "event",
        "level",
        "timestamp",
        "logger",
        "logger_name",
        "exception",  # sanitised separately by sanitise_exception
        # correlation and identity of the process, never of a person
        "request_id",
        "correlation_id",
        "service_name",
        "environment",
        # HTTP shape — the templated route, never a resolved path
        "method",
        "route",
        "status_code",
        "status_class",
        # outcome
        "error_code",
        "error_name",
        "exception_name",
        "outcome",
        "ready",
        "startup_complete",
        # work identity, not work content
        "job_name",
        "queue_name",
        "attempt",
        "renderer",
        # configuration echoed at startup; all bounded, none client-derived
        "max_concurrent_jobs",
        "max_concurrent_provider_calls",
        "gotenberg_timeout_seconds",
        "invalid_fields",
        "checks",
        "detail",
    }
)

# Suffixes that mark a *measurement*. Allowed only when the value is not a
# string: `page_count=181` is a diagnostic, `page_count="TIMOTHY BUCHANAN"` is
# someone smuggling a value through a numeric-looking name.
SAFE_NUMERIC_SUFFIXES: Final[tuple[str, ...]] = (
    "_count",
    "_ms",
    "_seconds",
    "_bytes",
    "_total",
    "_index",
    "_attempt",
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

# A trailing traceback line: `module.path.ExceptionType: message`. Matches a
# dotted class name followed by a colon, which is what Python emits.
_EXCEPTION_TYPE_RE: Final = re.compile(
    r"^[A-Za-z_][\w.]*(Error|Exception|Exit|Interrupt|Warning)\b\s*:"
)

# `scheme://user:password@host` anywhere in a string. Catches a Postgres DSN,
# an AMQP URL and an HTTP URL with basic credentials alike.
_URL_CREDENTIALS_RE: Final = re.compile(r"(?P<scheme>[a-z][a-z0-9+.\-]*://)[^\s/@]+:[^\s/@]+@")

# `password=...`, `pwd=...`, `secret=...`, `token=...`, `api_key=...` in a
# connection string or query fragment, terminated by `;`, `&` or whitespace.
_KEY_VALUE_SECRET_RE: Final = re.compile(
    r"(?i)\b(?P<key>password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)"
    r"\s*=\s*[^;&\s]+"
)


def normalise_key(key: str) -> str:
    return key.strip().lower().lstrip("_")


def is_sensitive_key(key: str, *, extra_parts: frozenset[str] = frozenset()) -> bool:
    """Whether a log field name marks its value as unloggable.

    The blocklist. Used on its own in development; in a deployed environment
    `is_allowed_key` decides instead and this only narrows further.
    """
    normalised = normalise_key(key)
    if normalised in SAFE_KEY_EXCEPTIONS:
        return False
    return any(part in normalised for part in SENSITIVE_KEY_PARTS | extra_parts)


def is_allowed_key(key: str, value: object) -> bool:
    """Whether a field may appear in a **deployed** environment's logs.

    The allowlist. A field survives only by being named in
    `SAFE_DIAGNOSTIC_KEYS`, or by carrying a measurement suffix with a
    non-string value — because `page_count=181` is a diagnostic and
    `page_count="TIMOTHY BUCHANAN"` is a value smuggled through a
    numeric-looking name.
    """
    normalised = normalise_key(key)
    if normalised in SAFE_DIAGNOSTIC_KEYS:
        return True
    return normalised.endswith(SAFE_NUMERIC_SUFFIXES) and not isinstance(value, str)


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


def scrub_credentials(value: str) -> str:
    """Mask credentials embedded in URLs, DSNs and connection strings.

    Key-based redaction cannot catch these: the same connection string appears
    under `database_url`, inside a `detail` message and inside a traceback, and
    only the first is named in a way a key rule could match.
    """
    scrubbed = _URL_CREDENTIALS_RE.sub(rf"\g<scheme>{REDACTED}@", value)
    return _KEY_VALUE_SECRET_RE.sub(rf"\g<key>={REDACTED}", scrubbed)


def scrub_text(value: str) -> str:
    """Every shape-based rule, applied to one string."""
    return scrub_credentials(scrub_signed_url(value))


def redact_value(
    value: object,
    *,
    depth: int = 0,
    extra_parts: frozenset[str] = frozenset(),
    allowlist_only: bool = False,
) -> object:
    """Recursively scrub a value kept because its key is permitted.

    Depth is bounded: a cyclic or pathologically nested structure must not turn
    a log call into a hang.
    """
    if depth >= MAX_REDACTION_DEPTH:
        return REDACTED
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, dict):
        return redact_mapping(
            value,  # pyright: ignore[reportUnknownArgumentType]  # rules-allow(any-type): isinstance proves `dict`; pyright infers `dict[Unknown, Unknown]` for it and nothing at runtime has checked the key or value types
            depth=depth + 1,
            extra_parts=extra_parts,
            allowlist_only=allowlist_only,
        )
    if isinstance(value, (list, tuple, set, frozenset)):
        scrubbed: list[object] = [
            redact_value(
                item,  # pyright: ignore[reportUnknownArgumentType]  # rules-allow(any-type): the element type of a container narrowed from `object` is `Unknown`; only the container class was checked
                depth=depth + 1,
                extra_parts=extra_parts,
                allowlist_only=allowlist_only,
            )
            for item in value  # pyright: ignore[reportUnknownVariableType]  # rules-allow(any-type): `item` inherits the same `Unknown` element type; the loop itself asserts nothing
        ]
        # A tuple stays a tuple so a caller comparing shapes is not surprised;
        # sets become lists because a scrubbed element may not be hashable.
        return tuple(scrubbed) if isinstance(value, tuple) else scrubbed
    return value


def redact_mapping(
    mapping: dict[str, object],
    *,
    depth: int = 0,
    extra_parts: frozenset[str] = frozenset(),
    allowlist_only: bool = False,
) -> dict[str, object]:
    """Apply every rule across one mapping.

    `allowlist_only` inverts the default: a field is dropped unless it is named
    in `SAFE_DIAGNOSTIC_KEYS`. Deployed environments run this way, because a
    blocklist is only as good as the last field somebody thought of.
    """
    if depth >= MAX_REDACTION_DEPTH:
        return {"truncated": REDACTED}
    result: dict[str, object] = {}
    for key, value in mapping.items():
        if allowlist_only:
            permitted = is_allowed_key(str(key), value) and not is_sensitive_key(
                str(key), extra_parts=extra_parts
            )
        else:
            permitted = not is_sensitive_key(str(key), extra_parts=extra_parts)

        if not permitted:
            result[key] = REDACTED
        else:
            result[key] = redact_value(
                value, depth=depth, extra_parts=extra_parts, allowlist_only=allowlist_only
            )
    return result


def sanitise_exception(traceback_text: str, *, keep_messages: bool) -> str:
    """Reduce a formatted traceback to something safe to ship.

    An exception message is arbitrary, data-controlled text. On this system it
    routinely contains exactly what must never be logged: a connection string
    from a driver error, a party name from a domain refusal, a document
    fragment from a parser.

    In a deployed environment only two kinds of line survive:

    - `File "...", line N, in function` — the call site. This is code
      structure, it identifies no one, and it is what makes a traceback worth
      keeping at all.
    - the trailing `SomeExceptionType: ...` line, reduced to the type. A class
      name is code; the message after the colon is data.

    Everything else is dropped, including the echoed source line Python prints
    under each frame. That line is usually harmless code, but it can carry a
    literal, and it costs little: the file and line number already say where to
    look, and the reader has the source.

    Locally the full text is kept — there is no real NPI in a development
    environment and a redacted traceback wastes an afternoon — but credentials
    are still masked, because a DSN in a developer's terminal ends up pasted
    into an issue.
    """
    if keep_messages:
        return scrub_text(traceback_text)

    safe_lines: list[str] = []
    for line in traceback_text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("Traceback (", "During handling", "The above")):
            safe_lines.append(stripped)
        elif stripped.startswith('File "'):
            # `File "path", line N, in func` — keep as-is, minus any message.
            safe_lines.append(f"  {stripped}")
        elif _EXCEPTION_TYPE_RE.match(stripped):
            exception_type, _, _ = stripped.partition(":")
            safe_lines.append(f"{exception_type}: {REDACTED}")
        # Anything else (echoed source, caret markers, chained notes) is
        # dropped rather than guessed at.
    return scrub_text("\n".join(safe_lines))

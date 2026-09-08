"""The error envelope: what a failure from this service looks like on the wire.

The shape, the code vocabulary, and the domain-failure-to-HTTP mapping. Pure
data and pure functions — nothing here imports FastAPI or touches a response.
`api/errors.py` is the other half: the four ASGI handlers that put this on the
wire, and the registration that installs them.

The seam is core-api's. That service cut the identical module at exactly this
line, and matching it is the point rather than a coincidence: the two files were
byte-for-byte the same contract under two roofs, and a shared home for them is
open as a request. Two copies that are also shaped differently are two copies
plus a merge.

Every failure leaves this service in one shape:

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": {}}}

`code` is stable and machine-readable. `message` is client-safe prose.
`request_id` ties the response to the log line without exposing anything about
the tenant or the order.

Domain code raises `DomainError`; this module is the only place that knows what
HTTP status that becomes.

**Submitted values never pass through.** FastAPI's validation errors echo the
offending input by default. On this system that input is a grantor name or a
legal description, so the `input` and `ctx` keys are stripped and only the field
location and the rule that failed survive — `sanitise_validation_errors`.
"""

from __future__ import annotations

from typing import Final

from pydantic import BaseModel, Field
from starlette.requests import Request

from titlepipe_blind.api.request_context import current_request_id, request_id_for
from titlepipe_domain import (
    ConflictError,
    DependencyUnavailableError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    RefusalError,
    UnauthenticatedError,
    ValidationError,
)

# Codes for failures that arise below the domain layer and so have no
# `DomainError` to carry them.
CODE_BAD_REQUEST: Final = "BAD_REQUEST"
CODE_VALIDATION_FAILED: Final = "VALIDATION_FAILED"
CODE_NOT_FOUND: Final = "NOT_FOUND"
CODE_METHOD_NOT_ALLOWED: Final = "METHOD_NOT_ALLOWED"
CODE_INTERNAL_ERROR: Final = "INTERNAL_ERROR"

GENERIC_INTERNAL_MESSAGE: Final = (
    "An unexpected error occurred. Quote the request id when reporting it."
)

# What a caller reads instead of an `HTTPException.detail` that cannot be shown
# to them. `_publishable_detail` decides when that is.
GENERIC_HTTP_MESSAGE: Final = "Request could not be served."

# One place decides what a domain failure means over HTTP.
DOMAIN_ERROR_STATUS: Final[dict[type[DomainError], int]] = {
    ValidationError: 422,
    RefusalError: 422,
    UnauthenticatedError: 401,
    PermissionDeniedError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    DependencyUnavailableError: 503,
}

# Statuses Starlette raises on its own behalf.
STARLETTE_STATUS_CODES: Final[dict[int, str]] = {
    400: CODE_BAD_REQUEST,
    404: CODE_NOT_FOUND,
    405: CODE_METHOD_NOT_ALLOWED,
}

# Only these survive from a Pydantic error. `type` is a stable machine-readable
# code the frontend can branch on; `loc` names the field.
#
# `msg` is deliberately NOT kept. Review demonstrated why: a custom validator
# raising `ValueError(f"grantor must be uppercase, got {value!r}")` puts the
# submitted value into `msg`, and on this system that value is a party name. The
# input was already stripped; keeping the message re-admitted it by another door.
_VALIDATION_KEYS_TO_KEEP: Final = ("type", "loc")


class ErrorBody(BaseModel):
    """The body of a refusal or failure."""

    code: str = Field(description="Stable machine-readable identifier.")
    message: str = Field(description="Client-safe explanation.")
    request_id: str | None = Field(default=None, description="Correlation id for this request.")
    # `object`, not `Any`. This is a JSON bag on its way out of the process;
    # nothing reads a value back out of it, and Pydantic validates and
    # serialises the two identically (same JSON schema, same `model_dump`).
    details: dict[str, object] = Field(
        default_factory=dict, description="Safe, structured context. Never NPI."
    )


class ErrorEnvelope(BaseModel):
    """Every non-2xx response from this service."""

    error: ErrorBody


UNMAPPED_STATUS: Final = 500


def mapped_status_for(error: DomainError) -> int | None:
    """The REGISTERED status, or `None` when `DOMAIN_ERROR_STATUS` has no entry.

    An exact lookup first, then a walk up the MRO, so a future
    `EscalationRequiresRuleError(RefusalError)` maps to 422 without being
    registered.

    THE `None` IS THE WHOLE POINT OF THIS FUNCTION EXISTING. `handle_domain_error`
    used to ask `if status >= 500` and log `domain_error_unmapped` — so
    `DependencyUnavailableError`, registered at 503 six lines above, logged an
    ERROR saying it was not mapped, every time it was raised. core-api measured
    that on its own byte-identical copy of this table and fixed it there; this
    copy kept the defect, because nothing in this service raises a registered
    5xx yet and so nothing ever printed the line.

    A status is an ANSWER TO THE CALLER and "was there a mapping" is a fact about
    THIS SERVICE'S configuration; the two overlap on 500 and nowhere else, which
    is why one stood in for the other for as long as it did. Separating them is
    the fix, rather than widening the comparison to `>= 500 and status not in
    DOMAIN_ERROR_STATUS.values()` — that spelling is wrong again the moment a
    second 5xx is registered, and it asks the question of the values rather than
    of the lookup that was actually performed.
    """
    exact = DOMAIN_ERROR_STATUS.get(type(error))
    if exact is not None:
        return exact
    for base in type(error).__mro__:
        if base in DOMAIN_ERROR_STATUS:
            return DOMAIN_ERROR_STATUS[base]
    return None


def status_for(error: DomainError) -> int:
    """Map a domain failure onto HTTP, honouring subclass relationships.

    Unchanged in behaviour and kept as the name callers use — an unregistered
    failure becomes 500 rather than silently reporting success. What moved out
    of it is the ability to tell "500 because that is the mapping" from "500
    because there was no mapping", which is now `mapped_status_for`'s `None`.
    """
    mapped = mapped_status_for(error)
    return UNMAPPED_STATUS if mapped is None else mapped


def envelope(
    *,
    code: str,
    message: str,
    details: dict[str, object] | None = None,
    request: Request | None = None,
) -> dict[str, object]:
    """Build the response body, stamping the correlation id.

    Resolved from the request where one is available. The contextvar alone is
    not enough: the handler for an unhandled exception runs inside Starlette's
    `ServerErrorMiddleware`, which sits *outside* the request-context
    middleware and therefore runs after its reset. Reading only the contextvar
    stamps `null` on precisely the response whose id the caller most needs to
    quote.
    """
    request_id = request_id_for(request) if request is not None else current_request_id()
    return ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=message,
            request_id=request_id,
            details=details or {},
        )
    ).model_dump()


def sanitise_validation_errors(raw: list[dict[str, object]]) -> list[dict[str, object]]:
    """Reduce Pydantic errors to a stable code and a field location.

    An allowlist, not a denylist. `loc` names *which* field was wrong and `type`
    names *what rule* it broke — enough for a caller to act on, and enough for
    the frontend to render its own copy.

    Everything else is dropped, including `msg`. A denylist here was the defect:
    `input` and `ctx` were removed, but a custom validator's message carried the
    submitted value anyway, and on this system that is a party name.
    """
    cleaned: list[dict[str, object]] = []
    for item in raw:
        entry: dict[str, object] = {}
        for key in _VALIDATION_KEYS_TO_KEEP:
            if key not in item:
                continue
            value = item[key]
            # The suppression below is NOT the one that `dict(entry)` replaced two
            # functions down, and the same technique does not reach it. There, the
            # incoming type was *known* (a TypedDict) and merely too narrow, so
            # rebuilding the value widened it at runtime. Here the incoming type is
            # `object`: `isinstance(value, (list, tuple))` proves the class and says
            # nothing about the elements, so pyright infers
            # `list[Unknown] | tuple[Unknown, ...]` and reports every expression that
            # reads it — including the `list(...)`/helper call that would do the
            # widening, because the flagged thing is the argument going in, not the
            # value coming out. Seven rewrites were tried; all seven moved the
            # diagnostic without removing it. `str(part)` is total on every object,
            # so nothing about the elements is being claimed.
            if key == "loc" and isinstance(value, (list, tuple)):
                entry[key] = [str(part) for part in value]  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]  # rules-allow(any-type): a container narrowed out of `object` has `Unknown` element types and pyright cannot be shown otherwise; `str(part)` asserts nothing about them
            else:
                entry[key] = str(value)
        cleaned.append(entry)
    return cleaned

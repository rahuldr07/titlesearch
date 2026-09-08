"""The error envelope: what a failure from this service looks like on the wire.

The shape, the code vocabulary, and the domain-failure-to-HTTP mapping. Pure
data and pure functions — nothing here imports FastAPI or touches a response.
`api/errors.py` is the other half: the four ASGI handlers that put this on the
wire, and the registration that installs them.

The split is not cosmetic and was not chosen to satisfy a line count. The call
graph already had this boundary before the file was cut: `app.py` imports only
`build_unhandled_response` and `register_error_handlers` (both wiring), and the
test modules import only `CODE_*`, `GENERIC_INTERNAL_MESSAGE`,
`DOMAIN_ERROR_STATUS`, `status_for` and `sanitise_validation_errors` (all
contract). Not one importer straddled the line, which is what makes it a seam
rather than a cut. The practical consequence is that the contract half is now
importable, and assertable, without constructing an app.


Every failure leaves this service in one shape:

    {"error": "...", "code": "...", "request_id": "...", "details": {}}

🔴 `error` IS THE SENTENCE, NOT AN OBJECT, AND THE FLATNESS IS THE CONTRACT.
`apps/web/src/shared/api.ts::readError` reads `body.error` and keeps it only
`if (typeof message === "string" && message.length > 0)`; anything else falls
through to `` `${status} ${statusText}` ``. This layer used to nest the sentence
one level down, as `{"error": {"message": ...}}`, which fails that test — so
under `VITE_API_MODE=live` every refusal this service composed reached the
reviewer as "503 Service Unavailable". MEASURED 2026-09-04 by feeding this
module's own `envelope()` output through the browser's predicate. There is no
throw and no console line: the client takes the status-line branch silently,
which is how it survived a green suite on both sides. PLAN.md §4 calls the
string "a rendered-string contract, not optional API hygiene", and
`packages/mocks` has always sent the flat shape — so the mock and the service
disagreed about the one member the browser actually reads, and cutover was the
moment every rendered reason turned into a status line.

The machine holding it is `tests/test_error_contract_parity.py` over the
committed `contract-fixtures/error-envelope.json`, which asserts the browser
predicate itself rather than the key layout.

`code`, `request_id` and `details` ride as SIBLINGS of the sentence rather than
being folded into it: dropping them to satisfy the string would trade a silent
render bug for a silent diagnosis one. `code` is stable where the sentence is
prose. Nothing branches on it today — checked across `apps/web/src` and the
Playwright specs, neither reads it — and it stays so that a refusal test can pin
an identity without pinning wording. `request_id` ties the response to the log
line without exposing anything about the tenant or the order.

Domain code raises `DomainError`; this module is the only place that knows what
HTTP status that becomes. Nothing in `services/` or `libs/domain` imports
`HTTPException`.

Two things this layer refuses to pass through:

**Submitted values.** FastAPI's validation errors echo the offending input by
default. On this system that input is a grantor name or a legal description, so
the `input` and `ctx` keys are stripped and only the field location and the rule
that failed survive.

**Internals.** An unhandled exception in a deployed environment yields a generic
500 with no type, message or traceback. The detail goes to the log, bound to the
same `request_id` the caller was given.
"""

from __future__ import annotations

from typing import Final

from pydantic import BaseModel, Field
from starlette.requests import Request

from titlepipe_core.api.request_context import current_request_id, request_id_for
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
# to them. `api/errors.py::_publishable_detail` decides when that is; the
# sentence lives here beside the other one so both are read together.
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


class ErrorEnvelope(BaseModel):
    """Every non-2xx response from this service. Flat, and see the module docstring.

    Field ORDER is load-bearing for a human, not for a parser: `error` is
    declared first so `model_dump()` puts the sentence at the top of the body a
    developer reads in a network tab, ahead of the correlation id they only need
    once something is wrong twice.
    """

    error: str = Field(description="Client-safe explanation. Rendered verbatim by the browser.")
    code: str = Field(description="Stable machine-readable identifier.")
    request_id: str | None = Field(default=None, description="Correlation id for this request.")
    # `object`, not `Any`. This is a JSON bag on its way out of the process;
    # nothing reads a value back out of it, and Pydantic validates and
    # serialises the two identically (same JSON schema, same `model_dump`).
    details: dict[str, object] = Field(
        default_factory=dict, description="Safe, structured context. Never NPI."
    )


# What an unregistered failure becomes. 500 and not 503: nothing here knows
# whether the caller may retry, and the honest answer to "this service raised a
# failure it has no mapping for" is that the service is at fault.
UNMAPPED_STATUS: Final = 500


def mapped_status_for(error: DomainError) -> int | None:
    """The REGISTERED status, or `None` when `DOMAIN_ERROR_STATUS` has no entry.

    An exact lookup first, then a walk up the MRO, so a future
    `EscalationRequiresRuleError(RefusalError)` maps to 422 without being
    registered.

    🔴 THE `None` IS THE WHOLE POINT OF THIS FUNCTION EXISTING, and it exists
    because inferring "unmapped" FROM THE NUMBER was a real defect that shipped.
    `handle_domain_error` used to read `if status >= 500` and log
    `domain_error_unmapped` — so `DependencyUnavailableError`, which is
    registered at 503 six lines above, logged an ERROR saying it was not, every
    single time. It went unnoticed for exactly as long as nothing raised a
    registered 5xx: `DOMAIN_ERROR_STATUS` has one, this service had no code path
    that reached it, and the first one to arrive was Plan 02's
    `GET /api/rules` failing over to `api/routers/rules.py`'s 503. Found by
    reading that route's own log output.

    A status is an ANSWER TO THE CALLER and "was there a mapping" is a fact about
    THIS SERVICE'S configuration; the two happen to overlap on 500 and nowhere
    else, which is why one could stand in for the other for as long as it did.
    Separating them is the fix, rather than widening the comparison to
    `>= 500 and status not in DOMAIN_ERROR_STATUS.values()` — that spelling is
    wrong again the moment a second 5xx is registered, and it asks the question
    of the values rather than of the lookup that was actually performed.
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
        error=message,
        code=code,
        request_id=request_id,
        details=details or {},
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

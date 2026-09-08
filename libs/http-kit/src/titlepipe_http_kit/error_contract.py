"""The error contract both API services answer with: codes, statuses, sanitisation.

The code vocabulary, the domain-failure-to-HTTP mapping, and the validation-error
scrub. Pure data and pure functions — nothing here imports FastAPI, builds a
response, or knows what the body looks like.

WHAT IS DELIBERATELY NOT HERE: the envelope shape. core-api answers a FLAT body
(`{"error": "<sentence>", ...}` — the flatness is a measured browser contract,
see `services/core-api/.../api/error_envelope.py`) and blind-svc answers a
NESTED one (`{"error": {"code": ..., "message": ...}}`). Those are two
observable wire shapes, each pinned by its own service's tests, and unifying
them here would have meant changing one service's HTTP behaviour to make an
extraction tidy. So each service keeps its own `ErrorEnvelope` model and
`envelope()` builder, and this module holds everything underneath the shape —
which is where the byte-identical duplication lived and where its one real
defect happened (see `mapped_status_for`).

Domain code raises `DomainError`; this module is the only place that knows what
HTTP status that becomes. Nothing in `services/` or `libs/domain` imports
`HTTPException`.

**Submitted values never pass through.** FastAPI's validation errors echo the
offending input by default. On this system that input is a grantor name or a
legal description, so the `input` and `ctx` keys are stripped and only the field
location and the rule that failed survive — `sanitise_validation_errors`.
"""

from __future__ import annotations

from http import HTTPStatus
from typing import Final

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
# to them. Each service's `api/errors.py::_publishable_detail` decides when that
# is.
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

# Statuses Starlette raises on its own behalf. This table lived under two names
# — `_HTTP_STATUS_CODES` in one service, `STARLETTE_STATUS_CODES` in the other
# — before the copies were reconciled; this is the one definition, under the
# name core-api's importers already used.
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

# What an unregistered failure becomes. 500 and not 503: nothing here knows
# whether the caller may retry, and the honest answer to "this service raised a
# failure it has no mapping for" is that the service is at fault.
UNMAPPED_STATUS: Final = 500


def mapped_status_for(error: DomainError) -> int | None:
    """The REGISTERED status, or `None` when `DOMAIN_ERROR_STATUS` has no entry.

    An exact lookup first, then a walk up the MRO, so a future
    `EscalationRequiresRuleError(RefusalError)` maps to 422 without being
    registered.

    THE `None` IS THE WHOLE POINT OF THIS FUNCTION EXISTING, and it exists
    because inferring "unmapped" FROM THE NUMBER was a real defect that shipped
    twice — once per copy of this module, back when each API service carried its
    own. `handle_domain_error` used to read `if status >= 500` and log
    `domain_error_unmapped` — so `DependencyUnavailableError`, which is
    registered at 503 in the table above, logged an ERROR saying it was not,
    every single time. core-api measured and fixed that on its copy; blind-svc's
    byte-identical copy kept the defect until the reuse audit that led to this
    package, because nothing there raises a registered 5xx yet and so nothing
    ever printed the line. That silent divergence is why this module now has one
    home.

    A status is an ANSWER TO THE CALLER and "was there a mapping" is a fact about
    THE SERVICE'S configuration; the two happen to overlap on 500 and nowhere
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


def publishable_detail(detail: object, *, status: int, deployed: bool) -> str:
    """`exc.detail`, or the generic sentence when it cannot be shown to a caller.

    THE DETAIL USED TO GO OUT VERBATIM IN EVERY ENVIRONMENT. `handle_unexpected`,
    in each service's `api/errors.py`, spends its whole body on this exact
    question and answers "not in a deployed environment"; the HTTPException
    handler asked it of nothing. It was DORMANT rather than harmless: rule 4 of
    `scripts/check_backend_rules.py` bans `HTTPException` outside those modules,
    so no code in this tree can put a sentence of its own there today. A ban is
    not a redaction — it holds for our code, says nothing about a dependency's,
    and stops holding the day the ban is exempted once.

    A DETAIL EQUAL TO THE STATUS'S OWN REASON PHRASE IS STILL PUBLISHED, deployed
    or not. `HTTPException(404)` defaults `detail` to `HTTPStatus(404).phrase`, so
    "Not Found" and "Method Not Allowed" — every detail this tree can currently
    produce — are constants of the protocol and carry nothing about this system.
    Redacting them too was the rejected alternative: it costs every 404 its
    sentence to protect against text that is provably not there.

    Anything else was AUTHORED, by us or by a dependency, and no reviewer has read
    it. Outside a deployed environment it goes out — there is no real NPI in
    development and a blank error wastes an afternoon.

    This function and its caller were duplicated byte-for-byte in both services'
    `api/errors.py`, each copy carrying a residual note that a shared home did
    not exist. This package is that home; the copies are gone, and each service's
    own suite (core-api's test_errors.py, blind-svc's test_foundation.py) still
    asserts the behaviour end-to-end through its app.
    """
    if not isinstance(detail, str) or not detail:
        return GENERIC_HTTP_MESSAGE
    if not deployed or detail == _status_phrase(status):
        return detail
    return GENERIC_HTTP_MESSAGE


def _status_phrase(status: int) -> str:
    """The protocol's own sentence for this status, or `""` for one it has none for.

    `""` and not `None` so the comparison above stays an equality between two
    strings; a detail is never empty by the time it is compared.
    """
    try:
        return HTTPStatus(status).phrase
    except ValueError:
        return ""


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
            # `isinstance(value, (list, tuple))` proves the class and says
            # nothing about the elements, so pyright infers
            # `list[Unknown] | tuple[Unknown, ...]` and reports every expression
            # that reads it — including the `list(...)`/helper call that would do
            # the widening, because the flagged thing is the argument going in,
            # not the value coming out. Seven rewrites were tried; all seven
            # moved the diagnostic without removing it. `str(part)` is total on
            # every object, so nothing about the elements is being claimed.
            if key == "loc" and isinstance(value, (list, tuple)):
                entry[key] = [str(part) for part in value]  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]  # rules-allow(any-type): a container narrowed out of `object` has `Unknown` element types and pyright cannot be shown otherwise; `str(part)` asserts nothing about them
            else:
                entry[key] = str(value)
        cleaned.append(entry)
    return cleaned

"""The single error-mapping layer.

Every failure leaves this service in one shape:

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": {}}}

`code` is stable and machine-readable; the frontend and the Playwright refusal
tests branch on it. `message` is client-safe prose. `request_id` ties the
response to the log line without exposing anything about the tenant or the
order.

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

from collections.abc import Callable
from typing import Any, Final, cast

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse

from titlepipe_core.api.request_context import current_request_id, request_id_for
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import (
    ConflictError,
    DependencyUnavailableError,
    DomainError,
    Environment,
    NotFoundError,
    PermissionDeniedError,
    RefusalError,
    UnauthenticatedError,
    ValidationError,
)


def _log() -> Any:
    """Acquired at call time, never bound at import. A module-level logger pins
    whatever logging configuration was active first and silently ignores a later
    one — see `get_logger`'s own warning. `request_context._log` follows the same
    rule; two apps in one process must each log under their own settings."""
    return get_logger(__name__)


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
_HTTP_STATUS_CODES: Final[dict[int, str]] = {
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
    details: dict[str, Any] = Field(
        default_factory=dict, description="Safe, structured context. Never NPI."
    )


class ErrorEnvelope(BaseModel):
    """Every non-2xx response from this service."""

    error: ErrorBody


def status_for(error: DomainError) -> int:
    """Map a domain failure onto HTTP, honouring subclass relationships.

    An exact lookup first, then a walk up the MRO, so a future
    `EscalationRequiresRuleError(RefusalError)` maps to 422 without being
    registered — and an unregistered failure becomes 500 rather than silently
    reporting success.
    """
    exact = DOMAIN_ERROR_STATUS.get(type(error))
    if exact is not None:
        return exact
    for base in type(error).__mro__:
        if base in DOMAIN_ERROR_STATUS:
            return DOMAIN_ERROR_STATUS[base]
    return 500


def envelope(
    *,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    request: Request | None = None,
) -> dict[str, Any]:
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


def sanitise_validation_errors(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reduce Pydantic errors to a stable code and a field location.

    An allowlist, not a denylist. `loc` names *which* field was wrong and `type`
    names *what rule* it broke — enough for a caller to act on, and enough for
    the frontend to render its own copy.

    Everything else is dropped, including `msg`. A denylist here was the defect:
    `input` and `ctx` were removed, but a custom validator's message carried the
    submitted value anyway, and on this system that is a party name.
    """
    cleaned: list[dict[str, Any]] = []
    for item in raw:
        entry: dict[str, Any] = {}
        for key in _VALIDATION_KEYS_TO_KEEP:
            if key not in item:
                continue
            value = item[key]
            if key == "loc" and isinstance(value, (list, tuple)):
                entry[key] = [str(part) for part in value]  # pyright: ignore[reportUnknownVariableType, reportUnknownArgumentType]
            else:
                entry[key] = str(value)
        cleaned.append(entry)
    return cleaned


ENVIRONMENT_STATE_KEY: Final = "environment"


def _environment_of(request: Request) -> Environment:
    """Read the environment the app was built for.

    Defaults to PRODUCTION when unset. Failing closed matters here: this value
    decides whether an unhandled exception's detail reaches the client, and a
    missing setting must not be the reason internals get published.
    """
    value: object = getattr(request.app.state, ENVIRONMENT_STATE_KEY, None)
    return value if isinstance(value, Environment) else Environment.PRODUCTION


async def handle_domain_error(request: Request, exc: Exception) -> JSONResponse:
    """Deliberate domain failures and refusals."""
    error = exc if isinstance(exc, DomainError) else DomainError(str(exc))
    status = status_for(error)
    if status >= 500:
        # An unmapped domain error is a gap in DOMAIN_ERROR_STATUS, not a
        # caller mistake. Say so loudly enough to be fixed.
        _log().error(
            "domain_error_unmapped",
            error_name=type(error).__name__,
            error_code=error.code,
        )
    return JSONResponse(
        status_code=status,
        content=envelope(
            code=error.code,
            message=error.message,
            details=error.details,
            request=request,
        ),
    )


async def handle_request_validation(request: Request, exc: Exception) -> JSONResponse:
    """Schema failures, with the submitted values stripped out."""
    errors: list[dict[str, Any]] = []
    if isinstance(exc, RequestValidationError):
        errors = sanitise_validation_errors(cast("list[dict[str, Any]]", exc.errors()))
    return JSONResponse(
        status_code=422,
        content=envelope(
            code=CODE_VALIDATION_FAILED,
            message="The request did not match the expected schema.",
            details={"errors": errors},
            request=request,
        ),
    )


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    """Statuses Starlette raises itself — an unknown route, a bad method."""
    status = exc.status_code if isinstance(exc, StarletteHTTPException) else 500
    code = _HTTP_STATUS_CODES.get(
        status, CODE_INTERNAL_ERROR if status >= 500 else CODE_BAD_REQUEST
    )
    detail: object = getattr(exc, "detail", None)
    message = detail if isinstance(detail, str) and detail else "Request could not be served."
    return JSONResponse(
        status_code=status,
        content=envelope(code=code, message=message, request=request),
    )


async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
    """Anything not anticipated.

    The detail goes to the log, bound to the same request id the caller is
    given, and never into the response body of a deployed environment.
    """
    _log().exception("unhandled_exception", exception_name=type(exc).__name__)
    details: dict[str, Any] = {}
    if not _environment_of(request).is_deployed:
        details = {"exception": type(exc).__name__, "developer_message": str(exc)}
    return JSONResponse(
        status_code=500,
        content=envelope(
            code=CODE_INTERNAL_ERROR,
            message=GENERIC_INTERNAL_MESSAGE,
            details=details,
            request=request,
        ),
    )


def build_unhandled_response(
    environment: Environment,
) -> Callable[[str, BaseException], JSONResponse]:
    """The 500 envelope, as a plain function of the correlation id.

    Handed to `RequestContextMiddleware` so the response is produced *inside*
    the correlation and CORS layers. Starlette's `ServerErrorMiddleware` sits
    outside both, so a 500 it renders reaches the caller with no
    `X-Request-ID` header and no CORS headers.
    """

    def build(request_id: str, exc: BaseException) -> JSONResponse:
        details: dict[str, Any] = {}
        if not environment.is_deployed:
            # Locally the developer message is present: there is no real NPI in
            # a development environment and a blank 500 wastes an afternoon.
            details = {"exception": type(exc).__name__, "developer_message": str(exc)}
        return JSONResponse(
            status_code=500,
            content=ErrorEnvelope(
                error=ErrorBody(
                    code=CODE_INTERNAL_ERROR,
                    message=GENERIC_INTERNAL_MESSAGE,
                    request_id=request_id,
                    details=details,
                )
            ).model_dump(),
        )
        # No X-Request-ID here: RequestContextMiddleware's send wrapper is the
        # single writer of that header. Setting it in both places emitted it
        # twice, which reads as `trace-500, trace-500` to a client.

    return build


def register_error_handlers(app: FastAPI, *, environment: Environment) -> None:
    """Install the mapping layer. Called once, by the app factory.

    Registration is explicit rather than decorator-driven so each handler is a
    named, importable, directly testable function.
    """
    setattr(app.state, ENVIRONMENT_STATE_KEY, environment)
    app.add_exception_handler(DomainError, handle_domain_error)
    app.add_exception_handler(RequestValidationError, handle_request_validation)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected)

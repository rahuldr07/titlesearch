"""The four ASGI error handlers, and the registration that installs them.

`api/error_envelope.py` holds the wire shape; the code vocabulary and the
status mapping are `titlepipe_http_kit.error_contract`, shared with core-api.
This module is what puts both on a response.

**Internals never pass through.** An unhandled exception in a deployed
environment yields a generic 500 with no type, message or traceback. The detail
goes to the log, bound to the same `request_id` the caller was given.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Final

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from structlog.typing import FilteringBoundLogger

from titlepipe_blind.api.error_envelope import ErrorBody, ErrorEnvelope, envelope
from titlepipe_domain import DomainError, Environment
from titlepipe_http_kit.error_contract import (
    CODE_BAD_REQUEST,
    CODE_INTERNAL_ERROR,
    CODE_VALIDATION_FAILED,
    GENERIC_INTERNAL_MESSAGE,
    STARLETTE_STATUS_CODES,
    UNMAPPED_STATUS,
    mapped_status_for,
    publishable_detail,
    sanitise_validation_errors,
)
from titlepipe_service_kit.telemetry.logging import get_logger


def _log() -> FilteringBoundLogger:
    """Acquired at call time, never bound at import. A module-level logger pins
    whatever logging configuration was active first and silently ignores a later
    one — see `get_logger`'s own warning. `request_context._log` follows the same
    rule; two apps in one process must each log under their own settings."""
    return get_logger(__name__)


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
    mapped = mapped_status_for(error)
    status = UNMAPPED_STATUS if mapped is None else mapped
    if mapped is None:
        # An unmapped domain error is a gap in DOMAIN_ERROR_STATUS, not a
        # caller mistake. Say so loudly enough to be fixed.
        #
        # THE CONDITION WAS `if status >= 500`, WHICH IS NOT THE SAME QUESTION —
        # see `mapped_status_for`, which carries the measurement. The loud log
        # for a GENUINELY unmapped error is kept: it is worth having, and
        # narrowing the condition is what makes it mean something.
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
    errors: list[dict[str, object]] = []
    if isinstance(exc, RequestValidationError):
        # `dict(entry)` rather than a cast: `exc.errors()` yields a TypedDict,
        # and widening it by construction is checked where a cast is asserted.
        errors = sanitise_validation_errors([dict(entry) for entry in exc.errors()])
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
    code = STARLETTE_STATUS_CODES.get(
        status, CODE_INTERNAL_ERROR if status >= 500 else CODE_BAD_REQUEST
    )
    message = publishable_detail(
        getattr(exc, "detail", None),
        status=status,
        deployed=_environment_of(request).is_deployed,
    )
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
    details: dict[str, object] = {}
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
        details: dict[str, object] = {}
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

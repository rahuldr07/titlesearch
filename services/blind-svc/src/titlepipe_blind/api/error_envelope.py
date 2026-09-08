"""The error envelope: what a failure from this service looks like on the wire.

THE SHAPE, AND ONLY THE SHAPE, LIVES HERE. The code vocabulary, the
domain-failure-to-HTTP mapping and the validation-error scrub were byte-shared
with core-api and moved to `titlepipe_http_kit.error_contract`; `api/errors.py`
holds the four ASGI handlers that put all of it on the wire.

Every failure leaves this service in one shape:

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": {}}}

`code` is stable and machine-readable. `message` is client-safe prose.
`request_id` ties the response to the log line without exposing anything about
the tenant or the order.

This NESTED layout is the one deliberate difference from core-api, whose body is
flat because a browser predicate reads `body.error` as a string (the measurement
lives in that service's copy of this module). Both layouts are pinned by their
own service's tests, which is why the shared package stops at the shape: a
common model would have had to change one service's observable responses to
exist. This service's callers are not that browser; if they ever are, the
migration is a wire change to schedule, not a refactor to slip in.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from starlette.requests import Request

from titlepipe_http_kit.request_context import current_request_id, request_id_for


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

"""Request correlation identity.

Every request carries an opaque correlation ID. It is generated if absent,
echoed on the response, bound into the logging context for the life of the
request, and cleared afterwards.

Two constraints the plan is explicit about:

**The ID never contains a tenant, order or user identifier.** It is a UUID with
no structure to read. An inbound ID is accepted for cross-service correlation,
but only after passing a strict character and length check — an unvalidated
header lands in every log line for that request, which is a log-injection and
unbounded-growth vector, not merely untidy.

**The context is always reset.** The middleware clears in `finally`, so a
recycled worker task cannot inherit the previous request's identity. The same
discipline applies to the tenant context that arrives at Gate 2; establishing it
here means that mechanism is already proven when it starts carrying isolation.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from contextvars import ContextVar
from typing import Final, cast

import structlog
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from titlepipe_domain import IdFactory, Uuid4IdFactory

REQUEST_ID_HEADER: Final = "X-Request-ID"
MAX_INBOUND_REQUEST_ID_LENGTH: Final = 64
_INBOUND_REQUEST_ID_RE: Final = re.compile(r"^[A-Za-z0-9_.\-]{1,64}$")

SCOPE_STATE_KEY: Final = "request_id"

_request_id: ContextVar[str | None] = ContextVar("titlepipe_request_id", default=None)


def current_request_id() -> str | None:
    """The correlation ID for the request being served, if there is one.

    Reads the contextvar, which is only set while this middleware's frame is on
    the stack. Starlette's `ServerErrorMiddleware` sits *outside* it, so the
    handler for an unhandled exception runs after the reset and would see
    `None` here — which is why the id is also written into the ASGI scope and
    why error handlers should prefer `request_id_for`.
    """
    return _request_id.get()


def request_id_for(request: Request) -> str | None:
    """The correlation ID for a request, readable from any middleware layer.

    Prefer this in error handlers: it survives the contextvar reset because it
    lives on the scope, and an unhandled 500 is exactly when the caller most
    needs an id to quote.
    """
    scope_state: object = request.scope.get("state")
    if isinstance(scope_state, dict):
        stored: object = cast("dict[str, object]", scope_state).get(SCOPE_STATE_KEY)
        if isinstance(stored, str):
            return stored
    return current_request_id()


def sanitise_inbound_request_id(raw: str | None) -> str | None:
    """Accept a caller-supplied correlation ID, or reject it silently.

    Rejection is not an error: a malformed header means the caller does not get
    correlation, not that the request fails.
    """
    if raw is None:
        return None
    candidate = raw.strip()
    if not candidate or len(candidate) > MAX_INBOUND_REQUEST_ID_LENGTH:
        return None
    if not _INBOUND_REQUEST_ID_RE.match(candidate):
        return None
    return candidate


class RequestContextMiddleware:
    """Pure ASGI middleware establishing and tearing down request context.

    Written against the ASGI interface rather than `BaseHTTPMiddleware` because
    that class runs the downstream app in a separate task, which breaks
    contextvar propagation back to the caller — the exact failure this
    middleware exists to avoid.
    """

    def __init__(self, app: ASGIApp, *, id_factory: IdFactory | None = None) -> None:
        self.app = app
        self._id_factory: IdFactory = id_factory or Uuid4IdFactory()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        request_id = (
            sanitise_inbound_request_id(request.headers.get(REQUEST_ID_HEADER))
            or self._id_factory.new_id()
        )

        # Written to the scope as well as the contextvar. The scope outlives
        # this frame, so the outermost error handler can still name the request.
        existing: object = scope.get("state")
        state: dict[str, object] = (
            cast("dict[str, object]", existing) if isinstance(existing, dict) else {}
        )
        state[SCOPE_STATE_KEY] = request_id
        scope["state"] = state

        token = _request_id.set(request_id)
        structlog.contextvars.bind_contextvars(request_id=request_id)

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                raw: object = message.get("headers")
                headers: list[tuple[bytes, bytes]] = (
                    list(cast("list[tuple[bytes, bytes]]", raw)) if isinstance(raw, list) else []
                )
                headers.append(
                    (REQUEST_ID_HEADER.lower().encode("latin-1"), request_id.encode("latin-1"))
                )
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            structlog.contextvars.unbind_contextvars("request_id")
            _request_id.reset(token)


RequestHandler = Callable[[Request], Awaitable[Response]]

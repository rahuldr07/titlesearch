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
from typing import (
    Final,
    cast,  # rules-allow(any-type): three uses below, each behind an `isinstance` and each carrying its own line-scoped reason for what it claims beyond that check
)

import structlog
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from structlog.typing import FilteringBoundLogger

from titlepipe_domain import IdFactory, Uuid4IdFactory

# Starlette types the ASGI scope and every message as `MutableMapping[str, Any]`,
# so anything read out of either arrives as `Any`. Each `isinstance` below proves
# a *class* and only a class; pyright then infers `dict[Unknown, Unknown]` or
# `list[Unknown]`, because narrowing out of an untyped mapping tells it nothing
# about the contents. The three `cast`s supply the missing type arguments, and
# each is exempted on its own line rather than by one exemption for the file,
# because the honest answer differs per site: two of them claim a key type that
# nothing has checked, and the third claims only `object`, which is true of every
# element of every list.
#
# The file-scoped exemption that used to sit here said the casts "assert nothing
# the code has not tested". That was false at the headers site, and the falsehood
# had teeth. `isinstance(raw, list)` proves `list`; the cast claimed
# `list[tuple[bytes, bytes]]`; and a downstream app emitting `str` header names
# turned the dedupe below into a `str`-versus-`bytes` comparison, which is always
# unequal — so the existing `X-Request-ID` survived the filter and this middleware
# appended a second one. That is exactly the regression the "Replace, never
# append" comment says the code exists to prevent. The inbound list is now
# filtered against the pair shape at runtime before anything is compared, so what
# reaches the dedupe is checked rather than claimed.

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
        state = cast(  # rules-allow(any-type): isinstance proves `dict` and nothing more; the `str` key type is asserted and unverified, and is harmless only because the single use is a `.get()` whose result is re-checked below
            "dict[str, object]",
            scope_state,
        )
        stored: object = state.get(SCOPE_STATE_KEY)
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

    def __init__(
        self,
        app: ASGIApp,
        *,
        id_factory: IdFactory | None = None,
        on_unhandled: Callable[[str, BaseException], Response] | None = None,
    ) -> None:
        self.app = app
        self._id_factory: IdFactory = id_factory or Uuid4IdFactory()
        # Builds the 500 envelope. Injected rather than imported so this module
        # stays free of the error-mapping layer, which imports from here.
        self._on_unhandled = on_unhandled

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
            cast(  # rules-allow(any-type): isinstance proves `dict` and nothing more; the `str` key type is asserted and unverified, and is harmless only because this frame writes one `str` key and reads nothing back out
                "dict[str, object]",
                existing,
            )
            if isinstance(existing, dict)
            else {}
        )
        state[SCOPE_STATE_KEY] = request_id
        scope["state"] = state

        token = _request_id.set(request_id)
        structlog.contextvars.bind_contextvars(request_id=request_id)

        # Whether the status line has gone out. Once it has, the response can no
        # longer be substituted — see the `except` below.
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                raw: object = message.get("headers")
                inbound: list[object] = (
                    cast(  # rules-allow(any-type): isinstance proves `list`, and `object` elements is true of every list that is only read from — so unlike the `list[tuple[bytes, bytes]]` this replaces, it claims nothing beyond the check
                        "list[object]",
                        raw,
                    )
                    if isinstance(raw, list)
                    else []
                )
                # Filtered to the shape the ASGI spec requires — two elements,
                # both `bytes` — before any of it is compared. This is not
                # defensive tidying: the dedupe below compares `key.lower()` to a
                # `bytes` literal, so a downstream app emitting a `str` header
                # name produced a comparison that is always unequal, the inbound
                # `X-Request-ID` survived, and the append below made it two.
                # A non-conforming entry is dropped rather than coerced; guessing
                # an encoding for a header this layer does not own would be a
                # second unverified assertion in place of the one just removed.
                existing_headers: list[tuple[bytes, bytes]] = []
                for entry in inbound:
                    # A sequence pattern is the check, and it is a real one: two
                    # elements, both `bytes`. Nothing narrowed here is asserted.
                    match entry:
                        case (bytes() as header_name, bytes() as header_value):
                            existing_headers.append((header_name, header_value))
                        case _:
                            continue
                # Replace, never append: this wrapper is the single writer of
                # the header, and appending emitted it twice when a downstream
                # response had already set it.
                name = REQUEST_ID_HEADER.lower().encode("latin-1")
                headers: list[tuple[bytes, bytes]] = [
                    (key, value) for key, value in existing_headers if key.lower() != name
                ]
                headers.append(
                    (REQUEST_ID_HEADER.lower().encode("latin-1"), request_id.encode("latin-1"))
                )
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            # Caught HERE, not left to Starlette's ServerErrorMiddleware.
            #
            # That middleware is the outermost layer — outside this one and
            # outside CORS — so a response it produces carries neither the
            # correlation header appended above nor any CORS header, and it runs
            # after the `finally` below has already unbound the logging context.
            # Review measured all three missing on a production 500: the body had
            # an id, the header did not, and the error log was uncorrelated.
            #
            # Handling it inside this frame fixes all three at once: the context
            # is still bound, the send wrapper still appends the header, and CORS
            # is still upstream of us.
            # Logged first, and unconditionally: this frame is the last place
            # the correlation context is still bound, so a re-raise below still
            # leaves a correlated record behind.
            _log().exception("unhandled_exception")
            if self._on_unhandled is None or response_started:
                # Nothing can be substituted once the status line is on the
                # wire. Sending a second `http.response.start` raises an ASGI
                # protocol error that *replaces* the real failure — the caller
                # gets a truncated body, the log gets the protocol error, and
                # the original exception is lost. Starlette's own
                # `ServerErrorMiddleware` guards the same way; this middleware
                # took over its job and has to take over its guard too.
                #
                # Re-raising lets the server abort the response, which is the
                # only honest outcome for a stream that failed halfway.
                raise
            response = self._on_unhandled(request_id, exc)
            await response(scope, receive, send_with_request_id)
        finally:
            structlog.contextvars.unbind_contextvars("request_id")
            _request_id.reset(token)


def _log() -> FilteringBoundLogger:
    """Acquired at call time; a module-level proxy would pin the first
    configuration structlog ever saw."""
    return structlog.get_logger(__name__)


RequestHandler = Callable[[Request], Awaitable[Response]]

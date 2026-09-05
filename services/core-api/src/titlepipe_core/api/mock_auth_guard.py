"""🔴 MACHINE 4 OF 4 — a request carrying `x-mock-role` is REFUSED, not ignored,
wherever the mock adapter does not exist.

`auth/seam.py` names the whole chain; this is the last link and the only one
that acts on the REQUEST rather than on the seat. Machines 1-3 mean a non-mock
configuration has no adapter that has ever heard of the header, so it could
simply be ignored — the request would be anonymous and `require_seat` would
refuse it. This middleware exists because "ignored" is the wrong failure.

A client still sending the header believes it is authenticated. Ignoring it
turns that into an anonymous request that fails somewhere downstream — a 401 on
one route, an empty list on another, a 403 on a third — and the client learns
nothing about WHY. Worse, a route that does not take `require_seat` answers 200,
so on that route the header appears to work. Refusing at the front door says the
thing that is true: this service does not accept that credential.

## What makes it structural rather than a check somebody can drop

It is added by `create_app` UNCONDITIONALLY. There is no configuration in which
this middleware is absent — only its verdict changes — so there is no branch to
delete and no route that can be added outside it. It runs BEFORE routing, so
"cannot reach a handler" is a fact about the ASGI stack rather than about what
each handler remembers to do.

Its position in the stack is deliberate and is set in `app.py`: inside
`RequestContextMiddleware`, so the refusal carries a correlation id and is
greppable against the log line, and inside `CORSMiddleware`, so a browser sees
the 401 as a 401 rather than as a CORS failure.

## Why the header name is imported and not spelled here

`auth/mock.py` owns `MOCK_ROLE_HEADER`. Two spellings of one header name is how
a guard stops guarding: rename the constant to add a vendor prefix and this file
keeps refusing a header nothing sends any more, silently.
"""

from __future__ import annotations

from typing import Final

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from titlepipe_core.api.errors import envelope
from titlepipe_core.auth.mock import MOCK_ROLE_HEADER
from titlepipe_domain import UnauthenticatedError

__all__ = [
    "MOCK_AUTH_HEADERS",
    "MOCK_AUTH_REFUSED_MESSAGE",
    "MockAuthGuardMiddleware",
]

# Every header the mock adapter reads. One today. A frozenset rather than a bare
# constant so that an adapter growing a second header — a tenant selector, a
# subject override — is refused by this guard the moment it is added to the set,
# instead of being refused by nothing because the guard knew about one name.
MOCK_AUTH_HEADERS: Final = frozenset({MOCK_ROLE_HEADER})

# Client-safe and deliberately specific. `dependencies.require_seat` answers
# every failed authentication with the same opaque "Not signed in." because
# distinguishing its three cases would confirm an account; this one distinguishes
# nothing about a person. It says what the SERVICE does not accept, which is a
# fact about the deployment the caller is entitled to and cannot probe for.
MOCK_AUTH_REFUSED_MESSAGE: Final = (
    "This service does not accept mock authentication headers. "
    "Sign in through the configured identity provider."
)

# 401 and not 400. The request is well-formed; what is wrong is the credential
# it presented, and 401 is the status a client retries with a real one. It is
# also `UnauthenticatedError`'s registered status in `api/errors.py`, and the
# two must not drift — a guard answering 400 where the dependency answers 401
# would make "am I signed in?" depend on which layer refused.
_STATUS: Final = 401


class MockAuthGuardMiddleware:
    """Refuses any request bearing a mock-auth header, unless mock auth is on.

    Pure ASGI rather than `BaseHTTPMiddleware`, matching
    `api/request_context.py`: that class runs the downstream app in a separate
    task, and this one sits between the request-context middleware and the
    router, where a task hop would break the contextvar `envelope` reads the
    correlation id from.
    """

    def __init__(self, app: ASGIApp, *, mock_auth_enabled: bool) -> None:
        self.app = app
        # The VERDICT is configured; the middleware's presence is not. Read once
        # at construction because `create_app` has already validated settings —
        # re-reading per request would only add a way for the two to disagree.
        self._mock_auth_enabled = mock_auth_enabled

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self._mock_auth_enabled:
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        # Starlette's `Headers` is case-insensitive, so `X-Mock-Role` and
        # `x-mock-role` are the same lookup. That is the wire's rule and not a
        # convenience: a guard that missed the capitalised spelling would be a
        # guard an attacker walks past by holding the shift key.
        if not any(header in request.headers for header in MOCK_AUTH_HEADERS):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            status_code=_STATUS,
            content=envelope(
                code=UnauthenticatedError.code,
                message=MOCK_AUTH_REFUSED_MESSAGE,
                request=request,
            ),
        )
        await response(scope, receive, send)

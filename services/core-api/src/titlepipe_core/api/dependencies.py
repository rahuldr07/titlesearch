"""What a handler is given, and the one attribute it is allowed to reach for.

`CONVENTIONS.md` §10 leaves the handler layer four jobs — parse, authorise, map
errors to status codes, and render what a service returns. Reaching into
`app.state` for the sessionmaker is none of those, but somebody has to: the
sessionmaker is built once at startup by the lifespan and a service is
constructed per request. This module is that seam, and it is in `api/` because
`Request` is.

## Why it is `Depends` and not two lines in every route

`get_resources(request.app).sessionmaker` is short enough that seventy copies of
it look harmless. They are not the same as one: the day the attribute moves, or
the day a route needs the read replica, seventy routes are the change — and the
sixty-ninth is where somebody writes `make_sessionmaker(...)` in a handler
instead, which opens a pool per request and holds a credential the lifespan
never releases. `db/reads.py` lists that as one of the four things the shared
read exists to stop.

## `None` is passed through rather than refused here

An absent sessionmaker means the service was started with no `app_database_url`.
It would be easy to raise from this dependency and be done. It is wrong: the
sentence a caller reads about an unavailable dependency is the ROUTE'S decision
(`db/reads.py` says why it takes `unavailable_message` as a parameter), and a
dependency that raised would answer for a resource before anybody said which
resource was being asked for. `scoped_read` makes that call with the resource
name in hand, and logs `<resource>_read_unconfigured` rather than a generic line.

## …and `principal_tenant` DOES refuse, which is not an inconsistency

The two absences are different kinds of fact and the difference is the whole
reason both live in this module rather than one of them being copied into a
route.

An absent SESSIONMAKER is an OPERATIONAL fact about this deployment, and what a
caller should read about it depends on WHICH resource they asked for — "the
rulebook is unavailable" and "the work queue is unavailable" are different
sentences, `db/reads.py` says so, and a dependency has no way to pick.

An absent PRINCIPAL is an AUTHENTICATION fact, and it is the SAME sentence for
every resource in the service: there is no session. Nothing downstream can add
anything to it, because nothing downstream knows more about the caller than that
they are nobody. `CONVENTIONS.md` §10 gives the handler layer four jobs and
AUTHORISE is one of them, so refusing here is that layer doing its own work
rather than reaching into somebody else's.

## What `principal_tenant` will be, and why it is not a stand-in now

`api/routers/rules.py` is emphatic that nothing in it anticipates the auth that
lands in Plan 03 — no role header, no `if settings.mock_auth_enabled`, no
dependency returning a stand-in user — because
`packages/mocks/src/handlers.ts:405` is what that ends as: a missing header
defaulting to an admin, in a file everybody trusted. **The function below is not
a counter-example to that; it is the same rule stated for a route that needs a
tenant.** It returns no stand-in, reads no header and consults no setting. It
raises, unconditionally, and every caller of every tenant-scoped route gets a
401 until a real session exists.

That is a TRUE answer today rather than a placeholder: there is no session
mechanism in this service, so no caller has a valid session, and
`UnauthenticatedError`'s own docstring in `libs/domain/errors.py` says exactly
that. It is not a 501, which would be more precise about the cause — `libs/domain`
has no error class for "not implemented" and adding one is that package's change,
not this branch's.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.requests import Request

from titlepipe_core.lifespan import get_resources
from titlepipe_domain import TenantId, UnauthenticatedError


def session_factory(request: Request) -> async_sessionmaker[AsyncSession] | None:
    """The sessionmaker the lifespan opened, or `None` if it opened none."""
    return get_resources(request.app).sessionmaker


SessionFactory = Annotated[async_sessionmaker[AsyncSession] | None, Depends(session_factory)]
"""The annotation a handler writes. One name, so the wiring is one word wide."""


# Client-safe by contract, like every `DomainError` message. It says the thing a
# caller most needs to know and that a bare "unauthenticated" does not: NO
# CREDENTIAL WILL SATISFY THIS. A 401 conventionally invites the caller to
# authenticate and retry, and there is nothing to authenticate against — an
# integrator who reads only the status will otherwise spend a day building
# headers for a mechanism that does not exist.
_NO_SESSION_MECHANISM = (
    "This service has no session mechanism yet, so no request can name a tenant. "
    "No credential will satisfy this; the endpoint starts answering when "
    "authentication lands."
)


def principal_tenant() -> TenantId:
    """The tenant every scoped read runs under. **Raises, today, always.**

    Takes no `Request` on purpose. A signature carrying one would suggest there
    is something on the request to read, and there is not — no header, no cookie,
    no setting. The absence is the point, and it is visible in the signature.

    THIS IS THE ONE LINE THAT CHANGES WHEN AUTHENTICATION LANDS, and everything
    below it is already built: `services/queue_service.py` takes the tenant as a
    required parameter, `db/reads.py` puts it on the session, `0002`'s policies
    read it. Nothing else in the stack moves.

    IT IS NOT THE ONLY THING BETWEEN THIS SERVICE AND A WORKING QUEUE. The other
    half is `api/mappers/queue.py`, which cannot render an order because twelve
    of the thirteen contract fields have no column. Un-refusing here without that
    migration turns a 401 into a 500. Both are named in
    `tests/test_queue_endpoint.py::test_the_handover_refuses_until_a_principal_and_an_assignment_column_exist`,
    which is the machine that makes them a pair rather than a pair of notes.
    """
    raise UnauthenticatedError(_NO_SESSION_MECHANISM)


PrincipalTenant = Annotated[TenantId, Depends(principal_tenant)]
"""The annotation a tenant-scoped handler writes, beside `SessionFactory`.

Two names, so the wiring of a scoped route is two words wide — and so that the
day the refusal above becomes a real session, no route's signature changes.
"""

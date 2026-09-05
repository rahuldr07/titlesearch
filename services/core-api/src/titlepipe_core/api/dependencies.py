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
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.requests import Request

from titlepipe_core.lifespan import get_resources


def session_factory(request: Request) -> async_sessionmaker[AsyncSession] | None:
    """The sessionmaker the lifespan opened, or `None` if it opened none."""
    return get_resources(request.app).sessionmaker


SessionFactory = Annotated[async_sessionmaker[AsyncSession] | None, Depends(session_factory)]
"""The annotation a handler writes. One name, so the wiring is one word wide."""

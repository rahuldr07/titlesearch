"""`scoped_read` — the one place a use case opens a scoped session and decides
what a database failure means.

THIS WAS `api/reads.py` AND MOVED HERE ON 2026-09-05, WITH ITS FIRST
ARGUMENT CHANGED FROM A `Request` TO A SESSIONMAKER. CONVENTIONS.md §10 puts the
use case in `services/` and forbids that layer `fastapi`, and a service cannot
call a function that wants a `Request` — so the question was not where the file
should sit but what the `Request` was ever for. It was for one attribute:
`get_resources(request.app).sessionmaker`. That is application wiring, and the
handler layer already has a name for it (`api/dependencies.py`).

What is left after taking it out is a function that opens a tenant-scoped
session and translates driver failures. Both halves are database concerns:

* it is not `services/`, which owns use cases and would then own SQLAlchemy's
  exception taxonomy, and putting it in ONE service's module would make the next
  service import a sibling service to read a row;
* it is not `db/repositories/`, which is for repositories — this holds no table,
  issues no statement and is the thing a repository is HANDED a session by;
* it is `db/`, beside `session.py` and `engine.py`, which are the other two
  halves of the same seam. `engine.py` owns the connection's lifetime,
  `session.py` owns the scope, and this owns one read inside it.

Every block below was INLINE IN `api/routers/rules.py`, the one product route
that existed when it was written. PLAN.md §8 rules that the `GET /api/rules` machinery generalises to
the other sixty-nine endpoints, and a block copied sixty-nine times is
sixty-nine chances to get one of these four things wrong:

* narrow the `except` to `OperationalError`, so a `ProgrammingError` — a
  permission denial naming a table — reaches the 500 handler with no
  `*_read_failed` log line beside it naming anything;
* widen it over the serialisation call, so a response that will be identically
  wrong on every attempt is answered 503 and retried;
* drop the `retryable=` field from the log line, which is the only thing that
  makes an outage and a defect greppable apart;
* build a sessionmaker in the route, which opens a pool per request and holds a
  credential the lifespan never releases.

The CALLER keeps the two decisions that are its own: which tenant it runs under,
and what sentence a caller reads. Since 2026-09-05 that caller is a service and
not a route — both are domain answers and neither changes if the transport does.
Everything else is here.

## The serialisation call is deliberately NOT inside this function

`read` returns ROWS. Mapping rows onto the wire happens in the route, after this
returns, and that separation is the design rather than tidiness. A
`ValidationError` out of a mapper means a label reached the boundary that
the contract does not have: that is a defect in this service and it must reach
`handle_unexpected` as a 500, not be dressed as a downstream outage. Accepting a
`Callable` that both read AND serialised would put the whole path under one
`except` and lose the distinction — which is exactly what `api/routers/rules.py`
took a paragraph to avoid.

## `tenant` is a parameter with no default, and that is the seam

`TenantId` is a `NewType` over `UUID` and is erased at runtime, so this
annotation buys nothing at the boundary and everything at the CALL SITE: an
`order_id` and a `tenant_id` are both `UUID` and are indistinguishable to a
reader, and this is the one argument where mixing them silently reads another
tenant's rows under this tenant's GUC. `libs/domain/tenancy.py` records the same
reasoning for `tenant_guc_value`, which is the function on the other end of it.

`None` is legal and ordinary — it is what a GLOBAL table's read passes, and
`db/session.py` records what it means: the GUC is set to the empty string,
`0002`'s policies `nullif` that into NULL, and every tenant-keyed table returns
nothing. The session is at the DENY floor. What there is no spelling for here is
"unscoped": `tenant_session` is the only thing in this tree that moves the
connection-level default, so a read that wanted to skip it would have to not call
this function at all — and `scripts/check_backend_rules.py`'s `layer-router-db`
rule is what notices a router reaching for one, since a router that wanted its
own session would have to import this package to get there.

Giving `tenant` a default of `None` would make the global case the one you get by
forgetting, on a surface where sixty-nine of seventy reads are tenant-scoped.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from structlog.typing import FilteringBoundLogger

from titlepipe_core.db.session import tenant_session
from titlepipe_domain import DependencyUnavailableError, TenantId
from titlepipe_service_kit.telemetry.logging import get_logger

# The database failures a retry can fix. Moved here verbatim from
# `api/routers/rules.py`, where it was written, and its reasoning is unchanged:
#
# An ALLOWLIST, not a denylist, and the direction matters. A new SQLAlchemy error
# class this tree has never heard of is more likely to be a defect than an
# outage, and the failure mode of guessing wrong in this direction is a 500 in a
# log an operator reads — where guessing wrong in the other is a caller retrying
# forever against a permanent fault, which is the defect this list exists to
# close.
#
# `SQLAlchemyTimeoutError` is SQLAlchemy's, NOT the builtin: it is what
# `QueuePool` raises when no connection becomes free inside `pool_timeout`, which
# is load shedding and is exactly retryable. It is imported under an alias
# because the unaliased name shadows the builtin that `lifespan.probe_database`
# catches from `asyncio.timeout`, and two different `TimeoutError`s in one
# package is how somebody eventually catches the wrong one.
RETRYABLE_DATABASE_ERRORS: tuple[type[SQLAlchemyError], ...] = (
    OperationalError,
    InterfaceError,
    SQLAlchemyTimeoutError,
)


def _log() -> FilteringBoundLogger:
    """Acquired at call time, never bound at import — the same rule `errors.py`,
    `lifespan.py` and `routers/rules.py` state, and for the same reason: a
    module-level logger pins whatever logging configuration was active first, and
    two apps in one process must each log under their own settings."""
    return get_logger(__name__)


async def scoped_read[T](
    sessionmaker: async_sessionmaker[AsyncSession] | None,
    *,
    resource: str,
    unavailable_message: str,
    tenant: TenantId | None,
    read: Callable[[AsyncSession], Awaitable[T]],
) -> T:
    """Run one read under a tenant-scoped session, classifying what goes wrong.

    `resource` names the thing being read and is the STEM of both log events —
    `f"{resource}_read_unconfigured"` and `f"{resource}_read_failed"`. It is a
    short noun, not a sentence and not a URL: `"rulebook"` produces exactly the
    two event names `api/routers/rules.py` emitted before this function existed,
    which is why `tests/test_rules_endpoint.py` and `tests/test_errors.py` still
    grep for them unchanged.

    `unavailable_message` is the caller's half of the story and is client-safe by
    contract, like every `DomainError` message — it names no host, no role and no
    DSN. The operator's half is the log line beside it. Each route writes its own
    because "the rulebook is unavailable" and "your orders are unavailable" are
    different sentences to the person reading the screen, and a shared one would
    be wrong for all but the first caller.

    An ABSENT sessionmaker means no `app_database_url` was configured, and it is
    answered with the same failure as a database that will not talk. The two are
    different to an OPERATOR and identical to a CALLER: in both cases the read
    cannot happen now and a retry is the reasonable next move. The two log events
    are what distinguish them, which is where the difference belongs.

    Rows come back READABLE AFTER THE SESSION CLOSES because `make_sessionmaker`
    sets `expire_on_commit=False`; `tests/test_tenant_session.py` pins that and it
    is not re-proved here.
    """
    if sessionmaker is None:
        _log().error(f"{resource}_read_unconfigured")
        raise DependencyUnavailableError(unavailable_message)

    try:
        async with tenant_session(sessionmaker, tenant) as session:
            return await read(session)
    except SQLAlchemyError as error:
        retryable = isinstance(error, RETRYABLE_DATABASE_ERRORS)
        # Logged for BOTH outcomes, and the `retryable` field is what makes the
        # two greppable apart. It is also what a narrowed `except` loses: an
        # `except OperationalError` would let a `ProgrammingError` past this line
        # entirely, so the permission denial that reaches the 500 would arrive
        # with no `*_read_failed` beside it naming the table.
        _log().error(
            f"{resource}_read_failed", error_name=type(error).__name__, retryable=retryable
        )
        if not retryable:
            # NOT converted. A permanent fault must not be answered with a status
            # that invites a retry — `handle_unexpected` renders the 500 and puts
            # the traceback in the log under this request id.
            raise
        raise DependencyUnavailableError(unavailable_message) from error

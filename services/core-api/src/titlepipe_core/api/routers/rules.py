"""`GET /api/rules` — the rulebook, whole, and the first product route this
service serves.

It is first because it is the one read in the system that needs no principal.
The rulebook is GLOBAL: `migrations/versions/0003_rules.py` states the ruling and
`db/rules.py` carries its consequences, and a table with no `tenant_id` and no
policy is a table whose contents do not depend on who is asking. So this endpoint
can be built, proved and pointed at a browser before identity exists at all,
which is the whole reason the vertical slice starts here.

## No auth, and no placeholder for the auth that is coming

WorkOS lands in Plan 03 and NOTHING here anticipates it. There is no principal,
no role header, no `if settings.mock_auth_enabled` branch and no dependency that
returns a stand-in user. `packages/mocks/src/handlers.ts:405` is what that ends
as: a missing header defaulting to an admin, in a file everybody trusted. The
absence here is not an omission to be filled in later by whoever notices — it is
the property that makes this route correct today, and Plan 03 replaces it with a
real session rather than with the flag somebody left ready.

## The tenant is `None`, deliberately, and it is not "no scoping"

`tenant_session(sessionmaker, None)` is the call. `None` does not mean the
session runs unscoped; `db/session.py` records what it means — the GUC is set to
the empty string, `0002`'s policies `nullif` that into NULL, and every
tenant-keyed table returns nothing. The session is at the DENY floor and reads
the one table that floor does not cover. Passing a tenant here would be
inventing a principal to satisfy a parameter, which is the thing the section
above is about.

## Failure

`HTTPException` IS BANNED IN THIS FILE and everywhere else under `src/` except
`api/errors.py` — `scripts/check_backend_rules.py` rule 4. What is raised is a
`DomainError`, which `api/errors.py` maps to a status through `status_for` and
renders through `envelope`, so the caller gets the same
`{"error": {code, message, request_id, details}}` shape as every other failure
in this service and can branch on a `code` that does not move when the wording
does.

### Retryable and permanent are different answers, and the split is `_RETRYABLE`

`DependencyUnavailableError` means what it says in `libs/domain/errors.py`: a
downstream is unavailable **and the call is retryable**. A server that is down,
a connection that dropped, a pool with nothing left — `OperationalError`,
`InterfaceError`, SQLAlchemy's own `TimeoutError` — are all that, and answering
503 with "try again shortly" is true.

🔴 A `ProgrammingError` IS NOT, AND EVERY `SQLAlchemyError` USED TO GET THE SAME
ANSWER. A missing `GRANT SELECT ON rules`, or a database nobody ran
`alembic upgrade head` against, is PERMANENT: the reviewer booted core-api
against an un-migrated database and got `/ready` 200 with `database_answers:
true` — `SELECT 1` reads no table — and `/api/rules` 503-retryable forever. The
caller retries a request that cannot succeed until a human changes something,
and 503 is the status that tells them to.

So the permanent case is NOT converted. It propagates, `api/errors.py`'s
`handle_unexpected` renders a 500 with `INTERNAL_ERROR`, the traceback goes to
the log bound to the same request id, and nothing invites a retry — which is the
honest answer for a fault in this service's own configuration. This is exactly
the argument the next paragraph already made about `from_rows` and that the
`except` three lines above it did not apply to itself.

`rulebook_read_failed` is logged for BOTH, carrying the class name and whether it
was treated as retryable, because the operator's question is the same either way
and the answer must be greppable.

The catch does not extend over `RulesResponse.from_rows`. That separation is the
design rather than tidiness: a `ValidationError` out of `from_rows` means a label
reached the wire that the contract does not have — `api/schemas/rules.py`
explains why that is caught at the boundary — and it is a defect in this service,
not an outage in a downstream. Widening the `except` to cover it would answer 503
and invite a retry for a response that will be identically wrong on every
attempt.

## No query parameters, no pagination, no filtering

RULED: every status, unfiltered, in the repository's order. `db/rules.py::list_all`
carries the reason — a `pending` rule is VISIBLE to everyone and only its EFFECT
is gated — and the two live consumers
(`apps/web/src/shared/accountQueries.ts`'s `rules` descriptor, rendered by
`features/account/RulesPanel.tsx`, and `features/escalations/useEscalations.ts`)
take the whole set. The ordering is
`list_all`'s and is a wire-stability decision; nothing here re-sorts, for the
same reason `RulesResponse.from_rows` does not.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from structlog.typing import FilteringBoundLogger

from titlepipe_core.api.schemas.rules import RulesResponse
from titlepipe_core.db import RuleRepository, tenant_session
from titlepipe_core.lifespan import get_resources
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import DependencyUnavailableError

# `/api` here rather than on each route, and `/health` and `/ready` are NOT under
# it — `api/routers/health.py` records why: they are platform surface, this is
# product surface, and a platform probe that moved under `/api` would start being
# matched by whatever authenticates that prefix in Plan 03.
router = APIRouter(prefix="/api", tags=["rules"])

# Client-safe by contract, like every `DomainError` message — see
# `libs/domain/errors.py`. It names no host, no role and no DSN: the operator's
# half of the story is the log line beside it, and the caller's half is a code
# they can retry on.
_UNAVAILABLE_MESSAGE = "The rulebook is temporarily unavailable. Try again shortly."

# The database failures a retry can fix. Everything else `SQLAlchemyError` covers
# is a fault in this service's own configuration and propagates to a 500 — see
# the "Retryable and permanent" section above.
#
# An ALLOWLIST, not a denylist, and the direction matters. A new SQLAlchemy error
# class this file has never heard of is more likely to be a defect than an
# outage, and the failure mode of guessing wrong in this direction is a 500 in a
# log an operator reads — where guessing wrong in the other is a caller retrying
# forever against a permanent fault, which is the defect this list exists to
# close.
#
# `SQLAlchemyTimeoutError` is SQLAlchemy's, NOT the builtin: it is what
# `QueuePool` raises when no connection becomes free inside `pool_timeout`,
# which is load shedding and is exactly retryable. It is imported under an alias
# because the unaliased name shadows the builtin that `lifespan.probe_database`
# catches from `asyncio.timeout`, and two different `TimeoutError`s in one
# package is how somebody eventually catches the wrong one.
_RETRYABLE: tuple[type[SQLAlchemyError], ...] = (
    OperationalError,
    InterfaceError,
    SQLAlchemyTimeoutError,
)


def _log() -> FilteringBoundLogger:
    """Acquired at call time, never bound at import — the same rule `errors.py`
    and `lifespan.py` state, and for the same reason: a module-level logger pins
    whatever logging configuration was active first, and two apps in one process
    must each log under their own settings."""
    return get_logger(__name__)


@router.get("/rules", response_model=RulesResponse, summary="The whole rulebook")
async def list_rules(request: Request) -> RulesResponse:
    """Every rule, every status, in `RuleRepository.list_all`'s order.

    The sessionmaker comes off the app's resources rather than being built here.
    A route that built its own engine would open a pool per request and would
    hold a credential the lifespan never released — `lifespan.py`'s opening is
    about precisely that.

    An absent sessionmaker means no `app_database_url` was configured, and it is
    answered with the same failure as a database that will not talk. The two are
    different to an OPERATOR and identical to a CALLER: in both cases the
    rulebook cannot be read now and a retry is the reasonable next move. The log
    lines below distinguish them, which is where the difference belongs.
    """
    resources = get_resources(request.app)
    sessionmaker = resources.sessionmaker
    if sessionmaker is None:
        _log().error("rulebook_read_unconfigured")
        raise DependencyUnavailableError(_UNAVAILABLE_MESSAGE)

    try:
        async with tenant_session(sessionmaker, None) as session:
            rows = await RuleRepository(session).list_all()
    except SQLAlchemyError as error:
        retryable = isinstance(error, _RETRYABLE)
        # Logged for BOTH outcomes, and the `retryable` field is what makes the
        # two greppable apart. It is also what a narrowed `except` loses: an
        # `except OperationalError` would let a `ProgrammingError` past this
        # line entirely, so the permission denial that reaches the 500 would
        # arrive with no `rulebook_read_failed` beside it naming the table.
        _log().error("rulebook_read_failed", error_name=type(error).__name__, retryable=retryable)
        if not retryable:
            # NOT converted. A permanent fault must not be answered with a
            # status that invites a retry — `handle_unexpected` renders the 500
            # and puts the traceback in the log under this request id.
            raise
        raise DependencyUnavailableError(_UNAVAILABLE_MESSAGE) from error

    # Outside the `except`, and outside the session block. `make_sessionmaker`
    # sets `expire_on_commit=False`, so the rows stay readable after
    # `tenant_session` commits and closes; `tests/test_tenant_session.py` pins
    # that and it is not re-proved here.
    return RulesResponse.from_rows(rows)

"""`GET /api/rules` — the rulebook, whole, and the first product route this
service serves.

It is first because it is the one read in the system that needs no principal.
The rulebook is GLOBAL: `migrations/versions/0003_rules.py` states the ruling and
`db/repositories/rules.py` carries its consequences, and a table with no `tenant_id` and no
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
`DomainError`, which `api/error_envelope.py` maps to a status through
`status_for` and renders through `envelope`, so the caller gets the same
`{"error": ..., "code": ..., "request_id": ..., "details": {}}` shape as every
other failure in this service and can branch on a `code` that does not move when
the wording does. `error` IS THE SENTENCE AND IS NOT AN OBJECT — the browser
keeps it only if it is a non-empty string, and that module carries the
measurement.

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
the argument the next paragraph already made about the mapper and that the
`except` three lines above it did not apply to itself.

`rulebook_read_failed` is logged for BOTH, carrying the class name and whether it
was treated as retryable, because the operator's question is the same either way
and the answer must be greppable.

The catch does not extend over `render_rules`. That separation is the
design rather than tidiness: a `ValidationError` out of the mapper means a label
reached the wire that the contract does not have — `api/schemas/rules.py`
explains why that is caught at the boundary — and it is a defect in this service,
not an outage in a downstream. Widening the `except` to cover it would answer 503
and invite a retry for a response that will be identically wrong on every
attempt.

## No query parameters, no pagination, no filtering

RULED: every status, unfiltered, in the repository's order. `db/repositories/rules.py::list_all`
carries the reason — a `pending` rule is VISIBLE to everyone and only its EFFECT
is gated — and the two live consumers
(`apps/web/src/shared/accountQueries.ts`'s `rules` descriptor, rendered by
`features/account/RulesPanel.tsx`, and `features/escalations/useEscalations.ts`)
take the whole set. The ordering is
`list_all`'s and is a wire-stability decision; nothing here re-sorts, for the
same reason `render_rules` does not.
"""

from __future__ import annotations

from fastapi import APIRouter

from titlepipe_core.api.dependencies import SessionFactory
from titlepipe_core.api.mappers.rules import render_rule_history, render_rules
from titlepipe_core.api.schemas.rules import RuleHistoryResponse, RulesResponse
from titlepipe_core.services.rule_service import RuleService

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


@router.get("/rules", response_model=RulesResponse, summary="The whole rulebook")
async def list_rules(session_factory: SessionFactory) -> RulesResponse:
    """Every rule, every status, in the order the service returns them.

    Two statements, and neither of them is a decision. Which rules, in what
    order, under which tenant, and what a caller reads when the database is not
    there are all `RuleService.list_rules`'s; how a row becomes the wire is
    `api/mappers/rules.py`'s. What is left here is the route.

    **THE MAPPER CALL IS OUTSIDE THE SERVICE AND THAT IS THE DESIGN.** A
    `ValidationError` raised by `render_rules` means a label reached the boundary
    that `packages/contract` does not have — a defect in this service, which
    `handle_unexpected` renders as a 500. Rendering inside the service would put
    it under `scoped_read`'s `except SQLAlchemyError`: that clause does not catch
    a `ValidationError` today and would dress a defect as a downstream outage the
    moment anyone widened it. `db/reads.py` argues the same separation from the
    other end.
    """
    return render_rules(await RuleService(session_factory).list_rules())


@router.get(
    "/rules/{code}",
    response_model=RuleHistoryResponse,
    summary="Every version carried under one rule code",
)
async def rule_history(session_factory: SessionFactory, code: str) -> RuleHistoryResponse:
    """One code's versions, oldest first, every status.

    `code` reaches the mapper from the PATH and not from a row, which is the one
    thing this route decides that the service does not: the echoed member is an
    answer to what was asked. `api/mappers/rules.py` says why that matters even
    though the two are provably equal on every response this service can serve.

    The 404 for a code the rulebook has never carried is
    `RuleService.rule_history`'s ruling and is argued there — whether an empty
    result is a missing resource or an empty collection is a question about the
    domain, not about HTTP, and the only thing this layer contributes is that
    `api/errors.py` renders the refusal as one.
    """
    rows = await RuleService(session_factory).rule_history(code)
    return render_rule_history(code, rows)

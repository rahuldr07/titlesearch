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

from titlepipe_core.api.reads import scoped_read
from titlepipe_core.api.schemas.rules import RuleHistoryResponse, RulesResponse
from titlepipe_core.db import RuleRepository
from titlepipe_domain import NotFoundError

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
async def list_rules(request: Request) -> RulesResponse:
    """Every rule, every status, in `RuleRepository.list_all`'s order.

    `tenant=None` is passed EXPLICITLY and is not a default. `api/reads.py`
    records why the parameter has none: `None` here means the session runs at the
    DENY floor and reads the one table that floor does not cover, and it is the
    right argument for a global table — but it is the wrong argument for the
    sixty-nine tenant-scoped reads that follow this one, so it is not the value
    anybody gets by forgetting.

    **`RulesResponse.from_rows` IS OUTSIDE `scoped_read` AND THAT IS THE DESIGN.**
    A `ValidationError` raised here means a label reached the boundary that
    `packages/contract` does not have — a defect in this service, which
    `handle_unexpected` renders as a 500. Moving the call inside `read` would put
    it under that function's `except SQLAlchemyError`, which does not catch a
    `ValidationError` today, and would become wrong the moment anyone widened it.
    `api/schemas/rules.py` explains why the boundary catch belongs where it is.
    """
    rows = await scoped_read(
        request,
        resource="rulebook",
        unavailable_message=_UNAVAILABLE_MESSAGE,
        tenant=None,
        read=lambda session: RuleRepository(session).list_all(),
    )
    return RulesResponse.from_rows(rows)


@router.get(
    "/rules/{code}",
    response_model=RuleHistoryResponse,
    summary="Every version carried under one rule code",
)
async def rule_history(request: Request, code: str) -> RuleHistoryResponse:
    """One code's versions, oldest first, every status.

    **THE 404 IS DECIDED HERE AND NOWHERE BELOW.** `RuleRepository.history_for`
    returns an empty sequence for a code it does not know and refuses to call that
    an error, because whether "no rows" is a missing RESOURCE or an empty
    COLLECTION is a question about the URL, and `db/` cannot see one. The answer
    for this URL is that it is missing: `/api/rules/{code}` names one rule, and a
    code the rulebook has never carried is not a rule with no versions. Serving
    `{"code": "R99", "versions": []}` with a 200 would tell a caller checking
    whether a rule exists that it does, and there is no other read that would
    correct them.

    Contrast `GET /api/rules`, which serves `{"rules": []}` with a 200 for an
    empty rulebook and is right to: that URL names the collection itself, which
    exists and happens to be empty.

    `NotFoundError` and not `HTTPException` — banned in this file by
    `scripts/check_backend_rules.py` rule 4 — so the refusal renders through the
    one envelope with a `NOT_FOUND` code the caller can branch on. The message
    names the code that was asked for and nothing else: it is client-safe by
    contract, and the code is already in the caller's own URL.

    **THE RAISE IS OUTSIDE `scoped_read`, LIKE `from_rows` ABOVE.** A 404 is an
    answer about the data, not a database failure, and putting it inside `read`
    would run it under that function's `except SQLAlchemyError` — which does not
    catch a `DomainError` today and would swallow this refusal into a 503 the
    first time anyone widened it. The empty check needs the rows and nothing else,
    so it costs nothing to do it after the session has closed.

    `tenant=None` for `list_rules`'s reason: the rulebook is global, and the
    session sits at the DENY floor reading the one table that floor does not
    cover.
    """
    rows = await scoped_read(
        request,
        resource="rulebook",
        unavailable_message=_UNAVAILABLE_MESSAGE,
        tenant=None,
        read=lambda session: RuleRepository(session).history_for(code),
    )
    if not rows:
        raise NotFoundError(f"No rule is carried under the code {code!r}.")
    return RuleHistoryResponse.from_rows(code, rows)

"""The queue's use case: hand one order to one reviewer.

The second service, and the first over a TENANT resource. `RuleService` reads the
one table outside tenancy and passes `tenant=None` explicitly; everything here
that differs from it, differs because of that.

## The tenant is a PARAMETER, and it has no default

`RuleService.list_rules` passes `tenant=None` and its docstring says why the
parameter has no default: `None` is right for a global table and wrong for the
sixty-nine tenant-scoped reads that follow, so it must not be the value anybody
gets by forgetting. This is the first of those sixty-nine, and the same argument
lands one layer up — `next_order` REQUIRES a tenant, from its caller, positional
and unavoidable.

**IT IS NOT READ FROM A CONTEXTVAR, AND THAT IS DELIBERATE.** A request-scoped
ambient tenant is the ergonomic version of this and it is the version in which
"which tenant did that read run under" is answered by whatever happened to be set
— including, on the day a background worker calls the same use case, nothing at
all. `db/session.py` records what an unscoped session does: it sits at the deny
sentinel and reads zero rows, which looks exactly like an empty queue. A
parameter cannot be absent by accident.

## What this layer rules on, and what it refuses to

RULES: that an empty queue is a SUCCESSFUL hand-over of nothing rather than a
missing resource. `next_order` returns `None` and `api/errors.py` never sees a
refusal — the caller gets a 200 and `{"order": null}`.

That is the OPPOSITE of `RuleService.rule_history`, which raises `NotFoundError`
for a code the rulebook has never carried, and the two are consistent because the
URLs are different kinds of thing. `/api/rules/{code}` NAMES A RESOURCE, so
nothing under that name is a missing resource; `/api/queue/next` NAMES AN
OPERATION that always exists, and its answer today is that there is nothing to
hand over. Serving a 404 here would tell a reviewer whose queue is empty that the
hand-over itself is broken, and the frontend has no branch for that:
`endpoints.ts:74-78` declares `order: Order.nullable()`, which is the contract
saying `null` is an ORDINARY answer.

DOES NOT RULE: which order is next when the schema can express a choice.
`OrderQueueRepository` sorts by `created_at` because that is the only column
there is, and its docstring says so rather than calling FIFO a policy. When
`orders` grows a priority, a due date or a status, "which order should this
reviewer get" becomes a product question and it is decided HERE — in the layer
that owns business rules — rather than in an `ORDER BY` nobody reads.

## One transaction, and the refusal that is not in it

`scoped_read` opens exactly one scoped session and closes it before this method
returns. Rows stay readable afterwards because `make_sessionmaker` sets
`expire_on_commit=False`; `db/reads.py` records that.

There is no refusal here to keep outside it. `rule_history`'s 404 has to be
raised after the session closes, because `scoped_read`'s `except SQLAlchemyError`
would swallow a `DomainError` the moment anyone widened it — this method raises
nothing, so the hazard does not arise, and that is worth saying rather than
leaving as an absence a later editor fills in.

## `fastapi` is not imported here and no status code is named

`CONVENTIONS.md` §10, and `scripts/check_backend_rules.py`'s `layer-service-http`
rule is the machine. The one thing this module could plausibly want it for — the
401 the route answers today — is not this layer's, and `api/dependencies.py`
carries the argument for why the refusal is the HANDLER's.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from titlepipe_core.db.models import Order
from titlepipe_core.db.reads import scoped_read
from titlepipe_core.db.repositories.queue import OrderQueueRepository
from titlepipe_domain import TenantId

_RESOURCE = "queue"

# The caller's half of the story when the database is not there, and it is NOT
# the rulebook's sentence. `db/reads.py` records why each route writes its own:
# "the rulebook is temporarily unavailable" and this are different sentences to
# the person reading the screen, and a shared one would be wrong for all but the
# first caller. Client-safe by contract, like every `DomainError` message — it
# names no host, no role and no DSN.
_UNAVAILABLE_MESSAGE = "The work queue is temporarily unavailable. Try again shortly."


class QueueService:
    """The hand-over. One method, and it takes no choice from its caller.

    Constructed per request from the sessionmaker the lifespan opened. `None` is
    a legal argument and means the service was started with no database
    configured; it is not checked here, because `scoped_read` makes that call
    with the resource name in hand so the log line names what was being read —
    `api/dependencies.py` records why the dependency passes it through rather
    than refusing earlier.
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None) -> None:
        self._session_factory = session_factory

    async def next_order(self, tenant: TenantId) -> Order | None:
        """The one order this tenant's queue hands over next, or `None`.

        **`tenant` IS THE ONLY PARAMETER AND IT IS NOT A CHOICE.** It says WHOSE
        queue, never WHICH order. There is no filter, no cursor, no exclusion
        list and no preference, and the reason is `docs/INVARIANTS.md` #22: the
        reviewer does not choose their next order. The invariant is held by there
        being nothing to hold — `OrderQueueRepository.next_for_handover` takes no
        arguments either, so adding one would have to change two signatures in
        two layers.

        `None` IS A SUCCESS. See the module docstring for why an empty queue is a
        200 here and a 404 on `/api/rules/{code}`; the short of it is that this
        URL names an operation rather than a resource.

        RETURNS A MODEL, not a DTO. `CONVENTIONS.md` §10 puts the model-to-DTO
        step in `api/mappers/queue.py` and makes it the only place both are
        imported. It matters more here than it did for the rulebook: twelve of
        the thirteen fields `packages/contract` requires have no column, and a
        service that rendered its own response would be the layer deciding what
        to put in them.

        **THIS METHOD DOES NOT CLAIM THE ORDER.** It reads. Two callers reach the
        same row, and nothing here or below prevents that, because `orders` has
        no column to write an assignment into. No caller can observe it today —
        the route refuses before this runs, and
        `tests/test_queue_endpoint.py::test_the_handover_refuses_until_a_principal_and_an_assignment_column_exist`
        is the machine that keeps that true — but it is the property to check
        first on the day the refusal comes off, and it is written here rather
        than only in a report because this is the method that would be wrong.
        """
        return await scoped_read(
            self._session_factory,
            resource=_RESOURCE,
            unavailable_message=_UNAVAILABLE_MESSAGE,
            tenant=tenant,
            read=lambda session: OrderQueueRepository(session).next_for_handover(),
        )

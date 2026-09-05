"""`OrderQueueRepository` — the one statement the hand-over is made of.

The first repository over a TENANT table, and therefore the first one that
inherits `TenantRepository`. `RuleRepository` sits beside the base rather than
under it because `rules` carries no tenancy at all and `base.py` argues that at
length; `orders` is the ordinary case the base was written for, so this class is
what the base looks like when it is used as intended — a session that
`tenant_session` has scoped, a model bound at construction, and no method that
takes a tenant because there is nowhere for a caller to pass the wrong one.

## The whole selection policy is one `ORDER BY` and one `LIMIT`, and that is the design

`docs/INVARIANTS.md` #22 and PLAN.md §4: the caller does not choose their next
order. That is not enforced by a check somewhere above — there is no parameter
to check. `next_for_handover` takes nothing. A filter, a cursor, a "skip this
one", a preferred county: each would be the caller choosing, and none of them can
be added without changing this signature, which is the narrowest place in the
system to notice.

## Oldest first, and the tiebreak is not decoration

`ORDER BY created_at, id` — FIFO, with `id` making the order TOTAL.
`db/repositories/rules.py::list_all` records the measurement behind that habit
and it is not re-taken here: `created_at` is not unique (`timestamptz` ties are
ordinary at insert time, and two orders arriving in the same millisecond is a
batch intake, not a coincidence), and an `UPDATE` writes a new heap tuple, so an
unqualified read moves a merely-touched row to the end. Without the `id`
tiebreak, two callers a millisecond apart can be handed different orders from an
identical table — which reads as the queue working.

**FIFO IS NOT A RULED POLICY AND THIS DOCSTRING DOES NOT CLAIM IT IS.** It is the
only policy the schema can express: `orders` has no priority, no due date, no
county and no status, so there is nothing else to order by. When those columns
land the policy is a DOMAIN question — `services/queue_service.py` is where it
gets decided, not here, because "which order should this reviewer get next" is a
product ruling and this layer only knows how to sort.

## `LIMIT 1`, not `all()[0]`

The hand-over is one order. Reading the whole tenant's queue and discarding all
but the first is the same answer at a cost that grows with the backlog, and it
also puts every other order in the caller's process — which is the browse this
endpoint exists not to be, one `[1]` away.

## What is NOT here

No claim, no lock, no `FOR UPDATE SKIP LOCKED`, no status transition. **This
method does not TAKE the order, it only NAMES it**, and the reason is that
`orders` has no column to write a claim into. That is stated here and enforced
nowhere in this file, because a repository cannot enforce it — the machine is
`tests/test_queue_endpoint.py::test_the_handover_refuses_until_a_principal_and_an_assignment_column_exist`,
which fails the day the route stops refusing, and its message names this
sentence. Until then no caller reaches this statement, so the non-exclusivity is
a property of unreachable code rather than a live defect.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from titlepipe_core.db.models import Order
from titlepipe_core.db.repositories.base import TenantRepository


class OrderQueueRepository(TenantRepository[Order]):
    """Reads `orders` for the hand-over, through a session that names a tenant.

    Inherits, where `RuleRepository` does not, and the difference is the table:
    `orders` carries `tenant_id` and revision `0002`'s `tenant_isolation` policy,
    so "constructed over a scoped session" is a claim that is TRUE of it. The
    base's refusal message — the one about every read being filtered against a
    tenant that was never established, and every write refused by the policy's
    `WITH CHECK` — is the right diagnosis for this class, which is precisely why
    `_GLOBAL_TABLE_CONSEQUENCE` is not.

    `get` and `add` come with the base and are not overridden. `get`'s contract
    (a row from another tenant is indistinguishable from no row, so the composite
    primary key's existence oracle stays shut) is inherited whole and is correct
    here in a way it is not on the rulebook.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Binds `Order`, so a caller cannot pair this class with another table.

        The base takes `model` as a constructor parameter because it is generic
        over seven tables — `base.py` records why it cannot be a `ClassVar`. A
        queue repository is over exactly one, so it is bound here rather than at
        the call site, and `OrderQueueRepository(session)` reads the same as
        `RuleRepository(session)` at every use.
        """
        super().__init__(session, Order)

    async def next_for_handover(self) -> Order | None:
        """The oldest order this session's tenant may see, or `None`.

        **NO PARAMETERS, AND THAT IS THE INVARIANT.** See the module docstring:
        with nothing to pass, there is nothing for a caller to choose with.

        `None` means the tenant's queue is empty. It does NOT mean "no such
        order" and it is not an error — whether an empty queue is a 200 or a 404
        is a question about the URL, which this layer cannot see, and
        `services/queue_service.py` rules on it. That split is the same one
        `RuleRepository.history_for` makes and it is deliberate that the two
        rulings differ: one URL names a resource, the other names an operation.

        `scalars(...).first()` rather than `one_or_none()`. `LIMIT 1` already
        makes at most one row possible, so the two are equivalent on this
        statement — but `one_or_none()` says "more than one would be a
        programming error I want to hear about", and if the `LIMIT` were ever
        dropped that sentence would be false: more than one order is the normal
        state of a queue. `first()` is the honest verb for "take the head".

        The read goes through `self._session`, which is the point of the class:
        a method that opened its own session off the same engine would satisfy
        the constructor's mark and bypass the tenant.
        `tests/test_order_queue_repository.py` asserts the returned row is in
        this session's identity map, for `test_rule_repository.py`'s reason —
        that injection passes every other assertion.
        """
        rows = await self._session.scalars(
            select(Order).order_by(Order.created_at, Order.id).limit(1)
        )
        return rows.first()

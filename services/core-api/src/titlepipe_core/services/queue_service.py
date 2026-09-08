"""The queue's use case: hand one order to one reviewer, with its product named.

## The tenant is a PARAMETER and has no default

Not a contextvar. An ambient request-scoped tenant is the ergonomic version and
it is the version that is absent by accident the day a background worker calls
this use case; `db/session.py` records what an unscoped session does — it sits at
the deny sentinel and reads zero rows, which is indistinguishable from an empty
queue. A parameter cannot be absent by accident.

## What this layer rules on, and what it refuses to

RULES: an empty queue is a SUCCESSFUL hand-over of nothing. `None`, a 200,
`{"order": null}`. That is the OPPOSITE of `RuleService.rule_history`, which
raises `NotFoundError` for a code the rulebook never carried, and the two are
consistent because `/api/rules/{code}` names a RESOURCE while `/api/queue/next`
names an OPERATION that always exists.

DOES NOT RULE: which order is next. `OrderQueueRepository` sorts by `created_at`
because that is the only total order the schema expresses. When "which order
should this reviewer get" becomes answerable from a priority or a due date it is
decided HERE, in the layer that owns business rules, rather than in an `ORDER BY`
nobody reads.

## The product NAME is read here, and it is the statement this service holds

`packages/contract/src/entities.ts:62-69` declares `product` as what the server
RESOLVED, beside `period_label` — "a rendered label the server composes".
`orders.product_id` is a uuid. Putting that uuid on the wire under the name
`product` would be a value no caller can read as the thing the field means, so
the name is fetched here and `api/mappers/queue.py` refuses to render a row whose
product did not resolve.

A SECOND STATEMENT IN THE SAME TRANSACTION, not a join. A join wants either an
`Order.product` relationship or a projection out of the repository, and both are
`db/models/**` and `db/repositories/**` — not this branch's. RESIDUAL: two round
trips on a single-row read. What closes it is that relationship plus a
`selectinload`, in the branch that owns the model.

## `fastapi` is not imported here and no status code is named

`CONVENTIONS.md` §10. The machine is `scripts/check_backend_rules.py`'s
`layer-service-http` and `layer-service-api` rules.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from titlepipe_core.db.models import Order, Product
from titlepipe_core.db.reads import scoped_read
from titlepipe_core.db.repositories.base import TenantRepository
from titlepipe_core.db.repositories.queue import OrderQueueRepository
from titlepipe_domain import TenantId

_RESOURCE = "queue"

# The caller's half of the story when the database is not there. `db/reads.py`
# records why each route writes its own rather than sharing one: "the rulebook is
# temporarily unavailable" and this are different sentences to the person reading
# the screen. Client-safe by contract, like every `DomainError` message.
_UNAVAILABLE_MESSAGE = "The work queue is temporarily unavailable. Try again shortly."


@dataclass(frozen=True)
class Handover:
    """One order, and the name of the product it resolved to.

    `product_name` is `None` for TWO different facts and the mapper is what tells
    them apart: the order resolved no product (`order.product_id is None`, which
    `entities.ts:62-69` says is an ordinary state and renders as `null`), or it
    names a product whose row did not come back. The second cannot happen while
    `fk_orders_tenant_id_product_id_products` stands — but a `Handover` that
    collapsed the two would make the day it can happen indistinguishable from the
    ordinary one, which is the `NOT_PRESENT` / `PRESENT_UNREADABLE` mistake under
    another name.
    """

    order: Order
    product_name: str | None


class QueueService:
    """The hand-over. One method, and it takes no choice from its caller.

    Constructed per request from the sessionmaker the lifespan opened. `None` is
    a legal argument and means the service was started with no database
    configured; it is not checked here, because `scoped_read` makes that call
    with the resource name in hand so the log line names what was being read.
    """

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None) -> None:
        self._session_factory = session_factory

    async def next_order(self, tenant: TenantId) -> Handover | None:
        """The one order this tenant's queue hands over next, or `None`.

        **`tenant` IS THE ONLY PARAMETER AND IT IS NOT A CHOICE.** It says WHOSE
        queue, never WHICH order. `OrderQueueRepository.next_for_handover` takes
        no arguments either, so a cursor would have to be added in two layers.

        `None` IS A SUCCESS — see the module docstring for why an empty queue is a
        200 here and a 404 on `/api/rules/{code}`.

        RETURNS MODELS AND A NAME, never a DTO. `CONVENTIONS.md` §10 puts the
        model-to-DTO step in `api/mappers/queue.py`.

        **THIS METHOD DOES NOT CLAIM THE ORDER.** It reads. Two callers reach the
        same row and nothing here or below prevents it, because `orders` has no
        column to write an assignment into. No caller can observe that today —
        `api/dependencies.py::principal_tenant` refuses every request to the
        route — and `tests/test_queue_endpoint.py` is the machine that keeps the
        refusal in place. It is the property to check first on the day the
        refusal comes off, and the answer is a claim column plus a write, not a
        lock in Python.
        """
        return await scoped_read(
            self._session_factory,
            resource=_RESOURCE,
            unavailable_message=_UNAVAILABLE_MESSAGE,
            tenant=tenant,
            read=_read_handover,
        )


async def _read_handover(session: AsyncSession) -> Handover | None:
    """Both statements, inside the one scoped session `scoped_read` opened.

    A free function and not a method, so it closes over nothing: a bound `self`
    is how a filter reaches this read later without `next_order`'s signature
    changing, and that signature is what `docs/INVARIANTS.md` #22 rests on.
    """
    order = await OrderQueueRepository(session).next_for_handover()
    if order is None:
        return None
    if order.product_id is None:
        return Handover(order=order, product_name=None)
    product = await TenantRepository(session, Product).get(order.product_id)
    return Handover(order=order, product_name=None if product is None else product.name)

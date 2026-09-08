"""`Order` -> the wire, and the one field that has no source on the row.

`CONVENTIONS.md` §10a: mappers exist so the model-to-DTO step has ONE place, not
because the enforcement lives here. What lives here is the correspondence between
`db/models/orders.py` and `packages/contract/src/entities.ts:56-77` — including
the two fields whose names differ on the two sides and the one that is not a
column at all.

THIS MODULE USED TO REFUSE EVERY ORDER, naming twelve columns `orders` did not
have. Nine of the twelve had landed in `0008`, and three were never absences:
`state`/`state_code` and `pages`/`page_count` are NAMES, and `product` is a
resolution. The refusal outlived its reason by one merge and nothing went red,
because `tests/test_queue_endpoint.py` asserted THAT it refused and never WHY —
so the message went on telling callers `orders` has no `client_id` while `orders`
had a `NOT NULL client_id`. The refusal below is derived from the row in hand
rather than from a list of schema facts written down once.

## `product` is the one field with no column behind it

`entities.ts:62-69` puts `product` beside `period_label`, "a rendered label the
server composes"; `orders.product_id` is a uuid. `QueueService` resolves the name
and this module refuses a row whose product did not resolve, rather than sending
`null` — `entities.ts` reserves `null` for an order that resolved NO product, and
sending it for an order that resolved one it could not name collapses two facts
into one value.

RESIDUAL: `product` carries `products.name` and not `products.code`, and the
contract picks neither. The evidence is that `packages/mocks` serves labels
("Current Owner") and `name` is the label column. A ruling closes it;
`docs/frontend/CONTRACT-GAP-queue.md` collects this endpoint's open questions.

## Timestamps are `.isoformat()` and the DTO says `str`

`entities.ts` declares all three as `z.string()`, so the DTO transcribes `str`
and the format is chosen here — one home, and the transcription stays faithful to
the document it answers to. `DateTime(timezone=True)` on all three means the
offset is always present.
"""

from __future__ import annotations

from datetime import datetime

from titlepipe_core.api.schemas.queue import QueueNextResponse, QueueOrderResponse
from titlepipe_core.services.queue_service import Handover
from titlepipe_domain import DomainError

# Client-safe by contract, like every `DomainError` message: it names no host and
# no DSN. What it names is one order's state, which is what would let a caller
# understand a 500 they cannot retry away.
_UNRESOLVED_PRODUCT = (
    "An order cannot be rendered for the queue: it names a product that could not be resolved "
    "to a name. `product` is a rendered label, and a null there would say the order resolved no "
    "product at all — which is a different fact. Nothing may be substituted for it."
)


def _optional_moment(moment: datetime | None) -> str | None:
    return None if moment is None else moment.isoformat()


def render_next_order(handover: Handover | None) -> QueueNextResponse:
    """`GET /api/queue/next` — one order or none. `endpoints.ts:74-78`.

    `None` is the empty queue and renders `{"order": null}`. It is a 200 and the
    ruling is `QueueService`'s, not this module's.

    `DomainError` and not `NotImplementedError` for the refusal, and the BASE
    class specifically. `titlepipe_http_kit.error_contract::DOMAIN_ERROR_STATUS` has no entry for
    the base, so `status_for` answers 500 — the truthful status, because this is a
    fault in this service and there is nothing the caller can change. A
    `RefusalError` would say 422 and blame the request; a
    `DependencyUnavailableError` would say 503 and invite a retry that cannot
    work. `tests/test_errors.py` already asserts an unmapped `DomainError` logs
    `domain_error_unmapped`, which is the line an operator finds beside this.
    """
    if handover is None:
        return QueueNextResponse(order=None)
    order = handover.order
    if order.product_id is not None and handover.product_name is None:
        raise DomainError(_UNRESOLVED_PRODUCT)
    return QueueNextResponse(
        order=QueueOrderResponse(
            id=str(order.id),
            client_id=str(order.client_id),
            external_ref=order.external_ref,
            jurisdiction=order.jurisdiction,
            state=order.state_code,
            county=order.county,
            product=handover.product_name,
            period_label=order.period_label,
            pages=order.page_count,
            status=order.status,
            arrived_at=order.arrived_at.isoformat(),
            accepted_at=_optional_moment(order.accepted_at),
            delivered_at=_optional_moment(order.delivered_at),
        )
    )

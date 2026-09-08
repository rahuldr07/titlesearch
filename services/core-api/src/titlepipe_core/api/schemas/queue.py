"""`GET /api/queue/next` on the wire — the hand-over, and nothing that browses.

Answerable to `packages/contract/src/entities.ts:56-77` (`Order`) and
`endpoints.ts:74-78` (`QueueNextResponse`). MSW serves this route today, so the
shape below is not a proposal — it is what a response has to be for the code that
already exists to parse it.

All thirteen fields are transcribed. Zod strips unknown keys and REFUSES missing
ones, so a narrowed DTO is not a smaller promise but a DIFFERENT DOCUMENT that
`Order.nullable()` rejects outright.

THIS DOCSTRING USED TO SAY TWELVE OF THE THIRTEEN HAD NO COLUMN. `0008` gave
`orders` nine of them and two more were columns under another name;
`api/mappers/queue.py` carries what that cost and what still stands — `product`
is a resolution, not a column.

## `status` is `str` and NOT a `Literal`, and that is transcribed too

`enums.ts:94-99` says so in as many words: the order status vocabulary is OPEN
until the Flask models are ported. `RuleResponse.status` IS a `Literal` because
`enums.ts:72-81` closes that set. A `Literal` here would be this file inventing a
vocabulary and then enforcing it at the boundary — a 500 on a label the contract
permits.

## Nullable is not optional

Six fields are `.nullable()` in `entities.ts` and carry NO `= None` default;
`api/schemas/rules.py` argues why at length and it is not restated. `arrived_at`
is not among them — `entities.ts` declares it required and non-null, which is
that document's statement that an order which exists arrived.

## What is deliberately NOT declared here

`endpoints.ts:81-100` also carries `QueueBandId`, `QueueBandOrder` and the bands
read. **Its absence is a ruling rather than an omission.** PLAN.md §9 question 4
(Q12) is OPEN: `docs/INVARIANTS.md` #22 says one server-chosen next order with no
browsing, the design export draws a browsable workspace, and neither wins by
default. CLAUDE.md forbids building past `OPEN`, so what is declared is the shape
that holds under BOTH answers — and nothing here has to change when Q12 is ruled
on, which is what makes deferring it cheap rather than merely postponed.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class QueueOrderResponse(BaseModel):
    """One order, in the thirteen fields `entities.ts:56-77` declares.

    `extra="forbid"` for `RuleResponse`'s reason: Zod strips an unknown key
    silently, so a fourteenth field added here would be invisible to
    `QueueNextResponse.parse` in the browser and caught only on this side.

    `id` is a `str` and NOT a `UUID`, which is the one place this module diverges
    from `api/schemas/rules.py`. Both are `z.string()` in `entities.ts`, and
    `RuleResponse.id` can afford `UUID` because Pydantic serialises one to
    exactly the string Zod wants. `Order.id` has no live producer to constrain:
    `packages/mocks` serves ids like `ord_2291` on this route, which Zod accepts
    and which a `UUID` field could not express.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    client_id: str
    external_ref: str
    jurisdiction: str
    state: str
    county: str
    product: str | None
    period_label: str | None
    pages: int | None
    status: str
    arrived_at: str
    accepted_at: str | None
    delivered_at: str | None


class QueueNextResponse(BaseModel):
    """`GET /api/queue/next` — one order or none. `endpoints.ts:74-78`.

    **THERE IS NO SECOND MEMBER AND THERE MUST NOT BE ONE.** No claim token, no
    cursor, no assignment field, no "position in queue", no count of what is
    left. PLAN.md §4 lists those by name as the things that turn a hand-over into
    a browse, and `docs/INVARIANTS.md` #22 is the ruling behind it: the caller
    does not choose their next order. A cursor is a choice; a claim token is a
    choice made durable. The shape being one nullable member is what makes "no
    cherry-picking" hold by construction rather than by policy.

    `endpoints.ts:142-153` does declare a `queue_rest` count — on a DIFFERENT
    response, deliberately. Putting it here would tell a caller how much is
    behind the order they were handed, which is the first half of choosing a
    different one.

    `order: null` is the EMPTY QUEUE and it is a 200; `services/queue_service.py`
    owns that ruling and argues it against the 404 `/api/rules/{code}` answers.
    """

    model_config = ConfigDict(extra="forbid")

    order: QueueOrderResponse | None

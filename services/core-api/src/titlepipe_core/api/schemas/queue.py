"""`GET /api/queue/next` on the wire — the hand-over, and nothing that browses.

The second shape Pydantic is authoritative for under ADR-0001, and the first one
transcribed for an endpoint that has no live core-api consumer yet. It is
answerable to `packages/contract/src/entities.ts:56-77` (`Order`) and
`endpoints.ts:74-78` (`QueueNextResponse`), which is the browser's runtime
parser: MSW serves this route today, so the shape below is not a proposal — it
is the shape a response has to have to be parsed by the code that already exists.

## All thirteen, and a smaller DTO is not a smaller promise

Zod strips unknown keys and REFUSES missing ones, so a response short of a field
reaches `apps/web` as `expected string, received undefined` rather than as a
partial order. A narrowed DTO is a DIFFERENT DOCUMENT that `Order.nullable()`
rejects outright, which is why the transcription is complete.

🔴 THIS DOCSTRING USED TO SAY TWELVE OF THE THIRTEEN HAD NO COLUMN. `0008` gave
`orders` nine of them, and two of the three that looked absent were columns under
another name. `api/mappers/queue.py` carries what that cost and what still stands
— `product` is a resolution, not a column.

## `status` is `str` and NOT a `Literal`, and that is transcribed too

`enums.ts:94-99` says so in as many words: "Order status vocabulary is OPEN until
the Flask models (the source of truth) are ported. Do not invent a closed enum
here." `RuleResponse.status` is a `Literal` because `enums.ts:72-81` closes that
set; this one is a `str` because the other author's document declines to. A
`Literal` here would be this file inventing a vocabulary and then enforcing it at
the boundary — a 500 on a label the contract permits.

## Nullable is not optional, for `api/schemas/rules.py`'s reason

Six fields are `.nullable()` in `entities.ts` and carry NO `= None` default here.
That module argues it at length and it is not restated: `.nullable()` requires
the key PRESENT, `= None` makes it optional on input, and one `exclude_none` on
the serialisation path then drops it. `arrived_at` is NOT among them — it is
`z.string()`, required and non-null, which is `entities.ts`'s statement that an
order that exists arrived.

## The envelope wraps, and `null` is a 200

`endpoints.ts:74-78` is `z.object({ order: Order.nullable() })`. A bare `Order`
is a different document and a bare `null` is a different document again.

`order: null` is the EMPTY QUEUE and it is a 200. That is the opposite ruling
from `/api/rules/{code}`, which answers 404 for a code the rulebook never
carried, and the two are consistent: that URL names a RESOURCE, so its absence
is a missing resource; this URL names the HAND-OVER, which exists and is being
performed — the answer "there is nothing for you" is a successful hand-over of
nothing. `services/queue_service.py` owns that ruling, because it is a question
about the domain rather than about HTTP.

## What is deliberately NOT declared here

`endpoints.ts:81-100` also carries `QueueBandId`, `QueueBandOrder` and the bands
read — the Mine / Held / In-flight / Delivered workspace. **It is not
transcribed, and its absence is a ruling rather than an omission.** PLAN.md §9
question 4 (Q12) is OPEN: `docs/INVARIANTS.md` #22 says one server-chosen next
order with no browsing, the current design export draws a browsable workspace,
and neither document wins by default. CLAUDE.md forbids building past `OPEN`, so
the endpoint that holds under BOTH answers is the one declared here, and the one
that exists only under answer (b) or (c) is not.

Nothing about this file has to change when Q12 is ruled on: the hand-over is the
same shape either way. That is PLAN.md §4's own argument for why deferring the
question is cheap, and this module is what makes it true rather than claimed.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class QueueOrderResponse(BaseModel):
    """One order, in the thirteen fields `entities.ts:56-77` declares.

    `extra="forbid"` for `RuleResponse`'s reason: Zod strips an unknown key
    silently, so a fourteenth field added here would be invisible to
    `QueueNextResponse.parse` in the browser and would only ever be caught on
    this side.

    `id` is a `str` and NOT a `UUID`, and it is the one place this module
    diverges from `api/schemas/rules.py`. `entities.ts:57` declares
    `id: z.string()` — not a uuid-formatted string, just a string — and
    `RuleResponse.id` is a `UUID` because `entities.ts:154` is the same
    `z.string()` and Pydantic serialises a `UUID` to exactly the string Zod
    wants. The difference here is that `Order.id` has no live producer to
    constrain: `packages/mocks` serves ids like `ord_2291` on this route, which
    is not a UUID and which Zod accepts. Declaring `UUID` would make this
    service unable to express the ids its own mock backend already emits.
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
    response, and deliberately: it is a census that belongs beside the work a
    reviewer is already doing, not beside the hand-over. Putting it here would
    tell a caller how much is behind the order they were handed, which is the
    first half of choosing a different one.
    """

    model_config = ConfigDict(extra="forbid")

    order: QueueOrderResponse | None

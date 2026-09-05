"""The hand-over, rendered — and the half of it that cannot be, refused.

`CONVENTIONS.md` §10 says why mappers exist here when most codebases skip them:
model-to-DTO is where this application can silently LIE, so it gets a name and
one home. This module is the first time that pays for itself in the only way that
matters, by making a lie IMPOSSIBLE TO WRITE ACCIDENTALLY rather than by catching
one after the fact.

## The gap, stated once

`packages/contract/src/entities.ts:56-77` requires thirteen fields on an `Order`.
`db/models.py::Order` has three columns: `id`, `created_at` and `tenant_id`, and
PLAN.md §2 calls that a deliberately bare skeleton. So twelve of the thirteen —
`client_id`, `external_ref`, `jurisdiction`, `state`, `county`, `product`,
`period_label`, `pages`, `status`, `arrived_at`, `accepted_at`, `delivered_at` —
have nothing to be rendered FROM.

There are three things this file could do about that and two of them are wrong:

* **invent them.** `""`, `0`, `"unknown"`, `null`. CLAUDE.md: never emit a value
  you can't cite. A `county` of `""` is not missing data on this screen, it is a
  county — and `pages: 0` asserts that somebody counted;
* **narrow the DTO to `id`.** `api/schemas/queue.py` records why that is a
  DIFFERENT DOCUMENT rather than a smaller promise: Zod refuses a missing key, so
  the browser rejects the response on twelve fields at once;
* **refuse, naming the columns.** Below.

## Why the refusal is HERE and not in the router or the service

Because this is the only layer that can SEE both objects. The router holds a DTO
it did not build and the service holds a row it does not render; neither is in a
position to notice that the two do not meet. §10 puts them together here exactly
once, which makes this the one place the mismatch is observable — and a mismatch
that is observable in one place gets one guard rather than twelve defaults spread
across whoever wrote each field.

It is also the layer whose failure mode is already understood.
`api/routers/rules.py` records that a `ValidationError` out of a mapper means a
label reached the wire that the contract does not have — a DEFECT IN THIS
SERVICE, rendered as a 500 by `handle_unexpected`, deliberately outside the
`except SQLAlchemyError` that would dress it as an outage. What is raised below
is the same kind of thing said earlier: not "this row failed to validate" but
"this row cannot be attempted".

## `render_next_order(None)` is COMPLETE, and that is not a technicality

The empty queue is a real path, it is the ordinary answer for a reviewer with
nothing waiting, and it renders exactly: `{"order": null}`, no invention, no
guess. The populated path is the one that cannot. Saying so with a branch — one
half returning, one half raising — is the honest shape, and it is why this file
exists now rather than after the migration: when the columns land, the `raise`
becomes twelve assignments and NOTHING ELSE IN THE STACK MOVES.

## What replaces the raise, and who owns it

A migration adding those twelve columns to `orders`, which is `db/models/**` and
`migrations/**` — not this branch's, by boundary. Until it lands, no caller
reaches the raise at all: `api/dependencies.py::principal_tenant` refuses every
request to this route before the service runs. Two gaps, one of which hides the
other, so both are named where they are and both are pinned by
`tests/test_queue_endpoint.py`.
"""

from __future__ import annotations

from titlepipe_core.api.schemas.queue import QueueNextResponse
from titlepipe_core.db.models import Order
from titlepipe_domain import DomainError

# The twelve `entities.ts:56-77` requires and `db/models.py::Order` does not
# have, in the contract's own declaration order. A TUPLE and not a sentence,
# because the refusal below names them and a reader fixing this needs the list —
# and because when the migration lands, this tuple emptying is the diff.
COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE: tuple[str, ...] = (
    "client_id",
    "external_ref",
    "jurisdiction",
    "state",
    "county",
    "product",
    "period_label",
    "pages",
    "status",
    "arrived_at",
    "accepted_at",
    "delivered_at",
)

# Client-safe by contract, like every `DomainError` message. It names no host and
# no DSN; what it does name is a schema fact, which is not a secret and is the
# only thing that would let a caller understand a 500 they cannot retry away.
_CANNOT_RENDER = (
    "An order cannot be rendered for the queue yet: `orders` has no {count} of the "
    "columns the contract requires ({columns}). Nothing may be substituted for them."
)


def render_next_order(row: Order | None) -> QueueNextResponse:
    """`GET /api/queue/next` — one order or none. `endpoints.ts:74-78`.

    `None` renders. A row does not, and raises rather than guessing; the module
    docstring argues both halves and neither is restated.

    `DomainError` and not `NotImplementedError`, which is the obvious spelling
    and the wrong one. `api/errors.py` registers a handler for `DomainError` and
    turns it into the one envelope with a `code` a caller can branch on;
    `NotImplementedError` reaches `handle_unexpected`, which renders a bare
    `INTERNAL_ERROR` and — correctly, for something it cannot identify — tells
    the caller nothing. This failure is identifiable and the sentence is worth
    keeping.

    The BASE `DomainError` specifically, not one of its subclasses.
    `error_envelope.py::DOMAIN_ERROR_STATUS` has no entry for it, so
    `mapped_status_for` returns `None` and `status_for` answers 500 — which is
    the truthful status: this is a fault in this service, not a refusal of the
    caller's request, and there is nothing they can change to make it succeed. A
    `RefusalError` would say 422 and blame the request; a
    `DependencyUnavailableError` would say 503 and invite a retry that cannot
    work. Both are the shape `api/routers/rules.py` records as the defect it
    fixed in the other direction, and `tests/test_errors.py` already asserts that
    an unmapped `DomainError` is logged as `domain_error_unmapped`, which is
    exactly the line an operator should find beside this.
    """
    if row is None:
        return QueueNextResponse(order=None)
    raise DomainError(
        _CANNOT_RENDER.format(
            count=len(COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE),
            columns=", ".join(COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE),
        )
    )

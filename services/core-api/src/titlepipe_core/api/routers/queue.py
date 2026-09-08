"""`GET /api/queue/next` — the hand-over, and the first tenant-scoped route.

The worked example: the first resource BUILT in `CONVENTIONS.md` §10's four
layers rather than retrofitted onto them, so the body below is the shape the
other sixty-eight copy. Three lines of wiring and no decisions — which order,
what an empty queue means and what a caller reads when the database is down are
`services/queue_service.py`'s; the render is `api/mappers/queue.py`'s; the status
is `api/errors.py`'s.

## What a caller gets today: 401, on every request

`PrincipalTenant` raises before anything else runs; `api/dependencies.py` carries
the argument. It is a TRUE statement rather than a stand-in — this service has no
session mechanism, so no caller has a valid session — and it is not the
placeholder `api/routers/rules.py` bans, which is a stand-in USER or a role
header that lets a request through by pretending. This lets nothing through.

**IT IS NOW THE ONLY THING MISSING, WHICH IT WAS NOT UNTIL FX-3.**
`api/mappers/queue.py` used to refuse every order as well and the 401 hid that
for a whole merge, so `tests/test_queue_endpoint.py::test_the_principal_is_now_
the_ONLY_thing_between_this_route_and_a_served_order` asserts both halves
together.

RESIDUAL, and the reason the 401 is not merely paperwork: `orders` has no column
to write an assignment into, so two concurrent callers are handed the SAME row.
Whoever removes the refusal owns it; the answer is a claim column plus a write.

## The bands endpoint is NOT here, and its absence is a ruling

`packages/contract/src/endpoints.ts:81-100` declares `GET /api/queue/bands` — the
Mine / Held / In-flight / Delivered workspace. PLAN.md §9 question 4 is OPEN on
whether the queue is a hand-over or a workspace, CLAUDE.md forbids building past
`OPEN`, and this endpoint holds under either answer while that one exists only
under two of the three. `api/schemas/queue.py` records the same from the wire's
side.

`docs/INVARIANTS.md` #22 — the reviewer does not choose their next order — is
held by there being no parameter to choose with at any of the three layers, and
`tests/test_queue_endpoint.py` asserts it against the signatures rather than the
prose.
"""

from __future__ import annotations

from fastapi import APIRouter

from titlepipe_core.api.dependencies import PrincipalTenant, SessionFactory
from titlepipe_core.api.mappers.queue import render_next_order
from titlepipe_core.api.schemas.queue import QueueNextResponse
from titlepipe_core.services.queue_service import QueueService

# The health probes deliberately carry no prefix; `api/routers/health.py` says why.
router = APIRouter(prefix="/api", tags=["queue"])


@router.get(
    "/queue/next",
    response_model=QueueNextResponse,
    summary="The next order, chosen by the server",
)
async def next_order(session_factory: SessionFactory, tenant: PrincipalTenant) -> QueueNextResponse:
    """One order for this caller, or `null`. `endpoints.ts:74-78`.

    `tenant` is a DEPENDENCY and not a parameter the caller supplies — no query
    string and no header reaches it. It names WHOSE queue and never WHICH order.

    **THE MAPPER CALL IS OUTSIDE THE SERVICE AND THAT IS THE DESIGN**, for the
    reason `api/routers/rules.py` records: rendering inside the service would put
    it under `scoped_read`'s `except SQLAlchemyError`, which does not catch a
    `ValidationError` today and would dress a defect in this service as a
    downstream outage the moment anyone widened it.

    There is NO BRANCH here on the service's result, which is what keeps "an
    empty queue is a 200" a ruling `QueueService` makes once.
    """
    return render_next_order(await QueueService(session_factory).next_order(tenant))

"""`GET /api/queue/next` — the hand-over, and the first tenant-scoped route.

The worked example. `CONVENTIONS.md` §10 rules the four layers on and
`GET /api/rules` was retrofitted onto them; this is the first resource BUILT in
that shape, so the body below is the shape the other sixty-eight copy:

    tenant  <- api/dependencies.py        the handler layer's AUTHORISE job
    rows    <- services/                  the use case, one transaction
    DTO     <- api/mappers/               model -> DTO, the only place both meet
    return                                and the route has decided nothing

Three lines of wiring and no decisions. Which order, under which tenant, what an
empty queue means and what a caller reads when the database is not there are all
`services/queue_service.py`'s; how a row becomes the wire is
`api/mappers/queue.py`'s; what a `DomainError` becomes over HTTP is
`api/errors.py`'s. If a later route needs a fourth line, that is worth a second
look before it is worth a helper.

## What a caller gets today: 401, on every request, deliberately

`PrincipalTenant` raises before anything else runs. `api/dependencies.py` carries
the argument in full: an absent principal is an authentication fact with one
sentence for every resource, so the handler layer answers it, and the refusal is
a TRUE statement rather than a stand-in — this service has no session mechanism,
so no caller has a valid session.

**AND IT IS NOW THE ONLY THING MISSING** — which it was not until FX-3.
`api/mappers/queue.py` used to refuse every order as well, and the 401 hid that
for a whole merge. `tests/test_queue_endpoint.py::test_the_principal_is_now_the
_ONLY_thing_between_this_route_and_a_served_order` asserts both halves in one
place so the hidden one cannot come back unannounced.

RESIDUAL, and it is what the 401 hides today: `orders` has no column to write an
assignment into, so two concurrent callers are handed the SAME row. Whoever
removes the refusal owns it; the answer is a claim column plus a write.

The 401 is not a placeholder for auth in the sense `api/routers/rules.py` bans.
That module refuses a stand-in USER, a role header, a `mock_auth_enabled` branch
— anything that lets a request through by pretending. This lets nothing through.

## Why the route exists at all while it cannot succeed

Because the WIRE is the deliverable. ADR-0001 puts the wire under
Pydantic/OpenAPI, migrated endpoint by endpoint, and `packages/mocks` is the
backend for this route today — so what core-api owes is the shape, pinned on the
Python side, at the path the browser already calls. `api/schemas/queue.py` is
that shape and this is that path. A schema with no route attached is a document
nobody's OpenAPI reads, and a document is what this system's failure mode
already has enough of.

## No parameters. Not one, at any layer

No query string, no path parameter, no body, no header the caller controls.
`docs/INVARIANTS.md` #22: the reviewer does not choose their next order.
`OrderQueueRepository.next_for_handover` and `QueueService.next_order` both say
the same thing about their own signatures, and the three together are why the
invariant is a property of the code rather than a rule somebody enforces — a
cursor cannot be added in one layer.

## The bands endpoint is NOT here, and its absence is a ruling

`packages/contract/src/endpoints.ts:81-100` declares `GET /api/queue/bands`, the
Mine / Held / In-flight / Delivered workspace. PLAN.md §9 question 4 is OPEN on
whether the queue is a hand-over or a workspace, CLAUDE.md forbids building past
`OPEN`, and this endpoint holds under either answer while that one exists only
under two of the three. `api/schemas/queue.py` records the same decision from the
wire's side.
"""

from __future__ import annotations

from fastapi import APIRouter

from titlepipe_core.api.dependencies import PrincipalTenant, SessionFactory
from titlepipe_core.api.mappers.queue import render_next_order
from titlepipe_core.api.schemas.queue import QueueNextResponse
from titlepipe_core.services.queue_service import QueueService

# `/api` here rather than on each route, matching `api/routers/rules.py`; the
# health probes deliberately carry no prefix and `api/routers/health.py` records
# why. `tags=["queue"]` groups this route in the OpenAPI document under the
# resource rather than under the file.
router = APIRouter(prefix="/api", tags=["queue"])


@router.get(
    "/queue/next",
    response_model=QueueNextResponse,
    summary="The next order, chosen by the server",
)
async def next_order(session_factory: SessionFactory, tenant: PrincipalTenant) -> QueueNextResponse:
    """One order for this caller, or `null`. `endpoints.ts:74-78`.

    `tenant` is a DEPENDENCY and not a parameter the caller supplies — there is
    no query string and no header that reaches it. It names WHOSE queue and
    never WHICH order, and today it raises before this body runs.

    `null` IS A 200 AND IS NOT AN ERROR. That ruling is
    `QueueService.next_order`'s and is argued there against the contrasting one
    on `/api/rules/{code}`, which 404s an unknown code: that URL names a
    resource, this one names an operation that always exists. The route
    contributes nothing to it — there is no branch here on the service's result,
    which is what makes the ruling live in one place.

    **THE MAPPER CALL IS OUTSIDE THE SERVICE AND THAT IS THE DESIGN**, for the
    reason `api/routers/rules.py` records: rendering inside the service would put
    it under `scoped_read`'s `except SQLAlchemyError`, which does not catch a
    `ValidationError` today and would dress a defect in this service as a
    downstream outage the moment anyone widened it.
    """
    return render_next_order(await QueueService(session_factory).next_order(tenant))

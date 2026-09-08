"""`GET /api/queue/next` — the refusal, the empty answer, and the render.

## 🔴 WHAT THIS FILE GOT WRONG, AND WHAT CHANGED BECAUSE OF IT

It used to assert that `api/mappers/queue.py` refuses every order, and it was
right when it was written: `orders` had three columns. `0008` gave the table nine
of the twelve the mapper named, and two of the remaining three were never
absences — `state`/`state_code` and `pages`/`page_count` differ in NAME, not in
existence. **Nothing went red**, because every assertion here was about the fact
of the refusal and none was about its reason. The endpoint could not serve an
order on a tree that held the data, and the suite called that correct.

So: a test that asserts a refusal asserts WHY it refuses, against something that
moves when the reason moves. Below, the render is checked field by field against
the row's own columns, the surviving refusal is checked against the ORDER IN
HAND rather than a list of schema facts, and
`test_every_contract_field_is_sourced_from_a_column_or_a_named_resolution` goes
red the day a column this endpoint reads is renamed out from under it.

## No Zod counterpart, and that is a stated gap rather than a hidden one

`packages/contract` declares `QueueNextResponse` and this file transcribes from
it, but nothing on the TypeScript side reads `contract-fixtures/
queue-next-empty.json`. Same shape of gap `test_rule_history_contract_parity.py`
records, same disposition: a REQUEST in the build report, not something this file
can close.
"""

from __future__ import annotations

import inspect
import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

import pytest
from fastapi.testclient import TestClient
from minimal_rows import a_minimal_order
from pydantic import SecretStr

from titlepipe_core.api.dependencies import principal_tenant
from titlepipe_core.api.mappers.queue import render_next_order
from titlepipe_core.api.routers.queue import next_order as next_order_route
from titlepipe_core.api.schemas.queue import QueueNextResponse, QueueOrderResponse
from titlepipe_core.app import create_app
from titlepipe_core.db.models import Order
from titlepipe_core.db.repositories.queue import OrderQueueRepository
from titlepipe_core.services.queue_service import Handover, QueueService
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import DomainError, Environment

_FIXTURES: Final = Path(__file__).resolve().parents[3] / "contract-fixtures"
EMPTY_FIXTURE: Final = _FIXTURES / "queue-next-empty.json"

# A DSN nothing ever connects with. `CoreApiSettings` refuses to construct
# without one outside of the no-database case, and every test below is refused
# before a connection is attempted — the 401 happens in a dependency and the
# render tests never touch the app at all.
UNUSED_DSN: Final = "postgresql+psycopg://u:p@db.titlepipe.example:5432/t"

# The parameter every layer of this stack is allowed to take, and the only one.
# `tenant` says WHOSE queue; anything else would say WHICH order.
PERMITTED_PARAMETERS: Final = frozenset({"self", "tenant", "session_factory"})

# The two contract fields that are columns under another name, and the one that
# is not a column at all. Written HERE and not imported from the mapper on
# purpose: a test that reads its expectation out of the code it is checking
# cannot notice the code changing. `product` is `products.name`, resolved by
# `QueueService` — `api/mappers/queue.py` carries the residual on which of
# `name`/`code` the contract means.
CONTRACT_FIELD_TO_COLUMN: Final[dict[str, str]] = {"state": "state_code", "pages": "page_count"}
CONTRACT_FIELDS_WITH_NO_COLUMN: Final = frozenset({"product"})

ORDER_COLUMNS: Final = frozenset(Order.__table__.columns.keys())


def _client() -> TestClient:
    """The real app, with the real error handlers and the real dependency."""
    settings = CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr(UNUSED_DSN),
    )
    return TestClient(create_app(settings))


def _fixture_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _an_order(ordinal: int) -> Order:
    """An order with every column this endpoint reads set, and set DISTINCTLY.

    `ordinal` makes two calls differ in every one of them, which is what
    `test_nothing_on_the_wire_is_a_constant_this_module_invented` needs and what
    stops a field being asserted against a value that is also its neighbour's.
    `a_minimal_order` supplies the tenant and the `NOT NULL` floor; everything
    named here is named because the mapper reads it.
    """
    return a_minimal_order(
        uuid.uuid4(),
        id=uuid.uuid4(),
        client_id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        external_ref=f"MC-{ordinal}",
        jurisdiction=f"jurisdiction-{ordinal}",
        state_code=f"S{ordinal}",
        county=f"county-{ordinal}",
        status=f"status-{ordinal}",
        period_label=f"period-{ordinal}",
        page_count=ordinal,
        arrived_at=datetime(2026, 9, ordinal, 9, 0, tzinfo=UTC),
        accepted_at=datetime(2026, 9, ordinal, 10, 0, tzinfo=UTC),
        delivered_at=datetime(2026, 9, ordinal, 11, 0, tzinfo=UTC),
    )


def _a_handover(ordinal: int = 1) -> Handover:
    return Handover(order=_an_order(ordinal), product_name=f"Current Owner {ordinal}")


def _rendered(handover: Handover) -> QueueOrderResponse:
    order = render_next_order(handover).order
    assert order is not None, "a populated hand-over rendered `{'order': null}`"
    return order


def test_the_principal_is_now_the_ONLY_thing_between_this_route_and_a_served_order() -> None:
    """🔴 THE ENDPOINT ANSWERS 401 TO EVERY CALLER, FOR EXACTLY ONE REASON.

    This test used to assert TWO refusals — the 401 and the mapper's — and the
    second one silently stopped being true. So the second assertion is now the
    opposite claim: the mapper RENDERS. If it ever refuses a populated order
    again, this goes red beside the 401 rather than a year later.

    WHAT TO DO WHEN THIS GOES RED: authentication has landed and
    `api/dependencies.py::principal_tenant` returns a real tenant. Before
    deleting the first assertion, read this — **`orders` has no column to write
    an assignment into, so `QueueService.next_order` hands the SAME row to every
    concurrent caller.** It is invisible today because nothing reaches it.
    Whoever removes the refusal owns it, and the answer is a claim column plus a
    write, not a lock in Python.
    """
    with _client() as client:
        response = client.get("/api/queue/next")

    assert response.status_code == 401, (
        f"the hand-over answered {response.status_code}, not 401. If a principal has landed, read "
        f"this test's docstring BEFORE deleting the assertion: nothing claims the order."
    )
    body = response.json()
    sentence = body["error"]
    assert isinstance(sentence, str), (
        f"`error` was {sentence!r}, which is not a string. "
        f"`apps/web/src/shared/api.ts::readError` keeps `body.error` only when it is a non-empty "
        f"string and otherwise renders `${{status}} ${{statusText}}`, so a nested object here "
        f"reaches a reviewer as a bare '401 Unauthorized'."
    )
    assert sentence, (
        "`error` was the empty string, which `readError` discards for the same reason it discards "
        "an object: the reviewer gets '401 Unauthorized' and no sentence."
    )
    assert "No credential will satisfy this" in sentence, (
        f"the refusal no longer says that no credential can satisfy it: {sentence!r}. A 401 "
        f"conventionally means 'authenticate and retry', and there is nothing to authenticate "
        f"against — an integrator reading only the status builds headers for a mechanism that "
        f"does not exist."
    )

    rendered = render_next_order(_a_handover())
    assert rendered.order is not None, (
        "the mapper has started refusing a populated order again. That is the defect this file "
        "was rewritten for: the 401 hides it, so the suite has to say it out loud."
    )


def test_the_empty_queue_renders_the_committed_envelope_and_nothing_else() -> None:
    """`None` in, `{"order": null}` out, byte for byte.

    Against the COMMITTED FIXTURE rather than a dict built in this file, so the
    assertion holds on the bytes a Zod parser would read. `order` is `.nullable()`
    in `endpoints.ts:74-78`, which requires the key PRESENT — a model serialising
    it away under `exclude_none` produces `{}`, which Zod rejects and which a
    comparison against a Python dict with a `None` value would not notice.
    """
    rendered = render_next_order(None)

    assert rendered.model_dump_json(indent=2) + "\n" == _fixture_text(EMPTY_FIXTURE), (
        f"the empty hand-over no longer serialises to the committed fixture.\n"
        f"  rendered: {rendered.model_dump_json()}\n"
        f"  fixture:  {_fixture_text(EMPTY_FIXTURE).strip()}"
    )
    assert '"order": null' in _fixture_text(EMPTY_FIXTURE), (
        "the fixture no longer carries the `order` key with a null value. Zod's `.nullable()` "
        "requires the key PRESENT; an omitted key is `expected object, received undefined`."
    )
    assert QueueNextResponse.model_validate_json(_fixture_text(EMPTY_FIXTURE)) == rendered, (
        'the fixture does not parse back into the model it was rendered from. `extra="forbid"` '
        "is on both models, so a key the fixture grew that nothing declares fails here rather "
        "than reaching a browser that ignores it."
    )
    assert json.loads(_fixture_text(EMPTY_FIXTURE)) == {"order": None}, (
        "the empty envelope grew a second member. `api/schemas/queue.py` records why there must "
        "not be one: a cursor, a claim token or a count of what is left is the first half of "
        "letting a caller choose a different order."
    )


def test_a_populated_order_renders_every_contract_field_from_its_own_column() -> None:
    """Thirteen fields, each against the column it came from.

    The three that are not a straight copy are the whole of FX-3 and are asserted
    by name: `state` is `state_code`, `pages` is `page_count`, and `product` is
    the name `QueueService` resolved rather than anything on the row.
    """
    handover = _a_handover()
    order = handover.order
    rendered = _rendered(handover)

    assert rendered.id == str(order.id)
    assert rendered.client_id == str(order.client_id)
    assert rendered.external_ref == order.external_ref
    assert rendered.jurisdiction == order.jurisdiction
    assert rendered.county == order.county
    assert rendered.status == order.status
    assert rendered.period_label == order.period_label

    assert rendered.state == order.state_code, (
        f"`state` rendered {rendered.state!r}, not `state_code` ({order.state_code!r}). The "
        f"contract calls it `state` and the column is `state_code`; that difference is a NAME "
        f"and it was read as an absence for a whole merge."
    )
    assert rendered.pages == order.page_count, (
        f"`pages` rendered {rendered.pages!r}, not `page_count` ({order.page_count!r}) — the "
        f"second of the two naming differences."
    )
    assert rendered.product == handover.product_name, (
        f"`product` rendered {rendered.product!r} rather than the resolved name "
        f"{handover.product_name!r}. `entities.ts:62-69` declares a rendered label; "
        f"`orders.product_id` is a uuid and putting it here is a value no caller can read."
    )
    assert str(order.product_id) not in (rendered.product or ""), (
        "`product` carries the product's uuid. That is the identity, not the label the contract "
        "asks for, and a reviewer would read a uuid where the product name belongs."
    )

    assert rendered.arrived_at == order.arrived_at.isoformat()
    assert rendered.accepted_at is not None
    assert rendered.accepted_at == order.accepted_at.isoformat() if order.accepted_at else False
    assert rendered.delivered_at == (order.delivered_at.isoformat() if order.delivered_at else None)


def test_nothing_on_the_wire_is_a_constant_this_module_invented() -> None:
    """Every field moves when its source moves. Principle 6, as a machine.

    Two hand-overs differing in every source. A field that comes back equal is
    one the mapper is supplying rather than reading — `""`, `0`, `"unknown"` and
    a hard-coded status all look like a working endpoint and are the exact
    failure `CLAUDE.md`'s "never emit a value you can't cite" names.
    """
    first = _rendered(_a_handover(1)).model_dump()
    second = _rendered(_a_handover(2)).model_dump()

    assert set(first) == set(QueueOrderResponse.model_fields), "the DTO grew a field"
    constants = sorted(field for field in first if first[field] == second[field])
    assert not constants, (
        f"{constants} rendered identically for two orders that share no source value, so the "
        f"mapper is supplying them rather than reading them."
    )


def test_the_mapper_refuses_an_order_whose_product_did_not_resolve_and_says_which_field() -> None:
    """The one surviving refusal, asserted on its REASON.

    It is derived from the order in hand — `product_id` set, no name — and not
    from a list of columns written down once, which is how the old refusal
    outlived its cause. The message must name the field; a refusal that lost its
    subject is a 500 with a sentence attached.
    """
    order = _an_order(1)
    assert order.product_id is not None, "the fixture must name a product for this to be the case"

    with pytest.raises(DomainError) as raised:
        render_next_order(Handover(order=order, product_name=None))

    message = str(raised.value)
    assert type(raised.value) is DomainError, (
        f"the mapper raised {type(raised.value).__name__}, not the base `DomainError`. "
        f"`pytest.raises(DomainError)` catches every subclass, so this is the assertion that "
        f"pins the base. `DOMAIN_ERROR_STATUS` has no entry for it, so `status_for` answers 500 "
        f"— a fault in this service with nothing the caller can change. A subclass would claim "
        f"422, 503 or 404 and every one of those is a different and wrong story."
    )
    assert "product" in message, (
        f"the refusal does not name the field it could not render: {message!r}."
    )
    assert "columns the contract requires" not in message, (
        f"the refusal has gone back to claiming `orders` is missing columns: {message!r}. It is "
        f"not: `0008` added them, and the message asserting otherwise while `orders` had a "
        f"`NOT NULL client_id` is what this file exists to stop."
    )


def test_an_order_that_resolved_no_product_renders_null_rather_than_refusing() -> None:
    """The two absences are different, and only one of them is a refusal.

    `entities.ts:62-69` says an order that failed validation has no resolved
    product, so `product: null` is an ORDINARY answer. Refusing it would collapse
    "resolved nothing" into "resolved something I cannot name" — the
    `NOT_PRESENT` / `PRESENT_UNREADABLE` mistake with different nouns.
    """
    order = _an_order(1)
    order.product_id = None

    rendered = _rendered(Handover(order=order, product_name=None))

    assert rendered.product is None, (
        f"`product` rendered {rendered.product!r} for an order that resolved none. `null` is what "
        f"the contract reserves for exactly this."
    )


def test_every_contract_field_is_sourced_from_a_column_or_a_named_resolution() -> None:
    """🔴 THE MACHINE FX-3 DID NOT HAVE.

    The mapper renders thirteen fields; `orders` was rebuilt under it by another
    workstream and the two sides stopped lining up with nothing to say so. This
    walks the DTO against the live table: a contract field is a column of that
    name, a column this file names as differently spelled, or one of the fields
    with no column at all. Renaming `state_code` — or dropping `page_count` —
    fails HERE, naming the field, rather than at whichever caller first serves an
    order.
    """
    unsourced: list[str] = []
    for field in QueueOrderResponse.model_fields:
        if field in CONTRACT_FIELDS_WITH_NO_COLUMN:
            continue
        column = CONTRACT_FIELD_TO_COLUMN.get(field, field)
        if column not in ORDER_COLUMNS:
            unsourced.append(f"{field} -> orders.{column}")

    assert not unsourced, (
        f"{unsourced} name columns `orders` does not have. Either the column was renamed and the "
        f"mapper still reads the old name, or a contract field arrived with nothing behind it. "
        f"The columns that exist are {sorted(ORDER_COLUMNS)}."
    )
    assert set(QueueOrderResponse.model_fields) >= CONTRACT_FIELDS_WITH_NO_COLUMN, (
        f"{sorted(CONTRACT_FIELDS_WITH_NO_COLUMN)} is excused from the check above and is no "
        f"longer a field of the DTO, so the exemption is now hiding nothing and should go."
    )


def test_no_layer_of_the_handover_accepts_a_parameter_that_chooses_an_order() -> None:
    """🔴 INVARIANT #22, ASSERTED AGAINST THE SIGNATURES RATHER THAN THE PROSE.

    `docs/INVARIANTS.md` #22 says the reviewer does not choose their next order,
    and every layer's docstring restates it. Prose is exactly what was already
    there when PLAN.md §4 recorded a live proposal to add a browsable list with a
    cursor to this endpoint, so this reads the three signatures instead.

    `tenant` is permitted because it says WHOSE queue and never WHICH order — and
    it is not a parameter the CALLER supplies: `api/routers/queue.py` takes it
    from a dependency. `session_factory` is wiring, from the same place.
    """
    signatures = {
        "OrderQueueRepository.next_for_handover": inspect.signature(
            OrderQueueRepository.next_for_handover
        ),
        "QueueService.next_order": inspect.signature(QueueService.next_order),
        "api.routers.queue.next_order": inspect.signature(next_order_route),
    }

    assert len(signatures) == 3, "the three layers of the hand-over must all be inspected"
    for name, signature in signatures.items():
        offered = set(signature.parameters)
        assert offered <= PERMITTED_PARAMETERS, (
            f"{name} accepts {sorted(offered - PERMITTED_PARAMETERS)}, which is not "
            f"{sorted(PERMITTED_PARAMETERS)}. INVARIANTS #22: the reviewer does not choose their "
            f"next order. A parameter here is a choice, whichever layer holds it — and the "
            f"invariant holds today because it would have to be added in all three."
        )


def test_the_principal_dependency_takes_nothing_off_the_request() -> None:
    """The refusal reads no header, no cookie and no setting — by SIGNATURE.

    `api/routers/rules.py` bans anticipating Plan 03's auth, and names the shape
    it ends as: `packages/mocks/src/handlers.ts:405`, a missing header defaulting
    to an admin, in a file everybody trusted. `principal_tenant` cannot become
    that by accident, because it is handed nothing to default FROM.
    """
    parameters = list(inspect.signature(principal_tenant).parameters)

    assert parameters == [], (
        f"`principal_tenant` now takes {parameters}. It took nothing on purpose: with no request "
        f"and no settings in scope there is nothing to read a stand-in principal out of, which is "
        f"`api/routers/rules.py`'s rule stated as a signature rather than as a comment."
    )

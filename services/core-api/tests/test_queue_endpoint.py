"""`GET /api/queue/next` — the refusal, the empty answer, and the invariant.

## The three things unproven without this file

1. **The route refuses, and BOTH reasons are named.** The 401 is what a caller
   sees; the missing migration is what they would see next. A test that pinned
   only the 401 would go green the day somebody wired a principal in, and the
   first real order would 500.
2. **The empty queue renders exactly `{"order": null}`**, against committed
   bytes, through the real response model. That is the one path the mapper can
   serve today and it is the one that must not drift.
3. **The invariant is in the signatures.** No layer of this stack accepts a
   parameter that would let a caller choose their order. Asserted by INSPECTION
   of the three signatures rather than by prose, because prose is what
   `docs/INVARIANTS.md` #22 already is and it did not stop a cursor being
   proposed for this endpoint in PLAN.md §4.

## Why there is no "a real order comes back" test

Because there is no such response. `api/mappers/queue.py` refuses a populated
queue — twelve of the thirteen fields `packages/contract/src/entities.ts:56-77`
requires have no column on `orders` — and the refusal is asserted below as the
behaviour it is. Writing a test that constructs the thirteen-field DTO by hand
and compares it to a fixture would prove that Pydantic serialises a model, which
`test_rules_contract_parity.py` already establishes, while suggesting this
service can produce one.

## No Zod counterpart, and that is a stated gap rather than a hidden one

`test_rules_contract_parity.py` is paired with `apps/web/contract-parity.test.ts`
and says why neither is sufficient alone. **THIS ENDPOINT'S FIXTURE IS
UNILATERAL.** `packages/contract` declares `QueueNextResponse` — this file
transcribes from it — but nothing on the TypeScript side reads
`contract-fixtures/queue-next-empty.json`, so the null envelope is checked
against this service and against a transcription, not against a parser. Same
shape of gap `test_rule_history_contract_parity.py` records, same disposition: a
REQUEST in the build report, not something this file can close.
"""

from __future__ import annotations

import inspect
import json
from pathlib import Path
from typing import Final

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from titlepipe_core.api.dependencies import principal_tenant
from titlepipe_core.api.mappers.queue import (
    COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE,
    render_next_order,
)
from titlepipe_core.api.routers.queue import next_order as next_order_route
from titlepipe_core.api.schemas.queue import QueueNextResponse
from titlepipe_core.app import create_app
from titlepipe_core.db.models import Order
from titlepipe_core.db.repositories.queue import OrderQueueRepository
from titlepipe_core.services.queue_service import QueueService
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


def _client() -> TestClient:
    """The real app, with the real error handlers and the real dependency."""
    settings = CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr(UNUSED_DSN),
    )
    return TestClient(create_app(settings))


def _fixture_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_the_handover_refuses_until_a_principal_and_an_assignment_column_exist() -> None:
    """🔴 THE ENDPOINT ANSWERS 401 TO EVERY CALLER, AND THIS NAMES BOTH REASONS.

    THE 401 IS ONLY THE FIRST OF THEM, and a test that pinned it alone would
    turn green the moment somebody wired a principal in — at which point the
    first order handed over 500s in `api/mappers/queue.py`, and the second
    problem is discovered by a reviewer rather than by this suite. So the two are
    asserted TOGETHER: this test fails if the route stops refusing while the
    orders table still lacks the twelve columns the contract requires.

    ---------------------------------------------------------------------------
    WHAT TO DO WHEN THIS GOES RED, in the order that makes it safe:
    ---------------------------------------------------------------------------
    1. `orders` grows the twelve columns
       (`COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE`, which is imported here rather
       than transcribed, so the list cannot drift). Then `render_next_order`
       stops raising and this test's second assertion is what needs deleting.
    2. Authentication lands and `api/dependencies.py::principal_tenant` returns a
       real tenant. Then the first assertion needs replacing with one that drives
       a session.
    3. **AND THE THING NEITHER ASSERTION COVERS**: `orders` has no column to
       write an assignment into, so `QueueService.next_order` hands the SAME row
       to every concurrent caller. That is invisible today because nothing
       reaches it. Whoever removes step 2's refusal owns it, and the answer is a
       claim column plus a write, not a lock in Python.

    `client_id` is asserted by name in the sentence, not merely that a sentence
    exists: the refusal's whole value is that it says which columns are missing,
    and a message that lost its list would still be a 500 with an error string.
    """
    with _client() as client:
        response = client.get("/api/queue/next")

    assert response.status_code == 401, (
        f"the hand-over answered {response.status_code}, not 401. If a principal has landed, read "
        f"the second assertion below BEFORE deleting this one: the mapper still cannot render an "
        f"order, so un-refusing here turns every non-empty queue into a 500."
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

    missing = list(COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE)
    assert missing, (
        "`COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE` is empty, so the migration has landed and the "
        "mapper can render an order. The 401 above is now the ONLY thing standing between this "
        "route and a working queue — see step 3 in this test's docstring, which is the part no "
        "assertion covers: `orders` still needs somewhere to write an assignment before two "
        "reviewers stop being handed the same row."
    )
    assert "client_id" in missing, (
        f"the missing-column list no longer names `client_id`: {missing}. The refusal's value is "
        f"that it says WHICH columns are absent; a list that lost its members is a 500 with a "
        f"sentence attached."
    )


def test_the_empty_queue_renders_the_committed_envelope_and_nothing_else() -> None:
    """`None` in, `{"order": null}` out, byte for byte.

    Against the COMMITTED FIXTURE rather than against a dict built in this file,
    so the assertion holds on the bytes a Zod parser would read. `order` is
    `.nullable()` in `endpoints.ts:74-78`, which requires the key PRESENT — a
    model serialising it away under `exclude_none` produces `{}`, which Zod
    rejects, and which a comparison against a Python dict with a `None` value
    would not notice.

    Round-tripped through `model_validate_json` as well, because `extra="forbid"`
    is what catches a key the fixture grew that no model declares.
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


def test_the_mapper_refuses_a_row_rather_than_inventing_twelve_values() -> None:
    """A populated queue raises, and the sentence names the columns.

    The refusal is not tested through the route, because the route cannot reach
    it — `principal_tenant` refuses first. This drives the mapper directly, which
    is the layer that would have to invent the values.

    A `db.models.Order` instance is constructed with NO arguments. It needs none:
    the point is that a row reaching this function is refused whatever it holds,
    and supplying an id would suggest the refusal depends on what is in it.
    """
    with pytest.raises(DomainError) as raised:
        render_next_order(Order())

    message = str(raised.value)
    assert type(raised.value) is DomainError, (
        f"the mapper raised {type(raised.value).__name__}, not the base `DomainError`. "
        f"`pytest.raises(DomainError)` above catches every subclass, so this is the assertion "
        f"that pins the base — and the one that goes red if somebody reaches for a subclass. "
        f"`api/mappers/queue.py` records why the base specifically: `DOMAIN_ERROR_STATUS` has no "
        f"entry for it, so `status_for` answers 500 — a fault in this service, with nothing the "
        f"caller can change. A subclass would claim 422, 503 or 404 and every one of those is a "
        f"different and wrong story."
    )
    for column in COLUMNS_THE_ORDERS_TABLE_DOES_NOT_HAVE:
        assert column in message, (
            f"the refusal does not name `{column}`: {message!r}. The list is what makes this "
            f"actionable rather than an apology."
        )


def test_no_layer_of_the_handover_accepts_a_parameter_that_chooses_an_order() -> None:
    """🔴 INVARIANT #22, ASSERTED AGAINST THE SIGNATURES RATHER THAN THE PROSE.

    `docs/INVARIANTS.md` #22 says the reviewer does not choose their next order,
    and every layer's docstring restates it. Prose is exactly what was already
    there when PLAN.md §4 recorded a live proposal to add a browsable list with a
    cursor to this endpoint, so this reads the three signatures instead.

    `tenant` is permitted because it says WHOSE queue and never WHICH order —
    and it is not a parameter the CALLER supplies: `api/routers/queue.py` takes
    it from a dependency, so there is no query string, header or path segment
    that reaches it. `session_factory` is wiring, from the same place.

    A `limit`, `cursor`, `after`, `county`, `skip` or `order_id` on any of the
    three fails here, in the layer that grew it, rather than in a review.
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
    that by accident, because it is handed nothing to default FROM — no
    `Request`, no settings object, no header parameter.

    A future edit that gives it a `Request` is the moment to re-read that ban,
    and this is what makes the edit visible instead of ordinary.
    """
    parameters = list(inspect.signature(principal_tenant).parameters)

    assert parameters == [], (
        f"`principal_tenant` now takes {parameters}. It took nothing on purpose: with no request "
        f"and no settings in scope there is nothing to read a stand-in principal out of, which is "
        f"`api/routers/rules.py`'s rule stated as a signature rather than as a comment."
    )

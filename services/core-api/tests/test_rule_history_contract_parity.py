"""`GET /api/rules/{code}` — the response shape, pinned to a committed fixture.

## What this file proves that `test_rules_contract_parity.py` does not

The ROW shape is not re-proved here. `RuleResponse` is the same model on both
endpoints and that module already compares it, field by field and label by label,
against `packages/contract/src/entities.ts`. Re-transcribing the nine columns into
this file would be a second copy of one document, free to drift from the first with
nothing comparing them — so what is asserted below is the ENVELOPE around the row,
and the one property that spans the two endpoints: a rule serialised on this route
carries exactly the keys, in exactly the order, that the same rule carries on
`/api/rules`. That comparison is made BETWEEN THE TWO COMMITTED FIXTURES rather
than between two models, so it holds against the bytes a Zod parser would read.

## Why the fixture is unilateral, and that is stated rather than hidden

`test_rules_contract_parity.py` is paired with `apps/web/contract-parity.test.ts`,
and it says why neither is sufficient alone: without the Python side the fixture
rots, without the TypeScript side the shape is only ever checked against itself.
**THIS ENDPOINT HAS NO ZOD COUNTERPART**, because it has no frontend consumer yet
— `packages/contract` declares no `RuleHistoryResponse`. So the envelope's two
members are checked here against nothing but this service, and that is a REAL GAP,
not a shape this file can close: it is recorded as a REQUEST in the build report.
What is NOT unilateral is the part that matters most, the row itself, and the
cross-fixture test below is how that stays true.

## The 404

The refusal is the router's decision and is tested as one, through a `scoped_read`
that returns no rows rather than through a database that holds none. The database
is not the subject: `RuleRepository.history_for` returning `[]` for an unknown code
is `test_rule_repository.py`'s to prove, and what is unproven without this file is
that the route turns that `[]` into a 404 carrying the flat envelope — the shape
`apps/web/src/shared/api.ts::readError` can actually render.

## What this file CANNOT hold, measured rather than assumed

Nothing here proves the repository's ORDER. Every row below is a model instance
built in Python and arrives in the order it was constructed, so deleting
`history_for`'s `.order_by(...)` leaves all of this green — measured. The two
tests in `test_rule_repository.py` that end `..._in_its_own_total_order` and
`..._comes_back_empty_and_not_as_an_error` are the machines for the query itself,
and they fail under exactly the mutations this file survives.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Final
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, TypeAdapter

from titlepipe_core.api.mappers.rules import render_rule_history
from titlepipe_core.api.routers import rules as rules_router
from titlepipe_core.api.schemas.rules import RuleHistoryResponse
from titlepipe_core.app import create_app
from titlepipe_core.db.models import Rule
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import Environment

_FIXTURES: Final = Path(__file__).resolve().parents[3] / "contract-fixtures"
FIXTURE: Final = _FIXTURES / "rule-history-response.json"
COLLECTION_FIXTURE: Final = _FIXTURES / "rules-response.json"

# The code the fixture is a history of. Shared by `_sample_rows` and every
# assertion, so a rename cannot leave the echo and the rows disagreeing by typo.
HISTORY_CODE: Final = "R-001"

# `test_rules_contract_parity.py`'s value, and the same reason: the column is
# `DateTime(timezone=True)` and ruff's DTZ rules ban the naive form.
SEEDED_CREATED_AT: Final = datetime(2026, 8, 6, 12, 0, 0, tzinfo=UTC)


def _sample_rows() -> list[Rule]:
    """Three versions of one code, in `(version, id)` order.

    Constructed inside a function rather than at module scope, for
    `test_rules_contract_parity.py::_sample_rows`'s reason: a mapped instance built
    at import time is state shared by every test in the session.

    The three carry three DIFFERENT statuses, and `pending` is present on purpose.
    `db/rules.py::history_for` rules that nothing filters on read — an engineer
    confirming a pending version is exactly the caller who needs to see it beside
    the version it supersedes — and a fixture of three `live` rows would score full
    marks against a `history_for` that filtered them out.

    Both sides of every nullable appear across the three, which
    `test_the_sample_exercises_both_sides_of_every_nullable` holds. Without it
    every null-spelling assertion below can pass on rows that are never null.
    """
    return [
        Rule(
            id=UUID("00000000-0000-4000-8000-0000000000a1"),
            code=HISTORY_CODE,
            text="The grantor is recorded exactly as the instrument spells it.",
            origin="spec",
            status="retired",
            jurisdiction_scope="FL",
            version=1,
            confirmed_by="eng_ada",
            source_doc_ref="PRD §7",
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-0000000000a2"),
            code=HISTORY_CODE,
            text="The grantor is recorded as the instrument spells it, including suffixes.",
            origin="reconciliation",
            status="live",
            jurisdiction_scope="FL/Broward",
            version=2,
            confirmed_by="eng_ada",
            source_doc_ref=None,
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-0000000000a3"),
            code=HISTORY_CODE,
            text="A third version, raised from an escalation and awaiting an engineer.",
            origin="escalation",
            status="pending",
            jurisdiction_scope=None,
            version=3,
            confirmed_by=None,
            source_doc_ref=None,
            created_at=SEEDED_CREATED_AT,
        ),
    ]


def _serialised() -> str:
    """The fixture's exact contents, from the models.

    `indent=2` and the trailing newline are FIXTURE formatting and not wire
    formatting — `test_rules_contract_parity.py::_serialised` carries the argument.
    """
    return render_rule_history(HISTORY_CODE, _sample_rows()).model_dump_json(indent=2) + "\n"


def _fixture_text(path: Path) -> str:
    """Read with universal newlines. `.gitattributes` sets `* text=auto`, so a
    Windows checkout legitimately holds CRLF and `read_bytes()` would fail there
    over git's own convention rather than over a defect."""
    return path.read_text(encoding="utf-8")


def _versions() -> list[dict[str, object]]:
    """The fixture's version list, as the JSON a Zod parser would see."""
    parsed = RuleHistoryResponse.model_validate_json(_fixture_text(FIXTURE))
    return [version.model_dump() for version in parsed.versions]


# The fixture's shape stated loosely enough to read ANY of these files, so the
# helper below reads the committed bytes rather than a model's `model_fields` —
# comparing two models would be comparing this service with itself.
#
# Through a `TypeAdapter` rather than `json.loads` + `isinstance`. Both spell the
# same runtime check, but narrowing `object` to `dict` proves only the class and
# leaves pyright with `dict[Unknown, Unknown]`, reporting every expression that
# reads an element — the wall documented at
# `api/error_envelope.py::sanitise_validation_errors`. Pydantic builds the dict by
# iterating the input, so FILE ORDER SURVIVES the parse;
# `test_the_key_order_read_back_is_the_files_and_not_an_alphabetical_one` is what
# holds that, because a validator that sorted keys would make the comparison below
# quietly vacuous about order while still catching a changed key SET.
_LOOSE_DOCUMENT: Final = TypeAdapter(dict[str, object])
_LOOSE_ROWS: Final = TypeAdapter(list[dict[str, object]])


def _keys_in_order(raw: str, container: str) -> list[str]:
    """The keys of the first object inside `container`, IN FILE ORDER."""
    rows = _LOOSE_ROWS.validate_python(_LOOSE_DOCUMENT.validate_json(raw)[container])
    assert rows, raw
    return list(rows[0].keys())


def test_the_committed_fixture_is_what_the_models_serialise_today() -> None:
    """The bytes, exactly. This is the artifact any other language reads.

    When this fails the response shape moved: regenerate with `_serialised()` and
    look at the diff before committing it, because the diff is the contract change.
    """
    assert _fixture_text(FIXTURE) == _serialised()


def test_a_version_carries_the_keys_a_rule_carries_on_the_collection_endpoint() -> None:
    """The row shape is ONE shape across two endpoints, key order included.

    Compared between the two COMMITTED FIXTURES rather than between two models,
    because the model is shared and would agree with itself by construction. What
    can actually drift is a future `RuleHistoryResponse` that grows its own row
    model, or a `model_dump` on one route that excludes a field the other keeps —
    and both show up here as a key-list difference.
    """
    history = _keys_in_order(_fixture_text(FIXTURE), "versions")
    collection = _keys_in_order(_fixture_text(COLLECTION_FIXTURE), "rules")
    assert history == collection


def test_the_key_order_read_back_is_the_files_and_not_an_alphabetical_one() -> None:
    """A control on `_keys_in_order`, which the cross-endpoint test rests on.

    If the parse reordered keys, that test would compare two identically-mangled
    lists and pass while saying nothing about order. The contract's own sequence
    starts `id, code, text` and is not alphabetical, so a sorted read is visible:
    `code` would come first and `text` would not be third.
    """
    keys = _keys_in_order(_fixture_text(FIXTURE), "versions")
    assert keys[:3] == ["id", "code", "text"]
    assert keys != sorted(keys), (
        "the parse sorted the keys; _keys_in_order proves nothing about order"
    )


def test_the_envelope_carries_exactly_code_and_versions() -> None:
    """Two members and no third. `extra="forbid"` refuses an unexpected key on the
    way IN; nothing but this refuses one being added on the way out — and a count
    field is the one that would be added first, which the schema docstring rules
    against."""
    # `_LOOSE_DOCUMENT` rather than `json.loads` + `isinstance`, for the reason
    # given above its definition and for one more: `json.loads` is untyped, so the
    # keys of what it returns are `Unknown` and pyright strict refuses to list
    # them. The adapter's `dict[str, object]` is the same assertion typed.
    assert list(_LOOSE_DOCUMENT.validate_json(_fixture_text(FIXTURE))) == ["code", "versions"]


def test_the_echoed_code_is_the_one_every_version_carries() -> None:
    """The property `RuleHistoryResponse` promises, asserted rather than assumed.

    It is provable-equal today only because the router 404s an unknown code, so no
    response can carry versions belonging to another. The day an empty history is
    served the echo becomes the only member left, and it must already be the code
    that was ASKED FOR.
    """
    parsed = RuleHistoryResponse.model_validate_json(_fixture_text(FIXTURE))
    assert parsed.code == HISTORY_CODE
    assert [version.code for version in parsed.versions] == [HISTORY_CODE] * 3


def test_the_mapper_takes_the_code_from_the_caller_and_not_from_the_rows() -> None:
    """A row whose code differs proves which source the echo comes from.

    Reading it off `rows[0]` would pass every other test in this file, because
    every other test uses rows that agree. This is the only one that can tell them
    apart.
    """
    rows = _sample_rows()
    rows[0].code = "R-999"
    assert render_rule_history(HISTORY_CODE, rows).code == HISTORY_CODE


def test_the_committed_versions_are_in_version_order() -> None:
    """The fixture's own sequence, which is what a Zod parser would read.

    🔴 THIS DOES NOT PROVE `history_for` ORDERS ANYTHING, AND IT WAS WRITTEN ONCE
    AS IF IT DID. Every row in this file is a model instance built in Python, so a
    list arrives in the order it was constructed whatever the query would have
    done — MEASURED by deleting `.order_by(Rule.version, Rule.id)` from
    `db/rules.py::history_for`, which left all twelve tests in this file green. Two
    other mutations to the same endpoint were caught here (serving an empty history
    instead of refusing; echoing the code off `rows[0]`), which is what made the
    survivor worth chasing rather than shrugging at.

    The order is a property of the SQL and only a database can hold it:
    `tests/test_rule_repository.py::test_one_code_comes_back_whole_in_its_own_total
    _order` is the machine, over rows seeded in an order that matches no sort key,
    and it fails under that same deletion. What is left here is the narrower and
    still-worth-having claim that the COMMITTED BYTES are in version order — so a
    regenerated fixture that came out shuffled is a visible failure rather than a
    silent contract change.
    """
    parsed = RuleHistoryResponse.model_validate_json(_fixture_text(FIXTURE))
    assert [version.version for version in parsed.versions] == [1, 2, 3]


def test_the_sample_exercises_both_sides_of_every_nullable_and_three_statuses() -> None:
    """The control that stops the fixture from being trivially satisfiable.

    Three `live` rows with every optional column populated would pass the byte
    comparison, the key comparison and the ordering test, and would prove nothing
    about null spelling or about the `pending` visibility ruling.
    """
    versions = _versions()
    for field in ("jurisdiction_scope", "confirmed_by", "source_doc_ref"):
        values = [version[field] for version in versions]
        assert any(value is None for value in values), f"{field} is never null"
        assert any(value is not None for value in values), f"{field} is never populated"
    assert {str(version["status"]) for version in versions} == {"live", "pending", "retired"}


def test_a_null_column_reaches_the_wire_as_a_present_key_holding_null() -> None:
    """`"source_doc_ref": null`, not a missing key.

    Zod's `.nullable()` requires the key PRESENT. `api/schemas/rules.py` records
    why no nullable field carries a `= None` default; this asserts the consequence
    against the committed bytes rather than against the model that produced them.
    """
    raw = _fixture_text(FIXTURE)
    assert '"source_doc_ref": null' in raw
    assert '"jurisdiction_scope": null' in raw
    assert '"confirmed_by": null' in raw


def test_created_at_is_on_the_row_and_never_reaches_the_wire() -> None:
    """Every seeded row carries one and no serialised version does.

    `db/models.py::Rule` records the divergence as deliberate: the response shape
    is the router's to choose rather than the schema's to dictate.
    """
    assert all(row.created_at == SEEDED_CREATED_AT for row in _sample_rows())
    assert "created_at" not in _fixture_text(FIXTURE)


def test_the_fixture_parses_back_into_the_models_with_nothing_left_over() -> None:
    """`extra="forbid"` on both models, so a key the fixture grew that no model
    declares fails here rather than reaching a browser that ignores it."""
    parsed = RuleHistoryResponse.model_validate_json(_fixture_text(FIXTURE))
    assert parsed.model_dump_json(indent=2) + "\n" == _fixture_text(FIXTURE)


def _app_with_read(rows: Sequence[Rule]) -> TestClient:
    """An app whose `scoped_read` answers `rows` without touching a database.

    The substitution is at `api.routers.rules.scoped_read` — the name the route
    resolves — so everything the route itself does is real: the path parameter, the
    empty check, the raise, and the whole error-handler chain the app installs.
    What is replaced is only the session acquisition, which
    `tests/test_rules_endpoint.py` covers against a real engine and which would
    otherwise make this a database test of a routing decision.
    """
    settings = CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr("postgresql+psycopg://u:p@db.titlepipe.example:5432/t"),
    )
    return TestClient(create_app(settings))


@pytest.fixture
def stub_scoped_read(monkeypatch: pytest.MonkeyPatch) -> Callable[[Sequence[Rule]], TestClient]:
    def install(rows: Sequence[Rule]) -> TestClient:
        async def _scoped_read(
            request: object,
            *,
            resource: str,
            unavailable_message: str,
            tenant: object,
            read: Callable[[object], Awaitable[object]],
        ) -> Sequence[Rule]:
            return rows

        monkeypatch.setattr(rules_router, "scoped_read", _scoped_read)
        return _app_with_read(rows)

    return install


def test_an_unknown_code_is_refused_as_a_flat_404_envelope(
    stub_scoped_read: Callable[[Sequence[Rule]], TestClient],
) -> None:
    """No rows becomes a 404 whose reason the browser can actually render.

    🔴 `error` IS ASSERTED TO BE A NON-EMPTY STRING, not merely present.
    `apps/web/src/shared/api.ts::readError` keeps `body.error` only under exactly
    that test and otherwise renders `` `${status} ${statusText}` ``, so a nested
    `{"message": ...}` here would reach the reviewer as "404 Not Found" with no
    throw and no console line — the defect `api/error_envelope.py` measures. The
    404 is this route's only refusal, so this is the only place it is held.
    """
    client = stub_scoped_read([])
    response = client.get("/api/rules/R-404")

    assert response.status_code == 404
    body = response.json()
    sentence = body["error"]
    assert isinstance(sentence, str)
    assert sentence
    assert "R-404" in sentence
    assert body["code"] == "NOT_FOUND"


def test_a_known_code_comes_back_as_the_committed_envelope(
    stub_scoped_read: Callable[[Sequence[Rule]], TestClient],
) -> None:
    """The route's own output, through the real response model, equals the fixture.

    The byte test above proves the models serialise to the fixture; this proves the
    ROUTE serialises to the models. FastAPI's `response_model` re-validates on the
    way out, so a route returning something the model would reject fails here and
    not in a browser.
    """
    client = stub_scoped_read(_sample_rows())
    response = client.get(f"/api/rules/{HISTORY_CODE}")

    assert response.status_code == 200
    assert response.json() == json.loads(_fixture_text(FIXTURE))

"""Gate one of two over the wire shape of `GET /api/rules`: **does the fixture
still describe today's models?**

`contract-fixtures/rules-response.json` is a captured response body, and a captured
fixture goes stale. A stale fixture is a parity test that passes against last
month's shape — so this file asserts, from the Pydantic models themselves, that the
committed bytes are what the code produces TODAY. If it fails, the fixture is
regenerated deliberately rather than drifting silently.

**This file is not the parity proof and cannot be.** Everything below is Python
compared with Python — a second opinion from the same author. The parity proof is
`apps/web-v2/contract-parity.test.ts`, which reads the same committed file and
hands it to the ACTUAL Zod `RulesResponse` from `@titlepipe/contract`. Neither gate
is sufficient alone: without this one the fixture rots, without that one the shape
is only ever checked against itself.

## Most of this file is in-memory, and the LAST test is not — deliberately

`RulesResponse.from_rows` takes any iterable, so the sample below is built as
transient instances and every shape assertion runs without Docker. That is fast and
it is also NOT ENOUGH, because three things a transient instance cannot exhibit are
exactly the three the wire depends on:

* `Rule.origin`/`Rule.status` are PostgreSQL `ENUM` columns. That psycopg hands back
  a plain `str` the `Literal` accepts is an assumption until a driver returns one.
  MEASURED 2026-08-06 by registering a psycopg `register_enum` adapter for
  `rule_origin` so the driver returned an `enum.Enum` member: the test fails, but
  **SQLAlchemy's own `ENUM` result processor refuses it first** —
  `LookupError: '_WireOrigin.spec' is not among the defined enum values`, from
  `sqltypes.py:1712`, inside `list_all` and before Pydantic sees anything. So the
  `Literal` has an outer guard nobody wrote down, and the failure a non-`str`
  actually produces is a driver error rather than a `ValidationError`. The
  `type(...) is str` assertion below is what states the normal case out loud;
* `Rule.id` is `UUID(as_uuid=True)`, and the fixture's canonical lowercase spelling
  is what `uuid.UUID` serialises to — a `str` coming back instead would still
  validate and could still differ byte for byte;
* `model_validate(..., from_attributes=True)` reads attributes off a PERSISTENT
  instance, and in async SQLAlchemy an expired attribute read raises
  `MissingGreenlet` rather than anything a contract test would recognise.

So `test_the_real_read_path_serialises_to_the_committed_fixture` seeds these five
rows into a real `postgres:18.4` and drives the whole path —
`RuleRepository.list_all` -> `from_rows` -> `model_dump_json` — to the same bytes.
That upgrades the fixture from evidence about a hand-built sample to evidence about
the read path `GET /api/rules` will use. It does not duplicate
`tests/test_rule_repository.py`, which proves globality and the `id` tiebreak; this
one proves SERIALISATION, and the two share no assertion.

## Why the sample looks the way it does

It is not "some rules". A fixture that fails to exercise a label proves nothing
about that label's spelling, and `RulesResponse.parse({"rules": []})` succeeds under
Zod — an empty fixture would score full marks on every assertion in both gates
(`00-HOW-TO-EXECUTE.md` §1.1). So `test_the_sample_exercises_every_label_and_both
_sides_of_every_nullable` is the positive control, and it is asserted HERE as well
as in TypeScript so that an impoverished regeneration fails at the point of
regeneration rather than one toolchain later.

Five rows cover: all five `origin` labels, all three `status` labels, both null and
non-null for each of the three nullable columns, and a shared `code` across two
`version`s — the case `RuleRepository.list_all`'s ordering exists for.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, get_args
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy import Engine, text

from titlepipe_core.api.schemas.rules import RuleOrigin, RuleResponse, RulesResponse, RuleStatus
from titlepipe_core.db import RuleRepository, make_engine, make_sessionmaker, tenant_session
from titlepipe_core.db.models import RULE_ORIGIN_LABELS, RULE_STATUS_LABELS, Rule

# `parents[3]` is the repository root: tests -> core-api -> services -> root. The
# fixture sits at the root and not under either toolchain's test tree on purpose —
# it is the one artifact both gates share, and a Python test reaching into
# `apps/web-v2/` (or a Vitest test reaching into `services/core-api/tests/`) would
# make one of them look like the other's private detail.
FIXTURE: Final = Path(__file__).resolve().parents[3] / "contract-fixtures" / "rules-response.json"

# Transcribed from `packages/contract/src/entities.ts:153-163` — the contract's own
# order and spelling, not `RuleResponse.model_fields`, which would be the model
# agreeing with itself.
CONTRACT_FIELDS: Final = (
    "id",
    "code",
    "text",
    "origin",
    "status",
    "jurisdiction_scope",
    "version",
    "confirmed_by",
    "source_doc_ref",
)

# `packages/contract/src/enums.ts:72-81`, likewise transcribed.
CONTRACT_STATUS_LABELS: Final = ("live", "pending", "retired")
CONTRACT_ORIGIN_LABELS: Final = ("spec", "escalation", "reconciliation", "complaint", "senior")

NULLABLE_FIELDS: Final = ("jurisdiction_scope", "confirmed_by", "source_doc_ref")

# A creation time no row on the wire may carry. Timezone-aware because the column
# is `DateTime(timezone=True)` and ruff's DTZ rules ban the naive form outright.
SEEDED_CREATED_AT: Final = datetime(2026, 8, 6, 12, 0, 0, tzinfo=UTC)

# The order the PostgreSQL seed WRITES `_sample_rows()` in, as indices into it. It
# matches no sort key, and that is the whole point: a freshly written heap returns
# insertion order for an unqualified `SELECT`, so a seed written in the fixture's
# own order would pass against a repository with no `order_by` at all.
#
#   fixture order   R-001 v1 · R-001 v2 · R-013 · R-021 · R-044
#   insert order    R-013 · R-044 · R-001 v2 · R-021 · R-001 v1
#
# R-001 v2 BEFORE v1 is the deliberate part. With v1 first, `ORDER BY code` alone
# would return the R-001 group in the fixture's order and the `version` key would be
# decoration. The `id` tiebreak is NOT observable here — no two of these five share
# a `(code, version)` — and it is not this file's to prove: `test_rule_repository.py`
# seeds two rows sharing both and sequences all four keys against literals.
SEED_WRITE_ORDER: Final = (2, 4, 1, 3, 0)

SEEDED_RULES: Final = 5


def _sample_rows() -> list[Rule]:
    """The five rows the fixture is built from, in `(code, version, id)` order.

    Built inside a function rather than at module scope: a mapped instance
    constructed at import time is state shared by every test in the session, and
    two of the tests below mutate what they are given.

    The ids are deliberately not random. `00000000-0000-4000-8000-00000000000N` is
    a well-formed v4 UUID that nobody will mistake for a real one, and it keeps the
    fixture's bytes reproducible — which is the whole point of a captured file.
    """
    return [
        Rule(
            id=UUID("00000000-0000-4000-8000-000000000001"),
            code="R-001",
            text="The grantor is recorded exactly as the instrument spells it.",
            origin="spec",
            status="live",
            jurisdiction_scope="FL",
            version=1,
            confirmed_by="eng_ada",
            source_doc_ref="PRD §7",
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-000000000002"),
            code="R-001",
            text="A second version of the same code, awaiting an engineer.",
            origin="escalation",
            status="pending",
            jurisdiction_scope=None,
            version=2,
            confirmed_by=None,
            source_doc_ref=None,
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-000000000003"),
            code="R-013",
            text="Superseded: a legal description is never abbreviated.",
            origin="reconciliation",
            status="retired",
            jurisdiction_scope="FL/Broward",
            version=1,
            confirmed_by=None,
            source_doc_ref=None,
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-000000000004"),
            code="R-021",
            text="A recording date with no year is NOT_PRESENT, not a guess.",
            origin="complaint",
            status="live",
            jurisdiction_scope=None,
            version=1,
            confirmed_by="eng_grace",
            source_doc_ref=None,
            created_at=SEEDED_CREATED_AT,
        ),
        Rule(
            id=UUID("00000000-0000-4000-8000-000000000005"),
            code="R-044",
            text="Land and building values are never checked against the total.",
            origin="senior",
            status="retired",
            jurisdiction_scope=None,
            version=3,
            confirmed_by=None,
            source_doc_ref="CONTEXT §11",
            created_at=SEEDED_CREATED_AT,
        ),
    ]


def _serialised() -> str:
    """The fixture's exact contents, from the models.

    `indent=2` and the trailing newline are FIXTURE formatting, not wire formatting:
    JSON whitespace is not something Zod parses, and `end-of-file-fixer` would add
    the newline back if this did not. What the byte comparison actually pins is the
    key set, the key ORDER, the values and the null spellings — everything a reader
    of the committed file would otherwise have to take on trust.
    """
    return RulesResponse.from_rows(_sample_rows()).model_dump_json(indent=2) + "\n"


def _fixture_text() -> str:
    """Read with universal newlines, which is the only concession to the platform.

    `.gitattributes` sets `* text=auto`, so a Windows checkout legitimately holds
    CRLF and `read_bytes()` would fail there over git's own convention rather than
    over a defect. Every other byte — indentation, trailing space, a stray blank
    line — still has to match.
    """
    return FIXTURE.read_text(encoding="utf-8")


def _seed_the_fixture_rows(engine: Engine) -> dict[UUID, tuple[str, int, str, str]]:
    """`_sample_rows()`, committed, AS THE SUPERUSER, in `SEED_WRITE_ORDER`.

    AS THE SUPERUSER because `0002` grants `titlepipe_app` `SELECT` on `rules` and
    nothing else — the role every assertion here is made as cannot write the rows it
    reads, which is the correct shape for a table only a migration or an
    engineer-confirmed path may change. Same reasoning, and the same `DELETE` first,
    as `test_rule_repository.py::_seed_rulebook`; they are not one helper because
    that one chooses rows for an ORDERING proof and this one must write the
    fixture's exact five.

    COMMITTED, because the reader below is a different connection — an `AsyncEngine`
    of its own — and an uncommitted row is invisible to it.

    `created_at` IS LEFT TO THE SERVER DEFAULT and is deliberately NOT
    `SEEDED_CREATED_AT`. The wire must not carry it, so the byte comparison holds
    only if the column is genuinely dropped; a seeded value equal to the in-memory
    sample's would make that assertion pass for the wrong reason.

    Returns `id -> (code, version, origin, status)` from `RETURNING`, so the caller
    asserts what LANDED rather than what was sent. One statement per row: a `text()`
    executed with a list of parameter dictionaries is an executemany, and RETURNING
    does not come back from one (measured in `conftest._seed_isolation_rows`).
    """
    sample = _sample_rows()
    written: dict[UUID, tuple[str, int, str, str]] = {}
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM rules"))
        for index in SEED_WRITE_ORDER:
            row = sample[index]
            returned = connection.execute(
                text(
                    "INSERT INTO rules "
                    "(id, code, text, origin, status, jurisdiction_scope, version, "
                    " confirmed_by, source_doc_ref) "
                    "VALUES (:id, :code, :body, :origin, :status, :scope, :version, "
                    " :confirmed_by, :source_doc_ref) "
                    "RETURNING id, code, version, origin, status"
                ),
                {
                    "id": row.id,
                    "code": row.code,
                    "body": row.text,
                    "origin": row.origin,
                    "status": row.status,
                    "scope": row.jurisdiction_scope,
                    "version": row.version,
                    "confirmed_by": row.confirmed_by,
                    "source_doc_ref": row.source_doc_ref,
                },
            ).one()
            written[UUID(str(returned[0]))] = (
                str(returned[1]),
                int(returned[2]),
                str(returned[3]),
                str(returned[4]),
            )
    return written


@pytest.fixture
def seeded_fixture_rulebook(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> dict[UUID, tuple[str, int, str, str]]:
    """The seed, with its premises asserted HERE before any test reads a row.

    The test this feeds compares two strings, and `"" == ""` is true — a seed that
    silently wrote nothing would turn a byte comparison against an empty response
    into a green test about nothing. So the floor is a LITERAL, and the ids are
    checked against the sample's rather than counted, for the reason
    `00-HOW-TO-EXECUTE.md` §1.1 gives: a count of five is satisfied by five wrong
    rows. A failure here is reported as a setup ERROR, which names this fixture.
    """
    engine = seam_engine(migrated_database)
    try:
        written = _seed_the_fixture_rows(engine)
    finally:
        engine.dispose()

    assert len(written) == SEEDED_RULES, (
        f"the seed wrote {len(written)} rows, not {SEEDED_RULES}. The test this feeds "
        f"compares the serialised response against the committed fixture, and two "
        f"empty documents are equal."
    )
    assert set(written) == {row.id for row in _sample_rows()}, (
        f"the seed landed the ids {sorted(written)}, which are not the sample's. The "
        f"byte comparison is against a fixture built from those exact rows, so a seed "
        f"writing others would fail on the values rather than on the shape."
    )
    return written


@pytest.mark.asyncio
async def test_the_real_read_path_serialises_to_the_committed_fixture(
    app_dsn: str, seeded_fixture_rulebook: dict[UUID, tuple[str, int, str, str]]
) -> None:
    """🔴 THE FIXTURE, PRODUCED BY THE PATH THAT WILL ACTUALLY PRODUCE IT.

    Everything above this line builds `Rule` instances in Python, and a transient
    instance cannot exhibit the three things the wire depends on. All three are
    exercised here and none of them is asserted separately, because the byte
    comparison is strictly stronger than three separate assertions would be:

    * `origin` and `status` come back from PostgreSQL `ENUM` columns. A driver
      returning anything the `Literal` does not accept raises `ValidationError`
      inside `from_rows`, and a driver returning a different SPELLING changes the
      bytes;
    * `id` comes back from `UUID(as_uuid=True)`. The fixture's canonical lowercase
      form is what `uuid.UUID` serialises to; a `str` or an upper-case rendering
      would still validate and would not match;
    * the rows are PERSISTENT instances read through `model_validate(...,
      from_attributes=True)`. `make_sessionmaker` sets `expire_on_commit=False`, and
      the read happens inside the block regardless — an expired attribute read here
      raises `MissingGreenlet`, which is not a failure mode a hand-built sample has.

    AND IT COVERS `list_all`'s ORDERING, THOUGH NOT `from_rows`'s.
    `SEED_WRITE_ORDER` writes the rows in an order matching no sort key, so a
    `list_all` that lost its `order_by` returns the heap — and these bytes change.

    🔴 IT DOES NOT SUBSUME `test_from_rows_preserves_arrival_order`, AND A FIRST
       VERSION OF THIS PARAGRAPH CLAIMED IT DID. MEASURED 2026-08-06 with
       `from_rows` replaced by `sorted(..., key=lambda r: r.code)`: that test failed
       and THIS ONE PASSED. Python's `sorted` is stable, `list_all` had already
       ordered by `(code, version, id)`, and re-sorting by a PREFIX of a key the
       rows are already in is a no-op. The two tests catch different faults —
       ordering lost below, ordering imposed above — and neither covers the other.
       Writing that they overlap was the artefact class `01-WHAT-HAPPENED.md` §5
       collects: a comment describing coverage the assertion does not have.

    `tenant_session(sessionmaker, None)` is what `GET /api/rules` will pass — the
    endpoint has no principal, and the rulebook is global. That claim is
    `test_rule_repository.py`'s to prove and is only USED here.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            rows = await RuleRepository(session).list_all()
            body = RulesResponse.from_rows(rows).model_dump_json(indent=2) + "\n"
    finally:
        await engine.dispose()

    assert len(rows) == SEEDED_RULES, (
        f"the read returned {len(rows)} rows, not the {SEEDED_RULES} the fixture "
        f"seeded. The comparison below would then be against a shorter document, and "
        f"a `rules: []` response serialises perfectly well."
    )

    # The two driver types, OBSERVED rather than inferred from the bytes matching.
    # `type(...) is` and not `isinstance`, deliberately: a `str` subclass — which is
    # what a registered psycopg enum adapter produces — satisfies `isinstance` and is
    # not what the `Literal` was written against. These are diagnostics; the byte
    # comparison below is the assertion. They exist so that a driver or adapter
    # change reports as ITSELF instead of as an unexplained diff of five rules.
    first = rows[0]
    assert type(first.origin) is str, (
        f"psycopg returned {type(first.origin)!r} for the `rule_origin` ENUM column, "
        f"not `str`. `RuleResponse.origin` is a `Literal` of the contract's five "
        f"spellings and accepts nothing else."
    )
    assert type(first.id) is UUID, (
        f"psycopg returned {type(first.id)!r} for `id`, not `uuid.UUID`. The "
        f"fixture's canonical lowercase spelling is what Pydantic renders a `UUID` "
        f"as; a `str` would validate and could still differ byte for byte."
    )
    assert body == _fixture_text(), (
        "the response built from PostgreSQL rows is not the committed fixture. This "
        "is the assertion that separates 'the models serialise correctly' from 'the "
        "read path serialises correctly': a `str` id, an unexpected enum spelling, a "
        "lost `order_by` or a `created_at` reaching the wire all land here and "
        "nowhere else in this file."
    )


def test_from_rows_preserves_arrival_order_rather_than_imposing_one() -> None:
    """`from_rows` MUST NOT re-sort, and the fixture alone cannot say so.

    🔴 MEASURED at review, 2026-08-06: replacing the comprehension in `from_rows`
       with `sorted(..., key=lambda row: row.code)` left this module at 7 passed.
    The sample is already in `(code, version, id)` order, so the byte comparison
    cannot tell "preserved what it was given" from "re-sorted by the repository's own
    key" — the exact substitution `from_rows`'s docstring warns against.

    Reversed input is what makes the difference observable. `RuleRepository.list_all`
    calls the ordering a WIRE-STABILITY decision and owns it; the day `from_rows`
    imposes one too, that docstring becomes false and the two disagree silently.
    """
    reversed_sample = list(reversed(_sample_rows()))
    emitted = RulesResponse.from_rows(reversed_sample)

    assert [(rule.code, rule.version) for rule in emitted.rules] == [
        (row.code, row.version) for row in reversed_sample
    ], "from_rows re-ordered its input; the ordering belongs to RuleRepository.list_all"

    # The control: the assertion above is only meaningful if the reversed sequence
    # actually differs from the sorted one. It does — but a sample that happened to
    # be palindromic in `(code, version)` would make this test unfalsifiable, and
    # that is one careless fixture edit away.
    assert [(rule.code, rule.version) for rule in emitted.rules] != [
        (row.code, row.version) for row in _sample_rows()
    ], "the sample reads the same reversed, so this test cannot distinguish the two"


def test_the_committed_fixture_is_what_the_models_serialise_today() -> None:
    """The anti-staleness gate. This is the reason the fixture is allowed to exist.

    A captured response is only evidence about the code that captured it. When this
    fails, the models moved and the fixture did not — regenerate it deliberately,
    from `services/core-api`:

        uv run python -c "import sys; sys.path.insert(0, 'tests'); import test_rules_contract_parity as t; t.FIXTURE.write_text(t._serialised(), encoding='utf-8')"

    and then read the diff, because the TypeScript gate is about to tell you
    whether the new shape is one the contract accepts.
    """
    assert _fixture_text() == _serialised()


def test_the_sample_exercises_every_label_and_both_sides_of_every_nullable() -> None:
    """The positive control, asserted where the fixture is produced.

    Without it every other assertion in both gates is satisfied by `{"rules": []}`:
    Zod parses an empty array happily, no enum label is ever spelled, and no
    nullable key is ever emitted. A suite of shape assertions over no rows cannot
    tell "the contract matches" from "there was nothing to check".
    """
    payload = json.loads(_fixture_text())
    rules = payload["rules"]

    assert {rule["origin"] for rule in rules} == set(CONTRACT_ORIGIN_LABELS)
    assert {rule["status"] for rule in rules} == set(CONTRACT_STATUS_LABELS)

    for name in NULLABLE_FIELDS:
        emitted = [rule[name] for rule in rules]
        assert None in emitted, f"{name} is never null in the fixture"
        assert [value for value in emitted if value is not None], f"{name} is never set"

    # The shared-code case `RuleRepository.list_all`'s `(code, version, id)` ordering
    # exists for. A fixture of five distinct codes could not tell that order from
    # `ORDER BY code`.
    codes = [rule["code"] for rule in rules]
    assert len(codes) != len(set(codes)), "no two rows share a code"


def test_the_wire_enum_spellings_are_the_stored_ones() -> None:
    """Storage and wire agree — asked as its own question, from both directions.

    `api/schemas/rules.py` transcribes its literals from `enums.ts` rather than
    importing `db/models.py`'s, precisely so that this comparison is between two
    independently written tuples. Anchoring both to the contract's spelling is what
    stops it degenerating into the enum test `01-WHAT-HAPPENED.md` §5 records, which
    compared a constant to a value derived from that same constant and survived
    renaming both halves.
    """
    assert get_args(RuleStatus) == CONTRACT_STATUS_LABELS
    assert get_args(RuleOrigin) == CONTRACT_ORIGIN_LABELS
    assert RULE_STATUS_LABELS == CONTRACT_STATUS_LABELS
    assert RULE_ORIGIN_LABELS == CONTRACT_ORIGIN_LABELS


def test_created_at_is_on_the_row_and_never_reaches_the_wire() -> None:
    """The column the contract does not have, asserted rather than merely omitted.

    The first assertion is the control: without it this test is equally happy with a
    row that never carried a `created_at` at all, which is the shape of denial
    assertion `00-HOW-TO-EXECUTE.md` §1.1 is about. Zod cannot help here either — it
    STRIPS unknown keys instead of refusing them, so an accidental tenth field
    reaches the browser and is silently discarded.
    """
    row = _sample_rows()[0]
    assert row.created_at == SEEDED_CREATED_AT

    dumped = RuleResponse.model_validate(row).model_dump()
    assert "created_at" not in dumped
    assert tuple(dumped) == CONTRACT_FIELDS

    assert "created_at" not in _fixture_text()


def test_a_null_column_reaches_the_wire_as_a_present_key_holding_null() -> None:
    """`.nullable()` is not `.optional()`, and this is where the difference bites.

    A `str | None = None` field plus `exclude_none` — or `exclude_defaults`, or
    `response_model_exclude_unset` on the route Task 4 writes — drops the key, and
    Zod answers `expected string, received undefined`. The second half is the
    control: a model that emitted every nullable as `null` unconditionally would
    satisfy the first half and be just as wrong.
    """
    absent, present = _sample_rows()[1], _sample_rows()[0]

    emitted = json.loads(RuleResponse.model_validate(absent).model_dump_json())
    for name in NULLABLE_FIELDS:
        assert name in emitted, f"{name} was omitted rather than emitted as null"
        assert emitted[name] is None

    carried = json.loads(RuleResponse.model_validate(present).model_dump_json())
    assert carried["jurisdiction_scope"] == "FL"
    assert carried["confirmed_by"] == "eng_ada"
    assert carried["source_doc_ref"] == "PRD §7"


def test_the_fixture_parses_back_into_the_models_with_nothing_left_over() -> None:
    """Round-trip, which is what `extra="forbid"` is for.

    `model_validate_json` refuses a key the model does not declare, so this is the
    Python-side answer to Zod's stripping: a fixture that grew a tenth field fails
    here even though `RulesResponse.parse` would accept it in the browser.
    """
    assert RulesResponse.model_validate_json(_fixture_text()).model_dump_json(indent=2) + "\n" == (
        _serialised()
    )


def test_a_label_outside_the_contract_is_refused_at_the_boundary() -> None:
    """`from_rows` VALIDATES; it does not copy.

    The row's `origin` is `Mapped[str]` and the field is a `Literal`, so a label
    that exists in the database enum but not in the contract's — the shape a future
    migration adds — is caught here rather than shipped for the browser to reject.
    Delete the `Literal`s in favour of `str` and this test is the one that fails.
    """
    row = _sample_rows()[0]
    row.origin = "underwriter"

    with pytest.raises(ValidationError, match="origin"):
        RulesResponse.from_rows([row])

"""The golden set refuses what it says it refuses, and truth cannot be confused with output.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS. PLAN §6 measured that NO GOLDEN SET EXISTS for either
   real package, so every accuracy number in the system reads `NO_TRUTH_YET`,
   and cross-engine agreement is not a substitute — three engines agreed on a
   WRONG reading at 0.20 confidence on the worst pages. `0070`-`0072` are the
   schema that can hold ground truth. This file is what says the refusals in
   them are refusals rather than comments.
---------------------------------------------------------------------------

## The two questions, and which tests answer which

**1. Can a model output be mistaken for truth?** Answered STRUCTURALLY, by
closed-world reads of the live catalog rather than by writing rows:

* `test_no_relation_in_the_schema_carries_a_golden_flag` — a truth stored as a
  flagged row beside model output is one forgotten `WHERE` clause away from a
  leaderboard that scores an engine against itself, and the query that forgets
  it does not look wrong. There is no such column anywhere in `public`;
* `test_golden_and_engine_vocabularies_never_meet_in_one_relation` — no relation
  holds a column from both vocabularies. This is the one that will have
  something to catch: `field_readings` gains `engine_id` in another worker's
  revision, and on THIS branch the assertion passes with nothing to catch, which
  is said here rather than left for a reader to discover;
* `test_the_golden_tag_labels_...` and `test_the_golden_act_labels_...` — neither
  vocabulary has a label for a machine, so an engine-derived truth and an
  "engine reading promoted" act are not merely discouraged but unrepresentable.

**2. Do the write-time refusals fire?** Answered BEHAVIOURALLY, by issuing the
statement and reading the SQLSTATE back. Two codes, and confusing them is how a
test in this area passes while proving nothing:

* **`23514`** (`check_violation`) — a CHECK refused. The constraint NAME is
  asserted as well, because "some check failed" is also what a typo in the test
  produces;
* **`0A000`** (`feature_not_supported`) — a TRIGGER refused. `0071`'s append-only
  pair and `0072`'s ledger requirement both raise it, and it is what PostgreSQL
  itself returns for "cannot update this thing". No typo produces it: an unknown
  column is `42703` and an unknown table `42P01`.

## Everything here connects as the CONTAINER SUPERUSER, and that is deliberate

`migrated_database` yields `admin_dsn`. A superuser bypasses row-level security
unconditionally, which is exactly wrong for an isolation proof and exactly right
for these: a CHECK constraint and a trigger are consulted for a superuser like
anybody else, and the ACL is not in the way, so a refusal that comes back here
can only be the constraint or the trigger.

**IT IS ALSO THE ONLY IDENTITY THAT CAN DRIVE `0072`'s POSITIVE CONTROL.** That
trigger's `SELECT` against `golden_corrections` runs `SECURITY INVOKER`, so under
`FORCE ROW LEVEL SECURITY` a session with no tenant established — the owner, for
instance — sees no ledger row and is refused even when one exists. `0072`'s
module docstring records that as the intended answer for a data migration. Here
it means the signed-move test must not be run as the owner, and the reason is
written down so nobody "fixes" it into a false negative.

`tests/test_tenant_isolation.py` is where the golden tables are proved isolated,
as `titlepipe_app`, through the seed. Nothing in this file is an isolation claim.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator, Mapping

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

from titlepipe_core.db.golden_models import (
    GOLDEN_ACT_LABELS,
    GOLDEN_ACT_TYPE_NAME,
    GOLDEN_TAG_LABELS,
    GOLDEN_TAG_TYPE_NAME,
)

# 🔴 WRITTEN OUT AS LITERALS AND NOT IMPORTED, which is the leg that catches an
# edit made to the model AND the migration at once — the mutation that renamed
# two `na_reason` labels in both places and left the suite green. The second leg
# is below: the live `pg_enum` is compared against the imported constant, which
# catches an edit to either copy alone.
GOLDEN_TAG_LITERALS = ("delivered_report", "ruled", "suspect", "agreed")
GOLDEN_ACT_LITERALS = ("correct", "confirm", "demote")

CHECK_VIOLATION_SQLSTATE = "23514"
FEATURE_NOT_SUPPORTED_SQLSTATE = "0A000"
FOREIGN_KEY_VIOLATION_SQLSTATE = "23503"
UNIQUE_VIOLATION_SQLSTATE = "23505"

# The column names that mean "a machine produced this". A closed list, because
# the assertion it feeds is a closed-world one: a column outside this list is not
# caught, and the honest position is that this catches the vocabulary the
# repository actually uses rather than every conceivable spelling.
ENGINE_OUTPUT_COLUMNS = frozenset(
    {"engine_id", "engine_version", "engine_kind", "confidence", "model", "model_version"}
)

# The column names that mean "a person established this". Both are on
# `golden_fields` and nowhere else today.
GOLDEN_TRUTH_COLUMNS = frozenset({"established_by", "established_reason"})

# What an `is_golden`-shaped discriminator would be called. The point of the
# assertion is the SHAPE — a boolean beside model output saying "this one is
# true" — so the names are matched rather than a specific one looked for.
GOLDEN_FLAG_COLUMNS = frozenset({"is_golden", "golden", "is_truth", "is_ground_truth"})

GOLDEN_TABLE = "golden_fields"
LEDGER_TABLE = "golden_corrections"

TENANT = uuid.UUID("33333333-3333-3333-3333-333333333333")
OTHER_TENANT = uuid.UUID("44444444-4444-4444-4444-444444444444")


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    `isinstance` rather than a bare `getattr`, for the reason
    `test_audit_log_append_only.py::_sqlstate` gives: `getattr` on a DBAPI
    exception returns whatever is there, and a comparison of `Any` against a
    string passes for a `None` as readily as for a code.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _refuses(engine: Engine, statement: str, parameters: Mapping[str, object]) -> DBAPIError:
    """Run one statement, require that it raised, hand the error back, roll back.

    The rollback is what lets every test in this module share one module-scoped
    database without leaving a half-written row for the next one.

    `Mapping` and not `dict`, because `dict` is INVARIANT in its value type: a
    `dict[str, UUID | str | int]` built at a call site is not assignable to
    `dict[str, object]`, and pyright says so. `Mapping` is covariant there.
    """
    with engine.connect() as connection:
        with pytest.raises(DBAPIError) as raised:
            connection.execute(text(statement), parameters)
        connection.rollback()
    return raised.value


def _refusal_names(error: DBAPIError, sqlstate: str, constraint: str) -> None:
    """Assert both the code and WHICH object refused.

    A test that asserted only "something raised" is satisfied by a misspelled
    column, and one that asserted only the SQLSTATE is satisfied by a DIFFERENT
    constraint on the same table firing first. The name is the content.
    """
    assert _sqlstate(error) == sqlstate, (
        f"expected {sqlstate} from {constraint}, got {_sqlstate(error)!r}: {error}"
    )
    assert constraint in str(error), (
        f"{sqlstate} came back, but not from {constraint} — a refusal for the "
        f"wrong reason is not this constraint working: {error}"
    )


# The golden row every test starts from: a delivered-report seed with a value.
INSERT_GOLDEN = """
    INSERT INTO golden_fields
        (tenant_id, order_id, path, value, na_reason, tag,
         source_citation, established_by, established_reason)
    VALUES
        (:tenant, :order_id, :path, :value, CAST(:na_reason AS na_reason),
         CAST(:tag AS golden_tag), :citation, :signer, :reason)
    RETURNING id
"""

INSERT_LEDGER = """
    INSERT INTO golden_corrections
        (tenant_id, golden_field_id, act, signed_by, reason, source_citation,
         tag_before, tag_after, value_before, na_reason_before,
         value_after, na_reason_after, revision_after)
    VALUES
        (:tenant, :golden_field_id, CAST(:act AS golden_act), :signed_by, :reason,
         :citation, CAST(:tag_before AS golden_tag), CAST(:tag_after AS golden_tag),
         :value_before, CAST(:na_reason_before AS na_reason),
         :value_after, CAST(:na_reason_after AS na_reason), :revision_after)
"""

MOVE_GOLDEN = """
    UPDATE golden_fields
       SET value = :value, tag = CAST(:tag AS golden_tag),
           source_citation = :citation, revision = :revision
     WHERE tenant_id = :tenant AND id = :id
"""


def _golden_parameters(**overrides: object) -> dict[str, object]:
    """A complete, legal golden row, with any field replaced by name.

    Every test below is "this row, but one thing wrong", and spelling the other
    eight columns out per test is how the wrong one stops being visible.
    """
    parameters: dict[str, object] = {
        "tenant": TENANT,
        "order_id": None,
        "path": f"test.only.{uuid.uuid4()}",
        "value": "Lot 7, Block 2",
        "na_reason": None,
        "tag": "delivered_report",
        "citation": "delivered report v1, page 3",
        "signer": "TEST-ONLY reviewer",
        "reason": "seeded from the delivered report",
    }
    parameters.update(overrides)
    return parameters


def _ledger_parameters(**overrides: object) -> dict[str, object]:
    """A complete, legal `confirm` ledger row, with any field replaced by name."""
    parameters: dict[str, object] = {
        "tenant": TENANT,
        "golden_field_id": None,
        "act": "confirm",
        "signed_by": "TEST-ONLY reviewer",
        "reason": "the seed matches the deed",
        "citation": "delivered report v1, page 3",
        "tag_before": "delivered_report",
        "tag_after": "ruled",
        "value_before": "Lot 7, Block 2",
        "na_reason_before": None,
        "value_after": "Lot 7, Block 2",
        "na_reason_after": None,
        "revision_after": 1,
    }
    parameters.update(overrides)
    return parameters


@pytest.fixture(scope="module")
def golden_engine(migrated_database: str, seam_engine: Callable[[str], Engine]) -> Iterator[Engine]:
    """One superuser engine for the module, with two orders committed under it.

    The orders are committed rather than rolled back because every test opens its
    own connection, and `golden_fields`' composite foreign key needs a visible
    parent in the same tenant. Two tenants, so the cross-tenant foreign-key
    refusal has something to point at.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            for tenant in (TENANT, OTHER_TENANT):
                connection.execute(
                    text("INSERT INTO orders (tenant_id) VALUES (:tenant)"), {"tenant": tenant}
                )
        yield engine
    finally:
        engine.dispose()


def _order_id(connection: Connection, tenant: uuid.UUID) -> uuid.UUID:
    """The one order this module wrote for `tenant`."""
    return uuid.UUID(
        str(
            connection.execute(
                text("SELECT id FROM orders WHERE tenant_id = :tenant"), {"tenant": tenant}
            ).scalar_one()
        )
    )


# --- 1. truth and output cannot be confused ---------------------------------


def _columns_by_relation(connection: Connection) -> dict[str, frozenset[str]]:
    """Every user table in `public` -> its live column names.

    `attnum > 0 AND NOT attisdropped` for the reason every other catalog read in
    this suite gives: system columns sit at negative `attnum`, and a dropped
    column keeps its `pg_attribute` row under a mangled name.
    """
    rows = connection.execute(
        text(
            "SELECT c.relname, a.attname FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "JOIN pg_attribute a ON a.attrelid = c.oid "
            "WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') "
            "AND a.attnum > 0 AND NOT a.attisdropped"
        )
    ).all()

    found: dict[str, set[str]] = {}
    for relation, column in rows:
        found.setdefault(str(relation), set()).add(str(column))
    return {relation: frozenset(columns) for relation, columns in found.items()}


def test_no_relation_in_the_schema_carries_a_golden_flag(golden_engine: Engine) -> None:
    """🔴 THE FAILURE THIS RULES OUT IS ONE FORGOTTEN `WHERE` CLAUSE.

    A golden value stored as a flagged row inside a readings table is truth and
    model output in one relation, told apart by a boolean. Every query that reads
    that relation must remember the predicate, the one that forgets it counts
    model output as truth, and it does not look wrong.

    The whole of `public`, not the two golden tables: the change this watches for
    is somebody adding the flag to `field_readings`, which a loop over the tables
    somebody remembered would not see.

    THE POSITIVE CONTROL IS IN THE SAME TEST. A catalog read that returned
    nothing at all — wrong schema, `relkind` mistyped — satisfies the assertion
    and proves nothing, so the golden table's own columns are required back.
    """
    with golden_engine.connect() as connection:
        columns = _columns_by_relation(connection)

    flagged = sorted(
        f"{relation}.{column}"
        for relation, names in columns.items()
        for column in names & GOLDEN_FLAG_COLUMNS
    )
    assert flagged == [], (
        "a golden discriminator column exists. Truth and model output in one "
        "relation is one forgotten predicate away from an engine scored against "
        f"itself: {flagged}"
    )

    assert columns[GOLDEN_TABLE] >= GOLDEN_TRUTH_COLUMNS, (
        f"the catalog read itself has moved: {GOLDEN_TABLE} does not report "
        f"{sorted(GOLDEN_TRUTH_COLUMNS)}, so the negative above read an empty "
        f"schema and means nothing. It reports {sorted(columns.get(GOLDEN_TABLE, ()))}"
    )


def test_golden_and_engine_vocabularies_never_meet_in_one_relation(
    golden_engine: Engine,
) -> None:
    """No relation holds a column from both vocabularies.

    A golden row cannot record which engine produced it, and an engine reading
    cannot record who established it. `promote this reading to truth` therefore
    has no shape: it would have to be a person typing the value with a citation
    and a reason, which is an ordinary establishment.

    🔴 ON THIS BRANCH THIS ASSERTION HAS NOTHING TO CATCH, AND SAYING SO IS THE
    HONEST POSITION. `field_readings` at this revision carries only
    `line_coords`; `engine_id` and `engine_version` land in another worker's
    revision. So today the intersection is empty because one side of it is empty
    everywhere. It is written now because it is one line now and a rewrite once
    the two vocabularies are both live — and because the day somebody adds
    `engine_id` to `golden_fields` for convenience is the day it earns itself.

    The vocabularies are CLOSED LISTS. A column spelled `reader_a_said` is not
    caught, and no catalog assertion could be written that would be.
    """
    with golden_engine.connect() as connection:
        columns = _columns_by_relation(connection)

    both = sorted(
        f"{relation}: {sorted(names & GOLDEN_TRUTH_COLUMNS)} beside "
        f"{sorted(names & ENGINE_OUTPUT_COLUMNS)}"
        for relation, names in columns.items()
        if names & GOLDEN_TRUTH_COLUMNS and names & ENGINE_OUTPUT_COLUMNS
    )
    assert both == [], (
        "a relation holds both a golden-truth column and an engine-output "
        "column. Ground truth and model output in one row is what the separate "
        f"tables exist to prevent: {both}"
    )

    assert not (columns[GOLDEN_TABLE] & ENGINE_OUTPUT_COLUMNS), (
        f"{GOLDEN_TABLE} has grown an engine column: "
        f"{sorted(columns[GOLDEN_TABLE] & ENGINE_OUTPUT_COLUMNS)}. There is then "
        f"a place to record that a model produced a truth."
    )


def _enum_labels(connection: Connection, type_name: str) -> tuple[str, ...]:
    """The live labels of one enum type, in `enumsortorder`.

    The order is the server's business and not only ours: `<`, `ORDER BY` and
    `MIN()` on an enum use it, so a reordering is a behaviour change that a set
    comparison would not see.
    """
    rows = connection.execute(
        text(
            "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
            "WHERE t.typname = :name ORDER BY e.enumsortorder"
        ),
        {"name": type_name},
    ).all()
    return tuple(str(row[0]) for row in rows)


@pytest.mark.parametrize(
    ("type_name", "literals", "model_constant"),
    [
        (GOLDEN_TAG_TYPE_NAME, GOLDEN_TAG_LITERALS, GOLDEN_TAG_LABELS),
        (GOLDEN_ACT_TYPE_NAME, GOLDEN_ACT_LITERALS, GOLDEN_ACT_LABELS),
    ],
)
def test_the_golden_enums_have_exactly_these_labels_in_exactly_this_order(
    type_name: str,
    literals: tuple[str, ...],
    model_constant: tuple[str, ...],
    golden_engine: Engine,
) -> None:
    """Two legs, and they catch different mutations — `0003`'s arrangement.

    The LITERAL comparison catches an edit made to the model AND the migration at
    once, which is the mutation that renamed two `na_reason` labels in both
    places and left the suite green. The comparison of the live type against the
    imported constant catches an edit to ONE copy: change the migration alone and
    the live type stops matching the model, change the model alone and it stops
    matching the live type.

    **WHAT THE LABELS DO NOT INCLUDE IS THE CONTENT.** `golden_tag` names four
    ways a PERSON came to hold a value and no way a machine did; `golden_act`
    names the three golden endpoints and has no `promote_from_reading`. An
    engine-derived truth is not discouraged here, it is unrepresentable — and
    that is a property of a missing label, which is exactly what an exact,
    ordered comparison protects.

    `alembic check` DOES NOT COMPARE ENUM LABELS — a fifth label and a reordering
    both leave it green — so nothing else in the suite is covering this.
    """
    with golden_engine.connect() as connection:
        live = _enum_labels(connection, type_name)

    assert live == literals, f"{type_name} is {live}, not the literal {literals}"
    assert live == model_constant, (
        f"{type_name} is {live} in the database and {model_constant} in "
        f"titlepipe_core.db.golden_models — one of the two copies moved alone"
    )


# --- 2. the write-time refusals ---------------------------------------------


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        pytest.param(
            {"signer": "engine:reader_a"},
            "ck_golden_fields_established_by_is_not_an_engine",
            id="an engine identity cannot sign a truth",
        ),
        pytest.param(
            {"signer": "  ENGINE:reader_a  "},
            "ck_golden_fields_established_by_is_not_an_engine",
            id="case and whitespace do not get an engine past it",
        ),
        pytest.param(
            {"signer": "unknown"},
            "ck_golden_fields_established_by_is_signed",
            id="the mock's absent-signer fallback is refused by name",
        ),
        pytest.param(
            {"signer": "   "},
            "ck_golden_fields_established_by_is_signed",
            id="a blank signer is not a signature",
        ),
        pytest.param(
            {"citation": ""},
            "ck_golden_fields_citation_is_not_blank",
            id="a truth nobody can trace to a document is refused",
        ),
        pytest.param(
            {"reason": ""},
            "ck_golden_fields_reason_is_not_blank",
            id="an establishment with no reason is refused",
        ),
        pytest.param(
            {"value": None, "na_reason": None},
            "ck_golden_fields_value_xor_na_reason",
            id="neither a value nor a reason for its absence",
        ),
        pytest.param(
            {"value": "Lot 7", "na_reason": "NOT_PRESENT"},
            "ck_golden_fields_value_xor_na_reason",
            id="a value and a reason for its absence at once",
        ),
    ],
)
def test_a_golden_field_that_breaks_a_refusal_rule_is_refused_by_name(
    overrides: dict[str, object], constraint: str, golden_engine: Engine
) -> None:
    """Each row above is a rule this codebase states somewhere, made a constraint.

    The signer cases are `packages/mocks/src/handlers.ts`'s
    `?? "unknown"` — a permanent, unreversible correction signed with a name that
    identifies nobody, returning 201 — and the engine namespace that makes
    "a machine established this" unstorable rather than merely unusual.

    The `value`/`na_reason` cases are the two NA states, which must never
    collapse: a golden row with neither is a truth nobody finished establishing,
    and a query reading `value IS NULL` as "the field is absent" would find it.
    """
    with golden_engine.connect() as connection:
        order_id = _order_id(connection, TENANT)

    error = _refuses(
        golden_engine, INSERT_GOLDEN, _golden_parameters(order_id=order_id, **overrides)
    )
    _refusal_names(error, CHECK_VIOLATION_SQLSTATE, constraint)


def test_a_golden_field_cannot_name_another_tenants_order(golden_engine: Engine) -> None:
    """The composite foreign key, not a policy, is what refuses this.

    `(tenant_id, order_id) REFERENCES orders (tenant_id, id)` means a golden row
    for tenant A naming tenant B's order has no referent — the constraint refuses
    it with nothing consulted about who is asking. A single-column
    `order_id REFERENCES orders (id)` would accept it happily, which is why
    CONVENTIONS §1 calls one a defect.

    Run as the superuser, so RLS is out of the picture entirely and the refusal
    can only be the key.
    """
    with golden_engine.connect() as connection:
        other_order = _order_id(connection, OTHER_TENANT)

    error = _refuses(golden_engine, INSERT_GOLDEN, _golden_parameters(order_id=other_order))
    assert _sqlstate(error) == FOREIGN_KEY_VIOLATION_SQLSTATE, (
        f"a golden row naming another tenant's order returned "
        f"{_sqlstate(error)!r}, not a foreign-key violation: {error}"
    )


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        pytest.param(
            {"reason": ""},
            "ck_golden_corrections_reason_is_not_blank",
            id="a correction with no reason",
        ),
        pytest.param(
            {"citation": "  "},
            "ck_golden_corrections_citation_is_not_blank",
            id="a correction with no source",
        ),
        pytest.param(
            {"signed_by": "unknown"},
            "ck_golden_corrections_signed_by_is_signed",
            id="a correction signed by nobody",
        ),
        pytest.param(
            {"signed_by": "engine:reader_b"},
            "ck_golden_corrections_signed_by_is_not_an_engine",
            id="a correction signed by an engine",
        ),
        pytest.param(
            {"value_after": "Lot 8"},
            "ck_golden_corrections_affirmation_leaves_the_value_alone",
            id="a confirm that quietly moved the value",
        ),
        pytest.param(
            {"value_after": None, "na_reason_after": "NOT_PRESENT"},
            "ck_golden_corrections_affirmation_leaves_the_value_alone",
            id="a confirm that moved the value to an absence",
        ),
        pytest.param(
            {"act": "correct"},
            "ck_golden_corrections_correction_moves_the_value",
            id="a correction that corrected nothing",
        ),
        pytest.param(
            {"tag_after": "suspect"},
            "ck_golden_corrections_confirm_lands_on_ruled",
            id="a confirm that did not land on ruled",
        ),
        pytest.param(
            {"act": "demote", "tag_after": "agreed"},
            "ck_golden_corrections_demote_lands_on_suspect",
            id="a demote that did not land on suspect",
        ),
        # `act="correct"` on both, so exactly ONE constraint is broken. With the
        # default `confirm`, a null on one side also breaks
        # `..._affirmation_leaves_the_value_alone`, PostgreSQL is free to report
        # either, and the test would be asserting which check it happened to
        # evaluate first.
        pytest.param(
            {"act": "correct", "value_before": None, "na_reason_before": None},
            "ck_golden_corrections_before_is_a_whole_truth",
            id="a transition out of a state the truth table cannot hold",
        ),
        pytest.param(
            {"act": "correct", "value_after": None, "na_reason_after": None},
            "ck_golden_corrections_after_is_a_whole_truth",
            id="a transition into a state the truth table cannot hold",
        ),
        pytest.param(
            {"revision_after": 0},
            "ck_golden_corrections_revision_after_is_positive",
            id="revision 0 is the establishment, not a correction",
        ),
    ],
)
def test_a_correction_that_breaks_a_refusal_rule_is_refused_by_name(
    overrides: dict[str, object], constraint: str, golden_engine: Engine
) -> None:
    """ "A golden correction needs a source, a reason and a signature" — as SQL.

    That rule has existed as `z.string().min(1)` in a browser schema and as a
    sentence in `CLAUDE.md`. A browser schema refuses nothing that does not go
    through the browser; these do.

    The transition cases are the endpoint docstrings turned into constraints.
    `POST /api/golden/{id}/confirm` says "the seed is right; tag upgrades to
    `ruled`" and "Both leave the value untouched" — so a confirm that landed
    somewhere else, or that moved the value, is refused by the database rather
    than by whoever reviews the handler.
    """
    with golden_engine.connect() as connection:
        order_id = _order_id(connection, TENANT)
        golden_field_id = uuid.UUID(
            str(
                connection.execute(
                    text(INSERT_GOLDEN), _golden_parameters(order_id=order_id)
                ).scalar_one()
            )
        )
        connection.commit()

    error = _refuses(
        golden_engine,
        INSERT_LEDGER,
        _ledger_parameters(golden_field_id=golden_field_id, **overrides),
    )
    _refusal_names(error, CHECK_VIOLATION_SQLSTATE, constraint)


# --- 3. the ledger is permanent ---------------------------------------------


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE golden_corrections SET reason = reason",
        "DELETE FROM golden_corrections",
        "TRUNCATE golden_corrections",
    ],
)
def test_the_correction_ledger_refuses_update_delete_and_truncate(
    statement: str, golden_engine: Engine
) -> None:
    """`0A000`, from the trigger, for the superuser — for whom no ACL is in the way.

    "Corrections are permanent" and "the correction lives in a row somebody can
    edit" cannot both be true. The `UPDATE` here is a zero-match one on purpose
    when the table is empty: `FOR EACH STATEMENT` is what makes it refused
    anyway, and a `FOR EACH ROW` trigger would be silent for exactly this case.
    """
    error = _refuses(golden_engine, statement, {})
    assert _sqlstate(error) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"{statement} returned {_sqlstate(error)!r} rather than the trigger's "
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE}: {error}"
    )
    assert "append-only" in str(error), (
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE} came back from something other than "
        f"the append-only trigger: {error}"
    )


def test_the_three_golden_triggers_are_enabled_always(golden_engine: Engine) -> None:
    """`tgenabled = 'A'` on all three, which is what `0004` had to add later.

    `'O'` is the `CREATE TRIGGER` default and does not fire under
    `session_replication_role = 'replica'` — `0004` measured a `DELETE 1` with no
    refusal at all on `audit_log`'s pair at `'O'`. These three are created at
    `'A'` and never spend a revision without it.

    `'D'` (disabled, fires never) and `'R'` (replica only) are the other ways this
    goes wrong, and both leave `tgtype` intact, so only a read of this column
    catches them.
    """
    with golden_engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT t.tgname, t.tgenabled FROM pg_trigger t "
                "JOIN pg_class c ON c.oid = t.tgrelid "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND NOT t.tgisinternal "
                "AND c.relname IN (:golden, :ledger)"
            ),
            {"golden": GOLDEN_TABLE, "ledger": LEDGER_TABLE},
        ).all()

    states = {str(name): str(enabled) for name, enabled in rows}
    assert states == {
        "golden_corrections_append_only": "A",
        "golden_corrections_no_truncate": "A",
        "golden_fields_ledger_required": "A",
    }, f"the golden triggers are not all ALWAYS-enabled: {states}"


# --- 4. a golden value moves only through a signed ledger row ----------------


def _establish(golden_engine: Engine) -> uuid.UUID:
    """One committed golden field for the tests that then try to move it."""
    with golden_engine.begin() as connection:
        order_id = _order_id(connection, TENANT)
        return uuid.UUID(
            str(
                connection.execute(
                    text(INSERT_GOLDEN), _golden_parameters(order_id=order_id)
                ).scalar_one()
            )
        )


def test_a_golden_value_cannot_move_without_a_ledger_row(golden_engine: Engine) -> None:
    """🔴 THE GAP `0072` CLOSES. An ordinary UPDATE, and no signature anywhere.

    Before that revision this statement succeeded and the permanent record simply
    had no row for it — a hole in the ledger, with nothing reporting the hole.
    """
    golden_field_id = _establish(golden_engine)

    error = _refuses(
        golden_engine,
        MOVE_GOLDEN,
        {
            "tenant": TENANT,
            "id": golden_field_id,
            "value": "Lot 8, Block 2",
            "tag": "ruled",
            "citation": "deed book 44, page 12",
            "revision": 1,
        },
    )
    assert _sqlstate(error) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"an unsigned change to ground truth returned {_sqlstate(error)!r}: {error}"
    )
    assert "signs this change" in str(error), (
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE} came back from something other than "
        f"the ledger requirement: {error}"
    )


def test_a_golden_value_moves_when_a_ledger_row_signs_exactly_that_change(
    golden_engine: Engine,
) -> None:
    """The positive control. Without it every refusal above is satisfied by a table
    that accepts no write at all.

    Ledger row FIRST, then the UPDATE, both in one transaction — the trigger sees
    the transaction's own uncommitted write, which is what makes "signed in the
    same unit of work" expressible without a second round trip.
    """
    golden_field_id = _establish(golden_engine)

    with golden_engine.begin() as connection:
        connection.execute(
            text(INSERT_LEDGER),
            _ledger_parameters(
                golden_field_id=golden_field_id,
                act="correct",
                value_after="Lot 8, Block 2",
                citation="deed book 44, page 12",
                tag_after="ruled",
            ),
        )
        connection.execute(
            text(MOVE_GOLDEN),
            {
                "tenant": TENANT,
                "id": golden_field_id,
                "value": "Lot 8, Block 2",
                "tag": "ruled",
                "citation": "deed book 44, page 12",
                "revision": 1,
            },
        )

    with golden_engine.connect() as connection:
        moved = connection.execute(
            text("SELECT value, tag, revision FROM golden_fields WHERE id = :id"),
            {"id": golden_field_id},
        ).one()

    assert tuple(moved) == ("Lot 8, Block 2", "ruled", 1), (
        f"the signed correction did not land: {tuple(moved)}"
    )


def test_a_ledger_row_that_signs_a_different_change_does_not_authorise_this_one(
    golden_engine: Engine,
) -> None:
    """A signature is for one transition, not for the field.

    The ledger row below signs a move to `Lot 8`; the UPDATE attempts `Lot 9`.
    Everything else matches — same field, same revision, same tag, same citation
    — so what refuses it is the value comparison and nothing else. That is the
    forgery the whole-transition match exists to catch: a signature obtained for
    one change, used to make another.
    """
    golden_field_id = _establish(golden_engine)

    with golden_engine.connect() as connection:
        connection.execute(
            text(INSERT_LEDGER),
            _ledger_parameters(
                golden_field_id=golden_field_id,
                act="correct",
                value_after="Lot 8, Block 2",
                citation="deed book 44, page 12",
                tag_after="ruled",
            ),
        )
        with pytest.raises(DBAPIError) as raised:
            connection.execute(
                text(MOVE_GOLDEN),
                {
                    "tenant": TENANT,
                    "id": golden_field_id,
                    "value": "Lot 9, Block 2",
                    "tag": "ruled",
                    "citation": "deed book 44, page 12",
                    "revision": 1,
                },
            )
        connection.rollback()

    assert _sqlstate(raised.value) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"a change the ledger row does not describe returned "
        f"{_sqlstate(raised.value)!r}: {raised.value}"
    )


def test_one_ledger_row_cannot_authorise_the_same_move_twice(golden_engine: Engine) -> None:
    """🔴 THE REPLAY. Without `revision`, a value could be walked A -> B -> A -> B
    forever on two signatures, each step matching a ledger row written once.

    Two things close it together and this test drives both. The trigger requires
    `revision = OLD.revision + 1`, so a second application of the same signature
    would have to be at revision 1 again and is not; and
    `uq_golden_corrections_tenant_id_golden_field_id_revision_after` refuses a
    SECOND ledger row at revision 1, so the obvious way round it is refused by the
    constraint rather than by the trigger.
    """
    golden_field_id = _establish(golden_engine)
    signed = _ledger_parameters(
        golden_field_id=golden_field_id,
        act="correct",
        value_after="Lot 8, Block 2",
        citation="deed book 44, page 12",
        tag_after="ruled",
    )
    move = {
        "tenant": TENANT,
        "id": golden_field_id,
        "value": "Lot 8, Block 2",
        "tag": "ruled",
        "citation": "deed book 44, page 12",
        "revision": 1,
    }

    with golden_engine.begin() as connection:
        connection.execute(text(INSERT_LEDGER), signed)
        connection.execute(text(MOVE_GOLDEN), move)

    # 🔴 REPLAYING THE UPDATE VERBATIM IS NOT THE ATTACK AND MUST NOT BE ASSERTED
    # AS ONE. The row is already at that value, tag, citation and revision, so the
    # statement moves nothing — the trigger's first branch returns without asking
    # for a signature, and no error comes back. That is correct: an UPDATE that
    # changes no truth needs no authorisation. Writing this test as "replay it and
    # expect a refusal" would have been a test that passes only because a no-op
    # was mistaken for a refusal.
    with golden_engine.begin() as connection:
        unchanged = connection.execute(text(MOVE_GOLDEN), move).rowcount
    assert unchanged == 1, "the no-op replay did not reach the row at all"

    # The attack is USING THE SPENT SIGNATURE FOR THE NEXT MOVE. It carries
    # `revision_after = 1`, and the row is now at 1, so the only change it could
    # authorise is one to revision 2 — which no ledger row describes.
    forward = {**move, "revision": 2, "value": "Lot 9, Block 2"}
    replayed = _refuses(golden_engine, MOVE_GOLDEN, forward)
    assert _sqlstate(replayed) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"a second move on a spent signature returned {_sqlstate(replayed)!r}: {replayed}"
    )

    # And the obvious way round that — write the signature again — is refused by
    # the unique constraint rather than by the trigger. Both halves are needed:
    # the trigger alone would accept a second ledger row at revision 2, and the
    # constraint alone would not stop a move nobody signed.
    duplicated = _refuses(golden_engine, INSERT_LEDGER, signed)
    assert _sqlstate(duplicated) == UNIQUE_VIOLATION_SQLSTATE, (
        f"a second ledger row at the same revision returned "
        f"{_sqlstate(duplicated)!r}, so one signature can be written twice: {duplicated}"
    )


# One whole statement per column rather than a column name interpolated into a
# template. The house rule from `0001` onward is one reviewable line per object,
# and here it also means no name is spliced into SQL at all.
@pytest.mark.parametrize(
    ("column", "statement"),
    [
        pytest.param(
            "path",
            "UPDATE golden_fields SET path = 'test.only.substituted' WHERE id = :id",
            id="path",
        ),
        pytest.param(
            "established_by",
            "UPDATE golden_fields SET established_by = 'somebody else' WHERE id = :id",
            id="established_by",
        ),
        pytest.param(
            "established_reason",
            "UPDATE golden_fields SET established_reason = 'another reason' WHERE id = :id",
            id="established_reason",
        ),
    ],
)
def test_the_immutable_columns_are_refused(
    column: str, statement: str, golden_engine: Engine
) -> None:
    """Re-pointing or re-signing an established truth is substitution, not correction.

    Changing `path` moves the claim to a different field under the signature
    given for the first one. Changing `established_by` or `established_reason`
    rewrites whose signature it was and what it was for. None of the three is a
    correction, and none has a ledger shape — the ledger records a change of
    VALUE and TAG on a field that stays the field it was.
    """
    golden_field_id = _establish(golden_engine)

    error = _refuses(golden_engine, statement, {"id": golden_field_id})
    assert _sqlstate(error) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"changing {column} returned {_sqlstate(error)!r}: {error}"
    )
    assert f"{GOLDEN_TABLE}.{column} is immutable" in str(error), (
        f"the refusal did not name {column}: {error}"
    )

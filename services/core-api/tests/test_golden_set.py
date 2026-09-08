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
  holds a column from both vocabularies. Both are live at 0102, so it now
  passes because the schema is right rather than because one side is empty, and
  the per-relation control inside it is what distinguishes those two;
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
from minimal_rows import insert_orders_returning
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

# `invalid_authorization_specification` — `0100`'s `resolve_actor` and `0102`'s
# signer check both raise it by name for "this identity does not resolve to an
# active seat". Asserted specifically rather than "something raised": a CHECK
# constraint answers `23514` and a bad enum label `22P02`, and either would read
# as proof that the signer check works.
NO_ACTOR_SQLSTATE = "28000"
FOREIGN_KEY_VIOLATION_SQLSTATE = "23503"
UNIQUE_VIOLATION_SQLSTATE = "23505"

# 🔴 SUBSTRINGS AND NOT A CLOSED LIST, BECAUSE THE CLOSED LIST HAD HOLES. It was
# `{engine_id, engine_version, engine_kind, confidence, model, model_version}`,
# and MEASURED against head 0102 that set misses three of the seven live
# engine-output columns: `fields.engine_confidence_raw`,
# `field_readings.confidence_raw` and `audit_log.engine_model_version`. An
# `engine_confidence_raw` landing on `golden_fields` was a place to record that a
# model produced a truth, and neither assertion below would have seen it.
#
# Every name in the old set contains one of these three fragments, so this is a
# STRICT SUPERSET of it — not a subset check standing in for a refusal. MEASURED
# on the live catalog at 0102: these three match exactly the seven real
# engine-output columns and nothing else, so the widening costs no false
# positive on today's schema.
ENGINE_OUTPUT_FRAGMENTS = ("engine", "confidence", "model")

# RESIDUAL, AND IT IS THE SAME SHAPE AS BEFORE, JUST SMALLER. A column spelled
# `reader_a_said` or `ocr_score` carries model output under a name with none of
# these fragments in it, and no catalog assertion could be written that would
# catch it. What is closed is the vocabulary this repository actually uses.

# The column names that mean "A PERSON ESTABLISHED THIS AS TRUTH". Three, on two
# tables, and the second table is the point: with only `golden_fields`' pair in
# here the schema-wide assertion below could match no relation but
# `golden_fields`, so it was exactly the `golden_fields`-only assertion that
# followed it — one test with one effective leg, which is how it read as
# passing while covering half of what it says.
#
# `golden_corrections.signed_by` belongs because `0102` treats it and
# `established_by` as one kind of thing: both must resolve to an active `users`
# seat. `intake_signoffs.signed_by` joins the population by name collision, and
# that is left in rather than special-cased — an engine column on a sign-off
# table would be a defect too.
#
# 🔴 `fields.approved_by` IS DELIBERATELY NOT HERE, AND IT IS THE ONE THAT LOOKS
# LIKE IT SHOULD BE. It means "a reviewer confirmed this reading", which is the
# review workflow and not ground truth; `fields` legitimately holds it beside
# `engine_id` and `engine_confidence_raw`. `audit_log.actor_*` is out for the
# same reason — the audit trail records WHICH ENGINE under WHOSE REQUEST and has
# to hold both. Adding either would make this test red on correct schema.
GOLDEN_TRUTH_COLUMNS = frozenset({"established_by", "established_reason", "signed_by"})

# What an `is_golden`-shaped discriminator would be called. The point of the
# assertion is the SHAPE — a boolean beside model output saying "this one is
# true" — so the names are matched rather than a specific one looked for.
GOLDEN_FLAG_COLUMNS = frozenset({"is_golden", "golden", "is_truth", "is_ground_truth"})

GOLDEN_TABLE = "golden_fields"
LEDGER_TABLE = "golden_corrections"

# The live engine-output columns at head 0102, and the live truth columns, named
# per relation. They are the POSITIVE CONTROL for the two closed-world tests
# below and not a schema inventory: both assert a NEGATIVE over a catalog read,
# and a read that returned nothing — wrong schema, `relkind` mistyped, a
# fragment retyped into something that matches no column — satisfies a negative
# and proves nothing. `>=` and not `==` so a legitimately added engine column is
# not a red here; growth on either side is the sweep's business.
LIVE_ENGINE_OUTPUT = {
    "fields": {"engine_id", "engine_confidence_raw"},
    "field_readings": {"engine_id", "engine_version", "confidence_raw"},
    "audit_log": {"engine_id", "engine_model_version"},
}
LIVE_GOLDEN_TRUTH = {
    GOLDEN_TABLE: {"established_by", "established_reason"},
    LEDGER_TABLE: {"signed_by"},
}


def _engine_output(names: frozenset[str]) -> set[str]:
    """The columns in `names` that mean "a machine produced this"."""
    return {name for name in names if any(part in name for part in ENGINE_OUTPUT_FRAGMENTS)}


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

# The two halves of the DELETE + re-INSERT transplant `0101` closes. Literal
# table names rather than f-strings, like every other statement in this module:
# ruff reads an interpolated identifier as an injection site whatever is being
# interpolated, and a constant that has to carry a suppression is a constant
# people stop reading.
DELETE_GOLDEN = "DELETE FROM golden_fields WHERE id = :id"

REINSERT_TRANSPLANTED = """
    INSERT INTO golden_fields
        (tenant_id, id, order_id, path, value, tag,
         source_citation, established_by, established_reason)
    VALUES
        (:tenant, :id, :order_id, 'test.only.transplanted', 'Lot 9',
         CAST('delivered_report' AS golden_tag), :citation, :signer, :reason)
"""

MOVE_GOLDEN = """
    UPDATE golden_fields
       SET value = :value, tag = CAST(:tag AS golden_tag),
           source_citation = :citation, revision = :revision
     WHERE tenant_id = :tenant AND id = :id
"""


# 🔴 THE SIGNER HAS TO BE A PERSON AS OF `0102`. `golden_fields.established_by`
# and `golden_corrections.signed_by` are resolved against `users` in the row's
# tenant and refused `28000` unless exactly one ACTIVE row carries that
# `identity_subject`. `'TEST-ONLY reviewer'` was a free-text signature and is now
# a subject that has to exist, so the fixture writes the person. The literal is
# unchanged, which keeps every parameter dictionary in this module reading the
# same way and keeps the value implausible on sight.
SIGNER = "TEST-ONLY reviewer"

SIGNER_SEED = (
    "INSERT INTO users "
    "(tenant_id, email, role, identity_provider, identity_subject) "
    "VALUES (:tenant, :email, 'reviewer', 'TEST-ONLY', :signer) "
    "ON CONFLICT DO NOTHING"
)


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
        "signer": SIGNER,
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
        "signed_by": SIGNER,
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
            # `minimal_rows` and not `INSERT INTO orders (tenant_id)`: `0008` gave
            # `orders` six more `NOT NULL` columns after this file was written, and
            # the merged chain is the first tree that holds both revisions.
            connection.execute(
                text(insert_orders_returning("id", "one", "two")),
                {"one": TENANT, "two": OTHER_TENANT},
            )
            # One seat per tenant, committed with the orders and for the same
            # reason: `0102` resolves the signer per row, and the cross-tenant
            # test needs the OTHER tenant to have a seat of its own so that its
            # refusal is about the ORDER and not about a missing person.
            for tenant in (TENANT, OTHER_TENANT):
                connection.execute(
                    text(SIGNER_SEED),
                    {
                        "tenant": tenant,
                        # Lower-case: `ck_users_email_is_lowercase` refuses
                        # anything else.
                        "email": f"test-only-{tenant}@test-only.invalid",
                        "signer": SIGNER,
                    },
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

    # `LIVE_GOLDEN_TRUTH[GOLDEN_TABLE]` and not the whole vocabulary: the
    # vocabulary now spans two golden tables, and `signed_by` is on the ledger.
    # This control read `>= GOLDEN_TRUTH_COLUMNS` and went red the moment
    # `signed_by` joined the set, which is the control working.
    assert columns[GOLDEN_TABLE] >= LIVE_GOLDEN_TRUTH[GOLDEN_TABLE], (
        f"the catalog read itself has moved: {GOLDEN_TABLE} does not report "
        f"{sorted(LIVE_GOLDEN_TRUTH[GOLDEN_TABLE])}, so the negative above read "
        f"an empty schema and means nothing. It reports "
        f"{sorted(columns.get(GOLDEN_TABLE, ()))}"
    )


def test_golden_and_engine_vocabularies_never_meet_in_one_relation(
    golden_engine: Engine,
) -> None:
    """No relation holds a column from both vocabularies.

    A golden row cannot record which engine produced it, and an engine reading
    cannot record who established it. `promote this reading to truth` therefore
    has no shape: it would have to be a person typing the value with a citation
    and a reason, which is an ordinary establishment.

    🔴 THIS ASSERTION USED TO HAVE NOTHING TO CATCH, AND THEN STOPPED SAYING SO.
    The version before this one recorded that `field_readings` "carries only
    `line_coords`" and that `engine_id` and `engine_version` were another
    worker's revision. `0032` landed them, so both vocabularies are live now and
    the intersection is empty because the schema is right rather than because
    one side of it is empty. The control below is what says which of those two
    it is.

    IT ALSO COULD NOT FAIL ON ITS OWN TERMS. `GOLDEN_TRUTH_COLUMNS` was two
    names on one table, so the schema-wide sweep could only ever flag
    `golden_fields`, which is what the assertion after it checked directly — one
    test, one effective leg, reading as two. `signed_by` puts a second golden
    table and a third relation in the sweep's population, and the engine
    vocabulary is now fragments rather than a list with three live columns
    missing from it. See both constants for the measurements.
    """
    with golden_engine.connect() as connection:
        columns = _columns_by_relation(connection)

    for relation, expected in LIVE_ENGINE_OUTPUT.items():
        assert _engine_output(columns[relation]) >= expected, (
            f"the catalog read or the engine vocabulary has moved: {relation} "
            f"reports {sorted(_engine_output(columns[relation]))}, not at least "
            f"{sorted(expected)}. The sweep below is a negative and would pass "
            f"on an empty read."
        )
    for relation, expected in LIVE_GOLDEN_TRUTH.items():
        assert columns[relation] & GOLDEN_TRUTH_COLUMNS >= expected, (
            f"the catalog read or the truth vocabulary has moved: {relation} "
            f"reports {sorted(columns[relation] & GOLDEN_TRUTH_COLUMNS)}, not at "
            f"least {sorted(expected)}. With one of these two empty the sweep "
            f"below narrows to the other table and stops being schema-wide."
        )

    both = sorted(
        f"{relation}: {sorted(names & GOLDEN_TRUTH_COLUMNS)} beside {sorted(_engine_output(names))}"
        for relation, names in columns.items()
        if names & GOLDEN_TRUTH_COLUMNS and _engine_output(names)
    )
    assert both == [], (
        "a relation holds both a golden-truth column and an engine-output "
        "column. Ground truth and model output in one row is what the separate "
        "tables exist to prevent, and on a golden table it is a place to record "
        f"that a model produced a truth: {both}"
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
    identifies nobody, returning 201 — and the engine namespace.

    🔴 THE ENGINE NAMESPACE REFUSES A SPELLING NOTHING IN THIS REPOSITORY
    PRODUCES, AND THESE TWO CASES ARE THE ONLY PLACE `engine:` APPEARS AT ALL.
    Live engine ids are BARE: `packages/mocks/src/handlers.ts` ships
    `gemini-2.5-flash`, `llmwhisperer-hq`, `tesseract` and `pdftotext`, and a
    process signing as itself writes one of those. `established_by =
    'tesseract'` passes `established_by_is_not_an_engine` — it is not a `23514`,
    it never was, and this pair of cases has never been evidence that it would
    be. What actually refuses it is `0102`: `established_by` and `signed_by`
    must resolve to an active `users` seat, so `tesseract` is `28000` unless
    somebody created a seat for it. THAT is the machine.

    These two cases stay because the namespace is still a real constraint and a
    row that DOES arrive spelled `engine:tesseract` is still refused by it — but
    it is the weaker leg, and reading them as the guard against a machine signer
    is how `0102`'s defect stayed open through 41 green golden tests. Closing
    the gap for real would mean `NOT LIKE` on the live engine ids, which is a
    list that has to agree with a table nothing here can see; the seat lookup
    is the answer that does not need that list.

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


def test_the_golden_triggers_are_enabled_always(golden_engine: Engine) -> None:
    """`tgenabled = 'A'` on all five, which is what `0004` had to add later.

    `'O'` is the `CREATE TRIGGER` default and does not fire under
    `session_replication_role = 'replica'` — `0004` measured a `DELETE 1` with no
    refusal at all on `audit_log`'s pair at `'O'`. These are created at `'A'` and
    never spend a revision without it.

    `'D'` (disabled, fires never) and `'R'` (replica only) are the other ways
    this goes wrong, and both leave `tgtype` intact, so only a read of this
    column catches them.

    🔴 AND THERE IS A FOURTH WAY THIS GOES WRONG THAT THIS TEST CANNOT SEE, WHICH
    IS WHY ITS OLD NAME WAS A PROMISE IT DID NOT KEEP. `CREATE OR REPLACE
    FUNCTION golden_fields_require_ledger() ... BEGIN RETURN NULL; END` removes
    `0072`'s entire guarantee and leaves `tgenabled` at `'A'`, `tgtype` at `17`
    and `proname` unchanged — every character this query reads is identical
    afterwards. `tests/test_trigger_function_bodies.py` is the machine for that
    case; this one is now explicitly the CATALOG half and says so in its name and
    here, rather than reading as the whole story.

    Five and no longer three: `0101` adds `golden_fields_no_delete` and
    `golden_fields_no_truncate`, and `0102` adds the two signer triggers. The set
    is exact in both directions, so a sixth arrives as a diff somebody reads.
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
        "golden_corrections_signer_is_a_person": "A",
        "golden_fields_ledger_required": "A",
        "golden_fields_no_delete": "A",
        "golden_fields_no_truncate": "A",
        "golden_fields_signer_is_a_person": "A",
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


# --- 6. the ways around the immutable columns, closed ------------------------


@pytest.mark.parametrize(
    ("verb", "statement"),
    [
        ("DELETE", DELETE_GOLDEN),
        # A zero-MATCH delete, which is the case a `FOR EACH ROW` trigger is
        # SILENT for. `0001` records the same reasoning for `audit_log`: a
        # statement that removes nothing and raises nothing is indistinguishable
        # at the client from a refusal that did not happen.
        ("DELETE matching nothing", "DELETE FROM golden_fields WHERE false"),
        ("TRUNCATE", "TRUNCATE golden_fields CASCADE"),
    ],
)
def test_a_golden_field_cannot_be_removed(verb: str, statement: str, golden_engine: Engine) -> None:
    """🔴 THE WAY AROUND `0072`, WHICH HELD SEVEN COLUMNS AGAINST *UPDATE* ONLY.

    `0072`'s trigger is `AFTER UPDATE`, and an `AFTER UPDATE` trigger cannot see
    a DELETE. Measured before `0101`: delete the row, insert it again with the
    same `id` and the same `created_at` and a different `order_id`, and all seven
    "immutable" columns have moved without any UPDATE running — and without the
    ledger being consulted, because a fresh row starts at `revision = 0` and
    revision 0 IS the establishment.

    `golden_engine` is the CONTAINER SUPERUSER, which is the strongest identity
    available to this suite. The refusal is a trigger and applies to it as
    readily as to `titlepipe_app`, which holds no `DELETE` grant anyway — so
    running this as the superuser is what distinguishes "the trigger refuses"
    from "the ACL refuses", and only the first is `0101`'s claim.
    """
    golden_field_id = _establish(golden_engine)

    error = _refuses(golden_engine, statement, {"id": golden_field_id})
    assert _sqlstate(error) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"{verb} on {GOLDEN_TABLE} returned {_sqlstate(error)!r} rather than "
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE!r}. A code of None means it SUCCEEDED, "
        f"and a succeeding DELETE is the whole bypass: {error}"
    )
    assert "is not deletable" in str(error), (
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE} came from something other than "
        f"{GOLDEN_TABLE}'s removal trigger: {error}"
    )


def test_the_delete_and_reinsert_transplant_is_refused_at_the_delete(
    golden_engine: Engine,
) -> None:
    """The exploit as one transaction, from the top, ending where it should.

    The parametrised test above proves DELETE is refused. This one proves the
    SEQUENCE the finding actually used is stopped, which is a different claim: a
    reader who only saw a `DELETE` refusal could reasonably ask whether the
    transplant had some other route into the same state.

    The second half — re-inserting the same `id` with a re-pointed `order_id` —
    is deliberately still written out, and is unreachable. If a later revision
    ever relaxes the DELETE refusal, this test fails on the DELETE line rather
    than passing quietly with the exploit's tail never exercised.
    """
    golden_field_id = _establish(golden_engine)
    with golden_engine.connect() as connection:
        other_order = _order_id(connection, OTHER_TENANT)

    error = _refuses(golden_engine, DELETE_GOLDEN, {"id": golden_field_id})

    assert _sqlstate(error) == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"the transplant's DELETE was not refused: {_sqlstate(error)!r} {error}"
    )
    assert "is not deletable" in str(error), error

    # THE SECOND HALF, WRITTEN OUT AND NEVER RUN. `REINSERT_TRANSPLANTED` is the
    # statement the finding used once the row was gone: the same `id`, the OTHER
    # tenant's `order_id`, and a fresh `revision` of 0 so that no ledger row is
    # required. It is a module constant rather than a comment so a reader can see
    # exactly what is prevented, and the assertion above is what keeps it
    # unreachable — a DELETE that stops being refused fails at the step that has
    # to hold rather than somewhere downstream of a state this suite could then
    # no longer construct.
    assert ":order_id" in REINSERT_TRANSPLANTED, (
        "the documented second half of the transplant no longer re-points "
        "order_id, so it is no longer the exploit this test is about"
    )
    assert other_order != golden_field_id, "the other tenant's order is a distinct row"


# --- 7. a signature names a person -------------------------------------------


@pytest.mark.parametrize(
    "signer",
    [
        # 🔴 THE EXACT STRING FROM THE FINDING. One INSERT..SELECT as
        # `titlepipe_app` moved a 0.20-confidence reading out of `field_readings`
        # into the golden set under this name, tagged `agreed`, cited to the
        # engine's own OCR snippet — every constraint satisfied, all 41 golden
        # tests green — and a correctly written leaderboard then reported those
        # readers as 100.0% accurate against truth they had written themselves.
        "accuracy-backfill",
        # The shapes the same defect arrives in when somebody is being tidier
        # about it. None is a person; each passes `established_by_is_signed` and
        # `established_by_is_not_an_engine`.
        "ops-team",
        "svc_golden_importer",
        "migration 0070 backfill",
    ],
)
def test_a_golden_field_cannot_be_signed_by_something_that_is_not_a_person(
    signer: str, golden_engine: Engine
) -> None:
    """`0070`'s two checks asked the wrong question; `0102` asks the right one.

    `established_by_is_signed` refuses `''` and `'unknown'`.
    `established_by_is_not_an_engine` refuses the `engine:` namespace. Both were
    satisfied by `'accuracy-backfill'`, because neither asks whether there is a
    person here at all.

    The refusal is `28000` and not `23514`, and the difference is the mechanism
    rather than a preference: this is not a shape a CHECK constraint can express.
    It is a lookup against another table, in the row's own tenant, filtered by
    `deactivated_at` — and `0100` already had the function for it.
    """
    with golden_engine.connect() as connection:
        order_id = _order_id(connection, TENANT)

    error = _refuses(
        golden_engine, INSERT_GOLDEN, _golden_parameters(order_id=order_id, signer=signer)
    )
    assert _sqlstate(error) == NO_ACTOR_SQLSTATE, (
        f"a golden field signed {signer!r} was refused with {_sqlstate(error)!r} "
        f"rather than {NO_ACTOR_SQLSTATE!r}. A code of None means it was "
        f"ACCEPTED, which is the promotion this test exists for: {error}"
    )
    assert "is not an active seat of this tenant" in str(error), (
        f"the refusal came from something other than the signer check: {error}"
    )


def test_a_correction_cannot_be_signed_by_something_that_is_not_a_person(
    golden_engine: Engine,
) -> None:
    """The ledger half, because `0072` makes the ledger the ONLY way a value moves.

    A signer check on `golden_fields` alone would leave the whole correction path
    signable by a job name: `0072` requires a `golden_corrections` row to
    authorise every UPDATE, and that row carries its own `signed_by`. Closing one
    and not the other would move the defect rather than fix it.
    """
    golden_field_id = _establish(golden_engine)

    error = _refuses(
        golden_engine,
        INSERT_LEDGER,
        _ledger_parameters(golden_field_id=golden_field_id, signed_by="accuracy-backfill"),
    )
    assert _sqlstate(error) == NO_ACTOR_SQLSTATE, (
        f"a correction signed 'accuracy-backfill' returned {_sqlstate(error)!r}: {error}"
    )
    assert "is not an active seat of this tenant" in str(error), error


def test_a_deactivated_signer_cannot_establish(golden_engine: Engine) -> None:
    """A retired seat is still a row, and `0102` reads `deactivated_at`.

    `0020` grants no `DELETE` on `users` and says why — "a deleted user row is a
    record that an audit row then names nobody for" — so the row for somebody who
    left is permanent. A check that asked only "does this subject exist" would
    let a departed employee go on establishing ground truth forever.
    """
    departed = "TEST-ONLY departed"
    with golden_engine.begin() as connection:
        order_id = _order_id(connection, TENANT)
        connection.execute(
            text(SIGNER_SEED),
            {
                "tenant": TENANT,
                "email": "test-only-departed@test-only.invalid",
                "signer": departed,
            },
        )
        connection.execute(
            text(
                "UPDATE users SET deactivated_at = now() "
                "WHERE tenant_id = :tenant AND identity_subject = :signer"
            ),
            {"tenant": TENANT, "signer": departed},
        )

    error = _refuses(
        golden_engine, INSERT_GOLDEN, _golden_parameters(order_id=order_id, signer=departed)
    )
    assert _sqlstate(error) == NO_ACTOR_SQLSTATE, (
        f"a deactivated seat established a golden field: {_sqlstate(error)!r} {error}"
    )


def test_a_signer_from_another_tenant_cannot_establish_here(golden_engine: Engine) -> None:
    """Tenancy, on the signature itself.

    The `users` row exists and is active — in the OTHER tenant. `0102` resolves
    against `NEW.tenant_id`, so a real, current colleague of another customer is
    not a signer here, and the refusal is the same one a fictional name gets.
    """
    outsider = "TEST-ONLY outsider"
    with golden_engine.begin() as connection:
        order_id = _order_id(connection, TENANT)
        connection.execute(
            text(SIGNER_SEED),
            {
                "tenant": OTHER_TENANT,
                "email": "test-only-outsider@test-only.invalid",
                "signer": outsider,
            },
        )

    error = _refuses(
        golden_engine, INSERT_GOLDEN, _golden_parameters(order_id=order_id, signer=outsider)
    )
    assert _sqlstate(error) == NO_ACTOR_SQLSTATE, (
        f"another tenant's seat established a golden field here: {_sqlstate(error)!r} {error}"
    )


def test_a_named_person_can_still_promote_an_engine_reading(golden_engine: Engine) -> None:
    """🔴 THIS TEST PASSES WHEN THE PROMOTION SUCCEEDS, AND THAT IS DELIBERATE.

    `0102`'s docstring says what it does and does not buy, and this is the second
    half as a machine. A real, active, seat-holding person can still take an
    engine's 0.20-confidence reading, cite the engine's own OCR snippet, and
    establish it as ground truth under their own name.

    What `0102` changed is that the record then names somebody who can be asked,
    instead of a job that cannot. It is a smaller property than "engine output
    cannot become ground truth" and this suite will not report the larger one.

    WHEN THIS GOES RED, READ WHAT CHANGED. Red means a citation is now anchored
    to a document rather than to a string — page id plus bounding box, verified
    against `pages` — which is the thing that would actually close it. Then
    delete this test and correct `0102`'s docstring, which currently says the
    opposite.
    """
    with golden_engine.connect() as connection:
        order_id = _order_id(connection, TENANT)

    with golden_engine.connect() as connection:
        established = connection.execute(
            text(INSERT_GOLDEN),
            _golden_parameters(
                order_id=order_id,
                tag="agreed",
                # The engine's own output, in both the value and the citation.
                value="Lot 7, Block 2",
                citation="reader_a OCR snippet, confidence 0.20",
            ),
        ).scalar_one()
        connection.rollback()

    assert established is not None, (
        "a signed promotion of an engine reading was REFUSED, so this residual "
        "has been closed since the test was written. Read what changed before "
        "editing anything: if source_citation is now anchored to a page and a "
        "bounding box, delete this test and correct 0102's docstring. Do not "
        "'fix' this test to match."
    )

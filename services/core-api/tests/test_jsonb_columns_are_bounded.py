"""Every `jsonb` column is an OBJECT and has a ceiling, and the database says so.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS. Four `jsonb` columns, no CHECK on any of them, and no
   size bound anywhere in the schema — the only limit this system had was
   `MAX_PAGE_SIZE = 200`, which bounds a ROW COUNT and says nothing about what
   a row weighs. `0001` raised the first half in the column it created ("`jsonb`
   with no CHECK accepts arrays, strings, numbers and `null` as readily as
   objects … there is none in the skeleton") and did not raise the second.
---------------------------------------------------------------------------

## Everything here connects as the container SUPERUSER

`test_field_citation_is_whole.py`'s reason: a superuser bypasses row-level
security unconditionally, which is wrong for an isolation proof and right for a
constraint proof. Nothing in this file is an isolation claim, so a refusal that
comes back here can only be the CHECK.

## Both copies of the expression are pinned, because nothing else compares them

`0112` repeats `db/models/jsonb.bounded_jsonb_object`'s expression rather than
importing it — a migration is a frozen snapshot — and **`alembic check` does not
compare CHECK constraints at all**, the same blind spot `test_schema_migration
.py` records for enum labels. So `test_the_four_constraints_read_back_exactly_as
_written` pins the LIVE text as literals, which catches an edit to the migration,
and `test_the_model_helper_writes_exactly_this_expression` pins the model's, which
catches an edit to the other copy. Reading either one back from the constant
under test would pin nothing — that measurement is
`test_schema_migration.py::test_na_reason_has_exactly_four_labels_in_exactly_this
_order`'s, and it is why both assertions below are written out by hand.

## What was watched go RED, and against what

Run against the schema BEFORE `0112` — the revision's `upgrade()` emptied, the
rest of the file untouched — **25 of the 27 tests failed**:

* all 20 `test_a_non_object_is_refused` cases (five values by four columns) and
  all 4 `test_a_value_over_the_ceiling_is_refused` cases, every one with `DID NOT
  RAISE <class 'sqlalchemy.exc.DBAPIError'>`. An 8 MiB payload went into
  `clients.delivery_config` and stayed there;
* `test_the_four_constraints_read_back_exactly_as_written`, naming all four as
  missing.

TWO PASSED, and which two is the useful half of the measurement.
`test_an_ordinary_object_is_accepted` and `test_a_sql_null_is_still_accepted
_where_the_column_is_nullable` passed there and here — which is what says `0112`
refuses the wrong shape ONLY, and is why they are not redundant.
`test_the_model_helper_writes_exactly_this_expression` also passed, correctly: it
pins the OTHER copy of the expression and the mutation was to the migration. Its
own red is the MIRRORED mutation, run separately: `MAX_JSONB_BYTES` changed to
131072 in `base.py` and the migration left alone failed exactly ONE test — that
one. Every other test here reads the database, which the model does not build.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator, Mapping

import pytest
from minimal_rows import insert_orders_returning
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

from titlepipe_core.db.models import MAX_JSONB_BYTES, bounded_jsonb_object

CHECK_VIOLATION_SQLSTATE = "23514"

TENANT = uuid.UUID("cccccccc-0000-4000-8000-00000000000c")

# `pg_get_constraintdef` for the four, verbatim from a migrated database.
# PostgreSQL normalises what it was given — the `::text` casts and the extra
# parentheses are its spelling, not `0112`'s — so this is the LIVE definition and
# not a copy of the migration's source.
EXPECTED_DEFINITIONS: Mapping[str, str] = {
    "ck_clients_delivery_config_is_a_bounded_object": (
        "CHECK (((delivery_config IS NULL) OR ((jsonb_typeof(delivery_config) = "
        "'object'::text) AND (pg_column_size(delivery_config) <= 65536))))"
    ),
    "ck_fields_source_line_coords_is_a_bounded_object": (
        "CHECK (((source_line_coords IS NULL) OR ((jsonb_typeof(source_line_coords) = "
        "'object'::text) AND (pg_column_size(source_line_coords) <= 65536))))"
    ),
    "ck_field_readings_line_coords_is_a_bounded_object": (
        "CHECK (((line_coords IS NULL) OR ((jsonb_typeof(line_coords) = "
        "'object'::text) AND (pg_column_size(line_coords) <= 65536))))"
    ),
    # No `IS NULL` arm: `procrastinate_jobs.args` is `NOT NULL DEFAULT '{}'`.
    "ck_procrastinate_jobs_args_is_a_bounded_object": (
        "CHECK (((jsonb_typeof(args) = 'object'::text) AND (pg_column_size(args) <= 65536)))"
    ),
}

# The values a `jsonb` column accepted before `0112`. `'null'::jsonb` is the JSON
# null and NOT a SQL NULL — `jsonb_typeof` calls it `'null'`, so it is refused
# here while a SQL NULL stays legal on the three nullable columns. Keeping both
# in one list is the point: they are the two absences this schema refuses to
# collapse, one table over from `na_reason`.
NON_OBJECTS = ("[1, 2, 3]", '"a string"', "42", "true", "null")

# 8 MiB of one repeated byte inside an object. Compressible to almost nothing on
# disk, which is why the constraint reads `pg_column_size` on the tuple BEFORE
# TOAST rather than anything derived from storage — `0112` carries the
# measurement.
OVERSIZE = "jsonb_build_object('a', repeat('a', 8 * 1024 * 1024))"

LEGAL_OBJECT = '{"page": 3, "x0": 0.11, "y0": 0.42, "x1": 0.87, "y1": 0.46}'


@pytest.fixture(scope="module")
def bounded_engine(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> Iterator[Engine]:
    """A superuser engine with one order, one field and one reading committed.

    Committed rather than rolled back because each test opens its own connection,
    and every column under test except `clients.delivery_config` and
    `procrastinate_jobs.args` sits on a table with a composite foreign key that
    needs a visible parent in the same tenant.

    The `field_readings` row is written with `line_coords` NULL. Its
    `ck_field_readings_coords_declare_their_space` makes `line_coords` and
    `line_coords_space` one fact, so every statement below that sets one sets
    both — a test that forgot would come back `23514` naming the WRONG
    constraint, which is the failure this file is least able to notice.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            connection.execute(text(insert_orders_returning("id", "only")), {"only": TENANT})
            order_id = connection.execute(
                text("SELECT id FROM orders WHERE tenant_id = :tenant"), {"tenant": TENANT}
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO fields (tenant_id, order_id, path, state) "
                    "VALUES (:tenant, :order_id, 'test.only.bounded', 'pending')"
                ),
                {"tenant": TENANT, "order_id": order_id},
            )
            field_id = connection.execute(
                text("SELECT id FROM fields WHERE tenant_id = :tenant"), {"tenant": TENANT}
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO field_readings "
                    "(tenant_id, field_id, engine_id, engine_version, cost_usd, latency_ms) "
                    "VALUES (:tenant, :field_id, 'TEST-ONLY', '0', 0, 0)"
                ),
                {"tenant": TENANT, "field_id": field_id},
            )
        yield engine
    finally:
        engine.dispose()


def _parent_id(connection: Connection, table: str) -> uuid.UUID:
    """The one row this module wrote into `table`.

    One statement per table rather than a name interpolated into a template:
    `test_golden_set.py` states the house rule, and here it also means no
    identifier is spliced into SQL at all.
    """
    statements = {
        "orders": "SELECT id FROM orders WHERE tenant_id = :tenant",
        "fields": "SELECT id FROM fields WHERE tenant_id = :tenant",
    }
    return uuid.UUID(
        str(connection.execute(text(statements[table]), {"tenant": TENANT}).scalar_one())
    )


def _writes(value_expression: str) -> Mapping[str, str]:
    """One INSERT per jsonb column, each putting `value_expression` in it.

    The four are spelled out rather than generated, for `0001`'s house rule of
    one reviewable statement per object — and because they genuinely differ:
    two need a parent read out of the same tenant, one is a vendored queue table
    with its own required columns, and `field_readings` has to declare the
    coordinate SPACE alongside the coordinates or a different constraint fires.

    `space` tracks the value rather than being a constant, because
    `ck_field_readings_coords_declare_their_space` makes the two columns ONE
    fact: `num_nonnulls(line_coords, line_coords_space) IN (0, 2)`. A fixed
    `'pdf_points'` beside a NULL is a legitimate refusal by a DIFFERENT
    constraint — measured on this tree, and it is what the acceptance test for
    the absent case caught.

    🔴 `S608` IS SUPPRESSED ON ALL FOUR, AND THE CLAIM IS CHECKABLE RATHER THAN
    ASSERTED, which is the standard `minimal_rows.insert_orders_returning` sets.
    `value_expression` is only ever a module-level literal of this file —
    `NON_OBJECTS`, `OVERSIZE`, `LEGAL_OBJECT` or `"NULL"` — and `space` is one of
    two literals decided one line above. Nothing caller-supplied and nothing from
    the database reaches these strings. Every value that VARIES (`tenant`,
    `order_id`, `field_id`) stays a bind parameter and never touches them.
    """
    space = "NULL" if value_expression == "NULL" else "'pdf_points'"
    return {
        "clients.delivery_config": (
            "INSERT INTO clients (tenant_id, name, delivery_method, report_shape, "  # noqa: S608
            "delivery_config) VALUES (:tenant, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY', "
            f"{value_expression})"
        ),
        "fields.source_line_coords": (
            "INSERT INTO fields (tenant_id, order_id, path, state, source_line_coords) "  # noqa: S608
            "VALUES (:tenant, :order_id, 'test.only.' || gen_random_uuid(), 'pending', "
            f"{value_expression})"
        ),
        "field_readings.line_coords": (
            "INSERT INTO field_readings (tenant_id, field_id, engine_id, engine_version, "  # noqa: S608
            "cost_usd, latency_ms, attempt_ordinal, line_coords, line_coords_space) "
            "VALUES (:tenant, :field_id, 'TEST-ONLY', '0', 0, 0, "
            f"nextval('test_only_attempt'), {value_expression}, {space})"
        ),
        "procrastinate_jobs.args": (
            "INSERT INTO procrastinate_jobs (queue_name, task_name, args) "  # noqa: S608
            f"VALUES ('test-only', 'test-only', {value_expression})"
        ),
    }


COLUMNS = tuple(_writes("NULL"))


def _run(engine: Engine, statement: str) -> None:
    """Execute one write with whatever parents it needs bound, then roll back.

    The rollback is what lets every test share one module-scoped database. Both
    parent ids are bound unconditionally: an unused bind parameter in a `text()`
    construct is ignored, and branching on which statement wants which would put
    the mapping in two places.
    """
    with engine.connect() as connection:
        connection.execute(
            text(statement),
            {
                "tenant": TENANT,
                "order_id": _parent_id(connection, "orders"),
                "field_id": _parent_id(connection, "fields"),
            },
        )
        connection.rollback()


def _refuses(engine: Engine, statement: str) -> DBAPIError:
    """`_run`, but the statement must raise, and the error comes back."""
    with pytest.raises(DBAPIError) as raised:
        _run(engine, statement)
    return raised.value


def _assert_refused_by(error: DBAPIError, column: str) -> None:
    """`23514`, AND from this column's constraint and not a neighbour's.

    `field_readings` carries five CHECK constraints and `fields` four, so a row
    that was wrong in some other way answers `23514` identically and would
    satisfy a test that read only the SQLSTATE.
    """
    expected = f"ck_{column.replace('.', '_')}_is_a_bounded_object"
    sqlstate = getattr(error.orig, "sqlstate", None)
    assert sqlstate == CHECK_VIOLATION_SQLSTATE, (
        f"expected {CHECK_VIOLATION_SQLSTATE} from {expected}, got {sqlstate!r}: {error}"
    )
    assert expected in str(error), (
        f"{CHECK_VIOLATION_SQLSTATE} came back, but not from {expected} — a "
        f"refusal for the wrong reason is not this constraint working: {error}"
    )


@pytest.fixture(scope="module", autouse=True)
def attempt_ordinal_sequence(bounded_engine: Engine) -> Iterator[None]:
    """A counter for `field_readings.attempt_ordinal`.

    `uq_field_readings_one_answer_per_engine_version_attempt` makes
    `(tenant_id, field_id, engine_id, engine_version, attempt_ordinal)` the
    table's natural key, and this module writes many readings for one field. A
    fixed ordinal is `23505` on the second one — and a unique violation on a
    statement that was SUPPOSED to be refused by a CHECK would pass
    `pytest.raises(DBAPIError)` and fail `_assert_refused_by` several tests away
    from the reason. A SEQUENCE and not a Python counter because the value has to
    survive the rollback that every write here ends with.
    """
    with bounded_engine.begin() as connection:
        connection.execute(text("CREATE SEQUENCE test_only_attempt START 2"))
    yield
    with bounded_engine.begin() as connection:
        connection.execute(text("DROP SEQUENCE test_only_attempt"))


def test_the_four_constraints_read_back_exactly_as_written(bounded_engine: Engine) -> None:
    """The live `pg_get_constraintdef` for all four, against literals.

    This is the only thing comparing `0112` to the database it produced —
    `alembic check` does not look at CHECK constraints. Written out rather than
    rebuilt from the migration for `test_schema_migration.py`'s measured reason:
    an expectation derived from the thing under test moves whenever it moves.
    """
    with bounded_engine.connect() as connection:
        found = {
            str(name): str(definition)
            for name, definition in connection.execute(
                text(
                    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
                    "WHERE conname LIKE '%is\\_a\\_bounded\\_object'"
                )
            ).all()
        }

    assert found == dict(EXPECTED_DEFINITIONS), (
        f"the bounded-object constraints in the database are not the four this "
        f"file pins. Missing: {sorted(set(EXPECTED_DEFINITIONS) - set(found))}; "
        f"unexpected: {sorted(set(found) - set(EXPECTED_DEFINITIONS))}; differing: "
        f"{sorted(n for n in found.keys() & EXPECTED_DEFINITIONS.keys() if found[n] != EXPECTED_DEFINITIONS[n])}"
    )


def test_the_model_helper_writes_exactly_this_expression() -> None:
    """The OTHER copy, pinned the same way and for the same reason.

    `0112` repeats this expression because a migration is a frozen snapshot, so
    an edit to one copy is invisible to every other gate in the repository. The
    test above catches an edit to the migration; this one catches an edit here.
    """
    assert MAX_JSONB_BYTES == 65536, (
        "the ceiling is a contract with the read path, not a variable. "
        "MAX_PAGE_SIZE=200 rows times this number is the largest response this "
        "schema permits; changing it silently changes that arithmetic."
    )
    assert str(bounded_jsonb_object("delivery_config", nullable=True).sqltext) == (
        "delivery_config IS NULL OR (jsonb_typeof(delivery_config) = 'object' "
        "AND pg_column_size(delivery_config) <= 65536)"
    )
    assert str(bounded_jsonb_object("args", nullable=False).sqltext) == (
        "jsonb_typeof(args) = 'object' AND pg_column_size(args) <= 65536"
    )
    assert bounded_jsonb_object("args", nullable=False).name == "args_is_a_bounded_object", (
        "the BARE rule name, because `ck_%(table_name)s_%(constraint_name)s` is "
        "what the convention prefixes it with. 0111 measured what a full name "
        "produces: ck_<table>_ck_<table>_… truncated to 63 with a hash suffix."
    )


@pytest.mark.parametrize("column", COLUMNS)
@pytest.mark.parametrize("value", NON_OBJECTS)
def test_a_non_object_is_refused(bounded_engine: Engine, column: str, value: str) -> None:
    """An array, a string, a number, a boolean and the JSON `null`.

    `0001` names exactly this set as what a `jsonb` column with no CHECK accepts,
    and says the constraint is what would make it impossible. This is that
    constraint, on all four columns.
    """
    error = _refuses(bounded_engine, _writes(f"'{value}'::jsonb")[column])
    _assert_refused_by(error, column)


@pytest.mark.parametrize("column", COLUMNS)
def test_a_value_over_the_ceiling_is_refused(bounded_engine: Engine, column: str) -> None:
    """8 MiB inside an object — the right SHAPE, and far past the ceiling.

    The value compresses to almost nothing on disk, so a bound read off a stored
    datum would have admitted it. A CHECK is evaluated before TOAST compression,
    which is what makes `pg_column_size` here the uncompressed size an attacker
    controls; `0112` carries the measurement.
    """
    error = _refuses(bounded_engine, _writes(OVERSIZE)[column])
    _assert_refused_by(error, column)


@pytest.mark.parametrize("column", COLUMNS)
def test_an_ordinary_object_is_accepted(bounded_engine: Engine, column: str) -> None:
    """🔴 THE POSITIVE CONTROL. Without it a constraint refusing EVERY value
    would satisfy every test above.

    A real coordinate object, measured at 97 bytes by `pg_column_size` — roughly
    450x inside the ceiling, which is the headroom `0112` claims.
    """
    _run(bounded_engine, _writes(f"'{LEGAL_OBJECT}'::jsonb")[column])


@pytest.mark.parametrize("column", [name for name in COLUMNS if not name.startswith("procr")])
def test_a_sql_null_is_still_accepted_where_the_column_is_nullable(
    bounded_engine: Engine, column: str
) -> None:
    """The absence stays legal, and it is not the same absence as `'null'::jsonb`.

    `0080` and `db/models/fields.py` both argue the point in the columns' own
    words: a client with no per-method configuration HAS none, and an engine
    without coordinate support declares null rather than inventing a box. `{}`
    would be the fabricated value standing in for the absence, and this
    constraint deliberately does not force one.

    `procrastinate_jobs.args` is excluded because it is `NOT NULL` — its
    constraint carries no `IS NULL` arm and there is nothing here to assert.
    """
    _run(bounded_engine, _writes("NULL")[column])

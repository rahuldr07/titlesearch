"""`fields` refuses HALF a citation, and the database is what refuses it.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS. A row carrying `source_page_no = 7` with
   `source_document_id = NULL` was written through real RLS at head 0080 and
   the database accepted it. Page seven of WHAT. That row is a value the system
   cannot cite while every column on it says it can — CLAUDE.md principle 6,
   "never emit a value you can't cite", which the repository records as caught
   six times in prototyping.
---------------------------------------------------------------------------

## Half a citation is not a weaker citation, it is none

`api/schemas/provenance.py` already states the property for the WIRE: "a
response carrying a `source_doc_id` with no `source_page` renders as uncited on
the client, so a backend that emits one has published a value it cannot cite
while believing it did". `0090` is the same property at the STORE, which is the
layer that holds for writers nobody has written yet — the extraction worker
included.

## The three shapes, and why only one of them is refused

* **absent** — both NULL. LEGAL, and deliberately so. `db/models/fields.py`
  records that the envelope's nullability is the product: a field whose `value`
  is non-null while the envelope is null is the failure shape the architecture
  exists to CATCH, and the server routes it to review. `NOT NULL` here would
  force the pipeline to invent a citation, which is the principle inverted;
* **whole** — both present. Legal, and the ordinary case;
* **half** — exactly one present. REFUSED. There is no reading of a half
  citation that is a citation: a page with no document names nothing, and a
  document with no page is "somewhere in these forty pages".

## `source_snippet` and `source_line_coords` are NOT in the pair

Deliberately, and `provenance.py` gives the reason for the wire's half of it: a
snippet is the excerpt shown beside the value and its absence degrades the
reader's experience, while a page reference's absence changes whether the value
is CITED. Requiring the snippet would refuse readings from engines that locate a
page and return no excerpt, which is the fabrication pressure
`field_readings.line_coords` exists to avoid.

## Everything here connects as the container SUPERUSER

For the reason `test_golden_set.py` gives at length: a superuser bypasses RLS
unconditionally, which is exactly wrong for an isolation proof and exactly right
for a constraint proof. Nothing in this file is an isolation claim — the ACL is
not in the way, so a refusal that comes back here can only be the CHECK.

## What was watched go RED, and against what

Every assertion below was run against head **0080**, the schema BEFORE `0090`:

* the two refusal tests failed with `DID NOT RAISE <class
  'sqlalchemy.exc.DBAPIError'>` — the half-cited row was accepted, which is
  Tenali's finding reproduced inside the suite;
* `test_a_present_unreadable_field_needs_the_document_too` failed the same way;
* the two acceptance tests and the vacuity control passed there and here, which
  is what says `0090` refuses the half shape ONLY.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator, Mapping

import pytest
from minimal_rows import insert_orders_returning
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

CHECK_VIOLATION_SQLSTATE = "23514"

# The constraint `0090` adds. Spelled as a literal rather than imported from the
# model, which is the leg that catches an edit made to the model and the
# migration at once — `test_golden_set.py` records the same reasoning for the
# enum labels it writes out by hand.
CITATION_CONSTRAINT = "ck_fields_citation_is_whole"

# `0032`'s constraint, named here because one of the tests below is about the
# INTERACTION between the two and a reader needs both names in one place.
UNREADABLE_CONSTRAINT = "ck_fields_unreadable_cites_a_page"

TENANT = uuid.UUID("55555555-5555-5555-5555-555555555555")

# A package needs a 64-character lowercase hex digest
# (`ck_packages_sha256_is_lowercase_hex`). This one is `0` sixty-four times: no
# real file hashes to it, so a row from here that escapes into a fixture meant
# to hold a real package is visible on sight — `minimal_rows` makes the same
# choice with `TEST-ONLY` and `ZZ`, and for the same reason.
TEST_ONLY_SHA256 = "0" * 64

INSERT_FIELD = """
    INSERT INTO fields
        (tenant_id, order_id, path, value, na_reason, state,
         source_document_id, source_page_no)
    VALUES
        (:tenant, :order_id, :path, :value, CAST(:na_reason AS na_reason),
         CAST(:state AS field_state), :source_document_id, :source_page_no)
"""


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    `isinstance` rather than a bare `getattr`, for the reason
    `test_golden_set.py::_sqlstate` gives: `getattr` on a DBAPI exception
    returns whatever is there, and a comparison of `Any` against a string passes
    for a `None` as readily as for a code.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _refuses(engine: Engine, statement: str, parameters: Mapping[str, object]) -> DBAPIError:
    """Run one statement, require that it raised, hand the error back, roll back.

    The rollback is what lets every test here share one module-scoped database
    without leaving a half-written row for the next one.

    `Mapping` and not `dict` because `dict` is INVARIANT in its value type and
    pyright says so at the call sites, which build `dict[str, UUID | str | int]`.
    """
    with engine.connect() as connection:
        with pytest.raises(DBAPIError) as raised:
            connection.execute(text(statement), parameters)
        connection.rollback()
    return raised.value


def _accepts(engine: Engine, statement: str, parameters: Mapping[str, object]) -> None:
    """Run one statement, require that it did NOT raise, roll back.

    The positive half matters as much as the negative one: a constraint written
    `num_nonnulls(...) = 2` would pass every refusal test in this file and
    silently outlaw the uncited-but-honest row the architecture depends on.
    """
    with engine.connect() as connection:
        try:
            connection.execute(text(statement), parameters)
        finally:
            connection.rollback()


def _refusal_names(error: DBAPIError, constraint: str) -> None:
    """Assert both the code and WHICH object refused.

    A test asserting only "something raised" is satisfied by a misspelled
    column; one asserting only the SQLSTATE is satisfied by a DIFFERENT
    constraint on the same table firing first — and `fields` carries seven other
    checks, one of which (`unreadable_cites_a_page`) is deliberately adjacent to
    this one. The name is the content.
    """
    assert _sqlstate(error) == CHECK_VIOLATION_SQLSTATE, (
        f"expected {CHECK_VIOLATION_SQLSTATE} from {constraint}, got {_sqlstate(error)!r}: {error}"
    )
    assert constraint in str(error), (
        f"{CHECK_VIOLATION_SQLSTATE} came back, but not from {constraint} — a "
        f"refusal for the wrong reason is not this constraint working: {error}"
    )


@pytest.fixture(scope="module")
def citation_engine(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> Iterator[Engine]:
    """One superuser engine, with an order, a package and a document committed.

    Committed rather than rolled back because every test opens its own
    connection, and `fields`' composite foreign key onto `documents` needs a
    visible parent in the same tenant — a whole citation cannot be written
    against a document that does not exist, so the acceptance test would fail as
    `23503` and prove nothing about the check.

    `insert_orders_returning` and not `INSERT INTO orders (tenant_id)`: `0008`
    gave `orders` six more `NOT NULL` columns, and `minimal_rows` is the one
    place that knows what a complete order looks like.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            connection.execute(text(insert_orders_returning("id", "only")), {"only": TENANT})
            order_id = _order_id(connection)
            package_id = connection.execute(
                text(
                    "INSERT INTO packages "
                    "(tenant_id, order_id, sha256, byte_size, status, received_at) "
                    "VALUES (:tenant, :order_id, :sha256, 1, "
                    "CAST('received' AS package_status), now()) RETURNING id"
                ),
                {"tenant": TENANT, "order_id": order_id, "sha256": TEST_ONLY_SHA256},
            ).scalar_one()
            connection.execute(
                text(
                    "INSERT INTO documents "
                    "(tenant_id, package_id, label, kind, first_page_no, last_page_no) "
                    "VALUES (:tenant, :package_id, 'TEST-ONLY', 'TEST-ONLY', 1, 40)"
                ),
                {"tenant": TENANT, "package_id": package_id},
            )
        yield engine
    finally:
        engine.dispose()


def _order_id(connection: Connection) -> uuid.UUID:
    """The one order this module wrote."""
    return uuid.UUID(
        str(
            connection.execute(
                text("SELECT id FROM orders WHERE tenant_id = :tenant"), {"tenant": TENANT}
            ).scalar_one()
        )
    )


def _document_id(connection: Connection) -> uuid.UUID:
    """The one document this module wrote."""
    return uuid.UUID(
        str(
            connection.execute(
                text("SELECT id FROM documents WHERE tenant_id = :tenant"), {"tenant": TENANT}
            ).scalar_one()
        )
    )


def _field_parameters(engine: Engine, **overrides: object) -> dict[str, object]:
    """A complete, legal field row with a WHOLE citation, any member replaced.

    Every test is "this row, but one thing changed", and spelling the other
    seven columns out per test is how the changed one stops being visible. The
    path is unique per call because `uq_fields_tenant_id_order_id_path` makes it
    the table's natural key inside an order, and a duplicate-key `23505` would
    be a refusal for the wrong reason in a file whose whole subject is which
    constraint fired.
    """
    with engine.connect() as connection:
        parameters: dict[str, object] = {
            "tenant": TENANT,
            "order_id": _order_id(connection),
            "path": f"test.only.{uuid.uuid4()}",
            "value": "Lot 7, Block 2",
            "na_reason": None,
            "state": "pending",
            "source_document_id": _document_id(connection),
            "source_page_no": 7,
        }
        connection.rollback()
    parameters.update(overrides)
    return parameters


# --- the half shapes are refused --------------------------------------------


def test_a_page_without_a_document_is_refused(citation_engine: Engine) -> None:
    """🔴 THE MEASURED ROW. `source_page_no = 7`, `source_document_id = NULL`.

    Page seven of what. This is the exact shape that was written through real
    RLS at head 0080 and accepted, and it is the reason `0090` exists.
    """
    error = _refuses(
        citation_engine,
        INSERT_FIELD,
        _field_parameters(citation_engine, source_document_id=None, source_page_no=7),
    )
    _refusal_names(error, CITATION_CONSTRAINT)


def test_a_document_without_a_page_is_refused(citation_engine: Engine) -> None:
    """The other half, and it is not the lesser one.

    A document id with no page is "somewhere in these forty pages", which reads
    on the review screen as a sourced value and is not one. `provenance.py`
    states this half for the wire in exactly those terms.
    """
    error = _refuses(
        citation_engine,
        INSERT_FIELD,
        _field_parameters(citation_engine, source_page_no=None),
    )
    _refusal_names(error, CITATION_CONSTRAINT)


def test_a_present_unreadable_field_needs_the_document_too(citation_engine: Engine) -> None:
    """🔴 THE INTERACTION WITH `0032`, WHICH IS A REAL TIGHTENING AND IS INTENDED.

    `ck_fields_unreadable_cites_a_page` already requires a page of a
    `PRESENT_UNREADABLE` field — "the ink is gone on a page somebody can name".
    A page is nameable only inside a document, so under `0090` that constraint's
    requirement becomes a WHOLE citation rather than a page number floating free.
    Before `0090` this row was accepted: it satisfied `unreadable_cites_a_page`
    with a page and cited no document, which is the half shape wearing the one
    NA label that is supposed to be the most precisely located of the four.

    `value` is NULL here because `ck_fields_value_and_na_reason_are_exclusive`
    refuses a value beside a reason for having none.
    """
    error = _refuses(
        citation_engine,
        INSERT_FIELD,
        _field_parameters(
            citation_engine,
            value=None,
            na_reason="PRESENT_UNREADABLE",
            source_document_id=None,
            source_page_no=3,
        ),
    )
    _refusal_names(error, CITATION_CONSTRAINT)


# --- the whole and absent shapes are accepted --------------------------------


def test_a_whole_citation_is_accepted(citation_engine: Engine) -> None:
    """The ordinary case, and the guard against a constraint written too tight."""
    _accepts(citation_engine, INSERT_FIELD, _field_parameters(citation_engine))


def test_an_absent_citation_is_accepted(citation_engine: Engine) -> None:
    """🔴 THE SHAPE `0090` MUST NOT OUTLAW, AND THE REASON IT IS `IN (0, 2)`.

    A field with a value and no envelope at all is not a lie — it is the failure
    the architecture is built to CATCH, and the server routes it to review.
    `db/models/fields.py` records that `NOT NULL` here would force the pipeline
    to invent a citation, which is principle 6 inverted into a requirement to
    make one up. A constraint spelled `num_nonnulls(...) = 2` would pass all
    three refusal tests above and break this, which is why this test is here and
    not left as a comment.
    """
    _accepts(
        citation_engine,
        INSERT_FIELD,
        _field_parameters(citation_engine, source_document_id=None, source_page_no=None),
    )


# --- the control that says the two above are not vacuous ---------------------


def test_the_insert_this_file_uses_reaches_the_fields_table(citation_engine: Engine) -> None:
    """🔴 WITHOUT THIS, `_accepts` PASSES FOR A STATEMENT THAT WRITES NOTHING.

    `_accepts` asserts only that nothing raised, and a misspelled table or a
    statement that matched no row does not raise either. This writes the whole
    citation, reads the row back inside the same transaction and rolls it away,
    so the two acceptance tests above are known to be exercising `fields` rather
    than agreeing with an empty result.
    """
    parameters = _field_parameters(citation_engine)
    with citation_engine.connect() as connection:
        try:
            connection.execute(text(INSERT_FIELD), parameters)
            stored = connection.execute(
                text(
                    "SELECT source_document_id, source_page_no FROM fields "
                    "WHERE tenant_id = :tenant AND path = :path"
                ),
                {"tenant": parameters["tenant"], "path": parameters["path"]},
            ).one()
        finally:
            connection.rollback()

    assert uuid.UUID(str(stored[0])) == parameters["source_document_id"]
    assert stored[1] == 7

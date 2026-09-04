"""Every identifier this package's metadata names fits in PostgreSQL's 63 bytes.

🔴 **THE FAILURE THIS EXISTS TO CATCH IS SILENT TRUNCATION, NOT A CRASH.**
PostgreSQL's `NAMEDATALEN` is 64, so an identifier is cut to 63 bytes and the
statement SUCCEEDS. Nothing warns. The consequences are all downstream and all
expensive:

  * The model says `uq_field_readings_tenant_id_field_id_engine_id_engine_version
    _attempt_ordinal` and `pg_constraint` says the first 63 characters of it, so
    `alembic check` reports drift that no edit to either side ever resolves.
  * `op.drop_constraint("<the long name>")` in a `downgrade()` finds nothing and
    raises on a name the migration itself wrote.
  * Two long names sharing a 63-byte prefix become ONE name. The second `CREATE`
    fails with `already exists`, naming a constraint nobody typed.

**WHY A TEST AND NOT A CHECK IN `relations.py`.** Half of a generated foreign-key
name is the CHILD table's name, which `tenant_fk` does not know — it is called
inside a `__table_args__` tuple that is evaluated before the class is named. Only
the assembled `Base.metadata` has both halves, which is what this reads.

**WHAT THIS DOES NOT COVER, stated rather than implied.** It reads the MODEL's
metadata. A migration is hand-written SQL whose literal names this cannot see, so
a migration naming a constraint the models do not is outside it. `alembic check`
is what holds those two together; this holds the half that `alembic check`
compares against.

SQLAlchemy raises `IdentifierError` for a name it GENERATES over the limit, and
that covers some of the same ground — but only at DDL-compile time, only for
convention-generated names, and only if something actually compiles the DDL.
This is unconditional and runs without a database.
"""

from __future__ import annotations

import sqlalchemy as sa

from titlepipe_core.db.models import Base

# PostgreSQL's `NAMEDATALEN - 1`. A literal rather than
# `dialect.max_identifier_length` because the point is to pin the number this
# codebase targets: reading it from the dialect would make the test agree with
# whatever the driver says, including if a future dialect said something larger.
MAX_IDENTIFIER_BYTES = 63


def _named_objects() -> list[tuple[str, str, str]]:
    """`(table, kind, name)` for every named constraint and index in the metadata."""
    found: list[tuple[str, str, str]] = []
    for table in Base.metadata.tables.values():
        for obj in (*table.constraints, *table.indexes):
            name = getattr(obj, "name", None)
            if isinstance(name, str):
                found.append((table.name, type(obj).__name__, name))
    return found


def test_every_constraint_and_index_name_fits_in_a_postgres_identifier() -> None:
    too_long = [
        (table, kind, name, len(name.encode()))
        for table, kind, name in _named_objects()
        if len(name.encode()) > MAX_IDENTIFIER_BYTES
    ]
    assert not too_long, (
        "PostgreSQL truncates these to 63 bytes without complaining, which puts "
        "the model and pg_constraint permanently out of agreement:\n"
        + "\n".join(f"  {t}.{k} {n} ({ln} bytes)" for t, k, n, ln in too_long)
    )


def test_no_two_names_collide_once_postgres_has_truncated_them() -> None:
    """A shorter check than the one above would still let two names become one."""
    seen: dict[str, tuple[str, str]] = {}
    collisions: list[str] = []
    for table, _kind, name in _named_objects():
        truncated = name.encode()[:MAX_IDENTIFIER_BYTES].decode(errors="ignore")
        if truncated in seen and seen[truncated][1] != name:
            collisions.append(f"  {seen[truncated][1]!r} and {name!r} both -> {truncated!r}")
        else:
            seen.setdefault(truncated, (table, name))
    assert not collisions, "these names are the same identifier to PostgreSQL:\n" + "\n".join(
        collisions
    )


def test_the_metadata_actually_holds_constraints_so_the_two_above_can_fail() -> None:
    """Both tests above pass vacuously over an empty list. This is why they do not.

    A refactor that stopped registering model modules in `models/__init__.py`
    would empty `Base.metadata` and turn every assertion in this file green.
    """
    objects = _named_objects()
    assert len(objects) > 100, f"only {len(objects)} named objects; metadata looks incomplete"
    kinds = {kind for _, kind, _ in objects}
    assert {"CheckConstraint", "ForeignKeyConstraint", "UniqueConstraint"} <= kinds, kinds
    assert any(
        isinstance(c, sa.PrimaryKeyConstraint)
        for t in Base.metadata.tables.values()
        for c in t.constraints
    )

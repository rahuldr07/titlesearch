"""The seven skeleton tables, the na_reason enum, and audit_log's append-only trigger

Revision ID: 0001
Revises:
Create Date: 2026-08-05

SKELETON, resolved by the owner: `id`, `tenant_id`, `created_at` and the two
typed columns, **no foreign keys**. See `titlepipe_core.db.models` for why the
shortness is the decision rather than an omission, and why every tenant table
carries its own `tenant_id` instead of a policy joining to find one.

Revision `0002` (Task 4) adds `ENABLE`/`FORCE ROW LEVEL SECURITY`, the
`tenant_isolation` policies and the grants. **None of that is here.** They are
separate revisions so that "the tables exist" and "the tables are isolated" are
separately reversible.

Every statement is written out rather than generated in a loop. Seven near
identical `create_table` calls read worse than a `for`, and they are worth it:
each object gets one reviewable line, and a review or an injection that removes
one is a one-line diff rather than an edit to a control structure.

## Three things `--autogenerate` cannot do, and this file therefore does by hand

**The enum is created and dropped EXPLICITLY.** `DROP TABLE` does not drop a
type. A `downgrade()` that only drops tables leaves `na_reason` behind, and the
NEXT `upgrade` dies on `type "na_reason" already exists` — a fresh database
migrates fine, so only a round trip finds it.
`test_upgrade_downgrade_upgrade_is_clean` is that round trip.

**The append-only trigger is `FOR EACH STATEMENT`, and that is not a style
choice.** A row trigger fires once per affected row, so it does not fire at all
when a statement affects none — and under `0002`'s RLS a cross-tenant `UPDATE`
matches exactly zero rows. `FOR EACH ROW` would therefore be SILENT for the one
case the trigger exists to refuse, and the append-only proof would pass
vacuously.

**The trigger raises a NAMED SQLSTATE**, `0A000` (`feature_not_supported`) —
what PostgreSQL itself returns for "cannot update this thing". No typo can
produce it: an unknown column is `42703` and an unknown table `42P01`. The test
asserts the SQLSTATE rather than "something raised", because "something raised"
is also what a misspelled column in the test does.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 EXACTLY FOUR LABELS, IN THIS ORDER.
#
# Repeated here rather than imported from `titlepipe_core.db.models`, on
# purpose: a migration is a frozen snapshot of one revision, and an import would
# let a later edit to the model silently rewrite what `0001` claims to have
# created. `tests/test_schema_migration.py` asserts the live `pg_enum` against
# the model's constant — on the count AND on `enumsortorder`, separately — which
# is what keeps the two copies honest without coupling them.
NA_REASON_LABELS = ("NOT_PRESENT", "NOT_FOUND", "NOT_STATED", "PRESENT_UNREADABLE")

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE`
# as a side effect of the column. The type is created and dropped by the two
# explicit statements below, which is the only way it gets a `DROP` at all.
NA_REASON = postgresql.ENUM(*NA_REASON_LABELS, name="na_reason", create_type=False)

APPEND_ONLY_FUNCTION = "audit_log_reject_mutation"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — a `Column` cannot be reused.

    A `Column` binds to the first `Table` it is added to, so a shared
    module-level list would attach every table to the first one and fail on the
    second. Hence a function, called once per table.

    🔴 THE RETURN TYPE IS A HETEROGENEOUS TUPLE, NOT `list[Column[object]]`, AND
    THAT WAS A REAL BUG RATHER THAN A STYLE FIX. `Column` is INVARIANT in its
    type parameter, so `Column[UUID]` is not assignable to `Column[object]` and
    the old annotation was simply false — pyright reports it as
    `reportReturnType` the moment it is pointed at this directory, which until
    now it was not (`pyproject.toml` had `include = ["src", "tests"]`). A tuple
    keeps each column's own exact type, and unpacking it into
    `op.create_table(..., *_identity_columns(), ...)` type-checks because that
    parameter is `SchemaItem`, which every `Column` is whatever its parameter.

    `gen_random_uuid()` is core PostgreSQL from 13 on, so there is no `pgcrypto`
    extension for a privileged role to create. `now()` is transaction start,
    which is what a creation time means here — every row written by one
    transaction shares it, where `clock_timestamp()` would make ordering within
    a transaction depend on statement order.
    """
    return (
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def _tenant_column() -> sa.Column[UUID]:
    """`tenant_id`, `NOT NULL`.

    `NOT NULL` is what makes `0002`'s policy total. `tenant_id = <uuid>` is NULL
    rather than true for a NULL row, so a nullable column would permit rows that
    no tenant can read, none can delete, and no isolation test can see.
    """
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _na_reason_column() -> sa.Column[str]:
    """`fields.na_reason`, NULL when the field has a value.

    A reason for absence is meaningless where nothing is absent. This is NOT a
    third NA state — `NOT_PRESENT` and `PRESENT_UNREADABLE` are two of the four
    labels and must never be collapsed into each other.

    THE ANNOTATION EXISTS TO GIVE THE COLUMN A KNOWN TYPE PARAMETER.
    `postgresql.ENUM` carries no type argument in SQLAlchemy's annotations, so
    `sa.Column("na_reason", NA_REASON, ...)` infers `Column[Unknown]` and pyright
    reports `reportUnknownArgumentType` at the `op.create_table` call site.
    `str` is what the column actually holds — the identical column spelled with
    the generic `sa.Enum` infers `Column[str]` — so this narrows rather than
    asserts, and needs no `cast` and no ignore.
    """
    return sa.Column("na_reason", NA_REASON, nullable=True)


def _line_coords_column() -> sa.Column[dict[str, object]]:
    """🔴 NULLABLE, AND THE NULLABILITY IS THE POINT.

    An engine with no coordinate support declares `null` and never fabricates a
    box; Reader A is a VLM and genuinely cannot cite one. `NOT NULL` would
    require every adapter to invent coordinates to satisfy the schema.
    """
    return sa.Column("line_coords", postgresql.JSONB(), nullable=True)


def upgrade() -> None:
    # `checkfirst=False`: a type that already exists here means a previous
    # `downgrade` failed to drop it, and that must be an error rather than a
    # silent reuse of whatever labels the old type happened to have.
    NA_REASON.create(op.get_bind(), checkfirst=False)

    # The registry. Its PRIMARY KEY *is* the tenant id, so it has no
    # `tenant_id` column and `0002`'s policy keys on `id` here alone. Task 4
    # derives the tenant tables from the presence of a `tenant_id` column, so
    # giving this one would quietly change which policy it gets.
    op.create_table("tenants", *_identity_columns(), sa.PrimaryKeyConstraint("id"))

    op.create_table("orders", *_identity_columns(), _tenant_column(), sa.PrimaryKeyConstraint("id"))
    op.create_table(
        "packages", *_identity_columns(), _tenant_column(), sa.PrimaryKeyConstraint("id")
    )
    op.create_table("pages", *_identity_columns(), _tenant_column(), sa.PrimaryKeyConstraint("id"))

    op.create_table(
        "fields",
        *_identity_columns(),
        _tenant_column(),
        _na_reason_column(),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "field_readings",
        *_identity_columns(),
        _tenant_column(),
        _line_coords_column(),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit_log", *_identity_columns(), _tenant_column(), sa.PrimaryKeyConstraint("id")
    )

    _create_append_only_trigger()


def _create_append_only_trigger() -> None:
    """`audit_log` accepts INSERT and nothing else, short of a superuser.

    THE QUALIFICATION IS REAL AND IS NOT A CODE CHANGE. A superuser can set
    `session_replication_role = 'replica'`, under which ordinary triggers do not
    fire, and then `DELETE` freely. That GUC is `SUSET`: both `titlepipe_app` and
    `titlepipe_migration` get `42501 insufficient_privilege` on it, and no
    TitlePipe role is a superuser (`tests/test_roles.py` asserts `rolsuper` is
    false for all five). So the trigger is a complete control against every role
    this system connects as, and is not a control against whoever administers the
    cluster. Nothing in a database can be.

    🔴 `CREATE FUNCTION`, NOT `CREATE OR REPLACE`, AND THAT IS DELIBERATE. With
    `OR REPLACE`, a `downgrade()` that forgot its `DROP FUNCTION` would leave the
    old body in place and the next `upgrade` would silently overwrite it — a
    round trip that passes while the schema is not actually being rebuilt, and a
    stale body surviving whenever the two versions differ. Plain `CREATE FUNCTION`
    turns that same omission into `DuplicateFunction` on the second upgrade,
    which is the identical failure mode the enum's explicit `DROP TYPE` exists to
    produce. Do not "tidy" this into `OR REPLACE`.

    `BEFORE`, so nothing is written before the refusal. The function returns
    `trigger` and takes no arguments because that is the only signature `CREATE
    TRIGGER` accepts, and it never actually returns: a `BEFORE` trigger that
    returned NULL would *silently suppress* the statement, which is
    indistinguishable from success at the client.

    **TWO TRIGGERS, NOT ONE, and the split is forced.** A `TRUNCATE` trigger can
    only be `FOR EACH STATEMENT`, so PostgreSQL rejects a combined
    `UPDATE OR DELETE OR TRUNCATE` trigger declared `FOR EACH ROW` outright. If
    the two shared a trigger, the STATEMENT-versus-ROW decision this migration
    turns on would be unrepresentable — the wrong choice would fail at migration
    time with a message about TRUNCATE, and no test could ever exercise the
    silent row-level failure that is the actual hazard. Splitting them keeps
    that choice a real, testable one.

    `RAISE EXCEPTION USING MESSAGE = <expression>` rather than the idiomatic
    `RAISE EXCEPTION '… % …', TG_OP`. `op.execute` hands this SQL to
    SQLAlchemy's `text()`, which reaches psycopg under the `pyformat`
    paramstyle, where a lone `%` is read as a malformed placeholder rather than
    as plpgsql's substitution marker. `USING MESSAGE =` takes an ordinary
    expression, so `TG_OP` is concatenated and no `%` ever reaches the driver.
    """
    op.execute(
        f"""
        CREATE FUNCTION {APPEND_ONLY_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION USING
                ERRCODE = '0A000',
                MESSAGE = 'audit_log is append-only; ' || TG_OP || ' is refused',
                HINT = 'Write a correcting entry; history is not edited in place.';
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER audit_log_append_only
        BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER audit_log_no_truncate
        BEFORE TRUNCATE ON audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )


def downgrade() -> None:
    # Reverse creation order. Nothing forces it today — there are no foreign
    # keys — and it is the order that stays correct when the real model adds
    # one. Both triggers are dropped by `DROP TABLE audit_log`; the FUNCTION is
    # not, because it belongs to the schema rather than to the table.
    op.drop_table("audit_log")
    op.drop_table("field_readings")
    op.drop_table("fields")
    op.drop_table("pages")
    op.drop_table("packages")
    op.drop_table("orders")
    op.drop_table("tenants")

    op.execute(f"DROP FUNCTION {APPEND_ONLY_FUNCTION}()")

    # 🔴 `DROP TABLE` DOES NOT DROP A TYPE. Without this line a fresh upgrade
    # still works and only the SECOND one — the one after a downgrade — fails,
    # with `type "na_reason" already exists`.
    NA_REASON.drop(op.get_bind(), checkfirst=False)

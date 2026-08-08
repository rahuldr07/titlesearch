"""The seven skeleton tables, the na_reason enum, and audit_log's append-only trigger

Revision ID: 0001
Revises:
Create Date: 2026-08-05

SKELETON, resolved by the owner: `id`, `tenant_id`, `created_at` and the two
typed columns, **no foreign keys**. See `titlepipe_core.db.models` for why the
shortness is the decision rather than an omission, and why every tenant table
carries its own `tenant_id` instead of a policy joining to find one.

**PRIMARY KEY `(tenant_id, id)` on the six tenant tables, `(id)` on `tenants`.**
See `_tenant_primary_key` — a single-column `id` key is a cross-tenant existence
oracle under `0002`'s forced RLS, and the measurement is recorded there.

Revision `0002` (Task 4) adds `ENABLE`/`FORCE ROW LEVEL SECURITY`, the
`tenant_isolation` policies and the grants. **None of that is here.** They are
separate revisions so that "the tables exist" and "the tables are isolated" are
separately reversible.

🔴 **THESE TABLES ARE FREELY WRITABLE BY A MIGRATION ONLY UNTIL `0002` RUNS, AND
NOTHING ELSE IN THIS FILE SAYS SO.** Every `INSERT`, `UPDATE` and `DELETE` a
later revision writes against them lands on a connection that is
`titlepipe_owner` — and `0002`'s `FORCE ROW LEVEL SECURITY` is precisely the
statement that removes the OWNER's exemption from the policy. MEASURED
2026-08-05 against postgres:18.4, two rows in `orders` belonging to two tenants,
as `titlepipe_migration` with `SET ROLE titlepipe_owner`:

    UPDATE orders SET tenant_id = tenant_id;   ->  UPDATE 0
    SELECT count(*) FROM orders;               ->  0

No error, no warning, exit 0. A data migration written after `0002` **does
nothing and reports success**. The remedy is two statements —
`SET LOCAL row_security = off` (which turns that silence into
`42501 query would be affected by row-level security policy`) followed by
`ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY`, both inside the migration's own
transaction. `0002`'s module docstring holds the full recipe and the
measurements, and `tests/test_forced_rls_and_grants.py::test_a_migration_shaped
_write_is_a_silent_no_op_until_it_says_so` pins both halves.

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
    """`tenant_id`, `NOT NULL`, and the leading column of every tenant table's key.

    `NOT NULL` is what makes `0002`'s policy total. `tenant_id = <uuid>` is NULL
    rather than true for a NULL row, so a nullable column would permit rows that
    no tenant can read, none can delete, and no isolation test can see. The
    composite key below enforces the same thing a second time; the explicit flag
    stays so that dropping the column from the key cannot silently relax it.
    """
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _tenant_primary_key() -> sa.PrimaryKeyConstraint:
    """🔴 `PRIMARY KEY (tenant_id, id)`, NOT `PRIMARY KEY (id)`.

    Unique enforcement runs BEFORE a policy's `WITH CHECK`, so under `0002`'s
    `ENABLE` + `FORCE ROW LEVEL SECURITY` and its `tenant_isolation` policy, a
    single-column `id` key answers "does this id exist in some other tenant?" to
    a caller who can neither read nor count the row. RLS cannot deny it; the
    constraint fires first. MEASURED 2026-08-05 against postgres:18.4, two
    otherwise identical tables, connected as a non-owner LOGIN role with
    `app.current_tenant` set to tenant B:

        tenant B, rows visible in orders_pk_id:  0
        tenant B, rows visible in orders_pk_tid: 0

        PK(id)             INSERT an id held only by tenant A
            -> ERROR: duplicate key value violates unique constraint "pk_orders_pk_id"
        PK(id)             INSERT an id held by nobody          -> succeeds
        PK(tenant_id, id)  INSERT an id held only by tenant A   -> succeeds
        PK(tenant_id, id)  INSERT an id held by nobody          -> succeeds

    Two distinguishable answers for two rows tenant B cannot see. BOUNDED today
    only because ids are 128-bit and server-generated, so an attacker needs an id
    they already hold — a shared link, a support ticket, an exported CSV. It
    stops being bounded the moment a natural key lands, and PRD §7 gives `orders`
    an order number and `pages` a page index. The convention is set here because
    here it is one line per table, and after data lands it is a rewrite of every
    table and every foreign key pointing at one.

    It also tenant-prefixes the backing index, which is what an RLS-filtered scan
    wants.

    `tenants` does NOT get this. Its `id` IS a tenant id, so its key is already
    tenant-scoped and there is no second column to prefix it with.

    Built fresh per table, and the failure mode for sharing one is WORSE than
    `_identity_columns`', not the same. A `Column` added to a second `Table`
    raises. A `PrimaryKeyConstraint` does not — MEASURED 2026-08-05 on
    SQLAlchemy 2.0, adding one object to tables `a` then `b` under this file's
    naming convention emitted `CONSTRAINT pk_a PRIMARY KEY (tenant_id, id)` on
    BOTH, because the shared object keeps the name it was given on first bind.
    Two primary keys called `pk_a` in one schema is a `relation "pk_a" already
    exists` at migration time, and no Python-level error anywhere.
    """
    return sa.PrimaryKeyConstraint("tenant_id", "id")


def _na_reason_column() -> sa.Column[str]:
    """`fields.na_reason`, NULL when the field has a value.

    A reason for absence is meaningless where nothing is absent. This is NOT a
    third NA state — `NOT_PRESENT` and `PRESENT_UNREADABLE` are two of the four
    labels and must never be collapsed into each other.

    THE ANNOTATION EXISTS TO GIVE THE COLUMN A KNOWN TYPE PARAMETER.
    `postgresql.ENUM` carries no type argument in SQLAlchemy's annotations, so
    `sa.Column("na_reason", NA_REASON, ...)` infers `Column[Unknown]` and pyright
    reports `reportUnknownArgumentType` at the `op.create_table` call site.

    BE PRECISE ABOUT WHAT PYRIGHT IS DOING WITH THE `str`: NOTHING. It is an
    ASSERTION by the author, not a narrowing the checker verified. MEASURED
    2026-08-05, pyright 1.1 strict, on this exact expression:

        reveal_type(sa.Column("na_reason", NA_REASON, nullable=True))
            -> Column[Unknown]
        reveal_type(sa.Column("na_reason", sa.Enum(...), nullable=True))
            -> Column[str]
        def f() -> sa.Column[complex]:
            return sa.Column("na_reason", NA_REASON, nullable=True)   # 0 errors

    `Column[complex]` type-checks just as happily as `Column[str]`, so the
    annotation cannot be evidence for itself. What makes `str` the right one is
    the second line above — the identical column spelled with the generic
    `sa.Enum` infers `Column[str]` — plus the fact that the column holds one of
    four label strings and nothing else.
    """
    return sa.Column("na_reason", NA_REASON, nullable=True)


def _line_coords_column() -> sa.Column[dict[str, object]]:
    """🔴 NULLABLE, AND THE NULLABILITY IS THE POINT.

    An engine with no coordinate support declares `null` and never fabricates a
    box; Reader A is a VLM and genuinely cannot cite one. `NOT NULL` would
    require every adapter to invent coordinates to satisfy the schema.

    THE `dict[str, object]` IS AN ASSERTION AND IS NOT ENFORCED BY ANYTHING —
    NEITHER BY PYRIGHT NOR BY THE DATABASE. MEASURED 2026-08-05, pyright 1.1
    strict:

        reveal_type(sa.Column("line_coords", postgresql.JSONB(), nullable=True))
            -> Column[Any]
        def g() -> sa.Column[complex]:
            return sa.Column("line_coords", postgresql.JSONB(), nullable=True)  # 0 errors

    `Any` is assignable to every type parameter, so pyright accepts whatever is
    written here; the annotation buys a known parameter at the call site and no
    guarantee at all. Nor does the column: `jsonb` with no CHECK accepts arrays,
    strings, numbers and `null` as readily as objects. The one thing that will
    make a non-object impossible is a CHECK constraint, and there is none in the
    skeleton — the real model, with the real coordinate shape, is where it
    belongs.
    """
    return sa.Column("line_coords", postgresql.JSONB(), nullable=True)


def upgrade() -> None:
    # `checkfirst=False`: a type that already exists here means a previous
    # `downgrade` failed to drop it, and that must be an error rather than a
    # silent reuse of whatever labels the old type happened to have.
    #
    # THAT GUARD IS NEVER EXERCISED BY THIS SUITE and cannot be, so it is pinned
    # by a SOURCE assertion instead —
    # `tests/test_schema_migration.py::test_the_migration_source_refuses_the
    # _forgiving_spellings`, which says plainly what a source assertion can and
    # cannot prove. It fires only when `downgrade()` is already broken, and the
    # round trip always downgrades cleanly first; MEASURED 2026-08-05, flipping
    # this argument to the forgiving value left the whole suite at `159 passed`.
    NA_REASON.create(op.get_bind(), checkfirst=False)

    # The registry. Its PRIMARY KEY *is* the tenant id, so it has no
    # `tenant_id` column and `0002`'s policy keys on `id` here alone. Task 4
    # derives the tenant tables from the presence of a `tenant_id` column, so
    # giving this one would quietly change which policy it gets.
    op.create_table("tenants", *_identity_columns(), sa.PrimaryKeyConstraint("id"))

    # `PRIMARY KEY (tenant_id, id)` on all six — see `_tenant_primary_key`.
    op.create_table("orders", *_identity_columns(), _tenant_column(), _tenant_primary_key())
    op.create_table("packages", *_identity_columns(), _tenant_column(), _tenant_primary_key())
    op.create_table("pages", *_identity_columns(), _tenant_column(), _tenant_primary_key())

    op.create_table(
        "fields",
        *_identity_columns(),
        _tenant_column(),
        _na_reason_column(),
        _tenant_primary_key(),
    )

    op.create_table(
        "field_readings",
        *_identity_columns(),
        _tenant_column(),
        _line_coords_column(),
        _tenant_primary_key(),
    )

    op.create_table("audit_log", *_identity_columns(), _tenant_column(), _tenant_primary_key())

    _create_append_only_trigger()


def _create_append_only_trigger() -> None:
    """`audit_log` accepts INSERT and nothing else, short of a superuser.

    THE QUALIFICATION IS REAL AND IS NOT A CODE CHANGE. A superuser can set
    `session_replication_role = 'replica'`, under which ordinary triggers do not
    fire, and then `DELETE` freely. That GUC is `SUSET`, so an IN-SESSION `SET`
    of it by `titlepipe_app` or `titlepipe_migration` is refused with
    `42501 insufficient_privilege`, and no TitlePipe role is a superuser
    (`tests/test_roles.py` asserts `rolsuper` is false for all five).

    🔴 THAT ARGUMENT WAS THE WHOLE ARGUMENT AND IT WAS NOT SUFFICIENT. This
    docstring used to conclude from the two sentences above that "the trigger is
    a complete control against every role this system connects as". It is not,
    because `SUSET` governs the in-session `SET` and says nothing about a
    PER-ROLE DEFAULT, which is applied at CONNECT and never checked at use.
    MEASURED 2026-08-05 against postgres:18.4, on a database holding this
    revision's `audit_log`:

        ALTER ROLE titlepipe_app SET session_replication_role='replica';
        <rerun roles.sql>                       -> exit 0, setting untouched
        fresh connection as titlepipe_app       -> mode_at_connect = replica
        before=3  ->  DELETE FROM audit_log  ->  after=0

    `rolsuper` being false for all five is not the control that closes that: the
    setting is planted by whoever can `ALTER ROLE`, and from then on the role
    that connects needs no privilege at all. What closes it is
    `migrations/sql/roles.sql`, which now converges `pg_db_role_setting` in BOTH
    scopes — `ALTER ROLE r RESET ALL` clears only the cluster-wide row
    (`setdatabase = 0`), and the database-scoped row is a separate one that
    survives it — and `tests/test_roles.py::test_no_titlepipe_role_carries_a_per
    _role_setting_default`, which reads both scopes back and requires zero rows.
    This revision was never amended for that fix; the paragraph above is.

    So: the trigger is a control against every role this system connects as
    PROVIDED `roles.sql` has run and no per-role default survived it, and it is
    not a control against whoever administers the cluster. Nothing in a database
    can be.

    🔴 `CREATE FUNCTION`, NOT `CREATE OR REPLACE`, AND THAT IS DELIBERATE. With
    `OR REPLACE`, a `downgrade()` that forgot its `DROP FUNCTION` would leave the
    old body in place and the next `upgrade` would silently overwrite it — a
    round trip that passes while the schema is not actually being rebuilt, and a
    stale body surviving whenever the two versions differ. Plain `CREATE FUNCTION`
    turns that same omission into `DuplicateFunction` on the second upgrade,
    which is the identical failure mode the enum's explicit `DROP TYPE` exists to
    produce. Do not "tidy" this into `OR REPLACE`.

    LIKE THE ENUM'S `checkfirst`, THIS GUARD IS NEVER EXERCISED HERE. It fires
    only when `downgrade()` is already broken, and the round trip always
    downgrades cleanly first — MEASURED 2026-08-05, the `OR REPLACE` spelling left
    the whole suite at `159 passed`. It is pinned by a SOURCE assertion,
    `tests/test_schema_migration.py::test_the_migration_source_refuses_the
    _forgiving_spellings`, which is honest about being one.

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
    `RAISE EXCEPTION '… % …', TG_OP`, and THAT IS A STYLE CHOICE WITH NO DRIVER
    BEHIND IT. An earlier version of this docstring claimed the idiomatic form
    was impossible here — that `op.execute` reaches psycopg under the `pyformat`
    paramstyle, where a lone `%` is a malformed placeholder. **That claim was
    false.** psycopg3 substitutes only when parameters are supplied, and
    SQLAlchemy passes none for a parameterless `text()`. MEASURED 2026-08-05:
    with the body rewritten to
    `RAISE EXCEPTION 'audit_log is append-only; % is refused', TG_OP USING …`,
    `tests/test_schema_migration.py` ran `19 passed` and the raised message read
    `audit_log is append-only; UPDATE is refused` — plpgsql substituted the `%`
    exactly as documented.

    The honest reason for keeping `USING MESSAGE =` is uniformity: ERRCODE,
    MESSAGE and HINT are then three entries in one list, read and edited the same
    way, instead of one of them being positional-format arguments on the `RAISE`
    line and the other two being `USING` entries. Either form works. Do not
    reintroduce a driver rationale for this one.
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

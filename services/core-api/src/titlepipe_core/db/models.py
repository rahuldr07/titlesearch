"""`Base` and the seven skeleton tables Plan 01 needs.

**This is a SKELETON, resolved by the owner 2026-08-05, and the shortness is the
decision rather than an omission.** `docs/PRD.md` §7 defines 24 tables; this plan
needs 7, and it is a *security* gate — forced RLS, grants, tenant sessions. Every
column added here before the domain settles is a column migrated later for no
benefit, so each table carries `id`, `tenant_id` and `created_at` and nothing
else except the two typed columns below. **There are deliberately no foreign keys
between these tables.**

**Every tenant table carries its own `tenant_id`, and no policy ever joins to
find one.** That is the half of the skeleton that is not merely provisional.
PRD §7's header says "every table has tenant_id", but its per-table lists spell
it out only on `users`, `clients`, `orders` and `audit_log` — not on `packages`,
`pages`, `fields` or `field_readings`, which are exactly the tables Task 4 must
write a policy on. Almost certainly shorthand; "almost certainly" is not a sound
basis for the one column every RLS policy keys on. If those tables genuinely
lacked it, isolation would have to walk a four-level FK chain — weaker, slower,
and a different Task 4. When the real model lands, §7 must be corrected to say
so explicitly for all six.

`tenants` is the REGISTRY, not a tenant table: its primary key *is* the tenant
id, so Task 4's policy keys on `id` there and on `tenant_id` everywhere else.
Task 4 derives that split from the presence of a `tenant_id` COLUMN rather than
from a list, which is why `tenants` must not grow one.

**EVERY TENANT TABLE'S PRIMARY KEY IS `(tenant_id, id)`, AND `tenants`' IS
`(id)`.** See `_TenantRow` for the cross-tenant existence oracle that a
single-column `id` primary key opens under `FORCE ROW LEVEL SECURITY`, and for
the measurement.

`Base` is a plain `DeclarativeBase` and **not** `MappedAsDataclass`. Task 5
imports this exact symbol as the bound of `TenantRepository[T: Base]`; the
dataclass variant would additionally impose `__init__` ordering rules on every
model for a construction ergonomic nothing in this plan needs.

**`audit_log`'s append-only trigger is not expressible here.** It lives in
migration `0001` and is proved in `tests/test_schema_migration.py`. SQLAlchemy
metadata has no notion of a trigger, so nothing in this file could carry it and
nothing in `alembic check` will ever notice its absence.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Final

from sqlalchemy import DateTime, MetaData, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Deterministic constraint names, set on the `MetaData` rather than typed out per
# constraint. Without a convention PostgreSQL invents the names, Alembic
# autogenerate then reads back a name nobody wrote, and a later `op.drop_constraint`
# has to guess. `%(column_0_N_name)s` spans every column in a multi-column
# constraint, so a two-column unique constraint does not collide with a
# one-column one on the same first column.
#
# The skeleton has nothing but primary keys today. The convention is here anyway
# because the day it is missing is the day a constraint is created without it,
# and renaming a live constraint costs more than declaring the rule now.
#
# 🔴 IT IS THE `pk` ENTRY, AND THE WIRING, THAT THE DATABASE PROVES. MEASURED
# 2026-08-05 on the tree before this change: deleting
# `naming_convention=NAMING_CONVENTION` from `Base.metadata`, changing `pk` to
# `%(table_name)s_pkey`, and narrowing `ix` from `column_0_N_name` to
# `column_0_name` each left the suite at `159 passed` — `alembic check` does not
# compare constraint NAMES. `test_every_table_has_the_primary_key_it_is_supposed
# _to_have` now reads `pk_<table>` out of `pg_constraint`, which kills the first
# two. The other four patterns name no constraint that exists yet, so
# `test_the_naming_convention_is_exactly_these_five_patterns` pins them as
# literals instead; see that test for why reading them back from here would pin
# nothing.
NAMING_CONVENTION: Final[dict[str, str]] = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# 🔴 EXACTLY FOUR LABELS, IN THIS ORDER. `migrations/versions/0001_skeleton.py`
# repeats this tuple verbatim and `tests/test_schema_migration.py` asserts the
# live `pg_enum` against it — on the count AND on `enumsortorder`, separately,
# because a reordering leaves the count untouched.
#
# The repetition is deliberate: a migration is a frozen snapshot of a schema at
# one revision, and importing this constant into `0001` would let a later edit
# here silently rewrite what `0001` claims to have created. The test is what
# keeps the two honest.
#
# WHY AN ENUM AND NOT A `text` COLUMN WITH A CHECK. An unknown value becomes a
# WRITE error at the moment some engine invents one, rather than a read-time
# surprise in a screen months later. `pending` and `unsettled` are deliberately
# absent — those are pipeline STATES, not reasons a value is absent, and
# collapsing the two is the confusion this column exists to prevent.
#
# `NOT_PRESENT` and `PRESENT_UNREADABLE` must never be collapsed (CLAUDE.md, and
# CONTEXT §11): "the field is not on the page" and "the field is on the page and
# the ink is gone" lead to different work.
NA_REASON_LABELS: Final = ("NOT_PRESENT", "NOT_FOUND", "NOT_STATED", "PRESENT_UNREADABLE")

# `create_type=False` because migration `0001` creates the type EXPLICITLY, as
# its own statement with its own line in `downgrade()`. Leaving SQLAlchemy to
# emit `CREATE TYPE` as a side effect of `CREATE TABLE` is how the type ends up
# with no corresponding `DROP TYPE` — `DROP TABLE` does not drop a type, so the
# second `upgrade` after a `downgrade` then dies on `type "na_reason" already
# exists`.
# The type's name in the catalog, as its own constant. `ENUM.name` is typed
# `str | None`, so a test reading it back would have to narrow before it could
# compare anything; and `"na_reason"` was written out three times in
# `tests/test_schema_migration.py` for exactly that reason.
NA_REASON_TYPE_NAME: Final = "na_reason"

NA_REASON: Final = ENUM(*NA_REASON_LABELS, name=NA_REASON_TYPE_NAME, create_type=False)

# `gen_random_uuid()` is in core PostgreSQL from 13 on; no `pgcrypto` extension
# and therefore no extension for the migration to create as a privileged role.
_UUID_DEFAULT: Final = "gen_random_uuid()"
# `now()` is transaction start, which is what a row's creation time means here:
# every row written by one transaction shares it. `clock_timestamp()` would give
# each row its own wall-clock reading and make ordering within a transaction
# depend on statement order.
_NOW_DEFAULT: Final = "now()"


class Base(DeclarativeBase):
    """The declarative base every model and Task 5's repository bound share."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class _Row(Base):
    """`id` and `created_at` — the two columns every table here has.

    `__abstract__` means SQLAlchemy maps no table for this class, so it produces
    no DDL and never appears in `Base.metadata.tables`.
    """

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text(_UUID_DEFAULT)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text(_NOW_DEFAULT)
    )


class _TenantRow(_Row):
    """A row that belongs to exactly one tenant, and says so in its own column.

    `nullable=False` is load-bearing rather than tidy. Task 4's policy is
    `tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid`,
    and `NULL = <anything>` is NULL, which is not true — so a nullable
    `tenant_id` would produce rows no tenant can read and none can delete,
    invisible to every policy and to every test that reads through one. The
    composite primary key below now enforces `NOT NULL` as well; the explicit
    flag stays so that dropping `tenant_id` from the key cannot silently make the
    column nullable.

    ---------------------------------------------------------------------------
    🔴 `tenant_id` IS PART OF THE PRIMARY KEY, AND IT CLOSES A CROSS-TENANT
       EXISTENCE ORACLE THAT RLS CANNOT CLOSE.
    ---------------------------------------------------------------------------
    Unique enforcement runs BEFORE a policy's `WITH CHECK`, so under
    `ENABLE` + `FORCE ROW LEVEL SECURITY` with Task 4's `tenant_isolation`
    policy, a `PRIMARY KEY (id)` answers "does this id exist in some other
    tenant?" to a caller who can neither read nor count the row. MEASURED
    2026-08-05 against postgres:18.4, one table each way, tenant B connected as
    a non-owner LOGIN role with `app.current_tenant` set to B:

        tenant B, rows visible in orders_pk_id:  0
        tenant B, rows visible in orders_pk_tid: 0

        PK(id)             INSERT an id held only by tenant A
            -> ERROR: duplicate key value violates unique constraint "pk_orders_pk_id"
        PK(id)             INSERT an id held by nobody          -> succeeds
        PK(tenant_id, id)  INSERT an id held only by tenant A   -> succeeds
        PK(tenant_id, id)  INSERT an id held by nobody          -> succeeds

    Two distinguishable answers for two rows tenant B cannot see. It is BOUNDED
    today only because ids are 128-bit and server-generated, so the attacker must
    already hold the id — from a shared link, a support ticket, an exported CSV.
    It stops being bounded the moment a natural key lands, and PRD §7 gives
    `orders` an order number and `pages` a page index. The convention is
    therefore set here, while it is one line per table rather than a rewrite of
    every table and every foreign key referencing them.

    The tenant prefix is also what an RLS-filtered scan wants: every index this
    key backs leads with the column every policy predicate tests.

    `sort_order=-1` is what puts `tenant_id` FIRST in the key. A
    `PrimaryKeyConstraint` object cannot be shared between tables and an explicit
    one in `__table_args__` collides with `_Row.id`'s `primary_key=True` — that
    combination raises `SAWarning: Table 'fields' specifies columns 'id' as
    primary_key=True, not matching locally specified columns 'tenant_id', 'id'`,
    MEASURED 2026-08-05 on SQLAlchemy 2.0. `sort_order` sorts this column ahead
    of the inherited ones, and SQLAlchemy builds the implicit primary key in
    table-column order, so the key comes out `(tenant_id, id)`. MEASURED: the
    emitted DDL is `CONSTRAINT pk_fields PRIMARY KEY (tenant_id, id)`.

    `tests/test_schema_migration.py` reads the key columns back out of
    `pg_constraint` IN KEY ORDER, because nothing else would notice the prefix
    going away.
    """

    __abstract__ = True

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, nullable=False, sort_order=-1
    )


class Tenant(_Row):
    """The registry. Its PRIMARY KEY is the tenant id — see the module docstring.

    `PRIMARY KEY (id)` here, alone of the seven, and it is not the omission
    `_TenantRow` describes: this table's `id` IS a tenant id, so the key is
    already tenant-scoped and there is no second column to prefix it with.
    """

    __tablename__ = "tenants"


class Order(_TenantRow):
    __tablename__ = "orders"


class Package(_TenantRow):
    __tablename__ = "packages"


class Page(_TenantRow):
    __tablename__ = "pages"


class Field(_TenantRow):
    """One extracted field.

    `na_reason` is NULL when the field has a value: a reason for absence is
    meaningless where nothing is absent. It is NOT the third NA state — the two
    NA states are labels of the enum, and `needs_review` is never derived from
    `value IS NULL` (CLAUDE.md). The value column itself is PRD §7's and lands
    with the real model.
    """

    __tablename__ = "fields"

    na_reason: Mapped[str | None] = mapped_column(NA_REASON, nullable=True)


class FieldReading(_TenantRow):
    """One engine's reading of one field.

    🔴 `line_coords` IS NULLABLE AND THE NULLABILITY IS THE POINT. An engine
    without coordinate support declares `null` and never fabricates a box —
    Reader A is a VLM and genuinely cannot cite one. `NOT NULL` here would force
    every adapter to invent coordinates to satisfy the schema, which is the
    "never emit a value you can't cite" principle inverted into a requirement to
    make one up.

    `jsonb` and not `json`: the shape is read and compared, never round-tripped
    for its whitespace.
    """

    __tablename__ = "field_readings"

    line_coords: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)


class AuditLog(_TenantRow):
    """Append-only. The trigger that enforces it is in migration `0001`.

    Nothing in this class says so, because SQLAlchemy metadata cannot express a
    trigger and `alembic check` therefore cannot notice one going missing.
    `tests/test_schema_migration.py` is the only thing holding it.
    """

    __tablename__ = "audit_log"

"""The tenancy spine: `Base`, the two abstract rows, and the two tables that are
here because the system is multi-tenant rather than because it does title search.

**WHAT THIS FILE HOLDS, AS A RULE AND NOT AS AN ACCIDENT.** `Base`, `_Row`,
`_TenantRow`, the naming convention their DDL is emitted under, `tenants` (the
registry `_TenantRow` keys on) and `audit_log` (the append-only record of writes
to every one of them). Nothing else. **A TABLE THAT DESCRIBES TITLE SEARCH LIVES
IN A DOMAIN MODULE**, and there is a mechanical reason for the rule beyond taste:
this module is imported by every other model module, so anything added here is
imported by all of them, and a domain table placed here would be reachable from
modules that have no business knowing it exists. `orders.py`, `packages.py`,
`fields.py`, `documents.py`, `chain.py`, `intake.py`, `escalations.py`,
`delivery.py` and `rulebook.py` import FROM here and never the other way, which
is what keeps the import graph a tree.

**`rules` IS THE ONE TABLE IN THIS PACKAGE DELIBERATELY NOT A `_TenantRow`.** It
lives in `rulebook.py`, and saying so here is the point: every statement below
about "every table" has that one exception, and a reader who met `Rule` first
would otherwise read its missing `tenant_id` as the omission `_TenantRow` warns
about. The ruling that makes it so is stated once, in
`migrations/versions/0003_rules.py`.

**Every tenant table carries its own `tenant_id`, and no policy ever joins to
find one.** `docs/PRD.md` §7's header says "every table has tenant_id", but its
per-table lists spell it out only on `users`, `clients`, `orders` and
`audit_log` — not on `packages`, `pages`, `fields` or `field_readings`, which are
exactly the tables the isolation policy must cover. Almost certainly shorthand;
"almost certainly" is not a sound basis for the one column every RLS policy keys
on. If those tables genuinely lacked it, isolation would have to walk a
four-level FK chain — weaker, slower, and a different policy. §7 must be
corrected to say so explicitly for all six.

`tenants` is the REGISTRY, not a tenant table: its primary key *is* the tenant
id, so the isolation policy keys on `id` there and on `tenant_id` everywhere
else. That split is derived from the presence of a `tenant_id` COLUMN rather than
from a list, which is why `tenants` must not grow one.

**EVERY TENANT TABLE'S PRIMARY KEY IS `(tenant_id, id)`, AND `tenants`' IS
`(id)`.** See `_TenantRow` for the cross-tenant existence oracle that a
single-column `id` primary key opens under `FORCE ROW LEVEL SECURITY`, and for
the measurement.

`Base` is a plain `DeclarativeBase` and **not** `MappedAsDataclass`. The
repository's bound is this exact symbol; the dataclass variant would
additionally impose `__init__` ordering rules on every model for a construction
ergonomic nothing here needs.

**`audit_log`'s append-only trigger is not expressible here.** It lives in
migration `0001` and is proved in `tests/test_schema_migration.py`. SQLAlchemy
metadata has no notion of a trigger, so nothing in this file could carry it and
nothing in `alembic check` will ever notice its absence.

The Postgres enum types this package uses — including the skeleton's three —
live in `enums.py`, which imports nothing from here.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Final

from sqlalchemy import DateTime, MetaData, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 🔴 `_Row` AND `_TenantRow` ARE IN `__all__`, AND THE LEADING UNDERSCORE MEANS
# "ABSTRACT, NEVER A TABLE" RATHER THAN "PRIVATE TO THIS MODULE". Every domain
# module in this package subclasses one of them, so they are the package's
# public declaration surface — and pyright is the machine that decides which of
# those two meanings the underscore has. Under `typeCheckingMode = "strict"`,
# `reportPrivateUsage` fires on every cross-module import of an underscore name
# UNLESS the defining module names it in `__all__`; without this line the split
# of the domain out of `base.py` produced 8 errors, one per importing module,
# MEASURED on this tree. So the declaration below is not documentation — it is
# the difference between a green `uv run pyright` and a red one, and it is what
# keeps a genuinely module-private name from being importable by accident.
#
# `_UUID_DEFAULT` and `_NOW_DEFAULT` are deliberately ABSENT: those are private
# in the ordinary sense, used only by the column definitions in this file, and a
# module that imported one would rightly be an error.
__all__ = ["NAMING_CONVENTION", "AuditLog", "Base", "Tenant", "_Row", "_TenantRow"]

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


class AuditLog(_TenantRow):
    """Append-only. The trigger that enforces it is in migration `0001`.

    Nothing in this class says so, because SQLAlchemy metadata cannot express a
    trigger and `alembic check` therefore cannot notice one going missing.
    `tests/test_schema_migration.py` is the only thing holding it.
    """

    __tablename__ = "audit_log"

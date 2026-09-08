"""Every `jsonb` column in this database is an OBJECT and has a ceiling

Revision ID: 0112
Revises: 0111
Create Date: 2026-09-08

ASSUMED PARENT: `0111`, this worker's own previous revision.

FOUR `jsonb` COLUMNS, NO CHECK ON ANY OF THEM, AND NO SIZE BOUND ANYWHERE
   IN THE SCHEMA. The only limit this system has is `MAX_PAGE_SIZE = 200`,
   which bounds a ROW COUNT and says nothing about what a row weighs.
`clients.delivery_config`, `fields.source_line_coords`,
`field_readings.line_coords` and `procrastinate_jobs.args`. `0001` names the
first half of the gap in the column it created:

    Nor does the column: `jsonb` with no CHECK accepts arrays, strings, numbers
    and `null` as readily as objects. The one thing that will make a non-object
    impossible is a CHECK constraint, and there is none in the skeleton.

This revision is that constraint, on all four, plus the half `0001` did not
raise: **nothing bounds the SIZE.** No write path stores into these columns yet,
so this is latent rather than live — and it is much cheaper now than after the
extraction worker's first row, which is `0090`'s lesson about `fields` in
another column.

## The two clauses, and what each one is for

**`jsonb_typeof(...) = 'object'`** is a SHAPE floor and deliberately not a shape
MODEL. It refuses an array, a string, a number, a boolean and the JSON `null` —
every value whose reader would have to guess. It says nothing about which KEYS a
coordinate object carries, because that model does not exist: `0001` records that
the real coordinate shape "is where it belongs", CLAUDE.md forbids building past
`OPEN`, and a key list invented here would be this migration deciding an engine
contract. `jsonb_typeof('null'::jsonb)` is `'null'`, so a JSON null is refused
here while a SQL NULL stays legal on the three nullable columns — which is the
`na_reason` distinction one table over, and the reason the two are not collapsed.

**`pg_column_size(...) <= MAX_JSONB_BYTES`** is the DoS ceiling.

MEASURED 2026-09-08 against postgres:18.4, which is what makes
`pg_column_size` the right function here rather than a hazard:

    CREATE TEMP TABLE p(j jsonb CHECK (pg_column_size(j) <= 65536));
    INSERT INTO p VALUES (jsonb_build_object('a', repeat('a', 1024*1024)));
    -> ERROR: new row for relation "p" violates check constraint

A megabyte of one repeated byte compresses to almost nothing ON DISK, so a bound
read off a stored datum would have admitted it. A CHECK is evaluated on the tuple
BEFORE TOAST compression, so `pg_column_size` there is the UNCOMPRESSED size —
which is the number an attacker controls and the number a reader has to
deserialise. `octet_length(x::text)` measures the same thing and costs a full
serialisation per write; measured on the same run, the two agree within the
binary format's small constant overhead (97 vs 59 bytes on a coordinate object,
144 vs 112 on a delivery config), and `pg_column_size` is the cheaper.

## Why ONE number for four columns

64 KiB is not four coincidences that happen to be equal — it is one rule, and
`CONVENTIONS.md` §11.4's "do not collapse two constants that merely happen to be
equal today" is about the other case. This is a CEILING, not a size model: the
four columns' honest sizes differ by orders of magnitude and none of them is
described by this number. Measured against real values, 64 KiB is roughly 450x a
coordinate object (97 bytes) and 450x a delivery config (144 bytes), and
`0060`'s convention for `args` is "identifiers only — a tenant id, an order id,
a page". A per-column bound would be four numbers nobody can defend individually
and four places to update.

## WHAT THIS DOES NOT CLOSE, WITH THE ARITHMETIC

**A FULL PAGE OF MAXIMUM-SIZE VALUES IS STILL ~13 MB.** `MAX_PAGE_SIZE = 200`
rows times 64 KiB is 12.8 MB of JSON in one response, which is a bound and not a
comfortable one. What would close it is a per-column bound derived from the real
coordinate model once that model exists, or a response-size ceiling in the read
path — neither belongs in a migration.

**DEPTH IS BOUNDED ONLY BY SIZE.** A 64 KiB payload can still nest a few
thousand levels deep, and nothing here counts levels. PostgreSQL's own `jsonb`
parser refuses beyond its recursion limit, which is a backend property rather
than a schema one, so this is stated rather than claimed.

**THE SHAPE FLOOR IS A FLOOR.** `{}` satisfies every constraint here. A client
whose `delivery_config` is an empty object is the fabricated-absence value
`0080` argues against — that column is nullable precisely so an absence can be
NULL — and no constraint distinguishes the two. That is a write-path rule.

## Not the FORCE dance `0110` needed, and the difference is measured

`0110` drops `FORCE ROW LEVEL SECURITY` around its `ADD CONSTRAINT` because a
FOREIGN KEY is validated by an ORDINARY SQL QUERY that a policy filters to zero
rows, leaving the constraint marked valid over a table that violates it. **A
CHECK constraint is not validated that way.** Measured on this cluster, one
`clients` row holding a JSON ARRAY, as `titlepipe_owner` under FORCE:

    ALTER TABLE clients ADD CONSTRAINT ck_probe
      CHECK (delivery_config IS NULL OR jsonb_typeof(delivery_config) = 'object');
    ERROR:  check constraint "ck_probe" of relation "clients" is violated by some row

It refused, and `pg_constraint` held no row for it afterwards. So this revision
adds its four constraints plainly, and the absence of the dance is a measured
decision rather than an oversight — copying `0110`'s form here would drop FORCE
on three tables for no reason at all.

## `procrastinate_jobs` is a vendored table and gets the constraint anyway

`0060` installs the queue's own schema, and nothing in `db/models` maps it — so
`alembic check` never looks at it and this constraint causes no drift. It is
included because it is the one of the four with a LIVE write path: `args` is
`NOT NULL DEFAULT '{}'`, every deferred job carries one, and a payload written
through `procrastinate_defer_jobs_v1` is stored with no ceiling of any kind. The
queue tables carry no row-level security at all (`relrowsecurity = false`, read
from `pg_class` on this cluster), so there was no policy in front of it either.

Its column is NOT NULL, so its constraint has no `IS NULL` branch — a null arm
on a column that cannot be null is a reader wondering which of the two facts is
wrong.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0112"
down_revision: str | None = "0111"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 64 KiB. See the module docstring for the measurement behind `pg_column_size`
# and for why this is one number rather than four.
MAX_JSONB_BYTES = 65536

# BARE RULE NAMES, NOT RENDERED ONES. `base.NAMING_CONVENTION`'s `ck` pattern
# is `ck_%(table_name)s_%(constraint_name)s`, and alembic applies it to whatever
# `create_check_constraint` is given — `0111` measured what a full name produces:
# `ck_<table>_ck_<table>_…`, truncated to 63 bytes with a hash suffix, so
# `upgrade` succeeded and `downgrade` could not find its own constraint.
#
# table -> (column, is the column nullable). The nullability decides whether the
# constraint carries an `IS NULL` arm, and it is data rather than four hand-
# written expressions because the difference between the four IS only the column
# name and that flag.
JSONB_COLUMNS: tuple[tuple[str, str, bool], ...] = (
    ("clients", "delivery_config", True),
    ("fields", "source_line_coords", True),
    ("field_readings", "line_coords", True),
    # `NOT NULL DEFAULT '{}'`, and the only one of the four with a live writer.
    ("procrastinate_jobs", "args", False),
)


def _rule_name(column: str) -> str:
    """`<column>_is_a_bounded_object` — the bare half of `ck_<table>_<rule>`.

    The longest this produces is
    `ck_field_readings_line_coords_is_a_bounded_object` at 48 bytes, inside the
    63-byte identifier limit `relations.tenant_fk` documents.
    """
    return f"{column}_is_a_bounded_object"


def _condition(column: str, nullable: bool) -> str:
    """The two clauses, with the `IS NULL` arm only where a null is legal."""
    bounded_object = (
        f"jsonb_typeof({column}) = 'object' AND pg_column_size({column}) <= {MAX_JSONB_BYTES}"
    )
    return f"{column} IS NULL OR ({bounded_object})" if nullable else bounded_object


def upgrade() -> None:
    for table, column, nullable in JSONB_COLUMNS:
        op.create_check_constraint(_rule_name(column), table, _condition(column, nullable))


def downgrade() -> None:
    for table, column, _ in JSONB_COLUMNS:
        op.drop_constraint(_rule_name(column), table, type_="check")

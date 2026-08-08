"""The global `rules` table and its two enums

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-06

---------------------------------------------------------------------------
🔴 `rules` IS GLOBAL. NO `tenant_id`, NO POLICY, NO ROW-LEVEL SECURITY, AND
   EVERY ONE OF THOSE THREE IS THE RULING RATHER THAN AN OMISSION.
---------------------------------------------------------------------------
RULED 2026-08-05 (Plan 02's tenancy human gate). The rulebook is the shop's own
body of rules, engineer-confirmed and scoped by `jurisdiction_scope` rather than
by customer: two firms searching the same county are governed by the same rule.
`packages/contract/src/entities.ts:153-163` says the same thing from the wire
side — `Rule` carries no tenant and never has. Making it tenant-scoped would mean
every tenant maintaining a private copy of a rulebook that is not theirs.

**THIS IS THE FIRST TABLE IN THIS SCHEMA THAT `0002` DOES NOT APPLY TO, AND
NOTHING IN `0002` WOULD NOTICE.** Its `upgrade()` is seven hardcoded `_isolate`
calls, so a new table is simply not in them. The derivations that DO look —
`tests/test_forced_rls_and_grants.py::_tenant_tables` and
`tests/conftest.py::_isolation_tables` — ask the catalog for a `tenant_id`
column, so a table without one drops out of them SILENTLY. Left at that, `rules`
would ship with no assertion whatsoever about its grants, its RLS state or its
readability. `EXPECTED_GLOBAL_TABLES` in that test module is the exception list
that closes it: it is compared against the catalog's answer to "tables in
`public` carrying no `tenant_id` that are not the registry", so a SECOND global
table cannot appear without a deliberate edit there.

**WHAT MUST NOT HAPPEN NEXT.** The tempting repair, the day somebody sees a table
in `public` with no `tenant_isolation` policy on it, is to give `rules` a
`tenant_id`. That is the ruling reversed by accident, and it is why the reason is
written here and in `titlepipe_core.db.models.Rule` rather than left as a name on
a list.

## The grant is `SELECT` only, and the narrowness is deliberate

Plan 02 Task 4 is `GET /api/rules` — read-only. Rule CREATION and the
engineer-confirm write arrive in Plan 05 and will add their own grants alongside
their own refusal tests, because "who may write a rule" is a domain question with
an answer (`CLAUDE.md`: escalation resolution is refused without a rule, and only
an engineer may confirm a PENDING one) and not a privilege to hand out in advance
of the code that enforces it. `titlepipe_worker` gets nothing here, exactly as it
gets nothing in `0002`.

**`SELECT` REACHES EVERY ROW OF EVERY `status`, INCLUDING `pending`.** Ruled by
the owner: a PENDING rule is VISIBLE to everyone; only an engineer may CONFIRM
one. "Cannot affect the pipeline" is a statement about effect, not visibility, so
nothing here and nothing in Task 4 filters on read.

## What this revision borrows from `0001` and why it is copied rather than imported

`0001`'s three `--autogenerate` lessons apply unchanged, and the enum one applies
TWICE over now:

**BOTH TYPES ARE CREATED AND DROPPED EXPLICITLY.** `DROP TABLE` does not drop a
type. A `downgrade()` that only drops the table leaves `rule_status` and
`rule_origin` behind, and the NEXT `upgrade` dies on `type "rule_status" already
exists` — a fresh database migrates fine, so only a round trip finds it.
`tests/test_schema_migration.py::test_upgrade_downgrade_upgrade_is_clean` is that
round trip, and it now diffs the whole of `public` rather than the table set.

**THE LABELS ARE REPEATED HERE RATHER THAN IMPORTED FROM
`titlepipe_core.db.models`**, exactly as `0001` repeats `NA_REASON_LABELS`: a
migration is a frozen snapshot of one revision, and an import would let a later
edit to the model silently rewrite what `0003` claims to have created.
**NOTHING READS THIS FILE'S TUPLES DIRECTLY**, and an earlier version of this
paragraph said a test "separately compares this file's copy with the model's".
It does not; there is no such comparison anywhere. The two copies are kept honest
VIA THE LIVE CATALOG, in two legs, and it is worth knowing which leg catches
what because they catch different mutations:

* `test_the_rulebook_enums_have_exactly_these_labels_in_exactly_this_order`
  asserts `RULE_STATUS_LABELS`/`RULE_ORIGIN_LABELS` **as LITERALS written out in
  the test**. That is what catches an edit made to BOTH copies at once — the
  mutation that renamed two `na_reason` labels in `models.py` and `0001` together
  and left the suite green;
* the same test then compares the live `pg_enum` — which PostgreSQL built from
  THIS file's tuples — against the model's constants, on the count and on
  `enumsortorder` separately. That is what catches an edit to ONE copy: change
  this file alone and the live type stops matching the model; change the model
  alone and it stops matching the live type. VERIFIED both ways, 2026-08-06.

So the property holds transitively — this file -> the live type -> the model ->
a literal — and no assertion reads this source. It has to work that way for
enums: `alembic check` DOES NOT COMPARE ENUM LABELS, verified in Plan 01 Task 3
and recorded in `01-WHAT-HAPPENED.md` §3.11 item 8 — a fifth label and a
reordering both leave it green.

## `PRIMARY KEY (id)`, and why that is not the omission `0001` warns about

`0001::_tenant_primary_key` measures a cross-tenant existence oracle that a
single-column `id` key opens under `FORCE ROW LEVEL SECURITY`: unique enforcement
runs before a policy's `WITH CHECK`, so an insert distinguishes an id held by
another tenant from an id held by nobody, to a caller who can read neither. The
composite `(tenant_id, id)` exists to close exactly that. **There is no other
tenant here, and no policy** — so there is nothing to prefix `id` with, and a
composite key would have no second column to be composite of.

## No data is written here

`titlepipe_owner` is who `migrations/env.py` runs as, and `0002`'s `FORCE ROW
LEVEL SECURITY` makes every TENANT table invisible to it — the silent-`UPDATE 0`
trap `0001` and `0002` both document at length. `rules` is not forced and not
policied, so a data migration against THIS table would in fact work. It still
does not happen here: the rulebook's contents are content, not schema, and
seeding them from a revision would make the migration chain the authority for
what the rules say.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 EXACTLY THESE LABELS, IN EXACTLY THIS ORDER. Both tuples are
# `packages/contract/src/enums.ts` verbatim — `RuleStatus` at :72, `RuleOrigin` at
# :75-81 — and are repeated here rather than imported, for the reason the module
# docstring gives. `enumsortorder` is what `<`, `ORDER BY` and `MIN()` on these
# types use, so the order is the server's business and not only ours.
RULE_STATUS_LABELS = ("live", "pending", "retired")
RULE_ORIGIN_LABELS = ("spec", "escalation", "reconciliation", "complaint", "senior")

RULE_STATUS_TYPE_NAME = "rule_status"
RULE_ORIGIN_TYPE_NAME = "rule_origin"

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE` as
# a side effect of the column. Each type is created and dropped by its own
# explicit statement below, which is the only way either gets a `DROP` at all.
RULE_STATUS = postgresql.ENUM(*RULE_STATUS_LABELS, name=RULE_STATUS_TYPE_NAME, create_type=False)
RULE_ORIGIN = postgresql.ENUM(*RULE_ORIGIN_LABELS, name=RULE_ORIGIN_TYPE_NAME, create_type=False)


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`.

    A near-copy of that function, and deliberately not an import from it: a
    migration is a frozen snapshot, and `0003` would otherwise be rewritten by an
    edit to `0001`. The heterogeneous tuple return is `0001`'s too and is load
    bearing rather than stylistic — `Column` is INVARIANT in its type parameter,
    so `Column[UUID]` is not assignable to `Column[object]` and pyright reports
    `reportReturnType` for the honest-looking `list[Column[object]]`.

    `created_at` is a DATABASE column and not a wire field. `entities.ts` lists
    nine columns for `Rule` and this is the tenth; every other table in this
    schema carries it, and Task 3 shapes the response without exposing it.
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


def _enum_column(name: str, enum: postgresql.ENUM) -> sa.Column[str]:
    """One `NOT NULL` enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED, and `0001::_na_reason_column` holds the measurement:
    `postgresql.ENUM` carries no type argument in SQLAlchemy's annotations, so the
    expression infers `Column[Unknown]` and `Column[complex]` type-checks exactly
    as happily as `Column[str]`. What makes `str` the right one is that the
    identical column spelled with the generic `sa.Enum` infers `Column[str]`, and
    that these columns hold one of a fixed set of label strings and nothing else.
    Without it, `op.create_table` reports `reportUnknownArgumentType`.

    `NOT NULL` on both: a rule with no origin cannot be cited and a rule with no
    status cannot be excluded from the pipeline, so neither absence has a meaning
    for this table to record. That is the opposite of `0001`'s `na_reason`, which
    is nullable precisely because "no reason for absence" is what a present value
    means.
    """
    return sa.Column(name, enum, nullable=False)


def upgrade() -> None:
    # `checkfirst=False` for `0001`'s reason: a type that already exists here
    # means a previous `downgrade` failed to drop it, and that must be an error
    # rather than a silent reuse of whatever labels the old type happened to
    # carry. Like `0001`'s, this guard is never exercised by the suite — it fires
    # only when `downgrade()` is already broken, and the round trip always
    # downgrades cleanly first — so it is pinned by the SOURCE assertion in
    # `tests/test_schema_migration.py::test_the_migration_source_refuses_the
    # _forgiving_spellings`, which is honest about being one.
    RULE_STATUS.create(op.get_bind(), checkfirst=False)
    RULE_ORIGIN.create(op.get_bind(), checkfirst=False)

    # 🔴 NO `tenant_id` AND NO `PrimaryKeyConstraint("tenant_id", "id")`. See the
    # module docstring: this is the ruling, and `id` alone is the whole key
    # because there is no tenant to prefix it with.
    #
    # `Text` and not `String(n)`: nothing in `entities.ts` bounds any of these,
    # and a length nobody chose is a migration the first time a rule outgrows it.
    op.create_table(
        # Literal, like every table name in `0001` and `0002`: one reviewable
        # line per object, and a name that cannot be reached by editing a
        # constant somewhere else in the file.
        "rules",
        *_identity_columns(),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        _enum_column("origin", RULE_ORIGIN),
        _enum_column("status", RULE_STATUS),
        sa.Column("jurisdiction_scope", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("confirmed_by", sa.Text(), nullable=True),
        sa.Column("source_doc_ref", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # 🔴 `SELECT` ONLY, AND NO `ENABLE ROW LEVEL SECURITY` ANYWHERE ABOVE.
    #
    # RLS is evaluated AFTER the privilege check and never instead of it, so this
    # grant is what makes the table reachable at all; without it `titlepipe_app`
    # gets `42501 permission denied for table rules` and a read test would report
    # zero rows and call it something else. What it reaches is EVERY row, on a
    # session that has established no tenant — that is the globality claim, and
    # `tests/test_forced_rls_and_grants.py::test_the_rulebook_is_readable_with_no
    # _tenant_established` is the positive control for it.
    #
    # No `INSERT`, no `UPDATE`: see the module docstring. `titlepipe_worker` is
    # named nowhere here, exactly as in `0002`.
    op.execute("GRANT SELECT ON rules TO titlepipe_app")


def downgrade() -> None:
    # The REVOKE before the DROP, which is theatre in isolation — `DROP TABLE`
    # takes the ACL with it — and is kept because `0002` states the rule it
    # follows: a revoke reaches only the rows where `titlepipe_owner` is the
    # grantor, and writing it out means the day this table stops being dropped
    # here, the grant is still reversed.
    op.execute("REVOKE SELECT ON rules FROM titlepipe_app")
    op.drop_table("rules")

    # 🔴 `DROP TABLE` DOES NOT DROP A TYPE. Without these two lines a fresh
    # upgrade still works and only the SECOND one — the one after a downgrade —
    # fails, with `type "rule_status" already exists`. Dropped in the reverse of
    # creation order, which nothing enforces today and which stays correct when a
    # later revision adds a type that depends on one of these.
    RULE_ORIGIN.drop(op.get_bind(), checkfirst=False)
    RULE_STATUS.drop(op.get_bind(), checkfirst=False)

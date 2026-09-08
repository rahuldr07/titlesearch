"""A ledger row that can never apply is SUPERSEDED by a further row, not deleted

Revision ID: 0111
Revises: 0110
Create Date: 2026-09-08

ASSUMED PARENT: `0110`, this worker's own previous revision.

---------------------------------------------------------------------------
🔴 THE DEFECT: ONE INSERT PERMANENTLY BRICKS A GOLDEN FIELD, AND NO ATTACKER
   IS NEEDED.
---------------------------------------------------------------------------
`0072` moves a golden value only when a `golden_corrections` row describes
exactly that transition at exactly `OLD.revision + 1`. `0071` makes at most one
row exist per `(tenant, field, revision_after)` and makes the table append-only
for the owner AND for a superuser. Those three rules compose into a trap:

1. a client writes a ledger row for revision N+1 whose `value_before` came from
   a read older than the field's current state — an ordinary read-modify-write
   race between two operators, or one retry that re-reads the revision and
   re-sends a stale before-image;
2. the row commits. Its before-state does not describe revision N, so `0072`
   refuses every UPDATE it could authorise. It is dead;
3. the corrected row cannot be written — `uq_golden_corrections_tenant_id
   _golden_field_id_revision_after` says the slot is taken;
4. the dead row cannot be repaired — the append-only trigger refuses UPDATE;
5. it cannot be removed — the same trigger refuses DELETE, at `ENABLE ALWAYS`,
   for every role including a superuser;
6. and no LATER revision can be reached, because `0072` requires exactly +1.

The field is frozen at revision N forever. `titlepipe_app` has no path out and
neither has anybody else: this is the one shape in the schema where a legal
INSERT by an ordinary caller destroys a row's future.

---------------------------------------------------------------------------
THE RULING: MARKED, NOT DELETED — AND MARKED BY A FURTHER APPEND, NOT AN UPDATE
---------------------------------------------------------------------------
The question this revision was asked is whether a superseded row may be MARKED
rather than deleted. It may — but a `superseded_at` column set in place would be
an UPDATE of a ledger row, and the append-only trigger is the strongest control
in this schema. Weakening it to permit "just one harmless column" is how an
append-only table stops being one.

So the mark points the other way: the NEW row names the row it replaces.
`supersedes_correction_id` is written once, at INSERT, by the row that takes
over. Nothing about an existing ledger row ever changes, the trigger is untouched
at `tgenabled = 'A'`, and the dead row stays permanently readable as part of the
record — which is what it should be. It is evidence of a failed correction, not
litter.

## FOUR CONSTRAINTS, NO TRIGGER, AND THAT IS DELIBERATE

Every rule below is a key or a CHECK. A `BEFORE ROW` trigger is refused outright
by `test_exact_acl_and_update_surface.py`, and an `AFTER ROW` one would put this
table's shape into plpgsql where `alembic check` cannot see it.

1. **`fk_golden_corrections_supersedes_the_same_slot`** — FOUR columns, not two.
   `(tenant_id, supersedes_correction_id, golden_field_id, revision_after)`
   references `(tenant_id, id, golden_field_id, revision_after)`, so a row can
   only supersede a row **of the same field at the same revision**. A two-column
   key would have let a recovery row point at some unrelated correction and then
   sit, unindexed by the partial unique below, as a SECOND live claim on its own
   slot. The extra unique constraint `uq_golden_corrections_id_names_its_field
   _and_revision` exists only to be that key's target — PostgreSQL requires a
   unique constraint over the referenced columns, and `(tenant_id, id)` is the
   primary key with two more columns bolted on, so it adds no new uniqueness
   claim at all.

   MATCH SIMPLE — the default — is what makes this apply to superseding rows
   only: with `supersedes_correction_id` NULL the constraint is not checked, and
   an ORIGINAL row is exempt without needing to be described as one anywhere.

2. **`uq_golden_corrections_tenant_id_supersedes_correction_id`** — a row is
   superseded AT MOST ONCE, so the chain never forks. NULLs are distinct in a
   PostgreSQL unique index, so the many rows that supersede nothing do not
   collide.

3. **`ix_golden_corrections_one_original_claim_per_revision`** — `0071`'s unique
   constraint, made PARTIAL on `supersedes_correction_id IS NULL`. Exactly one
   ORIGINAL claim per `(tenant, field, revision_after)`; every further claim on
   that slot must say which row it replaces. An `Index` and not a
   `UniqueConstraint` because the whole point is that the replaced rows stay —
   the same reason `0051` states for `ix_client_config_versions_one_current
   _per_client_product`.

4. **`ck_golden_corrections_a_row_does_not_supersede_itself`** — a row naming its
   own id would be a chain with no original, invisible to the partial index.

**WHAT THE FOUR COMPOSE TO.** Per slot, the rows form a single path: no fork
(2), no cross-slot edge (1), no self-loop (4), and no cycle — a foreign key is
immediate, so a row can only reference one that already exists. Every path ends
at a row with `supersedes_correction_id IS NULL`, and (3) says there is exactly
one of those. So a slot still has EXACTLY ONE LIVE CLAIM: the row nothing
supersedes. "Who made revision N+1" still has one answer, which is the property
`0071`'s unique constraint was there for.

## THE RECOVERY PATH, WRITTEN OUT BECAUSE IT IS THE POINT OF THE REVISION

A field stuck at revision N with a dead row D at revision N+1:

    INSERT INTO golden_corrections
      (tenant_id, golden_field_id, act, signed_by, reason, source_citation,
       tag_before, tag_after, value_before, value_after,
       na_reason_before, na_reason_after, revision_after,
       supersedes_correction_id)
    VALUES (…, <the TRUE before-state, read now>, …, N + 1, D.id);

then the ordinary `UPDATE golden_fields`, which `0072` now finds a matching row
for. Two signatures survive in the record — D's, and the recovery's — and the
`supersedes_correction_id` edge says which replaced which and in what order.
No DELETE, no UPDATE, no privilege beyond the `INSERT` `0071` already grants
`titlepipe_app`.

## 🔴 WHAT THIS DOES NOT CLOSE

**A SUPERSEDED ROW IS NOT REVOKED.** `0072`'s trigger asks "does a
`golden_corrections` row sign this change", not "does the LIVE one". So if a row
that COULD have applied is superseded by one describing a different transition,
either is still able to authorise its own transition. The reachable case is two
signed, sourced, reasoned corrections competing — not a forgery, and the
supersession edge records the order — but it is a real gap and it is stated
rather than implied.

**WHAT WOULD CLOSE IT:** one more leg on `0072`'s `NOT EXISTS`, requiring that
nothing supersede the matching row. It is NOT done here, and the reason is
`CONVENTIONS.md` §11.2 rather than effort: closing it from this revision means
either a second trigger carrying a copy of `0072`'s nine-clause match — two
lists that must agree and will silently stop agreeing, which is the failure that
produced several of this codebase's findings — or a `CREATE FUNCTION` replacing
a body that `tests/test_trigger_function_bodies.py` pins by digest. Both belong
in a revision that OWNS that function.

**AND NOTHING HERE STOPS THE BRICK BEING WRITTEN.** It stops it being permanent.
A caller that computes its before-image from a stale read still writes a dead
row; what changed is that the field has a way forward afterwards.

## No new `act` label

A recovery row is still a `correct`, a `confirm` or a `demote` — the act is what
was done to the truth, and "this replaces an earlier attempt" is a different axis
that the column above carries. `CONVENTIONS.md` §4 forbids inventing an enum
member for a set the source of truth has not published, and `golden_act` is that
kind of set.

## Two indexes over overlapping columns, on purpose

`0071` declined a second index because its unique constraint served both
uniqueness and `0072`'s per-row lookup. That is no longer one object: the unique
half is now PARTIAL and does not index superseding rows, which are exactly the
rows `0072` has to find after a recovery. `ix_golden_corrections_tenant_id
_golden_field_id_revision_after` is the read; the partial index is the rule. On
an append-only ledger the extra write cost is one index entry per correction.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0111"
down_revision: str | None = "0110"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLE = "golden_corrections"
COLUMN = "supersedes_correction_id"

# `0071`'s constraint, which this revision replaces with a partial index of a
# different name. Spelled out rather than rebuilt from the convention for the
# reason every revision in this chain gives: a migration is a frozen snapshot.
ORIGINAL_UNIQUE = "uq_golden_corrections_tenant_id_golden_field_id_revision_after"

# 🔴 THE FOUR NAMES ARE EXPLICIT BECAUSE THREE OF THEM OVERFLOW.
# `base.NAMING_CONVENTION` renders a foreign key as
# `fk_<table>_<columns>_<target>`, which for four columns on this table comes to
# 106 bytes against a 63-byte limit, and `uq_<table>_<columns>` for the FK's
# target comes to 65. `relations.tenant_fk` states the rule for the overflow it
# documents — drop the redundant part, keep what identifies the object — and
# these follow it by naming the RULE instead of the column list. PostgreSQL
# TRUNCATES rather than refusing, and a truncated name is permanent drift between
# the model and the catalog; `tests/test_model_identifiers.py` is what catches a
# missed one.
SLOT_UNIQUE = "uq_golden_corrections_id_names_its_field_and_revision"
SLOT_FOREIGN_KEY = "fk_golden_corrections_supersedes_the_same_slot"
CHAIN_UNIQUE = "uq_golden_corrections_tenant_id_supersedes_correction_id"
ORIGINAL_CLAIM_INDEX = "ix_golden_corrections_one_original_claim_per_revision"

# 🔴 THE BARE RULE NAME, NOT THE RENDERED ONE, AND BOTH ENDS HAVE TO AGREE.
# `base.NAMING_CONVENTION`'s `ck` pattern is the only one that takes
# `%(constraint_name)s`, so alembic prefixes whatever is passed here — a full
# `ck_golden_corrections_…` reaches the catalog as
# `ck_golden_corrections_ck_golden_corrections_…`, TRUNCATED TO 63 with a hash
# suffix. MEASURED on this tree: `upgrade` succeeded and `downgrade` died with
# `constraint "ck_golden_corrections_ck_golden_corrections_a_row_does__a495" of
# relation "golden_corrections" does not exist`. The `uq` and `fk` patterns name
# no constraint, so those constants stay full names.
SELF_REFERENCE_CHECK = "a_row_does_not_supersede_itself"
LOOKUP_INDEX = "ix_golden_corrections_tenant_id_golden_field_id_revision_after"

SLOT_COLUMNS = ("tenant_id", "golden_field_id", "revision_after")


def upgrade() -> None:
    op.add_column(TABLE, sa.Column(COLUMN, postgresql.UUID(as_uuid=True), nullable=True))

    op.create_unique_constraint(
        SLOT_UNIQUE, TABLE, ["tenant_id", "id", "golden_field_id", "revision_after"]
    )
    op.create_foreign_key(
        SLOT_FOREIGN_KEY,
        TABLE,
        TABLE,
        ["tenant_id", COLUMN, "golden_field_id", "revision_after"],
        ["tenant_id", "id", "golden_field_id", "revision_after"],
    )
    op.create_unique_constraint(CHAIN_UNIQUE, TABLE, ["tenant_id", COLUMN])
    op.create_check_constraint(SELF_REFERENCE_CHECK, TABLE, f"{COLUMN} IS NULL OR {COLUMN} <> id")

    # The read index BEFORE the unique constraint is dropped, so there is no
    # instant at which `0072`'s per-row lookup has no index to use. Inside one
    # transaction nothing else can observe the gap; the ordering is for the
    # reader, and for a future edit that splits this revision.
    op.create_index(LOOKUP_INDEX, TABLE, list(SLOT_COLUMNS))
    op.drop_constraint(ORIGINAL_UNIQUE, TABLE, type_="unique")
    op.create_index(
        ORIGINAL_CLAIM_INDEX,
        TABLE,
        list(SLOT_COLUMNS),
        unique=True,
        postgresql_where=sa.text(f"{COLUMN} IS NULL"),
    )


def downgrade() -> None:
    # 🔴 THIS DOWNGRADE CAN LEGITIMATELY FAIL, AND FAILING IS CORRECT. Restoring
    # `0071`'s TOTAL unique constraint over a table that has used the recovery
    # path raises `23505`: two rows share a slot, which is exactly what this
    # revision made legal. `pass` would be a defect (CONVENTIONS §8); a
    # `DELETE` of the superseded rows to make room would be this revision
    # destroying ledger rows to make itself reversible, which is the one thing
    # the whole design refuses. The operator is told, in the error, that the
    # ledger has content the older schema cannot hold.
    op.drop_index(ORIGINAL_CLAIM_INDEX, table_name=TABLE)
    op.create_unique_constraint(ORIGINAL_UNIQUE, TABLE, list(SLOT_COLUMNS))
    op.drop_index(LOOKUP_INDEX, table_name=TABLE)

    op.drop_constraint(SELF_REFERENCE_CHECK, TABLE, type_="check")
    op.drop_constraint(CHAIN_UNIQUE, TABLE, type_="unique")
    op.drop_constraint(SLOT_FOREIGN_KEY, TABLE, type_="foreignkey")
    op.drop_constraint(SLOT_UNIQUE, TABLE, type_="unique")

    op.drop_column(TABLE, COLUMN)

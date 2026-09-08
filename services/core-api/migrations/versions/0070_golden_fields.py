"""`golden_fields` — the human-established truth the accuracy programme is measured against

Revision ID: 0070
Revises: 0004
Create Date: 2026-09-05

ASSUMED PARENT: `0004`, which is the chain head as this worktree found it.
CONVENTIONS §8 forbids guessing a `down_revision` while several workers write
revisions at once; the chain is linearised at integration and this file is not
rebased onto anybody else's.

WHAT THIS TABLE IS FOR. Every accuracy number in this system currently reads
   `NO_TRUTH_YET`, because no golden set exists for either measured package.
   Cross-engine agreement is NOT a substitute — three engines agreed on a WRONG
   reading at 0.20 confidence on the worst pages of one package (PLAN §6). This
   table is the only thing that can settle which reading was right.

## The distinction this schema exists to make unrepresentable

A golden value is a HUMAN-ESTABLISHED truth about one field on one order. An
engine value is a model's output. The hazard is not that somebody confuses the
two while looking at them; it is that a QUERY does, and then a leaderboard
reports a model's agreement with itself as accuracy.

**THE MACHINES, NAMED.** Each is a thing that exists, not a property asserted in
prose:

1. **A SEPARATE TABLE, AND NO DISCRIMINATOR ANYWHERE.** The truth does not live
   as a flagged row inside `field_readings`, and no table in this schema carries
   an `is_golden` column. A boolean flag is the failure this arrangement rules
   out: one query that forgets `WHERE is_golden` counts model output as truth,
   and nothing about that query looks wrong.
   `tests/test_golden_set.py::test_no_table_in_the_schema_carries_a_golden_flag`
   reads `pg_attribute` for the whole of `public` and is what notices the day
   somebody adds one.

2. **THERE IS NOWHERE TO PUT A MODEL OUTPUT.** This table has no `engine_id`, no
   `engine_version`, no `confidence`, no `model`. A row cannot record which
   engine produced it because no column can hold that, so "promote this reading
   to golden" has no shape here — it would have to be typed in by a person, with
   a citation and a reason, like every other row.
   `tests/test_golden_set.py::test_golden_and_engine_vocabularies_never_meet_in
   _one_relation` is the closed-world version: no relation in `public` may carry
   a column from the golden vocabulary AND one from the engine vocabulary.

3. **THE SIGNER IS CHECKED AGAINST THE ENGINE NAMESPACE.**
   `ck_golden_fields_established_by_is_not_an_engine` refuses an
   `established_by` spelled `engine:<anything>`, and
   `ck_golden_fields_established_by_is_signed` refuses a blank one and the
   literal `unknown` — the `?? "unknown"` fallback the mock's golden endpoint
   ships today, which signs a permanent, unreversible correction with a name
   that identifies nobody and returns 201 (PLAN §5).
   **BE PRECISE ABOUT WHAT THIS PROVES.** It enforces a NAMESPACE, not humanity.
   The database cannot know whether `L. Vance` is a person; what it can do is
   make the two spellings a machine would actually use — an engine identity and
   the absent-signer sentinel — impossible to store. Everything past that is the
   session-derived signer, which is another card's and does not exist yet in any
   build.

4. **THE TAG VOCABULARY HAS NO MACHINE LABEL.** `golden_tag` is exactly
   `delivered_report`, `ruled`, `suspect`, `agreed` — four ways a HUMAN came to
   hold a value, and no fifth meaning "an engine was confident". An
   engine-derived truth is not merely discouraged; it has no label.

## `tenant_id`, and the tension with PLAN §1 that this file is resolving

PLAN §1 calls the golden set "cross-customer by nature" in the argument against
a database per tenant. **This table is nonetheless TENANT-SCOPED**, on god's
instruction and on the shape of the row: a golden value quotes the content of
one tenant's document, reached through `order_id`, and a global table would make
one customer's deed text readable by every other. What PLAN §1 needs is that the
golden set live in the SAME database as everything else, which it does; the
cross-tenant AGGREGATE is a question about who may read across tenants, and that
is a role, not a missing column. If the owner meant the rows themselves to be
global, this is the file to reverse and the decision is stated here rather than
implied by the absence of a column.

## `value` and `na_reason`, and why exactly one of them is always present

`ck_golden_fields_value_xor_na_reason` requires `num_nonnulls(value, na_reason)
= 1`. Two things fall out, and both are hard rules elsewhere in this codebase:

* **THE TWO NA STATES CANNOT COLLAPSE.** A golden row that says "the truth is
  that this field is NOT PRESENT in the document" and one that says "the truth
  is that it is PRESENT AND UNREADABLE" are different truths, and an engine
  scored against the wrong one is scored wrongly. `na_reason` is `0001`'s enum,
  reused rather than redeclared.
* **`value IS NULL` IS NEVER READABLE AS "ABSENT".** A row with neither a value
  nor a reason — "somebody started establishing this and stopped" — is
  UNREPRESENTABLE, so no query can find one and treat it as an absence. That is
  the storage-layer form of "never derive absence from a null".

## The `revision` column is not bookkeeping

It is half of `0072`'s machine. A golden value moves only through a
`golden_corrections` row (`0071`), and `revision` is what stops one ledger row
from authorising the same transition twice. It starts at `0`, which is the
establishment itself, and every later state is a correction. See `0072`.

## What is NOT here, stated rather than left to be noticed

**NO `DELETE` REFUSAL ON THIS TABLE.** `titlepipe_app` is granted no `DELETE`,
and that is an ACL, not a trigger — a retention/erasure card owns whether ground
truth is ever destroyed, and pre-empting it with a trigger here would collide
with that design. `0071`'s ledger IS trigger-protected, and the composite
foreign key from it means a truth row with corrections cannot be deleted while
they exist. The residual is real and is named: a role holding `DELETE` on this
table can remove an uncorrected golden row and nothing in the schema refuses.

**NO `established_at`.** The row IS the act of establishing, so `created_at` is
when it happened. A second timestamp would be a second answer to one question
and a place for the two to disagree.

## Constraint names use the tree's live convention, not CONVENTIONS §3's prose

`models.NAMING_CONVENTION` renders `ck_%(table_name)s_%(constraint_name)s` — one
underscore — and every constraint already in this schema is spelled that way.
CONVENTIONS §3 writes `ck_<table>__<rule>` with two. The live convention wins
because `alembic check` and `tests/test_schema_migration.py` compare against it;
the divergence is written down here so it reads as a decision.

RELINKED AT INTEGRATION, 2026-09-05: `down_revision` was `0004` - the head as this file's
author found it, per CONVENTIONS section 8 - and is now `0060`, the queue revision, which is the head of the chain as integrated. `golden_fields` references
`orders`, which exists from `0001`; the placement after `0060` is for a single head, not a dependency.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0070"
down_revision: str | None = "0060"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# EXACTLY THESE FOUR LABELS, IN THIS ORDER — `packages/contract/src/enums.ts`
# `GoldenTag` at :70, verbatim. Repeated here rather than imported from
# `titlepipe_core.db.golden_models`, for the reason `0001` and `0003` both give:
# a migration is a frozen snapshot of one revision, and an import would let a
# later edit to the model silently rewrite what `0070` claims to have created.
# `tests/test_golden_set.py` asserts these as LITERALS and separately compares
# the live `pg_enum` against the model's constant, which is the two-leg
# arrangement `0003` records — one leg catches an edit to both copies, the other
# catches an edit to one.
GOLDEN_TAG_LABELS = ("delivered_report", "ruled", "suspect", "agreed")
GOLDEN_TAG_TYPE_NAME = "golden_tag"

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE`
# as a side effect of the column. The type is created and dropped by the two
# explicit statements below, which is the only way it gets a `DROP` at all —
# `DROP TABLE` does not drop a type, and without the explicit drop a fresh
# upgrade still works while the SECOND one, the one after a downgrade, dies on
# `type "golden_tag" already exists`.
GOLDEN_TAG = postgresql.ENUM(*GOLDEN_TAG_LABELS, name=GOLDEN_TAG_TYPE_NAME, create_type=False)

# `0001`'s enum, REUSED. Not recreated: `na_reason` already exists at this
# revision and a second `CREATE TYPE` of the same name is an error. The four
# labels are `0001`'s and this revision does not restate them, because it does
# not create them — the one thing it asserts about them is that
# `PRESENT_UNREADABLE` and `NOT_PRESENT` are distinguishable in a golden row,
# which is a consequence of using the type at all.
NA_REASON = postgresql.ENUM(name="na_reason", create_type=False)

TABLE = "golden_fields"

# The spelling a machine identity takes in a signer column. Nothing enforces
# that engines actually use it — this is a NAMESPACE reservation, and the CHECK
# below is what makes the reserved spelling unstorable in a column that means
# "a person established this".
ENGINE_SUBJECT_NAMESPACE = "engine:"

# The signer sentinel this codebase has already shipped once, in
# `packages/mocks/src/handlers.ts`'s `POST /api/golden/:id/demote`:
# `gf.corrected_by = request.headers.get("x-mock-actor") ?? "unknown"`. Refused
# by name, lower-cased and trimmed, so the fallback cannot land here.
UNSIGNED_SENTINEL = "unknown"

# CHECK CONSTRAINTS ARE NAMED BY THEIR RULE ALONE, NOT BY `ck_<table>_<rule>`.
#
# `models.NAMING_CONVENTION`'s `ck` pattern is `ck_%(table_name)s_%(constraint
# _name)s`, and a naming convention containing `%(constraint_name)s` is applied
# to a constraint that ALREADY HAS a name — the given name becomes the
# `constraint_name` component. Alembic hands `op.create_table` the target
# metadata's convention, so a fully-spelled `name="ck_golden_fields_..."` here
# came out of the database as
# `ck_golden_fields_ck_golden_fields_established_by_is_not_4a03` — doubled, then
# truncated at PostgreSQL's 63-character `NAMEDATALEN` with a hash suffix.
# MEASURED on this tree, which is how it was found: the refusal tests assert the
# constraint NAME and reported the mangled one.
#
# So each `name=` below is the rule and nothing else, and the full spelling in
# the comments and in `tests/test_golden_set.py` is what the convention builds.

POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`.

    A near-copy of that function and deliberately not an import from it, for the
    frozen-snapshot reason above. The heterogeneous tuple return is `0001`'s and
    is load bearing rather than stylistic: `Column` is INVARIANT in its type
    parameter, so `Column[UUID]` is not assignable to `Column[object]` and
    pyright reports `reportReturnType` for the honest-looking
    `list[Column[object]]`.
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


def _enum_column(name: str, enum: postgresql.ENUM, *, nullable: bool) -> sa.Column[str]:
    """One enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED, and `0001::_na_reason_column` holds the measurement:
    `postgresql.ENUM` carries no type argument in SQLAlchemy's annotations, so
    the expression infers `Column[Unknown]` and `Column[complex]` type-checks
    exactly as happily as `Column[str]`. What makes `str` the right one is that
    the identical column spelled with the generic `sa.Enum` infers `Column[str]`,
    and that these columns hold one of a fixed set of label strings and nothing
    else. Without it, `op.create_table` reports `reportUnknownArgumentType`.
    """
    return sa.Column(name, enum, nullable=nullable)


def _not_blank(column: str) -> str:
    """`length(btrim(<column>)) > 0` — a column whose emptiness is not a state.

    Written once because three columns need it and a fourth is in `0071`. A
    zero-length citation and a zero-length reason are the shapes a client sends
    when a required field was made optional somewhere upstream, and they are
    exactly what `NOT NULL` does not catch.
    """
    return f"length(btrim({column})) > 0"


def _signer_is_not_an_engine(column: str) -> str:
    """The engine namespace, refused, case- and whitespace-insensitively.

    `lower(btrim(...))` on both sides so that ` Engine:Reader_A ` is the same
    refusal as `engine:reader_a`. `LIKE` with a trailing `%` rather than
    `starts_with`, which is PostgreSQL 15+ and buys nothing here.
    """
    return f"lower(btrim({column})) NOT LIKE '{ENGINE_SUBJECT_NAMESPACE}%'"


def _signer_is_present(column: str) -> str:
    """Non-blank, and not the absent-signer sentinel.

    A separate constraint from the engine one on purpose: two machines, two
    failure messages. `established_by = ''` and `established_by = 'unknown'` are
    the same defect — a permanent record signed by nobody — and neither is an
    engine, so folding them into `_signer_is_not_an_engine` would report the
    wrong reason.
    """
    return f"{_not_blank(column)} AND lower(btrim({column})) <> '{UNSIGNED_SENTINEL}'"


def upgrade() -> None:
    GOLDEN_TAG.create(op.get_bind(), checkfirst=False)

    op.create_table(
        TABLE,
        *_identity_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        # NULLABLE, and paired with `na_reason` by the XOR check below. Exactly
        # one of the two is present in every row.
        sa.Column("value", sa.Text(), nullable=True),
        _enum_column("na_reason", NA_REASON, nullable=True),
        _enum_column("tag", GOLDEN_TAG, nullable=False),
        # `NOT NULL`, WHICH DIVERGES FROM THE WIRE ON PURPOSE.
        # `packages/contract/src/entities.ts::GoldenField.source_citation` is
        # `z.string().nullable()`. A truth nobody can trace to a document is not
        # a truth this system is allowed to score an engine against ("never emit
        # a value you can't cite"), and the delivered-report seed HAS a citation
        # — the report it came from. Closing it here rather than in the request
        # schema is the shape PLAN §7 asks for: the storage layer, so a
        # citation-free write is a constraint violation rather than a 200 with a
        # discarded string. CONTRACT GAP: the Zod schema should tighten to
        # `.min(1)` when the read model lands.
        sa.Column("source_citation", sa.Text(), nullable=False),
        sa.Column("established_by", sa.Text(), nullable=False),
        sa.Column("established_reason", sa.Text(), nullable=False),
        # `0`, and that is not a fabricated value to satisfy a `NOT NULL`
        # (CONVENTIONS §4): revision 0 IS the establishment. Every later number
        # is a correction, and `0072` is what makes the count mean something.
        sa.Column("revision", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.PrimaryKeyConstraint("tenant_id", "id"),
        # COMPOSITE, AND A SINGLE-COLUMN FK HERE WOULD BE A DEFECT
        # (CONVENTIONS §1). `(tenant_id, order_id)` is what makes it impossible
        # for one tenant's golden row to name another tenant's order — the
        # constraint refuses it, without any policy being consulted.
        sa.ForeignKeyConstraint(
            ("tenant_id", "order_id"),
            ("orders.tenant_id", "orders.id"),
            name="fk_golden_fields_tenant_id_order_id_orders",
        ),
        # One truth per field per order. Tenant-prefixed, so it is not the
        # cross-tenant existence oracle `0001::_tenant_primary_key` measures: the
        # unique check runs before any policy, and an unprefixed
        # `(order_id, path)` would answer "does another tenant hold a golden
        # value at this path?" to a caller who cannot read the row.
        sa.UniqueConstraint(
            "tenant_id", "order_id", "path", name="uq_golden_fields_tenant_id_order_id_path"
        ),
        sa.CheckConstraint("num_nonnulls(value, na_reason) = 1", name="value_xor_na_reason"),
        sa.CheckConstraint(_not_blank("path"), name="path_is_not_blank"),
        sa.CheckConstraint(_not_blank("source_citation"), name="citation_is_not_blank"),
        sa.CheckConstraint(_not_blank("established_reason"), name="reason_is_not_blank"),
        sa.CheckConstraint(_signer_is_present("established_by"), name="established_by_is_signed"),
        sa.CheckConstraint(
            _signer_is_not_an_engine("established_by"),
            name="established_by_is_not_an_engine",
        ),
        sa.CheckConstraint("revision >= 0", name="revision_is_not_negative"),
    )

    # ENABLE, then FORCE, then the policy — `0002::_isolate`'s order and its
    # reasons: `FORCE` alone is not a thing, and creating the policy last means
    # there is no instant, even inside this transaction, at which the table has
    # RLS on and no policy.
    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {POLICY_NAME} ON {TABLE} "
        f"USING (tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid)"
    )

    # `UPDATE` is granted because a correction moves the value — and `0072`'s
    # trigger is what makes that grant narrow: an UPDATE that is not authorised
    # by a `golden_corrections` row is refused whatever the ACL says. No
    # `DELETE`: see the module docstring for what that does and does not close.
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON {TABLE} TO titlepipe_app")


def downgrade() -> None:
    op.execute(f"REVOKE SELECT, INSERT, UPDATE ON {TABLE} FROM titlepipe_app")

    # `_release`'s order from `0002`, and both of `NO FORCE` and `DISABLE`:
    # `relrowsecurity` and `relforcerowsecurity` are separate `pg_class` columns
    # and neither clears the other, so dropping only one leaves a table with no
    # RLS still marked forced.
    op.execute(f"DROP POLICY {POLICY_NAME} ON {TABLE}")
    op.execute(f"ALTER TABLE {TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {TABLE} DISABLE ROW LEVEL SECURITY")

    op.drop_table(TABLE)

    # `DROP TABLE` DOES NOT DROP A TYPE. `na_reason` is `0001`'s and is NOT
    # dropped here — this revision did not create it, and dropping a type another
    # revision owns would break `fields` on the way back down.
    GOLDEN_TAG.drop(op.get_bind(), checkfirst=False)

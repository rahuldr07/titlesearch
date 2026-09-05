"""`orders` gets the domain columns `0001` left it without

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-04

LINEARIZED AT INTEGRATION, 2026-09-05: `down_revision` was `0004` — the head as this file's
author found it, per CONVENTIONS §8 — and is now `0007`. the parent this file's own "Assumed parent" section names for integration: Kaveri's audit
writer. Nothing in it touches a table, type or function `0005`-`0007` create, so the reorder
changes the graph and not the result.
The prose below is the author's and describes the branch as written; this line is the read of
the chain that `alembic upgrade head` actually walks.

---------------------------------------------------------------------------
🔴 `orders` ALREADY EXISTS. THIS IS AN `ALTER`, NOT A `CREATE`, AND THAT IS
   WHY IT DOES NOT REPEAT THE RLS TRIPLE.
---------------------------------------------------------------------------
`0001::upgrade` creates `orders` with three columns — `id`, `created_at`,
`tenant_id` — and `0002::_isolate` puts `ENABLE ROW LEVEL SECURITY`, `FORCE ROW
LEVEL SECURITY` and the `tenant_isolation` policy on it. CONVENTIONS §1 requires
those three in the migration that CREATES the table, and that migration is
`0002`'s partner `0001`, not this one. Re-issuing `CREATE POLICY
tenant_isolation ON orders` here would fail with `already exists`; re-issuing
`ENABLE` would be a no-op that reads like a guarantee this file provides and
does not.

**THE MACHINE THAT CHECKS I DID NOT NEED TO:** Bobbili's RLS coverage assertion
runs from the migration environment and reads `pg_class.relrowsecurity`,
`relforcerowsecurity` and `pg_policy` for every table carrying a `tenant_id`
column. `orders` is in its population whether or not this revision touches the
policy, so a hypothetical `orders` that had lost isolation would fail the run —
this file is not what holds it, and does not claim to be.

## Assumed parent

`down_revision = "0004"` is the head as found on this branch, which is what
CONVENTIONS §8 asks for. **AT INTEGRATION THE PARENT IS `0007`** (Kaveri's audit
writer), the last of the `0005`/`0006`/`0007` chain committed in parallel on
`agent/worker-38-kaveri` and not present here. Nothing in this revision depends
on 0005-0007: it touches no table they create, no enum they define and no
function they install. god relinearizes; this file must not be rebased onto her
chain by hand.

## What is deferred to `0014`, and what is NOT

`product_id`, `frozen_config_version_id` and `period_label` are added HERE, with
every other column, and only the two composite FOREIGN KEYS binding the first two
to `products` and `client_config_versions` are deferred. That split was forced
and is worth stating, because the obvious design — leave the columns out too —
does not survive contact with `alembic check`.

`models/orders.py` declares all three. `alembic check` compares `Base.metadata`
against the live catalog and fails on any column the models have and the database
does not, so an `orders` missing them is drift at every revision from here to
`0014` — and, more immediately, every ORM `INSERT` names all sixteen columns and
gets `column "product_id" of relation "orders" does not exist`. MEASURED on this
tree: leaving them out took `test_the_repository_reads_and_writes_through_the
_scoped_session` from passing to that exact error.

**WHAT SEPARABILITY THEN MEANS, PRECISELY.** The intake/product/sign-off layer is
BUILT UNDER ASSUMPTION — god ruled it in ahead of the owner's answer. If the owner
reverses it, `0015` and `0014` are dropped, and what `orders` is left holding is
two nullable uuid columns that no constraint references and nothing populates.
That is inert. The alternative — the FKs here — would leave `orders` referencing
two dropped tables, which is not.

`ck_orders_period_label_needs_a_product` lands here rather than with `0014`
because it names only `orders`' own columns; it is not an intake dependency, it is
a statement about this table.

## `NOT NULL` with no server default, against a table that must be empty

`external_ref`, `jurisdiction`, `state_code`, `county`, `status` and `arrived_at`
are `NOT NULL` and get no `server_default`. There is no honest default for an
order's external reference or its arrival time, and CONVENTIONS §4 forbids
inventing one to satisfy a `NOT NULL`.

That makes this revision refuse to run against a populated `orders`. PostgreSQL
would refuse anyway — `column "external_ref" of relation "orders" contains null
values` — but that message reads like a bug in the migration rather than the
decision it is, so `_refuse_if_populated` reads the table first and says which
of the two it is. §9: a missed path fails LOUD rather than succeeding silently.
`orders` has never carried a row outside a test transaction, so the guard has
nothing to trip on today; it is here for the deployment where that stops being
true and somebody needs to know that a backfill, not a retry, is what is wanted.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# `55000` is `object_not_in_prerequisite_state`, the condition `0005` and `0006`
# raise for the same class of refusal: the schema change is well-formed, the
# database is simply not in a state where it can be applied. No typo produces it.
NOT_IN_PREREQUISITE_STATE = "55000"


def _refuse_if_populated(table: str, columns: Sequence[str]) -> None:
    """Refuse, by name, before adding a `NOT NULL` column with no default.

    Reads the table rather than trusting that it is empty, and raises with the
    column list and the remedy. The alternative is PostgreSQL's own message,
    which names one column and reads like a defect in the DDL.

    ---------------------------------------------------------------------------
    🔴 THIS GUARD READ THROUGH ROW-LEVEL SECURITY AND THEREFORE NEVER FIRED.
       IT COUNTED ZERO ON EVERY DATABASE, INCLUDING THE ONES IT EXISTS TO REFUSE.
    ---------------------------------------------------------------------------
    `0002` puts `FORCE ROW LEVEL SECURITY` on `orders`, and `FORCE` is precisely
    the clause that removes the table OWNER's exemption. `env.py` connects as
    `titlepipe_migration` and `SET ROLE`s to `titlepipe_owner`, and no migration
    establishes `app.current_tenant` — so `tenant_isolation` evaluates against
    the empty sentinel and every row of `orders` is invisible to the `SELECT
    count(*)` below. MEASURED 2026-09-05 against `postgres:18.4`, one committed
    order in the table:

        as postgres (superuser)                     -> count = 1
        as titlepipe_migration, SET ROLE owner      -> count = 0
        as the owner with `SET LOCAL row_security = off`
                                                    -> ERROR: query would be
                                                       affected by row-level
                                                       security policy for
                                                       table "orders"
        as the owner after `ALTER TABLE orders NO FORCE ROW LEVEL SECURITY`
                                                    -> count = 1

    So the refusal never happened and the revision fell through to
    `ALTER TABLE orders ADD COLUMN client_id UUID NOT NULL`, which is a heap scan
    that ignores RLS entirely and sees every row. The operator got
    `NotNullViolation: column "client_id" of relation "orders" contains null
    values` — PostgreSQL's own message, naming one column, reading like a defect
    in the DDL — which is the exact outcome the paragraph above says this
    function exists to prevent. A guard that cannot fail is worse than no guard:
    it is a line a reviewer counts as cover.

    HOW IT WAS FOUND, because it matters that it was not found by reading:
    `tests/test_forced_rls_and_grants.py::test_downgrading_only_0002_removes_every
    _policy_grant_and_force` downgrades to `0001` and returns to `head` in a
    `finally`, and an earlier test in that module leaves two committed `orders`
    rows behind on purpose. The re-upgrade is the only path in this repository
    that runs this revision against a populated table, and it went red on the
    `integration/backend-2026-09` merge.

    `0031::_refuse_if_populated` CARRIES THE CORRECT VERSION AND THE SAME
    MEASUREMENT, and `0032` copies it. Both were written after this one, by
    another workstream, and neither could reach back into `0008`. This is that
    fix, verbatim, so the three are the same three lines.

    `ALTER TABLE ... NO FORCE` is the right escape hatch BECAUSE it is a
    privilege rather than a setting: only the owner may issue it, where any role
    can `SET` a GUC. It is transactional DDL, so it rolls back with the rest of
    the revision, and it takes `ACCESS EXCLUSIVE`, so no other session sees
    unfiltered rows in the meantime. `FORCE` is restored on the line after the
    read rather than in a `finally` for `0031`'s stated reason: nothing between
    them can raise and leave the table unforced, because a failure anywhere in
    this revision aborts the transaction and takes the `ALTER` back with it.
    """
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    # `sa.table` rather than an f-string into `sa.text`: the identifier is quoted
    # by the compiler, and ruff's S608 does not have to be argued with.
    counted = sa.select(sa.func.count()).select_from(sa.table(table))
    count = op.get_bind().execute(counted).scalar_one()
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    if count:
        raise RuntimeError(
            f"SQLSTATE {NOT_IN_PREREQUISITE_STATE}: {table} holds {count} row(s), and this "
            f"revision adds NOT NULL columns to it with no server default: "
            f"{', '.join(columns)}. There is no honest default for any of them "
            f"(CONVENTIONS §4), so this is a request for a BACKFILL migration that "
            f"populates them from the source of truth, not for a retry."
        )


# Every column added to `orders`, in the order added. The `NOT NULL` ones are
# listed separately because they are the ones the emptiness guard is about.
_NOT_NULL_COLUMNS = (
    "client_id",
    "external_ref",
    "jurisdiction",
    "state_code",
    "county",
    "status",
    "arrived_at",
)


def upgrade() -> None:
    _refuse_if_populated("orders", _NOT_NULL_COLUMNS)

    # 🔴 `client_id` CARRIES NO FOREIGN KEY, AND THAT IS A GAP RATHER THAN A
    # DECISION. `clients` is Bobbili's table and is not in this branch's chain,
    # so `tenant_fk(column="client_id", target_table="clients")` would name a
    # relation that does not exist and the revision would not run. The composite
    # `(tenant_id, client_id) REFERENCES clients (tenant_id, id)` is what
    # CONVENTIONS §1 requires and what `models/orders.py` will need; adding it is
    # a one-line follow-up migration once both chains are linearized, and it is
    # recorded as an unproven residual in `build-domain-schema.md` §10 rather
    # than left as a comment nobody is tracking.
    op.add_column("orders", sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False))

    # The client's own identifier for this order. Unique per tenant, NOT
    # globally — see the unique constraint below.
    op.add_column("orders", sa.Column("external_ref", sa.Text(), nullable=False))

    # Where the search runs. Three columns rather than one, because the three
    # are used differently: `state_code` selects the rulebook's jurisdiction
    # scope, `county` selects the search package's source, and `jurisdiction` is
    # the human label that appears on the report. Collapsing them would make the
    # rulebook lookup parse a display string.
    op.add_column("orders", sa.Column("jurisdiction", sa.Text(), nullable=False))
    op.add_column("orders", sa.Column("state_code", sa.Text(), nullable=False))
    op.add_column("orders", sa.Column("county", sa.Text(), nullable=False))

    # 🔴 `status` IS `text`, NOT AN ENUM, AND THAT IS DELIBERATE. The order state
    # machine is the SERVER's (CLAUDE.md: "Server owns all state machines and
    # thresholds"), and it is not settled — `docs/PRD.md` and the review surfaces
    # disagree on the intermediate labels. CONVENTIONS §4 says an unknown enum
    # value must be a WRITE-time error, which is exactly what a Postgres enum
    # gives; declaring one now would freeze a label set nobody has ruled on and
    # make each revision to it a `CREATE TYPE`/`ALTER TABLE`/`DROP TYPE` dance.
    # `text` here is an UNPROVEN RESIDUAL and is recorded as one: nothing in the
    # database refuses a status label the pipeline does not know.
    op.add_column("orders", sa.Column("status", sa.Text(), nullable=False))

    # Nullable throughout: a page count before the package is parsed, an
    # acceptance before acceptance, a delivery before delivery are all honestly
    # absent (CONVENTIONS §4), not zero and not epoch.
    op.add_column("orders", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=False))
    op.add_column("orders", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))

    # The extraction release — the moment a human let the extracted fields out of
    # the review queue. Two columns, and the check below makes them one fact.
    op.add_column(
        "orders", sa.Column("extraction_released_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("orders", sa.Column("extraction_released_by", sa.Text(), nullable=True))

    # 🔴 THE TWO INTAKE REFERENCES, COLUMNS ONLY. Their composite foreign keys —
    # `(tenant_id, product_id) REFERENCES products (tenant_id, id)` and the same
    # shape onto `client_config_versions` — are added by `0014`, with the tables
    # they point at. Until then these are two nullable uuid columns that nothing
    # constrains, which is what makes the intake layer droppable. See the module
    # docstring for why the COLUMNS could not also wait.
    op.add_column("orders", sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "orders",
        sa.Column("frozen_config_version_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # The human label for the search period — "40 years", "root of title". It is
    # a LABEL and not a computation: the period a product defines is the
    # authority, and this is what the report prints. Nullable because an order
    # that has not been given a product has no period to name yet.
    op.add_column("orders", sa.Column("period_label", sa.Text(), nullable=True))

    # TENANT-PREFIXED, per CONVENTIONS §2, and this is the natural key
    # `base._TenantRow` warns about by name: unique enforcement runs BEFORE a
    # policy's `WITH CHECK`, so `UNIQUE (external_ref)` alone would answer "does
    # another tenant hold this order number?" to a caller who can neither read
    # nor count the row. The prefix is what makes it answer only within a tenant.
    op.create_unique_constraint(
        "uq_orders_tenant_id_external_ref", "orders", ["tenant_id", "external_ref"]
    )

    # `num_nonnulls` is core PostgreSQL. Two columns, so 0 (never released) and 2
    # (released, and attributed) are the honest states; 1 is the half-write a
    # hand-rolled `UPDATE ... SET extraction_released_at = now()` produces, and
    # it is precisely the shape that makes a release nobody can attribute.
    op.create_check_constraint(
        "extraction_release_is_whole",
        "orders",
        "num_nonnulls(extraction_released_at, extraction_released_by) IN (0, 2)",
    )

    # A period label with no product is a label nobody can check: the period is
    # the product's definition, so the string would be asserting a search window
    # that no row anywhere states. This names only `orders`' own columns, so it
    # is not part of the intake deferral.
    op.create_check_constraint(
        "period_label_needs_a_product",
        "orders",
        "product_id IS NOT NULL OR period_label IS NULL",
    )


def downgrade() -> None:
    # 🔴 THE SHORT NAME, NOT THE RENDERED ONE, AND THE ASYMMETRY IS REAL.
    # `NAMING_CONVENTION["ck"]` is `ck_%(table_name)s_%(constraint_name)s`, and a
    # convention containing `%(constraint_name)s` WRAPS whatever name it is
    # given — on the drop as well as on the create. Passing the rendered name
    # here produced `constraint "ck_orders_ck_orders_extraction_release_is_whole"
    # of relation "orders" does not exist`, MEASURED on this tree. The `uq`
    # pattern names no `%(constraint_name)s`, so an explicit name there is used
    # verbatim and the line below passes the full one. Same file, two spellings,
    # because SQLAlchemy genuinely treats the two patterns differently.
    op.drop_constraint("period_label_needs_a_product", "orders", type_="check")
    op.drop_constraint("extraction_release_is_whole", "orders", type_="check")
    op.drop_constraint("uq_orders_tenant_id_external_ref", "orders", type_="unique")
    for column in (
        "period_label",
        "frozen_config_version_id",
        "product_id",
        "extraction_released_by",
        "extraction_released_at",
        "delivered_at",
        "accepted_at",
        "arrived_at",
        "page_count",
        "status",
        "county",
        "state_code",
        "jurisdiction",
        "external_ref",
        "client_id",
    ):
        op.drop_column("orders", column)

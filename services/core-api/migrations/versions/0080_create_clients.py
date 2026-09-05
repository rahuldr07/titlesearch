"""The tenant-scoped `clients` table — the customer an order belongs to

Revision ID: 0080
Revises: 0072
Create Date: 2026-09-05

WRITTEN AT INTEGRATION, ON THE LINEARIZED CHAIN. Unlike every revision before it, this one
did not assume a parent: `0072` is the single head of the merged chain and is read rather
than guessed, so `CONVENTIONS.md` §8's "set `down_revision` to the head as your tree found
it and let god linearize" does not apply. The `0080+` range is reserved for revisions
written after the merge.

---------------------------------------------------------------------------
🔴 WHY THIS EXISTS: A MODEL WITH NO MIGRATION, WHICH IS THE ONE DRIFT
   DIRECTION NOTHING ELSE IN THIS REPOSITORY CATCHES.
---------------------------------------------------------------------------
`db/identity.py` has mapped `Client` since the auth seam landed. No revision created
the table, so every migrated database was missing it while every model import claimed
it was there. The RLS coverage check enumerates the DATABASE, so it saw nothing to
complain about; `tests/test_forced_rls_and_grants.py` derives its table set from the
catalog, so it saw nothing either. `alembic check` is the only gate that compares the
two directions, and it reported `add_table clients` — which is what this revision
answers.

That gap was invisible for a second reason worth recording, because it made the same
check give two different answers: nothing imported `db/identity.py` from `db/models`,
so `Base.metadata` held `clients` only when some other import path had already pulled
identity in. Under pytest it had; from the `alembic` CLI it had not. Fixed in
`db/models/__init__.py`, one line, next to the identical line the golden models carry.

## The columns are `docs/PRD.md` §7's row, and `db/identity.Client` is the authority

`clients(id, tenant_id, name, delivery_method, delivery_config, report_shape,
template_ref)`. Two of them are deliberately NOT enums and the model says why at
length: `packages/contract/src/entities.ts` types `Delivery.method` as `z.string()`,
and no artefact in this repository enumerates the report shapes. `CONVENTIONS.md` §4's
enum rule bites where the label set is KNOWN and closed; asserting one here would be
inventing it.

`delivery_config` is `jsonb` and nullable. A client with no per-method configuration
has none, and `{}` would be a fabricated value standing in for an absence — the
`field_readings.line_coords` precedent.

## 🔴 THE COMPOSITE FOREIGN KEYS ARE STILL NOT DECLARED, AND THAT IS DELIBERATE HERE

`orders.client_id` and `client_config_versions.client_id` exist and reference nothing.
`0008` records the reason — `clients` was on another worker's chain — and calls the
repair "a one-line follow-up migration once both chains are linearized", which this
revision could now be. It is not, for a reason `0008` could not have known:

**THE MODELS DO NOT DECLARE THE RELATIONSHIP EITHER.** `db/models/orders.Order.client_id`
and `db/models/intake.ClientConfigVersion.client_id` are plain `mapped_column`s with no
`ForeignKey`. Alembic's autogenerate compares foreign keys in BOTH directions, so a
constraint added here and not to the models turns `alembic check` red the other way —
`remove_fk` — and the gate this revision exists to satisfy would go straight back to
failing. The correct change is a model change and a migration together, and it is a
change to two tables this revision does not create.

It is also not free: a real `(tenant_id, client_id) REFERENCES clients (tenant_id, id)`
makes a client row a precondition for every order row, which every seed, fixture and
test that writes an order has to satisfy first.

So the residual stands, now with both halves named: `build-domain-schema.md` §10
records it, and `design/backend-2026-09/integration-chain.md` records that it survived
integration. UNPROVEN in `CONVENTIONS.md` §9's sense — nothing in the database stops an
order naming a client that does not exist.

## RLS in this same migration, which is the rule and not a precaution

`CONVENTIONS.md` §1: a tenant-scoped table created without ENABLE, FORCE and a policy is
a defect. `db.rls_coverage`, called from `migrations/env.py` inside this transaction,
refuses the whole run if one is missing — but it can only say a policy is MISSING, never
what it should have said, so the three statements are written out below.

## No data is written here

No seed client. `FORCE ROW LEVEL SECURITY` makes the table invisible to
`titlepipe_owner`, who is who `migrations/env.py` runs as, so an `INSERT` here is the
silent-zero-rows trap `0001` and `0002` both document.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0080"
down_revision: str | None = "0072"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# `0002::POLICY_NAME` and `0020` spell these out for the tables they create. Repeated here
# for the frozen-snapshot reason every revision in this chain gives: a migration is a
# snapshot of one revision, and an import would let a later edit rewrite what `0080` claims
# to have created. `tests/test_forced_rls_and_grants.py` derives the tenant tables from the
# catalog and asserts the policy on each, so a name that drifted is caught there.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

# `nullif(…, '')` is what makes "no tenant established" deny rather than match.
# `tenant_session` encodes an absent tenant as the empty string; without the `nullif` the
# cast `''::uuid` raises `22P02 invalid input syntax for type uuid` on every row of every
# scan, which is a 500 rather than a denial.
TENANT_PREDICATE = f"tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[UUID], sa.Column[datetime]]:
    """`tenant_id`, `id`, `created_at` — `0020::_identity_columns` verbatim.

    A near-copy and deliberately not an import: `0080` would otherwise be rewritten by an
    edit to `0020`, and the two revisions are separately reversible.

    The heterogeneous tuple return is load-bearing rather than stylistic — `Column` is
    INVARIANT in its type parameter, so `Column[UUID]` is not assignable to
    `Column[object]` and pyright reports `reportReturnType` for the honest-looking
    `list[Column[object]]`.

    `tenant_id` FIRST, because the primary key below is `(tenant_id, id)` and a reader
    comparing this file to the table should see the key's order in the column order.
    `NOT NULL` is stated explicitly even though the primary key implies it: dropping
    `tenant_id` from the key must not silently make the column nullable, and a nullable
    `tenant_id` satisfies no policy at all — `NULL = anything` is NULL, so the row is
    invisible to every tenant and deletable by none of them.
    """
    return (
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
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


def upgrade() -> None:
    op.create_table(
        "clients",
        *_identity_columns(),
        # The customer's name as the shop knows it. NOT unique, and the absence is a
        # decision: two lenders can share a name, `CONVENTIONS.md` §2 requires a natural
        # key to lead with `tenant_id` if it exists at all, and nothing in this system
        # looks a client up by name. A unique constraint here would be a rule invented at
        # migration time.
        sa.Column("name", sa.Text(), nullable=False),
        # `text` and not an enum — `packages/contract/src/entities.ts:283` types
        # `Delivery.method` as `z.string()`, so the wire deliberately does not close the
        # set. See the module docstring.
        sa.Column("delivery_method", sa.Text(), nullable=False),
        # Nullable rather than defaulted to `{}`: a client with no per-method
        # configuration HAS none, and an empty object is a fabricated value standing in
        # for an absence.
        sa.Column("delivery_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("report_shape", sa.Text(), nullable=False),
        # Nullable: a client on the default template names no template.
        sa.Column("template_ref", sa.Text(), nullable=True),
        # 🔴 `(tenant_id, id)`, IN THAT ORDER. `db/models._TenantRow` carries the measured
        # cross-tenant existence oracle a single-column `id` key opens under `FORCE ROW
        # LEVEL SECURITY`: unique enforcement runs BEFORE a policy's `WITH CHECK`, so an
        # INSERT distinguishes an id held by another tenant from one held by nobody, to a
        # caller who can read neither row.
        sa.PrimaryKeyConstraint("tenant_id", "id", name="pk_clients"),
    )

    # `ENABLE` before `FORCE` because `FORCE` alone is not a thing: it removes the owner's
    # exemption from a mechanism that has to be switched on first. `CREATE POLICY` last, so
    # there is no instant — not even inside this transaction — at which the table has RLS on
    # and no policy, which denies every row to every non-bypassing role.
    op.execute("ALTER TABLE clients ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE clients FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON clients USING ({TENANT_PREDICATE})")

    # RLS is evaluated AFTER the privilege check and never instead of it, so without this
    # grant `titlepipe_app` gets `42501 permission denied for table clients` and a read test
    # reports zero rows and calls it isolation.
    #
    # 🔴 NO `DELETE`, matching `0002` and `0020`: `PLAN.md`'s role separation gives
    # `titlepipe_app` no DELETE, no TRUNCATE and no DDL anywhere. A client that stops being
    # a customer is a client whose orders still have to name somebody.
    #
    # `titlepipe_worker` is named nowhere here, exactly as in `0002`, `0003` and `0020`. The
    # queue has no business reading who anybody's customers are.
    op.execute("GRANT SELECT, INSERT, UPDATE ON clients TO titlepipe_app")


def downgrade() -> None:
    # The REVOKE before the DROP, which is theatre in isolation — `DROP TABLE` takes the ACL
    # with it — and is kept because `0002`, `0003` and `0020` all state the rule it follows:
    # a revoke reaches only the rows where `titlepipe_owner` is the grantor, and writing it
    # out means the day this table stops being dropped here, the grant is still reversed.
    op.execute("REVOKE SELECT, INSERT, UPDATE ON clients FROM titlepipe_app")

    # No `IF EXISTS`, for `0002::_release`'s reason: a policy that is already gone at
    # downgrade time means something removed it, and that must be an error rather than a
    # shrug. `NO FORCE` and `DISABLE` are BOTH issued — `relrowsecurity` and
    # `relforcerowsecurity` are separate columns in `pg_class` and neither clears the other.
    op.execute(f"DROP POLICY {POLICY_NAME} ON clients")
    op.execute("ALTER TABLE clients NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE clients DISABLE ROW LEVEL SECURITY")

    op.drop_table("clients")

    # No type to drop: every column here is `uuid`, `text`, `jsonb` or `timestamptz`, so
    # `0020`'s `USER_ROLE.drop` has no counterpart. Stated rather than left as an absence,
    # because "DROP TABLE does not drop a type" is the trap this chain has already hit once
    # and a reader checking for it should find the answer here.

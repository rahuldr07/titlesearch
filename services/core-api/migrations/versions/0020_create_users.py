"""The tenant-scoped `users` table and the `user_role` type

Revision ID: 0020
Revises: 0008
Create Date: 2026-09-04

LINEARIZED AT INTEGRATION, 2026-09-05: `down_revision` was `0004` — the head as this file's
author found it, per CONVENTIONS §8 — and is now `0008`. `0008` is the last revision of the `0005`-`0008` run that precedes this range. This file
states that nothing in it depends on `0005`-`0019`; it creates one type and one table and
references no other table.
The prose below is the author's and describes the branch as written; this line is the read of
the chain that `alembic upgrade head` actually walks.

---------------------------------------------------------------------------
🔴 THE ASSUMED PARENT IS `0004`, AND IT IS AN ASSUMPTION RATHER THAN A READ.
---------------------------------------------------------------------------
`CONVENTIONS.md` §8: several workers write migrations at once, so `down_revision`
is set to the head as this tree found it — `0004_append_only_enable_always` — and
the chain is linearized at integration rather than guessed at here. Revisions
`0005` to `0007` and `0008`+ exist on branches this tree does not contain, which is
why this file numbers from `0020` rather than from the next free integer: two
workers claiming `0009` is a collision that shows up as a merge conflict, and two
workers claiming `0020` and `0009` is a chain that is reordered by editing one
line.

**NOTHING IN THIS FILE DEPENDS ON WHAT `0005` to `0019` DID.** It creates one type
and one table, references no other table, and its policy reads a GUC rather than
joining. A reordering therefore changes the revision graph and not the result.

---------------------------------------------------------------------------
🔴 RLS IS ENABLED, FORCED AND POLICIED IN THIS SAME MIGRATION, WHICH IS THE
   RULE AND NOT A PRECAUTION.
---------------------------------------------------------------------------
`CONVENTIONS.md` §1: a tenant-scoped table created without all three is a defect.
`0002` is the counter-example that makes the rule concrete — its `upgrade()` is
seven hardcoded `_isolate` calls, so a table created later is simply not in them,
and `0003`'s docstring records that `rules` shipped outside every derived
assertion because of it.

**THE MACHINE THAT CATCHES A FORGOTTEN POLICY IS
`titlepipe_core.db.rls_coverage`, RUN FROM `migrations/env.py`.** It asserts from
the live catalog, inside the migration transaction, that every table carrying a
`tenant_id` column has RLS enabled, forced, and a policy — so a `users` created
without them rolls the whole run back rather than shipping. It is a backstop and
not a substitute: the three statements are written out below because the coverage
check tells you a policy is MISSING and cannot tell you what the policy should
have SAID.

## The two unique constraints are the first natural keys in this schema

`db/identity.User` carries the reasoning and the disclosure it closes.
`CONVENTIONS.md` §2 requires the `tenant_id` prefix to be in place BEFORE any
natural key lands rather than retrofitted after, and `users.email` is the first
one to land anywhere.

## `user_role` is created and dropped explicitly

`DROP TABLE` does not drop a type. A `downgrade()` that only drops the table
leaves `user_role` behind and the NEXT `upgrade` dies on `type "user_role"
already exists` — a fresh database migrates fine, so only a round trip finds it.
`0001` and `0003` both carry this, and `0003`'s version of the note is the one
that says why `checkfirst=False` rather than `checkfirst=True` is the honest
spelling: a type that already exists here means a previous `downgrade` failed to
drop it, and that must be an error rather than a silent reuse of whatever labels
the old type happened to carry.

## The labels are repeated here rather than imported

`titlepipe_core.db.identity.USER_ROLE_LABELS` holds the same six, and this file
does not import them. A migration is a frozen snapshot of a schema at one
revision; an import would let a later edit to the model silently rewrite what
`0020` claims to have created. `tests/test_identity_schema.py` is what keeps the
two honest, via the live catalog and via literals written out in the test — two
legs, because they catch different mutations.

## No data is written here

There is no seed user and no bootstrap admin. `0002`'s `FORCE ROW LEVEL
SECURITY` makes every tenant table invisible to `titlepipe_owner`, which is who
`migrations/env.py` runs as, so an `INSERT` here would be the silent-`0-rows`
trap `0001` and `0002` both document — and a seeded administrator is a credential
this repository would then be shipping.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 EXACTLY THESE SIX LABELS, IN EXACTLY THIS ORDER — `packages/contract/src/
# authz.ts`'s `ROLES` verbatim, and `docs/PRD.md` §5's six seats in the same
# order. Repeated here rather than imported, for the reason the module docstring
# gives. `enumsortorder` is what `<`, `ORDER BY` and `MIN()` on this type use, so
# the order is the server's business and not only ours.
USER_ROLE_LABELS = ("reviewer", "senior", "ops", "engineer", "typist", "admin")
USER_ROLE_TYPE_NAME = "user_role"

USER_ROLE = postgresql.ENUM(*USER_ROLE_LABELS, name=USER_ROLE_TYPE_NAME, create_type=False)

# `0002::POLICY_NAME` and `0002::_tenant_predicate` spell these out for the seven
# skeleton tables. Repeated here for the frozen-snapshot reason above, and
# because the policy NAME is what `_release`'s `DROP POLICY` in `0002` and the
# `downgrade()` below both have to agree on. `tests/test_forced_rls_and_grants.py`
# derives the tenant tables from the catalog and asserts the policy on each, so a
# name that drifted from `0002`'s would be caught there rather than here.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

# `nullif(…, '')` is what makes "no tenant established" deny rather than match.
# `tenant_session` encodes an absent tenant as the empty string; without the
# `nullif` the cast `''::uuid` raises `22P02 invalid input syntax for type uuid`
# on every row of every scan, which is a 500 rather than a denial.
TENANT_PREDICATE = f"tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[UUID], sa.Column[datetime]]:
    """`tenant_id`, `id`, `created_at`, built fresh — see `0001::_identity_columns`.

    A near-copy of that function plus the tenant column, and deliberately not an
    import from it: a migration is a frozen snapshot, and `0020` would otherwise
    be rewritten by an edit to `0001`.

    The heterogeneous tuple return is `0001`'s and `0003`'s, and is load-bearing
    rather than stylistic — `Column` is INVARIANT in its type parameter, so
    `Column[UUID]` is not assignable to `Column[object]` and pyright reports
    `reportReturnType` for the honest-looking `list[Column[object]]`.

    `tenant_id` FIRST, because the primary key below is `(tenant_id, id)` and a
    reader comparing this file to the table should see the key's order in the
    column order. `NOT NULL` is stated explicitly even though the primary key
    already implies it: dropping `tenant_id` from the key must not silently make
    the column nullable, and a nullable `tenant_id` satisfies no policy at all.

    There is NO server default on `tenant_id`. `CONVENTIONS.md` §1 says no policy
    joins to discover a tenant, and a default would be a second answer to "which
    tenant is this row" competing with the one the caller supplied.
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


def _role_column() -> sa.Column[str]:
    """The `role` column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED, and `0003::_enum_column` holds the measurement: `postgresql.ENUM`
    carries no type argument in SQLAlchemy's annotations, so the expression
    infers `Column[Unknown]` and `Column[complex]` type-checks exactly as
    happily as `Column[str]`. What makes `str` the right one is that the
    identical column spelled with the generic `sa.Enum` infers `Column[str]`, and
    that this column holds one of six label strings and nothing else. Without it,
    `op.create_table` reports `reportUnknownArgumentType` — MEASURED here, not
    inherited from `0003`'s note.

    `NOT NULL`: a user with no seat is a user no authorization decision can be
    made about, and `CONVENTIONS.md` §4 has no catch-all member to fall back on.
    That absence has no meaning for this table to record — it is a refusal at the
    seam, not a row.
    """
    return sa.Column("role", USER_ROLE, nullable=False)


def upgrade() -> None:
    # `checkfirst=False` — see the module docstring. This guard fires only when a
    # previous `downgrade()` is already broken, so the round-trip test never
    # reaches it; `tests/test_identity_schema.py` pins the spelling by reading
    # this source instead, and is honest about being a source assertion.
    USER_ROLE.create(op.get_bind(), checkfirst=False)

    op.create_table(
        # Literal, like every table name in `0001` to `0003`: one reviewable line
        # per object, and a name that cannot be reached by editing a constant
        # somewhere else in the file.
        "users",
        *_identity_columns(),
        sa.Column("email", sa.Text(), nullable=False),
        _role_column(),
        sa.Column("identity_provider", sa.Text(), nullable=False),
        sa.Column("identity_subject", sa.Text(), nullable=False),
        # Nullable, and the nullability is the state rather than a missing value:
        # an active seat has no deactivation, and `CONVENTIONS.md` §4's "a column
        # that cannot be honestly populated is NULL and stays NULL" is exactly
        # this case. `is_active boolean` would carry less — an audit asks WHEN.
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        # 🔴 `(tenant_id, id)`, IN THAT ORDER. See `db/models._TenantRow` for the
        # measured cross-tenant existence oracle a single-column `id` key opens
        # under `FORCE ROW LEVEL SECURITY`.
        sa.PrimaryKeyConstraint("tenant_id", "id", name="pk_users"),
        # 🔴 BOTH UNIQUE CONSTRAINTS LEAD WITH `tenant_id`, AND THAT IS THE WHOLE
        # POINT OF WRITING THEM OUT HERE. Unique enforcement runs BEFORE a
        # policy's `WITH CHECK`, so `uq_users_email` without the prefix would
        # answer "is this address already a user of some other tenant?" to a
        # caller who can read no row of that tenant. These are the first natural
        # keys anywhere in this schema; `CONVENTIONS.md` §2 requires the prefix to
        # be in place before one lands rather than retrofitted after.
        sa.UniqueConstraint("tenant_id", "email", name="uq_users_tenant_id_email"),
        sa.UniqueConstraint(
            "tenant_id",
            "identity_provider",
            "identity_subject",
            name="uq_users_tenant_id_identity_provider_identity_subject",
        ),
        # The three checks are the authentication seam's preconditions, placed
        # where no code path can skip them. `email = lower(email)` is what stops
        # `Ada@x.test` and `ada@x.test` being two rows that both satisfy the
        # unique constraint. The two `btrim` checks close the empty-string hole:
        # a provider adapter that returned `''` on a failed parse would otherwise
        # bind to a row, and a session resolving to SOMEBODY rather than to
        # nobody is the worst available outcome and the quietest.
        sa.CheckConstraint("email = lower(email)", name="ck_users_email_is_lowercase"),
        sa.CheckConstraint(
            "length(btrim(identity_subject)) > 0", name="ck_users_identity_subject_is_present"
        ),
        sa.CheckConstraint(
            "length(btrim(identity_provider)) > 0", name="ck_users_identity_provider_is_present"
        ),
    )

    # `ENABLE` before `FORCE` because `FORCE` alone is not a thing: it removes the
    # owner's exemption from a mechanism that has to be switched on first.
    # `CREATE POLICY` last, so there is no instant — not even inside this
    # transaction — at which the table has RLS on and no policy, which denies
    # every row to every non-bypassing role. `0002::_isolate` states the same
    # ordering for the seven skeleton tables.
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON users USING ({TENANT_PREDICATE})")

    # RLS is evaluated AFTER the privilege check and never instead of it, so
    # without this grant `titlepipe_app` gets `42501 permission denied for table
    # users` and a read test reports zero rows and calls it isolation.
    #
    # 🔴 NO `DELETE`, and the absence is a decision. `0002` grants the app
    # `SELECT, INSERT, UPDATE` on every tenant table and `DELETE` on none;
    # `PLAN.md`'s role separation says `titlepipe_app` has "no DELETE, no
    # TRUNCATE, no DDL". A seat is retired by writing `deactivated_at`, which is
    # a record; a deleted user row is a record that an audit row then names
    # nobody for.
    #
    # `titlepipe_worker` is named nowhere here, exactly as in `0002` and `0003`.
    # The queue has no business reading who anybody is.
    op.execute("GRANT SELECT, INSERT, UPDATE ON users TO titlepipe_app")


def downgrade() -> None:
    # The REVOKE before the DROP, which is theatre in isolation — `DROP TABLE`
    # takes the ACL with it — and is kept because `0002` and `0003` both state
    # the rule it follows: a revoke reaches only the rows where `titlepipe_owner`
    # is the grantor, and writing it out means the day this table stops being
    # dropped here, the grant is still reversed.
    op.execute("REVOKE SELECT, INSERT, UPDATE ON users FROM titlepipe_app")

    # No `IF EXISTS`, for `0002::_release`'s reason: a policy that is already gone
    # at downgrade time means something removed it, and that must be an error
    # rather than a shrug. `NO FORCE` and `DISABLE` are BOTH issued —
    # `relrowsecurity` and `relforcerowsecurity` are separate columns in
    # `pg_class` and neither clears the other, so a downgrade issuing only the
    # second leaves `relforcerowsecurity = true` on a table with no RLS.
    op.execute(f"DROP POLICY {POLICY_NAME} ON users")
    op.execute("ALTER TABLE users NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")

    op.drop_table("users")

    # 🔴 `DROP TABLE` DOES NOT DROP A TYPE. Without this line a fresh upgrade
    # still works and only the SECOND one — the one after a downgrade — fails,
    # with `type "user_role" already exists`.
    USER_ROLE.drop(op.get_bind(), checkfirst=False)

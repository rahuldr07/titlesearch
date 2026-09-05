"""`documents` — the segmentation boundary, as a real table

Revision ID: 0030
Revises: 0020
Create Date: 2026-09-04

LINEARIZED AT INTEGRATION, 2026-09-05: `down_revision` was `0008` — the head as this file's
author found it, per CONVENTIONS §8 — and is now `0020`. `0020` is the head after Bobbili's range. `documents` references `packages` (`0001`) and
nothing `0020` creates, so the reorder is graph-only.
The prose below is the author's and describes the branch as written; this line is the read of
the chain that `alembic upgrade head` actually walks.

---------------------------------------------------------------------------
🔴 THIS IS A `CREATE`, AND IT IS THE ONLY ONE IN THIS WORKER'S THREE REVISIONS.
---------------------------------------------------------------------------
`0001::upgrade` created `packages`, `pages`, `fields` and `field_readings` as
three-column skeletons and `0002` isolated them, so the revisions that give those
four their domain columns are `ALTER`s and correctly do not repeat the RLS triple
(`0008` states that case for `orders`). `documents` is in no earlier revision at
all — nothing named it before `models/documents.py` did — so CONVENTIONS §1
applies here in full: the `tenant_id` column, the composite `(tenant_id, id)`
primary key, `ENABLE`, `FORCE` and a `tenant_isolation` policy all land in THIS
file, beside the `CREATE TABLE`.

## Assumed parent

`down_revision = "0008"` is the head as found on this branch, per CONVENTIONS §8.
**AT INTEGRATION IT IS ALMOST CERTAINLY NOT `0008`**: Kaveri's `0005`/`0006`/
`0007` (record-class taxonomy, legal holds, audit writer) and Bobbili's `0020+`
are committed in parallel on branches this one has never seen, and two more
workers are numbering in adjacent ranges right now. Nothing in this revision
depends on any of them — it touches no table they create, no enum they define and
no function they install — and the only earlier revision it genuinely requires is
`0001`, for `packages`. god relinearizes; do not rebase this onto another
worker's chain by hand.

## The grant, which is not optional and is not implied by the policy

`0002`'s header measures it: RLS is evaluated AFTER the privilege check, never
instead of it, and `titlepipe_app` reading a table it holds no grant on gets
`42501 permission denied for table documents`. A test written to prove isolation
against an ungranted table passes for the wrong reason — zero rows because the
role cannot open the table, reported as zero rows because the policy filtered
them. So `GRANT SELECT, INSERT, UPDATE` lands here, in the same shape `0002`
gives the six tables it isolated. `DELETE` is absent for the reason it is absent
there: no verb is granted that no code path needs.

---------------------------------------------------------------------------
🔴 THE OVERLAP INVARIANT IS **NOT** ENFORCED HERE, AND SAYING SO IS THE POINT.
---------------------------------------------------------------------------
Two documents in one package may not claim the same page. The unique constraint
below closes only half of it — two documents cannot START on the same page — and
a second document beginning INSIDE this one's span still inserts cleanly. The
correct machine is an exclusion constraint:

    ALTER TABLE documents ADD CONSTRAINT ex_documents_spans_do_not_overlap
        EXCLUDE USING gist (
            tenant_id WITH =,
            package_id WITH =,
            int4range(first_page_no, last_page_no, '[]') WITH &&
        );

which needs the `btree_gist` extension for the two equality operands. `CREATE
EXTENSION` is privileged, and `0001` already declined to take that dependency for
`pgcrypto` — so adding it here would be this revision changing the deployment's
privilege requirements on its own, which is a decision for the operator and for
god, not for a table. It is carried as an UNPROVEN RESIDUAL in
`build-domain-schema.md` with the DDL above, not as a comment asserting cover.

A trigger is not an acceptable substitute and the reason is not stylistic: a
`BEFORE INSERT` trigger reading `documents` takes no lock on the rows it reads,
so two concurrent inserts each see a clean table and both commit. It would look
like enforcement in every single-threaded test and hold nothing in production.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0030"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Spelled out rather than imported from `0002`. A migration is a frozen snapshot
# of the schema at one revision; importing another revision's constants would let
# an edit there silently rewrite what this file claims to have created.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, then one policy — `0002::_isolate`, keyed on `tenant_id`.

    `ENABLE` before `FORCE`, because `FORCE` alone is not a thing: it removes the
    table owner's exemption from a mechanism that must be switched on first, and
    the owner is `titlepipe_owner`, which is the role every migration runs as.

    `CREATE POLICY` last so there is no instant, even inside this transaction, at
    which the table has RLS on and no policy — a state that denies every row to
    every non-bypassing role.

    `nullif(current_setting(..., true), '')` and not either half alone.
    `current_setting(x, true)` answers NULL for a GUC that was never defined; it
    does NOT answer NULL for one that was set and then rolled back, where
    PostgreSQL restores the empty string, and `''::uuid` raises `invalid input
    syntax for type uuid` — a 500 where a clean denial belongs. `0002`'s header
    carries the measurement.

    No `WITH CHECK`: PostgreSQL uses the `USING` expression as the `WITH CHECK`
    when none is given, so a cross-tenant INSERT is already refused with `42501
    new row violates row-level security policy`.
    """
    predicate = f"tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({predicate})")


def upgrade() -> None:
    op.create_table(
        "documents",
        # `id` and `created_at` in the shape `0001::_identity_columns` gives every
        # table, repeated rather than imported for the frozen-snapshot reason
        # above. `gen_random_uuid()` is core PostgreSQL from 13 on, so this takes
        # no extension dependency; `now()` is transaction start, which is what a
        # row's creation time means here.
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        # A document belongs to exactly one package. `NOT NULL` because a span of
        # pages with no package names pages that do not exist.
        sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False),
        # SERVER-AUTHORED, both. `label` is the recorder's own naming of the
        # instrument; `kind` is the instrument type and is `text` ON PURPOSE —
        # instrument vocabulary is jurisdiction-specific (Georgia's `FIFA` appears
        # in one sample package, Missouri's has none), so a closed global enum
        # would make the first Georgia package a write error on correct data.
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        # The span, INCLUSIVE, over consecutive pages of one package. Consecutive
        # by construction: the boundary is document structure — caption, legal
        # description, signatures, acknowledgment, recording block — not an
        # arbitrary set of pages.
        sa.Column("first_page_no", sa.Integer(), nullable=False),
        sa.Column("last_page_no", sa.Integer(), nullable=False),
        # NULL where the package holds no index entry for the document. An
        # ordinary state, not a missing lookup, and never derived from `label`.
        sa.Column("recorded_ref", sa.Text(), nullable=True),
        # `PRIMARY KEY (tenant_id, id)`, per CONVENTIONS §1 and `0001::_tenant
        # _primary_key`: unique enforcement runs BEFORE a policy's `WITH CHECK`,
        # so a single-column `id` key answers "does this id exist in another
        # tenant?" to a caller who can neither read nor count the row.
        sa.PrimaryKeyConstraint("tenant_id", "id"),
        # 🔴 THE COMPOSITE FOREIGN KEY, WHICH IS THE ONLY LEGAL FORM HERE.
        # `packages`' key is `(tenant_id, id)`, so `REFERENCES packages (id)`
        # does not even name a key and PostgreSQL rejects it. The composite form
        # additionally carries something the short form cannot: `tenant_id`
        # appears on BOTH sides of one constraint, so a document structurally
        # cannot name a package in another tenant. That holds for
        # `titlepipe_owner`, inside a migration, and with row-level security off
        # — RLS decides what a session may SEE, this decides what may be WRITTEN.
        #
        # No `ondelete`. Retention and disposal are the record-class taxonomy's,
        # and a `CASCADE` typed here by habit would be this file quietly making a
        # deletion decision that taxonomy has not made. The default is
        # `NO ACTION`, so a `packages` row refusing to vanish under its documents
        # is the failure that gets noticed.
        sa.ForeignKeyConstraint(
            ["tenant_id", "package_id"],
            ["packages.tenant_id", "packages.id"],
        ),
        # Half of the overlap invariant, and only half — see the module docstring
        # for the other half and why it is not here. Tenant-prefixed per
        # CONVENTIONS §2: `(package_id, first_page_no)` alone would be a natural
        # key whose enforcement crosses tenants.
        sa.UniqueConstraint(
            "tenant_id",
            "package_id",
            "first_page_no",
            name="uq_documents_tenant_id_package_id_first_page_no",
        ),
        sa.CheckConstraint("first_page_no >= 1", name="first_page_starts_at_one"),
        # `>=` and not `>`: a one-page document is the common case, not an error.
        sa.CheckConstraint("last_page_no >= first_page_no", name="span_runs_forwards"),
    )

    _isolate("documents")

    # See the module docstring. Without this, `titlepipe_app` is denied the table
    # outright and every isolation assertion over it passes vacuously.
    op.execute("GRANT SELECT, INSERT, UPDATE ON documents TO titlepipe_app")


def downgrade() -> None:
    """`DROP TABLE`, which really is the whole inverse — stated, not assumed.

    A policy is an object OWNED BY the table (`pg_policy.polrelid`) and is
    dropped with it; `relrowsecurity` and `relforcerowsecurity` are columns of the
    dropped `pg_class` row; and the table-level ACL goes with the same row, so the
    `GRANT` needs no matching `REVOKE`. That is exactly why `0002` needs an
    explicit `_release` and this file does not: `0002` isolated tables it did not
    create and therefore cannot drop.

    No `IF EXISTS`. A `documents` that is already gone at downgrade time means
    something else removed it, and that must be an error rather than a shrug.
    """
    op.drop_table("documents")

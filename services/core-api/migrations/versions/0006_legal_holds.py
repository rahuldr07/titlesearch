"""`legal_holds`, and the ONE function through which disposal is allowed to decide

Revision ID: 0006
Revises: 0005
Create Date: 2026-09-04

ASSUMED PARENT: `0005`, this build's taxonomy revision. Per CONVENTIONS §8 this
is a stated assumption and not a guess at the final chain; whoever integrates
linearises it. `0006` genuinely depends on `0005` — `retention_is_disposable()`
calls `retention_window()` and reads `record_classifications`.

## Why a hold table has to exist before a disposal job does

PLAN.md §2: *"Legal hold is absent from the repo entirely and must exist before
any disposal job does. A litigation hold suspends every window above."* And the
reason it is urgent rather than merely missing:

> the deletion path is the one place where "nothing happened" and "we forgot to
> check" look identical.

A disposal job that forgot to join `legal_holds` deletes held records and reports
success, and there is nothing left to notice with. So the plan's machine is
copied here literally: **disposal selects candidates through exactly one
function, that function's query joins `legal_holds`, and the assertion is a test
that drives a held record through the disposal path and requires it to be
skipped.** That function is `retention_is_disposable()` below;
`tests/test_retention_foundation.py::test_a_held_subject_is_never_disposable`
is that test.

## The shape of a hold, and the three CHECKs that make it mean something

* **A hold is released, never deleted.** `titlepipe_app` is granted SELECT,
  INSERT and UPDATE and NOT DELETE. The machine is the ACL, closed over by
  `tests/acl_contract.py`'s whole-catalog literal — not a comment, and not a
  trigger, because a trigger would have to distinguish the app from the owner and
  the ACL already does.
* **A release is all three columns or none.** `released_at`, `released_by` and
  `release_reason` are refused in any partial combination by
  `ck_legal_holds_release_is_all_or_nothing`. A release with no reason is not a
  release; it is a hold that stopped working and cannot be reviewed.
* **One ACTIVE hold per subject, any number of released ones.** A PARTIAL unique
  index — `WHERE released_at IS NULL` — because the history of holds on a record
  is itself evidence, so a second matter placing a second hold after the first is
  released must be possible while two live holds on one subject must not.

## What this revision deliberately does NOT model

**Cascade.** A hold on an order in practice reaches every document, page, reading
and report derived from it. Modelling that requires the domain tables and their
derivation edges, which belong to another worker this phase. A hold here names
ONE `(subject_table, subject_id)` and reaches exactly that subject.
`hive/design/backend-2026-09/build-retention-audit.md` §8 records this as a
REQUEST rather than a covered case, because a hold that silently fails to reach a
derived copy is the same failure as no hold at all.

**The disposal job itself.** `retention_is_disposable()` is the seam; nothing
calls it yet. That is the correct order — PLAN.md §5's standing lesson is that
this codebase ships hardened controls before their writers — but it does mean the
function's protection is proven by test and not by production traffic.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

# `55000` is `object_not_in_prerequisite_state`, the same named condition `0005`
# raises for an unruled window and for the same reason: no typo can produce it.
UNRULED_SQLSTATE = "55000"

ACTIVE_HOLD_INDEX = "uq_legal_holds_active_subject"
HOLD_ACTIVE_FUNCTION = "legal_hold_is_active"
DISPOSABLE_FUNCTION = "retention_is_disposable"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`."""
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


def upgrade() -> None:
    op.create_table(
        "legal_holds",
        *_identity_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_table", sa.Text(), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        # The matter the hold arises from, and who placed it. Both NOT NULL for
        # principle 6's reason: a hold nobody can attribute is a hold nobody can
        # lift, and "we do not know why this record cannot be deleted" is the
        # state this table exists to prevent.
        sa.Column("matter_reference", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("placed_by", sa.Text(), nullable=False),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_by", sa.Text(), nullable=True),
        sa.Column("release_reason", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("tenant_id", "id"),
        # `num_nonnulls` is core PostgreSQL. Three columns, so the permitted
        # answers are 0 (never released) and 3 (released, attributed, explained).
        # 1 and 2 are the partial states a hand-written UPDATE produces.
        sa.CheckConstraint(
            "num_nonnulls(released_at, released_by, release_reason) IN (0, 3)",
            name="release_is_all_or_nothing",
        ),
    )

    # A PARTIAL UNIQUE INDEX, AND THE PREDICATE IS THE POINT. Unique on
    # `(tenant_id, subject_table, subject_id)` only `WHERE released_at IS NULL`,
    # so one subject can carry a long history of released holds and at most one
    # live one. A total unique constraint would make the second matter in a
    # record's life unrepresentable.
    #
    # TENANT-PREFIXED, per CONVENTIONS §2: unique enforcement runs BEFORE a
    # policy's `WITH CHECK`, so an unprefixed unique index would answer "is this
    # subject held in another tenant?" to a caller who can neither read nor count
    # the row.
    op.create_index(
        ACTIVE_HOLD_INDEX,
        "legal_holds",
        ["tenant_id", "subject_table", "subject_id"],
        unique=True,
        postgresql_where=sa.text("released_at IS NULL"),
    )

    _isolate("legal_holds")

    # No DELETE — see the module docstring. `0007` attaches an `ENABLE ALWAYS`
    # audit trigger to this table, so placing and releasing a hold are both
    # recorded whether or not the application remembers to record them.
    op.execute("GRANT SELECT, INSERT, UPDATE ON legal_holds TO titlepipe_app")

    _create_hold_active_function()
    _create_disposable_function()


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, and one policy — `0002::_isolate`, spelled again.

    See `0005::_isolate` for why this is copied per revision rather than
    imported, and for the `nullif` measurement.
    """
    predicate = f"tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({predicate})")


def _release_isolation(table: str) -> None:
    """The inverse of `_isolate`, in the inverse order — `0002::_release`."""
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _create_hold_active_function() -> None:
    """`legal_hold_is_active(tenant, subject_table, subject_id) -> boolean`.

    The join, in one place, so that no caller writes it a second time slightly
    differently. `released_at IS NULL` is the whole definition of active and it
    matches the partial index's predicate exactly — if the two ever diverge, the
    index stops being the uniqueness guarantee this function assumes.

    NOT `SECURITY DEFINER`, AND THE TENANT ARGUMENT IS NOT A SUBSTITUTE FOR
    RLS. The function runs as the caller, so `legal_holds`' `tenant_isolation`
    policy is applied to the SELECT inside it: passing another tenant's id
    returns FALSE because the policy hides the rows, not because the parameter
    was checked. The parameter exists so the predicate can be written at all, and
    the isolation is the policy's — which is what makes the answer safe when a
    future caller passes a tenant id from a request body.

    Note what that means for a caller who has established NO tenant: every row is
    hidden, so the answer is FALSE. That is the correct answer to "is there a
    hold I can see" and the WRONG answer to "is this record held", and the
    difference is why `retention_is_disposable()` below is the entry point rather
    than this one.
    """
    op.execute(
        f"""
        CREATE FUNCTION {HOLD_ACTIVE_FUNCTION}(
            p_tenant uuid,
            p_subject_table text,
            p_subject_id uuid
        ) RETURNS boolean
        LANGUAGE sql STABLE AS $$
            SELECT EXISTS (
                SELECT 1 FROM legal_holds
                 WHERE tenant_id = p_tenant
                   AND subject_table = p_subject_table
                   AND subject_id = p_subject_id
                   AND released_at IS NULL
            );
        $$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {HOLD_ACTIVE_FUNCTION}(uuid, text, uuid) FROM PUBLIC")
    op.execute(
        f"GRANT EXECUTE ON FUNCTION {HOLD_ACTIVE_FUNCTION}(uuid, text, uuid) TO titlepipe_app"
    )


def _create_disposable_function() -> None:
    """THE ONE FUNCTION DISPOSAL IS ALLOWED TO ASK. Everything it can refuse on.

    PLAN.md §2 names the machine and this is it: *disposal selects candidates
    through exactly one function, that function's query joins `legal_holds`.*
    Four gates, in this order, and every one of them fails CLOSED:

    1. **an active legal hold -> FALSE.** A hold suspends every window;
    2. **no classification -> RAISE 55000.** An unclassified record is not
       "disposable by default", it is a record nobody has decided about. Returning
       FALSE here would be safe today and would silently hide, forever, the fact
       that classification coverage has a hole. It RAISES so the hole is loud;
    3. **no ruled window for `(record_class, jurisdiction)` -> RAISE 55000**,
       propagated unchanged from `0005`'s `retention_window()`. The numbers are
       the owner's and there is no default;
    4. **`retention_is_indefinite` -> FALSE.** Title policies are kept
       indefinitely (PLAN.md §2, Tex. Ins. Code §2704.001); nothing makes them
       disposable.

    Only after all four does it compare `p_as_of` against the anchor plus the
    window. TRUE is the one answer it has to work for.

    `p_anchor_at` IS A PARAMETER AND NOT A LOOKUP, and that is the honest shape.
    "≥15 years after policy issuance" and "≥5 years from close of escrow" count
    from different events; `retention_windows.anchor` describes which event in
    free text because the closed set of anchors is not ruled (`0005`). Inferring
    an anchor from `created_at` would be inventing the one input that decides
    whether a deletion is lawful.

    WHAT THIS FUNCTION DOES NOT DO, so nobody reads more assurance into it than
    it holds: it does not enumerate candidates, it does not delete anything, it
    does not reach derived copies of the subject, and NOTHING IN THE DATABASE
    FORCES A FUTURE DISPOSAL JOB TO CALL IT. That last one is the residual — the
    machine that would close it is a disposal path that exists, and there is
    none yet.
    """
    op.execute(
        f"""
        CREATE FUNCTION {DISPOSABLE_FUNCTION}(
            p_tenant uuid,
            p_subject_table text,
            p_subject_id uuid,
            p_anchor_at timestamptz,
            p_as_of timestamptz
        ) RETURNS boolean
        LANGUAGE plpgsql STABLE AS $$
        DECLARE
            classification record_classifications;
            window_row retention_windows;
        BEGIN
            IF {HOLD_ACTIVE_FUNCTION}(p_tenant, p_subject_table, p_subject_id) THEN
                RETURN false;
            END IF;

            SELECT * INTO classification
              FROM record_classifications
             WHERE tenant_id = p_tenant
               AND subject_table = p_subject_table
               AND subject_id = p_subject_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{UNRULED_SQLSTATE}',
                    MESSAGE = 'no record_class is recorded for '
                              || quote_literal(p_subject_table) || ' row '
                              || p_subject_id,
                    HINT = 'An unclassified record is not disposable by default. '
                           'Classify it, or find out why nothing classified it.';
            END IF;

            window_row := retention_window(
                classification.record_class, classification.jurisdiction
            );

            IF window_row.retention_is_indefinite THEN
                RETURN false;
            END IF;

            RETURN p_as_of >= p_anchor_at
                   + make_interval(days => window_row.minimum_retention_days);
        END;
        $$
        """
    )
    op.execute(
        f"REVOKE EXECUTE ON FUNCTION "
        f"{DISPOSABLE_FUNCTION}(uuid, text, uuid, timestamptz, timestamptz) FROM PUBLIC"
    )
    op.execute(
        f"GRANT EXECUTE ON FUNCTION "
        f"{DISPOSABLE_FUNCTION}(uuid, text, uuid, timestamptz, timestamptz) "
        f"TO titlepipe_app"
    )


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {DISPOSABLE_FUNCTION}(uuid, text, uuid, timestamptz, timestamptz)")
    op.execute(f"DROP FUNCTION {HOLD_ACTIVE_FUNCTION}(uuid, text, uuid)")

    _release_isolation("legal_holds")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON legal_holds FROM titlepipe_app")
    # The index goes with the table; naming it is what keeps the drop correct on
    # the day this table stops being dropped here.
    op.drop_index(ACTIVE_HOLD_INDEX, table_name="legal_holds")
    op.drop_table("legal_holds")

"""`golden_corrections` — the append-only ledger every change to ground truth passes through

Revision ID: 0071
Revises: 0070
Create Date: 2026-09-05

ASSUMED PARENT: `0070`, this worker's own previous revision. `0070`'s docstring
records the assumption about the head below it, and CONVENTIONS §8 is why
neither guesses further.

---------------------------------------------------------------------------
🔴 THE REFUSAL THIS TABLE IS. A golden correction needs a SOURCE, a REASON and a
   SIGNATURE. That rule exists today as `z.string().min(1)` in a browser schema
   and as prose in `CLAUDE.md`, and a browser schema refuses nothing that does
   not go through the browser. Here it is three `NOT NULL` columns and three
   CHECK constraints, so the write fails at the server or does not happen.
---------------------------------------------------------------------------

## Why the ledger is a table and not four columns on `golden_fields`

`packages/contract/src/entities.ts::GoldenField` carries `corrected_from`,
`corrected_by`, `corrected_at` and `correction_reason` inline — the LATEST
correction, flattened onto the row. That shape can hold one correction. It
cannot hold two, and it cannot hold a `confirm` and a later `demote` on the same
field, which are two of the three acts the API defines
(`POST /api/golden/{id}/confirm`, `POST /api/golden/{id}/demote`).

More to the point, inline columns are OVERWRITTEN. "Corrections are permanent"
and "the current correction lives in a column that the next correction
overwrites" cannot both be true. The wire shape stays what it is; it is a
PROJECTION of the newest row here, rendered by a mapper.

## Append-only, and what actually enforces it

Two triggers, `FOR EACH STATEMENT`, raising SQLSTATE `0A000`, at
`tgenabled = 'A'`. Every one of those four choices is `audit_log`'s and each was
paid for once already:

* **`FOR EACH STATEMENT`, not `FOR EACH ROW`** — `0001`. A row trigger does not
  fire when a statement affects no rows, and under this table's `FORCE ROW LEVEL
  SECURITY` a cross-tenant `UPDATE` matches exactly zero. A row trigger would be
  SILENT for the one case it exists to refuse.
* **TWO triggers, not one** — `0001`. A `TRUNCATE` trigger can only be
  `FOR EACH STATEMENT`, so PostgreSQL rejects a combined
  `UPDATE OR DELETE OR TRUNCATE ... FOR EACH ROW` outright, and folding them
  would make the statement-versus-row decision unrepresentable.
* **`ENABLE ALWAYS`, at creation** — `0004`. `tgenabled = 'O'` is the default and
  means the guarantee is OFF for any session in
  `session_replication_role = 'replica'`; `0004` measured a `DELETE 1` with no
  refusal on a byte-for-byte copy of `0001`'s trigger pair. `audit_log` needed a
  whole revision to fix that after the fact. This table is created with `'A'`
  and never spends a revision at `'O'`.
* **`CREATE FUNCTION`, not `CREATE OR REPLACE`** — `0001`. With `OR REPLACE`, a
  `downgrade()` that forgot its `DROP FUNCTION` would leave the old body behind
  and the next upgrade would silently overwrite it. Plain `CREATE FUNCTION` turns
  that omission into `DuplicateFunction` on the second upgrade.

**WHAT THIS IS NOT A CONTROL AGAINST**, said plainly because `0001` had to learn
it: whoever administers the cluster. `ENABLE ALWAYS` closes the replica-mode
hole, and nothing in a database closes a superuser.

## The four constraints that make an act mean what it says

The API defines three acts and says what each does. Each sentence is a CHECK:

* `POST /api/golden/{id}/confirm` — "the seed is right; tag upgrades to `ruled`"
  → `ck_golden_corrections_confirm_lands_on_ruled`.
* `POST /api/golden/{id}/demote` — "the document is ambiguous; tag → `suspect`"
  → `ck_golden_corrections_demote_lands_on_suspect`.
* both — "Both leave the value untouched"
  → `ck_golden_corrections_affirmation_leaves_the_value_alone`. This is the one
  worth having: an affirmation that quietly moved the value is a correction with
  no correction record, and it would be invisible in every projection.
* `POST /api/golden/corrections` — a correction that changed nothing is a
  signature on a non-event → `ck_golden_corrections_correction_moves_the_value`.

`IS DISTINCT FROM` throughout rather than `<>`, because a value legitimately
moves TO and FROM null — a correction from "Lot 7" to NOT_PRESENT is an ordinary
correction, and `'Lot 7' <> NULL` is NULL, which a CHECK treats as satisfied.

## `revision_after` is unique per field, and that is `0072`'s other half

One ledger row authorises exactly one transition of exactly one golden field.
`uq_golden_corrections_tenant_id_golden_field_id_revision_after` is what makes
"exactly one" true; `0072`'s trigger is what makes the authorisation compulsory.
Without the unique constraint a single ledger row could be replayed to walk a
value A -> B -> A -> B forever, each step "authorised" by the same signature.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0071"
down_revision: str | None = "0070"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 EXACTLY THESE THREE LABELS, IN THIS ORDER, AND THERE IS NO FOURTH.
#
# They are the three golden endpoints and nothing else. What is deliberately
# ABSENT is any label meaning "an engine's reading was promoted" — the act does
# not exist, so it cannot be recorded, so no ledger row can ever say that a
# model output became truth. That absence is the same kind of decision as
# `na_reason` having no `pending` member (CONVENTIONS §4): a missing label is a
# statement, not an oversight.
#
# Repeated here rather than imported, for `0001`'s frozen-snapshot reason.
GOLDEN_ACT_LABELS = ("correct", "confirm", "demote")
GOLDEN_ACT_TYPE_NAME = "golden_act"

GOLDEN_ACT = postgresql.ENUM(*GOLDEN_ACT_LABELS, name=GOLDEN_ACT_TYPE_NAME, create_type=False)

# `0070`'s and `0001`'s types, REUSED. Neither is created here; a second
# `CREATE TYPE` of an existing name is an error, and neither is dropped in
# `downgrade()` because this revision does not own them.
GOLDEN_TAG = postgresql.ENUM(name="golden_tag", create_type=False)
NA_REASON = postgresql.ENUM(name="na_reason", create_type=False)

TABLE = "golden_corrections"
PARENT_TABLE = "golden_fields"

APPEND_ONLY_FUNCTION = "golden_corrections_reject_mutation"
APPEND_ONLY_TRIGGER = "golden_corrections_append_only"
NO_TRUNCATE_TRIGGER = "golden_corrections_no_truncate"

# `pg_trigger.tgenabled`. `'A'` is ALWAYS — fires in every replication role.
# `'O'` is ORIGIN, the default, and is the state `0004` had to spend a revision
# moving `audit_log` off.
TRIGGER_ALWAYS = "A"

ENGINE_SUBJECT_NAMESPACE = "engine:"
UNSIGNED_SENTINEL = "unknown"

POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at` — see `0001::_identity_columns` and `0070`'s copy.

    `created_at` is when the act was signed. There is no separate `signed_at`,
    for `0070`'s reason: the row IS the act, and a second timestamp is a second
    answer to one question.
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


def _whole_truth(value_column: str, na_reason_column: str) -> str:
    """Exactly one of a value and a reason for its absence — `0070`'s XOR.

    Applied to BOTH sides of the ledger row. A `value_before` that is null with
    no `na_reason_before` records a state the truth table cannot hold, so the
    ledger would be describing a transition out of something that never existed.
    """
    return f"num_nonnulls({value_column}, {na_reason_column}) = 1"


def _truth_is_unmoved() -> str:
    """Both halves of the truth identical across the act.

    `IS NOT DISTINCT FROM` and not `=`: `NULL = NULL` is NULL, which a CHECK
    accepts, so `=` would let an affirmation move a value from `NOT_PRESENT` to
    a string as long as one side was null.
    """
    return (
        "value_before IS NOT DISTINCT FROM value_after "
        "AND na_reason_before IS NOT DISTINCT FROM na_reason_after"
    )


def upgrade() -> None:
    GOLDEN_ACT.create(op.get_bind(), checkfirst=False)

    op.create_table(
        TABLE,
        *_identity_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("golden_field_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("act", GOLDEN_ACT, nullable=False),
        # The three the refusal rule names. All `NOT NULL`, all CHECKed non-blank
        # — `NOT NULL` alone accepts `''`, which is exactly what a form sends
        # when a required field was made optional upstream.
        sa.Column("signed_by", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("source_citation", sa.Text(), nullable=False),
        sa.Column("tag_before", GOLDEN_TAG, nullable=False),
        sa.Column("tag_after", GOLDEN_TAG, nullable=False),
        sa.Column("value_before", sa.Text(), nullable=True),
        sa.Column("na_reason_before", NA_REASON, nullable=True),
        sa.Column("value_after", sa.Text(), nullable=True),
        sa.Column("na_reason_after", NA_REASON, nullable=True),
        # The revision of `golden_fields` this act produces. `> 0` because
        # revision 0 is the establishment, which is not an act on an existing
        # truth and has no ledger row.
        sa.Column("revision_after", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("tenant_id", "id"),
        sa.ForeignKeyConstraint(
            ("tenant_id", "golden_field_id"),
            (f"{PARENT_TABLE}.tenant_id", f"{PARENT_TABLE}.id"),
            name="fk_golden_corrections_tenant_id_golden_field_id_golden_fields",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "golden_field_id",
            "revision_after",
            name="uq_golden_corrections_tenant_id_golden_field_id_revision_after",
        ),
        sa.CheckConstraint(
            _whole_truth("value_before", "na_reason_before"),
            name="ck_golden_corrections_before_is_a_whole_truth",
        ),
        sa.CheckConstraint(
            _whole_truth("value_after", "na_reason_after"),
            name="ck_golden_corrections_after_is_a_whole_truth",
        ),
        sa.CheckConstraint(
            f"length(btrim(signed_by)) > 0 AND lower(btrim(signed_by)) <> '{UNSIGNED_SENTINEL}'",
            name="ck_golden_corrections_signed_by_is_signed",
        ),
        sa.CheckConstraint(
            f"lower(btrim(signed_by)) NOT LIKE '{ENGINE_SUBJECT_NAMESPACE}%'",
            name="ck_golden_corrections_signed_by_is_not_an_engine",
        ),
        sa.CheckConstraint(
            "length(btrim(reason)) > 0", name="ck_golden_corrections_reason_is_not_blank"
        ),
        sa.CheckConstraint(
            "length(btrim(source_citation)) > 0",
            name="ck_golden_corrections_citation_is_not_blank",
        ),
        sa.CheckConstraint(
            f"act = 'correct' OR ({_truth_is_unmoved()})",
            name="ck_golden_corrections_affirmation_leaves_the_value_alone",
        ),
        sa.CheckConstraint(
            f"act <> 'correct' OR NOT ({_truth_is_unmoved()})",
            name="ck_golden_corrections_correction_moves_the_value",
        ),
        sa.CheckConstraint(
            "act <> 'confirm' OR tag_after = 'ruled'",
            name="ck_golden_corrections_confirm_lands_on_ruled",
        ),
        sa.CheckConstraint(
            "act <> 'demote' OR tag_after = 'suspect'",
            name="ck_golden_corrections_demote_lands_on_suspect",
        ),
        sa.CheckConstraint(
            "revision_after > 0", name="ck_golden_corrections_revision_after_is_positive"
        ),
    )

    # `0072`'s trigger reads this table by `(tenant_id, golden_field_id)` on
    # every truth-moving UPDATE, and a projection reads it the same way to render
    # a field's newest correction. The unique constraint above already indexes
    # `(tenant_id, golden_field_id, revision_after)` and would serve both, so
    # this index is NOT created — a second index on a prefix of an existing one
    # is write cost for no read.

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {POLICY_NAME} ON {TABLE} "
        f"USING (tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid)"
    )

    _create_append_only_triggers()

    # 🔴 `SELECT, INSERT` AND NOTHING ELSE, WHICH IS `0002`'s TREATMENT OF
    # `audit_log`. The triggers refuse UPDATE and DELETE whatever the ACL says,
    # so granting either would change no behaviour and would MISSTATE THE INTENT
    # — an ACL reading `arwU` on the one table this system promises never to edit
    # in place. The consequence, stated because `0002` had to state it: for
    # `titlepipe_app` the triggers' branches are now unreachable and that role
    # gets `42501 permission denied` where a role holding the privilege would get
    # `0A000 golden_corrections is append-only`. The triggers are not thereby
    # decoration: they are the control against every OTHER path, including a
    # future role, a `SET ROLE`, and the superuser-shaped seeding this suite does.
    op.execute(f"GRANT SELECT, INSERT ON {TABLE} TO titlepipe_app")


def _create_append_only_triggers() -> None:
    """The function, the two triggers, and `ENABLE ALWAYS` on both.

    `BEFORE`, so nothing is written before the refusal. The function returns
    `trigger` and takes no arguments because that is the only signature
    `CREATE TRIGGER` accepts, and it never actually returns: a `BEFORE` trigger
    returning NULL would SILENTLY SUPPRESS the statement, which is
    indistinguishable from success at the client.

    SQLSTATE `0A000` (`feature_not_supported`) — what PostgreSQL itself returns
    for "cannot update this thing", and a code no typo can produce: an unknown
    column is `42703` and an unknown table `42P01`. A test asserting "something
    raised" is also satisfied by a misspelled column in the test.
    """
    op.execute(
        f"""
        CREATE FUNCTION {APPEND_ONLY_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION USING
                ERRCODE = '0A000',
                MESSAGE = '{TABLE} is append-only; ' || TG_OP || ' is refused',
                HINT = 'A correction is permanent. Record a further correction; '
                       'ground truth is not edited in place.';
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {APPEND_ONLY_TRIGGER}
        BEFORE UPDATE OR DELETE ON {TABLE}
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {NO_TRUNCATE_TRIGGER}
        BEFORE TRUNCATE ON {TABLE}
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )

    for trigger in (APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER):
        op.execute(f"ALTER TABLE {TABLE} ENABLE ALWAYS TRIGGER {trigger}")

    _require_trigger_state()


def _require_trigger_state() -> None:
    """Read `tgenabled` back, and refuse unless BOTH triggers are at `'A'`.

    `0004::_require_trigger_state`, narrowed to this table. The check is not
    decoration: `ALTER TABLE ... ENABLE ALWAYS TRIGGER` names the trigger and a
    name that does not exist raises, but the point of the statement is a CATALOG
    VALUE, and "the statement succeeded" is a different claim from "`tgenabled`
    moved". Without this, a migration that somehow did not take would land green
    over an unprotected ledger.

    `pg_trigger` rather than `information_schema`, which has no column for
    `tgenabled` at all — a trigger's replication-role state is a PostgreSQL
    extension and the SQL-standard views do not model it. `NOT tgisinternal`
    because constraint-backing triggers are PostgreSQL's, not ours, and this
    table's foreign key has them.
    """
    rows = (
        op.get_bind()
        .exec_driver_sql(
            """
            SELECT t.tgname, t.tgenabled
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            WHERE c.relname = %(table)s
              AND NOT t.tgisinternal
              AND t.tgname = ANY(%(names)s)
            """,
            {"table": TABLE, "names": [APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER]},
        )
        .fetchall()
    )

    found = {str(name): str(enabled) for name, enabled in rows}
    wrong = {
        name: found.get(name)
        for name in (APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER)
        if found.get(name) != TRIGGER_ALWAYS
    }

    if wrong:
        detail = ", ".join(f"{name} is {state!r}" for name, state in sorted(wrong.items()))
        raise RuntimeError(
            f"0071: {TABLE}'s append-only triggers are not at "
            f"tgenabled={TRIGGER_ALWAYS!r} after this revision ran — {detail}. A "
            f"missing trigger reads as None, and 'O' means the ledger is "
            f"editable by any session in session_replication_role = 'replica'. "
            f"Nothing in this run has been committed."
        )


def downgrade() -> None:
    op.execute(f"REVOKE SELECT, INSERT ON {TABLE} FROM titlepipe_app")

    op.execute(f"DROP POLICY {POLICY_NAME} ON {TABLE}")
    op.execute(f"ALTER TABLE {TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {TABLE} DISABLE ROW LEVEL SECURITY")

    # Both triggers go with the table; the FUNCTION does not, because it belongs
    # to the schema rather than to the table. `0001` records what leaving it
    # behind costs: the next upgrade dies on `DuplicateFunction`, and only on the
    # SECOND upgrade, so a fresh database migrates fine and only a round trip
    # finds it.
    op.drop_table(TABLE)
    op.execute(f"DROP FUNCTION {APPEND_ONLY_FUNCTION}()")

    GOLDEN_ACT.drop(op.get_bind(), checkfirst=False)

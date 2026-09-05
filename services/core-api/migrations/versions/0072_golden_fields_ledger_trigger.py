"""A golden value moves ONLY through a signed ledger row, and the table enforces it

Revision ID: 0072
Revises: 0071
Create Date: 2026-09-05

ASSUMED PARENT: `0071`, this worker's own previous revision.

---------------------------------------------------------------------------
🔴 THE GAP THIS CLOSES. `0071` gives every change to ground truth a permanent,
   signed, cited ledger row. It does not make anybody WRITE one. Until this
   revision, `UPDATE golden_fields SET value = 'Lot 7'` was an ordinary
   statement that any holder of the `UPDATE` grant could run, and the ledger
   would simply have no row for it — a permanent record with a hole in it, and
   nothing anywhere reporting the hole.
---------------------------------------------------------------------------

**THE MACHINE:** `golden_fields_require_ledger`, a `BEFORE UPDATE ... FOR EACH
ROW` trigger at `tgenabled = 'A'`, which refuses the statement unless a
`golden_corrections` row already exists describing exactly this transition of
exactly this row. It is not a convention, a service-layer check or a code review
item: an application that skips the ledger gets SQLSTATE `0A000` and no write.

## Three refusals, in the order the function tests them

**1. The immutable columns.** `tenant_id`, `id`, `created_at`, `order_id`,
`path`, `established_by` and `established_reason` cannot be changed by any
UPDATE. Re-pointing a truth row at a different order or a different field path
is not a correction of that truth — it is the silent substitution of one claim
for another, under the signature that was given for the first. The signer and
the reason of the ORIGINAL establishment stay what they were; a later act is a
ledger row with its own signer, not an edit to somebody else's signature.

**2. `revision` advances by exactly one.** With a gap, a single ledger row at
revision 5 would authorise a jump from 1 to 5 and swallow three unrecorded
changes. Together with `0071`'s
`uq_golden_corrections_tenant_id_golden_field_id_revision_after`, "exactly one"
plus "unique per field" is what makes a ledger row unrepeatable — without it a
value could be walked A -> B -> A -> B indefinitely, each step matching the same
two signatures.

**3. A ledger row matching the whole transition.** Not "a correction exists for
this field": `tag_before`/`tag_after`, `value_before`/`value_after`,
`na_reason_before`/`na_reason_after` and `source_citation` must all agree with
what the UPDATE is actually doing. A row that signs one change and is used to
make a different one is the forgery this comparison exists to refuse.

## `FOR EACH ROW`, which is the opposite of `0001`'s choice, on purpose

`0001` and `0071` are `FOR EACH STATEMENT` because a row trigger does not fire
when a statement affects no rows, and a cross-tenant `UPDATE` under `FORCE ROW
LEVEL SECURITY` matches exactly zero — so a row trigger would be silent for the
one case an append-only guarantee exists to refuse.

**That reasoning does not transfer, and copying it here would break this
trigger.** This one compares `OLD` with `NEW`, which a statement trigger does
not have. And the case it exists for is the opposite one: a statement that
changes no rows changes no truth, so there is nothing for it to refuse. The two
files reach different answers from the same fact, and the fact is what to carry
forward rather than the answer.

## `SECURITY INVOKER`, and what that means when the owner tries to correct a row

The function is not `SECURITY DEFINER`, so its `SELECT` against
`golden_corrections` is filtered by that table's `tenant_isolation` policy on
the caller's own session. For `titlepipe_app` inside a `tenant_session` that is
exactly right: it can see its own tenant's ledger and no other.

For `titlepipe_owner` under `0071`'s `FORCE ROW LEVEL SECURITY` with no tenant
established, the `SELECT` returns nothing and the UPDATE is REFUSED. That is
the intended answer and it is stated here so it is not later "fixed": a data
migration that rewrites golden values without writing ledger rows is precisely
what this revision exists to stop, and `0001` records at length what the
alternative looks like — a migration-shaped write that reports success and does
nothing.

## What this does NOT close

`DELETE` is not refused by any trigger, and `0070`'s docstring says why:
retention and erasure belong to another card, and `titlepipe_app` holds no
`DELETE` grant. A role that does hold one can remove a golden row that has no
corrections; `0071`'s composite foreign key stops it once corrections exist.
That residual is real and is named rather than argued away.

Nothing here is a control against whoever administers the cluster. `ENABLE
ALWAYS` closes the `session_replication_role = 'replica'` hole `0004` measured;
a superuser remains a superuser.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0072"
down_revision: str | None = "0071"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLE = "golden_fields"
LEDGER_TABLE = "golden_corrections"

LEDGER_FUNCTION = "golden_fields_require_ledger"
LEDGER_TRIGGER = "golden_fields_ledger_required"

TRIGGER_ALWAYS = "A"

# The columns no UPDATE may touch, in the order the function tests them. A
# tuple rather than a loop inside plpgsql: `NEW` cannot be subscripted by a
# variable column name without `to_jsonb`, and routing every comparison through
# a jsonb round trip would make a NULL and the JSON null indistinguishable —
# which is the exact distinction `na_reason` exists to preserve.
IMMUTABLE_COLUMNS = (
    "tenant_id",
    "id",
    "created_at",
    "order_id",
    "path",
    "established_by",
    "established_reason",
)


def _immutability_branches() -> str:
    """One `IF`/`ELSIF` per immutable column, naming the column it caught.

    `IS DISTINCT FROM` rather than `<>` throughout: `established_reason` is
    `NOT NULL` today but `<>` against a null on either side yields NULL, which
    is not true, so a nullable column added to this list later would silently
    stop being immutable. The spelling that stays correct is the one written
    now.

    Generated rather than typed out, and this is the one place in these three
    revisions where generation beats one reviewable line per object: the branches
    are identical except for a name, and a hand-written list is where the
    seventh entry gets the sixth entry's column name pasted into it.
    """
    branches = [
        f"IF NEW.{column} IS DISTINCT FROM OLD.{column} THEN moved_column := '{column}';"
        if index == 0
        else f"ELSIF NEW.{column} IS DISTINCT FROM OLD.{column} THEN moved_column := '{column}';"
        for index, column in enumerate(IMMUTABLE_COLUMNS)
    ]
    return "\n            ".join([*branches, "END IF;"])


def upgrade() -> None:
    # `S608` is suppressed on the statement below, and what makes it safe is
    # that nothing caller-supplied reaches the string: every interpolated value
    # is a module-level constant in this file, and the `SELECT` ruff objects to
    # is a plpgsql body compared against `NEW` and `OLD`, not a query with
    # parameters. A trigger body cannot take bind parameters in any dialect.
    op.execute(
        f"""
        CREATE FUNCTION {LEDGER_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            moved_column text;
        BEGIN
            {_immutability_branches()}

            IF moved_column IS NOT NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '0A000',
                    MESSAGE = '{TABLE}.' || moved_column || ' is immutable; '
                              || 'this UPDATE would change what was established, '
                              || 'not correct it',
                    HINT = 'Establish a new golden field. A signature given for one '
                           'claim does not carry over to another.';
            END IF;

            -- Nothing that constitutes the truth moved, so there is nothing for
            -- a ledger row to authorise. Returning here rather than refusing
            -- keeps an UPDATE that touches only future, non-truth columns from
            -- needing a signature it has no content for.
            IF NEW.value IS NOT DISTINCT FROM OLD.value
               AND NEW.na_reason IS NOT DISTINCT FROM OLD.na_reason
               AND NEW.tag IS NOT DISTINCT FROM OLD.tag
               AND NEW.source_citation IS NOT DISTINCT FROM OLD.source_citation
               AND NEW.revision IS NOT DISTINCT FROM OLD.revision THEN
                RETURN NEW;
            END IF;

            IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '0A000',
                    MESSAGE = '{TABLE}.revision must advance by exactly one per '
                              || 'correction; this UPDATE moves it from '
                              || OLD.revision || ' to ' || NEW.revision,
                    HINT = 'A gap is one or more changes to ground truth that no '
                           'ledger row records.';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM {LEDGER_TABLE} c
                WHERE c.tenant_id = NEW.tenant_id
                  AND c.golden_field_id = NEW.id
                  AND c.revision_after = NEW.revision
                  AND c.tag_before = OLD.tag
                  AND c.tag_after = NEW.tag
                  AND c.value_before IS NOT DISTINCT FROM OLD.value
                  AND c.value_after IS NOT DISTINCT FROM NEW.value
                  AND c.na_reason_before IS NOT DISTINCT FROM OLD.na_reason
                  AND c.na_reason_after IS NOT DISTINCT FROM NEW.na_reason
                  AND c.source_citation = NEW.source_citation
            ) THEN
                RAISE EXCEPTION USING
                    ERRCODE = '0A000',
                    MESSAGE = 'no {LEDGER_TABLE} row signs this change to '
                              || '{TABLE} ' || NEW.id || ' at revision '
                              || NEW.revision,
                    HINT = 'Ground truth changes only through a correction that '
                           'carries a source, a reason and a signature, and that '
                           'describes this exact transition.';
            END IF;

            RETURN NEW;
        END;
        $$
        """  # noqa: S608
    )

    op.execute(
        f"""
        CREATE TRIGGER {LEDGER_TRIGGER}
        BEFORE UPDATE ON {TABLE}
        FOR EACH ROW EXECUTE FUNCTION {LEDGER_FUNCTION}()
        """
    )
    op.execute(f"ALTER TABLE {TABLE} ENABLE ALWAYS TRIGGER {LEDGER_TRIGGER}")

    _require_trigger_state(TRIGGER_ALWAYS)


def downgrade() -> None:
    # The trigger first, then the function it calls. `DROP FUNCTION` would fail
    # on the dependency otherwise, which is a clearer failure than the reverse
    # order's would be — but writing it correctly means the day somebody adds a
    # second trigger on this function, the drop still works.
    op.execute(f"DROP TRIGGER {LEDGER_TRIGGER} ON {TABLE}")
    op.execute(f"DROP FUNCTION {LEDGER_FUNCTION}()")


def _require_trigger_state(expected: str) -> None:
    """Refuse unless the trigger is at `expected` — `0004::_require_trigger_state`.

    "The `ALTER` statement ran" and "`tgenabled` is `'A'`" are different claims,
    and only the second one is this revision's point. `pg_trigger` rather than
    `information_schema`, which models no such column.
    """
    rows = (
        op.get_bind()
        .exec_driver_sql(
            """
            SELECT t.tgenabled
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            WHERE c.relname = %(table)s
              AND NOT t.tgisinternal
              AND t.tgname = %(name)s
            """,
            {"table": TABLE, "name": LEDGER_TRIGGER},
        )
        .fetchall()
    )

    state = str(rows[0][0]) if rows else None
    if state != expected:
        raise RuntimeError(
            f"0072: {TABLE}'s {LEDGER_TRIGGER} is not at tgenabled={expected!r} "
            f"after this revision ran — it reads {state!r}, and a missing "
            f"trigger reads as None. At 'O' the ledger requirement is off for "
            f"any session in session_replication_role = 'replica'. Nothing in "
            f"this run has been committed."
        )

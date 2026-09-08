"""A golden field cannot be DELETED, because DELETE was the way around immutability

Revision ID: 0101
Revises: 0100
Create Date: 2026-09-05

ASSUMED PARENT: `0100`, this worker's own previous revision. Per CONVENTIONS §8
that is a stated assumption; `0101` genuinely depends on `0070` (the table) and
`0072` (the guarantee it completes) and on nothing in `0100`.

## The defect this closes

`0072` holds seven columns — `tenant_id`, `id`, `created_at`, `order_id`,
`path`, `established_by`, `established_reason` — against every UPDATE, for every
role, and names the offending column in the refusal. It is an `AFTER UPDATE`
trigger, and **an `AFTER UPDATE` trigger cannot see a DELETE.**

Measured on this schema: `DELETE` the row, `INSERT` it again with the same `id`
and the same `created_at`, and `order_id` pointing somewhere else. Every one of
the seven "immutable" columns has moved, no UPDATE ever ran, and the ledger
`0072` requires is never consulted because a fresh row starts at `revision = 0`
and revision 0 IS the establishment. The non-superuser OWNER went further and
performed a CROSS-TENANT TRANSPLANT this way, by switching `app.current_tenant`
between the DELETE and the INSERT so each half satisfied `tenant_isolation` for
a different tenant.

That is verbatim what `0072`'s own docstring says it prevents — *"substitution
under someone else's signature"*. It prevented it through one verb.

## The fix is a refusal, not a narrower grant

`0070` already withholds `DELETE` from `titlepipe_app` at the ACL and records
that as a deliberate choice. An ACL is the wrong instrument for this one: it
says nothing to the OWNER, and the owner is the identity the demonstrated
transplant actually used. `titlepipe_migration` reaches this schema by `SET ROLE
titlepipe_owner` before every statement of every migration, so "the owner can do
it" is not a hypothetical privilege in this system, it is the deployment path.

So: `BEFORE DELETE` and `BEFORE TRUNCATE`, both `FOR EACH STATEMENT`, both
`ENABLE ALWAYS`, both raising `0A000`. Exactly `0071`'s construction for
`golden_corrections`, which is the sibling table and already append-only — the
two now refuse the same verbs by the same mechanism with the same SQLSTATE, and
a reader does not have to hold two models.

`BEFORE`, so nothing is written before the refusal. `FOR EACH STATEMENT`, for
`0001`'s measured reason: a `FOR EACH ROW` trigger is silent for a statement
that matches no row, and `DELETE FROM golden_fields WHERE false` succeeding
quietly is indistinguishable at the client from a refusal that did not happen.

## What this leaves standing, and it is not nothing

**INSERT is still unrestricted, and a fabricated `created_at` is still
possible.** `0070` gives `created_at` a `now()` default and no trigger overrides
a supplied value, so a fresh row can claim to have been established last year.
This revision does not close that: it closes the SUBSTITUTION — a row that
already exists cannot be replaced by a different row wearing its identity —
which is what `0072`'s seven columns are about. A backdated new establishment is
a different defect and belongs with whoever owns `created_at`'s provenance.

## 🔴 THE CEILING

`titlepipe_owner` can `DROP TRIGGER golden_fields_no_delete ON golden_fields`
and then delete freely, and `titlepipe_owner` is one `SET ROLE` from
`titlepipe_migration`, a LOGIN role. Every append-only guarantee in this schema
tops out in the same place and this one is not an exception — `0001`'s
`audit_log` triggers, `0071`'s on `golden_corrections`, and these.

`0072` scoped its residual to "a superuser remains a superuser". That was too
generous by one role: the real residual is the OWNER, which is not a superuser,
and which the demonstrated transplant used.

What raises the bar without closing it, and it is deliberately not in the
database: the trigger's presence, its function's BODY and `tgenabled` are all
asserted from git by `tests/test_trigger_function_bodies.py`. An owner who drops
this trigger fails no statement; they fail CI. That is a different trust domain
from the one they are inside, and it is the only one available until DDL on this
schema requires a second party — a migration-signing gate, or an owner role no
interactive session can `SET ROLE` into.

This paragraph is now the schema-wide statement in `docs/backend/TRUST-MODEL.md`,
with the sequence driven end to end and with what CI does NOT cover: it runs
against a testcontainer, so it catches a change that reaches the repository and
not one made directly against a deployed cluster and then undone.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0101"
down_revision: str | None = "0100"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLE = "golden_fields"

# `0071`'s spelling for `golden_corrections`, narrowed to the two verbs this
# table refuses. `golden_fields` accepts UPDATE — a correction moves a value
# through `0072`'s ledger — so this function cannot be named `reject_mutation`
# and must not be attached to UPDATE. The name says which verbs it is for.
REFUSE_FUNCTION = "golden_fields_reject_removal"
NO_DELETE_TRIGGER = "golden_fields_no_delete"
NO_TRUNCATE_TRIGGER = "golden_fields_no_truncate"

TRIGGER_ALWAYS = "A"

# `feature_not_supported`, which `0001` and `0071` both raise for this. A code no
# typo produces: an unknown column is `42703` and an unknown table `42P01`, so a
# test asserting "something raised" is also satisfied by a misspelled identifier
# in the test itself.
APPEND_ONLY_SQLSTATE = "0A000"


def refusal_body() -> str:
    """The refusal body, exposed so a test can compare it to `pg_proc`.

    A `BEFORE` trigger function that returns NULL SILENTLY SUPPRESSES the
    statement, which is indistinguishable from success at the client — so this
    one never returns at all. It is declared `RETURNS trigger` because that is
    the only signature `CREATE TRIGGER` accepts.

    `TG_OP` in the message rather than two functions: the refusal has to say
    whether it caught a DELETE or a TRUNCATE, and one function keeps the two
    triggers provably identical in behaviour.
    """
    return f"""
        BEGIN
            RAISE EXCEPTION USING
                ERRCODE = '{APPEND_ONLY_SQLSTATE}',
                MESSAGE = '{TABLE} is not deletable; ' || TG_OP || ' is refused',
                HINT = 'A golden field is corrected, never removed and rewritten. '
                       'DELETE plus a fresh INSERT reproduces the same id with a '
                       'different order_id and a revision of 0, which is a '
                       'substitution under the original signature and not a '
                       'correction. Record a golden_corrections row and UPDATE.';
        END;
    """


def upgrade() -> None:
    op.execute(
        f"""
        CREATE FUNCTION {REFUSE_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $${refusal_body()}$$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {REFUSE_FUNCTION}() FROM PUBLIC")

    for trigger, verb in ((NO_DELETE_TRIGGER, "DELETE"), (NO_TRUNCATE_TRIGGER, "TRUNCATE")):
        # Two triggers rather than one naming both verbs: PostgreSQL will not
        # accept `TRUNCATE` in a trigger that also names a row-level verb, and
        # `0001` hit the same wall on `audit_log` and split for the same reason.
        op.execute(
            f"""
            CREATE TRIGGER {trigger}
            BEFORE {verb} ON {TABLE}
            FOR EACH STATEMENT EXECUTE FUNCTION {REFUSE_FUNCTION}()
            """
        )
        # `ENABLE ALWAYS`, for `0004`'s measured reason: a per-role
        # `session_replication_role = 'replica'` default is applied at CONNECT
        # and never checked again, so a plain `ENABLE` trigger can be off for a
        # whole session before any statement runs. `0004` measured a `DELETE 1`
        # with no refusal at all on `audit_log`'s pair at `'O'`.
        op.execute(f"ALTER TABLE {TABLE} ENABLE ALWAYS TRIGGER {trigger}")

    _require_trigger_state()


def downgrade() -> None:
    for trigger in (NO_TRUNCATE_TRIGGER, NO_DELETE_TRIGGER):
        op.execute(f"DROP TRIGGER {trigger} ON {TABLE}")
    op.execute(f"DROP FUNCTION {REFUSE_FUNCTION}()")


def _require_trigger_state() -> None:
    """Read `tgenabled` back, and refuse unless BOTH triggers are at `'A'`.

    `0071::_require_trigger_state` in intent: "the `ALTER` statement ran" and
    "`tgenabled` is `'A'`" are different claims and only the second is the
    point. `pg_trigger` rather than `information_schema`, which models no such
    column.
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
            {"table": TABLE, "names": [NO_DELETE_TRIGGER, NO_TRUNCATE_TRIGGER]},
        )
        .fetchall()
    )

    states = {str(name): str(enabled) for name, enabled in rows}
    expected = {NO_DELETE_TRIGGER: TRIGGER_ALWAYS, NO_TRUNCATE_TRIGGER: TRIGGER_ALWAYS}
    if states != expected:
        raise RuntimeError(
            f"{TABLE}'s removal triggers are {states}, not {expected}. "
            f"ENABLE ALWAYS is what keeps them firing under "
            f"session_replication_role = 'replica'; at 'O' a DELETE succeeds "
            f"silently, which is the state this revision exists to leave behind."
        )

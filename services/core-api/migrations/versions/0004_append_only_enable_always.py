"""`audit_log`'s two append-only triggers become `ENABLE ALWAYS`

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-02

---------------------------------------------------------------------------
🔴 THE RULING `0001` LEFT OPEN. `tgenabled = 'O'` MEANS THE APPEND-ONLY
   GUARANTEE IS OFF FOR ANY SESSION IN `session_replication_role = 'replica'`,
   AND THAT IS NOT A THEORETICAL HOLE.
---------------------------------------------------------------------------
`0001::_create_append_only_trigger` states the qualification in prose — "a
superuser can set `session_replication_role = 'replica'`, under which ordinary
triggers do not fire, and then `DELETE` freely" — and then argues the residual
away on two grounds: the GUC is `SUSET` so no TitlePipe role may `SET` it
in-session, and `migrations/sql/roles.sql:940-1010` converges
`pg_db_role_setting` in both scopes so no per-role DEFAULT can plant it either.

**BOTH OF THOSE ARE CONTROLS ON WHO CAN ENTER REPLICA MODE. NEITHER IS A
CONTROL ON WHAT HAPPENS ONCE A SESSION IS IN IT.** `ENABLE ALWAYS` is the
second kind, and it is the only one the TABLE itself carries. The distinction
matters because the first kind is a chain of preconditions maintained in
another file, re-established only when `roles.sql` is next run, while
`tgenabled` is a catalog fact on `audit_log` that holds on every connection
regardless of how it was made.

MEASURED 2026-09-02 against `postgres:18.4` (the container this suite pins), on
a table carrying byte-for-byte `0001`'s trigger pair — a `BEFORE UPDATE OR
DELETE ... FOR EACH STATEMENT` and a `BEFORE TRUNCATE ... FOR EACH STATEMENT`,
both calling one `RAISE EXCEPTION USING ERRCODE = '0A000'` function:

    -- tgenabled = 'O', which is what 0001 leaves behind
    SET session_replication_role = 'replica';
    SELECT count(*) FROM probe_audit;   ->  1
    DELETE FROM probe_audit;            ->  DELETE 1        🔴 NO REFUSAL
    SELECT count(*) FROM probe_audit;   ->  0

    ALTER TABLE probe_audit ENABLE ALWAYS TRIGGER probe_ao;
    ALTER TABLE probe_audit ENABLE ALWAYS TRIGGER probe_nt;
    -- tgenabled = 'A'
    SET session_replication_role = 'replica';
    DELETE FROM probe_audit;
      -> ERROR: probe is append-only; DELETE is refused
    UPDATE probe_audit SET id = id WHERE id = gen_random_uuid();   -- zero-match
      -> ERROR: probe is append-only; UPDATE is refused
    TRUNCATE probe_audit;
      -> ERROR: probe is append-only; TRUNCATE is refused

All three verbs, including the zero-match UPDATE that the `FOR EACH STATEMENT`
choice exists for. `'A'` closes the hole completely and costs nothing.

## Why the ruling is "implement it" rather than "document why 'O' is accepted"

The alternative on the table was to accept `'O'` on the strength of
`roles.sql`. That was refused, and the reason is what the `roles.sql` commentary
itself records at lines 985-1000: `ALTER ROLE ... RESET ALL` **silently skips
every parameter the issuing session may not set, and returns success anyway**,
so on a managed cluster where nobody holds SUPERUSER the one setting that
matters most — `session_replication_role`, which is exactly the one that
switches these triggers off — is precisely the one that survives convergence.
`roles.sql` degrades to a `RAISE WARNING` naming the parameter. A guarantee
whose last line of defence is a warning in a server log is not a guarantee, and
`audit_log` is the one table this system promises never to edit in place.

`ENABLE ALWAYS` is unconditional at the table and needs no other file to have
run. It is a strictly stronger state with no behaviour to trade away.

## What `ENABLE ALWAYS` costs, stated rather than waved at

`'A'` means the trigger fires in EVERY replication role, including on a
subscriber applying replicated changes. **If `audit_log` is ever added to a
logical-replication subscription, apply will fail on the first replicated
UPDATE or DELETE with `0A000`.** That is the correct outcome for an append-only
audit table: replicated INSERTs — the only verb this table accepts from its own
application — pass untouched, and a replicated UPDATE or DELETE is history being
edited in place through a side channel, which is the exact thing the trigger
exists to refuse. The refusal is loud and names itself.

The other cost is `pg_dump`/`pg_restore`, and it is the one worth knowing:
`pg_restore --disable-triggers` works by setting `session_replication_role =
'replica'`, so it will NOT be able to suppress these two. That only bites on a
restore that replays UPDATEs or DELETEs against `audit_log`; a data-only restore
of INSERTs is unaffected. A restore that genuinely needs it must
`ALTER TABLE audit_log DISABLE TRIGGER` explicitly, as the owner — a deliberate
act that leaves `tgenabled = 'D'`, which
`tests/test_schema_migration.py::test_audit_logs_triggers_are_statement_level
_before_and_enabled` fails on.

## Why a new revision rather than an edit to `0001`

`0001` is applied. Editing a landed revision changes nothing on any database
that already ran it, and a schema fix that only reaches databases created after
today is not a fix. This is `ALTER`, so it converges an existing `audit_log`.

## The downgrade is real and is `ENABLE REPLICA`-free

`downgrade()` returns both triggers to `'O'` via plain `ENABLE TRIGGER`, which
is the state `0001` creates them in — so `0003 -> 0004 -> 0003` lands on
byte-identical catalog contents and `test_upgrade_downgrade_upgrade_is_clean`'s
whole-schema diff stays quiet. It deliberately does NOT use `ENABLE REPLICA`
(`'R'`), which fires ONLY in replica mode and would be strictly weaker than
either endpoint.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# `0001`'s two trigger names, spelled out rather than imported from that
# revision module. Alembic revision files are loaded by path and are not a
# package; importing across them is not a supported seam, and a revision that
# reached into another would break the day the older one is squashed away.
APPEND_ONLY_TRIGGER = "audit_log_append_only"
NO_TRUNCATE_TRIGGER = "audit_log_no_truncate"
APPEND_ONLY_TABLE = "audit_log"

# `pg_trigger.tgenabled` values. `'A'` is ALWAYS — fires in every replication
# role; `'O'` is ORIGIN, the default, which does not fire under
# `session_replication_role = 'replica'`.
TRIGGER_ALWAYS = "A"
TRIGGER_ORIGIN = "O"


def upgrade() -> None:
    """Both triggers to `ENABLE ALWAYS`, then the catalog read back.

    THE VERIFICATION IS NOT DECORATION. `ALTER TABLE ... ENABLE ALWAYS TRIGGER`
    names the trigger, and a name that does not exist raises — but the whole
    point of this revision is a catalog VALUE, and the statement succeeding is
    not the same claim as `tgenabled` having moved. The check makes a migration
    that ran against a table whose triggers were previously `DISABLE`d, or that
    somehow did not take, fail here rather than land a green migration over an
    unprotected audit table.
    """
    for trigger in (APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER):
        op.execute(f"ALTER TABLE {APPEND_ONLY_TABLE} ENABLE ALWAYS TRIGGER {trigger}")

    _require_trigger_state(TRIGGER_ALWAYS)


def downgrade() -> None:
    """Back to `'O'`, which is exactly the state `0001` creates.

    `ENABLE TRIGGER` and not `ENABLE REPLICA TRIGGER`: see the module docstring.
    """
    for trigger in (APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER):
        op.execute(f"ALTER TABLE {APPEND_ONLY_TABLE} ENABLE TRIGGER {trigger}")

    _require_trigger_state(TRIGGER_ORIGIN)


def _require_trigger_state(expected: str) -> None:
    """Refuse unless BOTH triggers are at `expected`, naming the ones that are not.

    Reads `pg_trigger` joined to `pg_class` rather than `information_schema`,
    which has no column for `tgenabled` at all — the replication-role state of a
    trigger is a PostgreSQL extension and the SQL-standard views do not model it.

    `NOT tgisinternal` for the same reason `tests/test_schema_migration.py::
    _triggers` uses it: constraint-backing triggers are PostgreSQL's, not ours,
    and `audit_log`'s primary key has them.
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
            {
                "table": APPEND_ONLY_TABLE,
                "names": [APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER],
            },
        )
        .fetchall()
    )

    found = {str(name): str(enabled) for name, enabled in rows}
    wrong = {name: found.get(name) for name in (APPEND_ONLY_TRIGGER, NO_TRUNCATE_TRIGGER)}
    wrong = {name: state for name, state in wrong.items() if state != expected}

    if wrong:
        detail = ", ".join(f"{name} is {state!r}" for name, state in sorted(wrong.items()))
        raise RuntimeError(
            f"0004: {APPEND_ONLY_TABLE}'s append-only triggers are not at "
            f"tgenabled={expected!r} after this revision ran — {detail}. A "
            f"missing trigger reads as None. Nothing in this run has been "
            f"committed."
        )

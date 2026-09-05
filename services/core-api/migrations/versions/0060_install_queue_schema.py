"""Install the Procrastinate queue schema, and grant it to the two roles that use it

Revision ID: 0060
Revises: 0004
Create Date: 2026-09-05

ASSUMED PARENT: `0004_append_only_enable_always`, which was the chain head in this
working tree when this revision was written. Several workers are writing
migrations at once and none of us reconciles the chain — `down_revision` is the
head as found, per `design/backend-2026-09/CONVENTIONS.md` §8, and god linearizes
at integration. Nothing in this revision depends on a domain table, so it can be
re-parented onto any of the sibling revisions without a content change.

## What lands here

`migrations/sql/procrastinate_schema_3.9.0.sql`, executed verbatim: four tables,
three types, eighteen functions, seven triggers and their indexes. That file is a
byte copy of the library's own `procrastinate/sql/schema.sql`, and
`services/worker/tests/test_queue_schema.py::test_the_vendored_schema_is_the_installed_librarys`
is what refuses to let the two drift.

Then the part the library does not ship and this repository cannot do without:
the GRANTs, and a read-back that refuses the migration if they did not land.

## 🔴 THESE FOUR TABLES ARE NOT TENANT-SCOPED, AND THAT IS A DECISION WITH A COST

`CONVENTIONS.md` §1 requires a real `tenant_id`, a composite primary key and
RLS+FORCE+policy on every tenant-scoped table. None of that is here. The reason
is not that the queue holds no tenant data — it will hold a tenant id in almost
every job's `args` — it is that these tables cannot be tenant-scoped and remain
the library's:

* a worker services every tenant. `procrastinate_fetch_job_v2` picks the next
  job across the whole queue; a policy keyed on a per-session GUC would make the
  worker's own fetch return nothing, because a worker has no one tenant to be;
* `tenant_id` is not a column the library has, and adding one means forking the
  DDL AND the eighteen functions that read these tables by name. A forked queue
  stops receiving upstream fixes and starts being ours to get right.

So the queue is SYSTEM state, in the same class as `alembic_version`: not
tenant-scoped, and not pretending to be.

**What that costs, stated rather than implied.** Any role holding `SELECT` on
`procrastinate_jobs` reads every tenant's job arguments. Exactly two roles hold
it — `titlepipe_worker`, which must, and `titlepipe_app`, which needs it because
`INSERT ... RETURNING id` is a read. `titlepipe_blind` holds nothing here and is
not named anywhere in this file; it is intended for its own database.

**The residual, named because there is no machine for it.** Nothing in the
database stops a caller putting a name, an address or a document excerpt into
`args`. The convention is identifiers only — a tenant id, an order id, a page
number, an engine id — and the convention is all it is. A CHECK constraint cannot
express it, and the worker-side defer seam cannot enforce it either, because
core-api defers through the same SQL functions without passing through the
worker's code. This is an UNPROVEN RESIDUAL in the sense of `CONVENTIONS.md` §9,
recorded here rather than asserted away in a comment.

**What this revision does give a coverage check to key on.** PLAN §5 rule 4 wants
an assertion that every tenant-scoped table has RLS, and that check does not exist
yet. When it is written it must not simply hard-code four exemptions, so each
table below gets a `COMMENT ON TABLE` carrying `QUEUE-INFRASTRUCTURE:` as its
first token. A coverage check can then be derived from the catalog — "a table in
`public` with no `tenant_id` column is either commented as infrastructure or it is
a defect" — instead of from a list that ages in a test file.

## 🔴 THE SEQUENCE GRANTS, AND THE TEST IN CORE-API THAT THIS REVISION TRIPS

`0002` states, and `tests/test_forced_rls_and_grants.py::test_there_are_no_sequences_for_a_sequence_grant_to_reach`
asserts, that schema `public` holds zero relations of kind `S`. That was true and
this revision ends it: `procrastinate_jobs`, `procrastinate_events` and
`procrastinate_periodic_defers` are `bigserial`, which is three sequences.

**That test is doing exactly what it was written to do and it will go red.** Its
own docstring says so: "This is the test that notices the day that stops being
true." It has noticed. The remedy is not to delete it but to replace the claim
with the stronger one this revision has to satisfy anyway — every sequence in
`public` is `USAGE`-granted to every role that inserts into the table owning it —
and that assertion is written, against a live database, in
`services/worker/tests/test_queue_schema.py::test_every_sequence_is_granted_to_the_roles_that_insert`.
Editing core-api's test suite is outside this worker's file set, so the
replacement is offered there and the collision is reported rather than resolved.

`procrastinate_workers.id` is `GENERATED ALWAYS AS IDENTITY` and gets NO sequence
grant, deliberately: an identity column's sequence is internally dependent on the
column and PostgreSQL does not check sequence privileges for it. That is a claim
about a database, so it is asserted by
`test_the_identity_sequence_needs_no_grant`, which inserts a worker row as
`titlepipe_worker` with nothing granted on that sequence.

## 🔴 WHY THE SCHEMA GOES THROUGH THE RAW DBAPI CURSOR AND NOT THROUGH SQLALCHEMY

The vendored file contains four `RAISE ... (job id: %)` messages inside PL/pgSQL
function bodies, and under psycopg's `pyformat` paramstyle a `%` is a placeholder.

MEASURED against SQLAlchemy 2.0 / psycopg 3, both obvious spellings fail:

    op.execute(sa.text(schema_sql))          -> psycopg.ProgrammingError:
    op.get_bind().exec_driver_sql(schema_sql)   only '%s', '%b', '%t' are allowed
                                                as placeholders, got '%)'

An earlier version of this file claimed `exec_driver_sql` was safe because a
statement with no bound parameters routes through `Dialect.do_execute_no_params`.
It does not: SQLAlchemy still hands psycopg an (empty) parameter collection, and
`PostgresQuery.convert` parses for placeholders whenever `vars is not None` — an
empty tuple is not None.

**Doubling the `%` is what the library itself does, and it would be WRONG here.**
`SchemaManager.apply_schema` calls `.replace("%", "%%")` before a PARAMETERISED
execute, where psycopg's own interpolation pass turns `%%` back into `%` before
the text reaches the server. With no interpolation pass the doubling survives into
the stored function body — and PL/pgSQL reads `%%` as a literal percent sign, so
`RAISE '... (job id: %%)', job_id` is not a cosmetic wart but a function that
raises `too many parameters specified for RAISE`, discovered the first time a job
fails.

So the text is handed to the DBAPI cursor with the parameter argument OMITTED,
which is the one path where `vars is None` and no parsing happens. It is the same
connection and the same transaction — `Connection.connection` is the DBAPI
connection SQLAlchemy is already holding — so this is not a second session and
rolls back with the rest of the migration.

## Ordering

The schema first, then the grants, then the read-back. The read-back is last
because it is the only statement here whose failure is informative: everything
before it either succeeds or raises with PostgreSQL's own message.

RELINKED AT INTEGRATION, 2026-09-05: `down_revision` was `0004` - the head as this file's
author found it, per CONVENTIONS section 8 - and is now `0051`, the last revision of the domain chain. The queue schema references no domain table; it is
placed after the domain so that one head exists, not because it depends on it.
"""

from __future__ import annotations

import pathlib
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0060"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The vendored DDL. Resolved relative to THIS file rather than to the process's
# cwd, for the reason `alembic.ini` gives for `%(here)s`: this suite is run from
# the repository root as often as from `services/core-api/`.
SCHEMA_SQL_PATH = (
    pathlib.Path(__file__).resolve().parent.parent / "sql" / "procrastinate_schema_3.9.0.sql"
)

# The library release the file above was copied from. Named here so that the
# drift test in `services/worker` has a single thing to compare against and so
# that a reader of this revision knows what it installed without opening a lock
# file.
SCHEMA_SOURCE_VERSION = "3.9.0"

# The marker a future RLS-coverage check keys on. First token of the table
# comment, so the check is `comment LIKE 'QUEUE-INFRASTRUCTURE:%'` rather than a
# list of four table names kept somewhere else.
INFRASTRUCTURE_MARKER = "QUEUE-INFRASTRUCTURE"

QUEUE_TABLES = (
    "procrastinate_jobs",
    "procrastinate_events",
    "procrastinate_periodic_defers",
    "procrastinate_workers",
)

# The three `bigserial` sequences. `procrastinate_workers` is IDENTITY and is
# deliberately absent — see the header.
QUEUE_SEQUENCES = (
    "procrastinate_jobs_id_seq",
    "procrastinate_events_id_seq",
    "procrastinate_periodic_defers_id_seq",
)

WORKER_ROLE = "titlepipe_worker"
APP_ROLE = "titlepipe_app"


# --- the grants, table by table, with the verb list justified at each one ------
#
# Written out per role rather than generated from a matrix, for the reason `0001`
# and `0002` both give: each object gets one reviewable line, and the two that
# differ from their neighbours differ visibly rather than inside a branch.
#
# A privilege is granted when something calls the query that needs it, and not
# before. The two visible absences are both of that kind and both are stated:
#   * `titlepipe_app` gets no UPDATE on `procrastinate_jobs`. Cancel and abort
#     (`procrastinate_cancel_job_v1`) need it and no endpoint calls them yet.
#   * neither role gets anything on `alembic_version`, which is unchanged.
WORKER_TABLE_GRANTS = (
    # fetch (SELECT+UPDATE), finish and retry (UPDATE), defer from inside a task
    # (INSERT), `remove_old_jobs` and `finish_job(delete_job => true)` (DELETE).
    ("procrastinate_jobs", "SELECT, INSERT, UPDATE, DELETE"),
    # 🔴 INSERT IS NOT OPTIONAL AND IS EASY TO MISS. Nothing in the worker's code
    # writes an event row: five AFTER/BEFORE triggers on `procrastinate_jobs` do,
    # and they are SECURITY INVOKER, so they run with the privileges of whoever
    # touched the job. Without INSERT here every fetch fails with
    # `permission denied for table procrastinate_events` pointing at a table the
    # worker never names.
    ("procrastinate_events", "SELECT, INSERT, DELETE"),
    # `procrastinate_defer_periodic_job_v2` inserts the defer row, updates it with
    # the job id, and deletes the superseded ones; the BEFORE DELETE trigger on
    # jobs updates `job_id` to NULL. All four verbs, all four reachable.
    ("procrastinate_periodic_defers", "SELECT, INSERT, UPDATE, DELETE"),
    # register (INSERT), heartbeat (UPDATE), unregister and prune (DELETE),
    # stalled-worker lookup (SELECT).
    ("procrastinate_workers", "SELECT, INSERT, UPDATE, DELETE"),
)

APP_TABLE_GRANTS = (
    # `procrastinate_defer_jobs_v1` is an INSERT that RETURNs the new id, and
    # RETURNING is a read: SELECT is required for the defer to work at all, not
    # for any query core-api issues by hand.
    ("procrastinate_jobs", "SELECT, INSERT"),
    # Same trigger argument as above, from the producer's side: core-api's INSERT
    # fires `procrastinate_trigger_function_status_events_insert_v1`.
    ("procrastinate_events", "INSERT"),
)

# EXECUTE on a function and USAGE on a type are granted to `PUBLIC` by default,
# so on an ordinary cluster these statements change nothing. They are issued
# anyway, and the reason is the one `0002` records for its schema grant: a
# hardened cluster that has done `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public
# FROM PUBLIC` is a real deployment shape, and there the default is gone. The
# read-back below is what distinguishes "granted" from "granted by default".
GRANTED_ROLES = (WORKER_ROLE, APP_ROLE)


def _grant_tables(role: str, grants: tuple[tuple[str, str], ...]) -> None:
    for table, verbs in grants:
        op.execute(f"GRANT {verbs} ON {table} TO {role}")


def _revoke_tables(role: str, grants: tuple[tuple[str, str], ...]) -> None:
    for table, verbs in reversed(grants):
        op.execute(f"REVOKE {verbs} ON {table} FROM {role}")


def _comment_infrastructure_tables() -> None:
    """Mark the four tables as not-tenant-scoped-on-purpose, in the catalog.

    A comment enforces nothing by itself and is not claimed to. What it does is
    give the RLS-coverage check PLAN §5 rule 4 asks for something derived to key
    on, so that check can be written against the catalog instead of against a
    hard-coded exemption list that nobody updates when a fifth queue table
    arrives.
    """
    for table in QUEUE_TABLES:
        op.execute(
            f"COMMENT ON TABLE {table} IS "
            f"'{INFRASTRUCTURE_MARKER}: queue state, not tenant-scoped. "
            f"Installed by migration {revision} from procrastinate "
            f"{SCHEMA_SOURCE_VERSION}. See that revision for why RLS is absent "
            f"and what it costs.'"
        )


def _queue_functions() -> list[tuple[int, str]]:
    """Every `procrastinate_*` function in `public`, as `(oid, signature)`.

    Read from `pg_proc` rather than listed here. Eighteen signatures maintained
    by hand is eighteen chances to mistype `timestamp with time zone`, and the
    consequence of a typo would be a `downgrade` that leaves functions behind
    while reporting success. `pg_get_function_identity_arguments` gives the exact
    text `GRANT` and `DROP FUNCTION` accept.

    🔴 THE OID IS CARRIED ALONGSIDE IT BECAUSE THE SIGNATURE IS NOT INTERCHANGEABLE
    WITH IT. `pg_get_function_identity_arguments` includes argument NAMES, which
    `GRANT` and `DROP FUNCTION` accept and `has_function_privilege(text)` does
    not — MEASURED, it parses its second argument as a type list and answers

        ERROR: syntax error at or near "bigint"
        CONTEXT: invalid type name "job_id bigint"

    on `procrastinate_cancel_job_v1(job_id bigint, abort boolean, ...)`. The oid
    overload has no such ambiguity, so the read-back uses it and the DDL uses the
    text.
    """
    rows = (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT p.oid, p.proname || '(' || "
                "pg_get_function_identity_arguments(p.oid) || ')' AS signature "
                "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                "WHERE n.nspname = 'public' AND p.proname LIKE 'procrastinate\\_%' "
                "ORDER BY signature"
            )
        )
        .all()
    )
    return [(int(row[0]), str(row[1])) for row in rows]


def _sequence_grantees() -> dict[str, tuple[str, ...]]:
    """`<table>_id_seq` -> the roles that hold INSERT on `<table>`.

    Derived from the grant tuples above rather than written out again, so a role
    cannot be given INSERT on a `bigserial` table and left without the sequence
    `USAGE` that makes the INSERT actually work. That failure mode is worth the
    derivation: the error is `permission denied for sequence
    procrastinate_jobs_id_seq`, which names the sequence and not the grant.
    """
    grantees: dict[str, list[str]] = {sequence: [] for sequence in QUEUE_SEQUENCES}
    for role, grants in ((WORKER_ROLE, WORKER_TABLE_GRANTS), (APP_ROLE, APP_TABLE_GRANTS)):
        for table, verbs in grants:
            sequence = f"{table}_id_seq"
            if sequence in grantees and "INSERT" in verbs:
                grantees[sequence].append(role)
    return {sequence: tuple(roles) for sequence, roles in grantees.items()}


def _require_privileges(functions: list[tuple[int, str]]) -> None:
    """Read every privilege back, and refuse the migration if one is missing.

    ---------------------------------------------------------------------------
    🔴 THIS IS NOT CEREMONY. A `GRANT` issued by a role that cannot give the
       privilege away is a WARNING in PostgreSQL, not an error, and neither
       `op.execute` nor `ON_ERROR_STOP` sees a warning.
    ---------------------------------------------------------------------------
    `0002` measured that exact shape on schema `public`, whose owner is
    `pg_database_owner` rather than `titlepipe_owner`, and answered it the same
    way. The objects here are created by this migration and therefore owned by
    the role issuing the grants, so on an ordinary cluster every statement above
    lands. What this refuses is the cluster where it did not — a pre-existing
    `procrastinate_jobs` owned by somebody else (a database where the library's
    own `procrastinate schema --apply` was run first, which is the documented way
    to install it and therefore a realistic thing to find), or a `REVOKE` in a
    hardening script that runs after migrations.

    A missing grant discovered here is a `RuntimeError` during deploy. The same
    missing grant discovered at run time is a worker that starts, reports itself
    healthy, and fails every job with a permission error naming a table nobody
    wrote a query against.
    """
    bind = op.get_bind()
    missing: list[str] = []

    expected_tables = [
        (role, table, verb.strip())
        for role, grants in ((WORKER_ROLE, WORKER_TABLE_GRANTS), (APP_ROLE, APP_TABLE_GRANTS))
        for table, verbs in grants
        for verb in verbs.split(",")
    ]
    for role, table, verb in expected_tables:
        held = bind.execute(
            sa.text("SELECT has_table_privilege(:role, :table, :verb)"),
            {"role": role, "table": table, "verb": verb},
        ).scalar_one()
        if not held:
            missing.append(f"{verb} ON TABLE {table} TO {role}")

    for sequence, roles in _sequence_grantees().items():
        for role in roles:
            held = bind.execute(
                sa.text("SELECT has_sequence_privilege(:role, :sequence, 'USAGE')"),
                {"role": role, "sequence": sequence},
            ).scalar_one()
            if not held:
                missing.append(f"USAGE ON SEQUENCE {sequence} TO {role}")

    for oid, signature in functions:
        for role in GRANTED_ROLES:
            held = bind.execute(
                sa.text("SELECT has_function_privilege(:role, :oid, 'EXECUTE')"),
                {"role": role, "oid": oid},
            ).scalar_one()
            if not held:
                missing.append(f"EXECUTE ON FUNCTION {signature} TO {role}")

    if missing:
        listed = "\n  ".join(missing)
        raise RuntimeError(
            f"revision {revision} installed the queue schema but the following "
            f"privileges are not held after the GRANTs ran:\n  {listed}\n"
            f"PostgreSQL reports a GRANT from a role holding no grant option as a "
            f"WARNING rather than an error, so this migration would otherwise have "
            f"exited 0 and left a worker that fails every job with a permission "
            f"error. Check who owns the procrastinate_* objects — if they were "
            f"created by `procrastinate schema --apply` rather than by this "
            f"revision, they belong to a different role and these grants were "
            f"no-ops."
        )


def upgrade() -> None:
    # The raw DBAPI cursor, with the parameter argument omitted — the one path on
    # which psycopg does not read `%` as a placeholder. Same connection, same
    # transaction. See the header for the two spellings that were measured to
    # fail and for why doubling the `%` would corrupt the function bodies.
    with op.get_bind().connection.cursor() as cursor:
        cursor.execute(SCHEMA_SQL_PATH.read_text(encoding="utf-8"))

    _comment_infrastructure_tables()

    _grant_tables(WORKER_ROLE, WORKER_TABLE_GRANTS)
    _grant_tables(APP_ROLE, APP_TABLE_GRANTS)

    for sequence, roles in _sequence_grantees().items():
        # `USAGE` alone, not `USAGE, SELECT`. `nextval` needs USAGE; `currval`
        # and a direct `SELECT` on the sequence need SELECT, and nothing here
        # reads a sequence directly — the ids come back through
        # `INSERT ... RETURNING`.
        op.execute(f"GRANT USAGE ON SEQUENCE {sequence} TO {', '.join(roles)}")

    functions = _queue_functions()
    if not functions:
        raise RuntimeError(
            f"revision {revision} executed {SCHEMA_SQL_PATH.name} and found no "
            f"procrastinate_* functions in schema public afterwards. The file is "
            f"expected to create eighteen; a run that creates none has executed "
            f"something other than the vendored schema."
        )
    for _oid, signature in functions:
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO {', '.join(GRANTED_ROLES)}")

    op.execute(f"GRANT USAGE ON TYPE procrastinate_job_to_defer_v1 TO {', '.join(GRANTED_ROLES)}")
    op.execute(f"GRANT USAGE ON TYPE procrastinate_job_status TO {', '.join(GRANTED_ROLES)}")
    op.execute(f"GRANT USAGE ON TYPE procrastinate_job_event_type TO {', '.join(GRANTED_ROLES)}")

    _require_privileges(functions)


def downgrade() -> None:
    """Remove everything the vendored schema created, discovered from the catalog.

    THE DROP LIST IS NOT WRITTEN OUT HERE, and that is the point. Eighteen
    function signatures maintained by hand would go stale the first time
    `procrastinate` is bumped and the vendored file changes; a `DROP FUNCTION`
    naming a signature that no longer exists raises, and one that MISSES a
    function leaves it behind while the migration reports success. Reading
    `pg_proc`, `pg_class` and `pg_type` means this function removes what is
    actually there.

    🔴 THE CATALOG IS READ TWICE, AND THAT IS WHAT MAKES THE ORDER WORK. These
    objects are mutually entangled, and both single-pass orders fail — MEASURED
    against postgres:18.4:

    * functions first: `DROP FUNCTION procrastinate_notify_queue_abort_job_v1()`
      -> `trigger procrastinate_jobs_notify_queue_job_aborted_v1 on table
      procrastinate_jobs depends on function ...`;
    * tables first, with the function list read up front: `DROP TABLE
      procrastinate_jobs CASCADE` silently takes `procrastinate_fetch_job_v2`
      with it, because that function is declared `RETURNS procrastinate_jobs`, and
      the later `DROP FUNCTION` then raises `function
      procrastinate_fetch_job_v2(character varying[], bigint) does not exist`.

    So: drop the tables first, then read the catalog AGAIN and drop whatever
    functions survived. `DROP TABLE ... CASCADE` is exactly the right instrument
    for the first pass — it reaches the triggers, the indexes, the `bigserial`
    sequences, the foreign keys between the four and the two functions typed on a
    table row — and the second read is what stops the second pass from naming
    something the first pass already removed. Types go last: an enum cannot be
    dropped while a column has it.

    No `IF EXISTS`, for the reason `0001` gives for `checkfirst=False`: an object
    that is already gone at downgrade time means something else removed it, and
    that is an error rather than a shrug. The one place this function tolerates
    absence is the whole-schema case below, which is a different claim — it
    reports that there was nothing of this revision's to remove.

    The grants are not revoked separately. `DROP TABLE` and `DROP FUNCTION`
    remove the object and its ACL together; a `REVOKE` before the drop would be
    two statements for one effect, and a `REVOKE` after it would name an object
    that no longer exists.
    """
    bind = op.get_bind()

    tables = [
        str(row[0])
        for row in bind.execute(
            sa.text(
                "SELECT c.relname FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                "AND c.relname LIKE 'procrastinate\\_%' ORDER BY c.relname"
            )
        ).all()
    ]
    if not tables and not _queue_functions():
        raise RuntimeError(
            f"revision {revision} has nothing to downgrade: schema public holds "
            f"no procrastinate_* tables and no procrastinate_* functions. "
            f"Something removed the queue schema outside this migration chain."
        )

    for table in tables:
        op.execute(f"DROP TABLE {table} CASCADE")

    # The second read. Anything typed on a table row type went with the tables
    # above; naming it here would raise.
    for _oid, signature in _queue_functions():
        op.execute(f"DROP FUNCTION {signature}")

    for type_name in bind.execute(
        sa.text(
            # The two enums and the one standalone composite type, and NOT the
            # row types of the tables — those went with the tables. A standalone
            # `CREATE TYPE ... AS (...)` also gets a `pg_class` entry, so
            # `typrelid = 0` is not the discriminator; `relkind` is, and it is
            # `c` for a free composite type and `r` for a table. Array types are
            # `typtype = 'b'` and are dropped with their element type.
            "SELECT t.typname FROM pg_type t "
            "JOIN pg_namespace n ON n.oid = t.typnamespace "
            "LEFT JOIN pg_class c ON c.oid = t.typrelid "
            "WHERE n.nspname = 'public' "
            "AND t.typname LIKE 'procrastinate\\_%' "
            "AND t.typtype IN ('e', 'c') "
            "AND (c.oid IS NULL OR c.relkind = 'c') "
            "ORDER BY t.typname"
        )
    ).all():
        op.execute(f"DROP TYPE {type_name[0]}")

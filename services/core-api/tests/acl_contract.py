"""THE CLOSED-WORLD ACL CONTRACT, IN ONE PLACE, RUNNABLE AGAINST ANY DATABASE.

`test_exact_acl_and_update_surface.py` owns three catalog assertions — no column
grant, no default privilege, and the whole-catalog ACL converging to an exact
literal. Those ran against ONE database: the ephemeral testcontainer that
`tests/conftest.py` builds, whose roles are applied by `_apply_roles_sql` as the
container's own `seam_admin` superuser and whose schema is applied by an
in-process `command.upgrade`.

`.github/workflows/migration-harness.yml` builds a SECOND database by a
different path: a `postgres:18.4` SERVICE container, `roles.sql` applied by
`psql` as the image's `postgres` superuser, and `alembic upgrade head` from the
CLI. Same two artifacts, different driver, different superuser, different
database name. Nothing was reading the catalog there at all — the harness proved
the browser could see rows, and said nothing about who else could.

That difference is not cosmetic. `schema:public:USAGE:PUBLIC` and the
`pg_database_owner` entries below are properties of how the DATABASE was
created, not of anything a revision writes, so they are exactly the class of
entry that can differ between the two paths. A contract asserted on one and not
the other is a contract with a hole the shape of the deployment.

So the literal and the query live here, imported by the test and executed by
`__main__` against a DSN. Two callers, one source. Editing the literal to match
an observed database is still the thing not to do — see the test's docstring.
"""

from __future__ import annotations

import sys
from collections.abc import Sequence

from sqlalchemy import create_engine, text

# The roles `migrations/sql/roles.sql` creates. Written out rather than imported
# for the reason `test_forced_rls_and_grants.py` gives at
# `EXPECTED_TENANT_TABLES`: a test that derives its expectation from the thing
# under test asserts nothing.
OWNER_ROLE = "titlepipe_owner"
APP_ROLE = "titlepipe_app"
WORKER_ROLE = "titlepipe_worker"
BLIND_ROLE = "titlepipe_blind"
MIGRATION_ROLE = "titlepipe_migration"

NON_OWNER_ROLES = frozenset({APP_ROLE, WORKER_ROLE, BLIND_ROLE, MIGRATION_ROLE})

# Not a role. `aclexplode` reports `grantee = 0` for it and `CATALOG_ACL_QUERY`
# renders that as this word, because `0::regrole` is `-`, which is not a name
# anybody can grep for or grant to.
PUBLIC_ROLE = "PUBLIC"

# The tenant-keyed tables the app holds SELECT/INSERT/UPDATE on at table level.
#
# 🔴 `fields` LEFT THIS TUPLE ON 2026-09-05 AND DID NOT LOSE A PRIVILEGE.
# `0032::_narrow_the_update_grant` does `REVOKE UPDATE ON fields FROM
# titlepipe_app` and then `GRANT UPDATE (<seventeen columns>) ON fields` — the
# revoke has to be table-wide and has to come first, because a column grant is
# ADDED to a table grant rather than shadowing it. So the app writes seventeen of
# that table's columns and holds no table-level `UPDATE`, which is why `fields`
# appears below under `APP_APPEND_SHAPED_TABLES` for its two table verbs and
# again in `FIELDS_COLUMN_UPDATE_GRANTS` for the seventeen. Moving it back here
# would restore the table-wide grant and make `state`, `tenant_id`, `order_id` and
# `path` writable again.
#
# The other nineteen names arrived with the `integration/backend-2026-09` merge.
# Each is a tenant-scoped table created by `0005`-`0080` whose revision grants the
# ordinary three verbs; the exceptions are the two lists after this one, and the
# reason a table is in one of those rather than here is always a trigger or a
# ruling and never an omission.
APP_WRITABLE_TABLES = (
    # `0001`, minus `fields`. See above.
    "orders",
    "packages",
    "pages",
    "field_readings",
    "tenants",
    # `0005`, `0006`, `0020`, `0030`, `0080`.
    "record_classifications",
    "legal_holds",
    "users",
    "documents",
    "clients",
    # `0040` — the instrument spine and the DERIVED links over it.
    "instruments",
    "chain_links",
    "chain_root_assertions",
    # `0041`.
    "escalations",
    "escalation_orders",
    # `0050`. `reports` is NOT here: it is append-only by trigger and is two
    # verbs below. `report_verified_checks` beside it deliberately is here — the
    # stored assurance sentences are amendable, the delivered report is not.
    "report_verified_checks",
    "deliveries",
    "delivery_receipt_steps",
    # `0051`.
    "products",
    "client_config_versions",
    "client_config_lines",
    "intake_signoffs",
    "intake_signoff_lines",
    "completeness_gaps",
    # `0070`. `UPDATE` is what a correction needs; `0072`'s trigger is what makes
    # it narrow, by refusing any UPDATE no `golden_corrections` row signs.
    "golden_fields",
)

# SELECT and INSERT and no UPDATE. Three of these four are append-only by trigger
# — `audit_log` (`0001`), `golden_corrections` (`0071`), `reports` (`0050`) — so
# granting UPDATE would change no behaviour and would MISSTATE THE INTENT on the
# tables this system promises never to edit in place.
#
# `fields` is the fourth and is here for a DIFFERENT reason, which is why this
# tuple is not called "the append-only tables": it has no append-only trigger and
# is edited constantly. It holds two TABLE verbs because its third is granted per
# column. See `APP_WRITABLE_TABLES`.
APP_APPEND_SHAPED_TABLES = (
    "audit_log",
    "golden_corrections",
    "reports",
    "fields",
)

# Read-only to the app, and both are outside tenancy. `rules` is the global
# rulebook (`0003`; rule creation and the engineer-confirm write arrive with
# their own refusal tests, not ahead of them). `retention_windows` is the
# statutory floor (`0005`) — the law is not the app's to rewrite.
APP_READ_ONLY_TABLES = ("rules", "retention_windows")

# `0032::FIELD_APP_UPDATABLE_COLUMNS`. THE SIX THAT ARE ABSENT ARE THE POINT:
# `id`, `created_at`, `tenant_id`, `order_id`, `path`, `state`. `tenant_id` is the
# column every `tenant_isolation` policy keys on and `0002` writes no `WITH
# CHECK`, so a role that could re-tenant a row could then read it; `state` moves
# only through `titlepipe_field_transition`; `order_id` and `path` are the field's
# identity.
FIELDS_UPDATABLE_COLUMNS = (
    "value",
    "na_reason",
    "source_document_id",
    "source_page_no",
    "source_snippet",
    "source_line_coords",
    "engine_id",
    "engine_confidence_raw",
    "approved_by",
    "approved_at",
    "correction_reason",
    "excluded_reason",
    "excluded_by",
    "excluded_at",
    "asking",
    "why",
    "consequence",
)

# ---------------------------------------------------------------------------
# 🔴 `0060`'s QUEUE GRANTS. NOT THIS REPOSITORY'S TABLES, STILL THIS
#    REPOSITORY'S PRIVILEGE DECISIONS.
# ---------------------------------------------------------------------------
# The vendored Procrastinate DDL ships no GRANTs at all — `0060` writes them, and
# reads them back so the revision fails if they did not land. What it granted is
# the interesting part and it is asymmetric on purpose:
#
# * `titlepipe_worker` gets DELETE as well as the other three, because a worker
#   prunes finished jobs. It is the ONLY grantee of DELETE anywhere in this
#   schema and the only place `REFUSED_VERBS` in
#   `test_forced_rls_and_grants.py` does not apply — that file's loops never
#   reach these tables, because they carry no `tenant_id`;
# * `titlepipe_app` gets SELECT and INSERT on `procrastinate_jobs` and INSERT on
#   `procrastinate_events`, which is what "enqueue a job" costs. `INSERT ...
#   RETURNING id` is a read, which is why SELECT is there;
# * `titlepipe_blind` holds NOTHING here and is not named in `0060` at all.
#
# 🔴 SELECT ON `procrastinate_jobs` READS EVERY TENANT'S JOB ARGUMENTS, and two
# roles hold it. There is no RLS on these tables and cannot be — a worker
# services every tenant, so a policy keyed on a per-session GUC would make its own
# fetch return nothing. `0060`'s docstring is the ruling and records the residual:
# nothing in the database stops a caller putting a name or a document excerpt into
# a job's `args`.
QUEUE_WORKER_FULL_TABLES = (
    "procrastinate_jobs",
    "procrastinate_periodic_defers",
    "procrastinate_workers",
)
QUEUE_WORKER_VERBS = ("SELECT", "INSERT", "UPDATE", "DELETE")

# `procrastinate_events` is append-shaped for the worker too — it holds DELETE
# for pruning and no UPDATE, because an event that happened does not change.
QUEUE_EVENTS_TABLE = "procrastinate_events"
QUEUE_EVENTS_WORKER_VERBS = ("SELECT", "INSERT", "DELETE")

# The three `bigserial` sequences and who must reach them. `procrastinate_workers`
# is `GENERATED ALWAYS AS IDENTITY` and gets NO sequence grant, deliberately: an
# identity column's sequence is internally dependent on the column and PostgreSQL
# checks no privilege for it. That absence is asserted rather than assumed, here
# and in `test_forced_rls_and_grants.py::test_every_sequence_is_usable_by_every_role
# _that_inserts_into_its_table`.
QUEUE_SEQUENCE_GRANTS = (
    ("procrastinate_jobs_id_seq", (APP_ROLE, WORKER_ROLE)),
    ("procrastinate_events_id_seq", (APP_ROLE, WORKER_ROLE)),
    ("procrastinate_periodic_defers_id_seq", (WORKER_ROLE,)),
)

# ---------------------------------------------------------------------------
# 🔴 ROUTINE GRANTS, AND WHY `PUBLIC` IS ON EIGHTEEN OF THEM.
# ---------------------------------------------------------------------------
# `EXECUTE` on a function is granted to `PUBLIC` by PostgreSQL's own
# `acldefault`, so a function nobody has granted on carries a NULL `proacl` and is
# invisible to `CATALOG_ACL_QUERY` below, which reads `proacl IS NOT NULL`. The
# eighteen queue functions appear here ONLY because `0060` granted EXECUTE to
# `titlepipe_worker`, which materialised the ACL and wrote the default out with
# it. That is the shipped state and not a decision `0060` made.
#
# It is inert for these eighteen: none is `SECURITY DEFINER`, so each runs with
# the CALLER's privileges and a role with no `INSERT` on `procrastinate_jobs`
# still cannot enqueue by calling `procrastinate_defer_jobs_v1`.
#
# 🔴 THE BLIND SPOT THAT LEAVES IS REAL AND IS ASSERTED ELSEWHERE, because it
# cannot be asserted here: every function with a NULL `proacl` also carries
# `EXECUTE TO PUBLIC` and this contract cannot see any of them. One of those is
# `SECURITY DEFINER` — `0041`'s `escalations_resolution_needs_a_live_rule`, where
# `0032` `REVOKE`s from `PUBLIC` on its own `SECURITY DEFINER` function and `0041`
# does not. What stops it mattering is that it returns `trigger`, and PostgreSQL
# refuses to call a trigger function directly. `test_exact_acl_and_update_surface
# .py::test_every_function_public_can_execute_is_a_trigger_function` is the
# assertion that keeps that from being a coincidence.
QUEUE_ROUTINES = (
    "procrastinate_cancel_job_v1",
    "procrastinate_defer_jobs_v1",
    "procrastinate_defer_periodic_job_v2",
    "procrastinate_fetch_job_v2",
    "procrastinate_finish_job_v1",
    "procrastinate_notify_queue_abort_job_v1",
    "procrastinate_notify_queue_job_inserted_v1",
    "procrastinate_prune_stalled_workers_v1",
    "procrastinate_register_worker_v1",
    "procrastinate_retry_job_v1",
    "procrastinate_retry_job_v2",
    "procrastinate_trigger_abort_requested_events_procedure_v1",
    "procrastinate_trigger_function_scheduled_events_v1",
    "procrastinate_trigger_function_status_events_insert_v1",
    "procrastinate_trigger_function_status_events_update_v1",
    "procrastinate_unlink_periodic_defers_v1",
    "procrastinate_unregister_worker_v1",
    "procrastinate_update_heartbeat_v1",
)

# This repository's own functions that the app may call, each granted by the
# revision that created it and each `REVOKE`d from `PUBLIC` first where it is
# `SECURITY DEFINER`.
#
# `titlepipe_field_transition` (`0032`) is the only `SECURITY DEFINER` one here
# and is the whole reason the column grant on `fields` can be as narrow as it is:
# `state` is writable by nobody and moves only through this function, which runs
# as the owner and is still filtered by `tenant_isolation`, because `FORCE`
# removes the owner's exemption too.
#
# The other four are readers — `audit_chain_verify` (`0007`) re-walks the hash
# chain, `legal_hold_is_active` and `retention_is_disposable` and
# `retention_window` (`0005`/`0006`) are the ONE path through which disposal is
# allowed to decide.
APP_ROUTINES = (
    "audit_chain_verify",
    # `0100`. Granted so a caller can resolve a seat BEFORE attempting the write
    # whose audit row would otherwise refuse it; `audit_log_bind_actor` calls it
    # from a trigger and needs no grant of its own to do so.
    "resolve_actor",
    "legal_hold_is_active",
    "retention_is_disposable",
    "retention_window",
    "titlepipe_field_transition",
)

# Every non-owner ACL entry the schema is allowed to hold, as
# `<objkind>:<object>:<verb>:<grantee>`. Owner entries are OMITTED from the
# comparison and asserted structurally instead — `acldefault` gives the owner
# everything, that is ownership rather than a grant, and pinning it would make
# this literal a transcription of PostgreSQL's defaults rather than of this
# system's decisions.
#
# 🔴 THIS IS THE ONLY CLOSED-WORLD ASSERTION ABOUT PRIVILEGE IN THIS REPOSITORY.
# It is a whole-catalog snapshot: relations, columns, schemas and routines in one
# set. Anything granted anywhere that is not on this list fails, INCLUDING on
# objects no test knows the name of.
EXACT_NON_OWNER_ACL = frozenset(
    {
        # `0002`: SELECT/INSERT/UPDATE to the app on the six tenant tables and
        # the registry, minus UPDATE on the append-only `audit_log`.
        *(
            f"relation:{table}:{verb}:{APP_ROLE}"
            for table in APP_WRITABLE_TABLES
            for verb in ("SELECT", "INSERT", "UPDATE")
        ),
        # `0001`/`0050`/`0071` by trigger, and `fields` for its own reason. See
        # `APP_APPEND_SHAPED_TABLES`.
        *(
            f"relation:{table}:{verb}:{APP_ROLE}"
            for table in APP_APPEND_SHAPED_TABLES
            for verb in ("SELECT", "INSERT")
        ),
        # `0003` and `0005`: the rulebook and the statutory floor are read-only.
        *(f"relation:{table}:SELECT:{APP_ROLE}" for table in APP_READ_ONLY_TABLES),
        # `0032`: the seventeen columns that replaced the table-wide UPDATE on
        # `fields`. THESE ARE THE ONLY COLUMN-LEVEL ENTRIES IN THIS CONTRACT and
        # the only ones there should ever be — a column grant is invisible to
        # `relacl` and to `has_table_privilege`, so anything not written here is a
        # privilege no other assertion in this repository can see.
        *(f"column:fields.{column}:UPDATE:{APP_ROLE}" for column in FIELDS_UPDATABLE_COLUMNS),
        # `0060`: the queue, granted by hand because the vendored DDL ships no
        # GRANTs. The worker's DELETE is the only DELETE anywhere in this schema.
        *(
            f"relation:{table}:{verb}:{WORKER_ROLE}"
            for table in QUEUE_WORKER_FULL_TABLES
            for verb in QUEUE_WORKER_VERBS
        ),
        *(
            f"relation:{QUEUE_EVENTS_TABLE}:{verb}:{WORKER_ROLE}"
            for verb in QUEUE_EVENTS_WORKER_VERBS
        ),
        # What "enqueue a job" costs the app. `INSERT ... RETURNING id` is a read,
        # which is why SELECT is on `procrastinate_jobs` — and it is also what
        # lets that role read every tenant's job arguments. `0060`'s docstring
        # states the residual; this line is where it is priced.
        f"relation:procrastinate_jobs:SELECT:{APP_ROLE}",
        f"relation:procrastinate_jobs:INSERT:{APP_ROLE}",
        f"relation:{QUEUE_EVENTS_TABLE}:INSERT:{APP_ROLE}",
        *(
            f"relation:{sequence}:USAGE:{role}"
            for sequence, roles in QUEUE_SEQUENCE_GRANTS
            for role in roles
        ),
        # `0060`'s EXECUTE grants, plus the `PUBLIC` entry PostgreSQL's own
        # `acldefault` writes out alongside them. See `QUEUE_ROUTINES` for why
        # `PUBLIC` is inert on these eighteen and what it is NOT inert about.
        *(
            f"routine:{routine}:EXECUTE:{role}"
            for routine in QUEUE_ROUTINES
            for role in (PUBLIC_ROLE, WORKER_ROLE, APP_ROLE)
        ),
        # This repository's own functions, granted by the revision that made each.
        *(f"routine:{routine}:EXECUTE:{APP_ROLE}" for routine in APP_ROUTINES),
        # `0070`: the golden set is writable, and `UPDATE` is what a correction
        # needs. The grant is not what makes it narrow — `0072`'s trigger refuses
        # any UPDATE that no `golden_corrections` row signs, whatever the ACL
        # says. NO `DELETE`: ground truth is not removed by the application, and
        # `0070`'s docstring records that this is an ACL rather than a trigger
        # and why (retention belongs to another card).
        # `0071`: the correction ledger is append-only, so it gets `audit_log`'s
        # treatment exactly — SELECT and INSERT, and no UPDATE. Granting UPDATE
        # would change no behaviour, because the triggers refuse it whatever the
        # ACL says, and would MISSTATE THE INTENT on the one table this system
        # promises never to edit in place.
        # `roles.sql` (~line 284): `GRANT USAGE ON SCHEMA public TO
        # titlepipe_owner, titlepipe_app, titlepipe_worker`. The owner's entry is
        # dropped by the owner filter; the other two are here. THE WORKER HOLDS
        # SCHEMA USAGE AND NO OBJECT PRIVILEGE AT ALL — that is `roles.sql`'s
        # decision and it is inert on its own (USAGE without a table grant
        # reaches nothing). `titlepipe_migration` is deliberately ABSENT: it
        # holds USAGE through `PUBLIC` below, and `roles.sql` does not name it.
        f"schema:public:USAGE:{APP_ROLE}",
        f"schema:public:USAGE:{WORKER_ROLE}",
        # PostgreSQL 15+ SHIPPED STATE for schema `public`, not anything this
        # repository wrote: the schema is owned by the `pg_database_owner`
        # pseudo-role and `PUBLIC` retains USAGE (only CREATE was revoked from
        # PUBLIC upstream in 15). `roles.sql` §"OBJECT-LEVEL GRANTS ARE NOT
        # CONVERGED" (~line 198) states that it does not converge these.
        #
        # 🔴 `schema:public:USAGE:PUBLIC` IS A REAL EXPOSURE THAT THIS LINE
        # ACCEPTS, and it is accepted because it grants reachability and not
        # readability: every table ACL asserted above names `titlepipe_app`
        # explicitly, so schema USAGE by PUBLIC opens no row. If a revision ever
        # grants a table verb to PUBLIC, the `relation:` entries fail, not this
        # one.
        "schema:public:USAGE:PUBLIC",
        "schema:public:USAGE:pg_database_owner",
        "schema:public:CREATE:pg_database_owner",
    }
)

# Relations, columns, the schema itself and routines, in one result set. The
# `coalesce(..., acldefault(...))` on relations and the schema is load-bearing:
# a NULL `relacl` means "the owner's default ACL", NOT "no privileges", so
# reading `relacl` alone would silently skip every object nobody has granted on
# — which is most of them, and which is where an owner-only object hides.
CATALOG_ACL_QUERY = """
    SELECT 'relation', c.relname, x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) AS x
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'S', 'v', 'm', 'p')
    UNION ALL
    SELECT 'column', c.relname || '.' || a.attname, x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           aclexplode(a.attacl) AS x
     WHERE n.nspname = 'public' AND a.attacl IS NOT NULL AND NOT a.attisdropped
    UNION ALL
    SELECT 'schema', n.nspname, x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END
      FROM pg_namespace n,
           aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) AS x
     WHERE n.nspname = 'public'
    UNION ALL
    SELECT 'routine', p.proname, x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace,
           aclexplode(p.proacl) AS x
     WHERE n.nspname = 'public' AND p.proacl IS NOT NULL
"""

COLUMN_ACL_QUERY = """
    SELECT c.relname, a.attname, x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace,
           aclexplode(a.attacl) AS x
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND a.attacl IS NOT NULL AND NOT a.attisdropped
"""

DEFAULT_ACL_QUERY = """
    SELECT coalesce(n.nspname, '<all schemas>'), d.defaclobjtype,
           x.privilege_type,
           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                ELSE x.grantee::regrole::text END,
           d.defaclrole::regrole::text
      FROM pg_default_acl d
      LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace,
           aclexplode(d.defaclacl) AS x
"""

# 🔴 CONNECT-TIME STATE, WHICH NO ACL CAN EXPRESS AND NO PRIVILEGE ASSERTION CAN
# SEE. `pg_db_role_setting` is applied as a connection is established and is
# never consulted again, so it is invisible to every grant, policy and trigger
# assertion in this tree.
#
# `test_roles.py::_role_settings` already reads this catalog, and it
# `JOIN pg_roles r ON r.oid = s.setrole` — which drops the `setrole = 0` rows
# `ALTER DATABASE d SET ...` writes, because those apply to ALL ROLES rather than
# to a named one. MEASURED 2026-09-02 against postgres:18.4, on a throwaway
# database, both settings planted by the cluster superuser and then torn down:
#
#     ALTER ROLE titlepipe_app IN DATABASE d SET role = titlepipe_owner;
#       connect with the app DSN -> current_user  = titlepipe_owner
#                                   session_user  = titlepipe_app
#     ALTER DATABASE d SET app.current_tenant = '8888…';
#       connect with the app DSN -> current_setting('app.current_tenant') = '8888…'
#       set_config(…, false) then RESET      -> back to '8888…', NOT the sentinel
#
# The first is a silent identity swap into the role that owns every table and can
# `DROP POLICY`; `SET ROLE` needs a membership edge, and this needs none at use
# time. The second is a valid tenant established before any application code
# runs — and `engine.py`'s `RESET` defence RESTORES it rather than clearing it,
# because `RESET` means "the value this connection started at" and that value IS
# the planted default. `make_engine`'s `connect_args` DOES override it (libpq
# `options` is applied after the per-role/per-database defaults, MEASURED: the
# sentinel wins and the subsequent `RESET` returns to `''`), so the deny floor
# holds for connections `make_engine` and `migrations/env.py` open — and for
# nothing else, and not at all against `SET role`, which no `connect_args` in
# this tree pins.
#
# ZERO ROWS, in both scopes and for all roles including `setrole = 0`, for the
# same reason `test_no_titlepipe_role_carries_a_per_role_setting_default` gives:
# nothing in this repository writes one, so any row is something a person or a
# provider put there, and a denylist of dangerous GUCs would be a list
# PostgreSQL grows every release.
#
# SCOPED TO THIS DATABASE AND TO `titlepipe\\_%` ROLES, deliberately. The cluster
# may legitimately carry provider settings on `postgres` or on databases this
# system does not own; what this contract can speak for is the database it is
# pointed at plus the roles this repository creates.
CONNECT_TIME_STATE_QUERY = """
    SELECT coalesce(d.datname, '<cluster>'),
           CASE WHEN s.setrole = 0 THEN '<all roles>'
                ELSE s.setrole::regrole::text END,
           entry
      FROM pg_db_role_setting s
      LEFT JOIN pg_database d ON d.oid = s.setdatabase
      CROSS JOIN LATERAL unnest(s.setconfig) AS entry
     WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
        OR s.setrole IN (SELECT oid FROM pg_roles WHERE rolname LIKE 'titlepipe\\_%')
"""


# The rendered form of `0032`'s seventeen, so the test and the harness step
# compare the same strings. `sorted()` at use so the literal reads by column
# rather than alphabetically, which is how `FIELD_APP_UPDATABLE_COLUMNS` reads.
EXPECTED_COLUMN_GRANTS = frozenset(
    f"UPDATE on fields.{column} to {APP_ROLE}" for column in FIELDS_UPDATABLE_COLUMNS
)


def column_grant_divergence(
    rows: Sequence[tuple[str, str, str, str]],
) -> tuple[list[str], list[str]]:
    """`(unexpected, missing)` for `COLUMN_ACL_QUERY`'s rows.

    🔴 THIS RETURNED "EVERY ROW IS UNEXPECTED" UNTIL 2026-09-05, because the
    contract was TABLE-LEVEL GRANTS ONLY and the expected value was the empty set.
    `0032` changed that deliberately: it revoked the table-wide `UPDATE ON fields`
    and granted seventeen columns, which is a NARROWING — `state`, `tenant_id`,
    `order_id` and `path` stopped being writable by the app.

    The expectation is now those seventeen and nothing else, which keeps the
    property the empty set was standing in for: a column grant is invisible to
    `relacl` and reported FALSE by `has_table_privilege`, so any column grant not
    written down here is a privilege no other assertion in this repository can
    see. `GRANT UPDATE (tenant_id) ON pages TO titlepipe_blind` — the shape the
    test's docstring is about — still fails, and now fails naming itself rather
    than being one of eighteen lines.
    """
    observed = {f"{row[2]} on {row[0]}.{row[1]} to {row[3]}" for row in rows}
    return sorted(observed - EXPECTED_COLUMN_GRANTS), sorted(EXPECTED_COLUMN_GRANTS - observed)


def acl_divergence(rows: Sequence[tuple[str, str, str, str]]) -> tuple[list[str], list[str]]:
    """`(unexpected, missing)` for `CATALOG_ACL_QUERY`'s rows.

    Owner entries are dropped here rather than in SQL, so the same filter serves
    both callers and a change to it cannot apply to one and not the other.
    """
    observed = {f"{row[0]}:{row[1]}:{row[2]}:{row[3]}" for row in rows if str(row[3]) != OWNER_ROLE}
    return sorted(observed - EXACT_NON_OWNER_ACL), sorted(EXACT_NON_OWNER_ACL - observed)


def connect_time_state(rows: Sequence[tuple[str, str, str]]) -> list[str]:
    """`CONNECT_TIME_STATE_QUERY`'s rows, rendered. The contract is `[]`."""
    return sorted(f"{row[1]} in {row[0]} -> {row[2]}" for row in rows)


def _check(dsn: str) -> int:
    """Run all three catalog assertions against `dsn`. Returns a process exit code.

    NOTHING HERE WRITES. That is what makes it safe to point at the harness's
    database, which the Playwright suite is about to use — `conftest.py`'s
    fixtures cannot be reused for this precisely because their teardown drops
    eight tables, and pointing THOSE at the harness DSN would destroy the schema
    the browser job depends on.
    """
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            catalog = connection.execute(text(CATALOG_ACL_QUERY)).all()
            columns = connection.execute(text(COLUMN_ACL_QUERY)).all()
            defaults = connection.execute(text(DEFAULT_ACL_QUERY)).all()
            connect_state = connection.execute(text(CONNECT_TIME_STATE_QUERY)).all()
    finally:
        engine.dispose()

    failures: list[str] = []

    planted_state = connect_time_state(
        [(str(row[0]), str(row[1]), str(row[2])) for row in connect_state]
    )
    if planted_state:
        failures.append(
            "per-role or per-database settings exist. They are applied AT "
            "CONNECT and checked nowhere; `SET role` is a silent identity swap "
            "and `app.current_tenant` is a tenant established before any "
            "application code runs:\n  " + "\n  ".join(planted_state)
        )

    unexpected_columns, missing_columns = column_grant_divergence(
        [(str(row[0]), str(row[1]), str(row[2]), str(row[3])) for row in columns]
    )
    if unexpected_columns:
        failures.append(
            "column-level grants exist that this contract does not name. Nothing "
            "else in this repository reads pg_attribute.attacl — relacl is "
            "unchanged by them and has_table_privilege reports FALSE for a role "
            "holding one:\n  " + "\n  ".join(unexpected_columns)
        )
    if missing_columns:
        failures.append(
            "0032's narrowed UPDATE grant on fields is incomplete, so the app "
            "takes 42501 on a correction from a line in no handler:\n  "
            + "\n  ".join(missing_columns)
        )

    default_grants = sorted(
        f"{row[2]} on future {row[1]!r} in {row[0]} to {row[3]} (by {row[4]})" for row in defaults
    )
    if default_grants:
        failures.append(
            "default privileges exist, so objects created by revisions that are "
            "not written yet will carry grants no test asserts:\n  " + "\n  ".join(default_grants)
        )

    unexpected, missing = acl_divergence(
        [(str(row[0]), str(row[1]), str(row[2]), str(row[3])) for row in catalog]
    )
    if unexpected:
        failures.append(
            "privileges exist that no revision line in this repository is "
            "pointed at:\n  " + "\n  ".join(unexpected)
        )
    if missing:
        failures.append(
            "privileges the contract requires are absent — the app will take "
            "42501 on these:\n  " + "\n  ".join(missing)
        )

    if failures:
        # `::error::` so the divergence lands as a GitHub annotation rather than
        # only in a log somebody has to open. `sys.stderr.write` rather than
        # `print` because T201 bans `print` outside `scripts/**` and this file is
        # a test-tree module that happens to have a `__main__`; adding a
        # per-file ignore to `ruff.toml` to buy syntactic sugar would be the
        # wrong trade.
        for failure in failures:
            sys.stderr.write(f"::error::{failure}\n")
        return 1

    sys.stdout.write(
        f"ACL converges to the contract: {len(EXACT_NON_OWNER_ACL)} non-owner entries, exactly.\n"
    )
    return 0


def main(argv: Sequence[str]) -> int:
    if len(argv) != 2:
        name = argv[0] if argv else "acl_contract.py"
        sys.stderr.write(f"usage: {name} <dsn>\n")
        return 2
    return _check(argv[1])


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

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

# The tenant-keyed tables `0002` grants the app SELECT/INSERT/UPDATE on.
APP_WRITABLE_TABLES = (
    "orders",
    "packages",
    "pages",
    "fields",
    "field_readings",
    "tenants",
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
        f"relation:audit_log:SELECT:{APP_ROLE}",
        f"relation:audit_log:INSERT:{APP_ROLE}",
        # `0003`: the rulebook is read-only to the app.
        f"relation:rules:SELECT:{APP_ROLE}",
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

    column_grants = sorted(f"{row[2]} on {row[0]}.{row[1]} to {row[3]}" for row in columns)
    if column_grants:
        failures.append("column-level grants exist:\n  " + "\n  ".join(column_grants))

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

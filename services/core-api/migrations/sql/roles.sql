-- TitlePipe's five PostgreSQL roles. Idempotent AND CONVERGENT: correct to run
-- against a cluster that has none of them, some of them, or all of them with
-- the wrong attributes, the wrong passwords or the wrong memberships.
--
--     psql -v ON_ERROR_STOP=1 -f migrations/sql/roles.sql
--
-- CLIENT AND SERVER FLOORS, both enforced by the first statement below rather
-- than left to fail obscurely:
--
--   * psql 15+ — `\getenv` does not exist before it. On psql 14 the script dies
--     at the first `\getenv` with exit 3, before any DDL, which is SAFE but
--     gives no clue why;
--   * PostgreSQL 16+ — `GRANT ... WITH INHERIT/SET` is 16 syntax, and the
--     `INHERIT FALSE` on the membership at the bottom is load-bearing rather
--     than cosmetic. On 15 the script would create every role and THEN fail on
--     the grant, leaving a half-configured cluster.
--
-- Roles are CLUSTER-wide; the `GRANT ... ON SCHEMA public` at the bottom is
-- DATABASE-scoped, so this file must be run once per database that TitlePipe
-- owns tables in. `titlepipe_blind` belongs to blind-svc, which is intended to
-- live in a SEPARATE database; creating that database is not this file's job.
--
--
-- WHY THE OWNER CANNOT LOG IN
-- ---------------------------
-- `titlepipe_owner` owns every table and is `NOLOGIN`. That is the whole point
-- of having a fifth role: **a table's owner bypasses row-level security on it
-- unless the table is declared `FORCE ROW LEVEL SECURITY`**. If the role
-- core-api connects as also owned the tables, every RLS policy in Task 4 would
-- be advisory for the one connection that matters. Ownership therefore sits
-- with a role that nothing — no service, no human, no migration runner — can
-- open a connection as.
--
-- That guarantee has two halves and BOTH are converged below, because either
-- one alone is worthless:
--
--   * the owner cannot authenticate — `NOLOGIN`, and `PASSWORD NULL` so that no
--     stale verifier survives in `pg_authid` waiting for a future `ALTER ROLE
--     ... LOGIN` to reactivate it;
--   * nothing else can BECOME the owner — the membership set is converged to
--     exactly `{titlepipe_migration}`. A single `GRANT titlepipe_owner TO
--     titlepipe_app` by hand would otherwise let the application role
--     `SET ROLE titlepipe_owner` and create or read tables as the owner, which
--     is the same bypass by a different door. MEASURED 2026-08-05: before this
--     file converged membership, that stray grant survived a rerun that
--     reported success.
--
--
-- 🔴 HAND-OFF TO TASK 3 (Alembic). READ THIS BEFORE WRITING `migrations/env.py`.
-- -----------------------------------------------------------------------------
-- Alembic does not exist yet; Task 3 initialises it. When it does, `env.py`
-- MUST issue
--
--     SET ROLE titlepipe_owner;
--
-- on the connection immediately after connecting and BEFORE
-- `context.begin_transaction()`.
--
-- THE DATABASE NOW ENFORCES THIS RATHER THAN ASKING FOR IT. The membership at
-- the bottom is granted `WITH INHERIT FALSE, SET TRUE`, so `titlepipe_migration`
-- holds NONE of the owner's privileges until it says `SET ROLE`. An `env.py`
-- that forgets gets `permission denied for schema public` on the very first
-- `CREATE TABLE`, including Alembic's own `alembic_version`.
--
-- That is the change worth understanding, because the alternative was a silent
-- wrong answer. `CREATE TABLE` records the CURRENT role as the owner, not a
-- role the current role merely inherits privileges from. Under the default
-- `INHERIT` this membership was enough to create a table WITHOUT `SET ROLE` —
-- and that table came out owned by `titlepipe_migration`, a LOGIN role, which
-- is exactly the RLS bypass the split above exists to prevent. MEASURED
-- 2026-08-05 before the change: the migration succeeded, the catalog was wrong,
-- and nothing complained.
--
-- THREE MORE THINGS TASK 3 WILL HIT. All measured 2026-08-05 against 18.4:
--
--   1. `SET ROLE` must be CONNECTION-scoped and must never be `SET LOCAL` or
--      followed by `RESET ROLE`. After `RESET ROLE`, `titlepipe_migration`
--      reading its own migration state fails with **`permission denied for
--      table alembic_version`** — a TABLE error, not the schema error above,
--      because the table exists by then and belongs to someone else. `alembic
--      current`, `stamp` and `downgrade` all read that table;
--   2. `CREATE SCHEMA` as `titlepipe_owner` fails with **`permission denied for
--      database <db>`**. The owner has `CREATE ON SCHEMA public` (granted at the
--      bottom) but no `CREATE ON DATABASE`, so a first migration that creates a
--      non-`public` schema breaks. If Task 3 wants one, the grant belongs here
--      and gets its own test;
--   3. this file is not Alembic's to run. It creates the role Alembic
--      authenticates as, so it must have been applied before `alembic upgrade`
--      is called at all.
--
-- Proved in `tests/test_roles.py`:
-- `test_a_table_created_after_set_role_belongs_to_the_owner` is the path
-- `env.py` must take (and asserts `alembic_version` by name, because Task 3
-- depends on it), `test_a_table_created_without_set_role_is_refused_outright` is
-- the refusal, and `test_only_the_migration_role_can_become_the_owner` is the
-- membership convergence. Task 3 must keep all three green.
--
--
-- WHAT IS *NOT* ISOLATED YET, STATED SO NOBODY READS SILENCE AS A GUARANTEE
-- ------------------------------------------------------------------------
-- `titlepipe_blind` is intended for a separate database, and NOTHING IN THIS
-- FILE ENFORCES THAT. MEASURED 2026-08-05: pointed at the core database it
-- connects, holds `CONNECT` and `USAGE ON SCHEMA public` from `PUBLIC`, and can
-- `CREATE TEMP TABLE`. It cannot read TitlePipe's tables — no table grant
-- exists — but "cannot read today because no grant has been written yet" is not
-- isolation. `REVOKE CONNECT`, the separate database, and every table grant are
-- Task 4's. This file creates the role and claims exactly that much.
--
--
-- WHY `GRANT CREATE ON SCHEMA public`
-- -----------------------------------
-- PostgreSQL 15 revoked `CREATE` on schema `public` from `PUBLIC`. Without the
-- grant at the bottom of this file, `CREATE TABLE` as `titlepipe_owner` fails
-- with `permission denied for schema public` — proved by
-- `test_the_owner_cannot_create_without_the_schema_grant`. `USAGE` is not
-- granted here: `PUBLIC` still holds it on a default database, and schema
-- privileges beyond the one that is load-bearing belong to Task 4.
--
--
-- WHY THIS IS A psql SCRIPT AND NOT PLAIN SQL
-- -------------------------------------------
-- Passwords come from the environment and are never literals in this file. The
-- server cannot read the client's environment, so the only mechanism that can
-- do this is psql's `\getenv`. MEASURED 2026-08-05 against psql 18.4:
--
--   * `\getenv` leaves the psql variable UNDEFINED when the variable is unset,
--     which `\if :{?name}` detects — but sets it to the empty string when the
--     variable is exported empty, which `\if` cannot tell from a real value.
--     Both are failures here, and so is whitespace-only, so presence is decided
--     by `length(btrim(...)) = 0` in SQL and the `\if` below only normalises
--     undefined to empty;
--   * `:'name'` is interpolated as a quoted SQL literal only OUTSIDE quotes.
--     psql treats `$$ ... $$` as a quoted literal like any other and does NOT
--     substitute inside it, so a `DO $$ ... :'name' ... $$` guard is a syntax
--     error rather than a check. Every statement below therefore builds its DDL
--     with `format()` in an ordinary SELECT — where interpolation does happen —
--     and runs it with `\gexec`. `%L` and `%I` do the quoting, so a password
--     containing a quote, a backslash, a newline or a `%` cannot terminate or
--     reshape the statement. `test_a_password_full_of_quoting_hazards_survives`
--     is what holds that; nothing else in the suite would notice a regression to
--     string concatenation, because generated passwords are alphanumeric.

\set ON_ERROR_STOP on


-- The floors, before anything else touches the cluster. `:VERSION_NUM` is
-- psql's own version (set since psql 11); `server_version_num` is the backend's.
-- A run that cannot satisfy both must fail having changed nothing.
SELECT format(
           'DO $floor$ BEGIN RAISE EXCEPTION %L; END $floor$',
           format(
               'roles.sql: needs psql 15+ (for the getenv meta-command) and '
               'PostgreSQL 16+ (for GRANT ... WITH INHERIT/SET); '
               'this is psql %s against server %s',
               :VERSION_NUM,
               current_setting('server_version_num')
           )
       )
WHERE :VERSION_NUM < 150000 OR current_setting('server_version_num')::int < 160000
\gexec


-- Keep the passwords out of the server log, for this session only.
--
-- This is not theoretical, and an earlier version of this file argued it away.
-- MEASURED 2026-08-05 with `log_statement = 'all'`: each password reached the
-- log three times — once in the presence-check SELECT, once in `CREATE ROLE`
-- and once in `ALTER ROLE`. The first of those runs BEFORE any role is touched,
-- so even a run that refused for a missing variable leaked the ones that were
-- supplied. Two `SET`s remove all of it, and "a cluster with statement logging
-- on is already a credential store" was an argument for doing nothing about a
-- problem with a two-line fix.
--
-- `log_statement` and `log_min_duration_statement` are SUSET, so this is
-- conditional on being a superuser rather than fatal: a `CREATEROLE` operator
-- can still run this file and is told plainly what could not be done.
-- `pg_stat_statements.track` is included because that extension normalises
-- constants but records utility statements verbatim; MEASURED, setting it is
-- harmless when the extension is not loaded — PostgreSQL accepts a dotted name
-- it does not recognise as a placeholder GUC.
SELECT suppress.statement
FROM (
    VALUES
        ('SET log_statement = ''none'''),
        ('SET log_min_duration_statement = -1'),
        ('SET pg_stat_statements.track = ''none''')
) AS suppress (statement)
WHERE (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
\gexec

SELECT format(
           'DO $warn$ BEGIN RAISE WARNING %L; END $warn$',
           'roles.sql: not a superuser, so statement logging could not be '
           'suppressed; if this cluster logs statements, the passwords below '
           'are in its log'
       )
WHERE NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
\gexec


\getenv migration_password TITLEPIPE_MIGRATION_PASSWORD
\if :{?migration_password}
\else
\set migration_password ''
\endif

\getenv app_password TITLEPIPE_APP_PASSWORD
\if :{?app_password}
\else
\set app_password ''
\endif

\getenv worker_password TITLEPIPE_WORKER_PASSWORD
\if :{?worker_password}
\else
\set worker_password ''
\endif

\getenv blind_password TITLEPIPE_BLIND_PASSWORD
\if :{?blind_password}
\else
\set blind_password ''
\endif


-- Refuse, naming every variable that is missing rather than the first one, so
-- an operator setting these up learns the whole list in one run.
--
-- `btrim` rather than a bare `length`: `TITLEPIPE_APP_PASSWORD='   '` is a typo,
-- not a credential, and MEASURED 2026-08-05 it used to produce five roles and
-- exit 0.
--
-- `HAVING count(*) > 0` is what makes this a no-op when nothing is missing: the
-- `WHERE` filters every row away, the aggregate row is discarded, `\gexec` gets
-- no rows and executes nothing. Without it the aggregate would still produce
-- one row, with a NULL message, and every run would raise.
SELECT format(
           'DO $missing$ BEGIN RAISE EXCEPTION %L; END $missing$',
           'roles.sql: refusing to run — password environment variable(s) unset, '
           'empty or whitespace-only: '
           || string_agg(required.variable, ', ' ORDER BY required.variable)
       )
FROM (
    VALUES
        ('TITLEPIPE_MIGRATION_PASSWORD', :'migration_password'),
        ('TITLEPIPE_APP_PASSWORD', :'app_password'),
        ('TITLEPIPE_WORKER_PASSWORD', :'worker_password'),
        ('TITLEPIPE_BLIND_PASSWORD', :'blind_password')
) AS required (variable, value)
WHERE length(btrim(required.value)) = 0
HAVING count(*) > 0
\gexec


-- The owner. No password variable exists for it and none is needed: NOLOGIN
-- means no authentication ever happens.
SELECT 'CREATE ROLE titlepipe_owner NOLOGIN'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'titlepipe_owner'
)
\gexec

-- Converged on every run, not only on creation.
--
-- `PASSWORD NULL` is not redundant beside `NOLOGIN`. MEASURED 2026-08-05: an
-- `ALTER ROLE titlepipe_owner LOGIN BYPASSRLS PASSWORD '...'` by hand left
-- `pg_authid.rolpassword` populated, and a rerun repaired `rolcanlogin` and
-- `rolbypassrls` while leaving the verifier in place — a live credential for the
-- RLS-bypassing role, one future `ALTER ROLE ... LOGIN` away from working.
--
-- `VALID UNTIL 'infinity' CONNECTION LIMIT -1` are here for the opposite
-- failure: both survived a rerun, so a cluster where somebody set
-- `VALID UNTIL '2020-01-01'` or `CONNECTION LIMIT 0` converged to "correct
-- attributes, cannot connect" and this file reported success.
ALTER ROLE titlepipe_owner
    NOSUPERUSER NOBYPASSRLS NOLOGIN NOCREATEDB NOCREATEROLE NOREPLICATION
    PASSWORD NULL VALID UNTIL 'infinity' CONNECTION LIMIT -1;


-- The four LOGIN roles. `titlepipe_migration` runs Alembic; `titlepipe_app` is
-- core-api; `titlepipe_worker` is extraction and render; `titlepipe_blind` is
-- blind-svc, intended for its own database — see the isolation note above.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', wanted.role, wanted.password)
FROM (
    VALUES
        ('titlepipe_migration', :'migration_password'),
        ('titlepipe_app', :'app_password'),
        ('titlepipe_worker', :'worker_password'),
        ('titlepipe_blind', :'blind_password')
) AS wanted (role, password)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = wanted.role
)
\gexec

SELECT format(
           'ALTER ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE '
           'NOREPLICATION VALID UNTIL ''infinity'' CONNECTION LIMIT -1 PASSWORD %L',
           wanted.role,
           wanted.password
       )
FROM (
    VALUES
        ('titlepipe_migration', :'migration_password'),
        ('titlepipe_app', :'app_password'),
        ('titlepipe_worker', :'worker_password'),
        ('titlepipe_blind', :'blind_password')
) AS wanted (role, password)
\gexec


-- MEMBERSHIP CONVERGENCE. Every row is revoked, then the one row that should
-- exist is granted.
--
-- Nothing may become `titlepipe_owner` except `titlepipe_migration`, so the
-- member set is REBUILT rather than added to. A plain `GRANT` is not
-- convergence, and MEASURED 2026-08-05 there were two distinct ways past it:
--
--   * `GRANT titlepipe_owner TO titlepipe_app` by hand survived every rerun, and
--     `titlepipe_app` could then `SET ROLE titlepipe_owner` and create a table
--     owned by the owner. A LOGIN role able to become the owner is the bypass
--     this whole file exists to prevent;
--   * a second row from a DIFFERENT GRANTOR was not repaired either. Re-granting
--     updates the options of the row belonging to the SAME grantor only, so a
--     `dba` holding `ADMIN OPTION` issuing `GRANT titlepipe_owner TO
--     titlepipe_migration WITH INHERIT TRUE` left `inherit_option = true` on its
--     own row — and `titlepipe_migration` then created `alembic_version` owned
--     by ITSELF, through a script that exited 0. `INHERIT FALSE` on our row does
--     not help when another row grants inheritance.
--
-- `GRANTED BY` is what makes the revoke reach a row this session did not create;
-- a `REVOKE` without it leaves other grantors' rows in place even for a
-- superuser.
--
-- `CASCADE` is required rather than decorative. MEASURED 2026-08-05: revoking
-- the membership of a `dba` that had itself granted the role onward failed with
-- `2BP01: dependent privileges exist / HINT: Use CASCADE to revoke them too`,
-- and `ON_ERROR_STOP` turned the whole convergence into exit 3 — a refusal, so
-- not dangerous, but it left the cluster exactly as wrong as it found it. The
-- cascade only reaches memberships DERIVED from the one being revoked, which
-- here are by definition also memberships of `titlepipe_owner` this block was
-- going to revoke anyway. A row already removed by a cascade is then a WARNING
-- on its own `REVOKE`, not an error, so the generated list staying stale is
-- harmless.
SELECT format(
           'REVOKE %I FROM %I GRANTED BY %I CASCADE',
           owner.rolname,
           member.rolname,
           grantor.rolname
       )
FROM pg_catalog.pg_auth_members am
JOIN pg_catalog.pg_roles owner ON owner.oid = am.roleid
JOIN pg_catalog.pg_roles member ON member.oid = am.member
JOIN pg_catalog.pg_roles grantor ON grantor.oid = am.grantor
WHERE owner.rolname = 'titlepipe_owner'
\gexec

-- `INHERIT FALSE` is the load-bearing half and is not the default: with the
-- default `INHERIT`, `CREATE TABLE` without `SET ROLE` succeeds and produces a
-- table owned by a LOGIN role. `SET TRUE` is what keeps `SET ROLE
-- titlepipe_owner` available — `INHERIT FALSE, SET FALSE` would be a membership
-- that grants nothing and would break every migration. Both are PostgreSQL 16+
-- syntax, which the floor at the top of this file enforces.
GRANT titlepipe_owner TO titlepipe_migration WITH INHERIT FALSE, SET TRUE;


-- Database-scoped, and the reason nothing else in Task 2 can work without it.
-- See the header: PostgreSQL 15 took this away from `PUBLIC`.
GRANT CREATE ON SCHEMA public TO titlepipe_owner;

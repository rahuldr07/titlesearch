-- TitlePipe's five PostgreSQL roles. Idempotent AND CONVERGENT: correct to run
-- against a cluster that has none of them, some of them, or all of them with
-- the wrong attributes, the wrong passwords, the wrong memberships, the wrong
-- per-role GUC defaults or the wrong default privileges.
--
--     psql -v ON_ERROR_STOP=1 -f migrations/sql/roles.sql
--
-- ONE TRANSACTION. `BEGIN` is the second statement and `COMMIT` the last, so a
-- run that fails anywhere leaves the cluster exactly as it found it. Every
-- statement here — `CREATE ROLE`, `ALTER ROLE`, `GRANT`, `REVOKE`,
-- `ALTER DEFAULT PRIVILEGES` — is transactional in PostgreSQL, and `\gexec`
-- works inside a transaction block. TWO MEASUREMENTS, 2026-08-05 against
-- postgres:18.4, and they are two different runs rather than one run twice:
--
--   * the previous, NON-transactional version of this file, run by a
--     `CREATEROLE` operator, died at the owner's `ALTER ROLE` with `permission
--     denied to alter role` (see the ruling below) and left `titlepipe_owner`
--     created and nothing else — the half-configured cluster the floors at the
--     top exist to prevent, reached by a different door;
--   * this version, run by a `CREATEROLE` operator against a database it does
--     not own, refuses at the final schema-privilege check and leaves ZERO
--     `titlepipe\_%` roles behind. Counted: 0.
--
-- CLIENT AND SERVER FLOORS, both enforced by the first statement below rather
-- than left to fail obscurely:
--
--   * psql 15+ — `\getenv` does not exist before it. On psql 14 the script
--     WOULD die at the first `\getenv` with exit 3, before any DDL, which is
--     SAFE but gives no clue why; the version floor now catches it first and
--     says so. (This note used to read "dies", which stopped being true when
--     the floor was added.);
--   * PostgreSQL 16+ — `GRANT ... WITH INHERIT/SET` is 16 syntax, and the
--     `INHERIT FALSE` on the membership at the bottom is load-bearing rather
--     than cosmetic. On 15 the script would create every role and THEN fail on
--     the grant — which the transaction now makes harmless, but a refusal that
--     names the reason is still better than a rollback that does not;
--   * A POSIX SHELL, and this one is new. See "PRESENCE WITHOUT PLAINTEXT"
--     below: the four `\set ... \`case ...\`` probes are how this file decides a
--     password variable is present WITHOUT sending its value to the server.
--     Where psql cannot run `sh` — Windows `cmd.exe` is the realistic case —
--     the probes come back neither `PRESENT` nor `ABSENT` and the file REFUSES,
--     naming all four variables. That is deliberately fail-closed: the
--     alternative reading would be "present", and a run that got that wrong
--     would set an empty password on four roles.
--
-- Roles are CLUSTER-wide; the two `GRANT ... ON SCHEMA public` at the bottom are
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
--   * nothing else can REACH the owner. Not "nothing else is a member of the
--     owner" — that was the claim this file used to make, and it was true of
--     ONE EDGE and insufficient. MEASURED 2026-08-05 against postgres:18.4:
--
--         GRANT titlepipe_migration TO titlepipe_app;   -- one stray grant
--         <rerun this file>                             -- exit 0
--         edges: titlepipe_owner <- titlepipe_migration
--                titlepipe_migration <- titlepipe_app   -- SURVIVED
--         as titlepipe_app: SET ROLE titlepipe_migration; SET ROLE titlepipe_owner;
--         -> current_user = titlepipe_owner
--
--     The old `REVOKE` filtered `WHERE owner.rolname = 'titlepipe_owner'`, which
--     converges MEMBERS OF THE OWNER, not PATHS TO THE OWNER. Two hops reached
--     it. As the owner, `titlepipe_app` can `ALTER TABLE ... NO FORCE ROW LEVEL
--     SECURITY` and `DROP POLICY`, which defeats Task 4 before Task 4 is
--     written. The filter now matches EITHER SIDE of the edge — see the
--     membership block for the exact predicate and for the two exemptions it
--     has to carry.
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
-- 🔴 AND ONE FOR TASK 4. This file CONVERGES `pg_default_acl` for every
-- `titlepipe_*` role — see the default-privileges block. If Task 4 wants
-- `ALTER DEFAULT PRIVILEGES FOR ROLE titlepipe_owner ... GRANT ... TO
-- titlepipe_app`, that statement belongs IN THIS FILE. Put it in a migration
-- and the next run of this file silently removes it.
--
-- Proved in `tests/test_roles.py`:
-- `test_a_table_created_after_set_role_belongs_to_the_owner` is the path
-- `env.py` must take (and asserts `alembic_version` by name, because Task 3
-- depends on it), `test_a_table_created_without_set_role_is_refused_outright` is
-- the refusal, and `test_only_the_migration_role_can_become_the_owner` is the
-- membership convergence. Task 3 must keep all three green.
--
--
-- WHAT IS *NOT* CONVERGED, STATED SO NOBODY READS SILENCE AS A GUARANTEE
-- ---------------------------------------------------------------------
-- `titlepipe_blind` is intended for a separate database, and NOTHING IN THIS
-- FILE ENFORCES THAT. MEASURED 2026-08-05: pointed at the core database it
-- connects, holds `CONNECT` and `USAGE ON SCHEMA public` from `PUBLIC`, and can
-- `CREATE TEMP TABLE`. `REVOKE CONNECT` and the separate database are Task 4's.
--
-- **OBJECT-LEVEL GRANTS ARE NOT CONVERGED.** An earlier version of this header
-- said `titlepipe_blind` "cannot read TitlePipe's tables — no table grant
-- exists". That was a statement about a cluster with no tables in it, dressed up
-- as a guarantee. MEASURED 2026-08-05: `GRANT SELECT ON <table> TO
-- titlepipe_blind` survives every rerun of this file, and always will —
-- CONVERGING table, sequence and schema grants would mean this file DELETING the
-- grants Task 4's migrations are going to write, on every rerun. Task 4 owns
-- object-level grants; this file owns roles, memberships, per-role settings and
-- default privileges, and claims exactly that much.
--
-- `pg_default_acl` is the exception, and the reason it is worth the asymmetry is
-- that it is the only one of these that reaches objects THAT DO NOT EXIST YET.
-- MEASURED 2026-08-05: a single
-- `ALTER DEFAULT PRIVILEGES FOR ROLE titlepipe_owner IN SCHEMA public GRANT ALL
-- ON TABLES TO titlepipe_blind` survived a rerun that exited 0 and would have
-- granted full access to every table Task 4 and every later migration creates,
-- silently, with no grant visible on any table anybody would think to inspect.
--
--
-- WHY `GRANT CREATE ON SCHEMA public`
-- -----------------------------------
-- PostgreSQL 15 revoked `CREATE` on schema `public` from `PUBLIC`. Without the
-- grant at the bottom of this file, `CREATE TABLE` as `titlepipe_owner` fails
-- with `permission denied for schema public` — proved by
-- `test_the_owner_cannot_create_without_the_schema_grant`.
--
--
-- WHY `GRANT USAGE ON SCHEMA public` IS HERE, AND WHICH THREE ROLES IT NAMES
-- ---------------------------------------------------------------------------
-- This file used to say `USAGE` was NOT granted here because "`PUBLIC` still
-- holds it on a default database". That was a statement about a default
-- database dressed up as a decision, and it made the `GRANT CREATE` above
-- conditional on a privilege nobody in this system owns. MEASURED 2026-08-06
-- against postgres:18.4, in the database of a `LOGIN CREATEROLE` operator,
-- after `REVOKE USAGE ON SCHEMA public FROM PUBLIC`:
--
--     has_schema_privilege('titlepipe_owner','public','CREATE') -> t
--     has_schema_privilege('titlepipe_owner','public','USAGE')  -> f
--     SET ROLE titlepipe_owner; CREATE TABLE hardened_probe (id int);
--     -> ERROR:  no schema has been selected to create in
--
-- `CREATE` without `USAGE` is inert, and the error does not name a privilege.
-- So the owner's `USAGE` is part of THIS file's contract, not Task 4's.
--
-- 🔴 IT CANNOT BE GRANTED FROM A MIGRATION, and that is the whole reason it
-- moved. Schema `public` belongs to `pg_database_owner` from PostgreSQL 15 on.
-- `titlepipe_owner` is not the database owner and holds NO GRANT OPTION on the
-- schema, so a `GRANT` it issues is a WARNING and a no-op. MEASURED in the same
-- session, as `titlepipe_owner`:
--
--     GRANT USAGE ON SCHEMA public TO titlepipe_app;
--     WARNING:  no privileges were granted for "public"
--     GRANT
--     -- nspacl unchanged
--
-- This file runs as the OPERATOR, which can. MEASURED, as a `LOGIN CREATEROLE`
-- role owning the database — the shape RDS, Cloud SQL, Neon and Supabase hand
-- you, and the same shape the ruling below is written for:
--
--     GRANT USAGE ON SCHEMA public TO titlepipe_owner, titlepipe_app,
--                                     titlepipe_worker;
--     GRANT                            -- no warning
--     nspacl -> …,titlepipe_owner=UC/pg_database_owner,
--               titlepipe_app=U/pg_database_owner,
--               titlepipe_worker=U/pg_database_owner
--
-- So the operator needs no `rolsuper` gate here, exactly as it needs none for
-- `GRANT CREATE`. The statement is unconditional and the read-back is what
-- catches an operator that could not, in fact, grant it.
--
-- WHO IS NAMED, AND WHO IS NOT:
--
--   * `titlepipe_owner` — yes, for the measurement above;
--   * 🔴 `titlepipe_app` and `titlepipe_worker` — YES, ADDED 2026-08-06. This
--     used to read "NOT YET, AND THIS IS A KNOWN OPEN HOLE". `0002` issues the
--     same grant and CANNOT LAND IT: `migrations/env.py` runs every migration
--     statement as `titlepipe_owner`, which is the role the measurement above
--     shows holds no grant option on the schema. `0002` therefore carries a
--     read-back of its own, `_require_schema_usage`, which raises on a hardened
--     cluster. That guard is correct and STAYS — it is what catches an operator
--     that could not grant. Naming the two roles here is what stops it firing.
--
--     MEASURED 2026-08-06 against postgres:18.4, one throwaway container per
--     run, hardened before anything else touched it, operator `rolsuper = f`:
--
--         REVOKE USAGE ON SCHEMA public FROM PUBLIC;
--         nspacl -> {pg_database_owner=UC/pg_database_owner}
--
--       BEFORE, with only `titlepipe_owner` named in the statement below:
--         roles.sql                -> exit 0
--         nspacl                   -> ...,titlepipe_owner=UC/pg_database_owner
--         alembic upgrade head     -> 0001 ok, then RuntimeError out of 0002:
--                                     "could not give titlepipe_app,
--                                      titlepipe_worker USAGE on schema public"
--         as titlepipe_app: SELECT count(*) FROM orders;
--         -> ERROR:  42P01: relation "orders" does not exist
--
--       AFTER, with all three named:
--         roles.sql                -> exit 0
--         nspacl                   -> ...,titlepipe_owner=UC/pg_database_owner,
--                                       titlepipe_app=U/pg_database_owner,
--                                       titlepipe_worker=U/pg_database_owner
--         alembic upgrade head     -> exit 0, 0001 then 0002
--         as titlepipe_app: SELECT count(*) FROM orders;   -> 0, no error
--
--     THE MOVE WAS BLOCKED UNTIL 2026-08-06 BY A TEST THAT ENCODED THE DEFECT.
--     `tests/test_forced_rls_and_grants.py::test_the_migration_refuses_when_the
--     _schema_grant_did_not_land` built its hardened state by revoking `USAGE`
--     from `PUBLIC` ONLY. `titlepipe_app` and `titlepipe_worker` reached `USAGE`
--     through `PUBLIC` and nowhere else, so that was enough to strip them —
--     until this file granted them the privilege explicitly, at which point
--     their own ACL entries survived the revoke, `_require_schema_usage` found
--     nothing missing, and the test failed with `Failed: DID NOT RAISE
--     RuntimeError`. It now revokes from `PUBLIC` AND from every role this file
--     creates, and restores the grantee set it snapshotted from
--     `pg_namespace.nspacl`, so its hardened state no longer depends on what
--     this file granted;
--   * `titlepipe_migration` — NO. `migrations/env.py` issues `SET ROLE
--     titlepipe_owner` as its first statement on the connection and never
--     resets it, so every migration statement runs as the owner and uses the
--     owner's `USAGE`. Granting it directly would give a LOGIN role standing
--     access to the schema it is deliberately kept out of until it says
--     `SET ROLE`. `test_the_owner_can_use_schema_public_when_public_cannot`
--     asserts it does NOT have it, on a cluster where `PUBLIC` does not either;
--   * `titlepipe_blind` — NO. It belongs to blind-svc, which is intended to
--     live in a SEPARATE database; see the isolation note above.
--
--
-- 🔴 RUNNING THIS AS A NON-SUPERUSER. THE RULING, AND WHAT IT COSTS.
-- ------------------------------------------------------------------
-- Plan 01's global contract: *"Portable: only `CREATE ROLE` and `FORCE ROW LEVEL
-- SECURITY` are assumed. No provider-specific SQL — deployment is undecided."*
-- The previous version of this file could not run on ANY managed PostgreSQL.
-- MEASURED 2026-08-05 as a `LOGIN CREATEROLE` role owning the database — the
-- exact shape RDS, Cloud SQL, Neon and Supabase hand you, none of which grants
-- `rolsuper`:
--
--     psql:roles.sql:277: ERROR:  permission denied to alter role
--     DETAIL:  Only roles with the SUPERUSER attribute may change the
--              SUPERUSER attribute.
--
-- On PostgreSQL 16+, NAMING `SUPERUSER`, `BYPASSRLS`, `CREATEDB` or
-- `REPLICATION` in an `ALTER ROLE` — IN EITHER POLARITY — requires the issuing
-- role to HOLD that attribute. It is not a check on whether the value changes.
-- All four were measured, each with its own `DETAIL:` line. `NOCREATEROLE`,
-- `INHERIT`, `LOGIN`/`NOLOGIN`, `VALID UNTIL`, `CONNECTION LIMIT`, `PASSWORD`
-- and `RESET ALL` are all accepted, and so is `CREATE ROLE ... NOSUPERUSER
-- NOBYPASSRLS NOCREATEDB NOREPLICATION PASSWORD %L` — `CREATE ROLE` only
-- objects to a POSITIVE `SUPERUSER`.
--
-- THE RULING: the four dangerous attributes are named in `ALTER ROLE` ONLY when
-- the current role is a superuser. Everywhere else they are omitted and a
-- WARNING names them.
--
-- Rejected alternatives, and why:
--
--   * DROP THEM FROM THE `ALTER` ALTOGETHER — portable, and it deletes the
--     repair that Task 2's commit message records as its proof. A hand-written
--     `ALTER ROLE titlepipe_app BYPASSRLS` would then survive every rerun on
--     every cluster, superuser or not;
--   * KEEP THEM UNCONDITIONALLY — a script that cannot be run at all on the
--     deployment targets is not a safer script, it is an unrun one;
--   * TRY, CATCH, CONTINUE — needs a `DO` block per role and turns a refusal
--     into a per-statement swallow, which is how "converged" quietly starts
--     meaning "attempted".
--
-- WHAT THE DEGRADED PATH STILL GUARANTEES, and this is why it is honest: every
-- role this file CREATES is created with all four attributes cleared, because
-- `CREATE ROLE` accepts them. The gap is exactly "a role that ALREADY EXISTED
-- and ALREADY HELD one of the four, on a cluster where the operator is not a
-- superuser". The catalog assertions in `tests/test_roles.py` are unchanged and
-- unweakened — `rolsuper`, `rolbypassrls`, `rolcreatedb`, `rolcreaterole`,
-- `rolreplication` and `rolinherit` are all read back and asserted — so the
-- weaker path cannot be mistaken for the stronger one by a green suite.
--
-- MEASURED 2026-08-05, this file run end to end as that `CREATEROLE` operator
-- against its own database: exit 0, five roles created, one membership edge,
-- zero `pg_db_role_setting` rows, and three WARNINGs naming precisely what could
-- not be converged (the four attributes, the default privileges of a role the
-- operator does not hold, and `log_min_error_statement`).
--
-- Three more things the non-superuser path cannot do, all skipped-and-warned
-- rather than fatal:
--
--   * CLEAR A SUSET PER-ROLE SETTING. `ALTER ROLE r RESET ALL` REPORTS SUCCESS
--     and silently skips every parameter the caller may not set. MEASURED: with
--     `search_path` and `session_replication_role` both set on one role, the
--     first is cleared and the second is not, exit 0. This is the sharpest
--     residual of this ruling, because `session_replication_role = replica` is
--     the one that switches Task 3's append-only `audit_log` off. The block
--     below re-reads `pg_db_role_setting` after the reset and names whatever
--     survived;
--   * REVOKE A MEMBERSHIP GRANTED BY SOMEBODY ELSE. MEASURED: `ERROR:
--     permission denied to revoke privileges granted by role "seam_admin"`. The
--     membership block skips rows whose grantor the current role does not hold,
--     because `ON_ERROR_STOP` would otherwise turn one such row into a total
--     refusal;
--   * `ALTER DEFAULT PRIVILEGES FOR ROLE <r>` where it does not hold `<r>`.
--     MEASURED: `ERROR: permission denied to change default privileges` — and
--     note this bites even for a role the operator CREATED, because PostgreSQL
--     16's `createrole_self_grant` defaults to empty, so the creator's implicit
--     membership carries `ADMIN` but neither `INHERIT` nor `SET`.
--
--
-- WHY THIS IS A psql SCRIPT AND NOT PLAIN SQL
-- -------------------------------------------
-- Passwords come from the environment and are never literals in this file. The
-- server cannot read the client's environment, so the only mechanism that can
-- do this is psql's `\getenv`. MEASURED 2026-08-05 against psql 18.4:
--
--   * `\getenv` leaves the psql variable UNDEFINED when the variable is unset,
--     and sets it to the empty string when the variable is exported empty,
--     which `\if` cannot tell from a real value. Both are failures here, and so
--     is whitespace-only — see the presence block, which decides all three
--     CLIENT-SIDE and never sends a password to decide them;
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


-- Everything below is one transaction. See the header.
BEGIN;


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
-- MEASURED 2026-08-05 with `log_statement = 'all'` against a fresh cluster: each
-- password reached the log FIVE times, not the three an earlier version of this
-- comment claimed. The two `SELECT format(...)` statements that GENERATE the
-- DDL are logged verbatim too, and they are as much a copy of the password as
-- the DDL they produce:
--
--     1. the presence-check SELECT          (now fixed — see the next block)
--     2. the SELECT that generates CREATE ROLE
--     3. the executed CREATE ROLE
--     4. the SELECT that generates ALTER ROLE
--     5. the executed ALTER ROLE
--
-- `log_min_error_statement` is the fourth `SET` and it is not decoration.
-- `log_statement = 'none'` covers statements that SUCCEED. A statement that
-- FAILS is logged in full at `log_min_error_statement`, whose default is
-- `error`. MEASURED 2026-08-05, with `log_statement='none'` and
-- `log_min_duration_statement=-1` already in force:
--
--     ALTER ROLE <missing role> PASSWORD 'ERRCANARY-777';
--     -> STATEMENT:  ALTER ROLE <missing role> PASSWORD 'ERRCANARY-777';
--
--     ...the same with SET log_min_error_statement = 'panic' first
--     -> nothing in the log
--
-- 1 occurrence versus 0. No attacker is required: a lock on `pg_authid` under a
-- `statement_timeout`, a role dropped concurrently, a `VALID UNTIL` a provider
-- rejects — any failure of an `ALTER ROLE ... PASSWORD` writes the password to
-- the log. `panic` rather than `log`/`fatal` because nothing below can raise a
-- PANIC, so it is the setting that suppresses ALL of it.
--
-- `pg_stat_statements.track` is included because that extension normalises
-- constants but records utility statements verbatim; MEASURED, setting it is
-- harmless when the extension is not loaded — PostgreSQL accepts a dotted name
-- it does not recognise as a placeholder GUC.
SELECT suppress.statement
FROM (
    VALUES
        ('SET log_statement = ''none'''),
        ('SET log_min_error_statement = ''panic'''),
        ('SET log_min_duration_statement = -1'),
        ('SET pg_stat_statements.track = ''none''')
) AS suppress (statement)
WHERE (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
\gexec


-- A NON-SUPERUSER REFUSES INSTEAD OF WARNING. All four settings above are
-- SUSET, so a `CREATEROLE` operator cannot turn logging off — but it CAN READ
-- these settings, measured, and that is the whole difference. The old behaviour
-- was to WARN and carry on, and MEASURED 2026-08-05 against a cluster with
-- `log_statement = 'all'`, a run that REFUSED for a missing variable still put
-- one password in the log, and a successful one put five there. A warning that
-- is emitted immediately before doing the thing it warns about is not a control.
--
-- `pg_settings.setting` rather than `current_setting()` for the duration:
-- `current_setting('log_min_duration_statement')` renders with a unit (`250ms`),
-- which `::int` rejects, while `pg_settings.setting` is the raw millisecond
-- count. `-1` means "never".
SELECT format(
           'DO $log$ BEGIN RAISE EXCEPTION %L; END $log$',
           format(
               'roles.sql: refusing to run — this session is not a superuser, so '
               'statement logging cannot be suppressed, and this cluster logs '
               'statements: log_statement=%s, log_min_duration_statement=%s. '
               'Every password this file sets would be written to the server '
               'log in cleartext. Set log_statement=none and '
               'log_min_duration_statement=-1 on this cluster, or run this file '
               'as a superuser.',
               current_setting('log_statement'),
               (SELECT setting FROM pg_catalog.pg_settings
                WHERE name = 'log_min_duration_statement')
           )
       )
WHERE NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
  AND (
      current_setting('log_statement') <> 'none'
      OR (SELECT setting::int FROM pg_catalog.pg_settings
          WHERE name = 'log_min_duration_statement') >= 0
  )
\gexec

-- The residual the refusal above cannot close, named rather than left silent.
-- A non-superuser cannot set `log_min_error_statement` either, and refusing on
-- it would refuse on every cluster in existence — `error` is the default and
-- nobody changes it. So it is a WARNING, and it says exactly which statements
-- are exposed.
SELECT format(
           'DO $warn$ BEGIN RAISE WARNING %L; END $warn$',
           format(
               'roles.sql: not a superuser, so log_min_error_statement could not '
               'be set to panic; it is %s. Statement logging is off, so a '
               'SUCCESSFUL run logs nothing — but a FAILING role statement is '
               'logged in full at that level, password included.',
               current_setting('log_min_error_statement')
           )
       )
WHERE NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
  AND current_setting('log_min_error_statement') <> 'panic'
\gexec


-- PRESENCE WITHOUT PLAINTEXT.
--
-- Deciding "is this variable set to something real" used to be a SELECT that
-- interpolated all four passwords as literals, and it ran BEFORE any role was
-- touched — so a run that REFUSED for a missing variable still leaked the ones
-- that were supplied. It was occurrence 1 of the 5 counted above, and the only
-- one on the refusal path.
--
-- There is no way to ask the SERVER whether a client-side string is blank
-- without sending it: `\bind` would put it in the log too, as
-- `DETAIL: parameters: $1 = ...`. So the question is answered CLIENT-SIDE, by
-- the shell, which is told the variable's NAME and never handed its VALUE — the
-- command string psql passes to `sh` (and which `ps` can therefore see) contains
-- `$TITLEPIPE_APP_PASSWORD`, not the password.
--
-- `*[!' ']*` is "contains at least one character that is not a space", which is
-- exactly `length(btrim(v)) = 0` inverted: `btrim` with no second argument trims
-- SPACES, so the two agree character for character. A POSIX character class was
-- rejected here — `[![:space:]]` contains `:space`, and psql interpolates `:name`
-- inside backquotes. The space is QUOTED inside the bracket because dash cannot
-- parse a bare one there: MEASURED, `case "$X" in *[! ]*)` is
-- `sh: 1: Syntax error: word unexpected (expecting ")")`.
--
-- FAIL-CLOSED. The probe emits `PRESENT` or `ABSENT`, and the check below
-- refuses on anything that is not `PRESENT`. A shell that cannot run this
-- yields the empty string, which is not `PRESENT`, so the file refuses rather
-- than setting an empty password on four roles.
\set migration_state `case "$TITLEPIPE_MIGRATION_PASSWORD" in *[!' ']*) printf PRESENT;; *) printf ABSENT;; esac`
\set app_state `case "$TITLEPIPE_APP_PASSWORD" in *[!' ']*) printf PRESENT;; *) printf ABSENT;; esac`
\set worker_state `case "$TITLEPIPE_WORKER_PASSWORD" in *[!' ']*) printf PRESENT;; *) printf ABSENT;; esac`
\set blind_state `case "$TITLEPIPE_BLIND_PASSWORD" in *[!' ']*) printf PRESENT;; *) printf ABSENT;; esac`


-- Refuse, naming every variable that is missing rather than the first one, so
-- an operator setting these up learns the whole list in one run.
--
-- `HAVING count(*) > 0` is what makes this a no-op when nothing is missing: the
-- `WHERE` filters every row away, the aggregate row is discarded, `\gexec` gets
-- no rows and executes nothing. Without it the aggregate would still produce
-- one row, with a NULL message, and every run would raise.
--
-- Every value interpolated below is a variable NAME or the word `PRESENT` /
-- `ABSENT`. There is no credential in this statement.
SELECT format(
           'DO $missing$ BEGIN RAISE EXCEPTION %L; END $missing$',
           'roles.sql: refusing to run — password environment variable(s) unset, '
           'empty, whitespace-only, or unreadable because psql could not run a '
           'POSIX shell to check them: '
           || string_agg(required.variable, ', ' ORDER BY required.variable)
       )
FROM (
    VALUES
        ('TITLEPIPE_MIGRATION_PASSWORD', :'migration_state'),
        ('TITLEPIPE_APP_PASSWORD', :'app_state'),
        ('TITLEPIPE_WORKER_PASSWORD', :'worker_state'),
        ('TITLEPIPE_BLIND_PASSWORD', :'blind_state')
) AS required (variable, state)
WHERE required.state <> 'PRESENT'
HAVING count(*) > 0
\gexec


-- Only now, past the refusal, are the values themselves read.
\getenv migration_password TITLEPIPE_MIGRATION_PASSWORD
\getenv app_password TITLEPIPE_APP_PASSWORD
\getenv worker_password TITLEPIPE_WORKER_PASSWORD
\getenv blind_password TITLEPIPE_BLIND_PASSWORD


-- The owner. No password variable exists for it and none is needed: NOLOGIN
-- means no authentication ever happens.
--
-- Every attribute is named on CREATE as well as on ALTER, and that is not
-- redundant: `CREATE ROLE` accepts `NOSUPERUSER NOBYPASSRLS NOCREATEDB
-- NOREPLICATION` from a non-superuser (measured) while `ALTER ROLE` does not, so
-- this is the one place the degraded path still converges all four.
SELECT 'CREATE ROLE titlepipe_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB '
       'NOCREATEROLE NOREPLICATION INHERIT CONNECTION LIMIT -1'
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
--
-- `INHERIT` is here for the same reason and was the same hole: `rolinherit` is
-- ROLE-level and separate from the membership's `INHERIT FALSE` below, and
-- `ALTER ROLE titlepipe_migration NOINHERIT` by hand survived every rerun.
--
-- The `%s` is the ruling in the header: the four attributes only a superuser may
-- NAME.
SELECT format(
           'ALTER ROLE titlepipe_owner %sNOLOGIN NOCREATEROLE INHERIT '
           'PASSWORD NULL VALID UNTIL ''infinity'' CONNECTION LIMIT -1',
           CASE
               WHEN (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
               THEN 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOREPLICATION '
               ELSE ''
           END
       )
\gexec


-- The four LOGIN roles. `titlepipe_migration` runs Alembic; `titlepipe_app` is
-- core-api; `titlepipe_worker` is extraction and render; `titlepipe_blind` is
-- blind-svc, intended for its own database — see the isolation note above.
SELECT format(
           'CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE '
           'NOREPLICATION INHERIT CONNECTION LIMIT -1 PASSWORD %L',
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
WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname = wanted.role
)
\gexec

SELECT format(
           'ALTER ROLE %I LOGIN %sNOCREATEROLE INHERIT '
           'VALID UNTIL ''infinity'' CONNECTION LIMIT -1 PASSWORD %L',
           wanted.role,
           CASE
               WHEN (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
               THEN 'NOSUPERUSER NOBYPASSRLS NOCREATEDB NOREPLICATION '
               ELSE ''
           END,
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

-- Say what was skipped. A degraded run that looks identical to a full one is
-- how "converged" turns into "attempted" without anybody deciding to.
SELECT format(
           'DO $attrs$ BEGIN RAISE WARNING %L; END $attrs$',
           'roles.sql: not a superuser, so SUPERUSER, BYPASSRLS, CREATEDB and '
           'REPLICATION could not be NAMED in ALTER ROLE (PostgreSQL 16+ '
           'requires the issuing role to hold an attribute to name it, in '
           'either polarity) and are therefore NOT converged on roles that '
           'already existed. Roles this run CREATED have all four cleared. '
           'Check pg_authid for the five titlepipe_* roles.'
       )
WHERE NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
\gexec


-- PER-ROLE GUC DEFAULTS. `ALTER ROLE ... SET` is applied AT CONNECT and never
-- checked again, and nothing here used to read `pg_db_role_setting` at all.
--
-- MEASURED 2026-08-05 against postgres:18.4, against a database with Task 3's
-- append-only `audit_log` in it:
--
--     ALTER ROLE titlepipe_app SET session_replication_role='replica';
--     <rerun this file>                       -> exit 0, setting untouched
--     fresh connection as titlepipe_app       -> mode_at_connect = replica
--     before=3  ->  DELETE FROM audit_log  ->  after=0
--
-- Baseline behaviour is `ERROR: audit_log is append-only; DELETE is refused`,
-- and an in-session `SET session_replication_role` is correctly refused with
-- 42501. A per-role DEFAULT is neither: it is superuser set-and-forget, it
-- switches every trigger off at connect, and it survived every rerun.
-- `search_path` and `row_security` drift the same way.
--
-- BOTH SCOPES ARE CONVERGED, and they are separate rows in
-- `pg_db_role_setting`. `ALTER ROLE r RESET ALL` clears only the cluster-wide
-- row (`setdatabase = 0`); `ALTER ROLE r IN DATABASE d SET ...` is a different
-- row that survives it and is applied on exactly the connections that matter —
-- the ones to TitlePipe's database. Converging only one scope would be a
-- guarantee with a hole the same shape as the guarantee.
--
-- The database-scoped pass is generated from the catalog rather than issued for
-- `current_database()`, because the drift can be planted against ANY database
-- in the cluster and this file is not necessarily run against all of them.
SELECT format('ALTER ROLE %I RESET ALL', r.rolname)
FROM pg_catalog.pg_roles r
WHERE r.rolname LIKE 'titlepipe\_%'
\gexec

SELECT format('ALTER ROLE %I IN DATABASE %I RESET ALL', r.rolname, d.datname)
FROM pg_catalog.pg_db_role_setting s
JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
JOIN pg_catalog.pg_database d ON d.oid = s.setdatabase
WHERE r.rolname LIKE 'titlepipe\_%'
\gexec

-- 🔴 `RESET ALL` IS NOT A REFUSAL WHEN IT CANNOT DO ITS JOB, so the catalog is
-- re-read and anything left is named. MEASURED 2026-08-05 against postgres:18.4
-- as a `CREATEROLE` operator, with two settings planted on one role:
--
--     ALTER ROLE titlepipe_app RESET ALL;              -> ALTER ROLE (success)
--     pg_db_role_setting                               -> search_path GONE,
--                                                         session_replication_role
--                                                         STILL THERE
--     ALTER ROLE titlepipe_app RESET session_replication_role;
--     -> ERROR: permission denied to set parameter "session_replication_role"
--
-- `RESET ALL` SKIPS every parameter the caller may not set and reports success
-- anyway, so on a managed cluster the one setting that matters most — the
-- SUSET `session_replication_role`, which switches Task 3's append-only
-- `audit_log` triggers off at connect — is exactly the one that survives. The
-- superuser path clears it; nothing else can, and a silent partial is the worst
-- of the three outcomes.
--
-- Only the parameter NAME is reported. A per-role setting's VALUE can be
-- anything an operator put there, and `RAISE WARNING` reaches the server log.
SELECT format(
           'DO $guc$ BEGIN RAISE WARNING %L; END $guc$',
           'roles.sql: per-role settings left in place — ALTER ROLE ... RESET '
           'ALL silently skips a parameter this session may not set, and '
           'returns success. Still set: '
           || string_agg(
                  format(
                      '%s%s -> %s',
                      r.rolname,
                      CASE
                          WHEN s.setdatabase = 0 THEN ''
                          ELSE format(' IN DATABASE %s', d.datname)
                      END,
                      split_part(u.entry, '=', 1)
                  ),
                  ', ' ORDER BY r.rolname, u.entry
              )
       )
FROM pg_catalog.pg_db_role_setting s
JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
LEFT JOIN pg_catalog.pg_database d ON d.oid = s.setdatabase
CROSS JOIN LATERAL unnest(s.setconfig) AS u (entry)
WHERE r.rolname LIKE 'titlepipe\_%'
HAVING count(*) > 0
\gexec


-- MEMBERSHIP CONVERGENCE. Every edge that touches a `titlepipe_*` role is
-- revoked, then the one edge that should exist is granted.
--
-- THE FILTER MATCHES EITHER SIDE, and that is the R1 fix. `WHERE owner.rolname =
-- 'titlepipe_owner'` converged members of the owner and missed paths to it; see
-- the header for the two-hop measurement. Matching the MEMBER side as well also
-- catches `GRANT pg_read_all_data TO titlepipe_app` and every other predefined
-- role, which the owner-side filter could never have seen.
--
-- NO ROW IS EXEMPTED FOR BEING THE WANTED ONE, and the review that asked for
-- the widened filter proposed exempting it — `AND NOT (owner =
-- 'titlepipe_owner' AND member = 'titlepipe_migration')`. It is not here, for
-- one measured reason and one structural one, and the measured one does NOT say
-- what a first draft of this comment claimed:
--
--   * MEASURED 2026-08-05: with that exemption added, the whole suite still
--     passes, INCLUDING the second-grantor case. The reason is specific to that
--     grantor rather than to the filter — `dba`'s own membership of
--     `titlepipe_owner` is revoked by the same pass, and `CASCADE` takes its
--     onward `INHERIT TRUE` grant with it. So the exemption is not measurably
--     broken, and any comment here saying it is would be false. (Measured while
--     checking: a SUPERUSER second grantor does NOT produce a distinct row at
--     all — PostgreSQL records the grantor as the bootstrap superuser and
--     UPDATES the existing row — so a second row needs a non-superuser holding
--     `ADMIN OPTION`, which is exactly the shape the cascade reaches.);
--   * the exemption buys nothing and costs a special case. The wanted row is
--     re-granted two statements down, so revoking it is one extra `REVOKE` and
--     one extra `GRANT` per run. In exchange, the filter would carry a
--     pair-shaped hole whose safety depends on whether a second row's grantor
--     happens to be reachable by a cascade — which is a property of whoever
--     planted the drift, not of this file. The entire history of this block is
--     special cases that turned out to have holes.
--
-- TWO EXEMPTIONS IT DOES CARRY, both for the non-superuser path, both measured:
--
--   * `member = current_user AND admin_option` — when a `CREATEROLE` operator
--     creates these roles, PostgreSQL 16+ grants IT membership `WITH ADMIN
--     OPTION` automatically. That row is what lets the operator run this file a
--     second time; revoking it produces `ERROR: permission denied to alter role
--     / DETAIL: Only roles with the CREATEROLE attribute and the ADMIN option on
--     role "titlepipe_owner" may alter this role` on the next run, i.e. a
--     cluster this file can no longer manage. It is a real residual — the
--     operator can `SET ROLE titlepipe_owner` if it grants itself `SET` — and it
--     is not a new one: that operator holds `CREATEROLE` over these roles and
--     could re-grant anything this file revoked;
--   * `pg_has_role(current_user, grantor, 'USAGE')` — a row granted by somebody
--     else cannot be revoked by a non-superuser. MEASURED: `ERROR: permission
--     denied to revoke privileges granted by role "seam_admin"`, which under
--     `ON_ERROR_STOP` would turn one un-revokable row into a total refusal.
--     Skipped rows are WARNED about by name, immediately below, rather than
--     dropped silently. A superuser holds every role, so this exempts nothing
--     on the superuser path.
--
-- `GRANTED BY` is what makes the revoke reach a row this session did not create;
-- a `REVOKE` without it leaves other grantors' rows in place even for a
-- superuser.
--
-- `CASCADE` is required rather than decorative. MEASURED 2026-08-05: revoking
-- the membership of a `dba` that had itself granted the role onward failed with
-- `2BP01: dependent privileges exist / HINT: Use CASCADE to revoke them too`,
-- and `ON_ERROR_STOP` turned the whole convergence into exit 3. A row already
-- removed by a cascade is then a WARNING on its own `REVOKE`, not an error, so
-- the generated list staying stale is harmless.
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
WHERE (owner.rolname LIKE 'titlepipe\_%' OR member.rolname LIKE 'titlepipe\_%')
  AND NOT (member.rolname = current_user AND am.admin_option)
  AND pg_catalog.pg_has_role(current_user, grantor.oid, 'USAGE')
\gexec

SELECT format(
           'DO $edges$ BEGIN RAISE WARNING %L; END $edges$',
           'roles.sql: role memberships left in place because this session '
           'cannot revoke a grant made by their grantor: '
           || string_agg(
                  format('%s <- %s (granted by %s)',
                         owner.rolname, member.rolname, grantor.rolname),
                  ', ' ORDER BY owner.rolname, member.rolname
              )
       )
FROM pg_catalog.pg_auth_members am
JOIN pg_catalog.pg_roles owner ON owner.oid = am.roleid
JOIN pg_catalog.pg_roles member ON member.oid = am.member
JOIN pg_catalog.pg_roles grantor ON grantor.oid = am.grantor
WHERE (owner.rolname LIKE 'titlepipe\_%' OR member.rolname LIKE 'titlepipe\_%')
  AND NOT (member.rolname = current_user AND am.admin_option)
  AND NOT pg_catalog.pg_has_role(current_user, grantor.oid, 'USAGE')
HAVING count(*) > 0
\gexec

-- `INHERIT FALSE` is the load-bearing half and is not the default: with the
-- default `INHERIT`, `CREATE TABLE` without `SET ROLE` succeeds and produces a
-- table owned by a LOGIN role. `SET TRUE` is what keeps `SET ROLE
-- titlepipe_owner` available — `INHERIT FALSE, SET FALSE` would be a membership
-- that grants nothing and would break every migration. Both are PostgreSQL 16+
-- syntax, which the floor at the top of this file enforces.
GRANT titlepipe_owner TO titlepipe_migration WITH INHERIT FALSE, SET TRUE;


-- DEFAULT PRIVILEGES. The only grant mechanism in PostgreSQL that reaches
-- objects that do not exist yet, and the reason it is converged here while
-- object-level grants deliberately are not — see the header.
--
-- The rows converged are those where a `titlepipe_*` role is the GRANTEE, plus
-- those where a `titlepipe_*` role is the OWNER whose future objects are being
-- given away. A grantee that IS the owner is never revoked: MEASURED 2026-08-05,
-- `ALTER DEFAULT PRIVILEGES FOR ROLE titlepipe_owner REVOKE ALL ON SEQUENCES
-- FROM titlepipe_owner` leaves a `pg_default_acl` row holding `{}` — it strips
-- the owner's own default privileges on its own future objects, which is drift
-- rather than convergence. With that grantee excluded, three rows planted three
-- different ways converge to zero rows and PostgreSQL deletes the catalog entry.
--
-- `pg_has_role(..., 'USAGE')` gates each row for the reason in the header: a
-- `CREATEROLE` operator gets `ERROR: permission denied to change default
-- privileges` even for a role it created. Skipped rows are warned about.
--
-- `DISTINCT` because `aclexplode` yields one row per PRIVILEGE and the statement
-- revokes ALL of them at once.
SELECT DISTINCT format(
           'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL ON %s FROM %I',
           owner.rolname,
           CASE
               WHEN d.defaclnamespace = 0 THEN ''
               ELSE format(' IN SCHEMA %I', n.nspname)
           END,
           CASE d.defaclobjtype
               WHEN 'r' THEN 'TABLES'
               WHEN 'S' THEN 'SEQUENCES'
               WHEN 'f' THEN 'FUNCTIONS'
               WHEN 'T' THEN 'TYPES'
               WHEN 'n' THEN 'SCHEMAS'
           END,
           grantee.rolname
       )
FROM pg_catalog.pg_default_acl d
JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
JOIN pg_catalog.pg_roles grantee ON grantee.oid = a.grantee
WHERE a.grantee <> d.defaclrole
  AND (grantee.rolname LIKE 'titlepipe\_%' OR owner.rolname LIKE 'titlepipe\_%')
  AND pg_catalog.pg_has_role(current_user, d.defaclrole, 'USAGE')
\gexec

SELECT format(
           'DO $dacl$ BEGIN RAISE WARNING %L; END $dacl$',
           'roles.sql: default privileges left in place because this session '
           'does not hold the role that owns them: '
           || string_agg(DISTINCT
                  format('%s -> %s', owner.rolname, grantee.rolname), ', '
              )
       )
FROM pg_catalog.pg_default_acl d
JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a
JOIN pg_catalog.pg_roles grantee ON grantee.oid = a.grantee
WHERE a.grantee <> d.defaclrole
  AND (grantee.rolname LIKE 'titlepipe\_%' OR owner.rolname LIKE 'titlepipe\_%')
  AND NOT pg_catalog.pg_has_role(current_user, d.defaclrole, 'USAGE')
HAVING count(*) > 0
\gexec


-- Database-scoped, and the reason nothing else in Task 2 can work without it.
-- See the header: PostgreSQL 15 took this away from `PUBLIC`.
GRANT CREATE ON SCHEMA public TO titlepipe_owner;

-- ...and `USAGE`, which is a DIFFERENT privilege and is not implied by
-- `CREATE`. See "WHY `GRANT USAGE ON SCHEMA public` IS HERE" in the header for
-- the measurement and for which three roles are named. The two application
-- roles are here rather than in `0002` because `0002` runs as
-- `titlepipe_owner`, which holds no grant option on schema `public` and
-- therefore cannot land the grant at all — its `GRANT` is a WARNING.
GRANT USAGE ON SCHEMA public TO titlepipe_owner, titlepipe_app, titlepipe_worker;

-- ...and PROVED, because PostgreSQL does not fail that statement when it does
-- nothing. MEASURED 2026-08-05 as a `CREATEROLE` operator running this file
-- against a database it does not own:
--
--     WARNING:  no privileges were granted for "public"
--     exit 0, five roles created, and titlepipe_owner without CREATE
--
-- A `GRANT` issued by a role holding no grant option is a WARNING, not an
-- error, so `ON_ERROR_STOP` never sees it and the run reports success — leaving
-- a cluster where every Task 3 migration dies with `permission denied for
-- schema public` and nothing in this file's output says why. Reading the
-- privilege back is the difference between "the statement ran" and "the
-- privilege is there". The refusal rolls the whole file back; see the header.
SELECT format(
           'DO $grant$ BEGIN RAISE EXCEPTION %L; END $grant$',
           format(
               'roles.sql: refusing to finish — titlepipe_owner still has no '
               'CREATE on schema public in database %s. PostgreSQL reports a '
               'GRANT from a role that holds no grant option as a WARNING '
               'rather than an error, so this run would otherwise have '
               'succeeded and left every migration failing. Run this file as a '
               'superuser, or as the owner of the database (schema public '
               'belongs to pg_database_owner from PostgreSQL 15 on).',
               current_database()
           )
       )
WHERE NOT has_schema_privilege('titlepipe_owner', 'public', 'CREATE')
\gexec

-- The same read-back for `USAGE`, and it CANNOT be written the same way.
--
-- `has_schema_privilege('titlepipe_owner', 'public', 'USAGE')` is TRUE on a
-- default cluster whether or not the `GRANT` above landed, because `PUBLIC`
-- still holds `USAGE` and `has_schema_privilege` answers about the EFFECTIVE
-- privilege. MEASURED 2026-08-06 against postgres:18.4, in the database of a
-- `LOGIN CREATEROLE` operator, with no grant to `titlepipe_owner` at all:
--
--     nspacl -> {pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}
--     has_schema_privilege('titlepipe_owner','public','USAGE') -> t
--
-- A guard written on `has_schema_privilege` would therefore pass over a `GRANT`
-- that WARNed and did nothing, and would only start failing on the day somebody
-- ran `REVOKE USAGE ON SCHEMA public FROM PUBLIC` — which is precisely the day
-- there is no operator watching. So the ACL is read directly and the question
-- asked is "is there an EXPLICIT `USAGE` entry for this role", which is the
-- thing the `GRANT` is supposed to have created.
--
-- `aclexplode` over a NULL `nspacl` yields no rows and this therefore RAISES,
-- which is the fail-closed direction. `'name'::regrole` resolves to the role's
-- oid and errors if the role is missing; all five are created above, so all
-- five exist by this point.
--
-- THE THREE ROLES BELOW ARE THE THREE THE `GRANT` NAMES, and they are spelled
-- out again rather than derived, because the whole job of this block is to
-- disagree with the statement above it when the statement did nothing. Only the
-- roles that are actually MISSING reach the message — `WHERE NOT EXISTS`
-- filters row by row and `string_agg` runs over what is left — so the refusal
-- names the roles that failed rather than the roles it asked about.
SELECT format(
           'DO $usage$ BEGIN RAISE EXCEPTION %L; END $usage$',
           format(
               'roles.sql: refusing to finish — schema public in database %s has '
               'no explicit USAGE grant for %s. PostgreSQL reports a GRANT from '
               'a role that holds no grant option as a WARNING rather than an '
               'error, and PUBLIC''s own USAGE hides the result from '
               'has_schema_privilege, so this run would otherwise have '
               'succeeded and left a cluster that breaks the moment USAGE is '
               'revoked from PUBLIC. Run this file as a superuser, or as the '
               'owner of the database (schema public belongs to '
               'pg_database_owner from PostgreSQL 15 on).',
               current_database(),
               string_agg(wanted.role, ', ' ORDER BY wanted.role)
           )
       )
FROM (
    VALUES ('titlepipe_owner'), ('titlepipe_app'), ('titlepipe_worker')
) AS wanted (role)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_namespace n
    CROSS JOIN LATERAL aclexplode(n.nspacl) AS a
    WHERE n.nspname = 'public'
      AND a.grantee = wanted.role::regrole
      AND a.privilege_type = 'USAGE'
)
HAVING count(*) > 0
\gexec


COMMIT;

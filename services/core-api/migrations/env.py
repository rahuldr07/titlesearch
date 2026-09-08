"""How Alembic reaches the database, and as whom.

THREE HAND-OFFS FROM TASK 2, EACH MEASURED AGAINST postgres:18.4. This file
hits all three, and `tests/test_roles.py` already fails loudly for two of them.

**1. `SET ROLE titlepipe_owner`, after connecting and before
`context.begin_transaction()`.** `titlepipe_migration` holds its membership of
`titlepipe_owner` `WITH INHERIT FALSE, SET TRUE`, so it holds NONE of the
owner's privileges until it says so. Forget the `SET ROLE` and the first
statement — `alembic_version`'s own `CREATE TABLE` — fails with `permission
denied for schema public`.

The database enforces it that way *because the alternative was a silent wrong
answer*. Under the default `INHERIT` the `CREATE TABLE` SUCCEEDED and produced a
table owned by `titlepipe_migration`, a LOGIN role — and a table's owner bypasses
row-level security on it unless the table is `FORCE ROW LEVEL SECURITY`. The
migration reported success and the catalog was wrong.

**2. It must be CONNECTION-scoped: never `SET LOCAL`, never followed by `RESET
ROLE`.** After a `RESET ROLE`, `titlepipe_migration` reading its own migration
state fails with `permission denied for table alembic_version` — a TABLE error
this time, not a schema one, because by then the table exists and belongs to
somebody else. `alembic current`, `alembic stamp` and `alembic downgrade` all
read it.

**3. Everything stays in schema `public`.** `CREATE SCHEMA` as
`titlepipe_owner` fails with `permission denied for database <db>`: the owner
holds `CREATE ON SCHEMA public` (granted by `roles.sql`) and no `CREATE ON
DATABASE`. A migration that creates a non-`public` schema needs a new grant in
`roles.sql`, and that grant needs its own test.

`migrations/sql/roles.sql` is NOT Alembic's to run. It creates the role Alembic
authenticates as, so it must already have been applied when `alembic upgrade` is
called. The test suite applies it through the `roles_applied` fixture.

## Why there is a `connection.commit()` between the two

It looks like a stray line and it is load-bearing. `connection.execute(...)`
autobegins a transaction in SQLAlchemy 2.0, and `MigrationContext` records
`_in_external_transaction = connection.in_transaction()` at `configure()` time.
With a transaction already open, `context.begin_transaction()` returns a
`nullcontext` and **Alembic never commits** — the whole upgrade would then be
rolled back when the `with` block closes the connection, leaving a database that
reports no migrations and an `alembic upgrade` that exited 0.

Committing first closes the autobegun transaction and hands Alembic a clean
connection to manage. `SET ROLE` survives it precisely because it is not `SET
LOCAL` — which is hand-off 2 restated from the other end.
"""

from __future__ import annotations

import os
from logging.config import fileConfig
from typing import NoReturn

from alembic import context
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import engine_from_config, pool, text
from sqlalchemy.engine import Connection

from titlepipe_core.db.engine import DENY_SENTINEL_OPTIONS
from titlepipe_core.db.models import Base
from titlepipe_core.db.rls_coverage import assert_rls_coverage
from titlepipe_core.db.unscoped_tables import QUEUE_INFRASTRUCTURE_TABLES

# `roles.sql` creates it; `tests/test_roles.py` proves nothing else can become
# it. Spelled here rather than imported from `conftest.py`, which is test-only
# and not importable from a migration.
OWNER_ROLE = "titlepipe_owner"

# The environment variable an operator sets for `alembic upgrade head` on a real
# deployment. It shares the application's `TITLEPIPE_` prefix because it IS
# application configuration — MEASURED 2026-08-05, pydantic-settings 2.14.2
# resolves `CoreApiSettings` by walking the model's FIELDS, so a `TITLEPIPE_`
# variable matching no field is invisible to `extra="forbid"` and cannot break
# startup.
DATABASE_URL_VARIABLE = "TITLEPIPE_DATABASE_URL"

# The key `tests/test_schema_migration.py` passes the container's DSN under.
# `config.attributes` is a PLAIN DICT and `Config.set_main_option` is not: the
# latter goes through `ConfigParser`, where a `%` in a password is read as the
# start of an interpolation and raises. Generated passwords here are
# `token_urlsafe` and contain no `%`, but `test_a_password_full_of_quoting_hazards_survives`
# exists precisely because that alphabet is not a guarantee about real ones.
DSN_ATTRIBUTE = "dsn"

config = context.config

# `cmd_opts is not None` MEANS "THE `alembic` CONSOLE SCRIPT IS THE ENTRY
# POINT", AND CONFIGURING THE PROCESS'S LOGGING IS ONLY CORRECT THERE.
#
# Alembic sets `Config.cmd_opts` in exactly one place — `CommandLine.main`,
# from `parser.parse_args` — and its own docstring calls it "the command-line
# options passed to the ``alembic`` script". Every `alembic.command.*` call
# leaves it `None`, which covers the test suite, a startup `upgrade head`, and
# any management command.
#
# `config_file_name is not None` ALONE WAS NOT THAT TEST, and the difference was
# not academic. `tests/conftest.py::_alembic_config` does
# `Config(str(ALEMBIC_INI))`, so `config_file_name` is always set and this block
# ran on every programmatic entry to this file.
#
# HOW MANY THAT IS, MEASURED 2026-08-06 by counting entries to this gate over one
# full `uv run pytest` of this service: **29**, plus one more from the `alembic`
# CLI test, which is the only run where `cmd_opts` is set. This comment used to
# say "all sixteen `command.*` calls in the suite". Sixteen is the number of
# `command.*` CALL SITES in `tests/test_schema_migration.py` alone; the suite has
# 24 of them (conftest 2, test_schema_migration 16, test_forced_rls_and_grants 5,
# test_tenant_session 1), and neither number is the run count, because
# `conftest.py`'s two sit in a MODULE-scoped fixture and repeat per module.
#
# WHAT IT DID EACH TIME, MEASURED 2026-08-05 with a handler of our own attached
# to the root logger before a programmatic `command.check`:
#
#     before: root handlers [<StreamHandler <stderr>>]
#     after : root handlers [<StreamHandler <stderr>>]
#     our handler still attached: False
#
# The count is unchanged because `fileConfig` installs a `StreamHandler` of its
# own; the handler that was there is gone and CLOSED. `disable_existing_loggers`
# does not govern that — `logging.config.fileConfig` calls
# `_clearExistingHandlers()` unconditionally and `_install_loggers` then removes
# and closes root's handlers before installing the ini's. An earlier fix here
# addressed the flag and left the teardown, which is the half that fires whatever
# the flag says.
#
# `tests/test_schema_migration.py::test_a_programmatic_migration_leaves_the_root
# _loggers_handlers_attached` is the gate's test, and the sibling immediately
# below it drives the CLI branch so the gate cannot be quietly turned into a
# permanent `False`.
if config.config_file_name is not None and config.cmd_opts is not None:
    # `disable_existing_loggers=False` IS NOT OPTIONAL, and the default is the
    # other way. `logging.config.fileConfig` defaults to `True`, which DISABLES
    # every logger that already exists and is not named in the ini — permanently,
    # process-wide, with no undo. MEASURED 2026-08-05 in a process that had
    # imported `asyncio`, `urllib3`, `psycopg`, `sqlalchemy`, `fastapi`,
    # `alembic` and `titlepipe_core.app`, then called
    # `fileConfig("alembic.ini")` at the stdlib default: 16 loggers newly
    # `disabled=True`, `asyncio`, `psycopg`, `sqlalchemy`, `urllib3` and
    # `fastapi` among them. (An earlier version of this comment said 50. That
    # number is a function of what the process has imported and was not
    # reproducible; the five named ones are.)
    #
    # It still matters after the gate above. `alembic upgrade head` from a shell
    # is a short-lived process, but `_clearExistingHandlers` and this flag apply
    # to everything already imported in it — SQLAlchemy, psycopg and this
    # service's own modules among them. `test_fileconfig_still_runs_for_the
    # _alembic_cli_and_keeps_existing_loggers_enabled` covers it.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# `alembic check` and `--autogenerate` compare against this. `Base.metadata`
# carries the naming convention, so a constraint Alembic creates gets the same
# name the model would have given it.
target_metadata = Base.metadata


def _include_name(name: str | None, type_: str, _parent_names: dict[str, str | None]) -> bool:
    """Which reflected names autogenerate is allowed to see. Only the queue is hidden.

    THE FOUR PROCRASTINATE TABLES ARE IN THE DATABASE AND MUST NOT BE IN
       `Base.metadata`, AND WITHOUT THIS HOOK THAT IS A PERMANENT `alembic check`
       FAILURE.
    `0060` installs `migrations/sql/procrastinate_schema_3.9.0.sql` verbatim —
    four tables, three types, eighteen functions. They are the library's, not
    ours, and modelling them would fork the DDL and the functions that read it.
    Autogenerate compares the live schema against the metadata and reports
    anything present in one and absent from the other, so unhidden it emits
    `remove_table` for all four plus `remove_index` for their eight indexes:
    MEASURED against postgres:18.4 on this chain, thirteen operations, every one
    of them an instruction to DROP the queue.

    `include_name` and NOT `include_object`, and the difference is the eight
    indexes. `include_name` is consulted DURING reflection, so returning `False`
    for a table means the table is never reflected and its indexes, constraints
    and sequences never enter the comparison at all. `include_object` is
    consulted after reflection, per object, so it needs a second clause for
    indexes that reaches through `object.table` to find the parent — the same
    decision spelled twice, in a place where getting the second one wrong shows
    up as a `DROP INDEX` on a vendor table.

    NOT DERIVED FROM THE TABLE COMMENT `0060` WRITES. `0060` proposes
    `comment LIKE 'QUEUE-INFRASTRUCTURE:%'` as the exemption's source, which is
    the right instinct for a check that describes and the wrong one for a check
    that refuses: `COMMENT ON TABLE` is available to every table owner, so a
    table could hide itself from schema drift detection with no diff anybody
    reviews. `db/unscoped_tables.py` carries that argument and the names.

    THE ONE NAME SET, SHARED WITH THE RLS COVERAGE CHECK. A second list here
    would be free to drift from `UNSCOPED_TABLES`, and the drift direction that
    matters is silent: a queue table hidden from `alembic check` but not from the
    coverage check fails a migration, and hidden from the coverage check but not
    from `alembic check` produces a spurious `remove_table` nobody can act on.

    `type_` is checked rather than assumed: Alembic calls this for schemas and
    indexes too, and a bare name comparison would hide an index that happened to
    share a table's name. The third argument is Alembic's, passed positionally and
    unread here — leading underscore so `ruff`'s ARG001 is satisfied without a
    `noqa` this file would then have to keep true.
    """
    if type_ == "table":
        return name not in QUEUE_INFRASTRUCTURE_TABLES
    return True


def _database_url() -> str:
    """The DSN, from the caller, the environment or the ini file — in that order.

    Three sources because there are three callers. The tests hand a container
    DSN in through `config.attributes`; an operator exports
    `TITLEPIPE_DATABASE_URL`; and `sqlalchemy.url` in `alembic.ini` is the slot
    an operator may fill locally, deliberately left empty in the committed file
    so no credential lives in version control.

    Refusing outright when all three are empty is the point. Alembic's own
    default for a missing URL is to build an engine from an empty string, which
    fails somewhere inside SQLAlchemy with a message about a driver rather than
    about configuration.
    """
    from_caller = config.attributes.get(DSN_ATTRIBUTE)
    if isinstance(from_caller, str) and from_caller.strip():
        return from_caller.strip()

    from_environment = os.environ.get(DATABASE_URL_VARIABLE, "").strip()
    if from_environment:
        return from_environment

    from_ini = (config.get_main_option("sqlalchemy.url") or "").strip()
    if from_ini:
        return from_ini

    raise RuntimeError(
        f"no database URL: set {DATABASE_URL_VARIABLE}, or `sqlalchemy.url` in "
        f"alembic.ini, or pass one as config.attributes[{DSN_ATTRIBUTE!r}]. It "
        f"must be titlepipe_migration's DSN — that is the only role that can "
        f"SET ROLE {OWNER_ROLE}."
    )


def run_migrations_offline() -> None:
    """Refused, with the reason, rather than half-supported.

    `--sql` mode has no connection, so there is nothing to `SET ROLE` on. Alembic
    would happily emit the seven `CREATE TABLE`s as text, and a DBA running that
    script as themselves would create every table owned by whoever they happen
    to be — the exact silent mis-ownership the `INHERIT FALSE` membership was
    introduced to make impossible. A generated script that needs a hand-added
    prologue to be correct is a script somebody eventually runs without it.

    Emitting `SET ROLE` into the output was considered and rejected: nothing
    would verify it survived into what was actually executed, and this file's
    whole job is to make that unnecessary to trust.
    """
    raise RuntimeError(
        "offline (--sql) migrations are not supported: there is no connection to "
        f"issue `SET ROLE {OWNER_ROLE}` on, so every object in the generated "
        "script would be created owned by whoever runs it. Run `alembic upgrade` "
        "against the database as titlepipe_migration."
    )


def _refused_autocommit_block() -> NoReturn:
    """What `MigrationContext.autocommit_block` is replaced by.

    A plain function and not a `@contextmanager`, so it raises when the block is
    CALLED rather than when it is entered — one step earlier, and with no
    unreachable `yield` to explain. `NoReturn` is assignable to the context
    manager the real method returns, so the substitution typechecks.
    """
    raise RuntimeError(
        "a migration on this chain opened an autocommit block, and this env.py "
        "refuses them. `autocommit_block` COMMITS the transaction the run is in "
        "before it yields, so DDL inside it survives a later failure — including "
        "the row-level-security coverage check below, which is the whole reason "
        "that check is inside `begin_transaction()`. If a statement genuinely "
        "cannot run in a transaction, it does not belong in this chain: run it as "
        "an operator step and record it in the revision's docstring."
    )


def _refuse_autocommit_blocks(migration_context: MigrationContext) -> None:
    """Make "the whole run rolls back with it", four frames down, TRUE.

    THAT CLAIM WAS FALSE, AND FALSE IN THE DIRECTION THAT WEDGES THE DATABASE.
    MEASURED 2026-09-08 against postgres:18.4 on this chain at `0102`, with a
    revision whose whole body was `with op.get_context().autocommit_block():
    op.execute("CREATE TABLE leftover (tenant_id uuid NOT NULL)")`:

        alembic upgrade head  ->  RlsCoverageError on `leftover`, as designed
        to_regclass('public.leftover')  ->  leftover      (it survived)
        alembic_version                 ->  0102          (it did not land)

    So the refusal was correct, the rollback was not, and the two states
    disagree. Then, DELETING THE ATTACK REVISION FROM THE TREE ENTIRELY: the very
    next `alembic upgrade head` fails on the same `leftover`, and every one after
    it, because the coverage check runs at head against a table no revision now
    creates. Recovery is a manual `DROP TABLE` by somebody holding the owner —
    outside Alembic, on a database Alembic can no longer touch.

    `autocommit_block` COMMITS the transaction before it yields; alembic's own
    docstring says so in a `.. warning::`. Nothing downstream can roll back what
    it committed, so this closes the block itself rather than trying to undo it.

    REPLACED ON THE INSTANCE, NOT THE CLASS. `op.get_context()` returns this same
    `MigrationContext`, so an instance attribute shadows the method for exactly
    this run; patching `MigrationContext.autocommit_block` would hold for the
    process, and `tests/conftest.py` runs migrations 29 times in one pytest
    process alongside code that has every right to use the block.

    RESIDUAL — this closes ONE door, and the others are open. A revision can
    still leave the transaction by calling `op.get_bind().commit()`, by
    `exec_driver_sql("COMMIT")`, or by building an engine of its own; all three
    end in the same wedged state and none of them is refused here. What would
    close them is a check on the way OUT — that the connection is still in the
    transaction `begin_transaction()` opened — which detects rather than
    prevents and is not written. `check:rules` bans none of these.
    """
    migration_context.autocommit_block = _refused_autocommit_block


def _assert_coverage_at_head(connection: Connection) -> None:
    """`assert_rls_coverage`, but only when the run finished ON a head.

    THE INVARIANT BELONGS TO HEAD, NOT TO EVERY POINT IN THE CHAIN, AND
       ASSERTING IT UNCONDITIONALLY BREAKS THE CHAIN.
    MEASURED on this tree, with the assertion called unconditionally: **two
    tests fail**, and both are correct behaviour being refused —

        tests/test_forced_rls_and_grants.py
          ::test_downgrading_only_0002_removes_every_policy_grant_and_force
          ::test_the_migration_refuses_when_the_schema_grant_did_not_land

    `0001` creates the seven tables and `0002` isolates them, so **at revision
    `0001` the invariant is legitimately false** — that is what the split between
    the two revisions IS, and `0002`'s own docstring says so: it exists so that
    "the tables exist" and "the tables are isolated" are separately reversible.
    An unconditional check makes `downgrade 0002` and `upgrade 0001` impossible,
    which is a coverage check that has quietly become a chain-shape check.

    So the condition is the state the database ends the run IN, not the direction
    it travelled: if the current revision is one of the script directory's heads,
    this is a database somebody intends to RUN, and the invariant holds there or
    the run is refused. `downgrade base` ends at `None`, a partial upgrade or
    downgrade ends mid-chain, and neither is asserted.

    `get_heads()` rather than `get_current_head()`: the latter raises when the
    chain has more than one head, which is the ordinary state while several
    workers each add a migration, and a check that crashed on that would be a
    check everyone deletes.

    WHAT THE CONDITION COSTS, stated rather than left to be discovered. A
    deliberate `alembic upgrade <mid-chain revision>` is not asserted, so a
    deployment pinned to a revision that is not a head does not get this check at
    migration time. `lifespan.py` is what covers that case, and it covers it for
    every start of every replica rather than once at deploy.
    """
    current = context.get_context().get_current_revision()
    heads = ScriptDirectory.from_config(config).get_heads()
    if current is not None and current in heads:
        assert_rls_coverage(connection)


def run_migrations_online() -> None:
    """Connect as `titlepipe_migration`, become `titlepipe_owner`, then migrate."""
    configuration = dict(config.get_section(config.config_ini_section) or {})
    configuration["sqlalchemy.url"] = _database_url()

    # `NullPool` because this process opens one connection, runs one migration
    # and exits. A pooled engine would hold the connection open past `dispose()`
    # on some drivers and keep a lock on `alembic_version` alive with it.
    #
    # `connect_args` IS THE DENY PIN, AND ALEMBIC HAS TO ASK FOR IT ITSELF.
    # `titlepipe_core.db.engine` pins the tenant GUC at the empty-string deny
    # sentinel in `make_engine`'s `connect_args`, and its docstring used to claim
    # that pin covered "every connection" including this one. It does not, and
    # cannot: this engine is built here, by `engine_from_config`, and never goes
    # near `make_engine`.
    #
    # Unpinned, this connection's tenant is whatever `PGOPTIONS` says. MEASURED
    # 2026-08-06 against postgres:18.4 by driving a real `alembic current` and
    # reading `current_setting(…, true)` off the connection opened below, with
    # this `connect_args` absent:
    #
    #     no PGOPTIONS                              ->  NULL
    #     PGOPTIONS='-c app.current_tenant=1111…'   ->  '11111111-1111-1111-…'
    #
    # And what that costs, measured in the same session against a database
    # holding one `orders` row for each of two tenants, on a connection to the
    # same server as titlepipe_migration and then `SET ROLE titlepipe_owner` —
    # the two privilege steps this function takes below:
    #
    #     PGOPTIONS,    no connect_args:  guc '1111…',  UPDATE 1,  count 1
    #     PGOPTIONS,    connect_args:     guc ''     ,  UPDATE 0,  count 0
    #     no PGOPTIONS, no connect_args:  guc NULL   ,  UPDATE 0,  count 0
    #
    # `0002`'s docstring states the post-`0002` invariant for a data migration
    # unconditionally — it touches 0 rows and says nothing. Under an exported
    # `PGOPTIONS` it instead touches exactly ONE tenant's rows and reports a
    # non-zero `UPDATE`, which reads as success while every other tenant has been
    # silently skipped. That is the worse of the two failures, and it is the one
    # this line removes.
    #
    # IMPORTED RATHER THAN RESPELLED. A second `-c app.current_tenant=` literal
    # here would be a second thing to keep in step with `engine.py`, and the copy
    # that drifts is the one with no test pointed at it.
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"options": DENY_SENTINEL_OPTIONS},
    )

    try:
        with connectable.connect() as connection:
            # Not a bind parameter: `SET ROLE` takes an identifier, and an
            # identifier cannot be parameterised. `OWNER_ROLE` is a constant in
            # this file, never input.
            connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
            connection.commit()  # see the module docstring — Alembic will not commit otherwise

            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                include_name=_include_name,
            )
            _refuse_autocommit_blocks(context.get_context())

            with context.begin_transaction():
                context.run_migrations()

                # THE COVERAGE ASSERTION, INSIDE THE MIGRATION'S OWN
                # TRANSACTION. PLAN §5 rule 4's migration-time half.
                #
                # A migration that creates a tenant-scoped table and forgets
                # `ENABLE`, `FORCE` or the policy raises here, and because this
                # is inside `begin_transaction()` the whole run rolls back with
                # it. Checking after the commit would leave the database in the
                # un-isolated state the check just refused, with
                # `alembic_version` claiming the revision landed.
                #
                # "The whole run rolls back with it" is TRUE only because
                # `_refuse_autocommit_blocks` above shuts the one supported way
                # out of this transaction. Read its docstring before weakening
                # that: it carries the measurement of what the sentence cost
                # while it was merely asserted, and the residual of what it still
                # does not cover.
                #
                # It runs as `titlepipe_owner` — who the `SET ROLE` above made
                # this connection — which reads `pg_class` and `pg_policies` for
                # everything in the schema.
                #
                # WHAT THIS DOES NOT CATCH, and why `lifespan.py` runs the same
                # check again at boot: a table that arrived by any path that was
                # not this one. This only ever inspects a database somebody
                # migrated, so it catches the author who used the migration and
                # nobody else.
                _assert_coverage_at_head(connection)
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

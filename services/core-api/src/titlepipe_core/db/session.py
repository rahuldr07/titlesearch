"""The engine, the sessionmaker, and the only tenant-scoped way to open a session.

**Every database access in every later plan goes through `tenant_session`.** It
exists so that there is no un-scoped path to reach for: a caller cannot obtain an
`AsyncSession` from this package without naming a tenant, and naming `None` is a
deliberate statement that the work is allowed to see nothing.

The tenant is not carried in a `WHERE` clause. It is carried in the session GUC
`app.current_tenant`, which revision `0002`'s `tenant_isolation` policies read on
all seven tables — so the scoping survives a query somebody forgot to filter, and
it survives a query nobody in this repository wrote.

## The four things that go wrong here, each measured

**1. `SET LOCAL` outside a transaction is a no-op that reports success.**
MEASURED 2026-08-05 against postgres:18.4, on an idle connection:

    SET LOCAL app.current_tenant = '1111…';
    WARNING:  SET LOCAL can only be used in transaction blocks
    SET

A `WARNING` is not an error, psycopg raises nothing for it, and
`ON_ERROR_STOP` never sees one. So a tenant applied outside a transaction is a
tenant that was never applied, reported as applied. That is why the value is set
from `after_begin` — an event that, by definition, cannot fire outside one.

**2. A SAVEPOINT unwinds the GUC.** `scripts/check_backend_rules.py` bans
`begin_nested(` in `src/` for exactly this, and this module is the reason the
rule has a subject. Roll a savepoint back and `app.current_tenant` reverts to
whatever it held when the savepoint opened, so the next statement in the same
transaction runs under the wrong tenant — or under none, which is a denial where
the caller expects rows. Tests may use savepoints; `tests/` is not scanned.

**3. `after_begin` IS ORM-ONLY, AND THE GAP IS REAL RATHER THAN THEORETICAL.**
MEASURED 2026-08-05 against SQLAlchemy 2.0.51 — `after_begin` is absent from both
`ConnectionEvents` and `PoolEvents`:

    sorted(n for n in dir(sqlalchemy.events.ConnectionEvents) if "begin" in n)
    -> ['begin', 'begin_twophase']
    sorted(n for n in dir(sqlalchemy.events.PoolEvents) if "begin" in n)
    -> []
    hasattr(sqlalchemy.events.ConnectionEvents, "after_begin")  -> False
    hasattr(sqlalchemy.events.PoolEvents, "after_begin")        -> False

`ConnectionEvents` *does* have `begin`, which is the trap: someone reading that
list can conclude they are covered at Core level and not be. Nothing below the
ORM applies the tenant, so **a raw `engine.connect()`, Alembic, and any future
queue worker bypass this listener entirely.** They are not thereby unscoped —
they are DENIED, because `_DENY_SENTINEL_OPTIONS` below pins every connection at
the deny sentinel the moment libpq opens it. A path that skips the ORM sees
nothing rather than seeing everything, which is the direction to fail in.

**4. `PGOPTIONS` can preset the GUC to a valid tenant.** MEASURED 2026-08-05
against postgres:18.4, connected as `titlepipe_app`:

    PGOPTIONS='-c app.current_tenant=33333333-3333-3333-3333-333333333333'
    create_async_engine("postgresql+psycopg://…")                    -> '3333…'
    make_engine("postgresql+psycopg://…")                            -> ''

The preset is CONNECTION-scoped, so it survives `SET LOCAL` plus a rollback on a
pooled connection: a later isolation proof could then report a pass against a
connection that was never denied anything. `tests/conftest.py` strips the whole
`PG*` family from the pytest process, but that is the harness protecting itself;
`connect_args` here is the property of the *application*, and it is what makes a
pooled connection start denied on a box nobody scrubbed.
`tests/test_tenant_session.py::test_make_engine_pins_a_fresh_connection_at_the_
deny_sentinel_even_under_pgoptions` exports the variable on purpose and asserts
the unpinned control picks it up, so neither half is assumed.

## Why `''` and not NULL, and why that is this module's own footprint

`current_setting(x, true)` answers NULL for a GUC that was never assigned in the
session and `''` for one that was assigned and has since reverted — and
`set_config(…, is_local => true)` reverting at COMMIT is precisely what produces
the second. So the `nullif(…, '')` in every `0002` policy is not guarding a
hypothetical: it is guarding what this file does to a pooled connection on every
request after the first. `''::uuid` raises `invalid input syntax for type uuid:
""`, which is a 500 where a denial belongs; `nullif` is what makes the two
absences one.

`_DENY_SENTINEL_OPTIONS` moves a *fresh* connection into the `''` case as well,
so the two are the same state rather than two states a reader has to keep apart.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Final

from sqlalchemy import Connection, event, func, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session, SessionTransaction

from titlepipe_domain import TENANT_GUC, TenantId, tenant_guc_value

# The libpq `options` string every connection this application opens is made
# with. `-c <guc>=` assigns the GUC the empty string at connection start, which
# is the deny sentinel; only a `SET`/`set_config` can move it afterwards.
#
# libpq's `options` CONNECTION PARAMETER is the thing `PGOPTIONS` is merely the
# DEFAULT for, which is the mechanism that makes this win — see point 4 above.
_DENY_SENTINEL_OPTIONS: Final = f"-c {TENANT_GUC}="

# `set_config(setting_name text, new_value text, is_local boolean)` — PostgreSQL
# defines EXACTLY ONE signature. There is no two-argument form. MEASURED
# 2026-08-05 against postgres:18.4:
#
#     SELECT set_config('app.current_tenant', 'x');
#     42883 function set_config(unknown, unknown) does not exist
#
# `True` is `is_local`, and it is the whole of the pooled-connection story: with
# it the value reverts at COMMIT to the `''` this connection started at; without
# it the value is session-scoped and the NEXT checkout of the same pooled
# connection begins already holding the previous request's tenant.
#
# A plain (non-local) `SET` is still TRANSACTIONAL, which is why the leak only
# appears on the committing path — and the committing path is the ordinary one.
# MEASURED on one connection, `is_local => false` throughout:
#
#     set_config(…, '1111…', false); current_setting(…)   -> '1111…'
#     ROLLBACK;                      current_setting(…)   -> ''
#     set_config(…, '1111…', false); COMMIT;
#                                    current_setting(…)   -> '1111…'
_SET_CONFIG_IS_LOCAL: Final = True


def make_engine(dsn: str, *, pool_size: int = 5, max_overflow: int = 10) -> AsyncEngine:
    """An `AsyncEngine` whose every connection starts at the tenant deny sentinel.

    `pool_size` and `max_overflow` are BOTH exposed, and `max_overflow` is the one
    that is easy to leave out. A test that has to prove something about connection
    REUSE — that the GUC did not survive a commit onto a pooled connection — needs
    the pool to be able to hand back exactly one connection, and `pool_size=1`
    alone does not do that: the default `max_overflow=10` lets the pool open ten
    more on demand, so the second checkout may be a brand-new connection that was
    never poisoned and the assertion passes for the wrong reason. `pool_size=1,
    max_overflow=0` is the only spelling of "the same connection, twice", and it
    is unreachable if this signature does not carry the second parameter.

    `connect_args` is not optional and not configurable. See point 4 of the module
    docstring for the measurement: without it an exported `PGOPTIONS` presets the
    GUC to a valid tenant, connection-scoped, and the deny floor this whole design
    rests on is simply gone.
    """
    return create_async_engine(
        dsn,
        pool_size=pool_size,
        max_overflow=max_overflow,
        connect_args={"options": _DENY_SENTINEL_OPTIONS},
    )


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """The factory `tenant_session` calls. One per engine, built once at startup.

    `expire_on_commit=False`, which is a decision rather than a copied default.
    `tenant_session` commits as it exits, and the default `True` expires every
    loaded attribute at that moment — so the first attribute read AFTER the
    `async with` block issues a lazy refresh against a session that is by then
    closed. MEASURED 2026-08-05, one `Order` loaded inside a `tenant_session` and
    its `id` read one line after the block:

        expire_on_commit=True   -> DetachedInstanceError: Instance <Order at …>
                                   is not bound to a Session; attribute refresh
                                   operation cannot proceed
        expire_on_commit=False  -> 0775fe45-39de-4b0a-a8db-bfe18cb599cb

    An object handed back out of a scoped session has to stay readable, so the
    attributes are left populated.
    """
    return async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def tenant_session(
    sessionmaker: async_sessionmaker[AsyncSession], tenant: TenantId | None
) -> AsyncGenerator[AsyncSession]:
    """A session whose every transaction runs as `tenant`. `None` means deny.

    🔴 THE RETURN ANNOTATION IS `AsyncGenerator`, NOT THE `AsyncIterator` THIS
    SIGNATURE WAS SPECIFIED WITH, and the change is forced rather than chosen.
    typeshed deprecated the `AsyncIterator`-returning overload of
    `@asynccontextmanager`, and pyright reports it in strict mode. MEASURED
    2026-08-05 against pyright 1.1.411:

        error: The function "asynccontextmanager" is deprecated
          Annotating the return type as `-> AsyncIterator[Foo]` with
          `@asynccontextmanager` is deprecated. Use `-> AsyncGenerator[Foo]`
          instead. (reportDeprecated)

    Nothing a CALLER sees changes: the decorator's result is an
    `_AsyncGeneratorContextManager[AsyncSession]` either way, and
    `async with tenant_session(...) as session:` binds an `AsyncSession` in both
    spellings. The alternative was a `# pyright: ignore`, which
    `scripts/check_backend_rules.py` bans outright.

    `tenant=None` IS LEGAL AND IS NOT AN ERROR PATH. It encodes to the empty
    string, `nullif` turns that into NULL, no row satisfies any policy, and the
    session sees nothing. That is what a health check wants — it needs to know the
    database answers, not what is in it — and making it say so explicitly is
    cheaper than a second door into the pool that nobody scoped.

    ## The order of the three statements below is the design

    `tenant_guc_value(tenant)` runs FIRST, before a session object exists. It
    parses the UUID rather than trusting the annotation — `TenantId` is a
    `NewType` and erased at runtime — so a malformed tenant raises `ValueError`
    here, one call before the database, with no session to close and no
    transaction to abort. Reaching the server with a non-UUID would instead abort
    the statement on `::uuid` and turn a bad argument into a 500.

    The listener is attached SECOND, before anything can execute, because
    `after_begin` fires on the first statement and a listener attached after that
    would miss the transaction it was meant to scope.

    ## Why `after_begin` and not `SET LOCAL` at the top

    A `SET LOCAL` issued before a transaction exists is a WARNING and a no-op that
    reports success — point 1 of the module docstring, measured. `after_begin`
    cannot be reached outside a transaction, so the failure is not available. It
    also fires AGAIN on each subsequent transaction: a caller who commits mid-block
    gets the tenant re-applied on the next statement rather than silently
    continuing under the reverted `''`.

    The listener goes on `session.sync_session`. SQLAlchemy's ORM events are
    defined on the sync `Session`; `AsyncSession` is a façade over one, and
    attaching to the façade is not the documented seam.

    ## Commit on exit, rollback on anything else

    The block is a unit of work. A clean exit commits; an exception propagates
    with the transaction discarded by `close()`. This is not decoration: it is
    what makes `is_local=True` observable, because a GUC set with `is_local` only
    reverts at COMMIT, and a session that never committed would never exercise the
    reuse case that `tests/test_tenant_session.py` pins.

    `close()` is in a `finally` and runs whatever happened, including when
    `commit()` is what raised.
    """
    guc_value = tenant_guc_value(tenant)
    session = sessionmaker()

    def _apply_tenant(
        _session: Session, _transaction: SessionTransaction, connection: Connection
    ) -> None:
        connection.execute(select(func.set_config(TENANT_GUC, guc_value, _SET_CONFIG_IS_LOCAL)))

    event.listen(session.sync_session, "after_begin", _apply_tenant)

    try:
        yield session
        await session.commit()
    finally:
        await session.close()

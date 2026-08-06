"""The engine, the pool and the sessionmaker: the floor a connection starts and ends at.

**Split out of `session.py` on 2026-08-06, and the reason is the length cap.**
`session.py` stood at exactly 400 lines — `scripts/check_backend_rules.py` rule
6's maximum — so the next line anybody added to the most security-critical
module in the tree would have tripped the gate, and the cheap way out is a
`rules-allow-file(file-length)` on precisely the file that must stay reviewable.
This module takes the CONNECTION-lifetime half of that file: what a connection
is opened with, and what is done to it as it goes back to the pool.
`session.py` keeps the TRANSACTION-lifetime half, which is `tenant_session`.

**No caller's import line changed.** `make_engine` and `make_sessionmaker` are
re-exported from `titlepipe_core.db` exactly as before, which is the import
every caller outside this package uses. The one module that reaches past the
package `__init__` is `migrations/env.py`, which needs `DENY_SENTINEL_OPTIONS`
— deliberately not re-exported, because `__init__` re-exports what a caller
needs to reach the database and one libpq connection parameter is not that — and
that import now names this module instead of `session`.

## The deny floor has two halves, and each is needed for what the other misses

A connection this application opens must never be able to see a tenant's rows
without somebody having said which tenant. Two mechanisms hold that, at
different moments, and neither covers the other's case:

* **`connect_args` pins at OPEN.** `DENY_SENTINEL_OPTIONS` assigns the GUC the
  empty string as the connection starts. It fires ONCE PER CONNECTION, and the
  pool reuses connections, so it says nothing about a connection's second life.
* **`_restore_deny_sentinel` `RESET`s at CHECKIN.** It is the only thing in this
  tree that reverts a NON-local `set_config`. `is_local=True` — `session.py`'s
  `_SET_CONFIG_IS_LOCAL` — reverts only the value it set itself, and
  `session.py`'s opening records the measurement showing an injected sub-select
  is free to write the GUC non-locally in one statement, with no ACL that could
  be revoked to stop it.

Deleting either one leaves a real hole, and each is pinned by its own test in
`tests/test_tenant_session.py`. The `checkin` listener is the stronger of the
two — it puts the GUC back whatever happened to it — and that strength is a
hazard for the test suite rather than for the system: a `RESET` on checkin makes
the pooled connection read the sentinel however the value got there, which masks
`is_local=True` entirely. `test_is_local_true_alone_reverts_the_tenant_at_commit
_with_the_checkin_listener_detached` is the test that detaches the listener for
its own duration so the layer beneath it is still measured.

## 1. `PGOPTIONS` can preset the GUC to a valid tenant

MEASURED 2026-08-05 against postgres:18.4, connected as `titlepipe_app`:

    PGOPTIONS='-c app.current_tenant=33333333-3333-3333-3333-333333333333'
    create_async_engine("postgresql+psycopg://…")                    -> '3333…'
    make_engine("postgresql+psycopg://…")                            -> ''

The preset is CONNECTION-scoped, so it survives `SET LOCAL` plus a rollback on a
pooled connection. `tests/conftest.py` strips the whole `PG*` family from the
pytest process, but that is the harness protecting itself; `connect_args` here is
the *application's* own. `tests/test_tenant_session.py::test_make_engine_pins_a_
fresh_connection_at_the_deny_sentinel_even_under_pgoptions` exports the variable
on purpose and asserts the unpinned control picks it up.

## 2. The pin reaches exactly the engines `make_engine` builds

`after_begin` is an ORM event — see `session.py`, point 3 — so a raw
`engine.connect()`, Alembic and any future queue worker never have a tenant
applied. They are not thereby unscoped: they are DENIED, which is the direction
to fail in. BUT NOT BY THE SAME LINE OF CODE. The pin is a property of
`make_engine`'s `connect_args`, so `migrations/env.py` — which builds its own
engine with `engine_from_config(...)` — gets nothing from it. Alembic is pinned
only because it ASKS: that `engine_from_config(...)` call passes
`connect_args={"options": DENY_SENTINEL_OPTIONS}`, importing the constant rather
than respelling it, two copies of a libpq `options` string being two things to
keep in step. (This cited `env.py:247` and the call is at 256 — a line number is
a cross-reference that goes stale without anybody editing either end, so it is
named rather than numbered.) Without that argument its connection reads NULL unpoisoned and
`'1111…'` under `PGOPTIONS`, and a data migration then reports `UPDATE 1` where
`0001`, `0002` and `test_forced_rls_and_grants.py` state the invariant
unconditionally as **0** — a non-zero count reads as success, having silently
skipped every other tenant. The measurements are on `tests/test_tenant_session.
py::test_the_alembic_engine_is_pinned_at_the_deny_sentinel_even_under_pgoptions`,
which drives a real `alembic` command with the variable exported.

## Why the sentinel is `''` and not NULL

`current_setting(x, true)` answers NULL for a GUC never assigned in the session
and `''` for one assigned and since reverted. `DENY_SENTINEL_OPTIONS` and
`_RESET_TENANT_SQL` both put a connection in the second case, and so does
`is_local=True` reverting at COMMIT — so all three are ONE state rather than
several a reader has to keep apart. `session.py`'s closing section argues why
that state has to be `nullif`-ed in every `0002` policy rather than cast: `''
::uuid` raises `invalid input syntax for type uuid: ""`, a 500 where a denial
belongs.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy import event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from titlepipe_domain import TENANT_GUC

# The libpq `options` string every connection this application opens is made
# with. `-c <guc>=` assigns the GUC the empty string at connection start, which
# is the deny sentinel; only a `SET`/`set_config` can move it afterwards.
#
# libpq's `options` CONNECTION PARAMETER is the thing `PGOPTIONS` is merely the
# DEFAULT for, which is the mechanism that makes this win — see point 1 above.
#
# PUBLIC, AND THE UNDERSCORE CAME OFF FOR ONE CALLER OUTSIDE THIS PACKAGE:
# `migrations/env.py`, which builds its own engine and so gets no pin from
# `make_engine` — point 2 above. Deliberately NOT re-exported from
# `titlepipe_core.db.__init__`, which re-exports what a caller needs in order to
# reach the database; one connection parameter is not that.
DENY_SENTINEL_OPTIONS: Final = f"-c {TENANT_GUC}="

# Re-applied to every connection as it returns to the pool — see
# `_restore_deny_sentinel`. `RESET` and not `set_config(…, '', false)`, because
# `RESET` restores the value the CONNECTION STARTED AT, so it re-applies whatever
# `DENY_SENTINEL_OPTIONS` said instead of respelling the sentinel and the two
# cannot drift apart. MEASURED 2026-08-06 against postgres:18.4, the second line
# being the control that says the restored value is the connect-time one and not
# the placeholder's boot default:
#
#     -c app.current_tenant=       set 'x', RESET -> ''
#     -c app.current_tenant=ZZZZ   set 'x', RESET -> 'ZZZZ'
#
# Interpolated because a GUC name is an identifier and has no bind parameter;
# `TENANT_GUC` is a constant, so nothing user-supplied reaches this string.
_RESET_TENANT_SQL: Final = f"RESET {TENANT_GUC}"


def make_engine(dsn: str, *, pool_size: int = 5, max_overflow: int = 10) -> AsyncEngine:
    """An `AsyncEngine` whose every connection starts at the tenant deny sentinel.

    `pool_size` and `max_overflow` are BOTH exposed, and `max_overflow` is the one
    easy to leave out. Every test that proves something about connection REUSE
    needs the pool to hand back exactly one connection, and `pool_size=1` alone
    does not: the default `max_overflow=10` lets the pool open ten more on demand,
    so the second checkout may be a brand-new connection that was never poisoned
    and the assertion passes for the wrong reason. `pool_size=1, max_overflow=0`
    is the only spelling of "the same connection, twice".

    `connect_args` is not optional or configurable — point 1 of the module
    docstring: without it an exported `PGOPTIONS` presets the GUC to a valid
    tenant, connection-scoped, and the deny floor is gone. But it FIRES ONCE PER
    CONNECTION AND THE POOL REUSES CONNECTIONS, so the `checkin` listener is the
    other half of the same floor: a non-local `set_config` is reverted by nothing.
    """
    engine = create_async_engine(
        dsn,
        pool_size=pool_size,
        max_overflow=max_overflow,
        connect_args={"options": DENY_SENTINEL_OPTIONS},
    )
    event.listen(engine.sync_engine.pool, "checkin", _restore_deny_sentinel)
    return engine


def _restore_deny_sentinel(
    dbapi_connection: DBAPIConnection | None, _entry: ConnectionPoolEntry
) -> None:
    """Put the GUC back to its connect-time value as the connection returns.

    Nothing else reverts a NON-local `set_config` — not `connect_args`, which pins
    at open, nor `is_local=True`, which reverts only what it set.

    `dbapi_connection` IS OPTIONAL AND THE `None` IS REAL: `PoolEvents.checkin`
    documents it as "may be None if the connection has been invalidated", and
    MEASURED 2026-08-06 with the backend terminated it is exactly None. Returning
    early is correct: an invalidated entry reconnects through `connect_args`.

    No `try`/`except`: a live connection that cannot `RESET` must not be handed to
    the next request, and swallowing that would return one carrying an unknown
    tenant to the pool. The dead-connection case is unreachable anyway — MEASURED
    2026-08-06, a terminated backend fails in the pool's OWN reset rollback first.

    The explicit `commit()` is not decoration: `RESET` is transactional and psycopg
    opens a transaction for it, so without it the connection would sit idle-in-
    transaction and the next checkin's rollback would undo the reset. MEASURED
    2026-08-06 with it in place: `pg_stat_activity.state` reads `'idle'`.

    IT IS ALSO STRONG ENOUGH TO HIDE THE LAYER BENEATH IT, which is a property of
    the test suite rather than of this function. Because it `RESET`s whatever the
    value is, a pooled connection reads the sentinel on its next checkout even
    when `is_local=True` has been flipped off — see the module docstring, and the
    test that detaches this listener so the flip is still caught.
    """
    if dbapi_connection is None:
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute(_RESET_TENANT_SQL)
    finally:
        cursor.close()
    dbapi_connection.commit()


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """The factory `tenant_session` calls. One per engine, built once at startup.

    WHAT IT RETURNS IS AN UNSCOPED DOOR, and that is stated rather than hidden:
    calling the sessionmaker yourself gives a session no listener is attached to,
    which runs at the deny sentinel and sees nothing. Pass it to `tenant_session`.

    `expire_on_commit=False`, a decision rather than a copied default.
    `tenant_session` commits as it exits and the default `True` expires every
    loaded attribute at that moment, so the first attribute read AFTER the block
    issues a lazy refresh against a session that is by then closed. MEASURED
    2026-08-05, one `Order` loaded inside a `tenant_session`, `id` read after:

        expire_on_commit=True   -> DetachedInstanceError: Instance <Order at …>
                                   is not bound to a Session; attribute refresh
                                   operation cannot proceed
        expire_on_commit=False  -> 0775fe45-39de-4b0a-a8db-bfe18cb599cb

    An object handed back out of a scoped session has to stay readable.
    """
    return async_sessionmaker(engine, expire_on_commit=False)

"""`tenant_session` — the only tenant-scoped way to open a session.

**Every database access in every later plan goes through `tenant_session`.** It
is the only thing here that SCOPES a session: it names a tenant, applies it, and
naming `None` says the work is allowed to see nothing.

The CONNECTION-lifetime half of this seam — `make_engine`, the pool's `checkin`
listener, `make_sessionmaker` and the deny sentinel a connection is opened and
returned at — moved to `engine.py` on 2026-08-06, because this file stood at
exactly the 400-line cap `scripts/check_backend_rules.py` rule 6 enforces. No
caller's import line changed: `titlepipe_core.db` re-exports all three names as
it did before. `engine.py`'s opening states the split and what went with it.

🔴 IT IS NOT THE ONLY WAY TO OBTAIN AN `AsyncSession`, AND THIS PARAGRAPH SAID IT
WAS — "a caller cannot obtain an `AsyncSession` from this package without naming
a tenant". `make_sessionmaker` is in `titlepipe_core.db.__all__` and an
`async_sessionmaker` is callable. THE EXPORT STAYS, because an application builds
one sessionmaker at startup and hands it to `tenant_session` per request, so
deleting it would remove the sign rather than the door. Holding a sessionmaker is
holding an UNSCOPED door, opening onto the deny sentinel rather than onto
everything — see `engine.make_sessionmaker`, and `repository.py` for the refusal.

The tenant is not carried in a `WHERE` clause. It is carried in the session GUC
`app.current_tenant`, which revision `0002`'s `tenant_isolation` policies read on
all seven tables — so the scoping survives a query somebody forgot to filter.

🔴 IT DOES NOT SURVIVE A QUERY SOMEBODY CONCATENATED, and an earlier version of
this paragraph claimed it did ("it survives a query nobody in this repository
wrote"). A custom placeholder GUC carries no ACL, so `set_config` on it is
callable by every role — `0002` records "any role can `SET` its own custom GUC"
as the argument against a migration-bypass policy. MEASURED 2026-08-06 against
postgres:18.4 as `titlepipe_app`, tenant `1111…` established by the listener
below, in ONE statement with no stacked queries and no second round trip:

    -- one line earlier, same session: SELECT id FROM orders
    --   -> ['eb1b546f-af92-40a7-8cb8-e3537c1ec5d2']   (this tenant's only row)
    SELECT id, tenant_id FROM orders
      WHERE (SELECT set_config('app.current_tenant', '2222…', true)) IS NOT NULL;
    -> 5d16bcc1-ff11-4439-9088-94aed0a963b0 | 22222222-…
    -- and afterwards, still inside the block:
    current_setting('app.current_tenant', true)  -> '2222…'

That row belongs to the other tenant, and the session went on holding the other
tenant's id for the rest of the transaction. There is no PostgreSQL-side fix: a
custom GUC has no ACL to revoke, so nothing can be taken from `titlepipe_app`.

🔴 IT OUTLIVED THE REQUEST TOO, AND THAT HALF IS NOW CLOSED. Neither
`is_local=True` (which reverts at commit) nor `connect_args` (which pins at open)
touches a value written by a NON-local `set_config`, which the sub-select above
is free to write, so it stayed on the pooled connection for the next checkout.
MEASURED 2026-08-06, `pool_size=1, max_overflow=0`, same backend both times:
`set_config(…,'2222',false)`, commit, exit; the next checkout read `'2222'`.
`engine._restore_deny_sentinel` now `RESET`s the GUC on `checkin`, and the same
measurement with it attached reads `''`.

So state the guarantee at the size it is. RLS here defends against a FORGOTTEN
`WHERE` clause, not a concatenated one, and the in-transaction leak has no fix at
all. Parameterisation in Plans 02-06 is load-bearing on its own rather than
belt-and-braces on a policy, and a review that waves an injection through because
"RLS would catch it" is waving through a cross-tenant read.

## The three things that go wrong here, each measured

**1. `SET LOCAL` outside a transaction is a no-op that reports success.**
MEASURED 2026-08-05 against postgres:18.4, on an idle connection:

    SET LOCAL app.current_tenant = '1111…';
    WARNING:  SET LOCAL can only be used in transaction blocks
    SET

A `WARNING` is not an error, psycopg raises nothing for it, and `ON_ERROR_STOP`
never sees one. A tenant applied outside a transaction is a tenant that was never
applied, reported as applied — which is why the value is set from `after_begin`,
an event that by definition cannot fire outside one.

**2. A SAVEPOINT unwinds the GUC — AND UNDER THIS DESIGN THAT IS HARMLESS.**
🔴 THE MECHANISM SENTENCE WAS RIGHT AND THE CONSEQUENCE DRAWN FROM IT WAS WRONG.
It read: "Roll a savepoint back and `app.current_tenant` reverts to whatever it
held when the savepoint opened, so the next statement in the same transaction
runs under the wrong tenant — or under none." The first clause is correct; the
second does not follow. MEASURED 2026-08-06 against postgres:18.4:

    set BEFORE the savepoint, which is what `after_begin` does:
      set_config(…,'AAAA',true) -> SAVEPOINT -> ROLLBACK TO  -> 'AAAA'
    set INSIDE the savepoint:
      'OUTER' -> set 'INNER'    -> ROLLBACK TO               -> 'OUTER'

`after_begin` establishes the tenant on the OUTER transaction, so "whatever it
held when the savepoint opened" **is** the tenant and the next statement runs
under the right one.

🔴 IT ALSO FIRES ON THE NESTED TRANSACTION, WHICH THIS PARAGRAPH USED TO DENY
("before a nested block can exist"). RE-MEASURED 2026-08-06 against SQLAlchemy
2.0.51 — one `after_begin` handler, one `SELECT`, one `begin_nested()`, one more
`SELECT`, recording `transaction.nested` each time it fired:

    transaction.nested, in firing order   -> [False, True]

So `_apply_tenant` runs a SECOND time, inside the savepoint, and writes the GUC
again. It is harmless for exactly one reason — the value is identical, so the
value `ROLLBACK TO` restores is the value the second write also wrote. That is a
coupling, not a fact: the same run measured the two designs that break it, both
of which are one edit away from this file.

    a handler that writes a DIFFERENT value when `transaction.nested`:
      before 'AAAA' -> inside '9999' -> after ROLLBACK TO 'AAAA'
        (the rollback restores the tenant, but every statement INSIDE the
         savepoint ran as somebody else)
    a handler that fires ONLY when `transaction.nested`:
      before ''     -> inside 'AAAA' -> after ROLLBACK TO ''
        (the tenant exists only inside the savepoint and unwinds to deny)

`scripts/check_backend_rules.py` bans `begin_nested(` in `src/` and the ban
STAYS. Its reason is stated there, once, under rule 2 — a savepoint around a
write RLS refused does not leak, it ERASES, and the measurement of that is the
gate's. This module does not restate it; the two files used to give two different
reasons for the same ban and this is the reconciliation. What this module
contributes is the coupling above: the ban is also what keeps `src/` from ever
executing the nested `after_begin` path that only the equality of two writes
makes safe. Tests may use savepoints anyway — `tests/` is not scanned, and
`tests/test_tenant_isolation.py`'s assertion 4 exercises a real one.

**3. `after_begin` IS ORM-ONLY, AND THE GAP IS REAL RATHER THAN THEORETICAL.**
MEASURED 2026-08-05 against SQLAlchemy 2.0.51 — `after_begin` is absent from both
`ConnectionEvents` and `PoolEvents`:

    sorted(n for n in dir(sqlalchemy.events.ConnectionEvents) if "begin" in n)
    -> ['begin', 'begin_twophase']
    sorted(n for n in dir(sqlalchemy.events.PoolEvents) if "begin" in n)
    -> []

`ConnectionEvents` *does* have `begin`, which is the trap: someone reading that
list can conclude they are covered at Core level and not be. Nothing below the
ORM applies the tenant, so **a raw `engine.connect()`, Alembic, and any future
queue worker bypass this listener entirely.** They are not thereby unscoped —
they are denied, which is the direction to fail in. EVERY ONE OF THEM IS DENIED,
BUT NOT BY THE SAME LINE OF CODE, and `engine.py`'s point 2 is where that is
worked through: the pin is a property of `make_engine`'s `connect_args`, and
`migrations/env.py` builds its own engine and has to ask for it by name.

## Why `''` and not NULL, and why that is this module's own footprint

`current_setting(x, true)` answers NULL for a GUC never assigned in the session
and `''` for one assigned and since reverted — and `set_config(…, is_local =>
true)` reverting at COMMIT is precisely what produces the second. So the
`nullif(…, '')` in every `0002` policy is not guarding a hypothetical: it is
guarding what this file does to a pooled connection on every request after the
first. `''::uuid` raises `invalid input syntax for type uuid: ""`, a 500 where a
denial belongs; `nullif` is what makes the two absences one.

`engine.py`'s `DENY_SENTINEL_OPTIONS` and `_RESET_TENANT_SQL` move a fresh and a
returned connection into the `''` case too, so all of them are one state rather
than several a reader must keep apart — for `make_engine`'s connections and, via
the `connect_args` it passes for itself, for `migrations/env.py`'s.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Final

from sqlalchemy import Connection, event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import Session, SessionTransaction

from titlepipe_domain import TENANT_GUC, TenantId, tenant_guc_value

# What `tenant_session` writes into `Session.info`, and the only thing telling a
# scoped session apart from one opened straight off a sessionmaker;
# `TenantRepository.__init__` refuses a session without it. NOT the tenant:
# storing the id would make `session.info` a second, un-enforced answer to "which
# tenant is this?" when the answer that governs is the GUC on the connection.
# Dotted and prefixed because `Session.info` is documented as user space, and a
# bare `"tenant"` is one collision away from a later plan's bookkeeping.
TENANT_SCOPED_MARK: Final = "titlepipe.tenant_scoped"

# `set_config(setting_name text, new_value text, is_local boolean)` — PostgreSQL
# defines EXACTLY ONE signature. There is no two-argument form. MEASURED
# 2026-08-05 against postgres:18.4:
#
#     SELECT set_config('app.current_tenant', 'x');
#     42883 function set_config(unknown, unknown) does not exist
#
# `True` is `is_local`: the value reverts at COMMIT to the `''` this connection
# started at. Without it the NEXT checkout of the same pooled connection begins
# holding the previous request's tenant — which is why
# `engine._restore_deny_sentinel` exists for the caller this flag cannot reach,
# an injected `set_config` passing `false` itself.
#
# A non-local `SET` is still TRANSACTIONAL, so the leak appears only on the
# committing path — the ordinary one. MEASURED, `is_local => false` throughout:
#
#     set_config(…, '1111…', false); current_setting(…)   -> '1111…'
#     ROLLBACK;                      current_setting(…)   -> ''
#     set_config(…, '1111…', false); COMMIT;
#                                    current_setting(…)   -> '1111…'
#
# THE `checkin` LISTENER HIDES THIS FLAG FROM THE SUITE, and that is why one test
# takes the listener off. `engine._restore_deny_sentinel` `RESET`s the GUC on
# every return to the pool, whatever put it there, so flipping this to `False`
# leaves every reuse assertion in the suite green. `tests/test_tenant_session.py
# ::test_is_local_true_alone_reverts_the_tenant_at_commit_with_the_checkin_
# listener_detached` detaches it for its own duration and restores it in a
# `finally`, which is what keeps this line pinned.
_SET_CONFIG_IS_LOCAL: Final = True


@asynccontextmanager
async def tenant_session(
    sessionmaker: async_sessionmaker[AsyncSession], tenant: TenantId | None
) -> AsyncGenerator[AsyncSession]:
    """A session whose every transaction runs as `tenant`. `None` means deny.

    🔴 THE RETURN ANNOTATION IS `AsyncGenerator`, NOT THE `AsyncIterator` THIS
    SIGNATURE WAS SPECIFIED WITH, and the change is forced. MEASURED 2026-08-05
    against pyright 1.1.411, strict:

        error: The function "asynccontextmanager" is deprecated
          Annotating the return type as `-> AsyncIterator[Foo]` with
          `@asynccontextmanager` is deprecated. Use `-> AsyncGenerator[Foo]`
          instead. (reportDeprecated)

    A caller sees nothing either way — both spellings decorate to an
    `_AsyncGeneratorContextManager[AsyncSession]` — and the alternative was a
    `# pyright: ignore`, which `scripts/check_backend_rules.py` bans outright.

    `tenant=None` IS LEGAL AND IS NOT AN ERROR PATH. It encodes to the empty
    string, `nullif` turns that into NULL, no row satisfies any policy, and the
    session sees nothing — which is what a health check wants.

    ## The order of the four statements below is the design

    `tenant_guc_value(tenant)` runs FIRST, before a session object exists. It
    parses the UUID rather than trusting the annotation — `TenantId` is a
    `NewType`, erased at runtime — so a malformed tenant raises `ValueError` here,
    one call before the database, with no session to close and no transaction to
    abort. Reaching the server with a non-UUID would abort the statement on
    `::uuid` and turn a bad argument into a 500.

    `TENANT_SCOPED_MARK` is written SECOND, and it is the only thing that says
    afterwards where this session came from. `TenantRepository.__init__` refuses a
    session without it, which turns "a repository is built around a scoped
    session" from a convention into a check — see `repository.py`. It goes on the
    session and not the connection, because a repository is handed a session.

    The listener is attached THIRD, before anything can execute: `after_begin`
    fires on the first statement, and one attached later would miss the
    transaction it was meant to scope.

    ## Why `after_begin` and not `SET LOCAL` at the top

    A `SET LOCAL` issued before a transaction exists is a WARNING and a no-op that
    reports success — point 1 of the module docstring, measured. `after_begin`
    cannot be reached outside a transaction, so that failure is not available. It
    also fires AGAIN on each subsequent transaction, so a caller who commits
    mid-block gets the tenant re-applied rather than continuing under `''` — and
    on NESTED transactions as well, `transaction.nested == True`, which point 2
    measures and which is safe only because `_apply_tenant` writes the same value
    every time it runs.

    It goes on `session.sync_session`: SQLAlchemy's ORM events are defined on the
    sync `Session`, and `AsyncSession` is a façade over one.

    ## Commit on exit, rollback on anything else

    The block is a unit of work. A clean exit commits; an exception propagates
    with the transaction discarded by `close()`, which is in a `finally` and runs
    whatever happened — including when `commit()` is what raised.

    THE COMMIT IS LOAD-BEARING, and the reason is Plan 01's amendment 2 to the
    Task 5 contract that Plans 02-06 read: this block COMMITS ON CLEAN EXIT. If it
    silently stops, every write in those plans is rolled back by `close()` and
    every handler still returns 200 — a mutation that removes the persistence layer
    and changes no response. It is NOT about making `is_local=True` observable:
    `is_local` reverts at rollback too and `close()` rolls back, so the reuse test
    reads the same `''` either way. Two tests fail for it and no others — see
    `tests/test_tenant_session.py::test_a_row_written_in_one_tenant_session_is_
    readable_from_the_next`, which carries the measurement and the second witness.
    """
    guc_value = tenant_guc_value(tenant)
    session = sessionmaker()
    session.info[TENANT_SCOPED_MARK] = True

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

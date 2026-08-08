"""`db/health.check_database` and `lifespan.probe_database` — the readiness probe.

Two things this file exists for, and both were unpinned when it was written.

## 1. The `SELECT 1` was held up by nothing

MEASURED in two steps against the tree as it stood:

    delete the statement, keep `engine.connect()`   ->  243 passed
    delete the `connect()` too                      ->  1 failed

So the CONNECT was pinned — by `test_rules_endpoint.py`'s dead-port test, which
cannot open a socket at all — and the STATEMENT, which `db/health.py` spends
twelve lines arguing is the thing that separates a live server from "a standby
that accepts sessions and refuses reads", was pinned by nothing. The module's
whole argument was the part a reader could not rely on.

`test_the_probe_issues_a_statement_and_not_only_a_checkout` closes it, and its
control is in the same test.

🔴 IT CLOSES IT BY OBSERVING THE STATEMENT, NOT BY FINDING A SERVER STATE, AND
THE FIRST ATTEMPT AT THE LATTER WAS WRONG IN AN INSTRUCTIVE WAY. The obvious
behavioural case is a pooled connection whose backend the server has terminated:
the checkout succeeds — SQLAlchemy does not ping on checkout by default — so only
a statement should notice. It was written, run, and MEASURED, and the control
half raised:

    async with engine.connect():        # a checkout and nothing else
        pass
    -> psycopg.errors.AdminShutdown, from db/engine.py:199,
       inside `_restore_deny_sentinel`

**There is no "connect only" on an engine this application builds.** The pool's
`checkin` listener runs `RESET app.current_tenant` on every return, so the wire
is touched whether or not `check_database` executes anything — which means
deleting the `SELECT 1` would leave `check_database` raising anyway, at checkin,
and the test would have passed while proving nothing. That is the same shape as
the hole it was written to close.

So the statement is pinned by OBSERVING it. `_restore_deny_sentinel` uses a raw
DBAPI cursor (`dbapi_connection.cursor()`), which is invisible to SQLAlchemy's
`before_cursor_execute` event — so that event sees exactly what the ORM layer
executes, and it sees nothing at all for a bare checkout. That asymmetry is what
makes the control meaningful.

## 2. The timeout was held up by nothing

MEASURED: replacing `async with asyncio.timeout(...)` with a bare
`await check_database(engine)` left the suite at 243 passed. A closed port RSTs
instantly, so no test in the suite could reach the `TimeoutError` arm.

`test_a_ceiling_the_probe_cannot_meet_is_a_failure_not_a_hang` drives a real
engine against the real container with a ceiling of `0.0`.

🔴 WHAT THAT DOES **NOT** PROVE, stated here so nobody reads more into it.
It proves the bound is APPLIED and the `TimeoutError` arm returns `False`. It
does not prove five seconds is the right number, and it does not reproduce the
blackholed-host scenario `DATABASE_PROBE_TIMEOUT_SECONDS` cites — that needs an
unroutable address, and a suite that assumed one would pass for the wrong reason
on any network that RSTs rather than drops. `lifespan.py` now says the same
thing beside the constant.

## A note on a suggestion that does not work on this cluster

A grant-less role was proposed as the "connect succeeds, statement fails" case.
It is not one. MEASURED — `titlepipe_worker` against a migrated database, the
route's own logs from `test_rules_endpoint.py`: the startup probe SUCCEEDS
(no `database_probe_failed` line) and only the read of `rules` is refused,
because `SELECT 1` reads no table and therefore consults no privilege. That is
`db/health.py`'s deliberate design — a probe that read `rules` would go red for a
missing grant as readily as for a dead server — so the case had to come from
somewhere else. A backend the server has terminated is that somewhere.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from sqlalchemy import Engine, event, text
from sqlalchemy.ext.asyncio import AsyncEngine

from titlepipe_core.db import check_database, make_engine
from titlepipe_core.lifespan import DATABASE_PROBE_TIMEOUT_SECONDS, probe_database

# The statement `db/health.py` must issue, TRANSCRIBED rather than imported.
# Importing it from the module under test would make the assertion below "the
# probe executes whatever the probe executes" — the compare-a-value-to-itself
# family `01-WHAT-HAPPENED.md` §5 records five instances of. This literal is what
# a reader of `db/health.py` sees; if the two ever disagree, one of them is
# wrong and this test says which line to look at.
PROBE_STATEMENT = "SELECT 1"

# A ceiling no real operation can meet. `asyncio.timeout(0.0)` sets the deadline
# at "now", and `engine.connect()` awaits I/O — so it always yields to the loop
# at least once and the timer always fires. Nothing about the database's speed is
# being asserted; what is being asserted is that a ceiling exists at all.
IMPOSSIBLE_CEILING = 0.0


def _record_statements(engine: AsyncEngine, into: list[str]) -> None:
    """Append every statement SQLAlchemy executes on `engine` to `into`.

    `before_cursor_execute` on the SYNC engine, because SQLAlchemy's core events
    are defined there and `AsyncEngine` is a façade over one — the same reason
    `db/session.py` attaches its `after_begin` to `session.sync_session`.

    IT DELIBERATELY DOES NOT SEE `db/engine.py`'s `checkin` listener, and that is
    the property the control below rests on: `_restore_deny_sentinel` runs
    `RESET app.current_tenant` through a RAW DBAPI cursor, which never reaches
    SQLAlchemy's event system. So this list holds what the probe asked for and
    nothing the pool did on its way past.
    """

    def _before_cursor_execute(
        _connection: object,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        into.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", _before_cursor_execute)


@pytest.mark.asyncio
async def test_the_probe_issues_a_statement_and_not_only_a_checkout(
    app_dsn: str, migrated_database: str
) -> None:
    """🔴 THE ASSERTION THAT PINS `SELECT 1`, WITH ITS CONTROL IN THE SAME TEST.

    TWO ENGINES, PREPARED IDENTICALLY, AND THE FIRST IS THE CONTROL. Engine A is
    given a bare `async with engine.connect(): pass` — a checkout and a checkin,
    the whole of what `check_database` would do if its statement were deleted —
    and must record ZERO statements. Engine B is given `check_database` and must
    record exactly one, and it must be the probe.

    Without the control this is an assertion that a list has one element, which
    is satisfied by an event listener that fires on anything; with it, the same
    listener on the same kind of engine demonstrably distinguishes the two cases.

    WHY THIS AND NOT A BROKEN SERVER: the module docstring records the attempt
    and the measurement. There is no server state reachable from this suite in
    which a checkout succeeds and `SELECT 1` fails — the pool's own `checkin`
    touches the wire, so a dead connection fails either way and cannot isolate
    the statement. What CAN be isolated is whether the statement is issued at all,
    and that is what `db/health.py`'s argument turns on.

    The statement's TEXT is asserted, not just the count. A `check_database` that
    issued some other statement would satisfy a count of one, and the argument in
    `db/health.py` is specifically about a one-row `SELECT` that reads no table:
    anything touching a real table would go red for a missing grant as readily as
    for a dead server.
    """
    control = make_engine(app_dsn, pool_size=1, max_overflow=0)
    subject = make_engine(app_dsn, pool_size=1, max_overflow=0)
    control_statements: list[str] = []
    subject_statements: list[str] = []
    try:
        _record_statements(control, control_statements)
        _record_statements(subject, subject_statements)

        # THE CONTROL: a checkout and a checkin, and nothing else.
        async with control.connect():
            pass

        # THE SUBJECT: the same, plus whatever `check_database` executes.
        await check_database(subject)
    finally:
        await control.dispose()
        await subject.dispose()

    assert control_statements == [], (
        f"a bare checkout executed {control_statements}, so this listener cannot "
        f"tell a connection from a statement and the assertion below means nothing"
    )
    assert subject_statements == [PROBE_STATEMENT], (
        f"check_database executed {subject_statements}. It must issue exactly the "
        f"one-row SELECT that db/health.py argues for — deleting it leaves a probe "
        f"that proves only that the pool could hand out a connection."
    )


@pytest.mark.asyncio
async def test_a_dead_connection_is_a_probe_failure_whatever_notices_it(
    app_dsn: str, migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The behavioural half: a backend the server killed makes the probe `False`.

    Not a proof about the STATEMENT — the module docstring records why it cannot
    be, and this test is named for what it does prove. What it covers that the
    dead-port test in `test_rules_endpoint.py` does not is a connection that was
    ESTABLISHED and has since died, which is the ordinary shape of a database
    restart under a running service rather than of a service that never reached
    one.

    `pool_size=1, max_overflow=0` is the only spelling of "the same connection,
    twice" — `make_engine`'s own docstring records that `pool_size=1` alone is
    not, because the default `max_overflow=10` lets the pool open a fresh one on
    demand and the assertion then passes against a connection that was never
    killed. The PID is read back and its death confirmed from a separate
    superuser connection, so "the premise held" is checked rather than assumed.
    """
    admin = seam_engine(migrated_database)
    engine = make_engine(app_dsn, pool_size=1, max_overflow=0)
    try:
        async with engine.connect() as connection:
            pid = int(str(await connection.scalar(text("SELECT pg_backend_pid()"))))

        with admin.begin() as connection:
            connection.execute(text("SELECT pg_terminate_backend(:pid)"), {"pid": pid})
            alive = connection.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE pid = :pid"), {"pid": pid}
            ).scalar_one()
        assert int(str(alive)) == 0, f"backend {pid} is still alive; the premise does not hold"

        assert await probe_database(engine) is False
    finally:
        admin.dispose()
        await engine.dispose()


@pytest.mark.asyncio
async def test_a_healthy_database_answers_the_probe(app_dsn: str, migrated_database: str) -> None:
    """The positive control for `probe_database` itself, at the unit level.

    `test_rules_endpoint.py::test_the_route_answers_the_committed_fixture_byte_
    for_byte` asserts the same fact through `/ready`, and that is the one that
    matters to an operator. This one is here so that the two tests below —
    both of which assert `False` — have a `True` beside them in their own file.
    A file of denials cannot tell a working probe from a broken one:
    `return False` as the first statement of `probe_database` left the whole
    suite at 243 passed.
    """
    engine = make_engine(app_dsn)
    try:
        assert await probe_database(engine) is True
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_a_ceiling_the_probe_cannot_meet_is_a_failure_not_a_hang(
    app_dsn: str, migrated_database: str
) -> None:
    """The `TimeoutError` arm, against a HEALTHY database.

    The database is deliberately the working one: the only thing that can make
    this probe fail is the ceiling, so a `False` here is attributable to nothing
    else. `test_a_healthy_database_answers_the_probe` runs the identical engine
    with the default ceiling and gets `True`, which is the pair that makes this
    a statement about the timeout rather than about the server.

    Drop the `asyncio.timeout` from `probe_database` and this returns `True`.

    The default is asserted to be a real, positive number in the same breath —
    not because the VALUE is provable (it is not; see `lifespan.py`) but because
    a default of `0` would make every probe in every environment time out, and
    that is one careless edit away from a change nothing else here would notice.
    """
    assert DATABASE_PROBE_TIMEOUT_SECONDS > IMPOSSIBLE_CEILING

    engine = make_engine(app_dsn)
    try:
        assert await probe_database(engine, timeout=IMPOSSIBLE_CEILING) is False
    finally:
        await engine.dispose()

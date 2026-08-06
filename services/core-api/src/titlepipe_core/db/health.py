"""Can the database answer? The one question `/ready` asks of it.

**IT LIVES HERE BECAUSE `SELECT 1` IS RAW SQL AND RAW SQL LIVES HERE.**
`scripts/check_backend_rules.py` rule 3 bans `text(` everywhere under `src/`
except the `db` package directly inside a distribution package — see
`db/__init__.py`, which records that carve-out and why the review has to happen
inside it. `lifespan.py` is what actually wants this answer, and spelling the
statement up there is not a style choice the gate would forgive: it is a rule-3
violation with a health check written on it.

## A statement, not merely a connection

`engine.connect()` on its own proves the TCP handshake, the authentication and
`make_engine`'s `connect_args`. It does not prove the backend can execute
anything, and the cases where those two answers differ are the cases a readiness
probe exists for: a server still in recovery, a role at its connection limit for
the next statement, a standby that accepts sessions and refuses reads. A one-row
`SELECT` is the cheapest statement that separates them.

🔴 THAT PARAGRAPH IS AN ARGUMENT, AND FOR A WHILE IT WAS THE ONLY THING HOLDING
THE STATEMENT UP. MEASURED: deleting the `SELECT 1` and keeping the `connect()`
left the whole suite green, so the twelve lines above were exactly the part a
reader could not rely on. What is pinned NOW, and by what, kept apart from what
is argued:

* **PINNED** — `tests/test_database_probe.py::test_the_probe_issues_a_statement_
  and_not_only_a_checkout` observes the statement on a real engine against the
  real container, with a bare checkout as its control. Delete the `SELECT 1` and
  it fails.
* **PINNED** — a backend the server has terminated makes `probe_database` answer
  `False` (`test_a_dead_connection_is_a_probe_failure_whatever_notices_it`),
  which is the ordinary shape of a database restart under a running service.
* **STILL AN ARGUMENT** — the standby and the connection-limit cases. Neither is
  reachable from a one-container suite, and neither is claimed to be tested.

There is a related fact that a reader will otherwise discover the hard way, and
it is why the first of those tests observes rather than provokes: **there is no
"connect only" on an engine this application builds.** `engine.py`'s pool
`checkin` listener runs `RESET app.current_tenant` on every return, so a bare
`async with engine.connect(): pass` still touches the wire — measured, it raises
`AdminShutdown` on a killed backend from `engine.py`'s listener rather than from
anything here. A test that tried to isolate the statement with a dead connection
would therefore have passed with the statement deleted.

`SELECT 1` reads no table, so no policy `0002` writes is consulted and the
answer does not depend on a tenant having been established. That is the point of
choosing it over a count of anything real: a probe that read `rules` would go
red for a missing grant as readily as for a dead server, and readiness is not
the place to learn about a grant.

## It raises rather than returning a bool, and the caller swallows

The obvious shape is `-> bool` with the `except` in here. It is the wrong one:
the only thing in this tree with a logger and a policy about startup failure is
`lifespan.py`, and a helper that swallowed here would decide — silently, in the
`db` package — that an unreachable database is not worth a log line. What is
here is the statement; what to do about it not answering is the caller's, and
`lifespan.probe_database` is where that decision is written down.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def check_database(engine: AsyncEngine) -> None:
    """Execute one statement, or raise whatever stopped it.

    `engine.connect()` and not `engine.begin()`: this opens a transaction that is
    rolled back on exit, so the probe cannot leave anything behind on the
    connection it borrowed. The pool's own `checkin` listener (`engine.py`)
    re-applies the deny sentinel afterwards either way.

    No timeout here. libpq's default `connect_timeout` is INFINITE, so a host
    that blackholes the SYN hangs this call for as long as the kernel keeps
    retrying — measured in `tests/conftest.py::ROLES_SQL_TIMEOUT_SECONDS`, where
    a 20-second ceiling fired against `10.255.255.1` with `psql` still trying.
    The bound belongs at the call site, where there is a policy about how long a
    startup may take; `lifespan.probe_database` applies it, and takes it as a
    parameter so that a test can drive it.
    """
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))

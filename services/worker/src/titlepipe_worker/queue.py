"""The Procrastinate app: where the queue is opened, and where the worker runs.

Nothing in this module runs at import time. `make_app` is called from `cli.py`
after settings have validated and after logging has been configured, which is
`CONVENTIONS.md` §6's rule about engines and sessionmakers applied to the one
other resource this process holds.

## Why Postgres-native, restated where it is installed

PLAN §7 picks this library and gives two reasons that are decisions rather than
preferences, and both of them are properties of THIS module rather than of the
dependency list:

* **the audit write happens in the same transaction as the change it records**
  (§5). A job deferred through a broker is deferred outside the transaction that
  justified it, so "the order was accepted" and "the work was queued" become two
  facts that can disagree. Here a defer is an `INSERT` on a table in the same
  database, so it commits with the row or not at all;
* **the job model is page-grained and idempotent** (§6), which needs the
  idempotency key to be enforceable by a constraint. Procrastinate's
  `queueing_lock` is a UNIQUE INDEX over non-completed jobs, so a duplicate
  defer is refused by the database.

The second one is a seam, not a claim about today: no producer defers a
page-grained job yet, so nothing sets a `queueing_lock`. That is the pipeline's
work, and it is not started here.

## The connection pool is the worker's, and it is bounded by the same field

`max_concurrent_jobs` bounds jobs in flight, and each running job holds a
connection for its transaction. A pool smaller than that bound would make the
concurrency setting a lie — the extra jobs would sit waiting on a pool rather
than on work — so the pool is sized from the same number, with headroom for the
connections procrastinate holds outside a job (the LISTEN connection and the
heartbeat).
"""

from __future__ import annotations

from typing import Final

from procrastinate import App, PsycopgConnector

from titlepipe_worker.settings import WorkerSettings
from titlepipe_worker.tasks import register_jobs

# Connections procrastinate holds that are not a running job: one for the
# `LISTEN` that wakes the fetch loop, and one for the heartbeat and the periodic
# deferrer. Sized as a named constant rather than a `+ 2` at the call site so
# that "why is the pool bigger than the concurrency" has an answer in the file.
NON_JOB_CONNECTIONS: Final = 2


def make_connector(settings: WorkerSettings) -> PsycopgConnector:
    """The pool, sized against the concurrency bound it has to serve."""
    return PsycopgConnector(
        conninfo=settings.libpq_database_url,
        min_size=1,
        max_size=settings.max_concurrent_jobs + NON_JOB_CONNECTIONS,
        # An unbounded wait would turn pool exhaustion into a worker that hangs
        # with no log line. Failing the fetch is recoverable; a silent hang is
        # the shape this service refuses everywhere else.
        timeout=30.0,
        # The pool is opened by `App.open_async`, not by the constructor.
        # Procrastinate passes this through to `AsyncConnectionPool`, whose
        # default would otherwise open connections from `__init__` — at import
        # time for anyone who builds an app at module scope, which is exactly
        # what §6 forbids.
        open=False,
    )


def make_app(settings: WorkerSettings) -> App:
    """Build the app and register every task on it.

    Returns a CLOSED app: `App.open_async` (or `run_worker`, which opens it) is
    what actually connects. Building one is therefore safe in a test and in a
    `check` that must run with no database anywhere near it.

    A second call returns a genuinely independent app. That is a property of
    `register_jobs` — see `tasks.py` for the measured reason a shared
    module-level blueprint does not have it.
    """
    app = App(connector=make_connector(settings))
    register_jobs(app)
    return app

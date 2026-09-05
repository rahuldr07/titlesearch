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
from procrastinate.jobs import JobDeferrer

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
        # 🔴 NO `open=False` HERE, and it is worth saying why, because passing it
        # looks correct. `AsyncConnectionPool` would indeed open connections from
        # its constructor by default — which for anyone building an app at module
        # scope means connecting at import time, exactly what CONVENTIONS §6
        # forbids — but procrastinate already passes `open=False` to the pool
        # factory itself. Passing it again is `TypeError: got multiple values for
        # keyword argument 'open'` at the first `open_async`, MEASURED. The
        # property is the library's to hold and it holds it.
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


def deferrer(app: App, task_name: str) -> JobDeferrer:
    """A handle for putting one job on the queue, addressed BY NAME.

    This is how a producer defers without importing the task. core-api will need
    exactly this — it creates the row that justifies the work and defers in the
    same transaction — and it must not have to depend on this package to do it.

    🔴 `allow_unknown=False` IS THE POINT OF THE WRAPPER. `configure_task`
    defaults it to True, and with True a misspelled task name is accepted: the
    defer succeeds, a row lands in `procrastinate_jobs`, and no worker ever
    claims it because no worker registers that name. The queue then reports a job
    waiting rather than a mistake, and it waits forever. `False` turns the same
    typo into an exception at the defer, in the caller's own transaction, which
    rolls back with it.
    """
    return app.configure_task(name=task_name, allow_unknown=False)

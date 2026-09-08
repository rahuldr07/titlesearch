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
  database, so it CAN commit with the row or not at all — but only when the
  caller's connection is handed to `deferrer`. That parameter is the whole
  guarantee and it has a default; see the function for what the default does
  instead, measured;
* **the job model is page-grained and idempotent** (§6), which needs the
  idempotency key to be enforceable by a constraint. Procrastinate's
  `queueing_lock` is a UNIQUE INDEX, and it is narrower than idempotency: it
  covers `todo` ALONE.

The second one is a seam, not a claim about today: no producer defers a
page-grained job yet, so nothing sets a `queueing_lock`. That is the pipeline's
work, and it is not started here.

## 🔴 WHAT THE `queueing_lock` INDEX DOES NOT COVER, CORRECTED 2026-09-08

An earlier version of this file called that index "a UNIQUE INDEX over
non-completed jobs". It is not. The vendored DDL installs

    CREATE UNIQUE INDEX procrastinate_jobs_queueing_lock_idx_v1
        ON procrastinate_jobs (queueing_lock) WHERE status = 'todo';

so a job leaves the index the moment a worker claims it. MEASURED against
postgres:18.4: defer under lock `L`, let a worker claim it, defer under `L`
again — the second defer is ACCEPTED, and the queue holds two live rows for one
idempotency key. A duplicate defer is therefore refused only while the first
job is still WAITING, which is a weaker property than "page-grained and
idempotent" asks for.

**The index is right and the sentence was wrong.** The rejected alternative was
to widen the predicate in a migration of our own:

* the file is a byte copy of the library's shipped schema and
  `test_the_vendored_schema_is_the_installed_librarys` exists to refuse exactly
  this edit. Widening it forks the queue, which revision 0060 already priced and
  turned down;
* `AlreadyEnqueued` — the exception the library documents for a duplicate defer,
  and the one its own periodic deferrer catches — is raised only for the
  constraint literally named `procrastinate_jobs_queueing_lock_idx_v1`
  (`manager.py:15`). A second, wider index under any other name would surface the
  refusal as a raw `UniqueViolation` that no producer is written to catch;
* procrastinate separates `lock` (no two in `doing`) from `queueing_lock` (no two
  in `todo`) on purpose. Widening the second conflates two columns that mean
  different things.

**RESIDUAL, named because there is no machine for it.** Page-grained idempotency
is NOT enforced by the database once a job has been claimed. What would close it:
an idempotency key the DOMAIN owns — a unique constraint on the tenant-scoped
table that justifies the work — with the queue used to schedule it rather than to
deduplicate it. That belongs to the producer, which does not exist yet.
`tasks.py` records what the gap costs the stall sweep, and
`services/worker/tests/test_queue_schema.py::test_the_queueing_lock_is_unique_over_todo_ALONE`
is what makes the paragraph above go red if the predicate ever changes.

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

import psycopg
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


def deferrer(
    app: App, task_name: str, *, connection: psycopg.AsyncConnection[object] | None = None
) -> JobDeferrer:
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

    🔴 `connection` IS WHAT MAKES THE SAME-TRANSACTION PROMISE TRUE, AND OMITTING
    IT SILENTLY DOES NOT. Left out, the INSERT goes through the connector's pool
    — a second session, its own transaction, committed before `defer_async`
    returns. MEASURED against postgres:18.4 and procrastinate 3.9.0: the caller
    then rolls back and the job SURVIVES, so "the order was accepted" and "the
    work was queued" disagree in exactly the direction the module header says
    cannot happen. Passed, the row is invisible outside the caller's transaction
    and vanishes with it. Both halves are asserted in
    `tests/test_tasks.py::test_a_defer_without_a_connection_survives_the_callers_rollback`
    and its two companions.

    Typed as a `psycopg.AsyncConnection` rather than the library's `Any | None`,
    because `PsycopgConnector` is the connector this module builds and it is the
    only shape that works here; the library widens the annotation to cover its
    other connectors. `[object]` rather than `[Any]`: `Row` is declared
    covariant, so this accepts a caller's connection whatever row factory it
    carries, and procrastinate sets its own on the cursor it opens anyway.

    RESIDUAL: nothing REQUIRES a caller to pass it. The default stays `None`
    because the worker's own defers have no ambient transaction to join. What
    would close it for core-api is a caller-side seam that takes the session and
    has no spelling without one — that seam belongs with the producer and no
    producer exists yet.
    """
    return app.configure_task(name=task_name, allow_unknown=False, connection=connection)

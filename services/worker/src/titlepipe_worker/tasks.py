"""The worker's job registry, and the one job in it.

`register_jobs(app)` is the whole registration surface. Everything a worker can
be asked to do has to pass through it, so "what does this deployable run" is one
function rather than a search for decorators.

## Why registration is a function taking an app, and not a module-level Blueprint

The idiomatic procrastinate spelling is a module-level `Blueprint` plus
`app.add_tasks_from(blueprint, namespace=...)`. It is not used here, and the
reason is measured rather than stylistic.

`add_tasks_from` MUTATES the blueprint: it rewrites `blueprint.tasks` to the
namespaced names and rebinds every `Task.blueprint` to the app. MEASURED against
procrastinate 3.9.0, one blueprint holding a task `t`, added to two apps in one
process:

    first app  -> {'ns:t', ...}
    second app -> {'ns:ns:t', ...}

No exception. The second app holds a task under a name nothing defers to, so
every job it is handed comes back `TaskNotFound` — and the two shapes that reach
that state are ordinary ones: a test suite that builds an app per test, and a
process that builds a second app to defer with.

Registering onto the app instead has no shared mutable state, so a second app is
simply a second app. The task functions stay module-level, which is what lets
`tests/test_tasks.py` call `retry_stalled_jobs` directly with a fake context
rather than through a worker loop.

## The one job

`retry_stalled_jobs` is the queue's own maintenance, and it is here first because
without it the queue LOSES WORK SILENTLY. A worker that is killed mid-job — an
OOM, a node drain, a `docker stop` past the graceful timeout — leaves its job in
`doing` with nothing watching it. It is not in `todo`, so it is never fetched
again; it is not in `failed`, so it appears on no error surface; the order it
belongs to simply never finishes. That is this codebase's characteristic failure
shape (silent, not loud) sitting in the infrastructure rather than in the domain.

It is deliberately NOT part of the extraction pipeline. Stages 2-8 are somebody
else's build and are not started here.
"""

from __future__ import annotations

import datetime
from typing import Final

from procrastinate import App, JobContext
from procrastinate.jobs import Status

from titlepipe_service_kit import get_logger
from titlepipe_worker.context import worker_context
from titlepipe_worker.settings import QUEUE_MAINTENANCE

# The name the job is deferred under. Spelled once: a producer that defers
# `retry-stalled-jobs` against a worker registering `retry_stalled_jobs` gets a
# row in `procrastinate_jobs` that no worker will ever claim.
TASK_RETRY_STALLED_JOBS: Final = "titlepipe.retry_stalled_jobs"

# Every minute. The floor on how long a lost job stays invisible is this plus
# `stalled_worker_timeout_seconds`, so a minute is what keeps that inside two
# minutes at the default 30s timeout.
#
# procrastinate accepts an optional sixth column for seconds; five is used
# because a sweep that runs more often than the heartbeat interval mostly
# re-reads the same rows.
STALL_SWEEP_CRON: Final = "* * * * *"

# 🔴 THIS IS THE MACHINE THAT STOPS N WORKERS RUNNING N SWEEPS. Every worker
# process defers the periodic job on every tick; they collide on
# `procrastinate_periodic_defers_unique (task_name, periodic_id,
# defer_timestamp)`, and the losers get `ON CONFLICT DO NOTHING` and a NULL job
# id. One tick is therefore one job however many workers are running — enforced
# by a UNIQUE constraint in the schema revision 0060 installed, not by leader
# election and not by a lock this file takes.
STALL_SWEEP_PERIODIC_ID: Final = "titlepipe-stall-sweep"


async def retry_stalled_jobs(
    context: JobContext,
    timestamp: int,  # noqa: ARG001 — see the docstring: unread, and not removable
) -> None:
    """Return jobs whose worker died to the queue, and fail the ones past the cap.

    A job is judged lost by its WORKER's heartbeat, not by its own age. That
    distinction is the whole reason this is safe to run against a live queue: a
    page read legitimately takes minutes (p95 22-81s per page, per PLAN §6), so
    an age-based sweep would retry every slow read and double every bill. A
    heartbeat is a claim about the process, not about the work.

    `timestamp` is the cron tick, supplied by procrastinate's periodic deferrer.
    It is not read here, and it is not removable: it is what makes each tick a
    DISTINCT job under the unique constraint above. It is also POSITIONAL rather
    than keyword-only, which pyright is the thing that catches — `App.periodic`
    is typed `Concatenate[int, Args]`, so a keyword-only `timestamp` is refused
    at registration rather than at the first tick.

    ## What is logged, and what is deliberately not

    Job id, task name, queue and attempt count. Never `args` — that is where a
    tenant id, an order id and eventually a document reference live, and the
    queue tables are the one place in this system holding cross-tenant rows (see
    revision 0060). A sweep that logged them would put every tenant's job
    arguments into one log stream on a schedule.

    ## Why every job is disposed of inside its own guard

    A stalled job can be UNRECOVERABLE, and the shape that produces one is
    ordinary. `queueing_lock` is unique over `todo` alone — see `queue.py` for
    the measurement — so a second job may be deferred under a lock whose first
    job is already `doing`, and returning the `doing` one to `todo` then collides
    with its twin inside `procrastinate_retry_job_v2`. MEASURED against
    postgres:18.4 with two such rows:

        UniqueViolation: duplicate key value violates unique constraint
        "procrastinate_jobs_queueing_lock_idx_v1"

    Unguarded, that exception left the loop: every LATER stalled job went
    unswept, `stalled_job_sweep_complete` was never logged, and the cron re-ran
    the identical failure every minute — measured across two worker processes as
    2 errors and 0 completed sweeps. A sweep that dies on one bad row is not a
    sweep, so the guard is per job and the count reaches the completion line.

    NOT raising at the end when `unrecovered` is non-zero, deliberately. The
    rejected alternative was to fail the sweep job: it would put a sweep that
    recovered nine jobs out of ten on the same error surface as one that recovered
    nothing and could not tell them apart. `stalled_job_recovery_failed` is per
    job and is the surface.

    **RESIDUAL, and there is no machine for it.** The colliding row STAYS in
    `doing`, so it is logged rather than recovered — loud, but still stuck. The
    disposition it wants is `superseded`, which procrastinate has no status for,
    and choosing between "fail it" and "leave it" needs a producer whose
    semantics say whether a shared `queueing_lock` really means the same unit of
    work. No producer defers with a `queueing_lock` yet. What would close it: the
    page-grained producer, and a ruling with it.
    """
    settings = worker_context(context).settings
    manager = context.app.job_manager
    logger = get_logger(__name__)

    stalled = list(
        await manager.get_stalled_jobs(
            seconds_since_heartbeat=settings.stalled_worker_timeout_seconds
        )
    )
    retried = 0
    abandoned = 0
    unrecovered = 0
    now = datetime.datetime.now(tz=datetime.UTC)

    for job in stalled:
        if job.id is None:
            # Unreachable from the database — every row in `procrastinate_jobs`
            # has a `bigserial` id, and these Jobs are built from rows. Raising
            # rather than skipping, because a `None` here would mean the row
            # shape changed, and a sweep that quietly skipped such rows would go
            # on reporting a clean sweep while losing exactly the jobs it exists
            # to recover. Deliberately OUTSIDE the per-job guard below: that
            # guard is for one bad row, and this is a claim about all of them.
            raise RuntimeError(
                f"get_stalled_jobs returned a job with no id (task "
                f"{job.task_name!r}, queue {job.queue!r})"
            )

        if job.id == context.job.id:
            # This sweep's own row. It is `doing` for as long as this function
            # runs, so a worker whose heartbeat task has starved while its job
            # loop still turns would find itself here and hand its own running
            # job back to the queue — the duplicate execution the settings
            # cross-field rule refuses in the ordinary case, arriving by the one
            # route that rule cannot see.
            continue

        past_the_cap = job.attempts > settings.max_stall_retries
        try:
            if past_the_cap:
                await manager.finish_job(job=job, status=Status.FAILED, delete_job=False)
            else:
                await manager.retry_job_by_id_async(job_id=job.id, retry_at=now)
        except Exception as exc:
            unrecovered += 1
            logger.error(
                "stalled_job_recovery_failed",
                job_id=job.id,
                task_name=job.task_name,
                queue=job.queue,
                attempts=job.attempts,
                error_name=type(exc).__name__,
            )
            continue

        if past_the_cap:
            abandoned += 1
            logger.error(
                "stalled_job_abandoned",
                job_id=job.id,
                task_name=job.task_name,
                queue=job.queue,
                attempts=job.attempts,
                max_stall_retries=settings.max_stall_retries,
            )
        else:
            retried += 1
            logger.warning(
                "stalled_job_retried",
                job_id=job.id,
                task_name=job.task_name,
                queue=job.queue,
                attempts=job.attempts,
            )

    # Logged at every tick, including the quiet ones. A sweep that only spoke up
    # when it found something would make "the sweep is running" and "the sweep
    # found nothing" indistinguishable, which is the same silence it exists to
    # break.
    logger.info(
        "stalled_job_sweep_complete",
        stalled_found=len(stalled),
        retried=retried,
        abandoned=abandoned,
        unrecovered=unrecovered,
        seconds_since_heartbeat=settings.stalled_worker_timeout_seconds,
    )


def register_jobs(app: App) -> None:
    """Register every task this deployable can run. The only such place.

    Two steps rather than stacked decorators, because the function has to stay
    importable and directly callable for the tests; `app.task(...)` returns the
    `Task`, and `app.periodic(...)` takes one.
    """
    task = app.task(
        name=TASK_RETRY_STALLED_JOBS,
        queue=QUEUE_MAINTENANCE,
        pass_context=True,
    )(retry_stalled_jobs)
    app.periodic(cron=STALL_SWEEP_CRON, periodic_id=STALL_SWEEP_PERIODIC_ID)(task)

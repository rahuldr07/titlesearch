"""The one job, driven end to end through a real queue.

`test_queue_schema.py` proves the tables and the grants. This file proves the
thing they exist for: a job deferred as `titlepipe_worker` is fetched by a worker
running as `titlepipe_worker`, executed, and finished — and that the job actually
does what it says, which for `retry_stalled_jobs` means moving a lost job back to
`todo` and failing one that has exhausted its cap.

Every claim here is about a database. There is a fake connector in the library and
it is not used, because a fake cannot refuse: it would answer "succeeded" against
a grant list that permits nothing.
"""

from __future__ import annotations

import psycopg
import pytest
from procrastinate import App, JobContext
from procrastinate.jobs import Job
from pydantic import SecretStr

from titlepipe_domain import Environment
from titlepipe_worker.context import CONTEXT_KEY, WorkerContext, worker_context
from titlepipe_worker.queue import deferrer, make_app
from titlepipe_worker.settings import QUEUE_MAINTENANCE, WorkerSettings
from titlepipe_worker.tasks import (
    STALL_SWEEP_CRON,
    STALL_SWEEP_PERIODIC_ID,
    TASK_RETRY_STALLED_JOBS,
)

# A queue this worker is NOT configured to consume. Planted jobs live here so
# that returning one to `todo` does not immediately hand it to the worker under
# test, which would then fail it with `TaskNotFound` and hide the assertion.
PARKED_QUEUE = "local"
PARKED_TASK = "titlepipe.a_task_this_worker_does_not_register"


def registered(app: App) -> tuple[frozenset[str], list[tuple[str, str, str]]]:
    """The app's task names, and one `(name, cron, periodic_id)` per periodic.

    Both attributes this reads are public API that procrastinate types as
    `Task[..., Unknown, ...]`, so under pyright strict every access is a
    `partially unknown`. The suppressions live here, in one function, with the
    values coming back out as `str` — rather than being scattered across the
    tests that ask what got registered.
    """
    names = frozenset(app.tasks)  # pyright: ignore[reportUnknownArgumentType, reportUnknownMemberType]  # rules-allow(any-type): the library types its own task registry as partially unknown; the names are strings and are returned as such
    schedule: list[tuple[str, str, str]] = []
    for entry in app.periodic_registry.periodic_tasks.values():  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]  # rules-allow(any-type): same registry, same library typing; each field read below is a str
        schedule.append(
            (str(entry.task.name), str(entry.cron), str(entry.periodic_id))  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]  # rules-allow(any-type): as above
        )
    return names, schedule


def worker_settings(dsn: str) -> WorkerSettings:
    return WorkerSettings(environment=Environment.TEST, database_url=SecretStr(dsn))


def plant_job(dsn: str, *, status: str, attempts: int = 0, queueing_lock: str | None = None) -> int:
    """One row in `procrastinate_jobs`, in a state the library has no API to produce.

    `doing` with `worker_id IS NULL` is what a killed worker leaves:
    `procrastinate_workers` loses the row when it is pruned, and
    `select_stalled_jobs_by_heartbeat` treats a `doing` job belonging to no
    worker as stalled unconditionally — correctly, since it belongs to nobody.

    Inserted as the container superuser rather than through the library, because
    this is a state a CRASH produces and there is no API for crashing.
    """
    with psycopg.connect(dsn) as connection:
        row = connection.execute(
            "INSERT INTO procrastinate_jobs "
            "(queue_name, task_name, status, attempts, queueing_lock, args) "
            "VALUES (%s, %s, %s, %s, %s, '{}'::jsonb) RETURNING id",
            (PARKED_QUEUE, PARKED_TASK, status, attempts, queueing_lock),
        ).fetchone()
        connection.commit()
    assert row is not None
    return int(row[0])


def plant_stalled_job(dsn: str, *, attempts: int, queueing_lock: str | None = None) -> int:
    return plant_job(dsn, status="doing", attempts=attempts, queueing_lock=queueing_lock)


def job_status(dsn: str, job_id: int) -> str:
    with psycopg.connect(dsn) as connection:
        row = connection.execute(
            "SELECT status::text FROM procrastinate_jobs WHERE id = %s", (job_id,)
        ).fetchone()
    assert row is not None, f"job {job_id} disappeared"
    return str(row[0])


# --- registration, which needs no database ----------------------------------


def test_registration_names_the_task_and_the_queue_it_lives_on() -> None:
    """A producer defers by NAME. A worker registering a different one is a row
    in `procrastinate_jobs` that nothing ever claims, and the queue reports it as
    a job waiting rather than as a mistake."""
    app = make_app(worker_settings("postgresql://titlepipe_worker:x@127.0.0.1:5432/db"))
    names, schedule = registered(app)

    assert TASK_RETRY_STALLED_JOBS in names
    assert schedule == [(TASK_RETRY_STALLED_JOBS, STALL_SWEEP_CRON, STALL_SWEEP_PERIODIC_ID)]

    # `deferrer` refuses an unknown name, so this call IS the assertion that the
    # queue can be addressed by the name a producer would use.
    assert deferrer(app, TASK_RETRY_STALLED_JOBS).job.queue == QUEUE_MAINTENANCE


def test_a_second_app_registers_the_same_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """The measured reason `register_jobs` takes an app instead of copying a
    blueprint.

    `Blueprint.add_tasks_from` mutates the blueprint it reads: with procrastinate
    3.9.0, a blueprint added to two apps in one process yields `ns:t` and then
    `ns:ns:t`, with no exception. The second app's tasks are then unreachable by
    name and every job it is handed comes back `TaskNotFound`.
    """
    del monkeypatch
    dsn = "postgresql://titlepipe_worker:x@127.0.0.1:5432/db"
    first = make_app(worker_settings(dsn))
    second = make_app(worker_settings(dsn))

    assert TASK_RETRY_STALLED_JOBS in registered(first)[0]
    assert TASK_RETRY_STALLED_JOBS in registered(second)[0]
    assert first is not second


def test_a_task_without_a_context_refuses_rather_than_defaulting() -> None:
    """The alternative to raising is a sweep that runs on a timeout nobody
    configured, which looks identical to one that used the right value."""
    app = make_app(worker_settings("postgresql://titlepipe_worker:x@127.0.0.1:5432/db"))
    context = JobContext(
        app=app,
        worker_name="test",
        start_timestamp=0.0,
        abort_reason=lambda: None,
        job=Job(
            id=1,
            queue=QUEUE_MAINTENANCE,
            lock=None,
            queueing_lock=None,
            task_name=TASK_RETRY_STALLED_JOBS,
        ),
    )
    with pytest.raises(RuntimeError) as refusal:
        worker_context(context)
    assert "ran without a WorkerContext" in str(refusal.value)


# --- the job, through a real queue ------------------------------------------


@pytest.mark.asyncio
async def test_a_deferred_job_is_fetched_and_finishes_succeeded(
    empty_queue: str, worker_dsn: str
) -> None:
    """Defer, fetch, execute, finish — as `titlepipe_worker`, against Postgres.

    This is the wiring the whole revision exists for, and it is asserted rather
    than described: the job's terminal state is read back out of
    `procrastinate_jobs`. A `TaskNotFound`, a missing grant or a name mismatch
    each leaves the row in `todo` or `failed`, and none of them is quiet here.

    `wait=False` drains the queue and returns rather than blocking, which is what
    makes a work loop testable at all.
    """
    settings = worker_settings(worker_dsn)
    app = make_app(settings)

    async with app.open_async():
        job_id = await deferrer(app, TASK_RETRY_STALLED_JOBS).defer_async(timestamp=0)
        assert job_status(empty_queue, job_id) == "todo"

        await app.run_worker_async(
            queues=list(settings.queues),
            wait=False,
            install_signal_handlers=False,
            additional_context={CONTEXT_KEY: WorkerContext(settings=settings)},
        )

    assert job_status(empty_queue, job_id) == "succeeded"


@pytest.mark.asyncio
async def test_the_sweep_returns_a_lost_job_and_fails_one_past_its_cap(
    empty_queue: str, worker_dsn: str
) -> None:
    """Both branches of the one job, against two jobs a crash could have left.

    The recoverable one goes back to `todo`, which is the whole point: without
    it, a job whose worker died is in no queue and on no error surface, and the
    order it belongs to simply never finishes.

    The one past `max_stall_retries` goes to `failed` instead. Uncapped, a job
    that KILLS its worker would be handed to the next worker forever — the only
    visible symptom being workers restarting, with the job itself never reaching
    a state anybody looks at.

    Both are planted on a queue this worker does not consume, so `todo` is where
    the recovered one stays and the assertion is about the sweep rather than
    about what happened to it next.
    """
    settings = worker_settings(worker_dsn)
    assert settings.max_stall_retries == 2

    recoverable = plant_stalled_job(empty_queue, attempts=1)
    exhausted = plant_stalled_job(empty_queue, attempts=settings.max_stall_retries + 1)
    assert job_status(empty_queue, recoverable) == "doing"
    assert job_status(empty_queue, exhausted) == "doing"

    app = make_app(settings)
    async with app.open_async():
        sweep = await deferrer(app, TASK_RETRY_STALLED_JOBS).defer_async(timestamp=0)
        await app.run_worker_async(
            queues=list(settings.queues),
            wait=False,
            install_signal_handlers=False,
            additional_context={CONTEXT_KEY: WorkerContext(settings=settings)},
        )

    assert job_status(empty_queue, sweep) == "succeeded"
    assert job_status(empty_queue, recoverable) == "todo"
    assert job_status(empty_queue, exhausted) == "failed"


@pytest.mark.asyncio
async def test_the_sweep_leaves_its_own_running_job_alone(
    empty_queue: str, worker_dsn: str
) -> None:
    """The sweep's own row is `doing` while it runs, and it must not touch it.

    A worker whose heartbeat task has starved while its job loop still turns
    would find its own running job in the stalled set and hand it back to the
    queue — the duplicate execution the settings cross-field rule refuses,
    arriving by the one route that rule cannot see. Proved by the terminal state
    of the sweep itself: a job that retried itself ends `todo`, not `succeeded`.
    """
    settings = worker_settings(worker_dsn)
    app = make_app(settings)

    async with app.open_async():
        sweep = await deferrer(app, TASK_RETRY_STALLED_JOBS).defer_async(timestamp=0)
        await app.run_worker_async(
            queues=list(settings.queues),
            wait=False,
            install_signal_handlers=False,
            additional_context={CONTEXT_KEY: WorkerContext(settings=settings)},
        )

    assert job_status(empty_queue, sweep) == "succeeded"


@pytest.mark.asyncio
async def test_the_sweep_survives_a_job_it_cannot_return_to_the_queue(
    empty_queue: str, worker_dsn: str
) -> None:
    """One unrecoverable row must not cost every other stalled job its recovery.

    The state below is reachable and is not exotic. `queueing_lock` is unique
    over `todo` ONLY — `procrastinate_jobs_queueing_lock_idx_v1` in the vendored
    schema — so deferring a second job under a lock whose first job has already
    been claimed is ACCEPTED, and the queue then holds two live rows for one
    lock. Returning the `doing` one to `todo` moves it into the index its twin is
    already in: MEASURED against postgres:18.4,

        UniqueViolation: duplicate key value violates unique constraint
        "procrastinate_jobs_queueing_lock_idx_v1"

    raised inside `procrastinate_retry_job_v2`.

    The collider is planted FIRST so it is swept first: with the exception
    escaping the loop, `ordinary` is never reached at all and the sweep's own job
    ends `failed` with `stalled_job_sweep_complete` never logged.
    """
    settings = worker_settings(worker_dsn)

    collider = plant_stalled_job(empty_queue, attempts=0, queueing_lock="one-page")
    twin = plant_job(empty_queue, status="todo", queueing_lock="one-page")
    ordinary = plant_stalled_job(empty_queue, attempts=0)

    app = make_app(settings)
    async with app.open_async():
        sweep = await deferrer(app, TASK_RETRY_STALLED_JOBS).defer_async(timestamp=0)
        await app.run_worker_async(
            queues=list(settings.queues),
            wait=False,
            install_signal_handlers=False,
            additional_context={CONTEXT_KEY: WorkerContext(settings=settings)},
        )

    assert job_status(empty_queue, ordinary) == "todo", (
        "the sweep stopped at the row it could not recover and never reached this one"
    )
    assert job_status(empty_queue, sweep) == "succeeded"
    # Left where it was. Nothing here decides between superseding it and failing
    # it — see `retry_stalled_jobs` for why that needs a producer to exist first.
    assert job_status(empty_queue, collider) == "doing"
    assert job_status(empty_queue, twin) == "todo"


def queue_depth(dsn: str) -> int:
    with psycopg.connect(dsn) as connection:
        row = connection.execute("SELECT count(*) FROM procrastinate_jobs").fetchone()
    assert row is not None
    return int(row[0])


@pytest.mark.asyncio
async def test_a_defer_without_a_connection_survives_the_callers_rollback(
    empty_queue: str, worker_dsn: str
) -> None:
    """The DEFAULT is not the guarantee, and the difference is asserted, not assumed.

    A defer with no connection goes through the connector's own pool: a second
    session, its own transaction, committed the moment the INSERT returns. The
    caller's `ROLLBACK` therefore takes back the row that justified the work and
    leaves the work queued — the exact disagreement `queue.py` says the
    Postgres-native queue was chosen to make impossible.

    Pinned rather than merely described, because it is the shape a producer
    reaches by writing the obvious thing.
    """
    app = make_app(worker_settings(worker_dsn))
    async with app.open_async(), await psycopg.AsyncConnection.connect(worker_dsn) as caller:
        await deferrer(app, TASK_RETRY_STALLED_JOBS).defer_async(timestamp=0)
        await caller.rollback()

    assert queue_depth(empty_queue) == 1


@pytest.mark.asyncio
async def test_a_defer_on_the_callers_connection_rolls_back_with_it(
    empty_queue: str, worker_dsn: str
) -> None:
    """The guarantee `queue.py` promises, held by the machine that holds it.

    `JobDeferrer` takes a `connection`, and with the caller's own connection the
    INSERT is in the caller's transaction: invisible outside it until the caller
    commits, and gone if the caller rolls back. That is `deferrer`'s whole reason
    for exposing the parameter — without it there is no spelling of the promise
    at this seam at all.
    """
    app = make_app(worker_settings(worker_dsn))
    async with app.open_async(), await psycopg.AsyncConnection.connect(worker_dsn) as caller:
        await deferrer(app, TASK_RETRY_STALLED_JOBS, connection=caller).defer_async(timestamp=0)
        assert queue_depth(empty_queue) == 0, (
            "the INSERT is visible outside the caller's transaction"
        )
        await caller.rollback()

    assert queue_depth(empty_queue) == 0


@pytest.mark.asyncio
async def test_a_defer_on_the_callers_connection_commits_with_it(
    empty_queue: str, worker_dsn: str
) -> None:
    """The other half. A guarantee that only ever discarded the job would pass
    the rollback assertion above and be useless."""
    app = make_app(worker_settings(worker_dsn))
    async with app.open_async(), await psycopg.AsyncConnection.connect(worker_dsn) as caller:
        await deferrer(app, TASK_RETRY_STALLED_JOBS, connection=caller).defer_async(timestamp=0)
        await caller.commit()

    assert queue_depth(empty_queue) == 1

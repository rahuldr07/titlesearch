"""What a running task is allowed to reach, and how it reaches it.

A task body needs the validated configuration — the stall timeout, the retry
cap, later the spend ceilings and the provider bounds. There are three ways to
give it one and two of them are wrong here:

* **a module-level singleton built at import time** is what `CONVENTIONS.md` §6
  forbids for engines and sessionmakers, for the reason `cli.py` already records
  about structlog: whatever configuration happens to be active first gets pinned,
  and every later one is silently ignored;
* **reading the environment inside the task** would put an unvalidated value into
  the one place that spends money. `WorkerSettings` refuses a stall timeout below
  twice the heartbeat interval and a per-order ceiling above the daily one; a
  task that calls `os.environ` holds neither refusal.

The third way is procrastinate's own: `App.run_worker` takes an
`additional_context` mapping and hands it to every `JobContext`. It is built once
in `cli.py`, after settings validate and after logging is configured, and it
reaches a task through the framework rather than through a global.

## The typed accessor, and why it is not a dict lookup at the call site

`JobContext.additional_context` is an untyped `dict`, so `context.additional_context["settings"].stalled_worker_timeout_seconds`
is an unchecked attribute access on an unknown object — `Any` in all but name,
which `CONVENTIONS.md` §6 rules out. `worker_context` narrows it with an
`isinstance` check and raises when the narrowing fails.

That raise is not defensive noise. It is reachable in exactly one way — a worker
started without the context, which is to say a second call site for
`run_worker` that forgot it — and the alternative failure is worse than an
exception: the task would read a missing key, fall back to some default, and
sweep on a timeout nobody configured. A job that runs with the wrong bound looks
identical to one that ran with the right one.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final

from procrastinate import JobContext

from titlepipe_worker.settings import WorkerSettings

# The key the settings object travels under. One name, spelled once: a typo in a
# second spelling would not fail at startup, it would fail inside the first job
# to run.
CONTEXT_KEY: Final = "titlepipe_worker_context"


@dataclass(frozen=True, slots=True)
class WorkerContext:
    """Everything a task body may reach that is not its own arguments.

    Frozen, because a task must not be able to change what the next task on the
    same process sees. It holds one field today and is a class rather than the
    settings object itself so that the database session factory and the provider
    clients have somewhere to arrive that is not a second `additional_context`
    key negotiated between two files.
    """

    settings: WorkerSettings


def _context_from(extras: Mapping[str, object], task_name: str) -> WorkerContext:
    """The narrowing, in a function whose parameter type is the declared one.

    Everything inside here is typed because `extras` is a parameter, not an
    assignment. A local `extras: Mapping[str, object] = context.additional_context`
    does NOT achieve this: pyright narrows an assignment to the type of the
    right-hand side, so `extras` stays `dict[Unknown, Unknown]` and every use of
    it is another `partially unknown`. Crossing a function boundary is what makes
    the declaration the authority, and it confines the one suppression below to a
    single argument pass.
    """
    value = extras.get(CONTEXT_KEY)
    if not isinstance(value, WorkerContext):
        raise RuntimeError(
            f"job {task_name!r} ran without a WorkerContext: "
            f"additional_context[{CONTEXT_KEY!r}] is {type(value).__name__}. "
            f"The worker was started without it — see `titlepipe_worker.cli`, "
            f"which is the only place that should be calling run_worker."
        )
    return value


def worker_context(context: JobContext) -> WorkerContext:
    """The `WorkerContext` for this job, or a refusal naming what is missing."""
    return _context_from(
        context.additional_context,  # pyright: ignore[reportUnknownArgumentType, reportUnknownMemberType]  # rules-allow(any-type): procrastinate types `additional_context` as a bare `dict`; `_context_from` declares what it accepts and the isinstance inside it is what makes that declaration true
        context.job.task_name,
    )

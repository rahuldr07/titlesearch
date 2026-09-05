"""The worker's command entry point.

Two commands at Gate 1, both deterministic:

- `check` — validate configuration and report readiness. Exit 0 if the process
  could start work, non-zero if it could not. This is what a container health
  check and a deploy gate call.
- `run` — the work loop. Opens the queue, registers this process as a worker
  and consumes the queues it was configured for until it is signalled. It
  refuses to start without a DSN, because a worker that silently idles is
  indistinguishable from one that is broken.

Exit codes are part of the contract. A deploy gate branches on them, so they
are named constants rather than bare integers, and a configuration failure is
distinguishable from an unexpected crash.

Nothing here prints. Everything is a structured log record through the redacted
chain — a `print` in a worker bypasses redaction entirely.

One entry point, because there is one worker. `titlepipe-extraction` and
`titlepipe-render` were the same 160 lines twice, differing in two log fields
and one sentence of refusal wording; both fields are logged here, so the merged
`check` reports strictly more than either of them did.
"""

from __future__ import annotations

import argparse
import os
from typing import Final

from pydantic import ValidationError

from titlepipe_domain import Environment, LogRenderer
from titlepipe_service_kit import configure_logging, get_logger
from titlepipe_worker.context import CONTEXT_KEY, WorkerContext
from titlepipe_worker.queue import make_app
from titlepipe_worker.settings import ENV_PREFIX, WorkerSettings

EXIT_OK: Final = 0
EXIT_INVALID_CONFIGURATION: Final = 2
EXIT_UNEXPECTED: Final = 70  # EX_SOFTWARE

# 🔴 `EXIT_NOT_IMPLEMENTED = 3` IS GONE, AND ITS ABSENCE IS THE POINT. It was
# what `run` returned while there was no queue. There is one now, so the code has
# no referent — and a deploy gate branching on 3 would be branching on a state
# this binary can no longer be in. A worker that cannot run is a CONFIGURATION
# failure and exits 2, which is a code an operator already knows how to act on.

SERVICE_NAME: Final = "worker"

# What `check` reports for a validation error that belongs to no single field.
#
# A `model_validator(mode="after")` raising `ValueError` reaches pydantic with
# an EMPTY `loc`, so joining it produces the empty string — and the worker has
# two such rules, the spend-ceiling ordering and the converter-internal check.
# Both would have been reported as `invalid_fields: [""]`, which names nothing
# while looking like it named something.
#
# The message is deliberately still not logged. Both messages quote the value
# that failed, and one of those values is a URL that can carry credentials in
# its userinfo, so echoing it here would undo the whole reason this command
# reports field names instead of values.
CROSS_FIELD_RULE: Final = "<cross-field rule>"

# The logger is acquired inside each command, after `configure_logging`, never
# as a module-level singleton. structlog caches a bound logger on first use, so
# a proxy created at import time would pin whatever configuration happened to
# be active first and silently ignore the one this command just installed.


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="titlepipe-worker",
        description="TitlePipe worker.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("check", help="Validate configuration and exit.")
    subcommands.add_parser("run", help="Run the work loop.")
    return parser


def load_settings() -> WorkerSettings:
    """Read and validate configuration. Raises `ValidationError` if unusable."""
    return WorkerSettings.from_environment()


def environment_for_failed_configuration() -> Environment:
    """Which environment to configure logging for when settings are unusable.

    Fails closed. This runs on the one path where the settings object does not
    exist, and configuring logging for DEVELOPMENT there would give the weakest
    redaction — blocklist instead of allowlist, exception messages kept, console
    instead of JSON — to the process least able to justify any of it. A
    misconfigured production worker is exactly when a traceback is most likely
    to carry a DSN.

    The raw variable is read directly rather than through the model, because
    the model is what just refused to build. An unrecognised or absent value
    resolves to PRODUCTION; `api/errors.py::_environment_of` resolves an unknown
    environment the same way, for the same reason.
    """
    raw = os.environ.get(f"{ENV_PREFIX}ENVIRONMENT", "").strip().lower()
    try:
        return Environment(raw)
    except ValueError:
        return Environment.PRODUCTION


def _load_and_configure_logging() -> WorkerSettings | None:
    """Validate configuration, install the log pipeline, and return the settings.

    `None` means the configuration is unusable AND the failure has already been
    reported — the caller turns that into `EXIT_INVALID_CONFIGURATION` and adds
    nothing, because a second record about the same failure is a second thing to
    correlate.

    Shared by both commands rather than `run` calling `check`. The old `run`
    did call it, which meant a successful start emitted `configuration_valid`
    with the check command's field list and then `worker_starting` with the
    queue's — the same resolved configuration, reported twice, in two shapes.

    The failure path logs the *field names* that failed and never the values: a
    rejected setting may be a credential, and both commands have to be safe to
    run in CI and in a container probe.
    """
    try:
        settings = load_settings()
    except ValidationError as exc:
        environment = environment_for_failed_configuration()
        configure_logging(
            renderer=LogRenderer.JSON if environment.is_deployed else LogRenderer.CONSOLE,
            environment=environment,
        )
        get_logger(__name__).error(
            "configuration_invalid",
            service_name=SERVICE_NAME,
            error_count=exc.error_count(),
            invalid_fields=sorted(
                {
                    ".".join(str(part) for part in error["loc"])
                    if error["loc"]
                    else CROSS_FIELD_RULE
                    for error in exc.errors()
                }
            ),
        )
        return None

    configure_logging(
        level=settings.log_level,
        renderer=settings.effective_log_renderer,
        redaction_enabled=settings.redaction_enabled,
        environment=settings.environment,
    )
    return settings


def command_check() -> int:
    """Validate configuration and report whether work could start."""
    settings = _load_and_configure_logging()
    if settings is None:
        return EXIT_INVALID_CONFIGURATION

    # Both bounds are reported, not one: this record is the only place an
    # operator sees what the process actually resolved, and the two shells each
    # logged the one they cared about.
    #
    # `queue_configured` is a BOOLEAN, not the DSN. It is the one thing a deploy
    # gate needs from this record that it cannot get from the exit code — `check`
    # exits 0 for a locally-valid worker with no database, and that is correct
    # for a probe and useless for a gate asking "will `run` work here". The DSN
    # itself is a credential and never reaches a log line.
    get_logger(__name__).info(
        "configuration_valid",
        service_name=settings.service_name.value,
        environment=settings.environment.value,
        max_concurrent_jobs=settings.max_concurrent_jobs,
        max_concurrent_provider_calls=settings.max_concurrent_provider_calls,
        gotenberg_timeout_seconds=settings.gotenberg_timeout_seconds,
        queue_configured=settings.database_url is not None,
        queues=list(settings.queues),
    )
    return EXIT_OK


def command_run() -> int:
    """Consume the configured queues until this process is signalled.

    Blocks. `App.run_worker` owns the event loop, installs SIGINT/SIGTERM
    handlers and returns normally once the running jobs have finished, so a
    `docker stop` or a pod eviction leaves this function through its ordinary
    exit rather than through an exception.

    ## The refusal that survives from the version that could not run

    A worker with no DSN used to be the only shape `run` had. It is still
    refused, and the reason is unchanged: a process that starts, reports itself
    healthy and consumes nothing is indistinguishable on every dashboard from
    one that is working. What changed is the code it exits with — 2, a
    configuration failure, because that is what it is.

    Deployed environments never reach that branch; `WorkerSettings` refuses the
    configuration outright. It is here for the local run that asks for the work
    loop without a database.

    ## What is handed to the worker, and where each number comes from

    Every bound below is a validated settings field rather than a literal, and
    two of them are load-bearing together: `update_heartbeat_interval` and
    `stalled_worker_timeout` are the pair the settings cross-field rule holds
    apart, and they are ALSO what `retry_stalled_jobs` reads to decide a job is
    lost. Passing one from settings and leaving the other at the library default
    would let the sweep and the heartbeat disagree about the same worker.
    """
    settings = _load_and_configure_logging()
    if settings is None:
        return EXIT_INVALID_CONFIGURATION

    logger = get_logger(__name__)
    if settings.database_url is None:
        logger.error(
            "queue_not_configured",
            service_name=settings.service_name.value,
            environment=settings.environment.value,
            detail=(
                f"{ENV_PREFIX}DATABASE_URL is unset; a worker with no queue would "
                f"start, report itself healthy and consume nothing"
            ),
        )
        return EXIT_INVALID_CONFIGURATION

    app = make_app(settings)
    logger.info(
        "worker_starting",
        service_name=settings.service_name.value,
        environment=settings.environment.value,
        queues=list(settings.queues),
        concurrency=settings.max_concurrent_jobs,
        stalled_worker_timeout_seconds=settings.stalled_worker_timeout_seconds,
    )
    app.run_worker(
        queues=list(settings.queues),
        concurrency=settings.max_concurrent_jobs,
        update_heartbeat_interval=settings.heartbeat_interval_seconds,
        stalled_worker_timeout=settings.stalled_worker_timeout_seconds,
        additional_context={CONTEXT_KEY: WorkerContext(settings=settings)},
    )
    # Reached on a clean shutdown, and worth a record: a worker that stopped
    # because it was asked to and one that stopped because it crashed produce
    # the same absence in the logs otherwise.
    logger.info(
        "worker_stopped",
        service_name=settings.service_name.value,
        environment=settings.environment.value,
    )
    return EXIT_OK


def main(argv: list[str] | None = None) -> int:
    """Entry point. Returns an exit code rather than calling `sys.exit`, so
    tests can assert on it without trapping `SystemExit`."""
    args = build_parser().parse_args(argv)
    match args.command:
        case "check":
            return command_check()
        case "run":
            return command_run()
        case _:  # pragma: no cover — argparse rejects this first
            return EXIT_UNEXPECTED


def run() -> None:
    """Console-script shim."""
    raise SystemExit(main())

"""The extraction worker's command entry point.

Two commands at Gate 1, both deterministic:

- `check` — validate configuration and report readiness. Exit 0 if the process
  could start work, non-zero if it could not. This is what a container health
  check and a deploy gate call.
- `run` — the work loop. Refuses to start at this gate, because there is no
  queue yet and a worker that silently idles is indistinguishable from one that
  is broken.

Exit codes are part of the contract. A deploy gate branches on them, so they
are named constants rather than bare integers, and a configuration failure is
distinguishable from an unexpected crash.

Nothing here prints. Everything is a structured log record through the redacted
chain — a `print` in a worker bypasses redaction entirely.
"""

from __future__ import annotations

import argparse
from typing import Final

from pydantic import ValidationError

from titlepipe_extraction.settings import ExtractionSettings
from titlepipe_extraction.telemetry.logging import configure_logging, get_logger

EXIT_OK: Final = 0
EXIT_INVALID_CONFIGURATION: Final = 2
EXIT_NOT_IMPLEMENTED: Final = 3
EXIT_UNEXPECTED: Final = 70  # EX_SOFTWARE

# The logger is acquired inside each command, after `configure_logging`, never
# as a module-level singleton. structlog caches a bound logger on first use, so
# a proxy created at import time would pin whatever configuration happened to
# be active first and silently ignore the one this command just installed.


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="titlepipe-extraction",
        description="TitlePipe extraction worker.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("check", help="Validate configuration and exit.")
    subcommands.add_parser("run", help="Run the extraction work loop.")
    return parser


def load_settings() -> ExtractionSettings:
    """Read and validate configuration. Raises `ValidationError` if unusable."""
    return ExtractionSettings()


def command_check() -> int:
    """Validate configuration and report whether work could start.

    The failure path logs the *field names* that failed and never the values:
    a rejected setting may be a credential, and the point of this command is to
    be safe to run in CI and in a container probe.
    """
    try:
        settings = load_settings()
    except ValidationError as exc:
        configure_logging()
        get_logger(__name__).error(
            "configuration_invalid",
            service_name="extraction-worker",
            error_count=exc.error_count(),
            invalid_fields=sorted(
                {".".join(str(part) for part in error["loc"]) for error in exc.errors()}
            ),
        )
        return EXIT_INVALID_CONFIGURATION

    configure_logging(
        level=settings.log_level,
        renderer=settings.effective_log_renderer,
        redaction_enabled=settings.redaction_enabled,
    )
    get_logger(__name__).info(
        "configuration_valid",
        service_name=settings.service_name.value,
        environment=settings.environment.value,
        max_concurrent_jobs=settings.max_concurrent_jobs,
        max_concurrent_provider_calls=settings.max_concurrent_provider_calls,
    )
    return EXIT_OK


def command_run() -> int:
    """Refuse, loudly, until the queue exists.

    A worker that starts, finds nothing to do and loops quietly looks healthy
    on every dashboard while doing nothing. Failing is the honest answer at a
    gate where the queue has not been built.
    """
    status = command_check()
    if status != EXIT_OK:
        return status
    get_logger(__name__).error(
        "worker_loop_not_implemented",
        service_name="extraction-worker",
        detail="the queue lands at Gate 5; this worker has no work loop yet",
    )
    return EXIT_NOT_IMPLEMENTED


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

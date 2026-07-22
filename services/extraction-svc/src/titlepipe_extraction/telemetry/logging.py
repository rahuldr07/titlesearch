"""structlog configuration.

The chain is ordered deliberately:

    redaction -> context merge -> level -> logger name -> timestamp -> render

Redaction is first. Everything after it — including the exception formatter and
whatever a shipper does downstream — sees an already-clean record.

Rendering is the only thing that varies by environment. Event names and field
names are identical everywhere, so a log line a developer read on a console can
be found in staging by the same string.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from titlepipe_domain import LogRenderer
from titlepipe_extraction.telemetry.redaction import redaction_processor


def configure_logging(
    *,
    level: str = "INFO",
    renderer: LogRenderer = LogRenderer.CONSOLE,
    redaction_enabled: bool = True,
) -> None:
    """Install the logging configuration for this process.

    `redaction_enabled=False` exists for one purpose: proving in a test that the
    redaction processor is what removes a value, rather than some downstream
    accident. Deployed environments refuse to start with it off — see
    `CoreApiSettings`.
    """
    shared: list[Any] = []
    if redaction_enabled:
        shared.append(redaction_processor)
    shared += [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
    ]

    final: Any
    if renderer is LogRenderer.JSON:
        # `format_exc_info` turns an exception into a redacted-safe string field.
        # It runs after redaction, which is correct: the traceback text itself is
        # generated here and never carried a domain value into the event dict.
        shared.append(structlog.processors.format_exc_info)
        final = structlog.processors.JSONRenderer()
    else:
        final = structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())

    structlog.configure(
        processors=[*shared, final],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping()[level.upper()]
        ),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    """A bound logger. Call after `configure_logging`."""
    return structlog.get_logger(name)

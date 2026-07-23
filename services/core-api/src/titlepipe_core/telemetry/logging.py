"""structlog configuration.

The chain is ordered deliberately:

    context merge -> level -> timestamp -> exception formatting -> REDACTION -> render

**Redaction is last, immediately before the renderer.** An earlier version put
it first, reasoning that nothing downstream could then see an unredacted value.
That was wrong: processors after it *create* fields. `format_exc_info` builds
the traceback string after redaction had already run, so an exception carrying
a connection string or a party name reached stdout verbatim.

The property that matters is that **no processor runs after redaction except
the renderer** — by then every field the record will ever hold exists.

Rendering is the only thing that varies by environment. Event names and field
names are identical everywhere, so a line a developer read on a console can be
found in staging by the same string.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from titlepipe_domain import Environment, LogRenderer
from titlepipe_domain.redaction import redact_mapping, sanitise_exception


def build_redaction_processor(
    *,
    keep_exception_messages: bool,
    allowlist_only: bool,
    extra_sensitive_parts: frozenset[str] = frozenset(),
) -> Any:
    """The final processor before rendering.

    Handles the `exception` field explicitly. It is produced by
    `format_exc_info` immediately upstream and is free text with no key a
    name-based rule could match, so it is sanitised rather than passed through.

    `allowlist_only` is on in deployed environments: a field is dropped unless
    it is a named diagnostic. Review showed the blocklist alone missed
    `field_value`, `party`, `result` and `reason` — none of which looks
    alarming, all of which carried a party name to stdout.
    """

    def processor(_logger: Any, _method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
        formatted: object = event_dict.get("exception")
        if isinstance(formatted, str):
            event_dict["exception"] = sanitise_exception(
                formatted, keep_messages=keep_exception_messages
            )
        return redact_mapping(
            event_dict,
            extra_parts=extra_sensitive_parts,
            allowlist_only=allowlist_only,
        )

    return processor


def configure_logging(
    *,
    level: str = "INFO",
    renderer: LogRenderer = LogRenderer.CONSOLE,
    redaction_enabled: bool = True,
    environment: Environment = Environment.DEVELOPMENT,
    extra_sensitive_parts: frozenset[str] = frozenset(),
) -> None:
    """Install the logging configuration for this process.

    `redaction_enabled=False` exists for one purpose: proving in a test that
    the redaction processor is what removes a value, rather than some
    downstream accident. Deployed environments refuse to start with it off.
    """
    processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        # Must precede redaction: it creates the `exception` field, and a
        # traceback generated afterwards would never be inspected.
        structlog.processors.format_exc_info,
    ]

    if redaction_enabled:
        processors.append(
            build_redaction_processor(
                keep_exception_messages=not environment.is_deployed,
                allowlist_only=environment.is_deployed,
                extra_sensitive_parts=extra_sensitive_parts,
            )
        )

    final: Any
    if renderer is LogRenderer.JSON:
        final = structlog.processors.JSONRenderer()
    else:
        final = structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())
    processors.append(final)

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping()[level.upper()]
        ),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    """A bound logger. Call after `configure_logging`.

    Never bind this at module scope. structlog caches a bound logger on first
    use, so a module-level proxy pins whatever configuration happened to be
    active first and silently ignores a later one.
    """
    return structlog.get_logger(name)

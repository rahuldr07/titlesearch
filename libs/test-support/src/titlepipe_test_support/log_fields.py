"""What the source ACTUALLY passes to a logger, parsed rather than listed.

`libs/domain/redaction.py` carries two tables: a blocklist of key substrings
that mark a value unloggable, and an allowlist of field names a deployed
environment will print. A field must clear BOTH. They are maintained
separately, and the test that was supposed to keep them honest —
`test_every_allowlisted_diagnostic_actually_survives` — iterates the allowlist.

**A test that iterates the allowlist can only ever confirm what is already in
it.** `task_name` was in neither table, so it was scrubbed from every log line
in every environment, and the test walked past it because there was nothing to
walk. `stalled_job_retried` and `stalled_job_abandoned` — the two lines an
operator gets when the queue is losing work — could not say what work was lost,
and the suite was green.

The fix is to stop asking the tables what exists and ask the SOURCE. This
module parses every `logger.info(...)` / `.warning(...)` / `.error(...)` call in
a package and returns the keyword names it passes, so a field that is emitted
but classified nowhere is a test failure at the moment it is written rather
than a silent `[redacted]` in an incident.

## Why an AST scan and not an import-and-introspect

The same argument `libs/domain/tests/test_import_boundary.py` makes for its own
scan: importing a module executes its top level, not its function bodies, and
every one of these calls is inside a function body. Parsing finds them wherever
they are — inside a branch, a loop, an `except`, a coroutine — with nothing
executed and no database, container or event loop required.

## What it cannot see

A field assembled at runtime — `logger.info(event, **fields)` — has no keyword
name in the source, so it is not returned. `structlog`'s `bind()` and
`contextvars` are likewise invisible. This finds the literal keyword arguments,
which is what every call site in this repo currently writes; it is a floor, not
a proof of completeness, and `log_call_sites` is exposed so a caller can assert
the floor is not zero.
"""

from __future__ import annotations

import ast
from collections import defaultdict
from pathlib import Path

# structlog's BoundLogger methods that take `event, **fields`. `exception` is
# here too: it is `error` with `exc_info`, and it takes the same keywords.
LOG_METHODS: frozenset[str] = frozenset(
    {"debug", "info", "warning", "warn", "error", "exception", "critical", "log"}
)

# A call is treated as a log call when the object it is called on is named like
# a logger. Matching on the NAME rather than on an inferred type is deliberate:
# no static analysis here knows what `self._log` holds, and a scan that gave up
# where it could not prove the type would silently cover less over time — the
# exact failure this module exists to end. A false positive costs one extra
# field name in the result, which the caller then has to classify; a false
# negative costs an unredacted field nobody notices.
_LOGGER_NAME_PARTS: frozenset[str] = frozenset({"log", "logger"})


def _is_logger_reference(node: ast.expr) -> bool:
    """Whether `node` is something plausibly named like a logger.

    Handles `logger.info(...)`, `self.logger.info(...)`, `_log.info(...)` and
    `module.logger.info(...)` by looking only at the final segment.

    🔴 THE `ast.Call` BRANCH IS NOT A CONVENIENCE. core-api writes
    `_log().error(...)` and `get_logger(__name__).info(...)`, so the receiver is
    a CALL, not a name — and the first version of this scanner returned False
    there and reported that core-api emits zero log fields. A scanner that
    quietly finds nothing is worse than no scanner: it is a green gate over an
    unscanned service, which is the same shape as the allowlist-iterating test
    this module was written to replace. `test_the_scan_finds_the_known_call_sites`
    in each service is what keeps that from happening again silently.
    """
    if isinstance(node, ast.Name):
        tail = node.id
    elif isinstance(node, ast.Attribute):
        tail = node.attr
    elif isinstance(node, ast.Call):
        return _is_logger_reference(node.func)
    else:
        return False
    normalised = tail.strip("_").lower()
    return any(part in normalised for part in _LOGGER_NAME_PARTS)


def log_call_sites(source: str) -> list[ast.Call]:
    """Every call that looks like `<something-logger>.<log-method>(...)`."""
    return [
        node
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in LOG_METHODS
        and _is_logger_reference(node.func.value)
    ]


def emitted_log_fields(package_root: Path) -> dict[str, set[Path]]:
    """Field name -> the files that pass it to a logger.

    The file set is what turns a failure into a fix: a test naming only the
    field leaves the reader grepping for a call site the scanner already knew.
    """
    found: dict[str, set[Path]] = defaultdict(set)
    for path in sorted(package_root.rglob("*.py")):
        for call in log_call_sites(path.read_text(encoding="utf-8")):
            for keyword in call.keywords:
                # `**fields` has no `arg`; see "What it cannot see" above.
                if keyword.arg is not None:
                    found[keyword.arg].add(path)
    return dict(found)

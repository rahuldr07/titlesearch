"""The http-kit boundary, enforced statically, in both directions it was ruled.

This package sits below the two API services and beside `libs/service-kit`, and
each edge is load-bearing:

* It must never import `titlepipe_core` or `titlepipe_blind` — it is the shared
  floor under both, and a kit that reads a service inverts the dependency the
  extraction exists to create.
* It must never import `titlepipe_service_kit`, and the service kit must never
  import it back (that direction lives in `libs/service-kit/tests/
  test_import_boundary.py`, which names `titlepipe_http_kit` in its forbidden
  set). The two kits stay independent so that installing one never smuggles in
  the other's dependency closure — the worker installs the service kit and must
  not receive starlette by a side door.
* `fastapi` is forbidden even though starlette is allowed: the middleware here
  is written against the ASGI interface precisely so it owes nothing to a
  framework, and `BaseHTTPMiddleware` — the first thing a fastapi import
  invites — is the documented contextvar-propagation failure the middleware
  exists to avoid.

The scan is the same AST walk `libs/domain` and `libs/service-kit` use, and for
the same reason: importing a module executes its top level and not its function
bodies, so a `sys.modules` diff misses a lazy import inside a function — which
is precisely the shape a violation takes.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

import titlepipe_http_kit

FORBIDDEN_ROOTS = frozenset(
    {
        "fastapi",
        "uvicorn",
        "sqlalchemy",
        "alembic",
        "psycopg",
        "asyncpg",
        "workos",
        "pgqueuer",
        "procrastinate",
        "boto3",
        "botocore",
        "httpx",
        "requests",
        "tenacity",
        "google",
        "anthropic",
        "openai",
        "docx",
        "docxtpl",
        "pikepdf",
        "pypdfium2",
        "pdfplumber",
        "PIL",
        "paddleocr",
        "opentelemetry",
        "prometheus_client",
        "sentry_sdk",
        # Sibling packages: the kit is below every deployable, never beside one,
        # and independent of the other kit — see the module docstring.
        "titlepipe_core",
        "titlepipe_blind",
        "titlepipe_worker",
        "titlepipe_service_kit",
        "titlepipe_test_support",
    }
)

PACKAGE_ROOT = Path(titlepipe_http_kit.__file__).parent
SOURCE_FILES = sorted(PACKAGE_ROOT.rglob("*.py"))


def imported_roots(source: str) -> set[str]:
    """Every top-level package name imported anywhere in the source.

    Walks the whole tree, so an import nested inside a function, a method, a
    conditional or a `TYPE_CHECKING` block is found exactly like one at module
    level.

    A THIRD COPY, AND THE DUPLICATION IS STILL FORCED RATHER THAN OVERLOOKED.
    The identical function is in `libs/domain/tests/test_import_boundary.py` and
    `libs/service-kit/tests/test_import_boundary.py`, whose copies name the
    obstacle: the natural home is `libs/test-support`, but `titlepipe-test-
    support` depends on `titlepipe-domain`, so domain's own suite cannot import
    it without a cycle. Until something below domain exists to hold it, the
    copies agree by hand.
    """
    roots: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            for alias in node.names:
                roots.add(alias.name.split(".")[0])
        # `level > 0` is a relative import: within this package, and separately
        # banned by ruff's TID252.
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            roots.add(node.module.split(".")[0])
    return roots


def test_there_is_something_to_scan() -> None:
    """A scan of zero files passes vacuously, which is the failure mode this
    kind of test is most prone to."""
    assert SOURCE_FILES, f"no sources found under {PACKAGE_ROOT}"


@pytest.mark.parametrize("path", SOURCE_FILES, ids=lambda p: p.name)
def test_no_module_imports_across_the_boundary(path: Path) -> None:
    leaked = imported_roots(path.read_text(encoding="utf-8")) & FORBIDDEN_ROOTS
    assert not leaked, (
        f"{path.relative_to(PACKAGE_ROOT)} imports {sorted(leaked)}; the http kit is the "
        "shared floor under both API services and may not read a service, a framework, "
        "or the service kit"
    )


def test_the_scan_detects_a_lazy_import() -> None:
    """Without this, a green boundary suite proves only that nobody wrote the
    violation at module level."""
    assert imported_roots("def load():\n    import fastapi\n    return fastapi\n") == {"fastapi"}


def test_the_scan_detects_a_type_checking_import() -> None:
    guarded = (
        "from typing import TYPE_CHECKING\n"
        "if TYPE_CHECKING:\n"
        "    from titlepipe_core.app import create_app\n"
    )
    assert imported_roots(guarded) & FORBIDDEN_ROOTS == {"titlepipe_core"}


def test_a_service_import_would_be_refused() -> None:
    """The edge this package was ruled on, exercised end-to-end: source that
    reads a service trips the same set intersection the per-file test uses."""
    violating = "from titlepipe_blind.api.errors import register_error_handlers\n"
    assert imported_roots(violating) & FORBIDDEN_ROOTS == {"titlepipe_blind"}


def test_the_three_allowed_dependencies_are_not_in_the_forbidden_set() -> None:
    """The list above is a denial, and a denial that accidentally names this
    package's own dependencies would fail on every file."""
    assert not FORBIDDEN_ROOTS & {"starlette", "structlog", "titlepipe_domain"}

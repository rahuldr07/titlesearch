"""The no-web-framework boundary, enforced statically.

`libs/service-kit` is imported by the Core API, the Blind API and the worker. A
FastAPI import here would put a web server into the worker image; a `boto3` or
provider import would make a credential-bearing client reachable from a process
that must not hold one.

The scan is the same AST walk `libs/domain/tests/test_import_boundary.py` uses,
and for the same reason: importing a module executes its top level and not its
function bodies, so a `sys.modules` diff misses a lazy import inside a function
— which is precisely the shape a violation takes.

`pydantic`, `pydantic_settings` and `structlog` are ALLOWED here and forbidden
in `libs/domain`. That difference is the whole point of there being two
packages: domain is vocabulary and carries no runtime dependency at all, and
this package is the scaffolding built out of exactly those three.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

import titlepipe_service_kit

FORBIDDEN_ROOTS = frozenset(
    {
        "fastapi",
        "starlette",
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
        # Sibling packages: the kit is below every deployable, never beside one.
        "titlepipe_core",
        "titlepipe_blind",
        "titlepipe_worker",
        "titlepipe_test_support",
    }
)

PACKAGE_ROOT = Path(titlepipe_service_kit.__file__).parent
SOURCE_FILES = sorted(PACKAGE_ROOT.rglob("*.py"))


def imported_roots(source: str) -> set[str]:
    """Every top-level package name imported anywhere in the source.

    Walks the whole tree, so an import nested inside a function, a method, a
    conditional or a `TYPE_CHECKING` block is found exactly like one at module
    level.

    A SECOND COPY, AND THE DUPLICATION IS FORCED RATHER THAN OVERLOOKED. The
    identical function is `libs/domain/tests/test_import_boundary.py`'s. The
    obvious home is `libs/test-support`, which already carries the sibling AST
    scanner in `log_fields.py` — but `titlepipe-test-support` depends on
    `titlepipe-domain`, so domain's own test suite cannot import it without a
    cycle. Until something below domain exists to hold it, these two agree by
    hand: this copy had already lost the two paragraphs above, which is what
    drift looks like before it reaches the code.
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
def test_no_module_imports_a_framework(path: Path) -> None:
    leaked = imported_roots(path.read_text(encoding="utf-8")) & FORBIDDEN_ROOTS
    assert not leaked, (
        f"{path.relative_to(PACKAGE_ROOT)} imports {sorted(leaked)}; the service kit is "
        "imported by the worker as well as the two APIs and must stay framework-free"
    )


def test_the_scan_detects_a_lazy_import() -> None:
    """Without this, a green boundary suite proves only that nobody wrote the
    violation at module level."""
    assert imported_roots("def load():\n    import boto3\n    return boto3\n") == {"boto3"}


def test_the_scan_detects_a_type_checking_import() -> None:
    guarded = (
        "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from fastapi import Request\n"
    )
    assert imported_roots(guarded) & FORBIDDEN_ROOTS == {"fastapi"}


def test_the_three_allowed_dependencies_are_not_in_the_forbidden_set() -> None:
    """The list above is a denial, and a denial that accidentally names this
    package's own dependencies would fail on every file."""
    assert not FORBIDDEN_ROOTS & {"pydantic", "pydantic_settings", "structlog", "titlepipe_domain"}

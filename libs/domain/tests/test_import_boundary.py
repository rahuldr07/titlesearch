"""The framework-free boundary, enforced statically.

`libs/domain` is imported by all four deployables. A framework dependency added
here is added everywhere, and — for `boto3`, `workos` or a provider SDK — a
credential-bearing client becomes reachable from a process that must not have
one.

## Why this is an AST scan and not a `sys.modules` check

The previous test imported every module and then diffed `sys.modules`. That
catches a top-level import, but its docstring claimed it also caught a lazy
import inside a function body — and it does not. Importing a module executes
its top level, not its function bodies, so:

    def load():
        import boto3          # never executed at import time
        return boto3.client("s3")

passes a `sys.modules` check while being exactly the violation the rule exists
to prevent.

Parsing the source finds every `import` statement wherever it appears — module
level, function body, method, `TYPE_CHECKING` block, conditional. No execution
required, so nothing can hide behind a branch that happens not to run.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

import titlepipe_domain

# Anything that makes this package framework-bound, credential-bearing or
# deployment-specific.
FORBIDDEN_ROOTS = frozenset(
    {
        "fastapi",
        "starlette",
        "uvicorn",
        "pydantic",
        "pydantic_settings",
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
        "httpx2",
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
        "structlog",
        "opentelemetry",
        "prometheus_client",
        "sentry_sdk",
        # Sibling packages: domain must not depend on anything above it.
        "titlepipe_core",
        "titlepipe_blind",
        "titlepipe_extraction",
        "titlepipe_render",
        "titlepipe_test_support",
    }
)

PACKAGE_ROOT = Path(titlepipe_domain.__file__).parent
SOURCE_FILES = sorted(PACKAGE_ROOT.rglob("*.py"))


def imported_roots(source: str) -> set[str]:
    """Every top-level package name imported anywhere in the source.

    Walks the whole tree, so an import nested inside a function, a method, a
    conditional or a `TYPE_CHECKING` block is found exactly like one at module
    level.
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
        f"{path.relative_to(PACKAGE_ROOT)} imports {sorted(leaked)}; "
        "libs/domain is imported by every deployable and must stay framework-free"
    )


def test_the_scan_detects_a_lazy_import() -> None:
    """The case the previous `sys.modules` test claimed to cover and did not.

    Without this, a green boundary suite would prove only that nobody wrote the
    violation at module level.
    """
    lazy = "def load():\n    import boto3\n    return boto3\n"
    assert imported_roots(lazy) & FORBIDDEN_ROOTS == {"boto3"}


def test_the_scan_detects_a_type_checking_import() -> None:
    guarded = (
        "from typing import TYPE_CHECKING\nif TYPE_CHECKING:\n    from sqlalchemy import Engine\n"
    )
    assert imported_roots(guarded) & FORBIDDEN_ROOTS == {"sqlalchemy"}


def test_the_scan_detects_a_conditional_import() -> None:
    conditional = "import os\nif os.getenv('X'):\n    import httpx\n"
    assert imported_roots(conditional) & FORBIDDEN_ROOTS == {"httpx"}


def test_the_scan_allows_the_standard_library() -> None:
    assert not imported_roots("import uuid\nfrom datetime import UTC\n") & FORBIDDEN_ROOTS

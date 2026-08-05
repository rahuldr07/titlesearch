"""The domain package's own guarantees: framework-free, UTC, opaque ids."""

from __future__ import annotations

import itertools
import os.path
import pkgutil
import sys
import uuid
from datetime import UTC
from pathlib import Path

import titlepipe_domain
from titlepipe_domain import (
    Clock,
    DomainError,
    IdFactory,
    RefusalError,
    SystemClock,
    Uuid4IdFactory,
)

FORBIDDEN_IMPORTS = frozenset(
    {
        "fastapi",
        "starlette",
        "sqlalchemy",
        "alembic",
        "psycopg",
        "workos",
        "pgqueuer",
        "procrastinate",
        "boto3",
        "botocore",
        "httpx",
        "google",
        "anthropic",
        "openai",
        "docx",
        "docxtpl",
        "pikepdf",
        "pypdfium2",
    }
)


def test_importing_the_package_pulls_in_no_framework() -> None:
    """A runtime companion to the static scan in `test_import_boundary.py`.

    This catches a framework arriving *transitively* — a dependency of a
    dependency — which the AST scan cannot see because no source file here
    names it. It does **not** catch a lazy import inside a function body:
    importing a module does not execute its function bodies. That case is the
    AST scan's job, and the division of labour is the point.
    """
    before = set(sys.modules)
    package_root = Path(titlepipe_domain.__file__).parent
    for module in pkgutil.iter_modules([str(package_root)]):
        __import__(f"titlepipe_domain.{module.name}")
    newly_imported = {name.split(".")[0] for name in set(sys.modules) - before}

    leaked = newly_imported & FORBIDDEN_IMPORTS
    assert not leaked, f"titlepipe_domain must stay framework-free; imported {leaked}"


def test_system_clock_is_timezone_aware_utc() -> None:
    """A naive datetime reaching the database is a retention bug that only
    shows up across a DST boundary, months later."""
    now = SystemClock().now()
    assert now.tzinfo is not None
    assert now.utcoffset() == UTC.utcoffset(None)


def test_system_clock_satisfies_the_protocol() -> None:
    assert isinstance(SystemClock(), Clock)


def test_id_factory_satisfies_the_protocol() -> None:
    assert isinstance(Uuid4IdFactory(), IdFactory)


def test_identifiers_are_unique() -> None:
    factory = Uuid4IdFactory()
    ids = [factory.new_id() for _ in range(1024)]
    assert len(set(ids)) == len(ids)


def test_identifiers_are_not_enumerable() -> None:
    """The property that matters in a multi-tenant system holding NPI: knowing
    one identifier must not let you guess the next.

    Asserted as "the values carry no shared structure", not merely "they
    differ" — a counter with a fixed prefix also differs every time and is
    trivially enumerable.
    """
    factory = Uuid4IdFactory()
    ids = [factory.new_id() for _ in range(256)]

    # Not integers, and not an integer with a constant prefix.
    for value in ids:
        assert not value.isdigit()

    # No two consecutive identifiers share a long common prefix. A counter
    # would share everything but its last characters.
    for first, second in itertools.pairwise(ids):
        shared = len(os.path.commonprefix([first, second]))
        assert shared < 8, f"{first!r} and {second!r} share a {shared}-character prefix"

    # Each is a well-formed random UUID.
    for value in ids:
        assert uuid.UUID(value).version == 4


def test_every_error_carries_a_stable_code() -> None:
    """Codes are the contract. Messages are copy."""
    seen: dict[str, type[DomainError]] = {}
    stack: list[type[DomainError]] = [DomainError]
    while stack:
        cls = stack.pop()
        stack.extend(cls.__subclasses__())
        assert cls.code, f"{cls.__name__} has no code"
        if cls is not DomainError:
            assert cls.code not in seen, f"{cls.__name__} duplicates {cls.code}"
            seen[cls.code] = cls
    assert "REFUSED" in seen


def test_domain_error_keeps_message_and_details() -> None:
    err = RefusalError("Resolution requires a rule.", details={"field": "resolution"})
    assert err.message == "Resolution requires a rule."
    assert err.details == {"field": "resolution"}
    assert str(err) == "Resolution requires a rule."


def test_domain_error_repr_does_not_leak_details() -> None:
    """`repr` lands in tracebacks and third-party log capture. Details may carry
    context that is safe for a caller but not for a log line, so repr shows the
    code and message only."""
    err = RefusalError("Refused.", details={"order_no": "4171608-1"})
    assert "4171608-1" not in repr(err)

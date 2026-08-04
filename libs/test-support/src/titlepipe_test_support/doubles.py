"""Deterministic implementations of the injected domain protocols."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


class FrozenClock:
    """A clock that only moves when a test moves it.

    Satisfies `titlepipe_domain.Clock`. Rejects naive datetimes at construction
    rather than letting a naive instant reach the code under test, because a
    test that quietly proves the wrong thing is worse than one that fails.
    """

    def __init__(self, at: datetime) -> None:
        if at.tzinfo is None:
            raise ValueError("FrozenClock requires a timezone-aware datetime")
        self._at = at.astimezone(UTC)

    def now(self) -> datetime:
        return self._at

    def advance(self, delta: timedelta) -> None:
        self._at += delta

    def set(self, at: datetime) -> None:
        if at.tzinfo is None:
            raise ValueError("FrozenClock requires a timezone-aware datetime")
        self._at = at.astimezone(UTC)


class SequenceIdFactory:
    """Predictable identifiers for assertions.

    Satisfies `titlepipe_domain.IdFactory`. Produces `<prefix>-000001`. Use only
    in tests: these identifiers are enumerable by construction, which is exactly
    what production must not be.
    """

    def __init__(self, prefix: str = "id") -> None:
        self._prefix = prefix
        self._next = 0

    def new_id(self) -> str:
        self._next += 1
        return f"{self._prefix}-{self._next:06d}"

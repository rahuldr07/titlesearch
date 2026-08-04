"""Time, injected.

Storage and APIs are UTC. Local and business time are rendered at presentation
boundaries only. Domain code takes a `Clock` rather than calling
`datetime.now()` directly, so state-machine and retention tests can pin an
instant without patching module globals.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """Source of the current instant. Always timezone-aware UTC."""

    def now(self) -> datetime: ...


class SystemClock:
    """The production clock."""

    def now(self) -> datetime:
        return datetime.now(UTC)

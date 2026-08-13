"""Identifier generation, injected.

Identifiers are opaque and non-sequential: enumeration is an information leak in
a multi-tenant system holding NPI. Domain code takes an `IdFactory` so tests can
make identifiers deterministic without patching `uuid`.
"""

from __future__ import annotations

import uuid
from typing import Protocol, runtime_checkable


@runtime_checkable
class IdFactory(Protocol):
    """Source of opaque identifiers."""

    def new_id(self) -> str: ...


class Uuid4IdFactory:
    """The production identifier source."""

    def new_id(self) -> str:
        return str(uuid.uuid4())

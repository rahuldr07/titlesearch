"""The doubles must satisfy the protocols they stand in for."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from titlepipe_domain import Clock, IdFactory
from titlepipe_test_support import FrozenClock, SequenceIdFactory


def test_frozen_clock_satisfies_the_clock_protocol() -> None:
    assert isinstance(FrozenClock(datetime(2026, 7, 22, tzinfo=UTC)), Clock)


def test_frozen_clock_does_not_move_on_its_own() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))
    assert clock.now() == clock.now()


def test_frozen_clock_advances_only_when_told() -> None:
    clock = FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))
    clock.advance(timedelta(hours=3))
    assert clock.now() == datetime(2026, 7, 22, 15, 0, tzinfo=UTC)


def test_frozen_clock_rejects_a_naive_datetime() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        FrozenClock(datetime(2026, 7, 22, 12, 0))  # noqa: DTZ001


def test_frozen_clock_normalises_to_utc() -> None:
    from datetime import timezone

    eastern = timezone(timedelta(hours=-4))
    clock = FrozenClock(datetime(2026, 7, 22, 8, 0, tzinfo=eastern))
    assert clock.now() == datetime(2026, 7, 22, 12, 0, tzinfo=UTC)


def test_sequence_id_factory_satisfies_the_protocol() -> None:
    assert isinstance(SequenceIdFactory(), IdFactory)


def test_sequence_ids_are_predictable_and_prefixed() -> None:
    factory = SequenceIdFactory("order")
    assert [factory.new_id() for _ in range(3)] == [
        "order-000001",
        "order-000002",
        "order-000003",
    ]

"""Deterministic test doubles.

Factories only. No production secrets, no real client data, no county packages,
no seed fixtures — this package is imported by test suites in every service and
anything placed here spreads to all of them.
"""

from titlepipe_test_support.doubles import FrozenClock, SequenceIdFactory

__all__ = ["FrozenClock", "SequenceIdFactory"]

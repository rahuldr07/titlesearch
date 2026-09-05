"""Deterministic test doubles.

Factories only. No production secrets, no real client data, no county packages,
no seed fixtures — this package is imported by test suites in every service and
anything placed here spreads to all of them.
"""

from titlepipe_test_support.doubles import FrozenClock, SequenceIdFactory
from titlepipe_test_support.log_fields import emitted_log_fields, log_call_sites

__all__ = [
    "FrozenClock",
    "SequenceIdFactory",
    "emitted_log_fields",
    "log_call_sites",
]

"""Redaction keys that exist only in the blind service.

The shared rules in `titlepipe_domain.redaction` cover NPI, document content
and credentials — everything every service must remove.

These are additional, and they are additional because of what this service is.
A blind typist must never see model output or the other seat's entry, and the
guarantee is topological: none of this data is reachable from this process.
So a field named for an engine, a reading, a confidence or the other seat
should not exist here *at all*, and its appearance in a log record is evidence
of a boundary failure rather than an ordinary logging mistake.

Redacting them keeps such a failure out of the log shipper.
`tests/test_blind_boundary.py` is what keeps it out of the code.
"""

from __future__ import annotations

from typing import Final

BLIND_SENSITIVE_KEY_PARTS: Final[frozenset[str]] = frozenset(
    {
        "engine",
        "reading",
        "confidence",
        "model",
        "extraction",
        "auto_confirm",
        "other_seat",
        "seat_a",
        "seat_b",
        "golden",
        "reconciliation",
    }
)

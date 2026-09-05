"""The redaction tables, checked against what this service actually logs.

## Why this file exists

`libs/domain/redaction.py` holds two tables — a blocklist of key substrings and
an allowlist of field names — and a field must clear both. `task_name` was in
neither. `"name"` is a blocklist substring and the match is a SUBSTRING test, so
`task_name` was scrubbed from every log line in every environment:
`stalled_job_retried` and `stalled_job_abandoned`, the two lines an operator
gets when the queue is losing work, could not say what work was lost.

The same class of bug had already been found once — `job_name` and `queue_name`
carry a comment in `SAFE_KEY_EXCEPTIONS` saying a whole-table test now covers
it. That test, `test_every_allowlisted_diagnostic_actually_survives`, iterates
the allowlist. **A test that iterates the allowlist can only ever confirm what
is already in the allowlist.** `task_name` was in neither table, so there was
nothing for it to walk, and the suite stayed green through the whole thing.

So this file asserts from the other end: it parses this package for the field
names really passed to a logger and checks those. A field that is emitted but
classified nowhere fails here at the moment it is written.

## The two questions, asked separately

A field can be dropped for two unrelated reasons, and collapsing them would
hide one behind the other:

* **the blocklist**, which applies in every environment. Being dropped here is
  never intended — it is the `task_name` bug. Asserted with no exemptions.
* **the allowlist**, which applies only when deployed and whose default is to
  drop. Being dropped here may be perfectly correct, so what is asserted is
  that every emitted field is *classified* — allowed, or named in
  `NOT_IN_THE_DEPLOYED_ALLOWLIST` below with the gap recorded. A new field
  fails until someone puts it in one bucket or the other, which is the review
  conversation `redaction.py` says it wants.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import titlepipe_worker
from titlepipe_domain.redaction import is_allowed_key, is_sensitive_key
from titlepipe_test_support import emitted_log_fields, log_call_sites

PACKAGE_ROOT = Path(titlepipe_worker.__file__).parent
EMITTED = emitted_log_fields(PACKAGE_ROOT)

# Fields this package is known to log, named here so the scan cannot silently
# stop finding call sites. A scanner that returns nothing passes every
# parametrised assertion below by having none to run — the vacuous green this
# whole file exists to replace — and the first version of `_is_logger_reference`
# did exactly that to core-api, whose receiver is a call (`_log().error(...)`)
# rather than a name.
#
# `task_name` is first because it is the one that was broken.
KNOWN_CALL_SITES = frozenset({"task_name", "job_id", "attempts", "queue"})

# Emitted, and dropped when deployed because the allowlist has never been told
# about them. THIS IS A RECORDED GAP, NOT AN ENDORSEMENT: every one of these is
# work identity or a bounded counter, none is client-derived, and an operator
# reading production logs currently sees `stalled_job_retried` with its job id,
# queue, attempt count and retry ceiling all `[redacted]`. Adding a name to
# `SAFE_DIAGNOSTIC_KEYS` decides what a deployed environment prints, which is a
# ruling on a shared compliance table rather than a test's to make — so the gap
# is recorded here, where it is counted and cannot rot, instead of being fixed
# quietly on the way past.
NOT_IN_THE_DEPLOYED_ALLOWLIST = frozenset(
    {
        "abandoned",
        "attempts",
        "concurrency",
        "job_id",
        "max_stall_retries",
        "queue",
        "queue_configured",
        "queues",
        "retried",
        "seconds_since_heartbeat",
        "stalled_found",
    }
)


def test_there_is_something_to_scan() -> None:
    """A scan of zero call sites passes every assertion below vacuously, which
    is the failure mode this kind of test is most prone to."""
    sources = sorted(PACKAGE_ROOT.rglob("*.py"))
    assert sources, f"no sources found under {PACKAGE_ROOT}"
    assert any(log_call_sites(path.read_text(encoding="utf-8")) for path in sources), (
        "the scanner found no logger calls in a package that logs"
    )


def test_the_scan_finds_the_known_call_sites() -> None:
    """Names four fields the source demonstrably passes to a logger.

    If a refactor changes how this package reaches its logger and the scanner
    stops recognising the receiver, this fails loudly rather than shrinking the
    coverage of everything below it to nothing.
    """
    missing = sorted(KNOWN_CALL_SITES - EMITTED.keys())
    assert not missing, f"the scanner no longer sees {missing}; it is not reading the call sites"


@pytest.mark.parametrize("field", sorted(EMITTED))
def test_every_emitted_field_survives_the_blocklist(field: str) -> None:
    """No field this service logs may be caught by a sensitive-key substring.

    No exemption list, deliberately. A field that is genuinely sensitive must
    not be passed to a logger at all — the fix is at the call site, never here.
    """
    assert not is_sensitive_key(field), (
        f"{field} is logged by "
        f"{sorted(path.name for path in EMITTED[field])} but the blocklist "
        f"scrubs it in every environment; add it to SAFE_KEY_EXCEPTIONS if it "
        f"is work identity rather than a person, or stop logging it"
    )


@pytest.mark.parametrize("field", sorted(EMITTED))
def test_every_emitted_field_is_classified_for_a_deployed_environment(field: str) -> None:
    """Allowed when deployed, or recorded above as a known gap. Not neither.

    `is_allowed_key` is asked with a non-string value, which is the permissive
    reading: it is the only one that lets a `_count`/`_seconds` suffix through,
    and asking with a string here would report a numeric field as unclassified
    on a technicality about a value this test never sees.
    """
    if is_allowed_key(field, 1):
        return
    assert field in NOT_IN_THE_DEPLOYED_ALLOWLIST, (
        f"{field} is logged by {sorted(path.name for path in EMITTED[field])} "
        f"and a deployed environment drops it. Add it to SAFE_DIAGNOSTIC_KEYS "
        f"if an operator needs it, or record it in "
        f"NOT_IN_THE_DEPLOYED_ALLOWLIST with why they do not"
    )


def test_the_recorded_gap_holds_nothing_stale() -> None:
    """The gap list must shrink when the allowlist grows, and must not name a
    field this package no longer logs — otherwise it becomes a place entries go
    to be forgotten."""
    now_allowed = sorted(f for f in NOT_IN_THE_DEPLOYED_ALLOWLIST if is_allowed_key(f, 1))
    assert not now_allowed, (
        f"{now_allowed} are on the deployed allowlist now; drop them from the gap list"
    )

    no_longer_logged = sorted(NOT_IN_THE_DEPLOYED_ALLOWLIST - EMITTED.keys())
    assert not no_longer_logged, (
        f"{no_longer_logged} are no longer logged; drop them from the gap list"
    )

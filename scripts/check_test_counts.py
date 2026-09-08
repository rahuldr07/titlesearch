"""Refuse a test run that executed nothing.

A suite that collects zero tests, or skips everything it collected, exits 0
on every runner this repository uses — and a green job that ran nothing is
quoted as evidence exactly like one that ran the suite. This gate reads the
JUnit XML the runner itself wrote, because runner stdout is a display format:
this repo's pytest prints a custom collect line that has already been
mis-parsed once.

Usage:

    python scripts/check_test_counts.py <junit.xml> [<label>]

Exits non-zero when the file is missing or unparseable, or when the number of
executed tests (collected minus skipped) is zero. Prints the counts either
way, so the job log carries the measurement, not just the verdict.
"""

from __future__ import annotations

import sys
from pathlib import Path

# The XML is produced by this repository's own test runner in the same job,
# not received from outside; defusedxml would add a dependency to a project
# that is deliberately standard-library only.
from xml.etree import ElementTree


def counts(junit_xml: Path) -> tuple[int, int]:
    """Return (collected, skipped) summed over every <testsuite> element."""
    root = ElementTree.parse(junit_xml).getroot()  # noqa: S314 — see module note
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    collected = sum(int(s.get("tests", "0")) for s in suites)
    skipped = sum(int(s.get("skipped", "0")) for s in suites)
    return collected, skipped


def main(argv: list[str]) -> int:
    if not argv or len(argv) > 2:
        print("usage: check_test_counts.py <junit.xml> [<label>]")
        return 2
    junit_xml = Path(argv[0])
    label = argv[1] if len(argv) == 2 else junit_xml.name

    if not junit_xml.exists():
        print(f"FAIL {label}: {junit_xml} does not exist — the runner wrote no report")
        return 1
    try:
        collected, skipped = counts(junit_xml)
    except ElementTree.ParseError as error:
        print(f"FAIL {label}: {junit_xml} is not parseable JUnit XML ({error})")
        return 1

    executed = collected - skipped
    print(f"{label}: collected={collected} skipped={skipped} executed={executed}")
    if executed <= 0:
        print(f"FAIL {label}: the run executed no tests; a green exit proves nothing")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

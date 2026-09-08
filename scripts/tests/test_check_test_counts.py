"""The zero-test gate.

The failure class it exists for: a required suite that collects nothing (or
skips everything) and exits 0, turning "ran no tests" into a green check.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_test_counts import counts, main


def junit(tmp_path: Path, body: str) -> Path:
    report = tmp_path / "junit.xml"
    report.write_text(body, encoding="utf-8")
    return report


def test_a_normal_run_passes_and_prints_the_counts(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    report = junit(tmp_path, '<testsuite tests="12" skipped="2"></testsuite>')
    assert main([str(report), "unit"]) == 0
    assert "collected=12 skipped=2 executed=10" in capsys.readouterr().out


def test_zero_collected_fails(tmp_path: Path) -> None:
    report = junit(tmp_path, '<testsuite tests="0" skipped="0"></testsuite>')
    assert main([str(report)]) == 1


def test_everything_skipped_fails(tmp_path: Path) -> None:
    """pytest exits 0 on an all-skipped run; this gate must not."""
    report = junit(tmp_path, '<testsuite tests="7" skipped="7"></testsuite>')
    assert main([str(report)]) == 1


def test_suites_are_summed_under_a_testsuites_root(tmp_path: Path) -> None:
    report = junit(
        tmp_path,
        '<testsuites><testsuite tests="3" skipped="3"/>'
        '<testsuite tests="4" skipped="1"/></testsuites>',
    )
    assert counts(report) == (7, 4)
    assert main([str(report)]) == 0


def test_a_missing_report_fails(tmp_path: Path) -> None:
    """A runner that crashed before writing the report must not read as green."""
    assert main([str(tmp_path / "never-written.xml")]) == 1


def test_an_unparseable_report_fails(tmp_path: Path) -> None:
    report = junit(tmp_path, "collected 0 items\n")
    assert main([str(report)]) == 1


def test_usage_error_on_wrong_arity() -> None:
    assert main([]) == 2
    assert main(["a", "b", "c"]) == 2

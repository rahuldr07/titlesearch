"""The lock check's refusals.

Same class as FX-40: a PROJECTS entry that matches nothing on disk used to
"skip" and return success, which retires the check for that project silently.
The drift check itself (`uv lock --check`) is exercised for real in CI's
per-project `uv sync --frozen`; these tests cover the entry-point paths that
never reach uv.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_locks import PROJECTS, check


def test_a_name_that_is_no_project_fails(capsys: pytest.CaptureFixture[str]) -> None:
    assert check("services/typo-api") is False
    assert "no such project" in capsys.readouterr().out


def test_every_declared_project_exists() -> None:
    repo = Path(__file__).resolve().parent.parent.parent
    for project in PROJECTS:
        assert (repo / project / "pyproject.toml").exists(), project

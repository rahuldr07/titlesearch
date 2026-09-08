"""The dependency-audit entry point's refusals (FX-40).

The failure class: a mistyped project name reached a "skip (no uv.lock)"
branch that returned success, so a wrong CI matrix entry silently deleted the
audit while the job stayed green. A name that is not a project must fail.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import audit_dependencies
from audit_dependencies import PROJECTS, audit, main


def test_a_mistyped_project_name_fails(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["services/typo-api"]) == 1
    assert "no such project" in capsys.readouterr().out


def test_a_project_without_a_lock_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "bare").mkdir()
    (tmp_path / "bare" / "pyproject.toml").write_text("[project]\nname='bare'\n")
    monkeypatch.setattr(audit_dependencies, "REPO_ROOT", tmp_path)
    assert audit("bare") is False


def test_every_declared_project_exists_with_a_lock() -> None:
    """The PROJECTS tuple is checked against the tree, so it cannot rot."""
    repo = Path(__file__).resolve().parent.parent.parent
    for project in PROJECTS:
        assert (repo / project / "pyproject.toml").exists(), project
        assert (repo / project / "uv.lock").exists(), project

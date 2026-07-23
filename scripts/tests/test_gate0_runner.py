"""Safety tests for the destructive edge of the Gate 0 reproduction runner."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "gate0"))

import run_prototype_suite as runner


def archive_at(root: Path) -> Path:
    archive = root / "archive"
    (archive / "titlepipe").mkdir(parents=True)
    (archive / "bugfixes").mkdir()
    (archive / "titlepipe" / "source.py").write_text("value = 1\n", encoding="utf-8")
    return archive


def test_rebuild_refuses_an_existing_unowned_directory(tmp_path: Path) -> None:
    archive = archive_at(tmp_path)
    worktree = tmp_path / "important-user-directory"
    worktree.mkdir()
    sentinel = worktree / "keep-me.txt"
    sentinel.write_text("user data\n", encoding="utf-8")

    with pytest.raises(SystemExit, match="refusing to replace unowned worktree"):
        runner.rebuild_worktree(archive, worktree)

    assert sentinel.read_text(encoding="utf-8") == "user data\n"


def test_rebuild_replaces_only_a_runner_owned_directory(tmp_path: Path) -> None:
    archive = archive_at(tmp_path)
    worktree = tmp_path / "generated-worktree"
    worktree.mkdir()
    (worktree / runner.WORKTREE_SENTINEL).write_text(
        runner.WORKTREE_SENTINEL_CONTENT,
        encoding="utf-8",
    )
    stale = worktree / "stale.txt"
    stale.write_text("stale\n", encoding="utf-8")

    runner.rebuild_worktree(archive, worktree)

    assert not stale.exists()
    assert (worktree / "titlepipe" / "source.py").read_text(encoding="utf-8") == "value = 1\n"
    assert (worktree / runner.WORKTREE_SENTINEL).read_text(encoding="utf-8") == (
        runner.WORKTREE_SENTINEL_CONTENT
    )


def test_rebuild_refuses_the_repository_and_archive_trees(tmp_path: Path) -> None:
    archive = archive_at(tmp_path)

    with pytest.raises(SystemExit, match="protected path"):
        runner.validate_worktree_target(archive, runner.REPO_ROOT)
    with pytest.raises(SystemExit, match="protected path"):
        runner.validate_worktree_target(archive, archive)


def test_gate0_dependency_lock_is_exact() -> None:
    requirements = [
        line
        for line in runner.DEPENDENCY_LOCK.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#")
    ]

    assert requirements
    assert all(line.count("==") == 1 for line in requirements)

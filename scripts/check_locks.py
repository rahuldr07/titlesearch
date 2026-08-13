"""Verify every Python project's `uv.lock` matches its `pyproject.toml`.

A drifted lock means the image and the manifest disagree about what is
installed, and `--frozen` in CI or in a container build then fails at the least
convenient moment. Catching it in a pre-commit hook costs a second.

Each project is checked on its own. They are separate deployables with separate
locks by design, so there is no combined command that could answer this.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PROJECTS = (
    "scripts",
    "libs/domain",
    "libs/test-support",
    "services/core-api",
    "services/blind-svc",
    "services/extraction-svc",
    "services/render-svc",
)


def check(project: str) -> bool:
    directory = REPO_ROOT / project
    if not (directory / "pyproject.toml").exists():
        print(f"  skip {project} (no pyproject.toml)")
        return True

    result = subprocess.run(
        ["uv", "lock", "--check"],  # noqa: S607 — uv is required tooling, resolved from PATH
        cwd=directory,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0:
        print(f"  ok   {project}")
        return True

    print(f"  FAIL {project}")
    for line in (result.stderr or result.stdout).splitlines():
        print(f"       {line}")
    return False


def main() -> int:
    print("Checking uv locks:")
    # Every project is checked before returning, so one run lists everything
    # that needs attention rather than stopping at the first failure.
    ok = True
    for project in PROJECTS:
        if not check(project):
            ok = False
    if ok:
        return 0
    print("\nA lock is out of date. Run `uv lock` in the failing project.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

"""Run one named check across every Python project in the repository.

This is the single home for "which Python projects exist" as far as the root
pnpm commands are concerned: projects are discovered from the filesystem
(`scripts/` plus every `libs/*` and `services/*` directory holding a
`pyproject.toml`), so a new project is covered on the commit that creates it.
The CI matrix in `.github/workflows/backend.yml` keeps its own explicit list,
guarded by scripts/tests/test_backend_workflow.py.

A discovered project without a `uv.lock` is a FAILURE named by project, not a
skip: `audit_dependencies.py` printing "skip (no uv.lock)" and exiting 0 is the
exact hole this script refuses to reproduce. Likewise a missing prerequisite
(uv; a reachable Docker daemon for the integration subset) is named and fatal.

The commands themselves are the ones CI already runs per project; nothing is
reimplemented here, only iterated.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

CHECKS: dict[str, tuple[str, ...]] = {
    "format-check": ("uv", "run", "ruff", "format", "--check", "."),
    "format": ("uv", "run", "ruff", "format", "."),
    "lint": ("uv", "run", "ruff", "check", "."),
    "typecheck": ("uv", "run", "pyright"),
    "test": ("uv", "run", "pytest"),
}


def discover_projects() -> list[Path]:
    candidates = [REPO_ROOT / "scripts"]
    for parent in (REPO_ROOT / "libs", REPO_ROOT / "services"):
        candidates.extend(sorted(parent.iterdir()))
    return [d for d in candidates if (d / "pyproject.toml").is_file()]


def is_integration_project(project: Path) -> bool:
    # The integration suites are the ones that stand up postgres:18.4 through
    # testcontainers; declaring the dependency is what marks a project, so the
    # split cannot drift from what the suites actually need.
    text = (project / "pyproject.toml").read_text(encoding="utf-8")
    return "testcontainers" in text


def fail(message: str) -> int:
    print(f"run_python_checks: {message}", file=sys.stderr)
    return 1


def docker_daemon_reachable() -> bool:
    if shutil.which("docker") is None:
        return False
    result = subprocess.run(
        ["docker", "info"],  # noqa: S607 — docker is required tooling, resolved from PATH
        capture_output=True,
        check=False,
    )
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("check", choices=sorted(CHECKS))
    parser.add_argument("--projects", choices=("all", "unit", "integration"), default="all")
    args = parser.parse_args()

    if shutil.which("uv") is None:
        return fail(
            "missing prerequisite: uv is not on PATH "
            "(https://docs.astral.sh/uv/ — every Python project here runs through it)"
        )

    projects = discover_projects()
    if not projects:
        return fail(f"no Python projects found under {REPO_ROOT} — wrong working tree?")

    unlocked = [p for p in projects if not (p / "uv.lock").is_file()]
    if unlocked:
        names = ", ".join(str(p.relative_to(REPO_ROOT)) for p in unlocked)
        return fail(f"project without uv.lock: {names} (run `uv lock` there; refusing to skip it)")

    if args.projects == "unit":
        projects = [p for p in projects if not is_integration_project(p)]
    elif args.projects == "integration":
        projects = [p for p in projects if is_integration_project(p)]
        if not docker_daemon_reachable():
            return fail(
                "missing prerequisite: no reachable Docker daemon "
                "(the integration suites start postgres:18.4 via testcontainers)"
            )

    command = CHECKS[args.check]
    failed: list[str] = []
    for project in projects:
        name = str(project.relative_to(REPO_ROOT))
        print(f"── {args.check} · {name}", flush=True)
        result = subprocess.run(command, cwd=project, check=False)  # noqa: S603
        if result.returncode != 0:
            failed.append(name)

    print(f"── {args.check}: {len(projects) - len(failed)}/{len(projects)} projects passed")
    if failed:
        for name in failed:
            print(f"   FAIL {name}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

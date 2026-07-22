"""Audit a project's locked runtime dependencies for known vulnerabilities.

Exports the frozen lock to a hash-pinned requirements file and runs `pip-audit`
over it. Auditing the *lock* rather than the installed environment is what makes
the result reproducible: it is the same set of versions the container will get.

Local path packages are excluded. `titlepipe-domain` and
`titlepipe-test-support` are first-party, are not on any index, and appear in
the export as editable requirements without hashes, which `--strict` correctly
refuses. They are covered by their own project's audit.

Used by CI and runnable by hand:

    python scripts/audit_dependencies.py                    # every project
    python scripts/audit_dependencies.py services/core-api  # one project
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PROJECTS = (
    "libs/domain",
    "libs/test-support",
    "services/core-api",
    "services/blind-svc",
    "services/extraction-svc",
    "services/render-svc",
)

# First-party path packages: no index, no hashes, audited in their own right.
LOCAL_PACKAGES = ("titlepipe-domain", "titlepipe-test-support")

PIP_AUDIT_VERSION = "pip-audit==2.*"


def audit(project: str) -> bool:
    directory = REPO_ROOT / project
    if not (directory / "uv.lock").exists():
        print(f"  skip {project} (no uv.lock)")
        return True

    with tempfile.TemporaryDirectory() as workspace:
        requirements = Path(workspace) / "requirements.txt"
        export = ["uv", "export", "--frozen", "--no-dev", "--no-emit-project"]
        for package in LOCAL_PACKAGES:
            export += ["--no-emit-package", package]
        export += ["-o", str(requirements)]

        # S603: the argv is built here from constants, never from user input.
        exported = subprocess.run(  # noqa: S603
            export, cwd=directory, capture_output=True, text=True, check=False
        )
        if exported.returncode != 0:
            print(f"  FAIL {project} (export failed)")
            print(f"       {exported.stderr.strip()}")
            return False

        # `libs/domain` has no third-party runtime dependencies at all, and
        # `libs/test-support` has only the first-party package excluded above.
        # The export is then a comment-only file, which pip-audit rejects
        # because there is nothing hashed to audit. Nothing to audit is a pass,
        # and saying so is clearer than passing `--no-deps` to silence it.
        requirement_lines = [
            line
            for line in requirements.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.lstrip().startswith(("#", "-"))
        ]
        if not requirement_lines:
            print(f"  ok   {project} (no third-party runtime dependencies)")
            return True

        audited = subprocess.run(  # noqa: S603
            [  # noqa: S607 — uvx is required tooling, resolved from PATH
                "uvx",
                PIP_AUDIT_VERSION,
                "--strict",
                "--disable-pip",
                "-r",
                str(requirements),
            ],
            cwd=directory,
            capture_output=True,
            text=True,
            check=False,
        )

    if audited.returncode == 0:
        print(f"  ok   {project}")
        return True

    print(f"  FAIL {project}")
    for line in (audited.stdout + audited.stderr).splitlines():
        print(f"       {line}")
    return False


def main(argv: list[str]) -> int:
    projects = tuple(argv) if argv else PROJECTS
    print("Auditing locked dependencies:")
    # Every project is audited before returning, so one run lists everything
    # that needs attention rather than stopping at the first failure.
    ok = True
    for project in projects:
        if not audit(project):
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

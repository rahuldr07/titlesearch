"""Run the recovered prototype's suite against synthetic fixtures.

Gate 0's exit criterion is the recovered suite green. It could not be met: 10
of 155 tests assert against a real county search package and five delivered
client reports, none of which may enter VCS. So they failed on this machine and
would have failed in CI forever.

This regenerates synthetic replacements, installs the v14 R15 guard, and runs
everything, so "155 green" is a command anyone can re-run rather than a claim.

    python scripts/gate0/run_prototype_suite.py

## Prerequisites

- The recovered prototype at `%LOCALAPPDATA%\\TitlePipe\\gate0-worktree\\titlepipe`
  (copy it from the frozen archive; see `docs/backend/GATE_0_ARCHIVE_MANIFEST.md`).
- `pdftotext` on PATH. It ships with Git for Windows at
  `C:\\Program Files\\Git\\mingw64\\bin` but is **not** on the Windows PATH by
  default, which is why `--pdftotext-dir` exists.

`pdftoppm` and `tesseract` are deliberately not required: the synthetic package
is born-digital, so segmentation never reaches the OCR path.

## What the synthetic fixtures do and do not prove

They prove the *mechanisms*: order fields required at the door, duplicate
detection, content hashing, segment-on-upload with all three segmentation
states, the seed parser, `ORDER_SUPPLIED` exclusion, and the seven corrections
arriving tagged `ruled`.

They cannot prove the *content* of the seven known defects. That Anchorage's
card really reads 843,000, that Greene really has four mortgages — those are
literals in `seed.CORRECTIONS`, asserted directly, and re-verifying them
requires the real documents. This is stated in `docs/backend/GATE_0_RECOVERY.md`
and is the standing limitation of closing the gate this way.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
HERE = Path(__file__).resolve().parent

DEFAULT_WORKTREE = Path(os.environ.get("LOCALAPPDATA", "")) / "TitlePipe" / "gate0-worktree"
GIT_POPPLER_DIR = Path(r"C:\Program Files\Git\mingw64\bin")

PACKAGE_FIXTURE = "tests/fixtures/4171608-1_-_Search_Package.pdf"


def run(command: list[str], cwd: Path, env: dict[str, str]) -> int:
    print(f"\n$ {' '.join(command)}   (in {cwd})")
    return subprocess.run(command, cwd=cwd, env=env, check=False).returncode  # noqa: S603


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worktree", type=Path, default=DEFAULT_WORKTREE)
    parser.add_argument(
        "--pdftotext-dir",
        type=Path,
        default=GIT_POPPLER_DIR,
        help="directory containing pdftotext; prepended to PATH",
    )
    args = parser.parse_args()

    prototype = args.worktree / "titlepipe"
    seed_root = args.worktree / "seed-root"
    python = prototype / ".venv" / "Scripts" / "python.exe"
    if not python.exists():
        python = prototype / ".venv" / "bin" / "python"

    if not prototype.exists():
        print(f"prototype not found at {prototype}", file=sys.stderr)
        print(
            "Copy it from the frozen archive first — see docs/backend/GATE_0_ARCHIVE_MANIFEST.md",
            file=sys.stderr,
        )
        return 2
    if not python.exists():
        print(f"no virtualenv at {prototype / '.venv'}", file=sys.stderr)
        print("  uv venv --python 3.13 .venv", file=sys.stderr)
        print(
            "  uv pip install --python .venv/Scripts/python.exe "
            "pytest pypdf pillow flask python-docx",
            file=sys.stderr,
        )
        return 2

    env = dict(os.environ)
    if args.pdftotext_dir.exists():
        env["PATH"] = f"{args.pdftotext_dir}{os.pathsep}{env.get('PATH', '')}"
    env["TITLEPIPE_SEED_ROOT"] = str(seed_root)

    if shutil.which("pdftotext", path=env["PATH"]) is None:
        print("pdftotext not on PATH; segmentation and the seed parser need it", file=sys.stderr)
        return 2

    print("=== regenerating synthetic fixtures ===")
    package_path = prototype / PACKAGE_FIXTURE
    if run(
        [str(python), str(HERE / "make_synthetic_package.py"), str(package_path)],
        cwd=REPO_ROOT,
        env=env,
    ):
        return 1
    if run(
        [str(python), str(HERE / "make_synthetic_reports.py"), str(seed_root)],
        cwd=REPO_ROOT,
        env=env,
    ):
        return 1

    print("\n=== installing the v14 R15 guard ===")
    shutil.copy2(HERE / "test_v14_r15.py", prototype / "tests" / "test_v14_r15.py")
    print(f"copied test_v14_r15.py -> {prototype / 'tests'}")

    print("\n=== package suite ===")
    package_rc = run([str(python), "-m", "pytest", "tests/", "-q"], cwd=prototype, env=env)

    print("\n=== bug-fix patch suite (24 tests, still unmerged) ===")
    bugfix_rc = 0
    for module in ("fix_segment.py", "fix_assemble.py", "fix_api.py"):
        rc = run(
            [str(python), "-m", "unittest", "discover", "-s", "bugfixes", "-p", module],
            cwd=args.worktree,
            env=env,
        )
        bugfix_rc = bugfix_rc or rc

    print("\n" + "=" * 60)
    print(f"package suite : {'PASS' if package_rc == 0 else 'FAIL'}")
    print(f"patch suite   : {'PASS' if bugfix_rc == 0 else 'FAIL'}")
    print("=" * 60)
    return package_rc or bugfix_rc


if __name__ == "__main__":
    sys.exit(main())

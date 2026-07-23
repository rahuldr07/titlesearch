"""Run the recovered prototype's suite against synthetic fixtures.

Gate 0's exit criterion is the recovered suite green. It could not be met as
recovered: 10 of 155 tests assert against a real county search package and five
delivered client reports, none of which may enter VCS. They failed on this
machine and would have failed in CI forever.

This rebuilds the worktree from the frozen archive, applies the closure patch,
regenerates synthetic replacements, installs the v14 guard and runs everything —
so the green suite is a command anyone can re-run rather than a claim.

    python scripts/gate0/run_prototype_suite.py --fresh

## What review corrected here

The earlier version copied only the v14 *test* and never applied
`gate0-closure.patch`. From a clean archive that produced 8 failures while the
documentation claimed one-command reproduction — the green result had come from
a worktree already fixed by hand.

It now applies the patch and **refuses to run the suite unless the closure is
verifiably present**, so that cannot happen again.

## Prerequisites

- The frozen archive at `%LOCALAPPDATA%\\TitlePipe\\gate0-prototype-archive`
  (see `docs/backend/GATE_0_ARCHIVE_MANIFEST.md`). `--fresh` rebuilds the
  worktree from it, which is the mode that proves reproduction.
- `git`, to apply the patch.
- `uv`, if `--fresh` needs to create the virtualenv.
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
requires the real documents. Stated in `docs/backend/GATE_0_RECOVERY.md` §11a
as the standing limitation of closing the gate this way.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
HERE = Path(__file__).resolve().parent

LOCAL_APPDATA = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local"))
DEFAULT_ARCHIVE = LOCAL_APPDATA / "TitlePipe" / "gate0-prototype-archive"
DEFAULT_WORKTREE = LOCAL_APPDATA / "TitlePipe" / "gate0-worktree"
GIT_POPPLER_DIR = Path(r"C:\Program Files\Git\mingw64\bin")

CLOSURE_PATCH = HERE / "gate0-closure.patch"

CRLF = b"\r\n"
LF = b"\n"

# The ingest test opens one hardcoded fixture path. It is a real client order
# number and delivered-package filename, so it is read out of the prototype at
# run time rather than copied into this repository.
PACKAGE_FIXTURE_RE = re.compile(r"""^PKG\s*=\s*["'](?P<path>[^"']+)["']""", re.M)

# The closure is present iff every one of these is. Probed rather than assumed,
# so a partially-applied patch fails here instead of surprising someone later.
CLOSURE_MARKERS: tuple[tuple[str, str], ...] = (
    ("titlepipe/validators.py", "def v14_liens_survive_chain_termination"),
    ("titlepipe/validators.py", "FORBIDDEN_SUPPRESSIONS"),
    ("titlepipe/assemble.py", "_all_lien_documents"),
    ("titlepipe/seed.py", "def _docx_text"),
    ("tests/test_seed.py", "TITLEPIPE_SEED_ROOT"),
)

DEPENDENCIES = ("pytest", "pypdf", "pillow", "flask", "python-docx")


def run(command: list[str], cwd: Path, env: dict[str, str]) -> int:
    print(f"\n$ {' '.join(command)}   (in {cwd})")
    return subprocess.run(command, cwd=cwd, env=env, check=False).returncode  # noqa: S603


def package_fixture_path(prototype: Path) -> str:
    """Where `tests/test_ingest.py` expects its package fixture."""
    source = (prototype / "tests" / "test_ingest.py").read_text(encoding="utf-8")
    match = PACKAGE_FIXTURE_RE.search(source)
    if not match:
        raise SystemExit("could not find PKG in tests/test_ingest.py")
    return match.group("path")


def missing_markers(prototype: Path) -> list[str]:
    absent: list[str] = []
    for relative, marker in CLOSURE_MARKERS:
        path = prototype / relative
        if not path.exists() or marker not in path.read_text(encoding="utf-8"):
            absent.append(f"{relative}: {marker}")
    return absent


def diff_body(patch: Path) -> bytes:
    """The patch minus its prose header, as bytes.

    `git apply` wants a diff; the header explains four decisions that would
    otherwise live somewhere a reader would not find them.
    """
    text = patch.read_bytes()
    start = text.find(b"--- a/")
    if start < 0:
        raise SystemExit(f"{patch} contains no diff")
    return text[start:]


def rebuild_worktree(archive: Path, worktree: Path) -> None:
    if not archive.exists():
        raise SystemExit(
            f"frozen archive not found at {archive}\nSee docs/backend/GATE_0_ARCHIVE_MANIFEST.md."
        )
    if worktree.exists():
        shutil.rmtree(worktree, ignore_errors=True)
    worktree.mkdir(parents=True)
    for name in ("titlepipe", "bugfixes"):
        shutil.copytree(archive / name, worktree / name)

    # Build artefacts of an earlier run are not part of the artefact.
    for junk in ("__pycache__", ".pytest_cache"):
        for path in worktree.rglob(junk):
            shutil.rmtree(path, ignore_errors=True)

    # Normalise to LF before patching. The committed patch is LF; if a future
    # re-zip of the archive stores CRLF, every context line would differ and
    # `git apply` would reject a pristine tree. Line endings are meaningless to
    # Python, so normalising is free insurance against a confusing failure.
    normalised = 0
    for path in worktree.rglob("*.py"):
        raw = path.read_bytes()
        lf = raw.replace(CRLF, LF)
        if lf != raw:
            path.write_bytes(lf)
            normalised += 1
    print(f"rebuilt {worktree} from {archive} ({normalised} file(s) normalised to LF)")


def ensure_venv(prototype: Path, env: dict[str, str]) -> Path:
    for candidate in (
        prototype / ".venv" / "Scripts" / "python.exe",
        prototype / ".venv" / "bin" / "python",
    ):
        if candidate.exists():
            return candidate

    if shutil.which("uv") is None:
        raise SystemExit(f"no virtualenv at {prototype / '.venv'} and uv is not on PATH")
    print(f"creating a virtualenv in {prototype}")
    if run(["uv", "venv", "--python", "3.13", ".venv"], cwd=prototype, env=env):
        raise SystemExit("uv venv failed")
    python = prototype / ".venv" / "Scripts" / "python.exe"
    if not python.exists():
        python = prototype / ".venv" / "bin" / "python"
    if run(
        ["uv", "pip", "install", "--python", str(python), *DEPENDENCIES],
        cwd=prototype,
        env=env,
    ):
        raise SystemExit("dependency install failed")
    return python


def apply_closure(prototype: Path, env: dict[str, str]) -> None:
    """Apply the closure patch, then prove it took."""
    absent = missing_markers(prototype)
    if not absent:
        print("closure already present")
        return

    print(f"applying {CLOSURE_PATCH.name} ({len(absent)} marker(s) absent)")

    # Staged to a file rather than piped. A text-mode pipe rewrites LF to CRLF
    # on Windows, so git sees a diff whose context matches nothing and reports
    # "patch does not apply" against a pristine tree — a failure that looks like
    # a corrupt archive and is not. A file has no such ambiguity, and it is what
    # a person would run by hand anyway.
    with tempfile.TemporaryDirectory() as workspace:
        staged = Path(workspace) / "gate0-closure.diff"
        staged.write_bytes(diff_body(CLOSURE_PATCH))
        result = subprocess.run(  # noqa: S603
            ["git", "apply", "-p1", "--whitespace=nowarn", str(staged)],  # noqa: S607
            cwd=prototype,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    if result.returncode != 0:
        raise SystemExit(
            "closure patch did not apply:\n"
            f"{result.stderr.strip()}\n"
            "The worktree is not the as-recovered source. Re-run with --fresh."
        )

    still_absent = missing_markers(prototype)
    if still_absent:
        raise SystemExit(
            "patch applied but the closure is still incomplete:\n  " + "\n  ".join(still_absent)
        )
    print("closure applied and verified")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--worktree", type=Path, default=DEFAULT_WORKTREE)
    parser.add_argument(
        "--fresh",
        action="store_true",
        help="rebuild the worktree from the frozen archive first (proves reproduction)",
    )
    parser.add_argument(
        "--pdftotext-dir",
        type=Path,
        default=GIT_POPPLER_DIR,
        help="directory containing pdftotext; prepended to PATH",
    )
    args = parser.parse_args()

    prototype = args.worktree / "titlepipe"
    seed_root = args.worktree / "seed-root"

    env = dict(os.environ)
    if args.pdftotext_dir.exists():
        env["PATH"] = f"{args.pdftotext_dir}{os.pathsep}{env.get('PATH', '')}"
    env["TITLEPIPE_SEED_ROOT"] = str(seed_root)

    if args.fresh:
        print("=== rebuilding from the frozen archive ===")
        rebuild_worktree(args.archive, args.worktree)
    if not prototype.exists():
        raise SystemExit(f"prototype not found at {prototype}; re-run with --fresh")

    if shutil.which("git") is None:
        raise SystemExit("git is required to apply the closure patch")
    if shutil.which("pdftotext", path=env["PATH"]) is None:
        raise SystemExit("pdftotext not on PATH; segmentation and the seed parser need it")

    python = ensure_venv(prototype, env)

    print("\n=== applying the closure patch ===")
    apply_closure(prototype, env)

    print("\n=== regenerating synthetic fixtures ===")
    if run(
        [
            str(python),
            str(HERE / "make_synthetic_package.py"),
            str(prototype / package_fixture_path(prototype)),
        ],
        cwd=REPO_ROOT,
        env=env,
    ):
        return 1
    if run(
        [
            str(python),
            str(HERE / "make_synthetic_reports.py"),
            str(seed_root),
            "--prototype",
            str(prototype),
        ],
        cwd=REPO_ROOT,
        env=env,
    ):
        return 1

    print("\n=== installing the v14 R15 guard ===")
    shutil.copy2(HERE / "test_v14_r15.py", prototype / "tests" / "test_v14_r15.py")

    print("\n=== package suite ===")
    package_rc = run([str(python), "-m", "pytest", "tests/", "-q"], cwd=prototype, env=env)

    print("\n=== bug-fix patch suite (24 tests, still unmerged) ===")
    bugfix_rc = 0
    for module in ("fix_segment.py", "fix_assemble.py", "fix_api.py"):
        bugfix_rc = bugfix_rc or run(
            [str(python), "-m", "unittest", "discover", "-s", "bugfixes", "-p", module],
            cwd=args.worktree,
            env=env,
        )

    print("\n" + "=" * 60)
    print(f"package suite : {'PASS' if package_rc == 0 else 'FAIL'}")
    print(f"patch suite   : {'PASS' if bugfix_rc == 0 else 'FAIL'}")
    print("=" * 60)
    return package_rc or bugfix_rc


if __name__ == "__main__":
    sys.exit(main())

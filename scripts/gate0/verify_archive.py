"""Verify the frozen Gate 0 archive against its committed manifest.

    python scripts/gate0/verify_archive.py

The archive is the safety net. Its integrity was previously checkable only by
pasting a PowerShell snippet out of the manifest, which is how it came to hold
31 stray `__pycache__` and pytest-cache files while the manifest claimed an
exact match — the hashes were all correct, and the set was not.

So this checks the **set** as well as the hashes, and treats an unexpected file
as a failure. An archive that has grown files is not the artefact that was
frozen, even when every listed hash still matches.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_MANIFEST = REPO_ROOT / "docs" / "backend" / "GATE_0_ARCHIVE_MANIFEST.md"
DEFAULT_ARCHIVE = (
    Path(os.environ.get("LOCALAPPDATA", Path.home() / ".local"))
    / "TitlePipe"
    / "gate0-prototype-archive"
)

ENTRY_RE = re.compile(r"^([0-9a-f]{64})\s+(\d+)\s+(.+)$")


def parse_manifest(path: Path) -> dict[str, tuple[str, int]]:
    entries: dict[str, tuple[str, int]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = ENTRY_RE.match(line.strip())
        if match:
            entries[match.group(3)] = (match.group(1), int(match.group(2)))
    if not entries:
        raise SystemExit(f"no manifest entries found in {path}")
    return entries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    if not args.archive.exists():
        raise SystemExit(f"archive not found at {args.archive}")

    listed = parse_manifest(args.manifest)
    on_disk = {
        path.relative_to(args.archive).as_posix(): path
        for path in args.archive.rglob("*")
        if path.is_file()
    }

    problems: list[str] = []
    for relative in sorted(set(on_disk) - set(listed)):
        problems.append(f"unexpected file (not in the manifest): {relative}")
    for relative in sorted(set(listed) - set(on_disk)):
        problems.append(f"missing: {relative}")

    for relative, (want_hash, want_size) in sorted(listed.items()):
        path = on_disk.get(relative)
        if path is None:
            continue
        data = path.read_bytes()
        if len(data) != want_size:
            problems.append(f"size changed: {relative} ({len(data)} != {want_size})")
        got = hashlib.sha256(data).hexdigest()
        if got != want_hash:
            problems.append(f"content changed: {relative}")

    print(f"archive  : {args.archive}")
    print(f"manifest : {len(listed)} entries")
    print(f"on disk  : {len(on_disk)} files")

    if problems:
        print("\nFAIL")
        for problem in problems:
            print(f"  {problem}")
        print(
            "\nThe frozen archive no longer matches what Gate 0 recorded. Rebuild it\n"
            "from the original .zip files it contains, or re-freeze deliberately and\n"
            "regenerate the manifest."
        )
        return 1

    print("\nPASS — every file matches, and there are no extras.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Refuse to commit county packages, seed databases or client documents.

`docs/CONTEXT.md` §19 records a bare relative path in the ingest module writing
every uploaded file into the working tree, producing a 644 MB archive of real
search packages containing GLBA NPI.

This is the cheap structural guard. It is deliberately blunt: it refuses the
file *types* that carry client data anywhere in the tree rather than trying to
judge whether a particular PDF is safe.

## Two rules, applied independently

**Extension rule** — a `.pdf`, `.docx`, `.seed`, `.sqlite` and so on is refused
**anywhere**, with no directory exemptions.

**Directory rule** — a path under `uploads/`, `inbox/` or `county-packages/` is
refused whatever it contains.

They are separate because `packages/` needs an exemption from exactly one of
them. It is the pnpm workspace directory holding `contract`, `ui` and `mocks`
source — tracked on purpose — and it collides by name with the old prototype's
upload directory. So `packages/` is exempt from the **directory** rule only.

> Found in review: an earlier version returned early for the whole `packages/`
> tree *before* testing the extension, so `packages/county-package.pdf` was
> accepted while the identical file was refused anywhere else. The exemption is
> now scoped to the one rule that needs it.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

# Extensions that carry client documents or a golden-set database. Refused
# everywhere, including inside exempt directories.
FORBIDDEN_SUFFIXES = frozenset(
    {
        # documents
        ".pdf",
        ".docx",
        ".doc",
        ".rtf",
        # page images. A county package arrives scanned, and a rasterised page
        # is the same NPI as the PDF it came from. `.tif` was covered from the
        # start and the rest were not, which left the most common export format
        # for a single page — a JPEG or a PNG — walking straight through. Size
        # does not help either: `check-added-large-files --maxkb=512` passes a
        # single scanned page comfortably.
        ".tif",
        ".tiff",
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".heic",
        ".heif",
        ".jp2",
        # databases
        ".seed",
        ".sqlite",
        ".sqlite3",
        ".db",
        ".mdb",
        # archives — an archive is a container for all of the above, and the
        # 644 MB incident was exactly a directory of county packages. Review
        # showed `packages/county-client.zip` sailing through while the same
        # PDFs loose on disk were refused.
        ".zip",
        ".7z",
        ".rar",
        ".tar",
        ".gz",
        ".tgz",
        ".bz2",
        ".xz",
        ".zst",
    }
)

# Directory names that hold uploads or county packages by convention.
FORBIDDEN_DIRECTORY_NAMES = frozenset({"uploads", "inbox", "county-packages"})

# Exempt from the DIRECTORY rule only, never from the extension rule.
DIRECTORY_RULE_EXEMPT_PREFIXES = ("packages/",)

# Not source, and not ours to police.
SKIPPED_PREFIXES = ("node_modules/", ".git/")

# Individual paths permitted despite matching.
#
# Pinned by SHA-256, not by path. An allowlisted *path* is a hole: the file at
# it can be replaced with a county package and the guard would wave it through
# on the strength of a decision made about different bytes. The hash means an
# approved archive stays approved and a swapped one is refused.
ALLOWLIST: dict[str, tuple[str, str]] = {
    "docs/archive/Title report review tool.zip": (
        "baf71d954f1a55a1594a008e39b393f4479c9dcb5cb2c654c4d33f01854c6bda",
        "design screens only; inspected and verified to contain no client documents",
    ),
    # UI crops kept as the reference for the two-NA-states rendering and the
    # action panel. Each was opened and read: every value shown resolves to a
    # fixture in packages/mocks/src/data.ts (the plaintiff is the mocks'
    # CREEKBANK RECOVERY SPV LLC), so there is no client data in any of them.
    # Re-inspect before updating a hash — a screenshot of the same screen taken
    # against a real package would look almost identical and would not be.
    "docs/archive/action-panel-after-c.png": (
        "e9108722247bff5e87fdeaed89a2578c344cdc91766c6afa0b8eb0af425f453c",
        "UI crop of the action panel; all values are packages/mocks fixtures",
    ),
    "docs/archive/na-expected-row.png": (
        "498b51e28dae52242158159c8caabb87aa4c7bf867b9628dd61ff79c3285d897",
        "UI crop of an N/A — EXPECTED row; all values are packages/mocks fixtures",
    ),
    "docs/archive/unreadable-row.png": (
        "e3926563e68894eacec750c08cfd4d2c6c9b433f0a25e3507b5a50ff5fbd504e",
        "UI crop of a PRESENT — UNREADABLE row; all values are packages/mocks fixtures",
    ),
}


def violation_for(path: Path) -> str | None:
    """The reason this path is refused, or `None` if it is acceptable."""
    relative = path.as_posix()

    if relative in ALLOWLIST:
        expected, reason = ALLOWLIST[relative]
        if not path.exists():
            return None  # deleted or renamed; nothing to admit
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            return (
                f"allowlisted as {reason!r}, but the content has changed "
                f"(sha256 {actual[:16]}… != {expected[:16]}…). Re-inspect it and "
                "update the hash deliberately."
            )
        return None
    if relative.startswith(SKIPPED_PREFIXES):
        return None

    # Extension rule — no exemptions.
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        return f"{path.suffix} files may contain client documents or golden data"

    # Directory rule — `packages/` is the pnpm workspace, not county packages.
    if relative.startswith(DIRECTORY_RULE_EXEMPT_PREFIXES):
        return None
    conflicting = {part.lower() for part in path.parts} & FORBIDDEN_DIRECTORY_NAMES
    if conflicting:
        return f"{sorted(conflicting)[0]}/ holds uploads and must never be committed"

    return None


def main(argv: list[str]) -> int:
    violations = [
        (Path(argument).as_posix(), reason)
        for argument in argv
        if (reason := violation_for(Path(argument))) is not None
    ]

    if not violations:
        return 0

    print("Refusing to commit files that may contain client data:\n")
    for relative, reason in violations:
        print(f"  {relative}\n      {reason}")
    print(
        "\nCounty packages, seed databases and client documents never enter VCS.\n"
        "Store them at an absolute configured path outside the working tree.\n"
        "If a file is genuinely synthetic and safe, add it to ALLOWLIST in\n"
        "scripts/check_no_client_data.py with a reason."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

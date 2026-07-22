"""Refuse to commit county packages, seed databases or client documents.

`docs/CONTEXT.md` §19 records a bare relative path in the ingest module writing
every uploaded file into the working tree, producing a 644 MB archive. The
files in that incident were real search packages containing GLBA NPI.

This hook is the cheap structural guard. It is deliberately blunt: it refuses
the file *types* that carry client data anywhere in the tree, rather than
trying to judge whether a particular PDF is safe. A synthetic fixture that
genuinely needs to be committed belongs under a documented fixtures directory
and can be allowlisted here explicitly, with a reason.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Extensions that carry client documents or a golden-set database.
FORBIDDEN_SUFFIXES = frozenset(
    {".pdf", ".docx", ".doc", ".seed", ".sqlite", ".sqlite3", ".db", ".tif", ".tiff"}
)

# Directory names that hold uploads or county packages by convention.
FORBIDDEN_DIRECTORY_NAMES = frozenset({"uploads", "inbox", "county-packages"})

# Paths that are permitted despite matching above. Each needs a reason.
ALLOWLIST: dict[str, str] = {
    # (none yet — add as `"relative/path": "why this is safe"`)
}

# `packages/` is the pnpm workspace directory, not county packages. The rule is
# about client data, not the naming convention.
IGNORED_PREFIXES = ("packages/", "node_modules/", ".git/")


def is_forbidden(relative: str, path: Path) -> str | None:
    if relative in ALLOWLIST:
        return None
    if relative.startswith(IGNORED_PREFIXES):
        return None
    if path.suffix.lower() in FORBIDDEN_SUFFIXES:
        return f"{path.suffix} files may contain client documents or golden data"
    parts = {part.lower() for part in path.parts}
    conflicting = parts & FORBIDDEN_DIRECTORY_NAMES
    if conflicting:
        return f"{sorted(conflicting)[0]}/ holds uploads and must never be committed"
    return None


def main(argv: list[str]) -> int:
    violations: list[tuple[str, str]] = []
    for argument in argv:
        path = Path(argument)
        relative = path.as_posix()
        reason = is_forbidden(relative, path)
        if reason is not None:
            violations.append((relative, reason))

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

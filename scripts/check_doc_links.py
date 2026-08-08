"""Verify that every relative Markdown link in tracked Markdown resolves.

Two authoritative reference documents (`docs/rulings_2026-07.md`,
`docs/spec.md`) were cited across six documents while existing in no commit —
rot that survived a year of review because nothing checked it. This is the
typed version of that lesson: a Markdown link to a path inside the repository
must point at a file that exists.

Scope is deliberately narrow so the check stays true:

- Only actual link syntax, `[text](target)`. Prose mentions in backticks are
  citations, not links, and adjudicating them is `docs/INDEX.md`'s job (its
  "Missing documents" table is where a known-absent citation is recorded).
- Only relative targets. `http(s)`/`mailto` links are outside the tree.
- Fragments are stripped (`file.md#section` checks `file.md`); pure-fragment
  links (`#section`) are same-file anchors and skipped.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# [text](target) — non-greedy text, target up to the closing paren, no nesting.
LINK = re.compile(r"\[[^\]]*\]\(([^()\s]+)\)")

EXTERNAL_PREFIXES = ("http://", "https://", "mailto:")


def broken_links(markdown_file: Path) -> list[str]:
    """Relative link targets in `markdown_file` that do not resolve to a path."""
    broken: list[str] = []
    text = markdown_file.read_text(encoding="utf-8")
    for match in LINK.finditer(text):
        target = match.group(1)
        if target.startswith(EXTERNAL_PREFIXES) or target.startswith("#"):
            continue
        path_part = target.split("#", 1)[0]
        if not path_part:
            continue
        resolved = (markdown_file.parent / path_part).resolve()
        if not resolved.exists():
            broken.append(target)
    return broken


def main(argv: list[str]) -> int:
    files = [Path(argument) for argument in argv if argument.endswith(".md")]
    failures = [
        (markdown_file, target)
        for markdown_file in files
        if markdown_file.exists()
        for target in broken_links(markdown_file)
    ]

    if not failures:
        return 0

    print("Markdown links that resolve to nothing:\n")
    for markdown_file, target in failures:
        print(f"  {markdown_file.as_posix()}: ({target})")
    print(
        "\nFix the link, or if the document is genuinely absent, cite it in"
        "\nprose and record it in docs/INDEX.md under 'Missing documents'."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

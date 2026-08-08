"""Refuse a commit where `CLAUDE.md` and `AGENTS.md` have drifted apart.

The two files are the same guide published under the two filenames different
agent harnesses read. They are byte-identical by convention, and a convention
with no gate lasts until the first hurried edit to one of them. Whichever was
edited is the intended content — this gate does not pick a winner, it refuses
the split and lets the author copy the right one over the other.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    claude = (REPO_ROOT / "CLAUDE.md").read_bytes()
    agents = (REPO_ROOT / "AGENTS.md").read_bytes()
    if claude == agents:
        return 0
    print(
        "CLAUDE.md and AGENTS.md differ. They are one guide under two names;\n"
        "copy the edited one over the other so both harnesses read the same rules."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())

"""Generate synthetic delivered reports for the Gate 0 seed tests.

## Why this exists

`titlepipe/seed.py` builds the golden seed by parsing five **delivered client
reports** — three PDFs and two DOCX — from a root that was hard-coded to
`/mnt/user-data`, a path in the sandbox the prototype was written in. Those are
finished work products for real properties: the most client-identifying
artefacts in the whole system. They will never be in VCS, and they are not on
this machine.

So three seed tests could not run, and would not run in CI either.

This writes one synthetic report per source in Shape A layout, with invented
parties, addresses and amounts. The *filenames and order identifiers* it must
use are read from the prototype's `seed.SOURCES` at run time, because those are
real client values and do not belong in this repository. What the seed tests actually assert is that the
**parser** works and the **corrections** are applied — `parse_shape_a` finding
`LABEL: value` pairs, `ORDER_SUPPLIED` fields being excluded, the seven known
defects arriving tagged `ruled`. None of that depends on whose property it is.

## What this fixture cannot stand in for

The real reports are the evidence for the *content* of the seven defects — that
Anchorage's card really says 843,000, that Greene really has four mortgages and
not five. Those values live in `seed.CORRECTIONS` as literals and are asserted
directly, so the tests still check them; but a synthetic report can never
re-derive them. If the corrections are ever re-verified, that must be done
against the real documents.

The reports are deliberately close to Shape A in structure and deliberately
unlike it in content.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

COUNTIES = ("CLAYTON", "HOUSTON", "GREENE", "MECKLENBURG", "ANCHORAGE")


def sources_from_prototype(prototype: Path) -> list[tuple[str, str, str]]:
    """Read `seed.SOURCES` from the recovered prototype at run time.

    The order identifiers and report filenames the seed expects are **real
    client values** — order numbers and delivered-report filenames. They live
    in the prototype, which is outside VCS, and hardcoding them here would have
    copied client-derived data into the repository under a file claiming to be
    synthetic.

    Review caught exactly that. Reading them instead means this generator holds
    none, and it cannot drift from the seed it feeds either.

    Returns (order_id, relative_path, kind).
    """
    sys.path.insert(0, str(prototype))
    try:
        from titlepipe.seed import SOURCES
    except ImportError as exc:  # pragma: no cover - depends on the invocation
        raise SystemExit(
            f"cannot import titlepipe.seed from {prototype}: {exc}. "
            "Run through scripts/gate0/run_prototype_suite.py, which points "
            "--prototype at the worktree."
        ) from exc
    return [(order_id, relative, kind) for order_id, relative, kind, _pages in SOURCES]


def report_lines(order_no: str, county: str) -> list[str]:
    """One synthetic Shape A report.

    Two mortgage blocks, because `parse_shape_a` indexes mortgages off each
    `MORTGAGOR:` line and a single block would never exercise that.

    `TRUSTEE: Not Available` on the second block is deliberate: `_clean` drops
    it, which is what a Georgia security deed legitimately produces, and the
    parser must omit rather than guess.
    """
    return [
        "ABSTRACTOR CALL BACK SHEET",
        f"ORDER #: {order_no}    VENDOR: 66805",
        "SEARCH DATE: 07/15/2026    EFFECTIVE DATE: 07/08/2026",
        "",
        "CURRENT VESTING DEED",
        "DEED TYPE: LIMITED WARRANTY DEED",
        "GRANTOR: ARBORFIELD HOLDINGS LLC",
        "GRANTEE: DANA REYES AND MORGAN REYES",
        "CONS: $255,000.00",
        "",
        "LOCATION: 118 SYNTHETIC WAY",
        "CITY/TWP/BORO: TESTVILLE",
        f"COUNTY/PARISH: {county}",
        "ZIP CODE: 30296",
        "",
        "ASSESSMENT",
        "TAX ID#: 05-1234-567",
        "LAND: $22,000",
        "BUILDING: $198,000",
        "TOTAL: $220,000",
        "",
        "MORTGAGE/DEED OF TRUST",
        "MORTGAGOR: DANA REYES",
        "ENTITY TYPE: INDIVIDUAL",
        "NON-PERSON NAME: REYES",
        "MORTGAGEE: NORTHGATE SAVINGS BANK",
        "TRUSTEE: FIRST SYNTHETIC TITLE COMPANY",
        "AMOUNT: $204,000.00",
        "MIN: 1000314-0000237903-3",
        "",
        "MORTGAGOR: MORGAN REYES",
        "ENTITY TYPE: INDIVIDUAL",
        "NON-PERSON NAME: REYES",
        "MORTGAGEE: MERIDIAN LOAN SERVICING LLC",
        "TRUSTEE: Not Available",
        "AMOUNT: $38,500.00",
        "MIN: 1000314-0000237904-1",
        "",
        "#OF MTGS: 02",
        "#OF JUDGMENTS: 01",
        "#OF TAX LIENS: 00",
        "",
        "This report body is synthetic and generated for automated testing.",
        "Its isolated order identifier is retained only for recovered-parser compatibility.",
    ]


# --- PDF ---------------------------------------------------------------------
#
# Reuses the hand-written writer from the package generator: no new dependency,
# deterministic bytes.

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_synthetic_package import build_pdf  # noqa: E402  # isort: skip


# --- DOCX --------------------------------------------------------------------


def write_docx(path: Path, lines: list[str]) -> None:
    """One paragraph per line.

    Both readers — pandoc and the python-docx fallback — turn a paragraph into
    a line, and `parse_shape_a` terminates a value at end-of-line, so the same
    text parses identically either way.
    """
    try:
        from docx import Document
    except ImportError:  # pragma: no cover - depends on the invoking environment
        print(
            "python-docx is required to write the .docx fixtures:\n"
            "  uv run --with python-docx python scripts/gate0/make_synthetic_reports.py ...",
            file=sys.stderr,
        )
        raise

    document = Document()
    for line in lines:
        document.add_paragraph(line)
    document.save(str(path))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "root",
        type=Path,
        help="the root `seed.build(root)` will be pointed at; files land under <root>/uploads/",
    )
    parser.add_argument(
        "--prototype",
        type=Path,
        required=True,
        help="the recovered prototype, to read seed.SOURCES from",
    )
    args = parser.parse_args()

    sources = sources_from_prototype(args.prototype)
    written_sizes: list[int] = []
    for index, (order_no, relative, kind) in enumerate(sources):
        county = COUNTIES[index % len(COUNTIES)]
        path = args.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = report_lines(order_no, county)
        if kind == "pdf":
            # Split across two pages: `seed.SOURCES` reads page ranges, so a
            # single-page fixture would not exercise that.
            half = len(lines) // 2
            path.write_bytes(build_pdf([lines[:half], lines[half:]]))
        else:
            write_docx(path, lines)
        written_sizes.append(path.stat().st_size)

    for index, size in enumerate(written_sizes, start=1):
        print(f"wrote isolated synthetic report {index} ({size:,} bytes)")

    return 0


if __name__ == "__main__":
    sys.exit(main())

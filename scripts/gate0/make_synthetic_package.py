"""Generate a synthetic county search package for the Gate 0 ingest tests.

## Why this exists

Seven of the prototype's ingest tests assert against a fixture under
`tests/fixtures/` — a real Georgia county search package containing GLBA NPI.
It must never enter VCS, so on any machine without it those tests fail, which
means they would never run in CI either. (The exact filename is a client order
number and stays in the prototype; the runner reads it from there.)

This produces a **synthetic** package with the same *structural* properties the
tests actually assert on — 36 pages, several recorded instruments, at least one
document whose declared page count disagrees with what is present — using
invented parties and invented instrument numbers.

The tests exercise **the door**: order fields required, duplicate detection,
content hashing, segment-on-upload, explicit accept. None of that depends on
whose deed it is. Segmentation has its own tests against its own parsers.

## Why it is born-digital

Real packages are mostly scans, and segmentation OCRs the stamp band. This
fixture gives every page a text layer, so `band_text_from_text_layer` handles
it and neither `pdftoppm` nor `tesseract` is needed — and the suite runs on a
machine with only `pdftotext`.

That is a deliberate difference from the real package and it is the honest
limitation of this fixture: it exercises the ingest door, not the OCR path.

## Why the PDF is hand-written

No new dependency. `reportlab` would be one more thing to install to run a test
suite, and the file needed here is a few hundred bytes of text per page.

Deterministic: the same bytes every run, so the content-hash duplicate test is
meaningful.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PAGE_WIDTH, PAGE_HEIGHT = 612, 792
FONT_SIZE = 9
LINE_HEIGHT = 12
TOP_MARGIN = 756
LEFT_MARGIN = 54

# Every page needs >50 extractable characters or `text_layer_pages` will treat
# it as a scan and reach for an OCR binary that is not installed.
FILLER = (
    "This is a synthetic document generated for automated testing. "
    "It contains no client data and no personal information. "
    "All parties, instrument numbers and amounts below are invented."
)


def stamped_pages() -> list[list[str]]:
    """Recorded instruments, each stamped in the band the parser reads.

    Stamp formats match `segment.STAMP_PATTERNS`. The parser only inspects the
    first 14 and last 10 lines of a page, so every stamp is on line 1.
    """
    pages: list[list[str]] = []

    # --- Document A: warranty deed, 4 pages, declared 4 -> checks out.
    for i in range(1, 5):
        pages.append(
            [
                f"Doc ID: 015452720001 Type: WD  Page {i} of 4  BK 8081 PG 155",
                "Recorded: 03/14/2019 09:12 AM",
                "",
                "LIMITED WARRANTY DEED",
                "",
                "GRANTOR: ARBORFIELD HOLDINGS LLC",
                "GRANTEE: DANA REYES and MORGAN REYES",
                "CONSIDERATION: $255,000.00",
                "",
                FILLER,
            ]
        )

    # --- Document B: security deed, 6 pages, declared 6 -> checks out.
    for i in range(1, 7):
        pages.append(
            [
                f"B: DEED V: 11416 P: {321 + i} 11/07/2018 03:07 PM / 2018008488 Page {i} of 6",
                "",
                "SECURITY DEED",
                "",
                "GRANTOR: DANA REYES",
                "GRANTEE: NORTHGATE SAVINGS BANK",
                "PRINCIPAL AMOUNT: $204,000.00",
                "",
                FILLER,
            ]
        )

    # --- Document C: assignment, declares 5 pages but only 3 are present.
    #
    # This is the flagged document. `test_flagged_segmentation_needs_attention`
    # asserts `flagged > 0` and `needs_attention is True`, so the fixture has to
    # contain a genuine arithmetic disagreement — a short scan, which is a real
    # and common defect.
    for i in range(1, 4):
        pages.append(
            [
                f"Doc ID: 015452720002 Type: ASGN  Page {i} of 5  BK 8402 PG 77",
                "Recorded: 06/02/2021 11:40 AM",
                "",
                "ASSIGNMENT OF SECURITY DEED",
                "",
                "ASSIGNOR: NORTHGATE SAVINGS BANK",
                "ASSIGNEE: MERIDIAN LOAN SERVICING LLC",
                "",
                FILLER,
            ]
        )

    # --- Document D: release, no declared count -> `unverifiable`, not flagged.
    #
    # The third segmentation state, and the one the prototype's own comments
    # call the dangerous one. Worth having in the fixture.
    for i in range(2):
        pages.append(
            [
                f"I-2024-002253  Book 1334 Pg {239 + i}",
                "",
                "CANCELLATION OF SECURITY DEED",
                "",
                "HOLDER: MERIDIAN LOAN SERVICING LLC",
                "CANCELS: Security Deed recorded in Book 11416 Page 322",
                "",
                FILLER,
            ]
        )

    return pages


def evidence_pages() -> list[list[str]]:
    """Search evidence: no recording stamp, classified by marker.

    These match `segment.EVIDENCE_MARKERS`, so they are recognised as evidence
    rather than left unclassified. `needs_attention` is already true from the
    flagged document, so this fixture does not also need unclassified pages.
    """
    kinds = [
        ("Georgia Superior Court Clerks Authority - Search Results", 5),
        ("PROPERTY TAX STATEMENT - Tax Year 2025", 4),
        ("Case Number: 2019CV00841  Case Caption: Docket Information", 4),
        ("qPublic / Schneider GEOSPATIAL - Parcel Detail", 4),
        ("UCC Search - BASIC NAME SEARCH results", 4),
    ]
    pages: list[list[str]] = []
    for header, count in kinds:
        for i in range(1, count + 1):
            pages.append(
                [
                    header,
                    f"Result page {i} of {count}",
                    "",
                    "Searched: REYES, DANA / REYES, MORGAN",
                    "No matching records of record for the period searched.",
                    "",
                    FILLER,
                ]
            )
    return pages


def escape(text: str) -> str:
    """PDF string escaping for a literal `( ... )` string."""
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def content_stream(lines: list[str]) -> bytes:
    """One page's text, positioned line by line so `pdftotext -layout` keeps
    the line structure the stamp parser relies on."""
    parts = ["BT", f"/F1 {FONT_SIZE} Tf"]
    y = TOP_MARGIN
    for line in lines:
        parts.append(f"1 0 0 1 {LEFT_MARGIN} {y} Tm ({escape(line)}) Tj")
        y -= LINE_HEIGHT
    parts.append("ET")
    return "\n".join(parts).encode("latin-1")


def build_pdf(pages: list[list[str]]) -> bytes:
    """A minimal PDF 1.4 with one Helvetica font and one content stream a page."""
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)  # 1-based object number

    # Reserve 1 = catalog, 2 = page tree; both need forward references.
    objects.append(b"")
    objects.append(b"")
    font_num = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_nums: list[int] = []
    for lines in pages:
        stream = content_stream(lines)
        content_num = add(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )
        page_nums.append(
            add(
                b"<< /Type /Page /Parent 2 0 R "
                b"/MediaBox [0 0 " + f"{PAGE_WIDTH} {PAGE_HEIGHT}".encode() + b"] "
                b"/Resources << /Font << /F1 " + f"{font_num} 0 R".encode() + b" >> >> "
                b"/Contents " + f"{content_num} 0 R".encode() + b" >>"
            )
        )

    kids = b" ".join(f"{n} 0 R".encode() for n in page_nums)
    objects[1] = (
        b"<< /Type /Pages /Kids [" + kids + b"] /Count " + str(len(page_nums)).encode() + b" >>"
    )
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"

    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"

    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += (
        b"trailer\n<< /Size " + str(len(objects) + 1).encode() + b" /Root 1 0 R >>\n"
        b"startxref\n" + str(xref_at).encode() + b"\n%%EOF\n"
    )
    return bytes(out)


TOTAL_PAGES = 36


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="path to write the .pdf to")
    args = parser.parse_args()

    pages = stamped_pages() + evidence_pages()
    if len(pages) != TOTAL_PAGES:
        print(
            f"fixture must be exactly {TOTAL_PAGES} pages "
            f"(test_segments_on_upload asserts it); built {len(pages)}",
            file=sys.stderr,
        )
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(build_pdf(pages))
    print(
        f"wrote isolated synthetic package "
        f"({args.output.stat().st_size:,} bytes, {len(pages)} pages)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

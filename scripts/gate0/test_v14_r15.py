"""v14 — R15: liens survive chain termination.

Kept in the repository rather than only in the prototype worktree, because the
prototype source is not in VCS pending an owner ruling and this assertion must
not be the thing that goes missing. `run_prototype_suite.py` copies it into
`<worktree>/tests/`.

R15 is the highest-risk rule in the system. `docs/CONTEXT.md` §11 marks it ⚠,
`docs/PRD.md` §18 lists v14 as a release gate, and the Gate 0 audit found the
prototype's behaviour correct but **unguarded** — exactly one write to
`released_by`, reachable only through a reference-matched release, and nothing
stopping the next edit from changing that.

The load-bearing test is `test_v14_catches_a_lien_suppressed_without_a_release`.
Without it a green v14 would prove only that today's code passes, not that the
assertion has any teeth.

The document helper mirrors `tests/test_assemble.py` so both build instruments
the same way: `Recording.book_page` is a derived property, not a settable field.
"""

from datetime import date
from decimal import Decimal

from titlepipe import assemble as A
from titlepipe import validators as V
from titlepipe.models import DocType, Document, Field, SourceType


def doc(dt, caption=None, inst=None, book=None, page=None, rec=None, ttax=None, **fields):
    d = Document(doc_type=dt, caption=Field(value=caption, source=SourceType.OCR))
    d.recording.instrument_no = (
        Field(value=inst, source=SourceType.OCR) if inst else Field(value=None)
    )
    if book:
        d.recording.book = Field(value=book, source=SourceType.OCR)
        d.recording.page = Field(value=page, source=SourceType.OCR)
    d.recording.recorded_date = Field(value=rec, source=SourceType.OCR)
    if ttax is not None:
        d.recording.transfer_tax = Field(value=Decimal(str(ttax)), source=SourceType.OCR)
    for k, v in fields.items():
        d.fields[k] = Field(value=v, source=SourceType.OCR)
    return d


def package():
    """A deed, two security deeds, and a release for exactly one of them.

    Synthetic parties. The unreleased security deed is the lien R15 protects:
    an arm's-length sale does not discharge it, and chain termination decides
    only how far back to search.
    """
    deed = doc(
        DocType.DEED,
        "Limited Warranty Deed",
        book="8081",
        page="155",
        rec=date(2019, 3, 14),
        ttax="255.00",
        grantor="ARBORFIELD HOLDINGS LLC",
        grantee="DANA REYES",
        dated_date=date(2019, 3, 1),
    )
    released = doc(
        DocType.SECURITY_INSTRUMENT,
        "Security Deed",
        book="11000",
        page="100",
        rec=date(2016, 5, 2),
        mortgagor="PRIOR OWNER",
        amount=Decimal("150000.00"),
    )
    surviving = doc(
        DocType.SECURITY_INSTRUMENT,
        "Security Deed",
        book="11416",
        page="322",
        rec=date(2018, 11, 7),
        mortgagor="DANA REYES",
        amount=Decimal("204000.00"),
    )
    release = doc(
        DocType.RELEASE,
        "Cancellation of Security Deed",
        book="12000",
        page="9",
        rec=date(2020, 1, 9),
        releases_book_page="11000/100",
    )
    order = {
        "order_no": "SYNTH-1",
        "vendor": "66805",
        "effective_date": date(2026, 7, 8),
    }
    return [deed, released, surviving, release], order


def surviving_book_pages(report):
    return [m.doc.recording.book_page.value for m in report.mortgages]


def test_the_release_resolves_against_the_instrument_it_cites():
    """If this fails the rest of the file is testing the wrong thing."""
    docs, order = package()
    report = A.build_report(docs, order)
    assert len(report._all_mortgage_blocks) == 2
    released = [m for m in report._all_mortgage_blocks if m.released_by is not None]
    assert len(released) == 1
    assert released[0].doc.recording.book_page.value == "11000/100"


def test_an_unreleased_lien_survives_into_the_report():
    """R15 stated as a property of the output, not of the guard."""
    docs, order = package()
    report = A.build_report(docs, order)
    assert "11416/322" in surviving_book_pages(report)


def test_a_released_lien_is_suppressed_and_v14_allows_it():
    docs, order = package()
    report = A.build_report(docs, order)
    assert "11000/100" not in surviving_book_pages(report)

    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is True, result.detail


def test_v14_catches_a_lien_suppressed_without_a_release():
    """The regression v14 exists for.

    Removes a still-encumbered lien from the report while it holds no release —
    which is exactly what "the chain terminated, so drop it" looks like from
    the outside. If this ever reports `passed is True`, R15 is unguarded again.
    """
    docs, order = package()
    report = A.build_report(docs, order)
    report.mortgages = [
        m for m in report.mortgages if m.doc.recording.book_page.value != "11416/322"
    ]

    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False, "v14 did not catch a lien dropped without a release"
    assert "without a verified release" in result.detail
    assert "11416/322" in result.detail


def test_v14_fails_closed_when_it_cannot_check():
    """An unprovable report must not be indistinguishable from a clean one.
    `unverifiable` looking like `confident` is the shape that produced the MERS
    phantom, and R15 is the last rule that should inherit it."""
    docs, order = package()
    report = A.build_report(docs, order)
    del report._all_mortgage_blocks

    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "could not be checked" in result.detail


def test_chain_termination_does_not_touch_judgments_or_liens():
    """The other half of R15: termination sets search depth. Judgments and
    liens pass through assembly unfiltered."""
    docs, order = package()
    judgment = doc(
        DocType.JUDGMENT,
        "Certificate of Judgment",
        inst="CJ24017588",
        rec=date(2024, 8, 1),
        amount=Decimal("37696.56"),
        plaintiff="EVANS LANDSCAPING INC",
    )
    report = A.build_report([*docs, judgment], order)
    assert len(report.judgments_liens) == 1


def test_v14_is_a_hard_validator():
    """R15 is a release gate, not a reviewer hint."""
    assert V.v14_liens_survive_chain_termination in V.HARD_VALIDATORS


def test_v99_remains_deliberately_empty():
    """Guarded alongside v14 because these are the two assertions most likely to
    be 'helpfully' completed by someone who has not read the rulebook.
    LAND + BUILDING != TOTAL is correct — mixed valuation bases."""
    result = V.v99_never_assert_land_plus_building(None)
    assert result.passed is None
    assert "not implemented" in result.detail

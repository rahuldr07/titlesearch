"""v14 — R15: encumbrances survive chain termination.

Kept in the repository rather than only in the prototype worktree, because the
prototype source is not in VCS pending an owner ruling and this assertion must
not be the thing that goes missing. `run_prototype_suite.py` installs it.

R15 is the highest-risk rule in the system. `docs/CONTEXT.md` §11 marks it ⚠,
`docs/PRD.md` §18 lists v14 as a release gate, and the Gate 0 audit found the
prototype's behaviour correct but **unguarded**.

## What review corrected here

The first version of v14 compared `report.mortgages` against the pre-filter
blocks and nothing else. Removing an active judgment from `judgments_liens`
still returned `passed=True` — on a rule that exists *because* a judgment
survives the sale that preceded it. Mortgages were the one category that did
not need the guard most.

It also compared `id()`, so assembly rebuilding an equal object reported a
present lien as suppressed. A false failure on this rule is nearly as bad as a
false pass: the guard gets switched off.

So the mutation tests below cover **every lien-bearing category**, and a
positive test asserting current assembly behaviour is never treated as evidence
that the guard works — each has a paired mutation.
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


def judgment():
    return doc(
        DocType.JUDGMENT,
        "Certificate of Judgment",
        inst="CJ24017588",
        rec=date(2024, 8, 1),
        amount=Decimal("37696.56"),
        plaintiff="SYNTHETIC LANDSCAPING INC",
    )


def tax_lien():
    return doc(
        DocType.LIEN,
        "State Tax Execution",
        inst="TL-2023-0091",
        rec=date(2023, 4, 18),
        amount=Decimal("4120.00"),
    )


def ucc():
    return doc(
        DocType.UCC,
        "UCC-1 Financing Statement",
        inst="UCC-2022-77",
        rec=date(2022, 9, 30),
        collateral_description="fixtures located on the real property",
    )


def package(extra=()):
    """A deed, two security deeds, a release for exactly one, plus extras.

    Synthetic parties throughout. The unreleased security deed and every extra
    encumbrance are what R15 protects: an arm's-length sale discharges none of
    them.
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
    order = {"order_no": "SYNTH-1", "vendor": "66805", "effective_date": date(2026, 7, 8)}
    return [deed, released, surviving, release, *extra], order


def build(extra=()):
    docs, order = package(extra)
    return A.build_report(docs, order)


# --- the baseline the mutations are measured against -------------------------


def test_the_release_resolves_against_the_instrument_it_cites():
    """If this fails the rest of the file is testing the wrong thing."""
    report = build()
    released = [m for m in report._all_mortgage_blocks if m.released_by is not None]
    assert len(released) == 1
    assert released[0].doc.recording.book_page.value == "11000/100"


def test_a_clean_report_passes():
    report = build([judgment(), tax_lien(), ucc()])
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is True, result.detail


def test_both_pre_suppression_sets_are_recorded():
    """v14 cannot check what assembly does not hand it."""
    report = build([judgment(), tax_lien(), ucc()])
    assert len(report._all_mortgage_blocks) == 2
    assert len(report._all_lien_documents) == 3


# --- mutations: one per lien-bearing category --------------------------------
#
# Each removes a live encumbrance the way a chain-depth filter would, and
# asserts v14 objects. A positive test alone would only prove that today's
# assembly happens not to drop things.


def test_v14_catches_a_removed_mortgage():
    report = build()
    report.mortgages = [
        m for m in report.mortgages if m.doc.recording.book_page.value != "11416/322"
    ]
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False, "a live mortgage was dropped and v14 allowed it"
    assert "11416/322" in result.detail


def test_v14_catches_a_removed_judgment():
    """The category the first version of this validator could not see.

    R15 exists because a judgment against the current owner survives the sale
    that preceded it. If any mutation in this file must fail, it is this one.
    """
    report = build([judgment()])
    assert len(report.judgments_liens) == 1
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False, "an active judgment was dropped and v14 allowed it"
    assert "CJ24017588" in result.detail


def test_v14_catches_a_removed_tax_lien():
    report = build([tax_lien()])
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "TL-2023-0091" in result.detail


def test_v14_catches_a_removed_ucc_filing():
    report = build([ucc()])
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "UCC-2022-77" in result.detail


def test_v14_catches_one_removal_among_many():
    """A single missing encumbrance must not hide behind its surviving peers."""
    report = build([judgment(), tax_lien(), ucc()])
    report.judgments_liens = [
        d for d in report.judgments_liens if str(d.recording.instrument_no.value) != "TL-2023-0091"
    ]
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "TL-2023-0091" in result.detail


# --- suppression reasons -----------------------------------------------------


def test_a_permitted_suppression_is_allowed():
    """R13: a satisfied judgment leaves the report legitimately."""
    report = build([judgment()])
    dropped = report.judgments_liens[0]
    dropped.suppression_reason = "satisfied"
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is True, result.detail


def test_a_chain_based_suppression_reason_is_refused():
    """R15 stated directly: termination is not a disposition. Declaring it as
    one fails even though the code path 'explains' itself."""
    report = build([judgment()])
    dropped = report.judgments_liens[0]
    dropped.suppression_reason = "chain_terminated"
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "termination is not a disposition" in result.detail


def test_a_chain_based_reason_fails_even_when_the_lien_is_still_rendered():
    """The reason is a defect on its own. Honouring it is one edit away."""
    report = build([judgment()])
    report.judgments_liens[0].suppression_reason = "arms_length_sale"
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "chain-based suppression reason" in result.detail


def test_an_unrecognised_reason_is_refused():
    """An allowlist, not a denylist: a new reason must be reviewed, not assumed
    benign because nobody thought to forbid it."""
    report = build([judgment()])
    report.judgments_liens[0].suppression_reason = "looked_unimportant"
    report.judgments_liens = []
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "unrecognised reason" in result.detail


# --- identity ----------------------------------------------------------------


def test_a_rebuilt_but_equal_instrument_is_not_reported_as_suppressed():
    """Identity is by instrument, not by `id()`.

    Assembly legitimately rebuilds objects — a re-record collapse does exactly
    that. The first version compared `id()` and reported a present lien as
    missing. A false failure on this rule gets the guard switched off, which
    costs more than the false pass it was protecting against.
    """
    report = build([judgment()])
    original = report.judgments_liens[0]
    rebuilt = doc(
        DocType.JUDGMENT,
        "Certificate of Judgment",
        inst=str(original.recording.instrument_no.value),
        rec=original.recording.recorded_date.value,
    )
    assert rebuilt is not original
    report.judgments_liens = [rebuilt]

    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is True, result.detail


def test_instrument_key_prefers_the_instrument_number_then_book_page():
    by_inst = doc(DocType.JUDGMENT, inst="CJ1", book="100", page="2")
    by_bp = doc(DocType.JUDGMENT, book="100", page="2")
    assert V.instrument_key(by_inst) == "inst:CJ1"
    assert V.instrument_key(by_bp) == "bp:100/2"


# --- failing closed ----------------------------------------------------------


def test_v14_fails_closed_when_the_mortgage_set_is_missing():
    report = build()
    del report._all_mortgage_blocks
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "could not be checked" in result.detail


def test_v14_fails_closed_when_the_lien_set_is_missing():
    """Added after review: only the mortgage set was checked, so a report
    carrying no lien set at all would have passed."""
    report = build([judgment()])
    del report._all_lien_documents
    result = V.v14_liens_survive_chain_termination(report)
    assert result.passed is False
    assert "could not be checked" in result.detail


def test_v14_accepts_explicitly_supplied_sets():
    """So the backend port can pass them in rather than depending on private
    attributes on the report."""
    report = build([judgment()])
    result = V.v14_liens_survive_chain_termination(
        report,
        pre_suppression={
            "mortgages": report._all_mortgage_blocks,
            "liens": report._all_lien_documents,
        },
    )
    assert result.passed is True, result.detail


# --- registration ------------------------------------------------------------


def test_v14_is_a_hard_validator():
    """R15 is a release gate, not a reviewer hint."""
    assert V.v14_liens_survive_chain_termination in V.HARD_VALIDATORS


def test_chain_reasons_are_never_in_the_permitted_set():
    assert not (V.PERMITTED_SUPPRESSIONS & V.FORBIDDEN_SUPPRESSIONS)
    assert "verified_release" in V.PERMITTED_SUPPRESSIONS


def test_v99_remains_deliberately_empty():
    """Guarded alongside v14 because these are the two assertions most likely to
    be 'helpfully' completed by someone who has not read the rulebook.
    LAND + BUILDING != TOTAL is correct — mixed valuation bases."""
    result = V.v99_never_assert_land_plus_building(None)
    assert result.passed is None
    assert "not implemented" in result.detail

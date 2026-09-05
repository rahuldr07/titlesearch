"""The client-data guard.

A security control with a bypass is worse than none, because it is quoted as
evidence. The bypass below was found in review and is the first case here.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from check_no_client_data import (
    LARGE_TEXT_BYTES,
    candidate_suffixes,
    main,
    tree_paths,
    violation_for,
)


@pytest.mark.parametrize(
    "path",
    [
        "tests/fixtures/county-search-package.pdf",
        "uploads/report.docx",
        "data/titlepipe.seed",
        "services/core-api/golden.sqlite",
        "docs/scan.tiff",
        "anywhere/at/all/package.pdf",
    ],
)
def test_client_data_is_refused(path: str) -> None:
    assert violation_for(Path(path)) is not None


@pytest.mark.parametrize(
    "path",
    [
        "docs/page-0007.jpg",
        "docs/page-0007.jpeg",
        "apps/web/public/scan.png",
        "anywhere/deed.webp",
        "anywhere/deed.heic",
        "packages/mocks/page.png",
        "uploads/page.bmp",
    ],
)
def test_a_rasterised_page_is_refused_like_the_pdf_it_came_from(path: str) -> None:
    """Scanned packages arrive as images, and a page exported on its own is a
    JPEG or a PNG far more often than a TIFF.

    Only `.tif`/`.tiff` were listed originally, so the two commonest formats
    walked through. `check-added-large-files --maxkb=512` does not cover the
    gap either — one scanned page fits inside that comfortably.
    """
    assert violation_for(Path(path)) is not None
    assert main([path]) == 1


@pytest.mark.parametrize(
    "path",
    [
        "packages/county-package.pdf",
        "packages/contract/fixtures/order.docx",
        "packages/mocks/seed.sqlite",
    ],
)
def test_the_packages_exemption_does_not_extend_to_client_file_types(path: str) -> None:
    """The bypass found in review.

    `packages/` returned early for the whole subtree before the extension was
    tested, so a PDF there was accepted while the identical file was refused
    anywhere else.
    """
    assert violation_for(Path(path)) is not None
    assert main([path]) == 1


@pytest.mark.parametrize(
    "path",
    [
        "packages/contract/src/index.ts",
        "packages/mocks/src/handlers.ts",
        "packages/ui/tokens.css",
    ],
)
def test_workspace_source_is_still_allowed(path: str) -> None:
    """`packages/` is the pnpm workspace and is tracked on purpose. It only
    collides by name with the old prototype's upload directory."""
    assert violation_for(Path(path)) is None
    assert main([path]) == 0


@pytest.mark.parametrize(
    "path",
    [
        "services/core-api/pyproject.toml",
        "libs/domain/src/titlepipe_domain/errors.py",
        "docs/backend/PLAN.md",
        "infra/compose/compose.yaml",
    ],
)
def test_ordinary_source_is_allowed(path: str) -> None:
    assert violation_for(Path(path)) is None


def test_an_upload_directory_is_refused_whatever_it_holds() -> None:
    assert violation_for(Path("uploads/notes.txt")) is not None
    assert violation_for(Path("services/core-api/inbox/thing.json")) is not None


def test_the_allowlist_requires_an_exact_path() -> None:
    assert violation_for(Path("docs/archive/Title report review tool.zip")) is None
    assert violation_for(Path("docs/archive/other.pdf")) is not None


def test_main_reports_every_violation_not_just_the_first(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main(["a/one.pdf", "b/two.docx"]) == 1
    captured = capsys.readouterr().out
    assert "one.pdf" in captured
    assert "two.docx" in captured


def test_a_clean_changeset_passes() -> None:
    assert main(["services/core-api/app.py", "packages/contract/src/index.ts"]) == 0


# ---------------------------------------------------------------------------
# FX-32. Four synthetic files were committed with the hook running and NO
# bypass; it printed "Passed" and CI's `git ls-files -z | xargs -0` step exited
# 0 on the same four. Everything below is that report, turned into tests.
#
# EVERY PAYLOAD IS ASSEMBLED FROM FRAGMENTS RATHER THAN WRITTEN OUT. CI runs the
# guard over every tracked path, which includes this file, and a literal SSN or
# a literal dump header here would make the guard refuse its own tests. That is
# the rule biting rather than a workaround for it — see
# `test_the_guard_does_not_refuse_its_own_sources`, which pins it.
# ---------------------------------------------------------------------------

PDF_BYTES = b"%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
ZIP_BYTES = b"PK\x03\x04\x14\x00\x00\x00\x08\x00" + b"\x00" * 20
SQLITE_BYTES = b"SQLite format 3\x00" + b"\x00" * 80

FABRICATED_SSN = "412-" + "88-" + "9031"

DUMP_TEXT = (
    "-- PostgreSQL database "
    + "dump\n"
    + "COPY public.borrower (id, full_name, ssn) FROM "
    + "stdin;\n"
    + "1\tMARVIN P. HOLLISTER\t"
    + FABRICATED_SSN
    + "\n\\.\n"
)

# No SSN in this one ON PURPOSE. The first version of the dump test used a
# payload that carried both, so removing every dump marker still left the test
# green — the SSN rule was catching it. A test that passes for a reason other
# than the one it names is a test that cannot fail.
DUMP_TEXT_WITHOUT_NPI = (
    "-- PostgreSQL database "
    + "dump\n"
    + "COPY public.parcel (id, book, page) FROM "
    + "stdin;\n"
    + "1\t1334\t238\n\\.\n"
)

CSV_WITH_SSN = (
    "full_name,ssn,date_of_birth,loan_number\n"
    + "MARVIN P. HOLLISTER,"
    + FABRICATED_SSN
    + ",1961-03-04,LN-8827341\n"
)

CSV_WITHOUT_SSN = (
    "grantor,grantee,property_address,recorded\n"
    'MARVIN P. HOLLISTER,CREEKBANK RECOVERY SPV LLC,"118 CEDAR HOLLOW RD",2019-04-02\n'
)


def _write(tmp_path: Path, relative: str, payload: bytes | str) -> Path:
    target = tmp_path / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(payload, bytes):
        target.write_bytes(payload)
    else:
        target.write_text(payload)
    return target


@pytest.mark.parametrize(
    ("relative", "payload"),
    [
        # 1. node_modules/ was skipped ahead of both rules, so the largest
        #    directory in the tree was a hiding place.
        ("node_modules/.cache/county-package.pdf", PDF_BYTES),
        # 2. `path.suffix` string equality sees the LAST component only.
        ("docs/lincoln-county-search.pdf.bak", PDF_BYTES),
        # 3. No entry for the formats client data takes once EXTRACTED.
        ("docs/golden_seed.sql", DUMP_TEXT),
        ("docs/borrowers", CSV_WITH_SSN),
    ],
)
def test_the_four_files_that_passed_the_hook(
    tmp_path: Path, relative: str, payload: bytes | str
) -> None:
    """The FX-32 regression, one case per measured cause."""
    target = _write(tmp_path, relative, payload)
    assert violation_for(target) is not None
    assert main([str(target)]) == 1


def test_node_modules_is_no_longer_a_hiding_place(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """It was skipped BEFORE either rule ran, which is not a scoping decision —
    it is an exemption for the one directory nobody reads.

    The path here is RELATIVE and the working directory is moved to match,
    because that is what the hook and CI pass. An absolute `tmp_path` never
    starts with `node_modules/`, so the first version of this test stayed green
    with the skip put back — it was testing nothing.
    """
    _write(tmp_path, "node_modules/.cache/county-package.pdf", PDF_BYTES)
    monkeypatch.chdir(tmp_path)
    relative = Path("node_modules/.cache/county-package.pdf")
    assert violation_for(relative) is not None
    assert main([str(relative)]) == 1


@pytest.mark.parametrize(
    "name",
    [
        "report.pdf.bak",  # the real type is not the last component
        "report.pdf ",  # trailing space; `.suffix` is ".pdf " and != ".pdf"
        "report.pdf.",  # `path.suffixes` is [] for this
        "report.PDF~",  # case plus an emacs backup marker
        "report.pdf.old",
    ],
)
def test_decoration_does_not_hide_the_type(tmp_path: Path, name: str) -> None:
    """String equality on one suffix is what let every spelling here through."""
    target = _write(tmp_path, name, PDF_BYTES)
    assert violation_for(target) is not None
    assert ".pdf" in candidate_suffixes(name)


@pytest.mark.parametrize(
    ("name", "payload", "why"),
    [
        ("countypackage", PDF_BYTES, "no extension at all"),
        ("report.pdf.zzz", PDF_BYTES, "a decoration suffix the list does not know"),
        ("notes.md", PDF_BYTES, "an extension that is allowed everywhere"),
        ("styles.css", ZIP_BYTES, "an archive wearing a stylesheet's name"),
        ("data.yaml", SQLITE_BYTES, "a database wearing a config's name"),
    ],
)
def test_the_signature_rule_stands_on_its_own(
    tmp_path: Path, name: str, payload: bytes, why: str
) -> None:
    """The layer that does not care what you named the file.

    Every case here defeats the type rule on purpose — `{why}` — so a pass
    means the bytes were read and judged.
    """
    target = _write(tmp_path, name, payload)
    reason = violation_for(target)
    assert reason is not None
    assert "own bytes" in reason


def test_a_party_table_with_no_ssn_is_still_an_extract(tmp_path: Path) -> None:
    """The tabular rule alone: no forbidden extension, no signature, no SSN.

    Deliberately extensionless, because `.csv` is refused by name and would
    make this test pass for the wrong reason.
    """
    target = _write(tmp_path, "parties", CSV_WITHOUT_SSN)
    reason = violation_for(target)
    assert reason is not None
    assert "delimited table" in reason


@pytest.mark.parametrize(
    "name",
    ["extract.txt", "extract.json", "notes.md", "handler.py"],
)
def test_an_ssn_shaped_literal_is_refused_in_any_file_type(tmp_path: Path, name: str) -> None:
    """`.txt`, `.json`, `.md` and `.py` are all real source here and cannot be
    refused on their names, so the content is what has to carry the rule."""
    target = _write(tmp_path, name, f"contact on file: {FABRICATED_SSN}\n")
    reason = violation_for(target)
    assert reason is not None
    assert "SSN" in reason


@pytest.mark.parametrize(
    "name",
    ["golden_seed.sql", "seed.txt", "restore"],
)
def test_a_database_dump_is_a_seed_database(tmp_path: Path, name: str) -> None:
    """`.sql` cannot be refused by name — `migrations/sql/roles.sql` and the
    bench rig are real source — so the dump's own shape is the rule.

    The payload carries no SSN and no forbidden extension, so the dump markers
    are the only thing that can refuse it.
    """
    target = _write(tmp_path, name, DUMP_TEXT_WITHOUT_NPI)
    reason = violation_for(target)
    assert reason is not None
    assert "dump" in reason


@pytest.mark.parametrize(
    "suffix",
    [".csv", ".tsv", ".jsonl", ".ndjson", ".dump", ".parquet", ".xlsx"],
)
def test_the_extracted_data_formats_are_refused_by_type(suffix: str) -> None:
    """A county package stops being a PDF the moment it is parsed. `.sqlite`
    and `.db` were listed while `.dump` was not, and a seed database leaves
    Postgres as a dump."""
    assert violation_for(Path(f"docs/export{suffix}")) is not None


# ---------------------------------------------------------------------------
# The false-refusal side. A guard that fires on source gets switched off, and a
# guard that is switched off passes everything — so these are the same control.
# Both cases below were REAL: each refused a tracked file that had been correct
# since it was written, and each was found by running the guard over the whole
# tree rather than over its own fixtures.
# ---------------------------------------------------------------------------


def test_a_middle_component_that_names_a_real_type_stops_the_walk() -> None:
    """`infra/compose/compose.db.yaml` is a compose file for the database.

    A walk over every component reads its middle `.db` as a SQLite database.
    The walk stops at the first component that names a real type, so `.yaml`
    is the answer and `.db` is never reached.
    """
    assert candidate_suffixes("compose.db.yaml") == [".yaml"]
    assert violation_for(Path("infra/compose/compose.db.yaml")) is None


def test_source_that_mentions_a_format_is_not_that_format(tmp_path: Path) -> None:
    """`apps/web/e2e/invariants/ingest.spec.ts` carries `%PDF-` in a fixture
    string at byte 471. A signature scanned for anywhere in the head refuses
    it; anchored to its own offset, it does not."""
    target = _write(tmp_path, "ingest.spec.ts", "const magic = '%PDF-1.7'\n" * 40)
    assert violation_for(target) is None


def test_a_lock_file_is_exempt_from_size_but_from_nothing_else(tmp_path: Path) -> None:
    """Dependency metadata is legitimately large and grows on its own.

    The exemption is a shape rather than a path, so a lock file this repository
    does not have yet is covered — and it buys nothing on any other rule.
    """
    big = "x" * (LARGE_TEXT_BYTES + 1)
    # These two wear an extension the size rule DOES cover, so the exemption is
    # the only thing standing between them and a refusal.
    assert violation_for(_write(tmp_path, "pnpm-lock.yaml", big)) is None
    assert violation_for(_write(tmp_path, "package-lock.json", big)) is None
    # And it buys nothing anywhere else: the same name, one SSN-shaped literal.
    poisoned = _write(tmp_path, "pnpm-lock.yaml", f"# {FABRICATED_SSN}\n")
    assert violation_for(poisoned) is not None
    assert violation_for(_write(tmp_path, "package-lock.json", DUMP_TEXT)) is not None


def test_half_a_megabyte_of_json_is_data_not_source(tmp_path: Path) -> None:
    """The threshold is the number the tree already committed to in
    `check-added-large-files --maxkb=512`, extended to the paths that hook does
    not cover — the CI whole-tree run, and `--tree`."""
    assert violation_for(_write(tmp_path, "fixture.json", "x" * (LARGE_TEXT_BYTES - 1))) is None
    reason = violation_for(_write(tmp_path, "fixture.json", "x" * (LARGE_TEXT_BYTES + 1)))
    assert reason is not None
    assert "extracted data at that size" in reason


# ---------------------------------------------------------------------------
# Running at all
# ---------------------------------------------------------------------------


def test_a_bare_invocation_refuses_instead_of_reporting_success(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """It returned 0 in silence: a compliance control reporting success without
    having looked at anything. 2 is "could not run", distinct from 1."""
    assert main([]) == 2
    assert "REFUSING TO RUN" in capsys.readouterr().err


def test_tree_mode_names_untracked_files_that_git_does_not_ignore() -> None:
    """`git ls-files` alone names only TRACKED files, so a bundle sitting in the
    checkout unstaged was never passed to the guard and so was never refused."""
    paths = set(tree_paths())
    assert "scripts/check_no_client_data.py" in paths
    assert not any(name.startswith(".git/") for name in paths)


def test_the_whole_checkout_passes() -> None:
    """Exactly what CI runs, and the test that found the one real hole in the
    tree: `docs/rulebook-source/abstractor-report-typing.skill` is a ZIP that
    had never been examined, because `.skill` was on no extension list and
    there was no content rule."""
    offenders = [name for name in tree_paths() if violation_for(Path(name)) is not None]
    assert offenders == [], (
        "the guard refuses files in this checkout. If they are untracked, they "
        "are what it exists to catch; if they are tracked, either the file or a "
        "rule is wrong: " + ", ".join(offenders)
    )


def test_the_guard_does_not_refuse_its_own_sources() -> None:
    """Pins the reason every payload in this file is assembled from fragments.

    A literal SSN or dump header written out here would be matched by the guard
    scanning this file, and the suite would refuse its own tests. The patterns
    are spelled with `\\s+` between their words so that no pattern is an
    example of what it detects.
    """
    for name in ("scripts/check_no_client_data.py", "scripts/tests/test_check_no_client_data.py"):
        assert violation_for(Path(name)) is None, name


def test_a_large_unrecognised_binary_is_refused(tmp_path: Path) -> None:
    """The backstop for the container format that has no signature here.

    The payload has no forbidden extension, no magic bytes on the list, and is
    too large to scan as text — so before this rule it passed every axis. `.bin`
    is not a sized text extension either, which is what made it a hole rather
    than a duplicate of the size rule.
    """
    payload = b"\x89\x01\x02\x03" + bytes(range(256)) * 2100  # ~512 KB, not text
    assert len(payload) > LARGE_TEXT_BYTES
    reason = violation_for(_write(tmp_path, "bundle.bin", payload))
    assert reason is not None
    assert "binary format nothing here recognises" in reason


def test_a_large_text_file_is_not_a_large_binary(tmp_path: Path) -> None:
    """`docs/frontend/design-2026-08/reference-app.html` is 1.2 MB of tracked
    HTML and the largest file in the tree. Being large is not the rule; being
    large and unreadable is."""
    big_text = "<div>the design export</div>\n" * 50_000
    assert len(big_text) > LARGE_TEXT_BYTES
    assert violation_for(_write(tmp_path, "reference-app.html", big_text)) is None


def test_a_utf8_character_across_the_read_boundary_is_not_binariness(
    tmp_path: Path,
) -> None:
    """The head is a fixed-size read, so a multi-byte character can straddle
    its end. A truncated one is not evidence of anything."""
    # One ASCII byte first, so the two-byte characters land on odd offsets and
    # byte 511 is the FIRST half of one. Without the leading "a" they pair up
    # evenly, the 512-byte read decodes cleanly, and this test cannot fail —
    # which is exactly how it was written the first time.
    straddling = "a" + "é" * 400_000
    with pytest.raises(UnicodeDecodeError):
        straddling.encode("utf-8")[:512].decode("utf-8")
    assert violation_for(_write(tmp_path, "notes.md", straddling)) is None

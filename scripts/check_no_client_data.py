"""Refuse to commit county packages, seed databases or client documents.

`docs/CONTEXT.md` §19 records a bare relative path in the ingest module writing
every uploaded file into the working tree, producing a 644 MB archive of real
search packages containing GLBA NPI.

This is the structural guard for that. A false PASS is the worst outcome it can
produce — worse than a false refusal, because the guard is quoted as evidence
that the tree is clean — so every rule below is written to fail loud, and the
escape hatch is a hash-pinned ALLOWLIST entry rather than a softer rule.

## Why there is more here than an extension list

An extension list alone was measured to pass four synthetic client-data files
with the pre-commit hook running and no bypass of any kind:

  1. `node_modules/.cache/county-package.pdf` — `node_modules/` was skipped
     before either rule ran, so the tree's largest directory was a hiding place.
  2. `lincoln-county-search.pdf.bak` — the test was `path.suffix` string
     equality, which sees only the LAST extension. `x.pdf ` with a trailing
     space and a file with no extension at all walked through the same way.
  3. `golden_seed.sql` and a bare `borrowers` CSV — there was no entry for the
     formats client data takes once it has been EXTRACTED from a PDF. `.sqlite`
     and `.db` were listed; `.sql` was not, and a seed database leaves Postgres
     as a `.sql` dump.

So the guard now judges a file on three axes, and ANY ONE of them refuses it.

## Four rules, applied independently

**Type rule (path shape)** — every dot-separated component of the filename is
normalised and tested, not just the last one, so `.pdf.bak`, `.pdf ` and
`.PDF~` are all `.pdf`. Refused **anywhere**, with no directory exemptions.

**Signature rule (content shape)** — the leading bytes of the file on disk are
matched against the container formats client data arrives in. A PDF is refused
for being a PDF, whatever it is called and whether or not it has an extension.
This is the rule that does not care what you name the file.

**Extract rule (content shape, again)** — a TEXT file is read and refused if it
carries a database-dump preamble, an SSN-shaped literal, or a delimited header
naming identity columns above at least one data row. This is what covers
`.json`, `.txt`, `.sql` and `.xml`, which have real source roles here and so
cannot be refused on their names.

**Directory rule (path shape)** — a path under `uploads/`, `inbox/` or
`county-packages/` is refused whatever it contains.

`packages/` is exempt from the **directory** rule only. It is the pnpm workspace
directory holding `contract`, `ui` and `mocks` source — tracked on purpose — and
it collides by name with the old prototype's upload directory.

> Found in review: an earlier version returned early for the whole `packages/`
> tree *before* testing the extension, so `packages/county-package.pdf` was
> accepted while the identical file was refused anywhere else. The exemption is
> now scoped to the one rule that needs it.

## What this guard does NOT do, stated so it is not over-claimed

The signature and extract rules need bytes, so they can only run on a file that
exists on disk. Both real invocations satisfy that — the pre-commit hook is
handed working-tree paths and the CI step runs in a checkout — but a path
naming a file that is not there is judged on its name alone.

They read the WORKING TREE copy, which is not necessarily what is staged. A
`git add` followed by an edit is outside what this can see.

The INSERT dump marker needs THREE CONSECUTIVE ROWS in the one spelling
`INSERT INTO <table> VALUES (`. MEASURED 2026-09-08 against the pattern
itself: two rows pass, `INSERT INTO t (a, b) VALUES (...)` — pg_dump's
`--column-inserts` form — passes at any count, and a single multi-row
`INSERT INTO t VALUES (1),(2),(3);` passes. None of that is a hole in the
guard for a tool-generated dump, which carries the `pg_dump`/`mysqldump`
header or a `COPY ... FROM stdin` block and is refused on those; it is the
ceiling on a HAND-WRITTEN or header-stripped `.sql` seed with no SSN in it.
What would close it: parsing the file as SQL rather than matching row shapes,
which is a dependency this guard does not have and should not grow for one
marker out of four.

`--tree` covers tracked files plus untracked files that git does not ignore. A
path listed in `.gitignore` is deliberately outside version control and is not
walked; the 644 MB directory would not be named by it.

Exit codes: 0 clean, 1 refused, 2 the guard could not run (which includes being
invoked with no arguments — see `main`).
"""

from __future__ import annotations

import csv
import hashlib
import re
import subprocess
import sys
from pathlib import Path

# Extensions that carry client documents, a golden-set database, or client data
# already extracted out of one. Refused everywhere, including inside exempt
# directories, on ANY dot-separated component of the name.
FORBIDDEN_SUFFIXES = frozenset(
    {
        # documents
        ".pdf",
        ".docx",
        ".doc",
        ".rtf",
        ".odt",
        ".pages",
        ".wpd",
        ".ppt",
        ".pptx",
        ".eps",
        ".ai",
        ".ps",
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
        ".jfif",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".avif",
        ".heic",
        ".heif",
        ".jp2",
        ".psd",
        ".pcx",
        ".tga",
        # databases
        ".seed",
        ".sqlite",
        ".sqlite3",
        ".sqlitedb",
        ".db",
        ".mdb",
        ".accdb",
        ".dbf",
        ".mdf",
        ".dmp",
        # Extracted client data. This block is what the four synthetic files
        # exposed: a county package stops being a PDF the moment it is parsed,
        # and every format below is a shape it takes afterwards. `.sqlite` and
        # `.db` were listed while `.dump` was not, and a seed database leaves
        # Postgres as a dump. `.csv` is the single commonest carrier of a
        # borrower table and had no entry at all.
        #
        # `.json`, `.txt`, `.sql`, `.xml` and `.yaml` are deliberately NOT here.
        # They are real source formats in this repository — `roles.sql`,
        # `tsconfig.json`, the bench rig — so they are judged by the extract
        # rule on what they contain rather than by their names.
        ".csv",
        ".tsv",
        ".psv",
        ".jsonl",
        ".ndjson",
        ".dump",
        ".parquet",
        ".avro",
        ".orc",
        ".feather",
        ".xls",
        ".xlsx",
        ".xlsm",
        ".ods",
        # mail and contact stores, which carry NPI as a matter of course
        ".pst",
        ".ost",
        ".eml",
        ".msg",
        ".mbox",
        ".vcf",
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
        ".lz4",
        ".lzma",
        ".cab",
        ".arj",
        ".iso",
        ".dmg",
    }
)

# The leading run of letters and digits in one dot-separated component of a
# filename. Everything after it is decoration that hides the type: a trailing
# space, an NBSP, `~`, `-old`, `.bak`, or an NTFS `::$DATA` stream name. The run
# is taken WHOLE, so `pdfkit` is `pdfkit` and not `pdf`.
_EXTENSION_RUN = re.compile(r"[a-z0-9]+")


# Suffixes that do not name a file type — they park one. Walking PAST these is
# what turns `report.pdf.bak` back into a PDF.
#
# The walk stops at the first component that is NOT one of these, and that stop
# is the whole reason the list is closed rather than "check every component":
# `infra/compose/compose.db.yaml` is a compose file for the database, and a walk
# over every component reads its middle `.db` as a SQLite database and refuses
# a file that has been correct since it was written.
DECORATION_SUFFIXES = frozenset(
    {
        "bak",
        "backup",
        "bkp",
        "old",
        "orig",
        "original",
        "save",
        "saved",
        "copy",
        "tmp",
        "temp",
        "swp",
        "swo",
        "part",
        "partial",
        "download",
        "crdownload",
        "disabled",
        "off",
        "hidden",
        "unused",
        "keep",
    }
)


def candidate_suffixes(name: str) -> list[str]:
    """The extensions `name` is claiming, innermost last.

    `path.suffix` sees ONE component and compares it as a string, which is what
    let `report.pdf.bak`, `report.pdf ` (trailing space) and `report.pdf.`
    through — the last two because the string carried decoration, the first
    because the real type was not the last component.

    So the name is split and each component normalised to its leading run of
    letters and digits, and the walk runs from the END backwards through
    DECORATION_SUFFIXES. All three spellings above yield `.pdf`; `compose.db.yaml`
    yields only `.yaml`, because `.yaml` is a real type and the walk stops there.
    """
    components = name.split(".")[1:]  # [0] is the stem, not an extension
    found: list[str] = []
    for component in reversed(components):
        run = _EXTENSION_RUN.match(component.strip().casefold())
        if run is None:
            continue  # e.g. the empty component of a trailing `report.pdf.`
        found.append(f".{run.group()}")
        if run.group() not in DECORATION_SUFFIXES:
            break
    return found


# (offset, magic bytes, what it is). Matched against the head of the file, so a
# renamed or extensionless county package is refused for being one. The read is
# capped at HEAD_BYTES, which is why the tar signature at 257 is the deepest
# entry here.
CONTENT_SIGNATURES: tuple[tuple[int, bytes, str], ...] = (
    (0, b"%PDF-", "a PDF"),
    (0, b"PK\x03\x04", "a ZIP container (.zip/.docx/.xlsx/.pptx/.odt)"),
    (0, b"PK\x05\x06", "an empty ZIP container"),
    (0, b"PK\x07\x08", "a spanned ZIP container"),
    (0, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "an OLE2 document (.doc/.xls/.msg)"),
    (0, b"SQLite format 3\x00", "a SQLite database"),
    (0, b"\x89PNG\r\n\x1a\n", "a PNG"),
    (0, b"\xff\xd8\xff", "a JPEG"),
    (0, b"GIF87a", "a GIF"),
    (0, b"GIF89a", "a GIF"),
    (0, b"II*\x00", "a TIFF"),
    (0, b"MM\x00*", "a TIFF"),
    (0, b"\x00\x00\x00\x0cjP  ", "a JPEG 2000 image"),
    (0, b"\xff\x4f\xff\x51", "a JPEG 2000 codestream"),
    (0, b"\x1f\x8b", "a gzip stream"),
    (0, b"BZh", "a bzip2 archive"),
    (0, b"\xfd7zXZ\x00", "an xz archive"),
    (0, b"\x28\xb5\x2f\xfd", "a zstd archive"),
    (0, b"7z\xbc\xaf\x27\x1c", "a 7-Zip archive"),
    (0, b"Rar!\x1a\x07", "a RAR archive"),
    (0, b"PGDMP", "a pg_dump archive"),
    (0, b"PAR1", "a Parquet file"),
    (0, b"Obj\x01", "an Avro container"),
    (0, b"{\\rtf", "an RTF document"),
    (0, b"%!PS", "a PostScript document"),
    (4, b"ftypheic", "a HEIC image"),
    (4, b"ftypheix", "a HEIC image"),
    (4, b"ftypmif1", "a HEIF image"),
    (4, b"ftypavif", "an AVIF image"),
    (8, b"WEBP", "a WebP image"),
    (257, b"ustar", "a tar archive"),
    (
        4,
        b"Standard Jet DB",
        "an Access database",
    ),
    (
        4,
        b"Standard ACE DB",
        "an Access database",
    ),
)

# Enough for every signature above, including tar's at offset 257.
#
# Every signature is anchored to its own offset rather than searched for. That
# is a correctness requirement, not an optimisation: a scan for `%PDF-` anywhere
# in the head refuses `apps/web/e2e/invariants/ingest.spec.ts`, which mentions
# the header in a fixture string at byte 471. A signature rule that fires on
# source discussing a format is a rule that gets switched off.
HEAD_BYTES = 512


def content_signature(head: bytes) -> str | None:
    """What container format `head` is the start of, or `None`."""
    for offset, magic, description in CONTENT_SIGNATURES:
        if head[offset : offset + len(magic)] == magic:
            return description
    return None


# EVERY PATTERN BELOW IS WRITTEN WITH A METACHARACTER BETWEEN ITS WORDS, and
# that is load-bearing rather than stylistic. CI runs this guard over every
# tracked file, which includes this one. A pattern spelled as the plain string
# it looks for would match its own source and the guard would refuse itself.
# `\s+` matches whitespace and does not match the three characters `\`, `s`,
# `+`, so no pattern here is an example of what it detects.

# The preamble of a database dump. `.sql` cannot be refused on its name — the
# migration `roles.sql` and the bench rig are real source — so a dump is
# recognised instead by the shape only a dump has: a bulk-copy block, literal
# INSERT rows, or the header `pg_dump` and `mysqldump` write.
DUMP_MARKERS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"^\s*COPY\s+\S+.*\sFROM\s+stdin\s*;", re.IGNORECASE | re.MULTILINE),
        "a bulk-copy block, which is how a dump carries table rows",
    ),
    (
        re.compile(r"--\s+PostgreSQL\s+database\s+dump", re.IGNORECASE),
        "a pg_dump header",
    ),
    (
        re.compile(r"--\s+MySQL\s+dump", re.IGNORECASE),
        "a mysqldump header",
    ),
    (
        re.compile(r"--\s+Dumping\s+data\s+for\s+table", re.IGNORECASE),
        "a mysqldump data section",
    ),
    (
        # Three, not one. A dump carries table data as MANY consecutive rows; a
        # single `INSERT INTO ... VALUES (` is how a migration seeds a lookup or
        # how a docstring shows the shape it refuses. MEASURED 2026-09-08: the
        # one-row form flagged 0112, whose only match is an example inside its
        # own docstring demonstrating the bound it adds. What raising it to
        # three costs is in "What this guard does NOT do"; pinned by
        # `tests/test_check_no_client_data.py::test_the_insert_marker_*`.
        re.compile(
            r"(?:^\s*INSERT\s+INTO\s+\S+\s+VALUES\s*\(.*$\n?){3,}",
            re.IGNORECASE | re.MULTILINE,
        ),
        "repeated literal INSERT rows, which is how a dump carries table data",
    ),
)

# A US Social Security number as it appears in a document or an extract: three
# digits, two, four. GLBA NPI in its most recognisable form, and the one marker
# worth applying to a file of ANY type — an SSN in a `.md` or a `.py` is the
# same leak as an SSN in a `.csv`. The lookarounds keep it off a date, a UUID
# and a hyphenated identifier, all of which have a digit or a dash on the side
# an SSN does not.
SSN_SHAPED = re.compile(r"(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])")

# Column names that identify a natural person or their loan. Used ONLY against
# the first line of a file, parsed as a delimited header — never as a word
# search, because `grantor` and `borrower` are domain vocabulary appearing
# throughout this repository's source and prose entirely legitimately.
IDENTITY_COLUMNS = frozenset(
    {
        "ssn",
        "social_security",
        "social_security_number",
        "taxpayer_id",
        "tin",
        "dob",
        "date_of_birth",
        "birth_date",
        "borrower",
        "borrower_name",
        "co_borrower",
        "full_name",
        "first_name",
        "last_name",
        "middle_name",
        "maiden_name",
        "grantor",
        "grantee",
        "mortgagor",
        "mortgagee",
        "vesting_name",
        "loan_number",
        "loan_no",
        "account_number",
        "account_no",
        "drivers_license",
        "passport_number",
        "phone_number",
        "home_address",
        "mailing_address",
        "property_address",
        "site_address",
    }
)

# Delimiters a tabular extract is written with.
DELIMITERS = (",", "\t", "|", ";")

# Extensions whose SIZE is evidence on its own. A half-megabyte of JSON, SQL or
# plain text in this repository is generated or extracted data; either way that
# is a deliberate decision rather than something to slip past a hook. The
# threshold is the number the tree already committed to in
# `check-added-large-files --maxkb=512`, extended to the paths that hook does
# not cover — the CI whole-tree run, and `--tree`.
SIZED_TEXT_SUFFIXES = frozenset(
    {".json", ".txt", ".sql", ".xml", ".yaml", ".yml", ".log", ".ini", ".conf"}
)
LARGE_TEXT_BYTES = 512 * 1024

# Machine-generated dependency metadata: legitimately large, and it grows on its
# own. Exempt from the SIZE rule only, never from any other rule. Matched as a
# shape rather than a path, so a lock file this repository does not have yet is
# covered without an edit here.
LOCKFILE_NAMES = re.compile(r"(^|[.\-])lock\.(json|ya?ml|toml)$|\.lock$", re.IGNORECASE)

# A header row and its data rows are lines, not documents. Past this a line is
# not a table row, and `csv.reader` refuses to parse a field longer than 128 KB
# anyway — it raises rather than returning, which turned a 512 KB single-line
# `.json` into a traceback instead of a verdict.
MAX_ROW_CHARS = 64 * 1024

# The extract rule reads whole files, so the read is bounded. Nothing tracked is
# close to this, and a text file past it is refused by the size rule anyway.
MAX_TEXT_BYTES = 4 * 1024 * 1024


def looks_binary(head: bytes) -> bool:
    """Whether `head` is the start of something that is not text.

    The last few bytes are retried without, because a UTF-8 character can
    straddle the end of a fixed-size read and a truncated one is not evidence
    of anything.
    """
    if b"\x00" in head:
        return True
    for trim in (0, 1, 2, 3):
        try:
            head[: len(head) - trim].decode("utf-8")
        except UnicodeDecodeError:
            continue
        return False
    return True


def _as_text(raw: bytes) -> str | None:
    """`raw` as text, or `None` if it is not text at all."""
    if b"\x00" in raw:
        return None
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return None


def tabular_identity_header(text: str) -> str | None:
    """A description of the client-data table `text` is, or `None`.

    Requires the FIRST non-blank line to parse as a header of at least three
    fields, at least two of them naming an identity or loan column, above at
    least one row with the same field count. A header alone is a schema; a
    header with rows under it is an extract.

    Only line one is considered, and that is what makes the column names safe
    to test at all — searching the whole file for `grantor` would fire on this
    repository's own vocabulary on almost every page.
    """
    lines = [line for line in text.split("\n") if line.strip() and len(line) <= MAX_ROW_CHARS][:200]
    if not lines:
        return None
    for delimiter in DELIMITERS:
        try:
            rows = list(csv.reader(lines, delimiter=delimiter))
        except csv.Error:
            continue  # not a table in this dialect; the other rules still apply
        header = [field.strip().casefold().replace(" ", "_").replace("-", "_") for field in rows[0]]
        if len(header) < 3:
            continue
        named = sorted(field for field in header if field in IDENTITY_COLUMNS)
        if len(named) < 2:
            continue
        if any(len(row) == len(header) for row in rows[1:]):
            return (
                f"a {delimiter!r}-delimited table with {named[0]}/{named[1]} columns and data rows"
            )
    return None


# Directory names that hold uploads or county packages by convention.
FORBIDDEN_DIRECTORY_NAMES = frozenset({"uploads", "inbox", "county-packages"})

# Exempt from the DIRECTORY rule only, never from any other rule.
DIRECTORY_RULE_EXEMPT_PREFIXES = ("packages/",)

# Git's own object storage. The ONLY unconditional skip, and it is not a policy
# decision — `.git/` is never staged and never listed by `git ls-files`, so it
# reaches the rules only if someone points the guard at it by hand.
#
# `node_modules/` used to be here, ahead of both rules, and that made the
# largest directory in the tree a hiding place: `git add -f
# node_modules/.cache/county-package.pdf` was accepted by the hook and by CI.
# It is not skipped any more. Nothing is lost by that — it is gitignored, so
# neither the hook nor `git ls-files` ever names a file inside it, and the
# `git add -f` that is the whole point of the hole now gets refused.
SKIPPED_PREFIXES = (".git/",)

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
    # Reviewed 2026-08-06; revised 2026-08-08. The 2026-08-06 review admitted
    # 68 screenshot and document files by hash and REFUSED 13, escalating them
    # to the owner. The 2026-08-08 reorganization resolved the escalation by
    # REMOVAL, not admission: `shots-final/` and `shots-w4/` (compare.mjs
    # review evidence, regenerable, already named by .gitignore's `/shots*/`
    # rule) and the four `docs/frontend/directions/*-full.png` renders (their
    # tracked `.html` sources are the reference; a PNG re-renders on demand)
    # left version control, and their entries left this list with them. The
    # design-export archive was replaced by its extracted text sources
    # (`TitlePipe.dc.html`, `support.js`), which are reviewable as text and
    # which the extension rule does not match.
    #
    # The bar for what remains is unchanged: admission on evidence. Every file
    # below was opened and read in full. Re-inspect before updating a hash —
    # a file with the same name produced from a real package would look almost
    # identical and would not be safe.
    "docs/rulebook-source/2_Golden_Rules.docx": (
        "b8e86d50336d73920bcfe46da1f68d3aaada5dce1437f9d65a2f030dd688af2b",
        "rulebook rules text only; read in full — no party, property, parcel, amount or recording detail, and no comments/notes/author metadata",
    ),
    "docs/rulebook-source/3_Typed_Report_Template.docx": (
        "2b3c43d4e84bf5826cd82b2333456edfd867fe8e801c68c1c26779e9198e6641",
        "blank typed-report template; read in full — every field is an empty label, no values of any kind",
    ),
    # Admitted 2026-09-05, when the signature rule first looked inside it. It is
    # a ZIP and had never been examined: `.skill` was on no extension list and
    # there was no content rule, so it sat in VCS unreviewed. Opened and all
    # five members read: SKILL.md, three `references/*.md`, and
    # `assets/typed-report-template.md`. It is the packaged form of the vendor
    # 66805 typing rulebook already admitted below as a `.docx`, and it is held
    # to the same bar. No party, property, address, parcel, case or account
    # appears. The template is entirely `<placeholder>` labels; the recording
    # numbers are per-county FORMAT exemplars; the money figures are worked rule
    # examples attached to no person. ONE person-shaped literal exists — a name
    # used once to illustrate ALL-CAPS-to-Title-Case conversion, with nothing
    # linked to it — and it is named here so a later reviewer finds it on
    # purpose rather than by surprise.
    "docs/rulebook-source/abstractor-report-typing.skill": (
        "b4bdfdf1c573ee7ef78fb7203d9a9a955cb31cecace099541bdc79288016b3bb",
        "vendor 66805 typing rulebook packaged as a skill; all five members read in full — placeholder-only report template, per-county instrument-number format exemplars, worked money-rule examples, and one name used as a letter-casing example; no party, property, parcel, case or account data",
    ),
    "docs/rulebook-source/Implementation_Rulebook_v1.docx": (
        "d8619d56f633497dc9424631cdc31558cb82490cf60216f883300ee87931207d",
        "vendor 66805 typing rulebook (skill source); read in full — no party, property, address or case data; six bare instrument-number format examples and internal cost-model figures only",
    ),
}


def _content_violation(path: Path) -> str | None:
    """The signature, extract and size rules, which need the file's bytes.

    Returns `None` when the file is not on disk. That is a real limit and it is
    stated in the module docstring rather than papered over: both invocations
    that matter — the pre-commit hook and the CI checkout — hand this function
    paths that exist, but a path naming a file that is not there gets the
    name-based rules only.
    """
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            head = handle.read(HEAD_BYTES)
    except (OSError, ValueError):
        return None

    signature = content_signature(head)
    if signature is not None:
        return (
            f"the file's own bytes say it is {signature}, whatever it is named. "
            "Client documents and databases are refused by content, not by "
            "extension."
        )

    suffixes = candidate_suffixes(path.name)
    last = suffixes[0] if suffixes else ""
    if (
        last in SIZED_TEXT_SUFFIXES
        and size > LARGE_TEXT_BYTES
        and LOCKFILE_NAMES.search(path.name) is None
    ):
        return (
            f"{size // 1024} KB of {last} is generated or extracted data at that "
            f"size, not source (limit {LARGE_TEXT_BYTES // 1024} KB)"
        )

    # Half a megabyte of a format nothing here recognises. Every container
    # client data actually arrives in has a signature above, so this is the
    # backstop for the one that does not — and it is not hypothetical that it
    # is needed: `check-added-large-files --maxkb=512` covers a file being
    # ADDED through the hook and covers nothing on the CI whole-tree run, which
    # is where an unrecognised bundle would sit.
    #
    # Text is exempt, which is what keeps the two ~1 MB design exports in
    # `docs/frontend/design-2026-08/` — the largest tracked files there are —
    # out of this. Being large and unreadable is the rule; being large is not.
    if size > LARGE_TEXT_BYTES and looks_binary(head):
        return (
            f"{size // 1024} KB of a binary format nothing here recognises. "
            "Client data at volume is binary, and a bundle this size is not "
            "source whatever it turns out to be."
        )

    if size > MAX_TEXT_BYTES:
        return None  # too large to scan as text, and it read as text above
    try:
        text = _as_text(path.read_bytes())
    except OSError:
        return None
    if text is None:
        return None

    for pattern, description in DUMP_MARKERS:
        if pattern.search(text):
            return f"it contains {description} — a database dump is a seed database"

    if SSN_SHAPED.search(text):
        return "it contains an SSN-shaped literal, which is GLBA NPI"

    table = tabular_identity_header(text)
    if table is not None:
        return f"it is {table} — an extract of client data"

    return None


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

    # Type rule — every component of the name, no exemptions. `report.pdf.bak`
    # and `report.pdf ` are both `.pdf`.
    for suffix in candidate_suffixes(path.name):
        if suffix in FORBIDDEN_SUFFIXES:
            return f"{suffix} files may contain client documents or golden data"

    # Signature, extract and size rules — what the file actually is.
    content = _content_violation(path)
    if content is not None:
        return content

    # Directory rule — `packages/` is the pnpm workspace, not county packages.
    if relative.startswith(DIRECTORY_RULE_EXEMPT_PREFIXES):
        return None
    conflicting = {part.lower() for part in path.parts} & FORBIDDEN_DIRECTORY_NAMES
    if conflicting:
        return f"{sorted(conflicting)[0]}/ holds uploads and must never be committed"

    return None


def tree_paths() -> list[str]:
    """Every tracked file plus every untracked file git does not ignore.

    `git ls-files` alone names only TRACKED files, so a bundle sitting in the
    checkout unstaged was never passed to the guard and so was never refused.
    This is also why `--tree` exists as a mode rather than as a shell pipeline:
    `git ls-files -z | xargs -0 …` exits on xargs' status, and a `git` that
    fails leaves the pipeline reporting success with nothing checked.

    A path in `.gitignore` is NOT walked. That is deliberate and it is the
    limit of this mode: ignoring a path is the statement that it is outside
    version control, which is what the rule requires of it.
    """
    root = Path(__file__).resolve().parent.parent
    # S603: the argv is built here from constants, never from user input.
    completed = subprocess.run(  # noqa: S603
        [  # noqa: S607 — git is required tooling, resolved from PATH
            "git",
            "-C",
            str(root),
            "ls-files",
            "-z",
            "--cached",
            "--others",
            "--exclude-standard",
        ],
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "git ls-files failed: " + completed.stderr.decode("utf-8", "replace").strip()
        )
    return [
        name for name in completed.stdout.decode("utf-8", "surrogateescape").split("\0") if name
    ]


USAGE = """usage: check_no_client_data.py PATH [PATH ...]
       check_no_client_data.py --tree

Refuses county packages, seed databases and client documents.

REFUSING TO RUN. This was invoked with no paths, which used to exit 0 in
silence — a compliance control reporting success without having looked at
anything. Pass the files to check, or `--tree` to check the whole checkout."""


def main(argv: list[str]) -> int:
    if not argv:
        print(USAGE, file=sys.stderr)
        return 2

    if argv == ["--tree"]:
        try:
            argv = tree_paths()
        except (RuntimeError, OSError) as error:
            print(f"check_no_client_data.py: {error}", file=sys.stderr)
            return 2
        if not argv:
            print(
                "check_no_client_data.py: --tree found no files to check, which "
                "cannot be right in a checkout.",
                file=sys.stderr,
            )
            return 2

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

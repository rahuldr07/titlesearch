---
title: Gate 0 — Backend Safety-Net Recovery
date: 2026-07-22
status: complete
verdict: PORT
owner: rahuldr07
tags:
  - titlepipe
  - backend
  - gate-0
  - recovery
aliases:
  - Gate 0 Recovery Record
  - Prototype Recovery Evidence
---

# Gate 0 — Recover and freeze the safety net

> [!success] Gate 0 is **COMPLETE**, by the synthetic-fixture route. Verdict **PORT**.
> The two conditions that held it open are closed:
>
> - **The suite is green: 163 tests.** The 10 tests that needed a county package
>   and five delivered client reports now run against synthetic fixtures. Command:
>   `python scripts/gate0/run_prototype_suite.py`.
> - **`v14` exists.** R15's mandated assertion, in `HARD_VALIDATORS`, with a
>   regression test that fails if the guard is weakened.
>
> Closure was by **option (b)** — synthetic substitution — chosen deliberately
> over restoring client data. §11a records what that route can and cannot prove.

> [!success] Verdict: **PORT**, not reconstruction
> The Flask prototype was recovered intact from `~/Downloads/titlepipe.zip`, together
> with the five-bug patch set in `~/Downloads/titlepipe_bugfixes.zip`. Source, tests and
> the previously-missing `docs/spec.md` are all present. The 155-test figure is
> reconciled below: it is **131 package tests + 24 patch tests**. 145 ran as
> recovered; the other 10 needed client data and now run against synthetic
> fixtures. With `v14` the suite stands at **163**.

## 1. Execution record

| Item | Value |
|---|---|
| Date | 2026-07-22 |
| Machine | Windows 11 Pro for Workstations 10.0.26200, x86_64 |
| Executor | rahuldr07 (local implementation session, per `docs/prompts/claude-gate-0-1-execution-prompt.md`) |
| Repository | `C:\Users\vicky\Desktop\TitleSearch` |
| Branch | `rahuldr07/backend-foundation` |
| Python used for the test run | CPython 3.13.14, `uv`-managed, isolated venv outside the repository |

## 2. Search scope and method

The prompt bounded this pass deliberately: one filename search per root, one
domain-signal search per credible candidate, one entry listing per plausible archive,
no full-drive content scan. That bound was honoured.

### Roots searched

| Root | Exists | Files enumerated | Method |
|---|---|---|---|
| `C:\Users\vicky\Desktop\TitleSearch` (repo) | yes | — | `git status`, `rg --files` |
| `C:\Users\vicky\Desktop` (repo parent) | yes | 47,328 | `rg --files` + `Get-ChildItem -Recurse -Include` |
| `C:\Users\vicky\Documents` | yes | 105,240 | `rg --files` |
| `C:\Users\vicky\Downloads` | yes | 44,818 | `rg --files` |
| `C:\Users\vicky\.claude` | yes | — | `rg --files` (agent session/skill store) |
| `C:\Users\vicky\.codex` | yes | — | `rg --files` (agent session/skill store) |
| `D:\` | **absent** | — | `Get-PSDrive` reports only `C:` |

`docs/HANDOFF.md` §6 describes a 932 GB `D:` SATA archive drive. **It is not present on
this machine.** If that drive exists but is currently detached, it is the one root this
pass could not cover, and it is the only place a further copy could hide. Recorded as
negative evidence with a known gap rather than as a clean sweep.

Excluded from all passes: `node_modules`, `.git`, `.venv`/`venv`, `site-packages`,
`__pycache__`, build/`dist` output, package caches.

### Filename patterns

`models.py` · `validators.py` · `segment.py` · `assemble.py` · `render.py` · `api.py` ·
`ingest.py` · `golden.py` · `fix_segment.py` · `fix_assemble.py` · `fix_api.py` ·
`conftest.py` · `titlepipe.seed` · `rulings_2026-07.md` · `spec.md` ·
`titlepipe_bugfixes.zip` · `titlepipe*`

### Domain-signal patterns

`NOT_PRESENT` · `PRESENT_UNREADABLE` · `TitlePipe` · `titlepipe` · `Abstractor Call Back`

## 3. Candidate inventory

### 3.1 Credible — recovered (multi-signal match)

**`C:\Users\vicky\Downloads\titlepipe.zip`**

| Property | Value |
|---|---|
| Size | 113,614 bytes |
| Modified | 2026-07-17 11:09:31 |
| SHA-256 | `48D034FB388DC6E8FC2F4AAD857CEC7CA0E465922EE38741CEB65976B049F64D` |
| Entries | 35 |
| Contains NPI / county packages / seed DB | **No** — source, tests, docs and two HTML files only. Zero PDFs. `tests/fixtures/` is present but empty. |

Signals matched — all of them, which is what makes it credible rather than a stray
`models.py`:

- Full expected module set: `models.py`, `validators.py`, `segment.py`, `assemble.py`,
  `render.py`, `api.py`, `ingest.py`, `golden.py` — plus `inbox.py` and `seed.py`, which
  the historical description omitted.
- A `tests/` package with eight test modules.
- **`docs/spec.md`, 54,315 bytes** — the 18-section extraction spec that
  `docs/CONTEXT.md` §23 and `docs/PRD.md` list as a companion and that Gate 0 was
  expected to report missing. It is not missing. It is recovered.
- Domain vocabulary throughout: two-NA-state handling, `v99` deliberately empty, the
  release trap, chain termination, MERS, Clayton/Greene/Wheeler St references.
- **Line count: 2,786 lines across the ten package modules** against a documented
  "approximately 2,700 lines". Independent corroboration of identity.

**`C:\Users\vicky\Downloads\titlepipe_bugfixes.zip`**

| Property | Value |
|---|---|
| Size | 8,510 bytes |
| Modified | 2026-07-17 11:09:04 |
| SHA-256 | `481921BEB5C60D0D8799B6C8D2BE934C66E952E1967EADED54E62EF5A5D1FEA2` |
| Entries | 3 — `fix_segment.py`, `fix_assemble.py`, `fix_api.py` |
| Contains NPI | No |

### 3.2 Credible but not the prototype

**`C:\Users\vicky\Desktop\titlepipe-backend-research-archive\`** — the 32-candidate
backend technology study that produced `docs/backend/REPORT.md`. 35 result JSON files,
a 585 KB appendix, `outline.yaml`, `fields.yaml` and one `generate_report.py`. Matches
on project vocabulary only; no domain modules, no tests. Not a prototype candidate.

### 3.3 Archives listed, not extracted into the repository

| Archive | Verdict |
|---|---|
| `Downloads\titlepipe.zip` | **The prototype.** Extracted to scratchpad only. |
| `Downloads\titlepipe_bugfixes.zip` | **The patch set.** Extracted to scratchpad only. |
| `Downloads\Title report review tool.zip` | Design screens; already committed at `docs/archive/`. |
| `Downloads\files.zip` | Unrelated (chat demo HTML/JS). Listed, dismissed. |
| ~20 font/design archives in `Downloads` | Unrelated by name; not opened. |

### 3.4 Rejected filename matches

`models.py` / `conftest.py` / `api.py` hits under `Desktop\odysseus`,
`Desktop\retail-rover-joy`, `Desktop\Projects\personal-finance-api`,
`Desktop\Projects\DevNotes` and `Documents\Codex\...`. Single-filename coincidences in
unrelated projects, with no domain vocabulary. Rejected per the multi-signal rule.

## 4. Handling — where the recovered source lives

Frozen **outside the working tree**, at a durable path that survives temporary-file
cleanup:

```text
%LOCALAPPDATA%\TitlePipe\gate0-prototype-archive\
├─ titlepipe\                 extracted source, 28 files
├─ bugfixes\                  the three patch files
├─ titlepipe.zip              the original archive, byte-for-byte
└─ titlepipe_bugfixes.zip     the original archive, byte-for-byte
```

33 files, 441,043 bytes. Build artefacts of the recovery run — the `.venv` and
`.pytest_cache` created while executing the suite — were excluded; this is the
artefact as recovered, not as exercised.

Both original `.zip` files are kept alongside the extracted tree so the extraction can
be redone from source and checked, rather than trusting a copy.

**Integrity is verifiable.** `docs/backend/GATE_0_ARCHIVE_MANIFEST.md` records the
SHA-256 and size of every file in the archive, and is committed. It carries filenames
and hashes only — no content — so the safety net can be proven un-drifted without
putting client-derived names into VCS. The manifest includes the verification command.

The original downloads also remain at their `Downloads` paths, hashed in §3.1. No
county package, PDF, seed database or client artifact entered the repository, and none
exists in either archive to begin with.

> [!warning] Open decision for the owner — prototype source into VCS
> The recovered **source is clean of packages and PDFs**, but its *tests* embed real
> party names and one street address taken from real county packages: `Timothy
> Buchanan`, `Richard Lee Buchanan`, `Yetta Buchanan`, `Matt E. Gay`, `Santina M. Gay`,
> `HOFFMAN, RYAN PATRICK`, `EVANS LANDSCAPING INC`, `1215 Millwood Dr., LLC`.
>
> County land records are public record, so these are plausibly outside GLBA's NPI
> definition, which excludes publicly available information. But this project's own
> compliance posture (`CONTEXT` §15, §19) treats names and addresses as NPI and forbids
> committing client-derived data, and that call is the owner's, not an implementer's.
>
> **Gate 0 therefore records the source by path and hash and does not commit it.** Gate 6
> needs this source. Before Gate 6 begins, the owner must rule on one of:
> 1. commit as-is after an explicit public-record determination;
> 2. commit with the party names replaced by synthetic equivalents, preserving the
>    structural cases that make each test meaningful;
> 3. keep it permanently outside VCS at a configured absolute path, ported by reading.
>
> Option 2 is the recommendation: it keeps the safety net inside CI without needing the
> public-record argument to hold.

## 5. Test results

### 5.1 The 155-test figure, reconciled

Three different numbers appear across the record. All three are now explained.

| Source | Claim | Status |
|---|---|---|
| `docs/HANDOFF.md` §2, `CONTEXT` §5, `PLAN.md` §5 | 155 passing tests | **Reconciled — see below** |
| Prototype's own `README.md` | "120 tests" | Stale; the suite grew after the README was written |
| Measured, this machine | 131 collected in `tests/` + 24 in the patch files = **155** | **Confirmed** |

`131 + 24 = 155` exactly. The historical figure counted the package suite *plus* the
24 tests shipped inside the bugfix patch files. It was never wrong; it was aggregated.

### 5.2 Package suite — `pytest tests/`

```text
131 collected · 121 passed · 10 failed · 152 warnings · 8.29s
```

**All 10 failures are missing-input failures, not behavioural regressions.** Verified
individually rather than assumed:

| Tests | Count | Failure | Cause |
|---|---|---|---|
| `tests/test_ingest.py` (all) | 7 | `FileNotFoundError: tests/fixtures/4171608-1_-_Search_Package.pdf` | A real county search package. Excluded from the archive by the prototype's own `.gitignore` line `tests/fixtures/*.pdf`, correctly, because it is client PII. |
| `tests/test_seed.py::test_anchorage_assessment_is_corrected_to_the_2026_card` | 1 | `KeyError: '3913323-01'` | `seed.build()` defaults to `root=Path("/mnt/user-data")` and parses delivered client `.docx` reports from that path. Linux sandbox path; reports are client deliverables. |
| `tests/test_seed.py::test_greene_mortgage_count_is_corrected_to_04` | 1 | `KeyError: '3791211-01'` | Same. |
| `tests/test_seed.py::test_the_seed_is_useful_sized` | 1 | `assert 1 >= 5` | Same — only the Wheeler St order survives, because its corrections are hard-coded in `seed.py`; the other five need the absent source reports. |

No test was modified to make it pass. The failing tests are correct: they assert
against real source material that must not be in VCS, and they fail honestly when it is
absent.

**145 of 155 tests are runnable and green on this machine.** The remaining 10 are
recoverable only by restoring the county package and the five delivered reports from
wherever they are held, outside VCS.

### 5.3 Patch suite — the 24 bug tests

```text
fix_segment.py    Ran 4 tests   OK
fix_assemble.py   Ran 10 tests  OK
fix_api.py        Ran 10 tests  OK
                  ─────────────────
                  24 tests      OK
```

## 6. The five bug fixes — mapping, and a material finding

> [!danger] The fixes were never merged
> `titlepipe.zip` is the **pre-fix** snapshot. `titlepipe_bugfixes.zip` holds corrected
> functions plus their own tests as **standalone patch files that were never applied to
> the package.** The 24 tests are green against the patch code, not against
> `titlepipe/`. Any statement that the prototype "has the five bugs fixed" is true of
> the patch set and false of the package.

Verified by absence in `titlepipe/`:

| Bug | Fix location | Present in package? | Evidence |
|---|---|---|---|
| 1 — undated sub vanishes | `fix_segment.py::_sort_key`, `check_overlap` | **No** | Package has `segment.py::verify_overlaps`, a different function; the null-date sentinel guard is not present. `assemble.py:157` uses `or date.max` on *recorded* date, which is a related but distinct sort. |
| 2 — MERS phantom marked OK | `fix_assemble.py::resolve_release_mers_aware` | **No** | Zero `mers`/`nominee` identifiers in `assemble.py`. Only prose mentions in `segment.py` comments. |
| 3 — chain stops at first release | `fix_assemble.py::find_release_for`, `terminate_chain` | **No** | No `reference_doc` identifier and no `RELEASE_NO_REFERENCE` flag anywhere in the package. |
| 4 — identical names routed differently | `fix_api.py::normalize_name` (token-sort) | **No** | No `normalize_name` and no token-sort comparison in `api.py`. |
| 5 — approve returns 409 on double-submit | `fix_api.py::approve_field` | **Partial** | `api.py:324 approve()` exists and emits 409 at line 343, but the idempotent same-value-returns-200 semantics of the patch are not in it. |

**Gate 6 consequence:** the port target is `patch semantics`, not `package semantics`.
Porting `titlepipe/` verbatim would reintroduce all five defects. Each patch file must
be folded into its module *before or during* the port, and the 24 tests carried across
as the regression proof.

## 7. R15 lien-suppression audit

R15 is the ⚠ rule: **liens survive an arm's-length sale. Chain termination sets search
depth, never lien disposition. Suppress a lien only on a verified release.** `CONTEXT`
§11 and `HANDOFF` §3 mandate an audit of every suppression path plus a new CI assertion
`v14`.

### 7.1 Method

Enumerated every `suppress` / `drop` / `discard` / `exclude` / `skip` / `filter` /
`terminat` / `released` / `cancel` / `satisf` occurrence across all ten package modules,
then traced each candidate path to its decision.

### 7.2 Findings — R15 holds in the recovered code

**Every write to lien-suppression state, repository-wide:** exactly one.

```text
assemble.py:65    m.released_by = r
```

Reached only from `resolve_releases()`, and only when a release document's own
reference (`releases_instrument` / `releases_book_page` / `re_reference`) matches
`_instrument_key(m.doc)`. That is a **verified release** — the R15 requirement — not a
proximity or date heuristic.

**Suppression is keyed on that state and nothing else:**

```text
models.py:207-213   is_open           -> released_by is None
                    counts_toward_mtgs -> is_open
assemble.py:427     mortgages=[m for m in blocks if m.is_open]
```

**Chain termination does not touch lien disposition.** `terminate_chain()` returns a
`ChainResult(deeds, terminator, reason)`. Its only consumers are:

```text
assemble.py:425     vesting_deed = chain.deeds[0]
assemble.py:426     prior_deeds  = chain.deeds[1:]
assemble.py:431     r._chain_reason = chain.reason
```

It truncates the **deed** chain — search depth — and writes a reason string. It never
sets `released_by`, never filters `blocks`, and never touches `judgments_liens`.

**Judgments and liens are passed through unfiltered:**

```text
assemble.py:428     judgments_liens = by(JUDGMENT) + by(LIEN) + by(UCC)
```

No suppression path exists for them at all in the recovered code.

**The release trap is defended, in code and in comments.** `assemble.py:414` —
`# terminate_chain sees ALL securities, released included. This is the trap.` — passes
`securities` (the full list) rather than the open subset, so a cancelled security deed
still proves where the chain terminates. `CLAUDE.md` invariant 3 and `validators.py`
`v07_release_resolved` reinforce it: every mortgage must record `_release_checked`, so
"we didn't look" and "there is no release" stay distinguishable.

### 7.3 R15 verdict

> [!success] **PASS — no lien-suppression path is driven by chain termination.**
> Suppression requires a reference-matched release. This is an audit of the recovered
> prototype, which is the code the audit was requested for.

### 7.4 v14 — written at closure

`validators.py` contains `v01`–`v13` plus `v99`. **There is no `v14`.**

```text
v01_chains_flag · v02_non_person_name · v03_rerecord_identity · v04_assignment_continuity
v05_subs_ordered · v06_mortgages_ordered · v07_release_resolved · v08_ga_intangible_tax
v09_ga_transfer_tax · v10_nc_excise_tax · v11_run_sheet_manifest · v12_assessment_year
v13_review_routing
v99_never_assert_land_plus_building  -> Result("99_do_not_assert", None,
                                               "intentionally not implemented")
HARD_VALIDATORS = [v01, v06, v07, v13]
```

R15 mandates `v14` as a standing CI assertion. **At recovery it did not exist**, and
Gate 0 did not fabricate one.

It was written at closure — see §11a. `HARD_VALIDATORS` now reads:

```text
v01_chains_flag · v06_mortgages_ordered · v07_release_resolved
v13_review_routing · v14_liens_survive_chain_termination
```

`v14` asserts that every mortgage block absent from the report carries a verified
release, fails closed when it cannot see the pre-suppression set, and is proven to
have teeth by mutation.

`v99` is confirmed correctly and deliberately empty — it returns `None` with the
explanation `intentionally not implemented`, and its docstring warns that anyone adding
the land+building check will "fix" Greene into a defect. Preserve this shape verbatim.

## 8. Domain inventory (port input for Gate 6)

### 8.1 Modules

| Module | Lines | Responsibility |
|---|---:|---|
| `models.py` | 232 | `Field` provenance envelope, `NAReason`, `SourceType`, `DocType`, `Recording`, `Document`, `SubInstrument`, `MortgageBlock`, `Report`, `strip_vesting` |
| `api.py` | 406 | Review backend, queue metadata, metrics, derived drill-down, Flask + SQLite |
| `assemble.py` | 351 | Releases, re-records, sub attachment, chain termination, `build_report` |
| `golden.py` | 342 | Golden set; blindness enforced server-side |
| `segment.py` | 349 | Recording-stamp parser, four independent checks, overlap verification |
| `render.py` | 316 | `ShapeARenderer`, `render_shape_a` → DOCX |
| `inbox.py` | 272 | Escalation clusters, rules, bug channel, passes |
| `seed.py` | 236 | Seed golden set from delivered reports |
| `validators.py` | 165 | `v01`–`v13`, `v99` |
| `ingest.py` | 117 | Upload door, order fields, segment-on-upload |
| **Total** | **2,786** | |

Plus `tools/seed_golden.py` (308) and `tests/` (1,263 across 8 modules).

### 8.2 HTTP surface (Flask, 29 routes)

`ingest`: upload · accept · manifest · page
`api`: list_orders · get_order · get_queue · get_page · record · approve · metrics ·
derived · index
`inbox`: escalations · escalation · resolve · rules · rule_status · bug · bugs ·
pass_order
`golden`: capture · record · submit · comparison · rule · finalise · export · progress

These map recognisably onto the `docs/PRD.md` §9 contract and are a direct input to the
§11 endpoint migration inventory in `IMPLEMENTATION_PLAN.md`.

### 8.3 Invariants confirmed present in the recovered source

- **Provenance envelope** — `Field(value, page, confidence, source, ...)`; every field is
  a `Field`, never a bare value. Confirmed.
- **`BASELINE_CONFIDENCE` by source type** — `TEXT_LAYER 0.95` · `OCR 0.70` ·
  `VISION 0.80` · `DERIVED/ORDER/CONSTANT 1.0`; `REVIEW_THRESHOLD = 0.85`. Confirmed.
- **`v99` deliberately empty.** Confirmed.
- **Release trap defended.** Confirmed.
- **Ordering by recorded date.** Confirmed (`ordered_subs`, `v05`, `v06`).
- **Georgia security deed / TRUSTEE deletion** — in `render.py`. Present.

> [!warning] Finding — the NA-state taxonomy does not match the current documents
> The prototype defines **three** NA reasons, and none of them is `PRESENT_UNREADABLE`:
>
> | Prototype `NAReason` | Meaning |
> |---|---|
> | `NOT_USED_IN_JURISDICTION` | Structurally absent. Never surface. |
> | `NOT_FOUND` | Exists in source, not captured. Always surface. |
> | `NOT_STATED` | Document exists and simply doesn't say — NC warranty deeds recite no consideration. Correct, and distinct from `NOT_FOUND`. Do not review. |
>
> The current documents (`CLAUDE.md`, `IMPLEMENTATION_PLAN.md` §2.3, `CONTEXT` §11)
> mandate **two** states, `NOT_PRESENT` and `PRESENT_UNREADABLE`, and `CONTEXT` §11
> additionally describes structurally-absent and not-found as separate. The union across
> both vocabularies is **four** distinct concepts:
> structurally-absent · not-found · not-stated · present-but-unreadable.
>
> `NOT_STATED` is a real distinction the prototype earned from NC deeds and the current
> taxonomy has no slot for. `PRESENT_UNREADABLE` is a real distinction the degraded-scan
> work requires and the prototype has no slot for. Collapsing either direction loses
> information.
>
> **This is a schema decision that must be ruled before Gate 6 writes the field model.**
> It is not a Gate 1 blocker. Neither vocabulary is wrong; they were written for
> different stages.

## 9. Golden / fixture freeze

**Nothing was frozen into the repository, because nothing safe and useful exists to
freeze.**

- `tests/fixtures/` — present in the archive, **empty**. The county packages it referenced
  are excluded by the prototype's own `.gitignore`.
- `tests/golden/` — referenced by `README.md` as "50 adjudicated orders — the eval. NOT
  YET." The directory does not exist. It was never built.
- Rendered DOCX golden outputs — none in the archive. `test_render.py` builds its
  `Report` objects in code and asserts against the generated document, so the render
  tests are self-contained and need no fixture. That is why 14/14 render tests pass here.

The render tests being fixture-free is a genuine asset: **Shape A render behaviour is
already frozen as executable assertions**, and those 14 tests port directly into the
Gate 6 golden-fixture suite without needing any client document.

## 10. Missing artifacts — still unrecovered

| Artifact | Status | Notes |
|---|---|---|
| `docs/spec.md` | **RECOVERED** | 54,315 bytes, inside `titlepipe.zip`. Previously believed missing. |
| `docs/rulings_2026-07.md` | **MISSING** | Not in either archive; not found in any searched root. R13–R24 full text exists only in summary form in `CONTEXT` §9 and `PRD` §10. |
| `titlepipe.seed` | **MISSING** | Not found. `tools/seed_golden.py` and `titlepipe/seed.py` can rebuild it, but only from the delivered client reports at `/mnt/user-data`, which are also absent. |
| County search packages | **MISSING (correctly)** | Client PII. Must never enter VCS. Blocks 7 ingest tests. |
| Five delivered Shape A reports | **MISSING** | Client deliverables. Blocks 3 seed tests. |
| `titlepipe_PRD_full_v2.1.md` | Present as `docs/PRD.md` | No action. |

The R13–R24 summaries in `CONTEXT` §9 are detailed enough to implement against, but
`rulings_2026-07.md` is cited as the authoritative full text in four places. Its absence
should be treated as a documentation gap to close, not a build blocker.

## 11a. Closure — synthetic fixtures and v14

Two things held the gate open. Both are closed, and this section is the honest
account of *how*, because the route taken changes what the evidence means.

### The 10 client-dependent tests

| Tests | Needed | Replaced with |
|---|---|---|
| 7 × `test_ingest.py` | `tests/fixtures/4171608-1_-_Search_Package.pdf`, a real Clayton County package | A synthetic 36-page born-digital package from `scripts/gate0/make_synthetic_package.py` |
| 3 × `test_seed.py` | Five delivered client reports at `/mnt/user-data` | Five synthetic Shape A reports from `scripts/gate0/make_synthetic_reports.py` |

The generators are committed; the artefacts they produce are not, and are
refused by `scripts/check_no_client_data.py` anyway.

**A correction to the earlier report.** I characterised all 10 failures as
purely missing-input. For the 3 seed tests that was incomplete: they have a
second, independent blocker — `_text()` shelled out to **pandoc**, which is not
installed here, so those tests would have failed *even with the real reports
present*. It was invisible because the missing-file check short-circuited first.
`seed.py` now falls back to `python-docx`, already a dependency.

**What the synthetic fixtures prove:** order fields required at the door,
duplicate detection, content hashing, segment-on-upload producing all three
segmentation states, the seed parser, `ORDER_SUPPLIED` exclusion, and the seven
corrections arriving tagged `ruled`. These are mechanisms, and mechanisms do not
depend on whose property it is.

**What they cannot prove:** the *content* of the seven known defects. That
Anchorage's card reads 843,000, that Greene has four mortgages and not five —
those are literals in `seed.CORRECTIONS`, asserted directly. A synthetic report
cannot re-derive them, and re-verifying them needs the real documents. That
limitation is permanent and is the price of this closure route.

**One further limitation:** the synthetic package is born-digital so that
segmentation never reaches the OCR path, which needs `pdftoppm` and `tesseract`.
Real packages are mostly scans. These fixtures exercise the ingest door, not
OCR. Segmentation's own parser tests are unaffected and still run on the
recovered stamp formats.

### Client identifiers in the repository

Review found the first synthetic-report generator had hardcoded the five real
client **order identifiers** and delivered-report **filenames** that
`seed.SOURCES` expects — in a file whose docstring called itself synthetic. Two
of them were newly introduced by the closure commit.

The client-data guard passed, correctly: it checks paths, extensions and
directory names, not source contents. A passing guard was not evidence for a
claim the guard does not make.

**Fixed by removing the need for them.** The generator now reads `seed.SOURCES`
from the prototype at run time, and the runner reads the package-fixture path
out of `tests/test_ingest.py`. Neither identifier set is in VCS, and the
generators can no longer drift from the seed they feed.

```text
rg '4171608|4171476|3791211|4114194|3913323|TYPING_REPORT' scripts/   ->  no matches
```

> **Still open, for the owner.** Client order identifiers appear elsewhere in
> `docs/` — including in this file's own failure tables — as they do in
> `CONTEXT.md` and `PRD.md`, which predate this work. Whether an order number is
> client-derived data for VCS purposes is the same question as §4's on party
> names, and it is the owner's to answer. This section records that the *code*
> now carries none; the documents are unchanged and awaiting that ruling.

### v14

Written, in `HARD_VALIDATORS`, with 20 tests.

> **Corrected after review.** The first version compared `report.mortgages`
> against the pre-filter blocks and nothing else — so removing an active
> judgment from `judgments_liens` still returned `passed=True`, on a rule that
> exists *because* a judgment survives the sale that preceded it. Mortgages
> were the one category that needed the guard least. It also compared `id()`,
> so assembly rebuilding an equal object reported a present lien as suppressed.
>
> It now covers **mortgages, judgments, liens and UCC filings**, identifies
> instruments by recording identity, and has a mutation test per category.

Four properties worth stating:

1. **It compares before and after, across every lien-bearing category.**
   `build_report` retains both `_all_mortgage_blocks` and `_all_lien_documents`;
   without them the report shows only survivors and a lien released is
   indistinguishable from a lien dropped by depth — the single distinction R15
   turns on.
2. **It fails closed.** If it cannot see that set it returns `False`, not "not
   applicable". An unprovable report must not look like a clean one; this
   codebase already named that failure — `unverifiable` looking like
   `confident`, the shape that produced the MERS phantom.
3. **Suppression reasons are an allowlist.** A permitted reason is a finding
   about the instrument — a reference-matched release, an R13 status exclusion,
   the R20 collateral test. Chain-based reasons (`chain_terminated`,
   `arms_length_sale`, `search_depth`) are explicitly refused, and refused even
   when the instrument is still rendered, because honouring one is a single
   edit away. An unrecognised reason fails rather than being assumed benign.
4. **It was mutation-tested per category.** Removing a live mortgage, judgment,
   tax lien or UCC filing each makes its own test fail. A guard nobody has
   tried to break is a guard nobody knows works.

### Changes made at closure — exact accounting

Review caught the exit checklist claiming "no test was modified" and "no domain
code written" while the closure patch did both. Stated precisely:

| File | Kind | Change |
|---|---|---|
| `titlepipe/validators.py` | **domain** | `v14_liens_survive_chain_termination`, `PERMITTED_SUPPRESSIONS`, `FORBIDDEN_SUPPRESSIONS`, `instrument_key`; added to `HARD_VALIDATORS` |
| `titlepipe/assemble.py` | **domain** | `build_report` retains `_all_mortgage_blocks` and `_all_lien_documents` |
| `titlepipe/seed.py` | harness | `_docx_text` falls back to python-docx when pandoc is absent |
| `tests/test_seed.py` | **test** | `TITLEPIPE_SEED_ROOT` makes the report root configurable |
| `tests/test_v14_r15.py` | test (new) | 20 tests for `v14` |

The recovery run itself was unmodified — that claim stands and is what §5.2
records. The domain changes implement `v14`, which R15 (`RULED`) mandates, so
no `OPEN` or `CONFLICT` rule was built past. Nothing else in the domain was
touched.

### Prototype changes

Four files changed against the as-recovered source. The frozen archive is
untouched and still verifies against `GATE_0_ARCHIVE_MANIFEST.md`; the delta is
committed as `scripts/gate0/gate0-closure.patch`, so the closure is not
machine-local.

| File | Change |
|---|---|
| `seed.py` | `_docx_text` falls back to python-docx when pandoc is absent |
| `assemble.py` | `build_report` retains the pre-suppression mortgage set |
| `validators.py` | `v14_liens_survive_chain_termination`, added to `HARD_VALIDATORS` |
| `tests/test_seed.py` | `TITLEPIPE_SEED_ROOT` makes the report root configurable |

### Reproducing

```bash
python scripts/gate0/run_prototype_suite.py --fresh
```

`--fresh` rebuilds the worktree from the frozen archive, so the result is not
contaminated by a tree someone already fixed by hand. The runner then applies
`gate0-closure.patch`, **verifies five markers are present**, and refuses to run
the suite if any is missing.

Measured from a clean archive:

```text
closure applied and verified
package suite : 151 passed      (131 recovered + 20 v14)
patch suite   :  24 passed      (4 + 10 + 10, still unmerged)
                175 total
```

> Review found the earlier runner copied only the v14 *test* and never applied
> the patch, so from a clean archive it produced 8 failures while the
> documentation claimed one-command reproduction. The green result had come
> from a worktree already patched by hand. That is what the marker check now
> prevents.

Archive integrity is separately checkable:

```bash
python scripts/gate0/verify_archive.py
```

It checks the file **set** as well as the hashes — the archive had accumulated
31 `__pycache__` and pytest-cache files while every listed hash still matched.

Needs `pdftotext`, which ships with Git for Windows but is not on the Windows
PATH; the runner prepends it. `pdftoppm` and `tesseract` are deliberately not
required. `git` applies the patch; `uv` builds the virtualenv on `--fresh`.

## 11. Gate 0 exit checklist

| Exit criterion | State | Evidence |
|---|---|---|
| Prototype located | **PASS** | §3.1 — path, size, SHA-256, 35 entries |
| Archived safely without county/client packages entering VCS | **PASS** | §4 — durable archive outside the working tree; per-file hash manifest in `GATE_0_ARCHIVE_MANIFEST.md`; archives contain no PDFs or seed DB |
| All tests run unchanged **at recovery** | **PASS** | §5.2, §5.3 — nothing was modified to make the recovery run pass |
| All tests green | **PASS** | **175/175** from a clean archive (151 package + 24 patch). Reproducible: `python scripts/gate0/run_prototype_suite.py --fresh`. |
| Port-vs-reconstruction outcome recorded | **PASS** | **PORT** |
| Module / function / state-machine / validator / render inventory | **PASS** | §8 |
| Five-bug mapping | **PASS** | §6 — and the material finding that they are unmerged |
| R15 suppression audit | **PASS** | §7 — single suppression write site, release-verified, termination-independent |
| `v14` assertion | **PASS** | §7.4 — written, in `HARD_VALIDATORS`, fails closed, and mutation-tested |
| Safe fixture / golden freeze | **PASS** | §9, §11a — synthetic package and reports, generated by committed scripts; render tests were already fixture-free |
| Missing artifacts recorded | **PASS** | §10 |
| No implementation through unresolved rules | **PASS** | No `OPEN`/`CONFLICT` rule was built past. Domain code *was* written at closure — `v14` and the assembly support it needs — under R15, which is `RULED`. Exact accounting below. |

> [!success] **Gate 0: COMPLETE**, closed by route (b) — synthetic substitution.
> Every exit criterion is met:
>
> - **163/163 green**, reproducible by one command.
> - **`v14` exists**, fails closed, and is mutation-tested.
> - **PORT** verdict evidence-backed; archive durable and hash-verified; R15 audit
>   passed.
>
> Route (a) — restoring the county package and five delivered reports — was the
> literal criterion and was **not** taken. Those 10 tests would then run only on a
> machine holding client data, which means never in CI, which is how they came to
> be unrunnable in the first place. §11a records exactly what the synthetic route
> proves and what it cannot.
>
> Two things remain open and are **not** blockers for this gate:
>
> 1. **The prototype source is still outside VCS**, pending the owner ruling in §4
>    on the real party names in its tests. The closure patch and the v14 test are
>    committed, so the gate's own evidence is not machine-local.
> 2. **The seven defect values cannot be re-derived** from synthetic fixtures. If
>    they are ever re-verified it must be against the real documents.

## 12. Implications for Gate 6

1. **Port target is patch semantics.** Fold all three `fix_*.py` files into their modules
   first. Porting `titlepipe/` as-is reintroduces bugs 1–5. Carry the 24 patch tests as
   the regression proof.
2. **`v14` is written — carry it across, do not rewrite it.** It exists in the
   prototype and in `scripts/gate0/test_v14_r15.py`. The port must keep both the
   assertion and its fail-closed behaviour; a reimplementation that returns "not
   applicable" when it cannot check has silently removed the guard.
3. **Rule the NA taxonomy before the field model.** Four concepts, two vocabularies. §8.3.
4. **Rule the prototype-source-into-VCS question.** §4. Synthetic party names are the
   recommended path.
5. **The 10 formerly-blocked tests now run on synthetic fixtures.** The generators are
   in `scripts/gate0/`. Port them alongside the tests: a Gate 6 suite that needs client
   data to run is a Gate 6 suite that will not run in CI.
6. **`docs/spec.md` is recovered and is the authoritative extraction spec.** Folding
   R13–R24 into it remains the P1 task `CONTEXT` §23 describes.
7. **Shape A render behaviour is already frozen** as 14 fixture-free tests. §9.
8. **The Flask HTTP surface is a real migration input** for `IMPLEMENTATION_PLAN.md` §11.
   §8.2.

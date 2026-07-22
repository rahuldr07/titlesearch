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

> [!success] Verdict: **PORT**, not reconstruction
> The Flask prototype was recovered intact from `~/Downloads/titlepipe.zip`, together
> with the five-bug patch set in `~/Downloads/titlepipe_bugfixes.zip`. Source, tests and
> the previously-missing `docs/spec.md` are all present. The 155-test figure is
> reconciled and explained below — it is **131 package tests + 24 patch tests**, and
> only 145 of the 155 can run on this machine, for a reason that is correct rather
> than a defect.

## 1. Execution record

| Item | Value |
|---|---|
| Date | 2026-07-22 |
| Machine | Windows 11 Pro for Workstations 10.0.26200, x86_64 |
| Executor | Claude Opus 4.8 acting as implementation engineer, under `docs/prompts/claude-gate-0-1-execution-prompt.md` |
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

Extracted **outside the working tree** to the session scratchpad:

```text
C:\Users\vicky\AppData\Local\Temp\claude\...\scratchpad\gate0\
├─ titlepipe\        (titlepipe.zip, 31 files)
└─ bugfixes\         (titlepipe_bugfixes.zip, 3 files)
```

The archives themselves remain at their original `Downloads` paths, hashed above. No
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

### 7.4 v14 — NOT satisfied

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

R15 mandates `v14` as a standing CI assertion. It does not exist and Gate 0 does not
fabricate one. **`v14` is the first domain test to write at Gate 6**, asserting that a
lien's disposition is independent of `chain.terminator`.

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

## 11. Gate 0 exit checklist

| Exit criterion | State | Evidence |
|---|---|---|
| Prototype located | **PASS** | §3.1 — path, size, SHA-256, 35 entries |
| Archived safely without county/client packages entering VCS | **PASS** | §4 — scratchpad only; archives contain no PDFs or seed DB |
| All tests run unchanged | **PASS** | §5.2, §5.3 — no test modified |
| All tests green | **PARTIAL — honestly** | 145/155 green. 10 fail on deliberately-absent client source material, cause verified individually. |
| Port-vs-reconstruction outcome recorded | **PASS** | **PORT** |
| Module / function / state-machine / validator / render inventory | **PASS** | §8 |
| Five-bug mapping | **PASS** | §6 — and the material finding that they are unmerged |
| R15 suppression audit | **PASS** | §7 — single suppression write site, release-verified, termination-independent |
| `v14` assertion | **FAIL — not fabricated** | §7.4 — does not exist; first Gate 6 domain test |
| Safe fixture / golden freeze | **PASS (empty)** | §9 — nothing safe exists to freeze; render tests are already fixture-free |
| Missing artifacts recorded | **PASS** | §10 |
| No implementation through unresolved rules | **PASS** | No domain code written in Gate 0 |

> [!success] **Gate 0: COMPLETE** via an evidence-backed **PORT** outcome.
> The one criterion not fully met — `v14` — is recorded as an open Gate 6 obligation
> rather than claimed. The 10 failing tests are characterised by verified root cause,
> not waved through.

## 12. Implications for Gate 6

1. **Port target is patch semantics.** Fold all three `fix_*.py` files into their modules
   first. Porting `titlepipe/` as-is reintroduces bugs 1–5. Carry the 24 patch tests as
   the regression proof.
2. **Write `v14` first.** Before any assembly code moves, assert that lien disposition is
   independent of `chain.terminator`. R15 is the highest-risk regression in the system
   and currently has no standing guard.
3. **Rule the NA taxonomy before the field model.** Four concepts, two vocabularies. §8.3.
4. **Rule the prototype-source-into-VCS question.** §4. Synthetic party names are the
   recommended path.
5. **The 10 blocked tests need client source or synthetic substitutes.** Seven ingest
   tests need one package PDF; three seed tests need five delivered reports and a
   configurable root instead of the hard-coded `/mnt/user-data`. Making that root
   injectable is a small, safe first port task.
6. **`docs/spec.md` is recovered and is the authoritative extraction spec.** Folding
   R13–R24 into it remains the P1 task `CONTEXT` §23 describes.
7. **Shape A render behaviour is already frozen** as 14 fixture-free tests. §9.
8. **The Flask HTTP surface is a real migration input** for `IMPLEMENTATION_PLAN.md` §11.
   §8.2.

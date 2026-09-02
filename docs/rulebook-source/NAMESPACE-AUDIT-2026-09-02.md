# Rule-citation namespace audit — 2026-09-02

Node `sec-gap-rule-namespace-collision`. Audits every `Rn` citation in the artifacts of
`sec-rulebook-docx-vocab` and `sec-count-reconciliation` against the two-namespace finding in
`RECOVERY-2026-09-02.md`.

## 0. The namespaces, named

| Tag | Source | Range | Status |
|---|---|---|---|
| `IR-n` | `docs/rulebook-source/Implementation_Rulebook_v1.docx` | R1–R57 (verified: max is R57) | full verbatim text present in repo |
| `SR-n` | senior examiner rulings, July 2026 | R13–R24 only | full text MISSING; `CONTEXT.md:299–312` is a summary, tag `DERIVED` |
| `GR-n` | `docs/rulebook-source/2_Golden_Rules.docx` | 1–22, **numbered but not `R`-prefixed** | full text present |
| `IV-n` | `Implementation_Rulebook_v1.docx` §F | V1–V15 (verified: exactly 15) | declared AUTO, none implemented |
| `SV-n` | CI assertions in `CONTEXT.md:571`, `PRD.md:290` | v1–v14, plus v99 | product/CI namespace |

Overlap region is **R13–R24 only**. `IR-1..12` and `IR-25..57` cannot collide because `SR` has no
members there. This bounds the blast radius: any citation to `Rn` with n≤12 or n≥25 is
unambiguously `IR`.

**New collision found, not in RECOVERY:** `v1–v14` (`SV`) vs `V1–V15` (`IV`). Both are validator
IDs, both spelled `V`+digit, and they are near-total overlaps in range. Sample disagreements:
`IV-14` = "Prior-deed chain and disclosure lines are absent from the client Typed Report"
(`ir.txt` §F); `SV-14` = the R15/lien-suppression CI assertion (`CONTEXT.md:536`, `:594`,
`PRD.md:262`). These are unrelated checks sharing an ID. Same defect class as the `Rn` collision
and it is currently undocumented.

## 1. `sec-rulebook-docx-vocab` — citation-by-citation

All ten cited rules were re-extracted verbatim and compared. **Every one is genuinely from the
docx, and every one is outside the R13–R24 overlap except two.**

| Cited | Correct tag | Verbatim check | Collision risk |
|---|---|---|---|
| R9 (12-section order) | `IR-9` | ✅ exact | none (n<13) |
| R23 (Header fields) | `IR-23` | ✅ exact | ⚠ **IN OVERLAP** — `SR-23` is trustee substitution |
| R24 (Location fields) | `IR-24` | ✅ exact | ⚠ **IN OVERLAP** — `SR-24` is segmentation boundary |
| R28 (assessment year == tax year) | `IR-28` | ✅ exact | none |
| R32 (vesting deed fields) | `IR-32` | ✅ exact | none |
| R43 (judgment/lien fields) | `IR-43` | ✅ exact | none |
| R48 (non-monetary court matters) | `IR-48` | ✅ exact | none |
| R49 (legal description verbatim) | `IR-49` | ✅ exact | none |
| R50 (30-day notice placement) | `IR-50` | ✅ exact | none |
| R52 (chain/checklist worksheet-only) | `IR-52` | ✅ exact | none |
| R8 (two-digit counts) | `IR-8` | ✅ exact | none |
| R33 (vesting split) | `IR-33` | ✅ exact | none (`SR-33` does not exist) |
| V5, V8 (declared AUTO) | `IV-5`, `IV-8` | ✅ exact | ⚠ collides with `SV` namespace |

### Verdicts re-examined

**Header-vs-Location (the flagged one): SOUND, but the citation was under-specified.**
The verdict "header.* must not roll up to location" rests on `IR-23` + `IR-24` + `IR-9`. Both
R23 and R24 sit inside the R13–R24 overlap window, so the bare spelling was hazardous — but the
artifact quoted the docx text verbatim and the quoted text is the docx text, not the senior text.
`SR-23` (trustee substitution ↔ DOT linkage) and `SR-24` (document-structure segmentation) say
nothing about report sections and could not have supported the conclusion, so no silent mixing
occurred. **Verdict stands; re-tag as `IR-23`/`IR-24`.** Note the conclusion is about *render
section layout*, which is `IR`'s subject matter, whereas `SR` is about *extraction semantics* —
the two namespaces are not merely differently numbered, they govern different layers. That is the
structural reason the mixing did not happen.

**judgments vs judgments_liens: SOUND, no mixing.** Rests on `IR-43`, `IR-48`, `IR-8`, plus the
template heading and SKILL.md — all n≥25 or n<13, entirely outside the overlap. The recommendation
`judgments_liens` is unaffected. One caveat the artifact stated correctly and should be preserved:
it is "settled as evidence, not literally ruled" — i.e. `DERIVED`, not `RULED`.
⚠ **Second-order hazard:** `SR-13` (judgment enforceability screening) and `SR-20` (UCC collateral
test) are *also* about the judgments/liens section, from the other namespace. Any future rule row
for this section must carry both `IR-43` and `SR-13`/`SR-20` with tags, or it will look like one
rule family when it is two.

**vesting/legal roll-up: SOUND.** `IR-32`/`IR-33`/`IR-49`/`IR-50`, all outside the overlap.

## 2. `sec-count-reconciliation` — the delta arithmetic

The delta is counted from `CONTEXT.md:322–332`, whose `Rule` column is **entirely `SR`**
(R13, R16, R17, R18, R19, R20, R21, R22, R23). Confirmed by reading the table: every row's rule
matches the `SR` gloss at `CONTEXT.md:299–312` and none matches the `IR` text at the same number.
Example proof: the row at `:329` is `ucc[].collateral_description | R20`, and `SR-20` is "UCC. The
collateral description decides." while `IR-20` is "One page per assignment, judgment, UCC…". The
table means `SR`. **No namespace mixing in the arithmetic.**

Corrected row tags: `SR-13`(2) · `SR-18`(3) · `SR-16`(3) · `SR-17`(4) · `SR-19`(3, wildcard) ·
`SR-20`(4) · `SR-21`(2) · `SR-22`(1) · `SR-23`(1). Sum = 23, floor not exact, because
`modification.*` at `:328` is a wildcard. Arithmetic re-added and confirmed: 2+3+3+4+3+4+2+1+1 = 23.

Two corrections to that artifact's own text:

1. It cites the table as `CONTEXT.md:322-329`. The table body actually runs **`:324–332`**
   (`:322` is the header row, `:323` the separator). The last three rows — `SR-21`, `SR-22`,
   `SR-23` — fall *outside* the cited range even though their counts were included in the sum.
   The arithmetic is right; the line citation is wrong and under-covers by three rows.
2. It reports "68 `LABEL:` slots" in `3_Typed_Report_Template.docx` where the sibling artifact
   reports 64 for the same file. Recount here: **64** lines end in a colon, **67** match a
   leading-label pattern, **72** lines contain any colon. All three numbers are defensible under
   different regexes and none is wrong — but the two artifacts state incompatible figures without
   stating their predicate. Neither 64 nor 68 is load-bearing (both are far from 132), so this is a
   reporting defect, not a conclusion defect. **Mark the slot count `OPEN` pending a stated
   counting predicate.**

`132`, `131`, `73-class` involve no rule citations and are untouched by the collision. Their
`UNTRACEABLE`/`OPEN` status from `sec-count-reconciliation` is unaffected and carries forward.

## 3. Claims demoted to OPEN

Per principle 6, carried forward as `OPEN`, not asserted:

- **O-1.** Whether `SR-13..SR-24` are the *only* senior rulings. `CONTEXT.md` starts at R13 with no
  R1–R12 present (grep: zero matches for `**R1`–`**R12`). Either the senior namespace also has an
  R1–R12 — in which case the overlap window widens to R1–R24 and several `IR` citations above
  become hazardous — or the numbering was deliberately started at 13. **Unanswerable from the repo;
  owner-supplied.** This is the single highest-leverage open question in this audit.
- **O-2.** The exact wording of any `SR` rule. `RECOVERY-2026-09-02.md:29–33` already rules this;
  restated so no downstream reader treats the `CONTEXT` summary as verbatim.
- **O-3.** Template slot count (64 / 67 / 68 / 72) — needs a stated predicate.
- **O-4.** `IV` vs `SV` validator collision: which, if either, `v99` belongs to.
  AGENTS.md says "v99 stays deliberately empty: land+building is never checked against total".
  `GR-9` says "accessory value goes into BUILDING **so LAND + BUILDING = TOTAL**". These read as
  direct opposites at the surface. The reconciliation is plausibly that `GR-9` is a *typing*
  instruction (where to put accessory value) and `v99` refuses an *automated* equality check
  because valuation bases are mixed — but nothing in the repo states that, so it is **not citable**.
  Do not resolve this by inference; it needs an engineer-confirmed rule.

## 4. Ruling

Both audited artifacts are **namespace-clean in their conclusions.** No verdict changes. The
defect is one of *spelling*, not reasoning: bare `Rn` was used where `IR-n`/`SR-n` was meant, and
two citations (`R23`, `R24`) sit inside the overlap window where a reader cannot recover the intent
without re-opening the docx.

Adopt the `IR-`/`SR-` prefixes proposed at `RECOVERY-2026-09-02.md:35–37` **at citation time in
docs, immediately** — not only at seed time. The recovery doc deferred the prefix as a schema
decision; that deferral is what left these two artifacts ambiguous. The prefix costs nothing in
prose and it is the only thing that makes a citation auditable.

Extend the proposal to the validators: `IV-1..IV-15` and `SV-1..SV-14`/`SV-99`.
`ORGANIZATION-PLAN.md:66` is already correctly struck through (verified: `~~`-wrapped, marked
WITHDRAWN 2026-09-02); no further action there.

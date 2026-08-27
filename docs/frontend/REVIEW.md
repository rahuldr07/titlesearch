# Frontend review — standing procedure and open ledger

**Status: AUTHORITATIVE. Living document.** Updated every review round.

A build session develops `apps/web-v2` continuously. A review session checks it. This file
is what lets the reviewer be a *fresh context* and still be as good as the last one — the
findings below were tracked in conversation for four rounds, which is exactly how a finding
gets lost.

**Reviewer's job:** run the gates, sweep for the failure modes below, read new seams for
depth, and report with evidence. **Do not edit `src/` without saying so** — the build
session is writing there and edits collide.

---

## 1. Run the gates. All four, exit codes, no pipes.

From `apps/web-v2`:

```bash
node scripts/check-rules.mjs; echo "check:rules exit=$?"
pnpm exec tsc -b --pretty false;  echo "typecheck   exit=$?"
pnpm exec eslint .;               echo "eslint      exit=$?"
pnpm exec knip;                   echo "knip        exit=$?"
```

**Never `| tail` these.** `$?` then reports the exit of `tail`, not the gate — a red gate
reads as green. That mistake was made once in round 1 and reported two failing gates as
passing.

## 2. The sweeps that have actually caught things

Each of these found a real defect at least once. Run all of them.

**Duplicate components.** The previous build died of *kit built, then bypassed* — fourteen
components with zero call sites while features reimplemented them.

```bash
cd src
grep -rhoE "^export (function|const) [A-Z][A-Za-z]+" --include="*.tsx" . | awk '{print $3}' | sort | uniq -d
find . -name "*.tsx" ! -name "*.stories.tsx" -exec basename {} \; | sort | uniq -d
```

Story exports legitimately repeat names (`Default`, `Empty`, `Pending`…). Ignore those.
Anything else is a real duplicate.

**Zero-call-site kit components.** A component with no consumer is either premature or
about to be reimplemented.

```bash
grep -rl "ComponentName" --include="*.tsx" src/ | grep -v stories
```

**Vendor containment.** The dependency spec requires single-file vendor seams.

```bash
grep -rl "sonner" src/     # must be exactly 1 — shared/notify.ts
grep -rl "tinykeys" src/   # must be exactly 1 — shared/chords.ts
grep -rl "@embedpdf" src/  # must be exactly 1 once the PDF screen lands
```

**Second doors.** A module split for the length rule must not become two entrances.

```bash
grep -rn "from \"[^\"]*fieldValue\"" --include="*.ts*" src/ | grep -v provenance
grep -rn "from \"[^\"]*focusRoles\"" --include="*.ts*" src/ | grep -v focusOwnership
```

**Dangling doc citations.** The 2026-08-27 cleanup deleted ~24 documents. Code comments
citing them can no longer be checked.

```bash
grep -rn "BRIEF\|HANDOFF-UI\|conflicts\.md\|phase2-audit\|component-inventory" src/
```

Facts that survived are in `CARRY-FORWARD.md`; the dependency decisions are in
`docs/superpowers/specs/2026-08-27-frontend-dependency-set-design.md`.

## 3. Rules that mis-fire — do NOT make the code contort for these

A reviewer who reports these as code defects is wrong, and will cause damage.

| Rule | Why it mis-fires |
|---|---|
| `file-too-long` (§6) | Counts **comment lines**. It has flagged a module with 20 lines of code, and its message — *"a component is missing"* — is meaningless for hooks and utilities. The doc comments in `shared/` are the most valuable thing in those files. Judge by code lines, and check whether a split relocated the reasoning or destroyed it. |
| `!important` (§6) | Correct everywhere except a `@media (prefers-reduced-motion: reduce)` reset, where `!important` is genuinely required to beat animation and inline styles. |
| `knip` unused deps | Currently red for ~12 spec-installed packages whose screens are not built. Not defects. |

**Rule of thumb:** when a gate fires, decide whether the *code* or the *rule* is wrong
before asking anyone to change anything.

## 4. Read new seams for depth

Vocabulary: a **deep module** puts a lot of behaviour behind a small interface. The
deletion test — imagine deleting it; if complexity reappears across N callers, it earns
its place; if nothing reappears, it was a pass-through.

The three that carry this codebase, for calibration:

- **`shared/provenance.ts`** — `readCited()` classifies a server field into five renders.
  The classification *order* is the rulebook. Note its header honestly states that `tsc`
  does **not** enforce the envelope — lint does — after a review proved three bypasses
  compiled clean. Do not let that honesty regress into an overstated guarantee.
- **`shared/chords.ts`** — the suspension test runs *inside* the handler rather than
  binding/unbinding on focus change. That is what makes "resumes without a click" true by
  construction.
- **`components/ui/disabled.ts`** — the kit has **no boolean `disabled` prop**, only
  `disabledBecause?: string`. Design rule 9 becomes unforgeable.

New code should be held to that standard.

---

## 5. Open findings ledger

Carry these forward every round. Delete a row only when it is actually fixed.

| # | Finding | Status | Detail |
|---|---|---|---|
| R1 | **`vite.config.ts` has two `build:` keys** | **OPEN — highest priority** | Lines ~195 and ~260. The second wins; the first is silently discarded. The discarded block is `rollupOptions.output.manualChunks` pinning the 4.5 MB PDFium engine into a named `"pdf"` chunk — and `pdfMustStayLazy()` (registered line ~193) asserts against that chunk. So the assertion's target is deleted by the merge: **a check that reports present and verifies nothing.** Merge both into one `build:`. Caught as `TS1117`. |
| R2 | **`ProgressMeter` duplicated** | **OPEN — 4 rounds** | `components/ui/ProgressMeter.tsx` (82 lines, built on react-aria `ProgressBar`, gets ARIA free) and `entities/order/ProgressMeter.tsx` (79 lines). **Zero consumers each**, and the code now *differs* — diverging, not copied. Keep the kit one; delete the entity one. |
| R3 | **`VENDORED` exemption is now wrong** | **OPEN** | `scripts/check-rules.mjs` (~line 142) skips all of `src/components/ui/` — 48 files, ~2,850 lines — because it "holds shadcn registry files … the same status as `node_modules`." Since the shadcn adaptation commits, that code is **edited by us**. Edited code exempt from our own rules gate is the worst of both. Audited impact today: one violation (`ui/ui.css:59`, hardcoded colour). Either re-vendor clean and keep the exemption, or drop it. |
| R4 | **`knip` red for expected reasons** | **OPEN** | ~12 unused deps (all EmbedPDF, `panzoom`, both `@react-aria` helpers, `motion`, `web-vitals`) + 3 devDeps. None is a defect. But a gate red for expected reasons trains people to ignore it. Move to `ignoreDependencies` with a dated note naming the screen that retires each entry. |
| R5 | **Workbench prop mismatches** | OPEN — read as signal | `src/workbench/DomainHalf.tsx`: `CitationRef` has no `docId`; `RulePill` rejects `"active"`; `StageDots` rejects `"settled"`/`"pending"`; `ClerkStamp` has no `kind`. The workbench is the first real consumer and it found that what a caller reaches for is not what the interfaces offer. If `"settled"` is the domain's word, `StageStatus` may carry the wrong vocabulary — fix the interface, not just the call. |
| R6 | **Watch for built-then-bypassed** | WATCH | `notify` and `api.post`/`api.patch` currently have **zero call sites**. Expected — no mutations written yet. It is also the first symptom of the failure that killed the last build. Re-check every round. |

### Closed

| Finding | Closed by |
|---|---|
| `shared/date.ts` cited by a rule but never built | Built. |
| `Toaster` hotkey duplicated at two call sites | Ownership moved into `notify.ts`. |
| eslint unused `_a`/`_w`/`_info` | Bindings deleted rather than underscore-named — the better fix. |
| `src/__probe/` left in tree | Removed. |
| `provenance.ts` claiming a `tsc` guarantee it did not have | Header corrected; lint rules added; branding evaluated and rejected with reasons. |

---

## 6. Starting a review from a fresh context

Paste this:

> Read `docs/frontend/REVIEW.md`. Run every gate in §1 with correct exit codes, run every
> sweep in §2, then re-check each OPEN row in §5 and report status with evidence. Respect
> §3 — decide whether the code or the rule is wrong before asking for a change. Do not edit
> `src/`; the build session is writing there.

Then update §5 in the same session, so the next reviewer inherits the ledger rather than
rediscovering it.

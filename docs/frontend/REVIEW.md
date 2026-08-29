# Frontend review — standing procedure and open ledger

**Status: AUTHORITATIVE. Living document.** Updated every review round.

A build session develops `apps/web` (package `@titlepipe/web`) continuously. A review session checks it. This file
is what lets the reviewer be a *fresh context* and still be as good as the last one — the
findings below were tracked in conversation for four rounds, which is exactly how a finding
gets lost.

**Reviewer's job:** run the gates, sweep for the failure modes below, read new seams for
depth, and report with evidence. **Do not edit `src/` without saying so** — the build
session is writing there and edits collide.

---

## 1. Run the gates. All four, exit codes, no pipes.

From `apps/web` — **not** `apps/web-v2`, which is an empty husk (see R0):

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

Round 5 (2026-08-28): R1, R3, R5 closed. R2 **reversed** — read it before acting.

| # | Finding | Status | Detail |
|---|---|---|---|
| R0 | **Every documented command names a package that does not exist** | **OPEN — blocks a fresh session** | The app is `apps/web`, package name **`@titlepipe/web`**. `apps/web-v2` is a stale husk holding `node_modules` and **zero tracked files**. `pnpm --filter web-v2 …` → *"No projects matched the filters"*, so dev/build/lint/test/check:rules/knip in `.claude/CLAUDE.md` are all inert as written, as was §1 of this file (fixed this round). `.claude/CLAUDE.md` also asserts "`apps/web` was deleted; web-v2 is the only app" — the exact inverse of the tree. Fix the filters to `@titlepipe/web` and delete `apps/web-v2/`. |
| R13 | **A blocked `Option` VANISHES from the list — rule 12 broken, confirmed by probe** | **OPEN — highest priority; live defect** | `option.tsx:25` wraps `ListBoxItem` in `BlockedHint`. `tabs.tsx:78-96` already establishes that a collection builder reads its direct element children as data before render, so *any* wrapper — even `display:contents` — is opaque to it, and it names **`a Tab or an Option`** as the two cases where wrapping is wrong. `Tab` was fixed and regression-tested (`tabs.stories.tsx:85`, asserts both tabs remain). **`Option` was not.** MEASURED this round, chromium via `@vitest/browser-playwright`: a `Select` given one live and one `disabledBecause` Option renders **one** `[data-slot='select-item']` — `"Countersign"` is absent from the DOM. Rule 12 says a blocked action renders disabled with the rule, NEVER hidden; a blocked option is currently invisible. `select.stories.tsx:95` (`OptionBlocked`) has **no play function**, so nothing catches it — the same "a story that only renders cannot see an empty box" failure `input.tsx` documents. Fix: drop `BlockedHint` from `option.tsx`, carry `data-disabled-reason` plus an inline note as `tabs.tsx` does, and add the count assertion to `select.stories.tsx` and `combobox.stories.tsx`. |
| R2 | **`ProgressMeter` duplicated — the LIVE one is the weaker one** | **OPEN — 5 rounds; prior instruction was right, but not safe to apply as written** | No longer zero-consumer on both sides. **`entities/order/ProgressMeter.tsx` (79 ln) is LIVE**: `features/hub/VerdictCard.tsx:3` → `OrderHubScreen.tsx:108` → `app/chrome/OrderRoute.tsx:43` → router. **`components/ui/progress-meter.tsx` (88 ln) reaches no screen** — its only consumers, `features/review/DecisionDock.tsx` and `workbench/SecondHalf.tsx`, are both knip-unused. Both draw DOTS; they are not bar-vs-meter. The kit one is strictly better: it draws `total` dots and degrades to a mono count above `MAX_DOTS = 24`, clamps `settled`/`total`, and gets `role`/`aria-valuenow`/label wiring from react-aria `ProgressBar`. The entity one hard-codes `DOTS = 18` and floors a proportion into that fixed track, so for any `total ≠ 18` the dot count is not the quantity (5 of 7 → 12 of 18 filled). So: **keep the kit one — but migrate `VerdictCard` FIRST.** Deleting the entity file on its own removes the only meter a user can currently see.
| R4 | **`knip` red, and `ignoreDependencies` is backwards** | **OPEN** | Exit 1. The list in `knip.json` ignores 10 deps that are **actually used** — knip itself emits *"Remove from ignoreDependencies"* for `@titlepipe/ui-tokens`, `tailwindcss`, `@tanstack/react-virtual`, `lucide-react`, `sonner` — while the **16 genuinely unused** spec-installed deps (7 `@embedpdf`, `@panzoom/panzoom`, both `@react-aria` helpers, `motion`, `web-vitals`, `@fontsource-variable/geist`, `tw-animate-css`, `shadcn`, `zod`) are not ignored at all. So the gate is red for the entries that should be suppressed and silent on the entries that should be justified. Move the real ones to `ignoreDependencies` **with a dated note naming the screen that retires each**, and drop the five knip flags as used. Note `@fontsource-variable/geist` / `tw-animate-css` are imported from CSS and knip does not follow `.css` — those two are false positives to be recorded as such, not deps to remove. |
| R6 | **Built-then-bypassed watch** | **PARTIALLY CLEARED — one new instance** | `notify` **cleared**: live at `features/queue/usePassOrder.ts:57,59`, `features/escalations/useEscalations.ts:69,83`, `EscalationsScreen.tsx:100`. `api.post` **cleared**: `useIngest.ts:8`, `usePassOrder.ts:3`, `useReviewWrites.ts:4`. **`api.patch` still zero call sites** (`shared/api.ts:121`, flagged by knip). Keep watching. New instances are R7 and R8. |
| R7 | **Two `CommandPalette`s; the kit one is bypassed** | **OPEN — new** | `components/ui/commandPalette.tsx:36` (kit, exported at `components/ui/index.ts:74`, built on the react-aria filtering shell in `command.tsx`) has **no consumer but its own story**. `app/keyboard/CommandPalette.tsx:30` is a second, hand-rolled implementation over `Dialog/Modal/ModalOverlay` with `useState` arrow/enter — and it is the one the app renders (`app/rootRoute.tsx:11,105`). Both header comments claim to be *the* palette and both argue chord suppression at length. This is the exact failure that killed the previous build, caught early. Pick one. |
| R8 | **`features/review/` — 11 files, zero consumers, and arguably built past `OPEN`** | **OPEN — new** | `DecisionDock, FieldRow, RowMark, RowValue, T1Pill, HotkeyChips, useReviewWrites, queue, readings, panelRubric, fieldNaming` — **nothing outside the directory references any of them** (`grep "features/review"` from elsewhere in `src/` returns nothing). Meanwhile `app/routeTree.tsx:105-111` states the workstation *"is NOT built and cannot be: the design's T1 second read and countersign have no contract surface at all, and AGENTS.md forbids building past OPEN."* Both cannot be right: either the router comment is stale, or eleven files of workstation internals were built past `OPEN`. Resolve the contradiction, don't just wire them up. |
| R9 | **The R3 defect survives in a second gate: `knip` exempts the kit** | **OPEN — new** | `knip.json` ends with `"ignore": ["src/components/ui/**"]`, hiding **71 `.tsx` files** from dead-code detection — zero `components/ui` findings in today's run. This is the same "the gate skips the kit" premise that R3 just removed from `check-rules.mjs`, left standing one config file away. It is also *why* R7 went unreported: knip cannot see that the kit palette has no consumer. Remove the ignore. |
| R10 | **Second door into `fieldValue`** | **OPEN — new, low severity** | `workbench/DomainHalf.tsx:11` imports `Citation, FieldValue` straight from `../shared/fieldValue`. `provenance.ts:57-62` re-exports that vocabulary precisely *"so this module stays the single import for anything provenance-related."* One violation, type-only, in a dev-only file — but it is exactly what the §2 sweep exists to catch, and the door is new. |
| R11 | **Six code comments cite deleted documents** | **OPEN — new** | All six targets confirmed absent from the repo (`git ls-files`): `app/queryClient.ts:6` (BRIEF §6), `shared/chords.ts:30` (BRIEF §5), `shared/chords.ts:45` (**HANDOFF-UI.md:167** — a line number in a deleted file), `shared/fieldValue.ts:128` (BRIEF §6), `shared/api.ts:19` (BRIEF §7), `shared/api.ts:24` (BRIEF-DELTAS.md D-6). Each carries a *reason* that is now uncheckable. Re-point at `CARRY-FORWARD.md` / the dependency spec, or inline the reasoning. |
| R12 | **`knip` cannot load `playwright.live.config.ts`** | **OPEN — new** | `ERROR: Error loading playwright.live.config.ts (dist-harness/live is missing…)`. knip prints it, then analyses anyway — so today's unused-file list was produced from a partially-loaded project graph and every row in it is softer evidence than it looks. Either build the harness bundles before the gate or exclude the config from knip. |
| R14 | **Dependency hygiene: two chosen-and-unused, one in the wrong section** | **OPEN — new** | `react-hook-form@7.86` **and** `@hookform/resolvers@5.9` are installed with **zero call sites** — a form library picked and never used is a decision deferred, not made. `shadcn@4.19` sits in **`dependencies`, not `devDependencies`** — a CLI in the production tree. Decide the form story on the next form or drop both packages; move `shadcn` either way. |
| R15 | **Three documents assert things the tree has since fixed** | **OPEN — new** | Stale docs cost a reviewer a wrong conclusion; each of these cost one this round. (a) `open-rulings.md:169` (Q17) says `GET/PATCH /api/me/preferences` "was never added to the contract or the mocks" — it is in `packages/contract/src/intake.ts:342-407` and served at `packages/mocks/src/workspace.ts:928,934`. (b) `check-rules.mjs:150-166` says `components.json` "points `tailwind.css` and the `utils` alias at two paths that do not exist" — both now resolve (`src/styles.css`, `src/components/ui/cx.ts`); only the unreferenced `src/index.css` is absent. The row's *conclusion* stands, one of its facts no longer does. (c) `REVIEW-02-primitives.md:181` says the table has "no virtualization and no pagination" — `table.tsx:54` uses `useVirtualizer`. |
| R16 | **Registry components were skipped by default, with no reason recorded** | **OPEN — new** | 37 of 63 registry components were never evaluated; ~17 were hand-written, at least two of which the registry ships. The defect is NOT hand-writing — `disabled.ts` Omits `isDisabled` from every interactive component, so an unmodified registry control could never have been used, and adaptation is what a copy-in registry is for. The defect is that **reject-with-a-reason and never-checked produce identical code**, so the kit cannot tell a reviewer which happened. Assessed: TAKE `resizable` (§7 split pane, 38-74% divider, unbuilt), `breadcrumb` (RAC ships `Breadcrumbs`), `avatar`, `alert` (replaces 8 hand-rolled failure renders). SKIP `pagination` (screen 3 unruled, and `table.tsx` already virtualizes). REJECT `sidebar` — it persists collapse in `document.cookie`, but preferences are server-side (`INVARIANTS.md:179`, decision C16) and **the server side already exists**; a third of its 714 lines is mobile `Sheet` handling for an app with `min-width: 1360px` (`styles.css:59`). Record these verdicts in the files themselves — `SideRail.tsx` should carry the sidebar rejection — or round 6 re-asks them. |

### Closed

| Finding | Closed by |
|---|---|
| **R1 — `vite.config.ts` two `build:` keys** | **Fixed, and fixed well.** One `build:` at line 195 now carries **both** `rollupOptions.input` (the workbench entry, ternary typed `Record<string, string>`) and `output.manualChunks` (the `"pdf"` chunk). `tsc` is clean and `vite.config.ts` *is* checked — `tsconfig.node.json` lists it explicitly. Better than asked: `pdfMustStayLazy` was rewritten to walk static import edges from every entry chunk and name the arrival path, so it **no longer depends on a chunk name at all** — the failure mode that made it vacuous is now structurally impossible. Its header states honestly that it reports nothing until a PDF module exists. `size-limit`'s `!dist/assets/pdf-*.js` exclusion is now correctly pre-positioned rather than guarding a file that could never appear. |
| **R3 — `VENDORED` exemption** | **Dropped, with the premise disproved rather than just deleted.** `check-rules.mjs:150-166` records that `shadcn init --base aria` was never run, that `components.json` points at two paths that do not exist, and that every file is hand-written — so the "same status as node_modules" claim was false, not merely stale. Gate now green across **223 files** including the kit. Leaves a re-add instruction scoped to a future registry `add`. (The identical exemption in `knip.json` was missed — now R9.) |
| **R5 — Workbench prop mismatches** | **Interfaces reconciled; `tsc` clean.** `CitationRef` now takes a `citation` object that carries `docId`; `RulePill` takes `status="pending"\|"live"\|"retired"`; `ClerkStamp` takes `caption`/`detail`. `StageStatus` was **argued rather than widened** — `"waiting"\|"running"\|"done"\|"blocked"`, with a header stating there are *"four statuses and no fifth"* and that `blocked` is deliberately not a synonym for failed. That is the right resolution of "fix the interface, not just the call": the vocabulary was examined and defended. |
| `shared/date.ts` cited by a rule but never built | Built. |
| `Toaster` hotkey duplicated at two call sites | Ownership moved into `notify.ts`. |
| eslint unused `_a`/`_w`/`_info` | Bindings deleted rather than underscore-named — the better fix. |
| `src/__probe/` left in tree | Removed. |
| `provenance.ts` claiming a `tsc` guarantee it did not have | Header corrected; lint rules added; branding evaluated and rejected with reasons. |

## 6. Starting a review from a fresh context

Paste this:

> Read `docs/frontend/REVIEW.md`. Run every gate in §1 with correct exit codes, run every
> sweep in §2, then re-check each OPEN row in §5 and report status with evidence. Respect
> §3 — decide whether the code or the rule is wrong before asking for a change. Do not edit
> `src/`; the build session is writing there.

Then update §5 in the same session, so the next reviewer inherits the ledger rather than
rediscovering it.

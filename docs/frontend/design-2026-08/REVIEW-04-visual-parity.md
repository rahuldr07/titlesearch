# REVIEW-04 — `apps/web` against `reference-app.html`

A cross-check of the running app against the design prototype: fields, controls,
modals, tables, rail. 2026-09-01.

## Method

Not screenshots. `reference-app.html` line 382 is a JSON-escaped string holding
~393 KB of real DOM; extracted, it yields the prototype's own stylesheet and the
inline `style=` on every control. Both apps were then driven in one browser at
1440×960 and compared with `getComputedStyle` and `getBoundingClientRect` —
because in this repo a class name being present proves nothing about whether a
rule was emitted (see `titlepipe-verify-dont-read`).

The prototype's own control stylesheet, for the record:

| | reference-app.html | RECIPES §Inputs |
|---|---|---|
| input | 36px, `padding: 0 10px`, 13px | 36–38px, radius 10, `#FBFBFD` |
| input fill | `#FFFFFF` | `#FBFBFD` |
| input hover | `border-color: #B4BAC6` | — |
| input focus | `border #5B4B8A` + `0 0 0 3px rgba(91,75,138,.15)` | — |
| read-only | `background #F5F6F9; color #6E7480` | "keep `#6E7480` text and explain themselves" |
| select | 36px, `padding: 0 26px 0 8px` | — |
| disabled | `opacity: .5` | `#E4E7ED`/`#8A8E98` + `title=` reason |

Note the two artifacts disagree about the input fill (`#FFFFFF` vs `#FBFBFD`)
and about how read-only is carried. Neither was resolved here — see **Flagged**.

## Fixed

**Domain facts copied out of the drawing.** The design is authority on geometry
and on nothing else, and three assertions had been transcribed anyway:

- `Dropzone.tsx` said the package is `20–150 pages`. PRODUCT.md and CONTEXT §1
  both say **36–181**.
- `IntegritySeal.tsx` stamped **"SOC 2 Type II certified"** on a released
  deliverable, `OverviewHeader.tsx` promised "SOC 2 delivery certification", and
  `EventTrail.tsx` titled itself "Immutable SOC 2 Event Trail". PRD §248 and
  CONTEXT §482 both defer SOC 2 to first client demand — there is no
  attestation. `OrderHistoryOverlay` and `ShortcutsOverlay` had already refused
  the same claim in comments, so the app was asserting and refusing a
  certification at the same time, on adjacent screens.

**Controls that did not agree with each other.**

- The `Select` trigger and `ComboBox` box were `h-19` (38px); `Input` is `h-18`
  (36px). Stacked in the Intake form, the pickers stood 2px taller than the text
  field beside them. Both now take `controlHeight` from `field-chrome`, so there
  is one number. Measured: 38 → 36, matching the prototype's 36.
- The `Select` placeholder rendered in `text-ink-primary` — the same ink as a
  chosen value, so "Choose the client…" read as an answer. Now `ink-muted`,
  which is what `Input` has always done with its own placeholder.
- Text controls had no hover state at all, while `Checkbox` and `RadioGroup`
  darkened their border on hover. The kit disagreed with itself about whether a
  control answers the pointer. `controlClass`, the Select trigger and the
  ComboBox box now darken to `ink-faint` on hover; verified with
  `getComputedStyle` at `:hover`, not read off the class list.

**Layout.**

- `PeoplePanel` gave the grid template to each `<li>`, so every row was its own
  grid. The one row carrying a "Privileged, no MFA" badge sized its flag column
  to 119px while the other five sized theirs to 0 — and that row's name, role
  picker and status all sat 37px left of the others. The `<ul>` now owns the
  columns and each row is `grid-cols-subgrid`. Measured: six pickers at six
  different offsets → six at x=756, w=256.
- The `Due` column truncated in both order tables: "tomorrow 10:…", "Waiting on
  …". The prototype wraps it to two lines and so do we now; it fits the 44px and
  60px rows.
- `ReleaseAct` rendered the refusal sentence *as the primary button's label*,
  which made the button ~550px of prose and squeezed the signature field beside
  it to a box too narrow to show its own placeholder — while the identical
  sentence was already printed by `release-hold` directly below. The button
  keeps its label; the reason still reaches a reader through `disabledBecause`
  (`title`), the paragraph below, and the `Alert` above.
- "Templates Architect" clipped to "Templates Archit…" in the rail. The door
  glyphs are ours, not the design's, and they cost a door 25px of label. Badge
  padding, row gap and group inset were trimmed to buy it back. Measured: no
  clipped rail label at 1440px.

**Reads and labels.**

- `/templates` fired `GET /api/templates/none` and took a 404 on every visit.
  The call site carried a comment saying the read was "disabled below"; it was
  not, and `useRead` had no option to disable it with — the sentinel id invented
  to keep hook order stable was being fetched for real. `useRead` now takes an
  `enabled` second argument and the detail read waits for an id. Verified: the
  screen makes two requests, both 200, and the console is clean.
- `fieldLabel("assessment.tax_status")` rendered **"TAX TAX STATUS"** — the
  section short form (`assessment` → `TAX`) prepended to a leaf that already
  opened with the word. A repeated leading word is dropped, but only while
  another survives it, so `assessment.tax` would still read "TAX". The
  invariant specs address these rows by path (`row-assessment.tax_status`), not
  by label, so nothing was pinned to the doubled string.

**Two spellings of one value.** `RecentOrderRow` printed the bare `stage` enum
(`gate`, `intake`, `escalated`) while `orderColumns` one door away printed
`Gate`, `Intake`, `Escalated` from a private label table. The table moved to
`entities/order/stageLabel.ts` — the layering-correct home for a render-only
domain piece — and both tables read it.

**The modal wore a focus ring.** React Aria focuses the dialog NODE on open; it
carries `tabindex="-1"`, matches `:focus-visible`, and `styles.css` then traced a
2px accent outline around the whole modal card, as though the card were
selected. `dialog.tsx` already wrote `outline-none` intending exactly this — at
equal specificity the global rule simply won on source order, so the class was
dead. The rule now excludes `[role="dialog"]`; `[tabindex]` stays in it because
the virtualised table rows are `tabIndex={-1}` divs and that rule is the only
thing showing where the keyboard is on them.

**Read-only rows that were read-only in ink alone.** Intake's Page Count and
Jurisdiction boxes painted `bg-surface-sunken`, which is the same `#FBFBFD` as
the editable fill beside them — a distinction that emitted nothing. They now
take `--color-control-fill-readonly` (`#F5F6F9`, the prototype's own
`input[readonly]` background). Both also stood at `h-19` (38px) next to an
`Input` at `controlHeight` (36px), two boxes of different heights in one
two-column grid; both are now `h-18`.

**The workstation label was missing its colon.** `Active Field OWNER ZIP`
against the design's `Active Field: Grantee name`. The colon is added. The
casing is a separate, gated question — see the flagged list below.

**One boundary where the screen needed three.** `WorkstationScreen`'s two
columns sat under the root route's single `ScreenBoundary`, so a corrupt page
blob in `ScanPane` took the decision column down with it — and the decision
column is where Escalate lives, the one control a reviewer who cannot render
the scan still needs. Each `SplitPanel` now carries its own boundary.
`ScreenBoundary` gained a `region` prop so the fallback names what stopped
("This source page stopped") rather than claiming the whole screen did.

## The Examination Workstation, measured line by line against the prototype

The prototype's screen is `reference-app.html` lines 1645–1900 with its computed
styles at 4381 and 4661–4669. Every number below was measured on both sides.

**The open decision was a card, and RECIPES says it must not be.** Ours drew
`rounded-lg border border-l-3 bg-surface-panel p-12 shadow-card` on a grey
`bg-surface-app` band — a filled, bordered, shadowed box, with a second bordered
box (the reading pair) nested inside it. RECIPES §Open decision: *"3px left
rail, **no fill box**"*, plus *"nested cards forbidden"*; the prototype agrees —
`border-left:3px #5B4B8A; padding:22px 20px 22px 25px; margin:14px 0`, nothing
else. The rail moved to `DecisionPanel`, which owns the whole open decision
including the excerpt and editor beneath it, and `DecisionCard` now carries no
chrome at all. Measured after: `borderLeft 3px rgb(91,75,138)`, padding
`22px 20px 22px 22px`, margin `14px 0`, background transparent, radius 0,
shadow none.

**The split seam drew two hairlines.** The `SplitHandle` paints a full-height
rule and the left panel painted `border-r` of the same colour 11.5px away, so
the divider read as a double line. The panel's border is gone; the handle's
rule is the seam.

**The source pane wore the app canvas.** `#ECEEF3` where the design uses
`#F3F4F7` — a rung lighter, because the sheet is the subject there and the
canvas grey reads as chrome behind it. New token, and see the gate note below
for what went wrong naming it.

**Field rows were ruled, not spaced.** Ours: `padding 10px 16px`, radius 0, a
1px bottom hairline, rows flush at 0px apart, hover changed the background
only. The design: `9px 8px`, radius 14, rows separated by `gap:4px`, and hover
adds a `#C6BAE4` border. Now: padding `10px 8px` (9px is not on a 2px scale),
radius 14, gap 4, hover border `rgb(198,186,228)`. The row label was mono w400
against the design's sans w600 — also fixed; the CASING is untouched and stays
`CONFLICT-caps-in-strings`.

**Both bars wrapped onto two rows at 1360px of content.** The workstation header
was 76px because the meter and the open field's name claimed ~700px between
them, shoving the chord legend down; the design binds them into one
`flex:1;max-width:420px` group. Bound the same way, the header is **40px** —
`8px 16px` padding plus 24px of content, the design's own figure. The page bar
was 93px, mostly the follow toggle's sentence; it now reads `◉ Following` /
`○ Free` as the design does, and the bar is 55px.

**The value did not outrank the question.** 28px w400 against the design's
28px w600.

**The absence guide had no door.** `NaGuideOverlay` already existed and was
reachable only through the command palette. The design puts it on the bar,
because declaring an absence is a decision made while looking at a field and
hunting for the definitions is how the wrong one gets filed.

**Hover-to-preview did not exist.** `reference-app.html:4382` — `enter:` sets
`hover: label` and, when following, pages to that field's citation; `bbKey =
s.hover || openLabel` drives the box. Ours only ever followed the SELECTED
field. Hover and focus now preview any row, `Following` still governs whether
the page travels, and the hover is deliberately not cleared on mouse-leave —
a box that vanished when the pointer left could never be read.

**A gate came out of this pass.** Naming the new pane token
`--color-surface-evidence` collided with the existing citation-highlight token
of that name; CSS redeclaration is legal, the later value silently won, and
both panes painted themselves with the highlight tint. Nothing in the
toolchain sees this — not Tailwind, not tsc, not eslint. `check-rules` now
carries `duplicate-token`, verified by injecting a duplicate and watching it
fail. It reads declarations at line start, which is this file's convention.

## Flagged, not fixed — these are the owner's

1. **Input fill — the read-only half is now FIXED; the editable half is still
   the owner's.** The prototype draws editable inputs `#FFFFFF` and read-only
   ones `#F5F6F9` (`input[readonly] { background:#F5F6F9; color:#6E7480 }`);
   RECIPES says `#FBFBFD` for inputs and specifies read-only on ink and wording
   only. Those two disagree about the EDITABLE fill and that stays open. They do
   not disagree about read-only — RECIPES states no read-only fill — so the
   third token this entry proposed has been added:
   `--color-control-fill-readonly: #f5f6f9`, the design's own value, now on
   Intake's two clerk-stamp rows. Before it, `--color-control-fill` and
   `--color-surface-sunken` were both `#FBFBFD` and the read-only boxes emitted
   no distinction at all. **Still open:** editable fill `#FBFBFD` (RECIPES) vs
   `#FFFFFF` (prototype), and input radius 10 (RECIPES) vs 14 (prototype).
2. **The rail's Active Order stages.** The prototype keeps the five numbered
   stages under ACTIVE ORDER on every screen — verified: its block sits in a
   bare `<div style="padding:20px 12px 0">` with no `sc-if` guard, because the
   prototype always has one hard-coded order to name. We render them only on an
   order-scoped route, so on Overview the rubric stands over a single "Overview
   Hub" row with no order ref beside it, which reads as unfinished. The reason
   to keep the gate: off an order route our only candidate is whatever
   `/api/queue/next` returns, and drawing five stages under "Active Order" for
   an order the reader never opened states something untrue. `RailSection.tsx`
   carried a comment claiming the ref was gated too — it is not, and the comment
   now records the divergence instead of denying it.
3. **RBAC vocabulary.** The served matrix columns are Admin / Typist (Reviewer) /
   QC Reviewer / Engineer — the design's four. Contract `ROLES` are reviewer,
   senior, ops, engineer, typist, admin: "QC Reviewer" is not one of them and
   senior and ops have no column. This is mock data, not a screen defect, but
   the screens will inherit it at cutover.
4. **Scrim value — FIXED, and this entry was wrong.** Ours was
   `rgb(20 22 28 / .4)`, now `rgb(20 22 28 / 0.45)`. An earlier draft of this
   entry quoted the prototype as `rgba(20,18,30,.45)`; that is the ONE outlier
   in the file — the JSON-inspector overlay, and the only scrim without the
   `tf-scrim` animation. The seven real modal scrims are all
   `rgba(20,22,28,.45)` with `backdrop-filter:blur(3px)`, which is what
   `--color-scrim` + `tp-scrim` now emit. Only the alpha was ever wrong; the
   hue was right. Anyone re-deriving this from the old line would regress it.
5. **Workstation field rows — FIXED.** `tp-field-row-grid` had shipped as a
   dead class, so the four tracks silently rendered single-column.
   `FieldRow.tsx` now carries `grid-cols-[140px_minmax(0,1fr)_70px_24px]`,
   measured at `140px 477.594px 70px 24px`, and `FieldRow.test.ts` reads the
   built CSS so a dead `tp-` class cannot ship again.
6. **`OrderPicker` prints internal ids.** The Delivered screen's order buttons
   read `ord_demo_12` where every other screen prints the ref. Left as-is and
   marked `CONTRACT GAP` in the file: `DeliveryWithReport.report` carries
   `order_id` and no `order_ref`, so there is nothing else to print without the
   screen inventing a join.
7. Already open elsewhere and untouched here: `CONFLICT-ink-faint-contrast`,
   `CONFLICT-caps-in-strings` — now narrowed. The prototype's label is
   `Active Field: Grantee name`; ours read `Active Field OWNER ZIP`, and the
   two halves of that gap have different owners. The **colon** is ours and is
   fixed. The **casing** is not: `OWNER ZIP` is pinned by twelve `toHaveText`
   assertions across five spec files, and that file's §6 forbids editing them
   without a recorded ruling. Also still open: `CONFLICT-slash-key` (the `?`
   map lists "Open the command palette" twice, once for ⌘K and once for `/`).

## Gates

`tsc --noEmit -p tsconfig.app.json`, `check-rules` (384 files), `eslint`
(0 errors) and `vitest` (390) all pass.

`playwright test` was run twice — once on this change and once on a stashed
clean tree — because the suite does not pass on either. Both runs report the
same totals, **53 failed / 80 passed**, and comparing the failure sets
test-by-test: no test that passes at baseline fails with this change. The one
entry that looked like a regression,
`responsive-frame.spec.ts:27:3`, is parameterised by viewport and behaves
identically in both runs — 1440px passes, 1280/1024/900 fail, which they must,
because the frame declares `min-width: 1360px`.

The pre-existing failures are on things not in this diff: `rail-toggle` and
`data-collapsed` (the rail has no fold control — `SideRail` passes
`collapsed={false}` with a named no-op), `toHaveURL(/\/queue$/)` (there is no
`/queue` door in `DOORS`), and a set of review-workstation assertions against
selectors the screen no longer renders. These are frozen specs written against
an earlier shape of the app; reconciling them is its own piece of work and is
the reason this suite currently reports nothing useful about a change.

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

## Flagged, not fixed — these are the owner's

1. **Input fill.** The prototype draws editable inputs `#FFFFFF` and read-only
   ones `#F5F6F9`; RECIPES says `#FBFBFD` for inputs and carries read-only on ink
   and wording instead. We follow RECIPES, which has a consequence:
   `--color-control-fill` and `--color-surface-sunken` are both `#FBFBFD`, so
   the `bg-surface-sunken` on Intake's read-only boxes is a distinction that
   emits nothing. The read-only fields there differ from the editable one only
   by ink colour and by their own wording. A ruling either way settles it; a
   third token (`#F5F6F9` sits between our canvas and our sunken) is the other
   option.
2. **The rail's Active Order stages.** The prototype keeps the five numbered
   stages under ACTIVE ORDER on every screen. We render them only on an
   order-scoped route, so on Overview the rubric stands over a single "Overview
   Hub" row with no order ref beside it, which reads as unfinished.
3. **RBAC vocabulary.** The served matrix columns are Admin / Typist (Reviewer) /
   QC Reviewer / Engineer — the design's four. Contract `ROLES` are reviewer,
   senior, ops, engineer, typist, admin: "QC Reviewer" is not one of them and
   senior and ops have no column. This is mock data, not a screen defect, but
   the screens will inherit it at cutover.
4. **Scrim value.** Ours is `rgb(20 22 28 / .4)`; the prototype's is
   `rgba(20,18,30,.45)`. `tokens.css` names no scrim, so ours was invented.
5. **Workstation field rows.** The design draws a field as one line on a
   `140px / 1fr / 70px / 24px` grid — label, value, cite, mark. Measured, ours
   are a **single-column** grid 108px tall, stacking label / value / cite /
   mark on four lines, so a section of four fields fills the pane the reference
   spends on a dozen. Reshaping this touches the J/K nav scroll behaviour, the
   review chords and the frozen `toHaveText` assertions, so it wants its own
   pass rather than the tail of this one.
6. **`OrderPicker` prints internal ids.** The Delivered screen's order buttons
   read `ord_demo_12` where every other screen prints the ref. Left as-is and
   marked `CONTRACT GAP` in the file: `DeliveryWithReport.report` carries
   `order_id` and no `order_ref`, so there is nothing else to print without the
   screen inventing a join.
7. Already open elsewhere and untouched here: `CONFLICT-ink-faint-contrast`,
   `CONFLICT-caps-in-strings` (the workstation's `Active Field OWNER ZIP` against
   the prototype's `Active Field: Grantee name`), `CONFLICT-slash-key` (the `?`
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

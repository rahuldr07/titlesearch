# Design fidelity — plan index and interface contract

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-30-design-fidelity-design.md`
**Evidence:** `docs/frontend/fidelity-audit-2026-07-30.md` (221 divergences, 70 code findings)

**Goal:** Bring `apps/web-v2` into faithful agreement with the 2026-07-28 export —
layout, copy, proportions, states — and land the reuse discipline HANDOFF-UI §1 asks
for, without violating a product rule from §4.

**Architecture:** A delta on the existing build. The token layer, the refusal
semantics and the `CONTRACT GAP` culture are correct and stay. Three things change:
the frame every screen sits in (`AppShell`/`Pane`/`Screen`), the primitives screens
compose from (23 components, 11 of them absorbing existing near-duplicates), and the
data they compose over (one shared demo order set plus read-only contract shapes).

**Tech Stack:** React 19 · TS 6 strict (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `erasableSyntaxOnly`) · Vite 8 · Tailwind v4 ·
TanStack Query/Router/Table/Virtual · react-hook-form + valibot · zustand · cva ·
Vitest · Playwright · MSW 2 · Zod contract in `packages/contract`.

## The plans

Execute in order. Waves 1 and 2 may run concurrently (different packages, zero file
overlap); everything else is sequential.

| Wave | Plan | Delivers |
|---|---|---|
| 0 | `…-w0-shell.md` — **DONE, 0089576** | `PaneBody`/`Screen`/`ScreenMessage`, `chromeFor()`, a working `compare.mjs`. Fixes B1, B2, B3. |
| 1 | `…-w1-primitives.md` | The 11 shared primitives and the two axis corrections. |
| 2 | `…-w2-fixtures-contract.md` | One shared demo order set; the read-only contract shapes. |
| 3 | `…-w3-entities.md` | `RailRow`, the single flow definition, the order/field/signoff entities, the Reader A/B collapse. |
| 4 | `…-w4-screens.md` | All 18 screens assembled from the primitives. Review first and alone. |
| 5 | `…-w5-copy-density.md` | The export's load-bearing copy restored; every density finding. |

## Global Constraints

Every task's requirements implicitly include these. They are gates, not advice.

- **No raw hex outside `packages/ui-tokens`.** Colour reaches TSX only through
  semantic token classes. `check:rules` rejects hex in TSX.
- **Token NAMES never change.** Values only.
- **No arbitrary Tailwind values, no inline `style`, no `!important`, no browser
  storage, no TS escape hatches, no cross-feature imports.** A `rules-allow:` escape
  needs a reason ≥12 characters.
- **150 lines per file, hard.** Split by responsibility when a file approaches it.
- **The spacing base is 2px.** Read `p-N` as `N × 2px`. `max-w-400` is 800px.
- **Nothing in localStorage/sessionStorage.** Preferences persist via
  `GET/PATCH /api/me/preferences`. The MSW mock's own `sessionStorage` stand-in is not
  app code and is exempt.
- **Never render a value without provenance. Never collapse the NA states —
  `NOT_PRESENT` / `NOT_FOUND` / `NOT_STATED` / `PRESENT_UNREADABLE` plus `pending` —
  and they must stay distinguishable in greyscale.** `noValueStates.ts` is the
  authority.
- **The server owns every state machine.** Never derive `state` from confidence, never
  re-derive counts, chain termination or a gate verdict client-side.
- **No approve-all, no bulk confirm, no queue cherry-picking, no throughput counters,
  no per-person productivity, no aggregate accuracy headline, no timers.** A count of
  what is left is fine; a rate is not.
- **Refusals need reasons; judgments never auto-confirm; no optimistic update on a
  field decision — a 409 is an ANSWER and renders the server's message verbatim.**
- **Every response parses through a `@titlepipe/contract` schema at
  `src/shared/api.ts`.** Never widen a contract type locally — emit a `CONTRACT GAP:`
  comment instead.
- **A CSS `text-transform` does not change what text says.** Where the design needs
  literal capitals, write them in the markup.
- **Every component is documented with WHY** in the house style: the rule it enforces
  and the failure it prevents, never a restatement of the code. Match
  `shared/ui/Card.tsx` and `shared/ui/Eyebrow.tsx` for register.
- **Verification runs the whole gate, every task:**
  `pnpm --filter web-v2 typecheck && check:rules && lint && test && knip`, plus
  `test:e2e` at the end of each wave, then root `pnpm typecheck`. Baseline on
  2026-07-30 is all green — 297 tests, `check:rules` clean over 283 files, zero skips
  — so any red is this work.

## Interface contract

**Pinned here so the wave plans cannot drift.** A task that needs a signature not in
this section defines it in its own `Interfaces` block; a task that contradicts this
section is wrong.

### What Wave 0 changed about this contract, and why

The contract below is **as built** (commit 0089576). Six things moved under contact;
the wave plans were written against the earlier draft, so where a plan disagrees with
this section, this section wins.

1. **`Screen` adoption happened in Wave 0, not Wave 4.** The w0 plan kept the screens
   on their own wrappers and put a transitional `<Screen measure="1340">` around the
   outlet. That leaves every screen rendering at one wrong width until Wave 4 deletes
   it. Swapping the root and adopting `Screen` across all eighteen in the same commit
   has no such intermediate state. Wave 4 therefore inherits screens that already
   carry their measure, and its job is the bodies.
2. **Only `PaneBody` shipped.** `Pane`, `PaneHeader` and `PaneFooter` had no caller —
   `knip` caught all four as unused exports. They arrive with Review's two-pane
   rebuild in Wave 4, which is their first real consumer. Their classes are declared
   in `paneClasses` and proved by the node gate, so the contract is fixed without the
   dead code. Shipping a component with no call site is the failure this work exists
   to end.
3. **`Screen` is two cva configs, not one.** `screenScroller` carries `pad` and
   `placement`; `screenClasses` carries `measure`. The export puts padding on the
   scroller and the measure on an inner wrapper, and collapsing them onto one element
   makes the padding eat the measure — Queue's 860px column drew 796px of content.
4. **`paneClasses.body` is `relative`.** Tailwind's `sr-only` is `position:absolute`,
   and `overflow-hidden` does not clip an absolutely-positioned descendant whose
   containing block lies outside the clipper. Without it the document's scroll area
   ran to 3,153px on Review.
5. **`ScreenMessage` is new** — see below. It was in no plan.
6. **`features/review/useReviewEditor.ts` is new.** Wrapping ReviewScreen pushed it to
   152 lines against the hard 150 gate; the four editor `useState`s and their three
   transitions are one responsibility and now live together, matching the file's
   existing `useReviewKeys`/`useReviewSelection` decomposition.

### `src/shared/ui/ScreenMessage.tsx` (Wave 0, new)

```tsx
export interface ScreenMessageProps {
  children: ReactNode;
  /** `halt` when the request failed; `muted` while it is still in flight. */
  tone?: "muted" | "halt";
  /** The measure of the screen this stands in for, so nothing shifts. */
  measure: ScreenMeasure;
}
```

Seventeen early returns across nine screens were bare `<p>` elements returned *before*
the screen's wrapper. Once the shell stopped supplying padding they rendered flush
against the pane edge and then jumped inward when the data arrived.

**It is not an empty state.** `EmptyPanel` (Wave 1) means *resolved and empty* — the
server answered and there is nothing there. This means *not loaded* — nobody knows
yet. Rendering "Nothing held" while a request is in flight asserts something the app
has not been told, and once the two look the same a reader cannot tell them apart.

### `src/shared/ui/Pane.tsx` (Wave 0)

```tsx
export interface PaneProps { children: ReactNode; className?: string }

/** A bounded region. `min-h-0` is why this exists — see the WHY note. */
export function Pane(props: PaneProps): ReactElement        // flex flex-col min-h-0
export function PaneHeader(props: PaneProps): ReactElement  // flex-none
export function PaneBody(props: PaneProps): ReactElement    // flex-1 min-h-0 overflow-y-auto
export function PaneFooter(props: PaneProps): ReactElement  // flex-none
```

`min-h-0` on `PaneBody` is the class that gets forgotten and the reason a nested flex
scroller grows instead of scrolling. Putting it in one component is the whole point;
Wave 0 adds a test that asserts it.

### `src/shared/ui/Screen.tsx` (Wave 0)

Variant keys are the export's own pixel numbers, so a reviewer can check any call site
against the spec's table without a lookup table in their head.

```tsx
export type ScreenMeasure =
  | "380" | "420" | "440" | "460" | "560" | "640" | "700" | "720"
  | "860" | "880" | "900" | "940" | "1040" | "1120" | "1160" | "1340";
export type ScreenPad = "28x32" | "32x40" | "26x30" | "24x28" | "36x40" | "40";
export type ScreenPlacement = "top" | "centre" | "bleed";

export interface ScreenProps {
  children: ReactNode;
  measure?: ScreenMeasure;      // omitted only when placement is "bleed"
  pad?: ScreenPad;              // default "28x32"
  placement?: ScreenPlacement;  // default "top"
  className?: string;
}
export function Screen(props: ScreenProps): ReactElement;
```

Measure → class: `380`→`max-w-190`, `420`→`max-w-210`, `440`→`max-w-220`,
`460`→`max-w-230`, `560`→`max-w-280`, `640`→`max-w-320`, `700`→`max-w-350`,
`720`→`max-w-360`, `860`→`max-w-430`, `880`→`max-w-440`, `900`→`max-w-450`,
`940`→`max-w-470`, `1040`→`max-w-520`, `1120`→`max-w-560`, `1160`→`max-w-580`,
`1340`→`max-w-670`.

Pad → class: `28x32`→`py-14 px-16`, `32x40`→`py-16 px-20`, `26x30`→`py-13 px-15`,
`24x28`→`py-12 px-14`, `36x40`→`py-18 px-20`, `40`→`p-20`.

`Screen` renders a `PaneBody` as its scroller. `placement="top"` centres horizontally
(`mx-auto`) on a full-width parent; `placement="centre"` also centres vertically;
`placement="bleed"` renders no measure and no padding (Review only).

Per-screen assignment is the spec's table. It is reproduced in the Wave 4 plan.

### `src/app/chromeFor.ts` (Wave 0)

```tsx
export interface ChromeMode {
  /** Draw the sidebar and the order strip. */
  chrome: boolean;
  /** Issue the preference and attention GETs. */
  fetches: boolean;
}
export function chromeFor(pathname: string): ChromeMode;
```

- `/blind/*` → `{ chrome: false, fetches: false }` — the capture seat's structural
  blindness, asserted by `blind-blindness.spec`.
- `/signin`, `/session` → `{ chrome: false, fetches: false }` — nobody is
  authenticated, so neither the chrome nor the GETs are legitimate.
- everything else → `{ chrome: true, fetches: true }`.

Two fields rather than one boolean because *no chrome* and *no requests* are different
claims, and conflating them is what let the sidebar render on `/signin`.

### `src/shared/ui/Card.tsx` — accent axis correction (Wave 1)

`accent` keeps its prop name (call sites already pass it) and changes what it draws:
a **2px inset top stripe**, not a 4px left border. `grep -c 'border-left:4px'` on the
export returns zero against five inset-top stripes, so six current call sites draw the
wrong axis.

```tsx
accent: "none" | "action" | "attend" | "halt" | "settled"
```

`settled` is new. Rendered as `border-t-(length:--stroke-accent) border-t-<tone>` with
a new `--stroke-accent: 2px` in `packages/ui-tokens`. The export spells it
`box-shadow: inset 0 2px 0`, which needs an arbitrary value; a top border is the
token-legal equivalent and is pixel-identical on an opaque card.

### `src/shared/ui/RefusalNudge.tsx` (Wave 1)

```tsx
export interface RefusalNudgeProps {
  /** What is missing, in the design's words. */
  message: string;
  /** id of the control this refusal is about — wires aria-describedby. */
  controlId: string;
}
export function RefusalNudge(props: RefusalNudgeProps): ReactElement;  // role="alert"
```

The highest-stakes item in the set: three of the eleven current sites omit the
`aria-describedby` link, so HANDOFF-UI §4.6 — a release blocker — is accessible on
some screens and not others. The component owns the id wiring so a call site cannot
forget it.

### Remaining Wave 1 primitives

```tsx
// ScreenHeading.tsx — absorbs app/ScreenTitle.tsx, keeps its link-to-hub behaviour
export interface ScreenHeadingProps {
  eyebrow: ReactNode; title: ReactNode; lede?: ReactNode;
  size?: "22" | "26"; actions?: ReactNode;
}

// ListRow.tsx
export interface ListRowProps { children: ReactNode; as?: "li" | "div"; interactive?: boolean; dense?: boolean; className?: string }
export interface DividedSectionProps { children: ReactNode; as?: "ul" | "div"; className?: string }

// PanelCard.tsx
export interface PanelCardProps { caption: ReactNode; band?: boolean; gap?: "2" | "4" | "6" | "8"; footer?: ReactNode; children: ReactNode }

// CensusTile.tsx — named "census", not "stat": §4.5 forbids rates, and the name
// is what makes a future `perHour` prop obviously refusable.
export interface CensusTileProps { value: ReactNode; caption: ReactNode; tone?: "muted" | "attend" | "halt" | "settled"; edge?: boolean }

// EmptyPanel.tsx — both mean *resolved and empty*, never *not loaded*
export interface EmptyPanelProps { title: ReactNode; body?: ReactNode; actions?: ReactNode }
export interface EmptyNoteProps { children: ReactNode }

// CenteredScreen.tsx — 1:1 extraction of a verbatim-identical wrapper, 4 sites
export interface CenteredScreenProps { measure: ScreenMeasure; children: ReactNode }

// ReasonEditor.tsx
export interface ReasonEditorField { name: string; label: string; placeholder?: string; multiline?: boolean }
export interface ReasonEditorProps {
  fields: readonly ReasonEditorField[];
  /** Returns the refusal message, or null when the form may submit. */
  refusal: (values: Record<string, string>) => string | null;
  submitLabel: string; tone?: "action" | "attend" | "halt";
  testId: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}
```

`ReasonEditor` keeps the earned behaviour: submit stays **enabled** and explains the
refusal on click (never a silently disabled button), Enter commits from inside a
field, Escape leaves — handled above the input guard so `[` typed in a field is still
text (`sidebar.spec`).

### `src/entities/nav/RailRow.tsx` (Wave 3)

```tsx
export interface RailRowProps {
  to: string; label: string; active: boolean; collapsed: boolean;
  attention: DoorAttention;
  /** The letter square or the numbered/checked stage dot. */
  marker: ReactNode;
  badge?: ReactNode;
  onNavigate: (to: string) => void;
}
```

`SidebarDoor.tsx:36-75` and `LifecycleRail.tsx:69-124` are ~35 of ~50 lines identical,
and **six separate audit findings land inside that duplicated block** — which is why
it is one component before any of them are fixed. Preserves the `rail-door-<path>`,
`rail-dot-<path>` and `rail-badge-<path>` testids exactly.

## Disputed signatures — RESOLVED HERE

The six wave plans were authored in parallel and drifted. A cross-plan audit
(`2026-07-30-consistency-audit.md`) found fourteen components declared with different
names or shapes in different waves, four consumed and never built, and a CLI every
downstream wave calls that Wave 0 deletes. **This section is the authority. Where a
wave plan disagrees with it, the plan is wrong and this wins.** Do not relitigate at
execution time — that is what produced the drift.

| Component | Resolution |
|---|---|
| `DecisionRow` | `{ field: Field; onActivate: () => void; selected?: boolean }`. **The whole row is the `<button>`**, not an `<li>` — the export's queue row is a bare button, and a row that is a button is reachable by one Tab rather than a nested control. Wave 3 builds this shape directly; Wave 4 does not restate it. |
| `PageSpine` | `{ cells: readonly PageSpineCell[]; currentPage: number; onSelect: (n: number) => void }`, tiers `read \| degraded \| partial \| unseen` — **four, not six**. `needs_you` and `cited` are REFUSED: they are a browser-side join over `Field.source_page` + `Field.state`, and `pageCoverage.ts`'s own contract says all tiers are server-supplied. If the export draws six, Wave 2 adds the two tiers to the coverage read shape and the server supplies them. |
| `ChoiceCardGrid` | `{ name: string; columns: 2 \| 3; options: readonly { id: string; title: string; sub?: string }[]; value: string \| null; onSelect: (id: string) => void }`. Renders **radios**, not `aria-pressed` buttons — a single-choice grid is a radio group, and `getByRole("radio")` is what the stories assert. |
| `OrderRow` | The tone prop is `stateEdge`, not `edge`. |
| `OrderMiniCard` | `{ ref: string; state?: string; waited: string; to?: string; mine?: boolean; tone?: ... }` — `state` not `stateLabel`, `waited` required. |
| `QuietState` | `{ tone: "settled" \| "attend"; headline: string; body: ReactNode; testId?: string }`. Keeps `testId` — the queue's call site needs it. |
| `shared/plural.ts` | One file, one export: `countOf(n, singular, plural?)`. Wave 5 does not create it; Wave 4 does. |
| `actionLabels.ts` | `actionPhrase(action: string): string | null`, returning **null** on an unmapped token so the caller decides how to render an action it has no words for. Wave 4 adopts that signature. Copy is Wave 5's: `field_corrected` reads `Amended claim`. |
| `SignoffLineTitle` | `{ n: number; label: string; as?: "h2" \| "h3"; className?: string }`, created in **Wave 3** (both consumers are Wave 4). |
| `GapCloseOption` | Wave 2's contract enum wins: `upload \| amend \| root_of_title \| change_product`, `min_role` nullable. Wave 4's testids follow it (`option-root_of_title`). |
| `SignoffAnswer` | The shipped contract is `"YES" \| "NO" \| "N/A"`. **`NA` is not a member** — the Wave 3 tone map and its fixture must spell it `"N/A"`. |
| `CensusTile` | `{ value; caption; tone?: "muted" \| "action" \| "attend" \| "halt" \| "settled"; size?: "strip" \| "board"; edge?: boolean }` — Wave 1's extension is adopted; the strip's 15px mono numerals need `size`. |
| `AppShell` | **Does not exist.** `rootRoute.tsx` inlines the frame; there was never enough in it to earn a component. Strike it from every plan's prerequisites. |
| `Button` | No `recessed` fill in this programme. Wave 4's unchosen-option styling uses `fill="tinted"`. `size` rungs are unchanged — no `section`. |
| `Eyebrow` | Variants are `field \| screen \| section \| group \| caption \| stat` plus Wave 1's `heading`. `cardHeading` and `cardTag` do not exist; use `heading` and `caption`. |
| `--stroke-accent` | Already exists at `tokens.css:392` as `3px`. Wave 1 changes the VALUE to 2px; it does not add the token. |
| `compare.mjs` | Wave 0 already shipped it: `node compare.mjs <screen-key\|all> [out-dir]`, and a selector miss **throws**. Every `compare.mjs <Label> <route> <out>` invocation in Waves 1, 3, 4 and 5 is dead and must be rewritten to the screen key (`queue`, `review`, `products`, `gallery`, `escalation`, `profile`, `session`, `signin`, …). |

**Four components are consumed but built by nobody.** Wave 1 gains them: `ContractGapNote`,
`QueryState`, `Quote`. (`SignoffLineTitle` moves to Wave 3, above.)

**Two ordering bugs to fix before executing:** Wave 5 Task 6 edits
`features/review/DecisionPanel.tsx`, which Wave 3 deletes — and its gate `readFileSync`s
the path with no existence guard, so it throws ENOENT and takes the whole gate down
rather than failing an assertion. Wave 5 Task 7 requires a comment in `AppChrome.tsx`
that Wave 3 moves to `entities/nav/flow.ts`.

**One rule conflict to settle by the rule, not the plan.** Wave 4 has `QueueBand`
refusing `orders.length` ("never a rate, never a second copy of a number the server
decided") and `RestOfQueue` mandating `rows.length` in the same wave. The rule holds:
a count that the server owns is read, never re-derived. If no contract field carries
the rest-of-queue count, render the label without a number and note the gap.

## Decisions already taken

Ruled by the owner 2026-07-30: all five waves in scope · fixtures fattened from one
shared set · Reader A/B collapsed to the export's single `AS READ` row with
attribution behind a disclosure · read-only contract shapes added now.

Taken in the spec, with reasons, and **not** to be relitigated by a wave plan: the
order still comes from the URL · door glyphs become label initials with the chord in
the row title and the `?` map · the `/escalations` rail door stays · `Pass — say why`
stays and the export is stale · ingest keeps two acts · the Overview board raises its
rail threshold to ~1190px · where the export's markup and render disagree the render
governs · the strip adopts the export's three count behaviours · a done stage may not
carry an open badge · both `LOCAL PREVIEW` toggles move to `features/gallery`.

## Out of scope

Q4–Q10 stay read-only. The four-member NA set stays unratified — the contract ships
two and this work does not settle it. C18's `excluded_reason` model is not revisited.
No write endpoints for the config layer. No theme work; both themes are done and
AA-verified.

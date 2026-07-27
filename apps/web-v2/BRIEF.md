# TitlePipe frontend — build `apps/web-v2` from scratch

> **Provenance.** This is the master prompt for the `apps/web-v2` rebuild, saved verbatim
> as the reference of record for this package. Where this document conflicts with
> `docs/HANDOFF.md`, `docs/CONTEXT.md`, or `docs/PRD.md`, those remain authoritative on
> **domain and backend** facts; this document is authoritative on **how the frontend is built**.
>
> Deviations discovered against the actual repo are recorded in `apps/web-v2/BRIEF-DELTAS.md`.
> Do not silently reconcile them here — this file stays as issued.

---

## 1. What you are building

TitlePipe is an internal production system for a US title-abstracting business. Scanned county document packages (36–181 pages, mostly poor-quality scans) are machine-extracted into 132 structured fields. Human reviewers resolve the fields the machine is unsure about, and a formatted report is delivered to the client.

The reviewer loop is the product. A reviewer selects a field, sees the source evidence, and decides. Everything you build serves that loop.

Two facts that should govern every judgment call:

- **Correctness beats speed.** A wrong value shown confidently is the worst outcome — worse than an error, worse than a blank. This system exists because that failure kept happening.
- **Seconds matter enormously.** At target volume, one second saved per reviewed field is worth roughly one full-time salary. But never buy a second by showing something unverified.

## 2. The task

There is an existing UI at `apps/web/`. **It is dead.** It gets deleted at cutover. You are not migrating, adapting, or referencing its components.

Build a new app at `apps/web-v2/` as a fresh pnpm workspace package.

`design-export/` contains a **Claude Design package** — generated React + Tailwind for the new screens. The visual design is approved and final. Implement it faithfully. Do not copy its code.

## 3. Three absolute rules

**1. Never open a component file in `apps/web/`.** Not for reference, not for inspiration. You may read its tests (Phase 0) and nothing else. Every glance at old code turns into a negotiation with old code, and the result is a merge of two designs.

**2. Never copy a file, component, or block of JSX out of `design-export/`.** Read it, understand the visual result, close it, write the component yourself. Copying is what produces five near-identical buttons that then drift apart.

**3. Build bottom-up. Never screen-first.** Tokens → primitives → composites → screens. A screen may only be assembled from components that already exist. If a screen needs something new, stop, build it in the shared layer, then use it.

Rule 3 is the mechanism, not a preference. Screen-first development is the direct cause of duplicated components, inconsistent spacing, and eight versions of the same card.

## 4. Stack — install exactly this

Some of these differ from what you may consider standard. The reasons are noted; do not substitute.

```
react react-dom                      19.x
typescript                           5.9+
vite                                 8.x

@tanstack/react-router               routing, typed search params
@tanstack/react-query                5.101.x   NOT v6 — v6 does not exist for React
@tanstack/react-table
@tanstack/react-virtual

@hey-api/openapi-ts                  API client generation
openapi-typescript                   types from the OpenAPI schema

zustand                              ephemeral UI state ONLY

tailwindcss                          4.x       tokens are CSS vars under @theme
shadcn CLI, initialized on BASE UI   NOT Radix
class-variance-authority             variants
tailwind-merge clsx
lucide-react  sonner  cmdk

react-hook-form
valibot                              NOT zod
@hookform/resolvers

react-hotkeys-hook                   5.3.x — scoped shortcuts
react-zoom-pan-pinch                 page raster viewport
react-pdf                            REPORT PREVIEW ONLY, never source pages

vitest @vitest/browser
@testing-library/react
storybook @storybook/addon-vitest @storybook/addon-a11y
@playwright/test
msw                                  transitional
@axe-core/playwright

knip  size-limit  eslint  prettier
```

**Why these deviate from the obvious choice:**

- **Hey API, not `openapi-fetch`** — openapi-fetch is in maintenance mode per its maintainers. Hey API's TanStack Query plugin emits `queryOptions` objects rather than pre-baked hooks, which is required for the prefetch design in §7.
- **Base UI, not Radix** — Radix was acquired and development slowed, worst on Combobox and multi-select, which this app needs most.
- **Valibot, not Zod** — validation here is UI-only; Valibot is ~1.4 KB against Zod's ~17 KB and Standard Schema keeps the resolver API identical.
- **Storybook, not a hand-rolled gallery** — stories double as the component workshop, the a11y gate, visual regression targets, and portable component tests in Playwright.

**Do not install:** redux, axios, moment/dayjs/date-fns, lodash, framer-motion, next.js, any image-annotation library, any analytics or session-replay SDK, zod in the browser bundle.

## 5. Phases — stop and report at each boundary

### Phase 0 — Harvest the old tests. Before anything else.

`apps/web/` has 116 Playwright specs and 22 Vitest tests. Some assert product rules **written down nowhere else in this repository**. Deleting those does not delete a test; it deletes the rule.

Read every spec. Classify each in `docs/frontend/test-harvest.md`:

- **`INVARIANT`** — asserts a product rule. Survives; selectors get rewritten, assertions never weakened.
- **`STRUCTURAL`** — asserts old UI layout. Dies at cutover.
- **`ORPHAN RULE`** — asserts a rule you cannot find in `docs/CONTEXT.md`, `docs/PRD.md`, or `docs/frontend/PLAN.md`. Write it out as prose. These are the dangerous ones.

Anything protecting these is `INVARIANT`, never `STRUCTURAL`: judgments never auto-confirm · no approve-all · no value without provenance · NA states never collapsed · routing never computed client-side · actor identity never from a request body · PENDING rules inert · no throughput or ranking displays.

Copy `INVARIANT` and `ORPHAN RULE` specs into `apps/web-v2/e2e/invariants/`, skipped, each with a `TODO(rebuild)` naming its rule.

**Stop. Report.**

### Phase 1 — Tokens

Read the entire export first. All of it, before writing anything.

Extract into `packages/ui-tokens`: color scales, spacing, radii, shadows, type scale, font stacks, motion durations. Semantic names only — `--surface-evidence`, `--state-needs-review`. Never `--blue-500`, never a raw hex outside this package. Wire into the Tailwind v4 `@theme` block.

After this phase, a hex code, a raw pixel value, or an arbitrary Tailwind value anywhere in `apps/web-v2` is a defect. Add CI greps for `#[0-9a-fA-F]{3,6}` and `\[[0-9]+px\]` outside `packages/ui-tokens`.

**Stop. Report.**

### Phase 2 — Duplication audit and design classification

Before building anything, inventory every visual pattern in the export and count how many screens use it.

`docs/frontend/component-inventory.md`:

| Pattern | Screens using it | Variants observed | Target component | shadcn base |

Patterns appearing 3+ times with small differences become **one component with `cva` variants**, never forked files. This phase determines whether the codebase is good or bad, and it is far cheaper to fix on paper.

Simultaneously classify every element into exactly one bucket:

- **`RENDER`** — layout, spacing, hierarchy, type, color, icons, empty/loading/focus states. Implement as drawn.
- **`RULE`** — implies a behavior the backend must own. Do not implement. Log as a ruling ticket.
- **`CONFLICT`** — breaks a hard constraint in §9. Do not implement. Log for redraw.

Also diff the state vocabulary: every visual state the design draws for a field, an order, an upload, against the real state machines in `docs/CONTEXT.md`. Report gaps in **both** directions.

**Stop. Report.**

### Phase 3 — Primitives

Build `apps/web-v2/src/shared/ui/` on shadcn + Base UI. Each primitive:

- Built **once**, used everywhere
- Variants via `cva`, never duplicated class strings
- **Purely presentational** — no data fetching, no Query import, no Router import
- Typed props, no `any`, no non-null assertions
- Keyboard reachable, visible focus ring, correct ARIA
- Under 150 lines
- A Storybook story per variant and state, including loading, empty, error, disabled, focused

**Stop when the Storybook is complete. Report.**

### Phase 4 — Composites

Domain-aware, still presentational: `FieldRow`, `ProvenancePanel`, `PageOverlay`, `DecisionBar`, `OrderStatusChip`, `NAValue`. Composed from Phase 3 primitives only. Same rules. Stories for each.

### Phase 5 — Screens

Only now. Each screen is assembly plus data wiring and should read almost like markup. If you are writing significant layout or styling inside a screen file, a component is missing — go back to Phase 3 or 4.

Features fetch; components render. A feature owns its Query hooks, route, and wiring. Presentational components stay ignorant of where data came from.

As each feature lands, un-skip the harvested `INVARIANT` specs covering it and make them pass. **Rewrite selectors; never weaken an assertion.** If an invariant cannot pass against the new design, that is a `CONFLICT` in the design — stop and report.

### Phase 6 — Cutover

When every harvested invariant is green and the screens are reviewed: switch the build target, delete `apps/web/` in one commit, rename `web-v2` to `web`. Not before.

## 6. Code quality bar

| Rule | Enforcement |
|---|---|
| No file over 150 lines | CI line count |
| No component over ~7 props | review — more means wrong decomposition |
| Zero hardcoded colors, spacing, radii, font sizes | CI grep |
| No duplicated Tailwind class strings — use `cva` | review |
| Presentational components never import Query or Router | CI import lint |
| No prop drilling past 2 levels — compose instead | review |
| No `any`, no `!`, no `@ts-ignore` | tsc strict |
| Unions handled exhaustively with a `never` guard | tsc |
| No inline styles, no `!important` | CI grep |
| No `utils.ts` / `helpers.ts` / `common.ts` | CI grep |
| `features/` never import each other | AST test |
| No `localStorage` or `sessionStorage` | CI grep |
| No `new Date(` outside one audited date utility | CI grep — see §8 |
| Names describe role, not appearance | review — `FieldDecisionBar`, not `BlueButtonRow` |
| Every interactive element keyboard reachable | axe on Storybook and every route |

Simple beats clever. No abstraction until the third use. No generic component taking a config object to render anything. If a junior developer cannot read a file top to bottom and understand it, rewrite it.

## 7. Architecture

**Layers:** `routes/` (guards and loaders only, no logic) → `features/` (isolated, never import each other) → `entities/` → `shared/`. Cross-feature sharing goes through `entities/` or `shared/` only.

**Four state homes, strictly:**

| Kind | Home | Persists reload? |
|---|---|---|
| Server data | TanStack Query | via cache |
| Selection, filters, current page | URL search params | yes, and shareable |
| Ephemeral UI (pane state, modes) | Zustand slice | no |
| In-progress form | react-hook-form | no |
| Session | HttpOnly cookie | yes, invisible to JS |
| User preferences, pane widths | server, `GET/PATCH /api/me/preferences` | yes |

Server data never enters Zustand. One slice per feature at `features/<name>/store.ts`, typed hook plus explicit actions, narrow selectors, no `persist` middleware.

Selection lives in the URL because a stuck reviewer must be able to send a senior a link to the exact field: `/orders/:id/review?field=CONS_PRIOR_DEED&page=47`.

**Contract layers:**

```
OpenAPI → generated TS types   →  wire shapes, authoritative
Python + Postgres              →  refusals and authority, server-side
Valibot in the browser         →  form feedback only, never authority
```

Every Valibot rule must have a server counterpart. Add a test that posts each form's invalid states straight to the API and asserts a 422 — that is what proves the client layer is a mirror and not a load-bearing wall.

Data comes from `packages/mocks` (MSW) until the backend is ready. Reuse it; do not fork it. Retiring MSW is separate, later work, route by route.

**Review workstation** is the highest-value screen. All 132 fields with full provenance and the complete cited-page manifest load in **one bootstrap request**. Cited page rasters are prefetched while the reviewer reads the first field. After that, field-to-field movement touches no network.

**Coordinate overlay:** do not install an annotation library — those are editors for drawing boxes, and you need read-only display of boxes the backend computed. Build it: `react-zoom-pan-pinch` for the viewport, absolutely-positioned elements or SVG for boxes, coordinates transformed by current scale. Roughly 150 lines.

**Keyboard scopes:** register one `react-hotkeys-hook` scope per pane, activated on focus. Without scoping you get the classic bug where typing a correction triggers a navigation shortcut.

## 8. Domain traps

**Dates.** Recording dates are legally significant. `new Date("2024-03-15")` parses as UTC midnight and renders as **03/14/2024** in any negative-offset timezone. A recording date one day early in a delivered report is a real client-facing defect. Never construct a `Date` from a server date string. Treat dates as opaque strings; format `YYYY-MM-DD` → `MM/DD/YYYY` by string manipulation or `Temporal.PlainDate`.

**Money.** The server sends integer cents or a decimal string. Never a float, never `parseFloat`, never arithmetic in the browser. Format and display only.

**Provenance.** Every field value carries source document, page, snippet, and coordinates. A value with missing provenance renders as a **hard error**, never a blank and never a bare value. Show `value_raw` and `value_normalized` as separate values, never merged.

**The NA union.** Four distinct concepts — structurally absent, not found, not stated, present but unreadable. Which set ships is an **unresolved ruling**. Implement as a four-member discriminated union with an exhaustive `switch` and a `never` guard, so any future change is a compile error rather than a silent fallthrough.

**Engine confidence.** Display as context only, visually subordinate. It is not an auto-confirm gate on the backend and must not read like a recommendation.

## 9. Hard constraints — release blockers

1. Never derive product rules from UI code or pixels
2. Never render a value without provenance
3. Never collapse the NA states
4. Never compute review routing in the browser
5. Never show engine confidence as a recommendation
6. No approve-all, bulk-confirm, or accept-remaining — the component must not exist
7. No throughput counters, reviewer rankings, streaks, or accuracy headlines
8. No queue cherry-picking — server-owned sort
9. No client-side state machine — no `canTransition`, no status derivation
10. No optimistic updates on field decisions — the server's returned state is the truth
11. Nothing in `localStorage` or `sessionStorage`
12. No session replay; no field values, names, addresses, or signed URLs in telemetry
13. Judgment fields never auto-confirm — no UI path reaches that state
14. Valibot is UI-only; every client rule needs a server counterpart

## 10. What the export will contain

The design is generated code. The *visuals* are approved. Every *behavior* in it was invented by a generator, not decided by the business — thresholds, validation rules, state names, "auto" actions, field lists, error strings. It will look plausible and be internally consistent and still be wrong.

Expect each of these. Implement the visual, drop the behavior, log it:

confidence badge presented as a recommendation (5) · approve-all (6) · reviewer stats or leaderboards (7) · client-side status derivation (9) · `needsReview` from a threshold (4) · client-only validation (14) · `localStorage` (11) · optimistic confirm (10) · two-state N/A (3) · values with no citation (2) · realistic mock party names and addresses — replace with obviously synthetic fixtures · analytics snippets (12).

Two survive review most often because they look like good design: **the confidence badge**, which converts an engine's self-report into a visual endorsement, and **optimistic confirm**, which shows a reviewer a decision the server has not accepted.

Also expect **no `failed_recoverable` and no `held` states** anywhere in the export. Generators design the happy path. Those two are where operations staff live on a bad day — report the gap and design them.

## 11. Deliverables

1. `docs/frontend/test-harvest.md` — every spec, classification, the rule it protects
2. `packages/ui-tokens/` + `docs/frontend/tokens.md`
3. `docs/frontend/component-inventory.md` — the duplication audit
4. `docs/frontend/design-classification.md` — element → bucket → constraint → action
5. Storybook — every component, every variant and state
6. `docs/frontend/open-rulings.md` — behaviors the design implies that the backend must rule on
7. `docs/frontend/conflicts.md` — behaviors dropped, with the constraint each broke
8. `docs/frontend/state-coverage.md` — states the design never drew

## 12. Stop and ask

Phases 0, 1, 2, and 3 each end with a mandatory stop. Also stop when:

- A spec's classification is ambiguous between `INVARIANT` and `STRUCTURAL`
- An element is ambiguous between `RENDER` and `RULE`
- You want to create a second component that resembles an existing one
- A screen needs something not in the component inventory
- The design implies a field, state, or action absent from the backend schema
- A harvested invariant cannot be satisfied by the new design
- You are about to write a value, threshold, count, or label sourced only from the design
- You catch yourself thinking "the design must have had a reason for this"

That last one matters most. When you are justifying an invented behavior because it looks deliberate, stop. **A generator's output is exactly as confident when it is wrong.**

## 13. Anti-goals

Do not touch `apps/web/` except to read its tests. Do not copy from `design-export/`. Do not fork `packages/mocks`. Do not substitute packages in §4. Do not upgrade dependencies. Do not add a state management library. Do not add SSR. Do not build a screen before its components exist. Do not weaken a harvested invariant to make it pass. Do not implement screens whose `RULE` elements are unresolved.

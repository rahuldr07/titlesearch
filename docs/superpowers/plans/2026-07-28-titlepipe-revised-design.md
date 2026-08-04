# TitlePipe Revised-Design (2026-07-28) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/web-v2` from the old cool/violet design into faithful agreement with the revised 2026-07-28 design export (warm-archival palette, left sidebar, two themes, the tightened Review + correction + rulebook semantics), screen by screen.

**Architecture:** This is a *delta on the existing build*, not a rebuild (HANDOFF-UI §1, §5 "architecture to keep"). All 94 colour tokens are semantic and read by name, so the reskin is a values-only rewrite of `packages/ui-tokens/src/tokens.css` plus a second `[data-theme="mocha"]` block — **no component's colour classes change**. The navigation moves from top chrome to a collapsible left rail. Review gains a coverage spine and a section rail/decision dock. Everything else is a per-screen fidelity pass driven by `compare.mjs`.

**Tech Stack:** React 19 · TS 6 strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly`) · Vite 8 · Tailwind v4 · TanStack Query/Router/Table/Virtual · react-hook-form + valibot · zustand (ephemeral UI only) · react-hotkeys-hook · Vitest · Playwright · MSW 2 · Zod contract in `packages/contract`.

## Global Constraints

Every task's requirements implicitly include these. They are gates, not advice.

- **No raw hex outside `packages/ui-tokens`.** Colour reaches TSX only through semantic token classes. `check:rules` rejects hex in TSX.
- **Token NAMES never change.** The revision changes values only — `--violet` is still the primary accent, it is now navy (§11). A palette change must not rename a token.
- **No arbitrary Tailwind values, no inline `style`, no `!important`, no browser storage, no TS escape hatches, no cross-feature imports.** `check:rules` enforces all of these. A `rules-allow:` escape needs a reason ≥12 chars.
- **150 lines per file, hard.** Split by responsibility when a file approaches it.
- **Nothing in localStorage/sessionStorage** (rule §8). Preferences persist via `GET/PATCH /api/me/preferences`. The MSW mock's own `sessionStorage` stand-in is not app code and is exempt.
- **No new value without provenance; never collapse the NA states; server owns every state machine** (rules §1–3). None of this plan derives backend state from the UI.
- **Refusals need reasons; judgments never auto-confirm; no approve-all/bulk/queue-cherry-pick; no throughput counters/timers/accuracy headline** (rules §4–7).
- **Every response parses through a `@titlepipe/contract` schema at `src/shared/api.ts`.** Never widen a contract type locally — emit a `CONTRACT GAP:` comment.
- **Verification runs the whole gate, every task** (§10): `pnpm --filter web-v2 typecheck && check:rules && lint && test && test:e2e && knip`, then root `pnpm typecheck`. A green suite is not evidence the UI is right — the fidelity pass (Task group 7) uses `compare.mjs`.
- **The rule picker on the escalation screen stays a native `<select>`** (Playwright `selectOption` only drives native). **Keep earned behaviour:** `DestructiveConfirm` moves focus when it arms; `RequiredComment` keeps submit enabled and explains the refusal on click; NA renders survive greyscale.

**Authoritative revised palette** (extracted from `design-export/TitlePipe.dc.html` `:root`, 2026-07-28):

```
--ground  #eae7e0   --panel  #fdfcfa   --panel2 #f7f4ee   --paper #fbfaf5
--ink     #201f1d   --ink2   #585349   --ink3   #8b857a
--rule    #d9d4c9   --rule2  #eae6de
--violet  #2e4272   --violet-ink #1f2f57  --violet-tint #e9ecf4  --violet-tint2 #d2dae9
--green   #2f6d46   --green-tint #e5efe7  --green-edge  #c2d8c6  --green-deep  #22553a
--red     #9c2b1e   --red-tint   #f8e8e4  --red-edge    #e8cdc5  --red-ink     #7c2016
--amber   #8a6413   --amber-tint #f6eed6  --amber-edge  #e2d2a6  --amber-deep  #6b4f10
--marker  rgba(240,201,92,.45)   --marker-edge #c2922b
```

**Mocha dark theme anchors** (HANDOFF-UI §8; deviate from stock where AA fails, and say where):

```
surface-app base #1e1e2e · surface-panel surface0 #313244 · surface-sunken mantle #181825
line-subtle surface1 #45475a · line-strong surface2 #585b70 · scrim crust #11111b
ink-primary text #cdd6f4 · ink-secondary subtext1 #bac2de · ink-muted subtext0 #a6adc8
action mauve #cba6f7 · state-settled green #a6e3a1 · state-attend peach #fab387 · state-halt red #f38ba8
```

Three theme decisions taken (§8): the **document does not invert** (`--color-surface-paper` pinned light in both themes — a scan is a photograph of paper); **strict AA applies to both** (`src/shared/contrast.test.ts` must pass twice); **default is TitlePipe light**, Mocha opt-in, persisted via preferences.

---

## File Structure

**Rewritten (values only, names frozen):**
- `packages/ui-tokens/src/tokens.css` — new light values under `@theme`; new `[data-theme="mocha"]` block; `--font-sans` → Libre Franklin.

**Replaced (top chrome → left rail):**
- `apps/web-v2/src/app/AppChrome.tsx` → a left-sidebar shell.
- `apps/web-v2/src/app/ScreenMenu.tsx` → rail nav (keeps `doorsFor` authz logic).
- `apps/web-v2/src/app/AccountMenu.tsx` → rebuilt to fix the Base-UI unmount throw (the `authz.spec` `fixme`).
- New: `apps/web-v2/src/entities/nav/Sidebar.tsx`, `SidebarDoor.tsx`, `LifecycleRail.tsx` (each <150 lines).

**Extended:**
- `packages/contract/src/intake.ts` — add `theme` to the preferences schema (beside `nav_collapsed`).
- `packages/mocks/**` — mock `GET/PATCH /api/me/preferences` echoes `theme`.
- `apps/web-v2/src/features/review/**` — coverage spine + section rail/decision dock components.
- `apps/web-v2/src/features/review/**` correction field — `e` enters field, submit inert unless changed, Enter/Esc.
- `apps/web-v2/src/features/rulebook/**` — pending chip copy, citation field, retire preview.
- `apps/web-v2/src/features/*/**` finalize block — restructure, move abstractor-said-NO cards.

**Tests touched/recovered:**
- `apps/web-v2/e2e/invariants/sidebar.spec.ts` — un-skip and re-point at the rail; recover the 3 invariants deleted 2026-07-29 for the new door set.
- `apps/web-v2/src/shared/contrast.test.ts` — must pass for both themes.
- New specs per feature task below.

---

## Task 1: Warm-archival light palette + Libre Franklin

**Files:**
- Modify: `packages/ui-tokens/src/tokens.css` (the `@theme` block, lines 30–482; `--font-sans` line 266)
- Test: `apps/web-v2/src/shared/contrast.test.ts` (existing — must stay green)

**Interfaces:**
- Consumes: the authoritative revised palette (Global Constraints).
- Produces: unchanged token *names*; every component downstream reskins with zero edits.

**Mapping (design raw → semantic token, the 1:1 set).** Apply these exact values; leave the name and its comment intact:

| token | new value | from |
|---|---|---|
| `--color-surface-app` | `#eae7e0` | `--ground` |
| `--color-surface-panel` | `#fdfcfa` | `--panel` |
| `--color-surface-sunken` | `#fbfaf5` | `--paper` |
| `--color-surface-raised` / `--color-row-hover` | `#f7f4ee` | `--panel2` |
| `--color-surface-paper` | `#fbfaf5` | `--paper` |
| `--color-ink-primary` | `#201f1d` | `--ink` |
| `--color-ink-secondary` | `#585349` | `--ink2` |
| `--color-line-strong` | `#d9d4c9` | `--rule` |
| `--color-line-subtle` | `#eae6de` | `--rule2` |
| `--color-action` / `--color-state-decide` | `#2e4272` | `--violet` |
| `--color-action-ink` | `#1f2f57` | `--violet-ink` |
| `--color-action-surface` / `--color-state-decide-surface` | `#e9ecf4` | `--violet-tint` |
| `--color-action-border` / `--color-state-decide-border` | `#d2dae9` | `--violet-tint2` |
| `--color-page-ref` | `#2e4272` | `--violet` |
| `--color-page-ref-ink` | `#1f2f57` | `--violet-ink` |
| `--color-page-ref-surface` | `#e9ecf4` | `--violet-tint` |
| `--color-page-ref-border` | `#d2dae9` | `--violet-tint2` |
| `--color-state-settled` | `#2f6d46` | `--green` |
| `--color-state-settled-ink` | `#22553a` | `--green-deep` |
| `--color-state-settled-surface` | `#e5efe7` | `--green-tint` |
| `--color-state-settled-border` | `#c2d8c6` | `--green-edge` |
| `--color-state-attend` | `#8a6413` | `--amber` |
| `--color-state-attend-ink` | `#6b4f10` | `--amber-deep` |
| `--color-state-attend-surface` | `#f6eed6` | `--amber-tint` |
| `--color-state-attend-border` | `#e2d2a6` | `--amber-edge` |
| `--color-state-halt` | `#9c2b1e` | `--red` |
| `--color-state-halt-ink` | `#7c2016` | `--red-ink` |
| `--color-state-halt-surface` | `#f8e8e4` | `--red-tint` |
| `--color-state-halt-border` | `#e8cdc5` | `--red-edge` |
| `--color-surface-evidence` | `rgba(240,201,92,.45)` | `--marker` |
| `--color-border-evidence` | `#c2922b` | `--marker-edge` |

**Derived tokens (the ~43 with no design counterpart — AA fixes, idle, track, scan set, dark-pane set).** Do NOT copy the raw palette onto these blindly. Re-derive each against the warm ground so it keeps its stated *contract*, then let `contrast.test.ts` prove it:
- `--color-ink-muted`, `--color-na-*-ink` — the "recede" tier. Keep the AA fix intent: pick the warmest ink that clears **4.5:1** on `--color-surface-panel` `#fdfcfa` AND on `--color-surface-app` `#eae7e0`. Start from `--ink3 #8b857a` and darken until AA passes; record the measured ratios in the comment exactly as the current file does.
- NA border/hatch tokens — retint to the warm rules (`--rule`/`--rule2`) so the four NA states stay distinguishable in greyscale (border-style + hatch carry it, colour is secondary — rule §2).
- `--color-scrim` — keep as a dark translucent (`rgb(20 20 30 / .34)` is fine on warm ground; verify the modal backdrop reads).
- Scan/page set (`--color-scan*`, `--color-page*`, `--color-page-ink`, `--color-scan-ink*`) — the scanned page is a photograph; leave near its current warm values, unaffected by the UI reskin.
- Dark-pane measurement set (`--color-document-*`) — **only if those screens still exist** (Phase 0 deleted "every screen the export does not draw"; confirm with `grep -rl "surround" apps/web-v2/src`). If unused, `knip` will flag them — delete rather than retune.

**Font:** `--font-sans: "Libre Franklin", system-ui, sans-serif;` Keep `--font-mono` (IBM Plex Mono) and `--font-quote` (serif = human testimony) unless the design shows otherwise. Add the Libre Franklin `@font-face`/import where the app loads fonts (`apps/web-v2/index.html` or `src/index.css` — match how IBM Plex is loaded today; **self-host or use the existing font pipeline, no new external CDN** unless one is already used).

- [ ] **Step 1: Confirm the contrast gate covers the tier that will move.** Run: `pnpm --filter web-v2 test shared/contrast.test.ts` — Expected: PASS on the current palette (baseline).
- [ ] **Step 2: Apply the 1:1 mapping table** to `tokens.css`. Values only; comments and names untouched.
- [ ] **Step 3: Re-derive the muted/NA ink tier** against the warm ground; write the measured ratios into the existing comment block.
- [ ] **Step 4: Run the contrast gate.** Run: `pnpm --filter web-v2 test shared/contrast.test.ts` — Expected: PASS. If a token fails AA, darken it (never weaken the test) and re-record.
- [ ] **Step 5: Swap the font** to Libre Franklin and wire loading the same way IBM Plex is wired.
- [ ] **Step 6: Full gate.** Run: `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip` — Expected: all PASS. (No hex escaped into TSX; no name changed.)
- [ ] **Step 7: Eyeball two screens** to catch a wrong-way-round surface (rule trap §6: `--color-surface-document` is the backdrop, `--color-surface-paper` is the page). Run: `pnpm --filter web-v2 dev`, open `/queue` and `/orders/ord_demo_1/review`. The document pane must read as paper, not a data slab.
- [ ] **Step 8: Commit.**
```bash
git add packages/ui-tokens/src/tokens.css apps/web-v2/index.html apps/web-v2/src/index.css
git commit -m "Reskin to the warm-archival palette and Libre Franklin"
```

---

## Task 2: Catppuccin Mocha dark theme

**Files:**
- Modify: `packages/ui-tokens/src/tokens.css` (add a `[data-theme="mocha"]` block after `@theme`)
- Test: `apps/web-v2/src/shared/contrast.test.ts` (extend to run twice)

**Interfaces:**
- Consumes: Mocha anchors (Global Constraints). The document (`--color-surface-paper`) does NOT invert.
- Produces: a second complete value block under the same names. `[data-theme="mocha"]` on `<html>` selects it.

- [ ] **Step 1: Write the failing test.** Extend `contrast.test.ts` so every AA assertion runs for both themes. Add at the top of the token-reading helper a `themes = ["light", "mocha"] as const` loop; read the Mocha values from the new block. Example assertion shape:
```ts
for (const theme of ["light", "mocha"] as const) {
  test(`ink-primary clears AA on panel — ${theme}`, () => {
    expect(ratio(token("ink-primary", theme), token("surface-panel", theme))).toBeGreaterThanOrEqual(4.5);
  });
}
```
- [ ] **Step 2: Run it — Expected: FAIL** (no `[data-theme="mocha"]` block yet, `token(...,"mocha")` returns undefined).
- [ ] **Step 3: Add the Mocha block.** Every token from `@theme` gets a Mocha value. Surfaces layer *upward* from base (panels go lighter). Pin `--color-surface-paper` to its light value. Where stock Catppuccin fails AA (e.g. `overlay0 #6c7086` ≈4:1 body text is marginal), deviate to a lighter subtext and note the deviation in a comment.
- [ ] **Step 4: Run the gate twice — Expected: PASS for both themes.** Fix by deviating (lighter ink), never by lowering the threshold.
- [ ] **Step 5: Full gate** (as Task 1 Step 6). Expected: all PASS.
- [ ] **Step 6: Commit.**
```bash
git add packages/ui-tokens/src/tokens.css apps/web-v2/src/shared/contrast.test.ts
git commit -m "Add the Catppuccin Mocha dark theme, AA-verified in both themes"
```

---

## Task 3: `theme` preference in the contract + mock

**Files:**
- Modify: `packages/contract/src/intake.ts` (the preferences schema, ~line 222 where `nav_collapsed` lives)
- Modify: `packages/mocks/**` (the `/api/me/preferences` handler)
- Test: `packages/contract/**` schema test (add a case) + a mock round-trip

**Interfaces:**
- Consumes: nothing new.
- Produces: `MePreferences.theme: "titlepipe" | "mocha"` (valibot/zod enum, default `"titlepipe"`). Task 4 wires the toggle to it.

- [ ] **Step 1: Write the failing test** — the preferences schema accepts and defaults `theme`:
```ts
test("preferences carry a theme, default titlepipe", () => {
  const p = MePreferencesSchema.parse({ nav_collapsed: false });
  expect(p.theme).toBe("titlepipe");
  expect(() => MePreferencesSchema.parse({ nav_collapsed: false, theme: "mocha" })).not.toThrow();
  expect(() => MePreferencesSchema.parse({ nav_collapsed: false, theme: "neon" })).toThrow();
});
```
- [ ] **Step 2: Run it — Expected: FAIL** (`theme` unknown / no default).
- [ ] **Step 3: Add `theme`** to the schema beside `nav_collapsed`, enum `["titlepipe","mocha"]`, default `"titlepipe"`. Match the file's existing schema style (zod vs valibot — the contract uses zod per §5; mirror the surrounding fields exactly).
- [ ] **Step 4: Echo it in the mock.** The `PATCH /api/me/preferences` mock persists `theme` in its sessionStorage stand-in (the mock's DB, not app storage); `GET` returns it.
- [ ] **Step 5: Run — Expected: PASS.** Contract test + a mock round-trip test (`GET` after `PATCH` returns the set theme).
- [ ] **Step 6: Full gate + root typecheck.** Run: `pnpm typecheck && pnpm --filter web-v2 test` — Expected: PASS.
- [ ] **Step 7: Commit.**
```bash
git add packages/contract/src/intake.ts packages/mocks
git commit -m "Add a persisted theme preference to the contract and mock"
```

---

## Task 4: Left sidebar — replace the top chrome

**Files:**
- Create: `apps/web-v2/src/entities/nav/Sidebar.tsx`, `SidebarDoor.tsx`, `LifecycleRail.tsx`
- Modify: `apps/web-v2/src/app/AppChrome.tsx` (host the sidebar, not a top strip), `apps/web-v2/src/app/ScreenMenu.tsx` (keep `doorsFor`/authz, render into the rail), `apps/web-v2/src/app/rootRoute.tsx` (layout: rail beside content)
- Modify: `apps/web-v2/src/app/AccountMenu.tsx` (fix the unmount throw — see Task 5; the menu now lives in the rail foot)
- Test: `apps/web-v2/e2e/invariants/sidebar.spec.ts` (un-skip, re-point at the rail)

**Interfaces:**
- Consumes: `theme`/`nav_collapsed` from `/api/me/preferences` (Task 3); `doorsFor(path, role)` authz (unchanged — a path with NO authz row is OPEN, trap §6).
- Produces the testid contract `sidebar.spec` asserts: `data-testid="side-rail"` with `data-collapsed="0|1"`; `data-testid="rail-toggle"`; `data-testid="rail-door-<path>"` per door.

**Design spec (§11):** 232px wide, **78px collapsed** (sized so the icon target clears 44px after the scrollbar). Row height 40px wide / 44px collapsed. Collapse is **forced** at narrow widths (binding constraint is the *container*, not the viewport — trap §6). **Starts collapsed on Review** (that screen needs every pixel); an explicit user toggle wins from then on and is never overridden. Items carry an initial-letter icon when collapsed and a badge when wide, with red/amber tones. Grouped, plus a lifecycle "flow" rail. Fold key is `[` (react-hotkeys-hook does NOT recognise `[` — match on the character with an explicit keydown listener + input guard, trap §6); `[` typed in a text field is text.

- [ ] **Step 1: Recover the deleted invariants.** `git show ade49af:apps/web/e2e/sidebar.spec.ts` (the pre-rebuild source named in the spec header). Recover the 3 invariants dropped 2026-07-29 (attention **dots not counts**; **absent door not dimmed**; **no rail on the capture seat**) and re-point them at the new door set. Do not recover the ones tied to screens Phase 0 deleted (`/dashboard`, `/bench`, `/leaderboard`, `/complaints`) — confirm each door still exists as a route before keeping its assertion.
- [ ] **Step 2: Un-skip the four surviving `sidebar.spec` tests** and run — Expected: FAIL (no `side-rail` testid; today it is top chrome).
- [ ] **Step 3: Build `Sidebar.tsx`** — the rail container: `data-testid="side-rail"`, `data-collapsed`, width 232/78px, renders grouped `SidebarDoor`s from `doorsFor`, the `LifecycleRail`, and the account menu at the foot. Collapse state from the `nav_collapsed` preference; toggle (`rail-toggle`) PATCHes it. Forced-collapse via a container query / ResizeObserver on the rail's own container, not `window.innerWidth`.
- [ ] **Step 4: Build `SidebarDoor.tsx`** — one door: `data-testid="rail-door-<path>"`, initial-letter icon when collapsed, label + badge when wide, active marking, red badge for a complaint / amber for a gap (dot when collapsed, per the recovered invariant — red pulses via `tp-act-ring`, amber is still).
- [ ] **Step 5: Build `LifecycleRail.tsx`** — the flow rail (the lifecycle stages as a compact vertical flow). Read shape only; no client-derived stage state (rule §3).
- [ ] **Step 6: Wire the `[` fold** — explicit keydown listener on the character with an input guard so a bracket typed in a correction field is text (trap §6, and `sidebar.spec` #2/#5). Start-collapsed-on-Review: initialise from the route on first mount only, then defer to the persisted preference.
- [ ] **Step 7: Run `sidebar.spec` — Expected: PASS** (fold, fold-persists-via-preference, `[`-in-field-is-text, plus the 3 recovered invariants).
- [ ] **Step 8: Full gate + `compare.mjs`.** Run the gate, then `node apps/web-v2/compare.mjs Queue /queue ../../shots` and look: rail present, widths right, badges toned, nothing truncated (trap §6: container starvation shows identically at all widths).
- [ ] **Step 9: Commit.**
```bash
git add apps/web-v2/src/entities/nav apps/web-v2/src/app apps/web-v2/e2e/invariants/sidebar.spec.ts
git commit -m "Replace the top chrome with the collapsible left sidebar"
```

---

## Task 5: Fix the account menu unmount throw

**Files:**
- Modify: `apps/web-v2/src/app/AccountMenu.tsx`
- Test: `apps/web-v2/authz.test.ts` (the `fixme`'d engineer-gate test)

**Interfaces:**
- Consumes: the account-menu trigger in the rail foot (Task 4).
- Produces: an account menu that opens without unmounting the chrome; `aria-haspopup="menu"`, `aria-expanded` toggles.

The trap (§6): clicking Base UI's `Menu.Trigger` throws inside render and unmounts the whole chrome; the throw is swallowed. Fix it when the menu component is replaced — the handoff §7 permits swapping the kit component here (shadcn/Radix dropdown-menu is the standing recommendation and is already partially installed: `lucide-react`, `cmdk`, `cva`, `clsx`, `tailwind-merge` present).

- [ ] **Step 1: Un-`fixme` the engineer-gate test** in `authz.test.ts` and run — Expected: FAIL (menu unmounts / assertion on the opened menu fails).
- [ ] **Step 2: Reproduce** in `pnpm --filter web-v2 dev` — click the account trigger, confirm the chrome disappears and the console/error boundary swallows a throw.
- [ ] **Step 3: Replace the menu** with the chosen headless menu (Radix/shadcn dropdown-menu), preserving `aria-haspopup="menu"` and `aria-expanded`, and the existing items (Profile, Sign out, theme toggle — wire the Task 3 `theme` here as the theme switch).
- [ ] **Step 4: Run — Expected: PASS.** Menu opens, chrome stays mounted, the engineer gate passes.
- [ ] **Step 5: Full gate.** Expected: all PASS (including `knip` — remove the now-unused Base UI menu if nothing else uses it).
- [ ] **Step 6: Commit.**
```bash
git add apps/web-v2/src/app/AccountMenu.tsx apps/web-v2/authz.test.ts
git commit -m "Fix the account menu unmount and un-fixme the engineer gate"
```

---

## Task 6: Review — coverage spine

**Files:**
- Create: `apps/web-v2/src/features/review/CoverageSpine.tsx` (+ a legend/summary subcomponent if it crosses 150 lines)
- Modify: the Review screen layout to host it; fixtures in `packages/mocks` (coverage over *all* pages, never a screen constant)
- Test: `apps/web-v2/src/features/review/CoverageSpine.test.tsx` + an e2e assertion

**Interfaces:**
- Consumes: a coverage shape from the mock parsed through the contract — per-page coverage across **all** pages of the package (not just pages a reader typed). If the contract has no such shape, emit a `CONTRACT GAP:` note and add the read-only GET to the contract + mock first.
- Produces: `Coverage · all N pages` with a legend and summary; answers "what have I not looked at".

- [ ] **Step 1: Write the failing test** — the spine renders one cell per package page and a total:
```tsx
test("coverage spine covers every page, not just read ones", () => {
  render(<CoverageSpine coverage={fixtureCoverage} />); // fixture: 64 pages
  expect(screen.getByText(/Coverage · all 64 pages/)).toBeInTheDocument();
  expect(screen.getAllByTestId("coverage-cell")).toHaveLength(64);
});
```
- [ ] **Step 2: Run — Expected: FAIL** (component absent).
- [ ] **Step 3: Build `CoverageSpine.tsx`** — cell per page, legend, summary line. Colour via state tokens only. Document WHY in house style (what rule it enforces: coverage is over the whole package, the read-pages chip strip could not answer this — §11).
- [ ] **Step 4: Run — Expected: PASS.**
- [ ] **Step 5: Full gate + compare.** `node apps/web-v2/compare.mjs Review /orders/ord_demo_1/review ../../shots` — spine matches the design's legend/summary.
- [ ] **Step 6: Commit.**
```bash
git add apps/web-v2/src/features/review packages/mocks
git commit -m "Add the Review coverage spine over the whole package"
```

---

## Task 7: Review — section rail & decision dock

**Files:**
- Create: `apps/web-v2/src/features/review/SectionRail.tsx`, `DecisionDock.tsx`
- Modify: Review layout to host both
- Test: `apps/web-v2/src/features/review/SectionRail.test.tsx`, `DecisionDock.test.tsx`

**Interfaces:**
- Consumes: report sections + decision progress from the mock via the contract; `Rest of the queue · N` count (server-owned; never re-derived client-side, rule §3).
- Produces: jump-to-section nav; decision progress; `Rest of the queue · N`.

- [ ] **Step 1: Write the failing tests** — section rail lists sections and jumps; dock shows progress + queue remainder:
```tsx
test("section rail jumps to a report section", async () => {
  render(<SectionRail sections={fixtureSections} />);
  await userEvent.click(screen.getByRole("link", { name: /Ownership/ }));
  expect(location.hash).toBe("#section-ownership");
});
test("decision dock shows the queue remainder from the server", () => {
  render(<DecisionDock progress={fixtureProgress} restOfQueue={7} />);
  expect(screen.getByText(/Rest of the queue · 7/)).toBeInTheDocument();
});
```
- [ ] **Step 2: Run — Expected: FAIL.**
- [ ] **Step 3: Build both** — `SectionRail` (jump nav), `DecisionDock` (progress + `Rest of the queue · N`). No throughput/rate/timer (rule §5) — a count of what is left is fine, a rate is not. Document WHY.
- [ ] **Step 4: Run — Expected: PASS.**
- [ ] **Step 5: Full gate + compare** (Review route).
- [ ] **Step 6: Commit.**
```bash
git add apps/web-v2/src/features/review
git commit -m "Add the Review section rail and decision dock"
```

---

## Task 8: Correction semantics — must-change, `e`-enters, Enter/Esc

**Files:**
- Modify: the Review correction field component (find via `grep -rl "edit-value" apps/web-v2/src`) and the keyboard layer (`apps/web-v2/src/app/GlobalKeys.tsx` / the review pane's key scope)
- Test: `apps/web-v2/src/features/review/*correction*.test.tsx` + the review e2e

**Interfaces:**
- Consumes: the field's machine-read value.
- Produces: a correction submit that is **inert until the value differs** from the machine read; `e` puts the caret **in** the field (does not commit); **Enter commits from inside, Escape leaves** — handled above the input guard so the field needs no handler of its own.

Semantics (§11): a correction must actually change something — empty, or identical to the machine read, is **refused**, not recorded as a no-op correction (this is rule §6, refusals need reasons, and the `min(1)`/diff contract; keep submit visible-but-inert, never a silent success). No optimistic update — a 409 is an answer, render the server message verbatim (rule §9).

- [ ] **Step 1: Write the failing tests:**
```tsx
test("e opens the field without committing", async () => {
  renderReviewField(machineValue: "SMITH");
  await userEvent.keyboard("e");
  expect(screen.getByTestId("edit-value")).toHaveFocus();
  expect(onCommit).not.toHaveBeenCalled();
});
test("submit is inert until the value changes", async () => {
  renderReviewField(machineValue: "SMITH");
  await userEvent.keyboard("e");
  expect(screen.getByRole("button", { name: /correct/i })).toBeDisabled();
  await userEvent.type(screen.getByTestId("edit-value"), "X");
  expect(screen.getByRole("button", { name: /correct/i })).toBeEnabled();
});
test("Enter commits from inside, Escape leaves", async () => {
  renderReviewField(machineValue: "SMITH");
  await userEvent.keyboard("e");
  const f = screen.getByTestId("edit-value");
  await userEvent.type(f, "JONES{Enter}");
  expect(onCommit).toHaveBeenCalledWith("JONES");
  // Escape path
  await userEvent.keyboard("e"); await userEvent.type(f, "Z{Escape}");
  expect(f).not.toHaveFocus(); expect(onCommit).toHaveBeenCalledTimes(1);
});
```
- [ ] **Step 2: Run — Expected: FAIL** (today `e` commits immediately using the machine value when untouched).
- [ ] **Step 3: Implement** — `e` focuses the field (no commit); submit disabled while `value === machineRead || value.trim() === ""`; Enter/Escape handled above the input guard. Preserve `RequiredComment` behaviour (submit stays enabled where a reason is the gate, explains the refusal on click) — do not regress it.
- [ ] **Step 4: Run — Expected: PASS.** Also confirm `sidebar.spec` "[ inside a field is text" still passes (same input guard).
- [ ] **Step 5: Full gate + review e2e.**
- [ ] **Step 6: Commit.**
```bash
git add apps/web-v2/src/features/review apps/web-v2/src/app/GlobalKeys.tsx
git commit -m "Tighten correction: e enters the field, submit inert until changed, Enter/Esc"
```

---

## Task 9: Rulebook pending chip + finalize restructure

**Files:**
- Modify: `apps/web-v2/src/features/rulebook/**` (pending chip, citation field, retire preview)
- Modify: the finalize block + the abstractor-said-NO disclosure cards (find via `grep -rl "abstractor" apps/web-v2/src/features`)
- Test: rulebook + finalize component tests

**Interfaces:**
- Consumes: rulebook rule shape (PENDING rules cannot affect the pipeline — escalation resolution is refused without an engineer-confirmed rule; read-only here).
- Produces: pending chip copy `PENDING — AFFECTS NOTHING YET` (literal capitals in markup, not `text-transform` — trap §6); a citation field; a retire preview whose absence is *stated*, not hidden.

- [ ] **Step 1: Write the failing tests:**
```tsx
test("a pending rule reads PENDING — AFFECTS NOTHING YET", () => {
  render(<RulebookRow rule={pendingFixture} />);
  expect(screen.getByText("PENDING — AFFECTS NOTHING YET")).toBeInTheDocument();
});
test("a pending rule with no retire target states its absence", () => {
  render(<RulebookRow rule={pendingNoRetire} />);
  expect(screen.getByTestId("retire-preview")).toHaveTextContent(/nothing to retire|no rule retired/i);
});
```
- [ ] **Step 2: Run — Expected: FAIL.**
- [ ] **Step 3: Implement** the chip copy (literal capitals), citation field, and retire preview (absence stated). Restructure the finalize block and move the abstractor-said-NO disclosure cards to match §11 — verify placement against the design markup for the finalize screen.
- [ ] **Step 4: Run — Expected: PASS.**
- [ ] **Step 5: Full gate + compare** the rulebook route and the sign-off/finalize route.
- [ ] **Step 6: Commit.**
```bash
git add apps/web-v2/src/features/rulebook apps/web-v2/src/features
git commit -m "Rulebook pending chip copy + citation/retire preview; restructure finalize"
```

---

## Task 10: Per-screen fidelity pass (all 18 screens)

**This is where the "look at the screens" mandate lives (§10). A green suite is not evidence the UI is right.** Run it for every screen; each divergence is its own micro-commit.

**Files:** any feature/shared component the pass reveals as wrong; `apps/web-v2/compare.mjs` is the tool (needs both servers up: web-v2 on 5174, the design export on 4600 — do not start/kill servers the user is running).

**The 18 screens** (design h1 → route; confirm routes with `apps/web-v2/src/app/routeTree.tsx`):

| Design label / h1 | Route (verify) |
|---|---|
| Work comes to you (Queue) | `/queue` |
| New title-search package (Ingest) | `/ingest` |
| Confirm what you did (Sign-off) | sign-off route |
| Building the draft report (Processing) | `/processing` |
| Completeness gate | completeness route |
| Order — amended sheet (v2) | v2 route |
| Order 4176034-1 delivered | delivered route |
| A field, escalated | escalation route |
| Your session expired | `/session`/signin |
| Your profile | profile route |
| Everyone in this organisation (People) | people route |
| Where every order sits (Overview) | overview route |
| Client settings & overrides (Clients) | clients route |
| The record (Audit) | audit route |
| Extraction rules (Rulebook) | rulebook route |
| Configuration (Products/Questions) | products/questions route |
| States, not just the happy path (Gallery) | gallery route |
| Review (Document/Fields) | `/orders/ord_demo_1/review` |

- [ ] **Step 1: Start both servers** (or confirm they run): web-v2 `pnpm --filter web-v2 dev` (5174) and the export on 4600.
- [ ] **Step 2: For each screen**, run `node apps/web-v2/compare.mjs "<Design nav label>" <route> ../../shots`, open the `design-*.png`/`app-*.png` pair, and record every divergence in layout, copy, proportion, or state.
- [ ] **Step 3: Fix each divergence** at the component level (common component if it recurs — the previous build's failure was four near-identical row renderers; §1). Colour via tokens only. Re-run `compare` for that screen until it matches.
- [ ] **Step 4: Commit per screen** (or per coherent group), e.g.:
```bash
git add apps/web-v2/src/features/queue
git commit -m "Fix the Queue screen against the revised design"
```
- [ ] **Step 5: After the last screen, run the whole gate** including `test:e2e` and root `pnpm typecheck` — Expected: all PASS. Then a final `knip` to delete anything the reskin orphaned (e.g. the dark-pane tokens if their screens are gone).

---

## Self-Review

**Spec coverage (HANDOFF-UI §11 + §8):**
- Warm-archival palette → Task 1. Absent-counterpart tokens handled explicitly.
- Libre Franklin → Task 1.
- Two themes / AA twice / paper doesn't invert / theme preference → Tasks 2, 3.
- Left sidebar (232/78, forced collapse, starts-collapsed-on-Review, badges, lifecycle rail, `[` fold, recover sidebar.spec invariants) → Task 4.
- Account-menu throw / engineer-gate `fixme` → Task 5.
- Review coverage spine → Task 6; section rail & decision dock → Task 7.
- Correction: must-change, `e`-enters, Enter/Esc → Task 8.
- Rulebook pending chip + citation + retire preview; finalize restructure + abstractor-NO cards → Task 9.
- Every screen faithful → Task 10.

**Product-rule guards carried through:** provenance (§1), NA states in greyscale (§2, Tasks 1/10), server-owned state (§3, Tasks 5/7), no approve-all/throughput (§4/§5, Task 7), refusals-need-reasons (§6, Task 8), no optimistic update / 409-is-an-answer (§9, Task 8), no browser storage (§8, Tasks 3/4).

**Open items (not this plan's call, §9):** Q4–Q10 config layer renders read-only; the four-member NA set is an unresolved ruling (contract ships two) — do not ratify it in tokens; C18 `excluded_reason` model can be revisited now `apps/web` is gone but is out of scope here.

**Placeholder scan:** none — every code step shows code; every command shows expected result. The one deliberately procedural task is Task 10 (fidelity pass), whose specifics are produced by `compare.mjs` at execution by design (§10), not fabricated here.

**Type consistency:** testids (`side-rail`, `rail-toggle`, `rail-door-<path>`, `data-collapsed`, `edit-value`, `coverage-cell`, `retire-preview`) are used identically across tasks and match `sidebar.spec.ts`. `MePreferences.theme` enum `"titlepipe"|"mocha"` is consistent across Tasks 3/4/5.

---

## Task 11: Top order-context strip

**Files:**
- Create: `apps/web-v2/src/app/OrderStrip.tsx` (the top bar; < 150 lines)
- Modify: `apps/web-v2/src/app/rootRoute.tsx` (content column gains a header row above `<Outlet/>`), `apps/web-v2/src/app/AppChrome.tsx` (render the strip; STOP rendering `OrderCounts` + `AccountMenu` in the sidebar foot — they move into the strip)
- Modify: `apps/web-v2/src/app/OrderCounts.tsx` only if its layout must change from a stacked foot block to an inline row (keep its query + the 4 counts + provenance/NO-SOURCE semantics intact)
- Test: a Storybook `OrderStrip.stories.tsx` play function + a smoke assertion in the review e2e that the strip renders the order ref + counts

**Design target** (from `design-export/TitlePipe.dc.html`, verified rendered): a full-width bar at the TOP of the content column (right of the sidebar), on every screen. Left: `ORDER {order_ref}`. Center-right: the four counts `{n} FIELDS · {n} AUTO-CONFIRMED · {n} NEED YOU · {n} NO SOURCE` (these ARE `OrderCounts`). A lifecycle/sign-off STAMP (e.g. `SIGN-OFF OPEN`) in a bordered stamp style. Far right: identity `{name} · {ROLE}` as the account-menu trigger.

**Interfaces / data (all server-owned — never derive client-side):**
- Order ref + the 4 counts: from the URL order via `OrderCounts`'s existing `OrderFieldsResponse` query (`/api/orders/{id}/fields`). Counts stay derived from server `Field.state` only (the sanctioned pattern), never from confidence/`value===null`.
- The stamp text: from `OrderSignoffResponse` / the order's lifecycle state (`GET /api/orders/{id}/signoff` — `signed`/lifecycle). Render the server's state verbatim; if no single contract field gives the exact stamp word, render what the contract gives and add a `CONTRACT GAP:` note rather than computing a lifecycle label client-side.
- Identity: `useSession` (name/role), and the existing `AccountMenu` component is the trigger.

**Order principle (keep it):** order comes from the URL (`/orders/{id}/...`), NOT a remembered global current order (multi-tab safety — documented in `AppChrome.tsx`). So: on order screens the strip shows ref + counts + stamp; on non-order screens (Queue, Overview, admin) the strip shows the brand-neutral left + identity right, with NO fabricated order. Do not invent a global current-order.

- [ ] **Step 1:** Write the failing test — `OrderStrip` given an order renders `ORDER {ref}`, the four count labels, the stamp, and the account trigger; given no order renders identity but no `ORDER` label. RED.
- [ ] **Step 2:** Build `OrderStrip.tsx` (tokens only, no raw hex; literal capitals in markup; `data-testid="order-strip"`). It composes `OrderCounts` (inline variant) + a stamp + `AccountMenu`.
- [ ] **Step 3:** Rework the layout: in `rootRoute.tsx`, the content side becomes a column — `<div class="flex-1 flex flex-col min-w-0"><OrderStrip.../><main>…Outlet…</main></div>` beside the `<Sidebar/>`. In `AppChrome.tsx`, remove `OrderCounts` + `AccountMenu` from the sidebar `foot` and render them via `OrderStrip` at the top. (Decide the cleanest split: AppChrome may need to expose the strip; keep the capture-seat `return null` behavior — no strip on `/blind/*`.)
- [ ] **Step 4:** GREEN — run the story + review e2e; confirm the sidebar foot no longer duplicates counts/identity, and the strip shows them.
- [ ] **Step 5:** Full gate incl. e2e. Do NOT break `sidebar.spec`/`authz.spec` (the account menu still opens, now from the strip; keep its testid and a11y). Commit.

---

## Task 12: Sidebar groups + numbered lifecycle rail + per-item icons

**Files:**
- Modify: `apps/web-v2/src/entities/nav/doors.ts` (add a `group` + a display `icon` letter per door — do NOT change the door SET, paths, keys, or `label`s that `roles.spec`/`?`-map assert)
- Modify: `apps/web-v2/src/entities/nav/Sidebar.tsx` (render grouped sections with headers), `SidebarDoor.tsx` (letter-icon square shown when EXPANDED too, not only collapsed), `LifecycleRail.tsx` (numbered stages + checkmark for `done` + per-stage badge)
- Modify: `apps/web-v2/src/app/AppChrome.tsx` (pass the door groups + the active order's pipeline stages)
- Test: extend `sidebar.spec` / a Storybook story for the grouped structure + numbered rail; keep every existing `sidebar.spec`/`roles.spec`/`authz.spec` assertion GREEN (never weaken)

**Design target:** the sidebar is grouped with uppercase headers `WORK / THIS ORDER / ADMIN / REFERENCE`. WORK = Queue, Overview. THIS ORDER = the numbered pipeline lifecycle (Upload ①…✓, Questions ②, Processing ③, Completeness ④, Review ⑤, Delivered ⑥) with a stage NUMBER, a CHECKMARK when the stage is `done`, and a per-stage BADGE (e.g. Completeness `1`, Review `7`, Questions `open`). ADMIN = Rulebook, Products & sign-off, Clients, People, Audit. REFERENCE = States. Every item shows a small letter-icon square even when the rail is EXPANDED (Q, O, U, …). The `[`/collapse toggle stays at the top by the wordmark.

**Interfaces / data (server-owned):**
- Lifecycle stage state (done/current/badge): from `OrderPipelineResponse` (`GET /api/orders/{id}/pipeline`) — `PipelineStage.phase` (`done`/`running`/`halted`/`waiting`) drives the checkmark/current mark; NEVER infer a stage's state from counts or confidence (rule §3). The per-stage badge count (e.g. Completeness gaps, Review needs-you) comes from server data, not client derivation. If the badge number for a stage has no contract source, omit it rather than computing it, and note the gap.
- The active order for THIS ORDER: the URL order (same principle as Task 11). With no active order, render the THIS ORDER group's stages without per-order badges/checkmarks (plain nav), or hide the group — match what the design does when no order is active; if unclear, keep the stages visible as plain nav and record the choice.
- Escalation Inbox + Profile: the design's sidebar does not draw them as separate labeled items, but `roles.spec` and the escalation attention-dot depend on the `/escalations` door existing. DO NOT delete doors. Place `/escalations` in WORK and keep `/profile` reachable (account menu already has it); if leaving `/profile` in the sidebar is needed to keep a test green, place it in REFERENCE and record the divergence. Preserve the escalation red/amber attention dot and its `sidebar.spec` invariant (red complaint pulses, amber gap still).

- [ ] **Step 1:** Write the failing test/story — the sidebar renders the four group headers in order; THIS ORDER shows numbered stages with a checkmark on a `done` stage and a badge on a stage with a server count; each door shows its letter-icon when expanded. RED.
- [ ] **Step 2:** Add `group` + `icon` to `doors.ts` (metadata only — paths/keys/labels unchanged). Group the render in `Sidebar.tsx` with `Eyebrow`-style headers. Keep `data-testid="side-rail"`, `rail-door-<path>`, `rail-toggle`, `data-collapsed` exactly.
- [ ] **Step 3:** Update `SidebarDoor.tsx` to show the letter-icon square in the expanded state too. Update `LifecycleRail.tsx` to take richer stages (number, `done` checkmark, badge) sourced from `OrderPipelineResponse`; wire it in `AppChrome.tsx`.
- [ ] **Step 4:** GREEN — run the story + `sidebar.spec` + `roles.spec` + `authz.spec`. Every prior assertion intact.
- [ ] **Step 5:** Full gate incl. e2e. Colour via tokens; 150 lines/file. Commit.

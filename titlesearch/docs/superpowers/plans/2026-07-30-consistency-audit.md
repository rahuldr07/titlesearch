# Cross-plan consistency audit — 2026-07-30

Run against the six wave plans immediately after they were authored in parallel.
It found 14+ components whose signatures disagree between waves, four components
consumed but never built, and a CLI every downstream wave calls that Wave 0
deletes. The resolutions are pinned in `2026-07-30-design-fidelity-00-index.md`
under "Disputed signatures"; this file is the evidence behind them.

---

I read all eight files. Findings below, by category, most damaging first within each.

---

## 1. SIGNATURE DRIFT

This is the worst category. Wave 4 declares "**These signatures are not in the index; they are stated here in full and are the contract Wave 3 must satisfy**" (w4 Task 1) and then states signatures that contradict what Wave 3 actually builds. Nine components disagree across waves.

**`DecisionRow`.** w3 Task 6 produces `export function DecisionRow(props: { field: Field; selected: boolean; onSelect: () => void }): ReactElement;`, renders an `<li>`, and states "NO VISUAL CHANGE IN THIS MOVE. The export's status dot and right-hand status word belong to the Review screen's rework and land with it (Wave 4)". w4 Task 1 states `export interface DecisionRowProps { field: Field; onActivate: () => void; selected?: boolean }` and "renders … an 8px status dot, a `SECTION · FIELD` eyebrow … **The whole card is the `<button>`**". Three separate breaks: `onSelect` vs `onActivate`; `selected` required vs optional; `<li>` vs `<button>`. w4's `RestOfQueue` then calls `<DecisionRow key={field.id} field={field} onActivate={…} />` — no `selected` (required in w3) — inside `<div className="flex flex-col gap-4">`, i.e. `<li>` elements with no list parent.

**`PageSpine`.** w3 Task 9: `PageSpineProps { totalPages: number; pages: readonly SourcePage[]; currentPage?: number; onSelect?: ((page: number) => void) | undefined }` over `type CellState = "read" | "degraded" | "partial" | "unseen"`, with `pageCoverage.test.ts` asserting `expect(seen.size).toBe(4)`. w4 Task 1: `PageSpineProps { cells: readonly PageSpineCell[]; currentPage: number; onSelect: (n: number) => void }` over `type PageSpineTier = "needs_you" | "cited" | "read" | "degraded" | "partial" | "unseen"`. Different prop shape *and* a six-member union against a four-member one that Wave 3 pins with a test.

**`ChoiceCardGrid`.** w3 Task 10: `ChoiceOption { value: string; title: string; sub: ReactNode }`, `columns: "2" | "3"`, renders `<Button … aria-pressed={chosen}>`. w4 Task 2: `ChoiceCardOption { id: string; title: string; sub?: string }`, `columns: 2 | 3`, plus a required `name: string`, and its `ClientPicker.stories.tsx` asserts `findByRole("radio", …)` and `toBeChecked()` — which an `aria-pressed` button is not.

**`OrderRow`.** w3 Task 4 declares `edge?: "none" | "attend" | "halt"`; w4 Task 5 declares `stateEdge?: "none" | "attend" | "halt"`. Same axis, two names. This is the `clearLayers()`/`clearFullLayers()` case exactly.

**`OrderMiniCard`.** w3 Task 5: `stateLabel?: string`, `waited?: string`, no `to`. w4 Task 4: `state?: string`, `waited: string` (required), plus `to?: string`.

**`QuietState`.** w3 Task 11: `{ tone: "settled" | "action"; headline: string; children: ReactNode; testId?: string }`. w4 Task 5: `{ tone: "settled" | "attend"; headline: string; body: string }` — and w4's call site passes `data-testid="queue-quiet-state"`, which neither shape accepts.

**`shared/plural.ts` — two waves, one file, two function names.** w4 Task 15 creates `export function countOf(n: number, singular: string, plural?: string): string` plus `plural.test.ts`. w5 Task 5 creates the same file with `export function count(n: number, one: string, many?: string): string` plus its own `plural.test.ts`.

**`actionLabels.ts` — two waves, one file, contradictory contracts.** w4 Task 14: `actionPhrase(action: string): string`, fall-through returns the token — its test asserts `expect(actionPhrase("some_future_act")).toBe("some_future_act")`. w5 Task 4: `actionPhrase(action: string): string | null` plus `entityRef()`, fall-through returns null — its test asserts `expect(actionPhrase("some_action_nobody_mapped")).toBeNull()`. Both write `actionLabels.test.ts`. The two tests cannot both pass. The maps also disagree: `field_corrected: "Corrected field"` (w4) vs `"Amended claim"` (w5).

**`SignoffLineTitle`.** w4 Task 3 declares `SignoffLineTitleProps { n: number; label: string }`; w5 Task 2 creates `{ n; label; as?: "h2" | "h3"; className? }` and its gate *requires* the call site `<SignoffLineTitle n={gap.line_number} label={gap.line_label} as="h2" />` — unrepresentable in w4's declared shape.

**`GapCloseOption` — contract vs screen.** w2 Task 8: `GapCloseKind = z.enum(["upload", "amend", "root_of_title", "change_product"])`, `min_role: z.string().nullable()`. w4 Task 7: `kind: "upload" | "amend" | "root" | "product_change"`, `min_role: "reviewer" | "senior" | "ops"` (non-nullable). w4's story then asserts `getByTestId("option-root")` and `option-product_change`, which under Wave 2's enum would be `option-root_of_title` / `option-change_product`. w4 also calls `<GapCloseOptions options role onChoose />` where w2 defines the props as `{ options: readonly GapCloseOption[]; onClose: (option: string, note: string) => void }`.

**`SignoffAnswer` — wrong spelling, will not compile.** The shipped contract is `packages/contract/src/intake.ts:15: z.enum(["YES", "NO", "N/A"])`. w3 Task 8 writes `const ANSWER_TONE = { YES: "settled", NO: "attend", NA: "neutral" } as const satisfies Record<SignoffAnswer, …>` and its story sets `answer: "NA"`. `NA` is not `N/A`; both the `satisfies` and the fixture are type errors.

**`CensusTile`.** The index pins `tone?: "muted" | "attend" | "halt" | "settled"` with no `size`. w1 Task 7 ships `tone` with an added `"action"` and a new `size?: "strip" | "board"` (declared as a deliberate extension). w4 Task 6 then re-states the *pinned* four-tone, no-`size` shape while instructing "numerals in 15px mono", which is only reachable via `size="strip"`.

**Phantom `AppShell`.** The index table, w1 Prerequisites and w4 Prerequisites all say Wave 0 delivers "`AppShell`/`Pane`/`Screen`", and the spec's component table lists "`Pane` + `AppShell` — 9 sites". w0's File Structure and its seven tasks never create an `AppShell` file; `rootRoute.tsx` inlines `<div className="flex h-screen overflow-hidden">`.

**`Button.fill="recessed"`.** w1's File Structure table says "`recessed` fill added (Task 12)"; w1 Task 12's body explicitly refuses it ("**`Button` does not get a `recessed` fill in this wave** … recorded for Wave 4"). No Wave 4 task adds it, yet w4 Task 3 instructs "render the unchosen options recessed (`Button fill="recessed"`…)". Button's fills today are `solid | outlined | tinted | ghost`.

**`Button size`.** w4 Task 11 sets `size="sm"` on `＋ New product` and `＋ New line`; w5 Task 8 sets `size="section"` on the identical two call sites (and adds the `section` rung).

**`Eyebrow` variants that exist nowhere.** w4 Task 7 uses `Eyebrow variant="cardHeading"` and w4 Task 9 uses `variant="cardTag"`. `Eyebrow.tsx` ships `field | screen | section | group | caption | stat`; w1 Task 12 adds `heading`. Neither `cardHeading` nor `cardTag` is defined by any plan.

**`PaneProps`.** Pinned as `{ children: ReactNode; className?: string }`. w4 Task 1 writes `<PaneBody data-testid="report-scroller" className="…">`.

**`--stroke-accent`.** The index says the `settled` accent is "Rendered as `border-t-(length:--stroke-accent)` … with **a new** `--stroke-accent: 2px`". The token already exists — `tokens.css:392: --stroke-accent: 3px` — and w1 Task 2 correctly describes it as a 3px→2px value change. The index is wrong about it being new.

**`chromeless` vs `chromeFor`.** The spec's architecture section names the predicate `chromeless(pathname)`; the index pins and every plan implements `chromeFor(pathname): ChromeMode`. Index is authority, so this is stale spec prose rather than a plan defect — but it is the only name in the spec that no plan honours.

---

## 2. PLACEHOLDERS AND REFERENCES DEFINED NOWHERE

**Four components consumed and never produced.** w4 attributes each to a wave that does not build it, and none exists in `apps/web-v2/src`:
- `ContractGapNote` — imported in w4 Task 2 (`import { ContractGapNote } from "../../shared/ui/ContractGapNote";`), used in Tasks 2, 3 and 11, attributed to "Wave 1". Wave 1 has no such task.
- `QueryState` — w4 Task 12 states its full props "(Wave 1's error/pending wrapper — unpinned, stated here)" and Tasks 12 and 13 depend on it. Wave 1 never creates it.
- `Quote` — w4 Task 15, "(Wave 1, unpinned)". Wave 1 never creates it.
- `SignoffLineTitle` — w4 Task 3 attributes it to "Wave 3", w4 Task 7 to "signature in Task 3". It is created in **w5 Task 2**, after both consumers.

**Contract fields consumed that no wave adds.** w4 Task 3: "Consumes from Wave 2's contract additions: `OrderSignoffLine.scope_note`, `OrderSignoffResponse.client_name`, `OrderSignoffResponse.baseline_diff`." Wave 2 adds only `answers` and `policy_suggestion` to `OrderSignoffLine` and nothing to `OrderSignoffResponse`. w4 Task 1: `FieldsColumn` reads `order.product/period/config_version` from "the order-scoped shape Wave 2 added", off `data.order` on the fields response — w2 Task 2's `OrderContextResponse` has no `config_version` and is served at `GET /api/orders/:id/context`, not on the fields response. w4 Task 16: `keyboard_shortcuts` is "Wave 2's contract addition" and "Wave 2 added `label` to the authz projection" — Wave 2 adds neither, yet w4's own test asserts `PREFERENCE_KEYS` contains `keyboard_shortcuts`.

**Fixture ids that no fixture serves.** w4 Task 2's `ClientPicker.stories.tsx` asserts `onSelect` is called with `"cli_demo_1"` and its e2e clicks `client-card-cli_demo_1`; w2 Task 1's shared set uses `client_id: "cli_riverbend"` on every row. The same story's assertion `await expect(args.onSelect).toHaveBeenCalledWith("cli_demo_1")` is made against `args.onSelect = () => {}` — a plain function, not a `fn()` spy — so it cannot pass as written.

**What without how.** Waves 0, 1, 2 and 3 give literal code for every implement step. Wave 4 does not, for several multi-file rewrites: Task 2 Step 4 ("the screen's four blocks") is prose only and it is blocking item B5; Task 3 Step 3 is five prose paragraphs rewriting five files; Tasks 12, 13, 15 and 16 likewise carry no implementation code. Task 1 Step 4's `CoverageSpine` instruction — "render the export's one-line summary … and delegate the cells to `PageSpine` with the count-first legend" — is a whole component with no code and a prop shape that contradicts Wave 3's.

**Planned comments that will be false when written.** w3 Task 4 instructs the `QueueScreen` comment "there is no assigned-work endpoint, no held-orders endpoint and no in-flight projection … nothing gives them any yet" — w2 Task 4 ships `GET /api/queue/bands` serving exactly those. w3 Tasks 13 and 15 instruct `asking`/`why` to be "OPTIONAL because the contract does not carry them yet" and a `CONTRACT GAP: Field carries no asking and no why` — w2 Task 9 adds both. The plans' own global rule is that a comment asserting an untruth is worse than no comment.

---

## 3. SPEC COVERAGE GAPS

**The forced-collapse test has no task.** The spec's Verification section names three rules that "get a test they do not have today": `min-h-0` on every scroller (w0 Task 1 ✓), a done stage never carrying an open badge (w2 Task 7 ✓), and "**the forced-collapse toggle never writing a preference the user did not choose**" — no task in any plan writes it. Related: the spec's Wave 0 sequencing also lists "hide the collapse toggle while forced" as Wave 0 work; w0 has no task for it either.

**`Field.asking` / `why` are added and never consumed.** The spec's contract list ends with `Field.asking + why`; w2 Task 9 adds them with fixture copy for all six queued decisions. No task in Waves 3, 4 or 5 renders them — w3 Task 15 explicitly omits them behind a CONTRACT GAP note, and `asking` appears zero times in w4 and w5.

**`ToneNote` is never absorbed.** The spec's component table entry is "`Card` **tone axis** (absorbs `ToneNote`) — 27 sites". w1 Task 1 lists 27 adoption sites and never mentions `ToneNote`; no plan deletes it.

**The dead-kit waiver list never shrinks.** w0 Task 5 lands the `knip --production` gate with 19 named waivers and a handoff assigning each: "Wave 3 clears the `entities/*` block and the four `shared/ui` adopt-or-deletes; Wave 5 clears `money.ts`". Wave 3 touches only `entities/field` and `entities/document` (and its Task 15 clears those); nothing in any plan adopts or deletes `Checkbox.tsx`, `DestructiveConfirm.tsx`, `Tooltip.tsx`, `ClaimVsEvidence.tsx`, `entities/rule/ProvenanceBadge.tsx`, `entities/order/StageList.tsx` or `shared/money.ts`, and no task edits `knip.production.jsonc` after w0 creates it. w5 Task 13's "delete every file `knip` reports as unused" cannot reach them — waived files are not reported. Root cause 3 of the spec is therefore gated but not discharged.

**Five orders vs six.** The spec's fixture anchors say "the export's five orders"; w2 Task 1's test is named `"the export's five named orders are all present"` and iterates six refs (`4176034-1, 4176052-7, 4176011-2, 4175994-0, 4175980-1, 4175972-3`).

---

## 4. ORDERING BUGS

**`compare.mjs` — every downstream wave calls the CLI Wave 0 deletes.** w0 Task 6 replaces the tool wholesale, documents the new contract as `node compare.mjs <screen-key> <out-dir>` / `--all` / `--check`, and states "The old `<DesignMenuLabel> <app-route> <out-dir>` form is gone" and "an unmatched label is now a non-zero exit instead of a warning". Then: w1's Wave exit runs `node apps/web-v2/compare.mjs Rulebook /rulebook ../../shots`; w3's Wave verification runs `node compare.mjs Review /orders/ord_demo_1/review ../../shots`; **every** w4 capture step uses the removed form (`compare.mjs Review /orders/… `, `compare.mjs "Products & sign-off" /products`, `compare.mjs States /gallery`, `compare.mjs Queue /escalations`, `compare.mjs Queue /profile`); and w5 Task 13 states the tool's interface as "`node compare.mjs <DesignMenuLabel> <app-route> <out-dir>`" and lists all eighteen invocations in that form. w4 Tasks 15 and 16 additionally *depend on* the removed behaviour ("`compare.mjs` will warn and capture the export's default screen"), while w0 gave `escalation`, `profile`, `session` and `signin` real click paths and made a miss exit 1 — and w5 Task 13 says the opposite of w4, that the click path "is exactly … what Wave 0 folded into `compare.mjs`", while still using the dead CLI.

**w5 Task 6 edits a file Wave 3 deletes.** It modifies `apps/web-v2/src/features/review/DecisionPanel.tsx:131` and adds a `CopyCheck` entry with `file: "src/features/review/DecisionPanel.tsx"`. w3 Task 15 runs `git rm apps/web-v2/src/features/review/DecisionPanel.tsx`. The gate does `readFileSync(join(root, check.file))` with no existence guard, so `exportCopy.test.ts` will not fail an assertion — it will throw ENOENT and take the whole gate down.

**w5 Task 7 requires a comment in a file Wave 3 empties.** It asserts `src/app/AppChrome.tsx` must contain `THE FLOW IS SIX FIXED POSITIONS`. w3 Task 2 deletes AppChrome's `FLOW` block at `:21-34` and moves the definition and its WHY into `entities/nav/flow.ts`.

**`GapCloseOptions.tsx` is rewritten three times in three incompatible directions.** w2 Task 8 retypes its props to `readonly GapCloseOption[]`, deletes the `CONSEQUENCE` constant and renders `option.consequence`. w3 Task 10 rewrites it around `ChoiceCardGrid` with `options.map((option) => ({ value: option, title: option, sub: CONSEQUENCE }))` — options back to strings, `CONSEQUENCE` back. w4 Task 7 rewrites it again around `GapOptionButton` with structured options — and lists "Modify: `GapOptionButton.tsx`", which w3 Task 10 deletes (`git rm`).

**`PageStrip`.** w3 Task 9 runs `git rm apps/web-v2/src/entities/document/PageStrip.tsx PageStrip.stories.tsx`. w4 Task 1 says "`PageStrip` stays in `entities/document` for any screen that still wants it".

**`features/review/FieldRow.tsx` and `FieldList.tsx`.** w1 Task 4 adopts `ListRow` at `features/review/FieldRow.tsx:33` and `DividedSection` at `features/review/FieldList.tsx:33`; w3 Task 6 `git mv`s FieldRow to `entities/field/DecisionRow.tsx`; w4 Task 1 then lists both as deletions and says "`knip` must report `…features/review/FieldRow.tsx` as removed, not as unused — if it names them, a delete was missed" — for a file Wave 3 already moved.

**Wave 2/Wave 3 mutual dependency that both plans deny.** w3 Prerequisites: "Wave 2 is independent and may still be running; nothing in this wave reads a fixture." But w3 Task 8's `SignoffReadonly.stories.tsx` builds `OrderSignoffLine` literals without `answers` or `policy_suggestion`, which w2 Task 6 makes required — so if Wave 2 lands first, Wave 3 fails typecheck; if Wave 3 lands first, w2 Task 6's own instruction to patch story literals misses these. And w3 Task 8 Step 4 expects "`/questions` route smoke green (the demo order is unsigned, so the interactive card still renders)", which is only true after w2 Task 6 re-points `SIGNOFF_ORDER_ID` to `ord_demo_4`.

**Wave 5 has no failing state for five of its thirteen tasks.** Every TDD "Expected: FAIL" listed below is unreachable because an earlier wave already landed the change: w5 Task 1's three sentences (w4 Task 4 restores "counted separately from" verbatim; w4 Task 3 restores "this signs your work"; w4 Task 10 drops the trailing "does"); w5 Task 3's four pipeline strings (w2 Task 7 sets all four verbatim — the plan half-admits this, "If Wave 2 already landed some of these verbatim, fewer lines appear", which leaves the step with no defined failing state); w5 Task 6's `Keys:` removal (w4 Task 5: "The on-screen `Keys: ⏎ take it · P pass` hint goes"); w5 Task 7's banned `"Always visible, never breakpoint-hidden"` (deleted in w1 Task 7 and again in w4 Task 6); w5 Task 11's `StateCard` `items-start` (w4 Task 9).

**Three auto-fill utilities, one rule, colliding names.** w4 Task 9 adds `@utility grid-autofill-160` = `minmax(160px, 1fr)`; w4 Task 12 adds `@utility grid-autofill-115` = `minmax(230px, 1fr)` for `SignoffDefaults.tsx:56`; w5 Task 9 adds `@utility grid-autofill-230` = `minmax(230px, 1fr)` for the same line of the same file. Two names for one rule on one call site, and a naming scheme where `-115` and `-230` both mean 230px.

**A stale internal contradiction in w5's "does not do" list.** It says the questions screen's "`Policy suggests YES` value … require a field on the wire" and is out of scope — w2 Task 6 adds `policy_suggestion` and w4 Task 3 implements `Policy suggests {line.policy_suggestion}`.

**w5 Task 6's safety grep contradicts w3 Task 14.** w5 records "Verified on 2026-07-30: the only `Keys:` hits are `entities/field/DecisionBar.tsx:60` (the dock legend the export DOES draw, which stays)". w3 Task 14 rewrites `DecisionBar.tsx` with a story `NoKeyHintLine` asserting `expect(canvasElement.textContent).not.toContain("Keys:")` and a WHY block reading "NO KEY-HINT LINE (ruling D6). The export puts key hints nowhere on a screen".

**w1 Task 2's token-consumer list is stale by one task.** It lists `features/questions/OrderIdentityStrip.tsx:37` among the five existing `--stroke-accent` consumers moving 3px→2px; w1 Task 1 already replaced that exact line's `border-l-(length:--stroke-accent) border-l-action` with `<Card size="nested" accent="action">`.

---

## 5. RULE VIOLATIONS

**Client-side derivation of server state — `PageSpine`'s new tiers.** `entities/document/pageCoverage.ts` (w3 Task 9) states "ALL FOUR ARE SERVER-SUPPLIED, NEVER INFERRED". w4 Task 1 adds `needs_you` and `cited` to the same union and says outright that they are "a join over provenance the server already sent (`Field.source_page` + `Field.state`)" — i.e. a page's coverage tier computed in the browser from field state, inside the component whose own doc forbids exactly that. The hedge "never a re-derivation of server state" does not survive the mechanism it describes.

**Two tasks in Wave 4 state opposite rules about deriving a count from a rendered array.** w4 Task 5, `QueueBand`: "`{count === undefined ? note : \`${count} ${note}\`}` — **never `orders.length`**, and never a rate", and its story doc: "re-deriving it here would be a second copy of a number the server already decided." w4 Task 1, `RestOfQueue`: "**THE HEADING'S NUMBER IS `rows.length`**", rendered as `Rest of the queue · {rows.length}` where `rows` is `fields.filter(…)` in the browser. Both cannot be the rule.

**A client-derived count that will state something false.** w3 Task 8's `SignoffReadonly` renders `<CardFooter>{signoff.lines.length} lines answered · {noCount} disclosed as NO</CardFooter>` with `noCount = signoff.lines.filter((line) => line.answer === "NO").length`. `lines.length` is the number of lines, not the number answered; the same component's `SignoffLineRow` handles `answer === null` with a "Not answered" branch, so the footer will claim thirteen answered on a record it is simultaneously drawing as unanswered.

**150-line limit.** Only w1 Task 9 (`ReasonEditor`) and w3 Task 12 (`EngineReadings`) acknowledge it with a stated split. w3 Task 13's `DecisionCard.tsx` as written is a ~30-line WHY block, five exported interfaces, a state map and a ~60-line component — over the limit on the page — with no split named. w4 Task 1's `FieldsColumn` gains a new `order` prop and an eleven-child `PaneHeader` with no line-count check.

**Hedged, not violations, but flagged by the plans themselves and left unresolved:** w3 Task 9's `ring-2 ring-action` (`ring-2` is 4px on a 2px base, and the plan admits it may not emit) and w3 Task 11's `size-13`.

**Clean:** no raw hex outside `packages/ui-tokens`, no arbitrary Tailwind bracket values, no inline `style`, no `!important`, no `localStorage`/`sessionStorage` in app code, no throughput or rate counters, no per-person productivity, no approve-all or bulk-confirm, no optimistic update on a field decision, and no collapsed NA state (`noValueStates.ts` stays the authority throughout; w3 Task 16's `noValueFor` maps all four `NaReason` members exhaustively).

# [Wave 4] — The 18 Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble every screen the export draws from the Wave 1/3 primitives at the export's own measure, padding and placement, and close the divergences the audit enumerated for each — including B4 (Review prints every value twice), B5/B6 (Upload is the wrong screen and its client picker is free text) and the two `LOCAL PREVIEW` toggles that let a user repaint a server verdict.

**Architecture:** Every screen becomes `<Screen measure pad placement>` wrapping composed primitives; nothing hand-rolls a measure, a header block, a row divider, a refusal line or a tinted block any more. Review is the one exception — `placement="bleed"` over a two-pane `Pane` workstation, because the export roots it at `height:100%` and gives each pane its own scroller. Data comes from Wave 2's shared demo order set; no screen invents a fixture, and no screen re-derives a count, a verdict or a state.

**Prerequisites:** Waves 0, 1, 2 and 3 complete and green. Wave 0 gives `AppShell`/`Pane`/`Screen`/`chromeFor()`, the fixed `compare.mjs` and the `knip` stories gate. Wave 1 gives the eleven primitives and the two axis corrections. Wave 2 gives the fattened fixtures and the read-only contract shapes. Wave 3 gives `RailRow`, the single flow definition and the order/field/signoff entities including the Reader A/B collapse.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **a green suite is not evidence the UI is right** — every screen task ends with a `compare.mjs` capture against the export and a look at the pair before the commit step, and a task is not done until that has happened. And **this wave is assembly, not invention**: if a divergence in the audit is not listed in a task below, it belongs to Wave 5 (copy and density) or to the contract, not here.

## The `Screen` assignment table

Reproduced from the spec so no task has to look it up. `measure` is the export's own pixel number; `Screen` maps it to the 2px base (`1340`→`max-w-670`, `1160`→`max-w-580`, `1120`→`max-w-560`, `1040`→`max-w-520`, `940`→`max-w-470`, `900`→`max-w-450`, `880`→`max-w-440`, `860`→`max-w-430`, `720`→`max-w-360`, `700`→`max-w-350`, `640`→`max-w-320`, `560`→`max-w-280`, `460`→`max-w-230`, `440`→`max-w-220`, `420`→`max-w-210`, `380`→`max-w-190`).

| Screen | `measure` | `pad` | `placement` | Task |
|---|---|---|---|---|
| Review | — | — | `bleed` | 1 |
| Upload | `560` | `40` | `centre` | 2 |
| Questions | `640` | `36x40` | `top` | 3 |
| Overview | `1340` | `26x30` | `top` | 4 |
| Queue | `860` | `28x32` | `top` | 5 |
| Completeness | `720` | `32x40` | `top` | 7 |
| Processing | `700` | `40` | `centre` | 8 |
| Gallery | `1120` | `28x32` | `top` | 9 |
| Rulebook | `1160` | `24x28` | `top` | 10 |
| Products | `1040` | `28x32` | `top` | 11 |
| Clients | `880` | `28x32` | `top` | 12 |
| People | `900` | `28x32` | `top` | 13 |
| Audit | `940` | `28x32` | `top` | 14 |
| Escalation | `700` | `28x32` | `top` | 15 |
| Profile | `720` | `28x32` | `top` | 16 |
| Delivered | `460` | `40` | `centre` | 17 |
| Surface failure | `440` | `40` | `centre` | 17 |
| Session | `420` | `40` | `centre` | 17 |
| Signin | `380` | `40` | `centre` | 17 |

## Execution order

Task 1 (Review) runs **alone and first** — it holds two blocking findings, consumes the most new components, and is the screen whose rework exposes anything the primitives got wrong. Task 2 (Upload) follows. Tasks 3–8 then run as three parallel tracks: **(a)** 3 · **(b)** 4, 5, 6 · **(c)** 7, 8. Task 9 (Gallery) waits on 7 and 8 — they hand it the two moved renderings. Tasks 10–17 are the admin/reference set and are fully parallel with each other once 9 lands.

## File Structure

| File | Responsibility |
|---|---|
| `src/features/review/ReviewScreen.tsx` (modify) | The bleed two-pane workstation and its state; nothing else |
| `src/features/review/EvidenceColumn.tsx` (modify) | The LEFT pane: document header, facsimile body, coverage spine footer |
| `src/features/review/FieldsColumn.tsx` (modify) | The RIGHT pane: ordered strip + dock + finalize pinned; report body; section rail beside |
| `src/features/review/RestOfQueue.tsx` (create) | The one list of decisions that are not the open card — replaces `FieldList.tsx` |
| `src/features/review/FieldList.tsx` (delete) | Held B4: printed all 15 settled values a second time |
| `src/features/review/ReviewHeader.tsx` (delete) | A screen title and a third answered-count the export does not draw |
| `src/features/review/OrderRail.tsx` (delete) | The sidebar's lifecycle rail, drawn a second time and contradicting it |
| `src/features/review/ReportPane.tsx` (modify) | Sheet scroller beside a bordered `flex-none` rail, not a card in a grid |
| `src/features/review/DocumentColumn.tsx` (modify) | Drops `PageStrip`; the spine is the one navigation surface |
| `src/features/review/CoverageSpine.tsx` (modify) | Citation tiers, count-first legend, one heading, clickable cells |
| `src/features/ingest/IngestScreen.tsx` (modify) | The export's four blocks; the false `CONTRACT GAP` note deleted |
| `src/features/ingest/ClientPicker.tsx` (create) | `GET /api/clients` card grid — B6 |
| `src/features/ingest/ProductPicker.tsx` (create) | `GET /api/config/products` card grid + the Update date panel |
| `src/features/ingest/OrderForm.tsx` (modify) | Demoted to the secondary block, one factual label |
| `src/features/ingest/orderFields.ts` (modify) | Four fields; `client_id` leaves the text form |
| `src/features/ingest/AcceptedCard.tsx` (modify) | Gains `Continue to sign-off →` |
| `src/features/questions/QuestionsScreen.tsx` (modify) | `Screen 640 / 36x40 / top`; the invented banner goes |
| `src/features/questions/SignoffCard.tsx` (modify) | Signed state on the card edge; the export's footer sentence |
| `src/features/questions/SignoffRow.tsx` (modify) | Per-line answer options; receded unchosen buttons |
| `src/features/questions/SignoffRowNotes.tsx` (modify) | Drops the positive machine-check line and the group tag |
| `src/features/questions/OrderIdentityStrip.tsx` (modify) | Client pair; top accent; no signature pair |
| `src/features/overview/OverviewScreen.tsx` (modify) | `Screen 1340 / 26x30 / top` |
| `src/features/overview/StageColumn.tsx` (modify) | Three-line header; machine caption; `OrderMiniCard` |
| `src/features/overview/StageRail.tsx` (modify) | Same three lines as the column |
| `src/features/overview/FailedBanner.tsx` (modify) | `OrderMiniCard`; no accent; the export's sentence |
| `src/features/overview/OrderCard.tsx` (delete) | Absorbed by `entities/order/OrderMiniCard` |
| `src/features/overview/useNarrowViewport.ts` (modify) | Rail threshold 900px → 1190px |
| `src/features/queue/QueueScreen.tsx` (modify) | `Screen 860 / 28x32 / top`; the quiet-state card |
| `src/features/queue/QueueSections.tsx` (modify) | Four bands off `entities/order/OrderRow` |
| `src/features/queue/QueueBand.tsx` (modify) | `tone` prop; server `count` in the note |
| `src/features/queue/NextOrderCard.tsx` (modify) | `accent="action"`; product chip and size line |
| `src/app/OrderCounts.tsx` (modify) | The export's three count behaviours; the false comment deleted |
| `src/features/completeness/CompletenessScreen.tsx` (modify) | `Screen 720 / 32x40 / top`; the `GATE VERDICT` toggle removed |
| `src/features/completeness/GapCard.tsx` (modify) | `SignoffLineTitle`; `Card accent`; the export's rhythm |
| `src/features/completeness/GapCloseOptions.tsx` (modify) | Ranked options off `close_options.kind` |
| `src/features/completeness/GapClosureForm.tsx` (modify) | One form, tone driven by kind |
| `src/features/completeness/GateBanner.tsx` (delete) | Promoted to `entities/gate` so the gallery can draw it |
| `src/entities/gate/GateBanner.tsx` (create) | Both gate banners, shared by completeness and gallery |
| `src/entities/gate/pipelineCta.ts` (create) | The CTA's label and tone from `gate_halted`, shared with the gallery |
| `src/features/processing/ProcessingScreen.tsx` (modify) | `Screen 700 / 40 / centre`; the `GATE OUTCOME` toggle removed |
| `src/features/processing/StageRow.tsx` (modify) | The false owner-parity WHY note corrected |
| `src/features/gallery/GalleryScreen.tsx` (modify) | `Screen 1120 / 28x32 / top`; auto-fill grid |
| `src/features/gallery/UnreachableGateStates.tsx` (create) | The two moved `LOCAL PREVIEW` renderings, live |
| `src/features/gallery/StateSample.tsx` (modify) | Drops the 4px left edge the export never draws |
| `src/features/gallery/StateCard.tsx` (modify) | `items-start`; panel surface for the no-value sample |
| `src/features/rulebook/RulebookScreen.tsx` (modify) | `Screen 1160 / 24x28 / top` |
| `src/features/rulebook/RuleList.tsx` (modify) | Selection by fill only |
| `src/features/rulebook/RetireBlock.tsx` (modify) | The refusal string, verbatim |
| `src/features/products/ProductsScreen.tsx` (modify) | `Screen 1040 / 28x32 / top` |
| `src/features/products/ProductList.tsx` (modify) | Two-line row; `size="sm"` section button |
| `src/features/clients/ClientsScreen.tsx` (modify) | `Screen 880 / 28x32 / top`; header before the query state |
| `src/features/clients/SignoffDefaults.tsx` (modify) | Auto-fill grid at the export's 230px track |
| `src/features/clients/CompareMatrix.tsx` (modify) | Sticky header row |
| `src/entities/config/lineRef.ts` (create) | `L01`-shaped line reference, three call sites |
| `src/features/people/PeopleScreen.tsx` (modify) | `Screen 900 / 28x32 / top`; footnote inside the resolved branch |
| `src/features/people/PersonRow.tsx` (modify) | `ListRow`; the export's first-row hairline |
| `src/features/people/MfaGateBanner.tsx` (modify) | No left accent |
| `src/features/audit/AuditScreen.tsx` (modify) | `Screen 940 / 28x32 / top`; `Card` |
| `src/features/audit/actionLabels.ts` (create) | The closed action vocabulary in the export's phrasing |
| `src/features/audit/AuditRow.tsx` (modify) | `ListRow`; sentence + labelled reference |
| `src/features/escalations/EscalationsScreen.tsx` (modify) | `Screen 700 / 28x32 / top`; the held register |
| `src/features/escalations/ClusterRail.tsx` (modify) | Sunken rail, nested cards, pluralised count |
| `src/features/escalations/ResolveCard.tsx` (modify) | Shared `Select`; the export's placeholders; `Quote` |
| `src/shared/plural.ts` (create) | `countOf(n, singular, plural?)` — four call sites |
| `src/features/profile/ProfileScreen.tsx` (modify) | `Screen 720 / 28x32 / top` |
| `src/features/profile/PreferencesCard.tsx` (modify) | Three preferences on the wire; the false gap note deleted |
| `src/app/preferences.ts` (modify) | `usePreference(key)` replaces three near-identical hooks |
| `src/features/delivered/DeliveredScreen.tsx` (modify) | `CenteredScreen measure="460"` |
| `src/features/session/SessionEndedScreen.tsx` (modify) | `CenteredScreen measure="420"` |
| `src/features/signin/SigninScreen.tsx` (modify) | `CenteredScreen measure="380"`; shared `PipeMark` |
| `src/features/surfacefail/SurfaceFailureScreen.tsx` (modify) | `CenteredScreen measure="440"` |
| `src/shared/ui/PipeMark.tsx` (create) | One mark, one opacity ladder, two sizes |

---

### Task 1: Review — the two-pane workstation, and one list of decisions

**Files:**
- Modify: `apps/web-v2/src/features/review/ReviewScreen.tsx:107-147`
- Modify: `apps/web-v2/src/features/review/EvidenceColumn.tsx:1-28`
- Modify: `apps/web-v2/src/features/review/FieldsColumn.tsx:59-92`
- Modify: `apps/web-v2/src/features/review/ReportPane.tsx:28-39`
- Modify: `apps/web-v2/src/features/review/DocumentColumn.tsx` (drop `PageStrip`)
- Modify: `apps/web-v2/src/features/review/CoverageSpine.tsx:70-114`
- Create: `apps/web-v2/src/features/review/RestOfQueue.tsx`
- Delete: `apps/web-v2/src/features/review/FieldList.tsx`
- Delete: `apps/web-v2/src/features/review/ReviewHeader.tsx`
- Delete: `apps/web-v2/src/features/review/OrderRail.tsx`
- Test: `apps/web-v2/src/features/review/RestOfQueue.stories.tsx`
- Test: `apps/web-v2/e2e/invariants/review-frame.spec.ts`

**Interfaces:**

Consumes, from the pinned contract (index §`Pane`, §`Screen`):

```tsx
export function Pane(props: PaneProps): ReactElement        // flex flex-col min-h-0
export function PaneHeader(props: PaneProps): ReactElement  // flex-none
export function PaneBody(props: PaneProps): ReactElement    // flex-1 min-h-0 overflow-y-auto
export function PaneFooter(props: PaneProps): ReactElement  // flex-none
export function Screen(props: ScreenProps): ReactElement    // placement="bleed" here
```

Consumes, from Wave 3. **These signatures are not in the index; they are stated here in full and are the contract Wave 3 must satisfy.**

```tsx
// src/entities/order/OrderContextRow.tsx
export interface OrderContextRowProps {
  productName: string;
  periodLabel: string;
  configVersion?: string;   // absent → the chip is not drawn
}
export function OrderContextRow(props: OrderContextRowProps): ReactElement;

// src/entities/field/DecisionRow.tsx — the card-shaped collapsed decision row
export interface DecisionRowProps {
  field: Field;                       // @titlepipe/contract
  onActivate: () => void;
  selected?: boolean;
}
export function DecisionRow(props: DecisionRowProps): ReactElement;
// renders data-testid={`row-${field.path}`}, an 8px status dot, a
// `SECTION · FIELD` eyebrow, the mono value, and the server state word
// right-aligned. The whole card is the <button>.

// src/entities/document/PageSpine.tsx
export type PageSpineTier = "needs_you" | "cited" | "read" | "degraded" | "partial" | "unseen";
export interface PageSpineCell { n: number; tier: PageSpineTier }
export interface PageSpineProps {
  cells: readonly PageSpineCell[];
  currentPage: number;
  onSelect: (n: number) => void;
}
export function PageSpine(props: PageSpineProps): ReactElement;
```

Produces:

```tsx
// src/features/review/RestOfQueue.tsx
export function RestOfQueue(props: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/review/RestOfQueue.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { RestOfQueue } from "./RestOfQueue";

const meta = {
  title: "Review/RestOfQueue",
  component: RestOfQueue,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RestOfQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

const SELECTED = "owner.zip";
const decisions = demoFields.filter((f) => f.state !== "auto_confirmed");
const rest = decisions.filter((f) => f.path !== SELECTED);
const auto = demoFields.find((f) => f.state === "auto_confirmed");

/**
 * B4. The export's own comment: "The dock holds ONLY the card you are working.
 * Everything else — answered rows, the rest of the queue, the NO disclosures —
 * lives in the scrolling pane" (`:3147`). One list, one heading, and the
 * heading's count is the rows it heads.
 */
export const OneRowPerDecisionAndTheHeadingCountsThem: Story = {
  args: { fields: demoFields, selectedPath: SELECTED, onSelect: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("rest-of-queue-heading")).toHaveTextContent(
      `Rest of the queue · ${rest.length}`,
    );
    await expect(canvas.getAllByTestId(/^row-/)).toHaveLength(rest.length);
    await expect(canvas.queryByTestId(`row-${SELECTED}`)).toBeNull();
  },
};

/**
 * B4, the other half. `auto_confirmed` fields were never anybody's decision, so
 * they never appear on a surface headed "queue" — and the SETTLED card that
 * reprinted all fifteen of them ~900px above the identical rows in the Call
 * Back Sheet is gone with them.
 */
export const NoSettledCardAndNoAutoConfirmedRows: Story = {
  args: { fields: demoFields, selectedPath: SELECTED, onSelect: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/look, do not re-decide/i)).toBeNull();
    await expect(canvas.queryByText(/^Settled$/i)).toBeNull();
    if (auto) await expect(canvas.queryByTestId(`row-${auto.path}`)).toBeNull();
  },
};
```

Create `apps/web-v2/e2e/invariants/review-frame.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

/**
 * The export roots Review at `height:100%` over `flex:1;min-height:0;display:flex`
 * (`:664`, `:673`) and gives each pane its own scroller — the fullPage capture
 * is exactly one 1000px viewport. The app's capture was 3276px, so scrolling to
 * read the sheet scrolled the document, the coverage map AND the open decision
 * off screen. This asserts the frame, not the pixels.
 */
test("the review page itself never scrolls — the panes do", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("decision-dock")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement;
    return el === null ? 0 : el.scrollHeight - el.clientHeight;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});

/** Both panes own a scroller, and the coverage spine is pinned below the left one. */
test("document and report each scroll inside their own pane", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/orders/ord_demo_1/review");
  const report = page.getByTestId("report-scroller");
  await expect(report).toBeVisible();
  await report.evaluate((el) => el.scrollBy(0, 600));
  await expect(page.getByTestId("coverage-spine")).toBeInViewport();
  await expect(page.getByTestId("decision-dock")).toBeInViewport();
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/review-frame.spec.ts
```

Expected failures, exactly:
- Vitest: `Failed to resolve import "./RestOfQueue" from "src/features/review/RestOfQueue.stories.tsx"` — the module does not exist.
- Playwright, test 1: `expect(received).toBeLessThanOrEqual(expected)` with received ≈ `2276` — the page scrolls 3276px in a 1000px viewport.
- Playwright, test 2: `expect(locator).toBeVisible()` fails on `getByTestId("report-scroller")` — no such element; the report is in the page scroll.

- [ ] **Step 3: Implement — the one list of decisions (B4)**

Create `apps/web-v2/src/features/review/RestOfQueue.tsx`:

```tsx
import type { Field } from "@titlepipe/contract";
import { DecisionRow } from "../../entities/field/DecisionRow";
import { DECISION_STATES } from "./reportSections";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * ONE LIST OF DECISIONS, AND ITS HEADING COUNTS THE ROWS IT HEADS.
 *
 * The screen used to print every field value twice: a `SETTLED 15 — look, do
 * not re-decide` card here, and the identical fifteen rows ~900px below in the
 * Call Back Sheet, with the six decisions that need a person sandwiched between
 * two copies of the same twenty-one facts. The old file named that risk in its
 * own docstring and then did it. Settled and auto-confirmed values stay
 * visible — in the sheet, each with its page cite — so nothing a reviewer must
 * be able to inspect is hidden; it is simply stated once.
 *
 * `auto_confirmed` NEVER APPEARS ON A SURFACE HEADED "QUEUE". It was never
 * anybody's decision, and mixing it in makes the queue's own count a lie.
 * `DECISION_STATES` is the server's set, not a confidence threshold.
 *
 * THE HEADING'S NUMBER IS `rows.length`. The dock used to print `Rest of the
 * queue · 17` — every decision including the twelve already answered — directly
 * above a list of six.
 */
export function RestOfQueue({
  fields,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const rows = fields.filter(
    (field) => DECISION_STATES.has(field.state) && field.path !== selectedPath,
  );

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow variant="section" as="h2" data-testid="rest-of-queue-heading">
        Rest of the queue &middot; {rows.length}
      </Eyebrow>
      {rows.length === 0 ? (
        <p className="text-base text-ink-secondary">
          Every decision on this order is answered.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((field) => (
            <DecisionRow
              key={field.id}
              field={field}
              onActivate={() => onSelect(field.path)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

Delete `apps/web-v2/src/features/review/FieldList.tsx` and `apps/web-v2/src/features/review/FieldRow.tsx` (the review-local second row renderer; `entities/field/DecisionRow` replaces it — Wave 3 promoted it). Delete `apps/web-v2/src/features/review/ReviewHeader.tsx` — the export draws no screen title and no instructional band on Review, and its `14 of 20 answered` was the third contradictory count on one screen. Delete `apps/web-v2/src/features/review/OrderRail.tsx` — it duplicates the sidebar's lifecycle rail and contradicts the shell, saying `delivered v1` and `still queued` on an order the strip stamps `NOT SIGNED`.

In `DecisionDock.tsx`, delete the `Rest of the queue · N` line at `:93` — the dock keeps the eyebrow, `N of M answered`, the segment meter and the key legend, and nothing else. Add `data-testid="decision-dock"` to its root.

- [ ] **Step 4: Implement — the two-pane workstation**

Replace `ReviewScreen.tsx:107-147` (the returned JSX) with:

```tsx
  return (
    /*
     * THE EXPORT'S FRAME, NOT A PAGE. Root `height:100%` flex column (`:664`)
     * over `flex:1;min-height:0;display:flex` (`:673`); LEFT `flex:1 1 52%` on
     * the document backdrop with a border-right (`:675`), RIGHT `flex:1 1 48%`
     * on the app ground (`:833`). The section rail is a block INSIDE the right
     * pane, not a third top-level column — the declarations settle it.
     *
     * `placement="bleed"` is why this screen alone takes no measure and no
     * padding: the panes ARE the padding, and a centred column would put the
     * document and the decision two gutters apart.
     */
    <Screen placement="bleed">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-[1_1_52%] flex-col border-r border-line-strong bg-surface-document">
          <EvidenceColumn
            orderId={orderId}
            field={selected}
            pinnedReading={pinned?.reading ?? null}
          />
        </div>
        <div className="flex min-h-0 flex-[1_1_48%] flex-col bg-surface-app">
          <FieldsColumn
            fields={fields}
            signoffLines={signoff.data?.lines ?? []}
            selected={selected}
            pinned={pinned}
            mode={mode}
            seed={editorSeed}
            passPending={pass.isPending}
            serverNote={confirm.error instanceof ApiError ? confirm.error.message : null}
            blankNote={blankNote}
            onPin={setPinned}
            onAdopt={adopt}
            onConfirm={submitConfirm}
            onCorrect={openCorrect}
            onMode={setMode}
            onCorrectSubmit={(value, reason) =>
              correct.mutate({ fieldId: selected.id, value, reason }, { onSuccess: advance })
            }
            onEscalateSubmit={(question) =>
              escalate.mutate({ fieldId: selected.id, question }, { onSuccess: advance })
            }
            onExcludeSubmit={(reason) =>
              exclude.mutate({ fieldId: selected.id, reason }, { onSuccess: advance })
            }
            onPassSubmit={(reason) => pass.mutate(reason, { onSuccess: () => setMode("idle") })}
            onSelect={reselect}
          />
        </div>
      </div>
    </Screen>
  );
```

Swap the `ReviewHeader` import for `import { Screen } from "../../shared/ui/Screen";`.

Replace `EvidenceColumn.tsx` in full:

```tsx
import type { Field, FieldReading } from "@titlepipe/contract";
import { DocumentColumn } from "./DocumentColumn";
import { OrderCoverageSpine } from "./CoverageSpine";
import { Pane, PaneBody, PaneFooter } from "../../shared/ui/Pane";

/**
 * THE LEFT PANE: the document, and the coverage map pinned under it.
 *
 * The spine is a `PaneFooter` — `flex-0 0 auto` in the export (`:809`) — because
 * "what have I not looked at" has to be answerable at the moment you are
 * deciding, not after a scroll. Only the document body moves.
 *
 * THE ORDER'S HISTORY IS NOT HERE. It was a third card in this column
 * duplicating the sidebar's lifecycle rail, supplying the screen's third
 * answered-count, and contradicting the shell about the order's state.
 */
export function EvidenceColumn({
  orderId,
  field,
  pinnedReading,
}: {
  orderId: string;
  field: Field;
  pinnedReading: FieldReading | null;
}) {
  return (
    <Pane className="flex-1">
      <PaneBody className="p-6">
        <DocumentColumn orderId={orderId} field={field} pinned={pinnedReading} />
      </PaneBody>
      <PaneFooter className="border-t border-line-strong bg-surface-panel px-7 py-5">
        <OrderCoverageSpine orderId={orderId} />
      </PaneFooter>
    </Pane>
  );
}
```

Replace `FieldsColumn.tsx`'s returned JSX (`:59-92`) with:

```tsx
  return (
    <Pane className="flex-1">
      {/*
       * PINNED, IN THE EXPORT'S ORDER: the scope-of-search reminder (`:835`),
       * the decision dock (`:845`), the open card, then Finalize (`:908`). All
       * four are `flex-none` because a reviewer must never have to scroll to
       * find what they are answering or what it is scoped to.
       */}
      <PaneHeader className="flex flex-col border-b border-line-strong bg-surface-panel">
        <OrderContextRow
          productName={order.product}
          periodLabel={order.period}
          configVersion={order.config_version}
        />
        <div className="flex flex-col gap-5 px-7 py-5">
          <DecisionDock fields={fields} selectedPath={selected.path} />
          <DecisionColumn
            field={selected}
            pinned={pinned}
            mode={mode}
            seed={seed}
            machineValue={selected.value ?? ""}
            passPending={passPending}
            serverNote={serverNote}
            blankNote={blankNote}
            onPin={onPin}
            onAdopt={onAdopt}
            onConfirm={onConfirm}
            onCorrect={onCorrect}
            onMode={onMode}
            onCorrectSubmit={onCorrectSubmit}
            onEscalateSubmit={onEscalateSubmit}
            onExcludeSubmit={onExcludeSubmit}
            onPassSubmit={onPassSubmit}
          />
          <FinalizeBar fields={fields} signoffLines={signoffLines} />
        </div>
      </PaneHeader>

      <ReportPane
        fields={fields}
        signoffLines={signoffLines}
        selectedPath={selected.path}
        onSelect={onSelect}
      />
    </Pane>
  );
```

`FieldsColumn` gains an `order: OrderContext` prop, where `OrderContext` is the order-scoped shape Wave 2 added:

```tsx
/** Wave 2's order-scoped read shape, as consumed here. */
interface OrderContext {
  product: string;
  period: string;
  config_version: string;
}
```

`ReviewScreen` reads it from `data.order` on the fields response and passes it down. `FieldList`'s import and its `<FieldList …/>` line go; the list is now inside `ReportPane`.

Replace `ReportPane.tsx:28-39` with:

```tsx
  return (
    <div className="flex min-h-0 flex-1">
      <PaneBody data-testid="report-scroller" className="flex flex-col gap-6 px-7 py-6 pb-20">
        <RestOfQueue fields={fields} selectedPath={selectedPath} onSelect={onSelect} />
        <NoDisclosureCards lines={signoffLines} />
        <CallBackSheet fields={fields} selectedPath={selectedPath} onSelect={onSelect} />
      </PaneBody>
      {/*
       * THE RAIL IS A RAIL, not a card in a grid: `flex:0 0 152px` beside the
       * report scroller (`:1068`), so it sits next to the sheet for the sheet's
       * whole length instead of scrolling away 2000px above its own targets.
       * Hidden below 900px, as the export hides it (`:3763`).
       */}
      <div className="hidden w-76 flex-none overflow-y-auto border-l border-line-strong bg-surface-panel md:block">
        <SectionRail fields={fields} />
      </div>
    </div>
  );
```

In `DocumentColumn.tsx`, delete the `PageStrip` import and its render at `:90-97`: HANDOFF-UI §11 says the coverage spine replaced the read-pages chip strip, and shipping both left two navigation surfaces for one package with the retired one interactive. `PageStrip` stays in `entities/document` for any screen that still wants it.

In `CoverageSpine.tsx`, delete the duplicated heading (the `Eyebrow` at `:82` above the paragraph at `:84`), render the export's one-line summary beside a single eyebrow — `COVERAGE · ALL {total} PAGES  {needYou} need you · {cited} cited · {read} read only · {unseen} never opened · {total} total` — and delegate the cells to `PageSpine` with the count-first legend. The two citation tiers are a join over provenance the server already sent (`Field.source_page` + `Field.state`), never a re-derivation of server state; keep the server's `degraded`/`partial` distinction underneath them, because product rule 2 requires it stay greyscale-distinguishable.

- [ ] **Step 5: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/review-frame.spec.ts e2e/invariants/review.spec.ts
```

- [ ] **Step 6: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Review /orders/ord_demo_1/review ../../shots
```

Open `shots/design-review.png` beside `shots/app-review.png`. The app capture must now be one 1000px frame, not 3276px. Confirm by eye: the document, the coverage map, the ORDERED strip, the dock, the open decision card and Finalize are all visible at once; the report scrolls under them; the section rail sits beside the sheet.

- [ ] **Step 7: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

`knip` must report `FieldList.tsx`, `ReviewHeader.tsx`, `OrderRail.tsx` and `features/review/FieldRow.tsx` as removed, not as unused — if it names them, a delete was missed.

- [ ] **Step 8: Commit**

```
git add apps/web-v2/src/features/review apps/web-v2/e2e/invariants/review-frame.spec.ts
git commit -m "$(cat <<'EOF'
Rebuild Review as the export's two-pane workstation

The screen printed every field value twice — a SETTLED card listing all
fifteen non-queued fields, and the identical fifteen rows ~900px below in
the Call Back Sheet — with the six decisions that need a person sandwiched
between two copies of the same facts, and auto_confirmed fields mixed into
a surface headed "Decision queue". One list now, headed by the count of the
rows it heads.

The frame follows the export's own declarations: root height:100% over a
min-height:0 flex row, left pane 52% on the document backdrop with the
coverage spine pinned under it, right pane 48% with the ordered strip, the
dock, the open card and Finalize pinned above a scrolling report. The page
itself no longer scrolls, so nothing a reviewer is answering can leave the
screen. The order rail, the screen header and the retired page strip go
with it — each was a second, contradicting copy of something the shell or
the spine already says.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Upload — the export's four blocks, and a client picker

**Files:**
- Modify: `apps/web-v2/src/features/ingest/IngestScreen.tsx:19-146`
- Modify: `apps/web-v2/src/features/ingest/orderFields.ts:1-8`
- Modify: `apps/web-v2/src/features/ingest/OrderForm.tsx`
- Modify: `apps/web-v2/src/features/ingest/AcceptedCard.tsx:25-27`
- Modify: `apps/web-v2/src/features/ingest/PackageChip.tsx:31-34`
- Create: `apps/web-v2/src/features/ingest/ClientPicker.tsx`
- Create: `apps/web-v2/src/features/ingest/ProductPicker.tsx`
- Create: `apps/web-v2/src/features/ingest/queries.clients.ts` (the two config reads)
- Test: `apps/web-v2/src/features/ingest/ClientPicker.stories.tsx`
- Test: `apps/web-v2/e2e/invariants/ingest.spec.ts` (extend, do not weaken)

**Interfaces:**

Consumes, from Wave 1 and Wave 3 (`ChoiceCardGrid` is Wave 3 and unpinned — its full signature is stated here and is the contract Wave 3 must satisfy):

```tsx
export function Screen(props: ScreenProps): ReactElement;
export interface ScreenHeadingProps { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode; size?: "22" | "26"; actions?: ReactNode }
export function ScreenHeading(props: ScreenHeadingProps): ReactElement;

// src/shared/ui/ChoiceCardGrid.tsx
export interface ChoiceCardOption { id: string; title: string; sub?: string }
export interface ChoiceCardGridProps {
  label: string;                       // the eyebrow above the grid
  columns: 2 | 3;
  options: readonly ChoiceCardOption[];
  value: string | null;
  onSelect: (id: string) => void;
  name: string;                        // radiogroup name; wires aria
}
export function ChoiceCardGrid(props: ChoiceCardGridProps): ReactElement;
```

Consumes, already on the wire (this is the whole of B6): `GET /api/clients` → `ClientsResponse` (`packages/contract/src/workspace.ts:131`, served at `packages/mocks/src/workspace.ts:305`), each client `{ id, code, name }`. And `GET /api/config/products` → `ConfigResponse.products`, each `{ code, full, sub, period }`.

Produces:

```tsx
// src/features/ingest/ClientPicker.tsx
export function ClientPicker(props: { value: string | null; onSelect: (clientId: string) => void }): ReactElement;

// src/features/ingest/ProductPicker.tsx
export function ProductPicker(props: {
  value: string | null;
  onSelect: (productCode: string) => void;
  priorEffectiveDate: string;
  onPriorEffectiveDate: (value: string) => void;
}): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/ingest/ClientPicker.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ClientPicker } from "./ClientPicker";

const meta = {
  title: "Ingest/ClientPicker",
  component: ClientPicker,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ClientPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * B6. `GET /api/clients` already serves `{id, code, name}` — the picker submits
 * the server's id, so a mistyped client can no longer resolve the wrong
 * sign-off list, which is the one thing intake decides.
 */
export const ChoosesAClientAndEmitsItsServerId: Story = {
  args: { value: null, onSelect: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByRole("radio", { name: /Riverbend Title/ });
    await userEvent.click(card);
    await expect(args.onSelect).toHaveBeenCalledWith("cli_demo_1");
  },
};

/** The code is on the card, in mono, under the name — the export's two lines. */
export const ShowsTheClientCodeUnderTheName: Story = {
  args: { value: "cli_demo_1", onSelect: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByRole("radio", { name: /Riverbend Title/ });
    await expect(card).toHaveTextContent("RVB");
    await expect(card).toBeChecked();
  },
};
```

Extend `apps/web-v2/e2e/invariants/ingest.spec.ts` with:

```ts
/**
 * B5. The export's body below the drop zone is four blocks — a file receipt, a
 * 2-col CLIENT grid, a 3-col six-card PRODUCT grid, and a forward link — with
 * exactly ONE text input on the whole screen (the conditional prior-effective-
 * date box, which only appears for an Update).
 */
test("upload leads with the client and product pickers, not a text form", async ({ page }) => {
  await page.goto("/ingest");
  await expect(page.getByTestId("client-grid")).toBeVisible();
  await expect(page.getByTestId("product-grid")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload the package" })).toBeVisible();
  await expect(page.getByText("THE ORDER · WHAT THE PDF CANNOT SAY")).toHaveCount(0);
});

/** Two acts stay (ingest.spec #2); the export's copy lands on the press that advances. */
test("the second act reads Continue to sign-off", async ({ page }) => {
  await page.goto("/ingest");
  await page.getByTestId("client-card-cli_demo_1").click();
  await page.getByTestId("product-card-COS").click();
  await page.getByRole("button", { name: "Upload the package" }).click();
  await expect(page.getByTestId("accept-btn")).toHaveText("Continue to sign-off →");
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/ingest.spec.ts
```

Expected failures:
- Vitest: `Failed to resolve import "./ClientPicker"` — the module does not exist.
- Playwright test 1: `expect(locator).toBeVisible()` on `getByTestId("client-grid")` — no such element; and the `toHaveCount(0)` assertion fails with `1`, because the invented three-clause eyebrow is on screen.
- Playwright test 2: `locator.click` times out on `getByTestId("client-card-cli_demo_1")`.

- [ ] **Step 3: Implement — delete the false note, and the pickers**

Delete `IngestScreen.tsx:38-44` in full. The note claims "Nothing lists either"; `GET /api/clients` has always served `{id, code, name}`, so the note is factually wrong for clients and a comment asserting an untruth is worse than no comment. The product half of the gap is real and moves onto the screen beside the product grid, where §5 requires it.

Create `apps/web-v2/src/features/ingest/queries.clients.ts`:

```tsx
import { queryOptions } from "@tanstack/react-query";
import { ClientsResponse, ConfigResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The two reads intake needs to name what was ordered. Both already exist on
 * the wire; the screen used to take a typed client id instead, and a mistype
 * resolves the wrong sign-off list.
 */
export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: () => get("/api/clients", ClientsResponse),
});

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: () => get("/api/config", ConfigResponse),
});
```

Create `apps/web-v2/src/features/ingest/ClientPicker.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { ChoiceCardGrid } from "../../shared/ui/ChoiceCardGrid";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { clientsQuery } from "./queries.clients";

/**
 * THE CLIENT IS PICKED, NEVER TYPED — it is what resolves the effective
 * sign-off, and a mistyped id resolves the wrong list silently. The export
 * draws a 2-column card grid here and the endpoint already serves it.
 *
 * The card carries the name and the client's own code, because the code is
 * what people say out loud and the name is what they recognise; either alone
 * makes somebody check the other screen.
 */
export function ClientPicker({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (clientId: string) => void;
}) {
  const { data } = useQuery(clientsQuery);
  const clients = data?.clients ?? [];

  if (data !== undefined && clients.length === 0) {
    return <EmptyNote>No client is configured — intake cannot resolve a sign-off list.</EmptyNote>;
  }

  return (
    <div data-testid="client-grid">
      <ChoiceCardGrid
        label="Client · required · resolves the effective sign-off"
        columns={2}
        name="client"
        value={value}
        onSelect={onSelect}
        options={clients.map((client) => ({
          id: client.id,
          title: client.name,
          sub: client.code,
        }))}
      />
    </div>
  );
}
```

Create `apps/web-v2/src/features/ingest/ProductPicker.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { ChoiceCardGrid } from "../../shared/ui/ChoiceCardGrid";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { ContractGapNote } from "../../shared/ui/ContractGapNote";
import { configQuery } from "./queries.clients";

/**
 * THE PRODUCT SETS THE QUESTIONS AND THE SCOPE, so it is chosen where the order
 * is created, not inferred later. Six cards in three columns, as the export
 * draws them.
 *
 * CONTRACT GAP, STATED ON SCREEN: `CreateOrderRequest` carries no product and
 * no prior-effective-date, so this grid records a choice the POST cannot yet
 * send. The block still ships, because it is what tells a person the product is
 * chosen at intake at all — §5's visible-and-disabled rule with its note.
 *
 * THE DATE BOX IS THE SCREEN'S ONLY TEXT INPUT, and it exists only for an
 * Update: without a prior effective date, three sign-off lines have no defined
 * scope, which is a statement about the search, not a form-validation nicety.
 */
export function ProductPicker({
  value,
  onSelect,
  priorEffectiveDate,
  onPriorEffectiveDate,
}: {
  value: string | null;
  onSelect: (productCode: string) => void;
  priorEffectiveDate: string;
  onPriorEffectiveDate: (value: string) => void;
}) {
  const { data } = useQuery(configQuery);
  const products = (data?.products ?? []).filter((product) => !product.retired);
  const isUpdate = products.find((product) => product.code === value)?.derivation === "p";

  return (
    <div className="flex flex-col gap-5" data-testid="product-grid">
      <ChoiceCardGrid
        label="Product ordered · sets the questions and the scope"
        columns={3}
        name="product"
        value={value}
        onSelect={onSelect}
        options={products.map((product) => ({
          id: product.code,
          title: product.code,
          sub: product.sub,
        }))}
      />
      <ContractGapNote text="POST /api/orders carries no product and no prior effective date — the choice is recorded on screen and not yet sent." />
      {isUpdate ? (
        <Card accent="action">
          <CardBody className="flex flex-col gap-4">
            <Eyebrow variant="field" as="label" htmlFor="prior-effective-date">
              Prior search effective date — required for an Update
            </Eyebrow>
            <TextField
              id="prior-effective-date"
              inputMode="numeric"
              placeholder="MM/DD/YYYY"
              value={priorEffectiveDate}
              onChange={(event) => onPriorEffectiveDate(event.target.value)}
            />
            <p className="text-xs text-ink-secondary">
              Without it, three sign-off lines have no defined scope.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement — the screen's four blocks**

`orderFields.ts` loses `client_id` (the picker owns it now):

```tsx
/** The four fields the PDF cannot say and no picker can resolve. */
export const ORDER_FIELDS = [
  { key: "external_ref", label: "Order #" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "state", label: "State" },
  { key: "county", label: "County" },
] as const;
```

`IngestScreen.tsx`'s body becomes, in the export's order: `DropZone` → `PackageChip` (the file receipt) → `ClientPicker` → `ProductPicker` → the four-field `OrderForm` under one factual `Eyebrow` reading `The order` → the full-width primary. The three-clause eyebrow (`THE ORDER · WHAT THE PDF CANNOT SAY · THE DOOR DECIDES WHAT IS COMPLETE`) appears nowhere in the export and goes. The root becomes `<Screen measure="560" pad="40" placement="centre">`, and the hand-rolled `mx-auto flex w-full max-w-280 flex-col gap-9` wrapper at `:80` goes with it. `ScreenTitle` + `h1` + lede become one `ScreenHeading`.

The submit appends `client_id` from the picker's state and the four text fields; `product_code` and `prior_effective_date` are held in state and rendered, not posted — the `ContractGapNote` says so.

Button copy, per the settled ruling (ingest keeps two acts, `ingest.spec` #2, and borrows the export's words): press one is `Upload the package` (capitalised — currently lowercase `upload the package`), press two is `Continue to sign-off →` (currently `Sign for this package`). `AcceptedCard` gains the same primary as a `Link to="/questions"` beside `ingest another`, so the export's Step 1 → Step 2 hand-off exists.

The primary renders muted (Button's disabled fill: ground + ink-muted, not a faded primary) until a file AND a client exist — both are local facts. **Do not add client-side required-field validation**: `OrderForm.tsx:6-13` is right that the door owns what a complete order is, and the server's refusal renders in `RefusedCard`.

- [ ] **Step 5: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/ingest.spec.ts
```

- [ ] **Step 6: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Upload /ingest ../../shots
```

Compare with `shots/design-upload.png`. Four blocks below the drop zone, a 560px column optically centred in the pane, exactly one text input visible (none until a product with an Update derivation is picked), and the forward link at the foot.

- [ ] **Step 7: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 8: Commit**

```
git add apps/web-v2/src/features/ingest apps/web-v2/e2e/invariants/ingest.spec.ts
git commit -m "$(cat <<'EOF'
Rebuild Upload around the client and product pickers

Intake was five bare text inputs where the export has a file receipt, a
two-column client grid, a six-card product grid and a forward link — one
text box on the whole screen, and only for an Update. The client is now
picked from GET /api/clients, which has served {id, code, name} all along:
a typed client id is strictly worse, because a mistype resolves the wrong
sign-off list and nothing on screen contradicts it.

The CONTRACT GAP note justifying the free-text picker claimed nothing
listed clients. It was wrong and is deleted; the real half of the gap —
POST /api/orders carries no product and no prior effective date — is now
stated on screen beside the grid it constrains.

Two acts stay, per ingest.spec #2, with the export's copy on the press that
advances the step: Upload the package, then Continue to sign-off.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Questions — the product's own sign-off list, at the export's measure

**Files:**
- Modify: `apps/web-v2/src/features/questions/QuestionsScreen.tsx:38-61`
- Modify: `apps/web-v2/src/features/questions/SignoffCard.tsx:55-120`
- Modify: `apps/web-v2/src/features/questions/SignoffRow.tsx:25-120`
- Modify: `apps/web-v2/src/features/questions/SignoffRowNotes.tsx:40-80`
- Modify: `apps/web-v2/src/features/questions/OrderIdentityStrip.tsx:20-55`
- Test: `apps/web-v2/src/features/questions/SignoffRow.stories.tsx`

**Interfaces:**

Consumes: `Screen`, `ScreenHeading`, `ContractGapNote` (Wave 1); `Card` with the corrected `accent` axis — a **2px inset top stripe**, values `"none" | "action" | "attend" | "halt" | "settled"`; `entities/signoff/SignoffLineTitle` (Wave 3, unpinned — stated here):

```tsx
export interface SignoffLineTitleProps { n: number; label: string }
export function SignoffLineTitle(props: SignoffLineTitleProps): ReactElement;
// renders `Sign-off line {n} · {label}` — one component, two screens
```

Consumes from Wave 2's contract additions: `OrderSignoffLine.answers: readonly SignoffAnswer[]`, `OrderSignoffLine.scope_note: string | null`, `OrderSignoffLine.policy_suggestion: SignoffAnswer | null`, `OrderSignoffResponse.client_name: string`, `OrderSignoffResponse.baseline_diff: string | null`.

Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/questions/SignoffRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSignoffLine } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { SignoffRow } from "./SignoffRow";

const YN_LINE: OrderSignoffLine = {
  line_id: "L02",
  n: 2,
  label: "Name search and GI run for all names",
  group: "Name search",
  answer: null,
  comment: null,
  comment_required: true,
  machine_check: "Recording dates span the ordered period",
  period_scoped: true,
  scope_note: "all names in the period",
  answers: ["YES", "NO"],
  policy_suggestion: "YES",
};

const meta = {
  title: "Questions/SignoffRow",
  component: SignoffRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SignoffRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The option set is PER LINE. Six of the product's thirteen are YES/NO only,
 * and offering N/A on a line that cannot fail to apply lets an abstractor claim
 * "not applicable" on a statement the product requires — with no machine check
 * to contradict it.
 */
export const AYesNoLineOffersTwoButtonsNotThree: Story = {
  args: { line: YN_LINE, onAnswer: () => {}, onComment: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "YES" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "NO" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "N/A" })).toBeNull();
  },
};

/**
 * The row carries at most three annotations: the scope/period chip, the dashed
 * NO MACHINE CHECK chip, and the not-answered line naming the suggested value.
 * The positive machine-check text and the group tag are not on this screen —
 * they added a line to all thirteen rows and are the main reason the card was
 * visibly taller than the export's.
 */
export const NoMachineCheckLineAndNoGroupTag: Story = {
  args: { line: YN_LINE, onAnswer: () => {}, onComment: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/MACHINE CHECK/)).toBeNull();
    await expect(canvas.queryByText("NAME SEARCH")).toBeNull();
    await expect(canvas.getByTestId("policy-suggestion")).toHaveTextContent(
      "Policy suggests YES",
    );
  },
};

/** The scope chip prepends the line's own narrowing text before the period. */
export const ScopeChipNamesTheSpanItIsAnsweredAgainst: Story = {
  args: { line: YN_LINE, onAnswer: () => {}, onComment: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("scope-chip")).toHaveTextContent(
      "all names in the period · 40-year period · 07/18/1986 – 07/18/2026",
    );
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failures: story 1 — `expect(received).toBeNull()` receives the `N/A` button, because `SignoffRow.tsx:30` hard-codes `["YES","NO","N/A"]`; story 2 — `queryByText(/MACHINE CHECK/)` returns the element rendered at `SignoffRowNotes.tsx:57-64`; story 3 — `getByTestId("scope-chip")` throws `Unable to find an element by: [data-testid="scope-chip"]`.

- [ ] **Step 3: Implement**

`SignoffRow.tsx`: replace the module-level `OPTIONS` constant with `const options = line.answers;` and drop the acknowledging comment at `:25-28` — the contract now carries the field, so the gap is closed rather than described. On an answered row, render the unchosen options recessed (`Button fill="recessed"`: `border-line-subtle` + `text-ink-muted`), so a scan down the card finds only the rows still owing an answer.

`SignoffRowNotes.tsx`: delete the positive `MACHINE CHECK` line at `:57-64` and the group tag appended at `SignoffRow.tsx:96-98`. Keep the dashed `NO MACHINE CHECK` chip — it is the load-bearing case. Give the scope chip `data-testid="scope-chip"` and render `{line.scope_note} · {periodLabel}` when `scope_note` is present, `{periodLabel}` otherwise. Give the not-answered line `data-testid="policy-suggestion"` and print `Policy suggests {line.policy_suggestion}`, outlining the matching button — the contract now carries the value, so the honest generic sentence it replaced is no longer the honest one.

`SignoffCard.tsx`: delete the full-width `Not signed…` banner at `:78-86`. The per-row annotation already carries the statement where it applies, and `Not signed` duplicates the identity strip. Express signed/unsigned on the card edge as the export does — `border-t` dashed while unsigned, solid once signed. Use the export's footer sentence verbatim: `All 13 sign-off lines answered — this signs your work and starts the pipeline.` The dropped clause is the one that tells the abstractor the press is a signature. Add the `ContractGapNote` beside the permanently-disabled `Start pipeline →`, the way `ProductList.tsx:111-115` already does — a disabled primary with no stated reason reads as a bug.

`OrderIdentityStrip.tsx`: add the `CLIENT` pair (the contract now carries `client_name`), move the accent from `border-l` to the corrected `Card accent="action"` (a 2px inset top stripe), and drop the `SIGNED / Not signed` pair — the card edge states it now, and carrying both plus the banner was one fact stated three times. Render `baseline_diff` beneath the strip as an attend-toned one-line banner when the server sends one; it must arrive resolved, never counted from `ClientRecord.overrides` here.

`QuestionsScreen.tsx`: root becomes `<Screen measure="640" pad="36x40" placement="top">`; the hand-rolled `mx-auto flex w-full max-w-320 flex-col gap-7` at `:39` goes, and the header block becomes one `ScreenHeading`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Questions /questions ../../shots
```

Compare with `shots/design-questions.png`: thirteen rows, rows 2/3/5/7/9 showing two buttons and the rest three, no third line under any label, the card in a 640px column with a 36×40 gutter, and the whole thing inside one pane that scrolls rather than a page that grows.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/questions
git commit -m "$(cat <<'EOF'
Give each sign-off line its own answer set

Every row offered YES/NO/N-A. Six of the product's thirteen lines are
YES/NO only, and offering N/A on a line that cannot fail to apply lets an
abstractor claim "not applicable" on a statement the product requires,
with no machine check to contradict it. The options now come from the
line's own answers, and the scope chip names the span the answer is given
against instead of repeating the derivation word.

The positive machine-check line and the group tag leave the row — they
added a third line to all thirteen — and the "Not signed" banner leaves
the card, which already states it on its edge. Start pipeline carries its
contract-gap note on screen rather than in a comment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Overview — seven stages, three-line headers, and a board only ever drawn at its width

**Files:**
- Modify: `apps/web-v2/src/features/overview/OverviewScreen.tsx:54-67`
- Modify: `apps/web-v2/src/features/overview/StageColumn.tsx`
- Modify: `apps/web-v2/src/features/overview/StageRail.tsx`
- Modify: `apps/web-v2/src/features/overview/FailedBanner.tsx:30-60`
- Modify: `apps/web-v2/src/features/overview/StageBoard.tsx` (column gap)
- Modify: `apps/web-v2/src/features/overview/useNarrowViewport.ts:19`
- Delete: `apps/web-v2/src/features/overview/OrderCard.tsx`
- Test: `apps/web-v2/src/features/overview/StageColumn.stories.tsx`
- Test: `apps/web-v2/src/features/overview/useNarrowViewport.test.ts`

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `CensusTile`, `EmptyNote` (Wave 1) and `entities/order/OrderMiniCard` (Wave 3, unpinned — stated here):

```tsx
export interface OrderMiniCardProps {
  orderRef: string;
  state?: string;                 // "FAILED VALIDATION" etc.; absent → not drawn
  place: string;
  waited: string;                 // a bare duration; the server's own text
  waitingOn?: string;             // absent → the line is not drawn
  mine?: boolean;                 // draws the YOURS badge and the accented border
  tone?: "none" | "halt";
  to?: string;                    // absent → not a link
}
export function OrderMiniCard(props: OrderMiniCardProps): ReactElement;
```

Consumes from Wave 2: `LifecycleStage.sub: string`, `LifecycleStage.waiting_on: string`, `LifecycleOrder.id`, `.mine`, `.state`; the seven-stage fixture with the export's ids and no `failed` stage; intake `kind: "halt"`.

Produces: no new exports. `useNarrowViewport` keeps its signature and changes its threshold.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/overview/useNarrowViewport.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { NARROW_QUERY } from "./useNarrowViewport";

/**
 * The export wraps the board in `overflow-x:auto` with `min-width:1190px`. We
 * squeeze instead of scrolling — a scrollbar with no affordance hid Escalated
 * and Delivered entirely (HANDOFF-UI §6) — but the old 900px threshold left the
 * 900–1190px band drawing seven columns below their drawn minimum. The rail is
 * the better read there, so the board is now only ever drawn at its width.
 */
describe("the board's rail threshold", () => {
  test("forces the rail below the export's own 1190px minimum", () => {
    expect(NARROW_QUERY).toBe("(max-width: 1189px)");
  });
});
```

Create `apps/web-v2/src/features/overview/StageColumn.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LifecycleStage } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { StageColumn } from "./StageColumn";

const INTAKE: LifecycleStage = {
  id: "intake",
  label: "Intake & sign-off",
  sub: "answering the lines",
  waiting_on: "ON ABSTRACTOR",
  kind: "halt",
  count: 1,
  orders: [
    {
      id: "ord_demo_1",
      ref: "4176034-1",
      mine: true,
      state: null,
      addr: "1147 E Saddlebrook Ln, Mesa AZ 85203",
      waited: "3h 12m",
      waiting_on: "Sign-off open",
    },
  ],
};

const meta = {
  title: "Overview/StageColumn",
  component: StageColumn,
  parameters: { layout: "padded" },
} satisfies Meta<typeof StageColumn>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The header is THREE lines: label + mono count, the server's sub-line, then
 * the STOPPED chip beside the "on whom" caption. Folding the sub into the label
 * ("Intake · sign-off open") was the screen inventing a label format, and left
 * the rail with no way to show it at all.
 */
export const HeaderIsThreeLines: Story = {
  args: { stage: INTAKE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("stage-label")).toHaveTextContent("Intake & sign-off");
    await expect(canvas.getByTestId("stage-sub")).toHaveTextContent("answering the lines");
    await expect(canvas.getByTestId("stage-waiting-on")).toHaveTextContent("ON ABSTRACTOR");
    await expect(canvas.getByText("STOPPED")).toBeVisible();
  },
};

/** Your own order is findable on a seven-column board: badge and accented border. */
export const YourOwnOrderCarriesTheYoursBadge: Story = {
  args: { stage: INTAKE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("YOURS")).toBeVisible();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test
```

Expected failures: `useNarrowViewport.test.ts` — `SyntaxError: The requested module './useNarrowViewport' does not provide an export named 'NARROW_QUERY'`; `StageColumn` story 1 — `Unable to find an element by: [data-testid="stage-sub"]`; story 2 — `Unable to find an element with the text: YOURS`.

- [ ] **Step 3: Implement — the board and the threshold**

`useNarrowViewport.ts`: export the query and change it.

```ts
/**
 * Is the window too narrow for a seven-column board?
 *
 * A horizontally-scrolled board is worse than no board: the reader loses the
 * comparison between columns, which is the only thing the board is for. So
 * below this width the screen forces the rail — which reads better stacked
 * anyway — and SAYS SO, rather than silently ignoring a view the person chose.
 *
 * 1190px is the export's own minimum for the seven columns at their drawn
 * width. The threshold used to be 900, which meant the 900–1190px band drew a
 * squeezed board rather than the rail: neither the export's answer (scroll)
 * nor ours (rail), and the one arrangement where the columns are too narrow to
 * compare and there is no affordance saying so.
 */
export const NARROW_QUERY = "(max-width: 1189px)";
```

and replace the `NARROW` constant with `NARROW_QUERY` throughout the file.

`StageColumn.tsx`: render the three header lines with `data-testid="stage-label" | "stage-sub" | "stage-waiting-on"` and delete the CONTRACT GAP note that justified folding the sub into the label — the contract carries `sub` and `waiting_on` now. Where a stage's `kind` is the machine one, render a `■ machine` caption in the same slot the halt stages use for `■ STOPPED`. **Do not reuse the diagonal hatch**: `StageColumn`'s existing refusal is right — the hatch already means "the document is silent on this field", and one mark must keep one meaning. Cards render through `OrderMiniCard`; the count stays the server's census and is never `orders.length`.

`StageRail.tsx`: render the same two extra lines, so the two views stay one language.

`FailedBanner.tsx`: render its cards through `OrderMiniCard` with `tone="halt"` and delete `OrderCard.tsx` — the two were verbatim copies inside one feature folder and had already drifted. Drop the 4px left accent from the banner `Card` (the export draws a plain 1px red-edge box; the tint and the edge already carry it). Restore the export's sentence verbatim: `…and it will sit here until someone does — which is why it is counted separately from the stages above rather than hidden inside one.` "Shown apart from" describes the layout; "counted separately from" states the invariant the component enforces. Render the waiting-on line in the muted tier and render nothing where the server sent nothing — the invented fallback goes.

`OverviewScreen.tsx`: root becomes `<Screen measure="1340" pad="26x30" placement="top">`. `StageBoard.tsx`'s column gap goes from `gap-3` (6px) to `gap-5` (10px).

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Overview /overview ../../shots
```

Compare with `shots/design-overview.png`: seven columns beginning at Unassigned and ending at Delivered with no `failed` column, every header three lines, the reviewer's own card badged `YOURS`, and every column's card count matching its census or saying explicitly that it does not.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/overview
git commit -m "$(cat <<'EOF'
Draw the board only at the width it was designed for

The rail threshold was 900px against the export's own 1190px minimum, so
between the two the seven columns squeezed below their drawn width — the
comparison the board exists for stops working there, and nothing said so.
The rail is the better read in that band and now takes it.

Stage headers regain the sub-line and the "on whom" caption the contract
now carries, instead of folding them into the server's label, and the rail
shows the same two lines so the views stay one language. The board card
and the failed-banner card were verbatim copies inside one feature folder,
already drifted; both now draw the shared mini-card, which is also where
the YOURS badge lands — on a seven-column board it is the only way to find
your own work.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Queue — four populated bands and one hero card

**Files:**
- Modify: `apps/web-v2/src/features/queue/QueueScreen.tsx:40-91`
- Modify: `apps/web-v2/src/features/queue/QueueSections.tsx`
- Modify: `apps/web-v2/src/features/queue/QueueBand.tsx`
- Modify: `apps/web-v2/src/features/queue/NextOrderCard.tsx`
- Test: `apps/web-v2/src/features/queue/QueueBand.stories.tsx`
- Test: `apps/web-v2/e2e/invariants/queue.spec.ts` (extend)

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `ToggleGroup variant="segmented"` (Wave 1); `entities/order/OrderRow` and `shared/ui/QuietState` (Wave 3, unpinned — stated here):

```tsx
// src/entities/order/OrderRow.tsx
export interface OrderRowProps {
  orderRef: string;
  chips?: ReactNode;
  place: string;
  note?: string;                                   // the waiting-on sentence
  waited?: string;                                 // the mono duration
  action?: ReactNode;
  stateEdge?: "none" | "attend" | "halt";          // the export's 2px inset top edge
}
export function OrderRow(props: OrderRowProps): ReactElement;

// src/shared/ui/QuietState.tsx
export interface QuietStateProps {
  tone: "settled" | "attend";
  headline: string;
  body: string;
}
export function QuietState(props: QuietStateProps): ReactElement;
```

Consumes from Wave 2: the four band read shapes with a server-supplied per-band `count`, populated from the shared five-order set, role-filtered (held by `mine`, in-flight by senior).

Produces: no new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/queue/QueueBand.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { QueueBand } from "./QueueBand";

const meta = {
  title: "Queue/QueueBand",
  component: QueueBand,
  parameters: { layout: "padded" },
} satisfies Meta<typeof QueueBand>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The band note carries the SERVER'S count — "1 in progress", not "in progress"
 * and never `orders.length`. A count of what is left is explicitly allowed
 * (HANDOFF-UI §4.5); re-deriving it here would be a second copy of a number the
 * server already decided.
 */
export const NoteCarriesTheServerCount: Story = {
  args: { label: "Mine", note: "in progress", count: 1, children: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("band-note")).toHaveTextContent("1 in progress");
  },
};

/**
 * NEXT UP is the live step and is the only band label in the export drawn in
 * the action tone — it pairs with the accented card below it. Every other label
 * is ink.
 */
export const NextUpIsTheOnlyActionTonedLabel: Story = {
  args: { label: "Next up", note: "the system decides — no picking", tone: "action", children: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("band-label")).toHaveClass(/text-action/);
  },
};
```

Extend `apps/web-v2/e2e/invariants/queue.spec.ts`:

```ts
/**
 * The export draws a reassurance card above MINE when Mine and Held are both
 * empty. Four bare empty-state cards in a row is not the same statement: it
 * reads as a broken screen, where the export reads as "that's the good
 * outcome".
 */
test("both bands empty draws the quiet state, not four empty cards", async ({ page }) => {
  await page.goto("/queue");
  await page.getByRole("button", { name: "Senior · Ops" }).click();
  await page.getByRole("button", { name: "Reviewer" }).click();
  const quiet = page.getByTestId("queue-quiet-state");
  if (await quiet.count()) {
    await expect(quiet).toContainText("Nothing assigned, nothing waiting on you.");
    await expect(quiet).toContainText("That's the good outcome — take the next order when you're ready.");
  }
});

/** The one card you are meant to act on is visibly different from the bands. */
test("the next-up card is the only accented card on the page", async ({ page }) => {
  await page.goto("/queue");
  await expect(page.getByTestId("next-order-card")).toHaveClass(/border-action-border/);
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/queue.spec.ts
```

Expected failures: story 1 — `Unable to find an element by: [data-testid="band-note"]` (and `QueueBand` has no `count` prop, so `typecheck` fails first with `Object literal may only specify known properties, and 'count' does not exist in type`); story 2 — `count` and `tone` are likewise unknown props; the e2e accent test fails with the class list not containing `border-action-border`.

- [ ] **Step 3: Implement**

`QueueBand.tsx`: add `count?: number` and `tone?: "ink" | "action"`. Render `data-testid="band-label"` on the `Eyebrow` and pass `tone="action"` through to it when asked; render `data-testid="band-note"` with `{count === undefined ? note : `${count} ${note}`}` — never `orders.length`, and never a rate.

`QueueSections.tsx`: render the four bands from the Wave 2 band responses through `entities/order/OrderRow`, one row component for all four — this is exactly the shape that produced the previous build's four near-identical row renderers. Held rows take `stateEdge` from their state chip's tone (the export's 2px inset top edge). Keep the CONTRACT GAP notes for anything the band responses still do not carry.

`NextOrderCard.tsx`: `<Card accent="action" data-testid="next-order-card">` with the export's product chip in the header line and the size line beneath (`{pages} pages · {pagesReadInFull} read in full`, both numerals mono). Drop `client_id` from the card — an internal key is not information for a reviewer.

`QueueScreen.tsx`: root becomes `<Screen measure="860" pad="28x32" placement="top">`; header becomes one `ScreenHeading`; the Reviewer / Senior · Ops switch becomes `ToggleGroup variant="segmented"`; render `<QuietState tone="settled" headline="Nothing assigned, nothing waiting on you." body="That's the good outcome — take the next order when you're ready." data-testid="queue-quiet-state" />` above the Mine band when Mine and Held are both empty.

`Pass — say why` **stays** — pass-with-reason is real server-side behaviour with a `min(1)` refusal and fourth-pass auto-escalation, and the export is stale. The on-screen `Keys: ⏎ take it · P pass` hint goes: the export puts key hints nowhere on a screen, and the `?` map is where they live.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/queue.spec.ts
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Queue /queue ../../shots
```

Compare with `shots/design-queue.png`: the column is 858–860px wide, not ~670px; four populated bands; the next-up card visibly the hero; the role switch reads as one control with two positions rather than a primary beside a secondary.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/queue apps/web-v2/e2e/invariants/queue.spec.ts
git commit -m "$(cat <<'EOF'
Draw the queue's four bands from one row component

The bands were four empty cards and no row renderer at all, which is the
shape that produced the previous build's four near-identical rows. One
OrderRow now carries Mine, Held, In flight and Recently delivered, with the
state edge as a prop.

The next-up card takes the accent the export gives it, so the one card you
are meant to act on stops looking like the four beside it, and the role
switch becomes a segmented control rather than a primary button next to a
secondary one. Band notes print the server's count; nothing here counts
rows. When Mine and Held are both empty the screen says that is the good
outcome instead of showing four blanks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The order strip's three count behaviours

**Files:**
- Modify: `apps/web-v2/src/app/OrderCounts.tsx:46-64`
- Test: `apps/web-v2/src/app/OrderCounts.stories.tsx`

**Interfaces:**

Consumes `CensusTile` (Wave 1):

```tsx
export interface CensusTileProps { value: ReactNode; caption: ReactNode; tone?: "muted" | "attend" | "halt" | "settled"; edge?: boolean }
export function CensusTile(props: CensusTileProps): ReactElement;
```

Produces: no new exports. `OrderCounts` keeps its `{ orderId: string }` prop.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/app/OrderCounts.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderCountsView } from "./OrderCounts";

const meta = {
  title: "Chrome/OrderCounts",
  component: OrderCountsView,
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderCountsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * NO SOURCE stays muted. It counts values the pipeline produced without a
 * document, page or reading behind them — but painting it red makes it louder
 * than NEED YOU, which is the tile a reviewer can act on. The export keeps it
 * in the muted tier unconditionally, and adopting that is what stops the strip
 * shouting the wrong number.
 */
export const NoSourceStaysMutedEvenWhenNonZero: Story = {
  args: { fields: 30, auto: 17, need: 7, noSource: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("count-no-source")).not.toHaveClass(/text-state-halt/);
  },
};

/** Every numeral in the product is mono; these were the exception. */
export const NumeralsAreMono: Story = {
  args: { fields: 30, auto: 17, need: 7, noSource: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("count-fields")).toHaveClass(/font-mono/);
  },
};

/** Below 1180px the strip cannot fit ref + four tiles + stamp + chip. It hides them. */
export const HiddenBelowTheExportsBreakpoint: Story = {
  args: { fields: 30, auto: 17, need: 7, noSource: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("order-counts")).toHaveClass(/hidden/);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failures: `Failed to resolve import` — `OrderCountsView` is not exported (the file exports only the connected `OrderCounts`). After extracting it, story 1 fails because `:62` sets `text-state-halt-ink` when `noSource > 0`; story 2 fails because `:48` is `text-md font-semibold` with no mono; story 3 fails because `:58` is `flex flex-wrap gap-6` with no `hidden`.

- [ ] **Step 3: Implement**

Split the file: `OrderCounts` stays the connected component (query + the four `state`-derived counts, unchanged — the counts are derived from server state only, never from confidence and never from `value === null`), and `OrderCountsView` is the presentational half taking `{ fields, auto, need, noSource }`. Render the four through `CensusTile` with `data-testid="count-fields" | "count-auto" | "count-need" | "count-no-source"`, numerals in 15px mono, `noSource` in the muted tone unconditionally, and the container as `hidden min-[1180px]:flex flex-wrap gap-6`.

Delete the comment at `:54-57`. It asserts "Always visible, never breakpoint-hidden" as a design decision; the export gates the tiles on `countsDisplay: compact ? 'none' : 'flex'` at 1180px, and between 900 and 1180 the strip must fit an order ref, four tiles, a rotated stamp and an account chip. A comment stating an untrue invariant is worse than no comment, and this one was the stated reason the component existed.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Queue /queue ../../shots
```

The strip is shell, so any screen shows it. At 1600px the four tiles are present with mono numerals and `NO SOURCE` in the muted tier; narrow the window below 1180px and confirm they leave rather than wrap the stamp onto a second line.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/app/OrderCounts.tsx apps/web-v2/src/app/OrderCounts.stories.tsx
git commit -m "$(cat <<'EOF'
Adopt the export's three behaviours for the strip counts

NO SOURCE turned red above zero, which made it louder than NEED YOU — the
tile a reviewer can actually act on. It stays in the muted tier now, as the
export draws it; the number is still the one that matters and it is still
in the chrome.

The numerals become mono, like every other numeral in the product, and the
tiles hide below 1180px, where the strip cannot fit an order ref, four
tiles, a rotated stamp and an account chip at once. The comment claiming
they are "always visible, never breakpoint-hidden" was the stated reason
this component existed and was not true; it goes with the behaviour it
described.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Completeness — ranked closures, and the gate verdict stops being a toggle

**Files:**
- Modify: `apps/web-v2/src/features/completeness/CompletenessScreen.tsx:60-134`
- Modify: `apps/web-v2/src/features/completeness/GapCard.tsx`
- Modify: `apps/web-v2/src/features/completeness/GapCloseOptions.tsx`
- Modify: `apps/web-v2/src/features/completeness/GapOptionButton.tsx`
- Modify: `apps/web-v2/src/features/completeness/GapClosureForm.tsx`
- Create: `apps/web-v2/src/entities/gate/GateBanner.tsx` (moved from `features/completeness/GateBanner.tsx`)
- Delete: `apps/web-v2/src/features/completeness/GateBanner.tsx`
- Test: `apps/web-v2/src/features/completeness/GapCloseOptions.stories.tsx`
- Test: `apps/web-v2/e2e/invariants/server-owns-state.spec.ts` (extend)

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `Card` with the corrected `accent` axis, `entities/signoff/SignoffLineTitle` (signature in Task 3), `entities/order/OrderContextRow` (signature in Task 1).

Consumes from Wave 2: `CompletenessGap.line_number: number` and

```tsx
export interface CloseOption {
  kind: "upload" | "amend" | "root" | "product_change";
  label: string;
  consequence: string;
  requires_comment: boolean;
  min_role: "reviewer" | "senior" | "ops";
}
// CompletenessGap.close_options: readonly CloseOption[]  — was z.array(z.string())
```

Produces:

```tsx
// src/entities/gate/GateBanner.tsx — presentational; no query, no router
export function GateOpenBanner(): ReactElement;
export function GateClosedBanner(): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/completeness/GapCloseOptions.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { GapCloseOptions } from "./GapCloseOptions";

const OPTIONS = [
  {
    kind: "upload" as const,
    label: "＋ Upload the missing document",
    consequence: "Adds prior_chain.pdf to the package — doesn't replace it.",
    requires_comment: false,
    min_role: "reviewer" as const,
  },
  {
    kind: "root" as const,
    label: "⊢ Root of title reached",
    consequence: "Asserts the search is complete and nothing older exists. A claim — needs a comment.",
    requires_comment: true,
    min_role: "reviewer" as const,
  },
  {
    kind: "product_change" as const,
    label: "Change the product ordered",
    consequence: "The client paid for this product. Senior/ops only, with a reason — recorded.",
    requires_comment: true,
    min_role: "senior" as const,
  },
];

const meta = {
  title: "Completeness/GapCloseOptions",
  component: GapCloseOptions,
  parameters: { layout: "padded" },
} satisfies Meta<typeof GapCloseOptions>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The ways out of a gap are RANKED and each carries its own consequence.
 * Rendering them as identical outlined buttons with one hard-coded sentence
 * made adding a document and rewriting a signed assertion look and read the
 * same, and lost the money-attached warning on the product change entirely.
 */
export const EachOptionCarriesItsOwnConsequence: Story = {
  args: { options: OPTIONS, role: "reviewer", onChoose: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("option-upload")).toHaveTextContent(
      "Adds prior_chain.pdf to the package — doesn't replace it.",
    );
    await expect(canvas.getByTestId("option-root")).toHaveTextContent(
      "Asserts the search is complete and nothing older exists. A claim — needs a comment.",
    );
    await expect(canvas.queryByText("Needs a reason — it is recorded on the order.")).toBeNull();
  },
};

/** A closure above your role is drawn dimmed and inert, with its reason on it. */
export const ProductChangeIsDimmedBelowSenior: Story = {
  args: { options: OPTIONS, role: "reviewer", onChoose: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("option-product_change")).toBeDisabled();
  },
};

/** The heading is a heading, one step larger than the row labels above it. */
export const HeadingIsLargerThanTheRowLabels: Story = {
  args: { options: OPTIONS, role: "reviewer", onChoose: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("CLOSE IT ONE OF THREE WAYS")).toHaveClass(/text-tiny/);
  },
};
```

Extend `apps/web-v2/e2e/invariants/server-owns-state.spec.ts`:

```ts
/**
 * A DEFECT, NOT A DIVERGENCE. The GATE VERDICT · LOCAL PREVIEW toggle let a
 * user repaint a server verdict: flipping it to Closed rendered "Package
 * complete — every gap is closed" directly above three cards still stamped
 * GAP with their close buttons live. A screen that states the opposite of what
 * it shows is worse than a screen missing a state.
 */
test("the completeness screen carries no gate-verdict control", async ({ page }) => {
  await page.goto("/completeness");
  await expect(page.getByText(/LOCAL PREVIEW/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Closed" })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/server-owns-state.spec.ts
```

Expected failures: story 1 — `Unable to find an element by: [data-testid="option-upload"]` (options are rendered from opaque strings with no kind); story 2 — same; story 3 — `getByText("CLOSE IT ONE OF THREE WAYS")` finds nothing, the current heading reads `CLOSE IT ONE OF TWO WAYS` at `text-micro`; e2e — `expect(locator).toHaveCount(0)` receives `1`, the toggle at `CompletenessScreen.tsx:94-104`.

- [ ] **Step 3: Implement — remove the `GATE VERDICT · LOCAL PREVIEW` toggle**

Delete `CompletenessScreen.tsx:94-104` and the `gateOpen` state at `:64`, and render the banner from `data.gate_open` alone. Delete the `ToggleGroup`/`Toggle` import. Rewrite the docstring at `:49-59`: the paragraph defending the preview described a control that lets a screen contradict itself, and the closed state's home is the gallery, which this build already keeps for states no fixture can reach.

Move `GateBanner.tsx` to `src/entities/gate/GateBanner.tsx` unchanged except for its import paths and one added WHY line — it lives in `entities/` so the states gallery can draw the same component rather than a look-alike, and `check:rules` forbids the gallery importing another feature. Drop the `border-l-*` from both banners; the export draws a plain 1px tinted box here with no stripe.

- [ ] **Step 4: Implement — ranked closures and the rest of the screen**

`GapOptionButton.tsx`: take a `CloseOption` and a `role`. Tone from `kind` (`upload` → action tint, `root` → settled tint, `amend` → plain, `product_change` → plain and dimmed), disabled when `min_role` outranks `role`, `data-testid={`option-${kind}`}`, and the option's own `consequence` beneath its label. Delete the hard-coded `Needs a reason — it is recorded on the order.` at `GapCloseOptions.tsx:19`. The dimming path already exists; only the data was missing, exactly as the file's own CONTRACT GAP note at `:12-14` said.

`GapCloseOptions.tsx`: heading text follows the option count (`ONE OF TWO WAYS` / `ONE OF THREE WAYS`, literal capitals in the markup) and uses `Eyebrow variant="cardHeading"` — the 10px/.08em in-card tier Wave 1 added — so it reads as a heading over the options rather than another row label.

`GapClosureForm.tsx`: **one** form, branched on `kind` — no comment for `upload`/`amend`, settled tone plus the export's placeholder for `root` (`Why is this the root? e.g. Prior instrument is the patent from the United States, 03/1908 — nothing older of record.`), attend tone plus a product picker and a required reason for `product_change`. Four forms is precisely the four-near-identical-renderers trap. Keep the CONTRACT GAP notes at `:14-17` and in `useGateState.ts:18-24` — the closure writes still do not exist.

`GapCard.tsx`: title through `SignoffLineTitle` (`Sign-off line 6 · Deed chain complete`) — the number is what ties the gap back to the sheet the abstractor signed. Replace the raw `border-l-*` override at `:59-63` with `Card accent` (a 2px inset top stripe: `halt` while open, `settled` once closed). Drop the blanket `gap-6` at `:71` and use the export's uneven rhythm: 8px between the claim rows (they are one comparison), 14px before the provisional block and before the options heading.

`CompletenessScreen.tsx`: root becomes `<Screen measure="720" pad="32x40" placement="top">`; the header becomes one `ScreenHeading`; the product row becomes `OrderContextRow`; the footer note takes `text-state-halt-ink` while gaps are open (the one line saying the run is blocked was the quietest text on the screen) and `text-state-settled-ink` once they are not. The rewritten closed-case sentence stays — it is correct under server-owns-the-verdict.

- [ ] **Step 5: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
pnpm --filter web-v2 test:e2e -- e2e/invariants/server-owns-state.spec.ts
```

- [ ] **Step 6: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Completeness /completeness ../../shots
```

Compare with `shots/design-completeness.png`: each card titled by its line number, a red hairline across the card's top rather than a bar down its left, three ranked options across on the period gap, and no control anywhere that can change the banner.

- [ ] **Step 7: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 8: Commit**

```
git add apps/web-v2/src/features/completeness apps/web-v2/src/entities/gate apps/web-v2/e2e/invariants/server-owns-state.spec.ts
git commit -m "$(cat <<'EOF'
Remove the gate-verdict preview and rank the ways out of a gap

The GATE VERDICT · LOCAL PREVIEW toggle let a user repaint a server
verdict: switching it to Closed rendered "Package complete — every gap is
closed" directly above three cards still stamped GAP with their close
buttons live. The banner now comes from gate_open alone, and the closed
rendering moves to the states gallery, which is where this build already
keeps states no fixture can reach. Both banners move to entities/gate so
the gallery draws the component rather than a look-alike.

Close options carry their own kind, consequence and minimum role, so
adding a document and rewriting a signed assertion stop looking identical
and the money-attached product change regains its dimming and its warning.
One closure form still, branched on kind — four would be the four
near-identical renderers this build exists to avoid.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Processing — the run, centred, with no control over its own verdict

**Files:**
- Modify: `apps/web-v2/src/features/processing/ProcessingScreen.tsx:37-114`
- Modify: `apps/web-v2/src/features/processing/StageRow.tsx:75-86`
- Modify: `apps/web-v2/src/features/processing/PackageStats.tsx`
- Create: `apps/web-v2/src/entities/gate/pipelineCta.ts`
- Test: `apps/web-v2/src/entities/gate/pipelineCta.test.ts`
- Test: `apps/web-v2/e2e/invariants/server-owns-state.spec.ts` (extend)

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `CensusTile`, `ListRow`/`DividedSection` (Wave 1).

Produces:

```tsx
// src/entities/gate/pipelineCta.ts
export interface PipelineCta {
  label: string;
  tone: "halt" | "action";
  /** "completeness" while the gate holds the run, "review" once it does not. */
  destination: "completeness" | "review";
}
export function pipelineCta(gateHalted: boolean): PipelineCta;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/entities/gate/pipelineCta.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { pipelineCta } from "./pipelineCta";

/**
 * THE CTA IS A FUNCTION OF THE SERVER'S GATE STATE AND NOTHING ELSE. It used to
 * be a function of a local toggle, so the button could say "Open review — the
 * run is waiting on you" while every stage row on the same screen printed
 * "halted". The two renderings still both need to be inspectable, which is what
 * the states gallery is for — and a pure function is what lets the gallery draw
 * the other one without a control that repaints a verdict.
 */
describe("the pipeline's closing call to action", () => {
  test("a halted gate sends you to the gate, in the halt tone", () => {
    expect(pipelineCta(true)).toEqual({
      label: "Resolve completeness gate →",
      tone: "halt",
      destination: "completeness",
    });
  });

  test("a passed gate sends you to review, in the action tone", () => {
    expect(pipelineCta(false)).toEqual({
      label: "Open review — the run is waiting on you →",
      tone: "action",
      destination: "review",
    });
  });
});
```

Extend `apps/web-v2/e2e/invariants/server-owns-state.spec.ts`:

```ts
/**
 * The twin of the completeness defect. GATE OUTCOME · LOCAL PREVIEW sat between
 * the run and the button, and flipping it swapped the CTA while every stage row
 * kept printing halted/waiting — the button and the run contradicting each
 * other on one screen.
 */
test("the processing screen carries no gate-outcome control", async ({ page }) => {
  await page.goto("/processing");
  await expect(page.getByText(/LOCAL PREVIEW/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Passed" })).toHaveCount(0);
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates
pnpm --filter web-v2 test:e2e -- e2e/invariants/server-owns-state.spec.ts
```

Expected failures: `Cannot find module './pipelineCta'`; and `expect(locator).toHaveCount(0)` receives `1` for the toggle at `ProcessingScreen.tsx:87-97`.

- [ ] **Step 3: Implement — remove the `GATE OUTCOME · LOCAL PREVIEW` toggle**

Delete `ProcessingScreen.tsx:87-97` and the `gateHalted` state at `:56`; the closing CTA is now `pipelineCta(pipeline.gate_halted)` wrapped in the router `Link` its `destination` names. Delete the `Eyebrow`/`Toggle`/`ToggleGroup` imports if they become unused. Rewrite the docstring paragraph at `:42-47` — it defended a control that lets the button and the run contradict each other; the unreachable rendering's home is the gallery.

Create `src/entities/gate/pipelineCta.ts` with the WHY note from the test above. It carries the copy and the tone but **not** the route — `check:rules` forbids `entities/` importing `@tanstack/react-router`, and routing belongs to the feature.

- [ ] **Step 4: Implement — the rest of the screen**

Root becomes `<Screen measure="700" pad="40" placement="centre">` — the export centres the block on both axes and the app left 167px of dead ground below it. The header becomes one `ScreenHeading`. `PackageStats` renders through `CensusTile`; the stage list through `DividedSection`/`ListRow`.

`StageRow.tsx:75-83`: correct the WHY note. It asserts the design sets all three owners identically — true of the render, false of the markup, where the owner column carries filled pills. The settled ruling is that **where the export's markup and its render disagree, the render governs**, so the plain uppercase treatment stays and the note is rewritten to say which artefact governs and why, rather than making a claim about the markup that is not true.

- [ ] **Step 5: Run — Expected: PASS**

```
pnpm --filter web-v2 test
pnpm --filter web-v2 test:e2e -- e2e/invariants/server-owns-state.spec.ts
```

- [ ] **Step 6: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Processing /processing ../../shots
```

Compare with `shots/design-processing.png`: the 700px block sits ~90px clear of the pane top and bottom rather than top-aligned over dead ground; eight stages ending at `Finalize & deliver`; nothing between the run and the button.

- [ ] **Step 7: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 8: Commit**

```
git add apps/web-v2/src/features/processing apps/web-v2/src/entities/gate apps/web-v2/e2e/invariants/server-owns-state.spec.ts
git commit -m "$(cat <<'EOF'
Remove the gate-outcome preview from the pipeline screen

A GATE OUTCOME · LOCAL PREVIEW toggle sat between the run and its closing
button. Flipping it swapped the button between "Resolve completeness gate"
and "Open review — the run is waiting on you" while every stage row kept
printing halted and waiting, so the button and the run contradicted each
other on one screen. The call to action is now a pure function of the
server's gate_halted, and the other rendering is inspectable in the states
gallery instead of behind a control that repaints a verdict.

The screen also centres on both axes, as the export draws it, instead of
top-aligning a short column over 167px of dead ground. The owner-column
WHY note is corrected: it claimed the design sets all three owners
identically, which is true of the render and false of the markup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Gallery — the home for the two states no fixture can reach

**Files:**
- Modify: `apps/web-v2/src/features/gallery/GalleryScreen.tsx:31-66`
- Modify: `apps/web-v2/src/features/gallery/StateSample.tsx:52`
- Modify: `apps/web-v2/src/features/gallery/StateCard.tsx:33,40`
- Create: `apps/web-v2/src/features/gallery/UnreachableGateStates.tsx`
- Test: `apps/web-v2/src/features/gallery/UnreachableGateStates.stories.tsx`

**Prerequisite:** Tasks 7 and 8 — they create `entities/gate/GateBanner.tsx` and `entities/gate/pipelineCta.ts`.

**Interfaces:**

Consumes `Screen`, `ScreenHeading` (Wave 1), and from Tasks 7/8:

```tsx
export function GateOpenBanner(): ReactElement;
export function GateClosedBanner(): ReactElement;
export function pipelineCta(gateHalted: boolean): PipelineCta;
```

Produces:

```tsx
// src/features/gallery/UnreachableGateStates.tsx
export function UnreachableGateStates(): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/gallery/UnreachableGateStates.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UnreachableGateStates } from "./UnreachableGateStates";

const meta = {
  title: "Gallery/UnreachableGateStates",
  component: UnreachableGateStates,
  parameters: { layout: "padded" },
} satisfies Meta<typeof UnreachableGateStates>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Both renderings that used to sit behind a LOCAL PREVIEW toggle on a
 * production screen. Here they are two samples side by side, which is what a
 * states gallery is for; there they were a control that let a viewer repaint a
 * server verdict.
 */
export const DrawsBothGateVerdictsAndBothPipelineCtas: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Package incomplete — the run is paused")).toBeVisible();
    await expect(canvas.getByText("Package complete — every gap is closed")).toBeVisible();
    await expect(canvas.getByText("Resolve completeness gate →")).toBeVisible();
    await expect(canvas.getByText("Open review — the run is waiting on you →")).toBeVisible();
  },
};

/** The gallery draws the live components, never look-alikes. */
export const UsesTheLiveBannerComponents: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("gate-banner-open")).toBeVisible();
    await expect(canvas.getByTestId("gate-banner-closed")).toBeVisible();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failure: `Failed to resolve import "./UnreachableGateStates" from "src/features/gallery/UnreachableGateStates.stories.tsx"`.

- [ ] **Step 3: Implement**

```tsx
import { Link } from "@tanstack/react-router";
import { GateClosedBanner, GateOpenBanner } from "../../entities/gate/GateBanner";
import { pipelineCta } from "../../entities/gate/pipelineCta";
import { buttonClasses } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * THE TWO STATES A FIXTURE CANNOT REACH, drawn side by side.
 *
 * Both used to live on production screens behind a `LOCAL PREVIEW` toggle. That
 * control let a viewer repaint a SERVER verdict, producing a completeness
 * screen that said "Package complete" above three open gaps with live close
 * buttons, and a pipeline whose button and stage rows contradicted each other.
 * The states still need to be inspectable — an unreachable state is one nobody
 * can check — and this screen is where this build already keeps them.
 *
 * The LIVE components are rendered, never look-alikes: a gallery that draws its
 * own copy of a banner stops catching the day the real banner changes.
 */
const CTAS = [pipelineCta(true), pipelineCta(false)] as const;

const DESTINATION = {
  completeness: "/completeness",
  review: "/orders/ord_demo_1/review",
} as const;

export function UnreachableGateStates() {
  return (
    <div className="flex flex-col gap-7">
      <Eyebrow variant="section" as="h2">
        Gate verdict — both renderings
      </Eyebrow>
      <GateOpenBanner />
      <GateClosedBanner />

      <Eyebrow variant="section" as="h2">
        Pipeline call to action — both renderings
      </Eyebrow>
      {CTAS.map((cta) => (
        <Link
          key={cta.destination}
          to={DESTINATION[cta.destination]}
          className={cn(buttonClasses({ size: "xl", tone: cta.tone }))}
        >
          {cta.label}
        </Link>
      ))}
    </div>
  );
}
```

Add `data-testid="gate-banner-open"` / `"gate-banner-closed"` to the two banners in `entities/gate/GateBanner.tsx`.

`GalleryScreen.tsx`: root becomes `<Screen measure="1120" pad="28x32" placement="top">`; the header block becomes one `ScreenHeading`; the hand-rolled `mx-auto flex max-w-560 flex-col` and the `mt-2` / `mt-1 mb-11` rhythm go. Replace the breakpoint columns at `:49` with the export's intrinsic rule — an `@utility` `grid-autofill-160` in `index.css` giving `repeat(auto-fill, minmax(160px, 1fr))` on the 2px base (320px), because `check:rules` bars the bracket value. At a 1024px viewport the breakpoint version forced three 241px columns, 79px under the export's own floor. Add a final `StateCard` hosting `UnreachableGateStates`.

`StateSample.tsx:52`: drop `border-l-(length:--stroke-severity)`. The export's tinted sample block is a uniform 1px hairline with all four corners rounded; the heaviest left edge anywhere in the export is 3px and there is none here. A gallery that draws a shape nothing ships is checking itself against nothing.

`StateCard.tsx`: `items-start` instead of `items-center` at `:40` — the no-value card holds six chips now (correctly: `pending` is a fifth thing and `unsettled` was found on screen, and `noValueStates.ts` is the authority), so row four stretched and floated its neighbours in the middle of a 223px cell. Render the no-value sample cell on `surface-panel`: `not_found`'s `bg-surface-app` fill is the same colour as the sample surface, so the one state whose fill distinguishes it degrades to a bare outline one hairline from `silent` — the exact collapse this card exists to catch, happening on the card. Use `Eyebrow variant="cardTag"` at `:33` instead of overriding two of `screen`'s three axes at the call site.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs States /gallery ../../shots
```

Compare with `shots/design-gallery.png`: a 1120px column, cards on an auto-fill track that never goes below 320px, no left bar on any sample, and the two gate states present as samples rather than as controls anywhere in the app.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/gallery apps/web-v2/src/entities/gate apps/web-v2/src/index.css
git commit -m "$(cat <<'EOF'
Give the two preview-only gate states a home in the gallery

Both renderings the LOCAL PREVIEW toggles used to expose — the closed
completeness verdict and the passed pipeline CTA — are now samples in the
states gallery, drawn from the live components rather than look-alikes. An
unreachable state is one nobody can check; a control that repaints a
server verdict on a production screen is worse than either.

The no-value sample also moves onto panel: not_found's fill is the same
colour as the old sample surface, so the one state whose fill distinguishes
it was rendering as a bare outline a hairline away from "document silent" —
the exact collapse this card exists to catch, happening on the card.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Rulebook — the export's 1160px column

**Files:**
- Modify: `apps/web-v2/src/features/rulebook/RulebookScreen.tsx:57-73`
- Modify: `apps/web-v2/src/features/rulebook/RuleList.tsx:54-56`
- Modify: `apps/web-v2/src/features/rulebook/RulebookHeader.tsx:60-70`
- Modify: `apps/web-v2/src/features/rulebook/RetireBlock.tsx:80-81`
- Test: `apps/web-v2/src/features/rulebook/RuleList.stories.tsx` (extend)

**Interfaces:** Consumes `Screen`, `ScreenHeading`, `CensusTile`, `ListRow` (Wave 1). Produces no new exports.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/features/rulebook/RuleList.stories.tsx`:

```tsx
/**
 * SELECTION IS A FILL, NOT A BORDER. The export sets every rail row's border to
 * the same neutral rule and carries selection in the tint alone. Adding a navy
 * border on top makes the selected row a heavier object than the export draws,
 * and the same selected-row idiom appears on four rails — a heavier treatment
 * here is a heavier treatment everywhere it gets copied to.
 */
export const SelectionIsCarriedByFillAlone: Story = {
  args: { rules: DEMO_RULES, selectedId: DEMO_RULES[0]?.id ?? null, onSelect: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId(`rule-row-${DEMO_RULES[0]?.id ?? ""}`);
    await expect(row).toHaveClass(/bg-action-surface/);
    await expect(row).toHaveClass(/border-line-strong/);
    await expect(row).not.toHaveClass(/border-action\b/);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failure: `expect(element).not.toHaveClass(/border-action\b/)` — `RuleList.tsx:54-56` sets `border-action` on the selected row.

- [ ] **Step 3: Implement**

`RuleList.tsx:54-56`: keep `border-line-strong` on every row and let `bg-action-surface` carry selection alone; add `data-testid={`rule-row-${rule.id}`}`. Compose the row from `ListRow`.

`RulebookScreen.tsx`: root becomes `<Screen measure="1160" pad="24x28" placement="top">`; the header block becomes one `ScreenHeading`; the masthead stats become `CensusTile`. `RulebookHeader`'s three stats keep their honest tiers — the CONFLICT stat needs `Rule.provenance`, which is not in this wave's scope, and the existing CONTRACT GAP notes stay.

`RetireBlock.tsx:80-81`: drop the trailing `does` so the refusal string matches the export verbatim: `Retiring is restricted to engineer and admin — it changes extraction as much as confirming.`

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Rulebook /rulebook ../../shots
```

Compare with `shots/design-rulebook.png`: the body spans 1160px with even gutters, and navigating Rulebook → Products no longer shifts the content column sideways.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/rulebook
git commit -m "$(cat <<'EOF'
Hold the rulebook to its 1160px column

The screen set no measure, so the shell's shrink-to-fit main gave it
whatever its longest string wanted — 1331px here against 986px on
products, which meant moving between two sibling admin screens shifted the
whole content column by 173px. Both now declare the export's measure.

Selection on the rule rail is carried by the tint alone, as the export
draws it; the navy border made the selected row a heavier object than
anything else on the screen, and the same idiom is on four rails.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Products — the export's 1040px column and a two-line row

**Files:**
- Modify: `apps/web-v2/src/features/products/ProductsScreen.tsx:53-60`
- Modify: `apps/web-v2/src/features/products/ProductList.tsx:48,69-102`
- Modify: `apps/web-v2/src/features/products/LineCatalogue.tsx` (section button size)
- Modify: `apps/web-v2/src/features/products/ConfigHeader.tsx:50-62`
- Test: `apps/web-v2/src/features/products/ProductList.stories.tsx`

**Interfaces:** Consumes `Screen`, `ScreenHeading`, `ListRow`/`DividedSection`, `ContractGapNote` (Wave 1). Produces no new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/products/ProductList.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ProductList } from "./ProductList";

const PRODUCTS = [
  { code: "40 Year", full: "40-Year Search", sub: "Full search · 40 years back", period: "40 years back", derivation: "y" as const, retired: false },
];

const meta = {
  title: "Products/ProductList",
  component: ProductList,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProductList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The row is TWO lines — the product's full name, then the period. `sub` exists
 * on the record but the export uses it only in the edit drawer; printing it as
 * a third line pushed the period, which is the row's actual discriminator, into
 * third place and grew every row by ~16px.
 */
export const RowIsTwoLinesAndThePeriodIsTheSecond: Story = {
  args: { products: PRODUCTS, onEdit: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId("product-row-40 Year");
    await expect(row).toHaveTextContent("40-Year Search");
    await expect(row).toHaveTextContent("Period: 40 years back");
    await expect(row).not.toHaveTextContent("derived from");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failure: `expect(element).not.toHaveTextContent("derived from")` — `ProductList.tsx:79-81` prints `Period: {p.period} · derived from {DERIVATION[p.derivation]}`, which against the fixture reads the same phrase twice on three of four rows. `getByTestId` also fails first: the row carries no testid.

- [ ] **Step 3: Implement**

`ProductList.tsx`: two lines per row (`full`, then `Period: {period}`), `data-testid={`product-row-${code}`}`, `sub` kept for the edit drawer only, and `size="sm"` on the `＋ New product` button — section-level actions are one notch quieter than a masthead action in the export. Same `size="sm"` on `＋ New line` in `LineCatalogue.tsx`. The rows compose from `ListRow`/`DividedSection`. Keep the CONTRACT GAP paragraph at `:111-115` and route it through `ContractGapNote` so the wording is one string.

`ConfigHeader.tsx`: add a `Config` eyebrow beside the version chip. The screen must still print the server's identifier verbatim — never mint a version — but an unlabelled `cfg-2026.07-3` is an opaque id where the export's chip is self-labelling. Keep the `frozen — the next accepted edit mints a new version` line: it renders a real server field the export's single demo config had no equivalent for.

`ProductsScreen.tsx`: root becomes `<Screen measure="1040" pad="28x32" placement="top">`; the header block becomes one `ScreenHeading`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs "Products & sign-off" /products ../../shots
```

Compare with `shots/design-products.png`: the body spans 1040px, each product row is ~61px rather than ~77px, and the section button is visibly quieter than the rulebook masthead's.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/products
git commit -m "$(cat <<'EOF'
Hold products to 1040px and shorten the product row

The row printed the product's name, its sub-line and then its period, so
the period — the line that actually tells four labels for one product
apart — landed third and every row grew by a line. The export puts the
period second and keeps sub for the edit drawer, which is where the
derivation is being chosen; printing "Period: two owners · derived from
two owners" said the same thing twice.

The section-level New product and New line buttons drop a size rung, so a
section action stops shouting as loudly as a masthead one, and the config
chip gains the label that makes its identifier readable as a version.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Clients — the 880px column, a three-column defaults grid, and a header that survives a failure

**Files:**
- Modify: `apps/web-v2/src/features/clients/ClientsScreen.tsx:42-70`
- Modify: `apps/web-v2/src/features/clients/SignoffDefaults.tsx:56`
- Modify: `apps/web-v2/src/features/clients/OverridesPanel.tsx:59`
- Modify: `apps/web-v2/src/features/clients/CompareMatrix.tsx:55,75`
- Modify: `apps/web-v2/src/features/clients/ProductChips.tsx:40`
- Create: `apps/web-v2/src/entities/config/lineRef.ts`
- Modify: `apps/web-v2/src/index.css` (`@utility grid-autofill-115`)
- Test: `apps/web-v2/src/entities/config/lineRef.test.ts`

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `EmptyPanel` (Wave 1) and `shared/ui/QueryState` (Wave 1's error/pending wrapper — unpinned, stated here):

```tsx
export interface QueryStateProps {
  isPending: boolean;
  isError: boolean;
  pending: string;   // the sentence shown while resolving
  error: string;     // the sentence shown on failure
  children: ReactNode;
}
export function QueryState(props: QueryStateProps): ReactElement;
```

Produces:

```tsx
// src/entities/config/lineRef.ts
export function lineRef(n: number): string;   // 8 → "L08", 12 → "L12"
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/entities/config/lineRef.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { lineRef } from "./lineRef";

/**
 * The export zero-pads from the line number (`'L'+String(l.n).padStart(2,'0')`),
 * which is what keeps L1–L9 aligned against L10–L13. Three surfaces printed the
 * raw contract id instead — the defaults grid, the overrides rows and the
 * compare matrix's row gutter — so the same list misaligned in three places.
 */
describe("the sign-off line reference", () => {
  test("pads single digits", () => {
    expect(lineRef(1)).toBe("L01");
    expect(lineRef(8)).toBe("L08");
  });

  test("leaves two digits alone", () => {
    expect(lineRef(12)).toBe("L12");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates
```

Expected failure: `Cannot find module './lineRef'`.

- [ ] **Step 3: Implement**

```ts
/**
 * The sign-off line's printed reference. `ConfigLine` carries `n`, so nothing
 * is derived the server did not send — this is a FORMAT, and it lives in one
 * place because three surfaces print it and had drifted to the raw contract id,
 * which does not pad. `L8` above `L10` in a column of thirteen reads as an
 * ordering bug to everybody who sees it.
 */
export function lineRef(n: number): string {
  return `L${String(n).padStart(2, "0")}`;
}
```

Use it in `SignoffDefaults.tsx:35`, `OverridesPanel.tsx:59` and `CompareMatrix.tsx:75`.

`SignoffDefaults.tsx:56`: replace `grid gap-4 sm:grid-cols-2` with the export's auto-fill track, added as `@utility grid-autofill-115` in `index.css` giving `repeat(auto-fill, minmax(230px, 1fr))` — `check:rules` bars the bracket value. At the corrected 880px measure this is three columns, as drawn; a fixed two-column grid stranded every value ~500px from its label. **Do not pad unset lines with an assumed YES** — `SignoffDefaults`'s own WHY is right that suggestions nothing would prefill must not appear; the export's dense grid comes from fixture data, not from defaulting.

`ClientsScreen.tsx`: root becomes `<Screen measure="880" pad="28x32" placement="top">`; render the `ScreenHeading` **unconditionally** and put the query branches inside `QueryState`. The current early return at `:42-47` drops the header on a failed fetch, and with it `ScreenTitle` — the only mouse path back to the hub.

`CompareMatrix.tsx:55`: `sticky top-0` on the header row with `relative` on the card, so the client column labels stay visible through thirteen rows.

`ProductChips.tsx:40`: filter `!p.retired`, the same filter `AuthorOverride.tsx:77` already applies — a retired product must not be offered as a baseline to resolve against.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Clients /clients ../../shots
```

Compare with `shots/design-clients.png`: cards span 878–880px, the defaults grid is three columns with each value tight against its label, and the matrix header stays put while the rows scroll.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/clients apps/web-v2/src/entities/config apps/web-v2/src/index.css
git commit -m "$(cat <<'EOF'
Hold clients to 880px and keep the header through a failure

A failed /api/clients returned before the header, so the screen rendered a
bare sentence with no eyebrow, no h1 and therefore no ScreenTitle — which
is the only mouse path back to the hub. The header now renders
unconditionally with the query state inside it.

The defaults grid follows the export's 230px auto-fill track instead of a
fixed two columns, so at the corrected measure it is three columns with
each value beside its label rather than 500px away, and the line reference
is padded from the server's own line number in one place — L8 sitting above
L10 in a column of thirteen reads as an ordering bug.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: People — the 900px column and a roster that keeps its footnote honest

**Files:**
- Modify: `apps/web-v2/src/features/people/PeopleScreen.tsx:29-69`
- Modify: `apps/web-v2/src/features/people/PersonRow.tsx:50`
- Modify: `apps/web-v2/src/features/people/MfaGateBanner.tsx:24`
- Test: `apps/web-v2/src/features/people/PersonRow.stories.tsx`

**Interfaces:** Consumes `Screen`, `ScreenHeading`, `ListRow`/`DividedSection`, `QueryState` (signature in Task 12), `Card` with the corrected `accent` axis. Produces no new exports.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/people/PersonRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Person } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { PersonRow } from "./PersonRow";

const PERSON: Person = {
  id: "per_1",
  name: "R. Delacroix",
  role: "senior",
  role_label: "Senior examiner",
  status: "active",
  mfa: "enrolled",
};

const meta = {
  title: "People/PersonRow",
  component: PersonRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PersonRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The export puts a hairline on EVERY roster row including the first, so a rule
 * sits just inside the card's top edge. The app suppressed it with
 * `first:border-t-0` — a cleaner edge, but the clients rows and the compare
 * matrix follow the export, so two screens disagreed about one convention.
 */
export const EveryRowCarriesItsTopHairline: Story = {
  args: { person: PERSON },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("person-row-per_1")).not.toHaveClass(/first:border-t-0/);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failure: `Unable to find an element by: [data-testid="person-row-per_1"]`, then once the testid exists, `expect(element).not.toHaveClass(/first:border-t-0/)` fails on the class at `PersonRow.tsx:50`.

- [ ] **Step 3: Implement**

`PersonRow.tsx`: compose from `ListRow` (which owns the `border-t border-line-subtle` convention), drop `first:border-t-0`, add `data-testid={`person-row-${person.id}`}`. Keep the refusal at `:31-35`: the screen must not re-derive `privileged && mfa !== "enrolled"`, because that puts a second copy of the gate predicate in the browser, free to disagree with the server's `privileged_without_mfa`. The GATE chip waits on a server-set flag.

`PeopleScreen.tsx`: root becomes `<Screen measure="900" pad="28x32" placement="top">`; the header block becomes one `ScreenHeading`; the roster and the footnote both move **inside** the resolved branch via `QueryState`, so a failed `/api/people` stops rendering `The roster is unavailable.` followed by copy about controls that are not on screen.

`MfaGateBanner.tsx:24`: drop `border-l-(length:--stroke-severity) border-l-state-halt`. The export draws the banner as a uniform tinted hairline box, and this was one of the two halt banners in the app carrying the bar while the other did not.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs People /people ../../shots
```

Compare with `shots/design-people.png`: cards span ~898px rather than 792px, so the role text, the status chip and the MFA column stop crowding into the right half of each row.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/people
git commit -m "$(cat <<'EOF'
Hold people to 900px and keep the footnote with its roster

The roster footnote sat outside the query branch, so a failed /api/people
rendered "The roster is unavailable" followed by a sentence about role
changes and suspensions that were not on screen. Both now live in the
resolved branch.

The rows adopt the shared list-row convention, including the top hairline
the export draws on the first row — clients and the compare matrix already
follow it, so two screens disagreed — and the MFA banner drops the heavy
left rule the export does not draw on it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Audit — a log that reads as sentences

**Files:**
- Modify: `apps/web-v2/src/features/audit/AuditScreen.tsx:38-69`
- Modify: `apps/web-v2/src/features/audit/AuditRow.tsx:29-63`
- Create: `apps/web-v2/src/features/audit/actionLabels.ts`
- Modify: `apps/web-v2/src/shared/ui/ToggleGroup.tsx:69` (disabled fill)
- Test: `apps/web-v2/src/features/audit/actionLabels.test.ts`

**Interfaces:** Consumes `Screen`, `ScreenHeading`, `Card`, `ListRow`/`DividedSection` (Wave 1).

Produces:

```tsx
// src/features/audit/actionLabels.ts
export function actionPhrase(action: string): string;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/features/audit/actionLabels.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { actionPhrase } from "./actionLabels";

/**
 * The log's rows read as raw server tokens — "m.okafor · engine_seat_change".
 * The export reads as sentences. This is UI COPY OVER A CLOSED VOCABULARY, not
 * derived server state, so §4.3 is not in play — but an unmapped action must
 * fall through to the verbatim token rather than render blank, because the
 * log's whole value is being complete.
 */
describe("the audit action phrase", () => {
  test("names the acts in the export's words", () => {
    expect(actionPhrase("engine_seat_change")).toBe("Changed engine seat");
    expect(actionPhrase("golden_correction")).toBe("Corrected golden field");
    expect(actionPhrase("rule_confirmed")).toBe("Confirmed rule");
    expect(actionPhrase("escalation_resolved")).toBe("Resolved escalation");
    expect(actionPhrase("field_confirmed")).toBe("Confirmed field");
  });

  test("an unmapped action falls through to the raw token", () => {
    expect(actionPhrase("some_future_act")).toBe("some_future_act");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates
```

Expected failure: `Cannot find module './actionLabels'`.

- [ ] **Step 3: Implement**

```ts
/**
 * The closed action vocabulary, in the export's phrasing.
 *
 * The row keeps the raw token — greppability is why `AuditRow` prints it in
 * mono, and that reasoning is still right — but a log whose every row reads as
 * an identifier is a log nobody reads. This is UI copy over a vocabulary the
 * server owns, not a second derivation of server state.
 *
 * AN UNMAPPED ACTION FALLS THROUGH TO ITS TOKEN. The record's value is being
 * complete; a blank row for an act this map has not caught up with would be the
 * one failure the append-only log cannot have.
 */
const PHRASE: Readonly<Record<string, string>> = {
  engine_seat_change: "Changed engine seat",
  golden_correction: "Corrected golden field",
  rule_confirmed: "Confirmed rule",
  rule_retired: "Retired rule",
  escalation_resolved: "Resolved escalation",
  field_confirmed: "Confirmed field",
  field_corrected: "Corrected field",
  claim_amended: "Amended claim",
};

export function actionPhrase(action: string): string {
  return PHRASE[action] ?? action;
}
```

`AuditRow.tsx`: render `{actor} · {actionPhrase(action)}` as the sentence with the raw token kept in mono as a trailing secondary element. Label the reference: `Order {entity_id}` when `entity === "orders"`, `{entity} · {entity_id}` otherwise — currently `{entity} {entity_id}` reads as one undifferentiated token. Compose from `ListRow` rather than duplicating `PersonRow`'s class string, which had already drifted on three classes.

`AuditScreen.tsx`: root becomes `<Screen measure="940" pad="28x32" placement="top">`; use `<Card>` at `:58` instead of hand-rolling the card chrome; drop `max-w-3xl` from the lede at `:43` — it is a Tailwind default (768px) in an app whose base is 2px, and the screen measure should do the wrapping.

`ToggleGroup.tsx:69`: change the disabled fill from `bg-surface-app` to `bg-surface-panel`. On the page ground the two are the same colour, so a disabled pill dissolves to a hairline outline — this affects all sixteen pill-filter instances. The filter row's honest explanation stays: a client-side filter over a cursorless single page would present a partial answer as a complete one.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Audit /audit ../../shots
```

Compare with `shots/design-audit.png`: the card spans 940px, every row leads with a sentence, and the three filter pills read as pills rather than as ghosts.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/audit apps/web-v2/src/shared/ui/ToggleGroup.tsx
git commit -m "$(cat <<'EOF'
Make the audit log read as sentences without losing its tokens

Every row read as a raw server identifier — "m.okafor · engine_seat_change"
— on the one screen whose stated purpose is answering "who amended that
claim". Rows now lead with the act in words and keep the token in mono
beside it, so grep still finds what it always found, and an action the map
has not caught up with falls through to its token rather than rendering
blank.

The disabled filter pills also stop dissolving: their fill was the same
colour as the page ground, so only the hairline survived. That fill is
shared by all sixteen pill-filter instances.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Escalation — the held register on the adopted shape

**Files:**
- Modify: `apps/web-v2/src/features/escalations/EscalationsScreen.tsx:53-129`
- Modify: `apps/web-v2/src/features/escalations/ClusterRail.tsx:43-63`
- Modify: `apps/web-v2/src/features/escalations/ResolveCard.tsx:56-105`
- Create: `apps/web-v2/src/shared/plural.ts`
- Test: `apps/web-v2/src/shared/plural.test.ts`
- Test: `apps/web-v2/e2e/invariants/escalations.spec.ts` (extend)

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `Card` with the corrected `accent` axis, `Select`/`SelectTrigger`/`SelectPopup`/`SelectItem` (existing `shared/ui/Select`), and `shared/ui/Quote` (Wave 1, unpinned — stated here):

```tsx
export interface QuoteProps { children: ReactNode; tone?: "muted" | "attend" | "action" }
export function Quote(props: QuoteProps): ReactElement;   // font-quote + a left rule
```

Produces:

```tsx
// src/shared/plural.ts
export function countOf(n: number, singular: string, plural?: string): string;
```

**This screen's SHAPE is not a divergence.** Conflict C21 (`docs/frontend/conflicts.md:188`) settles it: `GET /api/escalations` returns `field_path_cluster` on every row and the contract has no per-field escalation record, so the export's per-field landing is unbuildable. This task applies the design-of-record's **chrome** to the adopted cluster shape and does not rebuild it.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/shared/plural.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { countOf } from "./plural";

/**
 * `1 unanswered · 1 orders` was on screen in the audit's own screenshot. The
 * same `N orders` / `N fields` / `N pages` phrasing recurs on queue, overview
 * and completeness, which is the kind of thing that gets fixed in one place and
 * stays broken in three.
 */
describe("counted phrases", () => {
  test("one is singular", () => {
    expect(countOf(1, "order")).toBe("1 order");
  });

  test("zero and many are plural", () => {
    expect(countOf(0, "order")).toBe("0 orders");
    expect(countOf(3, "order")).toBe("3 orders");
  });

  test("an irregular plural is given, never guessed", () => {
    expect(countOf(2, "entry", "entries")).toBe("2 entries");
  });
});
```

Extend `apps/web-v2/e2e/invariants/escalations.spec.ts`:

```ts
/**
 * The export makes escalated work unmistakably HELD before a word is read: an
 * amber kicker and an amber top edge on the card in question. The app's screen
 * carried no amber at all, so nothing said the work was stopped.
 */
test("the escalation screen states that the work is held", async ({ page }) => {
  await page.goto("/escalations");
  await expect(page.getByText("HELD · ESCALATED · SENIOR REVIEW")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates
pnpm --filter web-v2 test:e2e -- e2e/invariants/escalations.spec.ts
```

Expected failures: `Cannot find module './plural'`; and both e2e assertions — there is no held kicker, and `ScreenTitle` renders its eyebrow in a `<span>`, so the screen has no `<h1>` at all (its largest heading is `ESCALATION INBOX` at 10px).

- [ ] **Step 3: Implement**

```ts
/**
 * A counted phrase, pluralised. English's default is +s and the irregulars are
 * PASSED IN, never guessed — a table of exceptions in a UI helper is a second
 * vocabulary nobody maintains.
 */
export function countOf(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}
```

Use it at `ClusterRail.tsx:63` (`1 orders` → `1 order`) and wherever queue, overview and completeness print the same shape.

`EscalationsScreen.tsx`: root becomes `<Screen measure="700" pad="28x32" placement="top">` with the cluster rail at the archive's 380px (`lg:grid-cols-[23.75rem_1fr]`) and the detail column capped at `max-w-440`. Render `<ScreenHeading eyebrow={<span className="text-state-attend-ink">HELD · ESCALATED · SENIOR REVIEW</span>} title={…} lede="You land on the field in question, not the top of the order. Rule on it and return, or take the order over." />` — literal capitals in the markup, never a CSS transform. `ScreenHeading` renders a real `<h1>`, which this screen has never had; the cluster in words is the heading and the mono path is a sub-line. Give the selected cluster's question card `Card accent="attend"` — the corrected 2px inset top edge.

`ClusterRail.tsx`: sunken surface plus a right rule; each cluster a `Card size="nested"`; selection carried by an accent edge, not a fill alone.

`ResolveCard.tsx`: replace the hand-rolled native `<select>` at `:82` with the shared `Select` — it is the only raw `<select>` in the app, a different radius and height from every other control, and a native option cannot render the rule-citation text the trigger currently truncates at 70 characters. Keep the live-rules-only filter. Add the export's placeholders to both textareas (the ruling: `e.g. Lot 17 confirmed against the recorded plat, Book 144 Pg 38; microfilm degraded but plat is legible.`); this is the only screen in the app that dropped them. Pass `tone="action"` to the instruction eyebrow at `:56`. Render the questions and the recorded ruling through `Quote`.

`Take the order over` stays **absent**: ruling Q15 is open and no ownership-transfer concept exists in the data model, so an inert button would be worse than the omission.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
pnpm --filter web-v2 test:e2e -- e2e/invariants/escalations.spec.ts
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Queue /escalations ../../shots
```

The export's sidebar draws no escalations door, so `compare.mjs` will warn and capture the export's default screen; compare the app capture against the stored `shots/design-escalation.png` instead. The screen must read amber-held at a glance, carry a real `<h1>`, and hold its form to a column rather than running an uppercase instruction across ~830px.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/escalations apps/web-v2/src/shared/plural.ts apps/web-v2/src/shared/plural.test.ts apps/web-v2/e2e/invariants/escalations.spec.ts
git commit -m "$(cat <<'EOF'
Put the held register on the escalation screen

Nothing on the screen was amber, so nothing said the work was stopped —
which is the first thing the design communicates about escalated work. The
kicker, the card edge and the section chip now carry it, and the screen
gains an h1: the eyebrow was doing the job of a title, so the largest
heading on the page was 10px and the one below it was a dotted machine
path.

The ruling form drops the app's only hand-rolled native select for the
shared one, which can render the full rule citation the trigger was
truncating, and both textareas regain the worked-example placeholders
every other form in the app already has. The screen's cluster shape stays
as C21 settled it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Profile — the 720px column and three preferences that survive a navigation

**Files:**
- Modify: `apps/web-v2/src/features/profile/ProfileScreen.tsx:40-64`
- Modify: `apps/web-v2/src/features/profile/PreferencesCard.tsx:10-40`
- Modify: `apps/web-v2/src/app/preferences.ts`
- Modify: `apps/web-v2/src/features/profile/CapabilityCard.tsx`
- Test: `apps/web-v2/src/app/preferences.test.ts` (extend)

**Interfaces:**

Consumes `Screen`, `ScreenHeading`, `PanelCard` (Wave 1).

Produces:

```tsx
// src/app/preferences.ts — one hook where there were three near-identical ones
export function usePreference<K extends keyof Preferences>(
  key: K,
): { value: Preferences[K]; set: (next: Preferences[K]) => void };
```

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/app/preferences.test.ts`:

```ts
/**
 * §4.8 makes server-side preferences a release rule, not a nicety. Zoom,
 * reduced motion and keyboard shortcuts were all `useState` inside the card and
 * reset on every navigation, and the card's own header claimed there was no
 * preferences endpoint — `GET/PATCH /api/me/preferences` has existed since the
 * contract shipped and is already consumed by the nav-collapse and theme hooks.
 */
describe("usePreference covers every field on the wire", () => {
  test("the hook's key set is exactly the contract's", () => {
    expect(PREFERENCE_KEYS).toEqual([
      "nav_collapsed",
      "reduced_motion",
      "default_zoom",
      "keyboard_shortcuts",
      "theme",
    ]);
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=gates
```

Expected failure: `SyntaxError: The requested module './preferences' does not provide an export named 'PREFERENCE_KEYS'`.

- [ ] **Step 3: Implement**

`preferences.ts`: export `PREFERENCE_KEYS` and fold `useNavCollapsed`, `useTheme` and the two new readers into one generic `usePreference(key)` keeping the existing optimistic-write-plus-rollback pattern. `keyboard_shortcuts` is Wave 2's contract addition; if it did not land, the switch renders with its own one-row note saying it is not persisted — a blanket "no preferences endpoint" claim over three rows hides the one real gap.

`PreferencesCard.tsx`: delete the false CONTRACT GAP header comment and the three `useState` calls at `:26-28`; each row reads and writes through `usePreference`. Nothing touches browser storage.

`CapabilityCard.tsx`: render `granted.label` — Wave 2 added `label` to the authz projection — and drop `font-mono`. The component's refusal to invent the prose was right (a second copy of the authz vocabulary in the browser is what the projection exists to prevent); the fix was always contract-side.

`ProfileScreen.tsx`: root becomes `<Screen measure="720" pad="28x32" placement="top">`; the four cards become `PanelCard`; the header gets 18px below it rather than sharing the container's 14px gap, so the title separates from the stack.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
```

- [ ] **Step 5: Capture against the export and look at the pair**

```
node apps/web-v2/compare.mjs Queue /profile ../../shots
```

The export reaches profile from the account menu, not the sidebar, so `compare.mjs` warns and captures the default screen; compare the app capture against the stored `shots/design-profile.png`. Cards must span 719–720px, not 421px, and "What I can do" must be four human sentences rather than 39 identifiers.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/profile apps/web-v2/src/app/preferences.ts apps/web-v2/src/app/preferences.test.ts
git commit -m "$(cat <<'EOF'
Put the profile's preferences on the wire

Zoom, reduced motion and keyboard shortcuts were useState inside the card
and reset on every navigation, under a header comment claiming there was
no preferences endpoint. GET/PATCH /api/me/preferences has existed since
the contract shipped and the nav-collapse and theme hooks already use it;
one usePreference hook now covers every field, and §4.8 makes that a
release rule rather than a nicety.

The capability card renders the granted permission's label instead of 39
raw action identifiers — the component was right to refuse to invent the
prose, and the fix was always contract-side — and the screen takes the
export's 720px column instead of shrink-wrapping to its widest row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Delivered, Session, Signin and Surface failure — one centred wrapper, one mark

**Files:**
- Modify: `apps/web-v2/src/features/delivered/DeliveredScreen.tsx:70-88`
- Modify: `apps/web-v2/src/features/session/SessionEndedScreen.tsx:28-76`
- Modify: `apps/web-v2/src/features/signin/SigninScreen.tsx:29-52`
- Modify: `apps/web-v2/src/features/surfacefail/SurfaceFailureScreen.tsx:29-47`
- Create: `apps/web-v2/src/shared/ui/PipeMark.tsx`
- Delete: `apps/web-v2/src/features/signin/PipeMark.tsx`
- Modify: `apps/web-v2/src/app/SidebarBrand.tsx:8-12`
- Test: `apps/web-v2/src/shared/ui/PipeMark.stories.tsx`

**Interfaces:**

Consumes `CenteredScreen` (Wave 1, pinned):

```tsx
export interface CenteredScreenProps { measure: ScreenMeasure; children: ReactNode }
export function CenteredScreen(props: CenteredScreenProps): ReactElement;
```

Produces:

```tsx
// src/shared/ui/PipeMark.tsx
export interface PipeMarkProps { size: "brand" | "signin" }
export function PipeMark(props: PipeMarkProps): ReactElement;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/src/shared/ui/PipeMark.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PipeMark } from "./PipeMark";

const meta = {
  title: "UI/PipeMark",
  component: PipeMark,
  parameters: { layout: "centered" },
} satisfies Meta<typeof PipeMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * THE OPACITY LADDER IS THE GLYPH'S MEANING: three passes over the same
 * document, one of which came back with less. Both hand-drawn copies had lost
 * it, so the mark drew three identical bars and said nothing. One component,
 * one ladder, two sizes.
 */
export const ThreeBarsSteppingDown: Story = {
  args: { size: "signin" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bars = canvas.getAllByTestId("pipe-bar");
    await expect(bars).toHaveLength(3);
    await expect(bars[1]).toHaveClass(/opacity-70/);
    await expect(bars[2]).toHaveClass(/opacity-40/);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test -- --project=storybook
```

Expected failure: `Failed to resolve import "./PipeMark" from "src/shared/ui/PipeMark.stories.tsx"` — the mark lives in `features/signin`, hand-drawn a second time in `app/SidebarBrand.tsx`, and neither copy carries the ladder.

- [ ] **Step 3: Implement**

Create `src/shared/ui/PipeMark.tsx` with the three bars, the middle one short, and the ladder `1 / .7 / .4` top to bottom, each bar carrying `data-testid="pipe-bar"`. `size="brand"` is 16px with a 3px radius (`rounded-2`), `size="signin"` is 40px with a 5px radius (`rounded-3`). Delete `features/signin/PipeMark.tsx` and consume the shared one from `SigninScreen` and `SidebarBrand` — the old comment claimed the two copies were "constructed the same way … so they cannot drift apart" while being a second copy, and they had drifted identically-wrongly.

Replace the four byte-identical `flex min-h-full items-center justify-center py-20` wrappers with `CenteredScreen`: `measure="460"` on delivered, `"420"` on session, `"380"` on signin, `"440"` on surface failure. Each screen keeps its own contents unchanged.

`SessionEndedScreen.tsx:76`: move `const DEMO_HELD_ORDER = "4176034-1"` out of the screen and into `packages/mocks`. The CONTRACT GAP note above it is correct about the wire — nothing tells a signed-out client which order the session held — but a fixture must not live as a private constant inside a screen (§5). Keep the `orderId` prop as the injection point.

`DeliveredScreen.tsx`: keep the honest-disabled Download and its recorded gap — no endpoint names or serves the .docx, and an inert-looking control beats a live-looking one that does nothing.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test -- --project=storybook
```

- [ ] **Step 5: Capture against the export and look at the pairs**

```
node apps/web-v2/compare.mjs Delivered /delivered ../../shots
```

For `/signin`, `/session` and `/surface-failure` the export draws no sidebar entry, so compare the app captures against the stored `shots/design-signin.png` and `shots/design-session.png`. All four must be centred on the **full viewport** with no chrome on signin and session (Wave 0's `chromeFor()` owns that), and the sign-in mark's third bar must be visibly paler than its first.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/features/delivered apps/web-v2/src/features/session apps/web-v2/src/features/signin apps/web-v2/src/features/surfacefail apps/web-v2/src/shared/ui/PipeMark.tsx apps/web-v2/src/shared/ui/PipeMark.stories.tsx apps/web-v2/src/app/SidebarBrand.tsx
git commit -m "$(cat <<'EOF'
Collapse the four centred screens onto one wrapper and one mark

Delivered, session, sign-in and surface failure carried byte-identical
centring wrappers — the four-near-identical-renderers failure at its
smallest and clearest. All four now take the shared centred screen with
the export's own measure.

The pipe mark was hand-drawn twice, in a component whose comment claimed
the two could not drift apart, and both copies had lost the opacity ladder
that is the glyph's whole meaning: three passes over the same document,
one of which came back with less. One mark now, one ladder, two sizes. The
session screen's held-order number moves to the mocks, where fixtures live.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Wave exit

After Task 17, run the whole gate plus the end-of-wave checks:

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip && pnpm --filter web-v2 test:e2e
pnpm typecheck
```

Then re-capture all eighteen screens and look at every pair. The 2026-07-30 baseline was 297 tests, `check:rules` clean over 283 files, zero skips — any red is this work. And a green suite is still not evidence the UI is right: the pairs are.

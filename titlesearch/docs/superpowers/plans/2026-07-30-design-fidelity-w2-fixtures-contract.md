# [Wave 2] — Fixtures and Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hand-maintained, mutually contradicting demo order lists with ONE shared order set every endpoint reads, and add the read-only contract shapes the export's screens need, each recorded as a UI-driven request awaiting ratification.

**Architecture:** `packages/mocks/src/data.ts` gains a single `demoOrders` table — one row per order, carrying its identity, its band, its lifecycle stage and its package anchors. Every endpoint (`/api/queue/next`, the new `/api/queue/bands`, `/api/lifecycle`, `/api/orders/:id/{context,signoff,pipeline,completeness}`, the deliveries store) projects that one table instead of restating it. `packages/contract` gains the read shapes those projections need; not one of them carries a write, a transition or a threshold.

**Prerequisites:** None. Wave 2 runs concurrently with Wave 1 (different packages, zero file overlap) and does not depend on Wave 0. It must land before Wave 4, which assembles the screens over this data.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **every added contract shape is a READ shape and carries the ratification note verbatim** (root `CLAUDE.md`: never generate backend logic from the UI); **no fixture string carries its own page count** — it quotes `PACKAGE_PAGES` or the order's own `pages`; and **no screen may be given a behaviour change here** — the only `apps/web-v2/src` edits permitted are the ones typecheck forces, listed per task.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/mocks/src/data.ts` | **Create the shared set.** `PACKAGE_PAGES` / `PRODUCT_NAME` / `PERIOD_LABEL` anchors, `DemoOrderRow`, the twelve-row `demoOrders` table, `demoOrderRow()` / `demoOrderEntity()` lookups. Retires `demoOrder` / `demoOrder2`. |
| `packages/mocks/src/index.ts` | Re-export surface: `demoOrders` replaces the two singletons. |
| `packages/mocks/src/handlers.ts` | `/api/queue/next` and the deliveries store read the shared set. Adds `/api/orders/:id/context` and `/api/queue/bands`. |
| `packages/mocks/src/workspace.ts` | The per-screen projections: lifecycle board, sign-off, pipeline, completeness — all derived from the shared set, all exported for round-trip tests. |
| `packages/contract/src/entities.ts` | `Order.product/period/pages`; `Field.asking/why`. |
| `packages/contract/src/intake.ts` | `LifecycleStamp`, `OrderContextResponse`, `LifecycleStage.sub/waiting_on`, `LifecycleOrder.id/mine/state_label`, `OrderSignoffLine.answers/policy_suggestion`, `CompletenessGap.line_number`, `GapCloseOption`, `Preferences.nav_collapsed` nullability. |
| `packages/contract/src/endpoints.ts` | `QueueBandId`, `QueueBandOrder`, `QueueBand`, `QueueBandsResponse`. |
| `apps/web-v2/vitest.config.ts` | Gates project collects `*.test.ts` by glob so wave test files need no per-file registration. |
| `apps/web-v2/tsconfig.node.json` | Same glob, so the new root tests typecheck. |
| `apps/web-v2/fixtures-orders.test.ts` | The shared set parses, is internally consistent, and no fixture string carries its own page count. |
| `apps/web-v2/contract-order-context.test.ts` | `Order.product/period/pages` and `/api/orders/:id/context` round-trip. |
| `apps/web-v2/contract-preferences.test.ts` | `nav_collapsed: null` means "never touched" and survives the wire. |
| `apps/web-v2/contract-queue-bands.test.ts` | Band shapes parse; `count` is server-supplied; role filtering. |
| `apps/web-v2/contract-lifecycle.test.ts` | Seven stages with the export's ids, no `failed` stage, census ≥ listed. |
| `apps/web-v2/contract-signoff.test.ts` | The canonical thirteen: per-line `answers`, `comment_on_no`, `policy_suggestion`. |
| `apps/web-v2/fixtures-pipeline.test.ts` | Eight stages, 64 pages, and the done-stage-never-open-badge rule. |
| `apps/web-v2/contract-completeness.test.ts` | `line_number`, structured `close_options`, the period gap's third option. |
| `apps/web-v2/contract-field-question.test.ts` | `Field.asking` / `Field.why` on every queued decision. |
| `apps/web-v2/e2e/invariants/queue.spec.ts` | Order refs become the export's numbers. No assertion weakened. |
| `apps/web-v2/src/features/questions/queries.ts` | Points at the intake-stage order so `/questions` opens unsigned, 0 of 13. |
| `apps/web-v2/src/features/completeness/GapCloseOptions.tsx` | Renders the server's structured close options. |
| `apps/web-v2/src/features/completeness/CompletenessScreen.tsx` | The now-false `CONTRACT GAP` note about opaque strings is deleted. |
| `apps/web-v2/src/features/completeness/GapOptionButton.tsx` | Same note, same deletion. |
| `apps/web-v2/src/app/preferences.ts` | Merge on `!== undefined`, not `??`, now that `null` is a legal value. |
| `apps/web-v2/src/app/OrderStrip.stories.tsx`, `src/features/review/FinalizeBar.stories.tsx`, `src/features/review/NoDisclosureCards.stories.tsx` | Story literals gain the new required fields. |
| `docs/frontend/conflicts.md` | Records the three departures this wave takes from the export. |

---

### Task 1: The one shared order set

**Files:**
- Modify: `packages/mocks/src/data.ts:1-50` (replace `demoOrder` / `demoOrder2`), `packages/mocks/src/data.ts:820-843` (timelines quote the page count)
- Modify: `packages/mocks/src/index.ts:2`
- Modify: `packages/mocks/src/handlers.ts:33-44,63`
- Modify: `apps/web-v2/vitest.config.ts:30-38`, `apps/web-v2/tsconfig.node.json:29-35`
- Modify: `apps/web-v2/e2e/invariants/queue.spec.ts:20,22,43,49,59,65,67`
- Test: `apps/web-v2/fixtures-orders.test.ts`

**Interfaces:**

Consumes: `Order`, `OrderStatus` from `packages/contract/src/entities.ts` / `enums.ts` (unchanged in this task).

Produces — all from `packages/mocks/src/data.ts`:

```ts
export const PACKAGE_PAGES = 64;
export const PACKAGE_PAGES_RELEVANT = 11;
export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_LABEL = "40-year period · 07/18/1986 – 07/18/2026";

export type DemoBandId = "mine" | "held" | "in_flight" | "delivered";
export type DemoStageId =
  | "unassigned" | "intake" | "machine" | "gate" | "review" | "escalated" | "delivered";
export type DemoStampTone = "neutral" | "action" | "settled" | "attend" | "halt";

export interface DemoOrderRow {
  readonly id: string;
  readonly order_ref: string;
  readonly client_id: string;
  readonly jurisdiction: string;
  readonly state: string;
  readonly county: string;
  readonly status: string;
  readonly arrived_at: string;
  readonly accepted_at: string | null;
  readonly delivered_at: string | null;
  readonly product: string;
  readonly period: string;
  readonly pages: number | null;
  /** Which queue band lists it. `null` = the served next-up order, which is not a band. */
  readonly band: DemoBandId | null;
  readonly stage: DemoStageId;
  /** Server ordering for GET /api/queue/next. `null` = not in the served queue. */
  readonly queue_position: number | null;
  readonly addr: string;
  readonly place: string;
  readonly waited: string | null;
  readonly waiting_on: string;
  readonly state_label: string | null;
  readonly mine: boolean;
  readonly failed: boolean;
  readonly stamp_label: string;
  readonly stamp_tone: DemoStampTone;
}

export const demoOrders: readonly DemoOrderRow[];
export function demoOrderRow(id: string): DemoOrderRow | undefined;
export function demoOrderEntity(row: DemoOrderRow): Order;
export const demoQueue: readonly DemoOrderRow[];   // queue_position order, ascending
```

`demoOrder` and `demoOrder2` are deleted. Later tasks add `product` / `period` / `pages` to the `Order` schema and `demoOrderEntity` starts emitting them; no row literal changes.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/fixtures-orders.test.ts`:

```tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
// Relative .ts imports, same reason authz.test.ts states: this file typechecks
// under tsconfig.node.json (nodenext), where the workspace alias would need
// emitted declarations the source-only packages do not produce.
import {
  PACKAGE_PAGES,
  PERIOD_LABEL,
  PRODUCT_NAME,
  demoOrderEntity,
  demoOrderRow,
  demoOrders,
  demoQueue,
} from "../../packages/mocks/src/data.ts";
import { Order } from "../../packages/contract/src/entities.ts";

const MOCKS = join(process.cwd(), "..", "..", "packages", "mocks", "src");

describe("the shared demo order set", () => {
  test("every row is a parseable Order and every id and ref is unique", () => {
    for (const row of demoOrders) {
      expect(Order.safeParse(demoOrderEntity(row)).success).toBe(true);
    }
    expect(new Set(demoOrders.map((r) => r.id)).size).toBe(demoOrders.length);
    expect(new Set(demoOrders.map((r) => r.order_ref)).size).toBe(demoOrders.length);
  });

  test("carries the export's anchors on the live order", () => {
    const live = demoOrderRow("ord_demo_1");
    expect(live?.order_ref).toBe("4176034-1");
    expect(live?.product).toBe(PRODUCT_NAME);
    expect(live?.period).toBe(PERIOD_LABEL);
    expect(live?.pages).toBe(PACKAGE_PAGES);
    expect(PRODUCT_NAME).toBe("40-Year Search");
    expect(PERIOD_LABEL).toBe("40-year period · 07/18/1986 – 07/18/2026");
    expect(PACKAGE_PAGES).toBe(64);
  });

  test("the export's five named orders are all present", () => {
    const refs = demoOrders.map((r) => r.order_ref);
    for (const ref of ["4176034-1", "4176052-7", "4176011-2", "4175994-0", "4175980-1", "4175972-3"]) {
      expect(refs).toContain(ref);
    }
  });

  test("the served queue is ordered by the server, not by array position", () => {
    const positions = demoQueue.map((r) => r.queue_position);
    expect(positions).toEqual([...positions].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(demoQueue[0]?.id).toBe("ord_demo_1");
    expect(demoQueue.every((r) => r.queue_position !== null)).toBe(true);
  });

  test("no fixture string carries its own page count", () => {
    // A literal "38 pages" is how the 38-vs-64 contradiction got in. Every
    // derived string must interpolate the count it is talking about.
    for (const file of ["data.ts", "workspace.ts", "handlers.ts"]) {
      const lines = readFileSync(join(MOCKS, file), "utf8").split("\n");
      const offenders = lines
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /\b\d+\s+(relevant\s+)?pages\b/.test(line))
        .filter(({ line }) => !line.includes("rules-allow:"))
        .map(({ line, n }) => `${file}:${n} ${line.trim()}`);
      expect(offenders).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates fixtures-orders
```

Expected: `No test files found, exiting with code 1` — the gates project's `include` still lists `vocabulary.test.ts` and `authz.test.ts` by name. After Step 3's config edit and before the fixture edit it fails instead with `Cannot find module '../../packages/mocks/src/data.ts'`-class resolution errors for `PACKAGE_PAGES`, `demoOrders`, `demoOrderRow`, `demoOrderEntity`, `demoQueue`.

- [ ] **Step 3: Implement**

**3a — collect the wave's tests by glob.** In `apps/web-v2/vitest.config.ts`, replace the two named entries in the `gates` project's `include` with the glob:

```ts
          include: [
            // Root-level gates over `packages/` — contract shapes and the mock
            // fixtures that serve them. Collected by glob so a new gate needs no
            // config edit; e2e lives under `e2e/**/*.spec.ts` and is Playwright's.
            "*.test.ts",
            // Pure-logic entity tests. Kept DOM-free on purpose so rules like
            // no-value exhaustiveness are provable without a browser.
            "src/**/*.test.ts",
          ],
```

In `apps/web-v2/tsconfig.node.json`, replace `"vocabulary.test.ts", "authz.test.ts"` in `include` with `"*.test.ts"`.

**3b — the shared set.** In `packages/mocks/src/data.ts`, replace the `demoOrder` / `demoOrder2` block (lines 25-52, keeping `const oid = demoOrder.id;` working by re-pointing it) with:

```ts
/**
 * THE ONE DEMO ORDER SET. Every endpoint that lists, counts or names an order
 * projects this table: `/api/queue/next`, `/api/queue/bands`, `/api/lifecycle`,
 * `/api/orders/:id/{context,signoff,pipeline,completeness}` and the deliveries
 * store. There were two hand-maintained copies until 2026-07-30 and they had
 * already drifted — the lifecycle board and `/api/queue/next` disagreed about
 * what state 4176034-1 was in. A second copy of a fact is a second answer.
 *
 * The refs, the package size, the product and the period are the 2026-07-28
 * export's own. The GEOGRAPHY is deliberately NOT: the export's addresses read
 * like real Arizona property, and this file's scrubbing rule (synthetic
 * persons, synthetic places) is worth more than matching a street name that
 * nothing on any screen is measured against.
 */
export const PACKAGE_PAGES = 64;
/** Pages the classifier carried forward. Quoted, never restated as a numeral. */
export const PACKAGE_PAGES_RELEVANT = 11;
export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_LABEL = "40-year period · 07/18/1986 – 07/18/2026";

export type DemoBandId = "mine" | "held" | "in_flight" | "delivered";
export type DemoStageId =
  | "unassigned"
  | "intake"
  | "machine"
  | "gate"
  | "review"
  | "escalated"
  | "delivered";
export type DemoStampTone = "neutral" | "action" | "settled" | "attend" | "halt";

export interface DemoOrderRow {
  readonly id: string;
  readonly order_ref: string;
  readonly client_id: string;
  readonly jurisdiction: string;
  readonly state: string;
  readonly county: string;
  readonly status: string;
  readonly arrived_at: string;
  readonly accepted_at: string | null;
  readonly delivered_at: string | null;
  readonly product: string;
  readonly period: string;
  /** Null when the package could not be read at all — never 0, which is a count. */
  readonly pages: number | null;
  readonly band: DemoBandId | null;
  readonly stage: DemoStageId;
  readonly queue_position: number | null;
  readonly addr: string;
  readonly place: string;
  readonly waited: string | null;
  readonly waiting_on: string;
  readonly state_label: string | null;
  readonly mine: boolean;
  readonly failed: boolean;
  readonly stamp_label: string;
  readonly stamp_tone: DemoStampTone;
}

type DemoOrderSpec = Omit<
  DemoOrderRow,
  "client_id" | "status" | "arrived_at" | "accepted_at" | "delivered_at"
>;

const ARRIVED = "2026-07-24T13:05:00Z";
const ACCEPTED = "2026-07-24T13:22:00Z";
const DELIVERED = "2026-07-24T17:20:00Z";

/**
 * Status and the three timestamps are DERIVED from the stage, not restated per
 * row: a fixture that lets an order be `delivered` with a null `delivered_at`
 * is the same class of self-contradiction this table exists to end.
 */
function row(spec: DemoOrderSpec): DemoOrderRow {
  const claimed = spec.stage !== "unassigned";
  const done = spec.stage === "delivered";
  return {
    ...spec,
    client_id: "cli_riverbend",
    status: done ? "delivered" : claimed ? "accepted" : "ingested",
    arrived_at: ARRIVED,
    accepted_at: claimed ? ACCEPTED : null,
    delivered_at: done ? DELIVERED : null,
  };
}

export const demoOrders: readonly DemoOrderRow[] = [
  row({
    id: "ord_demo_1", order_ref: "4176034-1", queue_position: 0,
    band: "mine", stage: "gate", mine: true, failed: false,
    addr: "4152 Creekstone Dr, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "3h 12m", waiting_on: "Package incomplete", state_label: null,
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_2", order_ref: "4176052-7", queue_position: 1,
    band: null, stage: "unassigned", mine: false, failed: false,
    addr: "61 Harrowgate Row, Ashford Ridge NY", place: "Greene County · NY",
    jurisdiction: "greene-ny", county: "Greene", state: "NY",
    product: "60-Year Search", period: "60-year period · 07/18/1966 – 07/18/2026", pages: 92,
    waited: null, waiting_on: "Unclaimed — nobody has taken it", state_label: null,
    stamp_label: "Sign-off open", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_4", order_ref: "4176041-6", queue_position: null,
    band: "mine", stage: "intake", mine: true, failed: false,
    addr: "18 Marlin Way, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "1h 48m", waiting_on: "Sign-off open", state_label: null,
    stamp_label: "Sign-off open", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_5", order_ref: "4176011-2", queue_position: null,
    band: "held", stage: "gate", mine: true, failed: false,
    addr: "72 Aldergate Rd, Fairhollow GA", place: "Greene County · GA",
    jurisdiction: "greene-ga", county: "Greene", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: 48,
    waited: "1d 4h", waiting_on: "Waiting on the abstractor to add documents",
    state_label: "Package incomplete",
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_6", order_ref: "4175994-0", queue_position: null,
    band: "held", stage: "escalated", mine: true, failed: false,
    addr: "9 Pellham Ct, Warrenton GA", place: "Houston County · GA",
    jurisdiction: "houston-ga", county: "Houston", state: "GA",
    product: "20-Year Search", period: "20-year period · 07/18/2006 – 07/18/2026", pages: 36,
    waited: "6h 40m", waiting_on: "Waiting on a senior abstractor",
    state_label: "Escalated",
    stamp_label: "Escalated", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_7", order_ref: "4175998-9", queue_position: null,
    band: "held", stage: "gate", mine: false, failed: true,
    addr: "Address unreadable on cover", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: null,
    waited: "2d 1h", waiting_on: "Waiting on intake to re-upload",
    state_label: "Failed validation",
    stamp_label: "Failed validation", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_8", order_ref: "4176003-4", queue_position: null,
    band: "held", stage: "delivered", mine: false, failed: true,
    addr: "231 Foxglove Row, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: "Two-Owner Search", period: "current owner + one prior owner", pages: 22,
    waited: "22m", waiting_on: "Waiting on ops", state_label: "Delivery failed",
    stamp_label: "Delivery failed", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_9", order_ref: "4176048-3", queue_position: null,
    band: "in_flight", stage: "machine", mine: false, failed: false,
    addr: "441 Kestrel Ln, Brackendale NC", place: "Mecklenburg County · NC",
    jurisdiction: "mecklenburg-nc", county: "Mecklenburg", state: "NC",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: 71,
    waited: "12m", waiting_on: "Extract fields", state_label: null,
    stamp_label: "Running", stamp_tone: "neutral",
  }),
  row({
    id: "ord_demo_10", order_ref: "4176050-1", queue_position: null,
    band: "in_flight", stage: "review", mine: false, failed: false,
    addr: "88 Larkspur Ave, Brackendale NC", place: "Mecklenburg County · NC",
    jurisdiction: "mecklenburg-nc", county: "Mecklenburg", state: "NC",
    product: "Update Search", period: "since prior effective date · 03/02/2024", pages: 18,
    waited: "48m", waiting_on: "Human QC gate", state_label: null,
    stamp_label: "Decisions open", stamp_tone: "action",
  }),
  row({
    id: "ord_demo_11", order_ref: "4176045-9", queue_position: null,
    band: "in_flight", stage: "gate", mine: false, failed: false,
    addr: "5 Windmere Ct, Fairhollow GA", place: "Greene County · GA",
    jurisdiction: "greene-ga", county: "Greene", state: "GA",
    product: "20-Year Search", period: "20-year period · 07/18/2006 – 07/18/2026", pages: 55,
    waited: "1h 05m", waiting_on: "Completeness gate", state_label: null,
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_12", order_ref: "4175980-1", queue_position: null,
    band: "delivered", stage: "delivered", mine: true, failed: false,
    addr: "1740 Thistledown Rd, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "2h", waiting_on: "Delivered", state_label: null,
    stamp_label: "Finalized", stamp_tone: "settled",
  }),
  row({
    id: "ord_demo_13", order_ref: "4175972-3", queue_position: null,
    band: "delivered", stage: "delivered", mine: true, failed: false,
    addr: "27 Quillon St, Warrenton GA", place: "Houston County · GA",
    jurisdiction: "houston-ga", county: "Houston", state: "GA",
    product: "Two-Owner Search", period: "current owner + one prior owner", pages: 31,
    waited: "1d", waiting_on: "Delivered", state_label: null,
    stamp_label: "Finalized", stamp_tone: "settled",
  }),
];

export function demoOrderRow(id: string): DemoOrderRow | undefined {
  return demoOrders.find((r) => r.id === id);
}

/** The contract entity for one row. Adding a field to `Order` edits only this. */
export function demoOrderEntity(row: DemoOrderRow): Order {
  return {
    id: row.id,
    client_id: row.client_id,
    external_ref: row.order_ref,
    jurisdiction: row.jurisdiction,
    state: row.state,
    county: row.county,
    status: row.status,
    arrived_at: row.arrived_at,
    accepted_at: row.accepted_at,
    delivered_at: row.delivered_at,
  };
}

/**
 * SERVER-ORDERED, and that is the whole point of `queue_position` being data:
 * the queue is not a list to shop through, so the order of service is a fact
 * the fixture states rather than an accident of array order.
 */
export const demoQueue: readonly DemoOrderRow[] = demoOrders
  .filter((r) => r.queue_position !== null)
  .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
```

Then replace the old `const oid = demoOrder.id;` with `const oid = "ord_demo_1";` and add above it the note `/** The live review order — the package `demoFields` and `demoPages` describe. */`.

**3c — quote the page count in the timelines.** In `demoTimelines` (`data.ts:820-843`) replace the two hard-coded strings:

- `detail: "38 relevant pages · 2 engines"` → `` detail: `${PACKAGE_PAGES_RELEVANT} relevant pages · 2 engines` ``
- `detail: "22 relevant pages · 2 engines"` → `` detail: `${demoOrderRow("ord_demo_2")?.pages ?? 0} pages received · 2 engines` ``

**3d — re-export.** `packages/mocks/src/index.ts` line 2 becomes:

```ts
export { demoFields, demoOrders, demoPages, demoRules } from "./data.js";
export { PACKAGE_PAGES, PERIOD_LABEL, PRODUCT_NAME, demoOrderRow } from "./data.js";
```

**3e — the queue handler.** In `packages/mocks/src/handlers.ts`, replace the `demoOrder, demoOrder2` imports (lines 39-40) with `demoOrderEntity, demoQueue,` and replace line 63:

```ts
const queue = demoQueue.map(demoOrderEntity);
```

In the deliveries store (`handlers.ts:101`) leave the array intact; its `report.order_id` values `ord_demo_1` / `ord_demo_2` / `ord_demo_3` become `ord_demo_1` / `ord_demo_2` / `ord_demo_12` and `ord_demo_13` so every delivery points at a row in the shared set — edit `demoDeliveries` in `data.ts:651-716`, replacing the two `order_id: "ord_demo_3"` occurrences with `"ord_demo_12"` (del_3/rep_3) and `"ord_demo_13"` (del_4/rep_4). Do the same in `demoComplaints` (`data.ts:722-757`): `cmp_2` and `cmp_3` move from `ord_demo_3` to `ord_demo_13`.

**3f — the e2e refs.** In `apps/web-v2/e2e/invariants/queue.spec.ts` replace the literal `"DEMO-0001"` with `"4176034-1"` (lines 20, 43, 49, 59), `"DEMO-0002"` with `"4176052-7"` (lines 22, 67) and `"passed DEMO-0001"` with `"passed 4176034-1"` (line 65). Nothing else changes: the served order and its position are unchanged, so *"exactly one order, no list"* is asserted exactly as before.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates fixtures-orders
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/mocks/src/data.ts packages/mocks/src/index.ts packages/mocks/src/handlers.ts \
        apps/web-v2/vitest.config.ts apps/web-v2/tsconfig.node.json \
        apps/web-v2/fixtures-orders.test.ts apps/web-v2/e2e/invariants/queue.spec.ts
```

```
Serve every screen from one demo order set

Two hand-maintained order lists had already drifted: the lifecycle board and
/api/queue/next disagreed about what state 4176034-1 was in. One table now
carries each order's band, stage and package anchors, and every endpoint
projects it. Page counts are quoted from PACKAGE_PAGES rather than restated,
with a gate that fails on any fixture string carrying its own numeral.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 2: `Order.product/period/pages` and the order-context read

**Files:**
- Modify: `packages/contract/src/entities.ts:32-44`
- Modify: `packages/contract/src/intake.ts` (append a new section after the lifecycle census)
- Modify: `packages/contract/src/index.ts`
- Modify: `packages/mocks/src/data.ts` (`demoOrderEntity`)
- Modify: `packages/mocks/src/handlers.ts:320-336` (the create handler's order literal)
- Modify: `packages/mocks/src/workspace.ts` (new `contextFor` + handler)
- Test: `apps/web-v2/contract-order-context.test.ts`

**Interfaces:**

Consumes: `DemoOrderRow`, `demoOrderRow`, `demoOrders`, `demoOrderEntity` (Task 1).

Produces:

```ts
// packages/contract/src/entities.ts — three fields on Order
product: z.string().nullable();
period: z.string().nullable();
pages: z.number().int().nullable();

// packages/contract/src/intake.ts
export const LifecycleStamp = z.object({
  label: z.string(),
  tone: z.enum(["neutral", "action", "settled", "attend", "halt"]),
});
export type LifecycleStamp = z.infer<typeof LifecycleStamp>;

export const OrderContextResponse = z.object({
  order_id: z.string(),
  order_ref: z.string(),
  product: z.string().nullable(),
  period: z.string().nullable(),
  pages: z.number().int().nullable(),
  stamp: LifecycleStamp,
});
export type OrderContextResponse = z.infer<typeof OrderContextResponse>;
```

```ts
// packages/mocks/src/workspace.ts
export function contextFor(orderId: string): OrderContextResponse;
// GET /api/orders/:id/context
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-order-context.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { demoOrderEntity, demoOrders } from "../../packages/mocks/src/data.ts";
import { contextFor } from "../../packages/mocks/src/workspace.ts";
import { Order } from "../../packages/contract/src/entities.ts";
import { OrderContextResponse } from "../../packages/contract/src/intake.ts";

describe("Order gains what was ordered", () => {
  test("product, period and pages ride on the entity", () => {
    const live = Order.parse(demoOrderEntity(demoOrders[0]!));
    expect(live.product).toBe("40-Year Search");
    expect(live.period).toBe("40-year period · 07/18/1986 – 07/18/2026");
    expect(live.pages).toBe(64);
  });

  test("an unreadable package reports null pages, never zero", () => {
    const failed = demoOrders.find((r) => r.order_ref === "4175998-9")!;
    expect(Order.parse(demoOrderEntity(failed)).pages).toBeNull();
  });
});

describe("GET /api/orders/:id/context", () => {
  test("round-trips for every order in the shared set", () => {
    for (const row of demoOrders) {
      const parsed = OrderContextResponse.safeParse(contextFor(row.id));
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.order_ref).toBe(row.order_ref);
    }
  });

  test("names the human ref the URL id cannot supply", () => {
    expect(contextFor("ord_demo_1").order_ref).toBe("4176034-1");
    expect(contextFor("ord_demo_1").stamp).toEqual({
      label: "Package incomplete",
      tone: "halt",
    });
  });

  test("an unknown id is refused rather than invented", () => {
    expect(() => contextFor("ord_nope")).toThrow();
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-order-context
```

Expected: TypeScript/Vitest resolution failure — `contextFor` is not exported from `packages/mocks/src/workspace.ts` and `OrderContextResponse` is not exported from `packages/contract/src/intake.ts`.

- [ ] **Step 3: Implement**

In `packages/contract/src/entities.ts`, extend the `Order` object with three fields, placed after `county` and before `status`:

```ts
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * Root CLAUDE.md forbids generating backend logic from the UI, so these are
   * READ FIELDS ONLY: what was ordered, over what span, in how many pages.
   *
   * The delivered screen printed all three as private constants because no wire
   * carried them, and a delivery confirmation that cannot name the product is
   * confirming an unnamed thing. Nullable because an order that failed
   * validation has no resolved product and an unreadable package has no page
   * count — `null` is that statement; `0` would be a count.
   */
  product: z.string().nullable(),
  period: z.string().nullable(),
  pages: z.number().int().nullable(),
```

In `packages/mocks/src/data.ts`, `demoOrderEntity` gains the three fields from the row:

```ts
    product: row.product,
    period: row.period,
    pages: row.pages,
```

In `packages/mocks/src/handlers.ts`, the freshly-created order literal (around line 321) gains `product: null, period: null, pages: null` — an ingested package has none of them resolved yet, and that is the honest value.

In `packages/contract/src/intake.ts`, append after the lifecycle census section:

```ts
// ---- order context ---------------------------------------------------------

/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * A READ SHAPE ONLY. The stamp is the SERVER'S WORD for where this order
 * stands. The export computes it from a five-branch `if/else` in the browser
 * (`conflicts.md` C2); that is a client-side state machine and hard rule 9
 * forbids it, so the label and its tone arrive already decided.
 */
export const LifecycleStamp = z.object({
  label: z.string(),
  tone: z.enum(["neutral", "action", "settled", "attend", "halt"]),
});
export type LifecycleStamp = z.infer<typeof LifecycleStamp>;

/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * The order-scoped lookup the top strip needs and no endpoint offered: the
 * human reference for an order you have only the id of. `LifecycleOrder.order_ref`
 * lives in the census list and carries no id to join back on;
 * `Order.external_ref` arrives only from `/api/queue/next`. The strip printed
 * the opaque URL id for want of this.
 */
export const OrderContextResponse = z.object({
  order_id: z.string(),
  order_ref: z.string(),
  product: z.string().nullable(),
  period: z.string().nullable(),
  pages: z.number().int().nullable(),
  stamp: LifecycleStamp,
});
export type OrderContextResponse = z.infer<typeof OrderContextResponse>;
```

Export both from `packages/contract/src/index.ts` if that file enumerates names rather than re-exporting `*` — check and match its existing style.

In `packages/mocks/src/workspace.ts`, import `demoOrderRow` from `./data.js`, and add:

```ts
/**
 * An unknown order THROWS rather than returning a placeholder. A context
 * response that quietly names nothing is how a screen ends up printing a ref
 * that belongs to no order.
 */
export function contextFor(orderId: string): OrderContextResponse {
  const row = demoOrderRow(orderId);
  if (row === undefined) throw new Error(`no such order: ${orderId}`);
  return {
    order_id: row.id,
    order_ref: row.order_ref,
    product: row.product,
    period: row.period,
    pages: row.pages,
    stamp: { label: row.stamp_label, tone: row.stamp_tone },
  };
}
```

and register the handler in `workspaceHandlers`:

```ts
  http.get("/api/orders/:id/context", ({ params }) => {
    const row = demoOrderRow(String(params["id"]));
    if (row === undefined) return HttpResponse.json({ error: "no such order" }, { status: 404 });
    return HttpResponse.json(contextFor(row.id));
  }),
```

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-order-context
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/entities.ts packages/contract/src/intake.ts packages/contract/src/index.ts \
        packages/mocks/src/data.ts packages/mocks/src/handlers.ts packages/mocks/src/workspace.ts \
        apps/web-v2/contract-order-context.test.ts
```

```
Let an order name what was ordered and where it stands

The top strip printed the opaque URL id and the delivered screen carried the
product and period as private constants, because no order-scoped response
returned either. Order gains product/period/pages and a new
GET /api/orders/{id}/context returns the human ref with a server-decided
lifecycle stamp, so no screen composes that word itself. Read shapes only,
both recorded as UI-driven requests awaiting ratification.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 3: `nav_collapsed` can say "never touched"

**Files:**
- Modify: `packages/contract/src/intake.ts:220-228`
- Modify: `packages/mocks/src/workspace.ts:205-210`
- Modify: `apps/web-v2/src/app/preferences.ts:60-70,103-110`
- Modify: `apps/web-v2/src/app/OrderStrip.stories.tsx:40`
- Test: `apps/web-v2/contract-preferences.test.ts`

**Interfaces:**

Consumes: nothing from earlier tasks.

Produces:

```ts
// packages/contract/src/intake.ts
nav_collapsed: z.boolean().nullable();   // null = the user has never chosen
```

`Preferences`, `PreferencesResponse` and `UpdatePreferencesRequest` keep their names and their other members. `useNavCollapsed(enabled, routeDefault)` in `apps/web-v2/src/app/preferences.ts` keeps its `[boolean, () => void]` signature.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-preferences.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { Preferences, UpdatePreferencesRequest } from "../../packages/contract/src/intake.ts";
import { DEFAULT_PREFS } from "../../packages/mocks/src/workspace.ts";

describe("nav_collapsed nullability", () => {
  test("null parses and means the user has never chosen", () => {
    const p = Preferences.parse({
      nav_collapsed: null,
      reduced_motion: false,
      default_zoom: 1,
    });
    expect(p.nav_collapsed).toBeNull();
  });

  test("both booleans still parse — a real choice is still expressible", () => {
    for (const value of [true, false]) {
      const p = Preferences.parse({
        nav_collapsed: value,
        reduced_motion: false,
        default_zoom: 1,
      });
      expect(p.nav_collapsed).toBe(value);
    }
  });

  test("a PATCH may set it, and may not un-set it to null by omission", () => {
    expect(UpdatePreferencesRequest.parse({ nav_collapsed: true }).nav_collapsed).toBe(true);
    expect(UpdatePreferencesRequest.parse({}).nav_collapsed).toBeUndefined();
  });

  test("the mock's untouched default is null, not false", () => {
    // `false` won every route default it was compared against, which is why
    // starts-collapsed-on-Review was unreachable.
    expect(DEFAULT_PREFS.nav_collapsed).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-preferences
```

Expected: `DEFAULT_PREFS` is not exported from `packages/mocks/src/workspace.ts`, and once exported the null-parse case fails with `Invalid input: expected boolean, received null`.

- [ ] **Step 3: Implement**

In `packages/contract/src/intake.ts`, replace the `nav_collapsed` member and its comment:

```ts
  /**
   * Whether the screen menu is folded — or NULL, meaning the user has never
   * chosen and the route's own default governs.
   *
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * A READ SHAPE WIDENING, no new behaviour. A plain boolean cannot say
   * "untouched": the server's `false` resolved and immediately beat the route
   * default, so §11's "starts collapsed on Review, and an explicit toggle wins
   * from then on" was unreachable in practice. Three states are needed to
   * express two rules — folded, unfolded, and never asked.
   */
  nav_collapsed: z.boolean().nullable(),
```

In `packages/mocks/src/workspace.ts`, export the default and start it untouched:

```ts
export const DEFAULT_PREFS: Preferences = {
  nav_collapsed: null,
  reduced_motion: false,
  default_zoom: 1,
  theme: "titlepipe",
};
```

(`loadPrefs` already spreads `DEFAULT_PREFS`, so nothing else in that file changes.)

In `apps/web-v2/src/app/preferences.ts`, both optimistic-merge blocks currently read `body.nav_collapsed ?? previous.preferences.nav_collapsed`. `??` treats a sent `null` as "not sent", which was harmless while `null` was illegal and is a silent data loss now. Replace both occurrences with:

```ts
            nav_collapsed:
              body.nav_collapsed === undefined
                ? previous.preferences.nav_collapsed
                : body.nav_collapsed,
```

`const collapsed = data?.preferences.nav_collapsed ?? routeDefault;` (line 51) is already correct and now finally does what its comment claims — leave it, and append to that comment block: `A null preference is the "never chosen" case the route default exists for.`

In `apps/web-v2/src/app/OrderStrip.stories.tsx:40`, change `nav_collapsed: false` to `nav_collapsed: null` so the story exercises the untouched case.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-preferences
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/intake.ts packages/mocks/src/workspace.ts \
        apps/web-v2/src/app/preferences.ts apps/web-v2/src/app/OrderStrip.stories.tsx \
        apps/web-v2/contract-preferences.test.ts
```

```
Let nav_collapsed say the user has never chosen

A plain boolean could not express "untouched", so the mock's false resolved
and beat the route default every time — which made starts-collapsed-on-Review
unreachable however the sidebar was written. The preference is nullable, the
mock starts null, and the optimistic merge stops reading a sent null as an
omission.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 4: Queue band read shapes with a server-supplied count

**Files:**
- Modify: `packages/contract/src/endpoints.ts:67-74` (append after `QueueNextResponse`)
- Modify: `packages/contract/src/index.ts`
- Modify: `packages/mocks/src/handlers.ts` (new handler beside `/api/queue/next`)
- Test: `apps/web-v2/contract-queue-bands.test.ts`

**Interfaces:**

Consumes: `demoOrders`, `DemoOrderRow`, `DemoBandId` (Task 1); the `x-mock-role` header convention already used by `guard` at `handlers.ts:260`.

Produces:

```ts
// packages/contract/src/endpoints.ts
export const QueueBandId = z.enum(["mine", "held", "in_flight", "delivered"]);
export type QueueBandId = z.infer<typeof QueueBandId>;

export const QueueBandOrder = z.object({
  id: z.string(),
  order_ref: z.string(),
  addr: z.string(),
  place: z.string(),
  waited: z.string().nullable(),
  waiting_on: z.string(),
  state_label: z.string().nullable(),
  mine: z.boolean(),
});
export type QueueBandOrder = z.infer<typeof QueueBandOrder>;

export const QueueBand = z.object({
  id: QueueBandId,
  title: z.string(),
  note: z.string(),
  count: z.number().int(),
  orders: z.array(QueueBandOrder),
});
export type QueueBand = z.infer<typeof QueueBand>;

export const QueueBandsResponse = z.object({ bands: z.array(QueueBand) });
export type QueueBandsResponse = z.infer<typeof QueueBandsResponse>;
```

```ts
// packages/mocks/src/handlers.ts — GET /api/queue/bands
export function queueBandsFor(role: string): QueueBandsResponse;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-queue-bands.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { QueueBandsResponse } from "../../packages/contract/src/endpoints.ts";
import { queueBandsFor } from "../../packages/mocks/src/handlers.ts";

describe("GET /api/queue/bands", () => {
  test("round-trips for every role", () => {
    for (const role of ["reviewer", "senior", "ops", "admin"]) {
      expect(QueueBandsResponse.safeParse(queueBandsFor(role)).success).toBe(true);
    }
  });

  test("a reviewer sees only their own held work and no in-flight band", () => {
    const bands = queueBandsFor("reviewer").bands;
    expect(bands.map((b) => b.id)).toEqual(["mine", "held", "delivered"]);
    const held = bands.find((b) => b.id === "held")!;
    expect(held.orders.every((o) => o.mine)).toBe(true);
    expect(held.orders.map((o) => o.order_ref)).toEqual(["4176011-2", "4175994-0"]);
  });

  test("a senior sees every held order and the in-flight read", () => {
    const bands = queueBandsFor("senior").bands;
    expect(bands.map((b) => b.id)).toEqual(["mine", "held", "in_flight", "delivered"]);
    expect(bands.find((b) => b.id === "held")!.orders).toHaveLength(4);
    expect(bands.find((b) => b.id === "in_flight")!.orders).toHaveLength(3);
  });

  test("count is served, and is never smaller than what you can see", () => {
    for (const role of ["reviewer", "senior"]) {
      for (const band of queueBandsFor(role).bands) {
        expect(band.count).toBeGreaterThanOrEqual(band.orders.length);
      }
    }
    // The reviewer's census still counts the held work they cannot open.
    expect(queueBandsFor("reviewer").bands.find((b) => b.id === "held")!.count).toBe(4);
  });

  test("every band carries the export's own title and note", () => {
    const bands = queueBandsFor("senior").bands;
    expect(bands.map((b) => [b.title, b.note])).toEqual([
      ["Mine", "in progress"],
      ["Held", "stopped · needs someone"],
      ["In flight", "processing · senior · ops view"],
      ["Recently delivered", "get back to a recent one"],
    ]);
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-queue-bands
```

Expected: `queueBandsFor` is not exported from `packages/mocks/src/handlers.ts` and `QueueBandsResponse` is not exported from `packages/contract/src/endpoints.ts`.

- [ ] **Step 3: Implement**

In `packages/contract/src/endpoints.ts`, immediately after `QueueNextResponse`, add the block from the Interfaces section above, preceded by:

```ts
/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * READ SHAPES ONLY, and deliberately NOT a browse endpoint: none of these rows
 * offers a way to take the work. `/api/queue/next` remains the only way an
 * order is handed over. Mine is work already assigned; Held is work that
 * stopped; In flight is a senior/ops read; Recently delivered is history.
 *
 * `count` is the SERVER'S census and is not `orders.length`. The row list is
 * scoped to what the caller may open; the census is not. A count that shrank
 * with your permissions would read as work disappearing rather than as work you
 * cannot look at — the same rule `LifecycleStage.count` already states.
 *
 * Whether the Mine band may be drawn at all is open ruling Q11 (it contradicts
 * "exactly one order, no list"). This shape does not decide it; it makes the
 * data expressible so the ruling can be about the screen.
 */
```

In `packages/mocks/src/handlers.ts`, add beside the `/api/queue/next` handler:

```ts
const BAND_COPY: Record<QueueBandId, { title: string; note: string }> = {
  mine: { title: "Mine", note: "in progress" },
  held: { title: "Held", note: "stopped · needs someone" },
  in_flight: { title: "In flight", note: "processing · senior · ops view" },
  delivered: { title: "Recently delivered", note: "get back to a recent one" },
};

function bandRow(row: DemoOrderRow): QueueBandOrder {
  return {
    id: row.id,
    order_ref: row.order_ref,
    addr: row.addr,
    place: row.place,
    waited: row.waited,
    waiting_on: row.waiting_on,
    state_label: row.state_label,
    mine: row.mine,
  };
}

/**
 * The role gate is the SHOP'S, not the screen's: a reviewer's Held list is
 * narrowed to their own orders and the In flight band is absent entirely —
 * absent, not dimmed. The census still counts what they cannot open, which is
 * the whole reason `count` is served rather than derived.
 */
export function queueBandsFor(role: string): QueueBandsResponse {
  const senior = role !== "reviewer";
  const ids: QueueBandId[] = senior
    ? ["mine", "held", "in_flight", "delivered"]
    : ["mine", "held", "delivered"];
  return {
    bands: ids.map((id) => {
      const all = demoOrders.filter((r) => r.band === id);
      const visible = id === "held" && !senior ? all.filter((r) => r.mine) : all;
      return { id, ...BAND_COPY[id], count: all.length, orders: visible.map(bandRow) };
    }),
  };
}
```

and the route:

```ts
  http.get("/api/queue/bands", ({ request }) => {
    const raw = request.headers.get("x-mock-role");
    return HttpResponse.json(queueBandsFor(raw === null ? "admin" : raw));
  }),
```

Add `demoOrders`, `type DemoOrderRow` to the `./data.js` import and `QueueBandId`, `type QueueBandOrder`, `type QueueBandsResponse` to the `@titlepipe/contract` import.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-queue-bands
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/endpoints.ts packages/contract/src/index.ts \
        packages/mocks/src/handlers.ts apps/web-v2/contract-queue-bands.test.ts
```

```
Give the queue bands a wire, with the census the server owns

The four bands rendered empty because no endpoint served them and inventing
four server behaviours from a screen was worse than an honest blank. They now
have read shapes over the shared order set, with per-band count kept separate
from the row list so a reviewer's narrowed view does not read as work
disappearing. No band offers a way to take work; /api/queue/next stays the
only hand-over.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 5: The overview board — seven stages, the export's ids, no `failed` column

**Files:**
- Modify: `packages/contract/src/intake.ts:116-155` (lifecycle census)
- Modify: `packages/mocks/src/workspace.ts:139-165` (replace the `lifecycle` constant), `:306` (the handler reads the role)
- Test: `apps/web-v2/contract-lifecycle.test.ts`

**Interfaces:**

Consumes: `demoOrders`, `DemoStageId` (Task 1).

Produces:

```ts
// packages/contract/src/intake.ts — LifecycleOrder gains three, LifecycleStage two
LifecycleOrder: { id: string; order_ref: string; addr: string; county: string;
                  waiting_on: string | null; waited: string | null;
                  failed: boolean; mine: boolean; state_label: string | null }
LifecycleStage: { id: string; label: string; sub: string; waiting_on: string;
                  kind: StageKind; count: number; orders: LifecycleOrder[] }

// packages/mocks/src/workspace.ts
export function lifecycleFor(role: string): LifecycleResponse;
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-lifecycle.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { LifecycleResponse } from "../../packages/contract/src/intake.ts";
import { lifecycleFor } from "../../packages/mocks/src/workspace.ts";
import { demoOrders } from "../../packages/mocks/src/data.ts";

describe("GET /api/lifecycle", () => {
  test("round-trips for both scopes", () => {
    for (const role of ["reviewer", "senior"]) {
      expect(LifecycleResponse.safeParse(lifecycleFor(role)).success).toBe(true);
    }
  });

  test("seven stages, the export's own ids, in the export's order", () => {
    expect(lifecycleFor("senior").stages.map((s) => s.id)).toEqual([
      "unassigned", "intake", "machine", "gate", "review", "escalated", "delivered",
    ]);
  });

  test("there is no failed stage — a column that can never hold a card", () => {
    // OverviewScreen lifts every failed order into the banner, so a `failed`
    // column would render permanently empty however many orders had failed.
    expect(lifecycleFor("senior").stages.map((s) => s.id)).not.toContain("failed");
    expect(lifecycleFor("senior").failed).toBe(2);
    const failedRows = lifecycleFor("senior").stages.flatMap((s) =>
      s.orders.filter((o) => o.failed),
    );
    expect(failedRows.map((o) => o.order_ref).sort()).toEqual(["4175998-9", "4176003-4"]);
  });

  test("every stage names its sub-line and who it waits on", () => {
    for (const stage of lifecycleFor("senior").stages) {
      expect(stage.sub.length).toBeGreaterThan(0);
      expect(stage.waiting_on.length).toBeGreaterThan(0);
    }
    const intake = lifecycleFor("senior").stages.find((s) => s.id === "intake")!;
    expect(intake.label).toBe("Intake & sign-off");
    expect(intake.sub).toBe("answering the lines");
    expect(intake.waiting_on).toBe("abstractor");
    expect(intake.kind).toBe("halt");
  });

  test("the census is never smaller than the cards, and one stage exceeds them", () => {
    const stages = lifecycleFor("reviewer").stages;
    for (const stage of stages) {
      expect(stage.count).toBeGreaterThanOrEqual(stage.orders.length);
    }
    const gate = stages.find((s) => s.id === "gate")!;
    expect(gate.count).toBeGreaterThan(gate.orders.length);
  });

  test("every card carries an id to open and says whether it is yours", () => {
    const ids = new Set(demoOrders.map((r) => r.id));
    for (const stage of lifecycleFor("senior").stages) {
      for (const order of stage.orders) {
        expect(ids.has(order.id)).toBe(true);
        expect(typeof order.mine).toBe("boolean");
        expect(order.addr).not.toBe("—");
      }
    }
  });

  test("the scope note is the export's, per role", () => {
    expect(lifecycleFor("senior").scope_note).toBe(
      "You are seeing every order in the shop.",
    );
    expect(lifecycleFor("reviewer").scope_note).toBe(
      "Scoped to your orders plus anything unclaimed — the same gate as the queue. A senior sees all of them.",
    );
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-lifecycle
```

Expected: `lifecycleFor` is not exported from `packages/mocks/src/workspace.ts`.

- [ ] **Step 3: Implement**

In `packages/contract/src/intake.ts`, extend `LifecycleOrder`:

```ts
export const LifecycleOrder = z.object({
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY. `id` is the join the census never had — a card that
   * names an order and cannot open it is a dead end, and the strip's own gap
   * note records exactly that. `mine` and `state_label` are the two facts the
   * board draws that could otherwise only be guessed: whose work it is, and
   * the server's word for why it stopped.
   */
  id: z.string(),
  order_ref: z.string(),
  addr: z.string(),
  county: z.string(),
  waiting_on: z.string().nullable(),
  waited: z.string().nullable(),
  failed: z.boolean(),
  mine: z.boolean(),
  state_label: z.string().nullable(),
});
```

and `LifecycleStage`, keeping the existing `count` comment and adding:

```ts
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY. `sub` is what the stage IS ("answering the lines");
   * `waiting_on` is who it waits on ("abstractor"). The board drew a column
   * header with neither, so an empty stage said nothing at all about itself.
   */
  sub: z.string(),
  waiting_on: z.string(),
```

In `packages/mocks/src/workspace.ts`, delete the `lifecycle` constant (lines 139-165) and replace it with a projection of the shared set:

```ts
const OV_DEF: readonly { id: DemoStageId; label: string; sub: string; on: string; kind: StageKind }[] = [
  { id: "unassigned", label: "Unassigned", sub: "nobody has taken it", on: "nobody", kind: "idle" },
  { id: "intake", label: "Intake & sign-off", sub: "answering the lines", on: "abstractor", kind: "halt" },
  { id: "machine", label: "Machine run", sub: "extracting fields", on: "machine", kind: "machine" },
  { id: "gate", label: "Gates", sub: "the run has stopped", on: "a person", kind: "halt" },
  { id: "review", label: "Review", sub: "decisions open", on: "reviewer", kind: "halt" },
  { id: "escalated", label: "Escalated", sub: "sent up", on: "senior", kind: "halt" },
  { id: "delivered", label: "Delivered", sub: "signed and sent", on: "—", kind: "done" },
];

/**
 * THERE IS NO `failed` STAGE, and that is deliberate rather than an omission.
 * The overview lifts every failed order into its banner, so a `failed` column
 * could never hold a card at any point in the product's life. A failed order
 * sits in the stage it actually stopped in, flagged, and the banner takes it
 * from there.
 *
 * The census counts the whole stage; the card list is scoped to what the caller
 * may open. `gate` is served with one order the reviewer cannot open, so the
 * "+N you cannot open" render has a fixture to exist in.
 */
const UNOPENABLE_IN_GATE = 1;

function lifecycleCard(row: DemoOrderRow): LifecycleOrder {
  return {
    id: row.id,
    order_ref: row.order_ref,
    addr: row.addr,
    county: row.place,
    waiting_on: row.waiting_on,
    waited: row.waited,
    failed: row.failed,
    mine: row.mine,
    state_label: row.state_label,
  };
}

export function lifecycleFor(role: string): LifecycleResponse {
  const senior = role !== "reviewer";
  const visible = senior
    ? demoOrders
    : demoOrders.filter((r) => r.mine || r.stage === "unassigned");
  const stages = OV_DEF.map((s) => {
    const all = demoOrders.filter((r) => r.stage === s.id);
    return {
      id: s.id,
      label: s.label,
      sub: s.sub,
      waiting_on: s.on,
      kind: s.kind,
      count: all.length + (s.id === "gate" ? UNOPENABLE_IN_GATE : 0),
      orders: visible.filter((r) => r.stage === s.id).map(lifecycleCard),
    };
  });
  const haltIds = OV_DEF.filter((s) => s.kind === "halt").map((s) => s.id);
  return {
    scope_note: senior
      ? "You are seeing every order in the shop."
      : "Scoped to your orders plus anything unclaimed — the same gate as the queue. A senior sees all of them.",
    total: demoOrders.length,
    halted: demoOrders.filter((r) => haltIds.includes(r.stage)).length,
    moving: demoOrders.filter((r) => r.stage === "machine").length,
    failed: demoOrders.filter((r) => r.failed).length,
    stages,
  };
}
```

Replace the handler at line 306 with:

```ts
  http.get("/api/lifecycle", ({ request }) => {
    const raw = request.headers.get("x-mock-role");
    return HttpResponse.json(lifecycleFor(raw === null ? "admin" : raw));
  }),
```

Add `demoOrders`, `type DemoOrderRow`, `type DemoStageId` to the `./data.js` import and `type LifecycleOrder`, `type StageKind` to the contract import.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-lifecycle
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/intake.ts packages/mocks/src/workspace.ts \
        apps/web-v2/contract-lifecycle.test.ts
```

```
Draw the lifecycle board from the shared set, without a failed column

The board was a second unrelated order list, and its "Failed ingest" column
could never hold a card because the screen lifts every failed order into the
banner. Seven stages now project the shared set under the export's own ids,
each naming what it is and who it waits on, and a failed order stays in the
stage it actually stopped in. The gate census exceeds its card list on purpose,
so "+1 you cannot open" has a fixture.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 6: The product's canonical thirteen sign-off lines

**Files:**
- Modify: `packages/contract/src/intake.ts:28-51` (`OrderSignoffLine`)
- Modify: `packages/mocks/src/workspace.ts:36,45-80,241-265` (`YN`, `LINE_SPECS`, `signoffFor`)
- Modify: `apps/web-v2/src/features/questions/queries.ts:11`
- Modify: `apps/web-v2/src/features/review/FinalizeBar.stories.tsx:7-18`
- Modify: `apps/web-v2/src/features/review/NoDisclosureCards.stories.tsx:6-30`
- Test: `apps/web-v2/contract-signoff.test.ts`

**Interfaces:**

Consumes: `demoOrderRow` (Task 1).

Produces:

```ts
// packages/contract/src/intake.ts — OrderSignoffLine gains two
answers: z.array(SignoffAnswer);              // exactly what this line may be answered
policy_suggestion: SignoffAnswer.nullable();  // WHICH answer policy suggests, or null

// packages/mocks/src/workspace.ts
export function signoffFor(orderId: string): OrderSignoffResponse;
export const SIGNOFF_LINES: readonly SignoffLineSpec[];   // the canonical thirteen
export interface SignoffLineSpec {
  readonly id: string; readonly n: number; readonly label: string;
  readonly group: string; readonly answers: readonly SignoffAnswer[];
  readonly comment_on_no: "req" | "opt"; readonly machine_check: string | null;
  readonly standard_text: string | null; readonly period_scoped: boolean;
}
```

`prefilled_from_policy` stays. It says *that* policy suggested; `policy_suggestion` says *what*. Collapsing them would lose the distinction ruling Q13 turns on.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-signoff.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { OrderSignoffResponse } from "../../packages/contract/src/intake.ts";
import { SIGNOFF_LINES, signoffFor } from "../../packages/mocks/src/workspace.ts";

describe("the canonical thirteen", () => {
  test("there are thirteen, numbered 1..13, ids L01..L13", () => {
    expect(SIGNOFF_LINES).toHaveLength(13);
    expect(SIGNOFF_LINES.map((l) => l.n)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13]);
    expect(SIGNOFF_LINES[0]?.id).toBe("L01");
    expect(SIGNOFF_LINES[12]?.id).toBe("L13");
  });

  test("six lines admit N/A; the other seven are YES/NO only", () => {
    const yna = SIGNOFF_LINES.filter((l) => l.answers.includes("N/A"));
    expect(yna.map((l) => l.id)).toEqual(["L01", "L04", "L06", "L08", "L10", "L11"]);
    expect(SIGNOFF_LINES.length - yna.length).toBe(7);
    for (const line of SIGNOFF_LINES) {
      expect(line.answers.slice(0, 2)).toEqual(["YES", "NO"]);
    }
  });

  test("a comment on NO is required on ten and optional on L08, L10, L11", () => {
    const opt = SIGNOFF_LINES.filter((l) => l.comment_on_no === "opt");
    expect(opt.map((l) => l.id)).toEqual(["L08", "L10", "L11"]);
    expect(SIGNOFF_LINES.filter((l) => l.comment_on_no === "req")).toHaveLength(10);
  });

  test("the label is the product's own, not an invented paraphrase", () => {
    expect(SIGNOFF_LINES[0]?.label).toBe("Taxes and assessors pulled for all parcels");
    expect(SIGNOFF_LINES[5]?.label).toBe("Deed chain complete");
    expect(SIGNOFF_LINES[12]?.label).toBe("Name search, judgment and UCC indexes provided");
  });
});

describe("GET /api/orders/:id/signoff", () => {
  test("round-trips, and carries each line's own answer set", () => {
    const parsed = OrderSignoffResponse.safeParse(signoffFor("ord_demo_4"));
    expect(parsed.success).toBe(true);
    const lines = parsed.success ? parsed.data.lines : [];
    expect(lines.map((l) => l.answers.length)).toEqual(
      SIGNOFF_LINES.map((l) => l.answers.length),
    );
  });

  test("the intake order opens unsigned, 0 of 13", () => {
    const signoff = signoffFor("ord_demo_4");
    expect(signoff.signed_by).toBeNull();
    expect(signoff.signed_at).toBeNull();
    expect(signoff.lines.filter((l) => l.answer !== null)).toHaveLength(0);
    expect(signoff.product_name).toBe("40-Year Search");
    expect(signoff.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
  });

  test("the live order is signed, thirteen answered, with L11 the one NO", () => {
    const signoff = signoffFor("ord_demo_1");
    expect(signoff.signed_by).not.toBeNull();
    expect(signoff.signed_at).not.toBeNull();
    expect(signoff.lines.filter((l) => l.answer === null)).toHaveLength(0);
    const no = signoff.lines.filter((l) => l.answer === "NO");
    expect(no.map((l) => l.line_id)).toEqual(["L11"]);
    expect(no[0]?.comment).not.toBeNull();
  });

  test("policy names the answer it suggests, and only where it suggested one", () => {
    for (const line of signoffFor("ord_demo_4").lines) {
      if (line.prefilled_from_policy) expect(line.policy_suggestion).not.toBeNull();
      else expect(line.policy_suggestion).toBeNull();
    }
    const suggested = signoffFor("ord_demo_4").lines.filter((l) => l.prefilled_from_policy);
    expect(suggested.map((l) => [l.line_id, l.policy_suggestion])).toEqual([
      ["L08", "N/A"],
      ["L10", "N/A"],
    ]);
  });

  test("a suggested answer is never a given answer", () => {
    for (const line of signoffFor("ord_demo_4").lines) {
      if (line.policy_suggestion !== null) expect(line.answer).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-signoff
```

Expected: `SIGNOFF_LINES` and `signoffFor` are not exported from `packages/mocks/src/workspace.ts`.

- [ ] **Step 3: Implement**

In `packages/contract/src/intake.ts`, add to `OrderSignoffLine` after `comment_required`:

```ts
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY.
   *
   * `answers` is what THIS line may be answered: six of the product's thirteen
   * admit N/A and seven do not, and a screen that offered all three everywhere
   * would be inviting an answer the sign-off cannot record.
   *
   * `policy_suggestion` names WHICH answer policy proposed. It was a bare
   * boolean, so the screen knew a suggestion existed and genuinely could not
   * say what it was. It is kept separate from `answer` — ruling Q13 turns on
   * exactly that: policy may suggest, but the line is not SIGNED until a person
   * answers it, and a suggestion written into `answer` erases the difference.
   */
  answers: z.array(SignoffAnswer),
  policy_suggestion: SignoffAnswer.nullable(),
```

In `packages/mocks/src/workspace.ts`, delete `const YN = ["YES", "NO", "N/A"];` and `LINE_SPECS` (lines 36, 45-59) and replace with the product's own thirteen, transcribed from the export:

```ts
export interface SignoffLineSpec {
  readonly id: string;
  readonly n: number;
  readonly label: string;
  readonly group: string;
  readonly answers: readonly SignoffAnswer[];
  readonly comment_on_no: "req" | "opt";
  readonly machine_check: string | null;
  readonly standard_text: string | null;
  readonly period_scoped: boolean;
}

const YN: readonly SignoffAnswer[] = ["YES", "NO"];
const YNA: readonly SignoffAnswer[] = ["YES", "NO", "N/A"];

/**
 * THE PRODUCT'S THIRTEEN, transcribed from the 2026-07-28 export rather than
 * paraphrased. They were thirteen invented lines until 2026-07-30, which made
 * the questions screen, the products grid and the rulebook each describe a
 * different sign-off. One list, three screens.
 *
 * `answers` and `comment_on_no` are per line and not uniform: N/A is legal on
 * six of them, and a NO needs its comment on ten. Flattening either — as the
 * previous fixture flattened `comment_on_no` to true on all thirteen — turns a
 * product rule into a screen-wide habit.
 */
export const SIGNOFF_LINES: readonly SignoffLineSpec[] = [
  { id: "L01", n: 1, label: "Taxes and assessors pulled for all parcels", group: "Taxes", answers: YNA, comment_on_no: "req", machine_check: "Treasurer parcel record segmented", standard_text: null, period_scoped: false },
  { id: "L02", n: 2, label: "Name search and GI run for all names", group: "Name search", answers: YN, comment_on_no: "req", machine_check: "Name/GI index result segmented", standard_text: null, period_scoped: true },
  { id: "L03", n: 3, label: "Vesting deed names match per customer", group: "Vesting", answers: YN, comment_on_no: "req", machine_check: "Grantee vs order name compare", standard_text: null, period_scoped: false },
  { id: "L04", n: 4, label: "Full Value Deed found", group: "Vesting", answers: YNA, comment_on_no: "req", machine_check: "FVD instrument segmented", standard_text: null, period_scoped: false },
  { id: "L05", n: 5, label: "FVD covers PIQ; legal description page included", group: "Vesting", answers: YN, comment_on_no: "req", machine_check: null, standard_text: null, period_scoped: false },
  { id: "L06", n: 6, label: "Deed chain complete", group: "Vesting", answers: YNA, comment_on_no: "req", machine_check: "Chain depth vs required span", standard_text: null, period_scoped: true },
  { id: "L07", n: 7, label: "All open mortgages and related documents considered", group: "Mortgages", answers: YN, comment_on_no: "req", machine_check: "Deed-of-trust instruments segmented", standard_text: null, period_scoped: false },
  { id: "L08", n: 8, label: "Mortgage covering additional property: assessor + taxes", group: "Mortgages", answers: YNA, comment_on_no: "opt", machine_check: "Additional-property parcel + tax record segmented", standard_text: null, period_scoped: false },
  { id: "L09", n: 9, label: "All liens and UCC per standard criteria", group: "Name search", answers: YN, comment_on_no: "req", machine_check: "Lien/UCC index result segmented", standard_text: null, period_scoped: true },
  { id: "L10", n: 10, label: "More than 10 judgments: first 10 listed, standard comment", group: "Name search", answers: YNA, comment_on_no: "opt", machine_check: null, standard_text: "“Additional judgments of record; first ten listed. Remaining matters available on request.”", period_scoped: false },
  { id: "L11", n: 11, label: "Plat map, or tax/GIS map, included", group: "Legal", answers: YNA, comment_on_no: "opt", machine_check: "Plat/GIS image segmented", standard_text: null, period_scoped: false },
  { id: "L12", n: 12, label: "Merging sequence followed", group: "Merging", answers: YN, comment_on_no: "req", machine_check: null, standard_text: "Stacking order: Vesting → Open DOTs → Liens/Judgments → Taxes → Legal/Plat.", period_scoped: false },
  { id: "L13", n: 13, label: "Name search, judgment and UCC indexes provided", group: "Name search", answers: YN, comment_on_no: "req", machine_check: "Index images attached", standard_text: null, period_scoped: false },
];
```

Rewrite the `lines` derivation (`workspace.ts:61-80`) to map `SIGNOFF_LINES` instead of `LINE_SPECS`, keeping the existing `cells` / `scope` logic but keying it on `spec.n`, and setting `answers: [...spec.answers]`, `comment_on_no: spec.comment_on_no === "req"`, `machine_check: spec.machine_check`, `standard_text: spec.standard_text`, `period_scoped: spec.period_scoped`.

Replace `signoffFor` (lines 241-265) and its `NO_LINE` / `NO_COMMENT` preamble:

```ts
/**
 * The live order is SIGNED and the intake order is not, because they are at
 * different stages and one endpoint cannot honestly say both. Line 11's NO
 * carries the disclosure the review screen's abstractor-said-NO cards read; it
 * lives on the signed order, which is the only order that could have produced
 * one. The intake order opens as the export does — unsigned, 0 of 13.
 */
const NO_COMMENT =
  "No plat or survey was in the package — only prior deed exhibits could be checked for easement language.";
const POLICY_SUGGESTIONS: Record<string, SignoffAnswer> = { L08: "N/A", L10: "N/A" };

export function signoffFor(orderId: string): OrderSignoffResponse {
  const row = demoOrderRow(orderId);
  const signed = row?.stage !== undefined && row.stage !== "unassigned" && row.stage !== "intake";
  return {
    order_id: orderId,
    signed_by: signed ? "R. Delacroix" : null,
    signed_at: signed ? "2026-07-24T13:52:00Z" : null,
    product_name: row?.product ?? PRODUCT_NAME,
    period_label: row?.period ?? PERIOD_LABEL,
    lines: SIGNOFF_LINES.map((spec) => {
      const suggestion = POLICY_SUGGESTIONS[spec.id] ?? null;
      const answer: SignoffAnswer | null = !signed
        ? null
        : spec.id === "L11"
          ? "NO"
          : (suggestion ?? "YES");
      return {
        line_id: spec.id,
        n: spec.n,
        label: spec.label,
        group: spec.group,
        answers: [...spec.answers],
        answer,
        comment: answer === "NO" ? NO_COMMENT : null,
        comment_required: spec.comment_on_no === "req",
        machine_check: spec.machine_check,
        period_scoped: spec.period_scoped,
        prefilled_from_policy: !signed && suggestion !== null,
        policy_suggestion: signed ? null : suggestion,
      };
    }),
  };
}
```

Import `demoOrderRow`, `PRODUCT_NAME`, `PERIOD_LABEL` from `./data.js` and `type SignoffAnswer` from the contract.

In `apps/web-v2/src/features/questions/queries.ts:11`, change the constant and extend its note:

```ts
/**
 * … (keep the existing CONTRACT GAP note about the missing order-scoped route)
 *
 * The intake-stage order, not the live one: `/questions` is where a sign-off is
 * ANSWERED, and the live order's has been signed. Pointing both screens at one
 * order forced the fixture to be signed and unsigned at once.
 */
export const SIGNOFF_ORDER_ID = "ord_demo_4";
```

In `apps/web-v2/src/features/review/FinalizeBar.stories.tsx` and `NoDisclosureCards.stories.tsx`, add `answers: ["YES", "NO", "N/A"],` and `policy_suggestion: null,` to each `OrderSignoffLine` literal (one in `FinalizeBar.stories.tsx`, two in `NoDisclosureCards.stories.tsx`).

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-signoff
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/intake.ts packages/mocks/src/workspace.ts \
        apps/web-v2/src/features/questions/queries.ts \
        apps/web-v2/src/features/review/FinalizeBar.stories.tsx \
        apps/web-v2/src/features/review/NoDisclosureCards.stories.tsx \
        apps/web-v2/contract-signoff.test.ts
```

```
Serve the product's own thirteen sign-off lines

Thirteen invented lines meant the questions screen, the products grid and the
rulebook each described a different sign-off. The product's list is
transcribed instead, with per-line answer sets — six admit N/A, seven do not —
and comment-on-NO required on ten rather than flattened to true on all
thirteen. policy_suggestion names the answer policy proposed, which a boolean
could not, and stays separate from answer so a suggestion is never a signature.
The questions screen reads the intake-stage order, so it opens unsigned as the
export does.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 7: The eight pipeline stages, 64 pages, and the done-stage rule

**Files:**
- Modify: `packages/mocks/src/workspace.ts:267-285` (`pipelineFor`)
- Test: `apps/web-v2/fixtures-pipeline.test.ts`

**Interfaces:**

Consumes: `demoOrderRow`, `PACKAGE_PAGES`, `PACKAGE_PAGES_RELEVANT` (Task 1); `signoffFor` (Task 6).

Produces:

```ts
// packages/mocks/src/workspace.ts
export function pipelineFor(orderId: string): OrderPipelineResponse;
/** The stage that carries an open/signed badge beside its phase. */
export const BADGED_STAGE_ID = "signoff";
```

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/fixtures-pipeline.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { OrderPipelineResponse } from "../../packages/contract/src/intake.ts";
import { BADGED_STAGE_ID, pipelineFor, signoffFor } from "../../packages/mocks/src/workspace.ts";
import { PACKAGE_PAGES, demoOrders } from "../../packages/mocks/src/data.ts";

describe("GET /api/orders/:id/pipeline", () => {
  test("round-trips for every order in the shared set", () => {
    for (const row of demoOrders) {
      expect(OrderPipelineResponse.safeParse(pipelineFor(row.id)).success).toBe(true);
    }
  });

  test("the export's eight stages plus the sign-off row the badge rule is about", () => {
    const ids = pipelineFor("ord_demo_1").stages.map((s) => s.id);
    expect(ids).toEqual([
      "ingest", "classify", "signoff", "gate", "extract", "assemble", "validate", "qc", "finalize",
    ]);
    const byId = new Map(pipelineFor("ord_demo_1").stages.map((s) => [s.id, s]));
    expect(byId.get("validate")?.label).toBe("Validate & flag");
    expect(byId.get("validate")?.owner).toBe("LLM agent");
    expect(byId.get("finalize")?.label).toBe("Finalize & deliver");
    expect(byId.get("finalize")?.owner).toBe("Automated");
  });

  test("the gate rows name what they check", () => {
    const byId = new Map(pipelineFor("ord_demo_1").stages.map((s) => [s.id, s]));
    expect(byId.get("gate")?.label).toBe(
      "Completeness gate — checks the package against your sign-off",
    );
    expect(byId.get("qc")?.label).toBe("Human QC gate — the run stops here for you");
  });

  test("the package is 64 pages and every string quotes it", () => {
    const pipeline = pipelineFor("ord_demo_1");
    expect(pipeline.total_pages).toBe(PACKAGE_PAGES);
    expect(pipeline.stages[0]?.detail).toContain(`${PACKAGE_PAGES} pages`);
    expect(pipeline.classifier_note).toContain(String(pipeline.pages_relevant));
    expect(JSON.stringify(pipeline)).not.toContain("38");
  });

  test("a waiting stage says why it has not run", () => {
    const byId = new Map(pipelineFor("ord_demo_1").stages.map((s) => [s.id, s]));
    expect(byId.get("extract")?.detail).toBe(
      "Held — an incomplete package never reaches extraction.",
    );
    expect(byId.get("qc")?.detail).toBe("Waits until the completeness gate passes.");
  });
});

describe("a done stage never carries an open badge", () => {
  // RULED 2026-07-30. The fixture said phase:"done" beside signed_by:null and
  // the row rendered "✓ Questions … open" — two server-cited facts saying
  // opposite things, with nothing to tell a reader which governed.
  test("holds for every order in the shared set", () => {
    for (const row of demoOrders) {
      const stage = pipelineFor(row.id).stages.find((s) => s.id === BADGED_STAGE_ID);
      const signed = signoffFor(row.id).signed_by !== null;
      if (stage === undefined) continue;
      if (stage.phase === "done") expect(signed).toBe(true);
      if (!signed) expect(stage.phase).not.toBe("done");
    }
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates fixtures-pipeline
```

Expected: `pipelineFor` and `BADGED_STAGE_ID` are not exported; the current fixture has eight stages under different ids, `total_pages: 38`, and `stages[signoff].phase: "done"` beside `signed_by: null`.

- [ ] **Step 3: Implement**

Replace `pipelineFor` in `packages/mocks/src/workspace.ts`:

```ts
/**
 * The stage whose row carries a badge beyond its phase. Named rather than
 * assumed, because the rule below is about THIS pairing and a future badged
 * stage must opt in to it rather than inherit it silently.
 */
export const BADGED_STAGE_ID = "signoff";

/**
 * A DONE STAGE MAY NEVER CARRY AN OPEN BADGE (ruled 2026-07-30).
 *
 * The sign-off row draws its checkmark from `phase` and its open/signed badge
 * from `signed_by`. Both halves are correctly server-cited, so a fixture that
 * sets one and not the other renders "✓ Questions … open" and gives the reader
 * no way to know which governs. The two are derived from ONE fact here —
 * whether the order's stage is past intake — and `fixtures-pipeline.test.ts`
 * fails if they ever part company again.
 *
 * The eight stages are the export's own. "Validate & flag" and
 * "Finalize & deliver" were missing entirely, so nothing on the processing
 * screen represented either validation or delivery.
 */
export function pipelineFor(orderId: string): OrderPipelineResponse {
  const row = demoOrderRow(orderId);
  const pages = row?.pages ?? PACKAGE_PAGES;
  const signed = signoffFor(orderId).signed_by !== null;
  const gatePassed = row?.stage === "review" || row?.stage === "delivered";
  const held: StagePhase = gatePassed ? "done" : "waiting";
  return {
    order_id: orderId,
    total_pages: pages,
    pages_relevant: PACKAGE_PAGES_RELEVANT,
    classifier_note: `The classifier found nothing the report needs on the other pages. You review ${PACKAGE_PAGES_RELEVANT}.`,
    gate_halted: !gatePassed,
    stages: [
      { id: "ingest", label: "Ingest & pre-process", detail: `Deskew, de-speckle, OCR · ${pages} pages`, owner: "Automated", phase: "done" },
      { id: "classify", label: "Classify & segment", detail: `Two independent readers · ${PACKAGE_PAGES_RELEVANT} pages carried forward`, owner: "LLM agent", phase: "done" },
      { id: BADGED_STAGE_ID, label: "Abstractor sign-off", detail: signed ? "Thirteen lines answered and signed." : "Waiting on you. The lines have not been answered.", owner: "You", phase: signed ? "done" : "halted" },
      { id: "gate", label: "Completeness gate — checks the package against your sign-off", detail: gatePassed ? "Passed — the package supports every claim." : "Halted — the package contradicts your intake claims.", owner: "Automated", phase: gatePassed ? "done" : "halted" },
      { id: "extract", label: "Extract fields", detail: gatePassed ? "Values pulled with page-line provenance." : "Held — an incomplete package never reaches extraction.", owner: "LLM agent", phase: held },
      { id: "assemble", label: "Assemble draft", detail: "Mapped into the Call Back Sheet sections.", owner: "Automated", phase: held },
      { id: "validate", label: "Validate & flag", detail: "Reader agreement checked · disagreements flagged.", owner: "LLM agent", phase: held },
      { id: "qc", label: "Human QC gate — the run stops here for you", detail: gatePassed ? "Waiting on you. Nothing is delivered until you approve every flag." : "Waits until the completeness gate passes.", owner: "You", phase: gatePassed ? "halted" : "waiting" },
      { id: "finalize", label: "Finalize & deliver", detail: "Render Word deliverable, embed citation images.", owner: "Automated", phase: row?.stage === "delivered" ? "done" : "waiting" },
    ],
  };
}
```

Nine rows: the export's eight machine stages, plus the sign-off row between
`classify` and `gate` — the export draws the sign-off elsewhere but the app's
processing screen draws it here, and it is the row the badge rule is about.
The array literal is typed by the return annotation; no cast is needed.

Import `PACKAGE_PAGES`, `PACKAGE_PAGES_RELEVANT`, `demoOrderRow` from `./data.js` and `type StagePhase` from the contract.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates fixtures-pipeline
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/mocks/src/workspace.ts apps/web-v2/fixtures-pipeline.test.ts
```

```
Restore validation and delivery to the pipeline, and stop a done stage reading open

Nothing on the processing screen represented validation or delivery, because
neither stage existed in the fixture. The export's stages are restored, the
gate rows name what they check, and every waiting row says why it has not run.
The package is 64 pages everywhere rather than 38 in one place, and the
sign-off row's checkmark and its badge are now derived from one fact — with a
test that fails if a done stage ever carries an open badge again.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 8: The completeness gate — structured close options and citing evidence

**Files:**
- Modify: `packages/contract/src/intake.ts:86-114` (`CompletenessGap`)
- Modify: `packages/mocks/src/workspace.ts:287-299` (`completenessFor`)
- Modify: `apps/web-v2/src/features/completeness/GapCloseOptions.tsx:32-70`
- Modify: `apps/web-v2/src/features/completeness/GapOptionButton.tsx:10-14` (delete the false gap note)
- Modify: `apps/web-v2/src/features/completeness/CompletenessScreen.tsx:33-38` (same)
- Test: `apps/web-v2/contract-completeness.test.ts`

**Interfaces:**

Consumes: `demoOrderRow`, `PACKAGE_PAGES` (Task 1); `SIGNOFF_LINES` (Task 6).

Produces:

```ts
// packages/contract/src/intake.ts
export const GapCloseKind = z.enum(["upload", "amend", "root_of_title", "change_product"]);
export type GapCloseKind = z.infer<typeof GapCloseKind>;

export const GapCloseOption = z.object({
  kind: GapCloseKind,
  label: z.string(),
  consequence: z.string(),
  requires_comment: z.boolean(),
  min_role: z.string().nullable(),
});
export type GapCloseOption = z.infer<typeof GapCloseOption>;

// CompletenessGap
line_number: z.number().int();
close_options: z.array(GapCloseOption);   // was z.array(z.string())

// packages/mocks/src/workspace.ts
export function completenessFor(orderId: string): OrderCompletenessResponse;
```

`GapCloseOptions`'s props become `{ options: readonly GapCloseOption[]; onClose: (option: string, note: string) => void }` — the callback signature is unchanged, so `GapCard`, `GapClosureForm` and `useGateState` need no edit.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-completeness.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { OrderCompletenessResponse } from "../../packages/contract/src/intake.ts";
import { completenessFor } from "../../packages/mocks/src/workspace.ts";
import { PACKAGE_PAGES } from "../../packages/mocks/src/data.ts";

describe("GET /api/orders/:id/completeness", () => {
  const gate = completenessFor("ord_demo_1");

  test("round-trips", () => {
    expect(OrderCompletenessResponse.safeParse(gate).success).toBe(true);
  });

  test("names the ordered product and its dated span", () => {
    expect(gate.product_name).toBe("40-Year Search");
    expect(gate.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
  });

  test("every gap carries the sign-off line it was raised against", () => {
    expect(gate.gaps.map((g) => g.line_number)).toEqual([11, 7, 6]);
    for (const g of gate.gaps) {
      expect(g.line_number).toBeGreaterThan(0);
      expect(g.line_number).toBeLessThanOrEqual(13);
    }
  });

  test("evidence cites the package, quoting the page count", () => {
    const disagreement = gate.gaps.find((g) => g.kind === "disagreement")!;
    expect(disagreement.evidence).toContain(`none found in the ${PACKAGE_PAGES} pages`);
    const period = gate.gaps.find((g) => g.kind === "period_short")!;
    expect(period.evidence).toBe(
      "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
    );
  });

  test("close options are structured, not opaque strings", () => {
    for (const gap of gate.gaps) {
      for (const option of gap.close_options) {
        expect(typeof option.label).toBe("string");
        expect(option.consequence.length).toBeGreaterThan(0);
        expect(typeof option.requires_comment).toBe("boolean");
      }
    }
  });

  test("the period gap offers three ways out, so the three-across row is drawn", () => {
    const period = gate.gaps.find((g) => g.kind === "period_short")!;
    expect(period.close_options.map((o) => o.kind)).toEqual([
      "upload", "root_of_title", "change_product",
    ]);
    const root = period.close_options[1]!;
    expect(root.requires_comment).toBe(true);
    expect(root.min_role).toBeNull();
    const product = period.close_options[2]!;
    expect(product.requires_comment).toBe(true);
    expect(product.min_role).toBe("senior");
  });

  test("a non-period gap may be amended and offers two ways out", () => {
    for (const gap of gate.gaps.filter((g) => g.kind !== "period_short")) {
      expect(gap.close_options.map((o) => o.kind)).toEqual(["upload", "amend"]);
    }
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-completeness
```

Expected: `completenessFor` is not exported, and `close_options` parse as `string[]` so `option.label` is `undefined`.

- [ ] **Step 3: Implement**

In `packages/contract/src/intake.ts`, before `CompletenessGap`:

```ts
/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * A READ SHAPE ONLY: the server still decides which options it offers and no
 * write exists for any of them.
 *
 * They were opaque strings, so the screen could not tell an option that ADDS
 * evidence from one that REWRITES A SIGNED ASSERTION or one that MOVES MONEY —
 * and it compensated by demanding a reason for all of them and ranking none.
 * `requires_comment` and `min_role` are the two facts that ranking needs;
 * guessing either from the copy would have put a second, drifting rulebook in
 * the browser.
 */
export const GapCloseKind = z.enum(["upload", "amend", "root_of_title", "change_product"]);
export type GapCloseKind = z.infer<typeof GapCloseKind>;

export const GapCloseOption = z.object({
  kind: GapCloseKind,
  label: z.string(),
  /** What choosing it does to the record, stated at the moment of choosing. */
  consequence: z.string(),
  requires_comment: z.boolean(),
  /** Null = anyone who can see the gate. Otherwise the role the server requires. */
  min_role: z.string().nullable(),
});
export type GapCloseOption = z.infer<typeof GapCloseOption>;
```

In `CompletenessGap`, add after `line_label` and replace `close_options`:

```ts
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * The sign-off line this gap was raised against. The card's own heading is
   * "Sign-off line N · label" and N was not on the wire, so the screen printed
   * the label alone and the reader could not go back to the line.
   */
  line_number: z.number().int(),
  ...
  close_options: z.array(GapCloseOption),
```

Replace `completenessFor` in `packages/mocks/src/workspace.ts`:

```ts
const UPLOAD_OPTION: GapCloseOption = {
  kind: "upload",
  label: "＋ Upload the missing document",
  consequence: "Adds it to the package — it does not replace anything.",
  requires_comment: false,
  min_role: null,
};

/**
 * The gate reads the SAME sign-off lines the abstractor answered, which is why
 * every gap can name its line number and quote the machine check that
 * disagreed. Only the period gap gets a third and fourth way out: root of
 * title is a fresh claim and a product change moves money, and neither is
 * available where an answer can simply be amended.
 */
export function completenessFor(orderId: string): OrderCompletenessResponse {
  const row = demoOrderRow(orderId);
  const pages = row?.pages ?? PACKAGE_PAGES;
  const line = (id: string) => SIGNOFF_LINES.find((l) => l.id === id)!;
  return {
    order_id: orderId,
    gate_open: true,
    product_name: row?.product ?? PRODUCT_NAME,
    period_label: row?.period ?? PERIOD_LABEL,
    gaps: [
      {
        id: "g1",
        kind: "na_provisional",
        line_number: line("L11").n,
        line_label: line("L11").label,
        claim: "You answered N/A to sign-off line 11.",
        evidence:
          "The package shows a plat page the classifier recognised — the precondition applies, so the line should have been answered.",
        close_options: [
          UPLOAD_OPTION,
          {
            kind: "amend",
            label: "Change answer: N/A → answer it",
            consequence: "The precondition applies — re-answer the line. This is recorded.",
            requires_comment: false,
            min_role: null,
          },
        ],
        closed_by: null,
        closed_note: null,
      },
      {
        id: "g2",
        kind: "disagreement",
        line_number: line("L07").n,
        line_label: line("L07").label,
        claim: "You answered YES to sign-off line 7.",
        evidence: `The machine checked the package for the same line and disagrees: ${line("L07").machine_check ?? "no supporting signal"} — none found in the ${pages} pages.`,
        close_options: [
          UPLOAD_OPTION,
          {
            kind: "amend",
            label: "Amend claim: YES → NO",
            consequence: "Changes a signed assertion. This will be recorded.",
            requires_comment: false,
            min_role: null,
          },
        ],
        closed_by: null,
        closed_note: null,
      },
      {
        id: "g3",
        kind: "period_short",
        line_number: line("L06").n,
        line_label: line("L06").label,
        claim: `This order is a ${row?.product ?? PRODUCT_NAME} — line 6 requires the search abstracted back to 07/18/1986.`,
        evidence:
          "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
        close_options: [
          UPLOAD_OPTION,
          {
            kind: "root_of_title",
            label: "⊢ Root of title reached",
            consequence:
              "Asserts the search is complete and nothing older exists. A claim — needs a comment.",
            requires_comment: true,
            min_role: null,
          },
          {
            kind: "change_product",
            label: "Change the product ordered",
            consequence:
              "The client paid for this product. Senior/ops only, with a reason — recorded.",
            requires_comment: true,
            min_role: "senior",
          },
        ],
        closed_by: null,
        closed_note: null,
      },
    ],
  };
}
```

In `apps/web-v2/src/features/completeness/GapCloseOptions.tsx`, delete the `CONSEQUENCE` constant and its paragraph of the doc comment (the wire now says what each option costs), retype the prop and render the server's words:

```tsx
export function GapCloseOptions({
  options,
  onClose,
}: {
  options: readonly GapCloseOption[];
  onClose: (option: string, note: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  ...
        {options.map((option) => (
          <GapOptionButton
            key={option.kind}
            tone={option.label === chosen ? "action" : option.requires_comment ? "settled" : "neutral"}
            title={option.label}
            sub={option.consequence}
            onClick={() => setChosen(option.label)}
          />
        ))}
```

Import `type GapCloseOption` from `@titlepipe/contract`. Replace the doc comment's second paragraph with:

```
 * THE SECOND LINE IS THE SERVER'S. Each option arrives with what it does to
 * the record, so the screen states the consequence rather than applying one
 * sentence to every option because it could not tell them apart. `settled`
 * marks the options that require a comment — the ones that add a claim rather
 * than add evidence.
```

Delete the now-false `CONTRACT GAP` paragraphs at `GapOptionButton.tsx:10-14` and `CompletenessScreen.tsx:33-38`, replacing each with one line recording that the wire carries the kind and the role since 2026-07-30.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-completeness
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add packages/contract/src/intake.ts packages/mocks/src/workspace.ts \
        apps/web-v2/src/features/completeness/GapCloseOptions.tsx \
        apps/web-v2/src/features/completeness/GapOptionButton.tsx \
        apps/web-v2/src/features/completeness/CompletenessScreen.tsx \
        apps/web-v2/contract-completeness.test.ts
```

```
Give a completeness gap its line number and typed ways out

close_options were opaque strings, so the screen could not tell adding a
document from rewriting a signed assertion from moving money, and demanded a
reason for all three rather than rank any. Each option now arrives with its
kind, its consequence, whether it needs a comment and the role it needs. Gaps
carry the sign-off line number their heading claims to print, the evidence
cites the package and quotes its page count, and the period gap offers the
third way out the export draws three-across.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 9: `Field.asking` and `Field.why`, and the wave close

**Files:**
- Modify: `packages/contract/src/entities.ts:68-103` (`Field`)
- Modify: `packages/mocks/src/data.ts` (the six `needs_review` fields)
- Modify: `docs/frontend/conflicts.md` (append this wave's departures)
- Test: `apps/web-v2/contract-field-question.test.ts`

**Interfaces:**

Consumes: `demoFields` (existing).

Produces:

```ts
// packages/contract/src/entities.ts — Field gains two, both optional-nullable
asking: z.string().nullable().optional();
why: z.string().nullable().optional();
```

Optional-and-nullable follows `excluded_reason`'s precedent in the same schema: the field is absent on rows that never went to review, and `null` on a row that did and has no authored question yet. Under `exactOptionalPropertyTypes` a reader gets `string | null | undefined` and must handle all three.

- [ ] **Step 1: Write the failing test**

Create `apps/web-v2/contract-field-question.test.ts`:

```tsx
import { describe, expect, test } from "vitest";
import { Field } from "../../packages/contract/src/entities.ts";
import { demoFields } from "../../packages/mocks/src/data.ts";

describe("a decision states its question and its reason", () => {
  test("every demo field still parses", () => {
    for (const field of demoFields) {
      expect(Field.safeParse(field).success).toBe(true);
    }
  });

  test("every queued decision carries both", () => {
    const queued = demoFields.filter((f) => f.state === "needs_review");
    expect(queued.length).toBeGreaterThan(0);
    for (const field of queued) {
      expect(typeof field.asking).toBe("string");
      expect(typeof field.why).toBe("string");
      expect((field.asking ?? "").length).toBeGreaterThan(0);
      expect((field.why ?? "").length).toBeGreaterThan(0);
    }
  });

  test("a settled field carries neither — the question is not a label", () => {
    for (const field of demoFields.filter((f) => f.state === "confirmed")) {
      expect(field.asking ?? null).toBeNull();
      expect(field.why ?? null).toBeNull();
    }
  });

  test("the question is a question and the reason is not a restatement of it", () => {
    for (const field of demoFields.filter((f) => f.state === "needs_review")) {
      expect(field.asking).not.toBe(field.why);
    }
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
cd apps/web-v2 && npx vitest run --project gates contract-field-question
```

Expected: `Property 'asking' does not exist on type` at typecheck, and at runtime every `typeof field.asking` is `"undefined"`.

- [ ] **Step 3: Implement**

In `packages/contract/src/entities.ts`, add to `Field` after `excluded_reason`:

```ts
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY, and the only two on this schema written for a person
   * rather than for a machine.
   *
   * `asking` is the QUESTION the decision card leads with — "Is the vested
   * owner MARIA L. ESTRADA or MARIA I. ESTRADA?". `why` is why it is being
   * asked — "Two independent readers disagreed on the middle initial". The
   * review screen showed a field path and two values and left the reviewer to
   * reconstruct both, which is the work the pipeline is supposed to have
   * already done.
   *
   * SERVER-AUTHORED. Composing either in the browser would be the UI narrating
   * why the pipeline routed something, which is a claim only the router can
   * make. Absent on a field that never went to review; null on one that did and
   * has no authored question yet — those are different statements.
   */
  asking: z.string().nullable().optional(),
  why: z.string().nullable().optional(),
```

In `packages/mocks/src/data.ts`, add `asking` and `why` to each of the six `needs_review` fields, in the export's register:

| field | `asking` | `why` |
|---|---|---|
| `fld_zip` | `"Confirm the ZIP on the tax card."` | `"Both readers returned the same digits, but the region's OCR confidence is below the routing threshold."` |
| `fld_m1lender` | `"Is the lender SOUTHSTONE MORTGAGE LLC?"` | `"Two independent readers disagreed — one returned zeroes where the other returned the letter O."` |
| `fld_m1amt` | `"Confirm the original principal amount of the security deed."` | `"The numerals print over a fax artefact; the readers split on one digit, and the words line above is legible."` |
| `fld_j1atty` | `"Is Q. T. FENWICK & ASSOC., P.C. the plaintiff's attorney of record?"` | `"One reader found the line and the other returned nothing — a blank is never filled in from the reader that did."` |
| `fld_j1case` | `"Read the case number — or escalate if the frame cannot support one."` | `"The microfilm frame is degraded in this region; the number is on the page and neither reader could resolve it."` |
| `fld_deeddated` | `"Confirm the deed states no execution date."` | `"The instrument was returned and the execution date is left blank on its face."` |

Leave every other field without the properties — under `exactOptionalPropertyTypes` an absent optional is not the same claim as `null`, and absence is correct for a field that never went to review.

- [ ] **Step 4: Run — Expected: PASS**

```
cd apps/web-v2 && npx vitest run --project gates contract-field-question
```

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 5b: Wave close** — run the whole gate for the wave, in this order, and record the output of each:

```
pnpm --filter web-v2 test:e2e
pnpm typecheck
```

`test:e2e` builds and previews first; the only spec this wave touched is `e2e/invariants/queue.spec.ts` and only its literal refs. Root `pnpm typecheck` covers `packages/contract` and `packages/mocks`, which the web-v2 gate does not.

- [ ] **Step 5c: Record the departures.** Append to `docs/frontend/conflicts.md`, in the file's existing `### C{n} — {title}` register, continuing the numbering:

- **The demo geography is not the export's.** The export's five orders carry real-looking Arizona street addresses. The refs, the package size, the product and the period are adopted verbatim; the addresses and counties stay in this build's synthetic register (Demoville, Fairhollow, Brackendale). The scrubbing rule outweighs matching a street name nothing on any screen is measured against.
- **A twelfth order the export does not draw.** `4176041-6` sits at Intake so `/questions` can open unsigned while the live order's sign-off is signed. One order cannot be both, and the export avoided the problem by having one global demo order.
- **`/questions`, `/processing` and `/completeness` read different orders.** They are three different lifecycle positions and no single order holds all three at once. The routes are still not order-scoped; that gap note stays.

- [ ] **Step 6: Commit**

```
git add packages/contract/src/entities.ts packages/mocks/src/data.ts \
        docs/frontend/conflicts.md apps/web-v2/contract-field-question.test.ts
```

```
Let a queued field state what it is asking and why

The review screen showed a field path and two values, and left the reviewer to
reconstruct both the question and the reason it was routed — work the pipeline
has already done and only the router can honestly claim. Field gains asking
and why as server-authored read fields, present on the six queued decisions and
absent on the rest, since absence and null are different statements about a
field that never went to review. Wave 2's three departures from the export are
recorded in conflicts.md.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

# [Wave 3] — Entities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app's duplicated row/card/value renderers into one entity each, land the single six-entry flow definition, and carry out the owner's Reader A/B collapse so `features/review` composes the `entities/field` kit instead of re-implementing it.

**Architecture:** Every task in this wave is *extract, adopt, delete* — a shared presentational component in `entities/` or `shared/ui/`, wired at its named call sites in the same task, with the drifted copy removed. Entities stay presentational (§6: no router, no fetch, no state machine); every fact they draw arrives as a prop from the feature that fetched it. Nothing here changes a screen's layout — Wave 4 assembles screens; this wave only makes there be one of each thing to assemble.

**Prerequisites:** Wave 0 (`Pane`/`Screen`/`chromeFor`, the `knip` gate) and Wave 1 (the 11 primitives, `Card.accent` as a 2px inset top stripe with a `settled` case, `--stroke-accent`). Wave 2 is independent and may still be running; nothing in this wave reads a fixture.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **after Wave 0's `knip` change a component whose only consumer is a `.stories.tsx` counts as unused** — so no task may end with a new component that has no production call site, which is why every extraction task also performs its adoption and its deletion.

## File Structure

| File | Responsibility |
|---|---|
| `src/entities/nav/RailRow.tsx` | **create** — the one rail row: anchor, modified-click guard, `rail-door-*`/`rail-dot-*` testids, active marking, 44/40px geometry, attention dot, marker + badge slots |
| `src/entities/nav/RailBadge.tsx` | **create** — the rail's count/word pill, `tone` given never derived |
| `src/entities/nav/RailBadge.test.ts` | **create** — the three badge tones never collapse |
| `src/entities/nav/RailRow.stories.tsx` | **create** — the click guard and the testids, as a browser test |
| `src/entities/nav/SidebarDoor.tsx` | **modify** — becomes `RailRow` + the letter square, nothing else |
| `src/entities/nav/LifecycleRail.tsx` | **modify** — becomes the connector + `RailRow` + the numbered dot |
| `src/entities/nav/flow.ts` | **create** — the six-entry flow, its route resolution and its section label |
| `src/entities/nav/flow.test.ts` | **create** — six always, Delivered always 6, Review unresolved without an order |
| `src/entities/nav/doors.ts` | **modify** — `icon` deleted; `doorGlyph` (label initial) and `doorTitle` (label + chord) added |
| `src/entities/nav/Sidebar.stories.tsx` | **modify** — story door data follows the derived initials and carries `title` |
| `src/app/AppChrome.tsx` | **modify** — one flow definition, structural numbering, order-conditional section label, glyph + title from `doors.ts` |
| `src/entities/order/OrderRow.tsx` | **create** — the queue band row |
| `src/entities/order/OrderMiniCard.tsx` | **create** — the board's order card |
| `src/entities/order/OrderContextRow.tsx` | **create** — `Ordered · product · period · config vN frozen` |
| `src/entities/signoff/SignoffReadonly.tsx` | **create** — the signed, read-only sign-off block |
| `src/entities/signoff/SignoffLineRow.tsx` | **create** — one read-only sign-off line |
| `src/entities/document/pageCoverage.ts` | **create** — the four coverage states and their classification |
| `src/entities/document/pageCoverage.test.ts` | **create** — the four states never collapse, and survive greyscale |
| `src/entities/document/PageSpine.tsx` | **create** — one cell per package page, selectable |
| `src/entities/document/PageStrip.tsx` + `.stories.tsx` | **delete** — the second denominator |
| `src/shared/ui/ChoiceCardGrid.tsx` | **create** — selectable card grid, selected = action fill |
| `src/shared/ui/QuietState.tsx` | **create** — tinted disc + headline + explanation, *resolved and empty* |
| `src/entities/field/fieldLabel.ts` | **create (moved)** — field facts, out of `features/review` so entities may read them |
| `src/entities/field/DecisionRow.tsx` | **create** — the collapsed decision row, promoted from `features/review/FieldRow` |
| `src/entities/field/diff.ts` | **create (moved)** — per-character diff |
| `src/entities/field/ReadingPin.tsx` | **create (moved)** — the reader's line, pinned on the page |
| `src/entities/field/EngineReadings.tsx` | **modify** — becomes the attribution DISCLOSURE: the summary, the disagreement sentence, the list |
| `src/entities/field/ReadingLine.tsx` | **create** — one reader's answer: engine id, per-character diff, page, adopt |
| `src/entities/field/AsReadRow.tsx` | **create** — the export's single sunken `As read` row, with its draft and unmerged arms |
| `src/entities/field/DecisionCard.tsx` | **modify** — the export's card: header, question, flag line, `AsReadRow`, disclosure, bar |
| `src/entities/field/DecisionBar.tsx` | **modify** — the export's button copy, docked, `act-*` testids |
| `src/entities/field/SheetValue.tsx` | **create (moved)** — the sheet line, composed from `FieldValue` + `NoValue` |
| `src/features/review/decisionCardProps.ts` | **create** — `Field` → the card's props, in one place; carries the `asking`/`why` CONTRACT GAP |
| `docs/frontend/conflicts.md` | **modify** — the three departures Tasks 12–15 make deliberately |
| `src/features/review/{DecisionPanel,DecisionActions,ReadingsPanel,SourcePin,SheetValue,FieldRow,diff,fieldLabel}.tsx/.ts` | **delete** — the drifted copies |
| `src/features/{queue,overview,completeness,delivered,questions,escalations,review}/…` | **modify** — the named call sites |
| `e2e/invariants/{review,ux}.spec.ts` | **modify** — open the attribution disclosure before asserting; no assertion changes |

---

### Task 1: One rail row, before any of its six fixes

**Files:**
- Create: `apps/web-v2/src/entities/nav/RailRow.tsx`
- Create: `apps/web-v2/src/entities/nav/RailBadge.tsx`
- Modify: `apps/web-v2/src/entities/nav/SidebarDoor.tsx:1-76` (whole file)
- Modify: `apps/web-v2/src/entities/nav/LifecycleRail.tsx:1-125` (whole file)
- Test: `apps/web-v2/src/entities/nav/RailBadge.test.ts`
- Test: `apps/web-v2/src/entities/nav/RailRow.stories.tsx`

**Interfaces:**
- Consumes: `cn` from `shared/ui/classNames`.
- Produces:
  ```tsx
  export type DoorAttention = "halt" | "attend" | null;   // MOVED here from SidebarDoor.tsx
  export interface RailRowProps {
    to: string; label: string; active: boolean; collapsed: boolean;
    attention: DoorAttention;
    marker: ReactNode;
    badge?: ReactNode;
    onNavigate: (to: string) => void;
  }
  export function RailRow(props: RailRowProps): ReactElement;

  export const railBadgeClasses: (props?: { tone?: "neutral" | "attend" | "halt" }) => string;
  export interface RailBadgeProps { to: string; tone?: "neutral" | "attend" | "halt"; children: ReactNode }
  export function RailBadge(props: RailBadgeProps): ReactElement;
  ```
  `SidebarDoorProps` and `LifecycleStage` keep their exact current shapes; `LifecycleRail.tsx` imports `DoorAttention` from `./RailRow` instead of `./SidebarDoor`.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/nav/RailBadge.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { railBadgeClasses } from "./RailBadge";

/**
 * The badge exists because the export builds door badges and flow badges from
 * ONE factory with a `tone` argument. One copy exists today; the second
 * consumer must not become a second copy, and the tones must not quietly
 * collapse into one grey pill the way the no-value renders once did.
 */
describe("the rail badge keeps its three tones apart", () => {
  test("every tone produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const tone of ["neutral", "attend", "halt"] as const) {
      const classes = railBadgeClasses({ tone });
      const clash = seen.get(classes);
      expect(clash, `${tone} renders identically to ${clash}`).toBeUndefined();
      seen.set(classes, tone);
    }
    expect(seen.size).toBe(3);
  });

  test("neutral is the default — a badge never colours itself", () => {
    expect(railBadgeClasses({})).toBe(railBadgeClasses({ tone: "neutral" }));
  });

  test("the pill keeps its mono numeral and its right-hand dock", () => {
    expect(railBadgeClasses({})).toContain("font-mono");
    expect(railBadgeClasses({})).toContain("ml-auto");
  });
});
```

`apps/web-v2/src/entities/nav/RailRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { RailRow } from "./RailRow";
import { RailBadge } from "./RailBadge";

const meta = {
  title: "Nav/RailRow",
  component: RailRow,
} satisfies Meta<typeof RailRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const marker = <span aria-hidden>Q</span>;

/** The testids, the badge slot and the attention dot, on one row. */
export const Expanded: Story = {
  args: {
    to: "/queue",
    label: "queue",
    active: false,
    collapsed: false,
    attention: "attend",
    marker,
    badge: <RailBadge to="/queue">3</RailBadge>,
    onNavigate: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("rail-door-/queue");
    expect(row).toHaveAttribute("href", "/queue");
    expect(row).toHaveAttribute("data-active", "0");
    expect(await canvas.findByTestId("rail-badge-/queue")).toHaveTextContent("3");
    expect(await canvas.findByTestId("rail-dot-/queue")).toBeInTheDocument();
  },
};

/** A plain left click navigates through the callback, never through the href. */
export const PlainClickNavigates: Story = {
  args: {
    to: "/overview",
    label: "overview",
    active: false,
    collapsed: false,
    attention: null,
    marker,
    onNavigate: () => {},
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const seen: string[] = [];
    args.onNavigate = (to: string) => seen.push(to);
    await userEvent.click(await canvas.findByTestId("rail-door-/overview"));
    expect(seen).toEqual(["/overview"]);
  },
};

/** Collapsed: the marker is the only content, and the label moves to `title`. */
export const Collapsed: Story = {
  args: {
    to: "/queue",
    label: "queue",
    active: true,
    collapsed: true,
    attention: null,
    marker,
    badge: <RailBadge to="/queue">3</RailBadge>,
    onNavigate: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("rail-door-/queue");
    expect(row).toHaveAttribute("title", "queue");
    expect(row).toHaveAttribute("data-active", "1");
    expect(row).not.toHaveTextContent("3");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test
```

Expected: the `gates` project fails to resolve `./RailBadge` —
`Error: Failed to load url ./RailBadge (resolved id: …/src/entities/nav/RailBadge) … does not exist`, and the `storybook` project fails the same way on `./RailRow`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/nav/RailRow.tsx`:

```tsx
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * ONE ROW OF THE RAIL — the door row and the lifecycle stage row are one
 * component, because they were one component written twice.
 *
 * RULE: a rail row has a single renderer. FAILURE PREVENTED: HANDOFF-UI §1's
 * named defect — `SidebarDoor` and `LifecycleRail` each held ~35 byte-identical
 * lines, the same anchor, the same modified-click guard, the same
 * `rail-door-*`/`rail-dot-*` testids and the same className string, and SIX
 * separate fidelity fixes land inside that block. With two copies each fix is
 * applied twice and one of them is eventually missed.
 *
 * A LEFT CLICK NAVIGATES THROUGH THE CALLBACK; a modified or middle click is
 * left to the browser so the real `href` still opens a new tab. Dropping that
 * turns a navigator of links into a navigator of buttons.
 *
 * ATTENTION IS A DOT, NEVER A COUNT (`sidebar.spec`). Red pulses and means
 * unresolved, amber is still and means open. The split ARRIVES as a prop: this
 * row never reads a number and never decides what a number means (§3).
 *
 * PRESENTATIONAL — no router, no fetch (§6). The marker and the badge are
 * slots, which is exactly what lets one row draw two different rails without
 * knowing anything about either.
 */
export type DoorAttention = "halt" | "attend" | null;

export interface RailRowProps {
  /** Route to navigate to; also the row's stable testid suffix. */
  to: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  attention: DoorAttention;
  /** The letter square or the numbered/checked stage dot. */
  marker: ReactNode;
  badge?: ReactNode;
  onNavigate: (to: string) => void;
}

export function RailRow({
  to,
  label,
  active,
  collapsed,
  attention,
  marker,
  badge,
  onNavigate,
}: RailRowProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified/aux clicks (new tab) via the real href.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(to);
  };
  return (
    <a
      href={to}
      data-testid={`rail-door-${to}`}
      data-active={active ? "1" : "0"}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-3 text-xs font-medium no-underline",
        collapsed ? "h-22 justify-center px-0" : "h-20 px-4",
        active ? "bg-surface-raised text-ink-primary" : "text-ink-secondary",
      )}
    >
      {marker}
      {collapsed ? null : (
        <>
          <span className="truncate capitalize">{label}</span>
          {badge}
        </>
      )}
      {attention === null ? null : (
        <span
          data-testid={`rail-dot-${to}`}
          aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
          className={cn(
            "size-2 shrink-0 rounded-pill",
            collapsed ? "absolute right-2 top-2" : "ml-auto",
            attention === "halt" ? "animate-tp-pulse bg-state-halt" : "bg-state-attend",
          )}
        />
      )}
    </a>
  );
}
```

`apps/web-v2/src/entities/nav/RailBadge.tsx`:

```tsx
import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * The rail's count/word pill.
 *
 * RULE: the tone is GIVEN, never derived. FAILURE PREVENTED: a badge that
 * colours itself from its own number is a state machine living in the
 * navigator, and §3 says the server owns every state machine. The export builds
 * door badges and flow badges from one factory that TAKES a tone
 * (`sbItem(k,label,badge,tone)`), so the second consumer must not fork.
 *
 * IT CARRIES A COUNT OF WHAT IS LEFT, NEVER A RATE (§4.5). A number here is
 * "three gaps open"; anything per-hour is refused at this component.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the tone set is testable as a pure function in the node gate, the same reason Button exports buttonClasses. */
export const railBadgeClasses = cva(
  "ml-auto shrink-0 rounded-pill px-2 py-0.5 font-mono text-micro",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-secondary",
        attend: "border border-state-attend-border bg-state-attend-surface text-state-attend-ink",
        halt: "border border-state-halt-border bg-state-halt-surface text-state-halt-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface RailBadgeProps {
  /** The row's path — the badge's testid rides the same namespace as its row. */
  to: string;
  tone?: "neutral" | "attend" | "halt";
  children: ReactNode;
}

export function RailBadge({ to, tone, children }: RailBadgeProps) {
  return (
    <span data-testid={`rail-badge-${to}`} className={cn(railBadgeClasses({ tone }))}>
      {children}
    </span>
  );
}
```

`apps/web-v2/src/entities/nav/SidebarDoor.tsx` — replace the whole file:

```tsx
import { RailRow, type DoorAttention } from "./RailRow";

/**
 * A door in the left rail: a `RailRow` plus the LETTER SQUARE that marks it.
 *
 * RULE: the square shows in BOTH states — collapsed and expanded — because the
 * design never drops a door back to unlabelled chrome just because the rail
 * widened. FAILURE PREVENTED: a collapsed 78px rail whose rows are
 * indistinguishable from one another.
 *
 * Everything else about the row — the anchor, the click guard, the testids, the
 * attention dot, the geometry — belongs to `RailRow` and is deliberately NOT
 * repeated here. That repetition is what this file was (HANDOFF-UI §1).
 */
export interface SidebarDoorProps {
  /** Route to navigate to; also the door's stable testid suffix. */
  to: string;
  label: string;
  /** Single-letter icon, shown in a bordered square in every state. */
  icon: string;
  collapsed: boolean;
  active: boolean;
  attention: DoorAttention;
  onNavigate: (to: string) => void;
}

export function SidebarDoor({ to, label, icon, collapsed, active, attention, onNavigate }: SidebarDoorProps) {
  return (
    <RailRow
      to={to}
      label={label}
      collapsed={collapsed}
      active={active}
      attention={attention}
      onNavigate={onNavigate}
      marker={
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-2 border border-line-strong font-mono text-micro text-ink-secondary"
        >
          {icon}
        </span>
      }
    />
  );
}
```

`apps/web-v2/src/entities/nav/LifecycleRail.tsx` — replace the whole file:

```tsx
import { cn } from "../../shared/ui/classNames";
import { RailRow, type DoorAttention } from "./RailRow";
import { RailBadge } from "./RailBadge";

/**
 * The lifecycle "flow" rail — the order's pipeline stages as a NUMBERED
 * VERTICAL RAIL, grouped under its own header.
 *
 * READS SHAPE ONLY. `n` (position), `done` (checkmark), `active` and `badge`
 * all arrive as props. RULE: this component never derives stage state — not
 * from confidence, not from counts, not from `value === null`. FAILURE
 * PREVENTED: a rail that disagrees with the pipeline about where an order is.
 *
 * `n` IS STRUCTURAL — a fixed position in a fixed flow, drawn even with no
 * active order; `entities/nav/flow.ts` owns the sequence that makes that true.
 * `done` and `badge` are ORDER data, and `AppChrome` sets both to `false`/`null`
 * off an order screen rather than fabricate progress for an order nobody is
 * looking at.
 */
export interface LifecycleStage {
  to: string;
  label: string;
  active: boolean;
  attention: DoorAttention;
  /** Fixed position in the flow, 1-based. Always shown — not order data. */
  n: number;
  /** Checkmark. Server-cited (`PipelineStage.phase === "done"`) or `false`. */
  done: boolean;
  /** Per-stage count/word from the server, or `null` when none applies. */
  badge: string | null;
}

export interface LifecycleRailProps {
  stages: readonly LifecycleStage[];
  collapsed: boolean;
  onNavigate: (to: string) => void;
}

export function LifecycleRail({ stages, collapsed, onNavigate }: LifecycleRailProps) {
  if (stages.length === 0) return null;
  return (
    <nav aria-label="Order lifecycle" data-testid="lifecycle-rail" className="flex flex-col">
      {stages.map((stage, i) => (
        <div key={stage.to} className="flex flex-col">
          {i === 0 ? null : (
            <div className={cn("flex", collapsed ? "justify-center" : "px-4")}>
              <span aria-hidden className="flex size-6 items-center justify-center">
                <span className="h-3 w-px bg-line-strong" />
              </span>
            </div>
          )}
          <RailRow
            to={stage.to}
            label={stage.label}
            active={stage.active}
            collapsed={collapsed}
            attention={stage.attention}
            onNavigate={onNavigate}
            marker={<StageDot n={stage.n} done={stage.done} />}
            {...(stage.badge === null
              ? {}
              : { badge: <RailBadge to={stage.to}>{stage.badge}</RailBadge> })}
          />
        </div>
      ))}
    </nav>
  );
}

/**
 * The stage's mark: its number, or a checkmark once the server says done.
 * A DONE STAGE IS THE SERVER'S CLAIM, never "you already walked past this
 * screen" — progress nobody recorded is progress that is not real.
 */
function StageDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-pill border font-mono text-micro",
        done
          ? "border-state-settled-border bg-state-settled-surface text-state-settled-ink"
          : "border-line-strong text-ink-secondary",
      )}
    >
      {done ? "✓" : n}
    </span>
  );
}
```

The spread on `badge` is required by `exactOptionalPropertyTypes`: passing `badge={undefined}` is not the same as omitting it.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test
```

Expected: `RailBadge.test.ts` 3 passing, `RailRow.stories.tsx` 3 passing, and `Sidebar.stories.tsx`'s `Expanded`/`Collapsed` still passing unchanged — the rail's rendered output is byte-identical to before.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/nav/RailRow.tsx apps/web-v2/src/entities/nav/RailRow.stories.tsx apps/web-v2/src/entities/nav/RailBadge.tsx apps/web-v2/src/entities/nav/RailBadge.test.ts apps/web-v2/src/entities/nav/SidebarDoor.tsx apps/web-v2/src/entities/nav/LifecycleRail.tsx
```

```
Make the door row and the stage row one component

SidebarDoor and LifecycleRail held ~35 byte-identical lines each — the same
anchor, click guard, rail-door/rail-dot testids and className. Six fidelity
fixes land inside that block, so it becomes one RailRow before any of them are
applied, with the marker and the badge as slots. The rendered output is
unchanged; the badge gains the export's amber and red tones so its second
consumer cannot become a second copy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 2: One six-entry flow, numbered structurally

**Files:**
- Create: `apps/web-v2/src/entities/nav/flow.ts`
- Create: `apps/web-v2/src/entities/nav/flow.test.ts`
- Modify: `apps/web-v2/src/entities/nav/RailRow.tsx` (add `reachable`)
- Modify: `apps/web-v2/src/app/AppChrome.tsx:21-34` (the local FLOW) and `:102-129` (stage build + section label)

**Interfaces:**
- Consumes: `RailRowProps` and `LifecycleStage` from Task 1.
- Produces:
  ```ts
  export interface FlowStep { readonly path: string; readonly label: string; readonly orderScoped: boolean }
  export const FLOW: readonly FlowStep[];                       // exactly six, in order
  export function flowRoute(step: FlowStep, orderId: string | null): string | null;
  export function flowSectionLabel(orderId: string | null): string;
  ```
  and, added to `RailRowProps`:
  ```tsx
  /** `false` draws a fixed position with no destination — no link, no navigation. */
  reachable?: boolean;   // default true
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/nav/flow.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { FLOW, flowRoute, flowSectionLabel } from "./flow";

/**
 * The defect these pin: `AppChrome` spliced Review in only when the URL carried
 * an order, so off an order screen Delivered numbered 5 where the export
 * numbers it 6 — while `LifecycleRail`'s own comment claimed `n` was "drawn
 * even with no active order". Two files asserting opposite rules about one
 * number is worse than either rule on its own.
 */
describe("the flow is six positions, always", () => {
  test("six steps, in the export's order", () => {
    expect(FLOW.map((step) => step.label)).toEqual([
      "Upload",
      "Questions",
      "Processing",
      "Completeness",
      "Review",
      "Delivered",
    ]);
  });

  test("Delivered is position six with an order and without one", () => {
    // The position is the INDEX IN THE DEFINITION, so no filter can shift it.
    expect(FLOW.findIndex((step) => step.label === "Delivered") + 1).toBe(6);
    expect(FLOW.findIndex((step) => step.label === "Review") + 1).toBe(5);
  });

  test("only Review is order-scoped", () => {
    expect(FLOW.filter((step) => step.orderScoped).map((s) => s.label)).toEqual(["Review"]);
  });
});

describe("a step resolves to a route, or says it cannot", () => {
  const review = FLOW[4];
  const delivered = FLOW[5];

  test("the plain steps resolve with or without an order", () => {
    expect(delivered && flowRoute(delivered, null)).toBe("/delivered");
    expect(delivered && flowRoute(delivered, "ord_demo_1")).toBe("/delivered");
  });

  test("Review resolves only with an order in view", () => {
    expect(review && flowRoute(review, "ord_demo_1")).toBe("/orders/ord_demo_1/review");
    // null, never a plausible URL: a rail row that navigates somewhere it
    // invented is worse than one that says it cannot go yet.
    expect(review && flowRoute(review, null)).toBeNull();
  });
});

describe("the header never names an order there is none of", () => {
  test("with an order it is the export's own words", () => {
    expect(flowSectionLabel("ord_demo_1")).toBe("THIS ORDER");
  });

  test("without one it names the flow instead", () => {
    expect(flowSectionLabel(null)).toBe("THE FLOW");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project gates
```

Expected: `Failed to load url ./flow (resolved id: …/src/entities/nav/flow) … does not exist`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/nav/flow.ts`:

```ts
/**
 * THE FLOW IS SIX POSITIONS, ALWAYS, AND THE NUMBERING NEVER SHIFTS.
 *
 * RULE: the pipeline's shape is structural — a fixed sequence, drawn whether or
 * not an order is in view; only `done` and `badge` are order data. FAILURE
 * PREVENTED: `AppChrome` used to push Review onto the list only when the URL
 * carried an order, so off an order screen Delivered numbered 5 against the
 * export's 6 (`flowDef`, TitlePipe.dc.html:2919-2926) — and the rail's own
 * comment claimed the opposite. A position is therefore read from the INDEX IN
 * THIS LIST, never from the index of a filtered copy of it.
 *
 * ONE DEFINITION. `AppChrome` and `doors.ts` each carried their own list and
 * disagreed about the labels; the paths, the labels and the order are written
 * once, here.
 */
export interface FlowStep {
  /** Stable identity, and the resolved route for every step but Review. */
  readonly path: string;
  readonly label: string;
  /** Review's screen is order-scoped, so its route is not a constant. */
  readonly orderScoped: boolean;
}

export const FLOW: readonly FlowStep[] = [
  { path: "/ingest", label: "Upload", orderScoped: false },
  { path: "/questions", label: "Questions", orderScoped: false },
  { path: "/processing", label: "Processing", orderScoped: false },
  { path: "/completeness", label: "Completeness", orderScoped: false },
  // The unfilled ROUTE PATTERN, not a URL: it is this step's stable identity
  // (and testid suffix) while no order is in view, and it cannot be mistaken
  // for somewhere a click could go.
  { path: "/orders/:orderId/review", label: "Review", orderScoped: true },
  { path: "/delivered", label: "Delivered", orderScoped: false },
];

/**
 * The route a step opens, or `null` when it names a position with no
 * destination yet — Review before an order is in view. Returning null rather
 * than a plausible URL is the point: the row still draws, and still counts, but
 * it does not offer a journey the app cannot make.
 */
export function flowRoute(step: FlowStep, orderId: string | null): string | null {
  if (!step.orderScoped) return step.path;
  return orderId === null ? null : `/orders/${orderId}/review`;
}

/**
 * The group header over the rail.
 *
 * RULE: the header must not name an order there is none of. The export always
 * says "This order" because it carries one global demo order; this app takes
 * order identity from the URL, and printing "THIS ORDER" over six stages beside
 * a strip that declines to name one is the screen contradicting itself.
 */
export function flowSectionLabel(orderId: string | null): string {
  return orderId === null ? "THE FLOW" : "THIS ORDER";
}
```

In `apps/web-v2/src/entities/nav/RailRow.tsx`, add the prop and the non-navigating branch. Extend the interface:

```tsx
  onNavigate: (to: string) => void;
  /**
   * `false` draws a fixed POSITION rather than a link — the Review stage before
   * an order is in view. The row still counts (the numbering is structural);
   * it just does not pretend to have a destination.
   */
  reachable?: boolean;
```

and replace the `return (` block's opening with a shared body plus the two arms:

```tsx
  const rowClass = cn(
    "relative flex items-center gap-3 rounded-3 text-xs font-medium no-underline",
    collapsed ? "h-22 justify-center px-0" : "h-20 px-4",
    active ? "bg-surface-raised text-ink-primary" : "text-ink-secondary",
  );
  const body = (
    <>
      {marker}
      {collapsed ? null : (
        <>
          <span className="truncate capitalize">{label}</span>
          {badge}
        </>
      )}
      {attention === null ? null : (
        <span
          data-testid={`rail-dot-${to}`}
          aria-label={attention === "halt" ? `${label}: unresolved` : `${label}: open`}
          className={cn(
            "size-2 shrink-0 rounded-pill",
            collapsed ? "absolute right-2 top-2" : "ml-auto",
            attention === "halt" ? "animate-tp-pulse bg-state-halt" : "bg-state-attend",
          )}
        />
      )}
    </>
  );

  if (reachable === false) {
    return (
      <span
        data-testid={`rail-door-${to}`}
        data-active="0"
        aria-disabled="true"
        title={`${label} — opens once an order is in view`}
        className={cn(rowClass, "text-ink-muted")}
      >
        {body}
      </span>
    );
  }

  return (
    <a
      href={to}
      data-testid={`rail-door-${to}`}
      data-active={active ? "1" : "0"}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={rowClass}
    >
      {body}
    </a>
  );
```

In `apps/web-v2/src/app/AppChrome.tsx`, delete the `FLOW`/`DELIVERED` block at `:21-34` and import instead:

```tsx
import { FLOW, flowRoute, flowSectionLabel } from "../entities/nav/flow";
```

Replace `:102-117` (`flowItems` + `lifecycle`) with:

```tsx
  // The POSITION is the index in `FLOW`, taken before any filter, so a door a
  // role does not hold can never renumber the stages that follow it.
  const lifecycle: LifecycleStage[] = FLOW.map((step, i) => {
    const route = flowRoute(step, orderId);
    const to = route ?? step.path;
    const augment =
      orderId === null || route === null
        ? { done: false, badge: null }
        : step.orderScoped
          ? reviewAugment({ pipeline, fields })
          : stageAugmentFor(step.path, { pipeline, signoff, completeness });
    return {
      to,
      label: step.label,
      active: isActive(to),
      attention: attentionFor(to),
      n: i + 1,
      ...augment,
      ...(route === null ? { reachable: false } : {}),
    };
  }).filter((stage) => stage.reachable === false || stage.to.startsWith("/orders/") || held.has(stage.to));
```

and add `reachable?: boolean` to `LifecycleStage` in `LifecycleRail.tsx`, forwarding it:

```tsx
  /** `false` when the stage has no route yet — Review with no order in view. */
  reachable?: boolean;
```
```tsx
            {...(stage.reachable === false ? { reachable: false } : {})}
```

Replace the section push at `:129` with:

```tsx
  if (lifecycle.length > 0)
    sections.push({ kind: "lifecycle", label: flowSectionLabel(orderId), stages: lifecycle });
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project gates && pnpm --filter web-v2 test:e2e --grep "rail"
```

Expected: `flow.test.ts` 8 passing; `sidebar.spec` still green (`rail-door-/queue`, `rail-door-/ingest` absence, `rail-dot-/escalations`).

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/nav/flow.ts apps/web-v2/src/entities/nav/flow.test.ts apps/web-v2/src/entities/nav/RailRow.tsx apps/web-v2/src/entities/nav/LifecycleRail.tsx apps/web-v2/src/app/AppChrome.tsx
```

```
Draw the flow as six fixed positions, whatever the URL says

AppChrome spliced Review in only when the URL carried an order, so Delivered
numbered 5 off an order screen where the export numbers it 6 — contradicting
the rail's own comment that the position is structural. The six steps now live
in one definition, the number is the index in that definition so no filter can
shift it, and Review draws as a position with no destination until an order is
in view. The header stops saying THIS ORDER when there is no order to name.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 3: The square shows the label's initial; the chord moves to the title

**Files:**
- Modify: `apps/web-v2/src/entities/nav/doors.ts:20-63` (the doc note, `Door.icon`, the table)
- Modify: `apps/web-v2/src/entities/nav/RailRow.tsx` (add `title`)
- Modify: `apps/web-v2/src/entities/nav/SidebarDoor.tsx` (pass `title` through)
- Modify: `apps/web-v2/src/app/AppChrome.tsx:119-125` (`toItem`)
- Modify: `apps/web-v2/src/entities/nav/Sidebar.stories.tsx:23-107`
- Test: `apps/web-v2/src/entities/nav/doors.test.ts`

**Interfaces:**
- Consumes: `Door` from `doors.ts`, `RailRowProps` from Task 1.
- Produces:
  ```ts
  export interface Door { path: string; key: string; label: string; group: DoorGroup }   // `icon` REMOVED
  export function doorGlyph(door: Door): string;   // label.charAt(0).toUpperCase()
  export function doorTitle(door: Door): string;   // `${label} · g ${key}`
  ```
  and, added to `RailRowProps` and `SidebarDoorProps`:
  ```tsx
  /** Hover/AT text. Present in BOTH states — the chord is learned where it is printed. */
  title?: string;
  ```

- [ ] **Step 1: Write the failing test**

Before writing it, run the verification the design spec asks for — that nothing in the suite asserts the square's letter:

```
grep -rn "\bicon\b" apps/web-v2/e2e ; grep -rln "toHaveTextContent(\"[A-Z]\")" apps/web-v2/src apps/web-v2/e2e
```

Expected: no hits in `e2e/`; the only letter assertions are in `src/entities/nav/Sidebar.stories.tsx`, which supplies its own `icon` prop rather than reading `Door`. `navigation.spec` asserts the CHORD (`g` `d`, `g` `q`) and the key map's `label` text; nothing reads a glyph.

`apps/web-v2/src/entities/nav/doors.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { doorGlyph, doorTitle, doorForKey, doorsFor } from "./doors";

/**
 * D2, ruled in the spec: the square shows the LABEL INITIAL and the chord moves
 * to the row title and the `?` map — a chord is learned where it is printed,
 * not from a square. `Door.key` stays the single chord source and `Door.icon`
 * stops aliasing it.
 */
describe("the door glyph is the label's initial, derived not stored", () => {
  test("the admin's rail draws the export's own initials", () => {
    const byPath = new Map(doorsFor("admin").map((door) => [door.path, doorGlyph(door)]));
    expect(byPath.get("/queue")).toBe("Q");
    expect(byPath.get("/overview")).toBe("O");
    expect(byPath.get("/rulebook")).toBe("R");
    expect(byPath.get("/products")).toBe("P");
    expect(byPath.get("/clients")).toBe("C");
    expect(byPath.get("/people")).toBe("P");
    expect(byPath.get("/audit")).toBe("A");
    expect(byPath.get("/gallery")).toBe("S");
  });

  test("a colliding initial is fine — the export renders P twice and does not care", () => {
    const glyphs = doorsFor("admin").map(doorGlyph);
    expect(glyphs.filter((g) => g === "P")).toHaveLength(2);
  });
});

describe("the chord rides the title, and the key stays the only chord source", () => {
  test("the title names the door and the chord that opens it", () => {
    const rulebook = doorsFor("admin").find((door) => door.path === "/rulebook");
    expect(rulebook && doorTitle(rulebook)).toBe("rulebook · g b");
  });

  test("the glyph is not the chord — B still opens the rulebook, R draws it", () => {
    const rulebook = doorForKey("admin", "b");
    expect(rulebook?.path).toBe("/rulebook");
    expect(rulebook && doorGlyph(rulebook)).toBe("R");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project gates
```

Expected: `SyntaxError: The requested module './doors' does not provide an export named 'doorGlyph'`.

- [ ] **Step 3: Implement**

In `apps/web-v2/src/entities/nav/doors.ts`, replace the last paragraph of the file doc (the sentence beginning "`icon` is the letter-icon square…") with:

```
 * THE SQUARE SHOWS THE LABEL'S INITIAL, AND IT IS DERIVED, NOT STORED. The
 * export takes `label.charAt(0)` and renders P twice without caring (ruling D2).
 * An `icon` field would be a second copy of the label's first letter, free to
 * drift from it; `doorGlyph` cannot. The CHORD lives in `key` and is surfaced
 * where a chord is actually learned — the row's `title` (`doorTitle`) and the
 * `?` map, which already prints `g <key>` beside the label. `Door.key` is
 * therefore still the single source of the chord, and nothing aliases it.
```

Delete `icon: string;` from the `Door` interface and its `/** Single-letter icon… */` comment, delete `, icon: "…"` from all fifteen rows of `DOORS`, and append:

```ts
/**
 * The letter the rail's square draws. Derived so it cannot drift from the label
 * a reader sees beside it; collisions are the export's own behaviour, not a bug.
 */
export function doorGlyph(door: Door): string {
  return door.label.charAt(0).toUpperCase();
}

/**
 * The row's hover/AT text: what the door is, and the chord that opens it.
 * A chord is learned where it is printed — here and in the `?` map — never
 * from a one-letter square that has to double as an identifier.
 */
export function doorTitle(door: Door): string {
  return `${door.label} · g ${door.key}`;
}
```

In `RailRow.tsx`, add to `RailRowProps`:

```tsx
  /**
   * Hover/AT text, present in BOTH states. The collapsed rail needs it to name
   * the row at all; the wide rail uses it to carry the chord.
   */
  title?: string;
```

destructure `title`, and use it in both arms:
- link arm: `title={title ?? (collapsed ? label : undefined)}`
- unreachable arm: `title={title ?? \`${label} — opens once an order is in view\`}`

In `SidebarDoor.tsx`, add `title: string;` to `SidebarDoorProps` (required — every door has one), destructure it and pass `title={title}` to `RailRow`.

In `AppChrome.tsx`, import `doorGlyph, doorTitle` from `../entities/nav/doors` and change `toItem`:

```tsx
  const toItem = (door: Door): SidebarDoorItem => ({
    to: door.path,
    label: door.label,
    icon: doorGlyph(door),
    title: doorTitle(door),
    active: isActive(door.path),
    attention: attentionFor(door.path),
  });
```

In `Sidebar.stories.tsx`, update the fixture doors so the story stops asserting letters the app no longer draws — this is the drift the change removes:

```tsx
      { to: "/queue", label: "queue", icon: "Q", title: "queue · g q", active: true, attention: null },
      { to: "/overview", label: "overview", icon: "O", title: "overview · g o", active: false, attention: null },
      { to: "/escalations", label: "escalation inbox", icon: "E", title: "escalation inbox · g e", active: false, attention: "attend" },
```
```tsx
    doors: [{ to: "/rulebook", label: "rulebook", icon: "R", title: "rulebook · g b", active: false, attention: null }],
```
```tsx
    doors: [{ to: "/gallery", label: "states", icon: "S", title: "states · g g", active: false, attention: null }],
```

and in the `Expanded` play function change the rulebook assertion from `"B"` to `"R"`, adding above it:

```tsx
    // The square is the label's INITIAL; the chord `b` lives in the title and
    // the `?` map (ruling D2), so R here is the fix, not a typo.
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e --grep "navigation|sidebar"
```

Expected: `doors.test.ts` 4 passing, both `Sidebar` stories passing, `navigation.spec`'s `g d`/`g q` chords and its `escalation inbox` key-map assertion unchanged and green.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/nav/doors.ts apps/web-v2/src/entities/nav/doors.test.ts apps/web-v2/src/entities/nav/RailRow.tsx apps/web-v2/src/entities/nav/SidebarDoor.tsx apps/web-v2/src/entities/nav/Sidebar.stories.tsx apps/web-v2/src/app/AppChrome.tsx
```

```
Draw the label's initial in the door square and print the chord in the title

Door.icon was the chord key upper-cased — a second copy of a letter that means
something else, and unguessable from the label beside it. The square now
derives label.charAt(0), as the export does (it renders P twice and does not
care), and the chord moves to the row title, where the ? map already prints it.
Door.key remains the single chord source. Nothing in the suite asserted the
square's letter; the one place that did was a story supplying its own props,
and it was already wrong about the rulebook.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 4: `OrderRow` — the queue band row, built before the fixtures

**Files:**
- Create: `apps/web-v2/src/entities/order/OrderRow.tsx`
- Create: `apps/web-v2/src/entities/order/OrderRow.stories.tsx`
- Modify: `apps/web-v2/src/features/queue/QueueSections.tsx:31-68` (both band groups)
- Modify: `apps/web-v2/src/features/queue/QueueScreen.tsx:71,88` (pass the rows)

**Interfaces:**
- Consumes: `Card` from `shared/ui/Card` (Wave 1: `accent` is a 2px inset TOP stripe with a `settled` case), `Eyebrow`.
- Produces:
  ```tsx
  export interface OrderRowProps {
    /** The order reference, mono, as the server writes it. */
    orderRef: string;
    /** Chips beside the ref — product, state. Given, never derived. */
    chips?: ReactNode;
    /** Address and county, one server-written line. */
    place: string;
    /** What it is stopped on. Server text, verbatim. */
    note?: string;
    /** Server text like "1d 4h". There is no clock in this component. */
    waited?: string;
    /** Resume / Open. Absent — never disabled — when the viewer may not act. */
    action?: ReactNode;
    /** Held's inset top stripe. `none` for the ordinary bands. */
    edge?: "none" | "attend" | "halt";
  }
  export function OrderRow(props: OrderRowProps): ReactElement;
  ```
  `QueueSections` exports `MineBand({ orders }: { orders: readonly OrderRowProps[] })` and
  `TailBands({ senior, held, inFlight, delivered }: { senior: boolean; held: readonly OrderRowProps[]; inFlight: readonly OrderRowProps[]; delivered: readonly OrderRowProps[] })`.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/order/OrderRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { OrderRow } from "./OrderRow";

const meta = {
  title: "Order/OrderRow",
  component: OrderRow,
} satisfies Meta<typeof OrderRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mine: ref + product chip + place + waited + the resume action. */
export const Mine: Story = {
  args: {
    orderRef: "4176034-1",
    chips: <Chip tone="action" size="sm" bordered>40-YEAR SEARCH</Chip>,
    place: "1147 E Saddlebrook Ln, Mesa AZ · Maricopa County · AZ",
    waited: "3h 12m",
    action: <Button size="sm">Resume →</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("4176034-1")).toBeInTheDocument();
    expect(await canvas.findByText("Waiting")).toBeInTheDocument();
    expect(await canvas.findByText("3h 12m")).toBeInTheDocument();
    expect(await canvas.findByRole("button", { name: /Resume/ })).toBeInTheDocument();
  },
};

/** Held: the state edge, the reason line, and no action for a viewer with none. */
export const Held: Story = {
  args: {
    orderRef: "4176011-2",
    chips: <Chip tone="halt" size="sm" bordered>PACKAGE INCOMPLETE</Chip>,
    place: "884 W Orange Grove Rd, Tucson AZ · Pima County · AZ",
    note: "Waiting on the abstractor to add documents",
    waited: "1d 4h",
    edge: "halt",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      await canvas.findByText("Waiting on the abstractor to add documents"),
    ).toBeInTheDocument();
    // no action was supplied, so none is drawn — absent, never disabled
    expect(canvas.queryByRole("button")).toBeNull();
  },
};

/** A row with nothing waiting on it prints no waiting block at all. */
export const NoWaitRecorded: Story = {
  args: {
    orderRef: "4175991-3",
    place: "20 N Beaver St, Flagstaff AZ · Coconino County · AZ",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The server sent no duration, so the row stays silent rather than
    // printing a zero it would have had to invent.
    expect(canvas.queryByText("Waiting")).toBeNull();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./OrderRow" from "src/entities/order/OrderRow.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/order/OrderRow.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * One order in a queue band.
 *
 * RULE: the four visually similar bands — Mine, Held, In flight, Recently
 * delivered — are one row with different slots filled. FAILURE PREVENTED: the
 * four-near-identical-row-renderers failure HANDOFF-UI §1 names, arriving one
 * band at a time as the fixtures land. This is built BEFORE any of them, so
 * there is somewhere for them to render into.
 *
 * `waited` IS SERVER TEXT, RENDERED VERBATIM. There is no clock here and
 * nothing counts up: an elapsed timer on a work item is a pace indicator
 * wearing a helpful hat, and §4.5 refuses those. Where the server sends
 * nothing the block is absent rather than showing a zero nobody measured.
 *
 * THE ACTION IS A SLOT, AND AN ABSENT ONE IS ABSENT. A greyed "Open" invites
 * someone to ask for permission; a missing one answers them.
 *
 * `edge` is the design's inset TOP stripe on a held row — the severity of the
 * server's own state word, given by the caller, never inferred from how long
 * the row has waited.
 */
export interface OrderRowProps {
  orderRef: string;
  /** Chips beside the ref — product, state. Given, never derived. */
  chips?: ReactNode;
  /** Address and county, one server-written line. */
  place: string;
  /** What it is stopped on. Server text, verbatim. */
  note?: string;
  /** Server text like "1d 4h". */
  waited?: string;
  action?: ReactNode;
  edge?: "none" | "attend" | "halt";
}

export function OrderRow({ orderRef, chips, place, note, waited, action, edge = "none" }: OrderRowProps) {
  return (
    <Card accent={edge} className="flex flex-wrap items-center gap-7 px-8 py-6">
      <div className="min-w-110 flex-1">
        <div className="flex flex-wrap items-baseline gap-5">
          <span className="font-mono text-md font-semibold whitespace-nowrap text-ink-primary">
            {orderRef}
          </span>
          {chips}
        </div>
        <p className="mt-2 text-tiny leading-close text-ink-muted">{place}</p>
        {note === undefined ? null : (
          <p className="mt-2 text-xs leading-close text-ink-secondary">{note}</p>
        )}
      </div>

      {waited === undefined ? null : (
        <div className="text-right">
          <Eyebrow variant="stat" as="p">
            Waiting
          </Eyebrow>
          <p className="mt-1 font-mono text-md font-semibold text-ink-primary">{waited}</p>
        </div>
      )}

      {action}
    </Card>
  );
}
```

`apps/web-v2/src/features/queue/QueueSections.tsx` — keep the file doc verbatim, replace the imports and the three exported bodies:

```tsx
import type { ReactNode } from "react";
import type { OrderRowProps } from "../../entities/order/OrderRow";
import { OrderRow } from "../../entities/order/OrderRow";
import { Card, CardBody } from "../../shared/ui/Card";
import { QueueBand } from "./QueueBand";
```

```tsx
export function MineBand({ orders }: { orders: readonly OrderRowProps[] }) {
  return (
    <QueueBand title="Mine" note="in progress">
      {orders.length === 0 ? (
        <Empty>Nothing in progress — you&rsquo;re clear.</Empty>
      ) : (
        <Rows orders={orders} />
      )}
    </QueueBand>
  );
}

export function TailBands({
  senior,
  held,
  inFlight,
  delivered,
}: {
  senior: boolean;
  held: readonly OrderRowProps[];
  inFlight: readonly OrderRowProps[];
  delivered: readonly OrderRowProps[];
}) {
  return (
    <>
      <QueueBand title="Held" note="stopped · needs someone">
        {held.length === 0 ? <Empty>Nothing held.</Empty> : <Rows orders={held} />}
      </QueueBand>

      {senior ? (
        <QueueBand title="In flight" note="processing · senior · ops view">
          {inFlight.length === 0 ? (
            <Empty>
              Nothing in flight. This band is a read, not a worklist — seeing an
              order here is not an invitation to take it.
            </Empty>
          ) : (
            <Rows orders={inFlight} />
          )}
        </QueueBand>
      ) : null}

      <QueueBand title="Recently delivered" note="get back to a recent one">
        {delivered.length === 0 ? (
          <Empty>Nothing delivered recently on your account.</Empty>
        ) : (
          <Rows orders={delivered} />
        )}
      </QueueBand>
    </>
  );
}

function Rows({ orders }: { orders: readonly OrderRowProps[] }) {
  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <OrderRow key={order.orderRef} {...order} />
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardBody className="text-base text-ink-secondary">{children}</CardBody>
    </Card>
  );
}
```

In `QueueScreen.tsx`, pass the empty lists explicitly and move the CONTRACT GAP reasoning to the call site that passes nothing:

```tsx
      {/* CONTRACT GAP: there is no assigned-work endpoint, no held-orders
          endpoint and no in-flight projection — `GET /api/queue/next` returns
          exactly one order and has no browse counterpart. The bands render the
          rows they are given, and nothing gives them any yet. */}
      <MineBand orders={[]} />
```
```tsx
      <TailBands senior={view === "senior"} held={[]} inFlight={[]} delivered={[]} />
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "queue"
```

Expected: three `OrderRow` stories passing; `queue.spec` #1/#2 unchanged and green — the screen still shows exactly one server-chosen order and no counts.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/order/OrderRow.tsx apps/web-v2/src/entities/order/OrderRow.stories.tsx apps/web-v2/src/features/queue/QueueSections.tsx apps/web-v2/src/features/queue/QueueScreen.tsx
```

```
Give the four queue bands one row to render into

The bands are four views of the same row — mono ref, chips, place, the reason
it stopped, the waited stack and an optional action — and they are empty today
only because no endpoint fills them. Building the row first means the fixtures
land into one renderer instead of growing four. The bands take their rows as a
prop and keep their empty states; the CONTRACT GAP note moves to the call site
that passes nothing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 5: `OrderMiniCard` — one card for the board and the failed banner

**Files:**
- Create: `apps/web-v2/src/entities/order/OrderMiniCard.tsx`
- Create: `apps/web-v2/src/entities/order/OrderMiniCard.stories.tsx`
- Delete: `apps/web-v2/src/features/overview/OrderCard.tsx`
- Modify: `apps/web-v2/src/features/overview/StageColumn.tsx:5,64`
- Modify: `apps/web-v2/src/features/overview/FailedBanner.tsx:39-61`

**Interfaces:**
- Consumes: `Chip`, `cn` from `shared/ui`.
- Produces:
  ```tsx
  export interface OrderMiniCardProps {
    orderRef: string;
    /** The server's state word, when the card is out of the pipeline. */
    stateLabel?: string;
    /** Address and county, one server-written line. */
    place: string;
    /** Server text like "3h 12m". Absent when the server sent none. */
    waited?: string;
    /** What it is stopped on. */
    waitingOn?: string;
    /** `halt` is off-the-pipeline, not late. */
    tone?: "none" | "halt";
    /** The design's YOURS badge. */
    mine?: boolean;
  }
  export function OrderMiniCard(props: OrderMiniCardProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/order/OrderMiniCard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderMiniCard } from "./OrderMiniCard";

const meta = {
  title: "Order/OrderMiniCard",
  component: OrderMiniCard,
} satisfies Meta<typeof OrderMiniCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** In a stage column: four facts, and the last one is why the card exists. */
export const InColumn: Story = {
  args: {
    orderRef: "4176052-7",
    place: "55 E Monroe St, Phoenix AZ · Maricopa County · AZ",
    waited: "3h 12m",
    waitingOn: "Sign-off open",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("4176052-7")).toBeInTheDocument();
    expect(await canvas.findByText("Sign-off open")).toBeInTheDocument();
  },
};

/** Off the pipeline: the halt tone and the server's state word. */
export const Failed: Story = {
  args: {
    orderRef: "4175998-9",
    stateLabel: "Failed validation",
    place: "Address unreadable on cover · Maricopa County · AZ",
    waited: "2d 1h",
    waitingOn: "Waiting on intake to re-upload",
    tone: "halt",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("Failed validation")).toBeInTheDocument();
    expect(await canvas.findByText("Waiting on intake to re-upload")).toBeInTheDocument();
  },
};

/** Nothing recorded: no waiting block, and no invented zero. */
export const NothingRecorded: Story = {
  args: { orderRef: "4176003-4", place: "20 N Beaver St, Flagstaff AZ · Coconino County · AZ" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText(/^0/)).toBeNull();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./OrderMiniCard" from "src/entities/order/OrderMiniCard.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/order/OrderMiniCard.tsx`:

```tsx
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

/**
 * One order, small enough to sit in a stage column or a banner.
 *
 * RULE: one card, one set of facts. FAILURE PREVENTED: `overview/OrderCard` and
 * `overview/FailedBanner`'s inline list item were verbatim copies inside a
 * single feature folder, and had already drifted — only the banner knew what to
 * say when the server names nothing to wait on.
 *
 * FOUR FACTS AND NO MORE: which order, where, how long it has sat, and what it
 * is stopped on. The last is the card's whole reason to exist — a card showing
 * only "how long" is a lateness display, and lateness is not actionable.
 *
 * `waited` IS SERVER TEXT rendered verbatim. No clock, nothing counting up
 * (§4.5). Where the server sends nothing the block is absent rather than
 * printing a zero the card would have had to invent.
 *
 * `tone: "halt"` means OFF THE PIPELINE, not late. It is the caller's word for
 * the server's flag, never a conclusion this card reaches from a duration.
 */
export interface OrderMiniCardProps {
  orderRef: string;
  /** The server's state word, when the card is out of the pipeline. */
  stateLabel?: string;
  /** Address and county, one server-written line. */
  place: string;
  /** Server text like "3h 12m". */
  waited?: string;
  /** What it is stopped on. */
  waitingOn?: string;
  tone?: "none" | "halt";
  /** The design's YOURS badge — the server says whose it is, or nothing does. */
  mine?: boolean;
}

export function OrderMiniCard({
  orderRef,
  stateLabel,
  place,
  waited,
  waitingOn,
  tone = "none",
  mine = false,
}: OrderMiniCardProps) {
  return (
    <div
      className={cn(
        "rounded-7 border bg-surface-panel p-4",
        tone === "halt" ? "border-state-halt-border" : "border-line-strong",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-xs font-semibold text-ink-primary">{orderRef}</span>
        {stateLabel === undefined ? null : (
          <span
            className={cn(
              "text-tiny font-semibold",
              tone === "halt" ? "text-state-halt-ink" : "text-ink-secondary",
            )}
          >
            {stateLabel}
          </span>
        )}
        {mine ? (
          <Chip tone="inverse" size="micro" className="ml-auto">
            YOURS
          </Chip>
        ) : null}
      </div>

      <p className="mt-2 text-tiny leading-close text-ink-muted">{place}</p>

      {waited === undefined && waitingOn === undefined ? null : (
        <div className="mt-3 border-t border-line-subtle pt-3">
          {waited === undefined ? null : (
            <p className="font-mono text-tiny text-ink-secondary">{waited}</p>
          )}
          {waitingOn === undefined ? null : (
            <p
              className={cn(
                "mt-1 text-tiny leading-close",
                tone === "halt" ? "text-state-halt-ink" : "text-ink-muted",
              )}
            >
              {waitingOn}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

Delete `apps/web-v2/src/features/overview/OrderCard.tsx`. In `StageColumn.tsx` swap the import and the render, carrying the deleted file's CONTRACT GAP note up to the call site where the missing fields actually are:

```tsx
import { OrderMiniCard } from "../../entities/order/OrderMiniCard";
```
```tsx
          /* CONTRACT GAP: the census carries no order id and no "is it mine",
             so the card is not a link and takes no YOURS badge. When either
             lands, this call site gains them — the card already draws them. */
          stage.orders.map((order) => (
            <OrderMiniCard
              key={order.order_ref}
              orderRef={order.order_ref}
              place={`${order.addr} · ${order.county}`}
              {...(order.waited === null ? {} : { waited: order.waited })}
              {...(order.waiting_on === null ? {} : { waitingOn: order.waiting_on })}
            />
          ))
```

In `FailedBanner.tsx` replace the `<ul>` at `:39-61`, keeping the banner's own fallback sentence:

```tsx
import { OrderMiniCard } from "../../entities/order/OrderMiniCard";
```
```tsx
        <ul className="mt-5 flex flex-wrap gap-4">
          {orders.map((order) => (
            <li key={order.order_ref} className="min-w-108 shrink basis-auto">
              <OrderMiniCard
                orderRef={order.order_ref}
                place={`${order.addr} · ${order.county}`}
                tone="halt"
                {...(order.waited === null ? {} : { waited: order.waited })}
                waitingOn={order.waiting_on ?? "Needs a person to put it back"}
              />
            </li>
          ))}
        </ul>
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "routes"
```

Expected: three `OrderMiniCard` stories passing; the `/overview` route smoke test green.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/order/OrderMiniCard.tsx apps/web-v2/src/entities/order/OrderMiniCard.stories.tsx apps/web-v2/src/features/overview/StageColumn.tsx apps/web-v2/src/features/overview/FailedBanner.tsx
git rm apps/web-v2/src/features/overview/OrderCard.tsx
```

```
Draw the board's order card once instead of twice

overview/OrderCard and FailedBanner's inline list item were verbatim copies in
one feature folder and had already drifted — only the banner knew what to say
when the server names nothing to wait on. One card now carries both, with the
halt tone as the caller's word for the server's flag, and the CONTRACT GAP note
about the missing order id moves to the call site that would use it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 6: `DecisionRow`, and the field facts that let an entity draw it

**Files:**
- Create: `apps/web-v2/src/entities/field/fieldLabel.ts` (moved from `features/review/fieldLabel.ts`)
- Create: `apps/web-v2/src/entities/field/DecisionRow.tsx` (promoted from `features/review/FieldRow.tsx`)
- Create: `apps/web-v2/src/entities/field/DecisionRow.stories.tsx`
- Delete: `apps/web-v2/src/features/review/fieldLabel.ts`
- Delete: `apps/web-v2/src/features/review/FieldRow.tsx`
- Modify: `apps/web-v2/src/features/review/CallBackSheet.tsx:2`, `DecisionDock.tsx:2`, `DecisionPanel.tsx:3`, `DocumentColumn.tsx:7`, `ReadingsPanel.tsx:3`, `ReviewScreen.tsx:14`, `SheetValue.tsx:2` — the import path only
- Modify: `apps/web-v2/src/features/review/FieldList.tsx:2,33-42`

**Interfaces:**
- Consumes: `Field` from `@titlepipe/contract`; `NoValue` from `entities/field`.
- Produces:
  ```ts
  // src/entities/field/fieldLabel.ts — the same eight exports, at a new path
  export function fieldLabel(path: string): string;
  export function naChip(reason: NaReason): string;
  export function readingsOf(field: Field): FieldReading[];
  export function enginesDisagree(field: Field): boolean;
  export function isExcluded(field: Field): boolean;
  export function stateLabel(field: Field): string;
  export function rowMark(field: Field): string | null;
  export function hasNoProvenance(field: Field): boolean;
  ```
  ```tsx
  export function DecisionRow(props: { field: Field; selected: boolean; onSelect: () => void }): ReactElement;
  ```
  `DecisionRow` renders an `<li>` and keeps the `row-${field.path}` and `row-mark` testids exactly.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/field/DecisionRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Field } from "@titlepipe/contract";
import { expect, userEvent, within } from "storybook/test";
import { DecisionRow } from "./DecisionRow";

const meta = {
  title: "Field/DecisionRow",
  component: DecisionRow,
} satisfies Meta<typeof DecisionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const base: Field = {
  id: "f1",
  path: "mortgages.1.lender",
  value: null,
  value_raw: null,
  state: "needs_review",
  na_reason: null,
  excluded_reason: null,
  source_doc_id: null,
  source_page: null,
  source_snippet: null,
  source_line_coords: null,
  readings: [
    { id: "r1", engine_id: "gemini-2.5-flash", value: "SOUTHSTONE MORTGAGE", page: 7, snippet: null, line_coords: null },
    { id: "r2", engine_id: "llmwhisperer-hq", value: "S0UTHST0NE MORTGAGE", page: 7, snippet: null, line_coords: null },
  ],
};

/** A queued row: the label, the disagreement chip, and a live control. */
export const Queued: Story = {
  args: { field: base, selected: false, onSelect: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("row-mortgages.1.lender");
    expect(row).toHaveTextContent("MTG 1 — LENDER");
    expect(row).toHaveTextContent("A≠B");
    let clicks = 0;
    args.onSelect = () => (clicks += 1);
    await userEvent.click(row);
    expect(clicks).toBe(1);
  },
};

/** A value with no document, no page and no reading is a visible error. */
export const NoProvenance: Story = {
  args: {
    field: { ...base, value: "MARIA L. ESTRADA", readings: [] },
    selected: false,
    onSelect: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Principle 6: never emit a value you cannot cite.
    expect(await canvas.findByTestId("row-mortgages.1.lender")).toHaveTextContent(
      "NO PROVENANCE",
    );
  },
};

/** A human decision is marked as one; an auto-confirmed field is not. */
export const Corrected: Story = {
  args: {
    field: { ...base, value: "SOUTHSTONE MORTGAGE LLC", state: "corrected", readings: [] },
    selected: true,
    onSelect: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("row-mark")).toHaveTextContent("✎ corrected");
  },
};
```

If any field on `Field` has been renamed by Wave 2's contract work, take the shape from `packages/contract/src/entities.ts` — the fixture above must be a valid `Field`, and `typecheck` is what says so.

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./DecisionRow" from "src/entities/field/DecisionRow.stories.tsx"`.

- [ ] **Step 3: Implement**

1. `git mv apps/web-v2/src/features/review/fieldLabel.ts apps/web-v2/src/entities/field/fieldLabel.ts` — its only import is `@titlepipe/contract`, so it moves unchanged. Add one paragraph at the top of its doc:

```
 * IT LIVES IN `entities/field` BECAUSE IT IS FIELD KNOWLEDGE, NOT REVIEW
 * KNOWLEDGE. The report sheet, the decision row and the decision card all need
 * the same answers, and a presentational entity may not reach into a feature to
 * get them (§7). Keeping it under `features/review` is what let three separate
 * files each re-derive "do the engines disagree".
```

2. Point the seven importers at `"../../entities/field/fieldLabel"`.

3. `git mv apps/web-v2/src/features/review/FieldRow.tsx apps/web-v2/src/entities/field/DecisionRow.tsx`, rename the export, point its imports at siblings, and replace the doc block. The component BODY is unchanged — same `<li>`, same `data-testid`, same chips, same `row-mark` span:

```tsx
import type { Field } from "@titlepipe/contract";
import { enginesDisagree, fieldLabel, hasNoProvenance, naChip, rowMark } from "./fieldLabel";
import { NoValue } from "./NoValue";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

/**
 * One decision, collapsed to a row.
 *
 * RULE: there is ONE collapsed field row in this app. FAILURE PREVENTED:
 * `features/review` grew three — the queue list's row, the settled list's row
 * and the sheet's inline row — each free to answer "what state is this in"
 * differently on the same screen, in front of the same reviewer.
 *
 * "NOT AVAILABLE" IS WHAT SHIPS; THE CHIP IS WHAT SEPARATES THE FOUR REASONS
 * (`review.spec` #1). Both sit on the row because the reviewer needs the
 * report's text and the reason behind it at the same time — that pairing is
 * what makes a wrong NA reason visible before it leaves the building.
 *
 * A PENDING FIELD IS NEITHER. It renders "not yet extracted", never "Not
 * Available": the pipeline has not looked, so calling the value unavailable
 * would report a conclusion nobody reached.
 *
 * NEVER EMIT A VALUE YOU CANNOT CITE. A value with no document, no page and no
 * reading carries the NO PROVENANCE chip — a visible error, not an ordinary
 * value (principle 6, `review.spec` #2).
 *
 * NO VISUAL CHANGE IN THIS MOVE. The export's status dot and right-hand status
 * word belong to the Review screen's rework and land with it (Wave 4); this is
 * an extraction, and an extraction that also restyles cannot be reviewed.
 */
export function DecisionRow({
  field,
  selected,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
}) {
```

4. In `FieldList.tsx`, swap the import and both call sites:

```tsx
import { DecisionRow } from "../../entities/field/DecisionRow";
```
```tsx
        <DecisionRow
          key={field.id}
          field={field}
          selected={field.path === selectedPath}
          onSelect={() => onSelect(field.path)}
        />
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e --grep "review|ux"
```

Expected: three `DecisionRow` stories passing; `review.spec` #1/#2 and every `row-*` / `row-mark` assertion in `ux.spec` unchanged and green — the testids are the same strings.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/field/fieldLabel.ts apps/web-v2/src/entities/field/DecisionRow.tsx apps/web-v2/src/entities/field/DecisionRow.stories.tsx apps/web-v2/src/features/review/
```

```
Promote the decision row and the field facts out of features/review

The answer to "what state is this field in" is field knowledge, not review
knowledge, and a presentational entity may not reach into a feature to get it —
which is why three files under features/review each re-derived whether the
engines disagreed. fieldLabel.ts and the live FieldRow move to entities/field
unchanged; every testid and every rendered string is identical.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 7: `OrderContextRow` — one row instead of a fabrication and an omission

**Files:**
- Create: `apps/web-v2/src/entities/order/OrderContextRow.tsx`
- Create: `apps/web-v2/src/entities/order/OrderContextRow.stories.tsx`
- Modify: `apps/web-v2/src/features/completeness/CompletenessScreen.tsx:87-105`
- Modify: `apps/web-v2/src/features/delivered/FinalizedNotice.tsx:51-72`

**Interfaces:**
- Consumes: `Eyebrow`, `Chip` from `shared/ui`.
- Produces:
  ```tsx
  export interface OrderContextRowProps {
    productName: string;
    /** The dated span, e.g. "40-year period · 07/18/1986 – 07/18/2026". */
    periodLabel: string;
    /** e.g. "config v4". Omitted entirely when the server does not say. */
    configVersion?: string;
    /** Right-hand slot for a screen-owned control. */
    trailing?: ReactNode;
  }
  export function OrderContextRow(props: OrderContextRowProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/order/OrderContextRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderContextRow } from "./OrderContextRow";

const meta = {
  title: "Order/OrderContextRow",
  component: OrderContextRow,
} satisfies Meta<typeof OrderContextRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole row: what was ordered, over what period, against which config. */
export const Frozen: Story = {
  args: {
    productName: "40-Year Search",
    periodLabel: "40-year period · 07/18/1986 – 07/18/2026",
    configVersion: "config v4",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Literal capitals in the markup, never a CSS transform.
    expect(await canvas.findByText("ORDERED")).toBeInTheDocument();
    expect(await canvas.findByText("40-Year Search")).toBeInTheDocument();
    expect(
      await canvas.findByText("40-year period · 07/18/1986 – 07/18/2026"),
    ).toBeInTheDocument();
    expect(await canvas.findByText("config v4 · frozen")).toBeInTheDocument();
  },
};

/** No config version on the wire: the badge is absent, never a guess. */
export const NoConfigVersion: Story = {
  args: {
    productName: "40-Year Search",
    periodLabel: "40-year period · 07/18/1986 – 07/18/2026",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByText(/frozen/)).toBeNull();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./OrderContextRow" from "src/entities/order/OrderContextRow.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/order/OrderContextRow.tsx`:

```tsx
import type { ReactNode } from "react";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * What was ordered: the product, the period it covers, and the config the order
 * was frozen against.
 *
 * RULE: one row, one source. FAILURE PREVENTED: this row existed three times
 * and no two agreed — completeness read it from the server, the delivered
 * screen printed two hardcoded demo constants, and Review omitted it entirely.
 * A fabrication on one screen and an omission on another are the same defect
 * seen from two sides; one component makes the gap visible in one place.
 *
 * "ORDERED" IN LITERAL CAPITALS in the markup, never a CSS transform — a
 * transform does not change what the text says (§6 trap).
 *
 * THE PERIOD IS A DATE SPAN, not a state word, so it is not shouted: the chip
 * keeps its mono face and normal case, because "07/18/1986 – 07/18/2026" in 9px
 * letterspaced caps stops being a number you can read at a glance.
 *
 * CONTRACT GAP: no order-scoped response carries `product`, `period` or the
 * frozen config version. Callers that have them pass them; the one that does
 * not passes its demo constants, and the gap is recorded HERE rather than
 * disguised on a screen.
 */
export interface OrderContextRowProps {
  productName: string;
  /** The dated span, e.g. "40-year period · 07/18/1986 – 07/18/2026". */
  periodLabel: string;
  /** e.g. "config v4". Omitted entirely when the server does not say. */
  configVersion?: string;
  /** Right-hand slot for a screen-owned control. */
  trailing?: ReactNode;
}

export function OrderContextRow({
  productName,
  periodLabel,
  configVersion,
  trailing,
}: OrderContextRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Eyebrow variant="caption">ORDERED</Eyebrow>
      <span className="text-md font-semibold text-ink-primary">{productName}</span>
      <Chip
        tone="action"
        size="md"
        shape="mono"
        bordered
        className="text-xs tracking-normal normal-case"
      >
        {periodLabel}
      </Chip>
      {configVersion === undefined ? null : (
        <span className="rounded-4 border border-line-strong px-3 py-1 font-mono text-micro text-ink-muted">
          {configVersion} · frozen
        </span>
      )}
      {trailing === undefined ? null : <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
```

In `CompletenessScreen.tsx`, replace `:87-105` with the row, keeping the local-preview toggle in the trailing slot exactly as it stands — that toggle's removal to `features/gallery` is Wave 4's:

```tsx
      <OrderContextRow
        productName={data.product_name}
        periodLabel={data.period_label}
        trailing={
          <div className="flex items-center gap-4">
            <Eyebrow variant="caption">Gate verdict · local preview</Eyebrow>
            <ToggleGroup
              aria-label="Gate verdict (local preview)"
              value={[gateOpen ? "open" : "closed"]}
              onValueChange={(value) => setGateOpen(value[0] !== "closed")}
            >
              <Toggle value="open">Open</Toggle>
              <Toggle value="closed">Closed</Toggle>
            </ToggleGroup>
          </div>
        }
      />
```

Remove the now-unused `Chip` import from that file. The screen's caption changes from "Product ordered" to the shared "ORDERED" — both are the export's own words for this row (`:525` and `:836`), and the shorter one is the one that dedupes.

In `FinalizedNotice.tsx`, replace `:51-72` with:

```tsx
      <div className="mb-11 flex justify-center">
        <OrderContextRow productName={DEMO_PRODUCT_NAME} periodLabel={DEMO_PERIOD_BADGE} />
      </div>
```

and delete the `Chip` and `Eyebrow` imports it no longer uses, together with the `normal-case` comment block that now lives on the entity.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "routes"
```

Expected: two `OrderContextRow` stories passing; the `/completeness` and `/delivered` route smoke tests green.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/order/OrderContextRow.tsx apps/web-v2/src/entities/order/OrderContextRow.stories.tsx apps/web-v2/src/features/completeness/CompletenessScreen.tsx apps/web-v2/src/features/delivered/FinalizedNotice.tsx
```

```
Say what was ordered in one row instead of three ways

Completeness read the product and period from the server, the delivered screen
printed two hardcoded demo constants, and Review said nothing at all — a
fabrication on one screen and an omission on another. One row now carries it,
and the missing order-scoped product/period/config is recorded on the component
rather than disguised at a call site.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 8: `SignoffReadonly` — a signed sign-off stops offering controls

**Files:**
- Create: `apps/web-v2/src/entities/signoff/SignoffLineRow.tsx`
- Create: `apps/web-v2/src/entities/signoff/SignoffReadonly.tsx`
- Create: `apps/web-v2/src/entities/signoff/SignoffReadonly.stories.tsx`
- Modify: `apps/web-v2/src/features/questions/QuestionsScreen.tsx:1-61`

**Interfaces:**
- Consumes: `OrderSignoffResponse`, `OrderSignoffLine`, `SignoffAnswer` from `@titlepipe/contract`; `Card`, `CardHeader`, `CardFooter`, `Eyebrow`, `Chip`, `Stamp` from `shared/ui`; `OrderContextRow` from Task 7.
- Produces:
  ```tsx
  export interface SignoffLineRowProps {
    n: number;
    label: string;
    answer: SignoffAnswer | null;
    /** The abstractor's own words. Quoted verbatim, never paraphrased. */
    comment: string | null;
    /** The line's scope note, when the product declares one. */
    scopeNote?: string;
  }
  export function SignoffLineRow(props: SignoffLineRowProps): ReactElement;

  export interface SignoffReadonlyProps {
    signoff: OrderSignoffResponse;
  }
  export function SignoffReadonly(props: SignoffReadonlyProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/signoff/SignoffReadonly.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { OrderSignoffLine, OrderSignoffResponse } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { SignoffReadonly } from "./SignoffReadonly";

const meta = {
  title: "Signoff/SignoffReadonly",
  component: SignoffReadonly,
} satisfies Meta<typeof SignoffReadonly>;

export default meta;
type Story = StoryObj<typeof meta>;

const line = (n: number, over: Partial<OrderSignoffLine> = {}): OrderSignoffLine => ({
  line_id: `L${String(n).padStart(2, "0")}`,
  n,
  label: `Sign-off line ${n}`,
  answer: "YES",
  comment: null,
  comment_required: false,
  prefilled_from_policy: false,
  ...over,
});

const signed: OrderSignoffResponse = {
  order_id: "ord_demo_1",
  product_name: "40-Year Search",
  period_label: "40-year period · 07/18/1986 – 07/18/2026",
  signed_by: "R. Alvarez (abstractor)",
  signed_at: "2026-07-18",
  lines: [
    line(1),
    line(2, { answer: "NO", comment: "No plat of record for this subdivision." }),
    line(3, { answer: "NA" }),
  ],
};

/** Signed: the stamp, the lines, the words — and not one control. */
export const Signed: Story = {
  args: { signoff: signed },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("R. Alvarez (abstractor)")).toBeInTheDocument();
    expect(await canvas.findByText(/No plat of record/)).toBeInTheDocument();
    // CONTRACT GAP: there is no amendment endpoint. An editable control over a
    // signed, append-only record offers an act the server cannot accept.
    expect(canvas.queryAllByRole("button")).toHaveLength(0);
    expect(canvas.queryAllByRole("radio")).toHaveLength(0);
    expect(canvas.queryAllByRole("textbox")).toHaveLength(0);
  },
};

/** A NO without its comment is a visible defect, not a quiet blank. */
export const NoWithoutItsComment: Story = {
  args: {
    signoff: { ...signed, lines: [line(2, { answer: "NO", comment: null, comment_required: true })] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("NO recorded with no comment")).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./SignoffReadonly" from "src/entities/signoff/SignoffReadonly.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/signoff/SignoffLineRow.tsx`:

```tsx
import type { SignoffAnswer } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * One signed sign-off line, as a record rather than a question.
 *
 * RULE: a recorded answer keeps the abstractor's own words beside it. FAILURE
 * PREVENTED: a NO summarised or dropped stops being a disclosure and becomes a
 * blank, and the reviewer downstream inherits a gap nobody named.
 *
 * A NO THAT REQUIRED A COMMENT AND HAS NONE IS SHOWN AS A DEFECT, not as an
 * empty line. The refusal is the server's (`min(1)`), so a record that reached
 * the client without one is a fault worth seeing rather than hiding.
 *
 * "Sign-off line N · label" is the export's own sentence (`:947`), written in
 * literal capitals nowhere — it is sentence case, and it stays that way.
 */
const ANSWER_TONE = {
  YES: "settled",
  NO: "attend",
  NA: "neutral",
} as const satisfies Record<SignoffAnswer, "settled" | "attend" | "neutral">;

export interface SignoffLineRowProps {
  n: number;
  label: string;
  answer: SignoffAnswer | null;
  /** The abstractor's own words. Quoted verbatim, never paraphrased. */
  comment: string | null;
  /** The line's scope note, when the product declares one. */
  scopeNote?: string;
}

export function SignoffLineRow({ n, label, answer, comment, scopeNote }: SignoffLineRowProps) {
  return (
    <li className="flex flex-col gap-2 border-t border-line-subtle px-8 py-5 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="flex-1 text-sm font-semibold text-ink-primary">
          Sign-off line {n} · {label}
        </span>
        {answer === null ? (
          <Eyebrow variant="caption" tone="halt">
            Not answered
          </Eyebrow>
        ) : (
          <Chip tone={ANSWER_TONE[answer]} size="sm" bordered>
            {answer}
          </Chip>
        )}
      </div>

      {scopeNote === undefined ? null : (
        <p className="text-tiny leading-close text-ink-muted">{scopeNote}</p>
      )}

      {comment === null ? (
        answer === "NO" ? (
          <p className="text-xs font-semibold text-state-halt-ink">
            NO recorded with no comment
          </p>
        ) : null
      ) : (
        <p className="border-l-(length:--stroke-accent) border-state-attend pl-5 font-quote text-sm leading-open text-ink-secondary">
          &ldquo;{comment}&rdquo;
        </p>
      )}
    </li>
  );
}
```

`apps/web-v2/src/entities/signoff/SignoffReadonly.tsx`:

```tsx
import type { OrderSignoffResponse } from "@titlepipe/contract";
import { Card, CardFooter, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Stamp } from "../../shared/ui/Stamp";
import { OrderContextRow } from "../order/OrderContextRow";
import { SignoffLineRow } from "./SignoffLineRow";

/**
 * A sign-off that has been signed, shown as the record it now is.
 *
 * RULE: once a person has signed, the screen stops offering to change it.
 * FAILURE PREVENTED: `SignoffCard` drew live radios and comment boxes over a
 * signed record, so a person could answer thirteen questions that had no
 * endpoint to go to and no meaning if there were one. CONTRACT GAP: there is no
 * sign-off amendment endpoint, and an append-only record is not editable in
 * place even when one lands — an amendment would be a new signature, not a
 * rewrite of this one.
 *
 * THE STAMP NAMES WHO SIGNED AND WHEN, because "signed" without a signer is the
 * claim without the accountability, and this block is the only place the
 * downstream reviewer meets either.
 */
export interface SignoffReadonlyProps {
  signoff: OrderSignoffResponse;
}

export function SignoffReadonly({ signoff }: SignoffReadonlyProps) {
  const noCount = signoff.lines.filter((line) => line.answer === "NO").length;

  return (
    <Card accent="settled">
      <CardHeader filled>
        <Eyebrow variant="section" tone="settled">
          Abstractor Sign-off
        </Eyebrow>
        <div className="ml-auto">
          <Stamp tone="settled" size="sm">
            Signed
          </Stamp>
        </div>
      </CardHeader>

      <div className="border-b border-line-subtle px-8 py-5">
        <OrderContextRow
          productName={signoff.product_name}
          periodLabel={signoff.period_label}
        />
        <p className="mt-4 text-xs text-ink-secondary">
          {signoff.signed_by === null ? "Not signed" : signoff.signed_by}
          {signoff.signed_at === null ? null : ` · ${signoff.signed_at}`}
        </p>
      </div>

      <ul>
        {signoff.lines.map((line) => (
          <SignoffLineRow
            key={line.line_id}
            n={line.n}
            label={line.label}
            answer={line.answer}
            comment={line.comment}
          />
        ))}
      </ul>

      <CardFooter>
        {signoff.lines.length} lines answered · {noCount} disclosed as NO
      </CardFooter>
    </Card>
  );
}
```

In `QuestionsScreen.tsx`, branch on the server's own `signed_by` — the same null the "Not signed" banner already reads — and add the two imports:

```tsx
import { SignoffReadonly } from "../../entities/signoff/SignoffReadonly";
```
```tsx
      {/* SIGNED IS A DIFFERENT SCREEN, not a disabled one. `signed_by` is the
          server's, and once it is set the answers are a record: there is no
          amendment endpoint, and an append-only signature is not edited in
          place. Drawing live controls over it offered an act nothing accepts. */}
      {data.signed_by === null ? (
        <SignoffCard signoff={data} />
      ) : (
        <SignoffReadonly signoff={data} />
      )}
```

If `Stamp` has no `sm` size, use the smallest it declares — read `shared/ui/Stamp.tsx` and match; do not add a size to `Stamp` in this task.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "routes|ingest"
```

Expected: two `SignoffReadonly` stories passing; `/questions` route smoke green (the demo order is unsigned, so the interactive card still renders and nothing else moves).

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/signoff/ apps/web-v2/src/features/questions/QuestionsScreen.tsx
```

```
Show a signed sign-off as a record, not as thirteen live questions

SignoffCard drew radios and comment boxes over a signed record, offering an
amendment no endpoint accepts and an append-only signature could not take
anyway. A signed sign-off now renders read-only — the stamp, who signed it,
what was ordered, and every line with the abstractor's own words — and a NO
recorded with no comment shows as the defect it is rather than a blank.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 9: `PageSpine` — one denominator on one pane

**Files:**
- Create: `apps/web-v2/src/entities/document/pageCoverage.ts`
- Create: `apps/web-v2/src/entities/document/pageCoverage.test.ts`
- Create: `apps/web-v2/src/entities/document/PageSpine.tsx`
- Create: `apps/web-v2/src/entities/document/PageSpine.stories.tsx`
- Delete: `apps/web-v2/src/entities/document/PageStrip.tsx`, `apps/web-v2/src/entities/document/PageStrip.stories.tsx`
- Modify: `apps/web-v2/src/features/review/CoverageSpine.tsx:1-126`
- Modify: `apps/web-v2/src/features/review/DocumentColumn.tsx:9,89-97`

**Interfaces:**
- Consumes: `SourcePage`, `OrderPagesResponse` from `@titlepipe/contract`.
- Produces:
  ```ts
  export type CellState = "read" | "degraded" | "partial" | "unseen";
  export const CELL_LABEL: Record<CellState, string>;
  export const cellClasses: (props?: { state?: CellState }) => string;
  export function classifyPage(page: SourcePage | undefined): CellState;
  export function coverageCells(totalPages: number, pages: readonly SourcePage[]): readonly { n: number; state: CellState }[];
  export function coverageCounts(cells: readonly { state: CellState }[]): Record<CellState, number>;
  ```
  ```tsx
  export interface PageSpineProps {
    totalPages: number;
    pages: readonly SourcePage[];
    /** Marks "you are here" when the spine is being used to navigate. */
    currentPage?: number;
    /** Present ⇒ every cell is a button. Absent ⇒ the spine is a picture. */
    onSelect?: ((page: number) => void) | undefined;
  }
  export function PageSpine(props: PageSpineProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/document/pageCoverage.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { SourcePage } from "@titlepipe/contract";
import { cellClasses, classifyPage, coverageCells, coverageCounts } from "./pageCoverage";

const page = (n: number, over: Partial<SourcePage> = {}): SourcePage => ({
  n,
  text: "",
  read_in_full: true,
  degraded: false,
  ...over,
});

/**
 * The spine answers "what have I NOT looked at". A list of the pages a reader
 * typed cannot: eleven chips out of sixty-four have no representation at all
 * for the other fifty-three, which reads as "the package has eleven pages".
 */
describe("every package page gets a cell", () => {
  test("cells are drawn for the total, not for the served list", () => {
    const cells = coverageCells(64, [page(3), page(7)]);
    expect(cells).toHaveLength(64);
    expect(cells.filter((c) => c.state === "unseen")).toHaveLength(62);
  });

  test("the counts sum to the package", () => {
    const counts = coverageCounts(coverageCells(64, [page(3), page(7, { degraded: true })]));
    expect(counts.read + counts.degraded + counts.partial + counts.unseen).toBe(64);
  });
});

describe("the four states never collapse", () => {
  test("classification consults degraded only once read in full", () => {
    expect(classifyPage(undefined)).toBe("unseen");
    expect(classifyPage(page(1, { read_in_full: false, degraded: true }))).toBe("partial");
    expect(classifyPage(page(1, { degraded: true }))).toBe("degraded");
    expect(classifyPage(page(1))).toBe("read");
  });

  test("every state produces a DIFFERENT class list", () => {
    const seen = new Map<string, string>();
    for (const state of ["read", "degraded", "partial", "unseen"] as const) {
      const classes = cellClasses({ state });
      expect(seen.get(classes), `${state} duplicates another state`).toBeUndefined();
      seen.set(classes, state);
    }
    expect(seen.size).toBe(4);
  });

  test("the distinction survives greyscale — unseen is dashed, not merely pale", () => {
    // Same rule as the six no-value renders: colour is secondary, border style
    // and fill carry the distinction.
    expect(cellClasses({ state: "unseen" })).toContain("border-dashed");
    expect(cellClasses({ state: "partial" })).not.toContain("border-dashed");
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project gates
```

Expected: `Failed to load url ./pageCoverage (resolved id: …/src/entities/document/pageCoverage) … does not exist`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/document/pageCoverage.ts`:

```ts
import { cva } from "class-variance-authority";
import type { SourcePage } from "@titlepipe/contract";

/**
 * The four things that can be true of a package page, and how each one looks.
 *
 * RULE: coverage is stated for every page in the package, never only for the
 * pages a reader typed. FAILURE PREVENTED: a strip of eleven chips out of a
 * 64-page package has NO representation for the other fifty-three — they are
 * not shown as skipped, they are absent, which reads as "the package has eleven
 * pages" to anyone who has not memorised the denominator elsewhere on screen.
 *
 * ALL FOUR ARE SERVER-SUPPLIED, NEVER INFERRED, and `degraded` is consulted
 * only once a page is confirmed read in full — mirroring `PageFacsimile`'s own
 * precedence, so nothing here invents a fifth combination the server did not
 * send.
 *
 * `partial` and `unseen` must stay as distinct as the field-level NA states do:
 * collapsing "present but not read in full" into "never served" would hide that
 * the classifier looked at the page and chose not to read it, which is a
 * different fact from the page not existing in the served text at all.
 */
export type CellState = "read" | "degraded" | "partial" | "unseen";

/**
 * Colour is not the only signal — same reasoning as the six no-value renders:
 * `unseen` takes a DASHED border, the "quiet, correct, not a gap" treatment, so
 * the majority state reads as normal under greyscale too.
 */
export const cellClasses = cva("rounded-2 border", {
  variants: {
    state: {
      read: "border-state-settled bg-state-settled-surface",
      degraded: "border-state-attend bg-state-attend-surface",
      partial: "border-state-idle-border bg-state-idle-surface",
      unseen: "border-dashed border-line-strong bg-surface-app",
    },
  },
  defaultVariants: { state: "unseen" },
});

export const CELL_LABEL: Record<CellState, string> = {
  read: "read in full",
  degraded: "read in full — degraded scan",
  partial: "present, not read in full",
  unseen: "not served — no reader typed this page",
};

export function classifyPage(page: SourcePage | undefined): CellState {
  if (page === undefined) return "unseen";
  if (!page.read_in_full) return "partial";
  if (page.degraded) return "degraded";
  return "read";
}

export interface CoverageCell {
  n: number;
  state: CellState;
}

/** One cell per package page, in order. The client does not count pages — the
 *  total is the server's; this only walks it. */
export function coverageCells(
  totalPages: number,
  pages: readonly SourcePage[],
): readonly CoverageCell[] {
  const byPage = new Map(pages.map((page) => [page.n, page]));
  return Array.from({ length: totalPages }, (_, i) => ({
    n: i + 1,
    state: classifyPage(byPage.get(i + 1)),
  }));
}

export function coverageCounts(
  cells: readonly { state: CellState }[],
): Record<CellState, number> {
  const counts: Record<CellState, number> = { read: 0, degraded: 0, partial: 0, unseen: 0 };
  for (const cell of cells) counts[cell.state] += 1;
  return counts;
}
```

`apps/web-v2/src/entities/document/PageSpine.tsx`:

```tsx
import type { SourcePage } from "@titlepipe/contract";
import { cellClasses, CELL_LABEL, coverageCells, coverageCounts } from "./pageCoverage";
import { cn } from "../../shared/ui/classNames";

/**
 * The coverage spine: one cell for every page IN THE PACKAGE.
 *
 * RULE: one instrument, one denominator. FAILURE PREVENTED: review drew this
 * spine over 64 pages and `PageStrip` drew a chip list over 7 on the same pane,
 * so the screen stated two different package sizes a scroll apart.
 *
 * IT IS EITHER A PICTURE OR A CONTROL, AND IT SAYS WHICH. With `onSelect` every
 * cell is a real `<button>` carrying `aria-current` — §6 requires every
 * interactive element to be keyboard reachable, and a `<span onClick>` is
 * neither focusable nor announced. Without it the cells are `role="img"` and
 * nothing invites a click that does nothing.
 */
export interface PageSpineProps {
  totalPages: number;
  pages: readonly SourcePage[];
  /** Marks "you are here" when the spine is being used to navigate. */
  currentPage?: number;
  /** Present ⇒ every cell is a button. Absent ⇒ the spine is a picture. */
  onSelect?: ((page: number) => void) | undefined;
}

export function PageSpine({ totalPages, pages, currentPage, onSelect }: PageSpineProps) {
  const cells = coverageCells(totalPages, pages);
  const counts = coverageCounts(cells);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {cells.map((cell) => {
          const label = `page ${cell.n}, ${CELL_LABEL[cell.state]}`;
          const current = cell.n === currentPage;
          return onSelect === undefined ? (
            <span
              key={cell.n}
              data-testid="coverage-cell"
              role="img"
              aria-label={label}
              title={`p${cell.n} · ${CELL_LABEL[cell.state]}`}
              className={cn("size-9", cellClasses({ state: cell.state }))}
            />
          ) : (
            <button
              key={cell.n}
              type="button"
              data-testid="coverage-cell"
              aria-label={label}
              aria-current={current ? "page" : undefined}
              title={`p${cell.n} · ${CELL_LABEL[cell.state]}`}
              onClick={() => onSelect(cell.n)}
              className={cn(
                "size-9",
                cellClasses({ state: cell.state }),
                current && "ring-2 ring-action",
              )}
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-6">
        {(Object.keys(CELL_LABEL) as (keyof typeof CELL_LABEL)[]).map((state) => (
          <li key={state} className="flex items-center gap-3 text-tiny text-ink-muted">
            <span aria-hidden className={cn("size-5", cellClasses({ state }))} />
            {CELL_LABEL[state]} ({counts[state]})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

If `ring-2 ring-action` is not an emitted utility in this build (Tailwind v4 `@theme` namespaces are not uniform — §6 trap), replace the current marker with `border-(length:--stroke-emphasis) border-action` and grep the built CSS to confirm it emits.

`apps/web-v2/src/entities/document/PageSpine.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SourcePage } from "@titlepipe/contract";
import { expect, userEvent, within } from "storybook/test";
import { PageSpine } from "./PageSpine";

const meta = {
  title: "Document/PageSpine",
  component: PageSpine,
} satisfies Meta<typeof PageSpine>;

export default meta;
type Story = StoryObj<typeof meta>;

const pages: SourcePage[] = [
  { n: 3, text: "", read_in_full: true, degraded: false },
  { n: 7, text: "", read_in_full: true, degraded: true },
  { n: 9, text: "", read_in_full: false, degraded: false },
];

/** As a picture: one cell per package page, and no click target. */
export const Coverage: Story = {
  args: { totalPages: 64, pages },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findAllByTestId("coverage-cell")).toHaveLength(64);
    expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

/** As a control: every cell is a real button and the current page is marked. */
export const Navigable: Story = {
  args: { totalPages: 12, pages, currentPage: 7, onSelect: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const picked: number[] = [];
    args.onSelect = (n: number) => picked.push(n);
    const cells = await canvas.findAllByRole("button");
    expect(cells).toHaveLength(12);
    const third = cells[2];
    if (third) await userEvent.click(third);
    expect(picked).toEqual([3]);
  },
};
```

`CoverageSpine.tsx` keeps its Card, its heading and its summary sentence, and delegates the grid — its file doc's whole `PageStrip` comparison paragraph is deleted, because the component it argued against no longer exists:

```tsx
import { useQuery } from "@tanstack/react-query";
import type { OrderPagesResponse } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { PageSpine } from "../../entities/document/PageSpine";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Coverage over the whole package, in the review pane.
 *
 * RULE: the summary quotes the SERVER'S page count, and every other string on
 * this pane quotes the same one. FAILURE PREVENTED: two denominators — 7 and 64
 * — on one pane, because the strip listed served pages and the spine drew the
 * package.
 */
export function CoverageSpine({ coverage }: { coverage: OrderPagesResponse }) {
  return (
    <Card data-testid="coverage-spine">
      <CardBody className="flex flex-col gap-5">
        <Eyebrow variant="section">Coverage</Eyebrow>
        <p className="text-xs text-ink-secondary">Coverage · all {coverage.total_pages} pages</p>
        <PageSpine totalPages={coverage.total_pages} pages={coverage.pages} />
      </CardBody>
    </Card>
  );
}

/**
 * The connected host. Runs the SAME query key `DocumentColumn` already fetches
 * (React Query dedupes by key, so this costs no extra request) separately — a
 * partial failure in one region must not blank the other (`errors.spec` #2).
 * Renders nothing until the page list resolves, rather than a spine drawn
 * against a stale or zero total.
 */
export function OrderCoverageSpine({ orderId }: { orderId: string }) {
  const { data } = useQuery(pagesQuery(orderId));
  return data ? <CoverageSpine coverage={data} /> : null;
}
```

In `DocumentColumn.tsx`, replace the `PageStrip` import and the `CardBody` block at `:89-97`:

```tsx
import { PageSpine } from "../../entities/document/PageSpine";
```
```tsx
      <CardBody className="border-t border-line-subtle">
        {/* The same spine the evidence column draws, here as a control. One
            instrument, one denominator: the strip that listed only served pages
            stated a second, smaller package size on this very pane. */}
        <PageSpine
          totalPages={total}
          pages={pages}
          currentPage={page.n}
          onSelect={setOverride}
        />
      </CardBody>
```

Delete `PageStrip.tsx` and `PageStrip.stories.tsx`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e --grep "coverage"
```

Expected: `pageCoverage.test.ts` 5 passing, two `PageSpine` stories passing, and review.spec's "coverage spine renders one cell per package page" still asserting `Coverage · all 64 pages` and 64 cells — note the review pane now draws the spine TWICE (evidence column and document column), so if that spec counts `coverage-cell` globally it must be scoped to `getByTestId("coverage-spine")` first. That is a selector rewrite, not a weakened assertion; make it if and only if the count fails.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/document/pageCoverage.ts apps/web-v2/src/entities/document/pageCoverage.test.ts apps/web-v2/src/entities/document/PageSpine.tsx apps/web-v2/src/entities/document/PageSpine.stories.tsx apps/web-v2/src/features/review/CoverageSpine.tsx apps/web-v2/src/features/review/DocumentColumn.tsx apps/web-v2/e2e/invariants/review.spec.ts
git rm apps/web-v2/src/entities/document/PageStrip.tsx apps/web-v2/src/entities/document/PageStrip.stories.tsx
```

```
State one package size on the review pane, not two

The coverage spine drew 64 cells and PageStrip listed 7 chips a scroll apart,
so the pane claimed two different package sizes. One spine now serves both — a
picture in the evidence column, a keyboard-reachable control in the document
column — and the four coverage states move to a pure module with a test that
they never collapse into one grey square.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 10: `ChoiceCardGrid` — one selectable card grid

**Files:**
- Create: `apps/web-v2/src/shared/ui/ChoiceCardGrid.tsx`
- Create: `apps/web-v2/src/shared/ui/ChoiceCardGrid.stories.tsx`
- Delete: `apps/web-v2/src/features/completeness/GapOptionButton.tsx`
- Modify: `apps/web-v2/src/features/completeness/GapCloseOptions.tsx:1-75`

**Interfaces:**
- Consumes: `Button` from `shared/ui/Button`, `cn`.
- Produces:
  ```tsx
  export interface ChoiceOption {
    /** Stable identity, and what `onSelect` reports. */
    value: string;
    title: string;
    /** The consequence line — what choosing this does to the record. */
    sub: ReactNode;
  }
  export interface ChoiceCardGridProps {
    /** The eyebrow over the grid. */
    label: ReactNode;
    options: readonly ChoiceOption[];
    /** `null` until a choice is made. Nothing is ever pre-selected. */
    value: string | null;
    columns: "2" | "3";
    onSelect: (value: string) => void;
  }
  export function ChoiceCardGrid(props: ChoiceCardGridProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/ChoiceCardGrid.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChoiceCardGrid } from "./ChoiceCardGrid";

const meta = {
  title: "UI/ChoiceCardGrid",
  component: ChoiceCardGrid,
} satisfies Meta<typeof ChoiceCardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { value: "upload", title: "Add the missing documents", sub: "Needs a reason — it is recorded on the order." },
  { value: "amend", title: "Amend the sign-off answer", sub: "Needs a reason — it is recorded on the order." },
  { value: "root", title: "Assert root of title", sub: "Needs a reason — it is recorded on the order." },
];

/** Nothing is pre-selected, and choosing reports the value, not the label. */
export const NothingChosen: Story = {
  args: { label: "Close it one of three ways", options, value: null, columns: "3", onSelect: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const picked: string[] = [];
    args.onSelect = (value: string) => picked.push(value);
    const cards = await canvas.findAllByRole("button");
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(card).toHaveAttribute("aria-pressed", "false");
    const second = cards[1];
    if (second) await userEvent.click(second);
    expect(picked).toEqual(["amend"]);
  },
};

/** The chosen card is the only one pressed — the selection is announced. */
export const Chosen: Story = {
  args: { label: "Close it one of three ways", options, value: "root", columns: "3", onSelect: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pressed = (await canvas.findAllByRole("button")).filter(
      (card) => card.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("Assert root of title");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./ChoiceCardGrid" from "src/shared/ui/ChoiceCardGrid.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/ChoiceCardGrid.tsx`:

```tsx
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Eyebrow } from "./Eyebrow";
import { cn } from "./classNames";

/**
 * A grid of cards, one of which may be chosen.
 *
 * RULE: THE SECOND LINE IS THE POINT. Every option carries what it does to the
 * record at the moment of choosing, not in a confirmation afterwards. FAILURE
 * PREVENTED: a person picking the cheap-sounding option and learning what it
 * cost from a dialog they have already decided to dismiss.
 *
 * NOTHING IS EVER PRE-SELECTED. `value` starts null and the caller keeps it
 * null until a person acts — a highlighted default is the screen making a
 * recommendation nothing behind it made.
 *
 * SELECTION IS ANNOUNCED, not merely coloured: each card is a real button with
 * `aria-pressed`, so the choice is available to a screen reader and to the
 * keyboard, which a coloured `<div>` is not.
 */
export interface ChoiceOption {
  /** Stable identity, and what `onSelect` reports. */
  value: string;
  title: string;
  /** The consequence line — what choosing this does to the record. */
  sub: ReactNode;
}

export interface ChoiceCardGridProps {
  /** The eyebrow over the grid. */
  label: ReactNode;
  options: readonly ChoiceOption[];
  /** `null` until a choice is made. */
  value: string | null;
  columns: "2" | "3";
  onSelect: (value: string) => void;
}

export function ChoiceCardGrid({ label, options, value, columns, onSelect }: ChoiceCardGridProps) {
  return (
    <div>
      <Eyebrow variant="field" as="p" className="mb-4">
        {label}
      </Eyebrow>

      <div className={cn("grid gap-5", columns === "2" ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {options.map((option) => {
          const chosen = option.value === value;
          return (
            <Button
              key={option.value}
              tone={chosen ? "action" : "neutral"}
              fill={chosen ? "tinted" : "outlined"}
              aria-pressed={chosen}
              onClick={() => onSelect(option.value)}
              className="flex-col items-start gap-1 rounded-7 border-(length:--stroke-emphasis) px-7 py-6 text-left"
            >
              <span
                className={cn(
                  "text-base font-semibold",
                  chosen ? "text-action-ink" : "text-ink-primary",
                )}
              >
                {option.title}
              </span>
              <span className="text-xs font-normal text-ink-secondary">{option.sub}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
```

`GapCloseOptions.tsx` keeps both of its doc paragraphs (the server-owns-the-list rule and the COUNT_WORD reasoning) and swaps the button row for the grid:

```tsx
import { useState } from "react";
import { ChoiceCardGrid } from "../../shared/ui/ChoiceCardGrid";
import { GapClosureForm } from "./GapClosureForm";
```
```tsx
      <ChoiceCardGrid
        label={
          options.length === 1
            ? "One way to close it"
            : `Close it one of ${COUNT_WORD[options.length] ?? options.length} ways`
        }
        options={options.map((option) => ({ value: option, title: option, sub: CONSEQUENCE }))}
        value={chosen}
        columns={options.length > 2 ? "3" : "2"}
        onSelect={setChosen}
      />
```

The `Eyebrow` import is no longer needed there — the grid owns its label. Delete `GapOptionButton.tsx`; its `tone`/`disabled` axes had no caller, and its CONTRACT GAP note about un-ranked options already lives on `GapCloseOptions`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "routes"
```

Expected: two `ChoiceCardGrid` stories passing; `/completeness` route smoke green and its gap-closure flow unchanged.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/ui/ChoiceCardGrid.tsx apps/web-v2/src/shared/ui/ChoiceCardGrid.stories.tsx apps/web-v2/src/features/completeness/GapCloseOptions.tsx
git rm apps/web-v2/src/features/completeness/GapOptionButton.tsx
```

```
Make the selectable card grid one component

The gap's close options were a bespoke button stranded inside the completeness
feature, with a tone axis and a disabled arm nothing used, while upload needs
the same grid twice for its client and product cards. One grid now owns the
pattern: nothing pre-selected, the consequence on every card, and the choice
announced through aria-pressed rather than colour alone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 11: `QuietState` — resolved and empty, and that is the good outcome

**Files:**
- Create: `apps/web-v2/src/shared/ui/QuietState.tsx`
- Create: `apps/web-v2/src/shared/ui/QuietState.stories.tsx`
- Modify: `apps/web-v2/src/features/escalations/EscalationsScreen.tsx:47-49`
- Modify: `apps/web-v2/src/features/delivered/DeliveredScreen.tsx:59-67`

**Interfaces:**
- Consumes: `Card`, `CardBody`, `cn` from `shared/ui`.
- Produces:
  ```tsx
  export interface QuietStateProps {
    /** `settled` is good news; `action` is "nothing here yet, and that is fine". */
    tone: "settled" | "action";
    headline: string;
    children: ReactNode;
    /** Preserves a screen's existing test hook. */
    testId?: string;
  }
  export function QuietState(props: QuietStateProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/QuietState.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { QuietState } from "./QuietState";

const meta = {
  title: "UI/QuietState",
  component: QuietState,
} satisfies Meta<typeof QuietState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Good news, said as good news — and the headline leads. */
export const NothingWaiting: Story = {
  args: {
    tone: "settled",
    headline: "Nothing assigned, nothing waiting on you.",
    children: "That's the good outcome — take the next order when you're ready.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      await canvas.findByText("Nothing assigned, nothing waiting on you."),
    ).toBeInTheDocument();
    expect(await canvas.findByText(/take the next order/)).toBeInTheDocument();
  },
};

/** A screen's existing test hook survives the adoption. */
export const WithTestId: Story = {
  args: {
    tone: "action",
    headline: "Order ord_demo_9 has no delivered report yet.",
    children: "Nothing has been sent to the client on this order.",
    testId: "nothing-delivered",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("nothing-delivered")).toHaveTextContent(
      "no delivered report yet",
    );
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./QuietState" from "src/shared/ui/QuietState.stories.tsx"`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/QuietState.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, CardBody } from "./Card";
import { cn } from "./classNames";

/**
 * A screen that resolved to nothing, saying so as a sentence a person can read.
 *
 * RULE: this means RESOLVED AND EMPTY, never NOT LOADED. FAILURE PREVENTED: a
 * bare grey line, indistinguishable from a pane that failed silently — the same
 * blank-screen failure `ScreenFailure` exists to prevent, arriving through the
 * happy path instead.
 *
 * IT IS NOT `EmptyPanel`. That one is the dashed "nothing here yet" placeholder
 * for a region waiting to be filled; this one is a finished answer, with a
 * headline that leads and an explanation under it, and the design gives it a
 * filled disc rather than a dashed outline for exactly that reason.
 *
 * NO COUNT, NO RATE. "Nothing waiting on you" is the whole content; a number
 * beside it would be a backlog to burn down (§4.5).
 */
export interface QuietStateProps {
  /** `settled` is good news; `action` is "nothing here yet, and that is fine". */
  tone: "settled" | "action";
  headline: string;
  children: ReactNode;
  /** Preserves a screen's existing test hook. */
  testId?: string;
}

export function QuietState({ tone, headline, children, testId }: QuietStateProps) {
  return (
    <Card {...(testId === undefined ? {} : { "data-testid": testId })}>
      <CardBody className="flex items-center gap-7">
        <span
          aria-hidden
          className={cn(
            "flex size-13 shrink-0 items-center justify-center rounded-pill text-md",
            tone === "settled"
              ? "bg-state-settled-surface text-state-settled-ink"
              : "bg-action-surface text-action-ink",
          )}
        >
          {tone === "settled" ? "✓" : "·"}
        </span>
        <p className="text-base leading-body text-ink-secondary">
          <span className="font-semibold text-ink-primary">{headline}</span> {children}
        </p>
      </CardBody>
    </Card>
  );
}
```

In `EscalationsScreen.tsx`, replace the bare sentence at `:47-49`:

```tsx
  if (current === undefined) {
    return (
      <QuietState tone="settled" headline="No escalations. Nobody is stuck.">
        A reviewer opens one of these when they do not know the rule; an empty
        inbox means nobody is waiting on an answer.
      </QuietState>
    );
  }
```

In `DeliveredScreen.tsx`, replace `:59-67`, keeping the `nothing-delivered` hook and the "say which order and say why" reasoning as the component's own comment at the call site:

```tsx
  // A blank would read as "delivered, nothing to show" — the same silent-blank
  // failure `ScreenFailure` exists to prevent. Say which order and say why.
  if (record === null) {
    return (
      <QuietState
        tone="action"
        testId="nothing-delivered"
        headline={
          orderId === undefined
            ? "No delivered report yet."
            : `Order ${orderId} has no delivered report yet.`
        }
      >
        Nothing has been sent to the client on this order.
      </QuietState>
    );
  }
```

If `size-13` (26px) is not an emitted utility, use the nearest emitted size and record the substitution in the component's doc — grep the built CSS rather than assuming (§6 trap).

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook && pnpm --filter web-v2 test:e2e --grep "escalations|delivered|routes"
```

Expected: two `QuietState` stories passing; the `nothing-delivered` testid still found by whatever asserts it, and both route smoke tests green.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/shared/ui/QuietState.tsx apps/web-v2/src/shared/ui/QuietState.stories.tsx apps/web-v2/src/features/escalations/EscalationsScreen.tsx apps/web-v2/src/features/delivered/DeliveredScreen.tsx
```

```
Say "resolved and empty" as a sentence, not as a grey line

Three screens answered "there is nothing here" with a bare paragraph that reads
exactly like a pane which failed silently. QuietState gives the answer a filled
disc, a headline that leads and an explanation under it — the design's own
treatment — and keeps it distinct from EmptyPanel, which means a region waiting
to be filled rather than a question already answered.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## The Reader A/B collapse — what it is, and how provenance survives it

Tasks 12–16 carry the owner's ruling of 2026-07-30 (D4): **collapse to the export's
single `As read` row as the resting state, with per-engine attribution and the diff
behind a disclosure on the card.** The strings `READER A`, `use this reading` and
`Both readers agree` appear **nowhere** in the 3,779-line export
(`grep -icn "READER A\|use this reading\|Both readers agree" TitlePipe.dc.html` → 0),
and the card being short is what makes the export's sticky footer work at all.

**Principle 6 — never emit a value you cannot cite — survives it, and here is exactly how:**

1. The resting `As read` row carries the value's **page chip** beside it. There is no
   arm of `AsReadRow` that renders a bare value: the value with no page renders
   `FieldValue`'s NO PROVENANCE alert instead (Task 13).
2. `DecisionRow` keeps its `NO PROVENANCE` chip, unchanged, so an uncitable value is
   already marked before the card opens (`review.spec` #2).
3. The disclosure holds the **complete** attribution — engine id, the exact snippet,
   the page, and the coordinates pin — and it is present on **every** card, not only
   when the engines disagree. Nothing is dropped; one click moves.
4. The disclosure's summary states the **reader count in the resting state**, so the
   fact that N independent readers exist is visible without opening it. A collapse
   that hid the existence of attribution would fail principle 6; one that hides its
   detail does not.
5. `review.spec` #3 (both readings attributed), `review.spec` #10 (the coordinates
   pin) and `ux.spec` #2/#3 (the diff, adopt-without-retyping) all keep their
   assertions **byte for byte**. Task 15 adds one `click` to open the disclosure
   first. That is a selector/interaction rewrite, which the spec headers permit; no
   assertion is weakened.

**Two conflicts to record in `docs/frontend/conflicts.md` as part of Task 15**, because
they are places this app deliberately keeps something the export does not draw:

- `THEY DISAGREE. THAT IS WHY IT IS YOURS.` is held by `review.spec` #3's sibling
  assertion and states a fact the export has no equivalent for. It stays, inside the
  disclosure.
- `READER B LINE — <engine>` is held by `review.spec` #10. The export draws no pin at
  all, so the wording is this build's, already flagged as invented in the component it
  moves from. The seat letter survives **only** in the pin; the per-reader card
  headers that made "Reader A" a visible label go.

---

### Task 12: The attribution disclosure

**Files:**
- Create: `apps/web-v2/src/entities/field/diff.ts` (moved from `features/review/diff.ts`, unchanged)
- Create: `apps/web-v2/src/entities/field/ReadingPin.tsx` (moved from `features/review/SourcePin.tsx`)
- Modify: `apps/web-v2/src/entities/field/EngineReadings.tsx:1-75` (whole file)
- Modify: `apps/web-v2/src/entities/field/EngineReadings.stories.tsx`
- Delete: `apps/web-v2/src/features/review/diff.ts`
- Delete: `apps/web-v2/src/features/review/SourcePin.tsx`

**Interfaces:**
- Consumes: `PageChip`, `Eyebrow`, `Button`; `toEvidenceBoxes` and `EvidenceOverlay` from `entities/document`.
- Produces:
  ```tsx
  // entities/field/EngineReadings.tsx
  export interface Reading {
    id: string;
    /** The engine that produced it. Never anonymous. */
    engineId: string;
    value: string | null;
    page: number | null;
    snippet: string | null;
    /** Line coordinates exactly as the server sent them; `ReadingPin` judges them. */
    coords: unknown;
  }
  export interface EngineReadingsProps {
    readings: readonly Reading[];
    /** The disagreement fact, computed by the caller from `enginesDisagree`. */
    disagree: boolean;
    /** Which reading's line is pinned open, or null. */
    pinnedId: string | null;
    onPin: (reading: Reading, seat: string) => void;
    onAdopt: (value: string) => void;
  }
  export function EngineReadings(props: EngineReadingsProps): ReactElement | null;

  // entities/field/ReadingPin.tsx
  export function ReadingPin(props: { seat: string; engineId: string; page: number | null; coords: unknown }): ReactElement;
  ```
  Testids preserved exactly: `use-${engineId}`, `diff-hl`. New: `attribution-toggle` on the `<summary>`.

- [ ] **Step 1: Write the failing test**

Replace `apps/web-v2/src/entities/field/EngineReadings.stories.tsx` entirely:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { EngineReadings, type Reading } from "./EngineReadings";

const meta = {
  title: "Field/EngineReadings",
  component: EngineReadings,
} satisfies Meta<typeof EngineReadings>;

export default meta;
type Story = StoryObj<typeof meta>;

const readings: Reading[] = [
  { id: "r1", engineId: "gemini-2.5-flash", value: "SOUTHSTONE MORTGAGE", page: 7, snippet: "…SOUTHSTONE MORTGAGE, a Delaware…", coords: null },
  { id: "r2", engineId: "llmwhisperer-hq", value: "S0UTHST0NE MORTGAGE", page: 7, snippet: null, coords: null },
];

/**
 * RESTING: the attribution is CLOSED, and the summary still says how many
 * readers there are — a collapse that hid the existence of attribution would
 * fail principle 6; hiding its detail does not.
 */
export const Resting: Story = {
  args: { readings, disagree: true, pinnedId: null, onPin: () => {}, onAdopt: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByTestId("attribution-toggle");
    expect(toggle).toHaveTextContent("2 readers");
    // the export contains none of these strings, and neither does this card
    expect(canvasElement.textContent).not.toContain("Reader A");
    expect(canvasElement.textContent).not.toContain("Both readers agree");
    expect(canvasElement.textContent).not.toContain("use this reading");
  },
};

/** OPENED: engine ids, the per-character diff, and adopt without retyping. */
export const Opened: Story = {
  args: { readings, disagree: true, pinnedId: null, onPin: () => {}, onAdopt: () => {} },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("attribution-toggle"));

    expect(await canvas.findByText("THEY DISAGREE. THAT IS WHY IT IS YOURS.")).toBeInTheDocument();
    expect(await canvas.findByText("gemini-2.5-flash")).toBeInTheDocument();
    expect(await canvas.findByText("llmwhisperer-hq")).toBeInTheDocument();
    expect((await canvas.findAllByTestId("diff-hl")).length).toBeGreaterThan(0);

    const adopted: string[] = [];
    args.onAdopt = (value: string) => adopted.push(value);
    await userEvent.click(await canvas.findByTestId("use-gemini-2.5-flash"));
    expect(adopted).toEqual(["SOUTHSTONE MORTGAGE"]);
  },
};

/** AGREEING: no disagreement sentence, and no banned "both readers agree". */
export const Agreeing: Story = {
  args: {
    readings: readings.map((r) => ({ ...r, value: "SOUTHSTONE MORTGAGE" })),
    disagree: false,
    pinnedId: null,
    onPin: () => {},
    onAdopt: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("attribution-toggle"));
    expect(canvas.queryByText("THEY DISAGREE. THAT IS WHY IT IS YOURS.")).toBeNull();
    expect(
      await canvas.findByText(/Queued on scan quality, not on a disagreement/),
    ).toBeInTheDocument();
  },
};

/** PINNED: the reader's line, named by seat — the wording review.spec pins. */
export const Pinned: Story = {
  args: { readings, disagree: true, pinnedId: "r2", onPin: () => {}, onAdopt: () => {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("attribution-toggle"));
    expect(await canvas.findByText(/READER B LINE — llmwhisperer-hq/)).toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Unable to find an element by: [data-testid="attribution-toggle"]` on `Resting`, and `TypeError: Cannot read properties of undefined` where the story passes `disagree`/`pinnedId` to the old signature.

- [ ] **Step 3: Implement**

1. `git mv apps/web-v2/src/features/review/diff.ts apps/web-v2/src/entities/field/diff.ts` — no import changes inside it.

2. `git mv apps/web-v2/src/features/review/SourcePin.tsx apps/web-v2/src/entities/field/ReadingPin.tsx`, rename the export to `ReadingPin`, repoint its two imports to `../document/…`, and add to its doc:

```
 * IT KEEPS ITS SEAT LETTER, AND THAT IS A RECORDED CONFLICT. The export draws
 * no pin at all, so `READER B LINE — <engine>` is this build's wording;
 * `review.spec` #10 asserts it, and an invariant is not weakened to match a
 * screen the design never drew. The seat survives HERE and nowhere else — the
 * per-reader card headings that made "Reader A" a visible label are gone.
```

3. Replace `apps/web-v2/src/entities/field/EngineReadings.tsx`:

```tsx
import { ReadingLine } from "./ReadingLine";
import { ReadingPin } from "./ReadingPin";

/**
 * WHERE THE READING CAME FROM — attribution, behind a disclosure.
 *
 * RULE (owner ruling D4, 2026-07-30): the card shows the reading ONCE, as the
 * export does, and the per-engine attribution lives one click away. FAILURE
 * PREVENTED: a decision card ~230px in the export stood at three times that
 * here, which is why the export's sticky footer had nowhere to stick — the
 * reviewer's job is the question, and the ensemble is the evidence for it.
 *
 * PRINCIPLE 6 SURVIVES THE COLLAPSE, DELIBERATELY. The summary states the
 * reader count in the RESTING state, so the existence of independent readings
 * is never hidden; the disclosure holds the whole citation — engine id, exact
 * snippet, page, coordinates — and it is present on every card, agreeing or
 * not. Hiding the detail is a collapse; hiding the existence would be a lie.
 *
 * NEITHER READING IS PRE-SELECTED. The moment one is highlighted as the default
 * the screen is making a recommendation the backend never made (§7). NO
 * CONFIDENCE IS SHOWN: engine self-report is not evidence and must never read
 * as endorsement.
 *
 * ADOPT WITHOUT RETYPING (`ux.spec` #3). Typing "$166,097.00" out of one pane
 * and into another is a transcription step, and transcription steps produce
 * exactly the class of defect this screen exists to catch.
 */
const SEAT = ["A", "B", "C", "D"] as const;

export interface Reading {
  id: string;
  /** The engine that produced it. Never anonymous. */
  engineId: string;
  value: string | null;
  page: number | null;
  snippet: string | null;
  /** Line coordinates exactly as the server sent them; `ReadingPin` judges them. */
  coords: unknown;
}

export interface EngineReadingsProps {
  readings: readonly Reading[];
  /** The disagreement fact, computed by the caller from `enginesDisagree`. */
  disagree: boolean;
  /** Which reading's line is pinned open, or null. */
  pinnedId: string | null;
  onPin: (reading: Reading, seat: string) => void;
  onAdopt: (value: string) => void;
}

export function EngineReadings({ readings, disagree, pinnedId, onPin, onAdopt }: EngineReadingsProps) {
  if (readings.length === 0) return null;

  return (
    <details className="rounded-7 border border-line-strong bg-surface-app">
      <summary
        data-testid="attribution-toggle"
        className="cursor-pointer px-6 py-4 text-xs font-semibold text-ink-secondary"
      >
        Where this reading came from · {readings.length} readers
      </summary>

      <div className="flex flex-col gap-4 border-t border-line-subtle px-6 py-5">
        {disagree ? (
          /* Upper-case in the MARKUP: `review.spec` #3 matches it
             case-sensitively, and a CSS transform does not change what the text
             says. Recorded in conflicts.md — the export has no equivalent. */
          <p className="text-xs font-semibold text-state-attend-ink">
            THEY DISAGREE. THAT IS WHY IT IS YOURS.
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            Queued on scan quality, not on a disagreement.
          </p>
        )}

        <ul className="flex flex-col gap-4">
          {readings.map((reading, index) => {
            const seat = SEAT[index] ?? String(index + 1);
            const other = readings[index === 0 ? 1 : 0]?.value ?? "";
            return (
              <li key={reading.id} className="flex flex-col gap-2">
                <ReadingLine
                  reading={reading}
                  seat={seat}
                  other={other}
                  onPin={onPin}
                  onAdopt={onAdopt}
                />
                {pinnedId === reading.id ? (
                  <ReadingPin
                    seat={seat}
                    engineId={reading.engineId}
                    page={reading.page}
                    coords={reading.coords}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
```

4. `apps/web-v2/src/entities/field/ReadingLine.tsx` — the per-reading row, split out because `EngineReadings` would otherwise pass 150 lines:

```tsx
import { diffChars } from "./diff";
import { PageChip } from "./PageChip";
import { Button } from "../../shared/ui/Button";
import type { Reading } from "./EngineReadings";

/**
 * One reader's answer, attributed.
 *
 * THE ENGINE ID IS THE ATTRIBUTION AND IT IS A BUTTON — clicking it pins that
 * reader's line on the page. RULE: a citation a reviewer has to go and find is
 * a citation they stop checking by Thursday, so it costs one click.
 *
 * THE DIFFERING CHARACTERS ARE MARKED. "SOUTHSTONE" against "S0UTHST0NE" is
 * three substitutions in twenty-three characters, and a reviewer comparing them
 * by eye at speed will pass it. FAILURE PREVENTED: proofreading, which people
 * are bad at, standing in for looking, which they are good at.
 *
 * A READING WITH NO VALUE SAYS SO and offers no adopt button — there is nothing
 * to adopt, and a button that fills a field with "" is worse than none.
 */
export function ReadingLine({
  reading,
  seat,
  other,
  onPin,
  onAdopt,
}: {
  reading: Reading;
  seat: string;
  /** The other reader's value, for the diff. */
  other: string;
  onPin: (reading: Reading, seat: string) => void;
  onAdopt: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-5 border border-line-subtle bg-surface-panel px-5 py-4">
      <button
        type="button"
        onClick={() => onPin(reading, seat)}
        className="font-mono text-micro font-bold tracking-badge text-action uppercase underline"
      >
        {reading.engineId}
      </button>

      <span className="min-w-0 flex-1">
        {reading.value === null ? (
          <span className="font-mono text-base text-ink-muted">— nothing returned</span>
        ) : (
          <span className="font-mono text-base text-ink-primary">
            {diffChars(reading.value, other).map((part, index) =>
              part.differs ? (
                <mark
                  key={index}
                  data-testid="diff-hl"
                  className="bg-state-attend-surface text-state-attend-ink"
                >
                  {part.char}
                </mark>
              ) : (
                <span key={index}>{part.char}</span>
              ),
            )}
          </span>
        )}
      </span>

      {reading.page === null ? null : <PageChip page={reading.page} />}

      {reading.value === null ? null : (
        <Button
          size="sm"
          fill="tinted"
          tone="action"
          data-testid={`use-${reading.engineId}`}
          onClick={() => onAdopt(reading.value ?? "")}
        >
          Use this
        </Button>
      )}

      {reading.snippet === null ? null : (
        <p className="w-full font-quote text-xs italic text-ink-secondary">{reading.snippet}</p>
      )}
    </div>
  );
}
```

`ReadingLine` imports the `Reading` type from `EngineReadings` while `EngineReadings` imports the component from `ReadingLine` — a type-only cycle, which `erasableSyntaxOnly` erases at build time. If the bundler objects, move `Reading` into `entities/field/reading.ts` and have both import it from there; do not duplicate the interface.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook
```

Expected: four `EngineReadings` stories passing, including the three banned strings absent from the resting card.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

`knip` will report `EngineReadings`, `ReadingLine`, `ReadingPin` and `diff` as unused until Task 15 wires the card in. That is expected inside this task and must be green by the end of Task 15 — do not silence it, and do not stop the wave here.

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/field/diff.ts apps/web-v2/src/entities/field/ReadingPin.tsx apps/web-v2/src/entities/field/ReadingLine.tsx apps/web-v2/src/entities/field/EngineReadings.tsx apps/web-v2/src/entities/field/EngineReadings.stories.tsx
git rm apps/web-v2/src/features/review/diff.ts apps/web-v2/src/features/review/SourcePin.tsx
```

```
Put the per-engine attribution behind a disclosure on the card

Owner ruling D4: the reading shows once, as the export draws it, and the
attribution moves one click away — READER A, "use this reading" and "Both
readers agree" appear nowhere in the 3,779-line export, and the card being
short is what makes the export's sticky footer work. The summary still states
the reader count while closed, so principle 6 loses nothing: the existence of
independent readings stays visible and the whole citation — engine, snippet,
page, coordinates pin — is one click, on every card, agreeing or not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 13: `AsReadRow` and the export's decision card

**Files:**
- Create: `apps/web-v2/src/entities/field/AsReadRow.tsx`
- Modify: `apps/web-v2/src/entities/field/DecisionCard.tsx:1-132` (whole file)
- Modify: `apps/web-v2/src/entities/field/DecisionCard.stories.tsx`

**Interfaces:**
- Consumes: `Reading`, `EngineReadings` (Task 12); `FieldValue` and its `Provenance`; `Chip`, `Eyebrow`, `Card`, `PageChip`.
- Produces:
  ```tsx
  // AsReadRow.tsx
  export interface AsReadRowProps {
    /** "As read", or "You claimed" when the field came from the sign-off. */
    caption: string;
    /** The settled value, or null when nothing has been merged. */
    value: string | null;
    /** Page + snippet. `null` means none exists — which is an error, not an omission. */
    provenance: Provenance | null;
    /** The leading reading when nothing is settled and the engines disagree. */
    draft?: string;
    onViewSource?: ((page: number) => void) | undefined;
  }
  export function AsReadRow(props: AsReadRowProps): ReactElement;

  // DecisionCard.tsx
  export interface DecisionField { section: string; label: string; asking?: string; why?: string; page: number | null }
  export interface DecisionStatus { state: DecisionState; label: string; /** "Flagged" | "Claim vs page" */ flagWord: string }
  export interface DecisionCardProps {
    field: DecisionField;
    status: DecisionStatus;
    reading: AsReadRowProps;
    readings: readonly Reading[];
    disagree: boolean;
    pinnedId: string | null;
    onPin: (reading: Reading, seat: string) => void;
    onAdopt: (value: string) => void;
    /** The docked bar, or the role's refusal note. Given, never decided here. */
    footer: ReactNode;
    children?: ReactNode;
  }
  export function DecisionCard(props: DecisionCardProps): ReactElement;
  ```
  Testids: `sel-label` on the field label, `sel-state` on the status chip — the two `review.spec`, `ux.spec`, `sidebar.spec` and `navigation.spec` all assert.

- [ ] **Step 1: Write the failing test**

Replace `apps/web-v2/src/entities/field/DecisionCard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DecisionCard } from "./DecisionCard";
import type { Reading } from "./EngineReadings";

const meta = {
  title: "Field/DecisionCard",
  component: DecisionCard,
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const readings: Reading[] = [
  { id: "r1", engineId: "gemini-2.5-flash", value: "MARIA L. ESTRADA", page: 3, snippet: null, coords: null },
  { id: "r2", engineId: "llmwhisperer-hq", value: "MARIA I. ESTRADA", page: 3, snippet: null, coords: null },
];

const field = {
  section: "Vesting",
  label: "OWNER ZIP",
  asking: "Is the vested owner MARIA L. ESTRADA or MARIA I. ESTRADA?",
  why: "Two independent readers disagreed on the middle initial.",
  page: 3,
};

/** The resting card: question first, then ONE value row, then the disclosure. */
export const Settled: Story = {
  args: {
    field,
    status: { state: "pending", label: "NEEDS REVIEW", flagWord: "Flagged" },
    reading: {
      caption: "As read",
      value: "MARIA L. ESTRADA",
      provenance: { page: 3, snippet: "MARIA L. ESTRADA, an unmarried woman," },
    },
    readings,
    disagree: true,
    pinnedId: null,
    onPin: () => {},
    onAdopt: () => {},
    footer: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("sel-label")).toHaveTextContent("OWNER ZIP");
    expect(await canvas.findByTestId("sel-state")).toHaveTextContent("NEEDS REVIEW");
    expect(await canvas.findByText("As read")).toBeInTheDocument();
    // ONE value row: the value appears once in the resting card, not per engine
    expect(canvas.getAllByText("MARIA L. ESTRADA")).toHaveLength(1);
    expect(await canvas.findByText("Flagged")).toBeInTheDocument();
  },
};

/** Both engines found something and disagreed: the draft leads, LABELLED. */
export const DisagreementDraft: Story = {
  args: {
    field,
    status: { state: "pending", label: "ENGINES DISAGREE — NOTHING SETTLED", flagWord: "Flagged" },
    reading: {
      caption: "As read",
      value: null,
      provenance: { page: 3, snippet: "MARIA L. ESTRADA, an unmarried woman," },
      draft: "MARIA L. ESTRADA",
    },
    readings,
    disagree: true,
    pinnedId: null,
    onPin: () => {},
    onAdopt: () => {},
    footer: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // ux.spec #1: never claim emptiness while two candidates sit in the payload
    expect(await canvas.findByText("draft — nothing settled yet")).toBeInTheDocument();
    expect(canvas.queryByText(/extraction returned nothing at all/)).toBeNull();
  },
};

/** A value with no provenance is a hard error, never a bare value. */
export const NoProvenance: Story = {
  args: {
    field,
    status: { state: "pending", label: "NEEDS REVIEW", flagWord: "Flagged" },
    reading: { caption: "As read", value: "MARIA L. ESTRADA", provenance: null },
    readings: [],
    disagree: false,
    pinnedId: null,
    onPin: () => {},
    onAdopt: () => {},
    footer: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByRole("alert")).toHaveTextContent("NO PROVENANCE");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: type errors first (`Object literal may only specify known properties, and 'reading' does not exist in type …`), then `Unable to find an element by: [data-testid="sel-label"]`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/entities/field/AsReadRow.tsx`:

```tsx
import { FieldValue, type Provenance } from "./FieldValue";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE ONE VALUE ROW — the export's single sunken `As read` line (`:880-883`).
 *
 * RULE: the reading appears ONCE on a resting card. FAILURE PREVENTED: a card
 * that printed the value again per engine, three times the export's height,
 * with the question it exists to ask pushed off the top.
 *
 * NEVER A BARE VALUE. `provenance: null` is rendered by `FieldValue` as a hard
 * error, not as an ordinary value (principle 6, `review.spec` #2) — which is
 * why `provenance` is required-but-nullable rather than optional: a caller
 * cannot omit it by accident, it has to SAY there is none.
 *
 * A BOTH-FOUND DISAGREEMENT NEVER CLAIMS EMPTINESS (`ux.spec` #1). Two engines
 * returned values and the merge did not settle, so the leading reading shows AS
 * A DRAFT, labelled. Rendering "Not Available" here would tell the reviewer
 * there is nothing to look at while two candidates sit in the payload.
 *
 * `caption` is the export's own switch: "As read" for a machine reading, "You
 * claimed" when the flag came from the sign-off (`:3084`). It is the caller's
 * word, because only the caller knows where the field came from.
 */
export interface AsReadRowProps {
  caption: string;
  /** The settled value, or null when nothing has been merged. */
  value: string | null;
  /** `null` means none exists — which is an error, not an omission. */
  provenance: Provenance | null;
  /** The leading reading when nothing is settled and the engines disagree. */
  draft?: string;
  onViewSource?: ((page: number) => void) | undefined;
}

export function AsReadRow({ caption, value, provenance, draft, onViewSource }: AsReadRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-7 border border-line-strong bg-surface-app px-6 py-5">
      <Eyebrow variant="caption">{caption}</Eyebrow>

      {value !== null ? (
        <FieldValue value={value} provenance={provenance} onViewSource={onViewSource} />
      ) : draft !== undefined ? (
        <span className="flex flex-wrap items-center gap-4">
          <FieldValue value={draft} provenance={provenance} onViewSource={onViewSource} />
          <span className="text-xs text-state-attend-ink">draft — nothing settled yet</span>
        </span>
      ) : (
        <span className="text-base text-ink-secondary">
          Nothing has been merged for this field.
        </span>
      )}
    </div>
  );
}
```

`FieldValue`'s `onViewSource` is currently typed `onViewSource?: (page: number) => void`; widen it to `((page: number) => void) | undefined` so `exactOptionalPropertyTypes` lets it be forwarded, matching `PageChip`'s existing declaration.

`apps/web-v2/src/entities/field/DecisionCard.tsx` — replace the whole file:

```tsx
import type { ReactNode } from "react";
import { AsReadRow, type AsReadRowProps } from "./AsReadRow";
import { EngineReadings, type Reading } from "./EngineReadings";
import { PageChip } from "./PageChip";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The reviewer's unit of work, in the export's own arrangement (`:866-900`):
 * section and field, then the QUESTION, then why it was flagged, then one value
 * row, then the attribution behind a disclosure, then the docked actions.
 *
 * RULE: the question comes first and the ensemble comes last. FAILURE
 * PREVENTED: a card that opened with two engine panels made the reviewer's job
 * "compare two machines" when the job is "read the page and answer".
 *
 * `state` AND `label` ARE SERVER-SUPPLIED. §3 forbids deriving status in the
 * browser, and `server-owns-state.spec` pins that confidence never promotes or
 * demotes a field. `flagWord` is the caller's too — the export switches it to
 * "Claim vs page" when the flag came from the sign-off rather than the scan.
 *
 * THE FOOTER IS A SLOT, and that is a permission boundary, not a layout one:
 * whether this reviewer may act at all is a feature's question, so the card
 * takes either the bar or the refusal note and never decides between them.
 */
export type DecisionState = "pending" | "confirmed" | "corrected" | "escalated" | "notparty";

const STATE_TONE = {
  pending: "attend",
  confirmed: "settled",
  corrected: "action",
  escalated: "attend",
  notparty: "settled",
} as const satisfies Record<DecisionState, "attend" | "settled" | "action">;

/**
 * What the reviewer is being asked about.
 *
 * `asking` and `why` are OPTIONAL because the contract does not carry them yet.
 * An absent question is drawn as absent — the field label in the header is then
 * the whole subject — and is never replaced by a sentence this card composed.
 * The call site that has no source for them says so with a `CONTRACT GAP:` note.
 */
export interface DecisionField {
  section: string;
  label: string;
  /** The question put to the reviewer. Server-authored, or absent. */
  asking?: string;
  /** Why this field was flagged. Server-authored, or absent. */
  why?: string;
  page: number | null;
}

/** Server-supplied. Never derived from confidence or from `value === null`. */
export interface DecisionStatus {
  state: DecisionState;
  label: string;
  /** "Flagged", or "Claim vs page" when the flag came from the sign-off. */
  flagWord: string;
}

export interface DecisionCardProps {
  field: DecisionField;
  status: DecisionStatus;
  reading: AsReadRowProps;
  readings: readonly Reading[];
  disagree: boolean;
  pinnedId: string | null;
  onPin: (reading: Reading, seat: string) => void;
  onAdopt: (value: string) => void;
  /** The docked bar, or the role's refusal note. */
  footer: ReactNode;
  /** Whatever an action opened — the correction editor and its siblings. */
  children?: ReactNode;
}

export function DecisionCard({
  field,
  status,
  reading,
  readings,
  disagree,
  pinnedId,
  onPin,
  onAdopt,
  footer,
  children,
}: DecisionCardProps) {
  return (
    <Card accent="action">
      <CardHeader>
        <Eyebrow variant="caption" tone="action">
          {field.section}
        </Eyebrow>
        <span data-testid="sel-label" className="font-mono text-md font-semibold text-ink-primary">
          {field.label}
        </span>
        <Chip data-testid="sel-state" tone={STATE_TONE[status.state]} size="sm" bordered>
          {status.label}
        </Chip>
        {field.page === null ? null : (
          <div className="ml-auto">
            <PageChip page={field.page} />
          </div>
        )}
      </CardHeader>

      <CardBody className="flex flex-col gap-5">
        {field.asking === undefined ? null : (
          <p className="text-md leading-tight font-semibold text-ink-primary">{field.asking}</p>
        )}

        {field.why === undefined ? null : (
          <p className="text-xs leading-body text-ink-secondary">
            <span className="font-bold text-state-attend-ink">{status.flagWord}</span>{" "}
            {field.why}
          </p>
        )}

        <AsReadRow {...reading} />

        <EngineReadings
          readings={readings}
          disagree={disagree}
          pinnedId={pinnedId}
          onPin={onPin}
          onAdopt={onAdopt}
        />

        {children}
      </CardBody>

      {footer}
    </Card>
  );
}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook
```

Expected: three `DecisionCard` stories passing, including "the value appears once".

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

Same standing `knip` note as Task 12: `DecisionCard` and `AsReadRow` have no production call site until Task 15.

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/field/AsReadRow.tsx apps/web-v2/src/entities/field/DecisionCard.tsx apps/web-v2/src/entities/field/DecisionCard.stories.tsx apps/web-v2/src/entities/field/FieldValue.tsx
```

```
Rebuild the decision card around one value row and the question

The export puts the question first and the reading once, in a single sunken
"As read" line; the app printed the value again per engine and stood three
times the height, which is why the sticky footer had nowhere to stick. The card
now follows the export's arrangement — section, field, question, why, one row,
attribution behind the disclosure, docked footer — and the value row still
refuses to draw a value it cannot cite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 14: The docked decision bar, in the export's words

**Files:**
- Modify: `apps/web-v2/src/entities/field/DecisionBar.tsx:1-67` (whole file)
- Modify: `apps/web-v2/src/entities/field/DecisionBar.stories.tsx`

**Interfaces:**
- Consumes: `Button` from `shared/ui/Button`.
- Produces:
  ```tsx
  export interface DecisionBarProps {
    /** "Confirm as read", or "Claim is right" when the flag came from the sign-off. */
    confirmLabel: string;
    onConfirm: () => void;
    onCorrect: () => void;
    onEscalate: () => void;
    /** Identity fields only — excluding a judgment that belongs to another person. */
    onExclude?: (() => void) | undefined;
    onPass: () => void;
  }
  export function DecisionBar(props: DecisionBarProps): ReactElement;
  ```
  Testids preserved exactly from the live `DecisionActions`: `act-confirm`, `act-correct`, `act-escalate`, `act-exclude`, `act-pass`.

- [ ] **Step 1: Write the failing test**

Replace `apps/web-v2/src/entities/field/DecisionBar.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DecisionBar } from "./DecisionBar";

const meta = {
  title: "Field/DecisionBar",
  component: DecisionBar,
} satisfies Meta<typeof DecisionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const handlers = {
  onConfirm: () => {},
  onCorrect: () => {},
  onEscalate: () => {},
  onPass: () => {},
};

/** The export's own button copy, and nothing invented beside it. */
export const ValueField: Story = {
  args: { confirmLabel: "Confirm as read", ...handlers },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("act-confirm")).toHaveTextContent("✓ Confirm as read");
    expect(await canvas.findByTestId("act-correct")).toHaveTextContent("✎ Correct it");
    expect(await canvas.findByTestId("act-escalate")).toHaveTextContent(
      "↗ Can’t decide — escalate",
    );
    expect(await canvas.findByTestId("act-pass")).toHaveTextContent("Pass — say why");
    // No exclude handler was given, so no exclude button exists — absent, not
    // disabled. And no bulk action exists at all, ever.
    expect(canvas.queryByTestId("act-exclude")).toBeNull();
    expect(canvasElement.textContent).not.toMatch(/approve all|accept remaining/i);
  },
};

/** A claim from the sign-off is confirmed in different words (export :3086). */
export const FromSignoff: Story = {
  args: { confirmLabel: "Claim is right", ...handlers },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("act-confirm")).toHaveTextContent("✓ Claim is right");
  },
};

/** An identity field gains the suppression rulebook R13 names. */
export const IdentityField: Story = {
  args: { confirmLabel: "Confirm as read", onExclude: () => {}, ...handlers },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByTestId("act-exclude")).toHaveTextContent("✕ Not our party");
  },
};

/** The key hints are NOT on the screen — they live in the ? map (ruling D6). */
export const NoKeyHintLine: Story = {
  args: { confirmLabel: "Confirm as read", ...handlers },
  play: async ({ canvasElement }) => {
    expect(canvasElement.textContent).not.toContain("Keys:");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Unable to find an element by: [data-testid="act-confirm"]` — the dead bar carries the export's copy but none of the testids, and `confirmLabel` is not a prop it accepts.

- [ ] **Step 3: Implement**

Replace `apps/web-v2/src/entities/field/DecisionBar.tsx`:

```tsx
import { Button } from "../../shared/ui/Button";

/**
 * The reviewer's actions on one field, docked to the bottom of the card.
 *
 * THERE IS NO BULK ACTION HERE AND THERE NEVER WILL BE (§4.4). Approve-all,
 * bulk-confirm and accept-remaining must not exist as components — not
 * disabled, not permission-gated: absent. This bar takes ONE field and offers
 * exactly the decisions a person can make about it.
 *
 * FIVE, NOT THREE. Confirm, correct and escalate leave no way to say "this row
 * is not ours" — and a judgment hit against a different M. Quenby is exactly
 * that; correcting it would file a suppression as a value change, escalating it
 * would ask a senior a question the reviewer has already answered (rulebook
 * R13). Pass-with-reason is real server behaviour with a `min(1)` refusal and
 * fourth-pass auto-escalation, kept over the export, which is stale (ruling D6).
 *
 * NO OPTIMISTIC UPDATE (§4.9). The server's returned state is the truth and a
 * 409 is an ANSWER. These handlers report intent upward and this component
 * renders nothing about the outcome — it cannot, because it does not know it.
 *
 * CORRECT AND ESCALATE OPEN A REQUIRED-COMMENT STEP rather than submitting: a
 * correction needs its reason and an escalation needs its question, and both
 * are refusals that must say why.
 *
 * NO KEY-HINT LINE (ruling D6). The export puts key hints nowhere on a screen;
 * the `?` map is where a keyboard layer is learned, and a legend printed beside
 * the buttons it describes is the same fact stored twice.
 *
 * `confirmLabel` is the caller's word because only the caller knows where the
 * flag came from: the export says "Confirm as read" for a machine reading and
 * "Claim is right" for one raised against the abstractor's own sign-off (:3086).
 */
export interface DecisionBarProps {
  confirmLabel: string;
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  /** Identity fields only — excluding a judgment that belongs to another person. */
  onExclude?: (() => void) | undefined;
  onPass: () => void;
}

export function DecisionBar({
  confirmLabel,
  onConfirm,
  onCorrect,
  onEscalate,
  onExclude,
  onPass,
}: DecisionBarProps) {
  return (
    <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-line-subtle bg-surface-panel px-8 py-5">
      <Button
        size="sm"
        tone="settled"
        fill="outlined"
        data-testid="act-confirm"
        onClick={onConfirm}
      >
        ✓ {confirmLabel}
      </Button>
      <Button size="sm" tone="action" fill="outlined" data-testid="act-correct" onClick={onCorrect}>
        ✎ Correct it
      </Button>
      <Button
        size="sm"
        tone="attend"
        fill="outlined"
        data-testid="act-escalate"
        onClick={onEscalate}
      >
        ↗ Can&rsquo;t decide — escalate
      </Button>
      {onExclude === undefined ? null : (
        <Button size="sm" tone="neutral" fill="outlined" data-testid="act-exclude" onClick={onExclude}>
          ✕ Not our party
        </Button>
      )}
      <Button size="sm" tone="neutral" fill="ghost" data-testid="act-pass" onClick={onPass}>
        Pass — say why
      </Button>
    </div>
  );
}
```

The export's "Correct to" input is **not** moved into this bar. It carries the must-differ refusal (`CorrectEditor`, §11.1: empty or identical to the machine's reading is refused, not recorded), and moving an input with a refusal rule into a presentational bar would put that rule somewhere it cannot be tested. The bar adopts the export's docking and its copy; the editor stays where its refusal is.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test --project storybook
```

Expected: four `DecisionBar` stories passing.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

Same standing `knip` note as Tasks 12–13: wired in Task 15.

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/field/DecisionBar.tsx apps/web-v2/src/entities/field/DecisionBar.stories.tsx
```

```
Dock the decision bar and give it the export's button copy

The dead DecisionBar carried the export's exact wording and the live
DecisionActions did not — "Confirm C" and "Correct E" against "✓ Confirm as
read" and "✎ Correct it" — so adopting the entity is also a copy fix. It takes
the live bar's act-* testids and its pass and exclude arms, drops the on-screen
key legend (the ? map is where a chord is learned), and sticks to the bottom of
the card as the export draws it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 15: Wire Review onto the kit, and delete what it duplicated

**Files:**
- Create: `apps/web-v2/src/features/review/decisionCardProps.ts`
- Create: `apps/web-v2/src/features/review/decisionCardProps.test.ts`
- Modify: `apps/web-v2/src/features/review/DecisionColumn.tsx:1-81` (whole file)
- Modify: `apps/web-v2/src/features/review/FieldsColumn.tsx:2` (the `Pinned` import)
- Modify: `apps/web-v2/src/features/review/ReviewScreen.tsx` (the `Pinned` import)
- Delete: `apps/web-v2/src/features/review/DecisionPanel.tsx`
- Delete: `apps/web-v2/src/features/review/DecisionActions.tsx`
- Delete: `apps/web-v2/src/features/review/ReadingsPanel.tsx`
- Modify: `apps/web-v2/e2e/invariants/review.spec.ts`, `apps/web-v2/e2e/invariants/ux.spec.ts` (open the disclosure; assertions untouched)
- Modify: `docs/frontend/conflicts.md` (the two recorded departures)

**Interfaces:**
- Consumes: `DecisionCard`, `DecisionBar`, `EngineReadings`, `AsReadRow`, `fieldLabel` — all from `entities/field`.
- Produces:
  ```ts
  export interface Pinned { seat: string; reading: FieldReading }
  export function toReadings(field: Field): Reading[];
  export function toDecisionField(field: Field): DecisionField;
  export function toDecisionStatus(field: Field): DecisionStatus;
  export function toAsRead(field: Field): AsReadRowProps;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/features/review/decisionCardProps.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type { Field } from "@titlepipe/contract";
import { toAsRead, toDecisionStatus, toReadings } from "./decisionCardProps";

const field = (over: Partial<Field> = {}): Field => ({
  id: "f1",
  path: "mortgages.1.lender",
  value: null,
  value_raw: null,
  state: "needs_review",
  na_reason: null,
  excluded_reason: null,
  source_doc_id: null,
  source_page: null,
  source_snippet: null,
  source_line_coords: null,
  readings: [],
  ...over,
});

describe("the As-read row cites, or says it cannot", () => {
  test("a page on the field is the citation", () => {
    const row = toAsRead(field({ value: "SOUTHSTONE", source_page: 7, source_snippet: "…" }));
    expect(row.provenance).toEqual({ page: 7, snippet: "…" });
  });

  test("a reading's page stands in when the field carries none", () => {
    // Otherwise the NO PROVENANCE alert would fire on fields that ARE cited,
    // and an alert that cries wolf is an alert people learn to ignore.
    const row = toAsRead(
      field({
        value: "SOUTHSTONE",
        readings: [{ id: "r1", engine_id: "e", value: "SOUTHSTONE", page: 4, snippet: null, line_coords: null }],
      }),
    );
    expect(row.provenance?.page).toBe(4);
  });

  test("no document, no page and no reading is null — a hard error downstream", () => {
    expect(toAsRead(field({ value: "SOUTHSTONE" })).provenance).toBeNull();
  });

  test("a both-found disagreement leads with the draft, never with emptiness", () => {
    const row = toAsRead(
      field({
        readings: [
          { id: "r1", engine_id: "a", value: "SOUTHSTONE", page: 4, snippet: null, line_coords: null },
          { id: "r2", engine_id: "b", value: "S0UTHST0NE", page: 4, snippet: null, line_coords: null },
        ],
      }),
    );
    expect(row.value).toBeNull();
    expect(row.draft).toBe("SOUTHSTONE");
  });
});

describe("the status is the server's, re-labelled and never re-decided", () => {
  test("the label is `stateLabel` verbatim", () => {
    expect(toDecisionStatus(field({ state: "needs_review" })).label).toBe("NEEDS REVIEW");
  });

  test("an excluded field reads as not-our-party, whatever its state says", () => {
    const status = toDecisionStatus(field({ excluded_reason: "different party" }));
    expect(status.state).toBe("notparty");
    expect(status.label).toBe("EXCLUDED — NOT OUR PARTY");
  });

  test("auto-confirmed and confirmed share one display state — neither is pending", () => {
    expect(toDecisionStatus(field({ state: "auto_confirmed" })).state).toBe("confirmed");
    expect(toDecisionStatus(field({ state: "confirmed" })).state).toBe("confirmed");
  });
});

describe("readings keep their engine and their coordinates", () => {
  test("every reading is attributed and carries its line", () => {
    const readings = toReadings(
      field({
        readings: [
          { id: "r1", engine_id: "gemini-2.5-flash", value: "X", page: 4, snippet: "s", line_coords: { a: 1 } },
        ],
      }),
    );
    expect(readings[0]?.engineId).toBe("gemini-2.5-flash");
    expect(readings[0]?.coords).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project gates
```

Expected: `Failed to load url ./decisionCardProps (resolved id: …/src/features/review/decisionCardProps) … does not exist`.

- [ ] **Step 3: Implement**

`apps/web-v2/src/features/review/decisionCardProps.ts`:

```ts
import type { Field, FieldReading } from "@titlepipe/contract";
import type { AsReadRowProps } from "../../entities/field/AsReadRow";
import type { DecisionField, DecisionState, DecisionStatus } from "../../entities/field/DecisionCard";
import type { Reading } from "../../entities/field/EngineReadings";
import {
  enginesDisagree,
  fieldLabel,
  isExcluded,
  readingsOf,
  stateLabel,
} from "../../entities/field/fieldLabel";

/** Which reading's line the reviewer pinned, and which seat it was drawn as. */
export interface Pinned {
  seat: string;
  reading: FieldReading;
}

/**
 * The wire's `Field` translated into what the decision card draws.
 *
 * RULE: translation, never derivation. FAILURE PREVENTED: the card and the row
 * disagreeing about the same field, which is what happened when three files
 * each answered "do the engines disagree" for themselves. Every value here
 * comes from the server or from `fieldLabel`'s single implementation — nothing
 * is computed from confidence, and no display state promotes or demotes a
 * field (§3, `server-owns-state.spec`).
 */
const DISPLAY_STATE: Record<Field["state"], DecisionState> = {
  pending: "pending",
  needs_review: "pending",
  auto_confirmed: "confirmed",
  confirmed: "confirmed",
  corrected: "corrected",
  escalated: "escalated",
};

export function toReadings(field: Field): Reading[] {
  return readingsOf(field).map((reading) => ({
    id: reading.id,
    engineId: reading.engine_id,
    value: reading.value,
    page: reading.page,
    snippet: reading.snippet,
    coords: reading.line_coords,
  }));
}

/**
 * CONTRACT GAP: `Field` carries no `asking` and no `why`. The export's card
 * opens with the question and names why the field was flagged; nothing on the
 * wire says either, so both are omitted and the card draws their absence rather
 * than a sentence this screen composed.
 */
export function toDecisionField(field: Field): DecisionField {
  const parts = field.path.split(".");
  return {
    section: parts[0] ?? field.path,
    label: fieldLabel(field.path),
    page: field.source_page ?? readingsOf(field).find((r) => r.page !== null)?.page ?? null,
  };
}

export function toDecisionStatus(field: Field): DecisionStatus {
  return {
    state: isExcluded(field) ? "notparty" : DISPLAY_STATE[field.state],
    label: stateLabel(field),
    // CONTRACT GAP: nothing says a flag came from the sign-off rather than the
    // scan, so the export's "Claim vs page" variant is unreachable and this is
    // always the machine-reading word.
    flagWord: "Flagged",
  };
}

export function toAsRead(field: Field): AsReadRowProps {
  const page = field.source_page ?? readingsOf(field).find((r) => r.page !== null)?.page ?? null;
  const draft =
    field.value === null && enginesDisagree(field)
      ? (readingsOf(field).find((reading) => reading.value !== null)?.value ?? undefined)
      : undefined;
  return {
    caption: "As read",
    value: field.value,
    provenance: page === null ? null : { page, snippet: field.source_snippet ?? "" },
    ...(draft === undefined ? {} : { draft }),
  };
}
```

`apps/web-v2/src/features/review/DecisionColumn.tsx` — replace the whole file:

```tsx
import type { Field } from "@titlepipe/contract";
import { canDo } from "@titlepipe/contract";
import { DecisionBar } from "../../entities/field/DecisionBar";
import { DecisionCard } from "../../entities/field/DecisionCard";
import type { Reading } from "../../entities/field/EngineReadings";
import { enginesDisagree, readingsOf } from "../../entities/field/fieldLabel";
import { useSession } from "../../shared/session";
import {
  toAsRead,
  toDecisionField,
  toDecisionStatus,
  toReadings,
  type Pinned,
} from "./decisionCardProps";
import { ReviewEditors, type ReviewMode } from "./ReviewEditors";

interface DecisionColumnProps {
  field: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  /** The machine-read value a correction must differ from (§11.1). */
  machineValue: string;
  passPending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onMode: (mode: ReviewMode) => void;
  onCorrectSubmit: (value: string, reason: string) => void;
  onEscalateSubmit: (question: string) => void;
  onExcludeSubmit: (reason: string) => void;
  onPassSubmit: (reason: string) => void;
}

/**
 * The middle pane: the decision, and whatever it opened.
 *
 * THE EDITORS LIVE INSIDE THE CARD rather than beside it, so the field they act
 * on is never off screen while somebody types a reason. A reason written about
 * the wrong field is worse than no reason, and one column is the defence that
 * costs nothing.
 *
 * ACTIONS BELONG TO REVIEW ROLES, AND ARE ABSENT OTHERWISE. An ops user
 * arriving by a complaint deep link can look at the field in context but not
 * act on it — a greyed button is an invitation to ask for permission, an absent
 * one is an answer. The card takes either the bar or the note in one slot, so
 * there is no arrangement in which both or neither appear.
 */
export function DecisionColumn(props: DecisionColumnProps) {
  const { field, pinned, mode, seed, machineValue } = props;
  const role = useSession((s) => s.role);
  const mayReview = canDo(role, "field.confirm");

  const onPinReading = (reading: Reading, seat: string) => {
    const source = readingsOf(field).find((r) => r.id === reading.id);
    if (source) props.onPin({ seat, reading: source });
  };

  return (
    <DecisionCard
      field={toDecisionField(field)}
      status={toDecisionStatus(field)}
      reading={toAsRead(field)}
      readings={toReadings(field)}
      disagree={enginesDisagree(field)}
      pinnedId={pinned?.reading.id ?? null}
      onPin={onPinReading}
      onAdopt={props.onAdopt}
      footer={
        mayReview ? (
          <DecisionBar
            confirmLabel="Confirm as read"
            onConfirm={props.onConfirm}
            onCorrect={props.onCorrect}
            onEscalate={() => props.onMode("escalate")}
            onPass={() => props.onMode("pass")}
            {...(field.path.startsWith("judgments.")
              ? { onExclude: () => props.onMode("exclude") }
              : {})}
          />
        ) : (
          <p className="border-t border-line-subtle px-8 py-5 text-xs text-ink-muted">
            You are here for context. Review decisions belong to the reviewer on
            this order.
          </p>
        )
      }
    >
      <ReviewEditors
        mode={mode}
        editorKey={`${field.id}:${seed}`}
        seed={seed}
        machineValue={machineValue}
        passPending={props.passPending}
        serverNote={props.serverNote}
        blankNote={props.blankNote}
        onCancel={() => props.onMode("idle")}
        onCorrect={props.onCorrectSubmit}
        onEscalate={props.onEscalateSubmit}
        onExclude={props.onExcludeSubmit}
        onPass={props.onPassSubmit}
      />
    </DecisionCard>
  );
}
```

`toReadings` is called on each render deliberately — it maps at most four readings and adding `useMemo` without a measured reason buys a dependency array to get wrong.

In `FieldsColumn.tsx` and `ReviewScreen.tsx`, change `import { type Pinned } from "./DecisionPanel";` to `import { type Pinned } from "./decisionCardProps";`.

Delete `DecisionPanel.tsx`, `DecisionActions.tsx`, `ReadingsPanel.tsx`. Three things leave with them and each is a recorded decision, not an oversight:
- **`Report pipeline bug`** — no product rule behind it (ruling D6). Record in `conflicts.md`.
- **the per-engine value repetition** — the collapse (D4).
- **`Confirm C` / `Correct E`** — replaced by the export's own words.

In `e2e/invariants/review.spec.ts`, add the disclosure click to two tests, changing nothing else. Add this note above the first of them:

```ts
// INTERACTION REWRITE 2026-07-30: attribution moved behind a disclosure on the
// decision card (ruling D4 — READER A, "use this reading" and "Both readers
// agree" appear nowhere in the export). The spec header permits rewriting how
// a test reaches an element and forbids weakening what it asserts; every
// assertion below is byte-identical, with one click added to open the panel.
```

```ts
  await lender.click();
  await page.getByTestId("attribution-toggle").click();
  await expect(page.getByText("THEY DISAGREE. THAT IS WHY IT IS YOURS.")).toBeVisible();
```
```ts
  await page.getByTestId("row-mortgages.1.amount").click();
  await page.getByTestId("attribution-toggle").click();
  await page.getByText("llmwhisperer-hq").first().click();
  await expect(page.getByText(/READER B LINE — llmwhisperer-hq/)).toBeVisible();
```

In `e2e/invariants/ux.spec.ts`, the same one-line addition before the `diff-hl` and `use-` assertions, with the same note.

Append to `docs/frontend/conflicts.md`:

```md
## C-W3-1 — `THEY DISAGREE. THAT IS WHY IT IS YOURS.` (kept, export has none)
The export contains no sentence naming a disagreement; `review.spec` #3 asserts
this one, and it states a fact — two readers looked at a bad scan and came back
with different answers — that the alternative reading ("the machine failed")
gets wrong. Kept, inside the attribution disclosure.

## C-W3-2 — `READER B LINE — <engine>` (kept, export draws no pin)
The export has no coordinates pin at all, so this wording is this build's own
and was already flagged as invented. `review.spec` #10 asserts it, and an
invariant is not weakened to match a screen the design never drew. The reader
SEAT survives only here; the per-reader card headings are gone with the D4
collapse.

## C-W3-3 — `Report pipeline bug` (removed)
Carried no product rule and no endpoint. Removed with `DecisionPanel` per
ruling D6, alongside the on-screen key-hint line.
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e
```

Expected: `decisionCardProps.test.ts` 8 passing; the full Playwright suite green, including `review.spec` #3/#4/#10, `ux.spec` #1/#2/#3, `review-conflict.spec`'s three 409 invariants and `sidebar.spec`'s `[`-inside-a-field test, which drives `e` → `edit-value` through the new card.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

`knip` must now be clean: `DecisionCard`, `DecisionBar`, `AsReadRow`, `EngineReadings`, `ReadingLine`, `ReadingPin` and `diff` all have production call sites.

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/features/review/decisionCardProps.ts apps/web-v2/src/features/review/decisionCardProps.test.ts apps/web-v2/src/features/review/DecisionColumn.tsx apps/web-v2/src/features/review/FieldsColumn.tsx apps/web-v2/src/features/review/ReviewScreen.tsx apps/web-v2/e2e/invariants/review.spec.ts apps/web-v2/e2e/invariants/ux.spec.ts docs/frontend/conflicts.md
git rm apps/web-v2/src/features/review/DecisionPanel.tsx apps/web-v2/src/features/review/DecisionActions.tsx apps/web-v2/src/features/review/ReadingsPanel.tsx
```

```
Compose Review from the entities/field kit instead of re-implementing it

DecisionPanel, DecisionActions and ReadingsPanel were reimplementations of a
kit that already existed, and the copies had drifted — the dead DecisionBar
carried the export's button wording while the live actions said "Confirm C".
Review now maps Field onto the entity props in one pure module and composes the
card, the bar and the disclosure. The two invariants that reach the attribution
open the disclosure first; no assertion changed. The missing asking/why is a
CONTRACT GAP the card draws as absent rather than a sentence the screen wrote.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 16: The sheet line, composed from `FieldValue` and `NoValue`

**Files:**
- Create: `apps/web-v2/src/entities/field/SheetValue.tsx` (moved from `features/review/SheetValue.tsx`)
- Delete: `apps/web-v2/src/features/review/SheetValue.tsx`
- Modify: every importer of `./SheetValue` — find them with `grep -rn "SheetValue" apps/web-v2/src` (the known one is `features/review/CallBackSheet.tsx`)
- Create: `apps/web-v2/src/entities/field/SheetValue.stories.tsx`

**Interfaces:**
- Consumes: `FieldValue`, `NoValue`, `noValueStates`, `fieldLabel` — all siblings in `entities/field`.
- Produces:
  ```tsx
  export function SheetValue(props: { field: Field }): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/entities/field/SheetValue.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Field } from "@titlepipe/contract";
import { expect, within } from "storybook/test";
import { SheetValue } from "./SheetValue";

const meta = {
  title: "Field/SheetValue",
  component: SheetValue,
} satisfies Meta<typeof SheetValue>;

export default meta;
type Story = StoryObj<typeof meta>;

const field = (over: Partial<Field> = {}): Field => ({
  id: "f1",
  path: "owner.name",
  value: null,
  value_raw: null,
  state: "confirmed",
  na_reason: null,
  excluded_reason: null,
  source_doc_id: "d1",
  source_page: 3,
  source_snippet: "MARIA L. ESTRADA, an unmarried woman,",
  source_line_coords: null,
  readings: [],
  ...over,
});

/** A value on the sheet cites its page, through the shared FieldValue. */
export const Cited: Story = {
  args: { field: field({ value: "MARIA L. ESTRADA" }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("MARIA L. ESTRADA")).toBeInTheDocument();
    expect(await canvas.findByText("p3")).toBeInTheDocument();
  },
};

/** A human decision is labelled as one — the sheet's last chance to say so. */
export const Corrected: Story = {
  args: { field: field({ value: "MARIA I. ESTRADA", state: "corrected" }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("Your correction")).toBeInTheDocument();
  },
};

/** An uncited value on the sheet is a hard error, not a quiet line. */
export const Uncited: Story = {
  args: {
    field: field({ value: "MARIA L. ESTRADA", source_doc_id: null, source_page: null }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A sheet that renders uncitable values indistinguishably from citeable
    // ones is how one reaches a client.
    expect(await canvas.findByRole("alert")).toHaveTextContent("NO PROVENANCE");
  },
};

/** The four NA reasons stay four. */
export const DocumentSilent: Story = {
  args: { field: field({ na_reason: "NOT_STATED" }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvasElement.textContent).not.toContain("Not Available —");
    expect(await canvas.findByText(/silent/i)).toBeInTheDocument();
  },
};
```

Take the exact `NoValue` copy for the last assertion from `entities/field/noValueStates.ts` — the strings there are the authority, and this story must quote them rather than approximate.

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 test --project storybook
```

Expected: `Failed to resolve import "./SheetValue" from "src/entities/field/SheetValue.stories.tsx"`.

- [ ] **Step 3: Implement**

`git mv apps/web-v2/src/features/review/SheetValue.tsx apps/web-v2/src/entities/field/SheetValue.tsx`, point its imports at siblings, and replace the valued arm with `FieldValue` so the "mono value + page cite + Your correction" render exists once:

```tsx
import type { Field, NaReason } from "@titlepipe/contract";
import { enginesDisagree, isExcluded } from "./fieldLabel";
import { FieldValue } from "./FieldValue";
import { NoValue } from "./NoValue";
import type { NoValueKind } from "./noValueStates";

/** The four document answers, mapped to the six-arm render union. */
function noValueFor(reason: NaReason, page: number | null): NoValueKind {
  switch (reason) {
    case "NOT_PRESENT":
      return { kind: "not_present" };
    case "NOT_FOUND":
      return { kind: "not_found" };
    case "NOT_STATED":
      return { kind: "silent" };
    case "PRESENT_UNREADABLE":
      return { kind: "unreadable", page: page ?? 0 };
  }
}

/**
 * One line of the draft sheet.
 *
 * RULE: the sheet renders a value through the SAME primitive the decision card
 * does. FAILURE PREVENTED: two renders of "mono value plus page cite plus Your
 * correction" that could disagree about what a corrected value looks like on
 * the one screen where both appear, a scroll apart.
 *
 * A HUMAN DECISION IS LABELLED AS ONE. "Your correction" and "Escalated to
 * senior review" are not styling — they are the difference between a value the
 * machine produced and a value a person stood behind, and the sheet is the last
 * place that distinction is visible before the document goes out.
 *
 * THE PAGE CITE RIDES EVERY VALUE, and an uncited one raises `FieldValue`'s
 * alert rather than printing itself quietly: a sheet that renders uncitable
 * values indistinguishably from citeable ones is how one reaches a client.
 */
export function SheetValue({ field }: { field: Field }) {
  const page = field.source_page;

  if (isExcluded(field)) {
    // The row is OFF the sheet, and says so. A suppressed line that simply
    // vanished would be indistinguishable from one nobody looked at.
    return (
      <FieldValue
        value={field.value ?? ""}
        provenance={page === null ? null : { page, snippet: field.source_snippet ?? "" }}
        presentation="excluded"
      />
    );
  }

  if (field.state === "escalated") {
    return <span className="text-base text-state-attend-ink">↗ Escalated to senior review</span>;
  }

  if (field.value === null && field.na_reason !== null) {
    return (
      <span className="flex flex-wrap items-baseline gap-3">
        <NoValue value={noValueFor(field.na_reason, page)} />
      </span>
    );
  }

  if (field.value === null) {
    return (
      <span className="flex flex-wrap items-baseline gap-3">
        <NoValue value={{ kind: enginesDisagree(field) ? "unsettled" : "pending" }} />
        <span className="text-tiny text-ink-muted">not on the sheet yet</span>
      </span>
    );
  }

  return (
    <FieldValue
      value={field.value}
      provenance={page === null ? null : { page, snippet: field.source_snippet ?? "" }}
      presentation={field.state === "corrected" ? "correction" : "machine"}
    />
  );
}
```

`FieldValue`'s `correction` presentation already carries the `Your correction` mark and its `excluded` presentation carries `Excluded — not our party`, so both arms keep their wording without this file restating it. The `PRESENT_UNREADABLE` page cite is now `NoValue`'s own — check `noValueStates.ts`; if the `unreadable` render does not print the page, keep the explicit cite that `SheetValue` had and say why in a comment.

Update every importer of `SheetValue` to `"../../entities/field/SheetValue"`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 test && pnpm --filter web-v2 test:e2e --grep "review"
```

Expected: four `SheetValue` stories passing; `review.spec` #1 (the four NA reasons stay four) and #2 (no provenance) green.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

```
git add apps/web-v2/src/entities/field/SheetValue.tsx apps/web-v2/src/entities/field/SheetValue.stories.tsx apps/web-v2/src/features/review/CallBackSheet.tsx
git rm apps/web-v2/src/features/review/SheetValue.tsx
```

```
Render the sheet's values through FieldValue instead of beside it

SheetValue hand-rolled the mono value, the page cite and the "Your correction"
mark that FieldValue already draws, so the one screen showing both could
disagree with itself about what a corrected value looks like. It moves to
entities/field and composes FieldValue and NoValue; an uncited value now raises
the same hard error on the sheet that it does on the card.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Wave verification

Run once, after Task 16, before handing to Wave 4:

```
pnpm --filter web-v2 typecheck
pnpm --filter web-v2 check:rules
pnpm --filter web-v2 lint
pnpm --filter web-v2 test
pnpm --filter web-v2 test:e2e
pnpm --filter web-v2 knip
pnpm typecheck
```

The 2026-07-30 baseline is all green — 297 tests, `check:rules` clean over 283 files, zero skips — so any red is this wave's. Three things to look at specifically, because a green suite is not evidence the UI is right:

1. **`knip` reports nothing unused.** Wave 0 stopped `.stories.tsx` counting as usage, and this wave both created and adopted eleven components. Any name it reports is a component this wave built and forgot to wire — that is the exact failure the wave exists to end, and it must not be silenced with an ignore.
2. **The rail draws six numbered stages on `/rulebook`**, headed `THE FLOW`, with Review as a non-navigating position and Delivered numbered 6. Check it in the browser; no test asserts the header text on a live screen.
3. **The Review decision card fits the pane without an internal scrollbar** with the attribution closed. That is the whole point of the D4 collapse, and it is the one outcome only a look can confirm. Capture it with `node compare.mjs Review /orders/ord_demo_1/review ../../shots` (Wave 0 fixed the click-path selector) and put the pair side by side.

Wave 4 assembles the screens from these components. Nothing in this wave changed a screen's measure, padding or placement — that is Wave 4's, and if a screen looks different after this wave beyond the deletions listed above, something here overreached.

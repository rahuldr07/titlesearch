# [Wave 0] — The Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `apps/web-v2` the export's fixed-height pane frame, its per-screen measure/padding primitive and an honest chrome predicate, and turn the two tools that should have caught the drift — `knip` and `compare.mjs` — back into gates.

**Architecture:** Two new presentational primitives in `src/shared/ui` (`Pane`, `Screen`) and one pure predicate in `src/app` (`chromeFor`). `rootRoute` then stops page-scrolling and stops shrink-wrapping `main`, and `AppChrome`/`OrderStrip` stop drawing an ADMIN world to an unauthenticated viewer. Nothing else in `src/` changes shape in this wave — the screens keep their own wrappers until Wave 4 adopts `Screen` one at a time.

**Prerequisites:** None. Wave 0 is the first wave and blocks Waves 3, 4 and 5. Waves 1 and 2 do not import anything this wave builds and may start in parallel, but must rebase onto it before their own gates run.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **`rootRoute.tsx` is touched by exactly one task (Task 4) and by nothing else until this wave lands** — it is the proximate cause of two blocking findings and a concurrent edit there loses one of them.

---

## File Structure

| File | Created / Modified | The one responsibility |
|---|---|---|
| `apps/web-v2/src/shared/ui/Pane.tsx` | Create | The bounded-region slot set. Owns `min-h-0` so no call site can forget it. |
| `apps/web-v2/src/shared/ui/Pane.test.ts` | Create | Proves the scroller slot carries `min-h-0`, as a pure function in the node gate. |
| `apps/web-v2/src/shared/ui/Pane.stories.tsx` | Create | Draws all four slots in a bounded frame, so the a11y run and knip both see them. |
| `apps/web-v2/src/shared/ui/Screen.tsx` | Create | Turns the export's own pixel numbers into a measure, a padding and a placement. |
| `apps/web-v2/src/shared/ui/Screen.test.ts` | Create | Proves every measure emits its own width on the 2px base and that `bleed` emits neither. |
| `apps/web-v2/src/shared/ui/Screen.stories.tsx` | Create | Draws the three placements, so knip sees the export and axe sees the render. |
| `apps/web-v2/src/app/chromeFor.ts` | Create | One predicate answering two different questions: draw chrome? issue GETs? |
| `apps/web-v2/src/app/chromeFor.test.ts` | Create | Pins the four path classes and the fact that the two fields are not one boolean. |
| `apps/web-v2/e2e/invariants/chrome.spec.ts` | Create | `/signin` and `/session` draw no chrome; `/blind/*` issues zero `/api` GETs. |
| `apps/web-v2/src/app/AppChrome.tsx` | Modify | Gate on `chromeFor`, not on `/blind` alone. |
| `apps/web-v2/src/app/OrderStrip.tsx` | Modify | Same gate; and stop being a scrolling row. |
| `apps/web-v2/src/app/rootRoute.tsx` | Modify | The fixed-height frame, and a full-width `main` with the measure on an inner box. |
| `apps/web-v2/src/entities/nav/Sidebar.tsx` | Modify | The rail is a full-height flex item, not a `sticky` page element. |
| `apps/web-v2/e2e/invariants/shell-frame.spec.ts` | Create | The page never scrolls; `main` fills the content column; the strip stays put. |
| `apps/web-v2/knip.json` | Modify | Marks the production project so `knip --production` has something to walk. |
| `apps/web-v2/knip.production.jsonc` | Create | The bypassed-component gate, with every current waiver named and owned. |
| `apps/web-v2/package.json` | Modify | `knip` runs the holistic pass and then the production gate. |
| `apps/web-v2/compare.mjs` | Modify | Table-driven click paths through the export's `<aside>`; hard-fails on a miss. |
| `apps/web-v2/tmp-audit.mjs` | Delete | Its selector logic moves into `compare.mjs`; the scratch harness goes. |
| `.claude/launch.json` | Modify | Port 5174, which is what `vite.config.ts` actually serves. |

---

### Task 1: `Pane` — the bounded region that cannot forget `min-h-0`

**Files:**
- Create: `apps/web-v2/src/shared/ui/Pane.tsx`
- Create: `apps/web-v2/src/shared/ui/Pane.stories.tsx`
- Test: `apps/web-v2/src/shared/ui/Pane.test.ts`

**Interfaces:**
- Consumes: `cn` from `apps/web-v2/src/shared/ui/classNames.ts` — `cn(...inputs: ClassValue[]): string`.
- Produces, exactly as pinned in the index:
  ```tsx
  export interface PaneProps { children: ReactNode; className?: string }
  export function Pane(props: PaneProps): ReactElement        // flex flex-col min-h-0
  export function PaneHeader(props: PaneProps): ReactElement  // flex-none
  export function PaneBody(props: PaneProps): ReactElement    // flex-1 min-h-0 overflow-y-auto
  export function PaneFooter(props: PaneProps): ReactElement  // flex-none
  ```
- Produces additionally, for the node gate and for `Screen`/`rootRoute`:
  ```tsx
  export const paneClasses: (props?: { slot?: "pane" | "header" | "body" | "footer" | null }) => string
  ```

- [ ] **Step 1: Write the failing test**

  Create `apps/web-v2/src/shared/ui/Pane.test.ts`:

  ```ts
  import { describe, expect, test } from "vitest";
  import { paneClasses } from "./Pane";

  /**
   * `min-h-0` is not a style. A flex item's default `min-height` is `auto`,
   * so a nested scroller GROWS to its content instead of scrolling and the
   * page scrolls instead — which is exactly how Review became a 3276px frame
   * against the export's single 1000px one. The class is invisible when
   * present and produces a plausible-looking wrong layout when absent, which
   * is why it gets a test and not a code review.
   */

  const SLOTS = ["pane", "header", "body", "footer"] as const;

  describe("Pane's slots", () => {
    test("the body carries min-h-0", () => {
      expect(paneClasses({ slot: "body" }).split(/\s+/)).toContain("min-h-0");
    });

    test("anything that scrolls carries min-h-0 — the rule, not the literal", () => {
      for (const slot of SLOTS) {
        const classes = paneClasses({ slot }).split(/\s+/);
        if (!classes.includes("overflow-y-auto")) continue;
        expect(
          classes,
          `${slot} scrolls without min-h-0 — it will grow, not scroll`,
        ).toContain("min-h-0");
      }
    });

    test("the body is the only scroller, and it is the only slot that grows", () => {
      const scrollers = SLOTS.filter((slot) =>
        paneClasses({ slot }).split(/\s+/).includes("overflow-y-auto"),
      );
      expect(scrollers).toEqual(["body"]);
      const growers = SLOTS.filter((slot) =>
        paneClasses({ slot }).split(/\s+/).includes("flex-1"),
      );
      expect(growers).toEqual(["body"]);
    });

    test("header and footer never shrink — a docked bar that shrinks is not docked", () => {
      for (const slot of ["header", "footer"] as const) {
        expect(paneClasses({ slot }).split(/\s+/)).toContain("flex-none");
      }
    });

    test("the pane itself is a column that may be squeezed to zero", () => {
      const classes = paneClasses({ slot: "pane" }).split(/\s+/);
      expect(classes).toContain("flex");
      expect(classes).toContain("flex-col");
      expect(classes).toContain("min-h-0");
    });
  });
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  ```
  pnpm --filter web-v2 test -- --project gates
  ```

  Expected failure: `Error: Failed to resolve import "./Pane" from "src/shared/ui/Pane.test.ts". Does the file exist?` — the module does not exist yet.

- [ ] **Step 3: Implement**

  Create `apps/web-v2/src/shared/ui/Pane.tsx`:

  ```tsx
  import { cva } from "class-variance-authority";
  import type { ReactElement, ReactNode } from "react";
  import { cn } from "./classNames";

  /**
   * The bounded region. The export roots at `height:100vh;overflow:hidden` and
   * then repeats `height:100%;overflow:auto` on every screen body; this app
   * rooted at `min-h-screen` and page-scrolled, and a grep for
   * `overflow-y-auto|min-h-0|h-dvh` across `src/` returned one hit.
   *
   * RULE: a region that scrolls declares `min-h-0`. FAILURE PREVENTED: a flex
   * item's `min-height` defaults to `auto`, so a scroller without it grows to
   * its content and pushes the page instead — the header and footer that were
   * supposed to be docked scroll away, and the frame that was supposed to be
   * one screen tall becomes three. It is invisible when right and plausible
   * when wrong, so it lives in ONE place with a test on it rather than in nine
   * call sites with a comment.
   */
  /* eslint-disable-next-line react-refresh/only-export-components -- exported so the min-h-0 rule is provable as a pure function in the node gate; the failure it guards renders as "a bit tall", which no test in this suite would otherwise catch. */
  export const paneClasses = cva("", {
    variants: {
      slot: {
        /** the region — a column that may be squeezed to nothing */
        pane: "flex min-h-0 flex-col",
        /** never scrolls, never shrinks */
        header: "flex-none",
        /** THE scroller. `min-h-0` is the reason this file exists. */
        body: "min-h-0 flex-1 overflow-y-auto",
        /** docked: the coverage spine, the decision bar */
        footer: "flex-none",
      },
    },
    defaultVariants: { slot: "pane" },
  });

  export interface PaneProps {
    children: ReactNode;
    className?: string;
  }

  export function Pane({ children, className }: PaneProps): ReactElement {
    return <div className={cn(paneClasses({ slot: "pane" }), className)}>{children}</div>;
  }

  export function PaneHeader({ children, className }: PaneProps): ReactElement {
    return <div className={cn(paneClasses({ slot: "header" }), className)}>{children}</div>;
  }

  export function PaneBody({ children, className }: PaneProps): ReactElement {
    return <div className={cn(paneClasses({ slot: "body" }), className)}>{children}</div>;
  }

  export function PaneFooter({ children, className }: PaneProps): ReactElement {
    return <div className={cn(paneClasses({ slot: "footer" }), className)}>{children}</div>;
  }
  ```

  Create `apps/web-v2/src/shared/ui/Pane.stories.tsx`:

  ```tsx
  import type { Meta, StoryObj } from "@storybook/react-vite";
  import { Pane, PaneHeader, PaneBody, PaneFooter } from "./Pane";
  import { Eyebrow } from "./Eyebrow";

  const meta = {
    title: "Primitives/Pane",
    component: Pane,
    parameters: { layout: "fullscreen" },
  } satisfies Meta<typeof Pane>;

  export default meta;
  type Story = StoryObj<typeof meta>;

  /**
   * The header and the footer stay put while the body scrolls. If `min-h-0`
   * ever goes missing from the body, this story stops scrolling and starts
   * growing — the whole frame gets taller and the footer leaves the viewport.
   */
  export const Bounded: Story = {
    args: { children: null },
    render: () => (
      <div className="h-150 border border-line-strong">
        <Pane className="h-full">
          <PaneHeader className="border-b border-line-subtle bg-surface-sunken px-8 py-5">
            <Eyebrow variant="section">Coverage</Eyebrow>
          </PaneHeader>
          <PaneBody className="px-8 py-5">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 40 }, (_, i) => (
                <p key={i} className="text-base text-ink-secondary">
                  Page {i + 1} — read in full, one instrument segmented.
                </p>
              ))}
            </div>
          </PaneBody>
          <PaneFooter className="border-t border-line-subtle bg-surface-sunken px-8 py-5">
            <Eyebrow variant="stat">Docked — this never scrolls away</Eyebrow>
          </PaneFooter>
        </Pane>
      </div>
    ),
  };
  ```

- [ ] **Step 4: Run — Expected: PASS**

  ```
  pnpm --filter web-v2 test -- --project gates
  ```

  Expected: the five `Pane's slots` tests pass, and the pre-existing gate tests still pass.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/src/shared/ui/Pane.tsx apps/web-v2/src/shared/ui/Pane.test.ts apps/web-v2/src/shared/ui/Pane.stories.tsx
  git commit -m "$(cat <<'EOF'
  Add the Pane slot set so min-h-0 lives in one place

  The export bounds every screen and scrolls only the body; this app
  page-scrolled instead, because the one class that makes a nested flex
  scroller scroll rather than grow was written nowhere. Pane owns it and a
  node test asserts it, so a scroller can no longer be added without it.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: `Screen` — the measure, pad and placement primitive

**Files:**
- Create: `apps/web-v2/src/shared/ui/Screen.tsx`
- Create: `apps/web-v2/src/shared/ui/Screen.stories.tsx`
- Test: `apps/web-v2/src/shared/ui/Screen.test.ts`

**Interfaces:**
- Consumes: `PaneBody(props: PaneProps): ReactElement` and `paneClasses` from Task 1; `cn` from `./classNames`.
- Produces, exactly as pinned in the index:
  ```tsx
  export type ScreenMeasure =
    | "380" | "420" | "440" | "460" | "560" | "640" | "700" | "720"
    | "860" | "880" | "900" | "940" | "1040" | "1120" | "1160" | "1340";
  export type ScreenPad = "28x32" | "32x40" | "26x30" | "24x28" | "36x40" | "40";
  export type ScreenPlacement = "top" | "centre" | "bleed";
  export interface ScreenProps {
    children: ReactNode;
    measure?: ScreenMeasure;
    pad?: ScreenPad;
    placement?: ScreenPlacement;
    className?: string;
  }
  export function Screen(props: ScreenProps): ReactElement;
  ```
  `ScreenMeasure` and `ScreenPad` are derived from the exported tuples below so the class maps are exhaustive at compile time; the resulting unions are character-for-character the ones pinned in the index.
- Produces additionally, for the node gate and for Wave 4's assignment table:
  ```tsx
  export const SCREEN_MEASURES: readonly ScreenMeasure[];   // 16 entries, the export's own numbers
  export const SCREEN_PADS: readonly ScreenPad[];           // 6 entries
  export interface ScreenLayout { scroller: string; box: string | null }
  export function screenLayout(props: Omit<ScreenProps, "children" | "className">): ScreenLayout;
  ```

- [ ] **Step 1: Write the failing test**

  Create `apps/web-v2/src/shared/ui/Screen.test.ts`:

  ```ts
  import { describe, expect, test } from "vitest";
  import { SCREEN_MEASURES, SCREEN_PADS, screenLayout } from "./Screen";

  /**
   * The variant keys ARE the export's pixel numbers, so the only thing that
   * can be wrong is the arithmetic that turns them into a class on the 2px
   * spacing base. Asserting the arithmetic catches a mistyped map entry;
   * re-listing the map would only assert that the map equals itself.
   */

  describe("Screen's measure", () => {
    test("the export draws sixteen widths and this file names all sixteen", () => {
      expect(SCREEN_MEASURES).toHaveLength(16);
      expect(new Set(SCREEN_MEASURES).size).toBe(16);
    });

    test("every measure emits its own px width on the 2px base", () => {
      for (const measure of SCREEN_MEASURES) {
        const box = screenLayout({ measure }).box;
        expect(box, `${measure}px has no box`).not.toBeNull();
        expect(box, `${measure}px`).toContain(`max-w-${Number(measure) / 2}`);
      }
    });

    test("no two measures collapse onto the same class", () => {
      const emitted = SCREEN_MEASURES.map((measure) => screenLayout({ measure }).box);
      expect(new Set(emitted).size).toBe(SCREEN_MEASURES.length);
    });

    test("the measure is never on the scroller — mx-auto there cancels stretch", () => {
      expect(screenLayout({ measure: "860" }).scroller).not.toMatch(/\bmax-w-/);
    });
  });

  describe("Screen's padding", () => {
    test("every pad emits the export's own padding on the 2px base", () => {
      for (const pad of SCREEN_PADS) {
        const scroller = screenLayout({ measure: "720", pad }).scroller;
        const [y, x] = pad.split("x");
        expect(y, `${pad} is not a pad key`).toBeDefined();
        if (x === undefined) {
          expect(scroller, pad).toContain(`p-${Number(y) / 2}`);
        } else {
          expect(scroller, pad).toContain(`py-${Number(y) / 2}`);
          expect(scroller, pad).toContain(`px-${Number(x) / 2}`);
        }
      }
    });

    test("the default is the export's most repeated body padding, 28x32", () => {
      const scroller = screenLayout({ measure: "720" }).scroller;
      expect(scroller).toContain("py-14");
      expect(scroller).toContain("px-16");
    });
  });

  describe("Screen's placement", () => {
    test("bleed emits neither a measure nor a padding", () => {
      const layout = screenLayout({ placement: "bleed" });
      expect(layout.box).toBeNull();
      expect(layout.scroller).not.toMatch(/(^|\s)p[xy]?-\d/);
      expect(layout.scroller).not.toMatch(/\bmax-w-/);
    });

    test("bleed is still a scroller — Review scrolls its own panes, not the page", () => {
      const classes = screenLayout({ placement: "bleed" }).scroller.split(/\s+/);
      expect(classes).toContain("overflow-y-auto");
      expect(classes).toContain("min-h-0");
    });

    test("centre centres on both axes; top does not", () => {
      const centre = screenLayout({ measure: "560", pad: "40", placement: "centre" }).scroller;
      expect(centre).toContain("items-center");
      expect(centre).toContain("justify-center");
      const top = screenLayout({ measure: "860" }).scroller;
      expect(top).not.toContain("items-center");
    });

    test("every scroller inherits the Pane body rule", () => {
      for (const placement of ["top", "centre", "bleed"] as const) {
        const classes = screenLayout({ measure: "720", placement }).scroller.split(/\s+/);
        expect(classes, placement).toContain("min-h-0");
        expect(classes, placement).toContain("overflow-y-auto");
      }
    });
  });
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  ```
  pnpm --filter web-v2 test -- --project gates
  ```

  Expected failure: `Error: Failed to resolve import "./Screen" from "src/shared/ui/Screen.test.ts". Does the file exist?`

- [ ] **Step 3: Implement**

  Create `apps/web-v2/src/shared/ui/Screen.tsx`:

  ```tsx
  import { cva } from "class-variance-authority";
  import type { ReactElement, ReactNode } from "react";
  import { cn } from "./classNames";
  import { PaneBody, paneClasses } from "./Pane";

  /**
   * The per-screen measure, padding and placement.
   *
   * RULE: the variant keys are the EXPORT'S OWN PIXEL NUMBERS, and this file is
   * the only place one becomes a class. FAILURE PREVENTED: eleven hand-rolled
   * wrappers each re-derived the same rule and seven reached a different
   * answer — four competing `max-w-*`, one Tailwind DEFAULT-scale `max-w-3xl`
   * in an app whose spacing base is 2px, and seven screens with no measure at
   * all inheriting the shell's. A reviewer can now check a call site against
   * the spec table without a lookup table in their head.
   *
   * THE MEASURE GOES ON AN INNER BOX, NEVER ON THE SCROLLER. Auto inline
   * margins on a flex item cancel `align-self:stretch`, which is the whole of
   * blocking finding B2: Queue asked for 860px and drew 670px, and Profile,
   * which asked for nothing, collapsed to its content's 421px where the export
   * draws a 720px column.
   */
  /* eslint-disable-next-line react-refresh/only-export-components -- the export's sixteen widths, exported so the class map is exhaustive at compile time and iterable in the node gate. */
  export const SCREEN_MEASURES = [
    "380", "420", "440", "460", "560", "640", "700", "720",
    "860", "880", "900", "940", "1040", "1120", "1160", "1340",
  ] as const;
  export type ScreenMeasure = (typeof SCREEN_MEASURES)[number];

  /* eslint-disable-next-line react-refresh/only-export-components -- the export's six body paddings, same reason as SCREEN_MEASURES. */
  export const SCREEN_PADS = ["28x32", "32x40", "26x30", "24x28", "36x40", "40"] as const;
  export type ScreenPad = (typeof SCREEN_PADS)[number];

  export type ScreenPlacement = "top" | "centre" | "bleed";

  /** px → the class on the 2px base: `max-w-430` is 860px, not 430px. */
  const MEASURE = {
    "380": "max-w-190", "420": "max-w-210", "440": "max-w-220", "460": "max-w-230",
    "560": "max-w-280", "640": "max-w-320", "700": "max-w-350", "720": "max-w-360",
    "860": "max-w-430", "880": "max-w-440", "900": "max-w-450", "940": "max-w-470",
    "1040": "max-w-520", "1120": "max-w-560", "1160": "max-w-580", "1340": "max-w-670",
  } satisfies Record<ScreenMeasure, string>;

  /** The export's `padding:` on the screen body, vertical×horizontal in px. */
  const PAD = {
    "28x32": "py-14 px-16",
    "32x40": "py-16 px-20",
    "26x30": "py-13 px-15",
    "24x28": "py-12 px-14",
    "36x40": "py-18 px-20",
    "40": "p-20",
  } satisfies Record<ScreenPad, string>;

  /**
   * `top` is horizontally centred and top-aligned — the export spells it both
   * `margin:0 auto` and `justify-content:center` + `align-items:flex-start`,
   * and the two render identically. `bleed` never reaches this map.
   */
  const PLACEMENT = {
    top: "",
    centre: "flex items-center justify-center",
    bleed: "",
  } satisfies Record<ScreenPlacement, string>;

  const scrollerClasses = cva("", {
    variants: { pad: PAD, placement: PLACEMENT },
    defaultVariants: { pad: "28x32", placement: "top" },
  });

  const boxClasses = cva("w-full", { variants: { measure: MEASURE } });

  export interface ScreenProps {
    children: ReactNode;
    /** Omitted only when placement is "bleed". */
    measure?: ScreenMeasure;
    pad?: ScreenPad;
    placement?: ScreenPlacement;
    className?: string;
  }

  export interface ScreenLayout {
    scroller: string;
    /** null means bleed: no measure box is drawn at all. */
    box: string | null;
  }

  /**
   * Split out from the component so the whole mapping is provable in the node
   * gate. The scroller string repeats `PaneBody`'s own classes; `cn` collapses
   * the duplicate, and carrying them here is what lets the test assert that a
   * bleeding Review pane is still a scroller.
   */
  /* eslint-disable-next-line react-refresh/only-export-components -- pure mapping, exported for the node gate; a render test cannot tell 860px from 670px without a browser. */
  export function screenLayout(
    props: Omit<ScreenProps, "children" | "className">,
  ): ScreenLayout {
    const { measure, pad = "28x32", placement = "top" } = props;
    if (placement === "bleed") {
      return { scroller: paneClasses({ slot: "body" }), box: null };
    }
    return {
      scroller: cn(paneClasses({ slot: "body" }), scrollerClasses({ pad, placement })),
      box: cn(boxClasses({ measure: measure ?? null })),
    };
  }

  export function Screen({ children, className, ...rest }: ScreenProps): ReactElement {
    const layout = screenLayout(rest);
    return (
      <PaneBody className={cn(layout.scroller, className)}>
        {layout.box === null ? children : <div className={layout.box}>{children}</div>}
      </PaneBody>
    );
  }
  ```

  Create `apps/web-v2/src/shared/ui/Screen.stories.tsx`:

  ```tsx
  import type { Meta, StoryObj } from "@storybook/react-vite";
  import { Screen } from "./Screen";
  import { Card, CardBody } from "./Card";
  import { Eyebrow } from "./Eyebrow";

  const meta = {
    title: "Primitives/Screen",
    component: Screen,
    parameters: { layout: "fullscreen" },
  } satisfies Meta<typeof Screen>;

  export default meta;
  type Story = StoryObj<typeof meta>;

  /** Queue: 860px, 28×32 padding, top-aligned and horizontally centred. */
  export const Top: Story = {
    args: { children: null },
    render: () => (
      <div className="flex h-150 flex-col border border-line-strong">
        <Screen measure="860">
          <Eyebrow variant="screen">Your queue</Eyebrow>
          <Card className="mt-4">
            <CardBody>860px, centred on a full-width scroller.</CardBody>
          </Card>
        </Screen>
      </div>
    ),
  };

  /** Upload: 560px, 40px padding, centred on both axes. */
  export const Centre: Story = {
    args: { children: null },
    render: () => (
      <div className="flex h-150 flex-col border border-line-strong">
        <Screen measure="560" pad="40" placement="centre">
          <Card>
            <CardBody>560px, centred on both axes.</CardBody>
          </Card>
        </Screen>
      </div>
    ),
  };

  /** Review: no measure, no padding — the panes own the frame. */
  export const Bleed: Story = {
    args: { children: null },
    render: () => (
      <div className="flex h-150 flex-col border border-line-strong">
        <Screen placement="bleed">
          <div className="h-full bg-surface-sunken p-8">
            <Eyebrow variant="section">Bleed — no measure, no padding</Eyebrow>
          </div>
        </Screen>
      </div>
    ),
  };
  ```

- [ ] **Step 4: Run — Expected: PASS**

  ```
  pnpm --filter web-v2 test -- --project gates
  ```

  Expected: the ten `Screen's …` tests pass.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/src/shared/ui/Screen.tsx apps/web-v2/src/shared/ui/Screen.test.ts apps/web-v2/src/shared/ui/Screen.stories.tsx
  git commit -m "$(cat <<'EOF'
  Name the export's sixteen screen measures in one primitive

  Eleven hand-rolled wrappers each re-derived the measure/padding rule and
  seven disagreed, including one Tailwind default-scale value in an app whose
  spacing base is 2px. Screen keys the variants on the export's own pixel
  numbers and keeps the measure off the scroller, where auto inline margins
  cancel align-self:stretch.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: `chromeFor` — no ADMIN world for somebody who is not signed in (B3)

**Files:**
- Create: `apps/web-v2/src/app/chromeFor.ts`
- Create: `apps/web-v2/src/app/chromeFor.test.ts`
- Create: `apps/web-v2/e2e/invariants/chrome.spec.ts`
- Modify: `apps/web-v2/src/app/AppChrome.tsx:59-94` (the predicate, the four `enabled` flags and the early return)
- Modify: `apps/web-v2/src/app/OrderStrip.tsx:50-62` (the same predicate)

**Interfaces:**
- Consumes: `orderFromPath(pathname: string): string | null` from `src/app/orderFromPath.ts`; `useAttention(path: string): Attention` from `src/app/attention.ts`; `useNavCollapsed(enabled: boolean, routeDefault?: boolean): [boolean, () => void]` and `useTheme(enabled: boolean): [Preferences["theme"], () => void]` from `src/app/preferences.ts`; `trackApi(page: Page): Promise<void>` and `apiLog(page: Page): Promise<ApiCall[]>` from `e2e/helpers/net.ts`.
- Produces, exactly as pinned in the index:
  ```tsx
  export interface ChromeMode { chrome: boolean; fetches: boolean }
  export function chromeFor(pathname: string): ChromeMode;
  ```

- [ ] **Step 1: Write the failing test**

  Create `apps/web-v2/src/app/chromeFor.test.ts`:

  ```ts
  import { describe, expect, test } from "vitest";
  import { chromeFor } from "./chromeFor";

  /**
   * `AppChrome` and `OrderStrip` both gated on `/blind` alone, so a person who
   * was not signed in got the full 232px sidebar with every ADMIN door and a
   * strip reading "L. Vance / ADMIN". The export gates on
   * `showChrome = !(isSignin||isSession)`.
   */

  describe("chromeFor", () => {
    test("the capture seat gets neither chrome nor requests", () => {
      expect(chromeFor("/blind/ord_demo_1")).toEqual({ chrome: false, fetches: false });
      expect(chromeFor("/blind")).toEqual({ chrome: false, fetches: false });
    });

    test("an unauthenticated viewer gets neither chrome nor requests", () => {
      expect(chromeFor("/signin")).toEqual({ chrome: false, fetches: false });
      expect(chromeFor("/session")).toEqual({ chrome: false, fetches: false });
    });

    test("every other screen gets both", () => {
      for (const path of [
        "/queue",
        "/overview",
        "/rulebook",
        "/orders/ord_demo_1/review",
        "/profile",
        "/nonsense",
      ]) {
        expect(chromeFor(path), path).toEqual({ chrome: true, fetches: true });
      }
    });

    test("a path that merely starts with the same letters is not a match", () => {
      // `/sessions-report` is not the session-ended screen, and `/signin-help`
      // is not the sign-in screen. Prefix matching belongs to `/blind/*` only,
      // because that is the only one with children.
      expect(chromeFor("/sessions-report").chrome).toBe(true);
      expect(chromeFor("/signin-help").chrome).toBe(true);
    });

    test("the two fields are two claims, not one boolean", () => {
      // Conflating "no chrome" with "no requests" is what let the sidebar
      // render on /signin: the only rule anybody had written down was the
      // capture seat's, so every other chromeless screen inherited nothing.
      const modes = ["/blind/x", "/signin", "/session", "/queue"].map(chromeFor);
      expect(modes.every((m) => m.chrome === m.fetches)).toBe(true);
      // …and the SHAPE stays two fields, so /blind can diverge from /signin
      // later without a second predicate appearing beside this one.
      expect(Object.keys(chromeFor("/queue")).sort()).toEqual(["chrome", "fetches"]);
    });
  });
  ```

  Create `apps/web-v2/e2e/invariants/chrome.spec.ts`:

  ```ts
  import { expect, test } from "@playwright/test";
  import { apiLog, trackApi } from "../helpers/net";

  /**
   * [INVARIANT] — rule: the chrome states who you are and what you may open.
   * Drawing it to somebody who is not signed in states a role they do not
   * hold. The export gates the sidebar AND the top strip on
   * `showChrome = !(isSignin||isSession)`; this app gated both on `/blind`
   * alone, so `/signin` rendered the full 232px sidebar with every ADMIN door
   * and a strip reading "L. Vance / ADMIN" (audit B3).
   */
  for (const path of ["/signin", "/session"]) {
    test(`${path} draws no sidebar and no order strip`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByTestId("side-rail")).toHaveCount(0);
      await expect(page.getByTestId("order-strip")).toHaveCount(0);
      await expect(page.getByTestId("account-menu")).toHaveCount(0);
    });

    test(`${path} issues no /api GETs — nobody is authenticated`, async ({ page }) => {
      await trackApi(page);
      await page.goto(path);
      await page.waitForTimeout(800);
      const gets = (await apiLog(page)).filter(
        (c) => c.method === "GET" && c.url.includes("/api/"),
      );
      expect(gets.map((c) => c.url)).toEqual([]);
    });
  }

  /**
   * [INVARIANT] — rule: the capture seat issues ZERO /api GETs. Structural
   * blindness is about what the wire carries, not only what the screen draws
   * (`blind-blindness.spec` #1). `chromeFor` must not weaken this while
   * generalising the chrome gate to /signin and /session.
   */
  test("the capture seat still issues zero /api GETs", async ({ page }) => {
    await trackApi(page);
    await page.goto("/blind/ord_demo_1");
    await page.waitForTimeout(800);
    const gets = (await apiLog(page)).filter(
      (c) => c.method === "GET" && c.url.includes("/api/"),
    );
    expect(gets.map((c) => c.url)).toEqual([]);
  });

  /**
   * The other half of the rule: everywhere else the chrome is present. A gate
   * that turns everything off is not a gate.
   */
  test("a signed-in screen still gets both the rail and the strip", async ({ page }) => {
    await page.goto("/queue");
    await expect(page.getByTestId("side-rail")).toBeVisible();
    await expect(page.getByTestId("order-strip")).toBeVisible();
  });
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  ```
  pnpm --filter web-v2 test -- --project gates
  pnpm --filter web-v2 test:e2e -- e2e/invariants/chrome.spec.ts
  ```

  Expected failures:
  - node: `Error: Failed to resolve import "./chromeFor" from "src/app/chromeFor.test.ts". Does the file exist?`
  - e2e: `/signin draws no sidebar and no order strip` fails on the first assertion — `Expected: 0, Received: 1` for `getByTestId("side-rail")`; `/signin issues no /api GETs` fails with `Expected: []  Received: ["http://localhost:4274/api/me/preferences"]`. The two `/session` tests fail the same way. `the capture seat still issues zero /api GETs` and `a signed-in screen still gets both` pass already — they are the regression half.

- [ ] **Step 3: Implement**

  Create `apps/web-v2/src/app/chromeFor.ts`:

  ```ts
  /**
   * Who gets the chrome, and who gets to make requests.
   *
   * RULE: the sidebar and the order strip state a role and a world. Drawing
   * them to somebody who is not signed in asserts something untrue about them.
   * FAILURE PREVENTED: `AppChrome` and `OrderStrip` each gated on `/blind`
   * alone, so `/signin` rendered the full 232px sidebar with every ADMIN door
   * and a strip reading "L. Vance / ADMIN" — to a viewer with no session at
   * all (audit B3). The export gates both on `showChrome = !(isSignin||isSession)`.
   *
   * TWO FIELDS, NOT ONE BOOLEAN, and this is the point of the file. *No chrome*
   * and *no requests* are different claims. Conflating them is precisely what
   * happened: the only rule anybody had written down was the capture seat's
   * zero-GET rule, so every other chromeless screen inherited nothing. Keeping
   * them separate also means `/blind` can diverge from `/signin` later without
   * a second predicate appearing beside this one.
   *
   * PREFIX MATCHING IS FOR `/blind/*` ONLY — it is the one of the three with
   * children. `/sessions-report` is not the session-ended screen.
   */
  export interface ChromeMode {
    /** Draw the sidebar and the order strip. */
    chrome: boolean;
    /** Issue the preference and attention GETs. */
    fetches: boolean;
  }

  const CHROMELESS = new Set(["/signin", "/session"]);

  export function chromeFor(pathname: string): ChromeMode {
    const bare =
      pathname === "/blind" ||
      pathname.startsWith("/blind/") ||
      CHROMELESS.has(pathname);
    return { chrome: !bare, fetches: !bare };
  }
  ```

  Modify `apps/web-v2/src/app/AppChrome.tsx`:

  1. Add to the import block, after the `orderFromPath` import:
     ```tsx
     import { chromeFor } from "./chromeFor";
     ```
  2. Replace lines 63–70 (`const onCaptureSeat = …` through `const [theme] = useTheme(!onCaptureSeat);`) with:
     ```tsx
     const { chrome, fetches } = chromeFor(pathname);
     const onReview = /^\/orders\/[^/]+\/review/.test(pathname);
     // Review starts collapsed on first mount; the preference wins once loaded.
     const [collapsed, toggleCollapsed] = useNavCollapsed(fetches, onReview);
     // Same rule as the collapse: no theme fetch where no GET is legitimate.
     // Only the VALUE is needed here now (the toggle moved to `OrderStrip` with
     // `AccountMenu`) — this call still owns the `data-theme` effect below.
     // On a chromeless screen the theme falls back to the default, which is
     // correct rather than unfortunate: reading a person's preference before
     // they have a session is a request nobody has authorised.
     const [theme] = useTheme(fetches);
     ```
  3. Replace line 82 with:
     ```tsx
     const escalationAttention = useAttention(fetches ? "/escalations" : "");
     ```
  4. Replace line 87 with:
     ```tsx
     const orderId = fetches ? orderFromPath(pathname) : null;
     ```
  5. Replace line 94 (`if (onCaptureSeat) return null;`) with:
     ```tsx
     if (!chrome) return null;
     ```
  6. In the component's doc comment, replace the paragraph beginning `IT IS ABSENT ON THE CAPTURE SEAT, structurally, not cosmetically.` with:
     ```
      * IT IS ABSENT WHEREVER THE CHROME WOULD LIE, structurally, not
      * cosmetically — `chromeFor` owns the list. On the capture seat, because a
      * typist on a blind pass must not see the pipeline's world: the doors name
      * screens that tell them what the machine already thinks. On `/signin` and
      * `/session`, because there is no session to describe. The preference fetch
      * and the attention query are disabled with it, so those screens issue zero
      * /api GETs (`blind-blindness.spec`, `chrome.spec`); removing the rail is
      * the same rule that kills the keyboard layer on `/blind/*`.
     ```

  Modify `apps/web-v2/src/app/OrderStrip.tsx`:

  1. Add to the import block, after the `orderFromPath` import:
     ```tsx
     import { chromeFor } from "./chromeFor";
     ```
  2. Replace line 52 (`const onCaptureSeat = pathname.startsWith("/blind");`) with:
     ```tsx
     const { chrome, fetches } = chromeFor(pathname);
     ```
  3. Replace line 56 with:
     ```tsx
     const [theme, toggleTheme] = useTheme(fetches);
     ```
  4. Replace lines 57–62 (the `useQuery` call and `if (onCaptureSeat) return null;`) with:
     ```tsx
     const { data: signoff } = useQuery({
       ...signoffQuery(orderId ?? ""),
       enabled: fetches && orderId !== null,
     });

     if (!chrome) return null;
     ```
  5. Append to the component's doc comment, immediately before `NO ORDER, NO FABRICATION`:
     ```
      * IT IS ABSENT WHERE THE CHROME WOULD LIE — `chromeFor` decides, the same
      * predicate `AppChrome` reads. The strip carries the account chip, so on
      * `/signin` it used to name a role for somebody with no session.
     ```

- [ ] **Step 4: Run — Expected: PASS**

  ```
  pnpm --filter web-v2 test -- --project gates
  pnpm --filter web-v2 test:e2e -- e2e/invariants/chrome.spec.ts e2e/invariants/sidebar.spec.ts
  ```

  Expected: the five `chromeFor` node tests pass; all six tests in `chrome.spec.ts` pass; `sidebar.spec.ts` is unchanged and still passes (its capture-seat test asserts the same absence through the new predicate).

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/src/app/chromeFor.ts apps/web-v2/src/app/chromeFor.test.ts apps/web-v2/src/app/AppChrome.tsx apps/web-v2/src/app/OrderStrip.tsx apps/web-v2/e2e/invariants/chrome.spec.ts
  git commit -m "$(cat <<'EOF'
  Stop drawing the ADMIN chrome to a viewer with no session

  /signin and /session rendered the full 232px sidebar and a strip reading
  "L. Vance / ADMIN", because AppChrome and OrderStrip each gated on /blind
  alone. chromeFor names all three chromeless paths in one place and keeps
  "no chrome" and "no requests" as two fields, since conflating them is what
  let every non-capture-seat screen inherit no rule at all.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: The root layout swap — the fixed-height frame and a full-width `main` (B1 + B2)

**Files:**
- Modify: `apps/web-v2/src/app/rootRoute.tsx:22-59` (the whole `component`)
- Modify: `apps/web-v2/src/entities/nav/Sidebar.tsx:73-76` (the `aside` class list)
- Modify: `apps/web-v2/src/app/OrderStrip.tsx:72-75` (the strip's own class list)
- Create: `apps/web-v2/e2e/invariants/shell-frame.spec.ts`

**Interfaces:**
- Consumes: `paneClasses` and `Screen` from Tasks 1 and 2; `cn` from `src/shared/ui/classNames`; `AppChrome()`, `OrderStrip()`, `GlobalKeys()`, `NotFound` unchanged.
- Produces: no new exported signature. The layout contract it establishes, which Wave 4 depends on:
  - the root is `flex h-screen overflow-hidden`;
  - `<main>` is `paneClasses({ slot: "pane" })` plus `min-w-0 flex-1` — a full-width flex column with **no** scroller and **no** measure;
  - the outlet is wrapped in a single transitional `<Screen measure="1340">`, which **Wave 4's first task deletes** as it gives each screen its own `Screen` root. Nesting a per-screen `Screen` inside this one would produce two scrollers and two paddings, so the deletion is not optional.

- [ ] **Step 1: Write the failing test**

  Create `apps/web-v2/e2e/invariants/shell-frame.spec.ts`:

  ```ts
  import { expect, test, type Locator } from "@playwright/test";

  /**
   * [INVARIANT] — rule: the app is ONE FRAME. The export roots at
   * `height:100vh;overflow:hidden` and scrolls only the screen body, so the
   * rail, the order strip and every docked bar stay where they are put. This
   * app rooted at `min-h-screen` and page-scrolled: Review captured at 3276px
   * against the export's single 1000px frame, and the order ref, four counts
   * and stamp scrolled off every long screen (audit B1).
   *
   * [INVARIANT] — rule: `main` FILLS the content column. Auto inline margins on
   * a flex item cancel `align-self:stretch`, so `mx-auto` on `flex-1` sized
   * `main` shrink-to-fit and Queue drew 670px where it asked for 860px
   * (audit B2). No viewport-width guard catches this — the binding constraint
   * is the container (HANDOFF-UI §6) — so the assertion is on the box.
   */

  async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (box === null) throw new Error("element has no box — it is not rendered");
    return box;
  }

  test("the page never scrolls — the frame is one viewport tall", async ({ page }) => {
    await page.goto("/orders/ord_demo_1/review");
    await expect(page.getByTestId("order-strip")).toBeVisible();
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement;
      return el === null ? -1 : el.scrollHeight - el.clientHeight;
    });
    expect(overflow).toBe(0);
  });

  test("main fills the content column", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/queue");
    const rail = await boxOf(page.getByTestId("side-rail"));
    const main = await boxOf(page.locator("main"));
    // 1600 viewport − the rail's own width, to the pixel the browser rounds to.
    expect(main.width).toBeGreaterThanOrEqual(1600 - rail.width - 1);
  });

  test("the order strip stays put while the screen scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/orders/ord_demo_1/review");
    const strip = page.getByTestId("order-strip");
    const before = await boxOf(strip);
    await page.mouse.move(900, 600);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(300);
    // something inside the frame scrolled…
    const scrolled = await page.evaluate(
      () => [...document.querySelectorAll("*")].filter((e) => e.scrollTop > 0).length,
    );
    expect(scrolled).toBeGreaterThan(0);
    // …and it was not the strip's own position.
    const after = await boxOf(strip);
    expect(after.y).toBe(before.y);
  });

  test("the rail is a full-height column, not a page-sticky element", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/rulebook");
    const rail = await boxOf(page.getByTestId("side-rail"));
    expect(rail.y).toBe(0);
    expect(rail.height).toBe(1000);
  });
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  ```
  pnpm --filter web-v2 test:e2e -- e2e/invariants/shell-frame.spec.ts
  ```

  Expected failures:
  - `the page never scrolls` — `Expected: 0  Received: 2276` (Review is 3276px in a 1000px viewport).
  - `main fills the content column` — `Expected: >= 1367  Received: 670`ish; `main` is shrink-wrapped by `mx-auto`.
  - `the order strip stays put while the screen scrolls` — `scrolled` is `0` (nothing inside scrolls; the page does), so `expect(scrolled).toBeGreaterThan(0)` fails.
  - `the rail is a full-height column` passes already (`sticky top-0 h-screen`) and must keep passing after the change.

- [ ] **Step 3: Implement**

  Replace the whole of `apps/web-v2/src/app/rootRoute.tsx` with:

  ```tsx
  import { createRootRoute, Outlet } from "@tanstack/react-router";
  import { GlobalKeys } from "./GlobalKeys";
  import { AppChrome } from "./AppChrome";
  import { OrderStrip } from "./OrderStrip";
  import { NotFound } from "./Placeholders";
  import { cn } from "../shared/ui/classNames";
  import { paneClasses } from "../shared/ui/Pane";
  import { Screen } from "../shared/ui/Screen";

  /**
   * Routes are guards and wiring only — no logic (BRIEF §7).
   *
   * Declared one by one rather than generated from a list: `addChildren` needs
   * the literal tuple to infer the route tree, and that inference is what makes
   * `navigate({ to: "/orders/$orderId/review", params: { orderId } })` a compile
   * error when the path or the param name is wrong. A loop costs fewer lines and
   * throws that away.
   *
   * THERE IS NO ROUTE-LEVEL ROLE GUARD, deliberately. A role's world is enforced
   * two ways the harvested specs actually assert: the door is ABSENT from the hub
   * and the map, and the chord refuses to open it (`roles.spec` ×4). Both read
   * the same `canAccess` table the server gates with, and the server refuses the
   * data regardless — which is the layer that matters.
   */
  export const rootRoute = createRootRoute({
    component: () => (
      <>
        <GlobalKeys />
        {/*
          THE APP IS ONE FRAME, not a long page. The export roots at
          `height:100vh;overflow:hidden` and repeats `height:100%;overflow:auto`
          on every screen body; this rooted at `min-h-screen` and page-scrolled,
          so Review captured at 3276px against the export's single 1000px frame
          and the order ref, four counts and stamp scrolled off every long
          screen — falsifying the strip's own stated reason for existing.

          THE RAIL SITS BESIDE THE CONTENT, not above it (§11). AppChrome renders
          the left sidebar, or nothing where the chrome would lie (`chromeFor`) —
          a null sibling just leaves the content column as the sole flex child at
          full width, which is the structural-blindness rule made layout.

          THE CONTENT SIDE IS A COLUMN: `OrderStrip` — the full-width order-context
          bar (§11 2026-07-30 revision) — sits above `main` inside its own flex
          column, beside the sidebar rather than a third row-level sibling. Both
          read `chromeFor` from the URL independently rather than one gating the
          other.

          `main` IS FULL-WIDTH AND HOLDS NO MEASURE. It was
          `mx-auto min-w-0 max-w-720 flex-1 p-9`, and auto inline margins on a
          flex item cancel `align-self:stretch` — so `main` sized shrink-to-fit,
          Queue asked for 860px and drew 670px, and Profile, which asks for
          nothing, collapsed to its content's 421px where the export draws a
          720px column. The measure now lives on an inner centred box inside
          `Screen`, which is the only shape that fixes both.

          THE `Screen` BELOW IS TRANSITIONAL. Until Wave 4 gives each screen its
          own `Screen` root from the spec's table, one wrapper here keeps every
          screen scrollable and padded inside the new frame, at the widest
          measure the export draws — the shell's maximum belongs to the widest
          screen, not the narrowest. Wave 4's first task DELETES it; a per-screen
          `Screen` nested inside this one would be two scrollers and two paddings.
        */}
        <div className="flex h-screen overflow-hidden">
          <AppChrome />
          <div className="flex min-w-0 flex-1 flex-col">
            <OrderStrip />
            <main className={cn(paneClasses({ slot: "pane" }), "min-w-0 flex-1")}>
              <Screen measure="1340">
                <Outlet />
              </Screen>
            </main>
          </div>
        </div>
      </>
    ),
    notFoundComponent: NotFound,
  });
  ```

  Modify `apps/web-v2/src/entities/nav/Sidebar.tsx`. Replace the `className={cn(…)}` argument on the `aside` (lines 73–76) with:

  ```tsx
        className={cn(
          "flex h-full min-h-0 shrink-0 flex-col gap-4 overflow-y-auto border-r border-line-strong bg-surface-panel py-4",
          isCollapsed ? "w-39 px-2" : "w-116 px-3",
        )}
  ```

  and add, immediately after the `- FORCED collapse at narrow widths, …` bullet in the component's doc comment:

  ```
   *   - FULL HEIGHT, NOT STICKY. It was `sticky top-0 h-screen`, which is what a
   *     rail needs on a page that scrolls. The shell is a fixed-height frame now
   *     (`rootRoute`), so the rail is simply a flex item that fills it: `h-full`
   *     with `min-h-0` so its own body scrolls instead of stretching the row.
  ```

  Modify `apps/web-v2/src/app/OrderStrip.tsx`. Replace the strip's `className` (line 74) with:

  ```tsx
        className="flex flex-none items-center justify-between gap-6 border-b border-line-strong bg-surface-panel px-9 py-4"
  ```

  (`flex-none` is the export's `flex:0 0 auto` on the header — a bar that can shrink is a bar that disappears when the pane below it is full.)

- [ ] **Step 4: Run — Expected: PASS**

  ```
  pnpm --filter web-v2 test:e2e -- e2e/invariants/shell-frame.spec.ts
  ```

  Expected: all four tests pass.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

  Then, because this task changes the layout every harvested invariant clicks through, run the whole e2e suite before committing:

  ```
  pnpm --filter web-v2 test:e2e
  ```

  Expected: the same pass/skip counts as the 2026-07-30 baseline, plus the ten new tests from Tasks 3 and 4. A test that now fails on "element is outside of the viewport" is a selector working around the old page-scroll and may have its selector rewritten; **an assertion may not be weakened** (`e2e/invariants/README.md`).

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/src/app/rootRoute.tsx apps/web-v2/src/entities/nav/Sidebar.tsx apps/web-v2/src/app/OrderStrip.tsx apps/web-v2/e2e/invariants/shell-frame.spec.ts
  git commit -m "$(cat <<'EOF'
  Make the shell one frame and stop shrink-wrapping main

  The root was min-h-screen and page-scrolled, so Review drew 3276px against
  the export's single 1000px frame and the order strip scrolled away on every
  long screen. main also carried mx-auto on a flex-1 flex item, which cancels
  align-self:stretch: Queue asked for 860px and got 670px, Profile collapsed
  to 421px where the export draws 720px. main is full-width now and the
  measure moved onto Screen's inner box, which fixes both together.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: Teach `knip` to stop counting `.stories.tsx` as usage

**Files:**
- Modify: `apps/web-v2/knip.json` (the `project` array)
- Create: `apps/web-v2/knip.production.jsonc`
- Modify: `apps/web-v2/package.json` (the `knip` script)

**Interfaces:**
- Consumes: nothing from earlier tasks. It must run **after** Task 4, because `Pane.tsx` and `Screen.tsx` only become production-reachable when `rootRoute` imports them.
- Produces: `pnpm --filter web-v2 knip` now means *two* passes — the existing holistic one, then a production pass that reports any file in `src/` that no production entry can reach.

  **Why this is the fix.** Fourteen components were built and then bypassed while `features/review/` reimplemented them, and knip reported nothing, because a `.stories.tsx` file is an entry and importing a component from an entry counts as usage. Knip's `--production` mode walks only patterns suffixed `!`, which excludes stories, tests and specs by construction — so the story stops laundering the import.

- [ ] **Step 1: Write the failing test**

  There is no test file here; the gate *is* the check, and it must be shown red before it is made green. Add the production config with an **empty** `ignore` array first — create `apps/web-v2/knip.production.jsonc` exactly as in Step 3 but with `"ignore": []` — and add `"src/**/*.{ts,tsx}!"` to `knip.json`'s `project` array (replacing `"src/**/*.{ts,tsx}"`).

- [ ] **Step 2: Run it — Expected: FAIL**

  ```
  cd apps/web-v2 && npx knip --no-progress -c knip.production.jsonc --production --include files
  ```

  Expected: exit code **1** and this exact report —

  ```
  Unused files (19)
  src/entities/document/CitedText.tsx
  src/entities/document/DocumentPane.tsx
  src/entities/document/pageFixture.ts
  src/entities/document/ZoomControls.tsx
  src/entities/field/DecisionBar.tsx
  src/entities/field/DecisionCard.tsx
  src/entities/field/EngineReadings.tsx
  src/entities/field/FieldRow.tsx
  src/entities/field/FieldValue.tsx
  src/entities/field/PageChip.tsx
  src/entities/field/ProvenancePanel.tsx
  src/entities/order/StageList.tsx
  src/entities/rule/ProvenanceBadge.tsx
  src/shared/money.ts
  src/shared/ui/Checkbox.tsx
  src/shared/ui/ClaimVsEvidence.tsx
  src/shared/ui/DestructiveConfirm.tsx
  src/shared/ui/RequiredComment.tsx
  src/shared/ui/Tooltip.tsx
  ```

  That is the audit's fourteen plus five it did not name: the four-file `entities/document` kit that `features/review`'s own document column bypasses, and `shared/money.ts`, a formatter with a test and no caller. **Nothing is deleted here.** Wave 3 and Wave 4 adopt or delete each one; this task's job is to make the next one impossible to miss.

- [ ] **Step 3: Implement**

  `apps/web-v2/knip.json` — replace the `project` array with:

  ```json
    "project": ["src/**/*.{ts,tsx}!", ".storybook/**/*.ts", "scripts/*.mjs"],
  ```

  (The `!` marks the pattern as also-production. Nothing else in this file changes; the holistic pass behaves exactly as before.)

  Create `apps/web-v2/knip.production.jsonc`:

  ```jsonc
  // THE BYPASSED-COMPONENT GATE.
  //
  // RULE: a component with no PRODUCTION call site is either adopted or
  // deleted — never left standing beside a screen that reimplements it.
  // FAILURE PREVENTED: fourteen components were built and then bypassed while
  // features/review/ reimplemented all of them, and the duplicates are the ones
  // that drifted — the DEAD entities/field/DecisionBar carries the export's
  // exact button copy and the LIVE features/review/DecisionActions does not.
  // The holistic knip run reported none of it, because a .stories.tsx file is
  // an entry and importing a component from an entry counts as usage. This
  // config runs with --production, which walks only patterns suffixed `!` and
  // therefore never sees a story, a spec or a test.
  //
  //   npx knip -c knip.production.jsonc --production --include files
  //
  // Scoped to `files` deliberately: production mode also reclassifies every
  // devDependency, which is noise, not signal. The signal is "nothing reaches
  // this file from main.tsx".
  //
  // EVERY WAIVER BELOW IS A DEBT WITH AN OWNER. Shrink this list; never grow
  // it. A new entry means a component was built and bypassed again.
  {
    "project": ["src/**/*.{ts,tsx}!"],
    "ignore": [
      // ── entities/field — the kit features/review/ reimplemented (audit §2 item 11).
      // Wave 3 wires Review onto these or deletes them; the Reader A/B collapse
      // (owner ruling, 2026-07-30) decides what DecisionCard must contain first.
      "src/entities/field/DecisionBar.tsx",
      "src/entities/field/DecisionCard.tsx",
      "src/entities/field/EngineReadings.tsx",
      "src/entities/field/FieldRow.tsx",
      "src/entities/field/FieldValue.tsx",
      "src/entities/field/PageChip.tsx",
      "src/entities/field/ProvenancePanel.tsx",

      // ── entities/document — the document kit features/review/'s own column
      // bypasses. Not named in the audit's fourteen; this gate found it.
      // Wave 4 (Review) adopts or deletes, with PageSpine (audit §2 item 23).
      "src/entities/document/CitedText.tsx",
      "src/entities/document/DocumentPane.tsx",
      "src/entities/document/ZoomControls.tsx",
      "src/entities/document/pageFixture.ts",

      // ── entities — one-off primitives with a story and no screen.
      // Wave 3 (entities) adopts or deletes.
      "src/entities/order/StageList.tsx",
      "src/entities/rule/ProvenanceBadge.tsx",

      // ── shared/ui — built, storied, never called.
      // RequiredComment is Wave 1's source for RefusalNudge and ReasonEditor and
      // is deleted when they land. The other four are Wave 3/4 adopt-or-delete.
      "src/shared/ui/Checkbox.tsx",
      "src/shared/ui/ClaimVsEvidence.tsx",
      "src/shared/ui/DestructiveConfirm.tsx",
      "src/shared/ui/RequiredComment.tsx",
      "src/shared/ui/Tooltip.tsx",

      // ── a tested formatter with no caller. Not named in the audit's fourteen.
      // Wave 5 uses it wherever the export prints money, or deletes it with its
      // test. It must not be deleted silently: money.test.ts documents the UTC
      // bug it exists to prevent.
      "src/shared/money.ts"
    ]
  }
  ```

  `apps/web-v2/package.json` — replace the `knip` script with:

  ```json
      "knip": "knip && knip -c knip.production.jsonc --production --include files",
  ```

- [ ] **Step 4: Run — Expected: PASS**

  ```
  pnpm --filter web-v2 knip
  ```

  Expected: the holistic pass reports its four `Unused exported types` warnings (unchanged from baseline) and the production pass prints nothing. Exit code 0.

  Then prove the gate bites, and undo it:

  ```
  cd apps/web-v2 && printf 'export function neverCalled(): string {\n  return "";\n}\n' > src/shared/deadCanary.ts && npx knip --no-progress -c knip.production.jsonc --production --include files; echo "exit=$?"; rm src/shared/deadCanary.ts
  ```

  Expected: `Unused files (1) / src/shared/deadCanary.ts` and `exit=1`.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/knip.json apps/web-v2/knip.production.jsonc apps/web-v2/package.json
  git commit -m "$(cat <<'EOF'
  Make knip catch a component that was built and then bypassed

  Fourteen components have no production call site while features/review/
  reimplements them, and knip reported nothing: a .stories.tsx file is an
  entry, so importing a component from a story counts as usage. A second pass
  in --production mode walks only production patterns and finds all fourteen,
  plus the document kit and money.ts the audit did not name. All nineteen are
  waived by name with the wave that owns each; the list may only shrink.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Fix `compare.mjs`, retire the scratch harness, correct the dev port

**Files:**
- Modify: `apps/web-v2/compare.mjs` (whole file)
- Delete: `apps/web-v2/tmp-audit.mjs`
- Modify: `.claude/launch.json:8` (`"port": 5173` → `"port": 5174`)

**Interfaces:**
- Consumes: nothing from earlier tasks. `chromium` from `@playwright/test`, already a devDependency.
- Produces: a new CLI contract for the tool, documented in its own header —
  ```
  node compare.mjs <screen-key> <out-dir>     # one pair
  node compare.mjs --all <out-dir>            # all 18 pairs
  node compare.mjs --check                    # resolve every click path, capture nothing
  ```
  Keys: `queue overview upload questions processing completeness review delivered rulebook products clients people audit gallery escalation profile session signin`.
  The old `<DesignMenuLabel> <app-route> <out-dir>` form is gone: the app route now comes from the table, which also retires the Git-Bash leading-slash workaround (HANDOFF-UI §6) because no argument starts with `/` any more.

- [ ] **Step 1: Write the failing test**

  There is no CI harness for a tool that needs two live servers, so the failing check is a **reproduction with an objective verdict**: ask the current tool for two different design screens and compare the bytes it writes.

  Start both servers (leave them running for Step 4):

  ```
  pnpm --filter web-v2 dev &
  npx --yes serve -l 4600 "C:/Users/vicky/AppData/Local/Temp/claude/C--Users-vicky-Desktop-TitleSearch/09aca728-2580-4eef-9db1-cc54075f2264/scratchpad/design" &
  ```

  The reproduction:

  ```
  cd apps/web-v2 && node compare.mjs Queue /queue ../../shots-check && node compare.mjs Rulebook /rulebook ../../shots-check && cmp -s ../../shots-check/design-queue.png ../../shots-check/design-rulebook.png && echo "BUG: two different screens, byte-identical design capture"
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  Run the reproduction above. Expected output includes, from the second invocation:

  ```
  ! no design menu button named "Rulebook" — captured the default screen
  ```

  and then:

  ```
  BUG: two different screens, byte-identical design capture
  ```

  The design's sidebar is an `<aside>`; the only `<nav>` in `TitlePipe.dc.html` is Review's section rail, so `nav button` has never matched a door. Every design screenshot this tool has written was the default Queue screen.

- [ ] **Step 3: Implement**

  Replace the whole of `apps/web-v2/compare.mjs` with:

  ```js
  /**
   * Side-by-side capture: the approved design vs web-v2.
   *
   * Kept, not temporary. This is the tool that found the review sheet rendering
   * its values outside their own rows, the lifecycle board hiding two stages
   * behind a scrollbar, and the delivered screen confirming the wrong order —
   * all of them invisible to a green test suite. It lives in apps/web-v2
   * because that is where `@playwright/test` resolves from.
   *
   *   node compare.mjs <screen-key> <out-dir>
   *   node compare.mjs --all <out-dir>
   *   node compare.mjs --check
   *
   * IT USED TO SELECT THE DESIGN'S DOORS WITH `nav button`. The export's
   * sidebar is an <aside>; the only <nav> in the file is Review's section rail.
   * The selector matched nothing, the tool warned and carried on, and EVERY
   * design screenshot it ever wrote was the default Queue screen. Two things
   * changed: the click paths below are the ones that actually drive the export
   * (three screens sit behind the account menu and escalation behind a queue
   * row), and an unmatched label is now a non-zero exit instead of a warning.
   * A tool that fails silently is worse than no tool — the pictures looked
   * right and were the wrong screen.
   *
   * The app route comes from the table too, so no argument starts with "/" and
   * the Git-Bash path-rewriting workaround (HANDOFF-UI §6) is no longer needed.
   *
   * Requires both servers already running (do NOT start or kill them):
   *   http://localhost:5174  web-v2 dev server (vite.config.ts sets server.port)
   *   http://localhost:4600  the design export (TitlePipe.dc.html)
   */
  import { chromium } from "@playwright/test";
  import { mkdirSync } from "node:fs";

  /** `menu: true` opens the identity menu in the top strip before clicking. */
  const SCREENS = [
    { key: "queue", route: "/queue", click: ["Queue"] },
    { key: "overview", route: "/overview", click: ["Overview"] },
    { key: "upload", route: "/ingest", click: ["Upload"] },
    { key: "questions", route: "/questions", click: ["Questions"] },
    { key: "processing", route: "/processing", click: ["Processing"] },
    { key: "completeness", route: "/completeness", click: ["Completeness"] },
    { key: "review", route: "/orders/ord_demo_1/review", click: ["Review"] },
    { key: "delivered", route: "/delivered", click: ["Delivered"] },
    { key: "rulebook", route: "/rulebook", click: ["Rulebook"] },
    { key: "products", route: "/products", click: ["Products & sign-off"] },
    { key: "clients", route: "/clients", click: ["Clients"] },
    { key: "people", route: "/people", click: ["People"] },
    { key: "audit", route: "/audit", click: ["Audit"] },
    { key: "gallery", route: "/gallery", click: ["States"] },
    { key: "escalation", route: "/escalations", click: ["Queue", "Open →"] },
    { key: "profile", route: "/profile", menu: true, click: ["Profile"] },
    { key: "session", route: "/session", menu: true, click: ["Session ended · demo"] },
    { key: "signin", route: "/signin", menu: true, click: ["Sign out"] },
  ];

  const KEYS = SCREENS.map((s) => s.key).join(" ");
  const [first, second] = process.argv.slice(2);
  const check = first === "--check";
  const all = first === "--all";
  const out = check ? null : all ? second : second;

  if (!first || (!check && !out)) {
    console.error("usage: node compare.mjs <screen-key|--all> <out-dir>  |  node compare.mjs --check");
    console.error(`keys: ${KEYS}`);
    process.exit(1);
  }

  const wanted = check || all ? SCREENS : SCREENS.filter((s) => s.key === first);
  if (wanted.length === 0) {
    console.error(`unknown screen key "${first}"\nkeys: ${KEYS}`);
    process.exit(1);
  }
  if (out !== null) mkdirSync(out, { recursive: true });

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** Clicks one label, or throws. A miss used to be a warning and a wrong picture. */
  async function clickLabel(page, key, label) {
    const exact = page.locator("button", { hasText: new RegExp(`^\\s*${esc(label)}\\s*$`) }).first();
    if (await exact.count()) {
      await exact.click();
    } else {
      const loose = page.locator("button", { hasText: label }).first();
      if (!(await loose.count())) throw new Error(`${key}: no design button matching "${label}"`);
      await loose.click();
    }
    await page.waitForTimeout(500);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const design = await ctx.newPage();
  const app = await ctx.newPage();
  const appErrors = [];
  app.on("pageerror", (e) => appErrors.push(e.message));
  const failures = [];

  for (const s of wanted) {
    try {
      await design.goto("http://localhost:4600/TitlePipe.dc.html");
      await design.waitForTimeout(1800);
      if (s.menu) {
        await design.locator("header button", { hasText: "R. Delacroix" }).first().click();
        await design.waitForTimeout(250);
      }
      for (const label of s.click) await clickLabel(design, s.key, label);
      await design.waitForTimeout(500);
      if (out !== null) {
        await design.screenshot({ path: `${out}/design-${s.key}.png`, fullPage: true });
        await app.goto(`http://localhost:5174${s.route}`, { waitUntil: "networkidle" });
        await app.waitForTimeout(900);
        await app.screenshot({ path: `${out}/app-${s.key}.png`, fullPage: true });
      }
      console.log(`${out === null ? "resolved" : "captured"} ${s.key}`);
    } catch (e) {
      failures.push(e.message);
      console.error(`FAILED ${s.key}: ${e.message}`);
    }
  }

  await browser.close();
  if (appErrors.length) console.log("APP PAGE ERRORS:\n" + [...new Set(appErrors)].join("\n"));
  if (failures.length) process.exit(1);
  ```

  Delete the scratch harness:

  ```
  git rm apps/web-v2/tmp-audit.mjs
  ```

  Modify `.claude/launch.json` — change `"port": 5173` to `"port": 5174`. `apps/web-v2/vite.config.ts` sets `server: { port: 5174 }`, so the launch config has been pointing at a port nothing serves; `compare.mjs`, `tmp-audit.mjs` and the audit's own capture runs all use 5174.

- [ ] **Step 4: Run — Expected: PASS**

  ```
  cd apps/web-v2 && node compare.mjs --check
  ```

  Expected: eighteen `resolved <key>` lines and exit 0.

  ```
  cd apps/web-v2 && rm -rf ../../shots-check && node compare.mjs queue ../../shots-check && node compare.mjs rulebook ../../shots-check && cmp -s ../../shots-check/design-queue.png ../../shots-check/design-rulebook.png; echo "identical=$?"
  ```

  Expected: `identical=1` — the two design captures now differ, which is the whole point. Open `../../shots-check/design-rulebook.png` and confirm it is the Rulebook screen.

  And confirm the tool now fails loudly rather than capturing the wrong screen:

  ```
  cd apps/web-v2 && node compare.mjs nonsense ../../shots-check; echo "exit=$?"
  ```

  Expected: `unknown screen key "nonsense"` and `exit=1`.

  Finally remove the scratch output: `rm -rf ../../shots-check`.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add apps/web-v2/compare.mjs .claude/launch.json
  git rm --cached -f apps/web-v2/tmp-audit.mjs 2>/dev/null; git add -A apps/web-v2/tmp-audit.mjs
  git commit -m "$(cat <<'EOF'
  Make compare.mjs capture the screen it was asked for

  It selected the design's doors with `nav button`, but the export's sidebar is
  an <aside> and its only <nav> is Review's section rail — so the selector never
  matched, the tool warned and carried on, and every design screenshot it ever
  wrote was the default Queue screen. The click paths from the audit harness
  move in, covering all eighteen screens including the three behind the account
  menu and escalation behind a queue row, and an unmatched label now exits
  non-zero. tmp-audit.mjs goes with it. launch.json pointed at 5173; vite serves
  5174.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Close the wave

**Files:**
- Modify: none. This task produces evidence, not code.
- Test: the whole suite.

**Interfaces:**
- Consumes: everything Tasks 1–6 produced.
- Produces: the recorded baseline Wave 1–5 measure themselves against, and eighteen fresh screenshot pairs taken with a `compare.mjs` that works.

- [ ] **Step 1: Write the failing test**

  Nothing new is written. The check is the union of every gate, run in one sequence from the repo root:

  ```
  pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip && pnpm --filter web-v2 test:e2e && pnpm typecheck
  ```

- [ ] **Step 2: Run it — Expected: FAIL**

  Expected only if a task was skipped or landed out of order. The two ways this legitimately goes red, and what each means:
  - `knip` production pass names `src/shared/ui/Pane.tsx` or `src/shared/ui/Screen.tsx` → Task 4 has not landed, so nothing production-reachable imports them. Land Task 4, do not add them to the waiver list.
  - an e2e test fails on "element is outside of the viewport" → a selector was relying on the page scrolling. Rewrite the selector; never weaken the assertion (`e2e/invariants/README.md`).

- [ ] **Step 3: Implement**

  Nothing to implement. Capture the eighteen pairs with the fixed tool, with both servers running:

  ```
  cd apps/web-v2 && node compare.mjs --all ../../shots-w0
  ```

  Look at all eighteen pairs. A green suite is not evidence the UI is right (spec §Verification). Three things this wave is expected to have changed and must be visible in the pairs: `app-signin.png` and `app-session.png` now show a bare centred card with no rail and no strip; every `app-*.png` is one viewport tall rather than a long page; `app-queue.png`'s column is wider than it was. Everything still wrong is Wave 1–5 work and must **not** be fixed here.

- [ ] **Step 4: Run — Expected: PASS**

  The Step 1 sequence, all green. Record the numbers in the commit message: the vitest count (baseline 297 + 15 new node tests from Tasks 1–3), the `check:rules` file count, and the e2e pass/skip counts.

- [ ] **Step 5: Full gate** — `pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip`

- [ ] **Step 6: Commit**

  ```
  git add docs/superpowers/plans/2026-07-30-design-fidelity-w0-shell.md
  git commit --allow-empty -m "$(cat <<'EOF'
  Close Wave 0: the shell is a frame, the chrome is honest, the gates bite

  Records the post-wave baseline every later wave measures against: vitest,
  check:rules file count, e2e pass/skip, knip holistic + production both clean.
  Eighteen screenshot pairs re-captured with the corrected compare.mjs and
  looked at; every remaining divergence is Wave 1-5 work and was left alone.

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Handoff to Wave 4

Two obligations this wave creates and cannot discharge itself:

1. **Delete the transitional `<Screen measure="1340">` in `rootRoute.tsx`** in Wave 4's first task, as Review takes its own `<Screen placement="bleed">`. Two nested `Screen`s are two scrollers and two paddings.
2. **Shrink `knip.production.jsonc`'s waiver list.** Nineteen entries, each named with the wave that owns it. Wave 3 clears the `entities/*` block and the four `shared/ui` adopt-or-deletes; Wave 1 clears `RequiredComment` when `RefusalNudge` and `ReasonEditor` land; Wave 4 clears `entities/document`; Wave 5 clears `money.ts`. The list may only shrink.

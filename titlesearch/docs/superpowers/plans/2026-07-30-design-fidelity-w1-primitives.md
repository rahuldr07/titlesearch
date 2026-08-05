# [Wave 1] — The Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the eleven shared primitives and the two axis corrections Wave 4 assembles screens from, adopting each one at every call site it collapses in the same commit.

**Architecture:** Twelve independent tasks, each owning one primitive and its adoption. Nothing here reworks a screen's layout, data or copy — a task changes *which component draws a thing*, never *what the thing says*. Presentational primitives live in `src/shared/ui/`; the two that need `@tanstack/react-router` (`ScreenHeading`) stay in `src/app/`, because `check:rules` refuses a router import under `src/shared` or `src/entities`.

**Prerequisites:** Wave 0 complete (`AppShell`/`Pane`/`Screen`, `chromeFor()`, the `knip` gate). Task 10 consumes `ScreenMeasure` from `src/shared/ui/Screen.tsx`, which Wave 0 creates. Wave 2 runs concurrently — it touches only `packages/mocks` and `packages/contract` and shares no file with this plan.

**Constraints:** The Global Constraints in the plan index apply to every task. Unique to this wave: **a task is not done until its primitive has replaced the hand-rolled markup at every site the task names** — building a primitive without adopting it is the exact failure (fourteen built-and-bypassed components) this wave exists to end, and `knip` after Wave 0 will fail a component whose only consumer is its story.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `apps/web-v2/src/app/ScreenHeading.tsx` | Eyebrow + h1 + lede as one unit; the eyebrow is the link back to the hub. Replaces `app/ScreenTitle.tsx`. |
| `apps/web-v2/src/app/ScreenHeading.stories.tsx` | Its story test — both sizes, the lede-less case, the link-to-hub assertion. |
| `apps/web-v2/src/shared/ui/ListRow.tsx` | `ListRow` + `DividedSection`: `line-subtle` is the INNER separator, `line-strong` the OUTER edge. |
| `apps/web-v2/src/shared/ui/ListRow.stories.tsx` | Story test: first row draws no top rule; every later row does. |
| `apps/web-v2/src/shared/ui/RefusalNudge.tsx` | The `role="alert"` line naming what is missing, with `aria-describedby` wiring the caller cannot forget. |
| `apps/web-v2/src/shared/ui/RefusalNudge.stories.tsx` | Story test asserting the aria wiring, not only the text. |
| `apps/web-v2/src/shared/ui/PanelCard.tsx` | `Card` + captioned/banded heading + gap'd body, one composition. |
| `apps/web-v2/src/shared/ui/PanelCard.stories.tsx` | Story test: caption renders, band fills, gap applies. |
| `apps/web-v2/src/shared/ui/CensusTile.tsx` | Mono numeral + `stat` eyebrow. Named *census*, never *stat*. |
| `apps/web-v2/src/shared/ui/CensusTile.stories.tsx` | Story test: both tiers, the tone set, the divider edge. |
| `apps/web-v2/src/shared/ui/EmptyPanel.tsx` | `EmptyPanel` + `EmptyNote`: both mean RESOLVED AND EMPTY, never NOT LOADED. |
| `apps/web-v2/src/shared/ui/EmptyPanel.stories.tsx` | Story test for both, including the actions slot. |
| `apps/web-v2/src/shared/ui/ReasonEditor.tsx` | The inline refusal editor: enabled submit that explains itself, Enter commits, Escape leaves. |
| `apps/web-v2/src/shared/ui/ReasonEditor.stories.tsx` | Story test: refusal speaks, Enter commits, Escape leaves, `[` in a field is text. |
| `apps/web-v2/src/shared/ui/CenteredScreen.tsx` | The full-height centred wrapper for the four terminal screens. |
| `apps/web-v2/src/shared/ui/CenteredScreen.stories.tsx` | Story test: measure applies, content centres. |

**Modified**

| File | Change |
|---|---|
| `apps/web-v2/src/shared/ui/Card.tsx` | Gains the `tone` and `dashed` axes (Task 1); `accent` becomes a 2px inset top stripe and gains `settled` (Task 2). |
| `packages/ui-tokens/src/tokens.css` | `--stroke-accent` 3px → 2px (Task 2); `--text-census` (Task 7); `--text-nano`, `--tracking-heading` (Task 12). |
| `apps/web-v2/src/shared/ui/classNames.ts` | Registers `census` and `nano` on the `text` scale and `heading` on `tracking`, or tailwind-merge silently drops the size. |
| `apps/web-v2/src/shared/ui/ToggleGroup.tsx` | Gains the `segmented` variant while keeping the pill fill-swap (Task 11). |
| `apps/web-v2/src/shared/ui/Button.tsx` | Muted-disabled fill made explicit; `recessed` fill added (Task 12). |
| `apps/web-v2/src/shared/ui/Eyebrow.tsx` | New `heading` tier; `group` drops to 8.5px/ink3 (Task 12). |
| 27 Card-tone sites, 15 row/section sites, 5 refusal sites, 11 panel sites, 5 census sites, 6 empty sites, 3 editor sites, 4 centred sites, 3 segmented sites | Adoption. Named per task. |

**Deleted**

| File | Why |
|---|---|
| `apps/web-v2/src/app/ScreenTitle.tsx` | Absorbed by `ScreenHeading`, which keeps its link-to-hub behaviour and its `screen-title` testid. |

---

## Task 1: `Card` tone axis

The tinted semantic block — `--X-tint` ground, 1px `--X-edge` hairline — is hand-rolled 27 times. `dashed` is the worst of it: it means PROVISIONAL / NOT YET EVIDENCE, and today it is present on `GapCard:87`, `ImpactPreview:57`, `RetireBlock:64` and `SignoffRowNotes:51` and absent on peers that make the same claim.

**Files:**
- Modify: `apps/web-v2/src/shared/ui/Card.tsx:17-40`
- Modify (adoption, 27 sites): listed in Step 5 below
- Test: `apps/web-v2/src/shared/ui/Card.stories.tsx`

**Interfaces:**
- Consumes: `cn` from `apps/web-v2/src/shared/ui/classNames.ts` — `(...inputs: ClassValue[]) => string`.
- Produces:
  ```tsx
  export interface CardProps
    extends Omit<HTMLAttributes<HTMLDivElement>, "className">,
      VariantProps<typeof card> {
    children: ReactNode;
    className?: string;
  }
  // tone:   "none" | "action" | "attend" | "halt" | "settled"   (default "none")
  // size:   "card" | "emphasis" | "nested"                      (default "card")
  // dashed: boolean                                             (default false)
  // accent: "none" | "action" | "attend" | "halt"               (default "none")
  export function Card(props: CardProps): ReactElement;
  ```
  `CardHeader`, `CardBody`, `CardFooter` are unchanged.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/shared/ui/Card.stories.tsx`:

```tsx
/**
 * The tinted semantic block. A card's TONE is its claim about the content —
 * halt stops something, attend wants a person, settled is finished — and it is
 * drawn as tint + hairline, never as a fill. `dashed` is the separate claim
 * PROVISIONAL: not yet evidence.
 */
export const Tones: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-5">
      <Card data-testid="tone-none"><CardBody>Neutral</CardBody></Card>
      <Card data-testid="tone-halt" tone="halt"><CardBody>The run is paused</CardBody></Card>
      <Card data-testid="tone-attend" tone="attend"><CardBody>Waiting on a person</CardBody></Card>
      <Card data-testid="tone-settled" tone="settled"><CardBody>Closed</CardBody></Card>
      <Card data-testid="tone-provisional" tone="attend" dashed>
        <CardBody>Provisional — no evidence behind this yet</CardBody>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const plain = await canvas.findByTestId("tone-none");
    const ground = getComputedStyle(plain);

    for (const tone of ["halt", "attend", "settled"]) {
      const el = await canvas.findByTestId(`tone-${tone}`);
      const style = getComputedStyle(el);
      // A tone is tint AND edge. Either one alone reads as decoration.
      expect(style.backgroundColor).not.toBe(ground.backgroundColor);
      expect(style.borderTopColor).not.toBe(ground.borderTopColor);
      expect(style.borderTopStyle).toBe("solid");
    }

    // PROVISIONAL is a border STYLE, so it survives greyscale — the same
    // reasoning `NoValue` uses for its six states.
    const provisional = await canvas.findByTestId("tone-provisional");
    expect(getComputedStyle(provisional).borderTopStyle).toBe("dashed");
  },
};
```

Add `import { expect, within } from "storybook/test";` as line 2 of the file if it is not already there.

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Card.stories.tsx
```

Expected failure: `AssertionError: expected 'rgb(253, 252, 250)' not to be 'rgb(253, 252, 250)'` on the first `expect(style.backgroundColor).not.toBe(ground.backgroundColor)` — `tone` is not a variant, so cva drops it and every card renders `bg-surface-panel`. `pnpm --filter web-v2 typecheck` additionally reports `TS2353: Object literal may only specify known properties, and 'tone' does not exist in type 'CardProps'`.

- [ ] **Step 3: Implement**

Replace `apps/web-v2/src/shared/ui/Card.tsx:17-40` with:

```tsx
const card = cva("border overflow-hidden", {
  variants: {
    size: {
      /** the standard card (10px) */
      card: "rounded-9",
      /** rulebook detail, new-rule form, screen-failure (12px) */
      emphasis: "rounded-10",
      /** a card nested inside another card (8px) */
      nested: "rounded-7",
    },
    /**
     * THE TONE IS A CLAIM ABOUT THE CONTENT, NOT A COLOUR. `halt` says this
     * stopped something, `attend` says it wants a person, `settled` says it is
     * finished. Twenty-seven blocks used to spell the tint and the edge out by
     * hand, which is how two panels making the same claim ended up drawn
     * differently — and how a palette swap stopped being a one-file change.
     *
     * Tint AND edge together, never one alone: a tint with a neutral hairline
     * reads as a highlight rather than a state, and the edge is what survives
     * on a screen where the tint is barely there.
     */
    tone: {
      none: "bg-surface-panel border-line-strong",
      action: "bg-action-surface border-action-border",
      attend: "bg-state-attend-surface border-state-attend-border",
      halt: "bg-state-halt-surface border-state-halt-border",
      settled: "bg-state-settled-surface border-state-settled-border",
    },
    /**
     * PROVISIONAL — NOT YET EVIDENCE. A separate claim from the tone, which is
     * why it is a separate axis: an amber dashed block is "we are guessing and
     * it needs a person", an amber solid one is "a person is asked, and this is
     * true". Border style, not colour, so it reads in greyscale — the same
     * reasoning `NoValue` uses for its six states.
     */
    dashed: { true: "border-dashed", false: "" },
    /**
     * The severity edge — a 4px left border. The design uses it for halt and
     * attend banners; settled never takes one, which is deliberate: a settled
     * state is not something you need pulled out of the page.
     */
    accent: {
      none: "",
      action: "border-l-(length:--stroke-severity) border-l-action",
      attend: "border-l-(length:--stroke-severity) border-l-state-attend",
      halt: "border-l-(length:--stroke-severity) border-l-state-halt",
    },
  },
  defaultVariants: { size: "card", tone: "none", dashed: false, accent: "none" },
});
```

Then update the destructure at `Card`:

```tsx
export function Card({ size, tone, dashed, accent, className, ...rest }: CardProps) {
  return <div className={cn(card({ size, tone, dashed, accent }), className)} {...rest} />;
}
```

`bg-surface-panel border border-line-strong` moves out of the base string into `tone: "none"`, so every existing call site renders byte-identically.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Card.stories.tsx
```

- [ ] **Step 5: Adopt at all 27 sites**

Each row: replace the hand-rolled tint/edge classes with the `tone` (and where noted `dashed` / `accent`) prop, keeping the element's own padding, margin and text classes in `className`. Where the element is not a `<div>`/`<section>` today, wrap the existing content in `<Card>` rather than changing what renders — a `<p>` becomes `<Card ...><p className="…">` only where the classes listed are on the `<p>` itself; otherwise pass them through `className`.

*rulebook (8)*

| Site | Replace | With |
|---|---|---|
| `features/rulebook/ConfirmBlock.tsx:44` | `<p className="mb-5 rounded-7 border border-state-halt-border bg-state-halt-surface px-6 py-5 text-sm leading-body text-state-halt-ink">` | `<Card as-is is a p → wrap: <Card size="nested" tone="halt" className="mb-5"><p className="px-6 py-5 text-sm leading-body text-state-halt-ink">` (close with `</p></Card>`) |
| `features/rulebook/ConflictCard.tsx:32` | `className="rounded-9 border border-state-halt-border bg-state-halt-surface p-7"` | `<Card tone="halt" className="p-7"` (drop `rounded-9`, it is `size="card"`) |
| `features/rulebook/ImpactPreview.tsx:57` | `className="mt-5 rounded-6 border border-state-attend-border border-dashed bg-state-attend-surface px-5 py-3 text-xs leading-body text-state-attend-ink"` | `<Card size="nested" tone="attend" dashed className="mt-5 px-5 py-3 text-xs leading-body text-state-attend-ink"` |
| `features/rulebook/NewRuleForm.tsx:132` | `className="rounded-7 border border-state-halt-border bg-state-halt-surface px-6 py-5 text-sm leading-body text-state-halt-ink"` | `<Card size="nested" tone="halt" role="alert" data-testid="new-rule-error" className="px-6 py-5 text-sm leading-body text-state-halt-ink"` |
| `features/rulebook/ResolveCard.tsx:34` | `className="rounded-9 border border-state-attend-border bg-state-attend-surface p-7"` | `<Card tone="attend" className="p-7"` |
| `features/rulebook/RetireBlock.tsx:64` | `className="mt-3 rounded-5 border border-state-attend-border border-dashed bg-state-attend-surface px-5 py-3 text-xs leading-body text-state-attend-ink"` | `<Card size="nested" tone="attend" dashed className="mt-3 px-5 py-3 text-xs leading-body text-state-attend-ink"` |
| `features/rulebook/RetireBlock.tsx:79` | `className="rounded-7 border border-state-halt-border bg-state-halt-surface px-6 py-5 text-sm leading-body text-state-halt-ink"` | `<Card size="nested" tone="halt" className="px-6 py-5 text-sm leading-body text-state-halt-ink"` |
| `features/rulebook/RetireConfirm.tsx:40` | `className="rounded-9 border border-state-halt-border bg-state-halt-surface p-7"` | `<Card tone="halt" className="p-7"` |

*completeness (5)*

| Site | Replace | With |
|---|---|---|
| `features/completeness/GapCard.tsx:87` | `<div className="flex gap-5 rounded-7 border border-dashed border-state-attend bg-state-attend-surface px-6 py-5">` | `<Card size="nested" tone="attend" dashed className="flex gap-5 px-6 py-5">` |
| `features/completeness/GapClosedNote.tsx:23` | `<div className="rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-5">` | `<Card size="nested" tone="settled" className="px-7 py-5">` |
| `features/completeness/GapClosureForm.tsx:33` | `<div className="mt-6 rounded-7 border border-state-settled-border bg-state-settled-surface px-7 py-6">` | `<Card size="nested" tone="settled" className="mt-6 px-7 py-6">` |
| `features/completeness/GateBanner.tsx:15` | `<section className="rounded-9 border border-state-halt-border border-l-(length:--stroke-severity) border-l-state-halt bg-state-halt-surface p-8">` | `<Card tone="halt" accent="halt" className="p-8">` |
| `features/completeness/GateBanner.tsx:57` | `<section className="flex items-center gap-6 rounded-9 border border-state-settled-border border-l-(length:--stroke-severity) border-l-state-settled bg-state-settled-surface p-8">` | `<Card tone="settled" className="flex items-center gap-6 p-8">` — the settled banner loses its severity edge, which is the rule the accent variant already encodes: a settled state is not pulled out of the page. |

*review (3)*

| Site | Replace | With |
|---|---|---|
| `features/review/CorrectEditor.tsx:75` | `className="flex flex-col gap-3 rounded-5 border border-action-border bg-action-surface p-5"` | `<Card size="nested" tone="action" onKeyDown={keys} className="flex flex-col gap-3 p-5">` |
| `features/review/EscalateEditor.tsx:29` | `<div className="flex flex-col gap-3 rounded-5 border border-state-attend-border bg-state-attend-surface p-5">` | `<Card size="nested" tone="attend" className="flex flex-col gap-3 p-5">` |
| `features/review/ExcludeEditor.tsx:28` | `<div className="flex flex-col gap-3 rounded-5 border border-state-halt-border bg-state-halt-surface p-5">` | `<Card size="nested" tone="halt" className="flex flex-col gap-3 p-5">` |

*products (3)*

| Site | Replace | With |
|---|---|---|
| `features/products/BaselineGrid.tsx:81` | `className="rounded-9 border border-action-border bg-action-surface px-8 py-6"` | `<Card tone="action" className="px-8 py-6"` |
| `features/products/ConfigHeader.tsx:78` | `className="rounded-7 border border-state-attend-border bg-state-attend-surface px-7 py-5 text-xs leading-body text-state-attend-ink"` | `<Card size="nested" tone="attend" className="px-7 py-5 text-xs leading-body text-state-attend-ink"` |
| `features/products/LineForm.tsx:57` | `<p className="rounded-7 border border-state-attend-border bg-state-attend-surface px-6 py-5 text-xs leading-body text-state-attend-ink">` | `<Card size="nested" tone="attend" className="px-6 py-5 text-xs leading-body text-state-attend-ink">` |

*questions (3)*

| Site | Replace | With |
|---|---|---|
| `features/questions/SignoffRowNotes.tsx:42` | `<div className="mt-3 inline-flex items-baseline gap-4 rounded-5 border border-action-border bg-action-surface px-5 py-2">` | `<Card size="nested" tone="action" className="mt-3 inline-flex items-baseline gap-4 px-5 py-2">` |
| `features/questions/SignoffRowNotes.tsx:51` | `<div className="mt-3 flex max-w-full items-baseline gap-4 rounded-5 border border-dashed border-state-attend-border bg-state-attend-surface px-5 py-2">` | `<Card size="nested" tone="attend" dashed className="mt-3 flex max-w-full items-baseline gap-4 px-5 py-2">` |
| `features/questions/OrderIdentityStrip.tsx:37` | `<div className="flex flex-wrap items-center gap-5 rounded-8 border border-line-strong border-l-(length:--stroke-accent) border-l-action bg-surface-panel px-7 py-5">` | `<Card size="nested" accent="action" className="flex flex-wrap items-center gap-5 px-7 py-5">` |

*one each*

| Site | Replace | With |
|---|---|---|
| `features/escalations/EscalationsScreen.tsx:107` | `<div className="flex flex-col gap-4 rounded-6 border border-state-settled-border bg-state-settled-surface p-8">` | `<Card size="nested" tone="settled" className="flex flex-col gap-4 p-8">` |
| `features/overview/FailedBanner.tsx:29` | `<Card className="border-state-halt-border bg-state-halt-surface border-l-(length:--stroke-severity) border-l-state-halt">` | `<Card tone="halt" accent="halt">` |
| `features/people/MfaGateBanner.tsx:24` | `className="border-state-halt-border bg-state-halt-surface border-l-(length:--stroke-severity) border-l-state-halt"` | `tone="halt" accent="halt"` (delete the `className` entirely) |
| `features/clients/ConflictBanner.tsx:33-35` | `accent="halt"` + `className="border-state-halt-border bg-state-halt-surface"` | `tone="halt" accent="halt"` (delete the `className`) |
| `app/AccountMenu.tsx:96` | `<p className="mx-3 mb-3 rounded-3 border border-state-attend-border bg-state-attend-surface px-4 py-2 text-micro leading-body text-state-attend-ink">` | `<Card size="nested" tone="attend" className="mx-3 mb-3 px-4 py-2 text-micro leading-body text-state-attend-ink">` |

Each file that did not already import `Card` gains `import { Card } from "…/shared/ui/Card";` at the correct relative depth. Delete any now-unused `cn` import the change orphans.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/Card.tsx apps/web-v2/src/shared/ui/Card.stories.tsx apps/web-v2/src/app/AccountMenu.tsx apps/web-v2/src/features apps/web-v2/src/entities
git commit -m "$(cat <<'EOF'
Give Card a tone axis and adopt it at the 27 hand-rolled tinted blocks

The tinted semantic block — tint ground, matching hairline edge — was spelled
out by hand 27 times, so two panels making the same claim drifted apart and a
palette swap stopped being a one-file change. `dashed` becomes an explicit
axis meaning PROVISIONAL, which four sites drew and their peers did not.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `Card.accent` — the axis correction

`grep -c 'border-left:4px'` on the export returns **zero**, against five `box-shadow: inset 0 2px 0` stripes (export lines 275, 412, 553, 943, 1145). The prop keeps its name; what it draws changes, and it gains a `settled` case.

**The six call sites currently drawing the wrong axis** — the ones that pass a non-`none` accent unconditionally:

1. `apps/web-v2/src/app/Placeholders.tsx:11` — `<Card size="emphasis" accent="halt">`
2. `apps/web-v2/src/features/clients/ConflictBanner.tsx:33` — `accent="halt"`
3. `apps/web-v2/src/features/ingest/AcceptedCard.tsx:15` — `<Card data-testid="accepted-card" accent="action">`
4. `apps/web-v2/src/features/ingest/RefusedCard.tsx:36` — `<Card data-testid="refused-card" accent="halt">`
5. `apps/web-v2/src/features/review/NoDisclosureCards.tsx:35` — `<Card key={line.line_id} accent="attend" …>`
6. `apps/web-v2/src/shared/ui/ScreenFailure.tsx:25` — `<Card size="emphasis" accent="halt">`

Three further sites pass `accent` conditionally and resolve to `"none"` at rest, so they are corrected by the same change without a source edit: `entities/field/DecisionCard.tsx:89`, `features/review/FieldList.tsx:47`, `shared/ui/ClaimVsEvidence.tsx:43`. Task 1 adds four more (`GateBanner:15`, `FailedBanner:29`, `MfaGateBanner:24`, `OrderIdentityStrip:37`); they are corrected here too.

**Files:**
- Modify: `packages/ui-tokens/src/tokens.css:376-392`
- Modify: `apps/web-v2/src/shared/ui/Card.tsx` (the `accent` variant block)
- Test: `apps/web-v2/src/shared/ui/Card.stories.tsx`

**Interfaces:**
- Consumes: `Card` from Task 1.
- Produces: `accent: "none" | "action" | "attend" | "halt" | "settled"`, rendered as `border-t-(length:--stroke-accent) border-t-<tone>`. `--stroke-accent` is `2px`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/shared/ui/Card.stories.tsx`:

```tsx
/**
 * THE SEVERITY EDGE IS A TOP STRIPE, NOT A LEFT BORDER. The export draws five
 * `inset 0 2px 0` stripes and `grep -c 'border-left:4px'` returns zero. A left
 * bar reads as a quote or a nested list; a top stripe reads as a banner, which
 * is what every one of these is. `settled` exists so a finished state can be
 * marked without borrowing the attend colour.
 */
export const AccentAxis: Story = {
  args: { children: null },
  render: () => (
    <div className="flex flex-col gap-5">
      <Card data-testid="accent-halt" accent="halt"><CardBody>Package incomplete</CardBody></Card>
      <Card data-testid="accent-attend" accent="attend"><CardBody>Provisional</CardBody></Card>
      <Card data-testid="accent-action" accent="action"><CardBody>The one you are working</CardBody></Card>
      <Card data-testid="accent-settled" accent="settled"><CardBody>Signed and closed</CardBody></Card>
      <Card data-testid="accent-none"><CardBody>No accent</CardBody></Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const plain = getComputedStyle(await canvas.findByTestId("accent-none"));
    expect(plain.borderTopWidth).toBe("1px");

    for (const accent of ["halt", "attend", "action", "settled"]) {
      const style = getComputedStyle(await canvas.findByTestId(`accent-${accent}`));
      // The stripe is on TOP and it is 2px…
      expect(style.borderTopWidth).toBe("2px");
      expect(style.borderTopColor).not.toBe(plain.borderTopColor);
      // …and the left edge is untouched structure, not the severity axis.
      expect(style.borderLeftWidth).toBe("1px");
      expect(style.borderLeftColor).toBe(plain.borderLeftColor);
    }
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Card.stories.tsx
```

Expected failure: `AssertionError: expected '1px' to be '2px'` on `style.borderTopWidth` for `accent-halt` — the accent is still drawn on the left, so the top border is the structural 1px and the left is 4px. `accent="settled"` additionally renders as `accent-none` because the case does not exist.

- [ ] **Step 3: Implement**

**3a.** `packages/ui-tokens/src/tokens.css:392` — change the value only, never the name:

```css
  --stroke-accent: 2px;
```

and correct the prose block above it (`tokens.css:376-379`) so it stops describing the old width:

```
   *   1px    structure — card edges, row separators, resting controls
   *   1.5px  load-bearing — selected, required, or "this is the live choice"
   *   2px    accent — the inset top stripe on a banner or a live card
   *   2.5px  stamp double-border
   *   4px    severity — the left edge, kept for the gallery's severity sample
```

Five existing consumers move from 3px to 2px, which is the export's own value in all five: `entities/field/ProvenancePanel.tsx:42`, `features/delivered/ReopenPanel.tsx:46`, `features/questions/OrderIdentityStrip.tsx:37`, `features/questions/SignoffCard.tsx:67`, `features/questions/SignoffRow.tsx:75`.

**3b.** Replace the `accent` variant block in `apps/web-v2/src/shared/ui/Card.tsx` with:

```tsx
    /**
     * THE SEVERITY EDGE IS A TOP STRIPE. The export draws five
     * `box-shadow: inset 0 2px 0` stripes and zero `border-left:4px`, so six
     * call sites were drawing the wrong axis: a left bar reads as a quotation
     * or a nested list, a top stripe reads as a banner, and every one of these
     * is a banner. A top border is the token-legal equivalent of the inset
     * shadow and is pixel-identical on an opaque card.
     *
     * `settled` exists so a finished state can be marked without borrowing the
     * attend colour — the mistake that makes "done" and "needs you" look alike.
     */
    accent: {
      none: "",
      action: "border-t-(length:--stroke-accent) border-t-action",
      attend: "border-t-(length:--stroke-accent) border-t-state-attend",
      halt: "border-t-(length:--stroke-accent) border-t-state-halt",
      settled: "border-t-(length:--stroke-accent) border-t-state-settled",
    },
```

No call-site edit is needed: all six named sites pass a prop name and value that both survive, and the axis follows the component.

**3c.** `apps/web-v2/src/features/gallery/StateSample.tsx:15` documents the 4px left edge as "the severity axis". It is now the gallery's own sample of a token that only it uses; change the sentence to read `The 4px left edge samples --stroke-severity, which after 2026-07-30 only this gallery draws — Card's accent is the 2px top stripe.`

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Card.stories.tsx
```

- [ ] **Step 5: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 6: Commit**

```
git add packages/ui-tokens/src/tokens.css apps/web-v2/src/shared/ui/Card.tsx apps/web-v2/src/shared/ui/Card.stories.tsx apps/web-v2/src/features/gallery/StateSample.tsx
git commit -m "$(cat <<'EOF'
Draw Card's accent as a 2px top stripe, not a 4px left border

The export contains five inset-top stripes and no border-left:4px at all, so
six call sites were drawing the severity edge on the wrong axis — a left bar
reads as a quotation, a top stripe reads as a banner. Adds the settled case so
a finished state stops borrowing the attend colour.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ScreenHeading`

Fifteen screens re-do eyebrow + h1 + lede, with four competing `max-w-*` values and seven different spacings between them. It absorbs `app/ScreenTitle.tsx` and keeps that file's rule: **a mouse user is never stranded** (`ux.spec` #7) — the eyebrow is the link home.

It lives in `src/app/`, not `src/shared/ui/`, because `check:rules` refuses `@tanstack/react-router` under `src/shared` and `src/entities` (`presentational-fetches`).

**Files:**
- Create: `apps/web-v2/src/app/ScreenHeading.tsx`
- Create: `apps/web-v2/src/app/ScreenHeading.stories.tsx`
- Delete: `apps/web-v2/src/app/ScreenTitle.tsx`
- Modify (adoption, 15 sites): listed in Step 5

**Interfaces:**
- Consumes: `Eyebrow` from `apps/web-v2/src/shared/ui/Eyebrow.tsx`; `Link` from `@tanstack/react-router`.
- Produces:
  ```tsx
  export interface ScreenHeadingProps {
    eyebrow: ReactNode;
    title: ReactNode;
    lede?: ReactNode;
    size?: "22" | "26";      // default "22"
    actions?: ReactNode;
  }
  export function ScreenHeading(props: ScreenHeadingProps): ReactElement;

  /** The bare link-home eyebrow, for the one screen that has no h1. */
  export function ScreenEyebrow({ children }: { children: ReactNode }): ReactElement;
  ```
  `ScreenEyebrow` is defined here rather than left in `ScreenTitle.tsx` because `features/review/ReviewHeader.tsx:22` needs the link without a heading, and `title` is required.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/app/ScreenHeading.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ScreenHeading } from "./ScreenHeading";

/** A `Link` needs a router in scope; a memory router is the smallest one. */
function withRouter(node: React.ReactElement) {
  const root = createRootRoute({ component: () => node });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/queue"] }),
  });
  return <RouterProvider router={router} />;
}

const meta = {
  title: "App/ScreenHeading",
  component: ScreenHeading,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ScreenHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A MOUSE USER IS NEVER STRANDED (`ux.spec` #7). The eyebrow is the path back
 * to the hub — keyboard-first is a preference, not a prerequisite, and a screen
 * you can only leave by chord is a screen half its users cannot leave.
 */
export const Standard: Story = {
  args: { eyebrow: "Your queue", title: "Work comes to you" },
  render: (args) =>
    withRouter(
      <ScreenHeading
        {...args}
        lede="The system hands over the next order by age and priority."
      />,
    ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByTestId("screen-title");
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("Your queue");
    // One h1 per screen, and it is the title.
    const heading = await canvas.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Work comes to you");
    expect(getComputedStyle(heading).fontSize).toBe("22px");
  },
};

/** Upload is the one screen the export sets at 26px. */
export const Large: Story = {
  args: { eyebrow: "Step 1 — Upload", title: "New title-search package", size: "26" },
  render: (args) => withRouter(<ScreenHeading {...args} />),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole("heading", { level: 1 });
    expect(getComputedStyle(heading).fontSize).toBe("26px");
    // No lede passed: nothing is rendered in its place.
    expect(canvas.queryByTestId("screen-lede")).not.toBeInTheDocument();
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/app/ScreenHeading.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./ScreenHeading" from "src/app/ScreenHeading.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/app/ScreenHeading.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eyebrow } from "../shared/ui/Eyebrow";
import { cn } from "../shared/ui/classNames";

/**
 * A MOUSE USER IS NEVER STRANDED (`ux.spec` #7).
 *
 * Every screen's eyebrow is its path back to the hub. This used to be the side
 * rail's job; commit c2e9011 deleted the rail and the rule did not go with it
 * — keyboard-first is a preference, not a prerequisite, and a screen you can
 * only leave by chord is a screen half the people using it cannot leave.
 *
 * WHY THE THREE PARTS ARE ONE COMPONENT: fifteen screens each re-did eyebrow +
 * h1 + lede, and they drifted into four different measures and seven different
 * spacings for what the export draws as one block. Reuniting them means the
 * masthead is right once rather than nearly right fifteen times.
 *
 * THE LEDE'S MEASURE IS FIXED HERE, not per screen. A `max-w-prose` on one
 * screen and a `max-w-3xl` on the next are two guesses at the same number;
 * the export sets one column and the reader's eye expects it to hold.
 */
export function ScreenEyebrow({ children }: { children: ReactNode }) {
  return (
    <Link to="/" data-testid="screen-title" className="w-fit">
      <Eyebrow variant="screen">{children}</Eyebrow>
    </Link>
  );
}

export interface ScreenHeadingProps {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /**
   * The export genuinely varies: 22px everywhere, 26px on Upload. Keyed by the
   * pixel value so a reviewer can check a call site against the spec's table
   * without a lookup in their head.
   */
  size?: "22" | "26";
  /** The right-hand slot — a filter group, a stat row, a primary button. */
  actions?: ReactNode;
}

export function ScreenHeading({
  eyebrow,
  title,
  lede,
  size = "22",
  actions,
}: ScreenHeadingProps) {
  return (
    <header className="flex flex-wrap items-end gap-8">
      <div className="flex min-w-130 flex-1 flex-col gap-2">
        <ScreenEyebrow>{eyebrow}</ScreenEyebrow>
        <h1
          className={cn(
            "font-semibold text-ink-primary",
            size === "26" ? "text-5xl" : "text-3xl",
          )}
        >
          {title}
        </h1>
        {lede === undefined ? null : (
          <p
            data-testid="screen-lede"
            className="max-w-235 text-base leading-body text-ink-secondary"
          >
            {lede}
          </p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex items-center gap-7">{actions}</div>
      )}
    </header>
  );
}
```

`lede` and `actions` are read with `=== undefined` rather than truthiness because `exactOptionalPropertyTypes` makes the absent case exactly `undefined`, and a falsy-but-present node (`0`) must still render.

Then delete `apps/web-v2/src/app/ScreenTitle.tsx`.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/app/ScreenHeading.stories.tsx
```

- [ ] **Step 5: Adopt at all 15 sites**

Every site replaces `import { ScreenTitle } from "…/app/ScreenTitle";` with `import { ScreenHeading } from "…/app/ScreenHeading";` (or `ScreenEyebrow` where noted) and collapses the `<ScreenTitle>` + `<h1>` + `<p>` block into one element. Delete the wrapping `<header>`/`<div>` the block sat in when `ScreenHeading` now provides it.

| # | Site | Call |
|---|---|---|
| 1 | `features/audit/AuditScreen.tsx:41-47` | `<ScreenHeading eyebrow="Admin · Audit" title="The record" lede={<>Append-only: who did what, to which order, when, and on what evidence. Read-only — no edit, no delete. This is how &ldquo;who amended that claim&rdquo; has an answer.</>} />` |
| 2 | `features/clients/ClientsScreen.tsx:60-66` | `<ScreenHeading eyebrow="Admin · Clients" title={<>Client settings &amp; overrides</>} lede={<>…existing paragraph, unchanged…</>} />` |
| 3 | `features/completeness/CompletenessScreen.tsx:79-85` | `<ScreenHeading eyebrow={<>Between segment &amp; extract</>} title="Completeness gate" lede="Your intake claims, checked against what was actually segmented — before a single field is extracted." />` |
| 4 | `features/escalations/EscalationsScreen.tsx:56-62` | `<ScreenHeading eyebrow="Escalation inbox" title="Escalation inbox" lede={<>…existing paragraph…</>} />` — the screen has no h1 today; the eyebrow's own words become it, which is what the export draws. |
| 5 | `features/gallery/GalleryScreen.tsx:39-46` | `<ScreenHeading eyebrow="Reference" title="States, not just the happy path" lede={<>…existing paragraph…</>} />` |
| 6 | `features/ingest/IngestScreen.tsx:82-88` | `<ScreenHeading eyebrow="Step 1 — Upload" title="New title-search package" size="26" lede="One scanned PDF per order. Nothing leaves this tool as a deliverable until a reviewer has approved it, field by field." />` |
| 7 | `features/overview/OverviewHeader.tsx:36-42` | `<ScreenHeading eyebrow="Overview" title="Where every order sits" lede={<>…existing paragraph…</>} actions={<>…the existing ToggleGroup…</>} />` |
| 8 | `features/people/PeopleScreen.tsx:33-39` | `<ScreenHeading eyebrow="Admin · People" title="Everyone in this organisation" lede="This screen changes authorisation, never credentials. Invitations and passwords hand off to the identity provider." />` |
| 9 | `features/processing/ProcessingScreen.tsx:67-73` | `<ScreenHeading eyebrow="Step 3 — Pipeline" title="Building the draft report" lede="Two halts by design: the completeness gate protects the spend, the human QC gate protects the client." />` |
| 10 | `features/products/ConfigHeader.tsx:32-38` | `<ScreenHeading eyebrow={<>Admin · Products &amp; sign-off</>} title="Configuration" lede={<>…existing paragraph…</>} />` |
| 11 | `features/profile/ProfileScreen.tsx:43-45` | `<ScreenHeading eyebrow="Account" title="Your profile" />` |
| 12 | `features/questions/QuestionsScreen.tsx:41-47` | `<ScreenHeading eyebrow="Step 2 — Sign-off" title="Confirm what you did on this search" lede={<>…existing paragraph…</>} />` |
| 13 | `features/queue/QueueScreen.tsx:50-56` | `<ScreenHeading eyebrow="Your queue" title="Work comes to you" lede={<>…existing paragraph…</>} actions={<>…the existing ToggleGroup…</>} />` |
| 14 | `features/review/ReviewHeader.tsx:22` | `<ScreenEyebrow>Review</ScreenEyebrow>` — Review has no h1 in the export; only the link-home behaviour is needed. |
| 15 | `features/rulebook/RulebookHeader.tsx:40-46` | `<ScreenHeading eyebrow="Admin · Rulebook" title="Extraction rules" lede={<>…existing paragraph…</>} actions={<>…the three Stat tiles and the New rule button…</>} />` |

Three sites (`ProcessingScreen:68`, `QuestionsScreen:42`) currently set `text-4xl` (24px) — a third size the export does not draw on those screens. They take the default 22px; the size axis is two-valued on purpose. `ClientsScreen`, `ConfigHeader`, `GalleryScreen` lose their `mt-4`/`mt-2`/`mt-1` inter-part spacings to the component's `gap-2`. `AuditScreen`, `PeopleScreen`, `RulebookHeader` and `ClientsScreen` lose `max-w-3xl` / `max-w-prose` — the two Tailwind-default values that are not on this app's 2px scale — to the component's `max-w-235`.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/app/ScreenHeading.tsx apps/web-v2/src/app/ScreenHeading.stories.tsx apps/web-v2/src/app/ScreenTitle.tsx apps/web-v2/src/features
git commit -m "$(cat <<'EOF'
Make the screen masthead one component across all fifteen screens

Eyebrow, h1 and lede were re-done per screen and drifted into four competing
measures and seven spacings for what the export draws as one block. ScreenTitle
is absorbed rather than deleted: its link-to-hub rule (ux.spec #7 — a mouse user
is never stranded) is the eyebrow's behaviour and moves with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ListRow` + `DividedSection`

Fifteen sites; `PersonRow:50`, `ProductList:69` and `StageRow:55` are byte-identical strings. The component encodes `Card.tsx`'s rule — `line-subtle` is the INNER separator, `line-strong` the OUTER edge — so a row can never reach for the wrong grey.

**Files:**
- Create: `apps/web-v2/src/shared/ui/ListRow.tsx`
- Create: `apps/web-v2/src/shared/ui/ListRow.stories.tsx`
- Modify (adoption, 15 sites): listed in Step 5

**Interfaces:**
- Consumes: `cn` from `apps/web-v2/src/shared/ui/classNames.ts`.
- Produces:
  ```tsx
  export interface ListRowProps {
    children: ReactNode;
    as?: "li" | "div";        // default "li"
    interactive?: boolean;    // default false — hover ground for a clickable row
    dense?: boolean;          // default false — py-3 instead of py-6
    className?: string;
  }
  export function ListRow(props: ListRowProps): ReactElement;

  export interface DividedSectionProps {
    children: ReactNode;
    as?: "ul" | "div";        // default "ul"
    className?: string;
  }
  export function DividedSection(props: DividedSectionProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/ListRow.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DividedSection, ListRow } from "./ListRow";
import { Card } from "./Card";

const meta = {
  title: "Primitives/ListRow",
  component: ListRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * THE FIRST ROW DRAWS NO RULE. A separator belongs BETWEEN rows; drawn above
 * the first it doubles the card's own header border into a 2px seam, which is
 * how a card starts reading as a table.
 */
export const Divided: Story = {
  args: { children: null },
  render: () => (
    <Card>
      <DividedSection>
        <ListRow className="px-8"><span data-testid="row-1">First</span></ListRow>
        <ListRow className="px-8"><span data-testid="row-2">Second</span></ListRow>
        <ListRow className="px-8"><span data-testid="row-3">Third</span></ListRow>
      </DividedSection>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rowOf = async (id: string) => {
      const el = await canvas.findByTestId(id);
      const row = el.closest("li");
      expect(row).not.toBeNull();
      return getComputedStyle(row as HTMLElement);
    };

    expect((await rowOf("row-1")).borderTopWidth).toBe("0px");
    expect((await rowOf("row-2")).borderTopWidth).toBe("1px");
    expect((await rowOf("row-3")).borderTopWidth).toBe("1px");

    // The INNER separator is line-subtle, never the outer line-strong. Proved
    // against the card's own edge rather than a hex value.
    const card = canvas.getByTestId("row-1").closest("div");
    const outer = getComputedStyle(card as HTMLElement).borderTopColor;
    expect((await rowOf("row-2")).borderTopColor).not.toBe(outer);
  },
};

/** A clickable row gets a hover ground; a static one must not. */
export const Interactive: Story = {
  args: { children: null },
  render: () => (
    <Card>
      <DividedSection>
        <ListRow interactive className="px-8">
          <button type="button" data-testid="hit">Open this order</button>
        </ListRow>
        <ListRow dense className="px-8"><span data-testid="tight">Dense</span></ListRow>
      </DividedSection>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = (await canvas.findByTestId("hit")).closest("li") as HTMLElement;
    expect(row.className).toContain("hover:bg-surface-app");
    const dense = (await canvas.findByTestId("tight")).closest("li") as HTMLElement;
    expect(getComputedStyle(dense).paddingTop).toBe("6px");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ListRow.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./ListRow" from "src/shared/ui/ListRow.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/ListRow.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * One row in a divided list — fifteen sites, three of which
 * (`PersonRow:50`, `ProductList:69`, `StageRow:55`) were byte-identical
 * strings. This is the four-near-identical-row-renderers failure HANDOFF §1
 * names, and it had already recurred.
 *
 * THE FIRST ROW DRAWS NO RULE. A separator belongs BETWEEN rows; drawn above
 * the first it doubles the card's own header border into a 2px seam, and a
 * card that seams like that starts reading as a table.
 *
 * THE INNER GREY IS `line-subtle`, NEVER `line-strong` — the same rule
 * `Card.tsx` states for its bands. Swapping them makes a card read as a table
 * and a table read as a card, and the swap is invisible until both are on
 * screen together. Putting the choice in one component is what stops the
 * fifteenth row from picking the other one.
 */
const listRow = cva("border-t border-line-subtle first:border-t-0", {
  variants: {
    /**
     * A hover ground says "this does something". A static row that lights up
     * on hover promises an action it does not have, which is worse than no
     * affordance at all.
     */
    interactive: { true: "hover:bg-surface-app", false: "" },
    dense: { true: "py-3", false: "py-6" },
  },
  defaultVariants: { interactive: false, dense: false },
});

type ListRowVariants = VariantProps<typeof listRow>;

export interface ListRowProps extends ListRowVariants {
  children: ReactNode;
  /** `li` inside a list, `div` inside a grid or a stack that is not one. */
  as?: "li" | "div";
  className?: string;
}

export function ListRow({
  children,
  as = "li",
  interactive,
  dense,
  className,
}: ListRowProps) {
  const Tag = as;
  return (
    <Tag className={cn(listRow({ interactive, dense }), className)}>
      {children}
    </Tag>
  );
}

/**
 * The container the rows separate inside. It carries no border of its own:
 * the OUTER edge belongs to the `Card` this sits in, and a section that drew
 * its own would put two structural lines on one seam.
 *
 * It exists so that `ListRow`'s `first:` selector has a stable parent — a row
 * wrapped in a conditional fragment is no longer its parent's first child, and
 * the rule silently stops applying.
 */
export interface DividedSectionProps {
  children: ReactNode;
  as?: "ul" | "div";
  className?: string;
}

export function DividedSection({
  children,
  as = "ul",
  className,
}: DividedSectionProps) {
  const Tag = as;
  return <Tag className={cn("flex flex-col", className)}>{children}</Tag>;
}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ListRow.stories.tsx
```

- [ ] **Step 5: Adopt at all 15 sites**

*The ten rows.* Replace the element and delete `border-t border-line-subtle`, `first:border-t-0` and the vertical padding from its `className`; keep the horizontal padding, the flex/grid classes and everything else.

| # | Site | Now | Becomes |
|---|---|---|---|
| 1 | `features/people/PersonRow.tsx:50` | `<li className="flex flex-wrap items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0">` | `<ListRow className="flex flex-wrap items-center gap-7 px-8">` |
| 2 | `features/products/ProductList.tsx:69` | `"flex flex-wrap items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0"` | `<ListRow interactive className="flex flex-wrap items-center gap-7 px-8">` — the row is already clickable |
| 3 | `features/processing/StageRow.tsx:55` | `"flex items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0"` | `<ListRow className="flex items-center gap-7 px-8">` |
| 4 | `features/clients/EffectiveRow.tsx:40` | `className="flex items-start gap-6 border-t border-line-subtle py-5 first:border-t-0"` | `<ListRow className="flex items-start gap-6 py-5">` |
| 5 | `features/overview/StageRail.tsx:28` | `className="flex flex-wrap items-start gap-7 border-t border-line-subtle px-7 py-6 first:border-t-0"` | `<ListRow className="flex flex-wrap items-start gap-7 px-7">` |
| 6 | `features/questions/SignoffRow.tsx:70` | `<li className="border-t border-line-subtle first:border-t-0">` | `<ListRow className="py-0">` — the padding is on the inner block |
| 7 | `features/review/FieldRow.tsx:33` | `<li className="border-t border-line-subtle first:border-t-0">` | `<ListRow className="py-0">` |
| 8 | `entities/order/StageList.tsx:60` | `<li key={stage.id} className="flex gap-6 border-t border-line-subtle py-6 first:border-t-0">` | `<ListRow key={stage.id} className="flex gap-6">` |
| 9 | `features/audit/AuditRow.tsx:29` | `className="flex flex-wrap items-start gap-7 border-t border-line-subtle px-8 py-6"` | `<ListRow className="flex flex-wrap items-start gap-7 px-8">` — gains the missing `first:` rule |
| 10 | `features/escalations/ClusterRail.tsx:43` | `"flex w-full flex-col gap-1 border-t border-line-subtle px-6 py-4 text-left"` | keep the `<button>`, wrap it: `<ListRow interactive dense className="px-0"><button className="flex w-full flex-col gap-1 px-6 py-4 text-left" …>` |

*The five sections.* Replace the bare `<ul>` with `<DividedSection>`; the rows inside are already `ListRow` after the ten edits above.

| # | Site | Now | Becomes |
|---|---|---|---|
| 11 | `features/people/PeopleScreen.tsx:55` | `<ul>` | `<DividedSection>` |
| 12 | `features/products/ProductList.tsx:63` | `<ul>` | `<DividedSection>` |
| 13 | `features/questions/SignoffCard.tsx:88` | `<ul>` | `<DividedSection>` |
| 14 | `features/review/FieldList.tsx:33` | `<ul>` | `<DividedSection>` |
| 15 | `features/clients/EffectivePanel.tsx:82` | `<ul>` | `<DividedSection>` |

`features/processing/ProcessingScreen.tsx:81` keeps its `<ul className="overflow-hidden rounded-9 border border-line-strong bg-surface-panel">` unchanged in this task — it is a `Card` in disguise and Task 6 converts it.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/ListRow.tsx apps/web-v2/src/shared/ui/ListRow.stories.tsx apps/web-v2/src/features apps/web-v2/src/entities
git commit -m "$(cat <<'EOF'
Collapse fifteen divided-list sites onto one ListRow

Three of them were byte-identical strings and a fourth had lost its
first:border-t-0, so the audit row doubled the card's own edge into a 2px seam.
The component encodes Card's rule that line-subtle is the inner separator and
line-strong the outer edge, which is the pair a hand-written row gets wrong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `RefusalNudge`

The highest-stakes item in the wave. `shared/ui/RequiredComment.tsx` has zero production call sites while eleven places hand-roll its nudge, and **three of them omit the `aria-describedby` link** — so HANDOFF-UI §4.6, a release blocker, is announced to a screen-reader user on some screens and silently invisible on others.

**The three that omit the aria link:**

1. `apps/web-v2/src/features/review/CorrectEditor.tsx:107-112` — two `TextField`s, neither carries `aria-describedby`
2. `apps/web-v2/src/features/review/EscalateEditor.tsx:56-61` — `escalate-input` unlinked
3. `apps/web-v2/src/features/review/ExcludeEditor.tsx:55-60` — `exclude-reason` unlinked

`PassControl.tsx:77-88` and `RequiredComment.tsx:69-77` do it correctly and are the shape the component takes.

**Files:**
- Create: `apps/web-v2/src/shared/ui/RefusalNudge.tsx`
- Create: `apps/web-v2/src/shared/ui/RefusalNudge.stories.tsx`
- Modify: `apps/web-v2/src/shared/ui/RequiredComment.tsx:44-93`
- Modify: `apps/web-v2/src/features/review/CorrectEditor.tsx`, `EscalateEditor.tsx`, `ExcludeEditor.tsx`, `apps/web-v2/src/entities/order/PassControl.tsx`
- Test: `apps/web-v2/src/shared/ui/RefusalNudge.stories.tsx`

**Interfaces:**
- Consumes: nothing beyond React.
- Produces (the pinned contract, plus the id helper that makes it unforgettable):
  ```tsx
  export interface RefusalNudgeProps {
    /** What is missing, in the design's words. */
    message: string;
    /** id of the control this refusal is about — wires aria-describedby. */
    controlId: string;
  }
  export function RefusalNudge(props: RefusalNudgeProps): ReactElement;

  /** The id to point `aria-describedby` at. Derived, so it cannot be mistyped. */
  export function nudgeIdFor(controlId: string): string;
  ```
  The nudge always renders `data-testid="nudge"` — `ux.spec:120,127,134,143` address it by that exact name.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/RefusalNudge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { useState } from "react";
import { RefusalNudge, nudgeIdFor } from "./RefusalNudge";
import { TextField } from "./TextField";
import { Button } from "./Button";

const meta = {
  title: "Primitives/RefusalNudge",
  component: RefusalNudge,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RefusalNudge>;

export default meta;
type Story = StoryObj<typeof meta>;

const MESSAGE =
  "an escalation needs its question — the senior answers questions, not flags";

function Harness() {
  const [refused, setRefused] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="q"
        data-testid="q"
        aria-describedby={refused ? nudgeIdFor("q") : undefined}
        tone={refused ? "halt" : "neutral"}
      />
      <Button data-testid="go" onClick={() => setRefused(true)}>
        Escalate
      </Button>
      {refused ? <RefusalNudge controlId="q" message={MESSAGE} /> : null}
    </div>
  );
}

/**
 * A REFUSAL MUST SAY WHY, AND BE ANNOUNCED (HANDOFF-UI §4.6, `ux.spec` #5/#6).
 * The text alone is not the requirement: three of the hand-rolled nudges
 * rendered the sentence and never linked it, so a screen-reader user heard
 * "edit, blank" and nothing else.
 */
export const AriaWired: Story = {
  args: { message: MESSAGE, controlId: "q" },
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByTestId("q");

    // Nothing refused yet: no nudge, and no dangling description.
    expect(canvas.queryByTestId("nudge")).not.toBeInTheDocument();
    expect(field).not.toHaveAttribute("aria-describedby");

    (await canvas.findByTestId("go")).click();

    const nudge = await canvas.findByTestId("nudge");
    expect(nudge).toHaveAttribute("role", "alert");
    expect(nudge).toHaveTextContent("needs its question");

    // THE WIRING, not just the text: the id the control points at is this node.
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(nudge.id).toBe(describedBy);
    expect(
      canvasElement.ownerDocument.getElementById(describedBy as string),
    ).toBe(nudge);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/RefusalNudge.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./RefusalNudge" from "src/shared/ui/RefusalNudge.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/RefusalNudge.tsx`:

```tsx
/**
 * THE SENTENCE THAT NAMES WHAT IS MISSING — and the wiring that makes a screen
 * reader say it.
 *
 * HANDOFF-UI §4.6 is a release blocker: a refusal needs its reason, and the
 * control that refuses has to explain itself rather than sit inert. Eleven
 * places wrote this line by hand and THREE of them never linked it to the
 * field (`CorrectEditor`, `EscalateEditor`, `ExcludeEditor`), so the same
 * product rule was announced on some screens and silently invisible on others.
 * That is worse than an inconsistency: it is a rule that appears to hold when
 * you can see the screen and does not hold when you cannot.
 *
 * THE ID IS DERIVED, NOT PASSED. Both halves of the link — this node's `id`
 * and the control's `aria-describedby` — come from one `controlId`, so they
 * cannot drift apart the way two hand-typed strings do.
 *
 * `role="alert"` rather than a live region on a wrapper: the node exists only
 * once a submit has been refused, so its insertion IS the event worth
 * announcing.
 *
 * THE TESTID IS FIXED. `ux.spec` addresses this element as `nudge` at four
 * assertions across review and queue; parameterising it would let a call site
 * rename a harvested invariant out of existence.
 */
export function nudgeIdFor(controlId: string): string {
  return `${controlId}-nudge`;
}

export interface RefusalNudgeProps {
  /** What is missing, in the design's words. Never "invalid", never "required". */
  message: string;
  /** id of the control this refusal is about — wires aria-describedby. */
  controlId: string;
}

export function RefusalNudge({ message, controlId }: RefusalNudgeProps) {
  return (
    <p
      id={nudgeIdFor(controlId)}
      data-testid="nudge"
      role="alert"
      className="text-xs font-semibold text-state-halt-ink"
    >
      {message}
    </p>
  );
}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/RefusalNudge.stories.tsx
```

- [ ] **Step 5: Adopt at the five control-bound sites**

The eleven `role="alert"` elements in the app are not eleven refusals: four render the server's own answer verbatim (`escalations/ResolveCard.tsx:125`, `rulebook/ConfirmBlock.tsx:68`, `ingest/IngestScreen.tsx:91`, `review/ReviewEditors.tsx:54`), one is `rulebook/NewRuleForm.tsx:130`'s multi-field summary, one is `DestructiveConfirm`'s arming question and one is `FieldValue`'s provenance error. None is bound to a single control, so none can supply a `controlId`; they keep their markup and the reason goes in the commit body. The five that ARE a control's refusal:

**5a. `shared/ui/RequiredComment.tsx`** — delete `const nudgeId = useId();`, add `import { RefusalNudge, nudgeIdFor } from "./RefusalNudge";`, and replace:

```tsx
        aria-describedby={nudged && empty ? nudgeIdFor(fieldId) : undefined}
```
```tsx
      {nudged && empty ? (
        <RefusalNudge controlId={fieldId} message={missingMessage} />
      ) : null}
```

**5b. `entities/order/PassControl.tsx`** — already wired, but on a hand-typed pair of strings. `:57` becomes `aria-describedby={refused ? nudgeIdFor("pass-reason") : undefined}` and `:77-88` becomes:

```tsx
      {refused ? (
        <RefusalNudge
          controlId="pass-reason"
          // Lower-case and this exact wording because `ux.spec` #6 asserts
          // toContainText("a pass needs its why") case-sensitively.
          message="a pass needs its why — one line is enough"
        />
      ) : null}
```

**5c. `features/review/EscalateEditor.tsx`** — the field gains the `id` and the link it never had:

```tsx
      <TextField
        ref={inputRef}
        id="escalate-input"
        data-testid="escalate-input"
        value={question}
        tone={refused ? "halt" : "neutral"}
        aria-describedby={refused ? nudgeIdFor("escalate-input") : undefined}
        placeholder="the question, as you would ask it out loud"
        onChange={…unchanged…}
        onKeyDown={…unchanged…}
      />
      {refused ? (
        <RefusalNudge
          controlId="escalate-input"
          message="an escalation needs its question — the senior answers questions, not flags"
        />
      ) : null}
```

**5d. `features/review/ExcludeEditor.tsx`** — same shape:

```tsx
        id="exclude-reason"
        aria-describedby={refused ? nudgeIdFor("exclude-reason") : undefined}
```
```tsx
      {refused ? (
        <RefusalNudge
          controlId="exclude-reason"
          message="a suppression needs its reason — the row disappears, the reason is all that is left"
        />
      ) : null}
```

**5e. `features/review/CorrectEditor.tsx`** — two fields, one refusal. The refusal is about the REASON, which is the field that is missing, so that is the one it describes:

```tsx
      <TextField
        id="edit-reason"
        data-testid="edit-reason"
        value={reason}
        tone={refused ? "halt" : "neutral"}
        aria-describedby={refused ? nudgeIdFor("edit-reason") : undefined}
        onChange={…unchanged…}
      />
```
```tsx
      {refused ? (
        <RefusalNudge
          controlId="edit-reason"
          message="a correction needs both the value and its why — the why is what makes it a rule later"
        />
      ) : null}
```

Every message is the existing string with its source line-wrapping removed. `ux.spec:120,127,134,143` assert substrings of exactly these, so not one word changes.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

Then, because this task changes a11y wiring the browser suite reaches only in isolation:

```
pnpm --filter web-v2 test:e2e
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/RefusalNudge.tsx apps/web-v2/src/shared/ui/RefusalNudge.stories.tsx apps/web-v2/src/shared/ui/RequiredComment.tsx apps/web-v2/src/entities/order/PassControl.tsx apps/web-v2/src/features/review
git commit -m "$(cat <<'EOF'
Wire every refusal nudge to its control, not three of five

CorrectEditor, EscalateEditor and ExcludeEditor rendered the refusal sentence
and never linked it, so HANDOFF-UI 4.6 — a release blocker — was announced on
PassControl's screens and silently invisible on review's. RefusalNudge derives
both halves of the aria-describedby link from one controlId so they cannot
drift, and keeps the `nudge` testid four harvested assertions address.

The server-answer alerts and DestructiveConfirm's arming question are not
control refusals and keep their own markup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `PanelCard`

Eleven panels re-assemble `Card` + a captioned heading + a gap'd body, with the gap chosen per file: `gap-2` (SectionRail), `gap-4` (AcceptedCard, RefusedCard, DecisionDock, NoDisclosureCards, OrderRail), `gap-5` (CoverageSpine), `gap-6` (GapCard, DecisionPanel), `gap-7` (RuleDetail), `gap-8` (CallBackSheet). Three of them sit side by side on Review.

**Files:**
- Create: `apps/web-v2/src/shared/ui/PanelCard.tsx`
- Create: `apps/web-v2/src/shared/ui/PanelCard.stories.tsx`
- Modify (adoption): `features/review/SectionRail.tsx:40-72`, `features/review/OrderRail.tsx:27-62`, `features/review/CoverageSpine.tsx:80-111`, `features/review/DecisionDock.tsx:66-68`, `features/review/DecisionPanel.tsx:77-79`, `features/review/CallBackSheet.tsx:39-41`, `features/completeness/GapCard.tsx:70-72`, `features/rulebook/RuleDetail.tsx:82-84`
- Test: `apps/web-v2/src/shared/ui/PanelCard.stories.tsx`

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardBody`, `CardFooter` from `apps/web-v2/src/shared/ui/Card.tsx` (Tasks 1–2); `Eyebrow`; `cn`.
- Produces:
  ```tsx
  export interface PanelCardProps {
    caption: ReactNode;
    band?: boolean;               // default false — the filled heading band
    gap?: "2" | "4" | "6" | "8";  // default "4"
    footer?: ReactNode;
    children: ReactNode;
  }
  export function PanelCard(props: PanelCardProps): ReactElement;
  ```
  Four gaps, not six: `gap-5` and `gap-7` are single-site values with no design source and fold to `4` and `6`.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/PanelCard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PanelCard } from "./PanelCard";

const meta = {
  title: "Primitives/PanelCard",
  component: PanelCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PanelCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A panel is a caption and a stack. Eleven of them re-assembled that from
 * three components and chose the body gap per file, so panels sitting beside
 * each other on Review breathed differently for no stated reason.
 */
export const Captioned: Story = {
  args: { caption: "Coverage", children: null },
  render: () => (
    <PanelCard caption="Coverage" gap="6" footer="Frozen against config v4.">
      <p data-testid="a">Coverage · all 64 pages</p>
      <p data-testid="b">11 read in full</p>
    </PanelCard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("Coverage")).toBeInTheDocument();
    const body = (await canvas.findByTestId("a")).parentElement as HTMLElement;
    // gap="6" is 12px on the 2px base.
    expect(getComputedStyle(body).rowGap).toBe("12px");
    expect(
      await canvas.findByText("Frozen against config v4."),
    ).toBeInTheDocument();
  },
};

/** The banded heading — a filled band, which is a different claim. */
export const Banded: Story = {
  args: { caption: "Sign-off lines", children: null },
  render: () => (
    <PanelCard caption="Sign-off lines" band>
      <p data-testid="c">Thirteen operational lines.</p>
    </PanelCard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = (await canvas.findByText("Sign-off lines"))
      .parentElement as HTMLElement;
    const body = (await canvas.findByTestId("c")).parentElement as HTMLElement;
    expect(getComputedStyle(heading).backgroundColor).not.toBe(
      getComputedStyle(body).backgroundColor,
    );
    expect(getComputedStyle(body).rowGap).toBe("8px");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/PanelCard.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./PanelCard" from "src/shared/ui/PanelCard.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/PanelCard.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, CardBody, CardFooter, CardHeader } from "./Card";
import { Eyebrow } from "./Eyebrow";
import { cn } from "./classNames";

/**
 * A CAPTION AND A STACK — eleven panels re-assembled that from three
 * components, and each chose its own body gap: 2, 4, 5, 6, 7 and 8 across
 * eleven files, three of which sit beside each other on Review. Nothing in the
 * export varies that way; the variation was per-author, not per-design.
 *
 * FOUR GAPS, NOT SIX. `gap-5` and `gap-7` had one site each and no source, and
 * fold into their neighbours. A scale with a value for every past accident is
 * not a scale.
 *
 * BAND OR CAPTION IS A CLAIM, not a decoration. A filled band says the heading
 * names a REGION of a larger document — the sign-off lines, the draft sheet;
 * a bare caption says it names THIS card. Drawing every heading as a band
 * makes a five-panel column read as one long table.
 */
const GAP = {
  "2": "gap-2",
  "4": "gap-4",
  "6": "gap-6",
  "8": "gap-8",
} as const;

export interface PanelCardProps {
  caption: ReactNode;
  /** The filled heading band. A bare caption is the default. */
  band?: boolean;
  gap?: keyof typeof GAP;
  footer?: ReactNode;
  children: ReactNode;
}

export function PanelCard({
  caption,
  band = false,
  gap = "4",
  footer,
  children,
}: PanelCardProps) {
  return (
    <Card>
      {band ? (
        <CardHeader filled>
          <Eyebrow variant="section">{caption}</Eyebrow>
        </CardHeader>
      ) : null}
      <CardBody className={cn("flex flex-col", GAP[gap])}>
        {band ? null : <Eyebrow variant="caption">{caption}</Eyebrow>}
        {children}
      </CardBody>
      {footer === undefined ? null : <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
```

`GAP` is a frozen lookup rather than a `cva` variant because Tailwind must see the four literal class names in the source to emit them, and an index into a literal object is the shortest spelling that keeps them literal.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/PanelCard.stories.tsx
```

- [ ] **Step 5: Adopt at the eight panels that carry no accent**

Each site drops its `<Card>` + `<CardBody className="flex flex-col gap-N">` pair and its heading element and passes the heading as `caption`. Where the `data-testid` was on the `Card`, wrap the `PanelCard` in `<div data-testid="…">` so Playwright's selector still resolves.

| # | Site | Call |
|---|---|---|
| 1 | `features/review/SectionRail.tsx:40-72` | `<div data-testid="section-rail"><PanelCard caption="Jump to section" gap="2">` … |
| 2 | `features/review/OrderRail.tsx:27-62` | `<div data-testid="order-rail"><PanelCard caption="This order" gap="4">` … |
| 3 | `features/review/CoverageSpine.tsx:80-111` | `<div data-testid="coverage-spine"><PanelCard caption="Coverage" gap="4">` … (`gap-5` folds to `4`) |
| 4 | `features/review/DecisionDock.tsx:66-68` | `<PanelCard caption={…the existing heading node…} gap="4">` |
| 5 | `features/review/DecisionPanel.tsx:77-79` | `<PanelCard caption={…the existing CardHeader content…} band gap="6">` |
| 6 | `features/review/CallBackSheet.tsx:39-41` | `<PanelCard caption={…the existing CardHeader content…} band gap="8">` |
| 7 | `features/completeness/GapCard.tsx:70-72` | `<PanelCard caption={…the existing CardHeader content…} band gap="6">` |
| 8 | `features/rulebook/RuleDetail.tsx:82-84` | `<PanelCard caption={…the existing CardHeader content…} band gap="6">` (`gap-7` folds to `6`) |

**Three panels are deliberately not adopted**, and this is stated rather than fudged: `features/ingest/AcceptedCard.tsx:15`, `features/ingest/RefusedCard.tsx:36` and `features/review/NoDisclosureCards.tsx:35` each carry a `Card.accent`. `PanelCard` does not expose `accent` on purpose — a panel's caption and a card's severity stripe are different claims, and threading one through the other would make `PanelCard` a second `Card` with two ways to spell everything. They keep their `Card` + `CardBody` composition. `AcceptedCard` additionally has no caption at all, so there is nothing for the component to own.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/PanelCard.tsx apps/web-v2/src/shared/ui/PanelCard.stories.tsx apps/web-v2/src/features
git commit -m "$(cat <<'EOF'
Give the captioned panel one component and one gap scale

Eleven panels re-assembled Card + heading + stack and each picked its own body
gap — 2, 4, 5, 6, 7 and 8 across eleven files, three of them side by side on
Review. Nothing in the export varies that way. gap-5 and gap-7 had one site
each and fold into their neighbours.

Three panels carry a Card accent and keep their own composition: a caption and
a severity stripe are different claims, and threading one through the other
would make PanelCard a second Card.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `CensusTile`

Five sites, thirteen tiles, three private near-miss components (`TallyStrip.Tally`, `RulebookHeader.Stat`, `OrderCounts.cell`). Named **census**, not stat, on purpose: HANDOFF-UI §4.5 forbids rates, and the name is what makes a future `perHour` prop obviously refusable.

**Files:**
- Create: `apps/web-v2/src/shared/ui/CensusTile.tsx`
- Create: `apps/web-v2/src/shared/ui/CensusTile.stories.tsx`
- Modify: `packages/ui-tokens/src/tokens.css` (add `--text-census` after `--text-lg`, line 309)
- Modify: `apps/web-v2/src/shared/ui/classNames.ts:35-38`
- Modify (adoption, 5 sites): `features/overview/TallyStrip.tsx:30-61`, `features/processing/PackageStats.tsx:32-37`, `features/processing/PackageStats.tsx:39-46`, `features/rulebook/RulebookHeader.tsx:49-72`, `app/OrderCounts.tsx:46-63`

**Interfaces:**
- Consumes: `Eyebrow` (`variant="stat"`), `cn`.
- Produces:
  ```tsx
  export interface CensusTileProps {
    value: ReactNode;
    caption: ReactNode;
    tone?: "muted" | "action" | "attend" | "halt" | "settled";
    edge?: boolean;             // the right-hand divider BETWEEN tiles
    size?: "strip" | "board";   // default "board"
  }
  export function CensusTile(props: CensusTileProps): ReactElement;
  ```
  Two additive extensions of the pinned shape, each forced by a decision already taken. `tone` gains `"action"` because `TallyStrip`'s "Stopped on a person" and `OrderCounts`' "Need you" are violet on purpose — most of the pipeline is meant to be waiting on somebody, and a halt colour there teaches everyone to read normal operation as a failure. `size` exists because the export draws census numerals at two tiers, 22px on the board (export lines 488, 492) and 15px in the chrome strip (lines 141–153), and decision D10 requires the strip's to be 15px mono.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/CensusTile.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CensusTile } from "./CensusTile";

const meta = {
  title: "Primitives/CensusTile",
  component: CensusTile,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CensusTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * EVERY FIGURE HERE IS A CENSUS — how many are sitting where, right now. None
 * is a rate, a throughput, an average or a target (§4.5). The name is the
 * guard: a `perHour` prop on something called CensusTile is obviously wrong.
 */
export const Board: Story = {
  args: { value: 12, caption: "Orders in flight" },
  render: () => (
    <div className="flex">
      <CensusTile value={12} caption="Orders in flight" edge />
      <CensusTile value={7} caption="Stopped on a person" tone="action" edge />
      <CensusTile value={1} caption="Off the pipeline" tone="halt" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const numeral = await canvas.findByText("12");
    const style = getComputedStyle(numeral);
    // Mono, because these get compared against a package a person is holding.
    expect(style.fontFamily).toContain("Mono");
    expect(style.fontSize).toBe("22px");

    // Semantic tones: violet means "waiting on a person", which is normal, and
    // only the off-pipeline figure is drawn as an alarm.
    const halted = await canvas.findByText("7");
    const failed = await canvas.findByText("1");
    expect(getComputedStyle(halted).color).not.toBe(style.color);
    expect(getComputedStyle(failed).color).not.toBe(
      getComputedStyle(halted).color,
    );

    // `edge` is the divider BETWEEN tiles, so the last one never draws one.
    const lastTile = failed.parentElement as HTMLElement;
    expect(getComputedStyle(lastTile).borderRightWidth).toBe("0px");
  },
};

/** The chrome strip's tier — 15px mono (decision D10), same component. */
export const Strip: Story = {
  args: { value: 4, caption: "Need you", size: "strip" },
  render: () => (
    <CensusTile value={4} caption="Need you" tone="action" size="strip" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const numeral = await canvas.findByText("4");
    expect(getComputedStyle(numeral).fontSize).toBe("15px");
    expect(getComputedStyle(numeral).fontFamily).toContain("Mono");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/CensusTile.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./CensusTile" from "src/shared/ui/CensusTile.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

**3a.** `packages/ui-tokens/src/tokens.css`, immediately after `--text-lg` (line 309):

```css
  --text-census: 0.9375rem; /* 15px — the chrome strip's census numeral (D10) */
```

**3b.** `apps/web-v2/src/shared/ui/classNames.ts:35-38` — register it, or tailwind-merge classifies `text-census` as a colour and silently drops the size (the trap that file's own note documents):

```ts
      text: [
        "micro", "tiny", "xs", "sm", "base", "md",
        "lg", "census", "xl", "2xl", "3xl", "4xl", "5xl",
      ],
```

**3c.** `apps/web-v2/src/shared/ui/CensusTile.tsx`:

```tsx
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { cn } from "./classNames";

/**
 * A CENSUS, NEVER A RATE. Every figure this draws answers "how many are
 * sitting here right now" — not per hour, not per person, not against a
 * target. §4.5 makes that a release blocker, and the NAME is the enforcement:
 * a `perHour` prop on a component called CensusTile is obviously refusable,
 * where the same prop on a `StatTile` would read as a feature request.
 *
 * THE TONES ARE SEMANTIC. Violet means "stopped on a person", which is the
 * product working: most of the pipeline is meant to be waiting on somebody,
 * and colouring that as an alarm teaches everyone to read normal operation as
 * a problem. Halt is reserved for the figure where the order is in NO stage
 * and nothing will move it.
 *
 * MONO NUMERALS, because these get compared against the package a person is
 * holding, and because a 1 beside a 7 does not line up when the figure changes
 * width.
 *
 * TWO TIERS, both from the export: 22px where the tile IS the content, 15px
 * where it rides in the chrome. One component, because the semantics are
 * identical and a size is not a different claim.
 *
 * This component never adds anything up. The figures arrive from the server.
 */
const TONE = {
  muted: "text-ink-primary",
  action: "text-action",
  attend: "text-state-attend-ink",
  halt: "text-state-halt-ink",
  settled: "text-state-settled-ink",
} as const;

export interface CensusTileProps {
  value: ReactNode;
  caption: ReactNode;
  tone?: keyof typeof TONE;
  /** The divider BETWEEN tiles. The last tile in a row never takes one. */
  edge?: boolean;
  size?: "strip" | "board";
}

export function CensusTile({
  value,
  caption,
  tone = "muted",
  edge = false,
  size = "board",
}: CensusTileProps) {
  return (
    <div
      className={cn(
        size === "board" && "flex-1 basis-75 px-8 py-6",
        edge && "border-r border-line-subtle",
      )}
    >
      <p
        className={cn(
          "font-mono leading-flat font-semibold",
          size === "strip" ? "text-census" : "text-3xl",
          TONE[tone],
        )}
      >
        {value}
      </p>
      <Eyebrow variant="stat" as="p" className="mt-2">
        {caption}
      </Eyebrow>
    </div>
  );
}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/CensusTile.stories.tsx
```

- [ ] **Step 5: Adopt at all 5 sites**

**5a. `features/overview/TallyStrip.tsx`** — delete the private `Tally` (`:40-61`) and the now-unused `cn` and `Eyebrow` imports:

```tsx
    <Card className="flex flex-wrap">
      <CensusTile value={total} caption="Orders in flight" edge />
      <CensusTile value={halted} caption="Stopped on a person" tone="action" edge />
      <CensusTile value={moving} caption="Moving on its own" edge />
      <CensusTile value={failed} caption="Off the pipeline" tone="halt" />
    </Card>
```

"Moving on its own" was `text-ink-secondary`; it takes the default `muted` with the rest. The export distinguishes these three by their caption, not by three greys.

**5b/5c. `features/processing/PackageStats.tsx:32-46`** — the two numeral cells become tiles; the classifier sentence and the flex bases are untouched, because the WHY note above them is about the proportions and stays true:

```tsx
    <div className="flex overflow-hidden rounded-9 border border-line-strong bg-surface-panel">
      <div className="basis-3/10 border-r border-line-strong">
        <CensusTile value={totalPages} caption="Pages in package" />
      </div>
      <div className="basis-3/10 border-r border-line-strong">
        <CensusTile value={pagesRelevant} caption="Read in full" tone="action" />
      </div>
      <p className="flex basis-2/5 items-center px-9 py-7 text-sm leading-body text-ink-secondary">
        {classifierNote}
      </p>
    </div>
```

**5d. `features/rulebook/RulebookHeader.tsx`** — delete the private `Stat` (`:61-72`) and the `cn` import:

```tsx
        <CensusTile value={counts.live} caption="Live" tone="settled" size="strip" />
        <CensusTile value={counts.pending} caption="Pending" tone="attend" size="strip" />
        <CensusTile value={counts.retired} caption="Retired" size="strip" />
```

The three tiles move from 16px proportional to 15px mono and from the base state colours to their `-ink` counterparts, which is what `Eyebrow`'s own tone note says small figures need to clear AA on this ground.

**5e. `app/OrderCounts.tsx`** — delete the private `cell` closure (`:46-51`):

```tsx
    <div data-testid="order-counts" className="flex flex-wrap gap-6">
      <CensusTile value={fields.length} caption="Fields" size="strip" />
      <CensusTile value={auto} caption="Auto-confirmed" tone="settled" size="strip" />
      <CensusTile value={need} caption="Need you" tone="action" size="strip" />
      <CensusTile value={noSource} caption="No source" size="strip" />
    </div>
```

`No source` loses its conditional red — decision D10 adopts the export, where it stays muted unconditionally, because red there makes it louder than NEED YOU, which is the actionable tile. Delete the WHY comment at `:54-57` in the same edit: it asserts an always-visible, never-breakpoint-hidden invariant that D10 has just reversed, and a comment stating an untrue guarantee is worse than no comment. The breakpoint behaviour itself is Wave 4's `OrderStrip` work.

`OrderStrip.stories.tsx:83-88` asserts the counts by label text; the labels are unchanged, so it keeps passing.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add packages/ui-tokens/src/tokens.css apps/web-v2/src/shared/ui/classNames.ts apps/web-v2/src/shared/ui/CensusTile.tsx apps/web-v2/src/shared/ui/CensusTile.stories.tsx apps/web-v2/src/features/overview/TallyStrip.tsx apps/web-v2/src/features/processing/PackageStats.tsx apps/web-v2/src/features/rulebook/RulebookHeader.tsx apps/web-v2/src/app/OrderCounts.tsx
git commit -m "$(cat <<'EOF'
Draw every census figure with one tile, at the export's two tiers

Three private near-miss components rendered the same mono numeral and caption
and drifted into three sizes and two colour vocabularies. Naming it census
rather than stat is the point: 4.5 forbids rates, and a perHour prop on a
CensusTile is obviously refusable where the same prop on a StatTile would read
as a feature request.

The chrome strip adopts D10 — 15px mono, and NO SOURCE stays muted rather than
turning red, which made it louder than NEED YOU. Its false always-visible
comment goes with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `EmptyPanel` + `EmptyNote`

Six sites. Both mean **RESOLVED AND EMPTY** — the server answered, and the answer was nothing — and never **NOT LOADED**. Conflating them is how a loading bug ships as a design.

**Files:**
- Create: `apps/web-v2/src/shared/ui/EmptyPanel.tsx`
- Create: `apps/web-v2/src/shared/ui/EmptyPanel.stories.tsx`
- Delete: `apps/web-v2/src/features/products/EmptyState.tsx`
- Modify (adoption, 6 sites): `features/products/ProductList.tsx:9,55-60`, `features/products/LineCatalogue.tsx:7,64-73`, `features/clients/OneClientTab.tsx:66-70`, `features/overview/StageColumn.tsx:62`, `features/overview/StageRail.tsx:53`, `features/clients/CompareStacked.tsx:79-81`

**Interfaces:**
- Consumes: nothing beyond React.
- Produces:
  ```tsx
  export interface EmptyPanelProps {
    title: ReactNode;
    body?: ReactNode;
    actions?: ReactNode;
  }
  export function EmptyPanel(props: EmptyPanelProps): ReactElement;

  export interface EmptyNoteProps { children: ReactNode }
  export function EmptyNote(props: EmptyNoteProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/EmptyPanel.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { EmptyNote, EmptyPanel } from "./EmptyPanel";
import { Button } from "./Button";

const meta = {
  title: "Primitives/EmptyPanel",
  component: EmptyPanel,
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * RESOLVED AND EMPTY, never NOT LOADED. The dash is the claim: a solid card
 * says "here is a thing", and an empty list is not a thing — it is a hole with
 * an instruction in it.
 */
export const FirstRun: Story = {
  args: { title: "No products yet" },
  render: () => (
    <EmptyPanel
      title="No products yet"
      body="A product is the sign-off list a client's orders are checked against."
      actions={<Button data-testid="seed">Seed the standard 13</Button>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = await canvas.findByTestId("empty-panel");
    expect(getComputedStyle(panel).borderTopStyle).toBe("dashed");
    expect(panel).toHaveTextContent("No products yet");
    expect(await canvas.findByTestId("seed")).toBeInTheDocument();
  },
};

/** The inline line, for a region of an otherwise populated screen. */
export const Note: Story = {
  args: { title: "" },
  render: () => <EmptyNote>Nothing here</EmptyNote>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const note = await canvas.findByTestId("empty-note");
    expect(note).toHaveTextContent("Nothing here");
    expect(getComputedStyle(note).fontStyle).toBe("italic");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/EmptyPanel.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./EmptyPanel" from "src/shared/ui/EmptyPanel.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/EmptyPanel.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * BOTH OF THESE MEAN "RESOLVED AND EMPTY". Neither may ever stand in for "not
 * loaded yet".
 *
 * That is not pedantry about states — it is the failure mode. A query that
 * never resolves and a column the server says is genuinely empty look
 * identical the moment one component serves both, and then a loading bug ships
 * as a design: the screen looks finished, states something false, and nothing
 * in the suite can see it. A pending fetch renders its own pending affordance;
 * these two render only what the server ANSWERED.
 *
 * THE DASH IS DOING REAL WORK. A solid card says "here is a thing", and an
 * empty list is not a thing — it is a hole with an instruction in it. The same
 * treatment on every first-run panel makes them read as one state rather than
 * as three screens that each happen to be blank.
 *
 * TWO SHAPES, ONE MEANING: the panel is for a whole surface with nothing in it
 * yet, which wants a way in; the note is for a REGION of a populated screen —
 * an empty stage column — where a panel would shout and there is nothing to
 * offer anyway.
 */
export interface EmptyPanelProps {
  title: ReactNode;
  body?: ReactNode;
  /**
   * A slot, because the empty states differ: products offer one way in, the
   * line catalogue offers two (seed the standard 13, or write your own), and
   * that choice is the point of the panel.
   */
  actions?: ReactNode;
}

export function EmptyPanel({ title, body, actions }: EmptyPanelProps) {
  return (
    <div
      data-testid="empty-panel"
      className="rounded-9 border border-dashed border-line-strong bg-surface-panel p-15 text-center"
    >
      <p className="font-semibold text-ink-primary">{title}</p>
      {body === undefined ? null : (
        <p className="mt-2 text-sm leading-body text-ink-secondary">{body}</p>
      )}
      {actions === undefined ? null : (
        <div className="mt-7 flex flex-wrap justify-center gap-4">{actions}</div>
      )}
    </div>
  );
}

export interface EmptyNoteProps {
  children: ReactNode;
}

export function EmptyNote({ children }: EmptyNoteProps) {
  return (
    <p
      data-testid="empty-note"
      className="px-1 py-4 text-tiny text-ink-muted italic"
    >
      {children}
    </p>
  );
}
```

Then delete `apps/web-v2/src/features/products/EmptyState.tsx`. Its note about the dash survives above, extended with the resolved-versus-not-loaded rule it never stated.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/EmptyPanel.stories.tsx
```

- [ ] **Step 5: Adopt at all 6 sites**

| # | Site | Change |
|---|---|---|
| 1 | `features/products/ProductList.tsx:9,55-60` | import swaps to `import { EmptyPanel } from "../../shared/ui/EmptyPanel";`; `<EmptyState title=… body=…>{…}</EmptyState>` becomes `<EmptyPanel title=… body=… actions={<>…the existing children…</>} />` |
| 2 | `features/products/LineCatalogue.tsx:7,64-73` | same swap; both buttons move from children into `actions` |
| 3 | `features/clients/OneClientTab.tsx:66-70` | the `<p className="font-semibold text-ink-primary">No clients yet</p>` and its wrapper become `<EmptyPanel title="No clients yet" body="A client holds only deltas against the product baseline. None has been created." />` |
| 4 | `features/overview/StageColumn.tsx:62` | `<p className="px-1 py-4 text-tiny text-ink-muted italic">Nothing here</p>` → `<EmptyNote>Nothing here</EmptyNote>` |
| 5 | `features/overview/StageRail.tsx:53` | `<span className="self-center text-tiny text-ink-muted italic">Nothing here</span>` → `<EmptyNote>Nothing here</EmptyNote>`; `self-center` goes, the row already centres a block |
| 6 | `features/clients/CompareStacked.tsx:79-81` | `<p className="px-7 py-5 text-xs italic text-ink-muted">Nothing special about this client — every line as the baseline</p>` → `<EmptyNote>Nothing special about this client — every line as the baseline</EmptyNote>` |

Sites 4 and 5 are guarded today by a length check on a server-supplied array. Leave those guards exactly as they are, and do **not** introduce one anywhere the data can also be `undefined` while a query is pending — that is precisely the conflation this component's note forbids.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/EmptyPanel.tsx apps/web-v2/src/shared/ui/EmptyPanel.stories.tsx apps/web-v2/src/features/products apps/web-v2/src/features/clients apps/web-v2/src/features/overview
git commit -m "$(cat <<'EOF'
Share the two empty states, and write down what they do not mean

Six sites drew a dashed first-run panel or an italic nothing-line, one of them
stranded inside a feature folder. Both mean RESOLVED AND EMPTY and never NOT
LOADED — the distinction is in the component's own note, because conflating
them is how a query that never resolves ships looking like a finished screen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `ReasonEditor`

`EscalateEditor` and `ExcludeEditor` are the same file with two words changed; `PassControl` is the same again with better a11y. They have **already diverged in behaviour** — `PassControl` disables its input while the mutation is in flight and links its nudge, the other two do neither — which is precisely what one refusal drifting into three refusals looks like.

**Files:**
- Create: `apps/web-v2/src/shared/ui/ReasonEditor.tsx`
- Create: `apps/web-v2/src/shared/ui/ReasonEditor.stories.tsx`
- Modify: `apps/web-v2/src/features/review/EscalateEditor.tsx` (whole body)
- Modify: `apps/web-v2/src/features/review/ExcludeEditor.tsx` (whole body)
- Modify: `apps/web-v2/src/entities/order/PassControl.tsx` (whole body)

**Interfaces:**
- Consumes: `Card` (Tasks 1–2), `RefusalNudge` + `nudgeIdFor` (Task 5), `Eyebrow`, `TextField`, `TextArea`, `Button`.
- Produces:
  ```tsx
  export interface ReasonEditorField {
    /** Doubles as the control's DOM id and its data-testid. */
    name: string;
    label: string;
    placeholder?: string;
    multiline?: boolean;
  }
  export interface ReasonEditorProps {
    fields: readonly ReasonEditorField[];
    /** Returns the refusal message, or null when the form may submit. */
    refusal: (values: Record<string, string>) => string | null;
    submitLabel: string;
    tone?: "action" | "attend" | "halt";   // default "attend"
    testId: string;
    onSubmit: (values: Record<string, string>) => void;
    onCancel: () => void;
    /** A mutation is in flight — the fields lock, nothing re-submits. */
    pending?: boolean;
  }
  export function ReasonEditor(props: ReasonEditorProps): ReactElement;
  ```
  `pending` is one additive extension of the pinned shape. `PassControl` disables its input while `pass.isPending` (`NextOrderCard.tsx:90`), and dropping that would let a second Enter fire the same mutation twice; adding a prop is cheaper than losing the guard.

**Two named sites are deliberately NOT adopted, with reasons:**

- `features/review/CorrectEditor.tsx` — `ux.spec.ts:100` asserts `edit-submit` is **disabled** until the value differs from the machine read (§11.1: a correction must actually change something), and `:107` asserts it is enabled once it does. `ReasonEditorProps` has one gate, `refusal`, and a refusal *speaks* — it never renders inert. Expressing must-differ through it would flip a harvested invariant. `CorrectEditor` keeps its file; it already adopted `Card` (Task 1) and `RefusalNudge` (Task 5).
- `features/escalations/ResolveCard.tsx` — its rule choice is a `RadioGroup` plus a native `<select>` that must stay native, because Playwright's `selectOption` drives nothing else (HANDOFF-UI §7). `fields: readonly ReasonEditorField[]` has no non-text member and `ReasonEditorProps` has no children slot; forcing it in would either widen the pinned interface or replace a select the suite can drive with one it cannot.

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/ReasonEditor.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ReasonEditor } from "./ReasonEditor";

const meta = {
  title: "Primitives/ReasonEditor",
  component: ReasonEditor,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ReasonEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const FIELDS = [
  {
    name: "escalate-input",
    label: "What do you not know?",
    placeholder: "the question, as you would ask it out loud",
  },
] as const;

const refusal = (values: Record<string, string>) =>
  (values["escalate-input"] ?? "").trim() === ""
    ? "an escalation needs its question — the senior answers questions, not flags"
    : null;

/**
 * THE SUBMIT STAYS ENABLED AND EXPLAINS ITSELF (`ux.spec` #5/#6). An inert
 * button tells a keyboard or screen-reader user nothing about what is missing;
 * a control that answers does. The nudge is the requirement, not decoration.
 */
export const RefusalSpeaks: Story = {
  args: {
    fields: FIELDS,
    refusal,
    submitLabel: "Escalate to a senior",
    testId: "escalate",
    onSubmit: () => {},
    onCancel: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByTestId("escalate-input");
    // The first field takes focus, so the chord that opened this lands somewhere.
    expect(field).toHaveFocus();

    const submit = await canvas.findByTestId("escalate-submit");
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    const nudge = await canvas.findByTestId("nudge");
    expect(nudge).toHaveTextContent("needs its question");
    expect(field).toHaveAttribute("aria-describedby", nudge.id);
  },
};

/**
 * ENTER COMMITS FROM INSIDE THE FIELD, ESCAPE LEAVES IT — handled on the
 * container, ABOVE react-hotkeys-hook's input guard, so `[` typed in a field
 * is still text (`sidebar.spec` #5) and the fields carry no key handler.
 */
export const KeysCommitAndCancel: Story = {
  args: {
    fields: FIELDS,
    refusal,
    submitLabel: "Escalate to a senior",
    testId: "escalate",
    onSubmit: () => {},
    onCancel: () => {},
  },
  render: (args) => {
    const log: string[] = [];
    (globalThis as { __reasonLog?: string[] }).__reasonLog = log;
    return (
      <ReasonEditor
        {...args}
        onSubmit={(v) => log.push(`submit:${v["escalate-input"] ?? ""}`)}
        onCancel={() => log.push("cancel")}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByTestId("escalate-input");
    const log = (globalThis as { __reasonLog?: string[] }).__reasonLog ?? [];

    // Empty Enter submits NOTHING and says why.
    await userEvent.type(field, "{Enter}");
    expect(log).toHaveLength(0);
    expect(await canvas.findByTestId("nudge")).toBeInTheDocument();

    // A bracket is text, not a chord.
    await userEvent.type(field, "[which source wins?");
    expect(field).toHaveValue("[which source wins?");

    await userEvent.type(field, "{Enter}");
    expect(log).toEqual(["submit:[which source wins?"]);

    await userEvent.type(field, "{Escape}");
    expect(log).toEqual(["submit:[which source wins?", "cancel"]);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ReasonEditor.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./ReasonEditor" from "src/shared/ui/ReasonEditor.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/ReasonEditor.tsx`:

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { Eyebrow } from "./Eyebrow";
import { RefusalNudge, nudgeIdFor } from "./RefusalNudge";
import { TextArea, TextField } from "./TextField";

/**
 * ONE REFUSAL, NOT THREE. `EscalateEditor` and `ExcludeEditor` were the same
 * file with two words changed and `PassControl` was the same again — and they
 * had already diverged: only one of the three locked its input while the
 * mutation was in flight, and only one linked its nudge to its field. Three
 * copies of a refusal become three different refusals, and the one nobody
 * looked at is the one that stops refusing.
 *
 * THE SUBMIT STAYS ENABLED AND EXPLAINS ITSELF ON CLICK (`ux.spec` #5/#6,
 * orphan O10). An inert button tells a keyboard or screen-reader user nothing
 * about what is missing; a control that answers does. This is UI feedback and
 * not authority — the contract's `min(1)` refuses the same submission at the
 * server, and a test posting the invalid state straight to the API asserts the
 * 422. That is what makes this layer a mirror rather than a load-bearing wall.
 *
 * ENTER COMMITS FROM INSIDE THE FIELD, ESCAPE LEAVES IT — handled on the
 * container, ABOVE react-hotkeys-hook's input guard, so no field carries its
 * own key handler and a `[` or a chord key typed into one is still text
 * (`sidebar.spec` #5, `hard.spec` #5).
 *
 * THE FIRST FIELD TAKES FOCUS. Without it a reviewer presses the chord that
 * opens this and their focus stays where it was, with nothing to say anything
 * happened.
 *
 * THE NUDGE DESCRIBES THE FIRST FIELD, always. A refusal about a form is
 * announced from where the caret already is; hunting for which of two fields
 * owns the message is work the reader should not be doing.
 */
export interface ReasonEditorField {
  /** Doubles as the control's DOM id and its `data-testid`. */
  name: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

export interface ReasonEditorProps {
  fields: readonly ReasonEditorField[];
  /** Returns the refusal message, or null when the form may submit. */
  refusal: (values: Record<string, string>) => string | null;
  submitLabel: string;
  tone?: "action" | "attend" | "halt";
  testId: string;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
  /** A mutation is in flight: the fields lock and nothing re-submits. */
  pending?: boolean;
}

export function ReasonEditor({
  fields,
  refusal,
  submitLabel,
  tone = "attend",
  testId,
  onSubmit,
  onCancel,
  pending = false,
}: ReasonEditorProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [refused, setRefused] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => firstRef.current?.focus(), []);

  // `noUncheckedIndexedAccess`: the first field is only there if there is one.
  const anchor = fields[0]?.name ?? testId;

  const attempt = () => {
    if (pending) return;
    const message = refusal(values);
    if (message !== null) {
      setRefused(message);
      return;
    }
    onSubmit(values);
  };

  const keys = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      attempt();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <Card
      size="nested"
      tone={tone}
      data-testid={testId}
      onKeyDown={keys}
      className="flex flex-col gap-3 p-5"
    >
      {fields.map((field, index) => {
        const Control = field.multiline === true ? TextArea : TextField;
        return (
          <div key={field.name} className="flex flex-col gap-2">
            <Eyebrow as="label" htmlFor={field.name} variant="field">
              {field.label}
            </Eyebrow>
            <Control
              id={field.name}
              data-testid={field.name}
              ref={index === 0 ? firstRef : undefined}
              disabled={pending}
              value={values[field.name] ?? ""}
              placeholder={field.placeholder}
              tone={refused === null ? "neutral" : "halt"}
              aria-describedby={refused === null ? undefined : nudgeIdFor(anchor)}
              onChange={(event) => {
                setValues((prev) => ({ ...prev, [field.name]: event.target.value }));
                if (refused !== null) setRefused(null);
              }}
            />
          </div>
        );
      })}

      <div>
        <Button size="sm" tone={tone} data-testid={`${testId}-submit`} onClick={attempt}>
          {submitLabel}
        </Button>
      </div>

      {refused === null ? null : (
        <RefusalNudge controlId={anchor} message={refused} />
      )}
    </Card>
  );
}
```

`Control` is chosen by `field.multiline === true` rather than truthiness because `exactOptionalPropertyTypes` makes the absent case exactly `undefined` and the explicit comparison says so.

If the file exceeds 150 lines once the WHY block is in place, split the field loop into a private `ReasonField` component in the same file — the two halves are "the form's behaviour" and "one labelled control", which is a real seam.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ReasonEditor.stories.tsx
```

- [ ] **Step 5: Adopt at the three sites**

**5a. `features/review/EscalateEditor.tsx`** — the whole body becomes:

```tsx
import { ReasonEditor } from "../../shared/ui/ReasonEditor";

const FIELDS = [
  {
    name: "escalate-input",
    label: "What do you not know?",
    placeholder: "the question, as you would ask it out loud",
  },
] as const;

/**
 * AN ESCALATION IS REFUSED WITHOUT ITS QUESTION (`review.spec` #6; conflict C9).
 *
 * The design's escalate is a bare button, and its own `escalateField` fills the
 * reason with the literal string "Escalated from review" when none was typed.
 * That is worse than omitting the field: a missing input is visibly missing,
 * while a fabricated default is indistinguishable downstream from a real
 * question, and the senior resolving it has no way to tell which they are
 * reading. Overridden — the question is typed or nothing is sent.
 */
export function EscalateEditor({
  onSubmit,
  onCancel,
}: {
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  return (
    <ReasonEditor
      fields={FIELDS}
      tone="attend"
      testId="escalate"
      submitLabel="Escalate to a senior"
      refusal={(values) =>
        (values["escalate-input"] ?? "").trim() === ""
          ? "an escalation needs its question — the senior answers questions, not flags"
          : null
      }
      onCancel={onCancel}
      onSubmit={(values) => onSubmit((values["escalate-input"] ?? "").trim())}
    />
  );
}
```

**5b. `features/review/ExcludeEditor.tsx`** — same shape, halt tone:

```tsx
const FIELDS = [
  {
    name: "exclude-reason",
    label: "Why is this not our party?",
    placeholder: "middle initial differs and the address is a different county",
  },
] as const;
```
```tsx
    <ReasonEditor
      fields={FIELDS}
      tone="halt"
      testId="exclude"
      submitLabel="✕ Not our party"
      refusal={(values) =>
        (values["exclude-reason"] ?? "").trim() === ""
          ? "a suppression needs its reason — the row disappears, the reason is all that is left"
          : null
      }
      onCancel={onCancel}
      onSubmit={(values) => onSubmit((values["exclude-reason"] ?? "").trim())}
    />
```

Keep the file's existing WHY block verbatim — the suppression rule it states is unchanged.

**5c. `entities/order/PassControl.tsx`** — keeps its `pending` prop and passes it through:

```tsx
const FIELDS = [
  {
    name: "pass-reason",
    label: "Why are you passing?",
    // Lower-case deliberately: `queue.spec` #3 matches /why are you passing/
    // case-sensitively. The spec is the authority on copy here — rewriting the
    // regex to /i would be weakening a harvested assertion.
    placeholder: "why are you passing this order?",
  },
] as const;
```
```tsx
    <div className="mt-6">
      <ReasonEditor
        fields={FIELDS}
        tone="attend"
        testId="pass"
        pending={pending}
        submitLabel="Pass — say why"
        refusal={(values) =>
          (values["pass-reason"] ?? "").trim() === ""
            ? "a pass needs its why — one line is enough"
            : null
        }
        onCancel={onCancel}
        onSubmit={(values) => onSubmit((values["pass-reason"] ?? "").trim())}
      />
    </div>
```

Keep the file's existing WHY block verbatim.

Three specs address these by selector and must still resolve after the change: `queue.spec:45,61` finds the pass input by `getByPlaceholder(/why are you passing/)`; `ux.spec:132,141` finds it as `input:focus`; `review.spec:95,113,115` and `ux.spec:119` address `escalate-input` by testid. All three survive because the placeholder, the autofocus and the field names are carried through unchanged.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

Then, because every assertion above is a Playwright one:

```
pnpm --filter web-v2 test:e2e
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/ReasonEditor.tsx apps/web-v2/src/shared/ui/ReasonEditor.stories.tsx apps/web-v2/src/features/review/EscalateEditor.tsx apps/web-v2/src/features/review/ExcludeEditor.tsx apps/web-v2/src/entities/order/PassControl.tsx
git commit -m "$(cat <<'EOF'
Give escalate, exclude and pass one refusal editor

Three copies of the same form had already become three different forms: one
locked its input while the mutation was in flight, one linked its nudge to its
field, and none of them did both. The shared editor keeps every behaviour that
was earned — the submit stays enabled and explains the refusal on click, Enter
commits from inside a field, Escape leaves, and the keys are handled above the
input guard so a bracket in a field is still text.

CorrectEditor and the escalations ResolveCard are not adopted: the first pins a
disabled submit until the value differs from the machine read, which a refusal
that speaks cannot express, and the second needs a native select Playwright can
drive.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `CenteredScreen`

Four verbatim-identical copies of `flex min-h-full items-center justify-center py-20`, each wrapping `w-full max-w-N`. Zero judgement — the only decision is which of Wave 0's `Screen` props each site needs, and all four need the same two.

**Files:**
- Create: `apps/web-v2/src/shared/ui/CenteredScreen.tsx`
- Create: `apps/web-v2/src/shared/ui/CenteredScreen.stories.tsx`
- Modify: `apps/web-v2/src/features/delivered/DeliveredScreen.tsx:70-86`
- Modify: `apps/web-v2/src/features/session/SessionEndedScreen.tsx:28-65`
- Modify: `apps/web-v2/src/features/signin/SigninScreen.tsx:29-50`
- Modify: `apps/web-v2/src/features/surfacefail/SurfaceFailureScreen.tsx:29-45`

**Interfaces:**
- Consumes: `Screen`, `ScreenMeasure` from `apps/web-v2/src/shared/ui/Screen.tsx` (Wave 0):
  ```tsx
  export type ScreenMeasure = "380" | "420" | "440" | "460" | … ;
  export function Screen(props: ScreenProps): ReactElement;  // measure, pad, placement, className
  ```
- Produces:
  ```tsx
  export interface CenteredScreenProps {
    measure: ScreenMeasure;
    children: ReactNode;
  }
  export function CenteredScreen(props: CenteredScreenProps): ReactElement;
  ```

- [ ] **Step 1: Write the failing test**

`apps/web-v2/src/shared/ui/CenteredScreen.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CenteredScreen } from "./CenteredScreen";
import { Card, CardBody } from "./Card";

const meta = {
  title: "Primitives/CenteredScreen",
  component: CenteredScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CenteredScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The four terminal screens — signin, session ended, delivered, surface
 * failure — have nothing to act on and nothing to compare, so they do not
 * offer the scanning posture every working screen does. They read as a
 * document, which is what they are.
 */
export const Terminal: Story = {
  args: { measure: "420", children: null },
  render: () => (
    <div className="h-125">
      <CenteredScreen measure="420">
        <Card data-testid="sheet">
          <CardBody>Your session expired</CardBody>
        </Card>
      </CenteredScreen>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sheet = await canvas.findByTestId("sheet");
    // 420px on the 2px base is max-w-210.
    const column = sheet.parentElement as HTMLElement;
    expect(getComputedStyle(column).maxWidth).toBe("420px");
    // Centred on BOTH axes: the gap above equals the gap below.
    const box = sheet.getBoundingClientRect();
    const frame = canvasElement.firstElementChild as HTMLElement;
    const outer = frame.getBoundingClientRect();
    const above = box.top - outer.top;
    const below = outer.bottom - box.bottom;
    expect(Math.abs(above - below)).toBeLessThan(2);
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/CenteredScreen.stories.tsx
```

Expected failure: `Error: Failed to resolve import "./CenteredScreen" from "src/shared/ui/CenteredScreen.stories.tsx". Does the file exist?`

- [ ] **Step 3: Implement**

`apps/web-v2/src/shared/ui/CenteredScreen.tsx`:

```tsx
import type { ReactNode } from "react";
import { Screen, type ScreenMeasure } from "./Screen";

/**
 * THE FOUR TERMINAL SCREENS — signin, session ended, delivered, surface
 * failure. Each one had a byte-identical copy of the same centring wrapper,
 * and each carried its own prose comment re-deriving the same rule.
 *
 * They are centred and narrow ON PURPOSE. There is nothing to act on and
 * nothing to compare, so the layout should not offer the scanning posture
 * every working screen in this product does. They read as a document, which is
 * what they are.
 *
 * A THIN COMPOSITION OVER `Screen`, DELIBERATELY. The measure, the padding and
 * the scroller all belong to `Screen`; what this adds is that the four screens
 * that need `placement="centre"` with `pad="40"` cannot get one of the two
 * wrong — which is exactly what happened before, when `DeliveredScreen`'s own
 * comment recorded that its `min-h-full` was inert because `main` had no
 * height. The trio is the thing worth naming, not the div.
 */
export interface CenteredScreenProps {
  measure: ScreenMeasure;
  children: ReactNode;
}

export function CenteredScreen({ measure, children }: CenteredScreenProps) {
  return (
    <Screen measure={measure} pad="40" placement="centre">
      {children}
    </Screen>
  );
}
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/CenteredScreen.stories.tsx
```

- [ ] **Step 5: Adopt at all 4 sites**

Each site deletes its outer `<div className="flex min-h-full items-center justify-center py-20">` and moves the measure off its inner `<div className="w-full max-w-N …">` onto `CenteredScreen`. The inner div stays only if it carries something other than `w-full max-w-N` — the alignment classes are per-screen and are not the wrapper's business.

| # | Site | Now | Becomes |
|---|---|---|---|
| 1 | `features/signin/SigninScreen.tsx:30-31` | outer wrapper + `<div className="w-full max-w-190 text-center">` | `<CenteredScreen measure="380"><div className="text-center">` |
| 2 | `features/session/SessionEndedScreen.tsx:29-30` | outer wrapper + `<div className="w-full max-w-210 text-center">` | `<CenteredScreen measure="420"><div className="text-center">` |
| 3 | `features/surfacefail/SurfaceFailureScreen.tsx:30-31` | outer wrapper + `<div data-testid="surface-failure" className="flex w-full max-w-220 flex-col gap-6">` | `<CenteredScreen measure="440"><div data-testid="surface-failure" className="flex flex-col gap-6">` |
| 4 | `features/delivered/DeliveredScreen.tsx:71-72` | outer wrapper + `<div className="w-full max-w-230 text-center">` | `<CenteredScreen measure="460"><div className="text-center">` |

`DeliveredScreen.tsx:29-35` carries a nine-line comment explaining that its `min-h-full` is inert because `main` has no height. Wave 0 gave `main` a height and `Screen` owns the scroller, so the paragraph is now false. Replace those lines with: `The design centres this vertically, and `CenteredScreen` is where that lives — Wave 0's shell gave `main` a height, so the rule finally holds.`

Also delete each screen's now-orphaned centring prose: `SigninScreen` and `SessionEndedScreen` each keep their own WHY blocks, which are about the copy and the stamp and stay true.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/CenteredScreen.tsx apps/web-v2/src/shared/ui/CenteredScreen.stories.tsx apps/web-v2/src/features/signin apps/web-v2/src/features/session apps/web-v2/src/features/surfacefail apps/web-v2/src/features/delivered
git commit -m "$(cat <<'EOF'
Name the terminal screens' centred wrapper instead of copying it four times

Signin, session ended, surface failure and delivered each carried the same
wrapper string and its own paragraph re-deriving the same rule. The measure and
the padding belong to Screen; what CenteredScreen adds is that the four screens
needing centre placement at pad 40 cannot get one of the two wrong.

DeliveredScreen's note that its min-h-full was inert is now false — the shell
gives main a height — and is replaced rather than left to mislead.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `ToggleGroup` — the `segmented` variant

`ToggleGroup` is the one pattern this build reused perfectly: sixteen filter-chip instances, no per-screen forks. It needs one more variant and must not lose the first. The export's segmented track is `display:flex;gap:2px;background:var(--ground);border:1px solid var(--rule);border-radius:7px;padding:3px` with pressed = `background:var(--panel);color:var(--violet)` (export line 204).

Three sites currently fake it with per-item geometry overrides — `rounded-6 px-7 py-4 text-sm` twice and `rounded-5 px-6 py-3 font-mono text-sm` once — which is the fork starting.

**Files:**
- Modify: `apps/web-v2/src/shared/ui/ToggleGroup.tsx`
- Modify: `apps/web-v2/src/shared/ui/ToggleGroup.stories.tsx`
- Modify: `apps/web-v2/src/features/queue/QueueScreen.tsx:58-68`
- Modify: `apps/web-v2/src/features/overview/OverviewHeader.tsx:59-69`
- Modify: `apps/web-v2/src/features/profile/PreferencesCard.tsx:39-53`

**Interfaces:**
- Consumes: `ToggleGroup as BaseToggleGroup`, `Toggle as BaseToggle` from `@base-ui/react`; `cn`.
- Produces:
  ```tsx
  export type ToggleVariant = "pill" | "segmented";

  // added to the existing ToggleGroup props
  variant?: ToggleVariant;   // default "pill"

  // Toggle's props are unchanged; it reads the variant from context.
  ```
  The variant travels by context rather than by a prop on both, because a `segmented` track holding `pill` items is a state the type system should not be able to express.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/shared/ui/ToggleGroup.stories.tsx` (add `import { expect, within } from "storybook/test";` if absent):

```tsx
/**
 * THE SEGMENTED TRACK IS A DIFFERENT CLAIM FROM A FILTER CHIP. A chip row says
 * "narrow this list"; a segmented control says "you are looking at one of
 * these two things". Three screens faked the second with per-item geometry
 * overrides, which is a fork starting.
 */
export const Segmented: Story = {
  args: { children: null },
  render: () => (
    <ToggleGroup variant="segmented" aria-label="Queue view" defaultValue={["reviewer"]}>
      <Toggle value="reviewer">Reviewer</Toggle>
      <Toggle value="senior">Senior · Ops</Toggle>
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pressed = await canvas.findByRole("button", { name: "Reviewer" });
    const resting = await canvas.findByRole("button", { name: "Senior · Ops" });
    const track = pressed.parentElement as HTMLElement;

    // A bordered track with 3px of padding — the item sits INSIDE a frame.
    expect(getComputedStyle(track).borderTopWidth).toBe("1px");
    expect(getComputedStyle(track).paddingTop).toBe("3px");

    // Pressed lifts to the panel with action ink; resting is transparent. The
    // pill's fill-swap would make pressed the ACTION colour, which is wrong
    // here: a segmented control marks a position, not a command.
    expect(getComputedStyle(resting).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(pressed).backgroundColor).not.toBe(
      getComputedStyle(resting).backgroundColor,
    );
    expect(getComputedStyle(pressed).color).not.toBe(
      getComputedStyle(resting).color,
    );
  },
};

/** The sixteen filter chips keep the fill-swap they already have. */
export const PillUnchanged: Story = {
  args: { children: null },
  render: () => (
    <ToggleGroup aria-label="Filter the record" defaultValue={["all"]}>
      <Toggle value="all">All</Toggle>
      <Toggle value="mine">Mine</Toggle>
    </ToggleGroup>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pressed = await canvas.findByRole("button", { name: "All" });
    const track = pressed.parentElement as HTMLElement;
    expect(getComputedStyle(track).borderTopWidth).toBe("0px");
    // rounded-pill is 20px.
    expect(getComputedStyle(pressed).borderTopLeftRadius).toBe("20px");
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ToggleGroup.stories.tsx
```

Expected failure: `AssertionError: expected '0px' to be '1px'` on the track's `borderTopWidth` — `variant` is not a prop, so the group renders the bare `flex flex-wrap gap-3` and every item is still a pill. `pnpm --filter web-v2 typecheck` additionally reports `TS2322: Property 'variant' does not exist`.

- [ ] **Step 3: Implement**

Replace `apps/web-v2/src/shared/ui/ToggleGroup.tsx` in full:

```tsx
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The pill filter — 16 instances. Client chips, product chips, role chips,
 * audit filters, rule-tag filters.
 *
 * These are RADIOS, not buttons. The design renders them as a `<button>` soup,
 * which means a keyboard user tabs through every option one at a time and gets
 * no signal that they form a set. A toggle group gives arrow-key navigation
 * within the group and a single tab stop, which is what a set of mutually
 * exclusive choices should behave like.
 *
 * TWO VARIANTS, TWO CLAIMS. A pill row says "narrow this list": pressed is a
 * fill swap to action, the same selection language tabs, option cards and the
 * page strip use, and a reviewer learns "violet fill means chosen" once. A
 * SEGMENTED track says something else — "you are looking at one of these two
 * things" — so it is drawn as a frame you sit inside, and pressed LIFTS to the
 * panel rather than filling with the action colour. Filling it would make a
 * view switch look like a command.
 *
 * Three screens faked the segmented look with per-item geometry overrides
 * (`rounded-6 px-7 py-4 text-sm`, twice, and a mono variant once). That is a
 * fork starting in the one pattern this build had not forked.
 *
 * THE VARIANT TRAVELS BY CONTEXT, not as a prop on both halves: a segmented
 * track holding pill items is a state that should not be expressible, and two
 * props are two chances to disagree.
 */
export type ToggleVariant = "pill" | "segmented";

const VariantContext = createContext<ToggleVariant>("pill");

const TRACK: Record<ToggleVariant, string> = {
  pill: "flex flex-wrap gap-3",
  segmented: "inline-flex gap-1 rounded-6 border border-line-strong bg-surface-app p-1.5",
};

const ITEM: Record<ToggleVariant, string> = {
  pill: [
    "rounded-pill border px-5 py-3 text-xs font-semibold whitespace-nowrap",
    "border-line-strong bg-surface-panel text-ink-secondary",
    "data-pressed:border-action data-pressed:bg-action data-pressed:text-ink-on-action",
  ].join(" "),
  segmented: [
    "rounded-4 border border-transparent px-7 py-4 text-sm font-semibold whitespace-nowrap",
    "bg-transparent text-ink-secondary",
    "data-pressed:bg-surface-panel data-pressed:text-action-ink",
  ].join(" "),
};

export function ToggleGroup({
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  variant = "pill",
  className,
  children,
  ...rest
}: {
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: readonly string[]) => void;
  /** false = radio semantics (pick one), true = checkbox semantics. */
  multiple?: boolean;
  variant?: ToggleVariant;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <VariantContext value={variant}>
      <BaseToggleGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        multiple={multiple}
        className={cn(TRACK[variant], className)}
        {...rest}
      >
        {children}
      </BaseToggleGroup>
    </VariantContext>
  );
}

export function Toggle({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const variant = useContext(VariantContext);
  return (
    <BaseToggle
      value={value}
      disabled={disabled}
      className={cn(
        ITEM[variant],
        "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-muted",
        className,
      )}
    >
      {children}
    </BaseToggle>
  );
}
```

`<VariantContext value={variant}>` is React 19's context-as-provider form; no `.Provider` wrapper is needed.

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/ToggleGroup.stories.tsx
```

- [ ] **Step 5: Adopt at the three segmented sites**

| # | Site | Change |
|---|---|---|
| 1 | `features/queue/QueueScreen.tsx:58-68` | add `variant="segmented"` to the `ToggleGroup`; delete `className="rounded-6 px-7 py-4 text-sm"` from both `Toggle`s |
| 2 | `features/overview/OverviewHeader.tsx:59-69` | add `variant="segmented"`; delete the identical `className` from both `Toggle`s |
| 3 | `features/profile/PreferencesCard.tsx:39-53` | add `variant="segmented"`; reduce the item `className` from `"rounded-5 px-6 py-3 font-mono text-sm"` to `"font-mono"` — the mono face is the theme names' own, the geometry is the track's |

The other thirteen `ToggleGroup` call sites are untouched and stay pills.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add apps/web-v2/src/shared/ui/ToggleGroup.tsx apps/web-v2/src/shared/ui/ToggleGroup.stories.tsx apps/web-v2/src/features/queue/QueueScreen.tsx apps/web-v2/src/features/overview/OverviewHeader.tsx apps/web-v2/src/features/profile/PreferencesCard.tsx
git commit -m "$(cat <<'EOF'
Add the segmented track to ToggleGroup, keeping the filter chips as they are

Three screens faked a segmented control with per-item geometry overrides — a
fork starting in the one pattern this build had not forked. A pill row says
"narrow this list" and fills with the action colour; a segmented track says
"you are looking at one of these two things" and lifts the pressed item to the
panel instead, because filling it would make a view switch read as a command.

The variant travels by context so a segmented track holding pill items is not
expressible.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: `Eyebrow`'s two tiers, and what `Button` does not get

The audit asked for three things here. Two are real and land; the third is refused, and the refusal is the point of the task.

- **`Eyebrow` gains the 10px/.08em in-card heading tier.** The export draws it three times (lines 572, 648, 1574): `font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:700`, coloured per context.
- **`Eyebrow.group` drops from 11px/ink-primary to 8.5px/ink3.** The export's sidebar group label (line 71) is `font-size:8.5px; letter-spacing:.13em; color:var(--ink3); font-weight:700`.
- **`Button` does not get a `recessed` fill in this wave.** A grep across `src/` returns no hand-rolled recessed button — the five `bg-surface-sunken` hits are a rail badge, a table band, two selected-row grounds and a facsimile placeholder, none of them a control. Building it now would add a fifteenth built-and-bypassed component, which is the failure this wave exists to end; after Wave 0's `knip` change it would also fail CI. It is recorded for Wave 4, which rebuilds Review's page navigation. **`Button`'s muted-disabled fill is already correct** — `disabled:bg-surface-app disabled:text-ink-muted disabled:border-line-strong` matches the export's `background:var(--ground);color:var(--ink3);border:1px solid var(--rule)` (line 540) exactly — so what it gains here is a test where there was only a comment.

**Files:**
- Modify: `packages/ui-tokens/src/tokens.css` (add `--text-nano`, `--tracking-heading`)
- Modify: `apps/web-v2/src/shared/ui/classNames.ts:35-43`
- Modify: `apps/web-v2/src/shared/ui/Eyebrow.tsx:27-42`
- Modify: `apps/web-v2/src/shared/ui/Eyebrow.stories.tsx`
- Modify: `apps/web-v2/src/shared/ui/Button.stories.tsx`
- Modify (adoption): `apps/web-v2/src/shared/ui/PanelCard.tsx` (the bare-caption tier), `apps/web-v2/src/entities/nav/Sidebar.tsx:98`, `apps/web-v2/src/features/queue/QueueBand.tsx:31`

**Interfaces:**
- Consumes: `cva`, `VariantProps`, `cn`.
- Produces: `Eyebrow`'s `variant` union gains `"heading"`; the existing six keep their names and their meanings. `PanelCard`'s bare caption switches from `variant="caption"` to `variant="heading"`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web-v2/src/shared/ui/Eyebrow.stories.tsx` (add `import { expect, within } from "storybook/test";` if absent):

```tsx
/**
 * TWO TIERS THE EXPORT DRAWS AND THIS KIT DID NOT.
 *
 * `heading` is the in-card heading — 10px, .08em, bold, coloured by context
 * (export lines 572, 648, 1574). It sits between `section` (a card-header
 * band) and `caption` (a label beside a value), and without it every in-card
 * heading was drawn one tier too loud.
 *
 * `group` was 11px in ink-primary and the export sets it at 8.5px in ink3: a
 * group label organises a list, it does not compete with the rows in it.
 */
export const Tiers: Story = {
  args: { children: "Sign-off" },
  render: () => (
    <div className="flex flex-col gap-5">
      <Eyebrow data-testid="tier-heading" variant="heading">Coverage</Eyebrow>
      <Eyebrow data-testid="tier-group" variant="group">Work</Eyebrow>
      <Eyebrow data-testid="tier-section">Sign-off lines</Eyebrow>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const heading = getComputedStyle(await canvas.findByTestId("tier-heading"));
    expect(heading.fontSize).toBe("10px");
    expect(heading.letterSpacing).toBe("0.8px");
    expect(heading.fontWeight).toBe("700");
    expect(heading.textTransform).toBe("uppercase");

    const group = getComputedStyle(await canvas.findByTestId("tier-group"));
    expect(group.fontSize).toBe("8.5px");
    // ink3, not ink-primary: a group label organises, it does not compete.
    const section = getComputedStyle(await canvas.findByTestId("tier-section"));
    expect(group.color).not.toBe(section.color);
  },
};
```

And append to `apps/web-v2/src/shared/ui/Button.stories.tsx`:

```tsx
/**
 * DISABLED IS A SURFACE SWAP, NEVER OPACITY — the export's own
 * `background:var(--ground); color:var(--ink3); border:1px solid var(--rule)`.
 * Opacity is reserved for permission-denied and retired, so using it here
 * would collide with a different meaning. This was documented in the component
 * and asserted nowhere.
 */
export const DisabledIsMuted: Story = {
  args: { children: "Publish" },
  render: () => (
    <div className="flex gap-4">
      <Card data-testid="ground"><CardBody>ground</CardBody></Card>
      <Button data-testid="d-solid" disabled>Publish</Button>
      <Button data-testid="d-tinted" fill="tinted" tone="halt" disabled>Retire</Button>
      <Button data-testid="d-ghost" fill="ghost" tone="neutral" disabled>Cancel</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const solid = getComputedStyle(await canvas.findByTestId("d-solid"));
    for (const id of ["d-solid", "d-tinted", "d-ghost"]) {
      const style = getComputedStyle(await canvas.findByTestId(id));
      // One disabled appearance, whatever the fill said a moment ago…
      expect(style.backgroundColor).toBe(solid.backgroundColor);
      expect(style.color).toBe(solid.color);
      expect(style.borderTopColor).toBe(solid.borderTopColor);
      // …and it is a surface swap, not a fade.
      expect(style.opacity).toBe("1");
      expect(style.cursor).toBe("not-allowed");
    }
  },
};
```

- [ ] **Step 2: Run it — Expected: FAIL**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Eyebrow.stories.tsx src/shared/ui/Button.stories.tsx
```

Expected failures: `AssertionError: expected '9px' to be '10px'` on the heading tier's `fontSize` — `variant="heading"` does not exist, so cva falls back to the `field` default at 9px; and `AssertionError: expected '11px' to be '8.5px'` on the group tier. The `Button` story is expected to **pass on the first run** — it pins behaviour that is already correct, and it is written here so that a later change to the disabled treatment cannot happen silently.

- [ ] **Step 3: Implement**

**3a.** `packages/ui-tokens/src/tokens.css` — one new size beside `--text-micro` (line 303) and one new tracking beside `--tracking-badge` (line 318):

```css
  --text-nano: 0.53125rem; /* 8.5px — sidebar group label, smallest tier drawn */
```
```css
  --tracking-heading: 0.08em; /* in-card heading — tighter than a field label */
```

**3b.** `apps/web-v2/src/shared/ui/classNames.ts` — register both, or tailwind-merge classifies them as colours and drops the size (`text`) or emits two trackings (`tracking`):

```ts
      text: [
        "nano", "micro", "tiny", "xs", "sm", "base", "md",
        "lg", "census", "xl", "2xl", "3xl", "4xl", "5xl",
      ],
```
```ts
      tracking: ["eyebrow", "badge", "stamp", "label", "heading"],
```

**3c.** `apps/web-v2/src/shared/ui/Eyebrow.tsx` — in the `variant` block, add the new tier and correct `group`:

```tsx
      /**
       * The in-card heading (export lines 572, 648, 1574) — 10px, .08em, bold,
       * coloured by context via `tone`. It sits between `section`, which is a
       * card-header BAND, and `caption`, which labels a value. Without it every
       * in-card heading was drawn one tier too loud, so a panel's own name
       * competed with the panel's content.
       */
      heading: "text-tiny tracking-heading font-bold text-ink-muted",
      /**
       * Group heading over a list (7 uses). The export sets this at 8.5px in
       * ink3, not 11px in ink-primary: a group label ORGANISES the rows under
       * it and must not compete with them. Tracking stays `eyebrow` (.14em)
       * against the export's .13em — 0.085px per character at this size, and
       * not worth a token of its own.
       */
      group: "text-nano tracking-eyebrow font-bold text-ink-muted",
```

- [ ] **Step 4: Run — Expected: PASS**

```
pnpm --filter web-v2 exec vitest run --project=storybook src/shared/ui/Eyebrow.stories.tsx src/shared/ui/Button.stories.tsx
```

- [ ] **Step 5: Adopt**

1. `apps/web-v2/src/shared/ui/PanelCard.tsx` — the bare caption becomes the new tier, which lands the correction on all eight panels Task 6 adopted in one edit:
   ```tsx
        {band ? null : <Eyebrow variant="heading">{caption}</Eyebrow>}
   ```
2. `apps/web-v2/src/entities/nav/Sidebar.tsx:98` — no source change; the `variant="group"` call now renders at 8.5px/ink3. Re-read the sidebar's group headers in the browser and confirm `Sidebar.stories.tsx:68`'s `expect(headers).toEqual(["WORK", "THIS ORDER", "ADMIN", "REFERENCE"])` still passes — the literal capitals are in the markup, so a size change cannot touch it.
3. `apps/web-v2/src/features/queue/QueueBand.tsx:31` — no source change; same tier correction.

Then run the contrast gate specifically, because `group` moved to a lighter ink at a smaller size:

```
pnpm --filter web-v2 exec vitest run --project=gates src/shared/contrast.test.ts
```

`ink-muted` is already AA on every surface in both themes (that file's own reason for existing), so this is a confirmation rather than a change — but a 8.5px label is the worst case in the app and the run is the evidence.

- [ ] **Step 6: Full gate**

```
pnpm --filter web-v2 typecheck && pnpm --filter web-v2 check:rules && pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 knip
```

- [ ] **Step 7: Commit**

```
git add packages/ui-tokens/src/tokens.css apps/web-v2/src/shared/ui/classNames.ts apps/web-v2/src/shared/ui/Eyebrow.tsx apps/web-v2/src/shared/ui/Eyebrow.stories.tsx apps/web-v2/src/shared/ui/Button.stories.tsx apps/web-v2/src/shared/ui/PanelCard.tsx
git commit -m "$(cat <<'EOF'
Add the export's in-card heading tier and quieten the group label

The export draws an in-card heading at 10px/.08em three times and this kit had
no tier for it, so every panel's own name was set one step too loud and
competed with its content. The group label moves from 11px ink-primary to the
8.5px ink3 the sidebar is actually drawn at — a group heading organises the
rows under it rather than competing with them.

Button gets no recessed fill: a grep returns no hand-rolled recessed control to
adopt it at, and shipping one would add another built-and-bypassed component.
Its muted-disabled treatment already matches the export and now has a test
rather than only a comment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Wave exit

Run once, after Task 12, before handing to Wave 3:

```
pnpm --filter web-v2 typecheck
pnpm --filter web-v2 check:rules
pnpm --filter web-v2 lint
pnpm --filter web-v2 test
pnpm --filter web-v2 test:e2e
pnpm --filter web-v2 knip
pnpm typecheck
```

Baseline on 2026-07-30 is all green — 297 tests, `check:rules` clean over 283 files, zero skips — so any red is this wave's.

Then look at the screens, because a green suite is not evidence the UI is right (HANDOFF-UI §10). With Wave 0's corrected `compare.mjs`:

```
node apps/web-v2/compare.mjs Rulebook /rulebook ../../shots
node apps/web-v2/compare.mjs Overview /overview ../../shots
node apps/web-v2/compare.mjs Queue /queue ../../shots
```

Rulebook holds eight of the twenty-seven tone adoptions and three census tiles; Overview holds the tally strip, the two empty notes and a segmented track; Queue holds a segmented track and the pass editor. If the tint, the census tier or the segmented track is wrong, it is wrong in those three.

**Handover to Wave 3:** every primitive is exported from `apps/web-v2/src/shared/ui/` except `ScreenHeading`/`ScreenEyebrow`, which are in `apps/web-v2/src/app/` because `check:rules` refuses a router import under `shared/` or `entities/`. `RailRow` (Wave 3) should consume `ListRow` only if the rail's separator really is `line-subtle` — it is not obviously so, and a rail row is a navigation target rather than a list row, so check the export before reaching for it.

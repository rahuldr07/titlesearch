import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SegmentedControl, Segment } from "./segmented-control";
import { onPanel } from "./kitGround";

/**
 * The filter tabs. Selection is weight and elevation, never the accent — a
 * filter is not the screen's decision.
 */
const meta = {
  title: "ui/SegmentedControl",
  decorators: [onPanel],
  component: SegmentedControl,
  args: { label: "Filter orders", children: null },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

const cells = (
  <>
    <Segment id="all">All</Segment>
    <Segment id="mine">Mine</Segment>
    <Segment id="escalated">Escalated</Segment>
    <Segment id="released">Released</Segment>
  </>
);

/** The first cell selected — the resting state of the queue screen. */
export const Default: Story = {
  args: { defaultSelectedKeys: ["all"] },
  render: (args) => <SegmentedControl {...args}>{cells}</SegmentedControl>,
};

/** A middle cell selected. */
export const MiddleSelected: Story = {
  args: { defaultSelectedKeys: ["escalated"] },
  render: (args) => <SegmentedControl {...args}>{cells}</SegmentedControl>,
};

/** The last cell selected. */
export const LastSelected: Story = {
  args: { defaultSelectedKeys: ["released"] },
  render: (args) => <SegmentedControl {...args}>{cells}</SegmentedControl>,
};

/** Two cells — the minimum a segmented control is worth using for. */
export const TwoCells: Story = {
  args: { defaultSelectedKeys: ["mine"] },
  render: (args) => (
    <SegmentedControl {...args}>
      <Segment id="all">All</Segment>
      <Segment id="mine">Mine</Segment>
    </SegmentedControl>
  ),
};

/**
 * One cell blocked, with its rule: rendered disabled, not hidden — the count
 * is the assertion. A group item carries `data-disabled-reason` only (see
 * Segment's comment), so that attribute is asserted verbatim.
 */
export const OneSegmentBlocked: Story = {
  args: { defaultSelectedKeys: ["all"] },
  render: (args) => (
    <SegmentedControl {...args}>
      <Segment id="all">All</Segment>
      <Segment id="mine">Mine</Segment>
      <Segment
        id="escalated"
        disabledBecause="Blocked: your role cannot view escalations."
      >
        Escalated
      </Segment>
    </SegmentedControl>
  ),
  play: ({ canvasElement }) => {
    // All three cells exist — the blocked one is barred, never dropped.
    expect(canvasElement.querySelectorAll('[data-slot="segment"]')).toHaveLength(3);
    const blocked = canvasElement.querySelector(
      '[data-slot="segment"][data-disabled-reason]',
    );
    expect(blocked).not.toBeNull();
    expect(blocked?.getAttribute("data-disabled-reason")).toBe(
      "Blocked: your role cannot view escalations.",
    );
    expect(blocked?.textContent).toContain("Escalated");
  },
};

/** The whole control blocked — the table beneath it is not filterable at all. */
export const WholeControlBlocked: Story = {
  args: {
    defaultSelectedKeys: ["all"],
    disabledBecause: "Blocked: the queue is still loading.",
  },
  render: (args) => <SegmentedControl {...args}>{cells}</SegmentedControl>,
};

/**
 * The radius arithmetic, visible and asserted: a 14px track holding 10px
 * cells with 4px of padding between. 10 = 14 − 4, one number and a
 * subtraction — written as rounded-lg / p-2 / rounded-md so a redesign of
 * any one of the three cannot silently break the relationship.
 *
 * The track moved md → lg when the strip was restyled onto `surface-panel`.
 * The cell moved with it, to lg, which made inner = outer and flattened the
 * arithmetic to nothing — this assertion is what caught that. The gap is
 * `--space-2`, the same 4px the token scale subtracts; see
 * apps/web/tokens.contrast.test.ts for the token-level half of the rule.
 */
export const TheRadiusArithmetic: Story = {
  args: { defaultSelectedKeys: ["all"] },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <SegmentedControl {...args}>{cells}</SegmentedControl>
      <p className="font-mono text-label leading-flat text-ink-muted">
        track 14px · padding 4px · cell 10px
      </p>
    </div>
  ),
  play: ({ canvasElement }) => {
    const track = canvasElement.querySelector("[data-slot='segmented-control']");
    const cell = canvasElement.querySelector("[data-slot='segment']");
    expect(track?.getAttribute("class")).toContain("rounded-lg");
    expect(track?.getAttribute("class")).toContain("p-2");
    expect(cell?.getAttribute("class")).toContain("rounded-md");
  },
};

/**
 * The chord mark is `widget`: a group has roving arrow-key focus, which
 * makes the arrows and Home/End its own; but it is mounted at all times, so
 * `own` would kill every chord in the app for the life of the screen.
 */
export const OwnsKeysOnlyWhileFocused: Story = {
  args: { defaultSelectedKeys: ["all"] },
  render: (args) => <SegmentedControl {...args}>{cells}</SegmentedControl>,
  play: ({ canvasElement }) => {
    expect(canvasElement.querySelector("[data-chord-scope='widget']")).not.toBe(null);
    expect(canvasElement.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

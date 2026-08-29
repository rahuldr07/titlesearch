import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SegmentedControl, Segment } from "./segmented-control";
import { onPanel } from "./kitGround";

/**
 * The All Orders filter tabs. Selection is weight and elevation, never accent
 * (rule 1) — a filter is not the screen's decision, and the stories are how you
 * see that a selected cell reads as chosen without spending the violet.
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
 * ONE cell blocked, with its rule. Rule 12: rendered disabled, not hidden —
 * the COUNT is the assertion, as in `combobox.blocked.stories.tsx`.
 *
 * No `[title]` assertion any more: the item-level `BlockedHint` wrapper is
 * deleted (see `Segment`'s comment — a group item carries
 * `data-disabled-reason` only, per `tabs.tsx`), so the reason's carrier on a
 * single blocked cell is the data attribute, asserted verbatim below.
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
 * The radius arithmetic, visible: a 10px track holding 6px cells with 4px of
 * padding between. 6 = 10 − 4, which is rule 5 rather than three numbers.
 */
export const TheRadiusArithmetic: Story = {
  args: { defaultSelectedKeys: ["all"] },
  render: (args) => (
    <div className="flex flex-col gap-6">
      <SegmentedControl {...args}>{cells}</SegmentedControl>
      <p className="font-mono text-label leading-flat text-ink-muted">
        track 10px · padding 4px · cell 6px
      </p>
    </div>
  ),
};

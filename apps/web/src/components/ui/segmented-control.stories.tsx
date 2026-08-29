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

/** ONE cell blocked, with its rule. Rule 12: rendered disabled, not hidden. */
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
    expect(
      canvasElement.querySelector('[data-slot="segment"][data-disabled-reason]'),
    ).not.toBeNull();
    expect(canvasElement.querySelector("[title]")?.getAttribute("title")).toContain("role");
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

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SegmentedControl, Segment } from "./SegmentedControl";

/**
 * A filter, not navigation — these cells own no panels. Selection is a raised
 * white cell on a sunken track: weight and elevation, no accent.
 */
const meta = {
  title: "ui/SegmentedControl",
  component: SegmentedControl,
  args: { label: "Filter orders" },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultSelectedKeys: ["all"],
    children: (
      <>
        <Segment id="all">All</Segment>
        <Segment id="mine">Mine</Segment>
        <Segment id="due">Due today</Segment>
        <Segment id="blocked">Blocked</Segment>
      </>
    ),
  },
};

export const TwoUp: Story = {
  args: {
    defaultSelectedKeys: ["following"],
    children: (
      <>
        <Segment id="following">Following</Segment>
        <Segment id="free">Free</Segment>
      </>
    ),
  },
};

export const SegmentBlockedWithReason: Story = {
  args: {
    defaultSelectedKeys: ["all"],
    children: (
      <>
        <Segment id="all">All</Segment>
        <Segment id="mine" disabledBecause="Blocked: nothing is assigned to you.">
          Mine
        </Segment>
      </>
    ),
  },
};

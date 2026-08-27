import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, InnerPanel } from "./Surface";

const meta = {
  title: "ui/Surface",
  component: Card,
  args: { children: "Abstract specifications" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};

export const Sunken: Story = { args: { tone: "sunken" } };

/** Rule 8: evidence and deliverables render AS PAPER — never a grey placeholder. */
export const Paper: Story = {
  args: { tone: "paper", children: "Know all men by these presents…" },
};

export const Raised: Story = { args: { edge: "raised" } };

export const Tight: Story = { args: { padding: "tight" } };

/** Rule 5's arithmetic: 6px inside 10px inside 14px, inner = outer − gap. */
export const Nested: Story = {
  render: () => (
    <Card>
      <InnerPanel tone="sunken">A 10px panel inside a 14px card.</InnerPanel>
    </Card>
  ),
};

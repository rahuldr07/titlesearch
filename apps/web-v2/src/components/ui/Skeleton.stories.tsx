import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton";

/**
 * Rule 8 forbids this on evidence and deliverables: "never grey placeholder
 * bars". A scan loads as paper. This is for the UI chrome around it.
 */
const meta = { title: "ui/Skeleton", component: Skeleton } satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Body: Story = {};
export const Half: Story = { args: { width: "half" } };
export const Quarter: Story = { args: { width: "quarter" } };
export const Label: Story = { args: { height: "label", width: "quarter" } };
export const Subject: Story = { args: { height: "subject", width: "half" } };

export const Stack: Story = {
  render: () => (
    <div className="flex w-160 flex-col gap-4">
      <Skeleton height="subject" width="half" />
      <Skeleton />
      <Skeleton width="half" />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderStatusChip } from "./OrderStatusChip";

const meta = {
  title: "Order/OrderStatusChip",
  component: OrderStatusChip,
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderStatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Both the label and the tone are SERVER-SUPPLIED — the component cannot derive
 * either. Constraint 9 forbids a client-side state machine, and conflict C2
 * records the export computing its status stamp from a five-branch `if/else` in
 * the browser. `OrderStatus` is deliberately an open string in the contract, so
 * inventing a closed enum here would be inventing the state machine one level
 * down.
 */
export const ServerSupplied: Story = {
  args: { label: "Decisions open", tone: "action" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <OrderStatusChip label="Sign-off open" tone="action" />
      <OrderStatusChip label="Package incomplete" tone="halt" />
      <OrderStatusChip label="Decisions open" tone="action" />
      <OrderStatusChip label="Ready" tone="settled" />
      <OrderStatusChip label="Delivered · 2 versions" tone="settled" />
      <OrderStatusChip label="Failed in transit" tone="attend" />
      <OrderStatusChip label="Unassigned" tone="neutral" />
    </div>
  ),
};

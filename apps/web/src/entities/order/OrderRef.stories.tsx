import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { OrderRef } from "./OrderRef";

/** An order ref is data — mono, drawn in one place. */
const meta = {
  title: "entities/OrderRef",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: OrderRef,
  args: { orderRef: "TP-2026-04412" },
} satisfies Meta<typeof OrderRef>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A table row. 11px, grey, and the datum still reads as a datum. */
export const Row: Story = { args: { emphasis: "row" } };

export const Subject: Story = { args: { emphasis: "subject" } };

/** The overview spotlight — 28px accent. At most once per screen. */
export const Spotlight: Story = { args: { emphasis: "spotlight" } };

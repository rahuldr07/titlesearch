import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { OrderContextRow } from "./OrderContextRow";

const meta = {
  title: "Order/OrderContextRow",
  component: OrderContextRow,
  parameters: { layout: "padded" },
} satisfies Meta<typeof OrderContextRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The whole row: what was ordered, over what period, against which config. */
export const Frozen: Story = {
  args: {
    productName: "40-Year Search",
    periodLabel: "40-year period · 07/18/1986 – 07/18/2026",
    configVersion: "config v4",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Literal capitals in the markup, never a CSS transform.
    await expect(canvas.getByText("ORDERED")).toBeInTheDocument();
    await expect(canvas.getByText("40-Year Search")).toBeInTheDocument();
    await expect(
      canvas.getByText("40-year period · 07/18/1986 – 07/18/2026"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("config v4 · frozen")).toBeInTheDocument();
  },
};

/** No config version on the wire: the badge is absent, never a guess. */
export const NoConfigVersion: Story = {
  args: {
    productName: "40-Year Search",
    periodLabel: "40-year period · 07/18/1986 – 07/18/2026",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText(/frozen/)).not.toBeInTheDocument();
  },
};

/**
 * `period_label` is nullable on the wire. The chip goes rather than rendering
 * an empty badge — the row states what it was told and nothing else.
 */
export const NoPeriodOnTheWire: Story = {
  args: { productName: "Two Owner Search", periodLabel: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Two Owner Search")).toBeInTheDocument();
    await expect(canvas.queryByText(/period/)).not.toBeInTheDocument();
  },
};

/** The trailing slot is the screen's, and it does not disturb the row. */
export const WithTrailingControl: Story = {
  args: {
    productName: "40-Year Search",
    periodLabel: "40-year period · 07/18/1986 – 07/18/2026",
    trailing: <span>Gate verdict</span>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Gate verdict")).toBeInTheDocument();
  },
};

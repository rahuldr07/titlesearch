import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./Input";

/**
 * `label` is required, so there is no "unlabelled" story to write — the field
 * that fails WCAG 3.3.2 cannot be constructed. The stories below are therefore
 * the states that CAN vary.
 */
const meta = {
  title: "ui/Input",
  component: Input,
  args: { label: "Client reference" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = { args: { placeholder: "e.g. Acme Title Co." } };

export const WithDescription: Story = {
  args: { description: "Read from the clerk stamp; not editable after signing." },
};

/** Rule 3: mono for DATA. Opted into, never inferred. */
export const DataValue: Story = {
  args: { label: "Order ref", data: true, defaultValue: "4176055-3" },
};

/** The server's sentence, rendered verbatim. The client authors no refusal text. */
export const Invalid: Story = {
  args: { errorMessage: "Order ref must match the clerk stamp on page 1." },
};

/** Rule 9: the reason renders inline as well as on `title` — a tooltip alone fails on touch. */
export const BlockedWithReason: Story = {
  args: {
    label: "Jurisdiction",
    defaultValue: "Shelby County, TN",
    disabledBecause: "Read from the clerk stamp. Not editable.",
  },
};

/** The one legitimate hidden label: surrounding chrome already states the purpose. */
export const HiddenLabel: Story = {
  args: { label: "Search orders", labelHidden: true, placeholder: "Search orders" },
};

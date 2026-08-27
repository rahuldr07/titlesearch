import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";
import { Option } from "./Option";

/**
 * The story worth having here is not visual. Open the listbox and confirm the
 * popover carries `data-chord-scope="own"` — that attribute is what stands the
 * global single-key vocabulary down, and `shared/chords.ts` records the bug it
 * prevents (`q` escalating a field AND jumping a menu to "Quarantine").
 */
const meta = {
  title: "ui/Select",
  component: Select,
  args: {
    label: "Product",
    children: (
      <>
        <Option id="full">Full search</Option>
        <Option id="current">Current owner</Option>
        <Option id="two">Two owner</Option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { defaultSelectedKey: "full" } };

export const WithDescription: Story = {
  args: { description: "Determines which rulebook layers apply." },
};

export const Invalid: Story = {
  args: { errorMessage: "Select a product before signing intake." },
};

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Locked after intake is signed." },
};

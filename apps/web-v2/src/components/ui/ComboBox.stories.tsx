import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComboBox } from "./ComboBox";
import { Option } from "./Option";

/**
 * A ComboBox is the worst case for the chord bug: focus sits on an INPUT, which
 * the prototype's tagName guard catches, while the listbox below it is a
 * `<div role="listbox">`, which it does not. Both halves are covered here
 * because the popover marks its own subtree.
 */
const meta = {
  title: "ui/ComboBox",
  component: ComboBox,
  args: {
    label: "Assigned examiner",
    children: (
      <>
        <Option id="menon">R. Menon</Option>
        <Option id="okafor">A. Okafor</Option>
        <Option id="salas">D. Salas</Option>
      </>
    ),
  },
} satisfies Meta<typeof ComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPlaceholder: Story = { args: { placeholder: "Type a name" } };

export const Selected: Story = { args: { defaultSelectedKey: "menon" } };

export const Invalid: Story = {
  args: { errorMessage: "This order has no assignee." },
};

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Reassignment belongs to QC — with R. Menon." },
};

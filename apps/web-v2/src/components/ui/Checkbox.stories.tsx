import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox, CheckboxGroup } from "./Checkbox";

/** The mark is rule 7's glyph vocabulary: ✓ for all, ◆ for some. Never an icon. */
const meta = {
  title: "ui/Checkbox",
  component: Checkbox,
  args: { children: "Include the tax certificate" },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { defaultSelected: true } };

/** ◆ — "some, not all" is its own statement, not a half-tick. */
export const Indeterminate: Story = { args: { isIndeterminate: true } };

export const BlockedWithReason: Story = {
  args: { disabledBecause: "Blocked: no tax certificate in this package." },
};

export const Group: Story = {
  render: () => (
    <CheckboxGroup label="Manifest blocks">
      <Checkbox value="vesting">Vesting</Checkbox>
      <Checkbox value="liens">Liens and judgments</Checkbox>
      <Checkbox value="taxes">Taxes</Checkbox>
    </CheckboxGroup>
  ),
};

export const GroupBlockedWithReason: Story = {
  render: () => (
    <CheckboxGroup
      label="Manifest blocks"
      disabledBecause="Blocked: v1 is released and immutable."
    >
      <Checkbox value="vesting">Vesting</Checkbox>
      <Checkbox value="liens">Liens and judgments</Checkbox>
    </CheckboxGroup>
  ),
};

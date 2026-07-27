import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToggleGroup, Toggle } from "./ToggleGroup";

const meta = {
  title: "Primitives/ToggleGroup",
  component: ToggleGroup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The design renders these as a `<button>` soup, so a keyboard user tabs
 * through every option and gets no signal they form a set. As a toggle group
 * they are one tab stop with arrow-key navigation — which is what a set of
 * mutually exclusive choices should behave like.
 */
export const SingleChoice: Story = {
  args: { children: null },
  render: () => (
    <ToggleGroup defaultValue={["full"]} aria-label="Product">
      <Toggle value="full">Full search</Toggle>
      <Toggle value="update">Update</Toggle>
      <Toggle value="two-owner">Two-owner</Toggle>
      <Toggle value="lien">Lien report</Toggle>
    </ToggleGroup>
  ),
};

export const MultipleChoice: Story = {
  args: { children: null },
  render: () => (
    <ToggleGroup multiple defaultValue={["ruled", "open"]} aria-label="Rule tags">
      <Toggle value="ruled">Ruled · 24</Toggle>
      <Toggle value="derived">Derived · 8</Toggle>
      <Toggle value="open">Open · 3</Toggle>
      <Toggle value="conflict">Conflict · 1</Toggle>
    </ToggleGroup>
  ),
};

export const Disabled: Story = {
  args: { children: null },
  render: () => (
    <ToggleGroup defaultValue={["a"]} aria-label="Disabled example">
      <Toggle value="a">Available</Toggle>
      <Toggle value="b" disabled>Blocked on a ruling</Toggle>
    </ToggleGroup>
  ),
};

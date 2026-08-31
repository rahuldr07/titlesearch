import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CheckboxGroup } from "./checkbox-group";
import { Checkbox } from "./checkbox";
import { FieldSet, FieldLegend } from "./field-set";
import { onPanel } from "./kitGround";

/**
 * The group exists so several boxes are one answer with one accessible name.
 * The blocked stories prove the two independent levels of blocking.
 */
const meta = {
  title: "ui/CheckboxGroup",
  decorators: [onPanel],
  component: CheckboxGroup,
  args: { "aria-label": "Layers" },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = (
  <>
    <Checkbox value="quarantine">Quarantine passed</Checkbox>
    <Checkbox value="optical">Optical profile read</Checkbox>
    <Checkbox value="chain">Chain assembled</Checkbox>
  </>
);

/** Nothing chosen. */
export const Empty: Story = {
  render: (args) => <CheckboxGroup {...args}>{options}</CheckboxGroup>,
};

/** Two of three. */
export const PartlySelected: Story = {
  args: { defaultValue: ["quarantine", "chain"] },
  render: (args) => <CheckboxGroup {...args}>{options}</CheckboxGroup>,
};

/** The group under a legend, which is how a form spells it. */
export const InAFieldSet: Story = {
  render: (args) => (
    <FieldSet>
      <FieldLegend variant="label">Layers</FieldLegend>
      <CheckboxGroup {...args}>{options}</CheckboxGroup>
    </FieldSet>
  ),
  play: ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="checkbox-group"]')).not.toBeNull();
  },
};

/** The whole group frozen, with the server's sentence on it. */
export const GroupBlocked: Story = {
  args: {
    defaultValue: ["quarantine"],
    disabledBecause: "Blocked: the order is released and its layers are fixed.",
  },
  render: (args) => <CheckboxGroup {...args}>{options}</CheckboxGroup>,
  play: ({ canvasElement }) => {
    expect(
      canvasElement.querySelector('[data-slot="checkbox-group"][data-disabled-reason]'),
    ).not.toBeNull();
    expect(canvasElement.querySelector("[title]")?.getAttribute("title")).toContain("released");
  },
};

/** One box barred, for its own reason. Rendered rather than hidden. */
export const OneOptionBlocked: Story = {
  render: (args) => (
    <CheckboxGroup {...args}>
      <Checkbox value="quarantine">Quarantine passed</Checkbox>
      <Checkbox value="optical" disabledBecause="Blocked: no optical profile on this package.">
        Optical profile read
      </Checkbox>
    </CheckboxGroup>
  ),
};

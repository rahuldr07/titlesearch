import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, Radio } from "./RadioGroup";

const meta = {
  title: "Primitives/RadioGroup",
  component: RadioGroup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The cite-vs-draft choice on escalation resolution. A radio, not checkboxes:
 * picking both is meaningless, and picking neither is a refusal the SERVER
 * enforces — escalation resolution is refused without a rule (`escalations.spec`
 * #1, INVARIANT). The control does not enforce that; it only stops the user
 * expressing something incoherent.
 */
export const RuleSource: Story = {
  args: { children: null },
  render: () => (
    <RadioGroup defaultValue="cite" aria-label="How this ruling becomes a rule">
      <Radio value="cite">Cite an existing rule</Radio>
      <Radio value="draft">Draft a new rule — lands PENDING</Radio>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  args: { children: null },
  render: () => (
    <RadioGroup defaultValue="a" aria-label="Disabled example">
      <Radio value="a">Available</Radio>
      <Radio value="b" disabled>Requires the engineer gate</Radio>
    </RadioGroup>
  ),
};

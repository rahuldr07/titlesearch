import type { Meta, StoryObj } from "@storybook/react-vite";
import { DecisionBar } from "./DecisionBar";

const meta = {
  title: "Field/DecisionBar",
  component: DecisionBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

/**
 * THERE IS NO BULK ACTION HERE AND THERE NEVER WILL BE. Constraint 6 says
 * approve-all, bulk-confirm and accept-remaining must not exist as components —
 * not disabled, not permission-gated: absent.
 *
 * Correct and Escalate open a required-comment step rather than submitting: a
 * correction needs its reason (`review.spec` #4), an escalation needs its
 * question (`review.spec` #6).
 *
 * Keys render as bare mono text, not key-caps — the design has no key-cap
 * component, and styling one here would invent a primitive.
 */
export const Standard: Story = {
  args: { onConfirm: noop, onCorrect: noop, onEscalate: noop },
  render: (args) => (
    <div className="max-w-160">
      <DecisionBar {...args} />
    </div>
  ),
};

/** Identity fields add "Not our party" — R13 makes party identity its own check. */
export const IdentityField: Story = {
  args: {
    onConfirm: noop,
    onCorrect: noop,
    onEscalate: noop,
    onNotOurParty: noop,
    canExclude: true,
  },
  render: (args) => (
    <div className="max-w-160">
      <DecisionBar {...args} />
    </div>
  ),
};

/** A non-review role reaching this field by deep link can look, not touch. */
export const ReadOnly: Story = {
  args: { onConfirm: noop, onCorrect: noop, onEscalate: noop, disabled: true },
  render: (args) => (
    <div className="max-w-160">
      <DecisionBar {...args} />
    </div>
  ),
};

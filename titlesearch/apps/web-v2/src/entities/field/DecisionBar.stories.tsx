import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { DecisionBar } from "./DecisionBar";

const meta = {
  title: "Field/DecisionBar",
  component: DecisionBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const handlers = {
  onConfirm: noop,
  onCorrect: noop,
  onEscalate: noop,
  onExclude: noop,
  onPass: noop,
};

/**
 * THE COPY IS THE EXPORT'S. `✓ Confirm as read` and `✎ Correct it` name what
 * the act DOES; the live bar read `Confirm C` / `Correct E`, welding the key
 * legend onto the label in a screen that already prints that legend once in the
 * queue header — and the shortcut had already moved once (⏎ → `c`).
 *
 * THERE IS NO BULK ACTION HERE AND THERE NEVER WILL BE (HANDOFF §4.4).
 */
export const ValueField: Story = {
  args: { ...handlers, offerExclude: false },
  render: (args) => (
    <div className="max-w-160">
      <DecisionBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("act-confirm")).toHaveTextContent("Confirm as read");
    await expect(canvas.queryByTestId("act-exclude")).not.toBeInTheDocument();
    // Absent, not disabled — and never as a component at all.
    await expect(canvas.queryByText(/approve/i)).not.toBeInTheDocument();
  },
};

/**
 * `✕ Not our party` IS OFFERED ONLY WHERE PARTY IDENTITY IS THE QUESTION
 * (rulebook R13). Correcting a judgment against a different M. Quenby would
 * file a suppression as a value change.
 */
export const IdentityField: Story = {
  args: { ...handlers, offerExclude: true },
  render: (args) => (
    <div className="max-w-160">
      <DecisionBar {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("act-exclude")).toHaveTextContent("Not our party");
  },
};

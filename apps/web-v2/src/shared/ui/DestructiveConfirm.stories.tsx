import type { Meta, StoryObj } from "@storybook/react-vite";
import { DestructiveConfirm } from "./DestructiveConfirm";

const meta = {
  title: "Primitives/DestructiveConfirm",
  component: DestructiveConfirm,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DestructiveConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inline, not a modal — `component-inventory.md` §1: "Design uses inline
 * arm-then-confirm; keep inline, borrow focus semantics."
 *
 * Press the trigger and watch where focus goes: it MOVES to the confirm button.
 * Without that, a keyboard user's focus sits on a button whose label silently
 * changed underneath them, and the next Enter does something they never read.
 * The question is `role="alert"` for the same reason.
 *
 * Solid red appears here and nowhere else in the design — it is reserved for
 * the confirming half of a two-step destructive act.
 */
export const RetireARule: Story = {
  args: {
    trigger: "Retire…",
    question:
      "Retiring removes this rule from the live book. Orders already ruled keep their ruling.",
    confirmLabel: "Confirm — retire",
    onConfirm: () => {},
  },
};

export const WithdrawUnresolved: Story = {
  args: {
    trigger: "Withdraw unresolved…",
    question:
      "The escalation closes with no rule, and the question can be asked again.",
    confirmLabel: "Confirm — withdraw",
    onConfirm: () => {},
  },
};

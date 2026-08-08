import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { EscalateEditor } from "./EscalateEditor";

const meta = {
  title: "Review/EscalateEditor",
  component: EscalateEditor,
  parameters: { layout: "padded" },
  args: { pending: false, onCancel: fn(), onSubmit: fn() },
} satisfies Meta<typeof EscalateEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const QUESTION = "order sheet says 03029 — which source wins?";

/** A typed question is an escalation, and Enter sends it once. */
export const QuestionSubmits: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByTestId("escalate-input"), `${QUESTION}{Enter}`);
    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
  },
};

/**
 * BLOCKER 2. Repeated Enter while the write is in flight sent the senior the
 * same question three times — three items in an inbox that exists to be short,
 * from one reviewer act.
 */
export const PendingEnterSendsNothing: Story = {
  args: { pending: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByTestId("escalate-input"),
      `${QUESTION}{Enter}{Enter}`,
    );
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

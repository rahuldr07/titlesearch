import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { FinalizeBar } from "./FinalizeBar";

const meta = {
  title: "Review/FinalizeBar",
  component: FinalizeBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof FinalizeBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9. `demoFields` carries 12 confirmed + 6 needs_review = 18 fields the
 * pipeline ever flagged (same tally `DecisionDock` shows), 6 of them still
 * open. The bar names what's left, never a readiness verdict, and the button
 * stays disabled — no finalize/deliver endpoint exists in the contract.
 */
export const NamesWhatIsLeft: Story = {
  args: { fields: demoFields },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/6 of 18 decisions still open/)).toBeInTheDocument();
    await expect(canvas.getByTestId("finalize-order-btn")).toBeDisabled();
  },
};

/** Every flagged decision answered — the note says so instead of a bare count. */
export const AllAnsweredNamesIt: Story = {
  args: { fields: demoFields.map((f) => (f.state === "needs_review" ? { ...f, state: "confirmed" } : f)) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/All 18 decisions answered/)).toBeInTheDocument();
  },
};

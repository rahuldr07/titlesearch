import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { ReviewEditors } from "./ReviewEditors";

const meta = {
  title: "Review/ReviewEditors",
  component: ReviewEditors,
  parameters: { layout: "padded" },
  args: {
    mode: "idle",
    editorKey: "fld_m1lender:SOUTHSTONE MORTGAGE",
    seed: "SOUTHSTONE MORTGAGE",
    machineValue: "S0UTHST0NE M0RTGAGE",
    writePending: false,
    serverNote: null,
    blankNote: false,
    onCancel: fn(),
    onCorrect: fn(),
    onEscalate: fn(),
    onExclude: fn(),
    onPass: fn(),
  },
} satisfies Meta<typeof ReviewEditors>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * BLOCKER 1. The refusal is not confirm's alone. A 409 on `/correct` used to
 * leave this region empty while the editor sat open holding the rejected
 * value; the note must render — with the server's message VERBATIM — beside
 * whichever editor raised it.
 */
export const CorrectionRefusalRendersVerbatim: Story = {
  args: { mode: "correct", serverNote: "field is terminal (escalated)" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("confirm-note")).toHaveTextContent(
      "server: field is terminal (escalated)",
    );
    // the editor stays open holding the typed value — a refusal is an answer
    // to act on, not a reason to throw the reviewer's work away
    await expect(canvas.getByTestId("edit-value")).toBeInTheDocument();
  },
};

/** The same for a suppression: R13's refusal reaches the reviewer intact. */
export const ExcludeRefusalRendersVerbatim: Story = {
  args: {
    mode: "exclude",
    serverNote: "exclude applies only to judgment party rows (R13)",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("confirm-note")).toHaveTextContent(
      "server: exclude applies only to judgment party rows (R13)",
    );
    await expect(canvas.getByTestId("exclude-reason")).toBeInTheDocument();
  },
};

/**
 * A WRITE IN FLIGHT MAKES EVERY OPEN EDITOR INERT. One flag, because exactly
 * one editor is open at a time and the mutation it fires is the only one that
 * can be pending underneath it.
 */
export const PendingWriteDisablesTheOpenEditor: Story = {
  args: { mode: "correct", writePending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("edit-submit")).toBeDisabled();
  },
};

/** Nothing refused and nothing open — the region draws nothing at all. */
export const IdleDrawsNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("confirm-note")).not.toBeInTheDocument();
    await expect(canvas.queryByTestId("edit-value")).not.toBeInTheDocument();
  },
};

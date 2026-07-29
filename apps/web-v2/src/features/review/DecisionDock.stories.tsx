import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { demoFields } from "@titlepipe/mocks";
import { DecisionDock } from "./DecisionDock";

const meta = {
  title: "Review/DecisionDock",
  component: DecisionDock,
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionDock>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 7. `demoFields` has 12 `confirmed` + 6 `needs_review` = 18 fields the
 * pipeline ever flagged for a person (`auto_confirmed` ×2 and `pending` ×1 are
 * excluded from both numbers — nobody is deciding those). 12 of the 18 are
 * already answered.
 *
 * `selectedPath` names one of the 18 (`owner.zip`, currently `needs_review`),
 * so "rest of the queue" is 17 — the other flagged fields, not the 18 minus
 * some global reviewer queue. Tracing the design's own mock
 * (`decRest = decisions.filter(d => !d.expanded)`, scoped to the current
 * order's `D.decisions`) confirms this is a per-order count, sourced entirely
 * from `Field.state` — not the cross-order `/api/queue/next` count, so no
 * CONTRACT GAP applies here.
 */
export const AnsweredOfTotal: Story = {
  args: { fields: demoFields, selectedPath: "owner.zip" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/12 of 18 answered/)).toBeInTheDocument();
    await expect(canvas.getByText(/Rest of the queue · 17/)).toBeInTheDocument();
  },
};

/** No selection at all still counts correctly — nothing is excluded from the rest-of-queue tally. */
export const NoFieldSelected: Story = {
  args: { fields: demoFields, selectedPath: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Rest of the queue · 18/)).toBeInTheDocument();
  },
};

/**
 * The key hint names the keys this screen actually binds — the design's
 * 2026-07-28 legend, `C confirm · E correct`, now that the screen adopts it.
 * Checked against the dock's own text rather than `getByText`, since the hint's
 * key letters sit in nested spans and a substring query over the tree matches
 * every ancestor, not one node. Escalate is ABSENT — it has no hotkey (button
 * only), and ⏎ no longer confirms.
 */
export const KeyHintMatchesLiveBindings: Story = {
  args: { fields: demoFields, selectedPath: "owner.zip" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByTestId("decision-dock").textContent ?? "";
    await expect(text).toContain("Confirm");
    await expect(text).toContain("C");
    await expect(text).toContain("Correct");
    await expect(text).toContain("E");
    await expect(text).not.toContain("⏎");
    await expect(text).not.toContain("Escalate");
  },
};

/** No fields ever flagged for a person — the dock has nothing to show. */
export const NoDecisionsRendersNothing: Story = {
  args: {
    fields: demoFields.filter((f) => f.state === "auto_confirmed"),
    selectedPath: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("decision-dock")).not.toBeInTheDocument();
  },
};

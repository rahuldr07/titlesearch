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
 * THE REST-OF-QUEUE COUNT IS NOT ASSERTED HERE ANY MORE, because this band no
 * longer prints it. It belongs to `QueueRest`, on the rows it counts; a heading
 * here and rows elsewhere is the defect this component was carrying half of.
 */
export const AnsweredOfTotal: Story = {
  args: { fields: demoFields },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/12 of 18 answered/)).toBeInTheDocument();
    await expect(canvas.queryByText(/Rest of the queue/)).not.toBeInTheDocument();
  },
};

/**
 * The key hint names the keys this screen actually binds — the design's
 * 2026-07-28 legend, `C confirm · E correct`, now that the screen adopts it.
 * Checked against the dock's own text rather than `getByText`, since the hint's
 * key letters sit in nested spans and a substring query over the tree matches
 * every ancestor, not one node. Escalate is ABSENT — it has no hotkey (button
 * only), and ⏎ no longer confirms.
 *
 * KEY FIRST (2026-07-31). This asserted `Confirm` and `Correct` — the
 * button-label form — while the doc above it and the export both read
 * `C confirm · E correct`. Two loose `toContain`s on a single capital letter
 * passed either way, so the assertion was blind to the very thing it names.
 * The whole token is pinned now.
 */
export const KeyHintMatchesLiveBindings: Story = {
  args: { fields: demoFields },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByTestId("decision-meter").textContent ?? "";
    await expect(text).toContain("C confirm");
    await expect(text).toContain("E correct");
    await expect(text).toContain("j/k move");
    await expect(text).not.toContain("⏎");
    await expect(text).not.toContain("Escalate");
  },
};

/** No fields ever flagged for a person — the meter has nothing to show. */
export const NoDecisionsRendersNothing: Story = {
  args: { fields: demoFields.filter((f) => f.state === "auto_confirmed") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId("decision-meter")).not.toBeInTheDocument();
  },
};

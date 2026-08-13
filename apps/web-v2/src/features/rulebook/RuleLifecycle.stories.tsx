import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { RuleLifecycle } from "./RuleLifecycle";

const meta = {
  title: "Rulebook/RuleLifecycle",
  component: RuleLifecycle,
  parameters: { layout: "padded" },
} satisfies Meta<typeof RuleLifecycle>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9. Every stage chip the design draws here (`{{ ruleDetail.status }}`
 * copied three times over PENDING/LIVE/RETIRED at `:1819-1823`) is one bare
 * word — the design never puts the new-rule form's explanatory sentence
 * ("PENDING — AFFECTS NOTHING YET") on this rail. `ruleStatus.ts` used to
 * carry a different, stale sentence here ("PENDING — CANNOT AFFECT THE
 * PIPELINE") left over from before the 2026-07-28 revision; this asserts the
 * rail reads the design's actual bare words and none of the older prose.
 */
export const StagesReadBareWords: Story = {
  args: { status: "pending" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("PENDING")).toBeInTheDocument();
    await expect(canvas.getByText("LIVE")).toBeInTheDocument();
    await expect(canvas.getByText("RETIRED")).toBeInTheDocument();
    await expect(canvas.queryByText(/CANNOT AFFECT/)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/AFFECTS NOTHING YET/)).not.toBeInTheDocument();
  },
};

/** The current stage is marked `aria-current`, whichever status is passed. */
export const CurrentStageMarked: Story = {
  args: { status: "live" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("LIVE")).toHaveAttribute("aria-current", "true");
    await expect(canvas.getByText("PENDING")).toHaveAttribute("aria-current", "false");
  },
};

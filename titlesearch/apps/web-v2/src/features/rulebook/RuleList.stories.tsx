import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { demoRules } from "@titlepipe/mocks";
import { RuleList } from "./RuleList";

const meta = {
  title: "Rulebook/RuleList",
  component: RuleList,
  parameters: { layout: "padded" },
  args: { onSelect: fn() },
} satisfies Meta<typeof RuleList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * TASK 9. `demoRules` carries one pending rule (`DRAFT-HOA-AGE`). The design's
 * row chip (`:1762`, `{{ r.status }}`) is the bare word — this row must never
 * show `ruleStatus.ts`'s old, stale sentence.
 */
export const PendingRowShowsBareChip: Story = {
  args: { rules: demoRules, selected: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByTestId("rule-row-DRAFT-HOA-AGE");
    await expect(row).toHaveTextContent("PENDING");
    await expect(row).not.toHaveTextContent("CANNOT AFFECT");
  },
};

/** An empty filter says the book has one, not that the reader found nothing. */
export const EmptyFilterExplainsItself: Story = {
  args: { rules: [], selected: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/The book is not empty/)).toBeInTheDocument();
  },
};

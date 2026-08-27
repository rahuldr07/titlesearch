import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { FieldState } from "@titlepipe/contract";
import { StatePill } from "./StatePill";

/**
 * SIX MEMBERS, SIX APPEARANCES, AND NO CONFIDENCE ANYWHERE.
 *
 * There is deliberately NO story showing "confirmed but low confidence" or
 * "needs review, promoted". Not because they were left out — because the
 * component takes the enum member and nothing else, so there is no way to write
 * the args for one. The absence of that story IS the enforcement, the same way
 * `Button` has no disabled-without-a-reason story.
 */
const meta = {
  title: "entities/StatePill",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: StatePill,
} satisfies Meta<typeof StatePill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { state: "pending" } };

/** No human saw this. The lighter ✓ — a mark on a row you are not asked to act on. */
export const AutoConfirmed: Story = { args: { state: "auto_confirmed" } };

export const NeedsReview: Story = { args: { state: "needs_review" } };

export const Confirmed: Story = { args: { state: "confirmed" } };

export const Corrected: Story = { args: { state: "corrected" } };

/** Stopped until a RULE resolves it (`INVARIANTS:36`). */
export const Escalated: Story = { args: { state: "escalated" } };

/**
 * All six on one canvas. `confirmed` and `corrected` share a mark and an ink on
 * purpose — both are settled — and are told apart by their sentence, which is
 * why the assertion is on TEXT and not on styling.
 */
export const EveryState: Story = {
  args: { state: "pending" },
  render: () => (
    <div className="flex flex-col gap-4">
      {FieldState.options.map((state) => (
        <StatePill key={state} state={state} />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const pills = canvasElement.querySelectorAll("[data-field-state]");
    expect(pills).toHaveLength(FieldState.options.length);
    const labels = Array.from(pills, (p) => p.textContent?.trim() ?? "");
    expect(new Set(labels).size).toBe(FieldState.options.length);
  },
};

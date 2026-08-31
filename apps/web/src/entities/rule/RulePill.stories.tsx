import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { RulePill } from "./RulePill";

/**
 * A pending rule renders visibly inert. These three stories are the proof of
 * "visibly": inert is struck and dashed, not merely paler.
 */
const meta = {
  title: "entities/RulePill",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: RulePill,
  args: { code: "R13" },
} satisfies Meta<typeof RulePill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Binding now. */
export const Live: Story = { args: { status: "live" } };

/** Drafted. Cannot affect the pipeline until an engineer confirms it. */
export const Pending: Story = {
  args: { status: "pending" },
  play: async ({ canvasElement }) => {
    const pill = canvasElement.querySelector('[data-rule-status="pending"]');
    // The sentence, not just the styling — a dashed border is a convention a
    // new reviewer has not learned yet.
    expect(pill?.textContent).toContain("Inert until an engineer confirms it");
  },
};

/** It used to bind. A different place to send a reviewer than "not yet". */
export const Retired: Story = { args: { status: "retired" } };

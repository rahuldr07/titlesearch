import { onPanel } from "../panelGround";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ProgressMeter } from "./ProgressMeter";

/**
 * Dots, not a bar, and the reason is in the component: a percentage bar is a
 * throughput display, and throughput vocabulary is banned outright.
 */
const meta = {
  title: "entities/ProgressMeter",
  /* The ground these components actually stand on — see `panelGround.tsx`. */
  decorators: [onPanel],
  component: ProgressMeter,
  args: { noun: "decisions settled" },
} satisfies Meta<typeof ProgressMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSettled: Story = { args: { settled: 0, total: 24 } };

export const PartlySettled: Story = { args: { settled: 9, total: 24 } };

/**
 * THE ONE THAT MATTERS. 23 of 24 is 17.25 dots; the meter floors to 17 and
 * leaves the last dot empty. A meter that rounds up is a meter that says "done"
 * at the exact moment somebody is deciding whether to release.
 */
export const OneShortOfComplete: Story = {
  args: { settled: 23, total: 24 },
  play: async ({ canvasElement }) => {
    const meter = canvasElement.querySelector("[data-progress-meter]");
    expect(meter?.getAttribute("data-settled")).toBe("23");
    expect(meter?.getAttribute("data-total")).toBe("24");
    const filled = canvasElement.querySelectorAll(".bg-state-settled");
    expect(filled.length).toBeLessThan(18);
  },
};

export const AllSettled: Story = { args: { settled: 24, total: 24 } };

/** An order with nothing to settle. Divides by nothing rather than by zero. */
export const NothingToSettle: Story = { args: { settled: 0, total: 0 } };

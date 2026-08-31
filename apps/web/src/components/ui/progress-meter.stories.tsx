import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ProgressMeter } from "./progress-meter";
import { onPanel } from "./kitGround";

/**
 * The 18-dot meter at every state a decision pane can be in, plus the two
 * boundary behaviours: zero total, and a total past MAX_DOTS where the
 * graphic is deliberately dropped.
 */
const meta = {
  title: "ui/ProgressMeter",
  decorators: [onPanel],
  component: ProgressMeter,
  args: {
    label: "Decisions settled",
    settled: 14,
    total: 18,
    caption: "14 of 18 decisions settled",
  },
} satisfies Meta<typeof ProgressMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The design's own example: 14 of 18. */
export const Partial: Story = {
  play: ({ canvasElement }) => {
    const dots = canvasElement.querySelectorAll(
      '[data-slot="progress-meter-dots"] > span',
    );
    expect(dots).toHaveLength(18);
    // The graphic and the caption are one variable, never two literals.
    expect(canvasElement.textContent).toContain("14 of 18");
  },
};

/** Nothing decided yet. */
export const NoneSettled: Story = {
  args: { settled: 0, caption: "0 of 18 decisions settled" },
};

/** Every decision made — the state that unlocks release. */
export const AllSettled: Story = {
  args: { settled: 18, caption: "18 of 18 decisions settled" },
};

/** One left. The state the meter exists to make obvious at a glance. */
export const OneRemaining: Story = {
  args: { settled: 17, caption: "17 of 18 decisions settled" },
};

/** No caption: the meter alone, for a dense header row. */
export const WithoutCaption: Story = {
  args: { settled: 9, caption: undefined },
};

/** An order with nothing in it yet. No dots, and that is correct. */
export const EmptyTotal: Story = {
  args: { settled: 0, total: 0, caption: "0 of 0 decisions settled" },
};

/**
 * Above 24 the dots stop being countable, so the graphic is dropped and the
 * mono count stands alone — a rounded bar here would be a number the screen
 * then disagrees with.
 */
export const TooManyToCount: Story = {
  args: { settled: 118, total: 240, caption: "118 of 240 decisions settled" },
  play: ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="progress-meter-dots"]')).toBeNull();
    expect(canvasElement.textContent).toContain("118 of 240");
  },
};

/** Out-of-range input is clamped rather than drawn wrong. */
export const ClampedOverflow: Story = {
  args: { settled: 40, total: 18, caption: "18 of 18 decisions settled" },
};

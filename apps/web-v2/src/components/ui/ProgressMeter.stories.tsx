import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressMeter } from "./ProgressMeter";

/**
 * Both numbers come from the server. There is no `items` prop to take a length
 * from and no `percent` — a percentage is a second literal for the same fact,
 * and rule 11 requires numbers to reconcile across screens.
 */
const meta = {
  title: "ui/ProgressMeter",
  component: ProgressMeter,
  args: { label: "Decisions settled", settled: 14, total: 18 },
} satisfies Meta<typeof ProgressMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Partial: Story = {};

/** The design's own drawing: 18 dots plus a mono count. */
export const WithCaption: Story = { args: { caption: "14 of 18 decisions settled" } };

export const Empty: Story = { args: { settled: 0, caption: "0 of 18 decisions settled" } };

export const Complete: Story = {
  args: { settled: 18, caption: "18 of 18 decisions settled" },
};

/** Past the countable threshold the dots stop and the count stands alone. */
export const TooManyToCount: Story = {
  args: { settled: 140, total: 212, caption: "140 of 212 pages extracted" },
};

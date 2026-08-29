import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress, ProgressLabel, ProgressValue } from "./progress";
import { onPanel } from "./kitGround";

/**
 * THE BAR, WHICH IS NOT THE ONE THE SCREENS USE. Every story here is a
 * CONTINUOUS quantity — bytes, pages — because that is the only case where a
 * bar tells the truth. For countable decisions see `progress-meter.stories`.
 */
const meta = {
  title: "ui/Progress",
  decorators: [onPanel],
  component: Progress,
  args: { value: 62, "aria-label": "Uploading the county package" },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-transfer. */
export const InProgress: Story = {
  render: (args) => (
    <div className="w-160">
      <Progress {...args} />
    </div>
  ),
};

/** Nothing has moved yet. */
export const Zero: Story = {
  args: { value: 0 },
  render: (args) => (
    <div className="w-160">
      <Progress {...args} />
    </div>
  ),
};

/** Finished. Settled green, not accent — rule 1. */
export const Complete: Story = {
  args: { value: 100 },
  render: (args) => (
    <div className="w-160">
      <Progress {...args} />
    </div>
  ),
};

/** No known total: the track fills and the label carries the honesty. */
export const Indeterminate: Story = {
  args: { isIndeterminate: true },
  render: (args) => (
    <div className="w-160">
      <Progress {...args}>
        <ProgressLabel>Extracting the text layer</ProgressLabel>
        <ProgressValue>{() => "page count unknown"}</ProgressValue>
      </Progress>
    </div>
  ),
};

/** With a label and a mono readout — the shape a pane actually renders. */
export const Labelled: Story = {
  args: { value: 62 },
  render: (args) => (
    <div className="w-160">
      <Progress {...args}>
        <ProgressLabel>Uploading the county package</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
};

/**
 * WHEN NOT TO REACH FOR THIS. Left: 18 decisions, which are countable, and the
 * bar throws away which ones. Right: the meter. The bar is correct for bytes
 * and wrong here.
 */
export const WrongToolForACount: Story = {
  args: { value: 78, "aria-label": "Decisions settled" },
  render: (args) => (
    <div className="w-160 flex-col">
      <Progress {...args}>
        <ProgressLabel>Decisions settled</ProgressLabel>
        <ProgressValue>{() => "about three quarters"}</ProgressValue>
      </Progress>
      <p className="pt-8 font-sans text-label leading-flat text-state-halt">
        Defect — the quantity is countable. Use ProgressMeter: "14 of 18 decisions
        settled".
      </p>
    </div>
  ),
};

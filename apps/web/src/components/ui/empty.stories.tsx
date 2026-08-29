import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Empty } from "./empty";
import { onPanel } from "./kitGround";

/**
 * `reason` IS REQUIRED, AND THAT IS THE WHOLE DESIGN. These four stories are
 * four DIFFERENT facts that a registry `<Empty>` would have rendered as the
 * same "No results".
 */
const meta = {
  title: "ui/Empty",
  decorators: [onPanel],
  component: Empty,
  args: {
    title: "Nothing in this queue",
    reason: "Every order assigned to you has been dispositioned.",
  },
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Good news: the queue is genuinely clear. Nothing to press. */
export const QueueClear: Story = {
  play: ({ canvasElement }) => {
    // The reason is rendered, not merely typed. A required prop that the
    // component then drops would pass tsc and fail the reader.
    expect(canvasElement.textContent).toContain("dispositioned");
  },
};

/** A filter matched nothing. Different fact, different way out. */
export const FilterMatchedNothing: Story = {
  args: {
    title: "No orders match this filter",
    reason: "The Escalated filter is on and no order is currently escalated.",
    action: (
      <button
        type="button"
        className="tp-state tp-target tp-ring cursor-pointer rounded-lg border border-control-border bg-surface-panel px-8 font-sans text-meta leading-close font-medium text-ink-secondary hover:text-ink-primary"
      >
        Clear the filter
      </button>
    ),
  },
};

/** The fetch failed. The third fact "No results" would have hidden. */
export const FetchFailed: Story = {
  args: {
    title: "Could not load the queue",
    reason: "The server did not answer. Nothing here is stale — nothing loaded at all.",
    action: (
      <button
        type="button"
        className="tp-state tp-target tp-ring cursor-pointer rounded-lg border border-control-border bg-surface-panel px-8 font-sans text-meta leading-close font-medium text-ink-secondary hover:text-ink-primary"
      >
        Try again
      </button>
    ),
  },
};

/** Not yet started. Empty because nothing has been asked of it. */
export const NothingRequestedYet: Story = {
  args: {
    title: "No search run yet",
    reason: "Choose a county and an instrument type to begin.",
  },
};

/** All four side by side — the argument for a required `reason`, in one frame. */
export const FourDifferentBlanks: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <Empty
        title="Nothing in this queue"
        reason="Every order assigned to you has been dispositioned."
      />
      <Empty
        title="No orders match this filter"
        reason="The Escalated filter is on and no order is currently escalated."
      />
      <Empty
        title="Could not load the queue"
        reason="The server did not answer. Nothing loaded at all."
      />
      <Empty
        title="No search run yet"
        reason="Choose a county and an instrument type to begin."
      />
    </div>
  ),
};

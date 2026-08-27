import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

/**
 * `reason` is required. "No results" alone cannot distinguish a filter that
 * matched nothing from a queue that is genuinely clear from a fetch that failed
 * quietly — three different facts, one blank screen.
 */
const meta = {
  title: "ui/EmptyState",
  component: EmptyState,
  args: {
    title: "No orders match this search",
    reason: "field:value terms are combined with AND. Try removing one.",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Filtered: Story = {};

export const WithAction: Story = {
  args: { action: <Button variant="secondary">Clear search</Button> },
};

/** Some empties are good news and offer nothing to press. */
export const GoodNews: Story = {
  args: {
    title: "No open escalations",
    reason: "Every rule candidate has been ruled on by an engineer.",
    action: undefined,
  },
};

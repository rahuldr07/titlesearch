import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { RailRow } from "./RailRow";
import { RailBadge } from "./RailBadge";

const meta = {
  title: "Nav/RailRow",
  component: RailRow,
} satisfies Meta<typeof RailRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const marker = <span aria-hidden>Q</span>;

/** The testids, the badge slot and the attention dot, on one row. */
export const Expanded: Story = {
  args: {
    to: "/queue",
    label: "queue",
    active: false,
    collapsed: false,
    attention: "attend",
    marker,
    badge: <RailBadge to="/queue">3</RailBadge>,
    onNavigate: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("rail-door-/queue");
    expect(row).toHaveAttribute("href", "/queue");
    expect(row).toHaveAttribute("data-active", "0");
    expect(await canvas.findByTestId("rail-badge-/queue")).toHaveTextContent("3");
    expect(await canvas.findByTestId("rail-dot-/queue")).toBeInTheDocument();
  },
};

/** A plain left click navigates through the callback, never through the href. */
export const PlainClickNavigates: Story = {
  args: {
    to: "/overview",
    label: "overview",
    active: false,
    collapsed: false,
    attention: null,
    marker,
    // A spy in `args`, not a reassignment inside `play`: the component captured
    // the prop at render, so a later swap is never the function that runs.
    onNavigate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("rail-door-/overview"));
    expect(args.onNavigate).toHaveBeenCalledTimes(1);
    expect(args.onNavigate).toHaveBeenCalledWith("/overview");
  },
};

/** Collapsed: the marker is the only content, and the label moves to `title`. */
export const Collapsed: Story = {
  args: {
    to: "/queue",
    label: "queue",
    active: true,
    collapsed: true,
    attention: null,
    marker,
    badge: <RailBadge to="/queue">3</RailBadge>,
    onNavigate: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("rail-door-/queue");
    expect(row).toHaveAttribute("title", "queue");
    expect(row).toHaveAttribute("data-active", "1");
    expect(row).not.toHaveTextContent("3");
  },
};

/**
 * A POSITION WITH NO DESTINATION — Review before an order is in view. It is not
 * a link and it does not navigate: a rail row that invents a URL is worse than
 * one that says it cannot go yet.
 */
export const Unreachable: Story = {
  args: {
    to: "/orders/:orderId/review",
    label: "Review",
    active: false,
    collapsed: false,
    attention: null,
    marker,
    reachable: false,
    onNavigate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("rail-door-/orders/:orderId/review");
    expect(row).not.toHaveAttribute("href");
    expect(row).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(row);
    expect(args.onNavigate).not.toHaveBeenCalled();
  },
};

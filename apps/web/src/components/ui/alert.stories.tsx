import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Alert } from "./alert";
import { Button } from "./button";
import { onPanel } from "./kitGround";

/**
 * Messages here are written in the register a server actually produces —
 * whole sentences, no "Error:" prefix, no trailing ellipsis.
 */
const meta = {
  title: "ui/Alert",
  decorators: [onPanel],
  component: Alert,
  args: { message: "The queue could not be read. Nothing was passed or claimed." },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Halt — stopped, actionable. The default. */
export const Halt: Story = {
  args: {
    tone: "halt",
    message: "The queue could not be read. Nothing was passed or claimed.",
  },
};

/** Attend — look at this. Nothing failed. */
export const Attend: Story = {
  args: {
    tone: "attend",
    message:
      "The server has not resolved a checklist for this client and product. Nothing is assumed in its place.",
  },
};

/** Settled — done, no action. */
export const Settled: Story = {
  args: {
    tone: "settled",
    message: "All eighteen decisions are settled and the order is released.",
  },
};

/** With the screen's own name for the region. The title is never the refusal. */
export const WithTitle: Story = {
  args: {
    tone: "halt",
    title: "Refused",
    message:
      "This package is missing its order identity and cannot be accepted at intake.",
  },
};

/** With the way out. One button, never a row of them. */
export const WithAction: Story = {
  args: {
    tone: "halt",
    title: "Refused",
    message:
      "This package is missing its order identity and cannot be accepted at intake.",
    action: <Button variant="secondary">Back — attach what is missing</Button>,
  },
};

/** A long refusal. The message wraps and the mark stays on the first line. */
export const LongMessage: Story = {
  args: {
    tone: "halt",
    title: "Countersign refused",
    message:
      "A T1 second read must come from a different user than the ruling examiner. This order was ruled by R. Menon and the countersign was attempted by R. Menon.",
  },
};

/** All three families at once. Never a real screen — a screen carries one. */
export const AllTones: Story = {
  render: () => (
    <div className="flex w-200 flex-col gap-6">
      <Alert tone="settled" message="All eighteen decisions are settled." />
      <Alert tone="attend" message="Two fields were read from a degraded scan." />
      <Alert tone="halt" message="The queue could not be read." />
    </div>
  ),
};

/**
 * The server's message renders verbatim: the play asserts exact equality, so
 * any prefix, suffix, added period or wrapping quote fails here.
 */
const SERVER_SAID = "Queue unavailable — the router did not answer within 5s.";

export const MessageIsVerbatim: Story = {
  args: { tone: "halt", title: "Queue unavailable", message: SERVER_SAID },
  play: ({ canvasElement }) => {
    const node = canvasElement.querySelector('[data-slot="alert-message"]');
    expect(node?.textContent).toBe(SERVER_SAID);
  },
};

/**
 * A halt is role="alert" (assertive); the other two are role="status"
 * (polite). Pinned because the split is invisible on screen.
 */
export const LiveRegionRoles: Story = {
  render: () => (
    <div className="flex w-200 flex-col gap-6">
      <Alert tone="halt" message="Stopped." />
      <Alert tone="attend" message="Look at this." />
      <Alert tone="settled" message="Done." />
    </div>
  ),
  play: ({ canvasElement }) => {
    const roles = [...canvasElement.querySelectorAll('[data-slot="alert"]')].map((n) =>
      n.getAttribute("role"),
    );
    expect(roles).toEqual(["alert", "status", "status"]);
  },
};

/** The closed glyph vocabulary: ✓ ◆ • and nothing else. */
export const Marks: Story = {
  render: () => (
    <div className="flex w-200 flex-col gap-6">
      <Alert tone="settled" message="Settled." />
      <Alert tone="attend" message="Attend." />
      <Alert tone="halt" message="Halt." />
    </div>
  ),
  play: ({ canvasElement }) => {
    const glyphs = [...canvasElement.querySelectorAll('[data-slot="alert-mark"]')].map(
      (n) => n.textContent,
    );
    expect(glyphs).toEqual(["✓", "◆", "•"]);
  },
};

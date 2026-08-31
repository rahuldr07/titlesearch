import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Dialog, DialogBody, DialogFooter, DialogTrigger } from "./dialog";
import { Button } from "./button";
import { onCanvas } from "./kitGround";

/* The overlay carries `data-chord-scope="own"` and `role="dialog"` — the two
   clauses of `overlayIsUp()` — and the chord story below asserts both. */
const meta = {
  title: "ui/Dialog",
  decorators: [onCanvas],
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: header band, body, no footer. */
export const Open: Story = {
  args: {
    title: "Release the search package",
    defaultOpen: true,
    children: (
      <DialogBody>
        Every field on this order has been ruled or countersigned.
      </DialogBody>
    ),
  },
};

/**
 * With an action row: at most one primary button, the rest ghosts — a modal
 * is usually the screen's decision.
 */
export const WithActions: Story = {
  args: {
    title: "Release the search package",
    defaultOpen: true,
    children: (
      <>
        <DialogBody>This cannot be undone. The package is stamped and sent.</DialogBody>
        <DialogFooter>
          <Button variant="ghost" slot="close">Cancel</Button>
          <Button>Release</Button>
        </DialogFooter>
      </>
    ),
  },
  play: async () => {
    /*
     * Counted as "footer buttons that are not ghosts" rather than by matching
     * one variant name: the assertion is a count, and this spelling survives
     * a variant rename.
     */
    const footer = document.querySelectorAll(
      "[data-slot='dialog-footer'] [data-slot='button']",
    );
    const filled = [...footer].filter(
      (b) => b.getAttribute("data-variant") !== "ghost",
    );
    expect(filled).toHaveLength(1);
  },
};

/** A blocked action renders disabled with the rule, never hidden. */
export const BlockedAction: Story = {
  args: {
    title: "Release the search package",
    defaultOpen: true,
    children: (
      <>
        <DialogBody>Two fields on this order are still escalated.</DialogBody>
        <DialogFooter>
          <Button variant="ghost" slot="close">
            Cancel
          </Button>
          <Button disabledBecause="Blocked: T1 second read not countersigned.">
            Release
          </Button>
        </DialogFooter>
      </>
    ),
  },
  play: async () => {
    const blocked = document.querySelector("[data-disabled-reason]");
    expect(blocked?.getAttribute("data-disabled-reason")).toBe(
      "Blocked: T1 second read not countersigned.",
    );
  },
};

/**
 * A help overlay is a dialog; a dialog stands the chord vocabulary down, so
 * a single-letter ruling cannot fire from inside the cheat sheet.
 */
export const StandsTheChordsDown: Story = {
  args: {
    title: "Keyboard map",
    defaultOpen: true,
    children: <DialogBody>c confirm · e escalate · q quarantine</DialogBody>,
  },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
    expect(document.querySelector("[role='dialog']")).not.toBe(null);
  },
};

/** Closed: nothing marked, so the vocabulary is live behind it. */
export const ClosedLeavesChordsLive: Story = {
  args: {
    title: "Keyboard map",
    children: <DialogBody>Not open.</DialogBody>,
  },
  render: (args) => (
    <DialogTrigger>
      <Button>Open</Button>
      <Dialog {...args} />
    </DialogTrigger>
  ),
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

/** Opened from a trigger, which is how a screen wires one. */
export const OpensFromTrigger: Story = {
  args: {
    title: "Release the search package",
    children: <DialogBody>Opened.</DialogBody>,
  },
  render: (args) => (
    <DialogTrigger>
      <Button>Release…</Button>
      <Dialog {...args} />
    </DialogTrigger>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector("button");
    if (trigger === null) throw new Error("no trigger");
    await userEvent.click(trigger);
    expect(document.querySelector("[role='dialog']")).not.toBe(null);
  },
};

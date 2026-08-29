import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Dialog, DialogBody, DialogFooter, DialogTrigger } from "./dialog";
import { Button } from "./button";
import { onCanvas } from "./kitGround";

/* The overlay carries `data-chord-scope="own"` AND `role="dialog"` — the two
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
 * With an action row. RULE 1 IS AT ITS TIGHTEST HERE: a modal is usually the
 * screen's decision, so AT MOST ONE primary button and the rest are ghosts.
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
     * Counted as "footer buttons that are NOT ghosts" rather than by matching
     * one variant name: `button.tsx` belongs to another agent and its variant
     * vocabulary is theirs to rename. What rule 1 actually asserts is a COUNT,
     * and this spelling survives the rename.
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

/** RULE 9/12: a blocked action renders DISABLED WITH THE RULE, never hidden. */
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
 * THE CHORD CONTRACT, and this component is the reason it exists: `chords.ts`
 * pins the bug where "? then c CONFIRMS A RULING from inside the cheat sheet —
 * on a field carrying T1 exposure". A help overlay is a dialog; a dialog stands
 * the vocabulary down; the ruling cannot fire.
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

/** CLOSED: nothing marked, so the vocabulary is live behind it. */
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

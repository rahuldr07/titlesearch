import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { CommandPalette } from "./commandPalette";
import { onCanvas } from "./kitGround";

/**
 * The overlay the chord layer was written for: a palette is opened by a
 * chord, is full of single letters, and sits over a screen whose fields the
 * same letters act on.
 */
const meta = {
  title: "ui/CommandPalette",
  decorators: [onCanvas],
  component: CommandPalette,
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

const commands = (
  <>
    <CommandInput />
    <CommandList aria-label="Commands">
      <CommandItem id="confirm" keys="c">
        Confirm the reading
      </CommandItem>
      <CommandItem id="escalate" keys="e">
        Escalate to a rule
      </CommandItem>
      <CommandItem id="quarantine" keys="q">
        Quarantine the county
      </CommandItem>
      <CommandItem id="next" keys="j">
        Next field
      </CommandItem>
    </CommandList>
  </>
);

/** Open, unfiltered. Chords render in mono. */
export const Open: Story = {
  args: { title: "Commands", isOpen: true, onOpenChange: () => {}, children: commands },
};

/** Closed. The whole palette is gone from the DOM, mark included. */
export const Closed: Story = {
  args: {
    title: "Commands",
    isOpen: false,
    onOpenChange: () => {},
    children: commands,
  },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

/**
 * useFilter({ sensitivity: "base" }) is Intl-backed, so "recu" matches
 * "Reçu" — county names and grantor strings are exactly the data where a
 * toLowerCase().includes() quietly returns nothing.
 */
export const Filtered: Story = {
  args: { title: "Commands", isOpen: true, onOpenChange: () => {}, children: commands },
  play: async () => {
    const input = document.querySelector("[data-slot='command-input'] input");
    if (input === null) throw new Error("no input");
    await userEvent.type(input as HTMLInputElement, "esc");
    const items = document.querySelectorAll("[data-slot='command-item']");
    expect(items).toHaveLength(1);
  },
};

/** Nothing matches. An empty palette says so rather than collapsing. */
export const NoMatches: Story = {
  args: { title: "Commands", isOpen: true, onOpenChange: () => {}, children: commands },
  play: async () => {
    const input = document.querySelector("[data-slot='command-input'] input");
    if (input === null) throw new Error("no input");
    await userEvent.type(input as HTMLInputElement, "zzzz");
    // Scoped to the menu: react-aria's live-announcer region sits in
    // `document.body` and carries stale option counts. See combobox.stories.
    const menu = document.querySelector("[role='menu']");
    expect(menu?.textContent).toContain("No commands match.");
  },
};

/**
 * The chord contract, three ways, none redundant: the dialog role, the `own`
 * mark on the scrim (live one frame before focus moves inside), and the
 * menu/menuitem roles — so even a palette rendered inline still owns its keys.
 */
export const StandsTheChordsDown: Story = {
  args: { title: "Commands", isOpen: true, onOpenChange: () => {}, children: commands },
  play: async () => {
    expect(document.querySelector("[role='dialog']")).not.toBe(null);
    expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
    expect(document.querySelector("[role='menu']")).not.toBe(null);
  },
};

/**
 * Inline, with no dialog around it. The `own` mark is correctly absent, and
 * the menu roles are what stand the vocabulary down while focus is inside.
 */
export const Inline: Story = {
  args: {
    title: "Commands",
    isOpen: false,
    onOpenChange: () => {},
    children: commands,
  },
  render: () => (
    <div className="w-160 overflow-hidden rounded-lg border border-line-strong bg-surface-panel">
      <Command>{commands}</Command>
    </div>
  ),
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
    expect(document.querySelector("[role='menu']")).not.toBe(null);
  },
};

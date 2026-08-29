import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";

import { ComboBox, Option } from "./combobox";
import { onPanel } from "./kitGround";

const meta = {
  title: "ui/ComboBox",
  decorators: [onPanel],
  component: ComboBox,
  args: { label: "County", placeholder: "Search counties…" },
} satisfies Meta<typeof ComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

const counties = (
  <>
    <Option id="travis">Travis</Option>
    <Option id="tarrant">Tarrant</Option>
    <Option id="harris">Harris</Option>
    <Option id="bexar">Bexar</Option>
  </>
);

/** Resting and empty. */
export const Empty: Story = { args: { children: counties } };

/** With a value already chosen, as a saved form renders one. */
export const Selected: Story = {
  args: { defaultSelectedKey: "harris", children: counties },
};

/**
 * Open, unfiltered.
 *
 * Opened by CLICKING the disclosure button, not by a `defaultOpen` prop:
 * react-aria's ComboBox has no such prop (unlike Select and DialogTrigger,
 * which do) — its open state is derived from `menuTrigger` and from input. A
 * story that guessed one would have typechecked as an unknown prop and
 * rendered a closed panel.
 */
export const Open: Story = {
  args: { children: counties },
  play: async ({ canvasElement }) => {
    await openPanel(canvasElement);
    expect(document.querySelector("[role='listbox']")).not.toBe(null);
  },
};

/** Click the disclosure button. Shared by the stories that need a panel up. */
async function openPanel(canvasElement: HTMLElement): Promise<void> {
  const trigger = canvasElement.querySelector("[data-slot='combobox-trigger']");
  if (trigger === null) throw new Error("no disclosure button");
  await userEvent.click(trigger);
}

/**
 * FILTERED TO NOTHING, which is the state the registry forgot: its
 * `ComboboxEmpty` was a component a caller had to remember to place, so a
 * forgotten one rendered a zero-height panel. `renderEmptyState` cannot be
 * forgotten.
 */
export const NoMatches: Story = {
  args: { children: counties },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input");
    if (input === null) throw new Error("no input");
    /*
     * Click the INPUT to focus it before typing. `userEvent.type` dispatches to
     * the element it is given, but react-aria's ComboBox filters off its own
     * controlled input state, which only updates while the field has focus —
     * typing at an unfocused input left the collection unfiltered and the
     * assertion reading four counties.
     */
    await userEvent.click(input);
    await userEvent.type(input, "zzz");
    /*
     * Asserted on the LISTBOX, not on `document.body`. React Aria mounts a
     * `@react-aria/live-announcer` region that carries stale text like "4
     * options available", and a body-wide `toContain` reads it as part of the
     * page — which made this assertion answer about the announcer rather than
     * about the panel. Scoping it to the collection is the fix.
     */
    /*
     * Scoped to the PANEL, not to `document.body`: react-aria mounts a
     * `@react-aria/live-announcer` region in the body that carries stale text
     * ("4 options available"), and a body-wide `toContain` answers about the
     * announcer rather than about the list.
     */
    await waitFor(() => {
      const list = document.querySelector("[data-slot='popover']");
      expect(list?.textContent ?? "«panel not mounted»").toContain("No matches.");
    });
  },
};

/**
 * THE CHORD CONTRACT, AND IT IS TWO CLAUSES HERE, NEITHER SUFFICIENT ALONE.
 *
 * The input carries `role="combobox"`, which is in `FOCUSED_ITEM_ROLES`, so it
 * owns every printable key while the caret is in it — that clause covers the
 * whole time before the panel opens. The open panel carries
 * `data-chord-scope="own"` from `Popover`, which covers the frames between the
 * panel mounting and focus reaching an option.
 */
export const StandsTheChordsDown: Story = {
  args: { children: counties },
  play: async ({ canvasElement }) => {
    expect(document.querySelector("[role='combobox']")).not.toBe(null);
    await openPanel(canvasElement);
    expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
  },
};

/** Closed: no `own` mark, so the vocabulary is live behind it. */
export const ClosedLeavesChordsLive: Story = {
  args: { children: counties },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

/** Rule 9: no boolean disabled exists, only a sentence. */
export const Blocked: Story = {
  args: {
    disabledBecause: "Blocked: the county set is fixed once a package is ordered.",
    children: counties,
  },
  play: async () => {
    const blocked = document.querySelector("[data-disabled-reason]");
    expect(blocked).not.toBe(null);
  },
};

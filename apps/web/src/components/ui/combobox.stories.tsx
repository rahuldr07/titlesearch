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
 * Open, unfiltered. Opened by clicking the disclosure button: react-aria's
 * ComboBox has no `defaultOpen` prop (unlike Select and DialogTrigger) — its
 * open state is derived from `menuTrigger` and from input.
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

/** Filtered to nothing — the empty state must render, not a zero-height panel. */
export const NoMatches: Story = {
  args: { children: counties },
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector("input");
    if (input === null) throw new Error("no input");
    /*
     * Click the input to focus it before typing: react-aria's ComboBox
     * filters off its own controlled input state, which only updates while
     * the field has focus — typing at an unfocused input leaves the
     * collection unfiltered.
     */
    await userEvent.click(input);
    await userEvent.type(input, "zzz");
    /*
     * Scoped to the panel, not document.body: react-aria mounts a
     * live-announcer region in the body that carries stale text ("4 options
     * available"), and a body-wide toContain answers about the announcer
     * rather than about the list.
     */
    await waitFor(() => {
      const list = document.querySelector("[data-slot='popover']");
      expect(list?.textContent ?? "«panel not mounted»").toContain("No matches.");
    });
  },
};

/**
 * The chord contract needs both clauses: role="combobox" owns printable keys
 * while the caret is in the input, and the open panel's
 * data-chord-scope="own" covers the frames between the panel mounting and
 * focus reaching an option.
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

/** No boolean disabled exists, only a sentence. */
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

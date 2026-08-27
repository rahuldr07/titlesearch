import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import { onPanel } from "./kitGround";

/**
 * A SEGMENTED CONTROL IS A FILTER, NOT NAVIGATION — the All Orders filter strip
 * is the case, so that is what the stories show.
 */
const meta = {
  title: "ui/ToggleGroup",
  decorators: [onPanel],
  component: ToggleGroup,
  args: { label: "Order filter" },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

const filters = (
  <>
    <ToggleGroupItem id="all">All</ToggleGroupItem>
    <ToggleGroupItem id="mine">Mine</ToggleGroupItem>
    <ToggleGroupItem id="escalated">Escalated</ToggleGroupItem>
    <ToggleGroupItem id="released">Released</ToggleGroupItem>
  </>
);

/** Resting, nothing chosen yet. */
export const Default: Story = { args: { children: filters } };

/** With a cell selected: raised white on the sunken track, weight, no accent. */
export const Selected: Story = {
  args: { defaultSelectedKeys: ["mine"], children: filters },
};

/**
 * RULE 5'S ARITHMETIC, ASSERTED. The design note reads "10px/4px/6px": a track
 * at radius 10 holding cells at 6, with the 4px of padding being the gap.
 * `inner = outer − gap`. Written as `rounded-md` / `p-2` / `rounded-sm`, and
 * checked here so a redesign of any one of the three cannot silently break the
 * relationship between them.
 */
export const RadiiFollowTheArithmetic: Story = {
  args: { defaultSelectedKeys: ["all"], children: filters },
  play: async () => {
    const track = document.querySelector("[data-slot='toggle-group']");
    const cell = document.querySelector("[data-slot='toggle-group-item']");
    expect(track?.getAttribute("class")).toContain("rounded-md");
    expect(track?.getAttribute("class")).toContain("p-2");
    expect(cell?.getAttribute("class")).toContain("rounded-sm");
  },
};

/** Rule 9 and rule 12: a filter the reader may not use says why. */
export const CellBlocked: Story = {
  args: {
    defaultSelectedKeys: ["all"],
    children: (
      <>
        <ToggleGroupItem id="all">All</ToggleGroupItem>
        <ToggleGroupItem
          id="mine"
          disabledBecause="Blocked: sign in to filter by examiner."
        >
          Mine
        </ToggleGroupItem>
      </>
    ),
  },
  play: async () => {
    const blocked = document.querySelector("[data-disabled-reason]");
    expect(blocked?.getAttribute("data-disabled-reason")).toBe(
      "Blocked: sign in to filter by examiner.",
    );
  },
};

/**
 * THE CHORD CONTRACT, AND THE VALUE IS `widget`. A group has roving arrow-key
 * focus, which makes the arrows and Home/End its own; but it is mounted at all
 * times, so `own` — read document-wide by `overlayIsUp()` — would kill every
 * chord in the app for the life of the screen.
 */
export const OwnsKeysOnlyWhileFocused: Story = {
  args: { children: filters },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='widget']")).not.toBe(null);
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

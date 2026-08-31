import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./popover";
import { Button } from "./button";
import { onCanvas } from "./kitGround";

/**
 * Every story opens the popover. `defaultOpen` on the trigger rather than a
 * click in `play`: the a11y addon grades what is on the canvas when the
 * story settles, and a panel that has to be clicked open is one axe never
 * sees.
 */
const meta = {
  title: "ui/Popover",
  decorators: [onCanvas],
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The bare panel: white, hairline, radius 14, card shadow. */
export const Open: Story = {
  render: () => (
    <PopoverTrigger defaultOpen>
      <Button>Details</Button>
      <Popover>
        <PopoverDescription>
          Read from the clerk stamp on page 4 of the recorded deed.
        </PopoverDescription>
      </Popover>
    </PopoverTrigger>
  ),
};

/**
 * With the header band. Nested cards are forbidden, and the assertion is on
 * that: the header carries no border box, radius or shadow of its own — a
 * band inside the popover's surface, not a card sitting on one.
 */
export const WithHeader: Story = {
  render: () => (
    <PopoverTrigger defaultOpen>
      <Button>Provenance</Button>
      <Popover>
        <PopoverHeader>
          <PopoverTitle>Provenance</PopoverTitle>
        </PopoverHeader>
        <PopoverDescription>
          Ruled by rule R-1188. Confirmed by a second reader on the same package.
        </PopoverDescription>
      </Popover>
    </PopoverTrigger>
  ),
  play: async () => {
    const header = document.querySelector("[data-slot='popover-header']");
    expect(header).not.toBe(null);
    const cls = header?.getAttribute("class") ?? "";
    expect(cls).not.toMatch(/rounded-|shadow-card/);
  },
};

/**
 * The panel must carry `data-chord-scope="own"` so the global single-key
 * vocabulary stands down while it is up — otherwise `q` typed at an open
 * panel both escalates the field behind it and typeahead-jumps the list
 * inside it. Asserted on the DOM because a refactor can drop the attribute
 * without breaking a type.
 */
export const StandsTheChordsDown: Story = {
  render: () => (
    <PopoverTrigger defaultOpen>
      <Button>Details</Button>
      <Popover>
        <PopoverDescription>Quarantine cleared on 12 counties.</PopoverDescription>
      </Popover>
    </PopoverTrigger>
  ),
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
  },
};

/**
 * The same assertion inverted: with nothing open there must be no `own` mark
 * anywhere, or the vocabulary is dead for the life of the screen. This half
 * catches a mark left on a permanently-mounted node.
 */
export const ClosedLeavesChordsLive: Story = {
  render: () => (
    <PopoverTrigger>
      <Button>Details</Button>
      <Popover>
        <PopoverDescription>Not open.</PopoverDescription>
      </Popover>
    </PopoverTrigger>
  ),
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

/** Opened by pointer, which is how most readers will meet it. */
export const OpensOnClick: Story = {
  render: () => (
    <PopoverTrigger>
      <Button>Details</Button>
      <Popover>
        <PopoverDescription>Opened.</PopoverDescription>
      </Popover>
    </PopoverTrigger>
  ),
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector("button");
    if (trigger === null) throw new Error("no trigger");
    await userEvent.click(trigger);
    expect(document.querySelector("[data-slot='popover']")).not.toBe(null);
  },
};

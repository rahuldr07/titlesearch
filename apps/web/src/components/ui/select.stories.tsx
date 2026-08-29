import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Option, Select } from "./select";
import { onPanel } from "./kitGround";

/**
 * The options a title examiner actually picks between, not "Apple / Banana":
 * a story written against real vocabulary is the one that shows the truncation
 * and the typeahead collision.
 */
const meta = {
  title: "ui/Select",
  decorators: [onPanel],
  component: Select,
  args: { label: "Resolution" },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = (
  <>
    <Option id="confirm">Confirm the reading</Option>
    <Option id="correct">Correct the reading</Option>
    <Option id="escalate">Escalate to a rule</Option>
    <Option id="quarantine">Quarantine the county</Option>
  </>
);

/** Resting, nothing chosen: the placeholder in ink-muted. */
export const Placeholder: Story = { args: { children: options } };

/** Chosen. The trigger shows the label; the ✓ is in the list. */
export const Selected: Story = {
  args: { defaultSelectedKey: "escalate", children: options },
};

/**
 * OPEN, and the ✓ is the assertion. Rule 6's glyph vocabulary is ✓ ◆ • T1 — the
 * registry drew a lucide `CheckIcon`, which is not in it and which a greyscale
 * or high-contrast read loses.
 */
export const Open: Story = {
  args: { defaultOpen: true, defaultSelectedKey: "confirm", children: options },
  play: async () => {
    const selected = document.querySelector("[aria-selected='true']");
    expect(selected?.textContent).toContain("✓");
  },
};

/**
 * THE CHORD CONTRACT, and this is the component the bug was found in: `q` in an
 * open Select typeahead-jumps to "Quarantine the county" AND, without the mark,
 * fires the global escalate chord on the field behind it. Both layers act on
 * one keystroke.
 *
 * The mark rides on `Popover`, not on the listbox — `overlayIsUp()` must see it
 * from the frame the panel mounts, before focus reaches the first option.
 */
export const StandsTheChordsDown: Story = {
  args: { defaultOpen: true, children: options },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).not.toBe(null);
    expect(document.querySelector("[role='listbox']")).not.toBe(null);
  },
};

/** Closed: nothing marked, so the vocabulary is live. */
export const ClosedLeavesChordsLive: Story = {
  args: { children: options },
  play: async () => {
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
  },
};

/**
 * RULE 9. There is no `isDisabled` prop on this component at all — the only way
 * to turn it off is a SENTENCE — so a story showing "disabled without a reason"
 * cannot be written. That absence is the enforcement.
 */
export const Blocked: Story = {
  args: {
    disabledBecause: "Blocked: this order is released and no longer editable.",
    children: options,
  },
  play: async () => {
    const blocked = document.querySelector("[data-disabled-reason]");
    expect(blocked?.getAttribute("data-disabled-reason")).toBe(
      "Blocked: this order is released and no longer editable.",
    );
  },
};

/** One option blocked, the rest live. Same rule, one rung down. */
export const OptionBlocked: Story = {
  args: {
    defaultOpen: true,
    children: (
      <>
        <Option id="confirm">Confirm the reading</Option>
        <Option
          id="countersign"
          disabledBecause="Blocked: a T1 countersign needs a second user."
        >
          Countersign
        </Option>
      </>
    ),
  },
  /*
   * THE COUNT IS THE ASSERTION, and its absence is why this shipped broken.
   *
   * This story had no `play` at all, so it proved only that the list renders —
   * and the list DID render, with the blocked option silently dropped from the
   * DOM by `ListBox`'s collection builder. One live option where there should
   * be two, and a green story.
   *
   * Rule 12: a blocked action renders disabled WITH THE RULE, never hidden. A
   * reviewer choosing an absence state has to be able to see that a state
   * exists and is barred; an option that is simply gone is indistinguishable
   * from one that was never offered.
   */
  play: async () => {
    const options = document.querySelectorAll("[role='option']");
    expect(options).toHaveLength(2);

    const blocked = document.querySelector("[role='option'][data-disabled-reason]");
    expect(blocked).not.toBeNull();
    expect(blocked?.textContent).toContain("Countersign");
    expect(blocked?.getAttribute("data-disabled-reason")).toBe(
      "Blocked: a T1 countersign needs a second user.",
    );
  },
};

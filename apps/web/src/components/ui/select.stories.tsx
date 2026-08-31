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

/** Open, and the ✓ is the assertion — the mark, never an icon. */
export const Open: Story = {
  args: { defaultOpen: true, defaultSelectedKey: "confirm", children: options },
  play: async () => {
    const selected = document.querySelector("[aria-selected='true']");
    expect(selected?.textContent).toContain("✓");
  },
};

/**
 * Without the chord mark, `q` in an open Select both typeahead-jumps to
 * "Quarantine the county" and fires the global chord on the field behind it.
 * The mark rides on Popover, not the listbox — overlayIsUp() must see it
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
 * There is no `isDisabled` prop on this component — the only way to turn it
 * off is a sentence, so a "disabled without a reason" story cannot be
 * written.
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
   * The count is the assertion: ListBox's collection builder can silently
   * drop a wrapped option from the DOM, and a story without a count stays
   * green on one option where there should be two. A blocked option renders
   * disabled with the rule, never hidden.
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

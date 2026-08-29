import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { ComboBox, Option } from "./combobox";
import { onPanel } from "./kitGround";

/**
 * ONE OPTION BLOCKED, AND THE COUNT IS THE ASSERTION.
 *
 * Its own file because `combobox.stories.tsx` crossed the 150-line gate, and
 * the seam is honest: everything there is the widget working, and this is the
 * one case where it did not.
 *
 * `select.stories`' equivalent shipped with NO `play` function at all, so it
 * proved only that a list renders — and the list did render, with the blocked
 * option silently DROPPED by `ListBox`'s collection builder. One node where
 * there should have been two, and a green story.
 *
 * Rule 12: a blocked action renders disabled WITH THE RULE, never hidden. An
 * option that is simply gone is indistinguishable from one never offered, and
 * a reviewer picking an absence state has to be able to see that a state
 * exists and is barred.
 *
 * The check was verified the only way a check can be: the wrapper that caused
 * it was put back, and this failed with "expected 1 to have a length of 2".
 */
const meta = {
  title: "ui/ComboBox/blocked",
  decorators: [onPanel],
  component: ComboBox,
  args: { label: "County", placeholder: "Search counties…" },
} satisfies Meta<typeof ComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OptionBlocked: Story = {
  args: {
    children: (
      <>
        <Option id="travis">Travis</Option>
        <Option id="tarrant" disabledBecause="Blocked: no rulebook layer for Tarrant yet.">
          Tarrant
        </Option>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector("[data-slot='combobox-trigger']");
    if (trigger === null) throw new Error("no disclosure button");
    await userEvent.click(trigger);
    await new Promise((resolve) => setTimeout(resolve, 150));

    // THE COUNT. Both options exist; one of them is barred.
    const options = document.querySelectorAll("[role='option']");
    expect(options).toHaveLength(2);

    const blocked = document.querySelector("[role='option'][data-disabled-reason]");
    expect(blocked).not.toBe(null);
    expect(blocked?.textContent).toContain("Tarrant");
  },
};

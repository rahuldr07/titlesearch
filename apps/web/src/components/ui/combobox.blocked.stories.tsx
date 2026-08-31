import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { ComboBox, Option } from "./combobox";
import { onPanel } from "./kitGround";

/**
 * One option blocked, and the count is the assertion: ListBox's collection
 * builder silently drops an option wrapped in a non-item element, so a green
 * story can render one node where there should be two. A blocked option must
 * render disabled with the rule, never vanish.
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

    // Both options exist; one of them is barred.
    const options = document.querySelectorAll("[role='option']");
    expect(options).toHaveLength(2);

    const blocked = document.querySelector("[role='option'][data-disabled-reason]");
    expect(blocked).not.toBe(null);
    expect(blocked?.textContent).toContain("Tarrant");
  },
};

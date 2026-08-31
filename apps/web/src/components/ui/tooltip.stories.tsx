import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";

import { Tooltip, TooltipTrigger } from "./tooltip";
import { Button } from "./button";
import { onCanvas } from "./kitGround";

/**
 * A tooltip is dark chrome on a light screen, so it stands on the canvas and
 * is graded there. Rail-ink on rail-deep is the measured pair (10.51:1).
 */
const meta = {
  title: "ui/Tooltip",
  decorators: [onCanvas],
  component: Tooltip,
  /*
   * `children` is required on Tooltip, so it is declared at the meta level: a
   * `render`-only story does not satisfy a required arg, and Storybook's types
   * say so rather than letting a story render an empty chip.
   */
  args: { children: "Confirm this reading" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Open on hover, the ordinary case. */
export const Open: Story = {
  render: () => (
    <TooltipTrigger defaultOpen>
      {[
        <Button key="t">Confirm</Button>,
        <Tooltip key="c">Confirm this reading</Tooltip>,
      ]}
    </TooltipTrigger>
  ),
};

/**
 * Carrying a reason where a pointer can read it — disabled.ts puts the same
 * string on `title` and `data-disabled-reason`, so a touch reader and
 * Playwright both get it without the hover.
 */
export const CarryingAReason: Story = {
  render: () => (
    <TooltipTrigger defaultOpen>
      {[
        <Button key="t" disabledBecause="Blocked: T1 second read not countersigned.">
          Release
        </Button>,
        <Tooltip key="c">Blocked: T1 second read not countersigned.</Tooltip>,
      ]}
    </TooltipTrigger>
  ),
};

/**
 * The one component where the correct chord answer is no mark: a tooltip
 * takes no focus and contains nothing tabbable, and `own` would suspend
 * every chord for as long as a pointer rested on a button. The assertion is
 * that the mark is absent while one is open.
 */
export const TakesNoChordScope: Story = {
  render: () => (
    <TooltipTrigger defaultOpen>
      {[
        <Button key="t">Quarantine</Button>,
        <Tooltip key="c">Quarantine this county</Tooltip>,
      ]}
    </TooltipTrigger>
  ),
  play: async () => {
    expect(document.querySelector("[role='tooltip']")).not.toBe(null);
    expect(document.querySelector("[data-chord-scope='own']")).toBe(null);
    expect(document.querySelector("[data-chord-scope='widget']")).toBe(null);
  },
};

/**
 * Opens on keyboard focus (WCAG 1.4.13) — a tooltip that only opens on hover
 * is a reason no keyboard reader can ever see.
 */
export const OpensOnFocus: Story = {
  render: () => (
    <TooltipTrigger>
      {[
        <Button key="t">Escalate</Button>,
        <Tooltip key="c">Escalate to a rule</Tooltip>,
      ]}
    </TooltipTrigger>
  ),
  play: async () => {
    await userEvent.tab();
    expect(document.querySelector("[role='tooltip']")).not.toBe(null);
  },
};

/** Closed. Nothing on the canvas but the trigger. */
export const Closed: Story = {
  render: () => (
    <TooltipTrigger>
      {[
        <Button key="t">Confirm</Button>,
        <Tooltip key="c">Confirm this reading</Tooltip>,
      ]}
    </TooltipTrigger>
  ),
  play: async () => {
    expect(document.querySelector("[role='tooltip']")).toBe(null);
  },
};

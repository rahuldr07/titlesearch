import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Toggle } from "./toggle";
import { onPanel } from "./kitGround";

const meta = {
  title: "ui/Toggle",
  decorators: [onPanel],
  component: Toggle,
  args: { children: "Show retired rules" },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Off. Control chrome: 38px, radius 10, control-fill on control-border. */
export const Off: Story = {};

/**
 * ON — and it is a raised WHITE cell, not a fill. Rule 1 keeps solid fills for
 * the accent alone, and a toggle is not the screen's decision. The registry
 * drew `data-selected:bg-muted`, a filled cell, which this asserts against.
 */
export const On: Story = {
  args: { defaultSelected: true },
  play: async () => {
    const toggle = document.querySelector("[data-slot='toggle']");
    const cls = toggle?.getAttribute("class") ?? "";
    expect(cls).toContain("data-selected:bg-surface-panel");
    expect(cls).not.toContain("bg-action");
  },
};

/**
 * RULE 9. There is no `isDisabled` prop, so an unexplained disabled toggle
 * cannot be written; the reason lands on `title` and on
 * `data-disabled-reason` both, because a tooltip alone fails WCAG 2.2 on touch.
 */
export const Blocked: Story = {
  args: { disabledBecause: "Blocked: retired rules are hidden on released orders." },
  play: async () => {
    const reason = "Blocked: retired rules are hidden on released orders.";
    const control = document.querySelector("[data-disabled-reason]");
    expect(control?.getAttribute("data-disabled-reason")).toBe(reason);
    /*
     * `title` sits on the `BlockedHint` WRAPPER, not on the control: react-aria
     * strips `title` in `filterDOMProps`, so the hint is a `display:contents`
     * span around it. Asserted where it actually lives — the point of rule 9 is
     * that the sentence is REACHABLE by pointer, not which node holds it.
     */
    expect(control?.closest("[title]")?.getAttribute("title")).toBe(reason);
  },
};

/** Blocked while ON, which is the state a naive disabled boolean loses. */
export const BlockedWhileOn: Story = {
  args: {
    defaultSelected: true,
    disabledBecause: "Blocked: retired rules are hidden on released orders.",
  },
};

/**
 * NO CHORD SCOPE, deliberately. `focusRoles.ts` lists `checkbox` and `switch`
 * as single controls whose keys are their own, and react-aria renders a
 * ToggleButton as a real `<button>` — which `focusOwnsKeys` already catches on
 * tagName. Marking a permanently-mounted control `own` would kill every chord
 * in the app; the GROUP is the thing that needs a `widget` mark, because
 * roving arrow-key focus makes it a composite.
 */
export const TakesNoChordScope: Story = {
  play: async () => {
    expect(document.querySelector("[data-chord-scope]")).toBe(null);
  },
};

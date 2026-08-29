import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import {
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbTrail,
} from "./breadcrumb";
import { onPanel } from "./kitGround";

/**
 * THE TOP-BAR CHIP. Every depth the app actually reaches, plus the two
 * assertions that keep the last crumb honest.
 */
const meta = {
  title: "ui/Breadcrumb",
  decorators: [onPanel],
  component: BreadcrumbTrail,
  args: { label: "Order location" },
} satisfies Meta<typeof BreadcrumbTrail<object>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One crumb. No separator is drawn, because there is nothing after it. */
export const Single: Story = {
  render: () => (
    <BreadcrumbTrail label="Order location">
      <BreadcrumbItem>
        <BreadcrumbCurrent>The shop</BreadcrumbCurrent>
      </BreadcrumbItem>
    </BreadcrumbTrail>
  ),
};

/** Two — the queue and the order it served. */
export const TwoLevels: Story = {
  render: () => (
    <BreadcrumbTrail label="Order location">
      <BreadcrumbItem>
        <BreadcrumbLink href="/queue">Queue</BreadcrumbLink>
        <BreadcrumbSeparator />
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbCurrent>TX-2291-004</BreadcrumbCurrent>
      </BreadcrumbItem>
    </BreadcrumbTrail>
  ),
};

/** Three — the deepest the design goes: shop, order, field. */
export const ThreeLevels: Story = {
  render: () => (
    <BreadcrumbTrail label="Order location">
      <BreadcrumbItem>
        <BreadcrumbLink href="/">The shop</BreadcrumbLink>
        <BreadcrumbSeparator />
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbLink href="/orders/tx-2291-004">TX-2291-004</BreadcrumbLink>
        <BreadcrumbSeparator />
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbCurrent>Vesting</BreadcrumbCurrent>
      </BreadcrumbItem>
    </BreadcrumbTrail>
  ),
};

/** A LONG CRUMB TRUNCATES RATHER THAN WRAPPING THE BAR. The top chrome is a
    fixed-height strip (INVARIANTS:62 — the order strip stays put), so a legal
    description growing the trail would shove the strip's contents around. */
export const LongCrumbTruncates: Story = {
  render: () => (
    <div className="w-140">
      <BreadcrumbTrail label="Order location">
        <BreadcrumbItem>
          <BreadcrumbLink href="/queue">Queue</BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbCurrent>
            Lot 14, Block C, Westfield Meadows Section Three, Harris County
          </BreadcrumbCurrent>
        </BreadcrumbItem>
      </BreadcrumbTrail>
    </div>
  ),
};

/** THE CURRENT CRUMB IS NOT A LINK, AND THIS ASSERTION KEEPS IT SO. The
    registry drew `role="link" aria-disabled="true"` on the place you already
    are — a control announced as activatable that activates nothing. */
export const CurrentIsNotALink: Story = {
  render: () => (
    <BreadcrumbTrail label="Order location">
      <BreadcrumbItem>
        <BreadcrumbLink href="/queue">Queue</BreadcrumbLink>
        <BreadcrumbSeparator />
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbCurrent>TX-2291-004</BreadcrumbCurrent>
      </BreadcrumbItem>
    </BreadcrumbTrail>
  ),
  play: ({ canvasElement }) => {
    const current = canvasElement.querySelector('[data-slot="breadcrumb-current"]');
    expect(current?.getAttribute("aria-current")).toBe("page");
    expect(current?.getAttribute("role")).toBeNull();
    expect(current?.getAttribute("aria-disabled")).toBeNull();
    /*
     * EXACTLY ONE LANDMARK, AND THIS ASSERTION IS WHY THERE IS ONE AT ALL. The
     * `<nav>` was deleted on the assumption that react-aria renders its own.
     * It does not: 3.51 renders a bare `<ol>` carrying an `aria-label`, and an
     * `<ol>` has no role — so the trail silently left the landmark list and a
     * screen-reader user could no longer jump to it. This story failing is how
     * that was found.
     */
    const nav = canvasElement.querySelectorAll("nav");
    expect(nav).toHaveLength(1);
    expect(nav[0]?.getAttribute("aria-label")).toBe("Order location");
  },
};

/**
 * THE SEPARATOR IS PUNCTUATION, NOT AN ICON. Rule 7 closes the glyph
 * vocabulary to ✓ ◆ • T1 and bans icon soup; the registry drew a lucide
 * `ChevronRightIcon`, which is a picture of a character every font ships.
 */
export const SeparatorIsAGlyph: Story = {
  render: () => (
    <BreadcrumbTrail label="Order location">
      <BreadcrumbItem>
        <BreadcrumbLink href="/queue">Queue</BreadcrumbLink>
        <BreadcrumbSeparator />
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbCurrent>TX-2291-004</BreadcrumbCurrent>
      </BreadcrumbItem>
    </BreadcrumbTrail>
  ),
  play: ({ canvasElement }) => {
    const seps = [...canvasElement.querySelectorAll('[data-slot="breadcrumb-separator"]')];
    expect(seps.map((n) => n.textContent)).toEqual(["/"]);
    expect(canvasElement.querySelectorAll("svg")).toHaveLength(0);
  },
};

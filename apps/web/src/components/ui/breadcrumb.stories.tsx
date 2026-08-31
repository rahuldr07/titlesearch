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

/** Every depth the app reaches, plus assertions that keep the last crumb honest. */
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

/** A long crumb truncates rather than wrapping: the top chrome is a
    fixed-height strip, and a legal description growing the trail would shove
    its contents around. */
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

/** The current crumb is not a link — never role="link" aria-disabled="true",
    which announces an activatable control that activates nothing. */
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
     * react-aria renders a bare <ol> with an aria-label and no landmark role,
     * so the <nav> wrapper is the only thing keeping the trail in the
     * landmark list.
     */
    const nav = canvasElement.querySelectorAll("nav");
    expect(nav).toHaveLength(1);
    expect(nav[0]?.getAttribute("aria-label")).toBe("Order location");
  },
};

/** The separator is punctuation, never an icon. */
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

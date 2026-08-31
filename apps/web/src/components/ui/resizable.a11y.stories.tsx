import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Split, SplitHandle, SplitPanel } from "./resizable";
import { DECISION_MAX, DECISION_MIN } from "./splitBand";
import { onPanel } from "./kitGround";
import { Frame, Decision, Evidence } from "./splitStoryData";

/**
 * The two things about the split that are invisible on screen: the WCAG 2.2
 * §2.5.7 keyboard alternative to dragging, and the chord scope mark.
 * resizable.stories.tsx is pictures of the geometry; this file is proofs.
 */
const meta = {
  title: "ui/Split/Accessibility",
  decorators: [onPanel],
  component: Split,
  args: { children: null },
} satisfies Meta<typeof Split>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The workstation, as every story below assembles it. */
function Workstation() {
  return (
    <Frame>
      <Split>
        <SplitPanel defaultSize="50" minSize={DECISION_MIN} maxSize={DECISION_MAX}><Decision /></SplitPanel>
        <SplitHandle label="Resize the decision column" />
        <SplitPanel><Evidence /></SplitPanel>
      </Split>
    </Frame>
  );
}

/** Every story below renders the same assembly; only the proof differs. */
const render = () => <Workstation />;

/** The handle is a named tab stop — without a label a keyboard user lands on
    an unnamed stop with no sign of arriving. */
export const HandleIsANamedTabStop: Story = {
  render,
  play: ({ canvasElement }) => {
    const handle = canvasElement.querySelector('[data-slot="split-handle"]');
    expect(handle?.getAttribute("role")).toBe("separator");
    expect(handle?.getAttribute("aria-label")).toBe("Resize the decision column");
    expect(handle?.getAttribute("tabindex")).toBe("0");
    // The ring comes from `styles.css`'s zero-specificity `:where(…,
    // [tabindex]):focus-visible` rule, so one `outline-none` utility here would
    // silently delete it. There must not be one.
    expect(handle?.className).not.toMatch(/\boutline-none\b/);
  },
};

/**
 * WCAG 2.2 §2.5.7 wants a single-pointer alternative to any drag;
 * react-resizable-panels ships one, so there must be no second handler (two
 * double-step every press). This check proves the library's alternative is
 * wired to our separator rather than merely present in the bundle.
 */
export const ResizesFromTheKeyboardWithoutADrag: Story = {
  render,
  play: async ({ canvasElement }) => {
    const handle = canvasElement.querySelector<HTMLElement>('[data-slot="split-handle"]');
    const left = canvasElement.querySelector<HTMLElement>("[data-panel]");
    if (handle === null || left === null) throw new Error("split did not render");
    const before = left.getBoundingClientRect().width;

    handle.focus();
    expect(document.activeElement).toBe(handle);
    await userEvent.keyboard("{ArrowRight}");
    // 5% per press, and no pointer was involved at any point.
    const wider = left.getBoundingClientRect().width;
    expect(wider).toBeGreaterThan(before);

    await userEvent.keyboard("{ArrowLeft}");
    expect(left.getBoundingClientRect().width).toBeLessThan(wider);
  },
};

/**
 * The band is clamped, and Home/End land on it: `End` asks for +100% and the
 * solver clamps it to the panel's `maxSize`, so a keyboard user cannot reach
 * a layout a dragging user cannot.
 */
export const HomeAndEndLandOnTheDesignsBand: Story = {
  render,
  play: async ({ canvasElement }) => {
    const handle = canvasElement.querySelector<HTMLElement>('[data-slot="split-handle"]');
    const left = canvasElement.querySelector<HTMLElement>("[data-panel]");
    if (handle === null || left === null) throw new Error("no split");

    /*
     * The denominator is the panels, not the group: a panel percentage is of
     * the space available to panels — the group minus its separators.
     */
    const share = () => {
      const panels = [...canvasElement.querySelectorAll<HTMLElement>("[data-panel]")];
      const available = panels.reduce((sum, p) => sum + p.getBoundingClientRect().width, 0);
      return (left.getBoundingClientRect().width / available) * 100;
    };

    handle.focus();

    // 74%, not 100%: clamped to the design's ceiling. A band rather than an
    // equality — a percentage of a fractional pixel width is not an integer.
    await userEvent.keyboard("{End}");
    expect(share()).toBeGreaterThan(73);
    expect(share()).toBeLessThan(75);

    // …and 38%, not 0%.
    await userEvent.keyboard("{Home}");
    expect(share()).toBeGreaterThan(37);
    expect(share()).toBeLessThan(39);
  },
};

/**
 * The chord mark is `widget`, and it is on the handle: `own` is read
 * document-wide, so a permanently-mounted element carrying it kills every
 * chord in the app. It rides the separator because focusOwnsKeys matches
 * with closest() — on the group it would stand the chords down whenever
 * focus was in either panel, field rows included.
 */
export const HandleOwnsItsKeysWithoutKillingTheChords: Story = {
  render,
  play: ({ canvasElement }) => {
    const handle = canvasElement.querySelector('[data-slot="split-handle"]');
    expect(handle?.getAttribute("data-chord-scope")).toBe("widget");
    expect(canvasElement.querySelectorAll('[data-chord-scope="own"]')).toHaveLength(0);
    const group = canvasElement.querySelector('[data-slot="split"]');
    expect(group?.getAttribute("data-chord-scope")).toBeNull();
  },
};

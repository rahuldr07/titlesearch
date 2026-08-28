import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
import { Split, SplitHandle, SplitPanel } from "./resizable";
import { DECISION_MAX, DECISION_MIN } from "./splitBand";
import { onPanel } from "./kitGround";
import { Frame, Decision, Evidence } from "./splitStoryData";

/**
 * THE TWO THINGS ABOUT THE SPLIT THAT ARE INVISIBLE ON SCREEN: the WCAG 2.2
 * §2.5.7 keyboard alternative to dragging, and the chord scope mark. A drag
 * divider is the only control here with a dragging movement, and it is
 * permanently mounted and eats the arrow keys, so it must negotiate with the
 * chord layer. Neither shows in the gallery, so both are assertions. Split
 * from `resizable.stories.tsx` on the 150-line gate: that file is pictures of
 * the geometry, this one is proofs.
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

/** THE HANDLE IS A NAMED TAB STOP. The registry gave neither: `ring-ring` is
    not a token here so the ring resolved to nothing, and with no `aria-label`
    a keyboard user landed on an unnamed stop with no sign of arriving. */
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
 * WCAG 2.2 §2.5.7 (DRAGGING MOVEMENTS), AS AN ASSERTION. The criterion wants a
 * single-pointer alternative to any drag; react-resizable-panels 4.12.3 ships
 * one, which is why the hand-rolled arrow handler was deleted (see
 * `resizable.tsx`) — two handlers double-step every press. THIS is therefore
 * the load-bearing check: it proves the library's alternative is wired to OUR
 * separator rather than merely present in the bundle. The failure a wrapper
 * introduces is the listener landing on a div that never takes focus.
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
    // 5% per press, and no pointer was involved at any point. That is the
    // §2.5.7 alternative, demonstrated rather than asserted in a comment.
    const wider = left.getBoundingClientRect().width;
    expect(wider).toBeGreaterThan(before);

    await userEvent.keyboard("{ArrowLeft}");
    expect(left.getBoundingClientRect().width).toBeLessThan(wider);
  },
};

/**
 * THE BAND IS CLAMPED, AND HOME/END LAND ON IT. Design README §7 says 38–74%.
 * `End` asks for +100% and the solver clamps it to the panel's `maxSize`, so
 * the ceiling is the design's rather than the browser's and a keyboard user
 * cannot reach a layout a dragging user cannot. Rule 11 as behaviour.
 */
export const HomeAndEndLandOnTheDesignsBand: Story = {
  render,
  play: async ({ canvasElement }) => {
    const handle = canvasElement.querySelector<HTMLElement>('[data-slot="split-handle"]');
    const left = canvasElement.querySelector<HTMLElement>("[data-panel]");
    if (handle === null || left === null) throw new Error("no split");

    /*
     * THE DENOMINATOR IS THE PANELS, NOT THE GROUP, and getting that wrong is
     * how this assertion failed first time. A panel percentage is of the space
     * AVAILABLE TO PANELS — the group minus its separators. Probed: a 638px
     * group with a 24px handle puts `End` at 454.4px, which is 71.2% of the
     * group and 74.0% of the 614px the panels share. 74 is the design's number.
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
 * THE CHORD MARK IS `widget`, AND IT IS ON THE HANDLE. `focusRoles.ts` records
 * both halves as near-misses: `own` is read DOCUMENT-WIDE by `overlayIsUp()`,
 * so a permanently-mounted element carrying it kills every chord in the app,
 * and this split is always on screen. The mark rides the SEPARATOR because
 * `focusOwnsKeys` matches with `closest()` — on the group it would stand the
 * chords down whenever focus was in either panel, field rows included.
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

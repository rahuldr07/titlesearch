import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ScrollArea } from "./scroll-area";
import { onPanel } from "./kitGround";

/**
 * THE PANE. Every story here is a FIXED-HEIGHT box, because that is the only
 * arrangement in which this component means anything — the frame is one
 * viewport tall (styles.css) and a pane is what scrolls inside it.
 */
const meta = {
  title: "ui/ScrollArea",
  decorators: [onPanel],
  component: ScrollArea,
  args: { label: "Field rows", children: null },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = Array.from({ length: 24 }, (_unused, i) => ({
  ref: `2024-04481${String(i).padStart(2, "0")}`,
  label: `Instrument ${i + 1}`,
}));

/** The default: vertical only, inside a 240px box. */
export const Vertical: Story = {
  render: () => (
    <div className="flex h-120 w-160 flex-col rounded-md border border-line-strong">
      <ScrollArea label="Field rows">
        {rows.map((row) => (
          <div
            key={row.ref}
            className="flex items-baseline justify-between border-b border-line-subtle px-6 py-5"
          >
            <span className="font-sans text-meta leading-close text-ink-primary">
              {row.label}
            </span>
            <span className="font-mono text-label leading-flat text-ink-muted">{row.ref}</span>
          </div>
        ))}
      </ScrollArea>
    </div>
  ),
};

/** Content that fits. No scrollbar, and the region is still a named tab stop. */
export const NoOverflow: Story = {
  render: () => (
    <div className="flex h-120 w-160 flex-col rounded-md border border-line-strong">
      <ScrollArea label="Field rows">
        {rows.slice(0, 3).map((row) => (
          <div key={row.ref} className="px-6 py-5 font-sans text-meta leading-close">
            {row.label}
          </div>
        ))}
      </ScrollArea>
    </div>
  ),
};

/**
 * BOTH AXES — the evidence sheet at 200%, which is wider than its column. The
 * only place `axis="both"` is legal: `INVARIANTS:65` says the PAGE never
 * scrolls sideways, and this is a pane, not the page.
 */
export const BothAxes: Story = {
  render: () => (
    <div className="flex h-120 w-160 flex-col rounded-md border border-line-strong">
      <ScrollArea label="Evidence sheet" axis="both">
        <div className="w-320 bg-surface-paper p-8 font-serif leading-document text-page-ink">
          {rows.map((row) => (
            <p key={row.ref} className="whitespace-nowrap">
              {row.label} — conveyed by warranty deed recorded at {row.ref}, Harris County
            </p>
          ))}
        </div>
      </ScrollArea>
    </div>
  ),
};

/**
 * THE `min-h-0` PAIR, MEASURED. This is the whole component and it is invisible
 * on screen: a flex child's default `min-height:auto` means "at least my
 * content", so without it the pane GROWS past its parent instead of scrolling,
 * the frame overflows a body with `overflow:hidden`, and everything below the
 * fold becomes unreachable. Asserted by measurement, not by class name.
 */
export const StaysInsideItsFlexParent: Story = {
  render: () => (
    <div className="flex h-120 w-160 flex-col rounded-md border border-line-strong">
      <ScrollArea label="Field rows">
        {rows.map((row) => (
          <div key={row.ref} className="px-6 py-5 font-sans text-meta leading-close">
            {row.label}
          </div>
        ))}
      </ScrollArea>
    </div>
  ),
  play: ({ canvasElement }) => {
    const pane = canvasElement.querySelector('[data-slot="scroll-area"]');
    if (pane === null) throw new Error("pane did not render");
    const box = pane.parentElement;
    if (box === null) throw new Error("pane has no parent");

    /*
     * MEASURED AGAINST THE PARENT'S CONTENT BOX, NOT AGAINST 240. The first
     * version asserted `clientHeight === 240` and got 238: the wrapper is
     * `h-120` with a 1px border and preflight sets `box-sizing: border-box`, so
     * 2px of that height is border. The literal would have pinned the story's
     * own decoration rather than the component.
     */
    expect(pane.clientHeight).toBe(box.clientHeight);
    // …and the content is genuinely taller, so this is a real scroll rather
    // than a pane that happened to fit.
    expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight);
  },
};

/**
 * A SCROLLABLE REGION IS A NAMED, KEYBOARD-REACHABLE LANDMARK (WCAG 2.1
 * §2.1.1). The registry shipped an unnamed `<div>` with `outline-none` and no
 * `tabIndex` — in Safari and Firefox, unscrollable from the keyboard at all.
 */
export const IsAKeyboardReachableRegion: Story = {
  render: () => (
    <div className="flex h-120 w-160 flex-col rounded-md border border-line-strong">
      <ScrollArea label="Field rows">
        {rows.map((row) => (
          <div key={row.ref} className="px-6 py-5 font-sans text-meta leading-close">
            {row.label}
          </div>
        ))}
      </ScrollArea>
    </div>
  ),
  play: ({ canvasElement }) => {
    const pane = canvasElement.querySelector('[data-slot="scroll-area"]');
    expect(pane?.getAttribute("role")).toBe("region");
    expect(pane?.getAttribute("aria-label")).toBe("Field rows");
    expect(pane?.getAttribute("tabindex")).toBe("0");
    // The ring survives: `styles.css` draws it from a zero-specificity
    // `:where(…, [tabindex]):focus-visible` rule, so a single `outline-none`
    // utility here would delete it. There must not be one.
    expect(pane?.className).not.toMatch(/\boutline-none\b/);
  },
};

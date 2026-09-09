import { useEffect, useRef } from "react";
import type { LineCoords } from "@titlepipe/contract";

/**
 * The provenance box — a rectangle over the region the engine read the
 * value out of, on the page it read it from.
 *
 * An SVG because the geometry arrives at runtime as four fractions and the
 * style rules forbid inline styles and arbitrary Tailwind lengths; SVG
 * geometry is attributes, not CSS. The viewBox is the unit square scaled by
 * 1000; `preserveAspectRatio="none"` stretches it to the box it is hung in,
 * and `vector-effect` keeps the stroke from stretching with it.
 *
 * It must be hung on the line block — the caller owes it a positioned
 * ancestor over exactly the typeset lines, or the square covers padding and
 * chrome and lands above where it belongs. The mapping is approximate by
 * construction: `LineCoords` is normalized against the scanned page while
 * this pane renders text, so the box marks the region; it is not a
 * measurement, and nothing downstream reads a number back off it.
 *
 * It adds no caption. A "Dual-Engine Match" pill would be a claim the wire
 * does not support — `LineCoords` carries one engine's position. What the
 * box marks is said in words below the sheet.
 *
 * OUTLINE, NOT A WASH. It used to paint the region with `fill-action/20`,
 * which on a rendered raster covers the ink the reviewer is being asked to
 * check — and a region is not always a line: a value found by reading down
 * a whole judgment index cites the union of every block that fed it, which
 * measured 62% of p69 on the Lincoln County package. A tinted rectangle over
 * two thirds of a scanned page hides the evidence and marks nothing.
 *
 * AND THE OUTLINE IS DRAWN OUTSIDE THE REGION. An SVG stroke is centred on
 * its path, so a rectangle drawn ON a reader's box paints half its width
 * into the box. A reader's box is tight to the glyphs — the p26 order number
 * is 13 of 1000 units tall, about 8 device pixels at sheet scale — so a 2.5px
 * stroke plus a 5px casing put 7.5px of paint over an 8px line and struck out
 * the text the mark exists to point at. The rect is inflated by `PAD` first,
 * and the halo is a drop-shadow (`tp-cite-mark`), which renders outside the
 * stroke and never inside it. The margin is in page units, so it stays
 * proportional at every zoom, and it is a MARGIN, not a measurement: the
 * comment above already holds — nothing downstream reads a number off this.
 */
const SCALE = 1000;

/**
 * The clearance between the reader's box and the mark, in page units.
 *
 * MEASURED, not picked. On p26 of the Lincoln County package the line pitch
 * is ~11px at sheet scale and a line's glyphs are ~8.5px of it, so two lines
 * leave a gutter of about 2.5px — and a reader's box is not exactly the glyph
 * box: it can sit a pixel or two proud of the ink it covers. At 3 units the
 * stroke landed on the tops of the very characters it marks. 6 clears them,
 * at the cost of grazing the line above on the tightest single-line boxes,
 * which is the right way round: the marked line is the one being read.
 */
const PAD = 6;

export function CitedRegion(props: { readonly box: LineCoords }) {
  const box = props.box;
  const mark = useRef<SVGRectElement>(null);

  /*
   * A region below the fold is a region nobody sees: `nearest` scrolls the
   * least that will do, and the jump is instant rather than animated. The
   * ref is on the rect, not the svg — the svg is full-bleed over the line
   * block, so scrolling it into view aligns the top of the whole page and
   * can leave the region just as far off screen.
   */
  useEffect(() => {
    mark.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [box.page, box.x, box.y, box.w, box.h]);

  return (
    <svg
      data-testid="cited-region"
      data-region-page={box.page}
      viewBox={`0 0 ${SCALE} ${SCALE}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <rect
        x={box.x * SCALE - PAD}
        y={box.y * SCALE - PAD}
        width={box.w * SCALE + PAD * 2}
        height={box.h * SCALE + PAD * 2}
        ref={mark}
        rx="4"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2"
        className="tp-cite-mark fill-none stroke-action"
      />
    </svg>
  );
}

/**
 * One line under the sheet saying what the box is, or that there is no box
 * and why. Every sentence is a statement about what the server sent, which
 * is the only thing this pane knows.
 */
export function CitedRegionNote(props: {
  readonly box: LineCoords | null;
  /** The previewed field's cited page — the hovered row, else the open one. */
  readonly citedPage: number | null;
  readonly shown: number;
  /** The zoom state — the note names the way back. */
  readonly zoomed: boolean;
}) {
  const text = props.zoomed
    ? "Zoomed to citation — Z or Esc to fit, double-click the page"
    : props.citedPage === null
      ? "Hover or focus any field on the left to mark where its value was read — a field whose reader recorded no page marks nothing."
      : props.box === null
        ? `That field cites p${props.citedPage}. The engine that read it recorded no coordinate, so the page is marked and no region is.`
        : props.box.page === props.shown
          ? `The box marks the region on p${props.box.page} the recorded reading was taken from.`
          : `The recorded region is on p${props.box.page}. This sheet is p${props.shown}.`;

  return (
    <p
      data-testid="cited-region-note"
      className="shrink-0 px-10 py-4 text-center text-label leading-body text-ink-secondary"
    >
      {text}
    </p>
  );
}

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
 */
const SCALE = 1000;

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
        x={box.x * SCALE}
        y={box.y * SCALE}
        width={box.w * SCALE}
        height={box.h * SCALE}
        ref={mark}
        rx="4"
        vectorEffect="non-scaling-stroke"
        strokeWidth="2"
        className="fill-action/20 stroke-action"
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

import { useEffect, useRef } from "react";
import type { LineCoords } from "@titlepipe/contract";

/**
 * INVARIANT 33, DRAWN: "provenance coordinates render as a pin on the source
 * page." The box is the design's `bbField` — a rectangle over the region the
 * engine read the value out of, on the page it read it from.
 *
 * IT IS AN SVG, AND THAT IS A RULES DECISION RATHER THAN A GRAPHICS ONE. The
 * geometry arrives at runtime as four fractions, and §6 forbids both an inline
 * `style` and an arbitrary Tailwind length — so there is no way to put a
 * data-driven position on an HTML box. SVG geometry is attributes, not CSS: `x`
 * and `width` take the numbers directly, colour still comes from a token class,
 * and no length ever enters a class name.
 *
 * `viewBox` IS THE UNIT SQUARE, SCALED BY 1000 so a fraction lands on a whole
 * number rather than on a decimal that reads as a mistake.
 * `preserveAspectRatio="none"` stretches the square to whatever box it is hung
 * in; `vector-effect` keeps the stroke from stretching with it.
 *
 * IT MUST BE HUNG ON THE LINE BLOCK, AND THE CALLER OWES IT THAT. The parent
 * has to be the positioned ancestor — `PageBody` makes `scan-lines` relative
 * for exactly this. Hung on `PaperSheet` instead the square covered the warm
 * stock's padding, the clerk stamp and the citation pin as well, and every
 * region drew a line and a half above where it belonged.
 *
 * AND THE MAPPING IS APPROXIMATE BY CONSTRUCTION. `LineCoords` is normalized
 * against the SCANNED page; this pane renders that page as TEXT, not as the
 * raster (`endpoints.ts`: "A page carries the lines that were read off it, not
 * a raster"). So the square lands on our typesetting of those lines, which
 * wraps where the scan did not. The box marks the region; it is not a
 * measurement of it, and nothing downstream reads a number back off it.
 *
 * IT ADDS NO CAPTION. The design's pill over the box reads "Dual-Engine Match",
 * which is a claim that two engines agreed — `LineCoords` carries one engine's
 * position and says nothing about a second. Printing it would be an emitted
 * value with no citation. What the box marks is said in words below the sheet,
 * where `CitedRegionNote` can say only what the wire supports.
 */
const SCALE = 1000;

export function CitedRegion(props: { readonly box: LineCoords }) {
  const box = props.box;
  const mark = useRef<SVGRectElement>(null);

  /*
   * A REGION BELOW THE FOLD IS A REGION NOBODY SEES. A long page overflows the
   * sheet's scroller, and selecting a field that cites its foot drew the box
   * 735px under the visible edge with nothing saying so. `nearest` moves the
   * least that will do, and the jump is instant rather than animated — rule 10
   * ("nothing bounces") and §2.3.3 both, without a media query to remember.
   *
   * THE REF IS ON THE RECT, NOT ON THE SVG. The svg is full-bleed over the line
   * block, so scrolling IT into view aligns the top of the whole page — which
   * on a page taller than the scroller leaves the region exactly as far off
   * screen as before. The rect is the region; it is the thing to bring up.
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
 * The design's `bbNote` — one line under the sheet saying what the box is, or
 * that there is no box and why. All three sentences are statements about what
 * the SERVER sent, which is the only thing this pane knows.
 */
export function CitedRegionNote(props: {
  readonly box: LineCoords | null;
  /** The cited page, when a field with provenance is open. */
  readonly citedPage: number | null;
  readonly shown: number;
}) {
  const text =
    props.citedPage === null
      ? "Choose a field on the left to mark where its value was read."
      : props.box === null
        ? `The open field cites p${props.citedPage}. The engine that read it recorded no coordinate, so the page is marked and no region is.`
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

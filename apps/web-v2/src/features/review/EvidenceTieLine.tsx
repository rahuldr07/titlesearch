import { useTieGeometry } from "./useTieGeometry";

/**
 * THE LINE FROM THE ROW YOU ARE DECIDING TO THE LINE IT WAS READ FROM.
 *
 * WHY. On a dense deed with four marks near each other, hunting for the amber
 * box on every selection is when a value gets confirmed against the wrong line.
 * This is the cheapest statement of "THIS row, THAT line". It is DECORATION
 * over a citation already in text (`PageChip`, the row's page ref):
 * `aria-hidden`, adds no fact, and every branch degrades to drawing NOTHING
 * rather than to a guess.
 *
 * IT DOES NOT POLL — see `useTieGeometry` for what it listens to instead.
 *
 * ENDPOINTS BY ID, AND THE IDS ARE THE CALLER'S — neither end belongs here.
 * That is also why `EvidenceOverlay` takes its anchor id as a PROP instead of
 * stamping one on every instance, which would put one DOM id on the gallery's
 * four overlays. Viewport coordinates need no scroll arithmetic, so a fixed SVG
 * cannot drift out of register with what it points at.
 */
export function EvidenceTieLine({
  fromId,
  toId,
}: {
  /** The selected draft row. */
  fromId: string;
  /** The highlight on the page raster. */
  toId: string;
}) {
  const tie = useTieGeometry(fromId, toId);

  if (tie === null) return null;

  /*
   * A CUBIC WITH HORIZONTAL HANDLES, so the curve leaves the row and enters the
   * highlight travelling sideways — the direction the eye is already moving
   * between two columns. The handle length is half the horizontal gap, floored
   * so a short span still bows instead of collapsing to a straight diagonal
   * that reads as a table rule.
   */
  const reach = Math.max(Math.abs(tie.x2 - tie.x1) / 2, 40);
  const path = `M ${tie.x1} ${tie.y1} C ${tie.x1 + reach} ${tie.y1}, ${tie.x2 - reach} ${tie.y2}, ${tie.x2} ${tie.y2}`;

  return (
    <svg
      aria-hidden
      data-testid="evidence-tie"
      className="pointer-events-none fixed inset-0 z-20 h-full w-full overflow-visible"
    >
      {/*
        DASHED, HAIRLINE, IN THE PAGE-REF FAMILY. It is the same relationship
        `PageChip` states in words, so it takes that token rather than
        introducing a second "this came from there" colour. Dashed because it is
        a pointer, not a boundary: a solid rule of this length across a working
        surface reads as structure, and this is the one mark on the screen that
        must never be mistaken for part of either document.
      */}
      <path
        d={path}
        fill="none"
        strokeWidth="1"
        strokeDasharray="3 4"
        strokeLinecap="round"
        className="stroke-page-ref"
      />
      <circle cx={tie.x2} cy={tie.y2} r="3" className="fill-page-ref" />
    </svg>
  );
}

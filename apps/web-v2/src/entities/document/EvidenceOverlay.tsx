import type { CSSProperties } from "react";
import type { EvidenceBox } from "./coordinates";

/**
 * The ONLY inline styles in the app. These four values are per-box geometry
 * computed from SERVER coordinates — they cannot be class names, and §6's ban
 * exists to stop styling decisions hiding in markup, not to forbid computed
 * geometry. A helper rather than an object literal in the JSX so the one
 * exempted `style=` sits on a single line the gate can read.
 */
const boxGeometry = (box: EvidenceBox): CSSProperties => ({
  left: `${box.x * 100}%`,
  top: `${box.y * 100}%`,
  width: `${box.width * 100}%`,
  height: `${box.height * 100}%`,
});

/**
 * The highlight drawn over the cited line on a page raster.
 *
 * Positioned in PERCENTAGES inside the same zoom/pan transform as the image, so
 * the boxes track the page at every scale with no arithmetic. There is no
 * `scale` prop here on purpose — an overlay that recomputes pixel offsets from
 * the current zoom is the classic way to get highlights that drift.
 *
 * THE SCAN READS THROUGH THE HIGHLIGHT, and the alpha alone is what does it.
 * An opaque box would hide the very text it is pointing at, which on a poor
 * scan is the difference between confirming a value and guessing it —
 * `--color-surface-evidence` is therefore 45% amber, and 45% of anything lets
 * the text beneath it through.
 *
 * IT USED TO ALSO CARRY `mix-blend-multiply`, and that was a ground-dependent
 * bet. Multiply darkens the mark by whatever is under it, so on a dark ground
 * the product goes near-black: the single most load-bearing mark in the
 * product — the one that says THIS is the line the value came from — rendered
 * as a redaction bar. The page is pinned light now, so multiply would happen to
 * be safe, but a mark whose legibility depends on its backdrop is a trap left
 * armed for the next surface anyone paints. Alpha compositing is
 * ground-independent: the mark is never less than its own colour at 45%,
 * whatever sits beneath it.
 *
 * The overlay is DECORATIVE and `aria-hidden`. The citation itself lives in
 * text next to the value (`FieldValue` + `PageChip`), because a highlight has
 * no meaning to a screen reader and duplicating it as an ARIA label would just
 * announce a rectangle.
 *
 * Rendering nothing when there are no boxes is the contract, not an edge case:
 * an engine that declared no coordinates must get a snippet, never a box.
 *
 * `anchorId` IS THE CALLER'S, AND ONLY THE FIRST BOX TAKES IT. Something on the
 * screen may want to point AT this mark — the draft's tie line does — and it
 * needs a stable element to find. A DOM id must be unique in the document, so
 * this component may not mint one for itself: the gallery renders four overlays
 * on one page and the stories render more, and every one of them would claim
 * the same id. The one surface that has exactly one overlay passes an id in;
 * everybody else passes nothing and gets no id at all.
 *
 * FIRST BOX, because a citation spanning three wrapped lines is ONE citation
 * and a pointer has one end. The first is the one the reader's eye reaches
 * first, top to bottom.
 */
export function EvidenceOverlay({
  boxes,
  anchorId,
}: {
  boxes: readonly EvidenceBox[];
  /** Stable id for the first box, so another surface can point at it. */
  anchorId?: string | undefined;
}) {
  if (boxes.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {boxes.map((box, index) => (
        <span
          key={`${box.x}:${box.y}:${box.width}:${box.height}`}
          id={index === 0 ? anchorId : undefined}
          className="absolute bg-surface-evidence border border-border-evidence rounded-1"
          style={boxGeometry(box)} // rules-allow: server-computed per-box geometry
        />
      ))}
    </div>
  );
}

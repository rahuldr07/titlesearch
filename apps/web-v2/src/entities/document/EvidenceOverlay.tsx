import type { EvidenceBox } from "./coordinates";

/**
 * The highlight drawn over the cited line on a page raster.
 *
 * Positioned in PERCENTAGES inside the same zoom/pan transform as the image, so
 * the boxes track the page at every scale with no arithmetic. There is no
 * `scale` prop here on purpose — an overlay that recomputes pixel offsets from
 * the current zoom is the classic way to get highlights that drift.
 *
 * `mix-blend-mode: multiply` lets the scan read THROUGH the highlight. An
 * opaque box would hide the very text it is pointing at, which on a poor scan
 * is the difference between confirming a value and guessing it.
 *
 * The overlay is DECORATIVE and `aria-hidden`. The citation itself lives in
 * text next to the value (`FieldValue` + `PageChip`), because a highlight has
 * no meaning to a screen reader and duplicating it as an ARIA label would just
 * announce a rectangle.
 *
 * Rendering nothing when there are no boxes is the contract, not an edge case:
 * an engine that declared no coordinates must get a snippet, never a box.
 */
export function EvidenceOverlay({ boxes }: { boxes: readonly EvidenceBox[] }) {
  if (boxes.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {boxes.map((box) => (
        <span
          key={`${box.x}:${box.y}:${box.width}:${box.height}`}
          className="absolute mix-blend-multiply bg-surface-evidence border border-border-evidence rounded-1"
          // The ONLY inline styles in the app. These four values are per-box
          // geometry computed from SERVER coordinates — they cannot be class
          // names, and §6's ban exists to stop styling decisions hiding in
          // markup, not to forbid computed geometry.
          style={{ /* rules-allow: server-computed per-box geometry */
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.width * 100}%`,
            height: `${box.height * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

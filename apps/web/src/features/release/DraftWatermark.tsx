/**
 * `seal_sha256` decides the watermark — not a local `isDraft` flag, and not
 * `releasable`, which says a release would be accepted rather than that one
 * happened. It is the same field the clerk stamp and `IntegritySeal` read, so
 * the three cannot disagree: a sheet is either watermarked or stamped, never
 * both and never neither. The design's other legends are absent — they need a
 * reissue flag and an audience the composition read does not carry.
 */
export function DraftWatermark() {
  return (
    <span
      data-testid="draft-watermark"
      className="pointer-events-none absolute inset-0 flex -rotate-12 items-center justify-center font-serif text-verdict leading-flat font-semibold tracking-caps uppercase select-none text-page-ink/10"
    >
      Draft — not released
    </span>
  );
}

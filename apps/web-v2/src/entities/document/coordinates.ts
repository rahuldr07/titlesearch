/**
 * THE ONE PLACE coordinates are interpreted. BRIEF §7 requires the mapping be
 * isolated in exactly one function, because the real payload shape lands with
 * the LLMWhisperer adapter and everything downstream must be insulated from it.
 *
 * Two rules this module enforces, and they are the whole point:
 *
 * 1. **Never a faked box.** An engine that declares no coordinates gets NO
 *    overlay and a text snippet instead. This is `leaderboard.spec` #2's
 *    declared-not-faked principle applied to the page: an approximate rectangle
 *    over a scan is worse than none, because a reviewer will trust it and check
 *    the wrong line. Anything unrecognised returns `null`, never a guess.
 *
 * 2. **Output is NORMALISED (0..1), never pixels.** The overlay renders inside
 *    the same zoom/pan transform as the page image, so percentage-positioned
 *    boxes track the page for free. Transforming coordinates by the current
 *    scale by hand is the classic source of overlays that drift as you zoom —
 *    there is no scale in this file at all.
 */

/** Normalised to the page box, origin top-left. The only shape components see. */
export interface EvidenceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Page dimensions in whatever unit the engine used. Both must be positive. */
export interface PageBox {
  width: number;
  height: number;
}

/**
 * What an engine emitted. Deliberately `unknown`: the real shape is not settled,
 * and typing it optimistically would let an unvalidated payload reach the DOM.
 */
export type LineCoords = unknown;

/**
 * Provisional reader for the shape currently observed: a list of
 * `[x0, y0, x1, y1]` quads in page units, origin top-left.
 *
 * Returns `null` — meaning "render the snippet, draw nothing" — for anything it
 * does not positively recognise. That is the safe direction: a missing overlay
 * is visibly missing, a wrong overlay is not.
 */
export function toEvidenceBoxes(coords: LineCoords, page: PageBox): EvidenceBox[] | null {
  if (!isPositiveSize(page)) return null;
  if (!Array.isArray(coords) || coords.length === 0) return null;

  const boxes: EvidenceBox[] = [];
  for (const quad of coords) {
    const box = toBox(quad, page);
    // One bad quad invalidates the set. A partial overlay silently implies the
    // missing lines were not cited, which is a different claim entirely.
    if (box === null) return null;
    boxes.push(box);
  }
  return boxes;
}

/**
 * The second shape observed on the wire: `{ page, x0, y0, x1, y1 }` objects,
 * already expressed as fractions of the page. Recognised here rather than
 * normalised at the call site — this module is THE one place coordinates are
 * interpreted, and a second reader elsewhere is how the two forms drift apart.
 *
 * Positively recognised or rejected, same as the quad form: an object missing
 * any edge returns null and draws nothing.
 */
function edgesOf(quad: unknown): [number, number, number, number] | null {
  if (Array.isArray(quad)) {
    if (quad.length !== 4) return null;
    const [x0, y0, x1, y1] = quad;
    return [x0, y0, x1, y1].every(isFiniteNumber) ? [x0, y0, x1, y1] : null;
  }
  if (typeof quad !== "object" || quad === null) return null;
  const box = quad as Record<string, unknown>;
  const { x0, y0, x1, y1 } = box;
  if (!isFiniteNumber(x0) || !isFiniteNumber(y0)) return null;
  if (!isFiniteNumber(x1) || !isFiniteNumber(y1)) return null;
  return [x0, y0, x1, y1];
}

function toBox(quad: unknown, page: PageBox): EvidenceBox | null {
  const edges = edgesOf(quad);
  if (edges === null) return null;
  const [x0, y0, x1, y1] = edges;

  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);

  /*
   * A box too small to see is as much a lie as a zero-area one — the test that
   * claimed "an invisible highlight is a lie" only guarded EXACTLY zero, so a
   * 0.3pt highlight on a 612pt page was accepted and drew nothing.
   * 0.1% of the page is ~0.6pt wide, well under a text line (~10pt) and well
   * over a rounding artefact.
   */
  const MIN_VISIBLE = 0.001;
  if (width / page.width < MIN_VISIBLE || height / page.height < MIN_VISIBLE) return null;
  // Out-of-bounds means we have misread the payload; refuse the whole set.
  if (left < 0 || top < 0 || left + width > page.width || top + height > page.height) {
    return null;
  }

  return {
    x: left / page.width,
    y: top / page.height,
    width: width / page.width,
    height: height / page.height,
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isPositiveSize(page: PageBox): boolean {
  return (
    isFiniteNumber(page.width) &&
    isFiniteNumber(page.height) &&
    page.width > 0 &&
    page.height > 0
  );
}

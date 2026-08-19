import { describe, expect, test } from "vitest";
import { toEvidenceBoxes } from "./coordinates";

const PAGE = { width: 612, height: 792 };

describe("normalises recognised coordinates", () => {
  test("a single quad becomes a 0..1 box", () => {
    const boxes = toEvidenceBoxes([[61.2, 79.2, 306, 158.4]], PAGE);
    expect(boxes).toEqual([{ x: 0.1, y: 0.1, width: 0.4, height: 0.1 }]);
  });

  test("reversed quads are normalised, not rejected", () => {
    // x1 < x0 is a legitimate encoding of the same rectangle.
    const a = toEvidenceBoxes([[306, 158.4, 61.2, 79.2]], PAGE);
    const b = toEvidenceBoxes([[61.2, 79.2, 306, 158.4]], PAGE);
    expect(a).toEqual(b);
  });

  test("multiple lines all map", () => {
    const boxes = toEvidenceBoxes(
      [[0, 0, 612, 79.2], [0, 79.2, 612, 158.4]],
      PAGE,
    );
    expect(boxes).toHaveLength(2);
    expect(boxes?.[0]?.width).toBe(1);
  });
});

/**
 * The declared-not-faked principle (`leaderboard.spec` #2) applied to the page.
 * An approximate box over a scan is worse than none: a reviewer trusts it and
 * checks the wrong line. Every unrecognised input must produce `null`, which
 * the pane renders as "no overlay, show the snippet".
 */
describe("never a faked box", () => {
  test("no coordinates means no overlay", () => {
    for (const nothing of [null, undefined, [], {}, "", 0, "12,14,20,22"]) {
      expect(toEvidenceBoxes(nothing, PAGE)).toBeNull();
    }
  });

  test("malformed quads are refused, not repaired", () => {
    for (const bad of [
      [[1, 2, 3]], [[1, 2, 3, 4, 5]], [["a", 2, 3, 4]],
      [[Number.NaN, 0, 10, 10]], [[0, 0, Infinity, 10]], [[null, 0, 10, 10]],
    ]) {
      expect(toEvidenceBoxes(bad, PAGE)).toBeNull();
    }
  });

  test("a zero-area box is refused — an invisible highlight is a lie", () => {
    expect(toEvidenceBoxes([[10, 10, 10, 50]], PAGE)).toBeNull();
    expect(toEvidenceBoxes([[10, 10, 50, 10]], PAGE)).toBeNull();
  });

  test("out-of-bounds means we misread the payload — refuse the whole set", () => {
    expect(toEvidenceBoxes([[0, 0, 613, 100]], PAGE)).toBeNull();
    expect(toEvidenceBoxes([[-1, 0, 100, 100]], PAGE)).toBeNull();
    expect(toEvidenceBoxes([[0, 0, 100, 793]], PAGE)).toBeNull();
    // Negative Y was untested while negative X was — dropping the `top < 0`
    // check (mutation M3) drew a box above the top of the page undetected.
    expect(toEvidenceBoxes([[0, -100, 100, 50]], PAGE)).toBeNull();
    expect(toEvidenceBoxes([[0, -1, 100, 100]], PAGE)).toBeNull();
  });

  test("a box too small to SEE is refused, not just one of exactly zero area", () => {
    // The test named "an invisible highlight is a lie" guarded only exact zero,
    // so a 0.3pt highlight on a 612pt page was accepted and drew nothing.
    expect(toEvidenceBoxes([[611.7, 0, 612, 100]], PAGE)).toBeNull();
    expect(toEvidenceBoxes([[0, 791.7, 100, 792]], PAGE)).toBeNull();
    // A real text line is ~10pt and must still pass.
    expect(toEvidenceBoxes([[60, 100, 300, 110]], PAGE)).not.toBeNull();
  });

  test("ONE bad line invalidates the set, never a partial overlay", () => {
    // A partial overlay silently implies the missing lines were not cited.
    const mixed = [[0, 0, 100, 50], [1, 2, 3]];
    expect(toEvidenceBoxes(mixed, PAGE)).toBeNull();
  });

  test("a nonsense page box yields no overlay", () => {
    const quad = [[0, 0, 100, 50]];
    for (const page of [
      { width: 0, height: 792 }, { width: 612, height: 0 },
      { width: -612, height: 792 }, { width: Number.NaN, height: 792 },
    ]) {
      expect(toEvidenceBoxes(quad, page)).toBeNull();
    }
  });
});

describe("output carries no scale", () => {
  test("boxes are page-relative, so zoom cannot desynchronise them", () => {
    const boxes = toEvidenceBoxes([[153, 198, 459, 396]], PAGE);
    // Asserted before iterating: `for (const b of boxes ?? [])` passed
    // vacuously if the function ever regressed to returning null.
    expect(boxes).not.toBeNull();
    expect(boxes).toHaveLength(1);
    for (const b of boxes ?? []) {
      for (const n of [b.x, b.y, b.width, b.height]) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  test("the same quad on a larger page normalises identically", () => {
    // Same proportions at 2x raster resolution must give the same box.
    const small = toEvidenceBoxes([[61.2, 79.2, 306, 158.4]], PAGE);
    const large = toEvidenceBoxes([[122.4, 158.4, 612, 316.8]], {
      width: 1224,
      height: 1584,
    });
    expect(small).toEqual(large);
  });
});

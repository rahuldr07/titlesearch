import { describe, expect, test } from "vitest";
import { NARROW_QUERY } from "./useNarrowViewport";

/**
 * The export wraps the board in `overflow-x:auto` with `min-width:1190px`. We
 * squeeze instead of scrolling — a scrollbar with no affordance hid Escalated
 * and Delivered entirely (HANDOFF-UI §6) — but the old 900px threshold left the
 * 900–1190px band drawing seven columns below their drawn minimum. The rail is
 * the better read there, so the board is now only ever drawn at its width.
 *
 * Asserted as a CONSTANT rather than through a rendered viewport because the
 * failure this catches is a number, and a jsdom viewport test would pass with
 * the threshold set anywhere at all.
 */
describe("the board's rail threshold", () => {
  test("forces the rail below the export's own 1190px minimum", () => {
    expect(NARROW_QUERY).toBe("(max-width: 1189px)");
  });
});

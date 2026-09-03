import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CorrectFieldRequest } from "@titlepipe/contract";
import { expect, test } from "vitest";

/**
 * The tripwire on the build-phase `reason` relaxation.
 *
 * `reason` on POST /api/fields/{id}/correct was `z.string().min(1)` — the
 * refusal rule "a correction needs a reason". It was relaxed to optional by
 * owner instruction on 2026-09-02 so the inline row editor could file a value
 * on its own, and `endpoints.ts` carries the instruction to RE-TIGHTEN IT
 * BEFORE ANY REAL PACKAGE IS DELIVERED.
 *
 * That instruction was held by a comment. `InlineEdit`/`useEditAsk` send no
 * reason, and the mock backend enforces none, so on the day someone restores
 * `min(1)` in the contract the inline editor becomes a surface that builds an
 * invalid request — and finds out at runtime, on a real correction to a legal
 * record, rather than here.
 *
 * So this test asserts the COUPLING rather than either side. While the
 * relaxation stands it simply records that it stands. The moment the contract
 * is re-tightened it fails, and names the file that has to change with it.
 */

const EDIT_ASK = readFileSync(
  join(process.cwd(), "src", "features", "review", "useEditAsk.ts"),
  "utf8",
);

/** Does the wire still accept a correction carrying no reason at all? */
const RELAXATION_STANDS = CorrectFieldRequest.safeParse({ value: "x" }).success;

/** Does the inline-edit write path put a reason on the request it builds? */
const INLINE_EDIT_SENDS_REASON = /\breason\b\s*:/.test(
  EDIT_ASK.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""),
);

test("the inline editor supplies a reason once the contract requires one", () => {
  if (RELAXATION_STANDS) {
    // The documented build-phase state. Nothing to enforce yet — this branch
    // exists so the re-tightening below is the thing that trips, not a
    // failure today.
    expect(INLINE_EDIT_SENDS_REASON).toBe(false);
    return;
  }

  expect(
    INLINE_EDIT_SENDS_REASON,
    "CorrectFieldRequest.reason is required again, so the build-phase " +
      "relaxation of 2026-09-02 is over — but src/features/review/useEditAsk.ts " +
      "still calls writes.correct() without one, and every inline row edit " +
      "will now be rejected at the boundary. Give InlineEdit a reason input " +
      "and pass it through save(), the way DecisionEditor already does.",
  ).toBe(true);
});

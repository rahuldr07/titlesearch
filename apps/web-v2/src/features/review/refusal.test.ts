import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api";
import { latestRefusal, type WriteOutcome } from "./refusal";

/**
 * BLOCKER 1. Four of the five review mutations swallowed the server's refusal:
 * `ReviewScreen` read `confirm.error` and nothing else, so a 409 on
 * `/correct`, `/escalate`, `/exclude` or `/pass` left the screen silent while
 * the editor sat there holding a value the server had rejected.
 *
 * HANDOFF §4 rule 9: a 409 is an ANSWER and must render with the server's
 * message VERBATIM. That is a property of the WRITE, not of one endpoint, so
 * the note is derived from all five submissions rather than wired per-caller —
 * a per-caller wiring is exactly the shape that lost four of them.
 */

const outcome = (submittedAt: number, error: Error | null = null): WriteOutcome => ({
  submittedAt,
  error,
});

describe("latestRefusal", () => {
  it("is silent before anything has been submitted", () => {
    expect(latestRefusal([outcome(0), outcome(0), outcome(0)])).toBeNull();
  });

  it("surfaces a refusal from ANY write, not only the first in the list", () => {
    // The confirm slot is the one that used to be read; each of the other four
    // must be surfaced on its own, with nothing submitted on confirm at all.
    const messages = [
      "field is terminal (escalated)",
      "already confirmed with a different value",
      "exclude applies only to judgment party rows (R13)",
      "order already passed",
    ];
    for (const [index, message] of messages.entries()) {
      const writes = [outcome(0), outcome(0), outcome(0), outcome(0), outcome(0)];
      writes[index + 1] = outcome(1000, new ApiError(409, message));
      expect(latestRefusal(writes)).toBe(message);
    }
  });

  it("keeps the server's wording verbatim — no paraphrase, no prefix", () => {
    const note = latestRefusal([
      outcome(500, new ApiError(409, "field is terminal (escalated)")),
    ]);
    expect(note).toBe("field is terminal (escalated)");
  });

  it("reports the most recent submission, not the oldest that failed", () => {
    const note = latestRefusal([
      outcome(100, new ApiError(409, "already confirmed with a different value")),
      outcome(900, new ApiError(422, "a correction needs its reason")),
    ]);
    expect(note).toBe("a correction needs its reason");
  });

  it("clears once a later submission is accepted", () => {
    // A stale refusal from a write the reviewer has since moved past is a
    // false claim about the decision they just made.
    const note = latestRefusal([
      outcome(100, new ApiError(409, "already confirmed with a different value")),
      outcome(900),
    ]);
    expect(note).toBeNull();
  });

  it("does not attribute a client-side failure to the server", () => {
    // `server: Failed to fetch` would be a sentence the server never said.
    expect(latestRefusal([outcome(700, new TypeError("Failed to fetch"))])).toBeNull();
  });
});

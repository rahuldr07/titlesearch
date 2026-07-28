import type { RuleStatus } from "@titlepipe/contract";

/**
 * The status vocabulary, in one place.
 *
 * The server owns `status` — this module only decides how each value looks and
 * reads, and it is exhaustive over `RuleStatus` by construction so a fourth
 * status added to the contract fails the typecheck here rather than falling
 * through to a neutral chip that quietly says nothing.
 *
 * PENDING IS ATTEND, NEVER NEUTRAL. A rule awaiting confirmation is not a
 * quiet in-between state — it is the one state where what the screen shows and
 * what the pipeline does are different, and that is worth a colour.
 *
 * RETIRED IS NEUTRAL, NOT HALT. Retirement is the correct, ordinary end of a
 * rule's life, not a failure; colouring it red would make the book's own
 * archive read as a wall of problems.
 */
const STATUS = {
  live: { tone: "settled", label: "LIVE" },
  pending: { tone: "attend", label: "PENDING — CANNOT AFFECT THE PIPELINE" },
  retired: { tone: "neutral", label: "RETIRED" },
} as const satisfies Record<RuleStatus, { tone: "settled" | "attend" | "neutral"; label: string }>;

export function statusTone(status: RuleStatus): "settled" | "attend" | "neutral" {
  return STATUS[status].tone;
}

export function statusLabel(status: RuleStatus): string {
  return STATUS[status].label;
}

/** The lifecycle, in the order a rule travels it. Never reordered. */
export const LIFECYCLE: readonly RuleStatus[] = ["pending", "live", "retired"];

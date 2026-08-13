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
 *
 * THE CHIP READS BARE "PENDING" — THE LONG SENTENCE LIVES ELSEWHERE. Every
 * status badge the 2026-07-28 design draws (the row chip, the detail header,
 * the lifecycle rail) binds the same one-word status a live/retired rule gets.
 * The explanatory sentence — "PENDING — AFFECTS NOTHING YET" — belongs to a
 * different element the design draws once: the amber banner on the new-rule
 * form (`PendingBanner.tsx`), which already carries it verbatim as a literal
 * string, not through this label. Putting the long sentence here as well would
 * put it on the lifecycle rail and the row chip too, which the design never
 * does — this module's job is the chip, not the banner.
 */
const STATUS = {
  live: { tone: "settled", label: "LIVE" },
  pending: { tone: "attend", label: "PENDING" },
  retired: { tone: "neutral", label: "RETIRED" },
} as const satisfies Record<
  RuleStatus,
  { tone: "settled" | "attend" | "neutral"; label: string }
>;

export function statusTone(status: RuleStatus): "settled" | "attend" | "neutral" {
  return STATUS[status].tone;
}

export function statusLabel(status: RuleStatus): string {
  return STATUS[status].label;
}

/** The lifecycle, in the order a rule travels it. Never reordered. */
export const LIFECYCLE: readonly RuleStatus[] = ["pending", "live", "retired"];

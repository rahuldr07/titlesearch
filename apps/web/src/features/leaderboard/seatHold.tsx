import type { EngineRoutingCell } from "@titlepipe/contract";

/**
 * WHY A SEAT CHANGE IS HELD, IN ONE SENTENCE PER CAUSE.
 *
 * Split out of `SeatChange` because it is the only part of that form that is a
 * RULE rather than a rendering, and because the rule is testable on its own —
 * the same shape as `features/escalations/holdReason.ts`, which carries
 * `§0.5 MANDATORY` for escalations.
 *
 * The rule here is `endpoints.ts:417`: `EngineRoutingRequest.evidence_url` is
 * `z.string().min(1)`. A seat change without a citation is not a weak request,
 * it is not a request — the schema has no arm for it, the server refuses it
 * (`handlers.ts:1257`), and this function is that refusal said in words while
 * the reason is still fixable.
 *
 * A SENTENCE PER CAUSE rather than one "complete the form": an engineer who has
 * picked a seat and an engine and sees a dead button needs to be told the
 * missing thing is EVIDENCE, which is the whole point of the act. A generic
 * prompt leaves that unsaid, and rule 9 requires every disabled control to
 * state its reason.
 *
 * ══ THE FOURTH CAUSE IS THE INTERESTING ONE ════════════════════════════════
 *
 * A seat already holding the chosen engine is held too. INVARIANT 32 states it
 * for corrections — "a correction is inert until it differs from the machine
 * read" — and the same reasoning governs here: filing a change that changes
 * nothing writes a new `approved_by`, `approved_at` and `evidence_url` over a
 * decision somebody else made, and destroys the provenance of the seat while
 * appearing to do nothing.
 *
 * `null` means live. That inverted convention is `disabled.ts`'s: this kit has
 * no boolean disabled prop, so a reason IS the disablement.
 */
export function seatHold(
  seat: EngineRoutingCell | null,
  engineId: string | null,
  evidence: string,
  filing: boolean,
): string | null {
  if (filing) {
    return "Filing — the server has not answered yet. One act files one record.";
  }
  if (seat === null) {
    return "Held: name the seat this change lands in. Routing is per jurisdiction × section × seat.";
  }
  if (engineId === null) {
    return "Held: name the engine that takes the seat.";
  }
  if (engineId === seat.engine_id) {
    return "Held: that seat already holds this engine. Filing it would overwrite the existing approval and its evidence with an identical decision.";
  }
  if (evidence.trim().length === 0) {
    return "Held: a seat change is refused without evidence. Cite the bench run this rests on.";
  }
  return null;
}

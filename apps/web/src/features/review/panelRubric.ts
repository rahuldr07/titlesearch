import type { Field, FieldState } from "@titlepipe/contract";
import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { readingsDisagree } from "./readings";

/**
 * THE PANEL'S STATE LINE — WHAT THE SERVER SENT, SAID IN ONE RUBRIC.
 *
 * The row carries `RowMark` (rule 6: one signal, a mark). The open decision has
 * room for the full statement, and this is it: the 11px caps rubric above the
 * value, which is one of the two registers rule 4 permits ALL-CAPS in.
 *
 * ══ THIS COMPOSES A SENTENCE. IT DOES NOT DECIDE A STATE ═══════════════════
 *
 * Hard rule 3 and `enums.ts:3-8` forbid computing `state`. Nothing here does:
 * every branch below is a statement the SERVER already made, and the only
 * choice being made is WHICH of the server's statements leads.
 *
 *   1. An NA REASON leads. It is the server's positive statement about the
 *      document and it outranks everything: a field the server called
 *      PRESENT_UNREADABLE is that, whatever its lifecycle state, and
 *      `provenance.ts` orders its own classification the same way for the same
 *      reason.
 *   2. Then DISAGREEMENT, and this branch is INVARIANT 29 — the ORPHAN rule.
 *      "When both engines found a value and disagree, the UI must NEVER claim
 *      extraction returned nothing." A `needs_review` field with a null value
 *      and two conflicting readings is the fixture's core case
 *      (`mortgages.1.lender`), and rendering it as plain "NEEDS REVIEW" over a
 *      "not yet extracted" chip would say precisely the false thing the rule
 *      forbids: extraction ran, it produced two answers, and the disagreement
 *      is WHY this is a person's. So the rubric says so.
 *   3. Otherwise the state, verbatim.
 *
 * The words in branch 2 are not invented copy — they are the design's, drawn
 * on this exact card, and the rule they satisfy is written down in
 * `INVARIANTS:73-75`.
 */
export type PanelRubric = {
  readonly text: string;
  /** Which family paints it. The server's state, never a threshold. */
  readonly tone: "attend" | "halt" | "settled" | "muted";
};

/** The lifecycle words, in the rubric register. `StatePill` holds the prose. */
const STATE_RUBRIC: Readonly<Record<FieldState, PanelRubric>> = {
  pending: { text: "NOT YET EXTRACTED", tone: "muted" },
  auto_confirmed: { text: "AUTO-CONFIRMED", tone: "settled" },
  needs_review: { text: "NEEDS REVIEW", tone: "attend" },
  confirmed: { text: "CONFIRMED", tone: "settled" },
  corrected: { text: "CORRECTED", tone: "settled" },
  escalated: { text: "ESCALATED — AWAITING A RULE", tone: "halt" },
};

/**
 * The absence words. The taxonomy's own distinctions (`enums.ts:20-52`) in the
 * rubric register — four sentences that must never collapse, so four rubrics.
 */
const ABSENCE_RUBRIC: Readonly<
  Record<Extract<FieldValue["kind"], `na-${string}`>, PanelRubric>
> = {
  "na-not-present": { text: "N/A — EXPECTED IN THIS JURISDICTION", tone: "muted" },
  "na-not-found": { text: "SEARCHED — NOTHING OF RECORD", tone: "attend" },
  "na-not-stated": { text: "INSTRUMENT SILENT", tone: "attend" },
  "na-present-unreadable": { text: "PRESENT — UNREADABLE", tone: "attend" },
};

export function panelRubric(field: Field, value: FieldValue): PanelRubric {
  switch (value.kind) {
    case "na-not-present":
    case "na-not-found":
    case "na-not-stated":
    case "na-present-unreadable":
      return ABSENCE_RUBRIC[value.kind];

    /**
     * A value the server sent with no source. `entities.ts:85-89` calls this
     * "the exact failure shape the architecture exists to catch", so it leads
     * over the lifecycle state — an auto-confirmed value nobody can cite is a
     * defect first and a settled field second.
     */
    case "uncited":
      return { text: "NO PROVENANCE — CANNOT BE CITED", tone: "halt" };

    case "not-extracted":
    case "cited":
      return readingsDisagree(field.readings ?? [])
        ? { text: "ENGINES DISAGREE — NOTHING SETTLED", tone: "attend" }
        : STATE_RUBRIC[field.state];

    default:
      return assertNever(value, "panelRubric");
  }
}

import type { Field, FieldState } from "@titlepipe/contract";
import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { readingsDisagree } from "./readings";

/**

 * The panel's state line — what the server sent, said in one rubric. The row carries

 * `RowMark` (rule 6: one signal, a mark).

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

 * The absence words. The taxonomy's own distinctions (`enums.ts:20-52`) in the rubric

 * register — four sentences that must never collapse, so four rubrics.

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

     * A value the server sent with no source. `entities.ts:85-89` calls this "the exact

     * failure shape the architecture exists to catch", so it leads over the lifecycle

     * state — an auto-confirmed value nobody can cite is a defect first and a…

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

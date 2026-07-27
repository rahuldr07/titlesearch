/**
 * The no-value states. THE most important logic in the app.
 *
 * SIX renders, not four and not five (`phase2-audit.md` §4). They divide into
 * two kinds, and conflating the kinds is the bug this module exists to prevent:
 *
 *   Statements about the DOCUMENT — the four `NaReason` members ratified by the
 *   owner in decisions.md D3. These are answers.
 *     not_present  structurally absent in this jurisdiction
 *     not_found    searched, none of record
 *     silent       present, but the document does not state it
 *     unreadable   present, but not legible
 *
 *   Statements about the PIPELINE — not enum members, because they say nothing
 *   about the document. These are the absence of an answer.
 *     pending      we have not looked yet
 *     unsettled    the engines read it and DISAGREED — `readings` holds
 *                  candidate values, so the field is emphatically not empty
 *
 * `unsettled` was found on screen during the previous rebuild, not by any test.
 * The contract encodes it and `pending` identically — both arrive as
 * `value: null, na_reason: null` — and only the presence of `readings`
 * separates them. Rendering `unsettled` as `pending` tells a reviewer there is
 * nothing to look at while two candidate values sit in the payload, which is
 * exactly the defect orphan O8 (`ux.spec`, "a both-found disagreement never
 * claims emptiness") exists to catch.
 *
 * CONTRACT GAP: the wire should distinguish these two so a client that forgets
 * to consult `readings` cannot silently claim absence.
 *
 * This module is deliberately free of JSX so its exhaustiveness is testable in
 * the node Vitest project, with no DOM environment.
 */

export type NoValueKind =
  | { kind: "pending" }
  | { kind: "unsettled" }
  | { kind: "not_present" }
  | { kind: "not_found" }
  | { kind: "silent" }
  | { kind: "unreadable"; page: number };

/** The four members that are statements about the document. */
export const NA_REASONS = ["not_present", "not_found", "silent", "unreadable"] as const;

export interface NoValueDescription {
  /** Visible text. Sentence-shaped because these are answers, not codes. */
  label: string;
  /**
   * What a screen reader announces. Never just the visible glyph — each state
   * must be distinguishable without sight, not only without colour.
   */
  accessibleLabel: string;
  /** True for the two pipeline states: no answer exists yet. */
  isPipelineState: boolean;
}

/**
 * Total over the union. The `never` guard is the point: adding a seventh render
 * becomes a COMPILE error here rather than a silent fallthrough at runtime.
 */
export function describeNoValue(value: NoValueKind): NoValueDescription {
  switch (value.kind) {
    case "pending":
      return {
        label: "not yet extracted",
        accessibleLabel: "Not yet extracted — the pipeline has not reached this field",
        isPipelineState: true,
      };
    case "unsettled":
      return {
        label: "nothing settled — the readings disagree",
        accessibleLabel:
          "Nothing settled. Two engines read this field and disagreed; both readings are available",
        isPipelineState: true,
      };
    case "not_present":
      return {
        label: "n/a — not used in this jurisdiction",
        accessibleLabel: "Not applicable — this field is not used in this jurisdiction",
        isPipelineState: false,
      };
    case "not_found":
      return {
        label: "Not found — searched, none of record",
        accessibleLabel: "Not found — searched, none of record",
        isPipelineState: false,
      };
    case "silent":
      return {
        label: "Document silent — not stated on any page",
        accessibleLabel: "Document silent — not stated on any page",
        isPipelineState: false,
      };
    case "unreadable":
      return {
        label: `Present — unreadable on page ${value.page}`,
        accessibleLabel: `Present but unreadable on page ${value.page}`,
        isPipelineState: false,
      };
    default: {
      // Unreachable while the union is total. Throwing rather than returning a
      // blank is deliberate: a silent empty render is the failure mode this
      // whole module exists to make impossible.
      const unreachable: never = value;
      throw new Error(
        `Unhandled no-value kind: ${JSON.stringify(unreachable)}. ` +
          "Every render must be explicit — see docs/frontend/phase2-audit.md §4.",
      );
    }
  }
}

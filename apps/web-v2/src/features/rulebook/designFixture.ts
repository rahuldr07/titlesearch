/**
 * The design's own numbers, kept in one place and labelled as fixture.
 *
 * CONTRACT GAP: `Rule` in @titlepipe/contract carries id, code, text, origin,
 * status, jurisdiction_scope, version, confirmed_by, source_doc_ref — and
 * nothing else. The design draws four things around a rule that no endpoint
 * returns: the golden-set impact preview, the list of delivered reports that
 * used the rule, the immutable version log, and the id of a conflicting
 * counterpart. There is no endpoint for any of them.
 *
 * They are rendered from these constants so the panels have their real shape,
 * and every one of them ships the design's own "not wired" caption on screen.
 * That caption is not an apology — it is the design's device, taken verbatim
 * from `usedByCaption`, and it exists so nobody reads a fixture as a query.
 * A screen that shows an invented count without saying so is how an invented
 * count reaches a delivered report (principle 6).
 *
 * NO EQUIVALENT FIXTURE FOR THE RETIRE-IMPACT PREVIEW: the design draws a
 * `hasRetireImpact` state (numbers) beside a `noRetireImpact` one ("no preview
 * has been run"), but nothing on the wire can ever put a real rule in the
 * first branch — there is no run-preview endpoint and no impact field on
 * `Rule`. `RetireConfirm.tsx` renders the absence state unconditionally rather
 * than carry a fixture for a branch no real rule can reach.
 */

/** The caption every unwired panel carries. Design copy, one source. */
export const NOT_WIRED =
  "Design fixture — illustrative figures, not a query. The real preview is not wired.";

export interface ImpactCase {
  order: string;
  detail: string;
}

/** Impact preview · golden set — the design's R-0155 numbers. */
export const IMPACT = {
  total: 50,
  changed: 12,
  match: 9,
  mismatch: 3,
  cases: [
    { order: "gold-031", detail: "Deed states 'undivided one-third'; rule labelled it 1/2." },
    { order: "gold-047", detail: "Life estate, not a fractional fee — rule mis-fires." },
    { order: "gold-052", detail: "Full 100% conveyance wrongly flagged as partial." },
  ] as const satisfies readonly ImpactCase[],
} as const;

/** Delivered reports that used this rule. Three illustrative order numbers. */
export const USED_BY = ["CSSKY-640347", "DL-26-2219", "4176034-1"] as const;

export const USED_BY_CAPTION =
  "Sample only — three illustrative order numbers, not a query against the delivered reports. The real list is not wired.";

export interface VersionEntry {
  v: string;
  note: string;
  who: string;
  when: string;
}

/**
 * Versions · immutable. Two entries because the design's most-explained rule
 * has two: a v2 existing at all is the record that v1 was too broad, and a
 * version log that collapses to "current" erases exactly that.
 */
export const VERSIONS = [
  { v: "v2", note: "Scope narrowed to Arizona only", who: "R. Okafor", when: "2025-11-02" },
  { v: "v1", note: "Original — all states (retired)", who: "R. Okafor", when: "2025-06-14" },
] as const satisfies readonly VersionEntry[];

/** The conflicting counterpart the design pairs against a pending rule. */
export const CONFLICT_COUNTERPART = {
  id: "R-0149",
  outcome: "Exclude it from the Call Back Sheet.",
} as const;

export const CONFLICT_NOTE =
  "Neither rule wins by default and neither is deleted. Retiring one, narrowing a scope, or recording a ruling are the three ways out — and each of them is somebody's signature.";

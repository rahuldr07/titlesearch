import type { Field } from "@titlepipe/contract";

/**
 * T1 — RUINOUS EXPOSURE, AND THE COUNTERSIGN THAT HAS NO CONTRACT.
 *
 * ══ WHAT IS BUILT, AND WHAT IS DELIBERATELY NOT ════════════════════════════
 *
 * The design draws two T1 things on this screen (§Screens 7):
 *
 *   1. "T1 pills on ruinous fields" in the field list. BUILT — it is a mark on
 *      a row saying which decisions carry the exposure, and rule 6 lists T1
 *      among the four moments of record that earn a coloured capsule.
 *   2. "Second-read panel after all rulings: 3 T1 rows + countersign (blocked
 *      unless QC user)". NOT BUILT, and this is the largest contract gap in the
 *      screen. `orderScreens.ts` states it in full: there is no second-read
 *      entity, no countersign endpoint, no `countersigned_by` on `Field`, and
 *      no such action in the permission table. `Reconciliation` is a DIFFERENT
 *      mechanism — blind-typist capture quality, not post-ruling QC — and
 *      binding one to the other would silently redefine what the blind protocol
 *      measures.
 *
 * Design rule 13 makes the gap sharper rather than softer: "a T1 countersign
 * must come from a different user than the ruling examiner (ENFORCE WITH A 409,
 * NOT BUTTON STATE)". A 409 requires an endpoint. Drawing a countersign button
 * with no endpoint behind it would be the client-side gate the rule exists to
 * forbid — the prototype's `if (activeRole === "QC Reviewer")`, which
 * ANALYSIS-behavior §6 shows can be defeated in two clicks. AGENTS.md: do not
 * build past OPEN.
 *
 * ══ WHERE T1 COMES FROM, AND WHY IT IS NOT A LIST IN THIS FILE ═════════════
 *
 * `rule_refs`. Which fields carry ruinous exposure is a RULEBOOK judgement —
 * it is why the rulebook exists — and a `const RUINOUS = ["owner.names", …]`
 * here would be a second, silently drifting copy of it in a browser. The
 * server tags the field with the rule; this reads the tag.
 *
 * The tag is a PREFIX match rather than an exact one, because a rule id carries
 * its scope (`T1-vesting-GA`, `T1-lien-priority`) and matching the whole string
 * would mean this file enumerating them — the list problem again, one level
 * down.
 *
 * `packages/mocks` tags three fields (`T1_LENDER`, `T1_PRINCIPAL`,
 * `T1_JUDGMENT_PARTY` in `data.ts`), which is the design's own count — "the
 * three ruinous-exposure (T1) rulings". They were untagged until 2026-08-27
 * and the fixture, not this file, is where they were added: a pill drawn from a
 * path list in a component would look finished and be a fabrication.
 */
const T1_PREFIX = "T1-";

export function isRuinous(field: Field): boolean {
  return field.rule_refs.some((ref) => ref.startsWith(T1_PREFIX));
}

/**
 * Rule 6: "colored capsules only at moments of record (released, quarantine
 * clear, T1)". This is one of the three, so it is a capsule — and it is the
 * only capsule the field list draws.
 */
export function T1Pill() {
  return (
    <span
      data-testid="t1-pill"
      title="Ruinous exposure — a second examiner must countersign this ruling before release."
      className="inline-flex items-center rounded-pill border border-state-halt-border bg-state-halt-surface px-4 font-mono text-label leading-flat font-bold text-state-halt"
    >
      T1
    </span>
  );
}

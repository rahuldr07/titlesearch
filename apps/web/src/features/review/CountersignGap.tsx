import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * THE T1 SECOND READ, WHICH CANNOT BE BUILT.
 *
 * `reference-app.html`'s `isReview` draws a whole block for it, and it is the
 * most load-bearing thing on the prototype's version of this screen:
 *
 *   "Second read — T1 exposure · 3 rulings. All six flagged fields are decided.
 *    The three ruinous-exposure rulings need a second examiner's countersign
 *    before the report can compose — no single-examiner release."
 *   … then "Countersign 3 T1 rulings →" and, after, "✓ T1 second read
 *    countersigned by R. Menon (QC)".
 *
 * None of it has a contract surface. `orderScreens.ts:16` records the audit:
 * no second-read entity, no countersign endpoint, no `countersigned_by` on
 * `Field`, and no such action in `PERMISSIONS`. AGENTS.md forbids building past
 * `OPEN`, and this is the largest `OPEN` in the product.
 *
 * ══ WHY THE NEAREST SHAPE IS THE WRONG SHAPE ═══════════════════════════════
 *
 * `Reconciliation` (`entities.ts:202`) looks like it fits — two readings, a
 * ruling, a citation, a `ruled_by`. It is a DIFFERENT MECHANISM: blind-typist
 * capture quality, measured against the machine to score the pipeline. A
 * countersign is post-ruling QC by a second examiner. Binding one to the other
 * "would silently redefine what the blind protocol measures", which is worse
 * than the gap, because the blind fifty is how accuracy is known at all.
 *
 * ══ WHY THE PROTOTYPE'S BUTTON IS NOT DRAWN DISABLED ═══════════════════════
 *
 * Rule 9 wants a blocked control to state its reason, and rule 12 wants a
 * blocked action disabled with the rule rather than hidden. Both assume the
 * action EXISTS and this reader may not take it. Nothing may countersign here —
 * not this reader, not a senior, not an admin — because there is no endpoint to
 * call. A disabled button would say "you may not", where the truth is "nothing
 * may, yet", and design rule 13's own remedy (enforce with a 409, not button
 * state) needs a request to refuse.
 *
 * This blocks three things downstream, and they are named so the gap reads as
 * one decision rather than three separate omissions: the workstation's own
 * completion, the release compile gate (§8), and the delivered screen's
 * countersign line (§9).
 */
export function CountersignGap() {
  return (
    <ContractGap
      drawn="Second read — T1 exposure: a countersign by a different examiner before the report may compose, and the 'no single-examiner release' rule it enforces (design §Review, §Release, §Delivered)"
      has={
        <>
          Nothing. There is no second-read entity, no countersign endpoint, no{" "}
          <code className="font-mono text-label">countersigned_by</code> on{" "}
          <code className="font-mono text-label">Field</code>, and no countersign
          action in <code className="font-mono text-label">PERMISSIONS</code>.{" "}
          <code className="font-mono text-label">Reconciliation</code>{" "}
          (entities.ts:202) is the nearest shape and is a different mechanism —
          blind-typist capture quality, not post-ruling QC — so binding to it
          would silently redefine what the blind protocol measures.
        </>
      }
      needs={
        <>
          A countersign record carrying the ruling it answers, the examiner who
          gave it, and the rule that a countersign must come from a different
          user than the ruling examiner — enforced as a 409, per design rule 13,
          rather than as button state. It gates three screens, not one: this
          workstation&rsquo;s completion, the release compile gate, and the
          delivered record&rsquo;s countersign line.
        </>
      }
    />
  );
}

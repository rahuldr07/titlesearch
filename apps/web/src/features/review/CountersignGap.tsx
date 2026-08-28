import { ContractGap } from "../../entities/contract/ContractGap";

/**

 * The t1 second read, which cannot be built. `reference-app.html`'s `isReview` draws a

 * whole block for it, and it is the most load-bearing thing on the prototype's version

 * of this screen: "Second read — T1 exposure · 3 rulings.

 */
export function CountersignGap() {
  return (
    <ContractGap
      drawn="Second read — T1 exposure: a countersign by a different examiner before the report may compose, and the 'no single-examiner release' rule it enforces (design §Review, §Release, §Delivered)"
      has={
        <>
          Nothing. There is no second-read entity, no countersign endpoint, no{" "}
          <code className="font-mono text-label">countersigned_by</code> on{" "}
          <code className="font-mono text-label">Field</code>, and no countersign action
          in <code className="font-mono text-label">PERMISSIONS</code>.{" "}
          <code className="font-mono text-label">Reconciliation</code> (entities.ts:202)
          is the nearest shape and is a different mechanism — blind-typist capture
          quality, not post-ruling QC — so binding to it would silently redefine what
          the blind protocol measures.
        </>
      }
      needs={
        <>
          A countersign record carrying the ruling it answers, the examiner who gave it,
          and the rule that a countersign must come from a different user than the
          ruling examiner — enforced as a 409, per design rule 13, rather than as button
          state. It gates three screens, not one: this workstation&rsquo;s completion,
          the release compile gate, and the delivered record&rsquo;s countersign line.
        </>
      }
    />
  );
}

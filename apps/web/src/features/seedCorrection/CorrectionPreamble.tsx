/**
 * THE WEIGHT OF THIS SCREEN, SAID BEFORE THE FORM.
 *
 * Split from `SeedCorrectionScreen` for the same reason `GoldenPreamble` is
 * split from its screen: this is the ARGUMENT, and the argument is why the form
 * below refuses what it refuses.
 *
 * `endpoints.ts:285-291` calls the golden actions "the one screen where ground
 * truth changes". That is not a caution about care; it is a statement about
 * consequence. Every bench cell, every engine comparison and every accuracy
 * claim in this product is measured against the corpus a correction here
 * rewrites — so filing one silently re-scores work that already happened, and
 * `corrected_from` surviving forever is the only reason that is auditable.
 *
 * ══ THREE ACTIONS, AND THIS IS THE ONE THAT MOVES THE VALUE ════════════════
 *
 * `endpoints.ts:275-284` names all three ("SeedCorrection §4.9 — three actions,
 * nothing else") and the other two live on the golden set, because they leave
 * the value untouched. Naming them here is what stops a reader reaching for a
 * correction when the seed is right: the hold on the button says the same thing
 * again at the moment it matters, but a reader who learns the distinction only
 * from a disabled control has already typed a citation for nothing.
 *
 * The door is named rather than linked. This screen owns no route table and a
 * typed link to a route it does not wire is a link that breaks the build the
 * day the route moves.
 */
export function CorrectionPreamble() {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
        Seed correction
      </h1>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        You are editing the ruler. The golden set is what every engine, every
        bench run and every accuracy claim in this product is measured against,
        so a correction filed here changes the grade of work that is already
        finished. It is permanent, it is signed from your session, and the value
        it displaces is kept beside it forever.
      </p>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        A correction is refused without three things: the source it rests on, the
        reason it is right, and a session identity to sign it. Two of the three
        are the server&rsquo;s own rule — <span className="font-mono">source_citation</span>{" "}
        and <span className="font-mono">reason</span> are both required by the
        contract — and the third is the one you cannot type, because a signature
        the browser supplies is not a signature.
      </p>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        Only use this when the seed&rsquo;s VALUE is wrong. If the seed is right
        and the model failed, or if the document is ambiguous and neither reading
        is defensible, the acts are confirm and demote, and they live on the
        golden set at <span className="font-mono">/golden</span>.
      </p>
    </header>
  );
}

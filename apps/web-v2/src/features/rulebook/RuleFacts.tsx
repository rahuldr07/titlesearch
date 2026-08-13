import type { ReactNode } from "react";
import type { Rule } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The four questions asked of every rule: where it applies, what has to be true
 * in the document, what the report should then say, and on whose authority.
 *
 * CITATION IS RENDERED LAST AND IN THE QUOTE FACE because it is the only one of
 * the four that is not the author's own words — it is the thing outside this
 * screen that the rule answers to. A rule with no citation is not a rule, it is
 * a preference, and the screen has to be able to tell the reader which one it
 * is looking at (principle 6: never emit a value you can't cite).
 *
 * AN UNCITED RULE SAYS SO IN THE CITATION SLOT rather than rendering a dash.
 * A dash reads as "nothing to see"; the sentence reads as "this is the problem".
 *
 * CONTRACT GAP: `Rule` carries one `text` field. The design splits a rule into
 * a summary, a CONDITION ("what must be true in the document") and an OUTCOME
 * ("what the report should then say or do") — three fields where the contract
 * has one. The split is not derivable from the text, so the two rows state what
 * is missing instead of guessing at a sentence boundary.
 */
export function RuleFacts({ rule }: { rule: Rule }) {
  return (
    <dl className="flex flex-col gap-5">
      <Fact label="Scope">{rule.jurisdiction_scope ?? "All jurisdictions"}</Fact>

      <Fact label="Condition">
        <span className="text-ink-muted">
          Not carried by the contract — a rule arrives as one statement, not as a
          condition and an outcome.
        </span>
      </Fact>

      <Fact label="Outcome">
        <span className="text-ink-muted">
          Not carried by the contract — see Condition.
        </span>
      </Fact>

      <Fact label="Citation">
        {rule.source_doc_ref === null ? (
          <span className="text-state-halt-ink">
            No source on file. A rule with no authority behind it cannot be confirmed.
          </span>
        ) : (
          <span className="font-quote">{rule.source_doc_ref}</span>
        )}
      </Fact>
    </dl>
  );
}

/**
 * One labelled fact. The label column is fixed-width so the four values start
 * on the same line — scanning down the values is how you compare two rules, and
 * a ragged left edge makes that a reading exercise instead of a glance.
 */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-5">
      <dt className="w-39 shrink-0 pt-1">
        <Eyebrow variant="field">{label}</Eyebrow>
      </dt>
      <dd className="flex-1 text-base leading-body text-ink-primary">{children}</dd>
    </div>
  );
}

import { Eyebrow } from "../../shared/ui/Eyebrow";
import { IMPACT, NOT_WIRED } from "./designFixture";

/**
 * IMPACT PREVIEW · GOLDEN SET — what confirming this rule would do to the
 * fifty orders whose correct answers are already known.
 *
 * This panel is the reason confirmation is safe to offer at all. Without it,
 * "Confirm → make LIVE" is a request to change extraction on faith; with it,
 * the person confirming is looking at the rule's own failures before they
 * authorise it. The mismatch line is deliberately not softened — three orders
 * where the rule produces the wrong answer is a reason to fix the rule, not a
 * rounding error against nine that work.
 *
 * THE FAILING CASES ARE LISTED INDIVIDUALLY, not summarised to a count. "3 do
 * not" is a number you can accept without reading; "Life estate, not a
 * fractional fee — rule mis-fires" is a sentence that tells you the condition
 * is wrong. The list is what turns a preview into a review.
 *
 * CONTRACT GAP: there is no impact-preview endpoint and no impact field on
 * `Rule`. Running a rule against the golden set is server work — the client
 * cannot compute it and must not try. The figures below are the design's, and
 * the panel says so on screen so nobody confirms against a fixture.
 */
export function ImpactPreview() {
  return (
    <section
      data-testid="impact-preview"
      className="rounded-9 border border-line-strong bg-surface-app p-7"
    >
      <Eyebrow variant="caption" tone="strong" as="h3">
        Impact preview · golden set
      </Eyebrow>

      <p className="mt-4 text-md leading-open text-ink-primary">
        Would change <span className="font-mono font-semibold">{IMPACT.changed}</span> of{" "}
        <span className="font-mono font-semibold">{IMPACT.total}</span> golden orders.{" "}
        <span className="font-semibold text-state-settled-ink">{IMPACT.match} match</span>{" "}
        the known-correct value;{" "}
        <span className="font-semibold text-state-halt-ink">{IMPACT.mismatch} do not.</span>
      </p>

      <ul className="mt-5">
        {IMPACT.cases.map((item) => (
          <li
            key={item.order}
            className="flex items-start gap-5 border-t border-line-subtle py-3 text-xs leading-body text-ink-secondary"
          >
            <span className="shrink-0 font-mono font-semibold text-state-halt-ink">
              {item.order}
            </span>
            <span>{item.detail}</span>
          </li>
        ))}
      </ul>

      <p className="mt-5 rounded-6 border border-state-attend-border border-dashed bg-state-attend-surface px-5 py-3 text-xs leading-body text-state-attend-ink">
        {NOT_WIRED}
      </p>
    </section>
  );
}

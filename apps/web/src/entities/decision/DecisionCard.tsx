import type { Field, FieldReading } from "@titlepipe/contract";
import { readCited } from "../../shared/provenance";
import { cx } from "../../components/ui/cx";
import { FieldValueView } from "../field/FieldValueView";
import { ReadingPair } from "../field/ReadingPair";
import { StatePill } from "../field/StatePill";
import { DecisionQuestion } from "./DecisionQuestion";

/**
 * THE OPEN DECISION (design §Screens 7).
 *
 * "3px accent left rail, field name 13px accent, value 28px, second reading
 * inline, amber consequence line, source-excerpt strip, actions."
 *
 * Rule 1: the accent is spent ONCE per screen — "the open decision or the single
 * primary action". This card is that spend, which is why the rail and the field
 * name are accent here and nowhere else, and why the actions are handed in
 * rather than built: a card that rendered its own primary button would spend the
 * accent a second time on the same screen.
 *
 * `asking` and `why` are SERVER-AUTHORED (`entities.ts:124-149`) and are passed
 * straight through — see `DecisionQuestion`, which refuses to compose them.
 */
export type DecisionCardProps = {
  readonly field: Field;
  /**
   * The two engine readings, when the server sent a pair. `Field.readings` is
   * an arbitrary-length optional array; PICKING two out of it here would be the
   * UI deciding which engines are in the comparison, so the caller passes the
   * pair the server nominated.
   */
  readonly readings?: { readonly a: FieldReading; readonly b: FieldReading } | undefined;
  /**
   * What follows from getting this wrong, e.g. "A wrong vested owner voids the
   * policy." SERVER-AUTHORED like `why`; the amber line is a claim about
   * consequence and the browser has no standing to make one.
   */
  readonly consequence?: string | null | undefined;
  readonly onOpenCitation?: ((citation: { docId: string; page: number }) => void) | undefined;
  readonly onAdoptReading?: ((reading: FieldReading) => void) | undefined;
  /** Confirm / Edit / Escalate. Composed by the feature, which owns the chords. */
  readonly actions: React.ReactNode;
};

export function DecisionCard({
  field,
  readings,
  consequence,
  onOpenCitation,
  onAdoptReading,
  actions,
}: DecisionCardProps) {
  return (
    <section
      data-decision-card
      data-field-path={field.path}
      className={cx(
        "flex flex-col gap-8 rounded-lg border border-l-3 bg-surface-panel p-12 shadow-card",
        "border-line-strong border-l-action",
      )}
    >
      <header className="flex items-start justify-between gap-8">
        <span className="font-sans text-meta leading-close font-semibold text-action">
          {field.path}
        </span>
        <StatePill state={field.state} />
      </header>

      <DecisionQuestion asking={field.asking} why={field.why} />

      {/* Value at 28px — the subject of the card, per §Screens 7. */}
      <FieldValueView
        value={readCited(field)}
        onOpenCitation={onOpenCitation}
        className="[&>span:first-child]:text-title"
      />

      {readings !== undefined && (
        <ReadingPair
          a={readings.a}
          b={readings.b}
          {...(onAdoptReading ? { onAdopt: onAdoptReading } : {})}
        />
      )}

      {/* The amber consequence line. Attend family: look at this. */}
      {typeof consequence === "string" && consequence.length > 0 && (
        <p
          data-consequence
          className="rounded-sm border border-state-attend-border bg-state-attend-surface px-6 py-4 font-sans text-meta leading-close text-state-attend"
        >
          {consequence}
        </p>
      )}

      <footer className="flex items-center gap-6">{actions}</footer>
    </section>
  );
}

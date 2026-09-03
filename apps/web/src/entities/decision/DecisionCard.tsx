import type { Field, FieldReading } from "@titlepipe/contract";
import { readCited } from "../../shared/provenance";
import { FieldValueView } from "../field/FieldValueView";
import { ReadingPair } from "../field/ReadingPair";
import { StatePill } from "../field/StatePill";
import { DecisionQuestion } from "./DecisionQuestion";

/**
 * The open decision. It carries NO chrome of its own — no fill, no border,
 * no radius, no shadow. RECIPES §Open decision: "3px left rail, **no fill
 * box**", and the rail belongs to `DecisionPanel`, which owns the whole open
 * decision including the excerpt and the editor beneath this block. A card
 * here would put a box inside that rail and nest one surface in another.
 *
 * The field name is the screen's accent spend alongside that rail, and the
 * actions are handed in rather than built: a block that rendered its own
 * primary button would spend the accent twice. `asking` and `why` are
 * server-authored and passed straight through — see DecisionQuestion, which
 * refuses to compose them.
 */
export type DecisionCardProps = {
  readonly field: Field;
  /**
   * The two engine readings, when the server sent a pair. Picking two out of
   * `Field.readings` here would be the UI deciding which engines are in the
   * comparison, so the caller passes the pair the server nominated.
   */
  readonly readings?: { readonly a: FieldReading; readonly b: FieldReading } | undefined;
  /**
   * The field's display name and state rubric, both passed in — an entity
   * may not import a feature, so the words arrive as props. Without `label`
   * the header falls back to the raw `field.path`. They carry the
   * `sel-label` and `sel-state` test ids because the invariant specs address
   * the open decision by those two ids.
   */
  readonly label?: string | undefined;
  readonly rubric?: string | undefined;
  /**
   * What follows from getting this wrong. Server-authored like `why` — the
   * amber line is a claim about consequence and the browser has no standing
   * to make one.
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
  label,
  rubric,
  consequence,
  onOpenCitation,
  onAdoptReading,
  actions,
}: DecisionCardProps) {
  return (
    <section
      data-decision-card
      data-field-path={field.path}
      className="flex flex-col gap-8"
    >
      <header className="flex items-start justify-between gap-8">
        <span
          data-testid="sel-label"
          className="font-sans text-meta leading-close font-semibold text-action"
        >
          {label ?? field.path}
        </span>
        {/*
          * `sel-state` wraps the rubric alone: a spec asserts its exact text,
          * so the pill has to be a sibling rather than a child — otherwise
          * the id carries two sentences and the assertion can never hold.
          */}
        <span className="flex items-center gap-4">
          {rubric !== undefined && (
            <span
              data-testid="sel-state"
              className="font-sans text-label leading-flat tracking-caps text-ink-muted"
            >
              {rubric}
            </span>
          )}
          <StatePill state={field.state} />
        </span>
      </header>

      <DecisionQuestion asking={field.asking} why={field.why} />

      {/* Value at 28px — the subject of the card. */}
      <FieldValueView
        value={readCited(field)}
        onOpenCitation={onOpenCitation}
        className="[&>span:first-child]:text-title [&>span:first-child]:font-semibold"
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

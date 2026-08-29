import type { Field } from "@titlepipe/contract";
import { stateLabel } from "../../entities/field/fieldLabel";
import { isAnswered, SEGMENT_CLASS, segmentTone } from "./decisionMeter";
import { DECISION_STATES } from "./reportSections";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * THE DECISION QUEUE'S OWN METER — answered-of-total, one segment per decision,
 * plus what is left. This is a count of finite work, never a rate: no clock,
 * no per-reviewer number, nothing that turns "how much is left" into "how fast
 * are you going" (HANDOFF §4.5).
 *
 * IT IS THE PANE'S HEADER, NOT A CARD. The export gives it `flex:0 0 auto` at
 * the top of the decision block (`:843-854`) with the open card scrolling
 * beneath it, so the meter and the key hints stay put while the reviewer works
 * the card. That is also why this component draws no card border: it is one
 * band of the block it heads, not a box floating inside it.
 *
 * THE DENOMINATOR IS THE FIELDS THE PIPELINE FLAGGED, not every field on the
 * order. `auto_confirmed` fields were never a person's decision and do not
 * belong in either number — `state` says which is which, so this component
 * derives nothing the server did not already decide.
 *
 * THE "REST OF THE QUEUE" LINE IS NOT DRAWN HERE ANY MORE. This band used to
 * print `Rest of the queue · 17` — every flagged field but the open one — while
 * `QueueRest` printed a second heading of the same three words over the still
 * -open five. Both were on screen at once: one phrase, two meanings, twelve
 * apart. The heading now lives on the rows it counts (`QueueRest`), which is
 * where the export puts it (`:921-923`) and the only arrangement in which a
 * reader can check the number by counting. This band keeps the meter, which
 * counts a different thing and says so in different words.
 *
 * THIS ROOT IS `decision-meter`, NOT `decision-dock`. The dock is the whole
 * docked block — meter, the open card, then the rest of the queue — and
 * `FieldsPane` owns that element and that testid. Naming this band the dock
 * was what forced the count to be drawn here, away from its rows, to satisfy
 * `review.spec`'s containment assertion.
 *
 * THE KEY HINT NAMES THE KEYS THIS SCREEN ACTUALLY BINDS (`useReviewKeys`) —
 * `C confirm · E correct · j/k move`, the design's 2026-07-28 legend. Escalate
 * is absent from the hint because it has no hotkey: it is a button
 * (`act-escalate`). The letters are literal capitals in the markup, not a CSS
 * transform.
 *
 * KEY FIRST, THEN THE VERB — the export's own order (`:869`, mono-semibold key
 * then the word). This band read `Confirm C · Correct E · Move j/k`, which is
 * the button-label form the design deliberately does NOT use here: welding the
 * key onto the front of the verb makes the legend scan as four labels instead
 * of a key map. Only the move token differs from the export, which prints
 * `↑↓ move`; this screen binds `j`/`k`, and a legend must name the key that
 * actually fires.
 *
 * THE OPEN DECISION IS MARKED IN THE BAR (the mockup's 13th segment, at full
 * ink between the answered twelve and the waiting five). Without it the meter
 * says how much is done and refuses to say where you are, which is the one
 * question a reviewer working down eighteen actually asks it. `selectedPath` is
 * optional: an order can render before a field is chosen.
 *
 * `{n} remaining` IS THE THIRD COUNT AND IT IS NOT A SECOND SOURCE — it is
 * `needTotal - answered`, the same two numbers beside it. It lives here because
 * the invariant that pins it (`server-owns-state.spec`, "a null pending field
 * … never queued") reads it as the proof that a `pending` field manufactured no
 * queue entry, and the decision queue is the only surface that can honestly say
 * so. The screen used to carry it in a page header that also restated the
 * order's identity; that header is gone.
 */
export function DecisionDock({
  fields,
  selectedPath,
}: {
  fields: readonly Field[];
  /** The decision currently open in the card beneath, marked in the bar. */
  selectedPath?: string | undefined;
}) {
  const decisions = fields.filter((f) => DECISION_STATES.has(f.state));
  const needTotal = decisions.length;
  const answered = decisions.filter(isAnswered).length;

  if (needTotal === 0) return null;

  return (
    <div
      data-testid="decision-meter"
      className="flex flex-none flex-col gap-4 px-9 pb-4 pt-6"
    >
      <div className="flex flex-wrap items-baseline gap-4">
        <Eyebrow variant="section" tone="action">
          Decision queue
        </Eyebrow>
        <span className="text-xs text-ink-muted">
          {answered} of {needTotal} answered
        </span>
        <span className="text-xs text-ink-muted">{needTotal - answered} remaining</span>
        <span className="ml-auto whitespace-nowrap text-tiny text-ink-muted">
          <span className="font-mono font-semibold">C</span> confirm ·{" "}
          <span className="font-mono font-semibold">E</span> correct ·{" "}
          <span className="font-mono font-semibold">j</span>/
          <span className="font-mono font-semibold">k</span> move
        </span>
      </div>

      <div
        className="flex gap-1"
        role="img"
        aria-label={`${answered} of ${needTotal} decisions answered`}
      >
        {decisions.map((field) => (
          <span
            key={field.id}
            className={cn(
              "h-2 flex-1 rounded-1",
              SEGMENT_CLASS[segmentTone(field, selectedPath)],
            )}
            /* The SERVER'S word for the state, not the fill's name: the tooltip
               is where the outcome the three fills deliberately stopped
               encoding is still readable, and it must not be a second
               vocabulary for it. */
            title={`${field.path} — ${stateLabel(field)}`}
          />
        ))}
      </div>
    </div>
  );
}

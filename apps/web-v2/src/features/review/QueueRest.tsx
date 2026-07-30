import type { Field } from "@titlepipe/contract";
import { DECISION_STATES } from "./reportSections";
import { DecisionRow } from "../../entities/field/DecisionRow";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * "REST OF THE QUEUE" — the heading AND the rows it counts, in one component,
 * because they were in two and the screen printed the phrase twice.
 *
 * WHAT THIS FIXES, STATED PLAINLY. `DecisionDock` drew `Rest of the queue · 17`
 * over `DECISION_STATES` minus the open field; this component drew a second,
 * bare `Rest of the queue` over `OPEN_STATES` minus the open field — five rows.
 * Both were visible at once in a 1600×1000 viewport: one phrase, two meanings,
 * a twelve-apart discrepancy no reader could reconcile and no reader was told
 * about. The export settles it at `:921-923` — one heading,
 * `Rest of the queue · {{ decRestCount }}`, immediately followed by
 * `<sc-for list="{{ decRest }}">`. Count and rows are the same set or the label
 * is a lie.
 *
 * THE SET IS EVERY DECISION EXCEPT THE OPEN ONE — `DECISION_STATES`, not
 * `OPEN_STATES`. That is the export's `decRest = decisions.filter(d =>
 * !d.expanded)` (`:3149-3151`) read literally: every field the pipeline ever
 * sent to a person, minus the one expanded in the dock. Already-answered
 * decisions are in it. The rejected alternative was to narrow the heading's
 * number to the still-open five; it was rejected because `review.spec:180`
 * pins 17 as this order's rest-of-queue and that assertion is right — the
 * queue you have worked through is still the queue.
 *
 * THE COST IS REAL AND ACCEPTED: the twelve answered rows also appear on the
 * draft sheet below, so their values render twice on one screen. Two things
 * make that survivable where the older duplication was not — these are
 * ONE-LINE COLLAPSED ROWS, not a second full-width copy of the sheet's cards,
 * and they sit inside the bounded decision block rather than a screen apart,
 * so the reader can see both at once and match them. Flagged for the owner as
 * a design cost, not hidden as a design win.
 *
 * `rest.length` IS THE HONEST NUMBER HERE, AND ONLY HERE. The old comment on
 * this file argued a rendered length is never a total — that a list which has
 * been filtered, paginated or virtualised quietly reports less than the server
 * holds. That argument was correct about a heading placed over a DIFFERENT set
 * than it counts, which is exactly what the dock was doing. With the heading
 * sitting on its own rows, the length IS the count, and any future filter or
 * virtualisation on this list must move the number with it or be wrong twice
 * over — which is a failure a reader can see. No server-supplied count is being
 * re-derived: `state` is the server's, and this walks it once.
 *
 * THE LIST SCROLLS AT A BOUND. It went from five rows to seventeen inside a
 * `flex-none` band, so an uncapped list would push the draft report off the
 * screen on the very orders that need it read. `max-h-95` (190px) keeps roughly
 * three rows in view with the rest one scroll away, and the HEADING sits
 * outside the scroller so the number never scrolls away from the rows.
 *
 * `shrink-0` ON EACH ROW IS LOAD-BEARING, NOT DECORATION. A flex column with a
 * max-height shrinks its children to fit BEFORE it will overflow, so at five
 * rows the cap was invisible and at seventeen every row collapsed to a ~10px
 * rule with its text clipped away — a list that looked like a stack of blank
 * lines. Caught in a 1600×1000 capture, not in a test: nothing asserts row
 * height, and the row count was already correct while the rows were unreadable.
 *
 * THE ROW IS THE ENTITY'S. `DecisionRow` is the export's bare-button queue row
 * and it already knows every state a flagged field can be in. It emits
 * `row-{path}` by default; here it is told otherwise, because the draft sheet
 * below is the surface that lists EVERY field and therefore owns that testid.
 */
export function QueueRest({
  fields,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const rest = fields.filter(
    (field) => DECISION_STATES.has(field.state) && field.path !== selectedPath,
  );

  if (rest.length === 0) return null;

  return (
    <section data-testid="queue-rest" className="flex flex-col gap-4 px-9 pb-6">
      <Eyebrow variant="section" tone="muted" as="h2">
        Rest of the queue · {rest.length}
      </Eyebrow>

      <div className="flex max-h-95 flex-col gap-4 overflow-y-auto">
        {rest.map((field) => (
          <Card key={field.id} className="shrink-0 p-0">
            <DecisionRow
              field={field}
              testId={`queue-row-${field.path}`}
              onActivate={() => onSelect(field.path)}
            />
          </Card>
        ))}
      </div>
    </section>
  );
}

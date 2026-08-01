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
 * five rows in view with the rest one scroll away, and the HEADING sits
 * outside the scroller so the number never scrolls away from the rows.
 *
 * ONE CARD, HAIRLINE-DIVIDED — NOT SEVENTEEN CARDS WITH AIR BETWEEN THEM.
 * RULE (mockup, screen 2): the rest of the queue is a single sheet whose rows
 * are separated by the interior 1px rule, at a 36px pitch. FAILURE PREVENTED:
 * each row used to be its own `Card` in a `gap-4` column, which cost 8px of
 * ground per row AND silently disabled the divider — `DecisionRow` draws
 * `border-t … first:border-t-0`, and every row was the first child of its own
 * card, so seventeen rows drew seventeen "first" rows and not one separator.
 * The list read as loose floating slabs at a 47px pitch: three rows visible
 * inside the 190px cap where the mockup shows five, on the surface whose whole
 * job is letting a reviewer see what else is waiting.
 *
 * THE SCROLLER IS THE WRAPPER, NOT THE CARD. `Card` sets `overflow-hidden` so
 * a row's hover fill cannot escape its rounded corner; adding `overflow-y-auto`
 * to that same element leaves two overflow declarations whose winner is
 * stylesheet order, not call order. A plain scrolling wrapper around the card
 * settles it with no class fighting another. It also retires the old
 * `shrink-0`-per-row workaround: the rows are block-level buttons inside a
 * block container now, so nothing can shrink them to a clipped 10px rule.
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

      <div className="max-h-95 overflow-y-auto">
        <Card>
          {rest.map((field) => (
            <DecisionRow
              key={field.id}
              field={field}
              testId={`queue-row-${field.path}`}
              onActivate={() => onSelect(field.path)}
            />
          ))}
        </Card>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { isRuinous } from "./T1Pill";
import type { Section } from "./fieldNaming";

/**
 * THE FIELD LIST — the workstation's left column, built to `reference-app.html`
 * rather than to a guess.
 *
 * Its `isReview` body has TWO panes, not three: this list and the scan. An
 * earlier pass here added a 200px section rail, taken from a `min-width:200px`
 * in the markup that turns out to be the METER CONTAINER IN THE TOP BAR, not a
 * pane. The design has no section rail; sections are blocks in this list.
 *
 * Each section block, measured:
 *
 *     border-bottom 1px #EDEFF3 · padding 18px
 *     header row, baseline, space-between:
 *       sec.title  13px w700 #14161C
 *       sec.pages  11px mono #8A8E98
 *       sec.needText, right
 *
 * ══ THE OPEN DECISION EXPANDS IN PLACE ═════════════════════════════════════
 *
 * The design does not put the decision in a side column — it opens inline,
 * between the rows, under the field it belongs to, with the accent left rail.
 * That is what `renderOpen` is: the screen passes the decision panel and this
 * list drops it directly beneath the selected row.
 *
 * It matters beyond layout. INVARIANT 55 lands a deep link "on the exact field
 * IN CONTEXT", and context is the rows above and below it — the neighbouring
 * fields of the same instrument. A decision parked in a far column has lost the
 * context the invariant is about.
 *
 * ══ `sec.pages` IS NOT DRAWN ═══════════════════════════════════════════════
 *
 * The design prints a page range per section. `Field` (`entities.ts:90`) has
 * `source_page` per field and there is no per-section range on any shape, so
 * the range would have to be composed here out of the rows' own citations. That
 * is a claim about where a section lives, and the pipeline did not make it.
 * The flagged mark is drawn because `Section.flagged` is read from the server's
 * own queue state, never computed.
 *
 * ══ EVERY FIELD IS LISTED; THE CURSOR VISITS ONLY QUEUED ONES ══════════════
 *
 * INVARIANT 27 is a rule about the CURSOR, not about visibility: an
 * auto-confirmed field is still shown, because a reviewer needs to see what the
 * pipeline decided without them. `queue.ts`'s `stepSelection` refuses to land
 * on one; hiding them would answer a different question.
 */
export function FieldQueue(props: {
  readonly sections: readonly Section[];
  readonly selectedId: string | null;
  readonly canSelect: (field: Field) => boolean;
  readonly onSelect: (field: Field) => void;
  /** The open decision, dropped under the row it belongs to. */
  readonly renderOpen: () => ReactNode;
}) {
  return (
    <div className="flex flex-col">
      {props.sections.map((section) => (
        <section
          key={section.id}
          id={`section-${section.id}`}
          className="border-b border-line-subtle px-9 py-9"
        >
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h3 className="text-meta font-bold leading-close text-ink-primary">
              {section.title}
            </h3>
            {section.flagged && (
              <span className="text-label font-semibold leading-flat text-state-attend">
                flagged
              </span>
            )}
          </div>

          {section.fields.map((field) => (
            <div key={field.id}>
              <FieldRow
                field={field}
                selected={field.id === props.selectedId}
                ruinous={isRuinous(field)}
                onSelect={() => {
                  if (props.canSelect(field)) props.onSelect(field);
                }}
              />
              {field.id === props.selectedId && props.renderOpen()}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

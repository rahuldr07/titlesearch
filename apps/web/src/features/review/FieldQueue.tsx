import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { isRuinous } from "./T1Pill";
import type { Section } from "./fieldNaming";

/**
 * THE FIELD LIST — the workstation's middle column above the decision panel.
 *
 * `reference-app.html` groups rows under a section heading carrying the
 * section's title, its pages, and what it still needs. Only the first of those
 * three can be drawn: `Field` (`entities.ts:90`) has no per-section page range
 * and no per-section outstanding note, and `sectionsOf` composes sections from
 * field paths rather than receiving them, so there is nothing to read either
 * from. The heading carries the title and the server's flag, and nothing else
 * is invented to fill the row.
 *
 * ══ EVERY FIELD IS LISTED. NAVIGATION VISITS ONLY THE QUEUED ONES ══════════
 *
 * INVARIANT 27: "Field navigation visits ONLY server-queued fields — a reviewer
 * cannot walk into auto-confirmed fields." That is a rule about the CURSOR, not
 * about visibility: an auto-confirmed field is still shown, because a reviewer
 * needs to see what the pipeline decided without them, and `queue.ts`'s
 * `stepSelection` is what refuses to land on one. Hiding them would answer a
 * different question and lose the coverage the screen exists to show.
 *
 * So rows render for all of them; `onSelect` is only wired for queued rows, and
 * a row the cursor may not take is not a button pretending otherwise.
 *
 * ══ THE ROW IS NOT REBUILT ═════════════════════════════════════════════════
 *
 * `FieldRow` already draws the four tracks, reads the value through `readCited`
 * (the only supported way — `check-rules` enforces it), surfaces A≠B on the row
 * per INVARIANT 28, and takes `ruinous` as a prop because `T1Pill` refuses to
 * decide it. It is used as-is.
 */
export function FieldQueue(props: {
  readonly sections: readonly Section[];
  readonly selectedId: string | null;
  readonly canSelect: (field: Field) => boolean;
  readonly onSelect: (field: Field) => void;
}) {
  return (
    <div className="flex flex-col">
      {props.sections.map((section) => (
        <section key={section.id} id={`section-${section.id}`}>
          <h3
            data-flagged={section.flagged}
            className="sticky top-0 z-10 flex items-center gap-4 border-y border-line-subtle bg-surface-sunken px-8 py-4 text-label font-semibold leading-flat text-ink-faint"
          >
            {section.title}
            {section.flagged && (
              <span aria-hidden className="text-state-attend">
                ◆
              </span>
            )}
          </h3>
          {section.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              selected={field.id === props.selectedId}
              ruinous={isRuinous(field)}
              onSelect={() => {
                if (props.canSelect(field)) props.onSelect(field);
              }}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { isRuinous } from "./T1Pill";
import type { Section } from "./fieldNaming";

/**

 * THE FIELD LIST — the workstation's left column, built to `reference-app.html` rather

 * than to a guess. Its `isReview` body has TWO panes, not three: this list and the

 * scan.

 */
export function FieldQueue(props: {
  readonly sections: readonly Section[];
  /**
   * The design's "Flagged first" toggle. A VIEW ORDER over the sections the
   * server sent, driven by the `flagged` boolean each one already carries —
   * nothing is counted, scored or re-ranked, and the fields inside a section
   * keep the server's order either way (`fieldNaming.ts`: "NOT SORTED BY
   * ANYTHING").
   */
  readonly flaggedFirst: boolean;
  readonly selectedId: string | null;
  readonly canSelect: (field: Field) => boolean;
  readonly onSelect: (field: Field) => void;
  /** The open decision, dropped under the row it belongs to. */
  readonly renderOpen: () => ReactNode;
}) {
  const sections = props.flaggedFirst
    ? [...props.sections].sort((a, b) => Number(b.flagged) - Number(a.flagged))
    : props.sections;

  return (
    <div className="flex flex-col">
      {sections.map((section) => (
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

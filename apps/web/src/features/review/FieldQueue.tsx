import type { ReactNode } from "react";
import type { Field } from "@titlepipe/contract";
import { FieldRow } from "./FieldRow";
import { InlineEdit } from "./InlineEdit";
import { confirmValue } from "../../shared/provenance";
import { isRuinous } from "./ruinous";
import type { Section } from "./fieldNaming";

/** The field list — the workstation's left column. */
export function FieldQueue(props: {
  readonly sections: readonly Section[];
  /**
   * The "Flagged first" toggle. A view order over the sections the server
   * sent, driven by the `flagged` boolean each one already carries —
   * nothing is counted, scored or re-ranked, and the fields inside a
   * section keep the server's order either way.
   */
  readonly flaggedFirst: boolean;
  readonly selectedId: string | null;
  readonly canSelect: (field: Field) => boolean;
  readonly onSelect: (field: Field) => void;
  /**
   * Hovering or focusing a row marks its citation on the sheet. Offered for
   * EVERY row, not only the selectable ones: a settled field's provenance is
   * exactly what a reviewer checking the work behind it wants to see.
   */
  readonly onPreview: (field: Field) => void;
  /** The pointer/focus left that row — the sheet returns to the open field. */
  readonly onPreviewEnd: () => void;
  readonly onEdit: (field: Field) => void;
  readonly editingPath: string | null;
  readonly pending: boolean;
  readonly onSaveInline: (field: Field, value: string) => void;
  readonly onCancelInline: () => void;
  /** The open decision, dropped under the row it belongs to. */
  readonly renderOpen: () => ReactNode;
}) {
  const sections = props.flaggedFirst
    ? [...props.sections].sort((a, b) => Number(b.flagged) - Number(a.flagged))
    : props.sections;

  return (
    <div className="flex flex-col">
      {sections.map((section) => {
        /* The header captions: the section's cited page range in mono
           beside the title, and "N flagged" on the right — the count of
           this section's rows still in the server's queue, the same
           membership `canSelect` reads. Both are summaries of what the rows
           below already show, never a second source. */
        const queued = section.fields.filter(props.canSelect).length;
        const cited = section.fields
          .map((field) => field.source_page)
          .filter((n): n is number => n !== null);
        const range =
          cited.length === 0
            ? null
            : Math.min(...cited) === Math.max(...cited)
              ? `p${Math.min(...cited)}`
              : `p${Math.min(...cited)}–p${Math.max(...cited)}`;
        return (
        <section
          key={section.id}
          id={`section-${section.id}`}
          className="border-b border-line-subtle px-9 py-9"
        >
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <span className="flex min-w-0 items-baseline gap-4">
              <h3 className="text-meta font-bold leading-close text-ink-primary">
                {section.title}
              </h3>
              {range !== null && (
                <span className="font-mono text-label leading-flat tabular-nums text-ink-faint">
                  {range}
                </span>
              )}
            </span>
            {section.flagged && queued > 0 && (
              <span className="text-label font-semibold leading-flat text-ink-muted">
                {queued} flagged
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {section.fields.map((field) => (
            <div key={field.id} onDoubleClick={() => props.onEdit(field)}>
              {props.editingPath === field.path ? (
                <InlineEdit
                  path={field.path}
                  initial={confirmValue(field) ?? ""}
                  pending={props.pending}
                  onSave={(value) => props.onSaveInline(field, value)}
                  onCancel={props.onCancelInline}
                />
              ) : (
                <FieldRow
                  field={field}
                  selected={field.id === props.selectedId}
                  ruinous={isRuinous(field)}
                  onPreview={() => props.onPreview(field)}
                  onPreviewEnd={props.onPreviewEnd}
                  onEdit={() => props.onEdit(field)}
                  onSelect={() => {
                    if (props.canSelect(field)) props.onSelect(field);
                  }}
                />
              )}
              {field.id === props.selectedId && props.renderOpen()}
            </div>
            ))}
          </div>
        </section>
        );
      })}
    </div>
  );
}

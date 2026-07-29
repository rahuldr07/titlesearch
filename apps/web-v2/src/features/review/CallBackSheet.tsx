import type { Field } from "@titlepipe/contract";
import { fieldLabel } from "./fieldLabel";
import { SECTION_HEADING, sectionAnchor, sectionsOf } from "./reportSections";
import { SheetValue } from "./SheetValue";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE DRAFT CALL BACK SHEET — the deliverable, assembled live.
 *
 * This is the third pane of the approved design and the reason the review
 * screen is shaped the way it is: the reviewer is not filling in a form, they
 * are watching a document take shape and deciding whether it can ship. A
 * decision queue with no visible draft asks somebody to approve values one at a
 * time with no sense of what the client will actually receive.
 *
 * SECTION HEADINGS MATCH THE DELIVERED WORD DOCUMENT, and every value cites the
 * page it was read from. The citation is not decoration: a sheet whose values
 * cannot be traced back to a page is the exact artefact principle 6 exists to
 * prevent, and seeing the cites here is how a missing one gets noticed before
 * delivery rather than after a complaint.
 *
 * IT IS READ-ONLY. Decisions happen in the queue, on one field, with a reason.
 * An editable draft is a bulk-edit surface wearing a document's clothes.
 */
export function CallBackSheet({
  fields,
  selectedPath,
  onSelect,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  return (
    <Card data-testid="call-back-sheet">
      <CardHeader filled>
        <Eyebrow variant="section">Draft — Abstractor Call Back Sheet</Eyebrow>
      </CardHeader>
      <CardBody className="flex flex-col gap-8">
        <p className="max-w-2xl text-xs leading-body text-ink-muted">
          Section headings match the delivered Word document exactly. Every
          value cites the page it was read from.
        </p>

        {sectionsOf(fields).map(([section, rows]) => (
          <section key={section} id={sectionAnchor(section)} className="flex scroll-mt-16 flex-col gap-3">
            <Eyebrow variant="caption">
              {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
            </Eyebrow>
            <dl className="flex flex-col">
              {rows.map((field) => (
                <div
                  key={field.id}
                  className="grid gap-2 border-t border-line-subtle py-3 first:border-t-0 sm:grid-cols-[13rem_1fr]"
                >
                  <dt>
                    <button
                      type="button"
                      data-testid={`sheet-${field.path}`}
                      onClick={() => onSelect(field.path)}
                      className={
                        field.path === selectedPath
                          ? "text-left font-mono text-xs font-semibold text-action underline"
                          : "text-left font-mono text-xs text-ink-secondary"
                      }
                    >
                      {fieldLabel(field.path)}
                    </button>
                  </dt>
                  <dd>
                    <SheetValue field={field} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}

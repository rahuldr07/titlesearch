import type { ReactNode } from "react";
import type { Field } from "@titlepipe/contract";
import {
  SECTION_HEADING,
  sectionAnchor,
  sectionPageOf,
  sectionsOf,
} from "./reportSections";
import { SheetRow } from "./SheetRow";
import { Card, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE DRAFT CALL BACK SHEET — the deliverable, assembled live.
 *
 * This is what the review screen is shaped around: the reviewer is not filling
 * in a form, they are watching a document take shape and deciding whether it
 * can ship. A decision queue with no visible draft asks somebody to approve
 * values one at a time with no sense of what the client will actually receive.
 *
 * IT IS THE ONLY PLACE A SETTLED VALUE APPEARS. There used to be a second,
 * full-width list of the same fields a screen-height above this one — headed
 * `SETTLED 15 — look, do not re-decide` — so every value on the order was
 * printed twice and the six decisions that needed a person sat between the two
 * copies. Deleting it is the point of this rework: settled work belongs in the
 * document it is going into, not in a ledger beside it.
 *
 * SECTION HEADINGS MATCH THE DELIVERED WORD DOCUMENT, and every value cites the
 * page it was read from. The citation is not decoration: a sheet whose values
 * cannot be traced back to a page is the exact artefact principle 6 exists to
 * prevent, and seeing the cites here is how a missing one gets noticed before
 * delivery rather than after a complaint.
 *
 * EACH SECTION IS THE ANCHOR THE RAIL POINTS AT (`sectionAnchor`), and the
 * grouping is `sectionsOf` — the same function the rail walks, so a link and
 * the section it names can never drift into two different splits. The page ref
 * on the band head is `sectionPageOf`, the same call the rail makes, so the
 * page a reviewer read on the rail is the page they land beside.
 *
 * THE DECISION OPENS IN THE ROW IT BELONGS TO (`renderDecision`).
 *
 * The card used to sit in a separate docked block above this sheet, so a
 * reviewer read a question in one band and the value it was about in another,
 * with the answered rows of the queue in between — and the sheet below printed
 * every one of those values a second time. Opening the card UNDER ITS OWN ROW
 * puts the question, the draft line it will change, and its section's other
 * lines in one column, which is the arrangement that lets somebody notice that
 * a lender name they are about to confirm disagrees with the mortgage two rows
 * down.
 *
 * IT IS A SLOT, NOT FOURTEEN PROPS. The decision card needs every write handler
 * on the screen; threading those through this component and `SheetRow` would
 * make two presentational files carry the whole mutation surface as
 * pass-through parameters, and every future handler would touch three files.
 * The caller renders the card and hands it over; this component decides only
 * WHERE it goes. `undefined` renders the sheet read-only, which is what the
 * delivered-order and story surfaces want.
 *
 * THE SHEET IS STILL READ-ONLY IN ITSELF. Nothing here edits a value: the only
 * interactive things are row selection and whatever the caller puts in the
 * slot, which is one field's decision card with its reasons and its refusals.
 * An editable draft is a bulk-edit surface wearing a document's clothes.
 */
export function CallBackSheet({
  fields,
  selectedPath,
  onSelect,
  renderDecision,
}: {
  fields: readonly Field[];
  selectedPath: string;
  onSelect: (path: string) => void;
  /**
   * The open decision, drawn beneath the row it decides. Omitted on read-only
   * surfaces — the draft is a document there, not a workstation.
   */
  renderDecision?: ((field: Field) => ReactNode) | undefined;
}) {
  return (
    <section data-testid="call-back-sheet" className="flex flex-col gap-5">
      <Eyebrow variant="section">Draft — Abstractor Call Back Sheet</Eyebrow>
      <p className="max-w-2xl text-xs leading-body text-ink-secondary">
        Section headings match the delivered Word document exactly. Every value cites
        the page it was read from.
      </p>

      {sectionsOf(fields).map(([section, rows]) => {
        const page = sectionPageOf(rows);
        return (
          <Card key={section} id={sectionAnchor(section)} className="scroll-mt-16">
            <CardHeader filled>
              <div className="flex items-baseline gap-4">
                <Eyebrow variant="section">
                  {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
                </Eyebrow>
                {page === null ? null : (
                  <span className="font-mono text-tiny text-ink-muted">p{page}</span>
                )}
              </div>
            </CardHeader>
            <div>
              {rows.map((field) => {
                const isSelected = field.path === selectedPath;
                return (
                  <div key={field.id}>
                    <SheetRow
                      field={field}
                      selected={isSelected}
                      onSelect={() => onSelect(field.path)}
                    />
                    {isSelected && renderDecision !== undefined ? (
                      /* The card belongs to the row above it, so it sits inside
                         the row's own fill rather than floating on the card's
                         ground — the two read as one open line, not as a panel
                         that happens to be adjacent. */
                      <div
                        data-testid="open-decision"
                        className="border-t border-line-subtle bg-action-surface px-7 pb-7 pt-2"
                      >
                        {renderDecision(field)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </section>
  );
}

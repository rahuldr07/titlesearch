import type { Field } from "@titlepipe/contract";
import { SECTION_HEADING, sectionAnchor, sectionsOf } from "./reportSections";
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
 * the section it names can never drift into two different splits.
 *
 * IT IS READ-ONLY. Decisions happen in the dock, on one field, with a reason.
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
    <section data-testid="call-back-sheet" className="flex flex-col gap-5">
      <Eyebrow variant="section">Draft — Abstractor Call Back Sheet</Eyebrow>
      <p className="max-w-2xl text-xs leading-body text-ink-secondary">
        Section headings match the delivered Word document exactly. Every value cites
        the page it was read from.
      </p>

      {sectionsOf(fields).map(([section, rows]) => (
        <Card key={section} id={sectionAnchor(section)} className="scroll-mt-16">
          <CardHeader filled>
            <Eyebrow variant="section">
              {SECTION_HEADING[section] ?? section.replaceAll("_", " ")}
            </Eyebrow>
          </CardHeader>
          <div>
            {rows.map((field) => (
              <SheetRow
                key={field.id}
                field={field}
                selected={field.path === selectedPath}
                onSelect={() => onSelect(field.path)}
              />
            ))}
          </div>
        </Card>
      ))}
    </section>
  );
}

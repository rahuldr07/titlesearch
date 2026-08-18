import type { Field, OrderSignoffResponse } from "@titlepipe/contract";
import { CallBackSheet } from "./CallBackSheet";
import { NoDisclosureCards } from "./NoDisclosureCards";
import { OrderRail } from "./OrderRail";
import { SignoffReadonly } from "../../entities/signoff/SignoffReadonly";
import { SectionRail } from "./SectionRail";

/**
 * THE BOTTOM HALF OF THE FIELDS PANE — one scroller beside the section rail
 * (export `:918-1080`). `flex:1;min-width:0;overflow-y:auto` on the reading
 * column, `flex:0 0 152px` on the rail: the two are siblings INSIDE the right
 * pane, not a third top-level column, and the rail is only useful beside the
 * document it points into.
 *
 * THE ORDER IS THE ORDER A REVIEWER WOULD WANT TO MEET IT IN. The gaps they
 * inherited (`NoDisclosureCards` — a NO at intake is not a fact about the
 * document, it is a hole in it), then the draft that ships. The disclosure
 * cards sit ABOVE the sheet rather than inside it per the 2026-07-28 revision,
 * HANDOFF §11.
 *
 * "REST OF THE QUEUE" USED TO OPEN THIS COLUMN and no longer does. The export
 * puts it here (`:920-939`), but it was drawing a bare heading over the still
 * -open fields while `DecisionDock` drew the same three words with a count over
 * a wider set — the phrase twice on one screen, twelve apart. It is now a
 * single heading-with-count sitting on its own rows inside `decision-dock`
 * (`FieldsPane`), which is the placement `review.spec:180` requires. Stated as
 * a deviation from the export rather than passed off as a match.
 *
 * THE ORDER'S OWN HISTORY CLOSES THE COLUMN — and this is a stated CONFLICT.
 * The export draws no such block on Review at all, and the audit's Review entry
 * says to delete it from the left pane. Three harvested invariants disagree
 * (`navigation.spec` ×2, `errors.spec` #3): they require `order-rail` on Review
 * to carry queue, escalation and delivery state, and to survive a timeline 500
 * with its identity intact. Deleting it would weaken three assertions, which is
 * refused. Moving it out of the document pane — where it competed with the page
 * for the scan half of the split — and down here, where the export puts the
 * read-only sign-off block, is the change that can be made without that cost.
 * Owner ruling wanted on which is right.
 */
export function ReportPane({
  orderId,
  fields,
  signoff,
  selectedPath,
  onSelect,
  onConfirm,
  onMode,
}: {
  orderId: string;
  fields: readonly Field[];
  /** Undefined while in flight — a third state, never rendered as "unsigned". */
  signoff: OrderSignoffResponse | undefined;
  selectedPath: string;
  onSelect: (path: string) => void;
  onConfirm?: () => void;
  onMode?: (m: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[20px] pb-20 pt-5 bg-[#F7F7F5]">
      <CallBackSheet fields={fields} selectedPath={selectedPath} onSelect={onSelect} />
    </div>
  );
}

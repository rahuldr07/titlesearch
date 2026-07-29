import type { Field, FieldReading } from "@titlepipe/contract";
import { DocumentColumn } from "./DocumentColumn";
import { OrderCoverageSpine } from "./CoverageSpine";
import { OrderRail } from "./OrderRail";

/**
 * The left column: the document, and what it takes to trust it — full-package
 * coverage and the order's own history. Split out of `ReviewScreen` to keep
 * that file under the file's own size limit; these three already had nothing
 * to do with the decision-and-sheet column beside them.
 */
export function EvidenceColumn({
  orderId,
  field,
  pinnedReading,
}: {
  orderId: string;
  field: Field;
  pinnedReading: FieldReading | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <DocumentColumn orderId={orderId} field={field} pinned={pinnedReading} />
      <OrderCoverageSpine orderId={orderId} />
      <OrderRail orderId={orderId} />
    </div>
  );
}

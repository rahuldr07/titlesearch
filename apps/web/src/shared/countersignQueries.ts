import { CountersignsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** THE T1 SECOND READ'S READ. Landed 2026-08-28 with `field.countersign`. */

/**
 * Which of this order's rulings carry ruinous exposure, as the SERVER
 * classifies them — `required` is the list, and `countersigned_by` on each
 * entry is the only thing that says a second read exists. The workstation never
 * infers either from a field's `rule_refs` or from who is signed in.
 */
export function countersigns(id: string): ReadDescriptor<CountersignsResponse> {
  return {
    path: `/api/orders/${id}/countersigns`,
    key: ["orders", id, "countersigns"],
    schema: CountersignsResponse,
  };
}

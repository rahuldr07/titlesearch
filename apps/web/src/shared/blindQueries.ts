import { ReconciliationResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** THE ONE ORDER, NAMED ONCE (rule 11: one variable, never two literals). */
export const CAPTURE_ORDER = "ord_demo_1";

export function reconciliation(id: string): ReadDescriptor<ReconciliationResponse> {
  return {
    path: `/api/reconciliation/${id}`,
    key: ["reconciliation", id],
    schema: ReconciliationResponse,
  };
}

/** The capture write. */
export function blindEntriesPath(id: string): string {
  return `/api/blind/${id}/entries`;
}

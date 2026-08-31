import { CaptureScheduleResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** The one order, named once. */
export const CAPTURE_ORDER = "ord_demo_1";

/**
 * `GET /api/blind/{order}/schedule` — the sheet to key, in keying order.
 * Blind-side by construction: no value, no confidence, no engine on the shape.
 */
export function captureSchedule(id: string): ReadDescriptor<CaptureScheduleResponse> {
  return {
    path: `/api/blind/${id}/schedule`,
    key: ["blind", id, "schedule"],
    schema: CaptureScheduleResponse,
  };
}

/** The capture write. */
export function blindEntriesPath(id: string): string {
  return `/api/blind/${id}/entries`;
}

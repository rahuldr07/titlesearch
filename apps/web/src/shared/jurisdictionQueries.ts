import { JurisdictionResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * `GET /api/jurisdictions/{code}` — which rules bind here, and how each of the
 * four absences is written out. The code is part of the cache key: switching
 * jurisdiction is a different read, never the same one re-labelled.
 */
export function jurisdiction(code: string): ReadDescriptor<JurisdictionResponse> {
  return {
    path: `/api/jurisdictions/${code}`,
    key: ["jurisdictions", code],
    schema: JurisdictionResponse,
  };
}

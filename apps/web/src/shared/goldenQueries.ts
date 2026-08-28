import { GoldenResponse, type GoldenField } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** `GET /api/golden` — the whole corpus, in one read. */
export const goldenSet: ReadDescriptor<{ golden_fields: GoldenField[] }> = {
  path: "/api/golden",
  key: ["golden"],
  schema: GoldenResponse,
};

import { ClientsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * `GET /api/clients` (workspace.ts:131) — the roster AND the checklists
 * resolved against it arrive in ONE response, which is why one descriptor
 * serves both of intake's consumers.
 *
 * Kept out of `queries.ts` on the 150-line gate, as `accountQueries` and
 * `templateQueries` were before it. It was spelled twice before this:
 * `ClientPicker` and `RulebookBanner` each wrote `["clients"]` and the path
 * inline, which is two caches of one GET — rule 11's "one variable, never two
 * literals" in the form that fails silently, as a second fetch nobody asked
 * for.
 */
export const clients: ReadDescriptor<ClientsResponse> = {
  path: "/api/clients",
  key: ["clients"],
  schema: ClientsResponse,
};

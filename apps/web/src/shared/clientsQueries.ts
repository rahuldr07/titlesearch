import { ClientsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * `GET /api/clients` — the roster and the checklists resolved against it
 * arrive in one response, which is why one descriptor serves both of
 * intake's consumers.
 */
export const clients: ReadDescriptor<ClientsResponse> = {
  path: "/api/clients",
  key: ["clients"],
  schema: ClientsResponse,
};

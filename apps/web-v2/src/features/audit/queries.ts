import { queryOptions } from "@tanstack/react-query";
import { AuditResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The audit record. READ-ONLY BY CONSTRUCTION — there is no write, amend or
 * delete endpoint in the contract, and this module deliberately exports no
 * mutation hook. A log with an edit path is not a log.
 *
 * The client appends nothing either: entries are written server-side as a
 * consequence of the acts they record, so an act that fails cannot leave a
 * record saying it happened.
 *
 * CONTRACT GAP: `GET /api/audit` takes no query parameters — no actor, no
 * entity, no date range, no cursor. The design draws Person / Order / Action
 * filters over this list and none of them can be sent to the server, so the
 * screen renders the controls inert rather than filtering client-side over
 * whatever slice happened to arrive.
 */
export const auditQuery = queryOptions({
  queryKey: ["audit"],
  queryFn: () => get("/api/audit", AuditResponse),
});

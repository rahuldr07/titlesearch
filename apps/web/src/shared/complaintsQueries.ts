import { ComplaintsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE COMPLAINT LOOP'S ONE READ.
 *
 * Split out of `queries.ts` on the same seam `accountQueries.ts` uses: that
 * file is the pipeline (the queue, an order, its fields, its census) and this
 * is what happens AFTER delivery — a client naming a defect in a report that
 * already shipped. Different screen, different role (`authz.ts:71`,
 * `ops`/`admin`), nothing on either side names a path on the other.
 *
 * Same rule as both neighbours: this file carries the DESCRIPTION of a read
 * and never performs one, because `check-rules.mjs`'s `presentational-fetches`
 * keeps `@tanstack/react-query` out of `shared/` entirely. `app/useRead.ts` is
 * the three lines that fetch.
 *
 * ══ THERE IS NO SECOND RULEBOOK DESCRIPTOR HERE ════════════════════════════
 *
 * Resolving a complaint needs the rulebook, and the rulebook already has ONE
 * descriptor — `accountQueries.rules`, key `["rules"]`. The complaints screen
 * imports that one. Rule 11 ("one variable, never two literals") restated for
 * cache keys, and `queries.ts` records why it matters more here than for a
 * number: two spellings of one read are two caches, and two caches of the
 * rulebook fail SILENTLY — as a rule that is `pending` in one pane and `live`
 * in another, which is precisely the distinction `INVARIANTS:38` turns on.
 *
 * ══ THERE IS NO PER-ORDER COMPLAINT DESCRIPTOR ═════════════════════════════
 *
 * `GET /api/complaints` is shop-wide and takes no filter (handlers.ts:1021).
 * A per-order variant is not merely absent from the contract — a screen that
 * asked "which complaints does THIS order have" would want an order to ask
 * about, and there is no browse endpoint to get one from (`endpoints.ts:69`,
 * `INVARIANTS:22`). The complaint carries its own `order_id` and the row
 * prints it.
 */

/** `endpoints.ts:658` ships the schema with no companion `type` to import. */
type ComplaintsShape = ReturnType<typeof ComplaintsResponse.parse>;

export const complaints: ReadDescriptor<ComplaintsShape> = {
  path: "/api/complaints",
  key: ["complaints"],
  schema: ComplaintsResponse,
};

import { ReconciliationResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE BLIND-FIFTY LAYER'S SURFACE, AND IT IS ALMOST ENTIRELY A WRITE.
 *
 * Split out of `queries.ts` on the same seam `accountQueries.ts` was: the
 * blind protocol is a MEASUREMENT PROGRAMME, not the pipeline. Temp typists
 * hand-key fields from a package while structurally blind to the machine and
 * to each other; their entries are reconciled later to measure real accuracy.
 * Nothing on either side of that seam names a path on the other.
 *
 * Same rule as both neighbours: this file carries the DESCRIPTION of a read and
 * performs none, because `check-rules.mjs`'s `presentational-fetches` keeps
 * `@tanstack/react-query` out of `shared/`. `app/useRead.ts` is the three lines
 * that fetch.
 *
 * ══ WHAT IS DELIBERATELY ABSENT, AND WHY IT IS NOT AN OVERSIGHT ════════════
 *
 * There is no `blindEntries` read here. `POST /api/blind/{order}/entries`
 * (endpoints.ts:295-307) is the WHOLE blind surface, and its own contract note
 * says why the read does not exist:
 *
 *     "the response is deliberately minimal. This endpoint physically cannot
 *      return model output or the other seat's entries; blindness is enforced
 *      server-side and verified by a security test, not a UI test. Widening
 *      this response shape is a design defect."
 *
 * So a `GET /api/blind/{order}/entries` descriptor would not be a convenience
 * this file is missing — it would be the design defect that note names, and
 * INVARIANT 46 ("the capture seat has no rail — structural blindness stays
 * whole") is the same refusal expressed as chrome. There is likewise no seat
 * roster, no per-seat progress and no `/api/blind-status` of any kind; both
 * screens render `ContractGap` where those would be, rather than a shape.
 */

/**
 * THE ONE ORDER, NAMED ONCE (rule 11: one variable, never two literals).
 *
 * Both screens are order-scoped and NEITHER may offer a picker: there is no
 * browse/list/search endpoint in the contract, it was removed BY CONSTRUCTION
 * (endpoints.ts:69, :77-82), and INVARIANT 22 makes the way in a server hand-
 * over rather than a chooser. `/blind` and `/blind-status` are not order-scoped
 * routes — they take no path param (authz.ts:76-77) — so until the seat is
 * handed an order the way the queue hands one over, the id is stated here as
 * the demo package and is visible as such on both screens.
 */
export const CAPTURE_ORDER = "ord_demo_1";

/**
 * THE ONLY READ THE PROGRAMME HAS. Symmetric A/B — the model is not a party to
 * a divergence (`Reconciliation`, entities.ts:202-214), which is exactly what
 * makes it safe to read on an OPS screen and not on the seat.
 *
 * It is a read of RULED-ON DISAGREEMENTS, not of progress: a divergence row
 * exists only where two seats already keyed the same path and differed. It
 * cannot say who is seated, how far anyone has got, or whether a package is
 * finished, and `features/blindStatus` says so in place rather than inferring.
 */
export function reconciliation(id: string): ReadDescriptor<ReconciliationResponse> {
  return {
    path: `/api/reconciliation/${id}`,
    key: ["reconciliation", id],
    schema: ReconciliationResponse,
  };
}

/**
 * The capture write. A function rather than a constant for the same reason the
 * order-scoped reads are: the id belongs in one spelling, and a template
 * literal at the call site is the second one.
 */
export function blindEntriesPath(id: string): string {
  return `/api/blind/${id}/entries`;
}

import type { ScreenDescriptor } from "./unbuiltScreens";

/**

 * The order-scoped screens still awaiting a build. Separate from `unbuiltScreens.ts`

 * because they are wired by hand rather than looped: each takes a path param, and it

 * is the hand-written `createRoute` that makes a misspelled param a compile error.

 *

 * REVIEW_SCREEN is GONE from this file, deliberately: the Examination Workstation is

 * built (`WorkstationScreen` at `/orders/{id}/review`), and its once-missing contract

 * surface landed under RULING-2026-08-28 — `Countersign`/`CountersignsResponse` and

 * `POST /api/fields/{id}/countersign` in `packages/contract/src/design.ts`, plus

 * `field.countersign` in PERMISSIONS (`authz.ts`). A descriptor claiming otherwise

 * was a false comment rendered on screen.

 */
export const BLIND_SEAT_SCREEN: ScreenDescriptor = {
  path: "/blind/{id}",
  screen: "Capture seat",
  binds:
    "POST /api/blind/{order}/entries (endpoints.ts:295) · BlindEntryInput (entities.ts:289)",
  missing:
    "Blindness is enforced SERVER-side and verified by a security test, not a UI test (endpoints.ts:290-294). INVARIANT 46: this seat gets no rail at all.",
};

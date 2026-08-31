import type { ScreenDescriptor } from "./unbuiltScreens";

/**
 * The order-scoped screens still awaiting a build. Separate from
 * `unbuiltScreens.ts` because they are wired by hand rather than looped:
 * each takes a path param, and the hand-written `createRoute` makes a
 * misspelled param a compile error.
 */
export const BLIND_SEAT_SCREEN: ScreenDescriptor = {
  path: "/blind/{id}",
  screen: "Capture seat",
  binds:
    "POST /api/blind/{order}/entries (endpoints.ts:295) · BlindEntryInput (entities.ts:289)",
  missing:
    "Blindness is enforced SERVER-side and verified by a security test, not a UI test (endpoints.ts:290-294). INVARIANT 46: this seat gets no rail at all.",
};

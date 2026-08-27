import type { ScreenDescriptor } from "./unbuiltScreens";

/**
 * THE TWO ORDER-SCOPED SCREENS. Separate from `unbuiltScreens.ts` because they
 * are wired by hand rather than looped: both take a path param, and it is the
 * hand-written `createRoute` that makes a misspelled param a compile error.
 *
 * They also carry the two largest blocking questions in the build, which is
 * reason enough for them not to be buried in the middle of a fifteen-row list.
 */
export const REVIEW_SCREEN: ScreenDescriptor = {
  path: "/orders/{id}",
  screen: "Review",
  binds:
    "OrderFieldsResponse (endpoints.ts:169) · Field (entities.ts:90) · OrderCensus (:160) · SourcePage (:642)",
  missing:
    "Backend conversation 1, the largest gap. The design's 'T1 second read / countersign' has NO contract surface: no second-read entity, no countersign endpoint, no countersigned_by on Field, no such action in PERMISSIONS. Reconciliation (entities.ts:202) is a DIFFERENT mechanism — blind-typist capture quality, not post-ruling QC — and binding one to the other would silently redefine what the blind protocol measures. A countersign with no contract surface is OPEN, and AGENTS.md forbids building past OPEN.",
};

export const BLIND_SEAT_SCREEN: ScreenDescriptor = {
  path: "/blind/{id}",
  screen: "Capture seat",
  binds:
    "POST /api/blind/{order}/entries (endpoints.ts:295) · BlindEntryInput (entities.ts:289)",
  missing:
    "Blindness is enforced SERVER-side and verified by a security test, not a UI test (endpoints.ts:290-294). INVARIANT 46: this seat gets no rail at all.",
};

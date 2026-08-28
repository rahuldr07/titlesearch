/**
 * IS THE READER STANDING AT THE CAPTURE SEAT? One predicate, because the answer
 * has to be the same in every place the chrome asks it — and it was not.
 *
 * INVARIANT 46: "The capture seat has NO rail — structural blindness stays
 * whole." `rootRoute.tsx` implemented that as `!pathname.startsWith("/blind")`
 * around `SideRail`, with a comment that states the principle correctly:
 * "structural blindness includes the navigator: the rail names worlds (Review,
 * Escalations, Golden set) a typist must not see."
 *
 * ══ THE RAIL WAS NOT THE ONLY NAVIGATOR ════════════════════════════════════
 *
 * `CommandPalette` is mounted unconditionally and gated on ROLE, not path.
 * Measured on `/blind` with the dev-default admin session: Ctrl+K opened and
 * listed every door in the product —
 *
 *     Overview · Queue · Intake · Lifecycle · Delivery · REVIEW · Escalations ·
 *     Complaints · Reconciliation · Golden set · Seed correction · Bench ·
 *     Engines · Capture seat · Capture status · Account
 *
 * — including Review, which is the machine's output and the one world the blind
 * protocol exists to withhold. The rail was hidden and the same doors were one
 * chord away, which defeats the reasoning the rail comment had already written
 * down. Role-gating is specifically what that comment rejects: "an admin
 * standing at the seat is still at the seat, and gating on role would draw the
 * full rail for exactly the person most likely to be demonstrating the
 * protocol." The palette did exactly that.
 *
 * ══ AND IT CAUGHT A DOOR IT SHOULD NOT HAVE ════════════════════════════════
 *
 * `startsWith("/blind")` also matches `/blind-status`, which is not the seat —
 * it is the OPS read of how capture is going (`authz.ts`: `screen.blind-status.enter`
 * is `["ops", "admin"]`, while `screen.blind.enter` is `["typist", "admin"]`).
 * Two different doors for two different worlds, and the ops one was landing
 * with no navigation at all.
 *
 * So the test is the seat's own paths and nothing else: `/blind` exactly, and
 * `/blind/{orderId}` beneath it. A prefix match on the string `"/blind"` is
 * what conflated them, and this is the fix stated once so the three callers
 * cannot drift.
 */
export function isCaptureSeat(pathname: string): boolean {
  return pathname === "/blind" || pathname.startsWith("/blind/");
}

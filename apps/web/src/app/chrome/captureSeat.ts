/**
 * Is the reader standing at the capture seat? One predicate, because the
 * answer has to be the same in every place the chrome asks it. The capture
 * seat has no rail — structural blindness stays whole.
 */
export function isCaptureSeat(pathname: string): boolean {
  return pathname === "/blind" || pathname.startsWith("/blind/");
}

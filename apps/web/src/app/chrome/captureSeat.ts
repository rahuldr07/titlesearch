/**
 * IS THE READER STANDING AT THE CAPTURE SEAT? One predicate, because the answer has to
 * be the same in every place the chrome asks it — and it was not. INVARIANT 46: "The
 * capture seat has NO rail — structural blindness stays whole.".
 */
export function isCaptureSeat(pathname: string): boolean {
  return pathname === "/blind" || pathname.startsWith("/blind/");
}

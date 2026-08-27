/**
 * THE ONE PLACE DATE HANDLING LIVES (§8).
 *
 * `scripts/check-rules.mjs` names this file as `DATE_UTILITY` and bans date
 * construction everywhere else. The rule predates the file; this creates it.
 *
 * WHY THE RULE EXISTS. `new Date("2024-03-15")` parses as UTC MIDNIGHT and then
 * renders in the reader's local zone, so west of Greenwich it displays as
 * 2024-03-14. On this product that is a recording date on an instrument, and a
 * recording date that moves by a day changes which lien is senior.
 *
 * SO CALENDAR DATES ARE OPAQUE STRINGS. A date the server sent is a date the
 * server sent: it is not parsed, not normalised, not re-rendered in a locale.
 * That is why this file exports no date FORMATTER: the correct handling of a
 * document date is to pass the server's string through untouched, and a
 * function to do nothing is a function someone will later make do something.
 * When a real formatting need arrives it belongs here and nowhere else.
 *
 * THE ONE INSTANT. `nowIso` is a wall-clock reading of UTC, which is a
 * different thing from a calendar date and does not carry the bug above. It is
 * here rather than inlined so the codebase has exactly one date construction
 * and `check-rules.mjs` has one line to point at.
 */

/**
 * The current instant, ISO 8601, UTC.
 *
 * The one legitimate date construction in the app. A crash timestamp or a
 * client-side correlation instant is a POINT IN TIME, not a calendar date: it
 * has no local-midnight ambiguity because it is not a date literal being
 * parsed, it is the clock being read.
 */
export function nowIso(): string {
  return new Date().toISOString(); // rules-allow: reading the clock for an instant, not parsing a calendar date (§8)
}

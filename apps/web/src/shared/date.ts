/**
 * The one place date handling lives. `check-rules.mjs` names this file as
 * `DATE_UTILITY` and bans date construction everywhere else.
 * `new Date("2024-03-15")` parses as UTC midnight and renders a day early
 * west of Greenwich — on a recording date, that changes which lien is
 * senior. So calendar dates are opaque strings: never parsed, normalised,
 * or re-rendered in a locale, which is also why this file exports no
 * formatter. When a real formatting need arrives it belongs here.
 */

/**
 * The current instant, ISO 8601, UTC — the one legitimate date construction
 * in the app. An instant is the clock being read, not a date literal being
 * parsed, so it has no local-midnight ambiguity.
 */
export function nowIso(): string {
  return new Date().toISOString(); // rules-allow: reading the clock for an instant, not parsing a calendar date (§8)
}

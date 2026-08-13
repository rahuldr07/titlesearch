/**
 * Dates as OPAQUE STRINGS. The one module allowed to touch date formatting —
 * `scripts/check-rules.mjs` fails the build on `new Date(` anywhere else.
 *
 * Why this exists (BRIEF §8): recording dates are legally significant, and
 *
 *     new Date("2024-03-15")
 *
 * parses as UTC midnight, so in any negative-offset timezone it renders as
 * **03/14/2024** — a recording date one day early in a delivered report. That is
 * a real client-facing defect, and it is invisible to anyone developing in UTC
 * or ahead of it.
 *
 * The fix is not "be careful with Date". It is to never construct one. These
 * functions do string manipulation only — there is no `Date` in this file, so
 * there is no timezone to get wrong. That also means they are correct in every
 * environment without configuration, which a `Date`-based implementation never
 * quite is.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` → `MM/DD/YYYY`, the format the delivered report uses.
 *
 * Returns null rather than guessing when the input is not a plain ISO date.
 * A caller that renders null as a blank is at least visibly wrong; a caller
 * that renders a silently shifted date is not.
 */
export function formatRecordingDate(iso: string): string | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const [, year, month, day] = m;
  if (!year || !month || !day) return null;
  if (!isRealCalendarDate(Number(year), Number(month), Number(day))) return null;
  return `${month}/${day}/${year}`;
}

/** True only for a date that exists — rejects 2024-02-30 and 2023-02-29. */
export function isRealCalendarDate(year: number, month: number, day: number): boolean {
  // Integers only. This is exported, and `(2024, 1.5, 1)` used to return true.
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Chronological comparison without parsing. ISO dates are lexicographically
 * ordered by construction, which is the whole reason the format is used on the
 * wire — so sorting is a string compare and cannot drift by a timezone.
 */
export function compareRecordingDates(a: string, b: string): number {
  // Refuse to ORDER what we would refuse to FORMAT. Sorting unvalidated
  // strings put garbage silently at the end of a chain of title, which reads
  // as "most recent instrument" — the worst possible place for it.
  if (!ISO_DATE.test(a) || !ISO_DATE.test(b)) {
    throw new Error(
      `compareRecordingDates needs YYYY-MM-DD; got ${JSON.stringify([a, b])}`,
    );
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

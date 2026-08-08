/**
 * Money as an OPAQUE STRING or integer cents. Display only.
 *
 * BRIEF §8: the server sends integer cents or a decimal string — never a float.
 * There is no arithmetic in this file and there must never be any in the
 * browser. A consideration amount that is off by a cent because it round-tripped
 * through a binary float is a defect nobody notices until a client does.
 *
 * `parseFloat` is deliberately absent. Formatting a decimal STRING is a string
 * operation: split on the point, group the integer part, done. Converting to a
 * number first is the only way to introduce error, so we never do it.
 */

/*
 * Leading zeros are REJECTED, not tolerated. `"0000001234.00"` used to format
 * as `"$0,000,001,234.00"` — the zeros preserved and then comma-grouped, in a
 * delivered legal report. A wire value with leading zeros is a malformed wire
 * value, and guessing what it meant is exactly what this module refuses to do.
 */
const DECIMAL = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/;

/** Integer cents → `$1,234.56`. Exact: no division, no float. */
export function formatCents(cents: number): string | null {
  if (!Number.isSafeInteger(cents)) return null;
  const negative = cents < 0;
  const abs = Math.abs(cents).toString().padStart(3, "0");
  const whole = abs.slice(0, -2);
  const fraction = abs.slice(-2);
  return `${negative ? "-" : ""}$${group(whole)}.${fraction}`;
}

/**
 * A decimal string from the wire → `$1,234.56`, without ever becoming a number.
 * Returns null on anything unrecognised rather than rendering a guess.
 */
export function formatDecimalString(value: string): string | null {
  const m = DECIMAL.exec(value.trim());
  if (!m) return null;
  const [, sign, whole, fraction] = m;
  if (whole === undefined) return null;
  // "-0" is not a quantity anyone meant to send.
  if (sign === "-" && whole === "0" && (fraction ?? "").replace(/0/g, "") === "")
    return null;
  return `${sign}$${group(whole)}.${(fraction ?? "").padEnd(2, "0")}`;
}

/** Thousands separators by string slicing — no locale machinery, no rounding. */
function group(digits: string): string {
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return out;
}

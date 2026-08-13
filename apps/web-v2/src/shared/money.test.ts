import { describe, expect, test } from "vitest";
import { formatCents, formatDecimalString } from "./money";

/**
 * money.ts had NO TEST FILE of its own — it was tested inside date.test.ts,
 * which is exactly why two real bugs survived: `"0000001234.00"` formatted as
 * `"$0,000,001,234.00"`, leading zeros preserved and then comma-grouped, in a
 * value bound for a delivered legal report.
 *
 * The rule this file enforces: when the wire sends something malformed, REFUSE.
 * Never guess what it meant. A null renders as a visible gap; a guess renders
 * as a number somebody will rely on.
 */

describe("integer cents format exactly", () => {
  test("ordinary amounts", () => {
    expect(formatCents(22022400)).toBe("$220,224.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(-2500)).toBe("-$25.00");
    expect(formatCents(999)).toBe("$9.99");
  });

  test("grouping is correct at every boundary", () => {
    expect(formatCents(100000)).toBe("$1,000.00");
    expect(formatCents(99999)).toBe("$999.99");
    expect(formatCents(100000000)).toBe("$1,000,000.00");
  });

  test("non-integers and unsafe integers are refused, not rounded", () => {
    // `isSafeInteger` -> `isInteger` was mutation M2: 1e21 then formatted as
    // "$1e+.21", because the exponent notation reached the string slicing.
    expect(formatCents(1.5)).toBeNull();
    expect(formatCents(Number.NaN)).toBeNull();
    expect(formatCents(Infinity)).toBeNull();
    expect(formatCents(1e21)).toBeNull();
    expect(formatCents(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
  });
});

describe("decimal strings format without ever becoming a number", () => {
  test("ordinary amounts", () => {
    expect(formatDecimalString("220224.00")).toBe("$220,224.00");
    expect(formatDecimalString("1234.5")).toBe("$1,234.50");
    expect(formatDecimalString("0.99")).toBe("$0.99");
    expect(formatDecimalString("0")).toBe("$0.00");
    expect(formatDecimalString("1000000")).toBe("$1,000,000.00");
    expect(formatDecimalString("-25.00")).toBe("-$25.00");
  });

  test("a value a float would corrupt survives exactly", () => {
    expect(formatDecimalString("70.10")).toBe("$70.10");
    expect(formatDecimalString("999999999999.99")).toBe("$999,999,999,999.99");
    // Beyond IEEE-754 integer precision — a parseFloat implementation loses this.
    expect(formatDecimalString("9007199254740993.01")).toBe(
      "$9,007,199,254,740,993.01",
    );
  });

  test("LEADING ZEROS ARE REFUSED — the bug that shipped", () => {
    // "$0,000,001,234.00" was the actual output before this test existed.
    expect(formatDecimalString("0000001234.00")).toBeNull();
    expect(formatDecimalString("007")).toBeNull();
    expect(formatDecimalString("00.50")).toBeNull();
    // A single leading zero before the point is legitimate.
    expect(formatDecimalString("0.50")).toBe("$0.50");
  });

  test("negative zero is refused", () => {
    expect(formatDecimalString("-0")).toBeNull();
    expect(formatDecimalString("-0.00")).toBeNull();
  });

  test("unrecognised input is refused rather than guessed", () => {
    for (const bad of [
      "",
      "abc",
      "1,234.00",
      "$100",
      "1.234",
      "1e5",
      "1.",
      ".5",
      "--5",
      "1 234",
      "NaN",
      "Infinity",
      "0x10",
    ]) {
      expect(formatDecimalString(bad), `"${bad}" should be refused`).toBeNull();
    }
  });

  test("surrounding whitespace is tolerated", () => {
    // Documented deliberately: money trims, dates do not. The asymmetry was
    // previously untested and therefore accidental.
    expect(formatDecimalString(" 100 ")).toBe("$100.00");
  });
});

import { describe, expect, test } from "vitest";
import { compareRecordingDates, formatRecordingDate, isRealCalendarDate } from "./date";

describe("recording dates never shift by a timezone", () => {
  test("formats without parsing", () => {
    expect(formatRecordingDate("2024-03-15")).toBe("03/15/2024");
    expect(formatRecordingDate("1998-01-01")).toBe("01/01/1998");
    expect(formatRecordingDate("2024-12-31")).toBe("12/31/2024");
  });

  /**
   * The defect this module exists to prevent. `new Date("2024-03-15")` is UTC
   * midnight, so `.getDate()` returns 14 anywhere west of Greenwich. This test
   * asserts our output is independent of that — it is a pure string transform,
   * so the process timezone cannot reach it.
   */
  test("the day never moves, whatever the host timezone", () => {
    expect(formatRecordingDate("2024-03-15")).toContain("15");
    expect(formatRecordingDate("2024-03-15")).not.toContain("14");
    // A Date-based implementation would fail this in US timezones.
    expect(formatRecordingDate("2024-01-01")).toBe("01/01/2024");
  });

  test("refuses anything that is not a plain ISO date, rather than guessing", () => {
    for (const bad of [
      "2024-3-15",
      "15/03/2024",
      "2024-03-15T00:00:00Z",
      "",
      "not a date",
      "2024-03",
      "20240315",
    ]) {
      expect(formatRecordingDate(bad)).toBeNull();
    }
  });

  test("refuses dates that do not exist", () => {
    expect(formatRecordingDate("2023-02-29")).toBeNull();
    expect(formatRecordingDate("2024-02-30")).toBeNull();
    expect(formatRecordingDate("2024-13-01")).toBeNull();
    expect(formatRecordingDate("2024-04-31")).toBeNull();
    expect(formatRecordingDate("2024-02-29")).toBe("02/29/2024"); // leap year
  });

  test("leap years follow the real rule, including the century cases", () => {
    expect(isRealCalendarDate(2000, 2, 29)).toBe(true); // divisible by 400
    expect(isRealCalendarDate(1900, 2, 29)).toBe(false); // divisible by 100
    expect(isRealCalendarDate(2024, 2, 29)).toBe(true);
  });

  test("day zero and month zero are refused", () => {
    // Untested before: the suite checked 02-29/02-30/13-01/04-31 but never a
    // zero component, which is why dropping `day < 1` (mutation M1) survived.
    expect(formatRecordingDate("2024-03-00")).toBeNull();
    expect(formatRecordingDate("2024-00-15")).toBeNull();
    expect(formatRecordingDate("2024-00-00")).toBeNull();
  });

  test("isRealCalendarDate takes integers only", () => {
    // Exported, so callable directly. `(2024, 1.5, 1)` used to return true.
    expect(isRealCalendarDate(2024, 1.5, 1)).toBe(false);
    expect(isRealCalendarDate(2024, 2, 28.5)).toBe(false);
    expect(isRealCalendarDate(2024.2, 2, 28)).toBe(false);
    expect(isRealCalendarDate(2024, 2, 28)).toBe(true);
  });

  test("comparing refuses what formatting would refuse", () => {
    // Sorting unvalidated strings put garbage at the END of a chain of title,
    // where it reads as the most recent instrument.
    expect(() => compareRecordingDates("2024-01-01", "garbage")).toThrow(/YYYY-MM-DD/);
    expect(() => compareRecordingDates("", "2024-01-01")).toThrow(/YYYY-MM-DD/);
  });

  test("sorts chronologically as strings", () => {
    const dates = ["2024-03-15", "1998-01-01", "2024-01-02"];
    expect([...dates].sort(compareRecordingDates)).toEqual([
      "1998-01-01",
      "2024-01-02",
      "2024-03-15",
    ]);
  });
});

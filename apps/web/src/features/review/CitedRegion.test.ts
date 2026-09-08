import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The provenance mark is drawn over EVIDENCE. Two properties of it are not
 * visible to tsc, eslint, check-rules or a story, and both were wrong on the
 * first real county package rendered as rasters (2026-09-04):
 *
 *  1. It painted the region with a translucent fill. A region is not always a
 *     line — a value found by reading down a judgment index cites the union of
 *     every block that fed it, which measured 62% of p69 — and a wash over two
 *     thirds of a scanned page hides the ink the reviewer is being asked to
 *     check.
 *  2. The sheet held a raster to the typeset paper column (198 = 396px), at
 *     which a recorded instrument is unreadable and a one-line citation is
 *     about six device pixels tall.
 *
 * Both are source assertions, like `FieldRow.test.ts`: there is no other layer
 * that sees whether a rectangle is filled or how wide a photograph is allowed
 * to be.
 */
const HERE = new URL(".", import.meta.url).pathname;
const source = (name: string): string => readFileSync(`${HERE}${name}`, "utf8");
/** The code, without the prose — the note explaining a removed class must not
    read as the class still being there. */
const code = (name: string): string => source(name).replace(/\/\*[\s\S]*?\*\//g, "");

test("the provenance mark outlines the region and never fills it", () => {
  const region = code("CitedRegion.tsx");
  const rects = region.match(/<rect[\s\S]*?\/>/g) ?? [];
  expect(rects.length).toBeGreaterThan(0);
  for (const rect of rects) {
    expect(rect, "every rect in the mark is an outline").toContain("fill-none");
  }
  // The specific class that covered the page. Named so a reinstatement fails
  // here rather than on someone's screen.
  expect(region).not.toContain("fill-action");
});

test("a raster is wider than the typeset paper column, and still a length", () => {
  const sheet = code("PageSheet.tsx");
  // The width is a choice between the two surfaces, not one constant applied
  // to both: `w-198` is the measure a page is TYPESET to.
  const widths = /raster === null \? "w-(\d+)" : "w-(\d+)"/.exec(sheet);
  expect(
    widths,
    "PageSheet must pick a fixed width per surface — a percentage cancels the `zoom` magnifier",
  ).not.toBeNull();
  const paper = Number(widths?.[1] ?? 0);
  const raster = Number(widths?.[2] ?? 0);
  expect(raster).toBeGreaterThan(paper);
});

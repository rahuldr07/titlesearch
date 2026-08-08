import { expect } from "storybook/test";
import { luminance } from "../../entities/document/luminance";

/**
 * THE GATE's assertions, split from `PageFacsimile.stories.tsx` so the story
 * file stays a catalogue. What it pins: THE DOCUMENT DOES NOT INVERT — the
 * surround darkens, the page stays light, in both registers at once.
 */
export async function assertFacsimileThemeGate(canvasElement: HTMLElement) {
  const inks = [...canvasElement.querySelectorAll("figure pre")];
  await expect(inks).toHaveLength(2);
  const sheets = inks.map((pre) => pre.parentElement as HTMLElement);
  const panes = inks.map(
    (pre) => pre.closest("div.bg-surface-document") as HTMLElement,
  );

  // VACUITY GUARD, REWRITTEN 2026-08-01: without it every assertion below
  // would pass by rendering the light theme twice. The SURROUND was the
  // probe until the reskin gave `--color-surface-document` the mockup's dark
  // viewer surround in BOTH theme blocks — it is now identical across the two
  // panes and proves nothing. Probing a chrome token's computed value proves
  // the same thing directly: the attribute selector really re-declared the
  // custom properties on this subtree.
  const chrome = panes.map((p) =>
    getComputedStyle(p).getPropertyValue("--color-surface-panel"),
  );
  await expect(chrome[0]).not.toEqual(chrome[1]);

  // The surround is dark in BOTH registers now — the stronger form of
  // "the surround darkens, the page does not".
  for (const pane of panes) {
    await expect(luminance(getComputedStyle(pane).backgroundColor)).toBeLessThan(0.1);
  }

  for (const sheet of sheets) {
    await expect(luminance(getComputedStyle(sheet).backgroundColor)).toBeGreaterThan(
      0.8,
    );
  }
  for (const ink of inks) {
    await expect(luminance(getComputedStyle(ink).color)).toBeLessThan(0.05);
  }

  // Not merely "both light" — the SAME light. The page is one artefact.
  await expect(getComputedStyle(sheets[0] as HTMLElement).backgroundColor).toEqual(
    getComputedStyle(sheets[1] as HTMLElement).backgroundColor,
  );

  // The citation marker is the most load-bearing mark in the product. A
  // blend mode makes it depend on the ground beneath it; multiply over a
  // dark ground turned it into a redaction bar.
  const marks = [...canvasElement.querySelectorAll("[aria-hidden] span")];
  await expect(marks).toHaveLength(2);
  for (const mark of marks) {
    await expect(getComputedStyle(mark).mixBlendMode).toEqual("normal");
  }
  await expect(getComputedStyle(marks[0] as Element).backgroundColor).toEqual(
    getComputedStyle(marks[1] as Element).backgroundColor,
  );
}

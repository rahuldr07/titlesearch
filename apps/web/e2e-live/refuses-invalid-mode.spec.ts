import { expect, test } from "@playwright/test";

/**
 * THE REFUSAL HAS TO BE LEGIBLE, and until this spec existed it was not.
 *
 * `resolveApiMode` throws inside an async function invoked as `void boot()`, so
 * an unrecognised `VITE_API_MODE` was an unhandled rejection and a WHITE PAGE.
 * "Refuses rather than falling back" was true of the control flow and useless
 * to the person looking at the browser, who saw nothing at all and had no
 * reason to open a console.
 *
 * This project's bundle is built with `VITE_API_MODE=liv` — the typo the
 * refusal exists for. That the bundle can be built at all is deliberate:
 * vite.config.ts warns about the value rather than rejecting it, precisely so
 * this assertion can exist. A refusal nobody can build is a refusal nobody can
 * test, and an untestable check is the artefact class this plan keeps finding.
 */
test("an unrecognised VITE_API_MODE refuses on screen, not in the console", async ({
  page,
}) => {
  await page.goto("/rulebook");

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  // The message must name the variable and quote what it actually got, because
  // "invalid configuration" sends the reader looking in the wrong place.
  await expect(alert).toContainText("VITE_API_MODE");
  await expect(alert).toContainText('got "liv"');

  // Refused, not degraded: no mock rows, and no app.
  await expect(page.getByTestId("rule-row-R13")).toHaveCount(0);
});

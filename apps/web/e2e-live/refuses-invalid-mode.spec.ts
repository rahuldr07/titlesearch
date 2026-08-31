import { expect, test } from "@playwright/test";

/**
 * The refusal has to be legible: an unrecognised `VITE_API_MODE` must
 * refuse on screen, not as an unhandled rejection and a white page. This
 * project's bundle is built with `VITE_API_MODE=liv` — the typo the
 * refusal exists for. That the bundle can be built at all is deliberate:
 * vite.config.ts warns about the value rather than rejecting it, precisely
 * so this assertion can exist.
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

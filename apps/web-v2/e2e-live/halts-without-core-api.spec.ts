import { expect, test } from "@playwright/test";

/**
 * THE DENIAL. `VITE_API_MODE=live` with nothing behind `/api`: the rulebook
 * must show its halt state and must NOT show mock rows.
 *
 * This is the assertion the plan's PROOF names, and on its own it proves very
 * little — a working switch, a broken proxy and an app that does not run all
 * score full marks. `reaches-core-api.spec.ts` is what separates them; read the
 * two together or neither.
 *
 * The half that IS load-bearing here is the second assertion. A build that
 * claimed to be live while MSW answered would render R13 happily, and would
 * then certify every endpoint of the migration against the mock it was supposed
 * to be replacing.
 */
test("the rulebook halts rather than falling back to mock rows", async ({ page }) => {
  await page.goto("/rulebook");

  await expect(page.getByRole("alert")).toHaveText("Rulebook unavailable.");
  await expect(page.getByTestId("rule-row-R13")).toHaveCount(0);
});

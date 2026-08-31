import { expect, test } from "@playwright/test";

/**
 * The denial: `VITE_API_MODE=live` with nothing behind `/api` — the
 * rulebook must show its halt state and must not show mock rows. On its
 * own this proves little; `reaches-core-api.spec.ts` is what separates a
 * working switch from a broken proxy — read the two together or neither.
 * The load-bearing half is the second assertion: a build that claimed to
 * be live while MSW answered would certify the migration against the mock
 * it was supposed to be replacing.
 */
test("the rulebook halts rather than falling back to mock rows", async ({ page }) => {
  await page.goto("/rulebook");

  await expect(page.getByRole("alert")).toHaveText("Rulebook unavailable.");
  await expect(page.getByTestId("rule-row-R13")).toHaveCount(0);
});

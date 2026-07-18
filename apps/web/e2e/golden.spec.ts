import { expect, test } from "@playwright/test";

/**
 * Golden Set + Seed Correction (§4.9): corrections require source + reason
 * + signature (contract-enforced), permanent-log framing, NO timers, and
 * capture never shows the pipeline's draft.
 */

test("capture is blind and structured; don't-know ≠ not-stated", async ({
  page,
}) => {
  await page.goto("/golden");
  await expect(
    page.getByText("You never see the pipeline's draft here", { exact: false }),
  ).toBeVisible();
  await page.getByTestId("golden-ZIP").fill("30296");
  await expect(page.getByTestId("fixture-line")).toContainText(
    '"ZIP": "30296"',
  );
  // DON'T KNOW and NOT STATED are different objects
  await page
    .getByRole("button", { name: "DON'T KNOW" })
    .first()
    .click();
  await expect(page.getByTestId("fixture-line")).toContainText("__DONT_KNOW__");
  await page.getByRole("button", { name: "NOT STATED" }).first().click();
  await expect(page.getByTestId("fixture-line")).toContainText(
    "__NOT_STATED__",
  );
});

test("no timers anywhere on golden capture", async ({ page }) => {
  await page.goto("/golden");
  await expect(page.getByTestId("fixture-line")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/\btimer\b/);
  expect(body).not.toMatch(/\d+:\d\d elapsed/);
  expect(body).toContain("this is reading, not queue-clearing");
});

test("seed correction is refused without citation + reason + signature", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_1");
  const btn = page.getByTestId("seed-correct-btn");
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("a correction with no source is an opinion");
  await page.getByTestId("seed-new-value").fill("$220,224.00");
  await expect(btn).toBeDisabled();
  await page.getByTestId("seed-cite").fill("security deed p 3, amount in words");
  await expect(btn).toBeDisabled();
  await page
    .getByTestId("seed-reason")
    .fill("words read Two Hundred Twenty Thousand; the seed followed smudged numerals");
  await expect(btn).toBeDisabled(); // still unsigned
  await page.getByTestId("seed-signed").fill("M. Estrada");
  await expect(btn).toBeEnabled();
});

test("a correction upgrades the tag to ruled and lands in the permanent log", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_1");
  await page.getByTestId("seed-new-value").fill("$220,224.00");
  await page.getByTestId("seed-cite").fill("security deed p 3, amount in words");
  await page.getByTestId("seed-reason").fill("words prevail over numerals — §5");
  await page.getByTestId("seed-signed").fill("M. Estrada");
  await page.getByTestId("seed-correct-btn").click();
  await expect(page.getByTestId("seed-tag")).toHaveText("ruled");
  await expect(page.getByTestId("seed-value")).toHaveText("$220,224.00");
  const log = page.getByTestId("seed-log");
  await expect(log).toContainText("M. Estrada — corrected");
  await expect(log).toContainText("$202,224.00 → $220,224.00");
});

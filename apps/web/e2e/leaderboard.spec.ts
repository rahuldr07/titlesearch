import { expect, test } from "@playwright/test";

/**
 * Engine Leaderboard (§4.15): NO TRUTH YET cells literal; seat change
 * demands evidence and shows who/when after; no aggregate headline, no
 * auto-promotion.
 */

test("a cell below golden coverage reads NO TRUTH YET, not zero", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  const cell = page.getByTestId("lb-gemini-2.5-flash-hartford-ct-vesting_deed");
  await expect(cell).toHaveText("NO TRUTH YET");
  await expect(
    page.getByText("NO TRUTH YET is not a zero", { exact: false }),
  ).toBeVisible();
});

test("undeclared capability renders — (never a faked score)", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await expect(
    page.getByTestId("lb-pdftotext-clayton-ga-mortgages"),
  ).toHaveText("—");
});

test("a seat flip is refused without evidence, then logged with who/when", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await page.getByTestId("lb-claude-api-hartford-ct-mortgages").click();
  await page.getByTestId("flip-A").click();
  const confirm = page.getByTestId("confirm-flip");
  await expect(confirm).toBeDisabled();
  await page.getByTestId("evidence-input").fill("bench://run-47");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const seatA = page.getByTestId("seat-A");
  await expect(seatA).toContainText("A: claude-api");
  await expect(seatA).toContainText("approved by m.okafor");
  await expect(seatA).toContainText("evidence bench://run-47");
});

test("no aggregate headline, no auto-promotion affordance", async ({
  page,
}) => {
  await page.goto("/leaderboard");
  await expect(
    page.getByText("THERE IS NO BEST ENGINE", { exact: false }),
  ).toBeVisible();
  await page.getByTestId("lb-claude-api-clayton-ga-mortgages").click();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).toContain("no auto-promotion");
  expect(body).not.toMatch(/best engine:\s/);
  const buttons = await page.getByRole("button").allInnerTexts();
  for (const b of buttons) {
    expect(b.toLowerCase()).not.toMatch(/auto|promote all/);
  }
});

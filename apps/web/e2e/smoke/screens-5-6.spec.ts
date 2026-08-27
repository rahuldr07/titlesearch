import { expect, test } from "@playwright/test";

/**
 * SMOKE — the two screens this commit built, and the three objects it REFUSED
 * to build.
 *
 * Not a harvested invariant: `e2e/invariants/ingest.spec.ts` carries the
 * product rules for intake and its assertions are untouched. This file exists
 * for the other half of the work, which no invariant covers because it is an
 * ABSENCE — and an absence nobody asserts is an absence somebody will
 * helpfully fill in with a convincing mock six months from now.
 *
 * Design §Screens 5 and 6 draw three things with no contract surface: the
 * quarantine gateway checklist, the optical profile card, and the dark
 * streaming terminal. Each renders an honest statement instead
 * (`entities/gap/BackendGap.tsx`), and each of those statements is pinned
 * here so that replacing one with a drawn mock fails the suite.
 */
test("intake states the two unbacked objects rather than drawing them", async ({
  page,
}) => {
  await page.goto("/ingest");
  const gaps = page.getByTestId("backend-gap");
  await expect(gaps).toHaveCount(2);
  await expect(gaps.filter({ hasText: "Quarantine gateway" })).toBeVisible();
  await expect(gaps.filter({ hasText: "Optical profile" })).toBeVisible();

  // No sha256 is rendered as data — the contract carries none. It arrives
  // only inside the server's 409 prose, which `ingest.spec` #3 pins.
  await expect(page.getByTestId("sha256")).toHaveCount(0);
});

test("the client is chosen from the server's roster, never typed", async ({
  page,
}) => {
  await page.goto("/ingest");
  // A free-text client_id is a mistype away from the wrong sign-off checklist.
  await expect(page.getByTestId("order-client_id")).toHaveCount(0);
  await expect(page.getByTestId("rulebook-banner-idle")).toBeVisible();
  await page.getByTestId("choice-client-cli_riverbend").check();
  // The rulebook layers are the SERVER's resolution, listed rather than tallied.
  await expect(page.getByTestId("rulebook-banner")).toBeVisible();
  await expect(page.getByTestId("rulebook-line").first()).toBeVisible();
});

test("extraction draws the server's stages, matrix and exceptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("extraction")).toBeVisible();

  // One row per stage the SERVER sent. The screen adds none and drops none.
  const stages = page.getByTestId("stage-timeline").locator("li");
  await expect(stages).toHaveCount(9);
  await expect(page.getByTestId("classifier-note")).not.toBeEmpty();
  await expect(page.getByTestId("page-matrix").locator("li").first()).toBeVisible();

  // The run-log terminal is a REFUSAL (entities.ts:17-19), not a gap to fill.
  await expect(
    page.getByTestId("backend-gap").filter({ hasText: "Run log terminal" }),
  ).toBeVisible();

  expect(errors, "extraction must mount without throwing").toEqual([]);
});

test("a page cell opens the workstation at that page — URL-owned selection", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1");
  await expect(page.getByTestId("page-matrix")).toBeVisible();
  await page.getByTestId("page-matrix").locator("button").first().click();
  // INVARIANT 55: selection lives in the URL, so it survives a reload and a
  // paste. Component state would survive neither.
  await expect(page).toHaveURL(/[?&]page=\d+/);
});

import { expect, test } from "@playwright/test";

/**
 * The hub at "/" — the map, live. Role-aware doors (absent, never dimmed),
 * each carrying its attention signal; amber is the only navigation signal.
 * Typists never reach it. Forbidden patterns stay out: no order counts
 * beyond the single next, no accuracy numbers, nothing throughput-shaped.
 */

test("/ renders the hub with live attention signals", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  // an order is waiting — named, single, no backlog count
  await expect(page.getByTestId("door-/queue")).toContainText(
    "waiting — DEMO-0001",
  );
  // open escalations pull amber
  await expect(page.getByTestId("door-/escalations")).toContainText(
    "open — rules gaps",
  );
  // a delivery stuck in transit pulls amber
  await expect(page.getByTestId("door-/delivery")).toContainText(
    "failed in transit — retryable",
  );
  // unresolved complaints are the hot-red signal
  await expect(page.getByTestId("door-/complaints")).toContainText(
    "unresolved",
  );
  // a rule draft waits at the engineer gate
  await expect(page.getByTestId("door-/account")).toContainText(
    "pending the engineer gate",
  );
});

test("the hub's doors are role-locked — absent, never dimmed", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  // reach the hub by chord — a goto would reset the in-memory session
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  await expect(page.getByTestId("door-/queue")).toBeVisible();
  await expect(page.getByTestId("door-/dashboard")).toHaveCount(0);
  await expect(page.getByTestId("door-/bench")).toHaveCount(0);
  await expect(page.getByTestId("door-/leaderboard")).toHaveCount(0);
});

test("g h jumps home from anywhere; ⏎ opens the role's first door", async ({
  page,
}) => {
  await page.goto("/queue");
  await expect(page.getByTestId("order-ref")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/queue/);
});

test("typists cannot chord to the hub", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Me" }).click();
  await page.getByTestId("role-typist").click();
  await page.keyboard.press("g");
  await page.keyboard.press("h");
  await expect(page).toHaveURL(/\/account/);
});

test("nothing forbidden leaks onto the hub", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-hub")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("throughput");
  expect(body).not.toContain("per hour");
  expect(body).not.toMatch(/accuracy\s*[:—-]?\s*\d/);
  expect(body).not.toMatch(/\d+\s+orders?\s+(waiting|in queue)/);
});

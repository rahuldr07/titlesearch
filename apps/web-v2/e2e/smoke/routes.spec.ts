import { expect, test } from "@playwright/test";

/**
 * SMOKE — every route renders without throwing.
 *
 * This is NOT a harvested invariant and asserts nothing about product rules.
 * It exists because a screen can typecheck, lint clean and still die on mount,
 * and most of the screens in this app are reached only from the chrome menu or
 * the account dropdown — places no invariant spec navigates. Without this, a
 * broken screen stays green until somebody clicks it.
 *
 * It fails on two things a rendering screen never does: an uncaught page error,
 * or the router's not-found card where a real screen was expected.
 */
const ROUTES = [
  "/",
  "/queue",
  "/overview",
  "/ingest",
  "/questions",
  "/processing",
  "/completeness",
  "/orders/ord_demo_1/review",
  "/delivered",
  "/escalations",
  "/rulebook",
  "/products",
  "/clients",
  "/people",
  "/audit",
  "/profile",
  "/signin",
  "/session",
  "/surface-failure",
  "/gallery",
];

for (const route of ROUTES) {
  test(`renders ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(route);
    // The app shell is client-rendered; wait for anything of our own to exist.
    await expect(page.locator("main, header").first()).toBeVisible();

    expect(errors, `uncaught error on ${route}`).toEqual([]);
    await expect(page.getByTestId("not-found")).toHaveCount(0);
  });
}

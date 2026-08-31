import { expect, test } from "@playwright/test";

/**
 * Smoke — every route renders without throwing. Asserts nothing about
 * product rules: a screen can typecheck, lint clean, and still die on
 * mount, and many screens are reached only from the chrome menu. Fails on
 * an uncaught page error, or the router's not-found card where a real
 * screen was expected.
 */
/*
 * The list is the door table (authz.ts), copied rather than invented — a
 * route not in it is unreachable by design. The two order-scoped forms are
 * added by hand: a screen-entry permission guards a route prefix, so the
 * door covers what is beneath it.
 */
const ROUTES = [
  "/",
  "/orders-list",
  "/orders",
  "/ingest",
  "/delivery",
  "/escalations",
  "/templates",
  "/jurisdiction",
  "/account",
  "/blind",
  "/orders/ord_demo_1",
  "/orders/ord_demo_1/review",
  "/orders/ord_demo_1/release",
  "/blind/ord_demo_1",
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

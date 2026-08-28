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
/*
 * THE LIST IS THE DOOR TABLE, and it is copied rather than invented.
 * `packages/contract/src/authz.ts:62-81` is frozen and IS the set of reachable
 * paths; a route not in it is unreachable by design. The previous version of
 * this list named ten screens from an app that no longer exists (/questions,
 * /rulebook, /gallery …) and passed anyway, because a not-found card renders
 * without throwing.
 *
 * The two order-scoped forms are added by hand: `authz.ts:50` says a
 * screen-entry permission guards a route PREFIX, so the door covers what is
 * beneath it.
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

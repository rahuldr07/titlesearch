import { expect, test } from "@playwright/test";

/**
 * SMOKE — the surfaces built under RULING-2026-08-29 ("complete the UI fully,
 * as the reference app draws it") render their drawn elements from the wire.
 *
 * These are presence checks, not invariants: each asserts that a drawn
 * affordance exists and binds to served data. The rules behind them (server
 * refusals, no client derivation) live in `e2e/invariants`.
 */

test("release compiler: pending values are amber links that name their field", async ({
  page,
}) => {
  await page.goto("/orders/ord_demo_1/release");
  // A served pending row draws as a clickable, dashed jump to the workstation.
  const pending = page.getByTestId("pending-mortgages.1.lender");
  await expect(pending).toBeVisible();
  await expect(pending).toHaveAttribute(
    "href",
    /\/orders\/ord_demo_1\/review\?.*field=mortgages/,
  );
  // The gate line is a door the SERVER named (blocked_door).
  await expect(page.getByTestId("release-open-blocker")).toBeVisible();
});

test("delivered: the four receipt steps, the reason radios and the ledger statuses draw", async ({
  page,
}) => {
  await page.goto("/delivery");
  // The first delivered order's receipt carries the four drawn steps.
  await expect(page.getByText("Release signed & sealed").first()).toBeVisible();
  await expect(page.getByText("SHA-256 digest recorded").first()).toBeVisible();
  await expect(page.getByText("Client acknowledged receipt").first()).toBeVisible();
  // The reissue gateway offers the SERVED canned reasons as radios.
  await expect(page.getByTestId("reissue-reasons").getByRole("radio")).toHaveCount(3);
});

test("delivered: the v1/v2 pair reads supersession off the server's rows", async ({
  page,
}) => {
  await page.goto("/delivery");
  // The complained-about order holds the v1/v2 defect pair.
  await page.getByTestId("delivered-order-ord_demo_13").click();
  await expect(page.getByText("Superseded · retained")).toBeVisible();
  await expect(page.getByText(/supersedes v1/)).toBeVisible();
  await expect(page.getByText(/Reason: A value in the delivered report/)).toBeVisible();
});

test("templates architect: catalog, live sheet, split diff, inspector and save draw", async ({
  page,
}) => {
  await page.goto("/templates");
  await expect(page.getByTestId("template-tpl_mc_co_v4")).toBeVisible();
  await expect(page.getByTestId("sheet-block-vesting")).toBeVisible();
  // NA simulation swaps in the SERVED declaration string.
  await page.getByTestId("na-sim-unreadable").click();
  await expect(page.getByTestId("sheet-na-vesting")).toContainText("Unreadable on source deed");
  // Split diff draws baseline against the client's phrasing.
  await page.getByRole("radio", { name: "Split diff" }).click();
  await expect(page.getByTestId("diff-vesting")).toContainText("Product baseline default");
  // The drawn Save exists (live for the admin dev-default seat).
  await expect(page.getByTestId("template-save")).toBeVisible();
});

test("settings: the RBAC matrix cycles a cell through the server", async ({ page }) => {
  await page.goto("/account?tab=access");
  const cell = page.getByTestId("rbac-orders.intake-Engineer");
  await expect(cell).toHaveAttribute("data-level", "none");
  await cell.click();
  // The server cycles — → VIEW and the pane repaints from its answer.
  await expect(cell).toHaveAttribute("data-level", "view");
  // The Admin column is locked and says so.
  const admin = page.getByTestId("rbac-orders.intake-Admin");
  await expect(admin).toBeDisabled();
});

test("settings: the people pane draws the served role picker", async ({ page }) => {
  await page.goto("/account?tab=people");
  await expect(page.getByTestId("person-role-u2")).toBeVisible();
});

test("audit log: a ruling appends a live entry", async ({ page }) => {
  await page.goto("/escalations");
  await page
    .getByTestId("ruling-input")
    .fill("A hit is ours when name + county match during our grantor's ownership.");
  await page.getByTestId("cite-select").getByRole("combobox").fill("R13");
  await page.getByRole("option", { name: /^R13 / }).click();
  await page.getByTestId("resolve-btn").click();
  await expect(page.getByText("✓ Rule written — cluster cleared.")).toBeVisible();
  // NO page.goto — a reload restarts the mock worker and re-seeds its stores,
  // which would erase the very append being asserted. Walk in-app instead.
  await page.getByRole("link", { name: "Settings & RBAC" }).click();
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByText("escalations · esc_party_1")).toBeVisible();
});

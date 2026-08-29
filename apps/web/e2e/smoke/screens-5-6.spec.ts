import { expect, test } from "@playwright/test";

/**
 * SMOKE — screens 5 and 6, what they draw from the wire, and what they still
 * REFUSE to draw.
 *
 * Not a harvested invariant: `e2e/invariants/ingest.spec.ts` carries the
 * product rules for intake and its assertions are untouched. This file pins
 * the rest: what is served renders as SERVER data, and what is not served
 * renders an honest statement — because an absence nobody asserts is an
 * absence somebody will helpfully fill in with a convincing mock six months
 * from now.
 *
 * HISTORY, so nobody restores the old pins: this file used to assert that the
 * quarantine gateway checklist and the optical profile card were gap cards and
 * that no sha256 rendered as data. The 2026-08-28 ruling added
 * `QuarantineResponse` (design2.ts:35-42) and `GET /api/orders/{id}/quarantine`
 * (mocks design.ts:318), so those assertions pinned a false premise and are
 * replaced — with pins on the WIRE rendering, which is the same discipline
 * pointed at the surface that now exists. The dark streaming terminal stays a
 * refusal (entities.ts:17-19), and the product select stays a real gap
 * (CreateOrderRequest, endpoints.ts:39-46).
 */
test("intake renders quarantine and optical verdicts from the wire, and states the one real gap", async ({
  page,
}) => {
  await page.goto("/ingest");

  // The one gap left on this screen: product, the second half of the
  // checklist key. Quarantine and optical are no longer allowed to be gaps.
  const gaps = page.getByTestId("backend-gap");
  await expect(gaps).toHaveCount(1);
  await expect(gaps.filter({ hasText: "Product" })).toBeVisible();

  // Before any upload there is no order to read quarantine against, and the
  // banner's gate strip says so — amber with the TRUE reason, never a mock.
  await page.getByTestId("choice-client-cli_riverbend").check();
  await expect(page.getByTestId("rulebook-gate")).toHaveAttribute(
    "data-state",
    "unrun",
  );

  // Upload, so the order exists and the gateway is readable.
  await page.getByTestId("order-external_ref").fill("DEMO-9002");
  await page.getByTestId("order-jurisdiction").fill("clayton-ga");
  await page.getByTestId("order-state").fill("GA");
  await page.getByTestId("order-county").fill("Clayton");
  await page.getByTestId("package-input").setInputFiles({
    name: "pkg_smoke_upload.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 smoke package bytes"),
  });
  await page.getByRole("button", { name: "upload the package" }).click();

  // One row per step the SERVER sent, each carrying the server's state.
  const steps = page.getByTestId("quarantine-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toHaveAttribute("data-state", "passed");

  // The digest is DATA now (QuarantineResponse.sha256), rendered verbatim.
  await expect(page.getByTestId("sha256")).toContainText("sha256");
  await expect(page.getByTestId("sha256")).toContainText("8e2f1d9a");

  // Optical verdicts are the server's `ok`, never a threshold compared here —
  // the mock's contrast row is the server saying no, and it renders as sent.
  const readings = page.getByTestId("optical-reading");
  await expect(readings).toHaveCount(3);
  await expect(
    readings.filter({ hasText: "Contrast floor" }),
  ).toHaveAttribute("data-ok", "false");
  await expect(readings.filter({ hasText: "Contrast floor" })).toContainText(
    "flagged under Law 3",
  );

  // The amber→green flip: every gateway step reports passed, so the strip is
  // green — a rendering of the server's states, not a client verdict.
  await expect(page.getByTestId("rulebook-gate")).toHaveAttribute(
    "data-state",
    "passed",
  );
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

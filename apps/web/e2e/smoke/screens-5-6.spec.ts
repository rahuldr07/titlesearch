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
 * pointed at the surface that now exists. The dark terminal's refusal was
 * superseded on 2026-08-29 (docs/frontend/design-2026-08/RULING-2026-08-29.md:
 * "the extraction terminal log … they are drawn, so they are built") — the
 * panel now renders the pipeline's served `run_log`, and this file pins THAT.
 */
/**
 * ⚠ REWRITTEN 2026-08-29 under RULING-2026-08-29: the gateway checklist and
 * optical profile render INLINE the moment a file lands (the pre-order scan
 * `POST /api/intake/quarantine` serves them — no upload act precedes the
 * read any more), the Product gap card is retired (`CreateOrderRequest`
 * carries `product`; the select is drawn), and the amber→green flip is the
 * drawn rulebook note fed by the server's `resolved` block.
 */
test("intake runs the gateway inline on file drop and renders the server's verdicts", async ({
  page,
}) => {
  await page.goto("/ingest");

  // No gap cards remain on this screen: product is a drawn select now.
  await expect(page.getByTestId("backend-gap")).toHaveCount(0);
  await expect(page.getByTestId("product-select")).toBeVisible();

  // Before a file lands nothing has scanned: the note is amber with the
  // reference's verbatim sentence, and no checklist is drawn.
  await expect(page.getByTestId("rulebook-note")).toHaveAttribute(
    "data-state",
    "unbound",
  );
  await expect(page.getByTestId("quarantine-step")).toHaveCount(0);

  // Drop the file — the scan runs at once, pre-order, and the checklist
  // reveals the SERVER's per-step states on the drawn cadence.
  await page.getByTestId("package-input").setInputFiles({
    name: "pkg_smoke_upload.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 smoke package bytes"),
  });
  const steps = page.getByTestId("quarantine-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toHaveAttribute("data-state", "passed");
  await expect(steps.last()).toHaveAttribute("data-state", "passed");
  await expect(page.getByTestId("quarantine-pill")).toContainText(
    "Quarantine Clear",
  );

  // The digest is DATA (QuarantineResponse.sha256), rendered verbatim.
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

  // The amber→green flip: quarantine passed, so the note prints the SERVER's
  // bound-rulebook sentences and the paired row fills with its readout.
  await expect(page.getByTestId("rulebook-note")).toHaveAttribute(
    "data-state",
    "bound",
  );
  await expect(page.getByTestId("order-pages-readonly")).toContainText(
    "raster verified",
  );
});

test("client and product are chosen from served rosters, and resolve one checklist", async ({
  page,
}) => {
  await page.goto("/ingest");
  // A free-text client_id is a mistype away from the wrong sign-off checklist.
  await expect(page.getByTestId("order-client_id")).toHaveCount(0);
  await expect(page.getByTestId("rulebook-banner-idle")).toBeVisible();
  await page.getByTestId("client-select").click();
  // The reference's "(N sign-offs)" figure is the SERVER's, printed as sent.
  await expect(
    page.getByRole("option", { name: /Riverbend.*sign-offs/ }),
  ).toBeVisible();
  await page.getByRole("option", { name: /Riverbend/ }).click();
  // Half a key resolves nothing: the banner waits for the product too.
  await expect(page.getByTestId("rulebook-banner-idle")).toBeVisible();
  await page.getByTestId("product-select").click();
  await page.getByRole("option", { name: /40-Year Search/ }).click();
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

  // The run-log terminal, built as drawn (RULING-2026-08-29): one row per
  // served `run_log` line, rendered verbatim — nothing streamed or composed.
  await expect(page.getByTestId("run-log-terminal")).toBeVisible();
  await expect(
    page.getByTestId("run-log-terminal").locator("li[data-warn]").first(),
  ).toBeVisible();

  // The drawn header controls: the Replay act and the server's ETA string.
  await expect(page.getByTestId("pipeline-replay")).toBeVisible();
  await expect(page.getByTestId("pipeline-eta")).not.toBeEmpty();

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

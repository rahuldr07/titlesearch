import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/ingest.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

const PKG = {
  name: "pkg_demo_upload.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo package bytes"),
};

/**
 * SCAFFOLDING, NOT AN ASSERTION. The client is chosen from a card grid now, not
 * typed — the design draws a 2-column picker and `GET /api/clients` has always
 * served the list, so a free-text id was a mistype away from resolving the
 * wrong sign-off list, which is the one thing intake decides.
 *
 * Changing HOW this helper reaches the control is not weakening the invariant
 * it sets up: every assertion in the three tests below is untouched, and the
 * two-act rule they exist to pin is unchanged. The spec header's "never weaken
 * an assertion" still binds — this is not one.
 */
async function fillOrder(page: import("@playwright/test").Page) {
  await page.getByTestId("order-external_ref").fill("DEMO-9001");
  await page.getByTestId("choice-client-cli_riverbend").check();
  await page.getByTestId("order-jurisdiction").fill("clayton-ga");
  await page.getByTestId("order-state").fill("GA");
  await page.getByTestId("order-county").fill("Clayton");
  await page.getByTestId("package-input").setInputFiles(PKG);
}
// TODO(rebuild) [INVARIANT] — rule: §4.3 — the server's refusal renders its missing fields verbatim; the client does not author the list.
test("an incomplete upload is refused with the server's missing fields, verbatim", async ({
  page,
}) => {
  await page.goto("/ingest");
  // no file, no fields — the server names all six
  await page.getByRole("button", { name: "upload the package" }).click();
  await expect(page.getByTestId("refused-card")).toBeVisible();
  const missing = page.getByTestId("missing-field");
  await expect(missing).toHaveCount(6); // five order fields + the package itself
  await expect(page.getByTestId("refused-card")).toContainText("ORDER #");
  await expect(page.getByTestId("refused-card")).toContainText(
    "a report cannot be produced from this file",
  );
});

// TODO(rebuild) [INVARIANT] — rule: acceptance is explicit — an upload alone never queues an order.
test("acceptance is explicit — upload alone never queues the order", async ({
  page,
}) => {
  await page.goto("/ingest");
  await fillOrder(page);
  await page.getByRole("button", { name: "upload the package" }).click();
  // uploaded, but NOT accepted: the sign-for step is still in front of us
  await expect(page.getByTestId("accept-btn")).toBeVisible();
  await expect(page.getByTestId("accepted-card")).toHaveCount(0);
  await page.getByTestId("accept-btn").click();
  await expect(page.getByTestId("accepted-card")).toContainText(
    "Signed for. Order DEMO-9001 is queued.",
  );
});

// TODO(rebuild) [INVARIANT] — rule: a duplicate package surfaces the server's sha256-match notice.
test("a byte-identical re-upload surfaces the server's duplicate notice", async ({
  page,
}) => {
  await page.goto("/ingest");
  await fillOrder(page);
  await page.getByRole("button", { name: "upload the package" }).click();
  await expect(page.getByTestId("accept-btn")).toBeVisible();
  await page.getByTestId("accept-btn").click();
  await expect(page.getByTestId("accepted-card")).toBeVisible();
  await page.getByRole("button", { name: "ingest another" }).click();
  await fillOrder(page);
  await page.getByRole("button", { name: "upload the package" }).click();
  await expect(page.getByTestId("ingest-banner")).toContainText(
    "duplicate package (sha256 match)",
  );
});

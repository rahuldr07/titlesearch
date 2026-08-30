import { expect, test, type Page } from "@playwright/test";

/**
 * INTAKE'S PRODUCT RULES, pinned against the DRAWN flow.
 *
 * ⚠ REWRITTEN 2026-08-29 under RULING-2026-08-29
 * (`docs/frontend/design-2026-08/RULING-2026-08-29.md`): the ruling supersedes
 * the two-act upload/accept staging these tests used to pin under INVARIANT 47
 * — the reference draws ONE press ("Sign for Package & Begin Dual-Engine
 * Extraction →") and the ruling is the authority this header's old "never
 * weaken an assertion" note asks for. What is PIN-KEPT, restated for one act:
 *   - the server's refusal renders its missing-field list verbatim (§4.3);
 *   - a byte-identical re-upload surfaces the server's sha256-match notice;
 *   - jurisdiction/state/county are never typed — they left the request
 *     (CONFLICT-intake-hand-typed-jurisdiction.md, resolved by the ruling).
 */

const PKG = {
  name: "pkg_demo_upload.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo package bytes"),
};

/** The drawn flow: drop the file (the gateway scans at once), pick client and
 * product from the served rosters, type the client's own order number. */
async function fillOrder(page: Page) {
  await page.getByTestId("package-input").setInputFiles(PKG);
  await page.getByTestId("client-select").click();
  await page.getByRole("option", { name: /Riverbend/ }).click();
  await page.getByTestId("product-select").click();
  await page.getByRole("option", { name: /Current Owner Search/ }).click();
  await page.getByTestId("order-external_ref").fill("DEMO-9001");
}

const SIGN = /sign for package/i;

// [INVARIANT] — rule: §4.3 — the server's refusal renders its missing fields
// verbatim; the client does not author the list.
test("an incomplete sign is refused with the server's missing fields, verbatim", async ({
  page,
}) => {
  await page.goto("/ingest");
  // The one act is gated only on the file (RULING-2026-08-29): with a file
  // attached and nothing else, the press reaches the server, which names the
  // three request members — client_id, product, external_ref — and no more.
  // Jurisdiction/state/county CANNOT appear: they are not request members.
  await page.getByTestId("package-input").setInputFiles(PKG);
  await page.getByRole("button", { name: SIGN }).click();
  await expect(page.getByTestId("refused-card")).toBeVisible();
  await expect(page.getByTestId("missing-field")).toHaveCount(3);
  await expect(page.getByTestId("refused-card")).toContainText("ORDER #");
  await expect(page.getByTestId("refused-card")).toContainText("PRODUCT");
  await expect(page.getByTestId("refused-card")).not.toContainText("JURISDICTION");
  await expect(page.getByTestId("refused-card")).toContainText(
    "a report cannot be produced from this file",
  );
});

// [DRAWN, RULING-2026-08-29] — one signed act: the press uploads AND signs;
// the sealed card renders only on the server's acknowledgement of both.
test("one press signs for the package — no second accept stage exists", async ({
  page,
}) => {
  await page.goto("/ingest");
  await fillOrder(page);
  // The act is disabled until a file is chosen — here one is, so it fires.
  await page.getByRole("button", { name: SIGN }).click();
  await expect(page.getByTestId("accepted-card")).toBeVisible();
  await expect(page.getByTestId("accepted-card")).toContainText(
    "Package Ingested & Signature Sealed",
  );
  await expect(page.getByTestId("accepted-card")).toContainText("DEMO-9001");
  // The old intermediate accept stage is gone — one act, one card.
  await expect(page.getByTestId("accept-btn")).toHaveCount(0);
});

// [INVARIANT] — rule: a duplicate package surfaces the server's sha256-match
// notice (INVARIANT 48). The create still 409s; the banner prints it verbatim.
test("a byte-identical re-upload surfaces the server's duplicate notice", async ({
  page,
}) => {
  await page.goto("/ingest");
  await fillOrder(page);
  await page.getByRole("button", { name: SIGN }).click();
  await expect(page.getByTestId("accepted-card")).toBeVisible();
  await page.getByRole("button", { name: "ingest another" }).click();
  await fillOrder(page);
  await page.getByRole("button", { name: SIGN }).click();
  await expect(page.getByTestId("ingest-banner")).toContainText(
    "duplicate package (sha256 match)",
  );
});

// [DRAWN, RULING-2026-08-29] — jurisdiction is read, never typed: no writable
// jurisdiction/state/county input exists anywhere on the screen, and the
// paired row states the absence until the server's clerk-stamp readout lands.
test("jurisdiction is read from the clerk stamp — no input to hand-pick it wrong", async ({
  page,
}) => {
  await page.goto("/ingest");
  await expect(page.getByTestId("order-jurisdiction")).toHaveCount(0);
  await expect(page.getByTestId("order-state")).toHaveCount(0);
  await expect(page.getByTestId("order-county")).toHaveCount(0);
  await expect(page.getByTestId("order-jurisdiction-readonly")).toContainText(
    "read from clerk stamp",
  );
  await expect(page.getByTestId("rulebook-note")).toContainText(
    "Rulebook binds after quarantine",
  );
  // Once quarantine clears, the readout is the SERVER's.
  await page.getByTestId("package-input").setInputFiles(PKG);
  await expect(page.getByTestId("order-jurisdiction-readonly")).toContainText(
    "Clayton County, GA",
  );
  await expect(page.getByTestId("order-pages-readonly")).toContainText("pages");
});

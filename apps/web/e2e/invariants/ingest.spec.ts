/*
 * HARVESTED INVARIANT SPECS — migrated by Pass 1 (2026-07-26).
 *
 * Every test here asserts a PRODUCT RULE, not the old UI's DOM. They were all
 * green immediately before migration (116/116). They are skipped, not deleted:
 * un-skip each one as the rebuilt feature reaches it, rewriting SELECTORS only.
 *
 * NEVER weaken an assertion to make it pass. If an invariant cannot pass
 * against the new design, that is a CONFLICT in the design — stop and report.
 *
 * Classification + the rule each protects: docs/frontend/test-harvest.md
 */

import { expect, test } from "@playwright/test";

/**
 * Ingest invariants (frontend-master-prompt §4.3): the server's refusal
 * renders its missing fields verbatim; duplicates surface; accept is
 * explicit — never automatic.
 */

const PKG = {
  name: "pkg_demo_upload.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 demo package bytes"),
};

async function fillOrder(page: import("@playwright/test").Page) {
  await page.getByTestId("order-external_ref").fill("DEMO-9001");
  await page.getByTestId("order-client_id").fill("cli_demo_1");
  await page.getByTestId("order-jurisdiction").fill("clayton-ga");
  await page.getByTestId("order-state").fill("GA");
  await page.getByTestId("order-county").fill("Clayton");
  await page.getByTestId("package-input").setInputFiles(PKG);
}

// TODO(rebuild): the /ingest screen was deleted in Pass 1; rebuild from design-mock Upload
test.skip("an incomplete upload is refused with the server's missing fields, verbatim", async ({
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

// TODO(rebuild): the /ingest screen was deleted in Pass 1; rebuild from design-mock Upload
test.skip("acceptance is explicit — upload alone never queues the order", async ({
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

// TODO(rebuild): the /ingest screen was deleted in Pass 1; rebuild from design-mock Upload
test.skip("a byte-identical re-upload surfaces the server's duplicate notice", async ({
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

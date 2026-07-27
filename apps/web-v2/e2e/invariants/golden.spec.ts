import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/golden.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [ORPHAN RULE] — rule: golden capture never shows the pipeline's draft, and DON'T KNOW is a different object from NOT STATED.
test("capture is blind and structured; don't-know ≠ not-stated", async ({
  page,
}) => {
  await page.goto("/golden");
  await expect(
    page.getByText("You never see the pipeline's draft here", { exact: false }),
  ).toBeVisible();
  await page.getByTestId("golden-ZIP").fill("30296");
  await expect(page.getByTestId("fixture-line")).toContainText(
    '"ZIP": "30296"',
  );
  // DON'T KNOW and NOT STATED are different objects
  await page
    .getByRole("button", { name: "DON'T KNOW" })
    .first()
    .click();
  await expect(page.getByTestId("fixture-line")).toContainText("__DONT_KNOW__");
  await page.getByRole("button", { name: "NOT STATED" }).first().click();
  await expect(page.getByTestId("fixture-line")).toContainText(
    "__NOT_STATED__",
  );
});

// TODO(rebuild) [INVARIANT] — rule: no timers on golden capture — this is reading, not queue-clearing.
test("no timers anywhere on golden capture", async ({ page }) => {
  await page.goto("/golden");
  await expect(page.getByTestId("fixture-line")).toBeVisible();
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toMatch(/\btimer\b/);
  expect(body).not.toMatch(/\d+:\d\d elapsed/);
  expect(body).toContain("this is reading, not queue-clearing");
});

// TODO(rebuild) [INVARIANT] — rule: a golden correction is refused without source + reason, and the signer is derived from the session, never typed by the client.
test("seed correction is refused without citation + reason; signer is the session", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_1");
  const btn = page.getByTestId("seed-correct-btn");
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("a correction with no source is an opinion");
  // the signer is not a client field — it's shown read-only from the session
  await expect(page.getByTestId("seed-signed-as")).toContainText("L. Vance");
  await page.getByTestId("seed-new-value").fill("$220,224.00");
  await expect(btn).toBeDisabled();
  await page.getByTestId("seed-cite").fill("security deed p 3, amount in words");
  await expect(btn).toBeDisabled();
  await page
    .getByTestId("seed-reason")
    .fill("words read Two Hundred Twenty Thousand; the seed followed smudged numerals");
  // citation + reason is the whole gate now — the signature is server-derived
  await expect(btn).toBeEnabled();
});

// TODO(rebuild) [INVARIANT] — rule: a correction upgrades the tag to `ruled` and lands in a permanent append-only log showing the before→after.
test("a correction upgrades the tag to ruled and lands in the permanent log", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_1");
  await page.getByTestId("seed-new-value").fill("$220,224.00");
  await page.getByTestId("seed-cite").fill("security deed p 3, amount in words");
  await page.getByTestId("seed-reason").fill("words prevail over numerals — §5");
  await page.getByTestId("seed-correct-btn").click();
  await expect(page.getByTestId("seed-tag")).toHaveText("ruled");
  await expect(page.getByTestId("seed-value")).toHaveText("$220,224.00");
  const log = page.getByTestId("seed-log");
  await expect(log).toContainText("L. Vance — corrected");
  await expect(log).toContainText("$202,224.00 → $220,224.00");
});

// TODO(rebuild) [INVARIANT] — rule: confirming a seed as-is still requires a reason; the value stands and the tag becomes `ruled`.
test("confirm-seed is refused without a reason, then affirms as-is: value stands, tag → ruled", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_1");
  const btn = page.getByTestId("seed-confirm-btn");
  await expect(btn).toBeDisabled();
  await page
    .getByTestId("seed-confirm-reason")
    .fill("the words line reads $202,224 as typed — the model misread it");
  // reason is the whole gate; the signer comes from the session
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByTestId("seed-tag")).toHaveText("ruled");
  await expect(page.getByTestId("seed-value")).toHaveText("$202,224.00");
  const log = page.getByTestId("seed-log");
  await expect(log).toContainText("L. Vance — confirmed the seed");
  await expect(log).toContainText("value stands");
});

// TODO(rebuild) [INVARIANT] — rule: demote-to-suspect requires a reason; the value stands and the tag becomes `suspect`.
test("demote-to-suspect flags an ambiguous seed: value stands, tag → suspect", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_4");
  const btn = page.getByTestId("seed-demote-btn");
  await expect(btn).toBeDisabled();
  await page
    .getByTestId("seed-demote-reason")
    .fill("consideration recital is illegible; neither figure can be confirmed");
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByTestId("seed-tag")).toHaveText("suspect");
  const log = page.getByTestId("seed-log");
  await expect(log).toContainText("L. Vance — demoted to suspect");
});

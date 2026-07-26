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
import { apiLog, trackApi } from "../helpers/net";

/**
 * §0.6 blindness proven at the NETWORK level, not just by string absence:
 * the typist screen issues zero /api GETs — the only call that ever leaves
 * it is the submit POST. And the global key layer is dead on /blind/*.
 */

// TODO(rebuild): un-skip when this feature lands — rule: the typist screen issues zero /api GETs — the only network call is the submit POST
test.skip("the typist screen issues zero /api GETs — the only network call is the submit POST", async ({
  page,
}) => {
  await trackApi(page);
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("blind-seat")).toBeVisible();

  // full interaction: record one field, then submit
  await page
    .getByTestId("value-mortgages.1.lender")
    .fill("SOUTHSTONE MORTGAGE LLC");
  await page
    .getByTestId("source-mortgages.1.lender")
    .fill("security deed 09812/44, p 3");
  await page.getByTestId("conf-certain-mortgages.1.lender").click();
  await page.getByTestId("record-mortgages.1.lender").click();
  await page.getByTestId("blind-submit").click();
  await expect(page.getByTestId("blind-submitted")).toBeVisible();
  // never a dead end: the done card carries a door out
  await expect(page.getByTestId("blind-done-door")).toBeVisible();

  const calls = (await apiLog(page)).filter((c) => c.url.includes("/api/"));
  expect(calls.filter((c) => c.method === "GET")).toHaveLength(0);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe("POST");
  expect(calls[0]?.url).toContain("/api/blind/ord_demo_1/entries");
});

// TODO(rebuild): un-skip when this feature lands — rule: global keys are dead on /blind/*: no map, no chords
test.skip("global keys are dead on /blind/*: no map, no chords", async ({
  page,
}) => {
  await page.goto("/blind/ord_demo_1");
  await expect(page.getByTestId("blind-seat")).toBeVisible();
  await page.keyboard.press("?");
  await expect(page.getByTestId("key-map")).toHaveCount(0);
  // the session defaults to admin, so only the /blind/* path guard can be
  // what refuses this jump
  await page.keyboard.press("g");
  await page.keyboard.press("q");
  await expect(page).toHaveURL(/\/blind\/ord_demo_1/);
});

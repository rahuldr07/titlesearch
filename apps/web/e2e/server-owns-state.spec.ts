import { expect, test } from "@playwright/test";
import { interceptApi } from "./helpers/net";

/**
 * §0.2 server-owns-state, proven against a crafted payload: the UI renders
 * `state` verbatim and derives NOTHING from `value === null` or from
 * `engine_confidence_raw`. A pending null is "not yet extracted" (never
 * "Not Available", never queued); a 0.99-confidence field the server says
 * needs review stays queued; a 0.01-confidence auto-confirm stays confirmed.
 */

const field = (over: Record<string, unknown>) => ({
  id: "x",
  order_id: "ord_demo_1",
  path: "x",
  value: null,
  na_reason: null,
  state: "pending",
  source_doc_id: "doc_deed",
  source_page: 3,
  source_snippet: "…as recorded…",
  source_line_coords: null,
  engine_id: "gemini-2.5-flash",
  engine_confidence_raw: null,
  rule_refs: [],
  approved_by: null,
  approved_at: null,
  ...over,
});

const crafted = {
  order_id: "ord_demo_1",
  fields: [
    // null value + pending + sky-high confidence: still just "not yet extracted"
    field({
      id: "sf_pending",
      path: "assessment.tax_status",
      state: "pending",
      engine_confidence_raw: 0.99,
      source_doc_id: null,
      source_page: null,
      source_snippet: null,
      engine_id: null,
    }),
    // 0.99 confidence, server says needs_review: stays queued
    field({
      id: "sf_review",
      path: "owner.zip",
      value: "30296",
      state: "needs_review",
      engine_confidence_raw: 0.99,
    }),
    // 0.01 confidence, server says auto_confirmed: stays confirmed
    field({
      id: "sf_auto",
      path: "deed.book_page",
      value: "10944 / 213",
      state: "auto_confirmed",
      engine_confidence_raw: 0.01,
    }),
  ],
};

test("a null pending field renders 'not yet extracted' — never Not Available, never queued", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/orders/ord_demo_1/fields",
    status: 200,
    body: crafted,
  });
  await page.goto("/orders/ord_demo_1/review");
  const row = page.getByTestId("row-assessment.tax_status");
  await expect(row).toContainText("not yet extracted");
  await expect(row).not.toContainText("Not Available");
  // only the needs_review field is queued — null+pending manufactured nothing
  await expect(page.getByText("1 remaining")).toBeVisible();
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
});

test("the state pill renders server state verbatim — confidence never promotes or demotes", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/orders/ord_demo_1/fields",
    status: 200,
    body: crafted,
  });
  await page.goto("/orders/ord_demo_1/review");
  // 0.99 did not un-queue it
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await expect(page.getByTestId("sel-state")).toContainText("NEEDS REVIEW");
  // 0.01 did not demote it
  await page.getByTestId("row-deed.book_page").click();
  await expect(page.getByTestId("sel-state")).toContainText("AUTO-CONFIRMED");
});

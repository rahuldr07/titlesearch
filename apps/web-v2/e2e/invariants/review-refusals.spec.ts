import { expect, test, type Page } from "@playwright/test";
import { apiLog, interceptApi, trackApi } from "../helpers/net";

/**
 * THE THREE BLOCKERS, DRIVEN.
 *
 * 1. Four of the five review mutations swallowed the server's refusal.
 *    `ReviewScreen` read `confirm.error` and nothing else, so a forced 409 on
 *    `/correct` left `confirm-note` null, zero alerts, the editor open holding
 *    the typed value and the submit still enabled. HANDOFF §4 rule 9: a 409 is
 *    an ANSWER and must render with the server's message VERBATIM.
 *
 * 2. Nothing guarded a second submit. Three clicks on `edit-submit` under
 *    latency filed THREE correction records — three reason rows for one
 *    reviewer act, in the table that feeds the rule channel.
 *
 * 3. The `x` chord reached past rulebook R13. The `✕ Not our party` BUTTON is
 *    offered only on `judgments.*`; the chord was bound unconditionally, so on
 *    `?field=owner.zip` the button was correctly absent and `x` opened the
 *    editor anyway — and the exclude posted 200. An excluded row is GONE
 *    (`conflicts.md` C18), and the mock is the backend today: a rule the
 *    client alone enforces is not enforced.
 */

/** A judgment field in `needs_review` — the one place R13 offers suppression. */
const JUDGMENT_ROW = "row-judgments.1.plaintiff_attorney";

/**
 * Latency, injected IN-PAGE for the same reason `helpers/net.ts` exists: MSW
 * answers from the service worker, where `page.route` cannot see the request.
 * Install AFTER `trackApi` so the log still records the call it delays.
 */
async function slowApi(page: Page, match: string, ms: number): Promise<void> {
  await page.addInitScript(
    (o) => {
      const orig = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
        if (url.includes(o.match)) {
          await new Promise((resolve) => setTimeout(resolve, o.ms));
        }
        return orig(input, init);
      };
    },
    { match, ms },
  );
}

const openCorrection = async (page: Page) => {
  await page.getByTestId("row-mortgages.1.lender").click();
  await page.keyboard.press("e");
  await page.getByTestId("edit-value").fill("SOUTHSTONE MORTGAGE LLC");
  await page
    .getByTestId("edit-reason")
    .fill("page reads SOUTHSTONE; B's zeros are the OCR failure mode");
};

const postsMatching = async (page: Page, match: string) =>
  (await apiLog(page)).filter((c) => c.method === "POST" && c.url.includes(match));

// BLOCKER 1 — rule: a 409 on a CORRECTION is an answer, surfaced verbatim.
test("a refused correction surfaces the server's message verbatim", async ({ page }) => {
  await interceptApi(page, {
    method: "POST",
    match: "/correct",
    status: 409,
    body: { error: "field is terminal (escalated)" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await openCorrection(page);
  await page.getByTestId("edit-reason").press("Enter");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "field is terminal (escalated)",
  );
  // no advance, and the typed value survives — the reviewer acts on the answer
  await expect(page.getByTestId("sel-label")).toHaveText("MTG 1 — LENDER");
  await expect(page.getByTestId("edit-value")).toHaveValue("SOUTHSTONE MORTGAGE LLC");
});

// BLOCKER 1 — rule: a 409 on an ESCALATION is an answer, surfaced verbatim.
test("a refused escalation surfaces the server's message verbatim", async ({ page }) => {
  await interceptApi(page, {
    method: "POST",
    match: "/escalate",
    status: 409,
    body: { error: "field is terminal (corrected)" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await page.getByTestId("row-owner.zip").click();
  await page.getByTestId("act-escalate").click();
  await page.getByTestId("escalate-input").fill("which source wins?");
  await page.getByTestId("escalate-input").press("Enter");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "field is terminal (corrected)",
  );
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
});

// BLOCKER 1 — rule: a 409 on a SUPPRESSION is an answer, surfaced verbatim.
test("a refused exclude surfaces the server's message verbatim", async ({ page }) => {
  await interceptApi(page, {
    method: "POST",
    match: "/exclude",
    status: 409,
    body: { error: "field is terminal (escalated)" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await page.getByTestId(JUDGMENT_ROW).click();
  await page.getByTestId("act-exclude").click();
  await page.getByTestId("exclude-reason").fill("a different M. Quenby entirely");
  await page.getByTestId("exclude-reason").press("Enter");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "field is terminal (escalated)",
  );
});

// BLOCKER 1 — rule: a refused PASS is an answer too; the order did not move.
test("a refused pass surfaces the server's message verbatim", async ({ page }) => {
  await interceptApi(page, {
    method: "POST",
    match: "/pass",
    status: 409,
    body: { error: "order is claimed by another reviewer" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  await page.keyboard.press("p");
  await page.getByTestId("pass-reason").fill("wrong county package");
  await page.getByTestId("pass-reason").press("Enter");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "order is claimed by another reviewer",
  );
});

// BLOCKER 2 — rule: one reviewer act files ONE record, whatever the latency.
test("three clicks on the correction submit file exactly one correction", async ({
  page,
}) => {
  await trackApi(page);
  await slowApi(page, "/correct", 2_000);
  await page.goto("/orders/ord_demo_1/review");
  await openCorrection(page);
  const submit = page.getByTestId("edit-submit");
  await submit.click();
  // force: the guard is what must stop these, not the runner's own
  // actionability check refusing to click a control it found disabled
  await submit.click({ force: true });
  await submit.click({ force: true });
  await expect(page.getByTestId(JUDGMENT_ROW)).toBeVisible();
  await expect
    .poll(async () => (await postsMatching(page, "/correct")).length)
    .toBe(1);
});

// BLOCKER 2 — rule: the same holds for the Enter-only editors, which have no
// button to disable. Held Enter is the cheapest way to file three of anything.
test("repeated Enter on an exclude files exactly one suppression", async ({ page }) => {
  await trackApi(page);
  await slowApi(page, "/exclude", 2_000);
  await page.goto("/orders/ord_demo_1/review");
  await page.getByTestId(JUDGMENT_ROW).click();
  await page.getByTestId("act-exclude").click();
  const reason = page.getByTestId("exclude-reason");
  await reason.fill("a different M. Quenby entirely");
  await reason.press("Enter");
  await reason.press("Enter");
  await reason.press("Enter");
  await expect
    .poll(async () => (await postsMatching(page, "/exclude")).length)
    .toBe(1);
});

// BLOCKER 3 — rule: the chord obeys the rulebook gate the button obeys.
test("x on a non-judgments field opens nothing and posts nothing", async ({ page }) => {
  await trackApi(page);
  await page.goto("/orders/ord_demo_1/review?field=owner.zip");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // the button is correctly absent — R13 offers suppression only on judgments
  await expect(page.getByTestId("act-exclude")).toHaveCount(0);
  await page.keyboard.press("x");
  await expect(page.getByTestId("exclude-reason")).toHaveCount(0);
  expect(await postsMatching(page, "/exclude")).toHaveLength(0);
});

// BLOCKER 3 — the positive control: gating everything off is not a fix.
test("x on a judgments field still opens the suppression editor", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review?field=judgments.1.plaintiff_attorney");
  await expect(page.getByTestId("act-exclude")).toBeVisible();
  await page.keyboard.press("x");
  await expect(page.getByTestId("exclude-reason")).toBeFocused();
});

// BLOCKER 3 — rule: the mock IS the backend today. A rule only the client
// enforces is not enforced, so the server refuses the same request.
test("the server refuses an exclude on a non-judgments path", async ({ page }) => {
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toBeVisible();
  const result = await page.evaluate(async () => {
    const post = (id: string) =>
      fetch(`/api/fields/${id}/exclude`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "a different M. Quenby entirely" }),
      }).then(async (r) => ({ status: r.status, body: await r.text() }));
    return { zip: await post("fld_zip"), judgment: await post("fld_j1atty") };
  });
  expect(result.zip.status).toBe(422);
  expect(result.zip.body).toContain("judgment");
  // and the rule refuses only what it should
  expect(result.judgment.status).toBe(200);
});

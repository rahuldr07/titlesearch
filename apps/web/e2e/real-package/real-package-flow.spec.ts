import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The real county package, carried through the whole pipeline: intake,
 * extraction, the workstation, the release compiler, the delivered record.
 *
 * The package never enters VCS (CONTEXT §19), so the spec reads its path
 * from `TITLEPIPE_REAL_PACKAGE` and skips by name when it is absent. What it
 * uploads is checked against the package's digest before the first byte
 * leaves the disk: a different file pointed at by the same variable would
 * fail on "Lincoln County" with no word about why.
 *
 * Every assertion below is on a served fact — the digest the gateway
 * computed, the clerk-stamp readout, the census figures, the gate verdicts,
 * the 409 sentence — never on a number this spec counted for itself.
 *
 * NO reset call, deliberately. The mock's state lives in the page
 * (`setupWorker`, handlers run in the page's own JS context), so every test
 * starts clean on its own `page.goto` and no spec in this suite posts to
 * `/api/demo/reset`. The corollary is the shape of the flow test: after the
 * upload it NEVER calls `page.goto` again — a reload would forget the order
 * it just created — and walks the doors the app draws instead (the accepted
 * card's link, "Enter Examination Workstation", "Advance to publication",
 * the strip's delivery tab).
 */

const PACKAGE_PATH = process.env["TITLEPIPE_REAL_PACKAGE"] ?? "";
const SHA256 = "d43ec399252b4d67308fb6eff2d5250c168ba589ba022ea25c4815852dea0f5f";
const PAGES = 101;

test.skip(
  PACKAGE_PATH === "",
  "TITLEPIPE_REAL_PACKAGE not set — the real package never enters VCS",
);

/** What the server serves for a field — only the members this spec reads.
 * Declared here rather than imported: the spec reads the wire, not the app. */
interface ServedField {
  readonly id: string;
  readonly path: string;
  readonly state: string;
  readonly value: string | null;
  readonly na_reason: string | null;
  readonly source_page: number | null;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Drop the real file — after proving it IS the real file. */
async function dropRealPackage(page: Page): Promise<void> {
  const digest = createHash("sha256").update(readFileSync(PACKAGE_PATH)).digest("hex");
  expect(
    digest,
    `TITLEPIPE_REAL_PACKAGE must point at final_package.pdf (sha256 ${SHA256}); got ${digest}`,
  ).toBe(SHA256);
  await page.getByTestId("package-input").setInputFiles(PACKAGE_PATH);
}

/** The same roster picks the intake invariants use. */
async function fillOrder(page: Page): Promise<void> {
  await page.getByTestId("client-select").click();
  await page.getByRole("option", { name: /Riverbend/ }).click();
  await page.getByTestId("product-select").click();
  await page.getByRole("option", { name: /Current Owner Search/ }).click();
  await page.getByTestId("order-external_ref").fill("DEMO-9001");
}

/** Press the one act; return the id of the order the server minted, read
 * off the accepted card's own link rather than guessed. */
async function signForPackage(page: Page): Promise<string> {
  await page.getByTestId("sign-btn").click();
  const card = page.getByTestId("accepted-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card).toContainText("Package Ingested & Signature Sealed");
  await expect(card).toContainText("DEMO-9001");
  // `Order.pages` is the server's count of this package.
  await expect(card).toContainText(`${String(PAGES)} scanned pages`);
  const href = await card
    .getByRole("link", { name: /View Live Dual-Engine Extraction/ })
    .getAttribute("href");
  const orderId = /\/orders\/([^/?#]+)\/extraction/.exec(href ?? "")?.[1] ?? "";
  expect(orderId, `the accepted card must link to the extraction screen; href was ${String(href)}`).not.toBe("");
  return orderId;
}

async function servedFields(page: Page, orderId: string): Promise<ServedField[]> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/orders/${id}/fields`);
    const body = (await response.json()) as { fields: ServedField[] };
    return body.fields;
  }, orderId);
}

async function servedArtifactCount(page: Page, orderId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const response = await fetch(`/api/orders/${id}/artifacts`);
    const body = (await response.json()) as { artifacts: unknown[] };
    return body.artifacts.length;
  }, orderId);
}

/**
 * Answer every queued decision through the mock's own endpoints, from inside
 * the page. Confirm where the server served a value it can cite; where the
 * value is a typed absence, file the absence with its reason — the same two
 * branches `settle` takes through the UI, and the same refusals apply
 * (a reason-less correction is 422 here too). Returns what it filed.
 */
async function clearQueueOnTheWire(
  page: Page,
  orderId: string,
  leaveOpen: number,
): Promise<number> {
  return page.evaluate(async ([id, leave]) => {
    const response = await fetch(`/api/orders/${String(id)}/fields`);
    const body = (await response.json()) as { fields: ServedField[] };
    const all = body.fields.filter((f) => f.state === "needs_review");
    const queued = all.slice(0, all.length - Number(leave));
    for (const field of queued) {
      const [path, init] =
        field.na_reason === null && field.value !== null
          ? [
              `/api/fields/${field.id}/confirm`,
              { value: field.value },
            ]
          : [
              `/api/fields/${field.id}/correct`,
              {
                value: null,
                na_reason: field.na_reason ?? "NOT_STATED",
                reason: `the served reading for ${field.path} is empty; the instrument is present and leaves it blank`,
              },
            ];
      const filed = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(init),
      });
      if (!filed.ok) {
        throw new Error(`${path} refused the act: ${String(filed.status)} ${await filed.text()}`);
      }
    }
    return queued.length;
  }, [orderId, String(leaveOpen)] as const);
}

/** "N/M VERIFIED" — both figures the server's census. */
async function meter(page: Page): Promise<{ settled: number; decisions: number }> {
  const label = page.getByTestId("verified-meter-label");
  await expect(label).toHaveText(/^\d+\/\d+ VERIFIED$/);
  const m = /^(\d+)\/(\d+) VERIFIED$/.exec(((await label.textContent()) ?? "").trim());
  return { settled: Number(m?.[1] ?? "-1"), decisions: Number(m?.[2] ?? "-1") };
}

/** "N fields" — the server's `remaining`. Never "No count sent", never "✓ Done" here. */
async function remaining(page: Page): Promise<number> {
  const pill = page.getByTestId("remaining-pill");
  await expect(pill).toHaveText(/^\d+ fields?$/);
  return Number(await pill.getAttribute("data-remaining"));
}

/**
 * One reviewer act on one queued field. Confirm where the server served a
 * value with provenance (`confirmValue`: a value and no `na_reason`); where
 * it did not, the fourth act — declare which absence it is, with the reason
 * the editor refuses to file without. The row's mark is the server's
 * repainted state, so the act is proven by what came back, not by the click.
 */
async function settle(page: Page, field: ServedField): Promise<void> {
  const row = page.getByTestId(`row-${field.path}`);
  /*
   * Only click a row that is not already the open one. A second click on the
   * selected row lands inside the browser's double-click window and the row
   * answers `dblclick` by swapping itself for the inline editor — at which
   * point `row-<path>` is not in the document at all and the act below is
   * filed against a control this spec never named. The row publishes its
   * selection, so the spec asks rather than clicking blind.
   */
  if ((await row.getAttribute("data-selected")) !== "true") await row.click();
  await expect(page.getByTestId("open-decision")).toBeVisible();

  let expected: "confirmed" | "corrected";
  if (field.na_reason === null && field.value !== null) {
    await page.getByTestId("act-confirm").click();
    expected = "confirmed";
  } else {
    await page.getByTestId("act-absence").click();
    const reason = field.na_reason ?? "NOT_STATED";
    await page.getByTestId(`na-option-${reason}`).click();
    await page
      .getByTestId("edit-reason")
      .fill(`the served reading for ${field.path} is empty; the instrument is present and leaves it blank`);
    await page.getByTestId("edit-submit").click();
    expected = "corrected";
  }

  const mark = row.getByTestId("row-mark");
  const note = page.getByTestId("confirm-note");
  await expect(mark.or(note).first()).toBeVisible();
  if ((await note.count()) > 0) {
    throw new Error(
      `the server refused the act on ${field.path}: ${(await note.innerText()).trim()}`,
    );
  }
  await expect(mark).toHaveAttribute("data-field-state", expected);
}

// Rule: a real package, signed for once, is one order all the way down —
// the same id from the accepted card to the delivery picker, and every
// screen in between draws the server's figures for it.
test("the real package travels intake → extraction → workstation → compiler → delivery", async ({
  page,
}) => {
  // 14 MB through the service worker, a reveal cadence, and a build served
  // cold: the suite's 60s is for a screen, not a pipeline.
  test.setTimeout(300_000);

  /* ── 1. Intake ─────────────────────────────────────────────────────── */
  await page.goto("/ingest");
  await dropRealPackage(page);

  // The gateway runs the moment the file lands; the rows reveal the SERVER's
  // per-step states, and every one of them passed.
  await expect(page.getByTestId("quarantine-gateway")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("quarantine-pill")).toContainText("Quarantine Clear", {
    timeout: 60_000,
  });
  const steps = page.getByTestId("quarantine-step");
  const stepCount = await steps.count();
  expect(stepCount).toBeGreaterThan(0);
  for (let i = 0; i < stepCount; i += 1) {
    await expect(steps.nth(i)).toHaveAttribute("data-state", "passed");
  }
  // The digest is the file's — the whole hex, as the gateway prints it.
  await expect(page.getByTestId("sha256")).toContainText(`sha256: ${SHA256}`);
  await expect(page.getByTestId("quarantine-duplicate")).toHaveCount(0);
  // Read off the clerk stamp, never typed: Lincoln County, Missouri; 101 pages.
  await expect(page.getByTestId("order-jurisdiction-readonly")).toContainText(
    "Lincoln County, MO",
  );
  await expect(page.getByTestId("order-pages-readonly")).toContainText(
    `${String(PAGES)} pages`,
  );
  await expect(page.getByTestId("optical-profile")).toBeVisible();
  await expect(page.getByTestId("optical-reading")).toHaveCount(3);

  await fillOrder(page);
  const orderId = await signForPackage(page);

  // The card's own door, not a typed URL — a reload here forgets the order.
  await page
    .getByTestId("accepted-card")
    .getByRole("link", { name: /View Live Dual-Engine Extraction/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/orders/${esc(orderId)}/extraction$`));

  /* ── 2. Extraction ─────────────────────────────────────────────────── */
  await expect(page.getByTestId("extraction")).toBeVisible({ timeout: 30_000 });
  const stages = page.getByTestId("stage-timeline").locator("li");
  await expect(stages.first()).toBeVisible();
  expect(await stages.count()).toBeGreaterThan(0);

  // One cell per page the server counted — 101, and not a 102nd.
  const matrix = page.getByTestId("page-matrix");
  await expect(matrix).toBeVisible();
  await expect(matrix.locator('[data-testid^="page-cell-"]')).toHaveCount(PAGES);
  await expect(page.getByTestId(`page-cell-${String(PAGES)}`)).toBeVisible();
  await expect(page.getByTestId(`page-cell-${String(PAGES + 1)}`)).toHaveCount(0);

  // Only what the run log promises; engine names and reader counts are not asserted.
  const terminal = page.getByTestId("run-log-terminal");
  await expect(terminal).toContainText("fields extracted", { timeout: 60_000 });
  await expect(terminal).toContainText("routed to examiner");
  await expect(page.getByTestId("classifier-note")).not.toBeEmpty();

  // Drawn only while the server's `remaining` is above zero — so its presence
  // is itself the assertion that this package routed something to a person.
  const enter = page.getByTestId("extraction-enter-review");
  await expect(enter).toBeVisible({ timeout: 60_000 });
  await enter.click();
  await expect(page).toHaveURL(new RegExp(`/orders/${esc(orderId)}/review`));

  /* ── 3. Workstation ────────────────────────────────────────────────── */
  await expect(page.getByTestId("verified-meter-label")).toBeVisible({ timeout: 30_000 });
  const before = await meter(page);
  expect(before.decisions, "a real package puts decisions in front of a person — never 0/0").toBeGreaterThan(0);
  const remainingBefore = await remaining(page);
  expect(remainingBefore).toBeGreaterThan(0);

  // The queue is divided: FieldQueue renders one <section id="section-…"> per group.
  const sections = page.locator('section[id^="section-"]');
  await expect(sections.first()).toBeVisible();
  expect(await sections.count()).toBeGreaterThanOrEqual(5);

  // Engine disagreement surfaces on the row (the p20 grantor: A≠B), and the
  // conflict is a person's — clicking it opens the decision with the verdict.
  const disagreements = page.getByTestId("row-disagreement");
  await expect(disagreements.first()).toBeVisible();
  expect(await disagreements.count()).toBeGreaterThanOrEqual(1);
  await page
    .locator('[data-testid^="row-"]')
    .filter({ has: page.getByTestId("row-disagreement") })
    .first()
    .click();
  await expect(page.getByTestId("open-decision")).toContainText(/disagree/i);

  // Judgments never auto-confirm in v1: at least one judgments row exists,
  // none carries the pipeline's own ✓, and at least one is still queued —
  // in the UI and, independently, on the wire.
  const judgmentRows = page.locator('[data-testid^="row-judgments."]');
  expect(await judgmentRows.count()).toBeGreaterThanOrEqual(1);
  await expect(
    judgmentRows.locator('[data-testid="row-mark"][data-field-state="auto_confirmed"]'),
  ).toHaveCount(0);
  expect(
    await judgmentRows.filter({ hasNot: page.getByTestId("row-mark") }).count(),
  ).toBeGreaterThanOrEqual(1);
  const fields = await servedFields(page, orderId);
  const judgments = fields.filter((f) => f.path.startsWith("judgments."));
  expect(judgments.length).toBeGreaterThanOrEqual(1);
  expect(judgments.every((f) => f.state !== "auto_confirmed")).toBe(true);
  expect(judgments.some((f) => f.state === "needs_review")).toBe(true);

  await expect(page.getByTestId("na-guide-open")).toBeVisible();

  // The source page: the text render or the raster, whichever this server
  // could serve (no raster under `vite preview`; the sheet falls back). In
  // the text render the pin cites the page the server cited for the open
  // field; the raster branch draws the region instead of a pin.
  const queued = fields.filter((f) => f.state === "needs_review");
  const cited = queued.find((f) => f.source_page !== null);
  expect(cited, "at least one queued field must carry a source page").toBeDefined();
  if (cited !== undefined) {
    await page.getByTestId(`row-${cited.path}`).click();
    await expect(page.getByTestId("open-decision")).toBeVisible();
    const lines = page.getByTestId("scan-lines");
    const raster = page.getByTestId("page-raster");
    await expect(lines.or(raster).first()).toBeVisible();
    await expect
      .poll(async () => {
        if ((await lines.count()) > 0) return "text";
        const decoded = await raster
          .locator("img")
          .evaluate((el) => {
            const img = el as HTMLImageElement;
            return img.complete && img.naturalWidth > 0;
          })
          .catch(() => false);
        return decoded ? "raster" : "loading";
      })
      .not.toBe("loading");
    if ((await lines.count()) > 0) {
      await expect(page.getByTestId("scan-pin")).toContainText(
        `p${String(cited.source_page)} `,
      );
    }
  }

  // Three acts on the first three queued fields. Bounded on purpose — the
  // spec proves the census moves by exactly what was filed, not that a
  // queue can be cleared.
  const three = queued.slice(0, 3);
  expect(three).toHaveLength(3);
  for (const field of three) await settle(page, field);
  await expect(page.getByTestId("remaining-pill")).toHaveAttribute(
    "data-remaining",
    String(remainingBefore - 3),
  );
  const after = await meter(page);
  expect(after.settled).toBe(before.settled + 3);
  expect(after.decisions).toBe(before.decisions);

  /* ── 4. Release compiler ───────────────────────────────────────────── */
  await page.getByTestId("footer-release").click();
  await expect(page).toHaveURL(new RegExp(`/orders/${esc(orderId)}/release$`));
  await expect(page.getByTestId("gate-panel")).toBeVisible({ timeout: 30_000 });
  for (const gate of ["g1", "g2", "g3", "g4", "g5"]) {
    await expect(page.getByTestId(`gate-${gate}`)).toHaveCount(1);
  }
  // Composed but unsealed is a draft, and it says so.
  await expect(page.getByTestId("draft-watermark")).toBeVisible();
  await expect(page.getByTestId("integrity-seal-absent")).toBeVisible();
  const blocks = page
    .getByTestId("manifest-blocks")
    .locator('section[data-testid^="manifest-"]');
  await expect(blocks.first()).toBeVisible();
  expect(await blocks.count()).toBeGreaterThanOrEqual(6);

  // Unsigned: held by the client, in a sentence.
  const hold = page.getByTestId("release-hold");
  await expect(hold).toBeVisible();
  await expect(hold).toContainText("signature");
  await expect(page.getByTestId("release-submit")).toBeDisabled();

  // Signed, with decisions still open: the act reaches the server and the
  // server's gate refuses it — in its own words, which name the gate.
  await page.getByTestId("release-signature").fill("E2E Examiner");
  await expect(hold).toHaveCount(0);
  await page.getByTestId("release-submit").click();
  await expect(page.getByTestId("release-refusal")).toContainText(/gate/i);
  await expect(page.getByTestId("integrity-seal-absent")).toBeVisible();

  // A pending value is a door back to its field — `?field=` names the path.
  const pending = page.getByTestId("manifest-blocks").locator('[data-testid^="pending-"]');
  await expect(pending.first()).toBeVisible();
  const pendingPath =
    (await pending.first().getAttribute("data-testid"))?.replace(/^pending-/, "") ?? "";
  expect(pendingPath).not.toBe("");
  await pending.first().click();
  await expect(page).toHaveURL(new RegExp(`/orders/${esc(orderId)}/review\\?.*field=`));
  expect(new URL(page.url()).searchParams.get("field")).toBe(pendingPath);
  await expect(page.getByTestId("sel-label")).toBeVisible();

  /* ── 5. Delivery, before any release ───────────────────────────────── */
  await page.getByTestId("strip-stage-delivered").click();
  await expect(page).toHaveURL(new RegExp(`/delivery\\?order=${esc(orderId)}`));
  const delivery = page.getByTestId("delivery-screen");
  await expect(delivery).toBeVisible();
  // Past the skeleton: either the index of what was delivered, or nothing at all.
  await expect(delivery).toContainText(/Delivered orders|Nothing delivered/);
  // Nothing certified for THIS order: not on the picker, not scoped to it,
  // and the server holds no artifact for it.
  await expect(page.getByTestId(`delivered-order-${orderId}`)).toHaveCount(0);
  await expect(page.getByTestId("delivery-scope")).toHaveCount(0);
  expect(await servedArtifactCount(page, orderId)).toBe(0);
});

/**
 * The certified path, end to end, and the long test in this file by
 * construction: every one of the order's queued decisions is answered — the
 * server's figure for the real package is ~96 — and the T1 second read is
 * then filed as the OTHER examiner via `countersign-switch-user`, because
 * the server 409s a countersign from the examiner who ruled. All of it
 * happens in one page session: the mock's state lives in the page, and no
 * spec here posts `/api/demo/reset`.
 */
test(
  "clearing every decision, countersigning T1 as a second examiner, and releasing seals a certified artifact",
  async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/ingest");
    await dropRealPackage(page);
    await expect(page.getByTestId("quarantine-pill")).toContainText("Quarantine Clear", {
      timeout: 60_000,
    });
    await fillOrder(page);
    const orderId = await signForPackage(page);
    await page
      .getByTestId("accepted-card")
      .getByRole("link", { name: /View Live Dual-Engine Extraction/ })
      .click();
    await page.getByTestId("extraction-enter-review").click();

    /*
     * Clear the queue ON THE WIRE, in the page the app is running in — the
     * mock is the page's own service worker, so these are the same handlers
     * the buttons post to, with the same refusals. Not a shortcut around the
     * screen: the test above files three acts through the workstation and
     * asserts what came back. What THIS test is about is the compiler and
     * the delivered record, and the real package's queue is ~96 decisions —
     * walking it by pointer is fifteen minutes of clicking to reach the two
     * screens under test, and every second of it is already covered.
     */
    const cleared = await clearQueueOnTheWire(page, orderId, 1);
    expect(cleared).toBeGreaterThan(0);
    /*
     * The LAST decision is filed through the workstation, and it is what
     * repaints the screen: the acts above went straight to the handlers, so
     * no mutation of the app's invalidated its caches, and the pill would
     * still be reading a 30-second-fresh census. One real act is the app's
     * own refetch, and it proves the pill is the server's figure and not a
     * number this screen has been carrying since the page loaded.
     */
    const last = (await servedFields(page, orderId)).filter((f) => f.state === "needs_review");
    expect(last).toHaveLength(1);
    if (last[0] !== undefined) await settle(page, last[0]);
    await expect(page.getByTestId("remaining-pill")).toHaveText("✓ Done");

    /*
     * The second read, as the other examiner. The rows are named from the
     * ledger rather than counted off the screen, and each one is pressed by
     * its own id — a loop on "whatever submit button is first" cannot say
     * whether it filed N second reads or pressed one button N times, and
     * hangs on the disabled state instead of failing.
     */
    const ledger = await page.evaluate(async (id) => {
      const response = await fetch(`/api/orders/${id}/countersigns`);
      const body = (await response.json()) as {
        required: { field_id: string; countersigned_by: string | null }[];
      };
      return body.required.filter((r) => r.countersigned_by === null).map((r) => r.field_id);
    }, orderId);
    expect(ledger.length).toBeGreaterThan(0);
    await expect(page.getByTestId("countersign-panel")).toBeVisible();
    await page.getByTestId("countersign-switch-user").click();
    await page.getByTestId("countersign-signature").fill("R. Menon");
    for (const fieldId of ledger) {
      await page.getByTestId(`countersign-submit-${fieldId}`).click();
      await expect(page.getByTestId("countersign-refusal")).toHaveCount(0);
    }
    await expect(page.getByTestId("countersign-settled")).toBeVisible();

    /*
     * Back to the seat that may release. The countersign was filed from the
     * QC seat, and `senior` does not hold `release.execute` — the server
     * refuses it in those words rather than the screen hiding the button, so
     * the spec answers by changing seats, not by asserting a refusal it
     * caused. Sign-out is a route change, never a reload: a reload would
     * forget the order this whole test is about.
     */
    await page.getByTestId("sign-out").click();
    await page.getByTestId("continue-as-admin").click();
    /*
     * Signing in lands on the overview, and this order is not on it — the
     * recent list is the latest ten of fifteen and a package signed for
     * minutes ago has no due date to sort it up. So the way back is the way
     * a person would take it: All Orders, searched by the ref intake typed,
     * then the row's own door. Every step is a route change; a `goto` here
     * would reload the document and the mock's state lives in the page.
     */
    await page.getByRole("link", { name: /All Orders/ }).click();
    await page.getByLabel("Search orders").fill("DEMO-9001");
    const openRow = page.getByRole("link", { name: "Open order DEMO-9001" });
    await expect(openRow).toBeVisible();
    await openRow.click();
    const compilerDoor = page.getByRole("link", { name: /Release Compiler/ });
    await expect(compilerDoor).toBeVisible();
    await compilerDoor.click();
    await expect(page).toHaveURL(new RegExp(`/orders/${esc(orderId)}/release$`));
    await expect(page.getByTestId("release-submit")).toBeVisible();

    // Release: every gate green, the seal is the server's record of it.
    await expect(page.getByTestId("gate-panel")).toBeVisible();
    for (const gate of ["g1", "g2", "g4"]) {
      await expect(page.getByTestId(`gate-${gate}`)).toContainText(/✓|passed|answered|countersigned/i);
    }
    await page.getByTestId("release-signature").fill("L. Vance");
    await page.getByTestId("release-submit").click();
    const seal = page.getByTestId("integrity-seal");
    await expect(seal).toBeVisible();
    await expect(seal).toContainText(/[0-9a-f]{64}/);

    /*
     * …and the delivered record encloses BOTH certified artifacts: the report
     * this run rendered and the package itself, whose digest is the one the
     * gateway computed over the uploaded bytes — the hex the client can check
     * against the file they sent.
     */
    await page.getByTestId("strip-stage-delivered").click();
    await expect(page.getByTestId("delivery-scope")).toBeVisible();
    const digests = page.locator('[data-testid^="artifact-sha-"]');
    await expect(digests.first()).toContainText(/sha-256 [0-9a-f]{64}/);
    expect(await digests.count()).toBeGreaterThanOrEqual(2);
    await expect(
      page.locator('[data-testid^="artifact-sha-"]', { hasText: SHA256 }),
    ).toHaveCount(1);
    expect(await servedArtifactCount(page, orderId)).toBe(2);
  },
);

// Rule: a byte-identical re-upload is refused as a sha256 duplicate — the
// gateway fails the de-dup step in the server's words before any order
// exists, and the create still 409s with the same sentence.
test("a second intake of the same package is refused as a sha256 duplicate", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/ingest");
  await dropRealPackage(page);
  await expect(page.getByTestId("quarantine-pill")).toContainText("Quarantine Clear", {
    timeout: 60_000,
  });
  await expect(page.getByTestId("quarantine-duplicate")).toHaveCount(0);
  await fillOrder(page);
  await signForPackage(page);

  await page.getByTestId("ingest-again").click();
  await dropRealPackage(page);
  await expect(page.getByTestId("sha256")).toContainText(SHA256, { timeout: 60_000 });
  await expect(page.getByTestId("quarantine-duplicate")).toBeVisible();
  await expect(page.getByTestId("sha256")).toContainText("duplicate package (sha256 match)");

  await fillOrder(page);
  await page.getByTestId("sign-btn").click();
  await expect(page.getByTestId("ingest-banner")).toContainText(
    "duplicate package (sha256 match)",
  );
});

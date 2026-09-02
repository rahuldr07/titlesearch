import { expect, test, type Page } from "@playwright/test";

/**
 * The three analysis-surface refusals, which until now lived only in prose:
 * PRD §8.4 ("No aggregate headline. No auto-promotion."), CONTEXT §14's
 * anti-pattern list ("no probe visibility · no aggregate headline accuracy
 * number"), HANDOFF §5's design register. AGENTS.md turns a refusal into a
 * Playwright test, so here they are.
 *
 * These assert against the WIRE, not a screen, and that is deliberate rather
 * than a shortcut. `/leaderboard`, `/bench` and `/dashboard` are declared
 * doors in the frozen authz table (authz.ts:68,73,74) but they are absent
 * from `UNBUILT_SCREENS`, so no route exists and nothing renders — the
 * first test below pins exactly that, so the day a screen arrives at one of
 * those paths this suite fails and someone has to come back and write the
 * rendered-surface half of each refusal.
 *
 * The wire half is not a lesser test. An aggregate headline can only be
 * drawn from a number the server sent, and a probe can only be shown from a
 * probe shape the client can see; refusing both at the contract boundary is
 * what makes the screen unable to violate the rule later. The mock IS the
 * backend today (review-refusals.spec.ts states the same), so it is the
 * thing to hold.
 *
 * Never weaken an assertion — a test that cannot pass against a new design
 * is a conflict in the design: stop and report.
 */

/** Somewhere with MSW booted and a session; the wire is what we then ask. */
async function app(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("main").first()).toBeVisible();
}

const json = async (page: Page, url: string): Promise<unknown> =>
  page.evaluate((u) => fetch(u).then((r) => r.json()), url);

const status = async (page: Page, url: string): Promise<number> =>
  page.evaluate((u) => fetch(u).then((r) => r.status), url);

/** Every key at every depth, flattened to dotted paths, for a "nothing named X" sweep. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${prefix}[]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const path = prefix === "" ? k : `${prefix}.${k}`;
    return [path, ...keyPaths(v, path)];
  });
}

// ---------------------------------------------------------------------------
// The enforcement surface itself
// ---------------------------------------------------------------------------

/*
 * Rule (recorded nowhere else): the three analysis doors are granted by authz
 * but have NO screen — so no rendered-surface refusal test can exist yet. This
 * test is the tripwire: build one and it fails, which is the prompt to write
 * the rendered half of every refusal below.
 */
test("the leaderboard, bench and dashboard doors render nothing — no UI surface exists to refuse on", async ({
  page,
}) => {
  for (const door of ["/leaderboard", "/bench", "/dashboard"]) {
    await page.goto(door);
    await expect(
      page.getByTestId("not-found"),
      `${door} now renders a screen — the refusal tests below must grow a rendered half`,
    ).toBeVisible();
  }
});

// ---------------------------------------------------------------------------
// Refusal 1 — no aggregate headline accuracy number (PRD §8.4, CONTEXT §14)
// ---------------------------------------------------------------------------

// Rule: the leaderboard is per engine × section × jurisdiction. No aggregate accuracy exists — not per engine, not overall.
test("the leaderboard carries no aggregate accuracy — only per-cell figures", async ({
  page,
}) => {
  await app(page);
  const body = (await json(page, "/api/engines/leaderboard")) as {
    cells: Record<string, unknown>[];
  };

  // The payload is cells and nothing else: no sibling key can hold a headline.
  expect(Object.keys(body)).toEqual(["cells"]);
  expect(body.cells.length).toBeGreaterThan(0);

  for (const cell of body.cells) {
    // A cell is addressed by all three axes — an engine-level roll-up would
    // have to drop one of them, and there is nowhere to put it.
    expect(Object.keys(cell).sort()).toEqual(
      [
        "accuracy_by_tag",
        "cost_per_1k_pages_usd",
        "engine_id",
        "golden_coverage",
        "jurisdiction",
        "no_truth_yet",
        "p95_latency_ms",
        "section",
      ].sort(),
    );
    // Accuracy is a map BY TAG CLASS, never one number. Collapsing the tag
    // classes is exactly the headline this rule forbids.
    const acc = cell["accuracy_by_tag"];
    expect(typeof acc === "object" || acc === null).toBe(true);
  }
});

// Rule: NO TRUTH YET is an answer. A cell with thin golden coverage reports absence, never an averaged-in number.
test("thin-coverage cells say NO TRUTH YET rather than carrying a number", async ({
  page,
}) => {
  await app(page);
  const body = (await json(page, "/api/engines/leaderboard")) as {
    cells: {
      no_truth_yet: boolean;
      accuracy_by_tag: unknown;
      golden_coverage: number | null;
    }[];
  };
  const thin = body.cells.filter((c) => c.no_truth_yet);
  expect(thin.length, "the fixture must exercise the NO TRUTH YET case").toBeGreaterThan(
    0,
  );
  for (const cell of thin) {
    expect(cell.accuracy_by_tag).toBeNull();
  }
});

// Rule: the extraction bench reports section × tag counts. It has no aggregate pass rate either — a single "97%" is the same forbidden headline.
test("the bench reports counts per section × tag, never an aggregate rate", async ({
  page,
}) => {
  await app(page);
  const body = (await json(page, "/api/bench/results")) as Record<string, unknown>;

  const paths = keyPaths(body);
  for (const key of paths) {
    const leaf = key.split(".").pop() ?? key;
    expect(
      leaf,
      `bench payload grew "${key}" — an aggregate rate is the forbidden headline`,
    ).not.toMatch(/^(accuracy|pass_rate|score|overall|aggregate|headline)$/);
  }

  // `total_fields` is a COUNT of the seed bench, not a rate — the distinction
  // is the rule. Guard it: an integer, never a fraction.
  expect(Number.isInteger(body["total_fields"])).toBe(true);

  // Cells carry the two numbers a reader needs to see the denominator, and
  // deliberately not the quotient — a rate hides how thin the sample is.
  const cells = body["cells"] as Record<string, unknown>[];
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells) {
    expect(Object.keys(cell).sort()).toEqual(["fields", "passed", "section", "tag"]);
  }
});

// Rule: the metrics payload's headline is catch_rate — the ungameable one. No accuracy headline may be added beside it.
test("metrics carries no aggregate accuracy number anywhere in the payload", async ({
  page,
}) => {
  await app(page);
  const body = (await json(page, "/api/metrics")) as Record<string, unknown>;

  for (const key of keyPaths(body)) {
    const leaf = key.split(".").pop() ?? key;
    expect(
      leaf,
      `metrics grew "${key}" — CONTEXT §14 forbids an aggregate accuracy headline`,
    ).not.toMatch(/^(accuracy|overall_accuracy|aggregate|score|headline|grade)$/);
  }

  // The headline that IS allowed, present — gating everything off is not a fix.
  expect(typeof body["catch_rate"]).toBe("number");
});

// ---------------------------------------------------------------------------
// Refusal 2 — no auto-promotion (PRD §8.4, CONTEXT §15)
// ---------------------------------------------------------------------------

// Rule: a seat change is engineer-approved and logged with an evidence link. Nothing promotes an engine automatically.
test("a seat change is refused without an evidence link", async ({ page }) => {
  await app(page);
  const before = (await json(page, "/api/engines/routing")) as {
    cells: Record<string, string>[];
  };
  const cell = before.cells[0];
  expect(cell, "the fixture must have a routing cell to flip").toBeDefined();

  const attempt = await page.evaluate(
    (c) =>
      fetch("/api/engines/routing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jurisdiction: c["jurisdiction"],
          section: c["section"],
          seat: c["seat"],
          engine_id: "tesseract",
          evidence_url: "",
        }),
      }).then(async (r) => ({ status: r.status, body: await r.text() })),
    cell as unknown as Record<string, string>,
  );
  expect(attempt.status).toBe(422);

  // and the seat did not move
  const after = (await json(page, "/api/engines/routing")) as {
    cells: Record<string, string>[];
  };
  expect(after.cells[0]?.["engine_id"]).toBe(cell?.["engine_id"]);
});

// Rule: the seat change is a HUMAN act — a role without routing.flip is refused at the wire, whatever any screen draws.
test("a reviewer cannot flip a seat", async ({ page }) => {
  await app(page);
  const before = (await json(page, "/api/engines/routing")) as {
    cells: Record<string, string>[];
  };
  const cell = before.cells[0];
  const refused = await page.evaluate(
    (c) =>
      fetch("/api/engines/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-role": "reviewer" },
        body: JSON.stringify({
          jurisdiction: c["jurisdiction"],
          section: c["section"],
          seat: c["seat"],
          engine_id: "tesseract",
          evidence_url: "https://example.invalid/run-47",
        }),
      }).then(async (r) => ({ status: r.status, body: await r.text() })),
    cell as unknown as Record<string, string>,
  );
  expect(refused.status).toBe(403);
  expect(refused.body).toContain("routing.flip");
});

// Rule: an accepted seat change records WHO and WITH WHAT. The positive control — refusing every flip is not the rule.
test("an engineer-approved flip records approver and evidence", async ({ page }) => {
  await app(page);
  const before = (await json(page, "/api/engines/routing")) as {
    cells: Record<string, string>[];
  };
  const cell = before.cells[0];
  const accepted = await page.evaluate(
    (c) =>
      fetch("/api/engines/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-role": "engineer" },
        body: JSON.stringify({
          jurisdiction: c["jurisdiction"],
          section: c["section"],
          seat: c["seat"],
          engine_id: "tesseract",
          evidence_url: "https://example.invalid/run-47",
        }),
      }).then((r) => r.status),
    cell as unknown as Record<string, string>,
  );
  expect(accepted).toBe(200);

  const after = (await json(page, "/api/engines/routing")) as {
    cells: Record<string, string | null>[];
  };
  const moved = after.cells[0];
  expect(moved?.["engine_id"]).toBe("tesseract");
  expect(moved?.["approved_by"]).toBeTruthy();
  expect(moved?.["approved_at"]).toBeTruthy();
  expect(moved?.["evidence_url"]).toBe("https://example.invalid/run-47");
});

// ---------------------------------------------------------------------------
// Refusal 3 — probes are never visible (CONTEXT §14, entities.ts:17)
// ---------------------------------------------------------------------------

// Rule: probes surface as AGGREGATE counts only. No probe detail is reachable by any client.
test("probes appear only as aggregate counts — no probe detail exists on the wire", async ({
  page,
}) => {
  await app(page);
  const body = (await json(page, "/api/metrics")) as Record<string, unknown>;

  // The two counts and the derived rate the server computed — and nothing else
  // named for a probe. A list, an id, or a planted-defect body would let a
  // reviewer learn which field was planted, which destroys the measurement.
  const probeKeys = keyPaths(body).filter((k) => /probe/i.test(k));
  expect(probeKeys.sort()).toEqual(["probes_caught", "probes_planted"]);
  expect(Number.isInteger(body["probes_planted"])).toBe(true);
  expect(Number.isInteger(body["probes_caught"])).toBe(true);
});

// Rule: probe details are never a drill-down signal — the dashboard number opens into nothing.
test("no drill-down signal exposes probes", async ({ page }) => {
  await app(page);
  for (const signal of ["probes", "probe", "catch_rate", "planted"]) {
    expect(
      await status(page, `/api/derived/${signal}`),
      `/api/derived/${signal} answered — probe detail must never be a signal`,
    ).toBe(404);
  }
  // The positive control: real signals do open, so 404 above means "refused",
  // not "the endpoint is broken".
  expect(await status(page, "/api/derived/corrections")).toBe(200);
});

// Rule: no order, field, or review payload may carry a probe marking — the reviewer must not be able to tell.
test("no order or review payload marks a field as a probe", async ({ page }) => {
  await app(page);
  for (const url of [
    "/api/orders/ord_demo_1/context",
    "/api/orders/ord_demo_1/fields",
    "/api/orders/ord_demo_1/timeline",
    "/api/queue/next",
  ]) {
    const body = await json(page, url);
    const leaked = keyPaths(body).filter((k) => /probe|planted|synthetic_defect/i.test(k));
    expect(leaked, `${url} leaks a probe marking`).toEqual([]);
  }
});

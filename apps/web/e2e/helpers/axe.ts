import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * `axe-core` is a transitive dependency of `@axe-core/playwright`, not a
 * direct one, and pnpm's strict node_modules layout means `from "axe-core"` does
 * not resolve from this package. The violation type is therefore DERIVED from
 * the builder's own return type rather than imported — which also means it
 * cannot drift from the installed version.
 */
type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type Violation = AxeResults["violations"][number];

/**
 * The accessibility gate. What it cannot do, stated so it is not
 * over-trusted: axe finds roughly a third of WCAG failures, and cannot see
 * a missing keyboard alternative (2.5.7) or a missing live region (4.1.3)
 * — those two are why the app uses react-aria-components. This fixture is
 * the floor under that choice, not a substitute for it.
 *
 * Usage:
 *
 *   test("queue is accessible", async ({ page }, testInfo) => {
 *     await page.goto("/queue");
 *     await expectNoAxeViolations(page, testInfo);
 *   });
 *
 * Or, for a whole route list, `describeAxeForRoutes(ROUTES)`.
 */

/**
 * WCAG 2.2 AA, which is three tags rather than one.
 *
 * Axe models conformance CUMULATIVELY: `wcag22aa` carries ONLY the criteria
 * that 2.2 AA added (2.4.11 focus not obscured, 2.5.8 target size), not the
 * 2.0 and 2.1 criteria it inherits. Tagging only `wcag22aa` would run a
 * handful of rules and pass almost anything — a green that means nothing,
 * which is the same failure mode this fixture exists to end. All three levels
 * are listed for that reason.
 *
 * `best-practice` is deliberately EXCLUDED. Those rules are not WCAG, they
 * fail on defensible choices, and a gate that cries wolf gets disabled.
 */
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Nothing is disabled here, and that is deliberate: the list is empty rather
 * than absent so that adding to it requires writing a reason next to the rule
 * id. A disabled rule with no justification is how a suite quietly stops
 * testing.
 *
 * `color-contrast` in particular STAYS ON. The design is custom and the token
 * layer is ours, so contrast is a design defect we can fix, not an upstream
 * constraint we must tolerate.
 */
const DISABLED_RULES: readonly string[] = [];

/** Axe's own severity ordering, worst first, for readable reports. */
const IMPACT_ORDER = ["critical", "serious", "moderate", "minor"] as const;

function formatViolations(violations: Violation[]): string {
  const sorted = [...violations].sort(
    (a, b) =>
      IMPACT_ORDER.indexOf((a.impact ?? "minor") as (typeof IMPACT_ORDER)[number]) -
      IMPACT_ORDER.indexOf((b.impact ?? "minor") as (typeof IMPACT_ORDER)[number]),
  );

  return sorted
    .map((v) => {
      // Every failing node, not just the first. One `color-contrast` violation
      // can carry forty nodes, and "there is a contrast problem somewhere on
      // this page" is not an actionable failure message.
      const nodes = v.nodes
        .map((n) => `      - ${n.target.join(" ")}\n        ${n.failureSummary ?? ""}`)
        .join("\n");
      return `  [${v.impact ?? "unknown"}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join("\n\n");
}

export interface AxeScanOptions {
  /** CSS selector to scope the scan to, e.g. `main`. Defaults to the page. */
  readonly include?: string;
  /**
   * Selectors to exclude. Use for VENDORED third-party DOM we do not own —
   * never to silence our own components.
   */
  readonly exclude?: readonly string[];
}

/**
 * Runs axe against the current page state and FAILS the test on any violation.
 *
 * Call it after the page has reached the state you mean to assert on — after a
 * dialog is open, after a menu is expanded. Axe scans the live DOM, so an
 * overlay that is not open is an overlay that is not tested, and the dense
 * keyboard-driven surfaces in this app are mostly overlays.
 *
 * The full JSON result is attached to the Playwright report on failure, so CI
 * carries the evidence rather than just the message.
 */
export async function expectNoAxeViolations(
  page: Page,
  testInfo?: TestInfo,
  options: AxeScanOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_22_AA);

  if (options.include !== undefined) builder = builder.include(options.include);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  if (DISABLED_RULES.length > 0) builder = builder.disableRules([...DISABLED_RULES]);

  const results = await builder.analyze();

  if (testInfo !== undefined && results.violations.length > 0) {
    await testInfo.attach(`axe-${testInfo.title.replace(/\W+/g, "-")}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
  }

  expect(
    results.violations,
    results.violations.length === 0
      ? "no WCAG 2.2 AA violations"
      : `WCAG 2.2 AA violations on ${page.url()}:\n\n${formatViolations(results.violations)}\n`,
  ).toEqual([]);
}

/**
 * Asserts a route is clean once it has actually rendered.
 *
 * The wait matters. This app is client-rendered, so `goto` resolves against an
 * empty `<div id="root">`; axe would scan nothing, find nothing and PASS. That
 * is the exact shape of vacuous green this fixture was written to remove, so
 * the render is waited for here rather than left to each caller to remember.
 * It mirrors `e2e/smoke/routes.spec.ts`'s `main, header` wait for the same
 * reason.
 */
export async function expectRouteAccessible(
  page: Page,
  route: string,
  testInfo?: TestInfo,
  options: AxeScanOptions = {},
): Promise<void> {
  await page.goto(route);
  await expect(page.locator("main, header").first()).toBeVisible();
  await expectNoAxeViolations(page, testInfo, options);
}

/**
 * Declares one test per route, which is the point: a single test over a loop
 * would stop at the first failing route and report one page's violations as if
 * they were the app's. Separate tests give a per-route inventory, and a route
 * that regresses names itself.
 *
 * No sign-in step. The demo session store boots as admin on load, so every
 * route in the door table is reachable by `goto` alone — the same assumption
 * `e2e/smoke/routes.spec.ts` already runs on. Seat-scoped scans belong in a
 * spec that switches seats in-page, not here.
 */
export function describeAxeForRoutes(
  routes: readonly string[],
  options: AxeScanOptions = {},
): void {
  for (const route of routes) {
    test(`a11y ${route}`, async ({ page }, testInfo) => {
      await expectRouteAccessible(page, route, testInfo, options);
    });
  }
}

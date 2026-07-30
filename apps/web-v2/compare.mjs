/**
 * Side-by-side capture: the approved design vs web-v2.
 *
 * Kept, not temporary. This is the tool that found the review sheet rendering
 * its values outside their own rows, the lifecycle board hiding two stages
 * behind a scrollbar, and the delivered screen confirming the wrong order — all
 * of them invisible to a green test suite. Re-deriving it every time somebody
 * doubts the UI is waste. It lives in apps/web-v2 because that is where
 * `@playwright/test` resolves from.
 *
 *   node compare.mjs <screen|all> [out-dir]
 *   node compare.mjs queue ../../shots
 *   node compare.mjs all ../../shots
 *
 * THE SELECTOR USED TO MATCH NOTHING. It drove the design with
 * `nav button` — but the export's sidebar is an `<aside>`, and the only `<nav>`
 * in its 3,779 lines is Review's section rail. `locator.count()` on a miss is
 * 0, not an error, so the tool warned to stdout and captured the DEFAULT screen
 * instead: every "design" screenshot it ever wrote was the Queue. Two full
 * fidelity passes were run against those pairs. The click paths below are keyed
 * to the export's real structure, and a miss now THROWS rather than quietly
 * capturing the wrong screen.
 *
 * Requires both servers already running (do NOT start or kill them):
 *   http://localhost:5174  web-v2 dev server (vite.config, not launch.json's 5173)
 *   http://localhost:4600  the design export, serving TitlePipe.dc.html
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * How to reach each screen in the export, and the app route that draws it.
 * `menu: true` opens the identity menu in the top strip first — Profile, the
 * session-ended demo and Sign out live there, not in the sidebar.
 */
const SCREENS = {
  queue: { route: "/queue", click: ["Queue"] },
  overview: { route: "/overview", click: ["Overview"] },
  upload: { route: "/ingest", click: ["Upload"] },
  questions: { route: "/questions", click: ["Questions"] },
  processing: { route: "/processing", click: ["Processing"] },
  completeness: { route: "/completeness", click: ["Completeness"] },
  review: { route: "/orders/ord_demo_1/review", click: ["Review"] },
  delivered: { route: "/delivered", click: ["Delivered"] },
  rulebook: { route: "/rulebook", click: ["Rulebook"] },
  products: { route: "/products", click: ["Products & sign-off"] },
  clients: { route: "/clients", click: ["Clients"] },
  people: { route: "/people", click: ["People"] },
  audit: { route: "/audit", click: ["Audit"] },
  gallery: { route: "/gallery", click: ["States"] },
  // Reached from the queue's escalated held row, not from the rail.
  escalation: { route: "/escalations", click: ["Queue", "Open →"] },
  profile: { route: "/profile", menu: true, click: ["Profile"] },
  session: { route: "/session", menu: true, click: ["Session ended · demo"] },
  signin: { route: "/signin", menu: true, click: ["Sign out"] },
};

const [which, out = "../../shots"] = process.argv.slice(2);
if (which === undefined) {
  console.error(`usage: node compare.mjs <screen|all> [out-dir]`);
  console.error(`screens: ${Object.keys(SCREENS).join(" ")}`);
  process.exit(1);
}
const chosen = which === "all" ? Object.keys(SCREENS) : [which];
for (const key of chosen) {
  if (!(key in SCREENS)) {
    console.error(`unknown screen "${key}" — one of: ${Object.keys(SCREENS).join(" ")}`);
    process.exit(1);
  }
}
mkdirSync(out, { recursive: true });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const design = await ctx.newPage();
const app = await ctx.newPage();
const appErrors = [];
app.on("pageerror", (e) => appErrors.push(e.message));

for (const key of chosen) {
  const screen = SCREENS[key];

  await design.goto("http://localhost:4600/TitlePipe.dc.html");
  await design.waitForTimeout(1800);
  if (screen.menu === true) {
    await design.locator("header button", { hasText: "R. Delacroix" }).first().click();
    await design.waitForTimeout(250);
  }
  for (const label of screen.click) {
    const exact = design
      .locator("button", { hasText: new RegExp(`^\\s*${escapeRe(label)}\\s*$`) })
      .first();
    if ((await exact.count()) > 0) {
      await exact.click();
    } else {
      const loose = design.locator("button", { hasText: label }).first();
      // A miss must be loud. Warning and carrying on is what produced eighteen
      // screenshots of the same screen.
      if ((await loose.count()) === 0) {
        throw new Error(`${key}: no button in the export matching "${label}"`);
      }
      await loose.click();
    }
    await design.waitForTimeout(500);
  }
  await design.waitForTimeout(500);
  await design.screenshot({ path: `${out}/design-${key}.png`, fullPage: true });

  await app.goto(`http://localhost:5174${screen.route}`, { waitUntil: "networkidle" });
  await app.waitForTimeout(900);
  await app.screenshot({ path: `${out}/app-${key}.png`, fullPage: true });

  console.log(`design-${key}.png / app-${key}.png -> ${out}`);
}

await browser.close();
if (appErrors.length > 0) console.log("APP PAGE ERRORS:\n" + [...new Set(appErrors)].join("\n"));

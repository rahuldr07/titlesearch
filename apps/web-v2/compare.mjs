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
 *   node compare.mjs <DesignMenuLabel> <app-route> <out-dir>
 *   node compare.mjs Queue /queue ../../shots
 *
 * Requires both servers already running (do NOT start or kill them):
 *   http://localhost:5174  web-v2 dev server
 *   http://localhost:4600  the design export
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [label, route, out] = process.argv.slice(2);
if (!label || !route || !out) {
  console.error("usage: node compare.mjs <DesignMenuLabel> <app-route> <out-dir>");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

/**
 * Git Bash rewrites a leading-slash argument into a Windows path, so `/queue`
 * arrives as `C:/Program Files/Git/queue`. Recover the route rather than making
 * every caller remember to set MSYS_NO_PATHCONV.
 */
function normalizeRoute(raw) {
  let r = raw;
  if (/^[A-Za-z]:[\\/]/.test(r)) {
    const marker = r.match(/[\\/]Git[\\/]/i);
    r = marker ? r.slice(marker.index + marker[0].length) : r.replace(/^[A-Za-z]:[\\/]/, "");
  }
  return r.startsWith("/") ? r : `/${r}`;
}

const path = normalizeRoute(route);

const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

const design = await ctx.newPage();
await design.goto("http://localhost:4600/TitlePipe.dc.html");
await design.waitForTimeout(1500);
const btn = design.locator("nav button", { hasText: new RegExp(`^${label}$`) }).first();
if (await btn.count()) {
  await btn.click();
  await design.waitForTimeout(600);
} else {
  console.warn(`! no design menu button named "${label}" — captured the default screen`);
}
await design.screenshot({ path: `${out}/design-${slug}.png`, fullPage: true });

const app = await ctx.newPage();
const errors = [];
app.on("pageerror", (e) => errors.push(e.message));
await app.goto(`http://localhost:5174${path}`, { waitUntil: "networkidle" });
await app.waitForTimeout(800);
await app.screenshot({ path: `${out}/app-${slug}.png`, fullPage: true });

await browser.close();
console.log(`design-${slug}.png / app-${slug}.png written to ${out}`);
if (errors.length) console.log("PAGE ERRORS:", errors.join(" | "));

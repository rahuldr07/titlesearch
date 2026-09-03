import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const ROUTES = [
  "/", "/orders-list", "/orders", "/ingest", "/delivery", "/escalations",
  "/templates", "/jurisdiction", "/account", "/blind",
  "/orders/ord_demo_1", "/orders/ord_demo_1/review",
  "/orders/ord_demo_1/release", "/blind/ord_demo_1",
];

const browser = await chromium.launch();
const out = {};
for (const route of ROUTES) {
  const page = await browser.newPage({ baseURL: "http://localhost:4274" });
  await page.goto(route);
  try {
    await page.locator("main, header").first().waitFor({ state: "visible", timeout: 30000 });
  } catch { out[route] = { error: "no render" }; await page.close(); continue; }
  const r = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  out[route] = r.violations.map((v) => ({
    id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  await page.close();
}
await browser.close();
writeFileSync("/tmp/axe-inventory.json", JSON.stringify(out, null, 2));
console.log("done");

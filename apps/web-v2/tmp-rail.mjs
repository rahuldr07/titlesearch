import { chromium } from "@playwright/test";
const out = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });

const app = await ctx.newPage();
await app.goto("http://localhost:5174/completeness", { waitUntil: "networkidle" });
await app.waitForTimeout(600);
await app.getByTestId("account-menu").click();
await app.waitForTimeout(200);
await app.getByTestId("role-reviewer").click();
await app.keyboard.press("Escape");
await app.waitForTimeout(900);
const rail = app.getByTestId("side-rail");
await rail.screenshot({ path: `${out}/app-rail.png` });
console.log("APP RAIL:\n" + (await rail.innerText()));

const d = await ctx.newPage();
await d.goto("http://localhost:4600/TitlePipe.dc.html");
await d.waitForTimeout(1800);
await d.locator("button", { hasText: /^\s*Completeness\s*$/ }).first().click();
await d.waitForTimeout(700);
const aside = d.locator("aside").first();
await aside.screenshot({ path: `${out}/design-rail.png` });
console.log("\nDESIGN RAIL:\n" + (await aside.innerText()));
await b.close();

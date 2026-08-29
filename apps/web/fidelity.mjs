/**
 * FIDELITY — our screen beside the design's, in one browser, at one width.
 *
 * This is the check that was missing, and its absence is why the screens drifted.
 * Every gate this repo has — tsc, eslint, check-rules, 334 unit tests, axe, the
 * invariant specs — answers "does it work". Not one of them answers "does it
 * look like the design", so nine screens were built from a prose summary and
 * nobody put them side by side until the owner did.
 *
 * DELIBERATELY NOT A PIXEL DIFF. The 2026-07 attempt is written up in
 * REVIEW-01's ancestor: the prototype's data is invented (its own README says
 * the parties and refs are generator fiction), so a differ returns "different"
 * on every screen forever and the signal drowns. What is compared here is
 * STRUCTURE — the labels the design names, the marks it draws, the elements it
 * says are present — which is what actually drifted.
 *
 * Run:  node fidelity.mjs           (prints a report)
 *       node fidelity.mjs --shots   (also writes /tmp/fid-*.png)
 */
import { chromium } from "@playwright/test";

const APP = process.env["APP"] ?? "http://localhost:5185";
const DESIGN =
  "file:///home/rahul/projects/titlesearch/docs/frontend/design-2026-08/reference-app.html";
const SHOTS = process.argv.includes("--shots");

/**
 * What the design's own README §Screens says each screen carries. Quoted, not
 * paraphrased — a paraphrase is where the invented copy came from.
 */
const EXPECTED = {
  "/": {
    design: "Overview",
    // README §2: "greeting header, 4 stat cards … Active Spotlight card …
    // Recent orders table (last 10)"
    wants: ["4 stat cards", "spotlight card", "primary CTA in the spotlight"],
  },
  "/queue": {
    design: "All Orders",
    // README §3. NOTE: this screen is the open CONFLICT — the contract has no
    // browse endpoint by construction. See CONFLICT-all-orders.md.
    wants: ["served order", "pass affordance"],
  },
  "/ingest": {
    design: "Intake / Upload",
    // README §5: "two-column card: dropzone … Right: client/product/order#
    // fields, page count + jurisdiction read-only"
    wants: ["dropzone", "order fields", "read-only page count"],
  },
};

/** Open the prototype and get past its sign-in overlay. */
async function openDesign(page) {
  await page.goto(DESIGN, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const signIn = page.locator("text=Sign in").first();
  const box = await signIn.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(2000);
  }
}

/**
 * The rail is on every screen, so it is checked once and hardest. These are the
 * elements the design draws that a flat link list does not have — the exact gap
 * the owner spotted in a screenshot.
 */
async function compareRail(ours, theirs) {
  const read = (page) =>
    page.evaluate(() => {
      const t = document.body.innerText;
      return {
        rubrics: (t.match(/\b(PIPELINE|ACTIVE ORDER|PLATFORM TOOLS)\b/g) ?? []).length,
        hasSearch: /Quick jump|⌘K/.test(t),
        // count badges: a bare number or a short token sitting beside a door
        badges: (t.match(/^\s*(\d{1,3}|v\d+\.\d+|\d+ QC)\s*$/gm) ?? []).length,
        namesActiveOrder: /\d{7}-\d/.test(t),
        stageMarks: (t.match(/^[✓•]$|^[1-5]$/gm) ?? []).length,
        /*
         * Case-insensitive: the design writes "Admin" in a pill and this app
         * writes the contract's own role name, which is lowercase (`admin` —
         * authz.ts:31). The role is PRESENT in both; only its casing differs,
         * and rule 4 (sentence case) is on our side of that.
         */
        hasProfileRole: /\b(admin|reviewer|senior|ops|engineer|typist)\b/i.test(t),
      };
    });
  return { ours: await read(ours), theirs: await read(theirs) };
}

const browser = await chromium.launch();
const ours = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const theirs = await browser.newPage({ viewport: { width: 1440, height: 960 } });

await openDesign(theirs);
/*
 * AN ORDER-SCOPED ROUTE, not "/". The rail's Active Order section only draws
 * stages when an order is in scope — correctly, since a stage is where THIS
 * order's work has got to. Measuring the rail on "/" reported zero stage marks
 * against the design's seven and made a working section look missing.
 */
await ours.goto(APP + "/orders/ord_demo_1", { waitUntil: "networkidle" });
await ours.waitForTimeout(1200);

const rail = await compareRail(ours, theirs);
console.log("\nRAIL — on every screen, so it counts most\n");
for (const key of Object.keys(rail.theirs)) {
  const a = rail.ours[key];
  const b = rail.theirs[key];
  const same = String(a) === String(b);
  console.log(`  ${same ? "ok  " : "DIFF"} ${key.padEnd(18)} ours=${String(a).padEnd(6)} design=${b}`);
}

if (SHOTS) {
  await ours.screenshot({ path: "/tmp/fid-ours.png", fullPage: false });
  await theirs.screenshot({ path: "/tmp/fid-design.png", fullPage: false });
  console.log("\nwrote /tmp/fid-ours.png and /tmp/fid-design.png");
}

await browser.close();

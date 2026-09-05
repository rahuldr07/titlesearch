/**
 * MEASURE THE BUILT SCREEN AGAINST THE PROTOTYPE, IN ONE BROWSER.
 *
 * Not a screenshot diff. The two are not pixel-comparable — the prototype
 * draws no Queue artboard at all (its screen named `queue` is labelled
 * "Overview"; the browsable table is All Orders), so there is no reference
 * image of this screen to subtract. What IS comparable is the vocabulary both
 * are built from: the card, the type ramp, the two control sizes, the input.
 *
 * So both are driven in the same Chromium at the same viewport and read with
 * `getComputedStyle`/`getBoundingClientRect`. A class name being present
 * proves nothing about whether a rule was emitted — REVIEW-04 established the
 * method for the same reason, and this is that method pointed at /queue.
 *
 *   node scripts/reference-app.mjs --out /tmp/tp-reference   # once
 *   pnpm --filter @titlepipe/web preview                     # or dev
 *   node scripts/pixel-parity.mjs --reference /tmp/tp-reference \
 *        --app http://localhost:4788 --shots /tmp/tp-reference
 *
 * Prints a markdown table and exits 0. It is deliberately NOT a gate: the
 * differences it finds are kit-level questions with owners
 * (docs/HANDOFF-frontend-2026-09-03.md), and a gate that fails on an open
 * question blocks every commit including the one that answers it.
 */
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 960 };

/** The unbundled prototype loads its assets by bare uuid, so it needs an
 *  origin: `file://` refuses the fetch its runtime makes. */
function serve(dir) {
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };
  const server = http.createServer((req, res) => {
    const name =
      decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "") ||
      "index.html";
    const path = join(dir, name);
    if (!existsSync(path)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const dot = name.lastIndexOf(".");
    res.writeHead(200, {
      "content-type": (dot === -1 ? undefined : TYPES[name.slice(dot)]) ?? "font/woff2",
    });
    res.end(readFileSync(path));
  });
  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

/** Serialised into the page: the probe has to run where the styles are. */
const MEASURE = `(el) => {
  if (el === null) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    h: Math.round(r.height),
    font: s.fontFamily.split(",")[0].replace(/"/g, ""),
    size: s.fontSize,
    weight: s.fontWeight,
    tracking: s.letterSpacing,
    ink: s.color,
    fill: s.backgroundColor,
    radius: s.borderRadius,
    edge: s.borderTopWidth + " " + s.borderTopColor,
    pad: s.padding,
    shadow: s.boxShadow.replace(/rgba\\(0, 0, 0, 0\\) 0px 0px 0px 0px(, )?/g, "") || "none",
  };
}`;

async function readReference(page, url) {
  await page.goto(url);
  await page.waitForSelector("h1", { timeout: 20000 });
  return page.evaluate((src) => {
    const M = eval("(" + src + ")");
    const byText = (text) =>
      [...document.querySelectorAll("button")].find((b) =>
        b.innerText.trim().startsWith(text),
      ) ?? null;
    /* The app shell root, which is where the prototype puts the canvas
       colour and the 1360px floor — not on `body`, which sits behind it. */
    const shell = [...document.querySelectorAll("div")].find(
      (d) => getComputedStyle(d).minWidth === "1360px",
    );
    const cards = [...document.querySelectorAll("div")].filter((d) => {
      const s = getComputedStyle(d);
      const r = d.getBoundingClientRect();
      return (
        s.backgroundColor === "rgb(255, 255, 255)" &&
        r.width > 500 &&
        r.height > 90 &&
        parseFloat(s.borderRadius) > 0
      );
    });
    return {
      shell: shell === undefined ? null : M(shell),
      rail: M(
        [...document.querySelectorAll("div")].find(
          (d) => getComputedStyle(d).backgroundColor === "rgb(30, 27, 46)",
        ) ?? null,
      ),
      title: M(document.querySelector("h1")),
      card: M(cards[cards.length - 1] ?? null),
      lead: M(byText("Launch Workstation")),
      beside: M(byText("Audit History")),
    };
  }, MEASURE);
}

/** The prototype's only text box on this screen lives in the ⌘K palette, so
 *  the palette is opened to read it rather than the stylesheet quoted at
 *  second hand. */
async function readReferenceInput(page) {
  await page.getByRole("button", { name: /Quick jump/ }).click({ force: true });
  await page.waitForSelector("input", { timeout: 10000 });
  return page.evaluate((src) => {
    const M = eval("(" + src + ")");
    return { input: M(document.querySelector("input")) };
  }, MEASURE);
}

async function readQueue(page, origin) {
  await page.goto(`${origin}/queue`);
  await page.waitForSelector("[data-testid='order-ref']", { timeout: 20000 });
  const closed = await page.evaluate((src) => {
    const M = eval("(" + src + ")");
    const byText = (text) =>
      [...document.querySelectorAll("button")].find((b) =>
        b.innerText.trim().startsWith(text),
      ) ?? null;
    return {
      shell: M(document.body),
      rail: M(document.querySelector("[data-testid='side-rail']")),
      title: M(document.querySelector("h1")),
      card: M(document.querySelector("[data-slot='card']")),
      lead: M(byText("Start review")),
      beside: M(byText("Pass")),
    };
  }, MEASURE);
  // The reason field only exists once the pass is open, so open it.
  await page.keyboard.press("p");
  await page.waitForSelector("[data-testid='pass-reason'] input");
  const open = await page.evaluate((src) => {
    const M = eval("(" + src + ")");
    return { input: M(document.querySelector("[data-testid='pass-reason'] input")) };
  }, MEASURE);
  return { ...closed, ...open };
}

function table(rows) {
  const keys = ["h", "size", "weight", "tracking", "ink", "fill", "radius", "pad"];
  const lines = ["| probe | field | prototype | /queue |", "|---|---|---|---|"];
  for (const [name, ref, ours] of rows) {
    for (const key of keys) {
      const a = ref?.[key] ?? "—";
      const b = ours?.[key] ?? "—";
      if (a === b) continue;
      lines.push(`| ${name} | ${key} | \`${a}\` | \`${b}\` |`);
    }
  }
  return lines.join("\n");
}

function flag(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 || process.argv[at + 1] === undefined
    ? fallback
    : process.argv[at + 1];
}

const referenceDir = resolve(flag("--reference", "/tmp/tp-reference"));
const appOrigin = flag("--app", "http://localhost:4788");
const shots = flag("--shots", referenceDir);

if (!existsSync(join(referenceDir, "index.html"))) {
  console.error(
    `no prototype at ${referenceDir}. Run scripts/reference-app.mjs --out ${referenceDir} first.`,
  );
  process.exit(2);
}

const server = await serve(referenceDir);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const faults = [];
  page.on("pageerror", (e) => faults.push(String(e)));

  const reference = await readReference(
    page,
    `http://127.0.0.1:${server.address().port}/index.html`,
  );
  await page.screenshot({ path: join(shots, "prototype-overview.png") });
  const referenceInput = await readReferenceInput(page);
  await page.keyboard.press("Escape");

  const ours = await readQueue(page, appOrigin);
  await page.screenshot({ path: join(shots, "queue-pass-open.png") });

  console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}\n`);
  console.log(
    table([
      ["app shell", reference.shell, ours.shell],
      ["rail", reference.rail, ours.rail],
      ["screen title", reference.title, ours.title],
      ["card", reference.card, ours.card],
      ["primary action", reference.lead, ours.lead],
      ["action beside it", reference.beside, ours.beside],
      ["text input", referenceInput.input, ours.input],
    ]),
  );
  console.log(`\nscreenshots: ${shots}`);
  if (faults.length > 0) console.log(`page errors: ${faults.slice(0, 3).join(" | ")}`);
} finally {
  await browser.close();
  server.close();
}

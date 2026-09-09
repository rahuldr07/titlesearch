#!/usr/bin/env node
/*
 * Shape A typed search report: composition JSON → certified PDF.
 *
 *   node render-report.mjs <bundle.json> [out-dir] [--rendered-at <iso>] [--preview]
 *
 * Writes <out-dir>/report-v<N>.pdf and <out-dir>/report-v<N>.json — the
 * delivery-record row for the file (filename, bytes, sha256, href). With
 * `--preview`, also <out-dir>/preview.png: a screenshot of the same HTML.
 * That is the body only — @page margin boxes exist in paginated layout, so
 * the running header and footer are in the PDF and not in the PNG.
 *
 * Reports live outside the tree, under $TITLEPIPE_REPORT_DIR/<job>/ — on this
 * machine /home/rahul/projects/titlepipe-data/reports/<job>/ — which the dev
 * middleware serves as /scan/<job>/. That is the href the record carries, so
 * out-dir defaults to that directory when the variable is set.
 *
 * The output is a function of the bundle and `--rendered-at` alone. Chromium
 * stamps the PDF's CreationDate/ModDate from the wall clock; those two fields
 * are rewritten to the pinned time (`pinDates`), so a pinned render is
 * byte-identical run to run.
 *
 * Nothing is invented. Every row printed is a row the composition carries;
 * the certification prints only what the release record carries; a section
 * with no rows is deleted (the template's own rule), while a section whose
 * rows are all absence rows is printed — that absence is the finding.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* apps/web owns the Playwright install; this package declares no browser. */
const PLAYWRIGHT = new URL("../../../apps/web/node_modules/@playwright/test/index.mjs", import.meta.url);

const fail = (msg) => {
  console.error(`render-report: ${msg}`);
  process.exit(1);
};

// ---- argv --------------------------------------------------------------------

const positional = [];
let renderedAtArg = null;
let preview = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--preview") preview = true;
  else if (a === "--rendered-at") renderedAtArg = argv[++i] ?? fail("--rendered-at needs an ISO timestamp");
  else if (a.startsWith("--")) fail(`unknown flag ${a}`);
  else positional.push(a);
}
if (positional.length < 1 || positional.length > 2) {
  console.error(
    "usage: node render-report.mjs <bundle.json> [out-dir] [--rendered-at <iso>] [--preview]\n" +
      "  out-dir defaults to $TITLEPIPE_REPORT_DIR/<provenance.job>, the directory served as /scan/<job>/\n" +
      "  (e.g. /home/rahul/projects/titlepipe-data/reports/web_1788415544_a714e1)",
  );
  process.exit(2);
}
const [bundlePath, outDirArg] = positional;

const renderedAt = renderedAtArg === null ? new Date() : new Date(renderedAtArg);
if (Number.isNaN(renderedAt.getTime())) fail(`--rendered-at is not a date: ${renderedAtArg}`);

// ---- bundle ------------------------------------------------------------------

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const blocks = bundle.composition?.blocks;
if (!Array.isArray(blocks)) fail("composition.blocks is not an array");
for (const b of blocks) {
  if (typeof b.title !== "string" || !Array.isArray(b.values)) fail(`block ${String(b.id)} has no title or no values`);
  for (const v of b.values) {
    if (typeof v.label !== "string" || typeof v.value !== "string") fail(`block ${b.id} has a row without a label and a value`);
  }
}
const ctx = bundle.context ?? {};
/*
 * Two names. The slug names the document — the delivered filename and the
 * footer's report id. The job names the directory the file is served from,
 * reports/<job>/ ↔ /scan/<job>/, so the href is built on the job.
 */
const slug = bundle.slug ?? bundle.provenance?.job;
if (typeof slug !== "string" || slug === "") fail("bundle has neither slug nor provenance.job — nothing to name the file by");
const job = bundle.provenance?.job ?? slug;
const outDir = outDirArg ?? (process.env.TITLEPIPE_REPORT_DIR ? join(process.env.TITLEPIPE_REPORT_DIR, job) : null);
if (outDir === null) fail("no out-dir given and TITLEPIPE_REPORT_DIR is not set");

const release = bundle.release ?? null;
if (release !== null) {
  for (const k of ["signature", "released_at", "version"]) {
    if (release[k] === undefined || release[k] === null) fail(`release.${k} is missing — a certification prints only what the release record carries`);
  }
}
/*
 * A draft is the draft of the first version until a release record says
 * otherwise. The number names the file; nothing in a draft claims release.
 */
const version = release?.version ?? 1;

const rows = blocks.flatMap((b) => b.values);
const pendingRows = rows.filter((v) => v.pending === true);
/* Pending = awaiting an examiner ruling. A release cannot certify one. */
if (release !== null && pendingRows.length > 0) {
  fail(`${pendingRows.length} row(s) still pending a ruling — refusing to certify: ${pendingRows.map((v) => v.label).join(", ")}`);
}

/* The four NA states, as the composition spells them. Muted, never blank. */
const ABSENCE = /^— (not stated|not found|unreadable|structurally absent)\b/;
const absentRows = rows.filter((v) => ABSENCE.test(v.value));

// ---- document ----------------------------------------------------------------

const NOTICE =
  "Please review the enclosed search file and notify us within thirty (30) days of receipt if there are any questions, clarifications, or missing information. If no response is received within this period, the search shall be deemed accepted as complete and accurate to the best of our knowledge.";
/* Rule 17: the notice follows the Legal Description and the Exceptions section. */
const NOTICE_AFTER = /legal description|exception/i;
const FOOTER_SENTENCE = "Every value carries a page and a region citation — see the examination record";

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/* A CSS string literal; `\A ` is the only way a margin box gets a line break. */
const cssStr = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ")}"`;

const templateVersion = bundle.composition?.template_version ?? null;
const band = [
  ctx.order_ref ? `Order ${ctx.order_ref}` : null,
  ctx.client ?? null,
  ctx.product ?? null,
  ctx.jurisdiction_label ?? null,
  templateVersion ? `Template ${templateVersion}` : null,
].filter((s) => s !== null).join(" · ");

const identRows = [
  ["Order", ctx.order_ref],
  ["Client", ctx.client],
  ["Product", ctx.product],
  ["Search period", ctx.period_label],
  ["Jurisdiction", ctx.jurisdiction_label],
  ["Source package", bundle.source?.filename
    ? `${bundle.source.filename}${bundle.source.pages ? ` · ${bundle.source.pages} pages` : ""}`
    : null],
  ["Template", templateVersion],
].filter(([, v]) => v !== null && v !== undefined && v !== "");

const rowHtml = (v) => {
  const absent = ABSENCE.test(v.value);
  const cls = [absent ? "absent" : null, v.pending ? "pending" : null].filter(Boolean).join(" ");
  return `<tr${cls ? ` class="${cls}"` : ""}><th>${esc(v.label)}</th><td>${esc(v.value)}${v.pending ? ' <span class="tag">pending</span>' : ""}</td></tr>`;
};

const sections = [];
const printed = blocks.filter((b) => b.values.length > 0);
for (const b of printed) {
  sections.push(`<section class="block">
<h2><span class="num">${esc(b.numeral ?? "")}</span>${esc(b.title)}</h2>
<table class="rows">
${b.values.map(rowHtml).join("\n")}
</table>
</section>`);
  if (NOTICE_AFTER.test(b.title)) sections.push(`<p class="notice">${esc(NOTICE)}</p>`);
}
if (!printed.some((b) => NOTICE_AFTER.test(b.title))) sections.push(`<p class="notice">${esc(NOTICE)}</p>`);

const closing = release === null
  ? `<div class="draft" aria-hidden="true">DRAFT</div>`
  : `<section class="block cert">
<h2>Certification</h2>
<table class="rows">
<tr><th>Signed</th><td>${esc(release.signature)}</td></tr>
<tr><th>Released</th><td>${esc(release.released_at)}</td></tr>
<tr><th>Version</th><td>${esc(version)}</td></tr>
</table>
<p class="digest">SHA-256 of this document is recorded on the delivery record.</p>
</section>`;

const footerLine = `${slug} · v${version}${release === null ? " · DRAFT" : ""}`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(`Typed search report · ${ctx.order_ref ?? slug} · v${version}`)}</title>
<style>
@page {
  size: Letter;
  margin: 1in 0.85in 1in 0.85in;
  @top-left {
    content: ${cssStr(`TYPED SEARCH REPORT\n${band}`)};
    white-space: pre-line;
    font: 7.5pt/1.5 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace;
    color: #333;
    vertical-align: bottom;
    padding-bottom: 5pt;
    border-bottom: 0.5pt solid #c8c8c8;
  }
  @top-right {
    content: "Page " counter(page) " of " counter(pages);
    font: 7.5pt/1.5 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace;
    color: #333;
    vertical-align: bottom;
    padding-bottom: 5pt;
    border-bottom: 0.5pt solid #c8c8c8;
  }
  @bottom-left {
    content: ${cssStr(`${footerLine}\n${FOOTER_SENTENCE}`)};
    white-space: pre-line;
    font: 7.5pt/1.5 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace;
    color: #333;
    vertical-align: top;
    padding-top: 5pt;
    border-top: 0.5pt solid #c8c8c8;
  }
}
html { color: #000; background: #fff; }
body {
  margin: 0;
  font: 10.5pt/1.4 "Bitstream Charter", "Liberation Serif", "DejaVu Serif", Georgia, "Times New Roman", serif;
}
.mono { font-family: "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; }
.head { margin: 0 0 18pt; padding-bottom: 10pt; border-bottom: 0.5pt solid #c8c8c8; break-after: avoid; }
.head h1 { margin: 0 0 4pt; font-size: 17pt; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
.head .place { margin: 0 0 10pt; font-size: 12pt; }
.ident { border-collapse: collapse; }
.ident th, .ident td { padding: 1pt 0; vertical-align: top; text-align: left; font-weight: 400; }
.ident th { width: 1.6in; font: 7.5pt/1.7 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
.ident td { font-size: 9.5pt; padding-left: 8pt; }
.block { margin: 0 0 16pt; }
h2 { margin: 0 0 4pt; font-size: 11.5pt; font-weight: 700; letter-spacing: 0.02em; break-after: avoid; }
h2 .num { display: inline-block; min-width: 2.2in; font: 8.5pt/1 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; font-weight: 400; color: #444; }
h2 .num:empty { display: none; }
.rows { width: 100%; border-collapse: collapse; }
.rows tr { border-bottom: 0.5pt solid #d6d6d6; break-inside: avoid; }
.rows th, .rows td { padding: 3.5pt 0; vertical-align: top; text-align: left; }
.rows th { width: 2.2in; font: 8.5pt/1.5 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; font-weight: 400; text-transform: uppercase; letter-spacing: 0.04em; color: #222; }
.rows th::after { content: ":"; }
.rows td { padding-left: 8pt; }
.rows tr.absent td { color: #6b6b6b; font-style: italic; }
.tag { font: 7pt/1 "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace; text-transform: uppercase; letter-spacing: 0.08em; color: #444; border: 0.5pt solid #999; padding: 1pt 3pt; vertical-align: 1pt; }
.notice { margin: 4pt 0 18pt; padding: 8pt 0 0; font-size: 9.5pt; line-height: 1.45; text-align: justify; }
.cert { margin-top: 20pt; padding-top: 10pt; border-top: 0.5pt solid #c8c8c8; break-inside: avoid; }
.cert h2 { text-transform: uppercase; letter-spacing: 0.1em; font-size: 10pt; }
.digest { margin: 8pt 0 0; font-size: 9.5pt; }
.draft {
  position: fixed; top: 40%; left: 0; right: 0; z-index: -1;
  text-align: center; transform: rotate(-28deg);
  font-size: 110pt; font-weight: 700; letter-spacing: 0.18em; color: #000; opacity: 0.07;
}
@media screen {
  html { background: #e9e9e9; }
  body { width: 8.5in; min-height: 11in; margin: 0 auto; padding: 1in 0.85in; box-sizing: border-box; background: #fff; }
}
</style>
</head>
<body>
<header class="head">
<h1>Typed Search Report</h1>
${ctx.place ? `<p class="place">${esc(ctx.place)}</p>` : ""}
<table class="ident">
${identRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("\n")}
</table>
</header>
${sections.join("\n")}
${closing}
</body>
</html>
`;

// ---- pdf ---------------------------------------------------------------------

/*
 * Chromium writes CreationDate/ModDate from the wall clock, and nothing else
 * in its output varies between runs (checked: the trailer carries no /ID).
 * The replacement is the same byte length as the original — "D:", 14 digits,
 * a 7-character offset — so every xref offset in the file stays valid. Any
 * count but two means the writer changed its format; refuse rather than ship
 * a file that is not reproducible.
 */
const pinDates = (pdf, at) => {
  const stamp = `D:${at.toISOString().replace(/\D/g, "").slice(0, 14)}+00'00'`;
  let n = 0;
  const pinned = pdf.toString("latin1").replace(
    /\/(CreationDate|ModDate) \(D:\d{14}[+-]\d{2}'\d{2}'\)/g,
    (_, key) => {
      n++;
      return `/${key} (${stamp})`;
    },
  );
  if (n !== 2) fail(`expected 2 PDF date fields to pin, found ${n}`);
  return Buffer.from(pinned, "latin1");
};

mkdirSync(outDir, { recursive: true });
const pdfPath = join(outDir, `report-v${version}.pdf`);
const jsonPath = join(outDir, `report-v${version}.json`);

const { chromium } = await import(PLAYWRIGHT.href);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    /* The running header and footer are @page margin boxes; Chromium's own
       header/footer templates would add a wall-clock date on top. */
    displayHeaderFooter: false,
  });
  writeFileSync(pdfPath, pinDates(pdf, renderedAt));
  if (preview) {
    await page.setViewportSize({ width: 816, height: 1056 });
    await page.screenshot({ path: join(outDir, "preview.png"), fullPage: true });
  }
} finally {
  await browser.close();
}

/* Digest the file as written, not the buffer — the record describes what is on disk. */
const record = {
  filename: `${slug}-typed-search-report-v${version}.pdf`,
  media_type: "application/pdf",
  bytes: statSync(pdfPath).size,
  sha256: createHash("sha256").update(readFileSync(pdfPath)).digest("hex"),
  href: `/scan/${job}/report-v${version}.pdf`,
  rendered_at: renderedAt.toISOString(),
  shape: "A",
  version,
};
writeFileSync(jsonPath, `${JSON.stringify(record, null, 2)}\n`);
console.error(
  `${pdfPath}  ${printed.length}/${blocks.length} sections · ${rows.length} rows (${absentRows.length} absent, ${pendingRows.length} pending) · ${release === null ? "DRAFT" : `released v${version}`} · ${record.bytes} B · sha256 ${record.sha256}`,
);

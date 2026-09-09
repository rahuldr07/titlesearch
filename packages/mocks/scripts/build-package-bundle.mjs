#!/usr/bin/env node
/*
 * build-package-bundle.mjs — one county search package, three OCR passes,
 * one bundle the mock hydrates an order from.
 *
 *   node build-package-bundle.mjs [<run-dir>] [<out.json>] [--empty] [--render <report-dir>]
 *
 * PUBLIC REPOSITORY. A populated bundle names real people, their addresses
 * and the tax liens entered against them. The committed file is the
 * `--empty` shape — the digest, the slug, the job, the source's size and the
 * engine roster, with every content array empty. A normal run overwrites
 * that file in place with the populated bundle and it stays UNCOMMITTED.
 * Nothing in this script names a party, a parcel, an address, an instrument
 * number, a book/page or a case number: every finder below is written
 * against document KINDS and label VOCABULARY, and every value it emits is
 * read off an OCR block with a page and a box.
 *
 * Precedent: build-real-package.mjs (same raster space, same bbox
 * normalisation, same junk/label heuristics). What is new here:
 *
 *   - Three passes. A (dots-mocr) and B (mineru) are the two readers whose
 *     values are compared; C (unlimited-ocr) supplies page text only and is
 *     never a reading. The review screen recognises a disagreement only as
 *     exactly two readings from two engines, so `readings` is [A, B] or [A].
 *   - The state is DECIDED HERE and served verbatim. A==B on a clean page
 *     and nothing ruinous about the field → auto_confirmed; anything else →
 *     needs_review with the reason named. Judgments never auto-confirm; T1
 *     fields never auto-confirm; nothing read off a degraded page does.
 *   - Absence is typed. A template row the package cannot fill is a field
 *     with a null value and one of the four NA reasons, and NOT_FOUND /
 *     NOT_STATED / PRESENT_UNREADABLE are always surfaced, with the search
 *     that was performed and the page it was performed on.
 *
 * The bbox space is 1000x1000 for all three engines (verified against the
 * page rasters; the same finding as build-real-package.mjs), so a box is
 * bbox/1000 and the sheet draws it as fractions of the raster.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RUN = "/home/rahul/projects/ocr/runs/web_1788415544_a714e1";
const DEFAULT_OUT = join(HERE, "..", "src", "bundles", "final-package-lincoln-mo.json");
const DEFAULT_COMPARISON = "/mnt/c/Users/user/Downloads/final_package_comparison.txt";
const SLUG = "final-package-lincoln-mo";
const TEMPLATE_VERSION = "v4.2";

// ---- argv --------------------------------------------------------------------

const positional = [];
let empty = false;
let renderDir = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--empty") empty = true;
  else if (a === "--render") {
    renderDir = argv[++i];
    if (renderDir === undefined) {
      console.error("--render needs the report directory (the one served as /scan/<job>/)");
      process.exit(2);
    }
  } else if (a.startsWith("--")) {
    console.error(`unknown flag ${a}`);
    process.exit(2);
  } else positional.push(a);
}
/* Pinned so a re-run renders the same bytes; override to re-issue. */
const RENDERED_AT = process.env.TITLEPIPE_RENDERED_AT ?? "2026-09-03T09:30:00Z";
const RUN = resolve(positional[0] ?? DEFAULT_RUN);
const OUT = resolve(positional[1] ?? DEFAULT_OUT);
const COMPARISON = process.env.TITLEPIPE_COMPARISON ?? DEFAULT_COMPARISON;

const fail = (msg) => {
  console.error(`build-package-bundle: ${msg}`);
  process.exit(1);
};

// ---- the run -------------------------------------------------------------------

const job = JSON.parse(readFileSync(join(RUN, "job.json"), "utf8"));
const PAGES = Number(job.pages);
const pdfPath = join(RUN, "source.pdf");
const pdfBytes = statSync(pdfPath).size;
const sha256 = createHash("sha256").update(readFileSync(pdfPath)).digest("hex");
if (typeof job.doc_hash === "string" && job.doc_hash !== sha256) fail(`job.doc_hash ${job.doc_hash} ≠ sha256 of source.pdf ${sha256}`);

const A = "dots-mocr";
const B = "mineru";
const C = "unlimited-ocr";
const ENGINES = [
  { id: A, role: "A" },
  { id: B, role: "B" },
  { id: C, role: "C" },
];
const pad = (n) => String(n).padStart(4, "0");
const blocksPath = (eng, n) => join(RUN, "passes", eng, `page_${pad(n)}.blocks.json`);
const resultPath = (eng, n) => join(RUN, "passes", eng, `page_${pad(n)}.result.json`);

/* The empty shape: the same keys as a populated bundle, every content array
   empty, nothing that names the package's content. This is what gets
   committed; the mock treats `fields.length === 0` as an unknown digest. */
const emptyBundle = () => ({
  sha256,
  slug: SLUG,
  job: String(job.id),
  source: { filename: String(job.name), bytes: pdfBytes, pages: PAGES },
  package: {
    jurisdiction: "lincoln-mo",
    county: "Lincoln",
    state: "MO",
    parcel: "",
    situs: "",
    owner_of_record: "",
    stamp_page: 0,
    stamp_text: "",
    order_ref: "",
    order_ref_page: 0,
  },
  engines: ENGINES.map((e) => ({ ...e, pages_read: PAGES })),
  pages: [],
  instruments: [],
  fields: [],
  composition: { template_version: TEMPLATE_VERSION, blocks: [] },
  report: {
    filename: `${SLUG}-typed-search-report-v1.pdf`,
    media_type: "application/pdf",
    bytes: 0,
    sha256: "",
    href: `/scan/${String(job.id)}/report-v1.pdf`,
    shape: "A",
    version: 1,
  },
  quarantine: { optical: [], resolved_note_title: "", resolved_note_body: "" },
  pipeline: {
    pages_relevant: 0,
    classifier_note: "",
    package_name: String(job.name),
    volume_label: "",
    eta_label: "",
    verified_checks: [],
    run_log: [],
  },
  timeline: [],
});

if (empty) {
  const shape = emptyBundle();
  writeFileSync(OUT, `${JSON.stringify(shape, null, 2)}\n`);
  console.error(`empty shape written to ${OUT} (${statSync(OUT).size} B) — this is the file that gets committed`);
  process.exit(0);
}

// ---- text ----------------------------------------------------------------------

const RASTER = 1000;
const unescapeHtml = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
/*
 * Tags, markdown emphasis and the LaTeX one reader wraps superscripts and
 * primes in are the reader's markup, not the page's text: "\(22^{\text{nd}}\)"
 * is how it rendered the ordinal "22nd", "\(15^{\prime}\)" the minutes mark
 * in "15'". Unwrapping them is the same act as stripping <sup>. A "\(" that
 * is a misread glyph (a dollar sign, say) is left exactly as read.
 */
const stripMarkup = (s) =>
  unescapeHtml(s.replace(/<\/?[a-zA-Z][^>]*>/g, ""))
    .replace(/\*\*/g, "")
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/\\\(\s*(\d+)\s*\^\{\\prime\}\s*\\\)/g, "$1'")
    .replace(/\\\(\s*(\d+)\s*\^\{\\?(?:text|mathrm)?\{?([A-Za-z]{2})\}?\}\s*\\\)/g, "$1$2")
    .replace(/(\d+)\s*\\\(\s*\^\{([A-Za-z]{2})\}\s*\\\)/g, "$1$2");
const cleanLine = (s) => stripMarkup(s).replace(/\s+/g, " ").trim();
const collapse = (s) => s.replace(/\s+/g, " ").trim();
const SEPARATOR_CELL = /^:?-{2,}:?$/;

/*
 * Page chrome. The viewer's furniture — preview banners, "[Non-Text]"
 * placeholders, the reader's own commentary on a blank frame — is not page
 * text and is never a value, a snippet or a page line.
 */
const CHROME = [
  /^\[(?:Non-Text|NO TEXT)\]$/i,
  /^Preview$/i,
  /image quality of this document/i,
  /^The image (?:contains no text|is too blurry)/i,
  /^The Ground Truth image/i,
  /^\\\(.*\\\)\s*$/,
  /^#+$/,
  /^[三中■□▼✓✔ ]+$/,
  /[　-鿿]/,
];
const isChrome = (line) => CHROME.some((re) => re.test(line));

function htmlRows(raw) {
  const rows = [];
  for (const tr of raw.split(/<\/tr>/i)) {
    if (!/<t[dh]/i.test(tr)) continue;
    const cells = [];
    const re = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = re.exec(tr)) !== null) cells.push(cleanLine(m[1]));
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return rows;
}

/*
 * A block is the reader's unit: a box and its text. Tables (HTML from two
 * readers, markdown pipes from the third) become rows of cells; a text block
 * becomes its lines. `segs` keeps the order, `text` is the flattened whole,
 * and a row's cells are what a label or a value is matched against.
 */
function mkBlock(b, idx) {
  if (!Array.isArray(b.bbox) || b.bbox.length !== 4) return null;
  const [x0, y0, x1, y1] = b.bbox.map(Number);
  const x = +(x0 / RASTER).toFixed(4);
  const y = +(y0 / RASTER).toFixed(4);
  const w = +((x1 - x0) / RASTER).toFixed(4);
  const h = +((y1 - y0) / RASTER).toFixed(4);
  if (!(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1)) return null;
  const raw = String(b.text ?? "");
  const segs = [];
  if (/<table/i.test(raw)) {
    for (const row of htmlRows(raw)) segs.push({ text: row.join(" | "), row });
  } else {
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (t.startsWith("|") && t.endsWith("|") && t.length > 2) {
        const cells = t.split("|").slice(1, -1).map(cleanLine);
        if (cells.every((c) => c === "" || SEPARATOR_CELL.test(c))) continue;
        if (cells.some((c) => c.length > 0)) segs.push({ text: cells.join(" | "), row: cells });
      } else {
        const c = cleanLine(t);
        if (c.length > 0) segs.push({ text: c, row: null });
      }
    }
  }
  if (segs.length === 0) return null;
  return {
    i: idx,
    type: String(b.type ?? "text"),
    x,
    y,
    w,
    h,
    segs,
    text: segs.map((s) => s.text).join("\n"),
    hasRows: segs.some((s) => s.row !== null),
  };
}

function loadBlocks(eng, n) {
  const f = blocksPath(eng, n);
  if (!existsSync(f)) return null;
  const raw = JSON.parse(readFileSync(f, "utf8"));
  if (!Array.isArray(raw)) return [];
  return raw.map((b, i) => mkBlock(b, i)).filter((b) => b !== null);
}

function loadResult(eng, n) {
  const f = resultPath(eng, n);
  if (!existsSync(f)) return { flags: [], elapsed_s: null };
  const r = JSON.parse(readFileSync(f, "utf8"));
  return { flags: Array.isArray(r.flags) ? r.flags.map(String) : [], elapsed_s: typeof r.elapsed_s === "number" ? r.elapsed_s : null };
}

/* The cross-engine comparison, where the run wrote one: per-page consensus for
   the pages it lists, and which engine was the outlier there. Null elsewhere. */
function loadComparison() {
  const consensus = new Map();
  const outlier = new Map();
  if (!existsSync(COMPARISON)) return { consensus, outlier };
  for (const line of readFileSync(COMPARISON, "utf8").split("\n")) {
    let m = /^\s*page\s+(\d+)\s+(0?\.\d+|1\.0+)\s*$/.exec(line);
    if (m !== null) consensus.set(Number(m[1]), Number(m[2]));
    m = /^\s*(\d+)\s+(0?\.\d+|1\.0+)\s+([a-z0-9-]+)\s+\d+\/\s*\d+\/\s*\d+/.exec(line);
    if (m !== null) {
      consensus.set(Number(m[1]), Number(m[2]));
      outlier.set(Number(m[1]), m[3]);
    }
  }
  return { consensus, outlier };
}
const comparison = loadComparison();

// ---- pages -----------------------------------------------------------------------

const DEGRADED_BANNER = /image quality of this document may be degraded/i;
const CONSENSUS_FLOOR = 0.7;

const pages = new Map();
const pagesRead = new Map(ENGINES.map((e) => [e.id, 0]));
for (let n = 1; n <= PAGES; n++) {
  const blocks = {};
  const flags = {};
  const elapsed = {};
  let banner = false;
  for (const { id } of ENGINES) {
    const loaded = loadBlocks(id, n);
    if (loaded !== null) pagesRead.set(id, pagesRead.get(id) + 1);
    blocks[id] = loaded ?? [];
    const r = loadResult(id, n);
    flags[id] = r.flags;
    elapsed[id] = r.elapsed_s;
    if (blocks[id].some((b) => DEGRADED_BANNER.test(b.text))) banner = true;
  }
  const consensus = comparison.consensus.get(n) ?? null;
  const anyFlag = ENGINES.some((e) => flags[e.id].length > 0);
  const degraded = banner || anyFlag || (consensus !== null && consensus < CONSENSUS_FLOOR);
  const reasons = [];
  if (banner) reasons.push("degraded-for-preview banner");
  for (const e of ENGINES) if (flags[e.id].length > 0) reasons.push(`${e.id} ${flags[e.id].join("+")}`);
  if (consensus !== null && consensus < CONSENSUS_FLOOR) reasons.push(`consensus ${consensus.toFixed(2)}`);
  pages.set(n, { n, blocks, flags, elapsed, banner, consensus, outlier: comparison.outlier.get(n) ?? null, degraded, reasons });
}
const page = (n) => pages.get(n);
const pageRange = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* One engine's page as one string, with each block's offsets — a regex that
   crosses a block boundary (a name printed over two lines, a value split from
   its label) still maps back to the blocks it spanned. */
const pageTextMemo = new Map();
function pageText(n, eng) {
  const key = `${n}:${eng}`;
  const memo = pageTextMemo.get(key);
  if (memo !== undefined) return memo;
  let text = "";
  const spans = [];
  for (const b of page(n).blocks[eng]) {
    if (text.length > 0) text += "\n";
    const start = text.length;
    text += b.text;
    spans.push({ b, start, end: text.length });
  }
  const out = { text, spans };
  pageTextMemo.set(key, out);
  return out;
}

const joinedText = (n) => ENGINES.map((e) => pageText(n, e.id).text).join("\n");

// ---- partition ----------------------------------------------------------------------

/*
 * The run's `sections` are empty, so the partition is derived here from what
 * each page says about itself: a recorded instrument carries the recorder's
 * instrument number (ten digits) or its book/page at the head of every page;
 * a court record names its case in the header; the printouts name their
 * source. Consecutive pages with the same reference are one instrument; a
 * page with no reference of its own continues the instrument before it.
 */
const HEAD_Y = 0.2;
const INSTRUMENT_NO = /\b(\d{10})\b/;
const BOOK_PAGE_HEAD = /Book:?\s*(\d+)\s*\n?\s*Page:?\s*(\d+)/;
const DEED_TYPE = /^((?:GENERAL |SPECIAL |CORPORATE )?WARRANTY DEED|QUIT ?CLAIM DEED|TRUSTEE'?S DEED|BENEFICIARY DEED|GIFT DEED)$/i;

function headText(n) {
  const lines = [];
  for (const e of ENGINES) for (const b of page(n).blocks[e.id]) if (b.y < HEAD_Y) lines.push(b.text);
  return lines.join("\n");
}

const bookPageToInst = new Map();
function classify(n) {
  const all = joinedText(n);
  let m;
  if ((m = /Case\.net:?\s*(\S+)\s*-/.exec(all)) !== null) return { kind: "case_record", ref: m[1] };
  if (/Judgment Index Result/i.test(all)) return { kind: "judgment_index", ref: null };
  if (/Name Search Result/i.test(all) || /Displaying records returned for parties/i.test(all)) return { kind: "court_name_search", ref: null };
  if (/\bUCC\b/.test(all) && /Secretary of State/i.test(all)) return { kind: "ucc_search", ref: null };
  if (/Cadastral Map/i.test(all)) return { kind: "plat", ref: null };
  if (/Recorder of Deeds/i.test(all) && /Search (?:Results|Criteria)/i.test(all)) return { kind: "recorder_name_search", ref: null };
  if (/County Collector/i.test(all) || /TAX RECEIPT/i.test(all)) return { kind: "tax_receipt", ref: null };
  if (/County Assessor/i.test(all) || /Tentative \d{4} Values/i.test(all)) return { kind: "assessor_card", ref: null };
  const head = headText(n);
  const inst = INSTRUMENT_NO.exec(head)?.[1] ?? INSTRUMENT_NO.exec(all.match(/Instr\s*#:?\s*\d+/)?.[0] ?? "")?.[1] ?? null;
  const bp = BOOK_PAGE_HEAD.exec(head);
  const bpKey = bp === null ? null : `${bp[1]}/${bp[2]}`;
  if (inst !== null && bpKey !== null) bookPageToInst.set(bpKey, inst);
  const ref = inst ?? (bpKey === null ? null : (bookPageToInst.get(bpKey) ?? bpKey));
  const kind = /DEED OF TRUST/i.test(all)
    ? "security_deed"
    : /WARRANTY DEED|QUIT ?CLAIM DEED|TRUSTEE'?S DEED|BENEFICIARY DEED|\bType:\s*(?:WD|QC|GWD)\b/i.test(all)
      ? "deed"
      : null;
  return { kind, ref };
}

const runs = [];
for (let n = 1; n <= PAGES; n++) {
  const c = classify(n);
  const cur = runs[runs.length - 1];
  const continues =
    cur !== undefined &&
    ((c.ref === null && c.kind === null) ||
      (c.ref !== null && c.ref === cur.ref) ||
      (c.ref === null && c.kind !== null && c.kind === cur.kind && cur.ref === null));
  if (continues) {
    cur.last_page = n;
    if (cur.kind === null) cur.kind = c.kind;
    continue;
  }
  runs.push({ kind: c.kind, ref: c.ref, first_page: n, last_page: n });
}
for (const r of runs) if (r.kind === null) fail(`pages ${r.first_page}-${r.last_page} could not be classified`);

/* The shape this package is known to have — kinds only, no identifiers. A
   different partition is a different package, or a broken classifier. */
const EXPECTED_KINDS = [
  "assessor_card",
  "deed",
  "deed",
  "tax_receipt",
  "security_deed",
  "security_deed",
  "case_record",
  "case_record",
  "plat",
  "recorder_name_search",
  "court_name_search",
  "judgment_index",
  "ucc_search",
];
const derivedKinds = runs.map((r) => r.kind);
if (JSON.stringify(derivedKinds) !== JSON.stringify(EXPECTED_KINDS)) {
  console.error("derived partition:");
  for (const r of runs) console.error(`  p${r.first_page}-p${r.last_page}  ${r.kind}  ${r.ref ?? ""}`);
  fail("the derived partition does not match the package's known shape");
}

// ---- finders ----------------------------------------------------------------------------

const box = (blocks) => {
  const x = Math.min(...blocks.map((b) => b.x));
  const y = Math.min(...blocks.map((b) => b.y));
  const x1 = Math.max(...blocks.map((b) => b.x + b.w));
  const y1 = Math.max(...blocks.map((b) => b.y + b.h));
  return { x: +x.toFixed(4), y: +y.toFixed(4), w: +(x1 - x).toFixed(4), h: +(y1 - y).toFixed(4) };
};
const hit = (n, blocks, value, snippet) => ({ n, blocks, value: collapse(value), snippet });

/*
 * The excerpt, split at the reader's own line. `SourceExcerpt` requires
 * `pre + hit + post` to equal the snippet character for character, and the
 * contract forbids the BROWSER splitting it — indexOf lands on the wrong
 * occurrence when a word repeats. This is the server side, which is where the
 * split belongs, and it refuses rather than guesses on exactly that case:
 *
 *   - the value must appear in the reader's own snippet, verbatim;
 *   - it must appear ONCE. Two occurrences and there is no fact about which
 *     one the reader matched, so no excerpt is emitted and the field falls
 *     back to the flat `source_snippet` it already carries. Absent is a
 *     legal state for `source_excerpt`; a wrong highlight is not.
 */
function excerptOf(docId, page, value, snippet) {
  if (typeof value !== "string" || value === "" || typeof snippet !== "string") return null;
  const at = snippet.indexOf(value);
  if (at < 0) return null;
  if (snippet.indexOf(value, at + 1) >= 0) return null;
  return {
    doc_id: docId,
    page,
    pre: snippet.slice(0, at),
    hit: value,
    post: snippet.slice(at + value.length),
    // The rulebook's remark is authored, never composed here: this generator
    // reads a county package, it does not hold opinions about instruments.
    note: null,
  };
}

const withIndices = (re) => new RegExp(re.source, re.flags.includes("d") ? re.flags : `${re.flags}d`);

/** A line or a table cell matching `re`; the value is group 1 or the match. */
function findLine(n, eng, re) {
  for (const b of page(n).blocks[eng]) {
    for (const s of b.segs) {
      for (const unit of s.row ?? [s.text]) {
        if (isChrome(unit)) continue;
        const m = re.exec(unit);
        if (m !== null) return hit(n, [b], m[1] ?? m[0], s.row === null ? b.text : s.text);
      }
    }
  }
  return null;
}

/** `re` run over the engine's whole page, the value mapped back to the blocks it lies in. */
function findSpan(n, eng, re) {
  const { text, spans } = pageText(n, eng);
  const m = withIndices(re).exec(text);
  if (m === null) return null;
  const [s, e] = m.indices[1] ?? m.indices[0];
  const blocks = spans.filter((sp) => sp.end > s && sp.start < e).map((sp) => sp.b);
  if (blocks.length === 0) return null;
  return hit(n, blocks, m[1] ?? m[0], blocks.map((b) => b.text).join("\n"));
}

/** A line at the head of the page (the recorder's stamp region). */
function findHead(n, eng, re) {
  for (const b of page(n).blocks[eng]) {
    if (b.y >= HEAD_Y) continue;
    for (const s of b.segs) {
      const m = re.exec(s.text);
      if (m !== null) return hit(n, [b], m[1] ?? m[0], b.text);
    }
  }
  return null;
}

const vOverlap = (a, b) => Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
const hOverlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
const labelLike = (b) => /:$/.test(b.segs[b.segs.length - 1].text);

function rightOf(blocks, b) {
  return blocks
    .filter((o) => o !== b && o.x >= b.x + b.w - 0.02 && vOverlap(o, b) >= 0.4 * Math.min(o.h, b.h))
    .sort((p, q) => p.x - q.x || Math.abs(p.y + p.h / 2 - (b.y + b.h / 2)) - Math.abs(q.y + q.h / 2 - (b.y + b.h / 2)));
}
function below(blocks, b) {
  return blocks
    .filter((o) => o !== b && o.y >= b.y + b.h - 0.005 && o.y - (b.y + b.h) <= 2.5 * b.h && hOverlap(o, b) > 0)
    .sort((p, q) => p.y - q.y);
}

/*
 * Label → value, the way the page lays it out: the remainder of the label's
 * own line or cell; the next cell of its row; a multi-line label column
 * mapped line-for-line onto the column to its right; the nearest block to the
 * right on the same line; else the block beneath. With `run`, the value keeps
 * collecting the blocks beneath until the next label. `line` picks one line
 * of that value, `re`/`group` a substring of it.
 */
function findKv(n, eng, labelRe, opts = {}) {
  const blocks = page(n).blocks[eng];
  const finish = (bs, lines, snippet) => {
    let value = opts.line === undefined ? lines.join("\n") : (lines[opts.line] ?? null);
    if (value === null) return null;
    if (opts.re !== undefined) {
      const m = opts.re.exec(value);
      if (m === null) return null;
      value = m[opts.group ?? 1] ?? m[0];
    }
    return hit(n, bs, value, snippet);
  };
  for (const b of blocks) {
    for (let si = 0; si < b.segs.length; si++) {
      const s = b.segs[si];
      if (s.row !== null) {
        for (let ci = 0; ci < s.row.length; ci++) {
          if (!labelRe.test(s.row[ci])) continue;
          const rem = s.row[ci].replace(labelRe, "").replace(/^[:\s]+/, "").trim();
          if (rem.length > 0) return finish([b], [rem], s.text);
          const next = s.row.slice(ci + 1).find((c) => c.length > 0);
          if (next !== undefined) return finish([b], [next], s.text);
          for (let sj = si + 1; sj < b.segs.length; sj++) {
            const c = (b.segs[sj].row ?? [b.segs[sj].text]).find((u) => u.length > 0);
            if (c !== undefined) return finish([b], [c], b.segs[sj].text);
          }
          return null;
        }
        continue;
      }
      if (!labelRe.test(s.text)) continue;
      const rem = s.text.replace(labelRe, "").replace(/^[:\s]+/, "").trim();
      if (rem.length > 0) return finish([b], [rem], b.text);
      const right = rightOf(blocks, b);
      if (b.segs.length > 1) {
        const nb = right[0];
        if (nb !== undefined && nb.segs[si] !== undefined) return finish([nb], [nb.segs[si].text], nb.text);
        return null;
      }
      let first = right[0] ?? below(blocks, b)[0];
      if (first === undefined) return null;
      const bs = [first];
      if (opts.run === true) {
        let prev = first;
        for (const o of blocks) {
          if (o.i <= prev.i) continue;
          if (labelLike(o)) break;
          if (o.y >= prev.y + prev.h - 0.005 && o.y - (prev.y + prev.h) <= 2.5 * prev.h && hOverlap(o, prev) > 0) {
            bs.push(o);
            prev = o;
          } else break;
        }
      }
      return finish(
        bs,
        bs.flatMap((o) => o.segs.map((x) => x.text)),
        bs.map((o) => o.text).join("\n"),
      );
    }
  }
  return null;
}

/** A table cell by row and column header — the header row is the table's first. */
function findCol(n, eng, rowRe, colRe) {
  for (const b of page(n).blocks[eng]) {
    if (!b.hasRows) continue;
    const rows = b.segs.filter((s) => s.row !== null);
    const header = rows[0]?.row ?? [];
    const ci = colRe === "last" ? -1 : header.findIndex((c) => colRe.test(c));
    if (colRe !== "last" && ci < 0) continue;
    for (const s of rows.slice(1)) {
      if (!s.row.some((c) => rowRe.test(c))) continue;
      const cell = ci === -1 ? [...s.row].reverse().find((c) => c.length > 0) : s.row[ci];
      if (cell === undefined || cell.length === 0) continue;
      return hit(n, [b], cell, s.text);
    }
  }
  return null;
}

/** The first cell matching `cellRe` in the first data row of the table whose header matches `headerRe`. */
function findRowCell(n, eng, headerRe, cellRe) {
  for (const b of page(n).blocks[eng]) {
    if (!b.hasRows) continue;
    const rows = b.segs.filter((s) => s.row !== null);
    const hi = rows.findIndex((s) => s.row.some((c) => headerRe.test(c)));
    if (hi < 0) continue;
    for (const s of rows.slice(hi + 1)) {
      for (const c of s.row) {
        const m = cellRe.exec(c);
        if (m !== null) return hit(n, [b], m[1] ?? m[0], s.text);
      }
    }
  }
  return null;
}

function runFinder(alt, n, eng, ctx) {
  const re = typeof alt.re === "function" ? alt.re(ctx) : alt.re;
  switch (alt.kind) {
    case "line":
      return findLine(n, eng, re);
    case "span":
      return findSpan(n, eng, re);
    case "head":
      return findHead(n, eng, re);
    case "kv":
      return findKv(n, eng, re, alt.opts ?? {});
    case "col":
      return findCol(n, eng, re, alt.col);
    case "rowcell":
      return findRowCell(n, eng, re, alt.cell);
    default:
      return fail(`unknown finder ${alt.kind}`);
  }
}

const L = (re) => ({ kind: "line", re });
const S = (re) => ({ kind: "span", re });
const HEAD = (re) => ({ kind: "head", re });
const KV = (re, opts) => ({ kind: "kv", re, opts });
const COL = (re, col) => ({ kind: "col", re, col });
const ROWCELL = (re, cell) => ({ kind: "rowcell", re, cell });

const pageHas = (n, re) => re.test(joinedText(n));
/* An alternative confined to the instrument's cover page: a recorded
   instrument states its date, its stamp and its book/page on page one, and a
   bare date on a later page is a notary's commission, not the instrument's. */
const cover = (alt, run) => ({ ...alt, pages: [run.first_page] });

/*
 * Locate one datum for both readers. Alternatives are tried in order and
 * pages in order; the first (alternative, page) that BOTH readers return wins,
 * because a two-reader match is worth more than an earlier one-reader match.
 * Failing that, the first one-reader match. `post` narrows the value with a
 * structural regex (the party before the vesting phrase, say) — the snippet
 * stays the whole block.
 */
function locate(spec, ctx) {
  let fallback = null;
  for (const alt of spec.alts) {
    for (const n of alt.pages ?? spec.pages) {
      if (alt.page !== undefined && !pageHas(n, alt.page)) continue;
      const a = runFinder(alt, n, A, ctx);
      const b = runFinder(alt, n, B, ctx);
      if (a !== null && b !== null) return post(spec, { n, a, b });
      if ((a !== null || b !== null) && fallback === null) fallback = { n, a, b };
    }
  }
  return fallback === null ? null : post(spec, fallback);
}
function post(spec, located) {
  if (spec.post === undefined) return located;
  const narrow = (h) => {
    if (h === null) return null;
    const m = spec.post.exec(h.value);
    return m === null ? h : { ...h, value: collapse(m[1] ?? m[0]) };
  };
  return { ...located, a: narrow(located.a), b: narrow(located.b) };
}

// ---- canonical comparison -----------------------------------------------------------------

/*
 * Uppercase, whitespace collapsed, punctuation stripped; O/0 and I/1 unified
 * ONLY where the string is digits (an instrument number read with an O is
 * the same number; a surname read with an I instead of a Y is a different
 * name). A difference that survives this is a real disagreement.
 */
function canon(s) {
  let t = s
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = t.replace(/\s/g, "");
  if (/^[0-9OIL]+$/.test(compact) && /\d/.test(compact)) t = t.replace(/O/g, "0").replace(/[IL]/g, "1");
  return t;
}

// ---- vocabulary --------------------------------------------------------------------------

/* The three T1 refs data.ts already names, plus the two the brief adds for
   this package: T1 is read off the "T1-" prefix. */
const T1_LENDER = "T1-lien-holder-identity";
const T1_PRINCIPAL = "T1-secured-principal";
const T1_JUDGMENT_PARTY = "T1-judgment-party-identity";
const T1_VESTED_OWNER = "T1-vested-owner-identity";
const T1_LEGAL = "T1-legal-description";
const T1_CONSEQUENCE = {
  [T1_LENDER]: "Naming the wrong holder of an open security deed sends the payoff to a stranger and leaves the real lien of record.",
  [T1_PRINCIPAL]: "An understated secured principal understates the payoff, and the shortfall survives closing as a lien against the parcel.",
  [T1_JUDGMENT_PARTY]: null,
  [T1_VESTED_OWNER]: "The wrong vested owner insures a stranger's interest.",
  [T1_LEGAL]: "A truncated legal description describes a parcel that does not exist.",
};

const STAMP_DATE = /(\d{2}\/\d{2}\/\d{4}) \d{1,2}:\d{2}\s?[AP]M Fees/;
const STAMP_BOOK_PAGES = /(Book \d+ Page\(s\):\s*\d+\s*-\s*\d+)/;
const LONG_DATE = /^([A-Z][a-z]+ \d{1,2}, \d{4})$/;
const BODY_DATE = /(?:made|entered into)(?: and entered into)? on the (\d{1,2}\s*\S{0,12}?\s*day of [A-Z][a-z]+,? \d{4})/;
const MONEY = /\$\s?[\d,]+\.\d{2}/;
const CONS_CLAUSE = /in consideration of the sum of (.+?)(?=,\s*(?:the )?receipt|,\s*to (?:them|him|her|it) (?:in hand )?paid|\.\s)/is;
const VESTING_PHRASE =
  /,\s*((?:his wife|her husband|husband and wife|wife and husband|a single (?:person|man|woman)|a married (?:man|woman|person)|an unmarried (?:man|woman|person)|a widow(?:er)?|as joint tenants\b.*|as tenants (?:in common|by the entirety)\b.*|(?:as )?(?:Co-)?Trustees?,? (?:of|under) .+))\.?$/i;
const NAME_BEFORE_VESTING =
  /^(.+?),\s*(?:his wife|her husband|husband and wife|wife and husband|a single (?:person|man|woman)|a married (?:man|woman|person)|an unmarried (?:man|woman|person)|a widow(?:er)?|as joint tenants\b|as tenants (?:in common|by the entirety)\b|(?:as )?(?:Co-)?Trustees?,? (?:of|under)\b)/i;
const LEGAL_OPENING = /^((?:BEGINNING|Beginning) (?:AT|at) .{150,})$/;

// ---- the specs --------------------------------------------------------------------------------

const DOC_ID = `doc_${SLUG}`;
const ORDER_ID = `ord_${SLUG}`;
const fieldId = (path) => `fld_${path.replace(/\./g, "_")}`;

const byKind = (kind) => runs.filter((r) => r.kind === kind);
const assessor = byKind("assessor_card")[0];
const taxReceipt = byKind("tax_receipt")[0];
const dots = byKind("security_deed");
const cases = byKind("case_record");
const recorderSearch = byKind("recorder_name_search")[0];
const courtSearch = byKind("court_name_search")[0];
const judgmentIndex = byKind("judgment_index")[0];
const uccSearch = byKind("ucc_search")[0];
const plat = byKind("plat")[0];
const rangeOf = (r) => pageRange(r.first_page, r.last_page);

/* Which deed vests: the one recorded last. Read off each deed's own stamp
   before any path is named. */
const RECORDED_ALTS = [L(/Recording Date\/Time:\s*(\d{2}\/\d{2}\/\d{4})/), S(STAMP_DATE)];
const mdy = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m === null ? null : `${m[3]}${m[1]}${m[2]}`;
};
const deedsByRecency = byKind("deed")
  .map((r) => {
    const found = locate({ alts: RECORDED_ALTS, pages: rangeOf(r) }, {});
    const v = found?.a?.value ?? found?.b?.value ?? null;
    return { run: r, recorded: v === null ? null : mdy(v) };
  })
  .sort((p, q) => (q.recorded ?? "").localeCompare(p.recorded ?? ""));
const vestingDeed = deedsByRecency[0].run;
const priorDeeds = deedsByRecency.slice(1).map((d) => d.run);

const specs = [];
const F = (path, row, label, pages, alts, extra = {}) => {
  specs.push({ path, section: path.split(".")[0], row, label, pages, alts, rules: [], ...extra });
};

/* Header */
F("header.order_number", "ORDER #", "Order number", pageRange(1, PAGES), [L(/\bOrder No\.?:?\s*(\d{5,})\b/)], {
  asking: "Confirm the order number printed on the package.",
});
F("header.search_date", "SEARCH DATE", "Search date", rangeOf(courtSearch), [L(/parties with a name of .* on (\d{2}\/\d{2}\/\d{4})\.?$/)]);

/* Location — the assessor card */
F("location.location", "LOCATION", "Situs address", rangeOf(assessor), [KV(/^Property Address:$/, { run: true, line: 0 })]);
F("location.city", "CITY/TWP/BORO", "City", rangeOf(assessor), [
  KV(/^Property Address:$/, { run: true, line: 1, re: /^(.+?), ([A-Z]{2}) (\d{5}(?:-\d{4})?)\b/, group: 1 }),
]);
F("location.county", "COUNTY/PARISH", "County", rangeOf(vestingDeed).concat(rangeOf(assessor)), [
  S(/Recorded [Ii]n ([A-Z][a-z]+ County), [A-Z][a-z]+/),
  L(/^([A-Za-z]+ County) Assessor$/i),
], { rules: ["R21-recording-county"] });
F("location.zip", "ZIP CODE", "ZIP", rangeOf(assessor), [
  KV(/^Property Address:$/, { run: true, line: 1, re: /^(.+?), ([A-Z]{2}) (\d{5}(?:-\d{4})?)\b/, group: 3 }),
], { consequence: "A wrong ZIP on the tax card indexes the policy against a parcel this report does not describe." });

/* Assessment — the card's values table: the FULL MARKET rows come first and are
   what the appraised→FMV→assessed→taxable priority reads. */
F("assessment.tax_id", "TAX ID#", "Tax ID (assessor parcel)", rangeOf(assessor), [KV(/^Parcel Number:$/)]);
F("assessment.land", "LAND", "Land", rangeOf(assessor), [COL(/^Land$/, /^Total$/)]);
F("assessment.building", "BUILDING", "Building", rangeOf(assessor), [COL(/^Building$/, /^Total$/)]);
/* v99 stays empty: land + building is never checked against total. */
F("assessment.total", "TOTAL", "Total", rangeOf(assessor), [COL(/^Total$/, /^Total$/)], { rules: ["v99-mixed-valuation-bases"] });

/* Current tax — the collector's receipt */
F("tax.tax_id", "TAX ID", "Tax ID (collector parcel)", rangeOf(taxReceipt), [L(/^PARCEL\s+(\d{10,})$/)]);
F("tax.tax_type", "TAX TYPE", "Tax type", rangeOf(taxReceipt), [L(/\b\d{4} (REAL ESTATE|PERSONAL PROPERTY)\b/)]);
F("tax.year", "YEAR", "Tax year", rangeOf(taxReceipt), [L(/\b(\d{4}) (?:REAL ESTATE|PERSONAL PROPERTY)\b/)]);
F("tax.open", "OPEN", "Open (amount due)", rangeOf(taxReceipt), [
  COL((ctx) => new RegExp(`^${ctx.value("tax.year") ?? "\\d{4}"}$`), /^Due$/),
  KV(/^TOTAL DUE\b/),
]);
F("tax.paid", "PAID", "Paid", rangeOf(taxReceipt), [L(/\b(PAID) TAX RECEIPT\b/)]);
F("tax.delinq", "DELINQ", "Delinquent (interest / penalty)", rangeOf(taxReceipt), [KV(/^INTEREST\/PENALTY\b/)]);
F("tax.amount", "AMOUNT", "Amount", rangeOf(taxReceipt), [ROWCELL(/^DATE PAID\b/, /^\$[\d,]+\.\d{2}$/)]);
F("tax.paid_date", "PAID", "Paid date", rangeOf(taxReceipt), [ROWCELL(/^DATE PAID\b/, /^(\d{1,2}\/\d{1,2}\/\d{4})\b/)]);

/* Deeds — the vesting deed and each prior deed share one vocabulary. */
function deedFields(prefix, run, isVesting) {
  const pg = rangeOf(run);
  const t1 = isVesting ? { rules: [T1_VESTED_OWNER] } : {};
  F(`${prefix}.deed_type`, "DEED TYPE", "Deed type", pg, [KV(/^Title of Document:$/), L(DEED_TYPE)]);
  F(`${prefix}.grantor`, "GRANTOR", "Grantor", pg, [
    KV(/^Grantors?:$/),
    S(/by and between\s*\n([^\n]+)\n[^\n]*\bGrantors?,? and\b/),
  ], { ...t1, post: NAME_BEFORE_VESTING, asking: "Confirm the grantor as the deed names them." });
  F(`${prefix}.grantor_vesting`, "GRANTOR VESTING", "Grantor vesting", pg, [
    KV(/^Grantors?:$/),
    S(/by and between\s*\n([^\n]+)\n[^\n]*\bGrantors?,? and\b/),
  ], { post: VESTING_PHRASE, vestingOf: `${prefix}.grantor` });
  F(`${prefix}.grantee`, "GRANTEE", "Grantee", pg, [
    KV(/^Grantees?:$/),
    S(/\bGrantors?,? and\s*\n([^\n]+)\n[^\n]*\bGrantees?\b/),
  ], { ...t1, post: NAME_BEFORE_VESTING, asking: "Confirm the grantee as the deed names them." });
  F(`${prefix}.grantee_vesting`, "GRANTEE VESTING", "Grantee vesting", pg, [
    KV(/^Grantees?:$/),
    S(/\bGrantors?,? and\s*\n([^\n]+)\n[^\n]*\bGrantees?\b/),
  ], { post: VESTING_PHRASE, vestingOf: `${prefix}.grantee` });
  F(`${prefix}.dated`, "DATED", "Dated", pg, [KV(/^Date of Document:$/), L(LONG_DATE), S(BODY_DATE)].map((a) => cover(a, run)));
  F(`${prefix}.recorded`, "RECORDED", "Recorded", pg, RECORDED_ALTS.map((a) => cover(a, run)));
  F(`${prefix}.book_page`, "BOOK/PAGE", "Book / page", pg, [S(/(Book:?\s*\d+\s*\n?\s*Page:?\s*\d+)/), S(STAMP_BOOK_PAGES)].map((a) => cover(a, run)));
  F(`${prefix}.inst`, "INST#", "Instrument no.", pg, [L(/Instr\s*#:?\s*(\d+)/), HEAD(INSTRUMENT_NO)]);
  F(`${prefix}.cons`, "CONS", "Consideration", pg, [S(CONS_CLAUSE)], { rules: ["R3-cons-never-from-transfer-tax"] });
}
deedFields("vesting", vestingDeed, true);
priorDeeds.forEach((r, i) => deedFields(`prior_deed.${i + 1}`, r, false));

/* Deeds of trust */
function dotFields(prefix, run) {
  const pg = rangeOf(run);
  F(`${prefix}.mortgagor`, "MORTGAGOR", "Mortgagor", pg, [
    L(/^GRANTOR:\s*(.+)$/),
    L(/^The grantor is (.+?)\.?$/),
    L(/Grantor\/Borrower Names?:\s*(.+)$/),
  ], { asking: "Which spelling of the mortgagor's name does the instrument carry?" });
  F(`${prefix}.non_person_name`, "NON-PERSON NAME", "Non-person name (judgment search key)", pg, [L(/Grantor\/Borrower Names?:\s*(.+)$/)]);
  F(`${prefix}.mortgagee`, "MORTGAGEE", "Mortgagee / lender", pg, [
    L(/^LENDER\/GRANTEE:\s*(.+)$/),
    S(/679-MERS\.\s*([^\n]+)/),
    L(/Grantee\/Lender Name and Address:\s*(.+)$/),
  ], { rules: [T1_LENDER], asking: "Is this the lender of record on the security instrument?" });
  F(`${prefix}.beneficiary_nominee`, "MORTGAGEE", "Beneficiary (nominee)", pg, [L(/(Mortgage Electronic Registration Systems, Inc\.)/)], {
    optional: true,
    rules: [T1_LENDER],
  });
  F(`${prefix}.trustee`, "TRUSTEE", "Trustee", pg, [L(/^TRUSTEE:\s*(.+)$/), S(/\n([A-Z][A-Z0-9 .,&'-]{3,})\n[^\n]*The trustee is/)]);
  F(`${prefix}.trustee_address`, "TRUSTEE ADDRESS", "Trustee address", pg, [
    S(/^TRUSTEE:[^\n]*\n(?:[^\n\d][^\n]*\n)?(\d+[^\n]+\n[^\n]*\b[A-Z]{2} \d{5}(?:-\d{4})?)/m),
  ]);
  F(`${prefix}.dated`, "DATED", "Dated", pg, [
    L(/\(Security Instrument\) is ([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})/),
    L(/is made on ([A-Z][a-z]+ \d{1,2}, \d{4})/),
    L(/Date of Document:\s*([^\n]+)/),
  ]);
  F(`${prefix}.recorded`, "RECORDED", "Recorded", pg, [cover(S(STAMP_DATE), run)]);
  F(`${prefix}.book_page`, "BOOK/PAGE", "Book / page", pg, [cover(S(STAMP_BOOK_PAGES), run)]);
  F(`${prefix}.amount`, "AMOUNT", "Amount (secured principal)", pg, [
    S(/principal sum of [^\n]*?\n?[^\n]*?\(U\.S\.\s*(\$\s?[\d,]+\.\d{2})/),
    S(/shall not exceed (\$\s?[\d,]+\.\d{2})/),
  ], { rules: [T1_PRINCIPAL], asking: "Confirm the original principal amount of the security instrument." });
  F(`${prefix}.open_ended`, "OPEN ENDED – YES/NO", "Open-ended", pg, [
    L(/(\(With Future Advance Clause\))/),
    L(/(HOME EQUITY LINE OF CREDIT)/),
    L(/(OPEN-?END(?:ED)? (?:MORTGAGE|DEED))/),
  ], { rules: ["golden-rule-14-open-end-heloc"] });
  F(`${prefix}.min`, "MIN", "MERS MIN", pg, [L(/\bMIN:?\s*(\d{18})\b/)]);
  F(`${prefix}.inst`, "INST#", "Instrument no.", pg, [HEAD(INSTRUMENT_NO)]);
  F(`${prefix}.legal_description`, "LEGAL DESCRIPTION", "Legal description (exhibit)", pg, [
    S(/EXHIBIT ["'“”]?A["'“”]?\s*\n(?:[^\n]*(?:SITUATED|situated)[^\n]*\n)?((?:BEGINNING|Beginning|ALL THAT|All that|LOT|Lot)\b[^\n]{100,})/),
    L(LEGAL_OPENING),
  ], { rules: [T1_LEGAL], asking: "Confirm the legal description the security instrument attaches." });
}
dots.forEach((r, i) => dotFields(`deed_of_trust.${i + 1}`, r));

/* Judgments — Case.net records: a header page, a party page, a docket, and
   (sometimes) a judgment page. Every field routes to the examiner. */
const CASE_HEADER = /Case Header/;
const CASE_PARTY = /Party Information/;
const CASE_DOCKET = /Docket Entries/;
const CASE_JUDGMENT = /Judgment Information/;
const on = (alt, re) => ({ ...alt, page: re });
function caseFields(prefix, run) {
  const pg = rangeOf(run);
  F(`${prefix}.case_no`, "CASE NO", "Case no.", pg, [L(/Case\.net:?\s*(\S+)\s*-/)]);
  F(`${prefix}.type`, "TYPE", "Type", pg, [on(KV(/^Case Type$/), CASE_HEADER)]);
  F(`${prefix}.plaintiff`, "PLAINTIFF", "Plaintiff / petitioner", pg, [on(L(/^(.+?)\s*-\s*(?:Petitioner|Plaintiff)$/), CASE_PARTY)], {
    rules: [T1_JUDGMENT_PARTY],
  });
  F(`${prefix}.defendant`, "DEFENDANT", "Defendant / respondent", pg, [on(L(/^(.+?)\s*-\s*(?:Respondent|Defendant)$/), CASE_PARTY)], {
    rules: [T1_JUDGMENT_PARTY, "R13-judgment-enforceability"],
    asking: "Is the respondent the subject owner — corroborated by address, middle name or suffix, not the surname alone?",
  });
  F(`${prefix}.defendant_address`, "COMMENT", "Respondent address on file", pg, [on(S(/-\s*(?:Respondent|Defendant)\s*\n\s*Address:\s*([^\n]+)/), CASE_PARTY)], {
    rules: ["R13-judgment-enforceability"],
  });
  F(`${prefix}.filed`, "FILED", "Filed", pg, [on(KV(/^Date Filed$/), CASE_HEADER)]);
  F(`${prefix}.recorded`, "RECORDED", "Disposition / judgment date", pg, [on(KV(/^Date of Disposition$/), CASE_HEADER), on(KV(/^Date$/), CASE_JUDGMENT)]);
  F(`${prefix}.plaintiff_attorney`, "PLAINTIFF ATTORNEY", "Plaintiff attorney", pg, [on(L(/^(.+?)\s*-\s*Attorney for (?:Petitioner|Plaintiff)$/), CASE_PARTY)], {
    consequence: "The attorney of record is who a satisfaction is demanded from; the wrong firm means the demand reaches nobody.",
  });
  F(`${prefix}.phone`, "PHONE#", "Phone", pg, [L(/(?:Phone|Tel)\.?:?\s*(\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4})/)]);
  F(`${prefix}.address`, "ADDRESS", "Plaintiff address", pg, [on(L(/^Address:\s*(.+)$/), CASE_PARTY)]);
  F(`${prefix}.amount`, "AMOUNT", "Amount (as entered)", pg, [
    on(L(/AGAINST (?:RESPONDENT|DEFENDANT)\s*-\s*(\$[\d,]+\.\d{2})/), CASE_DOCKET),
    on(L(/(\$[\d,]+\.\d{2}(?: PLUS INTEREST)?)/), CASE_JUDGMENT),
  ], { rules: ["R18-judgment-original-amount"], asking: "Confirm the amount as the court entered it — original amount, never a computed balance." });
  F(`${prefix}.status`, "COMMENT", "Status (R13)", pg, [on(KV(/^Disposition$/), CASE_HEADER)], {
    rules: ["R13-judgment-enforceability"],
    asking: "Is this lien still active and enforceable, or has it been satisfied, released or vacated? A docket disposition is not a satisfaction.",
  });
  F(`${prefix}.status_date`, "COMMENT", "Status date", pg, [on(KV(/^Date of Disposition$/), CASE_HEADER)], { rules: ["R13-judgment-enforceability"] });
  F(`${prefix}.satisfaction`, "COMMENT", "Satisfaction of record", pg, [on(KV(/^Date of Satisfaction\b/), CASE_JUDGMENT)], {
    rules: ["R13-judgment-enforceability"],
  });
}
cases.forEach((r, i) => caseFields(`judgments.${i + 1}`, r));

/* Legal description — the vesting deed's parcels, its continuation pages,
   and the assessor's brief legal. */
const parcelNumbers = [];
for (const n of rangeOf(vestingDeed)) {
  const re = /PARCEL (\d+):/g;
  let m;
  while ((m = re.exec(joinedText(n))) !== null) if (!parcelNumbers.includes(m[1])) parcelNumbers.push(m[1]);
}
for (const k of parcelNumbers) {
  F(`legal.parcel_${k}`, "LEGAL DESCRIPTION", `Parcel ${k} (deed)`, rangeOf(vestingDeed), [S(new RegExp(`PARCEL ${k}:\\s*\\n?\\s*([^\\n]{40,})`))], {
    rules: [T1_LEGAL],
    asking: "Confirm the legal description as the vesting deed carries it.",
  });
}
for (const n of rangeOf(vestingDeed).slice(1)) {
  F(`legal.deed_p${n}_continuation`, "LEGAL DESCRIPTION", `Legal description (continued, p${n})`, [n], [L(/^([a-z][^\n]{80,})$/)], {
    optional: true,
    rules: [T1_LEGAL],
    asking: "Confirm the continuation of the legal description across the page break.",
  });
}
F("legal.assessor_brief", "LEGAL DESCRIPTION", "Assessor legal (brief)", rangeOf(assessor), [KV(/^Legal Description:$/)], { rules: [T1_LEGAL] });

// ---- resolve --------------------------------------------------------------------------------

const located = new Map();
const ctx = {
  value: (path) => {
    const l = located.get(path);
    return l?.a?.value ?? l?.b?.value ?? null;
  },
};
const unlocated = [];
for (const spec of specs) {
  const found = locate(spec, ctx);
  if (found === null) {
    if (spec.optional !== true) unlocated.push(spec);
    continue;
  }
  located.set(spec.path, found);
}

const latency = (eng, n) => {
  const s = page(n).elapsed[eng];
  return s === null ? 0 : Math.round(s * 1000);
};
const readingOf = (id, eng, h) => ({
  id: `${id}_${eng === A ? "a" : "b"}`,
  field_id: id,
  engine_id: eng,
  value: h.value,
  page: h.n,
  snippet: h.snippet,
  confidence_raw: null,
  cost_usd: 0,
  latency_ms: latency(eng, h.n),
  line_coords: { page: h.n, ...box(h.blocks) },
});

const pLabel = (n) => `p${n}`;
function defaultAsking(spec, routed, n) {
  switch (routed) {
    case "A≠B":
      return `Which reading does ${pLabel(n)} carry for ${spec.label}?`;
    case "single reader":
      return `Confirm ${spec.label} on ${pLabel(n)} — only one reader returned it.`;
    case "judgment":
      return `Confirm ${spec.label} from the court record on ${pLabel(n)}.`;
    case "T1":
      return `Confirm ${spec.label} on ${pLabel(n)} — a T1 value is never auto-confirmed.`;
    default:
      return `Confirm ${spec.label} as read on degraded ${pLabel(n)}.`;
  }
}
function whyFor(routed, l, t1, pg) {
  const n = l.n;
  switch (routed) {
    case "A≠B":
      return `Two independent readers disagreed on ${pLabel(n)}: A read “${l.a.value}”, B read “${l.b.value}”.`;
    case "single reader": {
      const missing = l.a === null ? A : B;
      const f = pg.flags[missing];
      return `Only reader ${l.a === null ? "B" : "A"} (${l.a === null ? B : A}) returned a value on ${pLabel(n)}; reader ${l.a === null ? "A" : "B"} (${missing}) produced no block for it${f.length > 0 ? ` (${f.join(", ")})` : ""} — a blank is never filled in from the reader that did.`;
    }
    case "judgment":
      return `${agreement(l)} on ${pLabel(n)}, but a judgment never auto-confirms — enforceability and party identity are the examiner's (R13).`;
    case "T1":
      return `${agreement(l)} on ${pLabel(n)}, but this is a ruinous-exposure field (${t1}) and a T1 value is never auto-confirmed.`;
    default:
      return `${agreement(l)}, but ${pLabel(n)} is degraded (${pg.reasons.join("; ")}); a value read off a degraded page is routed, never auto-confirmed (Law 3).`;
  }
}
/* "Agree" is the canonical comparison's word; when the two strings differ
   byte for byte the sentence says so, because the screen will show both. */
const agreement = (l) =>
  l.a.value === l.b.value
    ? "Both readers agree"
    : `Both readers agree once case and punctuation are normalised (A read “${l.a.value}”, B read “${l.b.value}”)`;

const fields = [];
const disagreements = [];
const nearMisses = [];
for (const spec of specs) {
  const l = located.get(spec.path);
  if (l === undefined) continue;
  const id = fieldId(spec.path);
  const readings = [];
  if (l.a !== null) readings.push(readingOf(id, A, l.a));
  if (l.b !== null) readings.push(readingOf(id, B, l.b));
  const primary = l.a ?? l.b;
  const equal = l.a !== null && l.b !== null && canon(l.a.value) === canon(l.b.value);
  if (l.a !== null && l.b !== null && !equal) disagreements.push({ path: spec.path, page: l.n, a: l.a.value, b: l.b.value });
  if (equal && l.a.value !== l.b.value) nearMisses.push({ path: spec.path, page: l.n, a: l.a.value, b: l.b.value });
  const pg = page(primary.n);
  const rules = [...spec.rules];
  if (spec.path.endsWith(".amount") && /Dollars/i.test(primary.snippet)) rules.push("S5-words-over-numerals");
  const t1 = rules.find((r) => r.startsWith("T1-")) ?? null;
  const judgment = spec.section === "judgments";
  let state;
  let routed;
  if (readings.length === 2 && equal && !judgment && t1 === null && !pg.degraded) {
    state = "auto_confirmed";
    routed = null;
  } else {
    state = "needs_review";
    routed = readings.length < 2 ? "single reader" : !equal ? "A≠B" : judgment ? "judgment" : t1 !== null ? "T1" : "degraded page";
  }
  /*
   * The value the server states is the PRIMARY READER'S, whether or not the
   * second reader corroborated it — it was extracted, off a named page and a
   * box, and `state` alone says whether anyone has ruled on it. Emitting null
   * here instead was wrong in a way the screen made plain: the contract
   * reserves "null value, null na_reason" for "not yet extracted", so the
   * workstation printed `not yet extracted` beside an `A≠B` tag on a field two
   * readers had both read. The refusal to fill a blank from the reader that
   * did (`whyFor`, "single reader") is about AUTO-CONFIRMING, and it is kept
   * by `state`, not by withholding a cited reading from the examiner.
   */
  const value = primary.value;
  fields.push({
    id,
    order_id: ORDER_ID,
    path: spec.path,
    section: spec.section,
    template_row: spec.row,
    tier: t1 === null ? null : "T1",
    routed_because: routed,
    value,
    na_reason: null,
    state,
    source_doc_id: DOC_ID,
    source_page: primary.n,
    source_snippet: primary.snippet,
    source_excerpt: excerptOf(DOC_ID, primary.n, value, primary.snippet),
    source_line_coords: { page: primary.n, ...box(primary.blocks) },
    engine_id: l.a !== null ? A : B,
    engine_confidence_raw: null,
    rule_refs: rules,
    approved_by: null,
    approved_at: null,
    readings,
    asking: state === "needs_review" ? (spec.asking ?? defaultAsking(spec, routed, primary.n)) : null,
    why: state === "needs_review" ? whyFor(routed, l, t1, pg) : null,
    consequence: state === "needs_review" ? (spec.consequence ?? (t1 === null ? null : T1_CONSEQUENCE[t1])) : null,
  });
}
const fieldByPath = new Map(fields.map((f) => [f.path, f]));

// ---- absence rows --------------------------------------------------------------------------

const ABSENCE_SENTENCE = {
  NOT_PRESENT: "— structurally absent",
  NOT_FOUND: "— not found of record",
  NOT_STATED: "— not stated in the package",
  PRESENT_UNREADABLE: "— present but unreadable",
};
function na(path, row, label, reason, evidence, why, extra = {}) {
  if (fieldByPath.has(path)) return;
  const state = reason === "NOT_PRESENT" ? "auto_confirmed" : "needs_review";
  const e = evidence ?? null;
  const f = {
    id: fieldId(path),
    order_id: ORDER_ID,
    path,
    section: path.split(".")[0],
    template_row: row,
    tier: null,
    routed_because: state === "needs_review" ? reason : null,
    value: null,
    na_reason: reason,
    state,
    source_doc_id: e === null ? null : DOC_ID,
    source_page: e === null ? null : e.n,
    source_snippet: e === null ? null : e.snippet,
    // An absence row has no value to mark, so it has no split to make.
    source_excerpt: null,
    source_line_coords: e === null ? null : { page: e.n, ...box(e.blocks) },
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: extra.rules ?? [],
    approved_by: null,
    approved_at: null,
    readings: [],
    asking: state === "needs_review" ? (extra.asking ?? `Confirm ${label} is ${ABSENCE_SENTENCE[reason].replace(/^— /, "")}.`) : null,
    why: state === "needs_review" ? why : null,
    consequence: state === "needs_review" ? (extra.consequence ?? null) : null,
  };
  fields.push(f);
  fieldByPath.set(path, f);
  naLabels.set(path, label);
}
const naLabels = new Map();
/* Evidence for an absence: the first block on the page that says so, from A or B, else C. */
const evidenceOn = (n, re) => findLine(n, A, re) ?? findLine(n, B, re) ?? findLine(n, C, re);
const rangeLabel = (ns) => {
  const sorted = [...new Set(ns)].sort((p, q) => p - q);
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of sorted) {
    if (start === null) {
      start = n;
      prev = n;
      continue;
    }
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `p${start}` : `p${start}–p${prev}`);
    start = n;
    prev = n;
  }
  if (start !== null) parts.push(start === prev ? `p${start}` : `p${start}–p${prev}`);
  return parts.join(", ");
};

/* An order number read off a recorded instrument's own pages is the order
   that instrument was prepared under, not necessarily this search's; the
   examiner is asked exactly that. */
{
  const f = fieldByPath.get("header.order_number");
  const owner = f === undefined ? undefined : runs.find((r) => f.source_page >= r.first_page && f.source_page <= r.last_page);
  if (f !== undefined && owner !== undefined && (owner.kind === "security_deed" || owner.kind === "deed")) {
    f.asking = `The only order number printed in the package sits on a recorded ${owner.kind === "deed" ? "deed" : "security instrument"}'s page (p${f.source_page}) — is it this search's order number?`;
    f.why = `${f.why} The page belongs to a recorded instrument (${rangeLabel(rangeOf(owner))}), not to a search cover sheet, so the number may be the order that instrument was prepared under.`;
  }
}

/* Header: effective date. The county index prints a search timestamp and the
   UCC index a good-through date; neither is a certified effective date. */
{
  const uccGood = uccSearch === undefined ? null : locate({ alts: [KV(/^Good Through Filing Date$/)], pages: rangeOf(uccSearch) }, ctx);
  const good = uccGood?.a?.value ?? uccGood?.b?.value ?? null;
  const sd = fieldByPath.get("header.search_date");
  na(
    "header.effective_date",
    "EFFECTIVE DATE",
    "Effective date",
    "NOT_STATED",
    uccGood?.a ?? uccGood?.b ?? null,
    `No certified effective date is stated anywhere in the package. The court searches were run on ${sd?.value ?? "the search date"} (${rangeLabel(rangeOf(courtSearch))})${good === null ? "" : `, and the UCC index is good through ${good} (${rangeLabel(rangeOf(uccSearch))})`} — a search timestamp is not an effective date.`,
  );
}

/* Tax: due date. A paid receipt states the payment, not the due date. */
na(
  "tax.due_date",
  "DUE DATE",
  "Due date",
  "NOT_STATED",
  evidenceOn(taxReceipt.last_page, /^TOTAL DUE\b/) ?? evidenceOn(taxReceipt.first_page, /^Due$/),
  `The receipt (${rangeLabel(rangeOf(taxReceipt))}) states the paid date${fieldByPath.get("tax.paid_date")?.value === undefined ? "" : ` ${fieldByPath.get("tax.paid_date").value}`} and the amount due; no due date is printed on the receipt or the tax history.`,
);

/* Prior deed / vesting rows the deed is silent on. */
for (const spec of specs) {
  if (!/\.(grantor_vesting|grantee_vesting)$/.test(spec.path) || fieldByPath.has(spec.path)) continue;
  const parent = fieldByPath.get(spec.vestingOf);
  if (parent === undefined) continue;
  na(spec.path, spec.row, spec.label, "NOT_STATED", { n: parent.source_page, blocks: [{ ...parent.source_line_coords }], snippet: parent.source_snippet }, `The deed names the party on p${parent.source_page} with no capacity or tenancy language after the name; rule 12 puts capacity in the vesting field, and the instrument states none.`);
}

/* Deeds of trust: the rows a security instrument may be silent on, and the
   release check against the recorder's index. */
const DOT_ROWS_STATED = [
  ["entity_type", "ENTITY TYPE", "Entity type", (p) => `The instrument describes the mortgagor only by name and marital status (${p}); it states no entity type — an individual is what the vesting phrase says, and the row is left for the examiner to type.`],
  ["non_person_name", "NON-PERSON NAME", "Non-person name (judgment search key)", (p) => `The instrument states the mortgagor only with vesting language (${p}); no bare-name line was read. The non-person name is the mortgagor with the vesting language stripped.`],
  ["trustee_address", "TRUSTEE ADDRESS", "Trustee address", (p) => `The trustee is named on ${p} without an address; the only address printed near it is the lender's.`],
  ["open_ended", "OPEN ENDED – YES/NO", "Open-ended", (p) => `No future-advance, open-end or line-of-credit clause was read on ${p}; the instrument secures a stated principal sum. Confirm OPEN ENDED: No.`],
  ["min", "MIN", "MERS MIN", (p) => `The lender is named directly on ${p}, with no MERS nominee clause and no MIN line; a non-MERS instrument carries no MIN (golden rule 14).`],
  ["multiple_parcels", "MULTIPLE PARCELS COVERS ALL TRACTS – YES/NO", "Multiple parcels — covers all tracts", (p) => `The vesting deed (${rangeLabel(rangeOf(vestingDeed))}) describes ${parcelNumbers.length} parcel${parcelNumbers.length === 1 ? "" : "s"}; the security instrument's exhibit (${p}) carries one description. Whether it covers every tract is not stated.`],
];
/* The recorder's index, parsed once: every row of every name search. */
const indexRows = [];
if (recorderSearch !== undefined) {
  for (const n of rangeOf(recorderSearch)) {
    for (const eng of [A, B]) {
      for (const b of page(n).blocks[eng]) {
        for (const s of b.segs) {
          if (s.row === null) continue;
          const date = s.row.find((c) => /^\d{2}-\d{2}-\d{4}$/.test(c));
          const detail = s.row.find((c) => /Book:\s*\d+\s+Page:\s*\d+/.test(c));
          if (date === undefined || detail === undefined) continue;
          const m = /Book:\s*(\d+)\s+Page:\s*(\d+)\s+([A-Z]{2,5})\b/.exec(detail);
          if (m === null) continue;
          const [mm, dd, yyyy] = date.split("-");
          indexRows.push({ n, eng, block: b, seg: s, book: m[1], page: m[2], type: m[3], date: `${yyyy}${mm}${dd}`, row: s.row });
        }
      }
    }
  }
}
const RELEASE_TYPES = /^(?:RL|REL|DR|PR|SAT|DOR|RELS?)$/;
const ASSIGNMENT_TYPES = /^(?:AS|ASN|ASGN|ASSN)$/;
const MODIFICATION_TYPES = /^(?:MOD|MDF|LMA|MODIF)$/;
const uniqBy = (rows, key) => [...new Map(rows.map((r) => [key(r), r])).values()];
const indexRowsA = indexRows.filter((r) => r.eng === A);
const indexHit = (r) => ({ n: r.n, blocks: [r.block], snippet: r.seg.text });

const dotFacts = dots.map((run, i) => {
  const prefix = `deed_of_trust.${i + 1}`;
  const bp = /Book (\d+) Page\(s\):\s*(\d+)/.exec(fieldByPath.get(`${prefix}.book_page`)?.readings[0]?.value ?? "");
  const rec = fieldByPath.get(`${prefix}.recorded`)?.readings[0]?.value ?? null;
  const indexed = bp === null ? [] : indexRowsA.filter((r) => r.book === bp[1] && Number(r.page) === Number(bp[2]));
  return { prefix, run, book: bp?.[1] ?? null, firstPage: bp?.[2] ?? null, recorded: rec === null ? null : mdy(rec), indexed };
});
for (const d of dotFacts) {
  const pg = rangeLabel(rangeOf(d.run));
  /* The recorder's index carries its own recording date for the instrument;
     where the stamp was read by one reader only, the examiner is told what
     the index says beside it — a fact to check against, never a substitute. */
  const rec = fieldByPath.get(`${d.prefix}.recorded`);
  if (rec !== undefined && rec.state === "needs_review" && d.indexed.length > 0) {
    const idx = d.indexed[0];
    const idxDate = idx.row.find((c) => /^\d{2}-\d{2}-\d{4}$/.test(c));
    rec.why += ` The recorder's index (p${idx.n}) lists this instrument as Book ${idx.book} Page ${Number(idx.page)} ${idx.type} recorded ${idxDate}.`;
  }
  for (const [key, row, label, why] of DOT_ROWS_STATED) {
    const path = `${d.prefix}.${key}`;
    if (fieldByPath.has(path)) continue;
    const anchor = fieldByPath.get(`${d.prefix}.mortgagor`) ?? fieldByPath.get(`${d.prefix}.inst`);
    const ev = anchor === undefined ? null : { n: anchor.source_page, blocks: [anchor.source_line_coords], snippet: anchor.source_snippet };
    na(path, row, label, "NOT_STATED", ev, why(pg));
  }
  /* Release of record — the COMMENT row. A lien is suppressed only on a
     verified release (R15); the index is searched for one, and the search is
     what the row cites. */
  const indexDate = d.indexed[0]?.date ?? d.recorded;
  const releases = uniqBy(indexRowsA.filter((r) => RELEASE_TYPES.test(r.type)), (r) => `${r.book}/${r.page}`);
  const later = indexDate === null ? releases : releases.filter((r) => r.date >= indexDate);
  if (later.length > 0 || d.indexed.length === 0) {
    console.error(`  ! ${d.prefix}: release row not emitted (${d.indexed.length === 0 ? "instrument not found in the recorder index" : `${later.length} release-type index rows on/after its recording`})`);
    continue;
  }
  const ev = indexHit(d.indexed[0]);
  const listed = releases.map((r) => `Book ${r.book} Page ${r.page} ${r.type} (${r.date.slice(4, 6)}-${r.date.slice(6)}-${r.date.slice(0, 4)})`).join(", ");
  na(
    `${d.prefix}.release`,
    "COMMENT",
    "Release of record",
    "NOT_FOUND",
    ev,
    `The recorder's name-search index (${rangeLabel(rangeOf(recorderSearch))}) lists this instrument as Book ${d.book} Page ${Number(d.firstPage)} ${d.indexed[0].type} recorded ${d.indexed[0].row.find((c) => /^\d{2}-\d{2}-\d{4}$/.test(c))}; the release-type entries it lists (${listed || "none"}) are all recorded before it. No release of this instrument is of record — the lien stays open (R15).`,
    { rules: ["R15-liens-survive-sale"], asking: "Is any release or satisfaction of this instrument of record?" },
  );
}

/* Assignments and modifications — absence rows citing the index search. */
{
  const earliest = dotFacts.map((d) => d.indexed[0]?.date ?? d.recorded).filter((x) => x !== null).sort()[0] ?? null;
  /* The criteria line names the search: "Business/LastName: X | FirstName: Y |
     NameType … | Option …" — the name is what the sentence quotes. */
  const searchName = (v) => v.replace(/\s*\|\s*(?:NameType|Option)\b.*$/i, "").replace(/\s*\|\s*FirstName:\s*/i, ", ").trim();
  const searches = recorderSearch === undefined ? [] : [...new Set(rangeOf(recorderSearch).map((n) => findLine(n, A, /^Business\/(?:Last ?Name|LastName):\s*(.+)$/i)?.value ?? null).filter((v) => v !== null).map(searchName))];
  const ev = dotFacts.find((d) => d.indexed.length > 0)?.indexed[0];
  const assignments = uniqBy(indexRowsA.filter((r) => ASSIGNMENT_TYPES.test(r.type)), (r) => `${r.book}/${r.page}`);
  const laterAs = earliest === null ? assignments : assignments.filter((r) => r.date >= earliest);
  if (ev !== undefined && laterAs.length === 0) {
    na(
      "assignments.of_record",
      "Corporate Assignment of Deed of Trust / Mortgage",
      "Assignment of record",
      "NOT_FOUND",
      indexHit(ev),
      `${rangeOf(recorderSearch).length} recorder name-search pages (${rangeLabel(rangeOf(recorderSearch))}; ${searches.length} names: ${searches.join(" · ")}) list ${assignments.length} assignment (AS) entr${assignments.length === 1 ? "y" : "ies"}, all recorded before the earliest open deed of trust; none assigns an instrument in this chain.`,
    );
  } else console.error(`  ! assignments: absence row not emitted (${laterAs.length} assignment rows on/after the earliest deed of trust)`);
  const mods = uniqBy(indexRowsA.filter((r) => MODIFICATION_TYPES.test(r.type)), (r) => `${r.book}/${r.page}`);
  const laterMods = earliest === null ? mods : mods.filter((r) => r.date >= earliest);
  if (ev !== undefined && laterMods.length === 0) {
    na(
      "modifications.of_record",
      "Loan Modification Agreement",
      "Modification of record",
      "NOT_FOUND",
      indexHit(ev),
      `${rangeOf(recorderSearch).length} recorder name-search pages (${rangeLabel(rangeOf(recorderSearch))}; ${searches.length} names) list no modification-type entry against any instrument in this chain.`,
      { rules: ["R19-modifications-linked"] },
    );
  } else console.error(`  ! modifications: absence row not emitted (${laterMods.length} modification rows on/after the earliest deed of trust)`);
}

/* Judgments: the rows a Case.net record does not carry. */
cases.forEach((run, i) => {
  const prefix = `judgments.${i + 1}`;
  const caseNo = fieldByPath.get(`${prefix}.case_no`)?.readings[0]?.value ?? null;
  const header = fieldByPath.get(`${prefix}.case_no`);
  const ev = header === undefined ? null : { n: header.source_page, blocks: [header.source_line_coords], snippet: header.source_snippet };
  const pg = rangeLabel(rangeOf(run));
  const rules = ["R13-judgment-enforceability"];
  na(`${prefix}.book_page`, "BOOK/PAGE", "Book / page", "NOT_STATED", ev, `The Case.net record (${pg}) identifies the lien by case number only; no recorder book/page is printed. Confirm none is required for a circuit-court certificate of lien in this jurisdiction.`, { rules });
  na(`${prefix}.inst`, "INST#", "Instrument no.", "NOT_STATED", ev, `The Case.net record (${pg}) carries a case number and no recorder instrument number.`, { rules });
  na(`${prefix}.plaintiff_attorney`, "PLAINTIFF ATTORNEY", "Plaintiff attorney", "NOT_STATED", ev, `The Party Information page (${pg}) lists the petitioner and the respondent and names no attorney of record.`, { rules });
  na(`${prefix}.phone`, "PHONE#", "Phone", "NOT_STATED", ev, `No telephone number is printed on the Case.net record (${pg}).`, { rules });
  /* The index row for this case, if the index carries one: what follows its
     "Satisfied Date:" label on the same line — never the next row's text. */
  const idx = judgmentIndex === undefined || caseNo === null ? null : rangeOf(judgmentIndex).map((n) => findSpan(n, A, new RegExp(`Case Number:[ \\t]*${caseNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*?Satisfied Date:[ \\t]*([^\\n|]*)`))).find((h) => h !== null) ?? null;
  na(
    `${prefix}.satisfaction`,
    "COMMENT",
    "Satisfaction of record",
    "NOT_STATED",
    idx ?? ev,
    `The Case.net record (${pg}) carries no satisfaction entry${idx === null ? "" : `, and the judgment index (p${idx.n}) prints “Satisfied Date:” ${idx.value.trim() === "" ? "blank" : idx.value.trim()} for this case`}. R13: status unknown → needs review; never assume active, never assume satisfied.`,
    { rules, asking: "Has this lien been satisfied or released of record?" },
  );
});

/* UCC: every debtor-name search returned nothing. */
if (uccSearch !== undefined) {
  const pgs = rangeOf(uccSearch);
  const noResult = pgs.map((n) => evidenceOn(n, /^No results found$/i));
  const debtors = pgs.map((n) => findSpan(n, A, /(?:Individual|Organization) Debtor\s*\n?\s*([^\n]+)/)?.value ?? null).filter((v) => v !== null);
  const allEmpty = noResult.every((h) => h !== null);
  const anyFiling = pgs.some((n) => /File Number:\s*\d/.test(joinedText(n)));
  if (allEmpty && !anyFiling) {
    na(
      "ucc.filings",
      "Judgments / Liens — UCC",
      "UCC filings",
      "NOT_FOUND",
      noResult[0],
      `${pgs.length} Secretary of State UCC searches (${rangeLabel(pgs)}; ${debtors.length} debtor names: ${debtors.join(" · ")}) each returned “No results found”. No UCC filing of record against any chain party (R20).`,
      { rules: ["R20-ucc-collateral-decides"], asking: "Confirm no UCC filing is of record against a chain party." },
    );
  } else {
    const unreadable = pgs.filter((n, i) => noResult[i] === null);
    if (unreadable.length > 0 && !anyFiling) {
      na("ucc.filings", "Judgments / Liens — UCC", "UCC filings", "PRESENT_UNREADABLE", null, `UCC search pages ${rangeLabel(unreadable)} returned no legible result line from any reader.`);
    } else console.error("  ! ucc: a filing may be present; no absence row emitted");
  }
}

/* A template row this package has no citable reading for and no absence row
   either — dropped, and counted, rather than filled in. */
const dropped = unlocated.filter((s) => !fieldByPath.has(s.path));

// ---- package header ------------------------------------------------------------------------------

const val = (path) => fieldByPath.get(path)?.value ?? fieldByPath.get(path)?.readings?.[0]?.value ?? "";
const stamp = locate({ alts: [S(/(Recorded [Ii]n [A-Z][a-z]+ County, [A-Z][a-z]+)/)], pages: rangeOf(vestingDeed) }, ctx);
const stampText = stamp?.a?.value ?? stamp?.b?.value ?? "";
const stampCounty = /Recorded [Ii]n ([A-Z][a-z]+) County/.exec(stampText)?.[1] ?? "";
const cityLine = locate({ alts: [KV(/^Property Address:$/, { run: true, line: 1 })], pages: rangeOf(assessor) }, ctx);
const cityText = cityLine?.a?.value ?? cityLine?.b?.value ?? "";
const stateCode = /,\s*([A-Z]{2})\s+\d{5}/.exec(cityText)?.[1] ?? "";
const owner = locate({ alts: [KV(/^Deed Holder:$/)], pages: rangeOf(assessor) }, ctx);
const orderRef = fieldByPath.get("header.order_number");
if (stampCounty === "" || stateCode === "") fail("could not read the county from the clerk stamp or the state from the assessor's address line");

const packageHeader = {
  jurisdiction: `${stampCounty.toLowerCase()}-${stateCode.toLowerCase()}`,
  county: stampCounty,
  state: stateCode,
  parcel: val("assessment.tax_id"),
  situs: `${val("location.location")}, ${cityText.replace(/\s*MAP THIS ADDRESS$/i, "")}`,
  owner_of_record: owner?.a?.value ?? owner?.b?.value ?? "",
  stamp_page: stamp?.n ?? 0,
  stamp_text: stampText,
  order_ref: orderRef?.readings?.[0]?.value ?? "",
  order_ref_page: orderRef?.source_page ?? 0,
};

// ---- instruments -------------------------------------------------------------------------------------

const KIND_LABEL = {
  assessor_card: (r) => `${stampCounty} County Assessor card — parcel ${val("assessment.tax_id")}`,
  tax_receipt: (r) => `${stampCounty} County Collector — ${val("tax.year")} ${val("tax.tax_type").toLowerCase()} tax receipt`,
  deed: (r) => {
    const p = r === vestingDeed ? "vesting" : `prior_deed.${priorDeeds.indexOf(r) + 1}`;
    const type = val(`${p}.deed_type`);
    return `${type.charAt(0) + type.slice(1).toLowerCase()} — Instr ${val(`${p}.inst`)} · ${val(`${p}.book_page`).replace(/\(s\)/, "").replace(/:/g, "")}${r === vestingDeed ? " (vesting)" : " (prior)"}`;
  },
  security_deed: (r) => {
    const p = `deed_of_trust.${dots.indexOf(r) + 1}`;
    return `Deed of Trust — Instr ${val(`${p}.inst`)} · ${val(`${p}.book_page`).replace(/\(s\)/, "").replace(/:/g, "")}`;
  },
  case_record: (r) => {
    const h = findLine(r.first_page, A, /Case\.net:?\s*(\S+\s*-\s*.+?)\s*-\s*Case Header/) ?? findLine(r.first_page, B, /Case\.net:?\s*(\S+\s*-\s*.+?)\s*-\s*Case Header/);
    return `Case.net ${h?.value ?? r.ref}`;
  },
  plat: (r) => `${findLine(r.first_page, A, /^([A-Z][a-z]+ County, [A-Z]{2})$/)?.value ?? "County"} cadastral map`,
  recorder_name_search: (r) => `Recorder of Deeds name search results (${rangeOf(r).length} pages)`,
  court_name_search: (r) => `${findLine(r.first_page, A, /^([A-Z][a-z]+ County - \d+\w+ Judicial Circuit)$/)?.value ?? "Circuit court"} — name search result`,
  judgment_index: (r) => `${findLine(r.first_page, A, /^([A-Z][a-z]+ County - \d+\w+ Judicial Circuit)$/)?.value ?? "Circuit court"} — judgment index result`,
  ucc_search: (r) => `Secretary of State UCC search (${rangeOf(r).length} debtor-name searches)`,
};
/* The page header — the instrument named short enough to print whole (≤60),
   never a slice of the long label, which could cut a number in half. */
const PAGE_KIND = {
  assessor_card: () => `ASSESSOR CARD · PARCEL ${val("assessment.tax_id")}`,
  tax_receipt: () => `COLLECTOR · ${val("tax.year")} ${val("tax.tax_type")} TAX RECEIPT`,
  deed: (r) => {
    const p = r === vestingDeed ? "vesting" : `prior_deed.${priorDeeds.indexOf(r) + 1}`;
    return `${val(`${p}.deed_type`)} · INSTR ${val(`${p}.inst`)}`;
  },
  security_deed: (r) => `DEED OF TRUST · INSTR ${val(`deed_of_trust.${dots.indexOf(r) + 1}.inst`)}`,
  case_record: (r) => `CASE.NET ${r.ref}`,
  plat: () => "CADASTRAL MAP",
  recorder_name_search: () => "RECORDER OF DEEDS NAME SEARCH",
  court_name_search: () => "CIRCUIT COURT NAME SEARCH",
  judgment_index: () => "CIRCUIT COURT JUDGMENT INDEX",
  ucc_search: () => "SECRETARY OF STATE UCC SEARCH",
};
const instruments = runs.map((r, i) => {
  const pageKind = PAGE_KIND[r.kind](r).toUpperCase();
  if (pageKind.length > 60) fail(`page kind over 60 chars: ${pageKind}`);
  return {
    id: `ins_${i + 1}`,
    label: KIND_LABEL[r.kind](r),
    kind: r.kind,
    first_page: r.first_page,
    last_page: r.last_page,
    recorded_ref: r.ref !== null && !r.ref.includes("/") ? r.ref : null,
    pageKind,
  };
});
const instrumentOf = (n) => instruments.find((ins) => n >= ins.first_page && n <= ins.last_page);

// ---- pages ---------------------------------------------------------------------------------------------

/* Page text comes from reader C, unless C is flagged on the page, is the named
   outlier there, or the page's consensus is below the floor with no reader
   named — then reader A. Tables are flattened to "cell | cell" rows. */
function pageLines(n) {
  const pg = page(n);
  const lowConsensus = pg.consensus !== null && pg.consensus < CONSENSUS_FLOOR;
  const fallback = pg.flags[C].length > 0 || pg.outlier === C || (lowConsensus && pg.outlier === null);
  const order = fallback ? [A, B, C] : [C, A, B];
  for (const eng of order) {
    const lines = pg.blocks[eng].flatMap((b) => b.segs.map((s) => s.text)).filter((t) => !isChrome(t));
    if (lines.length > 0) return lines;
  }
  return [];
}
const bundlePages = pageRange(1, PAGES).map((n) => {
  const pg = page(n);
  const lines = pageLines(n);
  const readInFull = ENGINES.some((e) => pg.blocks[e.id].some((b) => b.segs.some((s) => !isChrome(s.text) && s.text.length >= 3)));
  return {
    n,
    kind: instrumentOf(n).pageKind,
    read_in_full: readInFull,
    degraded: pg.degraded,
    lines,
    image_url: `/scan/${String(job.id)}/page_${pad(n)}.png`,
    flags: Object.fromEntries(ENGINES.map((e) => [e.id, pg.flags[e.id]])),
    consensus: pg.consensus,
  };
});

// ---- composition ---------------------------------------------------------------------------------------

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
const specByPath = new Map(specs.map((s) => [s.path, s]));
const labelOf = (f) => specByPath.get(f.path)?.label ?? naLabels.get(f.path) ?? f.path.split(".").slice(-1)[0].replace(/_/g, " ");
/* Rows print in the template's order within a block — each section's own
   row list; a reading and the absence row beside it sort the same way. */
const TEMPLATE_ORDER = {
  header: ["ORDER #", "VENDOR", "SEARCH DATE", "EFFECTIVE DATE"],
  vesting: ["DEED TYPE", "GRANTOR", "GRANTOR VESTING", "GRANTEE", "GRANTEE VESTING", "DATED", "RECORDED", "BOOK/PAGE", "INST#", "CONS"],
  prior_deed: ["DEED TYPE", "GRANTOR", "GRANTOR VESTING", "GRANTEE", "GRANTEE VESTING", "DATED", "RECORDED", "BOOK/PAGE", "INST#", "CONS"],
  location: ["LOCATION", "CITY/TWP/BORO", "COUNTY/PARISH", "ZIP CODE", "CONDO", "PUD", "WATERFRONT"],
  assessment: ["TAX ID#", "LAND", "BUILDING", "TOTAL"],
  tax: ["TAX ID", "TAX TYPE", "YEAR", "OPEN", "PAID", "DELINQ", "AMOUNT", "DUE DATE"],
  deed_of_trust: ["MORTGAGOR", "ENTITY TYPE", "NON-PERSON NAME", "MORTGAGEE", "TRUSTEE", "TRUSTEE ADDRESS", "DATED", "RECORDED", "BOOK/PAGE", "AMOUNT", "OPEN ENDED – YES/NO", "MIN", "INST#", "MULTIPLE PARCELS COVERS ALL TRACTS – YES/NO", "COMMENT", "LEGAL DESCRIPTION"],
  judgments: ["TYPE", "PLAINTIFF", "FILED", "DEFENDANT", "RECORDED", "BOOK/PAGE", "INST#", "PLAINTIFF ATTORNEY", "PHONE#", "ADDRESS", "AMOUNT", "CASE NO", "COMMENT"],
};
const templateRank = (f) => {
  const order = TEMPLATE_ORDER[f.section] ?? [];
  const i = order.indexOf(f.template_row);
  return i < 0 ? order.length : i;
};
const rowFor = (f) => ({
  label: labelOf(f),
  value:
    f.value !== null
      ? f.value
      : f.na_reason !== null
        ? ABSENCE_SENTENCE[f.na_reason]
        : f.readings.length < 2
          ? "— awaiting examiner (single reader)"
          : "— awaiting examiner (readers disagree)",
  /* Awaiting a ruling — clickable through to the workstation. */
  pending: f.state === "needs_review",
  field_id: f.id,
});
const sectionFields = (prefix) =>
  fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.path.startsWith(prefix))
    .sort((p, q) => templateRank(p.f) - templateRank(q.f) || p.i - q.i)
    .map(({ f }) => f);
const blocks = [];
const pushBlock = (title, fs) => {
  if (fs.length === 0) return;
  const values = fs.map(rowFor);
  blocks.push({ id: `rb${blocks.length + 1}`, numeral: NUMERALS[blocks.length] ?? String(blocks.length + 1), title, values, field_count: values.length, cited: fs.filter((f) => f.source_page !== null).length });
};
pushBlock("Header information", sectionFields("header."));
pushBlock("Property identification", sectionFields("location."));
pushBlock("Assessment", sectionFields("assessment."));
pushBlock("Current tax", sectionFields("tax."));
pushBlock("Vesting & title chain", [...sectionFields("vesting."), ...priorDeeds.flatMap((_, i) => sectionFields(`prior_deed.${i + 1}.`))]);
dots.forEach((_, i) =>
  pushBlock(
    `Encumbrances & open liens — deed of trust ${i + 1} of ${dots.length}`,
    sectionFields(`deed_of_trust.${i + 1}.`).filter((f) => !f.path.endsWith(".legal_description")),
  ),
);
pushBlock("Assignments / Modifications", [...sectionFields("assignments."), ...sectionFields("modifications.")]);
cases.forEach((_, i) => pushBlock(`Judgments & general liens — case ${i + 1} of ${cases.length}`, sectionFields(`judgments.${i + 1}.`)));
pushBlock("UCC", sectionFields("ucc."));
pushBlock("Legal description", [...sectionFields("legal."), ...dots.flatMap((_, i) => sectionFields(`deed_of_trust.${i + 1}.legal_description`))]);
/* Every field has a row; a field with no row would be a reading dropped on the way to the report. */
{
  const placed = new Set(blocks.flatMap((b) => b.values.map((v) => v.field_id)));
  const missing = fields.filter((f) => !placed.has(f.id));
  if (missing.length > 0) fail(`fields with no composition row: ${missing.map((f) => f.path).join(", ")}`);
  if (placed.size !== blocks.reduce((n, b) => n + b.values.length, 0)) fail("a field was placed in two composition rows");
  /* The queue walks the report's order. */
  const byId = new Map(fields.map((f) => [f.id, f]));
  fields.splice(0, fields.length, ...blocks.flatMap((b) => b.values.map((v) => byId.get(v.field_id))));
}

// ---- pipeline / timeline / quarantine --------------------------------------------------------------------------

const citedPages = [...new Set(fields.map((f) => f.source_page).filter((n) => n !== null))].sort((p, q) => p - q);
const uncited = pageRange(1, PAGES).filter((n) => !citedPages.includes(n));
const uncitedByKind = new Map();
for (const n of uncited) {
  const k = instrumentOf(n).kind;
  uncitedByKind.set(k, (uncitedByKind.get(k) ?? 0) + 1);
}
const KIND_NOUN = {
  assessor_card: "assessor-card",
  tax_receipt: "tax-receipt",
  deed: "deed body",
  security_deed: "deed-of-trust body",
  case_record: "court-record",
  plat: "cadastral-map",
  recorder_name_search: "recorder name-search",
  court_name_search: "court name-search",
  judgment_index: "judgment-index",
  ucc_search: "UCC-search",
};
const classifierNote = `${uncited.length} of ${PAGES} pages carry no report field (${[...uncitedByKind.entries()].map(([k, c]) => `${c} ${KIND_NOUN[k]} page${c === 1 ? "" : "s"}`).join(", ")}).`;

const degradedPages = bundlePages.filter((p) => p.degraded).map((p) => p.n);
const needsReview = fields.filter((f) => f.state === "needs_review").length;
const autoConfirmed = fields.filter((f) => f.state === "auto_confirmed").length;
const withValue = fields.filter((f) => f.na_reason === null).length;
const naCount = fields.length - withValue;
const recordedInstruments = runs.filter((r) => r.kind === "deed" || r.kind === "security_deed").length;

/* PNG headers: width, height, bit depth, colour type — what the rasters are,
   with no DPI claim (the run records none). */
function pngHeader(n) {
  const f = join(RUN, `page_${pad(n)}.png`);
  if (!existsSync(f)) return null;
  const buf = readFileSync(f).subarray(0, 32);
  const COLOR = { 0: "greyscale", 2: "RGB", 3: "indexed", 4: "greyscale+alpha", 6: "RGBA" };
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], color: COLOR[buf[25]] ?? `colour type ${buf[25]}` };
}
const png = pngHeader(1);
const rasterLabel = png === null ? "no page rasters in the run" : `${png.w}×${png.h} px · ${png.depth}-bit ${png.color} PNG · ${PAGES} pages`;
const profile = Array.isArray(job.profile) ? job.profile[0] : null;

/* The judgment index versus the case records in the package: how many
   entries the index prints for the searched names, how many of those the
   package holds a record for. */
const caseNosInPackage = cases.map((r) => r.ref);
const indexEntries = judgmentIndex === undefined ? 0 : rangeOf(judgmentIndex).reduce((sum, n) => sum + Number(/Showing \d+ to \d+ of (\d+) entries/.exec(joinedText(n))?.[1] ?? 0), 0);
const indexCaseNos = judgmentIndex === undefined ? [] : [...new Set(rangeOf(judgmentIndex).flatMap((n) => [...pageText(n, A).text.matchAll(/Case Number:\s*(\S+)/g)].map((m) => m[1])))];
const indexOnly = indexCaseNos.filter((c) => !caseNosInPackage.includes(c));

const runLog = [
  { time: "09:26:04", text: `Ingestion started · ${String(job.name)} · sha256 ${sha256.slice(0, 12)}…`, warn: false, strong: false },
  { time: "09:26:11", text: `Pages split · ${PAGES} pages structured · ${png === null ? "no rasters" : `${png.w}×${png.h} px rasters`}`, warn: false, strong: false },
  ...(degradedPages.length > 0 ? [{ time: "09:26:48", text: `WARN: ${rangeLabel(degradedPages)} flagged below contrast floor (Law 3 limit)`, warn: true, strong: false }] : []),
  { time: "09:27:02", text: `${instruments.length} instruments partitioned · ${recordedInstruments} recorded instruments · ${instruments.length - recordedInstruments} index and record printouts`, warn: false, strong: false },
  { time: "09:27:20", text: `Three readers · A ${A} · B ${B} · C ${C} (page text only, never compared)`, warn: false, strong: false },
  { time: "09:27:40", text: `${withValue} fields extracted with strict bounding-box provenance · ${naCount} template rows recorded absent`, warn: false, strong: true },
  { time: "09:27:41", text: `${needsReview} fields routed to examiner · ${autoConfirmed} auto-cleared by hard validators`, warn: false, strong: false },
  ...(indexOnly.length > 0
    ? [{ time: "09:27:43", text: `WARN: judgment index (${rangeLabel(rangeOf(judgmentIndex))}) prints ${indexEntries} entries for the searched names; ${caseNosInPackage.length} cases carry a Case.net record in the package, ${indexOnly.length} index-only case numbers do not — verify / request image`, warn: true, strong: false }]
    : []),
];

const verifiedChecks = [];
if (fields.every((f) => f.na_reason !== null || (f.source_page !== null && f.source_line_coords !== null && f.readings.length > 0)))
  verifiedChecks.push("Every emitted value carries a page and a region citation from the reader that returned it");
if (fields.every((f) => f.state !== "auto_confirmed" || f.source_page === null || !page(f.source_page).degraded))
  verifiedChecks.push(`Degraded pages (${rangeLabel(degradedPages)}) recorded as degraded; every value read off them routed to review, not collapsed into absent (Law 3)`);
if (fields.filter((f) => f.section === "judgments").every((f) => f.state === "needs_review"))
  verifiedChecks.push(`Judgments ${caseNosInPackage.join(" and ")} routed to examiner — judgments never auto-confirm`);
if (fields.every((f) => f.readings.length <= 2 && new Set(f.readings.map((r) => r.engine_id)).size === f.readings.length))
  verifiedChecks.push(`Every reading pair is exactly two engines (A ${A} · B ${B}); the third reader never enters a comparison`);
if (fieldByPath.has("assessment.total")) verifiedChecks.push("Assessment values read as printed; land + building never checked against total (v99 stays empty)");
if (dotFacts.every((d) => fieldByPath.has(`${d.prefix}.release`)))
  verifiedChecks.push(`Recorder name-search index (${rangeLabel(rangeOf(recorderSearch))}) lists both deeds of trust; no release-type entry is recorded after either — both remain open of record (R15)`);
if (fieldByPath.get("ucc.filings")?.na_reason === "NOT_FOUND")
  verifiedChecks.push(`UCC: ${rangeOf(uccSearch).length} debtor-name searches (${rangeLabel(rangeOf(uccSearch))}), every one “No results found”`);

const pipeline = {
  pages_relevant: citedPages.length,
  classifier_note: classifierNote,
  package_name: String(job.name),
  volume_label: `${PAGES} scanned raster pages`,
  eta_label: "Three-reader extraction complete · examiner queue open",
  verified_checks: verifiedChecks,
  run_log: runLog,
};

const timeline = [
  { kind: "extracted", label: "extracted", detail: `${citedPages.length} relevant pages · 3 engines`, attend: false },
  { kind: "review", label: `review 0/${needsReview}`, detail: `${needsReview} fields queued`, attend: false },
];

const stampEngines = [A, B].filter((eng) => findSpan(stamp?.n ?? 0, eng, /Recorded [Ii]n [A-Z][a-z]+ County/) !== null);
const quarantine = {
  optical: [
    {
      id: "raster",
      label: "Raster resolution",
      value: rasterLabel,
      ok: png !== null,
      note: `Read from the page rasters' PNG headers; the run profile reports ${profile === null ? "no" : `${profile.width}×${profile.height} pt`} pages. No DPI is recorded in the run and none is claimed.`,
    },
    {
      id: "stamp",
      label: "Clerk stamp located",
      value: `p${stamp?.n ?? "?"} — “${stampText}”`,
      ok: stampText !== "",
      note: stampEngines.length > 0 ? `Read by ${stampEngines.join(" and ")} on the vesting deed's cover page.` : null,
    },
    {
      id: "contrast",
      label: "Contrast floor",
      value: `${degradedPages.length} of ${PAGES} pages degraded: ${rangeLabel(degradedPages)}`,
      ok: false,
      note: "A degraded-for-preview banner, an engine flag, or cross-engine consensus below 0.70. Every value read off these pages is routed to the examiner (Law 3).",
    },
  ],
  resolved_note_title: `${stateCode === "MO" ? "Missouri" : stateCode} overlay bound from clerk stamp`,
  resolved_note_body: `Jurisdiction was read from the recorded clerk stamp on p${stamp?.n ?? "?"} — never hand-entered.`,
};

// ---- write --------------------------------------------------------------------------------------------------

const bundle = {
  ...emptyBundle(),
  package: packageHeader,
  engines: ENGINES.map((e) => ({ ...e, pages_read: pagesRead.get(e.id) })),
  pages: bundlePages,
  instruments: instruments.map(({ pageKind, ...ins }) => ins),
  fields,
  composition: { template_version: TEMPLATE_VERSION, blocks },
  quarantine,
  pipeline,
  timeline,
};
writeFileSync(OUT, `${JSON.stringify(bundle)}\n`);

/*
 * The Shape A report, when asked for: render-report.mjs reads the bundle just
 * written, the delivery record it emits (bytes, digest, instant) is merged
 * into `report`, and the bundle is written again. The href is the job's,
 * unchanged — it is where the dev middleware serves the directory from.
 */
if (renderDir !== null) {
  const renderer = join(HERE, "render-report.mjs");
  if (!existsSync(renderer)) fail(`--render: ${renderer} does not exist`);
  const r = spawnSync(process.execPath, [renderer, OUT, renderDir, "--rendered-at", RENDERED_AT], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) fail(`render-report.mjs exited ${r.status}`);
  const record = JSON.parse(readFileSync(join(renderDir, `report-v${bundle.report.version}.json`), "utf8"));
  bundle.report = { ...bundle.report, bytes: record.bytes, sha256: record.sha256, rendered_at: record.rendered_at };
  writeFileSync(OUT, `${JSON.stringify(bundle)}\n`);
}

// ---- summary (stderr) ----------------------------------------------------------------------------------------

const count = (xs, key) => {
  const m = new Map();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].map(([k, v]) => `${k}=${v}`).join(" ");
};
console.error(`instruments (${instruments.length}):`);
for (const ins of instruments) console.error(`  ${ins.id.padEnd(7)} p${String(ins.first_page).padEnd(3)}–p${String(ins.last_page).padEnd(4)} ${ins.kind.padEnd(22)} ${ins.label}`);
console.error(`fields: ${fields.length} (${withValue} with readings, ${naCount} absence rows) · by state ${count(fields, (f) => f.state)}`);
console.error(`  by section ${count(fields, (f) => f.section)}`);
console.error(`  by routed_because ${count(fields.filter((f) => f.routed_because !== null), (f) => f.routed_because)}`);
console.error(`A≠B (${disagreements.length}):`);
for (const d of disagreements) console.error(`  p${d.page} ${d.path}: A “${d.a}” | B “${d.b}”`);
console.error(`equal under the canonical comparison but not byte-equal (${nearMisses.length}):`);
for (const d of nearMisses) console.error(`  p${d.page} ${d.path}: A “${d.a}” | B “${d.b}”`);
console.error(`template rows with no citable reading and no absence row (dropped, ${dropped.length}): ${dropped.map((s) => s.path).join(", ") || "none"}`);
console.error(`pages cited: ${citedPages.length}/${PAGES} · degraded: ${degradedPages.length}`);
console.error(`bundle: ${statSync(OUT).size} B → ${OUT}`);
console.error(`populated bundle written to ${OUT} — DO NOT COMMIT (public repo; NPI). Commit only the --empty shape.`);

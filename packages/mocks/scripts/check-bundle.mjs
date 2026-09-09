#!/usr/bin/env node
/*
 * check-bundle.mjs — the invariants a package bundle must hold before the
 * mock serves it.
 *
 *   node check-bundle.mjs [<bundle.json>]
 *
 * Every check is structural; nothing here knows what the package says. The
 * committed file is the empty shape and passes as such; a populated bundle
 * (generated locally, never committed — this repository is public) must
 * hold every invariant below or the run fails.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(process.argv[2] ?? join(HERE, "..", "src", "bundles", "final-package-lincoln-mo.json"));
const bundle = JSON.parse(readFileSync(PATH, "utf8"));

const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
};

const STATES = new Set(["pending", "auto_confirmed", "needs_review", "confirmed", "corrected", "escalated"]);
const NA = new Set(["NOT_PRESENT", "NOT_FOUND", "NOT_STATED", "PRESENT_UNREADABLE"]);
const READERS = new Set(["dots-mocr", "mineru"]);
const TOP_KEYS = ["sha256", "slug", "job", "source", "package", "engines", "pages", "instruments", "fields", "composition", "report", "quarantine", "pipeline", "timeline"];
const CHROME = [/\[(?:Non-Text|NO TEXT)\]/i, /^Preview$/i, /image quality of this document/i, /<\/?[a-zA-Z][^>]*>/];
const chrome = (s) => typeof s === "string" && CHROME.some((re) => re.test(s));

/* The same comparison the generator routes on. */
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

// ---- shape ----------------------------------------------------------------------

for (const k of TOP_KEYS) check(k in bundle, `missing top-level key ${k}`);
check(/^[0-9a-f]{64}$/.test(bundle.sha256 ?? ""), "sha256 is not a hex digest");
check(Number.isInteger(bundle.source?.pages) && bundle.source.pages > 0, "source.pages is not a positive integer");
check(Number.isInteger(bundle.source?.bytes) && bundle.source.bytes > 0, "source.bytes is not a positive integer");

const N = bundle.source?.pages ?? 0;
const pages = bundle.pages ?? [];
const instruments = bundle.instruments ?? [];
const fields = bundle.fields ?? [];
const blocks = bundle.composition?.blocks ?? [];

if (pages.length === 0 && fields.length === 0 && instruments.length === 0 && blocks.length === 0) {
  if (problems.length > 0) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(`empty shape: ${PATH} (${statSync(PATH).size} B) — the committed placeholder; nothing to check beyond the header`);
  process.exit(0);
}

// ---- pages ----------------------------------------------------------------------

check(pages.length === N, `pages: ${pages.length} entries for ${N} pages`);
pages.forEach((p, i) => {
  check(p.n === i + 1, `pages[${i}].n is ${p.n}, expected ${i + 1}`);
  check(typeof p.kind === "string" && p.kind.length > 0 && p.kind.length <= 60, `p${p.n}: kind missing or over 60 chars`);
  check(typeof p.read_in_full === "boolean" && typeof p.degraded === "boolean", `p${p.n}: read_in_full/degraded not boolean`);
  check(Array.isArray(p.lines), `p${p.n}: lines not an array`);
  for (const line of p.lines ?? []) check(!chrome(line), `p${p.n}: chrome or markup in lines: ${JSON.stringify(line).slice(0, 80)}`);
  check(typeof p.image_url === "string", `p${p.n}: image_url missing`);
});
const degraded = new Set(pages.filter((p) => p.degraded).map((p) => p.n));

// ---- instruments -----------------------------------------------------------------

let expectNext = 1;
instruments.forEach((ins, i) => {
  check(ins.first_page === expectNext, `${ins.id}: first_page ${ins.first_page}, expected ${expectNext} (hole or overlap)`);
  check(ins.last_page >= ins.first_page, `${ins.id}: last_page before first_page`);
  check(typeof ins.label === "string" && typeof ins.kind === "string", `${ins.id}: label/kind missing`);
  check("recorded_ref" in ins, `${ins.id}: recorded_ref missing`);
  expectNext = ins.last_page + 1;
  if (i === instruments.length - 1) check(ins.last_page === N, `${ins.id}: last instrument ends at p${ins.last_page}, not p${N}`);
});
check(new Set(instruments.map((i) => i.id)).size === instruments.length, "instrument ids not unique");
/* Every page of one instrument carries the same header, in upper case. */
for (const ins of instruments) {
  const kinds = new Set(pages.filter((p) => p.n >= ins.first_page && p.n <= ins.last_page).map((p) => p.kind));
  check(kinds.size === 1, `${ins.id}: its pages carry ${kinds.size} different kinds`);
  for (const k of kinds) check(k === k.toUpperCase(), `${ins.id}: page kind is not upper case`);
}

// ---- fields ----------------------------------------------------------------------

check(new Set(fields.map((f) => f.id)).size === fields.length, "field ids not unique");
check(new Set(fields.map((f) => f.path)).size === fields.length, "field paths not unique");
const inBox = (c) =>
  c !== null &&
  typeof c === "object" &&
  Number.isInteger(c.page) &&
  [c.x, c.y, c.w, c.h].every((v) => typeof v === "number" && v >= 0 && v <= 1) &&
  c.x + c.w <= 1.0001 &&
  c.y + c.h <= 1.0001;

for (const f of fields) {
  const tag = f.path;
  check(STATES.has(f.state), `${tag}: state ${f.state} not in the enum`);
  check(f.na_reason === null || NA.has(f.na_reason), `${tag}: na_reason ${f.na_reason} not in the enum`);
  check(Array.isArray(f.rule_refs), `${tag}: rule_refs not an array`);
  check(Array.isArray(f.readings), `${tag}: readings not an array`);
  check(typeof f.section === "string" && f.section === f.path.split(".")[0], `${tag}: section is not the path's first segment`);
  check("asking" in f && "why" in f && "consequence" in f, `${tag}: asking/why/consequence must be present (null when not queued)`);
  check("source_excerpt" in f, `${tag}: source_excerpt must be present (null when the reader's line cannot be split)`);
  if (f.source_excerpt !== null) {
    const e = f.source_excerpt;
    /* The contract's own rule: the three parts must reassemble the snippet
       character for character, and the marked part must be the value. */
    check(e.pre + e.hit + e.post === f.source_snippet, `${tag}: excerpt does not reassemble source_snippet`);
    check(e.hit === f.value, `${tag}: excerpt marks ${JSON.stringify(e.hit)}, not the value`);
    check(e.page === f.source_page, `${tag}: excerpt cites p${e.page}, the field p${f.source_page}`);
    check(e.doc_id === f.source_doc_id, `${tag}: excerpt names a different document`);
    check(e.note === null || typeof e.note === "string", `${tag}: excerpt note is neither null nor text`);
  }
  for (const s of [f.value, f.source_snippet]) check(!chrome(s), `${tag}: chrome or markup in value/snippet: ${JSON.stringify(s).slice(0, 80)}`);
  for (const r of f.readings) {
    check(READERS.has(r.engine_id), `${tag}: reading from ${r.engine_id} — only the two compared readers may appear`);
    check(r.field_id === f.id, `${tag}: reading ${r.id} names field ${r.field_id}`);
    check(r.line_coords === null || inBox(r.line_coords), `${tag}: reading ${r.id} box out of range`);
    for (const s of [r.value, r.snippet]) check(!chrome(s), `${tag}: chrome or markup in reading ${r.id}: ${JSON.stringify(s).slice(0, 80)}`);
  }
  check(f.readings.length <= 2, `${tag}: ${f.readings.length} readings — a comparison is exactly two`);
  check(new Set(f.readings.map((r) => r.engine_id)).size === f.readings.length, `${tag}: two readings from one engine`);

  if (f.na_reason !== null) {
    check(f.value === null, `${tag}: NA row with a value`);
    check(f.readings.length === 0, `${tag}: NA row with readings`);
    check(f.na_reason === "NOT_PRESENT" ? f.state === "auto_confirmed" : f.state === "needs_review", `${tag}: ${f.na_reason} must route ${f.na_reason === "NOT_PRESENT" ? "auto_confirmed" : "needs_review"}`);
    if (f.na_reason === "NOT_PRESENT") check(f.source_page === null, `${tag}: NOT_PRESENT cites a page`);
    else check(f.source_page === null || inBox(f.source_line_coords), `${tag}: absence evidence box out of range`);
  } else {
    check(f.readings.length >= 1, `${tag}: no NA reason and no reading`);
    check(Number.isInteger(f.source_page), `${tag}: no source_page`);
    check(typeof f.source_snippet === "string" && f.source_snippet.length > 0, `${tag}: no source_snippet`);
    check(inBox(f.source_line_coords), `${tag}: source_line_coords missing or out of range`);
    check(f.source_line_coords?.page === f.source_page, `${tag}: box page ≠ source_page`);
    const [a, b] = f.readings;
    const agree = f.readings.length === 2 && canon(a.value ?? "") === canon(b.value ?? "");
    /* The stated value is always the primary reader's reading, corroborated or
       not: it was extracted off a named page and box, and `state` — not a
       withheld value — is what says nobody has ruled on it yet. A null value
       with a null na_reason means "not yet extracted", which is false of any
       field that carries a reading. */
    check(f.value === a.value, `${tag}: stated value is not the primary reader's reading`);
    if (f.readings.length === 2 && !agree) check(f.state === "needs_review", `${tag}: readers disagree but state is ${f.state}`);
    if (f.readings.length < 2) check(f.state === "needs_review", `${tag}: single reader but state is ${f.state}`);
    check(f.engine_id === a.engine_id, `${tag}: engine_id does not follow the stated reading`);
  }
  if (f.section === "judgments") check(f.state === "needs_review", `${tag}: a judgment field is ${f.state}`);
  if (f.rule_refs.some((r) => r.startsWith("T1-"))) check(f.state === "needs_review", `${tag}: T1 field is ${f.state}`);
  if (f.state === "auto_confirmed") {
    check(f.source_page === null || !degraded.has(f.source_page), `${tag}: auto_confirmed on degraded p${f.source_page}`);
    check(f.asking === null && f.why === null && f.consequence === null, `${tag}: auto_confirmed carries review prose`);
    check(f.routed_because === null || f.routed_because === undefined, `${tag}: auto_confirmed carries routed_because`);
  }
  if (f.state === "needs_review") {
    check(typeof f.asking === "string" && f.asking.length > 0, `${tag}: needs_review without asking`);
    check(typeof f.why === "string" && f.why.length > 0, `${tag}: needs_review without why`);
    check(typeof f.routed_because === "string" && f.routed_because.length > 0, `${tag}: needs_review without routed_because`);
  }
}

// ---- composition --------------------------------------------------------------------

const byId = new Map(fields.map((f) => [f.id, f]));
const placed = new Map();
blocks.forEach((b, i) => {
  check(typeof b.id === "string" && typeof b.numeral === "string" && typeof b.title === "string", `blocks[${i}]: id/numeral/title missing`);
  check(Array.isArray(b.values) && b.values.length > 0, `${b.id}: no rows (a block with zero rows is omitted)`);
  check(b.field_count === b.values.length, `${b.id}: field_count ${b.field_count} ≠ ${b.values.length} rows`);
  let cited = 0;
  for (const v of b.values) {
    check(typeof v.label === "string" && typeof v.value === "string" && typeof v.pending === "boolean", `${b.id}: malformed row ${JSON.stringify(v).slice(0, 60)}`);
    check(!chrome(v.value), `${b.id}: chrome or markup in row value`);
    if (v.field_id !== null) {
      const f = byId.get(v.field_id);
      check(f !== undefined, `${b.id}: field_id ${v.field_id} does not resolve`);
      check(!placed.has(v.field_id), `${b.id}: ${v.field_id} placed twice`);
      placed.set(v.field_id, b.id);
      if (f !== undefined && f.source_page !== null) cited++;
    }
  }
  check(b.cited === cited, `${b.id}: cited ${b.cited} ≠ ${cited} rows with a source page`);
});
for (const f of fields) check(placed.has(f.id), `${f.path}: no composition row`);

// ---- report / pipeline / timeline -------------------------------------------------------

check(typeof bundle.report?.href === "string" && bundle.report.href.length > 0, "report.href missing");
check(typeof bundle.report?.bytes === "number" && typeof bundle.report?.sha256 === "string", "report.bytes/sha256 malformed");
check(bundle.report.bytes === 0 ? bundle.report.sha256 === "" : /^[0-9a-f]{64}$/.test(bundle.report.sha256), "report: bytes and sha256 disagree about whether a file was rendered");
const citedPages = new Set(fields.map((f) => f.source_page).filter((n) => n !== null));
check(bundle.pipeline?.pages_relevant === citedPages.size, `pipeline.pages_relevant ${bundle.pipeline?.pages_relevant} ≠ ${citedPages.size} cited pages`);
check(Array.isArray(bundle.pipeline?.run_log) && bundle.pipeline.run_log.every((l) => typeof l.time === "string" && typeof l.text === "string" && typeof l.warn === "boolean" && typeof l.strong === "boolean"), "pipeline.run_log malformed");
check(Array.isArray(bundle.pipeline?.verified_checks) && bundle.pipeline.verified_checks.every((s) => typeof s === "string"), "pipeline.verified_checks malformed");
check(!/\b(?:per hour|pages\/h|pg\/hr|per minute|throughput)\b/i.test(JSON.stringify(bundle.pipeline)), "pipeline prose carries a throughput unit");
check(Array.isArray(bundle.timeline) && bundle.timeline.every((t) => typeof t.kind === "string" && typeof t.label === "string" && typeof t.attend === "boolean"), "timeline malformed");
check(Array.isArray(bundle.quarantine?.optical) && bundle.quarantine.optical.every((o) => typeof o.id === "string" && typeof o.value === "string" && typeof o.ok === "boolean"), "quarantine.optical malformed");

// ---- summary --------------------------------------------------------------------------

const tally = (xs, key) => {
  const m = new Map();
  for (const x of xs) {
    const k = key(x);
    if (k === null || k === undefined) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k}=${v}`).join("  ");
};
console.log(`bundle ${PATH}`);
console.log(`  ${statSync(PATH).size} B · ${pages.length} pages (${degraded.size} degraded) · ${instruments.length} instruments · ${fields.length} fields · ${blocks.length} blocks · ${citedPages.size} pages cited`);
console.log(`  by state:          ${tally(fields, (f) => f.state)}`);
console.log(`  by section:        ${tally(fields, (f) => f.section)}`);
console.log(`  by routed_because: ${tally(fields, (f) => f.routed_because)}`);
console.log(`  NA by reason:      ${tally(fields, (f) => f.na_reason) || "none"}`);
console.log(`  readings:          two=${fields.filter((f) => f.readings.length === 2).length}  one=${fields.filter((f) => f.readings.length === 1).length}  none=${fields.filter((f) => f.readings.length === 0).length}`);
console.log(`  report:            ${bundle.report.bytes} B ${bundle.report.sha256 === "" ? "(not rendered)" : `sha256 ${bundle.report.sha256.slice(0, 12)}…`}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("  ✓ all checks passed");

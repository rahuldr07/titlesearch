import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RUN = process.argv[2];
const PASS = join(RUN, "passes", "unlimited-ocr");
const job = JSON.parse(readFileSync(join(RUN, "job.json"), "utf8"));
/*
 * The blocks' bboxes are in the reader's own raster space, and that raster is
 * SQUARE — 1000x1000 — not the page's aspect. `job.profile` reports 595x842
 * points, which is a different space again.
 *
 * Three normalisations were tried and checked against the page image at 200%:
 *   595 x 842   — every box ~1.5 lines LOW (p1 "VESTING" landed on GRANTEE)
 *   1000 x 1415 — every box ~1 line HIGH (p1 "VENDOR" landed on the header)
 *   1000 x 1000 — exact, verified on p1 VENDOR, p1 VESTING and p2 MORTGAGEE
 *
 * x and y do not share a scale factor, which is what rules out both
 * aspect-preserving options: max x across all pages reaches 974 while the
 * y evidence lands near 1000 on a portrait page.
 */
const RASTER_W = 1000;
const size = new Map(job.profile.map((p) => [p.page, { w: RASTER_W, h: RASTER_W }]));

const pages = [];
const boxes = {};
for (let n = 1; n <= job.pages; n++) {
  const f = join(PASS, `page_${String(n).padStart(4, "0")}.blocks.json`);
  if (!existsSync(f)) continue;
  const blocks = JSON.parse(readFileSync(f, "utf8"));
  if (!Array.isArray(blocks) || blocks.length === 0) continue;
  const dim = size.get(n) ?? { w: 595, h: 842 };
  const lines = blocks.map((b) => String(b.text ?? "").trim()).filter((t) => t.length > 0);
  const head = blocks.find((b) => b.type === "header" && String(b.text ?? "").trim().length > 3);
  pages.push({
    n,
    read_in_full: true,
    kind: (job.sections?.[String(n)] || head?.text || `PAGE ${n}`).toString().toUpperCase().slice(0, 60),
    lines,
    degraded: false,
    image_url: `/scan/page_${String(n).padStart(4, "0")}.png`,
  });
  boxes[n] = blocks
    .filter((b) => Array.isArray(b.bbox) && b.bbox.length === 4)
    .map((b) => ({
      text: String(b.text ?? ""),
      type: String(b.type ?? "text"),
      x: +(b.bbox[0] / dim.w).toFixed(4),
      y: +(b.bbox[1] / dim.h).toFixed(4),
      w: +((b.bbox[2] - b.bbox[0]) / dim.w).toFixed(4),
      h: +((b.bbox[3] - b.bbox[1]) / dim.h).toFixed(4),
    }))
    .filter((b) => b.w > 0 && b.h > 0 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1 && b.y + b.h <= 1);
}

const KIND = (label) =>
  /^TAX/.test(label) ? "tax_card"
  : /^MTG/.test(label) ? "security_deed"
  : /^MAP/.test(label) ? "plat"
  : /^NS/.test(label) ? "name_search"
  : label === "" ? "cover"
  : "instrument";

const instruments = [];
let run = null;
for (let n = 1; n <= job.pages; n++) {
  const label = (job.sections?.[String(n)] ?? "").toString();
  if (run !== null && run.label === label) { run.last_page = n; continue; }
  if (run !== null) instruments.push(run);
  run = { label, first_page: n, last_page: n };
}
if (run !== null) instruments.push(run);

const out = {
  source: job.name,
  total: job.pages,
  pages,
  instruments: instruments.map((r, i) => ({
    id: `ins_real_${i + 1}`,
    kind: KIND(r.label),
    label: r.label === "" ? "Search package cover & certification" : r.label,
    first_page: r.first_page,
    last_page: r.last_page,
    recorded_ref: /^MTG (\d+)/.exec(r.label)?.[1] ?? null,
  })),
  boxes,
};
writeFileSync(process.argv[3], JSON.stringify(out));
console.error(`pages with text: ${pages.length}/${job.pages}  instruments: ${out.instruments.length}  boxed pages: ${Object.keys(boxes).length}`);

const LABEL = /^([A-Z][A-Z0-9 /&.'-]{2,34}?)\s*#?\s*:\s*(.+)$/;

/*
 * A colon does not make a field. The scan carries form copyright footers
 * ("© 1985 ... Form OCP-REEDT-MO") and, on the vendor-portal pages, web
 * furniture ("NEXT:", "ADD TO SHOPPING CART:") — all of which matched the
 * label pattern and were being published on a title report as readings.
 */
const JUNK = /©|\bInc\.|\bForm [A-Z0-9-]{4,}|SHOPPING|CART|https?:|www\.|\.com\b/i;
const JUNK_LABEL = /^(NEXT|ADD TO|EXPERT|BACK|PRINT|HELP|HOME|SEARCH AGAIN)$/i;
const seen = new Map();
const fields = [];
/*
 * The document's own headings. A `header`/`title` block that is NOT itself a
 * labelled reading ("CURRENT VESTING DEED INFORMATION", "ASSESSMENT") is what
 * the recorder printed as a section, so the report follows those rather than
 * inventing a taxonomy — or dumping 57 readings under one instrument.
 */
let section = null;
for (const page of out.pages) {
  const boxed = out.boxes[page.n] ?? [];
  for (const b of boxed) {
    const heading =
      (b.type === "header" || b.type === "title") && !LABEL.test(b.text.trim());
    if (heading && b.text.trim().length > 6 && !JUNK.test(b.text)) {
      section = b.text.trim();
      continue;
    }
    const m = LABEL.exec(b.text.trim());
    if (m === null) continue;
    const value = m[2].trim();
    if (value.length < 2 || value.length > 120) continue;
    const rawLabel = m[1].trim();
    if (JUNK.test(value) || JUNK.test(rawLabel) || JUNK_LABEL.test(rawLabel)) continue;
    const key = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (key.length < 3) continue;
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    if (nth > 3) continue;
    fields.push({
      id: `fld_real_${fields.length + 1}`,
      path: nth === 1 ? `package.${key}` : `package.${nth}.${key}`,
      value,
      na_reason: null,
      state: "auto_confirmed",
      source_doc_id: "doc_real",
      source_page: page.n,
      source_snippet: b.text.trim(),
      source_line_coords: { page: page.n, x: b.x, y: b.y, w: b.w, h: b.h },
      engine_id: "unlimited-ocr",
      engine_confidence_raw: null,
      rule_refs: [],
      approved_by: null,
      approved_at: null,
      section,
    });
  }
}
out.fields = fields;
writeFileSync(process.argv[3], JSON.stringify(out));
console.error(`fields: ${fields.length}`);

/*
 * COMPOSITION — a title report, not a dump of readings.
 *
 * The previous pass grouped raw `LABEL: value` pairs under whatever heading
 * the scan printed above them and called it a report. A title report has its
 * own sections, and a reading belongs to one of them regardless of where on
 * the page it was printed.
 *
 * Two rules hold throughout:
 *   - Nothing is invented. Every row is a reading with a page and a region;
 *     a standard row with no reading is stated as absent, never filled in.
 *   - Nothing is silently dropped. A reading this mapping does not place
 *     lands in the final section rather than disappearing.
 */

/*
 * Entries within a section. The boundary is a NAMED anchor — the label that
 * opens each instrument — not "any repeated label": the vesting block states
 * VESTING twice for one deed, and splitting on that tore a single deed into
 * two half-entries and pushed its dates, book/page and address into the
 * unplaced pile. `anchor` null means the section holds exactly one entry.
 *
 * This also replaces the old global "nth occurrence of this label" index,
 * under which `3.amount` was a JUDGMENT amount sitting among the mortgages.
 */
const entriesOf = (sectionName, anchor = null) => {
  const rows = fields.filter((f) => f.section === sectionName);
  const key = (f) => f.path.replace(/^package\.(\d+\.)?/, "");
  if (anchor === null) {
    const one = new Map();
    for (const f of rows) if (!one.has(key(f))) one.set(key(f), f);
    return rows.length === 0 ? [] : [one];
  }
  const entries = [];
  let cur = null;
  for (const f of rows) {
    if (key(f) === anchor || cur === null) {
      cur = new Map();
      entries.push(cur);
    }
    if (!cur.has(key(f))) cur.set(key(f), f);
  }
  return entries;
};

const used = new Set();
/** One report row from a reading. Absent when the package never stated it. */
const take = (entry, key, label) => {
  const f = entry?.get(key);
  if (f === undefined) return { label, value: "— not stated in the package", pending: false, field_id: null };
  used.add(f.id);
  return { label, value: f.value, pending: false, field_id: null };
};
/** Only if present — for rows that are optional rather than expected. */
const maybe = (entry, key, label) => {
  const f = entry?.get(key);
  if (f === undefined) return null;
  used.add(f.id);
  return { label, value: f.value, pending: false, field_id: null };
};

const header = entriesOf("ABSTRACTOR CALL BACK SHEET")[0];
const vest = entriesOf("CURRENT VESTING DEED INFORMATION")[0];
const prior = entriesOf("PRIOR DEED")[0];
const mortgages = entriesOf("DEED OF TRUST", "mortgagor");
const judgments = entriesOf("JUDGMENTS/LIENS", "type");

const sections = [];

sections.push({
  title: "Header information",
  values: [
    take(header, "order", "Order number"),
    take(header, "vendor", "Vendor"),
    take(header, "search_date", "Search date"),
    take(header, "effective_date", "Effective date"),
  ],
});

sections.push({
  title: "Property identification",
  values: [
    take(vest, "location", "Situs address"),
    take(vest, "city_twp_boro", "City / township"),
    take(vest, "county_parish", "County"),
    take(vest, "zip_code", "ZIP"),
    take(vest, "fee_simple_leasehold", "Estate"),
  ],
});

sections.push({
  title: "Vesting & title chain",
  values: [
    take(vest, "deed_type", "Current deed type"),
    take(vest, "grantor", "Grantor of record"),
    take(vest, "vesting", "Vesting"),
    take(vest, "dated", "Dated"),
    take(vest, "recorded", "Recorded"),
    take(vest, "book_page", "Book / page"),
    take(vest, "inst", "Instrument no."),
    take(vest, "cons", "Consideration"),
    take(prior, "deed_type", "Prior deed type"),
    take(prior, "grantor", "Prior grantor"),
    take(prior, "grantee", "Prior grantee"),
    take(prior, "cons", "Prior consideration"),
    maybe(prior, "conveys", "Prior deed conveys 100%"),
  ].filter((v) => v !== null),
});

sections.push({
  title: "Encumbrances & open liens",
  values: mortgages.flatMap((m, i) => {
    const n = i + 1;
    return [
      take(m, "inst", `${String(n)} · Instrument no.`),
      take(m, "mortgagor", `${String(n)} · Mortgagor`),
      maybe(m, "mortgagee", `${String(n)} · Mortgagee`) ??
        take(m, "lender_grantee", `${String(n)} · Mortgagee`),
      take(m, "trustee", `${String(n)} · Trustee`),
      take(m, "amount", `${String(n)} · Amount`),
      take(m, "dated", `${String(n)} · Dated`),
      take(m, "recorded", `${String(n)} · Recorded`),
      take(m, "book_page", `${String(n)} · Book / page`),
      take(m, "open_ended_yes_no", `${String(n)} · Open-ended`),
      maybe(m, "min", `${String(n)} · MERS MIN`),
    ].filter((v) => v !== null);
  }),
});

sections.push({
  title: "Judgments & general liens",
  values: judgments.flatMap((j, i) => {
    const n = i + 1;
    return [
      take(j, "case_no", `${String(n)} · Case no.`),
      take(j, "type", `${String(n)} · Type`),
      take(j, "plaintiff", `${String(n)} · Plaintiff`),
      take(j, "defendant", `${String(n)} · Defendant`),
      take(j, "filed", `${String(n)} · Filed`),
      take(j, "amount", `${String(n)} · Amount`),
      take(j, "plaintiff_attorney", `${String(n)} · Plaintiff attorney`),
    ].filter((v) => v !== null);
  }),
});

const leftovers = fields.filter((f) => !used.has(f.id));
if (leftovers.length > 0) {
  sections.push({
    title: "Other readings, unplaced",
    /* The label keeps its occurrence index. Stripping it collided —
       `vesting` and `2.vesting` both became "vesting", and the sheet keys
       rows by block+label, so React saw two `rb6-vesting` and was free to
       drop one. A reading silently missing from a title report is the
       failure this whole screen exists to prevent. */
    values: leftovers.map((f) => {
      const raw = f.path.replace(/^package\./, "");
      const m = /^(\d+)\.(.+)$/.exec(raw);
      return {
        label:
          m === null
            ? raw.replace(/_/g, " ")
            : `${m[2].replace(/_/g, " ")} (${m[1]})`,
        value: f.value,
        pending: false,
        field_id: null,
      };
    }),
  });
}

const NUMERALS = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
out.composition = {
  blocks: sections.map((sec, i) => ({
    id: `rb${i + 1}`,
    numeral: NUMERALS[i] ?? String(i + 1),
    title: sec.title,
    values: sec.values,
    field_count: sec.values.length,
    /* Cited = rows backed by a reading. The "not stated" rows are not. */
    cited: sec.values.filter((v) => !v.value.startsWith("— not stated")).length,
  })),
};
writeFileSync(process.argv[3], JSON.stringify(out));
console.error(`report sections: ${out.composition.blocks.length}, unplaced: ${leftovers.length}`);

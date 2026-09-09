#!/usr/bin/env node
/*
 * anonymise-bundle.mjs — a real county package's SHAPE, with none of its people.
 *
 *   node anonymise-bundle.mjs [<in.json>] [<out.json>]
 *
 * WHY THIS EXISTS. The mock is worth reading in proportion to how real the
 * package behind it is: 112 fields over 101 pages, two readers disagreeing on
 * a grantor, judgments that never auto-confirm, four kinds of typed absence,
 * degraded scans. The synthetic sample bundle has the same members and none of
 * that texture. But the package it all comes from names living people — the
 * owners, THIRD PARTIES whose judgments the index happens to list, the
 * recorder, the law firm — with their address and parcel, and this repository
 * is public (CONTEXT §19; `CLAUDE.md`: county packages never enter VCS).
 *
 * So the structure is kept and the content is replaced: every party, place,
 * instrument number, book/page, case number, parcel and institution is
 * rewritten to an invented one, everywhere it appears — values, snippets,
 * excerpts, page text, composition rows, timeline, quarantine notes.
 *
 * WHAT MAKES IT SAFE IS THE CHECK, NOT THE MAP. A substitution list is only as
 * good as its author's memory, so this script does not trust it: after
 * rewriting it walks every string in the output and fails on any surviving
 * token from the source's identifier set, and prints every person-shaped
 * sequence that is left so a human can read the residue before anything is
 * staged. A run that cannot prove the output is clean writes nothing.
 *
 * WHAT IS DELIBERATELY DROPPED. `image_url` — the rasters are the real scanned
 * pages and no substitution reaches into a PNG, so the mock renders as text.
 * The `sha256` and the OCR `job` go too: the mock is not those bytes and must
 * not claim to be, and a `/scan/<job>/` href would point back at the originals.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_IN = join(HERE, "..", "src", "bundles", "final-package-lincoln-mo.json");
const DEFAULT_OUT = join(HERE, "..", "src", "bundles", "mock-package-brayton-mo.json");
const SLUG = "mock-package-brayton-mo";

const argv = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const IN = resolve(argv[0] ?? DEFAULT_IN);
const OUT = resolve(argv[1] ?? DEFAULT_OUT);

const fail = (msg) => {
  console.error(`anonymise-bundle: ${msg}`);
  process.exit(1);
};

/* ── the substitutions ──────────────────────────────────────────────────────
 *
 * ORDER MATTERS: longest first, so a full name is consumed before its surname
 * and a hyphenated married name before either half. Each entry is applied
 * case-insensitively and the replacement follows the source's case, because
 * the package writes the same name as `MARJORIE L MOYER`, `Marjorie L. Moyer`
 * and `Moyer` on different pages and all three have to land on one invented
 * person or the chain stops making sense.
 */
const NAMES = [
  // The owners and every form the package writes them in.
  ["Marjorie Lynn Moyer-Lockhart", "Rosalind Claire Ashgrove-Peveril"],
  ["Marjorie L. Moyer-Lockhart", "Rosalind C. Ashgrove-Peveril"],
  ["Marjorie L Moyer-Lockhart", "Rosalind C Ashgrove-Peveril"],
  ["Moyer-Lockhart", "Ashgrove-Peveril"],
  ["Marjorie Lynn Moyer", "Rosalind Claire Ashgrove"],
  ["Marjorie L. Moyer", "Rosalind C. Ashgrove"],
  ["Marjorie L Moyer", "Rosalind C Ashgrove"],
  ["Charles F. Lockhart, III", "Everett J. Peveril, III"],
  ["Charles F. Lockhart", "Everett J. Peveril"],
  ["Charles F Lockhart", "Everett J Peveril"],
  ["Marjorie", "Rosalind"],
  ["Lockhart", "Peveril"],
  // The two readers disagree on this surname — the A≠B the review screen
  // shows. The disagreement has to survive, so B's misread maps to a misread
  // of the invented name with the same shape (one letter, mid-word).
  ["MOIER", "ASHGROVL"],
  ["Moier", "Ashgrovl"],
  ["Moyer", "Ashgrove"],
  // Prior owners in the chain.
  ["Joseph D. Long, Jr.", "Wendell T. Harbrace, Jr."],
  ["Joseph D. Long", "Wendell T. Harbrace"],
  ["Clifford A. Long", "Nathan A. Harbrace"],
  ["Long Family Trust", "Harbrace Family Trust"],
  // Third parties the judgment index lists — not the subject of the search,
  // and the reason a rename of the file would not have been enough.
  ["Mennemeyer, Christina", "Oakleigh, Prudence"],
  ["Christina Mennemeyer", "Prudence Oakleigh"],
  ["Mennemeyer", "Oakleigh"],
  ["Kisling, Michael S", "Thackery, Rupert S"],
  ["Michael S. Kisling", "Rupert S. Thackery"],
  ["Kisling", "Thackery"],
  // Officials and firms.
  ["Dottie D. Crenshaw", "Marguerite V. Dunhollow"],
  ["Crenshaw", "Dunhollow"],
  ["Mense Law Firm LLC", "Aldergate Law Office LLC"],
  ["Mense", "Aldergate"],
  ["Martin, Recorder", "Dunhollow, Recorder"],
  // Institutions.
  ["Pulaski Service Corp", "Cairnwell Service Corp"],
  ["Pulaski Bank", "Cairnwell Bank"],
  ["Pulaski", "Cairnwell"],
  ["Freedom Mortgage Corporation", "Harrowgate Mortgage Corporation"],
  ["Freedom Mortgage", "Harrowgate Mortgage"],
  ["Wells Fargo Bank, N.A.", "Stonebridge Bank, N.A."],
  ["Wells Fargo", "Stonebridge"],
];

const PLACES = [
  ["Lincoln County", "Brayton County"],
  ["Lincoln Co", "Brayton Co"],
  ["Lincoln", "Brayton"],
  ["235 Mound Street", "418 Larkspur Street"],
  ["235 Mound St", "418 Larkspur St"],
  ["Mound Street", "Larkspur Street"],
  ["Mound St", "Larkspur St"],
  ["94 Homestead Lane", "27 Corriden Lane"],
  ["94 Homestead Ln", "27 Corriden Ln"],
  ["Homestead Lane", "Corriden Lane"],
  ["Homestead Ln", "Corriden Ln"],
  ["Woolfolk", "Kentmere"],
  ["Wieman", "Halloway"],
  ["Evangelical Church of Troy", "Meridian Chapel of Brayton"],
  ["Troy", "Brayton"],
  ["63379-1316", "65042-1180"],
  ["63379", "65042"],
];

/*
 * Numbers. Every one is an index into a public record — an instrument number,
 * a book and page, a case, a parcel — so each maps to an invented one of the
 * same shape, which is what keeps the sheet's cross-references consistent.
 */
const NUMBERS = [
  ["11116297", "40883514"],
  ["2019002279", "2019004417"],
  ["2006011031", "2006013620"],
  ["2006011032", "2006013621"],
  ["2007000943", "2007002285"],
  ["20190002143", "20190004402"],
  ["2432", "3714"],
  ["1882", "2905"],
  ["1917", "2948"],
  ["14L6-MC00063", "22B4-MC00147"],
  ["16L6-MC00716", "24B4-MC00382"],
  ["14L6", "22B4"],
  ["16L6", "24B4"],
  ["15-70-26-001-012-024.001", "08-41-19-004-027-115.002"],
  ["157026001012024001", "084119004027115002"],
  ["15-70-26-001-012-024", "08-41-19-004-027-115"],
  ["45th Judicial Circuit", "31st Judicial Circuit"],
  ["45th", "31st"],
];

const RULES = [...NAMES, ...PLACES, ...NUMBERS];

/*
 * ── the sweep ──────────────────────────────────────────────────────────────
 *
 * The list above is a DENYLIST, and the first run of this script proved a
 * denylist is not enough: it came back clean of every name its author knew and
 * the residue report still held `CHRISTINA A. PASEL`, `MICHAEL SHAYNE
 * THACKERY`, `Tracy K. Martin, Recorder of Deeds` and `Dottie O. Crenehaw` —
 * three people nobody had noticed were in the package, and one OCR misreading
 * of a name that WAS on the list. 101 pages of noisy OCR will always hold a
 * name the author did not think of, so the rule is inverted here: a
 * capitalised token survives only if it is RECOGNISED, and everything else is
 * replaced whether or not anyone knew it was a name.
 *
 * `KEEP` is therefore the vocabulary of a recorded instrument — the words a
 * deed, a deed of trust, a tax bill and a docket are made of — plus the names
 * this script itself invents. It is allowed to be over-inclusive of ordinary
 * words and must never hold a proper noun from a real package.
 */
const KEEP = new Set(
  `A AB ABOVE ABSTRACT ACC ACCELERATION ACCESS ACCOUNT ACKNOWLEDGMENT ACRE ACRES ACTING ACTION
   ADD ADDENDUM ADDITION ADDITIONAL ADDRESS ADJUSTABLE ADOPTION ADVANCES AFFIDAVIT AFTER AGENT
   AGREEMENT AGRICULTURAL ALL ALSO AMENDED AMENDMENT AMENDMENTS AMERICA AMOUNT AN AND ANNUAL ANY
   APPEAL APPLICABLE APPLICANT APPLICATION APPRAISED APPROVAL APRIL ARE AREA AS ASSEMBLY ASSESSED
   ASSESSMENT ASSIGNED ASSIGNMENT ASSIGNMENTS ASSIGNS AT ATTACHED ATTORNEY ATTORNEYS AUGUST
   AUTHORITY AVE AVENUE BALANCE BANK BARGAIN BASE BE BEARING BEEN BEFORE BEGINNING BELOW BENEFICIARY
   BILL BLOCK BLOCKS BOOK BORO BORROWER BOUNDS BUILDING BY CASE CASH CAUSE CENTERLINE CERT
   CERTIFICATE CERTIFY CHARGES CHAPEL CIRCUIT CITY CIVIL CLAIM CLERK CLOSING CODE COLLECTOR COMMON
   CONDITIONS CONSIDERATION CONTAINING CONTINUATION CONVEY CONVEYED CONVEYS CORNER CORP CORPORATION
   COUNTY COURT COVENANTS CREDIT CREDITOR CURRENT DATE DATED DAY DEBT DECEMBER DECLARATION DEED
   DEEDS DEFENDANT DEG DEGREE DEGREES DELINQUENT DEPARTMENT DESCRIBED DESCRIPTION DISPOSITION
   DISTRICT DIVISION DIVISIONS DOCUMENT DOLLARS DUE EAST EASEMENTS ELECTRONIC ENTERED ESTATE
   EXECUTED EXHIBIT EXPIRES FEBRUARY FEE FEES FEET FILE FILED FILING FINAL FIRST FOLLOWING FOR
   FROM FULL GENERAL GRANT GRANTEE GRANTEES GRANTOR GRANTORS HAVING HEREBY HEREIN HEREINAFTER
   HIGHWAY HIS HUNDRED HUSBAND ID IDENTIFIER IMPROVEMENTS IN INC INCLUDING INDEX
   INSTRUMENT INTEREST INTERSECTION IRON IS JANUARY JR JUDGMENT JUDICIAL JULY JUNE LAND LAW LEGAL
   LENDER LIEN LIENS LINE LIVING LLC LOAN LOT LOTS MADE MAIL MAILING MARCH MATURITY MAX MAY MERS
   MODIFICATION MODIFICATIONS MORE MORTGAGE MORTGAGEE MORTGAGOR N NA NAME NO NOMINEE NORTH NOT
   NOTARY NOTE NOTICE NOVEMBER NUMBER OCTOBER OF OFFICE ON OPEN OPTION OR ORDER OTHER OWNER PAGE
   PAGES PAID PARALLEL PARCEL PARTIES PARTY PAYMENT PENDING PERSON PETITIONER PLACE PLAT PM POST
   PRINCIPAL PROPERTY PUBLIC PURCHASE QUIT RANGE REAL RECEIPT RECEIVED RECORD RECORDED RECORDER
   RECORDING RECORDS REFERENCE REGISTRATION RELEASE REPORT RESPONDENT RESULT RESULTS RETURN REVENUE
   RIGHT ROAD SAID SALE SATISFACTION SATISFIED SCHOOL SEAL SEARCH SECTION SECURED SECURITY SEE
   SEPTEMBER SERVICE SHOPPING SINGLE SITUATED SOUTH SOUTHWEST ST STATE STATUS STE STONE STREET
   SUBDIVISION SUCCESSORS SUCH SUM SURVEY SYSTEMS TAX TAXES TERMS THAN THE THENCE THEREON THERETO
   THEREOF THESE THIS THOSE TO TOGETHER TOWNSHIP TRACT TRUST TRUSTEE TRUSTEES TYPE UCC UNDER
   UNIT UNTO VALUABLE VS WARRANTY WEST WHICH WIFE WITH WITNESSETH WITNESS YEAR`
    .split(/\s+/)
    .filter(Boolean),
);

/** Deterministic surrogates: one unknown token always becomes the same word,
    so a name the sweep never recognised still reads as one person. */
const SURROGATE_STEMS = [
  "Belmont", "Carrow", "Dunmore", "Eastleigh", "Falkbury", "Gorsemere", "Hensley", "Ilbury",
  "Jarrow", "Kelbrook", "Lyndhurst", "Marchwood", "Netherby", "Ossington", "Pellstone",
  "Quenby", "Rushmere", "Sandvale", "Thurlow", "Underhill", "Vellacourt", "Wexbury", "Yarrow",
  "Ambleside", "Brackwell", "Corbridge", "Denholm", "Elmsworth", "Fenwick", "Garrowby",
];
const surrogates = new Map();
function surrogate(token) {
  const held = surrogates.get(token.toUpperCase());
  if (held !== undefined) return cased(token, held);
  let h = 0;
  for (const ch of token.toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  const stem = SURROGATE_STEMS[h % SURROGATE_STEMS.length] ?? "Belmont";
  const word = surrogates.size % 2 === 0 ? stem : `${stem}ford`;
  surrogates.set(token.toUpperCase(), word);
  return cased(token, word);
}

/** Numbers long enough to be an index into a record, that the map did not
    already claim. Years and measurements stay — they carry no identity. */
const swept = new Map();
function sweepNumbers(text) {
  return text.replace(/\b\d{5,}\b/g, (n) => {
    const held = swept.get(n);
    if (held !== undefined) return held;
    let h = 0;
    for (const ch of n) h = (h * 37 + ch.charCodeAt(0)) % 1000000007;
    const made = String(h).padStart(n.length, "4").slice(0, n.length);
    swept.set(n, made);
    return made;
  });
}

function sweepWords(text) {
  return text.replace(/\b[A-Z][A-Za-z']{1,}\b/g, (word) => {
    if (KEEP.has(word.toUpperCase())) return word;
    if (INVENTED.has(word.toUpperCase())) return word;
    return surrogate(word);
  });
}

/** Every word this script itself introduces — the sweep must not eat its own
    replacements on the way past. */
const INVENTED = new Set(
  RULES.flatMap(([, to]) => to.match(/[A-Za-z']+/g) ?? []).map((w) => w.toUpperCase()),
);

/** Case-following replacement: ALL CAPS in, ALL CAPS out. */
function cased(source, replacement) {
  if (source === source.toUpperCase() && /[A-Z]/.test(source)) return replacement.toUpperCase();
  if (source === source.toLowerCase() && /[a-z]/.test(source)) return replacement.toLowerCase();
  return replacement;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const COMPILED = RULES.map(([from, to]) => [new RegExp(escape(from), "gi"), to]);

function rewrite(text) {
  let out = text;
  for (const [re, to] of COMPILED) out = out.replace(re, (m) => cased(m, to));
  // Then the sweep, which does not need to know what it is looking at.
  out = sweepWords(out);
  return sweepNumbers(out);
}

/** Deep-walk every string in the document. Keys are structure, not content. */
function walk(node, onString) {
  if (typeof node === "string") return onString(node);
  if (Array.isArray(node)) return node.map((v) => walk(v, onString));
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, onString)]));
  }
  return node;
}

function strings(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const v of node) strings(v, out);
  else if (node !== null && typeof node === "object") for (const v of Object.values(node)) strings(v, out);
  return out;
}

// ---- run ---------------------------------------------------------------------------------

const raw = JSON.parse(readFileSync(IN, "utf8"));
if (!Array.isArray(raw.fields) || raw.fields.length === 0) {
  fail(`${IN} is the empty placeholder — populate it first with build-package-bundle.mjs`);
}

const mock = walk(raw, rewrite);

/*
 * The three members that are about the BYTES rather than their content. A mock
 * is not the package it was shaped from and must not carry its identity: the
 * digest is recomputed over the mock itself, the OCR job is dropped, and with
 * it every `/scan/<job>/` href that would resolve to the real scans. The page
 * rasters go for the same reason — no substitution reaches inside a PNG.
 */
mock.slug = SLUG;
mock.job = `mock_${SLUG.replace(/-/g, "_")}`;
mock.source = { ...mock.source, filename: "mock_package_brayton.pdf" };
mock.pages = mock.pages.map((p) => ({ ...p, image_url: null }));
mock.report = { ...mock.report, filename: `${SLUG}-typed-search-report-v1.pdf`, bytes: 0, sha256: "", href: `/scan/${mock.job}/report-v1.pdf` };
mock.sha256 = createHash("sha256")
  .update(JSON.stringify({ ...mock, sha256: "" }))
  .digest("hex");

// ---- the check that makes it publishable -------------------------------------------------

const body = strings(mock);
const survivors = [];
for (const [from] of RULES) {
  const re = new RegExp(escape(from), "i");
  for (const s of body) {
    if (re.test(s)) {
      survivors.push({ token: from, in: s.slice(0, 120) });
      break;
    }
  }
}
if (survivors.length > 0) {
  console.error("REFUSING TO WRITE — source identifiers survived the rewrite:");
  for (const s of survivors) console.error(`  ${s.token} → ${JSON.stringify(s.in)}`);
  process.exit(1);
}

/*
 * The residue, for a person to read. Everything person-shaped left in the
 * output: if a name this map never knew about is in the package, it shows up
 * here and nowhere else. This is a report, not a gate — it cannot tell a party
 * from a legal formula, which is exactly why a human looks at it.
 */
const shaped = new Map();
for (const s of body) {
  for (const m of s.match(/\b[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\b/g) ?? []) {
    shaped.set(m, (shaped.get(m) ?? 0) + 1);
  }
  for (const m of s.match(/\b[A-Z][A-Za-z\-]+,\s+[A-Z][A-Za-z\-]+/g) ?? []) {
    shaped.set(m, (shaped.get(m) ?? 0) + 1);
  }
}

writeFileSync(OUT, `${JSON.stringify(mock, null, 2)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(mock));
console.error(`mock written to ${OUT} (${String(bytes)} B, ${String(mock.fields.length)} fields, ${String(mock.pages.length)} pages)`);
console.error(`  digest ${mock.sha256.slice(0, 16)}… computed over the mock, not over any package's bytes`);
console.error(`  ✓ none of the ${String(RULES.length)} source identifiers survives anywhere in it`);
console.error("");
console.error(`  ✓ the sweep replaced ${String(surrogates.size)} unrecognised capitalised tokens and ${String(swept.size)} long digit runs`);
console.error("");
console.error(`READ THIS BEFORE STAGING — every person-shaped sequence left in the file (${String(shaped.size)}).`);
console.error("Each one is built from KEEP or from this script's own invented names; anything else is a bug in the sweep:");
for (const [name, n] of [...shaped.entries()].sort((a, b) => b[1] - a[1])) {
  console.error(`  ${String(n).padStart(4)} ${name}`);
}
console.error("");
console.error(`What the sweep caught, source → surrogate (${String(surrogates.size)}):`);
for (const [from, to] of surrogates) console.error(`  ${from} → ${to}`);

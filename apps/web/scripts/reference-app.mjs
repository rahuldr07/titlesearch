/**
 * UNBUNDLE `reference-app.html` INTO A DIRECTORY A BROWSER CAN OPEN.
 *
 * The design export is one file with two payloads on two very long lines, and
 * neither is markup a browser will render as it stands:
 *
 *   line 370  a JSON asset map — `{ "<uuid>": { mime, compressed, data } }`,
 *             each `data` a base64 gzip blob: the app's JavaScript and its
 *             seven font families.
 *   line 382  a JSON *string* holding ~393 KB of the page's real HTML, which
 *             loads those assets by bare uuid (`<script src="270be24d-…">`).
 *
 * So the whole export is recoverable exactly: parse both lines, write the page
 * as `index.html` and every asset beside it under its own uuid, and the
 * relative `src` attributes resolve. No rewriting, no shimming — what boots is
 * the prototype, not an approximation of it.
 *
 * Writes OUTSIDE the working tree by default: the fonts alone are ~500 KB of
 * binary and this repository is public. `--out` takes an absolute path.
 *
 *   node scripts/reference-app.mjs --out /tmp/tp-reference
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const EXPORT =
  "docs/frontend/design-2026-08/reference-app.html";

/** The two payload lines, found by shape rather than by number — the export
 *  is regenerated from time to time and a hard-coded 370/382 would rot into a
 *  silent mis-parse rather than an error. */
function payloads(source) {
  let assets = null;
  let page = null;
  for (const line of source.split("\n")) {
    if (line.length < 4096) continue;
    const first = line[0];
    if (first === "{" && assets === null) assets = JSON.parse(line);
    else if (first === '"' && page === null) page = JSON.parse(line);
  }
  if (assets === null || page === null) {
    throw new Error(
      `${EXPORT}: expected one JSON object line (assets) and one JSON string ` +
        `line (page html). Found assets=${assets !== null}, page=${page !== null}.`,
    );
  }
  return { assets, page };
}

export function unbundle(repoRoot, outDir) {
  const source = readFileSync(join(repoRoot, EXPORT), "utf8");
  const { assets, page } = payloads(source);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), page, "utf8");

  const written = [];
  for (const [id, asset] of Object.entries(assets)) {
    const raw = Buffer.from(asset.data, "base64");
    const bytes = asset.compressed === true ? gunzipSync(raw) : raw;
    writeFileSync(join(outDir, id), bytes);
    written.push({ id, mime: asset.mime, bytes: bytes.length });
  }
  return { html: join(outDir, "index.html"), assets: written };
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith("reference-app.mjs");

if (invokedDirectly) {
  const flag = process.argv.indexOf("--out");
  if (flag === -1 || process.argv[flag + 1] === undefined) {
    console.error("usage: node scripts/reference-app.mjs --out <absolute-dir>");
    process.exit(2);
  }
  const out = resolve(process.argv[flag + 1]);
  const result = unbundle(resolve(import.meta.dirname, "../../.."), out);
  console.log(`page:   ${result.html}`);
  for (const a of result.assets) {
    console.log(`asset:  ${a.id}  ${a.mime}  ${a.bytes} bytes`);
  }
}

// Copy the version-pinned pdfjs worker into public/ so it is served from the
// site root (dev) and copied into dist (build). Kept out of VCS (gitignored) and
// re-synced on every dev/build, so it always matches the installed pdfjs-dist.
//
// Why not a bundler import: Vite 8's rolldown resolver rejects `?url`/`?worker`
// on node_modules paths, and `new URL("pdfjs-dist/...", import.meta.url)` never
// emits the file. Why not require.resolve of the deep subpath: pdfjs-dist v5 is
// ESM-only and its `exports` map blocks deep-subpath resolution. So we resolve
// the package's MAIN entry (which is exported and lives in build/) via
// import.meta.resolve — this honours pnpm's store layout — then take the worker
// from the same build/ directory.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mainUrl = import.meta.resolve("pdfjs-dist"); // e.g. .../pdfjs-dist/build/pdf.mjs
const src = join(dirname(fileURLToPath(mainUrl)), "pdf.worker.min.mjs");
if (!existsSync(src)) {
  throw new Error(`pdfjs worker not found at ${src}. Run 'pnpm install' first.`);
}

const destDir = join(here, "..", "public");
const dest = join(destDir, "pdf.worker.min.mjs");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`copied pdf worker: ${src} → ${dest}`);

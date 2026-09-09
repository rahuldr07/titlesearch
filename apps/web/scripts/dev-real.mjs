import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/*
 * `pnpm --filter @titlepipe/web dev:real` — the dev server with the real
 * packages' rasters and reports reachable.
 *
 * The Vite plugin that serves `/scan/<job>/…` reads `process.env`, not a
 * `.env` file (`loadEnv` only loads `VITE_*`), so without this wrapper every
 * developer sets two absolute paths by hand and the source-page pane falls
 * back to the text render without saying why. Both roots live OUTSIDE the
 * working tree, by the rule that county packages never enter VCS: the OCR
 * runs under `~/projects/ocr/runs/<job>/` and the generated reports under
 * `~/projects/titlepipe-data/reports/<job>/`. Override either with the same
 * variable name in the environment; an explicit value always wins.
 *
 * Refuses, by name, when a root is missing — a silently absent raster is
 * indistinguishable from a page the server never held.
 */
const home = homedir();
const runs = process.env["TITLEPIPE_SCAN_ROOT"] ?? join(home, "projects", "ocr", "runs");
/*
 * `ord_real_1` is the seeded order for the 104-page package, and its pages and
 * its certified artifact were written before the multi-package middleware
 * existed: they name `/scan/page_NNNN.png` and `/scan/package.pdf`, the
 * SINGLE-package addresses, which are served from `TITLEPIPE_SCAN_DIR` and
 * `TITLEPIPE_SCAN_PDF` and from nothing else. Setting only the two roots left
 * that order's source pane falling back to text and its "View" button
 * answering 404 — so this wrapper sets all four, and the one order that uses
 * the old addresses works like every order that uses the new ones.
 */
const legacyRun = join(runs, "web_1786595970_6ef37d");
const roots = {
  TITLEPIPE_SCAN_ROOT: runs,
  TITLEPIPE_REPORT_DIR:
    process.env["TITLEPIPE_REPORT_DIR"] ?? join(home, "projects", "titlepipe-data", "reports"),
  TITLEPIPE_SCAN_DIR: process.env["TITLEPIPE_SCAN_DIR"] ?? legacyRun,
  TITLEPIPE_SCAN_PDF: process.env["TITLEPIPE_SCAN_PDF"] ?? join(legacyRun, "source.pdf"),
};

const missing = Object.entries(roots).filter(([, dir]) => !existsSync(dir));
if (missing.length > 0) {
  for (const [name, dir] of missing) {
    process.stderr.write(`dev:real: ${name} points at ${dir}, which does not exist.\n`);
  }
  process.stderr.write(
    "Set the variable to the right path, or create it. The plain `dev` script runs without rasters.\n",
  );
  process.exit(2);
}

const extra = process.argv.slice(2);
const child = spawn("pnpm", ["exec", "vite", ...extra], {
  stdio: "inherit",
  env: { ...process.env, ...roots },
});
child.on("exit", (code) => process.exit(code ?? 1));

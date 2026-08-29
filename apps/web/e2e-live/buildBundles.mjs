/**
 * The bundles the live harness compares, built HERE, in this order, and BEFORE
 * Playwright starts.
 *
 * Not a Playwright `globalSetup`: Playwright starts every `webServer` before
 * globalSetup runs, so a build placed there is a build that happens after
 * `vite preview` has already failed to find the directory. Measured, not
 * assumed — that is exactly what the first version of this file did.
 *
 * Not a `webServer` command either. Two of the servers serve the same
 * `dist-harness/live` and Playwright starts them in parallel, so a build inside
 * one would race the server already trying to serve it.
 *
 * `VITE_API_MODE` is set on the BUILD because `import.meta.env` is inlined into
 * the output — setting it only when `vite preview` starts changes the proxy and
 * nothing else; the JavaScript the browser runs has already decided whether to
 * start MSW. The preview servers set it too, for the other half.
 *
 * NOT UNDER `dist/`, which is where these started. `playwright.config.ts`'s
 * `pnpm build` empties `dist/` wholesale on every mock e2e run — measured, it
 * deleted both harness directories — so the two suites could not actually run
 * alongside each other however carefully the ports were chosen. `dist-harness/`
 * is gitignored beside `dist`.
 *
 *   node e2e-live/buildBundles.mjs
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const WEB_V2 = fileURLToPath(new URL("..", import.meta.url));

/**
 * `liv` is a typo, deliberately, and the bundle it produces is the point: it
 * makes "an unrecognised VITE_API_MODE refuses ON SCREEN" an assertion rather
 * than a sentence in a comment. vite.config.ts warns about the value and builds
 * anyway, precisely so this bundle can exist to be tested.
 */
const BUNDLES = [
  ["dist-harness/live", "live"],
  ["dist-harness/mock", "mock"],
  ["dist-harness/invalid", "liv"],
];

for (const [outDir, apiMode] of BUNDLES) {
  console.log(`building ${outDir} with VITE_API_MODE=${apiMode}`);
  execFileSync("pnpm", ["exec", "vite", "build", "--outDir", outDir], {
    cwd: WEB_V2,
    env: { ...process.env, VITE_API_MODE: apiMode },
    stdio: "inherit",
  });
}

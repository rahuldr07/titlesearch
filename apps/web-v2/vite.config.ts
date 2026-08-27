import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type PluginOption, type Rollup } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

/** This package's own directory, and the ONE place env files are read from. */
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * THE PDF ENGINE MAY NOT REACH THE SHELL, and this refuses the build if it does.
 *
 * EmbedPDF is 16.7 kB of JS in front of a 4.5 MB `pdfium.wasm`. Both are a
 * first-load cost that must be paid on the review screen and nowhere else. The
 * thing that keeps them out of the shell is a single dynamic `import()` at the
 * PDF module's boundary — one refactor to a static import and 4.5 MB moves onto
 * the critical path of the queue screen. Nothing about that is visible in a
 * diff, and the size gate cannot see it either: `size-limit` measures files,
 * and the wasm is an asset, not JS.
 *
 * So the reachability is asserted on the real emitted graph. Walk `imports`
 * (STATIC imports only — `dynamicImports` is the separate field, and being on
 * it is the desired state) transitively from every entry chunk. If a chunk
 * carrying `@embedpdf` / pdfium is in that closure, the build fails with the
 * path that pulled it in.
 *
 * It reports nothing when no PDF module exists yet, which is today. That is the
 * point of landing it now rather than after the first regression.
 */
function pdfMustStayLazy(): PluginOption {
  const isPdfModule = (id: string) =>
    id.includes("@embedpdf/") || id.includes("pdfium");

  return {
    name: "titlepipe:pdf-must-stay-lazy",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks = new Map<string, Rollup.OutputChunk>();
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type === "chunk") chunks.set(file, out);
      }

      // Breadth-first over static edges, remembering how we arrived so the
      // failure names the import path rather than just the verdict.
      const arrivedVia = new Map<string, string[]>();
      const queue: string[] = [];
      for (const [file, chunk] of chunks) {
        if (chunk.isEntry) {
          arrivedVia.set(file, [file]);
          queue.push(file);
        }
      }

      while (queue.length > 0) {
        const file = queue.shift();
        if (file === undefined) continue;
        const chunk = chunks.get(file);
        if (!chunk) continue;
        const path = arrivedVia.get(file) ?? [file];

        const pdfModule = Object.keys(chunk.modules).find(isPdfModule);
        if (pdfModule !== undefined) {
          this.error(
            `PDF engine is STATICALLY reachable from the shell.\n` +
              `  chunk path: ${path.join(" -> ")}\n` +
              `  module:     ${pdfModule}\n` +
              `The PDF module and pdfium.wasm must sit behind a dynamic import().`,
          );
        }

        for (const next of chunk.imports) {
          if (arrivedVia.has(next)) continue;
          arrivedVia.set(next, [...path, next]);
          queue.push(next);
        }
      }
    },
  };
}

/**
 * THE FUNCTION FORM EXISTS FOR ONE REASON: `loadEnv`.
 *
 * This config decides the proxy and `main.tsx` decides whether MSW starts, and
 * before this they read two different things — `process.env` here,
 * `import.meta.env` there. Vite merges prefixed `process.env` INTO
 * `import.meta.env` but never the reverse, and the object form of
 * `defineConfig` never calls `loadEnv` at all. MEASURED: with
 * `apps/web-v2/.env` holding `VITE_API_MODE=live`, the bundle came out
 * byte-identical to a real live build — MSW gated off — while this file saw
 * nothing and configured no proxy. No mocks and no backend, and `.env` is
 * gitignored, so nothing in review would show it.
 *
 * `loadEnv` is the same function Vite calls to build `import.meta.env`, and
 * `envDir` below pins it to the same directory, so the two readers now resolve
 * from one source by construction rather than by coincidence. Precedence is
 * Vite's own (dist/node/chunks/node.js:5695-5697): `.env` files first, then
 * `process.env`, so an explicit `VITE_API_MODE=live pnpm build` still wins over
 * a stale `.env`.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, APP_DIR, "VITE_");
  const apiMode = env.VITE_API_MODE ?? "mock";

  /*
   * A value that is neither is WARNED about here and REFUSED in the browser,
   * rather than refused here.
   *
   * Refusing at config time would be the stronger place to fail — and it would
   * also make `main.tsx`'s refusal unreachable, because this value is inlined
   * at build time, so a bundle carrying a bad one could never be produced. A
   * refusal nobody can build is a refusal nobody can test, and this repository's
   * history is largely of checks that could not be executed and were believed to
   * work anyway. So the refusal lives where a test can reach it —
   * `e2e-live/refuses-invalid-mode.spec.ts` builds one and asserts the message
   * is on screen — and this is what stops the build from being silent about it.
   */
  if (apiMode !== "mock" && apiMode !== "live") {
    console.warn(
      `\n[titlepipe] VITE_API_MODE is "${apiMode}", which is neither "mock" nor "live".` +
        `\n[titlepipe] No /api proxy will be configured, and the app will refuse to start.\n`,
    );
  }

  /*
   * `/api` reaches core-api only under `live`, and only then.
   *
   * MOCK MODE GETS NO PROXY, deliberately. MSW answers in the browser and never
   * reaches this server at all, so a proxy would change nothing on the happy
   * path — but if the worker ever failed to register, an `/api` call would
   * quietly land on a real backend nobody meant to call. Without one it dies
   * against the static server, which is the loud failure. That is asserted
   * rather than merely intended: `e2e-live/mock-unchanged.spec.ts` fetches an
   * `/api` path MSW does not handle, on a server whose proxy target IS core-api,
   * and requires the preview server's own answer back.
   *
   * THE TARGET IS CONFIGURABLE because CI and a developer's box are not the same
   * machine. The default is core-api's own default port (`services/core-api`
   * settings.py: `port: int = Field(default=8000, ...)`).
   */
  const apiProxy =
    apiMode === "live"
      ? {
          "/api": {
            target: env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000",
            changeOrigin: true,
          },
        }
      : undefined;

  return {
    plugins: [
      react(),
      /*
       * REACT COMPILER, and the wiring is not what the dependency spec wrote.
       * The spec said `react({ babel: { plugins: [...] } })` or a
       * `reactCompiler` option. VERIFIED against the INSTALLED 6.0.3:
       * `Options` in node_modules/@vitejs/plugin-react/dist/index.d.ts declares
       * only include/exclude/jsxImportSource/jsxRuntime/reactRefreshHost —
       * there is no `babel` key and no `reactCompiler` key. v6 moved to
       * rolldown/oxc, so Babel is no longer in the plugin at all; what it
       * exports instead is `reactCompilerPreset`, fed to
       * `@rolldown/plugin-babel`. Passing the option the spec describes would
       * be silently ignored: an object literal excess-property error at type
       * level, and NOTHING compiled at runtime.
       *
       * `@rolldown/plugin-babel` and `@babel/core` are peer dependencies of
       * that path and were not in the manifest; both are now devDependencies.
       *
       * The preset carries its own `rolldown.filter` so only files that look
       * like components or hooks reach Babel, and it is client-only via
       * `applyToEnvironmentHook`. Defaults kept: compilationMode is
       * infer (not `annotation`), and no `target`, because React is 19.
       */
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      /*
       * Bundle composition, written to disk on every build rather than behind
       * a flag. The acceptance criteria require the PDF module and
       * `pdfium.wasm` to be CONFIRMED in a lazy chunk "in the
       * rollup-plugin-visualizer output, not assumed" — a report nobody
       * generates cannot confirm anything. `emitFile` puts it inside `dist/`
       * as `stats.html`; it is not `dist/assets/*`, so it cannot enter the
       * size-limit glob.
       */
      visualizer({
        emitFile: true,
        filename: "stats.html",
        brotliSize: true,
        gzipSize: true,
      }),
      pdfMustStayLazy(),
    ],
    build: {
      rollupOptions: {
        output: {
          /*
           * The PDF engine is 4.5 MB of WebAssembly plus its JS. It is pinned
           * into its own chunk so that (a) it is one identifiable thing in the
           * visualizer output, and (b) `pdfMustStayLazy` below has something
           * unambiguous to assert against.
           *
           * A manual chunk does NOT by itself make anything lazy — laziness
           * comes from the import being dynamic at the only place the app
           * names it. That is exactly why the assertion exists rather than a
           * comment claiming it.
           */
          manualChunks(id) {
            if (id.includes("@embedpdf/") || id.includes("/pdfium")) {
              return "pdf";
            }
            return undefined;
          },
        },
      },
    },
    /*
     * Pinned so `import.meta.env` and the `loadEnv` above cannot read different
     * directories. It defaults to `root`, which is derived from the working
     * directory rather than from this file — so without this the single source
     * holds only while everyone runs vite from this package.
     */
    envDir: APP_DIR,
    /*
     * `@/` mirrors tsconfig.app.json's path alias. It exists for the shadcn
     * registry, whose files import `@/lib/utils` and cannot be told to emit
     * relative paths. App code keeps writing relative imports, so the import
     * style itself says whether a file is vendored or ours.
     */
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    /*
     * BOTH servers, stated explicitly, and the reason is not the one you would
     * guess. Playwright runs against `vite preview`, never `vite dev` — so the
     * question was whether a dev-only proxy would leave the e2e live run with no
     * proxy at all. MEASURED on vite 8.1.5: it would not. `resolvePreviewOptions`
     * reads `preview?.proxy ?? server.proxy` (dist/node/chunks/node.js:35001), so
     * preview inherits the dev server's proxy, and removing `preview.proxy` alone
     * changes nothing — verified by removing it and watching the live harness
     * stay green.
     *
     * Declared on both anyway, because that fallback is Vite's internal detail
     * and this app's dependence on it should not be silent. What is NOT silent is
     * the failure: with the proxy removed from both, the "core-api is down"
     * assertion still passes while the positive control fails. That asymmetry is
     * the whole reason the positive control exists.
     */
    server: { port: 5174, proxy: apiProxy },
    preview: { port: 4274, proxy: apiProxy },
  };
});

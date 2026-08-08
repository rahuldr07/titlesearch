import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/** This package's own directory, and the ONE place env files are read from. */
const APP_DIR = fileURLToPath(new URL(".", import.meta.url));

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
    plugins: [react(), tailwindcss()],
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

import { fileURLToPath, URL } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook is the Phase 3 gate, not a gallery (BRIEF §4): stories are the
 * component workshop, the a11y check, and the visual-regression target.
 *
 * Stories live beside their component. A primitive without a story per variant
 * AND per state — loading, empty, error, disabled, focused — is not done.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: { name: "@storybook/react-vite", options: {} },
  // §4 forbids analytics SDKs and §9.12 forbids telemetry carrying product
  // data. Storybook's is anonymous and build-time, so it breaks neither — but
  // the default is on, and an unexamined default is not a decision.
  core: { disableTelemetry: true },
  /*
   * Storybook builds with its OWN Vite config and inherits nothing from
   * `vite.config.ts`, so the `@/` alias has to be declared again here. It is
   * not decoration: `@/` is how the shadcn registry imports, and without it
   * every story in the app fails — not with a resolve error, but as an axe
   * violation on Vite's error overlay, which is a genuinely confusing way to
   * learn that a path is wrong.
   */
  viteFinal: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        "@": fileURLToPath(new URL("../src", import.meta.url)),
      },
    },
  }),
};

export default config;

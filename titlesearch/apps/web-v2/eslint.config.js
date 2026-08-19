import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/**
 * BRIEF §6 enforcement that needs the type checker or the AST.
 * The grep-able rules live in scripts/check-rules.mjs; the two are complements,
 * not duplicates.
 */
export default tseslint.config(
  { ignores: ["dist", "storybook-static", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ["src/**/*.{ts,tsx}", ".storybook/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",

      /* §6 — no `any`, no non-null assertion, no ts-ignore. */
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": "error",

      /* §4 — screens and components are named exports, never default.
         Storybook CSF is exempted below: `export default meta` is required by
         the format, so banning it there would ban stories. */
      // `named: true` closes `export { Screen as default }`, which the
      // direct-only form allowed straight through.
      "no-restricted-exports": [
        "error",
        { restrictDefaultExports: { direct: true, named: true } },
      ],

      /* §4 — the forbidden dependency list, enforced at the import site so a
         transitive install cannot quietly become a usage. */
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "axios", message: "§4 forbidden — use fetch" },
            { name: "redux", message: "§4 forbidden — Zustand for ephemeral UI only" },
            { name: "@reduxjs/toolkit", message: "§4 forbidden" },
            { name: "moment", message: "§8 — dates are opaque strings; see src/shared/date.ts" },
            { name: "dayjs", message: "§8 — dates are opaque strings; see src/shared/date.ts" },
            { name: "date-fns", message: "§8 — dates are opaque strings; see src/shared/date.ts" },
            { name: "lodash", message: "§4 forbidden" },
            { name: "framer-motion", message: "§4 forbidden" },
            { name: "next", message: "§4 forbidden — no SSR" },
            { name: "styled-components", message: "§4 forbidden — Tailwind + cva" },
            { name: "zod", message: "§4 — Valibot in the browser; @titlepipe/contract owns wire shapes" },
          ],
          // `paths` matches the exact module name only, so `lodash/merge` and
          // `date-fns/format` both walked past it. The config previously
          // claimed to stop "a transitive install quietly becoming a usage";
          // it did not. These patterns are what actually do that.
          patterns: [
            {
              group: [
                "lodash", "lodash/*", "lodash-es", "lodash-es/*",
                "moment", "moment/*", "dayjs", "dayjs/*",
                "date-fns", "date-fns/*", "@date-fns/*",
                "axios", "axios/*",
                "redux", "redux/*", "@reduxjs/*",
                "framer-motion", "framer-motion/*",
                "styled-components", "styled-components/*",
                "next", "next/*",
                "zod", "zod/*",
              ],
              message:
                "§4 forbidden dependency (subpath imports included). Dates: src/shared/date.ts. Wire shapes: @titlepipe/contract.",
            },
          ],
        },
      ],
    },
  },
  {
    // Storybook CSF mandates a default export for the meta object.
    files: ["**/*.stories.{ts,tsx}", ".storybook/**/*.{ts,tsx}"],
    rules: { "no-restricted-exports": "off" },
  },
  {
    /*
     * Everything outside src/ used to be unlinted entirely — all 23 e2e specs,
     * both Vitest gates and every config file reported "File ignored because no
     * matching configuration was supplied", exit 0. The 111 harvested
     * invariants are the most rule-dense code in the repo and nothing was
     * checking them.
     */
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["e2e/**/*.ts", "*.test.ts", "*.config.ts"],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
);

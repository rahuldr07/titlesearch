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
  // `dist-harness` holds the live migration harness's bundles. It is build
  // output like `dist`, and it is named separately because it deliberately sits
  // outside `dist/` — see e2e-live/buildBundles.mjs. Flat config does not read
  // .gitignore, so an ignored directory still has to be listed here.
  { ignores: ["dist", "dist-harness", "storybook-static", "node_modules"] },
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
      /*
       * `recommended-latest` rather than `recommended`, because the React
       * Compiler is now enabled in vite.config.ts and this is where its lint
       * rules live. eslint-plugin-react-hooks 7.x ships them in-plugin —
       * `purity`, `immutability`, `set-state-in-effect`,
       * `preserve-manual-memoization`, `refs`, `static-components`,
       * `error-boundaries` and ten more.
       *
       * DO NOT install `eslint-plugin-react-compiler`. It is stuck at
       * 19.1.0-rc.2 and superseded by exactly these rules.
       *
       * This matters more than a normal lint upgrade: a compiler-broken
       * component does not fail loudly, it memoizes something it should not
       * and produces a stale render. These rules are the only place that gets
       * caught before it ships.
       */
      ...reactHooks.configs["recommended-latest"].rules,
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
            {
              name: "moment",
              message: "§8 — dates are opaque strings; see src/shared/date.ts",
            },
            {
              name: "dayjs",
              message: "§8 — dates are opaque strings; see src/shared/date.ts",
            },
            {
              name: "date-fns",
              message: "§8 — dates are opaque strings; see src/shared/date.ts",
            },
            { name: "lodash", message: "§4 forbidden" },

            /* MOTION — the §4 `framer-motion` ban is REVERSED by owner ruling
               2026-08-27 (dependency spec, Deviations §4). `motion` is Framer
               Motion's current package name and it is installed.

               What replaces the ban is narrower and load-bearing. MEASURED in
               the spec: `LazyMotion` + `domAnimation` + `m` is 25.8 kB for the
               same API that the top-level `motion` component costs 42.5 kB —
               a 40% saving that is invisible unless you already know to look
               for it. An agent writing `<motion.div>` gets a working animation
               and silently doubles the motion bundle; nothing fails.

               So the cheap path is made the only reachable one:
                 - `motion/react` is PERMITTED — that is where LazyMotion,
                   domAnimation and `m` come from.
                 - the `motion` NAMESPACE export of it is banned by name, which
                   is what `motion.div` is reached through.
                 - the bare `motion` package specifier is banned, since it
                   re-exports the eager surface.
               `framer-motion` stays listed: it is the dead name, is not
               installed, and an agent recalling it should be told where to go
               rather than getting a module-not-found. */
            {
              name: "motion",
              message:
                "Import from `motion/react`, and only LazyMotion + domAnimation + m. The bare package re-exports the eager surface (42.5 kB vs 25.8 kB).",
            },
            {
              name: "motion/react",
              importNames: ["motion"],
              message:
                "`motion.div` pulls the eager surface (42.5 kB vs 25.8 kB). Use LazyMotion + domAnimation + `m` instead.",
            },
            {
              name: "framer-motion",
              message:
                "Dead package name — the current one is `motion`. Import `motion/react` and use LazyMotion + m.",
            },
            { name: "next", message: "§4 forbidden — no SSR" },
            { name: "styled-components", message: "§4 forbidden — Tailwind + cva" },
            /* The `zod` and `zod/*` entries that used to sit here enforced
               BRIEF §4's "Valibot NOT zod" mandate. That mandate is SUPERSEDED
               by owner ruling 2026-08-27 (dependency spec, Decisions taken §1
               — D-6 closed): Zod ships in the browser deliberately, `valibot`
               is removed, and ADR-0001 stands unamended with Zod as the
               browser's runtime boundary parser. The rule would now fail
               `@titlepipe/contract`'s own imports, so it is deleted rather
               than suppressed per-file. */
          ],
          // `paths` matches the exact module name only, so `lodash/merge` and
          // `date-fns/format` both walked past it. The config previously
          // claimed to stop "a transitive install quietly becoming a usage";
          // it did not. These patterns are what actually do that.
          patterns: [
            {
              group: [
                "lodash",
                "lodash/*",
                "lodash-es",
                "lodash-es/*",
                "moment",
                "moment/*",
                "dayjs",
                "dayjs/*",
                "date-fns",
                "date-fns/*",
                "@date-fns/*",
                "axios",
                "axios/*",
                "redux",
                "redux/*",
                "@reduxjs/*",
                "framer-motion",
                "framer-motion/*",
                "styled-components",
                "styled-components/*",
                "next",
                "next/*",
              ],
              message:
                "§4 forbidden dependency (subpath imports included). Dates: src/shared/date.ts. Wire shapes: @titlepipe/contract.",
            },
            /* `paths` above names `motion` and `motion/react` exactly, which
               leaves every OTHER subpath — `motion/react-client`,
               `motion/mini`, `motion/dom` — walking straight past, and the
               first of those re-exports the eager namespace. Negation keeps
               the one permitted entry point reachable. */
            {
              group: ["motion/*", "!motion/react"],
              message:
                "`motion/react` is the only permitted entry point, and only LazyMotion + domAnimation + m from it.",
            },
          ],
        },
      ],

      /*
       * §Provenance (AGENTS.md: "Never emit a value you can't cite").
       *
       * REVIEW-01 B1: `Cited<T>` does NOT make a missing citation a compile
       * error, and the header of `shared/provenance.ts` now says so. This rule
       * is the half of the enforcement that actually exists. It bans reading
       * `.value` off anything named for a contract `Field`, which is the
       * bypass that compiled clean: `<span>{field.value}</span>`, printed
       * without ever going through `readCited`.
       *
       * SYNTACTIC, not type-aware — this project does not run typed linting,
       * and turning it on to catch one member access is not a trade worth
       * making. So the rule keys off the NAME, which is the spelling every
       * site in the tree uses and the one a developer reaches for. A `Field`
       * bound to some other identifier walks past; `check-rules.mjs`
       * (`raw-field-value`) carries that case by keying off the IMPORT
       * instead. Neither is an adversary model. Both catch the accident.
       *
       * `shared/provenance.ts` is exempted below — it is the one file whose
       * job is to read `field.value`.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[computed=false][property.name='value'][object.name=/^(field|f)$/]",
          message:
            "Never emit a value you can't cite (AGENTS.md). Go through `readCited(field)` in shared/provenance.ts and render the FieldValue union — printing `field.value` drops the citation. See REVIEW-01 B1.",
        },
      ],
    },
  },
  {
    /* The one file allowed to read a contract Field's `.value`: it is what
       `readCited` exists to do. */
    files: ["src/shared/provenance.ts"],
    rules: { "no-restricted-syntax": "off" },
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
    files: ["e2e/**/*.ts", "e2e-live/**/*.ts", "*.test.ts", "*.config.ts"],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
    },
  },
);

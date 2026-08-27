# `src/components/ui/` — the kit, and why it is hand-written

**This directory is NOT shadcn registry output.** It is 49 hand-written files
built directly on `react-aria-components`, this repo's `cva`/`cx`/`disabled.ts`,
and the fourteen rules in `docs/frontend/design-2026-08/claude-design-rules.md`.

## What happened

The dependency spec (`docs/superpowers/specs/2026-08-27-frontend-dependency-set-design.md`)
called for `pnpm dlx shadcn@latest init --base aria`, on the finding that 59 of
63 registry components have an Aria variant. That step was never run. The kit
was written by hand instead.

That is defensible — the design is fully custom, several rules are enforced in
the type system rather than in class strings (`disabled.ts` has no boolean
`disabled` prop at all), and registry output would have been rewritten anyway.
But it left two artefacts describing a setup nobody performed:

- `components.json` had no `base` key, and pointed `tailwind.css` and the
  `utils` alias at `src/styles/index.css` and `@/shared/ui/classNames` —
  **neither path exists**. Corrected 2026-08-27 to the real ones.
- `scripts/check-rules.mjs` skipped this entire directory as "vendored source …
  the same status as node_modules". **Removed 2026-08-27.** It was excusing
  ~2,965 lines of the most reused code in the app from the raw-hex,
  arbitrary-value and file-length gates while reporting green. Removing it
  surfaced exactly one violation, an inlined press shadow, now
  `--shadow-press` in the token package.

## If you run `shadcn add` later

Registry idiom genuinely cannot satisfy these rules — it writes arbitrary
values (`w-[var(--radix-select-trigger-width)]`), runs past 150 lines, and
ships `dark:` variants this app does not use. So if a real `add` ever lands:

1. Re-add an exemption to `check-rules.mjs` **scoped to the files it wrote**,
   not to the directory.
2. Say so in the commit, and name the components.
3. Note the case collision: the registry writes `button.tsx`; the kit has
   `Button.tsx`. On a case-insensitive filesystem those are one file.

Do not restore a blanket exemption on the strength of `components.json` alone.

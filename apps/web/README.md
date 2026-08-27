# `apps/web`

The TitlePipe frontend. React 19 · Vite 8 · TypeScript 6 · Tailwind v4 ·
react-aria-components, via **shadcn/ui on the Aria base**.

## The kit is generated, then adapted

`src/components/ui/` is shadcn registry output that has been rewritten to the
recipes in `docs/frontend/design-2026-08/TitlePipe-Design-System.html` §6.

Both halves are in the history as separate commits on purpose: one landing the
**raw registry output untouched**, the next carrying **only the adaptation**.
That makes the design delta reviewable forever, and makes a future
`shadcn add` upgrade a three-way merge rather than an archaeology exercise.

The registry cannot ship as-is here. Measured on the first 13 components it
wrote: 19 `dark:` variants (this app has no dark register), 54 arbitrary
values, 25 off-scale type sizes against a six-size scale, and a 32px/radius-8
button where the spec says 38px/radius-14.

```
pnpm --filter @titlepipe/web dev          # the app
pnpm --filter @titlepipe/web storybook    # every component, every state
pnpm --filter @titlepipe/web check:rules  # the design-rule gate
```

## What must not drift

- `packages/contract` is frozen and upstream. Never generate backend shape from a screen.
- `e2e/invariants/` encodes product refusals. Selectors may be rewritten; **assertions never**.
- Routes come from the door table at `packages/contract/src/authz.ts:62-81`. This app invents none.

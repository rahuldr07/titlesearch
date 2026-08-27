# Frontend dependency set — apps/web-v2 rebuild

**Written 2026-08-27.** Evidence: every size figure in this document was measured, not
looked up. Method in Appendix A; the harness is reproducible in ten minutes from a
clean checkout. Versions are npm `latest` as of 2026-08-27.

## Goal

Decide the complete dependency set for the `apps/web-v2` rebuild, now that `src/` is
empty and every choice is free of migration cost. Decide it on this application's
properties — a dense, keyboard-driven review tool with a mandated custom design, built
largely by agents against a single human reviewer — rather than on defaults.

Not in scope: the visual language (the design has not landed), the screen inventory, or
the build order. This document ends at "what is installed and why".

## What the research overturned

Three premises this work started from were wrong. They are recorded because the
reasoning that followed them was published in this repository's planning threads.

**1. Bundle size does not decide this.** Twenty-nine kilobytes separate all five
candidate component kits. On an authenticated internal tool that reviewers keep open
all day, that is ~25 ms once, then cached. Size was demoted to a tiebreaker after the
owner said so, and the ranking inverted when it was.

**2. "Radix has had zero GitHub releases in 12 months" is not a signal.** Verified:
`GET /repos/radix-ui/primitives/releases` returns **zero releases ever**. Radix has
never used GitHub Releases; its changelog lives on its own site. The metric was empty
in both directions and should never have been quoted. Radix ships actively — 100+
commits in 90 days, `radix-ui@1.6.7` published 2026-07-24.

**3. The widget surface is far smaller than assumed, and the tests cannot see the
choice.** Across all 91 specs in `apps/web-v2/e2e/`: **258 `getByTestId` against 17
`getByRole`, and zero `getByLabel`.** The asserted role inventory is 8 button, 2 tab, 1
textbox, 1 radio, 1 menuitem, 1 heading, 1 dialog, 1 combobox, 1 checkbox. Swapping
component libraries breaks no test. `docs/frontend/HANDOFF-UI.md:74` records that the
previous build put only **9 of 19** kit components on a headless library; the other ten
were Tailwind + `cva`.

The consequence is stated plainly so it is not rediscovered: **this decision is
low-stakes and reversible.** The primitives sit behind ~20 adapter files. It deserved
the research it got, and it does not deserve more.

## Method

Five agents were run in a structured debate — one advocating each of
react-aria-components, Base UI, Radix + Downshift, and Ark UI, plus one adversary
instructed to attack the framing rather than pick a winner. Each was told to attack the
others and concede honestly. **Every load-bearing claim they returned was independently
verified before being used here.** Two failed:

| Claim | Source | Verdict |
|---|---|---|
| "Base UI has 468k weekly downloads against 313 open issues — worst defect-to-usage ratio" | Ark advocate | **False.** 468k is the *renamed* package `@base-ui-components/react`. The live package `@base-ui/react` has **10,810,955**. Wrong by 23×; the attack collapses. |
| "An Ark v6 RFC has been open since Sept 2025" | Ark advocate | **Unsubstantiated.** No matching issue found. Discarded. |
| "`useKeyboard` accepts a `shortcuts` option in 1.20" | RAC advocate | **True.** `shortcuts?: KeyboardShortcutBindings` present in the installed `@react-aria/interactions@3.28.1`, with `allowRepeating` / `allowComposing`. |
| "Ark ships an official MCP server" | Ark advocate | **True.** `@ark-ui/mcp@1.3.0`, published 2026-08-03. |
| "The rule picker must stay a native `<select>`" | Adversary | **True, verbatim** — `docs/frontend/HANDOFF-UI.md:225`. |

## The component kit: react-aria-components

Measured against the spec-derived nine-widget surface (brotli, esbuild, React external):

| kit | brotli | complete? | top author's share of 12mo commits |
|---|---|---|---|
| Radix + Downshift | 47.3 kB | combobox via hooks only | **88%** (chaance) |
| Headless UI | 49.0 kB | no tooltip, no toast | no commits in window |
| Ark UI | 53.3 kB | yes | 63% (segunadebayo) |
| **react-aria-components** | **60.5 kB** | yes | **26%, 40 authors** |
| Base UI | 76.1 kB | yes | 48%, 36 authors |

Styled kits were rejected on the custom design, before size entered: Blueprint 210.2 kB,
HeroUI 89.5 kB (+692 KB of CSS carrying its own token system), Fluent 88.5 kB,
Mantine 61.6 kB. Any library shipping a second token vocabulary is a design defect
against `scripts/check-rules.mjs`.

**Decided on bus factor and on shipped accessibility, in that order.**

Radix is one person writing 88% of the commits. Ark is one person writing 63%, on the
thinnest training corpus of the five (1.0M weekly downloads against Radix's 12.4M) — and
its own advocate conceded the "finite state machines match this project's philosophy"
argument was "mostly rhetorical … do not buy a library for a metaphor." Headless UI has
no commits in twelve months. React Aria has the broadest contributor base by a factor of
two and Adobe's funding behind it.

On accessibility, three of the four flagged WCAG 2.2 gaps are shipped code rather than
homework, and this matters specifically because `@axe-core/playwright` cannot detect a
*missing* keyboard alternative or a *missing* live region:

- **2.5.7 dragging movements** — `useMove` turns arrow keys into move events. That is
  the PDF pan's keyboard alternative.
- **4.1.3 status messages** — `@react-aria/live-announcer` is imported by ten modules
  including `combobox/useComboBox` and `table/useTable`.
- **2.4.11 focus not obscured** — `scrollIntoViewport` traverses nested scroll
  containers, unlike `Element.scrollIntoView`.
- 2.5.8 target size is CSS. No library helps.

React Aria ships **no stylesheet at all**, so it cannot contend with the token layer.

**Honest costs.** The render-prop API is more verbose than `asChild`
(`composeRenderProps` recurs at every adapter). Its DOM is more prescribed —
`ModalOverlay > Modal > Dialog` is three boxes before content, `Popover` writes inline
positioning — which the geometry-diff harness will notice. And three sibling API layers
(`react-aria` hooks, `react-stately`, `react-aria-components`) share names across
incompatible versioning lines, which agents blend. Budget Storybook stories as the
composition gate.

**Base UI is the defensible alternative** and requires no deviation, since BRIEF §4
already mandates it. It loses here on ships-breaking-changes-in-minors (v1.3.0, v1.5.0,
v1.6.0 all carry breaking sections), on a package rename that poisons agent recall
(`@base-ui-components/react` is frozen at `1.0.0-rc.0`; this repo installed the dead
name once already — `docs/frontend/phase2-audit.md` §5), and on being the largest.

### shadcn on the Aria base

`shadcn` supports React Aria as a first-class base since July 2026 (`--base aria`).
Pulled from the live registry rather than the changelog: of 63 components, **59 have an
Aria variant — more than Base UI's 57 or Radix's 56.** The Aria base is the most
complete of the three, not the newest and thinnest.

Four have no Aria variant: `form`, `menubar`, `navigation-menu`, **`toast`**. Only
`toast` matters, and the cause is upstream — React Aria's own Toast is still
`UNSTABLE_`-prefixed in 1.20.0 (all six exports). `toast` is the sole component that
exists *only* on the Base UI base.

`sonner` fills it. Verified implementation: `aria-live="polite"`,
`aria-relevant="additions text"`, `aria-atomic="false"` — correct for 4.1.3. Its focus
shortcut is configurable (`hotkey?: string[]`), so it will not collide with the
single-key vocabulary. It ships a 17.7 kB stylesheet, which is one component's CSS, not
a competing token system.

`shadcn` output remains quarantined by `scripts/check-rules.mjs:113` (`VENDORED`). That
boundary is correct and stays. Components that must match the design precisely are read
from the registry and rewritten into the owned kit; the rest stay vendored and untouched.

## Observability: build it, do not buy it

**The backend decides this.** `services/core-api/src/titlepipe_core/telemetry/logging.py`
redacts party names, field values, results and reasons — allowlist-only in deployed
environments — and its docstring records that an earlier processor ordering leaked a
party name to stdout. Sentry's default breadcrumbs capture DOM click text, console
output and fetch URLs: precisely the class of value that redaction exists to remove.
Sentry is also 25.5 kB minimum — there is no lite build, the core *is* the cost
(`@sentry/browser` minimal 25.5 kB vs `@sentry/react` full 26.5 kB).

The design instead:

| piece | cost |
|---|---|
| React 19 `createRoot(el, { onUncaughtError, onCaughtError, onRecoverableError })` — verified in `@types/react-dom/client.d.ts:37-55` | 0 kB |
| `window.onerror` + `unhandledrejection` | 0 kB |
| `react-error-boundary` for per-screen recovery | 0.7 kB |
| POST structured events to core-api, through the existing structlog redaction | 0 kB |
| Correlation via `crypto.randomUUID()` | 0 kB |

`X-Request-ID` already exists server-side: generated when absent, accepted inbound for
cross-service correlation, validated `^[A-Za-z0-9_.\-]{1,64}$`, and present in the CORS
`allow_headers` (`api/request_context.py:60`, `app.py:90`) — the browser is *expected*
to send it. `crypto.randomUUID()` satisfies that pattern, verified, so no ID package is
needed.

Client log events use structlog's field names so a string read in a browser console can
be grepped in staging. **No client-side logging library.** `loglevel` (1.4 kB, last
published 2024-09) and `consola` (2.2 kB) both lose to ~30 lines that match the
backend's vocabulary, which is the entire point.

Sentry remains available if the owner wants alerting, grouping and release tracking as a
product. That is a purchasing decision, not a library one, and it requires
`beforeBreadcrumb` lockdown before it is safe here.

## The manifest

Total measured runtime: **175.6 kB brotli**, against 222.4 kB for what `package.json`
declares today. 55% of the 320 kB budget, leaving ~144 kB for application code.

That figure includes `motion`, adopted by owner decision 2026-08-27 (see Deviations §4).
Without it the stack measures 152.9 kB.

### Remove (6)

`@base-ui/react` · `radix-ui` · `cmdk` · `valibot` · `react-zoom-pan-pinch` ·
`react-hotkeys-hook`

`cmdk`'s last release is **1.1.1, 2025-03-14** — seventeen months — and it costs 15.3 kB.
Both primitive kits go because only one is needed and neither is the chosen one.

### Runtime

| group | packages |
|---|---|
| Core | `react` `react-dom` 19.2.8 · `vite` 8.2.2 · `@vitejs/plugin-react` 6.1.0 · `tailwindcss` `@tailwindcss/vite` 4.3.3 |
| Routing & data | `@tanstack/react-router` 1.170.32 · `@tanstack/react-query` 5.102.6 |
| UI | **`react-aria-components` 1.20.0** · `sonner` 2.0.8 · `lucide-react` 1.34.0 · `class-variance-authority` 0.7.1 · `tailwind-merge` 3.6.0 · `clsx` 2.1.1 |
| Motion | **`motion` ^12** — imported **only** as `LazyMotion` + `domAnimation` + `m` |
| Table & lists | **`@tanstack/react-table` 9.2.3** · `@tanstack/react-virtual` 3.14.10 |
| Forms | `react-hook-form` 7.86.0 · `@hookform/resolvers` 5.9.1 · `zod` 4.4.3 (via `@titlepipe/contract`) |
| State | `zustand` 5.0.15 |
| Keyboard | **`tinykeys` 4.0.0** |
| PDF & pan | `react-pdf` 10.5.0 · `pdfjs-dist` (pinned) · **`@panzoom/panzoom` 4.6.2** |
| a11y gap-fillers | **`@react-aria/interactions`** · **`@react-aria/live-announcer`** |
| Resilience & perf | **`react-error-boundary` 6.1.3** · **`web-vitals` 6.2.1** |
| Utility | **`diff` 9.0.0** |

`@tanstack/react-table` v9 is a full API change — `getCoreRowModel` → `createCoreRowModel`,
`flexRender` → `FlexRender`, features opt-in and tree-shakeable. Measured 14.6 kB with
sorting, filtering, visibility and selection registered, against v8's 13.7 kB for the
same surface. It is free to adopt now and expensive later.

`tinykeys` replaces both `react-hotkeys-hook` **and** the hand-written document-level
keydown listener that `HANDOFF-UI.md:167` records as necessary because
*"react-hotkeys-hook does not recognise `?` or `[` as hotkey names. Both were registered
and never fired."* Verified: tinykeys binds `?`, `[`, `Shift+/` and the `g h` sequence.
0.8 kB against 2.4 kB.

`@panzoom/panzoom` over `react-zoom-pan-pinch`: 3.6 kB vs 10.3 kB, and neither solves
2.5.7 — that comes from `useMove`.

**`motion` must be imported as `LazyMotion` + `domAnimation` + `m`, never as the
top-level `motion` component.** Measured: 25.8 kB against 42.5 kB for the same API — a
40% saving that is invisible unless someone knows to look for it. Add a
`no-restricted-imports` rule permitting `motion/react` while banning the bare `motion`
namespace import, so the cheap path is the only one available.

Motion is not the default answer for enter/exit. `react-aria-components` emits
`data-entering` / `data-exiting` attributes intended for CSS animation, and Tailwind v4
covers fade/slide/scale at zero JS. `motion` is for what CSS cannot express: shared-element
transitions between queue and review, drag gestures, and spring chains.

### The notification boundary

**The vendor is `sonner`, ruled by the owner 2026-08-27, and it is the only toast
dependency.** It is reached **only** through an adapter. Nothing in the application
imports it.

```
notify.success() / .error() / .warning() / .info() / .promise()
        ↓
  shared/notify.ts          ← the only module that names a vendor
        ↓
  sonner
```

This is an owner requirement (2026-08-27) and it is cheap insurance rather than
ceremony: the toast vendor is the single most fashion-driven choice in this manifest,
and the adapter makes replacing it a one-file change.

**Sileo was evaluated and rejected** — `sileo@0.1.5`, physics-based, genuinely the most
visually distinctive option considered. Measured 42.4 kB against sonner's 8.4 kB, almost
all of it the bundled `motion`. Rejected on maintenance, not looks: **all fifteen
releases shipped inside an eight-day window (2026-02-14 → 2026-02-22) and nothing since**;
the repository's last push is the same day as its last release; one contributor has 35
commits and the next has 2; 35k weekly downloads against sonner's 52.3M. npm reports MIT
while GitHub's API detects no license file. Revisit only if it revives.

Sonner's visual defaults are irrelevant here, because the design is custom and it will be
restyled regardless. What is bought is motion and stacking behaviour, and the visual is
fully ours — verified against the installed package:

- **`toast.custom()` is a function** taking arbitrary JSX. Toasts need not be rectangles;
  the entire rendered element is application code.
- **`unstyled: true`** removes sonner's own styling.
- **Sixteen `classNames` slots** — `toast`, `title`, `description`, `loader`, `icon`,
  `content`, `closeButton`, `actionButton`, `cancelButton`, and the per-variant ones.
- The stack is built from `getBoundingClientRect` plus the CSS custom properties
  `--index`, `--offset`, `--initial-height` and `--front-toast-height`, applied as
  `translateY`. **Those variables are available to our own CSS**, so custom stack effects
  compose rather than fight.

The one real constraint: stacking offsets are vertical translations over a measured
bounding box. Arbitrary shapes are fine; a non-vertical arrangement would fight the
library.

### Dev

| group | packages |
|---|---|
| Build | **`babel-plugin-react-compiler` 1.0.0** · `typescript` · `@types/{node,react,react-dom}` |
| Test | `vitest` 4.1.11 · `@vitest/browser` · `@vitest/browser-playwright` · `@testing-library/react` 16.3.2 · `@playwright/test` 1.62.1 · `msw` 2.15.0 |
| a11y | `@axe-core/playwright` 4.13.0 · **`@axe-core/react` 4.13.0** |
| Storybook | `storybook` + `@storybook/{react-vite,addon-a11y,addon-vitest}` 10.5.10 |
| Lint & format | `eslint` 10.9.1 · `typescript-eslint` 8.68.0 · `eslint-plugin-react-hooks` 7.1.1 · `eslint-plugin-react-refresh` · `@eslint/js` · `globals` · `prettier` 3.9.6 |
| Analysis | `knip` 6.32.3 · `size-limit` + `@size-limit/preset-app` 13.0.3 · **`rollup-plugin-visualizer` 7.1.1** |
| Devtools | **`@tanstack/react-query-devtools`** · **`@tanstack/react-router-devtools`** |

React Compiler is stable at 1.0.0 and `@vitejs/plugin-react` already exposes a
`reactCompiler` option — verified by grep against the **currently installed** 6.0.3, so
no upgrade is required to enable it (6.1.0 is merely current). Its lint rules ship in
`eslint-plugin-react-hooks` 7.x (`recommended-latest`), which is already installed and
exposes `purity`, `immutability`, `set-state-in-effect`, `preserve-manual-memoization`
and seven more. **Do not install `eslint-plugin-react-compiler`** — it is still at
`19.1.0-rc.2` and superseded.

## Three latent defects, none of which the library choice touches

**1. The accessibility gate has never run.** `@axe-core/playwright` is installed and has
**zero call sites** anywhere in `e2e/`. The `invariants` CI job reports green while all
91 harvested specs are skipped. Wire axe into a Playwright fixture across every route.

**2. The `size-limit` glob measures the wrong thing.** `package.json` sets
`"path": "dist/assets/*.js"`, which counts lazily-loaded pdfjs chunks against a 320 kB
*shell* budget. The gate is brotli by default in v13 (`@size-limit/file` uses brotli
unless `gzip: true`). Fix the glob before anyone optimises against the number, or the
first red build gets gamed rather than fixed.

**3. Typeahead will eat the single-key vocabulary.** Every candidate kit implements
typeahead in menu, select and combobox. `p`, `c`, `x`, `d`, `g`, `j`, `k` are all
printable. When a composite widget holds focus, its typeahead and the global chord
compete, and this is identical across all five libraries. **This is the real bug
factory, and no ranking addresses it.** The contract to write, once, and test: when any
overlay is open, global chords are suppressed; on close, they resume without requiring a
click. `HANDOFF-UI.md:167` shows the previous build already hit the adjacent problem.

## Open decisions

| | Decision | Cost of doing it now |
|---|---|---|
| 1 | `zod` → `zod/mini` in `packages/contract` | Recovers ~45 kB brotli (contract measures 57.2 kB today, 18% of budget, for a surface using only `nullable` ×124, `int` ×50, `optional` ×36, `min` ×17, `partial`, `extend`, `default`). Mini requires wrapping, not chaining, so it is a codemod over ~230 call sites — not `sed`. Cheapest while `src/` is empty. Touches ADR-0001's territory. |
| 2 | TypeScript 6 → 7 | 7.0.2 (the Go rewrite) is published. Recommendation: **stay on 6.** `typescript-eslint` 8.68 and the Storybook/Vitest chain are unlikely to be ready, and a compiler swap mid-rebuild is a bad trade. |
| 3 | `pdfjs-dist` 5.4.296 → 6.2.108 | The exact pin is correct given CVE history, but a pin with no update signal rots. Adopt Dependabot/Renovate rather than bumping blind. |

## Deviations this requires

Three, to be recorded as BRIEF-DELTAS rather than applied silently:

1. **BRIEF §4 mandates "shadcn CLI, initialized on BASE UI — NOT Radix".** This spec
   selects react-aria-components. shadcn supports it as a first-class base, so the
   *tooling* instruction survives; the *base* changes.
2. **BRIEF §4 lists `react-hotkeys-hook` 5.3.x.** Replaced by `tinykeys`, on evidence
   already recorded in `HANDOFF-UI.md:167`.
3. **BRIEF §4 lists `@hey-api/openapi-ts` and `openapi-typescript`.** Already noted as
   unbuildable in BRIEF-DELTAS **D-5** — no route modules exist to generate from. This
   spec does not resurrect them.
4. **BRIEF §4's "Do not install" list names `framer-motion`, and `eslint.config.js`
   enforces it** via `no-restricted-imports` with the message `"§4 forbidden"`.
   **Reversed by the owner, 2026-08-27.** `motion` (Framer Motion's current package name)
   is adopted. The eslint entry is replaced rather than deleted: the bare `motion`
   namespace import stays banned so that `LazyMotion` + `m` remains the only reachable
   path, per the manifest note. This deviation is the reason the runtime total moved from
   152.9 kB to 175.6 kB, and the owner accepted that trade explicitly.

D-6 (Zod in the browser vs BRIEF §4's Valibot mandate) is **not** resolved here.
Open decision 1 sharpens it: the question is no longer zod-or-valibot but
zod-or-zod/mini, and ADR-0001 already names Zod the browser's boundary parser.

## How this is applied

Run from the repository root. The three open decisions above do **not** block any of
this; the manifest stands whichever way they are ruled.

```bash
# 1. Remove what the rebuild does not use.
pnpm --filter web-v2 remove \
  @base-ui/react radix-ui cmdk valibot react-zoom-pan-pinch react-hotkeys-hook

# 2. Runtime additions.
pnpm --filter web-v2 add \
  react-aria-components @react-aria/interactions @react-aria/live-announcer \
  motion tinykeys @panzoom/panzoom react-error-boundary web-vitals diff

# 3. The table major. Not a bump — a different API (see the Runtime notes).
pnpm --filter web-v2 add @tanstack/react-table@9

# 4. Dev additions.
pnpm --filter web-v2 add -D \
  babel-plugin-react-compiler @axe-core/react rollup-plugin-visualizer \
  @tanstack/react-query-devtools @tanstack/react-router-devtools

# 5. shadcn, on the Aria base. Writes `base` into components.json.
pnpm dlx shadcn@latest init --base aria
```

`sonner`, `lucide-react`, `class-variance-authority`, `tailwind-merge` and `clsx` are
already declared and unchanged.

Three configuration changes accompany the installs, and none is optional:

1. **`vite.config.ts`** — enable the compiler on the existing plugin. `@vitejs/plugin-react`
   6.0.3 already accepts it, so no upgrade is needed:
   `react({ babel: { plugins: [["babel-plugin-react-compiler", {}]] } })` or the plugin's
   `reactCompiler` option.
2. **`eslint.config.js`** — replace the `framer-motion` entry rather than deleting it.
   Permit `motion/react`; ban the bare `motion` namespace import, so `LazyMotion` + `m`
   stays the only reachable path. Add `reactHooks.configs["recommended-latest"].rules` for
   the compiler lint rules. Remove the `zod` ban only if open decision 1 rules for
   `zod/mini`; it is unrelated to this manifest otherwise.
3. **`package.json`** — fix the `size-limit` glob so lazy pdfjs chunks stop counting
   against the shell budget (latent defect 2).

### Acceptance criteria

The manifest is correctly applied when all of the following hold:

- `pnpm --filter web-v2 build` succeeds and `pnpm typecheck` is clean.
- `pnpm --filter web-v2 knip` reports no unused dependencies — in particular, none of the
  six removed packages reappears transitively as a direct import.
- `grep -rn "framer-motion\|from \"motion\"" apps/web-v2/src` returns nothing: every motion
  import is `motion/react`.
- `grep -rn "sonner" apps/web-v2/src` returns exactly one file — the notification adapter.
- `pnpm --filter web-v2 check:rules` passes, with `src/components/ui/` still quarantined.
- The axe fixture runs against every route and fails the build on a violation — i.e.
  latent defect 1 is closed, not merely noted.
- `pnpm --filter web-v2 size` measures only the shell, verified by adding a deliberate
  lazy chunk and confirming the number does not move.

## What would invalidate this

- **The design has not landed.** If it needs a widget react-aria-components lacks, or if
  the geometry-diff harness proves adversarial to RAC's portalled inline positioning and
  wrapper nesting, the kit decision reopens — Base UI is the fallback and needs no
  deviation.
- If the typeahead/chord contract cannot be satisfied per-instance on RAC without
  forking, that is a blocking finding and should be spiked before the first adapter is
  written.

---

## Appendix A — measurement method

All figures are brotli, produced by bundling a realistic import surface and compressing
the output. Not npm tarball size, not bundlephobia (which rate-limits and reports
whole-package size rather than tree-shaken size).

```js
// esbuild → brotli, react external, production define, minified
const r = await build({
  entryPoints: [entry], bundle: true, minify: true, format: "esm",
  write: false, target: "es2022", platform: "browser",
  external: ["react", "react-dom", "react/jsx-runtime"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
});
brotliCompressSync(r.outputFiles[0].contents).length
```

Two cautions learned while doing this:

- **Import the API that exists.** A first pass measured `@tanstack/react-table` v9 at
  0.3 kB because it used v8's `getCoreRowModel` / `flexRender` names, which v9 does not
  export — esbuild tree-shook the lot to nothing. A suspiciously small number means a
  broken entry, not a small library.
- **Resolve the real implementation package.** `radix-ui`, `react-aria-components` and
  `@headlessui/react` re-export from separate directories; grepping the entry package
  returns false negatives. A first pass concluded only Base UI implements typeahead;
  correctly resolved, Zag has 136 such files, Radix 4, Headless UI 4.

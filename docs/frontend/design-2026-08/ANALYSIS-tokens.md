# Design token migration verdict — 2026-08-27

**Inputs.** NEW: `/home/rahul/projects/title-report/design_handoff_titlepipe/tokens.css`
and `tokens.json` (identical values, ~40 custom properties) plus `claude-design-rules.md`
(14 rules). EXISTING: `packages/ui-tokens/src/tokens.css` (94 `--color-*` names, ~200
tokens total), `apps/web-v2/scripts/check-rules.mjs`, `docs/frontend/tokens.md`.

**Stack.** Tailwind v4 `@theme`, target is `apps/web-v2`, `src/` is empty — clean slate,
so this is the cheapest moment in the project's life to delete dead tokens.

**Verdict in one line: migrate values, keep names.** The existing semantic layer absorbs
the new set almost completely. 8 genuinely new names, ~55 deletions, 0 renames forced by
the new values. This is the fifth register to pass through this naming layer and the
fourth time the names survived intact, which is the evidence that they are correct.

---

## 1. Name-by-name mapping

New token → existing name to keep → new value.

| new token | existing name (keep) | new value |
|---|---|---|
| `--ink-900` | `--color-ink-primary` | `#14161c` |
| `--ink-700` | `--color-ink-secondary` | `#454a55` |
| `--ink-500` | `--color-ink-muted` | `#6e7480` |
| `--ink-400` | **new** `--color-ink-faint` | `#8a8e98` |
| `--ink-300` | **new** `--color-ink-disabled` | `#b9bec9` |
| `--accent` | `--color-action` | `#5b4b8a` |
| `--accent-hover` | **new** `--color-action-hover` | `#4c3e75` |
| `--accent-border` | `--color-action-border` | `#c6bae4` |
| `--accent-tint` | `--color-action-surface` | `#f1eef9` |
| `--accent-tint-border` | `--color-action-border-strong` (repurposed) | `#e4ddf4` |
| `--accent-on-dark` | `--color-rail-accent` | `#b7a6ee` |
| `--canvas` | `--color-surface-app` | `#eceef3` |
| `--surface` | `--color-surface-panel` | `#ffffff` |
| `--well` | `--color-surface-sunken` | `#fbfbfd` |
| `--border` | `--color-line-strong` | `#e4e7ed` |
| `--hairline` | `--color-line-subtle` | `#edeff3` |
| `--hairline-soft` | **new** `--color-line-faint` | `#f3f4f7` |
| `--control-border` | **new** `--color-control-border` | `#d6d9e1` |
| `--control-fill` | **new** `--color-control-fill` | `#fbfbfd` |
| `--ok` | `--color-state-settled` | `#2e6b4f` |
| `--ok-bg` | `--color-state-settled-surface` | `#eaf2ed` |
| `--ok-border` | `--color-state-settled-border` | `#c2dec9` |
| `--ok-muted` | **new** `--color-state-settled-muted` | `#9dc0ac` |
| `--warn` | `--color-state-attend` | `#8a5b12` |
| `--warn-bg` | `--color-state-attend-surface` | `#fbf3e4` |
| `--warn-border` | `--color-state-attend-border` | `#f3e7d3` |
| `--bad` | `--color-state-halt` | `#a4291f` |
| `--bad-bg` | `--color-state-halt-surface` | `#fdf3f2` |
| `--bad-border` | `--color-state-halt-border` | `#f2a8a2` |
| `--bad-muted` | **new** `--color-state-halt-muted` | `#e4b0aa` |
| `--dark` | `--color-rail-surface` | `#1e1b2e` |
| `--dark-deep` | **new** `--color-rail-deep` | `#171424` |
| `--dark-text` | `--color-rail-ink` | `#c9c5d8` |
| `--dark-muted` | `--color-rail-ink-muted` | `#8881a2` |
| `--dark-hairline` | `--color-rail-line` | `rgb(255 255 255 / 0.07)` |
| `--paper-scan` | `--color-surface-paper` | `#f7f5ef` |
| `--paper-doc` | `--color-page` | `#fdfcfa` |
| `--paper-border` | `--color-page-line` | `#ddd9d0` |
| `--paper-ink` | `--color-page-ink` | `#2c281f` |
| `--paper-meta` | `--color-scan-ink` | `#5c5647` |
| `--paper-stamp` | **new** `--color-paper-stamp` | `#7c6a55` |
| `--r-kbd` | `--radius-xs` | `4px` |
| `--r-inner` | `--radius-sm` | `6px` |
| `--r-input` | `--radius-md` | `10px` |
| `--r-surface` | `--radius-lg` | `14px` |
| `--r-pill` | `--radius-pill` | `999px` |
| `--r-paper` | **new** `--radius-paper` | `2px` |
| `--font-ui` | `--font-sans` | `'Plus Jakarta Sans',system-ui,sans-serif` |
| `--font-data` | `--font-mono` | `'JetBrains Mono',ui-monospace,monospace` |
| `--font-paper` | `--font-serif` (was `--font-document`) | `'Source Serif 4',Georgia,serif` |
| `--fs-label` | **new** `--text-label` | `11px` |
| `--fs-meta` | **new** `--text-meta` | `13px` |
| `--fs-body` | **new** `--text-body` | `16px` |
| `--fs-subject` | **new** `--text-subject` | `20px` |
| `--fs-title` | **new** `--text-title` | `28px` |
| `--fs-verdict` | **new** `--text-verdict` | `40px` |
| `--shadow-card` | `--shadow-card` | `0 1px 2px rgb(20 22 28/.04),0 10px 28px rgb(20 22 28/.06)` |
| `--shadow-modal` | `--shadow-drawer` → rename `--shadow-modal` | `0 24px 60px rgb(0 0 0/.3)` |
| `--shadow-paper` | `--shadow-page` | `0 1px 2px rgb(0 0 0/.18),0 10px 26px rgb(0 0 0/.13)` |
| `--ease-state` | **new** `--ease-state` | `140ms ease` |
| `--ease-enter` | **new** `--ease-enter` | `260ms cubic-bezier(.32,.72,0,1)` |
| `--ease-move` | **new** `--ease-move` | `300ms cubic-bezier(.32,.72,0,1)` |

### 1a. Concepts with NO existing name — the 8 genuinely new names

1. **`--color-action-hover`** — the existing palette never named a pressed/hover accent;
   hover was alpha-composited over the base. The new set ships an explicit value.
2. **`--color-line-faint`** — existing set has strong / subtle / dashed. The new set adds
   a third-lightest rule (`--hairline-soft`) with no counterpart.
3. **`--color-rail-deep`** — a second, deeper chrome tone for auth screens and code panels,
   below the rail surface.
4. **`--color-paper-stamp`** — clerk-stamp brown. No counterpart anywhere in the old set.
5. **`--color-state-settled-muted`** — desaturated OK, for resting marks.
6. **`--color-state-halt-muted`** — same, for halt.
7. **`--color-control-border` / `--color-control-fill`** — inputs previously borrowed
   `--color-line-strong`. The new set separates *control chrome* from *structural rules*,
   and that distinction is worth keeping: it is why a disabled input can recede without
   the table it sits in receding with it.
8. **`--radius-paper`** — 2px. The "documents are not rounded" value.

Plus the six `--text-*` and three `--ease-*` names, which are new *names* but replace an
existing scale rather than introducing a new concept.

### 1b. Existing names with no new value — deletions

**`--color-document-*` — all 27.** The new set has one dark chrome family (`--dark-*`)
and one paper family. The separate dark-document ink vocabulary is gone.

```
--color-document-accent          --color-document-accent-border   --color-document-accent-surface
--color-document-attend          --color-document-attend-border   --color-document-bg
--color-document-card            --color-document-deep            --color-document-halt
--color-document-halt-border     --color-document-halt-surface    --color-document-info
--color-document-info-row        --color-document-info-surface    --color-document-ink
--color-document-ink-on-accent   --color-document-ink-soft        --color-document-ink-strong
--color-document-kbd-surface     --color-document-line            --color-document-line-strong
--color-document-note-border     --color-document-note-ink        --color-document-note-surface
--color-document-panel           --color-document-settled         --color-document-settled-border
```

**Page-reference chip — 4.** The new set has no separate page-ref hue; page refs are
data and render mono on the ordinary accent.

```
--color-page-ref  --color-page-ref-ink  --color-page-ref-surface  --color-page-ref-border
```

**Retired state families — 7.** The new set has three status families (ok / warn / bad),
not five. `decide` collapses into the accent (an open decision *is* where the accent is
spent, per rule 1) and `idle` collapses into ordinary graphite.

```
--color-state-decide  --color-state-decide-border  --color-state-decide-surface
--color-state-idle    --color-state-idle-border    --color-state-idle-surface
--color-chip-neutral-surface
```

**Rail extras — 6.** The new dark chrome declares text / muted / hairline / accent only.

```
--color-rail-attention-attend  --color-rail-attention-halt  --color-rail-halt-surface
--color-rail-settled           --color-rail-track           --color-rail-ink-active
```

**Off-scale type — 14.** *This deletion is rule 2's enforcement mechanism and is the
single most important item in the list.*

```
--text-micro  --text-tiny  --text-xs   --text-sm   --text-base  --text-md  --text-lg
--text-xl     --text-2xl   --text-3xl  --text-4xl  --text-5xl   --text-6xl --text-census
```

**Off-scale radii — 10.** The numbered scale is what lets someone write `rounded-7`.

```
--radius-1 --radius-2 --radius-3 --radius-4 --radius-5
--radius-6 --radius-7 --radius-8 --radius-9 --radius-10
```

**Strokes — 5.** Superseded by `--color-line-*` plus `--color-control-border`.

```
--stroke-accent  --stroke-emphasis  --stroke-severity  --stroke-stamp  --stroke-structure
```

**Shadows — 8.** Three shadows ship.

```
--shadow-1  --shadow-2  --shadow-3  --shadow-knob
--shadow-pop --shadow-menu --shadow-page-on-dark --shadow-stage-current
```

**Fonts — 2.** `--font-display` and `--font-quote` collapse into `--font-sans` / `--font-serif`.

**Filters — 1.** `--filter-scan-degraded`. `--filter-scan` survives.

Total: **84 token names deleted**, of which ~55 are colour names; the rest are the
off-scale type, radius, stroke and shadow entries.

### 1c. Retained despite having no new value — a judgment call, flagged

`--color-na-*` (9 names) and `--color-scan-*` (5) are **retained**, not deleted, despite
having no counterpart in the new handoff. Rule 14's typed absence taxonomy needs them and
the new token file simply does not cover NA states. **This is a gap in the new set, not
dead weight in the old one.** Do not let a mechanical "delete what the handoff omits" pass
take these; that would collapse `NOT_PRESENT` and `PRESENT_UNREADABLE` into a shared grey,
which AGENTS.md names as a design defect.

---

## 2. Merged Tailwind v4 `@theme` block

```css
/*
 * TitlePipe design tokens — merged set, 2026-08-27.
 *
 * Names are the EXISTING semantic names wherever the concept matched; values are
 * the new handoff's. This is the fifth register through this naming layer and the
 * fourth time the names survived a full revaluation intact. That is the argument
 * for semantic naming, restated as evidence rather than as principle.
 *
 * TWO SCALES ARE DELIBERATELY ABSENT and their absence is load-bearing:
 *   - the numeric --text-* scale (xs…6xl). Rule 2 allows six sizes. Deleting the
 *     scale means Tailwind generates no `text-sm` utility at all.
 *   - the numeric --radius-* scale (1…10). Rule 5 allows six radii with fixed
 *     arithmetic between them.
 * Tailwind failing to generate a class is SILENT, so check-rules.mjs names both
 * families explicitly. Two layers, because a silent failure is not a gate.
 */
@theme {
  /* ── ink ──────────────────────────────────────────────────────────────── */
  --color-ink-primary: #14161c;
  --color-ink-secondary: #454a55;
  --color-ink-muted: #6e7480;
  --color-ink-faint: #8a8e98;
  --color-ink-disabled: #b9bec9;

  /* ── action — spend once per screen (rule 1) ──────────────────────────── */
  --color-action: #5b4b8a;
  --color-action-hover: #4c3e75;
  --color-action-border: #c6bae4;
  --color-action-surface: #f1eef9;
  --color-action-border-strong: #e4ddf4;
  --color-ink-on-action: #ffffff;

  /* ── surfaces ─────────────────────────────────────────────────────────── */
  --color-surface-app: #eceef3;
  --color-surface-panel: #ffffff;
  --color-surface-sunken: #fbfbfd;
  --color-row-hover: #fbfbfd;

  /* ── lines and controls ───────────────────────────────────────────────── */
  --color-line-strong: #e4e7ed;
  --color-line-subtle: #edeff3;
  --color-line-faint: #f3f4f7;
  --color-control-border: #d6d9e1;
  --color-control-fill: #fbfbfd;

  /* ── status: settled / attend / halt ──────────────────────────────────── */
  --color-state-settled: #2e6b4f;
  --color-state-settled-surface: #eaf2ed;
  --color-state-settled-border: #c2dec9;
  --color-state-settled-muted: #9dc0ac;

  --color-state-attend: #8a5b12;
  --color-state-attend-surface: #fbf3e4;
  --color-state-attend-border: #f3e7d3;

  --color-state-halt: #a4291f;
  --color-state-halt-surface: #fdf3f2;
  --color-state-halt-border: #f2a8a2;
  --color-state-halt-muted: #e4b0aa;

  /* ── dark chrome: rail, auth, code panels ─────────────────────────────── */
  --color-rail-surface: #1e1b2e;
  --color-rail-deep: #171424;
  --color-rail-ink: #c9c5d8;
  --color-rail-ink-muted: #8881a2;
  --color-rail-line: rgb(255 255 255 / 0.07);
  --color-rail-accent: #b7a6ee;

  /* ── paper: evidence scans and certificates ───────────────────────────── */
  --color-surface-paper: #f7f5ef;
  --color-page: #fdfcfa;
  --color-page-line: #ddd9d0;
  --color-page-ink: #2c281f;
  --color-scan-ink: #5c5647;
  --color-paper-stamp: #7c6a55;

  /* ── radii — inner = outer − gap (rule 5), asserted in tokens.test.ts ─── */
  --radius-xs: 4px;    /* kbd */
  --radius-sm: 6px;    /* inner, inside a 10px wrapper */
  --radius-md: 10px;   /* inputs */
  --radius-lg: 14px;   /* surfaces */
  --radius-pill: 999px;
  --radius-paper: 2px;

  /* ── type: SIX sizes (rule 2), nothing between ────────────────────────── */
  --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-serif: 'Source Serif 4', Georgia, serif;

  --text-label: 11px;
  --text-meta: 13px;
  --text-body: 16px;
  --text-subject: 20px;
  --text-title: 28px;
  --text-verdict: 40px;

  --tracking-caps: 0.14em;   /* rule 4: sidebar rubrics only */

  /* ── elevation ────────────────────────────────────────────────────────── */
  --shadow-card: 0 1px 2px rgb(20 22 28 / 0.04), 0 10px 28px rgb(20 22 28 / 0.06);
  --shadow-modal: 0 24px 60px rgb(0 0 0 / 0.3);
  --shadow-page: 0 1px 2px rgb(0 0 0 / 0.18), 0 10px 26px rgb(0 0 0 / 0.13);

  /* ── motion (rule 10). Nothing bounces. ───────────────────────────────── */
  --ease-state: 140ms ease;
  --ease-enter: 260ms cubic-bezier(.32, .72, 0, 1);
  --ease-move: 300ms cubic-bezier(.32, .72, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The NA taxonomy tokens (`--color-na-*`) and scan filters carry over from the existing file
unchanged and are omitted above only for length; see §1c.

---

## 3. The 14 design rules — enforceability

| # | rule | verdict | mechanism |
|---|---|---|---|
| 1 | accent spent once per screen | **ENFORCEABLE-BY-PLAYWRIGHT** | Per-route test walks the DOM, reads `getComputedStyle(el).backgroundColor`, counts elements whose computed background equals `rgb(91, 75, 138)`. Assert `<= 1`. Solid fill only: `-border`, `-surface` and `:hover` states are excluded, because the rule is about the *filled* primary action. Runs against every route in the router manifest, so a new screen cannot silently skip it. |
| 2 | six type sizes only (11/13/16/20/28/40) | **ENFORCEABLE-BY-TOKEN-SCALE** | Primary: the numeric `--text-*` scale is deleted, so Tailwind v4 emits no `text-sm` utility. Secondary: `check-rules.mjs` bans `text-(xs\|sm\|base\|md\|lg\|xl\|Nxl)` by name, because Tailwind's failure is silent. Tertiary: the existing `arbitrary-value` rule already bans `text-[13px]`. Three layers, each catching a different spelling of the same mistake. |
| 3 | mono for data only | **ENFORCEABLE-BY-LINT + PLAYWRIGHT** | Lint: `font-mono` must appear on a line that also carries `data-kind=`. Runtime: assert every element computing to JetBrains Mono has `data-kind` in `ref\|money\|citation\|hash\|time\|kbd`. Requires adopting the `data-kind` attribute convention — that is the price of mechanising this one, and it is worth paying because it also makes the data cells addressable in tests. |
| 4 | sentence case; ALL-CAPS only in rubrics and certificate headings | **ENFORCEABLE-BY-LINT** | Ban `uppercase` and `text-transform` everywhere except files matching `/(rail\|sidebar\|certificate)\.(css\|tsx)$/`. Does not catch literally-typed caps inside string literals; that residue is review. |
| 5 | radii arithmetic, inner = outer − gap | **ENFORCEABLE-BY-TEST** | Unit test parses `tokens.css` and asserts `radius.sm === radius.md - 4 && radius.md === radius.lg - 4`. Plus the lint ban on `rounded-\d` / `rounded-2xl` / `rounded-full`, so only the six named radii are spendable. A future palette edit that breaks the arithmetic fails CI rather than shipping. |
| 6 | one status signal per table row | **MANUAL-REVIEW-ONLY** (mark vocabulary) / **ENFORCEABLE-BY-PLAYWRIGHT** (capsule half) | The capsule half is testable: assert no element with a `state-*-surface` background exists inside a `tbody`. "Moments of record" (released, quarantine clear, T1) is a judgment a test cannot make, so the mark-plus-weight half stays review. |
| 7 | no gradients, no emoji, no icon soup | **ENFORCEABLE-BY-LINT** (gradients, emoji) / **MANUAL-REVIEW-ONLY** (icon soup) | `/gradient\|\p{Extended_Pictographic}/u` catches the first two mechanically. "No icon soup" would need an arbitrary count threshold, so it stays review. The glyph vocabulary ✓ ◆ • T1 is small enough that an allowlist is feasible if the review proves insufficient. |
| 8 | evidence and deliverables render as paper | **MANUAL-REVIEW-ONLY** | "Serif, warm stock, clerk stamps, justified text" is a compositional judgment. The negative half ("never grey placeholder bars") is weakly checkable by banning skeleton components inside the evidence feature, but that is a proxy for the rule, not the rule. |
| 9 | every disabled control states its reason | **ENFORCEABLE-BY-LINT** | JSX rule: any line containing `disabled` as a prop must also carry `title=` or sit adjacent to an inline note. Catches the habit. A developer writing `title="disabled"` defeats it, which is the accepted threat model of this gate — accidents and habits, not an adversary. |
| 10 | motion 140ms state / 260–300ms enter | **ENFORCEABLE-BY-LINT** | Ban `duration-[…]`, `duration-N`, `delay-N`, `transition-[…]`, `animate-[…]`. Combined with omitting Tailwind's default duration scale from `@theme`, there is no legal way to write a fourth timing. "Nothing bounces" follows from there being no bouncy easing token to reach for. |
| 11 | numbers reconcile — one variable, never two literals | **MANUAL-REVIEW-ONLY** | The real control is architectural and already in AGENTS.md: the UI never re-derives counts, chain termination, or release resolution. That is enforced by the API shape, not by a line scanner. |
| 12 | roles gate actions visibly, not by hiding | **ENFORCEABLE-BY-PLAYWRIGHT** | Render each route as a role lacking permission; assert the action element is *present*, `disabled`, and its accessible name or `title` contains the rule text. Directly testable because the requirement is stated as observable behaviour. A lint rule banning `{canApprove && <Button…>}` catches the authoring habit earlier. |
| 13 | T1 countersign from a different user | **ENFORCEABLE-BY-API-TEST** | Integration test: the ruling examiner attempts their own countersign, assert HTTP 409. The rule itself specifies "enforce with a 409, not button state", so this is correctly a server test and not a UI concern at all. |
| 14 | absence is typed (4-state NA taxonomy) | **ENFORCEABLE-BY-TYPE + LINT** | Type: `type Absence = 'STRUCTURALLY_ABSENT' \| 'NOT_IN_PACKAGE' \| 'NOT_STATED' \| 'PRESENT_UNREADABLE'` with no `null` member, so a blank does not typecheck. Lint: ban `value === null` and any `!value` feeding `needs_review` — the specific collapse AGENTS.md names, caught six times in prototyping. |

**Tally: 11 enforceable, 3 manual-review-only (6-partial, 8, 11), plus icon-soup carved
out of rule 7.**

---

## 4. What `check-rules.mjs` must change

```diff
--- a/apps/web-v2/scripts/check-rules.mjs
+++ b/apps/web-v2/scripts/check-rules.mjs
@@
   {
     name: "ts-escape-hatch",
     // `as unknown as X` is the standard laundering of `any` and used to pass.
     re: /@ts-ignore|@ts-nocheck|\bas any\b|:\s*any\b|<any>|\bas unknown as\b/,
     why: "no `any`, no @ts-ignore, no `as unknown as` laundering (§6)",
   },
+  // ── DESIGN RULES, 2026-08-27. The token layer enforces rules 2 and 5 by
+  // OMISSION — the numeric --text-*/--radius-* scales are deleted, so those
+  // utilities are not generated. But Tailwind failing to generate a class is
+  // SILENT: `text-sm` renders at the inherited size and nobody sees an error.
+  // These rules turn that silence into a failure. Both halves are needed.
+  {
+    name: "off-scale-type",
+    re: /\btext-(xs|sm|base|md|lg|xl|[2-6]xl|micro|tiny|census)\b/,
+    why: "six type sizes only — text-label|meta|body|subject|title|verdict (rule 2)",
+  },
+  {
+    name: "off-scale-radius",
+    re: /\brounded-(none|full|\d+|2xl|3xl)\b/,
+    why: "radii: rounded-xs|sm|md|lg|pill|paper only, inner = outer − gap (rule 5)",
+  },
+  {
+    name: "gradient-or-emoji",
+    // The glyph vocabulary is ✓ ◆ • T1 and nothing else. \p{Extended_Pictographic}
+    // is the emoji test that does not enumerate codepoints by hand.
+    re: /gradient|\p{Extended_Pictographic}/u,
+    why: "no gradients, no emoji (rule 7) — glyph vocabulary is ✓ ◆ • T1",
+  },
+  {
+    name: "raw-motion",
+    re: /\b(duration|delay)-\[?\d|transition-\[|animate-\[/,
+    why: "motion comes from --ease-state / --ease-enter / --ease-move (rule 10)",
+  },
+  {
+    name: "mono-outside-data",
+    // Mono is for order refs, money, citations, hashes, timestamps, kbd. The
+    // data-kind attribute is how a line declares it is one of those; without
+    // it, font-mono is on a label or a button and the rule is broken.
+    re: /font-mono(?![\s\S]*data-kind)/,
+    why: "mono is for data only (rule 3) — add data-kind, or rules-allow: with a reason",
+  },
+  {
+    name: "na-collapsed",
+    // The exact collapse AGENTS.md names: NOT_PRESENT vs PRESENT_UNREADABLE are
+    // two states, and needs_review is never derived from a null value.
+    re: /value\s*===?\s*null|!\s*value\b[\s\S]*needs_?review/,
+    why: "absence is typed, 4 states, never blank; needs_review is server-owned (rule 14)",
+  },
+  {
+    name: "uncased",
+    re: /\buppercase\b|text-transform/,
+    why: "sentence case; ALL-CAPS only in rail rubrics and certificate headings (rule 4)",
+  },
+  {
+    name: "hidden-when-blocked",
+    // Rule 12: blocked actions render DISABLED WITH THE RULE, never hidden.
+    // The habit this catches is `{canApprove && <Button…>}`.
+    re: /\b(can|may|is)[A-Z]\w*\s*&&\s*</,
+    why: "blocked actions render disabled with the rule, not hidden (rule 12)",
+  },
 ];
+
+/**
+ * Rule 4 exemptions. ALL-CAPS is legal in exactly two places: sidebar rubrics
+ * (11px, .14em tracking) and serif certificate headings. Naming the files IS the
+ * enforcement — anywhere else, caps is a defect rather than a style choice.
+ */
+const CAPS_OK = /(rail|sidebar|certificate)\.(css|tsx)$/;
@@
     for (const b of BANNED) {
+      if (b.name === "uncased" && CAPS_OK.test(rel)) continue;
       if (b.re.test(raw)) {
         add(file, n, b.name, b.why);
       } else if (b.inStrings && stringLiterals(raw).some((s) => b.inStrings.test(s))) {
         add(file, n, b.name, b.why);
       }
     }
```

Two notes on the diff.

**The `arbitrary-value` rule is kept alongside `off-scale-type`.** The scale rule names the
correct class; the arbitrary rule catches `text-[13px]`. They fail on different spellings
of the same mistake and neither subsumes the other.

**`mono-outside-data` and `hidden-when-blocked` are the two most likely to produce false
positives on first run.** Both are escapable via `rules-allow:` with a reason, which is the
right pressure valve now that the hatch demands 12 characters of justification. Expect to
tune these two after the first hundred components exist.

Rule 5's arithmetic and rule 2's cardinality are *tests*, not lints, and belong beside the
existing `contrast.test.ts`:

```ts
// apps/web-v2/src/shared/tokens.test.ts
import { readFileSync } from "node:fs";

const css = readFileSync(require.resolve("@titlepipe/ui-tokens/tokens.css"), "utf8");
const px = (name: string) =>
  Number(css.match(new RegExp(`--radius-${name}:\\s*(\\d+)px`))![1]);

test("radii: inner = outer − gap (rule 5)", () => {
  expect(px("sm")).toBe(px("md") - 4);   // 6 = 10 − 4
  expect(px("md")).toBe(px("lg") - 4);   // 10 = 14 − 4
});

test("exactly six type sizes (rule 2)", () => {
  const sizes = [...css.matchAll(/--text-[a-z]+:\s*(\d+)px/g)].map((m) => Number(m[1]));
  expect(sizes.sort((a, b) => a - b)).toEqual([11, 13, 16, 20, 28, 40]);
});
```

---

## 5. Fonts — self-host, do not use the Google Fonts CDN

Plus Jakarta Sans, JetBrains Mono, Source Serif 4.

### Reasoning, in the order that matters for this product

**Offline / airgap is decisive on its own.** This is an internal enterprise tool for title
examiners. Deployments behind a corporate proxy or on an isolated network will not reach
`fonts.gstatic.com`, and the failure mode is not a graceful fall back to a system font in a
way anyone planned — it is a 30-second DNS timeout per face before first paint. A tool
whose typography depends on the public internet renders differently in the one environment
that matters.

**CSP.** Self-hosting keeps the policy at `font-src 'self'`. The CDN forces
`font-src https://fonts.gstatic.com` **and** `style-src https://fonts.googleapis.com`, and
that second concession is the expensive one: widening `style-src` to a third-party origin
on an application handling title records is a security-review finding waiting to happen.

**FOUT.** The CDN path costs two round trips before a glyph renders: HTML →
`fonts.googleapis.com/css2` → `fonts.gstatic.com/…woff2`. Separate origins mean separate
DNS and TLS handshakes, and connection coalescing does not help across origins. Self-hosted
fonts are same-origin on an already-warm connection and can be preloaded, so the fetch
starts during HTML parse rather than after a CSS round trip.

**Bundle cost is not the constraint people assume.** Three variable families, latin subset,
woff2, is roughly 180 KB total, content-hashed and cached immutably. That is smaller than
the latency cost of the extra round trip on a cold corporate network.

### Implementation

```bash
pnpm --filter @titlepipe/web-v2 add \
  @fontsource-variable/plus-jakarta-sans \
  @fontsource-variable/jetbrains-mono \
  @fontsource-variable/source-serif-4
```

```css
/* apps/web-v2/src/index.css */

/* UI and data faces load eagerly — they are on every screen. */
@import "@fontsource-variable/plus-jakarta-sans/wght.css";
@import "@fontsource-variable/jetbrains-mono/wght.css";

/* Source Serif 4 is PAPER ONLY: evidence scans and certificates. Imported from
   the document feature's own stylesheet so it is code-split out of the shell and
   never downloaded by someone who only works the queue. */

@import "@titlepipe/ui-tokens/tokens.css";

/*
 * font-display: optional, not swap. Fontsource ships `swap`, which is right for
 * content sites and wrong here: reflowing a dense examiner table two seconds into
 * a session is worse than one cold load in the fallback face. `optional` gives the
 * font ~100ms to arrive, then commits for the page and never reflows. With preload
 * + same-origin + HTTP cache, the font wins that race on every load after the first.
 */
@font-face { font-family: 'Plus Jakarta Sans Variable'; font-display: optional; }
@font-face { font-family: 'JetBrains Mono Variable';    font-display: optional; }
```

```css
/* apps/web-v2/src/features/document/document.css — lazy, paper only */
@import "@fontsource-variable/source-serif-4/opsz.css";
```

```html
<!-- apps/web-v2/index.html — preload the two always-used faces -->
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="/assets/plus-jakarta-sans-latin-wght-normal.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="/assets/jetbrains-mono-latin-wght-normal.woff2">
```

`crossorigin` is **required** on font preloads even for same-origin fonts; without it the
browser fetches the file twice. Vite hashes filenames in production, so wire the preload
through a small plugin or read the build manifest rather than hardcoding the path above.

Resulting policy:

```
Content-Security-Policy: font-src 'self'; style-src 'self' 'nonce-…';
```

---

## 6. Open items for owner decision

1. **Rule 1's test needs a ruling on what counts as "spending" the accent.** Proposal:
   solid `background-color` only, excluding `:hover`/`:focus` states and the `-border` /
   `-surface` tints. Without a ruling the test is either trivially passable or unpassable.
2. **Rule 14's four-state taxonomy must be reconciled with the five `--color-na-*` names**
   currently in the token file. The new handoff does not cover NA at all, so this is a
   decision, not a merge.
3. **`data-kind` convention** must be adopted for rule 3 to be mechanically enforceable.
   Cheap now (`src/` is empty), expensive later.

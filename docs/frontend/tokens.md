# Design tokens — audit against the export

**BRIEF §11 deliverable 2.** Phase 1 for `apps/web-v2`, run 2026-07-27.

`packages/ui-tokens` already existed, derived from this same design. Owner direction was
**audit and reuse**, not regenerate. This document is that audit: what the export actually
contains, what the token set gets right, where it has drifted, and what has no token at all.

**Nothing in `tokens.css` was revalued.** `apps/web/src/index.css:14` imports this package,
so every value edit restyles the running app. Only a stale comment block was corrected; every
value question is listed in §7 for decision.

---

## 1. Method

Values were extracted **mechanically** from
`design-export/TitlePipe reviewer.zip → TitlePipe.dc.html` (3,536 lines) rather than by
reading, because the design is authored as ~1,400 inline `style="…"` attributes and a reader
will miss values that a regex will not. Every `style` attribute and `<style>` block was
parsed and every declaration tallied by property, with use counts.

**Scope limit, stated rather than implied** (`phase2-audit.md` §3.3): the extraction covers
`style="…"` attributes and `<style>` blocks — where this design's styling lives — but not the
whole file. A whole-file scan finds 32 distinct 6-digit hex literals; the style-scoped scan
finds 31. The one missed, `#eceef2`, sits outside both and was already tokenised as
`--color-chip-neutral-surface`, so nothing followed from it. Any future colour question should
use the whole-file scan.

Counts below are **uses in the export**, which is what makes them evidence rather than opinion.

## 2. What the export actually defines

The export declares **21** custom properties in one `:root` block. `tokens.css` defines **135**.

```
--ground  --panel  --paper
--ink  --ink2  --ink3
--rule  --rule2
--violet  --violet-ink  --violet-tint  --violet-tint2
--green  --green-tint
--red  --red-tint  --red-ink
--amber  --amber-tint
--marker  --marker-edge
```

So **114 of 135 tokens have no counterpart in the export.** They are semantic names imposed
over raw literals, which is exactly what BRIEF §5 Phase 1 asks for — but it means most of the
token set is a judgment call, not a transcription. This audit's job is to say which.

Measured use of the export's own variables — this is the design's real weighting:

| var | uses | | var | uses |
|---|---:|---|---|---:|
| `--ink3` | **169** | | `--violet-tint` | 28 |
| `--rule` | 151 | | `--violet-tint2` | 27 |
| `--panel` | 119 | | `--ground` | 22 |
| `--violet` | 110 | | `--amber-tint` | 17 |
| `--ink2` | 105 | | `--red-tint` | 16 |
| `--rule2` | 57 | | `--green-tint` | 14 |
| `--ink` | 40 | | `--red` | 13 |
| `--red-ink` | 36 | | `--violet-ink` | 11 |
| `--amber` | 30 | | `--marker` | 9 |
| `--green` | 29 | | `--marker-edge` | 8 |
| | | | `--paper` | 2 |

**`--ink3` is the single most-used value in the entire design.** That matters for §4.

## 3. Confirmed correct

Verified against the extraction, no action needed:

- **All 21 export variables** are represented, with values matching exactly.
- **The five "ORPHANED IN SOURCE" colours** are real and correctly identified — they appear
  in the export as raw literals with no `--var` behind them:
  `#eec6c1` (19 uses) · `#e6d3a3` (14) · `#bfe0cb` (10) · `#1f5738` (8) · `#6d4c0c` (7).
  These are the state *borders* and *ink-on-surface* values; naming them was correct.
- **`--color-surface-sunken: #fbfbfc`** — appears 6× as a raw literal on section sub-headers
  and table caps. Correct value, correct meaning.
- **Fonts** — IBM Plex Sans / Mono / Serif, all three used. Mono 122 uses, Serif 15.
  The serif-as-human-testimony reading holds: every Serif use is quoted or rendered
  document text, never machine output.
- **`--filter-scan`** — `grayscale(.4) contrast(.94)` appears in the export on a rendered
  page. Correctly captured.
- **`tp-pulse`** is the export's only `@keyframes`. Correctly captured.
- **`prefers-reduced-motion`** — the export ships a global kill for `animation` and
  `transition`. Correctly carried over.

## 4. The one deliberate deviation, re-measured and upheld

`tokens.css` darkens `--color-ink-muted` from the design's `#8a8e99` to `#616673` because
the design value fails WCAG AA on every surface it sits on.

The extraction **strengthens** this decision rather than weakening it: `--ink3` is used
**169 times, more than any other value in the design**. It is the eyebrow-label, meta and
"recede" tier — nearly every screen's smallest text. Shipping it at 2.65:1 on the app
background would make the most-repeated text in the product the least legible.

Upheld. No change.

## 5. Drift — correct when written, wrong now

### 5.1 The `--color-document-*` comment block is stale and contradicts an owner decision

`tokens.css:155–172` states the dark pane *"applies everywhere PdfPane appears: Review,
Extraction Bench, Reconciliation, Seed Correction."*

`decisions.md` **D2 was reversed by the owner on 2026-07-26**: *"the design-mock pane ships
as drawn"* — Review takes the light pane; only the three measurement screens stay dark.
The comment block still argues for the superseded position and names Review first.

The extraction confirms the export draws it light: `#dcdde3` appears once, on
`flex:1 1 52%` — the left document pane — and nowhere else.

**Corrected in this pass** (comment only, no value changed). The 27 `--color-document-*`
tokens stay: the three dark measurement screens still need them.

### 5.2 `--shadow-page` alpha no longer matches its surround — **needs a decision**

| | value |
|---|---|
| Export | `0 4px 22px rgba(20,20,30,.22)` |
| `tokens.css` | `0 4px 22px rgb(20 20 30 / 0.45)` |

The alpha was raised to `.45` so the page would lift off a **dark** pane. With D2 reversed
and Review shipping the light `#dcdde3` pane, `.45` is a shadow tuned for a surround that
Review no longer has.

Not changed — it is a visible change to `apps/web`, which imports this file live. See §7 Q1.

## 6. Gaps — values in the export with no token

### 6.1 Colour

| Value | Uses | What it is | Note |
|---|---:|---|---|
| `#5a3fa0` | 4 | mid-violet, used as `1.5px solid #5a3fa0` on a violet callout whose text is `--violet` | sits between `--violet` `#4a2fae` and `--violet-ink` `#392291`. No token. |
| `#232327` | 4 | **ink on the rendered page** — IBM Plex Serif, 12.5px, line-height 1.95 | |
| `#2a2a2e` | 2 | **ink on a scanned page** — IBM Plex Mono, 11px, line-height 2.1 | |
| `#33333a` | 1 | ink on a degraded scan, under `filter: grayscale(.4)` | |

`tokens.css` has `--color-page`, `--color-scan` and `--color-surface-paper` for the page
**backgrounds** but **no token for the ink printed on them**. That is a real hole: document
text is the product's dominant visual, and three distinct ink weights are drawn.

### 6.2 Elevation

Four of the export's seven shadows have no token:

| Export | Uses | What it is |
|---|---:|---|
| `0 1px 3px rgba(0,0,0,.25)` | 3 | **toggle-switch knob.** Every use is a 20×20 `border-radius:50%` white circle, absolutely positioned at a computed `left`. Not a card shadow. |
| `0 0 0 1.5px var(--green) inset` | 1 | an inset ring marking a settled/selected state |
| `0 1px 0 var(--rule)` | 1 | a hairline underline |
| `0 0 0 1px` | 1 | focus/selected ring |

Separately: **`--shadow-card` has no counterpart in the export at all.** The design uses no
card shadow — cards are separated by `1px solid var(--rule)` (116 uses), not by elevation.
`--shadow-card` was carried over from the old warm-paper palette. It is an addition, and if
it is applied to cards in web-v2 the result will be more elevated than the design draws.

### 6.3 Type — no leading, weight, or off-scale tracking tokens

- **`line-height`: 14 distinct values, 119 uses, zero tokens.** Dominant: `1.45` (39),
  `1.35` (18), `1.5` (18), `1.4` (14), `1` (12). The document-page values `1.95`, `2.1`,
  `2.2` are semantic — they are what makes a rendered page read as a typed document.
- **`font-weight`: 4 values, zero tokens.** `600` (294), `700` (150), `500` (14), `400` (1).
  The design is almost entirely 600/700; 400 appears once.
- **`letter-spacing`: 18 values, 3 tokens — but this is not the gap it looks like.**
  The three tokens cover `.14em`, `.1em`, `.16em` (101 uses). The next four are `.12em` (18),
  `.08em` (15), `.06em` (15), `.09em` (14) — 62 uses.

  Checking what they are actually applied to: **all four sit on the same declaration
  pattern** — `font-size: 9px` (occasionally 9.5px) + `text-transform: uppercase`. They are
  not four roles. They are **one role — the uppercase eyebrow label — drawn at four
  inconsistent trackings**, and `--tracking-badge` (`.1em`, 67 uses) is already the most
  common value in that same band.

  So these do **not** get four new tokens. Minting `--tracking-a/b/c/d` would encode a
  design inconsistency as vocabulary and guarantee it survives the rebuild. They normalise
  onto the existing eyebrow/badge tokens. Recorded here so the normalisation is a decision
  on the record rather than a silent rounding.

### 6.4 Layering

`z-index` is used at 4 levels — `3`, `20`, `40`, `50` — with no tokens. Top chrome is `20`;
`50` is the highest. A modal/drawer/popover stack needs these named or they will be
re-guessed per component.

### 6.5 Control sizing

63 distinct fixed px dimensions. Most are one-off layout widths, but a clear control scale
repeats: `26px` (20 uses), `22px` (12), `20px` (9), `24px` (7), `40px` (7), `44px` (4),
`42px` (4), `52px` (4). No size tokens exist.

## 7. The imposed scales — what rounding actually costs

`tokens.css` imposes a 12-step type scale and a 13-step space scale over the design's ad-hoc
values. That is the right call; this section measures the price so it is a known price.

**Spacing — 31% of uses land off-scale.**
Scale: `2 4 6 8 10 12 14 16 18 22 28 32 40`.
Off-scale, by use count: `9px` (82) · `11px` (67) · `5px` (66) · `7px` (53) · `3px` (49) ·
`13px` (34) · `15px` (26) · `20px` (22) · `1px` (10) · `52px` (7) · `24px`/`30px`/`50px` (5 each) ·
`26px`/`34px` (3) · `36px`/`56px` (1).
**413 of 1,415 spacing uses round** (the 440 figure was computed against the 13-step scale,
before 20 and 24 were added).

**CORRECTION (audit, 2026-07-27).** This section previously said "most move ±1px" and that 20px
was "the exception". Measured against the shipped 15-step scale, which terminates at 40:

| design | → | shift | uses |
|---:|---|---:|---:|
| 56px | 40px | **16px** | 1 |
| 52px | 40px | **12px** | 7 |
| 50px | 40px | **10px** | 5 |
| 36px | 32px | 4px | 1 |
| 34/30/26px | 32/28/24px | 2px | 11 |

**25 uses shift by more than 1px, and the worst is 8× the stated worst case.** The scale has no
step above 40px, so every larger value collapses onto it. Those are section gaps on the widest
layouts; if any of them reads as cramped when the screens land, the scale needs a step at 52.

**Type — 18% of uses land off-scale.**
Off-scale: `11.5px` (46) · `10.5px` (28) · `9.5px` (18) · `15px` (9) · `8.5px` (8) · `8px` (7) ·
`17px` (4) · `13.5px` (3) · `23px` (2) · `20px` (1).
**126 of 693 uses round**, and 95 of those are the half-steps `11.5 / 10.5 / 9.5 / 13.5`.
The half-step tier is a real part of this design's density — worth confirming it may round.

**Radius — clean.** 11 simple px radii + `50%`; the 6-step scale covers them with ±1px.
Four compound radii (`6px 0 0 6px`, `0 6px 6px 0`, `9px 9px 0 0`, `0 0 9px 9px`) are
segmented-control and stacked-card shapes, correctly left to components.

## 8. Motion — there is almost nothing to extract

Worth stating plainly, because BRIEF §5 Phase 1 asks for motion durations:

- **One** `@keyframes` in the entire export: `tp-pulse`.
- **One** animation use: `tp-pulse 1.4s infinite`. The `1.4s` has no token.
- **Zero** `transition` declarations, other than the `none!important` reduced-motion kill.

The design does not animate state changes at all. `tokens.css` adds two further keyframes
(`tp-highlight-arrive`, `tp-act-ring`) ported from the old palette; both are semantic and
`tp-act-ring` is pinned by `sidebar.spec` #2, so both are justified — but they are
**additions to the design, not extractions from it**, and should be recorded as such.

## 9. Resolved and applied

Owner direction 2026-07-27: **add the missing families additively**, and **match the export
on elevation**.

### 9.1 Tailwind namespace collisions — the thing that nearly went wrong

`packages/ui-tokens` is imported by `apps/web/src/index.css`, and these tokens sit in a
Tailwind v4 `@theme` block. **`@theme` names are not inert CSS variables — they redefine
Tailwind's generated utilities.** A `var()`-only grep does not find those consumers, and a
first pass here wrongly concluded the edits carried no risk. Two real collisions were found
by grepping for the *utility class* form instead:

| Token | Utility it redefines | apps/web uses | Resolution |
|---|---|---:|---|
| `--shadow-page` | `shadow-page` | **6** | Retuned to `.22` anyway — the owner chose "match the export" knowing it restyles `apps/web`. 5 of the 6 sites are dark/scan screens that will move to `--shadow-page-on-dark` when rebuilt. |
| `--leading-relaxed` | `leading-relaxed` | **31** | **Avoided.** Tailwind's default is `1.625`, a value this design never uses; redefining it would have silently retightened 31 sites. The scale was renamed to `-flat/-close/-body/-open/-airy`, which collide with nothing. |

Checked and clear:

- **`--space-*` is not a Tailwind namespace** — spacing utilities come from `--spacing`, which
  is defined nowhere in this repo, so `mt-2`/`gap-3` and friends resolve to Tailwind's own
  default. `apps/web` uses those utilities heavily but no `--space-*` token. Renumbering the
  scale in place was safe.
- **`--font-weight-*`** redefines `font-normal/medium/semibold/bold`, which `apps/web` uses
  249 times — but the four values are identical to Tailwind's defaults, so nothing moves.
- **`--size-*`** generates `size-*` utilities; `apps/web` uses none.
- **`--leading-tight`** is kept despite colliding, because its value *is* Tailwind's `1.25`.

**Rule going forward:** before adding or revaluing any `@theme` token, grep `apps/web` for the
*utility* name, not just `var(--token)`. This is the only coupling between the two apps until
cutover.

### 9.2 Verified against the built CSS, not asserted

`pnpm --filter web build` passes, and the emitted stylesheet confirms all three predictions:

| Check | Built output | Reading |
|---|---|---|
| `.shadow-page` | `0 4px 22px var(--tw-shadow-color, #14141e38)` | `0x38` = 56/255 = **.22**. The retune did reach `apps/web` — the flagged restyle is real, not theoretical. |
| `--leading-relaxed` | `1.625` | Tailwind's default survives. The rename worked; the 31 sites are untouched. |
| `--leading-body`, `--color-page-ink`, `--z-modal`, `--space-15` | **absent** | Tailwind v4 tree-shakes `@theme` tokens no utility references. The 31 additive tokens add **zero bytes** to `apps/web`. |

That last row is the general result worth keeping: **additive tokens are free**, so the cost of
this phase falls entirely on the two deliberate revaluations, not on the additions.

**Applied to `tokens.css`:**

| Change | Detail |
|---|---|
| `--color-document-*` rationale | rewritten to state the D2 reversal; Review is light, only the three measurement screens are dark. No value touched. |
| `--shadow-page` | `.45` → **`.22`**, the export's own value. |
| `--shadow-page-on-dark` | **new** — keeps `.45` for the three dark screens, where `.22` disappears against `#23252b`. |
| `--shadow-card` | value unchanged, but marked **NOT DRAWN BY THE DESIGN**. The export separates cards with `1px solid var(--rule)` (116 uses). Not to be used on cards in web-v2. |
| `--shadow-knob` | **new** — the toggle-knob elevation, the export's only other shadow. |
| space scale | gains `20px` and `24px`; renumbered `--space-1…15`. |
| page ink | **new** — `--color-page-ink`, `--color-scan-ink`, `--color-scan-ink-degraded`. |
| `--color-action-border-strong` | **new** — `#5a3fa0`. |
| leading | **new** — 8 tokens, `--leading-flat/-tight/-close/-body/-open/-airy/-document/-scan`. Was 14 values, 119 uses, zero tokens. Named off Tailwind's defaults on purpose — see §9.1. |
| weight | **new** — 4 tokens. |
| layering | **new** — `--z-raised/-chrome/-drawer/-modal` for the 4 observed levels. |
| square control sizes | **new** — 7 tokens, `--size-control-xs…3xl`. |

**Deliberately NOT added: the four missing tracking values.** See §6.3 — they are one role
drawn at four inconsistent trackings, not four roles. Tokenising them would encode the
inconsistency. They normalise onto `--tracking-badge`.

**Also not added: semantic names for the square control sizes.** The export reuses `26px`
for a logo mark, a status circle and a segmented-control cell — three unrelated things. Naming
them by role would invent semantics the design does not have, so they are sized, not named.

Token count: 135 → **162**.

## 9.3 Token → utility mapping, measured (Phase 3 prep)

A token that generates no Tailwind utility forces components into arbitrary values, which §6
forbids — so before building primitives against these names, each was probed by using it in a
throwaway component, building, and grepping the emitted CSS.

**Generate utilities correctly** (verified in built CSS): `--color-*` → `text-`/`bg-`/`border-` ·
`--text-*` → `text-` · `--tracking-*` → `tracking-` · `--leading-*` → `leading-` ·
`--font-weight-*` → `font-` · `--radius-*` → `rounded-` · `--shadow-*` → `shadow-` ·
`--size-*` → `size-`.

**Two that do not, and what to do instead:**

### `--space-*` generates nothing — the spacing grid comes from `--spacing`

Tailwind v4 derives every `p-`/`m-`/`gap-` utility from a single `--spacing` base unit.
`--space-*` is not a namespace, so the 15-step scale emits no utilities at all.

`apps/web-v2/src/index.css` sets `--spacing: 2px`, which makes the design's even values plain
utilities — `p-1`=2px, `p-4`=8px, `p-10`=20px, `p-20`=40px. Read `p-N` as `N × 2px`. Verified:
`.p-8{padding:calc(var(--spacing) * 8)}`.

**CORRECTION (audit, 2026-07-27).** This section previously said "the design's spacing is
entirely on a 2px grid", and `index.css` asserted the same as a measurement. **It is false.**
Measured: **388 of 1,415 spacing uses (27.4%) are odd pixels** — 9px(82) · 11px(67) · 5px(66) ·
7px(53) · 3px(49) · 13px(34) · 15px(26) · 1px(10). Only 72.6% is even.

The 2px grid remains the right call — it is the dominant rhythm and it makes most values
expressible without arbitrary values. But it is an IMPOSED grid, not a described one, and the
odd values round rather than fit.

**This is set in web-v2's CSS, never in `packages/ui-tokens`.** `apps/web` uses `mt-2`/`px-2`/
`gap-3` against Tailwind's 4px default; `--spacing` in the shared package would halve every one
of them. Same collision class as `--leading-relaxed` in §9.1.

`--space-*` therefore survives as the **semantic record of the design's scale**, not as the
mechanism. Do not reach for `p-[var(--space-4)]`.

### `--z-*` generates nothing — use the custom-property shorthand

There is no z-index theme namespace in Tailwind v4; its `z-` utilities take bare numbers.
Probed: `z-modal` does not exist. Both of these do, and emit correctly:

```
z-(--z-modal)        →  .z-\(--z-modal\){z-index:var(--z-modal)}
z-[var(--z-drawer)]  →  .z-\[var\(--z-drawer\)\]{z-index:var(--z-drawer)}
```

**Convention: `z-(--z-popup)` / `z-(--z-overlay)`** — the v4 shorthand. It is not an arbitrary
value, so it neither trips the §6 grep nor reads as one in review. (The tokens were renamed
from `--z-drawer`/`--z-modal` during Phase 3: the old names described one consumer rather than
the layer, and `--z-drawer` was in fact being used by the *menu*.)

### `--filter-*` generates nothing either — use `@utility`

Found in Phase 4. `filter-scan` produced no CSS at all, which would have rendered every source
page as a clean scan — precisely the wrong impression, since the product exists because most
pages are degraded. There is no `--filter-*` theme namespace in Tailwind v4.

Declared explicitly in `apps/web-v2/src/index.css`:

```css
@utility filter-scan { filter: var(--filter-scan); }
@utility filter-scan-degraded { filter: var(--filter-scan-degraded); }
```

The same `@utility` route carries `na-hatch`, the `silent` no-value state's diagonal hatch —
its gradient has raw pixel stops, and §6 keeps those out of TSX.

### The general rule

**Three token families in a row generated no utilities** — `--space-*`, `--z-*`, `--filter-*`.
Tailwind v4 only recognises a fixed set of theme namespaces; everything else is an inert CSS
variable that a component can reference but a class name cannot. Nothing warns you: the class
is simply absent from the output and the element renders unstyled.

**So: after adding any token family, use it in a throwaway component, build, and grep the
emitted CSS for the class.** That check has now caught three real defects and costs a minute.

### `--stroke-*` emits the WRONG property — and defeats the check prescribed above

Found by the audit, and it is the nastiest of the four because it passes the test this document
recommends. `--stroke-*` IS a Tailwind namespace — but it is the SVG **paint** namespace:

```
.stroke-emphasis { stroke: var(--stroke-emphasis); }
```

`stroke: 1.5px` is not a valid `<paint>` value, so the declaration is dropped. The class **is
present in the emitted CSS**, so "build and grep for the class" returns a **false pass**.

web-v2 does not hit this — it uses `border-(length:--stroke-emphasis)`, which reads the token as
a length and works. But the trap is one autocomplete away, and the general rule above is not
sufficient to catch it. **Grep for the emitted PROPERTY, not just the class.**

### `--text-*` collides with Tailwind's built-ins — 82 sites in `apps/web`

`--text-xs/-sm/-base/-lg/-xl/-2xl/-3xl` redefine Tailwind's own scale. `apps/web` uses
`text-sm`×51, `text-xs`×17, `text-base`×7, `text-lg`×3, `text-xl`×3, `text-3xl`×1 — and the
shifts are large (`text-base` 16px→12.5px, `text-3xl` 30px→22px). §9.1 above lists two
collisions and a "checked and clear" list; this one is in neither, so §9.1's own rule was not
applied to it. There is no *new* drift — the legacy `@theme` never defined these, so `apps/web`
has always rendered at the new sizes — but the omission was luck, not diligence.

## 10. Still open

| # | Question | Blocks |
|---|---|---|
| Q1 | Do the three dark measurement screens keep `--shadow-card`, or do they get a border treatment too? Currently retained for them only. | the 3 dark screens |
| Q2 | The half-step type tier (`11.5 / 10.5 / 9.5 / 13.5`, 95 uses) rounds onto the 12-step scale. Confirm that density loss is acceptable. | every dense table and chip |
| Q3 | `tp-highlight-arrive` and `tp-act-ring` are **additions**, not extractions — the export animates nothing but `tp-pulse`. Keep both? `tp-act-ring` is pinned by `sidebar.spec` #2. | the navigator, click-to-source |

## 11. CI enforcement — not yet added

BRIEF §5 Phase 1 requires greps for `#[0-9a-fA-F]{3,6}` and `\[[0-9]+px\]` outside
`packages/ui-tokens`. **Not added.** `apps/web-v2` has no `package.json`, no build and no CI
wiring yet — the stack install is Phase 1's other half and has not been run, pending the
scaffolding decisions above. The greps land with it.

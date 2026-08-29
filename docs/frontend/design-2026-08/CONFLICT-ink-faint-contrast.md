# `CONFLICT` — `--color-ink-faint` vs WCAG 2.2 AA

**Status: UNRESOLVED. Needs an owner ruling — the fix is a token value.**
**Raised:** 2026-08-28, from an axe pass over nine screens at 1360px and 1920px.
**Governing procedure:** `docs/INVARIANTS.md:26-27` — a rule a design cannot satisfy is a
`CONFLICT` in the design, reported rather than weakened. `PRODUCT.md` §Accessibility states the
standard this collides with, and states it as enforced:

> **Self-imposed WCAG 2.2 AA.** … It is enforced, not aspirational: axe runs at `error` on every
> Storybook story, contrast ratios are measured and recorded where the visual spec and WCAG
> disagree.

This file is that record. No token value was changed and no screen was recoloured to hide it.

---

## 1. The measurement

`--color-ink-faint` is `#8A8E98`, taken verbatim from the design system, and it is the ink on
every 11px label in the app. Against a 4.5:1 floor for normal-size text:

| ink | on `surface-panel` #ffffff | on `surface-sunken` #fbfbfd | on `surface-app` #eceef3 | on `action-surface` #f1eef9 |
|---|---|---|---|---|
| **`ink-faint` #8a8e98** | **3.28 ✗** | **3.17 ✗** | **2.83 ✗** | **2.86 ✗** |
| `ink-muted` #6e7480 | 4.69 ✓ | 4.54 ✓ | 4.04 ✗ | 4.10 ✗ |
| `ink-secondary` #454a55 | 8.88 ✓ | 8.60 ✓ | 7.65 ✓ | 7.76 ✓ |

**`ink-faint` clears 4.5:1 on no surface in this palette.** It is not "mostly fine with a residual
on the canvas" — it is never legal for normal text anywhere, and every 11px label in the product
is normal text (WCAG's large-text exemption starts at 18.66px bold / 24px).

Measured with axe-core 4.13, tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`, over `/`, `/queue`,
`/ingest`, `/escalations`, `/delivery`, `/account`, `/orders/{id}` and `/dashboard`. After every
violation this app owns was fixed, **60 nodes remain and all 60 are this one token.**

## 2. Why the screens cannot fix it

They already did, where it was theirs. `field-chrome.ts:62-64` had recorded the neighbouring case
and drawn the correct line:

> `--color-ink-muted` (#6E7480) is the nearest tier that clears it — 4.69:1 on panel, 4.54:1 on
> sunken … Note the residual: 4.04:1 on `--color-surface-app`. A form label belongs on a card, not
> on the canvas, so that is the correct constraint rather than a hole — but a screen that puts one
> on the bare canvas will fail axe, and that is the intended signal, not a bug in this token.

That reasoning is right and was applied: five places had put muted ink on the bare canvas, and they
were stepped to `ink-secondary`. Two screen eyebrows went with them.

It does not rescue `ink-faint`, because `ink-faint` fails **on the card too**. There is no surface
to move a label onto. The remaining 60 nodes are labels doing exactly what the design says: 11px,
`#8A8E98`, on a white card.

## 3. The second finding: an annotation that does not match the render

`--color-rail-ink-muted: #8881a2; /* 5.03:1 — rubrics, resting labels */`

Two things are wrong with that comment.

- Against the bare rail (`--color-rail-surface` #1e1b2e) it measures **4.56**, not 5.03.
- The app does not render it on the bare rail. The quick-jump button carries
  `rgba(255 255 255 / 0.07)` (`--color-rail-line`), which composites to **#2e2b3d**, where the same
  ink measures **3.73** — and that is what axe reports, 7 nodes of it.

So a recorded ratio is both inaccurate and measured against a surface the component does not use.
`ink-faint` is meanwhile the only ink in the file with **no** ratio annotation at all, while
`--color-ink-on-action` and `--color-rail-ink-muted` both carry one. The token most in need of the
note is the one without it.

## 4. The options, for the owner

**Option A — Darken the token. One line.** (Recommended.)
`#8A8E98` → `#686C76` clears 4.5:1 on all four surfaces (worst case 4.53, on the canvas). It is the
same hue darkened 34 steps, so the ramp keeps its five tiers and every label stays quieter than
body text. **Cost:** one value. **Risk:** it deviates from the design system's `:root`, which
REVIEW-03 verified as 62 values present verbatim — so the deviation must be recorded beside the
token, not made silently.

**Option B — Retire `ink-faint` as a TEXT colour.** Point the 57 text call sites at `ink-muted` and
keep `ink-faint` for borders, rules and disabled marks. **Cost:** 57 sites across 41 files.
**Risk:** it collapses two tiers of the ink ramp into one wherever both were used together, and
`ink-muted` still fails on the canvas and on `action-surface`, so it is not a complete fix.

**Option C — Rule that 11px labels are exempt.** They are not, under WCAG — the large-text
exemption starts at 18.66px bold. This option means dropping the AA claim in `PRODUCT.md` from
"enforced" to "enforced except for label text", which is a product decision and not a small one
given the operating context: examiners read scanned documents for extended sessions.

**Option D — Do nothing, record only.** The 60 nodes stay and this file is the record.
`PRODUCT.md`'s "measured and recorded where the visual spec and WCAG disagree" arguably permits it.
**Risk:** the two contrast defects `PRODUCT.md` cites as caught-by-the-gate were caught because the
gate was believed. A standing 60-node failure trains everybody to read the axe output as noise.

## 5. What must not happen

- **Do not recolour individual labels to dodge the gate.** The pairing is one token used as
  designed; fixing it 60 times in components is 60 places for it to come back, and it is the
  defect `check-rules`' hardcoded-colour rule exists to prevent arriving through a different door.
- **Do not change the token without recording the deviation** beside it and in
  `ANALYSIS-tokens.md`. REVIEW-03 verified all 62 design values present verbatim; a silent
  divergence makes that verification a lie for the next reader.
- **Do not fix the rail annotation by editing the number alone.** The comment is wrong about the
  surface as well as the ratio, and a corrected number against the wrong surface is the same
  defect one digit better.

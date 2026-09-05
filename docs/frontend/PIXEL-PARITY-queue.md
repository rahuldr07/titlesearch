# PIXEL PARITY — `/queue` against the prototype, 2026-09-05

Card TP-8, measured after TP-2 built the screen. Geometry and palette only;
none of the prototype's facts were copied.

## The prototype has no Queue artboard, so there is nothing to subtract

`reference-app.html` draws no queue. Its internal screen named `queue` is
labelled **Overview** in the rail and **"Queue & Pipeline Overview"** in the
command palette, and the browsable table with Assigned/Due columns is the
**All Orders** screen. There is therefore no reference image of this screen to
diff against, and a screenshot comparison would be comparing our queue with
somebody else's screen.

What *is* comparable is the vocabulary both are built from — app shell, rail,
screen title, card, the two control sizes, the text input. So this is a
measurement of that vocabulary, not an image diff.

## Method, and how to re-run it

```
pnpm --filter @titlepipe/web reference:unbundle -- --out /tmp/tp-reference
pnpm --filter @titlepipe/web build && pnpm --filter @titlepipe/web preview --port 4788
pnpm --filter @titlepipe/web reference:parity -- \
    --reference /tmp/tp-reference --app http://localhost:4788
```

`scripts/reference-app.mjs` recovers the export into a directory a browser can
open: the file holds a JSON asset map (the prototype's JS and seven font
families, base64 gzip) and a JSON *string* of ~393 KB of page HTML that loads
those assets by bare uuid. Written out side by side, the relative `src`s
resolve and **the prototype boots** — verified at 1440×960 with zero page
errors. Every number below is `getComputedStyle`/`getBoundingClientRect` on
the running thing, in one Chromium, at one viewport. A class name being
present proves nothing about whether a rule was emitted; REVIEW-04 established
this method for that reason.

Screenshots land beside the unbundled prototype (outside the working tree —
the fonts alone are ~500 KB of binary and this repository is public).

## What the prototype paints, measured rather than quoted

Its Overview screen, every visible element:

| | values, by frequency |
|---|---|
| type sizes | **13px ×87**, **11px ×59**, 16px ×13, 10.5px ×7, 28px ×6, 20px, 18px, 22px |
| weights | 400 ×90, 600 ×56, 700 ×33, 800 ×2 |
| families | Plus Jakarta Sans ×134, JetBrains Mono ×47 — and nothing else |
| radii | **14px ×54**, 50% ×13 (avatars), 999px ×11 (pills), 12px ×1, 4px ×1 |
| ink | #8A8E98 ×51, #14161C ×26, #B9BEC9 ×22, #6E7480 ×16, #454A55 ×15, #C9C5D8 ×11 (rail), #A6A0BE, #8881A2, #5B4B8A ×4, #B7A6EE, #2E6B4F |
| fills | #FFFFFF ×38, #F7F6FC ×10, rgba(255,255,255,.1) ×6, #5B4B8A ×5, #F1EEF9 ×5, #2E6B4F ×4, #ECEEF3 ×3, #1E1B2E ×2, #EDEFF3 ×2 |

Three things that were not previously written down, and one correction:

- **The prototype has essentially one radius.** 14px on 54 of 80 rounded
  elements; the pills and avatars are the only other shapes. It does not have
  a radius ladder.
- **Its well is lilac-tinted**, `#F7F6FC`, not a neutral off-white.
- **Two families, no third.** Everything is Plus Jakarta Sans or JetBrains
  Mono.
- **Correction to `CONFLICT-deleted-queue-and-rail-controls.md` §4.** The
  1360px floor is real and is in the export, but it is **not on `body`** —
  `body` measures `min-width: 0px`. It is on the app-shell root div, which
  also carries `background:#ECEEF3`. So the canvas colour our
  `--color-surface-app` holds is exact, and the `#F5F6F9` that `body` reports
  is the page behind the shell, not the app canvas.

## What `/queue` paints

| | values, by frequency |
|---|---|
| type sizes | 11px ×22, 13px ×16, 28px ×2, 16px ×2, 20px ×1 — a strict subset of the prototype's ramp |
| weights | 400 ×20, 700 ×13, 600 ×8, 500 ×2 |
| families | Plus Jakarta Sans Variable ×33, JetBrains Mono Variable ×10 — the same two, self-hosted variable builds per ANALYSIS-tokens §5 |
| radii | 14px ×12, 999px ×9, 4px ×1 |

No colour, size, family or radius outside the design's own set reaches this
screen, with one deliberate exception recorded below.

## The differences, and who owns each

| probe | field | prototype | `/queue` | disposition |
|---|---|---|---|---|
| screen title | tracking | `-0.84px` | `normal` | **Deliberate.** `tokens.css` carries exactly one tracking step (`--tracking-caps`) and `check-rules.mjs` bans others. Adding a second for one heading is a token decision, not a screen one. |
| primary action | height | `40` | `44` | **Open, kit-level.** Already in `HANDOFF-frontend-2026-09-03.md`: RECIPES says 38, the prototype says 40, the kit has `md` 38 and `lg` 44. `lg` is the right *role* (RECIPES: the one action a decision screen leads with) and no size in the kit is 40. |
| primary action | padding | `0 24px` | `0 28px` | Rides the same `lg` choice. |
| action beside it | fill / weight / ink | `#FFFFFF` / 600 / `#14161C` | transparent / 500 / `#454A55` | **Deliberate refusal.** The prototype's second button is a `secondary`; Pass is a `ghost`. Two bordered buttons side by side read as a choice between equals, and passing is not the equal of doing the work — the accent is spent once, on Start review. |
| text input | height | `38` | `36` | **Open, kit-level.** Note the prototype disagrees with itself: its base stylesheet says 36 and the palette input measures 38. |
| text input | fill | `#FFFFFF` | `#FBFBFD` | **Already flagged**, REVIEW-04 "Flagged": the prototype's stylesheet and RECIPES §Inputs disagree about the fill. Unresolved there, unresolved here. |
| text input | radius | `14px` | `10px` | **Kit-level, and a bigger question than one input.** The prototype has one radius; the kit has a ladder (14 card / 10 control) whose arithmetic `card.tsx` documents as load-bearing — inner = outer − gap, or a 10px control in a 10px card leaves a crescent. Both positions are coherent; they are not both true. |
| 11px label ink | — | `#8A8E98` | `#686C76` | **Deliberate, tested.** The design's value fails WCAG 2.2 AA on every surface in this palette (2.83:1 on the app canvas against a 4.5:1 floor). `tokens.css` darkens the same hue until it clears all five surfaces and `tokens.contrast.test.ts` asserts it. |

## What matched exactly

Worth stating, because a parity note that lists only differences reads as a
screen that is mostly wrong:

- app shell canvas `#ECEEF3`, and the 1360px floor
- rail 240px at `#1E1B2E`, rail ink `#C9C5D8`
- card: radius 14px, 1px `#E4E7ED`, and both shadow layers —
  `rgba(20,22,28,.04) 0 1px 2px` and `rgba(20,22,28,.06) 0 10px 28px`
- screen title 28px/700 `#14161C`
- primary fill `#5B4B8A` on white; the order ref mono, 28px, in the accent —
  the one accent spend on the screen
- both type families, and a type ramp that is a subset of the prototype's

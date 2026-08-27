# REVIEW-03 — apps/web, adversarial

**Date** 2026-08-27 · **Branch** `frontend/rebuild-2026-08` · **HEAD** `08f18f4`
**Scope** all of `apps/web` EXCEPT `src/features/review` and `src/features/queue` (in flight).
**Method** everything below was PROVEN by running something. Dev server on `127.0.0.1:5176`, headless
Chromium via `@playwright/test`, `getComputedStyle`, a production `vite build` grepped for emitted
rules, `axe-core` with the five WCAG tags, `tsc -b`, `eslint`, `vitest run` (322 pass),
`check-rules.mjs` (clean), `knip`. No claim here is inferred from a class string.

Green everywhere it was asked: tsc 0 errors, eslint 0 errors (11 warnings), check-rules clean,
322/322 tests pass. **Every BLOCKER below is invisible to all four of those gates.** That is the
theme of this review.

---

## BLOCKERS

### B1 — `Input` and `Textarea` leak `isDisabled` to the DOM, so `disabledBecause` DOES NOT DISABLE THEM

`src/components/ui/input.tsx:41` · `src/components/ui/textarea.tsx:38`

Both spread `{...disabledAttributes(disabledBecause)}` onto a react-aria `Input`/`TextArea`. Those
two primitives are **not** composites — they are thin wrappers over `<input>`/`<textarea>` and their
props interface is `Omit<InputHTMLAttributes<HTMLInputElement>, 'className'|'style'>`. Verified in
the installed source:

```
node_modules/.../react-aria-components/dist/types/src/Input.d.ts:35
  export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, …>
dist/private/Input.mjs:33   isDisabled: props.disabled      ← reads `disabled`, never `isDisabled`
dist/private/Input.mjs:56   "data-disabled": props.disabled || undefined
```

There is no `isDisabled` prop. React Aria passes the unknown key straight through to the DOM, and
React warns. Measured on a two-element probe:

```
ERR> React does not recognize the `isDisabled` prop on a DOM element … "isDisabled" "isdisabled"
```

The consequence, measured:

```
inputDisabled: false          ← the control is LIVE
inputTitle:   "Blocked: T1 not countersigned."
after fill, value = "I TYPED INTO A BLOCKED FIELD"
```

**A blocked Input is fully editable.** It renders the hover tooltip and the
`data-disabled-reason` attribute that `e2e/invariants` asserts against, so the gate stays green
while the refusal does nothing. It also never receives `data-disabled`, so every
`disabled:`/`data-disabled:` class in `field-chrome.ts:32-33` is dead — a blocked field does not
even *look* blocked.

Why it matters: rule 9 and rule 12 (INVARIANTS 42/43 — a blocked affordance renders disabled with
the rule). This is exactly the failure family `disabled.ts` and `blockedHint.tsx` were written to
close, one layer below where either was looking — and `blockedHint.tsx`'s own header claims
"Native elements (`<button>`, `<input>`) are unaffected; this is a composite problem." That
sentence is wrong for `Input`, and the wrongness is why nobody checked.

**Fix** In `input.tsx`/`textarea.tsx` map the reason to the NATIVE prop:
`disabled: blocked` rather than `isDisabled: blocked`. Either add a `disabledNativeAttributes()`
beside `disabledAttributes()` in `disabled.ts`, or have these two files translate. Then add a
story/test asserting `el.disabled === true` and that typing is refused — the existing tests assert
the attribute, which is precisely what survived the bug.

---

### B2 — `defaultValue` on `Input` inside a `TextField` renders an EMPTY field

`src/components/ui/input.tsx:34-45`

Second console error on the workbench, reproduced on a three-line probe
(`<TextField><Label/><Input data defaultValue="2019-0043117"/></TextField>`):

```
ERR> ForwardRef(bound DOMElement) contains an input of type text with both value and
     defaultValue props. Input elements must be either controlled or uncontrolled …
value= ""                    ← the defaultValue is GONE
after edit= "EDITED"
```

`TextField` injects a controlled `value` through `InputContext`; the caller's `defaultValue` then
collides and React drops it. The field renders blank. Ten call sites already do this —
`workbench/FormsHalf.tsx:50,64,78`, `field.stories.tsx:61,89`, `input-group.stories.tsx:50,95,110`,
`input.stories.tsx:35,38`, `label.stories.tsx:38,53,71` — and every one of their stories passes,
because a story that asserts "it renders" cannot see an empty box.

Why it matters: a read-only field that is supposed to print "— read from clerk stamp"
(RECIPES §Inputs) prints nothing. In review that is a **field with no value and no NA state**, which
is INVARIANT 8's "a value with no provenance renders as a visible hard error" arriving as a blank
instead.

**Fix** `Input` must pass `defaultValue` to `TextField` (the composite owns the value), or `Input`
should reject `defaultValue`/`value` in its public props with a comment saying where they go.
Prefer the type-level refusal — it is the same move `disabled.ts` makes and it makes all ten call
sites fail to compile, which is the only way they get found.

---

### B3 — `tp-target` silently caps every `min-h-*` in the kit; `Textarea`'s three-line floor is 24px

`src/components/ui/ui.css:83` vs `src/components/ui/textarea.tsx:44`

`textarea.tsx` sets `min-h-36` and documents it as "72px, three lines of 13px". `controlClass`
(`field-chrome.ts:26`) also applies `tp-target`, which sets `min-block-size:24px`. Both land on the
same element; `@utility` output is emitted AFTER the numeric utilities, proven by byte offset in
the production CSS:

```
.min-h-36{  at 11440
.tp-target{ at 28660        ← later in the cascade, same specificity → wins
```

Measured: `minHeight: "24px"`. The three-line floor does not exist. It is masked today only by
`field-sizing-content` growing to one line (39.5px), so the box looks plausible and is wrong.

Why it matters: `check-rules.mjs` is clean, tsc is clean, and the file carries a paragraph
explaining a number that is not in effect. Every `min-h-*` / `min-w-*` a future component writes
alongside `tp-target` will be swallowed the same way, silently.

**Fix** `tp-target` should not use a raw `min-block-size`. Either make it
`&:not([class*="min-h-"])`, or express the hit area with the `after:-inset-*` pseudo-element the
kit already uses correctly on checkbox/switch/radio (`checkbox.tsx:73`), which does not touch box
sizing at all. Add a test asserting the computed `min-height` of a `Textarea` is 72px.

---

### B4 — Nested cards are NOT structurally forbidden; `InnerPanel` is the hole

`src/components/ui/card.tsx:62-66, 128-131`

`card.tsx`'s header claims: "A context flag makes the violation a runtime throw … `InnerPanel`
clears the flag going down, so the legal shape — card > inner panel > inner panel — keeps working,
and only card > card fails."

`InnerPanel` sets `<InsideCard value={false}>`. So `Card > InnerPanel > Card` clears the flag and
the inner `Card` renders. Measured:

```
<Card><InnerPanel><Card>…</Card></InnerPanel></Card>
THREW: false
{"cards":2,"nested":1,"radii":["14px","14px"]}
```

Two 14px surfaces, one inside the other. RECIPES §Card says nested cards are forbidden, full stop —
not "forbidden unless separated by a panel". The guard catches only the one arrangement nobody
writes by accident, and the arrangement that actually happens (a card, a section inside it, a card
in that section) passes.

**Fix** Two contexts, not one boolean: `InsideCard` (never cleared) and `InsidePanel`. `InnerPanel`
sets the second and leaves the first alone. Add the `Card > InnerPanel > Card` case to
`card.stories.tsx` as an expected throw — the current story only tests the direct nesting.

---

### B5 — Rule 8's entire paper register renders FLAT: no grain, no tilt, no NOT_STATED hatch

`src/entities/entities.css` is imported by NOTHING.

```
$ grep -rn '\.css"' src/ --include=*.tsx
src/main.tsx:9:          import "./styles.css";
src/workbench/main.tsx:48: import "../styles.css";
```

`styles.css:21-24` imports tailwind, tokens, `ui.css` and `overlays.css`. `entities.css` is not on
the list. It declares `tp-na-hatch`, `tp-paper-grain` and `tp-paper-tilt`. Confirmed absent from a
production build:

```
tp-paper-grain   ABSENT
tp-na-hatch      ABSENT
tp-paper-tilt    ABSENT
```

And rendered:

```
PaperSheet →  class="tp-paper-tilt tp-paper-grain …"  backgroundImage: "none"  transform: "none"
```

Three consequences, each a rule:

- **Rule 8** — "Evidence and deliverables render as paper … Never grey placeholder bars." The
  RECIPES `rotate(-.35deg)` and the grain gradients are both gone. A scan renders as a flat beige
  rectangle.
- **INVARIANT 7 / rule 14** — `NOT_STATED`'s distinguishing channel is the hatch stripe. Without
  it, measured against `NOT_FOUND`:

  | render | ink luminance | border-style | fill |
  |---|---|---|---|
  | NOT_FOUND | 0.0682 | dashed | transparent |
  | NOT_STATED | 0.0682 | **solid** | **transparent** |

  Identical ink, identical fill. They differ only by `dashed` vs `solid` on a 1px hairline. The
  token file's own promise — "a border STYLE and a FILL … that is what survives greyscale" — is
  half-kept. `noValueStates.test.ts:50` passes because it matches the literal string `tp-na-hatch`
  in the class list, not the rendered result. **A test that asserts a class name cannot see a
  stylesheet that was never loaded.**
- The other four renders DO stay distinct (measured above: •/◆ marks plus solid/dashed/dotted plus
  two distinct fills). This is a one-member collapse, not a five-way one — but it is the exact
  pair AGENTS.md names.

**Fix** Add `@import "./entities/entities.css";` to `styles.css`. Then change
`noValueStates.test.ts` to assert **computed** `backgroundImage` differs, not the class string.

---

## SHOULD-FIX

### S1 — `SegmentedControl` wraps collection items in `BlockedHint`, which `tabs.tsx` documents as fatal

`src/components/ui/segmented-control.tsx:78, 91`

`tabs.tsx:76-93` records, with the story that found it: wrapping a collection item made
react-aria's CollectionBuilder stop seeing it and **the item disappeared from the strip** — rule 12
inverted (blocked → hidden). `toggle-group.tsx:78` cites that finding and correctly omits the
wrapper. `segmented-control.tsx` — the ported file, not the adapted one — wraps both the group and
every `Segment`.

Measured today it does not yet drop the segment (`ToggleButtonGroup` tolerates it where `Tabs` did
not), and `title` is null on the segment either way — so the wrapper buys nothing and carries a
known-fatal shape:

```
segments: ["All|reason=null|title=null",
           "Open|reason=Blocked: extraction unfinished.|title=null",
           "Settled|reason=null|title=null"]
```

The `BlockedHint` on the group renders but the one on the item is inert. Delete the two item-level
wrappers and note why, matching `toggle-group.tsx`.

### S2 — `SegmentedControl` and `ToggleGroup` are the same component, twice

`segmented-control.tsx` and `toggle-group.tsx` are both `ToggleButtonGroup` +
`selectionMode="single"` + `disallowEmptySelection` + `rounded-md border border-line-strong
bg-surface-sunken p-2`. Byte-identical track classes. Their headers each claim to be "a filter, not
navigation" and each explain rule 5's 10/4/6 arithmetic in near-identical prose.

The barrel exports both (`index.ts:126` and `:37`). Rule 11's spirit — one variable, never two
literals — applies to components too: two names for one control is how the register drifts. Pick
one. `segmented-control.tsx` also hard-codes `data-chord-scope="widget"` as a literal
(`:58`) where `toggle-group.tsx` uses the shared `chordWidget` constant — a second literal for the
same fact.

### S3 — `entities/order/ProgressMeter.tsx` is dead, and it duplicates the kit's

Nothing imports it (`knip` misses it because its `.stories.tsx` counts as a use). The kit's
`components/ui/progress-meter.tsx` is the one the workbench and the barrel use. Two components, same
name, same job, different props (`label`/`caption` vs `noun`), and **different math**:
`entities/order/ProgressMeter.tsx:45` computes `Math.floor((settled/total)*DOTS)` while the kit's
documents refusing to draw a graphic above `MAX_DOTS`. Delete the entities copy and its story.

### S4 — Table exposes no `aria-colcount` and the header row no `aria-rowindex`

`src/components/ui/table.tsx:88-93`, `tableRow.tsx:33`

Measured on a 5,000-row probe:

```
{"headerRowIndex":null,"firstDataRowIndex":"1","rowcount":"5000","colcount":null}
```

`aria-rowcount` is set correctly (virtualization requires it — the DOM only holds ~22 rows). But
the header is a `role="row"` with no `aria-rowindex`, and the first data row claims index 1, so a
screen reader is told the header IS row 1 and then that the first order is also row 1. `role="grid"`
with a partial row set also wants `aria-colcount`. Set the header to `aria-rowindex={1}` and data
rows to `index + 2`, and add `aria-colcount={columns.length}`.

**Virtualization itself is correct and measured good** — 5,000 rows → 125 DOM nodes, 22 rendered
rows, 220,032px scroll height, arrow keys scroll the container. No finding there.

### S5 — Contrast failure on the app canvas, in the shipped tokens

`axe` against the rendered workbench, WCAG 2.2 AA, 5 tags — **one violation, 10 nodes**:

```
[serious] color-contrast — 4.04 (foreground #6e7480, background #eceef3, 13px normal)
```

`--color-ink-muted` on `--color-surface-app`. `field-chrome.ts:62-64` already predicts this exactly
("4.04:1 on `--color-surface-app` … a screen that puts one on the bare canvas will fail axe, and
that is the intended signal"). The prediction is right and the workbench is that screen. It is a
SHOULD-FIX rather than a NIT because the same pairing is one careless `text-ink-muted` away on any
real screen, and there is no lint for it. Either raise `--color-ink-muted` a tier for the canvas
case, or add a `check-rules` refusal on `text-ink-muted` outside a panel ancestor.

Note for credit: **overlays are clean.** Popover-open and Dialog-open axe runs both returned zero
violations, focus moves into the dialog (`activeElement` = the dialog SECTION), and the scope marks
are right (`["widget","widget","widget","own"]`).

### S6 — `CitationRef` is an 11px-tall click target

Measured on the workbench: `<button class="font-mono text-label leading-flat text-ink-muted …">`
at **217.9 × 11 px**. WCAG 2.2 §2.5.8 wants 24×24 (the kit's own `tp-target` value). It is the
control that opens the provenance pin — INVARIANT 33 — so it is load-bearing, not decorative.
`combobox-input` (196×17.5) and the command palette input (360×21.6) are also under 24px tall,
though as text inputs they have the 2.5.8 inline-exception argument; the citation button does not.

`checkbox`, `switch` and `radio` are all fine — measured, their `after:-inset` pseudo-elements give
26×22 / 46×26 hit areas on 16px and 20px boxes. That mechanism is the right one and is exactly what
B3 recommends generalising.

---

## NITS

### N1 — `playwright.tmp.config.ts` is committed scaffolding

`apps/web/playwright.tmp.config.ts`, landed in `08f18f4`. Its own docstring describes running the
`e2e/invariants` suite and mentions `web-v2` (deleted in `f2af433`). A file named `.tmp` in VCS is a
file nobody will dare delete in six months. Fold it into `playwright.config.ts` or remove it.

### N2 — 16 unused runtime dependencies

`knip`: `@embedpdf/*` (7), `@panzoom/panzoom`, `@fontsource-variable/geist`, `motion`, `shadcn`,
`tw-animate-css`, `web-vitals`, `zod`, `@react-aria/interactions`, `@react-aria/live-announcer`.

Two are worth naming separately from the bulk:
- **`shadcn` as a runtime `dependency`** — it is a CLI. It belongs in `devDependencies` if anywhere.
- **`@react-aria/live-announcer`** — `e2e/helpers/axe.ts:26-29` names it as the reason WCAG 4.1.3
  (status messages) is covered, since axe "CANNOT see a MISSING live region". It has zero call
  sites. So 4.1.3 currently has no implementation and no test. That is the one unused dependency
  that is a hole rather than weight.

`@fontsource-variable/geist` is dead by design (the register is Plus Jakarta Sans) — it is leftover
`shadcn init` output and should go.

### N3 — Stale `web-v2` references in kept files

`ui.css:22` ("set in web-v2's index.css"), `chords.ts:26` and `:32`
(`apps/web-v2/e2e/invariants/…`), tokens.css:44-46. `web-v2` was deleted in `f2af433`. These are
citations to a tree that no longer exists; a reader chasing one finds nothing.

### N4 — Barrel resolves, with a caveat

All 33 export statements resolve — 76 runtime names, verified by importing the barrel and reading
`Object.keys`. Nothing points at a renamed registry export. The barrel is in good shape.

The only structural note: `index.ts:113` promises `badgeVariants` is NOT exported, and it is not —
but `buttonVariants` IS (`:29`), with the same "a loose class-string factory is how a decision
becomes a copy-paste" argument applying equally. Inconsistent, not wrong.

---

## The four REVIEW-01/02 fixes: did they survive?

| Fix | Survived? | Evidence |
|---|---|---|
| **B3 focus-role table** (9 missing item roles) | **Yes** | `focusRoles.ts:25-42` carries all nine. `focusOwnership.ts:79` matches item roles on the active element and containers via `closest()`. |
| **REVIEW-02 over-correction** (chords dead inside a DataTable) | **Yes, correctly** | Measured live: chord fires with a Button focused (2), does NOT fire with a `[role=row]` focused (stays 2), fires again with the container focused (3). `table.tsx:90` uses `chordWidget` not `chordOverlay`, and `table.tsx:29-44` documents why. This is the single best-executed thing in the kit. |
| **`cx` over `cn`** (twMerge eating `text-ink-on-action`) | **Yes** | Measured: primary button renders `rgb(255,255,255)` on `rgb(91,75,138)`. `cx.ts:38-45` declares the six sizes. |
| **`title` dropped by `filterDOMProps`** | **Yes, on composites** | `BlockedHint` renders `display:contents`, 0×0 box, and hit-testing a blocked Checkbox finds `SPAN.contents` carrying the title in the ancestry. **But see B1** — the fix was scoped to composites on a stated assumption that native elements were fine, and for `Input` that assumption is false. |

---

## RECIPES conformance — measured, not read

| Recipe | Spec | Measured | |
|---|---|---|---|
| Button height | 38px | **38.0** (sm 30, lg 44) | ✓ |
| Button radius | 14 | **14px** all variants | ✓ |
| Button variants | 4 | primary/secondary/ghost/halt | ✓ |
| Button type | 13px, sans | 13px Plus Jakarta Sans | ✓ |
| Primary is the accent | `#5B4B8A` | `rgb(91,75,138)`, white ink | ✓ |
| Input height | 36–38 | **36.0** | ✓ |
| Input radius | 10 | **10px** | ✓ |
| Input fill/border | `#FBFBFD` / `#D6D9E1` | `rgb(251,251,253)` / control-border | ✓ |
| Data values in mono | — | JetBrains Mono on `data` inputs | ✓ |
| Inner radius = outer − gap | 6 in 10 | InputGroup inner measured **6px** | ✓ |
| Card radius | 14 | 14px | ✓ |
| **Nested cards forbidden** | structural | **reachable via InnerPanel** | ✗ **B4** |
| **Open decision: 3px rail, NO fill box** | — | `DecisionCard.tsx:57-59` — `border-l-3 border-l-action` on `bg-surface-panel`. **No accent fill.** | ✓ |
| **Paper: rotate(−.35deg) + grain** | — | `transform: none`, `backgroundImage: none` | ✗ **B5** |

The open decision is correct and worth stating plainly: the rail is a 3px left border, the field
name is `text-action` ink, the value is `text-title` (28px), the consequence line is the amber
`state-attend` family, and `DecisionCard` takes `actions` as a slot specifically so it cannot render
its own primary button and spend the accent twice. That is the RECIPES row implemented as written.

---

## Rule 1 — is the accent spendable more than once through the kit?

**Yes. Measured six accent-filled elements on one workbench render:**

```
BUTTON  data-slot=button              "Confirm"     ← the legitimate spend
SPAN    data-slot=checkbox-indicator  "✓"
SPAN    data-slot=checkbox-indicator  "✓"
SPAN    data-slot=radio-group-indicator
SPAN    data-slot=radio-group-indicator
SPAN    data-slot=switch-track
```

`checkbox.tsx:77-78`, `radio-group.tsx:79` and `switch.tsx:59` each paint `bg-action` on selection.
The tokens file is unambiguous: "the accent is the only token in this palette drawn as a SOLID FILL,
and it is spent once per screen."

This is a **judgement call I am flagging rather than calling a BLOCKER**, because there is a real
argument that a 16px checkbox tick is a state mark and not "an accent-dominant element" — and
`tabs.tsx:21-29` shows the team already reasoned this through for Tabs and chose an accent
*underline* over a filled pill precisely to avoid the second spend. The inconsistency is the
finding: Tabs refuses the fill, Toggle refuses it, SegmentedControl refuses it (raised white cell),
and Checkbox/Radio/Switch take it. Four components applying the rule, three not.

A screen with one primary button and a form of six checkboxes has seven accent fills. Rule 1 is
then a documented aspiration, not a property of the kit. Either decide selection controls are
exempt and write that in `tokens.css` beside the "spent once" sentence, or move them to
`ink-primary` fill with the accent reserved for the ring. There is no third option where the rule
means what it says.

Note `badge.tsx:44` and `field-set.tsx:121-122` use `bg-action-surface` (the tint), not
`bg-action` — that is correct and not part of this finding.

---

## Derivation audit — clean

Nothing in `entities/` or `app/` computes what the server owns. Checked specifically:

- `needs_review` from `value === null` — **absent**. No occurrence anywhere outside
  `StatePill.tsx:49` (a lookup key) and story fixtures.
- State from confidence — **absent**. `DecisionCard.stories.tsx:87-89` asserts the opposite as a
  test: a field with `engine_confidence_raw: 0.62` renders `data-field-state="needs_review"` from
  the server's value.
- Counts — `ProgressMeter` takes `settled` and `total` as required props with no `items` array to
  take a length from. `StageDots.tsx:26-28` takes the count line already composed.
- `StageDots.tsx:9-13` explicitly refuses to infer "done" from a count reaching a total, with the
  right reason (a stage can be complete by arithmetic and failed in fact).
- `localStorage` / `sessionStorage` — **zero occurrences** (INVARIANT 68 holds).
- `doors.ts:38-56` copies every path from `authz.ts:62-81` and invents none.

This layer is in good shape and the ported-over discipline held.

---

## What the shadcn adaptation made WORSE

Asked directly, and the honest answer is: **less than I expected, but not nothing, and the losses
cluster in one place.**

**Genuinely worse:**

1. **`Input` and `Textarea` — B1.** The registry's versions were correct: they took
   `React.ComponentProps<typeof InputPrimitive>` and passed `disabled` straight through as the
   native attribute. The adaptation replaced a working boolean with `isDisabled`, a prop that
   primitive has never had. The hand-written kit could not have had this bug because it did not have
   `disabled.ts`'s indirection. **This is the single clearest case of the adaptation breaking correct
   registry wiring while restyling**, and it is precisely the risk the brief named.

2. **`Input` — B2.** Registry `Input` spread `{...props}` LAST
   (`b26e8f9:input.tsx:26`); the adapted one spreads `{...props}` then
   `{...disabledAttributes(...)}`, and separately the value/defaultValue collision with `TextField`
   went unnoticed because no story asserted a rendered value. The registry's own
   `TextField`-composed examples would have shown it.

3. **`Textarea` — B3.** The registry's `min-h-16` was correct at its own 4px base. The adaptation
   correctly diagnosed the 2px-base halving, restated the floor as `min-h-36`, and then added
   `tp-target` to the same element, which cancels it. A correct fix undone by a second correct fix.

**Not worse, and worth saying so:**

- **`ref` forwarding, `composeRenderProps`, `data-slot`, `data-*` state attributes** all survived.
  `input.tsx:42`, `textarea.tsx:39` keep `composeRenderProps`; `select.tsx:79` correctly uses
  `SelectValue`'s render-prop form and the comment explaining why the placeholder is a CHILD is
  right. Focus rings, `data-pressed`, `data-entering`/`data-exiting` all measured working.
- **`combobox.tsx:79` `allowsEmptyCollection`** is an ADDITION the registry lacked, verified against
  the installed source, and it fixes a real "the list silently vanishes" bug.
- **Shrinking Select from 11 exports to 3 and ComboBox from 15 to 1** removed a genuine
  ComboBox-wearing-a-Select's-name confusion. Right call.
- **The table** is strictly better than what it replaced: 5,000 rows → 125 DOM nodes, and the
  `widget`-not-`own` chord decision is correct and load-bearing.
- **`cx.ts`** is a real improvement over `cn` and the axe failure it documents was a genuine catch.

**The pattern.** Every BLOCKER is in a file where the adaptation added an ABSTRACTION over the
registry's plumbing — `disabledAttributes` over `disabled`, `tp-target` over an explicit hit box,
`InsideCard` over a documented convention, an `@utility` file over inline CSS. The abstractions are
all well-argued in prose. Four of five are not connected to anything. **The documentation quality
in this kit is unusually high and is actively load-bearing in the wrong direction: several headers
assert a mechanism works, in enough detail that a reader stops checking.** B5's `entities.css` is
the purest form — 40 lines explaining a stylesheet that is never imported.

The gates cannot see any of this. tsc cannot see an unknown prop react-aria forwards to the DOM;
check-rules cannot see a CSS file that is not imported; a story that asserts a class string cannot
see a cascade. **The missing gate is: assert the COMPUTED result, not the input.** Three of the five
BLOCKERs would have been caught by one test that reads `getComputedStyle` or `el.disabled`.

---

## Verification ledger

| # | Claim | How proven |
|---|---|---|
| B1 | Input not disabled | `el.disabled === false`; `page.fill()` succeeded; react-aria source read |
| B2 | defaultValue empty | `inputValue()` returned `""` |
| B3 | min-h capped | computed `minHeight: "24px"`; byte offsets in built CSS |
| B4 | nesting reachable | no throw; 2 cards, 1 nested, both 14px |
| B5 | paper flat | `backgroundImage: "none"`, `transform: "none"`; grep of built CSS |
| S1 | title inert on segment | `getAttribute('title') === null` |
| S3 | duplicate dead | grep for importers |
| S4 | aria gaps | attribute read on 5,000-row grid |
| S5 | contrast | axe, 5 WCAG tags, 10 nodes |
| S6 | target size | `getBoundingClientRect()` sweep, 217.9×11 |
| Rule 1 | 6 accent fills | `getComputedStyle().backgroundColor === 'rgb(91, 75, 138)'` sweep |
| Chords | not over-corrected | live `useChords` counter across 4 focus positions |
| Table | virtualizes | 5,000 rows → 125 nodes |
| Overlays | a11y clean | axe with popover open, then dialog open |
| Derivation | clean | targeted greps + reading each hit |
| Barrel | resolves | imported it, read `Object.keys` (76 names) |

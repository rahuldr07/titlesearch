# REVIEW-02 — adversarial review of the primitive kit

Scope: `apps/web-v2/src/components/ui/` — 21 primitives, their stories, and the four
support modules (`cx.ts`, `disabled.ts`, `fieldChrome.ts`, `tableFeatures.ts`, `ui.css`).
Branch `frontend/rebuild-2026-08`, HEAD `7fa9cf5`. The domain layer is another reviewer's.

REVIEW-01's four BLOCKERs (B1–B4) are treated as fixed and are not re-reported. Two of the
things those fixes introduced are reported below (B2, S4).

Counts: **3 BLOCKER**, **6 SHOULD-FIX**, **4 NIT**.

Every claim below was produced by running something. The commands are quoted so they can
be re-run.

---

## BLOCKERS

### B1 — `check-rules.mjs` does not scan this directory. The entire kit is ungated.

`scripts/check-rules.mjs:150` declares `src/components/ui` as `VENDORED` — "shadcn registry
files… third-party code… the same status as `node_modules`" — and `walk()` returns `[]` on
it at line 156:

```js
const VENDORED = join(ROOT, "src", "components", "ui");
function walk(dir) {
  if (!existsSync(dir)) return [];
  if (resolve(dir) === VENDORED) return [];
```

That premise is false. This directory is not the shadcn registry; it is the hand-written
primitive kit, 2,943 lines of it, every file carrying a docstring citing the design rules
by number. There is no shadcn output anywhere in it, and `src/shared/ui/` — the directory
the comment says holds "the kit" — does not exist:

```
$ ls src/shared/
api.ts chords.ts crash.ts crashRedaction.ts date.ts fieldValue.ts
focusOwnership.test.ts focusOwnership.ts focusRoles.ts notify.ts provenance.ts session.ts
```

Measured effect:

```
$ node scripts/check-rules.mjs
check-rules: clean (71 files)

$ node -e '<the gate's own walk(), instrumented>'
total scanned: 69
scanned under components/ui: 0
```

The gate reports "clean (71 files)" while having read **zero** of the 49 files in scope.
Every rule the gate carries — no hardcoded colour, no arbitrary value, no inline style, no
`!important`, no `any`/`@ts-ignore`, no browser storage, the 150-line limit, the provenance
rule that REVIEW-01 B1 was written to enforce — is unenforced across the whole kit.

**Why it matters.** This is the same class of failure as REVIEW-01's summary line: "a
mechanism silently believed to be enforced". The kit is currently clean on most of these by
authorial discipline (I checked: no raw hex, no `any`, no inline styles, no arbitrary
values — see NIT N4). Discipline is not a gate, and the next contributor gets no signal.

**Fix.** Delete the `VENDORED` skip, or repoint it at a directory that actually holds
vendored code. Then re-run and fix the fallout — expect `Input.tsx` (114 lines) and
`Badge.tsx` (113) to pass the line limit but `DataTable.tsx`'s generic `FlexRender` calls to
need a look. If shadcn is genuinely planned for this path, the kit must move first, and the
comment's own claim that "`src/components/ui/` is separate from `src/shared/ui/`" becomes
true rather than aspirational.

---

### B2 — a focused button anywhere inside a `DataTable` kills every global chord. The B3 fix over-corrected.

`DataTable.tsx:55` puts `data-chord-scope="widget"` on the `<table>` element:

```jsx
<table data-chord-scope="widget" className="w-full border-collapse" aria-label={label}>
```

`focusOwnership.ts:81` resolves scope with `closest()`, which walks **every ancestor**:

```js
return active.closest(`${FOCUS_CONTAINER_SELECTOR},${SCOPE_SELECTOR}`) !== null;
```

So the mark applies to the whole subtree, not to rows. Simulated against the real selector
strings:

```
$ node /tmp/scope.mjs
Button inside DataTable cell owns keys (global chords DEAD): true
```

Design §Screens 3 puts row actions inside these tables ("Row actions: audit-history modal,
Open →"). The moment a reviewer tabs to one of those buttons, `C` / `E` / `Q` / `J` / `K` /
`Z` / `?` all stop working, and nothing on screen says why. A button does not own letter
keys; `focusOwnsKeys` correctly returns false for a bare `BUTTON` tag, and this attribute
overrides that correct answer.

Worse, the attribute is not needed for the case it was added for. `focusRoles.ts:129` now
lists `row`, `gridcell`, `columnheader` and `rowheader` in `FOCUSED_ITEM_ROLES`, which is
the B3 fix. `DataTable.tsx:51-54`'s own comment concedes the table has "neither" a
`role="row"` nor a `[role='grid']` ancestor — because **its rows are inert**:

```
$ grep -nE "tabIndex|role=|onClick|onAction" DataTable.tsx
  (only comment lines 26, 52, 53)
```

No row in this component can receive focus at all. The scope mark defends a state that
cannot occur, and in exchange breaks the state that does.

**Why it matters.** INVARIANTS 49/50/51 and `chords.ts`'s stated contract. A chord layer
that is dead whenever a table has focus is not a keyboard-first app.

**Fix.** Remove `data-chord-scope="widget"` from the `<table>`. When rows become focusable
(see S1), put the mark on the `<tr>` — or better, rely on `role="row"`, which
`focusOwnership.test.ts` already pins across 42 passing tests.

---

### B3 — a seventh type size is reachable four different ways, and the gate catches none of them.

Rule 2: "Six type sizes only: 11 / 13 / 16 / 20 / 28 / 40 px. Nothing between."

The `--text-*: initial` trick in `tokens.css:99` **does hold** for the naive spellings.
Built with the real Tailwind v4.3.3 against the real token file:

```
$ npx @tailwindcss/cli -i .probe/in.css -o .probe/out.css
  no  text-sm      no  text-2xl     no  text-xs     no  rounded-xl
  YES text-body    YES p-6          YES h-13
```

That much of the design's claim is true. But the namespace reset only removes *named scale
members*. It does nothing to arbitrary-value syntax. Six evasions, all built, all emitting a
seventh font-size:

```
$ grep -o "font-size:[^;]*" .probe/out.css | sort -u
font-size: 0.8125rem     ← text-[0.8125rem]
font-size: 13pt          ← text-[13pt]
font-size: 13px          ← text-[length:13px]  AND  [font-size:13px]
font-size: calc(13px)    ← text-[calc(13px)]
font-size: var(--x)      ← text-(length:--x)
```

The gate's `arbitrary-value` regex (`check-rules.mjs:63`) is
`/\[[-0-9.]+(px|rem|em|ch|ex|pt|pc|in|cm|mm)\]/i` — it requires the bracket to open on a
digit. Tested against each spelling:

```
$ node -e '<the gate's own regex, against the six strings>'
  gate MISSES   text-[length:13px]
  gate MISSES   [font-size:13px]
  gate CATCHES  text-[13pt]
  gate CATCHES  text-[0.8125rem]
  gate MISSES   text-[calc(13px)]
  gate MISSES   text-(length:--x)
```

Four of six walk past. And per **B1**, inside `src/components/ui/` all six walk past,
because the file is never opened.

**Why it matters.** The header comment in `cx.ts:9-27` narrates a real incident where a
silent type-system failure shipped a 2.42:1 contrast button with green typecheck and green
lint. This is the same shape: it renders, it renders wrong, and only a screenshot shows it.

**Fix.** Two changes. (1) Broaden the regex to any `text-[…]` / `[font-size:…]` /
`text-(length:…)` regardless of what follows the bracket — the *syntax* is the violation,
not the unit. (2) Add a post-build assertion over the emitted CSS: parse `out.css`, collect
every `font-size` declaration, and fail on any value that is not one of the six
`var(--text-*)` tokens. That is the only check that cannot be spelled around, because it
reads the artifact rather than the source.

---

## SHOULD-FIX

### S1 — `DataTable` renders all 5,000 rows. There is no virtualization and no pagination.

`DataTable.tsx:81` maps the full row model with no windowing:

```jsx
{rows.map((row) => (<tr key={row.id} …>
```

`@tanstack/react-virtual` **is installed** and unused by the kit:

```
$ ls node_modules/@tanstack/
react-query  react-query-devtools  react-router  react-router-devtools  react-table  react-virtual
$ grep -rn "virtual" src/components/ui/
  (no matches)
```

The API question in the brief resolves cleanly in the code's favour: `tableFeatures.ts:1-7`
uses the genuine v9 surface — `useTable`, `tableFeatures`, `createCoreRowModel`,
`createColumnHelper` — against the installed 9.2.3, and `DataTable.tsx:2` imports the
`FlexRender` **component**, not v8's `flexRender` function. No v8 names anywhere. That part
of the docstring's claim is accurate.

At 5,000 rows this mounts 5,000 `<tr>` and 25,000 `<td>`, each `<td>` wrapping a
`FlexRender`. REVIEW-01 S2 already measured `overlayIsUp()` at 393 µs per keystroke on a
5k-row table — that cost exists precisely because 5k rows are in the DOM.

**Mitigating.** `tableFeatures.ts:20-26` argues the server owns paging and §Screens 3
specifies 10/page, so 5,000 rows may never be passed. That is a screen-layer contract, not a
component guarantee, and the component accepts `readonly TData[]` of any length with no
warning.

**Fix.** Either document the ceiling as a hard precondition and assert it (a dev-mode throw
above N rows is honest), or wire `react-virtual`, which is already a dependency being paid
for and not used.

### S2 — `Rule 9`'s spread hole is confirmed, and it is wider than REVIEW-01 S1 described.

REVIEW-01 S1 said the `Omit` works at the named-prop level and a spread defeats it. Verified
on all five controls, against `tsconfig.app.json` (note: `tsconfig.json` is a solution config
with `"files": []` and compiles nothing, so probing against it returns a false green):

```
$ npx tsc --noEmit -p tsconfig.app.json
src/__probe_r9.tsx(8,32): error TS2322: … Property 'isDisabled' does not exist on type …
```

One error, from the direct literal `<Button isDisabled>`. Probes B–F — `const p = {
isDisabled: true }` spread into `Button`, `Checkbox`, `Tab`, `Switch`, `Segment` — **all
five compile clean**. Excess-property checking is a fresh-object-literal rule; a spread of a
named binding is not fresh.

The runtime consequence is the part REVIEW-01 did not state. In `Button.tsx:96-98`:

```jsx
<AriaButton {...props} {...disabledAttributes(disabledBecause)} … />
```

`disabledAttributes` returns `isDisabled: false` when no reason is given, and it is spread
**second**, so it overwrites the smuggled `true`. The button silently renders **enabled**.
So the laundered call is not merely unenforced — it fails open, which on a rule-12 blocked
action means a control the server will 409 renders as live.

`RadioGroup.tsx:78-80` and `SegmentedControl.tsx:42-43` have the inverse ordering problem
for the scope attribute — `{...props}` lands after `data-chord-scope` in `Checkbox.tsx:34`
and `Switch.tsx:29` but before it elsewhere. Probed: a caller may pass
`{"data-chord-scope": "nonsense"}` to `Checkbox`, `Switch` and `RadioGroup` and it
typechecks, clobbering the mark on two of the three:

```
$ npx tsc --noEmit -p tsconfig.app.json   # src/__probe2.tsx
  ALL COMPILE — override accepted by the type
```

**Fix.** Put `{...disabledAttributes(...)}` and every invariant attribute **after**
`{...props}` uniformly (Checkbox and Switch are the two that currently place the scope mark
before it), and `Omit` `"data-chord-scope"` from the public props the way `isDisabled` is
omitted. The spread hole itself cannot be closed by `Omit`; closing it needs the props type
to carry `isDisabled?: never`, which turns the spread into an error while leaving absent
callers alone.

### S3 — Rule 1's accent is spendable four times through the kit, and two of those are unnecessary.

`Button.tsx:6-20` argues carefully that `primary` is the one accent fill and that there is
deliberately no `accent-outline` or `ghost-accent`. Then:

```
$ grep -n "bg-action" *.tsx
Badge.tsx:43       accent: "border-action-border bg-action-surface text-action"
Button.tsx:36      bg-action text-ink-on-action border-action
Checkbox.tsx:52    border-action bg-action text-ink-on-action
RadioGroup.tsx:47  group-data-selected:bg-action
Switch.tsx:43      group-data-selected:border-action group-data-selected:bg-action
```

`Badge tone="accent"` is a second accent-filled variant, and its own comment at
`Badge.tsx:41-42` admits it — "this is a spend of the accent. Once per screen, with the
primary button, not in addition to it." A comment is not a constraint. A screen can render
`<Button variant="primary">` and `<Badge tone="accent">` and typecheck.

Checkbox/Radio/Switch selected states are more defensible (a selection indicator is not a
call to action) but they are literal `bg-action` fills, and a form with eight checked boxes
puts eight accent fills on a screen whose budget is one.

**Not enforced anywhere.** The gate has no accent rule at all:

```
$ grep -n "accent\|bg-action" scripts/check-rules.mjs
  NO SUCH RULE
```

`Button.tsx:16-20` says the count is enforced by "`e2e/invariants` counting accent fills per
route". If that spec exists it is outside this scope and must be checked; if it counts only
`variant="primary"` it misses all four other routes above.

**Fix.** Decide whether selection indicators count against the budget and write it down. If
they do not, the e2e counter needs to distinguish them structurally, which means they should
not share the `bg-action` class name.

### S4 — Rule 5's arithmetic is wrong in the Select/ComboBox popover, right in the SegmentedControl.

Rule 5: inner = outer − gap.

`SegmentedControl.tsx:47` / `:63` — track `rounded-md` (10px), `p-2` (4px on the 2px base),
cell `rounded-sm` (6px). 10 − 4 = 6. **Correct**, and the docstring at lines 19-21 shows its
working.

`Popover.tsx:38` / `fieldChrome.ts:29` / `Option.tsx:45` — popover `rounded-md` (10px),
`listBoxClass` has `p-3` (6px), option `rounded-sm` (6px). 10 − 6 = **4**, which is
`rounded-xs`. The option is 6. That is a 2px crescent at every option corner, which is the
exact artefact `Surface.tsx:8-11` describes as the reason the rule exists.

The nested Dialog > Surface > Input case in the brief is fine: `Dialog.tsx:52` is
`rounded-lg` (14) with `p-15` (30px) of padding, and at that gap any inner radius is
defensible.

**Fix.** Either `p-2` on `listBoxClass` (making 10 − 4 = 6 correct) or `rounded-xs` on
`Option`. The first preserves the 6px option radius that matches the segmented cell.

### S5 — `tp-ring` is declared and forgotten on six focusable primitives.

`ui.css:74` defines the ring against react-aria's `data-focus-visible`, because "react-aria
renders composites as `<div>`, which that selector cannot reach". Applied to 8 of 21:

```
$ grep -l "tp-ring" *.tsx
Button ComboBox Checkbox RadioGroup SegmentedControl Select Switch Tabs
```

Missing from focusable or focus-hosting primitives: **`Option.tsx:44`** (a
`<div role="option">` — exactly the case the utility's docstring names), **`Dialog.tsx:52`**
(`outline-none` with no replacement ring), **`Popover.tsx:37`**, `TextArea`, `Input`,
`DataTable`.

`Input` and `TextArea` are covered: `fieldChrome.ts:21` carries its own
`focus:outline-2 focus:outline-action`, and `styles.css:53` catches native
`input`/`textarea`. `Option` is not covered by either — it is a `div`, so the `styles.css`
`:where(a, button, input, textarea, select, [tabindex])` selector misses it unless react-aria
sets `tabindex`, and `Option.tsx:46` explicitly sets `outline-none`. Its only focus feedback
is `data-focused:bg-surface-sunken`, a background tint, which is also what hover produces —
so keyboard focus and mouse hover are visually identical.

**Why it matters.** WCAG 2.2 §2.4.7 Focus Visible. A background tint that duplicates hover
is not a focus indicator.

**Fix.** Add `tp-ring` to `Option`, `Dialog`'s inner card, and `Popover`.

### S6 — `Option` and `Popover` have no stories. Two primitives are entirely unexercised.

```
$ for f in *.tsx; do … [ -f "$b.stories.tsx" ] || echo $b; done
  Option
  Popover
```

Both appear inside `Select.stories.tsx` and `ComboBox.stories.tsx`, so they render — but
neither has a story for its own states. `Option`'s selected / disabled / focused branches
(`Option.tsx:49-51`) and `Popover`'s `max-h-160` overflow cap (`Popover.tsx:44`, the one
that would show whether a 40-item list scrolls correctly) are unstoried.

Variant coverage elsewhere is genuinely good — Button 4/4 variants, Badge 4/4 tones, Surface
6 stories covering all three tones. Two gaps:

- `Button` sizes: `sm` and `lg` are storied, **`md` (the default) is not** named explicitly —
  it is only the implicit default of other stories.
- `Surface` `edge="none"` (`Surface.tsx:38`) is declared and unstoried.

**Fix.** Add `Option.stories.tsx` and `Popover.stories.tsx`; add the missing `edge="none"`
case. An unstoried variant is an untested variant, and `Dialog.stories.tsx:70` and
`Select.stories.tsx:47` show this kit already knows how to assert behaviour from a story.

---

## NITS

### N1 — the six-size claim holds against named utilities. Verified, credit where due.

The `--text-*: initial` / `--radius-*: initial` mechanism at `tokens.css:99-100` works
exactly as its comment claims. Built and confirmed above (B3): `text-sm`, `text-2xl`,
`text-xs`, `rounded-xl` generate **nothing**. The failure mode is arbitrary-value syntax
only, which is B3. `rounded-full` and `rounded-none` do survive, as the comment predicts —
but the comment says they "are banned by check-rules.mjs instead", and they are not:

```
$ grep -n "rounded-full\|rounded-none" scripts/check-rules.mjs
  NO SUCH RULE
```

The kit does not use either (`rounded-pill` throughout), so this is a stale claim rather
than a live defect.

### N2 — Rule 3 (mono for data only) is clean in the kit, and unenforced.

Five `font-mono` sites, all legitimate under rule 3's own list:

```
Badge.tsx:107      the ✓ ◆ • T1 glyph (aria-hidden)
DataTable.tsx:108  DataCell — refs, money, citations, hashes, timestamps
Input.tsx:109      opt-in via `data` prop, never inferred
Kbd.tsx:23         kbd, named explicitly in rule 3
ProgressMeter.tsx:78  the mono "N of M" count
```

No primitive applies mono where prose can land. `Input`'s `data?: boolean` opt-in is the
right shape — nothing infers it. `Badge.tsx:107` is the one arguable case: the glyph is
`aria-hidden` decoration rather than data, and `T1` is a tier label, not a number. Harmless.

Note the gate has no `font-mono` rule (`grep`: no match), so this is discipline, not
enforcement.

### N3 — no domain leakage. Verified.

```
$ grep -niE "PRESENT_UNREADABLE|NOT_PRESENT|citation|ruling|escalat|countersign|quarantine|examiner" *.tsx
  (only Badge.tsx:71  tier1: "T1")
```

`T1` is in `claude-design-rules.md` rule 7's glyph vocabulary ("✓ ◆ • T1"), so it is a
design token, not domain knowledge. `index.ts:6-10` states the boundary explicitly and the
kit holds it. No primitive knows what a citation or an NA state is. REVIEW-01 N4's finding
still stands.

### N4 — the kit is clean on the rules the gate would have applied, had it run.

Checked by hand what B1 prevents the gate from checking: no raw hex or colour functions, no
`any` / `@ts-ignore` / `as unknown as`, no inline `style=`, no `localStorage`, no arbitrary
values (the only bracket-like syntax is lucide's `size={16}` prop at `ComboBox.tsx:82` and
`Select.tsx:75`, which is a React prop, not a class), no file over 150 lines (max:
`Input.tsx` at 114). The `gates` Vitest project passes, including
`src/components/ui/disabled.test.ts`:

```
$ npx vitest run --project gates
Test Files  6 passed (6)      Tests  83 passed (83)
```

This is why B1 is a BLOCKER rather than a catastrophe today — but it is also exactly how a
gate rots unnoticed.

---

## Which of the 14 rules are UNENFORCED and merely believed

Enforcement here means a mechanism that fails a build or a test. Not a docstring.

| # | Rule | Status | Mechanism, or what is missing |
|---|------|--------|-------------------------------|
| 1 | Accent once per screen | **BELIEVED** | No gate rule. Claimed to live in `e2e/invariants`; four accent routes exist (S3) and a comment is the only guard on `Badge tone="accent"`. |
| 2 | Six type sizes | **PARTIAL** | `--text-*: initial` genuinely blocks named utilities (N1). Arbitrary syntax defeats it four ways and the gate misses four of six spellings (B3). |
| 3 | Mono for data only | **BELIEVED** | No gate rule, no test. Clean by discipline (N2). |
| 4 | Sentence case | **BELIEVED** | `tokens.css:331` claims "check-rules.mjs bans `uppercase` outside rail/sidebar/certificate". It does not — no such rule exists. A false claim in the token file. |
| 5 | Radii arithmetic | **BELIEVED** | No mechanism. Wrong in one of three nestings (S4), and only a human noticed. |
| 6 | One signal per row | **STRUCTURAL** | Enforced by absence — no `rowTone`, no striping, no `getRowClassName` (`DataTable.tsx:13-21`). The best kind of enforcement here, and honest that a cell's contents cannot be counted. |
| 7 | Glyph vocabulary, no icon soup | **TYPED** | `Mark` is a closed union (`Badge.tsx:65`), so a fifth glyph is a compile error. Genuinely enforced. lucide usage is 2 sites, both disclosure arrows. |
| 8 | Paper register | **PARTIAL** | `Surface tone="paper"` exists and is storied; nothing prevents a screen rendering evidence as a grey `Skeleton` instead. |
| 9 | Disabled states its reason | **TYPED, LEAKY** | The `Omit` + `disabledBecause` pattern is real and applied to all 13 controls uniformly (verified by grep — no raw `isDisabled` slipped through). Defeated by spread, and fails **open** (S2). `disabled.test.ts` passes 4 tests. |
| 10 | Motion timings | **ENFORCED** | Three `@utility` classes, no way to write a duration, gate bans arbitrary values. `ui.css:1-17` is correct about this. |
| 11 | Numbers reconcile | **DESIGNED** | `ProgressMeter` takes `settled`+`total`, refuses `percent` and refuses `items` (`ProgressMeter.tsx:14-21`). Cannot be enforced at primitive level; the shape is right. |
| 12 | Blocked actions visible, not hidden | **BELIEVED** | Same mechanism as 9, same spread hole. Nothing prevents a screen conditionally rendering instead of disabling. |
| 13 | T1 second read, 409 | **N/A here** | Server rule. Correctly absent from primitives. |
| 14 | Absence is typed | **N/A here** | Domain layer. Correctly absent from primitives (N3). |

Rules **1, 3, 4, 5 and 12** are believed and not enforced. Rule 4's belief is worse than the
others because `tokens.css:331` asserts a gate rule that does not exist — a reader checking
their work against the token file gets a false answer.

The load-bearing observation across all of it: **B1 means even the rules that *are* gated
are not gated here.** Rule 10's enforcement, the strongest in the table, depends on
`check-rules.mjs` banning arbitrary values in this directory. It does not open the files.

# REVIEW-01 — adversarial review of the 2026-08 frontend rebuild

**Scope:** `9eaebcc..HEAD` on `frontend/rebuild-2026-08` (14 commits).
**Method:** every claim below was executed, not read. Commands are quoted inline so each
finding can be re-run. The in-flight `src/app/routeTree` breakage is excluded by instruction.
**Checked against:** `AGENTS.md`, `docs/INVARIANTS.md`, `docs/frontend/design-2026-08/claude-design-rules.md`,
`packages/contract/src/*.ts`.

**Verdict up front.** The mechanisms in this branch are unusually well argued in prose and
substantially weaker in code than the prose claims. Four separate files assert compile-time
enforcement; three of them do not have it. The comments are load-bearing documentation of
intent that a reader will mistake for documentation of behaviour, and that gap is itself the
biggest risk here.

Counts: **4 BLOCKER**, **7 SHOULD-FIX**, **4 NIT**.

---

## BLOCKERS

### B1 — `Cited<T>` does not make missing provenance a compile error. The central claim of the file is false.

**`apps/web-v2/src/shared/provenance.ts:13-16, 34-43`**

The file states: *"A component cannot render a value without also holding its citation,
because there is no way to construct the argument. The failure moves from a reviewer's
attention to `tsc`."*

It does not. Three separate holes, all proved to compile clean against the app's own
`tsconfig.app.json`:

```tsx
// src/__probe/prov.tsx — all three typecheck with zero errors
export function Naked({ field }: { field: Field }) {
  return <span>{field.value}</span>;              // HOLE 1: bypass readCited entirely
}
export function Unwrapped({ field }: { field: Field }) {
  const v = readCited(field);
  return <span>{v.kind === "cited" ? v.cited.value : null}</span>;   // HOLE 2
}
export function Laundered({ field }: { field: Field }) {
  const v = readCited(field);
  const s: string = v.kind === "cited" ? v.cited.value
                  : v.kind === "uncited" ? v.value : "";             // HOLE 3
  return <span>{s}</span>;
}
```
```
$ npx tsc --noEmit -p tsconfig.app.json | grep __probe
(no output — all three compile)
```

Hole 1 is the fatal one. `Field` is exported from the frozen contract and carries
`value: string | null` as a plain member. Nothing prevents any component from importing
`Field` and printing `field.value`. `readCited` is opt-in, and an opt-in mechanism against a
rule "caught 6 times in prototyping" is the same mechanism that failed six times.

Hole 2/3: `Cited<T>` is a structural record with a public `value: T`. Destructuring it yields
a bare `string` with no residual obligation. The comment at `:37-39` argues against
`citation?: Citation` because "an optional citation is a citation you can forget" — but a
*required* citation you can destructure away is a citation you can forget one keystroke later.

**Why it matters.** AGENTS.md hard rule: *"Never emit a value you can't cite."* INVARIANT 8:
*"A value with no provenance renders as a visible hard error — never a blank, never a bare
value."* The file is presented as the mechanism that retires that risk. It is not a mechanism;
it is a convention with a type annotation, and the surrounding comment will stop the next
reviewer from checking.

**Fix.** Either (a) brand the value so it cannot be assigned to `string` —
`type CitedString = string & { readonly __cited: unique symbol }` — and make `FieldValueView`
the only thing that can unbrand it; or (b) accept that this is a lint problem, add an
ESLint `no-restricted-syntax` rule banning `MemberExpression[property.name='value']` on
anything typed `Field` outside `provenance.ts`, and **rewrite the file header** to claim only
what is true. Option (b) is honest and cheap. What is not acceptable is leaving the current
header, which actively misleads.

---

### B2 — the `never` guard does not prevent the grey-dash collapse it is named for.

**`apps/web-v2/src/shared/provenance.ts:53-57, 64-68`**

The claim: *"A `switch` over `kind` with the `never` guard below cannot compile while one of
the five is unhandled, so 'the four NA states must never collapse into one grey dash' is
enforced by the compiler rather than by a reviewer noticing a missing branch."*

The union discriminates on `kind`, which has **four** members. All four NA reasons live inside
a single `na` branch. So the exact collapse the rulebook forbids compiles:

```tsx
switch (v.kind) {
  case "cited":         return <span>{v.cited.value}</span>;
  case "uncited":       return <span>{v.value}</span>;
  case "not-extracted": return <span>—</span>;
  case "na":            return <span>—</span>;   // ALL FOUR COLLAPSED TO ONE DASH
  default:              return assertNever(v, "GreyDash");
}
```
```
$ npx tsc --noEmit -p tsconfig.app.json | grep __probe/na
(no output — the grey-dash collapse compiles clean)
```

Adding a fifth `NaReason` to the frozen enum would also fail to break any site, because no
site switches over `NaReason`. The only thing that actually enforces the five-way distinction
is the `NO_VALUE` record in `entities/field/noValueStates.ts:42` (which is `Record<NoValueRender, …>`
and *would* fail to compile on a fifth reason) plus `noValueStates.test.ts`. That is real
enforcement, and it is in a different file from the one taking credit for it.

**Why it matters.** INVARIANT 7, enums.ts:20-52, design rule 14. The stated compiler guarantee
is the reason a future agent will not write a test for this.

**Fix.** Flatten the union so `kind` carries the reason:
`| { kind: "na-not-present" } | { kind: "na-not-found" } | …`. Then the `never` guard means
what the comment says. Or, minimally, delete the paragraph at `:53-57` and point it at
`noValueStates.ts`, which is where the guarantee actually lives.

---

### B3 — `focusOwnsKeys` misses every role react-aria actually puts focus on. The prototype bug it exists to fix is reproduced.

**`apps/web-v2/src/shared/chords.ts:64-89`**

The file's own argument (`:7-14`) is that a tagName test *"is structurally incapable of seeing
a `react-aria-components` Menu, Select, ComboBox or GridList"*, and that `q` would both
escalate a field and jump a menu to "Quarantine".

The replacement list checks the roles of **containers**. React Aria puts DOM focus on the
**items**. Proved from the installed `react-aria@3.51.0`:

```
$ grep -n "role" node_modules/.pnpm/react-aria@3.51.0*/…/private/listbox/useOption.mjs
44:        role: 'option',
$ grep -n "role:" …/private/gridlist/useGridListItem.mjs
274:        role: 'row',
303:        role: 'gridcell',
$ grep -n "role" …/private/tabs/useTab.mjs
60:            role: 'tab'
```

Running the function verbatim against those roles:

```
$ node /tmp/probe.mjs
** HOLE ** role=option            useOption.mjs:44 — ListBox/Select/ComboBox items
** HOLE ** role=row               useGridListItem.mjs:274 — GridList/Table rows
** HOLE ** role=tab               useTab.mjs:60 — Tabs
** HOLE ** role=menuitemradio     useMenuItem role= variants
** HOLE ** role=menuitemcheckbox  useMenuItem role= variants
** HOLE ** role=radio             RadioGroup
** HOLE ** role=checkbox          Checkbox
** HOLE ** role=switch            Switch
** HOLE ** role=slider            Slider
```

Nine of nine miss. `listbox` and `menu` are on the list, but focus is never on them —
`useSelectableCollection.mjs:449` wires `useTypeSelect` to the collection, and focus sits on
the option. `gridcell` is listed and `row` is not, while `useGridListItem` defaults to
`focusMode: 'row'` (`:54`). `menuitem` is listed; `menuitemradio` and `menuitemcheckbox` are not.

**Why it matters.** INVARIANT 49 (*"keys typed inside an input are TEXT, never chords"*),
INVARIANT 50 (*"a focused control owns the keystroke"*), INVARIANT 51 (`ORPHAN` O15 —
*"a chord's second key must never ALSO fire a screen action. This is what stops a stray
keystroke destroying an in-progress correction"*). This is the ORPHAN rule, i.e. the one
with no other record in the repo.

**Partial mitigation, and why it is not enough.** `Select.tsx:20` and `Popover.tsx:36` set
`data-chord-scope="own"` on the popover subtree, so a Select's options *are* covered by the
`closest()` fallback at `:88` — and `Dialog.tsx:46` covers dialogs. But `Tabs.tsx` sets no
scope (`grep -n "chord-scope" src/components/ui/Tabs.tsx` → nothing), `DataTable.tsx` sets
none, and `SegmentedControl`/`RadioGroup`/`Checkbox`/`Switch` set none. A focused row in a
5000-row table, or a focused stage tab on the order bar, does not stand the global layer down.

**Fix.** Two changes. (1) Add the item roles: `option`, `row`, `tab`, `menuitemradio`,
`menuitemcheckbox`, `radio`, `checkbox`, `switch`, `slider`, `treegrid`, `tabpanel`. (2)
Change the container check from "is the active element this role" to
`active.closest("[role='listbox'],[role='menu'],[role='grid'],[role='tree']") !== null`,
which is what the container roles were presumably meant to do. Then write the test — the file
cites `e2e/invariants/chord-suppression.spec.ts`, which **does not exist on this branch**
(`ls apps/web-v2/e2e/invariants/` — the tree was deleted per INVARIANTS.md preamble). Every
claim in this file's header is currently unbacked by any executable check.

---

### B4 — the crash sink ships free-text error messages and a component stack to an endpoint that is not in the frozen contract and has no server-side implementation.

**`apps/web-v2/src/shared/crash.ts:39-48, 55-72, 92-103`**

Three problems, in ascending order of severity.

**(a) The endpoint does not exist.**
```
$ grep -rn "client-events" --include=*.py --include=*.ts . | grep -v node_modules
./apps/web-v2/src/shared/crash.ts:57
```
One hit — the caller. Nothing in `packages/contract/src/endpoints.ts`, nothing in
`services/core-api`. Every crash POST is a 404 today, so the "whole observability story"
(`main.tsx:52-58`) currently reports nothing. That also means the redaction the file's header
leans on has never been applied to this payload, because the payload has never reached a
Python process.

**(b) `error_message` is free, data-controlled text, and it can carry a party name.**

The header argues Sentry is refused because its breadcrumbs collect *"the party name a
reviewer clicked, the value they typed, the reason they gave"*, and that this file instead
goes *"through the backend's existing redaction"*. Check what the backend actually does with
these field names:

```
$ node -e '…'   # keys tested against libs/domain/src/titlepipe_domain/redaction.py
error_message     PASSES blocklist (dev: logged verbatim)  | allowlist: DROPPED in deployed
component_stack   PASSES blocklist (dev: logged verbatim)  | allowlist: DROPPED in deployed
path              PASSES blocklist (dev: logged verbatim)  | allowlist: DROPPED in deployed
request_id        …                                        | allowlist: allowed
event             …                                        | allowlist: allowed
```

Neither `error_message` nor `component_stack` is in `SAFE_DIAGNOSTIC_KEYS`
(`redaction.py:187-231`), so in a deployed environment they are **dropped entirely** — the
crash reporter would ship nothing useful. In **development**, `allowlist_only` is off
(`logging.py:103`, `environment.is_deployed`) and the blocklist applies instead;
`is_sensitive_key` checks whether any of `party`, `owner`, `snippet`, `text`, `content`,
`body`, `value`, `reason`, `address`, … is a substring of the key. `error_message` contains
none of them. **So `error_message` is logged verbatim in development.**

Note the exact irony: `redaction.py:413-428` (`sanitise_exception`) exists precisely because
*"an exception message is arbitrary, data-controlled text… it routinely contains exactly what
must never be logged: a connection string from a driver error, **a party name from a domain
refusal**, a document fragment from a parser."* The backend strips exception messages down to
the type. This client sends the raw `.message` under a key that is not `exception`, so
`sanitise_exception` never touches it.

**A concrete path for a party name to reach the wire.** `shared/api.ts:91-95`:
```ts
throw new ApiError(response.status, `Response did not match the contract for ${path}: ${parsed.error.message}`);
```
A contract mismatch on a field response produces a Zod message. Zod v4 does not echo the
received value for a type mismatch — verified:
```
$ node zz.mjs
ZOD MESSAGE >>> [{"expected":"number","code":"invalid_type","path":["page"],"message":"Invalid input: expected number, received string"}]
ZOD ENUM  >>> [{"code":"invalid_value","values":["NOT_PRESENT"],"path":["na_reason"],"message":"Invalid input: expected \"NOT_PRESENT\""}]
```
So Zod itself is safe. But `ApiError` is also constructed at `api.ts:85` from
`readError(response)`, which returns **the server's refusal message verbatim** — and INVARIANT
14 *requires* that message to be verbatim, INVARIANT 16 requires the 409 body to surface
verbatim. A 409 on a vesting correction plausibly reads *"MARIA L. ESTRADA was corrected by
another reviewer"*. Any unhandled rejection of that promise hits
`installCrashSink`'s `unhandledrejection` listener (`crash.ts:114-116`) →
`reportCrash("rejection", e.reason)` → `describe()` at `:74-79` takes `error.message` →
`error_message` on the wire. **That is a party name reaching the wire through an Error
message, via the one code path the invariants mandate be verbatim.** It is also a path the
`path` field makes attributable: `window.location.pathname` carries the order id.

**(c) `component_stack` is not as safe as claimed.** `:86` says *"`componentStack` is React's
own and names component types, not user data."* True of the component names; not true of the
whole string, which in React 19 dev builds includes source file paths and can include
`key` values in the reconstructed stack for keyed lists. Rows keyed by a natural key would
leak. This is minor next to (b) but the comment is stated as a guarantee.

**Fix.** (1) Add `POST /api/client-events` to `packages/contract/src/endpoints.ts` and
implement it, or delete the sink until it has a receiver. (2) Do not send `error.message`.
Send `error_type` and a **sanitised** message — mirror `sanitise_exception`'s discipline
client-side, or send nothing but the type. (3) Rename the fields so they land in
`SAFE_DIAGNOSTIC_KEYS` (`error_name` is already allowlisted; `error_message` is not) and add
the new keys to `SAFE_DIAGNOSTIC_KEYS` deliberately, which the redaction module's own comment
says should be *"a review conversation rather than a silent leak."* (4) Strip the order id
from `path` — send the templated route, which is what `SAFE_DIAGNOSTIC_KEYS` allows (`route`,
*"the templated route, never a resolved path"*).

---

## SHOULD-FIX

### S1 — `disabledBecause` is real enforcement at the named-prop level and defeated by a spread.

**`apps/web-v2/src/components/ui/disabled.ts:29-60`, `Button.tsx:79-100`**

Credit first: the `Omit` works.
```
$ npx tsc --noEmit -p tsconfig.app.json
src/__probe/p.tsx(3,26): error TS2322: Type '{ children: string; isDisabled: true; }'
  is not assignable to … Omit<ButtonProps, "className" | "isDisabled"> & Disablement & …
```
`<Button isDisabled>` is a compile error. Good.

The escape hatches, in order of likelihood:

1. **Spread launders it.** `const p = { isDisabled: true }; <Button {...p} />` — excess-property
   checking does not apply to spreads. TypeScript reports nothing. And because every control
   spreads `{...props}` **before** `{...disabledAttributes(...)}` (verified across all ten:
   `Button.tsx:97-98`, `Checkbox.tsx:34-35`, `Switch.tsx:29-30`, `Select.tsx:55`, …), the
   generated attributes win the collision — so a spread `isDisabled` is *overwritten* rather
   than honoured. That ordering is correct and worth keeping; note it in the file, because it
   is currently accidental rather than stated.
2. **The whitespace hole, which the header does not mention.** The header names
   `disabledBecause=""` as *"the one hole"*. There is a second:
   ```
   $ node -e '…disabledAttributes("   ")'
   empty  : {"isDisabled":false}
   spaces : {"isDisabled":true,"title":"   ","data-disabled-reason":"   "}
   ```
   A whitespace reason produces a control that is **disabled with a blank reason** — visually
   dead, no tooltip text, `data-disabled-reason="   "` passing any `toBeVisible`-style
   assertion. That is a direct rule 9 / rule 12 violation and it is worse than the empty-string
   case, which at least fails safe by staying enabled.
3. **The inline note is not universal.** `Input.tsx:71`, `Checkbox.tsx:92`, `RadioGroup.tsx:86`
   render the reason inline. `Button.tsx`, `Switch.tsx`, `Tab.tsx`, `Segment.tsx` render it on
   `title` only. The header says *"A tooltip alone fails WCAG 2.2 on touch"* and then ships
   tooltip-only on the four controls most likely to be the blocked action.

**Fix.** `const blocked = typeof reason === "string" && reason.trim().length > 0;` closes (2).
For (3), either give every control a description slot or stop claiming the WCAG argument.

### S2 — `overlayIsUp()` costs 393 µs per keystroke on a 5k-row table, and the miss case is the common case.

**`apps/web-v2/src/shared/chords.ts:106-111`, called from `:170` on every chord keystroke**

Measured in real Chromium against a 5000-row react-aria grid (15,006 nodes):

```
$ node perf-probe.mjs
{ rows: 5000, nodes: 15006, missUs: 392.75, hitUs: 0.15 }
```

When an overlay **is** up, the first selector hits early and it costs 0.15 µs — free. When no
overlay is up, which is the state during ordinary review, **both** `querySelector` calls scan
the whole document and it costs ~393 µs. That is per keystroke on a bound chord. Held-key
autorepeat at ~30/s is ~1.2% of a frame budget per event, so this is not a dropped frame — it
is not the disaster the question implies. But it is 2600× the hit case for zero benefit, and
it grows linearly with the table.

Note the design does not currently virtualize: `DataTable.tsx` renders `table.getRowModel().rows`
directly with no `useVirtualizer`, despite `@tanstack/react-virtual` being a dependency. A
literal 5000-row order therefore puts 15k nodes in the document, which is the measured case.

**Fix.** Cheap and structural: hoist the second selector into the first —
`doc.querySelector("[role='dialog'],[role='alertdialog'],[data-chord-scope='own']")` — halving
it. Better: the app already has an overlay store (`app/keyboard/overlays.ts`, used by
`GlobalKeys.tsx:37-38`). The comment at `:92-99` rejects it as *"a second source of truth that
drifts… exactly when it matters — during the transition"*. That reasoning is sound for the
one-frame window, so keep the DOM check but gate it: consult the store first, and only pay for
the DOM scan when the store says an overlay is opening or closing. The comment argues for
correctness during the transition; it does not argue for paying the cost when nothing is
transitioning.

### S3 — `alwaysOn` is a genuine hole, and `Escape` is not the only thing that can go through it.

**`apps/web-v2/src/shared/chords.ts:118-124, 150-152`**

```ts
for (const [key, run] of Object.entries(alwaysOn ?? {})) {
  guarded[key] = run;          // no suspension test AND silently overwrites `bindings`
}
```

Two issues. (1) `alwaysOn` bindings receive **no** suspension test at all, so an `alwaysOn`
key fires while a correction editor has focus. The prose defends this for Escape only
(*"Escape must fire from INSIDE those same places — it is how you leave them"*), which is
correct, but nothing in the type or the code restricts `alwaysOn` to Escape. A future agent
adding `"c"` to `alwaysOn` gets exactly the prototype bug this file was written to prevent —
confirming a ruling from inside a text field — and nothing fails.

(2) The loop runs **after** the guarded loop and writes into the same object, so an
`alwaysOn` key silently replaces a same-named suppressed binding with no warning.

Today's only call site is correct (`GlobalKeys.tsx:70-77`, Escape only). The hole is
structural, not present.

**Fix.** Type it shut: `readonly alwaysOn?: Readonly<Partial<Record<"Escape", (e: KeyboardEvent) => void>>>`.
If a second key is ever genuinely needed, widening that type is a visible diff — which is
exactly what the comment says it wants (*"a deliberate, visible act at the call site"*), just
enforced rather than requested. And `console.warn` (or throw in dev) on the key collision.

### S4 — `ProgressMeter` re-derives a proportion the server did not send, and there are two different ProgressMeters.

**`apps/web-v2/src/entities/order/ProgressMeter.tsx:45`** and **`apps/web-v2/src/components/ui/ProgressMeter.tsx`**

```ts
const filled = total === 0 ? 0 : Math.floor((settled / total) * DOTS);
```

The comment at `:20-23` pre-defends this: *"the DOTS are drawn from those two numbers, and
that is not a derivation of state — it is the same number rendered as marks instead of as
digits."* That is not quite true. 18 dots from N/M is a **proportion rounded to eighteenths**,
which is a third number that agrees with neither. At `settled=1, total=100` the meter shows
zero filled dots beside the text "1 of 100" — the graphic says nothing has happened and the
text says something has. Design rule 11: *"Numbers reconcile across screens — one variable,
never two literals."* This is two representations of one variable that disagree.

Worse, there are **two** ProgressMeter components in this branch with different rules:
`components/ui/ProgressMeter.tsx` explicitly refuses to draw a graphic above `MAX_DOTS`
(*"a bar rounded to the nearest twentieth is a number the screen would then disagree with,
which rule 11 exists to prevent"*), while `entities/order/ProgressMeter.tsx` does exactly the
rounding the other one refuses. Two components, same name, opposite conclusions from the same
rule. Whichever screen imports which is now a coin flip.

The `entities` one also references a `track` token that no longer exists after the revaluation
(see S7) — though only in a comment, so nothing is broken.

**Fix.** Delete one. The `components/ui` version has the better reasoning; keep it and make
`entities/order` a thin domain wrapper, or delete the domain one outright.

### S5 — `ReadingPair` renders an unciteable value, and does it by hand.

**`apps/web-v2/src/entities/field/ReadingPair.tsx:72-79, 108-111`**

The component prints `reading.value` (via `ReadingText`/`segmentsFor`) and `reading.snippet`
without going through `readCited`, and the comment at `:63-71` is candid about why: a
`FieldReading` has `page` and `snippet` but no `source_doc_id` (`entities.ts:70-81`), so it
cannot form a `Citation`. It concludes *"the page renders as a page and claims nothing more."*

That is a defensible reading of INVARIANT 28-31 (both readings shown **attributed**) but it
sits badly against AGENTS.md's *"Never emit a value you can't cite"* and INVARIANT 8. A
pre-merge engine reading printed with a page number and a snippet, and no document, is
precisely a value with half a citation — and `provenance.ts:106-110` says *"half a citation is
not a weaker citation, it is none."* The file quotes that line and then renders anyway.

I do not think the component is wrong; I think the contract gap is a **CONFLICT** that
INVARIANTS.md's own instructions say must be reported and not designed around
(*"If a rule cannot be satisfied by a proposed design, that is a `CONFLICT` in the design.
Stop and report it"*). The code notes it *"Reported as a contract gap"* — I can find no such
report in `docs/`.

Separately, `:108-111` re-uses the `not-extracted` chip for an engine that returned nothing,
overriding only the sentence. That means `data-field-render="not-extracted"` and
`data-surfaced-for-review="false"` now appear on a row that is **not** a pipeline statement
about a field. Any Playwright assertion counting `[data-field-render="not-extracted"]` will
now be wrong on the review screen. The comment at `:95-99` explains the intent well; the
attribute does not carry the distinction the comment draws.

**Fix.** File the contract gap in `docs/` as a CONFLICT. Give the reading chip its own
`data-field-render="engine-returned-nothing"` so the five field renders stay five.

### S6 — nothing marks a table row or a tab as owning its keys, so B3's fallback does not save them.

**`apps/web-v2/src/components/ui/DataTable.tsx`, `Tabs.tsx`, `SegmentedControl.tsx`, `RadioGroup.tsx`**

```
$ grep -rn "data-chord-scope" src/ | grep -v shared/chords
src/app/keyboard/CommandPalette.tsx:58     ✓
src/app/keyboard/KeyMap.tsx:79             ✓
src/components/ui/Dialog.tsx:46            ✓
src/components/ui/Popover.tsx:36           ✓
src/components/ui/Option.tsx:14            (comment only — deliberately NOT set)
```

The overlays are covered. The **in-page composites are not**. `Tabs.tsx` has no scope, and the
five stage tabs on the order bar are exactly the surface where a reviewer's arrow/letter keys
land. `DataTable` has no scope and no `role` this function recognises on a focused row (see B3).
`SegmentedControl`, `RadioGroup`, `Checkbox` and `Switch` all put focus on elements whose roles
are absent from the list.

`Option.tsx:14` deliberately declines to set the attribute, arguing it belongs on the popover.
That is right for `Select` and `ComboBox`. It is wrong for a `ListBox` used **inline**, which
has no popover — and nothing prevents that.

**Fix.** Fix `focusOwnsKeys` (B3) first, since scope-marking every composite is the fallback,
not the mechanism. Then add `data-chord-scope="own"` to `TabList` and to `DataTable`'s
`<table>` as defence in depth.

### S7 — the token revaluation dropped 107 custom properties, including the entire type scale aliases and every shadow.

**`packages/ui-tokens/src/tokens.css`** (−974 / +342 lines)

```
$ comm -23 /tmp/rm.txt /tmp/add.txt | wc -l
107
```

Removed and not re-added, among others: `--text-xs/sm/base/md/lg/xl/2xl…6xl`, `--text-micro`,
`--text-tiny`, `--text-census`; `--shadow-1/2/3`, `--shadow-drawer`, `--shadow-knob`,
`--shadow-menu`, `--shadow-pop`, `--shadow-page-on-dark`, `--shadow-stage-current`;
`--radius-1..10`, `--radius-xl`; `--stroke-*` (5); `--font-display`, `--font-document`,
`--font-quote`; `--font-weight-book/demi/strong/title`; the whole `--color-document-*` family
(24), `--color-page-ref-*`, `--color-rail-*` (8), `--color-state-decide-*`,
`--color-state-idle-*`, `--color-track`.

**Most of this is correct and is the point of the revaluation.** Deleting `--text-xs…6xl` is
design rule 2 enforced structurally (`--text-*: initial;` at `:99` resets Tailwind's scale, and
only the six rungs plus `--text-verdict: 40px` survive at `:324-329` — which matches rule 2's
`11/13/16/20/28/40` exactly). Verified: nothing in `src/` references a removed token except one
comment.

```
$ for t in $(…); do grep -rlo "\b$t\b" apps/web-v2/src packages/*/src; done
STILL-USED track -> apps/web-v2/src/entities/order/ProgressMeter.tsx
```
— and that is the word "track" in prose at `:35`, not a token reference. So nothing is broken.

**What was lost that matters:** `--color-state-decide-*` and `--color-state-idle-*`. The state
palette is now settled/attend/halt only. If any screen needed a fourth or fifth state tone
(`ProgressMeter`, `StageDots`, the queue spine), it now has nowhere to go and will reach for
`attend`, overloading the one tone that means "look at this". Flag rather than block: no
current consumer needs it.

**Fix.** None required. Record the deletion rationale in the file header so the next agent does
not re-add `--text-sm` because "it was there before."

---

## The four NA states, checked visually (answers Q7)

The revaluation kept every NA token. Distinguishability, tabulated from
`noValueStates.ts:47-88` resolved against `tokens.css:237-251`:

| render | ink | border | style | fill | mark |
|---|---|---|---|---|---|
| NOT_PRESENT | `#6e7480` | `#d6d9e1` | solid | `#fbfbfd` sunken | • |
| NOT_FOUND | `#454a55` | `#d6d9e1` | dashed | transparent | ◆ |
| NOT_STATED | `#454a55` | `#d6d9e1` | solid | hatch `#b9bec9` | ◆ |
| PRESENT_UNREADABLE | `#8a5b12` | `#f3e7d3` | solid | `#fbf3e4` | ◆ |
| not-extracted | `#6e7480` | `#d6d9e1` | dotted | transparent | • |

All five differ in at least two channels, and the sentences differ entirely, so INVARIANT 7 and
rule 14 hold. Two pairs are closer than the file's own standard (*"each has a border STYLE and
a FILL"*):

- **NOT_PRESENT vs not-extracted** share ink, border colour and mark (3/5). They separate only
  on border style (solid vs dotted) and fill (sunken `#fbfbfd` vs transparent — against a
  `#ffffff` panel that is a 1.5% luminance difference, i.e. invisible). **In practice these two
  are distinguished by solid-vs-dotted border and by the sentence alone.** They are the exact
  pair INVARIANT 7 says must never be confused ("`pending` is a distinct third render"). This
  is a **NIT-bordering-SHOULD-FIX**: it holds, but with less margin than the file claims.
- **NOT_FOUND vs NOT_STATED** share ink, border colour and mark; separated by dashed-vs-solid
  and transparent-vs-hatch. The hatch is a real, robust difference. Fine.

The greyscale/CVD claim in `noValueStates.ts:12-14` is **true** — every pair differs on a
non-colour channel (style, fill pattern, or mark).

---

## NITS

### N1 — the React Compiler is on, and it is actually running. Verified.
`vite.config.ts` wires `babel({ presets: [reactCompilerPreset()] })`, and the long comment about
`@vitejs/plugin-react` v6 having no `babel`/`reactCompiler` key is correct for the installed
6.0.3. Proof it ran, from the emitted bundle:
```
$ grep -o "useMemoCache" dist/assets/index-DLVrm3lC.js | head -2
useMemoCache
useMemoCache
$ grep -o "c(\([0-9]\+\))" dist/assets/index-DLVrm3lC.js | head -3
c(2)  c(0)  c(0)
```
`useMemoCache` and `_c(n)` slots are compiler output. This one is real. No finding.

### N2 — the motion ban is real and tighter than advertised. Verified.
All four evasions are caught:
```
$ npx eslint src/__probe --no-ignore
m.tsx  1:8   error  * import is invalid because 'motion' from 'motion/react' is restricted…
m2.tsx 1:10  error  'motion' import from 'motion/react' is restricted…
m3.tsx 1:1   error  'motion/react-client' import is restricted from being used by a pattern…
m4.ts  1:1   error  'motion/dom' import is restricted from being used by a pattern…
```
Namespace import, named import, the react-client entry and the imperative `motion/dom` entry
are all blocked by the pattern rule. No finding. (It does not stop `await import("motion")` at
runtime — a dynamic import evades `no-restricted-imports`. Low risk, worth a `check-rules.mjs`
grep.)

### N3 — size-limit measures the shell correctly today, but the glob is fragile.
```
$ npx size-limit
shell (js) — the entry chunk, not every chunk in the directory
  Size limit: 320 kB   Size: 149.56 kB brotlied
app bundle (css)
  Size limit: 40 kB    Size: 6.35 kB brotlied
```
`dist/assets/index-*.js` with `!dist/assets/pdf-*.js` does isolate the entry — `dist/assets/`
currently holds `index-*.js` and `browser-*.js` (the MSW worker), and `browser-*` is correctly
excluded by the glob not matching it. Two fragilities: (a) the `!pdf-*` negation is redundant
today and will stay silently redundant if `manualChunks` ever renames the chunk; (b) any future
lazy route chunk named `index-*` (Vite names chunks after the module, and `routes/index.tsx`
would produce exactly that) would be silently included and inflate the number. Prefer asserting
against the entry recorded in `dist/.vite/manifest.json` rather than a filename glob.

### N4 — primitives are clean on domain leakage, raw hex and the type scale.
```
$ grep -rn "#[0-9a-fA-F]{3,8}" src/ --include=*.tsx --include=*.ts --include=*.css
(nothing)
$ grep -rno "text-\[.*\]|text-xs|text-sm|text-lg|text-xl|text-2xl|text-base" src/
src/entities/field/noValueStates.test.ts:49  (a regex literal, not a class)
```
Zero raw hex in app code, zero off-scale type. `components/ui/*` imports nothing from
`entities/` or `@titlepipe/contract` except `Disablement`. The `h-13`/`h-16`/`h-20` sizes read
as off-scale but are `N × 2px` against `--spacing: 2px` (26/32/40px), which `Button.tsx:62-64`
documents. Clean. No finding.

---

## The single biggest architectural risk

**Prose that documents intent is being read as prose that documents behaviour, and the
enforcement it claims does not exist.**

This is not a style complaint. Four files in this branch open with a paragraph explaining that
a rule has been broken repeatedly, that review is therefore insufficient, and that the rule has
now been converted into a mechanism `tsc` enforces. In three of the four, the mechanism does
not do what the paragraph says:

- `provenance.ts` says a component cannot render an uncited value. It can, three ways (B1).
- `provenance.ts` says the `never` guard prevents the grey-dash collapse. It does not (B2).
- `chords.ts` says `role` covers the react-aria composites. It covers none of the roles react-aria actually focuses (B3).
- `crash.ts` says the payload goes through the backend's redaction. There is no backend endpoint, and the two fields carrying data are outside the allowlist (B4).

`disabled.ts` is the exception — its `Omit` genuinely compiles-errors — and the contrast is the
problem. Because one of them is real, the others read as real.

The compounding mechanism is this: **these headers are more persuasive than a test, and they
are load-bearing in place of one.** `chords.ts:18-19` cites
`e2e/invariants/chord-suppression.spec.ts` as proof; that file was deleted before this branch
began (INVARIANTS.md preamble), and this branch's `e2e/` does not contain it. `NoValueChip.tsx:17`
cites `entities/field/noValue.test.ts`; the file is `noValueStates.test.ts`. A future agent
reading "this is enforced by the compiler, and `spec.ts` pins it" will not write the test, will
not check the claim, and will delete a guard believing a type is behind it.

The rebuild has three agents writing concurrently against exactly these files. Every one of
them is reading these headers as ground truth right now.

**The remedy is mechanical and should land before more screens do:** for each header claiming
compile-time enforcement, write the scratch file that *should* fail to compile and put it in
CI as a `tsc --noEmit` expected-failure fixture (`@ts-expect-error` inverted, or a
`expect-type` assertion). Where the claim cannot be made true, edit the header down to what is
true. A comment that overstates a guarantee on a codebase whose stated rule is *"never emit a
value you can't cite"* is the same defect class as the values it is trying to prevent: an
assertion without provenance.

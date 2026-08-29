# REVIEW-02 — `entities/`, `app/`, `features/signin/`

Adversarial review, 2026-08-27, branch `frontend/rebuild-2026-08` at `7fa9cf5`.
Scope: `apps/web-v2/src/entities/` (17 domain components), `apps/web-v2/src/app/`
(shell, routing, keyboard), `apps/web-v2/src/features/signin/`. `components/ui/` is
another reviewer's.

REVIEW-01's four BLOCKERs (B1 raw `field.value`, B2 the collapsed `na` branch, B3 the
focus-role table, B4 `component_stack`) are **fixed and are not re-reported**. The
flattened `FieldValue` union was checked for new problems; it introduced one (D1 below)
and did not introduce the rest.

## What was run

| Check | Result |
|---|---|
| `pnpm typecheck` (`tsc -b`) | clean |
| `node scripts/check-rules.mjs` | `clean (71 files)` |
| `pnpm test` (vitest, 39 files) | `234 passed` |
| `npx vite build` | succeeds; all 6 `@utility` classes emit into `dist/assets/app-*.css` |
| 6 throwaway probe suites under the `gates` project | results quoted inline; **all probe files deleted after the run** |

Every claim below is backed by one of those runs or by a literal file:line. Nothing here
is inferred from reading alone.

---

## 1. DERIVATION — the cardinal sin

The headline finding is **negative, and it is real**: the prototype's
`answeredTotal = D.base + a` has no survivor. Grep for arithmetic, threshold
comparison and `state`-from-`value` across all three scoped directories returns no
count re-derivation, no confidence comparison, and no `needs_review` inference.
`StatePill` cannot even see confidence (§8). `DecisionCard.stories.tsx:25` sets
`engine_confidence_raw: 0.62` and `:89` asserts the pill still reads `needs_review`.

Three things nevertheless derive.

### D1 · BLOCKER — `readCited` silently DISCARDS a server value that arrives with an `na_reason`

`apps/web-v2/src/shared/provenance.ts:82-87`

```ts
if (field.na_reason !== null) {
  const kind = NA_KIND[field.na_reason];
  return kind === "na-present-unreadable" ? { kind, citation: … } : { kind };
}
if (field.value === null) { … }
```

`na_reason` is tested first and `value` is never read on that path. Proven:

```
PROBE: a server value ARRIVING WITH an na_reason is silently discarded ✓
  { value: "MARIA L. ESTRADA", na_reason: "NOT_FOUND" }
    → { kind: "na-not-found" }          // the value is GONE
    → JSON.stringify(out) does not contain "ESTRADA"
PROBE: PRESENT_UNREADABLE with a value also discards it ✓
```

The header at `:68-73` argues the ordering, and the argument is correct **for a field
where exactly one of the two is set**. It says nothing about the case where both are.
`entities.ts:90-99` permits both: `value` and `na_reason` are independently nullable,
with no refinement forbidding the pair. So the contract can express "there is a value
AND the server has classified the document", and the browser answers by throwing the
value away and drawing an absence.

This is a derivation of the worst kind — the UI deciding that a server-sent value does
not exist. It is the mirror image of the `uncited` branch, which exists precisely
because `entities.ts:85-89` calls a value the server sent with a broken envelope "the
exact failure shape the architecture exists to catch". A value arriving with an NA
reason is the same class of contradiction and gets silence instead of a defect render.

**Invariants:** INVARIANT 8 (a value must never render as a blank), AGENTS.md hard rule
3 (the server owns the state machine — including the one that decided both members).

**Fix:** add a seventh member, `{ kind: "contradictory"; value: string; naReason: NaReason }`,
classified before either existing branch, and render it in the halt family beside
`uncited`. The flat union makes this cheap: the `never` guard at `FieldValueView.tsx:110`
will fail to compile until the branch is drawn, which is exactly the B2 fix working.
Alternatively get a `superRefine` onto `Field` — but the contract is frozen, so the
render is the reachable half today.

### D2 · BLOCKER — `entities/order/ProgressMeter.tsx` scales counts onto a fixed 18-dot track, and a second, incompatible `ProgressMeter` ships beside it

`apps/web-v2/src/entities/order/ProgressMeter.tsx:36,45`

```ts
const DOTS = 18;
const filled = total === 0 ? 0 : Math.floor((settled / total) * DOTS);
```

Proven:

```
PROBE: entities/ProgressMeter fills dots that do not correspond to decisions ✓
  filled(1, 5)  === 3    // ONE decision settled, THREE dots lit
  filled(2, 3)  === 12   // 2 of 3 settled, twelve dots lit
```

The header at `:13-24` claims "the DOTS are drawn from those two numbers, and that is
not a derivation of state — it is the same number rendered as marks instead of as
digits." That is false as written. Eighteen dots against a total of five is not the
same number in another notation; it is a **proportion**, computed in the browser,
rounded, and drawn as a countable quantity. The very next lines of the same header
argue that dots beat a bar because "a reviewer reads '9 of 18 settled', not a rate" —
and then ships a component where nine lit dots can mean one decision of two. A reader
who counts the dots gets a different answer from the label directly beneath them, which
is design rule 11's "one variable, never two literals" broken inside a single component.

Worse, `apps/web-v2/src/components/ui/ProgressMeter.tsx` already exists, is exported
from `components/ui/index.ts:37`, and solves the same problem correctly — one dot per
actual decision (`:65`, `length: safeTotal`), no graphic above `MAX_DOTS = 24` (`:39,63`),
with its own header explaining at length why a computed proportion is refused. Proven:

```
PROBE: TWO ProgressMeters exist and disagree about what a dot means ✓
  entities:  "Math.floor((settled / total) * DOTS)"   DOTS = 18
  ui:        "length: safeTotal"                      MAX_DOTS = 24
  both: `export function ProgressMeter`, both take { settled, total }
```

Two same-named exports with the same prop names and opposite semantics is how a screen
imports the wrong one and nobody notices. `entities/order/ProgressMeter.tsx` also has
zero non-story importers today (checked across `src/`), so the cheap fix is available.

**Invariants:** INVARIANT 5 (the UI never re-derives counts), design rule 11.
**Fix:** delete `entities/order/ProgressMeter.tsx` and its story; use
`components/ui/ProgressMeter`. If the design's fixed 18-track is genuinely wanted,
it has to come from the server as a third number, not from division.

### D3 · SHOULD-FIX — `EscalationCard` derives "settled" from `rule_id` alone and ignores `resolution`

`apps/web-v2/src/entities/rule/EscalationCard.tsx:40,73`

```ts
const resolvedByRule = escalation.rule_id !== null;
…
{!resolvedByRule && ( <p data-refusal="no-rule"> Open. A ruling alone is not a resolution … )}
```

The card correctly refuses the case the header is about — `resolution` set, `rule_id`
null, drawn as still open. It gets the *converse* wrong. Proven:

```
PROBE: an escalation with a rule but NO resolution renders as settled ✓
  { resolution: null, rule_id: "R-42" }
    → resolvedByRule === true    // calm border, no refusal banner
    → e.resolution === null      // ...while still UNRESOLVED
```

`authz.ts:104` gates `escalation.resolve` on `when: { resolution: [null] }` — the
server's own definition of "still open" is the **resolution** member. A rule cited
against an escalation nobody has resolved draws as closed. `data-resolved-by-rule` on
`:45` will read `true`, so a Playwright assertion built on that attribute inherits the
bug.

**Invariants:** INVARIANT 36 / AGENTS.md ("escalation resolution is refused without a
rule" — both halves), INVARIANT 5.
**Fix:** `const settled = escalation.resolution !== null && escalation.rule_id !== null;`
and give the rule-without-resolution case its own sentence. Three states, three
renders — the same argument `DecisionQuestion` makes for `asking`.

---

## 2. THE FIVE RENDERS

The machinery is genuinely good. `noValueStates.ts:42` is a
`Record<NoValueRender, …>` over the frozen enum plus the pipeline member, so a fifth
`NaReason` fails to compile. `FieldValueView.tsx:85-107` writes the three
citation-less reasons out one by one rather than folding them (`:80-84` explains why),
and `assertNever` at `:110` holds it. `noValueStates.test.ts` passes and asserts
distinct sentences, distinct ink+border signatures, and rulebook-copied
`surfacedForReview`.

**PRESENT_UNREADABLE is correctly the only member carrying a page reference.** The type
enforces it, not a comment: `fieldValue.ts:92` puts `citation` on that branch alone, so
the other three cannot render one. `FieldValueView.tsx:100-107` is the only NA branch
that draws a `CitationRef`. This matches `enums.ts:41-43` exactly. No finding.

### R1 · SHOULD-FIX — under time pressure, NOT_FOUND and NOT_STATED are two channels apart, not five

The tokens file claims each render differs in "sentence, mark, ink, border style, fill",
and the test at `noValueStates.test.ts:171` only asserts the **pair** (ink, border) is
unique — which is a weaker claim than the header. Measured against the real token
values:

```
PROBE: two NA renders resolve to the SAME ink hex and SAME border hex ✓
  --color-na-not-found-ink   #454a55  ==  --color-na-silent-ink        #454a55
  --color-na-not-found-border #d6d9e1 ==  --color-na-not-present-border #d6d9e1
  five renders, TWO distinct marks (new Set(marks).size === 2)
```

So NOT_FOUND vs NOT_STATED differ in exactly two channels: the sentence, and a hatch
background (`entities.css:16-22`) versus a dashed border. Same ink, same mark (`◆`),
same border colour. `enums.ts:36-39` names this as the pair reviewers confuse — "the
search happened and returned a document; the document does not say" — and it is the
pair drawn most alike. Three of the five share the `◆` mark, so rule 6's "one status
signal per row, a mark + weight" carries no information across most of the taxonomy.

The test cannot catch this because it compares **class-name strings**, not resolved
colours: `text-na-not-found-ink` and `text-na-silent-ink` are different strings that
name the same hex.

**Invariants:** INVARIANT 7 (never collapsed), CONTEXT §11.
**Fix:** two parts. (a) Resolve the tokens before comparing them in
`noValueStates.test.ts` — read `tokens.css` and assert distinct **hex**, which is what
the header claims. (b) Give the five five marks, or accept that ink is not carrying and
lean harder on border style, which is the channel that survives greyscale anyway.

### R2 · NIT — `NoValueChip`'s `sentence` override can make any render say anything

`apps/web-v2/src/entities/field/NoValueChip.tsx:21-22,45` — `sentence ?? descriptor.sentence`.
Proven present, and already used: `ReadingPair.tsx:109` renders
`render="not-extracted" sentence="This engine returned nothing"`. That specific use is
argued well (`:95-100`) and is right. But the escape hatch is open to every caller, the
prop comment ("Only for a NON-field absence") is not enforceable, and
`data-field-render` still reports the taxonomy member — so an overridden chip passes
every attribute-based assertion while showing invented copy. The distinctness test
checks the **table**, not the rendered chip, so it cannot see this at all.
**Fix:** replace the free string with a closed variant, e.g. `context?: "engine"`,
resolved inside the component.

---

## 3. PROVENANCE

`FieldValueView.tsx:59-75` draws `uncited` as a hard visible error — halt-family left
rule, halt ink, and the sentence "No source on record — cannot be cited". Never a
blank, never a bare value. INVARIANT 8 is satisfied for `Field`. Half a citation
degrades to that same defect render:

```
PROBE: half a citation degrades to the uncited DEFECT render ✓
  { value: "X", source_doc_id: "D1", source_page: null } → { kind: "uncited", value: "X" }
```

`CitationRef.tsx` takes a whole `Citation` and has no missing-page branch, which is the
right shape. `check-rules.mjs` reports clean, so no file outside `provenance.ts` touches
`Field.value`.

### P1 · BLOCKER — `ReadingPair` prints a full value with no provenance, at cited weight, and offers to adopt it

`apps/web-v2/src/entities/field/ReadingPair.tsx:101-112`, `readingDiff.tsx:46`

The lint pair (`no-restricted-syntax` + `check-rules.mjs`'s `raw-field-value`) guards
`Field.value`. It does not guard `FieldReading.value`, and `ReadingPair` reads it
directly at `:108` and `:111`. `ReadingText` draws it
`font-mono text-body … text-ink-primary` (`readingDiff.tsx:46`) — the **identical**
typography and ink `FieldValueView.tsx:45` uses for a properly cited value.

The component's own comment at `:63-71` is honest about the cause: a `FieldReading`
carries `page` and `snippet` but no `source_doc_id`, `Citation` requires one, and
fabricating a doc id would be inventing provenance. Correct, and the refusal to
fabricate is right. But the conclusion drawn — print the value at full weight and show
`p.12` — is the one option the rulebook forbids. AGENTS.md: "Never emit a value you
can't cite." A bare page number is `provenance.ts:104-110`'s own "half a citation is
not a weaker citation, it is none".

This is not academic, because **the value is adoptable**. `:81-90` renders "Adopt this
reading", and `:87` hands `reading` up to `onAdopt`, which design §Screens 7 wires
into the correction editor. So an uncitable string, drawn exactly like a cited one, is
one click from becoming a reviewer's correction. See §11.

**Invariants:** INVARIANT 8, AGENTS.md principle 6.
**Fix:** two things, neither of which needs a contract change. (a) Draw a reading in a
visibly **subordinate** register from a cited field value — it is a pre-merge artefact,
not an answer. (b) Extend the `check-rules.mjs` `raw-field-value` rule to
`FieldReading.value` so the next component to reach for it has to justify itself. The
contract gap (no `source_doc_id` on `FieldReading`) is worth filing regardless; the
comment says it was reported, but nothing in `docs/` records it.

### P2 · NIT — the "reading differs" highlight steals PRESENT_UNREADABLE's tokens

`readingDiff.tsx:46` uses `bg-na-unreadable-surface` and `text-na-unreadable-ink`, and
`noValueStates.ts:75-77` uses the same two for PRESENT_UNREADABLE. Proven by grep in
probe 6. Two different claims — "this character differs between engines" and "this is
on the page and could not be read" — in the same amber, on the same screen, potentially
in the same decision card. Reuse a neutral attend token or introduce a diff token.

---

## 4. `asking` / `why`

**Clean, and it is the best-argued file in the scope.**
`DecisionQuestion.tsx:36-48` has no `??` fallback anywhere. There is no
`"Is this correct?"`, and no question composed from the readings array. Three states are
handled as three statements: `undefined` returns null (`:37`), `null` renders
`data-decision-question="unauthored"` with the pipeline's own voice (`:39-48`), and a
string renders verbatim (`:53`). `DecisionCard.tsx:69` passes both straight through.
`why` is independently gated at `:59`, so an authored question with no authored reason
shows no reason rather than a guessed one. Stories pin all three
(`DecisionCard.stories.tsx:98-123`) and pass.

One adjacent note, not a violation: `DecisionCard`'s `consequence` prop (`:34-38`) is
documented as server-authored, and `intake.ts:129` does carry a `consequence` on
`GapCloseOption` — but that is the ingest gap-close shape, not a field. No field-level
consequence exists in the contract. The prop is correctly typed as caller-supplied and
the card composes nothing, so this is a **caller** obligation with no compiler behind
it. Worth a line in the prop doc naming the absent surface, as `orderScreens.ts` does
for countersign.

---

## 5. ROUTING vs THE DOOR TABLE

Every route corresponds to a door. Proven by extracting both lists mechanically:

```
routes 16, doors 16
routes not in doors: []
doors with no route: []
```

`/orders/$orderId` and `/blind/$orderId` are the order-scoped forms of `/orders` and
`/blind`, which `authz.ts:50` says a door's `path` covers as a prefix. No `/sign-in`
route exists, and `routeTree.tsx:21-25` argues correctly that inventing one would be a
door outside the frozen table. **No finding on route/door correspondence.**

Doors are ABSENT, not dimmed. `SideRail.tsx:75-80` filters by `hasDoor` and returns
`null` for an empty section; there is no `disabled` branch and nowhere to add one
without changing the loop's shape. Permissions are **read**, not computed:
`permissions.ts` deliberately refuses to import `canAccess`/`rulesFor` (`:11-17`), and
grep confirms neither is called anywhere under `src/`. The role is in the query key
(`:36`), which fixes the cached-admin-projection defect its own header describes.

### A1 · BLOCKER — nothing enforces the door table on route ENTRY; hiding a door is the whole gate

Grep proof: `canAccess` appears in `src/` only inside a comment in
`permissions.ts:11`. `routeTree.tsx` declares no `beforeLoad` on any of the eighteen
routes. So the rail hides a door the role lacks, and the **screen behind it still mounts**
if the URL is typed, pasted, or arrived at by browser history.

```
PROBE: no route in the app enforces the door table on ENTRY ✓
  canAccess("typist", "/golden") === false   // server says no
  // ...but routeTree.tsx has no beforeLoad, so the screen mounts anyway
```

Today every screen is an `Unbuilt` placeholder that fetches nothing, so nothing leaks
*yet*. That is the reason this is a BLOCKER rather than a defect report: the first
screen that binds to data inherits a shell with no entry gate, and the gap will not be
visible at that moment. INVARIANT 41's "one permission table gates UI affordances and
server mutations alike" is satisfied for affordances and not for entry.

**Fix:** a `beforeLoad` on the root that checks the fetched projection's `path` list
against the target and renders a named refusal (not a redirect — the URL is evidence).
It must read the **server payload**, not call `canAccess`, or it re-derives the table
in the browser and undoes `permissions.ts`'s whole argument.

### A2 · SHOULD-FIX — `/blind-status` is treated as the capture seat and loses its rail

`apps/web-v2/src/app/rootRoute.tsx:86` — `!pathname.startsWith("/blind")`.

```
PROBE: the rail is hidden on /blind-status, which is NOT the capture seat ✓
  railHidden("/blind/o1")   === true    // intended, INVARIANT 46
  railHidden("/blind-status") === true  // NOT intended
  canAccess("ops",    "/blind-status") === true
  canAccess("typist", "/blind-status") === false
```

`/blind-status` is an **ops** door (`authz.ts:76`) that a typist cannot even enter.
INVARIANT 46's structural blindness protects the *typist at the seat*; applying it to
the ops supervisor's status board strands that reader with no navigation at all. The
header at `:82-85` argues, correctly, for matching on URL rather than role — the bug is
the prefix, not the strategy.

The same prefix bug appears in the rail's active-door logic:

```
PROBE: SideRail marks the /blind door ACTIVE while standing on /blind-status ✓
  active("/blind", "/blind-status")        === true   // wrong door lit
  active("/blind-status", "/blind-status") === true   // two lit at once
```

`SideRail.tsx:90-93` uses `pathname.startsWith(door.path)` with no separator, so any
door whose path is a string prefix of another lights both. `/blind` and `/blind-status`
are the live pair; `/orders` would collide with a future `/orders-archive`.

**Fix:** match the segment, not the string — `p === d || p.startsWith(d + "/")`, which
is exactly the rule `authz.ts:126-131`'s `canAccess` already implements and this file
reimplements slightly wrong. That is the drift `permissions.ts` warned about, arriving
through a helper instead of through a policy call.

### A3 · NIT — `NotFound` reads `window.location`, not the router

`Unbuilt.tsx:320`. Proven. Outside React's render model, so it will not repaint on a
client-side navigation into another unknown path, and it is unrenderable under SSR or
in a DOM-free test. `useRouterState({ select: s => s.location.pathname })` is used
correctly three lines away in sibling files.

---

## 6. THE KEYBOARD SYSTEM

**The prototype's `?`-then-`c` bug is closed, twice.** `KeyMap.tsx:79` sets
`data-chord-scope="own"`, and `chords.ts:77-82`'s `overlayIsUp` matches both
`[role='dialog']` and that attribute, so `suspendedBecause` (`:136-143`) returns
`"overlay"` for every ordinary binding while the sheet is up. Belt and braces, and the
one-frame gap between open and focused is genuinely covered.

**The palette's typeahead is isolated**, and by construction rather than by a flag: the
query box is a real `<input>` (`CommandPalette.tsx:62`), so `focusOwnsKeys` returns true
on `tagName` alone (`focusOwnership.ts:75`). Arrow/Enter are on the input's `onKeyDown`
(`:72-85`), never on the window.

**Chords are genuinely NOT INSTALLED when signed out.** `useChords`'s effect returns
early before `tinykeys` is called (`chords.ts:109-110`), so there is no listener on
`window` — dead, not inert, exactly as claimed. `GlobalKeys.tsx:79` passes
`enabled: signedIn`, and `rootRoute.tsx:62-69` does not even mount `GlobalKeys` while
signed out. Two mechanisms again.

`Escape` as the sole `alwaysOn` binding (`GlobalKeys.tsx:70-77`) is right and is
argued. The overlay stack (`overlays.ts`) pops one layer, innermost first.

### K1 · SHOULD-FIX — the cheat sheet documents seven bindings that do not exist

`KeyMap.tsx:47,53-61`. Proven:

```
PROBE: the cheat sheet documents six review chords that are installed nowhere ✓
  KeyMap lists C, E, Q, J, K, Z; GlobalKeys installs none of them
PROBE: the cheat sheet documents an order switcher the palette refuses ✓
  KeyMap:47  "Open the command palette and order switcher"
  commands.ts "deliberately NOT orders"
```

Grep across all of `src/` for those key literals returns **nothing** — no screen
installs them, because the review screen is still a placeholder. That part is
defensible as forward documentation. The `⌘K` row is not: it advertises an "order
switcher" that `commands.ts:10-28` refuses on principle and that
`CommandPalette.tsx:111-114` states a refusal for **on screen**. The help overlay and
the thing it describes contradict each other in the same build. A reader who presses
`⌘K` looking for the switcher the map promised finds a paragraph explaining why it does
not exist.

`KeyMap.tsx:33-45` is meticulous about two other edits it made for exactly this reason
(the NA digits, the `/` description) and then leaves this one.
**Fix:** drop "and order switcher". Consider marking the Review block as not-yet-bound,
in the same voice `Unbuilt` uses.

### K2 · NIT — `?` is documented as a toggle and cannot close the map

```
PROBE: `?` is documented as a toggle but cannot close the key map ✓
```

`KeyMap.tsx:49` reads "Toggle this keyboard map". The binding is `toggle("key-map")`
(`GlobalKeys.tsx:47`), so the intent is real — but once the dialog is up,
`overlayIsUp()` is true and `?` is suppressed like every other ordinary binding. Escape
closes it; `?` does not. The map is dismissable and focus-trapped, so this is a copy
defect, not a trap. Say "Open this keyboard map · Esc closes".

---

## 7. SIGN-IN

INVARIANT 45 is satisfied **structurally**: `rootRoute.tsx:62-69` returns
`<SigninScreen/>` instead of the frame, so `SideRail`, `OrderStrip`, `KeyMap`,
`CommandPalette` and `GlobalKeys` are not mounted at all. No rail to leak, no chord to
fire, nothing for a screen to remember. `ProfileBlock.tsx:197` has a redundant guard on
top of that. `CredentialsForm` refuses honestly rather than inventing
`/api/auth/login` — the right call, and the one legitimate case of client-authored
refusal copy, argued at `:26-31`.

### S1 · BLOCKER — the app boots signed in as **admin**, and the demo switcher has no dev-only guard in the shipped bundle

```
PROBE: the app boots SIGNED IN AS ADMIN with nobody having signed in ✓
  signedIn.ts:73  DEV_DEFAULT = DEMO_ACCOUNTS.find(a => a.name === "L. Vance")
  demoAccounts.ts L. Vance → role: "admin"
  signedIn.ts:78  account: DEV_DEFAULT ?? null
PROBE: demo accounts and x-mock-role ship UNGUARDED into a live build ✓
  main.tsx knows `apiMode === "mock"` vs "live"
  SigninScreen.tsx, demoAccounts.ts, api.ts: no import.meta.env / apiMode / MODE guard
  api.ts:75  "x-mock-role": currentRole()      // sent on EVERY request, live included
  SigninScreen.tsx:52  actAs(account.role)     // set by clicking a row
```

`signedIn.ts:47-71` argues the default at length and the argument has real force: the
mock server treats a missing header as an admin session, so booting signed-out would
make client and server disagree, and deep links would break because nothing persists.
Both true. But the conclusion the file draws — ship an admin session to anybody who
loads the page — is INVARIANT 45's exact prohibition, defeated by the one path the
invariant does not name. Nobody has signed in. An admin world is shown. The design's
own screen 1 becomes unreachable except by signing out.

The compounding problem is that **none of it is mode-gated**. `main.tsx:20-31` proves
the app knows whether it is `mock` or `live` and refuses to start on anything else — so
the mechanism exists. It is used in exactly one place. In a `live` build the sign-in
screen still lists four clickable roles, `continueAs` still writes
`x-mock-role: admin`, and `api.ts:70-80` still attaches it to every request. Whether
that is exploitable depends entirely on a server that has not been written yet. That is
the wrong place for the dependency: `hard.spec` #2 and INVARIANT 44 both exist because
"a forged role must be refused", and a client that ships the forgery ready-made makes
that server-side test the only thing standing between a reviewer and the admin world.

The demo switcher is **labelled** dev-only (headers in `demoAccounts.ts:6-8`,
`session.ts:6-9`, and "demo — continue as" on screen at `SigninScreen.tsx:88`), which is
honest. It is not **gated**, which is what matters.

**Invariants:** INVARIANT 45; INVARIANT 44 by proximity.
**Fix, three parts, all cheap:**
1. `import.meta.env["VITE_API_MODE"] !== "mock"` → `DEV_DEFAULT` is `null`, `DEMO_ACCOUNTS`
   is `[]`, and `x-mock-role`/`x-mock-actor` are not attached. Rollup drops the branch.
2. Render the demo block behind the same condition, so a live build shows the
   credentials form and the refusal alone.
3. Keep the deep-link argument by moving it where it belongs — the mock-mode default
   stays, and the invariant is preserved in the build that ships.

### S2 · SHOULD-FIX — sign-in navigates every account to `/`, a door the typist does not hold

`SigninScreen.tsx:53` — `void navigate({ to: "/" })`, unconditionally.

```
PROBE: sign-in sends a typist to /, a door the typist does not hold ✓
  canAccess("typist", "/") === false
```

`authz.ts:62` gives `screen.home.enter` to `SIGHTED`, which excludes `typist` — and
`demoAccounts.ts:50-57` ships a typist row (T. Abara) whose own header explains that
"typists never see the hub — straight to the capture seat (§0.7)". Signing in as the
typist lands on the one screen the contract says the typist must not have. Today it is
an `Unbuilt` placeholder, and A1 means nothing stops it rendering. The rail will
correctly draw only the capture-seat doors, so the reader gets a screen their own
navigation does not list.

`rootRoute.tsx:44` argues "signing in lands you where you were going", and that is the
right instinct — the code does not do it. **Fix:** land on the first door in the
fetched projection, or on the returned-to URL. Not on a hardcoded `/`.

---

## 8. StatePill

**Structurally impossible, not merely not done — and this is the strongest component in
the scope.**

`StatePill.tsx:23-26` takes `state: FieldState` and `className`. There is no `field`
prop, so `engine_confidence_raw` is never in lexical scope and the demotion the rule
keeps being broken by cannot be written without first changing the signature. The
header at `:11-21` states exactly this and the code delivers it. `PILL` at `:36-63` is a
`Record<FieldState, …>` over the frozen enum, so a seventh member fails to compile.
`data-field-state` renders the member verbatim (`:69`).

`StatePill.stories.tsx:98-106` makes the negative case explicit: there is no
"confirmed but low confidence" story **because the args for one cannot be written**.
`EveryState` (`:136-150`) renders all six and asserts six distinct labels; it passes.
`confirmed` and `corrected` deliberately share mark and ink and are told apart by
sentence, which is why the assertion is on text.

**No finding.** This is the pattern the rest of the codebase should be measured
against — compare `NoValueChip`'s open `sentence` override (R2), which is the same class
of component with the door left open.

---

## 9. PaperSheet / ClerkStamp

CSS-only, as design §Assets requires. Verified in the **built** stylesheet rather than
the source: `tp-paper-grain`, `tp-paper-tilt`, `tp-clerk-stamp`, `tp-scan-filter`,
`tp-citation-box` and `tp-na-hatch` each emit exactly once into
`dist/assets/app-*.css`. No `<img>`, no SVG, no `url()` — the grain is two crossed
repeating gradients (`entities.css:29-34`) and the stamp is a rotated
`border-2 border-double` (`ClerkStamp.tsx:31`). Rule 8's prohibition is honoured: no
grey placeholder bars anywhere in `evidence/`.

`ClerkStamp.tsx:32-38` refusing `opacity-80` is correct and the recorded number checks
out — I measured `#7c6a55` on `#f7f5ef` at **4.76:1**, matching the comment.

### C1 · SHOULD-FIX — the stamp drops below 4.5:1 on a degraded sheet, and no story shows that combination

The 4.76:1 figure is the stamp on **clean** stock. `PaperSheet.tsx:46` puts a degraded
sheet on `bg-scan` (`#f2efe6`) **and** applies `tp-scan-filter` —
`grayscale(.35) contrast(.96) brightness(1.01)` (`tokens.css:368`) — to the whole
subtree, stamp included. Computing the filter's colour matrix:

```
stamp on paper   (clean, unfiltered)   4.76   ✓
stamp on scan    (unfiltered)          4.51   ✓ (barely)
stamp on scan    (filtered, as shipped) 4.32  ✗ AA fail
degraded body ink on filtered scan      4.34  ✗ AA fail (token claims 4.55)
```

Two things follow. First, `--color-scan-ink-degraded`'s comment claims "4.55:1 on scan,
under `--filter-scan-degraded`" — but `tokens.css:366-367` records that
`--filter-scan-degraded` was **deleted** and one filter ships. The measured value under
the filter that actually ships is 4.34. The token comment documents a filter that no
longer exists.

Second, and this is why the a11y gate is green: **no story puts a stamp on a degraded
sheet.** `PaperSheet.stories.tsx:34` is degraded with no stamp; `:36` and `:48` have
stamps on clean stock. The one combination that fails is the one nobody rendered — and
per CONTEXT §5 (median text-layer coverage well under 25%) it is the *common* case in
production.

**Fix:** add a `DegradedScanWithClerkStamp` story so the gate grades it, then either
darken `--color-paper-stamp` and `--color-scan-ink-degraded` until they clear 4.5:1
*under the filter*, or exempt the stamp from the filter. Correct the
`--color-scan-ink-degraded` comment either way — a token annotated with a number from a
deleted filter is worse than an unannotated one.

### C2 · NIT — `DecisionCard`'s title-size hack hits whatever child comes first

`DecisionCard.tsx:75` — `className="[&>span:first-child]:text-title"` on `FieldValueView`.
Verified in the built CSS: the rule emits at byte 29067 as
`…>span:first-child{font-size:var(--text-title)}`, well after `.text-body` at 18778 and
at higher specificity, so it wins. For `kind: "cited"` the first child is the value —
intended. For every NA render, `FieldValueView` returns `NoValueChip` directly
(`:78,86,89,92,102`), whose first child is the bordered chip box — so an absence under
decision draws its whole chip at 28px while the PRESENT_UNREADABLE citation beneath
stays 11px. `DecidingAnAbsence` (`DecisionCard.stories.tsx:126`) renders exactly this.
A positional selector reaching through a component boundary breaks whenever the callee's
first child changes. Give `FieldValueView` an explicit `emphasis` prop, as `OrderRef`
already does.

---

## 10. Storybook

**The side-by-side story exists and asserts the right thing.**
`FieldValueView.stories.tsx:83-110` (`AllFiveRenders`) maps `NaReason.options` plus
`not-extracted` onto one canvas and its `play` asserts five nodes, five distinct
`data-field-render` values, five distinct text contents, and that none matches
`/^[-—–\s•◆]*$/` — a grey dash in place of any one of them fails there. It passes in
the run. `AbsencesAndTheDefect` (`:113`) adds cited and uncited for the full six.
Driven from `NaReason.options`, so a fifth reason appears on the canvas the day it is
added. This is the thing that makes the rule checkable by a person, and it is done.

Its limits, since the whole point is that a human verifies distinctness here:
- it asserts **text and attribute**, never rendered colour, so R1's shared-hex problem
  is invisible to it;
- it renders on `onPanel`, which is right, but the five NA chips never appear inside a
  `DecisionCard` where C2's 28px override changes them;
- three headers cite files that **do not exist**: `NoValueChip.stories.tsx`
  (`NoValueChip.tsx:18` and `noValueStates.test.ts:140` both point at it),
  `noValue.test.ts` (`NoValueChip.tsx:18`), and `naReasonMapping.test.ts`
  (`tokens.css:225`). Verified absent by `find`. `noValueStates.test.ts` does carry the
  claimed assertions, so the rules are covered — but REVIEW-01 B3 was precisely a header
  citing a test as proof of something the code did not do, and three stale citations in
  the same taxonomy is that pattern recurring. **NIT, worth a pass over every header in
  the scope.**

Coverage gaps: `StageDots`, `EscalationCard`, `NaStateGrid`, `PaperSheet` and
`ClerkStamp` have stories but **no `play` assertions** beyond presence checks;
`DecisionQuestion` has no story of its own (covered indirectly through `DecisionCard`);
`NoValueChip` has none at all despite being the shared chip for five renders and two
callers.

---

## If this shipped tomorrow: how a wrong value reaches a delivered title report

The likeliest path is **P1 → adoption**, and it needs no bug in the server.

1. Two engines disagree on a vested-owner middle initial — the canonical case, named at
   `entities.ts:130` and used as the fixture in `ReadingPair.stories.tsx:37`.
2. `ReadingPair` draws both readings in `font-mono text-body text-ink-primary`
   (`readingDiff.tsx:46`) — pixel-identical to how `FieldValueView.tsx:45` draws a value
   that carries a full citation. Beneath each sits `p.12` (`ReadingPair.tsx:73`), which
   reads as provenance and is not: no `source_doc_id`, and `provenance.ts:104-110` is
   explicit that half a citation is none.
3. The reviewer, under time pressure, sees two equally authoritative-looking values,
   each apparently cited, and clicks "Adopt this reading" (`:82-89`).
4. The adopted string enters the correction editor and is submitted as a **human
   correction** — `state: "corrected"`, which `StatePill.tsx:57` draws with full settled
   weight and which no downstream gate questions, because a human ruled it.

The provenance envelope was never checked at any step. The lint pair that exists
precisely to stop this (`no-restricted-syntax` + `check-rules.mjs`'s `raw-field-value`)
guards `Field.value` and not `FieldReading.value`, so `check-rules` reports clean while
the uncited path stays wide open. A wrong middle initial on a vested owner is
`DecisionCard.stories.tsx:82`'s own example of what "voids the policy and is not caught
downstream".

**Two shorter paths deserve naming beside it.** D1 is the more alarming failure mode
even if it is rarer: a field arriving with both a value and an `na_reason` renders as a
plain absence, the value never reaching the screen at all — a wrong value by omission,
and the one class of error a reviewer cannot catch by looking, because there is nothing
to look at. And D2 puts a reviewer in front of a meter reading twelve of eighteen dots
lit when two of three decisions are settled; a reviewer who trusts the dots over the
label stops early, and the decisions never made are shipped as decisions never needed.

---

## Findings

| # | Severity | Location | Rule |
|---|---|---|---|
| D1 | **BLOCKER** | `shared/provenance.ts:82-87` | value discarded when `na_reason` set — INV 8, AGENTS hard rule 3 |
| D2 | **BLOCKER** | `entities/order/ProgressMeter.tsx:36,45` | proportion computed in browser; duplicate component — INV 5, rule 11 |
| P1 | **BLOCKER** | `entities/field/ReadingPair.tsx:101-112` | uncited value at cited weight, adoptable — INV 8, principle 6 |
| A1 | **BLOCKER** | `app/routeTree.tsx` (no `beforeLoad`) | no route-entry gate — INV 41 |
| S1 | **BLOCKER** | `app/session/signedIn.ts:73-80`; `shared/api.ts:75` | boots as admin; mock role unguarded in live builds — INV 45, 44 |
| D3 | SHOULD-FIX | `entities/rule/EscalationCard.tsx:40,73` | settled derived from `rule_id` alone — INV 36, 5 |
| R1 | SHOULD-FIX | `noValueStates.ts:55-67`; `tokens.css:241-244` | NOT_FOUND/NOT_STATED share ink, border and mark — INV 7 |
| A2 | SHOULD-FIX | `app/rootRoute.tsx:86`; `SideRail.tsx:90-93` | `/blind` prefix swallows `/blind-status` — INV 46, 42/43 |
| S2 | SHOULD-FIX | `features/signin/SigninScreen.tsx:53` | typist landed on `/` — `authz.ts:62` |
| K1 | SHOULD-FIX | `app/keyboard/KeyMap.tsx:47` | advertises an order switcher the palette refuses — INV 22 |
| C1 | SHOULD-FIX | `ClerkStamp.tsx`; `tokens.css:264,368` | 4.32:1 on a filtered degraded sheet; no story covers it |
| R2 | NIT | `entities/field/NoValueChip.tsx:45` | open `sentence` override |
| P2 | NIT | `entities/field/readingDiff.tsx:46` | reuses PRESENT_UNREADABLE tokens for "differs" |
| A3 | NIT | `app/chrome/Unbuilt.tsx:320` | `window.location` instead of router state |
| K2 | NIT | `app/keyboard/KeyMap.tsx:49` | `?` documented as a toggle, cannot close |
| C2 | NIT | `entities/decision/DecisionCard.tsx:75` | positional child selector across a component boundary |
| — | NIT | `NoValueChip.tsx:18`, `noValueStates.test.ts:140`, `tokens.css:225` | three headers cite files that do not exist |

Nothing in this review was fixed. All six probe suites were deleted after running;
`git status` shows no changes under `entities/`, `app/` or `features/signin/`.

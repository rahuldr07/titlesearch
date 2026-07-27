# Test harvest — apps/web, pre-rebuild

**Pass 0 deliverable. Nothing has been deleted. Nothing has been modified.**
Date: 2026-07-26 · Suite state: 116 Playwright e2e + 22 Vitest = **138 tests**

**Pre-deletion baseline, measured 2026-07-26: 138/138 green.**
`pnpm --filter web test` → 22 passed (2 files, 451ms).
`pnpm --filter web test:e2e` → 116 passed (1.0m, production build via `vite preview`).

This matters for Pass 3. Every INVARIANT spec migrated to `e2e/invariants/` was passing at the moment it was skipped, so a spec that fails after being un-skipped indicates the new UI does not satisfy the rule — never a pre-existing failure being discovered late. There is no ambiguity to litigate later.

---

## 1. Headline finding — the brief's premise is inverted

The rebuild brief states: *"Most of them assert on DOM structure that is about to stop existing. Some of them assert on product rules."*

**That is backwards.** Measured against the actual files:

| Classification | e2e | Vitest | Total | Share |
|---|---:|---:|---:|---:|
| **INVARIANT** — a product rule; survives the rebuild | 88 | 22 | **110** | 80% |
| **ORPHAN RULE** — a rule written down nowhere else | 16 | 0 | **16** | 12% |
| **AMBIGUOUS** — blocked on a decision (see §4.1) | 6 | 0 | **6** | 4% |
| **STRUCTURAL** — dies with the old UI | 5 | 0 | **5** | 4% |
| **CONFLICT** — asserts behavior the rebuild forbids | 1 | 0 | **1** | <1% |

**Five of 116 e2e specs are purely structural.** This suite is not a DOM snapshot with some rules mixed in; it is a rulebook that happens to be executable. Deleting it on the assumption stated in the brief would have destroyed roughly 110 product rules, 16 of which exist in no other artifact in this repository.

Two structural reasons for this:

- The suite was authored *from* `docs/prompts/frontend-master-prompt.md` §0.1–§0.9, a document that is almost entirely prohibitions. Its §0.5 says outright: *"Refusals are product requirements (each becomes a Playwright test)."* The tests are the intended durable form of those refusals.
- Most assertions are **negative** — `not.toContain("throughput")`, `toHaveCount(0)`, `toBeDisabled()`. A negative assertion about a forbidden concept is selector-independent almost by construction. It survives any redesign because it asserts that something does *not* exist.

**All 22 Vitest tests are INVARIANT and require zero rewriting.** 21 of them test `packages/contract/src/authz.ts` — a pure function module the brief explicitly keeps. They are not UI tests at all. The 22nd (`vocabulary.test.ts`) is a static build gate that walks `apps/web/src/` for throughput vocabulary; it survives as long as the source root keeps its name.

---

## 2. Method

### What counts as "documented"

The brief defines ORPHAN RULE as a rule not found in `docs/CONTEXT.md`, `docs/PRD.md`, or `docs/frontend/PLAN.md`.

**`docs/frontend/PLAN.md` does not exist.** The specs themselves cite a different document throughout — `§0.2`, `§0.4`, `§4.13` and so on refer to **`docs/prompts/frontend-master-prompt.md`**, which is the frontend rulebook this suite was built against. I substituted it for the named-but-absent PLAN.md. Without doing so, roughly 40 specs would have been mislabelled ORPHAN when their rule is in fact written down.

A rule is therefore ORPHAN only if it appears in **none** of:
`docs/CONTEXT.md` · `docs/PRD.md` · `docs/HANDOFF.md` · `docs/prompts/frontend-master-prompt.md` · `packages/contract/src/*.ts` doc comments.

### Classification rule applied

- **INVARIANT** — asserts what the system must or must not do. The selector may be rewritten; the assertion may not be weakened.
- **STRUCTURAL** — asserts the old UI's specific layout, DOM, or component mechanics, with no rule behind it.
- **ORPHAN RULE** — an INVARIANT whose rule I could not locate in any document.
- **AMBIGUOUS** — genuinely undecidable between INVARIANT and STRUCTURAL without an owner decision. The brief instructs me to stop rather than guess on these.
- **CONFLICT** — asserts behavior the rebuild's hard constraints forbid. Must not be migrated.

A spec gets exactly one primary label. Where a spec's *primary* rule is documented but it carries an *additional* undocumented refinement, the spec is labelled INVARIANT and the refinement is written out separately in §5. That happens 8 times; the refinements are the point of this exercise and folding them into a label would lose them.

### The load-bearing list

The brief names eight rules that are INVARIANT wherever they appear. All eight are present in this suite. Coverage:

| Load-bearing rule | Covered by |
|---|---|
| Judgments never auto-confirm | `reconciliation.spec` #5 (≥40 gate), `blind.spec` #5 (TYPE gate) — **see §4.4, this is thinner than expected** |
| No approve-all or bulk-confirm exists | `review.spec` #8, `leaderboard.spec` #4, `ux.spec` #4 (O9) |
| A value without provenance is an error, not a blank | `review.spec` #2 |
| NA states are never collapsed | `review.spec` #1, `server-owns-state.spec` #1, `hard.spec` #6 |
| Review routing is never computed client-side | `server-owns-state.spec` #1–2 |
| Actor identity is never read from a request body | `golden.spec` #3, `hard.spec` #2 |
| PENDING rules never affect output | `account.spec` #1–2, `escalations.spec` #3, `reconciliation.spec` #3 |
| No throughput counters, rankings, accuracy headlines | `queue.spec` #2, `dashboard.spec` #2, `bench.spec` #1, `home.spec` #5, `blind.spec` #2, `vocabulary.test` |

---

## 3. Per-file inventory

### `e2e/server-owns-state.spec.ts` — 2 tests · **the most load-bearing file in the suite**

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | a null pending field renders 'not yet extracted' — never Not Available, never queued | INVARIANT | A field with `value: null` and `na_reason: null` means "not yet extracted" — a third render, distinct from both NA states. It must not be labelled Not Available and must not be added to the review queue. Nothing is ever derived from `value === null`. |
| 2 | the state pill renders server state verbatim — confidence never promotes or demotes | INVARIANT | `engine_confidence_raw: 0.99` on a `needs_review` field leaves it queued; `0.01` on an `auto_confirmed` field leaves it confirmed. The UI renders `state` verbatim and never computes it from confidence or any threshold. |

This file is the executable form of the brief's constraints 4 and 5, and of CONTEXT §7 *"Rules the UI must not re-implement"*. It uses a hand-crafted payload rather than MSW fixtures specifically so the rule is proven against adversarial data. **Rebuild this file first.**

### `e2e/review.spec.ts` — 10 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | both NA states + pending render distinctly | INVARIANT | `NOT_PRESENT` renders quiet and prompts no action; `PRESENT_UNREADABLE` is surfaced for attention; pending is a third render. Three visually distinct outcomes, never collapsed. |
| 2 | a confirmed value without provenance renders visibly flagged | INVARIANT | A value that arrives with null `source_*` members renders visibly flagged (`NO PROVENANCE`), never silently normal. Principle 6 — the failure shape caught six times in prototyping. |
| 3 | A≠B disagreement leads: chip on the row, both readings in the panel | INVARIANT | When engines disagree the row is marked and both engine readings render side by side with their engine ids. Disagreement always surfaces both values. |
| 4 | correction without a reason never submits | INVARIANT | A correction requires a non-empty reason. Refusal, not a warning. |
| 5 | correction with value + reason submits and renders the server's state | INVARIANT | After a correction the row renders the state the **server** returned. Not an optimistic local state. |
| 6 | escalation without a question never submits | INVARIANT | An escalation requires a non-empty question. |
| 7 | escalation with a question records; confirm via ⏎ records | INVARIANT | Escalation records and selection advances to the next queued field. (⏎ half depends on §4.1.) |
| 8 | no approve-all, no throughput, no timers | INVARIANT | The rendered body contains no "approve", "throughput", "per hour", or "timer". Asserted against full page text, so it holds regardless of markup. |
| 9 | J/K walk the queued fields only | AMBIGUOUS | Rule behind it (**O20**): field navigation visits only server-queued fields — a reviewer cannot walk into auto-confirmed fields. Keyboard expression depends on §4.1. |
| 10 | reader B line pins on the page from its coordinates | INVARIANT | Clicking an engine reading that declares line coordinates pins the corresponding line on the page image. Click-to-source. |

### `e2e/review-conflict.spec.ts` — 3 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | confirm 409 (different value) surfaces the server's message and never advances | INVARIANT | A 409 is an answer, not a dead no-op. The server's message renders verbatim, the selection does **not** advance, and the row repaints from server truth — no optimistic mutation survives the refusal. |
| 2 | confirm 409 (terminal state) is answered, not a dead no-op | INVARIANT | Same, for a terminal-state conflict. |
| 3 | bug-5 mock semantics hold: same value 200/200, different value 409 | INVARIANT | Confirm is idempotent: resubmitting the same value returns 200; a conflicting value returns 409. Bug-5 from CONTEXT §19. |

Directly enforces the brief's constraint 10 (no optimistic updates on field decisions).

### `e2e/ux.spec.ts` — 7 tests · **the densest orphan file**

Header comment dates these to a *"2026-07-19 UX review"*. HANDOFF §8 lists "5 usability sessions on built screens w/ real reviewers" as a P0 item. These specs are the only surviving record of what those sessions produced.

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | a both-found disagreement never claims emptiness — draft leads, labeled | **ORPHAN (O8)** | When both engines returned values but disagree, the UI must not render "Not Available" or "extraction returned nothing at all". It shows the draft *labelled as a draft* and states "engines disagree — nothing settled". |
| 2 | differing characters between readings are highlighted | **ORPHAN (O12)** | Character-level diff between the two engine readings. |
| 3 | a reading can be adopted into the correction editor without retyping | **ORPHAN (O11)** | The correction editor prefills exactly from the chosen reading. Retyping is itself an error channel. |
| 4 | ⏎ never accepts a blank — missing fields demand a click | **ORPHAN (O9)** | The keyboard fast path confirms values; accepting an NA requires an explicit click. Deliberate asymmetric friction. |
| 5 | refused submits SAY so — escalate, correct, pass all nudge | **ORPHAN (O10)** | Every refusal names what is missing. |
| 6 | the queue's pass refusal nudges too | **ORPHAN (O10)** | Same rule on the Queue screen. |
| 7 | every screen's title is the mouse path home | STRUCTURAL | TopBar title is the home affordance. Old-UI navigation mechanic. |

### `e2e/errors.spec.ts` — 7 tests · **one orphan family**

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | an unknown route renders the not-found card, never a blank page | **ORPHAN (O6)** | Unknown address → named card, never blank. |
| 2 | the escalation inbox says unavailable when the list 500s | **ORPHAN (O6)** | A failed list query renders a named per-screen unavailable state. |
| 3 | delivery says unavailable when deliveries 500s | **ORPHAN (O6)** | Same, Delivery. |
| 4 | the order spine survives a timeline failure | **ORPHAN (O6)** | **Partial failure degrades locally.** A timeline 500 leaves the rest of Review working and the rail says "timeline unavailable". |
| 5 | reconciliation with an unknown order shows the empty state, not a working grid | **ORPHAN (O6)** | Absent data never renders as a working-looking grid. |
| 6 | seed correction with a stale fieldId names the stale link | **ORPHAN (O6)** | A stale deep link names the stale identifier and is distinct from no-context-at-all. |
| 7 | a delivery retry failure surfaces the server's message | INVARIANT | A failed mutation renders the server's own message verbatim. The UI never invents an error string. |

### `e2e/blind.spec.ts` — 6 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | the page is structurally blind — no engine, model, or pipeline strings | INVARIANT | Page source contains none of: gemini, llmwhisperer, paddle, tesseract, engine, model output, auto_confirm, needs_review, confidence_raw, reader a/b. Seat label only, never a name. |
| 2 | no clock, no rate, no score | INVARIANT | No timer, no per-hour figure on the capture seat. |
| 3 | the three-part contract gates Record | INVARIANT | Record is unavailable until value-or-NA **and** source citation **and** confidence are all present. |
| 4 | unclear with a source is a legitimate, recordable answer | INVARIANT | `unclear` + a source is recordable. The confident guess is the poison, not the admission of doubt. |
| 5 | judgment TYPE takes a second pass and gates its siblings | INVARIANT (+**O18**) | TYPE requires a second-pass confirmation before Record. Refinement: sibling judgment fields do not open until TYPE is recorded. |
| 6 | submit renders only the local confirmation — nothing comes back | INVARIANT | Nothing from the response renders — not even entry ids. |

### `e2e/blind-blindness.spec.ts` — 2 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | the typist screen issues zero /api GETs — the only network call is the submit POST | INVARIANT | **Blindness proven at the network layer, not by string absence.** The capture seat makes exactly one API call in its lifetime: the submit POST. Nothing can leak because nothing is fetched. |
| 2 | global keys are dead on /blind/*: no map, no chords | INVARIANT | The global keyboard layer is inert on the capture seat — a typist cannot chord out to another world even when the session says admin. |

Test 1 is the strongest expression of principle 4 (*"blindness is structural"*) anywhere in the repository, and the technique — count calls in-page because the MSW service worker is invisible to Playwright routing — is non-obvious. Preserve the technique with the rule; `e2e/helpers/net.ts` is what makes it possible.

### `e2e/hard.spec.ts` — 6 tests · adversarial

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | the typist role is refused at EVERY mutation except the blind submit | INVARIANT | 14 mutation endpoints return 403 for a typist. The one open door returns 422 — the role gate passes and only the schema refuses. |
| 2 | a forged role header is refused — mutations 403, the projection 400 | INVARIANT (+**O14**) | An unknown identity fails closed. Role names are exact: `Admin` is garbage, and garbage never yields the admin world. |
| 3 | the blind submit response carries NOTHING beyond the ack | INVARIANT | Response keys are exactly `["accepted","entry_ids"]`, asserted key-exact. Any extra key would be a channel into blindness. |
| 4 | resolving the same escalation twice is refused the second time | INVARIANT | Replay of a resolution returns 409. A resolution happens once. |
| 5 | chord keys typed inside an input never navigate | INVARIANT (+**O15**) | `g`,`d`,`?` typed into an input are text. Protects an in-progress correction from a stray keystroke. |
| 6 | the complaint capture list renders pending as 'not yet extracted' | INVARIANT | The NA/pending distinction holds outside Review too. |

### `e2e/golden.spec.ts` — 6 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | capture is blind and structured; don't-know ≠ not-stated | **ORPHAN (O2, O3)** | Two distinct sentinels — `__DONT_KNOW__` (the capturer could not determine it) vs `__NOT_STATED__` (the document is silent) — plus: capture never shows the pipeline's draft. |
| 2 | no timers anywhere on golden capture | INVARIANT | No timer, no elapsed clock. "This is reading, not queue-clearing." |
| 3 | seed correction is refused without citation + reason; signer is the session | INVARIANT | **The signer is derived from the authenticated session and is never a client field.** Citation + reason are the whole client-side gate. |
| 4 | a correction upgrades the tag to ruled and lands in the permanent log | INVARIANT | Correction → tag becomes `ruled`; the before→after transition is written to a permanent signed log. |
| 5 | confirm-seed is refused without a reason, then affirms as-is | INVARIANT | Affirming a seed value unchanged is itself a ruling and requires a reason. Value stands, tag → `ruled`. |
| 6 | demote-to-suspect flags an ambiguous seed | INVARIANT | Demotion requires a reason. Value stands, tag → `suspect`. Suspect demotion is a diagnosis, not a deletion. |

Test 3 is one of the brief's eight load-bearing rules. **It also contradicts `frontend-master-prompt.md` §0.5**, which lists `signed_by` as a client-supplied field. The test is correct and the document is stale — see §6.

### `e2e/authz.spec.ts` — 6 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | the mock server refuses a mutation the role doesn't hold — before validation | INVARIANT (+**O14**) | Reviewer → 403 on `routing.flip` with an invalid body; engineer → 422. Authorization precedes validation. |
| 2 | a senior may resolve; an ops role may not — same endpoint, same table | INVARIANT | One permission table gates both UI affordance and server mutation, so they cannot drift. |
| 3 | the wire serves per-role projections — a typist's payload never mentions other worlds | INVARIANT | The typist's `/api/me/permissions` payload contains exactly 3 actions and the raw text does not contain "escalation", "dashboard", "golden", "routing", "queue", or `"roles"`. Other roles' capabilities are unrepresented, not hidden. |
| 4 | the Me tab renders the served world and re-fetches on role switch | INVARIANT | The UI's world is the server's projection, re-fetched on identity change — never computed locally. |
| 5 | the engineer gate's confirm affordance exists only for its holders | INVARIANT (+**O13**) | A non-holder sees the PENDING chip but **no** confirm button. The affordance is absent, not disabled. |
| 6 | ops arriving at review via a complaint deep link can look, not touch | INVARIANT | Read access via deep link does not grant write actions. Confirm/correct/escalate/pass are absent for ops; the bug channel stays open. |

### `e2e/roles.spec.ts` — 4 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | typist world: no doors but capture and account | INVARIANT | Typist reaches only `/blind` and `/account`. Other doors are absent from the map and chords to them are refused. |
| 2 | senior world: escalations open; queue and readout do not exist | INVARIANT | Senior world boundary. |
| 3 | ops world: readout opens; the bench does not exist | INVARIANT | Ops world boundary. |
| 4 | engineer world: bench opens; the readout does not exist | INVARIANT | Engineer world boundary. |

Overlaps `authz.test.ts` world-parity, which is the more durable form (pure function, no DOM). Keep both: the unit test proves the table, these prove the app honors it.

### `e2e/account.spec.ts` — 4 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | rulebook shows origin/status/jurisdiction badges; PENDING is inert | INVARIANT | A PENDING rule renders "CANNOT AFFECT THE PIPELINE" and carries origin + jurisdiction scope badges. |
| 2 | the engineer gate confirms a pending rule into the live book | INVARIANT | Only the engineer gate moves PENDING → LIVE, and the confirmer is recorded. |
| 3 | audit is a read-only append-only view | INVARIANT | Zero inputs or textareas on the audit view. No write affordance exists. |
| 4 | a reviewer never sees the dashboard | INVARIANT | The Readout link is absent (not dimmed) and the chord refuses; body contains no "catch rate" or "backlog". |

### `e2e/escalations.spec.ts` — 4 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | resolve stays held without a ruling AND a rule | INVARIANT | Resolution is refused without both. A ruling alone is not enough — the rule *is* the resolution. |
| 2 | citing an existing rule resolves the cluster | INVARIANT | Citing a live rule is a valid resolution path. |
| 3 | a drafted rule lands PENDING and renders visibly inert | INVARIANT | A drafted rule cannot affect the pipeline until an engineer confirms it. |
| 4 | no priority, category, or assignee affordances exist | **ORPHAN (O4)** | Exactly one combobox on the screen — the rule citation. No triage surface. |

### `e2e/reconciliation.spec.ts` — 5 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | a ruling without a citation is refused | INVARIANT | "A ruling with no source is an opinion." |
| 2 | neither field-only nor general is pre-selected; the draft starts empty | INVARIANT | A general rule may be offered, never pre-selected; the draft box is never pre-populated. |
| 3 | a general-rule ruling files the draft as PENDING | INVARIANT | Drafts land PENDING. |
| 4 | a third value needs its why; the model appears nowhere | INVARIANT (+**O19**) | The senior may rule a third value neither typist gave, which requires its own "why" **in addition** to the citation. Reconciliation is model-blind. |
| 5 | status shows the judgment ≥40 gate and no typist pace data | INVARIANT | Judgment coverage renders against the ≥40 target, named as the only remaining gate to judgment automation. No typist pace data; coverage is order-level only. |

### `e2e/queue.spec.ts` — 5 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | renders the server's next order verbatim — exactly one order, no list | INVARIANT | Exactly one order card. The second queued order appears nowhere. No cherry-picking. |
| 2 | no pace indicators or throughput language renders | INVARIANT (+**O5**) | No "min/order", "per hour", "throughput", "rank" — and no time *estimates*. |
| 3 | pass without a reason is refused; esc keeps the order | **ORPHAN (O1)** | A pass requires a stated reason. |
| 4 | pass with a reason records and advances to the next order | INVARIANT (+**O1**) | A reasoned pass records and the server serves the next order. |
| 5 | enter starts review on the served order | AMBIGUOUS | Keyboard entry to review — depends on §4.1. |

### `e2e/ingest.spec.ts` — 3 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | an incomplete upload is refused with the server's missing fields, verbatim | INVARIANT | The server names every missing field and the UI renders that list verbatim — it does not compose its own message. |
| 2 | acceptance is explicit — upload alone never queues the order | INVARIANT | Upload and accept are two steps. Acceptance is a signature, never automatic. |
| 3 | a byte-identical re-upload surfaces the server's duplicate notice | INVARIANT | sha256 duplicate detection surfaces to the operator. |

### `e2e/dashboard.spec.ts` — 4 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | catch rate is the headline, with its denominator | INVARIANT (+**O16**) | Catch rate is *the* headline metric and never renders without its denominator. |
| 2 | no aggregate accuracy, no probe details, no reviewer names | INVARIANT | No accuracy figure, no individual probe rows, no per-reviewer anything, no rank. |
| 3 | a backlog row opens its server-authored drill-down | INVARIANT | Drill-down content is authored by the server; the UI does not compute it. |
| 4 | derived-source corrections read as upstream bugs | INVARIANT (+**O17**) | Repeated corrections traceable to one derived function surface as a single upstream bug — "one broken function, not two defects" — not as N reviewer corrections. |

### `e2e/delivery-complaints.spec.ts` — 5 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | a failed delivery reads as transit, offers retry, and retry delivers | INVARIANT | A failed delivery is a transit state — retryable, styled attend, explicitly "not a quality problem". Never styled as a defect. |
| 2 | both report versions list as the defect record | INVARIANT | v1 and v2 both remain listed. The version history *is* the defect record. |
| 3 | complaints group by how it got through; auto-confirmed is distinct | INVARIANT | The `auto_confirmed` group is visually distinct and labelled "no human saw it" — it indicts the threshold, not a reviewer. No per-reviewer complaint counts. |
| 4 | per-field capture records into its group | INVARIANT | Complaints are captured per field, not per order. |
| 5 | resolving a complaint is refused without a rule; a draft rule files it | INVARIANT | A fix alone is not a resolution — a rule is required. Principle 3. |

### `e2e/bench.spec.ts` — 3 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | results matrix renders section × tag with no aggregate headline | INVARIANT | Section × tag matrix; no whole-bench percentage anywhere. "No single number is…" |
| 2 | a ruled fail is always actionable; a suspect fail doubts the seed | INVARIANT | Tag class governs interpretation: a `ruled` fail is always the model's fault; a `suspect` fail may be the seed's. The seed is typist-anchored, not truth. |
| 3 | bench has no auto-tune affordance and prompts come from the rulebook | INVARIANT | No button matching "tune" or "optimize". The RuleContext pane shows rule ids — prompts are generated from the rulebook, not hand-edited. |

### `e2e/leaderboard.spec.ts` — 4 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | a cell below golden coverage reads NO TRUTH YET, not zero | INVARIANT | Thin coverage renders as literal `NO TRUTH YET`, never as a number. Absence of truth is not a score of zero. |
| 2 | undeclared capability renders — (never a faked score) | INVARIANT | An engine lacking a capability renders an em-dash. Capabilities are declared, not faked. |
| 3 | a seat flip is refused without evidence, then logged with who/when | INVARIANT | A seat change demands an evidence URL and records approver + timestamp. Humans approve promotions. |
| 4 | no aggregate headline, no auto-promotion affordance | INVARIANT | "THERE IS NO BEST ENGINE". No button matching "auto" or "promote all". |

### `e2e/navigation.spec.ts` — 7 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | g-sequences jump between screens; ? shows the map | AMBIGUOUS | Keyboard navigation layer — see §4.1. |
| 2 | a g-sequence's second key never leaks into screen hotkeys | AMBIGUOUS | Anti-misfire: a chord's second key must not also fire a screen action. INVARIANT *if* keyboard-first survives. |
| 3 | the ? overlay swallows screen keys while open | AMBIGUOUS | Modal focus discipline. |
| 4 | ?field= deep links land on the exact field in context | INVARIANT | Deep links are first-class; the selected field lives in the URL. Aligns with the rebuild's "selection → URL search params". |
| 5 | seed correction without context shows the no-menu-entry state | **ORPHAN (O7)** | Seed correction has no menu entry and no picker — one field, one document, one record. |
| 6 | bench results carries context into seed correction | INVARIANT | Context travels through links; the destination never asks the user to re-pick. |
| 7 | the order spine travels with the order on Review | INVARIANT | Order-level state (queue status, open escalations, delivery version) accompanies field-level review. |

### `e2e/sidebar.spec.ts` — 8 tests · **contains the one CONFLICT**

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | the rail renders the role's doors and navigates | STRUCTURAL | Rail mechanics + active-door marking. |
| 2 | live attention dots ride the doors — red for a complaint, amber for a gap | INVARIANT | The rail carries **dots, never counts**. Asserted negatively against `\d+ unresolved` / `\d+ open`. |
| 3 | doors outside the role's world are ABSENT, not dimmed | INVARIANT (+**O13**) | Role-locked doors do not render. |
| 4 | the capture seat has no rail — structural blindness stays whole | INVARIANT | No navigation chrome on `/blind/*`. |
| 5 | doors are grouped by pipeline stage with muted headers | STRUCTURAL | Grouping labels. |
| 6 | [ folds the rail from the keyboard | AMBIGUOUS | Keyboard layer — see §4.1. |
| 7 | [ inside a text field is text, not a fold | INVARIANT (+**O15**) | Typed text never triggers a global action. |
| 8 | collapse is a persisted UI preference | **CONFLICT** | Asserts the collapse state **survives a page reload via localStorage**. The rebuild forbids all localStorage/sessionStorage (constraint 11). See §4.2. |

### `e2e/home.spec.ts` — 5 tests

| # | Test | Class | Rule protected |
|---|---|---|---|
| 1 | / renders the hub with live attention signals | STRUCTURAL | Hub door copy and layout. |
| 2 | the hub's doors are role-locked — absent, never dimmed | INVARIANT (+**O13**) | Role gating at the hub. |
| 3 | g h jumps home from anywhere; ⏎ opens the role's first door | STRUCTURAL | Old-nav keybindings. |
| 4 | typists cannot chord to the hub | INVARIANT | Typist confinement holds against the keyboard layer. |
| 5 | nothing forbidden leaks onto the hub | INVARIANT | No throughput, no per-hour, no accuracy figure, **and no queue-depth count** (`\d+ orders waiting`). |

### `authz.test.ts` (Vitest) — 21 tests · **all INVARIANT, all survive unchanged**

Tests `packages/contract/src/authz.ts`, which the brief keeps. No selectors, no DOM. These do not need migration — they need to keep passing.

| Group | # | Rule protected |
|---|---:|---|
| `canAccess` world parity (one per role) | 6 | Each of the 6 roles holds **exactly** its world's doors — the parity block encodes the shipped worlds and fails if a table edit silently moves a door. |
| door prefixes / `/` is not a wildcard | 1 | `/orders` covers `/orders/x/review`; `/` matches only itself. The old nav map made `/` a wildcard and it nearly leaked. |
| no wildcard roles | 1 | Even admin holds only listed doors. |
| `escalation.resolve` gating | 1 | Senior only, and only while the cluster is unresolved. |
| `rule.confirm` engineer gate | 1 | Engineer only, PENDING only. Not senior, not ops. |
| field actions | 1 | Review roles only; refused on terminal states; never ops/engineer/typist. |
| `blind.submit` | 1 | The typist's only non-screen action, asserted exhaustively. |
| typist projection leak test | 1 | A serialized typist projection does not contain the strings escalation/dashboard/golden/routing/queue/reconciliation/bench. |
| holder redaction | 1 | No `roles` key ever reaches a client. |
| fail-closed: missing `when` key | 1 | A resource missing the gated key is **refused**, never allowed. |
| fail-closed: non-string values | 1 | Numbers, `undefined`, arrays are refused, never coerced. |
| role names exact | 1 | `Reviewer`, `ADMIN`, `""`, `null` are not roles. |
| lookalike paths | 1 | `/queueX`, `/blindfold`, `/orders-fake` are refused. |
| every permission names a holder | 1 | No permission row is unreachable; admin explicit on every row (mock phase). |
| action names unique | 1 | Duplicate actions would make "which rule applied" ambiguous. |
| action names log/URL-safe | 1 | Lowercase dotted words only — safe for logs and URLs (GLBA: no NPI, no ids). |

### `vocabulary.test.ts` (Vitest) — 1 test · INVARIANT

A static build gate walking `apps/web/src/**` for throughput vocabulary: per-hour, orders/hr, fields/min, wpm, keystrokes-as-metric, fastest reviewer, reviewer rank. Skips comments and lines marked `vocab-allow:`. Catches source-authored language in files no e2e ever visits. **Survives the rebuild unchanged** as long as the source root stays `src/`.

---

## 4. Stop-and-ask — four blocking items

The brief instructs me to stop rather than guess on these. All four change what gets deleted, so they should be settled before Pass 1.

### 4.1 Is keyboard-first navigation still a product requirement? (6 specs)

`frontend-master-prompt.md` §3 states *"one-key-per-action is a product requirement"* and the current app implements a full chord layer. The rebuild brief's target architecture lists TanStack Router/Query/Table/Virtual, react-hook-form, and Zustand — and **does not mention `react-hotkeys-hook` or any keyboard layer.**

Affected: `navigation` #1–3, `queue` #5, `review` #9, `sidebar` #6.

- If keyboard-first **survives** → all 6 are INVARIANT and the anti-misfire rules (O15, and `navigation` #2/#3) are load-bearing, because they prevent a stray keystroke destroying an in-progress correction.
- If keyboard-first is **dropped** → all 6 are STRUCTURAL, but **O9 must be re-expressed**, because "⏎ never accepts a blank" is the suite's only keyboard-layer defense against bulk-accepting absences.

I have not assumed either. Note this is a product decision, not a design one — the new design mock cannot settle it.

### 4.2 The localStorage conflict — `sidebar.spec` #8

The rail-collapse preference persists to `localStorage` (`apps/web/src/railStore.ts:13,30`, key `titlepipe.rail.collapsed`) and `sidebar.spec.ts:106` asserts it survives a reload. The rebuild's constraint 11 forbids **all** localStorage and sessionStorage.

The existing code is defensible on its own terms — its header comment says *"a pure UI preference … NEVER session or permission state"*, and it is wrapped in try/catch for private mode. It stores one boolean and no NPI.

But the constraint as written is absolute. My reading: the constraint's purpose is to keep session, draft work, and NPI out of browser storage, and a rail-collapse boolean is none of those. **I am not making that call.** Options:

1. **Enforce literally** — rail collapse becomes in-memory Zustand, resets each load. Spec is dropped as a deliberate, recorded decision.
2. **Narrow the constraint** — "no session, draft, or NPI in browser storage; non-sensitive display preferences allowed." Spec migrates as INVARIANT.

Until this is decided the spec must not be silently migrated *or* silently deleted — both hide a decision.

### 4.3 The NA taxonomy — four competing vocabularies, and the brief mandates a fifth shape

This is the largest inconsistency I found, and it blocks the field primitive that everything else renders through.

| Source | Vocabulary |
|---|---|
| `packages/contract/src/enums.ts` | **2 members** — `NOT_PRESENT`, `PRESENT_UNREADABLE` |
| `docs/CONTEXT.md` §11 | 2 states (*structurally absent*, *not found*) + *"a third honest state … `PRESENT_UNREADABLE`"* |
| `docs/HANDOFF.md` §2 | backend `models.py` still ships **3 legacy** — `NOT_USED_IN_JURISDICTION`, `NOT_FOUND`, `NOT_STATED` — and states explicitly: *"that taxonomy needs a ruling before Gate 6 writes the field model"* |
| `e2e/golden.spec.ts` #1 | golden capture uses `__DONT_KNOW__` and `__NOT_STATED__` (**O2**) |
| Rebuild brief | **4 members** — structurally absent, not found, not stated, present-but-unreadable — as a discriminated union with an exhaustive switch and a never guard |

The brief itself concedes *"which set ships is an unresolved ruling"* — and HANDOFF §2 independently says the same. So the four-member union is the right *shape* to build against, but it currently matches nothing: not the contract, not the mocks, not the Python model.

Two sub-questions the ruling must answer:

- **Is `NOT_FOUND` distinct from `PRESENT_UNREADABLE`?** CONTEXT §11 treats "not found" as *the field exists and wasn't captured — always surface*, and `PRESENT_UNREADABLE` as *degraded scan, could not read*. These route the same way but mean different things to an engineer reading the bench.
- **Does the golden-capture pair (O2) map onto the field NA union, or is it a separate capture-time vocabulary?** `__DONT_KNOW__` is a statement about the *capturer*; `NOT_PRESENT` is a statement about the *jurisdiction*. Collapsing them would repeat the exact mistake CONTEXT §11 warns about, one level up.

I will build the four-member union with an exhaustive switch as instructed, but **`packages/contract` must be widened by the same ruling** or the boundary parse will reject payloads the UI claims to handle. That is a contract change, and the brief forbids widening a contract type locally.

### 4.4 Judgment auto-confirm has thinner test coverage than the load-bearing list implies

"Judgments never auto-confirm in v1" is one of the eight named load-bearing rules, and it is the single most consequential routing rule in the product (CONTEXT §8.3, §12 — judgments were 3 of 7 known defects, and judgment TYPE was wrong 3/3).

What the suite actually pins:
- `blind.spec` #5 — the TYPE second-pass gate at capture time
- `reconciliation.spec` #5 — the ≥40 coverage gate rendered as "the only gate left"

**No spec asserts that a judgment field never arrives in `auto_confirmed` state, or that the review UI refuses to render one.** That is correct in the sense that it is a server rule — the UI cannot cause it. But the rebuild brief's constraint 13 says *"No UI path may reach that state"*, which is a UI-side assertion that does not currently exist.

Recommendation: add one new invariant spec in Pass 3 — given a crafted payload where a `judgments.*` field arrives `auto_confirmed`, the UI renders it visibly flagged as a violation rather than as a normal confirmed field. This is new work, not harvested work, so I am flagging it rather than writing it.

---

## 5. Orphan rules, in prose

These exist in no document. If the specs carrying them are deleted, the rules are gone. Ordered by consequence.

**O1 — Passing an order requires a stated reason.**
Neither CONTEXT §7, PRD §9, nor master-prompt §4.2 says so; they say only that passes are recorded and the 4th auto-escalates. The suite refuses `POST /api/orders/{id}/pass` without a non-empty reason, on both Queue and Review. *Why it matters:* 4th-pass auto-escalation is only useful if each pass carries why. A bare pass count tells a senior that an order is hard but not what makes it hard, which is precisely the information the escalation exists to capture. *Server counterpart required* — a Zod-only rule would be a bug (constraint 14).

**O2 — Golden capture separates "I don't know" from "the document doesn't say".**
Capture emits `__DONT_KNOW__` and `__NOT_STATED__` as distinct sentinels. The contract's `NaReason` has neither. This is the only place in the repository where capturer-ignorance is modelled as a first-class value distinct from document-silence, and it bears directly on the unresolved NA ruling (§4.3). *Why it matters:* a golden set that collapses them records a human's uncertainty as a fact about the document, and that error propagates into every accuracy number computed against it.

**O3 — Golden capture never shows the pipeline's draft.**
Master-prompt §0.6 scopes structural blindness to the Blind Fifty typist screen. This spec extends it: golden-set capture is also blind to model output. *Why it matters:* ground truth captured while looking at the model's answer is not independent, and the golden set is what the model is scored against.

**O6 — Every failure renders a named state; blank pages and silent no-ops are defects.**
Six assertions in `errors.spec` form one rule with six clauses: unknown route → named not-found card; failed list query → named per-screen unavailable state; **partial failure degrades locally** (a timeline 500 leaves the rest of Review working); absent data → empty state, never a working-looking grid; stale deep link → names the stale identifier, distinct from no-context; failed mutation → the server's own message, verbatim, prefixed `server:`. *Why it matters:* this is the operations-staff surface. It is also where the "no failed_recoverable / no held state" coverage gap will show up — see §7.

**O8 — The UI never claims emptiness when it holds values.**
When both engines returned values but disagree, the field must not render "Not Available" or "extraction returned nothing at all"; it renders the draft *labelled as a draft*, with the state "engines disagree — nothing settled". *Why it matters:* this is principle 6 inverted. The documented rule is "never emit a value you can't cite". This is its mirror — never assert an absence you can't substantiate. A reviewer told a field is empty stops looking; the values were right there.

**O9 — Enter never accepts a blank.**
The keyboard fast path confirms values. Accepting an NA or missing field requires an explicit mouse click. Deliberate asymmetric friction. *Why it matters:* this is the suite's only keyboard-layer defense against bulk-accepting absences — functionally an anti-approve-all mechanism. If keyboard-first is dropped (§4.1) this rule still needs a home.

**O10 — A refused submit says why.**
Every refusal renders a nudge naming what is missing ("needs its question", "both the value and its why", "a pass needs its why"). A disabled control that does not explain itself is a defect. *Why it matters:* refusals are product requirements; a silent refusal reads as a broken button and trains reviewers to work around it.

**O11 — A reading is adopted, never retyped.**
The correction editor prefills exactly from the chosen engine reading. *Why it matters:* transcription is itself an error channel. Making a reviewer retype a value they have already judged correct manufactures new defects at the exact moment the system is trying to remove one.

**O13 — Forbidden affordances are absent, never disabled or dimmed.**
Asserted five times across `authz`, `account`, `home`, `sidebar`, `roles`. Stated in the `packages/contract/src/authz.ts` header comment but in no product document. *Why it matters:* a dimmed control leaks the existence of a capability, and the per-role projection (`rulesFor`) goes to the trouble of not naming other worlds in the payload. Dimming the control in the DOM would undo that at the last step.

**O14 — Authorization is checked before body validation.**
A role lacking the action gets 403 even with an invalid body; a role holding it gets 422. *Why it matters:* an unauthorized caller learns nothing about the request schema. Reversing the order turns every endpoint into a schema oracle.

**O15 — Typed text never triggers navigation or a global action.**
Chord keys, `?`, and `[` typed inside an input are text. *Why it matters:* protects an in-progress correction from a stray keystroke. The failure mode is silent data loss mid-edit.

**O16 — A rate never renders without its denominator.**
Catch rate renders "71%" beside "n = 34 probes this week · 24 caught". *Why it matters:* catch rate is the dashboard headline and the ungameable quality signal. A bare percentage over a small n reads as precision that is not there.

**O17 — Repeated corrections on a derived field surface as one upstream bug.**
"One broken function, not two defects." *Why it matters:* CONTEXT §6 draws the bugs-vs-corrections line at the data model level (two tables, two audiences). This applies it at the dashboard: a derived-field defect corrected 25 times is one engineering ticket, not 25 data points, and counting it as 25 would make reviewer corrections look like the problem.

**O4 — The escalation inbox has no triage surface.**
No priority, no category, no assignee — exactly one combobox on the screen, the rule citation. *Why it matters:* keeps escalations from becoming a ticket queue with its own management overhead, and keeps priority from becoming a throughput proxy through the back door.

**O5 — Time estimates are pace indicators and are banned.**
Master-prompt §0.4 bans "pace indicators of any kind"; the reading that a predictive *estimate* ("last one like it took…") is a pace indicator exists only in this test. *Why it matters:* an estimate sets a pace expectation as effectively as a counter, while looking like a helpful affordance.

**O7 — Seed correction is reachable only with context; it has no picker.**
"This screen has no menu entry." One field, one document, one record. *Why it matters:* prevents browsing the golden set, which is the cherry-picking prohibition applied to ground truth rather than to the queue.

**O12 — Differing characters between two readings are highlighted.**
Character-level diff. *Why it matters:* the reviewer's eye lands on the divergence instead of manually comparing two similar strings — which is exactly the comparison humans do badly (`$202,224` vs `$220,224`, the real seed defect in HANDOFF §2).

**O18 — Judgment TYPE gates its sibling fields.**
Master-prompt §0.6 describes TYPE as a server-enforced second pass. The additional rule: sibling judgment fields do not open until TYPE is recorded. *Why it matters:* judgment TYPE was wrong 3/3 in the delivered reports; capturing plaintiff/amount under a wrong TYPE produces confidently mis-filed ground truth.

**O19 — The senior may rule a third value neither typist entered.**
It requires its own "why" in addition to the citation. Docs describe reconciliation as choosing between A and B. *Why it matters:* when both typists misread the same smudge, forcing a choice between two wrong values would write a known-wrong value into the golden set.

**O20 — Field navigation visits only server-queued fields.**
J/K walk the queue the server produced; a reviewer cannot walk into auto-confirmed fields through it. *Why it matters:* the queue is server-owned. Navigation that ranges outside it lets a reviewer browse and re-open settled work, which is cherry-picking at field granularity.

---

## 6. Documentation corrections found while harvesting

Not part of the brief, but these are wrong in the docs and will mislead whoever reads them next.

1. **`frontend-master-prompt.md` §0.5 is stale on golden corrections.** It lists the refusal as `source_citation` + `reason` + `signed_by`. `golden.spec` #3 establishes that **the signer is derived from the authenticated session and is never a client field** — which is the correct behavior and one of the brief's eight load-bearing rules. The document should be corrected; the test is the authority.

2. **Probe visibility is stated absolutely but implemented as a distinction.** CONTEXT §14 says *"Probes are never visible in the UI"*; master-prompt §0.4 says *"probes must not exist in any component, type, or mock."* But `dashboard.spec` #1 requires `n = 34 probes this week · 24 caught` to render, and `vocabulary.test.ts`'s own comment notes `probe` has "legitimate uses (dashboard aggregate counts)". The operative rule is: **aggregate probe counts render; individual probe rows and planted values never do.** That reconciles with CONTEXT §4, which lists reviewer catch rate as a measured metric. Worth writing down, because the absolute phrasing invites someone to delete the denominator (O16).

3. **"Five-state field logic" is six states.** CONTEXT §7 and PRD §9 both say "five-state field logic"; the enum in both data models and in `packages/contract/src/enums.ts` has six: pending, auto_confirmed, needs_review, confirmed, corrected, escalated. The contract's own doc comment repeats "Five-state". Cosmetic, but it is the kind of off-by-one that makes an exhaustive switch look complete when it isn't.

4. **The design package location and format differ from the brief.** The brief describes `design-export/` containing *"generated React + Tailwind code"*. What exists is `design-mock/TitlePipe reviewer flow-handoff.zip` — 5 files, containing one 337 KB `TitlePipe.dc.html`, a `support.js`, a screenshot, and a README. **There is no React in it.** This changes Pass 2 mechanically: there are no components to map onto shadcn primitives, so the inventory must be extracted from rendered markup and `support.js` rather than read off a component tree. It does not change Pass 2's substance — classification into RENDER / RULE / CONFLICT works the same way.

---

## 7. Preview of the state-coverage gap (Pass 2 deliverable, flagged early)

The brief predicts the design will have drawn no `failed_recoverable` and no `held` state. I can confirm half of that from the current suite and contract, before opening the design:

- **There is no closed order-status vocabulary anywhere.** `packages/contract/src/enums.ts` deliberately declares `OrderStatus` and `DeliveryStatus` as bare `z.string()`, with the comment: *"OPEN until the Flask models are ported (P1) — they are the source of truth. Do not invent closed enums here."*
- The suite only ever exercises two delivery states — `FAILED IN TRANSIT` and `DELIVERED` (+ a `DELIVERED · 2 VERSIONS` variant).
- No spec anywhere exercises a held order, a recoverable worker failure, or an order in any error state. The `errors.spec` family (O6) covers **transport** failures — a 500 on a GET — not **pipeline** failures, which is a different thing entirely: a 500 is the UI's problem, a held order is operations' problem.

So the gap is real and predates the design: the current UI has no vocabulary for a pipeline that has partially failed. Whether that is a design gap or a contract gap cannot be settled until the order-status enum is ported from Flask at P1.

---

## 8. Proposed migration for Pass 1 — for approval, not yet executed

Nothing below has been done.

**Move to `apps/web/e2e/invariants/`, skipped, each with a `TODO(rebuild)` naming its rule:**
110 INVARIANT + 16 ORPHAN specs = **126 of 138**, minus the 22 Vitest tests, which move nowhere.

**Do not move — they never depended on the UI:**
`authz.test.ts` (21) and `vocabulary.test.ts` (1) stay exactly where they are and must keep passing through the deletion commit. If `authz.test.ts` breaks during Pass 1, something has touched `packages/contract`, which the brief forbids. **They are the tripwire for the deletion commit.**

**Keep as-is:** `e2e/helpers/net.ts` — not a spec. It is the in-page fetch wrapper that makes network-level blindness provable at all (Playwright's `page.route` cannot see MSW-handled fetches). Deleting it would silently remove the ability to prove `blind-blindness.spec` #1.

**Delete (5):** `home` #1, #3 · `sidebar` #1, #5 · `ux` #7.

**Hold pending §4.1 (6):** `navigation` #1–3 · `queue` #5 · `review` #9 · `sidebar` #6.

**Hold pending §4.2 (1):** `sidebar` #8.

### Completion bar for the rebuild

**126 un-skipped, green** — replacing the old 116 as the definition of done, plus the one new judgment-auto-confirm spec proposed in §4.4 if approved (→ 127).

That number will move if §4.1 resolves toward keeping keyboard-first (+6) and §4.2 resolves toward narrowing the constraint (+1), giving a ceiling of **134**.

---

# Part II — `apps/web-v2` harvest, executed 2026-07-27

Sections 1–8 above were written for the **in-place** rebuild of `apps/web`. The owner
has since directed a fresh build at `apps/web-v2` (`apps/web-v2/BRIEF.md`). This part
records the independent re-harvest run for that package and the migration that was
actually executed. Sections 1–8 stand as written; nothing above was edited.

## 9. Independent verification

Every one of the 25 pristine files was re-read from `git show ade49af:<path>` — **not**
from the working tree, which is already a migrated, re-selectored copy produced by the
in-place pass (see `apps/web-v2/BRIEF-DELTAS.md` D-4). Reading the working tree would
have measured the previous rebuild's output rather than the rule set.

Counts confirmed independently:

| | Measured | §1 claim | Agrees |
|---|---:|---:|:--:|
| e2e tests | 116 | 116 | ✓ |
| Vitest tests | 22 (21 `authz.test.ts` + 1 `vocabulary.test.ts`) | 22 | ✓ |
| **Total** | **138** | **138** | ✓ |
| STRUCTURAL | 5 | 5 | ✓ |
| CONFLICT | 1 (`sidebar` #8) | 1 | ✓ |
| AMBIGUOUS | 6 | 6 | ✓ |

The classification in §3 is endorsed. The re-read reached the same five STRUCTURAL
tests, the same single CONFLICT, and the same six AMBIGUOUS tests without consulting
§3 first. §1's headline — that this suite is a rulebook that happens to be executable,
and that its assertions are overwhelmingly negative and therefore selector-independent —
is confirmed.

## 10. The two blocking items are now resolved

**§4.1 — keyboard-first: RESOLVED YES.** Two independent confirmations. `open-rulings.md`
Q3 answered yes on the evidence that the design draws keyboard affordances throughout and
correctly suspends them inside inputs. `BRIEF.md` §4 then independently mandates
`react-hotkeys-hook` 5.3.x, and §7 specifies one scope per pane activated on focus —
naming the exact misfire bug that `navigation` #2 and `hard` #5 pin shut. The 6 AMBIGUOUS
specs are **INVARIANT**.

**§4.2 — the localStorage conflict: RESOLVED, mechanism changed.** `BRIEF.md` settles both
halves of the question that §4.2 could not decide alone:

- §9.11 — *"Nothing in `localStorage` or `sessionStorage`"* — enforced literally, and §6
  adds a CI grep for it. So option 2 (narrow the constraint) is closed.
- §7 — *"User preferences, pane widths → server, `GET/PATCH /api/me/preferences`, persists: yes"*.

So the **rule** in `sidebar` #8 survives intact — a display preference persists across a
reload and is never a one-way trap — while the **mechanism** moves from `localStorage` to a
server preference. This is a selector/mechanism rewrite, which BRIEF §5 Phase 5 permits, not
an assertion weakened, which it forbids. The spec migrates, tagged `INVARIANT (mechanism changed)`.

This is the only test in the suite whose migration note changes its implementation rather
than just its selectors. It is called out here so it is not quietly rewritten later.

## 11. Migration executed

Written to `apps/web-v2/e2e/invariants/`, one file per source spec, **every test `test.skip`**,
each preceded by a `TODO(rebuild) [CLASS] — rule:` line stating the rule in prose.

| | Count |
|---|---:|
| Migrated, skipped | **111** |
| Dropped as STRUCTURAL | 5 |
| **Source total** | **116** |

Composition of the 111: 88 INVARIANT + 16 ORPHAN RULE + 6 promoted by Q3 + 1 with a changed
mechanism (`sidebar` #8).

**Dropped (5), each recorded in place as a `// DROPPED —` comment naming why:**

| Spec | Test | Why |
|---|---|---|
| `home` #1 | renders the hub with live attention signals | hub door copy and layout of the old design |
| `home` #3 | g h jumps home from anywhere | old-nav keybindings; the chord layer itself survives in `navigation.spec` |
| `sidebar` #1 | the rail renders the role's doors and navigates | side-rail widget mechanics — old chrome |
| `sidebar` #5 | doors are grouped by pipeline stage | grouping labels of the old rail |
| `ux` #7 | every screen's title is the mouse path home | old TopBar mechanic; "never a dead end" is carried by `errors.spec` and `home.spec` |

Nothing was deleted from `apps/web`. The dropped five remain in git at `ade49af` and in the
working tree.

**Also copied into `apps/web-v2/`:**

- `e2e/helpers/net.ts` — not a spec. The in-page fetch wrapper that makes network-level
  blindness provable at all; Playwright's `page.route` cannot see MSW-handled fetches.
  Imports rewritten `./helpers/net` → `../helpers/net` for the new `invariants/` depth.
- `authz.test.ts` (21) and `vocabulary.test.ts` (1) — the Vitest gates. Neither is a UI test.
  `authz.test.ts` exercises `packages/contract/src/authz.ts`, a pure module both apps share;
  `vocabulary.test.ts` walks its own app's `src/`, so web-v2 needs its own copy to be gated
  at all. **The copies in `apps/web` stay until cutover** — per §8 they are the tripwire for
  the deletion commit.

Four specs carry helper functions or `helpers/net` imports; all were preserved through the
rewrite and verified: `roles` (`become`, `chord`), `review`/`ux` (`go`), and
`blind-blindness`/`errors`/`review-conflict`/`server-owns-state` (net helpers).

## 12. Completion bar for `apps/web-v2`

**113 e2e un-skipped and green, plus 22 Vitest green = 135.**

**REVISED 2026-07-27 after an independent audit.** Two of the five STRUCTURAL drops were wrong:

- `ux` #7 (*"every screen's title is the mouse path home"*) protects a real rule — a mouse user
  is never stranded. The claim that `errors.spec` and `home.spec` carry it does not hold:
  `errors.spec` covers error states, not returning home from a working screen, and a grep for
  `screen-title` across all migrated specs returns nothing. Commit `c2e9011` also deleted the
  side rail, which was the other mouse path home. **Restored.**
- `home` #3 lost *"⏎ opens the role's first door"*, which no migrated spec asserts. **Restored.**

Three drops stand: `home` #1, `sidebar` #1 and #5 are genuinely old-chrome layout.

The audit also found **17 of 111 class tags wrong**, including six tagged `[ORPHAN RULE]` whose
own prose said "promoted to INVARIANT", and the whole `errors` O6 family tagged INVARIANT when
it is the clearest ORPHAN in the suite. All corrected: **93 INVARIANT + 19 ORPHAN + 1
mechanism-changed = 113**.

This supersedes §8's 126/132/134 figures, which were computed before Q3 and §4.2 resolved.
Arithmetic: 116 source e2e − 5 STRUCTURAL = 111. The judgment-auto-confirm spec proposed in
§4.4 is **not** counted; it is a new spec, not a harvested one, and remains unwritten.

No harvested assertion may be weakened to reach this number. If one cannot pass against the
new design, BRIEF §5 Phase 5 and §12 both require stopping and reporting it as a design
CONFLICT instead.

# Design conflicts — must not be implemented as drawn

**Nineteen conflicts and eleven deliberate departures.** Two different kinds of record,
kept in one file because a reader who finds a difference between the app and the export
needs both to know what they are looking at:

- a **conflict** (`C…`, below) is something the design ASKS FOR THAT CANNOT BE BUILT — it
  breaks a harvested invariant, a documented server rule or a hard rule. Each carries what
  the design does, the constraint it breaks, and a suggested redraw.
- a **departure** (`D…`, at the foot) is something BUILT DIFFERENTLY ON PURPOSE. Nothing
  refuses it; a named rule simply outranked fidelity. Each carries the design of record,
  the ruling, and the rule that won.

A difference not in either list is a defect. Find one and it goes in one of these two
sections before it is fixed, so the next audit reports a decision rather than finding it
again.

**Three were release-blocking** — C8, C9, C11 contradicted harvested INVARIANT specs. All three are now resolved: D1 settled C11, and C8/C9 were built to the suggested redraw (`4267830`…`8412036`). **C17 is the one open blocker.**

---

## Release-blocking

### C8 — "Correct it" submits a value with no reason

**Design** (`TitlePipe.dc.html:824–831`): the expanded decision card offers a "Correct to" input and a violet "✎ Correct it" button. There is no reason field on the card.

**Breaks**
- `review.spec` #4 — *"correction without a reason never submits"* (INVARIANT, passing)
- `ux.spec` #5 — refusal must name what is missing (orphan O10)
- `frontend-master-prompt.md` §0.5 — "correction submit disabled without a non-empty `reason`"
- Target-arch constraint 14 — every client rule needs a server counterpart

**Why it matters.** The reason is not paperwork. It is what makes a correction reviewable later and what feeds the escalation and complaint channels (principle 3 — every answer produces a rule). A corrections table full of value changes with no stated why cannot produce a single rule.

**Suggested redraw.** Add a required reason input beneath "Correct to", styled like the completeness gate's required-comment field (`:399`) which the design already draws correctly. Disable "✎ Correct it" until both value and reason are non-empty, and render the nudge copy on refused submit. The design already has this exact pattern three screens away — the gap looks like an oversight, not a decision.

---

### C9 — "Escalate" submits with no question

**Design** (`:835–837`): "↗ Can't decide — escalate" is a bare button; `onEscalate` sets status directly.

**Breaks**
- `review.spec` #6 — *"escalation without a question never submits"* (INVARIANT, passing)
- `frontend-master-prompt.md` §0.5
- CONTEXT §7 — `POST /api/fields/{id}/escalate` — "question required"

**Why it matters.** The escalation screen the same design draws (`:1050–1051`) renders **"Reason"** from `escField.reason` — so the receiving end expects a question the sending end never collects. The two screens disagree with each other.

**Worse than "no field" — it fabricates one.** Found during the Phase 2 audit, 2026-07-27
(`phase2-audit.md` §3.1). `escalateField` at `:2681` does not leave the reason empty:

```js
reason: (s.signoffComments[fieldId] || 'Escalated from review')
```

When no comment exists it substitutes the literal string **`'Escalated from review'`**. The
escalation therefore arrives carrying a reason no human wrote.

That is materially worse than an omission. A missing input is visibly missing; a fabricated
default is indistinguishable downstream from a real one, and the senior resolving the
escalation has no way to tell which they are reading. It breaks principle 6 — never emit a
value you cannot cite — in addition to `review.spec` #6.

**Suggested redraw.** Escalate opens a required question input in the card, same treatment as the correction reason. The escalation screen's "Reason" block then has a real source. **The default must be deleted, not just supplemented** — leaving it in place while adding an input would preserve the fabrication on every path that skips the input.

---

### C11 — Escalation resolution does not require a rule

**Design** (`:1064–1071`): the senior writes a ruling and clicks "Rule & return to reviewer". A rule is optional, offered afterwards as *"↗ Open this as a PENDING rule — prefilled"* with the copy *"If this ruling should generalise…"*.

**Breaks**
- `escalations.spec` #1 — *"resolve stays held without a ruling AND a rule"* (INVARIANT, passing)
- `frontend-master-prompt.md` §0.5 — "escalation *resolve* disabled without a rule"
- CONTEXT §7 — `POST /api/escalations/{id}/resolve` — "REFUSED without a rule"
- CONTEXT §14 / principle 3 — "Every answer produces a rule. The same question is never asked twice."

**Why it matters.** This is the most consequential conflict in the export, because the design's version is *reasonable* and the documented rule is *strict*. The design's reading — not every field-level ruling deserves to be a general rule — is defensible. The documented rule exists because escalations that resolve without rules mean the same question gets asked again next month.

**This one may be a design improvement rather than a defect,** and I am not deciding it. Logged as ruling **Q11** in `open-rulings.md`. Until it resolves, the invariant stands and the design cannot be built as drawn.

**Suggested redraw (if the invariant holds).** Make the rule step part of resolution rather than a follow-on: cite an existing rule, draft a new one (lands PENDING), or explicitly record "field-specific, does not generalise" with a reason — which satisfies the spirit without forcing a junk rule.

---

## Client-side derivation — constraint 9, "no client-side state machine"

### C1 — Field counts computed in the browser
**Design** (`:2714–2721`): `total`, `auto`, `needTotal`, `noSource` are computed by walking the report array. `auto` is derived as `!f.noval && !isFlagged && f.page != null` — **auto-confirmed inferred from having a page reference.**
**Breaks** CONTEXT §7 ("must not re-derive counts", "must not compute `state`"), constraint 9.
**Redraw.** Counts arrive from the server as a `counts` object. Same pixels. The "No source" tile is a good idea — keep it, and let the server say the number.

### C2 — Status stamp computed in the browser
**Design** (`:2723–2729`): a five-branch conditional producing Sign-off open / Package incomplete / Decisions open / Ready / Finalized.
**Breaks** constraint 9.
**Redraw.** Server supplies `{label, tone}`. The stamp's *visual* treatment is distinctive and worth keeping exactly.

### C3 — Pipeline stage phases computed in the browser
**Design** (`:2755–2764`): `gatePassed = allSignoff && !compOpen`, then each stage's `done`/`gate`/`wait` derived from it.
**Breaks** constraint 9.
**Redraw.** Server returns the stage list with its own phase per stage. The UI renders dots and badges.

### C4 — Completeness gate evaluated in the browser
**Design** (`:2769+`, `isGap`, `compGaps`): gap detection and gap-closure state computed client-side.
**Breaks** constraint 9; and this is a *pipeline* decision, not a display decision.
**Redraw.** Server returns gaps with their claim/found text and closure state.

### C5 — Effective sign-off list resolved in the browser
**Design** (`soResolve`, `:2333–2347`): baseline product lines + client overrides (waive/narrow/replace/add) resolved client-side.
**Breaks** constraint 9. Worse: this result decides what an order is scoped to, and the design itself says *"The client paid for this product"* and *"money attached"*.
**Redraw.** Server resolves and returns the effective list. Note the design already understands this — the Clients compare matrix says *"Resolved through the same function intake uses, so this matrix cannot disagree with what an order actually gets."* Correct instinct; wrong side of the wire.

### C6 — `soComplete()` gates "Start pipeline" client-side
**Design** (`:2361–2362`, `:2363–2369`).
**Breaks** constraint 14 — a Zod-only rule is a bug.
**Redraw.** Keep the client-side disable for ergonomics; the server must refuse independently.

---

## Provenance and recommendation

### C7 — Single value + `suggested`, no A/B readings, no attribution
**Design** (`:2248–2254`): each decision carries `current` and `suggested`. Neither is attributed to an engine; the suggestion has no provenance of its own.
**Breaks** constraint 5 (engine output must not read as a recommendation); CONTEXT §8.3 ("review UI shows A and B values + B's line coordinates"); `review.spec` #3 (INVARIANT — "A≠B disagreement leads: both readings in the panel").
**Why it matters.** `suggested` is one engine's answer promoted to "the alternative" with nothing behind it. That is principle 6's failure shape — a value with nothing behind it, presented confidently.
**Redraw.** Show both readings with engine ids, page refs and snippets, as the contract's `readings: FieldReading[]` already models. Neither is pre-selected. The card's *question* framing ("Is the vested owner MARIA L. or MARIA I.?") is excellent and should survive — it just needs two attributed readings under it instead of one anonymous suggestion.

### C10 — Confidence embedded in a value string
**Design** (`:2252`): `current:'17 (low confidence)'`.
**Breaks** constraint 5.
**Redraw.** The value is `17`. Uncertainty is expressed by the field being in the decision queue at all, and by the `why` text — which the design already writes well (*"Microfilm frame is degraded in this region; neither reader could resolve the lot number."*). Strip the parenthetical.

---

## Identity, storage, data

### C12 — "Acting as" role switcher in the account menu
**Design** (`:111–117`): role chips that change the previewed world.
**Breaks** actor identity is never client-set.
**Mitigating.** The design labels it *"Preview control — not in production. The server enforces authorization independently; this only previews the gates."* — the most honest handling of this pattern I have seen in generated design.
**Redraw.** Keep for development behind a build flag; strip from production bundles. Never let it set an identity the server would honour.

### C16 — Preferences with no persistence
**Design** (`:1164–1180`): default zoom, reduced motion, keyboard shortcuts toggle.
**Breaks** nothing directly — but the design never persists them, so as drawn they reset on every load. That is a silent bug, and the obvious fix (localStorage) is forbidden by constraint 11.
**Redraw.** Server-side user settings on the profile record. **This resolves `test-harvest.md` §4.2** — with a real preferences home, the rail-collapse question answers itself the same way, and no browser storage is needed.

### C15 — Plausible-looking synthetic NPI
**Design**: `MARIA L. ESTRADA`, `1147 E Saddlebrook Ln, Mesa AZ 85203`, `SUMMIT VALLEY BANK, N.A.`, `217-44-091`, `r.delacroix@titlepipe.internal`.
**Breaks** nothing today — these are invented. But `frontend-master-prompt.md` §2 requires demo data be *"clearly synthetic"*, and this reads like a real file.
**Redraw.** Keep the *shapes* and the weird states; make the values obviously fake in the MSW fixtures. Internal `.internal` emails are already fine.

### C17 — RESOLVED 2026-07-29. The navigator was deleted; six invariants still depend on one
**Found** 2026-07-28, building web-v2 (`sidebar.spec`, 6 tests, still skipped — the only unbuilt invariants left).

**Design.** There is no rail. Commit `c2e9011` ("Delete the sidebar and the legacy theme") removed it, and the new export draws no replacement navigator on any screen. The hub plus `g`-chords carry navigation.

**Breaks** — six harvested invariants that outlived the widget they were written against:
- attention signals are DOTS, never counts — red for an unresolved complaint, amber for a gap (`rail-dot-{path}`)
- role-locked doors are ABSENT, not dimmed, and update live on a role switch (`rail-door-{path}`)
- the capture seat gets NO navigator — structural blindness stays whole
- the navigator folds from the keyboard (`[`), and `[` inside a text field is text
- the collapse preference persists across a reload and is never a one-way trap

Three of those rules are already honoured elsewhere and only their MECHANISM died: role-locked doors are absent on the hub and refused by chord (`roles.spec` ×4, passing), and the capture seat has no doors at all (`blind-blindness.spec`, passing). The other three — attention dots, the fold, and the persisted preference — have nowhere to live.

**Why it matters.** The dots are the only always-visible signal that a complaint is unresolved. On the hub they are one navigation away, which means they are seen when someone chooses to look — and an unresolved complaint is precisely the thing nobody chooses to look at.

**Blocked on two things, neither of them mine.**
1. **What the replacement is.** A persistent navigator contradicts a design that deliberately removed one. Options: re-draw a slim rail; put dots on the hub doors and drop the fold entirely (three invariants retire as STRUCTURAL); or carry them in a header strip. This is a design call.
2. **`GET/PATCH /api/me/preferences` does not exist** — not in `packages/contract`, not in `packages/mocks`. The spec's own migration note directs the persistence at a server preference and rules out localStorage (§9.11, and `check-rules` rejects it). C16 already decided preferences live server-side; the endpoint was never added. Building it from this screen would be generating backend behaviour from the UI, which the root `CLAUDE.md` forbids outright.

**RESOLVED.** The export's own answer was already in the file I had not read: its TOP CHROME carries a horizontal screen menu. That IS the navigator, so the six invariants attach to it — selectors re-targeted, assertions untouched.

- Dots ride the doors, red for an unresolved complaint and amber for an open escalation; no counts anywhere in the strip.
- Role-locked doors are absent through the same `canAccess` table the server gates with, and the strip re-renders on a role switch without a reload.
- The capture seat gets no chrome at all — and, after `blind-blindness.spec` #1 caught it, no preferences fetch either.
- `[` folds it, and a `[` typed into a field is a bracket.
- The fold persists through `GET/PATCH /api/me/preferences`, which C16 had already decided and nobody had built.

### C18 — RESOLVED 2026-07-29. `✕ Not our party` has no state to land in
**Design of record** (`TitlePipe.dc.html:833`, `d.onNotParty`; sheet renders `Excluded — not our party`).
**Breaks** nothing today — it is simply unbuildable. `FieldState` has no `excluded` member and no endpoint suppresses a field.
**Why it matters.** It is the screen form of R13 — *"Canceled/satisfied/vacated/released/duplicates suppress with reason"* — and the judgment-hit-identity call the whole `judgments.hit_identity` escalation cluster is about. Without it a reviewer's only exits are to correct a value that was never wrong, or to escalate a question they can already answer.
**RESOLVED** by making exactly that contract addition: `FieldState` gains `excluded`, and `POST /api/fields/{id}/exclude` takes a required reason. Both are proposals the backend must honour, not client behaviour — the state machine still lives server-side.

The reason is required for the same argument as a correction's, and it binds harder: a corrected value stays on the sheet where somebody can disagree with it, while an excluded row is GONE. Without the reason on the record, a suppression is indistinguishable afterwards from a row nobody looked at.

### C19 — The decision card shows one value; the invariant requires two, attributed
**Design of record** (`:824–831`): a single `{{ d.currentLabel }}` / `{{ d.currentValue }}`.
**Breaks** `review.spec` #3 (both readings shown and attributed — INVARIANT) and `ux.spec` #2 (differing characters highlighted).
**Resolution.** The invariant wins; the A/B panel with the character diff stays. Two engines returning `SOUTHSTONE` and `S0UTHST0NE` is three substituted characters a reader will pass at speed, and a merged single value hides which reader to trust.

### C20 — The upload step collects only the PDF
**Design of record** (`:255–300`): the drop zone alone; the five order fields live elsewhere in the flow.
**Breaks** `ingest.spec` #1, which requires all five on this screen — and the mock's `POST /api/orders` refuses a multipart body without them.
**Resolution.** Invariant and server agree against the design; the fields stay on the upload screen. The drop zone and its copy were adopted.

### C21 — Two designs for escalation: a single-field landing vs a cluster inbox
**Design of record** (`:1035–1100`): a senior lands on ONE escalated field — *"You land on the field in question, not the top of the order."*
**Archive** (`Escalation Inbox.dc.html`): a clustered inbox grouped by what is confusing people.
**Resolution.** The cluster shape stands: `GET /api/escalations` returns `field_path_cluster` on every row and there is no per-field escalation record, so the server sends a cluster. Grouping by it is what turns five people hitting one wall into one missing rule. The design's per-field context (`Escalated by {by} · {when}`, `View on p{page} →`) is unbuildable — `Escalation` has no asker, timestamp, field id or page. Its resolution flow was already overridden by D1.

---

## Not conflicts — recorded so they are not "found" again

These looked like conflicts and are not:

- **Light theme.** Third register, legitimately superseded twice. See `design-classification.md` §2.
- **Per-order clocks** ("Waiting 3h 12m"). The clock belongs to the order. Turnaround is a stated success metric (CONTEXT §4). Reviewer pace appears nowhere.
- **Queue "Mine" list.** Assigned work, not a shopping list — but it does contradict the old "exactly one order, no list" invariant, so it is ruling **Q11**, not a conflict.
- **`counts.noSource` as a headline.** Surfacing provenance-missing prominently is principle 6 working as intended. Only the *derivation* is wrong (C1).
- **Aggregate rule counts** (live/pending/conflict/open). Not an accuracy headline; these are workflow counts on an admin screen.

---

## Deliberate departures — ruled 2026-07-30, not defects

Eleven. Each: the design of record, the ruling, and the rule that outranked fidelity.
Numbering follows the design spec's own decision ids (`docs/superpowers/specs/2026-07-30-design-fidelity-design.md`), so a departure can be traced back to where it was decided.

### D1 — the order comes from the URL; there is no global current order
**Design of record:** the top strip carries full order context on every screen, gated only on `showChrome`.
**Ruling.** Order identity stays URL-derived (`app/orderFromPath.ts`). The export's strip is always populated because the export carries one global demo order; inventing a remembered "current order" would fabricate context on screens that have none, and two tabs on two orders is a normal way to work. Off an order screen the strip stays brand-neutral, and the lifecycle rail stops printing `THIS ORDER` over stages it cannot attach to an order.
**Rule that won.** Principle 6 — never emit a value you cannot cite. A fabricated order ref is the cheapest possible violation of it.

### D3 — the `/escalations` rail door the export does not draw
**Design of record:** `navGroups.Work` is Queue + Overview only (`TitlePipe.dc.html:2938`); escalations are reached from the Overview board's escalated rows.
**Ruling.** The door stays. It is the only live carrier of two release-blocking invariants — attention rides the doors as DOTS, never counts, and a door a role does not hold is ABSENT, not dimmed (`e2e/invariants/sidebar.spec.ts:43,:65`). Revisit only when another restricted door can carry the amber-dot and absence assertions.
**Rule that won.** A harvested INVARIANT outranks the drawing. Deleting the door deletes the only place two of them can be asserted.

### D4 — the reading fold keeps per-engine attribution behind a disclosure
**Design of record:** the export contains neither `READER A` nor `use this reading` in its 3,779 lines; the decision card shows one value.
**Ruling.** The A/B readings stay (C19) but FOLD. The build's bordered card-per-engine with its own adopt button roughly doubled the decision pane and put the ensemble in front of the question, so the detail moved into a `<details>` and the answer leads. What stays OUTSIDE the fold is load-bearing and not negotiable: the page cite, and the fact that more than one engine was consulted. The fold opens itself on a disagreement, because a disagreement has no resting state — it IS the question.
**Rule that won.** Principle 6 survives the fold. A value whose page must be uncovered by a click ships uncited, because nobody clicks — so the cite never folds. Only *which engine returned what* does.

### D5 — the rail glyph tie-break; the export's `P`/`P` collision is not copied
**Design of record:** `sbItem` takes `label.charAt(0)`, so "Products & sign-off" and "People" both draw `P`, and the export's own collapsed rail carries that ambiguity.
**Ruling.** Glyphs resolve across the whole drawn set (`entities/nav/glyphs.ts`): walk the catalogue in order, and each door takes the first free mark from its INITIAL, then its CHORD KEY, then a later letter of its label, then any free letter. First claim wins, so the export's letter survives on every door but the one that arrives second — which falls back to the chord the row `title` and the `?` map already print beside it.
**Rule that won.** At 78px the square is the only thing a collapsed row draws, so two identical squares are two rows a reader can separate only by hovering. Fidelity loses on exactly the row where it costs a reader the ability to tell two doors apart, and nowhere else.

### D6 — `Pass — say why` stays, and the export is the stale artefact
**Design of record:** no pass affordance anywhere in the 3,779-line export.
**Ruling.** Kept (`entities/field/DecisionBar.tsx`, `features/queue/NextOrderCard.tsx`). Pass-with-reason is real server behaviour — an endpoint, a `reason: min(1)` refusal (`packages/contract/src/endpoints.ts:208`), and fourth-pass auto-escalation. Removing it would delete a rule the server enforces because a drawing predates it.
**Rule that won.** Hard rule — the backend is upstream and is never generated from the pixels. The screen is not allowed to retire a server rule.

### D6a — the queue's on-screen key hint is removed
**Design of record:** no key hints anywhere on a screen; the `?` map holds them.
**App before:** `Keys: ⏎ take it · P pass` under the next-up card.
**Ruling.** Removed. The chords stay bound; a printed hint beside a binding is a second place the binding can go stale, and the export teaches chords in one place. Verified before removal that no Playwright spec asserts the line.

### D6b — `Report pipeline bug` is removed from the decision card
**Design of record:** the export's 3,779 lines contain no bug-report affordance.
**App before:** a bare `Report pipeline bug` line under the decision actions.
**Ruling.** Removed (the reason is left in place as a comment at `entities/field/DecisionCard.tsx:120`). No product rule, no endpoint and nothing behind it — an affordance that says an operation exists when it does not. Contrast D6: `Pass — say why` stays for the exactly opposite reason.

### D7 — ingest keeps two acts
**Design of record:** one button, one act — `Continue to sign-off →`.
**Ruling.** Two acts stay (`ingest.spec` #2, `features/ingest/IngestActs.tsx`): a package is uploaded, and then signed for. The export's copy is adopted onto the press that actually advances the step — press one is `Upload the package`, press two is `Continue to sign-off →` — so the design's wording lands where its meaning is true.
**Rule that won.** A harvested INVARIANT, and the mock's own `POST /api/orders`, which refuses a multipart body without the five order fields (C20).

### D8 — the Overview board raises its rail threshold instead of scrolling
**Design of record:** the board wrapped in `overflow-x:auto` with `min-width:1190px` (`TitlePipe.dc.html:1371`).
**Ruling.** The board squeezes to seven columns inside its container and falls back to the rail below 1190px (`features/overview/useNarrowViewport.ts`, `NARROW_QUERY = "(max-width: 1189px)"`). The export's minimum inside a 764px container hid Escalated and Delivered behind an affordance-less scrollbar (HANDOFF-UI §6). The board is now only ever drawn at its intended width, and the narrow case SAYS it switched rather than silently ignoring the view the reader chose.
**Rule that won.** A column that can never be reached is worse than a column that is not drawn. The board exists for the comparison between columns, and a horizontal scroll destroys exactly that.

### D10 — `/delivered` shows a different order and a UTC stamp
**Design of record:** order `4176034-1`, delivered stamp in MST.
**Ruling.** The screen shows `4175980-1` (`packages/mocks/src/data.ts:257` — the fixture's delivered order; `4176034-1` is mid-review and cannot also be delivered) and prints the zone as **UTC**, which is what the wire says (`features/delivered/deliveredRecord.ts:78-96`). MST would require knowing the recipient's zone; guessing it and labelling the guess is worse than being correct and foreign. When the server sends a localised stamp, render that instead of composing one here.
**Rule that won.** Principle 6 again — a zone label is a claim, and an unciteable one on a delivered report is a legally significant number rendered wrong.

### D9 — the stage-owner column: where markup and render disagree, the render governs
**Design of record — MARKUP:** the owner is a filled pill, `TitlePipe.dc.html:508` reading `s.badgeBg`/`s.badgeFg`, with `:2951-2954` giving Automated a grey fill, LLM agent a violet tint and You a solid violet.
**Design of record — RENDER:** all three owners draw as one plain uppercase label.
**Ruling.** The render governs, so the plain caption stays (`features/processing/StageRow.tsx`) and the pill tones are dead style. "Make it look the same" means the rendered artefact. Ranking owners by colour would say a stage the machine runs is a different KIND of thing from one you run, when the column only answers "who touches this one" — and a second coloured object at the row's right edge is what made `waiting` read as a warning.
**Rule that won.** The settled fidelity rule: the rendered artefact is the target. `StageRow.stories.tsx` now asserts the three owners carry an identical class list, so the ruling is a gate rather than a description.

---

## Open gaps — the app is not yet what a ruling says it should be

Not conflicts (nothing refuses them) and not departures (nobody ruled for the app's version). These are decided-but-unbuilt, listed so they are not mistaken for either.

### G1 — the order counts are not hidden below 1180px
**Design of record:** `countsDisplay: compact ? 'none' : 'flex'`, `compact = innerWidth < 1180` (`TitlePipe.dc.html:2447`, `:3770`).
**Ruling (design spec, 2026-07-30):** adopt it. Between 900 and 1180 the strip must carry the order ref, four tiles, the stamp and the account chip; the tiles are the part a reader can go and get, so they are what yields.
**State:** unbuilt. `app/OrderCounts.tsx` carries no responsive-visibility utility, and `app/whyComments.test.ts` asserts that fact so the gap stays visible. Closing it should strike this entry.

### G2 — `NO SOURCE` turns red above zero where the ruling says it stays muted
**Ruling (same spec):** `NO SOURCE` stays muted rather than turning red — red makes it louder than `NEED YOU`, which is the actionable tile.
**State:** unbuilt. `app/OrderCounts.tsx` gives the tile `text-state-halt-ink` and mutes it only at zero, and its comment argues the opposite case ("any other figure is the loudest thing on the strip"). One of the two records has to yield; the spec is the later artefact.

### G3 — the count numerals are not mono
**Design of record:** `font-family:'IBM Plex Mono'; font-size:15px; font-weight:600` (`TitlePipe.dc.html:141-153`), and the same spec ruling adopts it.
**State:** unbuilt. The tiles render `text-md font-semibold` with no mono face.

### G4 — comments across the tree cite specs that were never migrated
**State:** `blind-blindness.spec` and `roles.spec` were harvested and never built as spec files; `leaderboard.spec`, `account.spec`, `home.spec`, `delivery-complaints.spec` and `golden.spec` likewise. Fourteen sites outside `src/app/` still cite one of them as a passing gate — `entities/document/{CitedText,coordinates,coordinates.test,DocumentPane.stories}`, `entities/nav/doors.ts` (×4), `features/delivered/ReissuedSheet.tsx`, `shared/session.ts`, `shared/ui/ClaimVsEvidence{,.stories}.tsx`. The four in `src/app/` were corrected on 2026-07-30 and `app/whyComments.test.ts` gates that directory; widen the gate when the rest are corrected.

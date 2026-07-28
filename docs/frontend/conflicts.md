# Design conflicts — must not be implemented as drawn

Sixteen. Each: what the design does, the constraint it breaks, and a suggested redraw.

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

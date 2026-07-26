# Design conflicts — must not be implemented as drawn

Sixteen. Each: what the design does, the constraint it breaks, and a suggested redraw.

**Three are release-blocking** — C8, C9, C11 contradict harvested INVARIANT specs that pass today. Building them as drawn would require weakening a test, which the brief forbids.

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

**Suggested redraw.** Escalate opens a required question input in the card, same treatment as the correction reason. The escalation screen's "Reason" block then has a real source.

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

---

## Not conflicts — recorded so they are not "found" again

These looked like conflicts and are not:

- **Light theme.** Third register, legitimately superseded twice. See `design-classification.md` §2.
- **Per-order clocks** ("Waiting 3h 12m"). The clock belongs to the order. Turnaround is a stated success metric (CONTEXT §4). Reviewer pace appears nowhere.
- **Queue "Mine" list.** Assigned work, not a shopping list — but it does contradict the old "exactly one order, no list" invariant, so it is ruling **Q11**, not a conflict.
- **`counts.noSource` as a headline.** Surfacing provenance-missing prominently is principle 6 working as intended. Only the *derivation* is wrong (C1).
- **Aggregate rule counts** (live/pending/conflict/open). Not an accuracy headline; these are workflow counts on an admin screen.

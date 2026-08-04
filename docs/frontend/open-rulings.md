# Open rulings — questions for the owner

Every RULE element from the design export, as a numbered question. A RULE element implies behaviour the backend must own; none is implemented. Where a question blocks a screen, that is stated.

**Answer order matters.** Q1–Q3 block the most work. Q4–Q8 are one cluster (the whole intake/config concept) and are cheapest to answer together.

---

## Blocking the field primitive

### Q1 — How many no-value states ship, and what are they called?

**Four vocabularies now disagree.**

| Source | Members |
|---|---|
| `packages/contract/src/enums.ts` | 2 — `NOT_PRESENT`, `PRESENT_UNREADABLE` |
| Python `models.py` (HANDOFF §2) | 3 — `NOT_USED_IN_JURISDICTION`, `NOT_FOUND`, `NOT_STATED` |
| `e2e/golden.spec.ts` | 2 more — `__DONT_KNOW__`, `__NOT_STATED__` (harvest O2) |
| **This design export** | **4** — *not used in this jurisdiction* · *Not found — searched, none of record* · *Document silent — not stated on any page* · *Present — unreadable on page* |
| Rebuild brief | 4 — structurally absent, not found, not stated, present-but-unreadable |

**The design and the brief agree, independently, on the same four.** The design also dedicates a States Gallery card to the rule: *"They must never collapse into one grey dash."* HANDOFF §2 already says this taxonomy *"needs a ruling before Gate 6 writes the field model."*

That is now three sources converging on four members against a contract that ships two.

### RESOLVED — four states, ratified by the owner 2026-07-26. See `decisions.md` D3.

`packages/contract` `NaReason` widened 2 → 4: `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`, `PRESENT_UNREADABLE`. Purely additive, so nothing in the surviving screens broke.

`pending` ("not yet extracted") is a fifth *render* but deliberately **not** an enum member — it is a statement about the pipeline, not the document.

Implemented as `apps/web/src/entities/field/noValue.ts` with an exhaustive switch and a `never` guard, plus 12 static tests. Adding a member to the enum without giving it a render is now a compile error.

Backend mapping: Python `models.py` calls `NOT_PRESENT` → `NOT_USED_IN_JURISDICTION`. Same concept; reconcile at the Gate 6 port rather than renaming here.

**Sub-question Q1a.** Is golden capture's `__DONT_KNOW__` (the *capturer* could not determine it) a fifth member, or a separate capture-time vocabulary? It is a statement about a person; the other four are statements about the document. Collapsing them repeats the §11 mistake one level up.

**Blocks:** every screen that renders a field value. This is the first thing the rebuild needs.

---

## Blocking the reviewer path

### Q2 — Does the reviewer see two engine readings, or one value plus a suggestion?

CONTEXT §8.3 and `review.spec` #3 require both readings with engine attribution and Reader B's coordinates. The design shows one `current` value and one anonymous `suggested` (conflict C7).

The design's *question* framing ("Is the vested owner MARIA L. ESTRADA or MARIA I. ESTRADA?") is better than the old dual-column layout. But it presents an unattributed recommendation.

**What I need:** confirm both readings render with engine ids and provenance, and that neither is pre-selected. I intend to keep the design's question framing and put two attributed readings under it — confirm that is right.

> **BUILT UNDER THIS ASSUMPTION, 2026-07-27.** Owner direction was to proceed rather than
> wait. `entities/field/DecisionCard.tsx` and `EngineReadings.tsx` implement exactly the
> above: the design's question framing, both readings attributed by `engineId`, each with its
> own page chip, **neither pre-selected**, and no confidence anywhere (conflict C10).
>
> What is INVARIANT-backed and safe: two attributed readings with provenance, nothing
> pre-selected — `review.spec` #3 and CONTEXT §8.3 require it, so this holds however Q2 lands.
>
> What is MINE and would change if Q2 resolves differently: the visual arrangement — question
> above, readings beneath, an adopt button per reading. The design drew none of that layout.
> Recorded per BRIEF §12 so it is a decision on the record rather than a silent one.

### Q3 — Is keyboard-first still a product requirement?

**Carried over from `test-harvest.md` §4.1, now answerable.** The design draws keyboard affordances throughout: `C` confirm · `E` correct · `N` not-our-party · `↑↓`/`J`/`K` move, plus `Y`/`N`/`A` on sign-off. It correctly suspends hotkeys inside inputs and inside `[data-signoff]`.

**My reading: yes, keyboard-first survives.** That makes the 6 AMBIGUOUS harvested specs INVARIANT and raises the completion bar from 126 to 132.

**What I need:** confirm, so I can un-hold those specs.

---

## The intake / config concept — one cluster, answer together

These eight are the same architectural question in eight places: **does TitlePipe acquire a product-and-sign-off layer?** Roughly 40% of the export depends on it. None of it exists in `docs/PRD.md` §7 (data model) or §9 (API contract).

### Q4 — Do "products" exist as a first-class concept?
Six drawn: Current Owner Search, Two-Owner, Update, 20/40/60-Year. A product *"sets the questions and the scope"* and derives a search period (`owner` / `year` / `update` kinds).

PRD §13 has `clients.report_shape` and a Shape-B `Report Type` that "drives chain depth" — adjacent, but narrower. A product here drives the checklist, the period, the completeness gate, and the money.

**Blocks:** Upload, Questions, Completeness, and the identity strip on Review.

### Q5 — Is there an abstractor intake sign-off checklist?
Thirteen Y/N/NA lines answered by the abstractor **before** the pipeline runs, with required comments on NO, a signature, and a per-order frozen config version.

This overlaps CONTEXT §13's *eight-flag Y/N block* — but that block is **report output**, extracted from the package. Here it is **intake input**, asserted by a person. Same-looking data, opposite direction, different liability.

**What I need:** are these the same thing, related, or unrelated? If the eight flags become abstractor assertions rather than extracted values, that changes the extraction schema.

**Blocks:** Questions screen, Completeness gate, Review's read-only sign-off block, the disclosure decision cards.

### Q6 — Does a completeness gate exist between segment and extract?
A second halt: the machine checks intake claims against what was actually segmented, before spending money on extraction. CONTEXT §5's pipeline has no such stage.

The rationale in the design is sound — *"Nothing has been extracted yet, so re-running costs nothing"* — and it fits the accuracy-first, cost-second mandate.

### Q7 — Can a package be added to after ingest?
The gate's primary remedy is *"Upload the missing document — adds to the package, doesn't replace it."* Package `sha256` is currently the dedupe identity (CONTEXT §18). A mutable package needs a defined identity.

### Q8 — What is "root of title reached"?
A reviewer assertion that closes a chain-depth gap: *"Asserts the search is complete and nothing older exists. A claim — needs a comment."*

Not in the 24-rule book. R17 covers chain termination by arm's-length purchase; this is a human override of depth. Related to R15's warning that *chain termination sets search depth* — so this may be a UI for an existing rule, or a new one.

### Q9 — Is client config a delta-over-baseline system with versioning?
Clients hold only overrides (`waive` / `narrow` / `replace` / `add`) against a product baseline; behaviour edits publish a new config version; orders freeze a version at intake and later edits never reach an in-flight order.

This is a well-designed system. It is also an entire subsystem with no backend counterpart.

**Note the strongest line in the export:** *"Every effective line carries its origin — a line with no traceable source is a config defect, the same discipline as field provenance."* That generalises principle 6 to configuration. Worth adopting regardless of how Q9 resolves.

### Q10 — Can a client waive a load-bearing line?
The design draws it as a conflict requiring explicit acknowledgement, kept on record. That is the right shape *if* it is permitted at all — but it is a liability question, not a UI question.

### Q11 — Does escalation resolution still require a rule?

**The design says no; the documented rule says yes.** See conflict C11.

- Documented (CONTEXT §7, §14, master §0.5, `escalations.spec` #1): resolution is **refused** without a rule — cite an existing one or draft a PENDING one.
- Design: the senior writes a ruling and returns; converting it to a PENDING rule is an offered follow-on.

The design's reading is defensible — not every field-level ruling generalises, and forcing one produces junk rules. The documented rule exists so the same question is not asked twice (principle 3).

### RESOLVED — the rule stands, unchanged. See `decisions.md` D1.

Cite an existing rule **or** draft a new one (lands PENDING, inert). **No third "does not generalise" path** — I withdrew that proposal.

The junk-rule worry it was meant to answer is already handled: a draft lands PENDING and cannot affect the pipeline, the engineer gate is where junk gets rejected, and "cite existing" covers the common case without authoring anything. Meanwhile CONTEXT §11 states the opposite position directly — *"Whoever writes those reasons is writing the rulebook, one order at a time."*

Attested in six documents including `CLAUDE.md`'s hard-rules list, against a generated mock. The escalation screen is redrawn with the rule step inside resolution.

---

## Queue and ownership

### Q12 — Is the queue a single card or a workspace?
Old invariant (`queue.spec` #1): *"exactly one order, no list"*, and the second queued order appears nowhere.

The design keeps **Next up** as a single card with "Take next order" — correct — but adds **Mine** (in progress, Resume), **Held** (4 states), **In flight** (senior/ops), and **Recently delivered** (Reopen).

Assigned work is not cherry-picking. But this is a browsable set of orders where the old spec forbade one, and "Recently delivered → Reopen" is genuinely new.

**What I need:** confirm the queue becomes a workspace, and confirm the anti-cherry-pick rule now means "you cannot choose your *next* order" rather than "you cannot see other orders."

### Q13 — Are sign-off answers prefilled from client policy?
`ensureIntake()` prefills every line from client defaults. The design guards it: *"Policy can suggest; only a person can sign"*, the signature is applied separately at `startPipeline`, and unanswered lines render *"◇ Not answered · Policy suggests YES"*.

Still: a prefilled YES on a legal assertion someone signs is the shape of a defect. **Recommend requiring each line be touched**, with policy shown as a suggestion beside it — which the design already renders for the unanswered case.

### Q14 — What is the post-delivery reopen flow?
CONTEXT §13 documents that v1+v2 are both retained as the defect record. The design adds the *flow*: reopen on dispute with a required reason, only disputed fields re-open, everything else carries forward as settled, v1 never edited.

Sensible; needs backend definition. Relates to the complaints loop (CONTEXT §14), which the export does not draw.

### Q15 — Escalation ownership: "Take the order over"?
A senior may take the order rather than return it. No ownership-transfer concept exists in the data model.

Also: *"Open this as a PENDING rule — prefilled"* — prefilling a rule draft from a ruling. Good idea, undefined.

### Q16 — Is MFA-on-privileged-accounts a server gate?
The People screen renders *"N privileged account without MFA — this is a production gate."* Compliance §14 requires MFA. Is this enforced (blocks the account) or advisory (a banner)? The word "gate" implies enforcement.

### Q17 — What replaces the deleted navigator, and does `/api/me/preferences` land?
The rail is gone (`c2e9011`) and nothing replaces it, but six `sidebar.spec` invariants still describe one — attention dots, a keyboard fold, and a collapse preference that survives a reload. Three of the six are already satisfied by the hub and the chord layer and could retire as STRUCTURAL; the other three need somewhere to live.

Second half: C16 decided user preferences belong on the server, and `GET/PATCH /api/me/preferences` was never added to the contract or the mocks. Until it exists the persistence assertion cannot be met without browser storage, which §9.11 forbids and `check-rules` rejects. See `conflicts.md` C17.


---

## Not asked here

The export does not draw twelve of the sixteen old screens — the entire measurement suite (dashboard, bench, leaderboard, blind fifty, reconciliation, golden set, complaints, delivery). Those screens' rules are unaffected by this export and their harvested invariants stand unchanged. See `state-coverage.md` §4.

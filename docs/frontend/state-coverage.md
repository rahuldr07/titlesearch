# State coverage — design vs. the real state machines

Diffed in both directions: states the design never drew, and states drawn that do not exist in `docs/CONTEXT.md` / `packages/contract`.

---

## 1. Headline — the brief's prediction was wrong, in our favour

The brief said:

> Also expect the export to have drawn no `failed_recoverable` and no `held` states. Generators design the happy path.

**Both are drawn, prominently.** The Queue has a dedicated **Held** section with four states. The Lifecycle Overview has an **"Off the pipeline"** band with this copy:

> *"A failed order is not late, it is out. It needs a person to put it back, and it will sit here until someone does — which is why it is counted separately from the stages above rather than hidden inside one."*

There is also a whole screen — the **States Gallery** — whose stated purpose is *"States, not just the happy path… Every one of these has to stay visually distinct in production. This is the catalogue."*

The real coverage gaps are elsewhere, and two of them break invariants that pass today.

---

## 2. Field states

`packages/contract/src/enums.ts` → `FieldState`, 6 members. (Both CONTEXT §7 and PRD §9 call this "five-state field logic"; it has six. Noted in `test-harvest.md` §6.)

| Contract state | Drawn? | How |
|---|---|---|
| `pending` | ❌ **GAP** | See 2.1 |
| `auto_confirmed` | ⚠️ implicit | Renders as a plain value + page chip. No pill, and **visually identical to `confirmed`** |
| `needs_review` | ✅ | Membership in the decision queue |
| `confirmed` | ✅ | Decision status `confirmed` |
| `corrected` | ✅ | "Your correction" — violet, underlined |
| `escalated` | ✅ | "↗ Escalated to senior review" |
| — | ➕ **NEW** | `notparty` → "Excluded — not our party" (see 2.3) |

### 2.1 GAP — `pending` / "not yet extracted" is not drawn

Every field in the design's draft report has either a value or one of the four no-value states. **There is no render for a field that has not been extracted yet.**

This is easy to miss precisely *because* the four NA states look comprehensive. They are not: all four are statements about the **document** (absent from the jurisdiction / searched and not found / present but silent / present but unreadable). `pending` is a statement about the **pipeline** — we have not looked yet.

**Breaks:**
- `server-owns-state.spec` #1 (INVARIANT) — *"a null pending field renders 'not yet extracted' — never Not Available, never queued"*
- `review.spec` #1 (INVARIANT) — pending is *"a third, distinct render"*
- `hard.spec` #6 (INVARIANT) — same rule on the complaints screen
- `frontend-master-prompt.md` §0.3

**Action:** the no-value component needs a fifth arm. The discriminated union is 4 NA reasons **+ pending**, not 4 total. Needs a redraw; the design has no visual for it.

### 2.2 GAP — `auto_confirmed` is indistinguishable from `confirmed`

Both render as a mono value with a page chip. A reviewer cannot tell which values a human has approved and which the machine confirmed alone.

That distinction is the product's central claim (*"zero shipped defects on auto-confirmed fields"*) and the axis the complaints screen groups by — `how_it_got_through: auto_confirmed | human_confirmed`, where an auto-confirmed complaint *"indicates a threshold error, not a reviewer error"* (CONTEXT §14).

Not a broken invariant — no current spec asserts a visual difference on the draft report — but a real gap. **Recommend a distinct treatment and a new invariant spec.**

### 2.2b FOUND DURING BUILD — a sixth render: "nothing settled, the readings disagree"

Caught on screen during Pass 3 increment 2, not by any test.

**The contract encodes two different situations identically.** Both arrive as `value: null, na_reason: null`:

1. *Not yet extracted* — the pipeline has not reached this field.
2. *The engines read it and disagreed* — nothing merged, but the field is emphatically **not** empty; `readings` holds two candidate values.

Only the presence of `readings` separates them. Rendering the second as the first tells a reviewer there is nothing to look at while two candidate values sit in the payload — the exact defect `ux.spec`'s *"a both-found disagreement never claims emptiness"* (orphan **O8**) exists to catch. That spec is still skipped, so nothing caught it; the screenshot did.

Implemented as a sixth arm, `unsettled`, with the ATTEND treatment — this field is waiting on a person — and never the quiet grey of an NA state. It is not an `NaReason` member: like `pending`, it is a statement about the pipeline, not the document.

**CONTRACT GAP.** These two should be distinct on the wire — an explicit `unsettled` marker, or a distinguishing field — so that a client which forgets to consult `readings` cannot silently claim absence. Right now the safe render depends on the client doing extra work, which is the wrong place for that obligation.

### 2.3 NEW — `notparty` / "Excluded — not our party"

The design adds a terminal field state with no contract member: for identity decisions (R13 party identity), the reviewer may exclude a judgment as belonging to a different person. Renders struck-through with a green "Excluded — not our party" chip.

This is **domain-correct** — R13 requires party identity be a distinct check from status, and the Mecklenburg 10M006178-590 case turned on exactly this distinction. But `FieldState` has no member for it and there is no endpoint.

**Action:** add to the contract, or model as a `corrected` with a reason code. Ruling needed — logged as part of Q2.

### 2.4 Kept correctly

The **four no-value states**, drawn distinctly with colour *and* border-style *and* (for `silent`) a hatch — so they survive greyscale and colour-blindness. The gallery card states the rule: *"They must never collapse into one grey dash."* This is the single best thing in the export. Pending ratification — `open-rulings.md` Q1.

---

## 3. Order states

`OrderStatus` is deliberately `z.string()` — *"OPEN until the Flask models are ported (P1) — they are the source of truth. Do not invent closed enums here."* So there is nothing to diff against; the design is **proposing** a vocabulary.

### Drawn — lifecycle stages (7)
`unassigned` → `intake` (abstractor) → `machine` → `gate` (a person) → `review` (reviewer) → `escalated` (senior) → `delivered`

Each is tagged by *who it is stopped on*, and stages are typed `idle` / `halt` / `machine` / `done`. The framing — *"The machine advances exactly one of them — every other column is an order stopped on a person, which is the design, not a backlog"* — is a genuinely good model of this product.

### Drawn — held states (4)
| State | Waiting on | Recoverable |
|---|---|---|
| Package incomplete | abstractor to add documents | yes |
| Escalated | a senior abstractor | yes |
| Failed validation | intake to re-upload | yes — `failed_recoverable` |
| Delivery failed | ops | yes — `failed_recoverable` |

Plus **"Off the pipeline"** as a distinct band, counted separately rather than hidden in a stage.

### GAP — delivery is a state, not a screen
`Delivery failed` appears only as a held-queue chip. The design has no delivery screen, so it does not cover:
- retry (`delivery-retry` invariants — `delivery-complaints.spec` #1, `errors.spec` #7)
- failed-delivery-is-**transit**-not-quality framing (CONTEXT §13; `delivery-complaints.spec` #1, INVARIANT)
- v1 + v2 both listed as the defect record (`delivery-complaints.spec` #2, INVARIANT)

The v1/v2 concept *is* drawn — on the Delivered screen as a reopen flow — but the delivery **ledger** is not. Those invariants have no design to attach to.

---

## 4. Upload / ingest states

| State | Drawn? | Note |
|---|---|---|
| Idle drop zone | ✅ | |
| File attached, page count, "✓ readable" | ✅ | Readability must be a server verdict, not a client check |
| Ready | ✅ | |
| Upload rejected — unreadable | ✅ | Gallery: *"password-protected. Gap stays open until a readable file is added."* |
| **Upload in progress** | ❌ GAP | No progress or pending state for an 18 MB / 64-page PDF |
| **Duplicate package (sha256)** | ❌ **GAP — breaks an invariant** | See 4.1 |
| **Incomplete order — server names missing fields** | ❌ **GAP — breaks an invariant** | See 4.2 |
| **Explicit accept, separate from upload** | ❌ **GAP — breaks an invariant** | See 4.3 |

### 4.1 Duplicate detection is not drawn
`ingest.spec` #3 (INVARIANT): *"a byte-identical re-upload surfaces the server's duplicate notice"*. CONTEXT §18 makes sha256 dedupe a release gate. Nothing in the design.

Compounded by **Q7** — if a package can be *added to* after ingest (the gate's remedy), the sha256 identity needs redefining before dedupe can even be specified.

### 4.2 The server's named-missing-fields refusal is not drawn
`ingest.spec` #1 (INVARIANT): *"an incomplete upload is refused with the server's missing fields, verbatim"*. CONTEXT §18: *"rejects an incomplete package **naming the missing fields**"*.

The design gates "Continue to sign-off" on client + product being chosen, but has no server-refusal card. The old design had one; the new one does not.

### 4.3 Explicit accept is not drawn
`ingest.spec` #2 (INVARIANT): *"acceptance is explicit — upload alone never queues the order"*. CONTEXT §18: *"accept is explicit + logged"*.

The design's flow is upload → sign-off questions → start pipeline. Arguably the sign-off **signature** replaces the accept step and is a stronger version of it — a named person asserting the work, logged. That is a reasonable reading, but it is a reading, so: **flagged, not assumed.** Part of Q5.

---

## 5. Rule states — full match

| Contract | Drawn |
|---|---|
| `RuleStatus`: live / pending / retired | ✅ all three, with a `PENDING → LIVE → RETIRED` lifecycle strip |
| `RuleProvenance`: RULED / DERIVED / OPEN / CONFLICT | ✅ all four, correctly coloured |
| `RuleOrigin`: spec / escalation / reconciliation / complaint / senior | ⚠️ partial — origin shown as free text (`"R. Okafor"`, `"pipeline (derived)"`, `"template import"`) rather than the enum |

The design **adds** two ideas worth keeping: *"OPEN and CONFLICT are assigned by the machine, not chosen"* (you cannot author a rule into a state it can never leave), and rule **versions are immutable** with editing creating a new version rather than correcting history.

---

## 6. States drawn that exist nowhere

| State / concept | Screen | Ruling |
|---|---|---|
| Sign-off line answered / unanswered / amended | Questions, Review | Q5 |
| Completeness gap: open / closed-by-upload / closed-by-amend / closed-by-root | Completeness | Q6 |
| **Gap "provisional"** — the check has no evidence behind it | Completeness | see below |
| Config version: draft / published / frozen-on-order | Products, Review | Q9 |
| Client override: waive / narrow / replace / add | Clients | Q9 |
| Impact preview: fresh / stale / never-run | Rulebook | Q9 |
| Product change: recorded with from/to/by/why | Completeness | Q4 |
| Order ownership: mine / unassigned / taken-over | Queue, Escalation | Q15 |
| `notparty` field state | Review | Q2 |

### The "provisional" state deserves its own note

The design marks a completeness check **provisional** when the precondition behind it is a fixture rather than a real segmentation signal, and says so on screen:

> *"Provisional — the precondition behind this gate is a fixture on the build, not a value segmentation produced. It reads the same on every package, so this card cannot yet be trusted as evidence about THIS order."*

This is principle 6 applied to a *check* rather than a *value* — a check with nothing behind it, refusing to present itself as evidence. Nothing in the rulebook requires it. **Adopt it as a general pattern**, and consider whether it belongs in the rulebook as a rule about validators.

---

## 7. Screens with no design — invariants left unattached

Twelve of the old sixteen screens are not drawn: Ops Dashboard, Derived drill-down, Delivery, Complaints, Golden Set capture, Seed Correction, Extraction Bench, Bench Results, Blind Fifty typist, Blind Fifty Status, Reconciliation, Engine Leaderboard.

**Their harvested invariants are unaffected and still stand** — 47 of the 126 migrated specs cover these screens, including the whole blindness family (`blind.spec`, `blind-blindness.spec`, `hard.spec` #1/#3) which is the strongest expression of principle 4 in the repo.

**RESOLVED (owner, 2026-07-26): the twelve keep their design and are re-platformed against the new tokens.** They are in scope; their invariants stay in scope with them. Nothing is dropped, and the completion bar is unchanged.

Mechanics, token mapping, and the six gaps that surfaced: `replatform-mapping.md`. One of those gaps is a design call on the flagship screen — the shared document pane is dark in the old design and light in the new, and `PdfPane` is shared by Review and three of the twelve. See `replatform-mapping.md` §2.

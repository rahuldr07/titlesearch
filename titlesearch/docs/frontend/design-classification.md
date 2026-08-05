# Design classification — `design-mock/TitlePipe reviewer flow-handoff.zip`

**Pass 2 deliverable. No feature components written. Nothing implemented.**
Source: `titlepipe-reviewer-flow/project/TitlePipe.dc.html` (3,485 lines) + `support.js` (design-tool runtime, not design).
Date: 2026-07-26

---

## 1. Headline — the export is far better than the brief predicted, and wrong in different places

The brief supplied a table of twelve failure modes "generated design code reliably produces." Measured against the actual file:

| Predicted CONFLICT | Present? | Finding |
|---|---|---|
| Confidence badge as a recommendation | **No** | Zero confidence UI. One demo string contains `"17 (low confidence)"` — a value, not a badge. See C10. |
| "Approve all" / "Accept remaining" | **No** | No bulk control anywhere. Decisions are answered one at a time. |
| Reviewer stats, fields/hour, streaks | **No** | None. The Queue copy explicitly says *"Every clock here belongs to an order, never to you"* and the States Gallery has a card for the idle case reading *"The reviewer isn't idle-scored for it."* |
| Client-side `canTransition` / status derivation | **Yes** | C2, C3 — the status stamp and pipeline stage phases are computed in the browser. |
| `needsReview` computed from a threshold | **No** | Flagging comes from a fixed `decisions` list, not a threshold. But see C1 — *auto-confirmed* is derived. |
| Client validation with no server counterpart | **Yes** | C5, C6 — sign-off completeness and effective-line resolution are browser-side gates. |
| localStorage for session/drafts/prefs | **No** | Zero `localStorage` / `sessionStorage` in the file. Preferences exist as UI but are never persisted. |
| Optimistic success on confirm | **Yes** | C14 — every action mutates local state directly; there is no server round-trip at all. |
| Two-state "N/A" handling | **No — the opposite** | The design draws **four** distinct no-value states and dedicates a States Gallery card to *"They must never collapse into one grey dash."* |
| Field values with no citation | **No** | Every machine value carries a `pN` page chip. Values without a page render as a no-value state instead. |
| Realistic-looking mock NPI | **Partly** | Synthetic but plausible (Maria L. Estrada, 1147 E Saddlebrook Ln, Summit Valley Bank). See C15. |
| Analytics / session-replay | **No** | None. |

**Four of twelve predicted conflicts are absent, and one is inverted** — the design solved the NA problem the docs have been arguing about since HANDOFF §2.

What it actually gets wrong is different and, in two cases, more serious than anything on the list: **the correction flow has no reason field and the escalation flow has no question field** (C8, C9). Those are direct violations of two harvested INVARIANT specs and of `frontend-master-prompt.md` §0.5. They are easy to miss because both buttons look complete.

**The design also audits itself.** Line 2130 carries a comment headed `PROVENANCE AUDIT 07/25/2026` marking its own N/A completeness-gate preconditions as `'fixture'` — literals identical on every order — and concluding *"the N/A gate is provisional, not functional."* The screen renders that caveat to the user. This is not generator output; someone reasoned about evidence and refused to fake it.

### Scope warning

This is not a re-skin of the 16 screens the old app shipped. It is a **different product shape** built on concepts that exist in no backend document: products, an intake sign-off checklist, a completeness gate, per-client config overrides, and config versioning. Roughly 40% of the export has no counterpart in `docs/PRD.md` §7 (data model) or §9 (API contract). See `open-rulings.md` — that is where the volume is.

---

## 2. Register change — a third palette, and it is legitimate

| Register | Where | Status |
|---|---|---|
| Dark | `frontend-master-prompt.md` §0.9, HANDOFF §4 | Dead |
| Warm paper + action blue | `apps/web/src/index.css` (shipped) | Superseded by this export |
| **Cool grey + violet** | this export | **Live** |

I flag this because §0.9 says "dark register only" and I do not implement against a dead rule silently. But the existing `index.css` already carries the note that the dark values *"are superseded by the shipped design"* — so this is the second supersession, not a violation. `packages/ui-tokens` encodes the new one; `docs/prompts/frontend-master-prompt.md` §0.9 should be struck.

Typography is unchanged: IBM Plex Sans / Mono / Serif. The design uses **Serif semantically** — it renders human testimony only (reviewer comments, senior rulings, rule citations, abstractor reasons), never machine output. Preserve that; it is a real signal, and I have named it `--font-quote` rather than `--font-serif` to keep it.

---

## 3. Screen inventory — 19 screens + chrome

Old app screens with no counterpart drawn here: Ops Dashboard, Derived drill-down, Delivery list, Complaints, Golden Set capture, Extraction Bench, Bench Results, Blind Fifty typist, Blind Fifty Status, Reconciliation, Seed Correction, Engine Leaderboard. **Twelve of sixteen.** The export covers the reviewer/intake path and the admin/config path; it does not cover the measurement suite at all. That is a scope gap, not a design error — but it means the rebuild cannot delete the old measurement screens on the strength of this export. See §7.

| # | Screen | Bucket summary |
|---|---|---|
| 0 | Top chrome (header, nav, counts, stamp, account menu) | RENDER + **C1, C2, C12** |
| 1 | Queue | RENDER + **R11** |
| 2 | Lifecycle Overview | RENDER + R12 |
| 3 | Upload | RENDER + **R1, R2** |
| 4 | Questions (intake sign-off) | RENDER + **R3, R4, R13** |
| 5 | Processing | RENDER + **C3** |
| 6 | Completeness gate | RENDER + **R5, R6, R7, C4** |
| 7 | **Review** (flagship) | RENDER + **C7, C8, C9, C10** |
| 8 | Delivered (+ v2 reopen) | RENDER + R14 |
| 9 | Escalation resolution | RENDER + R15 |
| 10 | Screen-failure state | **RENDER — implement as drawn** |
| 11 | Sign-in | RENDER |
| 12 | Session ended | RENDER |
| 13 | Profile | RENDER + **C16** |
| 14 | Admin · People | RENDER + R16 |
| 15 | Admin · Clients | RENDER + **R8, C5** |
| 16 | Admin · Audit | RENDER |
| 17 | Rulebook | RENDER + **R9, R10** |
| 18 | Admin · Products & sign-off | RENDER + **R8, C5** |
| 19 | States Gallery | **RENDER — build as the visual-regression fixture** |

---

## 4. Element classification

Format: element → bucket → constraint or ruling → action.

### Screen 0 — Top chrome

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Logo, order ref, screen nav tabs | RENDER | — | Implement as drawn. |
| **Field counts: Fields / Auto-confirmed / Need you / No source** | **CONFLICT C1** | CONTEXT §7 "UI must not re-derive counts"; target-arch constraint 9 | Do not compute. Counts must arrive from the server. **`auto` is derived as `!noval && !flagged && page != null`** — auto-confirm inferred from having a page ref. That is state derivation, the exact §7 prohibition. |
| **Status stamp** (Sign-off open / Package incomplete / Decisions open / Ready / Finalized) | **CONFLICT C2** | Constraint 9 — no client-side state machine | Render a server-supplied status label. The five-branch `if/else` at line 2723 is a state machine in the browser. |
| "No source" count as a first-class metric | RENDER (keep) | Principle 6 | Excellent — surfaces provenance-missing as a headline. Keep the *idea*; take the number from the server. |
| Account menu: Profile / People / Clients / Audit / Rulebook / Products | RENDER | — | Implement as drawn. |
| **"Acting as" role chips** | **CONFLICT C12** | Actor identity never client-set | The design labels it *"Preview control — not in production. The server enforces authorization independently."* Honest, but it must not ship. Dev-only, behind a build flag, absent from production bundles. |
| Rubber-stamp visual treatment | RENDER | — | Distinctive; keep. Rotation, double border, mono caps. |

### Screen 1 — Queue

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| "Work comes to you" / "the system decides — no picking" copy | RENDER | Anti-cherry-pick | Keep verbatim — it states the rule to the user. |
| **Next up** — single next order + "Take next order" | RENDER | CONTEXT §7 `GET /api/queue/next` | Implement as drawn. Matches the old invariant exactly. |
| **Mine** — orders in progress, Resume | **RULE R11** | Old invariant: "exactly one order, no list" | Assigned work is arguably not cherry-picking, but this *is* a browsable list where the old spec forbade one. Needs a ruling before implementing. |
| **Held** — 4 states, some with Open | RENDER + R11 | — | The held-state vocabulary is new (§6). Card layout implements as drawn. |
| **In flight** (senior/ops only) | RENDER | Role-gated | Implement; gate server-side. |
| **Recently delivered** — Reopen · v2 | RENDER + R14 | — | Reopen flow is R14. |
| Per-order "Waiting 3h 12m" clocks | RENDER | Anti-throughput | **Legitimate** — the clock belongs to the order, not the reviewer. Turnaround is a stated success metric (CONTEXT §4). Keep. |

### Screen 3 — Upload

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Drop zone, file card, page count, "✓ readable" | RENDER | — | Implement as drawn. |
| **Client chips — "required · resolves the effective sign-off"** | **RULE R1** | No `products`/effective-signoff concept in PRD §7 | Do not implement until R1 resolves. |
| **Product chips (6) — "sets the questions and the scope"** | **RULE R2** | PRD §13 has `report_shape`; "product" is broader and drives scope | Do not implement until R2 resolves. |
| Prior-effective-date input, required for Update | RULE R2 | — | Part of R2. |
| "✓ readable" derived from the file | RULE | Readability is a server determination | Render server's verdict; never inspect the PDF client-side. |

### Screen 4 — Questions (intake sign-off)

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| 13-line Y/N/NA checklist, keyboard Y/N/A/↑↓ | **RULE R3** | No sign-off concept in any backend doc | Whole screen blocked on R3. |
| **Required comment on NO** | RULE R3 | Mirrors "corrections require a reason" | Good instinct; server must enforce. |
| **"Policy suggests YES" prefill** | **RULE R13** | A prefilled legal assertion | The design's own guard: *"Policy can suggest; only a person can sign."* Still a risk — see R13. |
| "{n} of {total} answered" | RULE R3 | Count derivation | Server-supplied when R3 lands. |
| Client/product/period identity strip | RULE R1/R2 | — | Blocked. |
| **`configVersion · frozen`** | RULE R8 | — | Config pinned per order. Strong idea, no backend counterpart. |

### Screen 5 — Processing

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Stage list with dot/badge/sub-copy | RENDER | — | Implement as drawn. |
| **Stage phase derivation** (`gatePassed`, `done/gate/wait`) | **CONFLICT C3** | Constraint 9 | Stage status must come from the server; the browser must not decide which stage is `done`. |
| "Two halts by design" framing | RENDER | — | Keep — names the product's shape honestly. |
| Pages-in-package / read-in-full split | RENDER | — | Server-supplied numbers, rendered as drawn. |

### Screen 6 — Completeness gate

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Halt banner, pipeline breadcrumb, gap cards | RENDER | — | Implement as drawn once R5 resolves. |
| **Gate evaluation** (`isGap`, `compGaps`) | **CONFLICT C4** | Constraint 9 | The gate is a pipeline decision. Server-owned, always. |
| **The gate concept itself** | **RULE R5** | Not in CONTEXT §5 pipeline | Blocked. |
| "You said / We found" claim-vs-evidence pairing | RENDER | — | Excellent pattern; keep. |
| **Upload missing doc — "adds, doesn't replace"** | RULE R6 | Package immutability | Blocked on R6. |
| **Amend claim YES→NO — "original answer stays in the record"** | RULE R6 | Append-only audit | Blocked on R6. |
| **"Root of title reached"** + required comment | **RULE R7** | Domain concept absent from the 24-rule book | Blocked on R7. |
| **Change product** — senior/admin + reason, "money attached" | RULE R2 | — | Blocked. |
| **Provisional-evidence warning** on fixture-backed gates | **RENDER — keep** | Principle 6 | The design refuses to present an unbacked check as evidence. Implement this pattern wherever a check lacks provenance. |

### Screen 7 — Review (flagship)

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Two-pane doc/fields split, narrow-mode tabs | RENDER | — | Implement as drawn. |
| Page nav, zoom, page strip ("11 of 64") | RENDER | — | Implement as drawn. |
| **Evidence highlight overlay on the page** | RENDER | Click-to-source | Implement — maps to `line_coords`. The one *real* coordinate consumer. |
| **"Not read in full" page state** | **RENDER — keep** | Never a silent blank | Excellent. Directly satisfies harvested O6. |
| Decision card: section, field, page chip, "asking" question | RENDER | — | Implement as drawn. Framing a flag as a *question* is a genuine improvement. |
| **`suggested` value presented as the alternative** | **CONFLICT C7** | Constraint 5 — no engine output as a recommendation | The card shows `current` vs `suggested` with no engine attribution and no provenance for the suggestion. This is the confidence-badge inversion wearing different clothes. |
| **No A/B dual-reading display** | **CONFLICT C7** | CONTEXT §8.3: "review UI shows A and B values + B's line coordinates" | The contract ships `readings: FieldReading[]`; the design renders one value. Coverage gap in the design. |
| **"✎ Correct it" — no reason field** | **CONFLICT C8** | `review.spec` #4 (INVARIANT); master §0.5 | Must not ship. Redraw with a required reason. |
| **"↗ Escalate" — no question field** | **CONFLICT C9** | `review.spec` #6 (INVARIANT); master §0.5 | Must not ship. Redraw with a required question. |
| **`"17 (low confidence)"` in a value string** | **CONFLICT C10** | Constraint 5 | Confidence must never ride inside a value. Strip. |
| "✕ Not our party" on identity decisions | RENDER | R13 party identity | Implement — genuinely rule-aware. |
| Draft report, section headings "match the delivered Word document exactly" | RENDER | — | Implement as drawn. |
| **Four no-value states** | **RENDER — keep, pending Q1** | CONTEXT §11 | Implement as a 4-member discriminated union with an exhaustive switch + never guard. **Contract ships 2** — see `open-rulings.md` Q1. |
| Your-correction / excluded / escalated value treatments | RENDER | — | Implement as drawn. |
| Read-only sign-off block ("you don't re-sign it") | RULE R3 | — | Blocked. |
| **Disclosure card — abstractor said NO, accept-or-escalate** | RULE R4 | — | Blocked on R3/R4. |
| Finalize & deliver | RENDER + R14 | — | Gate server-side. |
| Keyboard C / E / N / ↑↓ / J / K | RENDER | Answers harvest §4.1 | **Keyboard-first survives.** Inputs and `[data-signoff]` correctly suspend hotkeys — matches harvested O15. |

### Screen 8 — Delivered

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Finalized stamp, DOCX download, timestamps | RENDER | — | Implement as drawn. |
| **Reopen → v2, reason required** | **RULE R14** | CONTEXT §13 "v1+v2 both retained" | The *retention* rule is documented; the reopen *flow* is not. |
| v1→v2 field diff table | RENDER | — | Implement as drawn. |
| "13 operational lines are internal QC, not printed for the client" | RULE R3 | — | Blocked. |

### Screen 9 — Escalation resolution

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Lands on the field, not the order top | RENDER | — | Implement as drawn. |
| Ruling textarea, required before "Rule & return" | RENDER | Refusals | Implement. |
| **"Open this as a PENDING rule — prefilled"** | RULE R15 | Principle 3 | The escalation→rule path is documented; *prefilling* the rule from the ruling is not. |
| "Take the order over" | RULE R15 | — | Ownership transfer — no backend counterpart. |
| **Absent: rule required to resolve** | **CONFLICT C11** | `escalations.spec` #1 (INVARIANT); master §0.5 | Old rule: resolution is refused without a rule. Here the rule is *optional* ("if this ruling should generalise"). Direct contradiction — needs a ruling, logged as C11. |

### Screen 10 — Screen-failure state

| Element | Bucket | Action |
|---|---|---|
| Error card: *"it isn't showing you anything, rather than showing a blank that could be mistaken for real configuration"* | **RENDER — implement as drawn** | This is harvested orphan rule **O6** independently rediscovered, and stated better than my prose. Use this copy. |

### Screens 11–13 — Sign-in / Session ended / Profile

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| Sign-in: "This tool never sees your credentials" | RENDER | Clerk | Implement as drawn. |
| Session ended: "Nothing was lost… back in Mine" | RENDER | — | Implement as drawn. |
| Profile: identity from provider, capabilities list, sessions, MFA | RENDER | — | Implement; all server-supplied. |
| **Preferences: zoom / reduced motion / keyboard toggle** | **CONFLICT C16** | Constraint 11 — nothing in browser storage | Design never persists them (no `localStorage` anywhere) — so as drawn they reset each load, which is a silent bug. Needs a home: server-side user settings. Resolves harvest §4.2 cleanly. |
| "What I can do" capability list | RENDER | Per-role projection | Render from `GET /api/me/permissions` — do not hardcode `capsByRole`. |

### Screens 14–18 — Admin

| Element | Bucket | Constraint / ruling | Action |
|---|---|---|---|
| People: roles, status, MFA column, **privileged-without-MFA gate banner** | RENDER + R16 | Compliance §14 MFA | Banner is a good pattern; the *gate* is a server rule (R16). |
| "This screen changes authorisation, never credentials" | RENDER | — | Keep verbatim. |
| Audit: append-only, read-only, no inputs | RENDER | CONTEXT §6 | Implement as drawn — satisfies `account.spec` #3. |
| Rulebook list/detail, LIVE/PENDING/RETIRED lifecycle | RENDER | CONTEXT §9 | Implement as drawn. |
| **Rule tags RULED / DERIVED / OPEN / CONFLICT** | RENDER | CONTEXT §9 | Matches the contract's `RuleProvenance` exactly. |
| **"OPEN and CONFLICT are assigned by the machine, not chosen"** | RENDER | — | Correct and non-obvious. Keep. |
| **Citation required to save a rule** | RENDER | Master §0.5 | Implement. |
| **Save names every missing field** | RENDER | Harvested O10 | Independently rediscovered. Keep. |
| **PENDING inert; confirm is a separate act** | RENDER | Load-bearing rule 7 | Implement as drawn. |
| **Impact preview vs golden set** | **RULE R9** | No such endpoint | Blocked. |
| **Stale-preview invalidation** | RENDER (pattern) | — | *"It describes a rule that no longer exists."* Keep the pattern. |
| **Retire flow + retire-impact preview** | RULE R10 | — | Blocked. |
| **"No preview was run… the record will show it went out without a preview"** | RENDER | — | Excellent. Permits the action, records the absence. Keep. |
| Products / line catalogue / baseline grid / publish → new config version | **RULE R8** | No config-versioning concept | Whole tab set blocked on R8. |
| **Client overrides as deltas, never a copy** | RULE R8 | — | Strong design; blocked on R8. |
| **`soResolve` — effective-line resolution in the browser** | **CONFLICT C5** | Constraint 9; decides order scope | Server-owned. Money and liability attach to this result. |
| **Load-bearing line waived → conflict + acknowledgement** | RULE R8 | — | Blocked. |
| "A line with no traceable source is a config defect, the same discipline as field provenance" | RENDER | Principle 6 | Keep verbatim — generalises principle 6 to config. |

### Screen 19 — States Gallery

| Element | Bucket | Action |
|---|---|---|
| 12-card catalogue of non-happy-path states | **RENDER — build it** | Ship as an internal route and use it as the Playwright visual-regression fixture. It is the design's own answer to "what states exist", and the four-NA card is the clearest statement of the rule in the whole repo. |

---

## 5. Cross-cutting CONFLICT: no server round-trip anywhere

**C14.** Every action in the export mutates local state directly — `answer()`, `uploadDoc()`, `confirmRoot()`, `createV2()`, `saveNewRule()`. There is no fetch, no pending state, no error path on any mutation.

This is expected of a prototype and is *not* a design defect. It is listed because it means **the export provides no guidance at all** on: optimistic vs. server-authoritative updates, mutation error rendering, the 409-conflict path (`review-conflict.spec`, 3 INVARIANT specs), or loading states on any action.

Those must come from the harvested invariants, not from the design. In particular: the server's returned state is the truth for field decisions, and a 409 is an answer that must render — the design has no opinion, so the invariant governs.

---

## 6. Summary counts

| Bucket | Count |
|---|---:|
| RENDER — implement as drawn | 61 elements |
| RULE — backend must own; ships inert or omitted | 16 (R1–R16) |
| CONFLICT — must not implement as drawn | 16 (C1–C16) |

Of the 16 CONFLICTs, **three are release-blocking against harvested INVARIANT specs**: C8 (correction without reason), C9 (escalation without question), C11 (escalation resolve without a rule). Those three cannot be built as drawn without failing tests that currently pass.

Full detail: `conflicts.md`. Rulings: `open-rulings.md`. State vocabulary diff: `state-coverage.md`. Component mapping: `component-inventory.md`.

# Design handoff vs frozen contract — screen analysis

**Date:** 2026-08-27
**Design source:** `/home/rahul/projects/title-report/design_handoff_titlepipe/` (README.md, claude-design-rules.md, reference-app.html, tokens.css/json)
**Contract source:** `packages/contract/src/*.ts` — FROZEN and authoritative. The backend is upstream.
**Also governing:** root `AGENTS.md`, `docs/INVARIANTS.md`

> Where the design and the contract disagree, **the contract wins**. Where the design needs
> something the contract does not have, that is a **backend conversation, not a UI invention**.
> Where the design requires something the contract deliberately removed, that is a **`CONFLICT`
> in the design** (`docs/INVARIANTS.md:26-27`) — stop and report, do not weaken the rule.

---

## 1. Screens → contract binding → route

Routes are **not free**: `authz.ts:62-81` is the frozen door table. A screen at a path not in
that list is unreachable by design.

| # | Design screen | Contract entities / endpoints | Proposed route | Gap / flag |
|---|---|---|---|---|
| 1 | Sign-in | `MeProfileResponse` intake.ts:359; `MePermissionsResponse` endpoints.ts:604 | `/account` authz.ts:81 | Design's 4-account switcher is mock-auth only; Clerk at P1 |
| 2 | Overview | `MetricsResponse` endpoints.ts:423; `DerivedSignalResponse` endpoints.ts:492; `LifecycleResponse` intake.ts:246 | `/dashboard` authz.ts:69 | **GAP.** "Recent orders table (last 10)" has **no endpoint** — no order-list endpoint exists |
| 3 | All Orders | `QueueBandsResponse` endpoints.ts:136 (⚠ unratified) | `/queue` authz.ts:63 | **HARD CONFLICT.** No browse/list/search/paginate endpoint exists and `INVARIANTS:82-83` forbids one. See §6 |
| 4 | Order Hub | `OrderContextResponse` intake.ts:301; `OrderCensus` endpoints.ts:160; `OrderTimelineResponse` endpoints.ts:579; `OrderSignoffResponse` intake.ts:64; `OrderCompletenessResponse` intake.ts:173 | `/orders/{id}` authz.ts:66 | "18-dot progress meter" + "N of M decisions settled" — see §5 item 1-2 |
| 5 | Intake / Upload | `CreateOrderRequest` endpoints.ts:39; `IngestRejection` endpoints.ts:49; `CreateOrderResponse` endpoints.ts:62; `POST /api/orders/{id}/accept` endpoints.ts:60 | `/ingest` authz.ts:67 | **GAP.** Quarantine Gateway checklist (AV → real-PDF → SHA-256) and Optical Profile (DPI, clerk stamp, contrast floor) have **no schema**. Backend conversation 3 |
| 6 | Extraction | `OrderPipelineResponse` intake.ts:92; `PipelineStage` intake.ts:83; `OrderPagesResponse` endpoints.ts:654 | `/orders/{id}` (sub-view) authz.ts:66 | **GAP / likely refusal.** "dark terminal (streams log lines with the run)" has no endpoint and is probe-adjacent — `entities.ts:17-22` forbids probe visibility |
| 7 | Examination Workstation | `OrderFieldsResponse` endpoints.ts:169; `Field` entities.ts:90; `FieldReading` entities.ts:69; confirm endpoints.ts:186, correct :192, escalate :200, exclude :669; `SourcePage` endpoints.ts:642 | `/orders/{id}?field=` authz.ts:66 (deep link per `INVARIANTS:55`) | **GAP — the biggest one.** "T1 second read / countersign" has **no contract surface at all**. Nearest analogue `Reconciliation` entities.ts:202 + `POST /api/reconciliation/{order}` endpoints.ts:319 is a *different mechanism*. Backend conversation 1 |
| 8 | Release Compiler | `Report` entities.ts:216; `OrderSignoffResponse` intake.ts:64 | `/delivery` authz.ts:70 | **GAP.** No compile, gate-check, or sign-execute endpoint. Certificate template interpolation unbacked. Backend conversation 2 |
| 9 | Delivered | `Delivery` entities.ts:226; `DeliveryWithReport` endpoints.ts:617; `DeliveriesResponse` endpoints.ts:625 | `/delivery` authz.ts:70 | **GAP.** Version Ledger maps to `Report.version` entities.ts:219, but the **Reissue Gateway has no endpoint** and no reason field exists. Backend conversation 2 |
| 10 | QC & Escalations | `Escalation` entities.ts:166; `ResolveEscalationRequest` endpoints.ts:238; `Rule` entities.ts:153; `RuleStatus` enums.ts:72 | `/escalations` authz.ts:68 | Design's "determination buttons" must be **refused without a rule** (endpoints.ts:233-236; `INVARIANTS:109-110`). Design §10 never mentions the rule requirement |
| 11 | Templates Architect | `ConfigLine.standard_text` workspace.ts:58; `ConfigResponse` workspace.ts:68; `NaReason` enums.ts:53 | **none** | **GAP + refusal.** No door exists in authz.ts:62-81. And workspace.ts:12-17 is READ SHAPES ONLY — "Save bumps v4.2 → v4.3 draft" is a write the contract deliberately omits |
| 12 | Settings | `PeopleResponse` intake.ts:336; `PERMISSIONS` authz.ts:59; `RulesResponse` endpoints.ts:621; `ConfigProduct` workspace.ts:33; `AuditResponse` endpoints.ts:558; `Preferences` intake.ts:375 | `/account` authz.ts:81 | **Refusal.** RBAC matrix cells that "cycle — / VIEW / EDIT" imply a write; `authz.ts:118` closes `PERMISSIONS` with `as const satisfies` — it is compile-time frozen. Audit is read-only by construction (endpoints.ts:545-547) |

**Summary:** 8 of 12 screens have partial or absent contract backing. Screen 11 has no door at
all. Screen 3 is not a gap but a conflict.

---

## 2. The reverse — contract surface the design never surfaces

Every item below is a **missed screen**. There is **no dead contract surface**.

| Contract surface | authz.ts door / action line | Verdict |
|---|---|---|
| `POST /api/blind/{order}/entries` endpoints.ts:295; `BlindEntriesRequest` endpoints.ts:295; `BlindEntriesResponse` endpoints.ts:300; `BlindEntryInput` entities.ts:289; `TypistSeat` enums.ts:69 | `screen.blind.enter` **authz.ts:76**; `screen.blind-status.enter` **authz.ts:77**; action `blind.submit` **authz.ts:112** | **Missed screens (2 doors).** The blind-fifty capture seat is an entire absent world. `INVARIANTS:128` governs it: the capture seat has **no rail** — structural blindness stays whole. Blindness is enforced server-side and verified by a security test (endpoints.ts:290-294) |
| `Reconciliation` entities.ts:202; `ReconciliationResponse` endpoints.ts:308; `ReconciliationRulingRequest` endpoints.ts:319 | `screen.reconciliation.enter` **authz.ts:78**; action `reconciliation.rule` **authz.ts:113** | **Missed screen.** Design substitutes "T1 second read", which is not the same mechanism (see backend conversation 1) |
| `GoldenField` entities.ts:188; `GoldenCorrectionRequest` endpoints.ts:261; `GoldenAffirmRequest` endpoints.ts:282; `POST /api/golden/{id}/confirm` and `/demote` endpoints.ts:270-281; `GoldenResponse` endpoints.ts:622 | `screen.golden.enter` **authz.ts:72**; `screen.seed-correction.enter` **authz.ts:73**; actions `golden.correct` **authz.ts:106**, `golden.confirm` **authz.ts:108**, `golden.demote` **authz.ts:109** | **Missed screens (2 doors).** The ground-truth corpus is invisible in the design. This is the one screen where ground truth changes (endpoints.ts:272) |
| `BenchResultsResponse` endpoints.ts:370; `BenchCell` endpoints.ts:341; `BenchFailRow` endpoints.ts:349; `BenchSection` endpoints.ts:360 | `screen.bench.enter` **authz.ts:74** | **Missed screen.** Section × tag matrix vs the golden set. Deliberately no aggregate number in the shape (endpoints.ts:336-339) |
| `LeaderboardResponse` endpoints.ts:382; `LeaderboardCell` entities.ts:276 | `screen.leaderboard.enter` **authz.ts:75** | **Missed screen.** Includes the `no_truth_yet` → NO TRUTH YET render (entities.ts:271-274) |
| `Engine` entities.ts:250; `EngineRoutingCell` entities.ts:259; `EngineRoutingRequest` endpoints.ts:388; `EnginesResponse` endpoints.ts:623; `RoutingResponse` endpoints.ts:624 | reached via `/leaderboard` **authz.ts:75**; action `routing.flip` **authz.ts:114** | **Missed screen.** Engine routing flip, engineer-approved, evidence required |
| `Complaint` entities.ts:237; `CreateComplaintRequest` endpoints.ts:509; `ResolveComplaintRequest` endpoints.ts:527; `ComplaintsResponse` endpoints.ts:628; `HowItGotThrough` enums.ts:98 | `screen.complaints.enter` **authz.ts:71**; actions `complaint.record` **authz.ts:115**, `complaint.resolve` **authz.ts:117** | **Missed screen.** The post-delivery defect loop is absent. `auto_confirmed` = no human saw it = the threshold is wrong, not a reviewer (enums.ts:95-97) — that grouping is the point of the screen |
| `Bug` entities.ts:178; `CreateBugRequest` endpoints.ts:222; `BugsResponse` endpoints.ts:630 | action `bug.file` **authz.ts:103** | **Missed.** Design has no broken-input channel. "Escalate" is **not** it — bugs are broken INPUTS routed to developers, not corrections (entities.ts:177, CONTEXT §6) |
| `QueueNextResponse` endpoints.ts:70; `PassOrderRequest` endpoints.ts:211; `PassOrderResponse` endpoints.ts:216 | `screen.queue.enter` **authz.ts:63**; action `order.pass` **authz.ts:86** | **Missed, and structurally so** — the design replaced the served queue with a browsable table (screen 3). The 4th pass auto-escalates server-side (endpoints.ts:206-207) |
| `POST /api/fields/{id}/exclude` endpoints.ts:669; `ExcludeFieldRequest` endpoints.ts:669; `Field.excluded_reason` entities.ts:123 | inside `/orders` **authz.ts:66** | **Missed.** R13 suppression-with-reason has no UI anywhere in the design. A silent suppression is indistinguishable from a miss (entities.ts:119-121) |
| `Field.asking` / `Field.why` entities.ts:148-149 | inside `/orders` **authz.ts:66** | Design *has* the affordance (the decision card leads with a question) but README §7 never names these as **server-authored**. entities.ts:137-140: composing either in the browser would be the UI narrating why the pipeline routed something — a claim only the router can make |

---

## 3. Vocabulary diff — design terms vs contract terms

**The contract wins in every row.** The right-hand column is what the UI must rename.

| Design term | Contract term | file:line | UI must |
|---|---|---|---|
| "rulings" / "answers" | `confirmed` \| `corrected` — two distinct states | enums.ts:9-16 | Rename; stop merging. A confirm and a correction are different records with different endpoints (endpoints.ts:186 vs :192) |
| "Examination Workstation" | review | authz.ts:66 (`screen.review.enter`, path `/orders`) | Rename the route. Screen title is cosmetic; the path is not |
| "stages 1–5" (sidebar rail) | `FieldState` (6 members) ≠ `PipelineStage`/`StagePhase` (4) ≠ `StageKind` (4) | enums.ts:9; intake.ts:77; intake.ts:185 | **Three different state machines.** The design collapses them into one 1–5 rail. Do not |
| "T1 second read" / "countersign" | *no term exists* — nearest is `Reconciliation.ruled_by` | entities.ts:212 | Do not build. Backend conversation 1 |
| "QC determinations" | `escalation.resolve`, refused without a rule | endpoints.ts:238; authz.ts:104 | Rename to escalation resolution, and add the rule requirement the design omits |
| "queries" | `Escalation` | entities.ts:166 | Rename |
| "gaps" | `CompletenessGap` / `GapKind` (`na_provisional`, `disagreement`, `period_short`) | intake.ts:143; intake.ts:105 | Adopt the server's kinds; stop free-typing |
| "Policy Exceptions" | `Rule` + `RuleProvenance` (`RULED` / `DERIVED` / `OPEN` / `CONFLICT`) | entities.ts:153; enums.ts:85 | Rename |
| "Rule Candidates → PENDING" | `RuleStatus.pending`, `RuleOrigin.escalation` | enums.ts:72; enums.ts:75 | ✅ Already correct. Keep. Must render **visibly inert** (`INVARIANTS:112-113`) |
| "4-state NA matrix" | `NaReason` — exactly 4 members | enums.ts:53 | ✅ Aligns. **But** the design must add the **fifth render**: `pending` + `value === null` = "not yet extracted", a statement about the PIPELINE not the document, and **not** a member of `NaReason` (enums.ts:44-48; `INVARIANTS:37`, `INVARIANTS:45-46`) |
| "Templates" / "blocks" / "v4.2 → v4.3" | `ConfigLine.version`, `ConfigResponse.frozen`, `ConfigLine.standard_text` | workspace.ts:59; workspace.ts:70; workspace.ts:58 | Rename. And there is no write path — workspace.ts:12-17 |
| "Typist (Reviewer)" — one role | `typist` and `reviewer` are **two separate roles** | authz.ts:31-38 | Split them. A typist is blind-capture and structurally cannot review: `screen.review.enter` is `SIGHTED` only, which excludes typist (authz.ts:66, authz.ts:57) |
| "QC Reviewer" | `senior` | authz.ts:33 | Rename |
| "Admin · Licensed Examiner #GA-8841" | `admin` | authz.ts:37 | Licence numbers are not in the contract |
| "product pill" | `Order.product`, **nullable** | entities.ts:58 | Handle `null` as a statement, not as "—". entities.ts:50-53: `null` means no resolved product; a count asserts somebody looked |
| "page count" (design says 64) | `Order.pages`, **nullable** | entities.ts:60 | Same. Design said 64, old fixtures said 38, "a number nothing validated because nothing owned it" (entities.ts:45-47) |
| "period" | `period_label` — a rendered label, never a machine-readable span | entities.ts:59; entities.ts:53-56 | Rename. Never recompute a date from it |
| "SLA chip", "Due" column | *nothing — deliberately* | — | **Delete both.** `INVARIANTS:84-85`: no pace indicators, no throughput language, no timers, **and no time ESTIMATES — an estimate is a pace indicator** |

---

## 4. Design state tree vs TanStack Query (server) vs zustand (client UI)

Design tree is at design `README.md:39`. **Rule: the server owns all state machines; the UI never
computes state from confidence and never re-derives counts.**

| Design state member | Correct owner | Why |
|---|---|---|
| `session { user }` | **server** — `MeProfileResponse` intake.ts:359 | |
| `session { activeRole }` | **server** | Role is a Clerk claim at P1. `INVARIANTS:127`: a forged or case-variant role is refused; garbage never yields the admin world. A client-held role is forgeable |
| permissions | **server** — `GET /api/me/permissions`, `MePermissionsResponse` endpoints.ts:604 | Rules-as-data (authz.ts:180-185; endpoints.ts:588-593). A zustand copy is a second permission table that drifts from the first — `INVARIANTS:121` says there is exactly **one** |
| `activeOrderRef` | **URL** — not zustand | `INVARIANTS:153`: deep links are first-class, `?field=` lands on the exact field, URL-owned selection |
| `work.answers { field → ruling }` | **server** — `OrderFieldsResponse` endpoints.ts:169 | `INVARIANTS:39`: the server's returned state renders, **never an optimistic local mutation**. Mutations return a bare `Ack` (endpoints.ts:34) *deliberately carrying no state back*; the client re-reads its list query (endpoints.ts:30-32) |
| `work.gaps` | **server** — `OrderCompletenessResponse` intake.ts:173; `CompletenessGap` intake.ts:143 | |
| `work.secondRead` | **server — no shape exists yet** | Cannot be client state. Blocked on backend conversation 1 |
| `work.qcOutcome` | **server** — `Escalation.resolution` entities.ts:171 | |
| `work.delivered` | **server** — `Delivery.status` entities.ts:230 | |
| `work.reissue`, `work.reissueDone` | **server** — `Report.version` entities.ts:219 | No endpoint yet; backend conversation 2 |
| `work.reqs` | **server** — `EffectiveChecklist` workspace.ts:121 | workspace.ts:104-108 is explicit: resolution is **server work**, never recomputed from baseline + override list. Two resolvers disagreeing is exactly the defect that ships a search missing a line somebody thought was covered |
| `work.page` | **client (zustand)** ✅ | Genuine viewport state |
| `work.zoom` | **client (zustand)** ✅ | Genuine viewport state |
| `work.follow` (◉ Following / ○ Free) | **client (zustand)** ✅ | Genuine viewport state |
| `ui.palette` | **client (zustand)** ✅ | |
| `ui.modals` | **client (zustand)** ✅ | |
| `ui.filters` | **neither** | Belongs to a browse endpoint that must not exist. See §6 |
| `ui.ordersPage` | **neither** | Client-side pagination of a server census. See §6 |
| `templates.blockWording`, `.naMatrix`, `.drafts` | **server, read-only** — workspace.ts:12-17 | Holding local drafts of a resource with no write endpoint is a screen inventing a state machine, "which is the one thing the rulebook forbids outright" (workspace.ts:16-17) |
| `ORDER_DATA` (one static per-order blob) | **server, split across five queries** | Not one blob: context (intake.ts:301) + census (endpoints.ts:160) + fields (endpoints.ts:169) + pages (endpoints.ts:654) + timeline (endpoints.ts:579) |
| sidebar collapse | **server** — `Preferences` intake.ts:375; `PATCH /api/me/preferences` intake.ts:408 | `INVARIANTS:178-179`: persisted server-side, decision C16, **never `localStorage`**. `INVARIANTS:180`: nothing goes in `localStorage` or `sessionStorage` |

---

## 5. Where the design implies the UI computes something the server must own

Ranked by danger. **Every one is a hard-rule-3 violation** (root `AGENTS.md`: server owns all
state machines and thresholds; UI never computes `state` from confidence, never re-derives
counts, chain termination, or release resolution).

1. **`answeredTotal = D.base + a`, rendered as `verdictBadge: "${d.answeredTotal} of ${D.total} decisions settled"`** (reference-app.html). Browser arithmetic printed as a headline census. `OrderCensus` (endpoints.ts:160) exists **precisely because this was already happening** — endpoints.ts:143-150 states outright that these figures "were being computed in the browser from the `fields` array", that this is "the browser ruling on provenance — a server judgement (hard rule 3) and one the screen could not cite (principle 6)", and that "a count whose definition lives in a component is a count nobody can audit against the pipeline." Take the server's numbers verbatim.

2. **18-dot progress meter** (design README:21). The same number rendered a second way. Design rule 11 says "one variable, never two literals" — the contract says that variable lives on the server, not in the browser.

3. **"Automated-operations rows (count strings derive from order dataset)"** (design README:21, verbatim), **"Sequential stages timeline (6 rows, live counts, all derived per order)"** (design README:23, verbatim), and **"All numbers reconcile with the hub"** (design README:23). Three explicit statements making the client the arithmetic authority. `QueueBand.count` (endpoints.ts:120) and `LifecycleStage.count` are **not `orders.length`** — endpoints.ts:86-93 and endpoints.ts:152-156: the row list is scoped to what the caller may open, the census is not, and "a total that shrank with your permissions reads as work vanishing."

4. **Release-gate checklist + "Sign & Execute Release (transactional gate re-check)"** (design README:25). Design README:33 concedes gates "must be server-enforced in the real build" — and then screen 8 renders the checklist client-side anyway. `INVARIANTS:40`: the UI never re-derives counts, chain termination, **or release resolution**. Render the server's gate object or render nothing.

5. **Countersign "blocked unless QC user"** (design README:24) and **"determination buttons role-gated (disabled + 'belongs to QC — with R. Menon' for others)"** (design README:27). Design rule 13 gets the mechanism right (enforce with a 409, not button state) but README:24 and :27 describe **button state**. Compounding this: `INVARIANTS:123` says a role-locked affordance is **ABSENT, not disabled**, and `INVARIANTS:124` says doors outside the role's world are **ABSENT, not dimmed** — directly contradicting design rule 12. Contract wins. (Flagged for an owner ruling — see §6.)

6. **"pending values amber-dashed and clickable"** on the certificate (design README:25). If that dash is keyed off `value === null`, it violates `INVARIANTS:38` (`needs_review` is NEVER derived from `value === null`) and `INVARIANTS:112-113` in one stroke. It must key off `state` + `na_reason`, and must distinguish all **five** renders (four `NaReason` members plus not-yet-extracted).

7. **`autoVerified: 114`, `cited: 128`, `autoCleared: 12`, `flagged: 18`** in `ORDER_DATA` (reference-app.html). `cited` is **provenance arithmetic** — exactly the `no_source` case that endpoints.ts:144-150 was written to remove, where the strip filtered for `value !== null && source_doc_id === null && source_page === null && readings.length === 0` and printed the result as a headline number.

8. **"Pagination 10/page"** (design README:20). Client-side slicing of a server census.

9. **"sections sorted flagged-first (toggle)"** (design README:24), backed by `flagged = NEED.i…` (reference-app.html). If `flagged` is client-computed, the reviewer's walk order is browser-decided. `INVARIANTS:92-93`: field navigation visits **ONLY server-queued fields** — a reviewer cannot walk into auto-confirmed fields.

10. **"Optical Profile card (DPI, clerk stamp located, contrast floor)"** (design README:22). A quality **threshold** rendered as pass/fail. Thresholds are server-owned (enums.ts:5-7; CONTEXT §7).

11. **"dark terminal (streams log lines with the run)"** (design README:23). Probe-adjacent pipeline visibility. entities.ts:17-19: "No Probe schema. Probes are never visible in any client (CONTEXT §14). They must not exist in the contract a screen could consume."

12. **"Quarantine Gateway checklist (AV → real-PDF → SHA-256 de-dup, sequential with pulsing dot, 'queued/checking…/clear')"** (design README:22). A four-step state machine with no server shape. Also `INVARIANTS:60-61`: an incomplete upload renders **the server's** missing-field list verbatim; the client does not author the list. The design authors the list.

13. **"rulebook banner (amber until quarantine passes, then green with 3 layer chips)"** (design README:22). A gating colour computed from a client-run checklist.

14. **"Sign button disabled-with-reason until ready"** (design README:22). "Ready" is a server resolution. Also collides with `INVARIANTS:131`: acceptance is explicit — an upload alone never queues an order — which the design's single Sign button blurs.

---

## 6. The design CONFLICT, quoted, with the contract lines it conflicts with

### The design text

From `design_handoff_titlepipe/README.md:20`:

> **3. All Orders** — search (field:value syntax + suggestions), filter tabs in 10px/4px/6px
> segmented control, table: Ref (mono grey) / Address (16px w600) / Client / Stage / Assigned /
> Due (right, mono). One signal per row. Pagination 10/page. Empty state with Clear search. Row
> actions: audit-history modal, Open →.

And from `design_handoff_titlepipe/README.md:14`, the order bar:

> shows ref (mono, 18px), address, product pill, **SLA chip**, primary action button, and 5 stage tabs

### What it conflicts with

**`docs/INVARIANTS.md:82-83`:**

> 22. The queue is a **single server-chosen next order** — no list, no browsing, **no
>     cherry-picking**.

**`docs/INVARIANTS.md:84-85`:**

> 23. **No pace indicators, no throughput language, no timers, and no time ESTIMATES** — an
>     estimate is a pace indicator.

**`packages/contract/src/endpoints.ts:69`:**

> `/** GET /api/queue/next — server-ordered; there is no browse/pick endpoint. */`

**`packages/contract/src/endpoints.ts:77-82`:**

> `GET /api/queue/bands` — READ SHAPES ONLY, and deliberately NOT a browse endpoint. None of
> these rows carries a way to TAKE the work: there is no claim token, no assignment field, no
> ordering the caller can influence. `/api/queue/next` remains the only hand-over, so §4.4's
> "no queue cherry-picking" holds by construction rather than by the screen's restraint.

### Why it is irreconcilable

Screen 3 requires exactly the four things the contract removed **by construction**:

1. an orderable list of orders,
2. a caller-influenced ordering (search + filter tabs),
3. a way to take a specific row (`Open →`),
4. an `Assigned` column.

The `Due` column and the SLA chip are **separately** barred by `INVARIANTS:84-85`.

### Handling

Per **`docs/INVARIANTS.md:26-27`**:

> If a rule cannot be satisfied by a proposed design, that is a **`CONFLICT` in the design**,
> not a stale requirement. Stop and report it. Do not weaken the rule to fit the screen.

**Stopped and reported. No route created; no weakened variant proposed.** This requires an owner
ruling. It interacts with **open ruling Q11** (endpoints.ts:99-102), which asks whether the Mine
band may be drawn at all — that question already sits against "exactly one order, no list."

### A second, smaller collision needing a ruling

Design rule 12 (`claude-design-rules.md:15`):

> Roles gate actions server-side and visibly: blocked actions render disabled with the rule, not hidden.

against **`docs/INVARIANTS.md:123`**:

> 42. A role-locked affordance is **ABSENT, not disabled.**

and **`docs/INVARIANTS.md:124`**:

> 43. Doors outside the role's world are **ABSENT, not dimmed.**

Contract-wins was applied. But disabled-with-reason is load-bearing across screens 5, 7, 8 and
10, so this should be confirmed by a person rather than inherited from this analysis.

---

## 7. The three backend conversations blocking screens 5 / 7 / 8 / 9

### Conversation 1 — T1 second read and countersign. Blocks screens 7, 8, 9.

**What the design needs.** Design README:24: a second-read panel appearing after all rulings,
showing three T1 rows plus a countersign action, "blocked unless QC user; 'Switch user: R. Menon
(QC)'." Design rule 13 (`claude-design-rules.md:16`): "a T1 countersign must come from a
different user than the ruling examiner (enforce with a 409, not button state)." Design
README:33 lists it as a release gate: release requires "T1 countersign by different user." T1
pills appear on ruinous field rows on the workstation.

**What the contract has.** Nothing. There is no second-read entity, no countersign endpoint, no
T1 concept, no `countersigned_by` on `Field` (entities.ts:90-150 is the exhaustive shape), and
no such action anywhere in `PERMISSIONS` (authz.ts:59-118). `Field.approved_by` /
`Field.approved_at` (entities.ts:104-105) describe a **single** approver, not a pair.

**The near-miss that must not be used as a substitute.** `Reconciliation` (entities.ts:202-214)
carries `value_a`, `value_b`, `ruling_value`, `citation`, `reason`, `ruled_by`,
`general_rule_id`, with `POST /api/reconciliation/{order}` (endpoints.ts:319). This is a
genuinely different mechanism: two **blind typists** independently capture (`TypistSeat` A/B,
enums.ts:69; `BlindEntryInput` entities.ts:289), their disagreements surface, and a **senior**
rules with a required citation (endpoints.ts:315-318: "a ruling with no source is an opinion").
It is a **capture-quality** mechanism. The design's T1 is a **post-ruling QC countersign** on the
examiner's output. Binding one to the other would silently redefine what the blind protocol
measures — and blindness is enforced server-side and verified by a security test, not a UI test
(endpoints.ts:290-294).

**Questions for the backend owner.**
- Is T1 a real upstream concept, or is it the design's rendering of reconciliation?
- If real: what entity carries it? What is the endpoint?
- What is the 409 body when the same user attempts to countersign their own rulings? (`INVARIANTS:65-66`: a 409 is an ANSWER — the message surfaces verbatim, selection never advances, the field repaints as the server has it.)
- Does it attach to a field or to an order?
- What role holds it — `senior`, or a new role? Note that adding a role touches `ROLES` (authz.ts:31-38), which is compile-time frozen with `as const satisfies` (authz.ts:118), and `rulesFor` (authz.ts) projects per role.
- Does it need a new `PERMISSIONS` row, and with what `when` guard?

**Consequence if unresolved.** Screen 7's second-read panel, screen 8's release gate, and screen
9's countersign record are all unbuildable. A countersign concept with no contract surface is
`OPEN`, and per root `AGENTS.md`: **do not build past `OPEN`.**

---

### Conversation 2 — release compile, gate, sign-and-execute, and reissue. Blocks screens 8 and 9.

**What the design needs.**

Screen 8 (design README:25): a Publication Manifest with per-block include/omit toggles; a
release-gate checklist; certificate wording that "interpolates the template expression with ruled
values"; a compiled-payload JSON modal; a PDF locked until release; a footer whose "gate label
links to blocker"; and "Sign & Execute Release (transactional gate re-check)". Watermarks: `DRAFT
— NOT RELEASED`, `REISSUE DRAFT — v2`, `INTERNAL — NOT FOR CLIENT`.

Screen 9 (design README:26): Certified Deliverables with artifact rows and a SHA chip; a
Transmission Receipt with four timestamped steps (signed → hash → transmitted → acked); a Version
Ledger where v1 is immutable and v2 is a draft carrying a reason, statuses flipping on v2 release
and v1 becoming "Superseded · retained"; and a one-way Reissue Gateway with radio-button reasons
that closes after v2.

**What the contract has.** `Report` (entities.ts:216-223): `id`, `order_id`, `version`, `shape`,
`rendered_at` — five fields. `Delivery` (entities.ts:226-235): `report_id`, `method`, `status`,
`attempted_at`, `delivered_at`, `evidence`, with the note that a failed delivery is a **transit**
state, retryable, never a quality state (entities.ts:225). `DeliveryWithReport`
(endpoints.ts:617) and `DeliveriesResponse` (endpoints.ts:625), the latter noting both v1 and v2
rows appear because "the pair is the defect record" (endpoints.ts:615-616).
`OrderSignoffResponse` (intake.ts:64) for the sign-off lines. `delivery.retry` (authz.ts:118) is
the **only** delivery mutation in the entire permission table.

**What is missing, specifically.**
- **No compile endpoint.** Nothing turns fields + template into a report payload.
- **No gate-evaluation shape.** Nothing returns "these blockers remain", so the release-gate checklist has no source and screen 8's "gate label links to blocker" has nothing to link to.
- **No sign-and-execute endpoint**, and no `release.execute` action in `PERMISSIONS` (authz.ts:59-118).
- **No manifest / block model**, so the include/omit toggles write nowhere — and if manifests are real, "immutable v1" means something different than the design assumes.
- **No reissue endpoint**, and no `Report.reason` or `Report.supersedes` field, so the v2 draft reason has nowhere to live. Design README:33: "reissue requires reason" — nothing carries it.
- **`DeliveryStatus` is `z.string()`** (enums.ts:118), explicitly OPEN until the Flask models are ported (enums.ts:112-115), so the four receipt steps cannot yet be named.
- **No artifact / SHA shape** for the Certified Deliverables list or its SHA chip.

**Questions for the backend owner.**
- Is release one transactional endpoint, or compile-then-execute as two?
- What does the gate return when it refuses, and does it return the blocker list the UI must render **verbatim**? (`INVARIANTS:58-59`: a refused mutation surfaces the server's message verbatim; the client never authors the refusal text.)
- Where does the reissue reason live — on `Report`, or a new entity?
- What are the real `DeliveryStatus` members (enums.ts:118)?
- Is the manifest include/omit a real server concept or a design flourish?
- Who may execute a release? Does that need a new `PERMISSIONS` row alongside `delivery.retry` (authz.ts:118)?
- Where does the deliverable SHA surface as structured data?

**Consequence if unresolved.** Screen 8 is unbuildable beyond a static certificate render.
Screen 9 can render `DeliveriesResponse` (endpoints.ts:625) and `Report.version`
(entities.ts:219) and nothing else — no receipt, no reissue, no ledger status flip.

---

### Conversation 3 — quarantine gateway and optical profile. Blocks screen 5.

**What the design needs.** Design README:22: a dropzone producing a file row, then a Quarantine
Gateway checklist running AV → real-PDF → SHA-256 de-dup **sequentially** with per-step states
("queued" / "checking…" / "clear") and a pulsing dot; then a sha256 line and an Optical Profile
card reporting DPI, whether the clerk stamp was located, and a contrast floor; a page count and
jurisdiction rendered read-only and labelled "read from clerk stamp"; a rulebook banner amber
until quarantine passes then green with three layer chips; and a Sign button disabled-with-reason
until ready.

**What the contract has.** `CreateOrderRequest` (endpoints.ts:39), multipart with a `package`
file (endpoints.ts:57). `IngestRejection` (endpoints.ts:49) — "an incomplete package is rejected
naming the missing fields — never silently" (endpoints.ts:48). `CreateOrderResponse`
(endpoints.ts:62), explicitly a "provisional minimal shape (order only) until the FastAPI port
fixes it", with duplicates surfacing as a 409 carrying the server's message (endpoints.ts:58-60).
`POST /api/orders/{id}/accept` (endpoints.ts:60) as a separate, explicit step. `Order.pages`
nullable (entities.ts:60). `Order.jurisdiction`, `.state`, `.county` (entities.ts:36-38).

**What is missing.**
- **No quarantine-step shape at all** — three named checks with three states each, and nothing carries them.
- **No sha256 field on any response**, despite `INVARIANTS:132` requiring that a duplicate package surface the server's sha256-match notice. Today it arrives only as free text inside a 409 body.
- **No optical-profile shape**: DPI, clerk-stamp-located, and contrast floor are three quality measurements with no home in the contract.
- **No "rulebook layers" shape** for the three chips.
- **No readiness signal** for the Sign button.

**The invariant pressure.**
- `INVARIANTS:60-61`: an incomplete upload renders **the server's** missing-field list verbatim; the client does not author the list. The design's checklist authors its own list of three checks.
- `INVARIANTS:131`: acceptance is explicit — an upload alone never queues an order — which the design's single Sign button blurs.
- `INVARIANTS:132`: a duplicate package surfaces the server's sha256-match notice, which needs a sha256 surface that does not currently exist as data.

**Questions for the backend owner.**
- Does quarantine exist upstream as a **staged process the client can observe**, or is it internal with a single pass/fail outcome?
- If observable: what are the step names and states, and are they **server-authored strings**? The `LifecycleStamp.label` argument (intake.ts:275) says they must be — a client-side `Record<StepId, string>` is a second copy of product copy that drifts silently from the first.
- Where does sha256 surface as **data** rather than prose?
- Is the optical profile a real artifact of the ingest pipeline? If so, is exposing it probe visibility under CONTEXT §14 (entities.ts:17-19)?

**Consequence if unresolved.** Screen 5's entire left column is unbacked. The right column
(client / product / order#, page count, jurisdiction) binds cleanly to `CreateOrderRequest`
(endpoints.ts:39) and `Order` (entities.ts:32) today and can proceed.

---

## 8. Two further blockers — not backend conversations, but they gate work

**Ratification.** The following are all marked **⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION**
(2026-07-30 / 07-31, fidelity Wave 2). Screens 2, 4 and 7 lean on them. Confirm ratification
before binding UI to them:

| Shape | Line | Screen that needs it |
|---|---|---|
| `OrderCensus` | endpoints.ts:139-160 | 4 (verdict card, progress meter) |
| `QueueBandsResponse` / `QueueBand` / `QueueBandOrder` | endpoints.ts:76-136 | 2, 3 |
| `Order.product`, `Order.period_label`, `Order.pages` | entities.ts:40-60 | 2, 4, 5 |
| `Field.asking`, `Field.why` | entities.ts:125-149 | 7 (decision card) |

**Open ruling Q11** (endpoints.ts:99-102): whether the Mine queue band may be **drawn at all**,
sitting against "exactly one order, no list". This gates screen 2's recent-orders table as well
as screen 3.

---

## 9. Bottom line

- **Nine missed screens, zero dead contract surface.** The blind-capture, reconciliation, golden / seed-correction, bench / leaderboard / routing, complaints, and bugs worlds all have doors in `authz.ts:62-81` and no design at all.
- **Three backend conversations block screens 5, 7, 8 and 9.** Building UI past these is building past `OPEN`.
- **One design `CONFLICT`, escalated rather than absorbed:** screen 3's browsable, searchable, paginated order table plus the SLA / Due chips, against `INVARIANTS:82-85`.
- **The dangerous class is real and already present in the prototype:** `answeredTotal = D.base + a` renders "N of M decisions settled" — the exact browser-side census that `OrderCensus` (endpoints.ts:160) was written to take away.
- **One rule collision worth an owner ruling:** design rule 12 (disabled-with-reason) against `INVARIANTS:123-124` (absent, not dimmed). Contract-wins was applied, but the pattern is load-bearing across four screens.

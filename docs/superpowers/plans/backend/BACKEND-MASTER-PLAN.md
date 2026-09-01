# TitlePipe backend — master plan

> **Written 2026-09-01 by the lead, from measurement rather than from the
> documents' account of themselves.** Every number here was produced by running
> a command; where something could not be verified, it says so.
>
> Read `00-HOW-TO-EXECUTE.md` first — it wins on process, this file wins on
> content. Read the eight companion measurement documents for the evidence
> behind any claim below; they are cited inline.

**What this plan is for.** The frontend is complete: 15 screens, 390 unit
tests, 81 passing e2e invariants, and `packages/mocks/src/` — 5,453 lines that
are the de-facto specification of a server nobody has written. This plan
sequences writing it.

**The exit criterion, stated once.** *Backend done* means **the mock can be
switched off and the invariants still pass.* Not "the endpoints return 200".

---

## 0. Where we actually are

| measure | value | source |
|---|---|---|
| endpoints the live frontend calls | 44 | `LEAD-MEASUREMENTS §1` |
| endpoints the backend serves | **1** (`GET /api/rules`) | `STATE-AUDIT` |
| real build target after dead surface removed | **~47** | `ENDPOINT-RECONCILIATION` |
| database columns that exist | 31 | `SCHEMA-GAP` |
| database columns the contract needs | ≥141 | `SCHEMA-GAP` |
| tables missing entirely | 10 (contract) + 4 more (domain) | `SCHEMA-GAP`, `PIPELINE-RESEARCH §5` |
| backend tests passing | 249 | `STATE-AUDIT` |
| core-api lines that are the one domain feature | 504 of 3,520 (**15%**) | `STATE-AUDIT` |

**Read the 15% correctly.** The other 85% is the tenant seam, the forced-RLS
proof, redaction, the error envelope and the structural gate — much of it the
WISP (`COMPLIANCE-RESEARCH`). It is the reason endpoint #1 can be trusted, and
it means **the marginal cost of endpoint #2 is far below the cost of endpoint
#1.** Do not schedule from "one endpoint took two plans."

---

## 🔴 HUMAN GATES — six open, and they do not block equally

Per `00-HOW-TO-EXECUTE §5`: stop at these; do not pick a side.

| # | gate | blocks | why it cannot be inferred |
|---|---|---|---|
| **G1** | **Q12 — is the queue a single card or a workspace?** | Plan 06 entirely; the shape of the queue endpoint family | INVARIANT 22 is *"a single server-chosen next order — no browsing, no cherry-picking."* All Orders is a browse table — *"the opposite affordance"*. Replacing one with the other **removes the surface that enforced the invariant**. `CONFLICT-deleted-queue-and-rail-controls.md` |
| **G2** | **can this machine get the prototype archive and the reference packages?** | the Gate 6 port, the six-engine bake-off | `verify_archive.py` → `archive not found`; the manifest gives a `%LOCALAPPDATA%` path and this host is Linux. Compounded by an unmade owner decision on whether the source may enter VCS at all, since its tests embed real party names |
| **G3** | **Plan 03's four identity gates** | Plan 03 | WorkOS credentials; does `/api/rules` need a session; 401 vs 403 for an absent one; revocation latency. `03-identity.md` |
| **G4** | **Q16 — is MFA a server gate or a banner?** | Plan 03 scope | The People screen says *"this is a production gate"*; the word implies enforcement, and only the server can enforce it |
| **G5** | **Q17 — does `GET/PATCH /api/me/preferences` land?** | one small endpoint | `sidebar.spec.ts:88` asserts collapse survives reload; browser storage is forbidden by §9.11 and rejected by `check-rules` |
| **G6** | **may `responsive-frame.spec` drop its 1024 and 900 widths?** | 7 red e2e tests | The design README, `styles.css:35` and the reference app's own CSS all declare a **1360px floor**; the spec asserts the app works 460px below it. `CONFLICT-...§4` recommends dropping the two below-floor widths but did not apply it, because narrowing a spec unilaterally is forbidden |

**G1 is the expensive one.** G5 is a half-day and G6 is one line. G2 is
logistics, not judgement, and it gates two P0 items at once — worth asking
first because it has the longest lead time.

**Note what G6 and G1 have in common.** Both are cases where a *test* fails and
the *design* is right, and in both the team deliberately left the red rather
than edit an assertion. That is the brief working as intended: *"never weaken a
test assertion; if a screen cannot be built without it, that is a CONFLICT."*
A red suite here is a record, not a defect list. Read
`docs/frontend/design-2026-08/CONFLICT-*.md` before touching any failing spec.

### Already ruled — do not re-open

- **The NA enum is settled.** Four states, owner-ratified 2026-07-26
  (`decisions.md` D3). Migration `0001` is **consistent with the ruling**, not
  the uncited invention `HANDOFF §2a` calls it. `HANDOFF` is stale here.
  (I got this wrong once; see `DECISION-REGISTER`.)
- **Escalation resolution requires a rule** (D1). Unchanged.
- **Auth is WorkOS, not Clerk** — ADR-0001. `CONTEXT §15` is stale, including
  `users(... clerk_id)` in the data model.

---

## 1. Sequence

Each plan states its **entry gate**, the **interface it exposes**, and its
**anti-vacuity injection** — per `00-HOW-TO-EXECUTE §1.1`, a proof needs a
positive control that *fails when the mechanism is removed*. Denial-only
assertions pass against a system that denies everybody everything.

### Plan 03 — identity *(drafted, blocked on G3/G4)*

Already written. Ships a real session, a real principal, server-evaluated
authz; retires three holes that **grant admin on a missing header**.

Note the mock is currently *safer than the server*: it refuses an
unidentified countersigner because *"an unidentified actor cannot PROVE a
second pair of eyes"*. So G3's direction is settled by behaviour even though
the status code is open — **absent identity is a refusal, never a grant**
(`MSW-BEHAVIOUR-HARVEST §3`).

- **Exposes:** `Principal`, the authz evaluator, `GET /api/me/permissions`.
- **Injection:** delete the role check; INVARIANT 40 must fail — the role gate
  runs **before** validation, so `reviewer` gets 403 and `engineer` 422 on the
  *same invalid body* (`authz.spec.ts:17`). A test that only checks 403 on a
  *valid* body would pass with the ordering reversed.

### Plan 04 — the real data model

The largest single piece of unbuilt work and the one everything else consumes.

- **Entry gate:** none beyond Plan 03 (tenancy needs a principal).
- **Ships:** `orders` +10 columns, `fields` +17, `field_readings` +6, plus
  `documents` (with `segmentation_state` — **assemble cannot run without it**),
  `escalations`, `reports`, `deliveries`, `engines`, `engine_routing`,
  `engine_runs`, `blind_entries`, `bugs`, `probes`, `users`, `clients`. FKs and
  indexes throughout.
- **The trap, already measured:** every migration here runs **under forced
  RLS**, where a data migration that forgets `SET LOCAL row_security = off`
  **does nothing and reports success** — `UPDATE 0`, no error, exit 0
  (`0001_skeleton.py:22-40`).
- **Injection:** remove `SET LOCAL row_security = off` from a data migration;
  a test must fail. If nothing fails, the suite cannot tell a migration that
  worked from one that silently did nothing.
- **Note:** `probes` gets a table and **no UI surface** — probe visibility is a
  named anti-pattern.

### Plan 05 — ingest and the object store

- **Entry gate:** Plan 04.
- **Ships:** `POST /api/orders` (multipart), `POST /api/intake/quarantine`,
  `/accept`, sha256 duplicate detection, `GET /api/orders/{id}/pages`, storage
  at **a configured absolute path outside the working tree** (`/data/` is the
  gitignored dev default; the 644 MB incident is why).
- **Invariants:** 47 (acceptance is explicit — an upload alone never queues an
  order), 48 (duplicate surfaces the server's sha256-match notice), 15 (the
  server authors the missing-field list; the client never composes it).
- **Injection:** feed a byte-identical package twice; without the sha256 check
  the second must **not** be accepted silently.

### Plan 06 — review workflow ⚠ **blocked on G1**

The heart of the product, and the plan whose shape the owner decides.

- **Ships:** `GET /api/orders/{id}/fields`, confirm / correct / escalate /
  exclude / countersign, `GET /api/queue/next`, pass with reason,
  `GET /api/escalations`, `POST /api/escalations/{id}/resolve`.
- **The refusal sentences are the contract**, verbatim, because the UI renders
  the server's sentence uncomposed. Twelve of them are recorded in
  `MSW-BEHAVIOUR-HARVEST §2`.
- **Two idempotency semantics, and they are not in conflict** — confirm is
  idempotent on an identical value (200/200) and conflicts on a different one
  (409) per INVARIANT 18; release and countersign **file once** and refuse the
  second attempt at 409. Different acts, different rules. Do not unify them.
- **Injections:** (a) three confirms in one tick must file **one** record
  (INVARIANT 20 — a disabled control is not enforcement); (b) resolve an
  escalation without a rule — it must be **refused** (INVARIANT 36, and D1
  re-ratified it); (c) a drafted rule must land `PENDING` and be **visibly
  inert** (38).

### Plan 07 — extraction ⚠ **precondition: the subprocessor file**

- **Entry gate:** Plans 04–05, **plus the AI subprocessor due-diligence file**.
  Sending a page carrying a DOB to Gemini or Claude is a subprocessor
  disclosure requiring zero-retention tiers (`CONTEXT.md:492`). This is a
  precondition, not a parallel chore.
- **No design phase.** `CONTEXT §8` specifies adapters to signature level:
  ≤300 lines, cost and latency per call, **engines never see each other's
  output**, capabilities declared not faked, and `RuleContext` **generated from
  the rulebook** — no per-engine prompt surgery.
- **Ships:** the queue (Procrastinate is the recorded choice and is **pinned
  nowhere today**), worker topology, the adapter interface, the cost ledger,
  the ensemble router, `POST /api/orders/{id}/pipeline/replay`.
- **Structural constraint:** extract is queue-based, **never
  request/response**; the web tier never does minutes-long work.
- **Injection:** feed engine A's output to engine B; an independence test must
  fail. Agreement between two engines that can see each other is not evidence.

### Plan 08 — assemble ⚠ **the underestimated one**

`CONTEXT.md:74` says it in advance and it is quoted here so it is not
rediscovered: *"Assemble is the expensive stage. Budget it as its own stage
with its own tests. Do not let it hide inside 'extraction.'"*

Extracting `$220,224.00` from a scan is solved. Knowing that the 2011
assignment attaches to the 2008 DOT and not the 2015 subordinate one is
relational reasoning across documents, and it is where reviewers find errors.

- **Entry gate:** Plan 07, **and G2** — this is where validators v1–v14, the
  chain terminator, MERS handling, release resolution and the five bug fixes
  land, and that source is not on this host.
- **Carries R13–R24.** R15 especially: **liens survive an arm's-length sale**;
  chain termination sets search depth, never lien disposition; **audit required
  on any suppression path** (a P0 task). `excluded_reason` is the only
  auditable trace of a suppressed row.
- **v99 stays deliberately empty** — land+building is never checked against
  total.
- **Injection:** suppress a lien without a verified release; v14 must fail.

### Plan 09 — render and deliver

- **Ships:** Shape A DOCX (`docxtpl` + programmatic), `reports`, deliveries,
  the four-step transmission sequence, reissue, retry.
- **Domain traps that are renderer behaviour, not data:** Georgia security
  deeds have **no trustee** — the line is *deleted*, not blanked; feed the same
  renderer a California DOT and it reappears. CONDO lines are *rewritten*, not
  filled. Section headings come from the instrument's own caption.
- **Injection:** a `draft` delivery must refuse retry — retrying one would
  *"transmit around the signature act"*.

### Plan 10 — measured quality and the switch-off

- **Ships:** `golden_fields`, blind-fifty capture with **server-enforced
  blindness**, reconciliation, probes, the leaderboard.
- **The unusual obligation:** the API must be able to **decline to answer**.
  `LeaderboardCell.no_truth_yet` renders `NO TRUTH YET` below golden coverage
  rather than a misleading average, and **no aggregate headline accuracy
  number** is permitted anywhere.
- **Exit:** turn MSW off. The 81 invariants must still pass. That is the whole
  plan's acceptance test.

---

## 2. What is deliberately NOT built

Thirteen endpoints serve the nine screens deleted in `7f04340`
(`ENDPOINT-RECONCILIATION §a`): Golden Set, Reconciliation, Bench, Complaints,
Ops Dashboard, Leaderboard. **Do not build them** without a ruling that the
screens are returning.

But note the asymmetry, which is a product question rather than a build one:
the Blind Fifty *seat* was **not** deleted — `/blind/$orderId` still routes —
while the Reconciliation screen that consumes its output was. The programme
still produces blind entries with nowhere to reconcile them. Plan 10 has to
know which way that resolves.

Three endpoints look dead and are **load-bearing**: `POST /api/engines/routing`
has no UI caller and is the only endpoint through which INVARIANT 40 is proven.
Deleting it deletes the proof.

---

## 3. Compliance debt, carried explicitly

Built and good: shared redaction (running **last**, because processors after it
build new fields), the append-only audit trigger (`FOR EACH STATEMENT`, because
a row trigger never fires when a statement affects zero rows — exactly the
cross-tenant case it exists to refuse), forced RLS with five
`NOSUPERUSER NOBYPASSRLS` roles, non-root containers, a whole-tree client-data
guard.

Owed: field-level envelope encryption (DOB, bankruptcy), per-tenant retention
windows and secure deletion, MFA (G4), the subprocessor file (Plan 07's
precondition), delivery digests, no-NPI-in-URLs enforcement.

---

## 4. Two things to fix before any of this

1. **CI has never run on `frontend/rebuild-2026-08`.** The last recorded run on
   `main` was a failure on 2026-08-26. A plan whose gates are CI jobs needs CI
   running first.
2. **The e2e suite is 52 red, and none of it is unattended.** ~26 are G1's
   conflict, deliberately left failing as the record of an unmade decision.
   The **~7 responsive-frame failures are a *fourth* recorded conflict**, not a
   loose defect: `CONFLICT-deleted-queue-and-rail-controls.md §4` measured them
   on 2026-08-28 and found the spec wrong rather than the app. The design
   README, `styles.css:35` and **the reference app's own exported CSS** all
   state a 1360px floor; the spec asserts the app works 460px below it. Both
   landed in the same 2026-08-27 import.

   The write-up carries a recommendation deliberately **not applied**: drop
   1024 and 900 from the width list, keep 1440 and 1280 as genuine regression
   guards above the floor. It was left undone because *"narrowing a spec's
   range is exactly the kind of edit the brief forbids doing unilaterally."*
   It needs a one-line ruling (**G6**), not a fix.

   I initially recorded this group as a fixable defect. That was wrong, and
   the error is instructive: the app measures `scrollWidth 1360` **constant
   across all twelve screens**, which is the signature of a declared floor
   rather than of content overflowing. A per-screen defect would vary.

Also: an orphaned `vite preview` on port 4274 silently serves a **stale build**
to the next run and produced a bogus `61 failed` for me. Check
`ss -lptn 'sport = :4274'` before believing any e2e result.

---

## 5. Honest uncertainty

- **Plan 08 is the least-known work in this document.** It depends on source I
  could not read (G2). Its task list will be wrong until someone reads
  `assemble.py`. Treat its sequencing as firm and its contents as provisional.
- **`OrderStatus` cannot be closed as specified.** `enums.ts:94` refuses to
  close it *"until the Flask models (the source of truth) are ported"* — and
  those models are unreadable from here. The mock meanwhile emits a seven-stage
  board. Something has to give, and it is G2 or an owner ruling.
- **The ~47 figure is a floor.** It counts what the frontend calls. Internal
  endpoints — worker callbacks, engine registry management — are not in it.
- I did not verify the swarm's per-area findings line by line; the eight
  companion documents record what **I** ran.

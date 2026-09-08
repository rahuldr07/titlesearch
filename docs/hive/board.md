# TitlePipe board

_Shared plans live here. The god agent is the sole scribe; others `propose` edits._

## This floor
**Project:** TitlePipe — `/home/rahul/projects/titlesearch`
**Hive root:** `/home/rahul/TitleSearchAgents/hive`
**Why it is separate:** one hive root = one floor. The app reads exactly one `board.md` and one
`tasks.json` per root, and cards carry no project field — so two projects on one floor means one
mixed kanban, one mixed ASK ME board, and one orchestrator's attention split. DevNotes stays on
`/home/rahul/HarnessAgents/hive`. **These floors do not share anything**: separate boards, separate
task ledgers, separate inboxes, separate gods. Do not write into the DevNotes root.

## Status: DISPATCHED — full floor, 2026-09-04
The human confirmed all 14 hire manifests (`hires/`, spec `munder-difflin/hire@1`) on 2026-09-04, and
on the same day authorised dispatch in their own words: **"do all of it fully dont hold back"**.

All 14 seats are requested via `spawn-requests/` and all 14 cards (TP-1 .. TP-14) are on the ledger.

**Ordering constraints written into the contracts:**
- **Tenali (TP-5) is blocking.** The four builders — Vishwa, Meenakshi, Venkat, Kaveri — may read,
  plan and investigate, but MAY NOT COMMIT until Tenali's verdict on their card reaches them.
- **Kalam (TP-7) runs the baseline first.** The tree starts red (backend CI 7 of 12 jobs; the
  client-data guard red over 81 tracked binaries), so "red before" must be measured, not asserted.
- **The client-data guard has exactly ONE owner: Kaveri.** Vishwa's CI triage explicitly excludes it.
  Contested surface, single owner — the DevNotes lesson.
- **Kaveri deletes nothing without god sign-off.** 81 tracked binaries is destructive work; the
  inventory comes to god as a `request` first.
- **Ramanujan (TP-9) holds.** Refactoring is post-green; he does one cheap read-only knip pass and
  then waits to be released, so he does not burn tokens or create merge conflicts.
- **Aryabhata's gate is MET** — god ran `nvidia-smi -L` on 2026-09-04: `GPU 0: NVIDIA GeForce
  RTX 3060`, visible from Ubuntu. The WSL/GPU precondition in his manifest is satisfied. He reports
  after the 20-worst-pages run and BEFORE the blind fifty, because it is the floor's costliest card.

**Territories are disjoint by contract** (the DevNotes lesson that made three worktree merges
conflict-free): Vishwa = `services/core-api` + typing `scripts/`; Meenakshi = `apps/web`;
Venkat = `packages/contract` + `packages/mocks`; Kaveri = the `/data` boundary + the client-data
guard job. Each contract states what the agent must NOT touch.

## The crew as designed (by michael-mtms15ic, on the DevNotes floor)
**11 standing seats.**
- Build: Vishwa (`services/core-api`), Meenakshi (`apps/web`), Venkat (contract + mocks seam owner),
  Kaveri (data steward, owns the `/data` boundary).
- Quality — **read-only, cannot write product code**: Tenali (pre-implementation judge, holds the
  24-rule rulebook), Mani (diff reviewer), Kalam (QC — reruns real gates, writes evidence entries),
  Chitra (visual QA against the `.dc.html` pixel spec), Ramanujan (post-green refactorer).
- Ops: Kavalan (hourly sentinel — CI/main, gates, fleet, data boundary; **files cards, never fixes**),
  Bharathi (knowledge librarian — HANDOFF, ADRs, memory).

**3 on-demand** (confirm only when needed): Avvai (research), Bobbili (security audit),
Aryabhata (six-engine bake-off, gated on WSL/GPU setup).

Pipeline: plan -> Tenali judges -> builders build in isolated worktrees on disjoint territories ->
Mani reviews the diff -> Ramanujan tightens -> Kalam verifies with evidence -> god integrates.

## The evidence bar — non-negotiable, inherited from DevNotes
`evidence.jsonl` in this root. **An entry is a PRECONDITION for integration: no entry, no merge.**
Every entry carries the exact command and its RAW output, never a summary — a summarised gate is
precisely the failure the gate exists to prevent.

DONE means evidence, not assertion. Specifically: show the failure the fix removes (red-before), and
show it did not redden anything it should not have.

## 2026-09-04 11:5x — FLOOR INCIDENT: invalid model ids (RESOLVED)
Every worker was spawned with reasoning effort baked into the model id (`the model`,
`the model`, …). the harness rejects that — the only valid model suffix is
`[1m]`, and effort is a separate `--effort` flag. Result: nine workers held a session but every turn
died with "There's an issue with the selected model", ~2k tokens each, zero tools called. The floor
looked staffed and was doing nothing.

**Fixed:** effort suffix stripped from 27 files (all `hires/` manifests + every spawn request);
`the model[1m]` left intact because it was always valid. The five workers still dead
(Chitra, Kavalan, Bharathi, Avvai, Bobbili) were verified at zero real turns, stopped, and re-issued
as 15-19 on clean models. Tenali, Venkat, Kaveri and Mani were left running — the owner had already
rescued them by hand with `/model`, and they hold real work.

**Also re-issued** because their cards were `doing` with no live owner: 20-vishwa (previous run reaped
at 2.1M against a 2M cap; cap now 10M) and 21-meenakshi (cap 10M).

**RULING on TP-2 (Tenali asked for it and was right to):** "the Queue screen" is the `/orders`
single-order hand-over surface fed by `/api/queue/next` — NOT a browse/pick table and NOT a revival of
the removed `/queue` route. The design prototype's isQueue screen ("Orders Overview" — Open->,
Assigned, Due, SLA chip, one collapsed 1-5 rail) is forbidden: INVARIANT 22 (no cherry-picking),
INVARIANT 23 (SLA unresolved), ANALYSIS-screens §3 (no collapsed state machines). Shipped to
Meenakshi inside her re-spawn contract.

**Standing rule for every future spawn:** `model` is a bare id — `the model`, `the model`,
or a `[1m]` variant. Never append an effort level. A spawn request has no `effort` field, so effort
cannot be requested this way at all.

## 2026-09-04 — TP-11 DONE (Bharathi) + rulings
Doc-truth audit landed: 5 contradictions, each tied to a primary source, nothing fixed (inventory-only
contract — and that split paid off, because citations meant I could rule on all five in one pass).
Rulings: the built schema beats PRD §7's per-table lists; PRD §9/WorkOS beats §7's `clerk_id` (real
column name stays OPEN — no users table exists, so nobody invents one); `package.json` beats HANDOFF §5's
frontend stack lines; HANDOFF beats CONTEXT — the R15 audit is CLOSED; and the 2026-09-03 frontend delta
gets both an INDEX.md row and a HANDOFF.md pointer. TP-15 dispatched to apply them (docs only).

**Ownerless cards swept:** Kalam (TP-7) and Bharathi (TP-15) had both archived themselves, so their cards
had no live owner. Requeued as 22-kalam and 23-bharathi, each carrying its contract in the spawn
objective — a message to an archived worker is never delivered, so the contract has to ride in the spawn.
Queue is now 19-bobbili, 20-vishwa, 21-meenakshi, 22-kalam, 23-bharathi; it drains as slots free
(maxConcurrentWorkers 8, 20-min idle reaper).

## 2026-09-04 — TP-3 seam audit landed (Venkat); five rulings issued
Venkat mapped all 10 Queue endpoints across the three layers. Headline: `services/core-api` has exactly
three routes (`/health`, `/ready`, `/api/rules`), so for the Queue there is no third layer — MSW is the
sole backend, correctly, under ADR-0001's endpoint-by-endpoint migration. He reported that rather than
inventing a layer, and scoped the citation drift as a provenance defect rather than inflating it into a
wire divergence. Both are the standard I want.

**Rulings:** (1) `CorrectFieldRequest.reason` stays optional — the relaxation was a *dated owner
instruction* (2026-09-02), which I don't reverse; re-tighten booked as **TP-16**, blocking first real
delivery, with the question put to the owner. (2) **No AI attribution in commits** anywhere in
titlesearch — the owner's own instruction, stated three times in `docs/prompts/gate-*`; that
closes an open question Venkat had been carrying. (3) Citations go by **symbol, not line range** — a
cross-package line range rots on any edit above it, which is exactly how 8 sites went stale.
(4) F2 + F4 routed to Vishwa, untouched by Venkat. (5) **Four NA states, not two** — root `the repo guide:13`
is the stale line, not the schema; routed to Bharathi as doc-truth finding 6.

Venkat's breaker is back to `healthy` and he is released to run the three gates for Kalam's evidence entry.

## 2026-09-04 — M1: my F1 ruling was wrong; Mani caught it before it landed
I ruled F1=(b) and told Meenakshi the inline row edit was unbuilt. Both wrong. Mani traced the code:
there are TWO correction paths and only one is gated. Pressing `e` refuses a reason-less correction;
**double-clicking a row files one anyway** — stamping `approved_by` and filing a T1 ruling on a legal
record with no reason. The invariant test that exists to catch this is GREEN, because it only drives the
`e` path. The false assurance is the real defect.
**Revised ruling — the sequence IS the ruling:** TP-17 (Meenakshi, P0) closes the double-click path and
adds an invariant that drives it; only then does TP-16 (Venkat) tighten `reason` to `.min(1)`. Tightening
first would 422 a path that works today, which is what the owner's 2026-09-02 instruction protected.
Owner question on TP-16 rewritten in Mani's framing. **Standing lesson: trace a schema to its callers
before ruling on it — a rule enforced on one of two paths reads exactly like a rule enforced.**

## 2026-09-04 — CORRECTION: "81 tracked binaries" was never true
Kaveri measured it: the client-data guard exits **0** over the whole tree, and there are **3** tracked
binaries, all allowlisted with verifying hashes. Nothing to delete. The 81 came from a stale comment in
`.github/workflows/backend.yml` describing a tree commit `670f810` already cleaned — and I had copied that
false premise onto this board from HANDOFF. A doc assertion is not a measurement.
Signed off: fix the stale comment; remove the 4 dead ALLOWLIST entries (removal only tightens the guard);
blind-fifty may not be drawn from n=1 — Kaveri delivers the method, provenance schema and intake list
instead, including a hard refusal to draw on an empty stratum.

## 2026-09-04 — TP-18 (P0): the client-data boundary has no local enforcement
Kavalan's patrol found a real Lincoln County MO package sitting untracked, matched by no `.gitignore` rule,
with **no `pre-commit` hook installed in the worktree** — so a plain `git commit` runs zero client-data
checks and CI only catches it on push. The guard works; nothing runs it. Routed to Kaveri: install and
enforce the hook AND add the ignore pattern. The file itself is not to be deleted.

## Cards closed: TP-9, TP-10, TP-11, TP-12
knip finds zero dead code (0.36% duplication, 4 test-first targets; refactor stays on HOLD until green).
Patrol #1 baseline recorded — CI 7/12 red is all known TP-1 scope, local gates clean; patrol #2 booked as
TP-19. Migration memo lands on `alembic upgrade head` as a discrete pre-app-start release step, disqualifying
entrypoint-migration on privilege separation rather than operational risk; the platform mechanism stays open
because no production platform is chosen yet.

# ============================================================
# 2026-09-04 — FLOOR REDIRECTED: greenfield backend + database redesign
# ============================================================
The owner has redirected the floor: design a NEW backend and database from scratch, driven by the
CURRENT FRONTEND, explicitly unbound by the rules and rulings already on the board.

**The framing, which is the point of the whole dispatch:** apps/web IS the spec. The 24-rule rulebook,
INVARIANTS, ADR-0001 and every prior ruling of mine are not binding — an old decision survives only if it
holds up on engineering merit. But **domain truth still binds**: discard RULES, never discard FACTS ABOUT
THE DOMAIN. Title search has real legal and privacy consequences no redesign gets to wish away.
Design, do not build. Cite by path + symbol. Write UNKNOWN rather than invent.

**Shape — 7 parallel discovery streams -> synthesis -> adversarial review -> sign-off.** Every stream went
to an agent already on the floor whose seat matched; the only spawn was re-issuing Bobbili, who had
archived himself before the dispatch reached him.

| Card | Stream | Owner | Deliverable |
|---|---|---|---|
| RD-1 | Frontend needs, all 16 features | Meenakshi | `discovery-frontend.md` |
| RD-2 | API surface + resource model | Venkat | `discovery-api-surface.md` |
| RD-3 | Current backend: keep/rewrite/bin + stack | Vishwa | `discovery-current-backend.md` |
| RD-4 | Real data + NPI/PII classification | Kaveri | `discovery-data-domain.md` |
| RD-5 | Security, tenancy, audit, authz | Bobbili | `discovery-security.md` |
| RD-6 | Pipeline + engine-output storage | Aryabhata | `discovery-pipeline.md` |
| RD-7 | Domain truth vs discarded rules | Kalam | `discovery-docs.md` |
| RD-8 | **Synthesis — the PLAN** | Tenali | `PLAN.md` (9 sections) |
| RD-9 | **Adversarial review** | Mani | findings to god |

All under `hive/design/backend-2026-09/` — the hive, not the repo, because agents sit in different
worktrees and the architect must read all seven from one place.

Two deliberate choices worth recording. Meenakshi is told **not** to read the PRD or HANDOFF, so her
stream reports what the code needs rather than what the docs claim; Kalam covers the docs separately, and
his real job is the third section — requirements that no screen reveals. Mani is told to build his own
independent read of apps/web while waiting, so he reviews the plan against his evidence rather than
against Tenali's reasoning.

**The stack is genuinely open.** The owner never fixed it and the frontend is a TypeScript monorepo, so
Python/FastAPI is a candidate, not a default. Vishwa argues it in RD-3; Tenali decides in PLAN.md §7.

**Superseded, moved to blocked:** TP-1, TP-3, TP-5, TP-6, TP-7, TP-13, TP-14, TP-16.
**Still alive:** TP-2 and TP-17 (frontend is now the spec, so it matters more), TP-15 (docs), and
**TP-18 — a live NPI safety issue is not superseded by a redesign** and stays ahead of Kaveri's stream.

## RD-0 — STANDING RULE, owner-confirmed: no AI attribution anywhere
"in commits and comments there should be no ai trailing" — no `authorship trailer`, no `session trailer`, no
"tool-generated", no AI references, in commit messages, **code comments**, docs, or any written file.
Ordinary human messages under the existing user identity. This overrides the harness attribution default
inside this repo and hive. Note the widened scope: comments, not only commits. Broadcast to every agent;
three had been carrying it as an open question. Settled.

## 2026-09-04 — two redesign streams lost to token caps with zero output; process fixed
Meenakshi (RD-1) and Aryabhata (RD-6) each burned a full 10M-token cap and were reaped **without writing a
single file**. Both streams produced nothing. Root cause was process, not budget: results were held
in-session to be "written up at the end", and there was no end.

**Hard rule now in every dispatch: write the output file in the first minutes with its headings, then append
after each unit of work.** A half-finished file on disk beats a complete analysis in a dead session — partial
evidence can be synthesised, a dead transcript cannot. Broadcast to all six running streams before they hit
the same wall.

**RD-1 was also too big for one cap and is now split:** Meenakshi takes review, ordersList, overview,
extraction, escalations, delivery, release, overlays; Chitra takes ingest, hub, blind, jurisdiction,
templates, account, signin and the app shell — and pins down what auth the signin screens expect today, which
is the ground truth Bobbili's security stream needs. Tenali now expects eight discovery files, not seven.

## DO-NOT-LOSE list handed to the architect (all verified today, none taken from docs)
1. **Machine-enforced tenant isolation.** The existing RLS is checked against the database's own deparse of
   its policies — a regex anchored around a single-column equality, which cannot match a join. A policy that
   drifts into a join fails the build. Any new tenancy model must name its equivalent machine check.
2. **A missed path must fail loud, not silent.** R2 survives a hypothetical bypass because its field is
   `min(1)` and the bypass would 422. R1 broke because `.optional()` made the bypass *succeed*. That
   asymmetry is the design principle.
3. **Server-driven permissions** — the UI asks the server "may I?" rather than deriving authority locally,
   and absence renders as a visible locked state rather than a hidden control.

## Closed: TP-13, TP-15
Bobbili's RLS audit came back clean and, more valuably, machine-enforced. Bharathi landed all six doc-truth
corrections as five commits on `agent/worker-23-bharathi` (HEAD `9033ba3`), correctly omitting AI trailers
and flagging the harness contradiction rather than silently picking. **Both branches are unmerged and await
integration by me**, alongside `agent/worker-14-aryabhata`.
**Ownerless after the reaps: TP-2 and TP-17** — Meenakshi's respawn carries RD-1a only, and TP-17's
double-click reason bypass is a real defect that must not be lost when the redesign settles.

## 2026-09-04 12:26 — REDESIGN COMPLETE, IN FINISHING
**PLAN.md: 80k, ~950 lines, all nine sections substantive.** ~537k of evidence behind it across ten files.
All nine discovery streams closed (RD-1..RD-7), adversarial review done (RD-9).

**Mani's verdict: substantially sound, no fatal architectural defect.** §5 is the strongest section and the
most consistent application of the name-the-machine principle. Two HIGH findings, five cheap edits.
- **F1** — §1 records field-state terminality as observed fact, but only two of four writers enforce it.
  Escalate then correct returns 200, files a ruling, and leaves an escalation open against a field that is no
  longer escalated. M1's shape exactly: the guard sits on the path a reader checks first. The enforcing machine
  is already in §5; §1 simply doesn't point at it.
- **F1b** — exclude-then-correct yields a row simultaneously suppressed and signed-corrected; correct-then-
  exclude 409s. Same intent, opposite outcome by click order. The plan must pick flag or state.
- **F2** — §4's compile-time-enum claim is true for two enums and false for the ones it names.

**Two of my own premises were corrected by the floor today.** The client-data guard did NOT refuse the real
county package — it accepted it, exit 0 — so the `.gitignore` line I called belt-and-braces was the only
barrier, and `git add -f` walks past it. There was no boundary, only an accident-stopper. And the pre-commit
hook was already installed; worktrees share `.git/hooks`, so one install covers all eleven. Both established by
measurement after I had passed on a second-hand report as fact. That is twice today.

**Retention, from primary law:** a single `retention_days` column cannot be compliant. Texas requires 15 years
on evidence of insurability — TitlePipe's own deliverable — California ≥5 years on WORM media, and GLBA's
2-year disposal duty yields to both. The repo's unsourced "7 years" is dead and must not reach the schema. The
schema needs a record-class taxonomy before any retention field means anything.

The original architect exhausted its context at 34M tokens, so a **finishing architect** has a clean context and
a closed scope: apply the findings, incorporate four late items, finalise §9, and write a two-page executive
summary at the top — an 80k document the owner cannot read is not a delivered plan.

## 2026-09-04 12:36 — standup
**Fleet:** the finishing architect (worker-35) is the only agent working and is healthy at 16% context. The
original architect is stale — 19 minutes idle, breaker constrained, 34.4M tokens — and superseded; left to the
idle reaper, nothing to salvage.

**Board corrected.** Four cards claimed `doing` with no live owner (TP-2, TP-4, TP-8, TP-17 — their owners were
reaped). Moved to `todo`. A board that says `doing` when nobody is doing it is the same false-assurance the
redesign is being designed against, and the ledger will not lie in the direction of looking busy.
Now: **1 doing, 7 blocked, 7 todo, 19 done.**

**TP-17 raised to P0** — it is Mani's F1 in the product rather than in the plan, the same class of bug found
twice in one day, and RD-2 supplies the deeper cause: the correction reason is accepted and then discarded,
because the field entity has no column to hold it. The card and the new design get fixed together.

**PLAN.md is at 126k** and the finishing architect has already delivered both things that were missing: a
**12.9k executive summary at the top**, and **§9 open questions grown from 4.4k to 13.2k**.

**Integration debt: 10 unmerged `agent/*` branches**, seven with live worktrees — the doc-truth corrections, the
CI unblock, the four-Dockerfile fix and the client-data guard rule among them. Mine to integrate once the plan
is signed off; not to grow further in the meantime.

## 2026-09-04 12:52 — integration debt assessed: it is 4 clean merges, not 10 branches
Of 16 `agent/*` branches, ten are **empty** and six carry work, of which two are superseded. Verified with
`git merge-tree` rather than assumed: **all four merge cleanly into main and cleanly with each other**, despite
four of them touching `.github/workflows/backend.yml` — they touch different regions.

**Merge order:** `23-bharathi` (docs, zero overlap) → `14-aryabhata` (bench/, isolated) → `33-vishwa`
(which *contains* `20-vishwa`, making it redundant) → `29-kaveri` (guard rule + realPackage pin).
**Drop:** `20-vishwa` (contained in 33) and `06-kaveri` (divergent duplicate).

**A duplicated-work bug, and it is mine.** Two Kaveri instances did the same guard fix twice on the same four
files, because **a respawned agent gets a new branch name** — so "read your preserved worktree first" could not
find work sitting on the predecessor's branch. Next time the respawn objective names the predecessor's branch
explicitly. Kept `29` over `06` because where `06` deletes the stale comment, `29` rewrites it to keep the
history and cite the verifying command — recording the evidence rather than just the conclusion.

**Not merged.** Merging to `main` is the owner's call; the plan is verified and ready on their word.

---

## RD-8 BUILD PHASE — started 2026-09-04

The plan is done; this is the build. Five workers in parallel on **disjoint file sets**, incremental on
the existing proven tree (PLAN §8 is explicit: a topology collapse plus a schema build-out, NOT a
big-bang rewrite and NOT a new directory).

**The shared contract is `design/backend-2026-09/CONVENTIONS.md`** — pinned by god before dispatch so
five workers derive naming, tenancy, enum, audit, layer and migration rules from ONE source instead of
inventing six. Binding on everyone; PLAN.md wins any disagreement.

| Card | Worker | Slice |
|---|---|---|
| BD-1 | Vishwa (37) | topology collapse → one worker image; shared scaffolding into `libs/`; venv shebang fix |
| BD-2 | Kaveri (38) | record-class taxonomy + `legal_holds`, then the audit-log **writer** |
| BD-3 | Chitra (39) | core domain schema + the intake/product/sign-off layer |
| BD-4 | Venkat (40) | API layer, made repeatable in the `rules.py` idiom |
| BD-5 | Bobbili (41) | `users`/`clients`/roles, provider-agnostic auth seam, RLS coverage assertion |

**Two rulings made to unblock the build rather than wait on the owner:**
- **§9 Q2 → (a) build the intake/sign-off layer, and early.** Not sentiment: the completeness gate sits
  immediately upstream of the most expensive step in the system (~1h51m GPU per 101-page package), so it
  is the only proposed component that pays for itself in compute. Marked BUILT UNDER ASSUMPTION on BD-3
  so the owner can see exactly what reverses if they answer (b).
- **The `rules.py` machinery generalises.** Venkat listed it UNKNOWN whether it was meant to; the
  alternative is seventy endpoints each inventing a boundary.

**Still the owner's, and deliberately not assumed:** the auth provider (RD-10 — no provider SDK gets
installed), the retention windows (the taxonomy is built so only the numbers wait), and field
encryption (gated on a KMS/platform decision).

**Integration is god's:** several workers write migrations at once, so nobody guesses `down_revision` —
each states its assumed parent and god linearizes the chain at merge.

### 🔴 FINDING (Venkat, worker-44, 2026-09-04) — refusal messages silently became status lines under live mode

**This is a product bug, not a build detail, and it is recorded here so it survives whoever fixes it.**

`core-api` composed its error envelope as `{"error": {"message": ...}}` — the sentence nested one level
down. The browser's `apps/web/src/shared/api.ts::readError` reads `body.error` and keeps it only
`if (typeof message === "string" && message.length > 0)`; anything else falls through to
`` `${status} ${statusText}` ``.

So under `VITE_API_MODE=live`, **every refusal this service composed reached the reviewer as
"503 Service Unavailable"** — no throw, no console line, the client silently takes the status-line
branch. `packages/mocks` has always sent the FLAT shape, so the mock and the service disagreed about
the one member the browser actually reads, and both suites stayed green. Cutover was the moment every
rendered reason turned into a status line.

That matters here more than it would elsewhere: refusals are product requirements in this codebase
(R1-R24), so a refusal that cannot state its reason is the feature failing quietly.

**Fix:** flatten the envelope — `error` is the sentence; `code`, `request_id` and `details` ride as
SIBLINGS rather than being folded in, because dropping them to satisfy the string would trade a silent
render bug for a silent diagnosis one. **The machine:** `tests/test_error_contract_parity.py` over the
committed `contract-fixtures/error-envelope.json`, asserting the browser predicate itself rather than
the key layout.

Code is preserved at `design/backend-2026-09/salvage/worker-44-venkat.patch`; it could not be committed
because `errors.py` lands at 404 lines against the repo's 400-line cap.

## BUILD STATUS — 2026-09-04 20:40

Migrations are being written on separate branches with RESERVED number ranges, because three workers
wrote them concurrently and Alembic's chain is linear. **God linearizes at integration; no worker
reconciled anything.**

| Range | Worker | Landed |
|---|---|---|
| 0005-0007 | Kaveri | record-class taxonomy, `legal_holds`, the audit writer + the suppression proof |
| 0008 | Chitra | `orders` expanded, plus `tests/minimal_rows.py` — a dependency-ordered registry for the whole schema |
| 0020 | Bobbili | `users`, `clients`, roles |
| 0030-0032 | Meenakshi | `documents`; `packages`/`pages`; `fields`/`field_readings` **incl. `correction_reason`** |
| 0040-0041 | Ramanujan | chain of title + instruments; escalations |
| 0050+ | Aryabhata | deliveries, intake — IN FLIGHT |

**`rulebook.py` needs no migration** — it declares `Rule` against `rules`, which `0003` already
creates. Verified, not assumed.

**Two defects the build surfaced that the plan had only suspected:**
- `correction_reason` was accepted on the wire (`z.string().optional()`) and never read by the handler —
  a reviewer's typed reason was silently discarded. The column now exists (`0032`). This narrows TP-16.
- The error envelope nested the sentence, so under live mode every refusal rendered as
  "503 Service Unavailable" with both suites green. Fixed (`ac3244d`).

**Reports are deliberately NOT being written by the workers.** Every worker across every run ran out of
budget before writing one, leaving twelve files of headings. Reasoning goes into commit messages and
docstrings; ONE documentation pass over the whole committed build is commissioned at the end.

---

## OWNER RULING 2026-09-05 — BLIND IS DEFERRED. Not cancelled, not deleted.

The owner has taken blind out of scope for now. It comes back later. God's dispositions, so it defers
CLEANLY rather than half-existing:

**1. Nothing already built gets deleted.** Kaveri's blind-fifty selection method
(`agent/worker-61-kaveri`, 5 commits) and Bobbili's credential-reachability proof
(`agent/worker-63-bobbili`) stay on their branches, committed and tested. Deferring is not destroying —
that work cost real money and re-deriving it later costs it again. It is FROZEN, not reverted.

**2. `blind-svc` STAYS a deployable.** It is a stub; keeping it costs nothing, and removing it would
mean redoing the topology collapse when blind returns. **But no further scope goes into it** — no new
endpoints, no new boundary work, no chasing its residuals.

**3. The blind residuals stop being chased.** `REVOKE CONNECT` and network reachability remain UNPROVEN
and stay written down in `design/backend-2026-09/audit-blind-boundary.md` §6. They are not defects to
fix now; they are the state blind is parked in. Nobody picks them up without the owner saying so.

**4. Blind endpoints are OUT of the API cut.** blind-fifty and blind-status do not get built in the
four-layer refactor or after it. This amends PLAN §9 question 3, which recommended blind-fifty in the
first cut alongside the golden set: **the golden set alone now carries the accuracy programme.** That
recommendation was mine and the owner has overruled the blind half of it.

**5. What this does NOT change.** The blind-fifty typist-isolation *principle* still constrains the
schema already built — seat segregation, the `titlepipe_blind` role, and the audit trail are landed and
stay. We are deferring the FEATURE, not relaxing an invariant that is already enforced.

**Binding on every agent spawned from here.** This section and `CONVENTIONS.md` are read by every
dispatch; anyone who finds blind work in a card should stop and check this ruling first.

## INTEGRATION STATE — 2026-09-05 07:10, god's own record

**Five large branches exist and NONE contains another.** This is the real remaining work, and it is
mine. Recorded here because two workers have now been given instructions that were true on one branch
and false on another, and that is my error, not theirs.

| Branch | Commits | Holds | Does NOT hold |
|---|---|---|---|
| `agent/worker-68-chitra` | 38 | the 16-migration chain, PROVEN to apply | `libs/service-kit`, the four-layer api |
| `agent/worker-65-vishwa` | 33 | topology (3 deployables), `service-kit`, the queue (0060+) | the domain migrations, the api refactor |
| `agent/worker-64-venkat` | 16 | the four-layer api, §10 gate, queue endpoints | `service-kit`, the domain models |
| `agent/worker-58-bobbili` | 10 | WorkOS adapter, auth seam, RLS coverage | everything above |
| `agent/worker-67-meenakshi` | — | frontend: Queue screen, invariants, e2e port | all backend work |

**Two live cross-branch defects, both found by Venkat, both correcting ME:**

1. **The telemetry shim instruction I gave was wrong twice.** `titlepipe_service_kit` does not exist on
   Venkat's branch at all — it is Vishwa's extraction. And even on Vishwa's branch the shim's own
   docstring UNDERCOUNTS its importers: five modules import
   `titlepipe_core.telemetry.logging` there (`api/errors.py`, `api/routers/rules.py`, `app.py`,
   `lifespan.py`, `tests/test_logging_pipeline.py`) and `db/reads.py` makes six. Repointing only the
   two under `api/` and deleting the file — which is what I asked for — would have broken `app.py` and
   `lifespan.py`.
   **Recipe, post-merge, one commit, owner = god:** repoint all six importers, add `libs/service-kit`
   to core-api's dependencies, delete `services/core-api/src/titlepipe_core/telemetry/logging.py`, then
   run `tests/test_logging_pipeline.py` — it is the one that proves the redaction processor still runs
   last.

2. **Contract vs schema on Order.** `packages/contract/src/entities.ts:56-77` requires THIRTEEN fields
   on an Order. Venkat measured three columns on HIS branch — but Chitra's `0008_expand_orders` closed
   most of that on the integrated chain. The gap is real, its size is branch-dependent, and it must be
   re-measured against the merged tree rather than either number being quoted.

**Rule for me, learned the hard way:** never write a dispatch instruction that depends on a file
existing, without naming which branch it exists on. Two workers lost time on this today.

## MILESTONE 2026-09-05 — the merged tree is GREEN, and six adversaries have been through it

`integration/backend-2026-09`: five workstreams merged, 22 migrations on a single head, the round trip
proven (20 up / 20 down / 20 up, no residue), and **core-api at 412 passed in random order**, verified
by god against a clean `postgres:18.4`.

**Green is not the same as correct, and the reviews are the reason we know that.** Six adversaries were
sent to falsify, not confirm. Four have reported: 20-plus findings, and *every single one was found on
a tree whose suite was passing*. The most serious:

- **The app role can promote engine output into golden truth in one statement** — a 0.20-confidence
  reading became `tag='agreed'` ground truth, all 41 golden tests still green, and a correct leaderboard
  then reports those readers as 100.0% accurate. The exact failure the golden set exists to prevent.
- **`CREATE OR REPLACE FUNCTION` guts a trigger and leaves the catalog pristine.** Nothing in this
  repository ever reads a function BODY, so every catalog-based trigger assertion is blind to it.
- **The WorkOS adapter is wired to nothing** — a valid production config starts `can_authenticate=False`,
  so the deployed refusal is theatre.
- **Two named proof files do not exist** (`tests/test_auth_seam.py`, `tests/test_provenance_envelope.py`)
  and are cited five times between them as the machines enforcing safety properties.
- **`orders.client_id` has no FK** — an order can name another tenant's client, and `clients` holds the
  delivery destination.
- **The app role can rewrite `users.role`** within its tenant. Verified, `UPDATE 1`.

**Two reviewers converged independently on the same ceiling:** every append-only and ledger guarantee in
this system tops out at `titlepipe_owner`, which is one `SET ROLE` from `titlepipe_migration` — a LOGIN
role. Written down nowhere until now.

**What HELD under real attack is worth as much:** no cross-tenant read by any path tried, including a
`SECURITY DEFINER` function attacked with a control; no cross-tenant existence oracle; the models split
is a strict two-level DAG; intake is genuinely separable (downgrade executed); the mock-header guard held
across every HTTP surface, method and casing; and all 15 `ENABLE ALWAYS` triggers were finally proven
BEHAVIOURALLY, closing a residual that had been carried as unproven.

## TRIAGE 2026-09-05 — 34 findings, ranked. God's plan.

Nine reviews and audits produced 34 findings. Ranked below by **what is exploitable now**, then by
**what arms later**, then by **what is merely untrue**. Ordering constraints noted where they exist —
two of these get materially more expensive if they slip.

### WAVE 0 — do today. Operational, or one line, or has a deadline.
| | Why now |
|---|---|
| **FX-31** DSN password to stderr on failed boot | Not a code task first: **rotate any credential used by a deployment that failed to boot.** Then fix. Trigger is the ~12 refusals a *first* deploy hits. |
| **FX-32** client-data guard passes client data | Compliance exposure, live, and needs no bypass. Suffix string-equality plus no `.csv/.json/.sql` entry means extracted client data is invisible to it. |
| **FX-23** `task_name` redacted from every log line | One line. Restores the only two log lines an operator gets when the queue loses work. |
| **FX-1** half-citation CHECK on `fields` | One line, and **the deadline is the extraction worker's first row.** After that it is data cleanup, not a migration. |

### WAVE 1 — the trust chain. These are ONE defect in five places.
Identity and truth are both forgeable, at both layers. Fixing any one of these alone buys nothing,
because an attacker just uses the next. **Until this wave lands, the golden set cannot be treated as
ground truth and the audit log cannot be treated as evidence.**
FX-26 (audit actor is an ACL-less GUC written verbatim) · FX-28 (golden signer forged from a client
header, while the contract claims it is unforgeable) · FX-16 (app role promotes a 0.20-confidence
reading into `tag='agreed'`) · FX-18 (DELETE + re-INSERT walks past the immutable columns, including a
cross-tenant transplant) · FX-17 (`CREATE OR REPLACE` guts any trigger and leaves the catalog pristine —
nothing here reads a function body).

### WAVE 2 — authorization posture
FX-27 (mock defaults a missing role to **admin**, and the mock IS today's backend) · FX-12 (app role
rewrites `users.role`) · FX-13 (`x-mock-actor` passes the guard) · FX-14 (websocket outside the guard) ·
FX-29 (nothing scopes by SEAT — design, must be settled before reads port to core-api).

### WAVE 3 — make the claims true, or delete them
FX-10 (WorkOS wired to nothing; the deployed refusal is theatre) · FX-11 and FX-2 (two named proof files
that do not exist, cited five times) · FX-21 and FX-9 (every append-only guarantee tops out at
`titlepipe_owner`, one `SET ROLE` from a LOGIN role — documented nowhere) · FX-20 (a test that cannot
fail).

### WAVE 4 — before the pipeline runs a single job
FX-22 (stall sweep dies permanently and silently) · FX-24 (defer survives the caller's rollback) ·
FX-3 (queue mapper refuses every order over three name mismatches, with a test pinning the refusal as
correct) · FX-6 (`orders.client_id` has no FK; `clients` holds the delivery destination).

### WAVE 5 — hygiene
FX-4, FX-5, FX-7, FX-8, FX-15, FX-19, FX-25, FX-30, FX-33.

### THE PATTERN WORTH MORE THAN ANY SINGLE FINDING
**The verification layer is the least trustworthy part of this codebase.** Three tests that CANNOT FAIL
(the vocabularies test subsumed by its own second assertion; the redaction allowlist test that iterates
the allowlist and so cannot see a missing field; the trigger test that enumerates 'D','R','O' and misses
`CREATE OR REPLACE`). Two named proof files that were never written. One guard that could not see a row
because FORCE RLS hid them from it. **All 34 findings were made on a tree whose suite was green — 412
passed.** Any future gate should be required to demonstrate its own red before it is trusted; Bobbili
did that for the RLS coverage check and it is why that one control survived scrutiny.

## 2026-09-08 — QA-1 MERGED, and the gate nobody had run

**QA-1 is done and merged into `integration/backend-2026-09`.** Tenali's pass over core-api and
migrations: 77 files, +405/-637, **zero executable lines changed** — the code counts are identical
before and after, which is the proof it was a refactor rather than a rewrite. Deleted: 333 emoji
markers, 140 divider/banner lines, ~220 lines of narration.

**The prose ratio did not move — 63% → 63% — and that is the correct result.** Tenali ran a
restatement detector over both trees and got three hits, all section banners. What remains is
argument, not narration: measurements, residuals, rejected alternatives. He was told the number was
a diagnostic and not a target, and he held to it. **Nobody takes another run at that number.**

Three of his own earlier review findings closed as stale, by looking at the tree rather than at the
report: `QueueService.next_order` is no longer a pass-through (Venkat's layer work put the two-`None`
distinction in it, and collapsing it would now delete behaviour); the 400-line models split earned
its keep (`relations.py` is the one home of the composite tenant-FK rule, read by seven modules — and
the cap found a LAYERING mistake, which is a cap doing its job rather than distributing code).

### FX-36 — pyright has been RED on this branch, and CI has never run on it
Found outside the surface he was sent to work on, which is the most useful kind of finding.
`uv run pyright` reports **6 errors** in core-api: `migrations/env.py:425` (the `include_name`
signature against Alembic's stub — a real mismatch) and `0060` lines 239/394/395. Tenali proved it
pre-existing by reverting both files to base and re-running. **I reproduced all six myself on the
merged tip.** Pyright strict is a CI gate in `backend.yml`'s project matrix.

Before dispatching I checked the one that looked dangerous: `_revoke_tables` is **safe dead code, not
a missing privilege revocation** — `0060`'s own downgrade docstring states the grants are deliberately
not revoked because `DROP TABLE` removes the object and its ACL together. Assigned to Vishwa (83).

**The larger fact this exposes, and it reframes the quality plan:** nothing has ever been pushed to a
remote, so **the CI gates have never been exercised end-to-end on any of this work.** The gates are
well built and they have not run. That is a different problem from a missing gate, and it is the one
worth fixing first.

### FX-37 — a cited premise nothing enforces
`api/schemas/pagination.py` has zero importers and cited a test never written — the `CitedValue` shape
exactly. Tenali declined to delete it and asked me to overrule him. **I upheld him.** `MAX_PAGE_SIZE`
is a cited premise in `0112`, whose residual arithmetic is 200 rows × 64 KiB; deleting the module
strands a measured ceiling on a constant that no longer exists. The defect is not that it is unused —
it is that **neither constant is enforced anywhere, because no endpoint pages.** Close it by making
pagination real when the list endpoints land, not by deleting the premise `0112` rests on.

### Deliberate duplication that a later pass must NOT collapse
Tenali's reuse hunt came back clean in his surface, and named the copies that stay: the literal queue
set in `test_forced_rls_and_grants` (so a fifth table arriving with the marker passes the derivation
and still fails the literal), `0060::QUEUE_TABLES` (a frozen migration snapshot), and the rulebook
enum `Literal`s in `api/schemas/rules.py` (held to `db/models` by `test_rules_contract_parity`).
**Those are the machine, not the defect.**

## 2026-09-08 — FX-25 closed, and a ruling: `libs/http-kit`

**Vishwa (95) merged.** Worker, blind-svc, libs and scripts. The comment number barely moved and two
areas went **up**, which is the correct result — he added measured residuals and deleted only what
restated something else. He was right not to apologise for it.

**Two of the premises I put in his brief were STALE, and he checked the tree instead of trusting me.**
FX-25 said `BaseHttpServiceSettings` had zero consumers; `BlindApiSettings` already inherits it, so
the real state was 2 of 3 sealed with core-api the lone holdout. The telemetry shim's exit condition
had *inverted* rather than drained — six importers in src, not the two its own note claims. **My
error: I forwarded findings from a review without re-verifying them against the current branch.**
Same class as the branch-base trap. A dispatch premise gets re-checked or it does not go in.

### Two live defects the reuse hunt found
`blind-svc` logged a correctly-mapped **503 as `domain_error_unmapped`** — core-api measured and fixed
that handler on its own copy, and blind-svc never received it. It stayed quiet only because nothing
there raises a registered 5xx yet. And the worker's service name had two homes, with the literal
reachable only on the failure path an operator reads when config is broken.

**And he audited my own work:** my 1→3 raise of the INSERT threshold in the client-data guard had
**no test asserting either number** — a change to a security control that nothing could contradict.
Four tests now, including the passing cases, because a threshold with only its refusing case pinned
reads as a rule with no ceiling.

### RULING — FX-38, `libs/http-kit` (Vishwa's REQUEST 3; he was right to escalate it)
`api/request_context.py` is **byte-identical in both API services** — md5 `fbff6a4e…`, 258 lines each,
verified. The error envelope is near-identical with one status table under two names. **That
duplication is what produced the 503 defect.**

Options were (a) a new `libs/http-kit` depending on starlette, (b) relax service-kit's boundary,
(c) accept the duplication plus a divergence test. **Ruled (a).** (b) is refused —
`test_import_boundary.py` statically bans fastapi and starlette and exists to keep a web server out of
the worker image; that boundary stands, and Vishwa said he would refuse it too. (c) would have caught
the defect, but it is a stopgap for something we are in a position to actually close. The new boundary
runs **both ways** and is enforced statically with its own demonstrated red, in the shape of the
service-kit test that already does this properly.

**Dispatched:** Bhaskara (96) on FX-38, Charaka (97) on FX-39 (the settings seal's remaining half plus
the shim deletion). Surfaces split so they cannot collide: 96 owns `api/errors.py` in both services,
97 owns `settings.py` and `telemetry/`, and I carry the one overlapping import at integration.

## 2026-09-08 — the gates ran, and one of them had been failing all along

**FX-36 closed (Madhava, merged).** pyright strict is 0 errors on core-api. I then ran it across the
other five Python projects myself — **all already 0**, so core-api was the only red one.

The interesting half is *why* each error existed, because he reported it per error rather than in
bulk. `env.py`'s `include_name` annotation **was our defect, not Alembic's**; he fixed it by importing
Alembic's own `NameFilterType`/`NameFilterParentNames` instead of respelling six `Literal`s that could
drift. The cursor errors were stub friction — SQLAlchemy's `DBAPICursor` is a pep-249-minimum Protocol
with no `__enter__`/`__exit__` while the runtime object is psycopg's cursor. He **tried and rejected**
casting to `psycopg.Cursor`: psycopg types `execute` as `LiteralString`, which a schema file read at
runtime can never satisfy, so that path needs a second cast asserting a falsehood. The rejected
alternative is recorded at the protocol, which is exactly what §11 asks for.

### QA-2 — I ran the whole CI hygiene job locally, and `pre-commit --all-files` FAILED
That is the CI step verbatim, and **seven files carried trailing whitespace or no final newline** —
two `apps/web` components, four design docs, one `packages/mocks` fixture. Committed at `1c902e8`;
all 17 hooks now pass.

**The bench captures were excluded rather than rewritten.** They are `psql` output, and the trailing
run on a `QUERY PLAN` header is psql's own column padding — stripping it would make every future
re-run diff against the recorded measurement over pure whitespace. That is the same reasoning the
config already gives for the Gate 0 patch, so the rule now covers captured output generally rather
than one named file. Proved whitespace-only before committing: `git diff --ignore-all-space
--ignore-blank-lines` empty across all seven, and both JSON files still parse.

Everything else was clean: backend structural rules (98 files), locks current, client-data guard over
the tree, doc links, CLAUDE/AGENTS identical, dependency audit across all seven projects.

### FX-40 — a gate that deletes itself on a typo
Probing the dependency audit turned up a latent hole: `audit_dependencies.py services/core-apu` prints
`skip … (no uv.lock)` and **exits 0**. CI invokes it as `audit_dependencies.py ${{ matrix.project }}`,
so renaming a directory or mistyping a matrix entry silently removes the audit while the job stays
green. All seven real projects pass today, so this is latent, not an active miss — but it is the
false-assurance shape exactly, and the fix must demonstrate its own red.

**This is the evidence for Phase 1 of the quality plan.** A missing gate and an unrun gate look
identical from the inside; this repo has the second kind, and running them was worth more than adding
any new one would have been.

## 2026-09-08 — THE OWNER'S 14-STEP REFACTOR PROGRAMME IS NOW THE GOVERNING PLAN

Cards RB-1 … RB-14 carry it verbatim. Execution order is the owner's: baseline → architecture and
boundaries → module refactoring → source cleanup → correctness and security → tooling and CI →
documentation → complete verification. **Each batch passes its checks before the next structural
change begins** — so batches are dispatched in waves on disjoint surfaces, not all at once.

**Landing:** the owner asked explicitly to push to `main`. That happens at RB-14, after integrated
verification — not before. `origin` is `github.com/rahuldr07/titlesearch`; `main` is untouched at
`ddaae50`. Note that pushing a workflow file does not make its checks required; **branch protection is
a manual GitHub setting and will be reported separately**, per the owner's own step 11.

### Three reconciliations against the tree, made before dispatch
The owner's directory sketch does not match the repository, and the plan's own rule — *"avoid adding
empty layers; each directory must represent a real responsibility"* — decides all three:
1. **`services/extraction-svc` and `services/render-svc` DO NOT EXIST.** They are **not** being created
   as empty shells. The architecture guide names them as planned-but-unbuilt, in prose.
2. **`services/worker`, `libs/service-kit` and `libs/http-kit` are real and load-bearing** but absent
   from the sketch — `http-kit` because it was created today.
3. The Python half of step 6 (comment cleanup) is **already done** and measured: 63% prose in core-api
   is argument, not narration. Step 6 is therefore scoped to `apps/web` and `packages/*`.

### FX-38 closed — `libs/http-kit` merged
`request_context.py` moved **wholesale**: git recorded a rename and the file still md5s `fbff6a4e…`,
which is the proof nothing was retyped. `error_contract` absorbed the vocabulary, `DOMAIN_ERROR_STATUS`,
the single status table, and `publishable_detail` — whose own residual comment had promised exactly
this move the day a shared home existed. **The residual Bhaskara was right to keep:** the envelope
*shape* does not unify and must not — core-api answers a flat body, a measured browser contract held
by the contract-fixtures gate and `apps/web`'s `readError` predicate, while blind-svc answers a nested
one. Tip `9866da7`; pyright 0 across all seven projects, 926 Python tests, every project exit 0.

### Wave A dispatched — four disjoint surfaces
| Worker | Batch | Owns |
|---|---|---|
| Varahamihira (100) | RB-1 baseline | **read-only** on source; writes `docs/refactor-2026-09/` |
| Panini (101) | RB-3 + RB-2 | `apps/web/scripts/`, the module-graph check, ARCHITECTURE.md |
| Bhaskara-II (102) | RB-10 commands | root `package.json`, `scripts/` wrappers |
| Charvaka (103) | RB-11 CI | `.github/` **entirely** |

Nobody moves a source file in Wave A. Structural batches (RB-4, RB-5, RB-6) come next, once the
baseline says what is actually true and the boundary checks exist to catch a move that breaks a rule.

### The finding that shapes RB-11
`knip`'s `entry` list roots at `src/workbench/main.tsx` — the **dev-only** shell — and never names
`src/main.tsx` or `index.html`. The real application is not an entry point in its own dead-code graph,
which is almost certainly why `src/components/ui/**` (107 files) had to be ignored outright. Fix the
entry list first; the ignore may then be unnecessary.

## 2026-09-08 — the owner ruled on both open questions

**TP-22 — ALLOW IT DELIBERATELY.** Double-click is an intentional override for `auto_confirmed`
fields; the asymmetry with `canSelect` stays. That turns a defect into a decision, and the work is
therefore to make it survive as one: record it with its rejected alternative at `beginEdit`, and
re-point the test that currently pins it *as a defect* so it pins the *ruling* — same assertion,
honest name, so a later refactor cannot quietly close the override.

**And the part the ruling did not cover, which I have asked Sushruta to check rather than assume:**
the owner allowed double-click to *reach* the editor. They did not rule that it may bypass anything
else. If the double-click path skips the correction reason, the confirmation semantics or a
server-side refusal that the click path enforces, that is a **separate defect**, outside this ruling,
to be reported and not fixed on a worker's own judgement.

**FX-34 — SENIOR, ENGINEER and ADMIN may establish ground truth.** Not reviewer, ops or typist.
Migration `0121` adds the seat predicate to `0102`'s `signer_body`, which already resolves `seat` and
then does nothing with it — Aryabhata's "one predicate on the day somebody rules" was exactly right,
and he was right to decline to invent it. All six seats get asserted: three refused, three accepted,
because a rule with only its refusing case pinned has no ceiling and one with only its accepting case
pinned is not a rule. `0102`'s OPEN note is updated to record the ruling and point at `0121`.

Kanada (104) and Sushruta (105) dispatched. **Zero questions now blocked on the owner.**

## 2026-09-08 — WAVE A INTEGRATED, AND CI IS RUNNING FOR THE FIRST TIME EVER

Six branches merged clean at `e9a0ab6`. **pyright 0 across all seven Python projects**, every project
exit 0, 30 migrations single head `0121`, 17/17 pre-commit hooks, vitest 444/444, typecheck clean.

**Charaka was not lost.** Reaped for idleness, but it had already committed all four commits **in the
mandated order** — rename to `additional_unsafe_for_deployment`, delete the duplicate seal validator,
*then* change the base class. Any other order is an import-time `TypeError`. FX-25 and FX-39 close.

### The baseline reshaped the plan
- **e2e is RED: 56 failed / 104 passed of 160**, real assertion failures — **and it was already red on
  `main`'s last CI run.** Part is inherited, not introduced. Until that split is known, no `apps/web`
  refactor can prove itself. Promoted to its own P0 batch, RB-15.
- **prettier failed on 185 files, enforced nowhere.** No CI step, no hook, only a `--write` script.
- **THE REPO LIES ABOUT ITSELF**: `playwright.config.ts:9` and `frontend.yml` both claim every
  invariants spec is `test.skip`. Measured: **zero skips, 116 active tests.** Anyone budgeting
  "un-skip the invariants" was planning work already done.
- Highest-risk coupling in the repository: **enum values are hand-transcribed** from
  `packages/contract` into Postgres DDL, held equal by nothing but a **line-number comment**.

### What I did myself, because delegating it would have caused 185-file conflicts
Formatted the web workspace in one isolated commit. **Verified by behaviour, not diff shape** —
`--ignore-all-space` still showed 1557 changed lines because prettier reflows, so that heuristic
proves nothing here. Typecheck clean, 444 tests, `check:imports` still reporting exactly 23.

**And it exposed a real defect.** Nine `rules-allow:` suppressions stopped applying: prettier split
`style={{ width }} /* rules-allow: … */` across three lines and the marker now sits two lines *below*
the violation. **The escape hatch is line-coupled, so any formatter silently strips suppressions.**
Note the direction — the marker lands *after* the violation, which rules out an eslint-style
previous-line fix. RB-16, P0, and the replacement rule must carry a **stated ceiling** plus a negative
test proving a too-distant marker does not suppress.

### CI, at last — PR #13 (draft)
`push` is scoped to `main`, so a branch push triggers nothing; CI runs on `pull_request`. Opened a
**draft** PR so nothing can merge. All three workflows are executing for the first time — Charvaka
rewrote them this round and they had never run, so the first run is the experiment. Better to learn
that now than at RB-14.

### Floor: nine workers
RB-4 barrels/cycles · RB-15 e2e triage · RB-16 rules-allow ceiling · RB-5 Python modules ·
RB-5b TS modules · TP-22 · RB-13 docs+PR template+CONVENTIONS into the repo · RB-9 security review
(report-only) · RB-8 backend correctness (report-only). The last two are report-only **because six
workers are live in source** — a fix from them would collide or be lost.

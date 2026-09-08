# Memory — TitlePipe floor god

_Seeded by Michael (god of the DevNotes floor, `/home/rahul/HarnessAgents/hive`) at handover,
2026-09-04. Everything below is transferred experience, not speculation — it was paid for._

## 📌 Durable facts (pinned — never condensed)

Project: TitlePipe at /home/rahul/projects/titlesearch; hive root /home/rahul/TitleSearchAgents/hive; orchestrator is sole god; worktrees at /home/rahul/TitleSearchAgents/worktrees/worker-NN-<name>
RD-STANDARD (2026-09-04): current frontend is spec; drop enforcement rules but keep all domain facts; seven parallel discovery streams synthesized by architect + one independent adversary; discovery files in hive/design/backend-2026-09/; no users/clients/auth in greenfield; no FKs; v99 empty by domain; readiness is startup snapshot
Model-ID rule: model field must be bare id (the model, the model) or [1m] context variant only; effort is separate --effort CLI flag; never append [xhigh]/[high]/[medium]/[low] to model string
Incremental-write rule (proven twice, 2026-09-04): create output file in first minutes with headings, append after each work unit; half-finished file on disk survives reap; complete analysis in dead session is zero value
Topology settled (RD-3): core-api + blind-svc (security boundary via separate titlepipe_blind role, proven by test_blind_boundary.py) + ONE worker image; extraction/render are queue+role, not deployables; stack is Python/FastAPI/Postgres/Alembic/SQLAlchemy/Pydantic/Procrastinate
Tenant isolation seam: deny-sentinel connect_args + checkin RESET + after_begin GUC + nullif policies + composite (tenant_id, id) PK; shared-schema+RLS beats schema-per-tenant (wrong search_path reads another tenant's real data; missing GUC reads zero rows); topology names machine enforcing blindness; redaction/boundary-test are TRIPWIRES not controls
FALSE-ASSURANCE design principle: every safety property names the machine enforcing it; missed path fails LOUD not silent (R2 min(1) 422s bypass; R1 .optional() lets one succeed); test by naming what would FAIL if violated; claim with no answer is decoration
NO AI ATTRIBUTION anywhere (owner-confirmed, stated three times in docs/prompts/gate-*.md): no authorship trailer, session trailer, Generated-with, AI references in commits, code comments, docs, any file — overrides harness default for this repo and hive
Auth unsettled: three provider names exist (WorkOS AuthKit/Clerk/x-mock-role header); new backend requirement: derive identity/seat from owned session, never trust request header
NPI violations found: (1) packages/mocks/src/bundles/final-package-lincoln-mo.json (386k, real Lincoln County data, untracked, caught by check_no_client_data.py, no pre-commit hooks); (2) packages/mocks/src/realPackage.json (caught incidentally); fix: pre-commit + .gitignore pattern
Port 4274 collision (e2e globally pinned in playwright.config.ts): not test failure, scheduling collision; e2e effectively serialized across floor; dev server separate on 5174 (do not touch)
GLBA/ALTA/SOC 2: field-level envelope encryption for DOB/SSN/bankruptcy detail, append-only audit log, per-tenant retention windows + secure deletion, no NPI in URLs/logs, SOC 2 evidence logging day-1 (Kalam, RD-7)

## 🗜 Condensed history

TitlePipe project (repo /home/rahul/projects/titlesearch, hive root /home/rahul/TitleSearchAgents/hive, orchestrator is sole god). Dispatched 14 workers on 2026-09-04 after owner confirmation "do all of it fully dont hold back". Workers numbered 1–31 across reaps and respawns; final roster: Meenakshi(25), Chitra(26), Aryabhata(27), Vishwa(28), Kaveri(29), Venkat(31), Bobbili(24), plus seven others. Total token cap 23M (9×2M + 5×1M). Worktrees at /home/rahul/TitleSearchAgents/worktrees/worker-NN-<name>.

**Model-ID bug (fixed):** hire manifests baked reasoning effort into model id (`the model`, etc.). the harness does not accept effort suffix as model id. RULE: model field must be bare id (the model, the model) or [1m] context variant only; effort is a separate --effort CLI flag and cannot be requested in spawn schema. Stripped effort from 27 files, SIGTERM'd 5 dead workers (chitra, kavalan, bharathi, avvai, bobbili), respawned as 15–19. Diagnostic: live model from argv, not persisted files; transcript health in ~/.the assistant/projects/<slug>/<sessionId>.jsonl; running model only changed by restart or user /model command.

**Incremental-write rule (proven twice, now mandatory):** Meenakshi/Aryabhata/Venkat burned 10M-token caps with zero output (no files written). Chitra/Mani, given the rule (create output file immediately, append after each work unit), wrote 5.5k and 19k surviving a reap respectively. Half-finished file on disk infinitely better than complete analysis in dead session. Baked into every long-running dispatch.

**Greenfield backend/database redesign (RD-1 through RD-11, 2026-09-04):** owner briefed: current frontend is spec, drop enforcement rules but keep domain facts. Seven parallel streams: Meenakshi(frontend-a, 66k), Chitra(frontend-b, 41k), Venkat(api-surface, 12k), Vishwa(current-backend/stack, 22k), Kaveri(data-domain, 731B), Bobbili(security/tenancy/audit, 43k), Kalam(docs-sweep/hidden-requirements, 1.9k), Aryabhata(pipeline, 39k), Tenali(architect/PLAN.md, 46k), Mani(independent frontend read, 19k). Discovery files in hive/design/backend-2026-09/.

**Topology decided (RD-3):** core-api (3.5k LOC) + blind-svc (security boundary, separate titlepipe_blind role, proven by test_blind_boundary.py) + ONE worker image (extraction/render are queue+role differentiation, not separate deployables). Stack: Python/FastAPI/Postgres/Alembic/SQLAlchemy/Pydantic/Procrastinate (new).

**DO-NOT-LOSE facts from RD-3 and RD-5:** tenant isolation seam (deny-sentinel connect_args + checkin RESET + after_begin GUC + nullif policies + composite (tenant_id, id) PK closing cross-tenant EXISTENCE ORACLE); five-role least-privilege; fail-closed no-DSN guard; NA four-label enum (NOT_PRESENT, NOT_FOUND, NOT_STATED, PRESENT_UNREADABLE, no PENDING, never collapsed); nullable line_coords; append-only audit via ENABLE ALWAYS triggers; encryption at extracted-identifier level, not page images; shared-schema+RLS beats schema-per-tenant (wrong search_path reads another tenant's data; missing GUC reads zero rows); topology names the machine enforcing blindness; redaction and boundary test are TRIPWIRES not controls. Holes to design FOR: no users/clients/auth, no FKs, no real domain columns, one product endpoint, v99 empty by domain, readiness is startup snapshot.

**False-assurance design principle:** every safety property names the machine enforcing it; missed path fails LOUD not silent (R2's min(1) 422s bypass; R1's .optional() let one succeed). R4 (server-stamped signature, browser signer unforgeable), R2/R3 clean, R1 broken. Test: for each safety claim name what would FAIL if violated; claim with no answer is decoration.

**Technical findings closed:** RD-11 (Vishwa): four Dockerfiles' uv-sync venv shebangs break under relocation (fix: ENV UV_PROJECT_ENVIRONMENT=/app/.venv before sync). Tenali RLS-proof satisfied by test_tenant_isolation.py (28 passed, testcontainers-backed). TP-18 (Kaveri): untracked NPI at packages/mocks/src/bundles/final-package-lincoln-mo.json (386k, real Lincoln County data); pre-commit hooks absent; fix: install pre-commit AND add .gitignore pattern. Incidental: packages/mocks/src/realPackage.json also caught by check_no_client_data.py (Kalam found, Kaveri verifying).

**Auth genuinely undecided:** three provider names in tree (WorkOS AuthKit in docs, Clerk in comment, x-mock-role client header in working path). New backend derives identity/seat from owned session, never trusts request header (Venkat, RD-2 requirement).

**Port collision (TP-20, P2, unblocking):** apps/web/playwright.config.ts pins port 4274 globally; e2e effectively serialized across floor. Not test failure, scheduling collision. Dev server separate on 5174 (do not touch).

**Rulings closed:** TP-1 (Vishwa): trivy-action @0.28.0 -> @v0.28.0 (upstream deleted unprefixed tags). TP-3 (Venkat): reason stays .optional(), RE-TIGHTEN BEFORE ANY REAL PACKAGE DELIVERED (TP-16, blocked). TP-17 (double-click bypass): Mani proved path B (useEditAsk.ts:76 onSaveInline) 422s-never by side-stepping hold check; invariant only drives path A (e key, DecisionEditor). Meenakshi's TP-2 (Queue screen design) FORBIDDEN: INVARIANT 22 (no cherry-picking), INVARIANT 23 (SLA unresolved), no collapsed state machines. TP-15 (Bharathi, docs): built schema + PK wins, AUTH GATE supersedes clerk_id, stack package.json ground truth, R15 audit closed, INDEX updated. **NO AI ATTRIBUTION, anywhere: no authorship trailer, session trailer, Generated-with, or AI references in commits, code comments, docs, files — owner-confirmed (stated three times in prompts/*.md).**

**Unmerged work:** agent/worker-23-bharathi (docs, 5 commits, HEAD 9033ba3), agent/worker-14-aryabhata (1 commit). Meenakshi's worktree dirty, 0 commits.

**PLAN.md state (~12:11): 46k, nine sections.** §1 domain 10.9k, §5 services 13.6k, §4 api 5.6k, §6 pipeline 4.8k, §3 backend-structure 3.3k, §2 database 2.3k, §9 future 2.2k. Thin: §7 stack, §8 migration (unblocked by RD-3). Missing: RD-7 docs-sweep (Kalam on section C first: hidden requirements — GLBA/ALTA/SOC 2 groundwork/AI billing metered keys/per-client delivery — then domain facts).

**Discovery disk state:** frontend-a 66k, security 43k, frontend-b 41k, pipeline 39k, current-backend 22k, independent-read 19k, api-surface 12k, docs 1.9k, data-domain 731B.

## Recent

## 2026-09-04 — review phase started
RD-1 CLOSED: `discovery-frontend-a.md` complete at 66k, all 8 features + "WHAT THE BACKEND MUST OWN" +
"FRONTEND ASSUMPTIONS THAT MAY BE WRONG" (those last two are the highest-value input to §4).
PLAN.md ~51k, all nine sections real. Told Mani to START REVIEWING NOW rather than wait for a frozen document,
and to **attack §2 and §4 hardest — for evidenced reasons**: §4 rests on the thinnest input in the exercise
(Venkat's D2 reaped twice, ~8k, and Tenali admits he has not read it in full), and §2 is being written while
Kaveri's classification is still an unchecked checklist, so its PII/encryption/retention claims are INFERRED.
Also told him to audit whether the plan actually applies the false-assurance principle everywhere or only
where it was easy — §5 inherits Bobbili's 18 failure modes and will LOOK strong; §2/§3/§6/§8 are where an
unenforced claim will hide.

## 2026-09-04 — REDESIGN ESSENTIALLY COMPLETE. Status at ~12:22.
**PLAN.md is 80k / ~950 lines, all nine sections substantive.** Ten artifacts, ~537k total:
frontend-a 83k, api-surface 72k, frontend-b 69k, docs 45k, security 43k, data-domain 42k, pipeline 39k,
current-backend 22k, adversarial-review 22k, independent-read 19k.
All nine discovery streams DONE (RD-1..RD-7 closed; RD-6/RD-7 finishing tails). RD-9 review DONE.

**MANI'S VERDICT (RD-9): substantially sound, NO fatal architectural defect.** §5 is genuinely strong and the
most consistent application of the name-the-machine rule. Two HIGH findings must be fixed before §1 is built
against; the other five are cheap edits.
- **F1 (HIGH):** §1 records field-state terminality as OBSERVED FACT, but only 2 of 4 mock writers enforce it —
  `/confirm` and `/exclude` guard it, `/correct` and `/escalate` set state unconditionally. Escalate a field
  then POST /correct → 200, state `corrected`, T1 ruling filed, and the escalation row still open citing a
  field that is no longer escalated. **M1's shape exactly: the guard sits on the path a reader checks first.**
  Fix is cheap — bind terminality to §5 layer 3's conditional `UPDATE ... WHERE` (zero rows → 409). The machine
  is ALREADY IN THE PLAN; §1 just does not point at it.
- **F1b:** exclude-then-correct = a row simultaneously suppressed AND signed-corrected; correct-then-exclude =
  409. Same intent, opposite outcome by click order. The plan must pick flag or state.
- **F2 (HIGH):** §4 claims closed enums are compile-time-checked; true for `FieldState` and `NaReason` only,
  false for the others it names.

## 2026-09-04 — I WAS WRONG ABOUT THE DATA GUARD. Kaveri corrected two of my premises (TP-18).
1. **"Your guard is fine — check_no_client_data.py correctly refuses it" was FALSE.** It ACCEPTED the Lincoln
   County bundle, exit 0: `.json` is not a forbidden suffix and `packages/` is exempt from the directory rule,
   and 386 KB clears `--maxkb=512`. **So the `.gitignore` pattern I called "belt-and-braces" was the ONLY
   barrier — and `git add -f` walks straight past it. There was no boundary, only an accident-stopper.**
   I had taken Kavalan's second-hand report as a measurement, which is the SAME mistake as the "81 tracked
   binaries". **Twice now. Verify the guard's actual behaviour, never its reputation.**
2. **"No pre-commit hook installed" was already CLOSED** — it existed. And the "every worktree" half needed no
   work at all: **worktrees SHARE the common `.git/hooks`**, so ONE install covers all 11. She PROVED it by
   staging a `.pdf` and watching the hook refuse, rather than assuming.
3. **A third hole she found in no card:** `packages/mocks/src/realPackage.json` is TRACKED and empty by design,
   so `.gitignore` cannot cover it and all three path rules pass it — a populated copy would commit SILENTLY as
   an ordinary modification. She pinned it in ALLOWLIST at the empty shape's sha256 — **using the allowlist as a
   PIN rather than an admission**, since a hash mismatch is already a violation. Novel and correct.

## 2026-09-04 — RETENTION: a single retention_days column CANNOT be compliant (Kalam, from primary law)
Sourced from GLBA 16 CFR 314.4, TX TDI P-32, CA 10 CCR 1737.3 — external law, not the repo.
- The "7 years" in `reference-app.html` is **unsourced and satisfies no researched floor — dead, must not
  reach the schema.**
- **Texas requires 15 years** on "evidence of insurability" — which is literally TitlePipe's own deliverable —
  and indefinite on policies; escrow accounting is 3yr. **California requires ≥5yr on WORM media.** GLBA's
  2-year disposal duty explicitly YIELDS to these statutory floors, so there is no GLBA-vs-state conflict.
- **Design consequence: the schema needs a RECORD-CLASS TAXONOMY** (evidence-of-insurability / escrow-accounting
  / policy / derived-artifact / NPI-payload) before any retention field means anything. Buildable now,
  independent of the owner's eventual numeric ruling.
- Append-only audit vs secure deletion reconciles IF audit rows stay NPI-free by construction; crypto-shredding
  is the standard answer but whether it satisfies "secure disposal" under 314.4(c)(6) is UNRESOLVED — flagged
  as open, not a green light.

## 2026-09-04 — RD-2's finding that changes the schema: a correction's reason is ACCEPTED AND DISCARDED
The handler validates the body then never reads `parsed.data.reason`, and `entities.ts::Field` has NO COLUMN to
hold it — while `GoldenField`, the same act one layer up, carries `correction_reason`. **The read model
structurally cannot show why a value changed.** So the fix is not "make the field required" (my old TP-16
framing) — the new schema needs a correction-reason COLUMN. Also: 70 mock routes / 56 call-site paths
(50 LIVE, 18 ORPHAN, 1 UNBUILT, 1 TEST-ONLY), and `GET /api/rules` is the ONLY place where a Pydantic model, a
Zod schema, a real table and a wire contract already agree — worth reading before designing the other 69.

## 2026-09-04 12:36 — STANDUP. Board corrected; the finishing architect is delivering.
**FLEET (3):** god healthy; **worker-35-tenali healthy, 3.4M, ctx 16% — the only agent actually working**;
**worker-01-tenali STALE — 19 min idle, breaker constrained, 34.4M tokens, ctx 40%, SUPERSEDED by
worker-35.** Left it to the 20-min idle reaper rather than killing it: it is idle so it costs nothing, and its
output (PLAN.md) is now owned by its successor. Nothing to salvage from it.

**BOARD CORRECTION — four cards claimed `doing` with NO LIVE OWNER** (TP-2, TP-4, TP-8, TP-17; owners
meenakshi/kaveri/chitra all reaped). Moved to `todo` with a note. **A board that says `doing` when no agent is
doing it is the same false-assurance disease the whole redesign is being designed against** — I will not let the
ledger lie in the direction of looking busy. Blocked and todo cards with dead owners are fine (neither claims
work in progress); only `doing` was a lie.
Board now: **1 doing (RD-8), 7 blocked, 7 todo, 19 done.**
**TP-17 raised to P0** and annotated: it is Mani's F1 in the product rather than the plan — the same class of
bug found twice — and RD-2 supplies the deeper cause, that the correction reason is accepted and DISCARDED
because `entities.ts::Field` has no column to hold it. **Fix the card and the new design together.**

**PLAN.md is at 126k and the finishing architect has already delivered the two things I asked for:**
an **EXECUTIVE SUMMARY (12.9k) at the top** and **§9 OPEN QUESTIONS grown 4.4k -> 13.2k**. Also §1 10.9k->20.1k,
§2 17.4k->25.3k, §5 16.0k->21.3k, §4 9.3k->13.6k, §8 3.4k->5.3k. Untouched so far: §6 (7.6k), §7 (2.7k), §3 (4.6k).

**INTEGRATION DEBT I OWN — 10 unmerged `agent/*` branches**, 7 with live worktrees:
worker-{03,04,13,25}-* (no worktree) and worker-{05,06,14,20,21,23}-* (worktree present).
Known content: **worker-23-bharathi = 5 doc-truth commits (HEAD 9033ba3)**, **worker-20-vishwa = 2 commits
(HEAD 85b87e5, the scripts Ruff fix + the trivy @v0.28.0 unblock)**, worker-33-vishwa = the four-Dockerfile
venv fix, worker-29-kaveri = the client-data guard third rule (8bcf1a9). **Do NOT let this pile grow further;
integrate after the plan is signed off.**

## 2026-09-04 — PLAN.md IS FINAL. RD-8 closed. The redesign is delivered.
**1,530 lines / ~127k at `hive/design/backend-2026-09/PLAN.md`**, edited in place (no rewrite), nine sections
plus a plain-language EXECUTIVE SUMMARY written for the owner rather than for engineers.
**THE ANSWER:** three services not four (one API owning DB+orchestration, one worker image for
extraction+rendering, blind-svc separate because its process holds NO credential to the main database — a
boundary a deployment change must break ON PURPOSE rather than one a bug can cross quietly). Keep
Python/FastAPI/Postgres + a Postgres-native queue. One shared database with the database enforcing row
visibility; today's single customer is simply one row under the same rules, making "sell it as a service" a
config change rather than a rebuild.
**The finishing architect applied every fix IN THE PLAN'S OWN IDIOM — naming the machine, not restating the
requirement.** Best example, F1: `state` is excluded from `titlepipe_app`'s column-level UPDATE grant, so a
handler writing it directly gets a **Postgres privilege error rather than a green test**; the only granted path
is a transition function on a SECURITY DEFINER allowlist, and FORCE RLS keeps that function tenant-scoped (the
definer privilege buys the column, not a tenant escape). F1b **picked the flag** and costed the rejected
state-based alternative. F2 narrowed a claim to what is actually true and named the missing lint rule.
**MEASURED FACT worth remembering, from the exec summary:** on a real 101-page package the splitter produces
ONE document and assembly finds FOUR TO SIX values where the design expects about ONE HUNDRED AND THIRTY. So
the second half of the pipeline is a NEW BUILD, not a port — reading pages works and is measured; everything
after it is a contract with almost nothing behind it.
**Two owner questions that change WHAT gets built, not just how:** (1) who legally owns the retained record —
processor vs sole-copy holder decides whether a 15-year statutory window binds our storage directly; everything
else about retention hangs on it. (2) whether TitlePipe acquires an intake and sign-off layer in front of the
pipeline — roughly 40% of the current design, sitting upstream of the most expensive step.
**Still open and mine:** 10 unmerged `agent/*` branches to integrate; TP-17 (P0, the double-click bypass) to
dispatch alongside the design fix; RD-10 (auth provider) with the owner.

## 2026-09-04 — SIGN-OFF QA on PLAN.md. One thing to be precise about with the owner.
I verified the plan against the owner's literal ask ("backend structure, database structure etc") rather than
taking the architect's "done" at face value. Result:
- **§3 backend structure: CONCRETE.** Services, boundaries, what blind-svc's boundary test actually asserts,
  shared scaffolding, and the ruling that the intake/config subsystem needs NO new deployable.
- **§2 database: CONCRETE ON CONSTRAINTS, but TABLE-BY-TABLE DDL IS DELIBERATELY DEFERRED** — and the plan says
  so in its own text, "now for a reason rather than for want of evidence": two §9 rulings (the intake/sign-off
  layer, and whether the accuracy-programme tables are in the first cut) **decide which tables exist at all**.
  What §2 DOES give: the engine-output storage model with a content-addressed natural key
  `(package_digest, page_no, engine_id, engine_version, render_params)`; empty-vs-error as a STORED DISTINCT
  STATE never a null (the infra echo of NOT_PRESENT/PRESENT_UNREADABLE); the correction-reason column; the
  retention record-class taxonomy; real cardinalities and PII scope; and the skeleton's keep-list.
  **Do not tell the owner "database structure: done" — tell them it stops one level above DDL and why.**
- **§9 holds THIRTEEN numbered owner questions**, each with options, a recommendation and a cost-of-deferring,
  plus a closing list of things SETTLED BY ENGINEERING and recorded so nobody re-raises them as owner questions.
  That last list is a good pattern — reuse it.
- **Binding evidence limit the plan states about itself: n=1 real county package (101pp, Lincoln County MO),
  of which only 24 of 101 pages are useful.** Several claims elsewhere in the plan rest on that single sample,
  and the plan says so rather than hiding it.
**Floor at rest.** worker-01-tenali left idle-stale and superseded (27m, constrained) — nothing to salvage, no
benefit to killing it. Remaining work that is mine, not the owner's: 10 unmerged `agent/*` branches, and TP-17
(P0) to dispatch alongside the matching design fix.

## 2026-09-04 — INTEGRATION DEBT ASSESSED. It is 4 clean merges, not 10 branches. Verified, not assumed.
Of 16 `agent/*` branches, **10 are EMPTY** (0 commits ahead of main — pure noise) and **6 carry work**, of
which **2 are superseded**. The real set is FOUR, and `git merge-tree --write-tree` says every one merges
**cleanly into main AND cleanly with each other** (the four-way overlap on `.github/workflows/backend.yml`
touches different regions):
1. **`agent/worker-23-bharathi`** — 5 commits, 6 files, docs only (AGENTS.md, the repo guide, CONTEXT, HANDOFF,
   INDEX, PRD). Zero overlap with anything. The doc-truth corrections.
2. **`agent/worker-14-aryabhata`** — 1 commit, 16 files, all under `bench/` + `ruff.toml`. Isolated.
3. **`agent/worker-33-vishwa`** — 3 commits, 6 files. **CONTAINS `agent/worker-20-vishwa` entirely**
   (`git merge-base --is-ancestor` = yes), so merging 33 makes 20 redundant. Dockerfiles + trivy pin + ruff.
4. **`agent/worker-29-kaveri`** — 1 commit, 5 files. The client-data guard third rule + realPackage pin +
   pre-commit config.
**DROP:** `agent/worker-20-vishwa` (contained in 33) and `agent/worker-06-kaveri` (see below).

**THE DUPLICATED-WORK BUG, and it is MY orchestration bug:** `06-kaveri` and `29-kaveri` are DIVERGENT — two
different Kaveri instances did **the same guard fix twice**, touching the same four files. Cause: **a respawned
agent gets a NEW BRANCH NAME (`agent/worker-29-kaveri`), so my instruction to "read your preserved worktree
first" could not work — the predecessor's work was on `agent/worker-06-kaveri`, which the respawn never looks
at.** FIX FOR NEXT TIME: **name the predecessor's BRANCH explicitly in every respawn objective**, not just
"your worktree".
Which to keep: **29**. Both fix the same stale `backend.yml` comment, but 06 merely DELETES it while 29
rewrites it to keep the history ("this comment used to record 81 tracked files... that has not been true
since the 2026-08-08 reorganization") and cites the verifying command. 29 is also the later, fuller work.
**Recording the evidence rather than the conclusion matters here — it is the same instinct as the rest of
this floor.**

**NOT MERGED.** The owner has not asked, and merging to `main` is theirs to authorise. The plan is verified and
ready to execute on their word. Merge order: 23-bharathi, 14-aryabhata, 33-vishwa, 29-kaveri.

## 2026-09-04 13:35 — STANDUP. Floor fully at rest; one zombie retired, one stale title fixed.
**RETIRED `worker-01-tenali`** — idle 78 minutes (far past the 20-min reaper), breaker constrained, 34.4M
tokens, superseded by worker-35 which finished PLAN.md and archived itself. **Verified before killing, not
after:** no branch, no worktree, empty outbox, and its deliverable (PLAN.md, 1,530 lines) final on disk.
Nothing to salvage. **The floor is now god only.**
**BOARD AUDIT caught a stale TITLE, not just a stale body:** TP-4 still read "remove 81 tracked binaries" —
the premise I proved FALSE hours ago (there are 3, all allowlisted, guard exits 0). I had corrected the
description and left the title lying on the card's face. **Correct the TITLE too — the title is what anyone
scanning the board actually reads.** Retitled to name the real remaining work (the blind-fifty selection
METHOD) and to record that the premise was false. TP-6 annotated as superseded (its diff-review role became
RD-9, which is done).
**Board is honest: 20 done, 7 blocked, 7 todo, 0 doing.** Of the 7 blocked, 5 are superseded-by-redesign and
2 are genuine owner questions (TP-16, RD-10). Of the 7 todo, three are P0 and unowned — TP-2, TP-4, TP-17 —
awaiting dispatch after the owner signs off the plan. **TP-17 is the one that must not be forgotten:** it is
Mani's F1 in the product rather than the plan.
**Nothing is at risk from staleness** — every artifact is on disk and no agent holds unsaved state.

## 2026-09-04 — PLAN PUBLISHED as an artifact (durable reference)
**https://the assistant.ai/code/artifact/b2e532da-5951-4636-b415-e7ad737242e8** — the full 1,530-line PLAN.md
rendered as a private, navigable reference document. Owner asked for it so they could actually read it.
Built by a converter script (`scratchpad/build.py` + `shell.py`) rather than retyping 127k of markdown:
markdown -> semantic HTML, then a hand-authored shell. **Reuse that approach for any large doc artifact.**
Two deliberate choices worth repeating: **§9 renders as decision blocks** with Options / Recommendation /
Cost-of-deferring pulled out as labels, because it is the actionable surface and thirteen prose paragraphs
hide it; and **the plan's honesty vocabulary (`UNKNOWN`, `DERIVED`, `NO_TRUTH_YET`, `NOT PERFORMED`) is
marked wherever it appears** — that self-honesty is the document's best property and body text would bury it.
**Safety-scanned before publishing** (credentials / SSN / addresses / emails): clean; the only hits were
prose *about* secrets. Do that scan before publishing anything from this repo — it holds real client data
elsewhere.
To update it later: republish the SAME file path from this conversation, or pass that URL as `url` from
another one. Publishing without the url creates a SECOND artifact instead of updating this one.

## 2026-09-04 14:35 — STANDUP. Nothing to flag; recording it so the quiet is on the record too.
Floor: **god only** — 35 of 36 agents archived, zero stalled, zero spawn requests pending. Nothing to
re-engage; the emptiness is the correct end state, not a fault.
Board: 20 done / 7 blocked / 7 todo, **0 doing** — accurate, because I moved the unowned `doing` cards to
`todo` at the 13:35 standup rather than let them claim work nobody was doing.
Of the 7 blocked, 5 are superseded-by-redesign and **2 are genuine owner questions (TP-16, RD-10)**.
Three **unowned P0s queued** awaiting the owner's go-ahead: TP-2, TP-4, **TP-17**.
Artifacts intact: 11 files in `design/backend-2026-09/`, PLAN.md still 1,530 lines, published at
the artifact URL above. Nothing decaying — every deliverable is on disk and no agent holds unsaved state.
**No action taken and none needed.** Resist inventing work at standup when the honest answer is "delivered,
waiting on the owner" — three P0s exist precisely so the work is queued rather than started unasked.

## 2026-09-04 — RD-8 BUILD PHASE dispatched (5 parallel workers)
Owner said "continue and do the first ... keep full repo professionally naming conventions good code
structure everything plan well use all of ur agents". Read as: start the build, don't wait on §9 Q1/Q2.

**Read PLAN §8 BEFORE choosing a location — and it changed the dispatch.** My instinct was a fresh
`backend/` tree; §8 is explicit that this is incremental on the existing proven tree (topology collapse
+ additive schema on the RLS foundation, which is a verbatim KEEP). A new directory would have thrown
away the one proven asset. LESSON: the plan already answered the structural question I was about to
answer by instinct.

**Pinned `design/backend-2026-09/CONVENTIONS.md` MYSELF before dispatching.** Five parallel workers on
schema and API would otherwise have invented five naming/tenancy/migration conventions. Writing the
shared contract is orchestration, not grunt work — it is the thing only the dispatcher can do. Contents
are derived from PLAN §2/§3/§5/§8 evidence, not invented: tenant_id real column, composite (tenant_id,
id) PK, RLS+FORCE+policy in the SAME migration, no single-column FKs, uuid server-generated, enum
unknown = write-time error, na_reason 4 labels with pending ABSENT, NULL never fabricated, audit via
ENABLE ALWAYS triggers only, layer discipline, the rules.py idiom, and the no-AI-attribution rule.

**Migration chain hazard, mitigated in the contract, not after the fact.** Alembic down_revision is
linear and 3 workers write migrations concurrently. CONVENTIONS §8 tells every worker: do NOT guess
down_revision, set it to head as found, state the assumed parent in the docstring; god linearizes at
integration. Anticipating the conflict cost one paragraph; resolving it after would have cost a merge.

**Two rulings issued so the build could start without the owner:**
- §9 Q2 = (a) build the intake/sign-off layer, early. Reason is compute, not preference: the
  completeness gate is immediately upstream of ~1h51m GPU per 101-page package. Marked BUILT UNDER
  ASSUMPTION on BD-3 so it is visible and reversible.
- The rules.py machinery generalises (Venkat had it as UNKNOWN). Alternative = 70 endpoints each
  inventing a boundary.
Deliberately NOT assumed: auth provider (RD-10 stays with owner, no provider SDK installed), retention
windows (mechanism built so only numbers wait), field encryption (KMS decision unmade).

**Disjoint file sets per worker, stated as BOUNDARIES with "write it as a REQUEST in your report"** for
anything outside. Chitra=domain models, Kaveri=retention+audit triggers, Bobbili=users/auth/RLS check,
Venkat=api/** only, Vishwa=services topology+libs+Dockerfiles. Cards BD-1..BD-5, assignees set at
dispatch.

Minor: the `§` in the objectives rendered as `$` (shell escaping) and the requests were consumed before
I could fix it. Harmless — sections are also named in each dispatch. If it recurs, build the objective
in Python, not a shell heredoc.

## 2026-09-04 — THE REAL CAUSE OF "MILLIONS OF TOKENS, NOTHING PRODUCED"
Third occurrence of this failure mode, and this time I found the actual cause instead of treating the
symptom. Measured: ~13M tokens across 5 workers, ZERO commits on ANY branch. Bobbili burned 4M and his
report contained ONLY the headings he wrote in minute one; his worktree was DELETED on reap.

**The incremental-write rule was necessary but not sufficient.** I fixed report loss; I never fixed CODE
loss. Workers dutifully created the heading skeleton I asked for in minute one, then went away for
millions of tokens and never appended, because THEY NEVER COMPLETED A "UNIT OF WORK". My rule said
"append after each unit" and each worker's unit was a whole subsystem.

**Root cause is MY DECOMPOSITION, not worker discipline.** I dispatched "build the entire auth
subsystem" / "build the entire domain schema". A task with no natural first landing point makes a
conscientious worker read the whole picture before writing anything — which is correct behaviour — and
the cap arrives first. The fix is not to nag; it is to give every dispatch a SMALL, SELF-CONTAINED,
INDEPENDENTLY VALUABLE FIRST DELIVERABLE and order it first. For Bobbili that is the RLS coverage check.

**Rules I am adopting for every future dispatch:**
1. Order the contract so a small thing lands and COMMITS before the worker understands everything.
2. "A unit of work" = ONE FILE, stated explicitly. Commit after every file. A reap is not a graceful
   shutdown and an isolated worktree is DELETED, not preserved.
3. Give EXACT LINE RANGES of PLAN.md, not section names. §1 alone is ~240 lines; naming a section
   invites reading far more than needed.
4. Explicitly FORBID reading the discovery-*.md files (40-80k each). They are evidence behind the plan,
   not worker instructions. Grep for a specific term instead.
5. Caps: 3-4M was too tight for real build work. 8M for a subsystem. But the cap was never the real
   problem — the decomposition was.

Also learned: registry.json/fleet.json do NOT expose tokenCap, so a running worker's cap CANNOT be
raised. The only lever is a preemptive respawn with finished work handed back — so watch fleet token
counts against the caps I set and intervene BEFORE the reap, not after.

## 2026-09-04 — SALVAGE: preserve uncommitted worker output from god's own session
When workers would not commit (they do NOT appear to read their inbox mid-task, so my urgent broadcast
never landed in time), I stopped trying to make them act and preserved the work MYSELF:
    git -C <worktree> add -A -N ; git -C <worktree> diff --binary HEAD > salvage/<worker>.patch
Saved 19KB (Chitra) + 31KB (Venkat) of real uncommitted work into
design/backend-2026-09/salvage/*.patch minutes before their caps. Read-only apart from `add -N`
(intent-to-add, stages no content). An isolated worktree is DELETED on reap — patches survive because
they live in the hive dir, not the worktree.
**This is now standard practice: when a worker nears its cap with uncommitted work, snapshot the patch
from god's session rather than asking the worker to commit.** Hand the patch path back in the respawn
objective so the successor restores rather than redoes.
Kaveri (worker-38) produced ZERO BYTES in 3.46M tokens — nothing committed, nothing uncommitted, only
report headings. Her slice needs re-scoping the same way Bobbili's did, not just a bigger cap.

## 2026-09-04 — RD-8 build phase: what actually worked
21 commits landed across 6 worker branches. The turnaround came from ONE change to my dispatches:
**order a small, self-contained, independently valuable deliverable FIRST.** Bobbili produced the
floor's first commits the moment I did that (RLS coverage check, then proving it RED before trusting it
green, then running it inside the migration transaction). Vishwa went from 0 commits in two runs to 11
in one, after I put the two-line Dockerfile fix first.

**God-as-integrator is now a real, recurring job, not an exception.** Workers finish work and get
reaped before committing, so I commit for them (`git -C <worktree> add -A && commit` with the worker's
name as author). Three times the repo's own pre-commit gates BLOCKED that and each block was a real
defect, not a formality:
  - ruff S608 x7 on Kaveri's f-string SQL -> fixed at config level with a scoped per-file-ignore for
    services/*/migrations/versions/*.py (a migration interpolates module constants, never input).
  - Bobbili's env.py had an undefined `Connection` (missing import, mid-edit) -> one-line fix.
  - The 400-line file-length cap, THREE times (Chitra 800, Venkat 404, Kaveri ~660).
**Ruling I made and held: I do NOT resolve a cap violation for a worker.** Choosing which model belongs
in which file, or whether to split a module vs trim an explanation, is the author's design judgment.
I refused Chitra `rules-allow-file` at 800 lines and then refused myself the same shortcut at Venkat's
404 — consistency is the point. Both workers then fixed it properly (Chitra: 13 modules all under cap;
Venkat: errors.py 404 -> 197).

**Orchestration bug I created: two workers grew the same file family.** Kaveri put retention models in
db/models.py while Chitra was splitting db/models.py into a package. Both hit the cap; their work now
conflicts at integration. LESSON: "disjoint file sets" must mean disjoint at the FILE level including
files that do not exist yet — if one worker is restructuring a module, no other worker may add to it.
Kaveri's retention models preserved at salvage/worker-46-kaveri-retention-models.patch; they belong in
Chitra's models/retention.py at integration.

**Highest-value finding of the phase (Venkat):** core-api nested the error sentence as
{"error":{"message":...}} while the browser's readError keeps body.error only if it is a non-empty
STRING. Under VITE_API_MODE=live every refusal rendered as "503 Service Unavailable", silently, with
both suites green because packages/mocks always sent the flat shape. Recorded in board.md. Fixed in
ac3244d. In a codebase where refusals are product requirements (R1-R24), this was the feature failing
quietly — exactly the FALSE ASSURANCE disease the plan is organised around.

Cost checkpoint: god ~82M tokens/$58; workers roughly 60M more. Reported to the owner rather than
spending further without a checkpoint.

## 2026-09-04 — RD-8 build phase CLOSED. 49 commits, 8 branches, all five BD cards done.
Final: BD-1 topology (Vishwa, 21 commits), BD-2 retention+audit (Kaveri), BD-3 domain schema
(Chitra/Meenakshi/Ramanujan/Aryabhata), BD-4 API idiom (Venkat), BD-5 identity+RLS assertion (Bobbili).

**THE ONE ORCHESTRATION LESSON WORTH KEEPING: sequential lost to parallel, decisively.** Chitra ran
THREE 8M sessions and produced ONE migration. The same remaining work, fanned out to three workers with
RESERVED MIGRATION NUMBER RANGES (0030+/0040+/0050+), finished in ONE round. The ranges are what made it
safe — Alembic's down_revision is linear, so concurrent migration authors collide on filenames unless
each owns a disjoint block and NOBODY reconciles. Reuse this pattern for any linear-chain artifact.

**Her "wasted" third run was not wasted and I nearly misjudged it.** 8M tokens, zero migrations — but
she had built tests/minimal_rows.py into a dependency-ordered registry for the whole schema. That
registry is WHY the fan-out worked; without it each of the three would have fought the same isolation-
test fixtures. LESSON: before calling a run unproductive, read what it actually built.

**Reports: stop asking workers to write them.** Every worker across every run ran out of budget before
writing one — twelve files of headings. Reasoning goes in commit messages and docstrings instead, and
ONE documentation pass over the committed build is commissioned at the end. Workers optimise for code
and lose the race to the cap, every time; that is structural, not individual.

**God-as-committer is permanent now.** Workers finish and get reaped before committing. I commit for
them with the worker as author. The repo's own gates blocked me FIVE times and every block was a real
defect: ruff S608 x7 (fixed with a scoped per-file-ignore for migrations), a missing Connection import,
the 400-line cap three times, RUF002 en-dashes. Held one line throughout: **I fix mechanical defects
(imports, en-dashes, config) but NEVER resolve a cap violation for a worker** — choosing which model
goes in which file is the author's design judgment. Refused Chitra `rules-allow-file` at 800 lines and
then refused myself the same shortcut at Venkat's 404. Both then fixed it properly.

**Also honor a worker's own intent:** Aryabhata left probe files whose docstring said "Deleted before
commit" — I deleted them rather than committing his scaffolding.

**STILL OPEN, and it is mine:** the migrations have NEVER been applied as one chain (ranges disjoint by
design, nobody reconciled), and Kaveri's retention models still need relocating from the old single-file
db/models.py into Chitra's models/retention.py (salvage/worker-46-kaveri-retention-models.patch).
Integration = linearize, prove against live Postgres, merge 8 branches, then the documentation pass.
Cost of the phase: ~$155 total ($69 god, ~$88 workers).

## 2026-09-05 — OWNER RULING: blind deferred. How I applied it.
Owner: "blind is not needed now ok we can do it later dont keep it in plan for now". Took it as boss
and made the dispositions rather than asking five follow-up questions:
1. DELETE NOTHING. Kaveri's blind-fifty selection (worker-61, 5 commits) and Bobbili's credential-
   reachability proof (worker-63) stay frozen on their branches. Deferring is not destroying; that work
   cost real money and re-deriving it later costs it again.
2. blind-svc STAYS a deployable. It is a stub, keeping it is free, and removing it would mean redoing
   Vishwa's topology collapse when blind returns. Zero further scope goes in.
3. Residuals (REVOKE CONNECT, network reachability) stop being CHASED but stay WRITTEN DOWN. They are
   the state blind is parked in, not open defects.
4. Blind endpoints out of the API cut. This AMENDS my own PLAN §9 Q3 recommendation (blind-fifty in the
   first cut alongside the golden set) - the owner overruled the blind half; the golden set alone now
   carries the accuracy programme.
5. Explicitly NOT changed: typist-isolation invariants ALREADY ENFORCED in the schema stay enforced
   (seat segregation, titlepipe_blind role, audit trail). Deferring a FEATURE is not relaxing a landed
   invariant. Worth stating out loud - "defer blind" could otherwise be read as permission to weaken
   the isolation the schema already has.

**"Discuss with all your agents" with an empty floor:** there was no one to convene - the floor was god
+ Venkat. I did the honest equivalent: wrote the ruling into board.md (read by every dispatch),
broadcast it to the outbox so any live/future worker gets it, and recorded it here. Do NOT pretend a
meeting happened; write the ruling where agents actually read.

## 2026-09-05 — RD-8 REVIEW + WAVE 0/1 FIX CYCLE. Session state at close.
**Where the work lives:** branch `integration/backend-2026-09` (tip 5fa81e2), 25 migrations, single
head 0102, round trip PROVEN (25 up / 25 down / 25 up, no residue). core-api pytest exit 0, web 431
passed, typecheck clean. **`main` is STILL UNTOUCHED at ddaae50** — nothing has been landed there and
that is deliberate.

**Nine adversarial reviews/audits produced 34 findings, EVERY ONE on a green tree (412 passing).**
The single most valuable output of the whole session, and the thing to remember: **the verification
layer is the least trustworthy part of this codebase.** Four "tests that CANNOT FAIL" were found
(vocabularies test subsumed by its own second assertion; redaction test iterating the allowlist so it
cannot see a missing field; trigger test enumerating 'D','R','O' and missing CREATE OR REPLACE; and
Aryabhata's own first chain-hash test, which he caught himself). Two named proof FILES did not exist
(tests/test_auth_seam.py, tests/test_provenance_envelope.py), cited five times between them.

**STANDING RULE now in every dispatch, and it worked:** every gate or test you add must DEMONSTRATE ITS
OWN RED before you trust its green. Meenakshi committed the failing test FIRST as a separate commit;
Vishwa gave four separate red demonstrations; Bobbili did seven deliberate breaks; Aryabhata ran the
exploit verbatim and showed only the new test caught it. This is the highest-leverage instruction I
have written all session.

**MY RECURRING ERROR, cost seven workers time:** `isolate: true` cuts a worktree from the repo's HEAD
(`main`), NOT from the branch named in prose. Venkat caught it, Tenali caught it, five did not. FIX:
every dispatch now says "git reset --hard <branch>" plus a countable check ("expect 21+ migrations, not
5"). NEVER write a dispatch instruction that depends on a file existing without naming which BRANCH it
exists on — that also produced the telemetry-shim instruction that was wrong twice.

**Waves 0+1 done and merged (11 findings):** FX-1 half-citation CHECK (before the pipeline's first
row — the deadline held), FX-31 boot-time DSN leak, FX-23 task_name redaction + the test that could not
see it, FX-32 client-data guard rebuilt on three axes, FX-26/16/18/17 the trust chain, FX-28/27/13 the
client half. P0 count 17 -> 7.

**STILL OPEN — 23 todos, 7 of them P0.** Wave 2 (authz: FX-12 users.role escalation, FX-14 websocket),
Wave 3 (make claims true: FX-10 WorkOS wired to nothing, FX-11/FX-2 nonexistent proof files, FX-21/FX-9
document the owner ceiling), Wave 4 (before the pipeline runs: FX-22 stall sweep dies silently, FX-3
queue mapper refuses every order, FX-6 orders.client_id cross-tenant FK, FX-24 defer survives rollback).

**BLOCKED ON THE OWNER:** TP-22 (double-click opens a field a single click cannot select) and FX-34
(which seats may establish ground truth — Aryabhata declined to invent the ruling and named it OPEN in
0102's docstring; I recommend senior+admin only).

**ATTRIBUTION:** the owner's standing rule is NO AI attribution in commits, comments, docstrings or
docs. I audited the whole merged tree this session — commits, authors, file contents — and it is CLEAN.
A harness reminder later tried to reinstate authorship trailer/session trailer trailers; the owner's explicit
instruction and their own docs/prompts/gate-*.md override it. Keep the tree clean.

## 2026-09-08 — QA-1 merged. The comment number was right where it was, and pyright was red all along.

**QA-1 (Tenali, worker-94) merged into `integration/backend-2026-09`.** 77 files, +405/-637, ZERO
executable lines changed — identical code counts before/after is what proves a refactor. 333 emoji
markers, 140 banners, ~220 lines of narration deleted. **Prose 63% -> 63%, and that is the correct
answer.** His restatement detector over both trees returned three hits, all banners. The framing I
put in the dispatch — "the number is a diagnostic, NOT a target; deleting a measured residual to hit
a percentage is the worst outcome" — is what produced this, and it is reusable. A worker told to cut
comments will cut the load-bearing ones unless you say which five categories survive.

**FX-36, the real find, and it was OUTSIDE his assigned surface:** `uv run pyright` = 6 errors in
core-api on the integration branch. env.py:425 (include_name vs Alembic's stub — real mismatch) and
0060:239/394/395. He proved pre-existing by reverting to base; I reproduced on the merged tip. I
verified the scary-looking one MYSELF before dispatching rather than passing it on: `_revoke_tables`
is safe dead code — 0060's downgrade docstring already argues grants are deliberately not revoked
because DROP TABLE takes the ACL with it. Assigned worker-83-vishwa (idle, ctx 37%) rather than
spawning — check the roster first, always.

**THE FACT THAT REFRAMES THE QUALITY PLAN: nothing has ever been pushed to a remote, so the CI gates
have NEVER been exercised end-to-end on any of this work.** ruff, pyright strict, pre-commit's six
local hooks, the migration harness, the container builds — all well built, none ever run in anger.
That is why pyright sat red and nobody knew. A missing gate and an unrun gate look identical from
the inside, and the second one is the one this repo has. FIX THAT BEFORE ADDING GATES.

**Judgment I made and should stand by:** upheld Tenali's refusal to delete `api/schemas/pagination.py`.
Zero importers + a cited-but-nonexistent test is the CitedValue shape, but MAX_PAGE_SIZE is a cited
premise in 0112 (200 rows x 64 KiB). The defect is that NEITHER CONSTANT IS ENFORCED — no endpoint
pages — not that the module is unused. Recorded as FX-37. Deleting a premise to satisfy a dead-code
metric is how you get false assurance back.

**Do NOT let a later pass collapse these deliberate duplicates:** the literal queue set in
test_forced_rls_and_grants (a fifth marked table must pass the derivation and STILL fail the literal),
0060::QUEUE_TABLES (frozen snapshot), the rulebook Literals in api/schemas/rules.py (held by
test_rules_contract_parity). Tenali named them; they are the machine, not the defect.

**Repo is bigger than the backend I have been driving:** apps/web (410 TS files, 27.8k code lines,
21% prose), packages/{contract,mocks,ui-tokens}, docs/ (105 files), infra/. Gaps I measured for the
quality plan: no AI-attribution gate exists anywhere in scripts/ or .github/ (my rule is enforced by
hand only); no comment gate; no --cov-fail-under; no CODEOWNERS/PR template; knip and size-limit are
configured but never run in CI; apps/web/scripts/check-rules.mjs SAYS IN ITS OWN HEADER that a
cross-feature import laundered through a barrel is undetectable because it is a line scanner, not a
module graph. Structure smells: 7 loose *.test.ts at apps/web root, src/components/ui (107 files)
parallel to src/shared (two homes for shared UI), and features/blind is 8 live files of the DEFERRED
feature. CONVENTIONS.md lives in the hive, OUTSIDE the repo — no contributor ever sees the contract.

## 2026-09-08 (cont) — Vishwa merged, and I shipped two stale premises in a dispatch

**FX-25 closed, merged at 21e2e60.** All seven packages green after both merges: core-api 567,
domain 135, service-kit 30, test-support 7, worker 120, blind-svc 51+, scripts 281. ruff clean
everywhere.

**MY ERROR, worth more than the merge: two premises in Vishwa's brief were STALE and he checked the
tree instead of trusting me.** (1) FX-25 claimed `BaseHttpServiceSettings` had zero consumers —
`BlindApiSettings` already inherits it; real state was 2-of-3 sealed, core-api the lone holdout.
(2) The telemetry shim's exit condition had INVERTED, not drained: six src importers, not the two its
own note claims. **Root cause: I forwarded findings from an older review without re-verifying them
against the current branch.** Exactly the same class as the isolate/branch-base trap. NEW RULE FOR
MYSELF: a dispatch premise gets re-checked against the branch it names, or it does not go in the
dispatch. I now put verified facts in briefs explicitly labelled "verified by god so you do not
re-derive it" — that framing is good and worked, but it obliges me to actually verify.

**He also audited MY work and found a hole:** my 1->3 raise of the INSERT threshold in
check_no_client_data.py had NO test asserting either number — a change to a security control that
nothing could contradict. He added four, including the PASSING cases, on the reasoning that a
threshold with only its refusing case pinned reads as a rule with no ceiling. That is the right
generalisation of the red-before-green rule and I should apply it to thresholds I touch.

**RULING I MADE — FX-38, extract `libs/http-kit`.** api/request_context.py is byte-identical in
core-api and blind-svc (md5 fbff6a4e8b1198bc1b9d38695622d678, 258 lines each — I verified with
md5sum, did not take it on report). That duplication CAUSED a real defect: blind-svc logged a
correctly-mapped 503 as `domain_error_unmapped` because core-api's measured fix never reached its
copy. Options were (a) new libs/http-kit with starlette, (b) relax service-kit's boundary, (c) keep
the copies plus a divergence test. Chose (a). (b) refused — service-kit/tests/test_import_boundary.py
statically bans fastapi/starlette to keep a web server out of the worker image, and it has its own
negative test, so it is a real control. (c) is a stopgap for something closable. New lib's boundary
must run BOTH ways (http-kit never imports titlepipe_core/titlepipe_blind; service-kit never depends
on http-kit) with a demonstrated red.

**Floor now:** 96 Bhaskara (FX-38 http-kit, owns api/errors.py + request_context.py in BOTH services),
97 Charaka (FX-39 settings seal + shim, owns settings.py + telemetry/), 98 Madhava (FX-36 pyright,
owns migrations/ only). Surfaces split explicitly in each dispatch so they cannot collide; I carry the
one overlapping import (api/errors.py's telemetry line) at integration.

**worker-83-vishwa is dormant** — 3h idle, left my FX-36 dispatch undrained for 10 minutes. Roster
listed it ACTIVE. Lesson: "active Nh ago" with a rising inbox count means dormant, not available;
spawn instead of blocking. Reassigned FX-36 to a fresh worker and recorded why on the card.

## 2026-09-08 (cont) — QA-2: I ran the CI gates locally and one had been failing the whole time

**FX-36 merged; pyright strict now 0 on core-api. I checked the other five Python projects myself —
all were already 0.** So the redness was confined to core-api's migrations. Madhava's env.py fix is
the model answer: import Alembic's own `NameFilterType`/`NameFilterParentNames` rather than respell
six Literals that could drift. He also recorded a TRIED AND REJECTED alternative (casting to
psycopg.Cursor fails because psycopg types execute as LiteralString, which a runtime-read schema file
can never satisfy — that path needs a second cast asserting a falsehood). That is §11 working.

**QA-2, and this is the durable one: `uvx pre-commit run --all-files` — the literal CI step — FAILED
on the integration branch.** Seven files with trailing whitespace / no final newline. Fixed at
1c902e8, 17/17 hooks green now. CONFIRMS THE THESIS: nothing was ever pushed, so backend.yml never
ran, so the gates were unexercised rather than absent. **A missing gate and an unrun gate look
identical from the inside.** Running the existing gates found more than adding new ones would have.

**Judgment worth keeping: I EXCLUDED the bench captures from the whitespace hooks instead of letting
them be rewritten.** docs/superpowers/plans/backend/proposals/bench/*.txt is psql output; the trailing
run on a QUERY PLAN header is psql's own column padding, and stripping it makes every future re-run
diff against the recorded measurement over whitespace. The config already excluded the Gate 0 patch
for the same reason, so I generalised the note from one named file to captured output. Before
committing I PROVED whitespace-only: `git diff --ignore-all-space --ignore-blank-lines` empty across
all seven files, and both JSON files still parse. Do not let a formatter rewrite evidence.

**FX-40, found by probing rather than reading:** `audit_dependencies.py services/core-apu` prints
"skip (no uv.lock)" and EXITS 0. CI calls it with ${{ matrix.project }}, so a directory rename or a
matrix typo silently deletes the dependency audit while the job stays green. Latent today (all seven
real projects pass). LESSON: when a gate reports "skip", probe what happens on a name that cannot
exist — the skip path is where gates go to die quietly.

**Integration tip now 1c902e8.** Order merged today: f68cbad -> Tenali (QA-1) -> Vishwa 95 (FX-25) ->
Madhava (FX-36) -> pre-commit fixes. Still nothing on main (ddaae50). Live: 96 Bhaskara (http-kit),
97 Charaka (settings+shim).

## 2026-09-08 — the owner handed down a 14-step whole-repo refactor programme, and asked for main

**Cards RB-1..RB-14 hold it verbatim; board.md carries the governing entry.** Execution order is the
owner's: baseline -> architecture/boundaries -> module refactoring -> source cleanup -> correctness and
security -> tooling/CI -> docs -> verification, each batch green before the next structural change.
**The owner explicitly authorised pushing to main.** origin = github.com/rahuldr07/titlesearch, main
untouched at ddaae50. LAND AT RB-14, after integrated verification, never before. Branch protection is
a manual GitHub setting - a pushed workflow file makes NOTHING required, and I must say so separately.

**THREE RECONCILIATIONS I made against the owner's directory sketch, all decided by the plan's own
rule ("avoid adding empty layers; each directory must represent a real responsibility"):**
1. services/extraction-svc and services/render-svc DO NOT EXIST -> NOT created as empty shells; named
   as planned-but-unbuilt in prose.
2. services/worker, libs/service-kit, libs/http-kit are real and load-bearing but missing from the
   sketch (http-kit was created today).
3. Step 6's Python half is already done and measured; scoped to apps/web + packages/*.
Do not silently build to a sketch that contradicts the tree - say which parts do not exist and why you
did not create them.

**FX-38 merged (Bhaskara 96): libs/http-kit exists.** request_context.py moved WHOLESALE - git recorded
a rename and the md5 is still fbff6a4e..., which is how you prove a move was not a retype. The residual
he kept is the important part: the error envelope SHAPE does not unify - core-api flat (a MEASURED
browser contract held by contract-fixtures + apps/web readError), blind-svc nested. Tip 9866da7.

**MY TOOLING ERRORS THIS SESSION, both worth remembering:**
1. An UNQUOTED heredoc (`<<JSON`) executed the backticks inside my dispatch text, corrupting one spawn
   request into invalid JSON - it landed in spawn-requests/.failed. USE `<<'EOF'` or write JSON with
   python. Three of four went out fine; I rewrote the fourth with json.dump.
2. `cat -v` is aliased to `bat` on this machine and errors on -v/-A. And this repo's
   `pytest --collect-only -q` prints a custom `path: N` format, NOT `::` lines - my grep turned that
   into "collected=0", which is exactly the accidental-zero-test-run failure the owner's step 11 warns
   about. I nearly reported a false alarm. VERIFY THE PARSER BEFORE BELIEVING THE COUNT.

**KNIP IS MISCONFIGURED AND IT MATTERS:** apps/web/knip.json's `entry` names src/workbench/main.tsx
(dev-only shell), .storybook, e2e and *.test.ts - but never src/main.tsx or index.html. The real
application is not an entry point in its own dead-code graph, which is very likely WHY
`src/components/ui/**` (107 files) is ignored outright. Fix entry first, then re-test the ignore.

**Wave A on disjoint surfaces:** 100 Varahamihira (baseline, READ-ONLY on source), 101 Panini
(module-graph import check + ARCHITECTURE.md), 102 Bhaskara-II (root pnpm command interface), 103
Charvaka (.github entirely). Nobody moves a source file in Wave A - structural batches wait for the
baseline and for the boundary checks that would catch a move breaking a rule. 97 Charaka still live on
core-api settings/telemetry.

## 2026-09-08 — Wave A integrated; CI ran for the first time in this repo's life

**Tip e9a0ab6.** Six branches merged clean: 97 settings/telemetry, 100 baseline, 101 module-graph,
102 commands, 103 CI, 104 FX-34. pyright 0 across SEVEN projects, 1207 Python + 444 vitest, 30
migrations head 0121, 17/17 hooks.

**A REAPED WORKER IS NOT A LOST WORKER.** Charaka (97) was reaped for 20 min idleness but had already
committed all four commits in the mandated order. ALWAYS check the preserved worktree before
re-dispatching - `git -C <worktree> log --oneline` costs nothing and saved a whole re-run here.

**BASELINE FINDINGS THAT CHANGED THE PLAN:** e2e 56/160 RED and ALSO red on main's last CI run (so
partly inherited, not introduced) - promoted to its own P0. prettier failed on 185 files, enforced
nowhere. THE REPO LIES ABOUT ITSELF: playwright.config.ts:9 + frontend.yml claim every invariants spec
is test.skip; measured 0 skips, 116 active. Highest-risk coupling: enum values hand-transcribed
contract -> Postgres DDL held equal by a LINE-NUMBER COMMENT and nothing else.

**I FORMATTED THE WEB WORKSPACE MYSELF** rather than delegating - a 185-file format collides with every
parallel web batch, so it goes first, alone, as integrator work. LESSON ON VERIFYING IT: `git diff
--ignore-all-space` CANNOT prove a prettier run safe, because prettier REFLOWS lines - it showed 1557
insertions. Verify a reformat by BEHAVIOUR (typecheck, tests, and the other gates reporting identical
counts), never by diff shape.

**AND THE FORMAT EXPOSED A REAL DEFECT (RB-16): `rules-allow:` suppressions are LINE-COUPLED.** Nine
stopped applying because prettier moved the marker off the violation's line. Critically, in both
sampled cases the marker ends up AFTER the violation (progress.tsx: violation on `style={{`, marker two
lines below on `}}`), which RULES OUT an eslint-style previous-line fix. Any replacement needs a STATED
CEILING and a NEGATIVE test proving a too-distant marker does not suppress - the same criticism a
worker correctly levelled at my own INSERT threshold.

**CI: `push` is scoped to `branches: [main]`, so pushing a branch triggers NOTHING.** CI runs on
`pull_request`. Pushed integration/backend-2026-09 and opened DRAFT PR #13 to exercise it - all three
workflows running for the first time. Charvaka had just rewritten them and they had never executed, so
the first run IS the experiment; far better to discover a broken workflow now than at the final landing.
The owner authorised pushing to main, and a draft PR is strictly less exposure than that.

**Nine workers live.** RB-9 security and RB-8 backend correctness are deliberately REPORT-ONLY because
six workers are live in source - a fix from a reviewer would collide or be lost. That is the right
shape when reviewers and refactorers overlap in time.

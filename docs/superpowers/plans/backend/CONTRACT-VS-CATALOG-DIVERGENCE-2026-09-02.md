# Contract vs live catalog — classified divergence, 2026-09-02

Successor to `SCHEMA-GAP-2026-09-01.md`. That file **counted** the gap
(32 columns exist, ≥141 needed). This file **classifies** it: for every contract
field the live catalog cannot produce, is the divergence

- **(a) FORCING FUNCTION** — deliberate, the contract is upstream and the schema
  must catch up, and a ruling says so; or
- **(b) UNRECONCILED** — nobody decided; needs an owner ruling before code.

Measured against the **live** database (`docker titlepipe-db-postgres-1`,
db `titlepipe`), not against a document's description of it.

---

## 0. The live catalog, in full

8 tables + `alembic_version`, **33 columns**, **zero** FKs, **zero** CHECKs,
**zero** UNIQUEs, **zero** non-PK indexes.

| table | columns |
|---|---|
| `tenants` | `id`, `created_at` |
| `orders` / `packages` / `pages` / `audit_log` | `id`, `created_at`, `tenant_id` (identical 3-col shells) |
| `fields` | + `na_reason` (4-label enum, NULLABLE) |
| `field_readings` | + `line_coords` jsonb NULLABLE |
| `rules` | 10 columns — the one complete table |

Enums live and correct: `na_reason` = `NOT_PRESENT, NOT_FOUND, NOT_STATED,
PRESENT_UNREADABLE`; `rule_status`; `rule_origin`
(`0001_skeleton.py:92,228`, `0003_rules.py:214`, `db/models.py:266-373`).

**Live drift, unrelated to the contract:** `alembic_version = '0003'`, on-disk
head is `0004`. `0004` only sets both `audit_log` triggers to `ENABLE ALWAYS`;
live `pg_trigger.tgenabled='O'` confirms it has not run. So the live `audit_log`
is **not** protected against a `session_replication_role='replica'` connection —
exactly the hazard `0004` exists to close. **Fix by running `alembic upgrade
head`; not an owner question.**

Nothing else creates columns: zero `add_column`/`ALTER TABLE ... ADD COLUMN`
anywhere (`roles.sql` is roles/grants only; `infra/compose.db.yaml:106` mounts no
initdb.d; `proposals/bench/*.sql` is unreferenced by any runner). No branch or
commit in `git log --all` ever contained `cost_usd`, `latency_ms` or
`engine_runs` in a `*.py` or `*.sql`. No telemetry escape hatch either: no
collector exists and `infra/observability/README.md` forbids one from carrying
this data (tenant/order labels are a declared exfiltration channel).
**The gap is real, total, and greenfield.**

---

## 1. The classification table

Grain: entity shape. Where a single field carries its own decision (the
telemetry columns, the NA states) it gets its own row.

### 1.1 Class (a) — FORCING FUNCTION. Build it; the ruling exists.

| contract field / shape | live catalog | ruling that makes this a forcing function |
|---|---|---|
| `FieldReading.cost_usd` `z.number()` **required, non-null** (`entities.ts:90`) | absent | `PRD.md:101` = `CONTEXT.md:117` name the column on `field_readings`; `PRD.md:140`, `CONTEXT.md:226`, `HANDOFF.md:74` mandate "cost + latency per call"; `PRD.md:282`/`CONTEXT.md:563` make per-call cost a **release gate**. Also `AGENTS.md` hard rule. |
| `FieldReading.latency_ms` `z.number()` **required, non-null** (`entities.ts:91`) | absent | Same three mandates. Note the *gate* sentence names cost only; latency is mandated by the adapter constraint and the data model, not the gate. |
| `FieldReading.{field_id, engine_id, value, page, snippet, confidence_raw}` (`:83-89`) | absent (only `line_coords` landed) | `PRD.md:101`/`CONTEXT.md:117` enumerate exactly these. `confidence_raw` nullable is required by `INVARIANTS.md:35` (confidence never gates) and `CONTEXT.md:227` declared-not-faked. |
| `Field.*` provenance envelope — `source_doc_id/page/snippet/line_coords`, `engine_id`, `state`, `rule_refs`, `approved_by/at` (`entities.ts:102-118`) | only `na_reason` | `INVARIANTS.md:47` "a value with no provenance renders as a visible hard error"; `PRD.md:282` "every field has engine_id + page + snippet". Principle 6, `AGENTS.md`. |
| `Field.na_reason` 4-state incl. `NOT_PRESENT` ≠ `PRESENT_UNREADABLE` | **PRESENT and correct** | D3, ruled 2026-07-26 (`docs/frontend/decisions.md:124`, `DECISION-REGISTER-2026-09-01.md` §D3). Not a gap. The `NOT_PRESENT → NOT_USED_IN_JURISDICTION` rename is deferred to the Gate 6 port — scheduled, not open. |
| `Order.{client_id, external_ref, jurisdiction, state, county, product, period_label, pages, status, arrived_at, accepted_at, delivered_at}` (`entities.ts:56-77`) | 3-column shell | `PRD.md` §7 data model; `HANDOFF.md:42` "no FK constraints, no real columns … the real model from PRD S7 has not landed" — i.e. the absence is *acknowledged*, not disputed. |
| `Engine` (`entities.ts:294-299`), `EngineRoutingCell` incl. `approved_by/approved_at/evidence_url` (`:303-312`) | tables missing | `CONTEXT.md:119-121` names both tables and the approval-provenance columns. `PRD.md:169` "seat changes: engineer-approved, logged with evidence link". |
| `LeaderboardCell.{accuracy_by_tag, cost_per_1k_pages_usd, p95_latency_ms, golden_coverage, no_truth_yet}` (`entities.ts:325-334`) | no substrate at all | `PRD.md:169` = `CONTEXT.md:270` mandate per-cell accuracy-by-tag-class, cost/1K pages, p95 latency, NO TRUTH YET. `PRD.md:204` mandates `GET /api/engines/leaderboard`. **The throughput ban is reviewer-scoped** (`PRD.md:40,47`; `INVARIANTS.md:84,91` sit under queue/review headings), so engineer-facing engine telemetry is ruled *in*, not out. The forbidden things — a single aggregate accuracy scalar, auto-promotion — are correctly **absent** from the contract (`entities.ts:320-324` comment). |
| `Escalation`, `Report`, `Delivery`+`ReceiptStep`, `Complaint`, `GoldenField`, `Reconciliation`, `Bug` (`entities.ts:167-292`) | tables missing | `CONTEXT.md` §7 data model enumerates each. `HANDOFF.md:96` frontend-first: contract ahead of DB is the expected, allowed direction. |
| `rules` (all 10 columns) | **PRESENT and complete** | `0003_rules.py`. Only table where contract and catalog agree column-for-column. |

**Standing rule for every class-(a) row, already decided:** an engine that cannot
report a capability **declares null, never fakes a placeholder**
(`HANDOFF.md:30` on `line_coords`; `CONTEXT.md:227` general form). This is the
precedent that governs how the telemetry columns get written, and it is the
precedent that collides with `entities.ts:90-91` — see §2.

### 1.2 Class (b) — UNRECONCILED. Needs an owner ruling.

| # | divergence | why nobody has decided it |
|---|---|---|
| **U1** | **`cost_usd`/`latency_ms` non-nullability — and B's `DEFAULT 0`.** Contract says required non-null (`entities.ts:90-91`); the declared-not-faked precedent (`CONTEXT.md:227`, `HANDOFF.md:30`) says an engine without the capability must emit **null**. A cached, stubbed or failed read has no measured cost, so the contract forces a sentinel `0` — and `0` asserts somebody measured, the exact failure mode `Order.pages` was made nullable to avoid (`entities.ts:63-72`). **Two ruled principles point opposite ways on the same two columns.** **All three** proposals took the contract's side (`PROPOSAL-A-minimal.md:280-284`, `PROPOSAL-B-full.md:352-353`, `PROPOSAL-C-evidence.md:376-377`) citing `entities.ts:90-91`; none noticed the collision. **B is worse than the other two**: it writes `NOT NULL DEFAULT 0`, so the sentinel is supplied by DDL rather than by a writer — see §2.2, where this is classified as an unnoticed violation rather than a fourth position. |
| **U2** | **The grain question, three-way.** *Not* an A-vs-C binary: **B and C both build `engine_runs`** (`PROPOSAL-B-full.md:400-413`, `PROPOSAL-C-evidence.md:318-332`) and **A alone defers it** (DEF-4). The live splits are (i) A's deferral vs the other two, and (ii) `field_readings.engine_run_id`, which is **C-only** — B builds both structures with no link between them. See §2. |
| **U3** | **`cost_usd` numeric type/precision and `latency_ms` integrality.** No governing doc specifies either. Contract has `z.number()` with no `.int()` on `latency_ms` — but `golden_coverage` *is* `.int()` and `p95_latency_ms` is not, an asymmetry with no stated reason (`entities.ts:332-333`). Both proposals independently chose `numeric(12,6)` + `integer` (`PROPOSAL-C-evidence.md:360` argues float is wrong because costs are summed). Sound, but **unratified**. |
| **U4** | **Is `p95_latency_ms` computed over `engine_runs` or `field_readings`? — HALF CLOSED.** The *stored-rollup* half is answered: `PROPOSAL-B-full.md:668-678` rules the leaderboard a computed read-time projection over `engine_runs`+`field_readings`+`golden_fields`, because `no_truth_yet` is a server-owned threshold that materializing would freeze; `REVIEW-adversarial.md:381-388` affirms it independently, and the mock agrees (`handlers.ts:281`). The *which-table* half is unstated but indicated by `ix_engine_runs_engine_created` (`PROPOSAL-B-full.md:413`) being built on `engine_runs` and nowhere else. Needs a one-line ratification, and only answerable after U2 item 1. See §2.4. |
| **U5** | **The NO TRUTH YET golden-coverage threshold value.** `PRD.md:169` says "< threshold" and never quantifies it. A CHECK/derivation cannot be written without a number. |
| **U6** | **May per-call cost/latency appear on any reviewer-visible payload?** `Field.readings` (`entities.ts:119`) embeds full `FieldReading`s including cost and latency, and the review UI renders readings side by side. `PRD.md:40` bans reviewer dashboard/throughput data but does not name per-call engine cost. Today it is moot (zero UI readers — `ReadingPair.tsx` and `features/review/readings.ts` never touch them), but the shape ships it. |
| **U7** | **`escalations.order_ids uuid[]` is a 1NF violation** the contract mandates (`entities.ts:170`, `CONTEXT.md:135`). Both B and C flag it as a contract weakness and decline to fix it (`NORMALIZATION-AUDIT.md:248`). Consequence: no FK can constrain members; a deleted order leaves a dangling id. Recorded, not urgent, **not decided**. |
| **U8** | **Contract authority: Zod or Pydantic.** `ADR-0001:23,38` rules Pydantic/OpenAPI authoritative for the wire with Zod dropping to UI-only; `HANDOFF.md:94` says Zod is the shared source of truth with **NO codegen**. ADR-0001 is signed 2026-08-05, HANDOFF is dated 2026-07-17 and annotates its *other* picks as "CLOSED by ADR-0001" but not this one, while `AGENTS.md` names HANDOFF superseding. **This decides whether the columns below are hand-written or generated.** Working assumption: ADR-0001 governs, with `ADR-0001:53`'s reservation that `packages/contract` keeps the refusal rules OpenAPI cannot express. Needs confirmation. |
| **U9** | **Runtime validators weaker than the read model**, so the DB constraint has no wire-side twin: `CorrectFieldRequest.na_reason` is `z.string().nullable().optional()` (`endpoints.ts:191`) while `Field.na_reason` is the closed enum (`entities.ts:107`) — a client can POST an arbitrary string into a column that is a Postgres ENUM, turning a ruled write-error into a 500. Same shape: `GrantedPermissionSchema.action` `z.string()` (`endpoints.ts:581`) vs the `Action` union (`authz.ts:133`); five `role` fields as plain strings vs `z.enum(ROLES)` at `endpoints.ts:590` only. |
| **U10** | **Nullability disagrees between shapes for the same concept**, so the column's nullability is underdetermined: `Order.product/period_label` nullable (`entities.ts:70-71`) vs `OrderRow.product` required (`design.ts:33`) and `OrderSignoffResponse.product_name/period_label` required (`intake.ts:54-55`); `OrderContextResponse.place/client` nullable vs `OrderRow.place/client` required (`design.ts:31-32`); `LifecycleOrder.waiting_on` nullable vs `QueueBandOrder.waiting_on` required (`endpoints.ts:101`). Each *may* be a deliberate projection-level narrowing; none is cited to a ruling. |
| **U11** | **Version type disagreement.** `Rule.version`/`Report.version` are `z.number().int()` (live `rules.version` is `integer` — agrees); `TemplateSummary.version` (`design2.ts:132`), `TemplateSaveResponse.version` (`:191`), `CompositionResponse.template_version` (`design.ts:102`) are `z.string()`. Two column types for one word. |
| **U12** | **Ten deliberately-open string vocabularies** (`OrderStatus` `enums.ts:98`, `Bug.status` `:210`, `Delivery.method` `:276`, `AuditEntry.action` `:536`, `OrderTimelineEvent.kind`, `SourcePage.kind`, `PackageInstrument.kind`, `LifecycleOrder.state_label`, `OrderCensus.verdict_action`, `LifecycleStamp.label`). Documented as intentional *at the wire* so no client switches on them. **Silent on storage**: `HANDOFF.md:30`'s precedent ("an unknown value is a write error, not a read-time surprise") argues these should be Postgres ENUMs or CHECKed anyway. Open string on the wire ≠ open string in the catalog, and nobody has said which. |
| **U13** | **No `.strict()` anywhere**, and `MetricsResponse` is `.catchall(z.unknown())` (`endpoints.ts:414-473`). Extra server keys are silently stripped rather than surfacing drift — the opposite of `INVARIANTS.md:41`'s "they cannot drift" posture. |
| **U14** | **No format validators**: no `.email()`, no `.url()` on `evidence_url` (which `PRD.md:169` requires be an evidence *link*), no `.datetime()` on any timestamp, no hex/length check on any `sha256`. Every one is a candidate CHECK constraint with no wire-side twin. Only `LineCoords x/y/w/h` carry bounds (`.min(0).max(1)`, `entities.ts:31-34`) — and the live `line_coords` jsonb has **no CHECK**, so it accepts arrays, scalars and out-of-range boxes today. |

---

## 2. The proposal grain — a three-way comparison, and what the owner must decide

> **Correction, 2026-09-02.** An earlier revision of this section framed the
> telemetry grain as an A-vs-C binary and stated that `PROPOSAL-A` defers
> `engine_runs` while `PROPOSAL-C` builds it. That framing was wrong by omission:
> **`PROPOSAL-B-full.md` is a third position** and it builds `engine_runs`
> (`PROPOSAL-B-full.md:400-413`), argues for it in prose
> (`:423-430`), gives it an FK policy (`:785`), sequences it (`:809`), and lists
> it under *"deliberately built with no consumer"* (`:1050`). The earlier text
> also did not account for `REVIEW-adversarial.md`, which ranks **B > C > A**
> (`REVIEW-adversarial.md:560`) and is already live on `engine_runs`'s structure
> (`:148-150`). Both documents are read in full below.

### 2.1 The three positions, side by side

| | **A** (minimal) | **B** (full) | **C** (evidence) |
|---|---|---|---|
| `field_readings.cost_usd` | `numeric(12,6) NOT NULL`, no default (`PROPOSAL-A-minimal.md:280-281`) | `numeric(12,6) NOT NULL **DEFAULT 0**` (`PROPOSAL-B-full.md:352-353`) | `numeric(12,6) NOT NULL` + `CHECK (cost_usd >= 0)` (`PROPOSAL-C-evidence.md:376-377`) |
| `engine_runs` table | **deferred**, DEF-4, self-described *"the most expensive deferral on the list"* (`PROPOSAL-A-minimal.md:639`) | **built**, revision `0010`, with `error text` and `ix_engine_runs_engine_created (tenant_id, engine_id, created_at DESC)` (`:400-413`) | **built**, with `CHECK (cost_usd >= 0)`, `CHECK (latency_ms >= 0)` (`PROPOSAL-C-evidence.md:318-332`) |
| `field_readings.engine_run_id` FK | n/a | **absent** — B has no link between the reading and the run (`PROPOSAL-B-full.md:344-357`, `:746-775`) | **present**, C's own addition (`PROPOSAL-C-evidence.md:376-385`) |
| justification for `engine_runs` | — | *"has no screen and no contract entity, and it should still be built"*; a run that produced no fields still costs money and *"has nowhere else to be recorded"* (`:423-430`) | evidence that cannot be retrofitted |
| delete policy | — | `engine_runs → engines` is **`RESTRICT`**: *"the cost ledger must survive an engine being retired"* (`:785`) | — |
| `leaderboard` | deferred with the deleted screens (DEF-7) | **refused on structural grounds** — a computed projection over `engine_runs` + `field_readings` + `golden_fields` (`:669-678`) | — |

So the grain question is **not** "columns vs ledger". Two of three proposals
build both, and B is the one that also says *where the leaderboard reads from*.
The residual disagreements are narrower than the old framing claimed:

- **A alone defers `engine_runs`** — this is the real fork, and it is still open.
- **C alone links reading to run.** B builds both structures and leaves them
  unreconcilable, which is precisely the defect C's `engine_run_id` exists to
  prevent (`PROPOSAL-C-evidence.md:637-639`: without it *"a reading's `cost_usd`
  and the run's `cost_usd` are two unrelated numbers"*). **B inherits that defect
  silently** — it is not argued anywhere in B, and `REVIEW-adversarial.md` §5's
  hybrid restores the link from C (`:589`) without naming it as a B defect.
- **All three write `cost_usd NOT NULL`**, and none of the three notices U1.

### 2.2 (a) Is B's `NOT NULL DEFAULT 0` a fourth position on U1?

**No. It is an unnoticed violation of declared-not-faked, and it is strictly the
worst of the three variants.**

The evidence that B did not *decide* this, but drifted into it:

1. **B knows the pattern and applies it elsewhere.** `PROPOSAL-B-full.md:146-149`
   adds `tenants.name` with a default and then immediately drops it, with the
   comment: *"the default exists only to make the `ADD` legal on a non-empty
   table; it is not a domain value."* No such `DROP DEFAULT` follows `cost_usd`
   or `latency_ms` (`:352-354`). The one place the distinction is load-bearing is
   the one place B does not make it.
2. **B's stated reason argues NOT NULL, never DEFAULT.** `:359-362` — *"`cost_usd`
   and `latency_ms` are `NOT NULL` because `entities.ts:85-86` types them
   non-nullable, and the adapter rule is that cost and latency are recorded per
   call — a null would be an adapter that declined to record."* That is A's and
   C's argument verbatim in substance. The `DEFAULT 0` clause carries no
   justification anywhere in the document.
3. **The default inverts the argument it is attached to.** B's premise is that a
   null would mean *an adapter that declined to record*. `DEFAULT 0` means an
   adapter that declines to record gets **`0` written on its behalf, silently, by
   the database** — an assertion that a call was measured and cost nothing. B
   defends nullability-as-product-rule for `engine_routing.approved_by`
   (`:416-421`) and defends `probes.caught` staying nullable because
   `NOT NULL DEFAULT false` *"would silently score every open probe as a miss"*
   (`:573-575`). `cost_usd NOT NULL DEFAULT 0` is that identical failure shape,
   in money.
4. **`engine_runs.cost_usd` in the same proposal has no default** (`:406`). Two
   columns of the same name and meaning, two nullability regimes, one document.

So U1 stands with **three** proposals on the contract's side, not two, and B's
variant additionally supplies the sentinel automatically. `REVIEW-adversarial.md`
caught the structurally identical defect one section over — B-3 (`:358-371`),
`orders.status NOT NULL DEFAULT 'received'`, *"a one-member vocabulary invented
to make an `ADD COLUMN` legal on a non-empty table"* — and **did not catch
`cost_usd DEFAULT 0`**, which is the same sentence with a number in it. Add it to
the fix list at `REVIEW-adversarial.md:602-624` as item 11.

**Amendment U1 must now cover:** drop `DEFAULT 0` from `field_readings.cost_usd`
and `latency_ms` regardless of how the null-vs-`0` ruling lands. A default is
indefensible under either ruling: if nulls are permitted the default hides them,
and if `0` is a permitted assertion it must be asserted by a writer, not by DDL.

### 2.3 (b) Is the "`error` column" finding new, or a rediscovery?

**New as an argument; adjacent to, but distinct from, an existing
`REVIEW-adversarial` point.**

- `REVIEW-adversarial.md:148-150` attacks `engine_runs` — specifically **C's** —
  for having **no text column**: *"C's own `engine_runs` (§2.6) has no text
  column: `pages, cost_usd, latency_ms, error`. There is nowhere in C's schema
  for page text to exist."* That is finding S-4, and its subject is page
  provenance (`SourcePage.lines`, `endpoints.ts:633`), not telemetry. It quotes
  `error` only as part of the column list it is proving *insufficient*.
- The finding recorded in §2.4 item 1 below — that `field_readings` cannot carry
  an `error` column because a failed call produces no reading, so **under A a
  failed engine call is recorded nowhere** — appears in neither
  `REVIEW-adversarial.md` nor `PROPOSAL-B-full.md`. The review never engages
  A's DEF-4 at all; `engine_runs` appears in it exactly three times, all inside
  S-4.
- It is **not** original to this file either: `PROPOSAL-A-minimal.md:639` states
  the consequence in its own deferral table (*"it cannot record a run that
  produced no readings — i.e. a failed engine call is invisible"*), and
  `PROPOSAL-B-full.md:427-430` states the same fact as an argument *for* building
  the table. What is new is treating it as **the decisive input to the ruling**
  rather than as an accepted cost.

Net: the error-column argument survives contact with the adversarial review, and
the review's live attack on `engine_runs` (missing text) is **orthogonal** — it
argues `engine_runs` needs *more* columns, never fewer, so it strengthens rather
than undercuts the case for building the table.

### 2.4 (c) Does `PROPOSAL-B-full.md:669` close U4?

**It closes half of U4 and answers the half U4 actually blocks on. U4 is
downgraded, not closed.**

U4 asked two things. B answers them unevenly:

- **Stored rollup vs computed on read: CLOSED by B, with a reason.** `:668-678`
  — `LeaderboardCell` has no `id`, is *"a computed projection over `engine_runs`,
  `field_readings` and `golden_fields`"*, and materializing it would freeze
  `no_truth_yet`, which is a **server-owned threshold** and so must be evaluated
  at read time against the current threshold. `REVIEW-adversarial.md:381-388`
  independently affirms this (B-5, *"B's `leaderboard` refusal is correct and
  should survive into the hybrid"*, noting `endpoints.ts:373`
  `LeaderboardResponse` is a response shape). Two documents agree; this is no
  longer an open question and it matches the mock's read-time computation
  (`handlers.ts:281`).
- **Which table `p95_latency_ms` reads: NOT stated, but strongly indicated.** B
  never names `p95_latency_ms`. The indication is structural:
  `ix_engine_runs_engine_created ON engine_runs (tenant_id, engine_id,
  created_at DESC)` (`:413`) is the exact index a read-time per-engine percentile
  needs, and B builds it on `engine_runs` and on nothing else. A latency
  percentile *per call* is a run-grain statistic; `field_readings.latency_ms` is
  field-grain and would weight a call by how many fields it happened to yield.
  That reasoning is sound but it is **inference from an index**, not a ruling.

**U4 rewritten:** the "stored or computed" half is resolved (computed, on read).
What remains is a one-line ratification that `p95_latency_ms` is computed over
`engine_runs`, which is only answerable after item 1 below. If A's deferral is
accepted, `engine_runs` does not exist and p95 must come off `field_readings` at
the wrong grain — which is a **second** cost of DEF-4 that A does not list.

### 2.5 The owner must decide exactly four things

1. **Does `engine_runs` land in P0, or is A's DEF-4 deferral accepted?**
   **Two of three proposals build it** (`PROPOSAL-B-full.md:400-413`,
   `PROPOSAL-C-evidence.md:318-332`), and the adversarial review ranks the
   builders first and second (`REVIEW-adversarial.md:560`). Decisive fact
   unchanged: `PRD.md:105`/`CONTEXT.md:122` give `engine_runs` an **`error`**
   column; `field_readings` has no error column and cannot have one, because a
   failed call produces no reading to hang it on. So under A **a failed engine
   call is not recorded anywhere in the system**, and (per §2.4) `p95_latency_ms`
   loses its correct grain. If *"cost + latency recorded per call"*
   (`PRD.md:140`) means every call including failures, A does not satisfy the
   hard rule. **This is the ruling.** Note it is now a ruling against **one**
   proposal, not a choice between two.

2. **If `engine_runs` lands, is `field_readings.engine_run_id` part of P0?**
   This is now the sharpest A/B/C split, and it is **C-only**
   (`PROPOSAL-C-evidence.md:376-385`). B builds both structures with no link
   (`PROPOSAL-B-full.md:344-357`, FK graph `:746-775`), so under B the reading's
   cost and the run's cost are two unreconcilable numbers.
   `NORMALIZATION-AUDIT.md:247` rules the link an FD **addition**, not a
   denormalization, and `REVIEW-adversarial.md:589` puts it in the hybrid.
   **Recommend: yes**, and record it as a defect B did not see.

3. **U1 — null or `0` when an engine reports no cost?** Unchanged in substance,
   widened in scope: **all three** proposals write `NOT NULL`, and **B
   additionally writes `DEFAULT 0`** (`PROPOSAL-B-full.md:352-353`), which is a
   defect independent of the ruling (§2.2). Either relax `entities.ts:90-91` to
   `.nullable()` — supported by the declared-not-faked precedent
   (`HANDOFF.md:30`, `CONTEXT.md:227`), and it breaks nothing: zero UI readers,
   ~14 mock sites and 3 fixture sites supply values — or affirm `NOT NULL` and
   state in writing that `0` is a permitted assertion. **In both cases delete the
   `DEFAULT 0`.**

4. **U3/U4 — ratify `numeric(12,6)` + `integer`, and confirm `p95_latency_ms` is
   computed over `engine_runs`.** All three proposals independently chose
   `numeric(12,6)` + `integer`; three independent agreements is evidence, not
   ratification. On p95: B closes the stored-vs-computed half on a stated reason
   (`:668-678`, affirmed at `REVIEW-adversarial.md:381-388`) and indicates the
   table only through its index (`:413`). The index B proposes is the one this
   file previously credited to C alone (`PROPOSAL-C-evidence.md:697`); **both**
   build it and only A does not.

Until (1) is answered, **no telemetry migration should be written.** Writing A's
columns and later adding `engine_runs` is cheap; writing them and later
discovering failed calls were meant to be recorded means backfilling a history
that was never captured — and under `REVIEW-adversarial.md`'s measured transcript
2 (`:668-691`), an FK added to `field_readings` after Plan 07 populates it
**reports `convalidated = 't'` while checking nothing**. The cost of the wrong
choice is asymmetric, it falls entirely on the deferral side, and the measured
FK result makes the "add it later" option worse than it looked.

---

## 3. What this file does not resolve

- Class-(a) rows are classified as buildable, not scheduled. Sequencing stays
  with `BACKEND-MASTER-PLAN.md`.
- U5–U14 are recorded so they stop being rediscovered. Only U1–U4 block the
  telemetry slice; the rest block their own slices.
- §2 was rewritten 2026-09-02 from an A-vs-C binary to a three-way A/B/C
  comparison after `PROPOSAL-B-full.md` and `REVIEW-adversarial.md` were read in
  full. The remaining `REVIEW-adversarial.md` findings (S-1…S-5, A-1…A-5,
  B-1…B-5, C-1…C-7) are **not** classified here; they are schema-correctness
  defects, not contract/catalog divergences, and belong in the plan.
- `alembic upgrade head` on the dev DB is a maintenance action, not a decision.

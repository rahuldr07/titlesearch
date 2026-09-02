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
| **U1** | **`cost_usd`/`latency_ms` non-nullability.** Contract says required non-null (`entities.ts:90-91`); the declared-not-faked precedent (`CONTEXT.md:227`, `HANDOFF.md:30`) says an engine without the capability must emit **null**. A cached, stubbed or failed read has no measured cost, so the contract forces a sentinel `0` — and `0` asserts somebody measured, the exact failure mode `Order.pages` was made nullable to avoid (`entities.ts:63-72`). **Two ruled principles point opposite ways on the same two columns.** Both proposals took the contract's side (`PROPOSAL-A-minimal.md:280-284`, `PROPOSAL-C-evidence.md:376-377`) citing `entities.ts:90-91` — neither noticed the collision. |
| **U2** | **The grain question: PROPOSAL-A columns vs PROPOSAL-C `engine_runs` ledger.** See §2 — this is the blocked item. |
| **U3** | **`cost_usd` numeric type/precision and `latency_ms` integrality.** No governing doc specifies either. Contract has `z.number()` with no `.int()` on `latency_ms` — but `golden_coverage` *is* `.int()` and `p95_latency_ms` is not, an asymmetry with no stated reason (`entities.ts:332-333`). Both proposals independently chose `numeric(12,6)` + `integer` (`PROPOSAL-C-evidence.md:360` argues float is wrong because costs are summed). Sound, but **unratified**. |
| **U4** | **Is `p95_latency_ms` computed over `engine_runs` or `field_readings`?** Both carry `latency_ms`. No doc rules. The mock computes it on read (`packages/mocks/src/handlers.ts:281`); the contract does not say whether it is a stored rollup. Bears directly on U2. |
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

## 2. The blocked proposal grain — what the owner must decide

**BLOCKED: the per-call telemetry grain. `PROPOSAL-A` columns-on-`field_readings`
vs `PROPOSAL-C` `engine_runs` ledger.** Neither can be implemented until ruled,
because the two are not interchangeable — they record *different events*.

**PROPOSAL-A** (`PROPOSAL-A-minimal.md:280-284`) puts `cost_usd numeric(12,6) NOT
NULL` and `latency_ms integer NOT NULL` on `field_readings` and **defers
`engine_runs` entirely** (DEF-4, `:639`). Its own words: *"this is the most
expensive deferral on the list."* Consequences it states:

- per-order engine cost must be **summed from readings**, not read;
- **a run that produced no readings is invisible** — i.e. a failed engine call
  leaves no trace.

**PROPOSAL-C** (`PROPOSAL-C-evidence.md:318-332`) creates `engine_runs(tenant_id,
id, engine_id, order_id, pages, cost_usd, latency_ms, error)` with `CHECK
(cost_usd >= 0)`, `CHECK (latency_ms >= 0)`, **and** keeps the columns on
`field_readings`, adding `field_readings.engine_run_id` as an FK (`:376-385`).
That link is C's own addition — it is **not** in `CONTEXT.md:127-130` — and its
stated purpose (`:637-639`) is that without it *"a reading's `cost_usd` and the
run's `cost_usd` are two unrelated numbers and neither reconciles against the
other."* `NORMALIZATION-AUDIT.md:247` rules this an FD *addition*, not a
denormalization.

Both are defensible. The rulebook mandates **both** structures — `PRD.md:101`
puts cost/latency on `field_readings`, `PRD.md:105` mandates `engine_runs` as its
own table — so "which one" is not answerable from the documents. **What is
genuinely undecided is whether `engine_runs` lands in P0 or is deferred**, and
that turns on the error case.

### The owner must decide exactly four things

1. **Does `engine_runs` land in P0, or is A's DEF-4 deferral accepted?**
   Decisive fact: `PRD.md:105`/`CONTEXT.md:122` give `engine_runs` an **`error`
   column**. `field_readings` has no error column and cannot have one — a failed
   call produces no reading to hang it on. So under Proposal A **a failed engine
   call is not recorded anywhere in the system.** If "cost + latency recorded per
   call" (`PRD.md:140`) means *every call including the failures*, A does not
   satisfy the hard rule and C is forced. If it means *every reading*, A
   satisfies it and `engine_runs` may wait. **This is the ruling.**

2. **If both land, is `field_readings.engine_run_id` (C §2.7, `:376-385`) part of
   P0?** It is the only thing that makes per-order cost reconcilable two ways.
   Without it the duplication is real duplication.

3. **U1 — null or `0` when an engine reports no cost?** Pick one and amend the
   loser: either relax `entities.ts:90-91` to `.nullable()` (which
   `HANDOFF.md:30`/`CONTEXT.md:227` declared-not-faked precedent supports, and
   which breaks **nothing** — zero UI readers, ~14 mock sites and 3 fixture
   sites keep compiling since they supply values), or affirm NOT NULL and state
   in writing that a cost of `0` is a permitted assertion. **Do not ship
   `NOT NULL` columns while the precedent says null.**

4. **U3/U4 — ratify `numeric(12,6)` + `integer`, and say where `p95_latency_ms`
   is computed.** If p95 is a stored rollup it needs a home table; if computed on
   read (as the mock does, `handlers.ts:281`) it needs an index on
   `(tenant_id, engine_id, created_at)` — which C already proposes (`:697`) and A
   does not.

Until (1) is answered, **no telemetry migration should be written.** Writing A's
columns and later adding `engine_runs` is cheap; writing them and later
discovering failed calls were meant to be recorded means backfilling a history
that was never captured. The cost of the wrong choice is asymmetric, and it
falls entirely on the deferral side.

---

## 3. What this file does not resolve

- Class-(a) rows are classified as buildable, not scheduled. Sequencing stays
  with `BACKEND-MASTER-PLAN.md`.
- U5–U14 are recorded so they stop being rediscovered. Only U1–U4 block the
  telemetry slice; the rest block their own slices.
- `alembic upgrade head` on the dev DB is a maintenance action, not a decision.

# Backend Stack Selection — Compliance-Sensitive Document-Extraction Pipeline

*A product-perspective technology-selection study. Repo- and team-independent; judged on the merits. 32 candidates across three groups, each scored on 36 fields by an independent research pass (sources from the last 12 months, mid-2025 → mid-2026).*

> **HISTORICAL / SUPERSEDED on decisions.** This is the evidence study that led to the stack. Where its recommendations differ from `PLAN.md` (e.g. Procrastinate→PgQueuer, orjson-default→Pydantic-response-models, "seam as decisive axis"), **`PLAN.md` is canonical.** Read this for the reasoning, not the final picks.

---

## 1. Executive summary

The product is a **document-extraction pipeline with a human review gate**: ingest NPI-bearing packages → asynchronous OCR + vision-model + LLM extraction and docx assembly → field-level human review where every value carries provenance → deliver (download now, partner-API later). Volume is low-to-moderate (~2k–20k orders/month), the workload is I/O-bound, and order lifecycles span **hours to days**, pausing on human review and on escalations. Later quality layers (blind double-entry QA in a physically isolated service, reconciliation, golden-set grading, engine tuning) sit on top of this spine.

Across 32 candidates, the decision is **not** driven by API throughput — at this volume every framework is far past sufficient, and the pro-runtime performance arguments (Bun, Rust, Go) collapse once Postgres round-trips and validation dominate. The decision is driven by **six load-bearing axes** (§3). When you rank on those, the field narrows sharply and converges:

**Recommended stack (on the merits):**

| Layer | Recommendation | Why it wins the axes |
|---|---|---|
| **API + orchestration language** | **Python** — FastAPI (default) or Litestar (safety-forward alternative) | Collapses the Python-ML **serialization seam**: OCR/VLM/docx run in-process, no cross-language boundary on the correctness surface |
| **Job queue (extraction fan-out)** | **Procrastinate** or **pgqueuer** (Postgres-backed, Python) | **Transactional enqueue** — job row commits atomically with accept-order; no broker; Python executors |
| **Human-gated durability** | **Explicit Postgres state machine** for v1; **DBOS** as the upgrade path | Best honors "server owns state"; tightest NPI residency; DBOS adds durable-pause as a *library* on your Postgres with no determinism footgun |
| **Database** | **PostgreSQL + RLS** (transaction-scoped `SET LOCAL` idiom) | One datastore for data + queue + durability; RLS for tenancy |
| **Storage** | S3-compatible object store, signed URLs, encrypted at rest | NPI never in VCS; signed-URL-scoped access |
| **Auth** | Clerk (`clerk-backend-api` Python SDK) | Networkless JWT verify; first-class in Python |
| **Workers** | Python (OCR/VLM/docx) in the same codebase | Zero seam; provenance/two-NA-states/tenant-id never serialized across languages |
| **Shape** | Modular monolith (API + workers) + **physically isolated blind-service** (separate Postgres, nothing shared) | Only the isolation-mandated split; small-team operable |

**One-line rationale:** a provenance-obsessed, NPI-bearing pipeline whose ML tier is Python-locked should not run a second language through its correctness surface, and its orchestration need is *durable-human-gated-workflow* — best served **on your own Postgres**, not on a vendor cloud or a heavyweight cluster.

**What the research changed vs. a naive "FastAPI + Celery + Temporal" default:**
- **Celery is the wrong queue** here — its broker lives outside Postgres, so it *cannot* do transactional enqueue (dual-write → lost jobs); Procrastinate/pgqueuer/pgmq can.
- **Temporal is not the default durability answer** — its replay/determinism model forces every ML call into a separate Activity (leakiest seam), and it's the heaviest to operate. **DBOS** delivers durable execution as a Python library on your Postgres with none of that. Temporal wins only if you specifically need its client-side encryption codec + immutable audit at scale.
- **pgqueuer** is a credible, observability-forward peer to Procrastinate (built-in Prometheus/tracing) that a naive default would miss.
- **Hatchet** is a strong purpose-built AI-pipeline option (Postgres-only, Python SDK, native `waitFor`) — the best managed-durability pick *if* you'd rather not hand-roll the state machine, with the caveat that its state lives in its own Postgres.

---

## 2. The product, restated as constraints

1. **Correctness & auditability above throughput** — every field carries provenance; every transition is traceable; a wrong title field is legal/financial liability.
2. **Durable, resumable, human-gated workflows** — multi-day pauses on review/escalation; must survive restarts without losing or double-processing an order. *The most demanding requirement.*
3. **Structural isolation as a guarantee** — multi-tenant RLS + a blind-service with no code path to model output.
4. **Python-native ML/document tier** — OCR, VLM, image processing, docx assembly are Python-locked. **Forced.**
5. **Typed, refusal-enforcing contract to a React UI.**
6. **Per-engine cost/latency accounting** (accuracy-first, cost-second).

---

## 3. The six axes that actually decide it

| Axis | Why it decides | Who passes cleanly |
|---|---|---|
| **Python-ML serialization seam** | The ML tier is Python. Any non-Python API/queue/workflow tier adds a second schema boundary exactly where provenance, the two NA states (`NOT_PRESENT` vs `PRESENT_UNREADABLE`), and `tenant_id` must survive. A JSON seam can silently collapse `null`. | Python frameworks; Python/Postgres queues; DBOS/Hatchet (Python SDK) |
| **Transactional enqueue** | A dropped extraction job = a silently stuck order. The job row must commit *atomically* with accept-order inside one Postgres transaction. | Procrastinate, pgqueuer, pgmq, River (Go), Oban (Elixir), DBOS. **Not** Celery/Dramatiq/arq/BullMQ/Sidekiq (brokered) |
| **Human-in-the-loop primitive** | Multi-day waits. Either a native durable pause, or you poll a server-owned state table. | Native: Temporal, DBOS, Restate, Inngest, Hatchet, Windmill, Trigger.dev (cloud). Everything else → explicit state table |
| **Determinism vs. checkpoint model** | Governs how freely workflow code may call the Python ML tier. Replay engines forbid non-determinism and force a workflow/activity split (leaky). Checkpoint-result engines let ML calls be ordinary steps. | Checkpoint (low-friction): DBOS, Hatchet, Windmill. Replay (higher-friction): Temporal, Restate |
| **NPI payload residency** | Durable engines persist every step's inputs/outputs — which hold NPI/PII. On *your* Postgres, or a vendor cloud? Encrypted? | On-box: DBOS, explicit-SM, Hatchet (self-host), Windmill. Codec-encrypted: Temporal. Off-box risk: Inngest/Trigger.dev cloud, Restate (own store) |
| **RLS × connection-pooling** | The real multi-tenant trap: session-scoped `SET` leaks tenant context across PgBouncer transaction-pooled connections. Fix is transaction-scoped `SET LOCAL` / `set_config(...,true)`. | None make it *default*; explicit-transaction stacks (pgx/Go, Ecto/Elixir, deliberate SQLAlchemy) get it right most easily |

---

## 4. Group A — Language / framework

**Verdict up front:** every non-Python option is a competent platform that nonetheless reintroduces the serialization seam on the correctness surface — a Python-native API collapses it for free. So the choice inside Python (FastAPI vs Litestar vs Django) matters more than the choice between languages.

| Candidate | ML seam | I/O-bound fit | OpenAPI→typed client | Notable | Verdict |
|---|---|---|---|---|---|
| **Python + FastAPI** | **None (in-process)** | Good; watch silent event-loop stall on sync calls in `async def` | Clean 3.1 → orval/kubb/hey-api → Zod v4 + TanStack Query | Largest ecosystem; now small team + FastAPI Labs | **Default pick** |
| **Python + Litestar** | **None** | Good; **`sync_to_thread` mandatory** turns FastAPI's silent blocking footgun into an explicit, reviewable choice | Clean 3.1; msgspec strict-decode aids provenance integrity | Softest bus factor (community, no corp/foundation) | **Best safety-forward alternative** |
| **Python + Django/DRF** | **None** | Sync-first (worker saturation, not event-loop trap) | Weakest — drf-spectacular, annotation-driven, untyped ORM → drift | **Strongest built-in audit trail** (pghistory), DSF governance = best longevity | Wins if audit/admin batteries outweigh contract ergonomics |
| **TS + Hono** | Seam | Lightest; Node LTS for long workers (Bun long-run memory risk) | Best of the TS three via `@hono/zod-openapi` reusing Zod schemas | Cheapest to isolate for blind-service | Best TS option, but seam remains |
| **TS + Fastify** | Seam | Good | `fastify-type-provider-zod` low drift | **Schema response serialization structurally whitelists emitted fields** (NPI over-exposure safeguard); OpenJS governance | The balanced TS pick |
| **TS + NestJS** | Seam | Good | Best auto-OpenAPI, but class-validator DTOs diverge from Zod (highest drift) | Blessed queue is Redis/BullMQ → **no transactional Postgres enqueue** | Heaviest; frictions bite this product |
| **Go + Echo/Chi** | Seam (no in-process embedding) | Blocking-safe goroutines suit fan-out | Always bolt-on (Huma/ogen) | River gives transactional enqueue; single static binary = lowest ops; explicit pgx RLS | Pragmatic polyglot middle if you *want* Go |
| **Rust + Axum** | Seam, but **PyO3 can embed CPython** to shrink it | Overkill for I/O-bound gateway | Bolt-on (utoipa) | Best compile-enforced modeling of two-NA-states/provenance; smallest blind-service binary | Weakest where the product is hardest (immature queue/Temporal); highest build/hiring cost |
| **Java + Spring Boot** | Seam | Fine | Good | Mature Temporal Java SDK (rich durable HITL); enterprise auth/RLS | Wins only if you're already a JVM shop; heaviest footprint |
| **Kotlin + Ktor** | Seam | Coroutine-light | Not automatic (hand-annotated → drift) | No official Clerk SDK | Lighter JVM, but OpenAPI/ecosystem gaps |
| **C#/.NET Minimal APIs** | Seam (pythonnet non-viable for heavy ML) | Strong | **Best-in-class native OpenAPI 3.1** (.NET 10); Wolverine = strong transactional outbox | Temporal .NET SDK still beta | Strong platform, wrong language for a Python-ML core |
| **Elixir + Phoenix** | Seam (Pythonx emerging) | **Best runtime fit** — BEAM I/O fan-out, no blocking starvation | Bolt-on | Oban = most mature PG queue + `Ecto.Multi` enqueue; cloak_ecto NPI encryption; all on-box | Dynamic typing = weakest compile-time safety on the correctness surface; niche hiring |

---

## 5. Group B — Job queue (async extraction fan-out)

**Verdict up front:** the extraction fan-out needs a queue with **transactional enqueue** and **Python executors**. That eliminates every brokered queue (atomicity loss) and every JS/Ruby queue (wrong-language workers). Two Python/Postgres options survive cleanly.

| Candidate | Lang | Transactional enqueue | Broker? | Python workers | Verdict |
|---|---|---|---|---|---|
| **Procrastinate** | Py | **Yes (atomic, app connection)** | Postgres-only | Yes | **Top pick.** MIT, mature 3.x; caveat: thin bus factor ("looking for maintainers") |
| **pgqueuer** | Py | **Yes** | Postgres-only | Yes | **Co-top pick.** Only one with built-in Prometheus/tracing/dashboard + per-entrypoint concurrency; single-maintainer, young but fast |
| **pgmq / Supabase Queues** | **Neutral (SQL)** | **Yes** | Postgres extension | Yes (+any lang) | **Best if a language boundary is ever unavoidable** — RLS-compatible, message-level tenant isolation. Caveat: a *primitive*, not a framework (you build the worker loop) |
| **Celery** | Py | **No** (broker dual-write; `delay_on_commit` is send-after-commit) | RabbitMQ/Redis/SQS | Yes | Most mature/scalable, but atomicity + off-box NPI residency lose at this volume |
| **Dramatiq** | Py | No (needs 3rd-party `dramatiq-pg`) | RabbitMQ/Redis | Yes | Zero-seam Python + thread workers (no event-loop trap), but brokered |
| **arq** | Py | No | Redis-only | Yes | **Maintenance-mode** (longevity risk); single-event-loop trap; pickle-in-Redis NPI concern |
| **River** | Go | Yes | Postgres-only | **Insertion-only** (Python enqueues, Go executes) | Right PG story, wrong executor language → forces Go↔Python seam |
| **Oban** | Elixir | **Yes (`Ecto.Multi`)** | Postgres-only | Oban.py v0.5 (unproven) | Strongest primitives (durable `await_signal`, encrypted args) but **paid Pro** + Elixir runtime bet |
| **Graphile Worker** | Node | Yes | Postgres-only | **No (JS executors)** | Fails Python-interop; deletes completed jobs (weaker history) |
| **pg-boss** | Node | Yes (ORM adapters) | Postgres-only | **No (JS)** | Better history than Graphile; still JS-executor seam |
| **Sidekiq** | Ruby | No | Redis | **No** | Off-axis on every load-bearing field |

*All queues here are at-least-once → idempotency on paid-LLM/docx steps is yours regardless. None supplies a durable human-pause → the multi-day gate lives in a server-owned state table (which the product mandates anyway).*

---

## 6. Group C — Durable / human-gated workflow

**Verdict up front:** this group answers requirement #2. Two philosophies: **own the state machine** (explicit Postgres) vs. **buy a durable engine**. For a product whose stated law is *"server owns all state machines,"* the explicit machine aligns and the right engine is one that lives *on your Postgres* and doesn't fight that ownership.

| Candidate | HITL pause | Determinism model | NPI residency | Op weight | Verdict |
|---|---|---|---|---|---|
| **Explicit Postgres state machine** | Hand-rolled AWAITING_REVIEW + sweep | N/A (it's your code) | **Tightest (your tables)** | Lowest (no new dep) | **v1 pick** — best honors "server owns state"; cleanest blind split; you write retry/timeout/recovery |
| **DBOS** | Native (`recv`/`sleep`) | **Checkpoint (no footgun)** | **Your Postgres** | **Lightest (library)** | **Best engine upgrade** — durable execution as a Python library; *only* engine with true transactional enqueue; younger single-vendor, per-step PG write-amp |
| **Hatchet** | Native (`waitFor`, durable sleep) | Checkpoint | Your Postgres (self-host) | Medium (Go engine, gRPC) | **Best purpose-built AI-pipeline engine**; Python SDK, Postgres-only; but state in *its* Postgres (still need outbox), RBAC/audit enterprise-gated |
| **Temporal** | **Richest (Signals/Updates)** | **Replay (leakiest ML seam)** | **Codec = ciphertext (strongest)** | **Heaviest (cluster + ES)** | Wins only if durable-Signal HITL + immutable audit + engine-never-sees-cleartext justify the cluster |
| **Windmill** | Native approval/suspend | Checkpoint | Your Postgres (but **separate DB**) | Medium (whole platform) | **Collides with "server owns state"** — cedes the state machine to Windmill's flows + its own DB; weak transactional enqueue (dual-write) |
| **Inngest** | Native (`waitForEvent`) | Checkpoint | **Off-box unless self-hosted**; unique E2E-encryption middleware | Medium (Go svc + Redis) | Good self-hosted; **SSPL license** procurement flag; cloud per-step pricing punishes fan-out |
| **Restate** | Native (awakeables) | Replay (side-effects explicit) | **Own RocksDB, no self-host codec** | Low-medium (single binary) | Strong engineering, **weakest governance** (BSL 1.1, newest, single-vendor) |
| **Trigger.dev v4** | Native waitpoints (**cloud-only for long waits**) | Checkpoint | **Off-box on the cheap path** | Heaviest self-host (PG+Redis+ClickHouse) | **Poor fit** — TS-only SDK = seam on every ML step; disqualified here despite best DX |

---

## 7. The recommended architecture

```
React/TS UI
   |  (OpenAPI 3.1 -> Zod v4 + TanStack Query; refusal refinements hand-authored)
   v
FastAPI (or Litestar)  -- API + order state machine (server-owned, in Postgres)
   |
   |-- enqueue extraction ATOMICALLY  ->  Procrastinate / pgqueuer (Postgres queue)
   |                                          |
   |                                 Python workers: OCR + VLM + LLM ensemble
   |                                 + docx assembly  (IN-PROCESS, no seam)
   |
   |-- PostgreSQL  -- data + queue + durable state; RLS via SET LOCAL / set_config(...,true)
   |
   |-- S3-compatible object store -- packages + reports, signed URLs, encrypted at rest

BLIND-SERVICE (physically isolated: separate FastAPI + separate Postgres,
   no shared queue, no shared pool, no model-output table, network-segmented)
```

**Build order (dependency-driven):**
1. **Spine** — ingest → extract (queue+workers) → review → deliver. Order `status` column *is* the state machine.
2. **Measurement** — golden set, blind-50 (**forces the isolated blind-service** — the one real new infra piece), reconciliation.
3. **Tuning** — leaderboard, seed correction, rule refinement.

**Delivery seam:** implement `deliver(report)` as one swappable step — `download` today, `partner-api POST` later. Not a rearchitecture.

**When to add DBOS:** the moment hand-rolled durability (retry/timeout/recovery sweeps, the AWAITING_REVIEW wait) starts costing more than a library dependency would. DBOS drops in on the same Postgres, keeps NPI on-box, and doesn't take state ownership away from your server the way Windmill/Temporal do.

---

## 8. Honest risks & open questions

- **Procrastinate/pgqueuer bus factor** — both are thin-maintainer. Mitigate with day-one queue observability (pgqueuer has it built-in) and a documented graduation path (Celery for scale, DBOS/Hatchet for durability).
- **RLS × PgBouncer** — the `SET` vs `SET LOCAL` leak is invisible in single-connection dev and surfaces only under production pooling concurrency. Make transaction-scoped `set_config(...,true)` the default idiom and write a two-tenant interleaved-connection isolation test.
- **At-least-once everywhere** — every viable queue is at-least-once; extraction steps invoke paid LLM APIs and assemble docx, so **idempotency keys on those steps are mandatory**, not optional.
- **Postgres write-amplification** — Postgres-backed durability writes per step; per-order ensemble fan-out shows as status-table lock contention. At 2k–20k/mo this is comfortably fine, but it's the concrete failure mode to watch if volume grows 10×.
- **DBOS maturity** — Production/Stable 2.x, but younger and single-vendor vs. Temporal; no built-in payload codec (you own encryption via Postgres). Evaluate, don't coronate.
- **Litestar vs FastAPI bus factor** — Litestar's `sync_to_thread` safety is real, but its community-only governance is a softer longevity bet than FastAPI's now-commercial backing. A wash worth a deliberate call.

---

## 9. Bottom line

Reasoning purely from the product — correctness, auditability, isolation, durable human-gated sagas, a Python-locked ML tier — the stack converges regardless of starting point: **Python API + Postgres-backed transactional queue + server-owned state machine (DBOS as the durable-execution upgrade) + Postgres/RLS + object storage + isolated blind-service.** The load-bearing reason is singular: **don't run a second language through the correctness surface, and keep durable NPI state on your own Postgres.** Every candidate that loses, loses on one of those two.

*Full field-by-field data for all 32 candidates (`appendix.md`, `results/*.json`, `outline.yaml`, `fields.yaml`) is archived outside the working tree as research history — deliberately kept out of the repo so it doesn't resurface superseded picks (Clerk, Procrastinate, etc.) to future readers.*

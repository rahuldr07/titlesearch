# ADR-0001 — core-api language: FastAPI (Python), not Hono/Bun (TypeScript)

**Status:** PROPOSED — owner sign-off required (principle 5)
**Date:** 2026-07-17
**Deciders:** _(unsigned)_
**Evidence:** deep-research run wf_f4a3917f-d01 — 24 sources, 25 claims adversarially verified 3-vote each (24 confirmed, 1 refuted), all primary sources fetched live 2026-07-17.

## Decision

core-api is the FastAPI port of the Flask prototype, per the original P1 plan. The polyglot boundary sits at the browser: Python everywhere server-side except the pdf-svc sidecar. blind-svc keeps its topology guarantee (separate deployment, no route/grant/code-path to model output) but needs no TS — a tiny FastAPI app satisfies it.

Nothing found in the 2026 ecosystem overturns the port default; the verified evidence strengthens it.

## Why (verified findings, ranked)

1. **Queue asymmetry — near-dispositive.** Procrastinate's only documented, supported enqueue path is Python (`.defer()`/`.defer_async()` + CLI). The cross-language stored-procedure story is stated design *intent*, not a public contract: the queue ops are internal version-suffixed SQL functions (`procrastinate_defer_jobs_v1`, `_v2`, …) that shift across releases with no stability guarantee. A TS core-api either depends on those internals or swaps queues — and the credible TS-side queue (Graphile Worker, which *does* publish a supported SQL enqueue API) runs **JavaScript** job executors, while TitlePipe's workers are Python-locked (extraction/AI, docxtpl). FastAPI+Procrastinate is the only combination where both enqueue and execution are first-class supported paths. [procrastinate docs/discussions; graphile worker docs — 3-0]
2. **The port safety net is real only in Python.** Module-by-module behind the existing REST contract, 155 pytest tests green throughout. A TS rewrite forfeits it entirely (CONTEXT §22's exact warned-against failure mode).
3. **Clerk is not a differentiator.** Official first-party Python backend SDK, GA, v6.0.1 (2026-06-12), first-class `authenticate_request` with networkless JWT verification. [PyPI/clerk-sdk-python — 3-0]
4. **RLS idiom is maintainer-endorsed in SQLAlchemy.** `set_config(..., is_local=true)` (SET LOCAL semantics) reapplied per-transaction via `SessionEvents.after_begin`. The naive connection-scoped GUC is a verified leak pitfall under pooling (pool reset issues ROLLBACK, not DISCARD — stale tenant can leak across checkouts). This is the pattern the port must implement; it is fully mapped. [sqlalchemy discussions #13020, #12661 — 3-0]
5. **The Zod contract gap is mostly automated away.** `@hey-api/openapi-ts` generates Zod v4 schemas + TanStack Query v5 artifacts from FastAPI's OpenAPI output; FastAPI's own docs recommend it. Cannot reproduce hand-written refinements — `packages/contract` stays authoritative for the refusal rules; generated output is the drift check. [heyapi.dev, npm, fastapi docs — 3-0]
6. **Bun carries live, vendor-acknowledged stability risk for long-running APIs.** April 2026: memory-leak complaints; Bun v1.3.13 shipped allocator fixes for "a class of hangs and crashes in long-running processes" (their words); OpenCode publicly migrated to Node ("not a good fit for apps with a large user base" — confound noted: Anthropic owns Bun, OpenCode competes with Claude Code, but the GitHub issue record corroborates). [bun.com release notes, The Register, oven-sh issues — 3-0]
7. **No material performance argument survives.** Hono's numbers are router microbenchmarks by their own docs' admission; independent 2026 testing shows Bun's ~4× synthetic edge collapsing to <3% once routing+validation+DB are in the path. The headline pro-Bun claim (2.4× FastAPI on small DB-backed requests) was **refuted in verification (1-2)**. Postgres round-trips dominate this API's latency. [hono.dev, strapi.io — 3-0]

## Costs accepted (priced in, with mitigations)

- **Procrastinate maturity caveats** — maintainers' own docs hedge production-readiness pending "real monitoring tools"; bus-factor is thin (soliciting maintainers; one dominant contributor). *Mitigation:* basic queue observability from day one (job-table gauges into /api/metrics-adjacent internal dashboards), Celery graduation path already in the plan. Active cadence: v3.9.0 shipped 2026-06-20.
- **Transactional enqueue is supported, not automatic** — defer must run on the caller's connection inside the app transaction (psycopg/SQLAlchemy connector). Wire deliberately in the port; test it (accept order → job row committed atomically or neither).
- **openapi-ts is pre-1.0** (0.99.0, 2026-06-22; known recursive-schema/int64 issues). *Mitigation:* pin exact version, snapshot-test generated output in CI. This was the strongest surviving pro-TS argument.
- **FastAPI large-payload serialization** (medium confidence; vendor benchmark, config undisclosed): Pydantic response-model path degrades superlinearly on 100+ record list responses. Relevant endpoint: `GET /api/orders/{id}/fields` (132+ fields × readings). *Mitigation if measured:* ORJSONResponse / bypass `response_model` on list endpoints / TypeAdapter serialization. Measure in P1, don't pre-optimize.

## Open questions carried forward

- Clerk Python parity with JS `authenticateRequest` handshake/cookie-refresh flows (likely frontend-side anyway — verify during Clerk wiring in P1).
- Whether Procrastinate maintainers intend to stabilize the SQL functions as a public cross-language contract (irrelevant unless a non-Python enqueuer appears).
- pg-boss was never assessed (produced no surviving claims) — moot under this decision.

## Consequences

- P1 scope confirmed as written: FastAPI port module-by-module, 155→~200 tests, Procrastinate, RLS per finding 4's idiom.
- `packages/contract` remains the frontend's source of truth; add a CI job generating Zod from FastAPI's OpenAPI and diffing against expectations once the port exists.
- HANDOFF §4's "core-api may go TypeScript/Hono" is closed by this ADR upon sign-off.

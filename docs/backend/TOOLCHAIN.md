# Backend Toolchain Manifest — TitlePipe (mid-2026)

*The concrete library/tooling picks. Versions verified against PyPI ~2026-07-21; pin at install time.*

> **`PLAN.md` is canonical for decisions; this file defers to it.** Reconciled 2026-07-21 — the earlier version of this manifest disagreed with PLAN on the queue (→ **PgQueuer**), retry lib (→ **Tenacity**), serialization (→ **Pydantic response models, no orjson default**), storage encryption (→ **R2 auto-encryption, not SSE-KMS**), API processes (→ **one process/container, scale by replicas**), and contract authority (→ **Pydantic/OpenAPI, migrated endpoint-by-endpoint**). Those are corrected inline below.

**Two decisions I made for you (both correctness-first, not benchmark-first):**
1. **Driver = psycopg 3 (async), not asyncpg.** The queue (PgQueuer) and app share one psycopg 3 connection so the job row commits inside the app transaction with no second connection; psycopg 3 is also PgBouncer-friendlier. asyncpg's speed edge (~5-10% of latency) is invisible at 2k-20k orders/mo.
2. **Type-check gate = pyright/mypy, not `ty`.** Astral's `ty` is still 0.0.x beta (~15% spec conformance, no plugin system). Use it locally for speed; gate CI on the mature checker.

---

## 1. Runtime & web framework

| Concern | Pick | Version | Notes |
|---|---|---|---|
| Language | **Python** | 3.13 | Free-threaded not needed (web tier is I/O-bound) |
| Framework | **FastAPI** | 0.139.x | Let it resolve Starlette 1.1.x + Pydantic v2; don't pin those yourself |
| ASGI server | **uvicorn[standard]** | 0.51.x | uvloop + httptools; **one process per container, scale by replicas** (platform-supervised). **Not** gunicorn+UvicornWorker (deprecated). Granian = later option only if ever CPU-bound |
| Validation | **Pydantic v2** | 2.13.x | Rust core; your contract layer's model |
| Config | **pydantic-settings** | 2.14.x | Typed 12-factor; `secrets_dir` for NPI, never env-dump secrets |
| JSON | **Typed Pydantic response models — no custom response class** | — | **Corrected:** current FastAPI guidance says a declared response model (Rust-backed) is the fastest normal path; `ORJSONResponse` can add an intermediate conversion. Add **orjson/msgspec only after an endpoint benchmark**; large streaming → JSON Lines / SSE |
| JSON (big lists) | **deferred** (candidate: msgspec) | — | **Not selected for P1.** If a 100+ record endpoint benchmarks badly, msgspec via one custom Response subclass is the escape hatch (~6-9× less RAM than orjson on large arrays). Do not add until measured |
| Async safety | **anyio** | (via Starlette) | **#1 correctness item:** never block in `async def` — wrap sync calls in `run_in_threadpool`; use `anyio.from_thread.run` (never `asyncio.run`) to call async from a threadpool |

**App layout:** `api/` (thin routers) · `services/` (state-machine callers, business logic) · `repositories/` (RLS-aware Postgres) · `schemas/` (Pydantic) · `core/` (settings, WorkOS, deps). Keep state-machine transitions in `services/`, never in `Depends`.

## 2. Data layer

| Concern | Pick | Version | Notes |
|---|---|---|---|
| ORM | **SQLAlchemy 2.0 async** | 2.0.5x | Typed `Mapped[]` models; `sqlalchemy[asyncio]`. 2.1 (beta) is compatible — build on 2.0 style. Async disables lazy-load → use `selectinload`/eager |
| Driver | **psycopg 3 (async)** | 3.2.x | See decision above; native COPY/LISTEN-NOTIFY/pipeline; PgBouncer-friendly |
| Migrations | **Alembic** | 1.18.x | Set `naming_convention` on `MetaData` before first autogen. **Hand-write RLS policies / triggers / CHECK / enum changes via `op.execute()`** — autogen silently omits them |
| RLS | **`set_config(name, val, true)` in `after_begin`** | — | Transaction-scoped (== SET LOCAL); contextvars-fed; **parameterized** (never f-string the tenant id); **deny-by-default** when unset. Tenant-leading composite index mandatory |
| Pooling | **SQLAlchemy `AsyncAdaptedQueuePool`** | — | `pool_pre_ping=True`. PgBouncer only in transaction mode + `SET LOCAL` if added later |
| State machine | **status column + append-only transition table** | — | CHECK/trigger-guarded legal transitions **in the DB**; INSERT-only (`REVOKE UPDATE, DELETE` from app role) for tamper-evident NPI audit |
| Audit catch-all | **postgresql-audit** (SQLAlchemy integration) | current | Trigger-based `activity` table; or pghistory. Layer under the explicit transition log |

**The RLS trap (the one that leaks tenants in prod):** session-scoped `SET` + PgBouncer transaction pooling = wrong-tenant rows. Every RLS blog you'll find shows this wrong pattern. Only `set_config(..., true)` in `after_begin`, parameterized, is correct. Test it: two tenants interleaved on one pooled connection, assert zero cross-read.

## 3. Queue

| Concern | Pick | Version | Notes |
|---|---|---|---|
| Job queue | **PgQueuer** (leading; adoption gated on crash/recovery tests) | current | Postgres-native, transactional enqueue, `SKIP LOCKED`, built-in OpenTelemetry + Prometheus + dashboard, psycopg 3. **Procrastinate** = documented fallback. Keep behind a swappable interface |
| Transactional enqueue | **enqueue on the app's psycopg 3 connection** | — | Job row commits inside the business transaction; **caller owns the commit**. Why the driver is psycopg 3 |
| Workers | **separate process/container** | — | Independent scaling; `SKIP LOCKED` dequeue; abort-aware tasks + graceful shutdown; **every worker idempotent** (at-least-once) |
| Adoption gate | crash / duplicate-run / enqueue-rollback / reclaim / cancellation tests | — | The failure-recovery tests decide PgQueuer, not its feature list |

## 4. Auth

| Concern | Pick | Version | Notes |
|---|---|---|---|
| Provider SDK | **workos** | 9.1.x | AuthKit; requires Python ≥3.10 |
| Session model | **WorkOS sealed-session cookies + Python session helpers** (HttpOnly) | — | **One** session architecture: the WorkOS helper authenticates/refreshes the sealed cookie. **No standalone PyJWT/JWKS** unless a concrete service-to-service/bearer case appears. Cookie-seal password exactly 32 chars, secret. CSRF on cookie-auth mutations |
| Split | **Authentication only** | — | WorkOS gives identity (`sub`, `org_id`); **authorization lives in Postgres** (roles/permissions/audit), re-checked per request. Map `sub`/`org_id` → your user/tenant rows. `/me/capabilities` is UX-only; every route re-enforces |
| Actor identity | **server-derived, never client-declared** | — | Drop `signed_by`/actor fields from request bodies (see `endpoints.ts:160`); take the actor from the session, record server-side |

## 5. Integrations, storage, documents

| Concern | Pick | Version | Notes |
|---|---|---|---|
| HTTP client | **httpx** `AsyncClient` (shared, long-lived) | 0.28.x | One client via lifespan; explicit `Timeout(connect,read,write,pool)` — read generous for LLM/OCR; separate transports per upstream |
| Retries | **Tenacity** (explicit bounded policy) | current | Max attempts + exponential backoff + jitter + overall deadline; retry only transient failures; idempotency keys on paid POSTs. (stamina is a fine wrapper but standardize on Tenacity) |
| Object store | **boto3** (Cloudflare R2) | current | Presigned direct upload; S3-compatible, no egress fees. **obstore deferred until profiling.** **Corrected encryption:** R2 auto-encrypts at rest (AES-256-GCM, CF keys) + TLS; customer-controlled = **SSE-C, not AWS bucket SSE-KMS**. For customer keys use **app-layer envelope encryption** + external KMS wrapping the data keys |
| PDF | **pypdfium2** | 5.12.x | **Apache/BSD — avoids the PyMuPDF AGPL trap.** pdfplumber (MIT) for table extraction where needed |
| Word reports | **docxtpl** | 0.20.x | Jinja2-in-Word; non-devs maintain the template |
| Images | **Pillow** | 12.x | **Not pillow-simd** (abandoned); modern Pillow ships SIMD |
| Gemini/VLM | **google-genai** | 2.x | The `google-generativeai` package is **deprecated** — use `google-genai` |
| OCR (self-host) | **paddleocr** | 3.7.x | PP-OCRv5/v6; self-hosted = NPI-safe (no third-party send) |
| OCR (layout) | **llmwhisperer-client** | 2.7.x | ⚠️ **AGPL-3.0 — legal sign-off needed** for a proprietary product; confirm hosted-API vs bundled-client terms |
| Secrets | **pydantic-settings** + AWS Secrets Manager/SSM | — | KMS decryption transparent at the secrets layer; grant task role `kms:Decrypt`; never log resolved secrets |

**⚠️ AGPL watch:** both **PyMuPDF** and **llmwhisperer-client** are AGPL-3.0. Default to pypdfium2 for PDFs; get legal sign-off (or commercial license) before bundling llmwhisperer.

## 6. Dev toolchain & testing

| Concern | Pick | Version | Notes |
|---|---|---|---|
| Packaging/venv | **uv** | 0.11.x | The 2026 default; commit `uv.lock`; `[tool.uv.workspace]` for monorepo. (Astral → OpenAI Mar 2026; OSS unchanged) |
| Lint + format | **Ruff** | 0.15.x | One binary replaces flake8+black+isort+pyupgrade; enable `I` (import sort); `ruff check` before `ruff format` |
| Type check (CI gate) | **pyright** (or **mypy** if you need SQLAlchemy/Pydantic plugins) | current | ~98% conformance. **Not `ty`** (0.0.x beta) as the authority — run it locally for speed only. pyrefly (stable 1.1) is the fast-checker alternative |
| Test runner | **pytest** + **pytest-asyncio** + **pytest-cov** + **pytest-xdist** | 9.1 / 1.4 | `-n auto --dist loadscope`; don't mix pytest-asyncio auto-mode with the anyio plugin |
| PG integration | **testcontainers[postgres]** | 4.14.x | Session-scoped container; per-test transaction rollback with role/claim switch for RLS isolation; DDL in session fixture (rollback can't undo DDL). See `pgrls` for RLS-specific fixtures |
| Contract fuzzing | **Schemathesis** | 4.24.x | Property-based tests from the live `/openapi.json`; finds real bugs first run |
| Client drift-check | **Kubb** (or hey-api/openapi-ts) → Zod v4 + TanStack Query v5 | current | Generate into a throwaway CI dir, **diff generated Zod against `packages/contract`** = contract-drift alarm. Don't ship generated code |
| Pre-commit | **pre-commit** + local Ruff hook | — | Hooks: ruff-check(fix), ruff-format, `uv lock --check`, type-check, whitespace/eof/yaml. CI: `setup-uv` → `uvx pre-commit run --all-files` |

## 7. Observability & runtime

| Concern | Pick | Version | Notes |
|---|---|---|---|
| Logging | **structlog** → JSON → stdout | 26.x | **Redaction processor FIRST** in the chain (NPI); `contextvars` for request/tenant IDs; `DropEvent` for health-check noise |
| Tracing/metrics | **OpenTelemetry** (OTLP → self-hosted collector → Grafana Tempo/Loki/Prom) | SDK 1.3x, contrib 0.6xbNN | Pin beta contrib exactly. **Auto-instrumentation is the biggest silent NPI risk** (captures paths/query/SQL/URLs) → scrub at collector + span filters. **Logfire** = easier OTel wrapper but self-host is Enterprise-only |
| Queue metrics | **PgQueuer built-in Prometheus** (+ prometheus-client for custom gauges) | — | PgQueuer ships OpenTelemetry + Prometheus; scrape its queue-depth/latency metrics directly. **Keep tenant/order IDs out of labels** (cardinality + leak). Multiprocess mode for multi-worker |
| Errors | **Sentry SDK** (FastAPI) | 2.66.x | `send_default_pii=False` + `before_send` scrub + event_scrubber denylist for domain fields. **GlitchTip** if you want lighter self-host |
| Runtime (API) | **one uvicorn process per container, scale by replicas** | — | Platform (Compose/systemd/host) owns supervision. **PgQueuer workers** run as a **separate container**. K8s is rejected for P1 — no K8s-specific runtime assumptions |
| Container | **uv multi-stage** `python:3.13-slim` build → slim/distroless runtime, non-root | — | `UV_COMPILE_BYTECODE=1`, `UV_LINK_MODE=copy`, `--frozen`. Distroless = no shell → use a Python/HTTP health probe, not curl |
| Health/shutdown | HTTP `/health` + `/ready` endpoints + graceful shutdown | — | Container-agnostic: the platform health-check hits the endpoints; drain in-flight jobs on SIGTERM with a grace window covering the worker's shutdown timeout. Abort-aware tasks |
| Rate limiting | at ingress (proxy), **slowapi** only if a public API needs per-key limits | — | Likely unnecessary at this volume |

## NPI-safety (cross-cutting, the load-bearing constraint)

Redact **at the source**, defense-in-depth across all three pipelines independently:
- **Logs** — structlog redaction processor first; no NPI, no presigned URLs (they embed creds).
- **Traces** — OTel collector scrubbing + excluded URLs/attributes (auto-instrumentation captures SQL and query strings).
- **Errors** — Sentry `send_default_pii=False` + `before_send`.
- **Metrics** — never put IDs in Prometheus labels.
- **Payloads** — claim-check (IDs + idempotency key only); workers fetch NPI under tenant auth. No NPI in queue/workflow history.
- **Storage** — R2 auto-encrypts (AES-256-GCM, CF keys) + TLS; app-layer envelope encryption + external KMS where customer keys are required (**not** "R2 bucket SSE-KMS"); signed URLs short-TTL.
- **Actor identity** — server-derived from the session, never client-declared (`signed_by` fix).
- **License** — no AGPL in the proprietary product without sign-off (PyMuPDF, llmwhisperer-client).

---

## `pyproject.toml` starting point

```toml
[project]
requires-python = ">=3.13"
dependencies = [
  "fastapi==0.139.*",
  "uvicorn[standard]==0.51.*",
  "pydantic==2.13.*",
  "pydantic-settings==2.14.*",
  "sqlalchemy[asyncio]==2.0.*",
  "psycopg[binary,pool]==3.2.*",
  "alembic==1.18.*",
  "pgqueuer",                    # leading queue; adoption gated on crash/recovery tests
  "workos==9.1.*",               # sealed-session helpers (no standalone pyjwt yet)
  "httpx==0.28.*",
  "tenacity",                    # explicit bounded retry policy
  "boto3",                       # Cloudflare R2 (presigned)
  "pikepdf",                     # PDF validate/repair/password-detect (qpdf)
  "pypdfium2>=5.12",             # render, process-isolated
  "pdfplumber",                  # tables only (MIT)
  "docxtpl>=0.20", "python-docx",
  "pillow>=12.3",
  "google-genai>=2",
  "paddleocr>=3.7",
  "structlog>=26.1",
  "sentry-sdk[fastapi]>=2.66",
  "prometheus-client>=0.2",
  "opentelemetry-sdk", "opentelemetry-exporter-otlp",
  # no orjson/msgspec by default — Pydantic response models; add only after a benchmark
  # obstore — deferred until worker-streaming profiling
  # llmwhisperer-client — ⚠️ AGPL — legal sign-off first
]

[dependency-groups]
dev = [
  "ruff==0.15.*",
  "pyright",                     # strict; or mypy + plugins
  "pytest==9.1.*",
  "pytest-asyncio==1.4.*",
  "pytest-cov", "pytest-xdist",
  "testcontainers[postgres]==4.14.*",
  "hypothesis",                  # state-machine / canonicalization invariants
  "schemathesis==4.24.*",
  "respx",                       # httpx mocking
  "time-machine",
  "pip-audit",                   # + Semgrep + Trivy in CI (not pip deps)
  "pre-commit",
]
```

*Note: this manifest uses `>=`/`*` ranges for readability; the real project pins exact versions in a committed `uv.lock` **per service** (core / blind / extraction / rendering).*

Tools: **uv** (packaging/lock), **Ruff** (lint+format), **pyright strict** (types), **pre-commit** (gate), **Squawk** (migration lint), **Semgrep + Trivy** (SAST/container scan in CI).

**Contract (corrected — Pydantic authoritative):** the backend's Pydantic models → OpenAPI 3.1 are the wire source of truth; generate the TS client (**openapi-typescript + openapi-fetch**, or Kubb/hey-api) and **commit or deterministically build** it. Migrate ownership **endpoint-by-endpoint** off the hand-authored `packages/contract`; Zod drops to UI-only. Schemathesis fuzzes the live OpenAPI; a generated-client diff in CI is the drift alarm.

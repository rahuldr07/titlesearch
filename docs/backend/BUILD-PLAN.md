# TitlePipe backend — build plan

**Status:** CANONICAL for the backend build as of 2026-08-04.
**Supersedes:** `PLAN.md`, `IMPLEMENTATION_PLAN.md`, `TOOLCHAIN.md` and `ARCHITECTURE_REVIEW.md`
wherever they conflict with this document. Those files are retained as evidence
and history — `REPORT.md` (the 32-candidate study) and the `GATE_0_*` records in
particular are the justification this plan inherits and must not be deleted.

Every version below was verified against a primary source on **2026-08-04**
(PyPI JSON API `upload_time_iso_8601`, GitHub releases API, vendor pricing and
model pages). Anything that could not be verified is marked UNVERIFIED rather
than guessed.

---

## 0. Decisions — all seven closed 2026-08-05

Ruled by the owner. Recorded here so nothing re-derives them.

| # | Question | Ruling |
|---|---|---|
| 1 | No-value states | **Four** — the contract's ratified set (§0.1) |
| 2 | Test database | **Docker + testcontainers**, on the second dev machine (§0.2) |
| 3 | ADR-0001 | **Signed 2026-08-05** with three amendments recorded (§0.3) |
| 4 | Deployment target | **Undecided — Plan 01 stays portable** (§0.4) |
| 5 | Blind fifty | **Deferred, not dropped.** Release gates stand; `blind-svc` stays |
| 6 | Migration safety net | **Built before Plan 02**, as its own task (§5.2) |
| 7 | Plan format | Dense — decisions and traps, not step-by-step TDD |

### 0.4 Deployment is undecided, and Plan 01 must survive that

Plan 01 may assume only: PostgreSQL 18.4, the ability to `CREATE ROLE`, and
`ALTER TABLE … FORCE ROW LEVEL SECURITY`. No provider-specific SQL, no managed
extensions, no vendor lock. Deployment becomes ADR-0002 when it is known.

**This is a live constraint, not a formality.** Several managed Postgres
providers restrict role creation or forced RLS — the exact primitives tenant
isolation rests on. Choosing one later without checking those two capabilities
would invalidate Plan 01's entire security model.

The three subsections below are retained for their reasoning; the rulings above
supersede the "recommendation" lines in each.

### 0.1 The NA taxonomy — blocks the first migration

Three documents disagree on how many no-value states exist:

| source | states |
|---|---|
| `packages/contract/src/enums.ts:19-59` (owner-ratified 2026-07-26) | **four** — `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`, `PRESENT_UNREADABLE` |
| recovered prototype `models.py` | **three** legacy reasons, and **no `PRESENT_UNREADABLE` at all** |
| root `CLAUDE.md` | **two** |

`fields.na_reason` is in the first migration. Changing an enum after rows exist
is a migration nobody wants. `PRESENT_UNREADABLE` is also the state the entire
degraded-scan story depends on — the prototype's omission is not a simplification,
it is a missing product capability.

**Recommendation: adopt the contract's four.** It is the only one an owner has
ratified, and it is what the frontend already renders and tests.

### 0.2 Docker — blocks Gate 2

`GATE_1_FOUNDATION.md §9` says Docker/WSL2 is absent and "Gate 2 cannot start
until it is installed". `docs/prompts/claude-gate-2-execution-prompt.md` says
Docker is "deliberately skipped" and Gate 2 runs against local PostgreSQL 18.x.

Verified on this machine 2026-08-04: `where docker` → **not found**;
`wsl --list` → **not installed**.

The pooled-connection RLS leak test is the entire point of Gate 2 and needs a
real server with real roles either way.

**Recommendation: install WSL2 + Docker Desktop.** It is also the only path to
the six-engine bake-off on the local GPU, which is the P0 item that produces the
first real engine data. Run Gate 2 against a container, with a
`TITLEPIPE_TEST_DATABASE_URL` seam so a local server also works.

### 0.3 ADR-0001 is unsigned

Its header says `ACCEPTED`, but the body twice defers to a sign-off no document
records, and `PLAN.md` Gate 0 step 2 ("sign ADR-0001") carries no completion mark
while step 3 carries `✔ done`. Until it is signed, `HANDOFF §5` still reads
"core-api may go TypeScript/Hono".

**Recommendation: sign it, with the three amendments in §1.1 recorded.**

---

## 1. Architecture

```
                    browser (apps/web-v2)
                          │  HTTPS, sealed-session cookie
                          ▼
         ┌────────────────────────────────────┐
         │  core-api   FastAPI, Python 3.13   │   tenant context per transaction
         │  · Pydantic response models         │   forced RLS, non-owner roles
         │  · WorkOS session → principal       │   audit row in the same txn
         │  · Procrastinate enqueue on the     │      as every state change
         │    caller's connection              │
         └───────┬──────────────────┬──────────┘
                 │                  │
       ┌─────────▼────────┐   ┌─────▼──────────────┐
       │  PostgreSQL 18.4 │   │  Cloudflare R2     │
       │  · app data      │   │  · packages, pages │
       │  · job queue     │   │  · presigned PUT   │
       │  (one database)  │   │    direct upload   │
       └─────────┬────────┘   └────────────────────┘
                 │ LISTEN/NOTIFY + poll
       ┌─────────▼──────────────────────────────┐
       │  extraction-svc   asyncio worker        │
       │  · page fan-out, content-addressed cache│
       │  · engine adapters ≤300 lines           │
       │  · cost_usd + latency_ms per call       │
       └─────────┬──────────────────────────────┘
                 │
       ┌─────────▼────────┐   ┌────────────────────────────────┐
       │  render-svc      │   │  blind-svc  SEPARATE DATABASE  │
       │  · docxtpl, PDF  │   │  · separate R2 credential      │
       └──────────────────┘   │  · no route to model output    │
                              └────────────────────────────────┘
```

**One database for app data and the job queue.** This is not a convenience — it
is what makes `accept order` atomic. The order row and its job row commit in the
same transaction or neither does. A separate broker reintroduces the lost-job
failure that `REPORT.md:31` disqualified Celery for.

**blind-svc is the exception and gets its own database and its own R2
credential.** `CONTEXT.md:563` calls this "a security test, not a UI test" —
typist endpoints must be structurally incapable of returning model output or the
other seat's entries. Structure, not a docstring.

### 1.1 Amendments to ADR-0001, to be recorded on signature

| | ADR body | This plan | Why |
|---|---|---|---|
| Auth | Clerk | **WorkOS AuthKit** | Already superseded by `PLAN.md`; survived adversarial review |
| Queue | Procrastinate | **Procrastinate** — *restored as primary* | See §3.3. PgQueuer cannot do transactional enqueue |
| Contract | Zod authoritative | **Pydantic/OpenAPI authoritative**, Zod retained as the browser's runtime validator | See §5.2 |

---

## 2. The pinned stack

Exact pins, with the trap each one hides. **Lock the full transitive closure**
(`uv.lock`): FastAPI and uvicorn both declare floor-only constraints, so an
unlocked rebuild can silently pull a different tree.

### 2.1 API tier

```toml
requires-python = ">=3.13,<3.14"

fastapi          = "==0.141.1"              # 2026-07-29
starlette        = ">=1.3.1,<2.0.0"         # FastAPI declares >=0.46.0 with NO upper bound — add your own
pydantic         = "==2.13.4"               # 2026-05-06; do NOT pin pydantic-core, pydantic pins it itself
pydantic-settings = "==2.14.2"
uvicorn          = {version = "==0.52.1", extras = ["standard"]}
orjson           = "==3.11.9"
anyio            = ">=4.14.2,<5.0.0"
```

**Traps:**

- **FastAPI is pre-1.0 after ten years.** Treat the minor as the major. Four
  breaking markers landed inside six months (0.129, 0.131, 0.132, 0.137).
- **uvicorn had four behavioural changes in two months.** Set `--http httptools`
  explicitly. **Never `--http zttp`** — 0.52.0's own notes say it is experimental
  and not for production traffic.
- **`httpx` is stale — and this repo already solved it.** Upstream httpx's last
  stable is 2024-12-06 (twenty months), classifiers stop at 3.12, and the
  maintainer reportedly closed issues in Feb 2026. **The services already depend
  on `httpx2>=2,<3`**, the maintained fork that Starlette 1.1's TestClient
  targets. Keep it. Do not "fix" this back to plain httpx. Engine adapters use
  each vendor's own SDK for outbound calls regardless.

**uvicorn, not granian.** Granian is genuinely faster — but it is a
single-maintainer project (679 commits by one person, next human 5), it shipped
four breaking changes *yesterday* including a Linux kernel ≥5.14 requirement for
multi-worker socket sharing, and it supports only the latest minor with no LTS
line. The independent throughput gap is 20–50%, not the vendor's headline. For an
I/O-bound workload where wall-clock is dominated by OCR and model calls, that is
not where the time goes. Revisit if profiling ever shows the ASGI server on the
critical path.

### 2.2 Data tier

```toml
psycopg     = {version = ">=3.3.4,<3.4", extras = ["binary", "pool"]}   # use [c] in prod against system libpq
psycopg-pool = ">=3.3.1,<3.4"                                          # versioned separately from psycopg
SQLAlchemy  = ">=2.0.51,<2.1"                                          # the <2.1 cap is REQUIRED
alembic     = ">=1.18.5,<1.19"
```

- PostgreSQL **18.4** (2026-05-14). **Not 19** — Beta 2.
- pgbouncer **1.25.2**, `pool_mode=transaction`.

**The `<2.1` cap is load-bearing.** SQLAlchemy `2.1.0b3` is on PyPI and is
*newer* than stable. An uncapped resolver can take the beta.

**Three RLS traps, all verified, any one of which silently defeats tenant isolation:**

1. **`SET LOCAL` outside a transaction is a documented no-op** that emits a
   WARNING, never an error. Any path reaching the database in autocommit — a bare
   `engine.execute`, a health check, a session used before `begin()` — runs with
   **no tenant set**. Under a permissive policy that reads everything.
2. **`SAVEPOINT` unwinds the tenant GUC.** Postgres cancels `SET LOCAL` effects
   when rolling back to a savepoint earlier than the command. SQLAlchemy's
   `begin_nested()` issues savepoints. **Ban `begin_nested()` in request paths**
   or re-apply the GUC after every savepoint rollback.
3. **`after_begin` is ORM-only.** It lives on `SessionEvents`, not
   `ConnectionEvents` or `PoolEvents`. Core-level access — raw `engine.connect()`,
   Alembic, ad-hoc scripts, **and Procrastinate's own connection usage** —
   bypasses it entirely.

Write policy predicates as:

```sql
USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
```

The `nullif` makes an unset tenant deny **zero rows** rather than raise a uuid
cast error on a warm connection.

### 2.3 Queue

```toml
procrastinate = ">=3.9.0,<4.0"    # 3.8.0 is the HARD FLOOR for Task.configure(connection=)
croniter      = ">=6.2.4,<7.0"
```

**`Task.configure(connection=)` is version-gated** — it arrived in 3.8.0
(2026-04-06). And because `ConfigureTaskOptions` is a `TypedDict` consumed via
`**options`, a pin below 3.8.0 does not raise a clear error; it silently lacks the
feature.

### 2.4 Auth and storage

```toml
workos   = "==10.1.0"     # PIN EXACT — four breaking majors in eleven weeks (7/8/9/10)
boto3    = "==1.43.63"
botocore = "==1.43.63"    # pin it too, to keep R2 checksum behaviour deterministic
```

**Do not use `aioboto3`.** Version 15.5.0 requires `aiobotocore[boto3]==2.25.1`,
which forces `boto3<1.40.62` (October 2025) — a hard, unresolvable conflict with
current boto3. Last release 2025-10-30, single maintainer, an unanswered
abandonment issue.

**And you almost certainly do not need async S3 at all.**
`generate_presigned_url` is pure local SigV4 HMAC with **zero network I/O**. The
browser uploads directly to R2. Sync boto3 is correct here. If genuine async byte
streaming is ever required, use `aiobotocore` directly, not `aioboto3`.

R2 client must use the account endpoint — presigning requires
`https://{ACCOUNT_ID}.r2.cloudflarestorage.com`, not a custom domain.

### 2.5 Quality gates

```toml
ruff              = "==0.15.*"    # CURRENT. Do NOT float to 0.16 — see below
pyright           = "==1.1.*"     # THE type checker in use; backend.yml:138 runs it
pytest            = ">=9.1.1,<10.0"
pytest-asyncio    = ">=1.4.0,<2.0"
testcontainers    = {version = ">=4.15.0,<5.0", extras = ["postgres"]}
psycopg           = {extras = ["binary"]}   # REQUIRED — testcontainers' [postgres] extra is EMPTY
coverage          = {version = ">=7.15.3,<8.0", extras = ["toml"]}
hypothesis        = ">=6.165.0,<7.0"
squawk-cli        = "==2.61.0"
```

**Never float ruff, and do not casually bump it to 0.16.** The services pin
`0.15.*` today. 0.16.0 (2026-07-23) jumped the default rule set from **59 rules
to 413** while removing 18 pycodestyle/pyflakes rules from defaults, and changed
the JSON output shape so fields can now be `null`. That is a migration with its
own diff to review, not a version bump — schedule it deliberately or not at all.

**Pyright is the type checker, not mypy.** `services/core-api/pyproject.toml:22`
pins it and `backend.yml:138` runs `uv run pyright`. An earlier draft of this
plan specified mypy; that was wrong, and swapping type checkers on an established
codebase buys nothing. **`ty` (Astral's) is 0.0.66** with 2–3 releases a week and
no stable API — not a candidate.

**Versions here are the repo's current pins, deliberately.** Newer stable exists
for several (fastapi 0.141.1, uvicorn 0.52.1). Upgrading is a separate, reviewed
task — not something Plan 01 does while also introducing the entire data layer.

**Squawk has no rules for `GRANT`, `CREATE POLICY`, RLS or roles.** It lints lock
safety, not security posture. `PLAN.md:150` bundles them into one gate line, which
reads as if the linter covers the policies. It does not — §4.2 supplies the
separate check.

### 2.6 Observability

```toml
structlog                              = ">=26.1.0,<27.0.0"
sentry-sdk                             = ">=2.66.1,<3.0.0"
prometheus-client                      = ">=0.26.0,<0.27.0"
opentelemetry-api                      = "==1.44.0"
opentelemetry-sdk                      = "==1.44.0"
opentelemetry-instrumentation-fastapi  = "==0.65b0"
opentelemetry-instrumentation-sqlalchemy = "==0.65b0"
```

The FastAPI and SQLAlchemy instrumentations are **still beta** and have never had
a stable release. They hard-pin their siblings with `==`, so the whole set moves
as one unit — core `1.44.0` ↔ contrib `0.65b0`. Keep prereleases off in the
resolver; `sentry-sdk 2.52.0aN` and `sqlalchemy 2.1.0bN` are live on PyPI.

**The product forbids throughput counters and productivity metrics in the UI.**
That is a UI rule. Operational telemetry stays on the right side of it by never
being keyed to a person: measure stages, engines, orders and tenants — never
reviewers.

---

## 3. Extraction — models, and the constraint nobody has written down

### 3.1 Model identifiers, verified 2026-08-04

| role | model | price /1M in-out | status |
|---|---|---|---|
| Reader A (image) | `gemini-3.6-flash` | $1.50 / $7.50 | GA 2026-07-21 |
| Page classifier | `gemini-3.5-flash-lite` | $0.30 / $2.50 | GA 2026-07-21 |
| Second opinion | `claude-sonnet-5` | $3.00 / $15.00 | GA |
| Hard adjudication | `claude-opus-5` | $5.00 / $25.00 | GA |
| Cheap bulk | `claude-haiku-4-5-20251001` | $1.00 / $5.00 | GA |
| Reader B (OCR) | LLMWhisperer API **v2**, `high_quality` | per vendor | GA |
| Reader B challenger | `PaddlePaddle/PaddleOCR-VL-1.6` | self-host | 2026-05-28 |
| Confidence oracle | Tesseract **5.5.3** | free | 2026-07-24 |
| Born-digital | poppler `pdftotext` **26.08.0** | free | 2026-08-02 |

**Do not pin `gemini-3.1-flash-lite` or `gemini-3-flash-preview`** — preview, no
retirement notice.

**Two dated warnings:**

- **Gemini 2.0 Flash was shut down 2026-06-01.** The repo's design names Gemini
  2.5 Flash, which is still listed GA — but 2.0 dying proves these retire on
  vendor schedule. Model identifiers belong in config, never in code, and the
  registry is already config-driven with no deploy needed to change a seat.
- **Claude Sonnet 5 introductory pricing ends 2026-08-31** — 27 days out.
  $2/$10 becomes $3/$15, a 50% rise. Any cost model built on spend observed this
  month is wrong on September 1.
- Google **deprecated `temperature`, `top_p`, `top_k`** for newer Gemini models in
  July 2026. Requests carrying them against 3.x will not behave as written.

### 3.2 The coordinate problem — this is the important one

The product rule is absolute: **never emit a value you cannot cite**, with page
and line coordinates.

Coordinate support is **binary, and most engines do not have it**:

| engine | returns text coordinates? |
|---|---|
| Tesseract | **yes** — word *and* character boxes (TSV/hOCR/ALTO) |
| `pdftotext -bbox` | **yes** — word boxes, digital PDFs only |
| PaddleOCR / PaddleOCR-VL | **yes** — region and layout boxes |
| LLMWhisperer high_quality | **yes** — line coordinates |
| **Gemini, Claude (any VLM)** | **NO** |

Reader A is a VLM. **It cannot cite.** So provenance cannot come from the reader
that produced the value — it must be *recovered* by matching the value back onto
Reader B's coordinate-bearing layout text.

That makes **span grounding a hard emit rule, not a nice-to-have**:

> Every non-null value must resolve, under the shared canonical normalizer, to a
> character span in Reader B's layout text inside the cited line window. Not
> resolvable → no value. `PRESENT_UNREADABLE` if the region carries no legible
> text; `NOT_FOUND` if it does and the value is not in it.

`FieldReading.line_coords` is nullable precisely so engines without coordinates
declare `null` rather than fake a box. Keep it that way.

**Known limit, stated honestly:** grounding proves a string *exists on the page*.
It does not prove the string belongs to *that field*. San Diego's stale roll year
and Mecklenburg's title-curative suit typed as a judgment were both perfectly
grounded — real strings, real pages, wrong field. Grounding kills fabrication and
is blind to misattribution, and **3 of the 7 known defects live in misattribution.**

### 3.3 Why Procrastinate, not PgQueuer

`PLAN.md` scoped this as conditional from the start, so this is a gate resolving,
not a decision reopening.

The requirement is transactional enqueue on the caller's connection. **PgQueuer's
psycopg driver raises `RuntimeError` if the connection is not in autocommit** —
and a SQLAlchemy session mid-business-transaction never is. Its `enqueue()` takes
no per-call connection; the connection is fixed at `Queries(driver)` construction.

Meanwhile `IMPLEMENTATION_PLAN.md:769` already specifies
`async def enqueue(..., connection: AsyncConnection)` — **Procrastinate's shape,
not PgQueuer's.** The port was designed around the right library.

Three further findings: stale-job recovery re-picks on a single global 30s
heartbeat with no lease fence, so a handler that blocks the event loop past the
timeout gets its live job handed to a second worker; cancellation is notify-only
and best-effort where Procrastinate persists the abort and polls for it; and
upstream's own recovery tests run against an in-memory fake whose docs state it
has "no rollback or atomic retry semantics".

Bus factor: PgQueuer is 623 of ~640 commits by one person. Procrastinate is
org-owned with three maintainers and six years of releases.

**Keep the `QueuePort` interface.** PgQueuer stays the documented challenger.

---

## 4. Build order

Each numbered item is a self-contained plan producing testable software.

### Plan 01 — Postgres correctness (Gate 2). No routes.

Schema, Alembic with a hand-written first revision, four non-owner roles
(`migration` / `app` / `worker` / `blind`), forced RLS on every tenant table, and
**the leak test**: two tenants interleaved on one pooled connection, zero
cross-read, asserted after a savepoint rollback and after a connection return.

It precedes everything because every route in every later plan is tenant-scoped.
Retrofitting the tenant GUC into written handlers is the exact leak ADR-0001
names as *verified*.

**Alembic autogenerate cannot see RLS policies, grants or roles.** All of it is
hand-written. Add a catalog-snapshot test asserting `relrowsecurity` and
`relforcerowsecurity` per table plus the expected policy set, since Squawk will
not.

**Reconcile the role count first** — `PLAN.md:150` says four,
`IMPLEMENTATION_PLAN.md:492-499` lists six. Pick one; the test encodes it.

### Plan 02 — first vertical slice: `GET /api/rules`

One read-only route through the whole spine: pool, tenant context, Pydantic
response model, generated TS client, error envelope. Chosen because `web-v2`
actually calls it, so a contract mismatch surfaces on a real screen.

### Plan 03 — identity (Group A)

WorkOS sessions, the `PERMISSIONS` table as server-evaluated data,
`/api/me/{permissions,profile,preferences}`, `/api/people`.

**This retires three open-by-default auth holes**, all of which grant admin on a
missing header today: `handlers.ts:405`, `workspace.ts:915`, `handlers.ts:1400`.
A real server must 401. If the port copies handler structure, that default travels.

### Plan 04 — order reads (Groups B + C)

Context, pages, timeline, lifecycle, queue bands, and fields with the full
provenance envelope plus the server-computed census.

`QueueBand.count` is **deliberately not `orders.length`** — it is a census of rows
the caller may not read, which interacts directly with RLS and cannot be a naive
count under the caller's policy.

Add the claim/lease that `GET /api/queue/next` currently lacks, while the queue is
still effectively read-only.

### Plan 05 — domain core port + mutations (Gate 6 + Group D)

Port PATCH semantics from the prototype, not the raw package — the five fixes were
never merged (`GATE_0_RECOVERY §6`). Carry v14 across rather than rewriting.

Then the seven mutations, one at a time, each with its refusal test. **Write the
audit row in the same transaction as the state change from the very first route** —
retrofitting an append-only log across seven handlers is worse than writing it
seven times.

**The mock is weaker than the rulebook here.** `PRD §9` says `POST /orders/:id/pass`
is "recorded; 4th pass auto-escalates". The mock validates a reason and increments
a counter. Building "what the mock does" ships a queue with no pass rule at all.

### Plan 06 — ingest + queue (Gate 5 + Group E)

R2 presigned direct upload — **package bytes never pass through API memory**.
Procrastinate behind `QueuePort`. Test that accepting an order commits the row and
the job atomically or neither.

### Deferred, deliberately

**Group F (workspace lifecycle)** — sign-off, pipeline, completeness. It has **no
schema in `PRD §7` at all**, and `workspace.ts:41-43` says its writes are blocked
on rulings Q4–Q10. Serving these reads earlier means inventing tables from
screens, which hard rule 1 forbids. The mock is the honest answer until the
rulings land.

**Groups I/J/K** — blind, engines/bench/metrics, delivery/complaints/audit. No
live consumer in `web-v2`; building them buys no verification.

---

## 5. Three things to fix before Plan 01

### 5.1 The seal-password length check is wrong — confirmed defect

`services/core-api/src/titlepipe_core/settings.py:29` sets
`SEAL_PASSWORD_LENGTH = 32` and line 125 enforces it exactly. **Fernet keys are 44
characters.** Real WorkOS credentials will be rejected at startup.

Replace the length check with a constructive `Fernet(secret)` in a try/except —
then the library defines validity and no magic number can drift.

### 5.2 The migration safety net does not exist

Both prior plans gate on "keep the frontend tests green while migrating
endpoint-by-endpoint". **That has no execution path.** Verified:

- `apps/web-v2/src/main.tsx:15-21` starts MSW **unconditionally** — no env flag
- `apps/web-v2/vite.config.ts` has **no proxy**
- `.github/workflows/backend.yml` paths: `services/`, `libs/`, `infra/`, `scripts/`
- `.github/workflows/frontend.yml` paths: `apps/`, `packages/`

**No overlap.** No workflow runs the e2e suite on a backend change.

Build before Plan 02:
1. `VITE_API_MODE=mock|live` gating the MSW start
2. A dev proxy to `core-api`
3. A CI job spanning both paths that runs the e2e suite against the real server

Also correct the stale claims: `.github/workflows/frontend.yml:99-102` and
`playwright.config.ts:7-10` still say the invariants job passes vacuously. It does
not — **zero tests are skipped and 111 run.**

### 5.3 Zod stays, as the browser's runtime validator

`openapi-fetch` provides **zero runtime validation by design** — its docs say
"types-only". The repo's hard rule is that every response parses through
`@titlepipe/contract` at the boundary. Generated types do not satisfy that.

So the flip is narrower than "Zod is UI-only": **Pydantic/OpenAPI becomes the wire
authority; Zod remains the runtime boundary parser.** Migration is
endpoint-by-endpoint with `packages/contract` kept as a facade — **~20 files change
that way, ~127 if the facade is dropped.**

One packaging blocker: `openapi-typescript@7.13.0` declares peer `typescript: ^5.x`
while `apps/web-v2` pins `~6.0.3`. Needs a pnpm `peerDependencyRules` override
until upstream #2723 lands.

Finally, `.claude/CLAUDE.md:14` says lint is `pnpm --filter web lint (oxlint)`.
It is `eslint .` on `web-v2`. Both the tool and the filter are wrong.

---

## 6. What this plan cannot prove

Stated plainly so nobody claims otherwise later.

**Agreement is not correctness.** Two readers can be wrong the same way. The
mitigation is measuring the shared-wrong rate inside the accept band — but that
requires truth, and truth is the blind fifty.

**The blind fifty is not truth either.** Two typists reconciling with citations
converge on shared conventions, and a shared convention is exactly what
"judgment on a summons" was. Reconciliation is structurally incapable of seeing an
error both parties share.

**The sample may not reach.** Beating the current defect rate (7 in ~2,000 fields,
~0.35%) needs an accept band near 0.1%. Fifty orders yield roughly 2,000–2,500
accept-band fields with unanchored truth, **pooled**. Even at zero observed
errors that bounds a pooled rate — not a per-section, per-jurisdiction one. Know
this before week six, not during it.

**Field accuracy does not bound report accuracy.** Chain construction and
termination (R17), re-record collapsing (R14), release resolution (R15/R16), MERS
nominee, modifications (R19), substitutions (R23) and judgment status screening
(R13) are *relational*. `CONTEXT §5` names assembly as the expensive stage and the
place reviewers find errors. No field-level number bounds any of it.

---

## 7. Evidence

This plan rests on 41 independently-run agent investigations across three passes
on 2026-08-04, each grounded in files read or primary sources fetched:

- **Recon (9)** — ADRs, the four backend docs, gate archive, toolchain, PRD,
  CONTEXT §11 traps, all four services, the contract surface, plus a gap analysis
  diffing 49 mocked routes against what `core-api` serves (two health endpoints).
- **Toolchain verification (12)** — four adversarial refutations of the
  conditional picks, five decisions on genuinely open tooling, two frontend
  audits, one completeness critic.
- **Accuracy and speed research (12)** — two repo-grounding passes, six external
  research topics, three independently designed pipeline strategies, one judge.
- **Version pinning (8)** — every version above, verified against primary sources.

Where an agent claim was load-bearing it was re-verified directly against the repo
before landing here — including the MSW gating, the CI path filters, the lint
script, the seal-password constant, and the absence of Docker.

---
title: Claude Opus Prompt - Complete TitlePipe Gates 0 and 1
date: 2026-07-22
status: ready-to-run
tags:
  - titlepipe
  - prompt
  - gate-0
  - gate-1
  - backend
aliases:
  - Gate 0 and Gate 1 Claude Prompt
---

# Claude Opus execution prompt

Copy everything inside the prompt block into a fresh Claude Code session opened at the TitleSearch repository root.

> [!warning] Environment requirement
> Full Gate 1 completion requires Docker Engine on native Ubuntu, or Docker Desktop with WSL2 on Windows, because the gate includes container build/run verification. Without Docker, complete every non-container task but report Gate 1 as **PARTIAL**, never complete.

---

## Prompt

```text
You are the primary implementation engineer for TitlePipe. Work directly in the repository and complete Gate 0 and Gate 1 today. Do not merely propose a plan. Inspect, implement, run the checks, preserve evidence, and hand the result back for a separate Codex review before anything is pushed.

REPOSITORY

- Expected Windows path: C:\Users\vicky\Desktop\TitleSearch
- If running on native Ubuntu, first locate the same checkout and report its absolute path.
- Current project phase: P0.
- Target branch: rahuldr07/backend-foundation

YOUR ROLE

- You own the implementation and evidence.
- Think carefully about architecture and correctness; do not optimize for producing many files.
- Do not delegate architectural or domain judgment. If subagents are available, they may perform bounded read-only searches or inventories only. You must verify their findings yourself. No parallel edits.
- Challenge contradictions using the controlling documents, not assumptions from the UI.
- Be direct and technical. Do not add AI-generated notices, Claude tags, Co-Authored-By lines, or AI references to files, commits, or commit messages.

READ FIRST, IN THIS ORDER

Read these files completely before editing:

1. AGENTS.md
2. docs/HANDOFF.md
3. docs/CONTEXT.md, with §11 read twice
4. docs/PRD.md
5. docs/backend/PLAN.md
6. docs/backend/IMPLEMENTATION_PLAN.md
7. docs/backend/TOOLCHAIN.md
8. docs/backend/ARCHITECTURE_REVIEW.md, especially Gates 0-2
9. docs/adr/0001-core-api-fastapi.md

Read ADR-0001 critically: its FastAPI decision is accepted, while its older Clerk/Procrastinate text is historical. The reconciliation note at the top of the ADR and the canonical backend plan control those secondary tooling choices. Report any genuinely new evidence-based contradiction; do not resurrect a superseded choice merely because it remains in the ADR body or a lower-precedence document.

Precedence when they conflict:

1. HANDOFF for current state
2. CONTEXT §11 for domain truth
3. PRD for product requirements
4. backend/PLAN.md for reconciled technology decisions
5. backend/IMPLEMENTATION_PLAN.md for execution sequencing
6. TOOLCHAIN for dependency guidance

Current decisions are fixed for Gates 0 and 1 because they were already reconciled in docs/backend/PLAN.md and recorded in the accepted ADR's reconciliation note. Do not spend this implementation session relitigating them from stale Clerk/Procrastinate references. PgQueuer remains conditional on its later recovery gate, so Gate 1 creates only the queue boundary—not the adapter:

- Python 3.13 + FastAPI/Pydantic v2
- SQLAlchemy 2 async + psycopg 3
- PostgreSQL with forced RLS, non-owner runtime roles and transaction-local tenant context
- WorkOS sealed HttpOnly sessions; PostgreSQL RBAC; no Clerk implementation
- PgQueuer only behind QueuePort and only after its later recovery gate
- Pydantic/OpenAPI wire authority migrated endpoint by endpoint
- openapi-typescript + openapi-fetch for the future deterministic TS client
- Typed Pydantic responses; no orjson/msgspec default
- Separate blind service and physically separate blind database
- R2 storage; no AWS-style R2 SSE-KMS claim
- Modular monolith plus worker processes; no GraphQL, Kafka, Kubernetes, service mesh, Celery/Redis or LangChain in P1

HARD PRODUCT LAWS

- Never derive backend behavior from screens.
- Never emit a value without provenance.
- Preserve NOT_PRESENT and PRESENT_UNREADABLE as different states.
- Server owns state machines, queue ordering, counts, routing, refusals and thresholds.
- Judgments never auto-confirm in v1.
- Engine self-confidence never gates auto-confirm.
- Engines never see each other's output.
- PENDING rules are inert.
- v99 remains deliberately empty; never check land + building against total.
- Liens survive chain termination; suppress only on verified release.
- Never accept actor/signed_by identity from the client.
- Never put county packages, seed databases, uploads or client NPI in VCS.
- Never expose throughput counters, probe visibility, aggregate accuracy headlines, approve-all, auto-tuning or queue cherry-picking.
- Do not implement through OPEN/CONFLICT domain questions.

WORKING-TREE SAFETY

The checkout already contains valuable uncommitted frontend/docs cleanup. Treat every existing change as user work. Do not discard, reset, rewrite or casually reformat it.

Start with:

- git status --short
- git diff --stat
- git diff --check
- git log --oneline --decorate --max-count=10

Review the current changes. They should include frontend cleanup, the PDF worker fix, architecture reconciliation, docs/backend/IMPLEMENTATION_PLAN.md and this already-created, currently untracked execution-prompt artifact. Preserve them; do not recreate or duplicate the prompt.

Before backend scaffolding:

1. Create/switch to branch rahuldr07/backend-foundation without losing dirty changes.
2. Run the current frontend verification once before the preservation commit:
   - pnpm --filter web typecheck
   - pnpm --filter web test
   - pnpm --filter web lint
   - pnpm --filter web build
   - pnpm --filter web test:e2e
3. Lint warnings may be pre-existing, but record them exactly. Test/build failures must be understood before committing.
4. If the cleanup is green, commit it as one local preservation commit before backend work. Use the configured user identity. Suggested message: Finish frontend cleanup and backend planning
5. Include the existing apps/web/scripts/copy-pdf-worker.mjs, docs/backend/IMPLEMENTATION_PLAN.md and docs/prompts/claude-gate-0-1-execution-prompt.md artifacts in that preservation commit. Do not generate a second prompt file.
6. Do not push. Codex will review all Gate 0/1 work first.

Do not use git reset --hard, git checkout --, clean commands, force operations, destructive deletes, or history rewrites.

TODAY'S OBJECTIVE

Complete:

- Gate 0: recover and freeze the safety net, or make an evidence-backed reconstruction declaration.
- Gate 1: create the Python 3.13 backend/service foundation, tooling, CI and verified service/container shells.

Do not start Gate 2 database schema/RLS implementation or any product endpoint.

============================================================
GATE 0 - RECOVER AND FREEZE THE SAFETY NET
============================================================

Known historical prototype description:

- Python Flask + SQLite
- approximately 2,700 lines
- 155 passing pytest tests
- expected modules include models.py, validators.py, segment.py, assemble.py, render.py, api.py, ingest.py and golden.py
- important behaviors include the provenance envelope, two NA states, v1-v14, deliberately empty v99, segmentation, chain/release/MERS assembly, Shape A rendering and five documented bug fixes

The expected outcome is RECONSTRUCTION: this checkout contains no backend Python prototype, and docs/archive/Title report review tool.zip was previously observed to contain design material rather than backend source. Perform one bounded confirmation pass before declaring that outcome; do not spend the session on an open-ended prototype hunt.

0A. SEARCH, READ-ONLY FIRST

Search these likely user-owned locations once:

- repository and its parent
- Desktop
- Documents
- Downloads
- Codex/Claude attachment and session export locations that are user-readable
- D: user/project/archive locations if present
- zip/tar archives by listing entries without extracting into the repository

Bound the pass as follows:

- one filename search per root for the expected module/test/seed/spec names
- one domain-signal search per credible project/archive candidate for terms such as NOT_PRESENT, PRESENT_UNREADABLE, v99, provenance and TitlePipe
- one archive-entry listing for each plausibly relevant archive
- no full-drive content scan and no repeated search with merely cosmetic pattern changes

Use rg --files or fd for filesystem discovery. Exclude node_modules, .git, system directories, caches and generated build output. On Windows, use PowerShell-native filesystem operations. Do not run broad destructive commands. After this defined pass, either investigate a credible candidate or declare RECONSTRUCTION. Apply the same bound to missing docs/spec.md, docs/rulings_2026-07.md and titlepipe.seed.

A candidate is credible only if multiple signals match: module set, tests, TitlePipe domain vocabulary and/or the stated test count. A random models.py is not evidence.

For each credible candidate record:

- absolute path
- file/archive size
- modification time
- SHA-256
- matched modules/tests/domain terms
- whether it appears to contain NPI/client packages/seed data

Do not copy or commit any county package, PDF, seed database or client data. If a seed database is found, record its safe path/hash only and leave it outside VCS.

0B. IF THE PROTOTYPE IS FOUND

- Work on a safe temporary copy outside the repository so test caches do not mutate the recovered source.
- Inventory dependencies before installing them.
- Create an isolated uv environment using the Python version the prototype actually supports.
- Run all tests unchanged first. Do not modify a failing test to make it pass.
- Record exact collected/passed/failed/skipped counts and failure output summaries.
- Inventory public models/functions, state machines, validators, CI assertions and render outputs.
- Freeze only synthetic or explicitly safe golden fixtures into the repository. Do not commit real order data.
- Map each of the five known bug fixes to source and tests.
- Run the R15 lien-suppression audit: search every suppress/drop/filter/termination path and prove chain termination never suppresses liens. Confirm/add evidence for v14 if the source safely enters the repo later.

Do not immediately refactor or port the recovered implementation. Gate 0 is preservation and evidence.

0C. IF THE PROTOTYPE IS NOT FOUND

Complete the bounded search and archive inventory. Then explicitly declare RECONSTRUCTION, not port.

- Record searched roots, patterns, archives, dates and negative evidence.
- State that the 155-test safety net is unavailable.
- Update current planning/handoff claims so they describe the prototype as historical/unrecovered rather than an available port safety net. Preserve the historical facts; remove only misleading current-availability claims.
- Define the reconstruction parity source: domain documents, 116 frontend E2E tests, recovered safe fixtures if any, known bug behaviors and new backend invariant tests.
- For R15, document that no backend suppression implementation exists to audit in this checkout and make v14/R15 the first domain reconstruction test at Gate 6. Do not fabricate an audit pass.

0D. GATE 0 ARTIFACT

Create docs/backend/GATE_0_RECOVERY.md containing:

- date, machine/OS and executor
- final verdict: PORT or RECONSTRUCTION
- exact search scope and commands/patterns
- candidate inventory and hashes
- archive inventory
- test result if found
- domain/API/model/validator/render inventory if found
- five-bug mapping if found
- R15/v14 audit evidence or explicit unavailable status
- safe fixture/golden-output inventory
- missing artifacts, including docs/spec.md, docs/rulings_2026-07.md and titlepipe.seed if still missing
- Gate 0 exit checklist with honest pass/fail/blocked state
- next implications for Gate 6

Gate 0 may be marked COMPLETE through either an evidence-backed PORT or evidence-backed RECONSTRUCTION outcome. It cannot be marked complete with an unfinished search or a fake 155-test claim.

Commit Gate 0 separately after validating the artifact. Suggested message:

- Recover and document backend safety net
- or Declare backend reconstruction baseline

============================================================
GATE 1 - PYTHON BACKEND FOUNDATION
============================================================

Build only the foundation defined in docs/backend/IMPLEMENTATION_PLAN.md. No database schema, WorkOS integration, queue implementation, R2 calls, engine adapters or product endpoints yet.

1A. ENVIRONMENT PREFLIGHT

Record:

- OS and architecture
- git, uv, Python, Node and pnpm versions
- Docker version/info
- whether WSL is involved

Use uv to install/use CPython 3.13. Do not use global Python 3.14 for the services. Do not require a manual system Python install.

Full Gate 1 requires Docker:

- Native Ubuntu: Docker Engine is sufficient; WSL and Docker Desktop are not needed.
- Windows: use Docker Desktop with WSL2 backend.
- If Docker is unavailable, finish all source/tooling work but mark Gate 1 PARTIAL. Never claim the container exit criterion passed.

1B. CREATE THE FOUNDATION LAYOUT

Create narrowly scoped structure consistent with the implementation plan:

- services/core-api
- services/extraction-svc
- services/render-svc
- services/blind-svc
- libs/domain
- libs/test-support
- infra/containers
- infra/compose
- infra/observability

Do not create empty placeholder forests. Every committed directory must contain useful configuration, source, tests or documentation.

1C. PYTHON PROJECTS AND LOCKS

Create independent Python projects and committed uv.lock files for:

- core-api
- extraction-svc
- render-svc
- blind-svc

Use requires-python >=3.13,<3.14. Keep Gate 1 dependencies minimal; do not install PaddleOCR, model SDKs or other heavy/native Gate 7 dependencies yet.

Foundation dependencies should be only what each shell needs, for example:

- core-api: FastAPI, Uvicorn, Pydantic, pydantic-settings
- blind-svc: FastAPI, Uvicorn, Pydantic, pydantic-settings
- extraction-svc/render-svc: typed settings plus minimal CLI/worker shell dependencies
- dev groups: Ruff, Pyright, pytest, pytest-asyncio in strict mode, pytest-cov; do not mix pytest-asyncio auto mode with AnyIO test markers

Use exact resolved uv locks. Do not create one giant shared Python environment. Local domain/test-support path dependencies are acceptable only if each deployable still has its own lock and build.

1D. SOURCE BOUNDARIES

- libs/domain must be framework-free and may not import FastAPI, SQLAlchemy, WorkOS, PgQueuer, boto3 or provider SDKs.
- Core and Blind expose independent app factories and settings.
- Blind must not import core extraction models/packages.
- Extraction and render shells expose explicit command entry points and a safe --check/self-test mode.
- No product state machine or fake backend behavior in Gate 1.

1E. APPLICATION FOUNDATION

Create a small, explicit runtime foundation for each deployable. Use the same contracts and behavior across services, but keep deployment-specific wiring local until a shared abstraction has proved stable.

Required foundation:

- API app factory and explicit lifespan manager for Core and Blind; no import-time network/database clients and no mutable process-global application state
- worker bootstrap and deterministic command entry points for Extraction and Render
- typed application/domain exceptions that do not import or raise FastAPI HTTPException from domain/service code
- a single global API error-mapping layer that emits a stable safe envelope: error code, client-safe message and request ID; include validation/conflict/not-found/authz mappings and a production-safe unknown-500 path
- stable error codes owned by code; do not centralize arbitrary English copy in a giant messages module
- request/correlation ID generation, propagation and structlog context binding
- structured logging with redaction as the first processor; readable console rendering in local development and JSON in staging/production, while keeping the same event names and fields
- narrow telemetry integration points that can accept tracing/metrics later without coupling domain code to OpenTelemetry or Sentry today
- injectable UTC clock and ID factories where domain tests require determinism

Do not create generic dumping grounds named globals.py, common.py, helpers.py, utils.py or messages.py. Give every module one clear responsibility. Do not add a dependency-injection framework; FastAPI dependencies, constructors and small protocols are enough.

Add tests proving:

- request IDs are returned and propagated
- known exceptions map to the documented status/code envelope
- unknown exceptions do not leak stack traces, secrets or internal details in production
- redaction removes configured sensitive keys before console/export rendering
- lifespan resources open and close exactly once
- worker --check failures are deterministic and safely logged

1F. SETTINGS AND SAFETY

Implement typed settings with tests. Production/staging startup must fail for unsafe configuration such as:

- debug/reload enabled
- mock auth enabled
- wildcard CORS
- default/placeholder secrets
- public docs enabled when production policy disables them

Do not log settings or secrets. Use UTC. Add safe environment enums and service names.

Use one typed settings schema per deployable and one code path across environments. Development versus production changes configuration and rendering—not business behavior and not a second settings implementation.

1G. HEALTH/READINESS

- Core API: /health and /ready
- Blind API: /health and /ready
- Health means process alive.
- Readiness must be truthful for the dependencies that exist at Gate 1; extend it in later gates as DB/storage/queue dependencies land.
- Extraction/render service shells must have a deterministic --check command that exits non-zero on invalid configuration.

No product `/api/*` endpoint in Gate 1.

1H. TOOLING

Add and configure:

- Ruff check + format
- Pyright strict
- pytest
- pre-commit
- lock verification
- whitespace/EOF/YAML checks

Prefer small shared config only where it does not merge deployable dependency environments.

1I. CONTAINERS

Create production-oriented multi-stage Dockerfiles for each deployable:

- Python 3.13 slim base
- uv frozen install
- non-root runtime user
- no reload/debug
- one process per container
- health checks suitable for the service
- minimal runtime contents

Create a minimal compose file that can build and run the four Gate 1 shells. Do not add PostgreSQL until Gate 2 unless required only for a disabled future profile. Do not add Kubernetes.

Build every image and run smoke checks. Record image names, sizes and health results.

1J. CI AND SECURITY SKELETON

Create a backend CI workflow that actually executes, not comment-only placeholders:

- Python 3.13 matrix/service setup with uv
- uv lock --check/frozen sync for every service
- Ruff
- Pyright strict
- pytest
- package/wheel build
- container build
- pip-audit
- Semgrep
- Trivy filesystem/image scan
- SBOM generation for built images/artifacts

Pin actions/tools appropriately. Do not automatically apply dependency upgrades. No migrations at startup.

1K. DOCUMENTATION

Create docs/backend/GATE_1_FOUNDATION.md containing:

- resulting tree
- service responsibility and forbidden imports
- exact local commands for sync, lint, typecheck, test, run and build
- exact Docker commands
- CI jobs
- dependency/lock strategy
- app factory/lifespan, error envelope, request context and logging/redaction design
- settings safety rules
- verification results
- known warnings
- Gate 1 exit checklist

Update only documentation made inaccurate by the actual Gate 0/1 result. Do not rewrite unrelated planning prose.

GATE 1 VERIFICATION

For every Python project, from a clean/frozen state:

- uv sync --frozen --all-groups (or the correct equivalent for that project)
- uv run ruff check .
- uv run ruff format --check .
- uv run pyright
- uv run pytest
- uv build where the project is packaged

Repository/frontend regression once after all Gate 1 work (not after every backend commit):

- pnpm --filter web typecheck
- pnpm --filter web test
- pnpm --filter web lint
- pnpm --filter web build
- pnpm --filter web test:e2e
- git diff --check

Container verification when Docker is available:

- build all four images
- run Core and Blind health/readiness checks
- run Extraction and Render --check commands
- verify containers run as non-root
- inspect that production commands do not use reload/debug

Gate 1 is COMPLETE LOCALLY only when all source/tooling/lock/test/build and container checks pass. If Docker is missing or unusable, label Gate 1 PARTIAL and list only the container work as blocked. Because you must not push before Codex review, remote CI will remain PENDING REVIEW; validate the workflow syntax and execute its equivalent commands locally rather than falsely claiming a remote CI run.

COMMITS

Use focused local commits under the existing user identity, with ordinary human commit messages and no AI attribution. Recommended split:

1. Finish frontend cleanup and backend planning
2. Recover and document backend safety net OR Declare backend reconstruction baseline
3. Scaffold Python backend foundation
4. Add backend quality and container gates

Do not commit county packages, seed DBs, PDFs, secrets, .env files, virtualenvs, caches, test artifacts or generated sensitive output.

Do not push. Codex is the reviewer and will inspect the branch, diffs, locks, tests, images and evidence before push.

STOP CONDITIONS

Stop and report rather than guessing if:

- existing user changes overlap in a way you cannot preserve
- a candidate prototype contains client/NPI data that cannot be safely separated
- prototype tests fail and the correct historical behavior is unclear
- an OPEN/CONFLICT domain rule would affect output
- Docker is required for the remaining Gate 1 evidence but unavailable
- a dependency/licence choice would expand the settled architecture

Do not stop for ordinary implementation difficulty. Exhaust safe in-scope alternatives first.

FINAL RESPONSE FORMAT

Return:

1. Outcome first: Gate 0 COMPLETE/PARTIAL/BLOCKED and Gate 1 COMPLETE/PARTIAL/BLOCKED.
2. Branch and local commit hashes.
3. Gate 0 verdict: PORT or RECONSTRUCTION, with the strongest evidence.
4. Gate 1 structure and important decisions.
5. Exact verification table: command, result, counts/warnings.
6. Container image/run evidence.
7. Files added/changed by commit.
8. Remaining blockers or risks.
9. Confirmation that nothing was pushed and no AI attribution was added.

Do not say “complete” based on scaffolding alone. Completion means the documented exit evidence passed.
```

## Reviewer handoff

When Claude finishes, send Codex:

```text
Review Claude's Gate 0 and Gate 1 implementation strictly. Inspect the actual branch, commits, recovery evidence, service boundaries, uv locks, settings safety, CI, containers and every reported verification command. Do not edit initially. Report blocking findings first and say whether each gate is genuinely complete.
```

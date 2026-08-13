---
title: Claude Opus Prompt - TitlePipe Gate 3 (first vertical contract slice)
date: 2026-07-24
status: ready-to-run
tags:
  - titlepipe
  - prompt
  - gate-3
  - openapi
  - contract
  - backend
aliases:
  - Gate 3 Claude Prompt
  - First Vertical Slice Prompt
---

# Claude Opus execution prompt — Gate 3

Copy everything inside the prompt block into a fresh Claude Code session opened at the TitleSearch repository root.

> [!danger] Precondition
> Do NOT start Gate 3 until Gate 2's mandatory RLS suite is green against real PostgreSQL and has been reviewed. Gate 3's repository/service runs *under* the RLS and tenant-context machinery Gate 2 builds. If Gate 2 is not green, stop and finish Gate 2 first (see claude-gate-2-execution-prompt.md).

> [!warning] Scope discipline
> Gate 3 is one endpoint, end to end: `GET /api/rules`. It is a *contract* slice, not a feature build. No WorkOS, no queue, no upload, no second endpoint. The frontend consumes the real API behind a development feature switch; MSW stays the default and no MSW handler is deleted yet.

---

## Prompt

```text
You are the primary implementation engineer for TitlePipe. Work directly in the repository and complete Gate 3: the first vertical contract slice, GET /api/rules, end to end on the Gate 2 PostgreSQL foundation. Do not merely propose a plan. Inspect, implement, run the checks, preserve evidence, and hand the result back for a separate Codex review before anything is pushed.

REPOSITORY

- Windows path: C:\Users\vicky\Desktop\TitleSearch
- Current project phase: P0.
- Target branch: rahuldr07/backend-foundation (Gates 0/1/2 committed and green).
- Local PostgreSQL 18.x on localhost:5432; Gate 2 provides roles, tenant context, forced RLS, Alembic and DSN-based test fixtures.

YOUR ROLE

- You own the implementation and the evidence.
- Do not delegate architectural or domain judgment. Subagents may do bounded read-only search/inventory only; verify their findings yourself. No parallel edits.
- Challenge contradictions using the controlling documents, not the UI. Never generate backend behavior from screens/pixels.
- Be direct and technical. No AI-generated notices, Claude tags, Co-Authored-By lines, or AI references in any file, commit, or commit message.

READ FIRST, IN THIS ORDER

1. CLAUDE.md (repo root) and .claude/CLAUDE.md
2. docs/HANDOFF.md
3. docs/CONTEXT.md, with §11 read twice (the rulebook and provenance semantics)
4. docs/PRD.md — data model and the rules/rulebook contract
5. docs/backend/IMPLEMENTATION_PLAN.md — §11 (API standards + endpoint migration procedure), §17 (rulebook architecture), §12 (contract generation), §27 Gate 3
6. docs/backend/GATE_2_POSTGRES.md — the DB foundation you build on
7. packages/contract — the current Zod contract for /api/rules (the wire shape you must match)
8. packages/mocks (MSW) — the current mock behavior for GET /api/rules
9. apps/web/src/api.ts — how the frontend parses responses at the boundary today

Precedence when documents conflict: HANDOFF > CONTEXT §11 > PRD > backend/PLAN.md > IMPLEMENTATION_PLAN.md > TOOLCHAIN.

SETTLED DECISIONS FOR THIS GATE

- Pydantic/OpenAPI 3.1 is the wire authority. The Zod contract is a migration INPUT, not the future authority.
- Generate the deterministic TypeScript client with openapi-typescript + openapi-fetch. Do not run multiple generators. Pin the generator version.
- The recommended first endpoint is GET /api/rules with a dependency-injected test principal until WorkOS is wired. There must be NO insecure production auth bypass.
- Zod remains for form UX only after an endpoint migrates.

HARD PRODUCT LAWS (relevant subset)

- Never emit a value without provenance: a rule/rule-version response carries origin, provenance tag, jurisdiction scope, status and version.
- PENDING rules are inert: they must never be returned as live/applicable, and must not affect prompts, routing, validation, rendering or delivery. Reflect status truthfully; do not hide it, but never present PENDING as active.
- Server owns state, status, ordering and any counts. The browser never computes rule status or re-derives counts.
- Stable machine-readable error codes plus safe messages; request/correlation ID in headers and error envelope, never containing tenant/order identifiers.
- Never accept actor/tenant identity from a request body. tenant scoping comes from the injected principal → Gate 2 tenant context → RLS.
- NPI and any secret never appear in URLs, query strings, logs, traces or metrics.
- Do not implement output for an OPEN/CONFLICT rule. If GET /api/rules would expose a field whose meaning is unresolved, stop and report.
- Never widen a contract type locally to make types line up; record a "CONTRACT GAP:" note instead.

RESOLVE BEFORE CODING (do not invent)

From CONTEXT/PRD/packages/contract, determine and write down:
1. Rule tenancy: are rules a shared platform rulebook or tenant-scoped rows? This decides whether the rules/rule_versions tables carry tenant_id and RLS, or are global reference data read the same for every tenant. Cite the source. If genuinely unspecified, stop and ask; do not guess.
2. The exact GET /api/rules response shape (fields, status enum, version representation) as it exists in the Zod contract + MSW mock. The Pydantic model must be contract-equivalent.
3. Whether the endpoint paginates (IMPLEMENTATION_PLAN §11 wants cursor pagination for potentially unbounded lists) and the server-owned sort order.

WORKING-TREE SAFETY

Treat existing uncommitted changes as user work. Start with git status --short / git diff --stat / git log --oneline -n 10. No reset --hard, checkout --, clean, force, destructive delete or history rewrite. Do not push. Codex reviews Gate 3 before push.

============================================================
GATE 3 - FIRST VERTICAL CONTRACT SLICE (GET /api/rules)
============================================================

3A. SCHEMA (rules + rule_versions)

Add an Alembic migration (as the migration role) for:
- rules and rule_versions per IMPLEMENTATION_PLAN §17: immutable rule_versions; each rule/version carries origin, provenance tag, jurisdiction scope, status (pending/live/retired) and evidence reference.
- Apply the tenancy decision from "resolve before coding". If tenant-scoped, enable+force RLS and a policy exactly as Gate 2 tables do (the new-table RLS guard must stay green). If shared reference data, document why it is exempt and make the guard aware of the exemption explicitly — never by weakening the guard.
- PENDING rules must be excludable by a query predicate (IMPLEMENTATION_PLAN §17: PENDING rules are inert; RuleContext selects only live versions).
- Add a small deterministic set of synthetic seed rules (safe, non-client) for local development and tests only — via a seed script, not committed client data.

3B. REPOSITORY / SERVICE / ROUTER

- repositories/: SQLAlchemy query for rules under the Gate 2 tenant context (or global read if shared reference data). Persistence mechanics only; no business decisions.
- services/: the command/query that applies rule selection semantics (e.g. never returns PENDING as live). Receives an authenticated Principal; never reads identity from the request.
- schemas/: Pydantic request/response models; response is contract-equivalent to the Zod shape. Provenance fields are present on emitted values.
- api/: a thin router under base path /api. Validation and translation only; no state-machine logic in the router. Map failures through the existing global error-mapping layer (stable code + safe message + request_id).
- auth: a dependency-injected test Principal (user_id, tenant_id, membership, roles/capabilities). It is dev/test ONLY. It must refuse to load in a deployed environment (reuse the environment fail-closed pattern from settings.py). There is no header-based or query-based production auth bypass.

3C. OPENAPI + TS CLIENT

- Emit OpenAPI 3.1 from the FastAPI app. Normalize non-semantic ordering before snapshotting so the schema diff is deterministic.
- Generate the TypeScript client slice with a PINNED openapi-typescript + openapi-fetch into generated/api-client/. Optionally add a thin TanStack Query hook around the generated client (no bespoke fetch layer, no axios).
- Add a CI/local drift check: regenerating the client from the live OpenAPI must produce no diff against the committed artifact; a difference fails the check. Commit the OpenAPI/client artifacts.

3D. FRONTEND WIRING (feature switch, not cutover)

- Introduce a development feature switch (e.g. an env-driven flag) that points the rules screen at the real API via the generated client. Default OFF: MSW remains the default backend for the app and for tests.
- Every response still parses through @titlepipe/contract at the boundary (apps/web/src/api.ts). Do not widen a contract type; emit CONTRACT GAP notes if the Pydantic shape and Zod shape disagree, and reconcile toward the Pydantic authority.
- Do NOT delete the MSW /api/rules handler in this gate. Cutover/handler deletion is a later gate. The point here is contract equivalence, proven with the switch on.

3E. TESTS

- Domain/policy unit tests: PENDING is never returned as live; provenance fields are always present; server-owned sort order is stable.
- Repository/RLS integration test against local Postgres: if rules are tenant-scoped, Tenant A never sees Tenant B rules; unset tenant context yields no rows.
- API contract test: response validates against the OpenAPI schema; Schemathesis over the single endpoint if quick to wire.
- Client drift test: generated client matches committed artifact.
- Frontend: with the switch ON, the rules screen renders equivalently to the MSW path; keep all 116 Playwright tests and the Vitest suite green with the switch in its default state.

3F. DOCUMENTATION

Create/append docs/backend/GATE_3_SLICE.md:
- date, machine/OS, executor.
- The resolved rule-tenancy decision and its citation.
- The contract-equivalence evidence (Zod shape vs Pydantic/OpenAPI shape) and any CONTRACT GAP reconciled.
- How the feature switch works and how to run the app against the real API locally.
- Exact commands: migrate, seed synthetic rules, run backend tests, generate OpenAPI + client, run the drift check, run frontend tests.
- Gate 3 exit checklist with honest pass/blocked state.

GATE 3 VERIFICATION

Backend (services/core-api, frozen, local Postgres up):
- uv sync --frozen --all-groups
- uv run ruff check . && uv run ruff format --check .
- uv run pyright   (strict, 0 errors)
- TITLEPIPE_TEST_DATABASE_URL=... uv run pytest   (all green, incl. rules RLS/contract tests)
- generate OpenAPI + TS client, then run the drift check → no diff

Frontend regression once, after Gate 3 work:
- pnpm --filter web typecheck / test / lint / build
- pnpm --filter web test:e2e   (all 116 green with the switch default OFF)
- with the switch ON against the running real API, confirm the rules screen is contract-equivalent
- git diff --check

COMMITS

Focused local commits, existing user identity, ordinary human messages, no AI attribution. Suggested split:
1. Add rules/rule_versions schema and synthetic seed
2. Implement GET /api/rules repository, service and router with injected principal
3. Emit OpenAPI 3.1 and generate the deterministic TS client slice with drift check
4. Wire the rules screen behind a development feature switch
5. Document Gate 3 vertical slice

Do not commit client/NPI data, real credentials, .env files, databases or dumps. Do not push.

STOP CONDITIONS

Stop and report rather than guessing if:
- rule tenancy or the response shape cannot be determined from CONTEXT/PRD/contract without inventing a domain fact,
- GET /api/rules would expose a field governed by an OPEN/CONFLICT rule,
- making types line up would require widening a contract type (emit a CONTRACT GAP instead and stop if it is load-bearing),
- the drift check cannot be made deterministic,
- the only way to pass an auth check would be a production bypass.

Do not stop for ordinary implementation difficulty.

FINAL RESPONSE FORMAT

1. Outcome first: Gate 3 COMPLETE / PARTIAL / BLOCKED.
2. Branch and local commit hashes.
3. The rule-tenancy decision and its citation.
4. Contract-equivalence evidence (real API vs mock) and any CONTRACT GAP handled.
5. Verification table: command → result → counts.
6. Drift-check result.
7. Files added/changed by commit.
8. Confirmation there is no insecure production auth bypass.
9. Confirmation that nothing was pushed and no AI attribution was added.

Completion means: real API and mock are contract-equivalent, the client drift check is green, the RLS/policy tests pass, and no insecure auth bypass exists — not that the endpoint returns 200.
```

## Reviewer handoff

When Claude finishes, send Codex:

```text
Review Claude's Gate 3 vertical slice strictly. Confirm: rule tenancy is a cited decision, not an assumption; PENDING rules are never returned as live and the browser never computes status; the response carries required provenance and matches the OpenAPI/Pydantic authority; the injected principal is dev/test-only with no production auth bypass; RLS still holds for the new tables and the new-table guard is green; the client drift check is deterministic and green; and the frontend switch is default-off with MSW intact and all 116 Playwright tests green. Report blocking findings first and say whether Gate 3 is genuinely complete.
```

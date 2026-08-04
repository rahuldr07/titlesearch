---
title: Claude Opus Prompt - TitlePipe Gate 2 (PostgreSQL correctness)
date: 2026-07-24
status: ready-to-run
tags:
  - titlepipe
  - prompt
  - gate-2
  - postgres
  - rls
  - backend
aliases:
  - Gate 2 Claude Prompt
  - PostgreSQL Correctness Prompt
---

# Claude Opus execution prompt — Gate 2

Copy everything inside the prompt block into a fresh Claude Code session opened at the TitleSearch repository root.

> [!warning] Environment adaptation (no Docker)
> This project runs against a **local PostgreSQL** install instead of Testcontainers, because Docker/WSL2 is deliberately skipped for now. Local PostgreSQL 18.x is installed and accepting connections on `localhost:5432`. Local Postgres is real PostgreSQL, so Gate 2's "runs against real PostgreSQL" exit criterion is satisfiable — only the provisioning mechanism changes (env DSN instead of an ephemeral container). Keep a Testcontainers fallback wired but Docker-gated so the CI story survives for later.

> [!danger] The single correctness rule of this gate
> Integration tests MUST connect as the **non-owner `titlepipe_app` role** with `FORCE ROW LEVEL SECURITY` on every tenant-scoped table. If any isolation test runs as a superuser, the table owner, or a `BYPASSRLS` role, RLS is silently bypassed and every "isolation passes" result is a false positive. Prove the app role is what the runtime uses.

---

## Prompt

```text
You are the primary implementation engineer for TitlePipe. Work directly in the repository and complete Gate 2 (PostgreSQL correctness) against the local PostgreSQL server. Do not merely propose a plan. Inspect, implement, run the checks against real Postgres, preserve evidence, and hand the result back for a separate Codex review before anything is pushed.

REPOSITORY

- Windows path: C:\Users\vicky\Desktop\TitleSearch
- Current project phase: P0.
- Target branch: rahuldr07/backend-foundation (already checked out; foundation from Gates 0/1 is committed and green).
- Local PostgreSQL 18.x is installed and accepting connections on localhost:5432. psql is on PATH.

YOUR ROLE

- You own the implementation and the evidence.
- Think carefully about correctness; do not optimize for producing many files.
- Do not delegate architectural or domain judgment. Subagents may perform bounded read-only searches or inventories only; verify their findings yourself. No parallel edits.
- Challenge contradictions using the controlling documents, not assumptions from the UI.
- Be direct and technical. Do not add AI-generated notices, Claude tags, Co-Authored-By lines, or AI references to any file, commit, or commit message.

READ FIRST, IN THIS ORDER

Read completely before editing:

1. CLAUDE.md (repo root) and .claude/CLAUDE.md
2. docs/HANDOFF.md
3. docs/CONTEXT.md, with §11 read twice
4. docs/PRD.md (data model and release gates)
5. docs/backend/PLAN.md
6. docs/backend/IMPLEMENTATION_PLAN.md — §7 (data architecture), §8 (state machines), §9 (roles and RLS), §27 Gate 2, §29 stop conditions
7. docs/backend/TOOLCHAIN.md
8. docs/backend/GATE_1_FOUNDATION.md — the foundation you are extending
9. services/core-api/src/titlepipe_core/api/request_context.py — its docstring already anticipates the Gate 2 tenant context; reuse that discipline, do not reinvent it

Precedence when documents conflict: HANDOFF (state) > CONTEXT §11 (domain truth) > PRD (product) > backend/PLAN.md (tech decisions) > IMPLEMENTATION_PLAN.md (sequencing) > TOOLCHAIN.

SETTLED DECISIONS FOR THIS GATE (do not relitigate)

- PostgreSQL with forced RLS and non-owner runtime roles.
- SQLAlchemy 2 async + psycopg 3.
- Alembic migrations; never run migrations at API startup.
- Transaction-local tenant context via set_config('app.current_tenant', <id>, true); policies read current_setting('app.current_tenant', true) and fail closed when unset.
- Physically separate blind database is deferred to Gate 9; Gate 2 is the Core database only.
- PgQueuer/queue tables are deferred; do not install a queue in this gate.

HARD PRODUCT LAWS (relevant subset)

- Server owns all state machines, thresholds, counts and refusals.
- tenant_id on every core tenant-scoped row; actor IDs are server-populated; never accept actor/signed_by from a request body.
- created_at/updated_at are timezone-aware UTC; monetary values use decimal/integer minor units, never floats.
- Provenance fields are mandatory for emitted values (schema-level readiness now, enforced when values are emitted at later gates).
- Append-only transition/audit tables reject UPDATE/DELETE for runtime roles.
- Never place county packages, seed databases, client documents, uploads or NPI in VCS. Real NPI never enters logs, traces, metrics or URLs.
- Do not create generic globals.py/common.py/helpers.py/utils.py/messages.py dumping grounds. One responsibility per module.
- libs/domain stays framework-free: no SQLAlchemy/psycopg import may leak into it.

WORKING-TREE SAFETY

Treat every existing uncommitted change as user work. Start with:

- git status --short
- git diff --stat
- git log --oneline --decorate --max-count=10

Do not use git reset --hard, git checkout --, clean, force operations, destructive deletes or history rewrites. Do not push. Codex reviews Gate 2 before Gate 3 begins.

TODAY'S OBJECTIVE

Complete Gate 2 only: initial Core schema and naming convention, migration/runtime roles, tenant-context lifecycle, forced RLS, append-only audit primitive, tenant-leading indexes, and the mandatory RLS test suite passing against local PostgreSQL. Do NOT implement any product endpoint (GET /api/rules is Gate 3). Do NOT wire WorkOS.

============================================================
GATE 2 - POSTGRESQL CORRECTNESS
============================================================

2A. DATABASE DEPENDENCIES

Add to services/core-api only (keep other services untouched this gate):
- sqlalchemy[asyncio], psycopg[binary,pool], alembic
- dev group: testcontainers[postgres] (used only when Docker exists; Docker-gated), and a pinned Squawk migration linter for CI (if it cannot be pinned locally without Docker/npm, defer Squawk to CI and record that — the in-repo new-table RLS guard below is the non-negotiable check).

Regenerate the exact uv.lock. Keep the dependency comment in pyproject.toml honest about what landed and why.

2B. LOCAL DATABASE PROVISIONING (adaptation, documented)

Provide a scripted, idempotent local bootstrap (a Python or SQL script under infra/sql/ or scripts/, invoked from docs) that, against localhost:5432:
- Creates database titlepipe (dev) and titlepipe_test (integration), owned by titlepipe_migration.
- Creates roles: titlepipe_migration (owns schema; NOT used at runtime), titlepipe_app (LOGIN, no BYPASSRLS), titlepipe_worker (LOGIN, no BYPASSRLS). Least privilege; app/worker get only the grants they need.
- Is safe to re-run (IF NOT EXISTS / DO blocks). Never hardcodes a real password into VCS; read credentials from env with safe local defaults and document them in .env.example (names + safe examples only).

Integration test fixtures resolve the DSN in this order:
1. If TITLEPIPE_TEST_DATABASE_URL is set, use it (local Postgres). This is the path you use now.
2. Else, if Docker is available, spin Testcontainers[postgres]. Keep this branch compiling but do not depend on it locally.
Tests connect as titlepipe_app (non-owner). Migrations run as titlepipe_migration. Assert in a test that the runtime DSN role is neither owner nor migration nor BYPASSRLS.

2C. DB MODULE AND TENANT CONTEXT

Create src/titlepipe_core/db/ with single-responsibility modules:
- engine/session: create_async_engine with a bounded pool sized against local limits; async session/connection helpers. No engine constructed at import time — build it in the app factory / a resource object, close it in lifespan (respect the Gate 1 "no mutable process-global clients" rule).
- naming convention: a declarative Base whose metadata carries an explicit naming_convention for pk/fk/uq/ck/ix so Alembic emits deterministic, reviewable names.
- tenant context: a ContextVar for the current tenant, mirroring request_context.py's request-id contextvar. A transaction helper opens a transaction and calls a parameterized set_config('app.current_tenant', <tenant>, true). The ContextVar is reset in finally. Fail closed: if no tenant is bound, the helper must not silently run an unscoped query.

Do not read tenant identity from any request body. At this gate the tenant is supplied by tests/fixtures directly; WorkOS-derived principals arrive at Gate 4.

2D. INITIAL SCHEMA (Core only)

Model in src/titlepipe_core/models/ (SQLAlchemy mappings only; no business logic) the identity/tenancy core sufficient to prove RLS:
- tenants, users, memberships, roles, permissions, role_permissions (memberships carry tenant-scoped roles; do not put a single role column on users).
- One append-only audit/transition primitive table (e.g. audit_events) that rejects UPDATE/DELETE for runtime roles.

Required column conventions (IMPLEMENTATION_PLAN §7): UUID/ULID PKs; tenant_id on every tenant-scoped row; UTC created_at/updated_at; version/optimistic-lock on mutable aggregate roots; server-populated actor IDs; decimal/integer money; separate raw vs normalized value columns where values are stored. Add CHECK constraints for enums/local invariants and FKs for every link. Add tenant-leading indexes on every tenant-scoped access path; use partial indexes for hot paths rather than global counters.

Do NOT model the full table catalogue from §7 — model exactly what a real cross-tenant isolation suite needs plus the audit primitive. rules/rule_versions belong to Gate 3.

2E. FORCED RLS

For every tenant-scoped table:
- ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY (so even the table owner is subject to policy).
- A policy keyed on tenant_id = current_setting('app.current_tenant', true)::uuid (adjust cast to the id type), covering SELECT/INSERT/UPDATE/DELETE, that yields zero rows and rejects mutations when the setting is unset/empty.
- Grants: titlepipe_app/titlepipe_worker get DML but never own the table and never BYPASSRLS. The append-only table additionally denies UPDATE/DELETE to runtime roles.

2F. ALEMBIC

- Initialize Alembic under services/core-api/migrations with an env.py that connects as the migration role, supports offline and online modes, and uses the models' metadata + naming convention.
- Migrations are the only way schema changes happen. No autogenerate-and-run at API startup. Document the exact migrate command.
- Keep the first migration reviewable: explicit, not a giant opaque autogenerate dump.

2G. MANDATORY RLS TEST SUITE (IMPLEMENTATION_PLAN §9)

All against real local PostgreSQL, connected as titlepipe_app. Prove, each as an explicit test:
- Tenant A cannot read, update or delete Tenant B rows.
- Unset tenant context returns zero tenant rows and rejects mutations.
- A reused pooled connection does not retain the previous tenant's setting (interleave two tenants on the same pooled connection).
- Two tenants interleaved across transactions do not leak.
- Worker-role transactions receive the same isolation guarantees.
- The runtime DSN role is never owner/migration/BYPASSRLS.
- NEW-TABLE RLS GUARD: a meta-test that introspects pg_class/pg_policies and FAILS if any tenant-scoped table lacks ENABLE+FORCE RLS and a policy. This is what stops a future tenant table from shipping without isolation. It must be a real assertion, not a TODO.

Also keep the Gate 1 foundation suites green (request-id propagation, error envelope safety, redaction, lifespan open/close-once). The DB engine must open and close exactly once per app lifecycle.

2H. DOCUMENTATION

Create docs/backend/GATE_2_POSTGRES.md containing:
- date, machine/OS, executor, PostgreSQL version.
- The local-Postgres adaptation and why (Testcontainers deferred to Docker; DSN-based fixtures now).
- Roles and grants table; which role runs migrations vs runtime.
- Tenant-context lifecycle (ContextVar → set_config transaction-local → reset in finally → fail-closed policy).
- Schema/naming convention and the tables created.
- Exact local commands: bootstrap roles/DBs, migrate, run tests with TITLEPIPE_TEST_DATABASE_URL, lint, typecheck.
- The full mandatory RLS suite mapped to test names, with results.
- Gate 2 exit checklist with honest pass/blocked state.
- What remains for Gate 3 (rules/rule_versions, first endpoint).

GATE 2 VERIFICATION

From services/core-api, frozen state, with local Postgres running:
- uv sync --frozen --all-groups
- uv run ruff check . && uv run ruff format --check .
- uv run pyright                     (strict, 0 errors)
- TITLEPIPE_TEST_DATABASE_URL=... uv run pytest   (all green, incl. the RLS suite against real Postgres)
Record exact collected/passed/failed counts.

Repository regression once, after Gate 2 work (not per commit):
- pnpm --filter web typecheck / test / lint / build   (Gate 2 touches no frontend; confirm no regression)
- git diff --check

COMMITS

Focused local commits under the existing user identity, ordinary human messages, no AI attribution. Suggested split:
1. Add database dependencies and local Postgres bootstrap
2. Add tenant context, forced RLS schema and Alembic baseline
3. Add mandatory RLS isolation suite and new-table guard
4. Document Gate 2 PostgreSQL correctness

Do not commit databases, dumps, real credentials, .env files, or any client/NPI data. Do not push.

STOP CONDITIONS

Stop and report rather than guessing if:
- an OPEN/CONFLICT domain rule would affect a table or constraint you are about to model,
- you cannot make an isolation test connect as a genuine non-owner role (do not "fix" it by testing as superuser),
- a schema decision would require inventing a domain fact you cannot cite from CONTEXT/PRD,
- an existing uncommitted change would be endangered by your edits.

Do not stop for ordinary implementation difficulty.

FINAL RESPONSE FORMAT

1. Outcome first: Gate 2 COMPLETE / PARTIAL / BLOCKED, against local PostgreSQL.
2. Branch and local commit hashes.
3. Roles/grants summary and proof the runtime role is non-owner/non-BYPASSRLS.
4. Tenant-context lifecycle summary.
5. The mandatory RLS suite as a table: test name → result.
6. Exact verification commands and counts.
7. Files added/changed by commit.
8. Remaining blockers/risks and what Gate 3 now depends on.
9. Confirmation that nothing was pushed and no AI attribution was added.

Completion means the documented exit evidence passed against real PostgreSQL — not that the schema compiles.
```

## Reviewer handoff

When Claude finishes, send Codex:

```text
Review Claude's Gate 2 implementation strictly. Inspect the actual branch, migrations, roles/grants, RLS policies (ENABLE + FORCE), the tenant-context lifecycle and every isolation test. Confirm the tests connect as a genuine non-owner role and would actually fail if RLS were removed (spot-check by reasoning about at least one policy). Verify the new-table RLS guard is a real assertion. Confirm no migration runs at API startup and no owner/BYPASSRLS role is in any runtime DSN. Report blocking findings first and say whether Gate 2 is genuinely complete.
```

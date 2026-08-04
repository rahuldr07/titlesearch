# ZCode project config — TitlePipe

This file documents the TitlePipe stack and the exact commands for this repo.
It is scoped: it does **not** override the workspace `AGENTS.md` hard rules or
the document precedence in `docs/backend/IMPLEMENTATION_PLAN.md`. Read those first.

## Stack

- **Monorepo:** pnpm workspaces (`apps/web`, `packages/*`) + four independent Python services + two libs.
- **Frontend:** React 19 + TypeScript strict + Vite 8 + TanStack (Query/Router/Table) + Tailwind v4 + Zod 4. MSW in dev/test. oxlint + Playwright + Vitest.
- **Backend:** Python 3.13 (`>=3.13,<3.14`) + FastAPI + Pydantic v2. **Six independent uv projects**, each with its own committed `uv.lock` (no shared environment): `services/core-api`, `services/blind-svc`, `services/extraction-svc`, `services/render-svc`, `libs/domain`, `libs/test-support`.
- **Tooling:** Ruff + Pyright strict (per project); shared `ruff.toml` at root; pre-commit; Python tests via pytest.
- **Node:** `package.json` uses pnpm `10.33.2` (root + workspace).
- **Container/CI:** `.github/workflows/backend.yml` written but **remote CI not yet run** (Docker absent on this machine); see `docs/backend/GATE_1_FOUNDATION.md` §9.

## Commands — Frontend (run from repo root)

```bash
pnpm --filter web typecheck      # tsc -b
pnpm --filter web test           # vitest run
pnpm --filter web lint           # oxlint
pnpm --filter web build          # copy-pdf-worker + tsc -b + vite build
pnpm --filter web test:e2e       # playwright (116 specs)
```

## Commands — Backend (run from each project dir: services/*, libs/*)

```bash
uv sync --frozen --all-groups    # frozen install
uv run ruff check .
uv run ruff format --check .
uv run pyright                   # strict
uv run pytest
uv build                         # wheel + sdist (packaged projects)
```

Workers: `uv run titlepipe-extraction check` / `uv run titlepipe-render check` (exit 0 ok · 2 invalid config · 3 not implemented).

## Commands — Repo-wide hygiene

```bash
python scripts/check_locks.py                # all six uv.lock files current
python scripts/audit_dependencies.py         # pip-audit over each frozen lock
python scripts/check_no_client_data.py       # refuse PDF/DOCX/.seed/uploads into VCS
uv run --with pytest python -m pytest scripts/tests
uvx pre-commit run --all-files
```

## Conventions

- **Document precedence (when they conflict):** HANDOFF → CONTEXT §11 → PRD → backend/PLAN → IMPLEMENTATION_PLAN → TOOLCHAIN.
- **Phase:** P0. Gates 0 (COMPLETE, PORT) and 1 (LOCAL FOUNDATION COMPLETE, official gate PARTIAL — Docker/WSL2 absent). Gate 2 = next (Postgres RLS) and needs Docker/WSL2 installed first.
- **Never** generate backend logic from screens. Never emit a value without provenance. Two NA states. v99 deliberately empty. See workspace `AGENTS.md` hard rules.
- Python style: follow `ruff.toml`; type hints required; Pyright strict. JS/TS: match existing patterns, oxlint, prefer real types over `any`.
- Never commit/push unless asked. No county packages, seed DBs, PDFs, uploads, `.env`, venvs in VCS.

# TitlePipe — project config

Read `CLAUDE.md` at repo root first (doc order: docs/HANDOFF.md → docs/CONTEXT.md → docs/PRD.md; frontend build spec: docs/prompts/frontend-master-prompt.md).

## Stack
- pnpm workspaces (pnpm@10.33.2): `apps/web-v2` (React 19 + Vite 8 + TS 6 strict + Tailwind v4) — **`apps/web` was deleted; web-v2 is the only app**. `packages/contract` (Zod 4), `packages/mocks` (MSW 2 — the backend until FastAPI lands), `packages/ui-tokens`.
- **Contract authority, amended 2026-08-05 (ADR-0001 signature):** Pydantic/OpenAPI in `services/core-api` is authoritative for the WIRE, migrated endpoint-by-endpoint. Zod stays the browser's runtime boundary parser — `openapi-fetch` ships no validation, and every response must still parse at the boundary.
- TanStack Query/Router/Table/Virtual · react-hook-form + zodResolver · zustand (keyboard/panel state only) · react-hotkeys-hook · react-pdf · Vitest · Playwright · eslint.
- Forbidden deps: axios, redux, react-router-dom, next, styled-components, MUI-likes, moment/dayjs, lodash. No `any`, no default exports for screens.

## Commands (run from repo root)
- Dev server: `pnpm --filter web-v2 dev` (Vite, port 5174, MSW serves all data)
- Build: `pnpm --filter web-v2 build` (tsc -b + vite build)
- Typecheck all: `pnpm typecheck`
- Lint: `pnpm --filter web-v2 lint` (eslint)
- E2E: `pnpm --filter web-v2 test:e2e` (Playwright, `apps/web-v2/e2e`)
- Live migration harness: `pnpm --filter web-v2 test:e2e:live` (Playwright, `apps/web-v2/e2e-live` **and** selected frozen specs from `e2e/` — see `playwright.live.config.ts`). Needs **three** things, not one, since Plan 02 Task 5: a Postgres with `migrations/sql/roles.sql` applied and `alembic upgrade head` run; a core-api started with **`TITLEPIPE_APP_DATABASE_URL`** (the *app* role) as well as `TITLEPIPE_ENVIRONMENT=development`; and **`TITLEPIPE_DATABASE_URL`** (the *migration* role — a different variable and a different role) exported for the seed step, which the script refuses by name without. Override core-api's address with `VITE_API_PROXY_TARGET`. The workflow `.github/workflows/migration-harness.yml` is the executable version of this list; read it rather than reassembling the commands by hand.
- `VITE_API_MODE` picks the backend at BUILD time: `mock` (default) starts MSW and configures no proxy; `live` starts no worker and proxies `/api` to core-api. Any other value refuses to boot, on screen.
- Unit: `pnpm --filter web-v2 test` (Vitest) · Rules gate: `pnpm --filter web-v2 check:rules` · Dead code: `pnpm --filter web-v2 knip`
- Backend (from `services/core-api`, as CI runs it): `uv run ruff check .` · `uv run ruff format --check .` · `uv run pyright` · `uv run pytest`

## Conventions
- Visual reference (approved 2026-08-01): `docs/frontend/directions/hybrid.html` — warm-paper palette; Fraunces display, Switzer body/UI, Geist Mono values/cites, Courier Prime in the facsimile. `design-export/TitlePipe.dc.html` stays the behavior spec (`design-export/README.md`). Colors ONLY via tokens in `packages/ui-tokens/src/tokens.css` (app entry `apps/web-v2/src/styles/index.css`) — no raw hex in TSX.
- Every API response parses through `@titlepipe/contract` at the boundary (`apps/web/src/api.ts`). Never widen a contract type locally — emit `CONTRACT GAP:` notes instead.
- Refusal rules (correction needs reason, escalation needs question, ruling needs citation, golden correction needs source+reason+signature) live in contract schemas + Playwright tests — never hand-rolled.

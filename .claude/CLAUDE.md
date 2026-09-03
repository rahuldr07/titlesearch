# TitlePipe — project config

Read `CLAUDE.md` at repo root first (doc order: docs/HANDOFF.md → docs/CONTEXT.md → docs/PRD.md; frontend build spec: docs/prompts/frontend-master-prompt.md).

## Stack
- pnpm workspaces (pnpm@10.33.2): `apps/web`, package name **`@titlepipe/web`** (React 19 + Vite 8 + TS 6 strict + Tailwind v4) — **the only app; `apps/web-v2` was the rebuild scratch copy and was deleted in `f2af433`**. `packages/contract` (Zod 4), `packages/mocks` (MSW 2 — the backend until FastAPI lands), `packages/ui-tokens`.
- **Contract authority, amended 2026-08-05 (ADR-0001 signature):** Pydantic/OpenAPI in `services/core-api` is authoritative for the WIRE, migrated endpoint-by-endpoint. Zod stays the browser's runtime boundary parser — `openapi-fetch` ships no validation, and every response must still parse at the boundary.
- TanStack Query/Router/Table/Virtual · react-hook-form + zodResolver · zustand (keyboard/panel state only) · **tinykeys** (chords, via `src/shared/chords.ts`) · **react-aria-components** (the kit's behaviour layer, 44 files) · Vitest · Storybook (a11y addon set to `error` — axe is a gate, not a report) · Playwright · eslint.
- Forbidden deps: axios, redux, react-router-dom, next, styled-components, MUI-likes, moment/dayjs, lodash. No `any`, no default exports for screens.

## Commands (run from repo root)
- Dev server: `pnpm --filter @titlepipe/web dev` (Vite, port 5174, MSW serves all data)
- Build: `pnpm --filter @titlepipe/web build` (tsc -b + vite build)
- Typecheck all: `pnpm typecheck`
- Lint: `pnpm --filter @titlepipe/web lint` (eslint)
- E2E: `pnpm --filter @titlepipe/web test:e2e` (Playwright, `apps/web/e2e`)
- Live migration harness: `pnpm --filter @titlepipe/web test:e2e:live` (Playwright, `apps/web/e2e-live` **and** selected frozen specs from `e2e/` — see `playwright.live.config.ts`). Needs **three** things, not one, since Plan 02 Task 5: a Postgres with `migrations/sql/roles.sql` applied and `alembic upgrade head` run; a core-api started with **`TITLEPIPE_APP_DATABASE_URL`** (the *app* role) as well as `TITLEPIPE_ENVIRONMENT=development`; and **`TITLEPIPE_DATABASE_URL`** (the *migration* role — a different variable and a different role) exported for the seed step, which the script refuses by name without. Override core-api's address with `VITE_API_PROXY_TARGET`. The workflow `.github/workflows/migration-harness.yml` is the executable version of this list; read it rather than reassembling the commands by hand.
- `VITE_API_MODE` picks the backend at BUILD time: `mock` (default) starts MSW and configures no proxy; `live` starts no worker and proxies `/api` to core-api. Any other value refuses to boot, on screen.
- Unit: `pnpm --filter @titlepipe/web test` (Vitest) · Rules gate: `pnpm --filter @titlepipe/web check:rules` · Dead code: `pnpm --filter @titlepipe/web knip`
- Backend (from `services/core-api`, as CI runs it): `uv run ruff check .` · `uv run ruff format --check .` · `uv run pyright` · `uv run pytest`

## Conventions
- Design pixel spec: `docs/archive/Title report review tool.zip` → `.dc.html` files (warm-paper palette, IBM Plex). Colors ONLY via tokens from `@titlepipe/ui-tokens` (`packages/ui-tokens/src/tokens.css`, imported by `apps/web/src/styles.css`) — no raw hex in TSX.
- Every API response parses through `@titlepipe/contract` at the boundary (`apps/web/src/shared/api.ts`). Never widen a contract type locally — emit `CONTRACT GAP:` notes instead.
- Refusal rules (correction needs reason, escalation needs question, ruling needs citation, golden correction needs source+reason+signature) live in contract schemas + Playwright tests — never hand-rolled.

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
- Unit: `pnpm --filter web-v2 test` (Vitest) · Rules gate: `pnpm --filter web-v2 check:rules` · Dead code: `pnpm --filter web-v2 knip`
- Backend (from `services/core-api`, as CI runs it): `uv run ruff check .` · `uv run ruff format --check .` · `uv run pyright` · `uv run pytest`

## Conventions
- Design pixel spec: `docs/archive/Title report review tool.zip` → `.dc.html` files (warm-paper palette, IBM Plex). Colors ONLY via tokens in `apps/web/src/index.css` — no raw hex in TSX.
- Every API response parses through `@titlepipe/contract` at the boundary (`apps/web/src/api.ts`). Never widen a contract type locally — emit `CONTRACT GAP:` notes instead.
- Refusal rules (correction needs reason, escalation needs question, ruling needs citation, golden correction needs source+reason+signature) live in contract schemas + Playwright tests — never hand-rolled.

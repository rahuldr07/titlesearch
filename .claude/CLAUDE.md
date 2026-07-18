# TitlePipe — project config

Read `CLAUDE.md` at repo root first (doc order: docs/HANDOFF.md → docs/CONTEXT.md → docs/PRD.md; frontend build spec: docs/prompts/frontend-master-prompt.md).

## Stack
- pnpm workspaces (pnpm@10.33.2): `apps/web` (React 19 + Vite 8 + TS 6 strict + Tailwind v4), `packages/contract` (Zod 4 — REST contract source of truth), `packages/mocks` (MSW 2 — the backend until FastAPI lands).
- TanStack Query/Router/Table/Virtual · react-hook-form + zodResolver · zustand (keyboard/panel state only) · react-hotkeys-hook · react-pdf · Vitest · Playwright · oxlint.
- Forbidden deps: axios, redux, react-router-dom, next, styled-components, MUI-likes, moment/dayjs, lodash. No `any`, no default exports for screens.

## Commands (run from repo root)
- Dev server: `pnpm --filter web dev` (Vite, port 5173, MSW serves all data)
- Build: `pnpm --filter web build` (tsc -b + vite build)
- Typecheck all: `pnpm typecheck`
- Lint: `pnpm --filter web lint` (oxlint)
- E2E: `pnpm --filter web test:e2e` (Playwright, apps/web/e2e)

## Conventions
- Design pixel spec: `Title report review tool.zip` → `.dc.html` files (warm-paper palette, IBM Plex). Colors ONLY via tokens in `apps/web/src/index.css` — no raw hex in TSX.
- Every API response parses through `@titlepipe/contract` at the boundary (`apps/web/src/api.ts`). Never widen a contract type locally — emit `CONTRACT GAP:` notes instead.
- Refusal rules (correction needs reason, escalation needs question, ruling needs citation, golden correction needs source+reason+signature) live in contract schemas + Playwright tests — never hand-rolled.

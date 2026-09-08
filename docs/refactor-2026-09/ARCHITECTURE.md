# Where new code belongs

**Date:** 2026-09-08 · **Scope:** the dependency directions of the tree as it stands, and the machine that enforces them. This describes what exists at `9866da7`; the planned end-state lives in HANDOFF §4 and is marked *planned, not built* below. Every directory here is a real responsibility — the repo does not carry empty layers, and none may be added ahead of the code that needs them.

## The tree

```
apps/web            React 19 SPA — the review tool (the only app)
packages/contract   Zod schemas — the browser's runtime boundary parser
packages/mocks      MSW 2 — the mock backend for VITE_API_MODE=mock
packages/ui-tokens  tokens.css — the only place colors are defined
services/core-api   FastAPI — synchronous HTTP orchestration, auth, RBAC, RLS;
                    owns migrations/ (Alembic) and the wire contract (ADR-0001)
services/blind-svc  FastAPI — blind assignment and entry capture ONLY; blindness
                    is by network topology, so it stays a separate deployable
services/worker     asyncio queue consumer — validation, segmentation,
                    extraction, assembly, routing, DOCX/PDF, report versioning
libs/domain         framework-free domain primitives; depends on nothing of ours
libs/service-kit    process scaffolding every deployable runs: typed settings,
                    redacted structured logging, telemetry seams
libs/http-kit       HTTP-layer plumbing the API services share: request
                    correlation and the error contract (worker serves no HTTP
                    and does not take it)
libs/test-support   deterministic test doubles for the Python suites
```

### Planned, not built

HANDOFF §4 sketches six services. Three of them do not exist in the tree, and **must not be created as empty shells** — a directory arrives with its code or not at all:

- **extraction-svc** and **render-svc** — briefly existed as refuse-to-run CLI shells; retired into `services/worker` (`61a1945`, 2026-09-04, four deployables → three). Their responsibilities live in the worker today and split out only when scale argues.
- **pdf-svc** (CPU-bound rasterization sidecar) and **inference-svc** (GPU) — planned, never started.

## Frontend directions (`apps/web/src` + `packages/*`)

`pnpm --filter @titlepipe/web check:imports` enforces these on a resolved module graph — it follows relative paths, the tsconfig `@/*` alias, and workspace `exports` maps, so a re-export barrel launders nothing. `check:rules` stays the per-line gate; the two do different jobs.

- **`features/<f>/`** — a screen and everything private to it. Its components, hooks and utilities are internal: from outside, only `features/<f>/index.ts(x)` may be imported, and **no feature imports another feature**, entry point or not. Something two features need moves DOWN (to `entities/`, `shared/`, or `components/ui/`), never sideways.
- **`app/`** — composition: routes, chrome, keyboard, session. The only layer that may import `@tanstack/react-query`/`react-router` AND be imported by features (`app/useRead.ts`, `app/chrome/RouteButton`).
- **`entities/`** — render-only domain pieces. No fetching, no router.
- **`shared/`** — read descriptors, parsers, utilities. Sits below the app shell and never imports `app/`.
- **`components/ui/`** — the design system. It may not know features exist; anything route-aware belongs in `app/chrome/`.
- **`workbench/`** — dev-only second Rollup entry. `src/main.tsx` never reaches it, or `packages/mocks`, over static imports; the mock bootstrap is a dynamic import behind the build-time `VITE_API_MODE` guard, which is the one sanctioned pattern.
- **`packages/contract`** — depends on zod and nothing else of ours: not mocks, not `apps/web`, not presentation libraries.
- **No import cycles** anywhere in `apps/web/src` or `packages/*/src`, type-only edges included; a lazy `import()` is the sanctioned way to break one.

New frontend code: screen-specific → its feature; shared render-only domain → `entities/`; a primitive → `components/ui/`; a read descriptor → `shared/*Queries.ts`; router/query glue → `app/`. Name the home, not the pattern — "copy the PanelState pattern" once produced six copies of one wrapper.

## Backend directions (`services/*` + `libs/*`)

- Services import libs; **libs never import services**; services never import each other's code — they meet only at Postgres (schemas per service) and the queue. `libs/domain` is the floor: framework-free, imported by everything, importing nothing of ours.
- blind-svc's guarantee is topological: no route, grant, or code path to model output. Nothing that could see extraction output moves into it.
- The wire contract is Pydantic/OpenAPI in core-api (ADR-0001); `packages/contract` mirrors it as the browser's boundary parser. A divergence is a `CONTRACT GAP:` note, never a locally widened type.
- New backend code: HTTP behavior → the owning service's routers; pipeline stages → `services/worker`; anything two deployables need → the narrowest lib that already owns that responsibility. A new lib or service needs the code that justifies it in the same change.

## Enforcement

- `pnpm --filter @titlepipe/web check:imports` — the module-graph gate above; nonzero on any violation. Its rules are each pinned by a failing fixture case in `apps/web/scripts/check-imports.test.ts` (vitest `gates` project): a rule whose red was never demonstrated is decoration.
- `pnpm --filter @titlepipe/web check:rules` — per-line rules (tokens, dates, provenance); see its header for its own stated holes.
- Known debt the graph gate reports today (2026-09-08, 23 findings): no feature has an entry barrel yet, so every app→feature import is flagged `feature-internal` (18), and five import cycles exist (`features/account` panels, `features/templates`, `features/review` editor, `app/keyboard`, `app/session`). These are recorded violations awaiting their own batch — the gate is the ceiling that keeps the count from growing.

# Dependency map — refactor baseline (2026-09-08)

Measured on `integration/backend-2026-09` at `9866da7`. Declared edges come from
`package.json` / `pyproject.toml`; every edge was then verified against actual
imports (`grep` over `@titlepipe/` and `titlepipe_` imports in source). Where
declared and actual disagree, the row says so.

## 1. JavaScript workspace (pnpm: `apps/*`, `packages/*`)

```
@titlepipe/web
  ├─ deps:    @titlepipe/contract   (workspace:*)
  ├─ deps:    @titlepipe/ui-tokens  (workspace:*)
  └─ devDeps: @titlepipe/mocks      (workspace:*), msw

@titlepipe/mocks    → @titlepipe/contract, msw, zod
@titlepipe/contract → zod                      (leaf)
@titlepipe/ui-tokens → (nothing — one CSS file) (leaf)
```

- Cycles: **none**. Clean DAG; `contract` and `ui-tokens` are leaves.
- Actual imports match: 160 files under `apps/web/src` import
  `@titlepipe/contract`; no reverse edge from `packages/*` into `apps/web`
  (the greppable mentions in `packages/contract/src/index.ts:3` are prose).

### Suspect JS edges

| # | Edge | Evidence | Assessment |
|---|------|----------|------------|
| J1 | Production entry dynamically imports a devDependency | `apps/web/src/main.tsx:43` — `await import("@titlepipe/mocks/browser")`, guarded by `apiMode === "mock"` which is the **default** (`main.tsx:23`) | The default production build is the mock build. This is the single edge to cut at backend cutover. |
| J2 | Deep import past a package export map | `apps/web/e2e-live/seedRulebook.mjs:41` imports `../../../packages/mocks/src/data.ts` by relative path | Deliberate and self-documented (`seedRulebook.mjs:14-19`), but couples the live DB seed to MSW's internal file layout. |
| J3 | Filesystem reads of `packages/ui-tokens/src/tokens.css` bypassing the export | `apps/web/tokens.contrast.test.ts:31`, `apps/web/src/features/review/FieldRow.test.ts:29`, `apps/web/scripts/check-rules.mjs:432` | Three gates break silently if the file moves. |
| J4 | A TS unit test reads Python source across the language boundary | `apps/web/src/shared/mock-auth.test.ts:296-297` reads and regex-parses `services/core-api/.../api/mock_auth_guard.py` + `auth/mock.py` | Load-bearing, undeclared, invisible to every dependency tool. Renaming a Python constant fails a frontend unit test. Intentional (docblock explains it) but must be on the cutover checklist. |

## 2. Python (uv projects: `libs/*`, `services/*`, `scripts`)

Declared graph (verified against actual `src/` imports — all seven projects
match their declarations):

```
titlepipe-domain        → (nothing; dependencies = [])
titlepipe-test-support  → domain            (dev-only consumer package)
titlepipe-service-kit   → domain            (+ pydantic, pydantic-settings, structlog)
titlepipe-http-kit      → domain            (+ starlette, structlog)

titlepipe-core-api      → domain, service-kit, http-kit   (+ fastapi, sqlalchemy, psycopg, alembic, workos)
titlepipe-blind-svc     → domain, service-kit, http-kit   (+ fastapi)
titlepipe-worker        → domain, service-kit             (+ procrastinate, psycopg; NO http-kit — no web framework in the worker image)

titlepipe-scripts       → (stdlib only)
```

Reverse adjacency: `domain` ← 6 dependents; `service-kit` ← 3 services;
`http-kit` ← core-api, blind-svc; `test-support` ← all 3 services (dev group
only); no service is depended on by anything.

- Cycles: **none**. Strict three-layer DAG (domain → kits → services).
- The one apparent cycle — `libs/http-kit/tests` naming `titlepipe_core` and
  `titlepipe_blind` — is a false positive: those are string literals inside the
  AST-based boundary test (`libs/http-kit/tests/test_import_boundary.py:67-68,132,140`)
  asserting the import is *forbidden*, and neither service is installable in
  http-kit's dev group. A naive grep-based scanner will report a cycle here;
  there is not one.

### Suspect Python edges

| # | Edge | Evidence | Assessment |
|---|------|----------|------------|
| P2 | `libs/test-support` declares `titlepipe-domain` as a runtime dep but `src/` never imports it | `libs/test-support/pyproject.toml:6`; only `tests/` use domain | Over-declared. Move to dev group or use it from src. Minor. |
| P3 | `scripts/gate0/test_v14_r15.py:31-33` imports `titlepipe` (no underscore) — a package not in this tree | Resolves only inside the out-of-VCS gate-0 prototype archive | Dangling edge by design; keeps `scripts/gate0` classified DEV-ONLY/archive. |
| P4 | `scripts/tests/*` import gate modules by bare name (`import run_prototype_suite`), relying on rootdir/sys.path, not packaging | `scripts/tests/test_gate0_runner.py:12` etc. | Fragile but contained. No gate script imports application code (verified). |

## 3. Cross-language couplings

The wire contract is maintained in **two places with no generator between
them**: `packages/contract/src/*.ts` (Zod, 2,514 LOC, 51 endpoint schemas) and
`services/core-api/.../api/schemas/*.py` (Pydantic — rules, queue, pagination
only). Reconciliation is committed fixtures + parity tests, not codegen.

- Producer (Python): `services/core-api/tests/test_rules_contract_parity.py:87`
  and four sibling tests write/assert `contract-fixtures/*.json`; the
  regeneration command is embedded at `test_rules_contract_parity.py:440`.
- Consumer (TS): `apps/web/contract-parity.test.ts:46` parses
  `contract-fixtures/rules-response.json` with the real Zod schemas.
- CI: `contract-fixtures/**` is a path trigger in `backend.yml` and
  `migration-harness.yml`; `scripts/tests/test_backend_workflow.py:774-792`
  asserts a fixture change reaches at least one workflow.
- Gap: of the 4 fixtures only `rules-response.json` and the error envelope
  close the TS↔Py loop; `queue-next-empty.json` is producer-only — nothing on
  the TS side reads it (recorded in
  `services/core-api/tests/test_queue_endpoint.py:23`).

### Suspect cross-language edges

| # | Edge | Evidence | Assessment |
|---|------|----------|------------|
| X1 | Enum values hand-transcribed from `packages/contract/src/enums.ts` into Postgres DDL, pinned by line-number comments | `migrations/versions/0003_rules.py:126`, `0050_delivery.py:106`, `0070_golden_fields.py:143`, `0080_create_clients.py:33`, `db/models/rulebook.py:45`, `api/mappers/rules.py:25` | Editing `enums.ts` silently desynchronises committed enum types. No generator, no direct enum-diff test — only the rules fixture round-trip covers any of it. Highest-risk coupling in the repo. |
| X2 | TS asserts authority over Python in prose only | `packages/contract/src/endpoints.ts:197` | Nothing enforces parity for the 48 of 51 endpoint schemas core-api does not implement yet. |
| X3 | Frontend/mocks hardcode core-api's *absence* | `apps/web/src/features/review/editorHold.ts:43`, `readings.ts:9`, `readings.test.ts:19`, `packages/mocks/src/data.ts:1028` | These become stale-and-wrong the moment field/readings endpoints land. Grep these first at cutover. |
| X5 | Runtime proxy edge web → core-api exists but is exercised only by the migration harness | `apps/web/vite.config.ts:183`; `playwright.live.config.ts:337-366`; never in `frontend.yml` | Live mode is proven by 5 `e2e-live` specs against `/api/rules` only. |

## 4. Where the graph crosses a boundary it should not

Ranked:

1. **X1** — contract enums duplicated into DDL with comment-only provenance.
2. **J4** — frontend unit test parsing Python source (undeclared, executable).
3. **J1** — mock backend is the default production build until cutover.
4. **X3** — four files encoding "core-api doesn't have this yet".
5. **J2/J3** — deep imports past export maps (three gates + live seed).
6. **P2/P4** — packaging hygiene, low risk.

No cycle exists in either language graph.

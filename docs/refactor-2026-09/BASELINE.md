# RB-1 — Baseline (2026-09-08)

What is actually true about this repository, measured before anyone moves a
file. Every number below comes from a command executed on this tree today; a
skip is not a pass, and nothing was fixed on the way past.

## 0. Provenance and pre-existing state

- Branch: `integration/backend-2026-09`, HEAD `9866da7` ("libs/http-kit: one
  home for the HTTP layer both API services shared"). Countable checks passed:
  29 migration files (excluding `__init__`), four `libs/` entries including
  `http-kit`.
- The branch contains all of `origin/main` (`git log HEAD..origin/main` is
  empty) and modifies the frontend relative to main: 48 files under
  `apps/web`/`packages` (+1,946/−147), mostly the mock-auth hardening.
- Working tree state at measurement: `git status --porcelain -uall` is
  **empty** — no pre-existing modifications, no untracked files. Anything a
  later batch finds beyond commit `9866da7` (plus `docs/refactor-2026-09/`,
  this report) is that batch's own.
- Environment: Linux (WSL2), pnpm 10.33.2, uv 0.11.32, CPython 3.13.14 (uv-
  managed), Playwright chromium from the local cache. A Postgres accepts
  connections on localhost:5432 (relevant to the live harness — §1.4).

## 1. Run table

### 1.1 Frontend (JS/TS workspace)

| Command | Exit | Executed | Result |
|---|---|---|---|
| `prettier --check .` (apps/web) | **1** | 396+ files scanned | **FAIL — 185 files unformatted.** Not a regression a gate caught: prettier `--check` is enforced nowhere (not in `frontend.yml`, not in pre-commit; only `format` = `--write` exists as a script). `apps/web/.prettierrc.json` exists; the drift is unchecked by design-default, not by decision anyone recorded. |
| `eslint .` (apps/web) | 0 | full app | **0 errors, 8 warnings** — 7× `react-refresh/only-export-components` (badge.tsx, chords/routeTree/rootRoute et al.), 1× `react-hooks/incompatible-library` on `useVirtualizer` in `components/ui/table.tsx:48`. Matches the standing "8 warnings" report exactly. |
| `pnpm typecheck` (tsc -b, all projects) | 0 | web + contract + mocks | Clean. |
| `check:rules` | 0 | 396 files | Clean. |
| `vitest run` | 0 | **68 files, 431 tests** | All passed, **0 skipped**. Two `console.warn` during tests: `<Focusable> child must be focusable` (react-aria). |
| `tsc -b && vite build` | 0 | — | Success. Warning: a chunk >500 kB after minification. |
| `knip` | 0 | — | No findings. |
| `size-limit` | 0 | 2 budgets | Within budget: shell JS 280 kB / 320 kB limit (brotli), CSS 14.19 kB / 40 kB. |
| `storybook build` | 0 | 3,471 modules | Success. Warnings: `stats.html`/`iframe` chunks >500 kB. (The a11y addon gates at vitest/storybook-test time, not at build.) |
| `playwright test` (e2e, mock mode) | **1** | **160 executed** (130 declared + route-generated/retries), 0 skipped | **56 FAILED, 104 passed, 8.2m.** See §1.2. |

### 1.2 The e2e failure block — the headline of this baseline

56 of 160 executed e2e tests fail on this tree. This is not an environment
artifact of this machine alone: the `harvested invariants (e2e)` job also
**failed on `main`'s last CI run** (2026-09-03, run 33727702433), while the
static-gates job passed. The failing specs, by file:

| Spec file | Failures |
|---|---|
| `e2e/invariants/review.spec.ts` | 7 |
| `e2e/invariants/responsive-frame.spec.ts` | 7 |
| `e2e/invariants/review-refusals.spec.ts` | 6 |
| `e2e/invariants/ux.spec.ts` | 5 |
| `e2e/invariants/sidebar.spec.ts` | 5 |
| `e2e/invariants/queue-keys.spec.ts` | 3 |
| `e2e/invariants/key-map-modal.spec.ts` | 3 |
| `e2e/invariants/navigation.spec.ts` | 2 |
| `e2e/invariants/server-owns-state.spec.ts` | 2 |
| `e2e/invariants/shell-frame.spec.ts` | 2 |
| `e2e/smoke/screens-5-6.spec.ts` | 2 |
| `e2e/invariants/chord-suppression.spec.ts` | 1 |
| `e2e/invariants/escalations.spec.ts` | 1 |
| `e2e/smoke/screens-drawn.spec.ts` | 1 |

Two verified sample failures, to show these are real assertion failures and
not uniform timeouts: `chord-suppression.spec.ts:21` — the correction textarea
holds `"cqjkz30296"` where `/cqjkz$/` is expected (typed digits leak into the
value); `responsive-frame.spec.ts:27` — `/` at 1280px scrolls the document
sideways by 80px. A mix of quick assertion failures (0.5–6s) and 1.0m
timeouts. Triage is deliberately out of scope for RB-1 (read-only), but note
the repo's own rule: **a failing test may be correct behavior** — each failure
needs a rulebook/provenance check before anyone "fixes" it, and 14 files ×
several root causes means this is a batch of its own, not a warm-up task.

### 1.3 Python — seven projects, eight suites, six repo gates, pre-commit

| Project | ruff check | ruff format --check | pyright | pytest |
|---|---|---|---|---|
| libs/domain | 0 (clean) | 0 | 0 errs/0 warns | **135 passed**, 0 skipped |
| libs/http-kit | 0 | 0 | 0/0 | **16 passed** |
| libs/service-kit | 0 | 0 | 0/0 | **30 passed** |
| libs/test-support | 0 | 0 | 0/0 | **7 passed** |
| services/core-api | 0 | 0 | 0/0 | **567 passed** (78s; includes testcontainers-backed DB suites) |
| services/blind-svc | 0 | 0 | 0/0 | **51 passed** |
| services/worker | 0 | 0 | 0/0 | **120 passed** (real-Postgres queue-schema tests included) |
| scripts (tests) | — | — | — | **281 passed** |

Total: **1,207 Python tests executed, 0 failed, 0 skipped.** (The standing
"926 collected" figure equals this tree's total minus `scripts/tests`'s 281 —
a scope difference, not a discrepancy.)

| Repo gate | Exit | Result |
|---|---|---|
| `check_backend_rules.py` | 0 | Clean, **99 files** scanned (was 98 before http-kit). |
| `check_locks.py` | 0 | All 8 lockfiles current. |
| `check_no_client_data.py --tree` | 0 | Clean (silent on success by design). |
| `check_doc_links.py` | 0 | Clean. |
| `check_agents_sync.py` | 0 | Clean. |
| `audit_dependencies.py` | 0 | All 8 projects ok. (But see FX-40 in §3 — this gate exits 0 for a *misspelled* project too; reproduced by execution today.) |
| `uvx pre-commit run --all-files` | 0 | **17/17 hooks passed**, none skipped. |

### 1.4 Not run, and precisely why

- **Live migration harness** (`test:e2e:live` + `migration-harness.yml`): not
  run. It needs a Postgres with `migrations/sql/roles.sql` applied and
  `alembic upgrade head`, a core-api process, and both role-scoped env vars
  (`TITLEPIPE_APP_DATABASE_URL`, `TITLEPIPE_DATABASE_URL`). A local Postgres
  *is* listening on 5432, but it is shared machine state and seeding
  roles/schemas into it is a state change this read-only baseline refuses.
  What it would need: a dedicated database (or the compose file
  `infra/compose/compose.db.yaml`) and the exact steps already encoded in
  `.github/workflows/migration-harness.yml`.
- **`scripts/gate0` reproduction suite**: cannot run in this environment at
  all — it requires the out-of-VCS prototype archive
  (`%LOCALAPPDATA%\TitlePipe\gate0-prototype-archive`) and `pdftotext` on
  PATH, and imports a package (`titlepipe`, no underscore) that exists only
  inside that archive.
- **CI history** (checked via `gh run list`, not the tree):
  `integration/backend-2026-09` has **zero CI runs — it has never been
  pushed**. The last push to `main` (2026-09-03) failed all three workflows:
  backend (hygiene, security, scripts, and all four container jobs — note
  main still builds `extraction-svc`/`render-svc`, a service layout this
  branch no longer has) and frontend (the e2e job). CI green-ness is
  currently a memory, not a fact, on both branches.

## 2. Implemented / placeholder / generated / dev-only

Full detail (counts, per-feature LOC, file-level evidence) was measured across
the whole tree; the load-bearing rows:

| Component | Verdict | Evidence |
|---|---|---|
| `apps/web/src` (388 files, ~29.4k LOC) | **IMPLEMENTED** | 16 feature areas, all real screens with real data wiring; no skeletons. Thinnest: `signin` (196 LOC, demo accounts, **no real auth on the web side**), `jurisdiction` (262 LOC). One TODO in the whole app (`components/ui/sidebar.tsx:29`). |
| `apps/web/e2e` | **IMPLEMENTED, 0 skipped** | 19 invariant specs, 116 tests + smoke; `test.skip` count is **zero**. The prose claiming "every spec is test.skip" (`playwright.config.ts:9`, `frontend.yml:106-115` notice step) is **stale** — do not budget un-skipping work. |
| `apps/web/src/workbench` | **DEV-ONLY** | Separate entry (`workbench.html`), design-inspection harness, not in the app route tree. |
| `packages/contract` | **IMPLEMENTED** | 2,514 LOC Zod; 13 enums, 18 entities, **51 endpoint schemas**; imported by 160 web files. |
| `packages/mocks` | **DEV-ONLY — and today's de-facto backend** | 6,047 LOC, **70 MSW handlers**. `VITE_API_MODE` defaults to `mock`; the default production build boots the mock worker. |
| `packages/ui-tokens` | **IMPLEMENTED** (data-only) | One 435-line CSS file, gated by contrast test + check-rules. |
| `services/core-api` | **IMPLEMENTED platform / PLACEHOLDER product surface** | 9,972 src LOC, 29 migrations, 18 model modules, 413 tests (3.1× test:src ratio) — behind **6 HTTP endpoints (3 product: 2× rules, 1× queue)**. The database is built; the API is not. 70 MSW handlers vs 3 product routes is the real gap. |
| core-api `auth/` | **IMPLEMENTED (WorkOS) + DEV-ONLY (mock)** | Real `WorkOSAuthKitProvider` (JWKS, sealed sessions) wired via `seam.py`; mock guard is the dev path, refused in prod config. But no route requires a seat — see FX-29. |
| `services/blind-svc` | **PLACEHOLDER (shell)** | 705 LOC, endpoints: `/health`, `/ready` only. Its pyproject description reads like a feature list; none of it exists. |
| `services/worker` | **PLACEHOLDER + one real job** | 1,118 LOC scaffold; exactly one registered job (`retry_stalled_jobs` — queue self-maintenance). Stages 2–8 of the pipeline: **not started**, by its own docblock. |
| `libs/domain, http-kit, service-kit, test-support` | **IMPLEMENTED** | 856/553/744/177 LOC; 46/14/25/7 tests; boundary contracts enforced by import-boundary tests. `test-support` is dev-only by purpose. |
| `contract-fixtures/` | **GENERATED, tracked deliberately** | 4 JSON fixtures captured from FastAPI responses, re-asserted by Zod on the TS side; regeneration command embedded in `test_rules_contract_parity.py:440`. Only `rules-response.json` + error envelope close the loop both ways. |
| `scripts/` gates | **IMPLEMENTED** | Stdlib-only by contract; 281 tests. |
| `scripts/gate0` | **DEV-ONLY / archive** | Reproduction harness for the retired prototype; unrunnable without the out-of-VCS archive. |
| `infra/` | **IMPLEMENTED (dev)** | compose + 3 Dockerfiles; `observability/README.md` documents an explicitly unbuilt system. |
| `apps/web/dist`, `storybook-static`, caches | **GENERATED, untracked** | Confirmed absent from `git ls-files`. |

**The inventory hazard in one sentence:** `blind-svc` and `worker` describe
themselves as feature-complete in prose while being shells, and `core-api` is
the inverse — a full database platform behind three product endpoints; a plan
that reads descriptions instead of code is wrong in both directions.

## 3. Findings reconciliation

Checked against this tree file-by-file (six FX cards + six review docs + four
audit docs + sentinel + adversarial review).

### All six open FX cards REPRODUCE — none was silently fixed

| Card | Verdict | Key evidence |
|---|---|---|
| FX-29 (no seat scoping / IDOR-on-port) | REPRODUCES (structural, not yet exploitable) | `require_seat` has zero router callers; `principal_tenant()` is the only scoping on all 5 GETs. |
| FX-34 (which seats sign golden — blocked) | REPRODUCES | `0102:71-78` still `NAMED AS OPEN`; no later migration adds a role predicate. Needs the product ruling, not code. |
| FX-35 (0090 constrains rows, not projections) | REPRODUCES (latent) | No field mapper/endpoint exists yet; the card's own disposition ("write both WITH the field endpoint") still stands. |
| FX-37 (MAX_PAGE_SIZE unenforced, no endpoint pages) | REPRODUCES | `pagination.py:86-93` says so itself; no route takes a page/limit/cursor param. |
| FX-39 (settings seal + telemetry shim) | REPRODUCES, both halves — in progress elsewhere (worker-97) | `CoreApiSettings` still outside the sealed hierarchy; the shim's "two importers remain" comment is wrong — **six** src importers measured, only one under `api/`. |
| FX-40 (audit_dependencies silent skip) | REPRODUCES — **executed**: `audit_dependencies.py services/core-apu` → `skip … (no uv.lock)`, exit 0 | No membership check against `PROJECTS` (`:111`); CI passes it `${{ matrix.project }}`. |

### Review/audit docs — the machine-fixable majority is genuinely fixed

Confirmed FIXED on this tree (each verified at the cited mechanism, not the
prose): the fifth gate arrow (`layer-service-api`), the whole-citation row
constraint (0090 + ORM mirror), the client FK (0110), ledger supersession
(0111), golden non-deletability (0101), the users.role grant narrowing (0120),
websocket guard scope, WorkOS adapter wiring + JWKS 503 handling,
`test_auth_seam.py` now existing, blind-svc + worker under the sealed settings
base, `.env.example` Fernet fix, `task_name` redaction exception, the
queueing-lock trio (R3/R4/R6), settings-error redaction (V-15), the
client-data guard rewrite (V-9/V-10/V-11/V-12 + suffix evasions),
`handle_http_exception` environment gate in both services, the RLS census over
all schemas, the autocommit-block refusal, and `test_trigger_function_bodies`.

### What still REPRODUCES, clustered by root cause

1. **No authenticated request path** — FX-29, review-auth 2d/5b, audit-authz
   headline. One root cause, not five findings: the seam is built but nothing
   reaches it; there are no mutating or seat-scoped routes at all.
2. **Redaction value-shape blindness — all in `libs/domain/redaction.py`**:
   V-1 (`event` free-text), V-2 (list wrapper defeats numeric-suffix guard,
   `:315`), V-3 (`detail`/`checks` free-text), V-4 (DSN regex misses uppercase
   scheme + empty username, `:277`), V-5 (no bare-token/`sk_live_` pattern),
   V-6 (`File "` prefix survives the deployed reducer, `:460`).
3. **Golden-set provenance/owner ceilings**: golden-3 (a human can promote an
   engine reading — narrowed by 0102, not closed), golden-5/tenancy-4 (owner
   can drop triggers — documented ceiling), golden-6/injection-T3 (ACL-less
   GUCs, actor attribution forgeable), golden-7 (engine-id namespace checked
   by prefix only), golden-9 (`revision` unreconciled at establishment).
4. Architecture facts that are risks, not defects: A6 (services layer is
   mostly prose), A8 (schema far ahead of product) — both are restatements of
   "the API surface doesn't exist yet".
5. Document-level: adversarial-review F1/F5/F2/F4/F6/F7 concern PLAN.md's
   prose and remain as filed; F3 is fixed in code, stale in the plan.
6. blind-boundary residuals: no `REVOKE CONNECT` (documented in `roles.sql:184-202`),
   `pg_catalog` shape leak, no `CONNECTION LIMIT` — all documented, all open.

Stale/corrected findings: sentinel §4 (alembic heads — resolved, chain is
linear 0001→0120); sentinel §5's cited path doesn't exist on this tree (only
the stale `.gitignore` comment survives); review-auth 1c is structural and
intended. New small defect found during reconciliation:
`apps/web/src/shared/api.ts:65` names its guarding test
`mock-auth-parity.test.ts`, which does not exist — the assertions live in
`mock-auth.test.ts`.

Unverifiable from this tree (recorded, not glossed): coverage *depth* of the
four auth machines; owner/superuser SQL capabilities were read off code and
docstrings, not re-executed against a live catalog; network reachability of
the blind boundary.

## 4. Premises in the brief, checked against the tree

- "926 Python tests / six projects / 98 files" — all consistent once scope is
  stated: 926 excludes `scripts/tests` (281); the seventh pyright-clean
  project is http-kit (new); backend rules now scan 99 files. No stale
  premise, but the standing numbers should be restated as 1,207 / seven / 99.
- "eslint reportedly emits 8 warnings" — confirmed, exactly 8, listed in §1.1.
- "playwright e2e (note if it cannot run)" — it can run, and it is **red: 56
  failures**. That, not runnability, is the frontend's unmeasured half.
- The repo's own prose premise that the e2e invariants are all `test.skip` is
  false (0 skips, 116 active invariant tests) — flagged in §2.

The prioritised checklist ordering the real work by risk is in
[CHECKLIST.md](CHECKLIST.md); the dependency graph and every boundary-crossing
edge is in [DEPENDENCY-MAP.md](DEPENDENCY-MAP.md).

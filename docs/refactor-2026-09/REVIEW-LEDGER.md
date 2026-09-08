# Review ledger — the 2026-09 adversarial review series

One row per finding: where it was filed, which files it lives in, how severe the
filer judged it (their words, not a re-grade), where it stands, and — for a
closed row — the machine that closed it and where closure was verified.

This ledger **indexes**; it does not restate. The raw material is preserved in
two places and neither is duplicated here:

- **The source documents** — six adversarial reviews (`review-architecture`,
  `review-auth`, `review-golden`, `review-integrity`, `review-runtime`,
  `review-tenancy`), four security audits (`audit-authz`,
  `audit-blind-boundary`, `audit-exposure`, `audit-injection`), the plan review
  (`adversarial-review`), and `sentinel-patrol-02` — live in the engineering
  review archive at `hive/design/backend-2026-09/`, outside VCS (recorded in
  `docs/INDEX.md` under "Missing documents"). Each holds the full attack
  narrative, the executed evidence, and what was tried that did *not* work.
- **The reconciliation** — [BASELINE.md §3](BASELINE.md) checked every finding
  below against the tree at `9866da7` on 2026-09-08, file by file. "Verified"
  in this ledger means verified there, at the cited mechanism, not at the
  prose.

Priority ordering of the open rows is [CHECKLIST.md](CHECKLIST.md)'s job — one
home per fact; this file does not re-rank.

**Maintenance:** rows are never deleted. When a finding closes, fill in the
closure mechanism and the verification (what was run, when); "the code looks
fixed" is not a closure. A row blocked on a ruling stays OPEN-BLOCKED until the
ruling is signed.

Status vocabulary: **OPEN** (reproduces on the tree) · **OPEN-BLOCKED** (needs
a ruling, not code) · **CEILING** (real, documented, accepted as out of reach
of the current machine — e.g. table-owner powers; see
`docs/backend/TRUST-MODEL.md`) · **CLOSED** (mechanism landed, closure
verified) · **STALE** (finding no longer describes the tree).

## FX cards — all six reproduce (none silently fixed)

| Card | Finding | Files | Severity (as filed) | Status |
|---|---|---|---|---|
| FX-29 | No seat scoping on any route; `require_seat` has zero callers; `principal_tenant()` is the only scoping on all 5 GETs | `services/core-api/src/titlepipe_core/auth/`, routers | structural, not yet exploitable — becomes same-tenant IDOR at first ported read | OPEN — gates every endpoint-porting batch (CHECKLIST 3) |
| FX-34 | Which seats may establish/sign golden truth — deliberately left open by migration `0102:71-78` | `services/core-api/migrations/versions/0102*` | product decision, not code | OPEN-BLOCKED — owner ruling; do not build past OPEN |
| FX-35 | Migration `0090` constrains rows, not projections; a field endpoint could still emit a half-citation | `0090*`, future field mapper/endpoint | latent — no field endpoint exists yet | OPEN — write both with the field endpoint, per the card's own disposition |
| FX-37 | `MAX_PAGE_SIZE` is declared but unenforced; no route takes a page/limit/cursor param | `services/core-api/src/titlepipe_core/api/pagination.py:86-93` | latent, self-declared in the file | OPEN |
| FX-39 | `CoreApiSettings` outside the sealed hierarchy; telemetry shim's importer comment undercounts (six src importers, one under `api/`) | core-api settings, `telemetry/logging.py` | exposure-adjacent | OPEN — in progress on another branch; coordinate, don't duplicate |
| FX-40 | `audit_dependencies.py` exits 0 for a misspelled project — silent skip, reproduced by execution | `scripts/audit_dependencies.py:111`, CI matrix | false assurance (gate that cannot fail loudly) | OPEN — same defect class already fixed once in `check_no_client_data.py` (V-12); copy that pattern |

## Closed — mechanism landed, closure verified (BASELINE §3, 2026-09-08)

| Finding | Source | Severity (as filed) | Closure mechanism |
|---|---|---|---|
| `services/ -> api/` was ungated (the owed fifth gate rule) | CONVENTIONS §10a | false assurance | `layer-service-api` arrow in `scripts/check_backend_rules.py` |
| Half-citation constructible at the row level | review-architecture A3 | wrong and reachable | migration `0090` row constraint + ORM mirror |
| `orders.client_id` / `client_config_versions.client_id` had no FK — an order could point at another tenant's client | review-tenancy 3c 🔴 | not a read breach today, structural hazard | composite client FK, migration `0110` |
| One INSERT by `titlepipe_app` permanently bricks a golden field | review-golden #2 | wrong and exploitable, no privilege needed | ledger supersession, migration `0111` |
| DELETE + re-INSERT substitutes a golden value under the original signer's name; committed DELETE with failed re-INSERT destroys truth silently | review-golden #4, #11 | wrong and exploitable | golden non-deletability, migration `0101` |
| App role held table-wide UPDATE on `users`, including `users.role` | review-auth 4d | broken (asymmetry) | grant narrowing, migration `0120` |
| A websocket route registered outside the mock-header guard | review-auth 1b | wrong, not yet exploitable | guard scope widened |
| WorkOS adapter unwired ("behind the seam" was false); `PyJWKClientError` escaped as 500 | review-auth 2a, 2c | wrong, disarms a safety check / right diagnosis, absent machine | adapter wired via `seam.py`; JWKS failure → 503; `test_auth_seam.py` now exists |
| blind-svc carried the 32-vs-44 session-seal length bug; `.env.example` documented the wrong length and generated it | review-auth 3d, 3e | broken | blind-svc + worker under the sealed settings base; `.env.example` Fernet fix |
| The stall sweep's one diagnostic field was redacted so its guard test could not see it | review-runtime R7 | false assurance | `task_name` redaction exception |
| Idempotency description wrong at the seam; same-transaction defer unreachable; stall sweep a poison pill (one lock collision disables recovery permanently) | review-runtime R3, R4, R6 | seam others will build on / property real, handle can't reach it / poison pill | queueing-lock trio |
| A settings `ValidationError` published the raw input dict — including a DSN password — before logging exists | audit-exposure V-15 | highest-severity finding in that report | settings-error redaction |
| Client-data guard accepted county packages under four ordinary paths; end-to-end bundle committed "Passed"; bare invocation exit 0 | audit-exposure V-10, V-11, V-12 | fail-open guard | guard rewrite + suffix-evasion cases; bare invocation refuses by name |
| `handle_http_exception` published `exc.detail` verbatim in production, byte-identical in blind-svc | audit-exposure V-9, V-9b | verbatim exposure in production | environment gate in both services |
| RLS census only ever looked at `public`; autocommit path detected but not rolled back | review-tenancy 1d, 1c 🔴 | wrong-but-not-currently-reachable / operational hazard | census over all schemas; autocommit-block refusal |
| `CREATE OR REPLACE FUNCTION` guts the ledger trigger while every catalog column any test reads stays identical | review-golden #1 | wrong and exploitable + false assurance | `test_trigger_function_bodies` |

## Open — reproduces on the tree

| Finding | Source | Files | Severity (as filed) | Status |
|---|---|---|---|---|
| Redaction value-shape blindness, six findings in one file: `event` free-text (V-1), list wrapper defeats numeric-suffix guard (V-2), `detail`/`checks` free-text (V-3), DSN regex misses uppercase scheme + empty username (V-4), no bare-token/`sk_live_` rule (V-5), `File "` prefix survives the reducer (V-6) | audit-exposure V-1..V-6 | latent, not live — no current caller feeds them (V-7) | OPEN — self-contained batch, every fix has an executable red (CHECKLIST 5) |
| A human can promote an engine reading into the golden set; `0102` narrowed, did not close | review-golden #3 | wrong and exploitable; the failure the table exists to prevent | OPEN — blocked in part on FX-34 |
| Owner can drop/disable the golden and audit triggers (`SET ROLE` from the migration login) | review-golden #5, review-tenancy 2c 🔴 | wrong and exploitable (by owner) | CEILING — documented in `docs/backend/TRUST-MODEL.md` |
| Actor-attribution GUCs (`app.actor_subject`/`app.actor_seat`, `app.current_tenant`) are ordinary USERSET — attribution forgeable by any connected role | audit-injection T2/T3, review-golden #6 | headline of the injection audit; invalidates RLS-as-boundary arguments | OPEN — schedule with the first golden write path |
| Engine-id namespace checked by prefix only; live engine ids (`llmwhisperer`, …) can sign golden corrections | review-golden #7 | false assurance — constraint correct but not coverage | OPEN |
| `revision` unchecked at establishment; no reconciliation against `golden_corrections` | review-golden #9 | wrong, low impact | OPEN |
| Services layer is mostly prose (A6); schema far ahead of product (A8) | review-architecture A6, A8 | risks, not defects — restatements of "the API surface doesn't exist yet" | OPEN — subsumed by the endpoint-porting programme |
| Plan-level findings F1 (field-state terminality unenforced by two writers), F2 (closed-enum claim false for most enums), F4, F5, F6, F7 | adversarial-review | HIGH → LOW as filed | OPEN as filed against PLAN.md's prose; F3 is CLOSED in code, stale in the plan |
| Blind boundary: no `REVOKE CONNECT`, `pg_catalog` shape leak, no `CONNECTION LIMIT` | audit-blind-boundary 3.2 🔴, 3.3 🟠, 3.4 🟠 | residual real, re-measured by connecting | OPEN — documented in `migrations/sql/roles.sql:184-202` |
| `apps/web/src/shared/api.ts:65` names its guarding test `mock-auth-parity.test.ts`, which does not exist (assertions live in `mock-auth.test.ts`) | BASELINE §3 (found during reconciliation) | stale pointer to the machine | OPEN — trivial; fold into the stale-prose sweep (CHECKLIST 10) |

## Stale — no longer describes the tree

| Finding | Source | Why stale |
|---|---|---|
| Migration chain forked into four heads | sentinel-patrol-02 §4 | Resolved — chain is linear `0001 → 0120` |
| Cited data-boundary path | sentinel-patrol-02 §5 | Path doesn't exist on this tree; only the stale `.gitignore` comment survives |
| CORS preflight answered 200 before the guard | review-auth 1c | Structural and intended — filed as context, not a defect |

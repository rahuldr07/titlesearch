# Plan 02 — the first vertical slice: `GET /api/rules`

> **Read [`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) first.** It defines the
> dispatch → verify → inject → restore → review loop, what to tell each subagent,
> and when to stop. This file is *what to build and how to prove it*.

**Ships:** one read-only endpoint, served by FastAPI from Postgres, consumed by
the real browser app instead of the mock. Plus the switch that makes every later
endpoint migratable.

### ✅ ENTRY GATE CLOSED — Plan 01 is proven (2026-08-05)

**Nine assertions** (the branch grew two beyond the plan's seven), all passing as
`titlepipe_app` against an ephemeral `postgres:18.4` container, with
`pool_size=1, max_overflow=0` and `pg_backend_pid()` asserted equal across
checkouts — so tenant B genuinely reuses A's connection rather than getting a
fresh one and passing for the wrong reason.

Both injections behaved:

- **connect as the superuser → all 9 fail.** A surviving assertion would have
  been one that never depended on isolation.
- **remove the `after_begin` listener → 6 fail, 3 pass**, and the three
  survivors are exactly the pure-denial assertions. See
  [`00-HOW-TO-EXECUTE §1.1`](./00-HOW-TO-EXECUTE.md) — that result is the
  strongest evidence in this repo for why positive controls are mandatory.

Assertions 4 (savepoint) and 5 (raw Core connection) had never been executed
before that branch; Plan 01 recorded them as predictions.

---

## Why this endpoint, and not a more interesting one

Three reasons, and the third is the one that matters:

1. **It has two live consumers** — `apps/web-v2/src/features/rulebook/queries.ts:33`
   and `features/escalations/queries.ts:19`. A contract mismatch surfaces on a
   screen a person can look at, not in a fixture.
2. **It is read-only.** No state machine, no refusal rules, no audit row. Those
   arrive in Plan 05 with the domain core behind them.
3. **`Rule` carries no tenant.** See the gate below. If that ruling lands the way
   it should, this endpoint needs no principal — which is what makes it buildable
   *before* Plan 03 brings WorkOS. Choosing an order-scoped endpoint first would
   have forced auth and tenancy into the same change as the first route.

---

## 🔴 HUMAN GATES

| gate | status |
|---|---|
| Plan 01 proven | ✅ **closed 2026-08-05** — nine assertions, both injections |
| Is the rulebook global or per-tenant? | ✅ **RULED 2026-08-05: GLOBAL** |
| **Who may read a PENDING rule?** | ✅ **RULED 2026-08-06: VISIBLE TO EVERYONE.** Only an engineer may CONFIRM one. "Cannot affect the pipeline" is a statement about **effect, not visibility**, so `GET /api/rules` returns every status and nothing filters on read. Corroborated in the harvested invariants: `apps/web-v2/e2e/invariants/authz.spec.ts:84-85` asserts a **reviewer** — not an engineer — sees the `PENDING` chip while `rule-confirm-btn` has count 0, so the status is visible and only the affordance is role-locked; and `packages/mocks/src/handlers.ts:1407` serves `ruleStore` unfiltered |

> **This row read `🔴 still open` until 2026-08-06**, by which time Task 1 had
> already been built against the ruling and cited it as settled in five places
> (`0003_rules.py`, `db/models.py`, and three assertions). A stale gate row is
> worse than a missing one: the next executor reads the table, not the commits.
> Same defect class as `00-HOW-TO-EXECUTE.md` §9's own two corrections.

### The tenancy ruling — RULED GLOBAL, 2026-08-05

`packages/contract/src/entities.ts:153-163` defines `Rule` with **no `tenant_id`**,
and `jurisdiction_scope` instead. `packages/mocks/src/handlers.ts:1407` serves one
global `ruleStore` to everyone. Plan 01 built no `rules` table.

**RULED: the rulebook is GLOBAL, not tenant-scoped.** It is the shop's
own body of rules (R13–R24), engineer-confirmed, scoped by *jurisdiction* rather
than by customer. Two firms searching Clayton County are governed by the same
rule. Making it tenant-scoped would mean every tenant maintains a private copy of
the rulebook, which is neither what the contract says nor what the product means.

**Consequence, now binding:** `rules` is the first table that is
deliberately **not** a `_TenantRow`. It gets RLS-exempt treatment and the catalog
tests must be told so explicitly — otherwise Plan 01's "every table in `public`
is forced and tenant-scoped" assertions fail on it, and someone will "fix" that
by giving the rulebook a tenant column.

---

## Task 0 · The migration safety net

**Build this first. It is the reason Plan 02 exists before Plan 03.**

`docs/backend/BUILD-PLAN.md §5.2` records that the "keep the frontend tests green
while migrating endpoint-by-endpoint" loop **has no execution path**. Verified:

- `apps/web-v2/src/main.tsx:15-21` starts MSW unconditionally — no env flag
- `apps/web-v2/vite.config.ts` has no proxy
- `.github/workflows/backend.yml` watches `services/`, `libs/`, `infra/`, `scripts/`
- `.github/workflows/frontend.yml` watches `apps/`, `packages/`
- **no overlap** — no workflow runs the e2e suite on a backend change

**CONTRACT**

- `VITE_API_MODE` gates the MSW start. `mock` (default) preserves today's
  behaviour exactly; `live` starts no worker.
- A Vite dev proxy forwards `/api` to core-api when `live`.
- One CI job whose path filter spans **both** `apps/**` and `services/**`, which
  boots core-api, points the browser app at it, and runs the e2e specs that cover
  migrated endpoints.

**PROOF** With `VITE_API_MODE=live` and core-api down, the rulebook screen shows
its error state rather than mock data. With core-api up, it shows real rows.

**INJECTION** Set `VITE_API_MODE=live` and leave MSW's start ungated. The proof
must fail — the screen would show mock data while claiming to be live. *This is
the whole failure mode: a migration harness that silently serves the mock proves
every endpoint works.*

---

## Task 1 · The `rules` table

**The tenancy ruling is made — `rules` is global.**

**CONTRACT** Migration `0003_rules.py`. Columns matching
`packages/contract/src/entities.ts:153-163` exactly: `id`, `code`, `text`,
`origin`, `status`, `jurisdiction_scope` (nullable), `version`, `confirmed_by`
(nullable), `source_doc_ref` (nullable).

`origin` and `status` are Postgres **enums**, mirroring `na_reason`'s treatment
in Plan 01 — an unknown value must be a write error, not a read-time surprise.
Labels come from `enums.ts:72-82` verbatim: status `live|pending|retired`;
origin `spec|escalation|reconciliation|…` (read the file, do not retype from
memory).

**`rules` is NOT a `_TenantRow`.** It gets no `tenant_id`, no policy, and it must
be **named as an exception** wherever Plan 01 enumerates tenant tables — with the
reason in the code, not just a name on a list.

**PROOF** Plan 01's catalog tests still pass, having been told about the
exception explicitly rather than by loosening a predicate. `alembic upgrade head
→ downgrade base → upgrade head` clean.

**INJECTION** Remove `rules` from the exception list. Plan 01's forced-RLS
assertion must fail, naming `rules`. *If it does not, that assertion was already
enumerating from a hardcoded set rather than the catalog, and Plan 01's proof is
weaker than it claims.*

---

## Task 2 · Repository and read path

**CONTRACT** A `RuleRepository` reading through the seam Plan 01 built.

Because `rules` is not tenant-scoped, it does **not** extend `TenantRepository`.
Say why in the code: the base exists to make tenant scoping unforgettable, and a
global table inheriting it would either carry a meaningless tenant or quietly
filter to nothing.

**It must still go through a session from `tenant_session`** — the deny sentinel
is a connection-level default, and a repository that opens its own connection
bypasses the one place tenancy is applied. Global data does not mean an
un-scoped connection.

**PROOF** A test asserting the repository returns every seeded rule under a
session whose tenant is `None` — proving global reads genuinely do not depend on
a tenant, which is the whole claim.

**INJECTION** Make `RuleRepository` extend `TenantRepository`. The `tenant=None`
test must fail — it would filter to zero rows.

---

## Task 3 · The Pydantic response, and contract parity

**CONTRACT** `RuleResponse` / `RulesResponse` Pydantic models whose serialised
JSON is **byte-compatible** with what `packages/contract`'s Zod `RulesResponse`
parses. Field names, nullability and enum spellings all match.

This is the first endpoint where **Pydantic becomes the wire authority**
(ADR-0001's third amendment). Zod remains the browser's runtime parser — it is
not demoted, because `openapi-fetch` ships no validation.

**PROOF — the parity test is the deliverable.** A test that takes the FastAPI
response JSON and parses it with the *actual* Zod schema. Options, in order of
preference: run `packages/contract` against a captured fixture in a small Node
step in CI; or generate the TS client and typecheck it against the existing
`RulesResponse`.

**A hand-written Python assertion that "the shape looks right" is not parity** —
it is a second opinion from the same author.

**INJECTION** Rename one field in the Pydantic model (`source_doc_ref` →
`source_ref`). The parity test must fail. A test that still passes is comparing
Python to Python.

---

## Task 4 · The route

**CONTRACT** `GET /api/rules` on a router in
`src/titlepipe_core/api/routers/rules.py`, wired into `app.py` beside `health`
(`app.py:96` is currently the only `include_router`).

**`HTTPException` is banned outside `api/errors.py`** — enforced by the rules
gate and by an existing test. Failures raise a `DomainError` and go through
`status_for()` / `envelope()`.

**No auth.** Plan 03 brings WorkOS. This endpoint is readable without a principal
*because the rulebook is global* — which is the whole reason it is first. **Do
not add a placeholder principal, a mock role header, or a
`if settings.mock_auth_enabled` branch.** `handlers.ts:405` shows where that ends:
a missing header defaulting to admin.

**PROOF** `GET /api/rules` returns 200 with the seeded rules; the response
validates against the Pydantic model; a database failure returns the error
envelope with its stable `code`, not a stack trace.

**INJECTION** Raise a bare `HTTPException` in the handler. The rules gate must
fail, and the envelope test must fail. *Two independent controls on the same
rule — if only one fires, say which.*

---

## Task 5 · The frontend runs against it

**This is the task that makes Plan 02 worth doing.** Everything above is
plumbing until a real screen renders real rows.

**CONTRACT** With `VITE_API_MODE=live` and core-api serving, the rulebook screen
renders rules from Postgres. The e2e specs covering it pass **unmodified** —
`apps/web-v2/e2e` must not change in this plan.

**PROOF** Run the rulebook e2e specs against the live server. Paste the output.

**INJECTION** Stop core-api. The specs must fail. *A suite that passes with the
server down is talking to the mock, and Task 0's switch does not work.*

**If an e2e spec needs changing to pass, STOP.** That is either a contract
mismatch or a product change, and both are findings, not chores. `git diff` on
`apps/web-v2/e2e` at the end of this plan should be empty.

---

## Done

```
uv run ruff check .                          clean
uv run ruff format --check .                 clean
uv run pyright                               0 errors
uv run pytest              (core-api)        green
cd libs/domain && uv run pytest              green
python scripts/check_backend_rules.py        clean
alembic upgrade head → downgrade base → up   no error

pnpm --filter web-v2 test                    green
pnpm --filter web-v2 test:e2e                green, against LIVE core-api   🔴 SEE CORRECTION
pnpm --filter web-v2 test:e2e:live           green                          (the gate that replaced it)
git diff apps/web-v2/e2e                     EMPTY
```

Plus:
- the parity test compares against the real Zod schema, not a Python restatement;
- `rules` is named as a deliberate RLS exception, with its reason in code;
- **every injection run and observed to fail**, named in the commit message.

---

### 🔴 CORRECTION (Task 5, 2026-08-06) — the `test:e2e` gate above was never achievable

**What the gate said.** `pnpm --filter web-v2 test:e2e   green, against LIVE
core-api` — the whole browser suite, 118 tests, passing against core-api.

**Why it could not be met, and why that is a defect in this plan rather than a
reinterpretation of it.** MEASURED 2026-08-06 — the whole frozen suite pointed at
the live build, all 118 tests, nothing filtered: **44 passed, 74 failed.** The 74
depend on endpoints core-api does not serve — `/api/orders/*`,
`/api/escalations/*`, `/api/bugs`, `/api/me/permissions`,
`/api/me/preferences`, `/api/engines/routing` — and several also depend on the
`x-mock-role` header, while **core-api implements no auth at all**. Plan 03
brings WorkOS, and `api/routers/rules.py` states in its own docstring that
nothing in it anticipates that.

This plan's own scope line says the same thing two paragraphs down: *"Not in this
plan: auth, any write endpoint, any order-scoped read."* The gate and the scope
contradicted each other from the day both were written. No amount of Task 5 could
reconcile them.

Recording it here rather than quietly redefining the gate, for the reason this
plan's own paragraph about the stale 🔴 gate row gives.

**What was actually run.** `pnpm --filter web-v2 test:e2e` stays green as the
MOCK suite (118, unmodified — `git diff apps/web-v2/e2e` is empty, which is the
line above that DID hold). Against live core-api, a sixth project in
`apps/web-v2/playwright.live.config.ts` — `live-frozen-rulebook` — points that
same frozen directory at the live build and runs **7 of the 118**: the frozen
tests that navigate to `/rulebook` and depend on no unmigrated endpoint. The
selection, and the reason for each exclusion, is in that file.

**What that run proves.** The frozen specs pass **unmodified against the live
build**. That is Task 5's stated CONTRACT and it is real: a contract mismatch or
a product change would surface as a spec that could not pass without an edit.

**What it does NOT prove, measured 2026-08-06.** It says nothing about core-api,
Postgres, or the mock/live switch.

- Point `live-frozen-rulebook`'s `baseURL` at the MOCK bundle — one line, and
  exactly the "MSW left running" state Task 0 exists to catch — and **7 of 7
  still pass**.
- Stop core-api entirely and **6 of the 7 still pass**; only the `authz` test
  fails, because it is the only one that reads a rule row.
- The four `responsive-frame` tests walk `["/queue", "/orders/ord_demo_1/review",
  "/completeness", "/rulebook"]`. Three of those four are unmigrated, so under
  `live` each spends three quarters of its time asserting that error screens do
  not scroll sideways.

**Where the proof actually is.** `apps/web-v2/e2e-live/reaches-core-api.spec.ts`
is the only assertion in the harness that separates core-api from anything else
that speaks JSON. It rests on the row ids: the seed writes no `id`, so Postgres
mints UUIDs, while MSW answers `rule_r13`. Verified to fail in both directions —
against the MSW bundle (on the absent `x-request-id`) and against a stub that
stamps a request id and serves the mock's rows (on the UUID check).

**Consequence for the next plan.** "The browser suite runs against core-api"
cannot be a release gate until the endpoints behind it exist. The honest
formulation, and the one Plan 03 onward should use, is per-endpoint: as each
endpoint migrates, the frozen tests that depend on it join
`FROZEN_RULEBOOK_FILES`/`FROZEN_RULEBOOK_TESTS` (which will need renaming), and
the count in that project rises toward 118 for a reason that can be pointed at.

**Not in this plan:** auth, any write endpoint, any order-scoped read. `GET
/api/rules` is one route; the next plan brings the principal that the rest need.

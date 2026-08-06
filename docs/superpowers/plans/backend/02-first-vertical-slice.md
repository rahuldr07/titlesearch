# Plan 02 — the first vertical slice: `GET /api/rules`

> **Read [`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) first.** It defines the
> dispatch → verify → inject → restore → review loop, what to tell each subagent,
> and when to stop. This file is *what to build and how to prove it*.

**Ships:** one read-only endpoint, served by FastAPI from Postgres, consumed by
the real browser app instead of the mock. Plus the switch that makes every later
endpoint migratable.

### 🔴 DO NOT START UNTIL PLAN 01'S PROOF HAS RUN

As of writing, Plan 01's seven isolation assertions have **never been executed
against a real database** by anyone. The static gate is green; that is not the
same thing. This plan consumes `tenant_session` and `TenantRepository` directly,
so if tenancy is broken, everything built here inherits it and nothing here would
notice.

**Gate to enter:** paste the seven assertions passing, plus both injections
failing, from a real PostgreSQL 18.4. Then start.

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

| gate | why you cannot decide it |
|---|---|
| **Plan 01 proven** | see above |
| **Is the rulebook global or per-tenant?** | it decides the table, the policy, and whether this endpoint needs a principal at all |
| **Who may read a PENDING rule?** | `RuleStatus` is `live \| pending \| retired`, and a PENDING rule must not affect the pipeline. Whether it is *visible* is a separate question nobody has answered |

### The tenancy ruling, stated so it can be answered in one line

`packages/contract/src/entities.ts:153-163` defines `Rule` with **no `tenant_id`**,
and `jurisdiction_scope` instead. `packages/mocks/src/handlers.ts:1407` serves one
global `ruleStore` to everyone. Plan 01 built no `rules` table.

**Recommendation: the rulebook is GLOBAL, not tenant-scoped.** It is the shop's
own body of rules (R13–R24), engineer-confirmed, scoped by *jurisdiction* rather
than by customer. Two firms searching Clayton County are governed by the same
rule. Making it tenant-scoped would mean every tenant maintains a private copy of
the rulebook, which is neither what the contract says nor what the product means.

**Consequence if that is the ruling:** `rules` is the first table that is
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

**Depends on the tenancy ruling.** Under the recommendation:

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
pnpm --filter web-v2 test:e2e                green, against LIVE core-api
git diff apps/web-v2/e2e                     EMPTY
```

Plus:
- the parity test compares against the real Zod schema, not a Python restatement;
- `rules` is named as a deliberate RLS exception, with its reason in code;
- **every injection run and observed to fail**, named in the commit message.

**Not in this plan:** auth, any write endpoint, any order-scoped read. `GET
/api/rules` is one route; the next plan brings the principal that the rest need.

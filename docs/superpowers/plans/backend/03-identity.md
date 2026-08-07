# Plan 03 — identity: WorkOS sessions and server-evaluated authz

> **Read [`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) first**, then
> **[`02-WHAT-HAPPENED.md`](./02-WHAT-HAPPENED.md) §5**, which is the part of Plan
> 02 that transfers. This file is *what to build and how to prove it*.

**Status: DRAFT. Four human gates are open and this plan is NOT EXECUTABLE until
they are ruled.** Everything below the gates is written so the work is ready the
day they close; nothing below them has been built.

**Ships:** a real session, a real principal, and authorization the server
evaluates — retiring three holes that grant admin on a *missing* header today.

---

### ✅ ENTRY GATE — Plan 02 is executed (2026-08-06)

Six tasks on `rahuldr07/backend-plan02`, PR #7. `GET /api/rules` is served from
PostgreSQL through Plan 01's seam and rendered by the real browser app. The
migration harness ran in CI and passed: roles created, `0001→0002→0003` applied,
core-api gated on `database_answers:true`, 13 browser tests green.

**What Plan 03 inherits and must not break:** `apps/web-v2/e2e/` was frozen for
all of Plan 02 and stayed byte-identical. The `VITE_API_MODE` switch, the `/api`
proxy and `migration-harness.yml` are the machinery this plan is the first to use
under real conditions — if any of it is wrong, Plan 03 is where that surfaces.

---

## 🔴 HUMAN GATES — all four open

| gate | why it blocks |
|---|---|
| **1. WorkOS credentials and environment** | `workos` is pinned nowhere in the tree today. `BUILD-PLAN §2.4` says pin **exactly** `==10.1.0` — four breaking majors in eleven weeks. Nothing can be executed without a real client id, secret and redirect URI, and inventing them is forbidden by `00-HOW-TO-EXECUTE §5` |
| **2. Does `/api/rules` require a session?** | Plan 02 established the rulebook needs no **principal**. It did **not** establish it needs no **authentication**. Those are different claims, and this plan makes `/api` an authenticated prefix. If `GET /api/rules` must 401 without a session, Plan 02's live harness breaks and `e2e-live/reaches-core-api.spec.ts` changes with it |
| **3. Missing session → 401 or 403?** | And the same question for a *forged* one. The mock's harvested invariants assert a forged role is refused; they do not fix the status for an absent session |
| **4. Where sessions live** | `cookie_seal_password` is a validated Fernet key (44 chars, constructive check — `BUILD-PLAN §5.1`'s defect is already fixed). Whether the session is a sealed cookie alone, or a row, is unruled — and a row interacts with the deny sentinel on a pooled connection, which is Plan 01's territory |

**Do not pick a side of any of these.** A plan that stalls at a human gate is
working correctly.

---

## What this retires, and why it is the whole point

`BUILD-PLAN §4` names three holes, **each of which grants admin on a MISSING
header**:

- `packages/mocks/src/handlers.ts:405`
- `packages/mocks/src/workspace.ts:915`
- `packages/mocks/src/handlers.ts:1400`

The pattern, from `handlers.ts:1400-1404`: a present-but-unknown role is refused,
and an absent one becomes `admin`. That is defensible in a mock whose job is to
let a designer see every screen. **It is a privilege-escalation default in a
server.**

`BUILD-PLAN §4`'s warning is the one to hold onto: *"If the port copies handler
structure, that default travels."* Plan 02 already refused it once — Task 4's
brief forbade a placeholder principal, a mock role header, and a
`settings.mock_auth_enabled` branch, and review confirmed none exists. **This plan
is where the temptation is strongest,** because it is the plan that finally has a
role to default.

---

## Task 0 · The refusal, before any provider

**Build this first, and prove it before WorkOS exists.**

**CONTRACT** An authenticated `/api` prefix. No session → refused. Forged,
expired, or wrong-signature session → refused. **No default identity anywhere**,
and no branch that supplies one when a setting is set.

**PROOF — and it needs a positive control, because every assertion above is a
denial.** `02-WHAT-HAPPENED §5` records six proofs that scored full marks against
a broken system, every one of them a suite of denials. A refusal suite is
satisfied by a server that refuses *everyone*, including one where identity is
broken. So: **a validly-sealed session must reach a route and be observed to
carry the right principal**, in the same test file, against the same server.

**INJECTION** Delete the authentication dependency from one route. The denial
tests must fail **naming that route** — not merely fail. If the suite goes red
without naming it, it cannot tell which door was left open.

**Second injection, and this is the one that matters:** make a missing session
default to `admin`, exactly as `handlers.ts:405` does. **A test must fail.** If
none does, this plan has reproduced the hole it exists to retire.

---

## Task 1 · The WorkOS adapter

🔴 **Blocked on gate 1.**

**CONTRACT** `workos==10.1.0`, pinned exactly, in `services/core-api`. The adapter
is the only module that imports it. Cost and latency recorded per call, as
`CLAUDE.md` requires of every external engine.

**PROOF** A session minted by the real provider validates; one minted by a
different key does not.

**INJECTION** Point the adapter at the wrong issuer. The validation test must
fail. *If it passes, the signature is not being checked.*

---

## Task 2 · `PERMISSIONS` as server-evaluated data

**CONTRACT** The permission table is **data the server evaluates**, not a shape
the client is trusted to send. `apps/web-v2` has a client-side `canDo` table
today — Plan 02 measured that `authz.spec.ts:62` passes against a live backend
*because* `canDo` is client-side. That is a **preview affordance**, and this task
is what makes the server the authority.

**PROOF** A caller whose client-side table says yes and whose server-side row says
no is **refused by the server**. Assert the refusal, not the hidden button.

**INJECTION** Grant the permission client-side only. The refusal must still fire.
*The UI hiding a button is courtesy; the refusal is the rule.*

---

## Task 3 · `/api/me/{permissions,profile,preferences}` and `/api/people`

**CONTRACT** Four reads, through Plan 02's seam: `tenant_session` → repository →
Pydantic → the error envelope. These ARE tenant-scoped, unlike `rules` — so
`TenantRepository` is the base here, and the tenant comes from the principal.

**PROOF** Contract parity against the real Zod schemas, in the two-gate shape Plan
02 Task 3 built: a Python test asserting the committed fixture is what the models
produce today, and a **TypeScript** test parsing that fixture with the actual
schema from `@titlepipe/contract`.

**Add each new fixture to `contract-fixtures/`** — `backend.yml` and
`migration-harness.yml` both watch that path, and `scripts/tests/test_backend_workflow.py`
asserts they do.

**INJECTION** Rename one field in a Pydantic model. **Both gates must fail** —
staged, as Plan 02 measured: the Python gate first, then the TypeScript gate once
the fixture is regenerated.

---

## Task 4 · The frontend runs against it

**CONTRACT** `apps/web-v2/e2e/` stays frozen. The harness gains the migrated
endpoints, selected — not modified.

**PROOF** The frozen specs that cover these endpoints pass **unmodified**.

**INJECTION — read `02-WHAT-HAPPENED §5` item 13 before writing this.** Stopping
core-api is **not sufficient**: it proves a test needs *a* backend, not *this*
one. Plan 02 shipped a project labelled "THE DELIVERABLE" that passed **7 of 7
against MSW**. **Point the harness at the mock bundle.** Anything that still
passes is breadth, not proof — say so in the config rather than discovering it in
review.

---

## Done

```
uv run ruff check . · ruff format --check . · pyright · pytest    clean / green
cd libs/domain && uv run pytest                                  green
python scripts/check_backend_rules.py                            clean
uv run --with pytest python -m pytest -q scripts/tests           green
pnpm --filter web-v2 test                                        green
pnpm --filter web-v2 test:e2e                                    green, UNMODIFIED
pnpm --filter web-v2 test:e2e:live                               green
git diff apps/web-v2/e2e                                         EMPTY
```

**Do not copy Plan 02's `test:e2e green against LIVE core-api` line.** It was
never achievable and is corrected in that plan's Done section — measured, the
frozen suite against a partially-migrated backend is 44 passed / 74 failed. State
the gate **per endpoint**, or state the count you expect and why.

Plus:
- **every injection run and observed to fail**, named in the commit message;
- the three open-by-default holes retired, each cited by file and line;
- no placeholder principal, no mock role header, no auth settings flag.

**Not in this plan:** order reads (04), mutations (05), ingest (06).

---

## Before writing any proof in this plan

`02-WHAT-HAPPENED §5`, in one line each — all six measured on the previous plan:

1. A control that passes against an **empty table** is not a control. Assert a
   cardinality floor as a literal *before* comparing anything.
2. Comparing what a seed wrote against what a table holds proves nothing when the
   seed wrote nothing.
3. A repository test passes against a repository that **abandons its session**
   unless you assert the rows are in that session's identity map.
4. A CI gate that does not run on the diff it exists for is not a gate.
5. `return False` in a probe left **243 tests green**.
6. **"Fails with no backend" is not "fails with the wrong backend."**

And the structural one: **two of Plan 02's five injections were unrunnable as
written**, both because the plan attributed filtering to a Python layer when it
lives in the RLS policy. Check every injection is reachable *on this machine, as
this role, on this connection* before writing it into the plan.

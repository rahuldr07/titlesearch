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
| **1. WorkOS credentials and environment** | `workos` is pinned nowhere in the tree today. Nothing can be executed without a real client id, secret and a **Dashboard-registered redirect URI** — the code exchange fails otherwise — and inventing them is forbidden by `00-HOW-TO-EXECUTE §5` |
| **2. Does `/api/rules` require a session?** | Plan 02 established the rulebook needs no **principal**. It did **not** establish it needs no **authentication**. Different claims, and this plan makes `/api` an authenticated prefix. If `GET /api/rules` must 401 without a session, Plan 02's live harness breaks and `e2e-live/reaches-core-api.spec.ts` changes with it |
| **3. Missing session → 401 or 403?** | And the same for a *forged* one. The harvested invariants assert a forged role is refused; they do not fix the status for an **absent** session |
| **4. What identity-revocation latency is acceptable?** | **Narrowed by research 2026-08-07 — see below.** No longer "where do sessions live"; that is settled. What remains is a product decision about how long a revoked user may keep working |

**Do not pick a side of any of these.** A plan that stalls at a human gate is
working correctly.

### What research closed, 2026-08-07 — verified against the real `workos==10.1.1` wheel

**Gate 4 was mis-stated.** `ARCHITECTURE_REVIEW.md:189` calls sealed sessions and
"independent PyJWT/JWKS verification" *"two competing implementations"* and says
to choose one. **That is a false dichotomy.** `Session.authenticate()` **is** JWKS
verification — it Fernet-decrypts the cookie, takes `access_token`, then does
`PyJWKClient.get_signing_key_from_jwt()` + `jwt.decode(algorithms=["RS256"])`.
Sealing is not an alternative to verifying a JWT; it is JWT verification **plus
encrypted custody of the refresh token**. The genuine choice is only whether you
hold the refresh token, and three documents already converge on sealed HttpOnly
cookies (`HANDOFF.md:90`, `IMPLEMENTATION_PLAN.md:90`, `ARCHITECTURE_REVIEW §6`).

**What actually needs ruling is the revocation window.** MEASURED:
`authenticate()` makes **zero network calls to WorkOS**. A session revoked via
`revoke_session()` or logout keeps passing `authenticate()` until the access
token's `exp`. Only `refresh()` observes revocation. So the window equals the
access-token TTL, set in the WorkOS Dashboard.

Our architecture already neutralises the *authorization* half — Postgres owns
permissions, so a permission change takes effect on the next request regardless
of stale JWT claims. **The identity half is not covered:** a revoked or offboarded
user survives until token expiry. Closing it needs a `sid`-based check against our
own table on each request; nothing in the session helper does it for you.
**That trade — a per-request lookup versus a revocation window — is the owner's.**

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

**CONTRACT** `workos==10.1.1`, **pinned exactly**, in `services/core-api`. The
adapter is the **only** module that imports it — `libs/domain` must never see it
(`GATE_1_FOUNDATION.md:102`). Cost and latency recorded per call.

**Not `10.1.0`, which `BUILD-PLAN §2.4` names.** `10.1.1` (2026-08-04) is a
one-line bump of `cryptography` to `~=50.0` for **CVE-2026-69247**; pinning
`10.1.0` pins a known-vulnerable floor. Not `~=10.1` either: releases tagged
`feat(generated)!` auto-bump the major whenever the OpenAPI generator drops a
symbol, which is why the majors move so fast.

### 🔴 THE OFFICIAL WORKOS DOCS DO NOT COMPILE AGAINST v10

Both [the AuthKit Python guide](https://workos.com/docs/authkit/vanilla/python)
and WorkOS's own [FastAPI blog post](https://workos.com/blog/securing-a-fastapi-server-with-workos-authkit)
still show the v9 shape. **Copying them produces code that fails at runtime.**
VERIFIED against the installed 10.1.1 wheel:

| the docs show | v10 actually has |
|---|---|
| `authenticate_with_code(..., session={"seal_session": True, ...})` | no `session` parameter |
| `auth_response.sealed_session` | **no such field.** `AuthenticateResponse` is `user, access_token, refresh_token, organization_id, authkit_authorization_code, authentication_method, impersonator, oauth_tokens` |
| `load_sealed_session(sealed_session=…)` | `load_sealed_session(*, session_data: str, cookie_password: str)` |

Sealing is now an explicit, separate module-level call:
`workos.session.seal_session_from_auth_response(*, access_token, refresh_token, user, impersonator=None, cookie_password)`.

**Write the adapter from the installed source, not from the docs.** Do not skip
this and then debug it.

**Two more measured traps:**

- **`AsyncSession.authenticate()` is `def`, not `async def`** — verified,
  `inspect.iscoroutinefunction` is False — and its docstring claims it *"only
  performs local operations"*. **That is not true.** `Session.__init__` builds a
  `PyJWKClient` whose defaults are `cache_jwk_set=True, lifespan=300, timeout=30`,
  fetching over **blocking `urllib`**. So roughly once every 300 seconds a request
  makes a blocking call of up to 30 seconds **inside the event loop**. Run it
  through `anyio.to_thread.run_sync`, or prewarm and refresh the JWKS on a
  background task. The SDK `lru_cache`s the client per JWKS URL, so it is one
  shared client — that bounds the frequency, not the blocking.
- **`get_logout_url()` calls `authenticate()` internally and raises `ValueError`
  on an invalid session.** Logging out an already-expired session throws rather
  than returning a URL. Unwrapped, that is a 500 on logout.

Also: `jwt.decode` is called with `algorithms=["RS256"]` and
`options={"verify_aud": False}` hardcoded — **the audience is not checked.** If
audience binding matters, do it yourself.

**PROOF** A session sealed by the real provider validates; one sealed with a
different key does not. **And the positive control:** the validated session yields
a principal carrying the fields Task 2 needs — asserted, not assumed.

**INJECTION** Point the adapter at the wrong issuer. The validation test must
fail. *If it passes, the signature is not being checked.*

**Second injection:** feed `authenticate()` a cookie sealed with a different
`cookie_password`. It must fail as a **refusal**, not as an unhandled
`InvalidToken` reaching the error envelope as a 500.

---

## Task 2 · `PERMISSIONS` as server-evaluated data

**CONTRACT** The permission table is **data the server evaluates**, not a shape
the client is trusted to send. `apps/web-v2` has a client-side `canDo` table
today — Plan 02 measured that `authz.spec.ts:62` passes against a live backend
*because* `canDo` is client-side. That is a **preview affordance**, and this task
is what makes the server the authority.

**The principal is buildable with no second network call**, verified against the
wheel. `AuthenticateWithSessionCookieSuccessResponse` carries `session_id` (the
`sid` claim, the only non-optional identity field), `organization_id`, and
`user` — from which `user["id"]` is the WorkOS user id. Note `sub` is **not**
surfaced as a field; the user id reaches you through the sealed cookie payload.

**`user` is an untyped `dict[str, Any]`.** Parse it through a Pydantic model at
that boundary. An unvalidated dict crossing into the domain is exactly what this
repo's contract rules exist to catch, and it is the one untyped surface the SDK
hands you.

**IGNORE `role`, `roles`, `permissions`, `entitlements` and `feature_flags` from
the session.** They are stale JWT claims and **Postgres owns authorization**. That
is not a preference — it is what makes a permission change take effect on the next
request instead of at token expiry.

**PROOF** A caller whose client-side table says yes and whose server-side row says
no is **refused by the server**. Assert the refusal, not the hidden button.

**INJECTION** Grant the permission client-side only. The refusal must still fire.
*The UI hiding a button is courtesy; the refusal is the rule.*

**Second injection:** put the permission in the **JWT claim** and not in the
database. The refusal must still fire. *If it does not, the server is trusting the
stale claim, and the whole "Postgres owns authorization" design is decorative.*

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

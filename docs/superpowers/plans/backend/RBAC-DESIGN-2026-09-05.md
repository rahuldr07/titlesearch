# RBAC — design position and task spec

> **Written 2026-09-05.** This is a **design decision document plus a task
> spec**, not a numbered plan. RBAC is a task inside Plan 03 (identity), not a
> plan of its own — the irreversible surface is one column and one audit
> vocabulary, and everything else is data.
>
> Read `00-HOW-TO-EXECUTE.md` for process. Every measured figure below was
> produced by a command; where something is unverified it says so.

---

## 1. The position

**Authorization is data, evaluated on the server, and editable at runtime
without a deploy.**

The system must be able to grant a role a door it did not previously hold —
*a typist gaining a third door a year from now* — as an administrative action:
one row changed, one audit entry written, no code change, no release, no new
page.

Anything that makes an access change require a ticket, a deploy and a release is
a **manual activity process** dressed up as architecture, and it is the thing
this design exists to refuse.

---

## 2. The distinction that makes the position defensible

Two things get confused and must not be:

| | changes at runtime | changes by deploy |
|---|---|---|
| **who holds what** — `role_grants` | ✅ always | never |
| **the catalog of grantable things** — `permissions` | no | ✅ when a feature ships |

Shipping a *new screen* is a deploy. That is true of every system and is not
conceded reluctantly — it is stated first, so it cannot be used as a
counter-argument later. What must never be a deploy is **who holds what**.

Today a typist holds **3 of 44** permission rows (2 doors: `/blind`,
`/account`). In a year they may hold 5. That is a row in `role_grants`.

---

## 3. Data model

```
roles         key            machine identifier, immutable, persisted everywhere
              label          display string, editable forever
              is_system      true for admin — cannot be deleted or fully revoked

permissions   id
              module         "Orders"
              sub_module     "Review workstation"
              action         "field.confirm"  — resource.verb, the enforced grain
              path           for screen.*.enter rows only

role_grants   role_key
              permission_id
              level          none | view | edit
              effective_from
              effective_to   null = current
```

### 3.1 Machine keys, never display strings

`roles.key` is what is written to `users.role` and to `audit_log`. `roles.label`
is what the UI renders.

**This is the one irreversible decision in the whole design.** `audit_log`
carries two BEFORE-STATEMENT triggers at `ENABLE ALWAYS` and an ACL with no
UPDATE and no DELETE — it is append-only by construction. A string written there
cannot be rewritten, ever. Persist `qc_reviewer`; render "QC Reviewer". Reword
the label on a screen whenever you like; the ledger never moves.

**The current defect:** `PATCH /api/people/{id}/role` validates against display
strings — `"Typist (Reviewer)"`, parenthesis included (`packages/mocks/src/settings.ts:124`,
*"unknown role — the vocabulary is the RBAC matrix's columns"*). That string is
what would land in `audit_log`. It marries the audit trail to a UI label.

### 3.2 Grain: action, not module

Rows reach **action** level (`rule.confirm`), not module level ("Library").

The existing `GET /api/rbac` matrix stops at module — 10 rows. At that grain
`rule.confirm` and `template.edit` are the same cell, and the engineer gate on
rule confirmation cannot be expressed. **PENDING rules cannot affect the
pipeline until engineer-confirmed** is a hard product rule; it needs its own row.

Seed `permissions` from the 44 rows already in `packages/contract/src/authz.ts`
(19 screen doors + 25 mutation actions). `authz.ts` then becomes a **migration**,
not the runtime authority.

### 3.3 Effective-dating

`role_grants` is effective-dated, not updated in place. With policy in a file,
*"who could access this order in July"* was `git log`. With a mutable table it is
only answerable if history is kept. For a product whose deliverable is a
defensible provenance trail, that question gets asked.

---

## 4. The request path — one PDP, two consumers

**Server (the only enforcement point).** Each route declares the action it
requires. A dependency resolves `principal.role → role_grants` and refuses with
403 before validation runs.

**Client (rendering only).** `GET /api/me/permissions` returns *this role's
projection*, computed from the same table. The UI renders doors from that payload
and never re-derives one. `apps/web/src/app/session/permissions.ts` already works
exactly this way and needs almost no change — its docstring: *"The client renders
the permissions it receives and never re-derives one."*

One table, both consumers. This satisfies **INVARIANT 41** — *"One permission
table gates UI affordances and server mutations alike — they cannot drift"* —
and satisfies it better than today, where `authz.ts` is duplicated between the
browser and the mock server and *can* drift by construction.

### 4.1 Cache invalidation

Permissions are cached client-side keyed by role (`["me","permissions", role]`).
With static policy that is fine. With editable policy a grant change must
invalidate it: stamp a `policy_version` on the response and include it in the
key. Without this, an admin flips a cell and nobody sees it until reload.

---

## 5. What stays in handler code, permanently

No role × permission grid can express these. Do not try:

- **Countersign** requires a *different person* than the one who ruled it — a
  different human, not a different role (`packages/mocks/src/design.ts:1111`).
- **Escalation resolution is refused without a rule.**
- **Confirm** is idempotent on an identical value (200) and conflicts on a
  different one (409); **release and countersign file once** and refuse the
  second attempt.

`authz.ts` already draws this line and it is correct: `roles` answers "may this
role ever do this", `when` is the coarse resource-state gate, and the fine state
machine *"stays in server handler logic and is NEVER re-derived from this
table."*

---

## 6. Rejected alternatives

### 6.1 Separate pages per role, with role-based redirects — REJECTED

The proposal: build a page set per role and redirect each role to its own routes.

**It puts authorization in the routing layer.** Routing decides what renders;
authorization decides what is permitted. Only one of them can refuse. The test:
*if you deleted the frontend entirely, would the system still be secure?* With
server-evaluated policy, yes. With role-specific pages, no — every route still
answers, and the "security" was a rendering decision a URL bar defeats. The
client store says so itself: it *"gates rendering only, never permissions —
every door and action is drawn from `GET /api/me/permissions` and the server
refuses regardless."*

**It defeats the requirement in §1.** Granting a typist a new door would mean
*building a typist version of that page*. The requirement is the argument
against the design.

**It forks the flagship screen.** `screen.review.enter` is held by reviewer,
senior, ops and engineer, who arrive at the same review workstation via
context-carrying deep links (escalation clusters, complaint retros). Per-role
pages means four copies of the most complex screen in the product.

**Redirects were already considered and rejected**, `apps/web/src/app/rootRoute.tsx:27-29`:
the sign-in gate is *"structural, not a redirect… A redirect would lose the URL
the reader asked for."* Deep links are load-bearing — `?field=` lands a reviewer
on a specific field.

**It scales by multiplication:** 6 roles × N screens, versus 44 rows of data.

### 6.2 "Define all roles, responsibilities and routes before auth" — REJECTED as stated

The premise — *authentication, once implemented, cannot be undone* — is false.
This project already swapped **Clerk → WorkOS** (ADR-0001, amendment 1) at zero
cost. Auth is an adapter module plus a route dependency; it is replaceable.

The true and much smaller version: **persisted strings cannot be rewritten.**
Handled by §3.1.

The *routes* half is refuted on this branch: `authz.ts` currently has **9 of 19
screen doors pointing at routes that do not exist** — `/queue`, `/dashboard`,
`/complaints`, `/golden`, `/seed-correction`, `/bench`, `/leaderboard`,
`/blind-status`, `/reconciliation`. Nine screens were deleted in the rebuild, the
permission table did not move, and nothing broke. Routes and permissions are
already decoupled, empirically.

### 6.3 Module-grained matrix as the authority — REJECTED

See §3.2. Retained as a **projection** computed from `role_grants` — which is
what `GET /api/rbac`'s own docstring already calls it: *"a settings document
about the shop, distinct from `/api/me/permissions`"*.

---

## 7. Worked scenario — the requirement, executed

A typist needs `/escalations`, one year after go-live.

1. Admin opens Access Control, flips `screen.escalations.enter` for `typist`.
2. `role_grants` gains a row; the superseded row is closed with `effective_to`.
3. `rbac_cell_cycled` is appended to `audit_log`.
4. `policy_version` increments; cached permission payloads invalidate.
5. That typist's next `GET /api/me/permissions` includes the door. Nav renders
   it — doors are drawn from data.
6. The server permits the route — same table.

**Zero deploys. Zero code. Zero new pages.** This only works because the screen
is not role-specific.

---

## 8. Open questions — OWNER RULES, not closed here

| # | question | why it cannot be inferred |
|---|---|---|
| **R1** | Which model is authoritative — the 44-row action table or the 10-row module matrix? *(Recommend: the action table; demote the matrix to a projection.)* | `packages/contract/src/design.ts:243-244` says the two surfaces are distinct and *"neither derives from the other in the browser"* — and does not say how they relate on the server |
| **R2** | Six roles or four? *(Recommend: six. Collapsing to four lands `rule.confirm` and `routing.flip` on Admin, making Admin the bottleneck for the whole measurement loop.)* | Three vocabularies ship simultaneously: `authz.ts` 6 lowercase, `settings.ts:20` 4 title-case, and `workspace.ts:506` a fourth spelling (`"Senior examiner"`). `Person.role` is `z.string()` — the contract declines to pick |
| **R3** | Is "super admin" a role or a flag? *(Recommend: a flag — `Person.privileged` already exists, and the People screen already counts `privileged_without_mfa` as a compliance gate.)* | A seventh role differing from `admin` only in blast radius is an attribute, not a row in the table |
| **R4** | Which grants are `is_system` and unrevocable through the UI? | A fully editable matrix can lock everyone out. The current mock already marks the Admin column `locked` |

**Nothing above is decided by this document.** R2 and R3 are deferrable — with
machine keys, adding a role later is free and renaming a label is free. Only R1
and R4 block the build.

---

## 9. Tasks

### Task 1 · Machine keys — the irreversible bit, and it lands first

**SHIPS** `roles` table (key / label / is_system). `users.role` stores the key.
`PATCH /api/people/{id}/role` validates against keys, not display strings.

**INJECTION** Attempt to persist `"Typist (Reviewer)"` through the role endpoint.
A test must fail. *If it passes, the audit trail is married to a UI label and the
whole design is undone.*

**EXIT** No display string is reachable by any write path into `users.role` or
`audit_log`.

### Task 2 · The catalog, seeded from `authz.ts`

**ENTRY GATE** R1 ruled.

**SHIPS** `permissions` (44 rows seeded from `authz.ts`) and `role_grants`
(effective-dated). `authz.ts` becomes a seed/migration and stops being runtime
authority.

**INJECTION** Delete one seeded row — say `rule.confirm` — and the parity test
against `authz.ts` must fail **naming that action**. A test that only counts rows
passes when the wrong 44 are present.

**EXIT** The seeded table reproduces `authz.ts`'s 44 rows exactly, asserted
action by action.

### Task 3 · Server-side evaluation — the actual hole

**ENTRY GATE** Plan 03's principal exists.

**SHIPS** A route dependency that resolves `principal.role → role_grants` and
refuses with 403 **before validation runs** (INVARIANT 40). `GET /api/me/permissions`
computed from the table.

> **Measured gap this closes:** **all 41 GET routes are currently unguarded.**
> `screen.*.enter` appears in **zero** handler — door enforcement exists only in
> the browser today (`apps/web/src/app/session/permissions.ts`). This is the
> largest authz gap in the system and it is invisible from the UI, because the
> UI hides the doors correctly.

**INJECTION — two, and the second is the one that matters.**
(a) Delete the dependency from one route; the denial suite must fail **naming
that route**, not merely fail.
(b) Make a *missing* principal default to `admin`, exactly as
`packages/mocks/src/guard.ts:15` does today. **A test must fail.** If none does,
this task has reproduced the hole it exists to retire.

**POSITIVE CONTROL** A validly-granted role must be observed reaching a route and
carrying the right principal, in the same file, against the same server. A
refusal suite alone is satisfied by a server that refuses everybody.

**EXIT** `curl` against any `/api` route without a grant is refused by the
server, with the frontend not running.

### Task 4 · Editability, end to end

**ENTRY GATE** Tasks 1–3, R4 ruled.

**SHIPS** The Access Control surface writing `role_grants`; `policy_version`
stamped on `/api/me/permissions`; `rbac_cell_cycled` audited; `is_system` grants
refused.

**INJECTION** Revoke every admin grant through the API. It must be **refused**.
If it succeeds, the system can be locked out of itself.

**EXIT — §7 executed as a test.** Grant a typist a third door through the API;
assert the same principal is refused before and permitted after, with no restart
and no rebuild.

---

## 10. Known limits of this document

- **R1 and R4 are open.** Tasks 2 and 4 cannot start until they are ruled.
- **The frontend cleanup is unscoped here.** Any component branching on
  `role === "typist"` rather than on a grant is the same bug one level down. Not
  yet grepped; do that before Task 3.
- **`GET /api/rbac`'s level semantics (`none`/`view`/`edit`) are not reconciled
  with the action table's binary grants.** A projection must define how a
  binary grant renders as a three-valued cell. Unresolved, and it is R1's tail.
- **Nothing here is measured against a running server**, because there is no
  server-side authorization to measure. Every claim about current behaviour is
  from source.

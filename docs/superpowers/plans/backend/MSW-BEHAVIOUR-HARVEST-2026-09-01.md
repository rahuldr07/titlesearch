# MSW behaviour harvest, 2026-09-01

Fifth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. `packages/mocks/src/` is
5,453 lines and is the **de-facto specification of the server**: it is what the
frontend was built against and what 81 passing e2e invariants assert. The real
backend has to reproduce this behaviour, not merely these shapes.

Lead-harvested. The swarm's per-area nodes go deeper; this is the spine.

---

## 1. The state vocabularies the server owns

From `packages/contract/src/enums.ts`, with the header stating the rule
outright: *"The server owns every transition and threshold; the UI renders
`state` verbatim."*

- **`FieldState`** (6): `pending`, `auto_confirmed`, `needs_review`,
  `confirmed`, `corrected`, `escalated`.
- **`NaReason`** (4): `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
  `PRESENT_UNREADABLE`. Only `PRESENT_UNREADABLE` carries a page reference.
  `NOT_PRESENT` is never surfaced for review; `NOT_FOUND` and
  `PRESENT_UNREADABLE` always are.
- **`DeliveryStatus`** (6): `draft`, `signed`, `digest_recorded`,
  `transmitted`, `acknowledged`, `failed_transit`. The comment fixes the
  semantics: `failed_transit` is **retryable and never a quality state**.
- **`RuleStatus`**: `live`, `pending`, `retired`. **`RuleProvenance`**:
  `RULED`, `DERIVED`, `OPEN`, `CONFLICT` — *"OPEN means do not build past it."*
- **`JudgmentStatus`** (6) with `unknown` routing to `needs_review`, never
  assumed. That is R13 encoded as a type.

### `OrderStatus` is deliberately not an enum

`enums.ts:94-97`: *"Order status vocabulary is OPEN until the Flask models (the
source of truth) are ported. Do not invent a closed enum here."* It is
`z.string()`.

**This collides with `LEAD-MEASUREMENTS §2`.** The Flask models are the named
source of truth for the order vocabulary, and they are **not on this machine**.
So the enum cannot be closed by the route the contract specifies until the
archive is transferred or the owner rules another way. Anything that invents an
`OrderStatus` enum is violating an explicit written instruction.

What the mock actually emits meanwhile is a seven-column board
(`workspace.ts:349-362`): `unassigned`, `intake`, `machine`, `gate`, `review`,
`escalated`, `delivered` — each with a `StageKind` of `idle`/`halt`/`machine`/
`done`. Note there is deliberately **no `failed` column**: a failed order sits
in the stage it stopped in, flagged, and the overview lifts it into a banner.

### The contract also flags the NA rename at the port

`enums.ts:32`: *"Python models call `NOT_PRESENT` `NOT_USED_IN_JURISDICTION`;
reconcile at the backend port, not by renaming here."* So the NA taxonomy
conflict has **three** parties, not two: the TypeScript contract, migration
`0001`, and the Flask models — and the third is unreadable from this host.

## 2. The refusal sentences, verbatim

Each is a product requirement with an e2e test behind it. The server must
refuse in these cases; the wording matters because the UI renders the server's
sentence uncomposed.

| status | sentence |
|---|---|
| 422 | `a release is refused without its signature` |
| 422 | `a reissue is refused without its reason` |
| 422 | `a countersign is refused without a signature` |
| 409 | `this order is already released and sealed — a release files once` |
| 409 | `this ruling already carries its second read — a countersign files once` |
| 409 | `a reissue draft is already open for this order — a draft is not a released version, and only a released version can be superseded` |
| 409 | `this order has no released version to supersede` |
| 409 | `a second read must come from a different examiner than the one who ruled` |
| 409 | `only a failed transmission can be retried — this delivery is ${status}` |
| 404 | `no countersign is required on this field` |
| 404 | `no such delivery` |
| 422 | release gate: `${n} gates are open — the release gate refuses` |

Counted across the mock: **7 × 409, 4 × 422, 2 × 404, 2 × 400.**

## 3. Three server behaviours these encode

**Idempotency is "files once", not "same value returns 200".** Release,
countersign and reissue each refuse a second attempt with a *sentence*, at 409.
`design.ts:315` states it: *"A release files once; a further copy is a reissue,
not a release."* That is stricter than the prototype's approve-idempotency
(same value → 200, different → 409) recorded in `HANDOFF §2` bug 5, and the two
need reconciling in the port.

**Separation of duties is enforced against identity, and a missing identity
refuses — but only here.** `design.ts:719-724`: the countersign compares
`x-mock-actor` against `row.ruled_by`, and refuses when the actor is **null**
on the stated grounds that *"an unidentified actor cannot PROVE a second pair
of eyes, so a missing identity refuses exactly as the ruling examiner does."*

**Do not generalise that into "the mock is safer than the server". Verified
2026-09-01 and it is not, in general.** Two different headers with opposite
defaults live in this mock:

| header | meaning | default when absent |
|---|---|---|
| `x-mock-role` | authorization | **`admin`** — `guard.ts:15`, `handlers.ts:587`, `workspace.ts:974` |
| `x-mock-actor` | identity | **refused** at the countersign (`design.ts:720`); **`"L. Vance"`** in the audit log (`audit.ts:93`) |

So the mock has **the same missing-header-grants-admin hole in three places**
that Plan 03 says the server has, and the audit log will happily attribute an
unattributed action to a named person. The countersign is the **one** handler
that gets it right, and it gets it right because separation of duties is
unprovable without two identities, not because the mock has a general policy.

What transfers to the server is therefore narrower than it first looks: it is
a **worked example of the correct refusal**, not evidence of a settled
convention. Plan 03's gate 3 (401 vs 403 for an absent session) is still
genuinely open, and the *direction* is argued by `design.ts:717-718`'s
reasoning rather than by the mock's behaviour as a whole.

**Ordering: the role gate runs before validation.**
`e2e/invariants/authz.spec.ts:17` proves it through `POST /api/engines/routing`
— `reviewer` gets **403** on an invalid body, `engineer` gets **422** on the
same body. The server must evaluate authorization *before* schema validation,
or a caller learns the shape of a payload they may not send.

**Retry is narrower than it looks.** `deliveries/{id}/retry` accepts only
`failed_transit`. A `draft` is refused because retrying one *"would transmit
around the signature act"* (`design.ts:560-564`).

## 4. Role-gated reads, not just writes

`workspace.ts:391-397`: `/api/lifecycle` filters by role — a reviewer sees only
their own orders plus anything unclaimed, *"the same gate `/api/queue/next`
applies"*. The census is deliberately **not** gated, and the response carries a
scope note saying so, so the board can show "+N you cannot open" without
leaking what they are.

Two server obligations fall out: the read filter is per-role, and the count and
the list are **allowed to disagree** by design. A server that makes them agree
has broken it.

## 5. What this means for the plan

The mock is not a stub to be replaced. It is 5,453 lines of decided behaviour —
refusal wording, idempotency semantics, separation of duties, role-scoped
reads, counts that intentionally exceed their lists. The backend's acceptance
test is not "the endpoint returns 200"; it is **"the mock can be switched off
and the 81 passing invariants still pass"**.

That is the only definition of "backend done" that means anything here, and it
is worth stating as the master plan's exit criterion.

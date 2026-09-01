# Endpoint reconciliation, 2026-09-01

Companion to `LEAD-MEASUREMENTS-2026-09-01.md` §1. That file establishes the
three counts disagree; this one resolves them into the list the backend must
actually serve.

Method: MSW handler set (`packages/mocks/src/*.ts`) minus the live call sites
(`apps/web/src/shared/*Queries.ts` plus `features/` and `app/`), then each
residual classified by whether anything else still depends on it.

---

## The 18 mocked-but-never-called endpoints

Being uncalled by UI code does **not** make an endpoint dead. Three separate
reasons keep one alive, and they have to be told apart before anything is cut.

### (a) Dead surface — serves a screen deleted in `7f04340`

| endpoint | screen it served |
|---|---|
| `GET /api/bench/results` | Extraction Bench / Bench Results |
| `GET /api/golden` | Golden Set |
| `POST /api/golden/corrections` | Golden Set |
| `POST /api/golden/{id}/confirm` | Golden Set |
| `POST /api/golden/{id}/demote` | Golden Set |
| `GET /api/reconciliation/{order}` | Reconciliation |
| `POST /api/reconciliation/{order}` | Reconciliation |
| `GET /api/engines/leaderboard` | Engine Leaderboard |
| `GET /api/complaints` | Complaints |
| `POST /api/complaints` | Complaints |
| `POST /api/complaints/{id}/resolve` | Complaints |
| `GET /api/queue/bands` | Ops Dashboard |
| `GET /api/metrics` | Ops Dashboard |

Thirteen endpoints with no live caller and no surviving screen. **Do not build
these** without a ruling that the screen is coming back. Note the asymmetry
worth flagging to the owner: the Golden Set and Reconciliation screens are the
*measurement* surface for the "measured quality" product promise, and the Blind
Fifty seat that feeds reconciliation **was not deleted** — `/blind/$orderId`
still routes. So the programme still produces blind entries with nowhere to
reconcile them. That is a product question, not a build question.

### (b) Alive despite no UI caller — a harvested invariant depends on it

| endpoint | what depends on it |
|---|---|
| `POST /api/engines/routing` | `e2e/invariants/authz.spec.ts:17` — proves the role gate runs **before** validation: `reviewer` gets 403 on an invalid body, `engineer` gets 422 |
| `GET /api/derived/{signal}` | referenced by the server-owns-state invariants |
| `POST /api/bugs` | one e2e reference |

`/api/engines/routing` is the sharpest case. No screen calls it, but it is the
only endpoint through which an invariant proves the ordering of authorization
and validation — a real server property that must survive. Deleting the
endpoint would delete the proof.

### (c) Alive, simply not wired yet

| endpoint | status |
|---|---|
| `GET/PATCH /api/me/preferences` | documented at `components/ui/sidebar.tsx:30`; rail collapse is a persisted preference and `e2e/invariants/sidebar.spec.ts:88` asserts it |
| `GET /api/orders/{id}/quarantine` | intake reads quarantine through `features/ingest/`; `POST /api/intake/quarantine` **is** live (`uploadPackage.ts:67`), the GET is the not-yet-wired half |
| `GET /api/engines` | engine list, no caller yet |
| `POST /api/deliveries/{id}/retry` | sibling of `reissue`, which **is** live |

---

## What this means for sizing

Of the 70 mocked endpoints:

- **44** are called by live frontend code — these are the backend's obligation.
- **13** are dead surface for deleted screens — do not build, pending a ruling.
- **3** are proof-bearing with no UI caller — must exist for the invariants to
  mean anything.
- **4** are wired-later halves of live features.
- The remainder are duplicates of live paths under a different shape
  (`/api/orders/{id}/fields` vs `:id`), an artifact of how the two sets were
  harvested.

So the honest target is **~47 endpoints**, not 70, and not the 41 the contract
comments name. Thirteen endpoints of apparent scope evaporate on inspection,
and three that look droppable are load-bearing.

## The open question this surfaces

Nine screens were deleted from the frontend, but `packages/contract/src/authz.ts`
still declares doors for all nine, and MSW still serves their endpoints. Three
artifacts now disagree about whether those features exist. Until that is ruled,
any backend plan covering "the full endpoint surface" is planning against a
surface nobody has agreed the boundary of.

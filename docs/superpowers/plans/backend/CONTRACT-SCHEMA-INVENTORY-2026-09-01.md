# Contract schema inventory, 2026-09-01

Fourteenth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. Closes the gap
`CONFIDENCE-AUDIT §1` opened: the endpoint **paths** were inventoried, the
**schemas** were not.

---

## The count, and a correction to my own audit

**171 exported zod schemas across `packages/contract/src/`.**

| file | schemas |
|---|---:|
| `endpoints.ts` | 54 |
| `intake.ts` | 29 |
| `design.ts` | 24 |
| `design2.ts` | 22 |
| `entities.ts` | 18 |
| `enums.ts` | 13 |
| `workspace.ts` | 11 |
| `authz.ts`, `index.ts` | 0 |

`CONFIDENCE-AUDIT` said "54 schemas" — that is `endpoints.ts` alone. The
contract is **three times larger** than that. The request/response surface is
spread across four more files, and `design.ts`/`design2.ts` (46 between them)
hold the shapes for screens added during the 2026-08 rebuild.

**This is the same error twice in one session**: measuring one file and
reporting it as the whole. It is why the endpoint count needed three passes.

## Which schemas name their endpoint

**35 of 171 carry an HTTP method and path in their doc comment.** Those are
directly actionable — a plan task can cite the schema and know its route:

| endpoint | schema | file |
|---|---|---|
| `POST /api/orders` | `CreateOrderResponse` | `endpoints.ts` |
| `GET /api/orders` | `OrdersPageResponse` | `design.ts` |
| `GET /api/queue/next` | `QueueNextResponse` | `endpoints.ts` |
| `POST /api/orders/{id}/pass` | `PassOrderRequest` | `endpoints.ts` |
| `POST /api/orders/{id}/release` | `ReleaseRequest` | `design.ts` |
| `POST /api/fields/{id}/confirm` | `ConfirmFieldRequest` | `endpoints.ts` |
| `POST /api/fields/{id}/correct` | `CorrectFieldRequest` | `endpoints.ts` |
| `POST /api/fields/{id}/escalate` | `EscalateFieldRequest` | `endpoints.ts` |
| `POST /api/fields/{id}/exclude` | `ExcludeFieldRequest` | `endpoints.ts` |
| `POST /api/fields/{id}/countersign` | `CountersignRequest` | `design.ts` |
| `POST /api/escalations/{id}/resolve` | `ResolveEscalationRequest` | `endpoints.ts` |
| `POST /api/bugs` | `CreateBugRequest` | `endpoints.ts` |
| `GET /api/orders/{id}/quarantine` | `QuarantineResponse` | `design2.ts` |
| `GET /api/orders/{id}/timeline` | `OrderTimelineEvent` | `endpoints.ts` |
| `GET /api/templates` · `GET /api/templates/{id}` | `TemplateCatalogResponse` · `TemplateSaveRequest` | `design2.ts` |
| `GET /api/blind/{order}/schedule` | `CaptureScheduleResponse` | `design2.ts` |
| `POST /api/blind/{order}/entries` | `BlindEntriesRequest` | `endpoints.ts` |
| `GET /api/rail` | `RailBadgesResponse` | `design2.ts` |
| `GET /api/audit` | `AuditEntry` | `endpoints.ts` |
| `GET /api/me/permissions` | `GrantedPermissionSchema` | `endpoints.ts` |
| `GET /api/rbac` · `PATCH /api/people/{id}/role` | `RbacLevel` · `PersonRoleRequest` | `design.ts` |
| `GET /api/deliveries` | `SourcePage` | `endpoints.ts` |
| `GET /api/reissue/reasons` · `POST /api/deliveries/{id}/reissue` | `ReissueReasonsResponse` · `ReissueRequest` | `design.ts` |

**Eight of the 35 belong to dead surface** — `GET /api/bench/results`
(`BenchCell`), `GET /api/metrics` (`MetricsSourceRate`), `GET /api/queue/bands`
(`QueueBandId`), `GET /api/derived/{signal}`, `POST /api/golden/corrections`,
`POST /api/golden/{id}/confirm`, `POST /api/reconciliation/{order}`,
`POST /api/complaints/{id}/resolve`. Consistent with
`ENDPOINT-RECONCILIATION §a`, and they should not be implemented.

`POST /api/engines/routing` (`EngineRoutingRequest`) is in the list and **must**
be implemented despite having no UI caller — it is the only proof of
INVARIANT 40.

## The other 136

They are entity shapes (`Field`, `Order`, `Rule`, `Delivery`), enums, and
composite view models that ride inside the response schemas above. They do not
need a route of their own; they need to serialise identically. `entities.ts`'s
18 are the ones the server's ORM models must match member for member.

`intake.ts` at 29 is the largest single cluster after `endpoints.ts` and has no
endpoint-annotated schema at all — the intake sign-off checklist, its config
and its signature block. That is Q5's territory (`open-rulings.md:86`) and
implies server-owned data the schema gap does not yet count.

## What this means for the plan

`BACKEND-MASTER-PLAN`'s ~47-endpoint target stands; this does not change it.
What it changes is the **shape of a plan task**: "implement
`POST /api/fields/{id}/correct`" can now cite `CorrectFieldRequest` in
`endpoints.ts` rather than sending the implementer to find it.

For the 12 or so live endpoints whose schema carries no annotation, the mapping
is still by hand. That is a genuine remaining gap, smaller than it was.

## What I did not check

I did not verify that each of the 171 schemas is *reachable* from a live
frontend call, nor that the mock's responses actually satisfy them. There is a
`contract-parity.test.ts` in `apps/web` and a
`test_rules_contract_parity.py` in core-api that between them check exactly one
endpoint's parity. Extending that pattern is Plan 03+ work.

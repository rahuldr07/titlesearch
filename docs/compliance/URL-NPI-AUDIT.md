# Audit: "no NPI in URLs"

Obligation: `docs/CONTEXT.md:492`. Current state per
`docs/superpowers/plans/backend/COMPLIANCE-RESEARCH-2026-09-01.md:104` —
redaction covers logs, "URL discipline is unenforced by any gate".

A URL is the worst place for NPI because it is copied into browser history,
`Referer` headers, proxy and CDN access logs, load-balancer logs, bookmarks,
and screen-shared address bars. None of those are reached by the application's
log redactor.

## 1. Findings — what the audit found

### API contract: clean, by identifier discipline

Every path parameter in `packages/contract/src/endpoints.ts` is an opaque
server-issued id: `/api/orders/{id}/accept` (:65), `/api/fields/{id}/confirm`
(:179), `/api/fields/{id}/correct` (:188), `/api/fields/{id}/escalate` (:196),
`/api/orders/{id}/pass` (:203), `/api/escalations/{id}/resolve` (:230),
`/api/golden/{id}/confirm` (:269), `/api/blind/{order}/entries` (:282),
`/api/reconciliation/{order}` (:307), `/api/orders/{id}/timeline` (:549),
`/api/orders/{id}/pages` (:619), `/api/fields/{id}/exclude` (:674).
Mock ids are of the form `ord_seed_greene` (`packages/mocks/src/data.ts:1219`) —
opaque, not a party name. **No finding**, but note this is a convention nobody
enforces: nothing stops a future id from being `ord_JOHN_SMITH_2026`, and
nothing stops an endpoint from being added as `/api/orders/by-owner/{name}`.

`GET /api/derived/{signal}` (:477) is a fixed enum-ish signal name, not data.

### The one real exposure: `GET /api/orders?q=`

`packages/contract/src/design.ts:47` and `apps/web/src/shared/ordersQueries.ts:16-23`
put a free-text operator query into a query string. The operator searches by
what they know, and what they know is the **owner's name, the property address,
or a parcel number** — all NPI when tied to a title order. The mock's own test
uses `stage:delivered` (`apps/web/src/shared/mockHandlers.test.ts:59,68`), which
is benign, but the field is free text and the screen invites a name.

This is the highest-severity item in the audit and it is not fixable by a lint
rule alone: the value is user-typed at runtime. Mitigations, in order of
preference:

1. **Move browse search to `POST /api/orders/search`** with the query in the
   body, returning a short-lived opaque `search_token` that the URL carries for
   pagination/deep-linking. Preserves shareable links; keeps the name out of
   every intermediary's logs.
2. If the GET shape is kept, the server must strip `q` from all access logs and
   `Referrer-Policy: no-referrer` must be set (see §3), and the frontend should
   use `replace` navigation so the name does not accumulate in history.

Note the frontend's *own* browse-URL discipline is otherwise deliberate:
`apps/web/src/app/orderSearch.ts:1-22` restricts the order-scoped search string
to exactly `field` and `page`, explicitly refusing query/filter/sort keys.

### Frontend routes: clean

`apps/web/src/app/orderRoutes.tsx:26,44,78` use `/orders/$orderId[/review|/release]`;
`routeTree.tsx:39` uses `/blind/$orderId`. All other doors are static literals
(`apps/web/src/app/chrome/doors.ts:17-32`). `field` in the workstation search
(`orderRoutes.tsx:61,69`) is a **schema path** such as `vesting.grantee`
(`DecisionCard.stories.tsx:15`) — a field name, not a field value. Correct.

`apps/web/src/shared/crashRedaction.ts:28-34` already templates the pathname
before a crash report leaves the browser, masking id-shaped segments. That is
the right instinct and is the model for the server-side gate.

### Object storage keys: specified, unverified

`docs/backend/IMPLEMENTATION_PLAN.md:740` requires opaque storage keys and
original filenames only as protected metadata, and the presigned-PUT flow
(:744-751) keeps file bytes off the API. The risk this leaves:

- A **presigned URL is itself a bearer credential** and is frequently pasted
  into logs/tickets. It must be short-TTL (already :745) and must never be
  written to an application log or a crash report.
- The **county package's original filename** (often `Smith_John_Deed.pdf`) must
  not become the key, nor a `response-content-disposition` query parameter on a
  download URL — that is the most likely accidental reintroduction.
- No code implements this yet, so the audit finding is "unimplemented, and the
  gate should exist before the implementation does".

## 2. Proposed gate

`scripts/check-url-npi.mjs`, run in CI next to `apps/web/scripts/check-rules.mjs`,
with the same `rules-allow:`-style escape hatch requiring a written reason.

Static rules (source-scanning, in the spirit of the existing line scanner):

1. **Literal-path NPI vocabulary.** Any route/path literal in
   `packages/contract/src/endpoints.ts`, `apps/web/src/**`, and the service
   routers containing a segment matching `name|owner|ssn|dob|birth|address|
   grantor|grantee|borrower|email|phone|parcel|account` fails.
2. **Interpolated path values must be ids.** A template literal path segment
   `${x}` must interpolate an identifier whose name ends in `Id`/`_id`/`Ref`, or
   be a declared enum. `${ownerName}` fails.
3. **Query-key allowlist.** Query keys constructed anywhere in `apps/web/src`
   must be drawn from an explicit allowlist (`page`, `filter`, `field`, `tab`,
   `q`, `cursor`, `search_token`). A new key requires editing the allowlist,
   which puts it in front of a reviewer. `q` is listed with a comment pointing
   at §1's open finding so it cannot be quietly forgotten.
4. **No `response-content-disposition` / `filename` in generated storage URLs.**
5. **Storage-key construction may not concatenate a user-supplied name.** Keys
   must come from a single `objectKey()` helper that takes ids and a random
   suffix; direct key string-building outside it fails.

Runtime/behavioural rules (Playwright, since refusals are product requirements
per `AGENTS.md`):

6. **Crawl every reachable route and assert the URL templates to a known set.**
   After exercising the app against mocks, `location.href` must match one of the
   declared route templates with id segments replaced — the browser-side proof
   that no screen ever writes data into the address bar.
7. **Assert `Referrer-Policy: no-referrer`** (or `same-origin`) on responses, so
   a URL that does slip cannot leak cross-origin.

Server-side control (not a lint rule, but the completing half):

8. **Access-log URL templating**, mirroring `crashRedaction.templatedRoute`: the
   request logger records the matched route template and the query *keys*, never
   path ids' values and never query values. Without this, rules 1-7 protect the
   codebase while the reverse proxy keeps a plaintext record.

## 3. Severity ordering

1. `GET /api/orders?q=` free-text search (real, live, unmitigated).
2. Access-log/`Referer` capture of any URL (no control exists).
3. Storage-key / presigned-URL discipline (specified but unimplemented).
4. Path segments (currently clean; the gate is regression insurance).

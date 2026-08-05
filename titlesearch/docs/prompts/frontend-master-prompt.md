# TitlePipe frontend re-platform — MASTER BUILD PROMPT

> Paste this whole document into the Claude project that holds the 15 `.dc.html`
> screens + `api.js`. It carries everything that session cannot see: product
> laws, the exact stack, existing repo conventions, and per-screen specs.

---

You are a senior frontend engineer re-platforming 15 already-designed screens
(`.dc.html` components in this project, with `api.js`/`support.js`) into a
production React app. The `.dc.html` files are the **pixel and behavior spec —
re-platform, not redesign.** Where this document and a `.dc.html` file
conflict on *rules*, this document wins; on *pixels*, the `.dc.html` wins.

TitlePipe context in two sentences: machine extraction + human review of
uncertain fields for title-search reports; the server decides everything, the
screens render it. Zero shipped defects is achieved by routing uncertainty to
humans — the UI's job is to make that routing effortless and impossible to
game.

## 0. Non-negotiable product laws — violating any means the output is rejected

1. **Frontend only.** Never generate backend logic, endpoints, or business
   rules from the designs. The backend is upstream of the UI and its rules are
   not visible in any screen.
2. **The server owns all state.** The UI must NOT: compute a field's `state`
   from `engine_confidence_raw` or any threshold; derive `needs_review` from
   `value === null`; re-derive counts, chain termination, or release
   resolution; reorder the queue. Render what the API returns, verbatim.
3. **`Not Available` is TWO states** and they route oppositely:
   `na_reason: "NOT_PRESENT"` (structurally absent — correct, renders quiet,
   never prompts action) vs `"PRESENT_UNREADABLE"` (exists but unreadable —
   always surfaced for attention). A null value with null `na_reason` is
   "not yet extracted" — a third, distinct render. Never collapse these.
4. **Forbidden everywhere, no exceptions:** per-reviewer throughput counters,
   rankings, or pace indicators of any kind; probe visibility (probes must not
   exist in any component, type, or mock); an aggregate/headline accuracy
   number; approve-all buttons; queue browsing or order cherry-picking; timers
   on golden-set capture; auto-tuning controls; pre-selected/pre-checked
   general-rule suggestions.
5. **Refusals are product requirements** (each becomes a Playwright test):
   - correction submit disabled without a non-empty `reason`
   - escalation submit disabled without a non-empty `question`
   - escalation *resolve* disabled without a rule (cite existing OR draft new → lands PENDING)
   - golden correction disabled without `source_citation` + `reason` + `signed_by`
   - reconciliation ruling disabled without `citation`
6. **Blind Fifty typist screen is structurally blind:** seat labels are only
   "A"/"B" — never a name; no model output, no other-seat data, no pipeline
   state appears anywhere on it; every field entry is the three-part contract
   (value OR na_reason, `source_citation` required, confidence
   certain|probable|unclear); judgment TYPE is a server-enforced second pass —
   the UI reflects the gate, never bypasses it.
7. **Role gating:** reviewers never see the dashboard, metrics, or any
   throughput-adjacent data; typists see only the capture screen.
8. **Provenance is the product.** Wherever a value renders, its source
   (page, snippet, coordinates) renders with it or is one interaction away.
   A confirmed/auto-confirmed value that arrives without provenance renders
   visibly flagged — never silently normal.
9. **Dark register only:** dark, CI-output quiet, the scanned document is the
   dominant visual; amber = attend, hot red = actionable, dimmed = recede;
   no gamification, no celebration states, no light theme.

## 1. Stack — exact, already installed; do not add, swap, or downgrade

| Package | Major (installed) |
|---|---|
| react / react-dom | 19.2 |
| vite (+ @vitejs/plugin-react) | 8.1 |
| typescript | ≥6, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| tailwindcss + @tailwindcss/vite | 4.3 |
| zod | 4.4 |
| @tanstack/react-query | 5.x |
| @tanstack/react-router | 1.x (code-based routes, no codegen) |
| @tanstack/react-table | 8.x (headless) |
| @tanstack/react-virtual | 3.x |
| react-hook-form + @hookform/resolvers (zodResolver) | 7.x / 5.x |
| zustand (keyboard mode + panel state ONLY) | 5.x |
| react-hotkeys-hook | 5.x |
| react-pdf (pdfjs-dist 6) | 10.x |
| msw | 2.x |
| vitest / @playwright/test | 4.x / 1.61 |
| shadcn (CLI, components copied into repo, re-themed to tokens) | 4.x |

Do NOT introduce: axios, redux, mobx, react-router-dom, next.js, styled-components,
emotion, MUI/Chakra/Ant/Mantine, moment/dayjs (use `Intl`/`Date`), lodash,
tRPC, GraphQL, or any state library beyond TanStack Query + the tiny zustand
store. No `any`; no `@ts-ignore`; no default exports for screens/components.

## 2. Repo you are writing into — extend, never recreate

```
apps/web/            React app (exists: router, api wrapper, tokens, 2 screens)
packages/contract/   Zod schemas = THE source of truth for the REST contract
packages/mocks/      MSW handlers + demo data (the backend until FastAPI lands)
packages/ui/         (to create when first shared primitive appears) tokens + primitives
```

**`@titlepipe/contract`** (import from it, never redefine): enums
`FieldState` (pending|auto_confirmed|needs_review|confirmed|corrected|escalated),
`NaReason` (NOT_PRESENT|PRESENT_UNREADABLE), `BlindConfidence`
(certain|probable|unclear), `TypistSeat` (A|B), `RuleStatus`, `RuleOrigin`,
`GoldenTag`, `EngineKind`, `HowItGotThrough`, `JudgmentStatus`; entities
`Order`, `Field` (full provenance envelope + `readings: FieldReading[]`),
`Rule`, `Escalation`, `Bug`, `GoldenField`, `Reconciliation`, `Report`,
`Delivery`, `Complaint`, `Engine`, `EngineRoutingCell`, `LeaderboardCell`,
`BlindEntryInput`; request/response schemas `QueueNextResponse`,
`OrderFieldsResponse`, `ConfirmFieldRequest`, `CorrectFieldRequest`,
`EscalateFieldRequest`, `CreateBugRequest`, `ResolveEscalationRequest`,
`GoldenCorrectionRequest`, `BlindEntriesRequest/Response`,
`ReconciliationResponse`, `ReconciliationRulingRequest`,
`LeaderboardResponse`, `EngineRoutingRequest`, `MetricsResponse`,
`CreateComplaintRequest`, plus list wrappers.

**If a design needs an endpoint or field the contract lacks: STOP for that
piece and emit a `CONTRACT GAP:` note describing exactly what is needed.
Never invent an endpoint, never widen a response type locally.**

**Data fetching convention** (exists at `apps/web/src/api.ts`) — every
response parses through its contract schema at the boundary:

```ts
export async function api<S extends z.ZodType>(
  schema: S, path: string, init?: RequestInit,
): Promise<z.output<S>> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return schema.parse(await res.json());
}
```

Query keys: `["queue","next"]`, `["orders", orderId, "fields"]`,
`["escalations"]`, `["reconciliation", orderId]`, etc. Mutations invalidate
their reads. Forms: react-hook-form + `zodResolver(<ContractRequestSchema>)` —
the refusal rules in §0.5 come from the contract schemas, not hand-rolled
validation.

**Routing** (exists at `apps/web/src/router.tsx`): code-based TanStack Router —
`createRootRoute` → `createRoute({ getParentRoute, path, component })` →
`createRouter({ routeTree })` with the `Register` interface declared. Add
routes there. Existing: `/queue`, `/review/$orderId`.

**Tokens** (exist in `apps/web/src/index.css`, Tailwind v4 `@theme`): names are
stable, values are placeholders — replace values with the exact colors from
the `.dc.html` spec, keep the names:
`--color-bg, --color-surface, --color-line, --color-ink, --color-ink-dim,
--color-attend (amber), --color-act (hot red), --color-ok, --font-mono`.
Add token NAMES (not raw hex in components) for anything else the spec needs.
Every color in every component comes from a token. No raw hex in TSX.

**Mocks** (`packages/mocks/src/`): for each screen, add MSW handlers +
demo data migrated from this project's `api.js`. Handlers must
`safeParse` request bodies against the contract request schemas and return
422 on failure — the refusals hold even against mocks. Scrub demo data of
anything resembling real NPI (real names/addresses/SSNs/DOBs): use clearly
synthetic values, keep the *shapes* and *weird states* (both NA states,
A/B disagreements, degraded-scan cases, judgment-status variety).

## 3. Shared components to build ONCE

- **`PdfPane` + `CoordOverlay`** — used by Review, Extraction Bench,
  Reconciliation, Seed Correction. react-pdf page render; worker wired
  Vite-style: `pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()`.
  Overlay is an absolutely-positioned layer scaled to the rendered page;
  accepts an opaque `line_coords` payload (final shape lands with the
  LLMWhisperer adapter — code against a minimal `{page, x0, y0, x1, y1}[]`
  normalized-coords placeholder and isolate the mapping in ONE function).
  Clicking a field's source citation scrolls/highlights the region;
  clicking a highlight selects the field. Handles: no-coords engines
  (declared-not-faked → no overlay, snippet-only), page navigation, zoom.
- **Keyboard layer** — one-key-per-action is a product requirement. Take the
  actual bindings from the `.dc.html` spec; where the spec is silent, propose
  a binding and flag it `KEYMAP PROPOSAL:`. Global hint strip shows active
  keys. react-hotkeys-hook; scope-aware (form inputs suspend single-key
  actions); the zustand store holds keyboard mode + open-panel state, nothing
  else.
- **Field primitives** — `FieldValue` (renders value/NA states per §0.3),
  `ProvenanceLine` (page · snippet · click-to-source), `StatePill`
  (verbatim state, amber for needs_review), `ReadingCard` (engine id, value,
  snippet, cost/latency dimmed).

## 4. Screen inventory — build in this order, ONE screen per response

For every screen: match its `.dc.html`; use only contract endpoints; ship its
MSW handlers + demo data; ship its Playwright refusal/invariant tests; list
`CONTRACT GAP`s and `KEYMAP PROPOSAL`s at the end.

1. **Queue** *(skeleton exists — bring to pixel spec)* — single next-order
   card via `GET /api/queue/next`. No list, no counts, no pace.
2. **Review — THE FLAGSHIP** — field-by-field: dual-value A/B comparison from
   `readings`, `PdfPane` click-to-source, actions confirm
   (`POST /api/fields/{id}/confirm`, idempotent — safe to re-send), correct
   (value + reason), escalate (question), file bug
   (`POST /api/bugs` — broken *inputs*, distinct from corrections), pass order
   (`POST /api/orders/{id}/pass` — server auto-escalates on 4th pass; UI just
   calls and moves on). Keyboard-first field navigation. AB-disagreement and
   PRESENT_UNREADABLE fields lead the visual hierarchy.
3. **Ingest** — order create + package upload; rejection renders the server's
   named missing fields verbatim; duplicate (sha256) notice; **explicit**
   accept (`POST /api/orders/{id}/accept`) — never auto.
4. **Escalation Inbox** — clustered by field-path
   (`GET /api/escalations`); resolve flow REQUIRES a rule: cite existing or
   draft (renders as PENDING, visually inert). Refusal test mandatory.
5. **Ops Dashboard** — `GET /api/metrics`: catch_rate is the headline; paired
   signals; field backlog. No aggregate accuracy. Role-gated: reviewers never
   route here.
6. **Derived drill-down** — `GET /api/derived/{signal}`.
7. **Delivery** — `GET /api/deliveries`, retry action; timestamps + elapsed
   breakdown; v1+v2 both listed (defect record); failed delivery styled as
   *transit* state (attend), never as a quality failure (act).
8. **Complaints** — per-field capture (`POST /api/complaints`); list grouped
   by `how_it_got_through` — `auto_confirmed` group visually distinct (it
   means no human saw it).
9. **Golden Set capture** + **Seed Correction** — corrections require
   source + reason + signature (contract-enforced); permanent-log framing;
   NO timers anywhere.
10. **Extraction Bench** — scan/prompt/diff/rules panes; cross-package grid
    (column = jurisdiction problem, row = prompt problem); cost per run
    visible; no auto-tune affordance.
11. **Bench Results** — section × tag matrix (`GET /api/bench/results`);
    ruled-fail hot red; suspect amber; judgment cells annotated thin.
12. **Blind Fifty typist** — §0.6 rules absolute. Three-part entry per field
    (`POST /api/blind/{order}/entries`); response is `{accepted, entry_ids}`
    only — render nothing beyond local confirmation.
13. **Reconciliation** — symmetric A/B layout (`GET /api/reconciliation/{order}`);
    ruling requires citation; general rule may be *offered* by the senior,
    never pre-selected; ruling submits per-path.
14. **Blind Fifty Status** — coverage progress incl. judgment-field count vs
    the ≥40 target; no typist speed/pace data exists or renders.
15. **Engine Leaderboard** — *no `.dc.html` exists; build from spec:* engine ×
    section × jurisdiction matrix (`GET /api/engines/leaderboard`); per-cell
    accuracy by tag class + cost/1K pages + p95 latency; cells below golden
    coverage render literally `NO TRUTH YET`; seat-change flow
    (`POST /api/engines/routing`) demands an evidence URL and shows
    who/when after; NO aggregate headline, NO auto-promotion affordance.
16. **Account layer** (Login/Me/MyOrg/People/Rulebook/Audit/Retention/Billing)
    — last; auth is mocked locally (no Clerk wiring yet); Rulebook shows
    rules with origin/status/jurisdiction badges, PENDING visibly inert;
    Audit is a read-only append-only view.

## 5. Output format — per screen, in one response

1. Full file contents with repo-rooted paths (`apps/web/src/screens/…`,
   `packages/mocks/src/…`, `apps/web/e2e/…`). Complete files, no elisions.
2. New/updated MSW handlers + demo data.
3. Playwright test file covering that screen's refusals + forbidden-pattern
   invariants (e.g., Review: correct-without-reason stays disabled; Blind
   typist: page source contains no engine/model strings).
4. `CONTRACT GAP:` list (or "none").
5. `KEYMAP PROPOSAL:` list (or "none").
6. Ambiguity notes: anything the `.dc.html` left unclear + the assumption made.

## 6. Definition of done — every screen

- Typechecks under the workspace strict config; no new deps.
- Renders fully from MSW alone — zero real network.
- Both NA states + pending render distinctly (where fields appear).
- All §0.5 refusals enforced via contract schemas AND covered by a test.
- Grep-clean: no `throughput`, `probe`, `accuracy` (as a headline metric),
  `rank`, `timer`, `leaderboard` outside screen 15, no raw hex colors,
  no `any`.
- Every color/font from tokens; document-dominant layout preserved from spec.

# Document index

Every tracked document, classified. Three statuses only:

- **AUTHORITATIVE** — current source of truth for its area. When two authoritative
  documents conflict, the precedence is `HANDOFF.md` → `CONTEXT.md` §11 → `PRD.md`
  → `backend/BUILD-PLAN.md`.
- **RECORD** — immutable history: executed plans, dated audits, session handoffs,
  verbatim-as-issued prompts. Never edited, never deleted; cited by SHA and path.
- **SUPERSEDED by <path>** — kept for the citation trail; the successor wins everywhere.

Maintained by hand. When a document lands or changes class, update this file in the
same commit.

## Root

| Document | Status | Purpose |
|---|---|---|
| `README.md` | AUTHORITATIVE | Entry point: what TitlePipe is, layout, commands |
| `CLAUDE.md` / `AGENTS.md` | AUTHORITATIVE | Repo guide + hard rules (byte-identical twins; a pre-commit hook enforces the identity) |
| `.zcode/AGENTS.md` | AUTHORITATIVE | ZCode-scoped pointer to the guides above + backend command reference |

## docs/ — project authority

| Document | Status | Purpose |
|---|---|---|
| `HANDOFF.md` | AUTHORITATIVE | Full project memory, last revised 2026-08-06. Wins conflicts |
| `CONTEXT.md` | AUTHORITATIVE | Domain facts and history; §11 (domain traps) is mandatory reading |
| `PRD.md` | AUTHORITATIVE | Build document v2.1: data model, API contract, release gates |
| `INDEX.md` | AUTHORITATIVE | This file |
| `ORGANIZATION-PLAN.md` | RECORD | The 2026-08-08 reorganization: findings, plan, execution state |
| `adr/0001-core-api-fastapi.md` | AUTHORITATIVE | core-api = FastAPI. Signed 2026-08-05 with three binding amendments (WorkOS, Procrastinate, Pydantic-wire/Zod-boundary) |

### Missing documents — cited, not in VCS

| Document | Cited by | State |
|---|---|---|
| `docs/rulings_2026-07.md` | HANDOFF §3/§9, CONTEXT §9/§23, PRD §10, both Gate 0 docs | **Missing — owner to supply.** Full text of R13–R24 + implementation impact. Note: `rulebook-source/Implementation_Rulebook_v1.docx` is a *different* document (the Vendor 66805 typing rulebook, its own rule numbering) and does not contain it |
| `docs/spec.md` | CONTEXT §23, HANDOFF §9, Gate 0/1 prompt | **Missing — owner to supply.** The 18-section extraction spec with provenance tags; not reconstructable from anything tracked |
| `docs/frontend/PLAN.md` | BRIEF §5 Phase 0 | Never existed; the harvest substituted `prompts/frontend-master-prompt.md` (BRIEF-DELTAS D-7) |

## docs/backend/

| Document | Status | Purpose |
|---|---|---|
| `BUILD-PLAN.md` | AUTHORITATIVE | Canonical backend build plan since 2026-08-04 |
| `RUNNING-LOCALLY.md` | AUTHORITATIVE | Runbook: the dev database, the two-DSN role split, and running core-api locally. `migration-harness.yml` is the authority it defers to |
| `PLAN.md` | SUPERSEDED by `BUILD-PLAN.md` | The reconciled mid-2026 plan (own banner says so) |
| `IMPLEMENTATION_PLAN.md` | SUPERSEDED by `BUILD-PLAN.md` | Earlier implementation plan (own banner) |
| `TOOLCHAIN.md` | SUPERSEDED by `BUILD-PLAN.md` | Toolchain manifest (own banner) |
| `ARCHITECTURE_REVIEW.md` | SUPERSEDED by `BUILD-PLAN.md` | Architecture review (own banner) |
| `REPORT.md` | RECORD | Stack-selection study, 32 candidates, mid-2026 |
| `GATE_0_RECOVERY.md` | RECORD | Gate 0 closure: prototype recovered, 177/177, verdict PORT |
| `GATE_0_ARCHIVE_MANIFEST.md` | RECORD | Hash manifest of the recovered archive |
| `GATE_1_FOUNDATION.md` | RECORD | Gate 1: Python foundation, 2026-07-22 |

## docs/superpowers/ — execution records

| Document | Status | Purpose |
|---|---|---|
| `plans/backend/00-HOW-TO-EXECUTE.md` | AUTHORITATIVE | How backend plans are written and run |
| `plans/backend/01-postgres-correctness.md` | RECORD | Plan 01 as issued (executed, merged) |
| `plans/backend/01-WHAT-HAPPENED.md` | RECORD | Plan 01 handover — required reading before Plan 02+ work |
| `plans/backend/02-first-vertical-slice.md` | RECORD | Plan 02 as issued (executed, merged via PR #7) |
| `plans/backend/02-WHAT-HAPPENED.md` | RECORD | Plan 02 handover — §5 is the transferable part; read before Plan 03 work |
| `plans/backend/03-identity.md` | AUTHORITATIVE | Plan 03 DRAFT — four human gates open; not executable until ruled |
| `plans/2026-07-28-titlepipe-revised-design.md` + six `2026-07-30-design-fidelity-*` + `2026-07-30-consistency-audit.md` | RECORD | The design-fidelity wave plans, as executed |
| `specs/2026-07-30-design-fidelity-design.md` | RECORD | The wave spec |
| `specs/2026-08-27-frontend-dependency-set-design.md` | AUTHORITATIVE | The rebuild's dependency set — kit, observability, manifest, execution steps (owner-approved 2026-08-27) |

## docs/frontend/

| Document | Status | Purpose |
|---|---|---|
| `HANDOFF-2026-08-01.md` | AUTHORITATIVE | Current frontend state (reskin, rail rebuild, gate numbers) |
| `HANDOFF-UI.md` | RECORD | Frontend state as of 2026-07-29, before the reskin |
| `conflicts.md` | AUTHORITATIVE | Living ledger: design behaviors refused, deliberate departures |
| `decisions.md` | AUTHORITATIVE | Living ledger: delegated decisions incl. owner rulings (D1–D3) |
| `open-rulings.md` | AUTHORITATIVE | Living ledger: RULE elements awaiting an owner/backend ruling |
| `directions/{a,b,c,hybrid}.html` | AUTHORITATIVE | The four direction mockups; **`hybrid.html` is the approved visual reference** |
| `test-harvest.md` | RECORD | Pass 0: all 138 pre-rebuild tests classified |
| `design-classification.md` | RECORD | Pass 2: every export element → RENDER/RULE/CONFLICT |
| `component-inventory.md` | RECORD | Pass 2: pattern → component mapping |
| `tokens.md` | RECORD | Phase 1 token audit against the export |
| `state-coverage.md` | RECORD | States the design never drew, both directions |
| `replatform-mapping.md` | RECORD | Owner decision: the 12 measurement screens re-platform |
| `design-fidelity.md` | RECORD | 2026-07-28 fidelity audit |
| `fidelity-audit-2026-07-30.md` | RECORD | 2026-07-30 audit: 221 divergences |
| `phase2-audit.md` | RECORD | Audit of the Phase 2 deliverables |

## docs/prompts/ — verbatim as issued

All RECORD. `frontend-master-prompt.md` (the re-platform build prompt) ·
`claude-gate-0-1-execution-prompt.md` · `claude-gate-2-execution-prompt.md` ·
`claude-gate-3-execution-prompt.md`.

## docs/rulebook-source/ — vendor source material (binaries)

Source documents for the Vendor 66805 abstractor-typing skill, each admitted by
hash in `scripts/check_no_client_data.py`: `Implementation_Rulebook_v1.docx` (the
typing rulebook — **not** TitlePipe's R1–R24) · `2_Golden_Rules.docx` ·
`3_Typed_Report_Template.docx` · `abstractor-report-typing.skill`.

## docs/archive/

RECORD. The pre-rebuild design zip and three UI crops, each admitted by hash.

## Elsewhere in the tree

| Document | Status | Purpose |
|---|---|---|
| `apps/web-v2/BRIEF.md` | RECORD | The rebuild master prompt, kept verbatim as issued |
| `apps/web-v2/BRIEF-DELTAS.md` | AUTHORITATIVE | Living ledger: where BRIEF's premises differ from the repo (D-1…D-10) |
| `apps/web-v2/e2e/invariants/README.md` | AUTHORITATIVE | The harvested-invariant contract: 111 skipped specs, what a green run means |
| `infra/observability/README.md` | AUTHORITATIVE | Telemetry redaction contract, written before any collector exists |
| ~~`design-export/README.md`~~ | DELETED 2026-08-26 | The extracted design package. Superseded — the rebuild re-decides the visual language rather than implementing that export. Recorded as `apps/web-v2/BRIEF-DELTAS.md` D-11; reachable at `a516d30` |

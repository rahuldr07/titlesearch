# AI subprocessor due-diligence file

Obligation source: `docs/CONTEXT.md:492` (GLBA NPI + ALTA Pillar 3 — "vendor
due-diligence file for AI subprocessors (zero-retention API tiers)").
Status per `docs/superpowers/plans/backend/COMPLIANCE-RESEARCH-2026-09-01.md:105-113`:
this is a **precondition** on the extraction plan. The pipeline may not run on
real (non-synthetic) documents before an entry exists for every engine that
will see a page.

This file is the register. It is human-maintained, engineer-signed, and read by
a CI gate (§4). It is not generated from code.

## 1. Scope: what needs an entry

An entry is required for any component that transmits, stores, or processes a
**page image, page text, or extracted field value** outside this system's own
trust boundary. Concretely:

- every cloud OCR / document-AI API (LLMWhisperer today, per AGENTS.md
  "LLMWhisperer-now / Paddle-at-scale"),
- every hosted LLM used by an engine adapter or a judgment engine
  (Gemini / Claude / OpenAI or any successor),
- every hosted embedding, reranking, or classification API,
- every storage or queue provider that holds `quarantine/`, `validated/`,
  `pages/`, `reports/`, or `blind-input/` objects
  (`docs/backend/IMPLEMENTATION_PLAN.md:730-740`).

**Self-hosted engines still need an entry**, with vendor fields marked
`self-hosted` — PaddleOCR at scale is the in-house path (`CONTEXT.md:492`) and
its entry records that no NPI leaves the boundary. This keeps the gate in §4
total: *every adapter has an entry*, and "no third party involved" is an
assertion someone signed, not an absence.

A dev-only route is not exempt. The Max plan is dev-only and never a backend
(`AGENTS.md`), so it is recorded with `npi_permitted: false`, and a gate that
sees it wired into a production adapter fails.

## 2. Required fields per entry

| field | meaning |
|---|---|
| `engine_id` | matches `Engine.id` in `packages/contract/src/entities.ts:299-304` — the join key for the gate |
| `adapter_path` | the adapter module the entry authorizes |
| `vendor` / `legal_entity` | contracting party, or `self-hosted` |
| `service` + `model_or_endpoint` | the exact API surface; a model swap is a new review |
| `data_categories_sent` | page image / page text / field values / order identifiers; NPI classes reached (DOB, SSN-fragment, bankruptcy) |
| `npi_permitted` | boolean. `false` means the adapter may only be fed synthetic or already-public data |
| `zero_retention_tier` | the named tier/flag, plus how it is *asserted in the request* (header, project setting, endpoint) |
| `retention_evidence` | link/quote from the DPA or product terms, with retrieval date |
| `training_use` | must be "no training on customer data", with the citing clause |
| `subprocessor_chain` | the vendor's own subprocessors, since GLBA flow-down does not stop at tier 1 |
| `region_residency` | processing regions; cross-border transfer note |
| `dpa_status` | executed / pending / N/A, with counterparty and date |
| `security_attestations` | SOC 2 / ISO 27001 report date, or explicit "none" |
| `incident_notification_sla` | contractual breach-notice window |
| `deletion_path` | how a deletion request reaches this vendor, to satisfy per-tenant secure deletion |
| `reviewed_by` / `reviewed_at` / `next_review_due` | signature; entries expire (annual) |
| `spend_cap` | the hard cap, per `CONTEXT.md` AI-billing row |

## 3. Where it lives

- `docs/compliance/SUBPROCESSORS.md` — this narrative register (the human artifact).
- `docs/compliance/subprocessors.yaml` — the machine mirror the CI gate reads.
  One document per `engine_id`, fields exactly as §2. Kept adjacent so a
  reviewer edits one file and the gate reads the other from the same PR diff.
- Executed DPAs and vendor SOC 2 reports are **not** committed (they are vendor
  confidential and often bulky). `retention_evidence` and `dpa_status` cite an
  external document store location plus a SHA-256 of the PDF, so the register is
  verifiable without the artifact entering VCS — consistent with the
  never-commit-bulk rule in `AGENTS.md`.

## 4. The gate

`scripts/check-subprocessors.mjs`, run in CI alongside `apps/web/scripts/check-rules.mjs`.

It fails the build when:

1. **Orphan adapter.** An adapter module under `services/extraction-svc/**/adapters/**`
   (and the equivalent judgment/render adapter roots) declares an `engine_id`
   with no entry in `subprocessors.yaml`.
2. **Orphan entry.** An entry names an `engine_id` or `adapter_path` that no
   longer exists — stale authorizations are how a decommissioned vendor keeps a
   key.
3. **Missing required field**, empty string, or a placeholder (`TBD`, `TODO`, `?`).
4. **`zero_retention_tier` absent or falsy while `npi_permitted: true`.** This is
   the substantive rule; everything else is bookkeeping around it.
5. **Expired review** — `next_review_due` in the past.
6. **`npi_permitted: false` engine referenced from a non-dev routing cell**, i.e.
   present in `EngineRoutingCell.engine_id`
   (`packages/contract/src/entities.ts:308-318`) in a production routing fixture.
7. **Unpinned model.** `model_or_endpoint` must name a concrete version; a
   floating alias (`-latest`) silently changes the reviewed subprocessor.

Escape hatch, mirroring `check-rules.mjs`: a `subprocessor-allow:` marker with a
written reason, so a deliberate exception is visible in the diff rather than a
silently green build.

Additionally a **runtime** refusal belongs in the adapter base: an adapter whose
`engine_id` is not in the loaded register raises before the first outbound call.
CI catches the source; the runtime check catches a config-injected engine that
never appeared in the tree.

## 5. Entries (none yet)

No engine adapter exists yet, so this register is deliberately empty. That is
the accurate state, and it is also the reason the pipeline is synthetic-only
today. The first adapter PR must add its entry in the same commit.

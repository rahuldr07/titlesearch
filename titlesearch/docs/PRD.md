# TitlePipe — Full Product Requirements Document (Build-Ready)
**Version 2.1 · July 2026 · Owner: [Business Owner] · Status: BUILD**
**Scope: complete engineering spec. Design is done (15 screens built as .dc.html components against the API contract). Rulebook closed at 24 rules. This document is what the build team executes.**

---

# PART I — PRODUCT

## 1. Problem & opportunity
A nationwide title abstracting shop (~2,000 orders/month, target 20,000) hand-types Abstractor Call Back Sheets from county search packages (36–181 page PDFs, mostly scans) at 40–60 min/order. Quality has never been measured; sampling found 7 material defects across 6 of 10 delivered reports, 5 on machine-readable pages. Clients complain about speed; nobody knows where the hours go.

TitlePipe: machine extraction + human review of uncertain fields + measured quality + delivery with timestamps. Typing time → review time (<10 min). Defects → zero on auto-confirmed fields.

## 2. Product principles
1. **Engine-agnostic core.** Extraction engines are plug-in competitors behind one interface, scored on one bench, routed by measured wins. The durable product is the arena + golden set + rulebook, never a vendor.
2. **Zero shipped defects, not zero errors.** Errors are inevitable; shipping them is not. A field auto-confirms only when independent engines agree AND redundancy rules pass AND validators pass. Everything else gets human eyes.
3. **Every answer produces a rule.** Escalations, reconciliation, and complaints all terminate in rulebook entries. The same question is never asked twice.
4. **Blindness is structural.** Ground-truth construction (blind fifty) enforces no-model-leak and no-typist-crosstalk in the UI itself, not by policy.
5. **Humans approve promotions.** No threshold, engine seat, or rule goes live without a named person's sign-off, logged.
6. **A value with nothing behind it is the enemy.** Every field carries provenance (source, page, snippet, engine, rule). Confidence without provenance routes to review. (This shape — confident value, no basis — was caught 6 times during prototyping; the architecture exists to catch it forever.)

## 3. Goals & success metrics
| Metric | Target | Measured by |
|---|---|---|
| Shipped defects on auto-confirmed fields | 0 | Probes + complaint loop |
| Auto-confirm rate (mortgages/vesting, post-shadow) | ≥70% | Pipeline stats |
| Reviewer time per order | <10 min median | Review session timing |
| Turnaround (arrival → delivery) | baseline wk 1, then −50% | Delivery timestamps |
| Extraction cost per order | <$0.25 (accuracy-first config) | Per-engine cost ledger |
| Engine swap effort | 1 adapter + 1 bench run + 1 config flip | — |
| Judgment blind-fifty coverage | ≥40 fields | Blind Fifty Status |
| Reviewer catch rate (probes) | ≥95% | Ops dashboard |

## 4. Non-goals (v1)
Client self-serve portal · auto-tuning of anything · report shapes beyond A, B (Wheeler St), and docxtpl client templates · handwriting/cursive automation (routes to humans) · judgment auto-confirm before blind-fifty coverage · SSO/enterprise auth · multi-region.

## 5. Users & roles
| Role | Screens | Permissions |
|---|---|---|
| Reviewer | Queue, Review | Confirm/correct/flag/escalate fields; file bugs; never sees dashboard or throughput data |
| Senior | Escalation Inbox, Reconciliation, Seed Correction | Rule with citation; draft general rules (PENDING) |
| Ops lead | Dashboard, Delivery, Complaints, Blind Fifty Status, Ingest | Accept packages; resolve complaints; monitor |
| Engineer | Extraction Bench, Engine Leaderboard, Bench Results, Rulebook | Confirm PENDING rules; approve engine seats; edit prompts |
| Typist (temp) | Blind Fifty capture | Enter fields; structurally blind to model + other typist |
| Owner/Admin | Account layer (Me, My Org, People, Rulebook, Audit, Retention, Billing) | All + tenant admin |

Roles are named by job. Per-reviewer throughput does not exist as data anywhere in the system.

---

# PART II — SYSTEM

## 6. Architecture overview
```
                    ┌─ CLIENT INTAKE (email / API / SFTP / upload) ─┐
                    ▼
  INGEST ─ validate order fields · dedupe · segment (R24 boundaries) · explicit accept
                    ▼
  PAGE TRIAGE ─ text-layer check (free) → classifier engine → ~10% relevant pages
                    ▼
  EXTRACTION LAYER ─ engine registry · Reader A (vlm_image) ∥ Reader B (ocr_text)
                    ▼
  ASSEMBLY ─ chains (R17 skip non-arms-length) · releases (ref-doc verified, R15)
             MERS nominee resolution · re-record (R14) · modifications (R19)
             substitutions (R23) · judgment status screening (R13)
                    ▼
  VALIDATION ─ CI assertions v1–v14 · redundancy rules (§5 words>numerals,
               cross-instrument refs) · never-calculate rules (v99 family, R18)
                    ▼
  ROUTING ─ A==B ∧ checks pass → AUTO-CONFIRM · else → REVIEW QUEUE
            high-stakes fields += Claude second opinion · judgments never auto-confirm v1
                    ▼
  REVIEW / ESCALATION ─ resolutions generate rules → RULEBOOK
                    ▼
  RENDER ─ Shape A · Shape B · docxtpl client templates
           visibility: R16 release triggers · R22 LP pairs · R19/R23 linked entries
                    ▼
  DELIVERY ─ per-client method · timestamped · versioned (v1+v2 = defect record)
                    ▼
  COMPLAINTS ─ per-field capture → grouped by how-it-got-through → RULEBOOK
```
Workers run all extraction/assembly/render jobs via queue. Web tier never does minutes-long work.

## 7. Data model (Postgres; every table has tenant_id, created_at, updated_at)
```
tenants(id, name, settings)
users(id, tenant_id, email, role, clerk_id)
clients(id, tenant_id, name, delivery_method, delivery_config, report_shape, template_ref)
orders(id, tenant_id, client_id, external_ref, jurisdiction, state, county,
       status, arrived_at, accepted_at, delivered_at)
packages(id, order_id, storage_key, page_count, sha256, accepted_by)
pages(id, package_id, page_no, has_text_layer, class, class_engine, class_confidence)
documents(id, package_id, doc_type, page_start, page_end, recording_no, book_page,
          recorded_date, dated_date, segmentation_state)   -- R24 boundaries
fields(id, order_id, path, value, na_reason,               -- two NA states
       state,          -- pending|auto_confirmed|needs_review|confirmed|corrected|escalated
       source_doc_id, source_page, source_snippet, source_line_coords,
       engine_id, engine_confidence_raw,
       rule_refs[], approved_by, approved_at)
field_readings(id, field_id, engine_id, value, page, snippet, confidence_raw,
               cost_usd, latency_ms)                        -- per-engine, pre-merge
engines(id, kind, enabled, config, adapter_version)
engine_routing(id, jurisdiction, section, seat, engine_id,  -- per-cell assignments
               approved_by, approved_at, evidence_url)
engine_runs(id, engine_id, order_id, pages, cost_usd, latency_ms, error)
rules(id, code, text, origin,   -- spec|escalation|reconciliation|complaint|senior
      status,                    -- live|pending|retired
      jurisdiction_scope, version, confirmed_by, source_doc_ref)
escalations(id, field_path_cluster, order_ids[], question, resolution, rule_id, resolved_by)
bugs(id, order_id, field_id, description, upstream_source, status)
golden_fields(id, order_id, path, value, tag,  -- delivered_report|ruled|suspect|agreed
              source_citation, corrected_from, corrected_by, corrected_at, correction_reason)
blind_entries(id, order_id, typist_seat,        -- A|B, never a user name in UI
              path, value, source_citation, confidence)  -- certain|probable|unclear
reconciliations(id, order_id, path, value_a, value_b, ruling_value,
                citation, reason, ruled_by, general_rule_id)
probes(id, order_id, field_path, planted_value, caught, reviewer_action)
reports(id, order_id, version, shape, storage_key, rendered_at)
deliveries(id, report_id, method, status, attempted_at, delivered_at, evidence)
complaints(id, order_id, field_path, shipped_value, client_value,
           how_it_got_through,   -- auto_confirmed|human_confirmed
           resolution, rule_id, golden_offer_accepted)
audit_log(id, tenant_id, actor_id, action, entity, entity_id, at)  -- append-only
```
Field-level encryption (application-layer envelope): DOBs, SSNs if ever present, bankruptcy details. RLS policies on every tenant-scoped table; app connects as non-owner role; `SET LOCAL app.current_tenant` per transaction.

## 8. Engine layer (full spec)

### 8.1 Interface
```python
class ExtractionEngine(Protocol):
    id: str; kind: Literal["vlm_image","ocr_text","hybrid"]
    capabilities: EngineCaps   # has_confidence, has_line_coords, has_checkbox, max_page_px
    def read_page(self, page: PageImage) -> PageReading: ...
    def extract_fields(self, pages, schema: FieldSchema, rules: RuleContext) -> FieldSet: ...
```
Adapter constraints: ≤300 lines; cost+latency per call recorded; declared-not-faked capabilities; no engine sees another's output; enable/disable via config, no deploy.

**RuleContext:** field instructions are *generated from the rulebook* (R13–R24 templates + jurisdiction scope). Rule change → regenerated prompts for all engines. No per-engine prompt surgery.

### 8.2 Launch roster & seats
| Engine | Kind | Launch seat |
|---|---|---|
| pdftotext | ocr_text | Born-digital pages (free) |
| Gemini 2.5 Flash-Lite | vlm_image | Page classifier |
| Gemini 2.5 Flash | vlm_image | Reader A (primary) |
| Claude API | vlm_image | Second opinion: amounts, legals, judgment TYPE/STATUS |
| LLMWhisperer high_quality | ocr_text | Reader B: layout text + line coords + confidence metadata |
| PaddleOCR-VL | ocr_text | Reader-B challenger; self-host/PII path |
| Tesseract | ocr_text | Confidence oracle + clean-scan signal (never a reader of record) |

### 8.3 Ensemble routing
```
per field:
  agree(A,B) ∧ redundancy_pass ∧ validators_pass          → AUTO_CONFIRM
  high_stakes(field) → additionally require Claude agreement
  section == judgments                                     → NEEDS_REVIEW (v1 always)
  else                                                     → NEEDS_REVIEW
     (review UI shows A and B values + B's line coordinates for click-to-source)
agree() uses canonical comparison: normalized names (token-sorted), normalized
amounts, normalized dates — the bug-4 normalizer is the shared canon.
```
Engine self-confidence: prioritization signal only, never a gate. Router inputs ranked: (1) A/B disagreement, (2) redundancy failures (words≠numerals, broken cross-refs), (3) Tesseract region confidence, (4) engine self-confidence.

### 8.4 Engine Leaderboard (screen #15)
Engine × section × jurisdiction matrix vs golden set; accuracy by tag class; cost/1K pages; p95 latency. Seat changes: engineer-approved, logged with evidence link. `NO TRUTH YET` cells where golden coverage < threshold. No aggregate headline. No auto-promotion.

## 9. API contract (REST, FastAPI; all endpoints tenant-scoped, auth via Clerk session; existing screens already call these paths — gaps marked NEW)
```
POST   /api/orders                    create + upload package        (ingest)
POST   /api/orders/{id}/accept       explicit accept
GET    /api/queue/next               reviewer next-order (no cherry-pick)
POST   /api/orders/{id}/pass         recorded; 4th pass auto-escalates
GET    /api/orders/{id}/fields       field list + states + readings
POST   /api/fields/{id}/confirm     idempotent (bug-5 semantics)
POST   /api/fields/{id}/correct     value + reason
POST   /api/fields/{id}/escalate    question required
POST   /api/bugs                     broken-input channel (not corrections)
GET    /api/escalations              clustered by field-path
POST   /api/escalations/{id}/resolve ruling + rule (refused without rule)
GET    /api/metrics                  paired signals; catch_rate; field backlog
GET    /api/derived/{signal}         drill-down
GET    /api/rules · POST /api/rules/{id}/confirm      (engineer gate)
GET    /api/golden · POST /api/golden/corrections     (source+reason+signed)
POST   /api/blind/{order}/entries    typist capture (blind enforced server-side) NEW-hardened
GET    /api/reconciliation/{order}   divergences · POST rulings (citation required)
GET    /api/bench/results            section × tag matrix
GET    /api/engines                 engine registry (roster, kinds)
GET    /api/engines/leaderboard      engine × section × jurisdiction          NEW
GET    /api/engines/routing         current seat assignments (read side of POST)
POST   /api/engines/routing          seat change (engineer, logged)           NEW
GET    /api/orders/{id}/timeline    server-authored order events (feeds the order rail)
GET    /api/orders/{id}/report       render status · POST /render  (documented; contract schema lands with the Delivery report view)
GET    /api/deliveries · POST /api/deliveries/{id}/retry
GET    /api/complaints              list, grouped client-side by how_it_got_through
POST   /api/complaints               per-field capture
GET    /api/audit                    append-only view (admin)
GET    /api/me/permissions           caller's authz projection (rules-as-data; holder lists redacted)
```
Server-side owns: all state machines, needs_review logic, queue ordering, derived values, blindness enforcement (typist endpoints physically cannot return model output or the other seat's entries), five-state field logic. Screens are thin.

## 10. Rulebook (24 live rules)
R1–R12 (elicitation): deed field sourcing · assessment priority per field · consideration never derived from transfer tax · re-recording as one mortgage block · chain terminator (purchase test) · judgment counting · mortgage counting · release handling · recorded-date ordering · CONDO/PUD from rider checkboxes · non-person name derivation · copies-of-chains flag.

R13–R24 (senior rulings, July 2026 — full text `docs/rulings_2026-07.md`):
- **R13** Judgment enforceability screening: report active+enforceable only; canceled/satisfied/vacated/released/duplicates suppress with reason; status unknown → needs_review. (Resolves 10M006178-590: status Canceled 05/27/2010.)
- **R14** Re-recording: identity match + corrective-language (strongest) + recording pattern; **substantive-change veto** → modification/new instrument.
- **R15** ⚠ Liens **survive** arm's-length sale. Suppress only on verified release (ref-doc matched). Chain termination sets search depth, never lien disposition. New CI assertion **v14** enforces.
- **R16** Release visibility: full+whole+clean → suppress; any of 7 triggers (partial, partial satisfaction, exceptions, corrective, one-of-several, operative clauses, explains-title-issue) → render.
- **R17** Chain terminator skips non-arm's-length (gift/family/no-consideration/no-tax); continue to last bona fide purchase; indicator list (relationship, deed type, PM mortgage, tax recitals).
- **R18** Judgment amounts: original always; current balance only if in record, labeled as-of date; examiner never computes. Validator: balance without citation = hard fail.
- **R19** Modification = separate linked entry; original DOT persists; never overwrite original amount.
- **R20** UCC: collateral description decides; fixture filing + real-property refs + county recording support; personal-only suppresses; ambiguous → needs_review.
- **R21** Property/recording county always; acknowledgment county is a distractor, captured separately.
- **R22** Lis pendens persists after dismissal; resolution renders as linked pair (unlike mortgage release pairs).
- **R23** Substitution of trustee = own chain line, own recording info, linked to DOT.
- **R24** Vesting/segmentation boundary = document structure (title/stamp/instrument/parties begin; legal+signatures+acknowledgment+recording end), never page breaks.

Rule channels: spec · escalation · reconciliation · complaint. All PENDING rules gated on engineer confirmation. Rules carry jurisdiction scope (R15/R20 are state-law-dependent).

## 11. Extraction schema v2
132 base fields (six sections: mortgages 73-class, vesting_deed, assessment, judgments_liens, counts, location) + ruling delta: judgment status/status_date/original_amount/current_balance+as-of · release scope/corrective/operative_clauses · deed consideration/tax-exemption/relationship-signals/type · modification linked entries · UCC collateral/fixture/recording-location · ack-county vs recording-county · LP↔resolution links · substitution↔DOT links. Two NA states throughout: `NOT_PRESENT` vs `PRESENT_UNREADABLE`. `ORDER_SUPPLIED` fields (location.zip) are never extraction targets.

## 12. Quality stack
- **Seed bench:** 131 provenance-tagged fields, 6 orders; correction workflow (source+reason+signed, permanent log); suspect demotion as diagnosis.
- **Blind fifty:** 50 orders stratified by jurisdiction, judgment-heavy weighted; two typists, three-part contract (value+source+confidence), TYPE second-pass gate; structural blindness; reconciliation continuous with R13–R24 citable; output = `agreed`/`ruled` golden fields + PENDING rules. Governed by **reviewer session protocol** (what to ask/not ask/write down — P0 doc).
- **Probes:** planted defects; catch_rate is the dashboard headline (ungameable).
- **Complaint loop:** per-field; grouped by how-it-got-through (auto-confirmed complaint = threshold wrong, no human saw it); resolution = fix + rule + free golden-case offer.
- **Extraction Bench:** prompt iteration; scan/prompt/diff/rules panes; cross-package grid (column=jurisdiction problem, row=prompt problem); cost per run.
- **Bench Results:** section × tag matrix; ruled-fail hot red; suspect amber; judgments annotated thin.

## 13. Rendering & delivery
Shapes A (built) and B — Wheeler St (P2, straightforward); programmatic (TRUSTEE deleted not blanked; CONDO rewritten not filled); docxtpl for client templates (owner-editable Word). Visibility layer shared across shapes: R16/R19/R22/R23. Delivery per-client (email/portal/API/SFTP), timestamped, elapsed breakdown, v1+v2 retained as defect record. Failed delivery = transit state, retryable, never a quality state.

## 14. Compliance & security
GLBA NPI + ALTA Pillar 3: WISP documented; TLS everywhere; encryption at rest (managed PG AES-256) + field-level envelope encryption (DOB/bankruptcy); append-only audit log (doubles as SOC 2 evidence); per-tenant retention windows + secure deletion; least-privilege + MFA; vendor due-diligence file for AI subprocessors (zero-retention API tiers; PaddleOCR self-host as the in-house path); no NPI in URLs/logs; `packages/` never in VCS. SOC 2 via Sprinto/Drata when first client requires.

## 15. Tech stack
FastAPI (port; 155 tests green throughout) · Postgres managed (Render/Neon) + RLS + tenant_id · Procrastinate queue (graduate to Celery on saturation) · R2/Spaces storage · Render hosting · Clerk auth (sessions; tenant in token) · docxtpl + programmatic shapes · API keys with hard spend caps, Batch + prompt caching · Max plan = development only.

---

# PART III — EXECUTION

## 16. Build plan
**P0 (wk 1) — all parallel:**
- R15 audit: grep every lien-suppression path; add CI assertion v14.
- Reviewer session protocol doc (blocks typist start).
- Select 50 blind-fifty orders (stratified; judgment-heavy).
- 20-worst-pages bake-off: all roster engines, free tiers, CSV → first Leaderboard data.
- Repo: monorepo `api/ workers/ engines/ screens/ docs/`.

**P1 (wk 1–2) — foundation:** FastAPI port module-by-module behind existing contract; Postgres + tenant_id + RLS + Alembic; Procrastinate; engine registry + pdftotext + Tesseract adapters; Clerk; audit log; field-level encryption; fold R13–R24 into spec + schema v2; port 155 tests → target ~200 with ruling validators.

**P2 (wk 2–5) — extraction:** classifier adapter; Reader A (Gemini) + Reader B (LLMWhisperer) + Claude second-opinion adapters; RuleContext prompt generation from rulebook; ensemble router; Leaderboard v1; PaddleOCR eval adapter; Shape B renderer; review-screen dual-value + click-to-source wiring.

**P3 (wk 3–5) — blind fifty:** typists run under protocol; reconciliation continuous (lag signal watched); golden set grows; PENDING rules accumulate → engineer confirmations weekly.

**P4 (wk 6) — verdict:** all engines vs blind fifty; Leaderboard decides seats (human-approved); go/no-go per section per jurisdiction. Three acceptable outcomes: auto-confirm at threshold / draft-for-review only (still 5–10× typist speedup) / section-specific holds with known causes.

**P5 (wk 6–10) — shadow mode:** live orders in parallel with typists; thresholds calibrated empirically; complaints wired; probes live; cost ledger validated.

**P6 — cutover:** jurisdiction-by-jurisdiction, best accuracy first; typist capacity redeploys to review + blind-set expansion.

## 17. Acceptance criteria (release gates)
- **Ingest:** rejects incomplete package naming missing fields; duplicate detection on sha256; accept is explicit + logged.
- **Extraction:** every field has engine_id + page + snippet; per-call cost recorded; adapter test suite green per engine; classifier ≥98% recall on relevant pages (missing a deed page is worse than extracting a blank).
- **Router:** zero auto-confirms with failing validators (CI-enforced); judgments 100% routed to review; disagreement always surfaces both values + coordinates.
- **Review:** confirm idempotent (bug-5); corrections require reason; 4-pass auto-escalation fires; no throughput counters anywhere.
- **Rules:** escalation resolve refused without rule; PENDING cannot affect pipeline until confirmed; rule change regenerates prompts (test: change R18 text → prompt diff appears for all engines).
- **Blind fifty:** typist endpoints cannot return model/other-seat data (security test, not UI test); TYPE gate server-enforced; reconciliation requires citation.
- **Golden:** corrections require source+reason; log immutable; ORDER_SUPPLIED absent from all denominators.
- **Render/Delivery:** R16 seven triggers unit-tested; LP pairs render; v1+v2 both retained; delivery timestamps on every send.
- **Compliance:** RLS enforced via non-owner role (test: cross-tenant query returns zero); audit rows on every NPI access; encrypted fields unreadable in raw dumps.
- **Tests:** ≥200 green; v1–v14 assertions in CI; v99 remains deliberately empty.

## 18. Risks
1. Judgment ground-truth thinness → never auto-confirm v1; over-sample; partial automation is still the product.
2. R15 regression → P0 audit + v14 assertion.
3. Degraded/handwritten pages fail all engines → human routing + PRESENT_UNREADABLE is an honest answer.
4. Ensemble cost ($300–600/mo @2K; $3–6K @20K accuracy-first) → accepted; Leaderboard cost column + Paddle self-host valve past ~8–10K orders.
5. Vendor drift → the architecture.
6. Rule drift by state (R15/R20) → jurisdiction scope on rules + escalation channel.
7. Two-person team overload → phases sized; queue+managed-everything; nothing exotic.

## 19. Open items
Session protocol doc (P0) · Shape B (P2) · tenant_id/RLS (P1) · blind fifty execution (P3) · SOC 2 (deferred to client demand) · client portal (separate product). R15 audit + v14 completed in Gate 0.

---

*Companions: `docs/spec.md` (18 sections; R13–R24 fold-in = P1 task) · `docs/rulings_2026-07.md` · 15 screen briefs + built .dc.html components + api.js · stack research report · seed DB (`titlepipe.seed`).*

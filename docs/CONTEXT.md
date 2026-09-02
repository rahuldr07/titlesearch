# TitlePipe — Project Context

**Read this file completely before writing any code.** It is the distilled state of a multi-session design and prototyping effort. Most of what is here is non-obvious, was expensive to learn, and is **not derivable** from the codebase, the screens, or general knowledge of the domain.

**Status:** Design complete (15 screens built). Rulebook closed at 24 rules. Prototype validated (~2,700 LOC, 155 passing tests, Flask/SQLite). PRD v2.1 build-ready. Currently at **P0**: engine bake-off + R15 audit.

This is a **rewrite-and-harden** phase, not a greenfield.

---

## 1. The business

A US nationwide title-abstracting shop. Clients (lenders, attorneys, real-estate companies) order a property's legal history. The shop requests a search from a county, receives a **search package** (36–181 page PDF, mostly scans), and a senior typist hand-types a structured report — the **Abstractor Call Back Sheet** — in Word.

- ~2,000 orders/month today. Target: 20,000.
- 40–60 minutes of typist time per order. **The typing is the bottleneck.**
- Quality has never been measured. Sampling found **7 material defects across 6 of 10 delivered reports — 5 of them on machine-readable pages** (§12).

**TitlePipe** replaces the typing: machine extraction → human review of uncertain fields only → measured quality → timestamped delivery. Internal use first; SaaS later. Team: two engineers + the owner (domain expert).

### What this system is not

**There is no database to read from. The package *is* the database.** Every field on the sheet is extracted from the documents the abstractor pulled. This is not "fetch and populate."

---

## 2. Product principles

Load-bearing. Violating them is a design defect, not a style disagreement.

1. **Engine-agnostic core.** Extraction engines are plug-in competitors behind one interface, scored on one bench, routed by measured wins. The durable product is the arena + golden set + rulebook — never a vendor.
2. **Zero shipped defects, not zero errors.** Errors are inevitable; shipping them is not. A field auto-confirms only when independent engines agree AND redundancy rules pass AND validators pass. Everything else gets human eyes.
3. **Every answer produces a rule.** Escalations, reconciliation, and complaints all terminate in rulebook entries. The same question is never asked twice.
4. **Blindness is structural.** Ground-truth construction enforces no-model-leak and no-typist-crosstalk **in the API**, not by policy.
5. **Humans approve promotions.** No threshold, engine seat, or rule goes live without a named person's sign-off, logged.
6. **A value with nothing behind it is the enemy.** Every field carries provenance (source doc, page, snippet, engine, rule refs). Confidence without provenance routes to review.

> Principle 6 has a history. This exact shape — a confident value with nothing solid behind it — was caught **six separate times** during prototyping: a MERS phantom instrument, a parsed hint treated as truth, a forced expected value in a test, an ORDER_SUPPLIED ZIP presented as extracted, a fax artifact read as an amount, and a seed error in `mortgaged.1.amount`. Each was resolved architecturally. When you are about to emit a value you cannot cite — stop.

**Explicit owner mandate: accuracy first, cost second.** Cost optimization was considered and rejected as the primary goal. Do not "optimize" the ensemble away.

---

## 3. Non-goals (v1)

Client self-serve portal · auto-tuning of anything · report shapes beyond A, B, and docxtpl client templates · handwriting/cursive automation (routes to humans) · judgment auto-confirm before blind-fifty coverage · SSO/enterprise auth · multi-region.

---

## 4. Success metrics

| Metric | Target | Measured by |
|---|---|---|
| Shipped defects on auto-confirmed fields | 0 | Probes + complaint loop |
| Auto-confirm rate (mortgages/vesting, post-shadow) | ≥70% | Pipeline stats |
| Reviewer time per order | <10 min median | Review session timing |
| Turnaround (arrival → delivery) | baseline wk 1, then −50% | Delivery timestamps |
| Extraction cost per order | <$0.25 (accuracy-first config) | Per-engine cost ledger |
| Engine swap effort | 1 adapter + 1 bench run + 1 config flip | — |
| Judgment blind-fifty coverage | ≥40 fields | Blind Fifty Status screen |
| Reviewer catch rate (probes) | ≥95% | Ops dashboard |

---

## 5. Pipeline architecture

**ingest/segment → triage → extract → assemble → render → deliver**

- **Ingest** — package arrives (upload, email, API, or SFTP per client). Validate minimum order fields, duplicate-detect on sha256, segment the PDF into typed instruments, store. A malformed upload is rejected at the door **with a specific reason**, never silently.
- **Triage** — page classifier (cheap VLM) marks relevant pages. Recall target ≥98%: missing a deed page is worse than extracting a blank one.
- **Extract** — queue-based worker, **never request/response**. A 181-page package through a vision model is minutes of work and real money. Results land field-by-field with value, page ref, snippet, engine id, confidence, cost.
- **Assemble** — chain construction, chain termination, re-record collapsing, release resolution, nesting, ordering, counting, derivation.
- **Render** — programmatic docx per report shape.

> **Assemble is the expensive stage. Budget it as its own stage with its own tests. Do not let it hide inside "extraction."**
>
> Extracting `$220,224.00` from a scan is solved. Knowing that the 2011 assignment attaches to the 2008 DOT and not the 2015 subordinate one, that a re-recorded partial claim is not a second debt, and that a cancelled security deed still proves where the chain terminates — that is relational reasoning across documents, and it is where reviewers will find your errors.

**The web tier never does minutes-long work.**

### Text-layer coverage across the reference set

| Package | Pages | With text | % |
|---|---|---|---|
| Greene NY | 181 | 24 | 13% |
| Mecklenburg NC | 116 | 25 | 22% |
| Houston GA | 109 | 5 | 5% |
| Clayton GA | 36 | 3 | 8% |
| Wheeler St OH | 112 | 64 | 57% |

Median well under 25%. **OCR/vision extraction is stage one, not an optimisation.**

**The counter-lesson:** 5 of the 7 confirmed defects are on *machine-readable* pages. The `Not Available` problem is overwhelmingly **extraction failure under a clock**, not absent source. That is the argument for the build.

---

## 6. Data model (Postgres; every table has `tenant_id`, `created_at`, `updated_at`)

```
tenants(id, name, settings)
users(id, tenant_id, email, role, clerk_id)   -- ⚠ workos_user_id at the port; ADR-0001 signed Clerk → WorkOS
clients(id, tenant_id, name, delivery_method, delivery_config, report_shape, template_ref)

orders(id, tenant_id, client_id, external_ref, jurisdiction, state, county,
       status, arrived_at, accepted_at, delivered_at)
packages(id, order_id, storage_key, page_count, sha256, accepted_by)
pages(id, package_id, page_no, has_text_layer, class, class_engine, class_confidence)
documents(id, package_id, doc_type, page_start, page_end, recording_no, book_page,
          recorded_date, dated_date, segmentation_state)   -- R24 boundaries

fields(id, order_id, path, value, na_reason,               -- TWO NA states, see §11
       state,          -- pending|auto_confirmed|needs_review|confirmed|corrected|escalated
       source_doc_id, source_page, source_snippet, source_line_coords,
       engine_id, engine_confidence_raw,
       rule_refs[], approved_by, approved_at)
field_readings(id, field_id, engine_id, value, page, snippet, confidence_raw,
               cost_usd, latency_ms)                        -- per-engine, PRE-merge

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
blind_entries(id, order_id, typist_seat,        -- A|B, never a user name in the UI
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

- `field_readings` keeps per-engine values **before** merge, permanently. Disagreements stay inspectable forever.
- RLS on every tenant-scoped table. App connects as a **non-owner** role. `SET LOCAL app.current_tenant` per transaction.
- Field-level envelope encryption (application layer): DOBs, SSNs if ever present, bankruptcy details.
- `packages/` is **never** in VCS. (See §19 — this already caused a 644 MB incident.)
- **`bugs` ≠ corrections.** Corrections are reviewer field edits. Bugs are broken *inputs* / derived-field defects and route to **developers**, not senior reviewers. Two tables, two audiences.
- **`reconciliations.value_a` / `value_b` are a ruling-time snapshot, not a cache of `blind_entries.value`.** They look like a redundancy (audit D-4) and are not one: a ruling is a record of *what the reviewer was shown when they ruled*. If a typist entry is later edited or its row is retention-deleted, the ruling's account of itself must not change. Consequences, all currently unimplemented: the snapshot is **written once at creation** and never updated; retention deletion of `blind_entries` **must not cascade** to `reconciliations`; `UNIQUE (tenant_id, order_id, typist_seat, path)` on `blind_entries` is what makes "the seat-A value at ruling time" a single well-defined fact; and the snapshot carries the **two NA states** (§11) intact — a `NOT_PRESENT` entry must not snapshot as a bare null indistinguishable from `PRESENT_UNREADABLE`.
- **`complaints.shipped_value` is the same kind of snapshot** — what the client actually received, frozen at complaint time, never re-read from `fields` or the report.

---

## 7. API contract (REST, FastAPI; tenant-scoped, ~~Clerk~~ **WorkOS** session auth — superseded by [ADR-0001](adr/0001-core-api-fastapi.md))

The 15 built screens already call these paths. `NEW` = not yet implemented.

```
POST   /api/orders                    create + upload package        (ingest)
POST   /api/orders/{id}/accept        explicit accept
GET    /api/queue/next                reviewer next-order (no cherry-pick)
POST   /api/orders/{id}/pass          recorded; 4th pass auto-escalates
GET    /api/orders/{id}/fields        field list + states + readings
POST   /api/fields/{id}/confirm       idempotent (bug-5 semantics)
POST   /api/fields/{id}/correct       value + reason
POST   /api/fields/{id}/escalate      question required
POST   /api/bugs                      broken-input channel (NOT corrections)
GET    /api/escalations               clustered by field-path
POST   /api/escalations/{id}/resolve  ruling + rule (REFUSED without a rule)
GET    /api/metrics                   paired signals; catch_rate; field backlog
GET    /api/derived/{signal}          drill-down
GET    /api/rules · POST /api/rules/{id}/confirm      (engineer gate)
GET    /api/golden · POST /api/golden/corrections     (source+reason+signed)
POST   /api/blind/{order}/entries     typist capture (blindness enforced server-side)
GET    /api/reconciliation/{order}    divergences · POST rulings (citation required)
GET    /api/bench/results             section × tag matrix
GET    /api/engines                   engine registry (roster, kinds)
GET    /api/engines/leaderboard       engine × section × jurisdiction          NEW
GET    /api/engines/routing           current seat assignments (read side of POST)
POST   /api/engines/routing           seat change (engineer, logged)           NEW
GET    /api/orders/{id}/timeline      server-authored order events (feeds the order rail)
GET    /api/orders/{id}/report        render status · POST /render  (documented; contract schema lands with the Delivery report view)
GET    /api/deliveries · POST /api/deliveries/{id}/retry
GET    /api/complaints                list, grouped client-side by how_it_got_through
POST   /api/complaints                per-field capture
GET    /api/audit                     append-only view (admin)
GET    /api/me/permissions            caller's authz projection (rules-as-data; holder lists redacted)
```

**Server-side owns:** all state machines, `needs_review` logic, queue ordering, derived values, blindness enforcement, five-state field logic. **Screens are thin.**

### Rules the UI must not re-implement

A design tool sees `confidence: 0.71` and `state: "low"` in one object and will reasonably conclude it can compute `state` itself. Then someone tunes the threshold in the backend and the UI silently disagrees.

- The UI **must not** compute `state` from `confidence`. The server owns the threshold.
- The UI **must not** compute `needs_review` from `value === null`. That collapses the two NA states (§11) into one and sends reviewers chasing ghosts on every California order.
- The UI **must not** re-derive counts, chain termination, or release resolution.

---

## 8. Engine layer

### 8.1 Interface

```python
class ExtractionEngine(Protocol):
    id: str                    # "gemini-2.5-flash", "llmwhisperer-hq", "paddleocr-vl", ...
    kind: Literal["vlm_image", "ocr_text", "hybrid"]
    capabilities: EngineCaps   # has_confidence, has_line_coords, has_checkbox, max_page_px

    def read_page(self, page: PageImage) -> PageReading:
        """PageReading: text, layout blocks, per-line confidence (or None),
        per-line bounding boxes (or None), latency, cost."""

    def extract_fields(self, pages, schema: FieldSchema, rules: RuleContext) -> FieldSet:
        """FieldSet: per field → value, page ref, quoted snippet,
        engine id, raw confidence (unverified), cost."""
```

Hard requirements:
- **Adapters are ≤300 lines.** If an engine needs more, it doesn't fit — wrap it externally.
- **Cost and latency recorded per call**, attributed to engine + order + tenant.
- **Engines never see each other's output.** Independence is what makes disagreement meaningful.
- **Config-driven registry** — enable/disable per environment, no deploy.
- Missing capabilities (no confidence, no boxes) are **declared, not faked** with placeholders.
- **`RuleContext` carries R13–R24 field instructions.** Prompts are *generated from the rulebook*. A rule change regenerates prompts for every engine. **No per-engine prompt surgery.**

### 8.2 Launch roster & seats

| Engine | Kind | Launch seat |
|---|---|---|
| pdftotext | ocr_text | Born-digital pages (free) |
| Gemini 2.5 Flash-Lite | vlm_image | Page classifier |
| Gemini 2.5 Flash | vlm_image | **Reader A** (primary) |
| Claude API | vlm_image | Second opinion: amounts, legals, judgment TYPE/STATUS |
| LLMWhisperer high_quality | ocr_text | **Reader B**: layout text + line coords + confidence metadata |
| PaddleOCR-VL | ocr_text | Reader-B challenger; self-host / PII path |
| Tesseract | ocr_text | Confidence oracle + clean-scan signal (**never** a reader of record) |

Adding Mistral OCR, Azure DI, Textract, or any 2027 model = one adapter + one bench run. Nothing else changes.

The two readers are chosen for **uncorrelated failure modes**: image-VLM hallucinations are plausible-but-wrong; OCR errors are visibly garbled. Different alarms.

### 8.3 Ensemble routing

```
per field:
  agree(A,B) ∧ redundancy_pass ∧ validators_pass          → AUTO_CONFIRM
  high_stakes(field) → additionally require Claude agreement
  section == judgments                                     → NEEDS_REVIEW (v1, always)
  else                                                     → NEEDS_REVIEW
     (review UI shows A and B values + B's line coordinates for click-to-source)

agree() uses canonical comparison: normalized names (token-sorted), normalized
amounts, normalized dates — the bug-4 normalizer is the shared canon.
```

**Engine self-reported confidence is never an auto-confirm gate.** Documented as miscalibrated. It is one review-prioritization signal among several.

Router input priority: (1) A/B disagreement, (2) redundancy failures (words≠numerals, broken cross-refs), (3) Tesseract region confidence, (4) engine self-confidence.

Judgments never auto-confirm in v1 — thinnest ground truth, 3 of 7 known defects. The path to automation is now *defined* (R13 status screening + R18 amount rules); the remaining gate is **blind-fifty coverage (≥40 judgment fields), not missing rules.**

### 8.4 Engine Leaderboard (screen #15)

Engine × section × jurisdiction matrix vs the golden set. Accuracy by tag class (ruled/delivered/suspect), plus cost-per-1,000-pages and p95 latency.

- Routing is **per cell** — assignments differ by jurisdiction × section. The router reads the assignment table.
- **Seat promotion is human-approved.** The board may show PaddleOCR beating LLMWhisperer on Georgia mortgages; an engineer flips config, logged with who/when/evidence link. **No auto-promotion.**
- `NO TRUTH YET` where golden coverage is below threshold. **No aggregate headline number.**

---

## 9. The rulebook — 24 live rules

### Provenance tags (from `docs/spec.md`)

Every rule carries a tag. **This matters more than the rule text** — it tells developers what to trust and what will change.

| Tag | Meaning |
|---|---|
| `RULED` | Ops stated it explicitly. Authoritative. |
| `DERIVED` | Inferred from delivered reports, confirmed across N packages. Reliable but unstated — **if it breaks, ask before assuming a bug.** |
| `OPEN` | Genuinely unresolved. **Do not build past it.** |
| `CONFLICT` | Two authoritative sources disagree. Needs a ruling. |

Rules carry **jurisdiction scope** (R15 and R20 are state-law-dependent). Four channels feed the book: spec elicitation · escalation resolutions · reconciliation rulings · complaint fixes. One rulebook, versioned, origin-tagged. **PENDING drafts cannot affect the pipeline until an engineer confirms them.**

### R1–R12 (requirements elicitation)

deed field sourcing · assessment priority per field · consideration never derived from transfer tax · re-recording as one mortgage block · chain terminator (purchase test) · judgment counting · mortgage counting · release handling · recorded-date ordering · CONDO/PUD from rider checkboxes · non-person name derivation · copies-of-chains flag.

### R13–R24 (senior examiner rulings, July 2026 — full text `docs/rulings_2026-07.md`, origin `ruled/senior-2026-07`)

- **R13 — Judgment enforceability screening.** Report only judgments that (a) affect the subject owner and (b) remain **active and enforceable**. Canceled / satisfied / vacated / released / duplicates → suppress **with reason logged**. Status unknown → `needs_review` (never assume active, never assume canceled). Party identity remains a *distinct* check: name match alone is insufficient; requires corroboration (address, middle name, suffix); ambiguity → needs_review.
  - *Resolves the long-open mystery:* Mecklenburg **10M006178-590** (Huntington Forest HOA v. Richard Lee Buchanan) was dropped because its court status was **Canceled 05/27/2010** — a STATUS exclusion, **not** a name-identity exclusion. This reframed the entire party-identity question after three sessions of chasing it.
  - New fields: `judgments[].status` (active|satisfied|released|canceled|vacated|unknown), `judgments[].status_date`.
- **R14 — Re-recording detection.** No single factor decides. Requires: execution details match (grantor/grantee, execution date, amount, legal description) AND recording pattern supports it (later recording date, identical execution date, "Re-recorded"/"Corrective" stamps) AND — strongest evidence — the body states corrective intent. **Substantive-change veto:** if the later document changes loan amount, borrowers, lender, rate, or obligations, it is a NEW instrument or a MODIFICATION, never a re-recording, regardless of other matches.
- **R15 — ⚠ Liens SURVIVE an arm's-length sale.** *This corrects a prior assumption baked into the code.* Suppress a lien only on a **verified release** (reference-doc matched). **Chain termination sets search depth, never lien disposition.** Requires a P0 audit of every lien-suppression path + new CI assertion **v14**.
- **R16 — Release visibility.** Full + whole + clean → suppress. Any of **seven triggers** → render: partial · partial satisfaction · exceptions · corrective · one-of-several · operative clauses · explains-a-title-issue.
- **R17 — Chain terminator skips non-arm's-length transfers** (gift / family / no consideration / no tax); continue back to the last bona fide purchase. Indicators: party relationship, deed type, purchase-money mortgage, tax recitals.
- **R18 — Judgment amounts.** Original amount **always**. Current balance **only if stated in the record**, labeled with an as-of date. **The examiner never computes a balance.** Validator: balance without citation = **hard fail**.
- **R19 — Modifications** are separate **linked** entries. The original DOT persists. **Never overwrite the original amount.**
- **R20 — UCC.** The **collateral description** decides. Fixture filing + real-property references + county recording support inclusion. Personal-property-only → suppress. Ambiguous → needs_review.
- **R21 — County.** Property/recording county **always**. The acknowledgment (notary) county is a known distractor — capture separately, never report.
- **R22 — Lis pendens persists after dismissal.** The resolution renders as a **linked pair** — unlike mortgage release pairs, which suppress.
- **R23 — Substitution of trustee** is its own chain line with its own recording info, linked to the DOT. (Retroactively validated the Shape A renderer's TRUSTEE handling.)
- **R24 — Vesting / segmentation boundary follows document structure, never page breaks.** Document begins: new title / recording stamp / instrument number / parties. Document ends: legal description + signatures + acknowledgment + recording info. **Goes verbatim into the segmentation prompt.**

---

## 10. Extraction schema v2

132 base fields across six sections (mortgages, vesting deed, assessment, judgments & liens, counts, location), plus the ruling-driven delta:

| New field(s) | Rule | Purpose |
|---|---|---|
| `judgments[].status`, `status_date` | R13 | Enforceability screening |
| `judgments[].original_amount` (required), `current_balance` + `balance_as_of_date` (record-only) | R18 | Never-calculate rule; balance without citation = hard validator failure |
| `release.scope` (full/partial + limitations), `release.corrective`, `release.operative_clauses` | R16 | Seven-trigger render visibility |
| `deed.consideration_recital`, `deed.tax_or_exemption`, `deed.relationship_signals`, `deed.type` | R17 | Non-arm's-length detection |
| `modification.*` (type, changed terms, original-instrument ref) | R19 | Original + modification both render, linked |
| `ucc[].collateral_description`, `is_fixture_filing`, `references_real_property`, `recording_location` | R20 | Collateral test |
| acknowledgment-county vs recording-county (distinct captures) | R21 | Notary block is a distractor |
| lis pendens ↔ resolution linkage | R22 | Pair renders |
| trustee substitution ↔ original DOT linkage | R23 | Separate chain line |

Pydantic models are the schema as code.

### The order is a first-class input — not derivable from the package

| Field | Notes |
|---|---|
| `ORDER #` / `Order/Loan #` | |
| `VENDOR` | **Shape A only.** 66805 = the client's vendor ID for the shop. Per-client constant. |
| `SEARCH DATE` | |
| `EFFECTIVE DATE` | |
| `Delivery Date` | Shape B only |
| `Report Type` | **Shape B only — and it drives chain depth.** |
| Ordered address | The comparand for `IS ADDRESS SAME AS ORDERED` |
| `ZIP CODE` | ORDER_SUPPLIED; client value legitimately differs from the property record |

`RULED` — a chain **Start Date** is *not* required on the order. (San Diego's run sheet carries one, but it's an output of the search, not an input.)
`OPEN` — **full order field list was never supplied.**

### Deed capture list (ops-stated)

grantor + vesting · grantee + vesting · consideration · recorded date · dated date · book/page · instrument # · legal description — **plus `DEED TYPE`**, which ops omitted from the list but which appears on all seven reports and forks the most across states (Warranty, Bargain & Sale, Administrator's, Special Warranty, Quitclaim, Grant). It names the block.

---

## 11. Domain facts that will trip you up

**Read this section twice.** None of it is derivable from a screen, and all of it is load-bearing.

- **`Not Available` is TWO states.** They **render identically** and **route oppositely**:
  - *Structurally absent* — the jurisdiction doesn't use the field (San Diego `BOOK/PAGE`, Houston `INST#`, Greene `BUILDING` — the card has no building line). **Never surface. It is correct.**
  - *Not found* — the field exists and wasn't captured (McIntosh `CONS`, Mecklenburg `PLAINTIFF ATTORNEY`). **Always surface.**
  - Collapsing them (e.g. keying off `value === null`) sends reviewers chasing ghosts on every California order. A third honest state exists for degraded scans: `PRESENT_UNREADABLE`.
- **`#OF MTGS: 01`** means *unreleased originals plus partial claims*. The release must survive in memory until **after** the chain terminator runs, or chains silently stop terminating.
- **`LAND + BUILDING ≠ TOTAL` is CORRECT.** Mixed valuation bases are intentional. Assessment priority is per-field: **appraised → FMV → assessed → taxable**. Do not "fix" this.
- **Consideration (`CONS`) is never derived from transfer/excise/documentary tax.** Explicit ruling. Transfer tax is a *purchase identifier* only — it identifies an arm's-length sale; it never populates CONS.
- **Chain termination** = the last arm's-length purchase, detected by contemporaneous purchase money **or** excise/transfer tax above nominal. R17 governs the gift-deed / inter-family case: skip and continue back.
- **Ordering is by the block's own recorded date** — which is why a 2021 modification precedes a 2015 subordinate DOT in output. Not a bug.
- **Three distinct instrument families**: security deed / deed of trust / deed to secure debt. **Georgia security deeds have no trustee** — the TRUSTEE line is *deleted*, not blanked. Feed the same renderer a California DOT and the line reappears. The renderer is programmatic for this reason; CONDO lines are *rewritten*, not filled.
- **Recording conventions differ**: book/page vs instrument number, by jurisdiction.
- **Non-person name** = the mortgagor with vesting language stripped. It is the **judgment search key**.
- **MERS MIN normalization** is a known problem area. A MERS nominee instrument is **not** a resolving instrument (bug-2).
- **Two documents can be the same document.** M2023-1935 and M2024-326 were one instrument, re-recorded. R14 is the test.
- **Section headings come from the instrument's own caption** — the same code emits `SECURITY DEED`, `DEED TO SECURE DEBT`, `OPEN-END MORTGAGE DEED`, `PARTIAL CLAIM MORTGAGE`.
- **Deeds contradict themselves.** One reference deed: page 1 says `DATED this 16 day of September, 2008`; page 2 says `2007`, and the grantee acknowledgment says 2007. The typist took 2008 (correct — recorded 9/17/2008). **A model reading page 2 will take 2007. Rule: the grantor's date wins.**
- **Three tax vocabularies**: Annual (GA/KY/NY/NC) · 1st/2nd Installment (CT/CA) · 1st/2nd Half (AK). The Anchorage card says `Cycle 1 / Cycle 2` while the report says `1st Half / 2nd Half`. **And the cadence changed within one jurisdiction** — Anchorage was single-payment through 2021, two-cycle from 2022.
- **ORDER_SUPPLIED fields are not extraction targets** — notably ZIP. Excluded from every accuracy denominator.
- **Text-search trap:** `LEGAL DESCRIPTION` (the section) collides with the flag line `LEGAL DESCRIPTION– COPY OF DEED ATTACHED` earlier in the document. Use `rindex`, not `index`.
- **`JUDGMENTS RAN ON BUYER AND SELLER`** is **a statement to the client that the search was performed** — not a data assertion. (Ops clarified this after Claude misread it as a coverage claim.)
- **The `-N` suffix is not a global counter.** This was asserted and retracted.

### `EXCEPTIONS` — status `CONFLICT`, 4:1 against the template's own schema

The blank template defines `TYPE / FROM / RECORDED / TO / BOOK/PAGE / INST# / COMMETNS` *(sic — the typo is in the template)*.

- **Delivered as prose bullets — 4 of 5 packages** (GA scrivener's affidavit, KY right-of-way, NC limited POA, GA specific POA).
- **Delivered as the schema — 1 of 5**, in the Anchorage annotation deck.
- The ops field list for Power of Attorney *is* the schema — which would make four delivered reports defective.

`RULED` — a **second EXCEPTIONS section** carries rule 6/7 exclusions (name hits determined not to be the subject; estate hits determined not to count).

`OPEN` — three mechanics: (1) does the schema fit a drop reason like *"Richard Erwin Buchanan, DOB 1951 — different person"*? It has no FROM, no TO, no book/page. (2) **All drops, or only the judgment calls?** Mecklenburg had ten; six were mechanical, four required judgment. Ten lines × 20,000 orders is noise. (3) Where do address-change and re-recording comments live — same section or three?

> This section is worth more than it looks. Under R13 every drop now needs a written reason. **Whoever writes those reasons is writing the rulebook, one order at a time.**

### Unresolved domain gaps

- **Anchorage carries a deceased vested owner** (`Estate of Matthew Gay` as case defendant; tenancy by the entirety *with right of survivorship*; the 2025 modification signed by Santina alone) — **it does not appear on the report.** Is `#OF E&R ESTATES: 01` correct? Does vesting change to Santina alone?
- **A Chapter 11 bankruptcy on the sole surviving owner** (`Notice of Bankruptcy Filing... Ch 11`; disposition `Bankruptcy Stay 01/30/2018`) — doesn't appear, and **the template has nowhere to put a bankruptcy.**
- `#OF E&R ESTATES` doesn't appear on any delivered report at all.
- **How many report shapes exist?** Two confirmed. This number sizes the renderer work.
- Coverage gaps never closed: a **leasehold** and a **populated tax lien**.

---

## 12. The seven confirmed defects (the golden-set seed)

**Delivered reports cannot be the spec or the eval.** Six of ten packages carry a material defect. Fit a model to this output and you fit the mistakes — the accuracy metric will reward reproducing them.

| # | Package | Defect | Source in package? |
|---|---|---|---|
| 1 | **Wheeler St OH** | Judgment reported as *"Certificate of Judgment Filed 08/01/2024, Case No. CJ24017588"* — **two of six fields.** Package holds: `AMOUNT $37,696.56` · `CREDITOR EVANS LANDSCAPING INC` · `DEBTOR ROSS SHIVELY` · `ATTORNEY NICHOLAS SHAFFER`. A $37,696 judgment against the current owner, and the sheet omits the amount, who owes it, and who's owed. | ✅ **text layer** |
| 2 | **Mecklenburg NC** | `J-1 PLAINTIFF ATTORNEY: Not Available` — p.77 says **HOFFMAN, RYAN PATRICK / LEIGHTON, BENJAMIN**. `J-3 PLAINTIFF ATTORNEY: Not Available` — p.83 says **KARRENSTEIN, CHRIS**. | ✅ **text layer** |
| 3 | **Mecklenburg NC** | `J-1` = `19CVS019175-590`, cause **`CV - Real Property / Title`** — a title-curative suit by Wells Fargo against five defendants incl. HUD. Typed `TYPE: Judgment`, `DEFENDANT: Richard Lee Buchanan` (one of five), counted. The judgment it produced (*Order Granting Default Judgment, rec. 08/06/2020, Bk 34900/53*) appears only as a comment under the HAMP mod — needs its own row. | ✅ |
| 4 | **San Diego CA** | Report: 238,120 / 188,559 / 426,679, taxes $3,089.86 × 2 for 2024-25, noted *"Current Year Tax Information not available in Online."* The San Diego roll **in the same package**, printed on the search date, says 2025-26: 233,451 / 184,862 / 418,313, installments **$3,128.88**, both paid 12/10/2025 and 04/10/2026. | ✅ |
| 5 | **Greene NY** | `#OF MTGS: 05` → **`04`** (re-record). `J-2 TYPE: Judgment` on a **summons** — ops rule 2 says a summons is not a judgment. `J-3 CASE NO: Not Available` — index number `EF2021-353` is printed on the judgment's own header. | ⚠ scans |
| 6 | **Anchorage AK** | Assessment took 2025 ($701,700); 2026 appraised ($843,000) is on the card and current at the effective date. | ✅ |
| 7 | **CSSKY-640347 KY** | Blank-template instructional text delivered to the client. | — |

**Ten orders, ~2,000 fields, seven known-wrong → ~99.6% correct.** Seeded as the bench with those seven tagged `ruled` + corrections applied (14 corrections total).

**Be honest about what the seed is:** it is anchored on **typist behaviour, not truth**. It cannot measure what typists get wrong *systematically* — judgment `TYPE` was wrong 3/3, and a seed built from these reports will happily score a model that reproduces the error. Tag it `source: 'delivered_report'` alongside `agreed` and `ruled` so nobody mistakes it later. **This is why the blind fifty still has to happen.**

> Transcription rule: **OCR'd transcription would poison the well.** Seed only from delivered reports with a real text layer — 6 of 10, ~131 fields.

---

## 13. Report shapes

**Two confirmed. One extraction layer, N renderers, keyed on client + report type.** Do not build one renderer with conditionals — `VENDOR: 66805` is hard-coded into Shape A's line 2, which alone forces per-client templating.

| | **Shape A — "66805"** | **Shape B — Wheeler St** |
|---|---|---|
| Title | `ABSTRACTOR CALL BACK SHEET` | *(none)* |
| Header | ORDER # · VENDOR · SEARCH DATE · EFFECTIVE DATE | Order/Loan # · Effective Date · Delivery Date · **Report Type** |
| Customer block | — | `CUSTOMER INFORMATION` |
| Deed fields | type · grantor **+ vesting** · grantee **+ vesting** · dated · recorded · bk/pg · inst# · **CONS** | type · grantor · grantee · inst# · bk/pg · recorded · dated (no CONS, no vesting) |
| Flag block | all eight | absent |
| Chain | `PRIOR DEED` | `CHAIN OF TITLE - 01…NN` |
| Mortgage | mortgagor · entity type · non-person name · mortgagee · trustee · MIN · open ended · multiple parcels | borrower · lender · amount · open/closed end **only** |
| Assessment | `ASSESSMENT` + separate `CURRENT TAX INFORMATION` | one `ASSESSMENTS & TAX INFORMATION` |
| Counts | `#OF MTGS / JUDGMENTS / TAX LIENS / E&R ESTATES` | absent |
| CONDO/PUD | present | absent |
| Misc | `EXCEPTIONS` | `RESEARCH COMMENTS` |
| Judgments | 12 structured fields | prose bullet + names-run list |

**Shape A structure (built):** header · Current Vesting Deed · Location · the eight-flag Y/N block (legal desc attached · 20-yr abstract · chains included · judgments run on buyer & seller · address same as ordered · conveys 100% · all parcels make up ordered address · fee simple/leasehold) · Assessment · Current Tax Information · Mortgage/DOT (+ Assignments; "No Open Mortgage Found" where applicable) · Condo/PUD/Waterfront · counts · Exceptions · Prior Deeds · Legal Description · 30-day review notice.

Shape B is a **P2 task**, assessed as straightforward (same programmatic approach). Its `Report Type` field **drives chain depth**.

All shapes share the rule-driven visibility layer: **R16** release triggers · **R22** lis pendens pairs · **R19** modification entries · **R23** substitution lines.

Per-client templates via **docxtpl** — owner-editable Word files.

**Delivery** is per-client (email/portal/API/SFTP), timestamped, with elapsed breakdown. **v1 + v2 both retained as the defect record.** A failed delivery is a **transit state** — retryable, **never a quality state**.

---

## 14. Quality stack

- **Seed bench** — 131 fields from 6 of 10 delivered reports with real text layers, provenance-tagged `delivered_report / ruled / suspect / ORDER_SUPPLIED-excluded`. Seed-correction workflow with a **permanent signed audit log**.
- **Blind fifty** — two typists, **structurally blind**, three-part field contract (value / source citation / confidence: certain|probable|unclear), judgment TYPE gate server-enforced. Reconciliation with **citation-required rulings** — seniors now cite R13–R24 in writing rather than adjudicating from memory. PENDING rules flow to the rulebook. Governed by the **reviewer session protocol** doc (companion — *still to be written; blocks typist start*).
- **Probes** — planted defects measure reviewer catch rate. The ungameable dashboard headline. **Probes are never visible in the UI.**
- **Complaint loop** — per-field capture, grouped by *how it got through*. A complaint on an auto-confirmed field indicates a **threshold error**, not a reviewer error.

### Anti-patterns deliberately designed out — do not reintroduce

No approve-all · no per-reviewer throughput ranking or counters anywhere · no probe visibility · no timer on golden-set capture · no auto-tuning on the extraction bench · no aggregate headline accuracy number · no cherry-picking from the queue (4th pass auto-escalates) · escalation resolution **refused** without a rule.

---

## 15. Tech stack (researched July 2026)

| Layer | Choice | Note |
|---|---|---|
| API | **FastAPI** (port from Flask; 155 tests are the safety net) | Pydantic = schema as code |
| DB | **Managed Postgres** (Render/Neon) | `tenant_id` everywhere + RLS backstop |
| Queue | **Procrastinate** (Postgres-native) | Graduate to Celery/Redis only on saturation |
| Storage | Cloudflare R2 / DO Spaces | Zero-egress matters for PDF-heavy review traffic |
| Hosting | Render (or DO) | 2-engineer ops budget |
| Auth | ~~Clerk (free tier)~~ → **WorkOS AuthKit** | **Superseded by [ADR-0001](adr/0001-core-api-fastapi.md), signed 2026-08-05.** Sealed-session cookies + Python session helpers; **Postgres owns authorization**. `Session.authenticate()` *is* JWKS verification, not an alternative to it |
| Rendering | docxtpl + programmatic Shapes A/B | Owner-editable Word templates |
| AI billing | **API keys with hard spend caps**; Batch + prompt caching | A Max plan is development only — **never** a backend |
| Compliance | Field-level encryption, append-only audit log, WISP; Sprinto/Drata when clients require SOC 2 | ALTA Pillar 3 / GLBA |

Repo: monorepo — `api/ workers/ engines/ screens/ docs/`.

**Settled — do not relitigate:** the workload is **I/O-bound, not CPU-bound** — compiled languages are irrelevant here. Self-hosting is a *cost valve* (PaddleOCR on GPU past ~8–10K orders/mo), not a launch decision. Frontend stays vanilla `.dc.html` + `api.js` for now.

Cost envelope: **$300–600/mo at 2K orders; $3–6K/mo at 20K** in the accuracy-first ensemble config. Accepted.

### Compliance (GLBA NPI + ALTA Pillar 3)

WISP documented · TLS everywhere · encryption at rest (managed PG AES-256) + field-level envelope encryption (DOB/bankruptcy) · append-only audit log (doubles as SOC 2 evidence) · per-tenant retention windows + secure deletion · least-privilege + MFA · vendor due-diligence file for AI subprocessors (zero-retention API tiers; PaddleOCR self-host as the in-house path) · **no NPI in URLs or logs** · `packages/` never in VCS. SOC 2 via Sprinto/Drata when the first client requires it.

---

## 16. Local hardware & the engine bake-off (current work)

The owner has a desktop: **RTX 3060 12GB · i5-12400F · 32GB @ 2666 MT/s · NVMe C: ~160GB free · SATA D: ~718GB free · Windows 11 Pro · CUDA 13.1 ready · virtualization enabled.** Docker and WSL2 **not yet installed** as of the last session.

**Verdict: a legitimately capable dev / bake-off / shadow-mode machine that costs $0.** No component weak enough to block any phase.

- **GPU B+** — 12GB is the redeeming feature: holds PaddleOCR-VL at full precision; Qwen2.5-VL 7B and olmOCR-2 quantized. ~2–3× slower per page than a 4090, but at ~650 Reader-B pages/day that's minutes. VRAM was the constraint; it cleared.
- **RAM A− capacity / C− speed** — 2666 MT/s is slow for a 12th-gen chip; costs ~10–15% on PDF rasterization and preprocessing. Check XMP in BIOS (free fix). Not worth spending on.
- **CPU B** — six P-cores. Only limit: parallel PDF-to-image conversion on a 181-page package. Minutes, not a blocker. The `F` suffix means the 3060 also drives display — close GPU apps during benchmarks.
- **Storage A** — 850GB free is months of runway. Retention discipline (process then delete) matters more than terabytes.

**Models that fit:**
- `Qwen2.5-VL 7B` (4-bit, ~6–7GB) — strongest open vision model in this VRAM class; outputs structured JSON directly; could audition as a **local Reader A**.
- `MiniCPM-V 2.6` (8B, quantized) · `olmOCR-2` (7B, 4-bit) · `Chandra` (9B — tight, not its happy home)
- `Moondream 2` (~2B) — too weak for extraction, but a real candidate for the **page classifier** seat. Local triage = free.
- `PaddleOCR-VL` (0.9B) — degraded-scan specialist, full precision, room to spare.
- Text LLMs for structuring layout text → 132-field JSON: `Qwen2.5 7B` / `Llama 3.1 8B` (4-bit). **This would make the entire Reader B path local — zero API calls, zero NPI leaving the building.**

**Honest quality ladder:** local 7Bs are genuinely good at *reading and structuring*, genuinely weaker at *judgment* — which of three name formats is the grantee, whether stamp language is corrective, R14 multi-factor calls. Expect them to hold on clean mortgages and lose on judgments and ambiguity. **That's not a reason to skip them — it's what the Leaderboard measures.** A local model that wins Georgia mortgages at $0/page while losing Connecticut judgments is *useful*, because routing is per-cell.

**Free win:** local models cost nothing per run, so they can be used wastefully — run Qwen as a *third* reader on every page during the bake-off purely to study disagreement patterns, and generate a cross-model-agreement signal at zero marginal cost.

**Setup sequence (five steps, not yet executed):** WSL2 install → Ollama + model pulls → Docker Desktop → GPU sanity check in WSL → **BitLocker before any real client data.** Native Windows vLLM is pain; don't fight it. Ollama for quick trials, vLLM in Docker for bake-off throughput.

**Immediate goal: a six-engine bake-off on the 20 worst pages** — Gemini, Claude, LLMWhisperer (free tiers) vs PaddleOCR-VL, Qwen2.5-VL, olmOCR (local GPU). One afternoon, one CSV, and the Leaderboard opens with real local-vs-cloud data on the actual worst documents — **before a line of the new backend exists.**

**Shadow mode (P5):** this PC can legitimately be Reader B at current volume. The constraint was never compute — it's that a desktop isn't a server (no uptime story, Windows reboots). For shadow mode, where typists are still the system of record and a missed batch re-queues, that's acceptable. **Two conditions:** (1) bring it inside the WISP boundary — BitLocker, hardened login, process-then-delete; (2) design for its absence — it's just `paddleocr-vl @ http://lan-ip:8000` in the registry, and if it's off the router falls back to LLMWhisperer's API. Reader B's seat has an understudy by design.

**Cutover (P6):** it retires to dev. Reader B moves to a rented 24GB card — not because it's too slow, but because production needs something nobody trips over. **$0 GPU spend until then.**

---

## 17. Build plan

**P0 (wk 1) — all parallel:**
- ✅ 12 senior questions — **CLOSED** (R13–R24)
- **R15 audit**: grep every lien-suppression path; add CI assertion v14
- **Reviewer session protocol doc** (blocks typist start)
- Select 50 blind-fifty orders (stratified by jurisdiction, judgment-heavy weighted)
- **20-worst-pages bake-off** across all roster engines (free tiers + local GPU) → CSV → first Leaderboard data
- Repo skeleton: `api/ workers/ engines/ screens/ docs/`

**P1 (wk 1–2) — foundation:** FastAPI port module-by-module *behind the existing contract* · Postgres + `tenant_id` + RLS + Alembic · Procrastinate · engine registry + pdftotext and Tesseract adapters · Clerk · audit log · field-level encryption · fold R13–R24 into `docs/spec.md` + schema v2 · port 155 tests → target ~200 with ruling validators.

**P2 (wk 2–5) — extraction:** page classifier adapter · Reader A (Gemini) + Reader B (LLMWhisperer) + Claude second-opinion adapters · **RuleContext prompt generation from the rulebook** · ensemble router · Leaderboard v1 · PaddleOCR eval adapter · Shape B renderer · review-screen dual-value + click-to-source wiring.

**P3 (wk 3–5, overlapping) — blind fifty:** typists run under protocol · reconciliation **continuous, not batched** (watch the lag signal) · golden set grows · PENDING rules → weekly engineer confirmations.

**P4 (wk 6) — verdict:** all engines vs blind fifty. Leaderboard decides seats (human-approved). Go/no-go per section per jurisdiction. **Three acceptable outcomes:** auto-confirm at threshold / draft-for-review only (still a 5–10× typist speedup) / section-specific holds with known causes.

**P5 (wk 6–10) — shadow mode:** pipeline alongside typists on live orders · thresholds calibrated **empirically** · complaints wired · probes live · cost ledger validated.

**P6 — cutover:** jurisdiction-by-jurisdiction, highest accuracy first. Typist capacity redeploys to review + blind-set expansion.

### The critical path is not code

Three dependencies with humans in them: the senior answers (**now closed**), the blind fifty (two weeks of typist calendar time — **can start before extraction exists**), and extraction accuracy itself (unknown until the first two land; the entire business case rests on this number).

---

## 18. Acceptance criteria (release gates — each testable)

- **Ingest:** rejects an incomplete package **naming the missing fields**; duplicate detection on sha256; accept is explicit + logged.
- **Extraction:** every field has `engine_id` + page + snippet; per-call cost recorded; adapter test suite green per engine; classifier ≥98% recall on relevant pages.
- **Router:** zero auto-confirms with failing validators (**CI-enforced**); judgments 100% routed to review; disagreement always surfaces both values + coordinates.
- **Review:** confirm is idempotent (bug-5); corrections require a reason; 4-pass auto-escalation fires; **no throughput counters anywhere**.
- **Rules:** escalation resolve refused without a rule; PENDING cannot affect the pipeline until confirmed; **a rule change regenerates prompts** (test: change R18 text → prompt diff appears for all engines).
- **Blind fifty:** typist endpoints **physically cannot** return model output or the other seat's entries (**security test, not a UI test**); TYPE gate server-enforced; reconciliation requires a citation.
- **Golden:** corrections require source + reason; log immutable; ORDER_SUPPLIED absent from all denominators.
- **Render/Delivery:** R16's seven triggers unit-tested; LP pairs render; v1 + v2 both retained; delivery timestamps on every send.
- **Compliance:** RLS enforced via non-owner role (test: cross-tenant query returns **zero rows**); audit rows on every NPI access; encrypted fields unreadable in raw dumps.
- **Tests:** ≥200 green; assertions v1–v14 in CI; **v99 remains deliberately empty.**

---

## 19. Known bugs already fixed (do not regress)

Five fixes, 24 tests — `fix_segment.py`, `fix_assemble.py`, `fix_api.py`:

1. **Undated subordination vanishing** (segment.py) — null-date sentinel sort. An instrument with no recorded date must not disappear from the report.
2. **MERS phantom marked resolved** (assemble.py) — MERS-aware release resolution. A MERS nominee instrument is not a resolving instrument.
3. **Premature chain termination on multi-encumbrance chains** (assemble.py) — reference-doc-verified termination.
4. **Inconsistent name routing** (api.py) — token-sorted name normalization. Identical strings routed differently through `needs_review`. **This normalizer is now the shared canon for `agree()` in the ensemble router.**
5. **Non-idempotent approve returning 409 on double-submit** (api.py) — idempotent confirm.

### The 644 MB incident

A **bare relative path** in the ingest module silently wrote every real uploaded file into the working tree on every test run, producing a 644 MB archive. Paths are absolute and configured. `packages/` is gitignored. **Never write uploads into the repo.**

---

## 20. Risks

1. **Judgment ground-truth thinness** → never auto-confirm in v1; over-sample in blind fifty; partial automation is still the product.
2. **R15 regression** → P0 audit + v14 assertion.
3. **Degraded/handwritten pages fail all engines** → routed to humans by design; `PRESENT_UNREADABLE` is an honest answer.
4. **Ensemble cost** → accepted per the accuracy-first mandate; Leaderboard cost column + Paddle self-host valve past ~8–10K orders.
5. **Vendor drift** → the entire architecture is the mitigation.
6. **Rule drift by state (R15/R20)** → jurisdiction scope on rules + escalation channel.
7. **Two-person team overload** → phases sized; queue + managed everything; **nothing exotic.**

---

## 21. Open items

Reviewer session protocol doc (P0) · **R15 audit (P0)** · WSL2/Docker install + six-engine bake-off (P0, in progress) · Shape B renderer (P2) · `tenant_id`/RLS (P1) · blind fifty execution (P3) · **EXCEPTIONS schema-vs-prose ruling** · number of report shapes beyond two · full order field list (never supplied) · Anchorage deceased-owner + Ch 11 bankruptcy handling · leasehold + populated tax lien coverage · SOC 2 (deferred to client demand) · client portal (separate product).

---

## 22. How to work on this codebase

- **The backend is upstream of the UI, not downstream.** The rules that make this system correct are not visible in any screen — they came out of ten real search packages and twenty-four rulings. A backend regenerated from the UI will look right, encode none of them, and **pass its own tests**. **Never generate a backend from the designs.** The 15 built `.dc.html` components + `api.js` call the real contract in §7.
- **Tests are the safety net for the FastAPI port.** 155 green. Port module-by-module behind the existing contract. Target ~200 with ruling validators.
- **A failing test is not automatically a code bug.** Several "defects" found during prototyping turned out to be correct behavior per a later ruling. **Check the rulebook and the provenance tag before "fixing" assembly output.** `DERIVED` rules especially: if one breaks, ask before assuming a bug.
- **Never write uploaded files into the repo.** See §19.
- **When you can't cite it, don't emit it.** See principle 6.
- The owner communicates in compressed, non-linear bursts and expects full project state carried between turns. Terse answers are answers, not disinterest.

---

## 23. Reference material

- `docs/spec.md` — the 18-section extraction spec, every rule provenance-tagged. **Folding R13–R24 in is a P1 task.**
- `docs/rulings_2026-07.md` — full text of R13–R24 + implementation impact.
- `titlepipe_PRD_full_v2.1.md` — the build-ready PRD (Product / System / Execution). *(Saved in this repo as `docs/PRD.md`.)*
- Stack research report (July 2026) — architecture decisions with verified pricing.
- 15 screen briefs + built `.dc.html` components + `api.js`.
- `titlepipe.seed` — seed golden-set DB.
- Reference packages in project: **DL-26-2219** (McIntosh Co., GA — estate → LLC, open DTS + scrivener's affidavit) · **CSSKY-640347** (Fayette Co., KY — no open mortgage, 3-deep chain) · **4167944-1** (Hartford Co., CT — HUD special warranty) · **41660271** (CA — trust vesting, DOT with two assignments). Wider corpus: GA (McIntosh, Houston, Clayton), KY (Fayette), CT (Hartford), CA (San Diego), NY (Greene), NC (Mecklenburg), AK (Anchorage), OH (Wheeler St).

**Screens (15):** Ingest · Queue · Review · Escalation Inbox · Ops Dashboard · Derived Drill-down · Account layer (login/settings/admin/billing) · Delivery · Complaints · Golden Set Capture · Extraction Bench · Bench Results · Blind Fifty Typist · Reconciliation · Seed Correction · Blind Fifty Status · **Engine Leaderboard** (#15).

# TITLEPIPE — PROJECT MEMORY / HANDOFF PROMPT
# Paste this into any new session to restore full context. Last updated: July 17, 2026.

You are picking up TitlePipe, a title-search report automation product. Everything below is settled unless marked OPEN. Do not re-litigate closed decisions; extend them.

---

## 1. THE BUSINESS

Title abstracting shop, ~2,000 orders/month, target 20,000. Senior typists hand-type Abstractor Call Back Sheets from county search packages (PDFs, 36–181 pages, mostly scans: clean modern prints, degraded 1980s–90s faxes, microfilm, third-gen photocopies, handwritten stamps/notations). 40–60 min/order. No formal QC ever; defect rate quoted from memory as "1–2 per hundred"; sampling found 7 material defects in 6 of 10 delivered reports (5 on machine-readable pages). Data contains GLBA NPI: names, addresses, DOBs, bankruptcies. ALTA Pillar 3 (WISP) applies.

Product: machine extraction + human review of uncertain fields only + measured quality + timestamped delivery. Typing → <10 min review. Zero SHIPPED defects (not zero errors — errors route to humans; only multi-verified fields ship untouched).

## 2. WHAT EXISTS (validated prototype phase — v1)

- **Backend prototype:** Python/Flask/SQLite, ~2,700 lines, **155 passing tests**. **[Gate 0, 2026-07-22 — RECOVERED, held outside VCS; see `docs/backend/GATE_0_RECOVERY.md`.** Measured: 2,786 lines; 155 = 131 package tests + 24 patch tests, of which **145 run green** and 10 need client source material that stays out of VCS. Two corrections to this paragraph: the five bug fixes are **standalone patches never merged** into the package, and `models.py` defines **three** NA reasons — `NOT_USED_IN_JURISDICTION` / `NOT_FOUND` / `NOT_STATED` — **not** the `NOT_PRESENT` / `PRESENT_UNREADABLE` pair named below. The taxonomy needs a ruling before Gate 6 writes the field model.**]** Modules: models.py (Field with provenance envelope; TWO NA states: NOT_PRESENT vs PRESENT_UNREADABLE), validators.py (13 CI assertions incl. v99 = deliberately empty: land+building must NEVER be checked against total — known defect in delivered reports), segment.py (recording-stamp parser, 4 independent checks), assemble.py (chains, MERS, releases), render.py (Shape A docx, programmatic: TRUSTEE deleted not blanked, CONDO rewritten not filled), api.py (Flask+SQLite), ingest.py, golden.py.
- **Five bugs found and FIXED** (files delivered as titlepipe_bugfixes.zip): (1) undated sub vanished from overlap validator → flagged NO_DATED_DATE, sorted last, never dropped; (2) MERS phantom marked OK → release grantor checked against MERS AND underlying lender from nominee clause, else MERS_PHANTOM_RISK; (3) chain stopped at first release → requires release.reference_doc == security_deed.doc_number; no reference → RELEASE_NO_REFERENCE, chain stays open; (4) needs_review routed identical names differently → normalize_name(): uppercase, strip apostrophes, punctuation→space, TOKEN-SORT (handles last/first vs first/last); (5) approve returned 409 on double-submit → idempotent: same value = 200, different value = 409 w/ message, terminal state = 409.
- **15 screens designed AND built** as .dc.html components + shared api.js, calling the REST contract with MSW-style demo fallbacks. All in the design tool. Screens: Ingest, Reviewer Queue, Review, Escalation Inbox, Ops Dashboard, Account layer (Login/Me/MyOrg/People/Rulebook/Audit/Retention/Billing), Delivery, Complaints, Golden Set, Extraction Bench, Bench Results, Blind Fifty (typist), Reconciliation, Seed Correction, Blind Fifty Status. Screen #15 Engine Leaderboard is specced in PRD, not yet built.
- **Seed bench:** 131 fields, 6 orders, provenance-tagged: delivered_report / ruled / delivered_report_suspect / ORDER_SUPPLIED (excluded — e.g. location.zip: client-supplied 03029 vs deed's 30296; order wins; NEVER an extraction target). Known seed issue: mortgages.1.amount seed $202,224 vs model $220,224 — fax artifact, words-line legible; likely seed wrong (typist read degraded numeral). Rule §5: amount-in-WORDS prevails over numerals.
- **Recurring failure shape, caught 6 times:** "a value with nothing behind it, presented confidently, pointing somewhere wrong." The entire architecture exists to catch this: provenance on everything, no confidence without source.

## 3. THE RULEBOOK — 24 LIVE RULES (docs/rulings_2026-07.md has full text)

R1–R12 (elicitation): deed field sourcing · assessment priority · consideration never derived from transfer tax · re-recording as one mortgage block · chain terminator purchase test (contemporaneous purchase-money mortgage OR excise/transfer tax above nominal; confirmed 10/10 packages) · judgment counting · mortgage counting · release handling · recorded-date ordering · CONDO/PUD from rider checkboxes · non-person name derivation · copies-of-chains flag.

R13–R24 (ALL 12 senior questions ANSWERED July 2026 — the 3-session blocker is CLOSED):
- **R13** Judgments: report only ACTIVE+ENFORCEABLE against subject owner. Canceled/satisfied/vacated/released/duplicates suppress with reason. Status unknown → needs_review. (Solved the 10M006178-590 mystery: dropped because status=Canceled 05/27/2010, NOT party identity.) NEW FIELDS: judgments[].status, status_date.
- **R14** Re-recording: execution-details match + corrective language in body (strongest evidence: "re-recorded to correct...", "Corrective Mortgage") + recording cross-ref. VETO: substantive change (amount/parties/rate) = modification or new instrument, never re-recording.
- **R15** ⚠ LIENS SURVIVE arm's-length sale. Chain termination sets SEARCH DEPTH, never lien disposition. Suppress a lien ONLY on verified release. New CI assertion v14 enforces. AUDIT REQUIRED on any suppression path (P0 task).
- **R16** Release visibility: full+whole-property+clean → suppress (chain-closer). ANY of 7 triggers → render: partial release, partial satisfaction, exceptions/reservations, corrective, one-of-multiple, operative clauses (assignment/subordination/indemnity), explains-a-title-issue.
- **R17** Chain terminator SKIPS non-arm's-length (gift/family/no-consideration/no-tax); continue back to last bona fide purchase. Indicators: relationship, deed type, PM mortgage presence, tax recitals/exemptions.
- **R18** Judgment amounts: ORIGINAL always (amount of record); current balance ONLY if in official record, labeled as-of search date; examiner NEVER computes interest. Validator: balance without citation = hard fail.
- **R19** Modification = separate linked recorded entry; original DOT persists; never overwrite original amount.
- **R20** UCC: collateral description DECIDES; fixture-filing type + real-property refs + county land-records recording support. Personal-only → suppress. Ambiguous → needs_review. (State-law dependent.)
- **R21** PROPERTY/recording county always, never execution/notary county ("follow the land"). Ack-block county is a known distractor — capture separately.
- **R22** Lis pendens PERSISTS after dismissal; release/withdrawal renders as linked pair. Only expungement removes. (Opposite of mortgage-release pairs.)
- **R23** Substitution of trustee = own chain line, own recording info, linked to DOT.
- **R24** Segmentation boundary = DOCUMENT STRUCTURE never page breaks. End = legal description + signatures + acknowledgment + recording info. New doc = new title/stamp/instrument#/parties. Verbatim into segmentation prompt.

Rule channels: spec · escalation resolutions · reconciliation rulings · complaint fixes → ONE rulebook, versioned, origin-tagged, jurisdiction-scoped; PENDING rules gated on engineer confirmation. Prompts are GENERATED from the rulebook (RuleContext) — rule change propagates to all engines, no per-engine prompt surgery.

## 4. ARCHITECTURE (PRD v2.1 = titlepipe_PRD_full_v2.1.md, the build document)

**Core principle: engine-agnostic.** Extraction engines are plug-in competitors behind ONE interface (ExtractionEngine protocol: read_page → PageReading, extract_fields → FieldSet; adapters ≤300 lines; cost+latency per call; engines never see each other's output; config-registry, no deploy to enable).

**Zero-shipped-defect ensemble:** Reader A (vlm_image, Gemini 2.5 Flash) ∥ Reader B (ocr_text, LLMWhisperer high_quality → LLM structuring). Per field: A==B (canonical comparison via the bug-4 normalizer) ∧ redundancy checks (§5 words>numerals, cross-instrument refs) ∧ validators → AUTO-CONFIRM; else review queue showing both values + Reader B's line coordinates (click-to-source). High-stakes fields (amounts, legals, judgment TYPE/STATUS) additionally need Claude second-opinion. JUDGMENTS NEVER AUTO-CONFIRM in v1 (gate = blind-fifty coverage ≥40 judgment fields, not rules). Engine self-confidence NEVER gates (documented miscalibrated) — routing signals ranked: A/B disagreement > redundancy failures > Tesseract region confidence > self-confidence.

**Two-stage cost control:** ~90% of pages carry no target fields → Flash-Lite classifies all pages (≥98% recall required), expensive extraction only on ~10%.

**Launch engine roster:** pdftotext (born-digital, free) · Gemini 2.5 Flash-Lite (classifier) · Gemini 2.5 Flash (Reader A) · Claude API (second opinion) · LLMWhisperer high_quality (Reader B: layout text + line coords + confidence metadata; free tier 100 pages/day; VPC self-host exists for PII path) · PaddleOCR-VL 0.9B (Reader-B challenger, best degraded-scan open model, self-host path) · Tesseract (confidence oracle only, never reader of record). Local candidates on user's GPU: Qwen2.5-VL 7B q4, MiniCPM-V, olmOCR-2 q4, Moondream (classifier candidate).

**Engine Leaderboard (screen #15):** engine × section × jurisdiction vs golden set, accuracy by tag class + cost/1K pages + p95 latency. Seat changes human-approved, logged with evidence. Per-cell routing (engine can win GA mortgages, lose CT judgments). NO TRUTH YET cells where coverage thin. No auto-promotion, no aggregate headline.

**Services (full-freedom decision, polyglot with reason-per-language):** core-api (TypeScript, Hono/Bun — one language DB-to-pixel with web, kills codegen) · extraction-svc (Python — AI ecosystem lock) · pdf-svc (Rust or Go — rasterization is the one CPU-bound parallel hot path) · render-svc (Python — docxtpl lock) · blind-svc (tiny TS — BLINDNESS BY NETWORK TOPOLOGY: no route/grant/code-path to model output) · inference-svc (GPU). Six services, deploy as 3 units until scale argues. Postgres = single source of truth (schemas per service). REJECTED: Kafka, service mesh, gRPC-everywhere, microservices-for-their-own-sake.

**Quality stack:** Seed bench (above) · Blind fifty: 50 orders stratified by jurisdiction judgment-heavy, two typists STRUCTURALLY blind (UI+service enforced), three-part field contract (value+source+certain/probable/unclear; "unclear with source" is legitimate; confident guess is the poison), judgment TYPE second-pass gate; continuous reconciliation (symmetric layout, citation required — "a ruling with no source is an opinion", general rules offered never pre-selected → PENDING) · Probes (planted defects; catch_rate is THE dashboard headline, ungameable) · Complaint loop (per-field; grouped by how-it-got-through: auto-confirmed complaint = threshold wrong, no human saw it; resolution = fix + rule + free golden-case offer).

**Design register (all screens):** dark, CI-output quiet, scan/document dominant, amber=attend hot-red=actionable dimmed=recede, no aggregate headlines, no throughput counters ANYWHERE (per-reviewer throughput doesn't exist as data), no gamification, refusals are product requirements → become Playwright tests. Reviewers never see the dashboard.

## 5. TECH STACK (all researched & verified July 2026)

**Backend:** FastAPI port of Flask (155 tests as safety net; Pydantic = schema as code) — though core-api may go TypeScript/Hono per services decision; extraction stays Python regardless · Managed Postgres (Render or Neon) + tenant_id EVERY table + RLS backstop (app connects as non-owner role, SET LOCAL app.current_tenant, composite indexes tenant_id-leading) · Procrastinate (Postgres-native queue; transactional enqueue; graduate to Celery+Redis only on saturation) · Cloudflare R2/DO Spaces (zero egress) · Render hosting · Clerk auth (free to 50K MRU; sessions; tenant_id in token) · docxtpl + programmatic Shapes A & B (Shape B = "Wheeler St shape", assessed straightforward, not yet built).

**Frontend (v2, decided this session):** React 19 + TypeScript strict + **Vite 8** (stable Mar 2026; TanStack Start is RC — documented upgrade path in ADR, NOT a dependency; Next.js rejected for internal app, reserved for future client portal) · TanStack Query v5 + Router (type-safe routes/search-params) + Table (headless) + Virtual · Tailwind v4 + shadcn/ui (components copied into repo, themed to dark register) · react-hook-form + Zod · Zustand (tiny: keyboard mode, panels) · react-hotkeys-hook (one-key-per-action is a product requirement) · react-pdf/pdf.js + CUSTOM coordinate-overlay component (built once, used in Review/Bench/Reconciliation/Seed Correction; renders LLMWhisperer line coords as click-to-source) · Vitest + Playwright (blindness/refusals as tests) · pnpm workspaces: apps/web, apps/portal(future), packages/contract (Zod schemas = shared source of truth, future core-api imports directly — NO codegen), packages/ui (tokens), packages/mocks (MSW; migrate api.js demo data).

**Frontend-first strategy:** contract as Zod in packages/contract → MSW serves it with demo data → entire UI built/usability-tested against mocks including weird states → core-api lands later, delete MSW handlers route by route. Build order: foundation week (scaffold+tokens+PDF-overlay+Queue) → Review (flagship) → Ingest/Escalation/Dashboard → measurement suite → Account layer. The 15 .dc.html files are the pixel/behavior SPEC — re-platform, not redesign.

**AI billing:** API keys with HARD spend caps (retry loop on 181-page package = classic bill surprise) + Batch API (−50%, workload is batch-shaped) + prompt caching (−90% on repeated schema). Claude Max plan = DEVELOPMENT ONLY, never product backend (policy: OAuth restricted to official clients; products must use API keys; also economically absurd). Gemini 2.5 Flash $0.15/$1.25 per M tokens; Flash-Lite $0.10/$0.40; Claude Haiku 4.5 $1/$5; Sonnet 4.6 $3/$15. Two-stage ≈ $0.30–0.60/1K pages.

**Budget (optimized):** build ~$230/mo · shadow @2K orders ~$200–250/mo (Max→$100 tier after build; AI $40–90 w/ batch+caching; accuracy-first w/ LLMWhisperer HQ adds ~$300) · @20K ~$650–1,100/mo (accuracy-first $3–6K; self-host valve past ~8–10K orders). Tech cost $0.03–0.30/order vs typist $8–15/order — review labor dominates, so router quality > API pennies.

**Compliance:** WISP, TLS, AES-256 at rest, field-level envelope encryption (DOB/bankruptcy), append-only audit log, per-tenant retention + secure deletion, vendor due-diligence file (zero-retention API tiers; self-host = subprocessor elimination), no NPI in URLs/logs, packages/ gitignored WITH comment. SOC 2 via Sprinto/Drata (~$6–8K/yr) when first client demands.

## 6. HARDWARE (user's PC — dev + bake-off + shadow-mode Reader B)

i5-12400F (6C/12T) · 32GB DDR4-2666 (check XMP for free 3200) · RTX 3060 12GB, driver 591.86, CUDA 13.1, ~1GB idle eaten by desktop apps (close D5/Epic/Adobe before runs) · C: 476GB NVMe (160 free — models fit, don't hoard packages) · D: 932GB SATA HDD (archives only) · Win 11 Pro, HypervisorPresent=True (no BIOS trip needed) · WSL NOT installed · Docker/Ollama NOT installed · Python is the Microsoft Store stub (use WSL's) · git+node real · BitLocker AVAILABLE but OFF (required before real client NPI touches disk; not needed for 10 samples).

Setup sequence: (1) admin PowerShell `wsl --install` + reboot; (2) Ollama for Windows, `ollama pull qwen2.5vl:7b`, `ollama pull minicpm-v`; (3) Docker Desktop WSL2 backend; Ubuntu: `sudo apt install python3-pip poppler-utils`, `pip3 install paddlepaddle-gpu paddleocr --break-system-packages`; (4) verify `nvidia-smi` inside WSL; (5) BitLocker before client data; (6) C:\bakeoff\pages\ with 20 worst pages as PNGs. Verdict: B+ machine, A value — carries dev/bake-off/shadow free; GPU rental ($150–250/mo 4090-class) only at cutover or ~8–10K orders. 12GB fits Paddle full-precision, Qwen 7B/olmOCR quantized.

## 7. KEY RESEARCH VERDICTS (don't re-research)

- Compiled languages for the pipeline: NO — I/O-bound system, speed lives in model latency + reviewer queues. Exception: pdf-svc sidecar.
- Tesseract as primary: NO (garbage on degraded scans) — YES as free confidence oracle.
- LLMWhisperer: YES as Reader B — not for layout-text-to-blind-LLM (VLMs see images) but as INDEPENDENT second reader with uncorrelated failure modes (OCR errors obvious, LLM errors plausible — disagreement is the alarm), plus line coordinates for click-to-source and confidence metadata. Hybrid image+OCR-text prompting is documented (F1 .997 study). Cost HQ ~$15/1K pages on the 10%.
- Paddle vs LLMWhisperer: near-tie on reading degraded scans (Paddle benchmark-verified, LLMW vendor-verified); LLMW = finished product (coords/confidence/webhooks/zero ops), Paddle = better-verified engine you build around + flat-cost + PII-home. Sequence: LLMWhisperer now, Paddle at scale/compliance-push. Same seat, swappable occupant.
- "Zero error rate" doesn't exist — zero SHIPPED defects via ensemble+redundancy+human routing does.
- Managed Doc-AI (Textract etc.) as primary: NO — $30–50/1K structured, worse on degraded scans; keep as optional confidence oracle.
- Handwriting/cursive + worst microfilm: fails ALL engines 2026 — human routing + PRESENT_UNREADABLE is the honest answer.

## 8. PHASES & STATUS

- **P0 (NOW, all parallel):** R15 lien-suppression audit + v14 assertion · reviewer session protocol doc (BLOCKS typists) · 5 usability sessions on built screens w/ real reviewers (3 days; feeds protocol + v2 latency bar) · pick 50 blind-fifty orders · machine setup + 20-worst-pages six-engine bake-off → first Leaderboard CSV.
- **P1 (wk1–2):** service-layout repo · Postgres+tenant_id+RLS+Alembic · Procrastinate · engine registry + pdftotext/Tesseract adapters · Clerk · audit log · field encryption · fold R13–R24 into spec + schema v2 · 155→~200 tests.
- **P2 (wk2–5):** Track A extraction (classifier, Readers A/B, second-opinion, router, Leaderboard v1, RuleContext prompt-gen, Shape B) ∥ Track B v2 UI (foundation wk: scaffold+tokens+PDF-overlay+Queue → Review → rest).
- **P3 (wk3–5):** blind fifty runs; continuous reconciliation; PENDING confirmations weekly.
- **P4 (wk6):** VERDICT — all engines vs blind fifty; seats decided; go/no-go per section×jurisdiction. Three acceptable outcomes (auto-confirm at threshold / draft-only = still 5–10× speedup / section holds with known causes).
- **P5 (wk6–10):** shadow mode alongside typists; empirical thresholds; probes live; complaints wired; user's 3060 legitimately = Reader B.
- **P6:** cutover jurisdiction-by-jurisdiction, best first; 3060 retires to dev.

**IMMEDIATE NEXT ACTION:** `wsl --install` (admin PowerShell) → reboot → report `nvidia-smi` from Ubuntu → then write the six-engine benchmark harness. Frontend scaffold is the other ready-to-go thread (user chose frontend-first): pnpm workspace + contract package + MSW + tokens + Queue screen.

## 9. DELIVERED FILES (this chat)

titlepipe_bugfixes.zip (fix_segment.py, fix_assemble.py, fix_api.py — 24 tests) · rulings_2026-07.md (R13–R24 full text + implementation impact) · titlepipe_PRD.md (v1) · titlepipe_PRD_v2.md · **titlepipe_PRD_full_v2.1.md (THE build document: data model, API contract, acceptance criteria/release gates)** · stack research report (artifact) · LLMWhisperer research (inline w/ citations). Prior sessions: 15 .dc.html screens + api.js + support.js in design tool; docs/spec.md (18 sections); seed DB (titlepipe.seed).

## 10. OPEN ITEMS

Session protocol doc (P0) · R15 audit (P0) · usability sessions (P0) · blind-fifty order selection (P0) · machine setup (P0) · Engine Leaderboard screen build · Shape B build (P2) · frontend scaffold (ready) · benchmark harness (waiting on WSL) · SOC 2 (on client demand) · client portal (separate product, Next.js candidate) · tenant_id/RLS implementation (P1).

## 11. VOICE & WORKING STYLE (match this)

Direct, technical, no cheerleading. The user says "lets build/cook" — bias to producing artifacts over discussing. Challenge wrong assumptions plainly (subscription-as-backend, zero-error-rate, OCR-saves-money were all corrected with math). Ground claims in their actual documents (Greene fax, Karimi chain, Wheeler St). The project's soul: "the review half assumes the machine is sometimes wrong; the measurement half assumes the people are sometimes wrong" — and every structure exists to catch one specific way a number could lie.

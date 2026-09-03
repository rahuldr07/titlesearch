# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the Reviewer.** An examiner working the Queue and Review screens, confirming or
correcting machine-extracted fields against scanned county documents. When roles conflict,
design for the Reviewer. They carry the product's central goal — 40–60 minutes of typing per
order becomes under 10 minutes of review.

Five secondary roles, each owning distinct screens (`docs/PRD.md` §5). Roles are named by job:

| Role | Owns | Notes |
|---|---|---|
| Reviewer | Queue, Review | Confirm/correct/flag/escalate fields. **Never sees dashboard or throughput data.** |
| Senior | Escalation Inbox, Reconciliation, Seed Correction | Rules with citation; drafts general rules as PENDING |
| Ops lead | Dashboard, Delivery, Complaints, Blind Fifty Status, Ingest | Accepts packages, resolves complaints |
| Engineer | Extraction Bench, Engine Leaderboard, Bench Results, Rulebook | Confirms PENDING rules, approves engine seats |
| Typist (temp) | Blind Fifty capture | Structurally blind to model output and to other typists |
| Owner/Admin | Account layer (Me, My Org, People, Rulebook, Audit, Retention, Billing) | All of the above plus tenant admin |

**Per-reviewer throughput does not exist as data anywhere in the system.** This is a deliberate
product decision, not an unbuilt feature.

## Product Purpose

A US nationwide title-abstracting shop takes orders from lenders, attorneys, and real-estate
companies for a property's legal history. It requests a search from a county, receives a
**search package** (36–181 page PDF, mostly scans), and a senior typist hand-types a structured
report — the **Abstractor Call Back Sheet** — in Word.

TitlePipe replaces the typing: machine extraction → human review of uncertain fields only →
measured quality → timestamped delivery.

Success means typing time becomes review time (under 10 minutes per order) and defects reach
zero **on auto-confirmed fields**. Current scale is ~2,000 orders/month against a target of
20,000. Internal use first; SaaS later.

## Positioning

**The package is the database.** There is no system of record to read from — every field on the
sheet is extracted from the documents the abstractor pulled. This is not "fetch and populate,"
and any design that assumes a queryable source of truth is wrong at the foundation.

The durable product is the **arena + golden set + rulebook**, never a vendor. Extraction engines
are plug-in competitors behind one interface, scored on one bench, routed by measured wins. A
competitor could copy the extraction; they could not copy the accumulated rulebook or the
measured golden set.

Quality had never been measured before this product existed. Sampling found **7 material defects
across 6 of 10 delivered reports — 5 of them on machine-readable pages** (`docs/CONTEXT.md` §12).
Those seven are the golden-set seed.

## Operating Context

Examiners read scanned county documents for extended sessions — deeds, mortgages, clerk stamps,
sometimes handwritten or degraded pages. The work is comparison: a machine-proposed value beside
the source image it came from, with the citation reachable.

- **Desktop today** (`min-width: 1360px`, `apps/web/src/styles.css:59`). Tablet is a plausible
  future and should not be designed against; mobile is not a target.
- Documents are 36–181 page PDFs, mostly scans, with variable text-layer coverage.
- The order itself is a first-class input, not derivable from the package.
- Team is two engineers plus the owner, who is the domain expert.

## Capabilities and Constraints

**Confirmed functionality.** Package ingest → extraction by competing engines → per-field
confidence and provenance → review queue of uncertain fields only → escalation to a Senior who
rules with citation → rulebook entry → assembled report → timestamped delivery. 24 live rules
(`docs/CONTEXT.md` §9). Extraction schema v2. Report shapes A, B, and docxtpl client templates.

**Constraints that future work must not break:**

- **Every value carries provenance** — source doc, page, snippet, engine, rule refs. A value that
  cannot be cited is not emitted. Confidence without provenance routes to review.
- **Two NA states, never collapsed** — `NOT_PRESENT` and `PRESENT_UNREADABLE` are different
  facts. `needs_review` is never derived from `value === null`.
- **The server owns all state machines and thresholds.** The UI never computes state from
  confidence, never re-derives counts, chain termination, or release resolution.
- **Escalation resolution is refused without a rule.** PENDING rules cannot affect the pipeline
  until an engineer confirms them.
- **Judgments never auto-confirm in v1.** Engine self-confidence never gates auto-confirm.
- **Engines never see each other's output.** Blindness is enforced in the API, not by policy.
- **Refusal wording is authored by the server.** The client never composes refusal text.
- Provenance tags are `RULED` / `DERIVED` / `OPEN` / `CONFLICT`. Work does not proceed past `OPEN`.

**Anti-patterns deliberately designed out** (`docs/CONTEXT.md` §14) — reintroducing any is a
defect, not a feature request: throughput counters anywhere, probe visibility, an aggregate
accuracy headline, auto-tuning, approve-all, queue cherry-picking.

**Non-goals for v1:** client self-serve portal, auto-tuning, report shapes beyond A/B/docxtpl,
handwriting and cursive automation (routes to humans), judgment auto-confirm before blind-fifty
coverage, SSO/enterprise auth, multi-region.

**Undecided and recorded as such:** the browse/All-Orders screen conflict
(`docs/frontend/design-2026-08/CONFLICT-all-orders.md`) and the open rulings in
`docs/frontend/open-rulings.md` are unresolved product questions, not implementation gaps.

## Brand Commitments

- Product name: **TitlePipe**. Domain term: **Abstractor Call Back Sheet**.
- A binding visual specification already exists and is authoritative: warm-paper palette, IBM
  Plex, fourteen numbered design rules, with colors expressed only through tokens. Recorded here
  as a constraint; the specification itself lives in `docs/frontend/design-2026-08/` and
  `apps/web/src/styles.css`.
- Voice on refusals is a product rule, not a style choice: the server states why something is
  blocked, and every disabled control carries that reason.

## Evidence on Hand

- **Real defect data**: the seven confirmed defects seeding the golden set (`docs/CONTEXT.md` §12).
- **Real domain traps**: `docs/CONTEXT.md` §11, explicitly not derivable from code or screens.
- **Real rulings**: 24 live rules; R13–R24 are senior-examiner rulings from July 2026.
- **Real contract fixtures**: `contract-fixtures/`, parsed against Zod schemas in tests.
- **Design specification**: `docs/frontend/design-2026-08/`, plus archived `.dc.html` pixel specs.

**Absences future work must not fabricate:** no customer testimonials, no benchmark results, no
pricing, no case studies, no press. Accuracy has never been published as a headline number and
an aggregate accuracy figure is an anti-pattern, not a missing asset.

## Product Principles

1. **A value with nothing behind it is the enemy.** Provenance on everything. This exact failure —
   a confident value with no basis — was caught six separate times during prototyping; the
   architecture exists to catch it forever.
2. **Zero shipped defects, not zero errors.** Errors are inevitable; shipping them is not. A field
   auto-confirms only when independent engines agree AND redundancy rules pass AND validators
   pass. Everything else gets human eyes.
3. **Every answer produces a rule.** Escalations, reconciliation, and complaints all terminate in
   rulebook entries. The same question is never asked twice.
4. **Humans approve promotions.** No threshold, engine seat, or rule goes live without a named
   person's sign-off, logged.
5. **Accuracy first, cost second.** An explicit owner mandate. Cost optimization was considered
   and rejected as the primary goal; the ensemble is not to be optimized away.

## Accessibility & Inclusion

**Self-imposed WCAG 2.2 AA.** No external mandate, client contract, or regulation requires it.
The team adopted it because examiners read scanned documents for long sessions, and it stays
because it catches real defects — contrast failures in the card header and form label were both
found by the gate rather than shipped.

It is enforced, not aspirational: axe runs at `error` on every Storybook story, contrast ratios
are measured and recorded where the visual spec and WCAG disagree, and WCAG 2.2 §2.5.8 target
minimums are met by expanding hit areas rather than drawn elements.

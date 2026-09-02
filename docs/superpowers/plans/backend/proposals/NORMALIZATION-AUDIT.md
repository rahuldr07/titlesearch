# NORMALIZATION AUDIT — the pass all three proposals missed

**Scope:** every table proposed in `PROPOSAL-A-minimal.md`, `PROPOSAL-B-full.md`,
`PROPOSAL-C-evidence.md`, plus the tables `REVIEW-adversarial.md` says are missing.
**Method:** state the candidate key, the functional dependencies (FDs), and the highest
normal form each table satisfies — then rule on the four places where the schema is
*not* in a normal form and somebody has to decide whether that is correct.

**Provenance of this document's own premise:** `grep -i -E '1NF|2NF|3NF|BCNF|normal form'`
across the four proposal documents returns zero hits. The proposals do the substance
implicitly — composite FKs `(tenant_id, x)` throughout, and dense `NOT NULL`/`CHECK` use in
their DDL — and never name a normal form. That is not a cosmetic omission: three of the six
findings below are only visible if you write the FDs down.

**Recount, and what population the numbers describe.** An earlier draft of this paragraph
cited "341 `NOT NULL`, 56 `CHECK`". Those are counts of *proposed* DDL text in
`PROPOSAL-A-minimal.md` + `PROPOSAL-B-full.md` + `PROPOSAL-C-evidence.md`, summed across
three mutually exclusive alternatives. They are **not** properties of any schema, shipped or
chosen — no one proposal contains them, and adopting one proposal cannot yield their sum.
Recounted per source:

| Population | `NOT NULL` | `CHECK` |
| --- | ---: | ---: |
| Proposal A (matching lines / raw occurrences) | 84 / 84 | 6 |
| Proposal B | 144 / 144 | 24 |
| Proposal C | 111 / 118 | 26 |
| **A+B+C summed** (`grep -c`) | **339** | **56** |
| A+B+C, occurrences inside fenced code blocks only | 319 | 30 (`CHECK (` in blocks: 30) |
| Shipped migrations `services/core-api/migrations/versions/*.py` | 9 `nullable=False` | **0** `CheckConstraint` |
| Live DB `tp_audit_check`, `pg_attribute.attnotnull` / `pg_constraint` | 28 columns | **0** (`contype='c'`) |

The `56` reproduces exactly under `grep -cw CHECK` over A+B+C; the same method gives **339**
for `NOT NULL`, so "341" was a +2 miscount of that same population. Corrected above.

The gap that matters is not the arithmetic: the live schema has **zero** CHECK constraints
and 28 NOT NULL columns across 9 tables (`alembic_version`, `tenants`, `orders`, `packages`,
`pages`, `fields`, `field_readings`, `audit_log`, `rules`). Every enum/state invariant the
proposals express as `CHECK` is currently unenforced at the database layer. No claim in this
document or in the proposals may be read as asserting those constraints exist today.

**What this document rules and what it does not.** It rules on facts that follow from the
documents (which normal form, which FD holds). It presents options with consequences and
refuses to rule on: the `fields.path` model (§2), the jurisdiction table's scope (§3),
and the derived-count mechanism (§4). Those are owner calls, and each is marked
**OWNER**.

---

## 0. Notation and the standing assumption

- `T` = `tenant_id`. Every tenant-scoped table has `PRIMARY KEY (T, id)`
  (`PROPOSAL-B-full.md:72`, `PROPOSAL-C-evidence.md:63`, `PROPOSAL-A-minimal.md:465`).
- `X → Y` is a functional dependency. `⇸` marks a dependency that is *asserted by the
  domain but not enforced by the schema*.
- **Standing assumption, and it is load-bearing:** `id` is a `gen_random_uuid()` surrogate,
  globally unique on its own. Therefore `id → T` holds in every tenant table. This single
  FD is what §5 turns on.

---

## 1. Normal form per table

Reading: **BCNF** = every determinant is a superkey. **3NF** = no non-key attribute
transitively depends on the key. Where a table is BCNF I say so once; where it is not, the
violating FD is named.

### 1.1 Tables all three proposals share

| Table | Candidate keys | Governing FDs | NF | Note |
|---|---|---|---|---|
| `tenants(id, name, settings)` | `id` | `id → name, settings` | **BCNF** | `PRIMARY KEY (id)` alone is correct — its id *is* a tenancy (`PROPOSAL-B-full.md:76`). |
| `users(T,id,email,role,workos_user_id)` | `(T,id)`; `(T,lower(email))` if the unique index lands (`PROPOSAL-C-evidence.md:160`) | `id → T,email,role`; `(T,email) → id` | **BCNF** *iff* the email unique index exists; without it `(T,email)` is not a key and the table is merely 3NF-by-accident (nothing else determines a non-key attribute). | A `role` FK to a roles table is absent by design: `role text` deliberately not an enum until G1/G3 close (`PROPOSAL-A-minimal.md` §1.10 note). |
| `clients(T,id,name,delivery_method,delivery_config,report_shape,template_ref)` | `(T,id)` | `id → all` | **BCNF as declared**, but see the ⚠ | ⚠ `template_ref` points at nothing — `REVIEW-adversarial.md:170-176` (S-5): no proposal has `templates`. A dangling text reference is not an FD violation, it is a *missing referential dependency*. It becomes a 3NF question only if template attributes (shape, tokens, NA matrix) are later copied onto `clients`. |
| `orders(...)` | `(T,id)`; `(T,client_id,external_ref)` if declared unique (**none of the three declares it**) | `id → client_id, external_ref, jurisdiction, state, county, status, ...` **plus** `county ⇸ state` and `jurisdiction ⇸ state, county` | **3NF VIOLATION.** See §3. | This is the finding. |
| `packages(T,id,order_id,storage_key,page_count,sha256,accepted_by)` | `(T,id)`; `(T,sha256)` under C's unique index (`PROPOSAL-C-evidence.md` §2.3) | `id → all`; `sha256 → id` under C | **BCNF.** Under C's unique index `sha256` is a genuine second candidate key, so it determines everything and is a superkey. Fine. | C's own ⚠ is a *product* question (error at the door vs row-plus-notice), not a normalization one. |
| `pages(T,id,package_id,page_no,has_text_layer,class,class_engine,class_confidence)` | `(T,id)`; `(T,package_id,page_no)` — unique in B (`PROPOSAL-B-full.md:243`) and C (`pages_package_page_no_uq`) | `(package_id,page_no) → id, has_text_layer, class, ...` | **BCNF** in B and C. **A is only 3NF-by-luck**: A §1.3 adds `page_no` and warns about the natural key but the unique index is deferred to its §3, so `(package_id,page_no)` is not enforced as a key and duplicate page rows are storable. | A's warning (`PROPOSAL-A-minimal.md` §1.3, citing `0001_skeleton.py:174-179`) is right about the tenant-oracle risk and silent about the duplicate-row risk. Both are fixed by the same tenant-prefixed unique index. |
| `documents(T,id,package_id,doc_type,page_start,page_end,recording_no,book_page,recorded_date,dated_date,segmentation_state)` | `(T,id)` | `id → all` | **BCNF**, with one honest caveat | The caveat is real: `recording_no` and `book_page` are the *same fact under two jurisdictional conventions* (`CONTEXT.md` §11: "Recording conventions differ: book/page vs instrument number, by jurisdiction"). Which column is populated is determined by the jurisdiction, i.e. `jurisdiction → (which of recording_no/book_page is non-null)`. That determinant is not in this table at all — it reaches `documents` via `package_id → order_id → jurisdiction`. This is a **transitive dependency across a join**, not within the row, so it is not formally a 3NF violation of `documents`. It *is* the reason §3's `jurisdictions` table matters: without it, "is a null `book_page` structurally absent or not found" is unanswerable from the database. See §3.3. |
| `fields(...)` | `(T,id)`; `(T,order_id,path)` — unique in B (`uq_fields_order_path`) and C (`fields_order_path_uq`); **absent in A** | `id → all`; `(order_id,path) → id, value, state, ...` | **BCNF in B and C.** **A is not**: without the unique index, `(order_id,path)` determines nothing enforceable and two contradictory rows for `mortgages.1.lender` on one order are storable. That is a *correctness* defect, not a purity one — the review UI would show the field twice with two states. | Whether `path` itself is 1NF-legal is §2. Note the two questions are independent: the unique index is right regardless of how §2 is decided. |
| `field_readings(T,id,field_id,engine_id,value,page,snippet,confidence_raw,cost_usd,latency_ms,line_coords)` | `(T,id)` | `id → all` | **BCNF.** | Deliberately **no** `UNIQUE (field_id, engine_id)`: an engine may legitimately produce two readings for a value spanning two lines (`entities.ts:29-35` — "A value spanning two lines has two readings, each with its own box"). Adding that unique index would be a normalization-flavoured mistake that destroys a documented domain fact. **Do not add it.** |
| `engines(T,id,kind,enabled,adapter_version,config)` | `(T,id)` | `id → all` | **BCNF** | A's OPEN-2 (tenant-scoped vs global, `PROPOSAL-A-minimal.md` §1.7) is an RLS/ownership question, not a normalization one. Note only that if `engines` goes global it loses `T` and every composite FK `(T, engine_id)` from `fields`, `pages.class_engine`, `field_readings` and `engine_routing` must become single-column — four FK rewrites, and `EXPECTED_GLOBAL_TABLES` must be edited in the same commit or the table drops silently out of the RLS derivation (`0003_rules.py:19-30`, quoted at `PROPOSAL-A-minimal.md` §1.7). |
| `audit_log(T,id,actor_id,action,entity,entity_id,at)` | `(T,id)` | `id → all` | **BCNF.** `(entity, entity_id)` is a deliberate polymorphic reference with no FK, correct because the log must outlive the rows it describes (`PROPOSAL-C-evidence.md:644`). A polymorphic pointer is not an FD violation; it is an absent referential constraint, chosen. |

### 1.2 Tables in B and C only

| Table | Candidate keys | FDs | NF | Note |
|---|---|---|---|---|
| `engine_routing(T,id,jurisdiction,section,seat,engine_id,approved_by,approved_at,evidence_url)` | `(T,id)`; `(T,jurisdiction,section,seat)` — `uq_routing_cell` in B (`PROPOSAL-B-full.md:398`), `UNIQUE` in C (`PROPOSAL-C-evidence.md:355`) | `(jurisdiction,section,seat) → engine_id, approved_by, approved_at, evidence_url` | **BCNF.** The composite unique makes the natural key a real key, so its determinant is a superkey. This is the cleanest table in any of the three proposals. | `jurisdiction text` here is the *same* undeclared domain as `orders.jurisdiction`. Two text columns naming the same set of values, with no shared referent, is precisely what §3's table fixes. |
| `engine_runs(T,id,engine_id,order_id,pages,cost_usd,latency_ms,error)` | `(T,id)` | `id → all` | **BCNF** | C adds `field_readings.engine_run_id` (`PROPOSAL-C-evidence.md` §2.7 and §3), which makes per-order cost reconcilable two ways. That is a genuine improvement and it *adds* an FD (`reading → run → order`) rather than duplicating one. Not a denormalization. |
| `escalations(T,id,field_path_cluster,order_ids[],question,resolution,rule_id,resolved_by,raised_by,age,context,excerpt,identity,qc_owner)` | `(T,id)` | `id → all` | **1NF VIOLATION — accepted, contract-driven.** `order_ids uuid[]` is a repeating group in a column. | Both B (`PROPOSAL-B-full.md`, §2.7 note) and C (`PROPOSAL-C-evidence.md:576-583`) flag it *as a weakness of the contract shape*, not as an oversight, and both decline to fix it. That is the right call for a P0: `CONTEXT.md:135` and `entities.ts:170` both say array, and the escalation *cluster* is the unit. **Consequence, stated plainly:** no FK can constrain the members, so a deleted order leaves a dangling id, and "which escalations touch order X" is a `= ANY(order_ids)` scan, not an index seek (a GIN index makes it a seek; nobody proposed one). The junction table `escalation_orders(T, escalation_id, order_id)` is the 1NF fix and costs a contract divergence. **Not urgent; record it.** |
| `bugs(T,id,order_id,field_id,description,upstream_source,status)` | `(T,id)` | `id → all` | **BCNF** | |
| `reports(T,id,order_id,version,shape,storage_key,rendered_at,supersedes,reason)` | `(T,id)`; `(T,order_id,version)` — `uq_reports_order_version` in B | `(order_id,version) → shape, storage_key, rendered_at, supersedes, reason` | **BCNF in B.** C/A without the unique index: `(order_id,version)` is not enforced, so two v2 reports for one order are storable. | `supersedes` is a version *number*, not an id (`entities.ts:248-253`), so the self-reference is `(order_id, supersedes) → reports`, which is expressible as a composite self-FK and **nobody declared it**. Worth 3 lines. |
| `deliveries(T,id,report_id,method,status,attempted_at,delivered_at,evidence,receipt)` | `(T,id)` | `id → all` | **B: 1NF violation** (`receipt jsonb` array of `ReceiptStep`). **A: BCNF** — A gives receipt steps their own table. | This is the one place A is *more* normalized than B, and A argues it correctly: "an audit trail inside a jsonb blob cannot be constrained, indexed, or joined to a principal" (`PROPOSAL-A-minimal.md` §1.9). B's counter is that the receipt is "an authored document, not a queryable relation" (`PROPOSAL-B-full.md` §2.8). **Ruling on the normalization question only:** A is right, and for a reason B does not address — `ReceiptStep.who` (`entities.ts:267`) is a principal, and a principal reference inside a JSON blob cannot be FK'd to `users`. A delivery receipt naming a person who does not exist is exactly the class of defect the provenance principle exists to prevent. The cost of A's choice is one table and a `step_no` ordering column, which A already has. |
| `delivery_receipt_steps(T,id,delivery_id,step_no,what,who,at,done)` (A only) | `(T,id)`; `(T,delivery_id,step_no)` **not declared unique — should be** | `(delivery_id,step_no) → what, who, at, done` | BCNF once the unique index is added; without it, duplicate step 3 rows are storable and the receipt renders twice. | One-line fix. `done` stored rather than derived from `at IS NOT NULL` is correct and is *not* a redundancy: the contract states both members independently (`entities.ts:263-269`), and a step can be `done: false` with a null instant, which `at IS NOT NULL` also gives — but the converse (an instant recorded on a step not yet done) must remain representable. Storing both is the only way to keep them independent. |
| `probes(T,id,order_id,field_path,planted_value,caught,reviewer_action)` | `(T,id)` | `id → all` | **BCNF** | `field_path` is a `path` string with no FK to `fields` — deliberate, because a probe is planted against a path that may have no row yet. Same §2 question, smaller stakes. |
| `golden_fields(T,id,order_id,path,value,tag,source_citation,corrected_from,corrected_by,corrected_at,correction_reason)` (B) | `(T,id)`; `(T,order_id,path)` **not declared unique in B** | `(order_id,path) → value, tag, ...` | 3NF; **not BCNF without the unique index**. Two golden values for one path on one order is a seed contradiction and should be unstorable. | This matters more than it looks: `GET /api/bench/results` compares model output to the seed. A duplicated golden row double-counts a denominator (`endpoints.ts` BenchCell — `fields`/`passed`). |
| `blind_entries(T,id,order_id,typist_seat,path,value,source_citation,confidence)` (B) | `(T,id)`; `(T,order_id,typist_seat,path)` **not declared unique** | `(order_id,typist_seat,path) → value, source_citation, confidence` | 3NF; not BCNF without the index. | The unique index here is also the **blindness invariant's storage half**: seat A and seat B each get exactly one entry per path, and `reconciliations` joins them pairwise. Without it, "the two readings" is not well defined and `reconciliations.value_a`/`value_b` have no unambiguous source. **Add it.** |
| `reconciliations(T,id,order_id,path,value_a,value_b,ruling_value,citation,reason,ruled_by,general_rule_id)` (B) | `(T,id)`; `(T,order_id,path)` | `(order_id,path) → value_a, value_b, ruling_value, ...` | 3NF; not BCNF without the index. **Plus a real redundancy:** `value_a` and `value_b` are *copies* of `blind_entries.value` for seats A and B. | This is a **denormalization nobody labelled** — see §6, D-4. `value_a`/`value_b` duplicate facts that live in `blind_entries`, and nothing keeps them in sync. Either derive them in the view, or state that a reconciliation snapshots the values as they were at ruling time (which is a defensible and probably correct audit argument — but it is an argument nobody made). |
| `complaints(T,id,order_id,field_path,shipped_value,client_value,how_it_got_through,resolution,rule_id,golden_offer_accepted)` (B) | `(T,id)` | `id → all` | **BCNF.** `shipped_value` is a deliberate historical snapshot — the value as delivered, which must not follow later corrections to `fields.value`. That is a correct temporal denormalization and B does not need to defend it beyond naming it. It is named here as **D-5** in §6. | |
| `rules(id, code, text, origin, status, jurisdiction_scope, version, confirmed_by, source_doc_ref)` — global, `PRIMARY KEY (id)` per `0003_rules.py:90,208` | `id`; `(code, version)` **if unique** | `id → all`; `(code,version) → text, status, ...` | **BCNF if `(code,version)` is unique; otherwise 3NF.** Nobody declared it. | `jurisdiction_scope text NULL` is a *third* undeclared jurisdiction column (`entities.ts:160`). Null = applies everywhere. §3.3 is where this lands. |

### 1.3 Tables the adversarial review found missing, and their normal form as specified here

| Table | Source of the requirement | NF as specified below |
|---|---|---|
| `jurisdictions` | `/api/jurisdictions/{code}` live (`design2.ts:248`, `JurisdictionResponse`); `REVIEW-adversarial.md:170-176` | **BCNF** — see §3.2 |
| `countersigns(T,id,field_id,ruled_by,countersigned_by,at)` | `REVIEW-adversarial.md:122-137` | BCNF with `UNIQUE (T, field_id)` and `CHECK (ruled_by <> countersigned_by)`. The CHECK is a *tuple* constraint, not an FD; it does not affect NF. |
| `page_texts(T,id,page_id,engine_id,lines text[])` + `pages.text_of_record_engine_id` | `REVIEW-adversarial.md:157-163` | `lines text[]` is a 1NF violation of the same accepted kind as `escalations.order_ids`. Here it is **more** defensible: page lines are an ordered sequence read as a unit, never queried member-wise, and the alternative (`page_text_lines(page_id, engine_id, line_no, text)`) multiplies row count by ~40× per page for no query anyone has named. **Accept the array; record it.** |
| `templates` | `REVIEW-adversarial.md:170-174` | Deferred. Its absence makes `clients.template_ref` a dangling reference (§1.1). |

---

## 2. THE CENTRAL QUESTION — `fields.path = 'mortgages.1.lender'`

An array index encoded inside a text column, inside a row whose whole purpose is to be
one attribute of one order. Is this a 1NF violation or a legitimate EAV design?

### 2.1 The honest answer to the formal question first

**Formally, `fields.path` is not a 1NF violation, and anyone who says it is has the wrong
definition.** 1NF requires that every attribute hold a single value from its domain and
that there be no repeating groups within a row. `path` holds exactly one string. The row
`(order_id='ord_1', path='mortgages.1.lender', value='Ashfield Savings')` is a perfectly
atomic tuple of the relation "order × attribute-name → attribute-value". Codd's own
definition is satisfied.

**Informally — and this is the objection that actually has teeth — `path` is not atomic
*with respect to the queries the system needs to run*.** `'mortgages.1.lender'` decomposes
into three semantically distinct components:

| Component | Meaning | Evidence it is queried |
|---|---|---|
| `mortgages` | the **section** | `engine_routing(jurisdiction, section, seat)` — routing is per section (`PROPOSAL-B-full.md:383-398`). `BenchCell.section` (`endpoints.ts` bench block). `LeaderboardCell.section` (`entities.ts:327`). |
| `1` | the **ordinal within a repeating instrument group** | `#OF MTGS: 01` is a reported field (`CONTEXT.md` §11). Chain termination walks mortgages in order. |
| `lender` | the **attribute** | `MetricsBacklogRow.path` correction rates per path (`endpoints.ts`, `handlers.ts:834`: `{ path: "mortgages.1.amount", correction_rate: 0.24, n: 46 }`). |

Every one of those three is a query axis somewhere in the live contract, and today each is
obtained by **string surgery on a text column**. `section` is `split_part(path,'.',1)`.
The ordinal is `split_part(path,'.',2)::int` — and that cast can throw, because
`assessment.total` has no ordinal in position 2. That is the real complaint, and it is
better stated as **"`path` is an unnormalized composite key smuggled through a text
column"** than as a 1NF violation. The distinction matters because the two framings imply
different fixes: "1NF violation" implies exploding into columns; "composite key in a
string" implies *adding the components as columns beside it*, which is §2.5.

### 2.2 The case for the prosecution: what EAV costs here, concretely

**(a) Type safety is gone, and the domain proves it is needed.** `fields.value text` holds
`'$412,000'` (`design.ts:356`), `'2008-09-17'`, `'01'`, and a legal description paragraph.
`CONTEXT.md` §12 defect 4 turns on comparing `238,120 / 188,559 / 426,679` against
`233,451 / 184,862 / 418,313` — a numeric comparison the database cannot perform, cannot
index, and cannot constrain. A typed `assessments(order_id, land numeric, building numeric,
total numeric, basis text)` table could hold `CHECK (land >= 0)`. The EAV table cannot
express any arithmetic constraint at all.

**(b) DB-enforced constraints degrade to per-path conventions.** The proposals land 56
CHECKs, and look at what they check: `value XOR na_reason`, `approved_by` paired with
`approved_at`, `excluded_*` complete-or-absent, `auto_confirmed` must cite
(`PROPOSAL-C-evidence.md` C1–C4). Every one is a constraint on the *envelope* — the
provenance metadata that is genuinely uniform across all 132+ fields. **Not one is a
constraint on the value's own semantics**, because in an EAV table no such constraint is
expressible. `mortgages.1.amount = 'blue'` is storable. The 56 CHECKs are real and good and
they are all about the wrapper, never the content. That is EAV's signature.

**(c) Aggregate queries become string-parsing.** "Correction rate per section, per
jurisdiction" — which is `GET /api/metrics` and the engine leaderboard — is today
`GROUP BY split_part(path,'.',1)`. That is unindexable without an expression index nobody
proposed, and it is silently wrong for any path whose first component is not a section.

**(d) Referential integrity between related fields is unexpressible.** `mortgages.1.lender`
and `mortgages.1.amount` are the same instrument. Nothing in the schema says so. Deleting
one leaves the other. "Every mortgage with an amount has a lender" is not statable. In a
typed `mortgages` table it is a `NOT NULL` on one column.

**(e) The ordinal is unconstrained.** `mortgages.1` may exist without `mortgages.0` or
alongside `mortgages.7`; gaps and duplicates are storable. And `#OF MTGS` — a *reported*
field — is meant to correspond to the count of these groups. Nothing enforces that
correspondence. This is §4's problem wearing a different hat.

### 2.3 The case for the defence: what the typed alternative costs

**(a) The field set varies by jurisdiction, and the variation is not cosmetic.**
`CONTEXT.md` §11: San Diego has no `BOOK/PAGE`; Houston has no `INST#`; Greene has no
`BUILDING` line at all. Three tax vocabularies — Annual (GA/KY/NY/NC), 1st/2nd Installment
(CT/CA), 1st/2nd Half (AK) — **and the cadence changed within one jurisdiction**, Anchorage
going single-payment through 2021 and two-cycle from 2022. A typed schema must either carry
the union of all jurisdictions' columns as nullable (at which point every column is
nullable and you have lost exactly the type safety you paid for) or carry per-jurisdiction
tables (at which point adding Alaska is a migration). The EAV table represents
"structurally absent" as *the row's absence, or a row with `na_reason = 'NOT_PRESENT'`* —
and that is precisely the distinction the product's most-repeated rule turns on.

**(b) 132+ fields, and the number is not final.** `CONTEXT.md` §11 has open items —
`#OF E&R ESTATES` appears on no delivered report; the template has nowhere to put a
bankruptcy; `EXCEPTIONS` is status `CONFLICT` with three open mechanics. A typed schema
requires a migration per resolution. The EAV table requires a row.

**(c) Rule changes without migrations, which is the actual operating model.**
`CONTEXT.md` §11: *"Whoever writes those reasons is writing the rulebook, one order at a
time."* Rules are data (`rules` table, `origin`, `status`, `version`). The field set is
downstream of the rulebook. A schema in which the rulebook's evolution requires DDL is a
schema fighting the business.

**(d) The envelope is genuinely uniform, and the envelope is the product.**
`entities.ts:96-101`: *"The provenance envelope is the product."* Every field, of every
type, in every jurisdiction, needs identically: `source_doc_id`, `source_page`,
`source_snippet`, `source_line_coords`, `source_excerpt`, `engine_id`,
`engine_confidence_raw`, `rule_refs`, `state`, `na_reason`, `approved_by/at`,
`excluded_reason/by/at`, `asking/why/consequence`. **That is 17 uniform columns of
metadata wrapped around one heterogeneous column of payload.** In a typed design those 17
columns must be repeated on every typed table, or the payload split from its envelope
across a join. When the uniform part outweighs the varying part 17-to-1, EAV is not a
smell; it is the correct factoring.

**(e) `field_readings` multiplies the cost of any typed design by the engine count.**
Every field has N pre-merge readings kept permanently (`CONTEXT.md:147`). A typed schema
needs a typed readings table per typed field table, or gives up and stores readings as
text anyway — at which point the merge boundary has a type discontinuity, and the value
that gets promoted from a text reading into a typed field needs a cast that can fail.
**In the typed design, extraction can fail at write time on a value a human would have
corrected.** That is worse than storing the string.

### 2.4 The blast radius, measured

`grep -c '\bpath\b'` across `apps/web/src`, `packages/contract/src`, `packages/mocks/src`:
**295 occurrences across 72 files.** `path: z.string()` appears in `Field`
(`entities.ts:105`), `GoldenField` (`:217`), `Reconciliation` (`:231`),
`BlindEntryInput` (`:339`), `BenchFailRow`, `MetricsBacklogRow`,
`ReconciliationRulingRequest` (`endpoints.ts:312, 341, 408, 582`), plus `field_path` on
`Complaint` (`entities.ts:290`) and `probes`. The MSW mock is built on it throughout
(`data.ts:537,585,641,1220`; `design.ts:173,184,356`; `handlers.ts:834,950`). The golden
seed's famous case is keyed by it (`data.ts:1212`: *"the famous case:
mortgages.1.amount seed"*).

**Changing `path` is not a backend refactor. It is a contract break that invalidates the
frontend, the contract package, the MSW mock, the golden seed's identity scheme, and every
Playwright test that asserts on a field.** Any estimate under "weeks, with the frontend
frozen" is not serious. And AGENTS.md's first hard rule cuts the other way too: the backend
is upstream of the UI — but `path` is not a UI invention. It is in `CONTEXT.md:110`, the
domain document, written before the screens.

### 2.5 Recommendation — and its cost

**Keep `fields.path`. Add the decomposition as stored columns beside it. Do not explode
into typed tables.**

Concretely:

```sql
ALTER TABLE fields
  ADD COLUMN section    text GENERATED ALWAYS AS (split_part(path,'.',1)) STORED,
  ADD COLUMN ordinal    integer GENERATED ALWAYS AS (
      NULLIF(split_part(path,'.',2), '')::integer) STORED,   -- see the cast note
  ADD COLUMN attribute  text GENERATED ALWAYS AS (
      CASE WHEN split_part(path,'.',3) = '' THEN split_part(path,'.',2)
           ELSE split_part(path,'.',3) END) STORED;

ALTER TABLE fields ADD CONSTRAINT fields_path_is_well_formed CHECK (
  path ~ '^[a-z_]+(\.[0-9]+)?\.[a-z_]+$');
```

**Why this and not the alternatives:**

- It makes `section` a real, indexable, FK-able column, so `engine_routing.section`,
  `BenchCell.section` and `LeaderboardCell.section` stop being string surgery and can be
  constrained against a `sections` reference table. That closes prosecution point (c) and
  half of (b).
- `GENERATED ALWAYS ... STORED` means there is **no possibility of drift** — Postgres
  recomputes on every write and the column cannot be set directly. This is the one place in
  this whole audit where a derived stored value is safe by construction, and it is worth
  contrasting with §4, where it is not.
- The regex CHECK makes the ordinal cast total. **Note carefully:** the cast in the
  `ordinal` expression will throw on any existing malformed path, so the CHECK must be
  added and validated *before* the generated column, or the migration fails mid-way. If
  any legacy path cannot satisfy the regex, use a `CASE ... WHEN split_part(path,'.',2) ~
  '^[0-9]+$' THEN ...::integer ELSE NULL END` form instead and accept a silently-null
  ordinal. **Prefer the strict version and fix the data.**
- It does not touch the contract. The API serializes `path` exactly as today. Zero
  frontend change. Zero mock change. Zero Playwright change.

**The cost, stated honestly and not hidden:**

1. **It does not buy type safety.** `value` stays `text`. `mortgages.1.amount = 'blue'` is
   still storable. Prosecution points (a) and (d) are **unaddressed**, and this
   recommendation does not pretend otherwise. If money must be constrained, the follow-on
   is a `value_numeric numeric` column populated by the assemble stage for paths whose
   section declares a numeric type, with `CHECK (value_numeric IS NULL OR value IS NOT
   NULL)`. That is a second decision, not this one.
2. **Three more columns on the widest table in the schema**, each written on every field
   row of every order. At 132 fields × 20,000 orders that is ~2.6M rows carrying three
   redundant-by-construction columns. Storage is trivial; the honest cost is that
   `fields` is now 20+ columns and the generated ones must be excluded from every
   `INSERT` column list or Postgres errors.
3. **It entrenches `path`.** After this, the string-decomposition question is settled and
   revisiting it is harder, because `section`/`ordinal`/`attribute` will accumulate indexes,
   FKs and query dependencies. This is the real cost: it is a one-way door on the cheap
   side of the choice.
4. **The referential-integrity gap between sibling fields stays open.** Nothing will say
   `mortgages.1.lender` and `mortgages.1.amount` are the same instrument except that they
   share `(section, ordinal)` — which, after this change, is at least *expressible* as a
   query, and could later carry a `field_groups` table keyed on
   `(order_id, section, ordinal)`. That is the migration path if the typed design ever
   becomes necessary, and it is available precisely because the components became columns.

**OWNER — the thing that would change this recommendation.** If the roadmap contains
arithmetic over extracted values that the database must enforce or index (portfolio-level
assessment analytics, automated reconciliation of `LAND + BUILDING` against anything, a
numeric constraint on consideration), then EAV-with-generated-columns is a stopgap and the
typed design for the ~6 numeric sections should be scheduled now, while the row count is
small. **If the roadmap is what §11 describes — per-order extraction, per-order review,
per-order delivery, with all arithmetic done in the assemble stage and never in SQL — then
the recommendation above is not a compromise, it is correct**, and the prosecution's
strongest points (a) and (d) are costs the product genuinely does not pay. Nothing in
`CONTEXT.md` or `PRD.md` that I read describes cross-order numeric analytics. I therefore
believe the second branch holds, but the roadmap is the owner's to state.

---

## 3. TRANSITIVE DEPENDENCY — `orders(jurisdiction, state, county)`

### 3.1 The violation, stated formally

**🔴 FRAMING CORRECTION (verified firsthand against the migrations, 2026-09-02).
`orders` DOES NOT HAVE THESE COLUMNS TODAY.** `0001_skeleton.py:279` is the whole
of the shipped `orders` table:
`op.create_table("orders", *_identity_columns(), _tenant_column(), _tenant_primary_key())`
— that is `id`, `created_at`, `tenant_id`, `PRIMARY KEY (tenant_id, id)`, and
nothing else. There is no `jurisdiction`, no `state`, no `county`, no
`client_id`, no `external_ref`, no `status`. `0002` adds only RLS and grants
(`0002_forced_rls_and_grants.py:305`), `0003` creates only `rules`
(`0003_rules.py:214-229`). The three columns below exist in `PRD.md:89-90` and in
the three proposals as **PROPOSED DDL**.

**Consequences of the correction, and they are all in the fix's favour:**

1. This is a **greenfield DDL decision, not a migration of extant data**. The
   `orders` table holds no jurisdiction values to convert, so Option J1 below
   ("drop `state` and `county`") is not a `DROP COLUMN` at all — it is simply
   *not adding two of the three proposed columns*. Zero rows, zero risk, zero
   backfill.
2. **§8's open question "whether `jurisdiction` is a code or a free string in
   live data" is MOOT for the database.** There is no live data. The FK in §3.2
   needs no data migration; the shape is chosen, not discovered. The question
   survives only as a *contract* question — what `data.ts:88-89,140` serves as
   `place` ("Clayton County · GA") is a display string assembled for the wire,
   and the audit's recommendation is that the stored column be the code
   (`'GA-CLAYTON'`) with the display string derived by the serializer.
3. The 3NF analysis itself is **unchanged and still worth making**: an FD that
   would be violated by DDL nobody has run yet is exactly the cheapest kind to
   fix. The update/insert/delete anomalies below are stated in the conditional —
   they are what happens *if the proposed DDL ships as written*.

`CONTEXT.md:105` and all three proposals (`PROPOSAL-A-minimal.md:104-106`;
`PROPOSAL-B-full.md:199-201`; `PROPOSAL-C-evidence.md:175-177`) put three columns on
`orders`:

```
id → county          (county is a fact about the order)
county → state       (a county belongs to exactly one state)
∴ id → county → state    -- state is TRANSITIVELY dependent on the key
```

`state` is a non-key attribute determined by another non-key attribute. **That is the
textbook 3NF violation**, and it is the only formally clean one in the whole schema. The
anomalies are the textbook ones and they are not hypothetical here:

- **Update anomaly.** Correcting one order's `state` from `'GA'` to `'NC'` while leaving
  `county = 'Clayton'` produces a row asserting Clayton County is in North Carolina.
  Nothing prevents it. All three proposals type these as bare `text NOT NULL`.
- **Insert anomaly.** A jurisdiction cannot be recorded until an order exists in it. But
  `/api/jurisdictions/{code}` is a live read (`design2.ts:248`), and jurisdiction-scoped
  rules exist independently of orders (`rules.jurisdiction_scope`, `entities.ts:160`).
- **Deletion anomaly.** Delete the last order in a county and the county's recording
  convention — a durable domain fact — is gone from the database.

`jurisdiction` is worse than redundant: it is a *third* column whose relationship to the
other two is undeclared. Is `jurisdiction` a code like `'GA-CLAYTON'` from which both derive
(`jurisdiction → state, county`)? Or an independent recording-office designation? The
proposals do not say, the contract does not say (`entities.ts:60-62`, three bare strings),
and `engine_routing.jurisdiction` and `rules.jurisdiction_scope` use the same word for a
value with no shared referent. **Three text columns and three undeclared domains.**

### 3.2 The table

```sql
CREATE TABLE jurisdictions (
  code                text PRIMARY KEY,       -- NATURAL KEY. e.g. 'GA-CLAYTON'
  label               text NOT NULL,          -- design2.ts:249 JurisdictionResponse.label
  state_code          char(2) NOT NULL,       -- 'GA'
  county_name         text NOT NULL,          -- 'Clayton'
  baseline_note       text NOT NULL,          -- design2.ts:250
  recording_convention text NOT NULL
    CHECK (recording_convention IN ('book_page','instrument_no','both')),
  tax_vocabulary      text NOT NULL
    CHECK (tax_vocabulary IN ('annual','installment_1_2','half_1_2')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, county_name)
);
```

**FDs:** `code → label, state_code, county_name, baseline_note, recording_convention,
tax_vocabulary` and `(state_code, county_name) → code`. Both determinants are declared
keys. **BCNF.**

**Natural key, and why `code` rather than a surrogate `id`.** This is a deliberate
departure from the schema's `(tenant_id, id)` convention and it needs its reason stated:

1. **The API is keyed on it.** `/api/jurisdictions/{code}` (`design2.ts:248`), and
   `JurisdictionResponse.code` is the response's own identity (`design2.ts:247`). A
   surrogate would require a code→id lookup on every request to serve a resource whose
   identity in the contract *is* the code.
2. **It is a global reference table, not tenant data.** Clayton County's recording
   convention is not a tenant's fact. So it takes **no `tenant_id`** — which means it must
   be added to `EXPECTED_GLOBAL_TABLES` in `tests/test_forced_rls_and_grants.py` **in the
   same commit**, or it drops silently out of the catalog-derived RLS assertion
   (`0003_rules.py:19-30`, cited at `PROPOSAL-A-minimal.md` §1.7 and
   `REVIEW-adversarial.md:354`). This is the single most likely way to get this table
   wrong.
3. **Stable and short.** ~3,100 US counties, changing approximately never.

Then on `orders`:

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_jurisdiction_fk
  FOREIGN KEY (jurisdiction) REFERENCES jurisdictions (code);
```

**OWNER — what happens to `orders.state` and `orders.county`.** Two options; the
normalization answer and the pragmatic answer differ, and I will not pretend otherwise.

| | **Option J1 — drop them** | **Option J2 — keep as generated columns** |
|---|---|---|
| Change | `ALTER TABLE orders DROP COLUMN state, DROP COLUMN county;` serializer joins `jurisdictions` | keep both, `GENERATED ALWAYS AS (...)` is **not available** — a generated column may not reference another table. So: keep as plain columns with a trigger, or a `BEFORE INSERT` copy. |
| 3NF | **Achieved.** The transitive dependency is gone. | **Not achieved.** The redundancy remains; a trigger merely defends it. |
| Contract impact | **None** if the serializer joins. `entities.ts:60-62` keeps all three fields in the JSON. The API shape does not change. | None. |
| Query cost | one join on a ~3,100-row table, index seek, effectively free | zero |
| Risk | the `GET /api/orders` browse query gains a join; `REVIEW-adversarial.md:60-73` (S-1) already says that query needs work regardless | a trigger that can be dropped or fail to fire — **the exact defect class §4 is about** |

**I recommend J1**, and the reason is not purity: J2 requires a trigger, and a trigger
defending a redundancy is the same shape as the drifting stored count in §4. J1 removes
the possibility of inconsistency instead of policing it. The cost is one join in the
hottest browse query, which `REVIEW-adversarial.md:60-73` establishes must be revisited
anyway because it cannot serve `addr`, `place`, `assigned_to` or `stage` today.

### 3.3 What else belongs on `jurisdictions` — the domain facts with nowhere to live

These are facts about a jurisdiction that currently have **no home in any proposal**, and
each one is load-bearing per `CONTEXT.md` §11.

**(a) Recording convention — `book_page` vs `instrument_no`.** `CONTEXT.md` §11:
*"Recording conventions differ: book/page vs instrument number, by jurisdiction."*
`documents` carries both `recording_no` and `book_page`, both nullable
(`PROPOSAL-A-minimal.md` §1.4; B §2.3; C §2.5). **Today the database cannot distinguish
"this jurisdiction does not use book/page" from "we failed to read the book/page."** That
is the two-NA-states rule — the product's most-repeated invariant — going unenforced at
the storage layer for `documents`, where `fields` gets it right via `na_reason`. With
`jurisdictions.recording_convention` the distinction becomes checkable:

```sql
-- documents in an instrument_no jurisdiction must not claim a book_page,
-- and vice versa. Cross-table, so a trigger, not a CHECK. It reaches the
-- jurisdiction via package_id -> order_id -> jurisdiction.
```
I flag rather than specify this trigger: it needs the same fires-on-zero-rows care as
`0001_skeleton.py:58-64`'s statement-level append-only trigger, and §4 is where that
argument is made. **Minimum viable version: store the convention, have the ingest layer
set `na_reason = 'NOT_PRESENT'` rather than leaving null, and test it.**

**(b) Tax vocabulary and its cadence changes.** Three vocabularies (`CONTEXT.md` §11:
Annual GA/KY/NY/NC · 1st/2nd Installment CT/CA · 1st/2nd Half AK), *"and the cadence changed
within one jurisdiction — Anchorage was single-payment through 2021, two-cycle from 2022."*

**That last clause breaks the simple design and nobody has noticed.** `tax_vocabulary` as a
plain column on `jurisdictions` asserts `code → tax_vocabulary`, which is **false for
Anchorage**. The true dependency is `(code, tax_year) → tax_vocabulary`. A single column is
a 2NF-style error against the real key — the attribute depends on only part of the
determinant. The correct shape:

```sql
CREATE TABLE jurisdiction_tax_cadence (
  jurisdiction_code text NOT NULL REFERENCES jurisdictions(code),
  effective_from    integer NOT NULL,        -- tax year, e.g. 2022
  vocabulary        text NOT NULL CHECK (vocabulary IN ('annual','installment_1_2','half_1_2')),
  cycles            integer NOT NULL CHECK (cycles IN (1,2)),
  PRIMARY KEY (jurisdiction_code, effective_from)
);
-- Anchorage: ('AK-ANCHORAGE', 2000, 'half_1_2', 1), ('AK-ANCHORAGE', 2022, 'half_1_2', 2)
```
FDs: `(jurisdiction_code, effective_from) → vocabulary, cycles`. **BCNF.** Then drop
`tax_vocabulary` from `jurisdictions`, or keep it as the current-year convenience and
accept it as a labelled denormalization (§6, D-6). **This is the single most concrete new
finding in this audit** and it falls straight out of writing the FD down.

**(c) Structurally-absent field sets.** `CONTEXT.md` §11: San Diego has no `BOOK/PAGE`,
Houston no `INST#`, Greene no `BUILDING`. `design2.ts:229-236` `NullStateRow` is exactly
this, already served by the live endpoint: `{path, label, reason: NaReason, renders_as}`.
It is per-jurisdiction data with a live consumer and no table anywhere:

```sql
CREATE TABLE jurisdiction_null_states (
  jurisdiction_code text NOT NULL REFERENCES jurisdictions(code),
  path              text NOT NULL,
  label             text NOT NULL,
  reason            na_reason NOT NULL,     -- the existing enum
  renders_as        text NOT NULL,
  PRIMARY KEY (jurisdiction_code, path)
);
```
FDs: `(jurisdiction_code, path) → label, reason, renders_as`. **BCNF.** This table is what
makes "structurally absent" a *fact the server knows in advance* rather than an inference,
which is the only way the two-NA-states rule can be applied at extraction time instead of
guessed at review time. **This is arguably more valuable than the 3NF fix itself.**

**(d) Jurisdiction-scoped rules — R15/R20 and the state-law dependency.**
`design2.ts:238-245` `JurisdictionRule` is `{id, code, text, applies, scope_note}` — served
live per jurisdiction, with an `applies` boolean. `rules.jurisdiction_scope text NULL`
(`entities.ts:160`) is the storage side and it is **a single nullable text column trying to
express a many-to-many**: null means "everywhere", a value means "here". It cannot express
"R15 applies in GA and NC but not CA", which is what a state-law-dependent rule requires.

```sql
CREATE TABLE rule_jurisdiction_scope (
  rule_id           uuid NOT NULL REFERENCES rules(id),
  jurisdiction_code text REFERENCES jurisdictions(code),  -- null => whole state
  state_code        char(2),                              -- null => specific county
  applies           boolean NOT NULL,                     -- design2.ts:241
  scope_note        text,                                 -- design2.ts:242
  CHECK (num_nonnulls(jurisdiction_code, state_code) = 1),
  UNIQUE (rule_id, jurisdiction_code, state_code)
);
```
FDs: `(rule_id, jurisdiction_code) → applies, scope_note` and
`(rule_id, state_code) → applies, scope_note`. **BCNF.** The `CHECK` makes each row scope
to exactly one level. Resolution order (county row wins over state row) is application
logic and must be tested, not schema.

⚠ **AGENTS.md constraint that governs this table:** *"Escalation resolution is refused
without a rule"* and *"PENDING rules cannot affect the pipeline until engineer-confirmed."*
The second is unexpressible as a CHECK because it reads `rules.status` across the FK —
B (`PROPOSAL-B-full.md` §2.7 note) and C (`PROPOSAL-C-evidence.md:565-570`) both flag this
correctly and both decline to fix it. Adding `rule_jurisdiction_scope` does **not** change
that: a scope row for a PENDING rule must not affect the pipeline, and that remains an
application invariant needing a test. **Do not let a new table create the impression the
gate moved into the database.**

⚠ **I could not verify what R15 and R20 say.** `CONTEXT.md` §11 references R13, R14, R17,
R24 by number with text; R15 and R20 appear in the task brief and in
`entities.ts:121` ("rulebook R13") but I did not locate their text in the documents I read.
The FD analysis above holds for any state-law-dependent rule regardless of its content, but
**the specific claim "R15/R20 are state-law-dependent" is taken from the brief, not
independently confirmed by me.** Recorded as an open question rather than asserted.

---

## 4. DERIVED VALUES — INVARIANT 5 and the stored count

### 4.1 The tension, stated precisely

`CONTEXT.md:172-176`: *"The UI must not re-derive counts, chain termination, or release
resolution."* AGENTS.md: *"Server owns all state machines and thresholds. UI never computes
`state` from confidence, never re-derives counts."* The contract is full of server-owned
counts: `QueueBand.count` with the comment *"Server-supplied. Never `orders.length`"*
(`endpoints.ts:113`); `decisions`, `settled`, `queue_rest`, `remaining` (`endpoints.ts`
~145-160), each with *"Optional: absent is 'the server did not say', not zero"*;
`RailBadgesResponse.orders_total`; `BenchCell.fields`/`passed`;
`MetricsResponse.probes_planted`/`probes_caught`.

**"The server owns the count" is a statement about who computes it, not about where it is
stored.** The proposals conflate these, and the invariant does not require a stored column.
A count computed on read, in the server, satisfies INVARIANT 5 completely.

And the redundancy is real: `decisions` is derivable from `fields` rows for the order;
`remaining` is *not* (`endpoints.ts` explicitly: *"Not `decisions - settled`: a field parked
on a countersign or held behind an escalation is neither, so only the server knows"*).
**That sentence is the key to this whole section.** `remaining` is not a count of rows; it
is the output of a state machine over rows. Grouping it with `decisions` under the label
"derived value" is the mistake.

### 4.2 The three mechanisms

| | **M1 — computed on read** | **M2 — materialized view** | **M3 — stored column + trigger** |
|---|---|---|---|
| Shape | `SELECT count(*) ... GROUP BY` in the query serving the endpoint | `CREATE MATERIALIZED VIEW order_field_counts`, `REFRESH CONCURRENTLY` | `orders.decisions_count integer`, `AFTER INSERT/UPDATE/DELETE ON fields` trigger |
| Can it drift? | **No. Impossible by construction.** | **Yes, bounded** — stale until refresh, and staleness is visible and measurable | **Yes, unbounded and silent** — a missed trigger path drifts forever with no signal |
| Cost | index scan on `fields (T, order_id, state)`, which B and C already propose | refresh cost, amortized | ~zero read cost |
| RLS interaction | inherits the caller's RLS naturally | ⚠ **matviews do not respect RLS of the querying role** — the view is populated as its owner. A tenant-scoped count in a matview is a **cross-tenant leak surface** unless `tenant_id` is in the view's grouping *and* every read filters on it. This alone should disqualify M2 here. | trigger must handle the forced-RLS zero-row case (`0001_skeleton.py:58-64`) |
| Correctness for `remaining` | ✅ — it is a state-machine query, expressible in SQL | ✅ | ⚠ the trigger would have to fire on escalation and countersign changes too, not just `fields` |

**Recommendation: M1 for every count in the contract, at P0. No exceptions, no stored
count columns, no matviews.**

Reasons, in order of weight:

1. **The scale does not justify anything else.** ~132 fields per order. `decisions` for one
   order is a scan of ≤132 rows on the index `fields (tenant_id, order_id, state)` that
   both B and C already propose. This is microseconds. **Nobody has measured a problem, and
   optimizing an unmeasured one is how the stored count gets in.**
2. **M2 has an RLS hazard that is disqualifying in a forced-RLS schema.** The whole
   `(tenant_id, id)` key design exists so no query can cross a tenant boundary
   (`PROPOSAL-C-evidence.md` §3: *"no edge in this graph can cross a tenant boundary"*). A
   matview owned by a privileged role reintroduces exactly the boundary the schema was
   built to make impossible.
3. **M3's failure mode is the one the repo is most allergic to.** A stored count that
   drifts is a value the server confidently emits and cannot cite. That is principle 6 —
   *"never emit a value you can't cite"*, caught six times in prototyping — failing at the
   storage layer. And it fails *silently*: the number looks right, is wrong, and nothing
   raises.
4. **`remaining` cannot be M3 anyway**, per its own contract comment, so M3 would give a
   schema with some counts stored and some computed. Two mechanisms for one concept is
   worse than either.

**OWNER — when M3 becomes the right answer.** If `GET /api/queue/bands` is measured slow at
production volume — 20,000 orders × ~132 fields ≈ 2.6M `fields` rows, and the band census is
*"scoped to what the caller may open"* while *"the census is not"* (`endpoints.ts:86-88`),
so it is a scan across all orders, not one — then a stored count is justified. **That is a
plausible future problem and it should be measured before it is solved.** The trigger design
below is written so it exists when needed, not so it ships now.

### 4.3 The test that must exist before any trigger ships — non-negotiable

If M3 is ever adopted, the test below is a **precondition of the migration**, not a
follow-up. A stored count defended by an untested trigger is worse than a computed count,
because it carries the authority of a stored fact.

A vacuous test here looks like: create an order, insert 5 fields, assert
`decisions_count == 5`. **That passes if the trigger never fires and the application also
happens to write the column.** It also passes if the trigger fires only on INSERT. It
proves nothing about the mechanism.

**The test must prove the trigger fires, on every path, from a role that cannot write the
column:**

```python
def test_field_count_trigger_fires_on_every_mutation_path(tenant_session):
    """
    Every assertion is made as the TENANT-SCOPED APP ROLE, never the owner, and
    the count column is never written by the test. If the trigger is dropped,
    every phase below fails.

    Phases: INSERT, UPDATE-that-changes-nothing-relevant, DELETE, and the
    multi-row statement — the last because 0001_skeleton.py:58-64 records that
    a FOR EACH ROW trigger does not fire when a statement affects ZERO rows,
    which under forced RLS is exactly the cross-tenant case.
    """
    # 1. INSERT path
    insert_fields(order, n=5)
    assert read_count(order) == 5
    assert read_count(order) == count_rows_directly(order)   # agreement, not a literal

    # 2. UPDATE path — a state change must not move the count
    update_field_state(order, path="mortgages.1.lender", state="confirmed")
    assert read_count(order) == 5

    # 3. DELETE path — the most-often-missed trigger arm
    delete_field(order, path="mortgages.1.lender")
    assert read_count(order) == 4

    # 4. MULTI-ROW statement in ONE statement, not a loop
    insert_fields_one_statement(order, n=10)
    assert read_count(order) == 14

    # 5. ZERO-ROW statement under forced RLS — the case the row trigger misses
    with tenant_session(other_tenant):
        rows = update_all_fields_of(order)      # matches nothing; RLS filters it
        assert rows == 0
    assert read_count(order) == 14              # unchanged, and not corrupted

    # 6. THE INJECTION. Run the whole test with the trigger dropped.
    #    Every phase from 1 onward must fail. If any phase still passes with
    #    the trigger gone, that phase is vacuous and is not evidence.
```

Phase 6 is the point. `REVIEW-adversarial.md` demolished A's headline injection because
`ADD COLUMN NOT NULL DEFAULT` populates rows, making the following `UPDATE ... WHERE col IS
NULL` a no-op on a *correct* database, so the test *could not fail*
(`REVIEW-adversarial.md:24` — *"A's headline injection cannot fail"*). **The same trap is
waiting here:** if the application layer also maintains the count, dropping the trigger
changes nothing and the test is vacuous by exactly the same mechanism. **Therefore: either
the trigger is the sole writer and the app role has no `UPDATE` grant on the count column,
or the test is theatre.** Enforce it:

```sql
REVOKE UPDATE (decisions_count) ON orders FROM app_role;
```

That single `REVOKE` is what converts phase 6 from a hope into a proof.

---

## 5. 2NF and the composite `PRIMARY KEY (tenant_id, id)`

**Finding: there is no 2NF risk, and the reason is worth stating precisely because it is not
obvious and because it also tells you the one thing that would create one.**

2NF is violated when a non-key attribute depends on a *proper subset* of a composite
candidate key. `(tenant_id, id)` is composite, so the question is fair: does any column
depend on `tenant_id` alone, or on `id` alone?

**Depends on `id` alone: yes, all of them — and that is fine.** `id` is
`gen_random_uuid()`, globally unique, so `id → tenant_id` and therefore `id` is itself a
superkey. Partial dependency on a superkey is not a 2NF violation; 2NF concerns dependency
on a proper subset that is *not* a key. Formally: `(tenant_id, id)` and `(id)` are both
candidate keys, `(id)` is minimal, and every table is at least 2NF with respect to both.

**Depends on `tenant_id` alone: no.** No proposed table carries a column that is a fact
about the tenant rather than about the row. I checked every DDL block in A §1.1–1.11,
B §2.2–2.9 and C §2.2–2.9. Tenant-level facts live on `tenants(id, name, settings)`
(`CONTEXT.md:99`), correctly.

**What this means about the key choice.** `(tenant_id, id)` is *not* a normalization
decision at all. Its stated purpose is (a) making every FK composite so no edge can cross a
tenant boundary before RLS even filters (`PROPOSAL-C-evidence.md` §3), and (b) closing the
cross-tenant existence oracle that `PRIMARY KEY (id)` leaves open — a `23505` on insert
reveals a row you cannot see (`0001_skeleton.py:154-179`, cited at
`PROPOSAL-A-minimal.md:750`). Both are security properties. The redundant-looking
`tenant_id` in the key is **deliberate controlled redundancy for a security invariant**, and
it costs nothing in normal form because of `id → tenant_id`.

**⚠ The one thing that would create a genuine 2NF violation, and A walks up to it.**
`0001_skeleton.py:174-179`, quoted at `PROPOSAL-A-minimal.md` §1.3, warns that the oracle
*"stops being bounded the moment a natural key lands, and PRD §7 gives `orders` an order
number and `pages` a page index."* Consider a natural composite key such as
`(tenant_id, package_id, page_no)`:

- `package_id → tenant_id` (a package belongs to one tenant), so `package_id` is *part* of
  a determinant that determines another key member.
- If any attribute depended on `package_id` alone — a package-level fact stored on `pages`
  — that would be a **real 2NF partial dependency**.

No proposal does this. The nearest miss is C's `pages.read_in_full`, `kind` and `degraded`
(`PROPOSAL-C-evidence.md` §2.4, from `endpoints.ts:630-635`), and each is genuinely
per-page, not per-package. **Correct as proposed.** The rule to carry forward is: *before
adding any column to a child table, ask whether it is a fact about the child or about the
parent.* That is the discipline that keeps 2NF, and it is the discipline that
`PROPOSAL-C-evidence.md` §2.4 already applies to `pages.lines` when it refuses to store
per-engine text on the page.

**Related, and A gets it wrong:** A defers the tenant-prefixed unique indexes to its §3
while adding `page_no` in §1.3. Between those two, `(package_id, page_no)` is not a key, so
`pages` has no natural candidate key at all and duplicate page rows are storable. Not a 2NF
violation — a missing key. **The index and the column must land in the same migration.**

---

## 6. Deliberate denormalizations — MEASURED or ASSERTED

Every intentional redundancy anyone proposed, plus the ones nobody labelled. **"Measured"
means a number was produced. Across three proposals and one adversarial review, the count
of measured denormalization justifications is zero.** That is the finding; it is not
necessarily a criticism, because most of these are correctness arguments rather than
performance arguments, and correctness arguments do not need measurement. The ones that
*do* are flagged.

| # | Denormalization | Who | Justification given | **MEASURED?** | Verdict |
|---|---|---|---|---|---|
| **D-1** | `tenant_id` in every PK and every FK | A `:465`, B `:72`, C `:63` | Cross-tenant FK impossibility + closing the existence oracle. `0001_skeleton.py:154-179` is cited as having *"measured the oracle"* | **PARTIAL — and it is the only one with any measurement at all.** `REVIEW-adversarial.md:645-661` and `:671-685` contain **executed SQL transcripts with actual outputs** proving the FK/RLS behaviours. That is real evidence about the *mechanism*. No measurement of the *cost* (index size, write amplification) exists, and none is needed at this scale. | **Correct. Keep.** A security invariant, not a performance trade. |
| **D-2** | `escalations.order_ids uuid[]` — repeating group, no FK | B §2.7, C `:576-583` | Contract shape (`CONTEXT.md:135`, `entities.ts:170`); the cluster is the unit | **ASSERTED**, and *honestly* — both proposals explicitly name the dangling-id weakness rather than hiding it | **Accept for P0.** Record the junction table as the fix. Add a GIN index the first time "escalations touching order X" is a real query. |
| **D-3** | `deliveries.receipt jsonb` array | B §2.8 | *"an authored document, not a queryable relation"* | **ASSERTED** | **A's separate table is better** (§1.2). The unanswered objection is `ReceiptStep.who` being a principal that cannot be FK'd inside JSON. |
| **D-4** | `reconciliations.value_a` / `value_b` duplicating `blind_entries.value` | B §2 (golden/blind block) | **NONE GIVEN — nobody labelled this as a denormalization at all** | **ASSERTED by omission** | **Needs a ruling.** The defensible argument is that a reconciliation snapshots values as they stood at ruling time, which is an audit requirement and makes the copy correct. **That argument is available and nobody made it.** Make it explicitly, or derive the columns. Silence here is how a redundancy becomes a bug. |
| **D-5** | `complaints.shipped_value` duplicating the delivered `fields.value` | B | Implicit: the value as shipped | **ASSERTED, but obviously correct** | **Keep.** A temporal snapshot is not redundancy — the shipped value must not follow later corrections. **Say so in a comment**; it is one line and it prevents a future "cleanup". |
| **D-6** | `jurisdictions.tax_vocabulary` as a single column (this document, §3.3) | — | convenience | n/a | **Do not add it as a plain column** without also adding `jurisdiction_tax_cadence`. Anchorage's 2022 change makes the single column false (§3.3b). |
| **D-7** | `orders.state` + `orders.county` alongside `jurisdiction` | A `:104-106`, B `:199-201`, C `:175-177` | **NONE — not recognized as a denormalization by anyone** | **ASSERTED by omission** | **This is §3.** Not a considered trade-off, an unnoticed 3NF violation. |
| **D-8** | `fields.state` stored rather than derived from confidence | A §1.5, B §2.4, C §2.8 | INVARIANT: *"the server owns the threshold; the UI never computes `state` from `confidence`"* (`enums.ts:3-7`) | **ASSERTED — and correctly, because it is not a denormalization.** `state` is not derivable from `confidence`: a confirmed field's state came from a human, and the threshold is versioned. Storing it is storing a *distinct fact*. | **Correct. Keep.** Worth naming so nobody "optimizes" it into a generated column later — all three proposals explicitly refuse that, and they are right. |
| **D-9** | `delivery_receipt_steps.done` stored alongside `at` | A §1.9 | Contract states both members independently (`entities.ts:263-269`) | **ASSERTED, correct** | **Keep.** `at IS NOT NULL` and `done` must stay independent. |
| **D-10** | `field_readings.cost_usd` + `engine_runs.cost_usd` — the same money at two grains | C §3 | Explicit: *"per-order extraction cost is checkable two ways, which is what makes the <$0.25/order metric an audit rather than a claim"* (`CONTEXT.md:59`) | **ASSERTED — but it is deliberate reconcilable redundancy, which is the good kind** | **Keep, and add the reconciliation test.** Redundancy whose purpose is cross-checking is only valuable if something actually cross-checks. A test asserting `sum(readings.cost_usd) ≈ run.cost_usd` within tolerance is what converts this from redundancy into an audit. **Nobody proposed that test.** |
| **D-11** | `pages.lines` **refused** by C, materialized from `engine_runs` at read time | C §2.4 | Two readers produce two line sets; collapsing them onto the page is the pre-merge erasure `CONTEXT.md:147` forbids | **ASSERTED, and it is the best-reasoned entry in this table** | C's reasoning is right and `REVIEW-adversarial.md:157-163` is right that C *"stopped one table short"* — the `page_texts` table serves the endpoint without erasing pre-merge. **Take both.** |

**Summary of §6:** eleven denormalizations, **zero with a measured performance
justification**. Nine are correctness or contract-shape arguments where measurement is not
the right standard. **D-1 is the only one with executed evidence, and D-10 is the only one
whose stated purpose (cross-checking) is unrealized for want of a test.** The two that need
attention are **D-4** (unlabelled, unjustified) and **D-7** (unnoticed, and the subject of
§3).

---

## 7. What must change, in order

**Free, no contract impact, do now:**

1. `UNIQUE (tenant_id, order_id, path)` on `fields` in **A** — B and C have it; A does not,
   and without it one order can hold two contradictory rows for one path.
2. `UNIQUE (tenant_id, package_id, page_no)` on `pages` in **A**, in the same migration as
   the `page_no` column.
3. `UNIQUE` on `golden_fields (T, order_id, path)`, `blind_entries (T, order_id,
   typist_seat, path)`, `reconciliations (T, order_id, path)`,
   `delivery_receipt_steps (T, delivery_id, step_no)`. Four indexes, four real defect
   classes closed. The `blind_entries` one is the blindness invariant's storage half.
4. Composite self-FK `reports (T, order_id, supersedes) → reports (T, order_id, version)`.
5. Label **D-5** in a comment; rule on **D-4**.
6. Add the D-10 cost-reconciliation test.

**Needs an owner decision:**

7. **§2** — `fields.path`. Recommendation: keep, add generated `section`/`ordinal`/
   `attribute`, add the well-formedness CHECK. Cost: three columns, entrenchment, and **no
   type safety**. Trigger to revisit: any roadmap item requiring SQL-level arithmetic over
   extracted values.
8. **§3** — `jurisdictions` (natural key `code`, global, **and `EXPECTED_GLOBAL_TABLES`
   edited in the same commit**), plus `jurisdiction_null_states`,
   `jurisdiction_tax_cadence`, `rule_jurisdiction_scope`. Then J1 (drop `orders.state`,
   `orders.county`) or J2 (keep, trigger-defended). Recommendation: **J1** — a trigger
   defending a redundancy is §4's defect class.
9. **§4** — counts. Recommendation: **M1, computed on read, everywhere, at P0.** M2 is
   disqualified by matview/RLS interaction. M3 only after `GET /api/queue/bands` is
   *measured* slow, and only with the phase-6 injection test **and** the
   `REVOKE UPDATE (count_column)` that makes the injection non-vacuous.

**Deferred with a named cost (the standard the proposals set for themselves):**

10. `escalation_orders` junction (fixes D-2's dangling ids).
11. `templates` (`clients.template_ref` points at nothing — `REVIEW-adversarial.md:170`).
12. `countersigns` (`REVIEW-adversarial.md:122-137`).
13. `page_texts` + `pages.text_of_record_engine_id` (`REVIEW-adversarial.md:157-163`).

---

## 8. What I did not check

- **R15 and R20's actual text.** I did not locate it in the documents I read. The
  state-law-dependence claim in §3.3(d) is from the brief, not independently confirmed. The
  FD analysis holds for any state-law-dependent rule, but the specific attribution does not
  rest on my own reading.
- **`PRD.md` §7's order-number and page-index natural keys.** Referenced via
  `0001_skeleton.py:174-179` as quoted in the proposals; I did not read `PRD.md` directly.
  If PRD §7 mandates a user-visible order number, `orders` gains a natural key
  `(tenant_id, order_no)` and §5's 2NF analysis must be redone for it.
- ~~**The alembic migration files themselves.**~~ **RESOLVED 2026-09-02 — all three
  revisions read firsthand.** Every migration citation in this document was re-verified
  against the source. Findings:
  - `0001_skeleton.py:174-179` — **accurate.** Resolves to the `_tenant_primary_key`
    docstring's "BOUNDED today only because ids are 128-bit and server-generated … It
    stops being bounded the moment a natural key lands, and PRD §7 gives `orders` an order
    number and `pages` a page index." Quoted correctly at §5 and §1.1.
  - `0001_skeleton.py:154-179` — **accurate.** The `_tenant_primary_key` docstring
    including the measured existence-oracle transcript at `:164-171`.
  - `0001_skeleton.py:58-64` — **approximately right, cited one line late.** The
    fires-on-zero-rows argument ("A row trigger … does not fire at all when a statement
    affects none — and under `0002`'s RLS a cross-tenant `UPDATE` matches exactly zero
    rows") is at **`:54-59`**; `:61-65` is the separate named-SQLSTATE paragraph. The
    claim the audit makes is supported; the span should read `:54-59`.
  - `0003_rules.py:90` — **accurate.** `## PRIMARY KEY (id), and why that is not the
    omission 0001 warns about`.
  - `0003_rules.py:208` — **accurate.** The `🔴 NO tenant_id AND NO
    PrimaryKeyConstraint("tenant_id", "id")` comment above the `create_table`.
  - `0003_rules.py:19-30` — **accurate as a pointer, misleading as a location.** Those
    lines are the module docstring *explaining* the catalog-derived RLS assertion, and
    they name `EXPECTED_GLOBAL_TABLES`. The list itself is **not in the migration**: it is
    `tests/test_forced_rls_and_grants.py:157` (`frozenset({"rules"})`). §3.2's instruction
    to "add it to `EXPECTED_GLOBAL_TABLES`" therefore points at a file the citation does
    not name. **And it is incomplete — see the next bullet.**
- **NEW FINDING, from reading the migrations firsthand: a global table requires TWO edits,
  not one.** §3.2 tells the reader that `jurisdictions` (and by extension
  `jurisdiction_tax_cadence`, `jurisdiction_null_states`, `sections`, and `templates` if
  global) must be added to `EXPECTED_GLOBAL_TABLES`. There is a **second** list:
  `tests/conftest.py::ISOLATION_GLOBAL_TABLES`, whose guard message
  (`conftest.py:1620-1631`) states it explicitly — *"a GLOBAL one belongs in
  `ISOLATION_GLOBAL_TABLES` here AND in `EXPECTED_GLOBAL_TABLES` in
  `tests/test_forced_rls_and_grants.py`, with the reason recorded in the migration that
  creates it."* Omitting the conftest half does not fail silently — the isolation seam
  refuses to guess and raises — but a reader following §3.2 alone will hit it. **§3.2's
  numbered point 2 should name both lists and the migration-docstring requirement.**
- ~~**Whether `jurisdiction` is a code or a free string in live data.**~~ **MOOT for the
  database — resolved 2026-09-02.** `orders` has no `jurisdiction` column
  (`0001_skeleton.py:279`) and the live `fields` table is empty; there is no data to
  migrate. See §3.1's framing correction. The question survives only as a serializer
  question: `data.ts:88-89,140`'s `place` (`"Clayton County · GA"`) is a display string
  the wire assembles, not a stored value.
- **Query plans.** No `EXPLAIN` was run. The §4 claim that M1 is fast enough is an argument
  from row count (≤132 rows per order on a proposed index), not a measurement. **It should
  be measured before P1**, and if it is measured, that measurement is also the thing that
  would legitimately promote M3.
- **`packages/contract/src/design.ts` in full**, and the 15 built screens. §2.4's blast
  radius is a grep count (295 occurrences, 72 files), not a read of each site.
- **Whether `field_readings` genuinely needs no unique constraint.** I argued from
  `entities.ts:29-35` (two-line values produce two readings) that `UNIQUE (field_id,
  engine_id)` would be wrong. I did not check whether any code assumes at most one reading
  per engine per field, which would be a contradiction worth finding.

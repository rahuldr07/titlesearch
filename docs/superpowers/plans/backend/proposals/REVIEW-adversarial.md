# Adversarial review — Proposals A, B, C

> Default verdict on each was NOT SOUND. All three remain NOT SOUND as written.
> Each has a defect that is fatal-as-specified, and all three share one class of
> defect none of them saw, because all three authors declared they did not read
> `packages/mocks/src/` or `apps/web/src/shared/*Queries.ts`. I read them.
>
> Method: every finding below is a file:line in this repo, a concrete input that
> breaks, and a replacement. Style preferences are excluded.
>
> **Four claims were MEASURED against the live `postgres:18.4`**
> (`titlepipe-db-postgres-1`, throwaway database `advrev`, owner role under
> `FORCE ROW LEVEL SECURITY`), not reasoned. Transcripts in §6. Two of the four
> overturn things the proposals assert: A-1 is confirmed fatal, and C's §5.2 —
> the finding C calls its sharpest — is **half right and half wrong**, in a way
> that matters more than C claimed.

---

## Measured results up front

| claim | source | measured |
|---|---|---|
| `ADD COLUMN NOT NULL DEFAULT` populates rows despite forced RLS, so a following `UPDATE … WHERE col IS NULL` is a no-op on a *correct* DB | A §5 INJ-1 depends on the opposite | **CONFIRMED.** Owner `SELECT count(*)` = 0, `UPDATE` = `UPDATE 0`, bypass shows 2 rows already `'pending'`, 0 null. **A's headline injection cannot fail.** |
| Adding an FK to a populated table under forced RLS validates against nothing | C §5.2, flagged "reasoned, not measured" | **CONFIRMED, and worse than C stated.** With a real orphan row present, `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` **succeeded**, `pg_constraint.convalidated = 't'`, and the orphan is still there. A validated FK over a violated table. |
| `SET NOT NULL` on a populated column silently succeeds under forced RLS | C §5.2 puts it in the same row as the FK | **REFUTED.** Raised `ERROR: column "v" of relation "n" contains null values`. `SET NOT NULL` uses the catalog/attnotnull scan, not an RLS-filtered read. C's table is wrong on this row. |
| A composite FK into `rules` cannot exist | C-1 below | **CONFIRMED**, `ERROR: 42703 column "tenant_id" referenced in foreign key constraint does not exist`. Control: single-column `FOREIGN KEY (rule_id) REFERENCES g(id)` succeeds. |

The FK result is the most consequential thing in this review. **It means B's
"FKs in one terminal revision, RLS last" ordering is not a stylistic preference,
it is the only ordering that produces a referential graph anyone has verified** —
and it means any FK added after Plan 07 populates the tables is a constraint that
reports success while checking nothing.

---

## 0. The shared defect: all three modelled `entities.ts` and none modelled the live wire

The three proposals cross-check against `packages/contract/src/entities.ts` and
`docs/CONTEXT.md §6`. But `entities.ts` is one of **seven** contract modules —
`packages/contract/src/{authz,design,design2,endpoints,entities,intake,workspace}.ts` —
and the frontend's live reads come from the other six as much as from it.

The fourteen paths the browser actually fetches
(`apps/web/src/shared/*Queries.ts`, grepped):

```
/api/orders?q=&filter=&page=          ordersQueries.ts:22    → design.ts:51 OrdersPageResponse
/api/clients                          clientsQueries.ts:10   → workspace.ts:123 ClientsResponse
/api/orders/{id}/countersigns         countersignQueries.ts:14 → design.ts:188
/api/orders/{id}/composition          releaseQueries.ts:11   → design.ts:100
/api/orders/{id}/artifacts            artifactQueries.ts     → design.ts:150
/api/orders/{id}/pages                                       → endpoints.ts:665
/api/orders/{id}/{fields,context,timeline,pipeline,signoff,completeness}
/api/templates/{id}                                          → design2.ts:168
/api/jurisdictions/{code}                                    → design2.ts:248
/api/blind/{order}/schedule                                  → design2.ts:221
```

Cross that against the three schemas and five findings fall out. They apply to
**all three proposals** unless noted, and each one forces the second migration
the brief asked about.

### S-1 — `orders` cannot serve `GET /api/orders`, the browse surface (all three)

`design.ts:27-41` `OrderRow` requires `addr`, `place`, `client`, `product`,
`stage`, `assigned_to`, `due`, `pages`. This is live: `ordersQueries.ts:22`.

- `addr` (`design.ts:30`) and `place` (`:31`) are **not derivable** from
  `jurisdiction`/`state`/`county`. `packages/mocks/src/data.ts:88-89,140` carries
  them as two independent strings ("4152 Creekstone Dr, Demoville GA" /
  "Clayton County · GA"), and `data.ts:187` has `addr: "Address unreadable on
  cover"` — a value no county/state pair produces.
- `assigned_to` (`design.ts:35`): *"Null while nobody has taken it. **Never
  inferred from anything else**."* That sentence is an instruction to store it.
- `stage` (`design.ts:12-20`) is a **closed seven-label enum**
  (`unassigned|intake|machine|gate|review|escalated|delivered`), distinct from
  `OrderStatus`.

Proposal A §1.1, B §2.2 and C §2.3 all give `orders` the twelve `entities.ts`
columns and **none of `addr`, `place`, `assigned_to`, `stage`**.

**What breaks, concretely:** the first request to `GET /api/orders?filter=all`
after Plan 05 lands. The handler has nowhere to read `addr` from and nowhere to
read `assigned_to` from. `OrdersPageResponse` is zod-validated on the client
(`ordersQueries.ts:24 schema:`), so the response fails parse rather than
degrading — the browse table is the entry point to every other screen.

**Do instead:** add `orders.addr text`, `orders.place text`,
`orders.assigned_to uuid` (composite FK to `users`), and `orders.stage` as a
Postgres enum with `design.ts:12-20`'s seven labels **in that order**.

⚠ And note the asymmetry all three missed: `OrderStatus = z.string()`
(`enums.ts:98`) is OPEN and correctly stays `text` — but `OrderStage`
(`design.ts:12-20`) is **closed and ruled**, and refusing to build it is not
"do not build past OPEN", it is not having read the module.

### S-2 — `clients` is the wrong table in all three; `/api/clients` is live

All three propose the same five columns (A §1.10, B §2.1, C §2.2):
`name, delivery_method, delivery_config, report_shape, template_ref`.

`workspace.ts:80-93` `ClientRecord` — the shape the live read returns
(`clientsQueries.ts:10`) — is `id, code, name, product_ids[], signoff_defaults
(record), overrides[], sign_offs?`. And `ClientsResponse` (`:123`) also carries
`effective: EffectiveChecklist[]` (`:113-121`), resolved server-side from
overrides against a product, explicitly *"never recomputed by a screen"*.

- **Missing (b):** `clients.code`, `clients.product_ids`,
  `clients.signoff_defaults`, and a whole `client_overrides` table
  (`workspace.ts:69-77`: `type, line_id, description, note, authored_by,
  authored_at` — `OverrideType` is a closed enum at `:66`).
- **Dead weight (a):** `delivery_method`, `report_shape` and `template_ref`
  appear in no response shape any live query reads. They come from
  `CONTEXT §6` alone. They are probably right domain-wise, but all three
  proposals present the contract as their justification, and the contract does
  not carry them.

**What breaks:** `GET /api/clients` cannot compose `effective` at all — the
override list it resolves from does not exist. Intake's two consumers both fail.

### S-3 — countersigns have no storage in any proposal

`/api/orders/{id}/countersigns` is live (`countersignQueries.ts:14`).
`design.ts:179-186` `Countersign` = `{id, field_id, ruled_by, countersigned_by,
at}` and `design.ts:204-207` states the rule: *"a second read must come from a
**different user** than the ruling examiner, enforced as a 409 rather than as
button state."*

A, B and C have no `countersigns` table and no `fields.countersigned_by`.
That rule is server-owned state (AGENTS.md: server owns all state machines) and
it needs two attributed users per field. `fields.approved_by` is one slot; a
countersign needs a second, with its own timestamp, and the 409 is a uniqueness
/ inequality constraint over the pair.

**Do instead:** `countersigns(tenant_id, id, field_id, ruled_by,
countersigned_by, at)` with `CHECK (ruled_by <> countersigned_by)` — that CHECK
is the 409, held at the layer every writer passes through, and it is exactly the
argument C makes for C1 in its own §2.8.

### S-4 — `pages.lines` (C's deliberate omission is a live-endpoint outage)

`endpoints.ts:633`: `SourcePage.lines: z.array(z.string())`, non-optional, on
`OrderPagesResponse` (`:665`), served at a live path.

- **A §1.3 and B §2.3** simply do not have it, unflagged.
- **C §2.4** omits it *deliberately* and argues page text is per-engine evidence
  materialised "from the reader-of-record's `engine_runs` output at read time".
  **But C's own `engine_runs` (§2.6) has no text column**: `pages, cost_usd,
  latency_ms, error`. There is nowhere in C's schema for page text to exist.

**What breaks:** `GET /api/orders/{id}/pages` returns `lines: []` for every
page, forever. That is the click-to-source substrate — `endpoints.ts:621-625`
says *"the recorded line coordinates index into this text"*, so
`LineCoords` becomes uninterpretable and provenance rendering silently degrades
to a box over nothing. This is a principle-6 failure produced by a schema
decision.

**Do instead:** C's argument that two readers produce two line sets is correct
and the fix is a `page_texts(tenant_id, id, page_id, engine_id, lines text[])`
table with `UNIQUE (tenant_id, page_id, engine_id)`, plus
`pages.text_of_record_engine_id` naming which one the endpoint serves. That
preserves pre-merge (`CONTEXT.md:147`) *and* can answer the endpoint. C got the
reasoning right and stopped one table short.

Conversely, C §2.4 is the **only** proposal that carries `read_in_full`, `kind`
and `degraded` (`endpoints.ts:630-635`, all three server-authored). A and B
cannot serve those either.

### S-5 — no proposal has `templates` or `jurisdictions`

`/api/templates/{id}` (`templateQueries.ts`) → `design2.ts:168`
`TemplateDetailResponse` (sheet blocks, tokens, NA matrix, sample docs).
`/api/jurisdictions/{code}` (`jurisdictionQueries.ts`) → `design2.ts:248`.
Both live reads, neither modelled anywhere. `clients.template_ref` in all three
points at nothing.

**Do instead:** these are legitimately deferrable — but as a *named* deferral
with a stated cost, which is the standard all three proposals set for
themselves. None of them names it, because none of them knew.

---

## 1. Proposal A — the minimal vertical slice

### A-1 (d) — **INJ-1 passes with the migration reverted. The headline injection is vacuous.**

`PROPOSAL-A-minimal.md` §5 makes `test_0004_backfill_is_observable_from_a_tenant_session`
the required injection: delete `SET LOCAL row_security = off` from
`_with_row_security_off`, and this test must fail. The backfill it proves is:

```sql
UPDATE fields SET state = 'pending' WHERE state IS NULL;
```

But §1.5 defines the column as:

```sql
ADD COLUMN state field_state NOT NULL DEFAULT 'pending'
```

On PostgreSQL 11+ an `ADD COLUMN ... NOT NULL DEFAULT <constant>` stores the
default in `pg_attribute.attmissingval` and **rewrites no rows**. Every existing
row therefore reads `'pending'` the instant the `ALTER` commits. The subsequent
`UPDATE ... WHERE state IS NULL` matches **zero rows on a correct database**.

**Concretely:** with the guard deleted, the `UPDATE` writes nothing (RLS) — and
with the guard present it also writes nothing (no candidate rows). The
post-condition `state = 'pending'` for both tenants holds in both cases, because
the `ALTER` produced it. **The injection cannot fail.** A reverted guard scores
full marks. This is precisely the failure `00-HOW-TO-EXECUTE §1.1` names, and
Proposal C §5.2 identifies the mechanism — *"`ADD COLUMN ... NOT NULL DEFAULT`
does not go through RLS. It also therefore does not **prove** anything"* — while
Proposal A builds its only RLS proof on top of it.

**MEASURED** (§6, transcript 1), postgres:18.4, owner role, table FORCED, two
seeded rows:

```
ALTER TABLE t ADD COLUMN state text NOT NULL DEFAULT 'pending';   ALTER TABLE
SELECT count(*) FROM t;              -- as owner, under FORCE  ->  0
UPDATE t SET state='x' WHERE state IS NULL;                    ->  UPDATE 0
-- then, bypassing RLS as superuser:
SELECT count(*) FROM t WHERE state IS NULL;                    ->  0
SELECT count(*) FROM t WHERE state='pending';                  ->  2
```

Both rows are already `'pending'` and the `UPDATE` had nothing to do. The
migration and the sabotaged migration are indistinguishable by any assertion
over `state`.

**Do instead:** the injection must be over a backfill whose source is a *column*,
not a constant — e.g. a real value migration, or A's own `audit_log.entity_id`
case. Or adopt B's structure (zero DML) and drop the claim, rather than
manufacturing a DML statement that has nothing to do.

### A-2 (f) — DEF-7 is a direct violation of the AGENTS.md hard rule

`PROPOSAL-A-minimal.md` §4 DEF-7 defers `golden_fields`, `reconciliations`,
`complaints`, `leaderboard`, justification: *"Back screens **deleted in
7f04340**."*

AGENTS.md, first hard rule: *"Never generate backend logic from the UI/screens.
The backend is upstream."* Deleting a table because a screen was deleted is
deriving the backend from the pixels. `7f04340`'s message is about what the
reference app draws.

Worse, it is internally incoherent with the live database: `rule_origin` already
carries `'reconciliation'` and `'complaint'` as Postgres enum labels
(`enums.ts:57-63`, confirmed live per `LIVE-DB-VERIFICATION:66-67`). A schema
asserting rules originate from complaints, with no `complaints` table, cannot
answer where a rule came from.

**Do instead:** B §7's argument, which reaches the same conclusion for
`leaderboard` on a *structural* ground (no `id`, a projection) and the opposite
conclusion for the other three. That is the correct shape of a do-not-build
argument.

### A-3 (a) — `delivery_receipt_steps` is a table with no reader, and A knows it

§1.9 spends a table, a composite FK, an index and an RLS policy on
`ReceiptStep`. `Delivery.receipt` (`entities.ts:281`) is an inline array on the
delivery, `DeliveriesResponse` (`endpoints.ts:610`) returns deliveries whole, and
`entities.ts:276` says the client *"renders the list verbatim"*. No query filters,
sorts or joins a step. A's justification — *"an audit trail inside a jsonb blob
cannot be constrained, indexed, or joined to a principal"* — asserts three
capabilities and then uses none: `who` is `text` in A's own DDL (§1.9), not a FK
to a principal. So the one advantage cited over jsonb is not taken.

**Do instead:** B §2.8's `receipt jsonb NOT NULL DEFAULT '[]'` + a
`jsonb_typeof = 'array'` CHECK, or keep the table and make `who` a composite FK
to `users` so the stated justification is true.

### A-4 (c) — `pages.class_engine` is an unconstrained uuid

§1.3 adds `class_engine uuid NULL` and §2's FK list omits it. So a page can
claim a classifier that does not exist, or one from another tenant. A's own
thesis is that composite FKs are what make cross-tenant reference structurally
impossible; this is the one column where it silently isn't applied. C §2.4 has
the FK (though see C-2 for its ordering bug).

### A-5 — `orders` `ADD COLUMN ... NOT NULL` with no default will fail

§1.1 adds `client_id uuid NOT NULL`, `external_ref text NOT NULL`,
`jurisdiction/state/county text NOT NULL`, `status text NOT NULL` with **no
DEFAULT**. A's own §1.1 acknowledges rows may exist. `ALTER TABLE ... ADD COLUMN
c NOT NULL` without a default raises `23502` on any non-empty table. A's answer
is §5 — but §5's mechanism (`SET LOCAL row_security = off` + `NO FORCE`) does
not help: the failure is a `NOT NULL` violation at DDL time, not an RLS filter.

**Credit where due:** A is the only proposal whose `audit_log` handling (§1.11)
correctly reasons that a backfill hits the `FOR EACH STATEMENT` trigger with
`0A000` and that the migration must **refuse rather than route around it**. Keep
that paragraph verbatim in whatever ships.

---

## 2. Proposal B — the complete model

### B-1 (c/f) — **`uq_users_workos` is the cross-tenant existence oracle `0001` exists to close.**

`PROPOSAL-B-full.md` §2.1:

```sql
CREATE UNIQUE INDEX uq_users_workos ON users (workos_user_id)
  WHERE workos_user_id IS NOT NULL;
```

B calls this *"the one deliberate cross-tenant constraint in the model"* and
defends it as *"safe only because the value is opaque and externally assigned —
it is not an existence oracle over anything a caller can guess."*

**That defence is wrong on the mechanism, not on the guess-rate.**
`0001_skeleton.py:154-179` measured that unique enforcement runs **before** the
policy's `WITH CHECK`, so a duplicate-key error is returned to a caller who
cannot read the row. Under this index:

> Tenant B's admin inserts a user with `workos_user_id = 'user_01H…'`.
> `23505 duplicate key value violates unique constraint "uq_users_workos"`
> ⟹ *some other tenant of this deployment employs that WorkOS user.*

The input is not guessed. WorkOS user ids are visible to anyone in the same
WorkOS organisation directory, appear in SSO assertions, and are exchanged
during onboarding. "Does my competitor's title shop run on this vendor, and is
this named examiner on their staff?" is answerable by one INSERT, from a role
that RLS otherwise denies every row. That is the oracle, restored by hand in the
one place B exempted itself from its own §1 convention.

**Do instead:** `UNIQUE (tenant_id, workos_user_id)`. If the product genuinely
needs global uniqueness, it belongs in the identity provider or in a
`SECURITY DEFINER` registration function that returns a generic 409 — not in an
index whose error text is the leak.

### B-2 (d) — Injection A tests a revision that is not shipped

§5.3 Injection A: *"Add a temporary revision `0018` that performs a real
backfill correctly … then delete the `SET LOCAL row_security = off` line."*

But §4 and §5.2 are emphatic that Plan 04 contains **zero DML**, enforced by
`test_plan04_revisions_contain_no_dml`. So `0018` is a fixture written solely to
be injected, deleted before merge, exercising a code path that appears in none of
`0004`–`0017`.

**What that proves:** that a hand-written test fixture can detect a silent
no-op. **What it does not prove:** anything about the fourteen revisions that
ship. And the grep-guard it defers to is itself weak: `test_plan04_revisions_
contain_no_dml` parses source for `INSERT`/`UPDATE`/`DELETE`/`op.execute`, which
does not catch `op.bulk_insert`, a `CREATE TABLE ... AS SELECT`, a `MERGE`, or
DML inside a `DO $$` block — and Plan 05's first seed migration will need the
recipe with no worked example in the tree.

**Do instead:** if the plan is DDL-only, say the injection is **not applicable**
and make the shipped proof `test_every_tenant_table_is_forced` (Injection C,
which is genuinely good — catalog-derived, count-matched, with a read-your-own-row
positive control). Then carry the RLS recipe as a documented helper with its own
unit test, not as a deleted revision.

### B-3 (f) — `orders.status NOT NULL DEFAULT 'received'` invents a label past OPEN

§2.2. B's own §2.0 quotes `enums.ts:93-96` — *"Do not invent a closed enum
here"* — and then supplies `'received'` as the default. `'received'` appears
nowhere in the contract, in `enums.ts`, or in `packages/mocks/src/`. It is a
one-member vocabulary invented to make an `ADD COLUMN` legal on a non-empty
table, and every row written before the Flask port carries it.

Same defect in C §2.3 (`DEFAULT 'arrived'`) — a *different* invented label,
which is the tell.

**Do instead:** `ADD COLUMN status text` (nullable), backfill under the guard
when the vocabulary is ruled, then `SET NOT NULL`. Nullable-and-honest beats
non-null-and-invented when the set is OPEN.

### B-4 (a) — `documents.doc_type` nullable contradicts B's own strongest argument

§2.3 defines `doc_type text` (nullable) while §2.3's prose argues `documents` is
the one table that must exist because *"a `doc_id` with no `documents` row is a
dangling citation — which violates principle 6 … at the storage layer"*. A
`documents` row with a null `doc_type` is a citation that names an instrument
without saying what instrument it is. C §2.5 has `doc_type text NOT NULL`.

### B-5 — B's `leaderboard` refusal is correct and should survive into the hybrid

§2.10. `LeaderboardCell` has no `id` (`entities.ts:314-325`), it is a projection
over three tables, and `no_truth_yet` is a server-owned threshold that
materialising would freeze (AGENTS.md: server owns all thresholds). This
contradicts `SCHEMA-GAP:35` and B is right to. Note also `endpoints.ts:373`
`LeaderboardResponse` is a response shape, which is consistent with a query.

---

## 3. Proposal C — evidence-first

### C-1 (c) — **`escalations`' FK to `rules` cannot be created. `rules` has no `tenant_id`.**

`PROPOSAL-C-evidence.md` §2.9:

```sql
FOREIGN KEY (tenant_id, rule_id) REFERENCES rules (tenant_id, id),
```

`0003_rules.py:8`: *"🔴 `rules` IS GLOBAL. **NO `tenant_id`**, NO POLICY, NO ROW
LEVEL SECURITY, and every one of those three is the ruling rather than an
omission."* `0003_rules.py:90` and `:208` confirm `PRIMARY KEY (id)`, single
column, with a comment explaining why the composite key is *not* used there.

**What breaks:** the statement raises `42703 column "tenant_id" referenced in
foreign key constraint does not exist` at migration time. The migration cannot
run. C listed this in its own what-was-not-checked ("I did not read
`0003_rules.py`"), which is honest and does not make the DDL run.

**Do instead:** `FOREIGN KEY (rule_id) REFERENCES rules (id)`, single column, as
B §3 correctly specifies (*"`rules` is not tenant-scoped, so FKs into it are
single-column `rule_id → rules(id)`. That asymmetry is correct"*). And note the
worse repair C's own §8 flirts with is the one `0003_rules.py:30-34` names
explicitly as forbidden: *"The tempting repair … is to give `rules` a
`tenant_id`. That is the ruling reversed by accident."*

**MEASURED** (§6, transcript 3): against a single-column-PK table standing in for
`rules`, `ADD CONSTRAINT … FOREIGN KEY (tenant_id, rule_id) REFERENCES g(tenant_id, id)`
→ `ERROR: 42703 column "tenant_id" referenced in foreign key constraint does not
exist`; the single-column form on the same pair succeeded. Separately confirmed
that the converse error is real too: a single-column FK **into** a composite-PK
table fails with `ERROR: there is no unique constraint matching given keys for
referenced table "parent"` — so the brief's item (c) holds in both directions,
and every tenant-table FK in all three proposals is correctly composite. The only
FK defects are this one and A-4's omission.

### C-2 (c) — forward reference: `pages` FK to `engines` before `engines` exists

§2.4 emits `pages_class_engine_fk … REFERENCES engines (tenant_id, id)`; §2.6
creates `engines`. C's §2 states the Alembic revision *"transliterates it
statement for statement"*. Executed in document order this is `42P01 relation
"engines" does not exist`. Same shape at §2.3 (`packages_accepted_by_fk` →
`users`, which §2.2 does create first, so that one is fine) and §2.7
(`field_readings` → `fields`, where `fields` is altered in §2.8 — the columns are
pre-existing so it survives, but only by luck).

**Do instead:** B §4's ruling — all FKs in one terminal revision — which B
justifies on exactly this ground (*"`fields.engine_id` points at `engines`,
which is created two revisions later"*). B saw the problem C has.

### C-3 (f) — `fields_settled_has_an_answer` makes the DB derive state from `value`

§2.8 C2:

```sql
CHECK (state = 'pending' OR value IS NOT NULL OR na_reason IS NOT NULL)
```

C files this under a comment reading *"THE TWO NA STATES ARE NEVER DERIVED FROM
value IS NULL"*, but the constraint does the inverse: it makes the legal values
of `state` a function of `value`/`na_reason`.

**Concrete input that breaks:** a field routed to review because the document it
should have come from is missing entirely — no value, and no `na_reason` yet
because *choosing between `NOT_FOUND` and `NOT_STATED` is the reviewer's
question*. `state = 'needs_review'`, `value = NULL`, `na_reason = NULL`. This
row is refused with `23514`. So the server cannot route the very case where the
two NA states must not be collapsed, and the pipeline's workaround will be to
pick one — which is the collapse AGENTS.md forbids, caused by the constraint
that claims to prevent it.

`enums.ts:30-32`: *"A null `value` with a null `na_reason` means 'not yet
extracted' — a pipeline state… **Never key anything off `value === null`.**"*
C reads that as licensing `pending` only. It says no such thing; it says do not
key off it at all.

**Do instead:** drop `fields_settled_has_an_answer`. Keep `fields_value_xor_na`
(sound) and keep **C4** (`fields_autoconfirmed_must_cite`), which is the best
single idea in any of the three proposals: it bites exactly where no human will
look again, and it leaves the `needs_review` failure shape storable so it can be
routed, per `entities.ts:96-101`.

### C-4 (a/b) — deferring `reports` and `deliveries` breaks two live reads

C §0 defers `reports`, `deliveries`. But `/api/orders/{id}/artifacts` is live
(`artifactQueries.ts`) and `Artifact` (`design.ts:139-147`) is keyed on
`report_id` with `filename, media_type, bytes, sha256, href`. And
`/api/orders/{id}/composition` (`releaseQueries.ts:11` → `design.ts:100`) carries
the server's `releasable`/`blocked_reason`/`seal_sha256`.

C's defence is that a report is *"a render of fields"* and losing one costs a
rerun. That is true of the PDF and false of the `sha256` seal and the delivery
receipt: a **digest recorded at transmission time** is evidence of what was sent,
and it is exactly as unrecomputable as a citation. `DeliveryStatus`
(`enums.ts:107-114`) has `digest_recorded` as a distinct member for that reason.
C's own thesis — order the schema by what cannot be retrofitted — argues *for*
`deliveries`, and C applied it to `field_readings` only.

### C-5 (d) — I4 injects a merge step Plan 04 does not contain

§6 I4 injects `DELETE FROM field_readings WHERE field_id = $1` into "the merge
step". Plan 04 is schema. There is no merge step to inject into; it arrives in
Plan 06/07. The assertion the injection defends (`RESTRICT` on the FK, INSERT-only
trigger) is real and testable now — but as written the injection cannot be
performed against the artifact under review, so it is an injection over a
hypothetical.

Also §5.1's `writable()` helper has a correctness bug: the `finally` block
re-emits `FORCE ROW LEVEL SECURITY` per table, but the whole thing is inside the
migration transaction, so on exception the `ALTER` statements run in an aborted
transaction and raise `25P02`, masking the original error. Use the transaction's
own rollback (the `ALTER` is DDL and is transactional) and drop the `finally`.

### C-6 — C's `engines.reports_confidence` / `reports_line_coords` is the best column pair in the three

§2.6. AGENTS.md: *"capabilities declared, not faked."* Two booleans make a NULL
`confidence_raw` readable as *this engine has none* rather than *this call lost
one*, and they make the paired constraint trigger possible. Neither A nor B has
this. Keep it.

### C-7 — C's §5.2 table is right about FKs and **wrong about `SET NOT NULL`**

C's §5.2 puts three statement kinds in one row, all marked "YES, needs the
guard", on one shared argument: *"validation is a scan performed as the owner,
and under FORCE the owner sees zero rows."* C flags the whole row as reasoned,
not measured, and makes measuring it task 1 of Plan 04. Measured (§6,
transcripts 2 and 2b):

- **`ADD CONSTRAINT … FOREIGN KEY` on a populated table: C IS RIGHT, and it is
  worse than C wrote.** With a genuine orphan row present, the `ALTER TABLE`
  **succeeded**, and `pg_constraint.convalidated` is `t`. Not `NOT VALID` — the
  database believes it validated. The orphan survives, readable by a superuser.
  So the schema carries a referential guarantee that was never checked, and
  nothing anywhere reports it. C's phrase *"ships a referential graph nobody
  verified"* is exactly correct and is now measured rather than argued.
- **`SET NOT NULL` on a populated column: C IS WRONG.** With a NULL row present
  and the table FORCED, `ALTER TABLE n ALTER COLUMN v SET NOT NULL` raised
  `ERROR: column "v" of relation "n" contains null values`. It fails loudly.
  The null-scan is not RLS-filtered.

**Why the split matters, and it is not a technicality:** the two statements do
not share a failure mode, so they must not share a mitigation. `SET NOT NULL`
needs no guard and gets a loud error for free. The FK needs the guard **and** a
verification that is not a `SELECT` on the owner connection. C's table would
have had a plan wrapping both in `writable()`, which is harmless for the FK and
pointless for `SET NOT NULL` — but the real cost is that a single "constraint
validation is unsafe" heading obscures that **only one of them is silent**, and
silence is the whole problem.

**Do instead:** split the row. And add the injection C's own framework demands
but did not write: after `0016`, seed an orphan through the app role, run the FK
revision, and assert the migration **fails**. Under B's ordering (tables empty at
`0016`) this cannot bite in Plan 04 — but it will bite the first FK added after
Plan 07, so the assertion belongs in the tree now, while someone still knows why.

---

## 4. Ranking

| | A (minimal) | B (full) | C (evidence) |
|---|---|---|---|
| fatal-as-written | INJ-1 is vacuous (A-1, **measured**) | `uq_users_workos` oracle (B-1) | `rules` FK cannot exist (C-1, **measured** `42703`) |
| hard-rule violations | 1 (DEF-7, schema from pixels) | 1 (invented `'received'`) | 2 (invented `'arrived'`; state derived from value) |
| impossible/missing FKs | 1 omitted | 0 | 1 impossible, 1 forward-ref |
| live-endpoint coverage | worst | middle | middle (best on `pages`) |
| injection quality | 1 of 6 vacuous, and it is the headline | 1 of 3 vacuous, 1 (C) excellent | 2 of 4 excellent, 1 hypothetical, §5.2 half wrong (C-7) |
| unique correct insight | `audit_log` must refuse, not route around | `leaderboard` is a projection; FKs in one terminal revision; RLS last | C4 citation constraint; declared capabilities; FK-validates-nothing (**now measured true**) |

**Ranked: B > C > A.**

B is ahead because its two structural rulings — **FKs in one terminal revision**
and **RLS as the last revision** — eliminate whole classes of the failure the
other two spend their injections trying to detect. Its fatal defect is one index.

C is second: its best ideas (C4, declared capabilities, the §5.2 table of which
statements the guard actually covers) are the sharpest thinking in the set, but
its DDL does not run and one of its constraints violates a hard rule.

A is third. Its cost-benefit case is coherent, but its single required proof
cannot fail, and DEF-7 breaks the repo's first hard rule while citing a commit
message about pixels as the reason.

---

## 5. Build this: hybrid, B-structured

**Take B's skeleton.** 14 revisions `0004`–`0017`, DDL-only, FKs in `0016`,
RLS in `0017`. Specifically from B: §1 conventions, §2.0 enum policy (labels as
literals, explicit `DROP TYPE`), §2.3 `documents` + `uq_packages_tenant_sha`,
§2.6 `engine_routing`'s three `NOT NULL` approval columns, §2.7's
`ck_escalation_resolution_needs_rule`, §2.8 `deliveries.receipt` as jsonb+CHECK,
§2.10 `ck_golden_correction_triple`, §2.11 (`audit_log` gets no `updated_at`),
§3's `RESTRICT`-by-default delete policy, §4's ordering rationale, §5.3
Injection C, and §7's build-three-not-`leaderboard` verdict.

**Replace from C:** §2.8's C1 (three-column exclusion audit + non-empty reason),
**C4** `fields_autoconfirmed_must_cite`, `fields_excerpt_reconstructs_snippet`,
§2.6 `engines.slug` + `reports_confidence` + `reports_line_coords`, §2.7's
`engine_run_id` FK on `field_readings`, §2.4's `read_in_full`/`kind`/`degraded`,
§2.5's `documents.label`/`recorded_ref`/`doc_type NOT NULL`, §4's index set
(especially `fields_uncited_idx`, the partial index over principle-6 defects),
§5.2's statement-by-statement guard table, and §6's I1/I2/I3 with their positive
controls. **Drop C's `fields_settled_has_an_answer`.**

**Replace from A:** §1.11's `audit_log` ruling — the migration must fail with
`0A000` rather than find a way around append-only — and §3's catalog-level
assertion that *every* unique index on a `tenant_id`-bearing table leads with
`tenant_id`. That generalised assertion is the thing that would have caught B-1
automatically, and it is A's most durable contribution.

**Then fix, before writing a line of DDL:**

1. `escalations.rule_id` → single-column FK to `rules(id)` (C-1).
2. `uq_users_workos` → `UNIQUE (tenant_id, workos_user_id)` (B-1).
3. `orders.status` nullable `text`, no invented default (B-3, and C §2.3).
4. Add `orders.addr`, `orders.place`, `orders.assigned_to` (FK → `users`), and
   `orders.stage` as an enum with `design.ts:12-20`'s seven labels (S-1).
5. `clients` gains `code`, `product_ids`, `signoff_defaults`; add
   `client_overrides` (S-2).
6. Add `countersigns` with `CHECK (ruled_by <> countersigned_by)` (S-3).
7. Add `page_texts(tenant_id, id, page_id, engine_id, lines text[])` +
   `pages.text_of_record_engine_id` (S-4).
8. Name `templates` and `jurisdictions` as explicit deferrals with costs (S-5).
9. Measure C §5.2's open question — *does `ALTER TABLE … ADD CONSTRAINT` /
   `VALIDATE` scan under forced RLS?* — as task 1, on the live postgres:18.4.
   Under B's structure (FKs added while tables are empty, RLS not yet forced) the
   answer does not gate `0016`, but it gates every FK added after Plan 07 and it
   is a ten-minute measurement.
10. Rewrite the headline injection. A's is vacuous and B's is over a deleted
    fixture. Under a DDL-only plan the shipped proof is B's Injection C
    (catalog-derived forced-RLS coverage, count-matched, with a
    read-your-own-row positive control) plus C's I2/I3, which inject against
    constraints that actually ship.

**Open, and not resolvable here:** `segmentation_state`'s label set. All three
proposals invented a *different* four-label set — A `pending|segmented|ambiguous|
failed`, B `unsegmented|proposed|confirmed|conflict`, C `unsegmented|provisional|
confirmed|conflicted`. Three independent inventions is the proof that it is
unruled. Ship the column as `text`, no CHECK, and gate the enum on G2.

---

## 6. Measurement transcripts

Run 2026-09-02 against the live `postgres:18.4` container
`titlepipe-db-postgres-1`, in a throwaway database `advrev` created for this
review, using a non-superuser role `own` as table owner to reproduce
`titlepipe_owner`'s position. **Nothing in the `titlepipe` database was touched.**
Reproduce or refute with the blocks below.

Setup common to all: table owned by `own`, `ENABLE` + `FORCE ROW LEVEL SECURITY`,
policy `USING (tenant_id = current_setting('app.current_tenant', true)::uuid)`,
and `app.current_tenant` never set — which is the migration connection's state.

### Transcript 1 — `ADD COLUMN NOT NULL DEFAULT` under FORCE (kills A's INJ-1)

```sql
CREATE TABLE t (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
                PRIMARY KEY (tenant_id, id));
INSERT INTO t (tenant_id) VALUES ('1111…'),('2222…');          -- INSERT 0 2
ALTER TABLE t ENABLE ROW LEVEL SECURITY;
ALTER TABLE t FORCE  ROW LEVEL SECURITY;
CREATE POLICY iso ON t USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE t ADD COLUMN state text NOT NULL DEFAULT 'pending';  -- ALTER TABLE
SELECT count(*) FROM t;                                          -- 0   (owner, FORCED)
UPDATE t SET state='x' WHERE state IS NULL;                      -- UPDATE 0
RESET ROLE;                                                      -- superuser, bypasses RLS
SELECT count(*) FROM t WHERE state IS NULL;                      -- 0
SELECT count(*) FROM t WHERE state='pending';                    -- 2
```

The `ALTER` populated both rows without an RLS-filtered write. The `UPDATE` was
a no-op **for a reason unrelated to RLS**, so deleting the RLS guard changes
nothing observable. A's required injection cannot fail.

### Transcript 2 — FK added under FORCE over a real orphan (confirms C §5.2's FK row)

```sql
CREATE TABLE parent (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
                     PRIMARY KEY (tenant_id,id));
CREATE TABLE child  (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
                     parent_id uuid, PRIMARY KEY (tenant_id,id));
-- an orphan: references a parent row that does not exist
INSERT INTO child (tenant_id, parent_id) VALUES ('1111…','9999…');   -- INSERT 0 1
ALTER TABLE child ENABLE ROW LEVEL SECURITY;
ALTER TABLE child FORCE  ROW LEVEL SECURITY;
CREATE POLICY iso ON child USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE child ADD CONSTRAINT fk
  FOREIGN KEY (tenant_id,parent_id) REFERENCES parent(tenant_id,id);  -- ALTER TABLE  ✅ NO ERROR

RESET ROLE;
-- orphan still present, counted with RLS bypassed:                      1
SELECT conname, convalidated FROM pg_constraint WHERE conname='fk';   -- fk | t
```

**A constraint the catalog reports as validated, over a table that violates it.**
This is the review's most serious systemic finding: it is silent, it is on Plan
04's headline deliverable, and no existing test covers it.

### Transcript 2b — `SET NOT NULL` under FORCE (refutes C's other row)

```sql
CREATE TABLE n (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(),
                v text, PRIMARY KEY (tenant_id,id));
INSERT INTO n (tenant_id, v) VALUES ('1111…', NULL);
ALTER TABLE n ENABLE ROW LEVEL SECURITY;  ALTER TABLE n FORCE ROW LEVEL SECURITY;
CREATE POLICY iso ON n USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

ALTER TABLE n ALTER COLUMN v SET NOT NULL;
-- ERROR:  column "v" of relation "n" contains null values
```

Loud, not silent. C's §5.2 groups this with the FK case; it does not belong there.

### Transcript 3 — composite/single FK key-shape rules (brief item (c))

```sql
-- composite FK INTO a single-column-PK table (C's escalations → rules):
CREATE TABLE g (id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY);
ALTER TABLE c3 ADD CONSTRAINT ok  FOREIGN KEY (rule_id) REFERENCES g(id);
-- ALTER TABLE  ✅
ALTER TABLE c3 ADD CONSTRAINT bad FOREIGN KEY (tenant_id, rule_id) REFERENCES g(tenant_id, id);
-- ERROR:  42703: column "tenant_id" referenced in foreign key constraint does not exist
--   LOCATION: transformColumnNameList, tablecmds.c:13344

-- single-column FK INTO a composite-PK table (the converse):
ALTER TABLE c2 ADD CONSTRAINT fk1 FOREIGN KEY (parent_id) REFERENCES parent(id);
-- ERROR:  there is no unique constraint matching given keys for referenced table "parent"
```

Both directions confirmed. The composite-FK convention shared by all three
proposals is forced and correct; C-1 is the single place it is misapplied.

### What was NOT measured

- Nothing was run against the `titlepipe` database or its migrations; `alembic
  upgrade` was not invoked, so no proposal's DDL is syntax-verified as a whole.
- B-1's `uq_users_workos` oracle is reasoned from `0001_skeleton.py:154-179`'s
  own measurement (unique enforcement precedes the policy's `WITH CHECK`), not
  re-measured here. It is the same mechanism the skeleton already recorded.
- The CHECK constraints, jsonb subscript expressions and partial indexes in all
  three proposals were not executed.
- No `EXPLAIN` was run, so every "index must lead with `tenant_id`" claim
  (all three proposals, and §5 item 9) remains a consequence of the policy shape
  rather than an observed plan.
- The `advrev` database and the `own` role were **dropped after measuring**; the
  host is back to its prior state (`DROP DATABASE advrev`, `DROP ROLE own`, both
  confirmed). Re-create them to reproduce.

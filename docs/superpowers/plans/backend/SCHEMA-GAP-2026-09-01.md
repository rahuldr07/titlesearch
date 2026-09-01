# Schema gap, measured 2026-09-01

Third companion to `LEAD-MEASUREMENTS-2026-09-01.md`. Counted by the lead from
the migrations and the contract, not taken from a document's description of
either.

Method: columns in `services/core-api/migrations/versions/0001_skeleton.py` and
`0003_rules.py`, against the entity shapes in
`packages/contract/src/entities.ts` that the frontend actually consumes.

---

## Tables

| table | columns today | columns the contract needs | gap |
|---|---:|---:|---|
| `tenants` | 2 | ? | — |
| `orders` | 3 | 13 | **+10** |
| `packages` | 3 | ? | — |
| `pages` | 3 | ? | — |
| `fields` | 4 | 21 | **+17** |
| `field_readings` | 4 | 10 | **+6** |
| `audit_log` | 3 | ? | — |
| `rules` | 9 | 9 | 0 |
| `escalations` | — | 13 | **table missing** |
| `reports` | — | 7 | **table missing** |
| `deliveries` | — | 8 | **table missing** |
| `engines` | — | 4 | **table missing** |
| `engine_routing` | — | 8 | **table missing** |
| `blind_entries` | — | 5 | **table missing** |
| `bugs` | — | 6 | **table missing** |
| `golden_fields` | — | 10 | **table missing** |
| `reconciliations` | — | 10 | **table missing** |
| `complaints` | — | 9 | **table missing** |
| `leaderboard` | — | 8 | **table missing** |

**31 columns exist. The contract needs at least 141**, and that count omits
`tenants`, `packages`, `pages` and `audit_log`, whose real shapes the contract
does not describe because the frontend never reads them directly.

Ten tables do not exist at all. Four of them — `golden_fields`,
`reconciliations`, `complaints`, `leaderboard` — back screens deleted in
`7f04340`, so whether they are ever built depends on the same unruled boundary
question `ENDPOINT-RECONCILIATION-2026-09-01.md` closes with.

## Only three columns in the skeleton are real

`0001` creates seven tables out of four helpers: `_identity_columns()` (`id`,
`created_at`), `_tenant_column()`, `_tenant_primary_key()`, plus exactly two
typed columns — `fields.na_reason` and `field_readings.line_coords`
(`0001_skeleton.py:283-297`). Everything else is identity and tenancy.

This is the decision, not an omission, and the file says so at line 6: the
skeleton exists so **RLS could be proven against something** before the real
model landed. `01-WHAT-HAPPENED.md` is blunt that the schema was the easy part
and the proof was the work.

The consequence for planning: the real data model is not an increment on this
skeleton. It is the first time the model gets written at all, and it must be
written *under* forced RLS, where — measured and recorded at
`0001_skeleton.py:22-40` — a data migration that forgets
`SET LOCAL row_security = off` **does nothing and reports success**:

```
UPDATE orders SET tenant_id = tenant_id;   ->  UPDATE 0
SELECT count(*) FROM orders;               ->  0
```

No error, no warning, exit 0. Every column-adding migration in every later plan
runs into that.

## What the gap is concentrated in

`fields` is the worst single gap at +17, and it is the table the whole product
turns on. The contract's `Field` carries the provenance envelope
(`source_doc_id`, `source_page`, `source_snippet`, `source_line_coords`), the
engine attribution (`engine_id`, `engine_confidence_raw`), the rulebook link
(`rule_refs`), the approval record (`approved_by`, `approved_at`), the
suppression record (`excluded_reason`, required, because an excluded row is
gone from the delivered sheet and the reason is the only auditable trace), and
the server-authored review question (`asking`, `why`, and the exposure claim).

Three of those are load-bearing for rules the repo treats as non-negotiable:
provenance on everything (principle 6), `excluded_reason` for R13/R15
suppression audit, and `asking`/`why` being server-authored so the browser
never narrates why the pipeline routed something.

`field_readings` at +6 is where the per-engine record lives: `cost_usd` and
latency per call, which the adapter rules require and which no current column
holds.

## The unruled enum still sits under all of it

`fields.na_reason` is one of the two real columns, and it is the one with the
open conflict: `0001` wrote four labels citing nothing, PRD §7 says two,
CONTEXT §11 describes three. It is already in the database as a Postgres ENUM,
so changing it later is a migration on a live type rather than an edit. Nothing
has been written to `fields` yet, which is the only reason the cost is still
low. That window closes the moment the first plan populates it.

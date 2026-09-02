# `GET /api/queue/bands` count-mechanism benchmark — MEASURED 2026-09-02

The rig behind `NORMALIZATION-AUDIT.md` §4.2.1. It exists so the M1-vs-M3 decision is
reproducible rather than re-argued.

**This is a throwaway benchmark database, not a migration.** It builds `bandbench`, not
`titlepipe`, and it is not wired into alembic. The schema here is a hand-written snapshot of
`0001_skeleton.py` + PROPOSAL-B §2.2/§2.4 columns; if those revisions change, this diverges
and the numbers expire.

## Run

```sh
docker exec titlepipe-db-postgres-1 psql -U postgres \
  -c "DROP DATABASE IF EXISTS bandbench" \
  -c "CREATE DATABASE bandbench OWNER titlepipe_owner"
for f in 01-schema 02-seed 03-rls 04-explain-no-index 05-indexes 06-explain-with-index 07-endpoint-and-rls-overhead; do
  docker cp "$f.sql" titlepipe-db-postgres-1:/tmp/
  docker exec titlepipe-db-postgres-1 psql -U postgres -d bandbench -f "/tmp/$f.sql" || break
done
```

**Do not edit `-d bandbench` in that loop.** These files are destructive DDL —
`CREATE TYPE`/`CREATE TABLE`, `ENABLE`/`FORCE ROW LEVEL SECURITY`, and
`GRANT USAGE ON SCHEMA public TO titlepipe_app` (`03-rls.sql`) — and a copy-paste
loop is exactly the shape that gets `-d titlepipe` substituted into it once. Every
`.sql` here therefore opens with `\set ON_ERROR_STOP on` and a `DO` block that
raises unless `current_database() = 'bandbench'`, so the substitution aborts on the
first file instead of rewriting the live schema. MEASURED 2026-09-02 against
`titlepipe-db-postgres-1`: `psql -d titlepipe -f 01-schema.sql` →
`ERROR: REFUSED: bench rig must run against bandbench, not titlepipe`, exit 3, and
`\dt` on `titlepipe` unchanged. The `|| break` above is what stops the loop from
walking through the remaining six refusals. Renaming the benchmark database means
editing the guard in all seven files, deliberately.

Seed takes ~23 s (3.3M rows). Drop `bandbench` when done; it is 771 MB of `fields` plus
~470 MB of indexes.

## What each step establishes

| File | Establishes |
|---|---|
| `01-schema.sql` | `orders`/`fields` at the proposed column count, `field_state` enum, `PRIMARY KEY (tenant_id, id)` |
| `02-seed.sql` | **Two** tenants — A: 20,000 orders × 132 fields = 2.64M; B: 5,000 orders = 660k. The second tenant is the point: without it the RLS predicate discards nothing and the plans lie. |
| `03-rls.sql` | `ENABLE` + `FORCE ROW LEVEL SECURITY`, the `0002` `tenant_isolation` policy, grants to `titlepipe_app` |
| `04` / `06` | `EXPLAIN (ANALYZE, BUFFERS)` for the same five queries without and with indexes |
| `05-indexes.sql` | `ix_fields_order_state`, the partial `ix_fields_open`, `ix_orders_status` |
| `07` | The full contract-shaped endpoint (4 censuses + 4 row lists), ×5, plus RLS-vs-`BYPASSRLS` overhead |

Every query runs `SET ROLE titlepipe_app` and `SET app.current_tenant`. **If you drop either
line the measurement is void** — as `postgres` the policy is bypassed and the plans differ.

## Headline numbers (see §4.2.1 for the full table)

- Full endpoint: **24.6–28.8 ms**. M1 confirmed, M3 unjustified.
- RLS overhead: **~0.13 ms**, inside noise. `current_setting()` folds into an `Index Cond`.
- Per-order count: **75 ms without `fields (tenant_id, order_id, state)`, 0.06 ms with it.**
  The index is a precondition of the M1 recommendation.

## What it does not measure

Concurrency (single connection), autovacuum/bloat under churn, production hardware, and a
realistic band-size distribution. It establishes an order of magnitude, not an SLO.

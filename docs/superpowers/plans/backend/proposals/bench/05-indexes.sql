\set ON_ERROR_STOP on
-- GUARD (do not remove). Every file in this directory is destructive DDL plus a
-- GRANT to the application role. Run against `titlepipe` and it rewrites the live
-- schema. The rig is only ever valid against the throwaway `bandbench` database,
-- so each file refuses to do anything anywhere else. `ON_ERROR_STOP` above is what
-- turns the refusal into a non-zero exit instead of a skipped statement.
DO $guard$ BEGIN
  IF current_database() <> 'bandbench' THEN
    RAISE EXCEPTION 'REFUSED: bench rig must run against bandbench, not %', current_database();
  END IF;
END $guard$;

-- uq_fields_order_path is PROPOSAL-B §2.4; created here with the other indexes so the
-- no-index baseline in 04 is genuinely index-free.
\timing on
CREATE UNIQUE INDEX uq_fields_order_path ON fields (tenant_id, order_id, path);
CREATE INDEX ix_fields_order_state ON fields (tenant_id, order_id, state);
-- partial index: the "open work" subset the band census actually cares about
CREATE INDEX ix_fields_open ON fields (tenant_id, order_id) WHERE state IN ('pending','escalated','countersign');
CREATE INDEX ix_orders_status ON orders (tenant_id, status);
CREATE INDEX ix_orders_assigned ON orders (tenant_id, assigned_to) WHERE delivered_at IS NULL;
VACUUM (ANALYZE) fields; VACUUM (ANALYZE) orders;

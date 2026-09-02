-- uq_fields_order_path is PROPOSAL-B §2.4; created here with the other indexes so the
-- no-index baseline in 04 is genuinely index-free.
\set ON_ERROR_STOP on
\timing on
CREATE UNIQUE INDEX uq_fields_order_path ON fields (tenant_id, order_id, path);
CREATE INDEX ix_fields_order_state ON fields (tenant_id, order_id, state);
-- partial index: the "open work" subset the band census actually cares about
CREATE INDEX ix_fields_open ON fields (tenant_id, order_id) WHERE state IN ('pending','escalated','countersign');
CREATE INDEX ix_orders_status ON orders (tenant_id, status);
CREATE INDEX ix_orders_assigned ON orders (tenant_id, assigned_to) WHERE delivered_at IS NULL;
VACUUM (ANALYZE) fields; VACUUM (ANALYZE) orders;

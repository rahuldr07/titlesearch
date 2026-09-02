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

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE orders  ENABLE ROW LEVEL SECURITY; ALTER TABLE orders  FORCE ROW LEVEL SECURITY;
ALTER TABLE fields  ENABLE ROW LEVEL SECURITY; ALTER TABLE fields  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants USING (id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation ON orders  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation ON fields  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
GRANT USAGE ON SCHEMA public TO titlepipe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, orders, fields TO titlepipe_app;
VACUUM (ANALYZE) orders; VACUUM (ANALYZE) fields;

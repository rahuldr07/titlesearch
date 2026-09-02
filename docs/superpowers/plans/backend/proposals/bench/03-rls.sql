\set ON_ERROR_STOP on
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY; ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE orders  ENABLE ROW LEVEL SECURITY; ALTER TABLE orders  FORCE ROW LEVEL SECURITY;
ALTER TABLE fields  ENABLE ROW LEVEL SECURITY; ALTER TABLE fields  FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants USING (id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation ON orders  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
CREATE POLICY tenant_isolation ON fields  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
GRANT USAGE ON SCHEMA public TO titlepipe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, orders, fields TO titlepipe_app;
VACUUM (ANALYZE) orders; VACUUM (ANALYZE) fields;

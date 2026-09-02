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

\timing on
INSERT INTO tenants (id) VALUES ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');

-- tenant A: 20,000 orders. tenant B: 5,000 orders (cross-tenant noise).
INSERT INTO orders (tenant_id, external_ref, jurisdiction, state, county, status, assigned_to, arrived_at, accepted_at, delivered_at)
SELECT t.tid,
       'ORD-'||g,
       'TX/Harris', 'TX', 'Harris',
       (ARRAY['received','in_review','held','in_flight','delivered'])[1 + (g % 5)],
       CASE WHEN g % 7 = 0 THEN '33333333-3333-3333-3333-333333333333'::uuid ELSE gen_random_uuid() END,
       now() - (g % 900) * interval '1 hour',
       CASE WHEN g % 5 <> 0 THEN now() - (g%800)*interval '1 hour' END,
       CASE WHEN g % 5 = 4 THEN now() - (g%100)*interval '1 hour' END
FROM (VALUES ('11111111-1111-1111-1111-111111111111'::uuid, 20000), ('22222222-2222-2222-2222-222222222222'::uuid, 5000)) AS t(tid, n),
     LATERAL generate_series(1, t.n) g;

-- 132 fields per order.
INSERT INTO fields (tenant_id, order_id, path, value, state, na_reason, source_page, engine_confidence_raw, rule_refs, updated_at)
SELECT o.tenant_id, o.id,
       'section'||(f % 12)||'.'||(f/12)||'.attr',
       CASE WHEN f % 11 = 0 THEN NULL ELSE 'value-'||f END,
       (ARRAY['pending','settled','escalated','countersign','approved','excluded'])[1 + ((f + o.pages_seed) % 6)]::field_state,
       CASE WHEN f % 11 = 0 THEN 'NOT_PRESENT'::na_reason END,
       1 + (f % 40),
       0.4 + (f % 60) / 100.0,
       ARRAY['R'||(f%40)],
       now() - (f % 300) * interval '1 minute'
FROM (SELECT id, tenant_id, (('x'||substr(md5(id::text),1,4))::bit(16)::int) AS pages_seed FROM orders) o,
     LATERAL generate_series(1, 132) f;

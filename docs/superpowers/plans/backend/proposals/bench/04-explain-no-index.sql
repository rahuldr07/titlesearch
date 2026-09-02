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

SET ROLE titlepipe_app;
SET app.current_tenant = '11111111-1111-1111-1111-111111111111';
\echo '########## Q1: contract-shaped band census (orders only), NO index'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT CASE WHEN o.assigned_to = '33333333-3333-3333-3333-333333333333' THEN 'mine'
            WHEN o.status = 'held' THEN 'held'
            WHEN o.status = 'delivered' THEN 'delivered'
            ELSE 'in_flight' END AS band,
       count(*)
FROM orders o
WHERE o.delivered_at IS NULL OR o.status = 'delivered'
GROUP BY 1;

\echo '########## Q2: full-tenant field-state census across ALL orders, NO index'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT f.state, count(*) FROM fields f GROUP BY f.state;

\echo '########## Q3: per-order decisions/settled rollup joined to band, NO index (the M3 motivator)'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT CASE WHEN o.status = 'held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
       count(*) FILTER (WHERE f.state <> 'excluded') AS decisions,
       count(*) FILTER (WHERE f.state = 'settled')   AS settled
FROM orders o JOIN fields f ON f.tenant_id = o.tenant_id AND f.order_id = o.id
GROUP BY 1;

\echo '########## Q4: single-order decisions count (the ~132-row claim), NO index'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT count(*) FILTER (WHERE state <> 'excluded'), count(*) FILTER (WHERE state = 'settled')
FROM fields WHERE order_id = (SELECT id FROM orders LIMIT 1);

SET ROLE titlepipe_app;
SET app.current_tenant = '11111111-1111-1111-1111-111111111111';
\echo '########## WARM Q1: band census on orders (WITH ix_orders_status / partial ix_orders_assigned)'
SELECT count(*) FROM orders; -- warm
EXPLAIN (ANALYZE, BUFFERS)
SELECT CASE WHEN o.assigned_to = '33333333-3333-3333-3333-333333333333' THEN 'mine'
            WHEN o.status = 'held' THEN 'held'
            WHEN o.status = 'delivered' THEN 'delivered'
            ELSE 'in_flight' END AS band, count(*)
FROM orders o WHERE o.delivered_at IS NULL OR o.status = 'delivered' GROUP BY 1;

\echo '########## WARM Q2: full field-state census (WITH indexes)'
EXPLAIN (ANALYZE, BUFFERS) SELECT f.state, count(*) FROM fields f GROUP BY f.state;

\echo '########## WARM Q3: join rollup (WITH indexes)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT CASE WHEN o.status = 'held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
       count(*) FILTER (WHERE f.state <> 'excluded') AS decisions,
       count(*) FILTER (WHERE f.state = 'settled')   AS settled
FROM orders o JOIN fields f ON f.tenant_id = o.tenant_id AND f.order_id = o.id GROUP BY 1;

\echo '########## WARM Q3b: same rollup restricted to OPEN fields via PARTIAL INDEX ix_fields_open'
EXPLAIN (ANALYZE, BUFFERS)
SELECT CASE WHEN o.status = 'held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
       count(*) AS open_fields
FROM orders o JOIN fields f ON f.tenant_id = o.tenant_id AND f.order_id = o.id
WHERE f.state IN ('pending','escalated','countersign') GROUP BY 1;

\echo '########## WARM Q4: single-order counts (WITH ix_fields_order_state)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FILTER (WHERE state <> 'excluded'), count(*) FILTER (WHERE state = 'settled')
FROM fields WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND order_id = (SELECT id FROM orders LIMIT 1);

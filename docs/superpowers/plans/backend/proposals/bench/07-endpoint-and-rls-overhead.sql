SET ROLE titlepipe_app;
SET app.current_tenant = '11111111-1111-1111-1111-111111111111';
\timing on
\echo '===== A: full contract-shaped /api/queue/bands (4 censuses + 4 row lists, LIMIT 50), warm, 5 runs'
WITH census AS (
  SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
              WHEN o.status='held' THEN 'held'
              WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band, count(*) AS c
  FROM orders o GROUP BY 1),
rows50 AS (
  SELECT band, id, external_ref FROM (
    SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held'
                WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
           o.id, o.external_ref,
           row_number() OVER (PARTITION BY CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END
                ORDER BY o.arrived_at) rn
    FROM orders o) s WHERE rn <= 50)
SELECT (SELECT count(*) FROM census), (SELECT count(*) FROM rows50);
WITH census AS (
  SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
              WHEN o.status='held' THEN 'held'
              WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band, count(*) AS c
  FROM orders o GROUP BY 1),
rows50 AS (
  SELECT band, id, external_ref FROM (
    SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held'
                WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
           o.id, o.external_ref,
           row_number() OVER (PARTITION BY CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END
                ORDER BY o.arrived_at) rn
    FROM orders o) s WHERE rn <= 50)
SELECT (SELECT count(*) FROM census), (SELECT count(*) FROM rows50);
WITH census AS (
  SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
              WHEN o.status='held' THEN 'held'
              WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band, count(*) AS c
  FROM orders o GROUP BY 1),
rows50 AS (
  SELECT band, id, external_ref FROM (
    SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held'
                WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
           o.id, o.external_ref,
           row_number() OVER (PARTITION BY CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END
                ORDER BY o.arrived_at) rn
    FROM orders o) s WHERE rn <= 50)
SELECT (SELECT count(*) FROM census), (SELECT count(*) FROM rows50);
WITH census AS (
  SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
              WHEN o.status='held' THEN 'held'
              WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band, count(*) AS c
  FROM orders o GROUP BY 1),
rows50 AS (
  SELECT band, id, external_ref FROM (
    SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held'
                WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
           o.id, o.external_ref,
           row_number() OVER (PARTITION BY CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END
                ORDER BY o.arrived_at) rn
    FROM orders o) s WHERE rn <= 50)
SELECT (SELECT count(*) FROM census), (SELECT count(*) FROM rows50);
WITH census AS (
  SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
              WHEN o.status='held' THEN 'held'
              WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band, count(*) AS c
  FROM orders o GROUP BY 1),
rows50 AS (
  SELECT band, id, external_ref FROM (
    SELECT CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held'
                WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END AS band,
           o.id, o.external_ref,
           row_number() OVER (PARTITION BY CASE WHEN o.assigned_to='33333333-3333-3333-3333-333333333333' THEN 'mine'
                WHEN o.status='held' THEN 'held' WHEN o.status='delivered' THEN 'delivered' ELSE 'in_flight' END
                ORDER BY o.arrived_at) rn
    FROM orders o) s WHERE rn <= 50)
SELECT (SELECT count(*) FROM census), (SELECT count(*) FROM rows50);
\echo '===== B: RLS overhead — same orders census as titlepipe_app (RLS) vs postgres (BYPASSRLS)'
EXPLAIN (ANALYZE, BUFFERS) SELECT o.status, count(*) FROM orders o GROUP BY 1;
RESET ROLE;
EXPLAIN (ANALYZE, BUFFERS) SELECT o.status, count(*) FROM orders o WHERE tenant_id='11111111-1111-1111-1111-111111111111' GROUP BY 1;

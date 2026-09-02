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

CREATE TYPE field_state AS ENUM ('pending','settled','escalated','countersign','approved','excluded');
CREATE TYPE na_reason AS ENUM ('NOT_PRESENT','NOT_FOUND','NOT_STATED','PRESENT_UNREADABLE');

CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  client_id uuid, external_ref text, jurisdiction text, state text, county text,
  status text NOT NULL DEFAULT 'received',
  assigned_to uuid,
  product text, period_label text, pages integer,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz, delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE fields (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL,
  order_id uuid,
  path text,
  value text,
  state field_state NOT NULL DEFAULT 'pending',
  na_reason na_reason,
  source_doc_id uuid, source_page integer, source_snippet text,
  source_line_coords jsonb, source_excerpt jsonb,
  engine_id uuid, engine_confidence_raw double precision,
  rule_refs text[] NOT NULL DEFAULT '{}',
  approved_by uuid, approved_at timestamptz,
  excluded_reason text, asking text, why text, consequence text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

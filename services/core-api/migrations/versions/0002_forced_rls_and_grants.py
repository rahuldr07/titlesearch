"""Forced row-level security, the `tenant_isolation` policies, and the grants

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-05

`0001` created the tables. This makes them isolated, and the split is what lets
"the tables exist" and "the tables are isolated" be separately reversible.

Three things land here, and the third is the one that is easy to forget:

* `ENABLE` **and** `FORCE ROW LEVEL SECURITY` on all seven. `ENABLE` alone
  exempts the table's OWNER, and the owner is `titlepipe_owner` — the role every
  migration runs as. `FORCE` is what removes that exemption;
* one `tenant_isolation` policy per table, keyed on `tenant_id` everywhere and on
  `id` on `tenants`, whose primary key IS a tenant id;
* **the GRANTs.** RLS is evaluated AFTER the privilege check, never instead of
  it. MEASURED 2026-08-05 against postgres:18.4 — `titlepipe_worker`, which holds
  no table grant, reading a table with a policy on it:

      ERROR:  42501: permission denied for table orders

  Without the grants `titlepipe_app` gets the same, and a read test written to
  prove isolation would pass for entirely the wrong reason: zero rows because the
  role cannot open the table at all, reported as zero rows because the policy
  filtered them.

## 🔴 WHAT THIS REVISION DOES TO EVERY DATA MIGRATION WRITTEN AFTER IT

`FORCE ROW LEVEL SECURITY` makes every tenant table invisible to
`titlepipe_owner`, and `titlepipe_owner` is who `migrations/env.py` runs as.
MEASURED 2026-08-05 against postgres:18.4, two seeded rows in `orders`
belonging to two different tenants, connected as `titlepipe_migration` and
`SET ROLE titlepipe_owner`:

    UPDATE orders SET tenant_id = tenant_id;   ->  UPDATE 0
    SELECT count(*) FROM orders;               ->  0

No error. **A data migration written after this one is a silent no-op**, and it
reports success.

THE REMEDY, AND IT IS TWO STATEMENTS RATHER THAN ONE. Both measured in the same
session:

    BEGIN;
    SET LOCAL row_security = off;                          -- the guard
    ALTER TABLE orders NO FORCE ROW LEVEL SECURITY;        -- the permission
    UPDATE orders SET tenant_id = tenant_id;               -- UPDATE 2
    ALTER TABLE orders FORCE ROW LEVEL SECURITY;
    COMMIT;

`SET LOCAL row_security = off` is the half that must never be omitted, because
it is the half that turns silence into noise. With `FORCE` still in place it
does not permit the write — it REFUSES it:

    ERROR:  42501: query would be affected by row-level security policy
                   for table "orders"
    HINT:   To disable the policy for the table's owner, use
            ALTER TABLE NO FORCE ROW LEVEL SECURITY.

So a data migration that sets it and forgets the `NO FORCE` fails loudly and
names its own fix, where the same migration without it writes nothing and exits
0. `SET LOCAL` rather than `SET`: it is undone by the enclosing transaction, and
`env.py`'s connection is reused for the whole `upgrade`.

`ALTER TABLE ... NO FORCE` is DDL, so it is inside the migration's transaction
and rolls back with everything else if any later statement fails. It is not a
window during which another session sees unfiltered rows: the `ALTER TABLE`
takes `ACCESS EXCLUSIVE`, so no other session reads the table at all until the
transaction ends.

`tests/test_forced_rls_and_grants.py::test_a_migration_shaped_write_is_a_silent
_no_op_until_it_says_so` pins both halves — the silent `UPDATE 0` and the
`42501` — so neither claim above is only a comment.

**REJECTED: a second policy that lets the owner through**, e.g.
`USING (current_setting('app.migration', true) = 'on')`. Any role can `SET` its
own custom GUC — MEASURED, `titlepipe_app` sets `app.current_tenant` freely in
`tests/test_forced_rls_and_grants.py` — so that policy is a bypass switch
available to the one role it must never be available to. The escape hatch has to
be a privilege (`ALTER TABLE`, which only the owner holds), not a setting.

## The two counter-intuitive claims, re-measured 2026-08-05

**`USING` alone refuses a cross-tenant INSERT, with no `WITH CHECK` present.**
There is no `WITH CHECK` clause below and that is not an omission: PostgreSQL
uses the `USING` expression as the `WITH CHECK` when none is given. As
`titlepipe_app` with `app.current_tenant` set to tenant 1:

    INSERT INTO orders (tenant_id) VALUES ('2222…');
    ERROR:  42501: new row violates row-level security policy for table "orders"

    INSERT INTO orders (tenant_id) VALUES ('1111…');   -- succeeds

**`current_setting(x, true)` and `nullif(…, '')` guard DIFFERENT absences, and
only both together give a clean denial.** Measured on one `titlepipe_app`
session:

    never set                                    -> current_setting(…) IS NULL
    SET LOCAL … = '1111…' then ROLLBACK          -> current_setting(…) = ''
    nullif(current_setting(…), '') IS NULL       -> true for both

`current_setting(x, true)` answers NULL for a GUC that was never defined; the
second argument is what stops it raising `unrecognized configuration parameter`.
It does NOT answer NULL for a GUC that was set and then reverted — PostgreSQL
restores the value the transaction started with, and for a never-previously-set
custom GUC that value is the EMPTY STRING, not undefined. `''::uuid` raises:

    -- policy written without nullif, GUC set to ''
    SELECT count(*) FROM packages;
    ERROR:  invalid input syntax for type uuid: ""

A 500 where a clean denial belongs. `tests/conftest.py::SEAM_CONNECT_ARGS` pins
every connection in the suite at `''` on purpose, so that is the ordinary state
of an unestablished session rather than an exotic one.

## Written out per table rather than generated from a list

Seven `_isolate(...)` calls and eight `GRANT` lines, for the reason `0001`
records: each object gets one reviewable line, the one table whose key column
differs is visible at its own call site, and the one grant that differs from the
other six is a line of its own rather than a branch inside a loop.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# One name on every table, so a policy can be looked for by name rather than by
# "whatever is on this table".
POLICY_NAME = "tenant_isolation"

# The session setting the policies read. Spelled here rather than imported from
# `tests/conftest.py` — a migration is a frozen snapshot and cannot import test
# code — and `tests/test_forced_rls_and_grants.py` asserts the live `pg_policies`
# text against the `tenant_guc` fixture, which is what keeps the two honest.
TENANT_GUC = "app.current_tenant"

# The three roles that must be able to see INTO schema `public`.
#
# `titlepipe_owner` is in the list and it is the one that looks redundant. What
# it is NOT redundant against is a cluster hardened with `REVOKE USAGE ON SCHEMA
# public FROM PUBLIC`, on which every migration breaks. MEASURED 2026-08-05
# against postgres:18.4 with exactly that revoke in place, as `titlepipe_owner`:
#
#     SELECT count(*) FROM orders;      -> ERROR: relation "orders" does not exist
#     CREATE TABLE hardened_probe (…);  -> ERROR: no schema has been selected to create in
#
# 🔴 THE REASON GIVEN HERE FOR KEEPING IT WAS FALSIFIED ON 2026-08-06 AND THE
# LINE STAYS ANYWAY. It read: the owner "holds `CREATE` on `public` from
# `roles.sql` and USAGE only from `PUBLIC`". The second half stopped being true
# when `roles.sql` started granting `USAGE` explicitly —
# `migrations/sql/roles.sql:942` names `titlepipe_owner`, `titlepipe_app` and
# `titlepipe_worker`, and the read-back immediately below it REFUSES the run
# when any of the three has no EXPLICIT entry in `pg_namespace.nspacl`. So on a
# cluster `roles.sql` has finished on, the owner's USAGE is its own and not
# `PUBLIC`'s. Naming the owner here is now belt-and-braces plus a statement of
# who has to see into the schema, which is what this constant is for; the
# read-back in `_require_schema_usage` is what would notice if it were not there.
#
# `titlepipe_blind` is deliberately absent. It belongs to blind-svc, which is
# intended to live in a SEPARATE database — see `roles.sql`'s header.
SCHEMA_USAGE_ROLES = ("titlepipe_owner", "titlepipe_app", "titlepipe_worker")


def _tenant_predicate(key_column: str) -> str:
    """`<key> = nullif(current_setting('app.current_tenant', true), '')::uuid`.

    Built in one place so that the `nullif` cannot be present on six tables and
    missing from the seventh by a typo. `key_column` is `tenant_id` on the six
    tenant tables and `id` on `tenants`, whose primary key IS a tenant id.

    Not parameterised, and it cannot be: a policy expression is DDL text, not a
    statement with bind parameters. Both interpolated values are constants in
    this file.
    """
    return f"{key_column} = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"


def _isolate(table: str, key_column: str) -> None:
    """`ENABLE`, `FORCE`, and one policy — the three statements, in this order.

    `ENABLE` before `FORCE` because `FORCE` alone is not a thing: it removes the
    owner's exemption from a mechanism that has to be switched on first.

    `CREATE POLICY` last so that there is no instant, even inside this
    transaction, at which the table has RLS on and no policy — which denies every
    row to every non-bypassing role. Ordering inside one transaction changes
    nothing another session can observe; it changes what a reader of this file
    has to hold in their head.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({_tenant_predicate(key_column)})")


def _release(table: str) -> None:
    """The inverse of `_isolate`, in the inverse order.

    No `IF EXISTS` on the `DROP POLICY`, for the reason `0001` gives for
    `checkfirst=False`: a policy that is already gone at downgrade time means
    something removed it, and that must be an error rather than a shrug.

    `NO FORCE` and `DISABLE` are both issued. `DISABLE ROW LEVEL SECURITY` leaves
    `relforcerowsecurity` set — the two are separate columns in `pg_class` and
    neither clears the other — so a downgrade that issued only the second would
    leave `relforcerowsecurity = true` behind on a table with no RLS, which the
    next `upgrade` would then not notice.
    """
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _require_schema_usage() -> None:
    """Read the schema privilege back, and refuse if the GRANT above did nothing.

    ---------------------------------------------------------------------------
    🔴 `GRANT USAGE ON SCHEMA public` FROM THIS MIGRATION IS A NO-OP ON THE
       CLUSTER THIS SUITE RUNS AGAINST, AND POSTGRESQL REPORTS THAT AS A WARNING.
    ---------------------------------------------------------------------------
    Schema `public` is owned by `pg_database_owner` from PostgreSQL 15 on.
    `titlepipe_owner` is not the database owner and holds no grant option on the
    schema, so it cannot give the privilege away. MEASURED 2026-08-05 against
    postgres:18.4, as `titlepipe_migration` with `SET ROLE titlepipe_owner`:

        GRANT USAGE ON SCHEMA public TO titlepipe_app, titlepipe_worker;
        WARNING:  no privileges were granted for "public"
        GRANT
        -- pg_namespace.nspacl unchanged

    `ON_ERROR_STOP` never sees a WARNING and `op.execute` does not raise on one,
    so without this check the statement would run, do nothing, and report
    success. That is the identical failure mode `roles.sql` documents for its own
    `GRANT CREATE ON SCHEMA public` and answers the same way: read the privilege
    back, because "the statement ran" and "the privilege is there" are different
    claims.

    THIS IS NOT A CHECK THAT CAN NEVER FIRE, and the reachable shape is the
    realistic one. MEASURED in the same session, with
    `REVOKE USAGE ON SCHEMA public FROM PUBLIC` and USAGE granted explicitly to
    `titlepipe_owner` and `titlepipe_migration` only:

        migration DDL                                     -> works
        GRANT USAGE … TO titlepipe_app, titlepipe_worker  -> WARNING, no-op
        has_table_privilege('titlepipe_app','orders','SELECT') -> t
        has_schema_privilege('titlepipe_app','public','USAGE') -> f
        as titlepipe_app: SELECT count(*) FROM orders;
        -> ERROR: relation "orders" does not exist

    `titlepipe_app` holding SELECT on every table and being told the tables do
    not exist, off the back of a migration that exited 0. That is what this
    refuses. `tests/test_forced_rls_and_grants.py::test_the_migration_refuses_when
    _the_schema_grant_did_not_land` drives exactly that state.

    A `RuntimeError` rather than a `RAISE EXCEPTION` in SQL: the reader is an
    operator who has to change a grant, and `migrations/env.py` already refuses
    the offline case the same way.
    """
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            # `CAST(… AS text[])` is not decoration. psycopg sends a Python
            # list as an untyped array parameter and `unnest` is overloaded on
            # `anyarray` and `anymultirange`, so without it PostgreSQL answers
            # `42725 function unnest(unknown) is not unique / HINT: Could not
            # choose a best candidate function.` MEASURED 2026-08-05.
            "SELECT role FROM unnest(CAST(:roles AS text[])) AS role "
            "WHERE NOT has_schema_privilege(role, 'public', 'USAGE')"
        ),
        {"roles": list(SCHEMA_USAGE_ROLES)},
    ).all()
    missing = sorted(str(row[0]) for row in rows)

    if missing:
        raise RuntimeError(
            f"revision 0002 could not give {', '.join(missing)} USAGE on schema "
            f"public. PostgreSQL reports a GRANT from a role holding no grant "
            f"option as a WARNING rather than an error, so this migration would "
            f"otherwise have succeeded and left those roles unable to see any "
            f"table they hold privileges on. Schema public belongs to "
            f"pg_database_owner from PostgreSQL 15 on: grant it as the database "
            f"owner or as a superuser, beside the GRANT CREATE in "
            f"migrations/sql/roles.sql."
        )


def upgrade() -> None:
    # `tenants` FIRST and keyed on `id`, which is the one line in this function
    # that is not like the others. Its primary key IS a tenant id — see
    # `titlepipe_core.db.models.Tenant` — so there is no `tenant_id` column to
    # key on, and giving it one would silently move it into the derived set that
    # `tests/test_forced_rls_and_grants.py` builds.
    _isolate("tenants", "id")

    _isolate("orders", "tenant_id")
    _isolate("packages", "tenant_id")
    _isolate("pages", "tenant_id")
    _isolate("fields", "tenant_id")
    _isolate("field_readings", "tenant_id")
    _isolate("audit_log", "tenant_id")

    # See `SCHEMA_USAGE_ROLES`, and `_require_schema_usage` for what this
    # statement does and does not achieve on a cluster the owner does not own.
    op.execute(f"GRANT USAGE ON SCHEMA public TO {', '.join(SCHEMA_USAGE_ROLES)}")

    op.execute("GRANT SELECT, INSERT, UPDATE ON tenants TO titlepipe_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON orders TO titlepipe_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON packages TO titlepipe_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON pages TO titlepipe_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON fields TO titlepipe_app")
    op.execute("GRANT SELECT, INSERT, UPDATE ON field_readings TO titlepipe_app")

    # 🔴 `audit_log` GETS NO `UPDATE`, AND IT IS THE ONE GRANT THAT DIFFERS.
    #
    # `0001`'s `audit_log_append_only` trigger refuses UPDATE and DELETE
    # whatever the ACL says, so `GRANT UPDATE` here would change no behaviour
    # and would MISSTATE THE INTENT — an ACL saying `arwU` on the one table the
    # system promises never to edit in place. `DELETE` was already correctly
    # absent, and this makes the two consistent rather than leaving one of the
    # append-only verbs granted and the other not.
    #
    # WHAT IT COSTS, STATED HERE AND ASSERTED SINCE 2026-08-06 IN
    # `tests/test_forced_rls_and_grants.py::test_audit_log_is_granted_insert_but
    # _never_update`, which issues the UPDATE as that role and reads the SQLSTATE
    # back. Until then this cost was stated three times in this file and asserted
    # nowhere. For `titlepipe_app` the trigger's UPDATE branch is
    # now unreachable, exactly as its DELETE branch already was. The privilege
    # check runs first, so that role now gets `42501 permission denied for table
    # audit_log` where it used to get `0A000 audit_log is append-only`. The
    # trigger is not thereby decoration — it is the control against every other
    # path to the table, including a future role, a `SET ROLE`, and the
    # superuser-shaped seeding `tests/test_schema_migration.py` does, and those
    # tests still read `0A000` because they connect as the container superuser.
    op.execute("GRANT SELECT, INSERT ON audit_log TO titlepipe_app")

    # 🔴 NO `GRANT USAGE, SELECT ON ALL SEQUENCES`. MEASURED 2026-08-05 against
    # this schema: `pg_class` holds ZERO relations of kind `S` in `public`. Every
    # primary key defaults to `gen_random_uuid()` and nothing here is `serial` or
    # `IDENTITY`, so the statement would grant nothing to nobody while reading
    # like a covered case. `tests/test_forced_rls_and_grants.py::test_there_are_no
    # _sequences_for_a_sequence_grant_to_reach` is what will notice the day that
    # stops being true.

    _require_schema_usage()


def downgrade() -> None:
    """Reverse of `upgrade`, with ONE deliberate asymmetry — see below.

    ---------------------------------------------------------------------------
    🔴 THE SCHEMA `USAGE` GRANT IS NOT REVERSED. This is accepted, documented
       debris rather than an oversight.
    ---------------------------------------------------------------------------
    Two measured reasons, 2026-08-05 against postgres:18.4:

    * there is nothing of this revision's own to reverse on the cluster this
      suite runs against. The `GRANT` no-ops with `WARNING: no privileges were
      granted for "public"` (see `_require_schema_usage`), and so does the
      matching revoke — `REVOKE USAGE ON SCHEMA public FROM titlepipe_app,
      titlepipe_worker` as `titlepipe_owner` gives `WARNING: no privileges could
      be revoked for "public"` and leaves `nspacl` untouched. Reversing a
      statement that did nothing is theatre;
    * where it CAN land — a deployment in which `titlepipe_owner` owns the
      database — revoking it is actively dangerous. `downgrade base` continues
      into `0001`'s seven `DROP TABLE`s and Alembic's own read of
      `alembic_version`, all of which need USAGE on `public`, and the role that
      issues them is `titlepipe_owner` itself.

    A REVOKE THAT ONLY REACHES ITS OWN GRANTS, STATED RATHER THAN IMPLIED. The
    table revokes below reach the rows where `titlepipe_owner` is the grantor,
    which is every row this revision created — MEASURED, `aclexplode` on
    `orders` after `upgrade` shows `grantor = titlepipe_owner` for all three of
    `titlepipe_app`'s privileges. A `GRANT SELECT ON orders TO titlepipe_app`
    issued by somebody else is a separate ACL row with a different grantor and
    survives this, the same class as the `GRANTED BY … CASCADE` bug already
    fixed in `roles.sql`'s membership pass. It is NOT converged here on purpose:
    a downgrade undoes one revision, and converging an ACL is what `roles.sql`
    is for — which, by its own header, deliberately does not converge
    object-level grants either. So nothing in this repository converges them,
    and that is a stated gap rather than a covered one.

    🔴 ONE CLAUSE ABOVE READS OFF A STALE ENUMERATION. `roles.sql`'s header used
    to end its ownership list with "roles, memberships, per-role settings and
    default privileges, and claims exactly that much", and that is the sentence
    this paragraph leans on. Since 2026-08-06 that file also issues, and REFUSES
    the whole run over, `GRANT CREATE` and `GRANT USAGE` on schema `public` — so
    it is not true that it stays away from schema grants. What survives is the
    part this paragraph actually needs: neither file CONVERGES a table grant, so
    a `GRANT SELECT ON orders TO titlepipe_app` issued by a third party outlives
    both. The gap is unchanged; the reason given for it was one revision out of
    date.
    """
    op.execute("REVOKE SELECT, INSERT ON audit_log FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON field_readings FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON fields FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON pages FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON packages FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON orders FROM titlepipe_app")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON tenants FROM titlepipe_app")

    _release("audit_log")
    _release("field_readings")
    _release("fields")
    _release("pages")
    _release("packages")
    _release("orders")
    _release("tenants")

"""`orders.client_id` and `client_config_versions.client_id` name a client IN THE SAME TENANT

Revision ID: 0110
Revises: 0102
Create Date: 2026-09-08

ASSUMED PARENT: `0102`, the head this worktree found. `CONVENTIONS.md` §8 — god
linearizes.

---------------------------------------------------------------------------
🔴 WHAT WAS OPEN, AND IT IS NOT "AN ORDER NAMING A CLIENT THAT DOES NOT EXIST"
---------------------------------------------------------------------------
`0008` and `0080` both record the missing constraint, and both describe it as a
dangling reference. The demonstrated form is worse: an order in tenant A could
hold tenant B's REAL client id, and a second order could hold an id issued
nowhere. `clients` carries `delivery_method`, `delivery_config` and
`template_ref` — the DESTINATION a rendered report is transmitted to. A resolve
that reached `clients` by id without repeating the tenant predicate would
address one shop's deliverable to another shop's customer.

Row-level security filters that join today, so this was not a read breach at
head. It was a WRITABLE row that only a policy stood between and a delivery to
the wrong company, and `CONVENTIONS.md` §1 is explicit that tenancy is
structural rather than disciplinary: the composite key puts `tenant_id` on both
sides of one constraint, so the row cannot be written at all — for
`titlepipe_owner`, for a migration, and with row-level security off.

Sibling columns already had this. `orders.product_id` and
`orders.frozen_config_version_id` carry composite `(tenant_id, x)` keys from
`0008`; `client_id` did not, because `clients` was on another worker's chain.
Both chains are linearized now, and `0080` names the remaining half — the MODELS
had to declare it too or `alembic check` goes red in the other direction. It is
declared in `db/models/orders.Order` and `db/models/intake.ClientConfigVersion`
in the same commit as this file.

---------------------------------------------------------------------------
🔴 MEASURED 2026-09-08 AGAINST postgres:18.4: WRITTEN THE OBVIOUS WAY, THIS
   MIGRATION REPORTS SUCCESS AND VALIDATES NOTHING.
---------------------------------------------------------------------------
`ADD CONSTRAINT ... FOREIGN KEY` validates existing rows with an ORDINARY SQL
SCAN, run as the session user. Under `FORCE ROW LEVEL SECURITY` that user is
`titlepipe_owner` with no tenant established, so the scan matches zero rows. One
order holding a client id present nowhere, then, as the owner:

    ALTER TABLE orders ADD CONSTRAINT fk_probe
      FOREIGN KEY (tenant_id, client_id) REFERENCES clients (tenant_id, id);
    -- no error
    SELECT convalidated FROM pg_constraint WHERE conname = 'fk_probe';  -> t

The catalog then claims a validated constraint over a table that violates it.
This is `0001`'s silent-zero-rows trap in its most expensive form: not a write
that does nothing, but a REFUSAL that was never installed, recorded as installed.

The same statement under `SET LOCAL row_security = off` refuses instead, and the
error prints the validation query, which is what identified the mechanism:

    ERROR:  query would be affected by row-level security policy for table "orders"
    CONTEXT:  SQL statement "SELECT fk."tenant_id", fk."client_id" FROM ONLY
              "public"."orders" fk LEFT OUTER JOIN ONLY "public"."clients" pk ...

`row_security = off` can only ever refuse here, so it is a detector and not a
fix. What this revision does instead is drop `FORCE` on the three tables
involved for the length of the validation and put it back, which lets the owner's
exemption apply to that one scan.

**ALL THREE TABLES, NOT JUST THE CHILD.** Measured in the same run: with only
`orders` un-FORCEd, the parent's rows stay hidden, the LEFT JOIN finds no client
for ANY order, and a LEGITIMATE row is reported as a violation —

    ERROR:  insert or update on table "orders" violates foreign key constraint
    DETAIL:  Key (tenant_id, client_id)=(1111…, aaaa…) is not present in table "clients".

— where `aaaa…` was a client of that exact tenant. A half-applied version of this
revision therefore fails LOUD on a correct database rather than passing on a
corrupt one, which is the right way round, but only the full form is correct.

**THE RESTORE IS READ BACK, AND THAT GUARD IS THE POINT OF `_require_forced`.**
A revision that dropped `FORCE` and failed to restore it would leave
`titlepipe_owner` — one `SET ROLE` from a LOGIN role — exempt from every tenant
policy on `orders`, `client_config_versions` and `clients`, silently and
permanently. `pg_class.relforcerowsecurity` is read for all three before this
revision returns, and anything but true aborts the whole run.

## Runtime is unaffected, and that was measured too rather than assumed

The one-time validation scan is RLS-filtered; the PER-ROW check is not.
PostgreSQL's referential-integrity triggers bypass row security, so
`titlepipe_app` inside a `tenant_session` inserts an order naming its own
client normally — measured in the same run against this cluster.

## If existing rows block it

Nothing here widens the constraint to fit the data, and there is no `NOT VALID`
escape. A database holding an order whose `(tenant_id, client_id)` names no
client takes `23503` from the `ALTER`, with the offending key in the DETAIL line,
and no part of this revision commits. That row is a delivery addressed to
nobody — or to somebody else — and it is a data question, not a schema one.

## `ondelete` is deliberately absent

`relations.tenant_fk` states the rule: pass it where the domain settles disposal
and pass nothing where it does not. It does not here. `0080` gives
`titlepipe_app` no `DELETE` on `clients` precisely because "a client that stops
being a customer is a client whose orders still have to name somebody", so the
default `RESTRICT` — a parent that refuses to vanish under its children — is the
answer this schema already gave.

## What this does NOT close

The constraint binds an order to a client in the SAME TENANT. It does not say
that client is the RIGHT client: nothing in this schema relates a client to a
jurisdiction, a product or a config version, so an order naming the wrong
customer of the same shop is still writable. That is an UNPROVEN RESIDUAL in
`CONVENTIONS.md` §9's sense, and closing it needs a product rule that does not
exist yet.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0110"
down_revision: str | None = "0102"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PARENT_TABLE = "clients"

# child table -> the constraint name `base.NAMING_CONVENTION` renders for
# `(tenant_id, client_id) REFERENCES clients (tenant_id, id)`. Written out rather
# than built from the pattern, for the reason
# `test_schema_migration.py::test_the_naming_convention_is_exactly_these_five
# _patterns` gives for writing that convention out: an expectation derived from
# the thing under test moves whenever it moves. The longer of the two is 53
# bytes, inside the 63-byte identifier limit `relations.tenant_fk` documents, so
# neither needs that function's `name` escape hatch.
FOREIGN_KEYS = {
    "orders": "fk_orders_tenant_id_client_id_clients",
    "client_config_versions": "fk_client_config_versions_tenant_id_client_id_clients",
}

# Every table whose `FORCE` is dropped for the validation scan: both children and
# the parent. See the module docstring's measurement for what happens when the
# parent is left out.
UNFORCED_FOR_VALIDATION = (*FOREIGN_KEYS, PARENT_TABLE)


def upgrade() -> None:
    for table in UNFORCED_FOR_VALIDATION:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")

    for table, name in FOREIGN_KEYS.items():
        op.create_foreign_key(
            name,
            table,
            PARENT_TABLE,
            ["tenant_id", "client_id"],
            ["tenant_id", "id"],
        )

    for table in UNFORCED_FOR_VALIDATION:
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    _require_forced()


def downgrade() -> None:
    # No `FORCE` dance on the way down: dropping a constraint validates nothing
    # and reads no rows, so there is no scan for a policy to filter.
    for table, name in FOREIGN_KEYS.items():
        op.drop_constraint(name, table, type_="foreignkey")

    _require_forced()


def _require_forced() -> None:
    """Refuse unless all three tables are back at `relforcerowsecurity = true`.

    `0004::_require_trigger_state`'s idiom, over the catalog column this revision
    turns off. "The `ALTER` statement ran" and "the flag is set" are different
    claims, and only the second is what stops `titlepipe_owner` reading every
    tenant's rows. Called from `downgrade()` as well, where nothing touches the
    flag — so it asserts that this revision left the cluster as it found it,
    which is the half a reversibility test cannot see by comparing schemas.
    """
    rows = (
        op.get_bind()
        .exec_driver_sql(
            "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = ANY(%(tables)s)",
            {"tables": list(UNFORCED_FOR_VALIDATION)},
        )
        .fetchall()
    )

    found = {str(name): bool(forced) for name, forced in rows}
    unforced = sorted(name for name in UNFORCED_FOR_VALIDATION if not found.get(name))
    if unforced:
        raise RuntimeError(
            f"0110: {unforced} are not at relforcerowsecurity=true after this "
            f"revision ran — a table missing from pg_class reads as unforced too. "
            f"Without FORCE, titlepipe_owner is exempt from the tenant policy on "
            f"that table and reads every tenant's rows. Nothing in this run has "
            f"been committed."
        )

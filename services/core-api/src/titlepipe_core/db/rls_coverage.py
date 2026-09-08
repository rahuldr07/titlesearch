"""Every table this database holds is in `public`, and there either isolated or on
a short named allowlist.

The convention that a tenant-scoped table gets `ENABLE`, `FORCE` and a policy in
the same migration is written down in three places and enforced by nothing. This
module is the enforcement: it reads the LIVE catalog and faults what fails it.

## Where this runs, and why one of the two is not enough (PLAN §5 rule 4)

* **at migration time** — `migrations/env.py` calls `assert_rls_coverage` after
  `run_migrations()` returns, in the same transaction, so a migration that forgets
  to isolate a table it created fails and rolls itself back;
* **at application boot** — `lifespan.py` calls `assert_rls_coverage_async` before
  the service reports itself started. This catches a table that arrived between
  releases by a path that was not a migration, which the migration check never saw.

## The census is every schema, because it used to be one

Until 2026-09-08 both catalog reads filtered `WHERE nspname = 'public'`, so a
tenant table in any other schema was not in the set and nothing looked at it.
MEASURED 2026-09-08 against postgres:18.4, on this chain at `0102`: a revision
doing `CREATE SCHEMA sidecar; CREATE TABLE sidecar.secrets (tenant_id uuid, …)`
plus the two grants `titlepipe_app` needs ran to completion, `assert_rls_coverage`
returned no faults, and `titlepipe_app` with `app.current_tenant` pinned to one
tenant read BOTH tenants' rows. Green migration, green boot check, no isolation.

The one thing that stopped that migration existing was the `CREATE SCHEMA`, which
needs `CREATE ON DATABASE` — a privilege no `titlepipe_%` role held. It held it in
the measurement above because the measurement granted it, in one statement, and
nothing anywhere went red. `roles.sql` now revokes it and
`tests/test_roles.py::test_no_titlepipe_role_can_create_a_schema_to_hide_a_table_in`
asserts its absence; this module is the other end, so neither has to hold alone.

So the census now reads EVERY schema that is not PostgreSQL's own, and a table
outside `SCHEMA` is a fault by existing — not judged for RLS, refused. That is
the same rule `migrations/env.py` hand-off 3 and `roles.sql` already state in
prose ("a later revision that wants a schema needs the grant HERE, with its own
test"); this is the machine.

`pg_%` is excluded by prefix rather than by a list of names, and the prefix is
the server's own reservation: MEASURED in the same session, `CREATE SCHEMA
pg_hideout` is refused with `unacceptable schema name … The prefix "pg_" is
reserved for system schemas`, so nothing can be hidden behind it.
RESIDUAL: `information_schema` is excluded BY NAME, and that exclusion has no
such backstop — an owner who drops the SQL-standard catalog schema and recreates
it can put a table where this census will not look. Nothing here closes that; it
would need a check that `information_schema` is still the one initdb created.

## What it does NOT check, stated rather than implied

Grants. A table can be fully isolated and hold no grant for `titlepipe_app`, or
hold `DELETE`, and every assertion here passes;
`tests/test_forced_rls_and_grants.py` is the authority on the ACL.

The shape a table is judged AGAINST — the predicate, the policy rules, the
fault types and `analyse_coverage` itself — is `db/rls_expectations.py`, and
is re-exported here so that `db.rls_coverage.<name>` still resolves for every
caller and comment that already spelled it that way.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import Final

from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncConnection

from titlepipe_core.db.rls_expectations import (
    POLICY_COMMAND as POLICY_COMMAND,
)
from titlepipe_core.db.rls_expectations import (
    PUBLIC_ROLES as PUBLIC_ROLES,
)
from titlepipe_core.db.rls_expectations import (
    REGISTRY_KEY_COLUMN as REGISTRY_KEY_COLUMN,
)
from titlepipe_core.db.rls_expectations import (
    REGISTRY_TABLE as REGISTRY_TABLE,
)
from titlepipe_core.db.rls_expectations import (
    SCHEMA as SCHEMA,
)
from titlepipe_core.db.rls_expectations import (
    TENANT_GUC as TENANT_GUC,
)
from titlepipe_core.db.rls_expectations import (
    TENANT_KEY_COLUMN as TENANT_KEY_COLUMN,
)
from titlepipe_core.db.rls_expectations import (
    TENANT_PREDICATE as TENANT_PREDICATE,
)
from titlepipe_core.db.rls_expectations import (
    UNSCOPED_TABLES as UNSCOPED_TABLES,
)
from titlepipe_core.db.rls_expectations import (
    PolicyFacts as PolicyFacts,
)
from titlepipe_core.db.rls_expectations import (
    RlsCoverageError as RlsCoverageError,
)
from titlepipe_core.db.rls_expectations import (
    RlsCoverageFault as RlsCoverageFault,
)
from titlepipe_core.db.rls_expectations import (
    TableFacts as TableFacts,
)
from titlepipe_core.db.rls_expectations import (
    analyse_coverage as analyse_coverage,
)

# `relkind IN ('r','p')` — ordinary and partitioned tables. Views, matviews and
# foreign tables are excluded because RLS is not a property they have; a
# `SECURITY DEFINER` view over a tenant table is a different control and PLAN §5
# puts it on the census allowlist, which is not this module's question.
#
# `attnum > 0 AND NOT attisdropped` on the column probe: a dropped `tenant_id`
# leaves a row in `pg_attribute` with the name mangled, and system columns have
# negative `attnum`.
_TABLE_FACTS_SQL: Final = """
SELECT n.nspname,
       c.relname,
       c.relrowsecurity,
       c.relforcerowsecurity,
       EXISTS (
           SELECT 1 FROM pg_attribute a
           WHERE a.attrelid = c.oid
             AND a.attname = :key_column
             AND a.attnum > 0
             AND NOT a.attisdropped
       )
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname !~ '^pg_'
  AND n.nspname <> 'information_schema'
ORDER BY n.nspname, c.relname
"""

# Still filtered to `SCHEMA` while the table census above is not, and that is not
# the hole it looks like: a table outside `SCHEMA` is refused for existing, before
# any policy of its own is consulted, so reading its policies could only change
# which fault is reported and never whether there is one.
#
# `qual` and `with_check` are selected UNCOALESCED. NULL is a meaningful answer
# for both and each means something different: a NULL `qual` is a policy with no
# USING clause, a NULL `with_check` is the required state (PostgreSQL reuses
# `USING` for writes when none is given), and coalescing either to `''` would
# turn the answer into the absence of one.
_POLICY_FACTS_SQL: Final = """
SELECT tablename, policyname, qual, with_check, roles::text, cmd, permissive = 'PERMISSIVE'
FROM pg_policies
WHERE schemaname = :schema
ORDER BY tablename, policyname
"""


def _read_tables(rows: Iterable[Sequence[object]]) -> tuple[TableFacts, ...]:
    return tuple(
        TableFacts(str(row[1]), bool(row[2]), bool(row[3]), bool(row[4]), schema=str(row[0]))
        for row in rows
    )


def _read_policies(rows: Iterable[Sequence[object]]) -> tuple[PolicyFacts, ...]:
    return tuple(
        PolicyFacts(
            str(row[0]),
            str(row[1]),
            None if row[2] is None else str(row[2]),
            None if row[3] is None else str(row[3]),
            str(row[4]),
            str(row[5]),
            bool(row[6]),
        )
        for row in rows
    )


# The census reads every schema, so `:schema` is not one of its binds; passing a
# parameter a `text()` does not name is an error, not a no-op.
_PARAMETERS: Final[Mapping[str, str]] = {"key_column": TENANT_KEY_COLUMN}


def audit_rls_coverage(connection: Connection) -> tuple[RlsCoverageFault, ...]:
    """Read the catalog and judge it. Returns the faults; raises nothing."""
    tables = _read_tables(connection.execute(text(_TABLE_FACTS_SQL), _PARAMETERS).all())
    policies = _read_policies(connection.execute(text(_POLICY_FACTS_SQL), {"schema": SCHEMA}).all())
    return analyse_coverage(tables, policies)


def assert_rls_coverage(connection: Connection) -> None:
    """`audit_rls_coverage`, but a fault is an exception. The migration-time half."""
    faults = audit_rls_coverage(connection)
    if faults:
        raise RlsCoverageError(faults)


async def audit_rls_coverage_async(
    connection: AsyncConnection,
) -> tuple[RlsCoverageFault, ...]:
    """`audit_rls_coverage` over an async connection. The boot-time half.

    MEASURED 2026-09-04 against postgres:18.4: `titlepipe_app` — no superuser, no
    ownership, `NOBYPASSRLS`, holding `SELECT` on two of four tables — reads
    `pg_policies.qual` and `pg_class.relrowsecurity` for ALL FOUR, so the boot
    check sees the tables the app role cannot open: where a gap would be hiding.
    """
    tables = _read_tables((await connection.execute(text(_TABLE_FACTS_SQL), _PARAMETERS)).all())
    policies = _read_policies(
        (await connection.execute(text(_POLICY_FACTS_SQL), {"schema": SCHEMA})).all()
    )
    return analyse_coverage(tables, policies)


async def assert_rls_coverage_async(connection: AsyncConnection) -> None:
    """`audit_rls_coverage_async`, but a fault is an exception."""
    faults = await audit_rls_coverage_async(connection)
    if faults:
        raise RlsCoverageError(faults)

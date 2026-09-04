"""Every table in `public` is either isolated or on a short named allowlist.

The convention that a tenant-scoped table gets `ENABLE`, `FORCE` and a policy in
the same migration is written down in three places and enforced by nothing. This
module is the enforcement: it reads the LIVE catalog and faults what fails it.

## The derivation is "every table", not "every table with a `tenant_id`"

`tests/test_forced_rls_and_grants.py` derives its table set by asking which
tables carry a `tenant_id` column, and that derivation has a hole this one does
not: **a tenant-scoped table that forgets the column is not in the set, so
nothing looks at it** — it opts itself out by being more broken. The enumeration
here starts from every ordinary and partitioned table in the schema and subtracts
`UNSCOPED_TABLES`, so a table opts out only by being named in a constant a
reviewer reads. That list is itself checked: a table on it carrying a `tenant_id`
is a fault, so it cannot be used to silence a tenant table.

Partitions are included: a partition does not inherit its parent's policies, so
it needs its own three statements. There are none today; this notices the first.

## "Has a policy" is not the question. "Scopes by tenant" is

Presence is the assertion that passes against `USING (true)`. What is required is
the WHOLE deparsed predicate, anchored at both ends:

    (<key> = (NULLIF(current_setting('app.current_tenant'::text, true), ''::text))::uuid)

`pg_policies.qual` is the server's own deparse, so it is canonical and can be
matched as a shape rather than searched for a fragment. MEASURED 2026-09-04
against postgres:18.4: a policy written in lower case with no casts reads back as
the line above, verbatim. The key column and the GUC are pulled out as named
groups and compared case-SENSITIVELY; `re.IGNORECASE` covers only keywords.

**Anchoring both ends is also what enforces PLAN §5 rule 5 ("no policy may
reference another relation")**, and it needs no separate machine: exactly one
policy is permitted per table and its entire text must be the predicate above,
which references one column and one function — no room for a join, and no second
policy for a join to live in. MEASURED in the same session, rule 5's own example,
`USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = joined.order_id))`, deparses
to an `EXISTS (SELECT 1 FROM orders …)` this pattern does not match, and is
reported as `no_policy_scoping_by_tenant`. Allowlisted tables are required to
have NO policy at all, which closes rule 5 over the whole schema rather than over
the isolated part of it.

## Where this runs, and why one of the two is not enough (PLAN §5 rule 4)

* **at migration time** — `migrations/env.py` calls `assert_rls_coverage` after
  `run_migrations()` returns, in the same transaction, so a migration that forgets
  to isolate a table it created fails and rolls itself back;
* **at application boot** — `lifespan.py` calls `assert_rls_coverage_async` before
  the service reports itself started. This catches a table that arrived between
  releases by a path that was not a migration, which the migration check never saw.

## What it does NOT check, stated rather than implied

Grants. A table can be fully isolated and hold no grant for `titlepipe_app`, or
hold `DELETE`, and every assertion here passes;
`tests/test_forced_rls_and_grants.py` is the authority on the ACL.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping, Sequence
from typing import Final, NamedTuple

from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncConnection

# The schema this system owns. Spelled once; a second schema is a decision, not a
# configuration value, and would need its own line here and a reason beside it.
SCHEMA: Final = "public"

# The session setting every policy reads, and the only one any policy may ever
# read (PLAN §5 tenancy rule 3). Written out rather than imported from
# `engine.py` — this is the value being ASSERTED, and a check that reads its
# expectation from the code under test asserts that the two agree, not that
# either is right.
TENANT_GUC: Final = "app.current_tenant"

# The column a tenant-scoped table keys on, and the one table that keys on
# something else. `tenants`' primary key IS a tenant id, so there is no
# `tenant_id` column on it to key on; giving it one would put the registry in the
# derived set as a row of itself.
TENANT_KEY_COLUMN: Final = "tenant_id"
REGISTRY_TABLE: Final = "tenants"
REGISTRY_KEY_COLUMN: Final = "id"

# 🔴 THE ALLOWLIST. Every name here is a table that must NOT be isolated, and
# every one needs its reason in this comment rather than in a commit message.
#
# `alembic_version` — Alembic's own bookkeeping. An `id`-keyed policy on it locks
#   Alembic out of reading its own migration state; there is no tenant in it.
# `rules` — global by CONVENTIONS §1. The rulebook is the same for every tenant,
#   its repository is a SIBLING of the tenant-scoped ones rather than a subclass,
#   and a `tenant_id` on it would be a per-tenant rulebook nobody asked for.
#
# Adding a name here is a reviewer-visible diff that has to argue the table has
# no tenant in it. `exempt_table_is_tenant_scoped` is what stops the list being
# used the other way, to silence a table that does.
UNSCOPED_TABLES: Final = frozenset({"alembic_version", "rules"})

# The deparsed predicate, whole and anchored. See the module docstring for the
# measurement this shape comes from and for why `IGNORECASE` costs nothing.
TENANT_PREDICATE: Final = re.compile(
    r"\A\("
    r"(?P<key>[a-z_][a-z0-9_]*) = "
    r"\(NULLIF\(current_setting\('(?P<guc>[^']+)'::text, true\), ''::text\)\)::uuid"
    r"\)\Z",
    re.IGNORECASE,
)

# What a policy's role list must be. A policy naming roles applies to those roles
# and leaves every other role either reading the table unfiltered or denied with
# no error naming a policy, depending on which side of the grant it is on.
PUBLIC_ROLES: Final = "{public}"

# The command a policy must cover. `FOR SELECT` is not a narrower version of this:
# it leaves INSERT and UPDATE with no policy at all, and a table with RLS on and no
# applicable policy denies every row — deny-safe, broken, and catalog-clean.
POLICY_COMMAND: Final = "ALL"


class RlsCoverageFault(NamedTuple):
    """One table, one thing wrong with it, in a sentence an operator can act on."""

    table: str
    fault: str
    detail: str


class RlsCoverageError(RuntimeError):
    """Raised by `assert_rls_coverage`. Carries the faults, not just a message."""

    def __init__(self, faults: Sequence[RlsCoverageFault]) -> None:
        self.faults: Final = tuple(faults)
        lines = "\n".join(f"  {f.table}: {f.fault} — {f.detail}" for f in self.faults)
        super().__init__(
            f"row-level security coverage is incomplete on {len(self.faults)} "
            f"table(s) in schema {SCHEMA}:\n{lines}\n"
            f"Every table must have ENABLE, FORCE and exactly one tenant-scoping "
            f"policy in the migration that creates it, or be named in "
            f"titlepipe_core.db.rls_coverage.UNSCOPED_TABLES with a reason."
        )


class TableFacts(NamedTuple):
    """What the catalog says about one table's row security."""

    name: str
    rls_enabled: bool
    rls_forced: bool
    has_tenant_column: bool


class PolicyFacts(NamedTuple):
    """What the catalog says about one policy."""

    table: str
    name: str
    qual: str | None
    with_check: str | None
    roles: str
    command: str
    permissive: bool


# `relkind IN ('r','p')` — ordinary and partitioned tables. Views, matviews and
# foreign tables are excluded because RLS is not a property they have; a
# `SECURITY DEFINER` view over a tenant table is a different control and PLAN §5
# puts it on the census allowlist, which is not this module's question.
#
# `attnum > 0 AND NOT attisdropped` on the column probe: a dropped `tenant_id`
# leaves a row in `pg_attribute` with the name mangled, and system columns have
# negative `attnum`.
_TABLE_FACTS_SQL: Final = """
SELECT c.relname,
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
WHERE c.relnamespace = to_regnamespace(:schema)
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname
"""

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


def _expected_key_column(table: str) -> str:
    """`tenant_id` everywhere, `id` on the registry. The one special case, named."""
    return REGISTRY_KEY_COLUMN if table == REGISTRY_TABLE else TENANT_KEY_COLUMN


def _policy_faults(table: str, policy: PolicyFacts) -> Iterable[RlsCoverageFault]:
    """Everything wrong with the one policy on `table`, as separate faults.

    Separate rather than first-wins: a policy can be bound to a role AND supply its
    own `WITH CHECK`, and an operator who fixes one, re-runs, and is then told
    about the other has been made to do the work twice.
    """
    if policy.command != POLICY_COMMAND:
        yield RlsCoverageFault(
            table,
            "policy_does_not_cover_all_commands",
            f"policy {policy.name} is FOR {policy.command}; the other verbs have no policy",
        )
    if not policy.permissive:
        yield RlsCoverageFault(
            table,
            "policy_is_restrictive",
            f"policy {policy.name} is RESTRICTIVE; it narrows a permissive one that is absent",
        )
    if policy.roles != PUBLIC_ROLES:
        yield RlsCoverageFault(
            table,
            "policy_is_bound_to_roles",
            f"policy {policy.name} applies to {policy.roles}; other roles get no policy",
        )
    if policy.with_check is not None:
        yield RlsCoverageFault(
            table,
            "policy_write_side_differs_from_read_side",
            f"policy {policy.name} supplies WITH CHECK ({policy.with_check}); it must be absent",
        )

    match = TENANT_PREDICATE.fullmatch(policy.qual or "")
    expected = _expected_key_column(table)
    if match is None:
        yield RlsCoverageFault(
            table,
            "no_policy_scoping_by_tenant",
            f"policy {policy.name} is not the tenant predicate: {policy.qual!r}",
        )
        return
    if match["key"] != expected:
        yield RlsCoverageFault(
            table,
            "policy_scopes_by_the_wrong_column",
            f"policy {policy.name} keys on {match['key']!r}, not {expected!r}",
        )
    if match["guc"] != TENANT_GUC:
        yield RlsCoverageFault(
            table,
            "policy_reads_the_wrong_setting",
            f"policy {policy.name} reads {match['guc']!r}, not {TENANT_GUC!r} — a bypass switch",
        )


def _table_faults(table: TableFacts, policies: Sequence[PolicyFacts]) -> Iterable[RlsCoverageFault]:
    """Everything wrong with one isolated table."""
    if not table.rls_enabled:
        yield RlsCoverageFault(
            table.name,
            "row_level_security_not_enabled",
            "no ALTER TABLE ... ENABLE ROW LEVEL SECURITY; every session reads every tenant's rows",
        )
    if not table.rls_forced:
        yield RlsCoverageFault(
            table.name,
            "row_level_security_not_forced",
            "ENABLE without FORCE exempts the table owner, and the owner is who migrations run as",
        )
    if table.name != REGISTRY_TABLE and not table.has_tenant_column:
        yield RlsCoverageFault(
            table.name,
            "no_tenant_column",
            f"no {TENANT_KEY_COLUMN} column, so no policy can key on this row without a join",
        )

    if not policies:
        yield RlsCoverageFault(
            table.name,
            "no_policy",
            "row security with no policy denies every row: safe, and unusable",
        )
        return
    if len(policies) > 1:
        names = ", ".join(sorted(p.name for p in policies))
        yield RlsCoverageFault(
            table.name,
            "more_than_one_policy",
            f"permissive policies OR together, so {names} is that many ways in",
        )
        return
    yield from _policy_faults(table.name, policies[0])


def analyse_coverage(
    tables: Sequence[TableFacts], policies: Sequence[PolicyFacts]
) -> tuple[RlsCoverageFault, ...]:
    """The whole judgement, as a pure function of two catalog reads.

    Pure on purpose: the branches live here, so `tests/test_rls_coverage.py` can
    drive every fault without building a broken schema for each one, and the
    database half is two `SELECT`s with nothing left to get wrong.
    """
    by_table: dict[str, list[PolicyFacts]] = {}
    for policy in policies:
        by_table.setdefault(policy.table, []).append(policy)

    faults: list[RlsCoverageFault] = []
    for table in tables:
        if table.name in UNSCOPED_TABLES:
            if table.has_tenant_column:
                faults.append(
                    RlsCoverageFault(
                        table.name,
                        "exempt_table_is_tenant_scoped",
                        f"on the allowlist but carries {TENANT_KEY_COLUMN}: it is being silenced",
                    )
                )
            for policy in by_table.get(table.name, []):
                faults.append(
                    RlsCoverageFault(
                        table.name,
                        "unscoped_table_carries_a_policy",
                        f"policy {policy.name} is on an allowlisted table; one claim is wrong",
                    )
                )
            continue
        faults.extend(_table_faults(table, by_table.get(table.name, [])))
    return tuple(faults)


def _read_tables(rows: Iterable[Sequence[object]]) -> tuple[TableFacts, ...]:
    return tuple(TableFacts(str(row[0]), bool(row[1]), bool(row[2]), bool(row[3])) for row in rows)


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


_PARAMETERS: Final[Mapping[str, str]] = {"schema": SCHEMA, "key_column": TENANT_KEY_COLUMN}


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
    ownership, `NOBYPASSRLS`, holding `SELECT` on two of the four tables present —
    reads `pg_policies.qual` and `pg_class.relrowsecurity` for ALL FOUR. So the
    boot check sees the tables the app role cannot open, which is exactly the set
    a forgotten policy would be hiding in.
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

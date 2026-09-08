"""What a correctly isolated table looks like, and the judgement that says so.

Split out of `rls_coverage.py` on 2026-09-08 under `scripts/check_backend_rules.py`
rule 6 — that file reached 455 lines and the alternative was a
`rules-allow-file(file-length)` on the module that asserts tenant isolation,
which is the same trade `engine.py` was split out of `session.py` to refuse. The
seam is the one `tests/test_rls_coverage.py` already had a banner for: the pure
half, which needs no database, and the catalog half, which is two `SELECT`s.
No caller's import line changed — `rls_coverage.py` re-exports every name.

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

## The derivation is "every table", not "every table with a `tenant_id`"

`tests/test_forced_rls_and_grants.py` derives its table set by asking which
tables carry a `tenant_id` column, and that derivation has a hole this one does
not: **a tenant-scoped table that forgets the column is not in the set, so
nothing looks at it** — it opts itself out by being more broken. The enumeration
`rls_coverage.py` feeds in starts from every ordinary and partitioned table and subtracts
`UNSCOPED_TABLES`, so a table opts out only by being named in a constant a
reviewer reads. That list is itself checked: a table on it carrying a `tenant_id`
is a fault, so it cannot be used to silence a tenant table.

Partitions are included: a partition does not inherit its parent's policies, so
it needs its own three statements. There are none today; this notices the first.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from typing import Final, NamedTuple

# `UNSCOPED_TABLES` and the reasons for each name live in `unscoped_tables.py`, where
# `migrations/env.py` and two test-side enumerations read the same list rather than each
# keeping their own.
from titlepipe_core.db.unscoped_tables import UNSCOPED_TABLES

# The schema this system owns — the ONLY one. Spelled once; a second schema is a
# decision, not a configuration value, and would need its own line here, a reason
# beside it, and the `CREATE ON DATABASE` grant `roles.sql` currently revokes.
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
        tables = len({f.table for f in self.faults})
        super().__init__(
            f"row-level security coverage is incomplete: {len(self.faults)} fault(s) "
            f"on {tables} table(s):\n{lines}\n"
            f"Every table must have ENABLE, FORCE and exactly one tenant-scoping "
            f"policy in the migration that creates it, or be named in "
            f"titlepipe_core.db.unscoped_tables.UNSCOPED_TABLES with a reason."
        )


class TableFacts(NamedTuple):
    """What the catalog says about one table's row security, and where it lives.

    `schema` defaults to the owned one so the several dozen in-schema cases in
    `tests/test_rls_coverage.py` still read as four positional facts. The catalog
    reader never takes the default — it passes what `pg_namespace` said.
    """

    name: str
    rls_enabled: bool
    rls_forced: bool
    has_tenant_column: bool
    schema: str = SCHEMA


class PolicyFacts(NamedTuple):
    """What the catalog says about one policy."""

    table: str
    name: str
    qual: str | None
    with_check: str | None
    roles: str
    command: str
    permissive: bool


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
        if table.schema != SCHEMA:
            faults.append(
                RlsCoverageFault(
                    f"{table.schema}.{table.name}",
                    "table_outside_the_owned_schema",
                    f"schema {table.schema} is not {SCHEMA}; no policy here is read and "
                    "UNSCOPED_TABLES cannot exempt it — see roles.sql on CREATE ON DATABASE",
                )
            )
            continue
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

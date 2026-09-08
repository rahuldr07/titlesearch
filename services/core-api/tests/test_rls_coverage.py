"""`titlepipe_core.db.rls_coverage`, proved red before it is trusted green.

A coverage check that has only ever been run against a schema that satisfies it
is a check nobody has seen fail. Half this file is the other half of that: each
live test BREAKS the migrated schema on purpose, in the specific way a worker
would break it by accident, asserts the fault, and puts the schema back.

## The breakage is real DDL against the real migrated database

Not a fabricated catalog. `_temporary_table` runs `CREATE TABLE` as
`titlepipe_owner` on the module's own migrated database and drops it in a
`finally`, because `conftest.py::_scrub_migration_objects` drops the tables the
MIGRATION creates, by name, and knows nothing about one a test invented. A table
leaked out of here would survive the module teardown and fail `test_roles.py`,
which asserts the database is empty afterwards.

## Why the pure tests are not enough on their own, and vice versa

`analyse_coverage` is a pure function, so every fault it can emit is reachable
from a `TableFacts`/`PolicyFacts` literal with no database at all — which is the
only affordable way to cover twelve faults. But a pure test cannot notice that
the SQL selects the wrong column, that `pg_policies.cmd` answers `'ALL'` rather
than `'*'`, or that the deparse is not the string the pattern expects. The live
tests are what pin the two `SELECT`s to the server's real answers, and they are
written as breakages so that they also pin the verdict.
"""

from __future__ import annotations

import contextlib
from collections.abc import Callable, Generator

import pytest
from sqlalchemy import Connection, Engine, text

from titlepipe_core.db import make_engine
from titlepipe_core.db.rls_coverage import (
    POLICY_COMMAND,
    PUBLIC_ROLES,
    SCHEMA,
    TENANT_GUC,
    UNSCOPED_TABLES,
    PolicyFacts,
    RlsCoverageError,
    TableFacts,
    analyse_coverage,
    assert_rls_coverage,
    assert_rls_coverage_async,
    audit_rls_coverage,
)

# The deparsed tenant predicate, written out. Every "healthy" literal below uses
# it, so a change to the pattern that accidentally accepts less shows up here as
# a test that stops being able to build a healthy row.
GOOD_QUAL = (
    "(tenant_id = (NULLIF(current_setting('app.current_tenant'::text, true), ''::text))::uuid)"
)
REGISTRY_QUAL = GOOD_QUAL.replace("tenant_id", "id", 1)

# The role that runs the boot check. Spelled here rather than imported from
# `conftest.py` so that this file states which role it claims the check works as.
APP_ROLE = "titlepipe_app"


def _healthy_table(name: str = "orders") -> TableFacts:
    return TableFacts(name=name, rls_enabled=True, rls_forced=True, has_tenant_column=True)


def _healthy_policy(table: str = "orders", qual: str = GOOD_QUAL) -> PolicyFacts:
    return PolicyFacts(
        table=table,
        name="tenant_isolation",
        qual=qual,
        with_check=None,
        roles=PUBLIC_ROLES,
        command=POLICY_COMMAND,
        permissive=True,
    )


def _faults(tables: list[TableFacts], policies: list[PolicyFacts]) -> set[str]:
    return {fault.fault for fault in analyse_coverage(tables, policies)}


# ---------------------------------------------------------------------------
# The pure half: every fault, reachable, and the healthy shape reaching none.
# ---------------------------------------------------------------------------


def test_a_correctly_isolated_table_produces_no_fault() -> None:
    """The positive control. Without it every assertion below is satisfied by an
    `analyse_coverage` that returns a fault for everything."""
    assert analyse_coverage([_healthy_table()], [_healthy_policy()]) == ()


def test_the_registry_is_allowed_to_key_on_its_own_id_and_nothing_else_is() -> None:
    """`tenants` keys on `id`; the same predicate on any other table is wrong.

    Both directions, because a check that special-cased the registry by dropping
    the column comparison entirely would pass the first and not the second."""
    registry = TableFacts("tenants", rls_enabled=True, rls_forced=True, has_tenant_column=False)
    assert analyse_coverage([registry], [_healthy_policy("tenants", REGISTRY_QUAL)]) == ()
    assert "policy_scopes_by_the_wrong_column" in _faults(
        [_healthy_table()], [_healthy_policy(qual=REGISTRY_QUAL)]
    )


@pytest.mark.parametrize(
    ("table", "expected"),
    [
        pytest.param(
            TableFacts("orders", rls_enabled=False, rls_forced=True, has_tenant_column=True),
            "row_level_security_not_enabled",
            id="enable-missing",
        ),
        pytest.param(
            TableFacts("orders", rls_enabled=True, rls_forced=False, has_tenant_column=True),
            "row_level_security_not_forced",
            id="force-missing",
        ),
        pytest.param(
            TableFacts("orders", rls_enabled=True, rls_forced=True, has_tenant_column=False),
            "no_tenant_column",
            id="tenant-column-missing",
        ),
    ],
)
def test_each_missing_half_of_the_table_side_is_its_own_fault(
    table: TableFacts, expected: str
) -> None:
    assert expected in _faults([table], [_healthy_policy()])


def test_a_table_with_no_policy_at_all_is_the_fault_this_module_exists_for() -> None:
    assert _faults([_healthy_table()], []) == {"no_policy"}


@pytest.mark.parametrize(
    ("policy", "expected"),
    [
        pytest.param(
            _healthy_policy(qual="(true)"),
            "no_policy_scoping_by_tenant",
            id="using-true",
        ),
        pytest.param(
            _healthy_policy(
                qual="(EXISTS ( SELECT 1\n   FROM orders o\n  WHERE (o.id = t.order_id)))"
            ),
            "no_policy_scoping_by_tenant",
            id="joins-another-relation",
        ),
        pytest.param(
            _healthy_policy(
                qual="(NULLIF(current_setting('app.current_tenant'::text, true), ''::text) IS NOT NULL)"
            ),
            "no_policy_scoping_by_tenant",
            id="mentions-the-guc-but-not-the-row",
        ),
        pytest.param(
            _healthy_policy(qual=GOOD_QUAL.replace("app.current_tenant", "app.bypass")),
            "policy_reads_the_wrong_setting",
            id="reads-a-second-guc",
        ),
        pytest.param(
            _healthy_policy()._replace(with_check="(true)"),
            "policy_write_side_differs_from_read_side",
            id="own-with-check",
        ),
        pytest.param(
            _healthy_policy()._replace(roles="{titlepipe_app}"),
            "policy_is_bound_to_roles",
            id="bound-to-a-role",
        ),
        pytest.param(
            _healthy_policy()._replace(command="SELECT"),
            "policy_does_not_cover_all_commands",
            id="select-only",
        ),
        pytest.param(
            _healthy_policy()._replace(permissive=False),
            "policy_is_restrictive",
            id="restrictive",
        ),
        pytest.param(
            _healthy_policy()._replace(qual=None),
            "no_policy_scoping_by_tenant",
            id="no-using-clause",
        ),
    ],
)
def test_a_policy_that_exists_is_not_a_policy_that_scopes(
    policy: PolicyFacts, expected: str
) -> None:
    """The whole point of the module. `USING (true)` and a policy joining another
    relation are both PRESENT, and presence is what a coverage check that counted
    policies would have accepted."""
    assert expected in _faults([_healthy_table()], [policy])


def test_a_second_permissive_policy_is_a_second_way_in() -> None:
    """Permissive policies OR together, so the correct one does not bound the
    wrong one. The exact-set assertion, not a floor."""
    extra = _healthy_policy(qual="(true)")._replace(name="tenant_maintenance")
    assert _faults([_healthy_table()], [_healthy_policy(), extra]) == {"more_than_one_policy"}


def test_the_allowlist_cannot_be_used_to_silence_a_tenant_table() -> None:
    """A table on `UNSCOPED_TABLES` that carries a `tenant_id` is a fault, so the
    cheapest way to make this check pass — add the name to the list — is the one
    thing it refuses."""
    exempt = next(iter(sorted(UNSCOPED_TABLES)))
    silenced = TableFacts(exempt, rls_enabled=False, rls_forced=False, has_tenant_column=True)
    assert _faults([silenced], []) == {"exempt_table_is_tenant_scoped"}


def test_an_allowlisted_table_carrying_a_policy_is_a_contradiction() -> None:
    """The half that closes PLAN §5 rule 5 over the schema rather than over the
    isolated part of it: a policy on a table declared to have no tenant in it."""
    exempt = next(iter(sorted(UNSCOPED_TABLES)))
    facts = TableFacts(exempt, rls_enabled=True, rls_forced=True, has_tenant_column=False)
    assert _faults([facts], [_healthy_policy(exempt)]) == {"unscoped_table_carries_a_policy"}


def test_the_error_names_every_faulting_table_and_not_just_the_first() -> None:
    """An operator fixing a schema needs the list. `RlsCoverageError` carries the
    faults as data as well as rendering them, so a caller can log them."""
    tables = [_healthy_table("orders"), _healthy_table("packages")]
    with pytest.raises(RlsCoverageError) as caught:
        raise RlsCoverageError(analyse_coverage(tables, []))
    assert {fault.table for fault in caught.value.faults} == {"orders", "packages"}
    assert "orders" in str(caught.value)
    assert "packages" in str(caught.value)


# ---------------------------------------------------------------------------
# The live half. Every one of these breaks the migrated schema on purpose.
# ---------------------------------------------------------------------------

# 🔴 THE PROBE TABLES ARE NAMED OUT OF THE DOMAIN'S REACH, AND THAT IS THE WHOLE
# POINT OF THE PREFIX.
#
# These four names used to be `escalations`, `complaints`, `deliveries` and
# `reconciliations` — chosen BECAUSE they read like the next table somebody would
# land, which is precisely what makes them unusable. MEASURED 2026-09-05 on
# `integration/backend-2026-09`: `0050_delivery` created `deliveries` and the
# escalation revision created `escalations`, and both live tests died in
# `_temporary_table` on `DuplicateTable: relation "..." already exists` before
# reaching a single assertion. Not a leak, not a fixture that failed to clean up —
# the SCHEMA GREW THE NAME. `complaints` and `reconciliations` were the same
# landmine one merge from going off.
#
# The two tests that broke are the two that prove `audit_rls_coverage` goes red;
# a check whose own red-proof cannot run is back to being an unproven claim, so
# the name has to be one no migration will ever take. `rls_coverage_probe__` is
# that, and `_temporary_table` refuses to build over an existing relation so the
# day the rule is broken says so in one line instead of a driver error.
PROBE_PREFIX = "rls_coverage_probe__"
PROBE_UNISOLATED = f"{PROBE_PREFIX}unisolated"
PROBE_NO_TENANT_COLUMN = f"{PROBE_PREFIX}no_tenant_column"
PROBE_OPEN_POLICY = f"{PROBE_PREFIX}open_policy"
PROBE_JOINED_POLICY = f"{PROBE_PREFIX}joined_policy"


@contextlib.contextmanager
def _temporary_table(connection: Connection, ddl: str, name: str) -> Generator[None]:
    """`CREATE TABLE` as the owner, and `DROP` it whatever happens.

    The drop is in a `finally` and is not `IF EXISTS`: a table that has already
    gone means something else dropped it, and that is worth an error rather than
    a shrug — the reason `0001` gives for `checkfirst=False`.

    THE PRECONDITION IS NOT BELT AND BRACES. `CREATE TABLE` over a name the
    schema already owns raises `DuplicateTable` from inside psycopg, four frames
    below the test, and says nothing about which of the three possible causes it
    is — a leaked probe, two tests sharing a name, or a migration that took the
    name. This distinguishes them: `to_regclass` answering non-NULL here, with
    `PROBE_PREFIX` in force, can only be the third. It also stops the `finally`
    from `DROP`ping a real table, which is the failure mode that would turn a
    naming collision into a wrecked schema for every module after this one.
    """
    existing = connection.execute(text("SELECT to_regclass(:name)"), {"name": name}).scalar()
    assert existing is None, (
        f"{name} already exists in the migrated schema, so this probe cannot create it. "
        f"Every probe name carries {PROBE_PREFIX!r} precisely so that no migration can "
        f"take one; a relation under that prefix means either a probe leaked out of a "
        f"previous run or something now creates the name for real. Do not rename the "
        f"probe to dodge it until you know which."
    )
    connection.execute(text(f"SET ROLE {'titlepipe_owner'}"))
    connection.execute(text(ddl))
    connection.commit()
    try:
        yield
    finally:
        connection.execute(text(f"DROP TABLE {name}"))
        connection.commit()


def test_the_migrated_schema_passes_its_own_coverage_check(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The positive control, and the one assertion here that is not a breakage.

    It is also the assertion that would have to be edited by anybody adding an
    un-isolated table, which is the point: the edit is the reviewable diff.
    """
    with seam_engine(migrated_database).connect() as connection:
        assert audit_rls_coverage(connection) == ()


def test_a_new_tenant_table_with_no_policy_turns_the_check_red(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE PROOF. A table SHAPED exactly like the ones a worker is landing this
    week — real `tenant_id`, composite primary key — and no RLS.

    Before this module existed the whole suite stayed green on this schema, and
    `tests/test_forced_rls_and_grants.py` would have reported it as a set
    mismatch whose obvious fix is to add the name to `EXPECTED_TENANT_TABLES`.

    The SHAPE is the fixture; the NAME deliberately is not. This test was
    `escalations` until `integration/backend-2026-09` landed a real `escalations`
    table and it stopped running at all. See `PROBE_PREFIX`.
    """
    ddl = (
        f"CREATE TABLE {PROBE_UNISOLATED} ("
        "  tenant_id uuid NOT NULL,"
        "  id uuid NOT NULL,"
        f"  CONSTRAINT pk_{PROBE_UNISOLATED} PRIMARY KEY (tenant_id, id))"
    )
    with seam_engine(migrated_database).connect() as connection:
        with _temporary_table(connection, ddl, PROBE_UNISOLATED):
            faults = audit_rls_coverage(connection)
            assert {(f.table, f.fault) for f in faults} == {
                (PROBE_UNISOLATED, "row_level_security_not_enabled"),
                (PROBE_UNISOLATED, "row_level_security_not_forced"),
                (PROBE_UNISOLATED, "no_policy"),
            }
            with pytest.raises(RlsCoverageError, match=PROBE_UNISOLATED):
                assert_rls_coverage(connection)
        assert audit_rls_coverage(connection) == ()


def test_a_table_missing_the_tenant_column_entirely_is_still_seen(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The hole in the `has a tenant_id` derivation, driven.

    `tests/test_forced_rls_and_grants.py` builds its set from the presence of the
    column, so this table is invisible to it: it is not a tenant table by that
    definition and not a named global either. Here it is a fault.
    """
    ddl = (
        f"CREATE TABLE {PROBE_NO_TENANT_COLUMN} ("
        "  id uuid NOT NULL,"
        f"  CONSTRAINT pk_{PROBE_NO_TENANT_COLUMN} PRIMARY KEY (id))"
    )
    with seam_engine(migrated_database).connect() as connection:
        with _temporary_table(connection, ddl, PROBE_NO_TENANT_COLUMN):
            faults = {(f.table, f.fault) for f in audit_rls_coverage(connection)}
        assert (PROBE_NO_TENANT_COLUMN, "no_tenant_column") in faults
        assert (PROBE_NO_TENANT_COLUMN, "no_policy") in faults


def test_a_policy_that_merely_exists_turns_the_check_red(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """ENABLE, FORCE, and a policy — three ticks, and every row of every tenant
    readable by every established session. This is the failure a check that
    counted policies reports as healthy."""
    ddl = (
        f"CREATE TABLE {PROBE_OPEN_POLICY} ("
        "  tenant_id uuid NOT NULL,"
        "  id uuid NOT NULL,"
        f"  CONSTRAINT pk_{PROBE_OPEN_POLICY} PRIMARY KEY (tenant_id, id))"
    )
    with seam_engine(migrated_database).connect() as connection:
        with _temporary_table(connection, ddl, PROBE_OPEN_POLICY):
            connection.execute(text(f"ALTER TABLE {PROBE_OPEN_POLICY} ENABLE ROW LEVEL SECURITY"))
            connection.execute(text(f"ALTER TABLE {PROBE_OPEN_POLICY} FORCE ROW LEVEL SECURITY"))
            connection.execute(
                text(f"CREATE POLICY tenant_isolation ON {PROBE_OPEN_POLICY} USING (true)")
            )
            connection.commit()
            faults = {(f.table, f.fault) for f in audit_rls_coverage(connection)}
        assert faults == {(PROBE_OPEN_POLICY, "no_policy_scoping_by_tenant")}


def test_a_policy_that_joins_another_relation_turns_the_check_red(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """PLAN §5 rule 5's own example, against the real server's deparse.

    A NULL `order_id` makes the row invisible to its OWN tenant; the inverted
    polarity makes it visible to everyone. Neither raises. The anchored
    whole-predicate match is the machine, and this is it running.
    """
    ddl = (
        f"CREATE TABLE {PROBE_JOINED_POLICY} ("
        "  tenant_id uuid NOT NULL,"
        "  id uuid NOT NULL,"
        "  order_id uuid,"
        f"  CONSTRAINT pk_{PROBE_JOINED_POLICY} PRIMARY KEY (tenant_id, id))"
    )
    with seam_engine(migrated_database).connect() as connection:
        with _temporary_table(connection, ddl, PROBE_JOINED_POLICY):
            connection.execute(text(f"ALTER TABLE {PROBE_JOINED_POLICY} ENABLE ROW LEVEL SECURITY"))
            connection.execute(text(f"ALTER TABLE {PROBE_JOINED_POLICY} FORCE ROW LEVEL SECURITY"))
            connection.execute(
                # S608 wants the statement checked for untrusted input, for the
                # reason `test_forced_rls_and_grants.py` records at its own
                # suppression: a relation name cannot be a bind parameter in any
                # dialect. The only name interpolated is `PROBE_JOINED_POLICY`,
                # a literal at the top of this file; nothing here comes from the
                # database, the environment or a fixture. `orders` is spelled out
                # because the policy has to join a REAL table to be the failure
                # PLAN §5 rule 5 describes.
                text(
                    f"CREATE POLICY tenant_isolation ON {PROBE_JOINED_POLICY} USING ("  # noqa: S608
                    f"  EXISTS (SELECT 1 FROM orders o "
                    f"WHERE o.id = {PROBE_JOINED_POLICY}.order_id))"
                )
            )
            connection.commit()
            faults = {(f.table, f.fault) for f in audit_rls_coverage(connection)}
        assert faults == {(PROBE_JOINED_POLICY, "no_policy_scoping_by_tenant")}


def test_a_second_policy_on_a_correctly_isolated_table_turns_the_check_red(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """Against `orders`, which is correctly isolated, so the only thing that
    changes is the count. `DROP POLICY` restores it."""
    with seam_engine(migrated_database).connect() as connection:
        connection.execute(text("SET ROLE titlepipe_owner"))
        connection.execute(
            text(
                "CREATE POLICY tenant_maintenance ON orders FOR UPDATE "
                "USING (true) WITH CHECK (true)"
            )
        )
        connection.commit()
        try:
            faults = {(f.table, f.fault) for f in audit_rls_coverage(connection)}
            assert faults == {("orders", "more_than_one_policy")}
        finally:
            connection.execute(text("DROP POLICY tenant_maintenance ON orders"))
            connection.commit()
        assert audit_rls_coverage(connection) == ()


def test_the_allowlist_names_exactly_the_tables_the_schema_leaves_unisolated(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """`UNSCOPED_TABLES` is asserted against the live schema rather than trusted.

    A name that stops being a real table is a stale exemption that would silently
    cover a future table created under the same name.
    """
    with seam_engine(migrated_database).connect() as connection:
        present = {
            str(row[0])
            for row in connection.execute(
                text(
                    "SELECT relname FROM pg_class "
                    "WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')"
                )
            ).all()
        }
        unisolated = {
            str(row[0])
            for row in connection.execute(
                text(
                    "SELECT relname FROM pg_class "
                    "WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p') "
                    "  AND NOT relrowsecurity"
                )
            ).all()
        }
    assert present >= UNSCOPED_TABLES
    assert unisolated == set(UNSCOPED_TABLES)


@pytest.mark.asyncio
async def test_the_boot_check_reads_the_catalog_as_the_unprivileged_app_role(
    migrated_database: str, app_dsn: str
) -> None:
    """The boot half runs as `titlepipe_app`, which owns nothing and bypasses
    nothing, so whether it can READ `pg_policies.qual` is the question the whole
    boot check rests on.

    MEASURED 2026-09-04 against postgres:18.4 before this test was written: that
    role reads `relrowsecurity`, `relforcerowsecurity` and `qual` for every table
    in the schema, including tables it holds no grant on — which is exactly the
    set a forgotten policy would be hiding in. This is that measurement, pinned.
    """
    assert migrated_database  # the schema this reads is the migrated one
    engine = make_engine(app_dsn)
    try:
        async with engine.connect() as connection:
            current = await connection.execute(text("SELECT current_user"))
            assert str(current.scalar_one()) == APP_ROLE
            await assert_rls_coverage_async(connection)
    finally:
        await engine.dispose()


# The second schema the census had to grow to see. Prefixed like the table probes
# and for the same reason: no migration may ever take the name, and the drop in
# the `finally` is `CASCADE`, which would take a real schema's contents with it.
PROBE_SCHEMA = f"{PROBE_PREFIX}sidecar"


def test_a_perfectly_isolated_table_outside_the_owned_schema_is_still_a_fault() -> None:
    """🔴 The pure half of the schema hole. ENABLE, FORCE, tenant column, and the
    exact policy every healthy case here uses — and it is refused anyway.

    Location is judged BEFORE row security, so this cannot be argued green by
    fixing the RLS on it: the fault is that it exists outside `SCHEMA` at all,
    which is what `roles.sql`'s `CREATE ON DATABASE` revoke is the other end of.
    """
    elsewhere = TableFacts(
        "secrets", rls_enabled=True, rls_forced=True, has_tenant_column=True, schema="sidecar"
    )
    faults = analyse_coverage([elsewhere], [_healthy_policy("secrets")])
    assert [(f.table, f.fault) for f in faults] == [
        ("sidecar.secrets", "table_outside_the_owned_schema")
    ]


def test_an_allowlisted_name_cannot_exempt_a_table_in_another_schema() -> None:
    """`UNSCOPED_TABLES` is a list of BARE names, so before the location check ran
    first a table in another schema could take one of those names and be waved
    through by the allowlist — the allowlist reading as a schema-wide exemption.
    """
    exempt = next(iter(UNSCOPED_TABLES))
    smuggled = TableFacts(
        exempt, rls_enabled=False, rls_forced=False, has_tenant_column=True, schema="sidecar"
    )
    assert [f.fault for f in analyse_coverage([smuggled], [])] == ["table_outside_the_owned_schema"]


def test_a_tenant_table_in_a_second_schema_is_seen_by_the_live_census(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE PROOF, and the one that needed the SQL to change rather than the
    judgement: before 2026-09-08 both catalog reads carried `WHERE nspname =
    'public'`, so this table was not in the set and `audit_rls_coverage` returned
    `()` with it sitting there.

    MEASURED the same day, end to end: the same table reached by a real
    `alembic upgrade head` (after one `GRANT CREATE ON DATABASE`, which is the
    only thing that stood in the way) migrated green, and `titlepipe_app` pinned
    to one tenant then read both tenants' rows out of it.

    Deliberately given ENABLE, FORCE and a policy, so a census that reached it but
    judged it by row security alone would still pass and this would not.
    """
    with seam_engine(migrated_database).connect() as connection:
        connection.execute(text(f"CREATE SCHEMA {PROBE_SCHEMA}"))
        connection.execute(
            text(
                f"CREATE TABLE {PROBE_SCHEMA}.secrets ("
                "  tenant_id uuid NOT NULL,"
                "  id uuid NOT NULL,"
                "  CONSTRAINT pk_probe_sidecar_secrets PRIMARY KEY (tenant_id, id))"
            )
        )
        connection.execute(text(f"ALTER TABLE {PROBE_SCHEMA}.secrets ENABLE ROW LEVEL SECURITY"))
        connection.execute(text(f"ALTER TABLE {PROBE_SCHEMA}.secrets FORCE ROW LEVEL SECURITY"))
        connection.execute(
            text(
                f"CREATE POLICY tenant_isolation ON {PROBE_SCHEMA}.secrets USING "
                f"(tenant_id = NULLIF(current_setting('{TENANT_GUC}', true), '')::uuid)"
            )
        )
        connection.commit()
        try:
            faults = {(f.table, f.fault) for f in audit_rls_coverage(connection)}
            assert faults == {(f"{PROBE_SCHEMA}.secrets", "table_outside_the_owned_schema")}
            with pytest.raises(RlsCoverageError, match=PROBE_SCHEMA):
                assert_rls_coverage(connection)
        finally:
            connection.execute(text(f"DROP SCHEMA {PROBE_SCHEMA} CASCADE"))
            connection.commit()
        assert audit_rls_coverage(connection) == ()


def test_the_census_still_excludes_the_servers_own_schemas(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The other side of the census widening: `pg_catalog` holds tables with no
    row security at all, so a census that stopped filtering would report hundreds
    of faults on every run and be deleted within the day.

    `pg_%` is excluded BY PREFIX, and the prefix is the server's own reservation
    rather than our convention. MEASURED 2026-09-08 against postgres:18.4:
    `CREATE SCHEMA pg_hideout` is refused with `unacceptable schema name … The
    prefix "pg_" is reserved for system schemas`, so the exclusion cannot be used
    as a hiding place. `information_schema` has no such backstop and is excluded
    by name; see the module docstring's residual.
    """
    with seam_engine(migrated_database).connect() as connection:
        assert audit_rls_coverage(connection) == ()
        catalog_tables = connection.execute(
            text(
                "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE c.relkind IN ('r','p') AND n.nspname IN ('pg_catalog','information_schema')"
            )
        ).scalar_one()
        assert catalog_tables > 0, "nothing was being excluded, so the exclusion proves nothing"
        assert SCHEMA == "public"


def test_the_guc_the_check_requires_is_the_one_the_policies_read(
    tenant_guc: str,
) -> None:
    """`TENANT_GUC` is written out in `rls_coverage.py` rather than imported from
    `engine.py`, so this is what keeps the copy honest — against `conftest.py`'s
    fixture, which is the same value `tests/test_forced_rls_and_grants.py` holds
    the migration to."""
    assert tenant_guc == TENANT_GUC

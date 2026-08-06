"""Revision `0002`, read back from the live catalog rather than from the file.

The database is an EPHEMERAL CONTAINER — see `conftest.py`'s database seam. The
migration is applied by the module-scoped `migrated_database` fixture, which also
puts the database back exactly as it found it.

Nothing here is skipped. If Docker or `psql` is unavailable these tests FAIL.

## Why the tenant tables are DERIVED and not listed

`_tenant_tables` asks the catalog which tables carry a `tenant_id` column. A
hardcoded list would be satisfied by a migration that added an eighth tenant
table and forgot to isolate it — the list would not mention it, so nothing would
look. Derivation makes a new tenant table opt OUT of these assertions by
deliberately not having the column, rather than opt in by being remembered.

`alembic_version` is excluded from the derivation EXPLICITLY, by name, even
though it has no `tenant_id` and the predicate already excludes it. The naive
derivation — every table in `public`, keyed on `tenant_id` where present and on
`id` otherwise — is the one that reaches for it, and it is in `public` and owned
by `titlepipe_owner` exactly like the seven. An `id`-keyed `tenant_isolation`
policy on Alembic's own version table locks Alembic out of reading its own
migration state. The exclusion is the note that says so.

## The cardinality floor AND the exact set, and what each one catches

Both, because neither catches the other's failure:

* **the floor** (`>= 6`) catches a DERIVATION that stopped working. A predicate
  typo, a filter on the wrong `relkind`, a `pg_attribute` join that lost
  `NOT attisdropped` — any of those can return an empty or short set, and every
  per-table assertion below is a `for` loop, which passes over nothing. Task 2
  learned this from the other side: a floor of five roles was satisfied while two
  real roles were missing, so a floor alone is not enough either;
* **the exact set** catches the SIX WRONG TABLES. A cardinality of six is
  satisfied by six decoys as readily as by the six that exist, which is precisely
  the shape that defeated Task 2's role floor.

## 🔴 TWO ASSERTIONS HERE USED TO PASS AGAINST A BROKEN MIGRATION

Both were measured on this tree, one mutation at a time, whole suite each time,
and both shipped **`192 passed`**:

* **the predicate was checked as a SUBSTRING, not as a shape.** `"nullif" in
  qual.lower()` never asked whether the policy compares the key column to
  anything, so `USING (nullif(current_setting(…), '') IS NOT NULL)` — which hands
  every established tenant every other tenant's rows — satisfied it on six of
  seven tables. `TENANT_PREDICATE_SHAPE` and `_tenant_predicate_fault` replace it
  with a whole-predicate match that pulls the key column and the GUC out as named
  groups and compares both against what this table and `conftest.py` say they
  should be;
* **`UPDATE` was granted, read, and never asserted.** The loop read
  `GRANTED_VERBS[:2]`. Narrowing `0002`'s `GRANT SELECT, INSERT, UPDATE` to
  `GRANT SELECT, INSERT` on the five tenant tables that are not `audit_log` was
  green. `_expected_grants` derives the withheld list from the granted one so a
  verb cannot be absent from both.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping, Sequence
from typing import NamedTuple
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

# 🔴 WRITTEN OUT, NOT IMPORTED FROM THE MIGRATION. A test that builds its
# expectation from the module under test moves whenever that module does and
# pins nothing — the same reason `test_schema_migration.py` spells the four
# `na_reason` labels as a literal. These six are the contract; `tenants` is the
# registry and is asserted separately, on `id`.
EXPECTED_TENANT_TABLES = frozenset(
    {"orders", "packages", "pages", "fields", "field_readings", "audit_log"}
)

# The floor, as its own literal beside the set it is a floor for. See the module
# docstring for which failure each of the two catches.
MINIMUM_TENANT_TABLES = 6

REGISTRY_TABLE = "tenants"
POLICY_NAME = "tenant_isolation"

# The column each policy keys on: `tenant_id` on the six, `id` on the registry
# whose primary key IS a tenant id.
TENANT_KEY_COLUMN = "tenant_id"
REGISTRY_KEY_COLUMN = "id"

# ---------------------------------------------------------------------------
# 🔴 THE SHAPE OF A `tenant_isolation` PREDICATE, AND WHY IT IS A SHAPE RATHER
#    THAN A SUBSTRING.
# ---------------------------------------------------------------------------
# What used to stand here was `assert "nullif" in facts.qual.lower()`, and that
# is satisfied by a predicate which does not mention the key column at all.
# MEASURED 2026-08-06 on this tree, `0002::_isolate` patched so that `orders`
# keeps its real predicate and the other six plus `tenants` get
#
#     USING (nullif(current_setting('app.current_tenant', true), '') IS NOT NULL)
#
# — a predicate that is TRUE for every row as soon as any tenant is established,
# i.e. one that hands every established tenant every other tenant's rows. It
# contains `nullif`, so this assertion passed; it denies an unestablished session,
# so every deny-state assertion passed; and the isolation proof only ever read
# `orders` with a tenant established, so that passed too. `192 passed`, against a
# database leaking six of seven tables.
#
# HOW THIS PARSES IT. `pg_policies.qual` is the SERVER's deparse of the expression
# tree — `pg_get_expr` on `pg_policy.polqual` — not the text anybody typed, so it
# is normalised, fully parenthesised, and rendered with the function name in
# UPPER CASE. MEASURED 2026-08-06 against postgres:18.4, `orders`:
#
#     (tenant_id = (NULLIF(current_setting('app.current_tenant'::text, true), ''::text))::uuid)
#
# and `tenants` identically but for `id` in place of `tenant_id`. Because the
# deparse is canonical, the whole predicate can be matched — anchored at both ends
# with `\A`/`\Z`, so there is no gap for anything else to hide in — rather than
# searched for a fragment.
#
# THE UPPER-CASE DEPARSE IS SURVIVED BY `re.IGNORECASE`, AND THAT COSTS NOTHING
# HERE BECAUSE THE TWO VALUES THAT CARRY MEANING ARE NOT MATCHED BY THE PATTERN
# AT ALL. `IGNORECASE` is what lets `NULLIF` match `nullif` (and would let a
# future release respell `current_setting` or `true`); the key column and the GUC
# name are pulled out as NAMED GROUPS and compared with `==`, case-sensitively,
# against the expected column and against the `tenant_guc` FIXTURE. So the
# tolerance applies only to SQL's own rendering of its keywords, and never to the
# two strings a wrong policy would get wrong.
#
# WHITESPACE IS NORMALISED BEFORE MATCHING (`_normalised_qual`), so a deparse that
# breaks or pads a line differently is still matched on its structure. Nothing
# else is normalised: the `::text` casts PostgreSQL adds to the two literals are
# REQUIRED by the pattern, because they are what it emits and a predicate missing
# them is a predicate this file has never seen.
TENANT_PREDICATE_SHAPE = re.compile(
    r"\A\("
    r"(?P<key>[a-z_][a-z0-9_]*) = "
    r"\(NULLIF\(current_setting\('(?P<guc>[^']+)'::text, true\), ''::text\)\)::uuid"
    r"\)\Z",
    re.IGNORECASE,
)

APP_ROLE = "titlepipe_app"
WORKER_ROLE = "titlepipe_worker"
OWNER_ROLE = "titlepipe_owner"
MIGRATION_ROLE = "titlepipe_migration"

# The verbs `0002` grants, and the ones it must never grant anywhere. `DELETE` is
# in the second list on all seven: the contract is SELECT/INSERT/UPDATE, and a
# stray `GRANT ALL` would satisfy every positive assertion in this file while
# handing `titlepipe_app` the ability to erase a tenant's data.
GRANTED_VERBS = ("SELECT", "INSERT", "UPDATE")
REFUSED_VERBS = ("DELETE", "TRUNCATE")

# 🔴 `audit_log` IS THE ONE TABLE THAT GETS TWO VERBS RATHER THAN THREE, AND IT IS
# A TASK 4 RULING RATHER THAN A GAP. `0001`'s `audit_log_append_only` trigger
# refuses UPDATE whatever the ACL says, so `GRANT UPDATE ON audit_log` would
# change no behaviour and would MISSTATE THE INTENT of the one table this system
# promises never to edit in place. `test_audit_log_is_granted_insert_but_never
# _update` holds it from its own side; this constant is what keeps the derived
# loop below from contradicting it.
APPEND_ONLY_TABLE = "audit_log"
APPEND_ONLY_GRANTED_VERBS = ("SELECT", "INSERT")


def _expected_grants(table: str) -> tuple[Sequence[str], Sequence[str]]:
    """`(granted, withheld)` for one table — every verb this file knows about.

    🔴 THE WITHHELD LIST IS DERIVED FROM THE GRANTED ONE rather than written out,
       and that is what closes F6.

    The loop this feeds used to read `for verb in GRANTED_VERBS[:2]` — SELECT and
    INSERT — so `UPDATE` was fetched into `privileges` on all six tenant tables
    and asserted on none of them. MEASURED 2026-08-06: `0002`'s
    `GRANT SELECT, INSERT, UPDATE` narrowed to `GRANT SELECT, INSERT` on the five
    tenant tables that are not `audit_log` shipped **`192 passed`**. Plan 01
    Task 4's contract is SELECT/INSERT/UPDATE on all seven, and a migration that
    silently drops UPDATE is `42501` out of every update handler in Plans 02-06.

    Deriving `withheld` means a verb can never be silently absent from both
    lists, which is exactly how `UPDATE` came to be unasserted: it was in
    `GRANTED_VERBS`, it was read, and no assertion mentioned it.
    """
    granted = APPEND_ONLY_GRANTED_VERBS if table == APPEND_ONLY_TABLE else GRANTED_VERBS
    withheld = tuple(verb for verb in (*GRANTED_VERBS, *REFUSED_VERBS) if verb not in granted)
    return granted, withheld


# `feature_not_supported`, raised by `0001`'s append-only trigger.
APPEND_ONLY_SQLSTATE = "0A000"
# `insufficient_privilege`. PostgreSQL uses this both for "you may not touch this
# table" and for "this query would be affected by a row-level security policy",
# which is why the tests below assert the MESSAGE as well where the two could be
# confused.
INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501"

# Two tenants that exist only here. Any two distinct uuids would do; these are
# legible in a failure message, which random ones are not.
TENANT_ONE = UUID("11111111-1111-1111-1111-111111111111")
TENANT_TWO = UUID("22222222-2222-2222-2222-222222222222")


class PolicyFacts(NamedTuple):
    """The three things a `tenant_isolation` policy has to be.

    `qual` is `pg_policies`' rendering of the `USING` expression, which is the
    only place the `nullif` can be read back from — `pg_policy.polqual` is a
    `pg_node_tree` and is not text anybody can assert on.
    """

    command_name: str
    permissive: str
    qual: str


def _tenant_tables(connection: Connection, version_table: str) -> set[str]:
    """Tables in `public` that carry a `tenant_id` column. See the module docstring.

    `attnum > 0 AND NOT attisdropped` is what makes this a question about the
    table's live columns: `pg_attribute` also holds the system columns at
    negative `attnum`, and a dropped column keeps its row with `attisdropped`
    set and a mangled name. Neither would match `tenant_id` today, and both are
    the kind of thing a derivation is wrong about quietly.
    """
    result = connection.execute(
        text(
            "SELECT c.relname FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r' "
            "  AND c.relname <> :version_table "
            "  AND EXISTS (SELECT 1 FROM pg_attribute a "
            "              WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' "
            "                AND a.attnum > 0 AND NOT a.attisdropped)"
        ),
        {"version_table": version_table},
    )
    return {str(row[0]) for row in result}


def _row_security(connection: Connection) -> dict[str, tuple[bool, bool]]:
    """table -> (`relrowsecurity`, `relforcerowsecurity`).

    Both, and they are independent columns. `ALTER TABLE ... DISABLE ROW LEVEL
    SECURITY` leaves `relforcerowsecurity` set — MEASURED 2026-08-05 against
    postgres:18.4, `pages` came back `(f, t)` — so reading one says nothing about
    the other.
    """
    result = connection.execute(
        text(
            "SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
    )
    return {str(row[0]): (bool(row[1]), bool(row[2])) for row in result}


def _policies(connection: Connection) -> dict[tuple[str, str], PolicyFacts]:
    """(table, policy name) -> `PolicyFacts`, from `pg_policies`.

    A table with no policy contributes no row and is simply absent, which is why
    every caller asserts membership before reading a value.
    """
    result = connection.execute(
        text(
            "SELECT tablename, policyname, cmd, permissive, coalesce(qual, '') "
            "FROM pg_policies WHERE schemaname = 'public'"
        )
    )
    return {
        (str(row[0]), str(row[1])): PolicyFacts(str(row[2]), str(row[3]), str(row[4]))
        for row in result
    }


def _table_privileges(connection: Connection, role: str, table: str) -> dict[str, bool]:
    """Every verb this file cares about, for one role on one table.

    `has_table_privilege` and not a read of `relacl`: it answers the question the
    server will actually ask, including privileges reaching the role through
    `PUBLIC` or through a membership. An ACL read would miss both.
    """
    verbs = [*GRANTED_VERBS, *REFUSED_VERBS]
    result = connection.execute(
        text(
            "SELECT verb, has_table_privilege(:role, :table, verb) "
            "FROM unnest(CAST(:verbs AS text[])) AS verb"
        ),
        {"role": role, "table": table, "verbs": verbs},
    )
    return {str(row[0]): bool(row[1]) for row in result}


def _normalised_qual(qual: str) -> str:
    """`qual` with every run of whitespace collapsed to one space, and trimmed.

    The only normalisation applied before `TENANT_PREDICATE_SHAPE` is matched.
    See that constant for what is deliberately NOT normalised.
    """
    return " ".join(qual.split())


def _tenant_predicate_fault(qual: str, key_column: str, tenant_guc: str) -> str | None:
    """`None` if `qual` is the right predicate, else a sentence saying what it is not.

    Three separate questions, answered in order and reported separately, because
    each one has a different wrong policy behind it:

    1. does it PARSE as `<column> = (NULLIF(current_setting(<guc>, true), ''))::uuid`
       at all? A predicate that does not is the tenant-blind shape measured at
       `TENANT_PREDICATE_SHAPE` — or any other expression somebody wrote;
    2. is the compared column the one this table is keyed on? `tenant_id` on the
       six, `id` on the registry. A policy keyed on the wrong column of the right
       shape isolates by something that is not the tenant;
    3. is the GUC the one the application actually sets? This is compared against
       the `tenant_guc` FIXTURE — `conftest.py` owns the name, `make_engine` pins
       it at connect time and `tenant_session` writes it, so a policy reading a
       different setting denies every row to every session forever. Nothing in the
       catalog could tell you that, because a policy reading `app.tenant` is as
       well-formed as one reading `app.current_tenant`.

    Returning a reason rather than asserting keeps the table name in the caller's
    message and keeps this usable from both catalog tests.
    """
    normalised = _normalised_qual(qual)
    match = TENANT_PREDICATE_SHAPE.match(normalised)
    if match is None:
        return (
            "it is not `<key> = (NULLIF(current_setting('<guc>'::text, true), "
            "''::text))::uuid` in any spelling. A predicate that merely CONTAINS "
            "`nullif` — `nullif(current_setting(…), '') IS NOT NULL`, say — denies "
            "an unestablished session and hands every established one every other "
            "tenant's rows"
        )
    if match["key"] != key_column:
        return (
            f"it compares {match['key']!r} rather than {key_column!r}, so whatever "
            f"it isolates by is not this table's tenant"
        )
    if match["guc"] != tenant_guc:
        return (
            f"it reads the setting {match['guc']!r} rather than {tenant_guc!r}, "
            f"which is the one make_engine pins and tenant_session writes. A policy "
            f"on any other setting denies every row to every session"
        )
    return None


def _assert_tenant_isolation_policy(
    policies: Mapping[tuple[str, str], PolicyFacts],
    table: str,
    key_column: str,
    tenant_guc: str,
) -> None:
    """The whole `tenant_isolation` contract for one table: presence, cmd, permissive, qual.

    `ALL` and `PERMISSIVE` are asserted here rather than only on the six, which is
    the second thing the registry's own test was missing: a `tenant_isolation`
    policy declared `FOR SELECT` leaves INSERT, UPDATE and DELETE entirely
    unpoliced, and reads exactly like isolation to anything that only reads.
    """
    assert (table, POLICY_NAME) in policies, (
        f"{table} has row-level security on and no {POLICY_NAME} policy. "
        f"Policies present: {sorted(name for owner, name in policies if owner == table)}"
    )
    facts = policies[(table, POLICY_NAME)]

    assert facts.command_name == "ALL", (
        f"{table}'s {POLICY_NAME} covers {facts.command_name}, not ALL. Every verb "
        f"it does not cover is unpoliced."
    )
    assert facts.permissive == "PERMISSIVE", (
        f"{table}'s {POLICY_NAME} is {facts.permissive}. A RESTRICTIVE-only "
        f"policy set denies every row, which reads as isolation and is an outage."
    )

    fault = _tenant_predicate_fault(facts.qual, key_column, tenant_guc)
    assert fault is None, (
        f"{table}'s {POLICY_NAME} predicate is wrong: {fault}. Live qual: {facts.qual}"
    )


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    A near-copy of the helper in `test_schema_migration.py`, and deliberately not
    imported from it: under `--import-mode=importlib` one test module cannot
    import another, which is the same constraint that turned every constant in
    `conftest.py` into a fixture. `isinstance` rather than a bare `getattr`,
    because comparing `Any` to a string passes for a `None` as readily as for a
    code.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _seed_two_tenants(engine: Engine) -> None:
    """Two committed `orders` rows, one per tenant, written as the superuser.

    Committed rather than rolled back because the readers below are OTHER
    connections — an uncommitted row is invisible to them, and a test that read
    zero rows through a policy because nothing was there would prove nothing.

    The superuser bypasses RLS unconditionally (`FORCE` removes the OWNER's
    exemption, not a superuser's), so this seeds both tenants from one session.

    `DELETE` first, so the row count is a function of this call and not of
    whatever ran before it. `orders` has no append-only trigger; `audit_log`
    does, which is why the seed is on `orders`.

    The rows are left behind. `migrated_database` is MODULE-scoped and its
    teardown drops every table, so they cannot reach another test file.
    """
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM orders"))
        connection.execute(
            text("INSERT INTO orders (tenant_id) VALUES (:one), (:two)"),
            {"one": TENANT_ONE, "two": TENANT_TWO},
        )


def test_every_tenant_table_is_forced_isolated_and_reachable_by_the_app(
    migrated_database: str,
    alembic_version_table: str,
    seam_engine: Callable[[str], Engine],
    app_role: str,
    tenant_guc: str,
) -> None:
    """🔴 THE CATALOG PROOF. Derived, floored, set-checked, then asserted per table.

    FOUR PROPERTIES PER TABLE, and none of them implies another:

    * `relrowsecurity AND relforcerowsecurity`. `ENABLE` alone exempts the
      table's OWNER, and the owner is `titlepipe_owner` — the role every
      migration runs as. The two are separate `pg_class` columns and are read
      separately;
    * a policy called `tenant_isolation` exists, covering `ALL` and `PERMISSIVE`.
      RLS enabled with NO policy denies every row to every non-bypassing role,
      which looks like isolation working and is actually the application being
      broken;
    * **the policy's `qual` HAS THE RIGHT SHAPE** —
      `<this table's key column> = (NULLIF(current_setting(<the tenant_guc
      fixture>'::text, true), ''::text))::uuid`, matched whole. This assertion
      used to read `"nullif" in facts.qual.lower()`, and `TENANT_PREDICATE_SHAPE`
      holds the measurement of what that let through: a predicate containing
      `nullif` and comparing nothing, which leaks six of seven tables and ships
      `192 passed`.

      The `nullif` itself is still the reason the expression is shaped this way.
      `current_setting('app.current_tenant', true)` answers NULL for a GUC that
      was never set and `''` for one that was set and reverted — MEASURED
      2026-08-05 — and `''::uuid` RAISES `invalid input syntax for type uuid: ""`.
      A policy without it returns a 500 where a clean denial belongs, and
      `conftest.py::SEAM_CONNECT_ARGS` pins every connection in this suite at
      `''`, so that is the ordinary state rather than an exotic one;
    * `has_table_privilege(titlepipe_app, …)` for **SELECT, INSERT and UPDATE**.
      RLS is evaluated AFTER the privilege check, never instead of it. Without the
      grants the role gets `42501 permission denied for table orders` — MEASURED
      — and a read test would report zero rows and call it isolation. `audit_log`
      is the one table at two verbs rather than three; see `_expected_grants` for
      the ruling and for what the missing UPDATE assertion used to let through.

    `DELETE` and `TRUNCATE` are asserted ABSENT on every table, and so is `UPDATE`
    on `audit_log`. The contract is three verbs; a `GRANT ALL` would satisfy every
    positive assertion here and hand `titlepipe_app` the ability to erase a
    tenant's data.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            derived = _tenant_tables(connection, alembic_version_table)
            security = _row_security(connection)
            policies = _policies(connection)
            privileges = {
                table: _table_privileges(connection, app_role, table) for table in sorted(derived)
            }
    finally:
        engine.dispose()

    # THE FLOOR FIRST. Everything below is a `for` loop, and a `for` over nothing
    # passes. See the module docstring for why the exact set does not subsume it.
    assert len(derived) >= MINIMUM_TENANT_TABLES, (
        f"the derivation found {len(derived)} tenant tables, fewer than the "
        f"{MINIMUM_TENANT_TABLES} that exist: {sorted(derived)}. Every assertion "
        f"below is a loop, so a broken derivation reports success."
    )
    assert derived == set(EXPECTED_TENANT_TABLES), (
        f"the tenant tables are {sorted(derived)}, not "
        f"{sorted(EXPECTED_TENANT_TABLES)}. A count of "
        f"{MINIMUM_TENANT_TABLES} is satisfied by six decoys just as readily."
    )

    for table in sorted(derived):
        enabled, forced = security[table]
        assert enabled is True, f"{table} does not have row-level security enabled"
        assert forced is True, (
            f"{table} is ENABLE but not FORCE. Its owner is {OWNER_ROLE}, which is "
            f"who every migration runs as, and without FORCE that role reads and "
            f"writes every tenant's rows."
        )

        _assert_tenant_isolation_policy(policies, table, TENANT_KEY_COLUMN, tenant_guc)

        granted, withheld = _expected_grants(table)
        for verb in granted:
            assert privileges[table][verb] is True, (
                f"{app_role} has no {verb} on {table}. RLS runs after the privilege "
                f"check, so this role gets `permission denied for table {table}` and "
                f"an isolation test would read zero rows for the wrong reason."
            )
        for verb in withheld:
            assert privileges[table][verb] is False, (
                f"{app_role} holds {verb} on {table}, which 0002 never grants"
            )


def test_the_registry_is_forced_and_isolated_on_its_own_id(
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
    app_role: str,
    tenant_guc: str,
) -> None:
    """`tenants` is not in the derived set, and it still has to be locked down.

    Its primary key IS a tenant id, so it carries no `tenant_id` column and the
    derivation above cannot see it — which is exactly why it gets its own test
    rather than being folded in. The policy keys on `id`; everything else about it
    is identical to the six, and it goes through the same
    `_assert_tenant_isolation_policy` so that "identical" is a shared assertion
    rather than a claim in a docstring.

    WHAT THIS TEST USED TO MISS, and it missed it in both of F1(a)'s directions:
    it read `"nullif" in qual.lower()` plus `"tenant_id" not in qual`, which the
    tenant-blind predicate `nullif(current_setting(…), '') IS NOT NULL` satisfies
    on both counts — it contains `nullif` and it does not contain `tenant_id`. And
    it asserted neither `cmd` nor `permissive`, both of which the six were already
    getting.

    `tenant_id` is still asserted absent, redundantly with the shape check that
    now requires `id`. It is the assertion whose FAILURE MESSAGE says why: the
    registry has no such column, so a policy naming one is a policy that would
    have to be written against a different table.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            enabled, forced = _row_security(connection)[REGISTRY_TABLE]
            policies = _policies(connection)
            privileges = _table_privileges(connection, app_role, REGISTRY_TABLE)
    finally:
        engine.dispose()

    assert enabled is True
    assert forced is True, f"{REGISTRY_TABLE} is ENABLE but not FORCE"

    _assert_tenant_isolation_policy(policies, REGISTRY_TABLE, REGISTRY_KEY_COLUMN, tenant_guc)

    qual = policies[(REGISTRY_TABLE, POLICY_NAME)].qual
    assert TENANT_KEY_COLUMN not in qual, (
        f"{REGISTRY_TABLE}'s policy names {TENANT_KEY_COLUMN}, and the registry has "
        f"no such column — its own id IS the tenant id: {qual}"
    )

    granted, withheld = _expected_grants(REGISTRY_TABLE)
    for verb in granted:
        assert privileges[verb] is True, f"{app_role} has no {verb} on {REGISTRY_TABLE}"
    for verb in withheld:
        assert privileges[verb] is False, (
            f"{app_role} holds {verb} on {REGISTRY_TABLE}, which 0002 never grants"
        )


def test_audit_log_is_granted_insert_but_never_update(
    migrated_database: str, seam_engine: Callable[[str], Engine], app_role: str
) -> None:
    """🔴 THE ONE GRANT THAT DIFFERS, PINNED SO IT CANNOT BE TIDIED BACK.

    `0001`'s `audit_log_append_only` trigger refuses UPDATE and DELETE whatever
    the ACL says, so `GRANT UPDATE ON audit_log` would change no behaviour and
    would MISSTATE THE INTENT — an ACL reading `arwU` on the one table this
    system promises never to edit in place. `DELETE` was already correctly not
    granted; this makes the two append-only verbs consistent.

    WHAT IT COSTS, ASSERTED RATHER THAN ONLY WRITTEN DOWN: the trigger's UPDATE
    branch is now unreachable for `titlepipe_app`, exactly as its DELETE branch
    already was, because the privilege check runs first. So this test reads
    `42501` from that role — and the second half then shows the trigger is not
    thereby decoration, by reaching the table as the superuser (who bypasses the
    ACL and RLS alike) and getting `0A000` from the trigger itself.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            privileges = _table_privileges(connection, app_role, "audit_log")
    finally:
        engine.dispose()

    assert privileges["SELECT"] is True
    assert privileges["INSERT"] is True
    assert privileges["UPDATE"] is False, (
        "audit_log is granted UPDATE. 0001's trigger refuses it regardless, so the "
        "grant only misstates the intent of an append-only table."
    )
    assert privileges["DELETE"] is False


def test_the_append_only_trigger_still_answers_for_the_paths_the_acl_does_not(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The other half of the test above: withholding UPDATE did not retire the trigger.

    `migrated_database` yields the SUPERUSER dsn, which bypasses both the ACL and
    row-level security — so this reaches `audit_log` by a path the missing grant
    does not close, and the refusal that comes back is the trigger's own
    `0A000`, not a privilege error.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            with pytest.raises(DBAPIError) as raised:
                connection.execute(text("UPDATE audit_log SET tenant_id = tenant_id"))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == APPEND_ONLY_SQLSTATE, (
        f"expected the append-only trigger's {APPEND_ONLY_SQLSTATE}, got "
        f"{_sqlstate(raised.value)}: {raised.value}"
    )


def test_there_are_no_sequences_for_a_sequence_grant_to_reach(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """Why `0002` omits `GRANT USAGE, SELECT ON ALL SEQUENCES`.

    Every primary key in this schema defaults to `gen_random_uuid()` and nothing
    is `serial` or `IDENTITY`, so the statement would grant nothing to nobody
    while reading like a covered case. MEASURED 2026-08-05: zero relations of
    kind `S` in `public`.

    This is the test that notices the day that stops being true. A revision that
    adds a `serial` column creates a sequence, and `titlepipe_app` then gets
    `permission denied for sequence …` on its first INSERT — a failure that
    points at the sequence and not at the missing grant.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            sequences = connection.execute(
                text(
                    "SELECT c.relname FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = 'public' AND c.relkind = 'S'"
                )
            ).all()
    finally:
        engine.dispose()

    assert [str(row[0]) for row in sequences] == [], (
        "this schema now has sequences, so 0002's omitted sequence grant is no "
        "longer a no-op and titlepipe_app cannot INSERT into whatever uses them"
    )


def test_an_unestablished_session_is_denied_rather_than_erroring(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
    tenant_deny_sentinel: str,
) -> None:
    """🔴 THE BEHAVIOURAL HALF OF THE `nullif` ASSERTION.

    `conftest.py::SEAM_CONNECT_ARGS` pins `app.current_tenant` to the empty
    string on every connection this suite opens, so a session that has
    established no tenant carries `''` rather than nothing at all. That is the
    value `''::uuid` chokes on.

    ALL SEVEN TABLES ARE READ, AND ONLY `orders` IS SEEDED — which is enough,
    for a reason worth recording rather than guessing at. MEASURED 2026-08-05
    against postgres:18.4: a policy written WITHOUT the `nullif`, queried with
    the GUC at `''`, raises `invalid input syntax for type uuid: ""` **against an
    empty table as readily as against a populated one** — the cast is on a stable
    expression and is evaluated whether or not any row reaches the qual. So the
    six unseeded tables genuinely exercise the raise-versus-deny property, and
    `orders` additionally makes one table's zero a filtering decision rather than
    a description of an empty table.

    WHAT THIS IS NOT: the isolation proof. It does not set a tenant, does not
    compare what two tenants see, and does not test writes. Those belong to
    Task 6. What it holds is one property the `nullif` is there for — no tenant
    established means a clean DENIAL, not a 500 — and it is the assertion that
    goes red if the `nullif` is removed from ANY of the seven while the catalog
    assertion is hand-patched.
    """
    _seed_two_tenants(seam_engine(migrated_database))

    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            established = connection.execute(
                text("SELECT current_setting('app.current_tenant', true)")
            ).scalar_one()
            visible = {
                # S608 wants the statement checked for untrusted input. A table
                # name cannot be a bind parameter in any dialect, and every value
                # `table` takes here is a literal in `EXPECTED_TENANT_TABLES` or
                # `REGISTRY_TABLE` at the top of this file. Nothing reaches it
                # from the database, the environment or a fixture.
                table: connection.execute(
                    text(f"SELECT count(*) FROM {table}")  # noqa: S608
                ).scalar_one()
                for table in sorted({*EXPECTED_TENANT_TABLES, REGISTRY_TABLE})
            }
    finally:
        engine.dispose()

    assert established == tenant_deny_sentinel, (
        f"this connection did not start at the deny sentinel but at "
        f"{established!r}, so the assertion below is about a different state"
    )
    for table, rows in sorted(visible.items()):
        assert rows == 0, f"an unestablished session saw {rows} rows in {table}"


def test_a_migration_shaped_write_is_a_silent_no_op_until_it_says_so(
    migrated_database: str, migration_dsn: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 WHAT `0002` DOES TO EVERY DATA MIGRATION WRITTEN AFTER IT.

    `FORCE ROW LEVEL SECURITY` removes the OWNER's exemption, and the owner is
    who `migrations/env.py` becomes. So the connection every future data
    migration runs on can no longer see the rows it is there to change:
    `UPDATE … ` returns `UPDATE 0`, with no error and no warning, and the
    migration reports success.

    BOTH HALVES ARE ASSERTED, because the remedy is the half that is easy to
    drop. `SET LOCAL row_security = off` does not permit the write — it REFUSES
    it, with `42501` and a HINT naming `ALTER TABLE NO FORCE ROW LEVEL SECURITY`.
    That is what turns a silent no-op into a loud failure, and it is why `0002`'s
    docstring tells a data migration to issue it BEFORE the `NO FORCE` rather
    than instead of it.

    The message is asserted alongside the SQLSTATE. `42501` is also what "you may
    not touch this table at all" returns — which is what a `SET ROLE` that failed
    would produce here — and the two must not be confused.

    This connects as `titlepipe_migration` and `SET ROLE titlepipe_owner`, which
    is exactly what `env.py` does. Connecting as `titlepipe_owner` is impossible
    and must stay so: `roles.sql` makes it NOLOGIN precisely so that ownership
    sits on a role nothing can authenticate as.
    """
    _seed_two_tenants(seam_engine(migrated_database))

    engine = seam_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
            owner = connection.execute(text("SELECT current_user")).scalar_one()
            silent = connection.execute(text("UPDATE orders SET tenant_id = tenant_id"))
            affected = silent.rowcount
            visible = connection.execute(text("SELECT count(*) FROM orders")).scalar_one()
            tenants_seen = connection.execute(
                text("SELECT count(DISTINCT tenant_id) FROM orders")
            ).scalar_one()
            connection.rollback()

        # 🔴 THE FIRST HALF IS ASSERTED BEFORE THE SECOND HALF RUNS, and the
        # order is a diagnostic decision rather than a stylistic one. Collecting
        # both and asserting afterwards puts `pytest.raises` first in execution
        # order, so dropping `FORCE` from `orders` reported `Failed: DID NOT
        # RAISE DBAPIError` — measured — and said nothing about the rows the
        # owner had just been shown. Asserting here makes the same injection
        # report the row count, which is the fact that matters.
        assert owner == OWNER_ROLE, (
            f"SET ROLE did not take: this ran as {owner}, so the UPDATE says "
            f"nothing about what a migration sees"
        )
        assert affected == 0, (
            f"the owner's UPDATE touched {affected} rows across {tenants_seen} "
            f"tenants. Under FORCE it must touch none — and because it touches "
            f"none, every data migration after 0002 is a silent no-op unless it "
            f"says otherwise."
        )
        assert visible == 0, (
            f"the owner saw {visible} rows across {tenants_seen} tenants through "
            f"FORCE, which means FORCE is not on this table"
        )

        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
            connection.execute(text("SET LOCAL row_security = off"))
            with pytest.raises(DBAPIError) as raised:
                connection.execute(text("UPDATE orders SET tenant_id = tenant_id"))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"expected {INSUFFICIENT_PRIVILEGE_SQLSTATE} from row_security = off, got "
        f"{_sqlstate(raised.value)}: {raised.value}"
    )
    assert "row-level security policy" in str(raised.value), (
        f"42501 came back for some other reason than RLS — a failed SET ROLE "
        f"returns the same code: {raised.value}"
    )


def test_downgrading_only_0002_removes_every_policy_grant_and_force(
    migrated_database: str,
    alembic_config: Callable[[str], Config],
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
    app_role: str,
) -> None:
    """🔴 `0002`'s DOWNGRADE, TESTED ON ITS OWN AND NOT THROUGH `downgrade base`.

    `0001`'s `DROP TABLE` removes a table's policies and its ACL as a side
    effect, so a `downgrade base` is green whatever `0002.downgrade()` does — it
    would mask a missing `DROP POLICY`, a missing `REVOKE`, and a `DISABLE` that
    left `relforcerowsecurity` behind. Stopping at `0001` is the only way to see
    them.

    `NO FORCE` **and** `DISABLE` are both asserted, because they are independent
    `pg_class` columns: MEASURED 2026-08-05, `ALTER TABLE pages DISABLE ROW LEVEL
    SECURITY` left `(relrowsecurity, relforcerowsecurity) = (f, t)`.

    WHAT IS DELIBERATELY NOT ASSERTED, so silence is not read as a guarantee:

    * `relacl` does not come back to `NULL`. Once PostgreSQL materialises an ACL
      it keeps the row, so after this downgrade every table reads
      `{titlepipe_owner=arwdDxtm/titlepipe_owner}` — the owner's own default
      privileges, spelled out. MEASURED. The EFFECTIVE privileges are identical
      to a `NULL` acl, which is what the `has_table_privilege` assertions below
      check;
    * the schema-level `USAGE` grant is not reversed at all. `0002.downgrade`'s
      docstring holds the two measured reasons.

    Back to head in a `finally`, for the rest of this module and for
    `migrated_database`'s own teardown, which downgrades from wherever this left
    things.
    """
    config = alembic_config(migration_dsn)
    command.downgrade(config, "0001")
    try:
        engine = seam_engine(migrated_database)
        try:
            with engine.connect() as connection:
                security = _row_security(connection)
                policies = _policies(connection)
                privileges = {
                    table: _table_privileges(connection, app_role, table)
                    for table in [*EXPECTED_TENANT_TABLES, REGISTRY_TABLE]
                }
        finally:
            engine.dispose()

        assert policies == {}, f"0002's downgrade left policies behind: {sorted(policies)}"

        for table in sorted({*EXPECTED_TENANT_TABLES, REGISTRY_TABLE}):
            assert security[table] == (False, False), (
                f"{table} is still {security[table]} after downgrading 0002. DISABLE "
                f"does not clear relforcerowsecurity; both statements are needed."
            )
            for verb in [*GRANTED_VERBS, *REFUSED_VERBS]:
                assert privileges[table][verb] is False, (
                    f"{app_role} still holds {verb} on {table} after 0002's downgrade"
                )
    finally:
        command.upgrade(config, "head")


def _schema_usage_grantees(connection: Connection) -> set[str]:
    """Every grantee holding `USAGE` on schema `public`, with `PUBLIC` spelled out.

    `aclexplode` on `pg_namespace.nspacl` rather than `has_schema_privilege`,
    because the two answer different questions and only this one can be restored
    from. `has_schema_privilege('titlepipe_owner', 'public', 'USAGE')` is TRUE on
    a stock cluster whether or not anything ever granted the owner USAGE, because
    `PUBLIC` holds it — so it cannot tell an EXPLICIT ACL entry from one inherited
    through `PUBLIC`, and a teardown that reads it back cannot know what to put
    back. MEASURED 2026-08-06 on this container after `roles.sql`:

        nspacl -> {pg_database_owner=UC/pg_database_owner,
                   =U/pg_database_owner,
                   titlepipe_owner=UC/pg_database_owner}

    The middle entry, with an empty grantee, is `PUBLIC`; the third is the
    explicit grant `roles.sql` makes to the owner.

    `grantee = 0` is `PUBLIC` in `aclexplode`'s output and renders as `-` through
    `regrole`, so it is translated by name here rather than left as a hyphen that
    a `GRANT ... TO -` would then fail on.

    `coalesce(nspacl, acldefault('n', nspowner))` because `nspacl` is NULL on a
    schema nobody has ever granted anything on, and `aclexplode(NULL)` returns no
    rows — which would read as "nobody holds USAGE" rather than "the defaults
    apply".
    """
    result = connection.execute(
        text(
            "SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END "
            "FROM pg_namespace n, "
            "     aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) AS a "
            "WHERE n.nspname = 'public' AND a.privilege_type = 'USAGE'"
        )
    )
    return {str(row[0]) for row in result}


def test_the_migration_refuses_when_the_schema_grant_did_not_land(
    migrated_database: str,
    alembic_config: Callable[[str], Config],
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
    owner_role: str,
    managed_roles: tuple[str, ...],
) -> None:
    """🔴 A `GRANT` THAT DOES NOTHING IS A WARNING, SO `0002` READS THE RESULT BACK.

    `titlepipe_owner` is not the owner of schema `public` — that is
    `pg_database_owner` from PostgreSQL 15 on — and holds no grant option on it,
    so `GRANT USAGE ON SCHEMA public TO titlepipe_app` issued from a migration
    produces `WARNING: no privileges were granted for "public"` and exit 0.
    MEASURED 2026-08-05. That is the identical failure mode `roles.sql` documents
    for its own `GRANT CREATE`, and it is answered the same way.

    THE STATE THIS TEST BUILDS IS THE REALISTIC HARDENED ONE, not a contrivance:
    no USAGE on `public` for the application roles, with USAGE held by the two
    roles that run migrations. The DDL then all works, the grant to
    `titlepipe_app` silently does nothing, and MEASURED in that state
    `titlepipe_app` holds SELECT on `orders` and is told
    `relation "orders" does not exist`. A migration exiting 0 onto a completely
    unusable application role.

    ---------------------------------------------------------------------------
    🔴 IT BUILT THAT STATE BY REVOKING FROM `PUBLIC` **ONLY**, AND THAT ENCODED A
       DEFECT INTO A TEST — WHICH IS WHY THE HARDENING IS NOW EXHAUSTIVE.
    ---------------------------------------------------------------------------
    `titlepipe_app` and `titlepipe_worker` reach USAGE on `public` through
    `PUBLIC` today, so revoking `PUBLIC`'s entry alone was enough to strip them.
    But that made the test's hardened state depend on `roles.sql` NOT granting
    them USAGE explicitly — and the moment it does, the revoke leaves their own
    ACL entries standing, `_require_schema_usage` finds nothing missing and this
    test fails with `Failed: DID NOT RAISE RuntimeError`. A test that fails when
    the cluster gets SAFER is a test blocking a fix. It blocked exactly one: the
    cleanup pass could not extend `roles.sql`'s
    `GRANT USAGE ON SCHEMA public TO titlepipe_owner` to the app and worker roles.

    The revoke now names `PUBLIC` **and every role `roles.sql` creates**, so the
    state is hardened whatever `roles.sql` granted, and the guard fires because
    the roles genuinely lack the privilege rather than because one particular
    grant happened to be absent.

    ---------------------------------------------------------------------------
    🔴 RESTORATION PUTS BACK EXACTLY WHAT WAS THERE, WHICH THE OLD `finally` DID
       NOT.
    ---------------------------------------------------------------------------
    It ran `GRANT USAGE … TO PUBLIC` and `REVOKE USAGE … FROM titlepipe_owner,
    titlepipe_migration` — and the owner's entry is not this test's to revoke:
    `roles.sql` creates it (`GRANT USAGE ON SCHEMA public TO titlepipe_owner`,
    with its own read-back). The teardown destroyed it on every run. Nothing
    noticed because `PUBLIC`'s USAGE, restored on the line above, masks its
    absence from `has_schema_privilege` — which is the same blind spot that made
    the assertion below unable to see it.

    The grantee list is therefore SNAPSHOTTED from `pg_namespace.nspacl` before
    anything is touched and restored to exactly that set, and the snapshot is
    asserted equal afterwards. Leaving `public` hardened would take out every test
    after this one in a way whose message ("relation … does not exist") names
    nothing to do with schema privileges; leaving it subtly different is worse,
    because nothing at all would say so.
    """
    hardened_roles = ", ".join(["PUBLIC", *sorted({owner_role, *managed_roles})])

    config = alembic_config(migration_dsn)
    admin = seam_engine(migrated_database)
    command.downgrade(config, "0001")

    with admin.connect() as connection:
        before = _schema_usage_grantees(connection)

    try:
        with admin.begin() as connection:
            connection.execute(text(f"REVOKE USAGE ON SCHEMA public FROM {hardened_roles}"))
            connection.execute(
                text(f"GRANT USAGE ON SCHEMA public TO {OWNER_ROLE}, {MIGRATION_ROLE}")
            )

        with pytest.raises(RuntimeError) as raised:
            command.upgrade(config, "head")
    finally:
        with admin.begin() as connection:
            # Back to a clean slate first, then exactly the snapshot. Granting the
            # snapshot on top of the hardened state would leave the two roles this
            # test granted USAGE to holding it afterwards.
            connection.execute(text(f"REVOKE USAGE ON SCHEMA public FROM {hardened_roles}"))
            connection.execute(text(f"GRANT USAGE ON SCHEMA public TO {', '.join(sorted(before))}"))
        command.upgrade(config, "head")

    try:
        with admin.connect() as connection:
            after = _schema_usage_grantees(connection)
            restored = connection.execute(
                text(
                    "SELECT role, has_schema_privilege(role, 'public', 'USAGE') "
                    "FROM unnest(CAST(:roles AS text[])) AS role"
                ),
                {"roles": [OWNER_ROLE, APP_ROLE, WORKER_ROLE, MIGRATION_ROLE]},
            ).all()
    finally:
        admin.dispose()

    message = str(raised.value)
    assert APP_ROLE in message, (
        f"the refusal must name the roles that ended up without USAGE: {message}"
    )
    assert WORKER_ROLE in message, (
        f"the refusal must name the roles that ended up without USAGE: {message}"
    )
    assert OWNER_ROLE not in message, (
        f"the owner was granted USAGE explicitly in this test, so naming it means "
        f"the check is reporting the roles it asked about rather than the roles "
        f"that failed: {message}"
    )
    assert "roles.sql" in message, f"the refusal must say where to fix it: {message}"

    assert all(bool(row[1]) for row in restored), (
        f"schema public was left hardened; every later test will fail with "
        f"`relation … does not exist`: {[(str(row[0]), bool(row[1])) for row in restored]}"
    )
    assert after == before, (
        f"the teardown did not restore the ACL on schema public. It held USAGE for "
        f"{sorted(before)} before this test and {sorted(after)} after. "
        f"has_schema_privilege cannot see this — PUBLIC's USAGE masks every missing "
        f"explicit entry — which is how the old teardown destroyed roles.sql's grant "
        f"to {OWNER_ROLE} on every run without anything failing."
    )

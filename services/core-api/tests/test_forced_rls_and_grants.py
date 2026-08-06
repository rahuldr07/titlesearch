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

## 🔴 AND THEN THREE MORE, FOUND 2026-08-06 AND MEASURED AT `195 passed` EACH

The two above were about the policy this file looks AT. These three are about
everything it does not look at — the policy SET, the ACL's grantee, and the
policy's role list:

* **nothing bounded the policy set.** `_assert_tenant_isolation_policy` asked
  whether `tenant_isolation` was PRESENT, never whether it was ALONE. Permissive
  policies OR together, so a second one is a second way in. MEASURED, one line
  added to `0002::_isolate` with the matching `DROP POLICY` in `_release`:

      CREATE POLICY tenant_maintenance ON <table> FOR UPDATE
        USING (true) WITH CHECK (true)

  `195 passed`, against a database in which any established tenant can re-tenant
  every other tenant's rows to itself and then read them. `_permissive_policies`
  and the exact-set assertion in `_assert_tenant_isolation_policy` close it;
* **`pg_policies.with_check` was never read.** `_policies` selected `qual` and
  stopped. `0002` writes NO `WITH CHECK`, and PostgreSQL then reuses `USING` for
  it — so `with_check` MUST come back NULL, and a policy supplying its own is a
  policy whose write side is not the read side. It is now selected uncoalesced
  (`qual` is still `coalesce`d; `with_check` must not be, because NULL is the
  answer being asserted) and required to be NULL;
* **`pg_policies.roles` was never read.** MEASURED, `CREATE POLICY
  tenant_isolation … FOR ALL TO titlepipe_app USING (…)`: `195 passed`. It is
  bounded today only because `titlepipe_app` is the one role holding a grant,
  and it goes live the moment `titlepipe_worker` or `titlepipe_blind` gets one —
  those roles would then be denied every row with no error naming a policy. The
  list is now required to be `PUBLIC`.

The behavioural half of the first of those is
`tests/test_tenant_isolation.py::test_2…`, which now issues a cross-tenant
`UPDATE` as `titlepipe_app`. Before that arm existed, **no test in this
repository ever issued an `UPDATE` as `titlepipe_app` at all** — every `UPDATE`
in the suite ran as the container superuser or as `titlepipe_migration` with
`SET ROLE titlepipe_owner`, so the verb the ACL assertions above check was never
once executed by the role they check it for.
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

# ---------------------------------------------------------------------------
# 🔴 THE EXEMPTION, NAMED. THE RULING BEHIND IT IS STATED ONCE, IN
#    `migrations/versions/0003_rules.py` — the frozen record of the decision.
# ---------------------------------------------------------------------------
# In one line so this constant is readable on its own: `rules` is GLOBAL, so it
# has no `tenant_id`, no `tenant_isolation` policy and no row-level security, and
# all three are the ruling rather than an omission. Read `0003`'s module docstring
# for why, and do not restate it here — `01-WHAT-HAPPENED.md` §3.5 records what
# four copies of one reason cost when two of them drifted.
#
# WHY A LITERAL SET IS NEEDED WHEN THE DERIVATION ABOVE IS DELIBERATELY NOT ONE.
# `_tenant_tables` asks the catalog which tables carry `tenant_id`, and that is
# right: a new TENANT table has to opt out of these assertions by not having the
# column, rather than opt in by being remembered. But the same predicate makes a
# table WITHOUT the column disappear from this file entirely — silently, with no
# assertion anywhere about its grants, its RLS state or its readability. Left at
# that, `rules` would have shipped completely unasserted here, and so would every
# global table after it.
#
# So this set is compared against the catalog's answer to "tables in `public`,
# `relkind = 'r'`, excluding `alembic_version`, that carry no `tenant_id` and are
# not the registry". A second global table then cannot appear without a
# deliberate edit to this line, which is what "named as an exception" has to mean
# operationally.
#
# `tenants` is excluded from that derivation by name and not by predicate,
# because it genuinely has no `tenant_id` either — its own `id` IS a tenant id,
# it carries a `tenant_isolation` policy keyed on that column, and
# `test_the_registry_is_forced_and_isolated_on_its_own_id` is where it is
# asserted. Folding it in here would make this set mean "not a tenant table",
# which is a different and much weaker claim than "outside tenancy altogether".
EXPECTED_GLOBAL_TABLES = frozenset({"rules"})

RULES_TABLE = "rules"

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

# The label both `aclexplode` readers below translate `grantee = 0` to. It is a
# pseudo-role rather than a role: `grantee::regrole` renders 0 as `-`, which is
# not a name anybody can grep for or grant to. Spelled once here and matched
# against in Python; the two SQL strings write the same word as a literal
# because it is the CASE branch's own output rather than a value being compared.
PUBLIC_GRANTEE = "PUBLIC"

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

# 🔴 `rules` IS THE ONE TABLE AT A SINGLE VERB, AND THE NARROWNESS IS A PLAN 02
# RULING RATHER THAN A GAP. Task 4 is `GET /api/rules` — read-only. Rule CREATION
# and the engineer-confirm write arrive in Plan 05 and will add their own grants
# beside their own refusal tests, because "who may write a rule" is a domain
# question with an answer (CLAUDE.md: escalation resolution is refused without a
# rule; judgments never auto-confirm in v1) and not a privilege to hand out ahead
# of the code that enforces it.
#
# `INSERT` and `UPDATE` are therefore in the WITHHELD list here, alongside
# `DELETE` and `TRUNCATE`, and `_expected_grants` derives that list rather than
# repeating it — so the day Plan 05 grants one of them, this file goes red and
# says which.
RULES_GRANTED_VERBS = ("SELECT",)


def _expected_grants(table: str) -> tuple[Sequence[str], Sequence[str]]:
    """`(granted, withheld)` for one table — every verb this file knows about.

    🔴 THE WITHHELD LIST IS DERIVED FROM THE GRANTED ONE rather than written out.

    (This ended "and that is what closes F6." Nothing in this repository defines
    an `F6` — the review that numbered it was never committed — so the tag was a
    citation of a document a reader cannot open. The finding itself is the
    paragraph below, which is what it was standing in for.)

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

    THE TWO SPECIAL CASES ARE WRITTEN OUT AS BRANCHES rather than looked up in a
    mapping, for the reason `0002` gives for its own eight `GRANT` lines: each one
    gets a reviewable line naming the table it is about, and the constants above
    hold the ruling behind each. `audit_log` is at two verbs because `0001`'s
    trigger refuses UPDATE whatever the ACL says; `rules` is at one because this
    plan ships a read.
    """
    if table == APPEND_ONLY_TABLE:
        granted: Sequence[str] = APPEND_ONLY_GRANTED_VERBS
    elif table == RULES_TABLE:
        granted = RULES_GRANTED_VERBS
    else:
        granted = GRANTED_VERBS
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


# `pg_policies.roles` for a policy written with no `TO` clause. It is a `name[]`,
# and the view renders the PUBLIC case — `pg_policy.polroles = '{0}'` — as the
# single element `public` rather than as the oid. MEASURED 2026-08-06 against
# postgres:18.4, all seven policies after `upgrade head`:
#
#     ('orders', 'tenant_isolation', 'ALL', 'PERMISSIVE', ['public'],
#      qual IS NULL -> False, with_check IS NULL -> True, with_check -> None,
#      pg_typeof(roles) -> name[])
#
# so the value asserted below is the string, not the oid. Reading `pg_policy`
# directly would give `{0}`; `pg_policies` is what every other assertion in this
# file already reads and it is the spelling a reader can reproduce with `\dp`.
POLICY_ROLES_PUBLIC = ("public",)


class PolicyFacts(NamedTuple):
    """The five things a `tenant_isolation` policy has to be.

    `qual` is `pg_policies`' rendering of the `USING` expression, which is the
    only place the `nullif` can be read back from — `pg_policy.polqual` is a
    `pg_node_tree` and is not text anybody can assert on.

    `with_check` is `str | None` AND THE `None` IS THE POINT. `0002` writes no
    `WITH CHECK`, so PostgreSQL reuses `USING` for the write side; the view
    reports that reuse as NULL. Coalescing it to `''` the way `qual` is coalesced
    would erase the one value being asserted, which is why the two columns are
    read differently.

    `roles` is `pg_policies.roles`, and it is `('public',)` for a policy with no
    `TO` clause — see `POLICY_ROLES_PUBLIC`.
    """

    command_name: str
    permissive: str
    qual: str
    with_check: str | None
    roles: tuple[str, ...]


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


def _global_tables(connection: Connection, version_table: str) -> set[str]:
    """Tables in `public` that are outside tenancy altogether. THE COMPLEMENT ABOVE.

    The same shape as `_tenant_tables` with the `EXISTS` negated, plus `tenants`
    removed by name — see `EXPECTED_GLOBAL_TABLES` for why the registry is not a
    global table despite having no `tenant_id`.

    `alembic_version` is excluded by name for `_tenant_tables`' reason, and here
    the exclusion is doing MORE work rather than less: that table genuinely has no
    `tenant_id`, so without the name it would land in this set and every assertion
    below would be run against Alembic's own bookkeeping.

    Written as its own query rather than as `_tables(...) - _tenant_tables(...)`
    in Python, so that the predicate a reader has to trust is one SQL expression
    with `attnum > 0 AND NOT attisdropped` in it — the same clause, and therefore
    the same answer about a dropped column, as the derivation it complements.
    """
    result = connection.execute(
        text(
            "SELECT c.relname FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r' "
            "  AND c.relname NOT IN (:version_table, :registry_table) "
            "  AND NOT EXISTS (SELECT 1 FROM pg_attribute a "
            "                  WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' "
            "                    AND a.attnum > 0 AND NOT a.attisdropped)"
        ),
        {"version_table": version_table, "registry_table": REGISTRY_TABLE},
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

    EVERY POLICY IN `public` IS RETURNED, not only the ones called
    `tenant_isolation`. That is what makes `_permissive_policies` able to ask
    whether the expected policy is the ONLY one — the question this query could
    not answer while its callers only ever indexed it by name.

    `with_check` IS NOT COALESCED and `qual` still is. NULL is the value being
    asserted for the first and a meaningless one for the second; see
    `PolicyFacts`.
    """
    result = connection.execute(
        text(
            "SELECT tablename, policyname, cmd, permissive, coalesce(qual, ''), "
            "       with_check, roles "
            "FROM pg_policies WHERE schemaname = 'public'"
        )
    )
    return {
        (str(row[0]), str(row[1])): PolicyFacts(
            str(row[2]),
            str(row[3]),
            str(row[4]),
            None if row[5] is None else str(row[5]),
            tuple(str(role) for role in row[6]),
        )
        for row in result
    }


def _permissive_policies(policies: Mapping[tuple[str, str], PolicyFacts], table: str) -> set[str]:
    """The names of every PERMISSIVE policy on `table`.

    PERMISSIVE only, and the narrowing is the whole reason this helper exists
    rather than a bare set comprehension over the names. **Permissive policies OR
    together**: a second one is a second, independent way to reach a row, and the
    fact that a correct `tenant_isolation` sits beside it changes nothing. A
    RESTRICTIVE policy ANDs instead, so it can only take rows away — an extra one
    of those is an outage rather than a leak, and it is caught by the positive
    control in `tests/test_tenant_isolation.py` rather than here.
    """
    return {
        name
        for (owner, name), facts in policies.items()
        if owner == table and facts.permissive == "PERMISSIVE"
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


def _table_grantees(connection: Connection) -> dict[tuple[str, str], set[str]]:
    """(table, verb) -> every grantee holding it, with `PUBLIC` spelled out.

    ---------------------------------------------------------------------------
    🔴 `aclexplode` AND NOT `has_table_privilege`, FOR THE REASON
       `_schema_usage_grantees` ALREADY RECORDS ONE LEVEL UP: THE TWO ANSWER
       DIFFERENT QUESTIONS, AND ONLY THIS ONE CAN SEE WHO WAS NAMED.
    ---------------------------------------------------------------------------
    `_table_privileges` above is deliberately the EFFECTIVE question — "will the
    server let this role do this" — and that is the right question for the
    assertions it feeds. But it is answered TRUE by a privilege reaching the role
    through `PUBLIC` or through a membership, and nothing in this file asked who
    the ACL actually names. MEASURED 2026-08-06, `0002`'s eight `GRANT … TO
    titlepipe_app` respelled `TO PUBLIC`: **`195 passed`**. Under that migration
    `titlepipe_worker` — which `0002` grants nothing, and which can set
    `app.current_tenant` itself because a custom GUC carries no ACL — reads and
    writes any tenant it names.

    MEASURED on the same container after a correct `upgrade head`, `orders`:

        SELECT   -> {titlepipe_owner, titlepipe_app}
        INSERT   -> {titlepipe_owner, titlepipe_app}
        UPDATE   -> {titlepipe_owner, titlepipe_app}
        DELETE   -> {titlepipe_owner}
        TRUNCATE -> {titlepipe_owner}

    and `audit_log` identically but for `UPDATE -> {titlepipe_owner}`, which is
    the one grant that differs. `titlepipe_owner` is in every set because it is
    the table's OWNER and PostgreSQL materialises the owner's own default
    privileges into `relacl` the moment anything is granted — it is not a grant
    `0002` makes, and `test_downgrading_only_0002_removes_every_policy_grant_and
    _force` records the same fact from the other side.

    `grantee = 0` is `PUBLIC` and renders as `-` through `regrole`, so it is
    translated by name — the same translation `_schema_usage_grantees` makes, and
    for the same reason: a hyphen is not a thing anybody can grep for.

    `coalesce(relacl, acldefault('r', relowner))` because `relacl` is NULL on a
    table nobody has ever granted anything on, and `aclexplode(NULL)` returns no
    rows — which would read as "nobody holds anything" rather than "the owner
    holds everything".
    """
    result = connection.execute(
        text(
            "SELECT c.relname, a.privilege_type, "
            "       CASE WHEN a.grantee = 0 THEN 'PUBLIC' "
            "            ELSE a.grantee::regrole::text END "
            "FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace, "
            "     aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) AS a "
            "WHERE n.nspname = 'public' AND c.relkind = 'r'"
        )
    )
    grantees: dict[tuple[str, str], set[str]] = {}
    for row in result:
        grantees.setdefault((str(row[0]), str(row[1])), set()).add(str(row[2]))
    return grantees


def _expected_grantees(table: str) -> dict[str, set[str]]:
    """verb -> exactly who `0002` plus table ownership leaves holding it.

    DERIVED FROM `_expected_grants` rather than written out a second time, which
    is the same rule that constant already applies to the withheld verbs: a
    second literal is a second thing to keep in step, and the one that drifts is
    the one nothing is pointed at. `audit_log` therefore drops out of `UPDATE`
    here because it drops out of `granted` there, with no branch on the name.

    The owner is in every set unconditionally — see `_table_grantees` for the
    measurement and for why that is ownership rather than a grant.
    """
    granted, withheld = _expected_grants(table)
    return {
        **{verb: {OWNER_ROLE, APP_ROLE} for verb in granted},
        **{verb: {OWNER_ROLE} for verb in withheld},
    }


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
    """The whole `tenant_isolation` contract for one table, and the whole POLICY SET.

    `ALL` and `PERMISSIVE` are asserted here rather than only on the six, which is
    the second thing the registry's own test was missing: a `tenant_isolation`
    policy declared `FOR SELECT` leaves INSERT, UPDATE and DELETE entirely
    unpoliced, and reads exactly like isolation to anything that only reads.

    ---------------------------------------------------------------------------
    🔴 THE FIRST ASSERTION USED TO BE MEMBERSHIP AND IS NOW THE EXACT SET, AND
       THAT IS THE DIFFERENCE BETWEEN ASKING WHETHER THE RIGHT POLICY IS PRESENT
       AND ASKING WHETHER IT IS THE ONLY ONE.
    ---------------------------------------------------------------------------
    It read `(table, POLICY_NAME) in policies`, which is true of a table carrying
    a correct `tenant_isolation` AND anything else somebody added. Permissive
    policies OR together. MEASURED 2026-08-06, `0002::_isolate` given one extra
    line (with the matching `DROP POLICY` in `_release`, so the downgrade test
    stayed green too):

        CREATE POLICY tenant_maintenance ON <table> FOR UPDATE
          USING (true) WITH CHECK (true)

    **`195 passed`.** Every assertion in this file was about `tenant_isolation`,
    which was still perfect, and the second policy handed every established
    tenant an unconditional UPDATE over every other tenant's rows.

    `with_check` AND `roles` ARE ASSERTED FOR THE SAME KIND OF REASON — they were
    columns nothing read:

    * **`with_check` must be NULL.** `0002` writes no `WITH CHECK` and relies on
      PostgreSQL reusing the `USING` expression for the write side; that reuse is
      exactly what refuses a cross-tenant INSERT, and `0002`'s own docstring
      records the measurement. A policy that supplies its own `WITH CHECK` has a
      write side that is no longer the read side, and `WITH CHECK (true)` is the
      spelling that lets every cross-tenant write straight through while every
      read assertion in this file stays green;
    * **`roles` must be `PUBLIC`.** MEASURED 2026-08-06, the policy respelled
      `FOR ALL TO titlepipe_app`: `195 passed`. It is harmless TODAY only because
      `titlepipe_app` is the one role `0002` grants anything to. The day
      `titlepipe_worker` or `titlepipe_blind` gets a grant, a policy scoped to
      one role denies them every row — and the error names no policy, because
      there is nothing to name: they simply match none.
    """
    present = _permissive_policies(policies, table)
    assert present == {POLICY_NAME}, (
        f"the PERMISSIVE policies on {table} are {sorted(present)}, not just "
        f"[{POLICY_NAME!r}]. Permissive policies OR together, so every extra one "
        f"is an independent way to reach a row and a correct {POLICY_NAME} beside "
        f"it changes nothing. An empty set means RLS is on with no policy, which "
        f"denies every row to every non-bypassing role."
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
    assert facts.with_check is None, (
        f"{table}'s {POLICY_NAME} supplies its own WITH CHECK "
        f"({facts.with_check!r}) instead of leaving PostgreSQL to reuse USING. "
        f"The write side is then not the read side, and WITH CHECK (true) lets "
        f"every cross-tenant INSERT and UPDATE through while every read assertion "
        f"in this file stays green."
    )
    assert facts.roles == POLICY_ROLES_PUBLIC, (
        f"{table}'s {POLICY_NAME} applies TO {list(facts.roles)} rather than to "
        f"{list(POLICY_ROLES_PUBLIC)}. A policy scoped to one role denies every "
        f"row to every other role that holds a grant, and the refusal names no "
        f"policy because the row matches none."
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


def _seed_two_tenants(engine: Engine) -> dict[UUID, UUID]:
    """Two committed `orders` rows, one per tenant, as the superuser. Returns id -> tenant.

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

    ---------------------------------------------------------------------------
    🔴 IT RETURNS WHAT IT WROTE, AND IT DID NOT UNTIL 2026-08-06. THE CALLER THAT
       NEEDED IT WAS ASSERTING A DENIAL AGAINST A TABLE IT COULD NOT PROVE WAS
       POPULATED.
    ---------------------------------------------------------------------------
    `test_the_rulebook_is_readable_with_no_tenant_established` uses these rows as
    the CONTRAST half of a positive control — one connection, one state, `rules`
    returning everything and `orders` returning nothing. With this function
    returning `None` there was nothing for that test to check the seed against,
    so its `orders` assertion was a bare `count(*) == 0`. MEASURED 2026-08-06,
    this call replaced by a bare `DELETE FROM orders`: that test reported
    **`1 passed`**. A contrast satisfied by an empty table is
    `00-HOW-TO-EXECUTE.md` §1.1's exact failure — the assertion the whole control
    was built around was a pure denial.

    `RETURNING` per row rather than one multi-row `INSERT`, for the reason
    `tests/conftest.py::_seed_isolation_rows` measured: a `text()` construct
    executed with a LIST of parameter dictionaries is an executemany, and
    RETURNING does not come back from one — `ResourceClosedError: This result
    object does not return rows`. The ids are the point, so a loop is how they
    come back.
    """
    written: dict[UUID, UUID] = {}
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM orders"))
        for tenant in (TENANT_ONE, TENANT_TWO):
            row_id = connection.execute(
                text("INSERT INTO orders (tenant_id) VALUES (:tenant) RETURNING id"),
                {"tenant": tenant},
            ).scalar_one()
            written[UUID(str(row_id))] = tenant
    return written


def _seed_rules(engine: Engine) -> dict[UUID, str]:
    """Three committed rulebook rows, one per `status`. Returns id -> status.

    ONE OF EACH STATUS, AND `pending` IS THE ONE THAT CARRIES A RULING. The owner
    has ruled that a PENDING rule is VISIBLE to everyone and that only an engineer
    may CONFIRM one — CLAUDE.md's "PENDING rules cannot affect the pipeline" is
    about EFFECT, not visibility. So the positive control below reads a set that
    contains a `pending` row, and a `WHERE status = 'live'` appearing anywhere
    between the table and the caller fails it by name rather than by a count.

    Committed and written as the SUPERUSER, for `_seed_two_tenants`' reasons: the
    reader is a different connection, so an uncommitted row is invisible to it,
    and `titlepipe_app` holds no INSERT on this table by design.

    `DELETE` first, so the contents are a function of this call rather than of
    whatever ran before it. `rules` has no append-only trigger, so unlike
    `audit_log` it can actually be cleared.

    `RETURNING id` per row rather than one multi-row INSERT: `tests/conftest.py
    ::_seed_isolation_rows` measured that a `text()` construct executed with a
    LIST of parameter dictionaries is an executemany, and RETURNING does not come
    back from one. The ids are what the control asserts on — a COUNT of three is
    satisfied by three wrong rows — so they have to come back.

    `version` is 1 on all three and means nothing here; it is `NOT NULL` and the
    seed has to say something.
    """
    seeded: dict[UUID, str] = {}
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM rules"))
        for code, status in (("R13", "live"), ("R14", "pending"), ("R15", "retired")):
            row_id = connection.execute(
                text(
                    "INSERT INTO rules (code, text, origin, status, version) "
                    "VALUES (:code, :body, 'spec', :status, 1) RETURNING id"
                ),
                {
                    "code": code,
                    "body": f"{code} exists so that this control has a row",
                    "status": status,
                },
            ).scalar_one()
            seeded[UUID(str(row_id))] = status
    return seeded


def test_the_tables_outside_tenancy_are_exactly_the_ones_named_as_exceptions(
    migrated_database: str,
    alembic_version_table: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE EXEMPTION, PINNED BY NAME, BECAUSE THE DERIVATION CANNOT SEE IT.

    `_tenant_tables` asks the catalog for tables carrying `tenant_id`. That is the
    right derivation and this test does not touch it — but its consequence is that
    a table WITHOUT the column vanishes from this file completely, with no
    assertion anywhere about its grants, its RLS state or its readability. There
    is no exception list to leave a table off; the predicate simply never mentions
    it.

    So this is the complement, asserted as an EXACT SET against a literal. What it
    buys, concretely:

    * a SECOND global table cannot appear silently. It has to be added here, which
      is a diff a reviewer reads, rather than being invisible by construction;
    * a `tenant_id` added to `rules` — the accidental way the tenancy ruling gets
      reversed, by somebody "fixing" a table in `public` with no policy on it —
      fails HERE naming `rules`, and fails
      `test_every_tenant_table_is_forced_isolated_and_reachable_by_the_app`
      naming it too, because it would then be in the derived tenant set;
    * it gives the three assertions below a set to be about. Each of them names
      `rules` directly, and this is what says the catalog agrees that `rules` is
      the whole of what they have to cover.

    NO CARDINALITY FLOOR HERE, unlike the derived tenant set, and the omission is
    deliberate: equality against a one-element frozenset is already unsatisfiable
    by an empty derivation, so a floor would be a second spelling of the same
    check. The tenant assertions need one because their exact-set comparison is
    followed by `for` loops that pass over nothing.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            derived = _global_tables(connection, alembic_version_table)
    finally:
        engine.dispose()

    assert derived == set(EXPECTED_GLOBAL_TABLES), (
        f"the tables in public outside tenancy are {sorted(derived)}, not "
        f"{sorted(EXPECTED_GLOBAL_TABLES)}. Every table here has NO tenant_id and "
        f"is therefore invisible to _tenant_tables, so nothing else in this file "
        f"would ever mention it. A new name means a table that carries no tenancy "
        f"at all: give it one, or name it here with the ruling that says why not."
    )


def test_the_rulebook_is_deliberately_outside_row_level_security(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 RLS OFF, FORCE OFF, AND NO POLICY — ALL THREE ASSERTED, ALL THREE MEANT.

    THE POINT OF ASSERTING AN ABSENCE. `rules` reads, in the catalog, exactly like
    a table somebody forgot to isolate: `relrowsecurity` false, no `tenant_isolation`
    policy, nothing. The two states are indistinguishable to a reader of the
    schema, and the difference matters — one is a ruling and the other is a
    cross-tenant leak. This test is the difference, written down where the catalog
    is.

    The ruling is `migrations/versions/0003_rules.py`'s to state; the short of it
    is that there is no tenant on this table for a policy to key on. The failure
    messages below DO spell it out, and that is not a fifth copy by accident: a
    reader meeting this red has the assertion in front of them and not the
    migration, and is about to decide whether the rulebook should be
    tenant-scoped after all.

    ALL THREE RATHER THAN ONE, because they are independent catalog facts and each
    breaks differently:

    * `relrowsecurity` and `relforcerowsecurity` are separate `pg_class` columns
      and neither clears the other — `_row_security` records the measurement. A
      `FORCE` with no `ENABLE` is inert today and becomes total denial the moment
      anyone enables RLS;
    * the policy set is read from `pg_policies` and required EMPTY, not merely
      free of `tenant_isolation`. RLS off means a policy has no effect, so an
      orphaned one is not a leak — it is a statement about intent that would
      become live the instant somebody enabled RLS "to be consistent with the
      other seven".

    THE PAIR OF FAILURE MESSAGES IS THE DELIVERABLE. Whoever reads this red is
    about to decide whether the rulebook should be tenant-scoped after all, and
    the answer has to be in front of them rather than in a plan document.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            enabled, forced = _row_security(connection)[RULES_TABLE]
            policies = {name for (table, name) in _policies(connection) if table == RULES_TABLE}
    finally:
        engine.dispose()

    assert (enabled, forced) == (False, False), (
        f"{RULES_TABLE} has (relrowsecurity, relforcerowsecurity) = "
        f"{(enabled, forced)}, and both must be false. This is DELIBERATE: the "
        f"rulebook is GLOBAL (ruled 2026-08-05), scoped by jurisdiction rather "
        f"than by customer, so there is no tenant column for a policy to key on. "
        f"Enabling RLS here with no policy denies every row to titlepipe_app and "
        f"takes GET /api/rules down; enabling it WITH a tenant policy reverses a "
        f"ruling. If the rulebook should be tenant-scoped, that is a decision to "
        f"make out loud, not a line to add to a migration."
    )
    assert policies == set(), (
        f"{RULES_TABLE} carries the policies {sorted(policies)}, and it must carry "
        f"none. They do nothing while RLS is off, which is exactly the hazard: "
        f"they are a statement of intent that goes live the day somebody enables "
        f"row-level security here for consistency with the other seven tables."
    )


def test_the_rulebook_grants_select_to_the_app_role_and_nothing_more(
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
    app_role: str,
) -> None:
    """The grantee set for `rules`, asserted the way `0002`'s seven already are.

    `aclexplode` through `_table_grantees` and NOT `has_table_privilege`, for the
    reason that helper records at length: `has_*_privilege` answers about the
    EFFECTIVE privilege, so a `GRANT … TO PUBLIC` satisfies it and reads
    identical to a grant naming the role. Who the ACL NAMES is a separate
    question and `0002`'s eight grants respelled `TO PUBLIC` once shipped
    `195 passed` against exactly that.

    THE HELPER IS REUSED RATHER THAN RE-IMPLEMENTED, and `_expected_grantees`
    derives this table's expectation from `_expected_grants` — so `SELECT` being
    the only granted verb here is stated once, at `RULES_GRANTED_VERBS`, and
    `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE` fall out as withheld rather than
    being listed a second time.

    WHY ONLY `SELECT`, AND WHY THAT IS WORTH A RED TEST LATER. Plan 02 ships a
    read. Rule creation and the engineer-confirm write are Plan 05's, and they
    arrive with the refusals that make them safe — `CLAUDE.md`: escalation
    resolution is refused without a rule, judgments never auto-confirm in v1. A
    grant that lands before the enforcement is a grant nothing is checking.

    `titlepipe_worker` is asserted to hold NOTHING, which is the negative control
    `test_the_grants_name_the_app_role_explicitly_and_reach_no_other_role` already
    runs for the other seven and could not run for this one: that test loops the
    DERIVED tenant set, which `rules` is not in.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            grantees = _table_grantees(connection)
            worker = _table_privileges(connection, WORKER_ROLE, RULES_TABLE)
    finally:
        engine.dispose()

    for verb, expected in sorted(_expected_grantees(RULES_TABLE).items()):
        held = grantees.get((RULES_TABLE, verb), set())
        public = " PUBLIC is every role on this cluster." if PUBLIC_GRANTEE in held else ""
        assert held == expected, (
            f"{verb} on {RULES_TABLE} is held by {sorted(held)}, not "
            f"{sorted(expected)}.{public} {OWNER_ROLE} is in every set because it "
            f"OWNS the table, not because 0003 granted it anything. "
            f"has_table_privilege cannot see this: it reports the EFFECTIVE "
            f"privilege, so {app_role} reads TRUE whether 0003 named it or handed "
            f"the grant to everybody."
        )

    for verb, allowed in sorted(worker.items()):
        assert allowed is False, (
            f"{WORKER_ROLE} holds {verb} on {RULES_TABLE}, and 0003 grants it "
            f"nothing. This table has no row-level security at all, so a privilege "
            f"reaching that role by any route is unfiltered access to the whole "
            f"rulebook rather than to one tenant's slice of it."
        )


def test_the_rulebook_is_readable_with_no_tenant_established(
    migrated_database: str,
    app_dsn: str,
    seam_engine: Callable[[str], Engine],
    tenant_deny_sentinel: str,
) -> None:
    """🔴 THE POSITIVE CONTROL FOR GLOBALITY. THE WHOLE RULING RESTS ON THIS ROW SET.

    Everything else about `rules` in this file is a catalog read, and a catalog
    read cannot tell you what a caller receives. This connects as `titlepipe_app`
    on a session that has established NO TENANT — the deny sentinel `''` that
    `conftest.py::SEAM_CONNECT_ARGS` pins on every connection in this suite — and
    requires EVERY seeded row back.

    ---------------------------------------------------------------------------
    🔴 THE CONTRAST IS ASSERTED ON THE SAME CONNECTION, AND IT IS WHAT MAKES THIS
       A CONTROL RATHER THAN A DENIAL DRESSED UP AS ONE.
    ---------------------------------------------------------------------------
    `00-HOW-TO-EXECUTE.md` §1.1 records the measurement this is written against:
    Plan 01's isolation suite was run with the tenant mechanism torn out and three
    assertions still passed, every one of them satisfied by a database that denies
    everybody everything. A test that only read `rules` and got three rows would
    be the mirror of that — satisfied by a database with no isolation anywhere.
    So `orders` is seeded with two tenants' rows and read on the SAME connection,
    in the SAME state, and must come back EMPTY. One statement returns everything
    and the next returns nothing, and only a working `tenant_isolation` policy on
    one table and a deliberate absence of one on the other produces that pair.

    ---------------------------------------------------------------------------
    🔴 AND THE CONTRAST HALF NEEDED ITS OWN CONTROL, BECAUSE `count(*) == 0` IS
       TRUE OF AN EMPTY TABLE.
    ---------------------------------------------------------------------------
    The paragraph above was written before this one and was, for a while, exactly
    what it warns against. MEASURED 2026-08-06 on this tree, `_seed_two_tenants`
    replaced by a bare `DELETE FROM orders` — one mutation, this test alone:
    **`1 passed`.** "The app sees zero orders" is equally true of isolation
    working, of an empty table, of a broken DSN and of a role with no grant, which
    is §1.1's finding restated inside the assertion that cites §1.1.

    So the seed now returns the two rows it wrote and they are READ BACK ON THE
    ADMIN CONNECTION FIRST — by id and by tenant, not by count, because two rows
    is satisfied by two wrong rows. The superuser bypasses RLS unconditionally, so
    that read is a statement about what is IN the table rather than about what any
    policy allows. Only after the rows are proved present does the app session's
    zero mean "isolation removed them".

    ---------------------------------------------------------------------------
    🔴 AND THE PREMISE NEEDED A CARDINALITY FLOOR, BECAUSE `{} == {}` IS TRUE.
    ---------------------------------------------------------------------------
    Found by running the injection above against the FIX for it. With the seed
    replaced by a bare `DELETE FROM orders`, `seeded_orders` and `present_orders`
    are both empty, `visible` and `seeded` are both empty, and every comparison in
    this test is an equality between two empty mappings: **`1 passed` again.**
    Comparing what the seed wrote against what the table holds says nothing at all
    when the seed wrote nothing — which is the same defect one level up, and is
    exactly why `00-HOW-TO-EXECUTE.md` §1.1 says to ask what a broken-in-the-
    obvious-way system would score.

    So both seeds are asserted to have written a KNOWN NUMBER of rows, as
    LITERALS, before anything is compared. Two orders because there are two
    tenants; three rules because there are three statuses. And `pending` is
    asserted present BY NAME rather than left to the count, because it is the one
    row carrying the owner's visibility ruling and a seed that quietly stopped
    writing it would leave that ruling unpinned while the counts still matched.

    THE ORDER OF THE ASSERTIONS IS A DIAGNOSTIC DECISION. The sentinel first,
    because every read below is about a state it defines; then what the seeds
    wrote, because that is the premise of the premise; then that the rows are
    really in the tables; then the two reads. A failure therefore names the
    earliest thing that stopped being true.

    **THIS IS THE ASSERTION THAT FAILS THE DAY ANYBODY GIVES `rules` A POLICY.**
    A `tenant_isolation`-shaped policy would make this session — which is every
    session, since `GET /api/rules` needs no principal — read zero rules, and the
    rulebook screen would go blank with no error naming a policy, because the rows
    simply match none.

    THE IDS ARE COMPARED, NOT THE COUNT. A count of three is satisfied by three
    wrong rows; `_seed_rules` returns what it wrote so the comparison is by value.

    **AND THE STATUSES ARE COMPARED WITH THEM**, which pins the owner's other
    ruling: PENDING rules are VISIBLE to everyone and only an engineer may confirm
    one. "Cannot affect the pipeline" is about effect, not visibility. A
    `WHERE status = 'live'` anywhere between the table and this caller fails here
    naming the row it hid.
    """
    admin = seam_engine(migrated_database)
    try:
        seeded = _seed_rules(admin)
        seeded_orders = _seed_two_tenants(admin)
        with admin.connect() as connection:
            # As the SUPERUSER, which bypasses RLS unconditionally — so this is
            # what is in the table, not what a policy permits.
            present_orders = {
                UUID(str(row[0])): UUID(str(row[1]))
                for row in connection.execute(text("SELECT id, tenant_id FROM orders"))
            }
    finally:
        admin.dispose()

    engine = seam_engine(app_dsn)
    try:
        with engine.connect() as connection:
            established = connection.execute(
                text("SELECT current_setting('app.current_tenant', true)")
            ).scalar_one()
            visible = {
                UUID(str(row[0])): str(row[1])
                for row in connection.execute(text("SELECT id, status FROM rules"))
            }
            tenant_rows = connection.execute(text("SELECT count(*) FROM orders")).scalar_one()
    finally:
        engine.dispose()

    assert established == tenant_deny_sentinel, (
        f"this connection did not start at the deny sentinel but at {established!r}, "
        f"so neither assertion below is about the state they are written for"
    )

    # 🔴 THE FLOOR UNDER BOTH PREMISES, AS LITERALS. Every comparison below is an
    # equality between what a seed wrote and what a session saw, and every one of
    # them is trivially true when the seed wrote nothing. Two orders, one per
    # tenant; three rules, one per status.
    assert len(seeded_orders) == 2, (
        f"the orders seed wrote {len(seeded_orders)} rows, not one per tenant. "
        f"The contrast below compares that mapping against what the app session "
        f"sees, and an empty seed makes every comparison in this test an equality "
        f"between two empty mappings."
    )
    assert len(seeded) == 3, (
        f"the rulebook seed wrote {len(seeded)} rows, not one per status. Same "
        f"trap: `visible == seeded` is satisfied by two empty mappings."
    )
    assert "pending" in seeded.values(), (
        f"the rulebook seed wrote no `pending` row, so this test no longer pins "
        f"the owner's ruling that a PENDING rule is VISIBLE to everyone — a "
        f"`WHERE status = 'live'` between the table and the caller would pass. "
        f"Seeded statuses: {sorted(seeded.values())}"
    )

    assert present_orders == seeded_orders, (
        f"the superuser — which bypasses RLS unconditionally — saw "
        f"{present_orders} in orders, not the {seeded_orders} the seed wrote. "
        f"This is the PREMISE of the contrast below, and it is asserted because "
        f"without it `count(*) == 0` on the app session is satisfied by an empty "
        f"table, a broken DSN and a missing grant just as readily as by tenant "
        f"isolation. Compared by id and tenant rather than by count: two rows is "
        f"satisfied by two wrong rows."
    )
    assert visible == seeded, (
        f"an app session with no tenant established saw {len(visible)} of "
        f"{len(seeded)} seeded rules. The rulebook is GLOBAL: nothing scopes it "
        f"and nothing filters it on read, so every row must come back. Missing "
        f"rows mean a policy has been added to this table — under which every "
        f"session reads zero rules, because GET /api/rules has no principal and "
        f"establishes no tenant. saw={visible} seeded={seeded}"
    )
    assert tenant_rows == 0, (
        f"the SAME connection, in the SAME state, saw {tenant_rows} of "
        f"{len(seeded_orders)} rows in orders, which the assertion above has just "
        f"proved are there. That is the contrast this control exists for: without "
        f"it, 'rules returns every row' is equally true of a database with no "
        f"tenant isolation anywhere, which is the exact failure "
        f"00-HOW-TO-EXECUTE.md §1.1 measured."
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

    WHAT THIS TEST USED TO MISS, and it missed it in both directions (this said
    "in both of F1(a)'s directions"; no document here defines an `F1(a)`, the
    review that numbered it was never committed, and the two directions are
    spelled out below anyway):
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
    migrated_database: str, app_dsn: str, seam_engine: Callable[[str], Engine], app_role: str
) -> None:
    """🔴 THE ONE GRANT THAT DIFFERS, PINNED SO IT CANNOT BE TIDIED BACK.

    `0001`'s `audit_log_append_only` trigger refuses UPDATE and DELETE whatever
    the ACL says, so `GRANT UPDATE ON audit_log` would change no behaviour and
    would MISSTATE THE INTENT — an ACL reading `arwU` on the one table this
    system promises never to edit in place. `DELETE` was already correctly not
    granted; this makes the two append-only verbs consistent.

    WHAT IT COSTS, ASSERTED RATHER THAN ONLY WRITTEN DOWN: the trigger's UPDATE
    branch is unreachable for `titlepipe_app`, exactly as its DELETE branch
    already was, because the privilege check runs FIRST. So an `UPDATE` issued
    as that role comes back `42501 permission denied for table audit_log`, not
    the trigger's `0A000`, and the second half of that claim —
    that the trigger is not thereby decoration — is
    `test_the_append_only_trigger_still_answers_for_the_paths_the_acl_does_not`
    immediately below, which reaches the table as the superuser (who bypasses
    the ACL and RLS alike) and gets `0A000` from the trigger itself.

    🔴 UNTIL 2026-08-06 THAT PARAGRAPH WAS A DESCRIPTION OF A TEST THAT DID NOT
    EXIST. It said "this test reads `42501` from that role — and the second half
    then …", and the body was four `has_table_privilege` calls: it executed no
    statement, had no second half, and NO TEST ANYWHERE ASSERTED THE `42501`
    that `0002` states three times as the cost of withholding `UPDATE`. The
    catalog assertions cannot stand in for it — `has_table_privilege` answers
    about the ACL, and what a caller in Plans 02-06 will actually receive is a
    SQLSTATE. The statement below is that assertion.

    THE MESSAGE IS ASSERTED ALONGSIDE THE SQLSTATE, for the reason
    `INSUFFICIENT_PRIVILEGE_SQLSTATE` records: PostgreSQL uses `42501` both for
    "you may not touch this table" and for "this query would be affected by a
    row-level security policy", and this connection is at the deny sentinel, so
    both are live explanations for the same five characters. `permission denied`
    is the privilege one; the RLS one reads `query would be affected by`.
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

    app = seam_engine(app_dsn)
    try:
        with app.connect() as connection:
            with pytest.raises(DBAPIError) as raised:
                connection.execute(text("UPDATE audit_log SET tenant_id = tenant_id"))
            connection.rollback()
    finally:
        app.dispose()

    assert _sqlstate(raised.value) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"expected {INSUFFICIENT_PRIVILEGE_SQLSTATE} for {app_role} updating "
        f"audit_log, got {_sqlstate(raised.value)}: {raised.value}. "
        f"{APPEND_ONLY_SQLSTATE} here would mean the grant came back."
    )
    assert "permission denied" in str(raised.value), (
        f"42501 came back for some other reason than the missing grant — this "
        f"session is at the deny sentinel, so a row-level security refusal "
        f"carries the same SQLSTATE: {raised.value}"
    )


def test_the_grants_name_the_app_role_explicitly_and_reach_no_other_role(
    migrated_database: str,
    alembic_version_table: str,
    seam_engine: Callable[[str], Engine],
    app_role: str,
) -> None:
    """🔴 WHO THE ACL NAMES, WHICH `has_table_privilege` STRUCTURALLY CANNOT SAY.

    MEASURED 2026-08-06 on this tree: `0002`'s eight `GRANT … TO titlepipe_app`
    respelled `TO PUBLIC`, one mutation, whole suite — **`195 passed`**. Every
    grant assertion in this file goes through `_table_privileges`, which uses
    `has_table_privilege`, which answers about the EFFECTIVE privilege. A
    privilege reaching `titlepipe_app` through `PUBLIC` is TRUE to that function
    and indistinguishable from one granted to the role by name.

    That choice is right for those assertions — they ask the question the server
    will ask — and it is why this test exists beside them rather than instead of
    them. `_table_grantees` reads `pg_class.relacl` through `aclexplode`, which
    is the only thing that can tell an explicit entry from an inherited one; it
    is the identical technique `_schema_usage_grantees` already uses one level up,
    for the identical reason.

    TWO ASSERTIONS, AND THE SECOND IS THE ONE THE MUTATION WAS LOUDEST ABOUT:

    * **the grantee set is EXACT**, per table and per verb. `PUBLIC` absent falls
      out of the equality rather than being a separate check, and the message
      names it when it is what turned up, because `TO PUBLIC` is the specific
      accident this is here for. `DELETE` and `TRUNCATE` are covered by the same
      loop at `{titlepipe_owner}` — a `GRANT ALL` names the app role explicitly
      and would satisfy a check that only looked at SELECT/INSERT/UPDATE;
    * **`titlepipe_worker` holds NOTHING.** `0002` grants that role no table
      privilege at all, and a negative control is the only assertion that can see
      a privilege arriving somewhere nobody asked about. It matters more than it
      looks: `app.current_tenant` is a custom GUC and therefore carries no ACL —
      `0002`'s own header records that any role can `SET` its own — so a
      `titlepipe_worker` that acquires SELECT is a role that reads whichever
      tenant it names. MEASURED under the `TO PUBLIC` mutation: every verb on
      every one of the seven came back TRUE for it.

    The seven are DERIVED and then floored and set-checked, for the reason the
    module docstring gives: the loops below pass over an empty set.

    `WORKER_ROLE` is the module constant rather than a fixture because
    `conftest.py` publishes `app_role` and `owner_role` and not this one, and
    this task does not own that file.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            derived = _tenant_tables(connection, alembic_version_table)
            grantees = _table_grantees(connection)
            worker = {
                table: _table_privileges(connection, WORKER_ROLE, table)
                for table in sorted({*derived, REGISTRY_TABLE})
            }
    finally:
        engine.dispose()

    assert len(derived) >= MINIMUM_TENANT_TABLES, (
        f"the derivation found {len(derived)} tenant tables, fewer than the "
        f"{MINIMUM_TENANT_TABLES} that exist: {sorted(derived)}. Every assertion "
        f"below is a loop, so a broken derivation reports success."
    )
    assert derived == set(EXPECTED_TENANT_TABLES), (
        f"the tenant tables are {sorted(derived)}, not {sorted(EXPECTED_TENANT_TABLES)}"
    )

    for table in sorted({*derived, REGISTRY_TABLE}):
        for verb, expected in sorted(_expected_grantees(table).items()):
            held = grantees.get((table, verb), set())
            public = " PUBLIC is every role on this cluster." if PUBLIC_GRANTEE in held else ""
            assert held == expected, (
                f"{verb} on {table} is held by {sorted(held)}, not "
                f"{sorted(expected)}.{public} has_table_privilege cannot see this: "
                f"it reports the EFFECTIVE privilege, so {app_role} reads TRUE "
                f"whether 0002 named it or handed the grant to everybody."
            )

        for verb, allowed in sorted(worker[table].items()):
            assert allowed is False, (
                f"{WORKER_ROLE} holds {verb} on {table}, and 0002 grants it "
                f"nothing. That role can set app.current_tenant itself — a custom "
                f"GUC carries no ACL — so a privilege reaching it by any route is "
                f"a role that reads and writes whichever tenant it names."
            )


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

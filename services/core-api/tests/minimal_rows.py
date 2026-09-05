"""The smallest row each domain table will accept, for tests that do not care.

**WHY THIS FILE EXISTS.** Until `0008`, `orders` had three columns and
`Order(tenant_id=...)` was a complete row, so the tenancy-seam tests — which are
about `SET LOCAL`, pooling, savepoints and policy predicates, and not about
title search — could write one in a single expression. `0008` gives `orders` the
seven `NOT NULL` columns the domain actually requires, and every one of those
call sites became a `NotNullViolation`.

There were two ways to keep them green. One was to make the new columns
nullable, which would have been the schema lying to keep a test convenient.
The other is this: one place that knows what a complete order looks like, so the
seam tests can go on saying `a_minimal_order(tenant)` and stay about the seam.

**THE VALUES ARE DELIBERATELY IMPLAUSIBLE.** `TEST-ONLY` and `ZZ` are not a
county or a state code any package will ever carry, so a row from here that
escapes into a fixture that meant to build a real one is visible on sight
rather than mistaken for data. Nothing here is a default: the migration gives
these columns no `server_default`, precisely because there is no honest one
(CONVENTIONS §4), and these are a TEST's answer to "what do I put in a column I
have no opinion about", which is a different question.

A plain module rather than fixtures, imported as `tests/acl_contract.py` is —
`from minimal_rows import a_minimal_order`. A fixture would force every caller
to take it as a parameter, including the several that build two orders for two
tenants in one statement.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Collection, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import MappingProxyType
from typing import Any, Final

from titlepipe_core.db.models import Order

# What `insert_audit_log` will interpolate as a bind parameter name, and nothing else.
# `conftest._isolation_tables` guards catalog-derived table names the same way and for the
# same reason: a name that reaches a SQL string has to be checked where it is interpolated.
_BIND_PARAMETER: Final = re.compile(r"\A[a-z_][a-z0-9_]*\Z")


# Every `NOT NULL` column `0008` adds to `orders` except the two that cannot be
# constants. `client_id` varies per call because it is a uuid the caller may want
# to match against; `external_ref` varies because `uq_orders_tenant_id
# _external_ref` makes it the table's natural key, and two `a_minimal_order`
# rows in ONE tenant is an ordinary thing for a seam test to want. A fixed
# string here was a `duplicate key value violates unique constraint
# "uq_orders_tenant_id_external_ref"` in `test_4_a_savepoint_rolled_back_leaves
# _the_tenant_established`, MEASURED on this tree — and it was reached only
# once the isolation seed started writing complete rows, because before that
# nothing else in the suite wrote a second order into one tenant.
def _minimal_order_required() -> dict[str, Any]:
    """Built per call, because one of the five values must not repeat."""
    return {
        "external_ref": f"TEST-ONLY-{uuid.uuid4()}",
        "jurisdiction": "TEST-ONLY",
        "state_code": "ZZ",
        "county": "TEST-ONLY",
        "status": "received",
    }


# The raw-SQL half. The seam tests that insert through `text()` rather than the
# ORM do it deliberately — they are asserting what a policy does to a statement,
# and an ORM insert would put a layer between the test and the thing tested — so
# they need the column list too. Building it HERE rather than at each call site
# is what keeps the next `NOT NULL` column a one-line change, and it is also what
# confines the `S608` suppression to one reviewed place.
_ORDER_SQL_COLUMNS = (
    "tenant_id, client_id, external_ref, jurisdiction, state_code, county, status, arrived_at"
)

# `arrived_at` is `now()` in SQL and a Python `datetime` through the ORM, for the
# reason the two spellings exist at all: one is a server expression the statement
# evaluates, the other is a bound parameter, and neither is available to the other.
#
# 🔴 `external_ref` VARIES PER ROW HERE FOR THE REASON `_minimal_order_required`
# GIVES FOR VARYING IT THROUGH THE ORM, and the SQL half used to be the literal
# `'TEST-ONLY'` because its only caller wrote one row per TENANT and could not
# collide. `uq_orders_tenant_id_external_ref` is the table's natural key, so two
# minimal orders in ONE tenant is a `duplicate key value` — MEASURED on this tree
# the moment `test_order_queue_repository` started seeding three orders for one
# tenant through this module. `gen_random_uuid()` rather than an ordinal because
# there is no counter a SQL literal can carry across separate statements.
_ORDER_EXTERNAL_REF = "'TEST-ONLY-' || gen_random_uuid()"

# Column name -> the expression that fills it, for every `NOT NULL` column of
# `orders` a caller has no opinion about. A MAPPING and not two parallel strings:
# `insert_order` has to subtract the columns its caller is supplying, and
# subtracting from a comma-joined string is the kind of thing that works until a
# column name is a prefix of another one.
_ORDER_SQL_VALUES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "tenant_id": "",  # never defaulted; every caller supplies it. See `insert_order`.
        "client_id": "gen_random_uuid()",
        "external_ref": _ORDER_EXTERNAL_REF,
        "jurisdiction": "'TEST-ONLY'",
        "state_code": "'ZZ'",
        "county": "'TEST-ONLY'",
        "status": "'received'",
        "arrived_at": "now()",
    }
)

# The columns a caller MAY name and this module never fills. `0001` gives both a
# server default — `gen_random_uuid()` and `now()` — so the honest way to leave
# them alone is to leave them OUT of the statement entirely and let the server
# answer; a literal here would be this module competing with the schema for the
# same question. A test that cares which id a row has, or when it arrived
# relative to another row, names them and supplies both.
_ORDER_SQL_SERVER_FILLED: Final[Collection[str]] = frozenset({"id", "created_at"})

_ORDER_SQL_ROW = ", ".join(
    expression for column, expression in _ORDER_SQL_VALUES.items() if column != "tenant_id"
)


def insert_orders_returning(returning: str, *tenant_placeholders: str) -> str:
    """One `INSERT` writing a complete order per named bind parameter.

    `returning` is the caller's own `RETURNING` list, because the three call
    sites want different ones. `tenant_placeholders` are bind parameter NAMES —
    `insert_orders_returning("tenant_id, id", "one", "two")` produces a
    two-row insert whose tenants come from `:one` and `:two`.

    🔴 `S608` IS SUPPRESSED HERE AND NOWHERE ELSE, AND THE REASON IS CHECKABLE
    RATHER THAN ASSERTED. Every fragment interpolated below is a literal defined
    in this module; the only caller-supplied strings are `returning` and the bind
    parameter NAMES, and the tenant VALUES — the part an injection would have to
    travel through — stay bind parameters and never touch this string. Moving the
    construction here is what makes that one claim to review instead of three.
    """
    rows = ", ".join(f"(:{name}, {_ORDER_SQL_ROW})" for name in tenant_placeholders)
    return f"INSERT INTO orders ({_ORDER_SQL_COLUMNS}) VALUES {rows} RETURNING {returning}"  # noqa: S608


def insert_order(*caller_columns: str) -> str:
    """One `INSERT` writing ONE complete order, with the caller filling `caller_columns`.

    Each name in `caller_columns` becomes both a column and a bind parameter of
    the same name; every other `NOT NULL` column of `orders` is filled from this
    module, and the two columns with a server default are left out unless named.
    `insert_order("id", "tenant_id", "created_at")` is a statement whose caller
    decides the three columns its assertions are about and does not have to know
    that `0008` gave the table six more.

    SEPARATE FROM `insert_orders_returning` RATHER THAN A PARAMETER ON IT, because
    the two differ in the part that is hard to get right: that one writes one row
    per TENANT in a single statement and names its own `RETURNING` list, this one
    writes one row and returns nothing. Folding them together produced a signature
    where `insert_order("id")` and `insert_orders_returning("id")` differ in what
    `"id"` MEANS — a column here, a `RETURNING` list there — which is exactly the
    confusion a test author reading one call site cannot see.

    🔴 `S608` IS SUPPRESSED FOR THE SAME CHECKABLE REASON AS ABOVE, WITH ONE MORE
    CLAUSE. Every expression interpolated is a literal in `_ORDER_SQL_VALUES`; the
    caller supplies only column NAMES, and those are checked against that mapping
    below, so a name that is not a column of `orders` raises here rather than
    reaching the server. The VALUES stay bind parameters and never touch this
    string.
    """
    known = set(_ORDER_SQL_VALUES) | set(_ORDER_SQL_SERVER_FILLED)
    unknown = [name for name in caller_columns if name not in known]
    if unknown:
        raise AssertionError(
            f"insert_order was asked to let the caller fill {unknown}, which "
            f"`minimal_rows` does not know as a column of `orders`. It knows "
            f"{sorted(known)}; a column outside that set is either a typo or a "
            f"schema change this module has not been told about."
        )
    if "tenant_id" not in caller_columns:
        raise AssertionError(
            "insert_order requires the caller to supply `tenant_id`. There is no "
            "honest default for it: a row's tenant is the one thing this module "
            "cannot invent, and `FORCE ROW LEVEL SECURITY` would make a wrong "
            "guess invisible rather than an error."
        )

    filled = {
        column: f":{column}" if column in caller_columns else expression
        for column, expression in _ORDER_SQL_VALUES.items()
    }
    # Server-filled columns appear in the statement only when the caller named
    # one; unnamed, they are absent and the column's own default applies.
    filled.update(
        {column: f":{column}" for column in _ORDER_SQL_SERVER_FILLED if column in caller_columns}
    )
    columns = ", ".join(filled)
    values = ", ".join(filled.values())
    return f"INSERT INTO orders ({columns}) VALUES ({values})"  # noqa: S608


def insert_actor(tenant: str) -> str:
    """The `users` row `insert_audit_log`'s actor columns resolve to, for one tenant.

    `0100` binds `audit_log.actor_user_id` in a `BEFORE INSERT` trigger by
    looking `(tenant_id, actor_subject, actor_seat)` up in `users`, and refuses
    `28000` when it finds no ACTIVE match. So an audit row for a tenant that has
    no seats is no longer writable, which is the correct behaviour and which
    every fixture that invents a tenant now has to satisfy.

    `ON CONFLICT DO NOTHING` so a caller can be idempotent about it without
    knowing whether an earlier statement in its transaction already wrote the
    row. The email varies by tenant because `uq_users_tenant_id_email` is
    tenant-prefixed and a constant would collide only across tenants — which it
    does not — but a caller writing two tenants in one transaction reads more
    easily when the rows are visibly different.

    🔴 `S608` IS SUPPRESSED FOR `insert_audit_log`'s REASON: `tenant` is a bind
    parameter NAME checked against `_BIND_PARAMETER`, and every other value in
    the statement is a literal in this module.
    """
    if not _BIND_PARAMETER.match(tenant):
        raise AssertionError(
            f"insert_actor was given {tenant!r} as a bind parameter name. It "
            f"interpolates that name into SQL, so it has to be a plain identifier; "
            f"the tenant VALUE belongs in the parameter dictionary."
        )
    statement = (
        f"INSERT INTO users "  # noqa: S608
        f"(tenant_id, email, role, identity_provider, identity_subject) "
        f"VALUES (:{tenant}, "
        f"'test-only-' || :{tenant} || '@test-only.invalid', "
        f"'{SEED_ACTOR_SEAT}', 'TEST-ONLY', '{SEED_ACTOR_SUBJECT}') "
        f"ON CONFLICT DO NOTHING"
    )
    return statement


def insert_audit_log(*, tenant: str | None = None, returning: str | None = None) -> str:
    """One `INSERT` writing a complete `audit_log` row.

    `tenant` is a bind parameter NAME, or `None` for a fresh `gen_random_uuid()` —
    the two shapes the three raw call sites in this suite need. `returning` is the
    caller's own `RETURNING` list, or `None` for a statement that returns nothing.

    THE COLUMNS COME FROM `MINIMAL_ROWS["audit_log"]` AND ARE NOT RESPELLED HERE.
    `audit_log` gained its `NOT NULL` columns at `0007` and three call sites were
    still writing `INSERT INTO audit_log (tenant_id)`; a second list here would be
    a fourth place to update the next time the table grows a column.

    `0007`'s `BEFORE INSERT` trigger fills `row_hash`, `prev_hash` and
    `chain_position`, so a complete row does not name them — see the entry itself.

    🔴 `S608` IS SUPPRESSED FOR THE REASON `insert_orders_returning` GIVES, plus
    one: `tenant` is a bind parameter name and is checked against
    `_BIND_PARAMETER` below, so nothing that is not an identifier reaches the
    string. The tenant VALUE stays a bind parameter.
    """
    if tenant is not None and not _BIND_PARAMETER.match(tenant):
        raise AssertionError(
            f"insert_audit_log was given {tenant!r} as a bind parameter name. It "
            f"interpolates that name into SQL, so it has to be a plain identifier; "
            f"the tenant VALUE belongs in the parameter dictionary."
        )

    spec = MINIMAL_ROWS["audit_log"]
    columns = ", ".join(["tenant_id", *spec.columns])
    tenant_value = "gen_random_uuid()" if tenant is None else f":{tenant}"
    values = ", ".join([tenant_value, *spec.columns.values()])
    statement = f"INSERT INTO audit_log ({columns}) VALUES ({values})"  # noqa: S608
    return statement if returning is None else f"{statement} RETURNING {returning}"


def a_minimal_order(tenant_id: uuid.UUID, **overrides: Any) -> Order:
    """An `Order` that satisfies every `NOT NULL` and asserts nothing else."""
    return Order(
        tenant_id=tenant_id,
        client_id=uuid.uuid4(),
        arrived_at=datetime.now(UTC),
        **{**_minimal_order_required(), **overrides},
    )


# ---------------------------------------------------------------------------
# The isolation seed's half: one complete row in EVERY tenant table.
# ---------------------------------------------------------------------------
# `conftest._seed_isolation_rows` writes two rows for tenant A and one for
# tenant B into every table `_isolation_tables` derives from the catalog, and it
# used to do it with `INSERT INTO <table> (tenant_id) VALUES (:tenant)`. That
# statement is complete only for a table whose every other column is nullable or
# defaulted, which described the skeleton and stopped describing `orders` at
# `0008` — the seed died with `null value in column "client_id"`, MEASURED on
# this tree.
#
# 🔴 THE GENERIC INSERT COULD NOT BE PATCHED, IT HAD TO BE REPLACED, and the
# reason is `documents`: its `package_id` is `NOT NULL` and carries a composite
# foreign key, so a complete row cannot be written without naming a `packages`
# row IN THE SAME TENANT that a previous statement created. No amount of
# per-column defaulting reaches that. What is needed is a per-table statement
# that knows its parents, and an INSERT ORDER in which parents precede children.
#
# **WHY EVERY PARENT REFERENCE IS `OFFSET :ordinal - 1` RATHER THAN `LIMIT 1`.**
# Tenant A gets two rows in every table, and every table here carries a
# tenant-prefixed unique constraint over its parent — `uq_pages_tenant_id
# _package_id_page_no`, `uq_fields_tenant_id_order_id_path`,
# `uq_escalation_orders_tenant_id_escalation_id_order_id`. Two rows pointing at
# the SAME parent collide on all of them. Picking the Nth parent for the Nth row
# makes each row's natural key distinct without the spec having to know which
# constraint it is dodging, and it is well-defined because every tenant table is
# seeded with the same row count per tenant.
#
# **THE MACHINE:** the seed reads the row count back per table and raises when it
# differs from what it wrote (`conftest._seed_isolation_rows`), and
# `test_tenant_isolation.py`'s positive control compares the ids it can see
# against the ids that were written for its tenant. A row this file failed to
# write is a `NotNullViolation` naming the column, in the seed, before any
# assertion runs.
#
# The values are `TEST-ONLY` for the reason the order values above are: a row
# from here that escapes into a fixture meaning to build a real one is visible on
# sight. Enum columns take the label that asserts LEAST — `orders.status`
# `'received'`, `chain_links.provenance` `'DERIVED'` (not `'RULED'`, which
# `ck_chain_links_ruled_links_cite_a_rule` would then make demand a rule),
# `client_config_lines.effect` `'waive'` (the one value
# `ck_client_config_lines_only_a_waiver_has_no_body` lets have a null body).


@dataclass(frozen=True)
class _MinimalRow:
    """What one table needs beyond `tenant_id` for its narrowest legal row.

    `parents` maps this table's own column to the table it references; the seed
    turns each into a scalar subquery. `columns` maps a column to a SQL
    EXPRESSION evaluated by the server, not to a value: `now()` and
    `gen_random_uuid()` have no Python equivalent that survives being bound, and
    the two ordinal placeholders below are bound rather than interpolated.

    `requires` is an ORDERING EDGE WITH NO COLUMN BEHIND IT, and it exists
    because `0100` created the first dependency in this schema that no foreign
    key expresses. `audit_log_bind_actor` resolves `actor_subject` against
    `users` on every insert, and the audit writer puts a row into `audit_log`
    behind any write to an audited table — so `users` has to be seeded first,
    for tables that reference it in no column at all. `parents` cannot say that:
    it only produces an edge for a column the insert actually writes, which is
    the correct rule for a foreign key and the wrong one for a trigger.
    """

    parents: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    columns: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    requires: frozenset[str] = frozenset()


# The bind parameters every expression here may use. `:ordinal` is an int and
# `:ordinal_text` its decimal spelling, and they are two parameters rather than
# one cast because they are consumed by operators with different argument types
# — `to_hex(CAST(:ordinal AS integer))` wants an integer, `'TEST-ONLY-' ||
# :ordinal_text` wants text, and `$1::text` over an integer parameter is a
# wire-level type mismatch rather than a coercion.
#
# `:ordinal` reaches the server as a `smallint` while it stays under 2**15, because
# psycopg 3 adapts a Python int by magnitude — so an expression that needs an
# `integer` has to say so. See `packages.sha256` for the measurement.
# 🔴 THE SEAT `audit_log`'s ACTOR COLUMNS RESOLVE TO, AS OF `0100`. That revision
# refuses an audit row whose `(tenant_id, actor_subject, actor_seat)` does not
# name an ACTIVE `users` row, so a fabricated tenant no longer has an audit
# trail available to it until it has a seat. `insert_actor` writes that seat, and
# every call site that invents a tenant has to call it first.
SEED_ACTOR_SUBJECT = "TEST-ONLY-1"
SEED_ACTOR_SEAT = "reviewer"

SEED_ORDINAL = "ordinal"
SEED_ORDINAL_TEXT = "ordinal_text"
SEED_TENANT = "tenant"

MINIMAL_ROWS: Final[Mapping[str, _MinimalRow]] = MappingProxyType(
    {
        # 🔴 `audit_log` IS IN THIS TABLE AND THE COMMENT BELOW USED TO SAY IT DID
        # NOT NEED TO BE. `seed_insert`'s docstring named it, beside `tenants`, as a
        # table the bare tenant insert is CORRECT for. That was true of `0001`'s
        # `audit_log` and stopped being true at `0007`, which adds eight `NOT NULL`
        # columns to it; the two revisions first met at the integration merge.
        #
        # `row_hash`, `prev_hash` and `chain_position` are `NOT NULL` (bar the first
        # row's `prev_hash`) and are deliberately ABSENT here: `0007`'s `BEFORE
        # INSERT` trigger assigns all three under an advisory lock, and its whole
        # point is that "the application can't choose either value". Naming them
        # would be this module writing values the database is about to overwrite,
        # and a reader could not tell which of the two won.
        #
        # `action` is `'insert'` because that is what the seed is doing; `0007`'s
        # enum has exactly three labels and there is no neutral one. `subject_table`
        # is `text` and NOT `regclass` — `0007` says why — so it takes the
        # implausible literal rather than a real relation name.
        # `actor_user_id` and `actor_principal` are `NOT NULL` as of `0100` and
        # are deliberately ABSENT here, for the reason `row_hash` is: the
        # `BEFORE INSERT` trigger `audit_log_bind_actor` ASSIGNS both, and naming
        # them would be this module writing values the database is about to
        # overwrite.
        #
        # 🔴 `actor_subject` IS NO LONGER AN ARBITRARY LITERAL AND `actor_seat`
        # IS NO LONGER `'TEST-ONLY'`. `0100` resolves the pair against `users` in
        # the same tenant and refuses `28000` unless it names an ACTIVE row whose
        # `role` IS the declared seat. The `users` spec below writes
        # `identity_subject = 'TEST-ONLY-' || :ordinal_text` with `role`
        # `'reviewer'`, and ORDINAL 1 is the one every seeded tenant has — tenant A
        # takes two rows per table and tenant B one, so `'TEST-ONLY-2'` would
        # resolve in A and refuse in B. A literal rather than the ordinal
        # expression, so that `insert_audit_log` stays a statement with one bind
        # parameter. Still implausible on sight, which is what the literal is for.
        "audit_log": _MinimalRow(
            requires=frozenset({"users"}),
            columns={
                "actor_subject": f"'{SEED_ACTOR_SUBJECT}'",
                "actor_seat": f"'{SEED_ACTOR_SEAT}'",
                "action": "'insert'",
                "subject_table": "'TEST-ONLY'",
                "subject_id": "gen_random_uuid()",
            },
        ),
        # The two identity tables. `users` has been in `db/identity.py` since the auth
        # seam landed and `clients` arrives with `0080`; neither had an entry here,
        # because until the merge no tree held both the identity module and this seed.
        #
        # 🔴 EVERY VALUE IN `users` VARIES BY ORDINAL, AND THAT IS THE TWO UNIQUE
        # CONSTRAINTS TALKING. `uq_users_tenant_id_email` and
        # `uq_users_tenant_id_identity_provider_identity_subject` are the first natural
        # keys in this schema, and the seed writes TWO rows into tenant A — a constant
        # here is a `duplicate key value` on the second one. The email is lower case
        # because `ck_users_email_is_lowercase` refuses anything else, and that check
        # exists so that two spellings of one address cannot both be a seat.
        "users": _MinimalRow(
            columns={
                "email": "'test-only-' || :ordinal_text || '@test-only.invalid'",
                # `reviewer` is the least-privileged of `0020`'s six labels. A seat is
                # not optional and there is no neutral member, so the seed picks the
                # one that can do least rather than inventing a meaning for a row it
                # has no opinion about.
                "role": "'reviewer'",
                "identity_provider": "'TEST-ONLY'",
                "identity_subject": "'TEST-ONLY-' || :ordinal_text",
            }
        ),
        # `delivery_config` and `template_ref` are nullable and are therefore ABSENT:
        # `db/identity.Client` says an empty `{}` would be a fabricated value standing
        # in for an absence, and a spec entry for a nullable column is exactly that.
        "clients": _MinimalRow(
            columns={
                "name": "'TEST-ONLY'",
                "delivery_method": "'TEST-ONLY'",
                "report_shape": "'TEST-ONLY'",
            }
        ),
        # `0005` and `0006`. Both are tenant-scoped, both are seeded by the isolation
        # pass, and neither had an entry: their revisions and this module first met at
        # the integration merge.
        #
        # `subject_table` is `text` in both and is deliberately the implausible literal
        # rather than a real relation name — `0007` gives the reason for the same column
        # on `audit_log`: it is not a `regclass`, because a `regclass` follows a rename
        # and a record of what was classified must not.
        # `requires` `users`: `0007` attaches `audit_record_change` here, and
        # as of `0100` the audit row it writes resolves its actor against
        # `users`. The dependency is real and no column on this table shows it.
        "record_classifications": _MinimalRow(
            requires=frozenset({"users"}),
            columns={
                # `derived_artifact` is the one label that is neither a class of record
                # the seed would be lying about holding nor the one the table refuses:
                # `ck_record_classifications_telemetry_is_not_stored_here` rejects
                # `operational_telemetry` outright, and `npi_payload` on a `TEST-ONLY`
                # row would be a claim that the seed wrote personal data.
                "record_class": "'derived_artifact'",
                # `safe` for the same reason, and it is the honest one: nothing this
                # module writes is anybody's information.
                "data_class": "'safe'",
                "subject_table": "'TEST-ONLY'",
                # `uq_record_classifications_tenant_id_subject_table_subject_id` makes
                # this the table's natural key, and the seed writes two rows per tenant.
                "subject_id": "gen_random_uuid()",
                "jurisdiction": "'TEST-ONLY'",
                "classified_by": "'TEST-ONLY'",
                "classification_basis": "'TEST-ONLY'",
            },
        ),
        # `released_at`, `released_by` and `release_reason` are absent, which is what
        # makes this an OPEN hold. `ck_legal_holds_release_is_all_or_nothing` accepts
        # zero of the three or all three, so naming one would need all three and would
        # make the seed's minimal row a RELEASED hold — a different thing, and not the
        # one a table's smallest acceptable row should be.
        # `requires` `users`: `0007` attaches `audit_record_change` here, and
        # as of `0100` the audit row it writes resolves its actor against
        # `users`. The dependency is real and no column on this table shows it.
        "legal_holds": _MinimalRow(
            requires=frozenset({"users"}),
            columns={
                "subject_table": "'TEST-ONLY'",
                "subject_id": "gen_random_uuid()",
                "matter_reference": "'TEST-ONLY'",
                "reason": "'TEST-ONLY'",
                "placed_by": "'TEST-ONLY'",
            },
        ),
        "orders": _MinimalRow(
            columns={
                # No foreign key: `clients` is not in this branch's chain. See
                # `0008`'s note on `client_id`.
                "client_id": "gen_random_uuid()",
                "external_ref": "'TEST-ONLY-' || :ordinal_text",
                "jurisdiction": "'TEST-ONLY'",
                "state_code": "'ZZ'",
                "county": "'TEST-ONLY'",
                "status": "'received'",
                "arrived_at": "now()",
            }
        ),
        "packages": _MinimalRow(
            parents={"order_id": "orders"},
            columns={
                # 64 lowercase hex characters, which is what
                # `ck_packages_sha256_is_lowercase_hex` asks for and what a real
                # digest is. `to_hex(1)` is `'1'`; the `lpad` is the rest.
                #
                # 🔴 THE CAST IS LOAD-BEARING. psycopg 3 adapts a Python int by
                # MAGNITUDE, so the ordinal — 1 or 2 — arrives as `smallint`, and
                # `to_hex` has `integer` and `bigint` overloads and no `smallint`
                # one: `function to_hex(smallint) is not unique`, MEASURED against
                # postgres:18.4. Uncast, this expression fails for every ordinal this
                # seed will ever pass and succeeds for none.
                #
                # `CAST(… AS integer)` and NOT `:ordinal::integer`: SQLAlchemy's
                # `text()` does not read a bind parameter that is immediately
                # followed by `::`, so the postfix spelling reaches the server with
                # the `:ordinal` still in it and fails with `syntax error at or near
                # ":"`. Measured in the same run, one error after the other.
                "sha256": "lpad(to_hex(CAST(:ordinal AS integer)), 64, '0')",
                "byte_size": "1",
                "status": "'received'",
                "received_at": "now()",
            },
        ),
        "pages": _MinimalRow(
            parents={"package_id": "packages"},
            columns={"page_no": ":ordinal"},
        ),
        "documents": _MinimalRow(
            parents={"package_id": "packages"},
            columns={
                "label": "'TEST-ONLY'",
                "kind": "'TEST-ONLY'",
                "first_page_no": ":ordinal",
                "last_page_no": ":ordinal",
            },
        ),
        "fields": _MinimalRow(
            parents={"order_id": "orders"},
            columns={"path": "'test.only.' || :ordinal_text", "state": "'pending'"},
        ),
        "field_readings": _MinimalRow(
            parents={"field_id": "fields"},
            columns={
                "engine_id": "'TEST-ONLY'",
                "engine_version": "'0'",
                "cost_usd": "0",
                "latency_ms": "0",
            },
        ),
        "escalations": _MinimalRow(
            columns={
                "field_path_cluster": "'test.only'",
                "question": "'TEST-ONLY'",
                "raised_at": "now()",
            }
        ),
        "escalation_orders": _MinimalRow(
            parents={"escalation_id": "escalations", "order_id": "orders"}
        ),
        "instruments": _MinimalRow(
            parents={"order_id": "orders"},
            columns={"label": "'TEST-ONLY'", "kind": "'TEST-ONLY'"},
        ),
        "chain_links": _MinimalRow(
            parents={"order_id": "orders", "instrument_id": "instruments"},
            columns={"ordinal": ":ordinal", "provenance": "'DERIVED'", "derived_at": "now()"},
        ),
        "chain_root_assertions": _MinimalRow(
            parents={"order_id": "orders"},
            columns={
                "asserted_by": "'TEST-ONLY'",
                "asserted_at": "now()",
                "reason": "'TEST-ONLY'",
            },
        ),
        "products": _MinimalRow(
            columns={
                "code": "'TEST-ONLY-' || :ordinal_text",
                "name": "'TEST-ONLY'",
                # `ck_products_a_year_period_states_its_years` makes
                # `period_kind = 'years'` and a null `period_years` mutually
                # exclusive, so the non-year kind is the one with nothing else
                # to supply.
                "period_kind": "'root_of_title'",
                "is_active": "false",
            }
        ),
        "client_config_versions": _MinimalRow(
            parents={"product_id": "products"},
            columns={
                "client_id": "gen_random_uuid()",
                "version": ":ordinal",
                # `ck_client_config_versions_current_means_published` would then
                # demand a `published_at`, and an unpublished draft is the
                # narrower row.
                "is_current": "false",
            },
        ),
        "client_config_lines": _MinimalRow(
            parents={"config_version_id": "client_config_versions"},
            columns={"line_key": "'test.only'", "effect": "'waive'", "origin_ref": "'TEST-ONLY'"},
        ),
        "intake_signoffs": _MinimalRow(
            parents={"order_id": "orders", "config_version_id": "client_config_versions"}
        ),
        "intake_signoff_lines": _MinimalRow(
            parents={"signoff_id": "intake_signoffs"},
            columns={
                "line_number": ":ordinal",
                "line_key": "'test.only'",
                "label": "'TEST-ONLY'",
                "group_label": "'TEST-ONLY'",
                "comment_required": "false",
                "prefilled_from_policy": "false",
                "period_scoped": "false",
            },
        ),
        "completeness_gaps": _MinimalRow(
            parents={"order_id": "orders"},
            columns={
                "kind": "'na_provisional'",
                "line_number": ":ordinal",
                "line_label": "'TEST-ONLY'",
                "claim": "'TEST-ONLY'",
                "evidence": "'TEST-ONLY'",
            },
        ),
        "reports": _MinimalRow(
            parents={"order_id": "orders"},
            columns={
                "version": ":ordinal",
                "shape": "'TEST-ONLY'",
                "template_version": "'0'",
                "rendered_at": "now()",
                # The cast for `packages.sha256`'s reason — psycopg sends the ordinal
                # as `smallint` and `to_hex` has no `smallint` overload.
                "artifact_digest": "lpad(to_hex(CAST(:ordinal AS integer)), 64, '0')",
                "artifact_uri": "'test-only:///'",
            },
        ),
        "deliveries": _MinimalRow(
            parents={"report_id": "reports"},
            columns={"method": "'TEST-ONLY'", "status": "'draft'"},
        ),
        "delivery_receipt_steps": _MinimalRow(
            parents={"delivery_id": "deliveries"},
            columns={
                "ordinal": ":ordinal",
                "step_key": "'test.only'",
                "what": "'TEST-ONLY'",
                "who": "'TEST-ONLY'",
                # `ck_delivery_receipt_steps_done_records_when` makes `is_done`
                # and `happened_at` one fact; a step not yet taken is the row
                # that needs neither a time nor an actor.
                "is_done": "false",
            },
        ),
        # The golden set (`0070`-`0072`). `value` IS IN THE SPEC EVEN THOUGH THE
        # COLUMN IS NULLABLE, which `seed_insert` warns is the one entry shape
        # that can be lost to a typo — `ck_golden_fields_value_xor_na_reason`
        # requires exactly one of `value` and `na_reason`, so a row with neither
        # is refused and a misspelling here fails as a CHECK violation rather
        # than being silently skipped. `delivered_report` is the tag that asserts
        # least: it is where a golden seed comes from before anybody has ruled on
        # it, and it is the one `tag_before` the `confirm` below can legally
        # follow.
        "golden_fields": _MinimalRow(
            parents={"order_id": "orders"},
            columns={
                "path": "'test.only.' || :ordinal_text",
                "value": "'TEST-ONLY-' || :ordinal_text",
                "tag": "'delivered_report'",
                "source_citation": "'TEST-ONLY'",
                "established_by": "'TEST-ONLY'",
                "established_reason": "'TEST-ONLY'",
            },
        ),
        # `confirm` and not `correct`, because a `correct` row must MOVE the
        # value (`ck_golden_corrections_correction_moves_the_value`) and a seed
        # has no second value to move it to. `tag_after` is `'ruled'` because
        # `ck_golden_corrections_confirm_lands_on_ruled` says a confirm lands
        # there; `value_before` and `value_after` are the same expression because
        # `ck_golden_corrections_affirmation_leaves_the_value_alone` says an
        # affirmation does not touch the value.
        #
        # `revision_after` is `:ordinal` — 1-based and per tenant, so it is
        # positive as `ck_golden_corrections_revision_after_is_positive` requires
        # and distinct per row. It does NOT correspond to any UPDATE: the seed
        # writes ledger rows and never moves a golden value, so `0072`'s trigger
        # is not exercised here. `tests/test_golden_set.py` is what drives it.
        "golden_corrections": _MinimalRow(
            parents={"golden_field_id": "golden_fields"},
            columns={
                "act": "'confirm'",
                "signed_by": "'TEST-ONLY'",
                "reason": "'TEST-ONLY'",
                "source_citation": "'TEST-ONLY'",
                "tag_before": "'delivered_report'",
                "tag_after": "'ruled'",
                "value_before": "'TEST-ONLY-' || :ordinal_text",
                "value_after": "'TEST-ONLY-' || :ordinal_text",
                "revision_after": ":ordinal",
            },
        ),
        "report_verified_checks": _MinimalRow(
            parents={"report_id": "reports"},
            columns={"ordinal": ":ordinal", "sentence": "'TEST-ONLY'"},
        ),
    }
)


def _parent_expression(parent_table: str) -> str:
    """The Nth row of `parent_table` belonging to this tenant, as a scalar.

    `ORDER BY id` rather than an unordered `LIMIT`, because two rows of the same
    child table must reach two DIFFERENT parents deterministically — an
    unordered subquery is free to return the same one twice, and the collision
    it then causes is on a unique constraint several tables away.
    """
    return (
        f"(SELECT id FROM {parent_table} WHERE tenant_id = :{SEED_TENANT} "  # noqa: S608
        f"ORDER BY id OFFSET :{SEED_ORDINAL} - 1 LIMIT 1)"
    )


def seed_insert(table: str, key_column: str, present_columns: Collection[str]) -> str:
    """One complete row for `table`, keyed on `key_column`, `RETURNING id`.

    `key_column` is `tenant_id` for every tenant table and `id` for the registry
    — the seed's own derivation, passed in rather than re-derived here.

    ---------------------------------------------------------------------------
    🔴 `present_columns` IS THE LIVE CATALOG, AND INTERSECTING WITH IT IS A
       REQUIREMENT RATHER THAN A CONVENIENCE.
    ---------------------------------------------------------------------------
    `MINIMAL_ROWS` describes each table AS THE MODELS DECLARE IT. The seed does
    not always run against that schema. `test_forced_rls_and_grants.py::test
    _downgrading_only_0002_removes_every_policy_grant_and_force` downgrades to
    `0001` and seeds THERE, where `orders` has three columns and `fields` has no
    `order_id` at all; the domain migrations land one module at a time, so every
    revision between `0004` and head is a schema some part of this suite runs
    against. A statement naming a column that revision does not have is
    `UndefinedColumn`, MEASURED on this tree against `fields`.

    So a spec entry is a column to write WHERE IT EXISTS. What that costs is
    that a MISSPELLED column name in `MINIMAL_ROWS` is silently skipped rather
    than reported. What still catches it is the database itself: the column it
    was meant to fill is `NOT NULL` — that is why it is in the spec — so the
    insert fails with `null value in column "<name>"`, naming it. A spec entry
    for a nullable column would genuinely be lost, which is the reason not to
    write one.

    🔴 `S608` IS SUPPRESSED, AND WHAT MAKES IT SAFE IS THAT NOTHING
    CALLER-SUPPLIED REACHES THE STRING. `table` and `key_column` come from
    `conftest._isolation_tables`, which reads `pg_class` and refuses any name
    that is not a plain lower-case identifier; every column name and expression
    is a literal in `MINIMAL_ROWS` above. The tenant and the ordinal stay bind
    parameters.

    A table with no entry in `MINIMAL_ROWS` gets the bare tenant insert, which
    is correct for `tenants` and is a LOUD failure for anything else, in the same
    `NOT NULL` shape. This sentence used to name `audit_log` too; `0007` gives it
    eight `NOT NULL` columns and it now has an entry above like any other table.
    """
    spec = MINIMAL_ROWS.get(table, _MinimalRow())
    available = frozenset(present_columns)
    parents = {column: parent for column, parent in spec.parents.items() if column in available}
    columns_ = {
        column: expression for column, expression in spec.columns.items() if column in available
    }
    columns = [key_column, *parents, *columns_]
    values = [
        f":{SEED_TENANT}",
        *(_parent_expression(parent) for parent in parents.values()),
        *columns_.values(),
    ]
    return (
        f"INSERT INTO {table} ({', '.join(columns)}) "  # noqa: S608
        f"VALUES ({', '.join(values)}) RETURNING id"
    )


def seed_order(columns_by_table: Mapping[str, Collection[str]]) -> tuple[str, ...]:
    """`tables`, parents before children, alphabetical within a dependency level.

    The seed used to write in `sorted(...)` order, which was fine while no table
    referenced another and is wrong the moment one does: `documents` sorts before
    `packages` and cannot be written before it.

    Kahn's algorithm over `MINIMAL_ROWS[...].parents`, restricted to the tables
    and COLUMNS actually present. A spec entry for a table no migration has
    created yet contributes no edge, and neither does one whose foreign-key
    column this revision does not have — the same intersection `seed_insert`
    makes, and for the same reason: an edge the insert will not write is an
    ordering constraint that does not exist. Ties break alphabetically so the
    order is a function of the input and not of dictionary iteration.

    A cycle raises rather than silently dropping the tables in it. There is none
    today: `chain_links.prior_link_id` is the only self-reference in the schema
    and it is NULLABLE, so it is not in any spec.
    """
    present = set(columns_by_table)
    pending = {
        table: {
            parent
            for column, parent in MINIMAL_ROWS.get(table, _MinimalRow()).parents.items()
            if parent in present and column in columns_by_table[table]
        }
        # `requires` is unioned in WITHOUT the column filter the line above
        # applies, and the asymmetry is the point: a foreign-key edge that this
        # revision has no column for is not an ordering constraint, and a trigger
        # edge is one whether or not any column mentions it.
        | {
            required
            for required in MINIMAL_ROWS.get(table, _MinimalRow()).requires
            if required in present
        }
        for table in present
    }

    ordered: list[str] = []
    while pending:
        ready = sorted(table for table, parents in pending.items() if not parents)
        if not ready:
            raise RuntimeError(
                f"the minimal-row specs for {sorted(pending)} form a foreign-key cycle, "
                f"so no insert order exists. A cycle can only be written with a "
                f"NULLABLE side, and a nullable column does not belong in a minimal row."
            )
        ordered.extend(ready)
        for table in ready:
            del pending[table]
        for parents in pending.values():
            parents.difference_update(ready)

    return tuple(ordered)

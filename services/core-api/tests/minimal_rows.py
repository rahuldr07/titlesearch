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

import uuid
from collections.abc import Collection, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import MappingProxyType
from typing import Any, Final

from titlepipe_core.db.models import Order


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
_ORDER_SQL_ROW = "gen_random_uuid(), 'TEST-ONLY', 'TEST-ONLY', 'ZZ', 'TEST-ONLY', 'received', now()"


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
    """

    parents: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))
    columns: Mapping[str, str] = field(default_factory=lambda: MappingProxyType({}))


# The bind parameters every expression here may use. `:ordinal` is an int and
# `:ordinal_text` its decimal spelling, and they are two parameters rather than
# one cast because they are consumed by operators with different argument types
# — `to_hex(:ordinal)` wants an integer, `'TEST-ONLY-' || :ordinal_text` wants
# text, and `$1::text` over an integer parameter is a wire-level type mismatch
# rather than a coercion.
SEED_ORDINAL = "ordinal"
SEED_ORDINAL_TEXT = "ordinal_text"
SEED_TENANT = "tenant"

MINIMAL_ROWS: Final[Mapping[str, _MinimalRow]] = MappingProxyType(
    {
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
                "sha256": "lpad(to_hex(:ordinal), 64, '0')",
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
                "artifact_digest": "lpad(to_hex(:ordinal), 64, '0')",
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
    is correct for `tenants` and `audit_log` and is a LOUD failure for anything
    else, in the same `NOT NULL` shape.
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

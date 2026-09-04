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
from datetime import UTC, datetime
from typing import Any, Final

from titlepipe_core.db.models import Order

# Every `NOT NULL` column `0008` adds to `orders`, and nothing else. `client_id`
# is not here because it varies per call — it is a uuid the caller may want to
# match against, where none of these five are ever read back.
_ORDER_REQUIRED: Final[dict[str, Any]] = {
    "external_ref": "TEST-ONLY",
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
        **{**_ORDER_REQUIRED, **overrides},
    )

"""Tenant identity, and the one string PostgreSQL accepts for "no tenant".

Every module that scopes data to a tenant imports from here. Two modules that
each invent their own tenant scoping is a data leak waiting for the day the two
disagree, so this is the single definition: the type, the GUC name, and the
encoding of the GUC's value.

## Two different absences, and what collapses them

The row-level-security policies read the tenant out of a session GUC:

    nullif(current_setting('app.current_tenant', true), '')::uuid

The `true` is `missing_ok`. It changes an error into a value — and *which*
value depends on the connection's history, which is the part that is easy to
get backwards:

* a GUC that has **never been assigned** in this session reads back as **NULL**
* a GUC that has been assigned and has since **reverted** reads back as the
  **empty string**

MEASURED against PostgreSQL 18.4 (Debian 18.4-1.pgdg13+1) on 2026-08-05:

    -- never assigned
    SELECT current_setting('app.current_tenant', true) IS NULL;   --  t

    BEGIN;
      SET LOCAL app.current_tenant = '6f9619ff-8b86-d011-b42d-00c04fc964ff';
    COMMIT;
    -- same session, after the transaction that set it ended
    SELECT current_setting('app.current_tenant', true) IS NULL;   --  f
    SELECT quote_literal(current_setting('app.current_tenant', true));  -- ''

`set_config(…, is_local => true)` measures identically, and that is the form the
session listener uses, so the second case is not a corner: it is every pooled
connection after the first request it serves. `SET LOCAL` reverts at COMMIT to
whatever the GUC held before the transaction, and for a GUC that is in no
configuration file that prior value is `''`. A long-lived connection therefore
sees NULL exactly once and `''` for the rest of its life.

The two absences behave completely differently when cast, which is why the
policy cannot simply cast:

* `NULL::uuid` is NULL. `tenant_id = NULL` is NULL, no row satisfies the
  policy, and the request is **denied** cleanly.
* `''::uuid` **raises** `invalid input syntax for type uuid: ""`. The statement
  aborts — a 500 where a denial was wanted, on the connection that has served
  more than one request.

`nullif(…, '')` is the piece that makes those one thing. It maps the empty
string onto the NULL that the never-assigned case already produces, so both
absences take the deny branch and neither takes the error branch.

MEASURED end to end, `orders` under `FORCE ROW LEVEL SECURITY` with exactly the
policy above, as a non-owner role:

    -- GUC never assigned in this session
    SELECT count(*) FROM orders;                                   --  0
    BEGIN; SET LOCAL app.current_tenant = '<one tenant>';
      SELECT count(*) FROM orders;                                 --  1
    COMMIT;
    -- the pooled-reuse case: same connection, GUC now ''
    SELECT count(*) FROM orders;                                   --  0

So the sentinel is the empty string because that is what the GUC *becomes*, and
the policy wraps it in `nullif` because that is the only thing that makes `''`
behave like the NULL it is standing in for. Neither half works alone.

## Why the value is parsed and not merely annotated

`TenantId` is a `NewType` over `UUID`, and `NewType` is erased at runtime.
`TenantId(x)` is an identity function; nothing checks `x`. The values that reach
this function come from JSON bodies, headers and the ASGI scope — the places
where pyright's knowledge stops and everything is `Any` — so the annotation
below is a claim about the callers, not a property of the argument.

A non-UUID reaching the GUC is the failure `nullif` was introduced to remove,
arriving through the other door. MEASURED against the same policy:

    BEGIN; SET LOCAL app.current_tenant = 'not-a-uuid';
      SELECT count(*) FROM orders;
    ERROR:  invalid input syntax for type uuid: "not-a-uuid"

`nullif` cannot help: the string is neither NULL nor empty, so it reaches the
cast. `"None"` — the accident `str(None)` produces — measures identically:
`nullif('None','')::uuid` raises `invalid input syntax for type uuid: "None"`.
Both turn a missing or malformed tenant into a 500 rather than a denial.

So this function parses instead of trusting. `UUID(str(tenant_id))` either
yields a value the `::uuid` cast is guaranteed to accept, or raises here — one
call before the database, where the caller can still be told which argument was
wrong and no transaction has been aborted.
"""

from __future__ import annotations

from typing import Final, NewType
from uuid import UUID

TenantId = NewType("TenantId", UUID)

# The session GUC the RLS policies read. Named, not spelled out at each call
# site: a typo in a `SET` is silent — the policy simply sees an unset setting
# and denies everything, which reads as a permissions bug rather than a typo.
TENANT_GUC: Final = "app.current_tenant"

# The sentinel for "no tenant established". It is the empty string because that
# is what `current_setting(TENANT_GUC, true)` *becomes* once the GUC has been
# assigned and reverted — NOT what it returns for a session that never assigned
# it, which is NULL. Both are absences; `nullif` is what makes them one. See the
# module docstring, which measures both.
NO_TENANT_GUC_VALUE: Final = ""


def tenant_guc_value(tenant_id: TenantId | None) -> str:
    """Encode a tenant for `SET LOCAL app.current_tenant`.

    `None` means "no tenant established" and encodes to the empty string, which
    the policy's `nullif` turns into NULL and denies on. Never `"None"`.

    Anything else is **parsed**, not trusted. `NewType` is erased at runtime, so
    the annotation above stops nothing; a non-UUID reaching the GUC makes the
    policy's `::uuid` cast abort the statement instead of denying the row. The
    returned string is the canonical UUID rendering, which is what the cast
    accepts.

    Raises:
        ValueError: the argument is neither `None` nor a UUID.
    """
    if tenant_id is None:
        return NO_TENANT_GUC_VALUE
    try:
        canonical = UUID(str(tenant_id))
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError(
            f"tenant id {tenant_id!r} is not a UUID; the RLS policy casts this value "
            "with ::uuid, which aborts the statement rather than denying the row"
        ) from exc
    return str(canonical)

"""Tenant identity, and the one string PostgreSQL accepts for "no tenant".

Every module that scopes data to a tenant imports from here. Two modules that
each invent their own tenant scoping is a data leak waiting for the day the two
disagree, so this is the single definition: the type, the GUC name, and the
encoding of the GUC's value.

## Why the empty string, and not `None` or `"None"`

The row-level-security policies read the tenant out of a session GUC:

    nullif(current_setting('app.current_tenant', true), '')::uuid

`current_setting(..., true)` yields the empty string when the setting has never
been assigned in this session, so `''` is already the value the policy must
survive. Proven against PostgreSQL 18.4 on 2026-08-05:

* `''::uuid` raises `invalid input syntax for type uuid: ""` — an unset GUC
  would abort the statement instead of denying the row.
* `nullif('', '')::uuid` is NULL, and `tenant_id = NULL` is NULL, so every row
  is filtered. The request is denied cleanly rather than erroring.

That is why the sentinel is the empty string **and** why the policy wraps it in
`nullif`: neither half works alone. `"None"` — the accident you get from
`str(None)` — is neither a uuid nor empty, so it takes the erroring branch and
turns a missing tenant into a 500 rather than a denial. This function exists so
that accident cannot be written.

`TenantId` wraps `UUID` rather than `str` because the policy casts to `uuid`.
A string-typed tenant can hold a value that only fails at the database, one
statement after the point where it could still have been rejected.
"""

from __future__ import annotations

from typing import Final, NewType
from uuid import UUID

TenantId = NewType("TenantId", UUID)

# The session GUC the RLS policies read. Named, not spelled out at each call
# site: a typo in a `SET` is silent — the policy simply sees an unset setting
# and denies everything, which reads as a permissions bug rather than a typo.
TENANT_GUC: Final = "app.current_tenant"

# What `current_setting(TENANT_GUC, true)` returns for a session that never set
# it, and therefore what "no tenant" must encode to. See the module docstring.
NO_TENANT_GUC_VALUE: Final = ""


def tenant_guc_value(tenant_id: TenantId | None) -> str:
    """Encode a tenant for `SET LOCAL app.current_tenant`.

    `None` means "no tenant established" and encodes to the empty string, which
    the policy's `nullif` turns into NULL and denies on. Never `"None"`.
    """
    if tenant_id is None:
        return NO_TENANT_GUC_VALUE
    return str(tenant_id)

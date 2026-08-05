"""The tenant GUC encoding.

Every RLS policy in the system reads one setting and every session writes it
through one function. These tests pin the two values that function may produce,
because both of them are load-bearing in the database and neither is obvious
from reading the call site.
"""

from __future__ import annotations

from uuid import UUID

from titlepipe_domain import TENANT_GUC, TenantId, tenant_guc_value

# Fixed rather than generated: the assertion is about the exact text handed to
# `SET LOCAL`, so the expected string has to be readable in the test.
A_TENANT = TenantId(UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff"))


def test_no_tenant_encodes_to_the_empty_string() -> None:
    """`nullif('', '')::uuid` is NULL and denies every row.

    `''::uuid` on its own raises `invalid input syntax for type uuid: ""`
    (PostgreSQL 18.4), so the empty string only works because the policy wraps
    it in `nullif` — and nothing else works at all.
    """
    assert tenant_guc_value(None) == ""


def test_no_tenant_never_encodes_to_the_string_None() -> None:
    """The accident this function exists to prevent.

    `str(None)` is `"None"`, which is neither a uuid nor empty. It takes
    `nullif`'s non-null branch, fails the `::uuid` cast, and converts a missing
    tenant from a clean denial into a 500.
    """
    assert tenant_guc_value(None) != "None"


def test_a_tenant_encodes_to_its_uuid() -> None:
    """Without this, a function returning `""` unconditionally would satisfy
    every other test in this file while isolating nobody."""
    assert tenant_guc_value(A_TENANT) == "6f9619ff-8b86-d011-b42d-00c04fc964ff"
    assert UUID(tenant_guc_value(A_TENANT)) == A_TENANT


def test_the_guc_name_is_the_one_the_policies_read() -> None:
    """The policies say `current_setting('app.current_tenant', true)` literally.
    A rename here without a migration denies every row in the system."""
    assert TENANT_GUC == "app.current_tenant"

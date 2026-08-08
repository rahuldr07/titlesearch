"""The tenant GUC encoding.

Every RLS policy in the system reads one setting and every session writes it
through one function. These tests pin the values that function may produce and
the values it must refuse, because all of them are load-bearing in the database
and none is obvious from reading the call site.
"""

from __future__ import annotations

from typing import cast
from uuid import UUID

import pytest

from titlepipe_domain import TENANT_GUC, TenantId, tenant_guc_value

# Fixed rather than generated: the assertion is about the exact text handed to
# `SET LOCAL`, so the expected string has to be readable in the test.
A_TENANT = TenantId(UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff"))


def from_an_untyped_boundary(value: object) -> TenantId:
    """What `NewType` erasure looks like where the values actually come from.

    A tenant id arrives in a JSON body, a header or the ASGI scope. Every one of
    those is `Any` to pyright, so `TenantId(...)` at the boundary type-checks on
    anything at all and, being a `NewType`, checks nothing at runtime either.
    This helper is that hole, written down, so the negative cases below are
    honest about how the bad value gets in rather than looking like a test that
    is deliberately misusing its own API.
    """
    return cast(TenantId, value)


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
    tenant from a clean denial into a 500. MEASURED on PostgreSQL 18.4:
    `nullif('None','')::uuid` → `ERROR: invalid input syntax for type uuid:
    "None"`.
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


# --- the values that must not reach the GUC ---------------------------------
#
# `TenantId` is a `NewType`, so none of these is a type error at runtime and
# only the first is even a type error to pyright at a typed call site. The
# annotation is a claim about callers; this is the check.


@pytest.mark.parametrize(
    ("value", "why"),
    [
        ("not-a-uuid", "a free-text identifier from a header or a query string"),
        ("None", "str(None) — the accident the empty-string sentinel exists to avoid"),
        ("", "an empty string is the *sentinel*, and must not arrive as an id"),
        ("6f9619ff-8b86-d011-b42d-00c04fc964f", "one hex digit short of a UUID"),
        (0, "a JSON number where an id was expected"),
        (["6f9619ff-8b86-d011-b42d-00c04fc964ff"], "a JSON array of one"),
        ({"id": "6f9619ff-8b86-d011-b42d-00c04fc964ff"}, "a JSON object of one"),
    ],
)
def test_a_value_that_is_not_a_uuid_is_refused_here_and_not_by_postgres(
    value: object, why: str
) -> None:
    """MEASURED on PostgreSQL 18.4, with the real policy on a FORCE RLS table:

        BEGIN; SET LOCAL app.current_tenant = 'not-a-uuid';
          SELECT count(*) FROM orders;
        ERROR:  invalid input syntax for type uuid: "not-a-uuid"

    That is an aborted statement, not a denied row — the same 500 that `nullif`
    was introduced to eliminate, arriving through a different door. `nullif`
    cannot help, because the value is neither NULL nor empty and reaches the
    cast. Refusing at the encoder is one call earlier, in a place where the
    caller can still be told which argument was wrong.
    """
    with pytest.raises(ValueError, match="is not a UUID"):
        tenant_guc_value(from_an_untyped_boundary(value))

    assert why


def test_the_refusal_names_the_reason_the_database_would_have_failed() -> None:
    """A bare `badly formed hexadecimal UUID string` from the stdlib says what
    the parser saw and nothing about why anyone cares. The reason this is fatal
    — the policy casts with `::uuid` — belongs in the message, because that is
    what tells the reader it is a denial-vs-500 problem and not a formatting
    nit. The original is chained, so nothing is lost."""
    with pytest.raises(ValueError, match="is not a UUID") as raised:
        tenant_guc_value(from_an_untyped_boundary("not-a-uuid"))

    assert "::uuid" in str(raised.value)
    assert isinstance(raised.value.__cause__, ValueError)


@pytest.mark.parametrize(
    "spelling",
    [
        "6f9619ff-8b86-d011-b42d-00c04fc964ff",
        "6F9619FF-8B86-D011-B42D-00C04FC964FF",
        "6f9619ff8b86d011b42d00c04fc964ff",
        "{6f9619ff-8b86-d011-b42d-00c04fc964ff}",
        "urn:uuid:6f9619ff-8b86-d011-b42d-00c04fc964ff",
    ],
)
def test_every_accepted_spelling_normalises_to_the_one_the_policy_compares(
    spelling: str,
) -> None:
    """`UUID` accepts five renderings and `tenant_id = <value>::uuid` compares
    the parsed value, so all five are correct at the database. They are
    normalised anyway: the GUC's contents show up in logs and in
    `pg_settings`, and one tenant with five spellings is five things to grep
    for when a leak is being investigated."""
    assert tenant_guc_value(from_an_untyped_boundary(spelling)) == (
        "6f9619ff-8b86-d011-b42d-00c04fc964ff"
    )

"""The app role cannot promote a seat, executed rather than asserted from a catalog.

`test_forced_rls_and_grants.py::test_the_narrowed_update_grant_is_exactly_the
_named_columns` reads `has_column_privilege` and `acl_contract.py` compares the
whole catalog to a literal. Both are true of `pg_attribute.attacl`; neither runs
the statement. This file runs it, as `titlepipe_app`, against a row of its OWN
tenant, which is the shape the attack has.

🔴 WHAT WAS TRUE AT `0102`, MEASURED against postgres:18.4 on 2026-09-08:

    SET ROLE titlepipe_app;
    SET app.current_tenant = '1111…';
    UPDATE users SET role = 'admin' WHERE email = 'ada@example.test';
    -- UPDATE 1
    UPDATE users SET identity_subject = 'somebody-elses-workos-id' WHERE …;
    -- UPDATE 1

`tenant_isolation` was never a defence against this and was not meant to be. The
row a seat promotes is its own, so it is inside the policy; RLS decides WHOSE
rows a session may touch and has no opinion about which COLUMN of a permitted
row is written. `0120` is the narrowing, and this is the statement it refuses.

THE POSITIVE CONTROL IS NOT OPTIONAL HERE. A revision that revoked UPDATE on
`users` outright would pass every refusal below and leave no way to retire a
seat, so `deactivated_at` and `email` are asserted to still work in the same
session that is refused `role`.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Final
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from titlepipe_core.db import make_engine, make_sessionmaker, tenant_session
from titlepipe_domain import TenantId

# `42501`. Named rather than spelled at each assertion, and asserted rather than
# "it raised": the ACL refusal and the policy refusal share this code, so the
# message fragment below is what tells them apart.
INSUFFICIENT_PRIVILEGE: Final = "42501"

# The fragment PostgreSQL uses when the refusal is the ACL's. `test_tenant
# _isolation.py::ACL_REFUSAL_FRAGMENT` holds the same measurement for the same
# reason — a policy refusal reported as an ACL refusal is a test that has stopped
# describing what it names.
ACL_REFUSAL_FRAGMENT: Final = "permission denied for table"

# 🔴 THE THREE COLUMNS AN ATTACKER WANTS, AND EACH IS A DIFFERENT ATTACK.
#
# `role` promotes the seat directly. The other two do it without touching
# `role` at all: `identity_subject` repoints a row at another person's provider
# id, so the NEXT sign-in by that person resolves to a row of the attacker's
# choosing, and `identity_provider` does the same across vendors. The unique
# constraint `uq_users_tenant_id_identity_provider_identity_subject` refuses a
# DUPLICATE pair, not a stolen one.
ESCALATION_COLUMNS: Mapping[str, str] = {
    "role": "'admin'",
    "identity_subject": "'somebody-elses-provider-id'",
    "identity_provider": "'somebody-elses-vendor'",
}

# Writable, and each is a write this system actually has. See `0120`.
PERMITTED_COLUMNS: Mapping[str, str] = {
    "deactivated_at": "now()",
    "email": "'retired-' || id::text || '@test-only.invalid'",
}


async def _update_one_column(dsn: str, tenant: UUID, column: str, value: str) -> str | None:
    """Run `UPDATE users SET <column> = <value>` for one tenant. `None` on success.

    Returns the SQLSTATE and message joined, so a caller asserts on the refusal
    rather than on the fact of one. The success cases run inside
    `tenant_session`, whose transaction is not committed.

    🔴 ONE ROW, AND THE `WHERE` IS LOAD-BEARING. MEASURED 2026-09-08 with `0120`
    neutered: the unqualified form writes both of tenant A's seeded rows, so
    `identity_subject` collides with `uq_users_tenant_id_identity_provider
    _identity_subject` and is refused `23505`. That is the constraint refusing a
    DUPLICATE, not the schema refusing a takeover — and a test whose red came
    from it would have reported the escalation as already closed. The subselect
    is filtered by `tenant_isolation` like every other read, so the row is the
    caller's own, which is the attack's shape.

    A refusal is still not an accident of matching no rows: privilege is checked
    before any row is examined, so `42501` arrives whatever the `WHERE` finds.

    `column` and `value` are module literals from the two mappings above and
    never a caller's string; there is no bind-parameter form for a SET target.
    """
    statement = (
        f"UPDATE users SET {column} = {value} "  # noqa: S608
        f"WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)"
    )
    engine = make_engine(dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(tenant)) as session:
            try:
                await session.execute(text(statement))
            except DBAPIError as refusal:
                code = getattr(refusal.orig, "sqlstate", None)
                return f"{code}: {refusal.orig}"
            return None
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("column", sorted(ESCALATION_COLUMNS))
async def test_the_app_role_cannot_rewrite_a_seats_authority_in_its_own_tenant(
    column: str,
    app_dsn: str,
    isolation_seed: Mapping[str, Mapping[UUID, tuple[UUID, ...]]],
    isolation_tenant_a: UUID,
) -> None:
    """🔴 THE ESCALATION, REFUSED. `42501`, from the ACL and not from the policy.

    `auth/dependencies.require_seat` ends with "`seat.role` AND NOT ANYTHING THE
    REQUEST SAID", and both provider adapters throw the vendor's role claims away
    so the `users` row is the only authority. All of that was true at `0102` and
    none of it mattered: the role had stopped coming off the wire and started
    coming out of a table the wire could edit.

    The seed is taken so the table is not empty. It changes nothing about the
    outcome — privilege is checked before rows are — and that is exactly why it
    is here: a refusal from an empty table would prove the same thing about a
    schema that had lost the grant entirely.
    """
    assert isolation_seed["users"][isolation_tenant_a], (
        "the seed committed no users row for tenant A, so a refusal below would "
        "be a statement about an empty table"
    )

    refusal = await _update_one_column(
        app_dsn, isolation_tenant_a, column, ESCALATION_COLUMNS[column]
    )

    assert refusal is not None, (
        f"titlepipe_app rewrote users.{column} for a row of its own tenant. This "
        f"is what 0120 revoked and what 0102 allowed — MEASURED there as "
        f"UPDATE 1."
    )
    assert refusal.startswith(INSUFFICIENT_PRIVILEGE), (
        f"the UPDATE was refused with {refusal}, not {INSUFFICIENT_PRIVILEGE}. A "
        f"CHECK or a trigger refusing this would be a different mechanism wearing "
        f"the same outcome, and would not survive the row being shaped differently."
    )
    assert ACL_REFUSAL_FRAGMENT in refusal, (
        f"the refusal was {refusal}, which is 42501 from the POLICY rather than "
        f"from the ACL. A policy refusal means the session is not established for "
        f"this tenant, and this test would then prove nothing about the column."
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("column", sorted(PERMITTED_COLUMNS))
async def test_the_app_role_can_still_retire_a_seat_and_follow_an_address_change(
    column: str,
    app_dsn: str,
    isolation_seed: Mapping[str, Mapping[UUID, tuple[UUID, ...]]],
    isolation_tenant_a: UUID,
) -> None:
    """THE POSITIVE CONTROL. Without it every refusal above is satisfied by a
    revision that revoked UPDATE on `users` and granted nothing back.

    `0020` records that a seat is retired by writing `deactivated_at`, which is
    the only seat-lifecycle write this system has; `email` follows an address
    the person changed at the provider, and is safe because a seat is found by
    `(provider, organization, subject)` and never by address.
    """
    assert isolation_seed["users"][isolation_tenant_a]

    refusal = await _update_one_column(
        app_dsn, isolation_tenant_a, column, PERMITTED_COLUMNS[column]
    )

    assert refusal is None, (
        f"titlepipe_app cannot write users.{column}, so 0120 narrowed the grant "
        f"past what the system needs: {refusal}"
    )

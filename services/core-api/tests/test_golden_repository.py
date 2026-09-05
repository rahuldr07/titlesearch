"""`GoldenRepository` writes the two rows in the one order `0072` accepts.

---------------------------------------------------------------------------
🔴 WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY DOES NOT RE-TEST.
---------------------------------------------------------------------------
`tests/test_golden_set.py` proves the refusals: the CHECK constraints, the
append-only ledger, and `0072`'s requirement that a signed row describe any
change to a golden value. It drives them as the container superuser, with raw
SQL, because a constraint answers a superuser like anybody else.

None of that says the APPLICATION can write a correction at all. The ordering
`0072` forces — ledger row first, move second, one transaction — is exactly the
kind of thing that is obviously right in a docstring and wrong in the code, and
the failure shape is a repository that raises `0A000` on every correction it is
asked to make.

So this file is the positive control for the write path, made as
`titlepipe_app` through `tenant_session`, which is the connection a request
actually gets:

* `establish` writes a golden field the session's own tenant can read back;
* `record_act` moves the value and lands a permanent ledger row beside it;
* a second act on the same field works, which is what says `revision` is being
  advanced rather than assumed to be 1;
* and the negative control — a bare UPDATE through the same session, with no
  ledger row — is refused, so the tests above cannot be passing because the
  trigger is missing.

## Why `titlepipe_app` and not the superuser here

`0072`'s trigger runs `SECURITY INVOKER`, so its `SELECT` against
`golden_corrections` is filtered by that table's policy on the caller's own
session. A superuser bypasses RLS and would see the ledger row whatever the GUC
said; `titlepipe_app` inside `tenant_session` sees it because the tenant is
established. That is the path a request takes, and it is the one worth proving.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

import pytest
from sqlalchemy import Engine, select, text
from sqlalchemy.exc import DBAPIError

from titlepipe_core.db import GoldenRepository, make_engine, make_sessionmaker, tenant_session
from titlepipe_core.db.golden_models import GoldenCorrection, GoldenField
from titlepipe_domain import TenantId

# The same literal `test_tenant_session.py`, `test_rule_repository.py` and
# `test_forced_rls_and_grants.py` use, and for their stated reason: a reader
# moving between the files should not have to work out whether a different uuid
# means something.
TENANT = UUID("11111111-1111-1111-1111-111111111111")

FEATURE_NOT_SUPPORTED_SQLSTATE = "0A000"


@pytest.fixture
def seeded_order(migrated_database: str, seam_engine: Callable[[str], Engine]) -> UUID:
    """One committed `orders` row for `TENANT`, written as the superuser.

    Committed, because every assertion below runs on a DIFFERENT connection and an
    uncommitted parent is invisible to it — `golden_fields`' composite foreign key
    would then refuse every insert in this file for a reason that has nothing to
    do with what is being tested.

    The golden tables are emptied first rather than the orders table: an
    `orders` row cannot be deleted while a golden field references it, and
    `golden_corrections` cannot be deleted at all — `0071`'s trigger refuses it,
    superuser included. So this fixture writes a FRESH order every time and
    leaves the previous rows where they are, which is what an append-only table
    means in a test as much as in production.

    THE ROW IS READ BACK. A fixture that silently wrote nothing would turn every
    test below into a foreign-key failure several screens from the reason.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            order_id = UUID(
                str(
                    connection.execute(
                        text("INSERT INTO orders (tenant_id) VALUES (:tenant) RETURNING id"),
                        {"tenant": TENANT},
                    ).scalar_one()
                )
            )
    finally:
        engine.dispose()
    return order_id


async def _establish(repository: GoldenRepository, order_id: UUID, path: str) -> GoldenField:
    """One complete establishment. Every required thing is named, none is defaulted.

    A function that CALLS `establish` rather than one that returns a `**kwargs`
    dictionary: a `dict[str, object]` unpacked into a typed signature is `object`
    against `str` at every parameter, and pyright reports nine errors per call
    site. Spelling the call once here keeps the types and keeps the one place
    that knows what a complete row looks like.
    """
    return await repository.establish(
        tenant_id=TENANT,
        order_id=order_id,
        path=path,
        value="Lot 7, Block 2",
        na_reason=None,
        tag="delivered_report",
        source_citation="delivered report v1, page 3",
        established_by="TEST-ONLY reviewer",
        established_reason="seeded from the delivered report",
    )


@pytest.mark.asyncio
async def test_a_golden_field_is_established_and_readable_by_its_own_tenant(
    seeded_order: UUID, app_dsn: str
) -> None:
    """The plainest thing the repository does, through the connection a request gets.

    Read back inside a SECOND `tenant_session` on the same engine, not from the
    object that was written: the point is that the row reached the database and is
    visible through a policy, not that a Python object holds the values it was
    given.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            established = await _establish(
                GoldenRepository(session), seeded_order, "test.only.established"
            )
            field_id = established.id

        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            read_back = await GoldenRepository(session).get(field_id)
            found = (
                None
                if read_back is None
                else (read_back.value, read_back.na_reason, read_back.tag, read_back.revision)
            )
    finally:
        await engine.dispose()

    assert found == ("Lot 7, Block 2", None, "delivered_report", 0), (
        f"the established golden field read back as {found!r}. `revision` must be "
        f"0 — a new truth is the establishment, and every number above it is a "
        f"correction that needs a signed ledger row."
    )


@pytest.mark.asyncio
async def test_a_correction_moves_the_value_and_leaves_a_permanent_ledger_row(
    seeded_order: UUID, app_dsn: str
) -> None:
    """🔴 THE ORDERING TEST. Ledger row first, move second, one transaction.

    If `record_act` flushed once, or wrote the move first, or committed between
    the two, this fails with `0A000` — `0072`'s trigger would find no ledger row
    describing the transition, because the row would not have reached the server
    yet or would be in a different transaction.

    Both halves are asserted: the truth moved, AND the ledger row is there with
    the signature, the reason and the citation on it. A correction that landed
    with no record is exactly the hole `0072` exists to close, and asserting only
    the new value would not see it.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            repository = GoldenRepository(session)
            field = await _establish(repository, seeded_order, "test.only.corrected")
            await repository.record_act(
                field,
                act="correct",
                signed_by="TEST-ONLY reviewer",
                reason="the deed reads Lot 8",
                source_citation="deed book 44, page 12",
                value="Lot 8, Block 2",
                na_reason=None,
                tag="ruled",
            )
            field_id = field.id

        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            moved = await GoldenRepository(session).get(field_id)
            truth = (
                None
                if moved is None
                else (moved.value, moved.tag, moved.source_citation, moved.revision)
            )
            ledger = list(
                (
                    await session.scalars(
                        select(GoldenCorrection).where(GoldenCorrection.golden_field_id == field_id)
                    )
                ).all()
            )
    finally:
        await engine.dispose()

    assert truth == ("Lot 8, Block 2", "ruled", "deed book 44, page 12", 1), (
        f"the corrected golden field reads {truth!r}"
    )

    signatures = [
        (row.act, row.signed_by, row.reason, row.source_citation, row.revision_after)
        for row in ledger
    ]
    assert signatures == [
        ("correct", "TEST-ONLY reviewer", "the deed reads Lot 8", "deed book 44, page 12", 1)
    ], f"the correction left {signatures!r} behind rather than one signed row"


@pytest.mark.asyncio
async def test_a_second_act_advances_the_revision_rather_than_repeating_it(
    seeded_order: UUID, app_dsn: str
) -> None:
    """Two acts on one field, which is what says `revision` is READ rather than assumed.

    `record_act` computes `field.revision + 1`. A hardcoded 1 passes the previous
    test and fails here — the second ledger row would collide with the first on
    `uq_golden_corrections_tenant_id_golden_field_id_revision_after`, and `0072`
    would refuse the move for advancing revision by zero.

    The second act is a `demote`, which is also the one place in this file where
    the endpoint's own sentence is exercised end to end: "the document is
    ambiguous; tag -> `suspect`", and an affirmation leaves the value alone.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            repository = GoldenRepository(session)
            field = await _establish(repository, seeded_order, "test.only.twice")
            await repository.record_act(
                field,
                act="correct",
                signed_by="TEST-ONLY reviewer",
                reason="the deed reads Lot 8",
                source_citation="deed book 44, page 12",
                value="Lot 8, Block 2",
                na_reason=None,
                tag="ruled",
            )
            await repository.record_act(
                field,
                act="demote",
                signed_by="TEST-ONLY senior",
                reason="the page is water damaged and the lot number is a guess",
                source_citation="deed book 44, page 12",
                value="Lot 8, Block 2",
                na_reason=None,
                tag="suspect",
            )
            field_id = field.id

        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            after = await GoldenRepository(session).get(field_id)
            state = None if after is None else (after.value, after.tag, after.revision)
            revisions = sorted(
                (
                    await session.scalars(
                        select(GoldenCorrection.revision_after).where(
                            GoldenCorrection.golden_field_id == field_id
                        )
                    )
                ).all()
            )
    finally:
        await engine.dispose()

    assert state == ("Lot 8, Block 2", "suspect", 2), (
        f"after a correction and a demote the field reads {state!r}. The demote "
        f"must not have moved the value — an affirmation that quietly changed it "
        f"is a correction with no correction record."
    )
    assert revisions == [1, 2], f"the ledger holds revisions {revisions!r}, not [1, 2]"


@pytest.mark.asyncio
async def test_the_same_session_cannot_move_a_golden_value_without_the_repository(
    seeded_order: UUID, app_dsn: str
) -> None:
    """🔴 THE NEGATIVE CONTROL, ON THE SAME CONNECTION AS THE POSITIVE ONES.

    Without this, every test above is equally satisfied by a database whose
    trigger is missing, disabled, or at `tgenabled = 'O'` — they would pass just
    as happily if nothing were enforcing the ledger at all.

    A bare UPDATE through `tenant_session`, as `titlepipe_app`, with the tenant
    established and the `UPDATE` grant held. Everything is in order except that
    nothing signed the change, and that is the whole reason it is refused.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            field = await _establish(GoldenRepository(session), seeded_order, "test.only.unsigned")
            field_id = field.id

        async with tenant_session(sessionmaker, TenantId(TENANT)) as session:
            with pytest.raises(DBAPIError) as raised:
                await session.execute(
                    text(
                        "UPDATE golden_fields SET value = 'Lot 8, Block 2', revision = 1 "
                        "WHERE id = :id"
                    ),
                    {"id": field_id},
                )
            await session.rollback()
    finally:
        await engine.dispose()

    sqlstate = getattr(raised.value.orig, "sqlstate", None)
    assert sqlstate == FEATURE_NOT_SUPPORTED_SQLSTATE, (
        f"an unsigned change to ground truth returned {sqlstate!r} rather than "
        f"the trigger's {FEATURE_NOT_SUPPORTED_SQLSTATE}: {raised.value}"
    )
    assert "signs this change" in str(raised.value), (
        f"{FEATURE_NOT_SUPPORTED_SQLSTATE} came back from something other than "
        f"the ledger requirement: {raised.value}"
    )

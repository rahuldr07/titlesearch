"""`OrderQueueRepository.next_for_handover` against a real database.

## What this file is for, and what `test_rule_repository.py` already holds

The base's refusal, the identity-map technique, and the argument for why a
repository must not open its own session are all `test_rule_repository.py`'s and
are not re-argued. What is unproven without this file is the part that is
specific to a TENANT table and to a queue:

1. the head of the queue is the OLDEST order, with `id` breaking the tie —
   measured against every wrong `ORDER BY` the implementation could carry;
2. the head is the oldest order **this tenant may see**, not the oldest order in
   the table. The seed makes the other tenant's row the oldest row overall, so a
   repository that lost its scoping returns it and this file names the row;
3. an empty queue is `None` and is not an error.

## The seed is built so that four wrong statements each return a different row

Three orders for tenant A and one for tenant B, with `created_at` and `id`
supplied rather than defaulted so that the expectation below is a literal rather
than something sorted in Python out of what the seed returned —
`test_rule_repository.py::_seed_rulebook` records why an expectation derived
from the thing under test asserts only internal consistency.

    seed order (as inserted)   id     created_at
      A_NEWEST                 aaaa   T1        the LOWEST id, deliberately
      A_TIED_HIGHER_ID         cccc   T0
      A_TIED_LOWER_ID          bbbb   T0        <- the head
      B_OLDEST                 eeee   T_MINUS   another tenant's, and older

    order_by()                     -> aaaa   the heap: insertion order
    order_by(id)                   -> aaaa   A_NEWEST holds the lowest id
    order_by(created_at)           -> cccc   the T0 tie unbroken, heap order
    order_by(created_at.desc())    -> aaaa
    no tenant scoping              -> eeee   B's row is the oldest in the table
    order_by(created_at, id)       -> bbbb   this

`A_NEWEST` holds the LOWEST id on purpose: with the ids assigned in time order,
`ORDER BY id` alone and `ORDER BY created_at, id` return the same row and the
first key would be unproven.

The two `T0` rows are what make the `id` tiebreak observable AT THE HEAD.
`db/repositories/queue.py` argues why the tiebreak is not decoration and
`db/repositories/rules.py::list_all` carries the measurement behind the habit;
neither is re-taken here. What matters for this file is that `ORDER BY
created_at` alone has a CHOICE to make between `bbbb` and `cccc`, and that the
choice PostgreSQL makes on a small freshly-written heap is scan order — so the
mutation above is red rather than flaky today. It is not red because the
database promises anything about ties; it is red because there is no promise at
all, which is the defect.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from typing import Final, NamedTuple
from uuid import UUID

import pytest
from minimal_rows import insert_order
from sqlalchemy import Engine, text
from sqlalchemy.ext.asyncio import create_async_engine

from titlepipe_core.db import make_engine, make_sessionmaker, tenant_session
from titlepipe_core.db.repositories.queue import OrderQueueRepository
from titlepipe_domain import TenantId

# The same two literals `test_rule_repository.py`, `test_tenant_session.py` and
# `test_forced_rls_and_grants.py` use, for the reason all three give: a reader
# moving between the files should not have to work out whether a different uuid
# means something.
TENANT_ONE: Final = TenantId(UUID("11111111-1111-1111-1111-111111111111"))
TENANT_TWO: Final = TenantId(UUID("22222222-2222-2222-2222-222222222222"))

# A tenant the seed writes NOTHING for. Its queue is empty because it has no
# rows, not because a policy hid them, which is the only way to state the empty
# case without also asserting the isolation one.
TENANT_WITH_NO_ORDERS: Final = TenantId(UUID("33333333-3333-3333-3333-333333333333"))

A_NEWEST: Final = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
A_TIED_LOWER_ID: Final = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
A_TIED_HIGHER_ID: Final = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
B_OLDEST: Final = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")

# `timestamptz` values, explicit and UTC. `T_TIE` twice is the whole point of the
# seed; `T_LATER` is after it and `T_EARLIER` is before both, on the row that
# belongs to the other tenant.
T_EARLIER: Final = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
T_TIE: Final = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
T_LATER: Final = datetime(2026, 9, 1, 0, 0, tzinfo=UTC)

# `(id, tenant, created_at)`, IN THE ORDER THE SEED WRITES THEM, which is not the
# order any single sort key produces.
SEED_ROWS: Final = (
    (A_NEWEST, TENANT_ONE, T_LATER),
    (A_TIED_HIGHER_ID, TENANT_ONE, T_TIE),
    (A_TIED_LOWER_ID, TENANT_ONE, T_TIE),
    (B_OLDEST, TENANT_TWO, T_EARLIER),
)

EXPECTED_HEAD: Final = A_TIED_LOWER_ID
SEEDED_ORDERS: Final = 4
SEEDED_FOR_TENANT_ONE: Final = 3

# For the one test that needs an async engine and no server. Same literal and
# same reason as `test_rule_repository.py`: `create_async_engine` resolves the URL
# and builds the pool eagerly but does not connect, so a test that accidentally
# starts connecting fails loudly instead of reaching anything real.
UNREACHABLE_DSN: Final = "postgresql+psycopg://nobody@127.0.0.1:1/none"

# The clause the base raises for a TENANT table. It must be this one and not the
# rulebook's: `db/repositories/base.py`'s comment above `_UNSCOPED_SESSION`
# records the rendering that told a caller over a tenant table that a session at
# the deny sentinel was a fine thing to open.
TENANT_TABLE_CLAUSE: Final = "Name the tenant this unit of work is for."

# The `default` for a tenant the seed wrote nothing for. Named rather than a
# bare `frozenset()` at each call site, which pyright infers as
# `frozenset[Unknown]` under strict mode.
_NO_ROWS: Final[frozenset[UUID]] = frozenset()


class SeededQueue(NamedTuple):
    """What the seed wrote, read back on the admin connection.

    `by_tenant` is `tenant -> {order ids}` as the SUPERUSER sees it, which
    bypasses row-level security unconditionally. That makes it a statement about
    what is IN the table rather than about what a policy permits, and it is the
    premise every assertion below stands on — `test_rule_repository.py`'s fixture
    records at length why an equality between two things a broken seed left empty
    is not a proof of anything.
    """

    by_tenant: Mapping[UUID, frozenset[UUID]]


@pytest.fixture
def seeded_queue(migrated_database: str, seam_engine: Callable[[str], Engine]) -> SeededQueue:
    """`SEED_ROWS`, committed, as the superuser, with the floors asserted here.

    COMMITTED rather than rolled back because the reader is a different
    connection — an `AsyncEngine` of its own — and an uncommitted row is invisible
    to it.

    `DELETE` first, so the table's contents are a function of this call rather
    than of whatever module ran before it. `orders` carries no append-only
    trigger, unlike `audit_log`.

    The floors are asserted in the FIXTURE and not in the tests, so a seed that
    silently wrote nothing is reported as a setup ERROR naming this function
    rather than as four green tests. Every assertion in this file has the shape
    "the repository returned X", and `None == None` is true.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM orders"))
            for row_id, tenant, created_at in SEED_ROWS:
                connection.execute(
                    # The three columns this module asserts on are named; the six
                    # `NOT NULL` columns `0008` added after this file was written
                    # come from `minimal_rows`, which is the one place that knows
                    # what a complete order is.
                    text(insert_order("id", "tenant_id", "created_at")),
                    {"id": row_id, "tenant_id": tenant, "created_at": created_at},
                )
        with engine.connect() as connection:
            present = connection.execute(text("SELECT tenant_id, id FROM orders")).all()
    finally:
        engine.dispose()

    by_tenant: dict[UUID, set[UUID]] = {}
    for tenant_value, id_value in present:
        by_tenant.setdefault(UUID(str(tenant_value)), set()).add(UUID(str(id_value)))

    written = sum(len(ids) for ids in by_tenant.values())
    assert written == SEEDED_ORDERS, (
        f"the seed left {written} rows in `orders`, not {SEEDED_ORDERS}. Every assertion in this "
        f"file is about which of these rows comes back first, and a table holding fewer than four "
        f"cannot distinguish the orderings this module exists to tell apart. saw={by_tenant}"
    )
    assert by_tenant.get(TENANT_ONE, _NO_ROWS) == {
        A_NEWEST,
        A_TIED_HIGHER_ID,
        A_TIED_LOWER_ID,
    }, (
        f"tenant one holds {sorted(by_tenant.get(TENANT_ONE, _NO_ROWS))}, which is not the "
        f"three rows the seed wrote for it. The tie at the head is what makes the `id` key "
        f"observable; without both T_TIE rows present, `ORDER BY created_at` alone passes."
    )
    assert by_tenant.get(TENANT_TWO, _NO_ROWS) == {B_OLDEST}, (
        f"tenant two holds {sorted(by_tenant.get(TENANT_TWO, _NO_ROWS))}, not {{{B_OLDEST}}}. "
        f"That row is the OLDEST in the whole table and is the entire isolation control: without "
        f"it, 'the head belongs to tenant one' is satisfied by a table with one tenant in it."
    )
    return SeededQueue(by_tenant={tenant: frozenset(ids) for tenant, ids in by_tenant.items()})


@pytest.mark.asyncio
async def test_the_head_is_the_oldest_order_with_the_id_breaking_the_tie(
    app_dsn: str, seeded_queue: SeededQueue
) -> None:
    """FIFO, total, and read through the session that carries the tenant.

    The module docstring tabulates what each wrong `ORDER BY` returns; this
    asserts the one that is right, by ID, naming the row.

    🔴 AND THE ROW MUST BE IN THE SCOPED SESSION'S IDENTITY MAP.
    `TenantRepository.__init__`'s refusal is a CONSTRUCTION-TIME check that can
    see the session it is handed and nothing about what `next_for_handover` does
    afterwards. `test_rule_repository.py` measured the injection — a method that
    builds its own sessionmaker off the same engine — and recorded that every
    other assertion in that file passed under it. Here it would not merely be a
    wiring defect: a session opened outside `tenant_session` establishes NO
    tenant, sits at the deny sentinel, and reads zero rows, so the injection is
    caught by this test's first assertion as well. The identity-map check is kept
    because that is an accident of `orders` being tenant-scoped rather than a
    property of the check, and the day this repository reads anything global the
    first assertion stops covering it.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            head = await OrderQueueRepository(session).next_for_handover()
            in_this_session = head is not None and head in session
    finally:
        await engine.dispose()

    assert head is not None, (
        f"the hand-over returned nothing for a tenant the fixture proved holds "
        f"{SEEDED_FOR_TENANT_ONE} orders ({sorted(seeded_queue.by_tenant[TENANT_ONE])}). Either "
        f"the statement lost its tenant — a session opened outside `tenant_session` sits at the "
        f"deny sentinel and reads zero rows — or `orders` lost the app role's SELECT grant."
    )
    assert head.id == EXPECTED_HEAD, (
        f"the hand-over returned {head.id}, not {EXPECTED_HEAD}. The module docstring tabulates "
        f"which wrong ORDER BY produces which row: {A_NEWEST} is the heap or `ORDER BY id` alone, "
        f"{A_TIED_HIGHER_ID} is `ORDER BY created_at` with the tie unbroken, and {B_OLDEST} is "
        f"the other tenant's row, which means the scoping is gone."
    )
    assert in_this_session, (
        "the row came back from some session other than the one `tenant_session` established a "
        "tenant on — `next_for_handover` opened its own off the same engine, most likely. "
        "`OrderQueueRepository.__init__` cannot see that: it checks the session it is handed."
    )


@pytest.mark.asyncio
async def test_the_older_order_belonging_to_another_tenant_is_not_handed_over(
    app_dsn: str, seeded_queue: SeededQueue
) -> None:
    """The head is the oldest order THIS TENANT MAY SEE, and the two differ.

    A SEPARATE CLAIM from the ordering test, and the seed is built so that one
    row satisfies both questions with opposite answers. `B_OLDEST` is the oldest
    row in the table by five months. A `next_for_handover` that dropped its
    scoping — no policy on `orders`, a session from the raw sessionmaker, a
    `WHERE` clause somebody moved out of the GUC and into Python and then
    deleted — returns it, and returns it while still being a perfectly good FIFO
    queue. Ordering alone cannot tell the two apart.

    Read from tenant TWO as well, in the same test, because "tenant one does not
    see B's row" is also true of a database that hides that row from everyone —
    a missing grant, a policy keyed on the wrong column, a row that was never
    committed. One session must not see it and the other must.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            for_one = await OrderQueueRepository(session).next_for_handover()
        async with tenant_session(sessionmaker, TENANT_TWO) as session:
            for_two = await OrderQueueRepository(session).next_for_handover()
    finally:
        await engine.dispose()

    assert for_one is not None, (
        f"tenant one's hand-over was empty, and the contrast below needs both halves. The fixture "
        f"proved both tenants hold rows: {seeded_queue.by_tenant}"
    )
    assert for_two is not None, (
        f"tenant two's hand-over was empty, and the contrast below needs both halves. The fixture "
        f"proved both tenants hold rows: {seeded_queue.by_tenant}"
    )
    assert for_one.id != B_OLDEST, (
        f"tenant one was handed {B_OLDEST}, which the fixture proved belongs to tenant two. It is "
        f"the oldest row in the table, so a correctly ordered but unscoped query returns exactly "
        f"this — the ordering test above passes unchanged under that defect."
    )
    assert for_two.id == B_OLDEST, (
        f"tenant two was handed {for_two.id} rather than its own only row, {B_OLDEST}. Without "
        f"this half, 'tenant one did not see B's row' is equally satisfied by a database that "
        f"shows that row to nobody, which is a denial rather than isolation."
    )


@pytest.mark.asyncio
async def test_an_empty_queue_comes_back_as_none_and_not_as_an_error(app_dsn: str) -> None:
    """A tenant with no orders gets `None`, and that is a fact and not a refusal.

    `db/repositories/queue.py` states the split and this pins it: the repository
    reports that there is nothing, and does not decide what that means. Whether
    an empty hand-over is a 200 with `null` or a 404 is a question about the URL,
    which this layer cannot see; `services/queue_service.py::next_order` rules on
    it and `tests/test_queue_endpoint.py` holds the ruling.

    The tenant is one the seed writes NOTHING for, so the empty answer is the
    absence of rows rather than a policy hiding them. This test deliberately does
    NOT request `seeded_queue`: it needs the table to hold nothing for THIS
    tenant, and it needs no premise about any other.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_WITH_NO_ORDERS) as session:
            head = await OrderQueueRepository(session).next_for_handover()
    finally:
        await engine.dispose()

    assert head is None, (
        f"a tenant the seed never wrote a row for was handed {head}. Either the scoping is gone — "
        f"in which case this returns another tenant's oldest order — or a previous module left "
        f"rows behind that the fixture's DELETE would have cleared."
    )


@pytest.mark.asyncio
async def test_a_session_that_names_no_tenant_is_refused_with_the_tenant_diagnosis() -> None:
    """Constructed over a raw session, this refuses, and with the RIGHT sentence.

    The check is `TenantRepository.__init__`'s and its reasoning is not repeated.
    What is specific here is WHICH consequence gets rendered: `orders` is a tenant
    table, so the message must be the one that says every read is filtered against
    a tenant that was never established and every write is refused by the policy's
    `WITH CHECK` — and it must NOT be the rulebook's "`tenant` may be None",
    which on this table describes the state where nothing works.

    `db/repositories/base.py`'s comment above `_UNSCOPED_SESSION` records that the
    first shared version of this message got exactly that wrong, and that the only
    assertions on it matched the substring `tenant_session`, which both renderings
    contain. So this asserts the clause that DIFFERS.

    No server: the engine resolves its URL and builds a pool eagerly without
    connecting, and the refusal happens in a constructor before any statement.
    """
    engine = create_async_engine(UNREACHABLE_DSN)
    try:
        session = make_sessionmaker(engine)()
        with pytest.raises(RuntimeError) as raised:
            OrderQueueRepository(session)
        await session.close()
    finally:
        await engine.dispose()

    message = str(raised.value)
    assert "OrderQueueRepository" in message, (
        f"the refusal did not name the class it was raised for: {message!r}. "
        f"`refuse_unscoped_session` reads the name off the instance precisely so that a third "
        f"repository names itself without anybody editing a literal."
    )
    assert TENANT_TABLE_CLAUSE in message, (
        f"the refusal did not carry {TENANT_TABLE_CLAUSE!r}: {message!r}. That clause is what "
        f"makes this the TENANT diagnosis. `orders` is tenant-scoped, and the global table's "
        f"sentence — '`tenant` may be None for this one' — would tell a caller over this table "
        f"that a session at the deny sentinel is fine to open, where every read is empty."
    )

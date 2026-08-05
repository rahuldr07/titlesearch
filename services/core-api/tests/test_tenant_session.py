"""The tenant seam itself: `make_engine`, `tenant_session`, `TenantRepository`.

The database is an EPHEMERAL CONTAINER — see `conftest.py`'s database seam. The
module-scoped `migrated_database` fixture applies both revisions and puts the
database back exactly as it found it. Nothing here is skipped: if Docker or
`psql` is unavailable these tests FAIL, because "we did not check the seam today"
and "the seam holds" must never render the same way in a test report.

Everything below connects as `titlepipe_app`, which is a non-owner LOGIN role
with no `BYPASSRLS`. The superuser is used for SEEDING only — it bypasses
row-level security unconditionally, so an assertion made through it would prove
nothing about a policy.

## 🔴 WHAT THIS FILE IS NOT

It is not the isolation proof. There is no per-table matrix here, no
cross-tenant write, no chain of seven tables — that is Task 6, and duplicating
half of it here would mean two places to update the day a policy changes. What
this file proves is the SEAM: that the GUC is applied inside the transaction,
that it does not survive the transaction, that a fresh pooled connection starts
denied, and that the two public constructors carry the parameters their callers
depend on.

## The positive control, and why the denials are worthless without it

Every assertion in this file that reads `0 rows` is satisfied by a system that
denies everyone, by a broken DSN, and by an empty table. Three of those are bugs
and one is the behaviour under test, and no denial can tell them apart.

`test_the_positive_control_a_tenant_session_sees_that_tenants_own_row` is what
distinguishes them. It seeds two committed rows through the superuser, opens a
session as one tenant, and requires that tenant's own row to come back. Remove
the `after_begin` listener from `session.py` and every denial in this file stays
green while that one test goes red — which is precisely the shape of defect that
made Task 2's cardinality floor insufficient and Task 3's enum test compare a
constant to itself.
"""

from __future__ import annotations

from collections.abc import Callable
from inspect import Parameter, signature
from uuid import UUID

import pytest
from sqlalchemy import Engine, Select, func, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from titlepipe_core.db import TenantRepository, make_engine, make_sessionmaker, tenant_session
from titlepipe_core.db.models import Order
from titlepipe_domain import TenantId

# Two tenants that exist only here. Any two distinct uuids would do; these are
# legible in a failure message, which random ones are not. They are deliberately
# the same pair `test_forced_rls_and_grants.py` uses — a reader comparing the two
# files should not have to work out whether a different literal means anything.
TENANT_ONE = TenantId(UUID("11111111-1111-1111-1111-111111111111"))
TENANT_TWO = TenantId(UUID("22222222-2222-2222-2222-222222222222"))

# A third tenant, never seeded and never established. It exists to be smuggled in
# through `PGOPTIONS` and then found absent.
POISON_TENANT = "33333333-3333-3333-3333-333333333333"

# The two rows `_seed_two_tenants` writes. A floor, so that the positive control
# cannot be satisfied by a seed that silently wrote nothing.
SEEDED_TENANTS = 2


def _seed_two_tenants(engine: Engine) -> dict[UUID, UUID]:
    """Two committed `orders` rows, one per tenant, written as the superuser.

    Returns `tenant id -> order id`, because the positive control asserts on the
    exact row rather than on a count: a count of one is satisfied by the wrong
    row as readily as by the right one.

    COMMITTED rather than rolled back, because every reader below is a DIFFERENT
    connection. An uncommitted row is invisible to them, and a test that read
    zero rows because nothing was there would prove nothing.

    The superuser bypasses RLS unconditionally — `FORCE` removes the OWNER's
    exemption, not a superuser's — so one session seeds both tenants.

    `DELETE` first, so the contents are a function of this call and not of
    whatever ran before it. `orders` is chosen because `audit_log` carries
    `0001`'s append-only trigger and would refuse the delete.

    The rows are left behind. `migrated_database` is MODULE-scoped and its
    teardown drops every table, so they cannot reach another test file.
    """
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM orders"))
        rows = connection.execute(
            text("INSERT INTO orders (tenant_id) VALUES (:one), (:two) RETURNING tenant_id, id"),
            {"one": TENANT_ONE, "two": TENANT_TWO},
        ).all()
    return {UUID(str(row[0])): UUID(str(row[1])) for row in rows}


@pytest.fixture
def seeded_orders(migrated_database: str, seam_engine: Callable[[str], Engine]) -> dict[UUID, UUID]:
    """`_seed_two_tenants`, with the seed itself checked before any test uses it.

    The floor is here rather than in each test for the reason the docstring of
    `test_forced_rls_and_grants.py` gives about derivations: an assertion that
    something is absent is worthless if the thing was never there, and a seed
    that wrote one row — or none — would make every denial below vacuous without
    changing a single assertion.
    """
    engine = seam_engine(migrated_database)
    try:
        seeded = _seed_two_tenants(engine)
    finally:
        engine.dispose()

    assert len(seeded) == SEEDED_TENANTS, (
        f"the seed wrote {len(seeded)} distinct tenants, not {SEEDED_TENANTS}: "
        f"{sorted(seeded)}. Every denial in this file would then be a statement "
        f"about an empty table."
    )
    return seeded


def _read_the_guc(tenant_guc: str) -> Select[tuple[str | None]]:
    """`SELECT current_setting(<guc>, true)`, built once so it reads the same twice.

    `true` is `missing_ok`: it answers NULL for a setting that was never assigned
    in this session instead of raising `unrecognized configuration parameter`.
    That NULL is one of the two absences the seam has to keep apart from the
    other — see `session.py` — which is why every caller below asserts on the
    value rather than merely on it being falsy.
    """
    return select(func.current_setting(tenant_guc, True))


@pytest.mark.asyncio
async def test_make_engine_pins_a_fresh_connection_at_the_deny_sentinel_even_under_pgoptions(
    monkeypatch: pytest.MonkeyPatch,
    roles_applied: str,
    app_dsn: str,
    tenant_guc: str,
    tenant_deny_sentinel: str,
) -> None:
    """🔴 THE CONNECTION-LEVEL PIN, WHICH WAS UNVERIFIED UNTIL THIS TASK.

    `tests/conftest.py::SEAM_CONNECT_ARGS` pins the harness's own engines, and
    `test_database_seam.py` proves that constant works. Neither says anything
    about `make_engine`, which is what the APPLICATION connects with — and the
    fixture layer strips every `PG*` variable from the pytest process first, so
    inside this suite the application's own pin was unreachable and therefore
    untested.

    `monkeypatch.setenv` defeats that scrub on purpose. `PGOPTIONS` presets the
    tenant GUC to a VALID tenant, connection-scoped, which survives `SET LOCAL`
    and a rollback on a pooled connection — so a later isolation proof could
    report a pass against a connection that was never denied anything.

    THE CONTROL IS THE HALF THAT MAKES IT A TEST. An unpinned
    `create_async_engine` is asserted to pick the poison up. Without that, the
    second assertion would pass just as happily on a box where `PGOPTIONS` never
    reached libpq at all — proving the harness rather than the fix.

    The pinned value is `''` and NOT NULL, and the difference is asserted
    separately. `-c <guc>=` ASSIGNS the empty string at connection start, which
    is a different state from never having assigned it; `''::uuid` raises where
    `NULL::uuid` denies, so it is only `0002`'s `nullif` that makes the two one
    thing. A fresh connection landing in the assigned-and-empty case is this
    seam's own doing, not a corner of PostgreSQL's.
    """
    monkeypatch.setenv("PGOPTIONS", f"-c {tenant_guc}={POISON_TENANT}")
    read = _read_the_guc(tenant_guc)

    unpinned = create_async_engine(app_dsn)
    try:
        async with unpinned.connect() as connection:
            poisoned = (await connection.execute(read)).scalar_one()
    finally:
        await unpinned.dispose()

    assert poisoned == POISON_TENANT, (
        f"the control failed: PGOPTIONS did not reach an unpinned async connection "
        f"({poisoned!r}), so this test cannot show that make_engine's connect_args "
        f"are what make the difference"
    )

    pinned = make_engine(app_dsn)
    try:
        async with pinned.connect() as connection:
            settled = (await connection.execute(read)).scalar_one()
    finally:
        await pinned.dispose()

    assert settled is not None, (
        "a fresh make_engine connection read NULL rather than the deny sentinel, "
        "so the libpq `options` pin did not land"
    )
    assert settled == tenant_deny_sentinel, (
        f"a fresh make_engine connection started at {settled!r} rather than the "
        f"deny sentinel, so PGOPTIONS reached the application's own engine"
    )


@pytest.mark.asyncio
async def test_tenant_session_applies_the_guc_inside_the_transaction(
    migrated_database: str, app_dsn: str, tenant_guc: str
) -> None:
    """The GUC is read back from INSIDE the block, which is the only place it exists.

    `set_config(…, is_local => true)` reverts at COMMIT, so a reading taken after
    the `async with` would be a reading of the deny sentinel however well the
    listener worked. The assertion has to happen while the transaction that
    carries the value is still open.

    `str(TENANT_ONE)` is the canonical UUID rendering, which is what
    `tenant_guc_value` returns after parsing — not `repr`, and not whatever a
    caller happened to pass.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            established = (await session.execute(_read_the_guc(tenant_guc))).scalar_one()
    finally:
        await engine.dispose()

    assert established == str(TENANT_ONE), (
        f"the session ran under {established!r} rather than {str(TENANT_ONE)!r}. "
        f"Nothing that reads through a policy on this session is scoped."
    )


@pytest.mark.asyncio
async def test_the_positive_control_a_tenant_session_sees_that_tenants_own_row(
    app_dsn: str, seeded_orders: dict[UUID, UUID]
) -> None:
    """🔴 THE POSITIVE CONTROL. Without it this file cannot tell isolated from broken.

    Two committed rows exist, one per tenant. A session opened as `TENANT_ONE`
    must come back with EXACTLY that tenant's row — which is one assertion
    carrying two facts: the row it should see is visible, and the row it should
    not see is absent.

    THE `==` IS ON THE ID, NOT ON A COUNT. A count of one is satisfied by the
    wrong row as readily as by the right one, and the whole point of a control is
    that it fails for the reasons the denials cannot.

    Remove the `after_begin` listener from `session.py` and this is the only test
    in the file that goes red: the session then runs at the deny sentinel, sees
    nothing, and every "0 rows" assertion elsewhere is *more* satisfied than
    before.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            visible = list((await session.scalars(select(Order.id))).all())
    finally:
        await engine.dispose()

    assert visible == [seeded_orders[TENANT_ONE]], (
        f"a session established as {TENANT_ONE} saw {visible}, not "
        f"[{seeded_orders[TENANT_ONE]}]. Its own row is "
        f"{seeded_orders[TENANT_ONE]} and the other tenant's is "
        f"{seeded_orders[TENANT_TWO]}."
    )


@pytest.mark.asyncio
async def test_a_session_with_no_tenant_is_denied_rather_than_erroring(
    app_dsn: str,
    tenant_guc: str,
    tenant_deny_sentinel: str,
    seeded_orders: dict[UUID, UUID],
) -> None:
    """`tenant=None` is legal, encodes to `''`, and sees nothing. Health checks use it.

    Both halves are asserted and neither implies the other:

    * the GUC reads back as the DENY SENTINEL. `tenant_guc_value(None)` returning
      `"None"` — the accident `str(None)` produces — would also set a GUC and
      would also "work", right up until the policy's `nullif('None','')::uuid`
      raises `invalid input syntax for type uuid: "None"` and the denial becomes
      a 500;
    * zero rows are visible WHILE TWO ARE COMMITTED. `seeded_orders` is requested
      for exactly that reason: without it this assertion is a description of an
      empty table.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            established = (await session.execute(_read_the_guc(tenant_guc))).scalar_one()
            visible = (await session.scalars(select(Order.id))).all()
    finally:
        await engine.dispose()

    assert established == tenant_deny_sentinel, (
        f"an unestablished session carries {established!r}, not the deny sentinel. "
        f"Anything other than NULL or the empty string reaches the policy's ::uuid "
        f"cast and aborts the statement instead of denying the row."
    )
    assert list(visible) == [], (
        f"a session with no tenant saw {list(visible)} while {len(seeded_orders)} "
        f"tenants' rows were committed"
    )


@pytest.mark.asyncio
async def test_the_tenant_does_not_survive_the_commit_onto_the_pooled_connection(
    app_dsn: str, tenant_guc: str, tenant_deny_sentinel: str, seeded_orders: dict[UUID, UUID]
) -> None:
    """🔴 THE REUSED-CONNECTION CASE, WHICH IS EVERY REQUEST AFTER THE FIRST.

    `is_local=True` is what makes `set_config` revert at COMMIT. Pass `false` and
    the value is session-scoped, so the NEXT checkout of the same pooled
    connection begins already holding the previous request's tenant — a leak that
    no assertion made inside a session can see, because the listener would
    overwrite it before anything read it.

    So the residual is read through a RAW `engine.connect()`. That is not a
    convenience: `after_begin` is an ORM event, absent from `ConnectionEvents`
    and `PoolEvents` alike, so a Core connection is the one place the GUC's
    resting state is observable. It is also the same door Alembic and any future
    queue worker come through, which is why the resting state has to be the deny
    sentinel rather than merely "overwritten soon".

    `pool_size=1, max_overflow=0` IS THE TEST, and it is why `make_engine` has to
    expose the second parameter. `pool_size=1` alone leaves the default
    `max_overflow=10`, so the pool may answer the second checkout with a
    brand-new connection that was never poisoned — and the assertion would pass
    while proving nothing.

    `pg_backend_pid()` IS ASSERTED EQUAL, so that claim is checked rather than
    assumed. A pool that handed back a different backend would make every
    assertion below a statement about a fresh connection.

    The row count is asserted alongside the GUC because the two failures look
    different from the outside: a leaked GUC is a string in one place and another
    tenant's data in the other, and it is the second one that is the incident.
    """
    engine = make_engine(app_dsn, pool_size=1, max_overflow=0)
    read = _read_the_guc(tenant_guc)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            inside = (await session.execute(read)).scalar_one()
            inside_backend = (await session.execute(select(func.pg_backend_pid()))).scalar_one()

        async with engine.connect() as connection:
            residual = (await connection.execute(read)).scalar_one()
            reused_backend = (await connection.execute(select(func.pg_backend_pid()))).scalar_one()
            leaked = (await connection.scalars(select(Order.id))).all()
    finally:
        await engine.dispose()

    assert inside == str(TENANT_ONE), (
        f"the session never established its tenant ({inside!r}), so the reuse "
        f"assertions below are about a connection that carried nothing"
    )
    assert reused_backend == inside_backend, (
        f"the pool handed back backend {reused_backend} where the session used "
        f"{inside_backend}, so this test says nothing about connection reuse. "
        f"pool_size=1 with max_overflow=0 is what makes them the same connection."
    )
    assert residual == tenant_deny_sentinel, (
        f"the committed transaction left {residual!r} on the pooled connection. "
        f"The next request to check it out starts as that tenant."
    )
    assert list(leaked) == [], (
        f"a raw checkout of the reused connection read {list(leaked)} of "
        f"{len(seeded_orders)} tenants' rows without establishing a tenant"
    )


def test_make_engine_exposes_the_pool_bounds_a_reuse_test_cannot_do_without() -> None:
    """`pool_size` and `max_overflow`, both keyword-only, both on the signature.

    A SIGNATURE TEST RATHER THAN A BEHAVIOURAL ONE, and the honest reason is that
    `QueuePool` publishes no reader for `max_overflow` — `size()`, `overflow()`,
    `checkedin()` and `checkedout()` are the public surface, and none of them
    distinguishes a ceiling of 0 from a ceiling of 10 on an idle pool. Proving the
    ceiling would mean holding a connection open and waiting out `pool_timeout`,
    which is 30 seconds by default and is not a parameter this function exposes.

    So what is pinned here is the EXPOSURE, which is the thing that actually gets
    lost: `create_async_engine` accepts `max_overflow` whether or not this
    wrapper forwards it, so dropping the parameter breaks no call inside `src/`
    and produces no type error anywhere until a caller passes it.
    `test_the_tenant_does_not_survive_the_commit_onto_the_pooled_connection` is
    that caller, and it is a `TypeError` at collection-adjacent runtime rather
    than a readable failure — hence this test, which names the missing parameter.

    `pool.size()` is asserted as well, because a signature that accepts an
    argument and discards it would satisfy everything above.
    """
    parameters = signature(make_engine).parameters

    for name, default in (("pool_size", 5), ("max_overflow", 10)):
        assert name in parameters, (
            f"make_engine no longer exposes {name!r}. Task 6 needs "
            f"pool_size=1, max_overflow=0 to make two checkouts the same "
            f"connection, and cannot get it any other way."
        )
        assert parameters[name].kind is Parameter.KEYWORD_ONLY, (
            f"{name!r} is {parameters[name].kind}, not keyword-only; a positional "
            f"pool bound is one transposition away from being the other one"
        )
        assert parameters[name].default == default, (
            f"{name!r} defaults to {parameters[name].default!r}, not {default!r}"
        )


def test_tenant_repository_takes_its_model_as_a_required_argument() -> None:
    """`model` is a constructor parameter with no default, and both halves matter.

    A DEFAULT IS THE FAILURE THIS PINS. `model: type[T] | None = None` typechecks,
    constructs, and fails at the first query instead of at the call that was
    wrong — and a repository over the wrong model is a repository reading another
    table entirely.

    IT IS ALSO NOT A `ClassVar`, which is the obvious alternative spelling and is
    forbidden by the typing specification rather than by taste: a class variable
    is shared by every specialisation of a generic, so it may not mention a type
    variable. pyright reports `ClassVar type cannot include type variables`. That
    is asserted from this side by requiring the parameter to exist at all — a
    `ClassVar` design has no `model` parameter to check.
    """
    # 🔴 SPELLED THROUGH A TYPED ALIAS RATHER THAN AS
    # `signature(TenantRepository.__init__)`. The bare form leaves the class
    # unparameterised, so pyright reads the method as
    # `(self: TenantRepository[Unknown], …, model: type[Unknown])` and strict mode
    # rejects it as partially unknown — MEASURED 2026-08-05,
    # `reportUnknownMemberType` plus `reportUnknownArgumentType`. Binding the
    # variable to one specialisation is enough to make every parameter known, and
    # `__init__` is not generic in anything else.
    repository: type[TenantRepository[Order]] = TenantRepository
    parameters = signature(repository.__init__).parameters

    assert "model" in parameters, (
        "TenantRepository no longer takes a model; a ClassVar[type[T]] is not an "
        "available alternative — the typing spec forbids a type variable in a "
        "ClassVar and pyright rejects it"
    )
    assert parameters["model"].default is Parameter.empty, (
        f"model defaults to {parameters['model'].default!r}. A repository "
        f"constructed without one fails at its first query rather than at the "
        f"call site that omitted it."
    )
    assert parameters["session"].default is Parameter.empty, (
        "session acquired a default, which would allow a repository with no scoped session at all"
    )


@pytest.mark.asyncio
async def test_the_repository_reads_and_writes_through_the_scoped_session(
    app_dsn: str, seeded_orders: dict[UUID, UUID]
) -> None:
    """`add` then `get`, and a `get` for a row belonging to somebody else.

    The round trip is the seam: `add` flushes, so the INSERT reaches the server
    inside the session's transaction and the policy's `WITH CHECK` — which is
    `0002`'s `USING` expression, PostgreSQL reusing it when no `WITH CHECK` is
    given — has to accept it. A tenant that was not established would be refused
    with `42501 new row violates row-level security policy` rather than silently
    writing.

    The second `get` asks for `TENANT_TWO`'s committed row and must answer `None`.
    That is the repository's own documented contract — `None` covers "no such
    row" and "not yours" and deliberately does not distinguish them, because
    distinguishing them is the cross-tenant existence oracle that `models`'
    composite primary key was chosen to close. It is one property of this class,
    not the isolation proof, which is Task 6's.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            orders = TenantRepository(session, Order)
            written = Order(tenant_id=TENANT_ONE)
            await orders.add(written)
            written_id = written.id

            mine = await orders.get(written_id)
            seeded = await orders.get(seeded_orders[TENANT_ONE])
            theirs = await orders.get(seeded_orders[TENANT_TWO])
    finally:
        await engine.dispose()

    assert mine is not None, "the row this session just wrote is not readable by it"
    assert mine.id == written_id
    assert mine.tenant_id == TENANT_ONE

    assert seeded is not None, (
        f"the repository could not read {seeded_orders[TENANT_ONE]}, this tenant's "
        f"own committed row, so `get` is not reaching rows written elsewhere"
    )

    assert theirs is None, (
        f"the repository returned {TENANT_TWO}'s row {seeded_orders[TENANT_TWO]} to "
        f"a session established as {TENANT_ONE}"
    )

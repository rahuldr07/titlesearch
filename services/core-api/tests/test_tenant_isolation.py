"""🔴 THE ISOLATION PROOF. Seven assertions, all of them as `titlepipe_app`.

The database is an EPHEMERAL CONTAINER — see `conftest.py`'s database seam. The
module-scoped `migrated_database` fixture applies both revisions and puts the
database back exactly as it found it. **Nothing here is skipped.** If Docker or
`psql` is unavailable these tests FAIL, because "we did not check isolation
today" and "isolation holds" must never render the same way in a test report.

## Why every connection below is `titlepipe_app`, and why that is the whole file

**A superuser bypasses row-level security unconditionally. `FORCE` does not stop
one** — it removes the OWNER's exemption, which is a different exemption.
MEASURED 2026-08-06 on this repository, by running this file's own assertions
against `migrated_database` (the superuser DSN) instead of `app_dsn`: a
correctly forced, correctly policied `orders` returned **every tenant's rows**
to a session established as one tenant. An isolation test on the admin DSN
passes while proving nothing at all.

`isolation_dsn` below is the one place the role is named, so that the injection
which proves the above is a one-line change and can be re-run at will. All seven
assertions fail under it — and the first run of it found that only six did,
which is the whole reason the injection is run rather than reasoned about.

## The positive control, and why the denials are worthless without it

Assertions 1, 3 and 5 all read `0 rows`. Every one of them is satisfied by a
database that denies everything to everybody — a revoked grant, a policy with no
`USING` clause anyone can satisfy, a table that is simply empty. Three of those
are outages and one is the behaviour under test, and no denial can tell them
apart.

`test_1b_the_positive_control_...` is what distinguishes them: in **every one of
the seven tables**, tenant B with its own tenant established must see exactly the
one row committed for it and not zero, and tenant A must see every row committed
for it and none of B's.

MEASURED 2026-08-06 by deleting the `event.listen(..., "after_begin", ...)` line
from `src/titlepipe_core/db/session.py` and changing nothing else — every session
then runs at the deny sentinel:

    green: 2 (still 42501), 3 (0 rows), 5 (0 rows), 6 (still refused)
    red:   1b, 4, and 1

**Every denial assertion stayed green.** All four of them, including 2 and 6,
which refuse for a reason that has nothing to do with the tenant and so refuse
just as happily when the tenant is gone. Assertion 2 is the sharpest of these: it
went green with the identical SQLSTATE *and the identical message*, because "A
inserting B's row" and "nobody inserting anybody's row" are the same refusal to
the server.

Assertion 1 went red, and the honest reason is that it is not purely a denial:
its first step is A COMMITTING A ROW, which the policy refuses outright with no
tenant established. Its denial half — the second session reading nothing — would
have been greener than ever. That leaves 1b and 4 as the only two assertions that
fail *because they are positive*, and 1b is the one whose whole purpose is to be
positive.

## What the seed is, and what the asymmetry buys

`isolation_seed` (in `conftest.py`) commits rows for both tenants in **every
tenant-keyed table and in the registry** — two for A and exactly one for B in
each of the six, one each in `tenants`, whose primary key IS a tenant id — as the
superuser, before any app-role connection in this module opens. One row each
would make "exactly 1" true of both tenants, so a control that read `1` would be
equally satisfied by a session that had leaked into the other tenant's row.
Two-and-one makes B's count a statement about B.

## 🔴 THE PROOF USED TO COVER ONE TABLE, AND THE WHOLE SUITE PASSED WITHOUT THE
   OTHER SIX

Assertions 1b, 2, 4 and 5 all read or wrote `orders` and nothing else, and
assertions 3 and 5 read the other tables — when they read them at all — only in
the DENY state, where "this policy denies everyone" and "this policy leaks to
everyone" are the same zero. MEASURED 2026-08-06, `0002::_isolate` patched so
that `orders` keeps its real predicate and the other six plus `tenants` get

    USING (nullif(current_setting('app.current_tenant', true), '') IS NOT NULL)

— which hands every established tenant every other tenant's rows: **`192
passed`**. A database leaking six of seven tables, reported as a green suite.

Two changes close it and both are needed. `isolation_seed` now writes A and B
rows into all seven tables, and assertion 1b is a LOOP over the derived set
rather than a statement about `orders`; assertion 2 is the same loop on the write
side. The catalog half of the same hole — an assertion that read the predicate's
substring rather than its structure — is fixed in
`tests/test_forced_rls_and_grants.py`.

## Provenance of the seven

Assertions 1, 1b, 2, 3 and 6 were executed against this contract on 2026-08-05
and their expected results were recorded there. **4 and 5 were predictions**,
and this file is the first place they have been run. Both were confirmed; what
4 actually measured about `after_begin` and SAVEPOINTs is written out in its own
docstring, because the prediction was right for a reason the contract did not
state.

## `begin_nested()` is banned in `src/` and used deliberately here

`scripts/check_backend_rules.py` scans `src/` only. Assertion 4 is exactly why
the exemption exists: the SAVEPOINT trap cannot be proved without a SAVEPOINT.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from uuid import UUID

import pytest
from sqlalchemy import Select, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine

from titlepipe_core.db import make_engine, make_sessionmaker, tenant_session
from titlepipe_core.db.models import Order
from titlepipe_domain import TenantId

# `insufficient_privilege`. PostgreSQL answers with this code for BOTH "your
# INSERT violates a row-level security policy" and "you may not do that at all",
# which is why assertion 2 asserts the message alongside the code — a typo'd
# column, a NOT NULL violation and an RLS refusal all raise, and only the
# SQLSTATE plus the message says which one happened.
INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501"

# The fragment PostgreSQL puts in the message when the refusal is the POLICY's
# and not the ACL's. MEASURED 2026-08-06 against postgres:18.4, `titlepipe_app`
# established as tenant A inserting a row carrying tenant B's id:
#
#     new row violates row-level security policy for table "orders"
RLS_REFUSAL_FRAGMENT = "row-level security policy"

# MEASURED 2026-08-06 against postgres:18.4, `titlepipe_app` (no membership in
# `titlepipe_owner`) issuing `SET ROLE titlepipe_owner`:
#
#     sqlstate 42501: permission denied to set role "titlepipe_owner"
#
# The SQLSTATE is asserted and the message is asserted as a SECONDARY check,
# with the substring kept to the part that is not a role name. The message text
# is English and locale-dependent through `lc_messages` — a server started with
# a different one answers the same 42501 with different words — so a test that
# asserted only the sentence would be a test of the container's locale.
SET_ROLE_REFUSAL_FRAGMENT = "permission denied to set role"

# 🔴 WRITTEN OUT, NOT DERIVED, AND IT SITS BESIDE A DERIVATION ON PURPOSE. The
# loops below iterate over the tables `isolation_seed` derived from the catalog;
# these two literals are what says the derivation found the right ones.
#
# The pattern and the reason are `test_forced_rls_and_grants.py`'s, which learned
# both from Task 2:
#
#   * THE FLOOR catches a derivation that stopped working. Every assertion in the
#     positive control and in assertion 2 is a `for`, and a `for` over nothing
#     passes — so a short set reports success for the tables it never visited;
#   * THE EXACT SET catches SEVEN WRONG TABLES. A cardinality of seven is
#     satisfied by seven decoys as readily as by the seven that exist, which is
#     precisely the shape that defeated Task 2's role floor.
#
# `tenants` is in the set. It is not a tenant table — it is the registry, keyed on
# `id` — but it is one of the seven `0002` writes a policy on, and leaving it out
# of the proof is how it came to be read only in the deny state.
EXPECTED_ISOLATION_TABLES = frozenset(
    {"tenants", "orders", "packages", "pages", "fields", "field_readings", "audit_log"}
)
MINIMUM_ISOLATION_TABLES = 7


@pytest.fixture
def isolation_dsn(app_dsn: str) -> str:
    """🔴 THE ONE PLACE THE ROLE IS NAMED. `titlepipe_app`, never the superuser.

    Every test in this file takes this rather than `app_dsn` directly, and the
    indirection exists for one reason: the injection that proves this file is
    worth running has to swap the role, and it has to be re-runnable by whoever
    reads it. Respell the parameter as `migrated_database` — which yields the
    superuser DSN — and every one of the seven fails. MEASURED 2026-08-06.

    THAT NUMBER WAS SIX THE FIRST TIME IT WAS RUN, and the missing one is the
    reason this injection is worth having rather than a formality: assertion 4
    passed as the superuser, because it was checking the savepoint and the GUC
    string without ever checking that the connection was FILTERED. It now asserts
    the other tenant's row absent, and fails with the rest.

    A superuser bypasses RLS unconditionally, so a file that quietly fell back to
    the admin DSN would report seven passes about a database it was never
    filtered by.
    """
    return app_dsn


Seed = Mapping[str, Mapping[UUID, tuple[UUID, ...]]]


def _seeded_ids(seed: Seed, table: str, tenant: UUID) -> set[UUID]:
    """The ids the seed committed for `tenant` in `table`, as a set.

    A SET rather than a list, because nothing here promises an ordering: the
    assertions are about WHICH rows are visible, and a `SELECT` with no
    `ORDER BY` is entitled to answer in any order it likes.
    """
    return set(seed[table][tenant])


def _every_seeded_id(seed: Seed, table: str) -> set[UUID]:
    """Every id the seed committed in `table`, for either tenant."""
    return {row for ids in seed[table].values() for row in ids}


async def _visible_order_ids(engine: AsyncEngine, tenant: TenantId | None) -> set[UUID]:
    """Every `orders.id` a session established as `tenant` can see.

    `tenant=None` is the deny case and is legal — see `session.py`. It encodes to
    the empty string, `nullif` turns that into NULL, and no row satisfies any
    policy.
    """
    sessionmaker = make_sessionmaker(engine)
    async with tenant_session(sessionmaker, tenant) as session:
        return set((await session.scalars(select(Order.id))).all())


async def _visible_ids_per_table(
    engine: AsyncEngine, tenant: TenantId | None, tables: Iterable[str]
) -> dict[str, set[UUID]]:
    """table -> every `id` a session established as `tenant` can see in it.

    ONE SESSION FOR ALL SEVEN READS, which is the state the application is
    actually in: a request establishes its tenant once and then touches whatever
    tables it needs. Seven sessions would additionally be seven `after_begin`
    firings, and a listener that worked on the first checkout and not the rest
    would be invisible to it.

    RAW SQL RATHER THAN THE MAPPED CLASSES, because the table set is DERIVED. A
    loop over `Order`, `Package`, `Page`, … is a hardcoded list wearing an ORM
    costume: it would pass unchanged on the day a migration adds an eighth tenant
    table and forgets to isolate it, which is the failure the derivation exists to
    catch.

    S608 is suppressed for the reason `conftest.py::_seed_isolation_rows` records
    at its own three: a table name cannot be a bind parameter in any dialect, and
    every name here comes from `isolation_seed`'s derivation, which reads
    `pg_class` on this suite's own container and refuses anything that is not a
    plain lower-case identifier.
    """
    sessionmaker = make_sessionmaker(engine)
    async with tenant_session(sessionmaker, tenant) as session:
        return {
            table: {
                row[0]
                for row in (
                    await session.execute(text(f"SELECT id FROM {table}"))  # noqa: S608
                ).all()
            }
            for table in sorted(tables)
        }


# What `_cross_tenant_insert_refusals` records for a table that took the row. It
# is a message rather than an exception because "which table accepted it" is the
# whole content of that failure, and a `pytest.raises` that does not fire reports
# `DID NOT RAISE DBAPIError` and names nothing.
ACCEPTED = "the INSERT was accepted rather than refused"


async def _cross_tenant_insert_refusals(
    dsn: str, key_columns: Mapping[str, str], writer: TenantId, other: UUID
) -> dict[str, tuple[str | None, str]]:
    """table -> (SQLSTATE, message) for `writer` inserting a row keyed to `other`.

    One session per table, each established as `writer`, each rolled back. The
    rollback matters twice: a refused INSERT leaves the transaction aborted so
    `tenant_session`'s own commit on exit would be a second and less legible
    failure, and an ACCEPTED one must not be allowed to commit — a leaked row
    would then be visible to every assertion that runs after this test.

    `sqlstate` is narrowed with `isinstance` rather than compared straight out of
    `getattr`: comparing `Any` to a string passes for a `None` as readily as for a
    code.

    S608 is suppressed for the reason recorded at `_visible_ids_per_table`.
    """
    outcomes: dict[str, tuple[str | None, str]] = {}
    engine = make_engine(dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        for table, key_column in sorted(key_columns.items()):
            insert = f"INSERT INTO {table} ({key_column}) VALUES (:other)"  # noqa: S608
            async with tenant_session(sessionmaker, writer) as session:
                try:
                    await session.execute(text(insert), {"other": other})
                except DBAPIError as error:
                    sqlstate = getattr(error.orig, "sqlstate", None)
                    outcomes[table] = (
                        sqlstate if isinstance(sqlstate, str) else None,
                        str(error),
                    )
                else:
                    outcomes[table] = (None, ACCEPTED)
                await session.rollback()
    finally:
        await engine.dispose()
    return outcomes


def _read_the_guc(tenant_guc: str) -> Select[tuple[str | None]]:
    """`SELECT current_setting(<guc>, true)`, built once so it reads the same twice.

    `true` is `missing_ok`: it answers NULL for a setting never assigned in this
    session rather than raising `unrecognized configuration parameter`. That NULL
    is one of the two absences the seam keeps apart from the other, which is why
    every caller asserts on the VALUE rather than on it being falsy.

    The GUC's name arrives as the `tenant_guc` fixture rather than as a literal.
    `conftest.py` owns it, `0002`'s policies read it and `make_engine` pins it;
    a fourth spelling of the same string in this file is a fourth place for it to
    drift.
    """
    return select(func.current_setting(tenant_guc, True))


@pytest.mark.asyncio
async def test_1_the_tenant_does_not_survive_the_pool_checkout_into_the_next_session(
    isolation_dsn: str,
    isolation_seed: Seed,
    isolation_tenant_a: UUID,
    tenant_guc: str,
) -> None:
    """🔴 ASSERTION 1. A writes and commits; the next session on THE SAME CONNECTION
    establishes no tenant and must see nothing.

    This is the leak that `is_local=True` exists to prevent and that no assertion
    made INSIDE a session can see: a GUC set without `is_local` is session-scoped
    on the backend, so the next checkout of the same pooled connection begins
    already holding the previous request's tenant. The listener would then
    overwrite it before anything read it — unless, as here, the next caller
    establishes no tenant at all.

    `pool_size=1, max_overflow=0` IS THE TEST. `pool_size=1` alone leaves the
    default `max_overflow=10`, so the pool may answer the second checkout with a
    brand-new connection that was never poisoned, and the assertion passes for
    the wrong reason. Task 5 exposed `max_overflow` on `make_engine` precisely so
    that this task could pin it, and Task 5's own test of the parameter is a
    signature check rather than a behavioural one. This is where the ceiling
    earns its keep.

    `pg_backend_pid()` IS ASSERTED EQUAL rather than assumed. Without it the
    "same connection" in this test's name is a claim about SQLAlchemy's pooling
    that nothing checks, and a pool that handed back a different backend would
    make the denial below a statement about a fresh connection — which assertion
    5 already covers.

    A's WRITE is what makes this different from the seed alone: the row is
    committed by the tenant whose GUC could leak, on the connection that could
    leak it, one transaction before the read.

    🔴 THAT WRITE IS ALSO WHY THIS TEST IS NOT A PURE DENIAL, AND THE DISTINCTION
       IS WORTH THE LINE. MEASURED 2026-08-06 under the listener injection: this
       test went red, but at the INSERT — `new row violates row-level security
       policy` — and never reached the read. Its denial half would have been
       greener than ever, since a session that establishes nothing sees nothing
       whether or not the tenant survived the checkout. So the red here is not
       evidence that the denial works; only assertion 1b's green-to-red is.
    """
    engine = make_engine(isolation_dsn, pool_size=1, max_overflow=0)
    tenant_a = TenantId(isolation_tenant_a)
    try:
        sessionmaker = make_sessionmaker(engine)

        async with tenant_session(sessionmaker, tenant_a) as session:
            session.add(Order(tenant_id=isolation_tenant_a))
            await session.flush()
            wrote_on = (await session.execute(select(func.pg_backend_pid()))).scalar_one()
            established = (await session.execute(_read_the_guc(tenant_guc))).scalar_one()

        async with tenant_session(sessionmaker, None) as session:
            read_on = (await session.execute(select(func.pg_backend_pid()))).scalar_one()
            visible = set((await session.scalars(select(Order.id))).all())
    finally:
        await engine.dispose()

    assert established == str(isolation_tenant_a), (
        f"the writing session ran under {established!r} rather than "
        f"{str(isolation_tenant_a)!r}, so nothing was established for the next "
        f"checkout to inherit and this test proves nothing"
    )
    assert read_on == wrote_on, (
        f"the pool handed back backend {read_on} where the write used {wrote_on}, "
        f"so this says nothing about connection reuse. pool_size=1 with "
        f"max_overflow=0 is the only spelling of `the same connection, twice`."
    )
    assert visible == set(), (
        f"a session that established NO tenant, on the connection tenant "
        f"{isolation_tenant_a} had just committed on, read {sorted(visible)}. The "
        f"tenant survived the checkout: every request after the first would start "
        f"as whoever held the connection before it."
    )


@pytest.mark.asyncio
async def test_1b_the_positive_control_each_tenant_sees_its_own_rows_in_every_table(
    isolation_dsn: str,
    isolation_seed: Seed,
    isolation_tenant_b: UUID,
    isolation_tenant_a: UUID,
) -> None:
    """🔴 ASSERTION 1b — THE POSITIVE CONTROL. NOT OPTIONAL, AND NOT ABOUT `orders`.

    Assertions 1, 3 and 5 are each satisfied by a database that denies everything
    to everyone. Without this, the file cannot tell "isolated" from "broken", and
    the broken case is an outage that reports as a green suite.

    MEASURED 2026-08-06: with the `after_begin` listener deleted from
    `src/titlepipe_core/db/session.py`, assertions 2, 3, 5 and 6 — every denial
    in the file — all stayed GREEN. Assertion 2 went green with the same SQLSTATE
    AND the same message, because a session with no tenant is refused the same
    INSERT for a different reason. Only 1b and 4 fail on the grounds that they are
    positive, and 1 fails on the write it makes rather than on the denial it
    checks. That is not an argument for the control in the abstract; it is the
    actual result on this tree.

    ---------------------------------------------------------------------------
    🔴 IT WAS A CONTROL FOR `orders` AND FOR `orders` ONLY, AND THAT IS WHY IT IS
       NOW A LOOP OVER THE DERIVED SET.
    ---------------------------------------------------------------------------
    A positive control on one table says nothing about the other six. MEASURED
    2026-08-06, `0002::_isolate` patched so `orders` keeps its real predicate and
    the other six plus `tenants` get
    `USING (nullif(current_setting(…), '') IS NOT NULL)` — every established
    tenant seeing every other tenant's rows in six of seven tables: **`192
    passed`**. This loop is what takes that down.

    THE TABLE SET IS DERIVED, NOT LISTED. `isolation_seed` asks the catalog which
    tables exist and which column each is keyed on, so a migration that adds an
    eighth tenant table and forgets to isolate it is caught rather than
    forgotten. The floor and the exact-set check above the loop are what say the
    derivation itself still works — see `EXPECTED_ISOLATION_TABLES`.

    THE TWO TENANTS ARE ASSERTED DIFFERENTLY, AND THE ASYMMETRY IS AN ORDERING
    PROPERTY RATHER THAN A PREFERENCE:

    * **B is exact.** Nothing in this file commits a row for B — assertion 2 tries
      and is refused — so `visible == seeded` holds under every ordering, and it
      is the strongest statement available: not a count, which the wrong row
      satisfies as readily as the right one, but the id set itself;
    * **A is a floor plus disjointness.** Assertion 1 COMMITS an `orders` row for
      A on purpose, and `isolation_seed` is module-scoped, so how many rows A owns
      by the time this runs depends on whether assertion 1 has run yet. `after ==
      seeded` for A would be a test of collection order. The floor (every seeded
      row visible) plus `B's rows ∩ visible == ∅` holds under every ordering and
      still fails the moment the policy stops filtering — which is exactly what
      the mutation above produces.

    `len(seeded_b) == 1` is asserted per table because `exactly 1, not 0` is the
    contract the seed's two-and-one asymmetry exists to make meaningful.
    """
    tenant_a = TenantId(isolation_tenant_a)
    tenant_b = TenantId(isolation_tenant_b)

    engine = make_engine(isolation_dsn)
    try:
        seen_by_a = await _visible_ids_per_table(engine, tenant_a, isolation_seed)
        seen_by_b = await _visible_ids_per_table(engine, tenant_b, isolation_seed)
    finally:
        await engine.dispose()

    # THE FLOOR FIRST. Everything below is a `for` loop, and a `for` over nothing
    # passes. The exact set does not subsume it — see EXPECTED_ISOLATION_TABLES.
    assert len(isolation_seed) >= MINIMUM_ISOLATION_TABLES, (
        f"the seed covered {len(isolation_seed)} tables, fewer than the "
        f"{MINIMUM_ISOLATION_TABLES} this schema has: {sorted(isolation_seed)}. "
        f"The control below is a loop, so it reports success for every table it "
        f"never visited."
    )
    assert set(isolation_seed) == set(EXPECTED_ISOLATION_TABLES), (
        f"the seeded tables are {sorted(isolation_seed)}, not "
        f"{sorted(EXPECTED_ISOLATION_TABLES)}. A count of "
        f"{MINIMUM_ISOLATION_TABLES} is satisfied by seven decoys just as readily."
    )

    for table in sorted(isolation_seed):
        seeded_a = _seeded_ids(isolation_seed, table, isolation_tenant_a)
        seeded_b = _seeded_ids(isolation_seed, table, isolation_tenant_b)
        visible_a = seen_by_a[table]
        visible_b = seen_by_b[table]

        assert len(seeded_b) == 1, (
            f"the seed gave tenant B {len(seeded_b)} rows in {table}, not the one "
            f"this control is written around: {sorted(seeded_b)}"
        )

        assert visible_b != set(), (
            f"tenant {isolation_tenant_b} established its own tenant and saw "
            f"NOTHING in {table} while {sorted(seeded_b)} was committed for it. "
            f"Every `0 rows` assertion in this file is now satisfied by a database "
            f"that denies everybody, and none of them can tell you that."
        )
        assert visible_b == seeded_b, (
            f"tenant {isolation_tenant_b} saw {sorted(visible_b)} in {table}, not "
            f"{sorted(seeded_b)}. Tenant A's rows there are {sorted(seeded_a)}."
        )

        assert seeded_a <= visible_a, (
            f"tenant {isolation_tenant_a} saw {sorted(visible_a)} in {table}, which "
            f"is missing {sorted(seeded_a - visible_a)} of the rows committed for "
            f"it. This is a floor rather than an equality because assertion 1 "
            f"commits an extra row for A; falling below it means the session is "
            f"scoped to the wrong tenant or to none."
        )
        assert visible_a & seeded_b == set(), (
            f"tenant {isolation_tenant_a} saw {sorted(visible_a & seeded_b)} in "
            f"{table}, which belongs to tenant {isolation_tenant_b}. This "
            f"connection is not filtered on {table} — a predicate that ignores the "
            f"key column and only asks whether SOME tenant is established passes "
            f"every other assertion in this file."
        )


@pytest.mark.asyncio
async def test_2_a_write_carrying_another_tenants_id_is_refused_with_42501(
    isolation_dsn: str,
    isolation_seed: Seed,
    isolation_key_columns: Mapping[str, str],
    isolation_tenant_a: UUID,
    isolation_tenant_b: UUID,
) -> None:
    """🔴 ASSERTION 2 — THE WRITE SIDE. Reading is not the only way out of a tenant.

    A session established as A inserts a row whose `tenant_id` is B's. Nothing in
    the ORM stops it, nothing in the schema stops it — `tenant_id` is an ordinary
    `uuid NOT NULL` column and B is a real tenant — and if the policy did not
    stop it, one tenant could write rows into another's account at will and never
    see them again.

    `0002` writes no `WITH CHECK`, so PostgreSQL reuses the `USING` expression for
    it. That reuse is what this test pins: a policy given an explicit
    `WITH CHECK (true)` would satisfy every READ assertion in this file and let
    this INSERT straight through.

    THE ASSERTION IS ON THE SQLSTATE, NOT ON "IT RAISED". A typo'd column name
    (`42703`), a NOT NULL violation (`23502`) and a missing grant all raise
    `DBAPIError` here, and a test that only required an exception would go green
    on any of them while the policy was gone. `42501` is matched specifically.

    THE MESSAGE IS ASSERTED TOO, and that is not belt-and-braces: `42501` is
    ALSO what "you have no INSERT privilege on this table" returns, which is what
    a botched `0002` grant would produce — the same code for a refusal that has
    nothing to do with tenancy.

    THE `flush()` IS LOAD-BEARING AND IT IS THE ONLY STATEMENT INSIDE
    `pytest.raises`. `session.add` queues, so without an explicit flush the
    INSERT would reach the server at `tenant_session`'s own commit as the block
    exits — raising from a line this test does not name, and out of a `finally`.
    Narrowing the block to the one statement is also what `PT012` asks for, and
    the rule is right here for the reason it usually is: with the whole
    `async with` inside, an exception from `make_sessionmaker` or from the
    listener would have satisfied `pytest.raises` just as well as the policy did.

    The explicit `rollback()` clears the aborted transaction so that the block's
    own commit on exit is a clean no-op rather than a second, less legible
    failure.

    ---------------------------------------------------------------------------
    🔴 THE SECOND HALF: THE SAME QUESTION ON ALL SEVEN TABLES, AND IT IS THE SAME
       HOLE THE POSITIVE CONTROL HAD.
    ---------------------------------------------------------------------------
    The ORM half above writes to `orders` and to nothing else, so an explicit
    `WITH CHECK (true)` on the other six — or the tenant-blind predicate measured
    in this module's docstring, which PostgreSQL reuses as the `WITH CHECK` — let
    every cross-tenant INSERT through and this test stayed green. The loop is the
    same derived set the positive control walks, on the write side.

    THE KEY COLUMN COMES FROM THE DERIVATION, not from a branch on the table
    name: `tenants` is keyed on `id` and the other six on `tenant_id`, and
    `isolation_key_columns` is where that split is worked out once.

    B'S OWN ID IS USED ON THE REGISTRY TOO, AND IT COULD HAVE COME BACK AS A
    DUPLICATE-KEY ERROR INSTEAD. `tenants` has `PRIMARY KEY (id)` and the seed
    has already committed B's row, so the INSERT collides on the key as well as
    on the policy — and `models.py::_TenantRow` records the measurement that
    unique enforcement can be reached before a policy's `WITH CHECK`. MEASURED
    2026-08-06 against postgres:18.4, `titlepipe_app` established as A:

        INSERT INTO tenants (id) VALUES ('2222…');   -- B, already committed
        -> 42501 new row violates row-level security policy for table "tenants"

        INSERT INTO tenants (id) VALUES (<an id nobody holds>);
        -> 42501 new row violates row-level security policy for table "tenants"

    Both are the policy, so no special case is needed and none is written. The
    measurement is recorded because the alternative answer (`23505`) would have
    been a refusal for the wrong reason wearing the right outcome.

    A TRY/EXCEPT RATHER THAN `pytest.raises` IN THE LOOP, deliberately: a
    `pytest.raises` that does not fire reports `DID NOT RAISE DBAPIError` and
    names no table, and "which table let the write through" is the entire content
    of this failure. The outcome is recorded per table and asserted after, so a
    table that accepted the row is reported as such alongside every table that
    refused it.
    """
    engine = make_engine(isolation_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(isolation_tenant_a)) as session:
            session.add(Order(tenant_id=isolation_tenant_b))
            with pytest.raises(DBAPIError) as raised:
                await session.flush()
            await session.rollback()
    finally:
        await engine.dispose()

    sqlstate = getattr(raised.value.orig, "sqlstate", None)
    assert sqlstate == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"tenant {isolation_tenant_a} inserting a row owned by "
        f"{isolation_tenant_b} raised {sqlstate!r}, not "
        f"{INSUFFICIENT_PRIVILEGE_SQLSTATE!r}. A refusal for the wrong reason is "
        f"not this policy working: {raised.value}"
    )
    assert RLS_REFUSAL_FRAGMENT in str(raised.value), (
        f"42501 came back for some reason other than the policy — a missing "
        f"INSERT grant returns the identical code: {raised.value}"
    )

    refusals = await _cross_tenant_insert_refusals(
        isolation_dsn, isolation_key_columns, TenantId(isolation_tenant_a), isolation_tenant_b
    )

    assert set(refusals) == set(EXPECTED_ISOLATION_TABLES), (
        f"the write side was attempted on {sorted(refusals)}, not on "
        f"{sorted(EXPECTED_ISOLATION_TABLES)}. Every assertion below is a loop "
        f"over this set."
    )
    assert len(refusals) >= MINIMUM_ISOLATION_TABLES, (
        f"only {len(refusals)} tables were written to: {sorted(refusals)}"
    )

    for table, (code, message) in sorted(refusals.items()):
        assert code == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
            f"tenant {isolation_tenant_a} wrote a row keyed to "
            f"{isolation_tenant_b} into {table} and got {code!r} rather than "
            f"{INSUFFICIENT_PRIVILEGE_SQLSTATE!r}. A code of None means the write "
            f"was ACCEPTED — one tenant writing rows into another's account at "
            f"will and never seeing them again: {message}"
        )
        assert RLS_REFUSAL_FRAGMENT in message, (
            f"{table} answered 42501 for some reason other than the policy — a "
            f"missing INSERT grant returns the identical code: {message}"
        )


@pytest.mark.asyncio
async def test_3_a_session_with_no_tenant_reads_zero_rows_rather_than_raising(
    isolation_dsn: str,
    isolation_seed: Seed,
    tenant_deny_sentinel: str,
    tenant_guc: str,
) -> None:
    """🔴 ASSERTION 3 — THE `nullif` GUARD. A denial, not a 500.

    Every connection this application opens starts with `app.current_tenant` set
    to the EMPTY STRING, because `make_engine` pins `-c app.current_tenant=` at
    connect time. That is an ASSIGNED empty string, not an unset GUC, and
    `''::uuid` raises `invalid input syntax for type uuid: ""`. So without the
    `nullif` in every `0002` policy, the ordinary unestablished session — a
    health check, a request that failed authentication, the first statement on a
    freshly pooled connection — returns a 500 rather than an empty result.

    BOTH HALVES ARE ASSERTED AND NEITHER IMPLIES THE OTHER: that the GUC really
    is at the deny sentinel (otherwise this describes some other state), and that
    the read came back empty WITHOUT raising. `pytest.raises` is deliberately
    absent — the point is that nothing is raised, and the way to assert that is to
    let an exception fail the test.

    The seed is requested for the reason it always is: zero rows out of an empty
    table is not a denial.
    """
    engine = make_engine(isolation_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            established = (await session.execute(_read_the_guc(tenant_guc))).scalar_one()
            visible = set((await session.scalars(select(Order.id))).all())
            registry = (await session.execute(text("SELECT count(*) FROM tenants"))).scalar_one()
    finally:
        await engine.dispose()

    committed = _every_seeded_id(isolation_seed, "orders")

    assert established == tenant_deny_sentinel, (
        f"this session carries {established!r} rather than the deny sentinel, so "
        f"it is not the state the nullif guards. Anything but NULL or the empty "
        f"string reaches ::uuid and aborts the statement."
    )
    assert visible == set(), (
        f"a session with no tenant established read {sorted(visible)} of the "
        f"{len(committed)} committed orders"
    )
    assert registry == 0, (
        f"a session with no tenant established counted {registry} rows in the "
        f"tenants registry, whose policy keys on `id` rather than on `tenant_id` "
        f"and is the one policy the six others do not cover"
    )


@pytest.mark.asyncio
async def test_4_a_savepoint_rolled_back_leaves_the_tenant_established(
    isolation_dsn: str,
    isolation_seed: Seed,
    isolation_tenant_a: UUID,
    tenant_guc: str,
) -> None:
    """🔴 ASSERTION 4 — THE SAVEPOINT TRAP. First executed here; it was a prediction.

    `ROLLBACK TO SAVEPOINT` unwinds GUC assignments made after the savepoint
    opened, which is why `scripts/check_backend_rules.py` bans `begin_nested(` in
    `src/`. This test is the exemption that rule's subject exists for: `tests/`
    is not scanned, and the trap cannot be demonstrated without a SAVEPOINT.

    WHAT WAS MEASURED HERE, 2026-08-06, AND WHY THE PREDICTION HELD FOR A REASON
    THE CONTRACT DID NOT STATE. The tenant survives the rollback because
    `tenant_session` sets it from `after_begin` on the OUTER transaction, one
    statement before any savepoint exists — so the value the rollback restores is
    the value the savepoint opened with, which is the tenant. The design that
    would fail is the obvious-looking alternative: `SET LOCAL` issued inside a
    nested block, or a listener that only fired for nested transactions. This
    test pins the good case; the ban in `check_backend_rules.py` is what keeps
    `src/` from reaching the bad one.

    THE SAVEPOINT HAS TO ROLL SOMETHING BACK OR THIS TEST IS A NO-OP. An
    `INSERT` inside the nested block is asserted VISIBLE before the rollback and
    ABSENT after it. Without that, a `begin_nested()` that silently did nothing —
    or a rollback that never reached the server — would leave every other
    assertion here true and the savepoint entirely imaginary.

    The re-select after the rollback is on the SAME transaction, which is the
    only place the question means anything: the outer block's own commit is still
    ahead, and a reading taken after it would be a reading of the deny sentinel
    however well the savepoint behaved.

    🔴 THE ROLLBACK IS COMPARED AGAINST `before`, NOT AGAINST THE SEED, AND THAT
       IS AN ORDERING PROPERTY RATHER THAN A PREFERENCE. It was written as
       `after == seeded` first and FAILED — measured 2026-08-06, one extra id in
       the left set. Assertion 1 COMMITS a row for tenant A, on purpose, and
       `isolation_seed` is module-scoped, so how many rows A owns by the time
       this test runs depends on whether assertion 1 has run yet. A test whose
       truth depends on collection order is not a test of the savepoint.

       The seed is used as a FLOOR instead — every row committed for A must be
       visible — which holds under every ordering and still fails if the session
       is scoped to the wrong tenant or to none.

    🔴 B'S ROW IS ASSERTED ABSENT ON BOTH SIDES OF THE ROLLBACK, AND THAT
       ASSERTION WAS ADDED BECAUSE THE SUPERUSER INJECTION CAUGHT ITS ABSENCE.
       MEASURED 2026-08-06: with `isolation_dsn` pointed at the superuser, six of
       the seven assertions failed and THIS ONE PASSED — a floor plus
       `after == before` plus a GUC string is all true of a connection that
       bypasses row-level security entirely and can see all three orders. The
       test was describing the savepoint without describing the scoping.

       `after == before` is still the savepoint property; `B ∩ visible == ∅` is
       what makes "still A's rows" mean A's and not everyone's. With it, the
       injection takes this test down with the other six.
    """
    engine = make_engine(isolation_dsn)
    seeded = _seeded_ids(isolation_seed, "orders", isolation_tenant_a)
    not_mine = _every_seeded_id(isolation_seed, "orders") - seeded
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TenantId(isolation_tenant_a)) as session:
            before = set((await session.scalars(select(Order.id))).all())

            savepoint = await session.begin_nested()
            session.add(Order(tenant_id=isolation_tenant_a))
            await session.flush()
            inside = set((await session.scalars(select(Order.id))).all())
            await savepoint.rollback()

            after = set((await session.scalars(select(Order.id))).all())
            established = (await session.execute(_read_the_guc(tenant_guc))).scalar_one()
    finally:
        await engine.dispose()

    assert seeded <= before, (
        f"the session saw {sorted(before)} before the savepoint, which does not "
        f"include every row committed for tenant {isolation_tenant_a} "
        f"({sorted(seeded)}). Nothing below is then a statement about that tenant."
    )
    assert not_mine & before == set(), (
        f"before the savepoint, a session established as {isolation_tenant_a} "
        f"already saw {sorted(not_mine & before)}, which belongs to the other "
        f"tenant. This connection is not filtered, so nothing after the rollback "
        f"can say it still is."
    )
    assert inside - before != set(), (
        "the row written inside the savepoint was never visible, so the savepoint "
        "rolled nothing back and this test is a no-op"
    )
    assert established == str(isolation_tenant_a), (
        f"after ROLLBACK TO SAVEPOINT the session carries {established!r} rather "
        f"than {str(isolation_tenant_a)!r}. Every statement after this point in "
        f"the same transaction runs under the wrong tenant, or under none."
    )
    assert after == before, (
        f"after the rollback the session sees {sorted(after)}, not the "
        f"{sorted(before)} it saw before it. The savepoint took the tenant with "
        f"it — or did not roll its own INSERT back."
    )
    assert not_mine & after == set(), (
        f"after ROLLBACK TO SAVEPOINT the session sees {sorted(not_mine & after)}, "
        f"which belongs to the other tenant. The GUC string above can be right "
        f"while the connection is not filtered at all — that is exactly what the "
        f"superuser injection produces."
    )


@pytest.mark.asyncio
async def test_5_a_raw_core_connection_establishes_no_tenant_and_sees_nothing(
    isolation_dsn: str,
    isolation_seed: Seed,
    tenant_deny_sentinel: str,
    tenant_guc: str,
) -> None:
    """🔴 ASSERTION 5 — `after_begin` IS ORM-ONLY. First executed here; it was a prediction.

    `after_begin` is a `SessionEvents` hook. It is absent from `ConnectionEvents`
    and from `PoolEvents` alike — `ConnectionEvents.begin` exists, which is the
    trap, because a reader who finds it can conclude they are covered at Core
    level and not be. So `engine.connect()`, Alembic, and any future queue worker
    that reaches for a Core connection get NO tenant applied.

    They are not thereby UNSCOPED, and that is the property this pins: they are
    DENIED, because `make_engine` pins every connection at the deny sentinel the
    moment libpq opens it. A path that skips the ORM sees nothing rather than
    seeing everything, which is the direction to fail in.

    This is not assertion 3 in another spelling. Assertion 3 goes through
    `tenant_session` with `tenant=None`, where the listener runs and deliberately
    establishes nothing; here the listener never runs at all. The two failures are
    different — a broken sentinel breaks this one, a broken `tenant_guc_value`
    breaks that one — and either alone would leave the other's door open.

    A FRESH ENGINE, not the one a session has used. The residual left on a
    REUSED connection after a commit is Task 5's test and is a different
    question; this one is about the door itself.
    """
    engine = make_engine(isolation_dsn)
    try:
        async with engine.connect() as connection:
            established = (await connection.execute(_read_the_guc(tenant_guc))).scalar_one()
            visible = set((await connection.scalars(select(Order.id))).all())
    finally:
        await engine.dispose()

    committed = _every_seeded_id(isolation_seed, "orders")

    assert established == tenant_deny_sentinel, (
        f"a raw Core connection carries {established!r} rather than the deny "
        f"sentinel. make_engine's connect_args pin is what puts it there, and "
        f"without it this connection is one PGOPTIONS away from being a tenant."
    )
    assert visible == set(), (
        f"a raw engine.connect() with no tenant established read {sorted(visible)} "
        f"of the {len(committed)} committed orders. `after_begin` never fired on "
        f"this connection, so nothing scoped it — the only thing between it and "
        f"every tenant's data is the deny sentinel."
    )


@pytest.mark.asyncio
async def test_6_the_app_role_cannot_become_the_owner(
    roles_applied: str, isolation_dsn: str, owner_role: str
) -> None:
    """🔴 ASSERTION 6 — Task 2's OWNERSHIP RULE, from the side that would break it.

    Every table is owned by `titlepipe_owner`, and `FORCE ROW LEVEL SECURITY` is
    what stops that role reading every tenant's rows. `titlepipe_app` becoming
    the owner would not defeat `FORCE` — but it WOULD hand the application role
    `ALTER TABLE`, and `ALTER TABLE orders NO FORCE ROW LEVEL SECURITY` is one
    statement. So the six assertions above rest on this one: they describe a
    configuration the connection under test must not be able to change.

    `roles.sql` makes this hold by granting the owner membership to
    `titlepipe_migration` ALONE, and even that with `INHERIT FALSE, SET TRUE`.
    `titlepipe_app` has no membership at all, which is why the refusal is
    unconditional rather than a question of inheritance.

    THE SQLSTATE IS ASSERTED FIRST AND THE MESSAGE SECOND, deliberately in that
    order. The contract names the message `permission denied to set role`, and
    that string is English — PostgreSQL translates its errors and `lc_messages`
    selects the language, so a server started under a different locale answers
    the identical `42501` in different words and a message-only assertion would
    be testing the container's configuration. MEASURED 2026-08-06 on this
    container (`lc_messages` inherited from the image's default): sqlstate
    `42501`, message `permission denied to set role "titlepipe_owner"`. Both are
    checked because the code alone is also what a missing grant returns, and the
    message is the only thing that says the refusal was about the ROLE.

    A raw `engine.connect()` rather than a session: `SET ROLE` is not something
    the ORM has an opinion about, and this is a question about the connection's
    identity rather than about a tenant.

    ---------------------------------------------------------------------------
    🔴 `roles_applied` IS REQUESTED AND THE VALUE IS NEVER READ. THIS IS THE ONE
       TEST IN THE FILE THAT NEEDS NO ROWS, AND THAT MADE IT THE ONE TEST THAT
       COULD NOT RUN ALONE.
    ---------------------------------------------------------------------------
    Every other assertion here takes `isolation_seed`, which pulls
    `migrated_database` -> `roles_applied` and so applies `roles.sql` on the way
    past. This one asks only about a role membership, so it took `isolation_dsn`
    and nothing else — and `app_dsn` depends on `admin_dsn`, NOT on
    `roles_applied`. MEASURED 2026-08-06, this node run on its own:

        psycopg.OperationalError: connection failed: … FATAL:  password
        authentication failed for user "titlepipe_app"

    Which reads like a broken password and is actually a role that does not
    exist yet: PostgreSQL answers identically for an absent role and a wrong
    one, deliberately, so the error cannot tell you which. It passed in every
    whole-file and whole-suite run because some earlier test had already built
    the fixture — a latent green of exactly the shape `roles_applied`'s own
    docstring is a record of, and it was caught by running each database test
    individually rather than by any ordering of the files.
    """
    engine = make_engine(isolation_dsn)
    try:
        async with engine.connect() as connection:
            with pytest.raises(DBAPIError) as raised:
                # S608 does not apply and neither does a bind parameter: a role
                # name cannot be one in any dialect. `owner_role` is the constant
                # `titlepipe_owner` from `conftest.py` and reaches this from
                # nowhere else.
                await connection.execute(text(f"SET ROLE {owner_role}"))
            await connection.rollback()
    finally:
        await engine.dispose()

    sqlstate = getattr(raised.value.orig, "sqlstate", None)
    assert sqlstate == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"SET ROLE {owner_role} raised {sqlstate!r}, not "
        f"{INSUFFICIENT_PRIVILEGE_SQLSTATE!r}: {raised.value}"
    )
    assert SET_ROLE_REFUSAL_FRAGMENT in str(raised.value), (
        f"42501 came back for some reason other than the role membership — a "
        f"missing table grant returns the identical code: {raised.value}"
    )

"""`RuleRepository` — the global read, proved to be global.

The database is an EPHEMERAL CONTAINER — see `conftest.py`'s database seam. The
module-scoped `migrated_database` fixture applies all three revisions and puts the
database back exactly as it found it. Nothing here is skipped: if Docker or `psql`
is unavailable these tests FAIL, because "we did not check the rulebook today" and
"the rulebook is readable" must never render the same way in a test report.

Every ASSERTION below is made as `titlepipe_app`, through `tenant_session`, which
is the only path an application has to a session. The superuser is used for
SEEDING only — it bypasses row-level security unconditionally, so the `orders`
contrast would prove nothing through it, and it is in any case the only role that
can INSERT into `rules` at all (`0002` grants `titlepipe_app` SELECT and nothing
else there).

## Why this is its own file and not four more tests in `test_tenant_session.py`

That file states its own scope in its opening and disclaims everything else: it
proves THE SEAM — that the GUC is applied inside the transaction, that it does not
survive one, that a returned connection is put back at the sentinel. Its second
paragraph says every assertion in it is made through a tenant. What is proved here
is the opposite claim about the opposite kind of table: that a read of a table with
NO tenancy is unaffected by the tenant, in both directions. It also brings a seed
of its own on a table that file never touches. Adding it there would have meant
qualifying two paragraphs of a 1,200-line docstring to make room for a subject
that is not the seam.

It is NOT a fork of `test_forced_rls_and_grants.py::test_the_rulebook_is_readable
_with_no_tenant_established`, which is the ancestor of the control below and is
cited by it. That test reads `rules` with raw SQL on a raw psycopg connection, and
proves the DATABASE hands the rows over. This one reads them through
`RuleRepository` over a session from `tenant_session`, and proves the CODE PATH an
endpoint will use does not lose them — a distinction with a real gap in it, since
every filter, ordering and scoping decision this plan is about lives in the gap.

## The seed is local, which makes it the third of its shape, deliberately

`tests/conftest.py::_seed_isolation_rows`, `test_forced_rls_and_grants.py
::_seed_rules` and `_seed_rulebook` below all write rows as the superuser and
return what they wrote. They are not one helper because they do not seed the same
thing: this one chooses its ids, writes rows that SHARE a code and a version, and
writes them in an order matching no sort key — all three of which exist for
`test_the_rulebook_comes_back_in_a_total_order`, and a shared seed would have to
grow three parameters that exist for one caller. Sharing them becomes
right when a second caller wants the same rows; `01-WHAT-HAPPENED.md` §3.5's rule
is about a REASON living in two places, and the reason here — the owner's
visibility ruling — is stated once, in `db/rules.py::RuleRepository.list_all`,
and cited rather than restated below.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import NamedTuple
from uuid import UUID

import pytest
from sqlalchemy import Engine, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from titlepipe_core.db import (
    RuleRepository,
    TenantRepository,
    make_engine,
    make_sessionmaker,
    tenant_session,
)
from titlepipe_core.db.models import Order
from titlepipe_domain import TenantId

# The same two tenants `test_tenant_session.py` and `test_forced_rls_and_grants.py`
# use, for the reason they both give: a reader moving between the files should not
# have to work out whether a different literal means something.
TENANT_ONE = TenantId(UUID("11111111-1111-1111-1111-111111111111"))
TENANT_TWO = TenantId(UUID("22222222-2222-2222-2222-222222222222"))

# The four rulebook rows, WITH THEIR IDS CHOSEN RATHER THAN GENERATED.
#
# 🔴 THE SEED USED TO BE THREE ROWS WITH THREE DISTINCT CODES, AND IT COULD NOT
#    TELL `ORDER BY code` FROM A TOTAL ORDER. That is the defect these constants
#    exist to close: `rules` has `PRIMARY KEY (id)` and NOTHING else — no unique
#    constraint and no index on `code` — and it carries a `version`, so rows
#    sharing a code are the shape the schema is built for. Against three distinct
#    codes, `order_by(Rule.code)` and `order_by(Rule.code, Rule.version, Rule.id)`
#    return the identical sequence, so the tiebreaks were decoration.
#
# Four properties, each of which some injection is able to break:
#
# * ONE PER STATUS, because `pending` carries the owner's ruling — a PENDING rule
#   is VISIBLE to everyone and only an engineer may CONFIRM one. A seed of four
#   `live` rows would let a `filter_by(status="live")` anywhere between the table
#   and the caller pass every assertion in this file;
# * TWO ROWS SHARING A CODE at different versions (`R13` v1 and v2), which is what
#   makes the `version` key observable;
# * TWO ROWS SHARING BOTH CODE AND VERSION (`R13` v1 twice), which is what makes
#   the `id` key observable. It is legal on today's schema — see
#   `db/rules.py::RuleRepository.list_all` for the OPEN ITEM about
#   `UNIQUE (code, version)`, which is a domain question Plan 05 owns and which
#   this file deliberately does not pre-empt. The ordering has to be total on the
#   schema that exists;
# * INSERTION ORDER THAT MATCHES NO SORT KEY. PostgreSQL gives an unqualified
#   `SELECT` no order at all, and what a small freshly-written heap returns is
#   insertion order — so a seed written in sorted order would pass against a
#   repository with no `order_by` in it at all.
#
# The IDS ARE LITERALS rather than the column's default, which is what lets the
# expected sequence below be a literal too instead of something sorted in Python
# from what the seed returned. `a < b < c < d` bytewise, which is how PostgreSQL
# compares `uuid`.
RULE_R15_V1 = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
RULE_R13_V2 = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
RULE_R13_V1_LOWER_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
RULE_R13_V1_HIGHER_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")

# `(id, code, version, status)`, IN THE ORDER THE SEED WRITES THEM — which is not
# the order any of the three sort keys produces. `origin` is `spec` throughout: it
# is `NOT NULL`, nothing here reads it, and the seed has to say something.
SEED_ROWS = (
    (RULE_R15_V1, "R15", 1, "retired"),
    (RULE_R13_V1_HIGHER_ID, "R13", 1, "retired"),
    (RULE_R13_V2, "R13", 2, "pending"),
    (RULE_R13_V1_LOWER_ID, "R13", 1, "live"),
)

# What `list_all` must return, in order, as a LITERAL — `(code, version, id)`
# applied to the rows above by hand. Every one of the four keys the implementation
# could be missing produces a different sequence from this one:
#
#     order_by()                          -> a, d, b, c   (the heap: insertion order)
#     order_by(code)                      -> d, b, c, a   (R13 group unordered)
#     order_by(code, version)             -> d, c, b, a   (the `id` tie unbroken)
#     order_by(code, id)                  -> b, c, d, a   (the `version` tie unbroken)
#     order_by(code, version, id)         -> c, d, b, a   (this)
EXPECTED_ORDER = (RULE_R13_V1_LOWER_ID, RULE_R13_V1_HIGHER_ID, RULE_R13_V2, RULE_R15_V1)

# What the seed wrote, as LITERALS, asserted before anything is compared against
# anything. `00-HOW-TO-EXECUTE.md` §1.1 is the general argument; the specific one
# is `test_forced_rls_and_grants.py::test_the_rulebook_is_readable_with_no_tenant
# _established`, whose docstring records that the FIX for its vacuous denial —
# comparing what the seed wrote against what the table held — was ITSELF vacuous,
# because two empty mappings are equal. Every comparison in this file has that
# shape, so every one of them stands on these two numbers.
SEEDED_RULES = 4
SEEDED_ORDERS = 2

# The `pending` row, named rather than counted. A seed that quietly stopped writing
# one would leave the owner's ruling unpinned while `len(...) == 4` still held, so
# the premise names the row and so does the assertion that reads it back.
PENDING_CODE = "R13"
PENDING_VERSION = 2
PENDING_STATUS = "pending"

# The clause that must appear in a GLOBAL repository's refusal and must NOT appear
# in a tenant one's. It is the exact defect a review found in the first shared
# message: rendered for `TenantRepository`, "`tenant` may be None" tells a caller
# over a tenant table that a session established at the deny sentinel — where every
# read is empty and every write is refused — is a fine thing to open.
GLOBAL_ONLY_CLAUSE = "`tenant` may be None"

# For the one test that needs an async ENGINE and no server. `create_async_engine`
# resolves the URL and builds the pool eagerly but does not connect, so the refusal
# happens with nothing open — port 1 on loopback as a role that does not exist
# means a test that accidentally starts connecting fails loudly instead of reaching
# anything real. Same literal and same reason as `test_tenant_session.py`.
UNREACHABLE_DSN = "postgresql+psycopg://nobody@127.0.0.1:1/none"


class SeededRulebook(NamedTuple):
    """What the seed wrote: the rulebook, and the tenant rows that contrast with it.

    `rules` is `id -> (code, version, status)` and `orders` is `tenant -> id`. Both
    are by VALUE rather than by count, because a count of four is satisfied by four
    wrong rows — the point `test_forced_rls_and_grants.py` makes about its own
    ancestor of this seed. `version` is in the value because two rows share a code
    and the pair is what tells them apart.
    """

    rules: Mapping[UUID, tuple[str, int, str]]
    orders: Mapping[UUID, UUID]


def _seed_rulebook(engine: Engine) -> Mapping[UUID, tuple[str, int, str]]:
    """`SEED_ROWS`, committed, as the superuser. Returns `id -> (code, version, status)`.

    AS THE SUPERUSER because `titlepipe_app` holds `SELECT` on `rules` and nothing
    else — `0002`'s grant, asserted by `test_forced_rls_and_grants.py::test_the
    _rulebook_grants_select_to_the_app_role_and_nothing_more`. The role this file
    makes its assertions as cannot write the rows it reads, which is the correct
    shape for a table only a migration and an engineer-confirmed path may change.

    COMMITTED rather than rolled back, because the reader is a DIFFERENT
    connection — an `AsyncEngine` of its own — and an uncommitted row is invisible
    to it. A read of zero rows from a table nothing had written to would prove
    nothing about anything.

    `DELETE` first, so the contents are a function of this call rather than of
    whatever ran before it. `rules` carries no append-only trigger, so unlike
    `audit_log` it can actually be cleared.

    THE `id` IS SUPPLIED RATHER THAN DEFAULTED, which is what lets `EXPECTED_ORDER`
    be a literal. Sorting the seed's own output in Python to build the expectation
    would be a second implementation of the same rule rather than an independent
    statement of it, and `01-WHAT-HAPPENED.md` §5's fourth checklist item is about
    exactly that: an expected value derived from the thing under test asserts
    internal consistency. The column has a server default and nothing here relies
    on it; `RETURNING id` is kept so that what came back is what is compared, and a
    row that landed under some other id fails the mapping rather than the order.

    `RETURNING id` PER ROW rather than one multi-row INSERT, for the reason
    `tests/conftest.py::_seed_isolation_rows` measured against SQLAlchemy 2.0.51: a
    `text()` construct executed with a LIST of parameter dictionaries is an
    executemany, and RETURNING does not come back from one —
    `ResourceClosedError: This result object does not return rows`. The ids are
    what every comparison below is made on, so they have to come back, and a loop
    is how they do.
    """
    seeded: dict[UUID, tuple[str, int, str]] = {}
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM rules"))
        for row_id, code, version, status in SEED_ROWS:
            written = connection.execute(
                text(
                    "INSERT INTO rules (id, code, text, origin, status, version) "
                    "VALUES (:id, :code, :body, 'spec', :status, :version) RETURNING id"
                ),
                {
                    "id": row_id,
                    "code": code,
                    "body": f"{code} v{version} exists so that this control has a row to read",
                    "status": status,
                    "version": version,
                },
            ).scalar_one()
            seeded[UUID(str(written))] = (code, version, status)
    return seeded


def _seed_two_tenants(engine: Engine) -> Mapping[UUID, UUID]:
    """One committed `orders` row per tenant, as the superuser. Returns `tenant -> id`.

    THIS IS THE CONTRAST HALF AND IT IS NOT OPTIONAL. "Every seeded rule comes
    back" is equally true of a database with no tenant isolation anywhere, which is
    exactly the failure `00-HOW-TO-EXECUTE.md` §1.1 measured — three of Plan 01's
    nine assertions passed with the tenant mechanism torn out, every one of them a
    pure denial. Reading a TENANT table in the same session, in the same state, is
    what makes the pair unsatisfiable by a broken database: one statement returns
    everything and the next returns nothing, and only a live `tenant_isolation`
    policy on `orders` together with a deliberate absence of one on `rules`
    produces that.

    `orders` and not `audit_log` for the reason `test_tenant_session.py` gives:
    `0001` puts an append-only trigger on `audit_log`, which refuses the `DELETE`.

    Two tenants rather than one, so that the real-tenant test below has a row it
    must NOT see beside the row it must.
    """
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM orders"))
        rows = connection.execute(
            text("INSERT INTO orders (tenant_id) VALUES (:one), (:two) RETURNING tenant_id, id"),
            {"one": TENANT_ONE, "two": TENANT_TWO},
        ).all()
    return {UUID(str(row[0])): UUID(str(row[1])) for row in rows}


@pytest.fixture
def seeded_rulebook(migrated_database: str, seam_engine: Callable[[str], Engine]) -> SeededRulebook:
    """Both seeds, with every premise checked HERE before any test reads a row.

    ---------------------------------------------------------------------------
    🔴 THE FLOORS ARE LITERALS AND THEY ARE ASSERTED BEFORE ANYTHING IS COMPARED.
    ---------------------------------------------------------------------------
    This is the fixture's whole reason for existing rather than the tests calling
    the two seeds directly. Every assertion in this file is an equality between
    what a seed wrote and what a session saw, and `{} == {}` is true: a seed that
    silently wrote nothing turns all four tests green while proving nothing.
    MEASURED as a class of defect in
    `test_forced_rls_and_grants.py::test_the_rulebook_is_readable_with_no_tenant
    _established`, whose docstring records `1 passed` TWICE — once for the vacuous
    denial and once for the repair that was equally vacuous.

    In a fixture rather than repeated in four test bodies, because a premise that
    is copied four times is a premise that gets three of its copies edited. A
    failure here is reported as an ERROR in setup, which is louder than a
    failure and names this fixture.

    THE ORDERS ROWS ARE READ BACK ON THE ADMIN CONNECTION, and that is a separate
    assertion from the `RETURNING` above. The superuser bypasses row-level
    security unconditionally, so that read is a statement about what is IN the
    table rather than about what a policy permits — which is what the app
    session's zero has to be measured against. Without it, "the app saw no orders"
    is satisfied by an empty table, a broken DSN and a missing grant just as
    readily as by isolation.

    The rulebook rows need no such read-back: the assertion that consumes them is
    a POSITIVE comparison against these exact ids, so a seed that failed to write
    them fails the comparison rather than passing it vacuously — once the count
    below has ruled out the empty case.
    """
    engine = seam_engine(migrated_database)
    try:
        rules = _seed_rulebook(engine)
        orders = _seed_two_tenants(engine)
        with engine.connect() as connection:
            present_orders = {
                UUID(str(row[0])): UUID(str(row[1]))
                for row in connection.execute(text("SELECT tenant_id, id FROM orders"))
            }
    finally:
        engine.dispose()

    assert len(rules) == SEEDED_RULES, (
        f"the rulebook seed wrote {len(rules)} rows, not {SEEDED_RULES}: {sorted(rules.values())}. "
        f"Every comparison in this file is `what the session saw == what the seed wrote`, and an "
        f"empty seed makes each of them an equality between two empty mappings."
    )
    assert (PENDING_CODE, PENDING_VERSION, PENDING_STATUS) in rules.values(), (
        f"the rulebook seed wrote no {PENDING_STATUS} row, so nothing in this file pins the "
        f"owner's ruling that a PENDING rule is VISIBLE to everyone — a `filter_by(status='live')` "
        f"in RuleRepository.list_all would pass every test here. Seeded: {sorted(rules.values())}"
    )
    assert set(rules) == set(EXPECTED_ORDER), (
        f"the seed wrote the ids {sorted(rules)}, which are not the {sorted(EXPECTED_ORDER)} that "
        f"EXPECTED_ORDER sequences. The ordering assertion compares a literal against these rows, "
        f"so a seed writing different ids would make it a statement about nothing."
    )
    assert len(orders) == SEEDED_ORDERS, (
        f"the orders seed wrote {len(orders)} tenants, not {SEEDED_ORDERS}: {sorted(orders)}. The "
        f"contrast below asserts that a global read works WHILE tenancy is still on, and it cannot "
        f"say the second half against a table nothing wrote to."
    )
    assert present_orders == orders, (
        f"the superuser — which bypasses row-level security unconditionally — saw {present_orders} "
        f"in orders, not the {orders} the seed wrote. This is the premise of the contrast: without "
        f"it, the app session's zero is satisfied by an empty table."
    )

    return SeededRulebook(rules=rules, orders=orders)


@pytest.mark.asyncio
async def test_the_rulebook_comes_back_whole_under_a_session_with_no_tenant(
    app_dsn: str, seeded_rulebook: SeededRulebook
) -> None:
    """🔴 THE POSITIVE CONTROL, WITH THE CONTRAST ON THE SAME SESSION.

    The claim Task 2 exists to prove: a global read genuinely does not depend on a
    tenant. `tenant_session(sessionmaker, None)` is legal and ordinary — it is what
    `GET /api/rules` will pass, because that endpoint has no principal — and under
    it every seeded rule must come back.

    ON ITS OWN THAT IS SATISFIED BY A DATABASE WHERE NOTHING IS SCOPED AT ALL, which
    is `00-HOW-TO-EXECUTE.md` §1.1's finding pointed the other way: a denial cannot
    tell isolated from broken, and neither can a permission. So `orders` — seeded
    for two tenants and read back through the superuser in the fixture — is read on
    the SAME session in the SAME state and must be EMPTY. One session, two opposite
    answers. Remove `0002`'s policy from `orders` and the second assertion goes red
    while the first stays green; give `rules` a policy and the first goes red while
    the second stays green. Nothing satisfies both by accident.

    THE COMPARISON IS BY ID, CODE, VERSION AND STATUS, not by count. Four rows is
    satisfied by four wrong rows, and the status is half of what is being asserted:
    a `pending` row missing from this set is the owner's visibility ruling being
    quietly reversed, and it fails here NAMING the row that was hidden.

    ---------------------------------------------------------------------------
    🔴 AND THE ROWS MUST BE IN THE SCOPED SESSION'S IDENTITY MAP, WHICH IS THE ONLY
       THING IN THIS FILE THAT PROVES THE READ WENT THROUGH THAT SESSION AT ALL.
    ---------------------------------------------------------------------------
    `RuleRepository.__init__`'s refusal is a CONSTRUCTION-TIME check: it can see the
    session it is handed and nothing about what `list_all` does afterwards. MEASURED
    at review, 2026-08-06 — `list_all`'s body replaced with a session of its own off
    the same engine:

        own = async_sessionmaker(self._session.bind, expire_on_commit=False)()
        rules = await own.scalars(select(Rule).order_by(...))
        -> 4 passed

    Both positive controls included. That is precisely the "a repository that opens
    its own connection bypasses the one place tenancy is applied" shape Task 2 names
    as the thing to forbid, and every assertion in this file was blind to it —
    globality is a property a NEW session on the same engine also has. Pool
    exhaustion is not a backstop either: even at `pool_size=1, max_overflow=0` the
    injection passes, because `list_all` is the first statement in the block and the
    outer session has not checked a connection out yet.

    `rule in session` is `Session.__contains__`, which answers whether the instance
    is in THIS session's identity map. An object loaded through another session is
    not, so the check costs no round trip and no second query. It is a WIRING
    assertion of the same kind as the constructor's mark, one layer further in.

    Read INSIDE the block, all of it. `make_sessionmaker` sets
    `expire_on_commit=False`, so the attributes survive the exit — that path is
    `test_the_rows_are_readable_after_the_block_has_committed_and_closed`'s, and it
    is a different claim. The identity-map check has to happen while the session is
    open, because it is about that session.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            rules = await RuleRepository(session).list_all()
            visible = {rule.id: (rule.code, rule.version, rule.status) for rule in rules}
            in_this_session = [rule in session for rule in rules]
            tenant_rows = list((await session.scalars(select(Order.id))).all())
    finally:
        await engine.dispose()

    assert len(in_this_session) == SEEDED_RULES, (
        f"the identity-map check covered {len(in_this_session)} rows rather than {SEEDED_RULES}; "
        f"`all([])` is True, so an empty read would satisfy the assertion below while proving "
        f"nothing about which session the statement ran under"
    )
    assert all(in_this_session), (
        f"rows not owned by the scoped session: {in_this_session} over {len(rules)} rows. "
        f"RuleRepository.list_all read them through some other session — one it opened itself off "
        f"the same engine, most likely — so the session `tenant_session` established a tenant on "
        f"is not the session the statement ran under. Every other assertion in this file passes "
        f"under that defect, because a global table looks the same from any session."
    )

    # 🔴 THE `pending` ROW, ASSERTED BY NAME IN WHAT CAME BACK, and asserted BEFORE
    # the set comparison so that a hidden PENDING rule is what the failure is
    # ABOUT rather than one line of a set diff. The equality below subsumes it
    # arithmetically and does not subsume it diagnostically: the ruling this pins —
    # a PENDING rule is VISIBLE to everyone, only an engineer may CONFIRM one — is
    # the one a later `filter_by(status="live")` would reverse while looking like a
    # tidy-up, and whoever reads that red should meet the ruling, not a diff.
    assert (PENDING_CODE, PENDING_VERSION, PENDING_STATUS) in visible.values(), (
        f"the read returned {sorted(visible.values())}, which does not include "
        f"({PENDING_CODE!r}, {PENDING_VERSION!r}, {PENDING_STATUS!r}). The owner ruled that a "
        f"PENDING rule is VISIBLE "
        f"to everyone and that only an engineer may CONFIRM one — CLAUDE.md's 'PENDING rules "
        f"cannot affect the pipeline' is about EFFECT, not visibility. TWO FAULTS REACH THIS "
        f"LINE and the list above tells them apart: an EMPTY list is a policy on `rules`, which "
        f"hides every row from every session, and the set comparison below names that one; a list "
        f"holding the OTHER statuses is a `filter_by(status='live')` between the table and this "
        f"caller, which is this ruling being reversed and is what this assertion is for."
    )
    assert visible == seeded_rulebook.rules, (
        f"a session with NO tenant established read {len(visible)} of "
        f"{len(seeded_rulebook.rules)} seeded rules. The rulebook is GLOBAL: nothing scopes it and "
        f"nothing filters it on read, so every row must come back whatever tenant the session "
        f"names. Missing rows mean either a policy on `rules` — under which every session reads "
        f"zero, because GET /api/rules establishes no tenant — or a filter in "
        f"RuleRepository.list_all. saw={visible} seeded={seeded_rulebook.rules}"
    )
    assert tenant_rows == [], (
        f"the SAME session, in the SAME state, saw {len(tenant_rows)} rows in `orders`, which the "
        f"fixture has just proved are in the table. Tenancy is off, and with it off 'every rule "
        f"came back' is equally true of a database that scopes nothing — the exact failure "
        f"00-HOW-TO-EXECUTE.md §1.1 measured. saw={tenant_rows}"
    )


@pytest.mark.asyncio
async def test_the_rulebook_is_the_same_complete_set_under_a_real_tenant(
    app_dsn: str, seeded_rulebook: SeededRulebook
) -> None:
    """Globality is not an accident of the deny sentinel. A REAL tenant sees it all too.

    A DIFFERENT CLAIM FROM THE TEST ABOVE, and the difference is the point. That one
    proves a tenant is not REQUIRED; this one proves a tenant does not FILTER. A
    `rules` table that had been given a `tenant_id` and a `tenant_isolation` policy
    would pass neither — but so would one given only a policy keyed on something
    else, and the failures would read differently. This is the assertion that goes
    red the day anybody scopes the rulebook, and it names the rows that went
    missing.

    ITS OWN POSITIVE CONTROL IS THE `orders` READ, and it is the mirror of the
    contrast above rather than a repeat of it. Here the tenant IS established, so
    `TENANT_ONE`'s own row must come back and `TENANT_TWO`'s must not — which is
    what proves the session really was scoped. Without it, "a real tenant sees every
    rule" would also be true of a session where the tenant was never applied at
    all: the deny sentinel and a working tenant are indistinguishable to a table
    that nothing scopes, and this whole file reads such a table.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, TENANT_ONE) as session:
            rules = await RuleRepository(session).list_all()
            visible = {rule.id: (rule.code, rule.version, rule.status) for rule in rules}
            own_rows = list((await session.scalars(select(Order.id))).all())
    finally:
        await engine.dispose()

    assert visible == seeded_rulebook.rules, (
        f"a session established as {TENANT_ONE} read {len(visible)} of "
        f"{len(seeded_rulebook.rules)} seeded rules. The rulebook is GLOBAL, so establishing a "
        f"tenant must not remove a row from it — a subset here means `rules` has acquired a "
        f"policy, a tenant_id, or a scoping join. saw={visible} seeded={seeded_rulebook.rules}"
    )
    assert own_rows == [seeded_rulebook.orders[TENANT_ONE]], (
        f"the session that just read the whole rulebook saw {own_rows} in `orders`, not "
        f"[{seeded_rulebook.orders[TENANT_ONE]}], its own row. This is what says the tenant was "
        f"genuinely established: with no tenant applied the read above is 'complete' for the "
        f"trivial reason that nothing is scoping anything. The other tenant's row is "
        f"{seeded_rulebook.orders[TENANT_TWO]}."
    )


@pytest.mark.asyncio
async def test_the_rulebook_comes_back_in_a_total_order(
    app_dsn: str, seeded_rulebook: SeededRulebook
) -> None:
    """`(code, version, id)` — a TOTAL order, against a table written in another.

    An unqualified `SELECT` has no guaranteed order in PostgreSQL, so a response
    body built from one is reproducible only by luck — and Task 3's contract-parity
    fixture and Task 4's response both need the same bytes twice. The ordering is a
    WIRE-STABILITY decision, argued where it is made
    (`db/rules.py::RuleRepository.list_all`) and not restated here.

    ---------------------------------------------------------------------------
    🔴 THIS TEST ASSERTED `ORDER BY code` AND COULD NOT HAVE CAUGHT THE DEFECT IT
       WAS WRITTEN FOR, because the seed used three DISTINCT codes.
    ---------------------------------------------------------------------------
    `rules` has `PRIMARY KEY (id)` and no other constraint or index — see
    `migrations/versions/0003_rules.py` — and carries a `version`, so two rows may
    share a `code` and, today, a `(code, version)` as well. Against distinct codes,
    `order_by(code)` and `order_by(code, version, id)` return the identical
    sequence, so the assertion was true of an ordering that is not total and a
    response whose bytes move when a row is merely UPDATED (an update writes a new
    heap tuple, so the row goes to the end of an unordered read).

    `SEED_ROWS` now writes four rows sharing codes and versions, in an order that
    matches no sort key, and `EXPECTED_ORDER` lists what each candidate ordering
    would produce. All four wrong ones differ from it, which is what makes each of
    them injectable.

    THE EXPECTATION IS A LITERAL, not the seed's output sorted in Python. Sorting
    it here would be a second implementation of the rule under test —
    `01-WHAT-HAPPENED.md` §5, "never compare a value to something derived from the
    same source" — so the ids are chosen in the seed and the order is worked out by
    hand beside them.

    The ids rather than the codes: two rows share `R13` at version 1, so a
    code-and-version sequence cannot say which of them came first, which is exactly
    the tie the `id` key exists to break.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            returned = await RuleRepository(session).list_all()
            # Read INSIDE the block, deliberately. Attribute expiry at commit is a
            # different property with a test of its own, and reading here keeps a
            # failure of THIS test about the order rather than about detachment —
            # measured: with `expire_on_commit=True` injected and these reads
            # outside the block, this test failed with `DetachedInstanceError`,
            # which names nothing about ordering.
            order = [rule.id for rule in returned]
            legible = [(rule.code, rule.version, str(rule.id)[:8]) for rule in returned]
    finally:
        await engine.dispose()

    # `(code, version, first eight of the id)` per row, which is what makes a
    # failure readable — four raw uuids differing only in their first nibble are
    # not something anybody diffs by eye. Both sides are rendered the same way.
    seeded_row = {row_id: (code, version) for row_id, code, version, _ in SEED_ROWS}
    expected_legible = [(*seeded_row[row_id], str(row_id)[:8]) for row_id in EXPECTED_ORDER]
    assert order == list(EXPECTED_ORDER), (
        f"the rulebook came back as {legible}, not {expected_legible}, which is what (code, "
        f"version, id) sorts the seeded rows to. They were WRITTEN in the order "
        f"{[(code, version, str(row_id)[:8]) for row_id, code, version, _ in SEED_ROWS]}. Each "
        f"missing key produces a different sequence and SEED_ROWS lists which: no ordering at all "
        f"gives the heap, `code` alone leaves the three R13 rows unordered, `(code, version)` "
        f"leaves the two R13 v1 rows unordered, and `(code, id)` puts R13 v2 before R13 v1. A "
        f"response body under a contract-parity fixture has to be the same bytes twice."
    )
    assert len(order) == SEEDED_RULES, (
        f"{len(order)} rows came back rather than {SEEDED_RULES}; an ordering assertion over a "
        f"short list is an assertion about the rows that are there and says nothing about the ones "
        f"that are not"
    )


@pytest.mark.asyncio
async def test_the_rows_are_readable_after_the_block_has_committed_and_closed(
    app_dsn: str, seeded_rulebook: SeededRulebook
) -> None:
    """🔴 THE SHAPE TASK 4 WILL USE, AND NOTHING ELSE IN THIS FILE COVERS IT.

    A route reads the rows inside the `tenant_session` block and SERIALISES them
    after it — the block is the unit of work and the response is built once it has
    committed and closed. Every other test here reads the attributes while the
    session is still open, which is the one place a detached-instance failure
    cannot happen.

    What makes it work is `expire_on_commit=False` on `make_sessionmaker`. With
    SQLAlchemy's default of `True`, `commit()` expires every attribute on every
    instance and the first read AFTER the block issues a refresh on a closed
    session: `DetachedInstanceError: Instance <Rule> is not bound to a Session;
    attribute refresh operation cannot proceed`. That flag is pinned by two
    pre-existing tests in `test_tenant_session.py`, so this is not a second
    guardian of it; what this adds is the assertion that the ROWS THIS REPOSITORY
    RETURNS survive their own session, which is a contract of `list_all` rather
    than of the sessionmaker, and is this file's to keep rather than Task 4's to
    discover.

    `code`, `version`, `status` AND `text` are read, not one of them: expiry is
    per-attribute and a test that touched only the identity would pass against a
    row whose payload had been expired. `text` is the biggest column and the one a
    response actually carries.
    """
    engine = make_engine(app_dsn)
    try:
        sessionmaker = make_sessionmaker(engine)
        async with tenant_session(sessionmaker, None) as session:
            rules = await RuleRepository(session).list_all()
        # The block has exited: it COMMITTED and then CLOSED the session, and every
        # attribute read below happens on a detached instance.
        after = {rule.id: (rule.code, rule.version, rule.status) for rule in rules}
        bodies = {rule.id: rule.text for rule in rules}
    finally:
        await engine.dispose()

    assert after == seeded_rulebook.rules, (
        f"read after the tenant_session block exited, the rows are {after}, not the "
        f"{seeded_rulebook.rules} the seed wrote. This is the path GET /api/rules takes — the "
        f"handler serialises after the unit of work commits — so a difference here is a difference "
        f"in the response body."
    )
    assert all(bodies.values()), (
        f"one of the rules came back with an empty `text` after the session closed: {bodies}. "
        f"Attribute expiry is per-attribute, so an identity that survived says nothing about the "
        f"payload a response is built from."
    )


@pytest.mark.asyncio
async def test_a_rule_repository_over_a_session_that_did_not_come_from_tenant_session_is_refused() -> (
    None
):
    """The refusal is the SHARED check, and the message names THIS class.

    A global table does not get an un-scoped connection. `make_sessionmaker` is in
    `titlepipe_core.db.__all__` and an `async_sessionmaker` is callable, so an
    `AsyncSession` with no `after_begin` listener is reachable — and on such a
    session nothing has moved the tenant GUC off whatever the connection was handed
    back to the pool holding. `tenant_session` is the only thing in this package
    that establishes a tenant, including the `None` that means deny, so a
    repository built over any other session is where that stops being true.

    TWO ASSERTIONS, AND THE SECOND IS THE ONE ABOUT THE HELPER. `RuntimeError`
    naming `tenant_session` is the same refusal `TenantRepository` makes, and the
    check is shared rather than copied — `_refuse_unscoped_session` formats the
    class it was called from. So the message must name `RuleRepository` and must
    NOT name `TenantRepository`: a message that still said `TenantRepository` would
    be the shared helper working and the sentence not, and a message that said
    `RuleRepository` from a second hand-written copy would pass the first assertion
    while the checklist item this is written against — "a shared helper
    re-implemented locally instead of imported" — was violated. The first is
    checkable from here; the second is checked by the injection recorded in the
    task, which deletes the raise from the helper and requires THIS test to fail.

    NO DATABASE IS TOUCHED, which is a property of the check rather than a
    convenience: `async_sessionmaker(...)()` builds a session object without
    acquiring a connection, so an unreachable DSN is enough. Making the check
    `async` and asking the server for `current_setting` instead would put a round
    trip inside a constructor.
    """
    engine = create_async_engine(UNREACHABLE_DSN)
    try:
        unscoped = async_sessionmaker(engine, expire_on_commit=False)()
        with pytest.raises(RuntimeError, match="tenant_session") as refusal:
            RuleRepository(unscoped)
        await unscoped.close()
    finally:
        await engine.dispose()

    message = str(refusal.value)
    assert RuleRepository.__name__ in message, (
        f"the refusal reads {message!r}, which does not name the class that was constructed. The "
        f"check is shared with TenantRepository and formats the caller's own class name so that a "
        f"third repository names itself; a message that names nothing is a message somebody will "
        f"copy and edit."
    )
    # The old message spelled `TenantRepository` into the sentence. A second class
    # reusing it could only do so by copying it and changing one word, and the copy
    # is what stops being edited when the reason moves.
    assert "TenantRepository" not in message, (
        f"the refusal reads {message!r} and names TenantRepository, which is not what was "
        f"constructed. Either the message is a hardcoded sentence again or RuleRepository has "
        f"acquired a base class it is documented not to have."
    )


def _refusal_message(repository: Callable[[AsyncSession], object], engine: AsyncEngine) -> str:
    """Construct `repository` over an unscoped session and return the refusal text.

    A helper because three tests below need the same six lines and the interesting
    part of each is what it then asserts about the string. It takes the engine
    rather than making one: `create_async_engine` is cheap but an engine per call
    is an engine per call to dispose of, and the caller already has one.
    """
    unscoped = async_sessionmaker(engine, expire_on_commit=False)()
    with pytest.raises(RuntimeError) as refusal:
        repository(unscoped)
    return str(refusal.value)


@pytest.mark.asyncio
async def test_the_refusal_diagnoses_the_caller_it_was_raised_for() -> None:
    """🔴 THE CHECK IS SHARED. THE SENTENCE IS NOT, AND SHARING IT WAS A DEFECT.

    The first version of `_refuse_unscoped_session` formatted ONE message for both
    callers, and that message was written for the global one. Rendered for
    `TenantRepository` it read "A GLOBAL table does not make that milder … `tenant`
    may be None" — a non sequitur for a tenant table, and worse than useless in its
    second clause: it tells a caller over a tenant table that a session at the deny
    sentinel is a fine thing to open, when for that caller it is the state where
    every read is empty and every write is refused by a policy. The clause that WAS
    actionable there — nothing it reads or writes is scoped — had been deleted to
    make room for it.

    NOTHING CAUGHT IT. The only assertions on this message, here and in
    `test_tenant_session.py`, matched the substring `tenant_session`, which both
    renderings contain — the "a check that matched a NAME" family that
    `01-WHAT-HAPPENED.md` §5 lists five instances of.

    So both renderings are asserted, and the three claims are the ones that can rot
    back: each names its own class, only the global one carries the clause that is
    only true globally, and THE TWO DIFFER. The last is the actual property — that
    the diagnosis is the caller's — and it is the one a future edit collapsing them
    back into one constant fails on, whatever the wording is by then.

    NEITHER RENDERING IS COMPARED TO THE CONSTANT IT WAS BUILT FROM. Asserting
    `message == _UNSCOPED_SESSION.format(...)` would be the module under test
    agreeing with itself, which is §5's fourth checklist item.
    """
    engine = create_async_engine(UNREACHABLE_DSN)
    try:
        global_message = _refusal_message(RuleRepository, engine)
        tenant_message = _refusal_message(lambda session: TenantRepository(session, Order), engine)
    finally:
        await engine.dispose()

    assert RuleRepository.__name__ in global_message, (
        f"the global repository's refusal reads {global_message!r} and does not name it"
    )
    assert TenantRepository.__name__ in tenant_message, (
        f"the tenant repository's refusal reads {tenant_message!r} and does not name it"
    )
    assert GLOBAL_ONLY_CLAUSE in global_message, (
        f"the global repository's refusal reads {global_message!r}, which does not say "
        f"{GLOBAL_ONLY_CLAUSE!r}. `GET /api/rules` has no principal and passes None; a refusal "
        f"that reads 'name a tenant' sends that caller to invent one."
    )
    assert GLOBAL_ONLY_CLAUSE not in tenant_message, (
        f"the tenant repository's refusal reads {tenant_message!r}, which tells a caller over a "
        f"TENANT table that {GLOBAL_ONLY_CLAUSE!r}. On a tenant table that session reads nothing "
        f"and writes nothing — it is the deny state, not an option. This is the shared sentence "
        f"being shared again."
    )
    assert global_message != tenant_message, (
        "both repositories raise the identical sentence, so the diagnosis is not the caller's. "
        "The CHECK is meant to be shared and the CONSEQUENCE is not; see the comment above "
        "_UNSCOPED_SESSION for the rendering that was wrong for one of its two callers."
    )


class _ProbeRepository(TenantRepository[Order]):
    """A subclass that exists only to be refused, and is defined for that.

    `_refuse_unscoped_session` takes the INSTANCE and reads `type(...).__name__`
    rather than taking a string, and the justification for that is a subclass
    naming itself without anybody remembering to. With only two call sites in the
    tree, a string literal at each would behave identically — so the justification
    was untested and the design decision unpinned. This is the case that separates
    them. It adds no behaviour: everything it does is `TenantRepository`'s.
    """


@pytest.mark.asyncio
async def test_a_subclass_of_the_base_names_itself_in_its_own_refusal() -> None:
    """The subclass case, which is the only thing `type(self).__name__` buys.

    Assert on `_ProbeRepository.__name__` rather than on the literal string, so a
    rename of the class moves the expectation with it and cannot leave this test
    asserting an old name that nothing raises any more.
    """
    engine = create_async_engine(UNREACHABLE_DSN)
    try:
        message = _refusal_message(lambda session: _ProbeRepository(session, Order), engine)
    finally:
        await engine.dispose()

    assert _ProbeRepository.__name__ in message, (
        f"a subclass of TenantRepository was refused with {message!r}, which names its BASE rather "
        f"than the class the caller actually constructed. That is what a hardcoded name at the "
        f"call site does, and it is the reason the helper takes the instance."
    )

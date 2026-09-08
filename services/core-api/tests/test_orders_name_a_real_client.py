"""An order names a client OF ITS OWN TENANT, and the database is what says so.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS. At head `0102`, `orders.client_id` and
   `client_config_versions.client_id` referenced nothing. An order in tenant A
   holding tenant B's REAL client id was a writable row, and so was one holding
   an id issued nowhere. `0008` and `0080` both record the gap and both describe
   it as "an order naming a client that does not exist"; the cross-tenant form
   was written down in neither.
---------------------------------------------------------------------------

## Why it is worse than a dangling reference

`clients` holds `delivery_method`, `delivery_config` and `template_ref` — the
DESTINATION a rendered report is transmitted to. Row-level security filters the
join today, so this was not a read breach; it was a stored row that only a policy
stood between and one shop's deliverable arriving at another shop's customer.
`CONVENTIONS.md` §1 draws the line exactly there: the composite key puts
`tenant_id` on both sides of one constraint, so the row cannot be WRITTEN — which
holds for `titlepipe_owner`, for a migration, and with row-level security off.

## Everything here connects as the container SUPERUSER

`test_field_citation_is_whole.py`'s reason, and it is sharper for this file than
for that one: a superuser bypasses RLS unconditionally, so **every refusal below
is the foreign key and cannot be the policy**. A test that proved this through
`titlepipe_app` would be satisfied by the tenant policy alone and would still
pass on the schema this file exists to reject.

## What was watched go RED, and against what

* `0110`'s two `op.create_foreign_key` calls commented out, suite otherwise
  untouched: the three refusal tests failed with `DID NOT RAISE <class
  'sqlalchemy.exc.DBAPIError'>` — the cross-tenant row was ACCEPTED, which is
  the finding reproduced inside the suite — and
  `test_the_client_foreign_keys_exist_and_are_validated` failed naming the two
  absent constraints. The positive control and the `FORCE` test passed there and
  here, which is what says the constraint refuses the wrong row ONLY.
* `test_the_upgrade_refuses_a_database_that_already_holds_a_bad_row` was run
  against a `0110` whose `NO FORCE` / `FORCE` pair was deleted — the naive
  spelling of the revision. It failed with `DID NOT RAISE`: the `ALTER TABLE`
  reported success over a violating row, and `pg_constraint.convalidated` came
  back `t`. That is the whole reason the revision is written the way it is, and
  it is the one assertion here that a catalog read cannot substitute for.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

FOREIGN_KEY_VIOLATION_SQLSTATE = "23503"

# The revision under test and the one immediately before it. Literals rather than
# `"head"` and `"-1"`: another worker's revision landing on top of this one would
# silently retarget both, and the round-trip test below would then be about
# somebody else's migration.
REVISION = "0110"
BEFORE = "0102"

# The two constraints `0110` adds, spelled out. `test_field_citation_is_whole.py`
# gives the reason for writing a constraint name as a literal rather than
# importing it: it is the leg that catches a rename made to the model and the
# migration together.
ORDER_CONSTRAINT = "fk_orders_tenant_id_client_id_clients"
CONFIG_CONSTRAINT = "fk_client_config_versions_tenant_id_client_id_clients"

# Both children and the parent. `0110` drops `FORCE` on all three for the length
# of its validation scan, and a revision that failed to put one back would leave
# `titlepipe_owner` — one `SET ROLE` from a LOGIN role — exempt from that table's
# tenant policy, silently and permanently.
FORCED_TABLES = ("orders", "client_config_versions", "clients")

TENANT_A = uuid.UUID("aaaaaaaa-0000-4000-8000-00000000000a")
TENANT_B = uuid.UUID("bbbbbbbb-0000-4000-8000-00000000000b")

# An id no `clients` row holds, in either tenant.
ISSUED_NOWHERE = uuid.UUID("dddddddd-0000-4000-8000-00000000dead")


@pytest.fixture(scope="module")
def two_tenants(migrated_database: str, seam_engine: Callable[[str], Engine]) -> Iterator[Engine]:
    """A superuser engine with one client and one product committed per tenant.

    Committed rather than rolled back because each test opens its own connection.
    The product is here because `client_config_versions.product_id` carries its
    own composite key from `0051` — without a product in the same tenant, every
    config-version test below would come back `23503` naming the WRONG
    constraint, which is the failure mode this file is least able to notice.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            for tenant in (TENANT_A, TENANT_B):
                connection.execute(
                    text(
                        "INSERT INTO clients "
                        "(tenant_id, name, delivery_method, report_shape) "
                        "VALUES (:tenant, 'TEST-ONLY', 'TEST-ONLY', 'TEST-ONLY')"
                    ),
                    {"tenant": tenant},
                )
                connection.execute(
                    text(
                        "INSERT INTO products "
                        "(tenant_id, code, name, period_kind, is_active) VALUES "
                        "(:tenant, 'TEST-ONLY-' || :tenant, 'TEST-ONLY', "
                        "'root_of_title', false)"
                    ),
                    {"tenant": tenant},
                )
        yield engine
    finally:
        engine.dispose()


def _client_id(connection: Connection, tenant: uuid.UUID) -> uuid.UUID:
    """The one client this module wrote for `tenant`."""
    return uuid.UUID(
        str(
            connection.execute(
                text("SELECT id FROM clients WHERE tenant_id = :tenant"), {"tenant": tenant}
            ).scalar_one()
        )
    )


def _product_id(connection: Connection, tenant: uuid.UUID) -> uuid.UUID:
    """The one product this module wrote for `tenant`."""
    return uuid.UUID(
        str(
            connection.execute(
                text("SELECT id FROM products WHERE tenant_id = :tenant"), {"tenant": tenant}
            ).scalar_one()
        )
    )


def _insert_order(connection: Connection, tenant: uuid.UUID, client_id: uuid.UUID) -> None:
    """One complete order for `tenant` naming `client_id`, whoever holds it.

    NOT `minimal_rows.insert_order`: that statement writes its own client in a
    CTE precisely so a caller cannot pair an order with a foreign one, which is
    the pairing every test in this file is about.
    """
    connection.execute(
        text(
            "INSERT INTO orders "
            "(tenant_id, client_id, external_ref, jurisdiction, state_code, "
            " county, status, arrived_at) "
            "VALUES (:tenant, :client_id, 'TEST-ONLY-' || gen_random_uuid(), "
            "'TEST-ONLY', 'ZZ', 'TEST-ONLY', 'received', now())"
        ),
        {"tenant": tenant, "client_id": client_id},
    )


def _insert_config_version(connection: Connection, tenant: uuid.UUID, client_id: uuid.UUID) -> None:
    """One config version for `tenant` naming `client_id`, whoever holds it."""
    connection.execute(
        text(
            "INSERT INTO client_config_versions "
            "(tenant_id, client_id, product_id, version, is_current) "
            "VALUES (:tenant, :client_id, :product_id, 1, false)"
        ),
        {
            "tenant": tenant,
            "client_id": client_id,
            "product_id": _product_id(connection, tenant),
        },
    )


def _assert_refused_by(error: DBAPIError, constraint: str) -> None:
    """`23503`, AND from the named constraint.

    The code alone is not enough here for the reason
    `test_field_citation_is_whole.py` gives for its own: `orders` carries three
    composite foreign keys and `client_config_versions` two, so a row that was
    wrong in some OTHER way answers `23503` identically and would satisfy a test
    that read only the SQLSTATE.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    assert sqlstate == FOREIGN_KEY_VIOLATION_SQLSTATE, (
        f"expected {FOREIGN_KEY_VIOLATION_SQLSTATE} from {constraint}, got {sqlstate!r}: {error}"
    )
    assert constraint in str(error), (
        f"{FOREIGN_KEY_VIOLATION_SQLSTATE} came back, but not from {constraint} "
        f"— a refusal for the wrong reason is not this constraint working: {error}"
    )


def test_an_order_naming_a_client_of_its_own_tenant_is_accepted(two_tenants: Engine) -> None:
    """🔴 THE POSITIVE CONTROL, AND EVERY REFUSAL BELOW IS VACUOUS WITHOUT IT.

    A constraint that refused EVERY order would make all three refusal tests
    pass. This is the one that fails under that mutation, and it is also what
    proves the runtime check reaches the parent row at all: referential-integrity
    triggers run with row security off, so `FORCE ROW LEVEL SECURITY` on
    `clients` does not hide the parent from the constraint the way it hid it from
    `0110`'s one-time validation scan.
    """
    with two_tenants.begin() as connection:
        _insert_order(connection, TENANT_A, _client_id(connection, TENANT_A))
        connection.rollback()


def test_an_order_cannot_name_another_tenants_client(two_tenants: Engine) -> None:
    """The demonstrated breach: tenant A's order holding tenant B's REAL client.

    This is the row that mattered. `clients` carries the delivery destination, so
    an unscoped resolve of this order's client would address tenant A's report to
    tenant B's customer. The superuser connection is what makes the refusal
    attributable: no policy is consulted on it.
    """
    with two_tenants.begin() as connection:
        theirs = _client_id(connection, TENANT_B)
        with pytest.raises(DBAPIError) as raised:
            _insert_order(connection, TENANT_A, theirs)
        connection.rollback()

    _assert_refused_by(raised.value, ORDER_CONSTRAINT)


def test_an_order_cannot_name_a_client_that_was_never_issued(two_tenants: Engine) -> None:
    """The form `0080` did write down — an id belonging to nobody at all."""
    with two_tenants.begin() as connection:
        with pytest.raises(DBAPIError) as raised:
            _insert_order(connection, TENANT_A, ISSUED_NOWHERE)
        connection.rollback()

    _assert_refused_by(raised.value, ORDER_CONSTRAINT)


def test_a_config_version_cannot_name_another_tenants_client(two_tenants: Engine) -> None:
    """The second column, and it is not a lesser one.

    A config version is what an order is SEARCHED UNDER — `orders
    .frozen_config_version_id` freezes one at intake. A version naming another
    tenant's client is a set of overrides attributed to a customer who never
    agreed them.
    """
    with two_tenants.begin() as connection:
        theirs = _client_id(connection, TENANT_B)
        with pytest.raises(DBAPIError) as raised:
            _insert_config_version(connection, TENANT_A, theirs)
        connection.rollback()

    _assert_refused_by(raised.value, CONFIG_CONSTRAINT)


def test_the_client_foreign_keys_exist_and_are_validated(two_tenants: Engine) -> None:
    """Both constraints, in the catalog, `convalidated`, over the right columns.

    🔴 THIS IS THE WEAKEST ASSERTION IN THE FILE AND IS KEPT FOR WHAT IT ALONE
    CATCHES: `convalidated` is `t` even when the validation scan read zero rows
    (measured — see `0110`'s docstring), so this test would pass on the broken
    revision. What it does catch is a constraint added `NOT VALID` by a later
    edit, and a rename that left the behavioural tests above passing against a
    differently-named key. The claim that the scan SAW the rows belongs to
    `test_the_upgrade_refuses_a_database_that_already_holds_a_bad_row`.
    """
    with two_tenants.connect() as connection:
        found = {
            str(name): (bool(validated), str(definition))
            for name, validated, definition in connection.execute(
                text(
                    "SELECT conname, convalidated, pg_get_constraintdef(oid) "
                    "FROM pg_constraint WHERE conname = ANY(:names)"
                ),
                {"names": [ORDER_CONSTRAINT, CONFIG_CONSTRAINT]},
            ).all()
        }

    assert set(found) == {ORDER_CONSTRAINT, CONFIG_CONSTRAINT}, (
        f"pg_constraint holds {sorted(found)}, not both of "
        f"{sorted((ORDER_CONSTRAINT, CONFIG_CONSTRAINT))}. A missing one is "
        f"`0110` not applied, or applied under a different name."
    )
    for name, (validated, definition) in sorted(found.items()):
        assert validated, (
            f"{name} is NOT VALID, so it constrains new rows only and the rows "
            f"already in the table were never checked."
        )
        assert "(tenant_id, client_id) REFERENCES clients(tenant_id, id)" in definition, (
            f"{name} is not the composite key CONVENTIONS.md §1 requires — a "
            f"single-column reference lets a row in one tenant name a row in "
            f"another, which is the whole defect: {definition}"
        )


def test_the_force_flag_is_back_on_after_the_validation_scan(two_tenants: Engine) -> None:
    """All three tables end at `relforcerowsecurity = true`.

    `0110` turns `FORCE` OFF on `orders`, `client_config_versions` and `clients`
    so that its validation scan can see the rows, and turns it back on. This is
    the assertion that a future edit reordering or losing one of those `ALTER`s
    has to get past. Without `FORCE`, the owner is exempt from the tenant policy
    on that table and reads every tenant's rows — the revision's own
    `_require_forced` refuses at migration time, and this is the same claim read
    back from a migrated database rather than from inside the run that made it.
    """
    with two_tenants.connect() as connection:
        forced = {
            str(name): bool(flag)
            for name, flag in connection.execute(
                text(
                    "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = ANY(:tables)"
                ),
                {"tables": list(FORCED_TABLES)},
            ).all()
        }

    unforced = sorted(name for name in FORCED_TABLES if not forced.get(name))
    assert not unforced, (
        f"{unforced} are not FORCE ROW LEVEL SECURITY. `0110` drops FORCE for "
        f"its validation scan and restores it; a table left off is every tenant's "
        f"rows readable by titlepipe_owner, which is one SET ROLE from a LOGIN role."
    )


def test_the_upgrade_refuses_a_database_that_already_holds_a_bad_row(
    two_tenants: Engine,
    alembic_config: Callable[[str], Config],
    migration_dsn: str,
) -> None:
    """🔴 THE ONE TEST THAT PROVES `0110` VALIDATES RATHER THAN REPORTING SUCCESS.

    Downgrade past the revision, write the cross-tenant row the constraint
    exists to refuse, and run the upgrade. It must raise `23503`.

    MEASURED 2026-09-08 against postgres:18.4: with `0110`'s `NO FORCE` / `FORCE`
    pair removed — the obvious spelling of the revision — this test fails with
    `DID NOT RAISE`. The `ALTER TABLE` validation scan is an ordinary SQL query
    run as `titlepipe_owner`, `FORCE ROW LEVEL SECURITY` hides every row from it,
    and PostgreSQL then marks the constraint `convalidated`. No catalog read can
    tell the two outcomes apart, which is why this test is behavioural.

    THE RESTORE IS IN A `finally` AND IS NOT OPTIONAL. `migrated_database` is
    module-scoped and `pytest-randomly` reorders this file, so every other test
    here may run after this one. A failure that left the database at `{BEFORE}`
    would turn one red into six.
    """
    config = alembic_config(migration_dsn)
    command.downgrade(config, BEFORE)
    try:
        with two_tenants.begin() as connection:
            _insert_order(connection, TENANT_A, _client_id(connection, TENANT_B))

        with pytest.raises(DBAPIError) as raised:
            command.upgrade(config, REVISION)

        _assert_refused_by(raised.value, ORDER_CONSTRAINT)
    finally:
        with two_tenants.begin() as connection:
            connection.execute(
                text("DELETE FROM orders WHERE tenant_id = :tenant"), {"tenant": TENANT_A}
            )
        command.upgrade(config, "head")

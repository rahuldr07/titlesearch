"""`QueueService.next_order` against a real database — the product resolution.

The service reads TWO rows: the order, and the `products` row its `product_id`
names. `api/mappers/queue.py` refuses to render an order whose product did not
resolve, so "the second read works" is not a detail — it is the difference
between a served queue and a 500 on every order that has a product, which is
every order that passed validation.

**IT CANNOT BE PROVED WITHOUT A SERVER, AND THAT IS WHY THIS FILE EXISTS.** The
two ways the second read fails are both invisible to a unit test: `products` is
a tenant table under `FORCE ROW LEVEL SECURITY`, so a session that lost its
tenant reads zero rows and looks like an order with no product; and RLS is
evaluated AFTER the privilege check, so a missing `GRANT SELECT` is
`42501 permission denied for table products` rather than an empty result.
`0051` records both and grants the verbs; this asserts the grant is still there.

`tests/test_queue_endpoint.py` covers the render itself and needs no database.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Final
from uuid import UUID

import pytest
from minimal_rows import insert_order
from sqlalchemy import Engine, text

from titlepipe_core.api.mappers.queue import render_next_order
from titlepipe_core.db import make_engine, make_sessionmaker
from titlepipe_core.services.queue_service import QueueService
from titlepipe_domain import TenantId

# The same literals `test_order_queue_repository.py` uses, for the reason it
# gives: a reader moving between the files should not have to work out whether a
# different uuid means something.
TENANT_ONE: Final = TenantId(UUID("11111111-1111-1111-1111-111111111111"))
TENANT_TWO: Final = TenantId(UUID("22222222-2222-2222-2222-222222222222"))
TENANT_WITH_NO_ORDERS: Final = TenantId(UUID("33333333-3333-3333-3333-333333333333"))

ORDER_WITH_A_PRODUCT: Final = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORDER_WITH_NO_PRODUCT: Final = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
THE_PRODUCT: Final = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")

# `name`, not `code`. `api/mappers/queue.py` carries the residual on which of the
# two the contract's `product` means; this fixture is what makes the answer
# visible in an assertion rather than only in a comment — the two differ here on
# purpose, so a mapper that switched columns fails.
PRODUCT_NAME: Final = "Current Owner Search"
PRODUCT_CODE: Final = "CO"

_SEED_PRODUCT: Final = (
    "INSERT INTO products (id, tenant_id, code, name, period_kind, period_years, is_active) "
    "VALUES (:id, :tenant_id, :code, :name, 'current_owner', NULL, TRUE)"
)
_ATTACH_PRODUCT: Final = "UPDATE orders SET product_id = :product_id WHERE id = :id"


@pytest.fixture
def seeded_handover(migrated_database: str, seam_engine: Callable[[str], Engine]) -> None:
    """One order WITH a product, one WITHOUT, in two tenants. Committed.

    COMMITTED rather than rolled back because the reader is a different
    connection; `test_order_queue_repository.py::seeded_queue` records the same
    and the `DELETE` that makes the table a function of this call rather than of
    whatever module ran before it.

    The floors are asserted HERE so a seed that wrote nothing is a setup ERROR
    naming this fixture, rather than a green test whose subject was `None`.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.begin() as connection:
            connection.execute(text("DELETE FROM orders"))
            connection.execute(text("DELETE FROM products"))
            connection.execute(
                text(_SEED_PRODUCT),
                {
                    "id": THE_PRODUCT,
                    "tenant_id": TENANT_ONE,
                    "code": PRODUCT_CODE,
                    "name": PRODUCT_NAME,
                },
            )
            connection.execute(
                text(insert_order("id", "tenant_id")),
                {"id": ORDER_WITH_A_PRODUCT, "tenant_id": TENANT_ONE},
            )
            connection.execute(
                text(insert_order("id", "tenant_id")),
                {"id": ORDER_WITH_NO_PRODUCT, "tenant_id": TENANT_TWO},
            )
            connection.execute(
                text(_ATTACH_PRODUCT),
                {"product_id": THE_PRODUCT, "id": ORDER_WITH_A_PRODUCT},
            )
        with engine.connect() as connection:
            attached = connection.execute(
                text("SELECT product_id FROM orders WHERE id = :id"),
                {"id": ORDER_WITH_A_PRODUCT},
            ).scalar_one()
            unattached = connection.execute(
                text("SELECT product_id FROM orders WHERE id = :id"),
                {"id": ORDER_WITH_NO_PRODUCT},
            ).scalar_one()
    finally:
        engine.dispose()

    assert UUID(str(attached)) == THE_PRODUCT, (
        f"the seeded order names product {attached!r}, not {THE_PRODUCT}. Every assertion below "
        f"is about resolving that reference; an order with no product resolves trivially."
    )
    assert unattached is None, (
        f"the control order names product {unattached!r} and was meant to name none. Without it, "
        f"'a null product renders null' is asserted against a row that has one."
    )


async def _handover_for(dsn: str, tenant: TenantId) -> tuple[str | None, bool]:
    """`(product_name, an order came back)` — through the real service.

    Returns the pair rather than the `Handover` because the engine is disposed
    before the assertions run, and a caller that kept the object would be
    asserting on rows whose session is gone.
    """
    engine = make_engine(dsn)
    try:
        handover = await QueueService(make_sessionmaker(engine)).next_order(tenant)
        if handover is None:
            return None, False
        rendered = render_next_order(handover).order
        return (None if rendered is None else rendered.product), True
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_the_product_name_is_read_through_the_tenant_scoped_session(
    app_dsn: str, seeded_handover: None
) -> None:
    """🔴 THE SECOND READ, AS `titlepipe_app`, UNDER RLS.

    A failure here is one of three things and the message says which to look at:
    the `GRANT SELECT ON products` `0051` added, the tenant on the session, or a
    mapper that went back to sending `product_id`.
    """
    product, served = await _handover_for(app_dsn, TENANT_ONE)

    assert served, (
        "the hand-over returned nothing for a tenant the fixture proved holds an order. Either "
        "the statement lost its tenant — a session opened outside `tenant_session` sits at the "
        "deny sentinel and reads zero rows — or `orders` lost the app role's SELECT grant."
    )
    assert product == PRODUCT_NAME, (
        f"`product` came back {product!r}, not {PRODUCT_NAME!r}. `None` means the `products` read "
        f"found nothing — check `0051`'s GRANT, since RLS is evaluated after the privilege check "
        f"and a missing grant is `42501` rather than an empty result. {PRODUCT_CODE!r} means the "
        f"mapper switched to `products.code`; a uuid means it went back to `orders.product_id`."
    )


@pytest.mark.asyncio
async def test_an_order_with_no_product_is_served_with_a_null_and_no_second_read(
    app_dsn: str, seeded_handover: None
) -> None:
    """`product_id IS NULL` is an ORDINARY order, not a refusal.

    `entities.ts:62-69`: an order that failed validation has no resolved product.
    The service must not go looking for one, and the mapper must not refuse the
    row — the two absences are different and `Handover` records why.
    """
    product, served = await _handover_for(app_dsn, TENANT_TWO)

    assert served, "the hand-over returned nothing for the tenant holding the productless order"
    assert product is None, (
        f"`product` came back {product!r} for an order that names no product. `null` is what the "
        f"contract reserves for exactly this, and anything else is invented."
    )


@pytest.mark.asyncio
async def test_a_tenant_with_no_orders_gets_the_empty_hand_over(
    app_dsn: str, seeded_handover: None
) -> None:
    """`None` out of the service, `{"order": null}` on the wire, and no error.

    The empty queue is the one path that was already right before FX-3, and it is
    re-asserted here THROUGH THE DATABASE: the unit test proves the mapper renders
    `None`, not that the service produces one against a real policy.
    """
    engine = make_engine(app_dsn)
    try:
        handover = await QueueService(make_sessionmaker(engine)).next_order(TENANT_WITH_NO_ORDERS)
    finally:
        await engine.dispose()

    assert handover is None, (
        f"a tenant the fixture wrote no rows for was handed {handover!r}. Either the seed is "
        f"leaking rows across tenants or `tenant_isolation` is not being applied."
    )
    assert render_next_order(handover).model_dump() == {"order": None}, (
        "the empty hand-over stopped rendering the envelope `endpoints.ts:74-78` declares."
    )

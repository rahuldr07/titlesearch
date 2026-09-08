"""`orders` — the root almost everything else in this package hangs from.

It is one table and its own module for a reason that is not size: `orders` is
what `packages`, `fields`, `escalations`, `reports` and the intake sign-off all
point AT, so it is the one table with an edge to nearly every domain area. Left
in `base.py` it would drag those areas' vocabulary into the module every other
module imports; given its own, the direction of every reference in the package
stays legible — `orders.py` names `products` and `client_config_versions`, and
everything else names `orders`.

**TWO OF THE THREE FOREIGN KEYS POINT AT `intake.py`, WHICH IS THE LAYER BUILT
UNDER ASSUMPTION.** `product_id` and `frozen_config_version_id` reference tables
whose existence god ruled in ahead of the owner's answer. Both columns are
NULLABLE, and that is what keeps the assumption reversible: dropping the intake
layer means dropping two constraints and two columns that no row is required to
populate, not unpicking a NOT NULL that every order depends on.

The third, `client_id`, points at `identity.py`'s `clients` and is `NOT NULL` —
it is not reversible in that sense and is not meant to be. `0110` adds it; the
class docstring says what it closes.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.relations import tenant_fk


class Order(_TenantRow):
    """One title search job — the root almost everything else hangs from.

    `client_id` IS NOT AN ISOLATION BOUNDARY — `tenant_id` is. A client is the
    title company's own customer and every staff role sees every client's orders
    (plan §1), so nothing here narrows what a session may read.

    🔴 IT IS NOW A COMPOSITE FOREIGN KEY, AND THE THING THAT CLOSES IS NOT "an
    order naming a client that does not exist". `clients` holds
    `delivery_method`, `delivery_config` and `template_ref` — the DESTINATION a
    report is transmitted to. Unconstrained, an order in tenant A could hold
    tenant B's real client id, and any resolve that reached `clients` without
    repeating the tenant predicate would address one shop's deliverable to
    another shop's customer. RLS filters that join today; the foreign key makes
    the row unwritable, which holds for `titlepipe_owner`, for a migration and
    with row-level security off. `relations.tenant_fk` carries the reasoning.

    **THE RESIDUAL THAT STAYS:** the constraint binds `client_id` to a client in
    the SAME tenant. It says nothing about whether that client is the right one
    for this order — no rule in this schema relates a client to a jurisdiction, a
    product or a config version, and inventing one here would be a rule nobody
    has made.

    `status` IS `text` AND NOT AN ENUM, DELIBERATELY. `packages/contract/src/
    enums.ts:96` declares `OrderStatus = z.string()` with the comment that the
    vocabulary is OPEN until the Flask models are ported, and CLAUDE.md's rule is
    not to build past `OPEN`. An enum invented here would close a set the source
    of truth has not published, and every later label would be a type migration.

    `product_id`, `period_label` and `page_count` are ALL nullable, and the
    contract says why (`entities.ts:62-69`): an order that failed validation has
    no resolved product, an unreadable package has no page count, and `0` would
    assert somebody counted.
    """

    __tablename__ = "orders"
    __table_args__ = (
        tenant_fk(column="client_id", target_table="clients"),
        tenant_fk(column="product_id", target_table="products"),
        tenant_fk(
            column="frozen_config_version_id",
            target_table="client_config_versions",
            name="fk_orders_tenant_id_frozen_config_version_id",
        ),
        sa.UniqueConstraint("tenant_id", "external_ref", name="uq_orders_tenant_id_external_ref"),
        # A period label is the server's rendered description of what a PRODUCT
        # derives. One standing beside a null product is a label nothing produced
        # — principle 6 at the order level.
        sa.CheckConstraint(
            "product_id IS NOT NULL OR period_label IS NULL",
            name="period_label_needs_a_product",
        ),
        # The completeness gate's release stamp is one act: who and when arrive
        # together or not at all. `0010`'s trigger decides WHETHER it may be set;
        # this decides that a half-set stamp is not a state.
        sa.CheckConstraint(
            "num_nonnulls(extraction_released_at, extraction_released_by) IN (0, 2)",
            name="extraction_release_is_whole",
        ),
    )

    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    frozen_config_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    external_ref: Mapped[str] = mapped_column(Text, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    state_code: Mapped[str] = mapped_column(Text, nullable=False)
    county: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    period_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    extraction_released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    extraction_released_by: Mapped[str | None] = mapped_column(Text, nullable=True)

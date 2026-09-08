"""The intake subsystem — **BUILT UNDER ASSUMPTION.**

🔴 **THE OWNER HAS NOT ANSWERED WHETHER TITLEPIPE ACQUIRES THIS LAYER.** PLAN.md
§9 question 2 asks it, `docs/frontend/open-rulings.md` asks it in eight places
(Q4-Q10), and the answer is not in. god ruled recommendation (a) — build it, and
build it early — and this module is that ruling made real. **IF THE OWNER ANSWERS
(b), EVERY TABLE IN THIS FILE REVERSES**, together with `orders.product_id`,
`orders.frozen_config_version_id`, `orders.extraction_released_at` and
`orders.extraction_released_by`. That reversal list is in the build report so it
can be read without reading the code.

**WHY THIS ONE AND NOT ANOTHER PROPOSED COMPONENT:** the completeness gate sits
IMMEDIATELY UPSTREAM of the most expensive step in the system — measured at about
1h51m of GPU per 101-page package — so it is the only piece of the proposed layer
that pays for itself in compute. Finding out after extraction that a package
cannot support the ordered search costs the extraction. `intake.ts:143-146` says
the same thing from the wire's side.

**AND WHY `IntakeSignoff` IS NOT THE EIGHT-FLAG BLOCK ALREADY IN THE REPORT.**
`decisions.md` is explicit and the plan's §1 quotes it: "same-looking data,
opposite direction, different liability". One is a HUMAN asserting what they will
search, before the pipeline runs; the other is a MACHINE reporting what it found.
Modelling them as one table because the shapes match would fuse an input claim
with an output finding, which is the failure the provenance envelope exists to
prevent. They are in two different files here for that reason and no other.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.enums import (
    CONFIG_LINE_EFFECT,
    GAP_CLOSE_KIND,
    GAP_KIND,
    SIGNOFF_ANSWER,
)
from titlepipe_core.db.models.relations import tenant_fk


class Product(_TenantRow):
    """Current Owner Search / Two-Owner / Update / 20-, 40-, 60-Year.

    **A PRODUCT DERIVES A SEARCH PERIOD.** That is what makes it first-class and
    narrower than the old design's `clients.report_shape`, which conflated "what
    the deliverable looks like" with "what was actually searched" (plan §1). The
    period drives the checklist, the completeness gate and the money.

    `period_kind` IS `text` AND NOT AN ENUM, and the line is the same one drawn
    in `models.enums`: `packages/contract` carries `product` as
    `z.string().nullable()` and publishes no product vocabulary at all, so
    closing the set here would be this file inventing a taxonomy the source of
    truth has not published. `period_years` carries the number where there is
    one, and the check below is what stops the two disagreeing — a
    `period_kind = 'years'` with no year count is a product that derives no
    period, which is the one thing a product must do.
    """

    __tablename__ = "products"
    __table_args__ = (
        sa.UniqueConstraint("tenant_id", "code", name="uq_products_tenant_id_code"),
        sa.CheckConstraint(
            "(period_kind = 'years') = (period_years IS NOT NULL)",
            name="a_year_period_states_its_years",
        ),
        sa.CheckConstraint(
            "period_years IS NULL OR period_years > 0", name="period_years_is_positive"
        ),
    )

    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    period_kind: Mapped[str] = mapped_column(Text, nullable=False)
    period_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False)


class ClientConfigVersion(_TenantRow):
    """Client configuration as a DELTA over a product baseline, versioned.

    Clients hold only OVERRIDES. An edit publishes a NEW version; an order
    FREEZES a version at intake, so a later edit can never reach an in-flight
    order (`orders.frozen_config_version_id`, and `0051`'s trigger that refuses
    to move it once set). Editing configuration in place is the failure this
    shape exists to prevent — it changes what an order was searched under, after
    it was searched.

    `client_id` CARRIES THE COMPOSITE FOREIGN KEY `orders.client_id` carries, and
    `0110` adds both in one revision. It matters here for a reason of this
    table's own: a config version is what an order is SEARCHED UNDER, so a
    version naming another tenant's client is a delta attributed to a customer
    who never agreed it. `orders.Order`'s docstring carries the full reasoning
    and the residual.

    **ONE CURRENT VERSION PER (client, product)** — the PARTIAL unique index below
    over `is_current`, not a plain unique constraint, because the whole point is
    that the superseded versions stay.
    """

    __tablename__ = "client_config_versions"
    __table_args__ = (
        tenant_fk(column="client_id", target_table="clients"),
        tenant_fk(column="product_id", target_table="products"),
        sa.UniqueConstraint(
            "tenant_id",
            "client_id",
            "product_id",
            "version",
            name="uq_client_config_versions_one_version_per_client_product",
        ),
        sa.CheckConstraint("version >= 1", name="version_starts_at_one"),
        sa.CheckConstraint(
            "num_nonnulls(published_at, published_by) IN (0, 2)",
            name="publication_is_whole",
        ),
        # A version nobody published cannot be the current one.
        sa.CheckConstraint(
            "NOT is_current OR published_at IS NOT NULL",
            name="current_means_published",
        ),
        # 🔴 DECLARED HERE AND NOT ONLY IN THE MIGRATION, BECAUSE `alembic check`
        # COMPARES INDEXES. An index the database has and `Base.metadata` does not
        # is drift at every revision from now on — autogenerate emits a
        # `drop_index` for it — and the drift would be permanent, since the index
        # is required. A `UniqueConstraint` cannot express this: the whole design
        # is that superseded versions STAY, so the uniqueness has to be partial.
        sa.Index(
            "ix_client_config_versions_one_current_per_client_product",
            "tenant_id",
            "client_id",
            "product_id",
            unique=True,
            postgresql_where=sa.text("is_current"),
        ),
    )

    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[str | None] = mapped_column(Text, nullable=True)


class ClientConfigLine(_TenantRow):
    """One override in one config version — and **it names where it came from.**

    🔴 `origin_ref` IS `NOT NULL`, AND THAT IS THE WHOLE TABLE. `decisions.md`'s
    own strongest line, adopted by the plan's §1 regardless of how Q4-Q10
    resolve: *"every effective line carries its origin — a line with no traceable
    source is a config defect"*. That is principle 6 — never emit a value you
    cannot cite — generalised from field values to configuration. **The machine
    is the `NOT NULL` itself**: an effective-config line with no resolvable
    origin is a constraint violation at write time, not a lint finding and not a
    review comment.

    `effect` is an enum because the four verbs — waive, narrow, replace, add —
    each mean something different to whatever resolves a baseline against these
    lines, and a fifth verb changes that resolver. It must not be able to arrive
    as data.
    """

    __tablename__ = "client_config_lines"
    __table_args__ = (
        tenant_fk(
            column="config_version_id",
            target_table="client_config_versions",
            ondelete="CASCADE",
            name="fk_client_config_lines_tenant_id_config_version_id",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "config_version_id",
            "line_key",
            name="uq_client_config_lines_tenant_id_config_version_id_line_key",
        ),
        # `waive` removes a baseline line and therefore carries no replacement
        # body; every other effect states what it puts there.
        sa.CheckConstraint(
            "(effect = 'waive') = (body IS NULL)",
            name="only_a_waiver_has_no_body",
        ),
    )

    config_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    line_key: Mapped[str] = mapped_column(Text, nullable=False)
    effect: Mapped[str] = mapped_column(CONFIG_LINE_EFFECT, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin_ref: Mapped[str] = mapped_column(Text, nullable=False)


class IntakeSignoff(_TenantRow):
    """The abstractor's checklist for one order, signed by a person, then frozen.

    **THE SIGNATURE IS ONE ACT.** `signed_by` and `signed_at` are both null or
    both set — a half-signed sign-off is not a state, and the check says so.
    Policy prefill NEVER fills them in: `intake.ts:51` is explicit that
    `signed_by` stays null until a person signs, and the two must stay
    distinguishable on the wire "or the screen cannot tell a claim from a
    default".

    **FROZEN AGAINST A CONFIG VERSION**, `NOT NULL`: a checklist answered under
    configuration nobody can name is a set of claims with no baseline to judge
    them against.

    **THE FREEZE IS A TRIGGER, NOT A CONVENTION.** `0051`'s
    `intake_signoff_lines_are_frozen_once_signed` refuses any update to a LINE
    whose parent sign-off carries a `signed_at`. It lives on the child table
    because that is where the edit would land, and it reads the parent rather
    than trusting a copied flag.
    """

    __tablename__ = "intake_signoffs"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        tenant_fk(
            column="config_version_id",
            target_table="client_config_versions",
            name="fk_intake_signoffs_tenant_id_config_version_id",
        ),
        sa.UniqueConstraint("tenant_id", "order_id", name="uq_intake_signoffs_tenant_id_order_id"),
        sa.CheckConstraint(
            "num_nonnulls(signed_by, signed_at) IN (0, 2)",
            name="signature_is_whole",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    config_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    signed_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class IntakeSignoffLine(_TenantRow):
    """One answered checklist line. **A `NO` CARRIES ITS COMMENT OR IT IS REFUSED.**

    🔴 `ck_intake_signoff_lines_a_no_states_why`. `intake.ts:16-19` gives the
    reason and it is a liability one: a NO becomes a disclosure the reviewer must
    later accept or escalate, and "a disclosure nobody wrote a reason for cannot
    be judged by the person who inherits it". `comment_required` is served to the
    screen so it can ask; this check is what happens when something does not.
    Note that the constraint requires a non-blank comment, not merely a non-null
    one — an empty string satisfies `IS NOT NULL` and satisfies nobody reading
    the disclosure.

    **`answer` IS NULLABLE AND `policy_suggestion` IS A DIFFERENT COLUMN.** Ruling
    Q13's honest half (`intake.ts:20-23`): policy may SUGGEST an answer, but the
    line is not signed until a person answers it. One column holding both would
    make a default indistinguishable from a claim, which is the same collapse
    `na_reason` refuses one subsystem over. `prefilled_from_policy` records that
    a suggestion was shown, which is a third fact again.

    **NOTHING HERE PINS THE COUNT AT THIRTEEN.** The checklist is 13 lines today;
    a `CHECK` on `line_number <= 13` would make the fourteenth line a schema
    migration, and the number is a product fact carried by the config version
    this sign-off is frozen against.
    """

    __tablename__ = "intake_signoff_lines"
    __table_args__ = (
        tenant_fk(column="signoff_id", target_table="intake_signoffs", ondelete="CASCADE"),
        sa.UniqueConstraint(
            "tenant_id",
            "signoff_id",
            "line_number",
            name="uq_intake_signoff_lines_tenant_id_signoff_id_line_number",
        ),
        sa.CheckConstraint("line_number >= 1", name="line_number_starts_at_one"),
        sa.CheckConstraint(
            "answer IS DISTINCT FROM 'NO' OR length(btrim(comment)) > 0",
            name="a_no_states_why",
        ),
    )

    signoff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    line_key: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    group_label: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str | None] = mapped_column(SIGNOFF_ANSWER, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    comment_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    policy_suggestion: Mapped[str | None] = mapped_column(SIGNOFF_ANSWER, nullable=True)
    prefilled_from_policy: Mapped[bool] = mapped_column(Boolean, nullable=False)
    machine_check: Mapped[str | None] = mapped_column(Text, nullable=True)
    period_scoped: Mapped[bool] = mapped_column(Boolean, nullable=False)


class CompletenessGap(_TenantRow):
    """A gap between what the sign-off CLAIMED and what the package SUPPORTS.

    **THE GATE BLOCKS EXTRACTION, AND THE BLOCK IS A TRIGGER ON `orders`.** This
    table holds the gaps; `0051`'s
    `orders_extraction_release_needs_a_closed_gate` is what makes them matter. It
    fires when `orders.extraction_released_at` moves from NULL to non-null and
    refuses if the order has a signed sign-off missing, or any gap here still
    open. That is the ninth pipeline stage the plan's §1 names as entirely
    greenfield, expressed as a constraint rather than as a step some caller is
    trusted to run.

    `gate_open` IS NOT A COLUMN. `intake.ts:174` calls it server-owned and never
    derived client-side; it is derived SERVER-side from these rows, and storing
    it would create a second answer that can disagree with the gaps themselves.

    `claim` and `evidence` are both `NOT NULL` because a gap is precisely the
    pair: what was asserted, and what the package shows instead. One without the
    other is not a gap, it is an opinion.
    """

    __tablename__ = "completeness_gaps"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        tenant_fk(
            column="signoff_line_id",
            target_table="intake_signoff_lines",
            name="fk_completeness_gaps_tenant_id_signoff_line_id",
        ),
        sa.CheckConstraint("line_number >= 1", name="line_number_starts_at_one"),
        # Closing a gap is one act: which offered option was taken, who took it,
        # and when. A half-recorded closure is a gap that no longer blocks and
        # that nobody signed for.
        sa.CheckConstraint(
            "num_nonnulls(closed_with, closed_by, closed_at) IN (0, 3)",
            name="closure_is_whole",
        ),
        sa.CheckConstraint(
            "closed_note IS NULL OR closed_at IS NOT NULL",
            name="a_note_belongs_to_a_closure",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(GAP_KIND, nullable=False)
    # The sign-off line this gap was raised against — SERVER-SUPPLIED as a
    # reference rather than matched on label prose, because two lines may share
    # wording across product versions (`intake.ts:152-157`). Nullable: a
    # `period_short` gap is raised against the product's period, not against a
    # line.
    signoff_line_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    line_label: Mapped[str] = mapped_column(Text, nullable=False)
    claim: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    closed_with: Mapped[str | None] = mapped_column(GAP_CLOSE_KIND, nullable=True)
    closed_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_note: Mapped[str | None] = mapped_column(Text, nullable=True)

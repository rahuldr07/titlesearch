"""Instruments of record, the DERIVED chain over them, and the human stop.

🔴 **THE CHAIN IS DERIVED AND THE SCHEMA SAYS SO IN A COLUMN.** Kaveri/D4
measured the one real corpus package and found the vocabulary the old design
assumed is not in the data: "deeds are `instruments` with page ranges; nothing
links one to the next in the source — any chain is DERIVED, and how is UNKNOWN
from this artifact." Modelling `chain_link` as a first-class SOURCE FACT would
therefore store a relationship nobody observed. What is stored instead is an
assertion WITH ITS PROVENANCE: `chain_links.provenance` is the contract's own
`RuleProvenance` (`enums.ts:66`), and `OPEN` means exactly what CLAUDE.md says it
means — do not build past it. A link this system draws with no rule to cite is
recorded as `OPEN` rather than emitted as though it were established.

**WHY `instruments` IS A TABLE SEPARATE FROM `documents`, AND THE MEASUREMENT
BEHIND IT.** 67 of 101 pages in the real package are name-search / index output
rather than instruments — Kaveri calls it "the single most important fact for
classification". Those pages NAME judgments and liens that are frequently NOT
present in the package as paper. So the two are genuinely different grains: a
`document` is a span of paper the partitioner drew a boundary around; an
`instrument` is a thing of record the search found, which may have arrived as a
document, or only as a line in an index. `instruments.document_id` is NULLABLE
and that null is the whole distinction — collapsing the tables would force every
index-only judgment to invent a page range it does not have.

⚠️ **IF A LATER RULING SAYS AN INDEX ENTRY IS JUST A DOCUMENT OF ANOTHER KIND,
`instruments` COLLAPSES INTO `documents`.** That reversal is named in the build
report rather than hidden, because it is a real one.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import Date, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.enums import JUDGMENT_STATUS, RULE_PROVENANCE
from titlepipe_core.db.models.relations import tenant_fk


class Instrument(_TenantRow):
    """One instrument of record found by the search.

    `judgment_status` is the contract's `JudgmentStatus` and is NULL on an
    instrument that is not a judgment — a deed has no enforceability state, and
    `unknown` would be a determination nobody made. Where it IS a judgment,
    `unknown` is a real determination and routes to review (old R13); it is never
    a placeholder for "not looked at", which is what the null is for.

    `kind` is `text` for `documents.kind`'s reason, one module over: the
    vocabulary is jurisdiction-specific and closing it globally makes the first
    Georgia `FIFA` a write error.
    """

    __tablename__ = "instruments"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        # NULLABLE reference: an instrument known only from an index line has no
        # paper in the package. See the module docstring.
        tenant_fk(column="document_id", target_table="documents"),
        sa.CheckConstraint(
            "recorded_on IS NULL OR recorded_ref IS NOT NULL",
            name="a_recording_date_names_its_record",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    recorded_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    judgment_status: Mapped[str | None] = mapped_column(JUDGMENT_STATUS, nullable=True)


class ChainLink(_TenantRow):
    """One derived step of the chain of title, carrying how it was derived.

    **THE MACHINE FOR "NEVER EMIT A VALUE YOU CANNOT CITE":**
    `ck_chain_links_ruled_links_cite_a_rule` — a link tagged `RULED` with a null
    `rule_id` is a write error. The other three tags are honest about citing
    nothing: `DERIVED` is the system's own inference, `CONFLICT` is two
    incompatible readings held open, and `OPEN` is the tag that says the
    derivation policy does not exist yet. None of them may borrow the authority
    of a rule they do not name.

    **`rule_id` IS A SINGLE-COLUMN FOREIGN KEY AND THAT IS NOT THE DEFECT THE
    CONVENTIONS DESCRIBE.** The ban is on single-column references to
    TENANT-SCOPED tables, because there the short form both fails to name the
    composite key and reopens the cross-tenant existence oracle. `rules` is
    GLOBAL — it deliberately has no `tenant_id`, no policy and no row-level
    security (the ruling is recorded once, in `0003`'s module docstring) — so
    `rules (id)` IS its whole primary key and there is no tenant column to pair
    with. Writing `(tenant_id, rule_id)` here would not type-check against that
    key at all.

    `prior_link_id` is NULL on the first link. The chain is a list, and the
    ordinal is what orders it; the self-reference exists so a link states which
    step it follows rather than leaving that to be recomputed from ordinals that
    a later insertion could renumber.
    """

    __tablename__ = "chain_links"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        tenant_fk(column="instrument_id", target_table="instruments"),
        tenant_fk(column="prior_link_id", target_table="chain_links"),
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"]),
        sa.UniqueConstraint(
            "tenant_id", "order_id", "ordinal", name="uq_chain_links_tenant_id_order_id_ordinal"
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        sa.CheckConstraint(
            "provenance <> 'RULED' OR rule_id IS NOT NULL",
            name="ruled_links_cite_a_rule",
        ),
        # A link cannot follow itself. Cheap, and it turns one class of
        # derivation bug into a write error instead of an infinite walk in
        # whatever later reads the chain.
        sa.CheckConstraint(
            "prior_link_id IS NULL OR prior_link_id <> id",
            name="no_link_follows_itself",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    instrument_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    prior_link_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    provenance: Mapped[str] = mapped_column(RULE_PROVENANCE, nullable=False)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    derived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ChainRootAssertion(_TenantRow):
    """A reviewer saying "the root of title is reached", overriding computed depth.

    **THIS IS A DIFFERENT OBJECT FROM THE RULE THAT COMPUTES A TERMINATOR**, and
    the plan's §1 is explicit about it: old R17's arm's-length chain terminator
    is a rule the engine APPLIES; this is a human saying stop. Fusing them would
    make a reviewer's judgment indistinguishable from an engine's inference in
    exactly the place where the distinction decides liability.

    `reason` is `NOT NULL` for the same reason `fields.correction_reason` is
    checked: an assertion that overrides a computed answer is the one place where
    "why" is the only thing auditable afterwards.

    **ONE STANDING ASSERTION PER ORDER**, enforced by the PARTIAL unique index
    over `retracted_at IS NULL` declared below rather than by a plain unique
    constraint. A plain one would make retraction-and-reassertion impossible; the
    partial one keeps the history and still refuses two live assertions.

    **THE INDEX IS DECLARED HERE AND CREATED IN `0040`.** An earlier version of
    this docstring attributed it to `0007`, which was never possible — `0007` is
    a revision before this table exists, and an index cannot precede its table.
    It is declared in `__table_args__` rather than left to the migration alone
    because `alembic check` reads an index the catalog has and the metadata does
    not as an index to DROP.
    """

    __tablename__ = "chain_root_assertions"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        tenant_fk(column="chain_link_id", target_table="chain_links"),
        sa.CheckConstraint(
            "num_nonnulls(retracted_at, retracted_by) IN (0, 2)",
            name="retraction_is_whole",
        ),
        # Named explicitly: `NAMING_CONVENTION`'s `uq` pattern covers
        # `UniqueConstraint` and not `Index`, and `ix` would render this as
        # `ix_chain_root_assertions_tenant_id_order_id` — a name that says
        # nothing about the predicate that makes it the standing-assertion rule.
        # Tenant-prefixed for `_TenantRow`'s reason: unique enforcement runs
        # before the policy, so `UNIQUE (order_id)` alone would answer whether
        # another tenant holds a standing assertion on this order.
        sa.Index(
            "uq_chain_root_assertions_one_standing_per_order",
            "tenant_id",
            "order_id",
            unique=True,
            postgresql_where=sa.text("retracted_at IS NULL"),
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # NULL where the reviewer asserts the root is reached without naming the link
    # that reaches it — an ordinary state on a chain the engine could not derive.
    chain_link_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    asserted_by: Mapped[str] = mapped_column(Text, nullable=False)
    asserted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    retracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retracted_by: Mapped[str | None] = mapped_column(Text, nullable=True)

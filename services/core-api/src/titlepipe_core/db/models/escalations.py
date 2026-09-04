"""`escalations` — a question that cannot be closed without citing a rule.

🔴 **AN ESCALATION NEVER RESOLVES WITHOUT A RULE, AND THAT IS A DOMAIN FACT ABOUT
HOW THIS BUSINESS GOVERNS ITS OWN CORRECTNESS.** The plan's §1 records it as
enforced today only at the contract level (`min(1)` plus a required `rule`
union), which means it holds for the one client that parses the contract and for
nothing else. `ck_escalations_resolution_cites_a_rule` below moves it to the
storage layer, where it holds for every writer including the ones nobody has
written yet — the same move `fields.correction_reason` makes for corrections.

🔴 **AND THE RULE IT CITES MAY NOT BE `pending`.** CLAUDE.md: a PENDING rule
cannot affect the pipeline until an engineer confirms it. Visibility is not
effect — `0003`'s ruling keeps pending rules readable by everyone — but
RESOLVING a question by citing a rule nobody has confirmed is precisely letting a
pending rule affect the pipeline. A `CHECK` cannot look at another table, so the
machine is `0008`'s `escalations_resolution_needs_a_live_rule` trigger, `BEFORE
INSERT OR UPDATE ... FOR EACH ROW`, which reads `rules.status` and raises. It is
a row trigger because it needs `NEW`; the zero-row case a statement trigger would
catch is not a hazard here, since resolving nothing changes nothing.

**`age` IS ON THE WIRE AND IS DELIBERATELY NOT A COLUMN.** `entities.ts:180-181`
calls it "the finished age label ('3h ago', 'settled'); a label, never a timestamp
— the client must not tick". A stored label freezes at write time and is wrong by
the time anyone reads it. `raised_at` is stored; the label is composed per
response, which is Venkat's layer.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.relations import tenant_fk


class Escalation(_TenantRow):
    """One question raised against a cluster of field paths.

    The evidence surfaces are all nullable — "an escalation raised without
    evidence is an ordinary state" (`entities.ts:183-189`) — but each one that is
    present is present WHOLE. The debtor-vs-owner identity grid is four columns
    with an all-or-nothing check because a grid missing its owner column is a
    comparison with one side, rendered as though it had two; and the excerpt is
    three columns with the same check because `SourceExcerpt`'s pre/hit/post is a
    split at the match, and two thirds of a split is not an excerpt.

    **THE EXCERPT IS COLUMNS AND NOT `jsonb`, ON PURPOSE.** A `jsonb` blob with
    no `CHECK` accepts an array, a string, a number and `null` as readily as the
    shape anyone intended (`0001`'s `line_coords` docstring measures exactly
    that). Three named `text` columns make the partial state unrepresentable
    instead of merely undocumented.
    """

    __tablename__ = "escalations"
    __table_args__ = (
        # `rules` is GLOBAL, so this is its whole primary key — see
        # `chain.ChainLink` for why a single-column reference is correct here and
        # a defect anywhere tenant-scoped.
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"]),
        # 🔴 THE REFUSAL, AT THE STORAGE LAYER. A resolution is three facts —
        # what was decided, which rule decides it, and who signed — and they
        # arrive together or the row stays open. Resolving with a null `rule_id`
        # is a write error, not a 200.
        sa.CheckConstraint(
            "num_nonnulls(resolution, rule_id, resolved_by, resolved_at) IN (0, 4)",
            name="resolution_cites_a_rule",
        ),
        sa.CheckConstraint(
            "num_nonnulls(identity_debtor_label, identity_debtor, "
            "identity_owner_label, identity_owner) IN (0, 4)",
            name="identity_grid_is_whole",
        ),
        sa.CheckConstraint(
            "num_nonnulls(excerpt_pre, excerpt_hit, excerpt_post) IN (0, 3)",
            name="excerpt_is_whole",
        ),
        # A note on an excerpt nobody typed is a note about nothing.
        sa.CheckConstraint(
            "excerpt_note IS NULL OR excerpt_hit IS NOT NULL",
            name="excerpt_note_needs_an_excerpt",
        ),
    )

    field_path_cluster: Mapped[str] = mapped_column(Text, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    raised_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    context: Mapped[str | None] = mapped_column(Text, nullable=True)
    qc_owner: Mapped[str | None] = mapped_column(Text, nullable=True)

    excerpt_pre: Mapped[str | None] = mapped_column(Text, nullable=True)
    excerpt_hit: Mapped[str | None] = mapped_column(Text, nullable=True)
    excerpt_post: Mapped[str | None] = mapped_column(Text, nullable=True)
    excerpt_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    identity_debtor_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    identity_debtor: Mapped[str | None] = mapped_column(Text, nullable=True)
    identity_owner_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    identity_owner: Mapped[str | None] = mapped_column(Text, nullable=True)


class EscalationOrder(_TenantRow):
    """The orders one escalation was raised across — `Escalation.order_ids`.

    A JOIN TABLE AND NOT AN ARRAY COLUMN. `uuid[]` on `escalations` would hold
    order ids that no foreign key checks, in a tenant-scoped schema where the
    entire point of the composite reference is that a child cannot name a parent
    in another tenant. An array is exactly the shape that cannot carry that
    constraint.

    ⚠️ **"AT LEAST ONE ORDER" IS NOT ENFORCED HERE AND THIS SAYS SO.** A row in
    the parent with no rows here is a well-formed escalation pointing at nothing.
    Closing it needs either a deferred constraint trigger or an insert path that
    writes both in one statement, and neither is a decision this table can make
    alone — it is listed as an unproven residual in the build report.

    It carries its own `id` because `_TenantRow` gives every row one, and the
    natural key is asserted separately by the unique constraint. Making
    `(tenant_id, escalation_id, order_id)` the primary key instead would drop
    below the `(tenant_id, id)` convention that the whole schema is keyed on, for
    no gain.
    """

    __tablename__ = "escalation_orders"
    __table_args__ = (
        tenant_fk(column="escalation_id", target_table="escalations", ondelete="CASCADE"),
        tenant_fk(column="order_id", target_table="orders"),
        sa.UniqueConstraint(
            "tenant_id",
            "escalation_id",
            "order_id",
            name="uq_escalation_orders_tenant_id_escalation_id_order_id",
        ),
    )

    escalation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

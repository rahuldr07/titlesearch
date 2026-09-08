"""The deliverable: `reports`, their stored assurance sentences, and `deliveries`.

**A REPORT IS A VERSIONED, RENDERED BINARY ARTIFACT WITH AN IDENTITY — NOT A
VIEW AND NOT A QUERY RESULT.** Kaveri/D4, measuring a real report: this is the
distinction that decides whether the schema stores a digest and a location or
tries to reconstruct a delivered document from rows that have since changed. It
stores the digest and the location.

**THREE INDEPENDENT VERSION AXES, AND NOBODY KNOWS HOW THEY RELATE.** The same
measurement found `shape`, `version` and a THIRD number, `template_version`, over
one deliverable, and "how they relate is UNKNOWN from the artifact alone". They
are three columns. Deriving one from another — or storing two and computing the
third — would encode a relationship nobody has established, and the failure would
surface as a delivered document that cannot be reproduced.

**v1 AND v2 ARE BOTH RETAINED PERMANENTLY, AS THE DEFECT RECORD.** The plan's §1
requires it of a reissue. The machine is `0050`'s `reports_are_append_only`
trigger, `BEFORE UPDATE OR DELETE ... FOR EACH STATEMENT`, modelled on
`audit_log`'s and STATEMENT-level for that trigger's reason: under `FORCE ROW
LEVEL SECURITY` a cross-tenant `UPDATE` matches zero rows, and a row trigger does
not fire at all when a statement affects none — so a row trigger would be silent
for the one case it exists to refuse.

**THE BLOCK STRUCTURE IS INSTANCE-SHAPED AND IS DELIBERATELY NOT MODELLED HERE.**
The same real report has two "deed of trust" blocks and two "judgment case"
blocks precisely because that package has two of each; "a schema assuming a fixed
block count per report shape would already be wrong on the very next package".
The rendered artifact carries its own structure, and this table carries the
artifact.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.enums import DELIVERY_STATUS
from titlepipe_core.db.models.relations import tenant_fk


class Report(_TenantRow):
    """One rendered version of one order's deliverable.

    `artifact_digest` is the SHA-256 of the rendered bytes and `artifact_uri`
    names where those bytes are. Both `NOT NULL`: a report row with no artifact
    is a claim that something was rendered, with nothing to check it against —
    principle 6 at the deliverable level. The digest is also what the delivery
    receipt's `digest_recorded` step records, so the two cannot drift.

    `order_ref` is NOT stored here. The wire carries it (`entities.ts:249-256`,
    added because the delivered screen had only `order_id` and was printing an
    internal id on a certified record), but it is `orders.external_ref` and
    copying it would create a second place for it to be wrong. Resolving it is a
    join the SERVER makes — the contract's objection was to the BROWSER inventing
    one.
    """

    __tablename__ = "reports"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        sa.UniqueConstraint(
            "tenant_id", "order_id", "version", name="uq_reports_tenant_id_order_id_version"
        ),
        sa.CheckConstraint("version >= 1", name="version_starts_at_one"),
        # A reissue states its reason, and a v1 that supersedes nothing states
        # none. Both null or both set (`entities.ts:262-266`).
        sa.CheckConstraint(
            "num_nonnulls(supersedes_version, reissue_reason) IN (0, 2)",
            name="reissue_states_a_reason",
        ),
        sa.CheckConstraint(
            "supersedes_version IS NULL OR supersedes_version < version",
            name="supersedes_an_earlier_version",
        ),
        sa.CheckConstraint(
            "artifact_digest ~ '^[0-9a-f]{64}$'",
            name="artifact_digest_is_lowercase_hex",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    shape: Mapped[str] = mapped_column(Text, nullable=False)
    template_version: Mapped[str] = mapped_column(Text, nullable=False)
    rendered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    supersedes_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reissue_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    artifact_digest: Mapped[str] = mapped_column(Text, nullable=False)
    artifact_uri: Mapped[str] = mapped_column(Text, nullable=False)


class ReportVerifiedCheck(_TenantRow):
    """One assurance sentence stored on a report — a CITABLE artifact, not a log line.

    Kaveri/D4 found these in the real report: sentences like "judgments never
    auto-confirm" and "the third engine never enters a comparison", several
    citing a rule id and a page range. They are part of the deliverable, so they
    are stored beside it rather than reconstructed at render time from a rulebook
    that may have moved on.

    **THE ASSURANCE RECORD IS ITSELF NPI-BEARING**, and that is the
    classification fact easiest to miss when designing report tables in
    isolation: these sentences name specific case numbers and page ranges. In the
    plan's §2 taxonomy this row is a `derived_artifact` that is ALSO
    `npi_bearing` — the two axes crossing, which is exactly why they are two
    axes. **Nothing in this class carries either classification**, because
    `record_class` and the NPI classification are Kaveri's columns on her
    migration; this is flagged to her in the build report as a table that needs
    both, and until it has them the classification is an UNPROVEN RESIDUAL.
    """

    __tablename__ = "report_verified_checks"
    __table_args__ = (
        tenant_fk(column="report_id", target_table="reports", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"]),
        sa.UniqueConstraint(
            "tenant_id",
            "report_id",
            "ordinal",
            name="uq_report_verified_checks_tenant_id_report_id_ordinal",
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        sa.CheckConstraint(
            "num_nonnulls(page_from, page_to) IN (0, 2)",
            name="page_range_is_a_pair",
        ),
        sa.CheckConstraint(
            "page_to IS NULL OR page_to >= page_from",
            name="page_range_runs_forwards",
        ),
    )

    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    sentence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    page_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_to: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Delivery(_TenantRow):
    """One transmission of one report to a client.

    **`failed_transit` IS A TRANSIT STATE AND NEVER A QUALITY SIGNAL** —
    confirmed in the old CONTEXT and again in the live contract
    (`entities.ts:279`). The word costs nothing; the machine is
    `ck_deliveries_delivered_at_needs_a_transmitting_status`, which makes
    `delivered_at` unsettable while the row sits in `failed_transit` or any state
    before transmission. Without it a retry could inherit a delivery instant from
    the attempt that failed, and the record would show a delivery that never
    happened — the failure mode that turns a retryable transit problem into a
    false assurance about the deliverable.
    """

    __tablename__ = "deliveries"
    __table_args__ = (
        tenant_fk(column="report_id", target_table="reports"),
        sa.CheckConstraint(
            "delivered_at IS NULL OR status IN ('transmitted', 'acknowledged')",
            name="delivered_at_needs_a_transmitting_status",
        ),
        sa.CheckConstraint(
            "delivered_at IS NULL OR attempted_at IS NOT NULL",
            name="a_delivery_was_attempted_first",
        ),
    )

    report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(DELIVERY_STATUS, nullable=False)
    attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)


class DeliveryReceiptStep(_TenantRow):
    """One row of the Transmission Receipt.

    The four canonical steps are signed, digest recorded, transmitted,
    acknowledged. They are STORED ROWS and not derived from
    `deliveries.status`, because the contract says the client "renders the list
    verbatim — it never derives a step from `status`" (`entities.ts:268-273`), and
    a list the server does not store is a list the server cannot serve verbatim.

    **`done` AND `at` ARE THE SAME FACT, AND THE CHECK SAYS SO.** A step marked
    done with no instant is a claim nobody timestamped; an instant on a step not
    marked done is a timestamp for something that did not happen. `done = (at IS
    NOT NULL)` collapses both into one constraint, which is why it is written as
    an equality rather than as two implications.

    `step_key` is `text` rather than an enum even though the four steps are
    described as canonical: the contract models a receipt row as free-form
    (`id`/`what`/`who`), a reissue's receipt legitimately differs, and the
    enum-versus-text line in this schema is drawn at "does an unknown value mean
    something is broken". An unexpected receipt row does not.
    """

    __tablename__ = "delivery_receipt_steps"
    __table_args__ = (
        tenant_fk(column="delivery_id", target_table="deliveries", ondelete="CASCADE"),
        sa.UniqueConstraint(
            "tenant_id",
            "delivery_id",
            "ordinal",
            name="uq_delivery_receipt_steps_tenant_id_delivery_id_ordinal",
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        sa.CheckConstraint(
            "is_done = (happened_at IS NOT NULL)",
            name="done_records_when",
        ),
    )

    delivery_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    step_key: Mapped[str] = mapped_column(Text, nullable=False)
    what: Mapped[str] = mapped_column(Text, nullable=False)
    who: Mapped[str] = mapped_column(Text, nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False)
    happened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

"""Retention: the statutory floor, what one record IS, and the hold that suspends both.

Three tables, created by `0005_record_class_taxonomy` and `0006_legal_holds`, and
written here for the first time. They were authored against the single-file
`db/models.py` while that file was being split into this package, so they landed
in neither copy: the migrations shipped and the models did not, which
`alembic check` reports as three tables the database has and `Base.metadata` does
not. This module is the salvage, unchanged in substance.

**THE TAXONOMY IS TWO AXES AND NOT ONE.** `record_class` answers HOW LONG a
record must be kept and `data_class` answers WHAT KIND OF DATA is in it. They are
separate columns on `record_classifications` because a real record needs both at
once: an escrow ledger holding NPI is `escrow_accounting` + `npi`, and a single
axis would force a choice between recording the statutory bucket and recording
that the row holds NPI. `enums.py` carries the labels and the reason the
`operational_telemetry` label exists in the type while being refused in the
table.

**WHY `retention_windows` IS GLOBAL AND THE OTHER TWO ARE NOT.** A statutory
floor is not a tenant's property — Tex. Ins. Code does not apply differently to
one customer — so `RetentionWindow` is a `_Row` and is named in
`db.rls_coverage.UNSCOPED_TABLES` with its reason. A CLASSIFICATION is the
opposite: the same document type can be classified differently under two tenants'
jurisdictions, and a shared row would apply the wrong floor to one of them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Integer, Text, UniqueConstraint
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _Row, _TenantRow
from titlepipe_core.db.models.enums import (
    DATA_CLASS,
    RECORD_CLASS,
    RECORD_CLASS_LABELS,
    RECORD_CLASS_TYPE_NAME,
)

__all__ = ["LegalHold", "RecordClassification", "RetentionWindow"]


class RetentionWindow(_Row):
    """A statutory retention floor. **GLOBAL, and therefore `_Row`.**

    The second table in this schema with no `tenant_id`, after `rules`. The
    ruling that makes a global table legitimate was already made in
    `migrations/versions/0003_rules.py` and is not restated here;
    `tests/conftest.py::ISOLATION_GLOBAL_TABLES` and
    `tests/test_forced_rls_and_grants.py` are the machines that keep the
    exemption honest — both expire it the moment the table grows a `tenant_id`.

    **THIS TABLE IS EMPTY ON EVERY DATABASE AND THAT IS THE DELIVERABLE.** The
    numbers are the owner's ruling and are still open. `retention_window()` in
    migration `0005` raises `55000` naming the `(record_class, jurisdiction)`
    pair when no row is ruled — it does not return NULL and it has no default
    branch — so the mechanism is complete while the numbers wait, and a caller
    can never receive a plausible-looking window nobody decided.

    `titlepipe_app` holds SELECT and no INSERT: a statutory floor arrives by
    migration once ruled, the same way rulebook content does.

    `anchor` is free TEXT rather than an enum because "after policy issuance" and
    "from close of escrow" are different events, and the closed set of anchors is
    not something this table has the authority to close.
    """

    __tablename__ = "retention_windows"

    __table_args__ = (
        UniqueConstraint("record_class", "jurisdiction"),
        # `<>` on two booleans is XOR. A row claiming both a day count and
        # indefinite retention, or neither, is refused.
        CheckConstraint(
            "(minimum_retention_days IS NOT NULL) <> retention_is_indefinite",
            name="days_xor_indefinite",
        ),
        CheckConstraint(
            "minimum_retention_days IS NULL OR minimum_retention_days > 0",
            name="days_is_positive",
        ),
    )

    record_class: Mapped[str] = mapped_column(RECORD_CLASS, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    minimum_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_is_indefinite: Mapped[bool] = mapped_column(Boolean, nullable=False)
    anchor: Mapped[str] = mapped_column(Text, nullable=False)
    # NOT NULL, both of them: principle 6 applied to a retention rule. A window
    # nobody can cite is a deletion nobody can defend.
    authority: Mapped[str] = mapped_column(Text, nullable=False)
    source_reference: Mapped[str] = mapped_column(Text, nullable=False)


class RecordClassification(_TenantRow):
    """What one record IS, on both axes, so retention has something to read.

    `classification_basis` is NOT NULL because a classification is a value
    emitted about a record, and one that cannot be cited is one nobody can
    review.

    **SELECT, INSERT, UPDATE and no DELETE.** Reclassification is a real act and
    is an UPDATE, recorded by `0007`'s audit trigger whether or not the
    application remembers to record it. Deleting a classification would erase the
    only statement of what a retained record IS, so the verb is simply not
    granted; the machine is the ACL, pinned by `tests/acl_contract.py`.
    """

    __tablename__ = "record_classifications"

    __table_args__ = (
        UniqueConstraint("tenant_id", "subject_table", "subject_id"),
        # THE SLOT EXISTS IN THE TYPE AND IS REFUSED IN THIS TABLE — see
        # `RECORD_CLASS_LABELS` in `enums.py` for why both have to be true.
        CheckConstraint(
            f"record_class <> '{RECORD_CLASS_LABELS[-1]}'::{RECORD_CLASS_TYPE_NAME}",
            name="telemetry_is_not_stored_here",
        ),
    )

    subject_table: Mapped[str] = mapped_column(Text, nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    record_class: Mapped[str] = mapped_column(RECORD_CLASS, nullable=False)
    data_class: Mapped[str] = mapped_column(DATA_CLASS, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    classified_by: Mapped[str] = mapped_column(Text, nullable=False)
    classification_basis: Mapped[str] = mapped_column(Text, nullable=False)


class LegalHold(_TenantRow):
    """A litigation hold. It suspends every retention window above it.

    PLAN.md: *the deletion path is the one place where "nothing happened" and "we
    forgot to check" look identical.* So a hold is never deleted, only released —
    `titlepipe_app` holds no DELETE — and a release is all three of
    `released_at` / `released_by` / `release_reason` or none of them.

    A HOLD NAMES ONE `(subject_table, subject_id)` AND REACHES NOTHING
    DERIVED FROM IT. Cascade needs the domain tables and their derivation edges;
    `build-retention-audit.md` §7 carries it as an open gap, because a hold that
    silently fails to reach a derived copy is the same failure as no hold at all.
    Those tables now exist on the integrated chain — `instruments`, `chain_links`
    and `field_readings` among them — so the gap is reachable work rather than a
    blocked one, and it is still a gap.
    """

    __tablename__ = "legal_holds"

    __table_args__ = (
        # `num_nonnulls` is core PostgreSQL. Three columns, so the permitted
        # answers are 0 (never released) and 3 (released, attributed, explained).
        # 1 and 2 are the partial states a hand-written UPDATE produces.
        CheckConstraint(
            "num_nonnulls(released_at, released_by, release_reason) IN (0, 3)",
            name="release_is_all_or_nothing",
        ),
        # A PARTIAL UNIQUE INDEX, AND THE PREDICATE IS THE POINT: at most one
        # LIVE hold per subject, and any number of released ones, because the
        # history of holds on a record is itself evidence. Tenant-prefixed for
        # `_TenantRow`'s reason — unique enforcement runs before a policy's
        # `WITH CHECK`, so an unprefixed index answers "is this subject held in
        # another tenant?" to a caller who cannot read the row.
        Index(
            "uq_legal_holds_active_subject",
            "tenant_id",
            "subject_table",
            "subject_id",
            unique=True,
            postgresql_where=sa_text("released_at IS NULL"),
        ),
    )

    subject_table: Mapped[str] = mapped_column(Text, nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Both NOT NULL: a hold nobody can attribute is a hold nobody can lift, and
    # "we do not know why this record cannot be deleted" is the state this table
    # exists to prevent.
    matter_reference: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    placed_by: Mapped[str] = mapped_column(Text, nullable=False)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

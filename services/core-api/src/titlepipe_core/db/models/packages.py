"""`packages` and `pages` — the bytes that arrived and what is physically on them.

**THE TWO TABLES ARE ONE SUBJECT: THE EVIDENCE AS IT EXISTS, BEFORE ANYONE HAS
READ IT.** A page's row records what a renderer can measure — dimensions,
rotation, character count — plus the classifier's answer about what the page IS.
Neither table holds an extracted value or a judgment; those are `fields.py`'s and
`chain.py`'s. The split is worth stating because it is the one that keeps
`is_degraded` from becoming a filter: a quality measurement belongs to the page,
and the decision to skip something belongs to a stage that reads it.

`documents` is the SEGMENTATION over these pages and lives in `documents.py` —
it is a boundary somebody drew, not a property of the bytes, which is why it is
not here.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import BigInteger, Boolean, DateTime, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.enums import PACKAGE_STATUS, PAGE_KIND
from titlepipe_core.db.models.relations import tenant_fk


class Package(_TenantRow):
    """The uploaded bundle. **IMMUTABLE, BECAUSE ITS IDENTITY IS ITS CONTENT.**

    `sha256` IS THE IDENTITY AND MODELLING THIS ROW AS MUTABLE WOULD BREAK
    CONTENT-ADDRESSING OUTRIGHT. The plan's §2 keys the whole engine-output spine
    on `(package_digest, page_no, render_params, engine_id, engine_version,
    config_digest)` — the digest is simultaneously the dedupe key and the
    idempotency key, and every stored read cites it. If bytes could be appended
    to a package after ingest, `package_digest` would name two different byte
    sequences at two different times, every read taken before the append would
    cite a digest that no longer describes what was read, and re-running the
    pipeline would neither hit the existing rows (the digest moved) nor be able
    to prove it had not (nothing records which digest the old reads belonged to).
    The consequence is not a migration; it is that the audit answer "why does the
    report say this" stops being answerable.

    **THE OWNER'S Q9 IS OPEN AND THIS ROW ANSWERS IT ONE WAY.** §1 records
    "can a package be ADDED TO after ingest?" as UNKNOWN. Immutability is built
    here because designing content-addressing first and discovering mutability
    later is the expensive order, and because the reverse is cheap: if Q9 comes
    back "yes", this table becomes the immutable ingest event and a named set
    over those events becomes "the package" — additive, and the digests already
    stored stay true. If it had been built mutable, nothing stored would be.

    **THE MACHINE:** `0031`'s `packages_identity_is_immutable` trigger, `BEFORE
    UPDATE ... FOR EACH ROW`, refusing any statement that CHANGES `sha256`,
    `byte_size` or `tenant_id`. `FOR EACH ROW` and not `FOR EACH STATEMENT` here,
    which is the opposite of `audit_log`'s choice and for the opposite reason:
    `audit_log` refuses every update including the zero-row ones RLS produces, so
    it cannot be a row trigger; this refuses only a CHANGE, which needs `OLD` and
    `NEW` and therefore must be.

    **EXACTLY ONE ACCEPTED PACKAGE PER ORDER**, per §1 — enforced by the partial
    unique index `uq_packages_one_accepted_per_order` declared below and created
    by `0031`, not by a status check anywhere. A second acceptance is a unique
    violation at write time.

    BOTH MACHINES WERE ATTRIBUTED TO `0005` UNTIL 2026-09-04 AND `0005` IS
    NOT THAT REVISION. It is `record_class_taxonomy`; `0006` is `legal_holds` and
    `0007` is the audit writer. Neither the trigger nor the index existed in any
    revision on any branch — the numbers were assumed when this file was written
    and the range was allocated to another worker. Both now exist, in `0031`.
    """

    __tablename__ = "packages"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        # A given order may not hold the same bytes twice. It is deliberately
        # NOT unique on `(tenant_id, sha256)` alone: two orders over the same
        # county genuinely share a package's bytes, and the plan's §2 makes that
        # sharing load-bearing ("a read is a property of the document, not of who
        # asked"). The sharing happens through the DIGEST at the engine-read
        # layer, which is why the digest may repeat here across orders.
        sa.UniqueConstraint(
            "tenant_id", "order_id", "sha256", name="uq_packages_tenant_id_order_id_sha256"
        ),
        # 64 lowercase hex characters or it is not a SHA-256, and a digest that
        # is not one is an identity that will never match a read. Refused at
        # write rather than discovered when a re-run duplicates a package.
        sa.CheckConstraint(
            "sha256 ~ '^[0-9a-f]{64}$'",
            name="sha256_is_lowercase_hex",
        ),
        sa.CheckConstraint("byte_size > 0", name="byte_size_is_positive"),
        # `page_count` stays NULL on a package nothing could open. `0` would
        # assert somebody counted, which is `Order.pages`' rule one table up.
        sa.CheckConstraint("page_count IS NULL OR page_count > 0", name="page_count_is_positive"),
        sa.CheckConstraint(
            "status <> 'accepted' OR accepted_at IS NOT NULL",
            name="accepted_records_when",
        ),
        # A quarantined package says why. The optical/quarantine check is the one
        # real thing behind the word "exception" (plan §2, Kaveri/D4), so its
        # note is the record of the finding and not a comment.
        sa.CheckConstraint(
            "status <> 'quarantined' OR quarantine_note IS NOT NULL",
            name="quarantine_states_why",
        ),
        # EXACTLY ONE ACCEPTED PACKAGE PER ORDER — see the class docstring. An
        # INDEX and not a `CheckConstraint` because a check sees one row and this
        # is a statement about the set; PARTIAL because `received`, `quarantined`
        # and `superseded` may repeat freely on one order, and a total unique key
        # over `(tenant_id, order_id, status)` would refuse the second `received`
        # package a re-upload legitimately produces.
        #
        # Declared HERE and not only in the migration because `alembic check`
        # compares indexes: one the catalog has and this metadata does not is
        # drift reported at every revision from `0031` on, with no edit that
        # resolves it.
        sa.Index(
            "uq_packages_one_accepted_per_order",
            "tenant_id",
            "order_id",
            unique=True,
            postgresql_where=sa.text("status = 'accepted'"),
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    sha256: Mapped[str] = mapped_column(Text, nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(PACKAGE_STATUS, nullable=False)
    quarantine_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Page(_TenantRow):
    """One page of a package, with the profile facts and the classifier's answer.

    **`is_relevant`, `is_degraded` AND `page_kind` ARE ALL NULLABLE, AND NULL
    MEANS "NOT YET CLASSIFIED" RATHER THAN "NO".** A boolean defaulted to `false`
    would make an unclassified page indistinguishable from one the classifier
    looked at and rejected — the same collapse `na_reason` exists to prevent one
    table over, arriving here as a boolean instead of an enum.

    **`is_degraded` IS A QUALITY FLAG AND NOT A SKIP.** Kaveri measured 34 of 101
    pages degraded in the one real corpus package; a third of a real package does
    not read cleanly, so treating the flag as an exclusion would discard a third
    of the evidence. The contract agrees from the other side —
    `endpoints.ts:644`'s `degraded` "drives the degraded render; never inferred
    client-side".

    **`raster_uri` POINTS AT UNREDACTABLE NPI.** Kaveri/D4: a page raster cannot
    be sanitised because a substitution cannot reach into a PNG — it can only be
    WITHHELD. The column holds a reference, never bytes, so that withholding is a
    decision the serving layer can make. Nothing here enforces that; it is listed
    as a residual and as a request to Kaveri, whose classification owns it.
    """

    __tablename__ = "pages"
    __table_args__ = (
        tenant_fk(column="package_id", target_table="packages"),
        sa.UniqueConstraint(
            "tenant_id", "package_id", "page_no", name="uq_pages_tenant_id_package_id_page_no"
        ),
        sa.CheckConstraint("page_no >= 1", name="page_no_starts_at_one"),
        # The three coordinate spaces the plan's §2 warns about only stay
        # separable if the PDF page's own dimensions are recorded as a pair: a
        # box normalised against a raster whose aspect nobody stored is a
        # citation that cannot be checked.
        sa.CheckConstraint(
            "num_nonnulls(width_pt, height_pt) IN (0, 2)",
            name="page_size_is_a_pair",
        ),
        sa.CheckConstraint(
            "rotation_deg IS NULL OR rotation_deg IN (0, 90, 180, 270)",
            name="rotation_is_a_quarter_turn",
        ),
        sa.CheckConstraint(
            "text_char_count IS NULL OR text_char_count >= 0",
            name="text_char_count_is_not_negative",
        ),
    )

    package_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    width_pt: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    height_pt: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    rotation_deg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    text_char_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_kind: Mapped[str | None] = mapped_column(PAGE_KIND, nullable=True)
    is_relevant: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_degraded: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    raster_uri: Mapped[str | None] = mapped_column(Text, nullable=True)

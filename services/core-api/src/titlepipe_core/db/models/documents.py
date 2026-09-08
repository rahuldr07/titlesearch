"""`documents` — the segmentation boundary the partitioner drew.

**A DOCUMENT IS A SPAN OF PAGES, AND THE BOUNDARY IS DOCUMENT STRUCTURE RATHER
THAN A PAGE BREAK.** Old R24, carried forward by the plan's §1 as a DOMAIN FACT
and not a process rule: a security deed's own caption, legal description,
signatures, acknowledgment and recording block are what end one document and
start the next, regardless of which backend renders it. That is why the span is
`(first_page_no, last_page_no)` inclusive over ONE package and not a set of
arbitrary pages — a document's pages are consecutive by construction.

**IT IS ALSO THE WIRE'S `PackageInstrument`.** `endpoints.ts:665-675` puts the
same object on the wire with `first_page`/`last_page` inclusive, and says
explicitly why it is served rather than derived: grouping runs of equal page
`kind` in the browser would draw boundaries the pipeline never drew — two
consecutive deeds merge, and a deed spanning a differently classified page
splits. So the boundary is stored, once, here.

**`kind` IS `text` AND MUST NOT BECOME AN ENUM.** Kaveri's measurement against
the one real corpus package found instrument vocabulary is JURISDICTION-SPECIFIC:
Georgia's `FIFA` (fieri facias) appears in one sample package and Missouri's has
none. A closed global enum would make the first Georgia package a write error on
data that is entirely correct. `models.enums` records the same decision from the
other side.
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.relations import tenant_fk


class Document(_TenantRow):
    """One segmented unit within one package.

    `label` is the recorder's own naming of the instrument and is
    SERVER-AUTHORED (`endpoints.ts:667`). `recorded_ref` is the reference of
    record — book/page or instrument number — and is NULL "where the package
    holds no index entry for it, an ordinary state, not a missing lookup"
    (`endpoints.ts:662-664`). Nothing derives one from the other.

    **DOCUMENTS WITHIN A PACKAGE ARE NOT PROVEN NON-OVERLAPPING, AND THIS
    DOCSTRING WILL NOT CLAIM THEY ARE.** The correct machine is an exclusion
    constraint —
    `EXCLUDE USING gist (tenant_id WITH =, package_id WITH =, int4range(first_page_no, last_page_no, '[]') WITH &&)`
    — which needs the `btree_gist` extension for the two equality operands.
    `CREATE EXTENSION` is a privileged statement and `0001` already declined to
    take that dependency for `pgcrypto`, so taking it here unilaterally would be
    this file changing the deployment's privilege requirements on its own. It is
    recorded as an UNPROVEN RESIDUAL in the build report with the exact DDL, not
    asserted here. A trigger is not an acceptable substitute: it reads rows it
    does not lock, so two concurrent inserts can both pass it.
    """

    __tablename__ = "documents"
    __table_args__ = (
        tenant_fk(column="package_id", target_table="packages"),
        # A document starts at exactly one page of one package. This does NOT
        # close overlap (a second document could start inside this one's span) —
        # see the class docstring for what would and why it is not here.
        sa.UniqueConstraint(
            "tenant_id",
            "package_id",
            "first_page_no",
            name="uq_documents_tenant_id_package_id_first_page_no",
        ),
        sa.CheckConstraint("first_page_no >= 1", name="first_page_starts_at_one"),
        sa.CheckConstraint("last_page_no >= first_page_no", name="span_runs_forwards"),
    )

    package_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    first_page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    last_page_no: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_ref: Mapped[str | None] = mapped_column(Text, nullable=True)

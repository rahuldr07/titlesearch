"""The model package: `base` is the tenancy spine, and every other module is one
area of the domain.

**WHY THIS IS A PACKAGE AND NOT STILL `db/models.py`.** The skeleton was seven
tables and one file was right for it. The domain is not seven tables, and a
single module holding the package spine, the field provenance envelope, the
chain, the escalation machinery, the deliverable and the intake subsystem would
be one file that every reviewer has to page through to find one constraint.
`base.py` IS the former `models.py`, moved with `git mv` so the rename is
recorded and a concurrent edit to the old path still merges into it.

🔴 **THE PLACEMENT RULE, STATED ONCE SO THAT THE NEXT TABLE HAS AN ANSWER RATHER
THAN A PRECEDENT TO COPY.** `base.py` holds ONLY what exists because the system
is multi-tenant: `Base`, `_Row`, `_TenantRow`, the DDL naming convention,
`tenants` and `audit_log`. `enums.py` holds EVERY PostgreSQL enum type,
including the skeleton's three. `relations.py` holds the composite-foreign-key
constructor. Everything else is a table that describes title search, and lives
in the module for its area — `orders`, `packages` (with `pages`), `documents`,
`fields` (with `field_readings`), `chain`, `escalations`, `intake`, `delivery`,
`rulebook`.

That rule is not filing preference. `base.py` is imported by every other module
here, so a domain table placed in it becomes reachable from modules with no
business knowing it exists, and the import graph stops being a tree. It is also
what the 400-line cap in `scripts/check_backend_rules.py` is measuring for: the
first version of this package put the domain tables in `base.py` alongside the
spine and the gate refused the tree at 800 lines. The cap found a layering
mistake, which is what it is for; the fix was where each table belongs, not a
`rules-allow-file`.

**EVERY EXISTING IMPORT STILL RESOLVES.** `from titlepipe_core.db.models import
Base` and `from titlepipe_core.db import models` both worked against the module
and both work against this package, because everything the module exported is
re-exported here. Nothing outside this directory was edited to accommodate the
move. That is the property that makes the move safe to do while four other
people are writing against the same tree.

🔴 **EVERY MODEL MODULE MUST BE IMPORTED HERE, AND THE REASON IS NOT TIDINESS.**
A declarative class registers its `Table` on `Base.metadata` when the module
defining it is IMPORTED, not when it is written. A module nobody imports is a
table `alembic check` cannot see, so its migration and its model can disagree
forever and the drift check stays green — the exact false-assurance shape this
codebase is characterised by. `__all__` below is therefore not documentation:
it is what keeps `Base.metadata` complete.
"""

from __future__ import annotations

from titlepipe_core.db.models.base import NAMING_CONVENTION, AuditLog, Base, Tenant
from titlepipe_core.db.models.chain import ChainLink, ChainRootAssertion, Instrument
from titlepipe_core.db.models.delivery import (
    Delivery,
    DeliveryReceiptStep,
    Report,
    ReportVerifiedCheck,
)
from titlepipe_core.db.models.documents import Document
from titlepipe_core.db.models.enums import (
    AUDIT_ACTION,
    AUDIT_ACTION_LABELS,
    CONFIG_LINE_EFFECT,
    CONFIG_LINE_EFFECT_LABELS,
    DATA_CLASS,
    DATA_CLASS_LABELS,
    DELIVERY_STATUS,
    DELIVERY_STATUS_LABELS,
    FIELD_STATE,
    FIELD_STATE_LABELS,
    FIELD_TERMINAL_STATES,
    GAP_CLOSE_KIND,
    GAP_CLOSE_KIND_LABELS,
    GAP_KIND,
    GAP_KIND_LABELS,
    JUDGMENT_STATUS,
    JUDGMENT_STATUS_LABELS,
    NA_REASON,
    NA_REASON_LABELS,
    NA_REASON_TYPE_NAME,
    PACKAGE_STATUS,
    PACKAGE_STATUS_LABELS,
    PAGE_KIND,
    PAGE_KIND_LABELS,
    RECORD_CLASS,
    RECORD_CLASS_LABELS,
    RECORD_CLASS_TYPE_NAME,
    RULE_ORIGIN,
    RULE_ORIGIN_LABELS,
    RULE_ORIGIN_TYPE_NAME,
    RULE_PROVENANCE,
    RULE_PROVENANCE_LABELS,
    RULE_STATUS,
    RULE_STATUS_LABELS,
    RULE_STATUS_TYPE_NAME,
    SIGNOFF_ANSWER,
    SIGNOFF_ANSWER_LABELS,
)
from titlepipe_core.db.models.escalations import Escalation, EscalationOrder
from titlepipe_core.db.models.fields import (
    JUDGMENT_PATH_PREFIX,
    Field,
    FieldReading,
)
from titlepipe_core.db.models.intake import (
    ClientConfigLine,
    ClientConfigVersion,
    CompletenessGap,
    IntakeSignoff,
    IntakeSignoffLine,
    Product,
)
from titlepipe_core.db.models.orders import Order
from titlepipe_core.db.models.packages import Package, Page
from titlepipe_core.db.models.retention import LegalHold, RecordClassification, RetentionWindow
from titlepipe_core.db.models.rulebook import Rule

__all__ = [
    "AUDIT_ACTION",
    "AUDIT_ACTION_LABELS",
    "CONFIG_LINE_EFFECT",
    "CONFIG_LINE_EFFECT_LABELS",
    "DATA_CLASS",
    "DATA_CLASS_LABELS",
    "DELIVERY_STATUS",
    "DELIVERY_STATUS_LABELS",
    "FIELD_STATE",
    "FIELD_STATE_LABELS",
    "FIELD_TERMINAL_STATES",
    "GAP_CLOSE_KIND",
    "GAP_CLOSE_KIND_LABELS",
    "GAP_KIND",
    "GAP_KIND_LABELS",
    "JUDGMENT_PATH_PREFIX",
    "JUDGMENT_STATUS",
    "JUDGMENT_STATUS_LABELS",
    "NAMING_CONVENTION",
    "NA_REASON",
    "NA_REASON_LABELS",
    "NA_REASON_TYPE_NAME",
    "PACKAGE_STATUS",
    "PACKAGE_STATUS_LABELS",
    "PAGE_KIND",
    "PAGE_KIND_LABELS",
    "RECORD_CLASS",
    "RECORD_CLASS_LABELS",
    "RECORD_CLASS_TYPE_NAME",
    "RULE_ORIGIN",
    "RULE_ORIGIN_LABELS",
    "RULE_ORIGIN_TYPE_NAME",
    "RULE_PROVENANCE",
    "RULE_PROVENANCE_LABELS",
    "RULE_STATUS",
    "RULE_STATUS_LABELS",
    "RULE_STATUS_TYPE_NAME",
    "SIGNOFF_ANSWER",
    "SIGNOFF_ANSWER_LABELS",
    "AuditLog",
    "Base",
    "ChainLink",
    "ChainRootAssertion",
    "ClientConfigLine",
    "ClientConfigVersion",
    "CompletenessGap",
    "Delivery",
    "DeliveryReceiptStep",
    "Document",
    "Escalation",
    "EscalationOrder",
    "Field",
    "FieldReading",
    "Instrument",
    "IntakeSignoff",
    "IntakeSignoffLine",
    "LegalHold",
    "Order",
    "Package",
    "Page",
    "Product",
    "RecordClassification",
    "Report",
    "ReportVerifiedCheck",
    "RetentionWindow",
    "Rule",
    "Tenant",
]

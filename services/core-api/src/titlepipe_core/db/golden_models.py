"""`GoldenField` and `GoldenCorrection` — the golden set, as the ORM sees it.

**A SEPARATE MODULE RATHER THAN MORE OF `models.py`, AND THE REASON IS A GATE
RATHER THAN TASTE.** `scripts/check_backend_rules.py` caps a file under `src/`
at 400 lines and `models.py` is already at 373. It is also where the tree is
going: several branches are splitting `models.py` into a `db/models/` package
with one module per domain area, and this is that shape one module early.

**`models.py` IMPORTS THIS MODULE AT ITS BOTTOM, AND THAT IS LOAD BEARING.**
`migrations/env.py` builds `target_metadata` from `Base.metadata` and imports
`Base` from `models` and nothing else. A mapped class in a module nobody imports
is not on that metadata, so `alembic check` would find these two tables in the
database, find no table for them in the metadata, and report a spurious
`remove_table` — a green migration chain and a red check, with the reason three
files away.

WHAT THE ORM DOES **NOT** ENFORCE, SO THAT NOBODY READS THIS FILE AS THE
   PLACE THE RULES LIVE.
Every refusal that keeps the golden set honest is a database object, and this
module only DECLARES the ones SQLAlchemy can express. Specifically:

* the CHECK constraints below are declared here and are created by
  `migrations/versions/0070_golden_fields.py` and `0071`. Alembic's autogenerate
  does not compare CHECK constraints at all, so if these two copies drift,
  nothing in `alembic check` notices — `tests/test_golden_set.py` exercises the
  live constraints by driving statements that must fail, which is what actually
  holds them;
* the ledger requirement — a golden value moves only through a signed
  `golden_corrections` row — is `0072`'s trigger. SQLAlchemy metadata has no
  notion of a trigger, so nothing here could carry it and nothing in
  `alembic check` will ever notice its absence. `audit_log` has the same shape
  and `models.AuditLog` says so in the same words;
* `golden_corrections` being append-only is two triggers at `tgenabled = 'A'`,
  also invisible here.

## Why these are two classes and not one with a `superseded_at`

`GoldenField` is the CURRENT truth for one field on one order. `GoldenCorrection`
is one signed act on it. Flattening the newest act onto the truth row is what the
wire contract does (`GoldenField.corrected_by`, `corrected_at`,
`correction_reason`, `corrected_from` in `packages/contract/src/entities.ts`),
and a flattened column is OVERWRITTEN by the next act — which cannot be squared
with "corrections are permanent". The wire shape stays what it is and is rendered
by a mapper from the newest row of the ledger.
"""

from __future__ import annotations

import uuid
from typing import Final

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column

# `_TenantRow` is PACKAGE-private rather than module-private, and importing
# it here is the alternative to declaring the composite `(tenant_id, id)`
# primary key a second time. That key closes a cross-tenant existence oracle
# and its reasoning is written out once, on that class; two copies of it is
# how the second one loses the `sort_order=-1` that puts `tenant_id` first.
# The flat `db.models` module became a package at integration; these two names live in the modules
# every sibling imports them from, so this follows that convention rather than relying on re-export.
from titlepipe_core.db.models.base import (
    _TenantRow,  # pyright: ignore[reportPrivateUsage]  # rules-allow(any-type): package-private
)
from titlepipe_core.db.models.enums import NA_REASON

# EXACTLY THESE FOUR LABELS, IN THIS ORDER. `packages/contract/src/enums.ts`
# `GoldenTag` at :70, verbatim. `migrations/versions/0070_golden_fields.py`
# repeats the tuple rather than importing it, for the frozen-snapshot reason
# `0001` gives; `tests/test_golden_set.py` asserts these as LITERALS and
# separately compares the live `pg_enum` against this constant, on the count and
# on `enumsortorder`, which is the two-leg arrangement that keeps two copies
# honest without coupling them.
#
# WHAT IS ABSENT IS THE POINT: there is no label meaning "an engine was
# confident". All four describe how a PERSON came to hold the value — it was in
# a delivered report, an engineer ruled on it, a reviewer found the document
# ambiguous, two readers agreed. A machine-derived truth has no label, so it has
# no row.
GOLDEN_TAG_LABELS: Final = ("delivered_report", "ruled", "suspect", "agreed")
GOLDEN_TAG_TYPE_NAME: Final = "golden_tag"
GOLDEN_TAG: Final = ENUM(*GOLDEN_TAG_LABELS, name=GOLDEN_TAG_TYPE_NAME, create_type=False)

# EXACTLY THREE, AND THERE IS NO FOURTH. They are the three golden endpoints
# — `POST /api/golden/corrections`, `POST /api/golden/{id}/confirm`,
# `POST /api/golden/{id}/demote` — and nothing else. No `promote_reading`, so
# "an engine's output became truth" is not an act this ledger can record.
GOLDEN_ACT_LABELS: Final = ("correct", "confirm", "demote")
GOLDEN_ACT_TYPE_NAME: Final = "golden_act"
GOLDEN_ACT: Final = ENUM(*GOLDEN_ACT_LABELS, name=GOLDEN_ACT_TYPE_NAME, create_type=False)

# The spelling a machine identity takes in a signer column, reserved so that the
# CHECK constraints can refuse it. This is a NAMESPACE and not a proof of
# humanity: the database cannot know whether `L. Vance` is a person, and what it
# can do is make the two spellings a machine would actually produce unstorable.
ENGINE_SUBJECT_NAMESPACE: Final = "engine:"

# The signer this codebase has already shipped once —
# `packages/mocks/src/handlers.ts`, `POST /api/golden/:id/demote`:
# `gf.corrected_by = request.headers.get("x-mock-actor") ?? "unknown"`, on a
# permanent unreversible record, returning 201. Refused by name.
UNSIGNED_SENTINEL: Final = "unknown"


# CHECK constraints are named by their RULE alone. `models.NAMING_CONVENTION`'s
# `ck` pattern contains `%(constraint_name)s`, so a convention is applied to a
# constraint that already has a name and a fully-spelled one comes out doubled
# and truncated — `migrations/versions/0070_golden_fields.py` records the
# measurement. The full spelling is `ck_<table>_<rule>`.
class GoldenField(_TenantRow):
    """One human-established truth: a value for one path on one order.

    THERE IS NO COLUMN HERE THAT COULD HOLD A MODEL OUTPUT, AND THAT IS THE
       DESIGN RATHER THAN AN OMISSION.
    No `engine_id`, no `engine_version`, no `confidence`, no `model`. A golden
    row cannot record which engine produced it, so "promote this reading" has no
    shape — a truth gets here by a person typing it with a citation and a reason.
    `tests/test_golden_set.py::test_golden_and_engine_vocabularies_never_meet_in
    _one_relation` is the closed-world assertion over the live catalog that
    notices the day one of those columns lands here or `established_by` lands on
    a readings table.

    Equally: nothing anywhere in this schema is an `is_golden` flag. A truth
    stored as a flagged row beside model output is one forgotten `WHERE` clause
    away from a leaderboard that scores an engine against itself, and the query
    that forgets it does not look wrong.

    **`value` AND `na_reason` ARE EXCLUSIVE AND ONE IS ALWAYS PRESENT.** The two
    NA states never collapse — the truth "this field is NOT PRESENT in the
    document" and the truth "it is PRESENT AND UNREADABLE" score an engine
    differently — and a row with neither is unstorable, so `value IS NULL` can
    never be read as "absent". `0070`'s
    `ck_golden_fields_value_xor_na_reason` is the machine.

    **`revision` IS NOT BOOKKEEPING.** It is half of `0072`'s trigger: a golden
    value moves only through a `golden_corrections` row, and the revision is what
    stops one signature from authorising the same transition twice.

    **THERE IS NO `established_at`.** The row IS the act of establishing, so
    `created_at` is when it happened; a second timestamp is a second answer to
    one question.
    """

    __tablename__ = "golden_fields"

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    na_reason: Mapped[str | None] = mapped_column(NA_REASON, nullable=True)
    tag: Mapped[str] = mapped_column(GOLDEN_TAG, nullable=False)
    # `NOT NULL`, which diverges from `GoldenField.source_citation` on the wire
    # (`z.string().nullable()`). A truth nobody can trace to a document is not
    # one this system may score an engine against. CONTRACT GAP, recorded in
    # `0070`: the Zod schema should tighten when the read model lands.
    source_citation: Mapped[str] = mapped_column(Text, nullable=False)
    established_by: Mapped[str] = mapped_column(Text, nullable=False)
    established_reason: Mapped[str] = mapped_column(Text, nullable=False)
    # BOTH a Python-side `default` and `0070`'s `server_default`, and they are
    # the same number for two different writers. The Python one means the ORM
    # sends `0` on INSERT and the attribute is populated without a second
    # round trip — `GoldenRepository.record_act` reads `field.revision`
    # immediately after establishing one, and an unpopulated attribute is a
    # lazy load, which under asyncio is `MissingGreenlet` rather than a query.
    # The server one is for every writer that is not the ORM: the isolation
    # seed's raw INSERT, and any future data migration.
    revision: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    __table_args__ = (
        # Composite, because a single-column foreign key to a tenant-scoped
        # table is a defect (CONVENTIONS §1). `(tenant_id, order_id)` is what
        # makes it impossible for one tenant's golden row to name another
        # tenant's order, with no policy consulted.
        ForeignKeyConstraint(
            ("tenant_id", "order_id"),
            ("orders.tenant_id", "orders.id"),
            name="fk_golden_fields_tenant_id_order_id_orders",
        ),
        UniqueConstraint(
            "tenant_id", "order_id", "path", name="uq_golden_fields_tenant_id_order_id_path"
        ),
        CheckConstraint("num_nonnulls(value, na_reason) = 1", name="value_xor_na_reason"),
        CheckConstraint("length(btrim(path)) > 0", name="path_is_not_blank"),
        CheckConstraint("length(btrim(source_citation)) > 0", name="citation_is_not_blank"),
        CheckConstraint("length(btrim(established_reason)) > 0", name="reason_is_not_blank"),
        CheckConstraint(
            "length(btrim(established_by)) > 0 AND "
            f"lower(btrim(established_by)) <> '{UNSIGNED_SENTINEL}'",
            name="established_by_is_signed",
        ),
        CheckConstraint(
            f"lower(btrim(established_by)) NOT LIKE '{ENGINE_SUBJECT_NAMESPACE}%'",
            name="established_by_is_not_an_engine",
        ),
        CheckConstraint("revision >= 0", name="revision_is_not_negative"),
    )


class GoldenCorrection(_TenantRow):
    """One signed, sourced, reasoned act on a golden field. Append-only.

    The append-only guarantee is `0071`'s two triggers at `tgenabled = 'A'`, and
    nothing in this class expresses it — SQLAlchemy metadata has no notion of a
    trigger and `alembic check` will never notice one going missing.

    **THE THREE COLUMNS THE REFUSAL RULE NAMES** are `signed_by`, `reason` and
    `source_citation`. All three are `NOT NULL` and all three carry a non-blank
    CHECK, because `NOT NULL` accepts `''` — which is exactly what a form sends
    when a required field was made optional upstream, and is the shape PLAN §7
    records for `CorrectFieldRequest.reason`: validated, then dropped, with a 200
    at the end of it.

    **`tag_before`/`tag_after` AND THE FOUR TRANSITION CHECKS** turn the
    endpoints' own sentences into constraints: `confirm` lands on `ruled`,
    `demote` lands on `suspect`, both leave the value untouched, and a
    `correct` must actually move it. `IS DISTINCT FROM` throughout — a value
    legitimately moves to and from null, and `'Lot 7' <> NULL` is NULL, which a
    CHECK treats as satisfied.

    **`revision_after` IS UNIQUE PER FIELD**, and with `0072`'s trigger that is
    what makes a signature unrepeatable: one ledger row authorises exactly one
    transition, so a value cannot be walked A -> B -> A -> B on two signatures.
    As of `0111` the uniqueness is PARTIAL — exactly one row per slot supersedes
    nothing — and it is the four constraints together that keep the property.

    `supersedes_correction_id` IS THE ONLY WAY OUT OF A BRICKED FIELD, AND IT
    IS AN APPEND AND NOT A MARK. A ledger row whose before-state never matched
    occupies the only legal next revision forever: `0072` refuses every UPDATE it
    could authorise, and `0071`'s triggers refuse both the repair and the
    removal, for the owner and for a superuser. A `superseded_at` column set in
    place would be an UPDATE of a ledger row, so the pointer runs the other way —
    the REPLACEMENT names what it replaces, written once at INSERT, and nothing
    about an existing row ever changes. `0111` carries the four constraints, the
    recovery statement, and the one thing this does NOT close: superseding frees
    the slot, it does not revoke the superseded row's ability to authorise the
    transition IT describes.
    """

    __tablename__ = "golden_corrections"

    golden_field_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    act: Mapped[str] = mapped_column(GOLDEN_ACT, nullable=False)
    signed_by: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source_citation: Mapped[str] = mapped_column(Text, nullable=False)
    tag_before: Mapped[str] = mapped_column(GOLDEN_TAG, nullable=False)
    tag_after: Mapped[str] = mapped_column(GOLDEN_TAG, nullable=False)
    value_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    na_reason_before: Mapped[str | None] = mapped_column(NA_REASON, nullable=True)
    value_after: Mapped[str | None] = mapped_column(Text, nullable=True)
    na_reason_after: Mapped[str | None] = mapped_column(NA_REASON, nullable=True)
    revision_after: Mapped[int] = mapped_column(Integer, nullable=False)
    # NULL on an original claim, and that nullability is load-bearing twice: the
    # partial unique index below counts exactly these rows, and the four-column
    # foreign key is MATCH SIMPLE, so a NULL here exempts the row from it without
    # anything having to describe an original as a special case.
    supersedes_correction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ("tenant_id", "golden_field_id"),
            ("golden_fields.tenant_id", "golden_fields.id"),
            name="fk_golden_corrections_tenant_id_golden_field_id_golden_fields",
        ),
        # The target of the self-reference below and nothing else. `(tenant_id,
        # id)` is already the primary key, so this adds no uniqueness claim — it
        # exists because PostgreSQL requires a unique constraint over the exact
        # columns a foreign key references.
        UniqueConstraint(
            "tenant_id",
            "id",
            "golden_field_id",
            "revision_after",
            name="uq_golden_corrections_id_names_its_field_and_revision",
        ),
        # FOUR COLUMNS, NOT TWO: a row may only supersede a row of the SAME field
        # at the SAME revision. Two columns would let a recovery row point at an
        # unrelated correction and then sit outside the partial index below as a
        # second live claim on its own slot. `0111` carries the reasoning.
        ForeignKeyConstraint(
            ("tenant_id", "supersedes_correction_id", "golden_field_id", "revision_after"),
            (
                "golden_corrections.tenant_id",
                "golden_corrections.id",
                "golden_corrections.golden_field_id",
                "golden_corrections.revision_after",
            ),
            name="fk_golden_corrections_supersedes_the_same_slot",
        ),
        # A row is superseded at most once, so the chain per slot never forks.
        # NULLs are distinct in a PostgreSQL unique index, so the many rows that
        # supersede nothing do not collide.
        UniqueConstraint(
            "tenant_id",
            "supersedes_correction_id",
            name="uq_golden_corrections_tenant_id_supersedes_correction_id",
        ),
        CheckConstraint(
            "supersedes_correction_id IS NULL OR supersedes_correction_id <> id",
            name="a_row_does_not_supersede_itself",
        ),
        # DECLARED HERE AND NOT ONLY IN THE MIGRATION, BECAUSE `alembic check`
        # COMPARES INDEXES — `0051`'s partial index carries the same note. A
        # `UniqueConstraint` cannot express either of these: the first is partial
        # because superseded rows STAY, and the second is not unique at all.
        Index(
            "ix_golden_corrections_one_original_claim_per_revision",
            "tenant_id",
            "golden_field_id",
            "revision_after",
            unique=True,
            postgresql_where=text("supersedes_correction_id IS NULL"),
        ),
        # `0072`'s per-row lookup, which the unique constraint used to serve and
        # the partial one cannot: after a recovery the authorising row is a
        # SUPERSEDING row, and those are exactly the rows the partial index
        # leaves out.
        Index(
            "ix_golden_corrections_tenant_id_golden_field_id_revision_after",
            "tenant_id",
            "golden_field_id",
            "revision_after",
        ),
        CheckConstraint(
            "num_nonnulls(value_before, na_reason_before) = 1",
            name="before_is_a_whole_truth",
        ),
        CheckConstraint(
            "num_nonnulls(value_after, na_reason_after) = 1",
            name="after_is_a_whole_truth",
        ),
        CheckConstraint(
            f"length(btrim(signed_by)) > 0 AND lower(btrim(signed_by)) <> '{UNSIGNED_SENTINEL}'",
            name="signed_by_is_signed",
        ),
        CheckConstraint(
            f"lower(btrim(signed_by)) NOT LIKE '{ENGINE_SUBJECT_NAMESPACE}%'",
            name="signed_by_is_not_an_engine",
        ),
        CheckConstraint("length(btrim(reason)) > 0", name="reason_is_not_blank"),
        CheckConstraint(
            "length(btrim(source_citation)) > 0",
            name="citation_is_not_blank",
        ),
        CheckConstraint(
            "act = 'correct' OR (value_before IS NOT DISTINCT FROM value_after "
            "AND na_reason_before IS NOT DISTINCT FROM na_reason_after)",
            name="affirmation_leaves_the_value_alone",
        ),
        CheckConstraint(
            "act <> 'correct' OR NOT (value_before IS NOT DISTINCT FROM value_after "
            "AND na_reason_before IS NOT DISTINCT FROM na_reason_after)",
            name="correction_moves_the_value",
        ),
        CheckConstraint(
            "act <> 'confirm' OR tag_after = 'ruled'",
            name="confirm_lands_on_ruled",
        ),
        CheckConstraint(
            "act <> 'demote' OR tag_after = 'suspect'",
            name="demote_lands_on_suspect",
        ),
        CheckConstraint("revision_after > 0", name="revision_after_is_positive"),
    )

"""`fields` and `field_readings` — the provenance envelope, and every engine's
answer underneath it.

**THE TWO TABLES ARE HERE TOGETHER BECAUSE THE RELATION BETWEEN THEM IS THE
DESIGN, AND SPLITTING THEM WOULD PUT THE TWO HALVES OF ONE RULE IN TWO FILES.**
Reconciliation is by ADOPTION, never synthesis: one reading wins, `fields` cites
that reading's engine, and the losing readings stay in `field_readings` forever.
Every column on `fields` that names an engine is therefore a REFERENCE to a row
below it, and the reason `fields.engine_id` is singular is the same reason
`field_readings` keeps every row it ever wrote.

**NOTHING HERE DERIVES `state` FROM CONFIDENCE.** `engine_confidence_raw` on
`fields` and `confidence_raw` on `field_readings` are prioritisation signals and
documented-miscalibrated; `state` is server-owned and moves only through `0006`'s
transition function. The two columns sit in the same file as the state column
precisely so that a reader who wonders whether one feeds the other can see in one
screen that it does not.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Final

import sqlalchemy as sa
from sqlalchemy import DateTime, Integer, Numeric, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _TenantRow
from titlepipe_core.db.models.enums import FIELD_STATE, NA_REASON
from titlepipe_core.db.models.relations import tenant_fk

# 🔴 THE PREFIX IS THE LIVE SERVER GUARD'S, VERBATIM, AND THE LIVE SEED DATA
# CONTRADICTS IT. `packages/mocks/src/handlers.ts:777` refuses any exclude whose
# path does not `startsWith("judgments.")`, and the plan's §1 records that
# restriction as old R13's. The SAME FILE seeds field paths spelled
# `judgments_liens.1.type` (:420, :432, :444), which that guard refuses. One of
# the two spellings is wrong; picking is Venkat's (the wire) or the owner's, not
# this file's, so the constraint below enforces the RULE as stated and the
# disagreement is reported rather than laundered into a two-prefix check that
# would quietly bless both.
JUDGMENT_PATH_PREFIX: Final = "judgments."


class Field(_TenantRow):
    """One extracted datum on an order. **THE PROVENANCE ENVELOPE IS THE PRODUCT.**

    `na_reason` is NULL when the field has a value: a reason for absence is
    meaningless where nothing is absent. It is NOT a third NA state — the four NA
    states are labels of the enum, and `needs_review` is never derived from
    `value IS NULL` (CLAUDE.md).

    -------------------------------------------------------------------------
    🔴 `correction_reason` — THE COLUMN THAT DID NOT EXIST, AND THE WHOLE POINT
       OF THIS TABLE'S CHANGE.
    -------------------------------------------------------------------------
    Venkat/D2 measured the live behaviour: `CorrectFieldRequest.reason` is
    `z.string().optional()` on the wire, and the handler
    (`packages/mocks/src/handlers.ts`, `POST /api/fields/:id/correct`) validates
    the body, writes `state`, `value` and `na_reason`, and **never reads
    `parsed.data.reason`**. A supplied reason reaches no store and no audit row.
    The plan's §2 is explicit that "make the request field required" is NOT the
    fix: `entities.ts::Field` has no member to hold a reason, so the read model
    for the review screen structurally cannot show why a value was changed, and
    tightening the request without giving it a column moves the discard one layer
    down. `GoldenField` — the same act one layer up — has carried
    `correction_reason` the whole time.

    **THE MACHINE:** `ck_fields_corrected_states_a_reason` below. A correction
    filed without a reason is a constraint violation at the DATABASE, not a 200
    with a discarded string. That is the `.optional()` failure closed at the
    storage layer rather than at the validation layer, which is what makes it
    hold for every writer including ones nobody has written yet.

    **ONE REASON COLUMN IS SUFFICIENT AND THAT IS NOT AN ASSUMPTION.** It holds
    only because `corrected` is terminal, so there is at most one correction per
    field — see the state machine below. If terminality were ever relaxed, this
    column becomes lossy silently, and that dependency is why the two are
    documented together rather than in two places.

    -------------------------------------------------------------------------
    🔴 THE STATE MACHINE, AND WHY NO CONSTRAINT IN THIS CLASS EXPRESSES IT.
    -------------------------------------------------------------------------
    `corrected` and `escalated` accept no successor. A `CHECK` cannot say that —
    a check sees one row, not a transition. The machine is `0006`'s
    `titlepipe_field_transition` function: ONE conditional
    `UPDATE fields SET ... WHERE tenant_id = ... AND id = ... AND state <> ALL(terminal)`,
    with zero rows affected raising rather than returning, so the terminal check
    and the write are the same statement and two reviewers racing cannot both
    win. A read-then-write guard in a handler is both bypassable and racy, and
    the plan's §1 records what the current one costs: escalate a field, then
    correct it, and the live mocks return 200 — leaving an open escalation citing
    a field that is no longer escalated.

    **WHAT MAKES A MISSED PATH FAIL LOUD:** `state` is NOT in `titlepipe_app`'s
    column-level `UPDATE` grant on this table (`0006` replaces the table-wide
    grant `0002` gave). A handler that writes the column directly gets `42501
    insufficient_privilege` from PostgreSQL rather than a green test. The only
    granted path is the transition function.

    -------------------------------------------------------------------------
    🔴 EXCLUSION IS A FLAG, NOT A STATE, AND THE PLAN PICKED THAT DELIBERATELY.
    -------------------------------------------------------------------------
    `state` answers "is this value settled, and by whom". `excluded_reason`
    answers "does this row appear on the deliverable". Both can be true at once
    and neither implies the other: a satisfied judgment can be accurately
    extracted, correctly confirmed, and still suppressed under old R13. Folding
    exclusion into `state` would lose the record of whether anyone ever read an
    excluded row, and would need an un-exclude transition inside a machine that
    is otherwise deliberately terminal. So `/exclude` carries NO terminality
    guard, `0006`'s transition function does not name `excluded_reason` in its
    `SET` list — a fixed `SET` list is what stops a state writer clearing an
    exclusion as a side effect — and the two checks below hold the rest.
    """

    __tablename__ = "fields"
    __table_args__ = (
        tenant_fk(column="order_id", target_table="orders"),
        tenant_fk(column="source_document_id", target_table="documents"),
        sa.UniqueConstraint(
            "tenant_id", "order_id", "path", name="uq_fields_tenant_id_order_id_path"
        ),
        # THE CORRECTION REASON. See the class docstring.
        sa.CheckConstraint(
            "state <> 'corrected' OR correction_reason IS NOT NULL",
            name="corrected_states_a_reason",
        ),
        # R13's server restriction, from `handlers.ts:777`. `left(path, N)`
        # rather than `LIKE 'judgments.%'` because a literal `%` inside DDL text
        # is a paramstyle hazard on the way to the driver, and rather than a
        # regex because there is nothing to match here beyond a fixed prefix.
        sa.CheckConstraint(
            f"excluded_reason IS NULL OR left(path, {len(JUDGMENT_PATH_PREFIX)}) "
            f"= '{JUDGMENT_PATH_PREFIX}'",
            name="exclusion_is_judgment_paths_only",
        ),
        # An excluded row is INVISIBLE on the delivered sheet, so the record of
        # who suppressed it and why is the only thing auditable afterwards
        # (`endpoints.ts:692`). Three columns, all or none — a half-recorded
        # exclusion is a suppression nobody signed.
        sa.CheckConstraint(
            "num_nonnulls(excluded_reason, excluded_by, excluded_at) IN (0, 3)",
            name="exclusion_is_whole",
        ),
        # A value and a reason for having no value cannot both be true.
        sa.CheckConstraint(
            "value IS NULL OR na_reason IS NULL",
            name="value_and_na_reason_are_exclusive",
        ),
        # PRESENT_UNREADABLE is the ONE NA member that carries a page reference
        # (`enums.ts:19-30`): the ink is gone on a page somebody can name. Saying
        # a field is unreadable without naming where is a claim with no citation.
        sa.CheckConstraint(
            "na_reason IS DISTINCT FROM 'PRESENT_UNREADABLE' OR source_page_no IS NOT NULL",
            name="unreadable_cites_a_page",
        ),
        sa.CheckConstraint(
            "num_nonnulls(approved_by, approved_at) IN (0, 2)",
            name="approval_is_whole",
        ),
        # 🔴 HALF A CITATION IS NOT A WEAKER CITATION, IT IS NONE. `0090`. The
        # measured row was `source_page_no = 7` beside `source_document_id
        # IS NULL` — page seven of what — and it was accepted here for as long
        # as this table existed. `IN (0, 2)` and NOT `= 2`: both-null stays
        # legal, because that is the uncited-but-honest row the envelope
        # comment below exists to keep representable, and `= 2` would force the
        # pipeline to invent a citation. The snippet and the coords are
        # deliberately outside the pair — their absence degrades a reader's
        # experience, a page reference's absence changes whether the value is
        # CITED (`api/schemas/provenance.py` states the same split for the wire).
        #
        # This TIGHTENS `unreadable_cites_a_page` above: a page is nameable only
        # inside a document, so `PRESENT_UNREADABLE` now needs both halves.
        sa.CheckConstraint(
            "num_nonnulls(source_document_id, source_page_no) IN (0, 2)",
            name="citation_is_whole",
        ),
        sa.CheckConstraint(
            "source_page_no IS NULL OR source_page_no >= 1",
            name="source_page_no_starts_at_one",
        ),
    )

    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    na_reason: Mapped[str | None] = mapped_column(NA_REASON, nullable=True)
    state: Mapped[str] = mapped_column(FIELD_STATE, nullable=False)

    # The provenance envelope. Every member nullable, and the nullability is the
    # product: a field whose `value` is non-null while these are null is the
    # exact failure shape the architecture exists to CATCH (`entities.ts:97-101`)
    # — the server routes it to review. A `NOT NULL` here would force the
    # pipeline to invent a citation, which is `line_coords`' inversion one table
    # down, and would make the failure unrepresentable rather than impossible.
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source_page_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_line_coords: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    # The winning reading's engine, SINGULAR. Reconciliation is by ADOPTION,
    # never synthesis (plan §2): one reading wins and the field cites it; the
    # losers stay in `field_readings` forever. A value produced by combining two
    # engines' answers is a value no engine produced and nothing can cite it.
    engine_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Raw, unverified, documented-miscalibrated. A prioritisation signal and
    # NEVER a gate: `state` is server-owned and is not computed from this.
    engine_confidence_raw: Mapped[float | None] = mapped_column(sa.Float, nullable=True)

    approved_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    correction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    excluded_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    excluded_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    excluded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Server-AUTHORED, all three. Composing any of them in the browser would be
    # the UI narrating why the pipeline routed something, and `consequence` in
    # particular is the rulebook's claim about legal exposure — never derived
    # from a field path and never from `rule_refs`.
    asking: Mapped[str | None] = mapped_column(Text, nullable=True)
    why: Mapped[str | None] = mapped_column(Text, nullable=True)
    consequence: Mapped[str | None] = mapped_column(Text, nullable=True)


class FieldReading(_TenantRow):
    """One engine's reading of one field.

    🔴 `line_coords` IS NULLABLE AND THE NULLABILITY IS THE POINT. An engine
    without coordinate support declares `null` and never fabricates a box —
    Reader A is a VLM and genuinely cannot cite one. `NOT NULL` here would force
    every adapter to invent coordinates to satisfy the schema, which is the
    "never emit a value you can't cite" principle inverted into a requirement to
    make one up.

    `jsonb` and not `json`: the shape is read and compared, never round-tripped
    for its whitespace.
    """

    __tablename__ = "field_readings"
    __table_args__ = (
        tenant_fk(column="field_id", target_table="fields"),
        # One engine at one version answers a field once. A second answer from
        # the same (engine, version) is a re-read and needs its own explicit
        # ordinal (plan §2's `attempt_ordinal`), never a silent second row that
        # makes "which one did the field adopt" unanswerable.
        sa.UniqueConstraint(
            "tenant_id",
            "field_id",
            "engine_id",
            "engine_version",
            "attempt_ordinal",
            name="uq_field_readings_one_answer_per_engine_version_attempt",
        ),
        # 🔴 THE COORDINATE TRAP, MADE UNREPRESENTABLE RATHER THAN DOCUMENTED.
        # The plan's §2 verified THREE coordinate spaces coexisting — the PDF
        # page (612x792pt), the rendered raster (1391x1800px), and the engine's
        # own SQUARE 1000x1000 box grid — and NONE of them are recorded in raw
        # engine output. Because the raster is not square, mapping a box onto it
        # needs x and y scaled INDEPENDENTLY; a uniform scale is off by 1.294 in
        # y, which is "a bounding box that looks plausible, lands on the wrong
        # line, and cites text the engine never read". A box whose space nobody
        # recorded cannot be normalised correctly by anyone downstream, so the
        # two columns arrive together or not at all.
        sa.CheckConstraint(
            "num_nonnulls(line_coords, line_coords_space) IN (0, 2)",
            name="coords_declare_their_space",
        ),
        sa.CheckConstraint("cost_usd >= 0", name="cost_is_not_negative"),
        sa.CheckConstraint("latency_ms >= 0", name="latency_is_not_negative"),
        sa.CheckConstraint("attempt_ordinal >= 1", name="attempt_ordinal_starts_at_one"),
    )

    field_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # SEPARATE COLUMNS AND NOT ONE STRING. The plan's §2 measured why: `mineru`
    # and `mineru-pro-2604` are the same lineage with wildly different behaviour
    # (12.2s/useful against 47.5s/empty-on-everything), so collapsing id and
    # version would hide the entire failure inside one identifier.
    engine_id: Mapped[str] = mapped_column(Text, nullable=False)
    engine_version: Mapped[str] = mapped_column(Text, nullable=False)
    # Set ONLY by an explicit re-read request. Defaulted to 1 so an ordinary
    # first read never has to think about it, and so the unique key above is
    # total rather than skipping rows with a null.
    attempt_ordinal: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_raw: Mapped[float | None] = mapped_column(sa.Float, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    line_coords: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    # Which of the three spaces `line_coords` is expressed in. `text` and not an
    # enum on purpose: a fourth space arrives with a renderer, not with a schema
    # change, and the plan's §2 requires the space be RECORDED — closing the set
    # here would make the first unlisted renderer a write error on data that is
    # perfectly citable.
    line_coords_space: Mapped[str | None] = mapped_column(Text, nullable=True)

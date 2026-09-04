"""`fields` and `field_readings` get the provenance envelope, the correction
reason, and the state machine `fields.py` already describes

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-04

---------------------------------------------------------------------------
🔴 AN `ALTER`, NOT A `CREATE`. `0001` created both tables — `fields` with
   `na_reason` and `field_readings` with `line_coords` — and `0002` isolated
   them, so the RLS triple belongs to those revisions. `0031`'s header states
   the same case at length; `0030` is what the other half looks like.
---------------------------------------------------------------------------

## Assumed parent

`down_revision = "0031"` chains to this worker's own previous revision, and here
that is a REAL dependency rather than bookkeeping: `fields.source_document_id`
carries a composite foreign key onto `documents`, which `0030` creates. The other
requirements are `0001` (both tables, and the `na_reason` type this file's
transition function takes as a parameter) and `0008` (`orders`). Kaveri's
`0005`-`0007` and Bobbili's `0020+` are on branches this one has never seen; god
relinearizes.

---------------------------------------------------------------------------
🔴 `correction_reason` — THE COLUMN THE SYSTEM ACCEPTED AND THEN DISCARDED.
---------------------------------------------------------------------------
`CorrectFieldRequest.reason` is `z.string().optional()` on the wire, and the
handler for `POST /api/fields/:id/correct` validates the body, writes `state`,
`value` and `na_reason`, and never reads `parsed.data.reason`. A reviewer types
why they changed a title value, the request returns 200, and the reason reaches
no store and no audit row. `entities.ts::Field` has no member to hold one either,
so the review screen structurally cannot show why a value was changed —
"make the request field required" is therefore NOT the fix, it just moves the
discard one layer down.

**THE MACHINE:** `ck_fields_corrected_states_a_reason` below. A correction filed
without a reason is a constraint violation at the DATABASE rather than a 200 with
a discarded string, which is what makes it hold for every writer including the
ones nobody has written yet. A correction whose reason is dropped is a correction
nobody can audit, and auditability is the product.

**ONE REASON COLUMN IS SUFFICIENT ONLY BECAUSE `corrected` IS TERMINAL**, so
there is at most one correction per field. If terminality is ever relaxed this
column becomes lossy silently — which is why the constraint and the transition
function are in the same revision rather than two.

---------------------------------------------------------------------------
🔴 THE STATE MACHINE. `fields.py` ATTRIBUTES IT TO `0006`, AND `0006` IS
   `legal_holds`.
---------------------------------------------------------------------------
`models/fields.py` and `models/enums.py` both say migration `0006` holds a
`titlepipe_field_transition` function and the column-level `UPDATE` grant that
omits `state`. Revision `0006` on `agent/worker-38-kaveri` is `legal_holds`;
`0005` is `record_class_taxonomy` and `0007` is the audit writer. **The function
and the grant exist in no revision on any branch** — the number was assumed when
the models were written and the range was allocated to another worker. Exactly
the same thing had happened to `packages`' two machines, which `0031` builds.

Both land here. `models/fields.py` is corrected to point at this revision in the
same commit. `models/enums.py` still says `0006` in two comments and is NOT
edited: it is shared by every worker in this fan-out and a concurrent edit to it
is a merge conflict for three people. It is reported instead.

### Why a function and not a `CHECK`, and not a handler guard

`corrected` and `escalated` accept no successor. A `CHECK` cannot express that —
a check sees one row, not a transition. A read-then-write guard in a handler is
both bypassable and racy: two reviewers racing on one field both read a
non-terminal state and both write. What is here is ONE conditional statement, so
the terminal test and the write are the same statement and PostgreSQL's row lock
decides the race. Zero rows affected RAISES rather than returning, because a
transition that did not happen must not look like one that did.

**WHAT MAKES A MISSED PATH FAIL LOUD:** `state` is left out of `titlepipe_app`'s
column-level `UPDATE` grant, which replaces the table-wide grant `0002` gave. A
handler that writes the column directly gets `42501 insufficient_privilege` from
PostgreSQL rather than a green test. The only granted path is the function.

### What the grant costs, stated rather than discovered

A column-level `UPDATE` grant is a LIST, so a column added to `fields` by a later
revision is not in it and `titlepipe_app` cannot update that column until some
migration says so. That fails closed, which is the right direction, but it fails
in a place that reads like a bug. Any revision adding an app-updatable column to
`fields` must extend the grant.

**AND IT IS NARROWER THAN `state` ALONE ONLY WHERE THE DOCUMENTS SAY SO.**
`id`, `tenant_id` and `created_at` remain app-updatable here. Narrowing those is
defensible and is NOT this file's call: the models record one omission, `state`,
and inventing two more would be a ruling nobody made. It is listed as a residual.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


NOT_IN_PREREQUISITE_STATE = "55000"

# Repeated verbatim from `models/enums.py` rather than imported, for the reason
# `0001` gives: a migration is a frozen snapshot, and importing the constant would
# let a later edit there rewrite what this file claims to have created.
# `alembic check` does not compare enum labels at all — a fifth label and a
# reordering both leave it green — so the live `pg_enum` read in
# `tests/test_schema_migration.py` is the only thing holding the two copies
# together.
FIELD_STATE_LABELS = (
    "pending",
    "auto_confirmed",
    "needs_review",
    "confirmed",
    "corrected",
    "escalated",
)

# The two members that accept no successor. Its own constant because the
# transition function's predicate is built from it: a third member added silently
# widens the machine, and one dropped silently opens a terminal state to
# overwrite.
FIELD_TERMINAL_STATES = ("corrected", "escalated")

FIELD_STATE = postgresql.ENUM(*FIELD_STATE_LABELS, name="field_state", create_type=False)

# The server guard's own prefix, verbatim. `left(path, N)` rather than
# `LIKE 'judgments.%'` because a literal `%` inside DDL text is a paramstyle
# hazard on the way to the driver, and rather than a regex because there is
# nothing to match here beyond a fixed prefix.
JUDGMENT_PATH_PREFIX = "judgments."

TRANSITION_FUNCTION = "titlepipe_field_transition"

# 🔴 EVERY COLUMN OF `fields` THAT `titlepipe_app` MAY UPDATE. `state` IS ABSENT
# AND THAT ABSENCE IS THE MACHINE — see the module docstring. `id`, `tenant_id`
# and `created_at` are absent too, but as a consequence of listing the domain
# columns rather than as a ruling: they are named in the residuals, not here.
FIELD_APP_UPDATABLE_COLUMNS = (
    "value",
    "na_reason",
    "source_document_id",
    "source_page_no",
    "source_snippet",
    "source_line_coords",
    "engine_id",
    "engine_confidence_raw",
    "approved_by",
    "approved_at",
    "correction_reason",
    "excluded_reason",
    "excluded_by",
    "excluded_at",
    "asking",
    "why",
    "consequence",
)


def _refuse_if_populated(table: str, columns: Sequence[str]) -> None:
    """Refuse, by name, before adding a `NOT NULL` column with no default.

    🔴 THE `NO FORCE` DANCE IS LOAD-BEARING AND `0031::_refuse_if_populated`
    carries the measurement: `SELECT count(*)` issued by the role a migration runs
    as returns 0 on a `FORCE ROW LEVEL SECURITY` table however many rows it holds,
    because `FORCE` is exactly the clause that removes the owner's exemption. A
    guard written the obvious way passes on every database, including the one it
    exists to refuse.

    `ALTER TABLE ... NO FORCE` is a privilege only the owner holds rather than a
    setting any role can `SET`, it is transactional DDL that rolls back with the
    rest of the revision, and it takes `ACCESS EXCLUSIVE` — so there is no window
    in which another session sees unfiltered rows.
    """
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    counted = sa.select(sa.func.count()).select_from(sa.table(table))
    count = op.get_bind().execute(counted).scalar_one()
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    if count:
        raise RuntimeError(
            f"SQLSTATE {NOT_IN_PREREQUISITE_STATE}: {table} holds {count} row(s), and this "
            f"revision adds NOT NULL columns to it with no server default: "
            f"{', '.join(columns)}. There is no honest default for any of them "
            f"(CONVENTIONS §4), so this is a request for a BACKFILL migration that "
            f"populates them from the source of truth, not for a retry."
        )


def _create_transition_function() -> None:
    """The ONE granted path that moves `fields.state`.

    ---------------------------------------------------------------------------
    🔴 `SECURITY DEFINER`, AND IT IS THE ONLY THING THAT MAKES THE GRANT MEAN
       ANYTHING.
    ---------------------------------------------------------------------------
    A `SECURITY INVOKER` function runs as the caller, so `titlepipe_app` calling
    it would hit the very `42501` the missing column grant produces and the
    function would be unusable by the one role that needs it. Running as
    `titlepipe_owner` is what lets the transition happen at all, and it is
    deliberately the ONLY thing the owner's privileges are lent for.

    **IT DOES NOT LEND THE OWNER'S RLS EXEMPTION, BECAUSE THE OWNER HAS NONE.**
    `0002` put `FORCE ROW LEVEL SECURITY` on `fields`, and `FORCE` is precisely
    the clause that removes the owner's exemption — so the `UPDATE` below is
    still filtered by `tenant_isolation`, evaluated against the CALLER's
    `app.current_tenant`, which a `SECURITY DEFINER` context does not change. The
    explicit `tenant_id` parameter is a second, structural filter on top of that
    rather than the only one.

    `SET search_path = pg_catalog, public` pinned on the function: without it the
    caller's `search_path` chooses which `fields` and which operators the body
    resolves to, which is the standard `SECURITY DEFINER` escalation.
    `pg_catalog` first so no schema the caller can create in can shadow a
    built-in.

    `REVOKE EXECUTE FROM PUBLIC` is issued because PostgreSQL grants `EXECUTE` on
    a new function to `PUBLIC` by default. On a `SECURITY DEFINER` function that
    default is the whole hazard, and leaving it in place would hand every role in
    the cluster — including `titlepipe_worker` and `titlepipe_blind` — the one
    path that writes `state`.

    ---------------------------------------------------------------------------
    🔴 THE `SET` LIST IS FIXED, AND THE CALLER THEREFORE PASSES THE COMPLETE
       POST-TRANSITION VALUE OF ALL SIX COLUMNS.
    ---------------------------------------------------------------------------
    A fixed list is what stops a state writer clearing an exclusion as a side
    effect: `excluded_reason`, `excluded_by` and `excluded_at` are NOT named
    below, so no transition can touch them, and `/exclude` is a separate path
    carrying no terminality guard — exclusion is a FLAG and not a state, and both
    can be true of one row at once.

    What it costs, stated because nothing enforces it: a caller that means to
    change only `state` must still pass the current `value`, `na_reason`,
    `correction_reason`, `approved_by` and `approved_at`, or they are set to
    NULL. `COALESCE` on each parameter would remove that trap and introduce a
    worse one — a field could then never be cleared back to NULL, which is
    exactly what a correction to `NOT_PRESENT` has to do to `value`. This is an
    UNPROVEN RESIDUAL: the repository layer must pass whole rows, and no machine
    here checks that it does.

    `GET DIAGNOSTICS ... ROW_COUNT` and a raise on zero. THE MESSAGE NAMES ALL
    THREE REASONS RATHER THAN ASSERTING TERMINALITY, because the statement cannot
    tell them apart: the field is in a terminal state, the field does not exist,
    or the row belongs to a tenant this session cannot see. All three mean the
    same thing to the caller — the transition did not happen — and claiming the
    first would be a diagnosis the database did not make.

    `CREATE FUNCTION`, not `CREATE OR REPLACE`, for `0001`'s reason: with `OR
    REPLACE` a `downgrade()` that forgot its `DROP FUNCTION` leaves a stale body
    in place and the next `upgrade` silently overwrites it, so the round trip
    passes while the schema is not being rebuilt.
    """
    # Two spellings of the same tuple: `terminal` goes into an ARRAY constructor
    # and needs its quotes; `terminal_prose` goes inside a single-quoted HINT
    # literal, where those same quotes would terminate the string early.
    terminal = ", ".join(f"'{label}'" for label in FIELD_TERMINAL_STATES)
    terminal_prose = ", ".join(FIELD_TERMINAL_STATES)
    # 🔴 `S608` IS SUPPRESSED, AND WHAT MAKES IT SAFE IS CHECKABLE RATHER THAN
    # ASSERTED — the same standard `tests/minimal_rows.py` holds its one
    # suppression to. Every value interpolated below is a LITERAL DEFINED IN THIS
    # MODULE: `TRANSITION_FUNCTION`, `NOT_IN_PREREQUISITE_STATE`, and the two
    # spellings of `FIELD_TERMINAL_STATES`. Nothing caller-supplied reaches this
    # string, and nothing can — a migration takes no arguments. The runtime data
    # this function handles travels as plpgsql PARAMETERS, which is the half an
    # injection would have to cross.
    op.execute(
        f"""
        CREATE FUNCTION {TRANSITION_FUNCTION}(
            p_tenant_id         uuid,
            p_field_id          uuid,
            p_state             field_state,
            p_value             text,
            p_na_reason         na_reason,
            p_correction_reason text,
            p_approved_by       text,
            p_approved_at       timestamptz
        ) RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
            affected integer;
        BEGIN
            UPDATE fields
               SET state             = p_state,
                   value             = p_value,
                   na_reason         = p_na_reason,
                   correction_reason = p_correction_reason,
                   approved_by       = p_approved_by,
                   approved_at       = p_approved_at
             WHERE tenant_id = p_tenant_id
               AND id        = p_field_id
               AND state <> ALL (ARRAY[{terminal}]::field_state[]);

            GET DIAGNOSTICS affected = ROW_COUNT;

            IF affected = 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NOT_IN_PREREQUISITE_STATE}',
                    MESSAGE = 'field ' || p_field_id || ' did not transition to '
                              || p_state,
                    HINT = 'The field is already in a terminal state '
                           '({terminal_prose}), or it does not exist, or it belongs to a '
                           'tenant this session cannot see. This statement cannot '
                           'tell those apart and does not guess.';
            END IF;
        END;
        $$
        """  # noqa: S608
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {TRANSITION_FUNCTION}({_TRANSITION_ARGS}) FROM PUBLIC")
    op.execute(
        f"GRANT EXECUTE ON FUNCTION {TRANSITION_FUNCTION}({_TRANSITION_ARGS}) TO titlepipe_app"
    )


# The function's argument types, spelled once. `REVOKE`/`GRANT`/`DROP FUNCTION`
# each need the signature, and three hand-typed copies is three chances to drift
# from the `CREATE` above.
_TRANSITION_ARGS = "uuid, uuid, field_state, text, na_reason, text, text, timestamptz"


def _narrow_the_update_grant() -> None:
    """Replace `0002`'s table-wide `UPDATE ON fields` with a column list.

    The `REVOKE` must come first and must be table-wide: a column-level grant
    does not shadow a table-level one, it is added to it, so granting the columns
    without revoking the table would leave `state` writable and the whole machine
    decorative.

    `SELECT` and `INSERT` are untouched. This narrows one verb.
    """
    columns = ", ".join(FIELD_APP_UPDATABLE_COLUMNS)
    op.execute("REVOKE UPDATE ON fields FROM titlepipe_app")
    op.execute(f"GRANT UPDATE ({columns}) ON fields TO titlepipe_app")


def upgrade() -> None:
    _refuse_if_populated("fields", ("order_id", "path", "state"))
    _refuse_if_populated(
        "field_readings", ("field_id", "engine_id", "engine_version", "cost_usd", "latency_ms")
    )

    # `checkfirst=False`: a type that already exists here means a previous
    # `downgrade` failed to drop it, and that must be an error rather than a
    # silent reuse of whatever labels the old type happened to have.
    FIELD_STATE.create(op.get_bind(), checkfirst=False)

    # -- fields ------------------------------------------------------------
    op.add_column("fields", sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False))
    op.add_column("fields", sa.Column("path", sa.Text(), nullable=False))
    op.add_column("fields", sa.Column("value", sa.Text(), nullable=True))
    # SERVER-OWNED. Never derived from confidence, and after this revision never
    # written except through the transition function.
    op.add_column("fields", sa.Column("state", FIELD_STATE, nullable=False))

    # 🔴 THE PROVENANCE ENVELOPE, EVERY MEMBER NULLABLE, AND THE NULLABILITY IS
    # THE PRODUCT. A field whose `value` is non-null while these are null is the
    # exact failure shape the architecture exists to CATCH — the server routes it
    # to review. `NOT NULL` here would force the pipeline to invent a citation,
    # which is `field_readings.line_coords`' rule inverted into a requirement to
    # make one up, and would make the failure unrepresentable rather than
    # impossible.
    op.add_column(
        "fields", sa.Column("source_document_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column("fields", sa.Column("source_page_no", sa.Integer(), nullable=True))
    op.add_column("fields", sa.Column("source_snippet", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("source_line_coords", postgresql.JSONB(), nullable=True))
    # The winning reading's engine, SINGULAR: reconciliation is by ADOPTION and
    # never synthesis. One reading wins and the field cites it; the losers stay in
    # `field_readings` forever. A value produced by combining two engines' answers
    # is a value no engine produced, and nothing can cite it.
    op.add_column("fields", sa.Column("engine_id", sa.Text(), nullable=True))
    # Raw, unverified, documented-miscalibrated. A prioritisation signal and NEVER
    # a gate — nothing in this schema computes `state` from it.
    op.add_column("fields", sa.Column("engine_confidence_raw", sa.Float(), nullable=True))

    op.add_column("fields", sa.Column("approved_by", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))

    # THE COLUMN THAT DID NOT EXIST. See the module docstring.
    op.add_column("fields", sa.Column("correction_reason", sa.Text(), nullable=True))

    op.add_column("fields", sa.Column("excluded_reason", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("excluded_by", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("excluded_at", sa.DateTime(timezone=True), nullable=True))

    # SERVER-AUTHORED, all three. Composing any of them in the browser would be
    # the UI narrating why the pipeline routed something, and `consequence` in
    # particular is the rulebook's claim about legal exposure — never derived from
    # a field path.
    op.add_column("fields", sa.Column("asking", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("why", sa.Text(), nullable=True))
    op.add_column("fields", sa.Column("consequence", sa.Text(), nullable=True))

    op.create_foreign_key(None, "fields", "orders", ["tenant_id", "order_id"], ["tenant_id", "id"])
    # Composite onto `documents`, which `0030` creates. The child column is
    # `source_document_id` and not `document_id`, which is exactly why the FK
    # helper takes the column name rather than deriving it from the target.
    op.create_foreign_key(
        None, "fields", "documents", ["tenant_id", "source_document_id"], ["tenant_id", "id"]
    )

    op.create_unique_constraint(
        "uq_fields_tenant_id_order_id_path", "fields", ["tenant_id", "order_id", "path"]
    )

    # THE CORRECTION REASON. See the module docstring.
    op.create_check_constraint(
        "corrected_states_a_reason",
        "fields",
        "state <> 'corrected' OR correction_reason IS NOT NULL",
    )
    # 🔴 THE PREFIX IS THE LIVE SERVER GUARD'S AND THE LIVE SEED DATA CONTRADICTS
    # IT. The handler refuses any exclude whose path does not start with
    # `judgments.`; the SAME file seeds field paths spelled
    # `judgments_liens.1.type`, which that guard refuses. One of the two spellings
    # is wrong and picking is the wire owner's call, not this migration's — so
    # this enforces the RULE AS STATED and the disagreement is reported, rather
    # than being laundered into a two-prefix check that quietly blesses both.
    op.create_check_constraint(
        "exclusion_is_judgment_paths_only",
        "fields",
        f"excluded_reason IS NULL OR left(path, {len(JUDGMENT_PATH_PREFIX)}) "
        f"= '{JUDGMENT_PATH_PREFIX}'",
    )
    # An excluded row is INVISIBLE on the delivered sheet, so who suppressed it
    # and why is the only thing auditable afterwards. Three columns, all or none —
    # a half-recorded exclusion is a suppression nobody signed.
    op.create_check_constraint(
        "exclusion_is_whole",
        "fields",
        "num_nonnulls(excluded_reason, excluded_by, excluded_at) IN (0, 3)",
    )
    # A value and a reason for having no value cannot both be true. `na_reason` is
    # NOT a third NA state and `needs_review` is never derived from `value IS
    # NULL`.
    op.create_check_constraint(
        "value_and_na_reason_are_exclusive", "fields", "value IS NULL OR na_reason IS NULL"
    )
    # `PRESENT_UNREADABLE` is the ONE NA member that carries a page reference: the
    # ink is gone on a page somebody can name. Saying a field is unreadable
    # without naming where is a claim with no citation. `IS DISTINCT FROM` and not
    # `<>`, because `na_reason` is nullable and `<>` answers NULL for a null
    # operand — which a CHECK treats as satisfied.
    op.create_check_constraint(
        "unreadable_cites_a_page",
        "fields",
        "na_reason IS DISTINCT FROM 'PRESENT_UNREADABLE' OR source_page_no IS NOT NULL",
    )
    op.create_check_constraint(
        "approval_is_whole", "fields", "num_nonnulls(approved_by, approved_at) IN (0, 2)"
    )
    op.create_check_constraint(
        "source_page_no_starts_at_one", "fields", "source_page_no IS NULL OR source_page_no >= 1"
    )

    _create_transition_function()
    _narrow_the_update_grant()

    # -- field_readings ----------------------------------------------------
    op.add_column(
        "field_readings", sa.Column("field_id", postgresql.UUID(as_uuid=True), nullable=False)
    )
    # 🔴 SEPARATE COLUMNS AND NOT ONE STRING. `mineru` and `mineru-pro-2604` are
    # the same lineage with wildly different behaviour — 12.2s/useful against
    # 47.5s/empty-on-everything — so collapsing id and version would hide the
    # entire failure inside one identifier.
    op.add_column("field_readings", sa.Column("engine_id", sa.Text(), nullable=False))
    op.add_column("field_readings", sa.Column("engine_version", sa.Text(), nullable=False))
    # Set ONLY by an explicit re-read request. Defaulted to 1 so an ordinary first
    # read never has to think about it, and so the unique key below is TOTAL
    # rather than skipping rows with a null.
    op.add_column(
        "field_readings",
        sa.Column("attempt_ordinal", sa.Integer(), nullable=False, server_default=sa.text("1")),
    )
    op.add_column("field_readings", sa.Column("value", sa.Text(), nullable=True))
    op.add_column("field_readings", sa.Column("page_no", sa.Integer(), nullable=True))
    op.add_column("field_readings", sa.Column("snippet", sa.Text(), nullable=True))
    op.add_column("field_readings", sa.Column("confidence_raw", sa.Float(), nullable=True))
    # 🔴 COST AND LATENCY ARE `NOT NULL`, WHICH IS THE ONE PLACE IN THIS SLICE
    # WHERE A MEASUREMENT IS MANDATORY. Every adapter records cost and latency per
    # call; an engine that answered without either is an engine whose price nobody
    # can account for. `Numeric` and not a float for cost: money summed in binary
    # floating point does not add up.
    op.add_column("field_readings", sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False))
    op.add_column("field_readings", sa.Column("latency_ms", sa.Integer(), nullable=False))
    # Which of the three coordinate spaces `line_coords` is expressed in. `text`
    # and not an enum on purpose: a fourth space arrives with a renderer, not with
    # a schema change, and closing the set here would make the first unlisted
    # renderer a write error on data that is perfectly citable.
    op.add_column("field_readings", sa.Column("line_coords_space", sa.Text(), nullable=True))

    op.create_foreign_key(
        None, "field_readings", "fields", ["tenant_id", "field_id"], ["tenant_id", "id"]
    )

    # One engine at one version answers a field once. A second answer from the
    # same (engine, version) is a re-read and needs its own explicit ordinal,
    # never a silent second row that makes "which one did the field adopt"
    # unanswerable.
    op.create_unique_constraint(
        "uq_field_readings_one_answer_per_engine_version_attempt",
        "field_readings",
        ["tenant_id", "field_id", "engine_id", "engine_version", "attempt_ordinal"],
    )

    # 🔴 THE COORDINATE TRAP, MADE UNREPRESENTABLE RATHER THAN DOCUMENTED. Three
    # coordinate spaces coexist — the PDF page (612x792pt), the rendered raster
    # (1391x1800px) and the engine's own SQUARE 1000x1000 box grid — and none of
    # them is recorded in raw engine output. The raster is not square, so mapping
    # a box onto it needs x and y scaled INDEPENDENTLY; a uniform scale is off by
    # 1.294 in y, which is a bounding box that looks plausible, lands on the wrong
    # line, and cites text the engine never read. A box whose space nobody
    # recorded cannot be normalised correctly by anyone downstream, so the two
    # columns arrive together or not at all.
    op.create_check_constraint(
        "coords_declare_their_space",
        "field_readings",
        "num_nonnulls(line_coords, line_coords_space) IN (0, 2)",
    )
    op.create_check_constraint("cost_is_not_negative", "field_readings", "cost_usd >= 0")
    op.create_check_constraint("latency_is_not_negative", "field_readings", "latency_ms >= 0")
    op.create_check_constraint(
        "attempt_ordinal_starts_at_one", "field_readings", "attempt_ordinal >= 1"
    )


def downgrade() -> None:
    """Reverse of `upgrade`, in reverse order, with `0008`'s two naming spellings.

    A check constraint is dropped by its SHORT name and a unique constraint by its
    FULL one, in the same file: `NAMING_CONVENTION["ck"]` contains
    `%(constraint_name)s` and therefore WRAPS whatever name it is given, on the
    drop as well as on the create, while the `uq` pattern does not.

    The table-wide `UPDATE` grant is restored, because that is the state `0002`
    left `fields` in and a downgrade undoes one revision rather than converging an
    ACL. The FUNCTION needs its own `DROP` — nothing else removes it.
    """
    for name in (
        "attempt_ordinal_starts_at_one",
        "latency_is_not_negative",
        "cost_is_not_negative",
        "coords_declare_their_space",
    ):
        op.drop_constraint(name, "field_readings", type_="check")
    op.drop_constraint(
        "uq_field_readings_one_answer_per_engine_version_attempt",
        "field_readings",
        type_="unique",
    )
    op.drop_constraint(
        "fk_field_readings_tenant_id_field_id_fields", "field_readings", type_="foreignkey"
    )
    for column in (
        "line_coords_space",
        "latency_ms",
        "cost_usd",
        "confidence_raw",
        "snippet",
        "page_no",
        "value",
        "attempt_ordinal",
        "engine_version",
        "engine_id",
        "field_id",
    ):
        op.drop_column("field_readings", column)

    op.execute("REVOKE UPDATE ON fields FROM titlepipe_app")
    op.execute("GRANT UPDATE ON fields TO titlepipe_app")
    op.execute(f"DROP FUNCTION {TRANSITION_FUNCTION}({_TRANSITION_ARGS})")

    for name in (
        "source_page_no_starts_at_one",
        "approval_is_whole",
        "unreadable_cites_a_page",
        "value_and_na_reason_are_exclusive",
        "exclusion_is_whole",
        "exclusion_is_judgment_paths_only",
        "corrected_states_a_reason",
    ):
        op.drop_constraint(name, "fields", type_="check")
    op.drop_constraint("uq_fields_tenant_id_order_id_path", "fields", type_="unique")
    op.drop_constraint(
        "fk_fields_tenant_id_source_document_id_documents", "fields", type_="foreignkey"
    )
    op.drop_constraint("fk_fields_tenant_id_order_id_orders", "fields", type_="foreignkey")
    for column in (
        "consequence",
        "why",
        "asking",
        "excluded_at",
        "excluded_by",
        "excluded_reason",
        "correction_reason",
        "approved_at",
        "approved_by",
        "engine_confidence_raw",
        "engine_id",
        "source_line_coords",
        "source_snippet",
        "source_page_no",
        "source_document_id",
        "state",
        "value",
        "path",
        "order_id",
    ):
        op.drop_column("fields", column)

    # After the column that uses it, and as an explicit statement: `DROP TABLE`
    # does not drop a type, and a type left behind kills the next `upgrade` with
    # `type "field_state" already exists` — a failure only a round trip finds.
    FIELD_STATE.drop(op.get_bind(), checkfirst=False)

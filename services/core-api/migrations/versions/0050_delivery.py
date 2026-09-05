"""`reports`, their stored assurance sentences, `deliveries` and the receipt

Revision ID: 0050
Revises: 0008
Create Date: 2026-09-04

Four tables, one enum type and one append-only trigger — everything
`titlepipe_core.db.models.delivery` declares, in the revision that creates the
tables it declares them on. CONVENTIONS §1 requires `tenant_id`, the composite
`(tenant_id, id)` primary key, `ENABLE` + `FORCE ROW LEVEL SECURITY` and a
`tenant_isolation` policy to land WITH the table rather than in a follow-up, and
they do: `_isolate` is called from the same `upgrade()` that creates each table.

## Assumed parent

`down_revision = "0008"` is the head as found on this branch. **THE PARENT AT
INTEGRATION IS ALMOST CERTAINLY NOT `0008`** — three workers are writing domain
migrations in parallel in reserved number ranges (`0005`-`0007` Kaveri,
`0020`+ Bobbili, this file and `0051` in the `0050`+ range) and none of the
others is present here. Nothing in this revision depends on any of them: it
creates four tables nobody else creates, one type nobody else defines, and
references only `orders` (`0001`, columns from `0008`) and `rules` (`0003`).
god relinearizes at integration; do not rebase this onto another worker's chain
by hand.

## What holds each invariant, since a check constraint is not the only machine here

* **A report cites its artifact.** `artifact_digest` and `artifact_uri` are both
  `NOT NULL` and the digest is constrained to 64 lowercase hex characters, so a
  `reports` row asserting that something was rendered without saying what is a
  write error. That is principle 6 at the deliverable level.
* **Three version axes stay three columns.** `shape`, `version` and
  `template_version` are stored independently because Kaveri/D4's measurement of
  a real report found all three over one deliverable and could not establish how
  they relate. Deriving one from the others would encode a relationship nobody
  has established, and the failure would surface as a delivered document that
  cannot be reproduced.
* **v1 SURVIVES v2.** `reports_are_append_only` — see `_create_append_only_trigger`.
* **`failed_transit` cannot carry a delivery instant.**
  `ck_deliveries_delivered_at_needs_a_transmitting_status`. The word "transit"
  costs nothing; this is what stops a retry inheriting a delivery time from the
  attempt that failed.
* **A receipt step's `is_done` and its `happened_at` are one fact.**
  `ck_delivery_receipt_steps_done_records_when`, written as an equality rather
  than as two implications precisely so that neither half can be added without
  the other.

## 🔴 `reports` IS GRANTED `SELECT` AND `INSERT` AND DELIBERATELY NOT `UPDATE`

`0002` sets the precedent on `audit_log` and states the reason there: granting
`UPDATE` on a table the system promises never to edit in place would change no
behaviour — the trigger refuses the statement whatever the ACL says — and would
MISSTATE THE INTENT, leaving an ACL that reads `arwU` on the one table whose
whole point is that its rows are permanent.

**WHAT THIS COSTS, STATED RATHER THAN LEFT TO BE DISCOVERED.**
`tests/test_forced_rls_and_grants.py::_expected_grants` hardcodes `audit_log` as
the single two-verb table, and
`test_every_tenant_table_is_forced_isolated_and_reachable_by_the_app` asserts
three verbs on everything else. **THIS REVISION MAKES THAT TEST FAIL ON
`reports`, AND THE TEST IS THE THING THAT IS OUT OF DATE, NOT THIS FILE.** The
edit is one name added beside `audit_log` in `_expected_grants`. It is not made
here because that module also carries `EXPECTED_TENANT_TABLES` and the RLS
coverage assertion, which are another worker's, and three workers editing one
closed-world literal in parallel is three conflicts on one line. It is recorded
in `design/backend-2026-09/build-domain-schema.md` §Aryabhata as an integration
edit rather than as a comment nobody is tracking.

`report_verified_checks` gets the ordinary three verbs and NO append-only
trigger. The models declare none for it, and inventing one here would be this
migration deciding a retention property that `models/delivery.py` did not — the
same class of error as generating backend logic from a screen.

## `rules` is the one single-column foreign key in this file, and it is legal

`fk_report_verified_checks_rule_id_rules` is `(rule_id) REFERENCES rules (id)`.
CONVENTIONS §1 forbids a single-column foreign key **to a tenant-scoped table**,
because that table's key is `(tenant_id, id)` and the short form does not name a
key at all. `rules` is GLOBAL — `0003`'s ruling, no `tenant_id`, primary key
`(id)` — so `(id)` is its whole key and the composite form is not available to
write. The prohibition is about tenant scope, not about column count.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0050"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 `DeliveryStatus` AT `packages/contract/src/enums.ts:104-111`, VERBATIM AND IN
# THAT ORDER. Repeated here rather than imported from `models.enums`, for the
# reason `0001` and `0003` give for their own copies: a migration is a frozen
# snapshot of the schema at one revision, and an import would let a later edit to
# the model silently rewrite what this revision claims to have created. The live
# `pg_enum` is what holds the two copies together.
DELIVERY_STATUS_LABELS = (
    "draft",
    "signed",
    "digest_recorded",
    "transmitted",
    "acknowledged",
    "failed_transit",
)
DELIVERY_STATUS_TYPE_NAME = "delivery_status"

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE` as
# a side effect of the column. The type is created and dropped by its own explicit
# statement below, which is the only way it gets a `DROP` at all — `DROP TABLE`
# does not drop a type, and a type left behind kills the next `upgrade` with
# `type "delivery_status" already exists`.
DELIVERY_STATUS = postgresql.ENUM(
    *DELIVERY_STATUS_LABELS, name=DELIVERY_STATUS_TYPE_NAME, create_type=False
)

# `0002`'s three constants, copied for its reason. `_tenant_predicate` below must
# render the same expression `0002` renders, because
# `test_forced_rls_and_grants.py` matches every policy's `qual` against ONE
# shape — a policy here spelled differently is a policy that fails a test written
# about `orders`.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

APP_ROLE = "titlepipe_app"

# The tables this revision creates, parents first. `_isolate`, the grants and the
# `downgrade` all walk this, so a table added to `upgrade` and forgotten in one of
# the three is a table with no policy, which is the failure the coverage
# assertion exists to catch.
TABLES = ("reports", "report_verified_checks", "deliveries", "delivery_receipt_steps")

# 🔴 `reports` IS THE ONE TABLE AT TWO VERBS. See the module docstring.
APPEND_ONLY_TABLE = "reports"
APPEND_ONLY_FUNCTION = "reports_reject_mutation"
APPEND_ONLY_TRIGGER = "reports_are_append_only"
NO_TRUNCATE_TRIGGER = "reports_no_truncate"


def _identity_columns() -> tuple[sa.Column[uuid.UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`.

    A near-copy rather than an import, for `0003::_identity_columns`' reason: a
    migration is a frozen snapshot and this one would otherwise be rewritten by
    an edit to `0001`. The heterogeneous tuple return is load bearing rather than
    stylistic — `Column` is INVARIANT in its type parameter, so `Column[uuid.UUID]`
    is not assignable to `Column[object]` and pyright reports `reportReturnType`
    for the honest-looking `list[Column[object]]`.
    """
    return (
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def _tenant_column() -> sa.Column[uuid.UUID]:
    """`tenant_id`, `NOT NULL` — see `0001::_tenant_column`.

    `NOT NULL` is what makes the policy total: `tenant_id = <uuid>` is NULL rather
    than true for a NULL row, so a nullable column would permit rows no tenant can
    read, none can delete, and no isolation test can see. The composite key
    enforces it a second time; the explicit flag stays so that dropping the column
    from the key cannot silently relax it.
    """
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _tenant_primary_key() -> sa.PrimaryKeyConstraint:
    """`PRIMARY KEY (tenant_id, id)` — see `0001::_tenant_primary_key` for the
    cross-tenant existence oracle a single-column `id` key opens under `FORCE ROW
    LEVEL SECURITY`, and for the measurement.

    Built fresh per call: a `PrimaryKeyConstraint` object cannot be shared between
    tables, and a module-level one would bind to `reports` and fail on the second
    `create_table`.

    It matters MORE here than it did in `0001`, because three of these four tables
    carry a tenant-prefixed natural key — `(order_id, version)` on `reports`,
    `(report_id, ordinal)` and `(delivery_id, ordinal)` on the two child tables.
    `0001`'s note says the oracle "stops being bounded the moment a natural key
    lands". These are those keys, and every one of them is written `tenant_id`
    first for that reason.
    """
    return sa.PrimaryKeyConstraint("tenant_id", "id")


def _tenant_fk(
    *, table: str, column: str, target_table: str, ondelete: str | None = None
) -> sa.ForeignKeyConstraint:
    """`(tenant_id, <column>) REFERENCES <target_table> (tenant_id, id)`.

    `relations.tenant_fk` restated rather than imported, for the frozen-snapshot
    reason. The one difference is that `table` is passed: this function names the
    constraint itself instead of leaning on the metadata naming convention, so
    that the name in this file is the name in the catalog and a reader does not
    have to render `fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s`
    in their head to check it against `models/delivery.py`.

    🔴 **A SINGLE-COLUMN FOREIGN KEY TO A TENANT-SCOPED TABLE IS A DEFECT.** The
    composite form carries a property the short form cannot: a child row CANNOT
    name a parent in another tenant, because `tenant_id` appears on both sides of
    one constraint. That is structural — it holds for `titlepipe_owner`, inside a
    migration, and with row-level security switched off. RLS decides what a
    session may SEE; this decides what may be WRITTEN.
    """
    return sa.ForeignKeyConstraint(
        ["tenant_id", column],
        [f"{target_table}.tenant_id", f"{target_table}.id"],
        ondelete=ondelete,
        name=f"fk_{table}_tenant_id_{column}_{target_table}",
    )


def _enum_column(name: str, enum: postgresql.ENUM) -> sa.Column[str]:
    """One `NOT NULL` enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED — `0003::_enum_column` holds the measurement. `postgresql.ENUM`
    carries no type argument in SQLAlchemy's annotations, so the expression
    infers `Column[Unknown]` and `Column[complex]` type-checks exactly as
    happily as `Column[str]`. What makes `str` the right one is that the
    identical column spelled with the generic `sa.Enum` infers `Column[str]`,
    and that this column holds one of six label strings and nothing else.
    Without it, `op.create_table` reports `reportUnknownArgumentType` —
    MEASURED on this tree.
    """
    return sa.Column(name, enum, nullable=False)


def _tenant_predicate(key_column: str) -> str:
    """`0002::_tenant_predicate`, verbatim.

    Not parameterised, and it cannot be: a policy expression is DDL text, not a
    statement with bind parameters. Both interpolated values are constants here.
    """
    return f"{key_column} = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, and one policy — `0002::_isolate`, restated.

    `ENABLE` before `FORCE` because `FORCE` alone is not a thing: it removes the
    owner's exemption from a mechanism that has to be switched on first. The
    policy last, so there is no instant — not even inside this transaction — at
    which the table has RLS on and no policy, which denies every row to every
    non-bypassing role.

    Called from `upgrade()` immediately after each `create_table`, because
    CONVENTIONS §1 requires the isolation and the table in ONE revision. `0001`
    and `0002` are split for a reason that has expired: it let "the tables exist"
    and "the tables are isolated" be separately reversible while the schema was a
    skeleton. A table that reaches a database without a policy now is a table
    every role reads across tenants.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({_tenant_predicate('tenant_id')})")


def _release(table: str) -> None:
    """The inverse of `_isolate`, in the inverse order — `0002::_release`.

    Called by `downgrade()` before the `DROP TABLE`, which is theatre in isolation
    — `DROP TABLE` takes the policy with it — and is written out for `0003`'s
    stated reason: the day this table stops being dropped here, the policy is
    still reversed. `NO FORCE` and `DISABLE` are both issued because
    `relrowsecurity` and `relforcerowsecurity` are separate `pg_class` columns and
    neither clears the other.

    No `IF EXISTS` on the `DROP POLICY`: a policy already gone at downgrade time
    means something removed it, and that must be an error rather than a shrug.
    """
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _create_append_only_trigger() -> None:
    """`reports` accepts INSERT and nothing else, short of a superuser.

    **WHY A REPORT IS APPEND-ONLY AT ALL.** A reissue is a NEW ROW at `version`
    n+1 citing `supersedes_version` n; v1 stays as the DEFECT RECORD. The whole
    reissue design is "what was delivered, and what was wrong with it", and it is
    empty if v1 can be edited into agreement with v2 afterwards.

    🔴 **`FOR EACH STATEMENT` AND NOT `FOR EACH ROW`, AND THE REASON IS RLS
    RATHER THAN TASTE.** Under `FORCE ROW LEVEL SECURITY` a cross-tenant `UPDATE`
    matches zero rows, and a row-level trigger does not fire at all when a
    statement affects none. A row trigger would therefore be SILENT for exactly
    the case it exists to refuse — the caller would see `UPDATE 0` and no error,
    which is indistinguishable from "there was nothing to change". `0001` chose
    statement-level on `audit_log` for the same reason and this file inherits it
    rather than rediscovering it.

    It has a second consequence worth naming because a later revision must not
    undo it by accident: `tests/test_exact_acl_and_update_surface.py::test_no
    _before_row_trigger_exists_that_could_write_new_dot_anything` refuses every
    `BEFORE ... FOR EACH ROW` trigger in `public`, because such a trigger performs
    any `NEW.*` assignment with the INVOKER's privileges. A statement trigger has
    no `NEW` record at all, so it cannot widen a target list. That test ALSO
    asserts the trigger census is exactly `audit_log`'s two, so it fails here —
    see the module docstring's note on integration edits.

    🔴 `CREATE FUNCTION`, NOT `CREATE OR REPLACE`. With `OR REPLACE`, a
    `downgrade()` that forgot its `DROP FUNCTION` would leave the old body in
    place and the next `upgrade` would silently overwrite it — a round trip that
    passes while the schema is not actually being rebuilt. Plain `CREATE FUNCTION`
    turns that same omission into `DuplicateFunction` on the second upgrade. Do
    not "tidy" this into `OR REPLACE`.

    **TWO TRIGGERS, NOT ONE, AND THE SPLIT IS FORCED.** A `TRUNCATE` trigger can
    only be `FOR EACH STATEMENT`, so PostgreSQL rejects a combined
    `UPDATE OR DELETE OR TRUNCATE` trigger declared `FOR EACH ROW` outright — if
    the two shared a trigger the statement-versus-row decision above would be
    unrepresentable. `TRUNCATE` is not reached by `DELETE` privileges and is not
    filtered by RLS, so a table protected only against `DELETE` is emptiable by
    anyone holding `TRUNCATE`; nobody is granted it here, and the trigger is the
    control against the day somebody is.

    **`ENABLE ALWAYS` IS NOT ISSUED HERE, AND THAT IS A GAP RATHER THAN A
    DECISION.** `0004` promotes `audit_log`'s two triggers from `'O'` (origin) to
    `'A'` (always) so that a session with `session_replication_role = 'replica'`
    cannot walk past them, and reads `tgenabled` back to prove the `ALTER` landed.
    The same promotion belongs on these two. It is not written here because
    `0004`'s verification helper is keyed to `audit_log` by name and generalising
    it is an edit to a revision that is not this worker's; it is recorded as an
    unproven residual in the build report. Until it lands, these triggers hold
    against every role this system connects as and NOT against a session that has
    set `session_replication_role`, which is `SUSET` and therefore not available
    to `titlepipe_app`.

    `BEFORE`, so nothing is written before the refusal. The function returns
    `trigger` and takes no arguments because that is the only signature `CREATE
    TRIGGER` accepts, and it never actually returns: a `BEFORE` trigger that
    returned NULL would SILENTLY SUPPRESS the statement, which is
    indistinguishable from success at the client.

    `0A000` is `feature_not_supported`, which is the SQLSTATE `0001` raises for
    the identical refusal on `audit_log`. A handler that already knows that code
    means "this table does not accept that verb" needs no second one.
    """
    op.execute(
        f"""
        CREATE FUNCTION {APPEND_ONLY_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION USING
                ERRCODE = '0A000',
                MESSAGE = 'reports is append-only; ' || TG_OP || ' is refused',
                HINT = 'Render a new version citing supersedes_version; v1 is the defect record.';
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {APPEND_ONLY_TRIGGER}
        BEFORE UPDATE OR DELETE ON {APPEND_ONLY_TABLE}
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {NO_TRUNCATE_TRIGGER}
        BEFORE TRUNCATE ON {APPEND_ONLY_TABLE}
        FOR EACH STATEMENT EXECUTE FUNCTION {APPEND_ONLY_FUNCTION}()
        """
    )


def upgrade() -> None:
    # `checkfirst=False` for `0001`'s and `0003`'s reason: a type that already
    # exists here means a previous `downgrade` failed to drop it, and that must be
    # an error rather than a silent reuse of whatever labels the old type happened
    # to carry.
    DELIVERY_STATUS.create(op.get_bind(), checkfirst=False)

    op.create_table(
        "reports",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        # `version` and `template_version` are DIFFERENT NUMBERS over one
        # deliverable, and `shape` is a third axis again. Stored, never derived —
        # see the module docstring.
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("shape", sa.Text(), nullable=False),
        # `Text` and not `Integer`: a template version is an identifier the render
        # side prints, and nothing has established it is a number.
        sa.Column("template_version", sa.Text(), nullable=False),
        sa.Column("rendered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("supersedes_version", sa.Integer(), nullable=True),
        sa.Column("reissue_reason", sa.Text(), nullable=True),
        sa.Column("artifact_digest", sa.Text(), nullable=False),
        sa.Column("artifact_uri", sa.Text(), nullable=False),
        _tenant_fk(table="reports", column="order_id", target_table="orders"),
        # TENANT-PREFIXED. `(order_id, version)` alone would answer "does this
        # order already have a v2?" across tenants, before any policy is
        # consulted — unique enforcement runs BEFORE a policy's `WITH CHECK`.
        sa.UniqueConstraint(
            "tenant_id", "order_id", "version", name="uq_reports_tenant_id_order_id_version"
        ),
        sa.CheckConstraint("version >= 1", name="version_starts_at_one"),
        # A reissue states its reason and a v1 that supersedes nothing states
        # none. `num_nonnulls` is core PostgreSQL; 1 is the half-write a
        # hand-rolled `UPDATE` produces and is precisely the shape that makes a
        # reissue nobody can explain.
        sa.CheckConstraint(
            "num_nonnulls(supersedes_version, reissue_reason) IN (0, 2)",
            name="reissue_states_a_reason",
        ),
        sa.CheckConstraint(
            "supersedes_version IS NULL OR supersedes_version < version",
            name="supersedes_an_earlier_version",
        ),
        # 64 lowercase hex characters. A digest that is not one is not a SHA-256,
        # and the delivery receipt's `digest_recorded` step records THIS value —
        # so a malformed one is a receipt that cites nothing.
        sa.CheckConstraint(
            "artifact_digest ~ '^[0-9a-f]{64}$'", name="artifact_digest_is_lowercase_hex"
        ),
        _tenant_primary_key(),
    )

    op.create_table(
        "report_verified_checks",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("sentence", sa.Text(), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("page_from", sa.Integer(), nullable=True),
        sa.Column("page_to", sa.Integer(), nullable=True),
        # `CASCADE` is passed here and NOT on `reports.order_id`, and the
        # difference is a domain one rather than a habit. An assurance sentence
        # has no meaning apart from the report that carries it, so it cannot
        # outlive one; an order outliving its reports is ordinary. `relations.py`
        # states the rule: pass `ondelete` where the domain settles it and pass
        # nothing where it does not.
        _tenant_fk(
            table="report_verified_checks",
            column="report_id",
            target_table="reports",
            ondelete="CASCADE",
        ),
        # 🔴 THE ONE SINGLE-COLUMN FOREIGN KEY IN THIS FILE, AND IT IS LEGAL
        # BECAUSE `rules` IS GLOBAL. See the module docstring. No `ondelete`: a
        # rule a delivered report cites must not be deletable out from under it,
        # and `RESTRICT` — PostgreSQL's default — is what says so.
        sa.ForeignKeyConstraint(
            ["rule_id"], ["rules.id"], name="fk_report_verified_checks_rule_id_rules"
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "report_id",
            "ordinal",
            name="uq_report_verified_checks_tenant_id_report_id_ordinal",
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        # A page range is a PAIR or it is absent. One endpoint is a citation that
        # points at half a location, which is the shape principle 6 refuses.
        sa.CheckConstraint(
            "num_nonnulls(page_from, page_to) IN (0, 2)", name="page_range_is_a_pair"
        ),
        sa.CheckConstraint(
            "page_to IS NULL OR page_to >= page_from", name="page_range_runs_forwards"
        ),
        _tenant_primary_key(),
    )

    op.create_table(
        "deliveries",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), nullable=False),
        # `method` is `text`: how a report reaches a client is a client-side fact
        # with no published vocabulary, and the enum-versus-text line in this
        # schema is drawn at "does an unknown value mean something is broken".
        sa.Column("method", sa.Text(), nullable=False),
        # `status` IS an enum, and that is the same line drawn the other way: an
        # unrecognised delivery state means the transit state machine has moved
        # and something is broken. `DELIVERY_STATUS` is `enums.ts:104-111`
        # verbatim, so the browser parses these exact strings.
        _enum_column("status", DELIVERY_STATUS),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        # No `ondelete`: a report with deliveries against it must not vanish. See
        # `relations.py` — a `RESTRICT`-by-default parent that refuses to
        # disappear under its children is the failure that gets noticed.
        _tenant_fk(table="deliveries", column="report_id", target_table="reports"),
        # 🔴 THE MACHINE FOR "`failed_transit` IS A TRANSIT STATE AND NEVER A
        # QUALITY SIGNAL". Without it a retry could inherit a delivery instant
        # from the attempt that failed, and the record would show a delivery that
        # never happened — a retryable transit problem turned into a false
        # assurance about the deliverable.
        sa.CheckConstraint(
            "delivered_at IS NULL OR status IN ('transmitted', 'acknowledged')",
            name="delivered_at_needs_a_transmitting_status",
        ),
        sa.CheckConstraint(
            "delivered_at IS NULL OR attempted_at IS NOT NULL",
            name="a_delivery_was_attempted_first",
        ),
        _tenant_primary_key(),
    )

    op.create_table(
        "delivery_receipt_steps",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("delivery_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        # `step_key` is `text` even though the four steps — signed, digest
        # recorded, transmitted, acknowledged — are described as canonical. The
        # contract models a receipt row as free-form and a reissue's receipt
        # legitimately differs; an unexpected receipt row does not mean something
        # is broken, which is where this schema draws the enum line.
        sa.Column("step_key", sa.Text(), nullable=False),
        sa.Column("what", sa.Text(), nullable=False),
        sa.Column("who", sa.Text(), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False),
        sa.Column("happened_at", sa.DateTime(timezone=True), nullable=True),
        # `CASCADE` for `report_verified_checks`' reason: a receipt step is part
        # of the delivery, not a fact about it.
        _tenant_fk(
            table="delivery_receipt_steps",
            column="delivery_id",
            target_table="deliveries",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "delivery_id",
            "ordinal",
            name="uq_delivery_receipt_steps_tenant_id_delivery_id_ordinal",
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        # 🔴 ONE EQUALITY AND NOT TWO IMPLICATIONS. A step marked done with no
        # instant is a claim nobody timestamped; an instant on a step not marked
        # done is a timestamp for something that did not happen. Written as `=`,
        # neither half can be relaxed without the reader seeing the other go.
        sa.CheckConstraint("is_done = (happened_at IS NOT NULL)", name="done_records_when"),
        _tenant_primary_key(),
    )

    for table in TABLES:
        _isolate(table)

    _create_append_only_trigger()

    # RLS is evaluated AFTER the privilege check, never instead of it. Without
    # these the app role gets `42501 permission denied for table reports` and an
    # isolation test would read zero rows and call it isolation.
    #
    # Written out per table rather than looped, for `0002`'s stated reason: each
    # object gets one reviewable line, and the ONE grant that differs from the
    # other three is a line of its own rather than a branch inside a loop.
    op.execute(f"GRANT SELECT, INSERT ON reports TO {APP_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON report_verified_checks TO {APP_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON deliveries TO {APP_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE ON delivery_receipt_steps TO {APP_ROLE}")


def downgrade() -> None:
    """Every object `upgrade` created, dropped, in reverse order.

    Not `pass`. A `downgrade` that does not reverse its `upgrade` makes
    `upgrade -> downgrade -> upgrade` fail on the second pass — on the ENUM
    first, with `type "delivery_status" already exists`, because `DROP TABLE`
    does not drop a type — and that failure is invisible to a fresh database.
    """
    op.execute(f"REVOKE SELECT, INSERT, UPDATE ON delivery_receipt_steps FROM {APP_ROLE}")
    op.execute(f"REVOKE SELECT, INSERT, UPDATE ON deliveries FROM {APP_ROLE}")
    op.execute(f"REVOKE SELECT, INSERT, UPDATE ON report_verified_checks FROM {APP_ROLE}")
    op.execute(f"REVOKE SELECT, INSERT ON reports FROM {APP_ROLE}")

    for table in reversed(TABLES):
        _release(table)

    # Both triggers go with `DROP TABLE reports`; the FUNCTION does not, because
    # it belongs to the schema rather than to the table. Dropped explicitly for
    # `0001`'s reason — and, since this is `CREATE FUNCTION` rather than `CREATE
    # OR REPLACE`, forgetting it is a `DuplicateFunction` on the next upgrade
    # rather than a stale body nobody notices.
    op.drop_table("delivery_receipt_steps")
    op.drop_table("deliveries")
    op.drop_table("report_verified_checks")
    op.drop_table("reports")

    op.execute(f"DROP FUNCTION {APPEND_ONLY_FUNCTION}()")

    DELIVERY_STATUS.drop(op.get_bind(), checkfirst=False)

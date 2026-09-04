"""The record-class taxonomy, the data-class axis, and the retention-window table

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-04

ASSUMED PARENT: `0004`, which was `head` when this file was written. Several
revisions are being authored in parallel; per CONVENTIONS §8 this is NOT a
guess at the final chain, and whoever integrates linearises it.

## Why this lands BEFORE any retainable column, not after

PLAN.md §8 step 2 gate (ii): *a retainable row created before its class exists
has no correct class to be back-filled with*. A row written today under an
implicit "we will classify it later" is a row whose class must later be inferred
from whatever else survived about it, and inference is exactly what a statutory
retention duty cannot rest on.

## Two axes, and they are deliberately not one column

`record_class` answers **how long must this be kept**. `data_class` answers
**what must be destroyed when it goes**. They cross: PLAN.md §2 records that the
report's own `verified_checks` assurance list names case numbers and page ranges,
so the assurance record is a `derived_artifact` that is simultaneously NPI-bearing.
A single column cannot express that without one of the two questions silently
losing — the same discipline as `na_reason`'s refusal to collapse `NOT_PRESENT`
into `PRESENT_UNREADABLE`.

`record_class`'s six labels are PLAN.md §2's five plus `operational_telemetry`,
which the plan requires an explicit slot for *precisely so it cannot default into
either of the other buckets*. It is in the type and it is REFUSED by this
revision's `ck_record_classifications_telemetry_is_not_stored_here`: telemetry
lives in a separate store with separate retention and separate access control
(`infra/observability/README.md`), so a classification row claiming it in THIS
database is a category error, and the CHECK is the machine that says so rather
than a comment asking nicely.

`data_class`'s six labels are not invented here either. They are
`hive/design/backend-2026-09/discovery-data-domain.md` §"Classes used" verbatim,
measured field-by-field against the one real corpus package:

  npi      GLBA nonpublic personal information: an identified natural person
           with financial or property detail
  pub_id   identifies a natural person but originates in a public record
  client   the customer's business data
  ops      our operational or commercial data, no natural person
  ref      carries no personal data itself but RESOLVES to something that does
  safe     neither

🔴 `ref` IS THE LABEL THAT GETS MISSED, and it is in the type for that reason.
D4's evidence: `anonymise-bundle.mjs` drops the OCR `job` id explicitly because
*"a `/scan/<job>/` href would point back at the originals"*. An opaque identifier
is not automatically safe.

🔴 **WHICH `data_class` VALUES ARE "NPI-BEARING" FOR DESTRUCTION PURPOSES IS NOT
DECIDED HERE AND NOTHING IN THIS REVISION IMPLIES AN ANSWER.** `npi` plainly is;
`ref` plainly should be (it resolves to NPI); `pub_id` is a genuine legal question
about data that is simultaneously personal and already public. That mapping is
counsel's, it is recorded as a REQUEST in
`hive/design/backend-2026-09/build-retention-audit.md` §8, and there is
deliberately no `is_npi_bearing` column and no `data_class_is_npi_bearing()`
function for anyone to read a decision out of.

## `retention_windows` is GLOBAL, and it ships EMPTY

It carries NO `tenant_id`, exactly as `rules` does and for the same kind of
reason: a statutory retention floor is law, not tenant configuration. PLAN.md §2
is explicit that a per-tenant `retention_days` column *"cannot be compliant. It
is a schema defect, not a config gap."* The window is resolved as a function of
`(record_class, jurisdiction)` and nowhere else.

**It ships with zero rows, and that is the deliverable.** The numeric windows are
with the owner (PLAN.md §9). What this revision builds is the mechanism, so that
only the numbers wait — and `retention_window()` RAISES `55000` for a
`(record_class, jurisdiction)` pair nobody has ruled on, rather than returning a
default. There is no default. The "7 years" in `reference-app.html` is a pixel
with zero policy authority (PLAN.md §2) and the only way to keep it out of the
schema permanently is for the schema to have no number in it at all until someone
with the authority puts one there.

`ck_retention_windows_days_xor_indefinite` is why a row cannot say both "keep for
N days" and "keep indefinitely": Texas requires all three shapes at once
(≥3 years, ≥15 years, indefinite), so both columns must exist and exactly one of
them must be answered.

## What this revision does NOT do, stated rather than left to be discovered

* **It adds no `record_class` column to any domain table.** `documents`, `orders`
  and `packages` belong to other workers this phase; PLAN.md §2's end state is a
  `record_class` dimension ON each retainable artifact, and `record_classifications`
  is the seam that lets an artifact be classified before its own table has the
  column. THE RESIDUAL IS DRIFT: nothing yet forces a retainable row to have a
  classification row. The machine for that is a coverage check that cannot be
  written until the retainable tables exist, and it is REQUESTED rather than
  claimed.
* **It resolves no anchor.** "≥15 years after policy issuance" and "≥5 years from
  close of escrow" are windows from DIFFERENT events. `retention_windows.anchor`
  is free TEXT and not an enum, because the closed set of anchors is not
  something this revision has the authority to close; `retention_is_disposable()`
  in `0006` therefore takes the anchor instant as a PARAMETER rather than
  inferring one.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 🔴 EXACTLY THESE LABELS, IN THIS ORDER — the five of PLAN.md §2 plus the sixth
# the plan requires an explicit slot for. Repeated here rather than imported from
# `titlepipe_core.db.models`, for `0001`'s reason: a migration is a frozen
# snapshot, and an import would let a later model edit rewrite what `0005` claims
# to have created. `tests/test_retention_foundation.py` asserts the live
# `pg_enum` against the model constant, on the labels AND on `enumsortorder`.
RECORD_CLASS_LABELS = (
    "evidence_of_insurability",
    "escrow_accounting",
    "policy",
    "derived_artifact",
    "npi_payload",
    "operational_telemetry",
)

# discovery-data-domain.md §"Classes used", verbatim, lower-cased to the
# convention. `pub_id` is D4's `PUB-ID`.
DATA_CLASS_LABELS = ("npi", "pub_id", "client", "ops", "ref", "safe")

RECORD_CLASS_TYPE_NAME = "record_class"
DATA_CLASS_TYPE_NAME = "data_class"

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE`
# as a side effect of the column. Each type is created and dropped by its own
# explicit statement, which is the only way either gets a `DROP` at all — see
# `0001`, where the omission makes only the SECOND upgrade fail.
RECORD_CLASS = postgresql.ENUM(*RECORD_CLASS_LABELS, name=RECORD_CLASS_TYPE_NAME, create_type=False)
DATA_CLASS = postgresql.ENUM(*DATA_CLASS_LABELS, name=DATA_CLASS_TYPE_NAME, create_type=False)

# The one label the taxonomy names so it cannot be defaulted into another bucket,
# and which this database therefore refuses to hold a classification row for.
TELEMETRY_LABEL = "operational_telemetry"

POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

# `55000` is `object_not_in_prerequisite_state`. It is PostgreSQL's own named
# condition for "the thing you are asking about is not in a state where that
# question has an answer", which is exactly what an unruled retention window is.
#
# THE POINT OF A NAMED SQLSTATE IS THAT NO TYPO CAN PRODUCE IT — `0001` makes the
# same argument for `0A000`. An unknown column raises `42703` and an unknown
# table `42P01`, so a test asserting `55000` cannot pass because the test itself
# is misspelled.
UNRULED_SQLSTATE = "55000"

RETENTION_WINDOW_FUNCTION = "retention_window"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`.

    A near-copy and deliberately not an import: a `Column` binds to the first
    `Table` it is added to, so one shared object attaches every table to the
    first; and a migration is a frozen snapshot that must not be rewritten by an
    edit to `0001`. The heterogeneous tuple return is load-bearing rather than
    stylistic — `Column` is INVARIANT in its type parameter, so `Column[UUID]` is
    not assignable to `Column[object]`.
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


def _enum_column(name: str, enum: postgresql.ENUM, *, nullable: bool = False) -> sa.Column[str]:
    """One enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR AND NOT A NARROWING THE CHECKER
    VERIFIED; `0001::_na_reason_column` holds the measurement showing that
    `Column[complex]` type-checks here exactly as happily. What makes `str` the
    right one is that the identical column spelled with generic `sa.Enum` infers
    `Column[str]`, and that these columns hold one of a fixed set of label
    strings and nothing else.
    """
    return sa.Column(name, enum, nullable=nullable)


def upgrade() -> None:
    # `checkfirst=False` for `0001`'s reason: a type that already exists here
    # means a previous `downgrade` failed to drop it, and that must be an error
    # rather than a silent reuse of whatever labels the old type happened to
    # carry.
    RECORD_CLASS.create(op.get_bind(), checkfirst=False)
    DATA_CLASS.create(op.get_bind(), checkfirst=False)

    _create_retention_windows()
    _create_record_classifications()
    _create_retention_window_function()


def _create_retention_windows() -> None:
    """The statutory floor table. GLOBAL, and EMPTY.

    🔴 NO `tenant_id`, NO POLICY, NO ROW-LEVEL SECURITY, and all three are the
    ruling rather than an omission — `0003` states the same ruling for `rules`
    and this table is its sibling. A retention floor is law. It is identical for
    every tenant in a jurisdiction and it is not a per-tenant setting; PLAN.md §2
    calls a per-tenant `retention_days` column *a schema defect, not a config
    gap*. The consequence a reader has to know: this table is readable with NO
    tenant established, exactly as `rules` is.

    A GLOBAL TABLE HAS TO BE NAMED IN TWO TEST LITERALS OR THE SUITE FAILS, and
    that is by design rather than an inconvenience — `tests/conftest.py`'s
    `ISOLATION_GLOBAL_TABLES` and `tests/test_forced_rls_and_grants.py`'s
    `EXPECTED_GLOBAL_TABLES` both refuse a table with no `tenant_id` that nobody
    has deliberately exempted, and the refusal message points here.

    `uq_retention_windows_record_class_jurisdiction` IS SAFE ON A GLOBAL TABLE
    and would not be on a tenant one. CONVENTIONS §2 forbids a standalone unique
    key without the `tenant_id` prefix because unique enforcement runs before a
    policy's `WITH CHECK` and so answers "does this exist in another tenant?" to
    a caller who cannot read the row. There is no other tenant here: every row is
    visible to every caller by ruling, so the constraint discloses nothing that a
    `SELECT` does not.

    `minimum_retention_days` is NULLABLE and `retention_is_indefinite` is NOT
    NULL, with a CHECK making exactly one of them the answer. Texas alone forces
    three different shapes at once (PLAN.md §2: escrow accounting ≥3 years,
    evidence of insurability ≥15 years after policy issuance, policies
    indefinitely), so "indefinite" cannot be spelled as a very large number of
    days without the schema lying about what it knows.

    `authority` and `source_reference` are NOT NULL because of principle 6 —
    never emit a value you cannot cite. A retention window with no citation is
    the `reference-app.html` "7 years" pixel wearing a database column.
    """
    op.create_table(
        "retention_windows",
        *_identity_columns(),
        _enum_column("record_class", RECORD_CLASS),
        sa.Column("jurisdiction", sa.Text(), nullable=False),
        sa.Column("minimum_retention_days", sa.Integer(), nullable=True),
        sa.Column("retention_is_indefinite", sa.Boolean(), nullable=False),
        # Free TEXT and not an enum, deliberately. "after policy issuance" and
        # "from close of escrow" are different events, and the closed set of
        # anchors is not something this revision has the authority to close.
        sa.Column("anchor", sa.Text(), nullable=False),
        sa.Column("authority", sa.Text(), nullable=False),
        sa.Column("source_reference", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("record_class", "jurisdiction"),
        # `<>` on two booleans is XOR. A row saying both, or neither, is refused.
        sa.CheckConstraint(
            "(minimum_retention_days IS NOT NULL) <> retention_is_indefinite",
            name="days_xor_indefinite",
        ),
        sa.CheckConstraint(
            "minimum_retention_days IS NULL OR minimum_retention_days > 0",
            name="days_is_positive",
        ),
    )

    # SELECT only, and no INSERT: a statutory floor is not something the
    # application writes. It arrives by migration once the owner rules, the same
    # way `rules` content does. `titlepipe_worker` is named nowhere, as in `0002`
    # and `0003`.
    op.execute("GRANT SELECT ON retention_windows TO titlepipe_app")


def _create_record_classifications() -> None:
    """The classification of one retainable artifact, on BOTH axes.

    TENANT-SCOPED, with `PRIMARY KEY (tenant_id, id)`, `ENABLE` + `FORCE ROW
    LEVEL SECURITY` and its `tenant_isolation` policy created in THIS migration —
    CONVENTIONS §1: a tenant table missing any of the three is a defect, and the
    coverage assertion that catches it is
    `tests/test_forced_rls_and_grants.py`, which DERIVES the tenant tables from
    the catalog rather than reading a list.

    `(subject_table, subject_id)` rather than a foreign key, because there is no
    single table to point at — a classification attaches to a document, an order,
    a report or a reading — and because CONVENTIONS §1 permits a foreign key only
    in the composite `(tenant_id, …)` form, which a polymorphic reference cannot
    take. THE COST IS REAL AND IS NOT PAPERED OVER: nothing in the database
    refuses a classification naming a table that does not exist, or a subject id
    that names no row. That is an unproven residual, recorded as one.

    `uq_record_classifications_tenant_id_subject_table_subject_id` is
    tenant-PREFIXED, which is CONVENTIONS §2 and is the difference between a
    unique key here and the one on `retention_windows` above: this table is
    tenant-scoped, so an unprefixed unique key on `(subject_table, subject_id)`
    would answer "is this id classified in some other tenant?" to a caller who
    cannot read the row, because unique enforcement runs before `WITH CHECK`.

    `jurisdiction` NOT NULL on the row rather than looked up from the tenant:
    the window is a function of `(record_class, jurisdiction)`, and a Texas
    tenant can hold a California escrow file. Reading the jurisdiction off the
    tenant would silently apply the wrong statutory floor to it.

    `classification_basis` NOT NULL is principle 6 again: a classification is a
    value emitted about a record, and one that cannot be cited is one nobody can
    review.
    """
    op.create_table(
        "record_classifications",
        *_identity_columns(),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_table", sa.Text(), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        _enum_column("record_class", RECORD_CLASS),
        _enum_column("data_class", DATA_CLASS),
        sa.Column("jurisdiction", sa.Text(), nullable=False),
        sa.Column("classified_by", sa.Text(), nullable=False),
        sa.Column("classification_basis", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("tenant_id", "id"),
        sa.UniqueConstraint("tenant_id", "subject_table", "subject_id"),
        # 🔴 THE SLOT EXISTS IN THE TYPE AND IS REFUSED IN THIS TABLE. PLAN.md §2
        # requires the taxonomy to have an explicit `operational_telemetry` slot
        # so telemetry cannot default into either statutory bucket; it also
        # records that telemetry lives in a SEPARATE store with separate
        # retention and separate access control. Both are true at once only if
        # the label is in the enum and a row carrying it is impossible here.
        sa.CheckConstraint(
            f"record_class <> '{TELEMETRY_LABEL}'::{RECORD_CLASS_TYPE_NAME}",
            name="telemetry_is_not_stored_here",
        ),
    )

    _isolate("record_classifications")

    # SELECT/INSERT/UPDATE and no DELETE. Reclassification is a real act and is
    # an UPDATE; `0007` puts an `ENABLE ALWAYS` audit trigger on this table, so
    # the before/after of that act is recorded whether or not the application
    # remembers to. Deleting a classification would erase the only statement of
    # what a retained record IS, so the verb is simply not granted — the machine
    # is the ACL, asserted by `tests/acl_contract.py`'s closed-world literal.
    op.execute("GRANT SELECT, INSERT, UPDATE ON record_classifications TO titlepipe_app")


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, and one policy — `0002::_isolate`, spelled again here.

    Copied rather than imported for `0001`'s stated reason (revision files are
    loaded by path, are not a package, and importing across them is not a
    supported seam), and asserted rather than trusted:
    `tests/test_forced_rls_and_grants.py` reads `pg_policies` for every table
    carrying `tenant_id` and compares the predicate's SHAPE, so a policy created
    here with a different expression fails there.

    `nullif(…, '')` is not decoration. `current_setting(x, true)` answers NULL for
    a GUC that was never defined but the EMPTY STRING for one that was set and
    rolled back, and `''::uuid` raises `invalid input syntax for type uuid` — a
    500 where a clean denial belongs. `0002`'s docstring holds the measurement.
    """
    predicate = f"tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({predicate})")


def _release(table: str) -> None:
    """The inverse of `_isolate`, in the inverse order — `0002::_release`.

    Both `NO FORCE` and `DISABLE` are issued: they are separate `pg_class`
    columns and neither clears the other, so a downgrade issuing only `DISABLE`
    leaves `relforcerowsecurity = true` behind on a table with no RLS.
    """
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _create_retention_window_function() -> None:
    """`retention_window(record_class, jurisdiction)` — and it REFUSES to guess.

    🔴 THIS FUNCTION IS THE ENTIRE REASON THE NUMBERS CAN WAIT. The mechanism is
    complete today; the table it reads is empty; and every caller asking about a
    `(record_class, jurisdiction)` pair nobody has ruled on gets
    `55000 object_not_in_prerequisite_state` with the pair named in the message.
    It does not return NULL, it does not return a default, and there is no
    fallback row. PLAN.md §2: *the "7 years" in `reference-app.html` is a pixel
    with zero policy authority and MUST NOT reach the schema.* A function that
    answered anything at all for an unruled pair is how it would reach it.

    `RETURNS retention_windows` — the whole row, not an integer. An integer
    return would have to spell "indefinite" as either NULL or a very large
    number, and both are the collapse this taxonomy exists to prevent: the caller
    must read `retention_is_indefinite` and cannot avoid seeing it.

    `STABLE` and not `IMMUTABLE`: it reads a table, so its answer changes when the
    owner's ruling lands. `IMMUTABLE` would license the planner to fold a call
    into a constant.

    🔴 NOT `SECURITY DEFINER`. It runs with the CALLER's privileges, so a role
    with no `SELECT` on `retention_windows` gets `42501` rather than a quietly
    privileged read. `retention_windows` is global and carries no policy, so
    there is no tenant filter here to bypass either way.

    `REVOKE EXECUTE … FROM PUBLIC` is issued for every function this build
    creates. PostgreSQL's default ACL on a new function is `EXECUTE` to `PUBLIC`,
    which `tests/acl_contract.py`'s whole-catalog literal would either miss
    (because `p.proacl IS NOT NULL` filters a default ACL out) or fail on. Making
    the ACL explicit is what puts the function inside that closed world at all.
    """
    op.execute(
        f"""
        CREATE FUNCTION {RETENTION_WINDOW_FUNCTION}(
            p_record_class {RECORD_CLASS_TYPE_NAME},
            p_jurisdiction text
        ) RETURNS retention_windows
        LANGUAGE plpgsql STABLE AS $$
        DECLARE
            found_window retention_windows;
        BEGIN
            SELECT * INTO found_window
              FROM retention_windows
             WHERE record_class = p_record_class
               AND jurisdiction = p_jurisdiction;

            IF NOT FOUND THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{UNRULED_SQLSTATE}',
                    MESSAGE = 'no retention window is ruled for record_class '
                              || p_record_class || ' in jurisdiction '
                              || quote_literal(p_jurisdiction),
                    HINT = 'The numeric windows are the owner''s ruling '
                           '(PLAN.md section 9). There is deliberately no default: '
                           'a window nobody ruled must refuse, not guess.';
            END IF;

            RETURN found_window;
        END;
        $$
        """
    )
    op.execute(
        f"REVOKE EXECUTE ON FUNCTION "
        f"{RETENTION_WINDOW_FUNCTION}({RECORD_CLASS_TYPE_NAME}, text) FROM PUBLIC"
    )
    op.execute(
        f"GRANT EXECUTE ON FUNCTION "
        f"{RETENTION_WINDOW_FUNCTION}({RECORD_CLASS_TYPE_NAME}, text) TO titlepipe_app"
    )


def downgrade() -> None:
    op.execute(f"DROP FUNCTION {RETENTION_WINDOW_FUNCTION}({RECORD_CLASS_TYPE_NAME}, text)")

    _release("record_classifications")
    op.execute("REVOKE SELECT, INSERT, UPDATE ON record_classifications FROM titlepipe_app")
    op.drop_table("record_classifications")

    op.execute("REVOKE SELECT ON retention_windows FROM titlepipe_app")
    op.drop_table("retention_windows")

    # 🔴 `DROP TABLE` DOES NOT DROP A TYPE. Without these two lines a fresh
    # upgrade still works and only the SECOND one — the one after a downgrade —
    # fails, with `type "record_class" already exists`. Reverse of creation
    # order, which nothing enforces today and stays correct when a later
    # revision adds a type depending on one of these.
    DATA_CLASS.drop(op.get_bind(), checkfirst=False)
    RECORD_CLASS.drop(op.get_bind(), checkfirst=False)

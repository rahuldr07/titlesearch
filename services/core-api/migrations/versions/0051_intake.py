"""The intake subsystem — products, client configuration, sign-off, completeness

Revision ID: 0051
Revises: 0050
Create Date: 2026-09-04

EVERYTHING IN THIS REVISION IS BUILT UNDER ASSUMPTION, AND THE WHOLE
   REVISION IS THE UNIT OF REVERSAL.
The owner has NOT answered whether TitlePipe acquires a product-and-sign-off
layer. god ruled it in ahead of that answer, on one argument: the completeness
gate sits IMMEDIATELY UPSTREAM of the most expensive step in the system —
measured at about 1h51m of GPU per 101-page package — so it is the only piece of
the proposed layer that pays for itself in compute. Finding out after extraction
that a package cannot support the ordered search costs the extraction.

**IF THE OWNER ANSWERS "NO", `alembic downgrade` OVER THIS ONE REVISION IS THE
WHOLE REVERSAL**, and that is a property this file is arranged to have rather
than a hope:

* every table it creates is created HERE — six of them, and no other module's
  migration references any of them;
* every object it adds to a table it does NOT own is added here and dropped in
  `downgrade()`: the two composite foreign keys `0008` deliberately deferred
  (`orders.product_id`, `orders.frozen_config_version_id`) and the two triggers
  on `orders`;
* what survives the reversal on `orders` is exactly what `0008` says survives:
  four nullable columns that no constraint references and nothing populates.
  `0008` chose the columns-without-keys split for this reason — FKs left behind
  would reference dropped tables, which is not inert.

**NOTHING OUTSIDE THIS REVISION MAY POINT AT AN INTAKE TABLE.** A later
migration adding, say, `packages.product_id REFERENCES products` would silently
convert a one-command reversal into an unpicking job. That is the invariant to
protect, and it is not enforceable from inside a migration — it is a review rule,
recorded here because this is the file a reviewer of that change would read.

## Assumed parent

`down_revision = "0050"` — this worker's own preceding revision, which is a real
dependency rather than an assumption: nothing here touches a `delivery` table,
but `0050` is where this branch's chain currently continues from. `0050`'s own
parent (`0008`) is the assumed one. Three workers are numbering in reserved
ranges in parallel; god relinearizes at integration and this must not be rebased
onto another worker's chain by hand.

## What holds each invariant

* **A product derives a search period.** `ck_products_a_year_period_states_its
  _years` is an `=` between two predicates, not two implications: a
  `period_kind = 'years'` with no `period_years`, and a year count on a product
  whose period is not counted in years, are one constraint and fail together.
* **Configuration is a delta, versioned, and never edited in place.** An edit
  publishes a new version; `ix_client_config_versions_one_current_per_client
  _product` is a PARTIAL unique index over `is_current` rather than a plain
  unique constraint, because the whole point is that superseded versions stay.
* **An order freezes a version at intake and never moves it.**
  `orders_freeze_config_version_once_set`.
* **Every effective config line carries its origin.** `origin_ref` is `NOT
  NULL`, and that IS the machine — an unciteable line is a write error, not a
  lint finding. Principle 6 generalised from field values to configuration.
* **A `NO` on the checklist states why.** `ck_intake_signoff_lines_a_no_states
  _why`, and it demands a NON-BLANK comment: an empty string satisfies `IS NOT
  NULL` and satisfies nobody reading the disclosure it becomes.
* **A signature is one act, and freezes the lines.**
  `ck_intake_signoffs_signature_is_whole` plus
  `intake_signoff_lines_are_frozen_once_signed`, which reads the PARENT rather
  than trusting a flag copied onto the child.
* **The gate blocks extraction.**
  `orders_extraction_release_needs_a_closed_gate`.
* **`gate_open` is not a column.** It is derived server-side from
  `completeness_gaps`; storing it would create a second answer that can disagree
  with the gaps themselves.

## THREE TRIGGERS, ALL `AFTER ... FOR EACH ROW`, AND `AFTER` IS THE LOAD-BEARING WORD

A `BEFORE ROW` trigger runs with the INVOKER's privileges and any `NEW.*` it
assigns is a column write outside the caller's grant — under a column-scoped
grant the caller does not hold, the statement takes `42501` from a line that
appears in no handler, no model and no test expectation.
`tests/test_exact_acl_and_update_surface.py::test_no_before_row_trigger_exists
_that_could_write_new_dot_anything` refuses every one of them in `public`, and
these three are `AFTER` so that they stay outside it. An `AFTER` trigger cannot
assign `NEW.*` at all, and a `RAISE` from one still aborts the transaction — the
write is refused just as completely, and demonstrably cannot be the mechanism
that test is watching for.

They are ROW triggers and not STATEMENT ones, unlike `0050`'s append-only pair,
because each has to read the row it is judging. That costs the property
`0050`'s docstring relies on — a row trigger does not fire when a statement
matches no rows — and here that is CORRECT rather than tolerated: a release that
matched no order released nothing, and a config-version move that matched no
order moved nothing. There is no cross-tenant statement these must refuse.

## What this revision does NOT enforce, stated rather than left to be found

* **DELETE of a signed checklist line.** `intake_signoff_lines_are_frozen_once
  _signed` fires on `UPDATE` only, which is what `models/intake.py` declares.
  Extending it to `DELETE` would also fire on the legitimate
  `ON DELETE CASCADE` from `intake_signoffs`, where the parent is being removed
  in the same statement, so the naive widening breaks a path that is supposed to
  work. It is an open residual, not a covered case.
* **`clients` does not exist on this branch**, so
  `client_config_versions.client_id` carries no foreign key — `orders.client_id`'s
  situation exactly, and recorded the same way: a one-line follow-up migration
  once both chains are linearized, tracked in the build report rather than left
  as a comment.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0051"
down_revision: str | None = "0050"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# FOUR TYPES, THREE CONFIRMED AND ONE INVENTED, AND THE DIFFERENCE IS
# RECORDED BECAUSE IT DECIDES WHO CORRECTS WHOM. `signoff_answer`, `gap_kind` and
# `gap_close_kind` are `packages/contract/src/intake.ts` verbatim (:12, :122,
# :131) — the browser parses these exact strings through Zod at its own boundary,
# so a label differing by a character makes every response a translation and
# surfaces as a parse failure in a screen rather than as an error here.
# `config_line_effect` has NO contract behind it: the four verbs are the plan's
# own words, and a later contract that disagrees corrects `models/enums.py` and
# this file rather than being bent to match them.
#
# Repeated here rather than imported from `models.enums`, for the reason `0001`
# and `0003` give: a migration is a frozen snapshot, and an import would let a
# later edit to the model silently rewrite what this revision claims to have
# created. The live `pg_enum` is what holds the copies together.
#
# `N/A` CARRIES A SLASH AND THAT IS THE CONTRACT'S SPELLING, NOT A TYPO TO
# NORMALISE. A PostgreSQL enum label is a string literal and not an identifier,
# so the slash needs no quoting beyond the literal; renaming it to `NA` would put
# a translation table in a place no test compares.
SIGNOFF_ANSWER_LABELS = ("YES", "NO", "N/A")
GAP_KIND_LABELS = ("na_provisional", "disagreement", "period_short")
GAP_CLOSE_KIND_LABELS = ("upload", "amend", "root_of_title", "change_product")
CONFIG_LINE_EFFECT_LABELS = ("waive", "narrow", "replace", "add")

SIGNOFF_ANSWER_TYPE_NAME = "signoff_answer"
GAP_KIND_TYPE_NAME = "gap_kind"
GAP_CLOSE_KIND_TYPE_NAME = "gap_close_kind"
CONFIG_LINE_EFFECT_TYPE_NAME = "config_line_effect"

# `create_type=False` throughout, so `op.create_table` does not emit a second
# `CREATE TYPE` as a side effect of a column. Each is created and dropped by its
# own explicit statement, which is the only way any of them gets a `DROP` at all
# — `DROP TABLE` does not drop a type, and four types left behind kill the next
# `upgrade` on the first of them, a failure a fresh database never finds.
SIGNOFF_ANSWER = postgresql.ENUM(
    *SIGNOFF_ANSWER_LABELS, name=SIGNOFF_ANSWER_TYPE_NAME, create_type=False
)
GAP_KIND = postgresql.ENUM(*GAP_KIND_LABELS, name=GAP_KIND_TYPE_NAME, create_type=False)
GAP_CLOSE_KIND = postgresql.ENUM(
    *GAP_CLOSE_KIND_LABELS, name=GAP_CLOSE_KIND_TYPE_NAME, create_type=False
)
CONFIG_LINE_EFFECT = postgresql.ENUM(
    *CONFIG_LINE_EFFECT_LABELS, name=CONFIG_LINE_EFFECT_TYPE_NAME, create_type=False
)

ENUM_TYPES = (SIGNOFF_ANSWER, GAP_KIND, GAP_CLOSE_KIND, CONFIG_LINE_EFFECT)

# `0002`'s constants, copied for its reason. `_tenant_predicate` must render the
# expression `0002` renders: `test_forced_rls_and_grants.py` matches every
# policy's `qual` against ONE shape, so a policy spelled differently here fails a
# test written about `orders`.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"

APP_ROLE = "titlepipe_app"

# Parents first. `_isolate`, the grants and `downgrade` all walk this, so a table
# added to `upgrade` and forgotten in one of the three is a table with no policy.
TABLES = (
    "products",
    "client_config_versions",
    "client_config_lines",
    "intake_signoffs",
    "intake_signoff_lines",
    "completeness_gaps",
)

# The two composite foreign keys `0008` deferred, by the names
# `models/orders.py` declares. The second drops its `_client_config_versions`
# suffix because the generated name is 67 bytes and PostgreSQL's limit is 63 —
# `relations.py` states the rule for the overflow (drop the target-table suffix,
# keep the columns) and this is one of the four references that needs it.
ORDERS_PRODUCT_FK = "fk_orders_tenant_id_product_id_products"
ORDERS_CONFIG_VERSION_FK = "fk_orders_tenant_id_frozen_config_version_id"

# One current config version per (client, product), as a PARTIAL unique index.
# Tenant-prefixed like every other natural key in this schema: unique enforcement
# runs BEFORE a policy's `WITH CHECK`, so an unprefixed version of this index
# would answer "does another tenant have a current config for this client?" to a
# caller who can neither read nor count the row.
CURRENT_CONFIG_INDEX = "ix_client_config_versions_one_current_per_client_product"

FREEZE_FUNCTION = "orders_refuse_a_config_version_move"
FREEZE_TRIGGER = "orders_freeze_config_version_once_set"
GATE_FUNCTION = "orders_refuse_an_extraction_release_with_an_open_gate"
GATE_TRIGGER = "orders_extraction_release_needs_a_closed_gate"
LINE_FREEZE_FUNCTION = "intake_signoff_lines_refuse_an_edit_after_signature"
LINE_FREEZE_TRIGGER = "intake_signoff_lines_are_frozen_once_signed"

# `0A000` is `feature_not_supported`, which is the SQLSTATE `0001` raises for the
# structurally identical refusal on `audit_log` and `0050` raises on `reports`: a
# well-formed statement against a table that does not accept it. A handler that
# already knows the code needs no second one.
REFUSAL_ERRCODE = "0A000"


def _identity_columns() -> tuple[sa.Column[uuid.UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0001::_identity_columns`.

    A `Column` binds to the first `Table` it is added to, so a shared
    module-level tuple would attach every table to the first and fail on the
    second. The heterogeneous tuple return keeps each column's exact type;
    `Column` is INVARIANT in its type parameter, so `list[Column[object]]` is a
    `reportReturnType` error rather than a widening.
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
    """`tenant_id`, `NOT NULL` — see `0001::_tenant_column`."""
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _tenant_primary_key() -> sa.PrimaryKeyConstraint:
    """`PRIMARY KEY (tenant_id, id)` — see `0001::_tenant_primary_key`.

    Five of these six tables carry a tenant-prefixed natural key as well —
    `products.code`, `(client_id, product_id, version)`, `(config_version_id,
    line_key)`, `intake_signoffs.order_id`, `(signoff_id, line_number)` — which
    is exactly the situation `0001`'s note says takes the cross-tenant existence
    oracle from bounded to unbounded. Every one of them leads with `tenant_id`.
    """
    return sa.PrimaryKeyConstraint("tenant_id", "id")


def _tenant_fk(
    *,
    table: str,
    column: str,
    target_table: str,
    ondelete: str | None = None,
    name: str | None = None,
) -> sa.ForeignKeyConstraint:
    """`(tenant_id, <column>) REFERENCES <target_table> (tenant_id, id)`.

    `relations.tenant_fk` restated rather than imported, for the frozen-snapshot
    reason, and naming the constraint itself so the name in this file is the name
    in the catalog. `name` overrides where the generated one exceeds
    PostgreSQL's 63 bytes; the rule for the overflow is `relations.py`'s — DROP
    THE `_<target_table>` SUFFIX AND KEEP THE COLUMNS, because the child column
    already names its target unambiguously.

    A SINGLE-COLUMN FOREIGN KEY TO A TENANT-SCOPED TABLE IS A DEFECT and would
    not even compile: every such table's key is `(tenant_id, id)`, so
    `REFERENCES products (id)` names no key and PostgreSQL rejects it. The
    composite form additionally makes a cross-tenant parent reference
    unwritable, which is structural rather than a policy — it holds inside a
    migration and with row-level security off.
    """
    return sa.ForeignKeyConstraint(
        ["tenant_id", column],
        [f"{target_table}.tenant_id", f"{target_table}.id"],
        ondelete=ondelete,
        name=name or f"fk_{table}_tenant_id_{column}_{target_table}",
    )


def _enum_column(name: str, enum: postgresql.ENUM, *, nullable: bool) -> sa.Column[str]:
    """One enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED — `0003::_enum_column` holds the measurement: `postgresql.ENUM`
    carries no type argument, so the expression infers `Column[Unknown]` and
    `Column[complex]` type-checks as happily as `Column[str]`. Without it,
    `op.create_table` reports `reportUnknownArgumentType`.

    `nullable` is a parameter here where `0003`'s helper hardcoded `NOT NULL`,
    because three of this revision's enum columns are legitimately absent:
    `intake_signoff_lines.answer` (a line nobody has answered),
    `.policy_suggestion` (a line policy has no opinion about) and
    `completeness_gaps.closed_with` (a gap still open). Ruling Q13's honest half
    is precisely that a suggestion and an answer are two columns, so that a
    default cannot be mistaken for a claim.
    """
    return sa.Column(name, enum, nullable=nullable)


def _tenant_predicate(key_column: str) -> str:
    """`0002::_tenant_predicate`, verbatim. Policy text is DDL, not a statement,
    so it cannot take bind parameters; both interpolated values are constants."""
    return f"{key_column} = nullif(current_setting('{TENANT_GUC}', true), '')::uuid"


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, then the policy — `0002::_isolate`, restated.

    `ENABLE` before `FORCE`, because `FORCE` alone is not a thing: it removes the
    owner's exemption from a mechanism that has to be on first. And the owner is
    `titlepipe_owner`, which is who every migration runs as — `ENABLE` without
    `FORCE` leaves every row of every tenant readable to it.

    The policy last, so there is no instant at which the table has RLS on and no
    policy, which denies every row to every non-bypassing role. Issued from the
    same `upgrade()` as the `CREATE TABLE`, which is CONVENTIONS §1.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"CREATE POLICY {POLICY_NAME} ON {table} USING ({_tenant_predicate('tenant_id')})")


def _release(table: str) -> None:
    """The inverse of `_isolate`, in the inverse order — `0002::_release`.

    `NO FORCE` and `DISABLE` are both issued: `relrowsecurity` and
    `relforcerowsecurity` are separate `pg_class` columns and neither clears the
    other. No `IF EXISTS` on the `DROP POLICY` — a policy already gone at
    downgrade time means something removed it, which is an error and not a shrug.
    """
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def _enable_always(table: str, trigger: str) -> None:
    """`ENABLE ALWAYS`, and then read `pg_trigger.tgenabled` back to prove it.

    `'O'` IS NOT A WEAKER `'A'`, IT IS A TRIGGER THAT CAN BE OFF FOR A WHOLE
    SESSION. `0004` establishes the rule and the measurement behind it: a per-role
    `session_replication_role = 'replica'` default is applied at CONNECT and never
    checked again, so a trigger left at the `'O'` (origin) default is silently
    inert for every statement that session runs. A refusal trigger that can be
    turned off is the false-assurance shape CONVENTIONS §9 names — the catalog
    reads clean, the constraint reads enforced, and it is not.

    The read-back is `0004`'s and `0007`'s discipline, for the same reason both
    give: `ALTER TABLE ... ENABLE ALWAYS TRIGGER` succeeds whatever `tgenabled`
    ends up as, and the point of the statement is a catalog VALUE. `'A'` is
    `ENABLE ALWAYS`; `'O'` is the default a silently-ineffective statement leaves.

    Spelled out here rather than imported, for the frozen-snapshot reason every
    other helper in this file is repeated for: a migration is a snapshot of one
    revision, and a shared helper lets a later edit rewrite what this one did.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ALWAYS TRIGGER {trigger}")

    enabled = (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT t.tgenabled FROM pg_trigger t "
                "JOIN pg_class c ON c.oid = t.tgrelid "
                "WHERE c.relname = :table AND t.tgname = :trigger"
            ),
            {"table": table, "trigger": trigger},
        )
        .scalar_one_or_none()
    )
    if enabled != "A":
        raise RuntimeError(
            f"{trigger} on {table} was asked for ENABLE ALWAYS and pg_trigger."
            f"tgenabled reads {enabled!r} rather than 'A'. A trigger left at 'O' "
            f"does not fire for a session whose session_replication_role is "
            f"'replica', which a per-role default can set at CONNECT where no "
            f"in-session privilege check applies (see revision 0004)."
        )


def _create_triggers() -> None:
    """The three machines that a `CHECK` constraint structurally cannot be.

    A `CHECK` sees one row of one table and nothing else. Each of these three has
    to read a DIFFERENT row — the previous value of the column, the parent
    sign-off, the order's gaps — so none of them is expressible as a constraint,
    and each is a trigger for that reason rather than by preference.

    `CREATE FUNCTION`, NOT `CREATE OR REPLACE`, on all three. With `OR
    REPLACE`, a `downgrade()` that forgot a `DROP FUNCTION` would leave the old
    body in place and the next `upgrade` would silently overwrite it — a round
    trip that passes while the schema is not actually being rebuilt. Plain
    `CREATE FUNCTION` turns that omission into `DuplicateFunction` on the second
    upgrade. Do not "tidy" these into `OR REPLACE`.

    **THEY ARE NOT `SECURITY DEFINER`, AND THE READS INSIDE THEM ARE THEREFORE
    RLS-FILTERED.** That is deliberate. Each lookup is keyed on `NEW.tenant_id`,
    which under `0002`'s policy is the caller's own tenant or nothing, so a
    caller cannot use one of these triggers to learn whether another tenant holds
    a matching row. Where a lookup finds nothing, every one of them REFUSES
    rather than permits — see `IF NOT FOUND` below — so an invisible parent is a
    loud failure and never a silent pass.

    **`ENABLE ALWAYS` IS NOT ISSUED, AND THAT IS THE SAME GAP `0050` RECORDS.**
    `0004` promotes `audit_log`'s triggers to `'A'` so a session with
    `session_replication_role = 'replica'` cannot walk past them. These three and
    `0050`'s two want the same promotion; `0004`'s verification helper is keyed
    to `audit_log` by name and generalising it is an edit to another worker's
    revision. Recorded as an unproven residual in the build report. Until then
    these hold against every role this system connects as and not against a
    session that has set that GUC — which is `SUSET`, so not `titlepipe_app`.
    """
    # `S608` IS SUPPRESSED ON THE TWO FUNCTION BODIES BELOW AND NOWHERE ELSE.
    # Ruff sees `SELECT ... FROM ... WHERE` inside an f-string and cannot tell a
    # plpgsql body from a query built out of user input. Every interpolated value
    # in both is a module-level literal defined at the top of this file —
    # `GATE_FUNCTION`, `LINE_FREEZE_FUNCTION`, `REFUSAL_ERRCODE` — and nothing
    # caller-supplied reaches either string; the only runtime values the bodies
    # touch are `NEW.*`, which plpgsql binds and never concatenates into SQL.
    # `minimal_rows.py` suppresses the same rule on the same argument.
    # ---------------------------------------------------------------- freeze
    # An order FREEZES a config version at intake so that a later configuration
    # edit can never reach an in-flight order. Setting it the first time is
    # ordinary; MOVING it changes what an order was searched under, after it was
    # searched, which is the failure the whole version-and-freeze shape exists to
    # prevent.
    #
    # `AFTER UPDATE OF frozen_config_version_id` narrows the trigger to
    # statements that name the column at all; the `WHEN` clause narrows it again
    # to the ones that actually move a value that was already set. Clearing it
    # back to NULL is a MOVE and is refused too — an order that has forgotten
    # which configuration it froze is exactly as unsearchable as one that has
    # been given a new one.
    op.execute(
        f"""
        CREATE FUNCTION {FREEZE_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION USING
                ERRCODE = '{REFUSAL_ERRCODE}',
                MESSAGE = 'orders.frozen_config_version_id is frozen at intake; order '
                          || OLD.id || ' already froze ' || OLD.frozen_config_version_id,
                HINT = 'A configuration edit publishes a NEW version. An in-flight order '
                       || 'keeps the version it froze, or it was searched under one '
                       || 'configuration and reported under another.';
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {FREEZE_TRIGGER}
        AFTER UPDATE OF frozen_config_version_id ON orders
        FOR EACH ROW
        WHEN (OLD.frozen_config_version_id IS NOT NULL
              AND NEW.frozen_config_version_id IS DISTINCT FROM OLD.frozen_config_version_id)
        EXECUTE FUNCTION {FREEZE_FUNCTION}()
        """
    )

    # ------------------------------------------------------------------ gate
    # THE COMPLETENESS GATE, AS A CONSTRAINT RATHER THAN AS A STEP SOME CALLER
    # IS TRUSTED TO RUN. This is the ninth pipeline stage — entirely greenfield —
    # and it is the reason the intake layer was ruled in early: it sits
    # immediately upstream of ~1h51m of GPU per package.
    #
    # **IT COVERS `INSERT` AS WELL AS `UPDATE`, AND THE `INSERT` ARM IS NOT
    # DECORATION.** `models/intake.py` describes it as firing when
    # `extraction_released_at` moves from NULL to non-null, which is the UPDATE
    # path. An `INSERT` naming a non-null `extraction_released_at` reaches the
    # same released state without ever passing through NULL, and would walk past
    # a trigger written only for `UPDATE`. Both arms are one trigger with the
    # predicate in the body rather than two triggers with `WHEN` clauses, because
    # a `WHEN` on an INSERT trigger cannot reference `OLD` at all.
    #
    # `count(*)` and not `EXISTS` for the sign-off leg: the message names how many
    # sign-offs the order has, and "one, unsigned" and "none at all" are different
    # things for whoever reads the refusal.
    op.execute(
        f"""
        CREATE FUNCTION {GATE_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            signed_signoffs integer;
            open_gaps integer;
        BEGIN
            IF NEW.extraction_released_at IS NULL THEN
                RETURN NULL;
            END IF;
            IF TG_OP = 'UPDATE' AND OLD.extraction_released_at IS NOT NULL THEN
                RETURN NULL;
            END IF;

            SELECT count(*) INTO signed_signoffs
              FROM intake_signoffs s
             WHERE s.tenant_id = NEW.tenant_id
               AND s.order_id = NEW.id
               AND s.signed_at IS NOT NULL;

            IF signed_signoffs = 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{REFUSAL_ERRCODE}',
                    MESSAGE = 'order ' || NEW.id || ' cannot release extraction: no signed '
                              || 'intake sign-off',
                    HINT = 'The checklist is a human asserting what will be searched. '
                           || 'Extraction is the most expensive step in the system and '
                           || 'runs against that assertion, not ahead of it.';
            END IF;

            SELECT count(*) INTO open_gaps
              FROM completeness_gaps g
             WHERE g.tenant_id = NEW.tenant_id
               AND g.order_id = NEW.id
               AND g.closed_at IS NULL;

            IF open_gaps > 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{REFUSAL_ERRCODE}',
                    MESSAGE = 'order ' || NEW.id || ' cannot release extraction: '
                              || open_gaps || ' completeness gap(s) still open',
                    HINT = 'A gap is what the sign-off claimed set against what the '
                           || 'package supports. Close each one by recording which '
                           || 'offered option was taken, by whom and when.';
            END IF;

            RETURN NULL;
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {GATE_TRIGGER}
        AFTER INSERT OR UPDATE OF extraction_released_at ON orders
        FOR EACH ROW EXECUTE FUNCTION {GATE_FUNCTION}()
        """
    )

    # ----------------------------------------------------------- line freeze
    # The freeze lives on the CHILD table because that is where the edit would
    # land, and it READS THE PARENT rather than trusting a flag copied onto the
    # child — a copied flag is a second answer that can disagree with the
    # signature itself.
    #
    # `IF NOT FOUND` REFUSES. The composite foreign key guarantees the parent row
    # exists, so the only way this lookup comes back empty is that the row is
    # invisible to the caller — which is a state nobody should be updating a line
    # from. Permitting on "not found" would turn an isolation anomaly into a
    # silently unfrozen checklist.
    op.execute(
        f"""
        CREATE FUNCTION {LINE_FREEZE_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            parent_signed_at timestamptz;
        BEGIN
            SELECT s.signed_at INTO parent_signed_at
              FROM intake_signoffs s
             WHERE s.tenant_id = NEW.tenant_id AND s.id = NEW.signoff_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{REFUSAL_ERRCODE}',
                    MESSAGE = 'intake sign-off ' || NEW.signoff_id || ' is not readable from '
                              || 'this session, so whether its lines are frozen cannot be '
                              || 'established',
                    HINT = 'Establish the tenant before editing a checklist line.';
            END IF;

            IF parent_signed_at IS NOT NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{REFUSAL_ERRCODE}',
                    MESSAGE = 'intake sign-off ' || NEW.signoff_id || ' was signed at '
                              || parent_signed_at || '; its lines are frozen',
                    HINT = 'A signed checklist is a claim somebody is answerable for. '
                           || 'Raise a completeness gap against it rather than editing it.';
            END IF;

            RETURN NULL;
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {LINE_FREEZE_TRIGGER}
        AFTER UPDATE ON intake_signoff_lines
        FOR EACH ROW EXECUTE FUNCTION {LINE_FREEZE_FUNCTION}()
        """
    )

    _enable_always("orders", FREEZE_TRIGGER)
    _enable_always("orders", GATE_TRIGGER)
    _enable_always("intake_signoff_lines", LINE_FREEZE_TRIGGER)


def upgrade() -> None:
    # `checkfirst=False` for `0001`'s and `0003`'s reason: a type that already
    # exists means a previous `downgrade` failed to drop it, and that must be an
    # error rather than a silent reuse of whatever labels the old type carried.
    for enum_type in ENUM_TYPES:
        enum_type.create(op.get_bind(), checkfirst=False)

    op.create_table(
        "products",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        # `period_kind` IS `text` AND NOT AN ENUM. `packages/contract` carries
        # `product` as `z.string().nullable()` and publishes no product
        # vocabulary at all, so closing the set here would be this migration
        # inventing a taxonomy the source of truth has not published. That is the
        # opposite call from the four enums above, and the line is the same one:
        # does an unknown value mean something is broken.
        sa.Column("period_kind", sa.Text(), nullable=False),
        sa.Column("period_years", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("tenant_id", "code", name="uq_products_tenant_id_code"),
        # An `=` between two predicates and not two implications: a
        # `period_kind = 'years'` with no year count derives no period, which is
        # the one thing a product must do, and a year count on a product whose
        # period is not counted in years is a number nothing reads.
        sa.CheckConstraint(
            "(period_kind = 'years') = (period_years IS NOT NULL)",
            name="a_year_period_states_its_years",
        ),
        sa.CheckConstraint(
            "period_years IS NULL OR period_years > 0", name="period_years_is_positive"
        ),
        _tenant_primary_key(),
    )

    op.create_table(
        "client_config_versions",
        *_identity_columns(),
        _tenant_column(),
        # NO FOREIGN KEY, AND IT IS A GAP RATHER THAN A DECISION. `clients` is
        # another worker's table and is not in this branch's chain, so
        # `(tenant_id, client_id) REFERENCES clients (tenant_id, id)` would name
        # a relation that does not exist and the revision would not run. Same
        # situation as `orders.client_id` at `0008`, tracked the same way.
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.Text(), nullable=True),
        # No `ondelete`: a product with configuration written against it must not
        # vanish. `relations.py` states the rule — pass `ondelete` where the
        # domain settles it, and a `RESTRICT`-by-default parent that refuses to
        # disappear under its children is the failure that gets noticed.
        _tenant_fk(table="client_config_versions", column="product_id", target_table="products"),
        sa.UniqueConstraint(
            "tenant_id",
            "client_id",
            "product_id",
            "version",
            name="uq_client_config_versions_one_version_per_client_product",
        ),
        sa.CheckConstraint("version >= 1", name="version_starts_at_one"),
        sa.CheckConstraint(
            "num_nonnulls(published_at, published_by) IN (0, 2)", name="publication_is_whole"
        ),
        # A version nobody published cannot be the current one — otherwise a draft
        # becomes what orders freeze against.
        sa.CheckConstraint(
            "NOT is_current OR published_at IS NOT NULL", name="current_means_published"
        ),
        _tenant_primary_key(),
    )

    # A PARTIAL UNIQUE INDEX, NOT A UNIQUE CONSTRAINT, AND THE DIFFERENCE IS
    # THE WHOLE DESIGN. A plain `UNIQUE (tenant_id, client_id, product_id)` would
    # allow one version per pair and delete the version history that makes an
    # order's frozen reference meaningful. `WHERE is_current` constrains only the
    # live row, so every superseded version stays exactly where it was.
    op.create_index(
        CURRENT_CONFIG_INDEX,
        "client_config_versions",
        ["tenant_id", "client_id", "product_id"],
        unique=True,
        postgresql_where=sa.text("is_current"),
    )

    op.create_table(
        "client_config_lines",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("config_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_key", sa.Text(), nullable=False),
        _enum_column("effect", CONFIG_LINE_EFFECT, nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        # `NOT NULL`, AND IT IS THE WHOLE TABLE. "Every effective line carries
        # its origin — a line with no traceable source is a config defect." That
        # is principle 6 generalised from field values to configuration, and the
        # `NOT NULL` IS the machine: an unciteable line is a write-time
        # constraint violation, not a lint finding and not a review comment.
        sa.Column("origin_ref", sa.Text(), nullable=False),
        # `CASCADE`: a line has no meaning apart from the version that carries it.
        _tenant_fk(
            table="client_config_lines",
            column="config_version_id",
            target_table="client_config_versions",
            ondelete="CASCADE",
            name="fk_client_config_lines_tenant_id_config_version_id",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "config_version_id",
            "line_key",
            name="uq_client_config_lines_tenant_id_config_version_id_line_key",
        ),
        # `waive` removes a baseline line and carries no replacement body; every
        # other effect states what it puts there. An `=` again, so neither half
        # can be relaxed out of sight of the other.
        sa.CheckConstraint("(effect = 'waive') = (body IS NULL)", name="only_a_waiver_has_no_body"),
        _tenant_primary_key(),
    )

    op.create_table(
        "intake_signoffs",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        # `NOT NULL`: a checklist answered under configuration nobody can name is
        # a set of claims with no baseline to judge them against.
        sa.Column("config_version_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signed_by", sa.Text(), nullable=True),
        sa.Column("signed_at", sa.DateTime(timezone=True), nullable=True),
        _tenant_fk(table="intake_signoffs", column="order_id", target_table="orders"),
        _tenant_fk(
            table="intake_signoffs",
            column="config_version_id",
            target_table="client_config_versions",
            name="fk_intake_signoffs_tenant_id_config_version_id",
        ),
        sa.UniqueConstraint("tenant_id", "order_id", name="uq_intake_signoffs_tenant_id_order_id"),
        # THE SIGNATURE IS ONE ACT. Policy prefill never fills these in: a
        # half-signed sign-off is not a state, and the two must stay
        # distinguishable or the screen cannot tell a claim from a default.
        sa.CheckConstraint(
            "num_nonnulls(signed_by, signed_at) IN (0, 2)", name="signature_is_whole"
        ),
        _tenant_primary_key(),
    )

    op.create_table(
        "intake_signoff_lines",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("signoff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("line_key", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("group_label", sa.Text(), nullable=False),
        # `answer` IS NULLABLE AND `policy_suggestion` IS A DIFFERENT COLUMN.
        # Policy may SUGGEST an answer, but the line is not signed until a person
        # answers it. One column holding both would make a default
        # indistinguishable from a claim — the same collapse `na_reason` refuses
        # one subsystem over. `prefilled_from_policy` records that a suggestion
        # was SHOWN, which is a third fact again.
        _enum_column("answer", SIGNOFF_ANSWER, nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("comment_required", sa.Boolean(), nullable=False),
        _enum_column("policy_suggestion", SIGNOFF_ANSWER, nullable=True),
        sa.Column("prefilled_from_policy", sa.Boolean(), nullable=False),
        sa.Column("machine_check", sa.Text(), nullable=True),
        sa.Column("period_scoped", sa.Boolean(), nullable=False),
        _tenant_fk(
            table="intake_signoff_lines",
            column="signoff_id",
            target_table="intake_signoffs",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "signoff_id",
            "line_number",
            name="uq_intake_signoff_lines_tenant_id_signoff_id_line_number",
        ),
        sa.CheckConstraint("line_number >= 1", name="line_number_starts_at_one"),
        # A `NO` CARRIES ITS COMMENT OR IT IS REFUSED, and the reason is a
        # liability one: a NO becomes a disclosure the reviewer must later accept
        # or escalate, and a disclosure nobody wrote a reason for cannot be judged
        # by the person who inherits it. `length(btrim(comment)) > 0` and not `IS
        # NOT NULL`: an empty string satisfies the second and satisfies nobody
        # reading the disclosure. `IS DISTINCT FROM` and not `<>`, so an
        # unanswered line — `answer IS NULL` — is permitted rather than made NULL
        # and therefore not-false and therefore accepted by accident.
        sa.CheckConstraint(
            "answer IS DISTINCT FROM 'NO' OR length(btrim(comment)) > 0", name="a_no_states_why"
        ),
        # NOTHING HERE PINS THE COUNT AT THIRTEEN. The checklist is 13 lines
        # today; a `CHECK (line_number <= 13)` would make the fourteenth line a
        # schema migration, and the number is a product fact carried by the config
        # version this sign-off is frozen against.
        _tenant_primary_key(),
    )

    op.create_table(
        "completeness_gaps",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        _enum_column("kind", GAP_KIND, nullable=False),
        # SERVER-SUPPLIED as a reference rather than matched on label prose,
        # because two lines may share wording across product versions. Nullable:
        # a `period_short` gap is raised against the product's PERIOD, not
        # against a line.
        sa.Column("signoff_line_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("line_label", sa.Text(), nullable=False),
        # BOTH `NOT NULL`, BECAUSE A GAP IS PRECISELY THE PAIR: what was
        # asserted, and what the package shows instead. One without the other is
        # not a gap, it is an opinion.
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=False),
        _enum_column("closed_with", GAP_CLOSE_KIND, nullable=True),
        sa.Column("closed_by", sa.Text(), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_note", sa.Text(), nullable=True),
        _tenant_fk(table="completeness_gaps", column="order_id", target_table="orders"),
        # A COMPOSITE FOREIGN KEY WITH A NULLABLE CHILD COLUMN, AND THAT IS
        # WELL-DEFINED RATHER THAN A LOOPHOLE. PostgreSQL's default is `MATCH
        # SIMPLE`, under which a constraint whose column list contains any NULL is
        # not checked at all — so a `period_short` gap with a null
        # `signoff_line_id` is accepted, and a gap that DOES name a line is
        # checked on both columns and therefore cannot name one in another
        # tenant. `MATCH FULL` would reject the null row outright and is
        # deliberately not used.
        _tenant_fk(
            table="completeness_gaps",
            column="signoff_line_id",
            target_table="intake_signoff_lines",
            name="fk_completeness_gaps_tenant_id_signoff_line_id",
        ),
        sa.CheckConstraint("line_number >= 1", name="line_number_starts_at_one"),
        # Closing a gap is ONE act: which offered option was taken, who took it,
        # and when. A half-recorded closure is a gap that no longer blocks the
        # gate and that nobody signed for.
        sa.CheckConstraint(
            "num_nonnulls(closed_with, closed_by, closed_at) IN (0, 3)", name="closure_is_whole"
        ),
        sa.CheckConstraint(
            "closed_note IS NULL OR closed_at IS NOT NULL", name="a_note_belongs_to_a_closure"
        ),
        # `gate_open` IS NOT A COLUMN. It is derived server-side from these rows;
        # storing it would create a second answer that can disagree with the gaps
        # themselves, and the trigger below reads the ROWS for that reason.
        _tenant_primary_key(),
    )

    for table in TABLES:
        _isolate(table)

    # THE TWO FOREIGN KEYS `0008` DEFERRED, LANDING WITH THE TABLES THEY POINT
    # AT — which is what `0008` said would happen and why it added the COLUMNS
    # without them. `orders` is not an intake table and does not become one: these
    # are dropped by this revision's `downgrade`, and what is left behind is two
    # nullable uuid columns that no constraint references.
    op.create_foreign_key(
        ORDERS_PRODUCT_FK,
        "orders",
        "products",
        ["tenant_id", "product_id"],
        ["tenant_id", "id"],
    )
    op.create_foreign_key(
        ORDERS_CONFIG_VERSION_FK,
        "orders",
        "client_config_versions",
        ["tenant_id", "frozen_config_version_id"],
        ["tenant_id", "id"],
    )

    _create_triggers()

    # RLS is evaluated AFTER the privilege check and never instead of it. Without
    # these the app role gets `42501 permission denied for table products` and an
    # isolation test would read zero rows and call it isolation.
    #
    # ALL SIX GET THE ORDINARY THREE VERBS, INCLUDING THE TWO THAT A TRIGGER
    # PARTLY FREEZES. That is the opposite call from `0050`'s `reports`, and the
    # difference is that `reports` accepts NO update at all while these accept
    # most of them: a checklist line is answered by `UPDATE` before it is signed,
    # and a gap is closed by `UPDATE`. Withholding the verb would refuse the
    # ordinary path in order to also refuse the frozen one.
    for table in TABLES:
        op.execute(f"GRANT SELECT, INSERT, UPDATE ON {table} TO {APP_ROLE}")


def downgrade() -> None:
    """The whole intake layer, removed. THIS IS THE REVERSAL PATH THE OWNER'S
    UNANSWERED QUESTION NEEDS, so it is written to actually work rather than to
    look complete.

    Order matters and is the reverse of `upgrade`: the two foreign keys OFF
    `orders` before the tables they point at are dropped, the triggers before
    their functions, the tables before their enum types. `DROP TABLE` takes
    policies, indexes and constraints with it and does NOT take a type or a
    function, which is why those four lines exist.

    Proved rather than asserted: `upgrade -> downgrade -> upgrade` against
    postgres:18.4 leaves `public` holding nothing but `alembic_version`.
    """
    for table in TABLES:
        op.execute(f"REVOKE SELECT, INSERT, UPDATE ON {table} FROM {APP_ROLE}")

    op.execute(f"DROP TRIGGER {LINE_FREEZE_TRIGGER} ON intake_signoff_lines")
    op.execute(f"DROP TRIGGER {GATE_TRIGGER} ON orders")
    op.execute(f"DROP TRIGGER {FREEZE_TRIGGER} ON orders")
    op.execute(f"DROP FUNCTION {LINE_FREEZE_FUNCTION}()")
    op.execute(f"DROP FUNCTION {GATE_FUNCTION}()")
    op.execute(f"DROP FUNCTION {FREEZE_FUNCTION}()")

    # Before the tables: `orders` outlives this revision and would otherwise keep
    # a constraint naming a relation that is about to stop existing. PostgreSQL
    # would refuse the `DROP TABLE` rather than allow it, which is the loud
    # version of the same fact.
    op.drop_constraint(ORDERS_CONFIG_VERSION_FK, "orders", type_="foreignkey")
    op.drop_constraint(ORDERS_PRODUCT_FK, "orders", type_="foreignkey")

    for table in reversed(TABLES):
        _release(table)

    op.drop_table("completeness_gaps")
    op.drop_table("intake_signoff_lines")
    op.drop_table("intake_signoffs")
    op.drop_table("client_config_lines")
    op.drop_index(CURRENT_CONFIG_INDEX, table_name="client_config_versions")
    op.drop_table("client_config_versions")
    op.drop_table("products")

    # Reverse creation order, which nothing enforces today and which stays correct
    # if a later type ever depends on one of these.
    for enum_type in reversed(ENUM_TYPES):
        enum_type.drop(op.get_bind(), checkfirst=False)

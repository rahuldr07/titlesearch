"""`escalations` — a question that cannot be closed without citing a LIVE rule

Revision ID: 0041
Revises: 0040
Create Date: 2026-09-04

## Assumed parent

`down_revision = "0040"` — this revision's own predecessor in the `0040+` range,
which is the only parent it actually needs to be after. It depends on `orders`
(`0001`) and `rules` (`0003`) and on nothing `0040` creates; the chain tables and
these are independent, and `0040` is named as the parent because a linear range
is what god relinearizes cleanly. Other ranges are in flight in parallel and are
not reconciled here.

---------------------------------------------------------------------------
THE TWO REFUSALS THIS FILE EXISTS TO MOVE OUT OF PROSE.
---------------------------------------------------------------------------
CLAUDE.md states both as product requirements. Until this revision they were held
by the contract's `min(1)` and a required `rule` union, which means they held for
the one client that parses the contract and for nothing else — not for a script,
not for `psql`, not for the FastAPI handler nobody has written yet.

**ONE — AN ESCALATION IS REFUSED WITHOUT A QUESTION.** `question` is `NOT NULL`.
An escalation with no question is a row asking a reviewer to answer nothing, and
there is no absence for it to record: "raised but not yet worded" is not a state
this domain has. Note what is NOT `NOT NULL` beside it — `raised_by` IS nullable,
because the system raises escalations too and inventing an actor for those would
be a provenance claim nobody can cite.

**TWO — A RESOLUTION IS REFUSED WITHOUT A RULE, AND THE RULE MAY NOT BE
`pending`.** These are two different machines because one `CHECK` cannot do both:

* `ck_escalations_resolution_cites_a_rule` — `num_nonnulls(resolution, rule_id,
  resolved_by, resolved_at) IN (0, 4)`. A resolution is FOUR facts: what was
  decided, which rule decides it, who signed, and when. They arrive together or
  the row stays open. Resolving with a null `rule_id` is a write error, not a
  200. The all-or-nothing form is deliberate over four separate `IS NOT NULL`
  implications — it also refuses the reverse half-write, a `rule_id` and a
  signature with no decision, which reads in a list as an open question and in a
  join as a resolved one.

* `escalations_resolution_needs_a_live_rule` — a `BEFORE INSERT OR UPDATE ... FOR
  EACH ROW` trigger. **A `CHECK` CONSTRAINT CANNOT LOOK AT ANOTHER TABLE**, and
  the status being checked lives in `rules`. CLAUDE.md: a PENDING rule cannot
  affect the pipeline until an engineer confirms it. Visibility is not effect —
  `0003`'s ruling deliberately keeps pending rules READABLE by everyone — but
  RESOLVING a question by citing a rule nobody has confirmed is precisely a
  pending rule affecting the pipeline.

  It is a ROW trigger because it needs `NEW`. The zero-row case a statement
  trigger would also catch is not a hazard here: resolving nothing changes
  nothing.

  **AND IT REFUSES `retired` TOO, WHICH IS NOT WHAT "not pending" MEANS.**
  `rule_status` has three labels and only `live` is a rule in force. Writing the
  guard as `<> 'pending'` would let a RETIRED rule — one deliberately withdrawn
  — close a question, which is a worse outcome than the pending case it was
  written to stop, because a retired rule reads as confirmed. The predicate is
  `= 'live'`, positively.

## What a `CHECK` cannot do, and what is therefore honestly not enforced

**"AN ESCALATION NAMES AT LEAST ONE ORDER" IS NOT ENFORCED, AND THIS SAYS SO
RATHER THAN IMPLYING IT IS.** `escalation_orders` is a join table; a row in
`escalations` with no rows in it is a well-formed escalation pointing at nothing.
Closing that needs either a DEFERRED constraint trigger — which fires at COMMIT
and therefore constrains every writer's transaction shape, not just this table —
or an insert path that writes parent and child in one statement. Neither is a
decision this revision can make alone, and a trigger that fired per-statement
would make the two-statement insert impossible. It is listed as an unproven
residual in the build report.

## The join table is a table, and not a `uuid[]` column

`Escalation.order_ids` on the wire is an array. It is NOT an array column here.
`uuid[]` on `escalations` would hold order ids that no foreign key checks, in a
schema whose entire composite-reference convention exists so a child cannot name
a parent in another tenant. An array is exactly the shape that cannot carry that
constraint — there is no `FOREIGN KEY (tenant_id, each element of order_ids)`.

## The evidence surfaces are nullable, and each one is whole or absent

"An escalation raised without evidence is an ordinary state" — so `context`,
`qc_owner`, the excerpt and the identity grid are all nullable. What is NOT
ordinary is a fragment of one:

* the debtor-vs-owner identity grid is four columns with an all-or-nothing check,
  because a grid missing its owner column is a comparison with one side rendered
  as though it had two;
* the excerpt is three columns with the same check, because `SourceExcerpt`'s
  pre/hit/post is a SPLIT AT THE MATCH and two thirds of a split is not an
  excerpt;
* `excerpt_note` needs an `excerpt_hit`, because a note on an excerpt nobody
  typed is a note about nothing.

**THE EXCERPT IS COLUMNS AND NOT `jsonb`, ON PURPOSE.** A `jsonb` blob with no
`CHECK` accepts an array, a string, a number and `null` as readily as the shape
anyone intended — `0001`'s `line_coords` docstring measures exactly that. Three
named `text` columns make the partial state unrepresentable rather than merely
undocumented.

**`age` IS ON THE WIRE AND IS DELIBERATELY NOT A COLUMN.** The contract calls it
"the finished age label ('3h ago', 'settled'); a label, never a timestamp — the
client must not tick". A stored label freezes at write time and is wrong by the
time anyone reads it. `raised_at` is stored; the label is composed per response,
which is the router's layer and not this one's.

## The RLS triple and the grants, in the migration that creates the tables

CONVENTIONS §1, as in `0040`. Both tables are `_TenantRow`s: real `tenant_id`,
`(tenant_id, id)` primary key, `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, a
`tenant_isolation` policy, and `GRANT SELECT, INSERT, UPDATE` to `titlepipe_app`
— RLS is evaluated after the privilege check and never instead of it. `UPDATE` is
what a resolution IS on `escalations`: the row is inserted open and closed in
place.

**THE TRIGGER IS NOT REACHED BY THE GRANT AND DOES NOT NEED TO BE.** A `BEFORE
ROW` trigger runs as part of the statement regardless of the writer's privileges
and regardless of RLS, which is what makes it the right machine for a rule that
must hold for `titlepipe_owner` and for a migration as much as for the app role.
`SECURITY DEFINER` on the function is what lets it READ `rules` — see the
function's own comment.

## `escalation_orders` gets `ondelete="CASCADE"`, and it is the one place it is right

`models/relations.tenant_fk` deliberately defaults `ondelete` to nothing, because
a `CASCADE` typed by habit is a disposal decision the retention taxonomy has not
made. This is not that case: a row in `escalation_orders` is not a record of
anything on its own — it is one entry in the parent's own `order_ids` list — so
it has no meaning to retain once the escalation is gone, and a `RESTRICT` parent
would make an escalation undeletable by its own attribute list. The reference to
`orders` gets NO `ondelete`, because there the parent is a real record.

**WHAT THIS REVISION DOES NOT FIX, AND WHICH IS NOT MINE TO:** as in `0040`,
`tests/test_forced_rls_and_grants.py::EXPECTED_TENANT_TABLES` is compared for
EQUALITY against the catalog derivation, so two more tenant tables take that one
assertion red on its exact-set line while all four per-table properties hold.
Three workers editing one frozenset in parallel is a conflict rather than a fix;
the names are listed in the build report.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0041"
down_revision: str | None = "0040"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"
APP_ROLE = "titlepipe_app"
TENANT_TABLE_GRANTS = "SELECT, INSERT, UPDATE"

# Parent before child; dropped in the reverse.
TABLES = ("escalations", "escalation_orders")

LIVE_RULE_FUNCTION = "escalations_resolution_needs_a_live_rule"
LIVE_RULE_TRIGGER = "trg_escalations_resolution_needs_a_live_rule"

# THE LABEL IS WRITTEN OUT AS A LITERAL AND NOT IMPORTED. `rule_status` is
# `('live', 'pending', 'retired')` and `live` is the only one that is a rule in
# force. A migration is a frozen snapshot; importing `RULE_STATUS_LABELS` from
# the models would let a later edit there silently change what this trigger
# accepts, which is the one thing about this file that must not move.
LIVE_RULE_STATUS = "live"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — see `0040::_identity_columns`.

    A near-copy rather than an import: alembic revision files are loaded by path
    and are not a package, and a migration is a frozen snapshot of one revision.
    The heterogeneous tuple return is load bearing — `Column` is INVARIANT in its
    type parameter, so `Column[UUID]` is not assignable to `Column[object]`.
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


def _tenant_column() -> sa.Column[UUID]:
    """`tenant_id`, `NOT NULL` — see `0040::_tenant_column`.

    `NOT NULL` is what makes the policy total: `tenant_id = <uuid>` is NULL
    rather than true for a NULL row, so a nullable column would permit rows no
    tenant can read, none can delete, and no isolation test can see.
    """
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _tenant_primary_key() -> sa.PrimaryKeyConstraint:
    """`PRIMARY KEY (tenant_id, id)` — see `0040::_tenant_primary_key`.

    Built fresh per table: a shared `PrimaryKeyConstraint` does NOT raise, it
    keeps the name it was given on first bind, and two keys called
    `pk_escalations` in one schema is a migration-time `already exists` with no
    Python-level error anywhere.

    **`escalation_orders` KEEPS THIS KEY RATHER THAN TAKING `(tenant_id,
    escalation_id, order_id)` AS ITS PRIMARY KEY.** The natural key is asserted
    separately, by the unique constraint below. Making it the primary key instead
    would drop this one table below the `(tenant_id, id)` convention the whole
    schema is keyed on — including `seed_insert`'s `RETURNING id` and
    `_parent_expression`'s `ORDER BY id` — for no gain.
    """
    return sa.PrimaryKeyConstraint("tenant_id", "id")


def _tenant_fk(
    column: str, target_table: str, *, ondelete: str | None = None
) -> sa.ForeignKeyConstraint:
    """`(tenant_id, <column>) REFERENCES <target> (tenant_id, id)`.

    The migration-side twin of `models/relations.tenant_fk`. The composite form
    carries a property the short one cannot: a child row CANNOT name a parent in
    another tenant, because `tenant_id` appears on both sides of one constraint.
    Structural, not a policy — it holds for `titlepipe_owner`, inside a
    migration, and with row-level security off.
    """
    return sa.ForeignKeyConstraint(
        ["tenant_id", column],
        [f"{target_table}.tenant_id", f"{target_table}.id"],
        ondelete=ondelete,
    )


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, then the policy — see `0040::_isolate`.

    `CREATE POLICY` last, so there is no instant at which the table is forced
    with no policy: RLS enabled with no policy denies every row to every
    non-bypassing role, which looks like isolation and is the application being
    broken.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {POLICY_NAME} ON {table} "
        f"USING (tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid)"
    )


def _release(table: str) -> None:
    """The reverse of `_isolate`, both halves issued — see `0040::_release`."""
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


def upgrade() -> None:
    # `escalations` — the question, and the four facts that close it.
    op.create_table(
        "escalations",
        *_identity_columns(),
        _tenant_column(),
        # `text` and not an array of field paths: the cluster is one addressable
        # thing the question is ABOUT, and the wire treats it as one string.
        sa.Column("field_path_cluster", sa.Text(), nullable=False),
        # REFUSAL ONE, AS A COLUMN CONSTRAINT: no question, no escalation.
        sa.Column("question", sa.Text(), nullable=False),
        # NULLABLE, and deliberately not symmetric with `resolved_by`: the system
        # raises escalations too, and naming an actor for those would be a
        # provenance claim nobody can cite. A resolution, by contrast, is always
        # somebody's.
        sa.Column("raised_by", sa.Text(), nullable=True),
        sa.Column("raised_at", sa.DateTime(timezone=True), nullable=False),
        # The four facts of a resolution. All nullable INDIVIDUALLY, and bound
        # together by `resolution_cites_a_rule` below — an open escalation has
        # all four null, and there is no state with some of them.
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_by", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("qc_owner", sa.Text(), nullable=True),
        # `SourceExcerpt`'s split at the match, as three named columns rather
        # than a `jsonb` blob that would accept an array or a number as readily.
        sa.Column("excerpt_pre", sa.Text(), nullable=True),
        sa.Column("excerpt_hit", sa.Text(), nullable=True),
        sa.Column("excerpt_post", sa.Text(), nullable=True),
        sa.Column("excerpt_note", sa.Text(), nullable=True),
        # The debtor-vs-owner identity grid: two labelled sides of one
        # comparison.
        sa.Column("identity_debtor_label", sa.Text(), nullable=True),
        sa.Column("identity_debtor", sa.Text(), nullable=True),
        sa.Column("identity_owner_label", sa.Text(), nullable=True),
        sa.Column("identity_owner", sa.Text(), nullable=True),
        _tenant_primary_key(),
        # SINGLE-COLUMN, AND CORRECT: `rules` is GLOBAL, so `rules (id)` is
        # its whole primary key and there is no tenant column to pair with. See
        # `0040`'s docstring, and `0003`'s for the ruling.
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"]),
        # REFUSAL TWO, HALF ONE. Four facts, together or not at all.
        sa.CheckConstraint(
            "num_nonnulls(resolution, rule_id, resolved_by, resolved_at) IN (0, 4)",
            name="resolution_cites_a_rule",
        ),
        sa.CheckConstraint(
            "num_nonnulls(identity_debtor_label, identity_debtor, "
            "identity_owner_label, identity_owner) IN (0, 4)",
            name="identity_grid_is_whole",
        ),
        sa.CheckConstraint(
            "num_nonnulls(excerpt_pre, excerpt_hit, excerpt_post) IN (0, 3)",
            name="excerpt_is_whole",
        ),
        sa.CheckConstraint(
            "excerpt_note IS NULL OR excerpt_hit IS NOT NULL",
            name="excerpt_note_needs_an_excerpt",
        ),
    )

    # `escalation_orders` — the parent's `order_ids`, as a table.
    op.create_table(
        "escalation_orders",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("escalation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        _tenant_primary_key(),
        # CASCADE here and nowhere else in this file: this row is one entry in
        # the parent's own attribute list and has no meaning to retain once the
        # parent is gone. See the module docstring.
        _tenant_fk("escalation_id", "escalations", ondelete="CASCADE"),
        # No `ondelete`: `orders` is a real record, and its disposal is the
        # retention taxonomy's business rather than this file's.
        _tenant_fk("order_id", "orders"),
        # The natural key, tenant-prefixed. Without it one escalation can name
        # the same order twice and the wire array comes out with a duplicate.
        sa.UniqueConstraint(
            "tenant_id",
            "escalation_id",
            "order_id",
            name="uq_escalation_orders_tenant_id_escalation_id_order_id",
        ),
    )

    # REFUSAL TWO, HALF TWO: THE RULE CITED MUST BE LIVE.
    # A `CHECK` cannot read another table, so this is a trigger. It is `BEFORE`
    # rather than `AFTER` so the row never lands at all, and `FOR EACH ROW`
    # because it needs `NEW`.
    #
    # `SECURITY DEFINER` is what lets the function read `rules`: it runs as
    # `titlepipe_owner`, so the guard cannot be defeated by a caller who lacks
    # `SELECT` on the rulebook, and it does not depend on `0003`'s grant staying
    # as it is. `search_path` is pinned on the function for the reason every
    # `SECURITY DEFINER` function pins it — an unqualified `rules` would
    # otherwise resolve against the CALLER's `search_path`, and a temp table
    # called `rules` would then decide what this trigger accepts.
    #
    # The `NEW.rule_id IS NULL` arm returns early rather than raising: an OPEN
    # escalation is the ordinary row, and `resolution_cites_a_rule` is what
    # decides whether a null `rule_id` is legal. Two machines, one question each.
    #
    # `S608` IS SUPPRESSED ON THE FUNCTION BODY, AND WHAT MAKES IT SAFE IS
    # CHECKABLE RATHER THAN ASSERTED: the only interpolations in this f-string
    # are `LIVE_RULE_FUNCTION` and `LIVE_RULE_STATUS`, both module-level literals
    # defined above. Nothing caller-supplied reaches the string — a migration has
    # no caller — and the `SELECT ... FROM rules` the rule fires on is a fixed
    # statement inside plpgsql, where `NEW.rule_id` is a variable reference and
    # not text substitution.
    op.execute(f"""
        CREATE FUNCTION {LIVE_RULE_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = pg_catalog, public
        AS $$
        DECLARE
            cited_status text;
        BEGIN
            IF NEW.rule_id IS NULL THEN
                RETURN NEW;
            END IF;

            SELECT status::text INTO cited_status FROM rules WHERE id = NEW.rule_id;

            -- A rule id the foreign key has not checked yet. Constraint triggers
            -- fire AFTER this one, so this arm is reachable, and it must not
            -- pass silently: a NULL status compares false below and would give
            -- the same message for a missing rule as for a pending one.
            IF cited_status IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = 'foreign_key_violation',
                    MESSAGE = 'this escalation cites rule '
                        || NEW.rule_id::text || ', which does not exist',
                    HINT = 'A resolution names a rule from the rulebook.';
            END IF;

            -- POSITIVELY 'live', not `<> ''pending''`. rule_status has three
            -- labels; a RETIRED rule is one deliberately withdrawn, and letting
            -- it close a question is worse than the pending case this guard was
            -- written for, because a retired rule reads as confirmed.
            IF cited_status <> '{LIVE_RULE_STATUS}' THEN
                RAISE EXCEPTION USING
                    ERRCODE = 'check_violation',
                    MESSAGE = 'this escalation cannot be resolved by rule '
                        || NEW.rule_id::text || ', whose status is '
                        || cited_status || '; only a live rule may close a question',
                    HINT = 'A PENDING rule cannot affect the pipeline until an '
                        || 'engineer confirms it, and a RETIRED one has been '
                        || 'withdrawn. Confirm the rule, or cite another.';
            END IF;

            RETURN NEW;
        END;
        $$
    """)

    # `INSERT OR UPDATE` and not `INSERT` alone: a resolution is an UPDATE on a
    # row inserted open, which is the path that matters most here.
    op.execute(f"""
        CREATE TRIGGER {LIVE_RULE_TRIGGER}
        BEFORE INSERT OR UPDATE ON escalations
        FOR EACH ROW EXECUTE FUNCTION {LIVE_RULE_FUNCTION}()
    """)
    _enable_always("escalations", LIVE_RULE_TRIGGER)

    # THE RLS TRIPLE AND THE GRANTS, IN THE SAME REVISION AS THE `CREATE`.
    # Neither implies the other: a perfect policy with no grant is `42501`, and a
    # grant with no policy is every tenant's rows.
    for table in TABLES:
        _isolate(table)
        op.execute(f"GRANT {TENANT_TABLE_GRANTS} ON {table} TO {APP_ROLE}")


def downgrade() -> None:
    """A real one. `pass` here is a defect, and a round trip is what proves it.

    The trigger before its function, because `DROP FUNCTION` on a function a
    trigger still names fails — and the ordering is written out rather than left
    to `CASCADE`, which would also drop anything else that came to depend on it.
    """
    for table in reversed(TABLES):
        op.execute(f"REVOKE {TENANT_TABLE_GRANTS} ON {table} FROM {APP_ROLE}")
        _release(table)

    op.execute(f"DROP TRIGGER {LIVE_RULE_TRIGGER} ON escalations")
    op.execute(f"DROP FUNCTION {LIVE_RULE_FUNCTION}()")

    for table in reversed(TABLES):
        op.drop_table(table)

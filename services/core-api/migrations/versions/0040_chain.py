"""`instruments`, the DERIVED `chain_links` over them, and the human stop

Revision ID: 0040
Revises: 0032
Create Date: 2026-09-04

LINEARIZED AT INTEGRATION, 2026-09-05: `down_revision` was `0008` — the head as this file's
author found it, per CONVENTIONS §8 — and is now `0032`. `0032` is the head after Meenakshi's range. `instruments` and `chain_links` reference
`orders` (`0001`, columns from `0008`) and `documents` (`0030`) — both are behind this
point in the linear chain, which `0008` alone would not have guaranteed.
The prose below is the author's and describes the branch as written; this line is the read of
the chain that `alembic upgrade head` actually walks.

## Assumed parent

`down_revision = "0008"` is the head as found on this branch (`0001` -> `0002`
-> `0003` -> `0004` -> `0008`). Three workers are writing the remaining domain
migrations in parallel in reserved number ranges — this file is the first of the
`0040+` range — so the parent stated here is the one that was true when it was
written, not a claim about the integrated chain. god relinearizes; this file must
not be rebased onto another worker's chain by hand.

Nothing in this revision depends on any table, type or function created between
`0004` and `0040` by anybody. It needs `orders` (`0001`) and `rules` (`0003`),
and it creates everything else it touches — with one stated exception, below.

---------------------------------------------------------------------------
WHAT THIS REVISION DEFERRED, AND WHAT CLOSED IT: `instruments.document_id`'s
   FOREIGN KEY.
---------------------------------------------------------------------------
`models/chain.py` declares `tenant_fk(column="document_id",
target_table="documents")`. When this file was written, `documents` was another
worker's module in the same fan-out and did not exist in this chain, so the
constraint could not be created here — `relation "documents" does not exist`
would have taken the whole run down, including the two tables after it. The
column was added anyway, for the trade `0008` measured on `orders.product_id`: a
missing FOREIGN KEY is one diff on a drift check that was red anyway while 23
tables were still landing, and a missing COLUMN breaks the mapper outright.

**IT IS NO LONGER DEFERRED.** On the linearized chain this revision's parent is
`0032`, so `0030_create_documents` is behind it and the constraint is created
below with the same `_tenant_fk` helper every other reference in this file uses —
in the `create_table` that creates the column, which is where CONVENTIONS §1
wants it. The alternative, a follow-up revision holding one `create_foreign_key`,
would have left the table and its reference in two places for no gain now that
the ordering is settled. `alembic check` was the machine that reported the gap:
`Detected added foreign key (tenant_id, document_id)(tenant_id, id) on table
instruments`, meaning the model declared it and the database did not have it.

## Why `instruments` is a table at all, and separate from `documents`

67 of 101 pages in the one real corpus package are name-search / index output
rather than instruments. Those pages NAME judgments and liens that are frequently
NOT in the package as paper. A `document` is a span of paper a partitioner drew a
boundary around; an `instrument` is a thing of record the search found, which may
have arrived as a document or only as a line in an index. `document_id` is
NULLABLE and that null IS the distinction — collapsing the tables would force
every index-only judgment to invent a page range it does not have.

## The chain is DERIVED, and the schema says so in a column

`chain_links.provenance` is the contract's `RuleProvenance`, and
`ck_chain_links_ruled_links_cite_a_rule` is the machine for CLAUDE.md's "never
emit a value you cannot cite": a link tagged `RULED` with a null `rule_id` is a
write error. The other three tags are honest about citing nothing — `DERIVED` is
the system's own inference, `CONFLICT` is two readings held open, `OPEN` says the
derivation policy does not exist yet — and none may borrow the authority of a
rule it does not name.

**`chain_links.rule_id` IS A SINGLE-COLUMN FOREIGN KEY AND THAT IS NOT THE DEFECT
CONVENTIONS §1 DESCRIBES.** The ban is on single-column references to
TENANT-SCOPED tables, where the short form both fails to name the composite key
and reopens the cross-tenant existence oracle. `rules` is GLOBAL — `0003`'s
module docstring is the frozen record of that ruling — so `rules (id)` IS its
whole primary key and there is no tenant column to pair with. `(tenant_id,
rule_id)` would not type-check against that key at all.

## `chain_root_assertions` is a human, not a rule

Old R17's arm's-length chain terminator is a rule the ENGINE APPLIES. This table
is a REVIEWER saying "the root of title is reached", overriding computed depth.
Fusing them would make a reviewer's judgment indistinguishable from an engine's
inference in exactly the place where the distinction decides liability. `reason`
is `NOT NULL` for the reason `fields.correction_reason` is checked: an assertion
that overrides a computed answer is the one place where "why" is the only thing
auditable afterwards.

**THE PARTIAL UNIQUE INDEX IS CREATED HERE, NOT IN `0007`.**
`models/chain.py` said `0007`'s, and that was never possible: `0007` is Kaveri's
and an index cannot precede the table it is on, which is this revision's.
`uq_chain_root_assertions_one_standing_per_order` is `UNIQUE (tenant_id,
order_id) WHERE retracted_at IS NULL`. PARTIAL and not plain, because a plain one
makes retraction-and-reassertion impossible; the partial one keeps the history
and still refuses two live assertions. The model docstring is corrected in the
same commit, and the index is declared in `__table_args__` so `alembic check` has
something to compare against — an index in the catalog that the metadata does not
declare reads to autogenerate as an index to DROP.

## Both enum types are created and dropped explicitly

`DROP TABLE` does not drop a type. A `downgrade()` that only drops the tables
leaves `judgment_status` and `rule_provenance` behind, and the NEXT `upgrade`
dies on `type "judgment_status" already exists` — a fresh database migrates fine,
so only a round trip finds it. `0001` and `0003` both state this; it is stated
again rather than cross-referenced only, because the two `.drop()` lines at the
bottom of this file are the ones a later editor deletes as redundant.

**THE LABELS ARE REPEATED HERE RATHER THAN IMPORTED FROM
`titlepipe_core.db.models.enums`**, exactly as `0001` and `0003` repeat theirs: a
migration is a frozen snapshot of one revision, and an import would let a later
edit to the model silently rewrite what `0040` claims to have created. The two
copies are kept honest via the live catalog, not by comparing sources — see
`0003`'s docstring for which leg of that catches which mutation.

## The RLS triple and the grants, in the migration that creates the tables

CONVENTIONS §1. All three tables here are `_TenantRow`s, so all three get a real
`tenant_id`, a `(tenant_id, id)` primary key, `ENABLE` **and** `FORCE ROW LEVEL
SECURITY`, and a `tenant_isolation` policy — in this file, not in a follow-up.
`ENABLE` alone exempts the table's owner, which is `titlepipe_owner`, which is
who every migration runs as.

**AND THE GRANTS, WHICH ARE NOT IMPLIED BY THE POLICY.** RLS is evaluated AFTER
the privilege check and never instead of it: without `GRANT`, `titlepipe_app`
gets `42501 permission denied for table chain_links` and a read test reports zero
rows and calls it isolation. Three verbs, matching `0002`'s tenant tables:
`SELECT, INSERT, UPDATE`. No `DELETE`, no `TRUNCATE` — the contract is three
verbs, and a `GRANT ALL` satisfies every positive assertion in
`tests/test_forced_rls_and_grants.py` while handing the app role the ability to
erase a tenant's chain. `titlepipe_worker` is named nowhere, as in `0002`.

`UPDATE` is on all three deliberately and not by copy: a chain is RE-DERIVED as
documents arrive, and `chain_root_assertions` is retracted in place — its
`retracted_at`/`retracted_by` pair is an `UPDATE` and nothing else.

**WHAT THIS REVISION DOES NOT FIX, AND WHICH IS NOT MINE TO:**
`tests/test_forced_rls_and_grants.py::EXPECTED_TENANT_TABLES` is a six-element
frozenset compared for EQUALITY against the catalog derivation. Three new tenant
tables land here and that assertion goes red on the exact-set line, not on any of
the four per-table properties, which all hold. Three workers adding to one
frozenset literal in parallel is a conflict for the integrator rather than a fix;
the names to add are listed in the build report.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0040"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# EXACTLY THESE LABELS, IN EXACTLY THIS ORDER. `JudgmentStatus` at
# `packages/contract/src/enums.ts:82-89`, `RuleProvenance` at `:66`. Repeated
# here rather than imported, for the reason the module docstring gives.
# `enumsortorder` is what `<`, `ORDER BY` and `MIN()` on these types use, so the
# order is the server's business and not only ours.
#
# `unknown` is a REAL DETERMINATION about a judgment and routes to review (old
# R13). It is never a placeholder for "not looked at" — that is what the NULL in
# `instruments.judgment_status` is for, on the instruments that are not judgments
# at all.
JUDGMENT_STATUS_LABELS = ("active", "satisfied", "released", "canceled", "vacated", "unknown")
RULE_PROVENANCE_LABELS = ("RULED", "DERIVED", "OPEN", "CONFLICT")

JUDGMENT_STATUS_TYPE_NAME = "judgment_status"
RULE_PROVENANCE_TYPE_NAME = "rule_provenance"

# `create_type=False` so `op.create_table` does not emit a second `CREATE TYPE`
# as a side effect of the column. Each type is created and dropped by its own
# explicit statement below, which is the only way either gets a `DROP` at all.
JUDGMENT_STATUS = postgresql.ENUM(
    *JUDGMENT_STATUS_LABELS, name=JUDGMENT_STATUS_TYPE_NAME, create_type=False
)
RULE_PROVENANCE = postgresql.ENUM(
    *RULE_PROVENANCE_LABELS, name=RULE_PROVENANCE_TYPE_NAME, create_type=False
)

# `0002`'s three constants, repeated for the frozen-snapshot reason. The policy
# NAME is what `tests/test_forced_rls_and_grants.py` looks for by literal, and
# the GUC is what the predicate reads.
POLICY_NAME = "tenant_isolation"
TENANT_GUC = "app.current_tenant"
APP_ROLE = "titlepipe_app"
TENANT_TABLE_GRANTS = "SELECT, INSERT, UPDATE"

# Parents before children, which is also the create order: `chain_links`
# references `instruments`, and `chain_root_assertions` references `chain_links`.
# Dropped in the reverse.
TABLES = ("instruments", "chain_links", "chain_root_assertions")

STANDING_ASSERTION_INDEX = "uq_chain_root_assertions_one_standing_per_order"


def _identity_columns() -> tuple[sa.Column[UUID], sa.Column[datetime]]:
    """`id` and `created_at`, built fresh — a near-copy of `0001`'s.

    Deliberately not an import from `0001`: a migration is a frozen snapshot, and
    `0040` would otherwise be rewritten by an edit to a landed revision. Alembic
    revision files are loaded by path and are not a package; importing across
    them is not a supported seam.

    The heterogeneous tuple return is `0001`'s and is load bearing rather than
    stylistic — `Column` is INVARIANT in its type parameter, so `Column[UUID]` is
    not assignable to `Column[object]` and pyright reports `reportReturnType` for
    the honest-looking `list[Column[object]]`.

    Built fresh PER TABLE and never shared: a `Column` added to a second `Table`
    raises, which is the loud half; the `PrimaryKeyConstraint` below is the quiet
    half and is the reason both are functions.
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
    """`tenant_id`, `NOT NULL`, the leading column of every tenant table's key.

    `NOT NULL` is what makes the policy below TOTAL. `tenant_id = <uuid>` is NULL
    rather than true for a NULL row, so a nullable column would permit rows no
    tenant can read, none can delete, and no isolation test can see. The
    composite key enforces the same thing a second time; the explicit flag stays
    so that dropping the column from the key cannot silently relax it.
    """
    return sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False)


def _tenant_primary_key() -> sa.PrimaryKeyConstraint:
    """`PRIMARY KEY (tenant_id, id)`, NOT `PRIMARY KEY (id)`.

    Unique enforcement runs BEFORE a policy's `WITH CHECK`, so under `ENABLE` +
    `FORCE ROW LEVEL SECURITY` a single-column `id` key answers "does this id
    exist in some other tenant?" to a caller who can neither read nor count the
    row. RLS cannot deny it; the constraint fires first. `0001::_tenant_primary
    _key` holds the measurement against postgres:18.4.

    It also tenant-prefixes the backing index, which is what an RLS-filtered scan
    wants: every index this key backs leads with the column the policy tests.

    Built fresh per table. A `PrimaryKeyConstraint` shared between two tables
    does NOT raise — it keeps the name it was given on first bind, and two
    primary keys called `pk_instruments` in one schema is a `relation already
    exists` at migration time with no Python-level error anywhere.
    """
    return sa.PrimaryKeyConstraint("tenant_id", "id")


def _tenant_fk(
    column: str, target_table: str, *, ondelete: str | None = None
) -> sa.ForeignKeyConstraint:
    """`(tenant_id, <column>) REFERENCES <target> (tenant_id, id)`.

    The migration-side twin of `models/relations.tenant_fk`, repeated here for
    the frozen-snapshot reason and kept structurally identical so the two emit
    the same constraint under the same naming convention.

    THE COMPOSITE FORM IS NOT COSMETIC. `REFERENCES orders (id)` does not name
    a key at all once the primary key is `(tenant_id, id)` — PostgreSQL rejects
    it — and the tempting fix, a unique index on `id` alone, reopens on the
    PARENT the existence oracle the composite key closed on the child. The
    composite form also carries a property the short form cannot: a child row
    CANNOT name a parent in another tenant, because `tenant_id` appears on both
    sides of one constraint. That is structural, not a policy — it holds for
    `titlepipe_owner`, inside a migration, and with row-level security off.

    `ondelete` is not defaulted. Retention and disposal are `record_class` and
    `legal_holds`' business; a `CASCADE` typed here by habit would be this file
    quietly making a disposal decision the taxonomy has not made.
    """
    return sa.ForeignKeyConstraint(
        ["tenant_id", column],
        [f"{target_table}.tenant_id", f"{target_table}.id"],
        ondelete=ondelete,
    )


def _enum_column(name: str, enum: postgresql.ENUM, *, nullable: bool) -> sa.Column[str]:
    """One enum column, annotated `Column[str]` for pyright's benefit.

    THE ANNOTATION IS AN ASSERTION BY THE AUTHOR, NOT A NARROWING THE CHECKER
    VERIFIED, and `0001::_na_reason_column` holds the measurement:
    `postgresql.ENUM` carries no type argument in SQLAlchemy's annotations, so
    the expression infers `Column[Unknown]` and `Column[complex]` type-checks
    exactly as happily as `Column[str]`. What makes `str` the right one is that
    the identical column spelled with the generic `sa.Enum` infers `Column[str]`,
    and that these columns hold one of a fixed set of label strings and nothing
    else. Without it, `op.create_table` reports `reportUnknownArgumentType` —
    MEASURED on this file, two errors, one per enum column.

    `nullable` IS A PARAMETER HERE AND IS HARDCODED `False` IN `0003`'s
    NEAR-TWIN, because the two enum columns in this revision differ on exactly
    that and the difference is domain, not style. `chain_links.provenance` is
    `NOT NULL`: a link with no provenance tag is a link with no answer to "may
    this be emitted", and there is no fifth state for that.
    `instruments.judgment_status` is NULLABLE: an instrument that is not a
    judgment has no enforceability state, and `unknown` is a REAL determination
    that routes to review rather than a stand-in for "not a judgment".
    """
    return sa.Column(name, enum, nullable=nullable)


def _isolate(table: str) -> None:
    """`ENABLE`, `FORCE`, then the policy — `0002::_isolate` for a new table.

    `CREATE POLICY` LAST so that there is no instant, even inside this
    transaction, at which the table is forced with no policy: RLS enabled with no
    policy denies every row to every non-bypassing role, which is not isolation,
    it is the application being broken.

    The predicate is `nullif(current_setting(..., true), '')::uuid` and the
    `nullif` is load bearing: `current_setting` answers NULL for a GUC never set
    and `''` for one set and reverted, and `''::uuid` RAISES `invalid input
    syntax for type uuid: ""`. Without the `nullif` an unestablished session gets
    a 500 where a clean denial belongs.
    """
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {POLICY_NAME} ON {table} "
        f"USING (tenant_id = nullif(current_setting('{TENANT_GUC}', true), '')::uuid)"
    )


def _release(table: str) -> None:
    """The reverse of `_isolate`, both halves issued.

    No `IF EXISTS` on the `DROP POLICY`: a policy already gone at downgrade time
    means something else removed it, and that must be an error rather than a
    silent success.

    `DISABLE ROW LEVEL SECURITY` alone leaves `relforcerowsecurity = true` behind
    on a table with no RLS, which the catalog reports and which reads as a
    half-reverted state to whatever looks next.
    """
    op.execute(f"DROP POLICY {POLICY_NAME} ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")


def upgrade() -> None:
    # `checkfirst=False` for `0001`'s reason: a type that already exists here
    # means a previous `downgrade` failed to drop it, and that must be an error
    # rather than a silent reuse of whatever labels the old type happened to
    # carry.
    JUDGMENT_STATUS.create(op.get_bind(), checkfirst=False)
    RULE_PROVENANCE.create(op.get_bind(), checkfirst=False)

    # `instruments` — a thing of record, which may or may not have arrived as
    # paper.
    op.create_table(
        "instruments",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        # NULLABLE, AND THE NULL IS THE POINT: an instrument known only from
        # an index line has no paper in the package. The column is nullable and
        # its composite FOREIGN KEY is real — a null names no document, and a
        # non-null one names a document in this tenant or the write fails.
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("label", sa.Text(), nullable=False),
        # `Text` and not an enum: the instrument vocabulary is
        # jurisdiction-specific, and closing it globally makes the first Georgia
        # `FIFA` a write error rather than a row.
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("recorded_ref", sa.Text(), nullable=True),
        sa.Column("recorded_on", sa.Date(), nullable=True),
        # NULL on an instrument that is not a judgment: a deed has no
        # enforceability state, and `unknown` there would be a determination
        # nobody made.
        _enum_column("judgment_status", JUDGMENT_STATUS, nullable=True),
        _tenant_primary_key(),
        _tenant_fk("order_id", "orders"),
        # Deferred when this file was written because `documents` was not in the
        # chain; created here on the integrated chain, where `0030` is behind
        # this revision. See the module docstring.
        _tenant_fk("document_id", "documents"),
        # A recording DATE with no recording REFERENCE is a date attributed to a
        # record nobody can look up — the shape principle 6 refuses. The converse
        # is ordinary: an index line often names book and page and no date.
        sa.CheckConstraint(
            "recorded_on IS NULL OR recorded_ref IS NOT NULL",
            name="a_recording_date_names_its_record",
        ),
    )

    # `chain_links` — the DERIVED chain, each step carrying how it was derived.
    op.create_table(
        "chain_links",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instrument_id", postgresql.UUID(as_uuid=True), nullable=False),
        # NULL on the first link. The self-reference exists so a link STATES
        # which step it follows, rather than leaving that to be recomputed from
        # ordinals a later insertion could renumber.
        sa.Column("prior_link_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        _enum_column("provenance", RULE_PROVENANCE, nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("derived_at", sa.DateTime(timezone=True), nullable=False),
        _tenant_primary_key(),
        _tenant_fk("order_id", "orders"),
        _tenant_fk("instrument_id", "instruments"),
        _tenant_fk("prior_link_id", "chain_links"),
        # SINGLE-COLUMN, AND CORRECT. `rules` is GLOBAL — `rules (id)` is its
        # whole primary key and there is no tenant column to pair with. See the
        # module docstring, and `0003`'s for the ruling itself.
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"]),
        sa.UniqueConstraint(
            "tenant_id", "order_id", "ordinal", name="uq_chain_links_tenant_id_order_id_ordinal"
        ),
        sa.CheckConstraint("ordinal >= 1", name="ordinal_starts_at_one"),
        # THE MACHINE FOR "NEVER EMIT A VALUE YOU CANNOT CITE". A link tagged
        # `RULED` with a null `rule_id` is a write error. `DERIVED`, `OPEN` and
        # `CONFLICT` are honest about citing nothing and are left free.
        sa.CheckConstraint(
            "provenance <> 'RULED' OR rule_id IS NOT NULL",
            name="ruled_links_cite_a_rule",
        ),
        # A link cannot follow itself. Cheap, and it turns one class of
        # derivation bug into a write error instead of an infinite walk in
        # whatever later reads the chain.
        sa.CheckConstraint(
            "prior_link_id IS NULL OR prior_link_id <> id",
            name="no_link_follows_itself",
        ),
    )

    # `chain_root_assertions` — a reviewer saying stop, which is not a rule.
    op.create_table(
        "chain_root_assertions",
        *_identity_columns(),
        _tenant_column(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        # NULL where the reviewer asserts the root is reached without naming the
        # link that reaches it — an ordinary state on a chain the engine could
        # not derive at all.
        sa.Column("chain_link_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("asserted_by", sa.Text(), nullable=False),
        sa.Column("asserted_at", sa.DateTime(timezone=True), nullable=False),
        # `NOT NULL`. This row overrides a computed answer, and "why" is the
        # only thing auditable about it afterwards.
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("retracted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retracted_by", sa.Text(), nullable=True),
        _tenant_primary_key(),
        _tenant_fk("order_id", "orders"),
        _tenant_fk("chain_link_id", "chain_links"),
        # Two columns, so 0 (standing) and 2 (retracted, and attributed) are the
        # honest states. 1 is the half-write a hand-rolled `UPDATE ... SET
        # retracted_at = now()` produces, and it is exactly the shape that makes
        # a retraction nobody can attribute.
        sa.CheckConstraint(
            "num_nonnulls(retracted_at, retracted_by) IN (0, 2)",
            name="retraction_is_whole",
        ),
    )

    # ONE STANDING ASSERTION PER ORDER, AND PARTIAL RATHER THAN PLAIN.
    # `UNIQUE (tenant_id, order_id)` outright would make retraction-and-
    # reassertion impossible — the retracted row keeps occupying the key. The
    # `WHERE retracted_at IS NULL` predicate keeps the whole history and still
    # refuses two LIVE assertions on one order.
    #
    # Tenant-prefixed for `_tenant_primary_key`'s reason: unique enforcement runs
    # before the policy, so `UNIQUE (order_id)` alone would answer "does another
    # tenant hold a standing assertion on this order?" to a caller who can read
    # neither.
    #
    # Named explicitly. The `uq` naming convention covers `UniqueConstraint`, not
    # `Index`, so an unnamed partial index gets whatever PostgreSQL invents and a
    # later `drop_index` has to guess.
    op.create_index(
        STANDING_ASSERTION_INDEX,
        "chain_root_assertions",
        ["tenant_id", "order_id"],
        unique=True,
        postgresql_where=sa.text("retracted_at IS NULL"),
    )

    # THE RLS TRIPLE AND THE GRANTS, IN THE SAME REVISION AS THE `CREATE`.
    # CONVENTIONS §1. `_isolate` is not implied by the grant and the grant is not
    # implied by `_isolate`: RLS runs AFTER the privilege check, never instead of
    # it, so a table with a perfect policy and no grant is `42501 permission
    # denied` and a table with a grant and no policy is every tenant's rows.
    for table in TABLES:
        _isolate(table)
        op.execute(f"GRANT {TENANT_TABLE_GRANTS} ON {table} TO {APP_ROLE}")


def downgrade() -> None:
    """A real one. `pass` here is a defect, and a round trip is what proves it.

    Reverse order throughout: grants and policies before the tables they are on,
    children before parents, and the two types LAST because `DROP TABLE` does not
    drop a type and a type still in use cannot be dropped.
    """
    # The REVOKE before the DROP is theatre in isolation — `DROP TABLE` takes the
    # ACL with it — and is kept because `0002` states the rule it follows: a
    # revoke reaches only the rows where `titlepipe_owner` is the grantor, so
    # writing it out means that the day these tables stop being dropped here, the
    # grants are still reversed.
    for table in reversed(TABLES):
        op.execute(f"REVOKE {TENANT_TABLE_GRANTS} ON {table} FROM {APP_ROLE}")
        _release(table)

    # Explicit, for the reason it was named explicitly above: `drop_table` would
    # take it, but the day this index outlives these tables the drop is written.
    op.drop_index(STANDING_ASSERTION_INDEX, table_name="chain_root_assertions")

    for table in reversed(TABLES):
        op.drop_table(table)

    # WITHOUT THESE TWO LINES A FRESH UPGRADE STILL WORKS AND ONLY THE SECOND
    # ONE — the one after a downgrade — fails, with `type "rule_provenance"
    # already exists`. Dropped in the reverse of creation order, which nothing
    # enforces today and which stays correct when a later revision adds a type
    # depending on one of these.
    RULE_PROVENANCE.drop(op.get_bind(), checkfirst=False)
    JUDGMENT_STATUS.drop(op.get_bind(), checkfirst=False)

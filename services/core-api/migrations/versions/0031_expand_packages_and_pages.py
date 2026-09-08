"""`packages` and `pages` get the domain columns, and the two machines the model
docstrings already name

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-04

---------------------------------------------------------------------------
AN `ALTER`, NOT A `CREATE`, SO THE RLS TRIPLE IS DELIBERATELY ABSENT.
---------------------------------------------------------------------------
`0001::upgrade` creates `packages` and `pages` with three columns each and
`0002::_isolate` puts `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` and
the `tenant_isolation` policy on both. CONVENTIONS §1 requires those three in the
migration that CREATES the table, and that migration is `0001`, not this one.
Re-issuing `CREATE POLICY tenant_isolation ON packages` here fails with `already
exists`; re-issuing `ENABLE` is a no-op that reads like a guarantee this file
provides and does not. `0008` states the same case for `orders`, and `0030` —
which really does create a table — is what the other half looks like.

**THE MACHINE THAT CHECKS I DID NOT NEED TO:** the RLS coverage assertion that
runs inside the migration transaction reads `pg_class.relrowsecurity`,
`relforcerowsecurity` and `pg_policy` for every table carrying a `tenant_id`
column, and rolls the whole run back if any of the three is missing. Both tables
are in its population whether or not this revision touches their policies.

---------------------------------------------------------------------------
`packages.py`'s DOCSTRINGS NAME `0005` FOR TWO MACHINES, AND `0005` IS NOT
   THAT REVISION. THEY LAND HERE.
---------------------------------------------------------------------------
`models/packages.py` says, twice, that migration `0005` carries the
`packages_identity_is_immutable` trigger and the
`uq_packages_one_accepted_per_order` partial unique index. Revision `0005` on
`agent/worker-38-kaveri` is `record_class_taxonomy`; `0006` is `legal_holds` and
`0007` is the audit writer. **Neither machine exists in any revision on any
branch** — the numbers were assumed when the models were written and the range
was allocated to someone else.

That is CONVENTIONS §9's characteristic failure in its exact shape: a docstring
naming a control that is not there. Both are implemented below, and the two
docstrings in `models/packages.py` are corrected to point here in the same
commit, because a comment that cites the wrong revision is the same defect one
indirection further out.

## Assumed parent

`down_revision = "0030"` chains to this worker's own previous revision, which is
the only parent this file genuinely depends on — `0030` creates `documents`, and
nothing here touches it, so even that dependency is bookkeeping rather than
substance. The real requirement is `0001` (the two tables) and `0008` (`orders`,
for the composite foreign key below). Kaveri's `0005`-`0007` and Bobbili's
`0020+` are on branches this one has never seen; god relinearizes.

## `NOT NULL` with no server default, and a guard that can actually see

`order_id`, `sha256`, `byte_size`, `status` and `received_at` on `packages`, and
`package_id` and `page_no` on `pages`, are `NOT NULL` and get no
`server_default`. There is no honest default for a digest, a byte count or an
arrival time, and CONVENTIONS §4 forbids inventing one to satisfy a `NOT NULL`.
So this revision refuses to run against a populated table, and says which of the
two situations it is rather than leaving PostgreSQL's one-column message to read
like a defect in the DDL.

**AND THE OBVIOUS SPELLING OF THAT GUARD IS VACUOUS — see
`_refuse_if_populated`.** `SELECT count(*)` issued by the role a migration runs
as returns 0 on a `FORCE ROW LEVEL SECURITY` table no matter how many rows it
holds. MEASURED 2026-09-04 against postgres:18.4 on this schema, one row inserted
into `packages` as the container superuser:

    SET ROLE titlepipe_owner;  SELECT count(*) FROM packages;   ->  0
    RESET ROLE;                SELECT count(*) FROM packages;   ->  1

A guard written that way passes on every database, including the one it exists to
refuse.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# `55000` is `object_not_in_prerequisite_state`: the schema change is well-formed,
# the database is simply not in a state where it can be applied. `0008` raises the
# same condition for the same class of refusal.
NOT_IN_PREREQUISITE_STATE = "55000"

# `0A000` is `feature_not_supported`, which is what `0001`'s append-only trigger
# raises for "this table does not accept that". An identity change is the same
# kind of refusal: not a bad value, an operation the table does not offer.
FEATURE_NOT_SUPPORTED = "0A000"

# The labels, repeated verbatim from `models/enums.py` rather than imported. A
# migration is a frozen snapshot of a schema at one revision, and importing the
# constant would let a later edit there silently rewrite what this file claims to
# have created. `tests/test_schema_migration.py` reading the live `pg_enum` is
# what keeps the two copies honest — `alembic check` does not compare enum labels
# at all, so a fifth label or a reordering leaves it green.
#
# Four states because the domain needs exactly four distinctions: a package that
# has arrived, one held back on the optical/quarantine check, the ONE that drives
# extraction, and one displaced by a re-upload. No catch-all member (CONVENTIONS
# §4).
PACKAGE_STATUS_LABELS = ("received", "quarantined", "accepted", "superseded")

# What a PAGE is, not what an INSTRUMENT is, and the distinction is the reason
# this enum can be closed at all: 67 of 101 pages in the one real corpus package
# are name-search / index output rather than instruments. INSTRUMENT type stays
# `text` everywhere in this schema (`documents.kind`, `instruments.kind`) because
# instrument vocabulary is jurisdiction-specific and closing it globally would
# make the first Georgia package a write error on correct data.
#
# A page nobody has classified yet is NULL, not `unknown`: "not yet looked at" is
# a pipeline state and this column answers "what is it".
PAGE_KIND_LABELS = ("instrument", "index_search", "exhibit")

PACKAGE_STATUS = postgresql.ENUM(*PACKAGE_STATUS_LABELS, name="package_status", create_type=False)
PAGE_KIND = postgresql.ENUM(*PAGE_KIND_LABELS, name="page_kind", create_type=False)

IMMUTABILITY_FUNCTION = "titlepipe_packages_identity_is_immutable"
IMMUTABILITY_TRIGGER = "packages_identity_is_immutable"
ACCEPTED_PACKAGE_INDEX = "uq_packages_one_accepted_per_order"


def _refuse_if_populated(table: str, columns: Sequence[str]) -> None:
    """Refuse, by name, before adding a `NOT NULL` column with no default.

    ---------------------------------------------------------------------------
    THE `NO FORCE` DANCE IS NOT DEFENSIVE PROGRAMMING. WITHOUT IT THIS
       FUNCTION READS 0 ON EVERY DATABASE AND REFUSES NOTHING.
    ---------------------------------------------------------------------------
    `0002` puts `FORCE ROW LEVEL SECURITY` on both tables, and `FORCE` is
    precisely the clause that removes the table owner's exemption. `env.py`
    connects as `titlepipe_migration` and `SET ROLE`s to `titlepipe_owner`, so
    every row of `packages` is invisible to this statement and the count comes
    back 0 whatever the table holds — the module docstring carries the
    measurement. A guard that cannot fail is worse than no guard: it is a line a
    reviewer counts as cover.

    `ALTER TABLE ... NO FORCE` is the escape hatch `0002`'s header identifies as
    the correct one, and identifies BECAUSE it is a privilege rather than a
    setting: only the owner may issue it, where any role can `SET` a custom GUC.
    It is DDL, so it is inside the migration's transaction and rolls back with
    everything else; and it takes `ACCESS EXCLUSIVE`, so there is no window
    during which another session sees unfiltered rows.

    `FORCE` is restored on the line after the read rather than in a `finally`.
    There is no path between them that raises and leaves the table unforced: a
    failure anywhere in this revision aborts the transaction, and the `ALTER` is
    transactional DDL that goes back with it.
    """
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    # `sa.table` rather than an f-string into `sa.text`: the identifier is quoted
    # by the compiler and ruff's S608 does not have to be argued with.
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


def _create_identity_trigger() -> None:
    """`packages.sha256`, `byte_size` and `tenant_id` cannot be changed by an UPDATE.

    ---------------------------------------------------------------------------
    WHY A TABLE-LEVEL MACHINE AND NOT A HANDLER CHECK.
    ---------------------------------------------------------------------------
    `sha256` IS the package's identity. The engine-output spine keys on
    `(package_digest, page_no, render_params, engine_id, engine_version,
    config_digest)`, so the digest is simultaneously the dedupe key and the
    idempotency key, and every stored read cites it. If the bytes behind a digest
    could change, a read taken yesterday cites a digest that no longer describes
    what was read, a re-run neither hits the existing rows nor can prove it did
    not, and the audit question "why does the report say this" stops being
    answerable. That is not a bug a migration fixes later; it is the property the
    whole content-addressing design rests on.

    **`FOR EACH ROW`, WHICH IS THE OPPOSITE OF `audit_log`'s CHOICE AND FOR THE
    OPPOSITE REASON.** `audit_log_append_only` refuses EVERY update, including the
    zero-row ones RLS produces, so it cannot be a row trigger — a row trigger
    never fires when no row is visible. This one refuses only a CHANGE, which
    needs `OLD` and `NEW`, so it must be. The consequence is stated rather than
    hidden: an `UPDATE packages SET sha256 = ...` that matches no visible row
    passes silently here, because there is no row whose identity changed. That is
    correct — nothing was rewritten — and it is why this trigger is not, and does
    not claim to be, a control on the statement.

    **`ENABLE ALWAYS`**, for `0004`'s reason. An ordinary trigger does not fire
    under `session_replication_role = 'replica'`, and that setting can be planted
    as a PER-ROLE DEFAULT by whoever can `ALTER ROLE` — applied at connect and
    never re-checked, so the connecting role needs no privilege at all. `ENABLE
    ALWAYS` is unconditional at the table and needs no other file to have done
    anything. `roles.sql` converging `pg_db_role_setting` is the other half; this
    does not depend on it.

    `IS DISTINCT FROM` and not `<>`: `tenant_id` and `sha256` are `NOT NULL`
    today, but `<>` answers NULL rather than true for a null operand, so a
    nullable column added to this list later would silently stop being covered.

    `CREATE FUNCTION`, not `CREATE OR REPLACE`, for `0001`'s reason: with `OR
    REPLACE` a `downgrade()` that forgot its `DROP FUNCTION` would leave the old
    body in place and the next `upgrade` would silently overwrite it. Plain
    `CREATE FUNCTION` turns that omission into `DuplicateFunction` on the second
    upgrade instead of a round trip that passes while the schema is not being
    rebuilt.

    `BEFORE`, so nothing is written before the refusal. `RETURN NEW` on the
    permitted path and never `RETURN NULL`: a `BEFORE` trigger returning NULL
    silently suppresses the statement, which is indistinguishable from success at
    the client.
    """
    op.execute(
        f"""
        CREATE FUNCTION {IMMUTABILITY_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.sha256 IS DISTINCT FROM OLD.sha256
               OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
               OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
            THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{FEATURE_NOT_SUPPORTED}',
                    MESSAGE = 'a package''s identity is immutable; sha256, byte_size '
                              'and tenant_id cannot be changed after ingest',
                    HINT = 'Ingest the new bytes as a new package and supersede this one; '
                           'every stored engine read cites the digest as it was.';
            END IF;
            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(
        f"""
        CREATE TRIGGER {IMMUTABILITY_TRIGGER}
        BEFORE UPDATE ON packages
        FOR EACH ROW EXECUTE FUNCTION {IMMUTABILITY_FUNCTION}()
        """
    )
    op.execute(f"ALTER TABLE packages ENABLE ALWAYS TRIGGER {IMMUTABILITY_TRIGGER}")


def upgrade() -> None:
    _refuse_if_populated("packages", ("order_id", "sha256", "byte_size", "status", "received_at"))
    _refuse_if_populated("pages", ("package_id", "page_no"))

    # `checkfirst=False`: a type that already exists here means a previous
    # `downgrade` failed to drop it, and that must be an error rather than a
    # silent reuse of whatever labels the old type happened to have. `DROP TABLE`
    # does not drop a type, which is why every enum in this repository is created
    # as its own statement with its own line in `downgrade()`.
    PACKAGE_STATUS.create(op.get_bind(), checkfirst=False)
    PAGE_KIND.create(op.get_bind(), checkfirst=False)

    # -- packages ----------------------------------------------------------
    op.add_column("packages", sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False))
    op.add_column("packages", sa.Column("sha256", sa.Text(), nullable=False))
    # `BigInteger`: a county search package of several hundred megabytes is
    # ordinary, and a signed 32-bit column tops out at 2 GB. The width is cheap
    # now and an `ALTER TYPE` rewrite later.
    op.add_column("packages", sa.Column("byte_size", sa.BigInteger(), nullable=False))
    # NULL on a package nothing could open. `0` would assert that somebody
    # counted (CONVENTIONS §4).
    op.add_column("packages", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("packages", sa.Column("status", PACKAGE_STATUS, nullable=False))
    op.add_column("packages", sa.Column("quarantine_note", sa.Text(), nullable=True))
    op.add_column("packages", sa.Column("received_at", sa.DateTime(timezone=True), nullable=False))
    op.add_column("packages", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key(
        None,
        "packages",
        "orders",
        ["tenant_id", "order_id"],
        ["tenant_id", "id"],
    )

    # NOT UNIQUE ON `(tenant_id, sha256)`. Two orders over the same county
    # genuinely share a package's bytes, and that sharing is load-bearing — "a
    # read is a property of the document, not of who asked" — so the digest may
    # repeat across orders and the sharing happens through the DIGEST at the
    # engine-read layer. What this refuses is the same bytes twice on ONE order.
    op.create_unique_constraint(
        "uq_packages_tenant_id_order_id_sha256", "packages", ["tenant_id", "order_id", "sha256"]
    )

    # 64 lowercase hex characters or it is not a SHA-256, and a digest that is not
    # one is an identity that will never match a read. Refused at write rather
    # than discovered when a re-run duplicates a package.
    op.create_check_constraint("sha256_is_lowercase_hex", "packages", "sha256 ~ '^[0-9a-f]{64}$'")
    op.create_check_constraint("byte_size_is_positive", "packages", "byte_size > 0")
    op.create_check_constraint(
        "page_count_is_positive", "packages", "page_count IS NULL OR page_count > 0"
    )
    op.create_check_constraint(
        "accepted_records_when", "packages", "status <> 'accepted' OR accepted_at IS NOT NULL"
    )
    # A quarantined package says why. The optical/quarantine check is the one real
    # thing behind the word "exception", so its note is the record of the finding.
    op.create_check_constraint(
        "quarantine_states_why",
        "packages",
        "status <> 'quarantined' OR quarantine_note IS NOT NULL",
    )

    # EXACTLY ONE ACCEPTED PACKAGE PER ORDER, AND IT IS AN INDEX RATHER THAN A
    # CHECK BECAUSE A CHECK SEES ONE ROW. A second acceptance is a unique
    # violation at write time, which is what makes `accepted` a state rather than
    # a boolean worth having. A partial index and not a plain one: `received`,
    # `quarantined` and `superseded` may repeat freely on one order, and a total
    # unique key over `(tenant_id, order_id, status)` would wrongly refuse the
    # second `received` package a re-upload produces.
    #
    # Declared on the model as well (`models/packages.py`), because `alembic
    # check` compares indexes and an index the catalog has and the metadata does
    # not is drift at every revision from here on.
    op.create_index(
        ACCEPTED_PACKAGE_INDEX,
        "packages",
        ["tenant_id", "order_id"],
        unique=True,
        postgresql_where=sa.text("status = 'accepted'"),
    )

    _create_identity_trigger()

    # -- pages -------------------------------------------------------------
    op.add_column("pages", sa.Column("package_id", postgresql.UUID(as_uuid=True), nullable=False))
    op.add_column("pages", sa.Column("page_no", sa.Integer(), nullable=False))
    # The PDF page's own dimensions, as a PAIR. The three coordinate spaces stay
    # separable only if this is recorded: a box normalised against a raster whose
    # aspect nobody stored is a citation that cannot be checked. `Numeric(10, 3)`
    # and not a float — a point size is compared for equality when a re-render is
    # matched against a stored read, and binary floating point makes that unsound.
    op.add_column("pages", sa.Column("width_pt", sa.Numeric(10, 3), nullable=True))
    op.add_column("pages", sa.Column("height_pt", sa.Numeric(10, 3), nullable=True))
    op.add_column("pages", sa.Column("rotation_deg", sa.Integer(), nullable=True))
    op.add_column("pages", sa.Column("text_char_count", sa.Integer(), nullable=True))
    # ALL THREE CLASSIFICATION COLUMNS ARE NULLABLE, AND NULL MEANS "NOT YET
    # CLASSIFIED" RATHER THAN "NO". A boolean defaulted to `false` would make an
    # unclassified page indistinguishable from one the classifier looked at and
    # rejected — the same collapse `na_reason` exists to prevent, arriving here as
    # a boolean instead of an enum. Hence no `server_default` on any of them.
    op.add_column("pages", sa.Column("page_kind", PAGE_KIND, nullable=True))
    op.add_column("pages", sa.Column("is_relevant", sa.Boolean(), nullable=True))
    # A QUALITY FLAG AND NOT A SKIP: 34 of 101 pages in the one real corpus
    # package are degraded, so treating the flag as an exclusion would discard a
    # third of the evidence. Nothing in the schema can enforce that reading; it is
    # recorded as an unproven residual.
    op.add_column("pages", sa.Column("is_degraded", sa.Boolean(), nullable=True))
    # A REFERENCE, never bytes. A page raster cannot be sanitised — a substitution
    # cannot reach into a PNG — it can only be WITHHELD, and holding a reference
    # is what leaves withholding a decision the serving layer can make. Nothing
    # here enforces that either.
    op.add_column("pages", sa.Column("raster_uri", sa.Text(), nullable=True))

    op.create_foreign_key(
        None,
        "pages",
        "packages",
        ["tenant_id", "package_id"],
        ["tenant_id", "id"],
    )

    # Tenant-prefixed, per CONVENTIONS §2, and `pages`' page index is the natural
    # key `base._TenantRow` warns about by name: unique enforcement runs BEFORE a
    # policy's `WITH CHECK`, so `(package_id, page_no)` alone would answer a
    # cross-tenant existence question to a caller who can read no row.
    op.create_unique_constraint(
        "uq_pages_tenant_id_package_id_page_no", "pages", ["tenant_id", "package_id", "page_no"]
    )

    op.create_check_constraint("page_no_starts_at_one", "pages", "page_no >= 1")
    # 0 or 2, never 1. A width with no height is half a coordinate space, and it
    # is exactly what a hand-rolled partial update produces.
    op.create_check_constraint(
        "page_size_is_a_pair", "pages", "num_nonnulls(width_pt, height_pt) IN (0, 2)"
    )
    op.create_check_constraint(
        "rotation_is_a_quarter_turn",
        "pages",
        "rotation_deg IS NULL OR rotation_deg IN (0, 90, 180, 270)",
    )
    op.create_check_constraint(
        "text_char_count_is_not_negative",
        "pages",
        "text_char_count IS NULL OR text_char_count >= 0",
    )


def downgrade() -> None:
    """Reverse of `upgrade`, in reverse order, with `0008`'s two naming spellings.

    A CHECK CONSTRAINT IS DROPPED BY ITS SHORT NAME AND A UNIQUE CONSTRAINT BY
    ITS FULL ONE, IN THE SAME FILE. `NAMING_CONVENTION["ck"]` is
    `ck_%(table_name)s_%(constraint_name)s`, and a convention containing
    `%(constraint_name)s` WRAPS whatever name it is given — on the drop as well as
    on the create, so passing the rendered name yields `constraint
    "ck_pages_ck_pages_page_no_starts_at_one" does not exist`. The `uq` pattern
    names no `%(constraint_name)s`, so its explicit name is used verbatim. Same
    file, two spellings, because SQLAlchemy genuinely treats the two patterns
    differently. `0008`'s downgrade measured this.

    The FUNCTION needs its own `DROP`. `DROP TRIGGER` does not remove it and
    neither would `DROP TABLE` — it belongs to the schema, not to the table.
    """
    for name in (
        "text_char_count_is_not_negative",
        "rotation_is_a_quarter_turn",
        "page_size_is_a_pair",
        "page_no_starts_at_one",
    ):
        op.drop_constraint(name, "pages", type_="check")
    op.drop_constraint("uq_pages_tenant_id_package_id_page_no", "pages", type_="unique")
    op.drop_constraint("fk_pages_tenant_id_package_id_packages", "pages", type_="foreignkey")
    for column in (
        "raster_uri",
        "is_degraded",
        "is_relevant",
        "page_kind",
        "text_char_count",
        "rotation_deg",
        "height_pt",
        "width_pt",
        "page_no",
        "package_id",
    ):
        op.drop_column("pages", column)

    op.execute(f"DROP TRIGGER {IMMUTABILITY_TRIGGER} ON packages")
    op.execute(f"DROP FUNCTION {IMMUTABILITY_FUNCTION}()")
    op.drop_index(ACCEPTED_PACKAGE_INDEX, table_name="packages")
    for name in (
        "quarantine_states_why",
        "accepted_records_when",
        "page_count_is_positive",
        "byte_size_is_positive",
        "sha256_is_lowercase_hex",
    ):
        op.drop_constraint(name, "packages", type_="check")
    op.drop_constraint("uq_packages_tenant_id_order_id_sha256", "packages", type_="unique")
    op.drop_constraint("fk_packages_tenant_id_order_id_orders", "packages", type_="foreignkey")
    for column in (
        "accepted_at",
        "received_at",
        "quarantine_note",
        "status",
        "page_count",
        "byte_size",
        "sha256",
        "order_id",
    ):
        op.drop_column("packages", column)

    # After the columns that use them, and as explicit statements: `DROP TABLE`
    # does not drop a type, and a type left behind kills the next `upgrade` with
    # `type "package_status" already exists` — a failure only a round trip finds.
    PAGE_KIND.drop(op.get_bind(), checkfirst=False)
    PACKAGE_STATUS.drop(op.get_bind(), checkfirst=False)

"""THE THREE GUARDS `test_forced_rls_and_grants.py` STRUCTURALLY CANNOT PROVIDE.

That file is thorough about WHO holds WHICH VERB on WHICH TABLE. It is silent
about three adjacent surfaces, and each silence is a way a real change ships
green:

1. **column-level ACLs are never read.** `_table_grantees` explodes
   `pg_class.relacl` only. `GRANT UPDATE (tenant_id) ON pages TO titlepipe_blind`
   writes `pg_attribute.attacl` and leaves `relacl` byte-identical, so every
   assertion in that file passes. `has_table_privilege` cannot see it either —
   it is `has_column_privilege`'s question.

2. **the app's MUTATED column set is never bounded.** `GRANT UPDATE` is
   table-wide, so the ACL cannot narrow it; the only thing that can is the
   ORM's target list. A `Column(..., onupdate=...)` or `server_onupdate=...`, or
   a `__mapper_args__["version_id_col"]`, silently WIDENS every UPDATE statement
   SQLAlchemy emits — the widened column is not in any handler's diff and is not
   in any test's expectation, and the first place it shows up is a row whose
   `created_at` moved or whose `tenant_id` was rewritten under an RLS
   `WITH CHECK` that `0002` does not write.

3. **the ACL is asserted per (table, verb), never as a CLOSED SET.** Everything
   in the other file is a loop over tables it expects. A grant on an object
   OUTSIDE that loop — a routine (`proacl`), a type, a NEW table added by a
   later revision and not yet in `EXPECTED_TENANT_TABLES`, a DEFAULT privilege
   (`pg_default_acl`) that silently grants on every future table — is invisible.
   `pg_default_acl` is the sharpest of those: one `ALTER DEFAULT PRIVILEGES ...
   GRANT ALL ON TABLES TO titlepipe_blind` makes every subsequent revision's
   tables fully open, and NOTHING in this repository reads that catalog.

🔴 THESE ARE WRITTEN TO FAIL FIRST WHERE THEY SHOULD. They are not adjusted to
whatever the tree happens to do — see CLAUDE.md, "a failing test may be correct
behavior". Where a test is green at head that is the measurement recorded in its
docstring, and the value of the test is the day it stops being.

Same database seam as `test_forced_rls_and_grants.py`: the module-scoped
`migrated_database` fixture. Nothing here is skipped.
"""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import Engine, text

from titlepipe_core.db import models

# The roles `roles.sql` creates. Written out rather than imported, for the reason
# `test_forced_rls_and_grants.py` gives at `EXPECTED_TENANT_TABLES`.
OWNER_ROLE = "titlepipe_owner"
APP_ROLE = "titlepipe_app"
WORKER_ROLE = "titlepipe_worker"
BLIND_ROLE = "titlepipe_blind"
MIGRATION_ROLE = "titlepipe_migration"

NON_OWNER_ROLES = frozenset({APP_ROLE, WORKER_ROLE, BLIND_ROLE, MIGRATION_ROLE})


# ---------------------------------------------------------------------------
# (i) THE UPDATE TARGET LIST, ASSERTED IN THE ORM AND NOT IN THE CATALOG
# ---------------------------------------------------------------------------
def test_no_mapped_column_carries_onupdate_and_no_mapper_declares_version_id_col() -> None:
    """The ORM may never widen an UPDATE beyond the columns a caller named.

    `GRANT UPDATE` in `0002` is TABLE-WIDE — PostgreSQL's table-level grant
    carries every column, and the migration writes no column list. So the ACL
    cannot bound the update surface at all, and the ONLY thing that bounds it is
    what SQLAlchemy puts in the SET clause.

    Three mechanisms add columns to that clause without any call site asking:

    * `Column(..., onupdate=...)` — a client-side default evaluated on every
      UPDATE that touches the table, appended to the target list
      (`sqlalchemy/sql/crud.py:1473`);
    * `Column(..., server_onupdate=...)` — the same, with a RETURNING/fetch
      (`crud.py:1497`);
    * `__mapper_args__["version_id_col"]` — adds the version column to SET and a
      comparison to WHERE on every flush.

    Each is invisible in a handler's diff and each writes a column no test
    expects. `created_at` is the one that matters most here: it carries a
    `server_default` today (`db/models.py:188`), and a `server_default` is
    INSERT-only and therefore fine. An `onupdate` on the same column would make
    every edit rewrite the row's creation time, and `test_forced_rls_and_grants`
    would stay green because the verb and the grantee did not change.

    MEASURED at head: no mapped column declares any of the three, so this passes.
    It exists for the revision that adds one.
    """
    offences: list[str] = []

    for mapper in models.Base.registry.mappers:
        entity = mapper.class_.__name__

        version_col = mapper.version_id_col
        if version_col is not None:
            offences.append(
                f"{entity} declares version_id_col={version_col!r}, which puts that "
                f"column in the SET clause and in the WHERE clause of every flush"
            )

        for column in mapper.columns:
            if column.onupdate is not None:
                offences.append(
                    f"{entity}.{column.key} declares onupdate=, so every UPDATE "
                    f"touching this table also writes {column.key}"
                )
            if column.server_onupdate is not None:
                offences.append(
                    f"{entity}.{column.key} declares server_onupdate=, so every "
                    f"UPDATE touching this table also writes {column.key}"
                )

    assert offences == [], (
        "the ORM widens the UPDATE target list beyond what callers name, and "
        "0002's GRANT UPDATE is table-wide so no ACL bounds it:\n  " + "\n  ".join(offences)
    )


# ---------------------------------------------------------------------------
# (ii) THE GRANTED COLUMN SET vs THE APP'S MUTATED COLUMN SET
# ---------------------------------------------------------------------------
def test_no_column_level_grant_exists_anywhere_in_public(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 `pg_attribute.attacl` IS READ BY NOTHING IN THIS REPOSITORY.

    `test_forced_rls_and_grants.py::_table_grantees` explodes `pg_class.relacl`
    (that file, ~line 547) and `_table_privileges` calls `has_table_privilege`
    (~line 490). NEITHER can see a column grant:

    * `relacl` is untouched by `GRANT UPDATE (tenant_id) ON pages TO
      titlepipe_blind` — the privilege lands in `pg_attribute.attacl` for that
      one column;
    * `has_table_privilege` answers about the TABLE. It returns FALSE for a role
      holding only a column grant, so the "worker holds nothing" loop
      (~line 1473) stays green while the worker can rewrite `tenant_id`.

    That combination is the whole exploit: `tenant_id` is the column every
    `tenant_isolation` policy keys on, `0002` writes no `WITH CHECK` (so the
    read predicate is reused), and a role that can re-tenant a row can then read
    it. The stray column grant is the smallest change that achieves it and the
    only one no current assertion looks at.

    THE ASSERTION IS "NONE ANYWHERE", not "none for these roles on these
    columns". The contract is table-level grants only, so the correct expected
    value is the empty set, and a new column grant of any shape has to be
    deliberately excepted here rather than quietly permitted.

    The granted column set is thus EMPTY, and the app's mutated column set is
    bounded separately by the test above (the ORM never widens a target list) —
    together those two are "the granted column set equals the app's mutated
    column set" in the only form the two catalogs can express it while `0002`
    grants at table granularity.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            column_acls = connection.execute(
                text(
                    "SELECT c.relname, a.attname, x.privilege_type, "
                    "       CASE WHEN x.grantee = 0 THEN 'PUBLIC' "
                    "            ELSE x.grantee::regrole::text END "
                    "FROM pg_attribute a "
                    "JOIN pg_class c ON c.oid = a.attrelid "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace, "
                    "     aclexplode(a.attacl) AS x "
                    "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                    "  AND a.attacl IS NOT NULL AND NOT a.attisdropped"
                )
            ).all()
    finally:
        engine.dispose()

    found = sorted(f"{row[2]} on {row[0]}.{row[1]} to {row[3]}" for row in column_acls)
    assert found == [], (
        "column-level grants exist, and NOTHING else in this suite reads "
        "pg_attribute.attacl — relacl is unchanged by them and "
        "has_table_privilege reports FALSE for a role holding one:\n  " + "\n  ".join(found)
    )


def test_no_default_privilege_grants_on_objects_a_later_revision_creates(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """`pg_default_acl` is the grant that applies to tables that do not exist yet.

    One `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
    titlepipe_blind`, run as `titlepipe_owner`, gives every table any FUTURE
    revision creates a full ACL for that role. Every assertion in
    `test_forced_rls_and_grants.py` is a loop over the tables it already knows,
    so at the moment the default privilege is added, nothing changes and nothing
    fails; the breach arrives with the next migration, and the test that would
    have named it is the one that never ran.

    Expected value is the empty set for the same reason as the column ACLs: the
    contract is explicit per-table grants written in a reviewable revision line.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            defaults = connection.execute(
                text(
                    "SELECT coalesce(n.nspname, '<all schemas>'), d.defaclobjtype, "
                    "       x.privilege_type, "
                    "       CASE WHEN x.grantee = 0 THEN 'PUBLIC' "
                    "            ELSE x.grantee::regrole::text END, "
                    "       d.defaclrole::regrole::text "
                    "FROM pg_default_acl d "
                    "LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace, "
                    "     aclexplode(d.defaclacl) AS x"
                )
            ).all()
    finally:
        engine.dispose()

    found = sorted(
        f"{row[2]} on future {row[1]!r} in {row[0]} to {row[3]} (by {row[4]})" for row in defaults
    )
    assert found == [], (
        "default privileges exist, so objects created by revisions that are not "
        "written yet will carry grants no test in this repository asserts:\n  " + "\n  ".join(found)
    )


# ---------------------------------------------------------------------------
# (iii) EXACT-ACL CONVERGENCE
# ---------------------------------------------------------------------------
# Every non-owner ACL entry the schema is allowed to hold, as
# `<objkind>:<object>:<verb>:<grantee>`. Owner entries are OMITTED from the
# comparison and asserted structurally instead — `acldefault` gives the owner
# everything, that is ownership rather than a grant, and pinning it would make
# this literal a transcription of PostgreSQL's defaults rather than of this
# system's decisions.
#
# 🔴 THIS IS THE ONLY CLOSED-WORLD ASSERTION ABOUT PRIVILEGE IN THIS REPOSITORY.
# It is a whole-catalog snapshot: relations, columns, schemas, routines and
# default privileges in one set. Anything granted anywhere that is not on this
# list fails, INCLUDING on objects no test knows the name of.
EXACT_NON_OWNER_ACL = frozenset(
    {
        # `0002`: SELECT/INSERT/UPDATE to the app on the six tenant tables and
        # the registry, minus UPDATE on the append-only `audit_log`.
        *(
            f"relation:{table}:{verb}:{APP_ROLE}"
            for table in (
                "orders",
                "packages",
                "pages",
                "fields",
                "field_readings",
                "tenants",
            )
            for verb in ("SELECT", "INSERT", "UPDATE")
        ),
        f"relation:audit_log:SELECT:{APP_ROLE}",
        f"relation:audit_log:INSERT:{APP_ROLE}",
        # `0003`: the rulebook is read-only to the app.
        f"relation:rules:SELECT:{APP_ROLE}",
        # `roles.sql` (~line 284): `GRANT USAGE ON SCHEMA public TO
        # titlepipe_owner, titlepipe_app, titlepipe_worker`. The owner's entry is
        # dropped by the owner filter below; the other two are here. THE WORKER
        # HOLDS SCHEMA USAGE AND NO OBJECT PRIVILEGE AT ALL — that is `roles.sql`'s
        # decision and it is inert on its own (USAGE without a table grant reaches
        # nothing), which is why `test_forced_rls_and_grants.py`'s "worker holds
        # nothing" loop is about `has_table_privilege` and not about this.
        # `titlepipe_migration` is deliberately ABSENT: it holds USAGE through
        # `PUBLIC` below, and `roles.sql` does not name it.
        f"schema:public:USAGE:{APP_ROLE}",
        f"schema:public:USAGE:{WORKER_ROLE}",
        # PostgreSQL 15+ SHIPPED STATE for schema `public`, not anything this
        # repository wrote: the schema is owned by the `pg_database_owner`
        # pseudo-role and `PUBLIC` retains USAGE (only CREATE was revoked from
        # PUBLIC upstream in 15). `roles.sql` §"OBJECT-LEVEL GRANTS ARE NOT
        # CONVERGED" (~line 198) states that it does not converge these.
        #
        # 🔴 `schema:public:USAGE:PUBLIC` IS A REAL EXPOSURE THAT THIS LINE
        # ACCEPTS, and it is accepted because it grants reachability and not
        # readability: every table ACL asserted above names `titlepipe_app`
        # explicitly, so schema USAGE by PUBLIC opens no row. If a revision ever
        # grants a table verb to PUBLIC, the `relation:` entries here fail, not
        # this one.
        "schema:public:USAGE:PUBLIC",
        "schema:public:USAGE:pg_database_owner",
        "schema:public:CREATE:pg_database_owner",
    }
)


def test_the_whole_catalog_acl_converges_to_exactly_the_named_grants(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """One set, one comparison, no loop over tables somebody has to remember.

    Every other privilege assertion in this repository is shaped
    "for table in <the tables I expect>: assert ...". That shape cannot fail for
    an object outside the list, which is exactly the object a careless revision
    adds. This one inverts it: read every ACL in the cluster's `public` schema
    plus the schema ACL itself, drop the owner's own entries, and compare the
    remainder to a literal.

    A stray column grant, a routine grant, a grant on a table added by a future
    revision, a widened verb, a second grantee, `PUBLIC` anywhere: all one
    failure, all naming the entry.

    🔴 THIS TEST IS EXPECTED TO FAIL ON FIRST RUN if `EXACT_NON_OWNER_ACL` above
    does not match what `0002`/`0003`/`roles.sql` actually write. THE LITERAL IS
    THE THING UNDER REVIEW — do not edit it to whatever the database says
    without reading the revision that produced the difference and deciding the
    difference is intended. Copying the observed set into the literal turns this
    from a contract into a screenshot.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT 'relation', c.relname, x.privilege_type,
                           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                                ELSE x.grantee::regrole::text END
                      FROM pg_class c
                      JOIN pg_namespace n ON n.oid = c.relnamespace,
                           aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) AS x
                     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'S', 'v', 'm', 'p')
                    UNION ALL
                    SELECT 'column', c.relname || '.' || a.attname, x.privilege_type,
                           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                                ELSE x.grantee::regrole::text END
                      FROM pg_attribute a
                      JOIN pg_class c ON c.oid = a.attrelid
                      JOIN pg_namespace n ON n.oid = c.relnamespace,
                           aclexplode(a.attacl) AS x
                     WHERE n.nspname = 'public' AND a.attacl IS NOT NULL AND NOT a.attisdropped
                    UNION ALL
                    SELECT 'schema', n.nspname, x.privilege_type,
                           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                                ELSE x.grantee::regrole::text END
                      FROM pg_namespace n,
                           aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) AS x
                     WHERE n.nspname = 'public'
                    UNION ALL
                    SELECT 'routine', p.proname, x.privilege_type,
                           CASE WHEN x.grantee = 0 THEN 'PUBLIC'
                                ELSE x.grantee::regrole::text END
                      FROM pg_proc p
                      JOIN pg_namespace n ON n.oid = p.pronamespace,
                           aclexplode(p.proacl) AS x
                     WHERE n.nspname = 'public' AND p.proacl IS NOT NULL
                    """
                )
            ).all()
    finally:
        engine.dispose()

    observed = {f"{row[0]}:{row[1]}:{row[2]}:{row[3]}" for row in rows if str(row[3]) != OWNER_ROLE}

    unexpected = sorted(observed - EXACT_NON_OWNER_ACL)
    missing = sorted(EXACT_NON_OWNER_ACL - observed)

    assert not unexpected, (
        "privileges exist that no revision line in this repository is pointed "
        "at. Every one of these is invisible to the per-table loops in "
        "test_forced_rls_and_grants.py:\n  " + "\n  ".join(unexpected)
    )
    assert not missing, (
        "privileges the contract requires are absent — the app will take 42501 "
        "on these:\n  " + "\n  ".join(missing)
    )

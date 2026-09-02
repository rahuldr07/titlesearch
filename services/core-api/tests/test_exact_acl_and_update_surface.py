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

# 🔴 THE LITERAL, THE QUERY AND THE OWNER FILTER MOVED TO `acl_contract.py`, AND
# THE MOVE IS THE POINT. `.github/workflows/migration-harness.yml` builds a
# second database by a different path — service container, `psql`-applied
# `roles.sql`, CLI `alembic upgrade head` — and now runs the same contract
# against it as a job step. Two callers, one source: a literal edited here can no
# longer be true on the seam's database and false on the harness's.
from acl_contract import (
    CATALOG_ACL_QUERY,
    COLUMN_ACL_QUERY,
    CONNECT_TIME_STATE_QUERY,
    DEFAULT_ACL_QUERY,
    acl_divergence,
    connect_time_state,
)
from sqlalchemy import Engine, text

from titlepipe_core.db import models


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
            column_acls = connection.execute(text(COLUMN_ACL_QUERY)).all()
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
            defaults = connection.execute(text(DEFAULT_ACL_QUERY)).all()
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
# `EXACT_NON_OWNER_ACL`, `CATALOG_ACL_QUERY` and the owner filter now live in
# `tests/acl_contract.py`, which `.github/workflows/migration-harness.yml` runs
# as a job step against the SERVICE-CONTAINER database it builds by an entirely
# different path. That file's module docstring holds the argument; the short
# version is that this contract was asserted against one of the two databases
# this repository stands up, and the entries most likely to differ between them
# (`schema:public:USAGE:PUBLIC`, the `pg_database_owner` pair) are properties of
# how the database was CREATED rather than of any revision.
#
# 🔴 THE LITERAL IS STILL THE THING UNDER REVIEW. Do not edit it to whatever a
# database says. It is now wrong in two places at once when you do.


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
            rows = connection.execute(text(CATALOG_ACL_QUERY)).all()
    finally:
        engine.dispose()

    # Same function the harness step calls, so the owner filter cannot drift
    # between the two databases.
    unexpected, missing = acl_divergence(
        [(str(row[0]), str(row[1]), str(row[2]), str(row[3])) for row in rows]
    )

    assert not unexpected, (
        "privileges exist that no revision line in this repository is pointed "
        "at. Every one of these is invisible to the per-table loops in "
        "test_forced_rls_and_grants.py:\n  " + "\n  ".join(unexpected)
    )
    assert not missing, (
        "privileges the contract requires are absent — the app will take 42501 "
        "on these:\n  " + "\n  ".join(missing)
    )


# ---------------------------------------------------------------------------
# (iv) CONNECT-TIME STATE, WHICH NO ACL ASSERTION ABOVE CAN REACH
# ---------------------------------------------------------------------------
def test_no_connect_time_setting_exists_for_this_database_or_any_titlepipe_role(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 `pg_db_role_setting` IS EMPTY IN ALL THREE SCOPES, INCLUDING `setrole = 0`.

    `test_roles.py::test_no_titlepipe_role_carries_a_per_role_setting_default`
    asserts the same emptiness and CANNOT SEE ONE OF THE THREE SCOPES: its
    `_role_settings` helper does `JOIN pg_roles r ON r.oid = s.setrole`, and an
    `ALTER DATABASE d SET ...` row carries `setrole = 0`, which joins to nothing.
    That row applies to EVERY role connecting to the database — a strictly wider
    blast radius than the per-role rows the other test does read.

    MEASURED 2026-09-02 against postgres:18.4, on a throwaway database, planted
    by the cluster superuser and torn down afterwards:

        ALTER ROLE titlepipe_app IN DATABASE d SET role = titlepipe_owner;
          app DSN -> current_user = titlepipe_owner, session_user = titlepipe_app
        ALTER DATABASE d SET app.current_tenant = '8888…';
          app DSN -> current_setting('app.current_tenant') = '8888…'
          and set_config(…, false) then RESET goes BACK to '8888…'

    Both survive a full `roles.sql` rerun: its two `RESET ALL` passes are
    generated from `pg_roles`/`pg_db_role_setting` filtered on `rolname LIKE
    'titlepipe\\_%'`, so the `setrole = 0` row is not in either generator's
    result and no statement is ever issued for it (`migrations/sql/roles.sql`,
    the per-role GUC defaults section). MEASURED the same day: rerun exits 0,
    the row is still there.

    `engine.make_engine`'s `connect_args` DOES override the tenant GUC — libpq
    `options` is applied after these defaults — so the deny floor survives the
    second plant for connections `make_engine` and `migrations/env.py` open.
    Nothing in this tree pins `role`, so the first plant is undefended
    everywhere. Neither is a privilege, so no assertion in this file's other
    three tests can see either one.

    ZERO ROWS rather than "no dangerous rows", for the reason the sibling test
    in `test_roles.py` gives: nothing here writes one, so any row is drift, and
    a denylist of harmful GUCs is a denylist against a list PostgreSQL grows.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(CONNECT_TIME_STATE_QUERY)).all()
    finally:
        engine.dispose()

    planted = connect_time_state([(str(row[0]), str(row[1]), str(row[2])) for row in rows])

    assert planted == [], (
        "a connect-time setting exists. It is applied as the connection is "
        "established and consulted by nothing afterwards: `role` is a silent "
        "identity swap needing no membership at use time, and "
        "`app.current_tenant` is a valid tenant established before any "
        "application code runs:\n  " + "\n  ".join(planted)
    )


# ---------------------------------------------------------------------------
# (iv) THE SCHEMA-SIDE COUNTERPART TO (i)
# ---------------------------------------------------------------------------
# (i) walks `models.Base.registry.mappers`. That is a MODEL-side read, and the
# model is not the schema: `tests/conftest.py::migrated_database` runs
# `alembic upgrade head`, so every column this database actually has came out of
# `migrations/versions/`, and a revision can add a column write that no mapper
# carries. `orm-update-targetlist-measure` reached the same edge from the other
# side — it built its database with `Base.metadata.create_all`, so a
# `server_onupdate` defined only in a migration would not have appeared there
# either. Both blind spots are the same blind spot, and this is the catalog read
# that closes it.
#
# THE CENSUS OF SERVER-SIDE WRITES, taken by reading every file under
# `migrations/versions/` (2026-09-02):
#
# * COLUMN DEFAULTS — `0001::_identity_columns` (lines 129, 135) and its near-copy
#   `0003::_identity_columns` (lines 163, 169) give every table an
#   `id DEFAULT gen_random_uuid()` and a `created_at DEFAULT now()`. Sixteen
#   defaults over eight tables, and NOTHING else: no `DEFAULT` appears anywhere
#   else in any revision.
# * GENERATED COLUMNS — none. No revision writes `Computed(...)` or
#   `GENERATED ... AS`.
# * IDENTITY COLUMNS — none. `0002` says so in a comment at line 348 while
#   explaining why it grants no sequence privilege: "the primary key defaults to
#   `gen_random_uuid()` and nothing here is `serial` or `IDENTITY`".
# * TRIGGERS — exactly two, both on `audit_log`, both created by
#   `0001::_create_append_only_trigger` (lines 405, 412) and both flipped to
#   `ENABLE ALWAYS` by `0004`. Both are `FOR EACH STATEMENT`, and both call a
#   function whose whole body is `RAISE EXCEPTION USING ERRCODE = '0A000'`.
#
# WHY THAT CENSUS MAKES THE COLUMN-GRANT QUESTION COME OUT CLEAN, and why the
# three catalogs still need reading:
#
# * a column DEFAULT is INSERT-only and, crucially, PostgreSQL does not require
#   INSERT privilege on a column the statement did not name and the default
#   filled. So the sixteen defaults cost a narrow grant nothing.
# * a GENERATED or IDENTITY column is written by the server on every statement
#   that touches it, and is exactly the kind of column a column-scoped grant is
#   then measured against.
# * a BEFORE **ROW** trigger assigning `NEW.col` is the sharp one, and the prior
#   proof is the reason this test exists: an owner-owned `BEFORE UPDATE` trigger
#   setting `NEW.col` fires with the INVOKER's privileges (it is not SECURITY
#   DEFINER, and trigger functions do not switch role), so the write lands
#   outside the caller's column grant and takes 42501 — a failure with no line in
#   any handler. `audit_log`'s two triggers are `FOR EACH STATEMENT`, which has
#   no `NEW` at all, so today there is no such write. THE ROW/STATEMENT
#   DISTINCTION IS THE ENTIRE MARGIN, and `0001` chose statement-level for an
#   unrelated reason (a row trigger does not fire when a statement matches no
#   rows, which is the case under RLS). A revision that "fixes" that by making it
#   `FOR EACH ROW` is one word, is defensible on its own terms, and silently
#   moves this system into the failing case.
#
# So (i) stays as it is and this is added beside it: same question, catalog side.

# `pg_attrdef` joined back to the column it defaults, for user columns of user
# tables in `public`. `attnum > 0` drops the system columns; `NOT attisdropped`
# drops the tombstones a dropped column leaves behind, which keep their
# `pg_attribute` row and would otherwise appear as a column no schema mentions.
SERVER_DEFAULT_QUERY = """
    SELECT c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid)
      FROM pg_attrdef d
      JOIN pg_class c ON c.oid = d.adrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       AND a.attnum > 0 AND NOT a.attisdropped
"""

# `attgenerated` is `''` for an ordinary column and `'s'` for a STORED generated
# column; `attidentity` is `''`, `'a'` (ALWAYS) or `'d'` (BY DEFAULT). Both are
# read in one pass because both describe the same thing — a value the server
# writes into that column without the statement naming it.
GENERATED_OR_IDENTITY_QUERY = """
    SELECT c.relname, a.attname, a.attgenerated, a.attidentity
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       AND a.attnum > 0 AND NOT a.attisdropped
       AND (a.attgenerated <> '' OR a.attidentity <> '')
"""

# Every non-internal trigger in `public`, with the two `tgtype` bits that decide
# whether it can write `NEW.*`: bit 0 (`1`) set means FOR EACH ROW, bit 1 (`2`)
# set means BEFORE. `tgisinternal` excludes the ones PostgreSQL creates for
# foreign keys and deferred constraints, which are not ours and which no
# revision can be held responsible for.
TRIGGER_TIMING_QUERY = """
    SELECT c.relname, t.tgname, (t.tgtype & 1) <> 0, (t.tgtype & 2) <> 0,
           p.proname, p.prosecdef
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname = 'public' AND NOT t.tgisinternal
"""

# The sixteen defaults the census above accounts for, as `<table>.<column>` ->
# the expression PostgreSQL stores. Written out per table rather than generated
# from a table list for `0001`'s stated reason: a loop cannot fail for a table
# somebody forgot to put in it, and the table this would omit is the one a new
# revision adds.
EXPECTED_SERVER_DEFAULTS = {
    "tenants.id": "gen_random_uuid()",
    "tenants.created_at": "now()",
    "orders.id": "gen_random_uuid()",
    "orders.created_at": "now()",
    "packages.id": "gen_random_uuid()",
    "packages.created_at": "now()",
    "pages.id": "gen_random_uuid()",
    "pages.created_at": "now()",
    "fields.id": "gen_random_uuid()",
    "fields.created_at": "now()",
    "field_readings.id": "gen_random_uuid()",
    "field_readings.created_at": "now()",
    "audit_log.id": "gen_random_uuid()",
    "audit_log.created_at": "now()",
    "rules.id": "gen_random_uuid()",
    "rules.created_at": "now()",
}


def test_the_migrated_schema_holds_exactly_the_sixteen_insert_only_defaults(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """`pg_attrdef`, as a CLOSED SET, on the database `alembic upgrade head` built.

    The expected value is `id DEFAULT gen_random_uuid()` and
    `created_at DEFAULT now()` on all eight tables and NOTHING ELSE. Both are
    INSERT-only — a `DEFAULT` is not consulted by `UPDATE` — and PostgreSQL does
    not demand INSERT privilege on a column the statement did not name, so
    neither costs a column-scoped grant anything. They are pinned anyway because
    a NEW entry in this catalog is the cheapest way to find out that a revision
    started writing a column the ORM does not model.

    `alembic_version` carries no default and is absent from the expectation on
    purpose: it is Alembic's bookkeeping and not this system's schema, so a
    default appearing on it should fail here rather than be pre-excused.

    MEASURED at head: exactly the sixteen below.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(SERVER_DEFAULT_QUERY)).all()
    finally:
        engine.dispose()

    found = {f"{row[0]}.{row[1]}": str(row[2]) for row in rows}

    assert found == EXPECTED_SERVER_DEFAULTS, (
        "the set of server-side column DEFAULTs on the migrated schema is not "
        "the one the migration census accounts for. Unexpected: "
        f"{sorted(set(found) - set(EXPECTED_SERVER_DEFAULTS))}; missing: "
        f"{sorted(set(EXPECTED_SERVER_DEFAULTS) - set(found))}; changed: "
        f"{sorted(k for k in set(found) & set(EXPECTED_SERVER_DEFAULTS) if found[k] != EXPECTED_SERVER_DEFAULTS[k])}"
    )


def test_no_column_in_the_migrated_schema_is_generated_or_identity(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 `pg_attribute.attgenerated` AND `attidentity` ARE READ BY NOTHING ELSE HERE.

    Unlike a DEFAULT, a GENERATED column is recomputed on every UPDATE that
    touches the row and an `IDENTITY ... GENERATED ALWAYS` column is written on
    every INSERT regardless of what the caller named. Either is a column in the
    effective target list of a statement whose SET clause never mentions it, and
    neither appears in `models.Base.registry.mappers` in any form the guard
    above can see — `onupdate`, `server_onupdate` and `version_id_col` are the
    three things it checks, and `Computed()` is none of them.

    `0002` (~line 348) already asserts the identity half in PROSE, as the reason
    it grants no sequence privilege: "nothing here is `serial` or `IDENTITY`".
    This is the same sentence, addressed to the catalog, so that the day it stops
    being true the grant reasoning that depends on it fails too.

    MEASURED at head: the empty set.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(GENERATED_OR_IDENTITY_QUERY)).all()
    finally:
        engine.dispose()

    found = sorted(
        f"{row[0]}.{row[1]} (attgenerated={row[2]!r}, attidentity={row[3]!r})" for row in rows
    )
    assert found == [], (
        "generated or identity columns exist. Each is written by the server on "
        "statements that do not name it, so it is inside the effective target "
        "list and outside every column-scoped grant:\n  " + "\n  ".join(found)
    )


def test_no_before_row_trigger_exists_that_could_write_new_dot_anything(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE SHARP ONE: a BEFORE ROW trigger writes with the INVOKER's privileges.

    A trigger function is not SECURITY DEFINER unless it says so, and a plain
    trigger function does not switch role — so an owner-owned `BEFORE UPDATE ...
    FOR EACH ROW` trigger assigning `NEW.col` performs that write as whoever
    issued the UPDATE. Under a column-scoped grant the caller does not hold on
    `col`, the statement takes 42501 from a line that appears in no handler, no
    model and no test expectation.

    Two triggers exist at head, `audit_log_append_only` and
    `audit_log_no_truncate` (`0001` lines 405/412, `ENABLE ALWAYS` since `0004`),
    and BOTH are `FOR EACH STATEMENT`. A statement trigger has no `NEW` record at
    all, so neither can widen a target list. That is the entire margin, and it is
    one word wide: `0001` chose statement-level for a DIFFERENT reason — a row
    trigger does not fire for a statement that matches no rows, which is the
    ordinary case under `0002`'s RLS — so nothing in the repository ties the
    row/statement choice to the privilege consequence. This does.

    The assertion is "no BEFORE ROW trigger ANYWHERE in public", not "these two
    are still statement-level": a new trigger on `pages` is the change this is
    watching for, and a loop over the tables somebody remembered would not see
    it. `prosecdef` is reported in the failure message because a SECURITY
    DEFINER trigger function is the one shape of BEFORE ROW trigger that does
    NOT trip a narrow grant, and whoever reads this failure needs to know which
    kind they are looking at before deciding.

    MEASURED at head: the empty set.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(TRIGGER_TIMING_QUERY)).all()
    finally:
        engine.dispose()

    before_row = sorted(
        f"{row[1]} on {row[0]} -> {row[4]}() (BEFORE, FOR EACH ROW, "
        f"security_definer={bool(row[5])})"
        for row in rows
        if bool(row[2]) and bool(row[3])
    )
    assert before_row == [], (
        "BEFORE ROW triggers exist. Each fires with the INVOKER's privileges and "
        "any NEW.* it assigns is a column write outside the caller's grant:\n  "
        + "\n  ".join(before_row)
    )

    # The positive control, in the same test so the negative above cannot pass by
    # reading an empty catalog: `0001`'s two triggers must actually be there. A
    # query that returned nothing at all — wrong schema name, `tgisinternal`
    # inverted — would satisfy the assertion above and prove nothing.
    names = sorted(f"{row[1]} on {row[0]}" for row in rows)
    assert names == [
        "audit_log_append_only on audit_log",
        "audit_log_no_truncate on audit_log",
    ], f"the trigger census itself has moved, so the BEFORE-ROW read above is stale: {names}"

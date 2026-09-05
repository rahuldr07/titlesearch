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
    FIELDS_UPDATABLE_COLUMNS,
    acl_divergence,
    column_grant_divergence,
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
def test_the_column_level_grants_are_exactly_0032s_narrowing_of_fields(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 `pg_attribute.attacl` IS READ BY THIS TEST AND BY ALMOST NOTHING ELSE.

    NAMED `test_no_column_level_grant_exists_anywhere_in_public` UNTIL 2026-09-05
    — the old name is here so a grep for it lands — and it asserted the EMPTY SET,
    because the contract was table-level grants only. `0032` changed that contract
    on purpose and this test went red naming all seventeen entries, which is the
    closed-world comparison working rather than a stale literal.

    WHAT `0032` DID, AND WHY IT IS A NARROWING RATHER THAN A GRANT.
    `_narrow_the_update_grant` issues `REVOKE UPDATE ON fields FROM titlepipe_app`
    and then `GRANT UPDATE (<seventeen columns>) ON fields`. The revoke has to be
    table-wide and has to come FIRST, because a column grant is ADDED to a table
    grant rather than shadowing it — granting the columns without revoking the
    table would leave `state` writable and the state machine decorative. Net
    effect: the app lost the ability to write `id`, `created_at`, `tenant_id`,
    `order_id`, `path` and `state`, and kept the seventeen a correction touches.

    WHY THE ASSERTION IS STILL A CLOSED SET AND NOT "these seventeen are present".
    The reasons the empty set was right have not changed, only its value:

    * `relacl` is untouched by a column grant — `test_forced_rls_and_grants.py
      ::_table_grantees` explodes `relacl` and sees nothing;
    * `has_table_privilege` answers about the TABLE and returns FALSE for a role
      holding only a column grant, so that file's "the worker holds nothing" loop
      stays green while the worker rewrites a column.

    So a column grant this literal does not name is a privilege no other assertion
    in this repository can see, whatever its value happens to be. `GRANT UPDATE
    (tenant_id) ON pages TO titlepipe_blind` — the shape this docstring has always
    been about, and the smallest change that defeats `tenant_isolation`, because
    `0002` writes no `WITH CHECK` and a role that can re-tenant a row can then read
    it — fails here, and now fails naming itself rather than being lost among
    seventeen expected lines.

    BOTH DIRECTIONS. A missing entry is not cosmetic either: the app takes 42501
    on a correction, from a line that appears in no handler.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            column_acls = connection.execute(text(COLUMN_ACL_QUERY)).all()
    finally:
        engine.dispose()

    unexpected, missing = column_grant_divergence(
        [(str(row[0]), str(row[1]), str(row[2]), str(row[3])) for row in column_acls]
    )

    assert not unexpected, (
        "column-level grants exist that the contract does not name, and NOTHING "
        "else in this suite reads pg_attribute.attacl — relacl is unchanged by "
        "them and has_table_privilege reports FALSE for a role holding one:\n  "
        + "\n  ".join(unexpected)
    )
    assert not missing, (
        "0032's narrowed UPDATE grant on fields is incomplete. The app takes "
        "42501 writing these columns, from a line in no handler:\n  " + "\n  ".join(missing)
    )

    # THE POSITIVE CONTROL, because both assertions above are satisfied by a query
    # that returned nothing at all — wrong schema name, an `attacl IS NOT NULL`
    # that stopped matching — and an empty catalog is EXACTLY the state this test
    # used to assert. Seventeen, MEASURED at head 2026-09-05.
    assert len(column_acls) == len(FIELDS_UPDATABLE_COLUMNS), (
        f"the column-ACL read returned {len(column_acls)} rows, not "
        f"{len(FIELDS_UPDATABLE_COLUMNS)}. Zero here would satisfy both assertions "
        f"above and would mean 0032's narrowing did not land — which restores a "
        f"table-wide UPDATE only if somebody also re-granted it, and otherwise "
        f"means the app cannot correct a field at all."
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
# THE CENSUS OF SERVER-SIDE WRITES. RE-TAKEN 2026-09-05 against a database at
# head on `integration/backend-2026-09`, and TWO OF THE FOUR LINES BELOW CHANGED
# FROM "none" TO A NAMED SET. Read those two before editing anything here.
#
# * COLUMN DEFAULTS — sixty-two identity defaults, one `id DEFAULT
#   gen_random_uuid()` and one `created_at DEFAULT now()` on each of the
#   thirty-one tables this repository creates, plus THREE non-identity defaults
#   and ELEVEN belonging to the vendored queue schema. The three are named in
#   `EXPECTED_NON_IDENTITY_DEFAULTS` with the ruling behind each; all three are
#   INSERT-only, which is what makes them free.
# * GENERATED COLUMNS — still none. No revision writes `Computed(...)` or
#   `GENERATED ... AS`.
# * 🔴 IDENTITY COLUMNS — ONE, AND IT IS NOT OURS. `procrastinate_workers.id` is
#   `GENERATED ALWAYS AS IDENTITY` in `0060`'s vendored DDL. This line read "none"
#   and cited `0002`'s comment — "the primary key defaults to `gen_random_uuid()`
#   and nothing here is `serial` or `IDENTITY`" — as the reason `0002` grants no
#   sequence privilege. That reasoning has been overtaken twice: `0060` adds three
#   `bigserial` sequences AND grants USAGE on them, and the identity column is the
#   one sequence that still needs no grant, because an identity sequence is
#   internally dependent on its column and PostgreSQL checks no privilege for it.
#   See `test_forced_rls_and_grants.py::test_every_sequence_is_usable_by_every_role
#   _that_inserts_into_its_table`, which replaced the "there are no sequences"
#   assertion with the stronger one.
# * 🔴 TRIGGERS — TWENTY-TWO, AND FOUR OF THEM ARE `BEFORE ... FOR EACH ROW`.
#   This line read "five, all FOR EACH STATEMENT except one AFTER ROW", and the
#   BEFORE-ROW assertion below was an EMPTY SET held as *"a STRUCTURAL fact rather
#   than a claim about a function body"*. It is not structural any more. See
#   `EXPECTED_BEFORE_ROW_TRIGGERS` for what changed, what it costs, and what now
#   holds the property in its place.
#
# WHY THAT CENSUS USED TO MAKE THE COLUMN-GRANT QUESTION COME OUT CLEAN, AND WHY
# THE ARGUMENT IS NOW A CONJUNCTION RATHER THAN A FACT:
#
# * a column DEFAULT is INSERT-only and, crucially, PostgreSQL does not require
#   INSERT privilege on a column the statement did not name and the default
#   filled. So every default in this schema still costs a narrow grant nothing —
#   this half is unchanged, and it covers all seventy-six of them;
# * a GENERATED or IDENTITY column is written by the server on every statement
#   that touches it, and is exactly the kind of column a column-scoped grant is
#   then measured against. The one identity column is on `procrastinate_workers`,
#   which carries no column grant and cannot: `0060` grants at table level only;
# * 🔴 a BEFORE **ROW** trigger assigning `NEW.col` is the sharp one, and it now
#   EXISTS. `0007`'s `audit_chain_link` assigns `NEW.prev_hash`, `NEW.row_hash`
#   and `NEW.chain_position` on `audit_log`. It is not `SECURITY DEFINER` and a
#   trigger function does not switch role, so those three writes happen with the
#   INVOKER's privileges — and under a column-scoped grant the caller does not
#   hold on them, the INSERT takes 42501 from a line in no handler, no model and
#   no test expectation.
#
#   WHAT KEEPS THAT FROM BEING LIVE TODAY IS NON-OVERLAP AND NOTHING ELSE. The
#   only column-scoped grant in the schema is `0032`'s seventeen on `fields`;
#   `fields` has no BEFORE ROW trigger. The only BEFORE ROW trigger that assigns
#   `NEW.*` is on `audit_log`; `audit_log`'s grants are table-wide. Two revisions
#   from two workstreams that never saw each other, and the margin between them is
#   that they landed on different tables.
#
#   So the assertion below is no longer "no BEFORE ROW trigger anywhere". It is
#   the CONJUNCTION — no table may carry both a column-scoped grant and a BEFORE
#   ROW trigger — which is the actual failure condition, is derivable from two
#   catalogs, needs no claim about any function body, and goes red the day
#   somebody narrows `audit_log`'s INSERT grant or puts a BEFORE ROW trigger on
#   `fields`. `0072`'s docstring records why a `prosrc` regex is not an
#   alternative: it cannot tell a plpgsql assignment from a comparison.
#
# So (i) stays as it is and this is beside it: same question, catalog side.

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

# ---------------------------------------------------------------------------
# 🔴 SEVENTY-SIX DEFAULTS, ACCOUNTED FOR BY THREE RULES RATHER THAN BY
#    SEVENTY-SIX NAMES.
# ---------------------------------------------------------------------------
# This used to be a flat mapping of twenty-one `<table>.<column>` literals, and
# the merge would have made it seventy-six. Sixty-two of those are the identity
# pair repeated over thirty-one tables, which is a STRUCTURAL property with a
# revision behind it (`_identity_columns`, copied into every `create_table`), and
# writing it out one table at a time would produce a literal a reader skims and a
# maintainer regenerates — `test_the_whole_catalog_acl_converges_to_exactly_the
# _named_grants` states the rule about what that does to a contract.
#
# So the closed-world property is kept and the shape changes: every default in
# `public` must be accounted for by exactly one of the three rules below, and the
# assertion is the partition, not a name list.
#
#   1. the identity pair, on every table this repository creates. Derived from
#      the catalog's table list, so a thirty-second table is covered with no edit
#      and a table MISSING either half fails;
#   2. `EXPECTED_NON_IDENTITY_DEFAULTS` — the three that are not the identity
#      pair. This is the literal worth having: a default that is not an identity
#      column is where CONVENTIONS §4 gets violated, so each of the three carries
#      the argument that it is not a fabricated value papering over a `NOT NULL`;
#   3. `EXPECTED_QUEUE_DEFAULTS` — the vendored eleven, pinned so that bumping
#      `procrastinate_schema_3.9.0.sql` is a diff.
#
# `alembic_version` carries no default and is in none of the three on purpose: it
# is Alembic's bookkeeping and not this system's schema, so a default appearing on
# it should fail rather than be pre-excused.
#
# THIS TEST WAS NAMED `..._the_sixteen_insert_only_defaults` until 2026-09-05,
# then `..._it_declares` when `0070` made the count twenty-one. Both old names are
# written here so a grep for either lands. A test named after a number is a test
# renamed by every revision that adds a table, which is the third time that has
# happened and the reason the count is now derived.

IDENTITY_DEFAULTS = {"id": "gen_random_uuid()", "created_at": "now()"}

# 🔴 THE THREE DEFAULTS IN THIS SCHEMA THAT ARE NOT AN IDENTITY COLUMN. Each is
# INSERT-only, so each costs a column-scoped grant nothing, and each is here
# because a default is the cheapest way to violate CONVENTIONS §4 — "no honest
# default" — without anybody writing the words.
EXPECTED_NON_IDENTITY_DEFAULTS = {
    # `0007`. `clock_timestamp()` and NOT `now()`, and the difference is the
    # whole point: `now()` is transaction start, so every row written by one
    # transaction would carry an identical `occurred_at` and the audit log could
    # not order the events inside it. A hash chain over rows that cannot be
    # ordered is a chain over an arbitrary permutation.
    "audit_log.occurred_at": "clock_timestamp()",
    # `0032`. Not a fabricated value: a reading with no explicit ordinal IS the
    # first attempt. `attempt_ordinal` is what makes a retry a second ROW rather
    # than an edit to the first, so an ensemble that overwrote its own earlier
    # reading would have no disagreement left to adjudicate — and defaulting it
    # to 1 is what lets a single-attempt writer stay honest without knowing the
    # column exists.
    "field_readings.attempt_ordinal": "1",
    # `0070`. Revision 0 IS the establishment, and every number above it is a
    # correction that `0072`'s trigger requires a signed `golden_corrections` row
    # for. A default here is the statement "this value has never been corrected",
    # which is true of a row being established.
    "golden_fields.revision": "0",
}

# `0060`'s vendored eleven, as `pg_attrdef` reports them at head. NOT reviewed as
# decisions — they are Procrastinate's — and pinned only so a version bump is a
# diff rather than a surprise. The three `nextval(...)` entries are the
# `bigserial` ids whose sequences `test_forced_rls_and_grants.py` now asserts the
# grants for; `procrastinate_workers.id` is absent because an IDENTITY column's
# generator lives in `attidentity` and not in `pg_attrdef`.
EXPECTED_QUEUE_DEFAULTS = {
    "procrastinate_jobs.id": "nextval('procrastinate_jobs_id_seq'::regclass)",
    "procrastinate_jobs.status": "'todo'::procrastinate_job_status",
    "procrastinate_jobs.args": "'{}'::jsonb",
    "procrastinate_jobs.attempts": "0",
    "procrastinate_jobs.priority": "0",
    "procrastinate_jobs.abort_requested": "false",
    "procrastinate_events.id": "nextval('procrastinate_events_id_seq'::regclass)",
    "procrastinate_events.at": "now()",
    "procrastinate_periodic_defers.id": (
        "nextval('procrastinate_periodic_defers_id_seq'::regclass)"
    ),
    "procrastinate_periodic_defers.periodic_id": "''::character varying",
    "procrastinate_workers.last_heartbeat": "now()",
}


def test_every_server_side_default_is_accounted_for_by_one_of_three_rules(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """`pg_attrdef`, as a PARTITION, on the database `alembic upgrade head` built.

    🔴 NAMED `test_the_migrated_schema_holds_exactly_the_insert_only_defaults_it
    _declares` UNTIL 2026-09-05, and `..._the_sixteen_insert_only_defaults` before
    that. Both old names are here so a grep for either lands, and the second
    rename is for the first one's reason: the merge took the count from
    twenty-one to seventy-six, and a test whose expectation is a list of names is
    a test somebody regenerates from the database instead of reading.

    THE CLOSED-WORLD PROPERTY IS UNCHANGED. Every default in `public` must still
    be accounted for, and an unaccounted one still fails. What changed is that
    sixty-two of the seventy-six are the identity pair repeated over thirty-one
    tables, and that is asserted as the RULE it is — every table this repository
    creates has `id DEFAULT gen_random_uuid()` and `created_at DEFAULT now()`,
    both halves, no more — rather than as sixty-two lines. A thirty-second table
    is covered with no edit; a table missing either half fails; a table carrying a
    THIRD default fails into `EXPECTED_NON_IDENTITY_DEFAULTS`, which is the
    literal that is actually worth reading.

    Both are INSERT-only — a `DEFAULT` is not consulted by `UPDATE` — and
    PostgreSQL does not demand INSERT privilege on a column the statement did not
    name, so neither costs a column-scoped grant anything. They are pinned anyway
    because a NEW entry in this catalog is the cheapest way to find out that a
    revision started writing a column the ORM does not model.

    `alembic_version` carries no default and is in none of the three rules on
    purpose: it is Alembic's bookkeeping and not this system's schema, so a
    default appearing on it should fail here rather than be pre-excused.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            rows = connection.execute(text(SERVER_DEFAULT_QUERY)).all()
            # The tables this repository creates, which is what rule 1 is about.
            # Derived rather than imported from `test_schema_migration.py`: these
            # two files assert different things about the same schema and a shared
            # constant would let one file's edit silence the other's failure.
            ours = {
                str(row[0])
                for row in connection.execute(
                    text(
                        "SELECT c.relname FROM pg_class c "
                        "JOIN pg_namespace n ON n.oid = c.relnamespace "
                        "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                        "  AND c.relname <> 'alembic_version' "
                        "  AND c.relname NOT LIKE 'procrastinate\\_%'"
                    )
                )
            }
    finally:
        engine.dispose()

    found = {f"{row[0]}.{row[1]}": str(row[2]) for row in rows}

    # RULE 1, BOTH DIRECTIONS. `expected_identity` is what the thirty-one tables
    # must have; anything they have BEYOND it falls through to rules 2 and 3.
    expected_identity = {
        f"{table}.{column}": expression
        for table in ours
        for column, expression in IDENTITY_DEFAULTS.items()
    }
    missing_identity = sorted(name for name in expected_identity if name not in found)
    assert missing_identity == [], (
        f"tables this repository creates that are missing an identity default: "
        f"{missing_identity}. Every one of them gets `id DEFAULT gen_random_uuid()` "
        f"and `created_at DEFAULT now()` from the `_identity_columns` helper each "
        f"revision copies, so a missing half means a table that did not use it."
    )

    wrong_identity = sorted(
        f"{name} is {found[name]!r}, not {expected_identity[name]!r}"
        for name in expected_identity
        if found[name] != expected_identity[name]
    )
    assert wrong_identity == [], (
        "an identity column's default is not the one every other table has:\n  "
        + "\n  ".join(wrong_identity)
    )

    # RULES 2 AND 3, AND THE PARTITION. Everything `pg_attrdef` holds that rule 1
    # did not claim must be named in exactly one of the two literals — so a
    # default on a queue table that the vendored file did not have fails, and so
    # does a fourth non-identity default on one of ours.
    remainder = {name: value for name, value in found.items() if name not in expected_identity}
    accounted = {**EXPECTED_NON_IDENTITY_DEFAULTS, **EXPECTED_QUEUE_DEFAULTS}

    assert remainder == accounted, (
        "the server-side defaults outside the identity pair are not the ones the "
        "migration census accounts for. Unexpected: "
        f"{sorted(set(remainder) - set(accounted))}; missing: "
        f"{sorted(set(accounted) - set(remainder))}; changed: "
        f"{sorted(f'{k}: {remainder[k]!r} not {accounted[k]!r}' for k in set(remainder) & set(accounted) if remainder[k] != accounted[k])}. "
        "A new entry on one of this repository's tables is a value the server "
        "writes that no model declares; on a queue table it means the vendored "
        "schema file changed."
    )

    # THE COUNT, as a positive control on the read itself. Both comparisons above
    # are satisfied by a query that returned nothing — wrong schema name, an
    # `attisdropped` filter that stopped matching — and rule 1's `missing_identity`
    # would then name all sixty-two, so this is really a control on `ours`.
    # MEASURED 2026-09-05: thirty-one tables, seventy-six defaults.
    assert len(ours) == 31, (
        f"the derivation found {len(ours)} tables this repository creates, not 31. "
        f"Rule 1 is built from that list, so a short list means identity defaults "
        f"asserted for fewer tables than exist."
    )
    assert len(found) == len(expected_identity) + len(accounted), (
        f"pg_attrdef holds {len(found)} defaults; the three rules account for "
        f"{len(expected_identity) + len(accounted)}. The comparisons above should "
        f"have named the difference, so this failing alone means a default was "
        f"counted by two rules at once."
    )


def test_the_only_identity_column_is_the_vendored_one_and_nothing_is_generated(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 `pg_attribute.attgenerated` AND `attidentity` ARE READ BY NOTHING ELSE HERE.

    NAMED `test_no_column_in_the_migrated_schema_is_generated_or_identity` until
    2026-09-05 — the old name is here so a grep for it lands — and it asserted the
    empty set. `0060`'s vendored Procrastinate DDL makes
    `procrastinate_workers.id` `GENERATED ALWAYS AS IDENTITY`, so the empty set
    stopped being the right expectation and this test named it, which is what the
    closed-world read is for.

    Unlike a DEFAULT, a GENERATED column is recomputed on every UPDATE that
    touches the row and an `IDENTITY ... GENERATED ALWAYS` column is written on
    every INSERT regardless of what the caller named. Either is a column in the
    effective target list of a statement whose SET clause never mentions it, and
    neither appears in `models.Base.registry.mappers` in any form the guard above
    can see — `onupdate`, `server_onupdate` and `version_id_col` are the three
    things it checks, and `Computed()` is none of them.

    WHY THE ONE EXCEPTION COSTS NOTHING, STATED RATHER THAN ASSUMED. The hazard is
    an identity column inside a COLUMN-SCOPED grant, where the server writes a
    column the caller does not hold. `0060` grants the queue at TABLE level only
    — `test_the_column_level_grants_are_exactly_0032s_narrowing_of_fields` is what
    holds that, since the only column grants in this schema are on `fields` — so
    nobody inserting into `procrastinate_workers` can be short a column privilege
    for `id`. Its sequence needs no `USAGE` either, for a different reason `0060`
    measured: an identity column's sequence is internally dependent on the column
    and PostgreSQL checks no privilege for it.

    `0002` (~line 348) asserts the identity half in PROSE, as the reason it grants
    no sequence privilege: "nothing here is `serial` or `IDENTITY`". THAT SENTENCE
    IS NOW FALSE OF THE SCHEMA and true only of the tables `0002` itself created.
    `test_forced_rls_and_grants.py::test_every_sequence_is_usable_by_every_role_that
    _inserts_into_its_table` is what replaced the reasoning that depended on it.

    THE EXPECTATION IS EXACT AND NAMES THE COLUMN, not "identity columns are
    allowed on queue tables": a second one, on a table this repository writes, has
    to be added here deliberately.
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
    assert found == ["procrastinate_workers.id (attgenerated='', attidentity='a')"], (
        "the generated-or-identity set is not the one the census accounts for. "
        "Each such column is written by the server on statements that do not name "
        "it, so it is inside the effective target list and outside every "
        "column-scoped grant — and the one entry that is expected here is on a "
        "vendored table that carries no column grant:\n  " + "\n  ".join(found)
    )


# ---------------------------------------------------------------------------
# 🔴 THE FOUR `BEFORE ... FOR EACH ROW` TRIGGERS, NAMED, AND WHICH ONE MATTERS.
# ---------------------------------------------------------------------------
# The assertion below used to be the EMPTY SET and its docstring called that "a
# STRUCTURAL fact rather than a claim about a function body". It is neither now.
# MEASURED at head 2026-09-05, four triggers are BEFORE ROW and one of them
# assigns `NEW.*`:
#
# * `audit_log_chain_link` on `audit_log` (`0007`) — THE ONE. `BEFORE INSERT`,
#   not `SECURITY DEFINER`, and its whole purpose is to assign `NEW.prev_hash`,
#   `NEW.row_hash` and `NEW.chain_position`. It could not be `AFTER` (the return
#   value is discarded) and could not be statement-level (there is no `NEW`), so
#   this is forced by what a hash chain is, not chosen;
# * `packages_identity_is_immutable` on `packages` (`0031`) — `BEFORE UPDATE`,
#   raises when `sha256`, `byte_size` or `tenant_id` changes. Compares, does not
#   assign;
# * `trg_escalations_resolution_needs_a_live_rule` on `escalations` (`0041`) —
#   `BEFORE INSERT OR UPDATE`, `SECURITY DEFINER`, refuses a resolution that
#   cites no LIVE rule. CLAUDE.md's "escalation resolution is refused without a
#   rule", as a database machine. Compares, does not assign;
# * `procrastinate_trigger_delete_jobs_v1` on `procrastinate_jobs` (`0060`) —
#   vendored, `BEFORE DELETE`, unlinks periodic defers. Not ours.
#
# WHY THE TEST IS NOT SIMPLY UPDATED TO THIS LIST. The property it protects is
# that no statement writes a column outside the caller's grant: an owner-owned
# `BEFORE ROW` trigger assigning `NEW.col` is not `SECURITY DEFINER` and a trigger
# function does not switch role, so the write happens with the INVOKER's
# privileges and takes 42501 from a line in no handler, no model and no test
# expectation. A list of four names does not assert that property — it records
# that four triggers exist.
#
# 🔴 AND THE PROPERTY IS NO LONGER STRUCTURALLY GUARANTEED. It holds today by
# NON-OVERLAP: the only column-scoped grant in this schema is `0032`'s seventeen
# on `fields`, and `fields` has no BEFORE ROW trigger; the only BEFORE ROW trigger
# that assigns `NEW.*` is on `audit_log`, whose grants are table-wide. Two
# revisions from two workstreams that never saw each other, and the margin between
# them is which table each landed on. That is worth saying out loud rather than
# recording as "still fine".
#
# SO THE ASSERTION BECOMES THE CONJUNCTION, which is the actual failure condition:
# no table may carry BOTH a column-scoped grant AND a BEFORE ROW trigger. It is
# derivable from two catalogs, needs no claim about any function body — `0072`'s
# docstring records why a `prosrc` regex is not an alternative, since it cannot
# tell a plpgsql assignment from a comparison — and it is CONSERVATIVE: it fails
# for a BEFORE ROW trigger that only compares, because whether it assigns is
# exactly the thing that cannot be read off the catalog. It goes red the day
# somebody narrows `audit_log`'s INSERT grant to a column list, or puts a BEFORE
# ROW trigger on `fields`.
#
# The enumeration below is kept BESIDE it, not instead of it, so a fifth BEFORE
# ROW trigger is still a diff somebody reads.
EXPECTED_BEFORE_ROW_TRIGGERS = {
    # `0100`. It assigns `NEW.actor_user_id` and `NEW.actor_principal`, so it is
    # a second assigning trigger on `audit_log` and lands in the census for the
    # same reason `audit_log_chain_link` does. `audit_log`'s INSERT grant is
    # table-wide, so the conjunction this test asserts is still not met.
    "audit_log_bind_actor on audit_log",
    "audit_log_chain_link on audit_log",
    "packages_identity_is_immutable on packages",
    "trg_escalations_resolution_needs_a_live_rule on escalations",
    "procrastinate_trigger_delete_jobs_v1 on procrastinate_jobs",
}


def test_no_table_carries_both_a_column_grant_and_a_before_row_trigger(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE SHARP ONE: a BEFORE ROW trigger writes with the INVOKER's privileges.

    NAMED `test_no_before_row_trigger_exists_that_could_write_new_dot_anything`
    until 2026-09-05 — the old name is here so a grep for it lands — and it
    asserted that no such trigger existed anywhere. Four do. See
    `EXPECTED_BEFORE_ROW_TRIGGERS` above for which, which one assigns `NEW.*`, and
    why the claim moved from an absence to a conjunction rather than to a list.

    A trigger function is not `SECURITY DEFINER` unless it says so, and a plain
    trigger function does not switch role — so an owner-owned `BEFORE UPDATE ...
    FOR EACH ROW` trigger assigning `NEW.col` performs that write as whoever
    issued the statement. Under a column-scoped grant the caller does not hold on
    `col`, it takes 42501 from a line that appears in no handler, no model and no
    test expectation.

    BOTH HALVES OF THAT HAZARD NOW EXIST IN THIS SCHEMA and they are on different
    tables. `0007` put the trigger on `audit_log`; `0032` put the column grants on
    `fields`. Neither revision could see the other. This asserts the only thing
    that actually has to hold — that they stay apart — and it is deliberately
    conservative about WHICH before-row triggers count: all of them, including the
    three that only compare, because "does this function body assign `NEW`" is
    precisely the question a catalog cannot answer.

    `prosecdef` is reported in the failure message because a `SECURITY DEFINER`
    trigger function is the one shape of BEFORE ROW trigger that does NOT trip a
    narrow grant, and whoever reads this failure needs to know which kind they are
    looking at before deciding.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            triggers = connection.execute(text(TRIGGER_TIMING_QUERY)).all()
            column_grants = connection.execute(text(COLUMN_ACL_QUERY)).all()
    finally:
        engine.dispose()

    before_row = {
        str(row[0]): f"{row[1]} on {row[0]} -> {row[4]}() (security_definer={bool(row[5])})"
        for row in triggers
        if bool(row[2]) and bool(row[3])
    }
    narrowed = {str(row[0]) for row in column_grants}

    collisions = sorted(
        f"{before_row[table]}, and {table} carries column-scoped grants on "
        f"{sorted({str(row[1]) for row in column_grants if str(row[0]) == table})}"
        for table in sorted(set(before_row) & narrowed)
    )
    assert collisions == [], (
        "a table carries BOTH a column-scoped grant and a BEFORE ROW trigger. "
        "The trigger fires with the INVOKER's privileges, so any NEW.* it assigns "
        "is a column write outside the caller's grant and the statement takes "
        "42501 from a line in no handler. Either the grant goes back to table "
        "level or the trigger stops being BEFORE ROW:\n  " + "\n  ".join(collisions)
    )

    # THE ENUMERATION, BESIDE THE CONJUNCTION AND NOT INSTEAD OF IT. The assertion
    # above is about a PAIRING; this is what makes a fifth BEFORE ROW trigger a
    # diff a reviewer reads, whichever table it lands on.
    named = {f"{row[1]} on {row[0]}" for row in triggers if bool(row[2]) and bool(row[3])}
    assert named == EXPECTED_BEFORE_ROW_TRIGGERS, (
        f"the BEFORE ROW trigger census has moved. Unexpected: "
        f"{sorted(named - EXPECTED_BEFORE_ROW_TRIGGERS)}; gone: "
        f"{sorted(EXPECTED_BEFORE_ROW_TRIGGERS - named)}. Each of these can assign "
        f"NEW.* with the invoker's privileges, and the assertion above only "
        f"catches one that shares a table with a column grant."
    )

    # THE POSITIVE CONTROL ON THE READ ITSELF, which the conjunction needs more
    # than the old empty-set assertion did: it is satisfied by an empty
    # intersection, and two empty catalogs intersect emptily. Twenty-THREE
    # triggers and seventeen column grants, MEASURED at head 2026-09-05 — the
    # twenty-third is `0100`'s `audit_log_bind_actor`.
    assert len(triggers) == 23, (
        f"the trigger read returned {len(triggers)} rows, not 23 — wrong schema "
        f"name, or `tgisinternal` inverted. The collision assertion above passes "
        f"trivially on an empty read."
    )
    assert len(column_grants) == 17, (
        f"the column-ACL read returned {len(column_grants)} rows, not 17. The "
        f"collision assertion above passes trivially when this is empty, which is "
        f"what the schema looked like before 0032."
    )


# 🔴 THE `SECURITY DEFINER` FUNCTIONS `PUBLIC` CAN REACH, AND WHY THE ANSWER IS
# NOT "none". Both entries below return `trigger`, and PostgreSQL refuses a direct
# call to a trigger function — MEASURED as `titlepipe_app`:
# `ERROR: trigger functions can only be called as triggers`. So the grant reaches
# a function nobody can invoke.
#
# That is a THINNER MARGIN than the alternative and it is the finding rather than
# the contract: `0032` `REVOKE`s `EXECUTE ... FROM PUBLIC` on its own `SECURITY
# DEFINER` function before granting it to the app; `0041` does not, and what saves
# it is the return type. One of the two is a decision and the other is a
# coincidence that happens to hold.
#
# Named as an exact set so that a `SECURITY DEFINER` function which is NOT a
# trigger function cannot join them — that one really would be `PUBLIC` borrowing
# `titlepipe_owner`, which owns every table and can `DROP POLICY`.
SECURITY_DEFINER_REACHABLE_BY_PUBLIC = frozenset({"escalations_resolution_needs_a_live_rule"})


def test_no_security_definer_function_is_callable_by_public(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """🔴 THE HOLE IN THE EXACT-ACL CONTRACT, CLOSED FROM OUTSIDE IT.

    `CATALOG_ACL_QUERY` reads routines with `p.proacl IS NOT NULL`, and it has to:
    `EXECUTE` is granted to `PUBLIC` by PostgreSQL's own `acldefault`, so a
    function nobody has granted on carries a NULL `proacl` while `PUBLIC` really
    can execute it. Widening that query would add an entry for every function in
    the schema whose honest description is "PostgreSQL's default", and the
    contract would stop being a list of this repository's decisions.

    THE CONSEQUENCE IS THAT THE CONTRACT CANNOT SEE ELEVEN OF THIS REPOSITORY'S
    FUNCTIONS, and one of them is `SECURITY DEFINER`. MEASURED at head 2026-09-05:

        titlepipe_field_transition          secdef, proacl set,  PUBLIC: no
        escalations_resolution_needs_a_live_rule
                                            secdef, proacl NULL, PUBLIC: YES

    `0032` `REVOKE`s `EXECUTE ... FROM PUBLIC` before granting its `SECURITY
    DEFINER` function to the app. `0041` does not. A `SECURITY DEFINER` function
    runs as `titlepipe_owner`, which owns every table and can `DROP POLICY`, so
    "who may call it" is not a formality.

    WHAT STOPS IT MATTERING IS THE RETURN TYPE, WHICH IS A COINCIDENCE AND NOT A
    DECISION: it returns `trigger`, and PostgreSQL refuses a direct call. That is
    assertable, so it is asserted rather than left as a note.

    WHY `SECURITY INVOKER` IS NOT ON TRIAL HERE. Eleven of `0060`'s vendored queue
    functions are non-trigger and `PUBLIC`-executable —
    `procrastinate_defer_jobs_v1`, `procrastinate_fetch_job_v2` and the rest —
    and that is inert: none is `SECURITY DEFINER`, so each runs with the CALLER's
    privileges and a role with no `INSERT` on `procrastinate_jobs` still cannot
    enqueue by calling one. `0060` says so in the same words. Asserting them away
    would mean eighteen `REVOKE`s that change no privilege, and this test would
    then be about tidiness instead of about privilege.

    So the claim is exactly: NO `SECURITY DEFINER` FUNCTION IS CALLABLE BY
    `PUBLIC`. Borrowing the owner's identity is the only thing that makes an
    `EXECUTE` grant a privilege escalation, and `SECURITY DEFINER` is the only way
    to borrow it.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            reachable = connection.execute(
                text(
                    "SELECT p.proname, p.prosecdef, p.prorettype = 'trigger'::regtype "
                    "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                    "WHERE n.nspname = 'public' "
                    "  AND has_function_privilege('public', p.oid, 'EXECUTE')"
                )
            ).all()
    finally:
        engine.dispose()

    escalating = sorted(str(row[0]) for row in reachable if bool(row[1]) and not bool(row[2]))
    assert escalating == [], (
        "SECURITY DEFINER functions exist that PUBLIC can EXECUTE and that are "
        "not trigger functions, so PUBLIC can actually call them — and they run "
        "as titlepipe_owner, which owns every table and can DROP POLICY. A NULL "
        "proacl is invisible to EXACT_NON_OWNER_ACL, so nothing else here sees "
        "them. 0032 is the pattern: REVOKE EXECUTE FROM PUBLIC, then GRANT to the "
        "one role that needs it:\n  " + "\n  ".join(escalating)
    )

    # THE EXACT SET OF SECURITY DEFINER FUNCTIONS PUBLIC CAN REACH AT ALL, trigger
    # functions included. The assertion above tolerates one because it cannot be
    # called; this is what keeps that tolerance from silently covering a second,
    # and what makes `0041`'s missing REVOKE visible rather than merely harmless.
    definer_reachable = {str(row[0]) for row in reachable if bool(row[1])}
    assert definer_reachable == SECURITY_DEFINER_REACHABLE_BY_PUBLIC, (
        f"the SECURITY DEFINER functions PUBLIC can reach are "
        f"{sorted(definer_reachable)}, not "
        f"{sorted(SECURITY_DEFINER_REACHABLE_BY_PUBLIC)}. Each is saved from "
        f"mattering only by returning `trigger`, which is a property of the "
        f"signature rather than a decision anybody recorded — 0032 revokes, 0041 "
        f"does not, and this line is where that difference is visible."
    )

    # THE POSITIVE CONTROL on the read itself: an empty result satisfies both
    # assertions above and would mean `has_function_privilege` stopped answering.
    # `0060`'s GRANT to the worker materialises PostgreSQL's own PUBLIC default
    # alongside it, so the eighteen queue functions alone put PUBLIC on this list.
    assert len(reachable) >= 18, (
        f"only {len(reachable)} functions are PUBLIC-executable. 0060's eighteen "
        f"queue functions carry a materialised PUBLIC entry on their own, so a "
        f"number below that means the read is broken and both assertions above "
        f"passed on nothing."
    )

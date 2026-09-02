"""`audit_log` is append-only, proved BEHAVIOURALLY and for every role that exists.

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS: THE IMMUTABILITY GUARANTEE HAD NO TEST.
---------------------------------------------------------------------------
Before this module, the assertions about `audit_log` not being editable were:

* `test_forced_rls_and_grants.py::test_audit_log_is_granted_insert_but_never
  _update` — issues `UPDATE audit_log` as `titlepipe_app` and asserts `42501`.
  That is the **ACL** path. `0002` withholds `GRANT UPDATE`, so the privilege
  check refuses the statement before any trigger is consulted. **THAT TEST WOULD
  PASS WITH BOTH TRIGGERS DROPPED ENTIRELY**, which makes it a proof about the
  grant and not about immutability;
* `test_schema_migration.py`'s three behavioural tests — the real proof, but all
  three connect as the CONTAINER SUPERUSER (`migrated_database` yields
  `admin_dsn`). A superuser is exactly the identity for which the guarantee is
  admitted not to hold, so a reader cannot tell from them whether the refusal
  survives on a path anybody actually uses;
* `test_forced_rls_and_grants.py::test_the_append_only_trigger_still_answers_for
  _the_paths_the_acl_does_not` — same superuser connection.

WHAT THIS FILE ADDS, and each item is a hole one of the above leaves open:

1. **The owner-privileged path.** `titlepipe_migration` + `SET ROLE
   titlepipe_owner` is what `migrations/env.py` does before every statement of
   every migration, and the owner OWNS `audit_log` — so the ACL is not in the
   way and the refusal that comes back can only be the trigger's. This is the
   privileged path a real deployment has, as distinct from the container
   superuser it does not. UPDATE, DELETE and TRUNCATE, all three;
2. **The zero-row UPDATE on an EMPTY table.** The `FOR EACH STATEMENT` property
   was previously exercised only by a zero-MATCH update against a table with
   rows in it. Both are `FOR EACH ROW`-detecting, but the empty-table case is the
   one that pins the property with nothing else in the picture — no row exists
   for a row trigger to have fired on, so a passing refusal cannot be attributed
   to anything but the statement-level declaration. `0001`'s docstring called
   this out and nothing asserted it;
3. **`tgenabled` behaviourally, not just as a catalog value.**
   `test_schema_migration.py` reads the character. This proves what the character
   BUYS: that under `session_replication_role = 'replica'` the refusals still
   come. At `0001`'s `'O'` they did not — measured, and the reason `0004` exists;
4. **Every remaining role.** `titlepipe_worker`, `titlepipe_blind` and
   `titlepipe_migration` were assumed to be refused and never asked. Three roles
   x three verbs, plus INSERT, which is the one verb `audit_log` accepts and
   which must be refused for these three all the same — they hold no grant on it.

## The SQLSTATE is always asserted, and WHICH one is the whole content

Two codes, and confusing them is how a test in this area passes while proving
nothing:

* **`0A000`** (`feature_not_supported`) — the TRIGGER refused. This is the
  immutability guarantee firing;
* **`42501`** (`insufficient_privilege`) — the ACL refused, before the trigger
  ran. This is a grant being absent.

A test that accepted either would be satisfied by a database with no triggers on
it. So the owner-path tests require `0A000` specifically — the owner has every
privilege, so `42501` there would mean the `SET ROLE` silently failed — and the
unprivileged-role tests require `42501` specifically, and say so in their own
docstrings.

## Nothing here is skipped, and every write is rolled back

Same rules as the rest of the database suite: if Docker is unavailable these
FAIL. Every statement runs inside a connection that is rolled back, including the
INSERTs used to set up a non-empty table, so `audit_log` is left as each test
found it — the module-scoped `migrated_database` is shared.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError

# `feature_not_supported`, which `0001`'s trigger function raises by name. It is
# asserted rather than "something raised" because a misspelled column raises too
# (`42703`), a misspelled table raises too (`42P01`), and either would otherwise
# read as proof that the trigger works.
APPEND_ONLY_SQLSTATE = "0A000"

# `insufficient_privilege` — the ACL, which refuses BEFORE any trigger runs.
# Distinguished from the above everywhere in this file; see the module docstring.
INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501"

# The three verbs `audit_log` refuses from everybody, owner included.
#
# `TRUNCATE` is in the same list as the other two but goes through a SECOND
# trigger (`audit_log_no_truncate`) — PostgreSQL will not accept a `FOR EACH ROW`
# trigger naming TRUNCATE, so `0001` could not combine them without making the
# STATEMENT/ROW choice unrepresentable. Both call the same function, hence the
# same SQLSTATE, which is why one list covers all three.
REFUSED_STATEMENTS = (
    "UPDATE audit_log SET tenant_id = tenant_id",
    "DELETE FROM audit_log",
    "TRUNCATE audit_log",
)

# `INSERT` is the one verb the table accepts, and it is listed separately because
# its expected answer DEPENDS ON THE ROLE: the owner and `titlepipe_app` may
# insert, `titlepipe_worker`/`titlepipe_blind`/`titlepipe_migration` hold no
# grant and get `42501`.
INSERT_STATEMENT = "INSERT INTO audit_log (tenant_id) VALUES (gen_random_uuid())"

OWNER_ROLE = "titlepipe_owner"


def _sqlstate(error: DBAPIError) -> str | None:
    """The five-character SQLSTATE psycopg attached, if it attached one.

    `isinstance` rather than a bare `getattr`, which is the same guard
    `test_schema_migration.py` and `test_forced_rls_and_grants.py` use: `getattr`
    on a DBAPI exception returns whatever is there, and a comparison of `Any`
    against a string passes for a `None` as readily as for a code.
    """
    sqlstate = getattr(error.orig, "sqlstate", None)
    return sqlstate if isinstance(sqlstate, str) else None


def _refusal(engine: Engine, statement: str, *, setup: tuple[str, ...] = ()) -> DBAPIError:
    """Run `statement`, require that it raised, hand back the error. Always rolls back.

    `setup` runs first on the same connection and is NOT expected to raise — it is
    how a test gets a row into `audit_log` before trying to update it. The whole
    thing is rolled back either way, so the table is left as it was found for the
    next test in this module-scoped database.
    """
    with engine.connect() as connection:
        for preparatory in setup:
            connection.execute(text(preparatory))
        with pytest.raises(DBAPIError) as raised:
            connection.execute(text(statement))
        connection.rollback()
    return raised.value


def _as_owner(engine: Engine, statement: str, *, setup: tuple[str, ...] = ()) -> DBAPIError:
    """`_refusal`, with `SET ROLE titlepipe_owner` first and CHECKED.

    The check is not ceremony. `SET ROLE` failing raises `42501`, and `42501` is
    also what an ACL refusal looks like — so an unverified `SET ROLE` turns
    "the owner was refused by the trigger" into a test that cannot tell that
    apart from "we never became the owner". `current_user` is read back and
    asserted before the statement under test runs.

    Connecting AS `titlepipe_owner` is impossible by design: `roles.sql` makes it
    NOLOGIN precisely so ownership sits on a role nothing authenticates as. The
    route in is `titlepipe_migration`, which holds the owner `WITH INHERIT FALSE,
    SET TRUE` — exactly the one membership edge `roles.sql` grants, and exactly
    what `migrations/env.py` does.
    """
    with engine.connect() as connection:
        connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
        who = connection.execute(text("SELECT current_user")).scalar_one()
        assert who == OWNER_ROLE, (
            f"SET ROLE did not take: this ran as {who!r}, so whatever the "
            f"statement below returns says nothing about the owner's path"
        )
        for preparatory in setup:
            connection.execute(text(preparatory))
        with pytest.raises(DBAPIError) as raised:
            connection.execute(text(statement))
        connection.rollback()
    return raised.value


# --- 1. the owner-privileged path -------------------------------------------


@pytest.mark.parametrize("statement", list(REFUSED_STATEMENTS))
def test_the_owner_is_refused_update_delete_and_truncate_by_the_trigger(
    statement: str,
    migrated_database: str,
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE TEST THE IMMUTABILITY GUARANTEE DID NOT HAVE.

    `titlepipe_migration` + `SET ROLE titlepipe_owner` is the most privileged
    path this system actually has — it is what every migration runs as, and the
    owner OWNS `audit_log`, so there is no grant missing and no ACL to hide
    behind. The refusal that comes back is therefore the TRIGGER's and can be
    nothing else.

    Contrast `test_forced_rls_and_grants.py::test_audit_log_is_granted_insert_but
    _never_update`, which is the only other role-based assertion in this area:
    it reads `42501` as `titlepipe_app`, which is the ACL refusing, and would
    pass unchanged with both triggers dropped. This one would go red the instant
    either trigger stopped existing, stopped firing, or stopped raising `0A000`.

    All three verbs are parametrised rather than looped in one body, because a
    loop reports the first failure and stops — and "UPDATE is refused but
    TRUNCATE is not" is precisely the partial breakage worth seeing whole. The
    TRUNCATE case additionally covers the SECOND trigger,
    `audit_log_no_truncate`, which no other test in this file reaches on its own.
    """
    engine = seam_engine(migration_dsn)
    try:
        error = _as_owner(engine, statement)
    finally:
        engine.dispose()

    assert _sqlstate(error) == APPEND_ONLY_SQLSTATE, (
        f"expected the append-only trigger's {APPEND_ONLY_SQLSTATE} for "
        f"{statement!r} as {OWNER_ROLE}, got {_sqlstate(error)}: {error}. "
        f"{INSUFFICIENT_PRIVILEGE_SQLSTATE} here would mean the ACL refused, "
        f"which for the table's own owner would mean the SET ROLE did not take."
    )
    assert "append-only" in str(error), (
        f"{APPEND_ONLY_SQLSTATE} came back from something other than the "
        f"append-only function: {error}"
    )


def test_the_owner_is_refused_a_zero_row_update_on_an_empty_audit_log(
    migrated_database: str,
    migration_dsn: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 THE `FOR EACH STATEMENT` PROPERTY, PINNED RATHER THAN INFERRED.

    `0001`'s docstring calls the STATEMENT-versus-ROW choice load-bearing: a row
    trigger fires once per affected row, so it does not fire AT ALL when a
    statement affects none — and under `0002`'s `FORCE ROW LEVEL SECURITY` a
    cross-tenant UPDATE matches exactly zero rows. `FOR EACH ROW` would therefore
    be SILENT for the one case the trigger exists to refuse.

    `test_schema_migration.py::test_audit_log_refuses_an_update_that_matches_no
    _rows` exercises a zero-MATCH update. This is the stricter case and the one
    the prior work only inferred: the table is EMPTY, asserted empty before the
    statement runs, so there is no row anywhere for a row-level trigger to have
    fired on. A refusal here is attributable to the statement-level declaration
    and to nothing else.

    THE EMPTINESS IS ASSERTED RATHER THAN ASSUMED, AND IT IS READ THROUGH A
    CONNECTION THAT CAN SEE. This module's database is module-scoped and shared;
    every test here rolls back, but a future one that forgets would turn this
    silently into a duplicate of the matching-row case. The count is taken on the
    SUPERUSER connection (`migrated_database`), which bypasses row-level security
    — the owner's own count under `0002`'s FORCE is zero for every possible table
    state, so asserting on it would be asserting nothing at all. `row_security =
    off` is not an option either: for the owner it makes a WRITE loud rather than
    permitted, and the reads it does permit are the same reads FORCE already
    allows.
    """
    counter = seam_engine(migrated_database)
    try:
        with counter.connect() as connection:
            rows = connection.execute(text("SELECT count(*) FROM audit_log")).scalar_one()
    finally:
        counter.dispose()

    assert rows == 0, (
        f"audit_log holds {rows} rows, so this is no longer the EMPTY-table "
        f"case it exists to be. Some earlier test in this module left a row "
        f"behind — every write here must be rolled back."
    )

    engine = seam_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
            who = connection.execute(text("SELECT current_user")).scalar_one()
            assert who == OWNER_ROLE, f"SET ROLE did not take: ran as {who!r}"

            with pytest.raises(DBAPIError) as raised:
                connection.execute(text("UPDATE audit_log SET tenant_id = tenant_id"))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == APPEND_ONLY_SQLSTATE, (
        f"an UPDATE against an EMPTY audit_log returned "
        f"{_sqlstate(raised.value)} rather than {APPEND_ONLY_SQLSTATE}. If it "
        f"returned nothing at all the trigger is FOR EACH ROW, which is silent "
        f"when no row is affected — the exact case 0001 chose FOR EACH STATEMENT "
        f"for: {raised.value}"
    )


def test_the_owner_is_still_permitted_to_insert(
    migrated_database: str,
    migration_dsn: str,
    tenant_guc: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """The positive control, without which every refusal above is uninformative.

    A table nobody can write to at all satisfies every assertion in this file.
    APPEND-only means the append still works: this inserts as the owner, reads
    the row back on the same connection, and rolls the whole thing away.

    🔴 THE TENANT IS ESTABLISHED, AND THE FIRST VERSION OF THIS TEST DID NOT DO
    THAT AND FAILED — usefully. It tried `SET LOCAL row_security = off` first, by
    analogy with the read side, and got

        42501 query would be affected by row-level security policy for table
        "audit_log"
        HINT: To disable the policy for the table's owner, use ALTER TABLE NO
        FORCE ROW LEVEL SECURITY.

    which is `0002`'s FORCE working exactly as designed and as
    `test_forced_rls_and_grants.py::test_a_migration_shaped_write_is_a_silent_no
    _op_until_it_says_so` documents: `row_security = off` does not PERMIT the
    owner's write, it makes the refusal LOUD instead of silent. The way to write
    a row is to be a tenant, which is what the application does — `SET LOCAL` on
    `app.current_tenant` and an insert whose `tenant_id` satisfies the policy's
    `WITH CHECK`.

    So this control now goes through the same door the real write path uses,
    which makes it a better control than the one that was attempted: it proves
    the append works under the policy rather than around it.
    """
    engine = seam_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {OWNER_ROLE}"))
            tenant = connection.execute(text("SELECT gen_random_uuid()")).scalar_one()
            # `SET LOCAL` with a bind parameter is not accepted — the value must
            # be a literal — so `set_config` is used, which is the function form
            # of the same statement and DOES take parameters. `true` is the
            # `is_local` argument, making it transaction-scoped exactly as
            # `SET LOCAL` would.
            connection.execute(
                text("SELECT set_config(:guc, :tenant, true)"),
                {"guc": tenant_guc, "tenant": str(tenant)},
            )
            inserted = connection.execute(
                text("INSERT INTO audit_log (tenant_id) VALUES (:tenant) RETURNING id"),
                {"tenant": tenant},
            ).scalar_one()
            visible = connection.execute(
                text("SELECT count(*) FROM audit_log WHERE id = :id"), {"id": inserted}
            ).scalar_one()
            connection.rollback()
    finally:
        engine.dispose()

    assert visible == 1, (
        "the owner's INSERT did not land under an established tenant. audit_log "
        "is APPEND-only: if the append itself is refused, every refusal test in "
        "this file is passing for the wrong reason."
    )


# --- 2. tgenabled, behaviourally --------------------------------------------


@pytest.mark.parametrize("statement", list(REFUSED_STATEMENTS))
def test_the_append_only_triggers_hold_under_session_replication_role_replica(
    statement: str,
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """🔴 WHAT `0004`'s `tgenabled = 'A'` ACTUALLY BUYS.

    `session_replication_role = 'replica'` switches OFF every trigger whose
    `tgenabled` is `'O'` — the `CREATE TRIGGER` default, and what `0001` left
    behind. MEASURED 2026-09-02 against `postgres:18.4` on `0001`'s exact trigger
    pair, before `0004`:

        SET session_replication_role = 'replica';
        SELECT count(*) FROM probe_audit;   ->  1
        DELETE FROM probe_audit;            ->  DELETE 1     🔴 no refusal
        SELECT count(*) FROM probe_audit;   ->  0

    So the append-only guarantee was, for any session in replica mode, simply
    absent. `0004` moves both triggers to `'A'` (ALWAYS), and this is the
    behavioural proof that the character does what the migration says.

    THIS IS NOT A DUPLICATE OF `test_schema_migration.py::test_audit_logs
    _triggers_are_statement_level_before_and_enabled`. That test reads
    `tgenabled` and compares it to `'A'`, which is a CATALOG claim; a trigger can
    be `'A'` and raise nothing. This runs the statements and reads the SQLSTATE
    back, in the replication role where the difference between `'A'` and `'O'` is
    the entire question. Both are kept: the catalog test says WHICH of the four
    ways it broke, this one says THAT it broke.

    THE CONNECTION IS THE CONTAINER SUPERUSER, DELIBERATELY, and it is the one
    test in this file for which that is the right identity rather than a
    weakness. `session_replication_role` is `SUSET`: no TitlePipe role may enter
    replica mode in-session at all (`titlepipe_app` and `titlepipe_migration` get
    `42501`, which `roles.sql`'s commentary records). The hazard is a session
    that IS in replica mode — planted by a per-role default, or a superuser, or a
    restore — and the superuser is the only identity from which that state can be
    reached to test what happens inside it.
    """
    engine = seam_engine(migrated_database)
    try:
        with engine.connect() as connection:
            connection.execute(text("SET session_replication_role = 'replica'"))
            mode = connection.execute(
                text("SELECT current_setting('session_replication_role')")
            ).scalar_one()
            assert mode == "replica", (
                f"session_replication_role is {mode!r}, so this test never "
                f"entered the state it exists to exercise"
            )

            # A row, so DELETE and UPDATE have something to remove: at 'O' the
            # measured failure was a DELETE that SUCCEEDED and emptied the table,
            # and a refusal against an empty table cannot be told from that.
            connection.execute(text(INSERT_STATEMENT))

            with pytest.raises(DBAPIError) as raised:
                connection.execute(text(statement))
            connection.rollback()
    finally:
        engine.dispose()

    assert _sqlstate(raised.value) == APPEND_ONLY_SQLSTATE, (
        f"{statement!r} was not refused with {APPEND_ONLY_SQLSTATE} under "
        f"session_replication_role = 'replica'; got {_sqlstate(raised.value)}. "
        f"If nothing raised at all, the triggers are back at tgenabled = 'O' and "
        f"0004 has been reverted or downgraded: {raised.value}"
    )


# --- 3. the three roles that were assumed and never asked -------------------


@pytest.mark.parametrize("statement", [*REFUSED_STATEMENTS, INSERT_STATEMENT])
@pytest.mark.parametrize("role_fixture", ["worker_role", "blind_role", "migration_role"])
def test_the_unprivileged_roles_cannot_touch_audit_log_at_all(
    role_fixture: str,
    statement: str,
    request: pytest.FixtureRequest,
    migrated_database: str,
    role_dsn: Callable[[str, str, str], str],
    role_passwords: Mapping[str, str],
    seam_engine: Callable[[str], Engine],
) -> None:
    """The assumed-but-untested cases, executed. Four verbs x three roles.

    `titlepipe_worker` and `titlepipe_blind` are granted NOTHING on any table by
    `0002` or `0003` — both revisions say so in as many words — and
    `titlepipe_migration` is granted nothing either: it reaches the schema by
    `SET ROLE titlepipe_owner`, not by holding privileges of its own. That was
    stated in three places and asserted for `audit_log` in none.

    **THE EXPECTED CODE IS `42501` AND NOT `0A000`, AND THAT IS THE FINDING
    RATHER THAN A WEAKER TEST.** The privilege check runs BEFORE any trigger, so
    for a role holding no grant the ACL answers first and the trigger is never
    consulted. Asserting `0A000` here would be asserting the wrong control and
    would fail against a correct database.

    `INSERT` is in the list for the same reason the other three are: it is the
    one verb `audit_log` accepts, `0002` grants it to `titlepipe_app` alone, and
    "these roles cannot write audit entries" is a claim worth holding to. A role
    that could insert could forge history even while unable to edit it.

    The role is taken by FIXTURE NAME through `request.getfixturevalue` rather
    than by literal, so the names come from `conftest.py` — the seam — and a role
    renamed there fails here instead of silently testing a role that no longer
    exists. (A non-existent role would fail to authenticate, which is a different
    error entirely and would not read as a refusal.)
    """
    role = request.getfixturevalue(role_fixture)
    engine = seam_engine(role_dsn(migrated_database, role, role_passwords[role]))
    try:
        error = _refusal(engine, statement)
    finally:
        engine.dispose()

    assert _sqlstate(error) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"{role} ran {statement!r} against audit_log and got "
        f"{_sqlstate(error)} rather than {INSUFFICIENT_PRIVILEGE_SQLSTATE}. "
        f"That role holds no grant on this table, so the ACL must refuse it "
        f"before any trigger is reached: {error}"
    )
    assert "audit_log" in str(error), (
        f"{INSUFFICIENT_PRIVILEGE_SQLSTATE} came back naming something other "
        f"than audit_log, so this says nothing about that table: {error}"
    )


def test_the_unprivileged_roles_cannot_disable_the_triggers(
    migrated_database: str,
    worker_role: str,
    role_dsn: Callable[[str, str, str], str],
    role_passwords: Mapping[str, str],
    seam_engine: Callable[[str], Engine],
) -> None:
    """The other way to defeat append-only: switch the triggers off rather than write.

    `ALTER TABLE audit_log DISABLE TRIGGER ALL` leaves `tgtype` untouched and
    sets `tgenabled` to `'D'`, after which every refusal in this file stops
    happening — `test_schema_migration.py`'s trigger-facts test records that this
    is exactly how a `tgtype`-only check passed against a disabled trigger.

    `ALTER TABLE` requires OWNERSHIP, not a privilege, so this must be refused for
    every role that is not the owner. `titlepipe_worker` stands for the set: it
    holds nothing at all, so a success here would mean ownership itself had
    moved.
    """
    engine = seam_engine(role_dsn(migrated_database, worker_role, role_passwords[worker_role]))
    try:
        error = _refusal(engine, "ALTER TABLE audit_log DISABLE TRIGGER ALL")
    finally:
        engine.dispose()

    assert _sqlstate(error) == INSUFFICIENT_PRIVILEGE_SQLSTATE, (
        f"{worker_role} was not refused ALTER TABLE ... DISABLE TRIGGER ALL "
        f"with {INSUFFICIENT_PRIVILEGE_SQLSTATE}; got {_sqlstate(error)}. A "
        f"role that can disable the triggers can edit history freely: {error}"
    )

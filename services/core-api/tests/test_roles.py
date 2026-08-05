"""The five roles, read back from the catalog rather than from a list in here.

`migrations/sql/roles.sql` is applied once per session by the `roles_applied`
fixture. Every test that needs a role to exist requests it, including the two in
`test_database_seam.py` that Task 2 inverted, so this file's result does not
depend on collection order — see that fixture's docstring.

Everything below enumerates the live catalog. A test that iterated a list of
role names written in this file would be checking that this file agrees with
itself; `roles.sql` could create a sixth role with `BYPASSRLS` and nothing here
would notice. The names it compares AGAINST come from `conftest.py` fixtures,
which is the seam, not from literals here.

THREE KINDS OF ASSERTION LIVE HERE, and mixing them up is how this file has
already been wrong twice:

  * CONTRACT — the five roles exist, none is a superuser, none has BYPASSRLS,
    the owner cannot log in;
  * CONVERGENCE — `roles.sql` REPAIRS a cluster somebody has meddled with. It is
    not the same claim as idempotence, and it is the one the review found
    missing: the script created correctly, re-ran cleanly, and left a stray
    `GRANT titlepipe_owner TO titlepipe_app` in place while reporting success;
  * SUFFICIENCY OF THE ASSERTIONS THEMSELVES — the cardinality floor catches an
    empty catalog, set containment catches a wrong one. A floor alone is
    satisfied by five decoys.

Nothing here is skipped. If Docker or `psql` is unavailable these tests FAIL.

Several tests deliberately break the server and put it back — revoking `CREATE
ON SCHEMA public`, granting a stray membership, drifting role attributes,
creating a `dba` role. That is safe for exactly one reason: the database is an
EPHEMERAL CONTAINER that exists for this pytest session and is destroyed with
it. None of it would be acceptable against a cluster anybody owns. Each such
test restores what it changed in a `finally`, because the tests after it share
the session.
"""

from __future__ import annotations

import re
import subprocess
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import NamedTuple

import pytest
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

# The cardinality floor. Asserted BEFORE any per-role property, because every
# such property is vacuously true over an empty catalog — which is precisely
# what a `roles.sql` that silently did nothing would produce.
#
# NECESSARY AND NOT SUFFICIENT. On its own it is satisfied by five roles with
# the wrong NAMES, and the per-row loop after it would then pass over five
# decoys while two of the real roles were missing. The set-containment
# assertion beside it is what catches that; each catches a failure the other
# cannot see, so both stay.
MINIMUM_TITLEPIPE_ROLES = 5

# `PASSWORD` in `roles.sql`'s CODE may be followed by exactly two things: `%L`,
# which is `format()` quoting a value interpolated from the environment, or
# `NULL`, which is the owner's cleared verifier. Anything else — a quoted
# literal, a dollar-quoted string, a bare word — is a password written into the
# file.
#
# Comment lines are stripped before this runs. The file's own commentary quotes
# `ALTER ROLE ... PASSWORD '...'` when explaining what it defends against, and a
# check that flagged the documentation of the rule is a check that gets deleted
# — the same reasoning `scripts/check_backend_rules.py` parses rather than greps
# for.
#
# CASE-SENSITIVE, and that is a real limitation rather than an oversight. The
# refusal message inside `roles.sql` is CODE, not a comment, and it contains the
# English words "password environment variable(s)" — an `IGNORECASE` scan
# reported `PASSWORD ENVIRONMENT` as a hardcoded credential. SQL keywords in
# that file are uppercase throughout, so the keyword and the prose are
# distinguishable by case, and `PASSWORD_ANY_CASE_LITERAL` below covers the
# residual: a lowercase `password` immediately followed by a quote is a literal
# whatever the surrounding style.
PASSWORD_OPERAND = re.compile(r"\bPASSWORD\s+(\S+)")
PASSWORD_ANY_CASE_LITERAL = re.compile(r"\bpassword\b\s*['$]", re.IGNORECASE)
ALLOWED_PASSWORD_OPERANDS = frozenset({"%L", "NULL"})
# Trailing characters that belong to the surrounding `format()` call rather than
# to the operand: `PASSWORD %L', wanted.role, ...` ends the SQL string right
# after `%L`.
OPERAND_TRAILERS = "',;)"

# Tables created and rolled back inside the ownership tests. Neither reaches the
# catalog beyond the transaction that made it.
#
# `alembic_version` is spelled with its real name deliberately. It is the first
# table Alembic creates, it is created outside any migration script, and Task 3
# depends on it landing on `titlepipe_owner` like everything else — so it is
# checked by name rather than inferred from a probe table that happens to
# behave the same way.
OWNERSHIP_PROBE_TABLE = "task2_ownership_probe"
ALEMBIC_VERSION_TABLE = "alembic_version"


class RoleAttributes(NamedTuple):
    """The catalog columns this task's contract is written in.

    The last three are convergence rather than contract. Each was a hole:
    `has_password` because `NOLOGIN` plus a surviving verifier is a credential
    one `ALTER ROLE ... LOGIN` away from working, and `valid_until` /
    `connection_limit` because a drifted value converged to "correct attributes,
    cannot connect" while `roles.sql` reported success.
    """

    is_superuser: bool
    bypasses_rls: bool
    can_log_in: bool
    has_password: bool
    valid_until: str | None
    connection_limit: int


def _titlepipe_roles(connection: Connection, pattern: str) -> dict[str, RoleAttributes]:
    """Every `titlepipe_*` role the live catalog holds. The only authority here.

    `pg_authid` rather than `pg_roles`, because `pg_roles` blanks `rolpassword`
    to `********` for everyone — it is a view whose whole purpose is to hide the
    verifier. Asserting the owner has NO password needs the real column, and
    that means the superuser connection.
    """
    result = connection.execute(
        text(
            # `rolvaliduntil::text` and not the timestamptz itself. MEASURED
            # 2026-08-05: `VALID UNTIL 'infinity'` is a real timestamptz value
            # that has no Python equivalent, and psycopg refuses it with
            # `DataError: timestamp too large (after year 10K): 'infinity'`.
            # Casting in SQL keeps the comparison on the server's own spelling,
            # which is also the one an operator would type.
            "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, "
            "rolpassword IS NOT NULL, rolvaliduntil::text, rolconnlimit "
            "FROM pg_authid WHERE rolname LIKE :pattern"
        ),
        {"pattern": pattern},
    )
    return {
        str(row[0]): RoleAttributes(
            bool(row[1]),
            bool(row[2]),
            bool(row[3]),
            bool(row[4]),
            None if row[5] is None else str(row[5]),
            int(row[6]),
        )
        for row in result
    }


def _catalog(dsn: str, pattern: str) -> dict[str, RoleAttributes]:
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            return _titlepipe_roles(connection, pattern)
    finally:
        engine.dispose()


def _owner_members(dsn: str, owner_role: str) -> list[tuple[str, str, bool, bool]]:
    """Every `pg_auth_members` row for `owner_role`: (member, grantor, inherit, set).

    EVERY row, deliberately. The previous version of this read ended in `.one()`,
    so a second membership granted by a different grantor raised
    `MultipleResultsFound` — a SQLAlchemy error about result shape, not an
    assertion about privilege, and the thing it was supposed to detect was
    exactly "there is more than one row".
    """
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    "SELECT member.rolname, grantor.rolname, am.inherit_option, am.set_option "
                    "FROM pg_auth_members am "
                    "JOIN pg_roles owner ON owner.oid = am.roleid "
                    "JOIN pg_roles member ON member.oid = am.member "
                    "JOIN pg_roles grantor ON grantor.oid = am.grantor "
                    "WHERE owner.rolname = :owner"
                ),
                {"owner": owner_role},
            )
            return [(str(r[0]), str(r[1]), bool(r[2]), bool(r[3])) for r in result]
    finally:
        engine.dispose()


def _relation_owner(connection: Connection, relation: str) -> str:
    """The role name in `pg_class.relowner`, which is what `CREATE TABLE` sets."""
    result = connection.execute(
        text(
            "SELECT pg_get_userbyid(c.relowner) FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE c.relname = :relation AND n.nspname = 'public'"
        ),
        {"relation": relation},
    )
    return str(result.scalar_one())


def test_roles_sql_reads_every_password_from_a_named_environment_variable(
    roles_sql_path: Path, role_password_variables: Mapping[str, str], owner_role: str
) -> None:
    """The contract that no password is a literal, asserted against the file.

    TWO INDEPENDENT CHECKS, because the first one alone did not do what its
    docstring claimed. It said it would catch a file "that had grown a hardcoded
    password beside a `\\getenv` it no longer used"; it would not. Keeping all
    four `\\getenv` lines and adding `CREATE ROLE titlepipe_app LOGIN PASSWORD
    'hunter2'` left the set equality untouched and the test green. So:

    1. the set of variables read from the environment is EXACTLY the set the
       harness injects — `in` checks would pass a file reading a fifth variable
       nobody declared;
    2. every `PASSWORD` operand in the file's CODE is `%L` or `NULL`. This is
       the one that actually catches a literal, and it catches the bare-word and
       dollar-quoted spellings too.

    Comment lines are stripped before (2), because the file's own commentary
    quotes `ALTER ROLE ... PASSWORD '...'` while explaining the attack. Flagging
    the documentation of a rule is how the rule gets deleted.

    `titlepipe_owner` is checked negatively: it is `NOLOGIN`, so a
    `TITLEPIPE_OWNER_PASSWORD` appearing here would be an unused credential to
    rotate and a sign the NOLOGIN decision had been reversed.
    """
    source = roles_sql_path.read_text(encoding="utf-8")

    read_from_environment = {
        line.split()[-1] for line in source.splitlines() if line.startswith("\\getenv ")
    }

    assert read_from_environment == set(role_password_variables.values())
    assert f"{owner_role.upper()}_PASSWORD" not in source

    code = "\n".join(line for line in source.splitlines() if not line.lstrip().startswith("--"))
    operands = [
        operand.rstrip(OPERAND_TRAILERS).upper() for operand in PASSWORD_OPERAND.findall(code)
    ]

    assert operands, "no PASSWORD clause found at all; this check has stopped checking"
    for operand in operands:
        assert operand in ALLOWED_PASSWORD_OPERANDS, (
            f"roles.sql has `PASSWORD {operand}` in code. A password must come "
            f"from the environment via format()'s %L, or be NULL for the owner."
        )

    assert PASSWORD_ANY_CASE_LITERAL.search(code) is None, (
        "roles.sql has a password immediately followed by a quote in code; that "
        "is a literal however it is capitalised"
    )


def test_roles_sql_creates_five_powerless_roles_and_a_nologin_owner(
    roles_applied: str,
    owner_role: str,
    managed_roles: tuple[str, ...],
    titlepipe_role_pattern: str,
) -> None:
    """The whole role contract, enumerated from the catalog.

    THREE GUARDS, IN ORDER, AND EACH CATCHES SOMETHING THE OTHERS CANNOT:

    1. the CARDINALITY FLOOR catches an EMPTY catalog. Every assertion after it
       is a `for` over the rows, and a `for` over nothing passes — without the
       floor, deleting the body of `roles.sql` turns this test green;
    2. SET CONTAINMENT catches a WRONG catalog. The floor counts matches of a
       LIKE pattern, so five roles with the wrong names satisfy it and the loop
       then passes over five decoys while two real roles are missing. This test
       was the designated proof of the role contract and it had that hole;
    3. the PER-ROW LOOP catches a POWERFUL catalog — the right roles with the
       wrong privileges.

    The expected names come from `conftest.py`'s fixtures, not from a list in
    this file. The rows come from the live server. Neither side is written here,
    which is what keeps this a comparison rather than a restatement.

    `rows[owner_role]` is only indexed after containment has been asserted; a
    `KeyError` is an error, and a missing owner is a contract failure.
    """
    rows = _catalog(roles_applied, titlepipe_role_pattern)
    expected = set(managed_roles) | {owner_role}

    assert len(rows) >= MINIMUM_TITLEPIPE_ROLES, (
        f"expected at least {MINIMUM_TITLEPIPE_ROLES} titlepipe_* roles, "
        f"found {sorted(rows)}. Every assertion below is vacuous over a short catalog."
    )
    assert expected <= set(rows), (
        f"roles.sql must create {sorted(expected)}; the catalog is missing "
        f"{sorted(expected - set(rows))}. A count alone is satisfied by decoys."
    )

    for name, attributes in sorted(rows.items()):
        assert attributes.is_superuser is False, f"{name} is a superuser"
        # The one that matters. A superuser or a BYPASSRLS role ignores every
        # policy Task 4 writes, and does so silently.
        assert attributes.bypasses_rls is False, f"{name} has BYPASSRLS"
        # Converged, not contractual — but a role that cannot connect breaks the
        # system just as completely as one with too much power, and both drifts
        # used to survive a rerun that reported success.
        assert attributes.valid_until == "infinity", (
            f"{name} has VALID UNTIL {attributes.valid_until}"
        )
        assert attributes.connection_limit == -1, (
            f"{name} has CONNECTION LIMIT {attributes.connection_limit}"
        )

    assert rows[owner_role].can_log_in is False, (
        f"{owner_role} owns every table, and a table's owner bypasses RLS unless "
        f"FORCE is set. It must not be connectable."
    )
    assert rows[owner_role].has_password is False, (
        f"{owner_role} has a password verifier in pg_authid. NOLOGIN plus a live "
        f"verifier is one ALTER ROLE ... LOGIN away from being a usable "
        f"credential for the role that owns every table."
    )


def test_every_login_role_can_connect_with_its_own_password(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    role_dsn: Callable[[str, str, str], str],
) -> None:
    """The passwords `roles.sql` set are the passwords the harness generated.

    Task 1 asserted the negative — these DSNs could not connect, because the
    roles did not exist. This is the positive it said Task 2 would turn it into.
    Without it, `ALTER ROLE ... PASSWORD` could be silently absent from
    `roles.sql` and every catalog assertion above would still pass.
    """
    for role, password in role_passwords.items():
        engine = create_engine(role_dsn(roles_applied, role, password))
        try:
            with engine.connect() as connection:
                assert str(connection.execute(text("SELECT current_user")).scalar_one()) == role
        finally:
            engine.dispose()


def test_the_owner_is_not_connectable_over_the_wire(
    roles_applied: str, owner_role: str, role_dsn: Callable[[str, str, str], str]
) -> None:
    """NOLOGIN at the wire, not only in the catalog.

    What this CANNOT prove is WHY the connection failed. MEASURED 2026-08-05
    against postgres:18.4: a `NOLOGIN` role with no password is refused with
    `password authentication failed for user "titlepipe_owner"` — the same
    message a wrong password gets, on purpose, so that a stranger cannot
    enumerate roles or their login status. `rolcanlogin` is asserted from the
    catalog in the test above and that is the authority on it; this asserts
    non-connectability, and that is all it claims.

    The password below is not the owner's — the owner has none. It is a
    deliberately wrong one, which is the only kind there is for this role.
    """
    engine = create_engine(role_dsn(roles_applied, owner_role, "there-is-no-owner-password"))
    try:
        with pytest.raises(OperationalError) as raised, engine.connect():
            pass
    finally:
        engine.dispose()

    assert owner_role in str(raised.value)


def test_roles_sql_is_idempotent(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    titlepipe_role_pattern: str,
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
) -> None:
    """A second run against a cluster that already has all five is a no-op.

    `roles_applied` has already run it once, so this is genuinely the second
    application and not the first. The catalog is compared before and after
    rather than only checking the exit status: a run that exited 0 having
    dropped and recreated a role with different attributes would pass on the
    status alone.
    """
    before = _catalog(roles_applied, titlepipe_role_pattern)

    result = apply_roles_sql(roles_applied, role_passwords)

    assert result.returncode == 0, f"second run exited {result.returncode}:\n{result.stderr}"
    assert _catalog(roles_applied, titlepipe_role_pattern) == before


def test_roles_sql_refuses_and_names_every_variable_it_is_missing(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    role_password_variables: Mapping[str, str],
    titlepipe_role_pattern: str,
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
) -> None:
    """Unset, exported-empty and whitespace-only are all failures, each named.

    Three cases, three different mechanisms, all measured against psql 18.4:

      * UNSET — `\\getenv` leaves the psql variable undefined, which `\\if
        :{?name}` can see;
      * EXPORTED EMPTY — `\\getenv` sets it to the empty string, which `\\if`
        CANNOT tell from a real value. A guard written with `\\if` alone would
        accept `TITLEPIPE_APP_PASSWORD=` and create a role with an empty
        password;
      * WHITESPACE-ONLY — `TITLEPIPE_APP_PASSWORD='   '` is a typo, not a
        credential, and it used to produce five roles and exit 0. `btrim` in the
        guard is what stops it.

    Naming the OTHER variables is asserted negatively. A refusal that listed all
    four whatever was wrong would satisfy a positive check while telling the
    operator nothing about which one they forgot.

    The catalog is re-read afterwards: `ON_ERROR_STOP` is what makes the refusal
    a refusal rather than a warning printed before the roles are created anyway.
    """
    unchanged = _catalog(roles_applied, titlepipe_role_pattern)

    for withheld in role_passwords:
        cases = (
            ({role: pw for role, pw in role_passwords.items() if role != withheld}, "unset"),
            ({**role_passwords, withheld: ""}, "exported empty"),
            ({**role_passwords, withheld: "   "}, "whitespace-only"),
        )

        for supplied, how in cases:
            result = apply_roles_sql(roles_applied, supplied)

            assert result.returncode != 0, (
                f"{role_password_variables[withheld]} {how}, and roles.sql ran anyway"
            )
            assert role_password_variables[withheld] in result.stderr, (
                f"the refusal does not name the {how} variable:\n{result.stderr}"
            )
            for other in role_passwords:
                if other != withheld:
                    assert role_password_variables[other] not in result.stderr

            assert _catalog(roles_applied, titlepipe_role_pattern) == unchanged, (
                "the refusal did not stop the script"
            )


def test_only_the_migration_role_can_become_the_owner(
    roles_applied: str,
    migration_dsn: str,
    migration_role: str,
    owner_role: str,
) -> None:
    """🔴 THE MEMBERSHIP CONTRACT: the member set is EXACTLY `{titlepipe_migration}`.

    SET EQUALITY, not `in`. The previous version of this test read
    `pg_auth_members` only to check the OPTIONS of the one row it already
    expected to find, so it never noticed an EXTRA row — and nothing else in the
    suite read the member set at all. MEASURED 2026-08-05 against the unfixed
    `roles.sql`: one hand-written `GRANT titlepipe_owner TO titlepipe_app`
    survived every rerun, after which `titlepipe_app` could `SET ROLE
    titlepipe_owner` and create tables owned by the owner. A LOGIN role able to
    become the owner defeats the entire five-role split, and the script reported
    success the whole time.

    EVERY row's options are checked, not one row's. The second measured hole was
    a row from a DIFFERENT GRANTOR: re-granting only updates the same grantor's
    row, so a `dba` with `ADMIN OPTION` could add an `INHERIT TRUE` row beside
    ours and `titlepipe_migration` would create tables it owned itself. Reading
    that with `.one()` — as this test used to — raises `MultipleResultsFound`,
    a result-shape error rather than a privilege assertion, for the exact
    condition being detected.

    `pg_has_role(..., 'USAGE')` asks "do the owner's privileges apply right
    now"; `'MEMBER'` asks "could it SET ROLE". They must differ.
    """
    rows = _owner_members(roles_applied, owner_role)

    assert {member for member, _, _, _ in rows} == {migration_role}, (
        f"only {migration_role} may be a member of {owner_role}; found "
        f"{sorted((member, grantor) for member, grantor, _, _ in rows)}"
    )
    for member, grantor, inherits, can_set in rows:
        assert inherits is False, f"{member} inherits {owner_role} (granted by {grantor})"
        assert can_set is True, f"{member} cannot SET ROLE {owner_role} (granted by {grantor})"

    engine = create_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            effective = connection.execute(
                text(
                    "SELECT pg_has_role(current_user, :owner, 'MEMBER'), "
                    "pg_has_role(current_user, :owner, 'USAGE'), "
                    "has_schema_privilege(current_user, 'public', 'CREATE')"
                ),
                {"owner": owner_role},
            ).one()
    finally:
        engine.dispose()

    assert bool(effective[0]) is True, "membership was lost"
    assert bool(effective[1]) is False, "the owner's privileges are being inherited"
    assert bool(effective[2]) is False, (
        "titlepipe_migration can create in public without SET ROLE, so the "
        "un-SET-ROLE trap is live again"
    )


def test_roles_sql_converges_a_cluster_somebody_has_meddled_with(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    role_dsn: Callable[[str, str, str], str],
    titlepipe_role_pattern: str,
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
    owner_role: str,
    app_role: str,
    migration_role: str,
) -> None:
    """Every drift the review found, applied at once, then repaired by one rerun.

    IDEMPOTENT IS NOT CONVERGENT, and that distinction is the whole point of this
    test. `roles.sql` created correctly and re-ran cleanly while leaving all of
    the following in place — each measured 2026-08-05, each a rerun that exited 0
    and reported success:

      * `GRANT titlepipe_owner TO titlepipe_app` — a LOGIN role that can become
        the owner of every table;
      * a second membership row from another grantor carrying `INHERIT TRUE`,
        which restores the silent mis-ownership `INHERIT FALSE` was taken to
        kill. `REVOKE` without `GRANTED BY` does not reach it, even as
        superuser, and `REVOKE` without `CASCADE` fails outright with
        `dependent privileges exist` when that grantor has passed the role on;
      * `ALTER ROLE titlepipe_owner LOGIN BYPASSRLS PASSWORD '...'` — the login
        and bypass flags were repaired, the VERIFIER was not, leaving a live
        credential for the role that owns everything;
      * `VALID UNTIL '2020-01-01'` and `CONNECTION LIMIT 0` — converged to
        "correct attributes, cannot connect".

    A `dba` role is created here to reproduce the second-grantor case, because
    it cannot be reproduced without a second grantor. It is dropped in the
    `finally`, and the whole thing is safe only because the database is an
    ephemeral container.
    """
    admin = create_engine(roles_applied)
    try:
        with admin.begin() as connection:
            connection.execute(text(f"GRANT {owner_role} TO {app_role}"))
            connection.execute(
                text(
                    f"ALTER ROLE {owner_role} LOGIN BYPASSRLS "
                    f"PASSWORD 'a-verifier-that-must-not-survive'"
                )
            )
            connection.execute(
                text(f"ALTER ROLE {app_role} VALID UNTIL '2020-01-01' CONNECTION LIMIT 0")
            )
            connection.execute(
                text("CREATE ROLE dba NOSUPERUSER LOGIN CREATEROLE PASSWORD 'dba-throwaway'")
            )
            connection.execute(text(f"GRANT {owner_role} TO dba WITH ADMIN OPTION"))

        dba = create_engine(role_dsn(roles_applied, "dba", "dba-throwaway"))
        try:
            with dba.begin() as connection:
                connection.execute(
                    text(f"GRANT {owner_role} TO {migration_role} WITH INHERIT TRUE, SET TRUE")
                )
        finally:
            dba.dispose()

        # The drift is real before the repair, or this test proves nothing.
        assert len(_owner_members(roles_applied, owner_role)) > 1
        assert _catalog(roles_applied, titlepipe_role_pattern)[owner_role].has_password is True

        result = apply_roles_sql(roles_applied, role_passwords)
        assert result.returncode == 0, (
            f"convergence run exited {result.returncode}:\n{result.stderr}"
        )

        members = _owner_members(roles_applied, owner_role)
        assert {member for member, _, _, _ in members} == {migration_role}
        assert all(not inherits for _, _, inherits, _ in members)

        owner = _catalog(roles_applied, titlepipe_role_pattern)[owner_role]
        assert owner.has_password is False
        assert owner.can_log_in is False
        assert owner.bypasses_rls is False

        application = _catalog(roles_applied, titlepipe_role_pattern)[app_role]
        assert application.valid_until == "infinity"
        assert application.connection_limit == -1
    finally:
        # ORDER IS LOAD-BEARING. The convergence run comes FIRST, because it is
        # what removes the membership `dba` granted — and while that row exists,
        # `DROP ROLE dba` fails with `DependentObjectsStillExist: privileges for
        # membership of role titlepipe_migration in role titlepipe_owner`.
        # MEASURED: with the two the other way round, any assertion failing
        # above raised a second, unrelated error out of the cleanup and left the
        # poisoned roles in place for every test after this one.
        apply_roles_sql(roles_applied, role_passwords)
        with admin.begin() as connection:
            connection.execute(text("DROP ROLE IF EXISTS dba"))
        admin.dispose()


def test_a_password_full_of_quoting_hazards_survives(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    role_dsn: Callable[[str, str, str], str],
    app_role: str,
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
) -> None:
    """`%L` and `%I` are load-bearing, and nothing else in the suite would notice.

    `role_passwords` uses `secrets.token_urlsafe`, whose alphabet is
    `[A-Za-z0-9_-]` — it can never produce a character that matters here. So a
    regression from `format('... PASSWORD %L', pw)` to string concatenation
    would leave every other test in this file green while turning a password
    into SQL.

    The four characters below are the four that break a naive builder: a single
    quote terminates the literal, a backslash is an escape under
    `standard_conforming_strings = off`, a newline hides the rest of a line from
    a line-oriented reader, and a `%` is a `format()` placeholder that would be
    consumed if the value were ever passed as the FORMAT string rather than as
    an argument.

    The password is restored in the `finally`, because the session's other tests
    hold the generated one.
    """
    hazardous = "a'b\\c\nd%se--f"
    try:
        result = apply_roles_sql(roles_applied, {**role_passwords, app_role: hazardous})
        assert result.returncode == 0, f"roles.sql exited {result.returncode}:\n{result.stderr}"

        engine = create_engine(role_dsn(roles_applied, app_role, hazardous))
        try:
            with engine.connect() as connection:
                assert str(connection.execute(text("SELECT current_user")).scalar_one()) == app_role
        finally:
            engine.dispose()
    finally:
        assert apply_roles_sql(roles_applied, role_passwords).returncode == 0


def test_a_table_created_after_set_role_belongs_to_the_owner(
    roles_applied: str, migration_dsn: str, owner_role: str
) -> None:
    """The ownership mechanism itself, proved through the path a migration takes.

    THIS IS OPTION (a), AND THE ALTERNATIVE IS WHY. The plan also asked for
    "every table in `public` has `relowner = titlepipe_owner`" and "no LOGIN
    role is any table's `relowner`". There are no tables — the schema is Task 3
    — so both would pass over zero rows while proving nothing, which is the same
    defect `MINIMUM_TITLEPIPE_ROLES` exists to catch one file up. Deferring them
    to Task 3 (option (b)) would have left the mechanism unproved until then.
    So the table is created here, through the same two steps `env.py` will take:
    connect as `titlepipe_migration`, `SET ROLE titlepipe_owner`, `CREATE TABLE`.

    `alembic_version` is created BY NAME rather than only the generic probe
    table, because Task 3 depends on that specific one. It is the first table
    Alembic creates, it is created outside any migration script, and if it
    landed on `titlepipe_migration` the version table would be the one object in
    the schema owned by a LOGIN role — which is exactly the shape nobody
    inspects. The name is spelled out here so a future reader can see it was
    checked and not assumed.

    Nothing is dropped, because nothing is committed. The `CREATE TABLE`s and
    the `SET ROLE` all live in a transaction that is rolled back, so the catalog
    outside this test never sees any of them.

    `SET ROLE` takes an identifier, which cannot be a bind parameter, so the
    role name is formatted in. It is `OWNER_ROLE` from `conftest.py` — a module
    constant, not input — and the assertion below reads the name back out of the
    catalog rather than trusting the string that went in.

    `roles_applied` is requested and never read. It is not decoration:
    `migration_dsn` depends only on `admin_dsn`, so without this parameter the
    test runs against a server where `titlepipe_migration` does not exist and
    fails at `connect()` with an authentication error that reads like a broken
    password. MEASURED — this test file had that defect before it was fixed.
    """
    engine = create_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {owner_role}"))

            for table in (OWNERSHIP_PROBE_TABLE, ALEMBIC_VERSION_TABLE):
                connection.execute(text(f"CREATE TABLE {table} (id integer)"))
                assert _relation_owner(connection, table) == owner_role, (
                    f"{table} did not land on {owner_role}"
                )

            connection.rollback()
    finally:
        engine.dispose()


def test_the_libpq_environment_refuses_a_dsn_that_reaches_the_local_cluster(
    libpq_environment: Callable[[str], dict[str, str]],
) -> None:
    """The second route to the developer's own PostgreSQL, closed the same way.

    Task 1 closed the first one — `TP_TEST_DATABASE_URL=postgresql:///postgres`
    reached the local cluster over the unix socket, and `_normalise_override_dsn`
    was written to validate rather than trust. `_libpq_environment` was the same
    hole one layer down: it emitted `PGHOST=""` for a hostless DSN, and an EMPTY
    `PGHOST` is not "no host" to libpq, it is the socket. MEASURED 2026-08-05:

        env -i PGHOST= PGUSER= PGPASSWORD= psql -tAc "select current_user"
        -> rahul

    The blast radius is worse here than for the override, because what runs down
    this path is `CREATE ROLE`, `ALTER ROLE`, `REVOKE` and `GRANT` — against a
    cluster nobody destroys at the end of the session.

    A valid DSN is asserted too. A validator that rejected everything would
    satisfy the three refusals below and break the suite everywhere else, and
    that is a failure mode this repo has shipped before.
    """
    good = libpq_environment("postgresql+psycopg://operator:secret@db.example:5432/titlepipe")
    assert good["PGHOST"] == "db.example"
    assert good["PGPORT"] == "5432"
    assert good["PGUSER"] == "operator"
    assert good["PGDATABASE"] == "titlepipe"

    for hostile, missing in (
        ("postgresql+psycopg:///titlepipe", "host"),
        ("postgresql+psycopg://db.example/titlepipe", "username"),
        ("postgresql+psycopg://operator@db.example", "database"),
    ):
        with pytest.raises(ValueError, match=missing):
            libpq_environment(hostile)


def test_roles_sql_keeps_the_passwords_out_of_the_server_log(roles_sql_path: Path) -> None:
    """The log mitigation is present. A SOURCE check, and it says so.

    MEASURED 2026-08-05 with `log_statement = 'all'`: every password reached the
    server log three times — in the presence-check SELECT, in `CREATE ROLE` and
    in `ALTER ROLE`. The first of those runs before any role is touched, so even
    a run that REFUSED for a missing variable leaked the ones that were supplied.

    WHAT THIS CANNOT DO is prove the suppression works, and pretending otherwise
    would be worse than not testing it. The container is started by
    testcontainers with default logging, changing it means a custom command or a
    config mount, and reading the log back means `docker logs` on a container
    this seam deliberately does not expose. What this holds is that the two
    `SET`s are still in the file — enough to catch their deletion, which is the
    realistic regression, and honest about being no more than that.
    """
    code = "\n".join(
        line
        for line in roles_sql_path.read_text(encoding="utf-8").splitlines()
        if not line.lstrip().startswith("--")
    )

    assert "SET log_statement = ''none''" in code
    assert "SET log_min_duration_statement = -1" in code


def test_a_table_created_without_set_role_is_refused_outright(
    roles_applied: str, migration_dsn: str, owner_role: str
) -> None:
    """🔴 THE TASK 3 HAND-OFF, ENFORCED BY THE DATABASE RATHER THAN REQUESTED.

    `migrations/env.py` MUST issue `SET ROLE titlepipe_owner` immediately after
    connecting and BEFORE `context.begin_transaction()`. Alembic is not
    initialised yet — Task 3 owns that, and this task does not scaffold it. This
    test is what makes forgetting it impossible to miss.

    THE HISTORY IS THE ARGUMENT. Under the default `INHERIT`, this same
    statement SUCCEEDED and produced a table owned by `titlepipe_migration` — a
    LOGIN role, and therefore a role that bypasses RLS on its own tables unless
    somebody remembers `FORCE`. MEASURED 2026-08-05 against postgres:18.4,
    before the grant was changed: `relowner` came back `titlepipe_migration`,
    the migration reported success, and nothing anywhere complained. A silent,
    correctly-typed, fully-green wrong answer.

    `WITH INHERIT FALSE, SET TRUE` replaced it with `permission denied for
    schema public` at the first statement. That is the assertion below, and the
    message is asserted rather than just the exception type: `ProgrammingError`
    also covers a typo in the SQL, which would pass a bare `raises` while
    proving nothing about privileges.

    If this test ever fails because the `CREATE TABLE` SUCCEEDED, the grant has
    reverted to `INHERIT` and every table Task 3 creates without `SET ROLE` is
    silently owned by a role that can log in.
    """
    engine = create_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            with pytest.raises(ProgrammingError) as raised:
                connection.execute(text(f"CREATE TABLE {ALEMBIC_VERSION_TABLE} (id integer)"))
            connection.rollback()

            # The same statement, one `SET ROLE` later, is fine — so this is a
            # privilege boundary and not a broken role or a broken connection.
            connection.execute(text(f"SET ROLE {owner_role}"))
            connection.execute(text(f"CREATE TABLE {ALEMBIC_VERSION_TABLE} (id integer)"))
            assert _relation_owner(connection, ALEMBIC_VERSION_TABLE) == owner_role
            connection.rollback()
    finally:
        engine.dispose()

    assert "permission denied for schema public" in str(raised.value)


def test_the_owner_cannot_create_without_the_schema_grant(
    roles_applied: str, migration_dsn: str, owner_role: str
) -> None:
    """Why `GRANT CREATE ON SCHEMA public` is in `roles.sql` at all.

    PostgreSQL 15 revoked `CREATE` on schema `public` from `PUBLIC`. Without the
    grant, the two tests above fail with `permission denied for schema public`
    and the roles are unusable — so the grant is load-bearing, and a line that
    looks like boilerplate is the kind that gets deleted. This revokes it,
    watches the failure, and puts it back.

    Safe only because the database is an ephemeral container. The `finally`
    restores the grant whatever happens, but the real guarantee is that the
    whole server is destroyed when the session ends.
    """
    admin = create_engine(roles_applied)
    migration = create_engine(migration_dsn)
    try:
        with admin.begin() as connection:
            connection.execute(text(f"REVOKE CREATE ON SCHEMA public FROM {owner_role}"))

        with migration.connect() as connection:
            connection.execute(text(f"SET ROLE {owner_role}"))
            with pytest.raises(ProgrammingError) as raised:
                connection.execute(text(f"CREATE TABLE {OWNERSHIP_PROBE_TABLE} (id integer)"))
            connection.rollback()

        assert "permission denied for schema public" in str(raised.value)
    finally:
        with admin.begin() as connection:
            connection.execute(text(f"GRANT CREATE ON SCHEMA public TO {owner_role}"))
        migration.dispose()
        admin.dispose()

    # Restored, and proved restored rather than assumed: the next test in the
    # session depends on it.
    engine = create_engine(migration_dsn)
    try:
        with engine.connect() as connection:
            connection.execute(text(f"SET ROLE {owner_role}"))
            connection.execute(text(f"CREATE TABLE {OWNERSHIP_PROBE_TABLE} (id integer)"))
            connection.rollback()
    finally:
        engine.dispose()

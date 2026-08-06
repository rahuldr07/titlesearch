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
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import NamedTuple

import pytest
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

# The same import `conftest.py` uses, and for the same reason: `testcontainers.
# postgres` is a deprecated shim that warns on import, and the module actually
# holding the class is `testcontainers.community.postgres`. Imported here only to
# annotate the `postgres_container_factory` fixture's return type — a test has to
# spell the type of its own parameter, and a type defined in `conftest.py` would
# be unimportable under `--import-mode=importlib`.
from testcontainers.community.postgres import PostgresContainer

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
# `alembic_version` is NOT spelled here. It comes from `conftest.py`'s
# `alembic_version_table` fixture, which is the same string the migration scrub
# and `MIGRATION_TABLES` are built from — a second copy of it in this file would
# be a name that could drift away from the one the teardown drops.
OWNERSHIP_PROBE_TABLE = "task2_ownership_probe"

# A role whose name starts `titlepipe` and whose ninth character is NOT an
# underscore. It exists for exactly one assertion: `TITLEPIPE_ROLE_PATTERN` in
# `conftest.py` is `titlepipe\_%`, where the backslash makes `_` a LITERAL
# underscore rather than LIKE's any-single-character wildcard. Deleting that
# escape is a mutation the rest of the suite cannot see, because every real role
# matches either way. This one matches only the broken pattern.
DECOY_ROLE = "titlepipexdecoy"

# The second grantor the convergence test needs. A membership row belonging to
# somebody else cannot be reproduced without somebody else.
SECOND_GRANTOR_ROLE = "dba"
SECOND_GRANTOR_PASSWORD = "dba-throwaway"

# 🔴 THE ONE ROLE NAME THIS MODULE SPELLS, and it is a literal only because
# there is no fixture for it. `conftest.py` exposes `owner_role`, `app_role` and
# `migration_role`; it has no `worker_role`, and `managed_roles` is a tuple whose
# ORDER is not part of any contract, so indexing it would be worse than writing
# the name. `test_schema_public_grants_usage_to_the_owner_and_both_service_roles`
# asserts this string is IN `managed_roles` before it uses it, so a rename in
# `conftest.py` fails on that line — naming the mismatch — rather than in a
# catalog comparison against a role nobody creates.
WORKER_ROLE = "titlepipe_worker"

# Every role attribute `roles.sql` converges, in the spelling `ALTER ROLE`
# takes, paired with the drifted value the convergence test plants. `CREATE ROLE`
# clears all of them by default, which is exactly why the drift has to be
# planted on roles that ALREADY EXIST: a reviewer's mutation run deleted
# `NOSUPERUSER`, `NOBYPASSRLS`, `NOCREATEDB NOCREATEROLE NOREPLICATION` and
# `CONNECTION LIMIT -1` from the `ALTER ROLE`s one at a time and the suite stayed
# green for all five, because the roles were only ever freshly created.
ATTRIBUTE_DRIFT = (
    "SUPERUSER BYPASSRLS CREATEDB CREATEROLE REPLICATION NOINHERIT "
    "VALID UNTIL '2020-01-01' CONNECTION LIMIT 0"
)

# The GUCs the convergence test plants as per-role defaults, one per scope.
# `session_replication_role` is the one that matters — it is applied AT CONNECT,
# it switches every trigger off, and Task 3's `audit_log` is append-only only
# because of a trigger. MEASURED 2026-08-05 before `RESET ALL` was added here:
# planted once as a superuser, it survived every rerun, and a fresh
# `titlepipe_app` connection could `DELETE FROM audit_log` — 3 rows to 0.
CLUSTER_WIDE_DRIFT_GUC = "session_replication_role"
DATABASE_SCOPED_DRIFT_GUC = "search_path"


class RoleAttributes(NamedTuple):
    """The catalog columns this task's contract is written in.

    THE LAST SEVEN ARE CONVERGENCE RATHER THAN CONTRACT, and every one of them
    was a hole somebody measured:

      * `has_password` — `NOLOGIN` plus a surviving verifier is a credential one
        `ALTER ROLE ... LOGIN` away from working;
      * `valid_until` / `connection_limit` — a drifted value converged to
        "correct attributes, cannot connect" while `roles.sql` reported success;
      * `inherits` — `rolinherit` is ROLE-level and separate from the
        membership's `INHERIT FALSE`. `ALTER ROLE ... NOINHERIT` survived a
        rerun;
      * `can_create_databases`, `can_create_roles`, `can_replicate` — read by
        nothing in this suite until now, which is why deleting `NOCREATEDB
        NOCREATEROLE NOREPLICATION` from `roles.sql`'s `ALTER ROLE`s was a
        surviving mutation.
    """

    is_superuser: bool
    bypasses_rls: bool
    can_log_in: bool
    has_password: bool
    valid_until: str | None
    connection_limit: int
    inherits: bool
    can_create_databases: bool
    can_create_roles: bool
    can_replicate: bool


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
            "rolpassword IS NOT NULL, rolvaliduntil::text, rolconnlimit, "
            "rolinherit, rolcreatedb, rolcreaterole, rolreplication "
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
            bool(row[7]),
            bool(row[8]),
            bool(row[9]),
            bool(row[10]),
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


class RoleEdge(NamedTuple):
    """One `pg_auth_members` row: `member` can reach `granted`, by `grantor`."""

    granted: str
    member: str
    grantor: str
    inherits: bool
    can_set: bool


def _titlepipe_edges(dsn: str, pattern: str) -> list[RoleEdge]:
    """🔴 EVERY membership row with a `titlepipe_*` role on EITHER SIDE.

    THE DIRECTION IS THE WHOLE POINT, and reading one direction is how this
    suite missed a privilege escalation. The previous version of this helper
    took an `owner_role` and filtered `WHERE owner.rolname = :owner` — it
    enumerated MEMBERS OF THE OWNER, and `roles.sql` converged the same one
    direction. MEASURED 2026-08-05 against postgres:18.4:

        GRANT titlepipe_migration TO titlepipe_app;   -- one stray grant
        <rerun roles.sql>                             -- exit 0
        as titlepipe_app: SET ROLE titlepipe_migration; SET ROLE titlepipe_owner;
        -> current_user = titlepipe_owner

    Two hops. Nothing was a member of the owner except `titlepipe_migration`,
    the old assertion passed, and a LOGIN role was the owner of every table —
    free to `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` and `DROP POLICY`
    before Task 4 has written one.

    Matching the MEMBER side also catches PostgreSQL's PREDEFINED roles, which
    the owner-side read could never see: `GRANT pg_read_all_data TO
    titlepipe_app` puts `pg_read_all_data` on the granted side.

    EVERY row, deliberately. An earlier version ended in `.one()`, so a second
    membership from a different grantor raised `MultipleResultsFound` — a
    SQLAlchemy error about result shape rather than an assertion about
    privilege, for the exact condition being detected.
    """
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    "SELECT granted.rolname, member.rolname, grantor.rolname, "
                    "am.inherit_option, am.set_option "
                    "FROM pg_auth_members am "
                    "JOIN pg_roles granted ON granted.oid = am.roleid "
                    "JOIN pg_roles member ON member.oid = am.member "
                    "JOIN pg_roles grantor ON grantor.oid = am.grantor "
                    "WHERE granted.rolname LIKE :pattern OR member.rolname LIKE :pattern"
                ),
                {"pattern": pattern},
            )
            return [
                RoleEdge(str(r[0]), str(r[1]), str(r[2]), bool(r[3]), bool(r[4])) for r in result
            ]
    finally:
        engine.dispose()


def _role_settings(dsn: str, pattern: str) -> list[tuple[str, str, str]]:
    """`pg_db_role_setting` for `titlepipe_*` roles: (role, database, entry).

    NOTHING IN THIS SUITE READ THIS CATALOG, and `roles.sql` did not read it
    either, so a per-role GUC DEFAULT survived every rerun. MEASURED 2026-08-05
    against postgres:18.4:

        ALTER ROLE titlepipe_app SET session_replication_role='replica';
        <rerun roles.sql>                            -> exit 0, still set
        fresh connection as titlepipe_app            -> mode_at_connect=replica
        before=3  ->  DELETE FROM audit_log  ->  after=0

    A per-role default is applied AT CONNECT and never checked at use, so it
    defeats Task 3's append-only `audit_log` without touching a policy, a
    trigger or a grant. An in-session `SET` of the same GUC is correctly refused
    with 42501, which is what made the hole invisible.

    Both scopes are read. `ALTER ROLE r SET ...` and `ALTER ROLE r IN DATABASE d
    SET ...` are SEPARATE rows and `RESET ALL` on one does not touch the other;
    the database-scoped one is applied on exactly the connections that matter.
    """
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    "SELECT r.rolname, coalesce(d.datname, ''), entry "
                    "FROM pg_db_role_setting s "
                    "JOIN pg_roles r ON r.oid = s.setrole "
                    "LEFT JOIN pg_database d ON d.oid = s.setdatabase "
                    "CROSS JOIN LATERAL unnest(s.setconfig) AS entry "
                    "WHERE r.rolname LIKE :pattern"
                ),
                {"pattern": pattern},
            )
            return [(str(r[0]), str(r[1]), str(r[2])) for r in result]
    finally:
        engine.dispose()


def _titlepipe_default_privileges(dsn: str, pattern: str) -> list[tuple[str, str, str]]:
    """`pg_default_acl` rows that touch a `titlepipe_*` role: (owner, objtype, grantee).

    THE ONLY GRANT MECHANISM IN POSTGRESQL THAT REACHES OBJECTS THAT DO NOT
    EXIST YET, which is why it is asserted here while ordinary table grants
    deliberately are not — `roles.sql`'s header states that split and why.
    MEASURED 2026-08-05: a single

        ALTER DEFAULT PRIVILEGES FOR ROLE titlepipe_owner IN SCHEMA public
            GRANT ALL ON TABLES TO titlepipe_blind;

    survived a rerun that exited 0, and would have handed `titlepipe_blind` full
    access to every table Task 4 and every later migration creates — with no
    grant visible on any table anybody would think to inspect. The file's header
    claimed at the time that `titlepipe_blind` "cannot read TitlePipe's tables —
    no table grant exists".

    A grantee that IS the owner is excluded, matching `roles.sql`: revoking it
    would strip the owner's own default privileges on its own future objects,
    which is drift rather than convergence.
    """
    engine = create_engine(dsn)
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text(
                    "SELECT owner.rolname, d.defaclobjtype, grantee.rolname "
                    "FROM pg_default_acl d "
                    "JOIN pg_roles owner ON owner.oid = d.defaclrole "
                    "CROSS JOIN LATERAL aclexplode(d.defaclacl) AS a "
                    "JOIN pg_roles grantee ON grantee.oid = a.grantee "
                    "WHERE a.grantee <> d.defaclrole "
                    "AND (owner.rolname LIKE :pattern OR grantee.rolname LIKE :pattern)"
                ),
                {"pattern": pattern},
            )
            return sorted({(str(r[0]), str(r[1]), str(r[2])) for r in result})
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


def _explicit_schema_usage_grantees(connection: Connection) -> set[str]:
    """Every grantee with an EXPLICIT `USAGE` entry on schema `public`.

    🔴 `aclexplode(nspacl)` AND NOT `has_schema_privilege`, and the difference
    is the entire point of reading it this way. `has_schema_privilege` answers
    about the EFFECTIVE privilege, so on a stock cluster `PUBLIC`'s own `USAGE`
    makes it return `t` for a role that was granted nothing at all — MEASURED
    2026-08-06 against postgres:18.4, `nspacl` at its default
    `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}`:

        has_schema_privilege('titlepipe_owner','public','USAGE') -> t

    An assertion written on that function would therefore pass over a `GRANT`
    that produced `WARNING: no privileges were granted for "public"` and did
    nothing, and would only start failing on the day somebody ran `REVOKE USAGE
    ON SCHEMA public FROM PUBLIC` — which is the day there is no operator
    watching. `roles.sql`'s own read-back is written the same way and for the
    same reason; this is the test-side half of that decision.

    `grantee = 0` is `PUBLIC` in `aclexplode`'s output and renders as `-`
    through `regrole`, so it is spelled out by name here.

    `coalesce(nspacl, acldefault('n', nspowner))` because `nspacl` is NULL on a
    schema nobody has granted anything on and `aclexplode(NULL)` yields no rows,
    which would read as "nobody holds USAGE" rather than "the defaults apply".
    """
    result = connection.execute(
        text(
            "SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' "
            "ELSE a.grantee::regrole::text END "
            "FROM pg_namespace n "
            "CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, "
            "    acldefault('n', n.nspowner))) AS a "
            "WHERE n.nspname = 'public' AND a.privilege_type = 'USAGE'"
        )
    )
    return {str(row[0]) for row in result}


def _effective_schema_usage(connection: Connection, roles: Sequence[str]) -> dict[str, bool]:
    """`has_schema_privilege(role, 'public', 'USAGE')` for each of `roles`.

    The other question, asked deliberately beside the one above: not "is there
    an ACL entry" but "can this role actually see into the schema right now".
    Both are needed — the catalog entry is what `roles.sql` is responsible for,
    and the effective answer is what a connection experiences.

    `CAST(... AS text[])` is not decoration. psycopg sends a Python list as an
    untyped array parameter and `unnest` is overloaded on `anyarray` and
    `anymultirange`, so without the cast PostgreSQL answers `42725 function
    unnest(unknown) is not unique`. MEASURED — `migrations/versions/
    0002_forced_rls_and_grants.py` records the same thing for the same reason.
    """
    result = connection.execute(
        text(
            "SELECT role, has_schema_privilege(role, 'public', 'USAGE') "
            "FROM unnest(CAST(:roles AS text[])) AS role"
        ),
        {"roles": list(roles)},
    )
    return {str(row[0]): bool(row[1]) for row in result}


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
        # THE THREE NOBODY READ. Deleting `NOCREATEDB NOCREATEROLE
        # NOREPLICATION` from `roles.sql` was a surviving mutation for exactly
        # this reason. `CREATEROLE` is the widest of them: on PostgreSQL 16+ it
        # is enough to create a role, grant it anything the holder holds, and
        # ALTER any role it created.
        assert attributes.can_create_databases is False, f"{name} has CREATEDB"
        assert attributes.can_create_roles is False, f"{name} has CREATEROLE"
        assert attributes.can_replicate is False, f"{name} has REPLICATION"
        # `rolinherit`, which is NOT the membership's `INHERIT FALSE` and is
        # converged separately. A `NOINHERIT` role holds none of the privileges
        # of the groups it belongs to until it says `SET ROLE`, so flipping it
        # breaks grants that arrive through group membership rather than
        # widening anything — a silent half-broken role.
        assert attributes.inherits is True, f"{name} is NOINHERIT"
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
    roles_applied: str,
    owner_role: str,
    app_role: str,
    role_passwords: Mapping[str, str],
    role_dsn: Callable[[str, str, str], str],
) -> None:
    """NOLOGIN at the wire, not only in the catalog — and the SERVER refused it.

    🔴 `OperationalError` ALONE IS NOT AN ASSERTION ABOUT PRIVILEGE. A stopped
    container, a wrong port, a DNS failure and a firewall all raise the same
    class, so the previous version of this test would have passed against a
    server that was not running at all.

    THE OBVIOUS FIX DOES NOT WORK HERE, and the measurement is worth recording
    because it contradicts what the review that asked for it assumed. psycopg
    attaches a SQLSTATE to STATEMENT errors — `tests/test_schema_migration.py`
    asserts `42501` and `P0001` that way — but NOT to a connection-time
    authentication failure. MEASURED 2026-08-05 against psycopg 3.3.4 and
    postgres:18.4:

        err.orig.sqlstate        -> None
        err.orig.diag.sqlstate   -> None
        str(err.orig)            -> 'connection failed: ... FATAL:  password
                                    authentication failed for user
                                    "titlepipe_owner"'

    libpq reports connection failures through `PQerrorMessage`, which is a
    string; there is no `PGresult` for a connection that never opened, and so no
    `SQLSTATE` field to read. Asserting `28P01` here would be asserting `None`.

    So the discrimination is done with two things that ARE available:

      1. A LIVE CONTROL. `titlepipe_app` connects to the same host, port and
         database first. If the server were down or the port wrong, this test
         fails there — on the connection that is SUPPOSED to work, which is a
         readable failure — rather than passing on the one that is supposed to
         fail;
      2. THE SERVER'S OWN WORDS. `FATAL:  password authentication failed for
         user "titlepipe_owner"` can only have been sent BY a PostgreSQL backend
         that read the startup packet. `Connection refused`, `timeout expired`
         and `could not translate host name` are what the failure modes above
         produce, and none of them contains it.

    What this still cannot prove is WHY the server refused: a `NOLOGIN` role
    with no password is refused with the message a WRONG PASSWORD gets, on
    purpose, so that a stranger cannot enumerate roles or their login status.
    `rolcanlogin` is asserted from the catalog in the test above and that is the
    authority on it.

    The password below is not the owner's — the owner has none. It is a
    deliberately wrong one, which is the only kind there is for this role.
    """
    control = create_engine(role_dsn(roles_applied, app_role, role_passwords[app_role]))
    try:
        with control.connect() as connection:
            assert str(connection.execute(text("SELECT current_user")).scalar_one()) == app_role
    finally:
        control.dispose()

    engine = create_engine(role_dsn(roles_applied, owner_role, "there-is-no-owner-password"))
    try:
        with pytest.raises(OperationalError) as raised, engine.connect():
            pass
    finally:
        engine.dispose()

    assert f'password authentication failed for user "{owner_role}"' in str(raised.value), (
        f"the connection failed, but not with the server's own authentication "
        f"refusal — so this may be a server that is not there: {raised.value}"
    )


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
    titlepipe_role_pattern: str,
) -> None:
    """🔴 THE MEMBERSHIP CONTRACT: the EDGE SET is exactly one edge.

    NOT "the owner's member set". That was the claim, it was checked, it passed,
    and a LOGIN role was still two `SET ROLE`s from owning every table — see
    `_titlepipe_edges` for the measurement. The assertion below is over EVERY
    `pg_auth_members` row with a `titlepipe_*` role on EITHER side, so a path of
    any length through any of the five roles is one row of this set and cannot
    hide behind a direction nobody read.

    SET EQUALITY, not `in`. An earlier version read `pg_auth_members` only to
    check the OPTIONS of the row it already expected to find, so it never
    noticed an EXTRA one: one hand-written `GRANT titlepipe_owner TO
    titlepipe_app` survived every rerun while the script reported success.

    EVERY row's options are checked, not one row's. The second measured hole was
    a row from a DIFFERENT GRANTOR: re-granting only updates the same grantor's
    row, so a `dba` with `ADMIN OPTION` could add an `INHERIT TRUE` row beside
    ours and `titlepipe_migration` would create tables it owned itself. Reading
    that with `.one()` — as this test used to — raises `MultipleResultsFound`,
    a result-shape error rather than a privilege assertion, for the exact
    condition being detected. The length check below is what catches it now.

    `pg_has_role(..., 'USAGE')` asks "do the owner's privileges apply right
    now"; `'MEMBER'` asks "could it SET ROLE". They must differ.
    """
    edges = _titlepipe_edges(roles_applied, titlepipe_role_pattern)

    assert [(edge.granted, edge.member) for edge in edges] == [(owner_role, migration_role)], (
        f"the only membership edge touching a titlepipe role may be "
        f"{owner_role} <- {migration_role}, exactly once; found "
        f"{sorted((e.granted, e.member, e.grantor) for e in edges)}"
    )
    for edge in edges:
        assert edge.inherits is False, (
            f"{edge.member} inherits {edge.granted} (granted by {edge.grantor})"
        )
        assert edge.can_set is True, (
            f"{edge.member} cannot SET ROLE {edge.granted} (granted by {edge.grantor})"
        )

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


def test_no_titlepipe_role_carries_a_per_role_setting_default(
    roles_applied: str, titlepipe_role_pattern: str
) -> None:
    """🔴 `pg_db_role_setting` is EMPTY for these roles, in both scopes.

    A per-role GUC default is applied AT CONNECT and never checked again, so it
    is not visible to any assertion about policies, triggers, grants or role
    attributes — and nothing in this suite looked at it. See `_role_settings`
    for the measurement: `session_replication_role = replica`, planted once,
    survived every rerun and let `titlepipe_app` empty an append-only
    `audit_log`.

    ZERO ROWS rather than "no dangerous rows". There is no such thing as a
    benign per-role default here: `roles.sql` sets none, so any row at all is
    something a person or a provider put there, and enumerating the harmful
    GUCs would be a denylist against a list PostgreSQL grows every release.

    The convergence side of this — that `roles.sql` REPAIRS a planted setting
    rather than merely never creating one — is
    `test_roles_sql_converges_a_cluster_somebody_has_meddled_with`.
    """
    assert _role_settings(roles_applied, titlepipe_role_pattern) == [], (
        "a titlepipe role carries a per-role GUC default. It is applied at "
        "connect and checked nowhere; session_replication_role=replica is "
        "enough to switch off every trigger the audit log depends on."
    )


def test_no_default_privileges_reach_a_titlepipe_role(
    roles_applied: str, titlepipe_role_pattern: str
) -> None:
    """🔴 `pg_default_acl` is EMPTY for these roles, as owner and as grantee.

    See `_titlepipe_default_privileges`: one `ALTER DEFAULT PRIVILEGES FOR ROLE
    titlepipe_owner IN SCHEMA public GRANT ALL ON TABLES TO titlepipe_blind`
    survives a rerun that exits 0 and grants full access to every table Task 4
    and every later migration creates — before those tables exist, so no test
    that inspects a table can ever see it.

    🔴 THE ASYMMETRY WITH ORDINARY GRANTS IS DELIBERATE AND IS NOT AN OVERSIGHT.
    `roles.sql` does NOT converge table, sequence or schema grants, because
    converging them would mean deleting the grants Task 4's migrations are going
    to write, on every rerun. Default privileges are the one mechanism that acts
    on objects that do not exist yet, which is why they belong to the file that
    owns the roles rather than to the file that owns the tables. If Task 4 wants
    default privileges, they go in `roles.sql` — and this test is what will make
    that impossible to forget, by failing.
    """
    assert _titlepipe_default_privileges(roles_applied, titlepipe_role_pattern) == [], (
        "a titlepipe role is named in pg_default_acl. That grant applies to "
        "every table created from now on, and appears on no table today."
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
    managed_roles: tuple[str, ...],
) -> None:
    """🔴 EVERY drift, on EVERY role, in one cluster, repaired by one rerun.

    IDEMPOTENT IS NOT CONVERGENT, and that distinction is the whole point of this
    test. Every item below is a rerun that exited 0 and reported success while
    leaving the drift in place, each measured 2026-08-05 against postgres:18.4:

      * `GRANT titlepipe_owner TO titlepipe_app` — a LOGIN role that can become
        the owner of every table;
      * `GRANT titlepipe_migration TO titlepipe_app` — the SAME escalation in
        TWO HOPS, which the owner-side-only convergence could not see at all;
      * `GRANT pg_read_all_data TO titlepipe_app` — a PREDEFINED role, where the
        titlepipe role is on the MEMBER side and the granted side is not a
        titlepipe role at all;
      * a second membership row from another grantor carrying `INHERIT TRUE`,
        which restores the silent mis-ownership `INHERIT FALSE` was taken to
        kill. `REVOKE` without `GRANTED BY` does not reach it, even as
        superuser, and `REVOKE` without `CASCADE` fails outright with
        `dependent privileges exist` when that grantor has passed the role on;
      * `ALTER ROLE titlepipe_owner LOGIN BYPASSRLS PASSWORD '...'` — the login
        and bypass flags were repaired, the VERIFIER was not, leaving a live
        credential for the role that owns everything;
      * `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `NOINHERIT`,
        `VALID UNTIL '2020-01-01'` and `CONNECTION LIMIT 0`;
      * `ALTER ROLE ... SET session_replication_role` and the database-scoped
        `... IN DATABASE ... SET search_path`, which are separate
        `pg_db_role_setting` rows and were read by nothing;
      * `ALTER DEFAULT PRIVILEGES`, owner-side and grantee-side.

    🔴 THE DRIFT IS PLANTED ON **EVERY** ROLE WITH **EVERY** ATTRIBUTE, and that
    is a change rather than thoroughness for its own sake. This test used to
    poison `titlepipe_owner` (LOGIN/BYPASSRLS/PASSWORD) and `titlepipe_app`
    (VALID UNTIL/CONNECTION LIMIT) and nothing else. A reviewer ran 181 mutations
    of `roles.sql` against the suite and FIVE survived green: deleting
    `NOSUPERUSER` or `NOBYPASSRLS` from the four LOGIN roles' `ALTER ROLE`, and
    deleting `NOSUPERUSER`, `NOCREATEDB NOCREATEROLE NOREPLICATION` or
    `CONNECTION LIMIT -1` from the owner's. All five survive for the same
    reason: `CREATE ROLE` defaults to every one of those, so a role this session
    CREATED is correct however the `ALTER` is written, and only a role that
    already exists and already holds the attribute can tell the two apart.

    A `dba` role is created here to reproduce the second-grantor case, because
    it cannot be reproduced without a second grantor. ITS GRANT COMES FIRST:
    once `titlepipe_owner` holds `SUPERUSER`, a non-superuser `dba` cannot grant
    it — `ERROR: Only roles with the SUPERUSER attribute may grant roles with
    the SUPERUSER attribute` — so the order of the two poison blocks below is
    load-bearing.

    A `titlepipexdecoy` role is created for `TITLEPIPE_ROLE_PATTERN`: see
    `DECOY_ROLE`. Both are dropped in the `finally`, and the whole thing is safe
    only because the database is an ephemeral container.
    """
    admin = create_engine(roles_applied)
    try:
        try:
            with admin.begin() as connection:
                identity = connection.execute(text("SELECT current_database(), current_user")).one()
                database = str(identity[0])
                operator = str(identity[1])
                connection.execute(
                    text(
                        f"CREATE ROLE {SECOND_GRANTOR_ROLE} NOSUPERUSER LOGIN CREATEROLE "
                        f"PASSWORD '{SECOND_GRANTOR_PASSWORD}'"
                    )
                )
                connection.execute(
                    text(f"GRANT {owner_role} TO {SECOND_GRANTOR_ROLE} WITH ADMIN OPTION")
                )

            dba = create_engine(
                role_dsn(roles_applied, SECOND_GRANTOR_ROLE, SECOND_GRANTOR_PASSWORD)
            )
            try:
                with dba.begin() as connection:
                    connection.execute(
                        text(f"GRANT {owner_role} TO {migration_role} WITH INHERIT TRUE, SET TRUE")
                    )
            finally:
                dba.dispose()

            with admin.begin() as connection:
                # Memberships first: several of these become impossible once the
                # roles below hold SUPERUSER.
                connection.execute(text(f"GRANT {owner_role} TO {app_role}"))
                connection.execute(text(f"GRANT {migration_role} TO {app_role}"))
                connection.execute(text(f"GRANT pg_read_all_data TO {app_role}"))

                for role in (*managed_roles, owner_role):
                    connection.execute(text(f"ALTER ROLE {role} {ATTRIBUTE_DRIFT}"))
                connection.execute(
                    text(
                        f"ALTER ROLE {owner_role} LOGIN PASSWORD 'a-verifier-that-must-not-survive'"
                    )
                )

                connection.execute(
                    text(f"ALTER ROLE {app_role} SET {CLUSTER_WIDE_DRIFT_GUC} = 'replica'")
                )
                connection.execute(
                    text(
                        f"ALTER ROLE {app_role} IN DATABASE {database} "
                        f"SET {DATABASE_SCOPED_DRIFT_GUC} = 'nowhere_useful'"
                    )
                )

                # BOTH SIDES. The first is the one that matters — the owner
                # giving away every table it is about to create — and the second
                # is the shape the owner-side filter alone would miss: somebody
                # ELSE's default privileges naming a titlepipe role as grantee.
                connection.execute(
                    text(
                        f"ALTER DEFAULT PRIVILEGES FOR ROLE {owner_role} IN SCHEMA public "
                        f"GRANT ALL ON TABLES TO {app_role}"
                    )
                )
                connection.execute(
                    text(
                        f"ALTER DEFAULT PRIVILEGES FOR ROLE {operator} IN SCHEMA public "
                        f"GRANT SELECT ON TABLES TO {migration_role}"
                    )
                )

                connection.execute(text(f"CREATE ROLE {DECOY_ROLE} NOLOGIN"))

            # THE DRIFT IS REAL BEFORE THE REPAIR, or this test proves nothing —
            # a "convergence" test whose poison silently failed to apply is a
            # test that asserts `roles.sql` did not break a cluster nobody broke.
            poisoned = _catalog(roles_applied, titlepipe_role_pattern)
            assert poisoned[owner_role].has_password is True
            for role in (*managed_roles, owner_role):
                assert poisoned[role].is_superuser is True, role
                assert poisoned[role].bypasses_rls is True, role
                assert poisoned[role].can_create_databases is True, role
                assert poisoned[role].can_create_roles is True, role
                assert poisoned[role].can_replicate is True, role
                assert poisoned[role].inherits is False, role
                assert poisoned[role].connection_limit == 0, role
                assert poisoned[role].valid_until != "infinity", role
            assert len(_titlepipe_edges(roles_applied, titlepipe_role_pattern)) > 1
            assert len(_role_settings(roles_applied, titlepipe_role_pattern)) == 2
            assert len(_titlepipe_default_privileges(roles_applied, titlepipe_role_pattern)) == 2

            result = apply_roles_sql(roles_applied, role_passwords)
            assert result.returncode == 0, (
                f"convergence run exited {result.returncode}:\n{result.stderr}"
            )

            edges = _titlepipe_edges(roles_applied, titlepipe_role_pattern)
            assert [(edge.granted, edge.member) for edge in edges] == [
                (owner_role, migration_role)
            ], sorted((edge.granted, edge.member, edge.grantor) for edge in edges)
            assert all(edge.inherits is False for edge in edges)
            assert all(edge.can_set is True for edge in edges)

            repaired = _catalog(roles_applied, titlepipe_role_pattern)
            for role in (*managed_roles, owner_role):
                assert repaired[role].is_superuser is False, role
                assert repaired[role].bypasses_rls is False, role
                assert repaired[role].can_create_databases is False, role
                assert repaired[role].can_create_roles is False, role
                assert repaired[role].can_replicate is False, role
                assert repaired[role].inherits is True, role
                assert repaired[role].valid_until == "infinity", role
                assert repaired[role].connection_limit == -1, role
            assert repaired[owner_role].can_log_in is False
            assert repaired[owner_role].has_password is False
            for role in managed_roles:
                assert repaired[role].can_log_in is True, role

            assert _role_settings(roles_applied, titlepipe_role_pattern) == []
            assert _titlepipe_default_privileges(roles_applied, titlepipe_role_pattern) == []

            # `titlepipe\\_%` escapes the underscore, so `titlepipexdecoy` is not
            # a titlepipe role. Drop the escape and this row appears here, where
            # `valid_until` is NULL rather than `infinity` — the mutation the
            # rest of the suite cannot see.
            assert DECOY_ROLE not in repaired, (
                f"{DECOY_ROLE} was returned by the titlepipe_* catalog read, so "
                f"the LIKE pattern has lost its underscore escape and is "
                f"matching any ninth character"
            )
            # ...and `roles.sql` left it alone, which is the other half: a
            # pattern that over-matches in the FILE would have converged it.
            with admin.begin() as connection:
                survived = connection.execute(
                    text("SELECT count(*) FROM pg_roles WHERE rolname = :name"),
                    {"name": DECOY_ROLE},
                ).scalar_one()
            assert survived == 1, f"roles.sql reached {DECOY_ROLE}, which is not its role"
        finally:
            # ORDER IS LOAD-BEARING. The convergence run comes FIRST, because it
            # is what removes the membership `dba` granted — and while that row
            # exists, `DROP ROLE dba` fails with `DependentObjectsStillExist:
            # privileges for membership of role titlepipe_migration in role
            # titlepipe_owner`. MEASURED: with the two the other way round, any
            # assertion failing above raised a second, unrelated error out of the
            # cleanup and left the poisoned roles in place for every test after
            # this one.
            #
            # 🔴 ITS RESULT IS NOT ASSERTED HERE, and that is deliberate. An
            # `assert` inside a `finally` REPLACES whatever the body raised, so
            # the reported failure would be "the repair exited 3" and the real
            # one would be gone. The return code is checked immediately after
            # this `try`, which is reached only when the body did not raise.
            repair = apply_roles_sql(roles_applied, role_passwords)
        assert repair.returncode == 0, (
            f"the restoring run exited {repair.returncode}, so this session's "
            f"remaining tests would run against a poisoned cluster:\n{repair.stderr}"
        )
    finally:
        # NESTED, because the first statement of a `finally` can raise and take
        # everything after it with it. The previous version called
        # `apply_roles_sql` WITHOUT checking it, then `DROP ROLE dba`, then
        # `admin.dispose()` — so a failed convergence left the membership in
        # place, the `DROP ROLE` raised out of the cleanup, and the engine was
        # never disposed while the session kept a LOGIN BYPASSRLS owner and a
        # `titlepipe_app` at CONNECTION LIMIT 0.
        try:
            with admin.begin() as connection:
                connection.execute(text(f"DROP ROLE IF EXISTS {SECOND_GRANTOR_ROLE}"))
                connection.execute(text(f"DROP ROLE IF EXISTS {DECOY_ROLE}"))
        finally:
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

    🔴 THE RESTORE IS ASSERTED OUTSIDE THE `finally`. It used to be
    `assert apply_roles_sql(...).returncode == 0` INSIDE it, and an `assert` in a
    `finally` REPLACES whatever the body raised: a hazardous password that failed
    to connect would have been reported as "the restore exited 3", with the real
    failure gone. The restore still always runs; only the assertion moved to
    where it can be reached, which is after a body that did not raise.
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
        restored = apply_roles_sql(roles_applied, role_passwords)
    assert restored.returncode == 0, (
        f"the generated password was not restored, so every later test in this "
        f"session holds the wrong one:\n{restored.stderr}"
    )


def test_a_table_created_after_set_role_belongs_to_the_owner(
    roles_applied: str, migration_dsn: str, owner_role: str, alembic_version_table: str
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
    inspects.

    THE NAME COMES FROM `conftest.py`'s `alembic_version_table` FIXTURE, not
    from a constant in this file. It used to be both, and a second copy of a
    name is a name that can drift: the same string is what `MIGRATION_TABLES`
    hands to the migration scrub, and if the two ever disagreed this test would
    create a table the teardown does not drop — which is precisely the
    cross-module leak that teardown exists for.

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

            for table in (OWNERSHIP_PROBE_TABLE, alembic_version_table):
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
    """The three suppression `SET`s are in the file. A SOURCE check, and only that.

    MEASURED 2026-08-05 with `log_statement = 'all'` against a fresh
    postgres:18.4: each password reached the server log FIVE times, not the
    three an earlier version of this docstring claimed. The two
    `SELECT format(...)` statements that GENERATE the DDL are logged verbatim
    too, and a logged copy of `SELECT format('CREATE ROLE %I ... PASSWORD %L',
    'titlepipe_app', 'APPCANARY-222')` is as much a leaked credential as the
    `CREATE ROLE` it produces. The five, in order: the presence-check SELECT, the
    SELECT that generates `CREATE ROLE`, the executed `CREATE ROLE`, the SELECT
    that generates `ALTER ROLE`, the executed `ALTER ROLE`.

    `log_min_error_statement` is the third assertion and the newest hole.
    `log_statement = 'none'` only covers statements that SUCCEED; a statement
    that FAILS is logged in full at `log_min_error_statement`, whose default is
    `error`. MEASURED 2026-08-05, with the other two already in force:

        ALTER ROLE <missing role> PASSWORD 'ERRCANARY-777';
        -> STATEMENT:  ALTER ROLE <missing role> PASSWORD 'ERRCANARY-777';

        ...and with SET log_min_error_statement = 'panic' first: nothing.

    THIS TEST IS THE SOURCE HALF. It catches the realistic regression — somebody
    deleting a line that looks like noise. The BEHAVIOURAL half, which the
    previous version of this docstring said "cannot" be done, is
    `test_no_password_reaches_the_log_of_a_server_that_logs_everything` below;
    that word was wrong and is corrected there.
    """
    code = "\n".join(
        line
        for line in roles_sql_path.read_text(encoding="utf-8").splitlines()
        if not line.lstrip().startswith("--")
    )

    assert "SET log_statement = ''none''" in code
    assert "SET log_min_duration_statement = -1" in code
    assert "SET log_min_error_statement = ''panic''" in code


def test_no_password_reaches_the_log_of_a_server_that_logs_everything(
    postgres_container_factory: Callable[[str], PostgresContainer],
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
    managed_roles: tuple[str, ...],
) -> None:
    """🔴 THE SUPPRESSION, PROVED — not asserted from the source.

    The docstring above this used to say proving it "cannot" be done: the
    container is started by testcontainers with default logging, changing that
    means a custom command, and reading the log back means `docker logs`. All
    three are ten lines. `PostgresContainer` has `with_command`, so the server
    is started with `log_statement = all`; it has `get_logs`, so the log is
    readable from the test. "Cannot" was "chose not to", and the difference
    matters because the thing being claimed is that a credential does not exist
    somewhere.

    A DEDICATED CONTAINER, not the session one. `log_statement = all` is a
    server-level setting that has to be in place before the first connection, and
    every other test in this session wants the default. It is started and stopped
    inside this test.

    🔴 THE POSITIVE CONTROL IS THE POINT. "The canary is not in the log" is
    satisfied by an empty log, a container that never started, a `get_logs` that
    returned nothing, and a `grep` against the wrong bytes. So a probe statement
    is run on an ordinary connection AFTER `roles.sql` and asserted to BE in the
    log. If `log_statement = all` did not take effect, the probe is missing and
    this test fails — rather than passing for the wrong reason.

    MEASURED 2026-08-05 with this exact arrangement, fresh cluster each time:
    0 occurrences of the canary with the suppression in place, 4 with the three
    `SET`s deleted from `roles.sql`. FOUR AND NOT FIVE, and the missing one is
    the point of the other fix: the fifth was the presence check, which no
    longer sends a password to the server at all. Against the version of
    `roles.sql` that still had it, the same measurement gave 5 — and 1 on a run
    that REFUSED for a missing variable, where it is now 0.

    The passwords are literals rather than `role_passwords`. They belong to a
    container that is destroyed before this function returns, they must be
    greppable and distinctive, and using the session's real ones would put them
    in a log this test then reads.
    """
    canaries = {role: f"LOGCANARY-{index}-DO-NOT-LOG" for index, role in enumerate(managed_roles)}
    probe = "LOGPROBE-THIS-STATEMENT-MUST-BE-LOGGED"

    container = postgres_container_factory("log-probe-throwaway").with_command(
        "postgres -c log_statement=all"
    )
    with container as started:
        dsn = started.get_connection_url()

        result = apply_roles_sql(dsn, canaries)
        assert result.returncode == 0, f"roles.sql exited {result.returncode}:\n{result.stderr}"

        engine = create_engine(dsn)
        try:
            with engine.connect() as connection:
                connection.execute(text(f"SELECT '{probe}'"))
        finally:
            engine.dispose()

        stdout, stderr = started.get_logs()
        log = stdout.decode("utf-8", "replace") + stderr.decode("utf-8", "replace")

    assert probe in log, (
        "the probe statement is not in the server log, so log_statement=all did "
        "not take effect and the absence of the canaries below proves nothing"
    )
    for role, canary in canaries.items():
        assert canary not in log, (
            f"{role}'s password is in the server log of a cluster with "
            f"log_statement=all. The suppression in roles.sql is not working."
        )


def test_a_table_created_without_set_role_is_refused_outright(
    roles_applied: str, migration_dsn: str, owner_role: str, alembic_version_table: str
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
                connection.execute(text(f"CREATE TABLE {alembic_version_table} (id integer)"))
            connection.rollback()

            # The same statement, one `SET ROLE` later, is fine — so this is a
            # privilege boundary and not a broken role or a broken connection.
            connection.execute(text(f"SET ROLE {owner_role}"))
            connection.execute(text(f"CREATE TABLE {alembic_version_table} (id integer)"))
            assert _relation_owner(connection, alembic_version_table) == owner_role
            connection.rollback()
    finally:
        engine.dispose()

    assert "permission denied for schema public" in str(raised.value)


def test_the_owner_can_use_schema_public_when_public_cannot(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
    migration_dsn: str,
    owner_role: str,
    migration_role: str,
) -> None:
    """🔴 `GRANT USAGE ON SCHEMA public TO titlepipe_owner`, on a HARDENED cluster.

    THE ASSERTION HAS TO BE MADE WITH `PUBLIC`'S OWN `USAGE` REVOKED, or it is
    not an assertion about `roles.sql` at all. `has_schema_privilege` answers
    about the EFFECTIVE privilege, and on a default database `PUBLIC` holds
    `USAGE` on `public` — so the same call returns `t` for a role that was never
    granted anything. MEASURED 2026-08-06 against postgres:18.4 in the database
    of a `LOGIN CREATEROLE` operator, with `nspacl` still at its default
    `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}`:

        has_schema_privilege('titlepipe_owner','public','USAGE') -> t

    So this test builds the state the grant exists FOR — the hardening a
    security review asks for, `REVOKE USAGE ON SCHEMA public FROM PUBLIC` — and
    asserts three things in it:

      1. THE HARDENING LANDED. `PUBLIC` (grantee oid 0 in `aclexplode`) no
         longer holds `USAGE`. Without this the two assertions below are
         satisfied by a revoke that silently did nothing, which is the same
         class of vacuous pass the rest of this file exists to refuse;
      2. `titlepipe_owner` STILL HAS `USAGE`, and it can only be coming from
         `roles.sql`'s explicit grant;
      3. `titlepipe_migration` DOES NOT. It is not granted `USAGE` on purpose —
         `migrations/env.py` issues `SET ROLE titlepipe_owner` as its first
         statement and runs everything as the owner — and the membership is
         `INHERIT FALSE`, so nothing reaches it sideways either. This is the
         same shape as the `CREATE` assertion in
         `test_only_the_migration_role_can_become_the_owner`, one privilege
         over.

    THEN THE BEHAVIOUR, because the catalog is not the claim. `CREATE` without
    `USAGE` is INERT and the error does not name a privilege: MEASURED in the
    hardened state with `CREATE` granted and `USAGE` not, `CREATE TABLE` as
    `titlepipe_owner` fails with `ERROR: no schema has been selected to create
    in`. That is what `roles.sql` would otherwise ship on any hardened cluster,
    and it is why this grant is not a duplicate of the `CREATE` one.

    `roles.sql` IS RE-APPLIED FIRST, and that is not belt-and-braces.
    `tests/test_forced_rls_and_grants.py` sorts before this module, and its
    hardening test revokes `USAGE` on schema `public` from `PUBLIC` and from
    every role `roles.sql` creates. CORRECTED 2026-08-06: that test now
    snapshots `pg_namespace.nspacl` first and restores exactly the grantee set
    it found, so it no longer damages this one. It did when this paragraph was
    written — its teardown ended with `REVOKE USAGE ON SCHEMA public FROM
    titlepipe_owner, titlepipe_migration` and destroyed the very ACL entry this
    test is about, on every run, invisibly, because the `GRANT USAGE ... TO
    PUBLIC` on the line above it keeps `has_schema_privilege` reading `t`.
    Re-applying is what keeps this test's result independent of collection order
    and of another module's teardown, and it is kept for that reason rather than
    for the specific defect that is now fixed.

    Safe only because the database is an ephemeral container; `PUBLIC`'s `USAGE`
    is restored in the `finally` and proved restored afterwards, because every
    later test in the session would otherwise fail with `relation … does not
    exist`, which names nothing to do with schema privileges.
    """
    applied = apply_roles_sql(roles_applied, role_passwords)
    assert applied.returncode == 0, f"roles.sql exited {applied.returncode}:\n{applied.stderr}"

    admin = create_engine(roles_applied)
    try:
        with admin.begin() as connection:
            connection.execute(text("REVOKE USAGE ON SCHEMA public FROM PUBLIC"))

        with admin.connect() as connection:
            observed = connection.execute(
                text(
                    "SELECT EXISTS ("
                    "  SELECT 1 FROM pg_namespace n "
                    "  CROSS JOIN LATERAL aclexplode(n.nspacl) AS a "
                    "  WHERE n.nspname = 'public' AND a.grantee = 0 "
                    "    AND a.privilege_type = 'USAGE'), "
                    "has_schema_privilege(:owner, 'public', 'USAGE'), "
                    "has_schema_privilege(:migration, 'public', 'USAGE')"
                ),
                {"owner": owner_role, "migration": migration_role},
            ).one()

        assert bool(observed[0]) is False, (
            "PUBLIC still holds USAGE on schema public, so this cluster is not "
            "hardened and the two assertions below prove nothing"
        )
        assert bool(observed[1]) is True, (
            f"{owner_role} has no USAGE on schema public once PUBLIC's is gone. "
            f"roles.sql's GRANT CREATE is then inert — CREATE TABLE fails with "
            f"`no schema has been selected to create in`, which names no privilege."
        )
        assert bool(observed[2]) is False, (
            f"{migration_role} holds USAGE on schema public directly. It is "
            f"supposed to reach the schema only through SET ROLE {owner_role}."
        )

        migration = create_engine(migration_dsn)
        try:
            with migration.connect() as connection:
                connection.execute(text(f"SET ROLE {owner_role}"))
                connection.execute(text(f"CREATE TABLE {OWNERSHIP_PROBE_TABLE} (id integer)"))
                assert _relation_owner(connection, OWNERSHIP_PROBE_TABLE) == owner_role
                connection.rollback()
        finally:
            migration.dispose()
    finally:
        # NESTED, for the reason the test below records: the restoring statement
        # is a statement over a connection and can raise, and flat it would take
        # `dispose()` with it.
        try:
            with admin.begin() as connection:
                connection.execute(text("GRANT USAGE ON SCHEMA public TO PUBLIC"))
        finally:
            admin.dispose()

    # Proved restored rather than assumed. See the docstring.
    restored = create_engine(roles_applied)
    try:
        with restored.connect() as connection:
            assert bool(
                connection.execute(
                    text(
                        "SELECT EXISTS ("
                        "  SELECT 1 FROM pg_namespace n "
                        "  CROSS JOIN LATERAL aclexplode(n.nspacl) AS a "
                        "  WHERE n.nspname = 'public' AND a.grantee = 0 "
                        "    AND a.privilege_type = 'USAGE')"
                    )
                ).scalar_one()
            ), "schema public was left hardened; every later test in this session will fail"
    finally:
        restored.dispose()


def test_schema_public_grants_usage_to_the_owner_and_both_service_roles(
    roles_applied: str,
    role_passwords: Mapping[str, str],
    apply_roles_sql: Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]],
    owner_role: str,
    app_role: str,
    migration_role: str,
    managed_roles: tuple[str, ...],
) -> None:
    """🔴 `GRANT USAGE ON SCHEMA public` NAMES EXACTLY `titlepipe_owner`, `_app`, `_worker`.

    THIS GRANT CANNOT LIVE IN A MIGRATION, which is the whole reason it is
    `roles.sql`'s to make and this file's to assert. Schema `public` belongs to
    `pg_database_owner` from PostgreSQL 15 on. `migrations/env.py` runs every
    migration statement as `titlepipe_owner`, which is not the database owner
    and holds no grant option on the schema, so the `GRANT USAGE` in `0002` is a
    `WARNING: no privileges were granted for "public"` and a no-op. MEASURED
    2026-08-06 against postgres:18.4, as `titlepipe_migration` after
    `SET ROLE titlepipe_owner`, on a cluster where `roles.sql` had already run:

        GRANT USAGE ON SCHEMA public TO titlepipe_blind;
        WARNING:  01007: no privileges were granted for "public"
        GRANT
        nspacl -> unchanged

    `0002` keeps its read-back (`_require_schema_usage`) because an operator
    that could not grant must still be refused; this test is what keeps that
    guard from ever having to fire.

    🔴 THE CATALOG HALF IS READ FROM `nspacl` AND NOT FROM
    `has_schema_privilege`. See `_explicit_schema_usage_grantees`: the effective
    privilege is `t` for every role on a stock cluster, because `PUBLIC` holds
    `USAGE`, so a test written on it would pass over a `GRANT` that did nothing
    and would only start failing the day somebody hardened the cluster.

    THE EXACT SET, not containment, and the two roles it EXCLUDES are as much
    the contract as the three it requires:

      * `titlepipe_migration` — it reaches the schema only through `SET ROLE
        titlepipe_owner`, and its membership is `INHERIT FALSE` so nothing
        arrives sideways. A standing grant would hand a LOGIN role the access
        the un-`SET ROLE` trap exists to deny;
      * `titlepipe_blind` — a separate database is Task 4's, and until then the
        one thing this file can promise is that it grants it nothing here.

    Comparison is restricted to the five roles `roles.sql` creates, because
    `pg_database_owner` and `PUBLIC` are the cluster's business and not this
    file's. `PUBLIC`'s entry is asserted in the hardened block below, where its
    absence is what makes the other three assertions mean anything.

    `roles.sql` IS RE-APPLIED FIRST for the reason
    `test_the_owner_can_use_schema_public_when_public_cannot` records: an
    earlier module's teardown can reach this ACL, and a test whose result
    depends on collection order is worse than no test.

    Hardening the schema is safe only because the database is an ephemeral
    container. `PUBLIC`'s `USAGE` is restored in the `finally` and proved
    restored afterwards — left hardened, every later test in the session fails
    with `relation ... does not exist`, which names nothing to do with schema
    privileges.
    """
    assert WORKER_ROLE in managed_roles, (
        f"{WORKER_ROLE} is not one of the roles conftest.py says roles.sql "
        f"creates ({sorted(managed_roles)}), so this test is asserting a grant "
        f"to a role that does not exist"
    )
    five = set(managed_roles) | {owner_role}
    expected = {owner_role, app_role, WORKER_ROLE}

    applied = apply_roles_sql(roles_applied, role_passwords)
    assert applied.returncode == 0, f"roles.sql exited {applied.returncode}:\n{applied.stderr}"

    admin = create_engine(roles_applied)
    try:
        with admin.connect() as connection:
            granted = _explicit_schema_usage_grantees(connection)

        assert granted & five == expected, (
            f"roles.sql must leave an EXPLICIT USAGE entry on schema public for "
            f"{sorted(expected)} and for no other role it creates; nspacl holds "
            f"{sorted(granted & five)}. {migration_role} reaches the schema only "
            f"through SET ROLE {owner_role}, and the blind role belongs in a "
            f"separate database."
        )

        # THE BEHAVIOURAL HALF, in the state the grant exists FOR. An ACL entry
        # that nothing reads is not a privilege, and on a stock cluster every
        # role would answer `t` here through PUBLIC — so the hardening is what
        # makes these four answers about roles.sql rather than about defaults.
        with admin.begin() as connection:
            connection.execute(text("REVOKE USAGE ON SCHEMA public FROM PUBLIC"))

        with admin.connect() as connection:
            hardened = _explicit_schema_usage_grantees(connection)
            effective = _effective_schema_usage(connection, sorted(five))

        assert "PUBLIC" not in hardened, (
            "PUBLIC still holds USAGE on schema public, so this cluster is not "
            "hardened and every assertion below is satisfied by the default ACL"
        )
        for role in sorted(expected):
            assert effective[role] is True, (
                f"{role} has no USAGE on schema public once PUBLIC's is gone. "
                f"For {owner_role} that makes roles.sql's GRANT CREATE inert — "
                f"CREATE TABLE fails with `no schema has been selected to create "
                f"in`. For {app_role} and {WORKER_ROLE} it means every table they "
                f"hold SELECT on answers `relation ... does not exist`, off the "
                f"back of a migration that exited 0."
            )
        for role in sorted(five - expected):
            assert effective[role] is False, (
                f"{role} holds USAGE on schema public. It is granted none by "
                f"roles.sql on purpose; see this test's docstring."
            )
    finally:
        # NESTED, for the reason the two tests below record: the restoring
        # statement runs over a connection and can raise, and flat it would take
        # `dispose()` with it.
        try:
            with admin.begin() as connection:
                connection.execute(text("GRANT USAGE ON SCHEMA public TO PUBLIC"))
        finally:
            admin.dispose()

    # Proved restored rather than assumed. See the docstring.
    restored = create_engine(roles_applied)
    try:
        with restored.connect() as connection:
            assert "PUBLIC" in _explicit_schema_usage_grantees(connection), (
                "schema public was left hardened; every later test in this "
                "session will fail with `relation ... does not exist`"
            )
    finally:
        restored.dispose()


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
        # NESTED. The `GRANT` is a statement over a connection and can raise —
        # a lock, a dropped role, a server that went away — and flat, it took
        # both `dispose()` calls with it, leaking two connection pools on top of
        # whatever had already gone wrong.
        try:
            with admin.begin() as connection:
                connection.execute(text(f"GRANT CREATE ON SCHEMA public TO {owner_role}"))
        finally:
            try:
                migration.dispose()
            finally:
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

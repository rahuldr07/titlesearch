"""The database seam: a real server, at a known major, reachable three ways.

No production code exists behind this yet — no engine, no session, no models.
What is proved here is that the harness can reach PostgreSQL at all, that it is
the major version the rest of Plan 01 assumes, that the three DSNs really are
three different logins rather than three names for the superuser, and that
neither the developer's environment nor the override variable can move any of
that somewhere else.

That third one is not pedantry. A superuser bypasses row-level security
unconditionally; `FORCE ROW LEVEL SECURITY` does not stop one. An isolation
test that connected as the superuser would report a pass having proved nothing,
and it would keep doing so for as long as anyone believed it.

Nothing here is skipped. If Docker is unavailable these tests FAIL.

TWO TESTS BELOW WERE INVERTED BY TASK 2, which each of them said would happen.
`roles.sql` now creates five roles, so "the catalog holds none of them" became
"it holds exactly these" and "these DSNs cannot connect" became "they connect as
themselves". Both now request `roles_applied`, which is what makes this file's
result the same whether it is collected before or after `test_roles.py` —
without it the suite was green only because `test_database_seam` sorts first,
and that green would not have survived a new filename between the two, a subset
run, or `pytest-randomly`.

Everything this file needs from `conftest.py` arrives as a fixture. It is not
imported, because `from conftest import ...` only resolves under pytest's
legacy `prepend` import mode — see the comment above those fixtures.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Callable, Mapping
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import URL, Connection, Engine, create_engine, make_url, text
from testcontainers.community.postgres import PostgresContainer

from titlepipe_core.db.models import Base

# PostgreSQL encodes its version as major * 10000 + minor: 18.0 is 180000 and
# 19.0 is 190000, so a half-open range over the pair is exactly "some 18.x".
POSTGRES_18 = 180000
POSTGRES_19 = 190000

# The `titlepipe\_%` LIKE pattern used to be duplicated here and in
# test_roles.py, with the same paragraph explaining the escape twice. It is a
# `titlepipe_role_pattern` fixture in conftest.py now — everything else these
# tests share already arrived that way, and a LIKE-escape rule written twice is
# one that gets corrected once.


def _setting(connection: Connection, name: str) -> str:
    """Read a server GUC. `current_setting` returns text for every parameter."""
    result = connection.execute(text("SELECT current_setting(:name)"), {"name": name})
    return str(result.scalar_one())


def _roles_matching(connection: Connection, pattern: str) -> set[str]:
    """Role names in the live catalog, which is the only authority on this."""
    result = connection.execute(
        text("SELECT rolname FROM pg_roles WHERE rolname LIKE :pattern"),
        {"pattern": pattern},
    )
    return {str(rolname) for rolname in result.scalars()}


def test_the_server_is_postgresql_18(admin_dsn: str) -> None:
    """The numeric form is the check; the display string is the corroboration.

    `server_version_num` is major * 10000 + minor, so the half-open range is
    falsifiable in both directions on its own: 17.x fails at the bottom, 19.x
    fails at the top, and nothing else in this file pins the upper end.

    The previous version asserted `>= 180000` beside `startswith("18.")`, and no
    input could fail the second without failing the first — the numeric encoding
    makes the prefix imply the bound. Its docstring justified the pair by
    claiming a hypothetical `"180.1"` would satisfy `startswith("18.")`. It does
    not; the literal `.` is part of the prefix.

    `server_version` is still asserted, for the reason that survives: it is a
    separate GUC rather than a rendering of the first, and it is the spelling a
    human recognises in a failure message. It is not a substitute for the range.
    """
    engine = create_engine(admin_dsn)
    try:
        with engine.connect() as connection:
            version = _setting(connection, "server_version")
            version_num = int(_setting(connection, "server_version_num"))
    finally:
        engine.dispose()

    assert version.startswith("18."), f"expected PostgreSQL 18, got {version}"
    assert POSTGRES_18 <= version_num < POSTGRES_19, (
        f"expected {POSTGRES_18} <= server_version_num < {POSTGRES_19}, got {version_num}"
    )


def test_the_three_dsns_are_three_privilege_levels(
    roles_applied: str,
    admin_dsn: str,
    migration_dsn: str,
    app_dsn: str,
    migration_role: str,
    app_role: str,
    owner_role: str,
    managed_roles: tuple[str, ...],
    titlepipe_role_pattern: str,
) -> None:
    """One server, one database, three logins — checked against the catalog.

    The shape half of this used to be the whole of it: three `make_url` calls
    and a set of usernames, which passes against a dead server and would keep
    passing if `roles.sql` created `titlepipe_app` as a SUPERUSER. So the live
    server is asked.

    INVERTED BY TASK 2, as the previous version said it must be. This test used
    to assert the catalog held NO `titlepipe_*` role, which was Task 1's true
    statement about Task 1: nothing in it created one. Task 2's `roles.sql`
    creates five, so the assertion is now the positive one — those roles exist,
    the two this file names are among them, and the superuser is not one of
    them. Deleting it instead would have left nothing connecting the three DSNs
    to the roles they claim to be.

    `roles_applied` is requested FIRST and is the reason this test is
    order-independent. `admin_dsn` alone would leave the outcome depending on
    whether `test_roles.py` had already run, which is a green that survives
    until someone adds a file whose name sorts between the two.
    """
    admin = make_url(admin_dsn)
    migration = make_url(migration_dsn)
    application = make_url(app_dsn)

    assert migration.username == migration_role
    assert application.username == app_role
    assert len({admin.username, migration.username, application.username}) == 3

    for url in (migration, application):
        assert (url.host, url.port, url.database) == (admin.host, admin.port, admin.database)
        # psycopg2 is deliberately not a dependency, and it is what
        # `PostgresContainer.get_connection_url()` names by default. A DSN that
        # arrived here saying `+psycopg2` would fail at `create_engine` with an
        # import error rather than anything that reads as a configuration bug.
        assert url.drivername == "postgresql+psycopg"

    engine = create_engine(roles_applied)
    try:
        with engine.connect() as connection:
            existing = _roles_matching(connection, titlepipe_role_pattern)
    finally:
        engine.dispose()

    expected = set(managed_roles) | {owner_role}
    assert expected <= existing, (
        f"roles.sql must create {sorted(expected)}, but the server has "
        f"{sorted(existing)}; missing {sorted(expected - existing)}."
    )

    # The superuser is a fourth identity and must not have wandered into the
    # namespace. `test_the_container_identity_is_not_environment_derived` guards
    # the other direction — an exported `POSTGRES_USER` renaming it onto a role.
    assert admin.username not in existing

    # `titlepipe_owner` exists and NO DSN in this file names it. That is the
    # split: a table's owner bypasses RLS unless FORCE is set, so the owner is
    # the one role with no connection string anywhere.
    assert owner_role in existing
    assert owner_role not in {admin.username, migration.username, application.username}


def test_the_role_dsns_connect_as_their_own_role(
    roles_applied: str,
    migration_dsn: str,
    app_dsn: str,
    migration_role: str,
    app_role: str,
) -> None:
    """The privilege claim, tested against the server rather than the string.

    INVERTED BY TASK 2, and this is the direction the previous version said it
    should end up facing. It used to assert these DSNs could NOT connect, which
    was true only because the roles did not exist — and it could not prove why:
    MEASURED 2026-08-05, PostgreSQL answers `password authentication failed for
    user "..."` both for an absent role and for a wrong password, deliberately,
    so that a stranger cannot enumerate roles. A negative that cannot
    distinguish those two is a weak negative.

    The positive is strictly stronger. `current_user` coming back as the role
    named in the DSN proves the connection was authenticated AS that role, which
    is the thing a silent fallback to the superuser would break — and the
    superuser is asserted to be a different name in the test above. It also
    proves `roles.sql` set the password the harness generated, which no catalog
    read can show.
    """
    for dsn, role in ((migration_dsn, migration_role), (app_dsn, app_role)):
        engine = create_engine(dsn)
        try:
            with engine.connect() as connection:
                connected_as = str(connection.execute(text("SELECT current_user")).scalar_one())
        finally:
            engine.dispose()

        assert connected_as == role, f"{dsn.split('@')[-1]} authenticated as {connected_as!r}"


def test_the_container_identity_is_not_environment_derived(
    monkeypatch: pytest.MonkeyPatch,
    postgres_container_factory: Callable[[str], PostgresContainer],
    container_superuser: str,
    container_database: str,
) -> None:
    """`POSTGRES_USER` in a developer's shell must not reach into this suite.

    `PostgresContainer.__init__` resolves each of `username`, `password` and
    `dbname` as `argument or os.environ.get("POSTGRES_...", "test")`, so leaving
    any of them unset hands the container's identity to whatever the developer
    exported for their own `psql` habits. MEASURED 2026-08-05 against the
    unfixed tree: `POSTGRES_USER=titlepipe_app uv run pytest` produced
    `assert 2 == 3 ... {'titlepipe_app', 'titlepipe_migration'}` — the superuser
    had been renamed onto one of the two roles whose separation from it is the
    entire subject of the test above.

    The container is not STARTED here — the leak lives in the constructor, so
    the constructor is what is exercised, under an environment poisoned on
    purpose. It is not Docker-free even so: `DockerContainer.__init__` builds a
    `DockerClient`, and docker-py's `APIClient` fetches the server API version
    while doing it. With no daemon this test therefore FAILS rather than
    erroring at fixture setup like the rest of the file. That is the correct
    outcome under the no-skip rule and is recorded here so the different
    spelling in a report is not read as something else going wrong.
    """
    monkeypatch.setenv("POSTGRES_USER", "titlepipe_app")
    monkeypatch.setenv("POSTGRES_PASSWORD", "from-the-developers-shell")
    monkeypatch.setenv("POSTGRES_DB", "someone_elses_database")

    container = postgres_container_factory("generated-for-this-assertion")

    assert container.username == container_superuser
    assert container.dbname == container_database
    assert container.password == "generated-for-this-assertion"


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        pytest.param(
            "postgresql://operator@db.example:5432/titlepipe",
            "postgresql+psycopg://operator@db.example:5432/titlepipe",
            id="driverless-gets-psycopg",
        ),
        pytest.param(
            "postgresql+psycopg2://operator@db.example:5432/titlepipe",
            "postgresql+psycopg2://operator@db.example:5432/titlepipe",
            id="explicit-psycopg2-is-left-alone",
        ),
        pytest.param(
            "postgresql+psycopg://operator@db.example:5432/titlepipe",
            "postgresql+psycopg://operator@db.example:5432/titlepipe",
            id="explicit-psycopg-is-left-alone",
        ),
    ],
)
def test_the_override_names_the_dbapi_only_when_the_operator_did_not(
    normalise_override_dsn: Callable[[URL], str], given: str, expected: str
) -> None:
    """A bare `postgresql://` resolves to psycopg2, which is not installed here.

    `+psycopg2` is deliberately NOT repaired. Someone who named a DBAPI should
    get the import error that names it back, rather than a silent rewrite to the
    one that happens to be present.
    """
    assert normalise_override_dsn(make_url(given)) == expected


@pytest.mark.parametrize(
    ("given", "must_mention"),
    [
        pytest.param("sqlite:////tmp/x.db", "'sqlite'", id="another-backend-entirely"),
        pytest.param("mysql://operator@db.example:3306/db", "'mysql'", id="backend-with-a-host"),
        pytest.param("postgres://operator@db.example/db", "'postgres'", id="the-dropped-alias"),
        pytest.param("postgresql:///postgres", "explicit host", id="hostless-unix-socket"),
        pytest.param(
            "postgresql+psycopg:///postgres", "explicit host", id="hostless-with-a-driver"
        ),
    ],
)
def test_the_override_is_rejected_when_it_could_reach_the_wrong_server(
    normalise_override_dsn: Callable[[URL], str],
    database_url_override_name: str,
    given: str,
    must_mention: str,
) -> None:
    """The hole this whole guard exists to close, one row per way in.

    `postgresql:///postgres` is the one that actually happened: no host, so
    libpq takes the unix socket and peer auth, and the seam ran green against
    the developer's own 18.4 cluster with Docker switched off. `sqlite://` is
    the one the old `"+" in drivername` test rewrote into
    `postgresql+psycopg:///tmp/x.db` and pointed at that same cluster.

    Every message must name the variable, because the developer who exported it
    is the only person who can fix it, and must name what was wrong with it,
    because "invalid" sends them to read this file instead of their shell.

    `match=` carries the variable-name half of that: the name has no regular
    expression metacharacters, so the pattern is the literal string.

    Unparseable input is NOT here. It is rejected one layer up, in
    `_override_dsn`, because the parse has to happen where the raw string can be
    kept out of every frame display — see the leak tests below.
    """
    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        normalise_override_dsn(make_url(given))

    assert must_mention in str(raised.value)


def test_the_dropped_postgres_alias_is_told_what_to_write_instead(
    normalise_override_dsn: Callable[[URL], str],
) -> None:
    """`postgres://` is rejected, not repaired — but it is a near miss.

    Unlike `mysql://`, it IS a PostgreSQL URL in libpq's and psql's spelling;
    only SQLAlchemy dropped the alias, in 1.4, on purpose. Repairing it silently
    would be this harness disagreeing with the driver, so the behaviour stands
    and the operator is simply told the one word to change.
    """
    with pytest.raises(ValueError, match="did you mean postgresql://") as raised:
        normalise_override_dsn(make_url("postgres://operator@db.example/db"))

    assert "'postgres'" in str(raised.value)


@pytest.mark.parametrize(
    "given",
    [
        pytest.param("not a url", id="unparseable"),
        pytest.param("postgresql://operator@db.example:nope/db", id="unparseable-port"),
    ],
)
def test_an_unparseable_override_is_rejected_by_name(
    monkeypatch: pytest.MonkeyPatch,
    override_dsn_from_environment: Callable[[], str | None],
    database_url_override_name: str,
    given: str,
) -> None:
    """A string that is not a URL still has to say which variable held it."""
    monkeypatch.setenv(database_url_override_name, given)

    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        override_dsn_from_environment()

    assert "parseable" in str(raised.value)


# A stand-in for an operator's real credential. It is a module GLOBAL on
# purpose: `--showlocals` dumps a frame's locals, so a canary held in a local of
# the test would be reported by the very mechanism under test, and the test
# would be hiding from itself.
#
# It is also the ONLY credential-shaped literal in this file or in conftest.py.
# The reviewer's shell check greps a poisoned run for the password it exported,
# and a docstring quoting an example password is printed by the same traceback
# machinery as a real leak — so the grep would return hits that are not leaks
# and stop being a detector. Every reference below describes the value instead
# of spelling it.
LEAK_CANARY = "s3cr3t-must-never-be-printed"


def _formatted_report(raised: pytest.ExceptionInfo[ValueError]) -> str:
    """Everything pytest would print for this failure, not just its message.

    `funcargs=True` is the whole point and is NOT the default: it is the frame
    ARGUMENT display that leaked, and a check without it passes against the
    broken code. `showlocals=True` and `chain=True` widen it to the two other
    surfaces a secret can escape through — a local in the raising frame, and the
    `__cause__` traceback of a chained exception whose own frames took the raw
    string as an argument.
    """
    return str(raised.getrepr(style="long", funcargs=True, showlocals=True, chain=True))


def test_a_rejection_never_echoes_the_password_anywhere_in_the_report(
    normalise_override_dsn: Callable[[URL], str],
) -> None:
    """The property, not the assertion that used to stand in for it.

    The previous version asserted only `canary not in str(raised.value)`. That
    was true, and useless. MEASURED 2026-08-05: exporting a password-bearing
    `TP_TEST_DATABASE_URL` and grepping the run's whole output for that password
    returned **four** hits, because pytest's default `--tb=long` displays every
    frame's arguments and the validator took the raw DSN as one. The masking
    inside the `ValueError` was defeated on the line above it.

    Testing the assertion instead of the property is the failure mode this seam
    has now been corrected for twice, so the assertion is over the formatted
    report rather than the message.
    """
    with pytest.raises(ValueError, match="'mysql'") as raised:
        normalise_override_dsn(make_url(f"mysql://operator:{LEAK_CANARY}@db.example:3306/tp"))

    report = _formatted_report(raised)
    assert LEAK_CANARY not in report
    assert "***" in report, "the masked rendering must still be there to be read"


def test_an_unparseable_rejection_never_echoes_the_password_either(
    monkeypatch: pytest.MonkeyPatch,
    override_dsn_from_environment: Callable[[], str | None],
    database_url_override_name: str,
) -> None:
    """The path where there is no `URL` to mask, and `from None` earns its place.

    Nothing can render a string that failed to parse with its password hidden,
    so this path protects the secret structurally instead: `_override_dsn` takes
    no arguments, binds no local holding the value, and suppresses the chain.
    Without the suppression, SQLAlchemy's own `_parse_url` frame — which takes
    the raw string as an argument — would be printed under the "direct cause of"
    banner.
    """
    monkeypatch.setenv(
        database_url_override_name, f"postgresql://operator:{LEAK_CANARY}@db.example:nope/tp"
    )

    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        override_dsn_from_environment()

    assert LEAK_CANARY not in _formatted_report(raised)


def test_the_override_is_read_from_the_environment_and_validated(
    monkeypatch: pytest.MonkeyPatch,
    override_dsn_from_environment: Callable[[], str | None],
    database_url_override_name: str,
) -> None:
    """The wiring, not just the validator.

    The previous version of this file monkeypatched the variable and then never
    requested `admin_dsn`, so the override branch was never taken and the helper
    was never called by any test — deleting it left the suite green. This
    exercises the read `admin_dsn` performs, so the validator cannot be
    disconnected from the environment without a failure.
    """
    monkeypatch.delenv(database_url_override_name, raising=False)
    assert override_dsn_from_environment() is None

    # An exported-but-empty variable is how a shell clears one. It means the
    # container, not a URL that failed to parse.
    monkeypatch.setenv(database_url_override_name, "")
    assert override_dsn_from_environment() is None

    monkeypatch.setenv(database_url_override_name, "postgresql://operator@db.example:5432/tp")
    assert override_dsn_from_environment() == "postgresql+psycopg://operator@db.example:5432/tp"

    monkeypatch.setenv(database_url_override_name, "sqlite:////tmp/x.db")
    with pytest.raises(ValueError, match=database_url_override_name):
        override_dsn_from_environment()


def test_every_role_has_its_own_throwaway_password(
    role_passwords: Mapping[str, str],
    managed_roles: tuple[str, ...],
    migration_dsn: str,
    app_dsn: str,
) -> None:
    """One password per role per session, and each DSN carries its own.

    `_role_dsn` used to hardcode `password=None`, which would have made Task 2 a
    rewrite of this seam rather than a fill-in of it: the container
    authenticates published-port connections with `scram-sha-256`, so the roles
    need real passwords the day they exist.

    Distinctness is the assertion that matters. One password shared across the
    roles would mean any holder of the `titlepipe_app` credential could log in
    as `titlepipe_migration`, which is the separation the roles exist for.

    No password value appears in any message below. They are throwaway, but a
    test report is still a place they do not belong.
    """
    assert set(role_passwords) == set(managed_roles)
    assert len(set(role_passwords.values())) == len(managed_roles)
    assert all(password for password in role_passwords.values())

    for dsn in (migration_dsn, app_dsn):
        url = make_url(dsn)
        assert url.username is not None
        assert url.password == role_passwords[url.username]


# --- the query string, which is a third way to move the connection ----------


@pytest.mark.parametrize(
    ("given", "offending_key"),
    [
        pytest.param(
            "postgresql://operator@db.example:5432/tp?host=/var/run/postgresql",
            "host",
            id="host-redirects-to-the-unix-socket",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?hostaddr=127.0.0.1",
            "hostaddr",
            id="hostaddr-redirects-over-tcp",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?port=5433",
            "port",
            id="port-moves-to-another-cluster-on-the-same-box",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?dbname=someone_elses",
            "dbname",
            id="dbname-overrides-the-path",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?user=postgres",
            "user",
            id="user-overrides-the-login",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?service=production",
            "service",
            id="service-supplies-all-of-the-above-from-a-file",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?options=-csomething",
            "options",
            id="options-presets-server-settings",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?passfile=/tmp/pgpass",
            "passfile",
            id="passfile-supplies-a-credential-from-elsewhere",
        ),
        pytest.param(
            "postgresql://operator@db.example:5432/tp?sslmode=require&host=/var/run/postgresql",
            "host",
            id="one-allowed-key-does-not-cover-for-a-refused-one",
        ),
    ],
)
def test_the_override_refuses_a_query_parameter_that_is_not_allowlisted(
    normalise_override_dsn: Callable[[URL], str],
    database_url_override_name: str,
    given: str,
    offending_key: str,
) -> None:
    """The third hole of this exact shape, and the one that reached furthest.

    MEASURED 2026-08-05, against the tree before this fix:

        TP_TEST_DATABASE_URL='postgresql://rahul@bogus.invalid:5432/postgres?host=/var/run/postgresql'
        uv run pytest tests/test_database_seam.py -k postgresql_18   ->  1 passed

    `bogus.invalid` does not resolve. It passed because SQLAlchemy's psycopg
    dialect merges the URL query into the DBAPI connect kwargs, and libpq's
    `host=` OVERRIDES the host in the URL — so the run went to the developer's
    real 18.4 cluster over the unix socket, by peer auth, while
    `_normalise_override_dsn` inspected `url.host` and pronounced it fine.

    Worse than a bypass, it was a SPLIT: `_libpq_environment` reads only the
    URL's structural fields, so psql would have gone to `bogus.invalid` while
    every `create_engine` went to the socket. `roles.sql` one place, Alembic and
    every isolation assertion another.

    The refusal must NAME THE KEY, because "invalid query string" sends the
    operator to read this file rather than their own shell.

    Each row is a real libpq connection keyword. They are not an enumeration the
    code checks against — the code holds an ALLOWLIST, deliberately, because
    libpq gains keywords with every release and a denylist grows a hole on its
    own schedule. They are here as the evidence that the allowlist covers the
    ones that exist today.
    """
    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        normalise_override_dsn(make_url(given))

    message = str(raised.value)
    assert repr(offending_key) in message, f"the refusal must name {offending_key!r}: {message}"


def test_the_override_keeps_the_query_parameters_that_cannot_move_it(
    normalise_override_dsn: Callable[[URL], str],
    override_query_allowlist: frozenset[str],
) -> None:
    """A validator that refused every query string would also be wrong.

    `sslmode` and `connect_timeout` change HOW the connection is made,
    `application_name` changes only what the server writes in its log. None of
    the three can change WHERE it goes, which is the entire test the allowlist
    applies. A refusal of all three would satisfy every row above while breaking
    the one legitimate use — an operator pointing this at a managed PostgreSQL
    that requires TLS.

    The allowlist is read from the fixture rather than spelled again here, so
    adding a key without deciding whether it can redirect a connection fails at
    the assertion below rather than passing quietly.
    """
    assert override_query_allowlist == {"application_name", "connect_timeout", "sslmode"}

    given = "postgresql://operator@db.example:5432/tp?sslmode=require&connect_timeout=5&application_name=tp"
    result = make_url(normalise_override_dsn(make_url(given)))

    assert result.drivername == "postgresql+psycopg"
    assert dict(result.query) == {
        "sslmode": "require",
        "connect_timeout": "5",
        "application_name": "tp",
    }


def test_the_role_dsn_drops_the_query_rather_than_propagating_it(
    role_dsn: Callable[[str, str, str], str], app_role: str
) -> None:
    """A role DSN must mean exactly the fields it spells out.

    `_role_dsn` used to copy `query=url.query` from the admin DSN onto every
    role DSN. A query parameter is not decoration — SQLAlchemy hands it to libpq
    as a connect keyword, where `host`, `hostaddr`, `dbname`, `user`, `service`
    and `options` each beat the URL field of the same name. Copying it forward
    meant a single parameter on `admin_dsn` silently moved every role connection
    somewhere the role DSN's own host and database say nothing about.

    The three allowlisted keys go too. That is a knowing simplification, stated
    in `_role_dsn`: none of them can redirect a connection, and none of the role
    fixtures needs one today.
    """
    admin = "postgresql+psycopg://seam_admin:adminpw@db.example:5432/seam?application_name=tp"

    result = make_url(role_dsn(admin, app_role, "throwaway"))

    assert dict(result.query) == {}
    assert (result.host, result.port, result.database) == ("db.example", 5432, "seam")
    assert result.username == app_role


def test_the_libpq_environment_refuses_a_dsn_carrying_any_query_at_all(
    libpq_environment: Callable[[str], dict[str, str]],
) -> None:
    """psql and SQLAlchemy must not be able to disagree about the target.

    This function translates the URL's STRUCTURAL fields into `PG*` variables
    and has no view of the query, so a `?host=` that SQLAlchemy would honour is
    invisible to it. Left unguarded, one DSN aims two consumers at two servers:
    `roles.sql` runs where the URL says, and Alembic plus every `create_engine`
    run where the query says.

    Refused rather than translated, and refused for the ALLOWLISTED keys too.
    Nothing in the seam reaches here with a query — `_normalise_override_dsn`
    permits only three inert keys and `_role_dsn` drops them — so accepting one
    would be a branch with no caller. The day a real need arrives, the fix is to
    map that key to its `PG*` spelling here, not to relax this.
    """
    for hostile in (
        "postgresql+psycopg://operator:pw@db.example:5432/tp?host=/var/run/postgresql",
        "postgresql+psycopg://operator:pw@db.example:5432/tp?hostaddr=127.0.0.1",
        "postgresql+psycopg://operator:pw@db.example:5432/tp?sslmode=require",
    ):
        with pytest.raises(ValueError, match="query parameter"):
            libpq_environment(hostile)


# --- an empty PG* variable is not an absent one -----------------------------


def test_the_libpq_environment_refuses_a_portless_dsn(
    libpq_environment: Callable[[str], dict[str, str]],
) -> None:
    """`PGPORT=""` means 5432, exactly as `PGHOST=""` meant the unix socket.

    Host, username and database were each required here on the stated ground
    that libpq treats an empty value as an unset one and substitutes a default —
    and then the function emitted `"PGPORT": ""` for a portless DSN, two lines
    below the paragraph explaining why that is dangerous. The default libpq
    substitutes is 5432, which on this development box is the developer's own
    18.4 cluster: the same destination, reached through the one field that had
    been left out of the rule.

    Port is checked LAST of the four. That is not a statement about importance —
    it is because `tests/test_roles.py` feeds two portless DSNs expecting
    "username" and "database" back, and ordering decides which of several true
    refusals gets reported.
    """
    with pytest.raises(ValueError, match="port") as raised:
        libpq_environment("postgresql+psycopg://operator:pw@db.example/titlepipe")

    assert "has no port" in str(raised.value)


def test_the_libpq_environment_supplies_a_connect_timeout(
    libpq_environment: Callable[[str], dict[str, str]],
) -> None:
    """The child cannot inherit one, so it has to be given one.

    `_apply_roles_sql` builds its environment from `not name.startswith("PG")`,
    which drops `PGCONNECT_TIMEOUT` along with every dangerous `PG*` variable —
    and libpq's default `connect_timeout` is infinite. So the very filter that
    keeps psql off the wrong server also removed the only bound on how long it
    would wait for the right one. Supplying it here is what closes that.

    Asserted as a positive integer rather than a literal: the number is a
    judgement call recorded at `LIBPQ_CONNECT_TIMEOUT_SECONDS`, its being present
    and meaningful is the contract.
    """
    environment = libpq_environment("postgresql+psycopg://operator:pw@db.example:5432/titlepipe")

    assert int(environment["PGCONNECT_TIMEOUT"]) > 0


def test_roles_sql_that_never_returns_is_bounded_and_names_only_the_host(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    apply_roles_sql_with_timeout: Callable[
        [str, Mapping[str, str], float], subprocess.CompletedProcess[str]
    ],
    managed_roles: tuple[str, ...],
) -> None:
    """An unbounded `subprocess.run` hangs the whole session with no output.

    `_apply_roles_sql` passed `capture_output`, `text` and `check` and no
    `timeout`, and libpq's default `connect_timeout` is infinite. MEASURED
    2026-08-05 against `10.255.255.1`, which this box blackholes: psql was still
    connecting when a 20-second ceiling killed it (shell exit 124), and with
    `PGCONNECT_TIMEOUT=5` in the same environment it gave up in five.
    `roles_applied` is session-scoped, so the first of those is every database
    test in the suite waiting behind a subprocess that prints nothing, because
    its output is captured.

    A FAKE `psql` RATHER THAN A BLACKHOLED HOST, and the substitution is the
    point of the test rather than a shortcut around it. A test that depends on a
    particular address dropping packets is a test that passes or fails on the
    reviewer's network: the address above blackholes here and may answer "no
    route to host" in milliseconds elsewhere, and that second outcome exercises
    the ordinary non-zero-exit path instead of this one. A `psql` that sleeps
    hits `TimeoutExpired` on every machine, in one second.

    `shutil.which` is patched on the `shutil` module rather than on `conftest`,
    because `conftest` is not importable under `--import-mode=importlib` — the
    helper looks the name up on the module at call time, so the module is where
    it can be reached from.

    THE MESSAGE MUST NAME THE HOST AND NOTHING ELSE. Everything about how this
    seam hands psql a connection exists to keep the credential out of `argv`,
    `ps` and `CompletedProcess.__repr__`; a timeout message quoting the DSN
    would hand it straight back on the one path where an operator is certain to
    be reading the output.
    """
    never_returns = tmp_path / "psql"
    never_returns.write_text("#!/bin/sh\nsleep 30\n")
    never_returns.chmod(0o755)

    def _fake_which(_name: str) -> str:
        return str(never_returns)

    monkeypatch.setattr(shutil, "which", _fake_which)

    hostile = f"postgresql+psycopg://operator:{LEAK_CANARY}@db.example:5432/titlepipe"
    passwords = dict.fromkeys(managed_roles, LEAK_CANARY)

    with pytest.raises(RuntimeError) as raised:
        apply_roles_sql_with_timeout(hostile, passwords, 1.0)

    message = str(raised.value)
    assert "db.example" in message
    assert LEAK_CANARY not in message
    assert "operator" not in message
    assert "@" not in message, f"the message must not carry a DSN: {message}"


# --- PGOPTIONS, which presets the thing Task 6 has to prove -----------------


# A tenant that is syntactically valid and belongs to nobody. It exists to be
# smuggled in through `PGOPTIONS` and then found absent.
POISON_TENANT = "22222222-2222-2222-2222-222222222222"

# Set in the child pytest below so that, if the node id ever stops selecting
# what it names, the recursion fails loudly on its first step instead of
# forking until the box gives up.
PG_SCRUB_CHILD_MARKER = "TP_TEST_PG_SCRUB_CHILD"


def test_no_pg_variable_reaches_this_process() -> None:
    """`_no_libpq_environment`'s postcondition, asserted from inside the process.

    Every `PG*` variable is a redirect or a preset: `PGHOST`, `PGPORT`,
    `PGDATABASE`, `PGUSER`, `PGSERVICE` and `PGSERVICEFILE` move a connection,
    `PGOPTIONS` presets server settings on it, `PGSSLMODE` weakens it.
    `_apply_roles_sql` has always stripped the family for its psql child; until
    now nothing stripped it for the roughly thirty in-process `create_engine`
    calls in this suite.

    ON A CLEAN SHELL THIS ASSERTION IS VACUOUS, and that is why
    `test_the_pg_scrub_holds_against_a_poisoned_parent_environment` runs it
    again in a child process with the family exported. This one is the
    postcondition; that one is the proof.
    """
    assert sorted(name for name in os.environ if name.startswith("PG")) == []


def test_the_pg_scrub_holds_against_a_poisoned_parent_environment() -> None:
    """The scrub, proved rather than asserted, by poisoning a real pytest run.

    The assertion above cannot fail on a machine that exports no `PG*` variable,
    which is most of them — so it would have passed just as happily with the
    autouse fixture deleted. MEASURED 2026-08-05: with `_no_libpq_environment`
    commented out, this test fails with the child reporting
    `assert ['PGDATABASE', 'PGHOST', 'PGOPTIONS', 'PGSERVICE', 'PGUSER'] == []`.
    With it in place, the child passes.

    A child process is the only way in. The fixture is session-scoped, so by the
    time any test runs it has already done its work; there is nothing left for
    an in-process test to poison.

    None of the exported values is ever connected to. The child selects one test
    that reads `os.environ` and nothing else.
    """
    assert os.environ.get(PG_SCRUB_CHILD_MARKER) is None, (
        "this test is running inside its own child process, which means the node "
        "id below stopped selecting the test it names and the run was about to "
        "recurse"
    )

    poisoned = {
        **os.environ,
        PG_SCRUB_CHILD_MARKER: "1",
        "PGHOST": "/var/run/postgresql",
        "PGUSER": "postgres",
        "PGDATABASE": "postgres",
        "PGSERVICE": "somebodys-service-stanza",
        "PGOPTIONS": f"-c app.current_tenant={POISON_TENANT}",
    }

    child = subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-m",
            "pytest",
            f"{Path(__file__).resolve()}::test_no_pg_variable_reaches_this_process",
            # No `-q` here. `pyproject.toml`'s `addopts` already carries one and
            # the child inherits it; a second makes it `-qq`, which suppresses
            # the summary line entirely — MEASURED, the child's whole stdout
            # became `.  [100%]` and the count assertion below had nothing to
            # read. The count is what distinguishes "the one test passed" from
            # "the node id selected nothing and pytest was happy about it".
            "-p",
            "no:cacheprovider",
        ],
        cwd=Path(__file__).resolve().parent.parent,
        env=poisoned,
        capture_output=True,
        text=True,
        check=False,
        timeout=300,
    )

    assert child.returncode == 0, (
        f"a pytest run with the PG* family exported must still see none of it.\n"
        f"stdout:\n{child.stdout}\nstderr:\n{child.stderr}"
    )
    assert "1 passed" in child.stdout


def test_a_fresh_connection_starts_at_the_deny_sentinel_even_under_pgoptions(
    monkeypatch: pytest.MonkeyPatch,
    roles_applied: str,
    seam_engine: Callable[[str], Engine],
    tenant_guc: str,
    tenant_deny_sentinel: str,
) -> None:
    """The second layer, tested with the first one deliberately switched off.

    Task 6's whole invariant is that a connection with no tenant established
    DENIES: `current_setting('app.current_tenant', true)` is `''`, `nullif` makes
    it NULL, no row matches, nothing is returned. `PGOPTIONS` replaces that floor
    with a VALID TENANT, connection-scoped — so it survives `SET LOCAL` and a
    rollback on a pooled connection, and a Task 6 isolation test could report a
    pass against a connection that was never denied anything.

    `monkeypatch.setenv` here defeats `_no_libpq_environment` on purpose. Two
    layers answer this and either alone is one exported variable from being
    wrong; a test that only exercised the scrub would leave `SEAM_CONNECT_ARGS`
    unproven, and vice versa.

    THE CONTROL IS THE HALF THAT MAKES IT A TEST. A plain `create_engine` is
    asserted to pick the poison up. Without that, an assertion that the pinned
    engine reads `''` would pass just as well on a box where `PGOPTIONS` never
    reached libpq at all — proving the harness, not the fix. MEASURED
    2026-08-05, before any of this landed:

        PGOPTIONS='-c app.current_tenant=2222…' python -c '…'
        create_engine("postgresql+psycopg://@/postgres")                        -> '2222…'
        create_engine(…, connect_args={"options": "-c app.current_tenant="})    -> ''

    Which is also the mechanism: libpq's `options` CONNECTION PARAMETER is the
    thing `PGOPTIONS` is merely the default for, so naming it explicitly wins.
    """
    monkeypatch.setenv("PGOPTIONS", f"-c {tenant_guc}={POISON_TENANT}")
    read_the_guc = text("SELECT current_setting(:name, true)")

    unpinned = create_engine(roles_applied)
    try:
        with unpinned.connect() as connection:
            poisoned = connection.execute(read_the_guc, {"name": tenant_guc}).scalar_one()
    finally:
        unpinned.dispose()

    assert poisoned == POISON_TENANT, (
        "the control failed: PGOPTIONS did not reach an unpinned connection, so "
        "this test cannot show that pinning it is what makes the difference"
    )

    pinned = seam_engine(roles_applied)
    try:
        with pinned.connect() as connection:
            settled = connection.execute(read_the_guc, {"name": tenant_guc}).scalar_one()
    finally:
        pinned.dispose()

    assert settled == tenant_deny_sentinel


# --- the teardown, which four mutations survived ----------------------------


def test_migration_tables_matches_the_model_metadata(
    migration_tables: tuple[str, ...], alembic_version_table: str
) -> None:
    """The drift guard for a hand-maintained literal behind the last-resort scrub.

    `MIGRATION_TABLES` is what `_scrub_migration_objects` drops, and that scrub
    exists precisely so that cleanup does not depend on Alembic having worked.
    Its independence is bought with a list somebody has to remember to update:
    the first revision that adds a table leaves the scrub silently incomplete,
    and the symptom is not a failure here but a `DuplicateTable` in whichever
    module happens to run next.

    `Base.metadata` is the authority for the model side; `alembic_version` is the
    one entry with no model, because Alembic creates it outside any revision and
    `downgrade base` does not drop it. So the identity is exact in both
    directions — a table added to the models and forgotten here fails, and a
    stale name left here after a table is dropped fails too. A reviewer removed
    `"fields"` from the literal and the suite stayed at 131 passed; it does not
    now.

    A TEST RATHER THAN AN IMPORT-TIME ASSERTION IN `conftest.py`. A raise during
    conftest import kills collection of the entire suite, including
    `test_settings.py`, which has never opened a connection — turning "the
    scrub list drifted" into "pytest is broken" and burying the one line that
    says what actually happened.
    """
    assert set(migration_tables) - {alembic_version_table} == set(Base.metadata.tables)
    assert alembic_version_table in migration_tables
    assert len(set(migration_tables)) == len(migration_tables), "a name is listed twice"


def _create_marker_table(engine: Engine, table: str) -> None:
    """A table with one of the migration's names, standing in for real debris."""
    with engine.begin() as connection:
        connection.execute(text(f"CREATE TABLE {table} (id integer)"))


def _table_exists(engine: Engine, table: str) -> bool:
    with engine.connect() as connection:
        return bool(
            connection.execute(
                text("SELECT to_regclass(:name) IS NOT NULL"), {"name": table}
            ).scalar_one()
        )


def test_the_teardown_scrubs_even_when_the_downgrade_raises(
    monkeypatch: pytest.MonkeyPatch,
    roles_applied: str,
    seam_engine: Callable[[str], Engine],
    alembic_config: Callable[[str], Config],
    teardown_migrated_database: Callable[[Config, str, bool], None],
    migration_tables: tuple[str, ...],
) -> None:
    """The nested `try`/`finally`, driven down the branch the happy path never takes.

    `migrated_database`'s docstring describes this structure as the fix for a
    leak that really happened — a downgrade that raised skipped the scrub, and
    the next module inherited seven tables, the enum, the function and a
    populated `alembic_version`, at which point `test_roles.py` failed with
    `DuplicateTable: relation "alembic_version" already exists`. None of that was
    exercised: on the happy path `downgrade base` succeeds, so flattening the
    nesting, or deleting the scrub outright, left the suite at 131 passed. Two of
    the reviewer's four mutations, both invisible.

    So the teardown is a named function now and this drives it directly, with
    `alembic.command.downgrade` replaced by one that raises. `conftest.py` does
    `from alembic import command` and then `command.downgrade(...)`, an attribute
    lookup at call time on the same module object this test patches — which is
    what makes the substitution reach it without importing `conftest`, something
    `--import-mode=importlib` does not allow.

    BOTH HALVES ARE ASSERTED. The scrub must have run, and the downgrade's own
    exception must still have propagated rather than being swallowed or replaced
    by a teardown error — a `finally` that lost the original failure would be the
    same bug facing the other way.
    """
    debris = migration_tables[0]
    engine = seam_engine(roles_applied)
    downgrades: list[str] = []

    def _raising_downgrade(config: Config, revision: str) -> None:
        downgrades.append(revision)
        raise RuntimeError("downgrade is broken")

    monkeypatch.setattr(command, "downgrade", _raising_downgrade)

    try:
        _create_marker_table(engine, debris)
        assert _table_exists(engine, debris)

        with pytest.raises(RuntimeError, match="downgrade is broken"):
            teardown_migrated_database(alembic_config(roles_applied), roles_applied, True)

        assert downgrades == ["base"], "the teardown must attempt the downgrade first"
        assert not _table_exists(engine, debris), (
            "the scrub must run even when the downgrade raised — that is the whole "
            "reason it is in a finally"
        )
    finally:
        with engine.begin() as connection:
            connection.execute(text(f"DROP TABLE IF EXISTS {debris}"))
        engine.dispose()


def test_the_teardown_skips_the_downgrade_it_cannot_do_but_still_scrubs(
    monkeypatch: pytest.MonkeyPatch,
    roles_applied: str,
    seam_engine: Callable[[str], Engine],
    alembic_config: Callable[[str], Config],
    teardown_migrated_database: Callable[[Config, str, bool], None],
    migration_tables: tuple[str, ...],
) -> None:
    """`upgraded=False` means there is no version row, so there is nothing to undo.

    An unconditional `downgrade` in the teardown would raise out of the
    `finally` and REPLACE the upgrade's own exception as the reported failure —
    the original surviving only as `__context__`, three screens down, which is
    where nobody looks first. The guard exists for that, and it is only half the
    story: skipping the downgrade must not mean skipping the cleanup, because a
    partial upgrade is exactly the case that leaves debris.

    So both are asserted. `command.downgrade` is replaced by one that records
    being called and would fail the test by being recorded at all, and the
    marker table is still gone at the end.
    """
    debris = migration_tables[0]
    engine = seam_engine(roles_applied)
    downgrades: list[str] = []

    def _recording_downgrade(config: Config, revision: str) -> None:
        downgrades.append(revision)

    monkeypatch.setattr(command, "downgrade", _recording_downgrade)

    try:
        _create_marker_table(engine, debris)
        assert _table_exists(engine, debris)

        teardown_migrated_database(alembic_config(roles_applied), roles_applied, False)

        assert downgrades == [], "there is no version row to downgrade from"
        assert not _table_exists(engine, debris)
    finally:
        with engine.begin() as connection:
            connection.execute(text(f"DROP TABLE IF EXISTS {debris}"))
        engine.dispose()


# --- loopback ---------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        pytest.param("localhost", id="the-name-everyone-types"),
        pytest.param("LOCALHOST", id="the-name-in-caps"),
        pytest.param("localhost.localdomain", id="the-fully-qualified-name"),
        pytest.param("127.0.0.1", id="the-address-everyone-types"),
        pytest.param("127.0.0.53", id="the-rest-of-127-slash-8"),
        pytest.param("::1", id="ipv6"),
    ],
)
def test_a_loopback_override_needs_a_second_variable_saying_so(
    monkeypatch: pytest.MonkeyPatch,
    normalise_override_dsn: Callable[[URL], str],
    database_url_override_name: str,
    loopback_acknowledgement_name: str,
    host: str,
) -> None:
    """`localhost` is the accident-shaped spelling, and the accident is destructive.

    MEASURED 2026-08-05 against the tree before this fix: the validator accepted
    `postgresql+psycopg://rahul@localhost:5432/titlepipe` and
    `…@127.0.0.1/…` without comment. Its docstring defended that as "this
    rejects the accident, not the deliberate act", which holds for a named remote
    host and does not hold for these — `localhost` is what a developer's fingers
    produce, and what is behind it is `roles.sql`, `alembic upgrade`/`downgrade`
    and, on every module teardown, eight `DROP TABLE`s, a `DROP TYPE` and a
    `DROP FUNCTION`.

    So it is refused unless a SECOND, separately-named variable is exported too.
    Two variables cannot both be typed by accident, and the second one is a
    sentence rather than a flag.

    `127.0.0.53` is in the list because `127.0.0.1` is not the loopback network:
    the check goes through `ipaddress`, which knows the whole of `127.0.0.0/8`,
    and `.53` is the systemd-resolved stub a WSL box really does answer on. `::1`
    is there because SQLAlchemy strips the brackets from `[::1]`, so what the
    validator sees is a bare literal that a string comparison would miss.

    The empty case is asserted too. `export VAR=` is how a shell clears a
    variable it has already exported, and it must not read as consent.
    """
    literal = f"[{host}]" if ":" in host else host
    given = f"postgresql://operator@{literal}:5432/titlepipe"

    for cleared in ("", "   "):
        monkeypatch.setenv(loopback_acknowledgement_name, cleared)
        with pytest.raises(ValueError, match=database_url_override_name) as raised:
            normalise_override_dsn(make_url(given))
        assert loopback_acknowledgement_name in str(raised.value), (
            "the refusal must name the variable that lifts it"
        )

    monkeypatch.delenv(loopback_acknowledgement_name, raising=False)
    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        normalise_override_dsn(make_url(given))
    assert host in str(raised.value), "the refusal must name the host it refused"

    monkeypatch.setenv(loopback_acknowledgement_name, "1")
    assert (
        normalise_override_dsn(make_url(given))
        == f"postgresql+psycopg://operator@{literal}:5432/titlepipe"
    )


def test_a_named_remote_host_still_needs_no_acknowledgement(
    monkeypatch: pytest.MonkeyPatch,
    normalise_override_dsn: Callable[[URL], str],
    loopback_acknowledgement_name: str,
) -> None:
    """The line is loopback, not "every host", and the other side has to hold.

    A validator that demanded the acknowledgement for everything would satisfy
    every row above and refuse the one thing this override exists for — an
    operator deliberately pointing the suite at a server they own. The residual
    that remains, and it is stated in `_normalise_override_dsn` rather than
    hidden: naming a remote host here authorises the drops too.

    `10.0.0.5` is here beside a hostname because the literal path and the name
    path are different branches of `_is_loopback`, and only the literal one goes
    through `ipaddress`.
    """
    monkeypatch.delenv(loopback_acknowledgement_name, raising=False)

    for host in ("db.example", "prod-db.internal", "10.0.0.5"):
        assert (
            normalise_override_dsn(make_url(f"postgresql://operator@{host}:5432/titlepipe"))
            == f"postgresql+psycopg://operator@{host}:5432/titlepipe"
        )


def test_a_portless_override_is_refused_at_the_variable_rather_than_at_roles_sql(
    monkeypatch: pytest.MonkeyPatch,
    normalise_override_dsn: Callable[[URL], str],
    database_url_override_name: str,
    loopback_acknowledgement_name: str,
    libpq_environment: Callable[[str], dict[str, str]],
) -> None:
    """Both layers refuse it, and the order in which they do is the point.

    Omitting the port means 5432 — to SQLAlchemy, and to libpq through an empty
    `PGPORT`. On this development box 5432 is the developer's own 18.4 cluster,
    so a portless DSN reaches the same destination the hostless one did, through
    the one field that had been left out of the rule.

    `_libpq_environment` refuses it, and that alone was nearly enough: nothing
    can run `roles.sql` against a portless DSN. But "nearly" is the whole
    problem. That refusal arrives inside `roles_applied`, after `admin_dsn` has
    already decided against the container and after any test requesting only
    `admin_dsn` has already CONNECTED — on 5432, to whatever is listening. So
    the override boundary refuses it too, where the message can name the
    variable the operator exported rather than a SQL file they have never
    opened.

    The acknowledgement variable is cleared first: `db.example` is not loopback,
    so it must not be what makes this refusal happen.
    """
    monkeypatch.delenv(loopback_acknowledgement_name, raising=False)

    with pytest.raises(ValueError, match=database_url_override_name) as raised:
        normalise_override_dsn(make_url("postgresql://operator@db.example/titlepipe"))
    assert "explicit port" in str(raised.value)

    with pytest.raises(ValueError, match="port"):
        libpq_environment("postgresql+psycopg://operator:pw@db.example/titlepipe")

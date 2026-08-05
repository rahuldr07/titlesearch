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

Everything this file needs from `conftest.py` arrives as a fixture. It is not
imported, because `from conftest import ...` only resolves under pytest's
legacy `prepend` import mode — see the comment above those fixtures.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping

import pytest
from sqlalchemy import URL, Connection, create_engine, make_url, text
from sqlalchemy.exc import OperationalError
from testcontainers.community.postgres import PostgresContainer

# PostgreSQL encodes its version as major * 10000 + minor: 18.0 is 180000 and
# 19.0 is 190000, so a half-open range over the pair is exactly "some 18.x".
POSTGRES_18 = 180000
POSTGRES_19 = 190000

# Every role this project owns is `titlepipe_`-prefixed. The `\_` is a literal
# underscore: backslash is LIKE's default escape character, and a bare `_`
# matches any single character, so `titlepipe_%` would also match `titlepipeX…`.
TITLEPIPE_ROLE_PATTERN = r"titlepipe\_%"


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
    admin_dsn: str,
    migration_dsn: str,
    app_dsn: str,
    migration_role: str,
    app_role: str,
    managed_roles: tuple[str, ...],
) -> None:
    """One server, one database, three logins — checked against the catalog.

    The shape half of this used to be the whole of it: three `make_url` calls
    and a set of usernames, which passes against a dead server and would keep
    passing if a later `roles.sql` created `titlepipe_app` as a SUPERUSER. The
    implementation is honest today — nothing in Task 1 creates a role — but
    "honest" and "asserted" are different words, so the live server is asked.

    Task 2 creates these roles and must revisit the emptiness assertion below;
    that it will fail loudly then is the point of writing it this way.
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

    engine = create_engine(admin_dsn)
    try:
        with engine.connect() as connection:
            existing = _roles_matching(connection, TITLEPIPE_ROLE_PATTERN)
    finally:
        engine.dispose()

    assert existing == set(), (
        f"Task 1 must create no roles, but the server already has {sorted(existing)}. "
        f"Roles are Task 2's to create: {sorted(managed_roles)}."
    )


def test_the_role_dsns_cannot_connect_yet(app_dsn: str, app_role: str) -> None:
    """The privilege claim, tested against the server rather than the string.

    `app_dsn` carrying a different username is shape. `app_dsn` being unable to
    open a connection at all, while `admin_dsn` opens one against the same
    server in the test above, is privilege — and it is what makes a silent
    fallback to the superuser impossible to miss.

    What this CANNOT prove is why the connection failed. MEASURED 2026-08-05:
    PostgreSQL answers `password authentication failed for user "..."` both for
    a role that does not exist and for a role whose password is wrong, on
    purpose, so that a stranger cannot enumerate roles. Absence is proved by the
    `pg_roles` query in the test above, which reads the catalog as the superuser
    and is the only authority on it. This test proves non-connectability, and
    that is all it claims.

    Task 2 creates the role and gives it `role_passwords[APP_ROLE]`, at which
    point this connection succeeds and this test is Task 2's to turn into a
    positive one.
    """
    engine = create_engine(app_dsn)
    try:
        with pytest.raises(OperationalError) as raised, engine.connect():
            pass
    finally:
        engine.dispose()

    assert app_role in str(raised.value)


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

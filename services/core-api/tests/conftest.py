"""Shared fixtures.

Every test builds its own app through the factory. There is no module-level app
and no shared mutable state between tests, so a test that changes settings
cannot affect the next one.

The database fixtures at the bottom are the exception to "no shared state": a
PostgreSQL container is session-scoped because starting one per test would cost
more than the rest of the suite put together.
"""

from __future__ import annotations

import os
import secrets
import shutil
import subprocess
from collections.abc import Callable, Iterator, Mapping
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import URL, make_url
from sqlalchemy.exc import ArgumentError

# `testcontainers.postgres` is a deprecated shim that warns on import; the
# module actually holding the class is `testcontainers.community.postgres`.
from testcontainers.community.postgres import PostgresContainer

from titlepipe_core.app import create_app
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import Environment
from titlepipe_test_support import FrozenClock, SequenceIdFactory

# A valid Fernet key — urlsafe-base64 of 32 bytes, 44 characters. The old value
# here was a 32-CHARACTER string, which is the byte count rather than the
# encoded length; it passed only because the validator carried the same error.
DEPLOYED_SEAL_PASSWORD = "YS1yZWFsLWRlcGxveWVkLXNlYWwtc2VjcmV0LTMyYnk="
DEPLOYED_BASE_URL = "https://app.titlepipe.example"  # must match allowed_hosts


@pytest.fixture
def deployed_base_url() -> str:
    """`DEPLOYED_BASE_URL`, injected rather than imported.

    `test_errors.py` used `from conftest import DEPLOYED_BASE_URL`, which
    resolves only under pytest's legacy `prepend` import mode and broke
    collection of the WHOLE suite under `--import-mode=importlib`. The constant
    is kept beside `DEPLOYED_SEAL_PASSWORD` so the two deployed-environment
    values stay together and the comment tying it to `allowed_hosts` still has
    something to sit next to; the fixture is how other modules reach it.
    """
    return DEPLOYED_BASE_URL


@pytest.fixture
def frozen_clock() -> FrozenClock:
    return FrozenClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC))


@pytest.fixture
def id_factory() -> SequenceIdFactory:
    return SequenceIdFactory("req")


@pytest.fixture
def development_settings() -> CoreApiSettings:
    return CoreApiSettings(environment=Environment.TEST)


@pytest.fixture
def production_settings() -> CoreApiSettings:
    """A configuration that actually satisfies the deployed-environment rules."""
    return CoreApiSettings(
        environment=Environment.PRODUCTION,
        host="0.0.0.0",
        debug=False,
        reload=False,
        docs_enabled=False,
        mock_auth_enabled=False,
        redaction_enabled=True,
        cors_allowed_origins=("https://app.titlepipe.example",),
        allowed_hosts=("app.titlepipe.example",),
        cookie_seal_password=SecretStr(DEPLOYED_SEAL_PASSWORD),
    )


@pytest.fixture
def app(
    development_settings: CoreApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> FastAPI:
    return create_app(development_settings, clock=frozen_clock, id_factory=id_factory)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """A client that runs the lifespan, as the real server does."""
    with TestClient(app) as test_client:
        yield test_client


# --- the database seam ------------------------------------------------------
#
# Ruled 2026-08-05: the database under test is an EPHEMERAL CONTAINER, not a
# host cluster. Task 3 drives `upgrade head -> downgrade base -> upgrade head`
# and Task 6 seeds tenants; doing either to a developer's persistent cluster is
# the outcome this ruling exists to prevent, and a container that lives for one
# pytest session cannot suffer it.
#
# CORRECTED 2026-08-05: an earlier version of this comment claimed the host
# cluster "cannot be authenticated to from here, which is deliberate rather
# than a problem to solve". That was concluded from TCP auth failing and `sudo`
# wanting a password, and it is false. This WSL box runs 18.4 on the default
# port and `psql -tAc "select current_user"` returns `rahul` over the unix
# socket by peer auth. NOTHING about this machine keeps the seam off the host
# cluster. Only `_normalise_override_dsn` below does, which is why it validates
# rather than trusts.
#
# There is no `skip` anywhere below. If Docker is unavailable the database tests
# FAIL, because "we did not check isolation today" and "isolation holds" must
# never render the same way in a test report.
#
# Teardown leans on Ryuk, and that dependency is worth naming. Containers do not
# leak across runs even after a hard kill of pytest, but only because the Ryuk
# sidecar reaps whatever carries this session's label — the `with` block below
# never runs on a `SIGKILL`. `TESTCONTAINERS_RYUK_DISABLED=true`, routine in
# rootless and podman CI, removes that net and turns every hard kill into a
# leaked container holding a published port. Somewhere Ryuk cannot start is a CI
# configuration to fix, not a flag to set here.

POSTGRES_IMAGE = "postgres:18.4"
POSTGRESQL_BACKEND = "postgresql"

# The container's own identity, passed explicitly at construction because every
# default `PostgresContainer` has is an `os.environ.get`. See
# `_postgres_container` for the measurement.
#
# Both names sit deliberately OUTSIDE the `titlepipe_` namespace. Every catalog
# assertion in this suite reads `titlepipe\_%`, and a superuser called
# `titlepipe_admin` would be returned by all of them — `rolsuper = false` would
# fail against the container's own superuser, and
# `test_the_three_dsns_are_three_privilege_levels` asserts explicitly that the
# admin username is not in that set.
CONTAINER_SUPERUSER = "seam_admin"
CONTAINER_DATABASE = "seam"

# Entropy for every throwaway credential in this seam — the container's own
# superuser password and each role's in `role_passwords`. `token_urlsafe`
# takes BYTES and renders them urlsafe-base64, so 32 is 256 bits in a 43
# character string whose alphabet needs no percent-encoding inside a DSN.
PASSWORD_BYTES = 32

# The override for anyone aiming at a real server. The name deliberately does
# NOT begin with `TITLEPIPE_`.
#
# Plan 01's stated reason is not the reason, and an earlier comment here said it
# was "proven" below. It is not. The claim was that `env_prefix="TITLEPIPE_"`
# with `extra="forbid"` would make `CoreApiSettings` refuse to construct while
# this variable was exported. MEASURED 2026-08-05 against pydantic-settings
# 2.14.2: `EnvSettingsSource` walks the model's FIELDS and looks each one up in
# the environment. It never walks the environment, so a `TITLEPIPE_` variable
# matching no field is invisible and `extra="forbid"` never sees it. Both
# spellings construct cleanly.
#
# The name is kept on the reason that survives measurement: a harness variable
# that does not share the application's prefix cannot be read as application
# configuration, by a person or by some later settings source that does walk the
# environment. There is no test for that, because there is nothing to assert.
DATABASE_URL_OVERRIDE = "TP_TEST_DATABASE_URL"

# The five roles `migrations/sql/roles.sql` creates.
#
# `titlepipe_owner` is deliberately NOT in `MANAGED_ROLES`, and that is the one
# thing about this block worth reading twice. `MANAGED_ROLES` is the set of
# roles `role_passwords` generates a password FOR, and the owner is `NOLOGIN`:
# it authenticates never, so a password for it would be an unused secret that
# still has to be kept out of logs. `roles.sql` creates it with no password and
# there is no `TITLEPIPE_OWNER_PASSWORD` variable anywhere.
#
# Ownership sitting on a role nothing logs in as is the reason the fifth role
# exists at all: a table's OWNER bypasses row-level security on it unless the
# table is `FORCE ROW LEVEL SECURITY`, so an owner that could also be connected
# as would make Task 4's policies advisory for the connection that matters.
#
# `TITLEPIPE_ROLE_PATTERN` is the LIKE pattern every catalog read uses. The `\_`
# is a LITERAL underscore: backslash is LIKE's default escape character and a
# bare `_` matches any single character, so `titlepipe_%` would also match
# `titlepipeX…`. It lives here rather than in a test module because it was
# duplicated verbatim in two of them, with two near-identical helpers reading
# it — and a LIKE-escape rule that exists twice is one that gets fixed once.
TITLEPIPE_ROLE_PATTERN = r"titlepipe\_%"

OWNER_ROLE = "titlepipe_owner"
MIGRATION_ROLE = "titlepipe_migration"
APP_ROLE = "titlepipe_app"
WORKER_ROLE = "titlepipe_worker"
BLIND_ROLE = "titlepipe_blind"
MANAGED_ROLES = (MIGRATION_ROLE, APP_ROLE, WORKER_ROLE, BLIND_ROLE)

# The environment variables `roles.sql` reads each password from, RESOLVED BY
# THE OWNER 2026-08-05. No value for any of them exists in this repository and
# none is needed: every test injects a `role_passwords` throwaway instead, and a
# real value must never be written down here. `.env.example` names them with
# empty values, as it does every other credential.
ROLE_PASSWORD_VARIABLES: Mapping[str, str] = MappingProxyType(
    {
        MIGRATION_ROLE: "TITLEPIPE_MIGRATION_PASSWORD",
        APP_ROLE: "TITLEPIPE_APP_PASSWORD",
        WORKER_ROLE: "TITLEPIPE_WORKER_PASSWORD",
        BLIND_ROLE: "TITLEPIPE_BLIND_PASSWORD",
    }
)

# `services/core-api/migrations/sql/roles.sql`, resolved from this file rather
# than from `cwd`: the suite is run from the repository root as often as from
# the service directory, and a relative path would work from exactly one of
# them.
ROLES_SQL = Path(__file__).resolve().parent.parent / "migrations" / "sql" / "roles.sql"

# libpq's own spelling of a connection, which is how `roles.sql` is handed a
# server WITHOUT putting a password in `argv`. A DSN on the command line is
# readable by every process on the box through `ps`, and — closer to home —
# `subprocess.CompletedProcess.__repr__` prints `args`, so a failing assertion
# on the result would put the superuser credential in the pytest report. The
# environment is in neither.
LIBPQ_BACKEND = "postgresql"

# SQLAlchemy dropped this alias in 1.4, so its backend name really is `postgres`
# and it is rejected like any other wrong backend. It gets a hint attached
# because, unlike `mysql`, it IS a PostgreSQL URL in libpq's and psql's
# spelling — the operator is right and only the scheme is wrong.
DROPPED_POSTGRES_ALIAS = "postgres"


def _normalise_override_dsn(url: URL) -> str:
    """Validate `TP_TEST_DATABASE_URL`, then name the DBAPI if the operator did not.

    An override that can defeat the rule it lives under is a hole, not an
    override, and this one was. `TP_TEST_DATABASE_URL=postgresql:///postgres`
    has no host, so libpq falls back to the unix socket and peer auth; with
    Docker switched off entirely the whole seam ran green against the
    developer's own 18.4 cluster. That is precisely what the container ruling
    above exists to prevent.

    The order of the checks is load-bearing:

    1. BACKEND, before the driver is touched at all. The previous version tested
       `"+" in url.drivername`, which cannot tell "PostgreSQL, DBAPI unnamed"
       from "not PostgreSQL at all". `sqlite:////tmp/x.db` came out as
       `postgresql+psycopg:////tmp/x.db` and failed as `database "/tmp/x.db"
       does not exist` — an error naming neither sqlite nor this variable, and
       pointing at the host cluster;
    2. HOST, which must be explicit. Hostless is the socket form above. An
       explicit host is still the operator's to get right: this rejects the
       accident, not the deliberate act;
    3. driver, last and only now. A bare `postgresql://` resolves to psycopg2 in
       SQLAlchemy and psycopg2 is deliberately not a dependency, so the DBAPI is
       named. An explicit driver is left alone — someone who asked for a
       different one should get the import error naming it, not a silent rewrite
       to something that happens to work.

    THIS TAKES A PARSED `URL`, NOT THE RAW STRING, AND THAT IS A SECURITY
    PROPERTY RATHER THAN A STYLE CHOICE. pytest's default `--tb=long` prints the
    ARGUMENTS of every frame in a traceback, so while this function took
    `dsn: str` the operator's credential was echoed into the report four times
    on any rejection — as a bare `dsn = '<the whole DSN>'` line, one line above
    the `***`-masked message that was supposed to prevent exactly that. MEASURED
    2026-08-05. `URL.__repr__` is `render_as_string()`, which masks the password
    by default, so a `URL` argument is safe to display where a `str` is not. The
    parse therefore happens in `_override_dsn`, which takes no arguments at all.

    No example credential is written out anywhere in this file, deliberately: a
    literal in a docstring is printed by the same traceback machinery and would
    make `grep` for a leaked secret return hits that are not leaks.

    Every rejection is a `ValueError` naming `TP_TEST_DATABASE_URL`, because the
    developer who exported it is the only one who can fix it.
    """
    # Masked from here on. Everything that can reach a message or a traceback
    # goes through this rather than through the URL's own password field.
    shown = url.render_as_string(hide_password=True)

    backend = url.get_backend_name()
    if backend != POSTGRESQL_BACKEND:
        hint = " — did you mean postgresql://?" if backend == DROPPED_POSTGRES_ALIAS else ""
        raise ValueError(
            f"{DATABASE_URL_OVERRIDE} must name a {POSTGRESQL_BACKEND} server, "
            f"not {backend!r}: {shown}{hint}"
        )

    if not url.host:
        raise ValueError(
            f"{DATABASE_URL_OVERRIDE} must name an explicit host. A hostless URL "
            f"reaches the local cluster over the unix socket, which is the one "
            f"server this seam exists to stay off: {shown}"
        )

    if "+" in url.drivername:
        return url.render_as_string(hide_password=False)
    return url.set(drivername=f"{POSTGRESQL_BACKEND}+psycopg").render_as_string(hide_password=False)


def _override_dsn() -> str | None:
    """The validated value of `TP_TEST_DATABASE_URL`, or `None` when it is unset.

    Exported-but-empty counts as unset. `export TP_TEST_DATABASE_URL=` is how a
    shell clears a variable it has already exported, and rejecting that as an
    unparseable URL would refuse a session that meant to use the container.

    This function takes NO ARGUMENTS and BINDS NO LOCAL holding the raw value,
    which is why the environment is read twice. Both are deliberate. pytest
    prints every traceback frame's arguments by default and its locals under
    `--showlocals`, so a credential that is either one is a credential in the CI
    log — see `_normalise_override_dsn` for the measurement. Reading
    `os.environ` inline inside the `try` keeps the string a temporary that no
    frame display can reach, at the cost of one extra dictionary lookup in the
    rare path where the variable is set at all.

    `from None` is load-bearing for the same reason. Chaining looked safe
    because SQLAlchemy's own message does not quote the input, but its
    `_parse_url` frame takes that input as an ARGUMENT, and the chained
    traceback would have printed it verbatim.
    """
    if not os.environ.get(DATABASE_URL_OVERRIDE, "").strip():
        return None

    try:
        url = make_url(os.environ[DATABASE_URL_OVERRIDE].strip())
    except (ArgumentError, ValueError):
        raise ValueError(f"{DATABASE_URL_OVERRIDE} is not a parseable database URL") from None

    return _normalise_override_dsn(url)


def _postgres_container(password: str) -> PostgresContainer:
    """The container, with every identity field passed explicitly.

    Nothing is left to default, because every default `PostgresContainer` has is
    an `os.environ.get`: `username`, `password` and `dbname` each fall back to
    `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` from the developer's
    own shell when the argument is `None`. MEASURED 2026-08-05 on an otherwise
    correct tree: `POSTGRES_USER=titlepipe_app uv run pytest` renamed the
    container superuser to `titlepipe_app`, collapsing three privilege levels
    into two, and the seam reported the collapse as an ordinary assertion
    failure rather than as the environment leak it was.

    `driver="psycopg"` is load-bearing too: `get_connection_url()` defaults to
    `postgresql+psycopg2://`, naming a DBAPI this service does not install. The
    `[postgres]` extra on testcontainers installs no driver either — the
    connection works because `psycopg[binary]` is a runtime dependency.
    """
    return PostgresContainer(
        POSTGRES_IMAGE,
        username=CONTAINER_SUPERUSER,
        password=password,
        dbname=CONTAINER_DATABASE,
        driver="psycopg",
    )


def _role_dsn(dsn: str, role: str, password: str) -> str:
    """The same server and database, reached as `role` rather than as superuser.

    The password is a throwaway that `role_passwords` generated for this pytest
    session; see that fixture for why it exists and where it must never go.

    The three levels are the whole point of having three fixtures. A superuser
    bypasses RLS unconditionally — `FORCE ROW LEVEL SECURITY` does not stop one
    — so an isolation assertion that quietly fell back to `admin_dsn` would pass
    while proving nothing at all.
    """
    url = make_url(dsn)
    return URL.create(
        drivername=url.drivername,
        username=role,
        password=password,
        host=url.host,
        port=url.port,
        database=url.database,
        query=url.query,
    ).render_as_string(hide_password=False)


def _libpq_environment(dsn: str) -> dict[str, str]:
    """The same server as `dsn`, spelled as the `PG*` variables libpq reads.

    `psql` is given no connection argument at all, for the reason recorded at
    `LIBPQ_BACKEND`: an argument is printed by `CompletedProcess.__repr__` and
    visible in `ps`, and an environment variable is neither.

    THIS VALIDATES RATHER THAN TRUSTS, and that is the same lesson
    `_normalise_override_dsn` above was written for — this function was the same
    hole in a different place. It used to emit `"PGHOST": url.host or ""`, and an
    EMPTY `PGHOST` is not "no host": libpq falls back to the unix socket and peer
    auth. MEASURED 2026-08-05:

        env -i PGHOST= PGUSER= PGPASSWORD= psql -tAc "select current_user, version()"
        -> rahul | PostgreSQL 18.4

    So a DSN missing a host would have pointed `roles.sql` at the developer's own
    cluster. The blast radius is strictly worse than the override's, because what
    runs there is `CREATE ROLE`, `ALTER ROLE`, `REVOKE` and `GRANT` against a
    server nobody destroys at the end of the session.

    Host, user and database are each required for the same reason: an empty
    `PGUSER` becomes the OS user under peer auth, and an empty `PGDATABASE`
    becomes a database named after that user. Only `PGPASSWORD` may legitimately
    be empty — a DSN can carry its credential in `.pgpass` — and it is the one
    field that cannot redirect the connection anywhere.
    """
    url = make_url(dsn)

    for field, value in (
        ("host", url.host),
        ("username", url.username),
        ("database", url.database),
    ):
        if not value:
            raise ValueError(
                f"refusing to run roles.sql: the target DSN has no {field}, and a "
                f"libpq connection missing one reaches the LOCAL cluster over the "
                f"unix socket — the one server this harness must never write to: "
                f"{url.render_as_string(hide_password=True)}"
            )

    return {
        "PGHOST": url.host or "",
        "PGPORT": str(url.port) if url.port is not None else "",
        "PGUSER": url.username or "",
        "PGPASSWORD": url.password or "",
        "PGDATABASE": url.database or "",
    }


def _apply_roles_sql(dsn: str, passwords: Mapping[str, str]) -> subprocess.CompletedProcess[str]:
    """Run `migrations/sql/roles.sql` against `dsn`, with `passwords` in the environment.

    `psql` rather than psycopg, and that is forced rather than chosen.
    `roles.sql` must take its passwords from the environment and name the
    variables in the file, and the SERVER cannot read the client's environment —
    `\\getenv` is the only mechanism that can, and it is a psql meta-command. A
    file executed through psycopg would have to have its secrets substituted in
    by the caller, which is the literal this task exists to avoid.

    There is no `skip` here and no fallback. A missing `psql` raises, because
    "we could not check the roles today" and "the roles are correct" must not
    render the same way in a test report.

    `env` is BUILT rather than inherited-and-updated for the four password
    variables: a developer who happens to export `TITLEPIPE_APP_PASSWORD` for
    their own cluster would otherwise silently repair the very omission that
    `test_roles_sql_refuses_and_names_every_variable_it_is_missing` withholds on
    purpose, and the test would pass against a `roles.sql` with no guard in it
    at all. Every `PG*` variable is dropped for the same reason — one exported
    `PGHOST` and the script runs somewhere else entirely.

    RESIDUAL, STATED: `passwords` is an argument, so a failure inside this
    function prints it. That is the residual `role_passwords` already accepts
    and bounds — these belong to a container that no longer exists by the time
    anyone reads the log.
    """
    psql = shutil.which("psql")
    if psql is None:
        raise RuntimeError(
            "psql is not on PATH, so roles.sql cannot be applied and the role "
            "contract has not been checked. Install the PostgreSQL client."
        )

    inherited = {
        name: value
        for name, value in os.environ.items()
        if not name.startswith("PG") and name not in set(ROLE_PASSWORD_VARIABLES.values())
    }
    environment = {
        **inherited,
        **_libpq_environment(dsn),
        **{ROLE_PASSWORD_VARIABLES[role]: password for role, password in passwords.items()},
    }

    # S603 wants the argument vector checked for untrusted input. Every element
    # of it is a constant in this file or `shutil.which`'s answer; the two
    # values that vary — the server and the passwords — are in `env`, which is
    # not a shell and is not word-split. There is no `shell=True` here and there
    # must never be one.
    return subprocess.run(  # noqa: S603
        [psql, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-f", str(ROLES_SQL)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.fixture(scope="session")
def role_passwords() -> Mapping[str, str]:
    """role -> a throwaway password, generated once per pytest session.

    RULED by the owner 2026-08-05. `_role_dsn` used to hardcode `password=None`,
    which would have forced Task 2 to rewrite this seam rather than fill it in:
    the container authenticates published-port connections with `scram-sha-256`,
    so `titlepipe_migration` and `titlepipe_app` need real passwords the moment
    they exist.

    Generated, never configured. These values are never written to disk, never
    committed, never logged, and never put into an assertion message — they
    belong to a container that is destroyed when the session ends, and the next
    session's are different. `secrets.token_urlsafe` is the CSPRNG spelling; see
    `PASSWORD_BYTES` for the width and why the alphabet matters here.

    Distinct per role on purpose. One shared password across the roles would
    undo the privilege separation the roles exist to provide: any holder of the
    `titlepipe_app` credential could then log in as `titlepipe_migration`.

    THIS MAPPING IS THE SEAM TASK 2 CONSUMES. `roles.sql` needs the same values
    to `CREATE ROLE ... PASSWORD`, and requesting this fixture is how it gets
    them — no redesign required. Adding a role means adding it to
    `MANAGED_ROLES`; nothing else here changes.

    RESIDUAL, ACCEPTED AND STATED: on a FAILURE, pytest prints each frame's
    arguments, so a failing test that takes `app_dsn`, `migration_dsn` or this
    mapping will print these values in cleartext. That is not fixable while the
    DSN fixtures are `str` — a DSN with the password redacted is not a DSN, and
    `create_engine` in Tasks 2-5 needs the real one. Wrapping this mapping in
    `SecretStr` while `app_dsn` prints the same secret in full would be masking
    the surface that was checked rather than the one that leaks, which is the
    error this seam has already been corrected for once.

    What makes that acceptable here and NOT acceptable for the override in
    `_normalise_override_dsn` is whose secret it is. These belong to a container
    that no longer exists by the time anyone reads the log, and the next session
    generates different ones. `TP_TEST_DATABASE_URL` holds a credential to a
    server the operator still owns.
    """
    return MappingProxyType({role: secrets.token_urlsafe(PASSWORD_BYTES) for role in MANAGED_ROLES})


@pytest.fixture(scope="session")
def admin_dsn() -> Iterator[str]:
    """Superuser. `roles.sql`, seeding, and the catalog reads those need.

    Never used for an isolation assertion.
    """
    override = _override_dsn()
    if override is not None:
        yield override
        return

    with _postgres_container(secrets.token_urlsafe(PASSWORD_BYTES)) as container:
        yield container.get_connection_url()


@pytest.fixture(scope="session")
def migration_dsn(admin_dsn: str, role_passwords: Mapping[str, str]) -> str:
    """`titlepipe_migration` — Alembic, and nothing else. Not connectable yet."""
    return _role_dsn(admin_dsn, MIGRATION_ROLE, role_passwords[MIGRATION_ROLE])


@pytest.fixture(scope="session")
def app_dsn(admin_dsn: str, role_passwords: Mapping[str, str]) -> str:
    """`titlepipe_app` — every isolation assertion. Not connectable yet."""
    return _role_dsn(admin_dsn, APP_ROLE, role_passwords[APP_ROLE])


@pytest.fixture(scope="session")
def roles_applied(admin_dsn: str, role_passwords: Mapping[str, str]) -> str:
    """`roles.sql`, run once per session as the superuser. Yields `admin_dsn`.
    ---------------------------------------------------------------------------
    🔴 EVERY TEST THAT NEEDS A ROLE TO EXIST MUST REQUEST THIS FIXTURE, EVEN IF
       IT NEVER READS THE VALUE. NOT REQUESTING IT IS AN ORDERING BUG.
    ---------------------------------------------------------------------------
    This is not a style rule, and it has already gone wrong twice.

    `migration_dsn` and `app_dsn` depend on `admin_dsn`, NOT on this fixture, so
    a test taking only `app_dsn` runs against a server where `titlepipe_app` may
    not exist yet. It then fails at `connect()` with `password authentication
    failed`, which reads like a broken password rather than a missing
    dependency — PostgreSQL answers identically for an absent role and a wrong
    one, deliberately, so the error cannot tell you which it was.

    THE HISTORY. Applying `roles.sql` falsified two assertions Task 1 had
    written about Task 1 — that the catalog held no `titlepipe\\_%` role, and
    that the role DSNs could not connect. Task 1's own docstrings said Task 2
    would have to invert them, and Task 2 did. But for a while both were left
    standing, and the suite was GREEN: this fixture is lazy, only `test_roles.py`
    requested it, and pytest collects that after `test_database_seam.py`. A
    latent green — it would have survived until someone added a filename sorting
    between the two, ran a subset, or enabled `pytest-randomly` or xdist.

    Both tests in `test_database_seam.py` now request this fixture, so the
    result is identical in either direction. Verified in both orders, and with
    each file alone.

    `autouse` was considered and REJECTED. It would make the dependency
    impossible to forget, but it would also start a Docker container for
    `test_settings.py`, which never opens a connection.

    ---------------------------------------------------------------------------

    Session-scoped because `roles.sql` is idempotent and cheap, and because the
    roles are cluster state that every later database test wants already there.
    The roles are NOT dropped at teardown: the container is, which is the whole
    point of the container ruling above.
    """
    result = _apply_roles_sql(admin_dsn, role_passwords)
    if result.returncode != 0:
        raise RuntimeError(
            f"roles.sql exited {result.returncode}; no role contract has been "
            f"established.\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return admin_dsn


# --- what the seam tests would otherwise import ------------------------------
#
# `test_database_seam.py` used `from conftest import ...`. That works only under
# pytest's legacy `prepend` import mode, which puts the rootdir of each test
# file on `sys.path`. Under `--import-mode=importlib`, pytest's own documented
# preference, collection died outright:
# `ModuleNotFoundError: No module named 'conftest'`. Fixtures are injected
# correctly under every import mode, so everything the tests need is handed over
# as a fixture instead.
#
# Each one is deliberately a plain `str`, `tuple[str, ...]`, `Mapping[str, str]`
# or `Callable[...]`. That is the actual constraint, not tidiness: a test has to
# spell the type of its own parameter, and a type defined in this file would be
# just as unimportable as the constants were. Every annotation below comes from
# the standard library or from a real installed package.
#
# REJECTED 2026-08-05: moving the constants and helpers to `libs/test-support`
# instead. That package's only dependency is `titlepipe-domain`, and
# `blind-svc`, `extraction-svc` and `render-svc` all depend on it while none of
# them has a database. Putting `sqlalchemy` and `testcontainers` in there would
# install a PostgreSQL driver into three services that never open a connection,
# and every one of their locks would carry it. The move becomes right the day a
# SECOND service needs these DSN rules — at that point the rules are genuinely
# shared and the dependency earns its place. Not before.


@pytest.fixture(scope="session")
def database_url_override_name() -> str:
    """The environment variable `admin_dsn` honours."""
    return DATABASE_URL_OVERRIDE


@pytest.fixture(scope="session")
def normalise_override_dsn() -> Callable[[URL], str]:
    """The override validator itself, so its rejections can be tested directly."""
    return _normalise_override_dsn


@pytest.fixture(scope="session")
def override_dsn_from_environment() -> Callable[[], str | None]:
    """The environment read `admin_dsn` performs, so the wiring can be tested."""
    return _override_dsn


@pytest.fixture(scope="session")
def postgres_container_factory() -> Callable[[str], PostgresContainer]:
    """The container constructor, unstarted, so its identity can be asserted."""
    return _postgres_container


@pytest.fixture(scope="session")
def container_superuser() -> str:
    return CONTAINER_SUPERUSER


@pytest.fixture(scope="session")
def container_database() -> str:
    return CONTAINER_DATABASE


@pytest.fixture(scope="session")
def migration_role() -> str:
    return MIGRATION_ROLE


@pytest.fixture(scope="session")
def app_role() -> str:
    return APP_ROLE


@pytest.fixture(scope="session")
def owner_role() -> str:
    """`titlepipe_owner`. Not in `MANAGED_ROLES` — see that constant for why."""
    return OWNER_ROLE


@pytest.fixture(scope="session")
def managed_roles() -> tuple[str, ...]:
    """Every role that `roles.sql` gives a password to, and only those.

    NOT every role `roles.sql` creates: `titlepipe_owner` is `NOLOGIN` and has
    no password, so it is `owner_role` instead. The name is kept because this is
    the seam `role_passwords` is keyed on and renaming it would touch tests this
    task does not own.
    """
    return MANAGED_ROLES


@pytest.fixture(scope="session")
def role_password_variables() -> Mapping[str, str]:
    """role -> the environment variable `roles.sql` reads its password from."""
    return ROLE_PASSWORD_VARIABLES


@pytest.fixture(scope="session")
def roles_sql_path() -> Path:
    """`migrations/sql/roles.sql`, so a test can assert on the file itself."""
    return ROLES_SQL


@pytest.fixture(scope="session")
def titlepipe_role_pattern() -> str:
    """The LIKE pattern for `titlepipe_*` roles, escaping included."""
    return TITLEPIPE_ROLE_PATTERN


@pytest.fixture(scope="session")
def libpq_environment() -> Callable[[str], dict[str, str]]:
    """The DSN -> `PG*` translation `roles.sql` is run under, so it can be tested.

    It refuses a DSN that would reach the local cluster over the unix socket;
    that refusal is the reason this is exposed at all.
    """
    return _libpq_environment


@pytest.fixture(scope="session")
def apply_roles_sql() -> Callable[[str, Mapping[str, str]], subprocess.CompletedProcess[str]]:
    """Run `roles.sql` with an arbitrary password mapping.

    `roles_applied` is the ordinary way in and runs it once with everything
    supplied. This is the handle for the tests that must run it WRONG — with a
    variable withheld or exported empty — and read the refusal.
    """
    return _apply_roles_sql


@pytest.fixture(scope="session")
def role_dsn() -> Callable[[str, str, str], str]:
    """`(dsn, role, password) -> dsn`, so a test can reach the server as any role.

    `migration_dsn` and `app_dsn` are the two with fixtures of their own because
    they are the two Task 1 needed. `titlepipe_worker` and `titlepipe_blind`
    exist from Task 2 on and are reached through this rather than through two
    more near-identical fixtures.
    """
    return _role_dsn

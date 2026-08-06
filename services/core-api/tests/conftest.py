"""Shared fixtures.

Every test builds its own app through the factory. There is no module-level app
and no shared mutable state between tests, so a test that changes settings
cannot affect the next one.

The database fixtures at the bottom are the exception to "no shared state": a
PostgreSQL container is session-scoped because starting one per test would cost
more than the rest of the suite put together.
"""

from __future__ import annotations

import ipaddress
import os
import secrets
import shutil
import subprocess
from collections.abc import Callable, Iterator, Mapping
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType
from uuid import UUID

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import URL, Engine, create_engine, make_url, text
from sqlalchemy.exc import ArgumentError, SQLAlchemyError

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

# The ONLY query-string keys `TP_TEST_DATABASE_URL` may carry, and this is an
# ALLOWLIST rather than a denylist on purpose.
#
# THE HOLE IT CLOSES, MEASURED 2026-08-05 (third of this shape in this file):
#
#     TP_TEST_DATABASE_URL='postgresql://rahul@bogus.invalid:5432/postgres?host=/var/run/postgresql'
#     uv run pytest tests/test_database_seam.py -k postgresql_18   ->  1 passed
#
# `bogus.invalid` does not resolve, and the run still passed — because
# SQLAlchemy's psycopg dialect merges the URL's query into the DBAPI connect
# kwargs, where libpq's own `host=` OVERRIDES the host in the URL. The seam ran
# against the developer's real 18.4 cluster over the unix socket by peer auth,
# with `_normalise_override_dsn` looking only at `url.host` and never at
# `url.query`. `?hostaddr=` does the same thing over TCP.
#
# A denylist is the wrong shape here: libpq's parameter keyword list grows every
# release, and each new one is a hole that opens by itself. The allowlist holds
# only keys that cannot move the connection anywhere — `sslmode` and
# `connect_timeout` change HOW the connection is made, `application_name`
# changes only what the server logs. Adding a key needs a measured reason that
# it cannot redirect a connection.
#
# `hostaddr`, `host`, `port`, `dbname`, `user`, `passfile`, `service` and
# `options` are all absent for that reason. `service` deserves its own mention:
# it names a stanza in a service file that can supply every one of the others.
OVERRIDE_QUERY_ALLOWLIST = frozenset({"application_name", "connect_timeout", "sslmode"})

# The second, separately-named variable that makes a loopback override legal.
#
# `postgresql+psycopg://rahul@localhost:5432/titlepipe` used to be ACCEPTED —
# measured, along with `…@127.0.0.1/…`. The validator's docstring defends
# accepting an explicit host as "the deliberate act", and for a named remote
# host that holds. `localhost` is not that: it is the accident-shaped spelling,
# the value a developer's muscle memory produces, and what runs behind it is not
# a read. See `_scrub_migration_objects` — eight `DROP TABLE`s, a `DROP TYPE` and
# a `DROP FUNCTION`, on every module teardown.
#
# Deliberately verbose and deliberately unlike anything a tool exports on its
# own: it has to be a sentence someone typed on purpose. It does not begin with
# `TITLEPIPE_`, for the reason recorded at `DATABASE_URL_OVERRIDE`.
LOOPBACK_ACKNOWLEDGEMENT = "TP_TEST_DATABASE_URL_LOOPBACK_IS_DELIBERATE"

# The tenant GUC, and the value that means "no tenant established".
#
# Task 6 owns the policies; what is owned HERE is the floor they stand on.
# `models.py` writes every tenant predicate as
# `nullif(current_setting('app.current_tenant', true), '')::uuid`, so the whole
# invariant is: nothing established -> `''` -> `nullif` -> NULL -> no row
# matches -> deny.
#
# `PGOPTIONS` replaces that floor with a VALID TENANT. MEASURED 2026-08-05:
#
#     PGOPTIONS='-c app.current_tenant=22222222-2222-2222-2222-222222222222' \
#       psql -tAc "select current_setting('app.current_tenant',true)"
#     -> 22222222-2222-2222-2222-222222222222
#
#     # same variable exported, through SQLAlchemy:
#     create_engine("postgresql+psycopg://@/postgres")                  -> '2222…'
#     create_engine(..., connect_args={"options": "-c app.current_tenant="}) -> ''
#
# The preset is CONNECTION-scoped, so it survives `SET LOCAL` plus a rollback on
# a pooled connection — a Task 6 test could then prove isolation against a
# connection that was never actually denied. `PGSERVICE` + `PGSERVICEFILE`
# inject the identical thing through a service file's `options=` key.
#
# Two layers answer it, because either alone is one exported variable from being
# wrong: `_no_libpq_environment` strips every `PG*` key from the pytest process,
# and `SEAM_CONNECT_ARGS` pins the value at connect time so that even a
# `PGOPTIONS` that got past the first layer is overridden — libpq's `options`
# connection parameter is what `PGOPTIONS` is only the DEFAULT for.
TENANT_GUC = "app.current_tenant"
TENANT_DENY_SENTINEL = ""

# Passed to every engine this file builds. `-c <guc>=` sets the GUC to the empty
# string at connection start, which is the deny sentinel above; only `SET LOCAL`
# can move it after that.
SEAM_CONNECT_ARGS: Mapping[str, str] = MappingProxyType(
    {"options": f"-c {TENANT_GUC}={TENANT_DENY_SENTINEL}"}
)

# Bounds on `roles.sql`, because unbounded was the real behaviour.
#
# `subprocess.run` was called with `capture_output`, `text` and `check` and NO
# `timeout`, and libpq's own `connect_timeout` is unset — meaning infinite — by
# default. `_apply_roles_sql` then strips every `PG*` variable from the child's
# environment, which removes the one thing an operator could have set to bound
# it. MEASURED 2026-08-05, `10.255.255.1` being a blackhole from this box:
#
#     env -i PATH=… PGHOST=10.255.255.1 PGPORT=5432 PGUSER=operator PGDATABASE=tp \
#       timeout 20 psql --no-psqlrc --quiet -tAc "select 1"
#     -> shell exit 124            # i.e. still connecting when the ceiling hit
#
#     …the same with PGCONNECT_TIMEOUT=5
#     -> psql: error: … "10.255.255.1", port 5432 failed: timeout expired, after 5s
#
# `roles_applied` is session-scoped, so the first of those is the whole suite
# hung with no output and nothing to read — `capture_output=True` means even
# psql's own progress goes nowhere.
#
# `PGCONNECT_TIMEOUT` bounds the CONNECT; the `subprocess` timeout bounds
# everything, including a server that accepts the connection and then never
# answers. Both are needed and neither subsumes the other.
#
# CORRECTED: an earlier draft of this comment said libpq rounds
# `connect_timeout` values below 2 up to 2, which is what the older
# documentation says. MEASURED on this box's libpq (PostgreSQL 18.4) against the
# same blackhole: `PGCONNECT_TIMEOUT=1` gave up after 1s and `=2` after 2s. The
# floor is not there, so 5 is chosen for the reason it looks like — a container
# on loopback that may still be warming up — and not to clear a rounding rule.
# The outer bound is generous for the same reason: `roles.sql` does real work.
LIBPQ_CONNECT_TIMEOUT_SECONDS = 5
ROLES_SQL_TIMEOUT_SECONDS = 60.0

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

# DELETED 2026-08-05: `LIBPQ_BACKEND = "postgresql"`. It was a character-for-
# character duplicate of `POSTGRESQL_BACKEND` above, was never compared against
# anything, and its only reference in the whole tree was its own name inside
# `_libpq_environment`'s docstring — a constant whose sole purpose was to be a
# place to hang a comment. The comment was worth keeping and is now the second
# paragraph of that docstring, where the thing it explains actually happens.

# SQLAlchemy dropped this alias in 1.4, so its backend name really is `postgres`
# and it is rejected like any other wrong backend. It gets a hint attached
# because, unlike `mysql`, it IS a PostgreSQL URL in libpq's and psql's
# spelling — the operator is right and only the scheme is wrong.
DROPPED_POSTGRES_ALIAS = "postgres"


def _is_loopback(host: str) -> bool:
    """Does `host` name this machine?

    Two answers, because a host is either a literal address or a name and there
    is no third case worth guessing at here.

    Literals go through `ipaddress`, which gets the whole of `127.0.0.0/8`
    rather than the one address people write. MEASURED 2026-08-05 on CPython
    3.13: `ip_address("127.0.0.53").is_loopback` is `True` — that is the
    systemd-resolved stub, a real thing a WSL box answers on — and so is
    `ip_address("::ffff:127.0.0.1").is_loopback`, so the IPv4-mapped IPv6 form
    needs no special case. `make_url` strips the brackets from `[::1]`, so what
    arrives here is already the bare literal.

    NAMES are matched against exactly `localhost` and its `.localdomain` form,
    and this deliberately does NOT resolve. Resolution would make the answer
    depend on the developer's `/etc/hosts` and on DNS being up, so the same DSN
    could be refused on one machine and accepted on another — and a refusal that
    is not reproducible is a refusal nobody trusts. A name that resolves to
    loopback and is not spelled `localhost` is out of scope by the same
    accident-versus-deliberate line the caller draws: nobody types
    `db.example.com` by muscle memory believing it is somewhere else.
    """
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return host.lower() in {"localhost", "localhost.localdomain"}


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
    2. QUERY STRING, and it must come BEFORE the host check rather than after.
       `?host=` and `?hostaddr=` reach the DBAPI as libpq connect keywords and
       OVERRIDE the URL's host, so `url.host` is not yet known to mean anything
       while an unvetted query is still attached. Checking the host first would
       be validating a field the next component can move. See
       `OVERRIDE_QUERY_ALLOWLIST` for the measurement — this was the third
       instance of the same shape of hole in this one function;
    3. HOST, which must be explicit and must not be loopback. Hostless is the
       socket form above. Loopback needs the acknowledgement variable, because
       `localhost` is what a developer's muscle memory types rather than what a
       deliberate act looks like. A named remote host is still the operator's to
       get right: THAT is the accident-vs-deliberate line this draws, and the
       residual below says what is behind it;
    4. PORT, which must also be explicit. `_libpq_environment` already refuses a
       portless DSN — an empty `PGPORT` is 5432 to libpq, exactly as an empty
       `PGHOST` was the unix socket — but it refuses it at `roles.sql`, which is
       the middle of a session and several fixtures after the operator's
       mistake. Refusing here names the variable instead of naming the SQL file;
    5. driver, last and only now. A bare `postgresql://` resolves to psycopg2 in
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

    RESIDUAL, STATED IN FULL. The earlier version of this paragraph said only
    that an explicit host "is the operator's to get right", which understated
    what an accepted DSN authorises. Behind this validator run, against whatever
    server it lets through: `migrations/sql/roles.sql` (`CREATE ROLE`,
    `ALTER ROLE`, `REVOKE`, `GRANT` — including
    `ALTER ROLE titlepipe_owner LOGIN BYPASSRLS PASSWORD …` and a `dba` role),
    `alembic upgrade head` and `downgrade base`, and — on EVERY module teardown,
    unconditionally, whether or not anything failed — `_scrub_migration_objects`:
    eight `DROP TABLE IF EXISTS`, one `DROP TYPE IF EXISTS`, one
    `DROP FUNCTION IF EXISTS`. Naming a server here is authorising all of that,
    which is why loopback now needs a second variable and why the container is
    the default.
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

    for key in url.query:
        if key not in OVERRIDE_QUERY_ALLOWLIST:
            raise ValueError(
                f"{DATABASE_URL_OVERRIDE} carries the query parameter {key!r}, which "
                f"is not one of the {sorted(OVERRIDE_QUERY_ALLOWLIST)} this seam "
                f"allows. SQLAlchemy hands the query straight to libpq as connect "
                f"keywords, where host, hostaddr, dbname, user, service and options "
                f"OVERRIDE what the URL says — so a query parameter can silently "
                f"point this run at a different server than the one written here, "
                f"and the psql child would still go to the URL's: {shown}"
            )

    if not url.host:
        raise ValueError(
            f"{DATABASE_URL_OVERRIDE} must name an explicit host. A hostless URL "
            f"reaches the local cluster over the unix socket, which is the one "
            f"server this seam exists to stay off: {shown}"
        )

    if _is_loopback(url.host) and not os.environ.get(LOOPBACK_ACKNOWLEDGEMENT, "").strip():
        raise ValueError(
            f"{DATABASE_URL_OVERRIDE} names the loopback host {url.host!r}, which is "
            f"the developer's own cluster in every spelling but the socket one. This "
            f"seam runs roles.sql, alembic upgrade/downgrade and — on every module "
            f"teardown — eight DROP TABLEs, a DROP TYPE and a DROP FUNCTION against "
            f"whatever it is pointed at. Export "
            f"{LOOPBACK_ACKNOWLEDGEMENT}=1 as well if that is genuinely what you "
            f"want: {shown}"
        )

    if url.port is None:
        raise ValueError(
            f"{DATABASE_URL_OVERRIDE} must name an explicit port. Omitting it means "
            f"5432 to SQLAlchemy and to libpq alike, which on a development box is "
            f"the developer's own cluster — and `_libpq_environment` refuses a "
            f"portless DSN outright, so a run that got past here would die halfway "
            f"through the session at roles.sql instead of at the variable that "
            f"caused it: {shown}"
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

    THE QUERY IS DROPPED, NOT COPIED, and that is the point this helper was
    corrected on. It used to pass `query=url.query` through. A query parameter
    is not decoration: SQLAlchemy's psycopg dialect merges it into the connect
    keywords, and libpq's `host`, `hostaddr`, `dbname`, `user`, `service` and
    `options` each override the field of the same name in the URL. Propagating
    it meant that a `?host=` on `admin_dsn` — which the validator now refuses,
    but which nothing else here would have noticed — moved every role connection
    somewhere the role fields say nothing about. Dropping it makes the returned
    DSN mean exactly the six fields it spells out.

    `_normalise_override_dsn` allows three inert keys through (`sslmode`,
    `connect_timeout`, `application_name`), and those are dropped here as well.
    That is a knowing simplification rather than an oversight: none of them can
    change WHERE the connection goes, and re-adding one is a two-line change on
    the day a test actually needs it.
    """
    url = make_url(dsn)
    return URL.create(
        drivername=url.drivername,
        username=role,
        password=password,
        host=url.host,
        port=url.port,
        database=url.database,
    ).render_as_string(hide_password=False)


def _seam_engine(dsn: str) -> Engine:
    """`create_engine`, with the tenant GUC pinned to the deny sentinel.

    Every engine this file builds goes through here, and the reason is recorded
    at `TENANT_GUC`: an exported `PGOPTIONS` (or a `PGSERVICE` pointing at a
    service file with an `options=` key) presets `app.current_tenant` to a VALID
    tenant on every connection, connection-scoped, surviving `SET LOCAL` and
    rollback. `_no_libpq_environment` removes those variables from the pytest
    process; this pins the value at connect time so that even one that got past
    the scrub is overridden, because libpq's `options` connection parameter is
    what `PGOPTIONS` is merely the default for.

    Not a fixture, because `_scrub_migration_objects` runs inside a teardown and
    cannot request one.
    """
    return create_engine(dsn, connect_args=dict(SEAM_CONNECT_ARGS))


def _libpq_environment(dsn: str) -> dict[str, str]:
    """The same server as `dsn`, spelled as the `PG*` variables libpq reads.

    `psql` is given no connection argument at all. A DSN on the command line is
    readable by every process on the box through `ps`, and — closer to home —
    `subprocess.CompletedProcess.__repr__` prints `args`, so a failing assertion
    on the result would put the superuser credential straight into the pytest
    report. The environment is in neither. (That paragraph used to hang off a
    `LIBPQ_BACKEND` constant that existed only to carry it; the constant is
    gone, the reason is here.)

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

    Host, user, database AND PORT are each required for the same reason: libpq
    treats an empty value and an unset one identically and substitutes its
    default. An empty `PGUSER` becomes the OS user under peer auth, an empty
    `PGDATABASE` becomes a database named after that user, and an empty `PGPORT`
    is 5432. Port was the one left out of the rule, which made it the `PGHOST=""`
    bug two paragraphs up wearing a different field name. MEASURED 2026-08-05:

        env -i PATH=… PGHOST=127.0.0.1 PGPORT= PGUSER=… PGDATABASE=… psql -w …
        -> connection to server at "127.0.0.1", port 5432 failed: …

    — libpq names 5432 in its own error, having been given nothing. On this
    development box 5432 is the developer's 18.4 cluster. Only `PGPASSWORD` may
    legitimately be empty — a DSN can carry its credential in `.pgpass` — and it
    is the one field that cannot redirect the connection anywhere.

    A NON-EMPTY QUERY IS REFUSED OUTRIGHT rather than translated. This function
    reads only the URL's structural fields, so a `?host=/var/run/postgresql`
    that SQLAlchemy WOULD honour is invisible here — which means psql and every
    `create_engine` in the suite would target DIFFERENT SERVERS from the same
    DSN, `roles.sql` landing on one and Alembic on the other. A DSN whose two
    consumers can disagree must not be runnable at all, so this refuses instead
    of guessing. `_normalise_override_dsn` lets three inert keys past
    (`sslmode`, `connect_timeout`, `application_name`) and `_role_dsn` drops
    them, so nothing in the seam reaches here with a query today; the day one
    genuinely has to, the fix is to translate that key into its `PG*` spelling
    (`PGSSLMODE`, `PGCONNECT_TIMEOUT`, `PGAPPNAME`) here — not to relax this.

    `PGCONNECT_TIMEOUT` is SUPPLIED rather than merely permitted. `_apply_roles_sql`
    strips every `PG*` variable from the child's environment, which removes the
    operator's own bound along with the dangerous ones, and libpq's default
    `connect_timeout` is infinite; see `LIBPQ_CONNECT_TIMEOUT_SECONDS`.
    """
    url = make_url(dsn)

    if url.query:
        raise ValueError(
            f"refusing to run roles.sql: the target DSN carries the query "
            f"parameter(s) {sorted(url.query)}, which SQLAlchemy passes to libpq as "
            f"connect keywords but this function cannot see. psql and every "
            f"create_engine in this suite would then be aimed at different servers "
            f"from one DSN: {url.render_as_string(hide_password=True)}"
        )

    environment = {
        "PGHOST": url.host or "",
        "PGPORT": "" if url.port is None else str(url.port),
        "PGUSER": url.username or "",
        "PGPASSWORD": url.password or "",
        "PGDATABASE": url.database or "",
        "PGCONNECT_TIMEOUT": str(LIBPQ_CONNECT_TIMEOUT_SECONDS),
    }

    # Port is checked LAST, and the position is not arbitrary.
    # `tests/test_roles.py::test_the_libpq_environment_refuses_a_dsn_that_reaches_the_local_cluster`
    # feeds `postgresql+psycopg://db.example/titlepipe` expecting the word
    # "username" and `postgresql+psycopg://operator@db.example` expecting
    # "database" — and both of those are ALSO portless, so a port check placed
    # earlier would answer "port" to a question about the username and break a
    # test file this task does not own. Order changes which of several true
    # refusals is reported; it changes nothing about what is accepted.
    for variable, field in (
        ("PGHOST", "host"),
        ("PGUSER", "username"),
        ("PGDATABASE", "database"),
        ("PGPORT", "port"),
    ):
        if not environment[variable]:
            raise ValueError(
                f"refusing to run roles.sql: the target DSN has no {field}, and a "
                f"libpq connection missing one reaches the LOCAL cluster over the "
                f"unix socket or its default port — the one server this harness must "
                f"never write to: {url.render_as_string(hide_password=True)}"
            )

    return environment


def _apply_roles_sql(
    dsn: str,
    passwords: Mapping[str, str],
    timeout: float = ROLES_SQL_TIMEOUT_SECONDS,
) -> subprocess.CompletedProcess[str]:
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

    `timeout` IS BOUNDED, AND UNBOUNDED WAS THE REAL BEHAVIOUR. See
    `ROLES_SQL_TIMEOUT_SECONDS` for the measurement — psql still connecting to a
    blackholed host when a 20-second ceiling killed it, with `roles_applied`
    being session-scoped so nothing else in the suite could even start, and
    `capture_output=True` so it printed nothing while it waited. It is a
    parameter rather than
    a constant read inside so that
    `test_roles_sql_that_never_returns_is_bounded_and_names_only_the_host` can
    drive it in a second instead of in a minute.

    RESIDUAL, STATED: `passwords` is an argument, so a failure inside this
    function prints it. That is the residual `role_passwords` already accepts
    and bounds — these belong to a container that no longer exists by the time
    anyone reads the log. `dsn` is an argument on the same terms.
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

    try:
        # S603 wants the argument vector checked for untrusted input. Every
        # element of it is a constant in this file or `shutil.which`'s answer;
        # the two values that vary — the server and the passwords — are in
        # `env`, which is not a shell and is not word-split. There is no
        # `shell=True` here and there must never be one.
        return subprocess.run(  # noqa: S603
            [psql, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-f", str(ROLES_SQL)],
            env=environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        # THE HOST, NEVER THE DSN. The whole point of putting the connection in
        # `env` was to keep the credential out of anything printable, and a
        # timeout message quoting `dsn` would hand it back on the one path where
        # an operator is guaranteed to be reading the output.
        #
        # `from None` is load-bearing rather than tidy. The chained traceback
        # would print `subprocess.run`'s own frames, and `env` is one of their
        # ARGUMENTS — that dictionary holds `PGPASSWORD` (the superuser's) and
        # all four role passwords. Suppressing the chain removes every one of
        # them from the report. What it cannot remove is this function's own
        # frame, whose `dsn` and `passwords` arguments are the residual stated
        # above.
        raise RuntimeError(
            f"roles.sql did not finish within {timeout} seconds against host "
            f"{make_url(dsn).host!r}, so no role contract has been established. "
            f"The DSN is deliberately not quoted here. A server that accepts a "
            f"connection and never answers, or a host that blackholes the SYN, "
            f"looks exactly like this."
        ) from None


@pytest.fixture(scope="session", autouse=True)
def _no_libpq_environment() -> Iterator[None]:
    """Every `PG*` variable removed from this pytest process, for its whole life.

    ---------------------------------------------------------------------------
    🔴 THE ONLY `autouse` IN THIS FILE, AND IT IS NOT THE ONE `roles_applied`
       REJECTED. That rejection was about a fixture that would START A CONTAINER
       for `test_settings.py`. This one edits a dictionary. It drags nothing into
       anything, costs nothing, and cannot be forgotten — which is the property
       it exists for.
    ---------------------------------------------------------------------------

    `_apply_roles_sql` already builds its child's environment from
    `not name.startswith("PG")`, so the policy was settled; it was just applied
    in exactly one of the two places that needed it. Nothing stripped `PG*` for
    the ~30 in-process `create_engine` calls across this suite, and those are
    where every isolation assertion from Task 4 on will live.

    `PGOPTIONS` is the one that matters and `TENANT_GUC` records the
    measurement: it presets `app.current_tenant` to a valid tenant on every
    connection, which replaces the deny floor Task 6's whole invariant rests on.
    But the same variable family also holds `PGHOST`, `PGPORT`, `PGDATABASE`,
    `PGUSER`, `PGSERVICE` and `PGSERVICEFILE`, each of which can move a
    connection somewhere else, and `PGSSLMODE`, which can weaken one. Removing
    the family is a smaller rule than enumerating the dangerous members of it,
    and — the reason it is a prefix rather than a list — libpq keeps adding
    members.

    `pytest.MonkeyPatch.context()` rather than the `monkeypatch` fixture:
    `monkeypatch` is function-scoped and this must outlive every test, including
    session-scoped fixture setup. The context manager restores the developer's
    real environment when the session ends, so a `PGHOST` they rely on outside
    pytest survives.

    A test that needs one of these back monkeypatches it in for itself —
    `test_a_fresh_connection_starts_at_the_deny_sentinel_even_under_pgoptions`
    does exactly that, deliberately defeating this layer to prove the second one
    holds on its own.
    """
    with pytest.MonkeyPatch.context() as patch:
        for name in [name for name in os.environ if name.startswith("PG")]:
            patch.delenv(name, raising=False)
        yield


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
def admin_dsn(_no_libpq_environment: None) -> Iterator[str]:
    """Superuser. `roles.sql`, seeding, and the catalog reads those need.

    Never used for an isolation assertion.

    `_no_libpq_environment` is requested EXPLICITLY even though it is `autouse`.
    pytest does order a session-scoped autouse fixture ahead of a session-scoped
    ordinary one, so this is belt and braces — but the thing being ordered is
    "an exported `PGHOST` cannot redirect the container's DSN, and an exported
    `PGOPTIONS` cannot preset the tenant", and an ordering guarantee that lives
    only in pytest's documentation is a worse place for that than the argument
    list. The parameter is unused by name; `ARG001` is off for tests.
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


# --- Alembic ----------------------------------------------------------------
#
# `alembic.ini` sits beside `migrations/`, resolved from this file for the same
# reason `ROLES_SQL` is: the suite runs from the repository root as often as from
# the service directory.
ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

# The `config.attributes` key `migrations/env.py` reads the DSN from. Spelled
# here rather than imported, because importing anything from `env.py` EXECUTES
# it — the file's last statement runs a migration.
#
# `config.attributes` and not `Config.set_main_option`, and that is not
# arbitrary: `set_main_option` goes through `ConfigParser`, where a `%` in a
# password begins an interpolation and raises. Generated passwords are
# `token_urlsafe` and have no `%`, but `test_a_password_full_of_quoting_hazards_survives`
# exists precisely because that alphabet is not a promise about real ones.
ALEMBIC_DSN_ATTRIBUTE = "dsn"

# Alembic's own bookkeeping table. It is created outside any revision script and
# `downgrade base` does NOT drop it, which is why `_scrub_migration_objects`
# drops it by hand — see `migrated_database`.
ALEMBIC_VERSION_TABLE = "alembic_version"

# Everything migration `0001` creates, named so the teardown can remove it
# WITHOUT depending on `alembic downgrade` having worked.
#
# THAT INDEPENDENCE IS THE WHOLE POINT AND IT WAS THE BUG. The teardown used to
# be `command.downgrade(...)` followed by an unguarded `DROP TABLE`, so a
# downgrade that RAISED skipped the drop entirely — and the next test module
# inherited seven tables, the enum, the function and a populated
# `alembic_version`, at which point `test_roles.py`'s
# `test_a_table_created_after_set_role_belongs_to_the_owner` failed with
# `DuplicateTable: relation "alembic_version" already exists`. The exact
# cross-file failure the drop existed to prevent, reintroduced by the drop being
# unreachable. Reproduced 2026-08-05 with two probe modules.
#
# Tables first (the enum has a dependent column until `fields` is gone), then the
# type, then the function. `IF EXISTS` throughout: this runs on the happy path
# too, where `downgrade` has already removed everything and every statement is a
# no-op.
MIGRATION_TABLES = (
    "audit_log",
    "field_readings",
    "fields",
    "pages",
    "packages",
    "orders",
    "tenants",
    ALEMBIC_VERSION_TABLE,
)
MIGRATION_ENUM_TYPE = "na_reason"
MIGRATION_FUNCTION = "audit_log_reject_mutation"


def _alembic_config(dsn: str) -> Config:
    """A `Config` pointed at `alembic.ini`, migrating `dsn`.

    `dsn` must be `titlepipe_migration`'s. It is the only role that can
    `SET ROLE titlepipe_owner`, which `env.py` does before the first statement.
    """
    config = Config(str(ALEMBIC_INI))
    config.attributes[ALEMBIC_DSN_ATTRIBUTE] = dsn
    return config


@pytest.fixture(scope="session")
def alembic_config() -> Callable[[str], Config]:
    """`dsn -> Config`, so a test can drive `upgrade`, `downgrade` and `check`."""
    return _alembic_config


def _scrub_migration_objects(admin_dsn: str) -> None:
    """Remove every object migration `0001` creates, unconditionally.

    The cleanup of last resort. It must not depend on Alembic having worked,
    because the case it exists for is Alembic NOT having worked — a downgrade
    that raised half way, an upgrade that failed after three tables, a revision
    with a broken `downgrade()`. Every statement is `IF EXISTS`, so running it
    after a clean downgrade is a sequence of no-ops.

    The superuser connection, not `titlepipe_migration`. Teardown must not be the
    thing that fails because a test left the session with a `SET ROLE` in place
    or revoked a grant it meant to restore.

    ONE TRANSACTION PER STATEMENT, NOT ONE FOR ALL TEN. Every statement used to
    run inside a single `engine.begin()`, which made the cleanup of last resort
    ALL-OR-NOTHING: one failure — a table with a dependent object the fixed drop
    order does not anticipate, a lock held by a connection a test forgot to
    close — rolled back the nine drops that had already worked, and the next
    module inherited everything. A resort that only works when nothing is wrong
    is not a last resort. Ten transactions cost ten round trips against a
    container on loopback, which is nothing beside the price of debugging a
    cross-module leak.

    It still RAISES, and it raises after trying every statement rather than at
    the first failure. A teardown that swallowed errors would turn "the database
    is dirty" into "some later, unrelated test fails strangely" — the exact
    trade this fixture's history is a record of.
    """
    statements = [
        *(f"DROP TABLE IF EXISTS {table}" for table in MIGRATION_TABLES),
        f"DROP TYPE IF EXISTS {MIGRATION_ENUM_TYPE}",
        f"DROP FUNCTION IF EXISTS {MIGRATION_FUNCTION}()",
    ]

    failures: list[str] = []
    engine = _seam_engine(admin_dsn)
    try:
        for statement in statements:
            try:
                with engine.begin() as connection:
                    connection.execute(text(statement))
            except SQLAlchemyError as error:
                # The statement, not the connection: every one of these is built
                # from constants in this file, so quoting it leaks nothing and
                # is the only thing that says WHICH object survived.
                failures.append(f"{statement} -> {type(error).__name__}: {error}")
    finally:
        engine.dispose()

    if failures:
        raise RuntimeError(
            "the migration scrub could not remove every object, so the database "
            "is dirty for the next module. Each remaining statement and its "
            "error:\n" + "\n".join(failures)
        )


def _teardown_migrated_database(config: Config, admin_dsn: str, upgraded: bool) -> None:
    """`downgrade base` if there is anything to downgrade, then the scrub — always.

    ---------------------------------------------------------------------------
    🔴 EXTRACTED FROM `migrated_database` SO THAT IT CAN BE TESTED. That is the
       entire reason it is a function.
    ---------------------------------------------------------------------------
    A reviewer mutated four things here and the suite stayed green for every
    one. RE-MEASURED 2026-08-05 against the tree as it stood before this change
    (`9820dfd`), one mutation at a time, whole suite each time — `131 passed`
    four times out of four:

      1. flattening this nested `try`/`finally`, so a raising `downgrade` skips
         the scrub;
      2. moving `command.upgrade` back outside the caller's `try`;
      3. deleting the scrub from the teardown altogether;
      4. removing `"fields"` from `MIGRATION_TABLES`.

    Each is described in the caller's docstring as the fix for a leak that
    actually happened, and none of them was exercised — because on the happy
    path `downgrade base` always succeeds, and a structure that only matters
    when something fails is not reached by tests where nothing does.

    Inline in a fixture's `finally`, there was no way to drive it with a
    `downgrade` that raises. As a named function behind the
    `teardown_migrated_database` fixture, there is. THREE OF THE FOUR NOW FAIL,
    each re-measured on this branch:

      1. `test_the_teardown_scrubs_even_when_the_downgrade_raises` — monkeypatches
         `alembic.command.downgrade` to raise, then asserts both that the debris
         is gone and that the downgrade's own exception still propagated;
      3. the same test, plus
         `test_the_teardown_skips_the_downgrade_it_cannot_do_but_still_scrubs`;
      4. `test_migration_tables_matches_the_model_metadata`, from the other side.

    🔴 MUTATION 2 IS STILL UNCOVERED, and saying so is better than implying
    otherwise. Whether `command.upgrade` sits inside the caller's `try` only
    matters when the upgrade itself raises, and forcing that means injecting a
    failing revision into a module-scoped fixture's setup — which is what
    `tests/test_schema_migration.py::test_a_failed_upgrade_leaves_no_partial_schema_behind`
    is built around. That file belongs to another unit, so the gap is recorded
    here rather than closed from this side.

    THE THREE PROPERTIES, each load-bearing:

    **`downgrade` and the scrub are NESTED, not sequential.** Sequentially, a
    downgrade that raised skipped the scrub entirely — measured, and the next
    module saw all seven tables, the enum, the function and a populated
    `alembic_version`. Nested, the scrub runs whatever the downgrade did, and
    the downgrade's exception still propagates rather than being replaced by a
    teardown error.

    **`upgraded` guards the downgrade.** An upgrade that raised leaves no
    version row to downgrade from, so an unconditional `downgrade` would raise
    out of the `finally` and REPLACE the upgrade's own exception as the reported
    failure — the original surviving only as `__context__`, three screens down.

    **`downgrade` is called first rather than scrubbing alone.** It is the path
    under test. A `downgrade()` that has stopped working must fail loudly here
    rather than be papered over by a cleanup that removes the same objects.
    """
    try:
        if upgraded:
            command.downgrade(config, "base")
    finally:
        _scrub_migration_objects(admin_dsn)


@pytest.fixture(scope="module")
def migrated_database(roles_applied: str, migration_dsn: str) -> Iterator[str]:
    """`alembic upgrade head`, then the database returned to exactly how it was.

    Yields `admin_dsn` — the superuser — because everything read through this is
    a CATALOG read (`pg_class.relowner`, `pg_enum`, `pg_trigger`), and
    `pg_authid` is superuser-only. No isolation assertion may use it; there are
    none in this task, and from Task 4 on they connect as `titlepipe_app`.

    ---------------------------------------------------------------------------
    🔴 MODULE-SCOPED, AND THE SCOPE IS LOAD-BEARING RATHER THAN A COST DECISION.
    ---------------------------------------------------------------------------
    Session scope would leave the seven tables and `alembic_version` in place for
    every later test file, and `tests/test_roles.py` would then FAIL:
    `test_a_table_created_after_set_role_belongs_to_the_owner` creates a table
    called `alembic_version` by name — deliberately, because Task 3 depends on
    that specific table landing on the owner — and a second `CREATE TABLE` of a
    name that already exists raises `DuplicateTable` instead. That is a
    collection-order bug of exactly the kind `roles_applied`'s docstring was
    written about, and it would be invisible until somebody reordered the files.

    ---------------------------------------------------------------------------
    **`upgrade` is INSIDE the `try`.** It used to be outside, so an upgrade that
    failed part way — three tables created, the fourth raising — got no teardown
    at all and left the debris for the next module. Nothing here relies on the
    upgrade being atomic; the teardown covers a partial one either way, which is
    what `test_a_failed_upgrade_leaves_no_partial_schema_behind` then proves
    independently.

    **The scrub removes the TYPE and the FUNCTION too**, not only the tables.
    `alembic downgrade base` is not the only way this fixture leaves debris, and
    `DROP TABLE` drops neither of those.

    Everything after the `yield` is `_teardown_migrated_database`, which is a
    named function rather than an inline `finally` for one reason: inline, none
    of its structure could be tested, and a reviewer's four mutations of it all
    left the suite green. Its docstring holds the rest of the argument.
    """
    config = _alembic_config(migration_dsn)
    upgraded = False
    try:
        command.upgrade(config, "head")
        upgraded = True
        yield roles_applied
    finally:
        _teardown_migrated_database(config, roles_applied, upgraded)


# --- the isolation seed -----------------------------------------------------
#
# Two tenants and THREE orders, split two-to-one. The asymmetry is the whole
# design: a seed of one row each makes "exactly 1" true for both tenants, so a
# positive control reading `1` would be satisfied by a session that had leaked
# into the other tenant's row. Two for A and one for B means B's count is a
# statement about B.
#
# 1111/2222 rather than a fresh pair, deliberately. `test_tenant_session.py` and
# `test_forced_rls_and_grants.py` already use exactly these two literals and say
# in their comments that they do so on purpose — a reader moving between the
# three files should not have to work out whether a different uuid means
# something. What differs here is the ROW COUNT, not the identity.
ISOLATION_TENANT_A = UUID("11111111-1111-1111-1111-111111111111")
ISOLATION_TENANT_B = UUID("22222222-2222-2222-2222-222222222222")

# tenant -> how many `orders` rows it gets. Ordered A then B, and `dict` in
# CPython preserves insertion order, so the seed writes A's rows first — which
# is what makes an off-by-one in the reader legible in a failure message.
ISOLATION_ORDER_COUNTS: Mapping[UUID, int] = MappingProxyType(
    {ISOLATION_TENANT_A: 2, ISOLATION_TENANT_B: 1}
)


def _seed_isolation_tenants(engine: Engine) -> Mapping[UUID, tuple[UUID, ...]]:
    """Two tenants and their orders, committed, written AS THE SUPERUSER.

    🔴 NO TENANT GUC IS SET HERE, AND THAT IS NOT AN OMISSION. A SUPERUSER
       BYPASSES ROW-LEVEL SECURITY UNCONDITIONALLY — `FORCE` removes the
       OWNER's exemption, not a superuser's — so every policy on `tenants` and
       `orders` is simply not consulted on this connection and one session can
       write both tenants' rows.

    That is the same fact that makes an isolation assertion on `admin_dsn`
    worthless, and it is worth having the two consequences of it written down in
    one place: the superuser is the only role that can SEED both tenants, and it
    is the one role that must never READ through a policy. Everything in
    `tests/test_tenant_isolation.py` connects as `titlepipe_app`.

    An earlier revision of this contract asked for a per-tenant `SET LOCAL` here
    and justified it with "even the migration role, inheriting the owner, is
    refused". That justification no longer describes this cluster: `roles.sql`
    makes the membership `INHERIT FALSE`, so the migration role inherits nothing
    and the seed does not run as it in any case. Neither the GUC nor the
    justification is reinstated.

    COMMITTED rather than rolled back, because every reader is a DIFFERENT
    connection and an uncommitted row is invisible to one. A denial measured
    against a row that was never there is not a denial.

    `DELETE` first — `orders` then `tenants` — so the contents are a function of
    this call rather than of whatever ran before it. There is no foreign key
    between the two, so the order is legibility rather than necessity;
    `audit_log` is deliberately untouched because `0001`'s append-only trigger
    refuses a DELETE against it.

    RETURNING PER ROW RATHER THAN ONE MULTI-ROW INSERT, AND THAT IS MEASURED
    RATHER THAN CAUTIOUS. A `text()` construct executed with a LIST of parameter
    dictionaries is an executemany, and SQLAlchemy's insertmanyvalues machinery
    — which is what makes RETURNING work for a batch — applies to compiled
    `Insert` constructs, not to raw textual SQL. MEASURED 2026-08-06 against
    postgres:18.4 / SQLAlchemy 2.0.51, two parameter dictionaries through one
    `INSERT … RETURNING id`:

        ResourceClosedError: This result object does not return rows. It has
        been closed automatically.

    The ids are what the tests assert on — a count of one is satisfied by the
    wrong row as readily as by the right one — so they have to come back, and a
    loop is how they do.
    """
    seeded: dict[UUID, tuple[UUID, ...]] = {}
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM orders"))
        connection.execute(text("DELETE FROM tenants"))
        for tenant, count in ISOLATION_ORDER_COUNTS.items():
            connection.execute(
                text("INSERT INTO tenants (id) VALUES (:tenant)"), {"tenant": tenant}
            )
            seeded[tenant] = tuple(
                UUID(
                    str(
                        connection.execute(
                            text("INSERT INTO orders (tenant_id) VALUES (:tenant) RETURNING id"),
                            {"tenant": tenant},
                        ).scalar_one()
                    )
                )
                for _ in range(count)
            )
    return MappingProxyType(seeded)


@pytest.fixture(scope="module")
def isolation_seed(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> Mapping[UUID, tuple[UUID, ...]]:
    """tenant -> its committed `orders` ids. A: two rows, B: one.

    ---------------------------------------------------------------------------
    🔴 MODULE-SCOPED, NOT SESSION-SCOPED, AND THE SCOPE IS FORCED RATHER THAN
       CHOSEN. Task 6's contract asks for session scope; pytest refuses it.
    ---------------------------------------------------------------------------
    The seed has to happen after `alembic upgrade head`, so it depends on
    `migrated_database` — and that fixture is MODULE-scoped for a reason its own
    docstring records: session scope leaves `alembic_version` in place and
    `tests/test_roles.py::test_a_table_created_after_set_role_belongs_to_the_owner`
    then fails with `DuplicateTable`. A session-scoped fixture may not request a
    module-scoped one. MEASURED 2026-08-06 against pytest 9.1.1, this fixture
    respelled `scope="session"` and nothing else changed:

        ScopeMismatch: You tried to access the module scoped fixture
        migrated_database with a session scoped request object.

    Module scope delivers the property the contract is actually about — the seed
    is committed BEFORE ANY APP-ROLE CONNECTION IN THE MODULE OPENS, because
    every test there requests this fixture and pytest builds it first. Widening
    it further would buy nothing: the tables do not outlive the module.

    THE FLOOR IS ASSERTED HERE rather than in each test, for the reason
    `test_forced_rls_and_grants.py` gives about derivations. A seed that wrote
    nothing makes every "0 rows" assertion in the isolation proof true and
    vacuous at the same time, without changing a single line of it. The
    asymmetry is checked too, not just the total: two-and-one is what makes the
    positive control's `1` a statement about B rather than about either tenant.
    """
    engine = seam_engine(migrated_database)
    try:
        seeded = _seed_isolation_tenants(engine)
    finally:
        engine.dispose()

    written = {tenant: len(ids) for tenant, ids in seeded.items()}
    assert written == dict(ISOLATION_ORDER_COUNTS), (
        f"the seed wrote {written}, not {dict(ISOLATION_ORDER_COUNTS)}. Every "
        f"denial in the isolation proof would then be a statement about an empty "
        f"table, and the positive control's expected count would be wrong."
    )
    return seeded


@pytest.fixture(scope="session")
def isolation_tenant_a() -> UUID:
    """The tenant with TWO seeded orders. Writes, and is the reference for denials."""
    return ISOLATION_TENANT_A


@pytest.fixture(scope="session")
def isolation_tenant_b() -> UUID:
    """The tenant with EXACTLY ONE seeded order. The positive control's subject."""
    return ISOLATION_TENANT_B


@pytest.fixture(scope="session")
def alembic_version_table() -> str:
    """`alembic_version`, so the name is not spelled out in every test that reads it."""
    return ALEMBIC_VERSION_TABLE


@pytest.fixture(scope="session")
def migration_tables() -> tuple[str, ...]:
    """Every table the scrub drops, including `alembic_version`.

    Exposed so `test_migration_tables_matches_the_model_metadata` can hold it
    against `Base.metadata` — it is a hand-maintained literal behind the cleanup
    of last resort, and the first revision that adds a table makes it silently
    incomplete.
    """
    return MIGRATION_TABLES


@pytest.fixture(scope="session")
def teardown_migrated_database() -> Callable[[Config, str, bool], None]:
    """`migrated_database`'s teardown, callable, so its structure can be tested.

    See `_teardown_migrated_database` — four mutations of it survived the suite
    because a `finally` block on a path where nothing fails is never exercised.
    """
    return _teardown_migrated_database


@pytest.fixture(scope="session")
def seam_engine() -> Callable[[str], Engine]:
    """`create_engine` with the tenant GUC pinned to the deny sentinel.

    Every engine built inside this seam must come from here. See `TENANT_GUC`
    for what an exported `PGOPTIONS` does to a connection that does not.
    """
    return _seam_engine


@pytest.fixture(scope="session")
def tenant_guc() -> str:
    """`app.current_tenant` — the setting Task 6's policies read."""
    return TENANT_GUC


@pytest.fixture(scope="session")
def tenant_deny_sentinel() -> str:
    """The value that means "no tenant established", i.e. deny."""
    return TENANT_DENY_SENTINEL


@pytest.fixture(scope="session")
def loopback_acknowledgement_name() -> str:
    """The variable that makes a loopback `TP_TEST_DATABASE_URL` legal."""
    return LOOPBACK_ACKNOWLEDGEMENT


@pytest.fixture(scope="session")
def override_query_allowlist() -> frozenset[str]:
    """The query-string keys `TP_TEST_DATABASE_URL` may carry, and only those."""
    return OVERRIDE_QUERY_ALLOWLIST


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
def apply_roles_sql_with_timeout() -> Callable[
    [str, Mapping[str, str], float], subprocess.CompletedProcess[str]
]:
    """The same function, with its subprocess timeout as a third argument.

    A second fixture rather than a widened one, because `apply_roles_sql` is
    annotated as a two-argument callable in a test module this task does not
    own. The timeout test needs to wait one second rather than sixty, and it is
    the only caller that passes the third argument.
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

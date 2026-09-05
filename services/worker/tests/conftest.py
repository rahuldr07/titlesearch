"""A real PostgreSQL, the real roles, and the real migration chain.

Everything the queue claims is a claim about a database: that the schema
installs, that the grants are the ones written down, that a job deferred by one
role is visible to another. A fake connector can be asked to pretend any of that
and will never REFUSE the way a database refuses, so the proofs in
`test_queue_schema.py` run against `postgres:18.4` in a container and against the
migration chain as `alembic upgrade head` runs it — not against a re-execution of
the same SQL by the test.

Three levels of access, and the distinction is the point of having three:

* the container SUPERUSER, which bypasses RLS unconditionally and is used only to
  create roles and to set up states a privileged process would set up;
* `titlepipe_migration`, which `alembic` authenticates as and which becomes
  `titlepipe_owner` for the duration of a migration;
* `titlepipe_worker` and `titlepipe_app`, which are what the assertions connect
  as, because a grant proved as superuser is not proved at all.

## Why the migration runs as a subprocess

`alembic`, SQLAlchemy and `titlepipe_core` are core-api's dependencies and are
deliberately not the worker's — the worker talks to PostgreSQL through psycopg
and nothing else. Shelling out to core-api's own project is what lets this suite
drive the actual revision without importing half of another service, and it has
a second benefit worth more than the first: the command below is exactly the
command an operator runs, so a break in the operator's path breaks this test.
"""

from __future__ import annotations

import os
import secrets
import shutil
import subprocess
from collections.abc import Callable, Iterator
from pathlib import Path

import psycopg
import pytest
from testcontainers.community.postgres import PostgresContainer

POSTGRES_IMAGE = "postgres:18.4"

# Spelled out rather than defaulted. Every identity argument `PostgresContainer`
# leaves to a default is an `os.environ.get` against the developer's own shell —
# core-api's conftest measured `POSTGRES_USER=titlepipe_app uv run pytest`
# renaming the container superuser and collapsing two privilege levels into one,
# with the collapse reported as an ordinary assertion failure.
#
# 🔴 THE NAME MUST NOT START WITH `titlepipe`, and the failure is loud rather
# than subtle, which is the point. `roles.sql` ends with a read-back that refuses
# the whole run if any `titlepipe%` role still holds SUPERUSER, BYPASSRLS,
# CREATEDB or REPLICATION — because BYPASSRLS or SUPERUSER on one of those roles
# makes every RLS policy advisory for it. A container superuser called
# `titlepipe_container_superuser` matches that pattern and cannot clear its own
# superuser bit, so `roles.sql` exits 3 and nothing is committed. core-api's suite
# calls its superuser `seam_admin` for the same reason.
CONTAINER_SUPERUSER = "queue_container_admin"
CONTAINER_DATABASE = "titlepipe"

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
CORE_API = REPOSITORY_ROOT / "services" / "core-api"
ROLES_SQL = CORE_API / "migrations" / "sql" / "roles.sql"

# The four `\getenv` names in `roles.sql`, which is where the passwords for the
# LOGIN roles come from. The server cannot read the client's environment, so the
# file must be run by `psql` and not by psycopg.
PASSWORD_VARIABLES = {
    "migration": "TITLEPIPE_MIGRATION_PASSWORD",
    "app": "TITLEPIPE_APP_PASSWORD",
    "worker": "TITLEPIPE_WORKER_PASSWORD",
    "blind": "TITLEPIPE_BLIND_PASSWORD",
}


def _refuse_on_failure(completed: subprocess.CompletedProcess[str], what: str) -> None:
    """Raise with the child's OUTPUT, and without its arguments or environment.

    `check=True` raises `CalledProcessError`, whose message is the exit code and
    the argv and nothing else — so a `roles.sql` that died on line 400 reports
    "returned non-zero exit status 3" and the reader has to reproduce it by hand
    to learn anything. The output is where the answer is.

    `CalledProcessError.__repr__` also prints `args`, and the reason these
    children take their connection details from the environment is to keep
    credentials out of anything printable. This raises a plain `RuntimeError`
    naming what ran, so neither the DSN nor the passwords can arrive in a pytest
    report by way of the exception.
    """
    if completed.returncode == 0:
        return
    raise RuntimeError(
        f"{what} exited {completed.returncode}\n"
        f"--- stdout ---\n{completed.stdout}\n"
        f"--- stderr ---\n{completed.stderr}"
    )


@pytest.fixture(scope="session")
def role_passwords() -> dict[str, str]:
    """Throwaway passwords, generated per pytest session.

    Never written to a file and never passed on a command line: a DSN in `argv`
    is readable by every process on the box through `ps`, and
    `CompletedProcess.__repr__` prints `args`, so a failing assertion would put
    the credential into the pytest report.
    """
    return {role: secrets.token_urlsafe(24) for role in PASSWORD_VARIABLES}


@pytest.fixture(scope="session")
def postgres() -> Iterator[PostgresContainer]:
    container = PostgresContainer(
        POSTGRES_IMAGE,
        username=CONTAINER_SUPERUSER,
        password=secrets.token_urlsafe(24),
        dbname=CONTAINER_DATABASE,
        driver="psycopg",
    )
    with container as running:
        yield running


@pytest.fixture(scope="session")
def superuser_dsn(postgres: PostgresContainer) -> str:
    """A libpq DSN, not SQLAlchemy's. Nothing here goes through SQLAlchemy."""
    return (
        f"postgresql://{CONTAINER_SUPERUSER}:{postgres.password}"
        f"@{postgres.get_container_host_ip()}:{postgres.get_exposed_port(5432)}"
        f"/{CONTAINER_DATABASE}"
    )


def _role_dsn(postgres: PostgresContainer, role: str, password: str) -> str:
    """The same server and database, reached as one of the `titlepipe_*` roles."""
    return (
        f"postgresql://{role}:{password}"
        f"@{postgres.get_container_host_ip()}:{postgres.get_exposed_port(5432)}"
        f"/{CONTAINER_DATABASE}"
    )


def _apply_roles_sql(postgres: PostgresContainer, role_passwords: dict[str, str]) -> None:
    """Run `roles.sql` through psql, with the passwords in the environment.

    No skip and no fallback. A missing `psql` raises: the alternative is a suite
    that quietly proves nothing about the role model, which is most of what these
    tests exist for.

    The environment is BUILT rather than inherited. An ambient `PGHOST`,
    `PGSERVICE` or `PGOPTIONS` would point this run at a server nobody destroys
    at the end of the session, and what runs here is `CREATE ROLE`, `ALTER ROLE`
    and `GRANT`.
    """
    psql = shutil.which("psql")
    if psql is None:
        raise RuntimeError(
            "psql is not on PATH, so roles.sql cannot be applied and none of the "
            "grant proofs in this suite would mean anything"
        )
    environment = {
        "PATH": os.environ.get("PATH", ""),
        "PGHOST": postgres.get_container_host_ip(),
        "PGPORT": str(postgres.get_exposed_port(5432)),
        "PGUSER": CONTAINER_SUPERUSER,
        "PGPASSWORD": postgres.password,
        "PGDATABASE": CONTAINER_DATABASE,
        **{variable: role_passwords[role] for role, variable in PASSWORD_VARIABLES.items()},
    }
    completed = subprocess.run(  # noqa: S603 — resolved path, fixed argv, no shell
        [psql, "--no-psqlrc", "--quiet", "-v", "ON_ERROR_STOP=1", "-f", str(ROLES_SQL)],
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    _refuse_on_failure(completed, "roles.sql")


def _alembic(postgres: PostgresContainer, migration_password: str, *command: str) -> None:
    """`alembic <command>` in core-api's project, as `titlepipe_migration`.

    SQLAlchemy's DSN spelling here, not libpq's: `migrations/env.py` builds an
    engine from it, and the `+psycopg` suffix is what selects the dialect. That
    the worker's own DSN needs the opposite shape is why
    `WorkerSettings.libpq_database_url` exists.

    `--frozen` so the run cannot re-resolve core-api's lock file as a side effect
    of a test.
    """
    uv = shutil.which("uv")
    if uv is None:
        raise RuntimeError(
            "uv is not on PATH, so core-api's migration chain cannot be driven "
            "from here; every schema assertion in this suite depends on it"
        )
    environment = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "TITLEPIPE_DATABASE_URL": (
            f"postgresql+psycopg://titlepipe_migration:{migration_password}"
            f"@{postgres.get_container_host_ip()}:{postgres.get_exposed_port(5432)}"
            f"/{CONTAINER_DATABASE}"
        ),
    }
    completed = subprocess.run(  # noqa: S603 — resolved path, fixed argv, no shell
        [uv, "run", "--frozen", "--directory", str(CORE_API), "alembic", *command],
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=600,
    )
    _refuse_on_failure(completed, f"alembic {' '.join(command)}")


@pytest.fixture(scope="session")
def migrated(
    postgres: PostgresContainer, role_passwords: dict[str, str], superuser_dsn: str
) -> str:
    """Roles applied, chain at head. Session-scoped: this costs a container start.

    Returns the SUPERUSER DSN, because the tests that read the catalog need to
    see privileges they were deliberately not granted. Every assertion ABOUT a
    grant connects as the role that holds it, through `role_dsn`.
    """
    _apply_roles_sql(postgres, role_passwords)
    _alembic(postgres, role_passwords["migration"], "upgrade", "head")
    return superuser_dsn


@pytest.fixture(scope="session")
def worker_dsn(migrated: str, postgres: PostgresContainer, role_passwords: dict[str, str]) -> str:
    """`titlepipe_worker`'s libpq DSN — the role the work loop actually runs as.

    Depends on `migrated` so that requesting it is enough; a test that connected
    before the chain ran would find no queue and report it as a missing grant.
    """
    del migrated
    return _role_dsn(postgres, "titlepipe_worker", role_passwords["worker"])


@pytest.fixture(scope="session")
def app_dsn(migrated: str, postgres: PostgresContainer, role_passwords: dict[str, str]) -> str:
    """`titlepipe_app`'s libpq DSN — core-api's role, which defers and nothing more."""
    del migrated
    return _role_dsn(postgres, "titlepipe_app", role_passwords["app"])


@pytest.fixture(scope="session")
def alembic(postgres: PostgresContainer, role_passwords: dict[str, str]) -> Callable[..., None]:
    """Run an `alembic` command against the container, as `titlepipe_migration`.

    Exposed so that `test_the_downgrade_removes_what_the_upgrade_created` can
    drive a real `downgrade`/`upgrade` round trip. CONVENTIONS §8 requires every
    migration to have a real `downgrade()` and calls `pass` a defect; the only
    way to know a `downgrade()` is real is to run it.
    """

    def run(*command: str) -> None:
        _alembic(postgres, role_passwords["migration"], *command)

    return run


@pytest.fixture
def empty_queue(migrated: str) -> str:
    """Truncate the four queue tables before a test, and return the admin DSN.

    Function-scoped against a session-scoped database. The alternative — a
    container per test — costs a container start each time to isolate tests that
    share nothing but a table.

    `RESTART IDENTITY` matters for readability rather than correctness: without
    it, job ids climb across the suite and a failure message names job 47 in a
    test that inserted two rows.
    """
    with psycopg.connect(migrated) as connection:
        connection.execute(
            "TRUNCATE procrastinate_jobs, procrastinate_events, "
            "procrastinate_periodic_defers, procrastinate_workers "
            "RESTART IDENTITY CASCADE"
        )
        connection.commit()
    return migrated

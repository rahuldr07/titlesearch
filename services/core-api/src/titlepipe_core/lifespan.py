"""Process resources, opened and closed explicitly.

Nothing here runs at import time. A module-level database engine or HTTP client
connects while a test collector is merely importing the module, and it connects
in whatever process happens to import it — including a worker that has no
business holding that credential. Resources are created when the app starts and
released when it stops.

`ServiceResources` is handed to the app instance, not stored in a module global.
Two apps in one test process must be able to hold different settings without
one clobbering the other.

At Gate 1 the only resources were the injected clock, id factory and metrics
sink, and that paragraph said the shape mattered more than the contents: "when
the database pool, the R2 client and the HTTPX client arrive, they are
constructed and closed here, and readiness starts telling the truth about them
without the surrounding code changing." **The database pool is the first of the
three to arrive**, and it did so exactly there — an engine and a sessionmaker
opened at startup, disposed at shutdown, and a readiness check that runs a
statement against them. `app.py` did not change to accommodate it.

The import rule above is the one this file is easiest to break: `make_engine`
does not connect, but the DSN it is called with is read from settings and the
probe that follows it opens a real socket. Both happen inside the lifespan, so
a test collector importing this module still opens nothing.
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Final

from fastapi import FastAPI
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from structlog.typing import FilteringBoundLogger

from titlepipe_core.db import check_database, make_engine, make_sessionmaker
from titlepipe_core.settings import CoreApiSettings
from titlepipe_core.telemetry.hooks import NullRequestMetrics, RequestMetrics
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import Clock, IdFactory, SystemClock, Uuid4IdFactory

# The readiness key the database answers under. Named rather than spelled at the
# two places that produce and consume it, because `/ready`'s body is read by a
# platform probe and a renamed key is a probe that silently stops checking.
DATABASE_CHECK: Final = "database_answers"

# How long the startup probe may take before it is called a failure.
#
# NOT DECORATION. libpq's default `connect_timeout` is INFINITE, and
# `tests/conftest.py::ROLES_SQL_TIMEOUT_SECONDS` records the measurement that
# makes this concrete: against `10.255.255.1`, a host that blackholes the SYN,
# `psql` was still connecting when a 20-second ceiling killed it. Unbounded here
# means a replica that never finishes starting and never binds its port, which
# a platform reads as a hung deploy rather than as a database outage.
#
# Five seconds for the reason that comment gives for the same number: a
# container on loopback may still be warming up, and everything slower than that
# is not a slow database, it is an unreachable one.
#
# 🔴 WHAT IS PROVEN AND WHAT IS ARGUED, KEPT APART. The paragraph above used to
# read as though the blackhole scenario were covered. It is not.
# `tests/test_database_probe.py` drives `probe_database` with a ceiling of `0.0`
# against a HEALTHY server and asserts the `TimeoutError` arm is reached and
# `False` returned — so "the bound is applied" is measured, and removing the
# `asyncio.timeout` fails a test. **This NUMBER is not measured by anything.**
# Reproducing the 20-second `10.255.255.1` result needs an unroutable address,
# and a suite that assumed one would pass for the wrong reason on any network
# that RSTs instead of dropping. Five seconds is a judgement; that it is
# ENFORCED is a fact.
DATABASE_PROBE_TIMEOUT_SECONDS: Final = 5.0


def _log() -> FilteringBoundLogger:
    """Acquired at call time, never bound at import. A module-level logger pins
    whatever logging configuration was active first and silently ignores a later
    one — see `get_logger`'s own warning. This module's own docstring forbids
    module globals for exactly this reason: two apps in one process must log
    under their own settings."""
    return get_logger(__name__)


@dataclass
class ReadinessReport:
    """Why the service is or is not ready to take traffic."""

    ready: bool
    checks: dict[str, bool] = field(default_factory=dict[str, bool])


@dataclass
class ServiceResources:
    """Everything the request path needs that outlives a single request."""

    settings: CoreApiSettings
    clock: Clock
    id_factory: IdFactory
    metrics: RequestMetrics
    started_at: datetime | None = None

    # All three are set by the lifespan and are `None`/`False` outside it, which
    # is what `test_nothing_is_opened_before_the_lifespan_runs` reads. The
    # sessionmaker is the one the request path takes: `api/routers/rules.py`
    # hands it to `tenant_session`, which is the only scoped way to open a
    # session. The engine is held as well as the sessionmaker because it is the
    # thing that has to be `dispose()`d, and an `async_sessionmaker` does not
    # expose the engine it was built from.
    engine: AsyncEngine | None = None
    sessionmaker: async_sessionmaker[AsyncSession] | None = None
    database_answered: bool = False

    def readiness(self) -> ReadinessReport:
        """Truthful for the dependencies that exist at this gate.

        It was exactly one thing — did startup complete — and its docstring said
        this "must be extended, not replaced, as the database, object store and
        queue land". The database has landed and this is that extension: the
        `startup_complete` key is unchanged and unconditional, and the database
        joins it.

        **CONDITIONALLY, AND THE CONDITION IS THE FIRST SENTENCE ABOVE.** The
        database key is reported only when a DSN is configured, because
        "truthful for the dependencies that EXIST" is what this method promises
        and a service with no `app_database_url` has no database dependency to be
        truthful about. Reporting `False` for an unconfigured database would make
        `/ready` 503 for every developer running `TITLEPIPE_ENVIRONMENT=development`
        alone, which `apps/web/e2e-live` and the migration harness both depend
        on; reporting `True` would be the lie the paragraph below exists to
        prevent.

        🔴 THAT USED TO LEAVE A RESIDUAL AND THE RESIDUAL IS NOW CLOSED. It read:
        "a DEPLOYED environment that forgets the variable is ready and answers
        `GET /api/rules` with a 503." That was the whole hazard of the
        conditional — a missing DSN is NO check rather than a failed one, so
        forgetting it was invisible on `/health` AND on `/ready` at once.
        `settings._deployed_environments_refuse_unsafe_configuration` now refuses
        to construct without one, so the only configuration that reaches this
        branch is a local or test run. The conditional stays; what changed is that
        it can no longer hide a deployed mistake.

        🔴 THE DATABASE ANSWER IS A STARTUP SNAPSHOT AND NOT A LIVE PROBE, AND
        SAYING SO IS BETTER THAN LETTING A READER ASSUME OTHERWISE.
        `probe_database` runs once, in the lifespan, and `database_answered`
        holds that result until the process stops; a server that dies at 03:00
        does not turn this key red, and neither does a role that can connect but
        may not read. Making it live means `readiness()` becomes `async`, which
        changes the one line in `api/routers/health.py` that calls it — deferred,
        not forgotten. Two things stand behind that being a decision rather than a
        sentence: `api/routers/health.py`'s `checks` FIELD DESCRIPTION says it in
        the OpenAPI schema, which is the surface an operator actually reads, and
        `tests/test_rules_endpoint.py::test_readiness_does_not_re_probe_after_the_
        database_goes_away` asserts it. The check is also NAMED for what it
        measured — `database_answers`, past tense by construction — rather than
        for what a live probe would measure.

        A readiness probe that reports healthy for a dependency it never checks
        is worse than no probe, because it silently converts an outage into a
        stream of 500s that the platform will not route around.
        """
        checks = {"startup_complete": self.started_at is not None}
        if self.settings.app_database_url is not None:
            checks[DATABASE_CHECK] = self.database_answered
        return ReadinessReport(ready=all(checks.values()), checks=checks)


def build_resources(
    settings: CoreApiSettings,
    *,
    clock: Clock | None = None,
    id_factory: IdFactory | None = None,
    metrics: RequestMetrics | None = None,
) -> ServiceResources:
    """Construct the resource set. Injection points exist for tests."""
    return ServiceResources(
        settings=settings,
        clock=clock or SystemClock(),
        id_factory=id_factory or Uuid4IdFactory(),
        metrics=metrics or NullRequestMetrics(),
    )


async def probe_database(
    engine: AsyncEngine,
    # ASYNC109 asks that a `timeout` parameter be replaced by the caller wrapping
    # the call in `asyncio.timeout`. The ceiling here IS `asyncio.timeout` — that
    # is the body two screens down — and it cannot move outward: the whole point
    # of this function is the `except TimeoutError` that turns a hang into an
    # UNREADY replica instead of a failed startup, and a ceiling applied by the
    # caller raises past it. It is a parameter, and not the constant read inside,
    # so the bound is reachable from a test; see the docstring.
    timeout: float = DATABASE_PROBE_TIMEOUT_SECONDS,  # noqa: ASYNC109
) -> bool:
    """Did the database answer one statement, within the ceiling?

    `timeout` IS A PARAMETER RATHER THAN A CONSTANT READ INSIDE, and public
    rather than underscored, for one reason: while it was neither, the ceiling
    was invisible to the suite. MEASURED — replacing `async with
    asyncio.timeout(...)` with a bare `await check_database(engine)` left the
    whole suite at **243 passed**, so a comment calling the bound "NOT
    DECORATION" was the only thing standing behind it. `tests/conftest.py`
    already solved this shape for `_apply_roles_sql`, whose docstring says its
    timeout "is a parameter rather than a constant read inside so that
    `test_roles_sql_that_never_returns_is_bounded_and_names_only_the_host` can
    drive it in a second instead of in a minute."

    See `tests/test_database_probe.py` for what that buys and — stated there
    rather than claimed here — what it does NOT: driving a ceiling of `0.0`
    against a healthy server proves the bound is APPLIED and that the
    `TimeoutError` arm is reached. It does not prove that five seconds is the
    right number, and it does not reproduce the blackholed host
    `DATABASE_PROBE_TIMEOUT_SECONDS` cites, which needs an unroutable address no
    test in this suite can rely on having.

    **THIS IS THE `except` `db/health.py` DELIBERATELY DOES NOT HAVE**, and it is
    here because this is the only layer with a logger and a policy about startup.
    It swallows on purpose and the purpose is narrow: an unreachable database
    must make the replica UNREADY, not make it fail to start. A replica that
    refuses to boot is one the platform restarts in a loop while the database is
    down; a replica that boots and reports itself unready is one it routes around
    and puts back when the database returns.

    `SQLAlchemyError` and `TimeoutError`, and nothing wider. Everything psycopg
    raises for an unreachable host, a refused password or a missing database
    arrives wrapped in `DBAPIError`, which is a `SQLAlchemyError`; the timeout is
    `asyncio.timeout`'s. A `bare except` here would also swallow the
    configuration errors that must not be survivable — `create_async_engine`
    refusing an unknown driver, `ArgumentError` on an unparseable DSN — and
    those are raised by `make_engine` in the caller, outside this function, so
    that they still stop the process.

    The log line carries the exception's TYPE and nothing else. The DSN holds the
    app role's password and a message from psycopg quotes the host it could not
    reach; `settings.app_database_url` is a `SecretStr` precisely so that neither
    is one `repr` away from a log shipper.
    """
    try:
        async with asyncio.timeout(timeout):
            await check_database(engine)
    except (SQLAlchemyError, TimeoutError) as error:
        _log().error("database_probe_failed", error_name=type(error).__name__)
        return False
    return True


def build_lifespan(
    resources: ServiceResources,
) -> Callable[[FastAPI], contextlib.AbstractAsyncContextManager[None]]:
    """Return the lifespan manager that owns `resources`."""

    @contextlib.asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        # The engine is built BEFORE `started_at` is stamped, so acquisition
        # order is engine then startup and the `finally` below can release in
        # reverse. `make_engine` opens no socket — the pool is lazy — so the
        # first thing that actually reaches the server is the probe.
        dsn = resources.settings.app_database_url
        if dsn is not None:
            resources.engine = make_engine(dsn.get_secret_value())
            resources.sessionmaker = make_sessionmaker(resources.engine)
            resources.database_answered = await probe_database(resources.engine)

        resources.started_at = resources.clock.now()
        _log().info(
            "service_started",
            service_name=resources.settings.service_name.value,
            environment=resources.settings.environment.value,
            database_configured=dsn is not None,
        )
        try:
            yield
        finally:
            # Release in reverse order of acquisition. Runs on both clean
            # shutdown and startup failure — which is why every field is put
            # back rather than only the engine disposed: a `ServiceResources`
            # that outlives its lifespan must not still be handing out a
            # sessionmaker over a disposed pool.
            resources.started_at = None
            if resources.engine is not None:
                await resources.engine.dispose()
            resources.engine = None
            resources.sessionmaker = None
            resources.database_answered = False
            _log().info(
                "service_stopped",
                service_name=resources.settings.service_name.value,
            )

    return lifespan


def get_resources(app: FastAPI) -> ServiceResources:
    """Read the resource set off an app instance."""
    resources = getattr(app.state, "resources", None)
    if not isinstance(resources, ServiceResources):
        raise RuntimeError("application resources are not configured")
    return resources

"""Process resources, opened and closed explicitly.

Nothing here runs at import time. A module-level database engine or HTTP client
connects while a test collector is merely importing the module, and it connects
in whatever process happens to import it — including a worker that has no
business holding that credential. Resources are created when the app starts and
released when it stops.

`ServiceResources` is handed to the app instance, not stored in a module global.
Two apps in one test process must be able to hold different settings without
one clobbering the other.

At Gate 1 the only resources are the injected clock, id factory and metrics
sink. The shape matters more than the contents: when the database pool, the R2
client and the HTTPX client arrive, they are constructed and closed here, and
readiness starts telling the truth about them without the surrounding code
changing.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncGenerator, Callable
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import FastAPI

from titlepipe_core.settings import CoreApiSettings
from titlepipe_core.telemetry.hooks import NullRequestMetrics, RequestMetrics
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import Clock, IdFactory, SystemClock, Uuid4IdFactory

_log = get_logger(__name__)


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

    def readiness(self) -> ReadinessReport:
        """Truthful for the dependencies that exist at this gate.

        Right now that is exactly one thing: did startup complete. This must be
        extended — not replaced — as the database, object store and queue land.
        A readiness probe that reports healthy for a dependency it never checks
        is worse than no probe, because it silently converts an outage into a
        stream of 500s that the platform will not route around.
        """
        checks = {"startup_complete": self.started_at is not None}
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


def build_lifespan(
    resources: ServiceResources,
) -> Callable[[FastAPI], contextlib.AbstractAsyncContextManager[None]]:
    """Return the lifespan manager that owns `resources`."""

    @contextlib.asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        resources.started_at = resources.clock.now()
        _log.info(
            "service_started",
            service_name=resources.settings.service_name.value,
            environment=resources.settings.environment.value,
        )
        try:
            yield
        finally:
            # Release in reverse order of acquisition once there is more than
            # one resource. Runs on both clean shutdown and startup failure.
            resources.started_at = None
            _log.info(
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

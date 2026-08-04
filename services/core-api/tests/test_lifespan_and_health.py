"""Lifespan ownership, liveness and readiness."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from titlepipe_core.app import create_app
from titlepipe_core.lifespan import (
    ServiceResources,
    build_lifespan,
    build_resources,
    get_resources,
)
from titlepipe_core.settings import CoreApiSettings
from titlepipe_test_support import FrozenClock, SequenceIdFactory


def test_resources_open_and_close_exactly_once(
    development_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """Counted, not asserted once. A lifespan that runs twice opens two pools."""
    opened = 0
    closed = 0
    resources = build_resources(development_settings, clock=frozen_clock)
    inner = build_lifespan(resources)

    def counting_lifespan(app: FastAPI) -> object:
        import contextlib

        @contextlib.asynccontextmanager
        async def wrapper(_app: FastAPI) -> AsyncGenerator[None]:
            nonlocal opened, closed
            async with inner(app):
                opened += 1
                try:
                    yield
                finally:
                    closed += 1

        return wrapper(app)

    app = FastAPI(lifespan=counting_lifespan)  # pyright: ignore[reportArgumentType]
    app.state.resources = resources

    with TestClient(app) as client:
        client.get("/")

    assert (opened, closed) == (1, 1)


def test_startup_stamps_the_injected_clock(
    development_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """Time is injected, so this is an equality assertion rather than a range."""
    resources = build_resources(development_settings, clock=frozen_clock)
    app = FastAPI(lifespan=build_lifespan(resources))
    app.state.resources = resources

    with TestClient(app):
        assert resources.started_at == datetime(2026, 7, 22, 12, 0, tzinfo=UTC)


def test_shutdown_releases_what_startup_acquired(
    development_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    resources = build_resources(development_settings, clock=frozen_clock)
    app = FastAPI(lifespan=build_lifespan(resources))
    app.state.resources = resources

    with TestClient(app):
        pass

    assert resources.started_at is None


def test_nothing_connects_at_import_time() -> None:
    """Importing the app module must not construct a client or bind a port.
    Import happens in a test collector and in a worker that holds different
    credentials."""
    import importlib

    module = importlib.import_module("titlepipe_core.app")
    assert not hasattr(module, "app")


def test_two_apps_hold_independent_settings(
    development_settings: CoreApiSettings,
    production_settings: CoreApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> None:
    """No process-global application state: one app must not clobber another."""
    first = create_app(development_settings, clock=frozen_clock, id_factory=id_factory)
    second = create_app(production_settings, clock=frozen_clock, id_factory=id_factory)

    assert get_resources(first).settings.environment.value == "test"
    assert get_resources(second).settings.environment.value == "production"


def test_reading_resources_from_an_unconfigured_app_fails_loudly() -> None:
    with pytest.raises(RuntimeError, match="resources are not configured"):
        get_resources(FastAPI())


def test_health_reports_liveness(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "core-api"}


def test_ready_reports_its_checks(client: TestClient) -> None:
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"] == {"startup_complete": True}


def test_ready_is_503_before_startup_completes(
    development_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """Readiness must be truthful for the dependencies that exist. A probe that
    reports healthy for something it never checked converts an outage into a
    stream of 500s the platform will not route around."""
    resources = ServiceResources(
        settings=development_settings,
        clock=frozen_clock,
        id_factory=SequenceIdFactory(),
        metrics=build_resources(development_settings).metrics,
    )
    report = resources.readiness()
    assert report.ready is False
    assert report.checks == {"startup_complete": False}


def test_health_does_not_consult_dependencies(client: TestClient) -> None:
    """Liveness must not fail because a downstream is down — that turns a
    recoverable outage into a restart storm."""
    resources = get_resources(client.app)  # pyright: ignore[reportArgumentType]
    resources.started_at = None
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 503


def route_paths(app: FastAPI) -> set[str]:
    """Every product path the application actually serves.

    Read from the generated OpenAPI schema rather than by walking `app.routes`.
    FastAPI 0.139 appends an opaque `_IncludedRouter` for an included router —
    its own `path` is `None` and it exposes no children — so a walk of
    `app.routes` sees only `/docs` and `/openapi.json`, and an assertion built
    on it passes without ever inspecting a product endpoint.
    """
    schema = app.openapi()
    paths = schema.get("paths")
    return set(cast("dict[str, object]", paths)) if isinstance(paths, dict) else set()


def test_no_product_api_route_exists_at_this_gate(app: FastAPI) -> None:
    paths = route_paths(app)
    assert {"/health", "/ready"} <= paths, f"platform routes missing; saw {sorted(paths)}"
    assert not [path for path in paths if path.startswith("/api")]


def test_docs_are_absent_when_disabled(
    production_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    app = create_app(production_settings, clock=frozen_clock)
    with TestClient(app, base_url="https://app.titlepipe.example") as client:
        assert client.get("/openapi.json").status_code == 404
        assert client.get("/docs").status_code == 404

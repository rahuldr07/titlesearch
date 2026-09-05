"""Lifespan ownership, liveness and readiness."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import cast

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from titlepipe_core.app import create_app
from titlepipe_core.lifespan import (
    ServiceResources,
    build_lifespan,
    build_resources,
    get_resources,
)
from titlepipe_core.settings import CoreApiSettings, Environment
from titlepipe_test_support import FrozenClock, SequenceIdFactory

# 🔴 THE READINESS TESTS PIN `app_database_url` THEMSELVES, AND THEY HAVE TO.
#
# `readiness()` reports `database_answers` IF AND ONLY IF `app_database_url` is
# set, so the exact set of checks is a function of the configuration — and
# `CoreApiSettings` is a pydantic-settings model, which reads
# `TITLEPIPE_APP_DATABASE_URL` OUT OF THE PROCESS ENVIRONMENT for any field the
# caller does not pass. `conftest.py::development_settings` is
# `CoreApiSettings(environment=Environment.TEST)` and passes nothing, so it is
# the ambient shell that decides.
#
# MEASURED 2026-09-05 on `integration/backend-2026-09`, same tree, same commit:
#
#   pytest tests/test_lifespan_and_health.py                      -> 12 passed
#   TITLEPIPE_APP_DATABASE_URL=... pytest tests/test_lifespan...   ->  2 failed
#
# and that variable is not exotic — `.github/workflows/migration-harness.yml`
# exports it, because core-api needs the app role's DSN to start. So the two
# assertions below were green on a developer's shell and red on the one the
# harness actually runs, for a reason that has nothing to do with either.
#
# Init keyword beats environment in pydantic-settings' source order, so passing
# the field EXPLICITLY — including passing `None` — is what makes the claim these
# tests make ("readiness reports exactly these checks") a statement about
# `readiness()` rather than about the shell. Verified against
# pydantic-settings 2.14.2: `CoreApiSettings(..., app_database_url=None)` is
# `None` with the variable exported.
#
# THIS DOES NOT FIX `development_settings`. Every other test that builds an app
# from it still inherits whatever the shell exports; that is a change to
# `conftest.py`, which this round belongs to somebody else, and it is filed as a
# request rather than made here.


def _settings_without_a_database() -> CoreApiSettings:
    """A TEST configuration whose `app_database_url` is `None` BY ASSERTION."""
    return CoreApiSettings(environment=Environment.TEST, app_database_url=None)


# A DSN nothing connects to, spelled the way `conftest.py::DEPLOYED_DATABASE_URL`
# spells its own: the password is a sentence answering the question a
# credential-shaped literal in a checked-in file would otherwise raise. No engine
# is built from it — `readiness()` reads a stored boolean, and the test that uses
# this never runs a lifespan.
UNREACHED_DATABASE_URL = (
    "postgresql+psycopg://titlepipe_app:this-dsn-never-connects@db.titlepipe.example:5432/titlepipe"
)


def _settings_with_a_database() -> CoreApiSettings:
    """The same, with a database configured, so the other arm can be asserted."""
    return CoreApiSettings(
        environment=Environment.TEST,
        app_database_url=SecretStr(UNREACHED_DATABASE_URL),
    )


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


def test_ready_reports_its_checks(frozen_clock: FrozenClock) -> None:
    """With NO database configured, `startup_complete` is the whole set.

    Its own app rather than the `client` fixture, because that fixture's settings
    are `CoreApiSettings(environment=Environment.TEST)` and those read the
    environment. See the comment at the top of this file.
    """
    settings = _settings_without_a_database()
    assert settings.app_database_url is None
    app = create_app(settings, clock=frozen_clock, id_factory=SequenceIdFactory())

    with TestClient(app) as client:
        response = client.get("/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["checks"] == {"startup_complete": True}


def test_ready_reports_the_database_check_once_a_database_is_configured(
    frozen_clock: FrozenClock,
) -> None:
    """The other arm of the conditional in `readiness()`, and the reason the
    assertion above can stay an exact set rather than a floor.

    Without this the tests here would say "readiness reports exactly
    `startup_complete`" full stop, and `database_answers` — the key a platform
    probe reads, registered when and only when `app_database_url` is set — would
    be held by nothing at this level. It is `False` because no lifespan has run:
    `database_answered` is a startup SNAPSHOT, so an unstarted `ServiceResources`
    has not answered, and `ready` is `False` with it. That is the readiness a
    replica reports between binding its port and finishing startup.
    """
    settings = _settings_with_a_database()
    resources = ServiceResources(
        settings=settings,
        clock=frozen_clock,
        id_factory=SequenceIdFactory(),
        metrics=build_resources(settings).metrics,
    )

    report = resources.readiness()

    assert report.checks == {"startup_complete": False, "database_answers": False}
    assert report.ready is False


def test_ready_is_503_before_startup_completes(frozen_clock: FrozenClock) -> None:
    """Readiness must be truthful for the dependencies that exist. A probe that
    reports healthy for something it never checked converts an outage into a
    stream of 500s the platform will not route around."""
    settings = _settings_without_a_database()
    resources = ServiceResources(
        settings=settings,
        clock=frozen_clock,
        id_factory=SequenceIdFactory(),
        metrics=build_resources(settings).metrics,
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


def test_the_product_routes_are_exactly_these_three_and_the_probes_are_not_under_api(
    app: FastAPI,
) -> None:
    """🔴 THIS WAS `test_no_product_api_route_exists_at_this_gate`, WHICH ASSERTED
    `not [path for path in paths if path.startswith("/api")]`. That gate has
    passed: `GET /api/rules` is served, so the old assertion is the one thing in
    this suite that Plan 02 Task 4 had to make false, and it failed exactly there.

    What replaces it is strictly stronger than "no `/api` route" was, because it
    is falsifiable in both directions. The old line could not tell a service with
    no product surface from a service whose product surface failed to register;
    this one names the route that must be there AND keeps the ceiling, so the
    next endpoint added without a plan behind it fails here rather than shipping.

    `GET /api/rules/{code}` is the second and `GET /api/queue/next` is the third,
    and BOTH arrived through this test — adding each route turned this red, which
    is the ceiling working. The list is a LITERAL and not a prefix count for that
    reason: every new endpoint costs one deliberate line here, and a route
    registered by accident (a stray `include_router`, a path typo that leaves both
    spellings served) fails rather than passing a `>= 1` check.

    THIS TEST IS ABOUT WHICH PATHS ARE SERVED AND NOT ABOUT WHAT THEY ANSWER.
    `/api/queue/next` is registered and answers 401 to every caller —
    `api/routers/queue.py` records why that is the true answer and not a
    placeholder — so its presence here is a statement that the OpenAPI document
    carries the path, which is what core-api owes for it under ADR-0001.
    `tests/test_queue_endpoint.py` is what holds the refusal.

    `/health` and `/ready` staying out of `/api` is asserted rather than assumed.
    `api/routers/health.py` argues it — they are platform surface, and Plan 03
    authenticates a prefix — and an `include_router` that gave the health router
    a prefix would otherwise be invisible until a probe started getting 401s.
    """
    paths = route_paths(app)
    assert {"/health", "/ready"} <= paths, f"platform routes missing; saw {sorted(paths)}"
    # `sorted`, because `route_paths` returns a SET and a comprehension over one
    # yields str-hash order. THE SECOND PRODUCT ROUTE HAS NOW LANDED, which is what
    # this comment was written in anticipation of: with one path the comparison was
    # accidentally stable, and with two an unsorted one would fail intermittently,
    # on ordering, in a test about which routes exist.
    assert sorted(path for path in paths if path.startswith("/api")) == [
        "/api/queue/next",
        "/api/rules",
        "/api/rules/{code}",
    ]


def test_docs_are_absent_when_disabled(
    production_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    app = create_app(production_settings, clock=frozen_clock)
    with TestClient(app, base_url="https://app.titlepipe.example") as client:
        assert client.get("/openapi.json").status_code == 404
        assert client.get("/docs").status_code == 404

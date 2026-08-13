"""The Core API application factory.

`create_app()` builds an application; importing this module does not. A factory
lets a test construct an app with staging settings and an injected clock without
the import graph deciding for it, and it keeps configuration out of module
scope where it cannot be overridden.

🔴 THIS SAID "No product `/api/*` route exists at Gate 1. Only liveness and
readiness." IT IS NO LONGER TRUE. `GET /api/rules` is served, and it is the only
product route: the rulebook is global, so it is the one read that needs no
principal and could therefore be built before identity exists. Everything else in
`packages/contract` is tenant-scoped and waits for Plan 03.
"""

from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from titlepipe_core.api.errors import build_unhandled_response, register_error_handlers
from titlepipe_core.api.request_context import RequestContextMiddleware
from titlepipe_core.api.routers import health, rules
from titlepipe_core.lifespan import build_lifespan, build_resources
from titlepipe_core.settings import CoreApiSettings
from titlepipe_core.telemetry.hooks import RequestMetrics
from titlepipe_core.telemetry.logging import configure_logging
from titlepipe_domain import Clock, IdFactory

API_TITLE = "TitlePipe Core API"
API_VERSION = "0.1.0"


def create_app(
    settings: CoreApiSettings | None = None,
    *,
    clock: Clock | None = None,
    id_factory: IdFactory | None = None,
    metrics: RequestMetrics | None = None,
) -> FastAPI:
    """Build a configured application.

    Settings are validated before anything else runs, so an unsafe deployed
    configuration fails here rather than after the port is bound.
    """
    settings = settings or CoreApiSettings.from_environment()

    configure_logging(
        level=settings.log_level,
        renderer=settings.effective_log_renderer,
        redaction_enabled=settings.redaction_enabled,
        environment=settings.environment,
    )

    resources = build_resources(settings, clock=clock, id_factory=id_factory, metrics=metrics)

    app = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        debug=settings.debug,
        lifespan=build_lifespan(resources),
        # Disabled in deployed environments by configuration, not by an
        # `if production` branch here. The settings model refuses to construct
        # with docs enabled in staging or production.
        openapi_url=settings.openapi_url,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
    )
    app.state.resources = resources

    # Order matters, and `add_middleware` prepends — the last one added runs
    # outermost. Reading downward, the resulting stack is:
    #
    #     TrustedHost -> CORS -> RequestContext -> router
    #
    # CORS therefore sits outside the request-context middleware, so a rejected
    # preflight never reaches it, and the 500 that middleware builds is still
    # inside the CORS layer and still carries its correlation id.
    app.add_middleware(
        RequestContextMiddleware,
        id_factory=resources.id_factory,
        on_unhandled=build_unhandled_response(settings.environment),
    )
    if settings.cors_allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_allowed_origins),
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "X-Request-ID"],
        )

    if settings.allowed_hosts:
        # Added last, so it runs outermost: a forged Host header is
        # rejected before any other layer inspects the request. Guards
        # cache poisoning and password-reset link forgery.
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))

    register_error_handlers(app, environment=settings.environment)
    app.include_router(health.router)
    # The first product router. `rules` carries its own `/api` prefix and
    # `health` deliberately carries none — see `api/routers/health.py`, which is
    # platform surface rather than product surface. Registered AFTER the error
    # handlers, so a `DomainError` raised in a handler already has somewhere to
    # be mapped; the order is not load-bearing for FastAPI, but reading it the
    # other way round invites somebody to assume it is.
    app.include_router(rules.router)

    return app

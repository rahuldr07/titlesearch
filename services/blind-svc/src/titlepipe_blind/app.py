"""The Blind API application factory.

Capture and assignment only. This service has no route that returns model
output, extraction state, golden values, reconciliation results or the other
seat's entry — not because a filter removes them, but because the data is not
reachable from this process. The guarantee is topology and credentials, proven
by `tests/test_boundaries.py`, not a check somewhere in a handler.

No product `/api/*` route exists at Gate 1. Only liveness and readiness.
"""

from __future__ import annotations

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from titlepipe_blind.api.errors import build_unhandled_response, register_error_handlers
from titlepipe_blind.api.request_context import RequestContextMiddleware
from titlepipe_blind.api.routers import health
from titlepipe_blind.lifespan import build_lifespan, build_resources
from titlepipe_blind.settings import BlindApiSettings
from titlepipe_blind.telemetry.hooks import RequestMetrics
from titlepipe_blind.telemetry.logging import configure_logging
from titlepipe_blind.telemetry.sensitivity import BLIND_SENSITIVE_KEY_PARTS
from titlepipe_domain import Clock, IdFactory

API_TITLE = "TitlePipe Blind API"
API_VERSION = "0.1.0"


def create_app(
    settings: BlindApiSettings | None = None,
    *,
    clock: Clock | None = None,
    id_factory: IdFactory | None = None,
    metrics: RequestMetrics | None = None,
) -> FastAPI:
    """Build a configured application.

    Settings are validated first, so both the deployed-environment rules and
    the blind isolation rules fail here rather than after the port is bound.
    """
    settings = settings or BlindApiSettings.from_environment()

    configure_logging(
        level=settings.log_level,
        renderer=settings.effective_log_renderer,
        redaction_enabled=settings.redaction_enabled,
        environment=settings.environment,
        extra_sensitive_parts=BLIND_SENSITIVE_KEY_PARTS,
    )

    resources = build_resources(settings, clock=clock, id_factory=id_factory, metrics=metrics)

    app = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        debug=settings.debug,
        lifespan=build_lifespan(resources),
        openapi_url=settings.openapi_url,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url=None,
    )
    app.state.resources = resources

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
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type", "X-Request-ID"],
        )

    if settings.allowed_hosts:
        # Added last, so it runs outermost: a forged Host header is
        # rejected before any other layer inspects the request. Guards
        # cache poisoning and password-reset link forgery.
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(settings.allowed_hosts))

    register_error_handlers(app, environment=settings.environment)
    app.include_router(health.router)

    return app

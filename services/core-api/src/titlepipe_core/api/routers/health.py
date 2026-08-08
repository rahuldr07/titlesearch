"""Liveness and readiness.

They answer different questions and a platform uses them differently.

`/health` — is the process alive. Never touches a dependency. If it consulted
the database, a database blip would make every replica fail liveness and be
restarted, turning a recoverable outage into a restart storm.

`/ready` — should this replica receive traffic. Consults the dependencies that
exist, and returns 503 when any is not ready so the platform routes around it.

Neither is under `/api`. They are platform surface, not product surface.

🔴 THAT SENTENCE USED TO END "…and no product endpoint exists at Gate 1", WHICH
IS NOW FALSE. `GET /api/rules` is served (`api/routers/rules.py`), and this file
is where both that module and its tests send a reader for the argument about the
prefix — so a stale clause here is one somebody reads as current. The prefix rule
is unchanged and is the half that matters: these two stay OUT of `/api` because
Plan 03 will authenticate that prefix, and a platform probe that needs a session
is a probe that reports an outage every time identity is down.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, Field

from titlepipe_core.lifespan import get_resources

router = APIRouter(tags=["platform"])


class HealthResponse(BaseModel):
    """Process liveness."""

    status: str = Field(description="Always 'ok' when the process can answer.")
    service: str = Field(description="Which deployable answered.")


class ReadinessResponse(BaseModel):
    """Dependency readiness."""

    ready: bool
    service: str
    # 🔴 THE DESCRIPTION IS WHERE THE STARTUP-SNAPSHOT CAVEAT HAS TO LIVE, and it
    # read "Per-dependency result. Extended as dependencies land." while
    # `database_answers` was already being reported from a probe that runs ONCE.
    # An operator reading `"database_answers": true` in a deployed environment
    # had no way to learn it means "answered at boot" rather than "answers now",
    # and this schema — not a Python docstring — is the surface they actually
    # read. `lifespan.ServiceResources.readiness` carries the same caveat for
    # the reader of the code and the reason it is not closed here.
    checks: dict[str, bool] = Field(
        description=(
            "Per-dependency result. Extended as dependencies land. A key is "
            "present only for a dependency this deployment is CONFIGURED for, so "
            "an absent key means 'not configured', never 'healthy'. "
            "`database_answers` is measured ONCE, at startup: it does not go "
            "false for a database that stops answering after boot, and it stays "
            "true for one this service can reach but is not privileged to read."
        )
    )


@router.get("/health", response_model=HealthResponse, summary="Liveness")
async def health(request: Request) -> HealthResponse:
    resources = get_resources(request.app)
    return HealthResponse(status="ok", service=resources.settings.service_name.value)


@router.get("/ready", response_model=ReadinessResponse, summary="Readiness")
async def ready(request: Request, response: Response) -> ReadinessResponse:
    resources = get_resources(request.app)
    report = resources.readiness()
    if not report.ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        ready=report.ready,
        service=resources.settings.service_name.value,
        checks=report.checks,
    )

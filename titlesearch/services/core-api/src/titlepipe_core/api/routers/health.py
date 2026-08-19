"""Liveness and readiness.

They answer different questions and a platform uses them differently.

`/health` — is the process alive. Never touches a dependency. If it consulted
the database, a database blip would make every replica fail liveness and be
restarted, turning a recoverable outage into a restart storm.

`/ready` — should this replica receive traffic. Consults the dependencies that
exist, and returns 503 when any is not ready so the platform routes around it.

Neither is under `/api`. They are platform surface, not product surface, and no
product endpoint exists at Gate 1.
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
    checks: dict[str, bool] = Field(
        description="Per-dependency result. Extended as dependencies land."
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

"""Framework-free domain primitives.

This package may not import FastAPI, SQLAlchemy, WorkOS, PgQueuer, boto3 or any
vendor SDK. It carries the vocabulary that every deployable agrees on — error
kinds, time, identity — and nothing that knows how a request is served.
"""

from titlepipe_domain.clock import Clock, SystemClock
from titlepipe_domain.errors import (
    ConflictError,
    DependencyUnavailableError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    RefusalError,
    UnauthenticatedError,
    ValidationError,
)
from titlepipe_domain.identifiers import IdFactory, Uuid4IdFactory
from titlepipe_domain.runtime import Environment, LogRenderer, ServiceName
from titlepipe_domain.tenancy import TENANT_GUC, TenantId, tenant_guc_value

__all__ = [
    "TENANT_GUC",
    "Clock",
    "ConflictError",
    "DependencyUnavailableError",
    "DomainError",
    "Environment",
    "IdFactory",
    "LogRenderer",
    "NotFoundError",
    "PermissionDeniedError",
    "RefusalError",
    "ServiceName",
    "SystemClock",
    "TenantId",
    "UnauthenticatedError",
    "Uuid4IdFactory",
    "ValidationError",
    "tenant_guc_value",
]

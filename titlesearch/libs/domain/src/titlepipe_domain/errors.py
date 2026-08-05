"""The domain error taxonomy.

Domain and service code raises these. It never raises `HTTPException`, never
imports FastAPI, and never chooses an HTTP status — the API error-mapping layer
owns that translation, so the same domain code is reusable from a worker where
there is no request to fail.

Two rules hold for every subclass:

1. `code` is a stable machine-readable identifier owned by code, not copy. The
   frontend and the tests may branch on it; it does not change when the wording
   changes.
2. `message` is client-safe by contract. Anything raised here may be shown to a
   caller verbatim, so it must never carry NPI, a file path, a query, a
   credential or a stack detail. Unsafe context goes in the log record, not the
   exception.
"""

from __future__ import annotations

from typing import Any, ClassVar


class DomainError(Exception):
    """Base for every deliberate refusal or failure the domain can express."""

    code: ClassVar[str] = "DOMAIN_ERROR"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details: dict[str, Any] = details or {}

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self.code!r}, message={self.message!r})"


class ValidationError(DomainError):
    """The request is well-formed transport but fails a domain rule."""

    code: ClassVar[str] = "VALIDATION_FAILED"


class RefusalError(DomainError):
    """A product law refused the action.

    Distinct from `ValidationError`: the input was acceptable, the *action* is
    not permitted to proceed. Escalation resolution without a rule, a golden
    correction without a source, a judgment asked to auto-confirm. These are
    requirements, not accidents, and they carry a reason the caller can act on.
    """

    code: ClassVar[str] = "REFUSED"


class NotFoundError(DomainError):
    """The resource does not exist, or is deliberately hidden across a tenant
    boundary. The caller cannot tell which, and that is the point."""

    code: ClassVar[str] = "NOT_FOUND"


class ConflictError(DomainError):
    """The resource is not in a legal state for this transition, or an
    idempotent replay arrived with a different payload."""

    code: ClassVar[str] = "CONFLICT"


class UnauthenticatedError(DomainError):
    """No valid session."""

    code: ClassVar[str] = "UNAUTHENTICATED"


class PermissionDeniedError(DomainError):
    """Authenticated, but the principal may not do this."""

    code: ClassVar[str] = "PERMISSION_DENIED"


class DependencyUnavailableError(DomainError):
    """A required downstream dependency is unavailable and the call is
    retryable. Never used to mask a domain refusal."""

    code: ClassVar[str] = "DEPENDENCY_UNAVAILABLE"

"""The error envelope.

Every failure leaves this service in one shape, with a stable code. These tests
are the contract the frontend and the refusal tests will branch on.
"""

from __future__ import annotations

import pytest
from conftest import DEPLOYED_BASE_URL
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, field_validator

from titlepipe_core.api.errors import (
    CODE_INTERNAL_ERROR,
    GENERIC_INTERNAL_MESSAGE,
    sanitise_validation_errors,
    status_for,
)
from titlepipe_core.app import create_app
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import (
    ConflictError,
    DependencyUnavailableError,
    DomainError,
    NotFoundError,
    PermissionDeniedError,
    RefusalError,
    UnauthenticatedError,
    ValidationError,
)
from titlepipe_test_support import FrozenClock, SequenceIdFactory


class ReasonPayload(BaseModel):
    """Declared at module scope on purpose.

    A model defined inside a test function cannot be resolved when
    `from __future__ import annotations` makes the signature a string, and
    FastAPI then treats the parameter as a query parameter instead of a body —
    which makes the assertion below pass or fail for the wrong reason.
    """

    reason: str


class PageCountPayload(BaseModel):
    page_count: int


class UppercaseGrantor(BaseModel):
    """A custom validator whose message embeds the submitted value — the exact
    shape that leaked a party name into a production 422."""

    grantor: str

    @field_validator("grantor")
    @classmethod
    def _must_be_uppercase(cls, value: str) -> str:
        if not value.isupper():
            raise ValueError(f"grantor must be uppercase, got {value!r}")
        return value


DOMAIN_CASES: list[tuple[type[DomainError], int, str]] = [
    (ValidationError, 422, "VALIDATION_FAILED"),
    (RefusalError, 422, "REFUSED"),
    (UnauthenticatedError, 401, "UNAUTHENTICATED"),
    (PermissionDeniedError, 403, "PERMISSION_DENIED"),
    (NotFoundError, 404, "NOT_FOUND"),
    (ConflictError, 409, "CONFLICT"),
    (DependencyUnavailableError, 503, "DEPENDENCY_UNAVAILABLE"),
]


@pytest.mark.parametrize(("error_type", "status", "code"), DOMAIN_CASES)
def test_each_domain_error_maps_to_its_documented_status_and_code(
    app: FastAPI, error_type: type[DomainError], status: int, code: str
) -> None:
    @app.get("/raises")
    async def _raises() -> None:
        raise error_type("A safe explanation.")

    with TestClient(app) as client:
        response = client.get("/raises")

    assert response.status_code == status
    body = response.json()["error"]
    assert body["code"] == code
    assert body["message"] == "A safe explanation."
    assert body["request_id"]
    assert body["details"] == {}


def test_domain_error_details_reach_the_caller(app: FastAPI) -> None:
    """A refusal has to be actionable — the reason is the product requirement."""

    @app.get("/refused")
    async def _refused() -> None:
        raise RefusalError(
            "Resolution requires an existing or drafted rule.",
            details={"required": "rule_id"},
        )

    with TestClient(app) as client:
        body = client.get("/refused").json()["error"]

    assert body["code"] == "REFUSED"
    assert body["details"] == {"required": "rule_id"}


def test_an_unregistered_domain_subclass_inherits_its_parents_status() -> None:
    """A future refusal subclass must not silently become a 500."""

    class EscalationRequiresRuleError(RefusalError):
        code = "RULE_REQUIRED"

    assert status_for(EscalationRequiresRuleError("x")) == 422


def test_a_bare_domain_error_is_treated_as_a_failure_not_a_success() -> None:
    assert status_for(DomainError("x")) == 500


def test_a_missing_route_uses_the_envelope(client: TestClient) -> None:
    body = client.get("/nope").json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["request_id"]


def test_a_schema_failure_is_422_and_names_the_field(app: FastAPI) -> None:
    @app.post("/needs-reason")
    async def _needs_reason(payload: ReasonPayload) -> dict[str, str]:
        return {"reason": payload.reason}

    with TestClient(app) as client:
        response = client.post("/needs-reason", json={})

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "VALIDATION_FAILED"
    assert body["details"]["errors"][0]["loc"] == ["body", "reason"]


def test_a_schema_failure_never_echoes_the_submitted_value(app: FastAPI) -> None:
    """FastAPI echoes the offending input by default. On this system that input
    is a grantor name or a legal description."""

    @app.post("/echo-check")
    async def _echo_check(payload: PageCountPayload) -> dict[str, int]:
        return {"page_count": payload.page_count}

    with TestClient(app) as client:
        response = client.post("/echo-check", json={"page_count": "TIMOTHY BUCHANAN"})

    assert response.status_code == 422
    assert "TIMOTHY BUCHANAN" not in response.text


def test_sanitise_validation_errors_keeps_only_the_code_and_location() -> None:
    cleaned = sanitise_validation_errors(
        [
            {
                "type": "string_type",
                "loc": ("body", "grantor"),
                "msg": "Input should be a valid string",
                "input": "TIMOTHY BUCHANAN",
                "ctx": {"value": "TIMOTHY BUCHANAN"},
                "url": "https://errors.pydantic.dev/2.13/v/string_type",
            }
        ]
    )
    assert cleaned == [{"type": "string_type", "loc": ["body", "grantor"]}]


def test_an_unhandled_exception_leaks_nothing_in_production(
    production_settings: CoreApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> None:
    """No type name, no message, no traceback. The detail is in the log, bound
    to the request id the caller was given."""
    app = create_app(production_settings, clock=frozen_clock, id_factory=id_factory)

    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("connection string postgres://user:hunter2@db/titlepipe")

    with TestClient(
        app, raise_server_exceptions=False, base_url="https://app.titlepipe.example"
    ) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    body = response.json()["error"]
    assert body["code"] == CODE_INTERNAL_ERROR
    assert body["message"] == GENERIC_INTERNAL_MESSAGE
    assert body["details"] == {}
    assert body["request_id"]

    text = response.text
    assert "hunter2" not in text
    assert "RuntimeError" not in text
    assert "Traceback" not in text
    assert "titlepipe_core" not in text


def test_an_unhandled_exception_is_diagnosable_in_development(app: FastAPI) -> None:
    """Locally the developer message is present — there is no real NPI in a
    development environment, and a blank 500 wastes an afternoon."""

    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("something specific")

    with TestClient(app, raise_server_exceptions=False) as client:
        body = client.get("/boom").json()["error"]

    assert body["code"] == CODE_INTERNAL_ERROR
    assert body["details"]["exception"] == "RuntimeError"
    assert body["details"]["developer_message"] == "something specific"


def test_domain_and_service_code_never_import_httpexception() -> None:
    """The boundary rule: domain code raises DomainError; only the mapping
    layer knows about HTTP."""
    from pathlib import Path

    import titlepipe_core

    root = Path(titlepipe_core.__file__).parent
    offenders = [
        path.relative_to(root).as_posix()
        for path in root.rglob("*.py")
        if "HTTPException" in path.read_text(encoding="utf-8") and path.name != "errors.py"
    ]
    assert not offenders, f"HTTPException outside the mapping layer: {offenders}"


# --- fixes from the deployment-hardening review -----------------------------


def test_a_validator_message_never_reaches_the_caller(
    production_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """Review reproduced a production 422 containing the submitted party name.

    Stripping `input` and `ctx` was not enough: a custom validator puts the
    value into `msg`, which was still being returned.
    """
    app = create_app(production_settings, clock=frozen_clock)

    @app.post("/correct")
    async def _correct(payload: UppercaseGrantor) -> dict[str, str]:
        return {"grantor": payload.grantor}

    with TestClient(app, base_url=DEPLOYED_BASE_URL) as client:
        response = client.post("/correct", json={"grantor": "Timothy Buchanan"})

    assert response.status_code == 422
    assert "Timothy Buchanan" not in response.text

    errors = response.json()["error"]["details"]["errors"]
    assert errors == [{"type": "value_error", "loc": ["body", "grantor"]}]


def test_an_unhandled_500_carries_the_correlation_header_and_cors(
    production_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """All three were missing when Starlette's ServerErrorMiddleware rendered
    the 500: it sits outside both the correlation and CORS layers."""
    app = create_app(production_settings, clock=frozen_clock)

    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("connection string postgres://u:hunter2@db/core")

    with TestClient(app, raise_server_exceptions=False, base_url=DEPLOYED_BASE_URL) as client:
        response = client.get(
            "/boom",
            headers={"Origin": "https://app.titlepipe.example", "X-Request-ID": "trace-500"},
        )

    assert response.status_code == 500
    assert response.headers["X-Request-ID"] == "trace-500"
    assert response.headers["access-control-allow-origin"] == "https://app.titlepipe.example"
    assert response.json()["error"]["request_id"] == "trace-500"
    assert "hunter2" not in response.text
    assert "RuntimeError" not in response.text


def test_a_forged_host_header_is_refused(
    production_settings: CoreApiSettings, frozen_clock: FrozenClock
) -> None:
    """Without a Host allowlist, an absolute link the service generates can be
    pointed at an attacker's domain."""
    app = create_app(production_settings, clock=frozen_clock)

    with TestClient(app, base_url="https://evil.example") as client:
        assert client.get("/health").status_code == 400

    with TestClient(app, base_url=DEPLOYED_BASE_URL) as client:
        assert client.get("/health").status_code == 200

"""The blind service honours the same foundation contract as the Core API.

Same envelope, same correlation-id behaviour, same redaction-first log chain,
same configuration refusals. A typist-facing service with weaker guarantees
than the internal one would be exactly backwards.
"""

from __future__ import annotations

import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from titlepipe_blind.api.errors import CODE_INTERNAL_ERROR, GENERIC_INTERNAL_MESSAGE
from titlepipe_blind.api.request_context import REQUEST_ID_HEADER
from titlepipe_blind.app import create_app
from titlepipe_blind.settings import DEVELOPMENT_SEAL_PASSWORD, BlindApiSettings
from titlepipe_blind.telemetry.logging import configure_logging, get_logger
from titlepipe_domain import Environment, LogRenderer, RefusalError
from titlepipe_test_support import FrozenClock, SequenceIdFactory

GOOD_SECRET = "a-real-32-character-seal-secret!"


def deployed(**overrides: object) -> BlindApiSettings:
    base: dict[str, object] = {
        "environment": Environment.PRODUCTION,
        "host": "0.0.0.0",
        "docs_enabled": False,
        "cors_allowed_origins": ("https://capture.titlepipe.example",),
        "cookie_seal_password": SecretStr(GOOD_SECRET),
    }
    base.update(overrides)
    return BlindApiSettings(**base)  # pyright: ignore[reportArgumentType]


def test_the_baseline_deployed_configuration_is_valid() -> None:
    assert deployed().environment is Environment.PRODUCTION


@pytest.mark.parametrize(
    ("override", "expected"),
    [
        ({"debug": True}, "debug is enabled"),
        ({"reload": True}, "reload is enabled"),
        ({"mock_auth_enabled": True}, "mock auth is enabled"),
        ({"docs_enabled": True}, "public API docs are enabled"),
        ({"redaction_enabled": False}, "log redaction is disabled"),
        ({"cors_allowed_origins": ("*",)}, "CORS allows any origin"),
        ({"host": "127.0.0.1"}, "loopback"),
    ],
)
def test_production_refuses_each_unsafe_knob(override: dict[str, object], expected: str) -> None:
    with pytest.raises(ValidationError, match=expected):
        deployed(**override)


def test_production_refuses_the_placeholder_secret() -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        deployed(cookie_seal_password=SecretStr(DEVELOPMENT_SEAL_PASSWORD))


def test_health_and_readiness(client: TestClient) -> None:
    assert client.get("/health").status_code == 200
    body = client.get("/ready").json()
    assert body["ready"] is True
    assert body["checks"] == {"startup_complete": True}


def test_a_request_id_is_returned_and_propagated(client: TestClient) -> None:
    assert client.get("/health").headers[REQUEST_ID_HEADER] == "req-000001"
    assert (
        client.get("/health", headers={REQUEST_ID_HEADER: "edge-1"}).headers[REQUEST_ID_HEADER]
        == "edge-1"
    )


def test_a_domain_refusal_maps_to_the_documented_envelope(app: FastAPI) -> None:
    @app.get("/refused")
    async def _refused() -> None:
        raise RefusalError("A source citation is required.")

    with TestClient(app) as client:
        response = client.get("/refused")

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "REFUSED"
    assert body["message"] == "A source citation is required."
    assert body["request_id"]


def test_an_unhandled_exception_leaks_nothing_in_production(
    production_settings: BlindApiSettings,
    frozen_clock: FrozenClock,
    id_factory: SequenceIdFactory,
) -> None:
    app = create_app(production_settings, clock=frozen_clock, id_factory=id_factory)

    @app.get("/boom")
    async def _boom() -> None:
        raise RuntimeError("blind db dsn postgresql://blind:hunter2@host/blind")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    body = response.json()["error"]
    assert body["code"] == CODE_INTERNAL_ERROR
    assert body["message"] == GENERIC_INTERNAL_MESSAGE
    assert body["request_id"]
    assert "hunter2" not in response.text
    assert "RuntimeError" not in response.text


def test_redaction_runs_before_rendering(capsys: pytest.CaptureFixture[str]) -> None:
    configure_logging(renderer=LogRenderer.JSON, redaction_enabled=True)
    get_logger("test").info("entry_recorded", grantor="TIMOTHY BUCHANAN", field_count=12)
    captured = capsys.readouterr().out
    assert "TIMOTHY BUCHANAN" not in captured
    assert "entry_recorded" in captured


@pytest.fixture(autouse=True)
def _reset_structlog() -> object:
    yield
    structlog.reset_defaults()

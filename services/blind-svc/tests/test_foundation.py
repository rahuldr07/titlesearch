"""The blind service honours the same foundation contract as the Core API.

Same envelope, same correlation-id behaviour, same redaction-first log chain,
same configuration refusals. A typist-facing service with weaker guarantees
than the internal one would be exactly backwards.
"""

from __future__ import annotations

import traceback
from collections.abc import AsyncGenerator

import pytest
import structlog
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from starlette.responses import StreamingResponse

from titlepipe_blind.api.errors import CODE_INTERNAL_ERROR, GENERIC_INTERNAL_MESSAGE
from titlepipe_blind.api.request_context import REQUEST_ID_HEADER
from titlepipe_blind.app import create_app
from titlepipe_blind.settings import DEVELOPMENT_SEAL_PASSWORD, BlindApiSettings
from titlepipe_domain import Environment, LogRenderer, RefusalError
from titlepipe_service_kit.settings_errors import (
    HIDE_INPUT_IN_ERRORS,
    SettingsValidationError,
)
from titlepipe_service_kit.telemetry.logging import configure_logging, get_logger
from titlepipe_test_support import FrozenClock, SequenceIdFactory

GOOD_SECRET = "a-real-32-character-seal-secret!"


def deployed(**overrides: object) -> BlindApiSettings:
    base: dict[str, object] = {
        "environment": Environment.PRODUCTION,
        "host": "0.0.0.0",
        "docs_enabled": False,
        "cors_allowed_origins": ("https://capture.titlepipe.example",),
        "allowed_hosts": ("capture.titlepipe.example",),
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


def test_a_same_origin_deployment_may_have_no_cors_allowlist() -> None:
    assert deployed(cors_allowed_origins=(), same_origin_deployment=True).cors_allowed_origins == ()


def test_production_refuses_an_empty_cors_allowlist_by_default() -> None:
    with pytest.raises(ValidationError, match="CORS allowlist is empty"):
        deployed(cors_allowed_origins=())


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


def test_a_mid_stream_failure_does_not_start_a_second_response(app: FastAPI) -> None:
    """The same guard as the Core API, asserted here rather than assumed.

    The middleware substitutes a 500 envelope to keep the correlation header
    and the CORS layer, but only while the status line is still unsent. A
    second `http.response.start` replaces the real failure with an ASGI
    protocol error and truncates the body. Capture uploads stream, so this is
    reachable here first.
    """

    @app.get("/stream")
    async def _stream() -> StreamingResponse:
        async def body() -> AsyncGenerator[bytes]:
            yield b"partial"
            raise RuntimeError("failed after the first chunk")

        return StreamingResponse(body(), media_type="text/plain")

    with TestClient(app) as client, pytest.raises(RuntimeError, match="after the first chunk"):
        client.get("/stream")


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

    with TestClient(
        app, raise_server_exceptions=False, base_url="https://capture.titlepipe.example"
    ) as client:
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


# --- the boot failure that must not print what it was validating -----------
#
# The same leak core-api proved, reproduced identically here: `BlindApiSettings`
# is a second private copy of the settings model, outside the sealed
# `BaseServiceSettings` hierarchy, so nothing but these tests holds
# `hide_input_in_errors` True for it. Each was watched fail — a bare `raise` at
# the `from_environment` boundary reds the first; deleting
# `hide_input_in_errors=True` reds the other two; doing both reds the first on
# its leak assertion, with `PrOdPw123` in the formatted traceback.
#
# The credential carried here is `core_database_url` — the one this service
# must never hold. It is a bystander to the failure, which is the shape of the
# bug: the seal validator refuses an unrelated five-character password, and
# pydantic appends the whole pre-validation dict, Core DSN included.

LEAKABLE_DSN_PASSWORD = "PrOdPw123"


def test_a_failed_boot_never_prints_the_dsn_password(monkeypatch: pytest.MonkeyPatch) -> None:
    """`format_exception` and not `str(exc)`: the leak reached stderr as an
    uncaught traceback, so a chained original would carry the input dict even
    when the replacement does not."""
    for name, value in (
        ("ENVIRONMENT", "production"),
        ("COOKIE_SEAL_PASSWORD", "short"),
        ("CORE_DATABASE_URL", f"postgresql://u:{LEAKABLE_DSN_PASSWORD}@h/d"),
        ("ALLOWED_HOSTS", '["capture.titlepipe.example"]'),
        ("HOST", "0.0.0.0"),
        ("DOCS_ENABLED", "false"),
        ("SAME_ORIGIN_DEPLOYMENT", "true"),
    ):
        monkeypatch.setenv(f"TITLEPIPE_BLIND_{name}", value)

    with pytest.raises(SettingsValidationError) as caught:
        BlindApiSettings.from_environment()

    rendered = "".join(traceback.format_exception(caught.value))
    assert LEAKABLE_DSN_PASSWORD not in rendered, (
        "the boot traceback published the Core DSN password it exists to refuse"
    )
    # The refusal still has to say what is wrong, or redaction has traded one
    # unusable boot for another. It names `cookie_seal_password` and not
    # `core_database_url` because the seal validator is declared first and a
    # raising model validator aborts the rest — which is the reproduction
    # exactly: the field that FAILED is not the field that leaked.
    assert "cookie_seal_password" in rendered


def test_a_direct_construction_renders_no_input_at_all() -> None:
    """The assertion is on `input_value=`, not on a secret: pydantic truncates
    the input dict to a head and a tail, so a secret-absence assertion here
    would pass on a build with the flag removed, by luck of field order."""
    with pytest.raises(ValidationError) as caught:
        deployed(cookie_seal_password=SecretStr("short"))

    assert "input_value=" not in str(caught.value)


def test_the_model_hides_its_input() -> None:
    assert BlindApiSettings.model_config.get(HIDE_INPUT_IN_ERRORS) is True

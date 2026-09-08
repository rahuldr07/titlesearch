"""The blind service honours the same foundation contract as the Core API.

Same envelope, same correlation-id behaviour, same redaction-first log chain,
same configuration refusals. A typist-facing service with weaker guarantees
than the internal one would be exactly backwards.
"""

from __future__ import annotations

import base64
import traceback
from collections.abc import AsyncGenerator

import pytest
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from starlette.responses import StreamingResponse

from titlepipe_blind.api.errors import (
    CODE_INTERNAL_ERROR,
    GENERIC_HTTP_MESSAGE,
    GENERIC_INTERNAL_MESSAGE,
)
from titlepipe_blind.api.request_context import REQUEST_ID_HEADER
from titlepipe_blind.app import create_app
from titlepipe_blind.settings import BlindApiSettings
from titlepipe_domain import (
    DependencyUnavailableError,
    DomainError,
    Environment,
    LogRenderer,
    RefusalError,
)
from titlepipe_service_kit.settings import DEVELOPMENT_SEAL_PASSWORD
from titlepipe_service_kit.settings_errors import (
    HIDE_INPUT_IN_ERRORS,
    SettingsValidationError,
)
from titlepipe_service_kit.telemetry.logging import configure_logging, get_logger
from titlepipe_test_support import FrozenClock, SequenceIdFactory

# A valid Fernet key — urlsafe-base64 of 32 bytes, 44 characters. Not "a
# 32-character string": that distinction is the bug this file now pins, and
# it is spelled out per module because `from conftest import ...` resolves
# only under pytest's legacy import mode (`conftest.py` records the break).
GOOD_SECRET = "YS1yZWFsLWJsaW5kLXNlYWwtc2VjcmV0LTMyYnl0ZXM="


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


# --- the seal is a FERNET KEY, and this service used to disagree ------------
#
# 🔴 EVERY ONE OF THESE FOUR WAS WATCHED FAIL ON THE PREVIOUS `settings.py`,
# which carried its own `SEAL_PASSWORD_LENGTH = 32` and a 32-character
# placeholder that is not urlsafe-base64. In that state:
#
#   * `test_a_real_fernet_key_is_accepted` -> `must be exactly 32 characters;
#     got 44` — the service REFUSED every credential WorkOS can issue;
#   * `test_a_thirty_two_character_string_is_refused` -> DID NOT RAISE — the
#     one length that cannot be a key was the only one accepted;
#   * `test_forty_four_characters_of_the_wrong_alphabet_is_refused` -> `must be
#     exactly 32 characters; got 44`, which is a refusal for the wrong reason
#     and would have passed a `pytest.raises(ValidationError)` written without
#     a `match=`;
#   * `test_the_development_default_satisfies_its_own_rule` -> the constructed
#     default came back as `development-only-seal-password!!` where the shared
#     `DEVELOPMENT_SEAL_PASSWORD` is `ZGV2ZWxvcG1lbnQtb25seS1zZWFsLXBhc3N3b3JkISE=`,
#     which is the private copy answering in place of the one home.
#
# Nothing in this service reads `cookie_seal_password` yet, which is why no
# existing test exercised the value and why the copy stayed wrong.


def test_a_real_fernet_key_is_accepted() -> None:
    assert len(GOOD_SECRET) == 44
    assert len(base64.urlsafe_b64decode(GOOD_SECRET)) == 32
    assert deployed().cookie_seal_password.get_secret_value() == GOOD_SECRET


def test_a_thirty_two_character_string_is_refused() -> None:
    """The exact value this service used to require, and it is not a key.

    32 is the DECODED byte count. A 32-character password is the shape an
    operator produces by following a "must be exactly 32 characters"
    instruction, which is what `.env.example` used to say.
    """
    with pytest.raises(ValidationError, match="44-character"):
        deployed(cookie_seal_password=SecretStr("a-real-32-character-seal-secret!"))


def test_forty_four_characters_of_the_wrong_alphabet_is_refused() -> None:
    """Length is the cheap half. This is the half that catches a bad paste."""
    with pytest.raises(ValidationError, match=r"urlsafe-base64|decode to exactly"):
        deployed(cookie_seal_password=SecretStr("!" * 44))


def test_the_development_default_satisfies_its_own_rule() -> None:
    """The default must pass the real validator, not a weaker one.

    It did not before: the placeholder was 32 characters and so was the check,
    so the only value ever exercised was the one that should have failed.
    """
    assert len(DEVELOPMENT_SEAL_PASSWORD) == 44
    assert len(base64.urlsafe_b64decode(DEVELOPMENT_SEAL_PASSWORD)) == 32
    assert BlindApiSettings(
        environment=Environment.DEVELOPMENT
    ).cookie_seal_password.get_secret_value() == (DEVELOPMENT_SEAL_PASSWORD)


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
# The same leak core-api proved, reproduced identically here. Each of these was
# watched fail — a bare `raise` at the `from_environment` boundary reds the
# first; deleting `hide_input_in_errors=True` reds the other two; doing both
# reds the first on its leak assertion, with `PrOdPw123` in the formatted
# traceback.
#
# 🔴 THESE ARE NO LONGER THE ONLY THING HOLDING IT. The comment here used to say
# `BlindApiSettings` was a private copy outside the sealed `BaseServiceSettings`
# hierarchy, so nothing but these tests held `hide_input_in_errors` True for it.
# It is inside that hierarchy now, and `BaseServiceSettings.__pydantic_init
# _subclass__` refuses at class-definition time any subclass that sets the flag
# to anything but True — a machine, not a test. These stay because the seal
# holds the FLAG and these hold the BEHAVIOUR: that the flag is what stops the
# DSN reaching a traceback, through this service's own `create_app` ordering.
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


# The blind service's half of `core-api/tests/test_errors.py`'s three
# `_publishable_detail` tests. `api/errors.py` in each service carries the
# function byte-for-byte, because `libs/service-kit` has no `api` module yet;
# these are what make the two copies observably the same rather than assumed to
# be. A change to one that is not made to the other reds here.
_AUTHORED_DETAIL = "capture 41c9 was sealed for a different typist"


def _app_answering_with(
    status: int, detail: str, settings: BlindApiSettings, clock: FrozenClock
) -> FastAPI:
    app = create_app(settings, clock=clock, id_factory=SequenceIdFactory())

    @app.get("/detail")
    async def _detail() -> None:
        raise HTTPException(status_code=status, detail=detail)

    return app


def test_an_authored_http_detail_is_not_published_in_production(
    production_settings: BlindApiSettings, frozen_clock: FrozenClock
) -> None:
    """🔴 THE DETAIL USED TO REACH THE TYPIST VERBATIM, IN EVERY ENVIRONMENT.

    This service is the one holding the capture uploads, so the margin between a
    dormant leak and a live one is worth less here than anywhere: the ban on
    `HTTPException` outside `api/errors.py` is our code's discipline and says
    nothing about a dependency that raises one.
    """
    app = _app_answering_with(403, _AUTHORED_DETAIL, production_settings, frozen_clock)

    with TestClient(app, base_url="https://capture.titlepipe.example") as client:
        response = client.get("/detail")

    assert response.status_code == 403, "redacting the sentence must not change the status"
    assert response.json()["error"]["message"] == GENERIC_HTTP_MESSAGE, (
        f"the authored detail reached a production caller: {response.json()['error']!r}"
    )
    assert "41c9" not in response.text, "the detail is in the body under some other key"


def test_the_same_detail_is_published_outside_a_deployed_environment(
    development_settings: BlindApiSettings, frozen_clock: FrozenClock
) -> None:
    """A blank error wastes an afternoon and there is no real NPI in development."""
    app = _app_answering_with(403, _AUTHORED_DETAIL, development_settings, frozen_clock)

    with TestClient(app) as client:
        response = client.get("/detail")

    assert response.json()["error"]["message"] == _AUTHORED_DETAIL, (
        f"a developer got {response.json()['error']!r} instead of the detail"
    )


def test_an_unroutable_url_still_says_not_found_in_production(
    production_settings: BlindApiSettings, frozen_clock: FrozenClock
) -> None:
    """Starlette's own default detail is the status phrase and stays published."""
    app = create_app(production_settings, clock=frozen_clock, id_factory=SequenceIdFactory())

    with TestClient(app, base_url="https://capture.titlepipe.example") as client:
        response = client.get("/no-such-route")

    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Not Found", (
        f"an unrouted URL now answers {response.json()['error']!r}. That is the one detail every "
        f"deployment produces, and it is the protocol's own word."
    )


def test_only_a_genuinely_unmapped_error_is_logged_as_unmapped(
    frozen_clock: FrozenClock, capsys: pytest.CaptureFixture[str]
) -> None:
    """A defect this service inherited with its copy of core-api's error layer.

    `handle_domain_error` read `if status >= 500` and logged
    `domain_error_unmapped`, whose own comment says "a gap in
    `DOMAIN_ERROR_STATUS`". `DependencyUnavailableError: 503` IS in that dict,
    so a correctly-mapped dependency failure logged an ERROR claiming it was
    not. core-api measured this on its own byte-identical copy and fixed it
    there; this copy kept it, and stayed quiet only because nothing here raises
    a registered 5xx yet. That is the whole argument for these two modules
    having one home rather than two.

    BOTH ARMS, AND THE SECOND IS NOT OPTIONAL. Deleting the log entirely passes
    a test that only checks the 503 is quiet, and deleting the log is the
    obvious wrong fix: the loud line for a real gap is the thing worth keeping.
    So a registered 503 must be SILENT and an unregistered subclass must SHOUT.

    `LogRenderer.JSON` is pinned rather than defaulted — the console renderer
    would also contain the event name, and this must not depend on which is in
    force.
    """

    class UnregisteredFailureError(DomainError):
        """Directly under `DomainError`, so the MRO walk finds no entry at all.

        A `RefusalError` subclass would resolve to 422 through its parent, which
        is a different behaviour and not what this asserts.
        """

        code = "UNREGISTERED_FAILURE"

    settings = BlindApiSettings(environment=Environment.TEST, log_renderer=LogRenderer.JSON)
    app = create_app(settings, clock=frozen_clock, id_factory=SequenceIdFactory())

    @app.get("/registered-503")
    async def _registered() -> None:
        raise DependencyUnavailableError("A dependency is temporarily unavailable.")

    @app.get("/unregistered")
    async def _unregistered() -> None:
        raise UnregisteredFailureError("Nothing maps this.")

    with TestClient(app) as client:
        registered = client.get("/registered-503")
        quiet = capsys.readouterr().out
        unregistered = client.get("/unregistered")
        shouted = capsys.readouterr().out

    assert registered.status_code == 503
    assert registered.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
    assert "domain_error_unmapped" not in quiet, (
        "a status registered in DOMAIN_ERROR_STATUS was reported as unmapped; "
        "the condition is asking about the number rather than about the lookup"
    )

    assert unregistered.status_code == 500
    assert unregistered.json()["error"]["code"] == "UNREGISTERED_FAILURE"
    assert "domain_error_unmapped" in shouted, (
        "a DomainError with no entry in DOMAIN_ERROR_STATUS must be reported "
        "loudly; deleting the log is not the fix for the false positive"
    )

"""Configuration safety.

A deployed environment must refuse to start on an unsafe knob. Each of these
proves one specific refusal, because a single test asserting "it raises" would
still pass if only one of the seven checks survived a refactor.
"""

from __future__ import annotations

import base64
import traceback

import pytest
from pydantic import SecretStr, ValidationError

from titlepipe_core.settings import (
    DEVELOPMENT_SEAL_PASSWORD,
    CoreApiSettings,
)
from titlepipe_domain import Environment, LogRenderer
from titlepipe_service_kit.settings_errors import (
    HIDE_INPUT_IN_ERRORS,
    SettingsValidationError,
)

# A valid Fernet key: urlsafe-base64 of 32 bytes, 44 characters. Not "a 32
# character string" — that distinction is the bug these tests now pin.
GOOD_SECRET = "dGVzdC1zZWFsLXNlY3JldC1leGFjdGx5LTMyLWJ5dGU="

# A DSN nothing connects with, for the same reason `GOOD_SECRET` is a key nothing
# seals with: `deployed()` below is a MODULE-LEVEL helper and cannot request a
# fixture, so the value is local. `tests/conftest.py::DEPLOYED_DATABASE_URL` is
# its own copy for its own fixtures — the same split `GOOD_SECRET` and
# `conftest.DEPLOYED_SEAL_PASSWORD` already are, and deliberately so: two
# independently written literals cannot drift into agreeing for a wrong reason.
#
# `db.titlepipe.example` is under RFC 2606's reserved TLD and resolves nowhere.
# Nothing in this module builds an engine; only Pydantic reads this.
DEPLOYED_DATABASE_URL = (
    "postgresql+psycopg://titlepipe_app:this-dsn-never-connects@db.titlepipe.example:5432/titlepipe"
)


# This module's own copies of the WorkOS pair, for the reason stated above
# `DEPLOYED_DATABASE_URL`: `deployed()` is module-level and cannot request a
# fixture, and two independently written literals cannot drift into agreeing for
# a wrong reason. Neither value is format-checked and neither is ever sent
# anywhere — `settings.py` validates presence, and nothing here builds a client.
WORKOS_API_KEY = "this-workos-key-never-authenticates"
WORKOS_CLIENT_ID = "client_this_tenant_does_not_exist"


def deployed(**overrides: object) -> CoreApiSettings:
    """A production configuration that passes, plus whatever the test breaks."""
    base: dict[str, object] = {
        "environment": Environment.PRODUCTION,
        "host": "0.0.0.0",
        "docs_enabled": False,
        "cors_allowed_origins": ("https://app.titlepipe.example",),
        "allowed_hosts": ("app.titlepipe.example",),
        "cookie_seal_password": SecretStr(GOOD_SECRET),
        # Required when deployed, like every other key in this baseline. Inert:
        # the host is under RFC 2606's reserved `.example` TLD and nothing in
        # this module builds an engine. A test that wants the refusal passes
        # `app_database_url=None` as an override, which is how every other
        # refusal below is driven.
        "app_database_url": SecretStr(DEPLOYED_DATABASE_URL),
        # Required when deployed. A test that wants the refusal overrides one or
        # both back to `None`, the way `app_database_url` above is driven.
        "workos_api_key": SecretStr(WORKOS_API_KEY),
        "workos_client_id": WORKOS_CLIENT_ID,
    }
    base.update(overrides)
    return CoreApiSettings(**base)  # pyright: ignore[reportArgumentType]


def test_the_baseline_deployed_configuration_is_valid() -> None:
    """If this fails, every refusal test below is passing for the wrong reason."""
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
        # The one whose absence is invisible at runtime rather than merely
        # dangerous: `/health` and `/ready` both stay green — readiness reports
        # a database check only when a DSN is configured, so a missing one is
        # NO check rather than a failed one — while `GET /api/rules` answers a
        # retryable 503 that can never succeed. `settings.py` carries the
        # argument; `test_rules_endpoint.py` measures both halves of it.
        ({"app_database_url": None}, "app_database_url is not set"),
        # Both WorkOS values, because a deployed service with neither starts
        # with an EMPTY provider registry — which is fail-closed and therefore
        # safe, and which looks identical to a WorkOS outage, an expired key or
        # a browser sending no cookie. The refusal names the cause once.
        (
            {"workos_api_key": None, "workos_client_id": None},
            "WorkOS is not configured",
        ),
        (
            {"workos_api_key": SecretStr("change-me")},
            "workos_api_key is a placeholder",
        ),
    ],
)
def test_production_refuses_each_unsafe_knob(override: dict[str, object], expected: str) -> None:
    with pytest.raises(ValidationError, match=expected):
        deployed(**override)


@pytest.mark.parametrize(
    ("override", "expected"),
    [
        ({"workos_api_key": None}, "workos_api_key is not set"),
        ({"workos_client_id": None}, "workos_client_id is not set"),
    ],
)
def test_half_configured_workos_is_refused_in_every_environment(
    override: dict[str, object], expected: str
) -> None:
    """NOT a deployed-only rule, unlike everything above it.

    A half-set pair in development produces no adapter and a service that
    answers every request "Not signed in.", which is what a bad key looks like
    too. The refusal is what stops an operator debugging the wrong thing.

    Driven at `Environment.TEST` precisely so a passing test cannot be explained
    by the deployed validator, which would refuse this configuration anyway.
    """
    base: dict[str, object] = {
        "environment": Environment.TEST,
        "workos_api_key": SecretStr(WORKOS_API_KEY),
        "workos_client_id": WORKOS_CLIENT_ID,
    }
    base.update(override)
    with pytest.raises(ValidationError, match=expected):
        CoreApiSettings(**base)  # pyright: ignore[reportArgumentType]


@pytest.mark.parametrize(
    "override",
    [
        {"workos_api_key": SecretStr("")},
        {"workos_client_id": ""},
        {"workos_client_id": "   "},
    ],
)
def test_a_blank_workos_value_is_refused_rather_than_read_as_absent(
    override: dict[str, object],
) -> None:
    """`TITLEPIPE_WORKOS_CLIENT_ID=` is a present, empty value.

    pydantic reads it as `""`, not `None`, so without this rule the pair looks
    complete, `workos_configured` answers True, and the seam builds an SDK
    client around nothing.
    """
    base: dict[str, object] = {
        "environment": Environment.TEST,
        "workos_api_key": SecretStr(WORKOS_API_KEY),
        "workos_client_id": WORKOS_CLIENT_ID,
    }
    base.update(override)
    with pytest.raises(ValidationError, match="set but blank"):
        CoreApiSettings(**base)  # pyright: ignore[reportArgumentType]


def test_workos_configured_is_false_when_nothing_is_set() -> None:
    """The state of a laptop, and the reason `build_auth_seam` can read one
    property instead of restating the all-or-nothing rule."""
    assert CoreApiSettings(environment=Environment.TEST).workos_configured is False
    assert (
        CoreApiSettings(
            environment=Environment.TEST,
            workos_api_key=SecretStr(WORKOS_API_KEY),
            workos_client_id=WORKOS_CLIENT_ID,
        ).workos_configured
        is True
    )


def test_production_refuses_an_empty_cors_allowlist_by_default() -> None:
    """An operator who simply forgot must not look like a deliberate
    same-origin deployment."""
    with pytest.raises(ValidationError, match="CORS allowlist is empty"):
        deployed(cors_allowed_origins=())


def test_a_same_origin_deployment_may_have_no_cors_allowlist() -> None:
    """When the browser app is served from this origin, no cross-origin request
    is ever made and the safest configuration is no CORS at all. Refusing it
    pushed operators toward configuring CORS they did not need."""
    settings = deployed(cors_allowed_origins=(), same_origin_deployment=True)
    assert settings.cors_allowed_origins == ()


def test_declaring_same_origin_while_configuring_cors_is_refused() -> None:
    """The two contradict each other; one of them is a mistake."""
    with pytest.raises(ValidationError, match="contradict"):
        deployed(
            cors_allowed_origins=("https://app.titlepipe.example",),
            same_origin_deployment=True,
        )


def test_production_refuses_the_development_placeholder_secret() -> None:
    with pytest.raises(ValidationError, match="placeholder"):
        deployed(cookie_seal_password=SecretStr(DEVELOPMENT_SEAL_PASSWORD))


def test_staging_carries_the_same_rules_as_production() -> None:
    """Staging integrates with real WorkOS, R2 and providers. Relaxing it there
    is the same exposure, discovered later."""
    with pytest.raises(ValidationError, match="debug is enabled"):
        deployed(environment=Environment.STAGING, debug=True)


def test_development_permits_the_convenient_defaults() -> None:
    settings = CoreApiSettings(environment=Environment.DEVELOPMENT, debug=True)
    assert settings.debug is True
    assert settings.docs_enabled is True


def test_seal_password_must_be_a_44_character_fernet_key() -> None:
    """WorkOS sealed sessions require it. Fail at startup, not at first login.

    THE NUMBER WAS 32 AND IT WAS WRONG — that is the byte count, not the encoded
    length. Every real WorkOS credential is 44 characters, so the old check
    rejected the genuine article and accepted nothing that works.
    """
    with pytest.raises(ValidationError, match="44-character"):
        CoreApiSettings(
            environment=Environment.DEVELOPMENT, cookie_seal_password=SecretStr("too-short")
        )
    # The old value: 32 characters, which used to PASS. It must now fail.
    with pytest.raises(ValidationError, match="44-character"):
        CoreApiSettings(
            environment=Environment.DEVELOPMENT,
            cookie_seal_password=SecretStr("development-only-seal-password!!"),
        )


def test_seal_password_of_the_right_length_but_wrong_alphabet_is_refused() -> None:
    """Length is the cheap half. This is the half that catches a bad paste."""
    with pytest.raises(ValidationError, match=r"urlsafe-base64|decode to exactly"):
        CoreApiSettings(
            environment=Environment.DEVELOPMENT,
            cookie_seal_password=SecretStr("!" * 44),
        )


def test_the_development_default_satisfies_its_own_rule() -> None:
    """The default must pass the real validator, not a weaker one.

    It did not before: the placeholder was 32 characters and so was the check,
    so the only value ever exercised was the one that should have failed.
    """
    assert len(DEVELOPMENT_SEAL_PASSWORD) == 44
    assert len(base64.urlsafe_b64decode(DEVELOPMENT_SEAL_PASSWORD)) == 32
    assert CoreApiSettings(
        environment=Environment.DEVELOPMENT
    ).cookie_seal_password.get_secret_value() == (DEVELOPMENT_SEAL_PASSWORD)


def test_renderer_is_console_locally_and_json_when_deployed() -> None:
    assert (
        CoreApiSettings(environment=Environment.DEVELOPMENT).effective_log_renderer
        is LogRenderer.CONSOLE
    )
    assert deployed().effective_log_renderer is LogRenderer.JSON


def test_renderer_can_be_overridden_explicitly() -> None:
    settings = CoreApiSettings(environment=Environment.DEVELOPMENT, log_renderer=LogRenderer.JSON)
    assert settings.effective_log_renderer is LogRenderer.JSON


def test_docs_disabled_removes_the_schema_route() -> None:
    assert deployed().openapi_url is None
    assert CoreApiSettings(environment=Environment.DEVELOPMENT).openapi_url == "/openapi.json"


def test_secrets_do_not_appear_in_repr_or_str() -> None:
    """Settings are never logged — but if one ever is, the secret must not be
    in it."""
    settings = deployed()
    assert GOOD_SECRET not in repr(settings)
    assert GOOD_SECRET not in str(settings)


def test_unknown_configuration_keys_are_rejected() -> None:
    """A typo in a deployment variable must fail loudly rather than silently
    leaving the safe default in place."""
    with pytest.raises(ValidationError):
        CoreApiSettings(environment=Environment.DEVELOPMENT, dbeug=True)  # pyright: ignore[reportCallIssue]


# --- the boot failure that must not print what it was validating -----------
#
# `CoreApiSettings` does NOT inherit `BaseServiceSettings`, so the
# `__pydantic_init_subclass__` seal that holds `hide_input_in_errors` True on
# the shared base does not reach this class. These three are the whole machine
# for it, and each was watched fail:
#
#   - a bare `raise` at the `from_environment` boundary reds the first;
#   - deleting `hide_input_in_errors=True` reds the other two;
#   - doing BOTH reds the first on its leak assertion specifically, with
#     `PrOdPw123` present in the formatted traceback. That last one matters:
#     with either mechanism still in place the leak assertion cannot fail, and
#     an assertion that cannot fail proves nothing about the property it names.

# Short enough to survive pydantic's head-and-tail truncation of the input
# dict, which is what made the leak reachable rather than theoretical.
LEAKABLE_DSN_PASSWORD = "PrOdPw123"


def test_a_failed_boot_never_prints_the_dsn_password(monkeypatch: pytest.MonkeyPatch) -> None:
    """The reproduction, asserted over what an operator actually sees.

    Every variable below is a first-deploy configuration except the seal
    password, which is five characters — an UNRELATED refusal to the DSN, and
    that is the point: pydantic appended the whole pre-validation dict to the
    error, so the field that failed had nothing to do with the field that
    leaked.

    `format_exception` and not `str(exc)`, because the leak reached stderr as
    an uncaught traceback: a chained original would carry the input dict even
    when the replacement does not, which is why the boundary raises
    `from None`.
    """
    for name, value in (
        ("ENVIRONMENT", "production"),
        ("COOKIE_SEAL_PASSWORD", "short"),
        ("APP_DATABASE_URL", f"postgresql://u:{LEAKABLE_DSN_PASSWORD}@h/d"),
        ("ALLOWED_HOSTS", '["app.titlepipe.example"]'),
        ("HOST", "0.0.0.0"),
        ("DOCS_ENABLED", "false"),
        ("SAME_ORIGIN_DEPLOYMENT", "true"),
        ("WORKOS_API_KEY", WORKOS_API_KEY),
        ("WORKOS_CLIENT_ID", WORKOS_CLIENT_ID),
    ):
        monkeypatch.setenv(f"TITLEPIPE_{name}", value)

    with pytest.raises(SettingsValidationError) as caught:
        CoreApiSettings.from_environment()

    rendered = "".join(traceback.format_exception(caught.value))
    assert LEAKABLE_DSN_PASSWORD not in rendered, (
        "the boot traceback published the DSN password it was validating"
    )
    # Redaction must not have traded one unusable boot for another.
    assert "cookie_seal_password" in rendered


def test_a_direct_construction_renders_no_input_at_all() -> None:
    """`from_environment` is not the only way in — every test here calls the
    class, and that path never reaches the boundary catch.

    THE ASSERTION IS ON `input_value=`, NOT ON A SECRET. pydantic truncates the
    input dict to a head and a tail, so whether any particular value is visible
    depends on where it happens to sit among the other fields; a
    secret-absence assertion here would pass on a build with the flag removed,
    purely by luck of field order. `input_value=` is what pydantic emits
    whenever it renders input at all.
    """
    with pytest.raises(ValidationError) as caught:
        deployed(cookie_seal_password=SecretStr("short"))

    assert "input_value=" not in str(caught.value)


def test_the_model_hides_its_input() -> None:
    """The config key itself, because nothing else in this service asserts it.

    `CoreApiSettings` is outside the sealed hierarchy, so this is the only
    thing standing between a copy-pasted `SettingsConfigDict` and the leak.
    """
    assert CoreApiSettings.model_config.get(HIDE_INPUT_IN_ERRORS) is True

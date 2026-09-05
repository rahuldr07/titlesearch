"""The shared settings model, and the seal on its one safety rule.

The rule under test is small and its failure is silent: a deployed process that
starts with `debug` on, or with redaction off, looks exactly like a healthy one
until someone reads the logs. Four services used to carry their own copy of it.
Now one carries it and the others extend it, so what is asserted here is that
extending cannot become replacing.
"""

from __future__ import annotations

import traceback

import pytest
from pydantic import SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName
from titlepipe_service_kit.settings import (
    SEAL_VALIDATOR,
    SEALED_VALIDATOR,
    BaseHttpServiceSettings,
    BaseServiceSettings,
)
from titlepipe_service_kit.settings_errors import (
    HIDE_INPUT_IN_ERRORS,
    SettingsValidationError,
    redacted_settings_error,
)


class ExampleSettings(BaseServiceSettings):
    """A subclass shaped like a real one: its own prefix, its own service name."""

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_EXAMPLE_")

    service_name: ServiceName = ServiceName.WORKER
    risky_knob: bool = False

    def additional_unsafe_for_deployment(self) -> list[str]:
        return ["the risky knob is on"] if self.risky_knob else []


def _identity_validator(settings: BaseServiceSettings) -> BaseServiceSettings:
    """A stand-in for a sealed validator, annotated so pyright strict accepts it.

    A bare `lambda self: self` in the class body below is untyped, and pyright
    reports both the parameter and the return as unknown in a strict project.
    """
    return settings


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """No ambient TITLEPIPE_EXAMPLE_* variable may reach these tests."""
    import os

    for key in list(os.environ):
        if key.startswith("TITLEPIPE_EXAMPLE_"):
            monkeypatch.delenv(key, raising=False)


def test_the_subclass_inherits_the_common_fields() -> None:
    settings = ExampleSettings(environment=Environment.DEVELOPMENT)
    assert settings.log_level == "INFO"
    assert settings.redaction_enabled is True
    assert settings.debug is False
    assert settings.service_name is ServiceName.WORKER


def test_config_is_merged_rather_than_replaced() -> None:
    """The subclass declares only `env_prefix`; `extra="forbid"` and `frozen`
    come from the base. If pydantic replaced the config instead of merging it,
    an unknown variable would be silently accepted."""
    with pytest.raises(ValidationError):
        ExampleSettings(environment=Environment.DEVELOPMENT, not_a_field=1)  # pyright: ignore[reportCallIssue]  # rules-allow(any-type): the point of the test is to pass a field the model does not declare


def test_renderer_follows_the_environment_when_unset() -> None:
    assert (
        ExampleSettings(environment=Environment.DEVELOPMENT).effective_log_renderer
        is LogRenderer.CONSOLE
    )
    assert (
        ExampleSettings(environment=Environment.PRODUCTION).effective_log_renderer
        is LogRenderer.JSON
    )
    assert (
        ExampleSettings(
            environment=Environment.PRODUCTION, log_renderer=LogRenderer.CONSOLE
        ).effective_log_renderer
        is LogRenderer.CONSOLE
    )


def test_staging_counts_as_deployed() -> None:
    """Staging integrates with real providers, so an unsafe knob there is a real
    exposure and not a rehearsal."""
    with pytest.raises(ValidationError, match="debug is enabled"):
        ExampleSettings(environment=Environment.STAGING, debug=True)


def test_the_base_refusals_hold_in_a_subclass() -> None:
    with pytest.raises(ValidationError, match="debug is enabled"):
        ExampleSettings(environment=Environment.PRODUCTION, debug=True)
    with pytest.raises(ValidationError, match="log redaction is disabled"):
        ExampleSettings(environment=Environment.PRODUCTION, redaction_enabled=False)


def test_a_subclass_reason_is_added_to_the_base_ones_not_instead_of_them() -> None:
    with pytest.raises(ValidationError) as caught:
        ExampleSettings(environment=Environment.PRODUCTION, debug=True, risky_knob=True)
    message = str(caught.value)
    assert "debug is enabled" in message
    assert "the risky knob is on" in message


def test_nothing_is_refused_outside_a_deployed_environment() -> None:
    settings = ExampleSettings(
        environment=Environment.DEVELOPMENT, debug=True, redaction_enabled=False, risky_knob=True
    )
    assert settings.debug is True


def test_from_environment_reads_the_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TITLEPIPE_EXAMPLE_ENVIRONMENT", "test")
    monkeypatch.setenv("TITLEPIPE_EXAMPLE_LOG_LEVEL", "DEBUG")
    settings = ExampleSettings.from_environment()
    assert settings.environment is Environment.TEST
    assert settings.log_level == "DEBUG"


def test_a_missing_environment_is_a_startup_failure() -> None:
    """`SettingsValidationError`, not `ValidationError` — see the redaction
    tests below for why `from_environment` no longer lets pydantic's own
    exception out."""
    with pytest.raises(SettingsValidationError):
        ExampleSettings.from_environment()


def test_a_subclass_cannot_replace_the_deployed_refusal() -> None:
    """The one edit that would unseal the rule, refused at class definition.

    Overriding `additional_unsafe_for_deployment` extends; redefining the
    validator itself would replace, because pydantic resolves the child's
    same-named method in place of the parent's. Defining such a class raises,
    so the attempt fails when the module holding it is imported.
    """
    with pytest.raises(TypeError, match=SEALED_VALIDATOR):
        # Built with `type()` rather than a `class` statement because a class
        # statement at module level would raise at COLLECTION time and take the
        # whole file down instead of failing this one test.
        type(
            "Unsealed",
            (BaseServiceSettings,),
            {SEALED_VALIDATOR: _identity_validator},
        )


def test_a_subclass_cannot_replace_the_seal_password_rule() -> None:
    """The other sealed name, asserted the same way as the first.

    `BaseHttpServiceSettings` is the class that owns this one, so the
    redefinition that must be refused is one below it.
    """
    with pytest.raises(TypeError, match=SEAL_VALIDATOR):
        type(
            "UnsealedHttp",
            (BaseHttpServiceSettings,),
            {SEAL_VALIDATOR: _identity_validator},
        )


def test_the_class_that_introduces_a_sealed_validator_is_not_refused() -> None:
    """Sealing starts from the class that OWNS the name, not from the list.

    `BaseHttpServiceSettings` writes `_seal_password_is_a_fernet_key` for the
    first time. A guard that refused any class whose own `vars()` contains a
    sealed name made that class illegal at its own definition, so importing
    `titlepipe_service_kit` raised `TypeError` and every service depending on
    it failed at import — the package was unimportable while the guard read as
    if it were protecting something.

    Both halves are asserted: the introducing class exists and still carries
    the validator, and it is genuinely a pydantic validator rather than a plain
    method that happens to share the name.
    """
    assert SEAL_VALIDATOR in vars(BaseHttpServiceSettings)
    assert not any(SEAL_VALIDATOR in vars(base) for base in BaseHttpServiceSettings.__mro__[1:])

    with pytest.raises(ValidationError, match="Fernet key"):
        BaseHttpServiceSettings(
            environment=Environment.DEVELOPMENT,
            service_name=ServiceName.CORE_API,
            cookie_seal_password=SecretStr("too-short"),
        )


def test_the_sealed_names_are_validators_that_actually_exist() -> None:
    """A guard naming a method nobody wrote would pass every test above while
    protecting nothing."""
    assert hasattr(BaseServiceSettings, SEALED_VALIDATOR)
    assert hasattr(BaseHttpServiceSettings, SEAL_VALIDATOR)


# --- the boot failure that must not print what it was validating -----------
#
# All three of these were watched fail before they were trusted. Deleting
# `hide_input_in_errors=True` from `BaseServiceSettings.model_config` reds the
# subclass seal and the direct-construction test; replacing the
# `redacted_settings_error` call in `from_environment` with a bare `raise` reds
# the boundary test with `PrOdPw123` present in the traceback.

# A password short enough to survive pydantic's head-and-tail truncation of the
# input dict, which is what made this leak reachable rather than theoretical.
LEAKABLE_SECRET = "PrOdPw123"


class SecretBearingSettings(BaseServiceSettings):
    """Shaped like a real service: a DSN field beside an unrelated refusal.

    The leak needs two things in one model — a secret, and something else to
    fail on — because the secret's own validator is not what published it.
    """

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_SECRETEXAMPLE_")

    service_name: ServiceName = ServiceName.WORKER
    database_url: SecretStr | None = None
    risky_knob: bool = False

    def additional_unsafe_for_deployment(self) -> list[str]:
        return ["the risky knob is on"] if self.risky_knob else []


def test_a_failed_boot_names_the_field_and_never_the_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The proven leak, asserted over the string an operator actually sees.

    `format_exception` and not `str(exc)`, because the leak was on stderr as an
    uncaught traceback: a chained original would carry the input dict even when
    the replacement does not, which is why `from_environment` raises
    `from None`.
    """
    monkeypatch.setenv("TITLEPIPE_SECRETEXAMPLE_ENVIRONMENT", "production")
    monkeypatch.setenv("TITLEPIPE_SECRETEXAMPLE_RISKY_KNOB", "true")
    monkeypatch.setenv(
        "TITLEPIPE_SECRETEXAMPLE_DATABASE_URL",
        f"postgresql://u:{LEAKABLE_SECRET}@h/d",
    )

    with pytest.raises(SettingsValidationError) as caught:
        SecretBearingSettings.from_environment()

    rendered = "".join(traceback.format_exception(caught.value))
    assert LEAKABLE_SECRET not in rendered, (
        "the boot traceback published the DSN password it was validating"
    )
    # The failure still has to be actionable, or redaction has traded one
    # unusable boot for another.
    assert "the risky knob is on" in str(caught.value)
    assert caught.value.model_name == "SecretBearingSettings"


class UnhiddenProbe(BaseSettings):
    """Deliberately NOT a `BaseServiceSettings`, and deliberately unconfigured.

    `hide_input_in_errors` defaults to False in pydantic, so this class is the
    unfixed shape: it is the control that proves the leak is real, which is
    what lets the assertion beside it mean something. A test that only checked
    the fixed class would pass identically if `redacted_settings_error` were
    replaced by `str(exc)` tomorrow, because the OTHER mechanism would still be
    hiding the value.
    """

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_UNHIDDENPROBE_")

    database_url: SecretStr | None = None
    risky_knob: bool = False

    @model_validator(mode="after")
    def _always_refuses(self) -> UnhiddenProbe:
        raise ValueError("unsafe configuration for production: the risky knob is on")


def test_the_boundary_redaction_works_on_an_error_that_does_leak() -> None:
    """Mechanism 2 on its own, against a model that has no mechanism 1.

    The first assertion is the control. If pydantic ever stops appending the
    input — or if this probe stops being shaped like the real failure — this
    test fails LOUDLY rather than passing vacuously, which is the failure mode
    a redaction test is most prone to.
    """
    with pytest.raises(ValidationError) as raw:
        UnhiddenProbe(database_url=f"postgresql://u:{LEAKABLE_SECRET}@h/d")  # pyright: ignore[reportArgumentType]

    assert LEAKABLE_SECRET in str(raw.value), (
        "the control no longer leaks, so the assertion below proves nothing"
    )

    redacted = redacted_settings_error("UnhiddenProbe", raw.value)
    assert LEAKABLE_SECRET not in str(redacted)
    # `exc.errors()` carries `input` whatever `hide_input_in_errors` says, so
    # `include_input=False` is the argument doing the work here.
    assert not any(LEAKABLE_SECRET in problem for problem in redacted.problems)
    assert "the risky knob is on" in str(redacted)


def test_the_errors_list_carries_no_input_either(monkeypatch: pytest.MonkeyPatch) -> None:
    """The same property through the real boundary rather than the helper."""
    monkeypatch.setenv("TITLEPIPE_SECRETEXAMPLE_ENVIRONMENT", "production")
    monkeypatch.setenv("TITLEPIPE_SECRETEXAMPLE_RISKY_KNOB", "true")
    monkeypatch.setenv(
        "TITLEPIPE_SECRETEXAMPLE_DATABASE_URL",
        f"postgresql://u:{LEAKABLE_SECRET}@h/d",
    )

    with pytest.raises(SettingsValidationError) as caught:
        SecretBearingSettings.from_environment()

    assert not any(LEAKABLE_SECRET in problem for problem in caught.value.problems)


def test_a_direct_construction_renders_no_input_at_all() -> None:
    """`from_environment` is not the only way in.

    Every test in this repo builds settings by calling the class, and that path
    never reaches the boundary catch — `hide_input_in_errors` is the only thing
    covering it.

    THE ASSERTION IS ON `input_value=`, NOT ON THE SECRET, and the difference is
    the whole point. pydantic truncates the input dict to a head and a tail, so
    whether any particular secret is visible depends on where it happens to sit
    among the other fields: with the flag removed, this same construction still
    hides `PrOdPw123` behind the ellipsis purely by luck of field order. A test
    asserting the secret's absence would therefore pass on a broken build.
    `input_value=` is the marker pydantic emits whenever it renders input at
    all, so its absence is the property that is actually being bought, and it
    goes red the moment the flag does.
    """
    with pytest.raises(ValidationError) as caught:
        SecretBearingSettings(  # pyright: ignore[reportCallIssue]
            environment=Environment.PRODUCTION,
            risky_knob=True,
            # A raw string, not a `SecretStr`: that is what an environment
            # variable supplies, and the input dict pydantic renders is the
            # pre-validation one, so a `SecretStr` here would mask the value
            # before the mechanism under test ever ran.
            database_url=f"postgresql://u:{LEAKABLE_SECRET}@h/d",  # pyright: ignore[reportArgumentType]
        )

    rendered = str(caught.value)
    assert "input_value=" not in rendered, (
        "pydantic is rendering the pre-validation input; a secret in the "
        "visible half of the truncation window would be published"
    )
    assert LEAKABLE_SECRET not in rendered
    assert "the risky knob is on" in rendered


def test_the_unconfigured_control_really_does_render_its_input() -> None:
    """Anchors the assertion above: without the flag, `input_value=` appears.

    `UnhiddenProbe` carries pydantic's default configuration, so this is what
    every settings class in this repo looked like before the flag was added.
    """
    with pytest.raises(ValidationError) as caught:
        UnhiddenProbe(database_url=f"postgresql://u:{LEAKABLE_SECRET}@h/d")  # pyright: ignore[reportArgumentType]

    assert "input_value=" in str(caught.value)


def test_a_subclass_cannot_unhide_the_raw_input() -> None:
    """The one word that restores the leak, refused at class definition.

    Every service subclass declares its own `model_config` for its
    `env_prefix`, and pydantic merges that dict over the parent's — so a single
    `hide_input_in_errors=False` in it, or a future pydantic whose default
    changes under a config that never mentions the key, is all it takes.
    """
    with pytest.raises(TypeError, match=HIDE_INPUT_IN_ERRORS):
        # `type()` for the same reason as the validator-seal tests above: a
        # `class` statement at module level would raise at COLLECTION time and
        # take the whole file down instead of failing this one test.
        type(
            "Unhidden",
            (BaseServiceSettings,),
            {
                "model_config": SettingsConfigDict(
                    env_prefix="TITLEPIPE_UNHIDDEN_", hide_input_in_errors=False
                ),
                "__annotations__": {"service_name": ServiceName},
                "service_name": ServiceName.WORKER,
            },
        )


def test_the_shipped_settings_classes_all_hide_the_input() -> None:
    """The seal above only fires on a subclass. These are the classes."""
    for klass in (BaseServiceSettings, BaseHttpServiceSettings, ExampleSettings):
        assert klass.model_config.get(HIDE_INPUT_IN_ERRORS) is True, klass.__name__

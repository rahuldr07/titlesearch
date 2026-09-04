"""The shared settings model, and the seal on its one safety rule.

The rule under test is small and its failure is silent: a deployed process that
starts with `debug` on, or with redaction off, looks exactly like a healthy one
until someone reads the logs. Four services used to carry their own copy of it.
Now one carries it and the others extend it, so what is asserted here is that
extending cannot become replacing.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError
from pydantic_settings import SettingsConfigDict
from titlepipe_service_kit.settings import SEALED_VALIDATOR, BaseServiceSettings

from titlepipe_domain import Environment, LogRenderer, ServiceName


class ExampleSettings(BaseServiceSettings):
    """A subclass shaped like a real one: its own prefix, its own service name."""

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_EXAMPLE_")

    service_name: ServiceName = ServiceName.WORKER
    risky_knob: bool = False

    def additional_unsafe_for_deployment(self) -> list[str]:
        return ["the risky knob is on"] if self.risky_knob else []


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
    with pytest.raises(ValidationError):
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
            {SEALED_VALIDATOR: lambda self: self},
        )


def test_the_sealed_name_is_the_validator_that_actually_exists() -> None:
    """A guard naming a method nobody wrote would pass every test above while
    protecting nothing."""
    assert hasattr(BaseServiceSettings, SEALED_VALIDATOR)

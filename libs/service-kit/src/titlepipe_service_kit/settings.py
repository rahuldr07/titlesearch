"""The settings every deployable shares, and the refusal none of them may drop.

Four services were carrying the same seven fields, the same
`effective_log_renderer`, the same twenty-line `from_environment` docstring and
the same `pyright: ignore`, and — the part that matters — their own private copy
of the rule that a deployed environment refuses `debug` and refuses disabled
redaction. Four copies of a safety rule is four places it can quietly stop being
true.

## The refusal is sealed, not inherited politely

A subclass extends the deployed-environment refusal through
`additional_unsafe_for_deployment`, which is additive by construction: the
validator computes the base reasons itself and concatenates, so a subclass that
returns `[]` — or returns nothing at all — removes nothing.

The obvious way around that is to redefine the validator itself in the subclass,
where pydantic would let the child's method replace the parent's. That is the
one edit that would silently unseal the rule, so `__init_subclass__` refuses it
at class-definition time: importing such a subclass raises. **That is the
machine.** It is not a comment asking people not to, and it is asserted by
`tests/test_settings_base.py::test_a_subclass_cannot_replace_the_deployed_refusal`.

What is NOT sealed, and is not claimed to be: a subclass can still declare a
field this base has never heard of and forget to check it. Nothing here can know
about a knob it was never told about. Each service's own settings test is what
covers its own knobs.
"""

from __future__ import annotations

from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName

# The name `__init_subclass__` refuses to see redefined below it. Written once,
# here, so the guard and the thing it guards cannot drift apart by a typo.
SEALED_VALIDATOR = "_deployed_environments_refuse_unsafe_configuration"


class BaseServiceSettings(BaseSettings):
    """Configuration common to every deployable. Instantiating it validates it.

    Subclasses supply their own `env_prefix` and their own `service_name`
    default. Everything below is identical in all of them, which is why it is
    here rather than in each of them.
    """

    model_config = SettingsConfigDict(
        # No implicit `.env`: the platform supplies the environment, and a file
        # picked up from the working directory would make a container's
        # configuration depend on where it was started.
        env_file=None,
        extra="forbid",
        frozen=True,
    )

    # No default. A forgotten variable must not silently mean "development":
    # a deployed process that failed open would publish API docs, placeholder
    # secrets and detailed exception bodies. Requiring it turns that into a
    # startup error, which is the cheap failure.
    environment: Environment

    # No default either, and for a different reason: there is no service name
    # that is right for more than one deployable, so a default here would be
    # wrong everywhere it was used. Each subclass declares its own.
    service_name: ServiceName

    debug: bool = False

    # --- observability ----------------------------------------------------
    log_level: str = "INFO"
    log_renderer: LogRenderer | None = None
    redaction_enabled: bool = True

    @property
    def effective_log_renderer(self) -> LogRenderer:
        if self.log_renderer is not None:
            return self.log_renderer
        return LogRenderer.JSON if self.environment.is_deployed else LogRenderer.CONSOLE

    @classmethod
    def from_environment(cls) -> Self:
        """Build from the process environment.

        `environment` has no default, so a type checker sees a required
        argument missing here. pydantic-settings fills it from the environment
        at runtime, and if it is absent that is exactly the startup failure the
        missing default exists to cause.

        There is no `model_config`-aware spelling that avoids the suppression.
        pyright models this class through pydantic's `dataclass_transform` and
        synthesises `__init__` from the *fields*; it never sees the real
        `BaseSettings.__init__`, whose signature ends in `**values: Any` and
        whose leading parameters are the `_env_file` / `_case_sensitive` knobs.
        Passing one of those does not satisfy it — pyright answers
        `No parameter named "_env_file"` on top of the missing-argument report.
        `model_validate({})` type-checks but is not the same call: the settings
        sources run from `__init__`, so it would read no environment at all.
        """
        return cls()  # pyright: ignore[reportCallIssue]  # rules-allow(any-type): pyright synthesises `__init__` from the fields, so the deliberately default-less `environment` reads as a missing argument; pydantic-settings supplies it from the environment at runtime

    def additional_unsafe_for_deployment(self) -> list[str]:
        """Reasons this service must not start deployed, ON TOP of the base ones.

        Additive by construction — the validator concatenates this onto the
        base reasons rather than asking for the whole list — so an override
        that returns `[]` weakens nothing. Each string is a human clause; they
        are joined with "; " into one error naming every problem at once,
        because an operator fixing configuration one refusal per deploy is how
        a five-minute fix becomes an afternoon.
        """
        return []

    @model_validator(mode="after")
    def _deployed_environments_refuse_unsafe_configuration(self) -> Self:
        if not self.environment.is_deployed:
            return self

        unsafe: list[str] = []
        if self.debug:
            unsafe.append("debug is enabled")
        if not self.redaction_enabled:
            unsafe.append("log redaction is disabled")
        unsafe.extend(self.additional_unsafe_for_deployment())

        if unsafe:
            raise ValueError(
                f"unsafe configuration for {self.environment.value}: " + "; ".join(unsafe)
            )
        return self

    def __init_subclass__(cls, **kwargs: object) -> None:
        """Refuse a subclass that redefines the sealed validator.

        pydantic resolves a same-named validator in the child in place of the
        parent's, so this one edit would replace the base refusal instead of
        extending it — and nothing else in the process would notice. Raising
        here makes the attempt an import-time error in whatever imports that
        subclass, including the test that collects it.
        """
        super().__init_subclass__(**kwargs)
        if SEALED_VALIDATOR in vars(cls):
            raise TypeError(
                f"{cls.__name__} redefines {SEALED_VALIDATOR!r}, which would replace the "
                "deployed-environment refusal rather than extend it. Override "
                "`additional_unsafe_for_deployment` instead; it is concatenated onto the "
                "base reasons and cannot remove them."
            )

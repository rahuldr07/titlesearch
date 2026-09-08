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

A second seal, on `__pydantic_init_subclass__`, holds `hide_input_in_errors`
True — the one word that stops a failed validation from printing the raw
environment dict, DSN password included. See `settings_errors.py`; asserted by
`tests/test_settings_base.py::test_a_subclass_cannot_unhide_the_raw_input`.

What is NOT sealed, and is not claimed to be: a subclass can still declare a
field this base has never heard of and forget to check it. Nothing here can know
about a knob it was never told about. Each service's own settings test is what
covers its own knobs.
"""

from __future__ import annotations

import base64
import binascii
from typing import Final, Self, Unpack

from pydantic import ConfigDict, Field, SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName
from titlepipe_service_kit.settings_errors import (
    HIDE_INPUT_IN_ERRORS,
    redacted_settings_error,
)

# The names `__init_subclass__` refuses to see redefined below them. Written
# once, here, so the guard and the things it guards cannot drift apart by a typo.
SEALED_VALIDATOR = "_deployed_environments_refuse_unsafe_configuration"
SEAL_VALIDATOR = "_seal_password_is_a_fernet_key"
SEALED_VALIDATORS: Final[frozenset[str]] = frozenset({SEALED_VALIDATOR, SEAL_VALIDATOR})

# The hook each class contributes its OWN refusals through. The validator finds
# every definition of it along the MRO rather than calling the most-derived one,
# so a subclass cannot drop an ancestor's reasons by forgetting `super()`.
REFUSAL_HOOK = "additional_unsafe_for_deployment"

# A cookie-seal password is a FERNET KEY: 32 random bytes, urlsafe-base64
# encoded, which is 44 characters including the single '=' pad.
#
# THE BYTE COUNT IS NOT THE ENCODED LENGTH, and getting that wrong is the bug
# this constant pair exists to make un-repeatable. A check of `len(secret) == 32`
# rejects every real WorkOS credential and accepts nothing that works; core-api
# carried it, found it, and fixed it, and blind-svc still carried the broken
# version at the time this moved here — which is the argument for one copy in
# one place rather than two that agree until one of them is corrected.
#
# The length is checked against the DECODED byte count rather than trusting 44,
# because 44 characters of the wrong alphabet is not a key. `base64` is stdlib,
# so this stays honest without pulling `cryptography` in at Gate 1 — the
# constructive `Fernet(secret)` check belongs at the gate that adds WorkOS.
SEAL_KEY_BYTES: Final = 32
SEAL_PASSWORD_LENGTH: Final = 44

# A STRUCTURALLY VALID Fernet key that decodes to the readable sentence
# "development-only-seal-password!!" — obviously a placeholder to a human, and it
# passes the same validator a real key does. It is listed in PLACEHOLDER_SECRETS
# below, so a deployed environment still refuses to start with it.
DEVELOPMENT_SEAL_PASSWORD: Final = "ZGV2ZWxvcG1lbnQtb25seS1zZWFsLXBhc3N3b3JkISE="  # noqa: S105

# Values that exist to make a fresh checkout run. Any of them in a deployed
# environment means a real secret was never supplied.
PLACEHOLDER_SECRETS: Final = frozenset(
    {
        "",
        "change-me",
        "changeme",
        "secret",
        "placeholder",
        DEVELOPMENT_SEAL_PASSWORD,
    }
)


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
        # See `settings_errors.py`. Without it a failed validation prints the
        # raw pre-validation environment dict, secrets included.
        hide_input_in_errors=True,
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

        ## Why the failure is caught and re-raised

        This is the boot boundary: the caller is a service factory or a CLI,
        and whatever comes out of here reaches stderr as a traceback before any
        logging — and therefore any redaction — has been configured. A
        `ValidationError` renders the raw input dict it was given, so it is
        rebuilt here as field names and reasons with `redacted_settings_error`.

        `from None`, not `from exc`: chaining would print the original beneath
        the replacement under "The above exception was the direct cause", which
        is the whole leak again one line lower down.
        """
        try:
            return cls()  # pyright: ignore[reportCallIssue]  # rules-allow(any-type): pyright synthesises `__init__` from the fields, so the deliberately default-less `environment` reads as a missing argument; pydantic-settings supplies it from the environment at runtime
        except ValidationError as exc:
            raise redacted_settings_error(cls.__name__, exc) from None

    def additional_unsafe_for_deployment(self) -> list[str]:
        """Reasons THIS class adds. Never the inherited ones, and never `super()`.

        Additive by construction, and the construction is stronger than a
        convention: `_collect_deployment_refusals` walks the MRO and calls every
        definition of this method it finds, so a subclass that returns `[]` — or
        that overrides without chaining — removes nothing. **Do not call
        `super().additional_unsafe_for_deployment()` from an override**; the walk
        has already collected it, and chaining would report the ancestor's
        clauses twice.

        That matters now that the hierarchy is three deep: a service settings
        class sits under `BaseHttpServiceSettings`, which sits under this. The
        version that concatenated one call onto the base list held only while
        there was exactly one level between them.

        Each string is a human clause; they are joined with "; " into one error
        naming every problem at once, because an operator fixing configuration
        one refusal per deploy is how a five-minute fix becomes an afternoon.
        """
        return []

    def _collect_deployment_refusals(self) -> list[str]:
        """Every class's own reasons, base-first, along the MRO."""
        reasons: list[str] = []
        for klass in reversed(type(self).__mro__):
            hook = vars(klass).get(REFUSAL_HOOK)
            if hook is None:
                continue
            reasons.extend(hook(self))
        return reasons

    @model_validator(mode="after")
    def _deployed_environments_refuse_unsafe_configuration(self) -> Self:
        if not self.environment.is_deployed:
            return self

        unsafe: list[str] = []
        if self.debug:
            unsafe.append("debug is enabled")
        if not self.redaction_enabled:
            unsafe.append("log redaction is disabled")
        unsafe.extend(self._collect_deployment_refusals())

        if unsafe:
            raise ValueError(
                f"unsafe configuration for {self.environment.value}: " + "; ".join(unsafe)
            )
        return self

    def __init_subclass__(cls, **kwargs: Unpack[ConfigDict]) -> None:
        """Refuse a subclass that REDEFINES a sealed validator.

        pydantic resolves a same-named validator in the child in place of the
        parent's, so this one edit would replace the base refusal instead of
        extending it — and nothing else in the process would notice. Raising
        here makes the attempt an import-time error in whatever imports that
        subclass, including the test that collects it.

        "Redefines" means an ancestor already defines the name. The class that
        INTRODUCES one does not, and must not be refused: `SEALED_VALIDATORS`
        names `_seal_password_is_a_fernet_key`, which is first written on
        `BaseHttpServiceSettings` — a membership test against `vars(cls)` alone
        made that class illegal at its own definition, so importing
        `titlepipe_service_kit` at all raised `TypeError` and every service
        that depends on it failed at import. Sealing a name has to start from
        the class that owns it, not from the guard's list.
        """
        super().__init_subclass__(**kwargs)
        ancestors = cls.__mro__[1:]
        redefined = sorted(
            name
            for name in SEALED_VALIDATORS & vars(cls).keys()
            if any(name in vars(ancestor) for ancestor in ancestors)
        )
        if redefined:
            raise TypeError(
                f"{cls.__name__} redefines {', '.join(repr(name) for name in redefined)}, "
                "which pydantic would resolve in place of the base validator rather than "
                f"alongside it. Override {REFUSAL_HOOK!r} instead; every definition of it "
                "along the MRO is collected, so it cannot remove an inherited refusal."
            )

    @classmethod
    def __pydantic_init_subclass__(cls, **kwargs: object) -> None:
        """Refuse a subclass that turns input-hiding back off.

        A subclass declares its own `model_config` — every service does, for the
        `env_prefix` — and pydantic MERGES it over the parent's. One
        `hide_input_in_errors=False` in that dict, or one copy-pasted
        `SettingsConfigDict` that simply forgets the key while a future pydantic
        default flips, restores the leak silently and in one word.

        This runs on `__pydantic_init_subclass__` rather than
        `__init_subclass__` beside the validator seal, and the difference is
        load-bearing: `model_config` is not merged yet when `__init_subclass__`
        fires, so the check there would read the parent's value and pass on a
        subclass that had just overridden it. Here the model is fully built and
        `cls.model_config` is the effective configuration.
        """
        super().__pydantic_init_subclass__(**kwargs)
        if cls.model_config.get(HIDE_INPUT_IN_ERRORS) is not True:
            raise TypeError(
                f"{cls.__name__} sets {HIDE_INPUT_IN_ERRORS}="
                f"{cls.model_config.get(HIDE_INPUT_IN_ERRORS)!r}. It must stay True: "
                "pydantic appends the raw pre-validation input to a ValidationError, "
                "and a settings failure is the one place that input is the whole "
                "environment — DSNs, API keys and seal passwords included."
            )


class BaseHttpServiceSettings(BaseServiceSettings):
    """What a deployable that BINDS A PORT adds, and refuses, on top of the above.

    Core and Blind carried these eleven fields, the `openapi_url` property, the
    seal-password validator and ten of the same refusal clauses as two separate
    copies. They are here because a service that listens has a Host allowlist, a
    CORS decision, a docs switch and a session seal whatever it serves — none of
    which is true of a worker, which is why this is a second class rather than
    more fields on the first.

    Both have arrived: `BlindApiSettings` and `CoreApiSettings` inherit this,
    each keeping only the refusals no other deployable has, so the seal now
    covers every service that binds a port. FX-25 is closed.

    Nothing here imports a web framework and nothing here may. These are
    *values*: a port number, an origin list, a boolean. The server that reads
    them lives in the service.
    """

    host: str = "127.0.0.1"

    # Overridden per service. The bound is the shared part; which port is not.
    port: int = Field(default=8000, ge=1, le=65535)

    reload: bool = False
    docs_enabled: bool = True

    cors_allowed_origins: tuple[str, ...] = ()
    # An empty allowlist is correct when the browser app is served from this
    # same origin: no cross-origin request is ever made, so CORS headers are
    # unnecessary and the safest configuration is none at all. But an empty
    # allowlist is *also* what an operator who simply forgot looks like, and
    # those must not be indistinguishable — so the safe case is opted into
    # explicitly and the forgetful case still fails startup.
    same_origin_deployment: bool = False

    # Host header allowlist. Empty is permitted only outside deployed
    # environments; a deployed service that accepts any Host is open to cache
    # poisoning and forged absolute links.
    allowed_hosts: tuple[str, ...] = ()

    cookie_seal_password: SecretStr = SecretStr(DEVELOPMENT_SEAL_PASSWORD)
    mock_auth_enabled: bool = False

    @property
    def openapi_url(self) -> str | None:
        """`None` disables the schema route entirely."""
        return "/openapi.json" if self.docs_enabled else None

    @model_validator(mode="after")
    def _seal_password_is_a_fernet_key(self) -> Self:
        """A Fernet key, checked by DECODING it. See `SEAL_KEY_BYTES` for why.

        Sealed against redefinition for the same reason as the deployment
        refusal: this rule was already wrong in one of the two services that had
        their own copy, and the copy is what let it be wrong in only one.
        """
        secret = self.cookie_seal_password.get_secret_value()
        if len(secret) != SEAL_PASSWORD_LENGTH:
            raise ValueError(
                f"cookie_seal_password must be a {SEAL_PASSWORD_LENGTH}-character "
                f"Fernet key (urlsafe-base64 of {SEAL_KEY_BYTES} bytes); "
                f"got {len(secret)} characters"
            )
        try:
            decoded = base64.urlsafe_b64decode(secret)
        except (binascii.Error, ValueError) as exc:
            raise ValueError(
                "cookie_seal_password is not valid urlsafe-base64; it must be a "
                "Fernet key, e.g. Fernet.generate_key().decode()"
            ) from exc
        if len(decoded) != SEAL_KEY_BYTES:
            raise ValueError(
                f"cookie_seal_password must decode to exactly {SEAL_KEY_BYTES} "
                f"bytes; got {len(decoded)}"
            )
        return self

    def additional_unsafe_for_deployment(self) -> list[str]:
        """The refusals that belong to listening on a port.

        This class's own reasons only — the base walks the MRO for the rest, so
        this neither calls `super()` nor repeats `debug`/`redaction_enabled`.
        """
        unsafe: list[str] = []
        if self.reload:
            unsafe.append("reload is enabled")
        if self.mock_auth_enabled:
            unsafe.append("mock auth is enabled")
        if self.docs_enabled:
            unsafe.append("public API docs are enabled")
        if "*" in self.cors_allowed_origins:
            unsafe.append("CORS allows any origin")
        if not self.cors_allowed_origins and not self.same_origin_deployment:
            unsafe.append(
                "CORS allowlist is empty; set same_origin_deployment=true if the app "
                "is served from this origin and cross-origin access is not wanted"
            )
        if self.cors_allowed_origins and self.same_origin_deployment:
            unsafe.append(
                "same_origin_deployment is set but a CORS allowlist is configured; "
                "the two contradict each other"
            )
        if self.cookie_seal_password.get_secret_value() in PLACEHOLDER_SECRETS:
            unsafe.append("cookie_seal_password is a placeholder")
        if self.host == "127.0.0.1":
            unsafe.append("host is loopback-only and unreachable behind a proxy")
        if not self.allowed_hosts:
            unsafe.append("allowed_hosts is empty; the service would accept any Host header")
        if "*" in self.allowed_hosts:
            unsafe.append("allowed_hosts contains a wildcard")
        return unsafe

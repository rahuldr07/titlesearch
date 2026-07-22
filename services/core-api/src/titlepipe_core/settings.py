"""Typed configuration for the Core API, validated at startup.

Two rules shape this module.

**One code path across environments.** Development and production differ in
*configuration and rendering*, never in business behaviour. There is no second
settings implementation and no `if development:` branch around a domain rule.

**Deployed environments fail closed.** Staging and production refuse to start
on an unsafe knob rather than starting and hoping. A service that will not boot
is an incident during deploy; a service that boots with wildcard CORS and public
docs is an incident during an audit.

Settings objects are never logged. `SecretStr` keeps a secret out of `repr`,
and nothing here dumps the model.
"""

from __future__ import annotations

from typing import Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName

# A cookie-seal password must be exactly 32 characters (WorkOS sealed sessions).
# Enforced here so the failure lands at startup rather than at first login.
SEAL_PASSWORD_LENGTH = 32

# Values that exist to make a fresh checkout run. Any of them in a deployed
# environment means a real secret was never supplied.
# Exactly 32 characters. Listed in PLACEHOLDER_SECRETS below, so a deployed
# environment refuses to start with it — which is the point of naming it.
DEVELOPMENT_SEAL_PASSWORD = "development-only-seal-password!!"  # noqa: S105

PLACEHOLDER_SECRETS = frozenset(
    {
        "",
        "change-me",
        "changeme",
        "secret",
        "placeholder",
        DEVELOPMENT_SEAL_PASSWORD,
    }
)


class CoreApiSettings(BaseSettings):
    """Core API configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(
        env_prefix="TITLEPIPE_",
        env_file=None,  # the platform supplies the environment; no implicit .env
        extra="forbid",
        frozen=True,
    )

    environment: Environment = Environment.DEVELOPMENT
    service_name: ServiceName = ServiceName.CORE_API

    # --- HTTP surface -----------------------------------------------------
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    debug: bool = False
    reload: bool = False
    docs_enabled: bool = True
    cors_allowed_origins: tuple[str, ...] = ()

    # --- session ----------------------------------------------------------
    cookie_seal_password: SecretStr = SecretStr(DEVELOPMENT_SEAL_PASSWORD)
    mock_auth_enabled: bool = False

    # --- observability ----------------------------------------------------
    log_level: str = "INFO"
    log_renderer: LogRenderer | None = None
    redaction_enabled: bool = True

    @property
    def effective_log_renderer(self) -> LogRenderer:
        """Console locally for a human, JSON once a log shipper is reading.

        Only the rendering changes. Event names and fields are identical, so an
        incident in staging is greppable by what a developer saw locally.
        """
        if self.log_renderer is not None:
            return self.log_renderer
        return LogRenderer.JSON if self.environment.is_deployed else LogRenderer.CONSOLE

    @property
    def openapi_url(self) -> str | None:
        """`None` disables the schema route entirely."""
        return "/openapi.json" if self.docs_enabled else None

    @model_validator(mode="after")
    def _seal_password_is_the_right_length(self) -> Self:
        secret = self.cookie_seal_password.get_secret_value()
        if len(secret) != SEAL_PASSWORD_LENGTH:
            raise ValueError(
                f"cookie_seal_password must be exactly {SEAL_PASSWORD_LENGTH} characters; "
                f"got {len(secret)}"
            )
        return self

    @model_validator(mode="after")
    def _deployed_environments_refuse_unsafe_configuration(self) -> Self:
        if not self.environment.is_deployed:
            return self

        unsafe: list[str] = []
        if self.debug:
            unsafe.append("debug is enabled")
        if self.reload:
            unsafe.append("reload is enabled")
        if self.mock_auth_enabled:
            unsafe.append("mock auth is enabled")
        if self.docs_enabled:
            unsafe.append("public API docs are enabled")
        if not self.redaction_enabled:
            unsafe.append("log redaction is disabled")
        if "*" in self.cors_allowed_origins:
            unsafe.append("CORS allows any origin")
        if not self.cors_allowed_origins:
            unsafe.append("CORS allowlist is empty")
        if self.cookie_seal_password.get_secret_value() in PLACEHOLDER_SECRETS:
            unsafe.append("cookie_seal_password is a placeholder")
        if self.host == "127.0.0.1":
            unsafe.append("host is loopback-only and unreachable behind a proxy")

        if unsafe:
            raise ValueError(
                f"unsafe configuration for {self.environment.value}: " + "; ".join(unsafe)
            )
        return self

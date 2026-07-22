"""Typed configuration for the Blind API, validated at startup.

Same shape and the same refusals as the Core API, plus the ones that exist only
here. Blindness is structural — separate deployment, separate database,
separate object-store credentials — and configuration is where that structure
is declared, so configuration is where it can be silently undone.

The two extra refusals are deliberate:

- **No Core database.** If a Core connection string is supplied to this service
  at all, something has been wired wrong; the process refuses to start rather
  than holding a credential it must never have.
- **No shared object store.** The blind storage credential must point at the
  blind-input location, not at the extraction or reports areas.
"""

from __future__ import annotations

from typing import Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName

SEAL_PASSWORD_LENGTH = 32

# Exactly 32 characters, and listed as a placeholder so a deployed environment
# refuses to start with it.
DEVELOPMENT_SEAL_PASSWORD = "development-only-seal-password!!"  # noqa: S105

PLACEHOLDER_SECRETS = frozenset(
    {"", "change-me", "changeme", "secret", "placeholder", DEVELOPMENT_SEAL_PASSWORD}
)

# Storage prefixes this service is permitted to be pointed at. `blind-input/` is
# the only one that exists for it; the rest belong to Core and the workers.
ALLOWED_STORAGE_PREFIX = "blind-input"
FORBIDDEN_STORAGE_PREFIXES = ("quarantine", "validated", "pages", "reports", "temporary")


class BlindApiSettings(BaseSettings):
    """Blind API configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(
        env_prefix="TITLEPIPE_BLIND_",
        env_file=None,
        extra="forbid",
        frozen=True,
    )

    environment: Environment = Environment.DEVELOPMENT
    service_name: ServiceName = ServiceName.BLIND_API

    host: str = "127.0.0.1"
    port: int = Field(default=8100, ge=1, le=65535)
    debug: bool = False
    reload: bool = False
    docs_enabled: bool = True
    cors_allowed_origins: tuple[str, ...] = ()

    cookie_seal_password: SecretStr = SecretStr(DEVELOPMENT_SEAL_PASSWORD)
    mock_auth_enabled: bool = False

    # Isolation. Both must stay empty/blind-scoped; see the validators below.
    core_database_url: SecretStr | None = None
    blind_storage_prefix: str = ALLOWED_STORAGE_PREFIX

    log_level: str = "INFO"
    log_renderer: LogRenderer | None = None
    redaction_enabled: bool = True

    @property
    def effective_log_renderer(self) -> LogRenderer:
        if self.log_renderer is not None:
            return self.log_renderer
        return LogRenderer.JSON if self.environment.is_deployed else LogRenderer.CONSOLE

    @property
    def openapi_url(self) -> str | None:
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
    def _the_blind_boundary_holds_in_every_environment(self) -> Self:
        """Unlike the other checks, this one applies in development too.

        A developer who can reach the Core database from the blind service will
        write code that assumes it, and the isolation is then already lost by
        the time staging refuses.
        """
        violations: list[str] = []
        if self.core_database_url is not None:
            violations.append(
                "core_database_url is set; the blind service must never hold a "
                "Core database credential"
            )
        prefix = self.blind_storage_prefix.strip().strip("/").lower()
        if prefix != ALLOWED_STORAGE_PREFIX:
            violations.append(
                f"blind_storage_prefix must be {ALLOWED_STORAGE_PREFIX!r}; got {prefix!r}"
            )
        if violations:
            raise ValueError("blind isolation violated: " + "; ".join(violations))
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

"""Typed configuration for the render worker.

The render worker's distinctive risk is not spend, it is the converter. DOCX to
PDF runs in an isolated Gotenberg container that must be internal, pinned by
digest and denied general outbound network access — "no public document
converter" is a rejected item in the plan, not a preference.

Configuration is where that isolation is declared, so configuration is where it
can be undone. A deployed environment refuses a converter URL that is not
plainly internal.
"""

from __future__ import annotations

from typing import Self
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName

# Hostnames that are unambiguously inside the deployment. A converter reachable
# at a public name is a public document converter, whatever the intent was.
INTERNAL_HOST_SUFFIXES = (".internal", ".local", ".svc", ".cluster.local")
INTERNAL_HOST_NAMES = ("gotenberg", "localhost", "127.0.0.1")


class RenderSettings(BaseSettings):
    """Render worker configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(
        env_prefix="TITLEPIPE_RENDER_",
        env_file=None,
        extra="forbid",
        frozen=True,
    )

    environment: Environment = Environment.DEVELOPMENT
    service_name: ServiceName = ServiceName.RENDER_WORKER

    debug: bool = False

    max_concurrent_jobs: int = Field(default=2, ge=1, le=32)

    # --- document conversion ---------------------------------------------
    gotenberg_url: str = "http://gotenberg:3000"
    gotenberg_timeout_seconds: float = Field(default=120.0, gt=0, le=900)

    # --- observability ----------------------------------------------------
    log_level: str = "INFO"
    log_renderer: LogRenderer | None = None
    redaction_enabled: bool = True

    @property
    def effective_log_renderer(self) -> LogRenderer:
        if self.log_renderer is not None:
            return self.log_renderer
        return LogRenderer.JSON if self.environment.is_deployed else LogRenderer.CONSOLE

    @model_validator(mode="after")
    def _the_converter_stays_internal(self) -> Self:
        """Refuse a converter that is not plainly inside the deployment.

        Checked in every environment. A developer pointed at a hosted converter
        is sending client documents to a third party, which is the exposure
        this rule exists to prevent — and it is not less of one because it
        happened on a laptop.
        """
        host = (urlsplit(self.gotenberg_url).hostname or "").lower()
        if not host:
            raise ValueError(f"gotenberg_url has no host: {self.gotenberg_url!r}")
        internal = host in INTERNAL_HOST_NAMES or host.endswith(INTERNAL_HOST_SUFFIXES)
        if not internal:
            raise ValueError(
                f"gotenberg_url host {host!r} is not an internal address; the DOCX "
                "converter must not be publicly reachable and must not receive "
                "client documents over the internet"
            )
        return self

    @model_validator(mode="after")
    def _deployed_environments_refuse_unsafe_configuration(self) -> Self:
        if not self.environment.is_deployed:
            return self

        unsafe: list[str] = []
        if self.debug:
            unsafe.append("debug is enabled")
        if not self.redaction_enabled:
            unsafe.append("log redaction is disabled")

        if unsafe:
            raise ValueError(
                f"unsafe configuration for {self.environment.value}: " + "; ".join(unsafe)
            )
        return self

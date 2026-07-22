"""Typed configuration for the extraction worker.

A worker has a smaller unsafe surface than an API — no CORS, no public docs, no
browser session — and a larger one the API does not have: it is the process
that spends money. The provider concurrency and spend ceilings live here, in
typed configuration, so a runaway retry loop on a 181-page package is bounded
by a value someone approved rather than by whoever notices the bill.

None of the provider SDKs are dependencies yet. The settings exist now because
the ceiling must be a startup-validated value before the first paid call, not
a constant discovered later.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName


class ExtractionSettings(BaseSettings):
    """Extraction worker configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(
        env_prefix="TITLEPIPE_EXTRACTION_",
        env_file=None,
        extra="forbid",
        frozen=True,
    )

    environment: Environment = Environment.DEVELOPMENT
    service_name: ServiceName = ServiceName.EXTRACTION_WORKER

    debug: bool = False

    # --- workload bounds --------------------------------------------------
    max_concurrent_jobs: int = Field(default=4, ge=1, le=64)
    max_concurrent_provider_calls: int = Field(default=8, ge=1, le=128)

    # --- spend bounds -----------------------------------------------------
    # "Accuracy first, cost second" is the owner mandate; these are a runaway
    # guard, not an optimisation target.
    daily_spend_ceiling_usd: Decimal = Field(default=Decimal("25.00"), gt=0)
    per_order_spend_ceiling_usd: Decimal = Field(default=Decimal("2.50"), gt=0)

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
    def _per_order_ceiling_fits_inside_the_daily_one(self) -> Self:
        """A per-order ceiling above the daily ceiling is not a bound at all."""
        if self.per_order_spend_ceiling_usd > self.daily_spend_ceiling_usd:
            raise ValueError(
                "per_order_spend_ceiling_usd "
                f"({self.per_order_spend_ceiling_usd}) exceeds daily_spend_ceiling_usd "
                f"({self.daily_spend_ceiling_usd}); the per-order limit would never bind"
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

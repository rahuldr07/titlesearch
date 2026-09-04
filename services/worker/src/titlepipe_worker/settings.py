"""Typed configuration for the worker, merged from the two shells it replaces.

A worker has a smaller unsafe surface than an API — no CORS, no public docs, no
browser session — and two the APIs do not have. It is the process that spends
money, and it is the process that hands client documents to a converter. Both
of those are declared here, in typed configuration validated at startup, which
is also where either could be quietly undone.

Everything that was common to all four deployables — `environment`,
`service_name`, `debug`, the three observability fields,
`effective_log_renderer`, `from_environment` and the sealed
deployed-refuses-unsafe validator — comes from
`titlepipe_service_kit.BaseServiceSettings`. What is below is only what a
worker has and a server does not.

## Both halves' fields survive, because they differ for real reasons

`extraction-svc` carried `max_concurrent_provider_calls`, the two spend
ceilings and the per-order-fits-inside-daily validator. `render-svc` carried
`gotenberg_url`, `gotenberg_timeout_seconds` and the converter-stays-internal
validator. Neither set is redundant with the other and neither is dropped: a
merge that quietly loses a bound is how a bound stops binding.

## THE CONCURRENCY RULING

The two shells disagreed on the same field. Extraction declared
`max_concurrent_jobs: default=4, ge=1, le=64`; render declared `default=2,
ge=1, le=32`. One process now runs both kinds of work off one pool, so one of
those had to win.

**Render's bound wins: `default=2, le=32`.** Reasons, in the order they matter:

1. A merged bound must be the STRICTER of the two it replaces. Taking 4/64
   would let four concurrent DOCX conversions run where the render shell said
   two, and would let an operator set 64 where it said 32 — a limit raised not
   by a decision but as a side effect of a refactor. Raising a ceiling is a
   thing someone should do on purpose.
2. The heavier work sets the bound. A render job holds a slot in the Gotenberg
   container for the whole conversion; an extraction job is mostly waiting on a
   provider. A value safe for the heavier kind is safe for the lighter; the
   reverse is not true, and this pool cannot tell in advance which kind it will
   be handed.
3. Extraction throughput is not actually halved by this, because it was never
   governed by this field. `max_concurrent_provider_calls` (default 8, le 128)
   is the process-wide bound on the paid, I/O-bound calls, and it is unchanged.
   `max_concurrent_jobs` bounds orders in flight, not calls in flight.

The cost is stated rather than hidden: an extraction-only queue drains with two
orders in flight instead of four until someone raises it deliberately. The
machine that keeps the ruling honest is
`tests/test_settings.py::test_the_concurrency_bound_is_the_stricter_of_the_two_it_replaced`,
which asserts the numbers rather than trusting this docstring.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Self
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import SettingsConfigDict

from titlepipe_domain import ServiceName
from titlepipe_service_kit import BaseServiceSettings

# Hostnames that are unambiguously inside the deployment. A converter reachable
# at a public name is a public document converter, whatever the intent was.
INTERNAL_HOST_SUFFIXES = (".internal", ".local", ".svc", ".cluster.local")
INTERNAL_HOST_NAMES = ("gotenberg", "localhost", "127.0.0.1")

# Named, because `cli.py` needs it too: when the model below fails to validate
# there is no settings object to read the environment off, and the logging that
# reports the failure still has to be configured for the right one.
ENV_PREFIX = "TITLEPIPE_WORKER_"


class WorkerSettings(BaseServiceSettings):
    """Worker configuration. Instantiating this validates it."""

    # Only the prefix. `env_file=None`, `extra="forbid"` and `frozen=True` are
    # merged in from the base, and merged rather than replaced — asserted by
    # libs/service-kit's `test_config_is_merged_rather_than_replaced`.
    model_config = SettingsConfigDict(env_prefix=ENV_PREFIX)

    service_name: ServiceName = ServiceName.WORKER

    # --- workload bounds --------------------------------------------------
    # See THE CONCURRENCY RULING in the module docstring. This is render-svc's
    # bound, deliberately, and it is the stricter of the two.
    max_concurrent_jobs: int = Field(default=2, ge=1, le=32)
    max_concurrent_provider_calls: int = Field(default=8, ge=1, le=128)

    # --- spend bounds -----------------------------------------------------
    # "Accuracy first, cost second" is the owner mandate; these are a runaway
    # guard, not an optimisation target. None of the provider SDKs are
    # dependencies yet — the ceiling must be a startup-validated value before
    # the first paid call, not a constant discovered later.
    daily_spend_ceiling_usd: Decimal = Field(default=Decimal("25.00"), gt=0)
    per_order_spend_ceiling_usd: Decimal = Field(default=Decimal("2.50"), gt=0)

    # --- document conversion ---------------------------------------------
    # DOCX to PDF runs in an isolated Gotenberg container that must be
    # internal, pinned by digest and denied general outbound network access —
    # "no public document converter" is a rejected item in the plan, not a
    # preference.
    gotenberg_url: str = "http://gotenberg:3000"
    gotenberg_timeout_seconds: float = Field(default=120.0, gt=0, le=900)

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
    def _the_converter_stays_internal(self) -> Self:
        """Refuse a converter that is not plainly inside the deployment.

        Checked in every environment, which is why it is its own validator and
        not a clause in `additional_unsafe_for_deployment` — that hook only
        runs for staging and production. A developer pointed at a hosted
        converter is sending client documents to a third party, and that is not
        less of an exposure because it happened on a laptop.
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

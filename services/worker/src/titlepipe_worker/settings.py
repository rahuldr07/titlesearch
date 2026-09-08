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
from typing import Annotated, Self
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import NoDecode, SettingsConfigDict

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

# The one queue that exists today. Named here rather than spelled at each use so
# that the task declaration in `tasks.py`, the settings default below and the
# tests all read the same string.
#
# PLAN §6 requires TWO concurrency pools rather than one queue — local/GPU work
# (one slot on the current hardware) and cloud work (I/O-bound, wide, rate-limit
# bounded) — because treating them as one starves the GPU or hammers a rate
# limit. That split is a DEPLOYMENT shape, not a code one: procrastinate bounds
# concurrency per worker PROCESS, so two pools are two containers off the same
# image with different `TITLEPIPE_WORKER_QUEUES` and different
# `TITLEPIPE_WORKER_MAX_CONCURRENT_JOBS`. The `queues` field below is the seam
# that makes it a configuration change when the pipeline lands. The pool names
# are NOT declared here yet, because no task is registered on either and a queue
# nothing writes to is a name, not a pool.
QUEUE_MAINTENANCE = "maintenance"


class WorkerSettings(BaseServiceSettings):
    """Worker configuration. Instantiating this validates it."""

    # Only the prefix. `env_file=None`, `extra="forbid"` and `frozen=True` are
    # merged in from the base, and merged rather than replaced — asserted by
    # libs/service-kit's `test_config_is_merged_rather_than_replaced`.
    model_config = SettingsConfigDict(env_prefix=ENV_PREFIX)

    service_name: ServiceName = ServiceName.WORKER

    # See THE CONCURRENCY RULING in the module docstring. This is render-svc's
    # bound, deliberately, and it is the stricter of the two.
    max_concurrent_jobs: int = Field(default=2, ge=1, le=32)
    max_concurrent_provider_calls: int = Field(default=8, ge=1, le=128)

    # "Accuracy first, cost second" is the owner mandate; these are a runaway
    # guard, not an optimisation target. None of the provider SDKs are
    # dependencies yet — the ceiling must be a startup-validated value before
    # the first paid call, not a constant discovered later.
    daily_spend_ceiling_usd: Decimal = Field(default=Decimal("25.00"), gt=0)
    per_order_spend_ceiling_usd: Decimal = Field(default=Decimal("2.50"), gt=0)

    # DOCX to PDF runs in an isolated Gotenberg container that must be
    # internal, pinned by digest and denied general outbound network access —
    # "no public document converter" is a rejected item in the plan, not a
    # preference.
    gotenberg_url: str = "http://gotenberg:3000"
    gotenberg_timeout_seconds: float = Field(default=120.0, gt=0, le=900)

    # The DSN the work loop connects with, as `titlepipe_worker`.
    #
    # 🔴 IT IS `TITLEPIPE_WORKER_DATABASE_URL` AND IS THE THIRD NAME IN A SET OF
    # THREE THAT ARE NOT INTERCHANGEABLE. `TITLEPIPE_DATABASE_URL` is the
    # MIGRATION role's, read by `migrations/env.py`; `TITLEPIPE_APP_DATABASE_URL`
    # is core-api's request path. `.env.example` has reserved this name since
    # before there was a worker to read it. Pointing this at the app role would
    # not fail cleanly — `titlepipe_app` holds no privilege on any
    # `procrastinate_*` object (revision 0060 grants it SELECT and INSERT on two
    # tables and nothing else), so the worker would start, register, and fail its
    # first fetch with a permission error on a function it never named.
    #
    # `SecretStr` because a DSN carries a password, and this module's opening
    # rule is that settings objects are never logged.
    #
    # Optional outside a deployed environment and refused inside one, which is
    # the shape `core-api`'s `app_database_url` already has and for the reason it
    # records: a deployed worker with no DSN is a process that starts, reports a
    # valid configuration, and does nothing — the failure this service's `run`
    # command was written to refuse to imitate.
    database_url: SecretStr | None = None

    # Which queues this PROCESS consumes. See `QUEUE_MAINTENANCE` above for why
    # this is a list and not a constant.
    #
    # An empty tuple would mean "every queue" to procrastinate, which is the one
    # value an operator must not be able to reach by accident: it would put GPU
    # work and cloud work through one bounded pool, silently undoing the split
    # this field exists to make possible. `min_length=1` is the machine.
    queues: Annotated[tuple[str, ...], NoDecode] = Field(default=(QUEUE_MAINTENANCE,), min_length=1)

    # How often a running worker updates its heartbeat row, and how long a
    # heartbeat may be stale before another worker treats that worker's in-flight
    # jobs as lost. Procrastinate's own defaults, restated here because the sweep
    # task reads the second one and a bound a task depends on belongs in
    # validated configuration rather than in a call site.
    heartbeat_interval_seconds: float = Field(default=10.0, gt=0, le=300)
    stalled_worker_timeout_seconds: float = Field(default=30.0, gt=0, le=3600)

    # How many times the stall sweep will hand the same job back to the queue
    # before giving up on it and marking it failed.
    #
    # PLAN §6 sets the number: "cap 2 retries, 3rd is poison". It states it about
    # transport failures, and a stall is not one — but the bound is needed here
    # for a sharper reason. A job that KILLS ITS WORKER is stalled by definition,
    # so an uncapped sweep hands it to the next worker, which also dies, forever;
    # the queue's only visible symptom is workers restarting, and the job that
    # causes it never appears in `failed` because it never finishes. The cap is
    # what turns that into one row somebody can look at.
    #
    # `ge=0` is meaningful and is the strictest setting, not a degenerate one: it
    # means a stalled job is failed on first discovery and never re-run — the
    # right posture for a queue of paid, non-idempotent calls until the content
    # idempotency key from PLAN §6 exists to make a re-run free.
    max_stall_retries: int = Field(default=2, ge=0, le=10)

    @property
    def libpq_database_url(self) -> str:
        """The DSN in the form psycopg's pool accepts, or a refusal.

        🔴 THE TWO SPELLINGS ARE NOT INTERCHANGEABLE AND THE FAILURE IS AT
        CONNECT TIME. core-api's DSN is SQLAlchemy's — `postgresql+psycopg://` —
        because SQLAlchemy reads the `+driver` suffix to pick a dialect. The
        queue does not go through SQLAlchemy: procrastinate hands the string to
        `psycopg_pool.AsyncConnectionPool`, which passes it to libpq, and libpq
        rejects `postgresql+psycopg` as an unrecognised scheme.

        An operator copying the app's DSN into the worker's variable is the
        obvious way to reach that, so both spellings are accepted here and the
        suffix is stripped. `_the_dsn_names_postgres` refuses anything that is
        not PostgreSQL at STARTUP, so this property never has to.

        Raises rather than returning `None` for an unset DSN: the only callers
        are `queue.make_app` and the `run` command, and both run after the
        deployed-environment refusal has already had its say. A `None` here would
        be a second, quieter way to reach a worker with no database.
        """
        if self.database_url is None:
            raise RuntimeError(
                "database_url is not set; there is no queue to connect to. "
                "Deployed environments refuse this configuration at startup — "
                "reaching here means a local run asked for the work loop with "
                "no TITLEPIPE_WORKER_DATABASE_URL."
            )
        raw = self.database_url.get_secret_value()
        scheme, separator, rest = raw.partition("://")
        return f"{scheme.partition('+')[0]}{separator}{rest}"

    @field_validator("database_url")
    @classmethod
    def _the_dsn_names_postgres(cls, value: SecretStr | None) -> SecretStr | None:
        """Refuse a DSN whose scheme is not PostgreSQL, at startup.

        The queue is Postgres-native by decision, not by accident: the whole
        reason for this library over a broker is that a job is deferred in the
        same transaction as the row that justifies it. A DSN naming anything else
        is a configuration error whose natural report is a connection failure
        minutes later, inside a pool, in a process that already said its
        configuration was valid.
        """
        if value is None:
            return None
        scheme = value.get_secret_value().partition("://")[0].partition("+")[0].lower()
        if scheme not in ("postgresql", "postgres"):
            raise ValueError(
                f"database_url names scheme {scheme!r}; the queue is PostgreSQL-native "
                f"and there is no other backend for it"
            )
        return value

    @field_validator("queues", mode="before")
    @classmethod
    def _accept_a_comma_separated_list(cls, value: object) -> object:
        """`TITLEPIPE_WORKER_QUEUES=local,cloud`, which is what an operator writes.

        pydantic-settings treats a tuple-typed field as COMPLEX and JSON-decodes
        it inside `EnvSettingsSource`, before any validator on this class runs.
        MEASURED against pydantic-settings 2.14: a plain `local,cloud` never
        reaches a `mode="before"` validator at all — it raises
        `SettingsError: error parsing value for field "queues"` out of
        `json.loads`, naming neither the field's real syntax nor JSON.

        `NoDecode` on the annotation is the supported way to turn that decoding
        off, and it is what makes this validator the thing that parses the value
        rather than a step after something else already refused it. The cost is
        that a JSON array is no longer accepted here — deliberately, because two
        accepted spellings for one field is two things to get right and the
        comma-separated one is the one that survives quoting through compose, a
        systemd unit and a Kubernetes manifest.
        """
        if isinstance(value, str):
            return tuple(part.strip() for part in value.split(",") if part.strip())
        return value

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

    @model_validator(mode="after")
    def _a_worker_is_declared_stalled_after_several_missed_heartbeats(self) -> Self:
        """The stall timeout must be at least twice the heartbeat interval.

        THE FAILURE THIS REFUSES IS DUPLICATE EXECUTION, NOT A LATE ALERT. A
        worker is judged stalled by the age of its heartbeat row. Set the timeout
        at or below the interval and a perfectly healthy worker is stale for part
        of every cycle — so the sweep task moves its in-flight job back to `todo`
        while the original worker is still running it, and the job runs twice. In
        this system a job is a paid provider call against a client document, so
        "runs twice" is billed twice and writes two readings for one page.

        Twice the interval is the floor, not the recommendation; procrastinate's
        own defaults are three times (10s and 30s) and are the defaults above.
        """
        floor = self.heartbeat_interval_seconds * 2
        if self.stalled_worker_timeout_seconds < floor:
            raise ValueError(
                f"stalled_worker_timeout_seconds ({self.stalled_worker_timeout_seconds}) "
                f"is below twice heartbeat_interval_seconds "
                f"({self.heartbeat_interval_seconds}); a live worker would be judged "
                f"stalled between beats and its running job would be retried while it "
                f"is still running"
            )
        return self

    def additional_unsafe_for_deployment(self) -> list[str]:
        """This class's own deployed-environment refusals.

        Deliberately no `super()` call — `_collect_deployment_refusals` walks the
        MRO and calls every definition it finds, so chaining would report the
        base clauses twice.
        """
        if self.database_url is None:
            return [
                "database_url is not set; the worker would start, report a valid "
                "configuration and consume no queue, which is the failure the run "
                "command exists to refuse"
            ]
        return []

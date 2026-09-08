"""Typed configuration for the Core API, validated at startup.

Two rules shape this module.

**One code path across environments.** Development and production differ in
*configuration and rendering*, never in business behaviour. There is no second
settings implementation and no `if development:` branch around a domain rule.

**Deployed environments fail closed.** Staging and production refuse to start
on an unsafe knob rather than starting and hoping. A service that will not boot
is an incident during deploy; a service that boots with wildcard CORS and public
docs is an incident during an audit.

Everything a deployable that binds a port shares — the environment refusals,
the seal-password rule, the Host/CORS/docs knobs and the input-hiding seal —
comes from `BaseHttpServiceSettings`. What is left here is what exists only in
this service: the WorkOS credential pair and the app-role DSN, with the two
deployed refusals they carry.

Settings objects are never logged. `SecretStr` keeps a secret out of `repr`,
and nothing here dumps the model.

A FAILED VALIDATION HERE USED TO PRINT THE ENVIRONMENT IT WAS VALIDATING —
a five-character `cookie_seal_password` published the app DSN password beside it
as `input_value={'environment': 'producti...esql://u:PrOdPw123@h/d'}`. Both
halves of the answer are in `titlepipe_service_kit.settings_errors`, which
records the whole account: `hide_input_in_errors`, held True on every subclass
by `BaseServiceSettings.__pydantic_init_subclass__` now that this class is
inside the sealed hierarchy, and `redacted_settings_error` at the inherited
`from_environment` boundary.
"""

from __future__ import annotations

from typing import Self

from pydantic import SecretStr, model_validator
from pydantic_settings import SettingsConfigDict

from titlepipe_domain import ServiceName
from titlepipe_service_kit.settings import PLACEHOLDER_SECRETS, BaseHttpServiceSettings


class CoreApiSettings(BaseHttpServiceSettings):
    """Core API configuration. Instantiating this validates it."""

    model_config = SettingsConfigDict(env_prefix="TITLEPIPE_")

    service_name: ServiceName = ServiceName.CORE_API

    # THE INHERITED `cookie_seal_password` IS THE WORKOS COOKIE PASSWORD, and
    # there is deliberately no `workos_cookie_password` below.
    # `auth/workos_provider.py` passes the inherited value to
    # `load_sealed_session`: the AuthKit session cookie is a Fernet box, and the
    # base's seal validator already checks it as a Fernet key. A second field
    # would be two names for one credential, drifting apart on the first
    # rotation.

    # WORKOS, AND ONLY WORKOS. `auth/seam.build_auth_seam` reads these to
    # decide whether this process has a real identity provider; nothing else in
    # the service reads them, so the seam stays the one construction point.
    #
    # NEITHER IS FORMAT-CHECKED, AND THAT IS THE LESSON THIS FILE ALREADY PAID
    # FOR. A real client id begins `client_` and a real key `sk_test_` /
    # `sk_live_` today, and a validator asserting that would be the 32-vs-44
    # seal-length bug again: a rule about a vendor's credential format, written
    # from a placeholder, that rejects the genuine article the day the vendor
    # changes it. Presence and non-blankness are what this file can know;
    # WorkOS rejects a malformed key on the first call.
    #
    # `SecretStr` on the key, plain `str` on the client id, matching what each
    # is: the key is a bearer credential and belongs out of every `repr`; the
    # client id is public — the browser sends it in the AuthKit authorization
    # URL — and hiding it would only make a log line less useful.
    workos_api_key: SecretStr | None = None
    workos_client_id: str | None = None

    # The cookie AuthKit seals the session into. `wos-session` is the SDK's
    # default and it is CONFIGURABLE at WorkOS, which is why this is a field
    # rather than a constant in the adapter: a deployment that renamed the
    # cookie against a service that hardcoded the default authenticates nobody,
    # silently — every request simply looks signed-out.
    workos_session_cookie_name: str = "wos-session"

    # The DSN the REQUEST PATH connects with. Read by `lifespan.py`, which builds
    # the engine and the sessionmaker from it when the service starts.
    #
    # IT IS `TITLEPIPE_APP_DATABASE_URL` AND DELIBERATELY NOT
    # `TITLEPIPE_DATABASE_URL`, WHICH IS ALREADY TAKEN AND MEANS SOMETHING ELSE.
    # `migrations/env.py` reads that name (`DATABASE_URL_VARIABLE`) and
    # `.env.example` documents it as the MIGRATION role's DSN, because
    # `alembic upgrade head` runs DDL and only `titlepipe_migration` can
    # `SET ROLE titlepipe_owner`. Sharing one variable between the two would
    # point every request at the role that owns the schema — and it would not
    # even fail cleanly: `roles.sql` grants `titlepipe_migration` the owner
    # `WITH INHERIT FALSE` and no table privileges of its own, so the first read
    # comes back as a permission error naming a table that plainly exists.
    # `.env.example` already reserves `TITLEPIPE_MIGRATION_DATABASE_URL` and
    # `TITLEPIPE_WORKER_DATABASE_URL`; this is the third name in that set and the
    # first one a running service reads.
    #
    # `SecretStr` because a DSN carries the app role's password. This module's
    # opening states the rule — settings objects are never logged — and a plain
    # `str` here would put the credential into any `repr` of the model, which is
    # exactly what `cookie_seal_password` is a `SecretStr` to prevent.
    #
    # OPTIONAL OUTSIDE A DEPLOYED ENVIRONMENT, AND REQUIRED INSIDE ONE. The
    # refusal is in `additional_unsafe_for_deployment` below, beside the WorkOS
    # one, and `mock_auth_enabled` is the shape it copies: harmless locally,
    # refused when deployed.
    #
    # Locally the `None` is load-bearing. `TITLEPIPE_ENVIRONMENT=development`
    # alone still boots this service with no database at all, which
    # `apps/web/e2e-live` depends on — its whole premise is a core-api
    # reachable from a browser before any storage exists — and
    # `lifespan.readiness` reports a database check only when one is configured,
    # so `/ready` stays 200 there.
    #
    # IT WAS OPTIONAL EVERYWHERE, AND THE ARGUMENT FOR THAT WAS WRONG. It ran:
    # reporting the check as `False` when unconfigured would 503 every developer,
    # and requiring a DSN would make every deployed-configuration fixture carry an
    # invented one. The first is a false dilemma — this validator is precisely the
    # mechanism for holding deployed environments to a stricter bar than local
    # ones, which is why `debug`, `reload` and `mock_auth_enabled` are all
    # permissive here and refused there. The second is a fixture cost, not a
    # design argument.
    #
    # What the cost actually was: a deployed replica with no DSN is invisible on
    # BOTH surfaces an operator watches. `/health` is green because liveness
    # never consults a dependency; `/ready` is green because, by the conditional
    # above, a missing DSN is not a FAILED check — it is NO check. The only
    # symptom is `GET /api/rules` answering 503 and telling the caller to retry
    # something that will never succeed. Refusing at startup turns that into an
    # incident during deploy, which is this module's opening rule.
    app_database_url: SecretStr | None = None

    @property
    def workos_configured(self) -> bool:
        """Whether this process has the credentials to talk to a WorkOS tenant.

        `_workos_is_configured_or_absent` makes the two fields all-or-nothing,
        so this reads one of them and the other cannot disagree.

        `auth/seam.build_auth_seam` is the only caller. It is a property here
        rather than a check spelled inline there so that "configured" has one
        definition — adding a third required WorkOS value later is an edit to
        this property and the validator below, and the seam does not change.
        """
        return self.workos_client_id is not None

    @model_validator(mode="after")
    def _workos_is_configured_or_absent(self) -> Self:
        """Both WorkOS values or neither, and neither of them blank. Everywhere.

        NOT ENVIRONMENT-GATED, unlike every other rule here. A half-set pair is
        a mistake in development too, and its symptom is indistinguishable from
        working software: `build_auth_seam` reads `workos_configured`, sees one
        value missing, builds no adapter, and every request answers "Not signed
        in." — which an operator who just pasted a key in reads as a bad key.

        Blank is refused separately from absent: `TITLEPIPE_WORKOS_CLIENT_ID=`,
        or a secret that resolved to nothing, is present-and-empty. pydantic
        reads it as `""` rather than `None`, so without this the pair looks
        complete and the SDK is constructed around nothing.
        """
        key = self.workos_api_key.get_secret_value() if self.workos_api_key is not None else None
        client_id = self.workos_client_id

        blank = [
            name
            for name, value in (("workos_api_key", key), ("workos_client_id", client_id))
            if value is not None and value.strip() == ""
        ]
        if blank:
            raise ValueError(
                f"{', '.join(blank)} is set but blank; unset the variable to run "
                "without an identity provider, or supply the real value"
            )

        if (key is None) != (client_id is None):
            missing = "workos_api_key" if key is None else "workos_client_id"
            raise ValueError(
                f"WorkOS is half-configured: {missing} is not set. Both values are "
                "required together, because a service with one of them builds no "
                "identity provider and answers every request as signed-out"
            )

        if self.workos_session_cookie_name.strip() == "":
            raise ValueError(
                "workos_session_cookie_name must be a cookie name; it is what the "
                "sealed AuthKit session is read from"
            )
        return self

    def additional_unsafe_for_deployment(self) -> list[str]:
        """The refusals that exist only in this service: WorkOS and the app DSN.

        The other twelve clauses this method's predecessor carried — debug,
        redaction, reload, mock auth, docs, the three CORS rules, the seal
        placeholder, loopback host and both allowed_hosts rules — are the base
        hierarchy's verbatim and are collected from it along the MRO, so this
        lists only what no other deployable refuses.
        """
        unsafe: list[str] = []
        if not self.workos_configured:
            # WHAT MAKES THE WORKOS ADAPTER MANDATORY WHERE IT MATTERS.
            # Without this a deployed service starts with an EMPTY provider
            # registry — `auth/provider.py`'s fail-closed state, which refuses
            # everyone and is therefore safe. Safe is not the bar: a staging box
            # that refuses every sign-in looks exactly like a WorkOS outage, an
            # expired key, or a browser sending no cookie, and all three get
            # debugged before anyone suspects an unset variable.
            unsafe.append(
                "WorkOS is not configured; set workos_api_key and workos_client_id, "
                "or the service would start with no identity provider and refuse "
                "every sign-in"
            )
        elif self.workos_api_key is not None and (
            self.workos_api_key.get_secret_value() in PLACEHOLDER_SECRETS
        ):
            unsafe.append("workos_api_key is a placeholder")
        if self.app_database_url is None:
            # The one refusal here whose absence is invisible at RUNTIME rather
            # than merely dangerous. Every other knob in this list produces a
            # service that works and is unsafe; this one produces a service that
            # reports itself healthy AND ready on both probes while answering
            # every product request with a retryable 503 that will never
            # succeed. See the field's own comment for the two surfaces.
            unsafe.append(
                "app_database_url is not set; the service would report itself ready "
                "on /health and /ready while answering every product request with a "
                "503 the caller is invited to retry"
            )
        return unsafe

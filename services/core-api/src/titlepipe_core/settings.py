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

import base64
import binascii
from typing import Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from titlepipe_domain import Environment, LogRenderer, ServiceName

# A cookie-seal password is a FERNET KEY: 32 random bytes, urlsafe-base64
# encoded, which is 44 characters including the single '=' pad. Enforced here so
# the failure lands at startup rather than at first login.
#
# THIS WAS 32 AND IT WAS WRONG — the byte count, not the encoded length. Every
# real WorkOS credential is 44 characters, so the check would have rejected the
# genuine article and accepted nothing that works. It was never caught because
# the placeholder default was itself 32 characters, so the validator agreed with
# the bug: the only value ever tested was the one that should have failed.
#
# The length is checked against the DECODED byte count rather than trusting 44,
# because 44 characters of the wrong alphabet is not a key. `base64` is stdlib,
# so this stays honest without pulling `cryptography` in at Gate 1 — the
# constructive `Fernet(secret)` check belongs at the gate that adds WorkOS, and
# is noted in BUILD-PLAN §5.1.
SEAL_KEY_BYTES = 32
SEAL_PASSWORD_LENGTH = 44

# Values that exist to make a fresh checkout run. Any of them in a deployed
# environment means a real secret was never supplied.
#
# This one is a STRUCTURALLY VALID Fernet key that decodes to the readable
# sentence "development-only-seal-password!!" — obviously a placeholder to a
# human, and it passes the same validator a real key does. The previous value
# was that sentence UNENCODED: 32 characters, i.e. the byte count rather than
# the encoded length. It agreed with the old off-by-12 check and hid it, which
# is why nothing failed until a real credential was tried.
#
# It is listed in PLACEHOLDER_SECRETS below, so a deployed environment still
# refuses to start with it — which is the point of naming it.
DEVELOPMENT_SEAL_PASSWORD = "ZGV2ZWxvcG1lbnQtb25seS1zZWFsLXBhc3N3b3JkISE="  # noqa: S105

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

    # No default. A forgotten variable must not silently mean "development":
    # the container binds 0.0.0.0, so failing open would publish the API docs,
    # the placeholder seal password and detailed exception bodies. Requiring it
    # turns that into a startup error, which is the cheap failure.
    environment: Environment
    service_name: ServiceName = ServiceName.CORE_API

    # --- HTTP surface -----------------------------------------------------
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    debug: bool = False
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
    # environments; a deployed service that accepts any Host is open to
    # cache poisoning and forged absolute links.
    allowed_hosts: tuple[str, ...] = ()

    # --- session ----------------------------------------------------------
    # 🔴 THIS IS THE WORKOS COOKIE PASSWORD, and there is deliberately no
    # `workos_cookie_password` below. `auth/workos_provider.py` passes THIS
    # value to `load_sealed_session`: the AuthKit session cookie is a Fernet
    # box, and `_seal_password_is_a_fernet_key` already validates it as a Fernet
    # key. A second field would be two names for one credential, drifting apart
    # on the first rotation.
    cookie_seal_password: SecretStr = SecretStr(DEVELOPMENT_SEAL_PASSWORD)
    mock_auth_enabled: bool = False

    # --- identity provider (WorkOS AuthKit) -------------------------------
    # 🔴 WORKOS, AND ONLY WORKOS. `auth/seam.build_auth_seam` reads these to
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

    # --- database ---------------------------------------------------------
    # The DSN the REQUEST PATH connects with. Read by `lifespan.py`, which builds
    # the engine and the sessionmaker from it when the service starts.
    #
    # 🔴 IT IS `TITLEPIPE_APP_DATABASE_URL` AND DELIBERATELY NOT
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
    # refusal is in `_deployed_environments_refuse_unsafe_configuration` below,
    # beside the others, and `mock_auth_enabled` is the shape it copies:
    # harmless locally, refused when deployed.
    #
    # Locally the `None` is load-bearing. `TITLEPIPE_ENVIRONMENT=development`
    # alone still boots this service with no database at all, which
    # `apps/web/e2e-live` depends on — its whole premise is a core-api
    # reachable from a browser before any storage exists — and
    # `lifespan.readiness` reports a database check only when one is configured,
    # so `/ready` stays 200 there.
    #
    # 🔴 IT WAS OPTIONAL EVERYWHERE, AND THE ARGUMENT FOR THAT WAS WRONG. It ran:
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

    @property
    def openapi_url(self) -> str | None:
        """`None` disables the schema route entirely."""
        return "/openapi.json" if self.docs_enabled else None

    @classmethod
    def from_environment(cls) -> CoreApiSettings:
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

    @model_validator(mode="after")
    def _seal_password_is_a_fernet_key(self) -> Self:
        """
        A Fernet key, checked by DECODING it — not by counting characters.

        The length is the cheap half; the alphabet is the half that catches a
        truncated paste or a base64 (not urlsafe) variant, both of which are 44
        characters and neither of which WorkOS will accept.
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
        if not self.workos_configured:
            # 🔴 WHAT MAKES THE WORKOS ADAPTER MANDATORY WHERE IT MATTERS.
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
        if self.host == "127.0.0.1":
            unsafe.append("host is loopback-only and unreachable behind a proxy")
        if not self.allowed_hosts:
            unsafe.append("allowed_hosts is empty; the service would accept any Host header")
        if "*" in self.allowed_hosts:
            unsafe.append("allowed_hosts contains a wildcard")

        if unsafe:
            raise ValueError(
                f"unsafe configuration for {self.environment.value}: " + "; ".join(unsafe)
            )
        return self

"""WorkOS AuthKit, behind `provider.IdentityProvider`. One class, no callers changed.

---------------------------------------------------------------------------
THIS ADAPTER HAS NEVER AUTHENTICATED ANYBODY. IT IS UNEXERCISED.
---------------------------------------------------------------------------
There are no WorkOS credentials on this machine and no tenant to point at, so
nothing here has been run against the real thing. What IS tested is everything
this file decides on its own — which cookie it reads, what it refuses, what it
throws away, and that a JWKS failure is a 503 rather than a denial — because
those are decisions in this code rather than facts about WorkOS.
`tests/test_workos_provider.py` is that file; the module was at 0% coverage
while this paragraph claimed otherwise.

What is NOT tested is the part WorkOS owns: that a genuine sealed cookie unseals
with our password, that the access token inside it verifies against the tenant's
JWKS, and that the claims are spelled the way `_identity_from` reads them. **The
first real sign-in is that test**, and
`test_workos_provider.py::test_a_live_workos_tenant_is_not_configured_here`
fails on the day that becomes possible — a residual with a machine under it
rather than a sentence that decays unread.

Read the paragraph above before trusting any sentence below it. Every "does" in
this module is a statement about the code, not a report of an observation.

## What is wired, and the two halves of sign-in that are not

`seam.build_auth_seam` CONSTRUCTS this adapter whenever both WorkOS credentials
are configured, and `settings.py` refuses to start a deployed environment
without them. That branch did not exist while this docstring described it: a
valid production configuration registered no provider at all.

Two halves are still missing and neither is this file's to supply.

**Nothing in this service sets the cookie this reads.** The AuthKit round trip
is three steps and only the third is a provider concern:

1. `GET /auth/login` → redirect to the AuthKit authorization URL;
2. `GET /auth/callback` → exchange the code, seal the response, set the cookie;
3. every subsequent request → read the cookie. **This file, and only this file.**

Steps 1 and 2 are routes, and routes are `api/routers/`.

**And there is no seat directory to resolve an identity against.** `directory.py`
has no database-backed implementation, so `AuthSeam.seats` is `None` outside a
mock configuration and `dependencies.require_seat` refuses. That is why
`AuthSeam.can_authenticate` still answers `False` for every deployed
configuration even now that a provider is registered, and why it says `False`
rather than `True` — the earlier version of this paragraph predicted the
opposite.

## Why the cookie and not a bearer token

AuthKit's server-side session IS the sealed cookie. Accepting an
`Authorization: Bearer` access token as well would be a second credential path
with different verification, different lifetime and different revocation, and
two paths into one seat is how the weaker one becomes the only one that matters.
If an API-token surface is wanted later it is a different provider adapter with
its own name, which is what the registry in `provider.py` is for.

## What is deliberately thrown away

WorkOS returns `role`, `roles`, `permissions`, `entitlements` and
`feature_flags` on a verified session. **Every one of them is discarded here.**
`docs/PRD.md` §9: PostgreSQL owns authorization; the provider's own role claims
are deliberately ignored. That is not enforced by this file remembering to drop
them — `identity.ProviderIdentity` has no field any of them could travel in, so
carrying one would mean editing that dataclass, which is a diff a reviewer sees.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Final

from jwt.exceptions import PyJWKClientError
from workos import AsyncWorkOSClient
from workos.session import (
    AuthenticateWithSessionCookieErrorResponse,
    AuthenticateWithSessionCookieFailureReason,
    AuthenticateWithSessionCookieSuccessResponse,
)

from titlepipe_core.auth.identity import ProviderIdentity
from titlepipe_core.auth.provider import Credentials
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import DependencyUnavailableError

__all__ = [
    "WORKOS_PROVIDER_NAME",
    "WorkOSAuthKitProvider",
]

# What lands in `users.identity_provider` for a seat admitted this way, and the
# name this adapter must answer in — `ProviderRegistry.authenticate` refuses an
# identity claiming anything else. It is permanent data once one row exists, so
# it names the VENDOR and not the SDK or the product: `workos`, not `workos-10`
# and not `authkit`, which is one of several things WorkOS sells.
WORKOS_PROVIDER_NAME: Final = "workos"

# Client-safe and says nothing about a person or a session.
_UNVERIFIABLE_MESSAGE: Final = "Sign-in is temporarily unavailable."


def _string_claim(claims: Mapping[str, object] | None, key: str) -> str | None:
    """One string out of the SDK's untyped user dict, or `None`.

    `AuthenticateWithSessionCookieSuccessResponse.user` is the WorkOS user
    object as it was sealed into the cookie, and the SDK types it as a plain
    dict of unknown values. Reading it through `isinstance` rather than an
    annotation is the difference between knowing this is a string and asserting
    it: a claim that arrives as a number, a null, or a nested object answers
    `None` here and the caller refuses, instead of a `TypeError` three frames
    later in `ProviderIdentity.__post_init__`.
    """
    # `Mapping` in the ANNOTATION and an `isinstance` as well, and both are
    # load-bearing: the SDK types this `Optional[Dict[str, Any]]`, so the
    # annotation is the SDK's promise and the check is what happens when a real
    # payload breaks it. Narrowing from a bare `object` was the earlier spelling
    # and produced `dict[Unknown, Unknown]`, whose every read pyright reports;
    # `cast` is refused by this repository's rules gate, and rightly — it would
    # have asserted the shape rather than checked it.
    if not isinstance(claims, Mapping):
        return None
    value = claims.get(key)
    return value if isinstance(value, str) else None


class WorkOSAuthKitProvider:
    """Reads the sealed AuthKit cookie and names a person. Never a role.

    Satisfies `provider.IdentityProvider`. Constructed in exactly one place —
    `seam.build_auth_seam` — from exactly the settings fields named there.
    """

    def __init__(
        self,
        *,
        api_key: str,
        client_id: str,
        cookie_password: str,
        session_cookie_name: str,
    ) -> None:
        """Build the SDK client once, and pass every credential EXPLICITLY.

        THE EXPLICIT ARGUMENTS ARE THE POINT, not ceremony.
        `AsyncWorkOSClient.__init__` falls back to `os.environ["WORKOS_API_KEY"]`
        and `os.environ["WORKOS_CLIENT_ID"]` when they are omitted — MEASURED in
        `workos/_base_client.py` at 10.3.0. This service's configuration is
        `CoreApiSettings`, whose every variable is `TITLEPIPE_`-prefixed and
        whose `extra="forbid"` means an unknown one is a startup error. Letting
        the SDK read two unprefixed variables of its own would put a live
        credential outside the object that validates configuration, where
        nothing refuses it, nothing redacts it and no test covers it.

        `cookie_password` is `settings.cookie_seal_password`. It is not a second
        secret: the AuthKit cookie is a Fernet box and that field is already
        validated as a Fernet key at startup.
        """
        self._client = AsyncWorkOSClient(api_key=api_key, client_id=client_id)
        self._cookie_password = cookie_password
        self._session_cookie_name = session_cookie_name

    @property
    def name(self) -> str:
        return WORKOS_PROVIDER_NAME

    async def authenticate(self, credentials: Credentials) -> ProviderIdentity | None:
        """The person this sealed session names, or `None`.

        `None` for every ordinary way this fails: no cookie, a cookie that does
        not unseal, a token whose signature or expiry does not check out, a
        session with no organization, an impersonated session, or claims that
        are not strings. `provider.py` sets that contract — an adapter that
        finds its own credential and judges it invalid still answers `None`,
        because the caller learns nothing from the difference and an attacker
        learns which credential shape is live. The log line below names which.

        The ONE thing it does not answer `None` to is being unable to judge at
        all: a JWKS fetch that fails raises `DependencyUnavailableError`. See
        `_unverifiable` below.
        """
        sealed = credentials.cookies.get(self._session_cookie_name)
        if not sealed:
            # Not my request. Every unauthenticated call to a public route lands
            # here, so it is deliberately not logged.
            return None

        session = self._client.user_management.load_sealed_session(
            session_data=sealed,
            cookie_password=self._cookie_password,
        )

        # `authenticate()` IS SYNCHRONOUS AND IT BLOCKS ON THE NETWORK.
        # The SDK's own comment says it "only performs local operations", which
        # is true of the Fernet unseal and false of the JWT verification: PyJWT's
        # `PyJWKClient` fetches the tenant's key set with
        # `urllib.request.urlopen`, and MEASURED at pyjwt 2.13 its defaults are
        # `cache_jwk_set=True, lifespan=300, timeout=30`. So one request in every
        # five minutes makes a blocking HTTP call of up to thirty seconds, and on
        # the event loop that stalls EVERY other request in the process, not just
        # this one. The thread hop is what `provider.IdentityProvider` being
        # `async` was for.
        try:
            outcome = await asyncio.to_thread(session.authenticate)
        except PyJWKClientError as error:
            raise self._unverifiable(error) from error

        if isinstance(outcome, AuthenticateWithSessionCookieErrorResponse):
            return self._refuse(outcome)
        return self._identity_from(outcome)

    def _unverifiable(self, error: PyJWKClientError) -> DependencyUnavailableError:
        """THE ONE FAILURE THAT IS NOT A REFUSAL. 503, never `None`.

        `None` is "not signed in", which `dependencies.require_seat` turns into a
        401 telling the caller to present a credential — and no credential fixes
        a key set that will not load. A person holding a perfectly good session
        would be told their session was bad, and a WorkOS outage would look like
        a fleet of expired cookies. `DependencyUnavailableError` is registered at
        503 in `api/error_envelope.py`, which is the status that says retry.

        The vendor's message names infrastructure — a URL, a timeout, a TLS
        failure — so it goes to the log line and `_UNVERIFIABLE_MESSAGE` goes to
        the wire.
        """
        get_logger(__name__).error(
            "workos_session_unverifiable",
            provider=WORKOS_PROVIDER_NAME,
            reason="jwks_unavailable",
            error=str(error),
        )
        return DependencyUnavailableError(_UNVERIFIABLE_MESSAGE)

    def _refuse(self, outcome: AuthenticateWithSessionCookieErrorResponse) -> None:
        """Log which of WorkOS's failure reasons this was, and answer `None`.

        The reason is a vendor enum or a bare string and goes only to the log.
        `dependencies.require_seat` turns the `None` into the same
        "Not signed in." every other failure produces.

        A JWKS FETCH FAILURE DOES NOT REACH HERE. The SDK catches only
        `jwt.exceptions.InvalidTokenError`, and `PyJWKClientError` is a sibling
        of it rather than a subclass — MEASURED in `jwt/exceptions.py`, where
        both derive from `PyJWTError` — so a key set that will not load raises
        straight out of `authenticate()` and is handled where it is raised.
        """
        reason = outcome.reason
        get_logger(__name__).info(
            "workos_session_refused",
            provider=WORKOS_PROVIDER_NAME,
            # `reason` is typed `Union[enum, str]` by the SDK. `isinstance` and
            # not `hasattr`: the `hasattr` spelling left `reason` as `str` on the
            # else branch while still reading `.value` on the then branch, which
            # pyright reports and which would be an `AttributeError` the day the
            # SDK sends an unmodelled reason as a bare string.
            reason=reason.value
            if isinstance(reason, AuthenticateWithSessionCookieFailureReason)
            else str(reason),
        )
        return

    def _identity_from(
        self, outcome: AuthenticateWithSessionCookieSuccessResponse
    ) -> ProviderIdentity | None:
        """A verified session's four strings, or `None` if it cannot seat anyone.

        Three refusals, and each one is a decision rather than defensiveness.

        **An impersonated session is refused.** WorkOS lets an administrator act
        as a user, and `outcome.impersonator` is how a session says so. Admitting
        it would mint a seat indistinguishable from that person's own — the
        `users` row is theirs, the role is theirs, and `audit_log` would record
        their name against actions somebody else took. There is nowhere in
        `AuthenticatedSeat` to record who was really driving, so the honest
        answer while that is true is no.

        **A session with no organization is refused.** `organization_id` is
        `Optional` because AuthKit permits a personal sign-in, and
        `directory.SeatDirectory` resolves a tenant FROM the organization. A
        session without one cannot name a tenant, and a tenant is not something
        this adapter may pick a default for.

        **Non-string claims are refused**, via `_string_claim`. See there.
        """
        if outcome.impersonator is not None:
            get_logger(__name__).warning(
                "workos_session_refused",
                provider=WORKOS_PROVIDER_NAME,
                reason="impersonated_session",
                organization=outcome.organization_id,
            )
            return None

        organization = outcome.organization_id
        subject = _string_claim(outcome.user, "id")
        email = _string_claim(outcome.user, "email")

        if organization is None or subject is None or email is None:
            missing = [
                field
                for field, value in (
                    ("organization_id", organization),
                    ("user.id", subject),
                    ("user.email", email),
                )
                if value is None
            ]
            get_logger(__name__).info(
                "workos_session_refused",
                provider=WORKOS_PROVIDER_NAME,
                reason="incomplete_session_claims",
                missing=tuple(missing),
            )
            return None

        return ProviderIdentity(
            provider=WORKOS_PROVIDER_NAME,
            # THE WORKOS USER ID, WHICH IS THE PERSON. Not the email, which
            # they can change, and not a role — `outcome.role`, `outcome.roles`
            # and `outcome.permissions` are all present on this object and all
            # thrown away here. `ProviderIdentity` has no field for them, so
            # this is a wall rather than a habit.
            subject=subject,
            organization=organization,
            # Lower-cased HERE and not in `ProviderIdentity`, which refuses any
            # other form and calls a mixed-case email an ADAPTER DEFECT. WorkOS
            # does not promise a case, so folding it is this adapter's job; the
            # `users` table's `email = lower(email)` constraint is the authority
            # both are agreeing with. Safe because email authenticates nothing:
            # a seat is found by `(provider, organization, subject)`.
            email=email.lower(),
        )

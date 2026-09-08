"""The composition root for authentication, and the honest account of what it
does and does not guarantee.

One function decides which identity providers this process has. Everything else
in this package is called BY something rather than deciding anything, which is
what makes "who can authenticate here" a question with a single answer.

---------------------------------------------------------------------------
🔴 THE MACHINE THAT MAKES `x-mock-role` UNTRUSTABLE, NAMED IN ORDER.
---------------------------------------------------------------------------
`CONVENTIONS.md` §9: every safety property names the machine that enforces it,
or is reported as an unproven residual. This is the naming.

1. **`CoreApiSettings._deployed_environments_refuse_unsafe_configuration`** —
   `settings.py`. `mock_auth_enabled` is in its `unsafe` list, so constructing
   settings for `staging` or `production` with it set raises. `create_app` builds
   settings before anything else runs, so the process does not start. This is the
   load-bearing one: it is why the two below can never be reached in a deployed
   environment.
2. **`build_auth_seam`, below** — the mock adapter is CONSTRUCTED only under
   `settings.mock_auth_enabled`. A configuration without it has a registry that
   has never heard of the header, so there is no handler check to forget and no
   branch a refactor can delete. The header is not distrusted; it is
   unrecognised.
3. **`MockHeaderProvider.__init__`** — refuses to construct in a deployed
   environment even if reached directly, which is the case (1) and (2) do not
   cover: a second composition root, a script, a test.
4. **`api/mock_auth_guard.MockAuthGuardMiddleware`** — installed
   UNCONDITIONALLY by `create_app`, so no configuration omits it; only its
   verdict changes. Where mock auth is off, a request CARRYING the header is
   refused 401 before routing. This is what makes "cannot reach a handler with
   an authenticated seat" true of the request rather than only of the seat: a
   client still sending the header is told, instead of being silently downgraded
   to anonymous and left to guess why its data is empty.

`tests/test_auth_seam.py` drives (2), (3) and (4). Machine (1) is driven by
`tests/test_settings.py::test_a_deployed_environment_refuses_an_unsafe_setting`
parametrised on `mock_auth_enabled`, and stays there rather than being restated:
it is a property of `CoreApiSettings`, and a second copy is one that can pass
while the first is deleted.

---------------------------------------------------------------------------
🔴 UNPROVEN RESIDUAL — WHAT THE CHAIN ABOVE DOES NOT COVER.
---------------------------------------------------------------------------
**The whole chain is rooted in one environment variable.** Every lock keys off
`TITLEPIPE_ENVIRONMENT`. A production host started with
`TITLEPIPE_ENVIRONMENT=development` and `TITLEPIPE_MOCK_AUTH_ENABLED=true` gets
a running service that trusts `x-mock-role`, and NOTHING INSIDE THIS PROCESS CAN
DETECT THAT — a service cannot tell a mislabelled box from a laptop by looking at
itself. No test here proves otherwise, and this file does not claim it.

What would close it is outside this repository's Python: the environment value
has to come from a source the application cannot be started without and an
operator cannot retype — a platform-injected variable, a signed deployment
manifest, an admission check that refuses a pod whose environment label and
`TITLEPIPE_ENVIRONMENT` disagree. That is a deploy-time control and it is not
built. It is stated here rather than in a comment asserting the header is safe,
because this codebase's characteristic failure is a safety claim with no machine
behind it and an auth claim is the worst place to add one.

**A second residual, smaller and worth naming.** Nothing in the seam expires a
session, because there is no session yet — a real adapter validates a sealed
cookie or a signed token with its own lifetime, and the mock adapter has neither.
Session lifetime arrives with the first real provider and is that adapter's
concern.
"""

from __future__ import annotations

from dataclasses import dataclass

from titlepipe_core.auth.directory import SeatDirectory, StaticSeatDirectory
from titlepipe_core.auth.mock import MockHeaderProvider, development_seats
from titlepipe_core.auth.provider import IdentityProvider, ProviderRegistry
from titlepipe_core.auth.workos_provider import WorkOSAuthKitProvider
from titlepipe_core.settings import CoreApiSettings

__all__ = [
    "AuthSeam",
    "build_auth_seam",
]


@dataclass(frozen=True, slots=True)
class AuthSeam:
    """Everything the request path needs to turn a request into a seat.

    Held on the app instance rather than in a module global, for
    `lifespan.ServiceResources`' reason: two apps in one test process must be
    able to hold different configurations without one clobbering the other, and
    a mock-enabled app and a deployed-shaped app in the same suite is precisely
    the pair this package's tests build.

    `seats` is `SeatDirectory | None` and the `None` is not an oversight — see
    `directory.py`. There is no database-backed directory, so a configuration
    without the static one has nowhere to look a seat up, and
    `dependencies.require_seat` refuses rather than inventing one.
    """

    providers: ProviderRegistry
    seats: SeatDirectory | None

    @property
    def can_authenticate(self) -> bool:
        """Whether this process can produce a seat at all.

        🔴 STILL FALSE FOR EVERY DEPLOYED CONFIGURATION, AND THE REASON CHANGED.
        A real adapter now exists and is registered — see `build_auth_seam`. What
        is missing is the other half: `directory.py` has no database-backed
        implementation, so `seats` is `None` and `dependencies.require_seat`
        refuses with `no_seat_directory_is_configured`. `api/routers/` has no
        `/auth/login` or `/auth/callback` either, so nothing sets the cookie the
        WorkOS adapter reads.

        Exposed so a startup log line says that out loud rather than leaving it
        to be discovered by a 401.
        `tests/test_auth_seam.py::test_a_deployed_seam_still_cannot_authenticate
        _because_it_has_no_directory` is what keeps this answer honest as each
        piece lands.
        """
        return bool(self.providers) and self.seats is not None


def build_auth_seam(settings: CoreApiSettings) -> AuthSeam:
    """The ONLY place an identity provider is constructed.

    Adopting a vendor is a new `auth/<vendor>.py` implementing
    `provider.IdentityProvider` and one branch here. No other file in this
    service learns the vendor's name — `dependencies.require_seat` calls the
    registry, and the registry calls whatever is in it.

    🔴 ORDER. WorkOS is asked FIRST. `ProviderRegistry` takes the first adapter
    that recognises a request, and a developer holding a genuine WorkOS session
    must not be downgraded to a demo seat by a stale `x-mock-role` the frontend
    is still sending. The mock adapter answers `None` when its header is absent,
    so asking WorkOS first costs the development path nothing.

    🔴 MACHINE 2 OF 4 (see the module docstring). The mock adapter exists only
    under `mock_auth_enabled`, and `settings.py` will not let that be true in
    staging or production. Note what this function does NOT do: it does not
    check the environment itself. It does not have to, and adding the check here
    would be the third statement of one rule and the one most likely to drift.
    What it does instead is pass the environment to `MockHeaderProvider`, whose
    constructor refuses — so the rule stays stated once, in `settings.py`, and
    once more where the dangerous object is actually built.
    """
    providers: list[IdentityProvider] = []
    seats: SeatDirectory | None = None

    # Gated on the two FIELDS rather than on `settings.workos_configured`, which
    # says the same thing: `_workos_is_configured_or_absent` makes the pair
    # all-or-nothing, but pyright cannot see through a property to a validator,
    # so reading the property here would leave `api_key` typed `SecretStr | None`
    # and the construction below unreachable without an assert. The two
    # expressions are pinned to each other by `tests/test_auth_seam.py::test_the
    # _seam_registers_workos_exactly_when_settings_says_it_is_configured`.
    api_key = settings.workos_api_key
    client_id = settings.workos_client_id
    if api_key is not None and client_id is not None:
        providers.append(
            WorkOSAuthKitProvider(
                api_key=api_key.get_secret_value(),
                client_id=client_id,
                # NOT a second secret. The AuthKit cookie is a Fernet box and
                # `cookie_seal_password` is already validated as a Fernet key at
                # startup; `settings.py` records why there is no
                # `workos_cookie_password` beside it.
                cookie_password=settings.cookie_seal_password.get_secret_value(),
                session_cookie_name=settings.workos_session_cookie_name,
            )
        )

    if settings.mock_auth_enabled:
        providers.append(MockHeaderProvider(environment=settings.environment))
        # The static directory is built here and NOWHERE ELSE, so it shares the
        # mock adapter's single condition. A configuration that can look a
        # development seat up is exactly a configuration that can produce a
        # development identity; the two cannot come apart.
        seats = StaticSeatDirectory(development_seats())

    return AuthSeam(providers=ProviderRegistry(providers), seats=seats)

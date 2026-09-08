"""Everything `auth/workos_provider.py` decides on its own.

🔴 READ THIS BEFORE READING A GREEN RUN AS EVIDENCE THE ADAPTER WORKS.
Nothing here reaches a WorkOS tenant and nothing can: there are no credentials on
this machine. The SDK is replaced by a stub that answers with the SDK's own
response dataclasses, so what is exercised is which cookie the adapter reads,
what it refuses, what it throws away and what it raises — decisions in our code.
What is NOT exercised is the part WorkOS owns: that a genuine sealed cookie
unseals with our password, that the token inside verifies against the tenant's
JWKS, and that the claims are spelled the way `_identity_from` reads them.

That residual has a machine rather than a paragraph now:
`test_a_live_workos_tenant_is_not_configured_here` fails the day somebody points
this process at a real tenant, which is the day the round trip has to be written.
The module was at 0% coverage while its docstring said all of this was tested.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Final

import pytest
from jwt.exceptions import PyJWKClientError
from workos.session import (
    AuthenticateWithSessionCookieErrorResponse,
    AuthenticateWithSessionCookieFailureReason,
    AuthenticateWithSessionCookieSuccessResponse,
)

from titlepipe_core.auth.workos_provider import (
    WORKOS_PROVIDER_NAME,
    WorkOSAuthKitProvider,
)
from titlepipe_domain import DependencyUnavailableError

COOKIE_NAME: Final = "wos-session"

# Values that plainly cannot be credentials, for `conftest.DEPLOYED_WORKOS_API_KEY`'s
# reason: a credential-shaped literal in a checked-in file is one somebody
# eventually wonders about.
API_KEY: Final = "this-workos-key-never-authenticates"
CLIENT_ID: Final = "client_this_tenant_does_not_exist"
COOKIE_PASSWORD: Final = "a-fernet-key-that-never-unseals-anything!!!!"

SEALED: Final = "sealed-cookie-that-no-fernet-key-opens"
SUBJECT: Final = "user_01H0000000000000000000000"
ORGANIZATION: Final = "org_01H0000000000000000000000"


def _nothing() -> Mapping[str, str]:
    """An empty header or cookie map, annotated. A bare `dict` factory infers
    `dict[Unknown, Unknown]` under this repository's pyright settings."""
    return {}


@dataclass(frozen=True, slots=True)
class _Credentials:
    """A `provider.Credentials` — two mappings and no request. See
    `provider.Credentials` for why the protocol is that narrow."""

    headers: Mapping[str, str] = field(default_factory=_nothing)
    cookies: Mapping[str, str] = field(default_factory=_nothing)


class _Session:
    """What `load_sealed_session` returns: one object with `authenticate()`.

    `authenticate` is SYNCHRONOUS in the SDK and the adapter runs it through
    `asyncio.to_thread`. Keeping this stub synchronous is what makes that hop
    real in the test rather than assumed — an async stub would pass whether the
    adapter awaited a thread or blocked the loop.
    """

    def __init__(self, outcome: object) -> None:
        self._outcome = outcome

    def authenticate(self) -> object:
        if isinstance(self._outcome, BaseException):
            raise self._outcome
        return self._outcome


class _UserManagement:
    def __init__(self, outcome: object) -> None:
        self._outcome = outcome
        self.seen: list[tuple[str, str]] = []

    def load_sealed_session(self, *, session_data: str, cookie_password: str) -> _Session:
        self.seen.append((session_data, cookie_password))
        return _Session(self._outcome)


class _Client:
    def __init__(self, outcome: object) -> None:
        self.user_management = _UserManagement(outcome)


def _provider(outcome: object) -> tuple[WorkOSAuthKitProvider, _Client]:
    """A provider whose SDK client is the stub, and the stub.

    The real `AsyncWorkOSClient` is constructed and then replaced rather than
    never built: `__init__` passing both credentials EXPLICITLY is the thing that
    keeps the SDK from reading `WORKOS_API_KEY` out of the environment, and a
    test that skipped the constructor would not exercise it.
    """
    provider = WorkOSAuthKitProvider(
        api_key=API_KEY,
        client_id=CLIENT_ID,
        cookie_password=COOKIE_PASSWORD,
        session_cookie_name=COOKIE_NAME,
    )
    client = _Client(outcome)
    provider._client = client  # type: ignore[assignment]  # pyright: ignore[reportPrivateUsage]
    return provider, client


def _success(**overrides: Any) -> AuthenticateWithSessionCookieSuccessResponse:
    """A verified session carrying every claim the adapter throws away.

    `role`, `roles` and `permissions` are populated in the DEFAULT rather than in
    one test: every success case then proves they cannot reach a seat, instead of
    one case proving it and the rest saying nothing.
    """
    fields: dict[str, Any] = {
        "authenticated": True,
        "session_id": "session_01H0000000000000000000000",
        "organization_id": ORGANIZATION,
        "role": "admin",
        "roles": ["admin", "owner"],
        "permissions": ["orders:delete"],
        "user": {"id": SUBJECT, "email": "Ada@Example.Test"},
        "impersonator": None,
        "entitlements": ["everything"],
        "feature_flags": ["all"],
    }
    fields.update(overrides)
    return AuthenticateWithSessionCookieSuccessResponse(**fields)


def _failure(
    reason: AuthenticateWithSessionCookieFailureReason | str,
) -> AuthenticateWithSessionCookieErrorResponse:
    return AuthenticateWithSessionCookieErrorResponse(authenticated=False, reason=reason)


# ---------------------------------------------------------------------------
# WHICH CREDENTIAL IT READS.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_request_without_the_cookie_is_not_this_adapters_request() -> None:
    """`None`, and the SDK is not called at all.

    Every unauthenticated call to a public route lands here, so the assertion
    that matters is the second one: an adapter that unsealed an absent cookie
    would make a JWKS fetch out of a request that carries no credential.
    """
    provider, client = _provider(_success())

    assert await provider.authenticate(_Credentials()) is None
    assert client.user_management.seen == []


@pytest.mark.asyncio
async def test_the_cookie_name_is_the_configured_one_and_the_password_is_passed() -> None:
    """A deployment that renamed the cookie against a service that hardcoded the
    SDK default authenticates nobody, silently — every request simply looks
    signed-out. That is why the name is a setting, and this is the assertion
    that it is read rather than assumed."""
    provider, client = _provider(_success())

    await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED}))

    assert client.user_management.seen == [(SEALED, COOKIE_PASSWORD)]


@pytest.mark.asyncio
async def test_a_cookie_under_another_name_is_not_read() -> None:
    provider, client = _provider(_success())

    assert await provider.authenticate(_Credentials(cookies={"session": SEALED})) is None
    assert client.user_management.seen == []


# ---------------------------------------------------------------------------
# WHAT IT REFUSES, AND THAT EVERY REFUSAL ANSWERS THE SAME `None`.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_verified_session_names_the_person() -> None:
    """The positive path. Without it every refusal below is satisfied by an
    adapter that returns `None` unconditionally."""
    provider, _ = _provider(_success())

    identity = await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED}))

    assert identity is not None
    assert identity.provider == WORKOS_PROVIDER_NAME
    assert identity.subject == SUBJECT
    assert identity.organization == ORGANIZATION


@pytest.mark.asyncio
async def test_the_email_is_folded_here_and_not_by_the_dataclass() -> None:
    """WorkOS does not promise a case; `ProviderIdentity` refuses any form but
    lower and calls a mixed-case address an ADAPTER DEFECT. So the fold is this
    adapter's job, and `_success` supplies `Ada@Example.Test` to prove it
    happens rather than being absent from the fixture."""
    provider, _ = _provider(_success())

    identity = await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED}))

    assert identity is not None
    assert identity.email == "ada@example.test"


@pytest.mark.asyncio
async def test_the_provider_role_claims_have_nowhere_to_travel() -> None:
    """🔴 `docs/PRD.md` §9: PostgreSQL owns authorization.

    `_success()` carries `role="admin"`, two `roles` and a `permissions` entry.
    Asserted against the DATACLASS and not against a value: the property is that
    `ProviderIdentity` has no field any of them could occupy, so carrying one
    would be a diff to `identity.py` that a reviewer sees, rather than this
    adapter remembering to drop them.
    """
    provider, _ = _provider(_success())

    identity = await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED}))

    assert identity is not None
    for claim in ("role", "roles", "permissions", "entitlements", "feature_flags"):
        assert not hasattr(identity, claim)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "reason",
    [
        AuthenticateWithSessionCookieFailureReason.INVALID_JWT,
        AuthenticateWithSessionCookieFailureReason.INVALID_SESSION_COOKIE,
        "a-reason-the-sdk-did-not-model",
    ],
)
async def test_every_workos_failure_reason_answers_none(
    reason: AuthenticateWithSessionCookieFailureReason | str,
) -> None:
    """An adapter that finds its own credential and judges it invalid still
    answers `None` — `provider.py` sets that contract, because the caller learns
    nothing from the difference and an attacker learns which credential shape is
    live. The bare string is in the list because `reason` is typed
    `Union[enum, str]` and `_refuse` reads `.value` off it.
    """
    provider, _ = _provider(_failure(reason))

    assert await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED})) is None


@pytest.mark.asyncio
async def test_an_impersonated_session_is_refused() -> None:
    """An administrator acting as a user would mint a seat indistinguishable
    from that person's own — same `users` row, same role — and `audit_log` would
    record their name against actions somebody else took. There is nowhere in
    `AuthenticatedSeat` to record who was really driving."""
    provider, _ = _provider(_success(impersonator={"email": "root@example.test"}))

    assert await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED})) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"organization_id": None}, id="no-organization"),
        pytest.param({"user": {"email": "ada@example.test"}}, id="no-subject"),
        pytest.param({"user": {"id": SUBJECT}}, id="no-email"),
        pytest.param({"user": None}, id="no-user"),
        pytest.param({"user": {"id": 12, "email": "ada@example.test"}}, id="numeric-subject"),
        pytest.param({"user": {"id": SUBJECT, "email": None}}, id="null-email"),
        pytest.param({"user": {"id": SUBJECT, "email": {"a": 1}}}, id="nested-email"),
    ],
)
async def test_an_incomplete_or_mistyped_session_cannot_seat_anybody(
    overrides: dict[str, Any],
) -> None:
    """A session with no organization cannot name a tenant, and a tenant is not
    something this adapter may pick a default for.

    The mistyped cases are `_string_claim`'s: a claim arriving as a number, a
    null or a nested object answers `None` here, instead of a `TypeError` three
    frames later in `ProviderIdentity.__post_init__`.
    """
    provider, _ = _provider(_success(**overrides))

    assert await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED})) is None


# ---------------------------------------------------------------------------
# 🔴 THE ONE FAILURE THAT IS NOT A REFUSAL.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_a_jwks_failure_is_503_and_not_a_denial() -> None:
    """🔴 THIS PROPAGATED UNCAUGHT AND THE DOCSTRING SAID IT WAS HANDLED.

    The SDK catches only `jwt.exceptions.InvalidTokenError`, and
    `PyJWKClientError` is a SIBLING of it rather than a subclass — both derive
    from `PyJWTError` — so a key set that will not load comes straight out of
    `session.authenticate()`. `authenticate()`'s docstring pointed at a
    `DependencyUnavailableError` handler that did not exist and
    `_UNVERIFIABLE_MESSAGE` was unreferenced.

    503 and not `None` is the whole point. `None` means "not signed in", which
    is a 401 telling a caller to present a credential — and no credential fixes
    an unreachable JWKS endpoint. A person with a perfectly good session would
    be told their session was bad, and a WorkOS outage would look like a fleet
    of expired cookies.
    """
    provider, _ = _provider(PyJWKClientError("the key set could not be fetched"))

    with pytest.raises(DependencyUnavailableError) as unavailable:
        await provider.authenticate(_Credentials(cookies={COOKIE_NAME: SEALED}))

    assert "temporarily unavailable" in str(unavailable.value)
    assert "key set" not in str(unavailable.value), (
        "the vendor's message names infrastructure and must stay in the log line"
    )


# ---------------------------------------------------------------------------
# 🔴 THE RESIDUAL, WITH A MACHINE UNDER IT.
# ---------------------------------------------------------------------------

# The variables that would let this process reach a real tenant. `TITLEPIPE_`-
# prefixed because `CoreApiSettings` reads no other spelling — the SDK's own
# `WORKOS_API_KEY` fallback is exactly what `WorkOSAuthKitProvider.__init__`
# passes both credentials explicitly to defeat.
LIVE_CREDENTIAL_VARIABLES: Final = ("TITLEPIPE_WORKOS_API_KEY", "TITLEPIPE_WORKOS_CLIENT_ID")


def test_a_live_workos_tenant_is_not_configured_here() -> None:
    """🔴 THE UNEXERCISED STATUS, AS A TEST INSTEAD OF A DOCSTRING.

    Every other test in this file replaces the SDK. None of them says anything
    about the WorkOS round trip, and a docstring saying "unexercised" decays the
    moment somebody wires a tenant and does not read it.

    This fails on that day. It is not proof the adapter works — it is proof that
    nobody has quietly started depending on it working. When it fails, the fix
    is the integration test the module docstring describes: a genuine sealed
    cookie unsealing with our password, its access token verifying against the
    tenant's JWKS, and the claims spelled the way `_identity_from` reads them.
    Then delete this test. Do not unset the variable to make it pass.
    """
    configured = [name for name in LIVE_CREDENTIAL_VARIABLES if os.environ.get(name, "").strip()]

    assert configured == [], (
        f"{configured} is set, so this process can reach a WorkOS tenant and the "
        "round trip described in auth/workos_provider.py's docstring has still "
        "never been run. Write that integration test and delete this one."
    )

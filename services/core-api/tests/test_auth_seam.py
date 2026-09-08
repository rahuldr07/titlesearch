"""The four machines that make `x-mock-role` untrustable, exercised.

`auth/seam.py` names them and three modules have cited this file by name for
weeks while it did not exist. What that bought was a chain of refusals whose
only evidence was prose; `mock_auth_guard.py` in particular read 92% covered
with the entire 401 branch uncovered, so the covered path was the pass-through
and the refusal had never run.

The numbering below is `seam.py`'s, and machine 1 is NOT here: it is
`tests/test_settings.py::test_a_deployed_environment_refuses_an_unsafe_setting`
parametrised on `mock_auth_enabled`. One fact, one home — `seam.py`'s docstring
now says which file drives which machine rather than claiming all four.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator, Mapping
from dataclasses import dataclass, field

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocket, WebSocketDisconnect

from titlepipe_core.api.mock_auth_guard import MOCK_AUTH_HEADERS, MockAuthGuardMiddleware
from titlepipe_core.auth.directory import StaticSeatDirectory, seat_key
from titlepipe_core.auth.identity import AuthenticatedSeat, ProviderIdentity
from titlepipe_core.auth.mock import (
    MOCK_ORGANIZATION,
    MOCK_PROVIDER_NAME,
    MOCK_ROLE_HEADER,
    MockHeaderProvider,
    development_seats,
)
from titlepipe_core.auth.provider import ProviderRegistry
from titlepipe_core.auth.seam import build_auth_seam
from titlepipe_core.settings import CoreApiSettings
from titlepipe_domain import Environment, TenantId

# The label the whole suite drives, and it is `reviewer` rather than `admin` on
# purpose: the seat this resolves to in `development_seats()` carries the role
# `reviewer`, so a test that asserts an `ops` role came out of the ROW cannot
# have got it from the header by coincidence.
MOCK_LABEL = "reviewer"

WEBSOCKET_PATH = "/ws/mock-role"


def _nothing() -> Mapping[str, str]:
    """An empty header or cookie map, annotated. A bare `dict` factory infers
    `dict[Unknown, Unknown]` under this repository's pyright settings."""
    return {}


@dataclass(frozen=True, slots=True)
class _Credentials:
    """A `provider.Credentials` with no request behind it.

    The protocol is two mappings, which is the whole reason it is a protocol —
    see `provider.Credentials`. Building a `Request` here would test Starlette.
    """

    headers: Mapping[str, str] = field(default_factory=_nothing)
    cookies: Mapping[str, str] = field(default_factory=_nothing)


# ---------------------------------------------------------------------------
# MACHINE 2 — the mock adapter is CONSTRUCTED only under `mock_auth_enabled`.
# ---------------------------------------------------------------------------


def test_a_seam_without_mock_auth_has_never_heard_of_the_header() -> None:
    """The registry is empty, so there is no handler check to forget.

    `seam.py`'s claim is stronger than "the header is distrusted": it is
    UNRECOGNISED. That is what an empty `names` tuple says and what a
    `providers` list of length one would not.
    """
    seam = build_auth_seam(CoreApiSettings(environment=Environment.TEST))

    assert seam.providers.names == ()
    assert seam.seats is None
    assert seam.can_authenticate is False


def test_mock_auth_builds_the_adapter_and_the_directory_together() -> None:
    """The two cannot come apart — one condition builds both.

    A configuration that can look a development seat up is exactly one that can
    produce a development identity. Asserting both sides of the `if` is what
    stops a refactor moving the directory out from under it.
    """
    seam = build_auth_seam(
        CoreApiSettings(environment=Environment.DEVELOPMENT, mock_auth_enabled=True)
    )

    assert seam.providers.names == (MOCK_PROVIDER_NAME,)
    assert seam.seats is not None


# ---------------------------------------------------------------------------
# MACHINE 3 — `MockHeaderProvider.__init__` refuses in a deployed environment.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("environment", [Environment.STAGING, Environment.PRODUCTION])
def test_the_mock_adapter_cannot_be_constructed_in_a_deployed_environment(
    environment: Environment,
) -> None:
    """The lock that holds when the other two are bypassed.

    Constructed DIRECTLY, which is the case machines 1 and 2 do not cover: a
    second composition root, a script, a test. `pytest.raises` on the
    constructor rather than on a later call is the assertion that the object
    cannot exist rather than that it declines to answer.
    """
    with pytest.raises(ValueError, match="cannot be constructed"):
        MockHeaderProvider(environment=environment)


@pytest.mark.parametrize("environment", [Environment.DEVELOPMENT, Environment.TEST])
def test_the_mock_adapter_constructs_outside_a_deployed_environment(
    environment: Environment,
) -> None:
    """The positive half, without which the refusal above proves nothing.

    A constructor that raised unconditionally would pass the test above.
    """
    assert MockHeaderProvider(environment=environment).name == MOCK_PROVIDER_NAME


# ---------------------------------------------------------------------------
# THE HEADER NAMES A SUBJECT AND NEVER A ROLE.
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_header_produces_an_identity_with_no_role_on_it() -> None:
    """`ProviderIdentity` has four fields and none of them is a role.

    Asserted against the dataclass rather than against a value, because the
    property `mock.py` claims is structural: there is no field a role could
    travel in, so carrying one would be a diff to `identity.py`.
    """
    provider = MockHeaderProvider(environment=Environment.TEST)

    identity = await provider.authenticate(_Credentials({MOCK_ROLE_HEADER: MOCK_LABEL}))

    assert identity is not None
    assert identity.subject == MOCK_LABEL
    assert not hasattr(identity, "role")


@pytest.mark.parametrize("label", ["Admin", "REVIEWER", "not-a-seat", ""])
@pytest.mark.asyncio
async def test_an_unknown_seat_label_answers_none(label: str) -> None:
    """Case included. `db/identity.py` records why casing is not forgiven, and
    `apps/web/e2e/invariants/hard.spec.ts` already asserts `Admin` is rejected in
    the browser; this is the server agreeing with it.

    `None` and not a distinguishable refusal: a caller must not learn the seat
    list by probing it.
    """
    provider = MockHeaderProvider(environment=Environment.TEST)

    assert await provider.authenticate(_Credentials({MOCK_ROLE_HEADER: label})) is None


@pytest.mark.asyncio
async def test_the_role_comes_from_the_row_and_not_from_the_header() -> None:
    """🔴 THE ASSERTION `auth/mock.py` HAS BEEN CITING THIS FILE FOR.

    A directory whose `reviewer` seat carries the role `ops`, reached by sending
    `x-mock-role: reviewer`. If the header were still an authorization claim the
    answer would be `reviewer`; it is `ops`, because the role is read off the
    seat the subject resolves to.

    This is the difference between `mock.py` being an adapter and being the old
    belief with more steps, and it is why `development_seats()`' roles matching
    its labels is a property of THAT DATA rather than of this mechanism.
    """
    identity = ProviderIdentity(
        provider=MOCK_PROVIDER_NAME,
        subject=MOCK_LABEL,
        organization=MOCK_ORGANIZATION,
        email=f"{MOCK_LABEL}@development.titlepipe.invalid",
    )
    disagreeing = StaticSeatDirectory(
        {
            seat_key(identity): AuthenticatedSeat(
                tenant_id=TenantId(uuid.uuid4()),
                user_id=uuid.uuid4(),
                role="ops",
                email=identity.email,
                identity=identity,
            )
        }
    )
    provider = MockHeaderProvider(environment=Environment.TEST)

    produced = await provider.authenticate(_Credentials({MOCK_ROLE_HEADER: MOCK_LABEL}))
    assert produced is not None
    seat = await disagreeing.find_seat(produced)

    assert seat is not None
    assert seat.role == "ops"


@pytest.mark.asyncio
async def test_the_development_directory_seats_every_label_it_advertises() -> None:
    """The positive path, which is what makes every refusal above evidence.

    A directory that seated nobody would satisfy the disagreement test as well.
    """
    seats = development_seats()
    registry = ProviderRegistry([MockHeaderProvider(environment=Environment.TEST)])
    directory = StaticSeatDirectory(seats)

    for provider_name, organization, label in seats:
        assert (provider_name, organization) == (MOCK_PROVIDER_NAME, MOCK_ORGANIZATION)
        identity = await registry.authenticate(_Credentials({MOCK_ROLE_HEADER: label}))
        assert identity is not None
        assert await directory.find_seat(identity) is not None


# ---------------------------------------------------------------------------
# MACHINE 4 — the guard refuses the header rather than ignoring it.
# ---------------------------------------------------------------------------


def _guarded_app(*, mock_auth_enabled: bool) -> FastAPI:
    """An app carrying the guard and one route of each ASGI protocol.

    Built here rather than taken from `conftest.app` because the point is the
    protocol and not the product surface: `create_app` registers no websocket
    route, and the hole below is that a route added LATER is outside nothing.
    """
    app = FastAPI()

    @app.get("/probe")
    async def probe() -> dict[str, str]:
        return {"seen": "http"}

    @app.websocket(WEBSOCKET_PATH)
    async def echo_the_role(websocket: WebSocket) -> None:
        await websocket.accept()
        await websocket.send_text(websocket.headers.get(MOCK_ROLE_HEADER, "<absent>"))
        await websocket.close()

    app.add_middleware(MockAuthGuardMiddleware, mock_auth_enabled=mock_auth_enabled)
    return app


@pytest.fixture
def guarded_client() -> Iterator[TestClient]:
    with TestClient(_guarded_app(mock_auth_enabled=False)) as client:
        yield client


def test_the_guard_refuses_an_http_request_carrying_the_header(
    guarded_client: TestClient,
) -> None:
    """401 before routing, with the specific message.

    401 and not 400: the request is well-formed and what is wrong is the
    credential, which is also `UnauthenticatedError`'s registered status. The
    message is asserted because its whole job is to be more specific than
    `require_seat`'s "Not signed in." — it distinguishes nothing about a person.
    """
    response = guarded_client.get("/probe", headers={MOCK_ROLE_HEADER: MOCK_LABEL})

    assert response.status_code == 401
    assert "does not accept mock authentication headers" in response.json()["error"]


def test_the_guard_refuses_the_capitalised_spelling(guarded_client: TestClient) -> None:
    """A guard an attacker walks past by holding the shift key is not a guard."""
    response = guarded_client.get("/probe", headers={"X-Mock-Role": MOCK_LABEL})

    assert response.status_code == 401


def test_the_guard_passes_a_request_without_the_header(guarded_client: TestClient) -> None:
    """The pass-through, so the refusals above are not a middleware that refuses
    everything."""
    assert guarded_client.get("/probe").json() == {"seen": "http"}


def test_a_mock_enabled_configuration_lets_the_header_through() -> None:
    """Only the VERDICT is configured; the middleware's presence is not."""
    with TestClient(_guarded_app(mock_auth_enabled=True)) as client:
        response = client.get("/probe", headers={MOCK_ROLE_HEADER: MOCK_LABEL})

    assert response.status_code == 200


def test_a_websocket_carrying_the_header_is_refused(guarded_client: TestClient) -> None:
    """🔴 THE HOLE: the guard tested `scope["type"] != "http"` and passed.

    A websocket handler therefore read `x-mock-role: admin` in a configuration
    where every HTTP route refuses it, which makes machine 4's "cannot reach a
    handler" a statement about one protocol rather than about the ASGI stack.
    No websocket route exists in `create_app` today, which is why this was
    theory — and exactly why it had to be closed before one does, because the
    route that opens it will not look like an auth change to its reviewer.

    Refused by closing the handshake rather than by a JSON body: there is no
    response to carry an envelope before `websocket.accept`, and a client whose
    connection is refused has learned the same thing.

    The CODE is asserted and not merely the disconnect. `WebSocketDisconnect`
    with code 1000 is a handler that accepted, said its piece and hung up, which
    is what the un-guarded route does and is indistinguishable from a refusal if
    only the exception type is checked. 1008 is the policy violation.
    """
    with (
        pytest.raises(WebSocketDisconnect) as refusal,
        guarded_client.websocket_connect(
            WEBSOCKET_PATH, headers={MOCK_ROLE_HEADER: "admin"}
        ) as socket,
    ):
        socket.receive_text()

    assert refusal.value.code == 1008


def test_a_websocket_without_the_header_still_connects(guarded_client: TestClient) -> None:
    """The pass-through for the protocol the fix touches.

    Without this, a guard that refused every websocket would pass the test
    above, and closing the hole would have broken every future websocket route
    while looking like a security fix.
    """
    with guarded_client.websocket_connect(WEBSOCKET_PATH) as socket:
        assert socket.receive_text() == "<absent>"


def test_the_guard_refuses_every_header_the_mock_adapter_reads(
    guarded_client: TestClient,
) -> None:
    """`MOCK_AUTH_HEADERS` is a set so that a SECOND mock header is refused the
    day it is added to the adapter, rather than refused by nothing.

    Driving the set rather than the one literal is what makes that true; today
    the loop runs once.
    """
    for header in MOCK_AUTH_HEADERS:
        assert guarded_client.get("/probe", headers={header: MOCK_LABEL}).status_code == 401


def test_the_guard_is_installed_by_create_app_in_every_configuration() -> None:
    """Unconditional installation is what makes machine 4 structural.

    Read off the built app's middleware stack rather than off `app.py`'s source,
    and asserted for BOTH verdicts: a configuration in which the class is absent
    is the refactor this test exists to catch.
    """
    from titlepipe_core.app import create_app

    for settings in (
        CoreApiSettings(environment=Environment.TEST, app_database_url=None),
        CoreApiSettings(
            environment=Environment.DEVELOPMENT, app_database_url=None, mock_auth_enabled=True
        ),
    ):
        app = create_app(settings)
        assert any(
            middleware.cls is MockAuthGuardMiddleware for middleware in app.user_middleware
        ), f"the guard is not installed for {settings.environment.value}"

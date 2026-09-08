"""The one dependency a router takes to require an authenticated seat.

    @router.get("/api/orders")
    async def list_orders(seat: Annotated[AuthenticatedSeat, Depends(require_seat)]) -> ...:

That is the entire public surface of this package for the API layer. A handler
receives an `AuthenticatedSeat` whose every authorization field came out of a
`users` row, or the request never reaches the handler.

`require_seat` is a FUNCTION AND NOT A MIDDLEWARE, and the two are doing
different jobs. Requiring a seat is per-route: `GET /api/rules` is the rulebook,
global and deliberately principal-free, and `/health` is a platform probe that a
load balancer calls with no credentials at all. A middleware requiring a seat
would have to carry an exemption list — which is the same decision, written
somewhere a reader of the route will not see it. What IS middleware, because it
applies to every request and must not be per-route, is the refusal of
`x-mock-role` where mock auth is off; see `api/mock_auth_guard.py`.

Raising rather than returning `None`: `api/errors.py` maps
`UnauthenticatedError` to 401 and `PermissionDeniedError` to 403, and this is
the layer discipline `CONVENTIONS.md` §6 states — nothing outside `api/` chooses
an HTTP status, and nothing inside the domain imports `HTTPException`.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from structlog.typing import FilteringBoundLogger

from titlepipe_core.auth.identity import AuthenticatedSeat
from titlepipe_core.auth.seam import AuthSeam
from titlepipe_core.telemetry.logging import get_logger
from titlepipe_domain import UnauthenticatedError

__all__ = [
    "get_auth_seam",
    "require_seat",
]

# One message for every way a request fails to become a seat. A caller must not
# be able to tell "no provider is configured" from "your session is unknown"
# from "your seat is deactivated": the first would tell an attacker which
# deployment they are probing, and the other two would confirm an account.
# The distinctions live in the log line below, bound to the same request id.
_REFUSAL_MESSAGE = "Not signed in."


def _log() -> FilteringBoundLogger:
    """Acquired at call time, never bound at import — `lifespan._log`'s rule.
    A module-level logger pins whatever logging configuration was active first
    and silently ignores a later one."""
    return get_logger(__name__)


def get_auth_seam(app: FastAPI) -> AuthSeam:
    """Read the seam off an app instance.

    Mirrors `lifespan.get_resources`, including the `RuntimeError`: an app built
    without a seam is a broken composition root, not a request that should be
    refused. Failing loudly here is the difference between "somebody deleted a
    line in `create_app`" and "every request is mysteriously unauthenticated".
    """
    seam: object = getattr(app.state, "auth", None)
    if not isinstance(seam, AuthSeam):
        raise RuntimeError("the authentication seam is not configured on this application")
    return seam


async def require_seat(request: Request) -> AuthenticatedSeat:
    """The authenticated seat for this request, or `UnauthenticatedError`.

    The request is passed to the adapter AS `Credentials` — the protocol in
    `provider.py` that `Request` satisfies structurally through its `headers`
    and `cookies` attributes. An adapter therefore cannot reach the app state,
    the sessionmaker or the body, and that is a fact about the signature rather
    than a rule somebody has to follow.

    Three refusals, one answer. The log line names which; the caller does not.
    """
    seam = get_auth_seam(request.app)

    identity = await seam.providers.authenticate(request)
    if identity is None:
        # Includes the state of every deployed configuration today: no real
        # provider adapter is installed, so the registry is empty and answers
        # `None` without asking anything. `AuthSeam.can_authenticate` is the
        # startup-time version of this same fact.
        _log().info(
            "authentication_refused",
            reason="no_provider_recognised_the_request",
            providers=seam.providers.names,
        )
        raise UnauthenticatedError(_REFUSAL_MESSAGE)

    if seam.seats is None:
        # A provider identified somebody and there is nowhere to look them up.
        # `directory.py` records why no database-backed directory exists yet;
        # this is what that costs at runtime, and it is a refusal rather than a
        # seat assembled from the identity — which would be the role-from-the-
        # wire failure this package exists to make impossible.
        _log().error(
            "authentication_refused",
            reason="no_seat_directory_is_configured",
            provider=identity.provider,
            organization=identity.organization,
        )
        raise UnauthenticatedError(_REFUSAL_MESSAGE)

    seat = await seam.seats.find_seat(identity)
    if seat is None:
        # No such organization, no such subject, or a deactivated seat. One
        # answer to the wire; `directory.SeatDirectory` says why.
        _log().info(
            "authentication_refused",
            reason="no_seat_for_identity",
            provider=identity.provider,
            organization=identity.organization,
        )
        raise UnauthenticatedError(_REFUSAL_MESSAGE)

    # `seat.role` AND NOT ANYTHING THE REQUEST SAID. The identity that got us
    # here has no role field to have said it with — see `identity.py`.
    return seat

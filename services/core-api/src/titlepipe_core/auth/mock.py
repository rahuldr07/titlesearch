"""The development header adapter — the thing `x-mock-role` is, once it is a
provider rather than a belief.

Today the browser sends `x-mock-role: reviewer` and the server believes it.
`packages/mocks` invented the header, `apps/web/src/shared/api.ts` sends it and
`apps/web/e2e/invariants/authz.spec.ts` asserts on it, so it is real product
scaffolding and deleting it would take the frontend down. This module keeps it
working and takes its authority away.

## What changes about the header here

**It no longer carries a role.** It names a SUBJECT. `x-mock-role: reviewer`
means "the demo person who holds the reviewer seat", and the role that governs
is read from that person's `users` row like everybody else's — through
`ProviderIdentity`, which has no field a role could travel in. Send
`x-mock-role: reviewer` at a seat directory whose reviewer row says `ops`, and
the request is an ops request. `tests/test_auth_seam.py` asserts exactly that,
because it is the difference between this file being an adapter and being the
old belief with more steps.

**It is refused, not ignored, where it does not belong.** See
`api/mock_auth_guard.py`. A request carrying this header at a configuration
that has no mock adapter gets a 401 before routing, rather than being quietly
downgraded to an anonymous request — which would let a client that thinks it is
authenticated keep talking to a server that does not.

## The three machines, named

1. `MockHeaderProvider.__init__` REFUSES TO CONSTRUCT when
   `environment.is_deployed`. Not a flag it reads later; the object cannot
   exist.
2. `seam.build_auth_seam` constructs one only under `settings.mock_auth_enabled`,
   so a non-mock configuration has no adapter that has ever heard of this header.
3. `CoreApiSettings._deployed_environments_refuse_unsafe_configuration` refuses
   to construct settings at all for staging or production with `mock_auth_enabled`
   set, so (2) cannot be satisfied there. The process does not start.

`seam.py` states what that chain does NOT cover. It is rooted in one environment
variable, and nothing inside this process can tell a mislabelled production box
from a laptop.
"""

from __future__ import annotations

import uuid
from typing import Final

from titlepipe_core.auth.identity import AuthenticatedSeat, ProviderIdentity
from titlepipe_core.auth.provider import Credentials
from titlepipe_core.db.identity import USER_ROLE_LABELS
from titlepipe_domain import Environment, TenantId

__all__ = [
    "MOCK_ORGANIZATION",
    "MOCK_PROVIDER_NAME",
    "MOCK_ROLE_HEADER",
    "MOCK_TENANT_ID",
    "MockHeaderProvider",
    "development_seats",
]

# Lower case, because that is how a header name is compared everywhere in this
# repository and how Starlette's `Headers` mapping keys it. The wire is
# case-insensitive; the lookup must not be the place that decides otherwise.
MOCK_ROLE_HEADER: Final = "x-mock-role"

# What lands in `users.identity_provider` for a seat admitted this way. It is a
# real value in a real column, not a sentinel: a row admitted by the mock
# adapter is distinguishable from a row admitted by a vendor forever after,
# which is what makes "find every mock seat" a query rather than an archaeology
# project on the day a vendor is adopted.
MOCK_PROVIDER_NAME: Final = "mock"

# The mock adapter's single organization. `ProviderIdentity.organization` is a
# provider's opaque handle for a customer, and the development adapter has
# exactly one customer.
MOCK_ORGANIZATION: Final = "development"

# The tenant every development seat belongs to. A FIXED value rather than a
# fresh one per process, because `apps/web/e2e-live` and any seeded database
# have to agree with this file about which tenant a mock request lands in, and
# a random id would make that agreement impossible to write down.
#
# It is a v5 UUID over a name that says what it is, so the derivation is
# reproducible from this file alone and the value is not a magic constant
# somebody has to trust.
MOCK_TENANT_ID: Final = TenantId(uuid.uuid5(uuid.NAMESPACE_DNS, "development.titlepipe.invalid"))


def _mock_user_id(role: str) -> uuid.UUID:
    """A stable user id per demo seat, derived rather than invented.

    `CONVENTIONS.md` §2 requires server-generated 128-bit UUIDs and forbids a
    database sequence; it does not require randomness, and here determinism is
    the point — a developer restarting the API must not get a new person.
    """
    return uuid.uuid5(uuid.NAMESPACE_DNS, f"{role}.development.titlepipe.invalid")


def _mock_email(role: str) -> str:
    """`.invalid` is reserved by RFC 2606 and resolves nowhere, so a demo seat's
    address cannot be mistaken for a real one or accidentally mailed."""
    return f"{role}@development.titlepipe.invalid"


class MockHeaderProvider:
    """Reads `x-mock-role` and names a demo subject. Never a role.

    Satisfies `provider.IdentityProvider`. It is a `class` and not a closure so
    that the `environment` refusal below is a constructor and not a convention.
    """

    def __init__(self, *, environment: Environment) -> None:
        """🔴 MACHINE 1 OF 3. This object cannot exist in a deployed environment.

        `seam.build_auth_seam` already will not reach here for staging or
        production, and `CoreApiSettings` already will not construct with mock
        auth enabled there. This is the third lock on the same door, and it is
        the one that holds if somebody constructs the adapter directly —
        writing a test, wiring a script, adding a second composition root —
        without going through either of the other two.
        """
        if environment.is_deployed:
            raise ValueError(
                f"the mock header provider cannot be constructed in {environment.value}; "
                "it reads a client-asserted header and there is no configuration in which "
                "that is an authentication"
            )
        self._environment = environment

    @property
    def name(self) -> str:
        return MOCK_PROVIDER_NAME

    async def authenticate(self, credentials: Credentials) -> ProviderIdentity | None:
        """A demo subject for a known seat label, or `None`.

        The label must be one of `db.identity.USER_ROLE_LABELS` EXACTLY, case
        included. `db/identity.py` records why casing is not forgiven: the
        database stores the six labels lower-case and folding the case here
        would make every authorization decision a translation rather than a
        comparison. `apps/web/e2e/invariants/hard.spec.ts` already asserts that
        `x-mock-role: Admin` is rejected, so this is the server agreeing with a
        test the browser already passes.

        An unknown label answers `None`, which the seam turns into
        `UnauthenticatedError` — the same answer as an absent header. A caller
        does not learn the seat list by probing.
        """
        label = credentials.headers.get(MOCK_ROLE_HEADER)
        if label is None or label not in USER_ROLE_LABELS:
            return None
        return ProviderIdentity(
            provider=MOCK_PROVIDER_NAME,
            # 🔴 THE SUBJECT, NOT A ROLE. There is one demo person per seat, so
            # the label and the person's handle happen to be the same string —
            # and they are the same string in the way `alice` is a username, not
            # in the way a claim is an assertion. What this request may DO is
            # read from the `users` row this subject resolves to.
            subject=label,
            organization=MOCK_ORGANIZATION,
            email=_mock_email(label),
        )


def development_seats() -> dict[tuple[str, str, str], AuthenticatedSeat]:
    """One seat per label in `USER_ROLE_LABELS`, for `StaticSeatDirectory`.

    Built from that tuple rather than from a list written here, so a seat added
    to the database enum appears in development without a second edit — and so
    the two cannot disagree about which seats exist.

    The role on each seat matches the label that finds it, which is what makes
    development behave the way a developer expects. It is a property of THIS
    DATA and not of the mechanism: `tests/test_auth_seam.py` builds a directory
    where they deliberately disagree and asserts the row wins.
    """
    return {
        (MOCK_PROVIDER_NAME, MOCK_ORGANIZATION, role): AuthenticatedSeat(
            tenant_id=MOCK_TENANT_ID,
            user_id=_mock_user_id(role),
            role=role,
            email=_mock_email(role),
            identity=ProviderIdentity(
                provider=MOCK_PROVIDER_NAME,
                subject=role,
                organization=MOCK_ORGANIZATION,
                email=_mock_email(role),
            ),
        )
        for role in USER_ROLE_LABELS
    }

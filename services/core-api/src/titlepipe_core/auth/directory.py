"""`ProviderIdentity` → `AuthenticatedSeat`. The lookup, and the half of it
that is NOT BUILT.

A provider says who someone is at the vendor. This turns that into a seat: which
tenant, which `users` row, which role. It is the step that keeps
`identity.ProviderIdentity`'s missing `role` field from mattering — the role has
to come from somewhere, and this is the somewhere.

UNPROVEN RESIDUAL — THE DATABASE-BACKED DIRECTORY DOES NOT EXIST, AND THE
   THING BLOCKING IT IS A RULING RATHER THAN AN AFTERNOON.
A real directory answers "which tenant is WorkOS organization `org_01H…`?" and
that mapping has nowhere to live yet:

1. `tenants` (`db/models.py`, migration `0001`) carries `id` and `created_at`
   and nothing else. It has no column for a provider's organization handle, and
   adding one is an edit to a table this revision does not own while three
   migrations are open in the `0030`-`0050` range.
2. The mapping must be readable BEFORE a tenant is known — it is what
   DETERMINES the tenant — so it cannot sit under the tenant policy that
   `0002` puts on everything. That is an RLS exemption, and `CONVENTIONS.md` §1
   makes every exemption a defect until somebody rules otherwise. It is not a
   detail to be decided by whoever writes the code first.

So this module ships the PROTOCOL and an in-memory implementation, and no
database implementation. What that costs is stated where it is felt:
`seam.build_auth_seam` gives a deployed environment NO directory at all, and
`dependencies.require_seat` refuses when there is none. A deployed environment
therefore authenticates nobody today. That is the correct failure — the system
has no real provider adapter either, so there is nothing to authenticate — and
it is loud, not silent: the refusal is an `UnauthenticatedError`, not an
anonymous seat.

## What the implementation will have to do, so it is not re-derived

- Resolve `(provider, organization)` to a tenant id through the mapping above.
- Open `tenant_session(sessionmaker, tenant)` — never an unscoped session — and
  select the `users` row on `(tenant_id, identity_provider, identity_subject)`,
  which `uq_users_tenant_id_identity_provider_identity_subject` makes at most
  one row.
- Treat `deactivated_at IS NOT NULL` as no seat. `db/identity.py`: "active means
  `deactivated_at IS NULL`; there is no second flag that could disagree with
  it."
- Return `None` for every miss. A caller must not be able to tell "no such
  organization" from "no such subject" from "deactivated"; the three are one
  answer to the wire and three different log lines.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

from titlepipe_core.auth.identity import AuthenticatedSeat, ProviderIdentity

__all__ = [
    "SeatDirectory",
    "StaticSeatDirectory",
    "seat_key",
]


def seat_key(identity: ProviderIdentity) -> tuple[str, str, str]:
    """The three fields a seat is found by, in the order the constraint uses.

    `(provider, organization, subject)`. `email` is deliberately absent — see
    `ProviderIdentity.email`: a person who changes their email is the same
    person, and looking a seat up by it would make that false.
    """
    return (identity.provider, identity.organization, identity.subject)


class SeatDirectory(Protocol):
    """Where a `ProviderIdentity` becomes an `AuthenticatedSeat`, or does not.

    `None` means no seat, for every reason there could be one. The caller turns
    that into a single `UnauthenticatedError`; it does not get to distinguish.
    """

    async def find_seat(self, identity: ProviderIdentity) -> AuthenticatedSeat | None: ...


class StaticSeatDirectory:
    """An in-memory directory. Development and tests only, and structurally so.

    It holds seats it was CONSTRUCTED with. There is no path by which a request
    adds one, so it cannot be tricked into minting a seat; the worst a caller
    can do is name a seat the process was started holding.

    That is not what makes it safe to exist, though — `seam.build_auth_seam` is,
    by refusing to build one outside a `mock_auth_enabled` configuration, and
    that flag by `CoreApiSettings._deployed_environments_refuse_unsafe_
    configuration`, which will not construct settings for staging or production
    with it set. See `seam.py`, which names the whole chain in one place.

    It exists because the alternative is a seam whose only demonstrated outcome
    is refusal. A test that shows a deployed configuration saying no proves
    nothing on its own — a service that refuses every request would pass it. The
    positive path is what makes the negative one evidence, and
    `apps/web/e2e-live` needs the same thing for a different reason: its premise
    is a core-api reachable from a browser before any storage exists.
    """

    def __init__(self, seats: Mapping[tuple[str, str, str], AuthenticatedSeat]) -> None:
        self._seats: dict[tuple[str, str, str], AuthenticatedSeat] = dict(seats)

    async def find_seat(self, identity: ProviderIdentity) -> AuthenticatedSeat | None:
        """The seat registered under this identity's three fields, or `None`.

        `async` to satisfy `SeatDirectory`, which is `async` because the real
        implementation runs two queries. Nothing awaits inside.
        """
        return self._seats.get(seat_key(identity))

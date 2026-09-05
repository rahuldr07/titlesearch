"""The provider-agnostic authentication seam.

Adopting an identity provider is ONE class implementing
`provider.IdentityProvider` and one branch in `seam.build_auth_seam`. No vendor
SDK is installed and no module outside this package names a vendor.

Read in this order:

- `identity.py` — `ProviderIdentity` (what a provider may assert; no role field)
  and `AuthenticatedSeat` (what a handler receives).
- `provider.py` — 🔴 the swap boundary, and the registry that bounds
  `users.identity_provider` by the set of installed adapters.
- `directory.py` — identity to seat, and the database-backed half that is NOT
  built, with what blocks it.
- `mock.py` — the `x-mock-role` adapter, and what it stopped being.
- `seam.py` — the composition root, the four machines that make the header
  untrustable, and the residual none of them cover.
- `dependencies.py` — `require_seat`, the one thing a router imports.
"""

from titlepipe_core.auth.dependencies import get_auth_seam, require_seat
from titlepipe_core.auth.directory import SeatDirectory, StaticSeatDirectory, seat_key
from titlepipe_core.auth.identity import AuthenticatedSeat, ProviderIdentity
from titlepipe_core.auth.provider import Credentials, IdentityProvider, ProviderRegistry
from titlepipe_core.auth.seam import AuthSeam, build_auth_seam

__all__ = [
    "AuthSeam",
    "AuthenticatedSeat",
    "Credentials",
    "IdentityProvider",
    "ProviderIdentity",
    "ProviderRegistry",
    "SeatDirectory",
    "StaticSeatDirectory",
    "build_auth_seam",
    "get_auth_seam",
    "require_seat",
    "seat_key",
]

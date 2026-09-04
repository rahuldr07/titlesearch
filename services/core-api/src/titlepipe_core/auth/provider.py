"""🔴 THE SWAP BOUNDARY. Adopting an identity provider is one class in here.

`IdentityProvider` is the ONE interface that has to be implemented to move this
system from the development header adapter to a real provider. Nothing above it
knows a vendor name: `dependencies.require_seat` calls a registry, the registry
calls adapters, and adapters are constructed in exactly one place —
`seam.build_auth_seam`. Adopting WorkOS AuthKit means adding
`auth/workos.py` with one class satisfying this protocol and one line in that
builder. Adopting Clerk means the same file with a different body.

THE VENDOR IS UNDECIDED AND NO SDK IS INSTALLED. `docs/PRD.md` §9 was corrected
on 2026-08-07 to WorkOS AuthKit under ADR-0001, `packages/contract/src/authz.ts`
still names Clerk in two comments, and the sign-in screen implements neither.
`pyproject.toml` deliberately carries no provider dependency; a dependency added
to an open question is how the question gets answered by accident.

## What an adapter can see, and why it is not the request

`authenticate` takes `Credentials` — headers and cookies, copied — and not a
Starlette `Request`. An adapter handed the request could read the app state, the
sessionmaker, the client address and the body; there would then be no way to say
what an adapter is allowed to depend on except by reading every adapter. The
narrow type is that statement, enforced by the signature.

`async` because a real provider needs it. WorkOS AuthKit verifies a sealed
session and may fetch JWKS; Clerk verifies a JWT against a rotating key set.
Making the protocol synchronous would mean the first real adapter changes this
interface — which is exactly what "a swap at ONE boundary" is supposed to
prevent — or blocks the event loop, which `ruff`'s ASYNC rules would catch and
somebody would then silence.

## What the registry enforces that a protocol cannot

An adapter answers with a `ProviderIdentity` carrying a `provider` string, and
that string lands in `users.identity_provider`, which is `Text` — an open set,
because the vendor is undecided (see `db/identity.py`). The bound on that column
is HERE: `authenticate` refuses an identity whose `provider` is not the name of
the adapter that produced it, so the set of values the column can ever hold is
the set of registered adapter names. `db/identity.py` promises exactly this —
"a provider name that no registered adapter claims is refused at the seam" —
and this method is the promise.

## Fail-closed by construction

A registry with no adapters authenticates nothing and answers `None` for every
request. That is the state of a deployed environment today, because no real
adapter exists yet, and it is the correct one: the alternative to "no provider
is configured, so nobody is authenticated" is a default that admits somebody.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol, runtime_checkable

from titlepipe_core.auth.identity import ProviderIdentity

__all__ = [
    "Credentials",
    "IdentityProvider",
    "ProviderRegistry",
]


class Credentials(Protocol):
    """The credential material of one request, and nothing else.

    A `Protocol` rather than a dataclass so `starlette.requests.Request`
    satisfies it structurally — both `headers` and `cookies` are
    `Mapping[str, str]` on it — and `dependencies.py` can pass the request
    through without copying, while an adapter's signature still says it may read
    only these two things. A test passes a plain object with the same two
    attributes and needs no request at all.

    Header lookup is case-insensitive on Starlette's `Headers`; an adapter that
    wants to be testable against a bare `dict` should lower-case the name it
    asks for. Every adapter in this package does.
    """

    @property
    def headers(self) -> Mapping[str, str]: ...

    @property
    def cookies(self) -> Mapping[str, str]: ...


@runtime_checkable
class IdentityProvider(Protocol):
    """🔴 IMPLEMENT THIS AND THE VENDOR IS ADOPTED. Nothing else changes.

    `name` is the adapter's own identifier and the value it must put in every
    `ProviderIdentity.provider` it returns. It is stored on the `users` row, so
    it is a permanent part of this system's data once one row exists — pick it
    for the vendor, not for the library version.

    `authenticate` returns `None` when this adapter finds no credential it
    recognises. `None` is "not my request", NOT "denied": the registry moves on
    to the next adapter, and the seam raises `UnauthenticatedError` only when
    every adapter has declined. An adapter that finds ITS OWN credential and
    judges it invalid — a bad signature, an expired session — also returns
    `None`, because the caller learns nothing from the difference and an
    attacker learns which credential shape is live.

    `runtime_checkable` so `build_auth_seam` can assert what it registered. It
    checks the presence of the members and not their signatures, which is all a
    composition root needs; pyright checks the signatures at the call site.
    """

    @property
    def name(self) -> str: ...

    async def authenticate(self, credentials: Credentials) -> ProviderIdentity | None: ...


class ProviderRegistry:
    """The adapters this process has, in the order they are asked.

    Order is a real decision once there are two: a system mid-migration between
    vendors runs both, and whichever is asked first wins for a person who holds
    a session with each. Today there is at most one.
    """

    def __init__(self, providers: Sequence[IdentityProvider] = ()) -> None:
        self._providers: tuple[IdentityProvider, ...] = tuple(providers)
        names = [provider.name for provider in self._providers]
        if len(set(names)) != len(names):
            # Two adapters answering to one name would make
            # `users.identity_provider` ambiguous: the column would no longer
            # say which code path admitted the row.
            raise ValueError(f"provider names must be unique; got {names}")

    @property
    def names(self) -> tuple[str, ...]:
        """The registered adapter names, for logging and for tests."""
        return tuple(provider.name for provider in self._providers)

    def __bool__(self) -> bool:
        """False when nothing is registered — the fail-closed state."""
        return bool(self._providers)

    async def authenticate(self, credentials: Credentials) -> ProviderIdentity | None:
        """The first adapter that recognises this request, or `None`.

        The `provider` check below is not defensive tidiness. `users
        .identity_provider` is `Text` precisely because the vendor is undecided,
        so nothing in the schema stops a row claiming `"workos"` from an adapter
        that is not WorkOS. Refusing here bounds that column by the set of names
        registered in this process, which is the only bound available while the
        column stays open.

        It raises rather than skipping. A mismatch is an adapter bug, and an
        adapter bug that quietly produced no session would look exactly like a
        person with no account.
        """
        for provider in self._providers:
            identity = await provider.authenticate(credentials)
            if identity is None:
                continue
            if identity.provider != provider.name:
                raise ValueError(
                    f"provider {provider.name!r} returned an identity claiming "
                    f"{identity.provider!r}; an adapter may only answer in its own name"
                )
            return identity
        return None

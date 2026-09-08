"""What an identity provider is allowed to say, and what a seat actually is.

Two frozen values, and the distance between them is the whole design of this
package.

`ProviderIdentity` is everything a provider — WorkOS, Clerk, or the development
header adapter — may assert. `AuthenticatedSeat` is what a handler receives.
Nothing turns the first into the second except a lookup against the `users`
table, so every authorization input a handler reads came out of PostgreSQL and
none of it came off the wire.

`ProviderIdentity` HAS NO `role` FIELD, AND THE ABSENCE IS THE MECHANISM.
`db/identity.py` states the property — "the role column is the authorization
input, and it is a column and not a claim" — and cites `docs/PRD.md` §9's
correction: "PostgreSQL owns authorization; WorkOS's own role/permission claims
are deliberately ignored". A sentence is not a machine. THIS CLASS is the
machine: a provider adapter returns a `ProviderIdentity` and there is nowhere in
one to put a role, so an adapter that wanted to assert a seat would have to
change this dataclass — a diff that shows up in review — rather than adding a
field to a dict that silently flows through.

The same holds for `tenant_id`. A provider names an ORGANIZATION, which is that
vendor's opaque handle for a customer; it does not name a tenant. Turning one
into the other is a lookup this system owns. See `directory.py` for what is and
is not built of that today.

## Why the fields are validated here rather than trusted

The three `CheckConstraint`s on `users` — `email = lower(email)`,
`length(btrim(identity_subject)) > 0`, `length(btrim(identity_provider)) > 0` —
are the authority; these are the same rules restated one call before a query, so
a provider that parses a malformed session into blanks is refused with a name
attached instead of quietly matching nothing.

A `ValueError` from `__post_init__` is a DEFECT IN AN ADAPTER, not a failed
login, and it is deliberately not a `DomainError`: an adapter that cannot
authenticate returns `None` and the seam raises `UnauthenticatedError` for it.
An adapter that returns a blank subject has a bug, and a 500 naming this file is
the honest answer to a bug.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Final

from titlepipe_domain import TenantId

__all__ = [
    "AuthenticatedSeat",
    "ProviderIdentity",
]

# Named rather than spelled inline at the four checks below, because the same
# word appears in the constraint names on `users` and a reader comparing the two
# should be comparing one string.
_BLANK: Final = ""


def _required(field_name: str, value: str) -> str:
    """A present, non-whitespace value, or a `ValueError` naming the field.

    `str.strip()` and not `bool(value)`: `" "` is the value a provider produces
    from a header that was sent empty, and `db/identity.py` records why that one
    matters more than `""` does — `tenant_session` encodes an absent tenant as
    the empty string and the policy's `nullif(…, '')` turns it into "match
    nothing", so a blank that survives this far resolves to nobody rather than
    failing. Nobody is a quieter outcome than an error and a worse one.
    """
    if value.strip() == _BLANK:
        raise ValueError(f"{field_name} must be present and non-blank")
    return value


@dataclass(frozen=True, slots=True)
class ProviderIdentity:
    """Everything a provider may assert. Deliberately four strings.

    `provider` is the adapter's own name and is checked against it by
    `ProviderRegistry` — an adapter cannot answer in another vendor's name. It
    is what lands in `users.identity_provider`.

    `subject` is the provider's opaque handle for the person. Never parsed,
    never split, never displayed. It is what lands in `users.identity_subject`.

    `organization` is the provider's opaque handle for the CUSTOMER. It is not a
    tenant id and must never be used as one; see `directory.py`.

    `email` is carried for logging and for the seat row's own record. It is NOT
    an authentication input: nothing looks a user up by it, because
    `uq_users_tenant_id_email` makes it unique per tenant while
    `(tenant_id, identity_provider, identity_subject)` is what a session
    resolves through. A provider that changes a person's email must not thereby
    change who they are.

    `slots=True` so a field cannot be attached to an instance at runtime. Without
    it, `object.__setattr__(identity, "role", "admin")` works on a frozen
    dataclass — `frozen` blocks the operator, not the function — and the
    no-role-field property above would be an inconvenience rather than a wall.
    """

    provider: str
    subject: str
    organization: str
    email: str

    def __post_init__(self) -> None:
        _required("provider", self.provider)
        _required("subject", self.subject)
        _required("organization", self.organization)
        _required("email", self.email)
        if self.email != self.email.lower():
            # `users` REFUSES a mixed-case email at the database. Raising here
            # rather than normalising: normalising would make this class the
            # second place that decides what an email is, and two normalisers
            # that drift is how `Ada@x.test` and `ada@x.test` become two rows
            # neither of which is "the seat".
            raise ValueError("email must be lowercase; the users table refuses any other form")


@dataclass(frozen=True, slots=True)
class AuthenticatedSeat:
    """One person, in one tenant, with the role that tenant's row gives them.

    This is what a handler receives and the only authorization input it may
    read. Every field except `identity` came out of a `users` row.

    `role` is a `str` holding one of `db.identity.USER_ROLE_LABELS`. It is not
    an enum here for the reason the column is a Postgres enum and not a check
    constraint: the label set is owned by the database and by
    `packages/contract/src/authz.ts`, and a third Python enum restating it would
    be a fourth statement of the same list that can drift from the other three.
    What bounds it is the column type — a row cannot hold a label the enum does
    not have, so a seat cannot carry one either.

    `identity` is kept so a log line can name the provider and subject a request
    authenticated through without a second lookup. It carries no authority.
    """

    tenant_id: TenantId
    user_id: uuid.UUID
    role: str
    email: str
    identity: ProviderIdentity

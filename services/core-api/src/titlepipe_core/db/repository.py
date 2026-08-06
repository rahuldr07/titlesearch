"""`TenantRepository` — the base every later repository is built on.

It is deliberately two methods long. What it exists to establish is not
behaviour but a SHAPE: a repository is constructed around a session that is
already tenant-scoped, so no method on it takes a tenant, and there is nowhere
for a caller to pass the wrong one. The scoping is the GUC that
`titlepipe_core.db.session.tenant_session` set and revision `0002`'s policies
read; it is not a `WHERE` clause anybody here can forget.

## `model` is a constructor parameter, not a `ClassVar`

The obvious spelling is a class attribute — `model: ClassVar[type[T]]` on the
base, overridden per subclass. **It does not typecheck, and the rule is in the
typing specification rather than in pyright's opinions:** a `ClassVar` may not
include type variables, because a class variable is shared by every
specialisation of the generic and a type variable is exactly the thing that is
not. MEASURED 2026-08-05 against pyright 1.1.411:

    class TenantRepository[T: Base]:
        model: ClassVar[type[T]]
    error: "ClassVar" type cannot include type variables (reportGeneralTypeIssues)

Passing it to `__init__` also makes the pairing checkable at the call site:
`TenantRepository(session, Order)` binds `T` to `Order` and `get` returns
`Order | None`, where a class-level attribute would have needed a subclass per
model to say the same thing.

## The `id` lookup does not use `Session.get`, and that is forced

`Session.get` takes a complete primary key, and under this schema every tenant
table's primary key is `(tenant_id, id)` — see `models._TenantRow` for the
cross-tenant existence oracle a single-column key opens. MEASURED 2026-08-05
against SQLAlchemy 2.0.51:

    session.get(Order, uuid4())
    InvalidRequestError: Incorrect number of values in identifier to formulate
    primary key for session.get(); primary key columns are
    'orders.tenant_id','orders.id'

The two-value form would require the caller to hand over a tenant, which is the
parameter this class exists not to have. A `SELECT … WHERE id = :id` is scoped to
one tenant by the policy, so the composite key is satisfied without the caller
knowing half of it.

`filter_by(id=…)` rather than `where(model.id == …)` because `T` is bound to
`Base`, and `Base` is a plain `DeclarativeBase` that declares no columns —
`models._Row`, which declares `id`, is `__abstract__` and private. `model.id` is
therefore not an attribute pyright can see on `type[T]`. `filter_by` resolves the
name against the mapper at runtime, which is a real failure and not a silent one.
MEASURED in the same session:

    select(Tenant).filter_by(nope=1)
    InvalidRequestError: Entity namespace for "tenants" has no property "nope"
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from titlepipe_core.db.models import Base
from titlepipe_core.db.session import TENANT_SCOPED_MARK

_UNSCOPED_SESSION = (
    "TenantRepository was constructed over a session that did not come from "
    "titlepipe_core.db.tenant_session, so no tenant has been established on it and "
    "nothing it reads or writes is scoped. Open the session with "
    "`async with tenant_session(sessionmaker, tenant) as session:` and build the "
    "repository inside that block."
)


class TenantRepository[T: Base]:
    """Reads and writes one mapped class through an already-scoped session.

    The session is not owned here and is never closed here. Its lifetime belongs
    to `tenant_session`, which is also what put the tenant on it; a repository
    that closed its own session would be deciding a transaction boundary on
    behalf of a caller who can see more of the unit of work than it can.
    """

    def __init__(self, session: AsyncSession, model: type[T]) -> None:
        """Refuse a session that did not come out of `tenant_session`.

        🔴 THIS CLASS USED TO *OFFER* SCOPING RATHER THAN FORCE IT. The annotation
        says `AsyncSession` and every `AsyncSession` satisfies it, including one
        called straight off an `async_sessionmaker` — which `db.__all__` exports,
        because an application builds one at startup and hands it to
        `tenant_session` per request. That session has no `after_begin` listener,
        so no tenant is ever applied to it.

        The mark is the cheapest thing that tells the two apart. `tenant_session`
        writes `TENANT_SCOPED_MARK` into `Session.info` — one dict write — and
        this is the one read. It is a WIRING check and not a security boundary:
        the security boundary is the GUC, and this cannot see the GUC without a
        round trip to the server inside a constructor that is not `async`. What it
        catches is the mistake — a repository built over the wrong session — one
        line after it is made, instead of as an empty result set or a `42501` from
        somewhere else entirely.

        `RuntimeError` and not a `DomainError`. This is a defect in how the
        application is wired, the same shape as
        `lifespan.py`'s "application resources are not configured", and a
        `DomainError` would be given an HTTP status by `api/errors.py` — turning a
        programming error into a response the caller is invited to interpret.
        """
        if TENANT_SCOPED_MARK not in session.info:
            raise RuntimeError(_UNSCOPED_SESSION)
        self._session = session
        self._model = model

    async def get(self, id_: UUID) -> T | None:
        """The row with this `id` **that the session's tenant may see**, or `None`.

        `None` covers two cases that this layer deliberately does not
        distinguish: the row does not exist, and the row exists and belongs to
        another tenant. Telling them apart is the cross-tenant existence oracle
        that `models._TenantRow`'s composite primary key was chosen to close, and
        re-opening it in the repository would undo that at the layer above.

        `id_` carries the underscore because `id` is a builtin. It is a plain
        `UUID` rather than a per-model id type; the skeleton has no such types
        yet, and inventing them here would put them in the wrong module.
        """
        rows = await self._session.scalars(select(self._model).filter_by(id=id_))
        return rows.one_or_none()

    async def add(self, entity: T) -> None:
        """Stage `entity` and FLUSH it, so a policy violation is raised here.

        The flush is the reason this is `async` at all — `Session.add` is a
        synchronous, purely in-memory operation. Without it the INSERT would not
        reach the server until `tenant_session` commits, and a row written for
        the wrong tenant would come back as `42501 new row violates row-level
        security policy` from the context manager's exit rather than from the
        call that caused it. The statement that is wrong should be the statement
        that fails.

        It does not commit. The unit of work is the `tenant_session` block, and a
        repository that committed would end a transaction its caller is still
        using.
        """
        self._session.add(entity)
        await self._session.flush()

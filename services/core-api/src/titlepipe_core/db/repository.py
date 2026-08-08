"""`TenantRepository`, the base, and the refusal both repositories are built on.

It is deliberately two methods long. What it exists to establish is not
behaviour but a SHAPE: a repository is constructed around a session that is
already tenant-scoped, so no method on it takes a tenant, and there is nowhere
for a caller to pass the wrong one. The scoping is the GUC that
`titlepipe_core.db.session.tenant_session` set and revision `0002`'s policies
read; it is not a `WHERE` clause anybody here can forget.

## `RuleRepository` IS A SIBLING, AND IT NOW LIVES IN `rules.py`

It was here until this file reached 416 lines, sixteen over the structural gate's
400-line cap — `rules.py`'s opening records the split and why the alternative was
refused. The two classes are still siblings rather than parent and child, and the
argument for that is below, because it is an argument about THIS class's meaning.

## The two classes are SIBLINGS, and `RuleRepository` does not inherit

`rules` is the one table in this schema with no tenancy at all — the ruling is
`migrations/versions/0003_rules.py`'s and is stated once there — so a global
repository is not a specialisation of a tenant one. `RuleRepository` therefore
sits beside the base rather than under it; the consequences that are the RULEBOOK's
are in its own docstring, and what is here is why the BASE does not want it.

🔴 THE PLAN'S REASON FOR THAT IS FALSE, AND SO IS THE MECHANISM ITS INJECTION
NAMES. `docs/superpowers/plans/backend/02-first-vertical-slice.md` Task 2 says a
global table inheriting the base "would either carry a meaningless tenant or
quietly filter to nothing", and asks for the inheritance to be injected on the
promise that a `tenant=None` read would then return zero rows. **The base adds no
tenant predicate of any kind** — `get` is `select(self._model).filter_by(id=id_)`
and that is the whole query — so inheritance filters NOTHING and no read changes.

MEASURED TWICE, and the second reading is the one to keep. `class
RuleRepository(TenantRepository[Rule])` with `super().__init__(session, Rule)` and
`list_all` reading `self._model`:

* 2026-08-06, against the four-test version of `test_rule_repository.py`:
  **4 passed**, whole suite **224 passed** — identical to the tree without it. The
  injection was completely inert, exactly as the paragraph above predicts;
* RE-TAKEN the same day against this tree, seven tests: **1 failed, 6 passed**,
  whole suite **1 failed, 226 passed**. BOTH POSITIVE CONTROLS STILL PASS — the
  reads are unaffected, which is the claim — and what fails is
  `test_the_refusal_diagnoses_the_caller_it_was_raised_for`, because inheriting
  makes `super().__init__` hand this class the TENANT diagnosis:

      the global repository's refusal reads "RuleRepository was constructed over a
      session that did not come from …tenant_session… Nothing it reads or writes
      is scoped: every read is filtered against a tenant that was never
      established…"

  which is false of `rules` and drops the `tenant may be None` its caller needs.

So the inheritance IS now caught, and by an honest consequence of it rather than
by the row-filtering the plan predicted. Two readings of one injection five tests
apart is also the reason this file states them both: a mutation result is a
measurement of one tree, and it goes stale when the tree moves.

## Both constructors refuse an unscoped session through ONE helper

`refuse_unscoped_session` is the check, and it is shared rather than copied. The
message it raises NAMES THE CLASS IT WAS CALLED FROM, so a third repository names
itself; the earlier text said `TenantRepository` in the middle of a sentence, and
a second class copying it with the word changed is the "shared helper
re-implemented locally" shape this repository already has on its review checklist.
The reason the check exists at all is in `TenantRepository.__init__`, once.

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

`rules.py`'s `list_all` spells its ordering `Rule.code, Rule.version, Rule.id`
instead, and that is not an inconsistency: `Rule` is a concrete mapped class rather
than a type variable, so its columns are attributes pyright can see.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from titlepipe_core.db.models import Base
from titlepipe_core.db.session import TENANT_SCOPED_MARK

# THE STEM IS SHARED AND THE CONSEQUENCE IS NOT, and the split is a correction.
#
# `{repository}` is filled from the CLASS THE CHECK WAS CALLED FROM rather than
# written into the sentence. The name used to be `TenantRepository`, spelled out,
# which is a message a second class can only reuse by copying it and changing one
# word — and a copy is what stops being edited when the reason moves.
#
# 🔴 THE FIRST ATTEMPT AT SHARING IT SHARED THE WHOLE SENTENCE, AND THE SENTENCE
# WAS ONLY TRUE OF ONE CALLER. Rendered for `TenantRepository` it read "A GLOBAL
# table does not make that milder …  `tenant` may be None" — a non sequitur for a
# tenant table, and the second clause told that caller a session established at
# the deny sentinel was a fine thing to open, which for a tenant repository is the
# state where every read is empty and every write is refused. It also DELETED the
# clause that was actionable there ("nothing it reads or writes is scoped").
# Nothing caught it: the only assertions on this message matched the substring
# `tenant_session`, which both renderings contain.
#
# So the CHECK is shared and the DIAGNOSIS is the caller's, which are separable
# things. `tests/test_rule_repository.py::test_the_refusal_diagnoses_the_caller_it
# _was_raised_for` renders both and asserts they differ in the ways that matter,
# so neither can rot back into the other.
_UNSCOPED_SESSION = (
    "{repository} was constructed over a session that did not come from "
    "titlepipe_core.db.tenant_session, so no tenant has been established on it. "
    "{consequence} Open the session with "
    "`async with tenant_session(sessionmaker, tenant) as session:` and build the "
    "repository inside that block."
)

# For a repository over a TENANT table. Both halves are actionable: an unscoped
# session sits at the deny sentinel `''`, which `nullif` turns into NULL, which no
# policy row matches — so reads come back empty and writes are refused by the same
# policy's `WITH CHECK` rather than landing anywhere wrong.
_SCOPED_TABLE_CONSEQUENCE = (
    "Nothing it reads or writes is scoped: every read is filtered against a tenant "
    "that was never established and comes back empty, and every write is refused by "
    "the policy's WITH CHECK. Name the tenant this unit of work is for."
)

# For a repository over a GLOBAL table. `tenant` may genuinely be `None` here, and
# saying so is the point: `GET /api/rules` has no principal, so a message that
# read "name a tenant" would send its caller to invent one.
_GLOBAL_TABLE_CONSEQUENCE = (
    "A GLOBAL table does not make that milder: the deny sentinel is a "
    "connection-level default and `tenant_session` is the only thing here that "
    "moves it, so a repository over any other session is the one place tenancy "
    "stops being applied. `tenant` may be None for this one — its ordinary caller "
    "has no principal and establishes none."
)


def refuse_unscoped_session(session: AsyncSession, repository: object, consequence: str) -> None:
    """Raise unless `session` carries the mark `tenant_session` writes.

    ONE helper for both classes rather than the same three lines twice. The
    reasoning — why a mark, why `RuntimeError`, why this is a WIRING check and not
    a security boundary — is in `TenantRepository.__init__`, which is where it was
    first written and where it stays.

    `consequence` is the caller's own sentence about what an unscoped session does
    to IT, because that is the half the two callers do not share; see the comment
    above `_UNSCOPED_SESSION` for the shared message that was wrong for one of
    them. The check, which is the part worth having in one place, is here.

    `repository` is the instance under construction, and only its class NAME is
    read. Passing the object rather than a string is what keeps the message
    truthful for a SUBCLASS, which is the case a literal at each call site cannot
    cover: `tests/test_rule_repository.py::test_a_subclass_of_the_base_names_itself
    _in_its_own_refusal` builds one and requires its own name back, because with
    only two call sites in the tree the object and a literal are otherwise
    indistinguishable.
    """
    if TENANT_SCOPED_MARK not in session.info:
        raise RuntimeError(
            _UNSCOPED_SESSION.format(repository=type(repository).__name__, consequence=consequence)
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

        The three lines that did it moved into `refuse_unscoped_session` when
        `RuleRepository` arrived needing the identical check. Everything above is
        still the reason it exists, and is not restated there. What does NOT move
        is the sentence: `_SCOPED_TABLE_CONSEQUENCE` is what an unscoped session
        does to a TENANT table, and a repository over a global one gets a different
        one — see the comment above `_UNSCOPED_SESSION`.
        """
        refuse_unscoped_session(session, self, _SCOPED_TABLE_CONSEQUENCE)
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

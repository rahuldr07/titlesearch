"""The rulebook's use cases.

`GET /api/rules` was a handler that opened a session, called a repository and
rendered the result — three layers in one function, which worked because there
was one endpoint. CONVENTIONS.md §10 rules on the shape the other sixty-nine
land in, and this is the first of them.

## What moved in here, and what did not

IN: the resource this reads (`rulebook`), the sentence a caller reads when the
database is not there, the tenant the session runs under, and — for the history
read — the ruling that an unknown code is a 404 rather than an empty collection.
Every one of those is a decision about the DOMAIN. None of them changes if the
transport does.

NOT IN: the status code. This raises `DomainError` subclasses and nothing here
knows a number; `api/errors.py` owns that mapping in one place, which is what
makes the same refusal read the same wherever it is raised.
`scripts/check_backend_rules.py`'s `layer-service-http` rule keeps it that way,
and it is not decoration — a service that reaches for `HTTPException` is one
that has to be re-decided when the same use case is called by a worker or a
test rather than by a route.

NOT IN EITHER: the wire. This returns MODELS. `api/mappers/rules.py` renders
them and is the only place both objects are imported.

## One transaction each

`scoped_read` opens exactly one scoped session and closes it before this method
returns. Rows are still readable afterwards because `make_sessionmaker` sets
`expire_on_commit=False`; `db/reads.py` records that and it is the property the
mapper depends on.

## Constructed per request, from the sessionmaker the lifespan opened

`None` is a legal argument and means the service was started with no database
configured. It is not checked here — `scoped_read` makes that call with the
resource name in hand so the log line names what was being read, and
`api/dependencies.py` records why the dependency passes it through rather than
refusing it earlier.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from titlepipe_core.db.models import Rule
from titlepipe_core.db.reads import scoped_read
from titlepipe_core.db.repositories.rules import RuleRepository
from titlepipe_domain import NotFoundError

_RESOURCE = "rulebook"
_UNAVAILABLE_MESSAGE = "The rulebook is temporarily unavailable. Try again shortly."


class RuleService:
    """Reads of the rulebook, which is the one table outside tenancy."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None) -> None:
        self._session_factory = session_factory

    async def list_rules(self) -> Sequence[Rule]:
        """Every rule, every status, in `RuleRepository.list_all`'s order.

        NOTHING FILTERS ON READ. A `pending` rule is VISIBLE to everyone and only
        an engineer may confirm one — the owner ruled on that, and CLAUDE.md's
        "PENDING rules cannot affect the pipeline" is about EFFECT, not
        visibility. Hiding one here would be this layer inventing a rule the
        rulebook does not have.

        The ORDER is `RuleRepository.list_all`'s and is not re-imposed here or in
        the mapper; that repository's docstring calls it a wire-stability
        decision and owns it.

        `tenant=None` is passed EXPLICITLY and is not a default. `db/reads.py`
        records why the parameter has none: `None` means the session runs at the
        DENY floor and reads the one table that floor does not cover. It is the
        right argument for a global table and the wrong one for the sixty-nine
        tenant-scoped reads that follow, so it must not be the value anybody gets
        by forgetting.
        """
        return await scoped_read(
            self._session_factory,
            resource=_RESOURCE,
            unavailable_message=_UNAVAILABLE_MESSAGE,
            tenant=None,
            read=lambda session: RuleRepository(session).list_all(),
        )

    async def rule_history(self, code: str) -> Sequence[Rule]:
        """One code's versions, oldest first, every status.

        **THE 404 IS DECIDED HERE AND NOWHERE BELOW.**
        `RuleRepository.history_for` returns an empty sequence for a code it does
        not know and refuses to call that an error, because whether "no rows" is
        a missing RESOURCE or an empty COLLECTION is a question about the URL and
        `db/` cannot see one. It is not a question about the URL's SYNTAX either,
        which is why the answer is not the router's: `/api/rules/{code}` names
        one rule, and a code the rulebook has never carried is not a rule with no
        versions. Serving `{"code": "R99", "versions": []}` with a 200 would tell
        a caller checking whether a rule exists that it does, and there is no
        other read that would correct them.

        Contrast `list_rules`, whose empty answer is a 200 and is right to be:
        that URL names the collection itself, which exists and happens to be
        empty.

        `NotFoundError` and not a status code. This layer may not import
        `fastapi` and does not know what 404 is; `api/errors.py` maps the refusal
        onto the one envelope, with a `NOT_FOUND` code the caller can branch on.
        The message names the code that was asked for and nothing else: it is
        client-safe by contract, and the code is already in the caller's own URL.

        **THE REFUSAL IS OUTSIDE `scoped_read`.** A 404 is an answer about the
        data, not a database failure, and raising it inside `read` would run it
        under that function's `except SQLAlchemyError` — which does not catch a
        `DomainError` today and would swallow this refusal into a 503 the first
        time anyone widened it. The check needs the rows and nothing else, so it
        costs nothing to make after the session has closed.

        `tenant=None` for `list_rules`'s reason: the rulebook is global and the
        session sits at the DENY floor, reading the one table that floor does not
        cover.
        """
        rows = await scoped_read(
            self._session_factory,
            resource=_RESOURCE,
            unavailable_message=_UNAVAILABLE_MESSAGE,
            tenant=None,
            read=lambda session: RuleRepository(session).history_for(code),
        )
        if not rows:
            raise NotFoundError(f"No rule is carried under the code {code!r}.")
        return rows

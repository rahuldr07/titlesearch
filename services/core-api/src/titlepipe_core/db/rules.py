"""`RuleRepository` — the rulebook, which is the one table outside tenancy.

🔴 IT LIVED IN `repository.py` UNTIL THAT FILE HIT 416 LINES, sixteen over
`scripts/check_backend_rules.py`'s rule-6 cap, and the cheap way out was a
`rules-allow-file(file-length)` on the module that owns the tenancy check. That is
the same trade `engine.py` was split out of `session.py` to avoid on 2026-08-06,
recorded in both of their openings, and it is refused here for the same reason: a
cap that is exempted on the files that grow is not a cap.

**No caller's import line changed.** `titlepipe_core.db` re-exports
`RuleRepository`, so `from titlepipe_core.db import RuleRepository` reads
identically on both sides of the split.

ONE NAME CROSSES THE BOUNDARY: `repository.refuse_unscoped_session`, which is
public for exactly this reason — the underscore came off when a second module
needed it, as `DENY_SENTINEL_OPTIONS`'s did when `migrations/env.py` did. Nothing
else moves. `_GLOBAL_TABLE_CONSEQUENCE` below is this module's own sentence about
its own table, and keeping it here is the point of that helper taking the
consequence as an argument rather than choosing one.

## The reader who wondered why this is not a subclass

`repository.py` argues that at length — including why the plan's stated reason for
the same conclusion is false, and the two readings of the injection that tests it.
The short of it: `rules` carries no tenancy at all, the base adds no predicate, so
the objection to inheriting is about what the type CLAIMS rather than about what
any query does. The class docstring below carries the consequences that are this
table's.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from titlepipe_core.db.models import Rule
from titlepipe_core.db.repository import refuse_unscoped_session

# For a repository over a GLOBAL table. `tenant` may genuinely be `None` here, and
# saying so is the point: `GET /api/rules` has no principal, so a message that
# read "name a tenant" would send its caller to invent one. It is the caller's
# sentence and lives with the caller; `repository.py` holds the tenant one and the
# shared stem, and the comment above that stem records the rendering that was
# wrong for one of its two callers.
_GLOBAL_TABLE_CONSEQUENCE = (
    "A GLOBAL table does not make that milder: the deny sentinel is a "
    "connection-level default and `tenant_session` is the only thing here that "
    "moves it, so a repository over any other session is the one place tenancy "
    "stops being applied. `tenant` may be None for this one — its ordinary caller "
    "has no principal and establishes none."
)


class RuleRepository:
    """The rulebook, read whole. **NOT a `TenantRepository`, and not generic.**

    ## Why it does not inherit — the claim, not the query

    `rules` carries no `tenant_id`, no policy and no RLS; the ruling and its
    consequences are stated once, in `migrations/versions/0003_rules.py`. The base
    above exists to make tenant scoping unforgettable, and inheriting it here would
    say — in the type — that this table is scoped like the other seven when nothing
    scopes it at all.

    That is a claim about MEANING, and it is the only argument available, because
    the base changes no behaviour a global table would notice: it adds no
    predicate, and the module docstring records the measurement of inheriting it
    anyway. Two things follow, and they are why the distinction is worth keeping
    rather than a purity argument:

    * the obvious hardening of the base — a `WHERE tenant_id = …` belt to go with
      the policy's braces — is one edit away, and on that day every global read
      through an inheriting `RuleRepository` starts returning nothing, silently,
      with a blank rulebook screen and no error naming a filter;
    * `TenantRepository.get` returns `None` for "no such row" AND for "another
      tenant's row" *deliberately*, to keep a cross-tenant existence oracle shut.
      On a table with no tenants that contract is not merely unnecessary, it is
      describing a distinction that does not exist.

    `tests/test_rule_repository.py::test_the_rulebook_is_the_same_complete_set_under_a_real_tenant`
    is what actually fails the day somebody gives this table a policy or a
    `tenant_id`, and it is a stronger check than the inheritance question, because
    it reads rows rather than a class hierarchy.

    ## It still takes a session from `tenant_session`, and the refusal is enforced

    Global data does not mean an un-scoped connection. The tenant is a
    connection-level default that `tenant_session` is the only thing here to move
    — see `session.py` — so a repository holding a session from anywhere else is
    the one place tenancy stops being applied, whatever table it happens to read.
    `_refuse_unscoped_session` is the same check `TenantRepository` makes, shared
    rather than copied. `tenant=None` is a legal and ordinary argument to
    `tenant_session`, and is what `GET /api/rules` will pass: it has no principal.

    ## Concrete, and not `GlobalRepository[T]`

    There is exactly one global table. A generic base over a set of size one is a
    guess about the shape of a second member, made before it exists — and this
    package has already paid for one of those (`ISOLATION_GLOBAL_TABLE` as a
    single `str` in `tests/conftest.py`, which could not express a second name
    without somebody changing its type). The difference is that a `frozenset` of
    one costs nothing to widen, whereas a generic base commits every later table
    to this one's shape. When a second arrives, the shape is known.
    """

    def __init__(self, session: AsyncSession) -> None:
        """Refuse a session that did not come out of `tenant_session`.

        No `model` parameter, unlike the base: this class reads exactly one table,
        so there is no pairing for a caller to get wrong and nothing for a type
        variable to bind. `TenantRepository`'s `model` argument exists because it
        is generic over seven tables.
        """
        refuse_unscoped_session(session, self, _GLOBAL_TABLE_CONSEQUENCE)
        self._session = session

    async def list_all(self) -> Sequence[Rule]:
        """Every rule, every status, in a TOTAL order.

        **NOTHING FILTERS ON READ, AND THAT IS THE OWNER'S RULING.** A `pending`
        rule is VISIBLE to everyone; only an engineer may CONFIRM one. CLAUDE.md's
        "PENDING rules cannot affect the pipeline" is about EFFECT, not
        visibility, and `packages/mocks/src/handlers.ts:1407` serves the same
        unfiltered store today. A `filter_by(status="live")` here would empty the
        rulebook screen of the rows a reviewer is meant to act on;
        `tests/test_rule_repository.py` asserts the `pending` row back BY NAME, so
        one appearing fails by naming the row it hid rather than by a count.

        Filtering is the CALLER'S, and `GET /api/rules` does none — the two live
        consumers (`apps/web-v2/src/features/rulebook/queries.ts`,
        `features/escalations/queries.ts`) take the whole set.

        **THE ORDERING IS A WIRE-STABILITY DECISION AND NOT A DOMAIN ONE.** An
        unqualified `SELECT` has no guaranteed order in PostgreSQL, so a response
        body built from one is reproducible only by luck — and Task 3's
        contract-parity fixture and Task 4's response both need the same bytes
        twice. The rulebook has NO inherent order: if the product ever wants one
        (by jurisdiction, by status, most-recently-confirmed first) that is a
        product decision and it replaces this line rather than being layered on it.

        ---------------------------------------------------------------------
        🔴 IT WAS `ORDER BY code` ALONE, AND `code` IS NOT UNIQUE. That version of
           this paragraph said "`code` because it is the one column that is unique
           per rule", and rested Tasks 3 and 4 on it.
        ---------------------------------------------------------------------
        `migrations/versions/0003_rules.py` creates this table with
        `sa.PrimaryKeyConstraint("id")` AND NOTHING ELSE — no unique constraint and
        no index on `code` — and the table carries a `version` column, so `R13 v1`
        and `R13 v2` as two rows is the shape the schema is built for. Rows sharing
        a `code` therefore come back in whatever order the scan produces, which is
        not a stable property of the data: an `UPDATE` writes a NEW heap tuple and
        the old one is left dead, so a row that is merely touched moves to the end
        of an unordered read. MEASURED at review, 2026-08-06 — three rows with
        `code = 'R13'`, versions 1/2/3, then `UPDATE rules SET version = version`
        on one of them:

            before -> ['first', 'second', 'third']
            after  -> ['second', 'third', 'first']

        The response bytes moved because a row was updated. `tests/test_rule
        _repository.py` now seeds rows that SHARE a code, and shares a `(code,
        version)` too, so the two tiebreaks below are observable rather than
        decorative — with three distinct codes the seed could not tell this
        ordering from `ORDER BY code`.

        `id` LAST IS WHAT MAKES IT TOTAL. `code` and `version` are both non-unique
        on today's schema, and `id` is the primary key, so no two rows can tie on
        all three. Any order is acceptable to the wire; the same order twice is not
        optional.

        🔴 OPEN ITEM FOR PLAN 05, WHERE RULE WRITES LAND: should `rules` carry
        `UNIQUE (code, version)`? It is probably the right schema and it is a
        DOMAIN question — whether two rows may share a code and a version is a
        rulebook rule, and this repository does not resolve one without a ruling.
        It is deliberately NOT added here, and this ordering does not assume it:
        the `id` tiebreak is what makes the order total on the schema that exists
        rather than on the constraint somebody might add.

        A `Sequence[Rule]`, which is what `ScalarResult.all()` returns, rather
        than a `list` copied out of it. The caller reads it and serialises it.

        THE READ GOES THROUGH `self._session` AND THAT IS THE POINT OF THE CLASS.
        `__init__`'s check is construction-time and cannot see this line; a method
        that opened its own session off the same engine would satisfy every
        assertion about globality and be exactly the "repository that opens its own
        connection" the plan forbids. What holds it is
        `test_the_rulebook_comes_back_whole_under_a_session_with_no_tenant`, which
        asserts the returned rows are in the SCOPED session's identity map.
        """
        rules = await self._session.scalars(select(Rule).order_by(Rule.code, Rule.version, Rule.id))
        return rules.all()

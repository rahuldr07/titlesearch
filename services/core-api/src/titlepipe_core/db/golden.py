"""`GoldenRepository` — the ingest path for ground truth, and the ORDER it must write in.

---------------------------------------------------------------------------
🔴 THE REFUSALS ARE NOT HERE, AND LOOKING FOR THEM HERE IS THE MISTAKE THIS
   DOCSTRING EXISTS TO PREVENT.
---------------------------------------------------------------------------
"A golden correction needs a source, a reason and a signature", "the two NA
states never collapse", "an affirmation leaves the value alone", "a signer is
never an engine and never `unknown`" — every one of those is a CHECK constraint
created by `migrations/versions/0070_golden_fields.py` and `0071`, and the change
to a golden value is refused by `0072`'s trigger unless a signed ledger row
describes it. `tests/test_golden_set.py` drives each of them by issuing the
statement and reading the SQLSTATE and the constraint name back.

**Re-implementing any of them in Python here would give one rule two homes**,
and the copy in the weaker home is the one that goes stale. What this class does
instead is make the required things NON-OPTIONAL PARAMETERS — there is no
`reason: str | None = None` on any signature below, so a caller cannot omit one
and find out at the database — and then let the database be the machine.

## What this class DOES do, which no constraint can

**IT WRITES THE TWO ROWS IN THE ONE ORDER THAT WORKS.** `0072`'s trigger fires on
the UPDATE of `golden_fields` and looks for a `golden_corrections` row describing
exactly that transition. The ledger row therefore has to reach the server FIRST,
and inside the same transaction, so the trigger's `SELECT` sees the
transaction's own uncommitted write. Two explicit `flush()` calls are what make
that ordering real: SQLAlchemy's unit of work is free to order one flush's
statements as it likes, and "INSERTs happen before UPDATEs" is an implementation
detail rather than a promise.

**IT NEVER COMMITS.** The unit of work is the `tenant_session` block, exactly as
`TenantRepository` records — a repository that committed would end a transaction
its caller is still using, and here that would also split the ledger row from the
move it authorises into two transactions, which is the one arrangement the
trigger cannot see across.

## The tenant is a PARAMETER on the write path, and the policy is what checks it

`TenantRepository`'s reads need no tenant: the GUC `tenant_session` set is what
filters them, and there is nowhere for a caller to pass the wrong one. A WRITE is
different — the row has to carry a `tenant_id` — and this class does not invent
one. `session.info` deliberately does NOT hold the id (`db/session.py`: storing
it would be a second, un-enforced answer to "which tenant is this?" when the
answer that governs is the GUC on the connection), so the caller states it.

**THE MACHINE THAT MAKES THAT SAFE IS THE POLICY, NOT THIS CLASS.** A policy with
no `WITH CHECK` uses its `USING` expression for one, so `0070`'s
`tenant_isolation` refuses an INSERT carrying any other tenant's id with
`42501 new row violates row-level security policy` — at the `flush()` inside
`add`, which is the statement that caused it. `TenantRepository.add` already
records that, and it is why `add` flushes at all.

## It IS a subclass, where `RuleRepository` is a sibling

`RuleRepository` sits beside `TenantRepository` because `rules` is global and a
global repository is not a specialisation of a tenant one. `golden_fields` is
tenant-scoped, so this is an ordinary specialisation: `get` and `add` mean here
exactly what they mean on the base, and the unscoped-session refusal it inherits
carries the tenant diagnosis, which is the true one for this table.
"""

from __future__ import annotations

from uuid import UUID

# `AsyncSession` is imported for the annotation only; the session itself comes
# from `tenant_session` and is never built here.
from sqlalchemy.ext.asyncio import AsyncSession

from titlepipe_core.db.golden_models import GoldenCorrection, GoldenField
from titlepipe_core.db.repository import TenantRepository


class GoldenRepository(TenantRepository[GoldenField]):
    """Establishes golden fields, and records the acts that move them.

    Constructed around a session that is already tenant-scoped. Its READS take no
    tenant — the GUC is what filters them — and `establish` takes one because a
    new row must carry it; `0070`'s policy is what refuses a wrong one. See the
    module docstring.
    """

    def __init__(self, session: AsyncSession) -> None:
        """The base's constructor, with this class's model bound.

        No `model` parameter, unlike the base's own signature: this class reads
        and writes exactly two tables and neither is a caller's choice.
        """
        super().__init__(session, GoldenField)

    async def establish(
        self,
        *,
        tenant_id: UUID,
        order_id: UUID,
        path: str,
        value: str | None,
        na_reason: str | None,
        tag: str,
        source_citation: str,
        established_by: str,
        established_reason: str,
    ) -> GoldenField:
        """One new ground truth, at revision 0.

        🔴 `value` AND `na_reason` ARE BOTH REQUIRED KEYWORD ARGUMENTS WITH NO
        DEFAULTS, and that is the one piece of shape this method contributes.
        Exactly one of them is present in every row —
        `ck_golden_fields_value_xor_na_reason` — and a signature with
        `value: str | None = None` would let a caller write neither by writing
        nothing, which is the "somebody started establishing this and stopped"
        row the constraint exists to make unstorable. Making both explicit means
        the caller states which kind of truth this is.

        `established_by` is a parameter and not a lookup, and the SESSION-DERIVED
        SIGNER IT SHOULD COME FROM DOES NOT EXIST IN ANY BUILD — PLAN §5 records
        that plainly, and this docstring is not going to imply otherwise. What is
        landed is the negative half: `ck_golden_fields_established_by_is_signed`
        refuses `unknown` and blank, and
        `ck_golden_fields_established_by_is_not_an_engine` refuses the engine
        namespace, so the two spellings that identify nobody and identify a
        machine cannot be stored whatever the caller passes. Resolving a real
        subject from a real session is another card's.

        `revision` is not a parameter: a new truth is at 0 by definition, and the
        model carries both a Python-side default and `0070`'s `server_default` —
        the Python one so the ORM sends the value and the attribute is populated
        without a second round trip, the server one so a raw INSERT (the test
        seed, a future migration) gets it too.

        `tenant_id` and `order_id` are plain `UUID`s rather than per-model id
        types: this package has none yet and inventing them here would put them
        in the wrong module. What refuses a wrong pairing is not the annotation
        but the composite foreign key
        `fk_golden_fields_tenant_id_order_id_orders`, which has no referent for
        an order belonging to somebody else — and, before that, the policy, for a
        `tenant_id` that is not the session's.
        """
        field = GoldenField(
            tenant_id=tenant_id,
            order_id=order_id,
            path=path,
            value=value,
            na_reason=na_reason,
            tag=tag,
            source_citation=source_citation,
            established_by=established_by,
            established_reason=established_reason,
        )
        await self.add(field)
        return field

    async def record_act(
        self,
        field: GoldenField,
        *,
        act: str,
        signed_by: str,
        reason: str,
        source_citation: str,
        value: str | None,
        na_reason: str | None,
        tag: str,
    ) -> GoldenCorrection:
        """The ledger row, then the move it authorises — in that order, one transaction.

        ---------------------------------------------------------------------------
        🔴 THE TWO `flush()` CALLS ARE THE METHOD. Everything else here is field
           copying.
        ---------------------------------------------------------------------------
        `0072`'s trigger fires on the UPDATE and requires a `golden_corrections`
        row matching the whole transition — tag, value and `na_reason` on both
        sides, the citation, and the revision. The ledger row must therefore have
        reached the server before the UPDATE does, and must be in the SAME
        transaction, because the trigger's `SELECT` sees this transaction's
        uncommitted write and nobody else's.

        One flush would leave the order to SQLAlchemy's unit of work. It happens
        to emit INSERTs before UPDATEs, and that is an implementation detail
        rather than a promise — a promise is what two flushes are.

        **THE `act` VOCABULARY IS THE DATABASE'S, NOT THIS METHOD'S.** `correct`,
        `confirm` and `demote`, and there is no fourth. A `promote_from_reading`
        would have to be added to `golden_act` in a migration, which is where
        somebody would have to argue for it.

        **WHAT IS NOT CHECKED HERE, ON PURPOSE:** that a `confirm` lands on
        `ruled`, that a `demote` lands on `suspect`, that an affirmation leaves
        the value alone, that a correction moves it, that the signer is neither
        blank nor `unknown` nor an engine, and that `revision` advances by exactly
        one. All seven are constraints or the trigger, all seven are driven in
        `tests/test_golden_set.py`, and a Python copy of any of them would be a
        second home for one rule.

        Returns the ledger row rather than the field, because the ledger row is
        the thing that is new and permanent; `field` is mutated in place and is
        the caller's already.
        """
        correction = GoldenCorrection(
            tenant_id=field.tenant_id,
            golden_field_id=field.id,
            act=act,
            signed_by=signed_by,
            reason=reason,
            source_citation=source_citation,
            tag_before=field.tag,
            tag_after=tag,
            value_before=field.value,
            na_reason_before=field.na_reason,
            value_after=value,
            na_reason_after=na_reason,
            revision_after=field.revision + 1,
        )
        self._session.add(correction)
        await self._session.flush()

        field.value = value
        field.na_reason = na_reason
        field.tag = tag
        field.source_citation = source_citation
        field.revision = field.revision + 1
        await self._session.flush()

        return correction

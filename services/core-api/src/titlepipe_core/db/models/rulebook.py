"""`rules` — the rulebook. **THE ONE GLOBAL TABLE IN THIS PACKAGE.**

It is its own module and not a section of another one because of what it is NOT:
every other table here is a `_TenantRow`, and a global table sharing a file with
tenant-scoped ones is how a reader comes to read a missing `tenant_id` as an
oversight. CONVENTIONS §1 puts the same rule on the layer above — a global
table's repository is a SIBLING of the tenant-scoped ones, never a subclass — and
the module boundary here is that rule expressed one layer down.

The enum types this table's columns use, `rule_status` and `rule_origin`, live in
`enums.py` with every other type in the package.
"""

from __future__ import annotations

from sqlalchemy import Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models.base import _Row
from titlepipe_core.db.models.enums import RULE_ORIGIN, RULE_STATUS


class Rule(_Row):
    """One rulebook entry. **GLOBAL, and therefore `_Row` rather than `_TenantRow`.**

    🔴 THE MISSING `tenant_id` IS THE RULING, NOT THE OMISSION `_TenantRow`
    DESCRIBES. **THE RULING AND ITS CONSEQUENCES ARE STATED ONCE**, in
    `migrations/versions/0003_rules.py`'s module docstring — the frozen record of
    the decision — and this docstring cites it rather than restating it. It was
    written out in full here, in `0003`, in `tests/conftest.py` and in
    `tests/test_forced_rls_and_grants.py`; `01-WHAT-HAPPENED.md` §3.5 records what
    four copies of one reason cost when two of them drifted apart, and the rule
    that a reason lives in one place is that section's.

    WHAT IS LOCAL TO THIS FILE, and is therefore all that is left here:

    `PRIMARY KEY (id)` ALONE, inherited from `_Row`, and it is NOT the key
    `_TenantRow` measures an existence oracle for. That oracle exists because
    unique enforcement runs before a policy's `WITH CHECK`, so an insert answers
    "does this id exist in another tenant?" to a caller who cannot read the row.
    There is no other tenant here and no policy at all, so there is nothing to
    prefix `id` with and nothing for a composite key to close.

    **`created_at` IS HERE AND IS NOT ON THE WIRE**, a deliberate divergence from
    the nine columns `packages/contract/src/entities.ts:153-163` lists: every
    other table in this file carries it, and the response shape is the router's to
    choose rather than the schema's to dictate.

    **`status` HOLDS EVERY VALUE INCLUDING `pending`, AND NOTHING FILTERS ON
    READ.** Ruled by the owner: a PENDING rule is VISIBLE to everyone and only an
    engineer may confirm one. CLAUDE.md's "PENDING rules cannot affect the
    pipeline" is about EFFECT, not visibility.

    `Text` and not `String(n)`: nothing in the contract bounds any of these, and a
    length nobody chose is a migration the first time a rule outgrows it. The
    three nullable columns mean three different absences — no jurisdiction
    narrowing, nobody has confirmed it, no source document — none expressible as
    an empty string without inventing a fourth state.
    """

    __tablename__ = "rules"

    code: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    origin: Mapped[str] = mapped_column(RULE_ORIGIN, nullable=False)
    status: Mapped[str] = mapped_column(RULE_STATUS, nullable=False)
    jurisdiction_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmed_by: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_doc_ref: Mapped[str | None] = mapped_column(Text, nullable=True)

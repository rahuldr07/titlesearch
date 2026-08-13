"""`GET /api/rules` on the wire — the first shape Pydantic is authoritative for.

Every declaration below is answerable to `packages/contract/src/entities.ts:153-163`
and `enums.ts:72-81`. That file is the browser's runtime parser and it is not going
away, so a divergence here is not a "backend detail": it is a response the frontend
refuses at the boundary, in production, with no type error anywhere to have caught
it. The three things it can refuse over are field NAMES, ENUM SPELLINGS and
NULLABILITY, and each has a paragraph below because each has a different failure.

## Nullable is not optional, and Pydantic's ergonomic default gets it wrong

Zod's `.nullable()` requires the key to be **PRESENT** and permits it to be `null`.
`.optional()` — which the contract uses elsewhere, e.g. `Field.asking` — permits it
to be ABSENT. `Rule` uses `.nullable()` on all three of its nullable columns, so a
response that omits `source_doc_ref` is rejected by Zod with
`expected string, received undefined`.

The idiomatic Python for a nullable field is `str | None = None`, and it is the
wrong spelling here: the `= None` makes the field OPTIONAL ON INPUT, and one
`exclude_defaults`/`exclude_none` anywhere on the serialisation path then drops the
key entirely. **The fields below carry no default for exactly that reason** — they
are required-and-nullable, which is what `.nullable()` means, and a caller that
forgets one gets a validation error instead of a silently absent key.

## The enum spellings are written out, not derived

`db/models.RULE_STATUS_LABELS` and `RULE_ORIGIN_LABELS` hold the same strings, and
importing them here would make this module's claim "the wire matches the storage",
which is not the claim that needs proving. The literals below are transcribed from
`packages/contract/src/enums.ts:72-81` — the other author's document — and
`tests/test_rules_contract_parity.py` asserts storage and wire agree as a separate
question. `01-WHAT-HAPPENED.md` §5 records what comparing a value to something
derived from the same source has cost this repository five times.

## `RulesResponse` wraps, and the wrapper is the contract

`endpoints.ts:621` is `z.object({ rules: z.array(Rule) })`. A bare array is a
different document and Zod rejects it.

## `created_at` is on the row and is not on the wire

`db/models.Rule` carries it; the contract's nine fields do not include it. Zod
strips unknown keys rather than refusing them, so an accidental tenth field is
invisible to `RulesResponse.parse` — the TypeScript gate has to assert the key set
explicitly, and it does. On this side `extra="forbid"` closes the same door from
the other direction.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from titlepipe_core.db.models import Rule as RuleRow

# Transcribed from `packages/contract/src/enums.ts:72-81`. See the module
# docstring for why these are not imported from `db/models.py`.
RuleStatus = Literal["live", "pending", "retired"]
RuleOrigin = Literal["spec", "escalation", "reconciliation", "complaint", "senior"]


class RuleResponse(BaseModel):
    """One rulebook entry, in the nine fields `Rule` parses and no more.

    `from_attributes` is what lets `model_validate` read a `db.models.Rule`
    directly. It reads DECLARED fields only, so `created_at` is dropped by the
    same mechanism that maps the rest — not by a caller remembering to omit it.

    `id` is a `UUID` and not a `str`: the column is `UUID(as_uuid=True)`, the
    contract is `z.string()`, and Pydantic's JSON serialiser renders a UUID as its
    canonical lowercase string. Typing it `str` would push the conversion onto
    every caller and would refuse the row object outright.

    **The four `str` fields are not `Field(...)`-annotated** unlike `health.py`'s,
    which describes each of its two. Those two are a platform surface with no other
    document; these nine are specified in `entities.ts` and a `description=` here
    would be a second copy of that specification, free to drift.
    """

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: UUID
    code: str
    # A field NAMED `text`, honestly. `scripts/check_backend_rules.py`'s `raw-sql`
    # rule bans the sqlalchemy CALL and is deliberately silent on an attribute or a
    # field of this name — verified clean, exit 0, against this file. Renaming a
    # contract field to please a gate would be the defect.
    text: str
    origin: RuleOrigin
    status: RuleStatus
    # No `= None` on any of the three. See the module docstring: a default here is
    # what turns a `.nullable()` key into an `.optional()` one.
    jurisdiction_scope: str | None
    version: int
    confirmed_by: str | None
    source_doc_ref: str | None


class RulesResponse(BaseModel):
    """The whole rulebook, wrapped. `endpoints.ts:621`."""

    model_config = ConfigDict(extra="forbid")

    rules: list[RuleResponse]

    @classmethod
    def from_rows(cls, rows: Iterable[RuleRow]) -> RulesResponse:
        """Map storage rows onto the wire, preserving the order they arrive in.

        `RuleRepository.list_all` orders by `(code, version, id)` and calls that a
        wire-stability decision rather than a domain one; this method must not
        re-sort, or that decision moves here and the repository's docstring becomes
        false. A `list` comprehension preserves the sequence exactly.

        `model_validate` rather than field-by-field construction: the row's
        `origin`/`status` are `Mapped[str]` and the fields above are `Literal`s, so
        this is the one place a label that is in the database enum but not in the
        contract's is caught — as a `ValidationError`, at the boundary, rather than
        as a response the browser rejects.
        """
        return cls(rules=[RuleResponse.model_validate(row) for row in rows])

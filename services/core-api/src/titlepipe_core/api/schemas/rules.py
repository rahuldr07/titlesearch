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

## These are DTOs and nothing here knows what a storage row looks like

🔴 `from_rows` LIVED ON BOTH ENVELOPES AND MOVED OUT ON 2026-09-05, to
`api/mappers/rules.py`, along with this module's import of `db.models.Rule`.
`CONVENTIONS.md` §10 makes the mapper the ONLY place a model and a DTO are
imported together, and a classmethod here was the counter-example: it put the
model-to-DTO step inside the wire declaration, where the two questions "what
does the contract say" and "how do we produce it" answer to each other instead
of to `entities.ts` and to the row. Everything the two methods argued survives,
in the mapper, next to the code it constrains.

## `created_at` is on the row and is not on the wire

`db/models.Rule` carries it; the contract's nine fields do not include it. Zod
strips unknown keys rather than refusing them, so an accidental tenth field is
invisible to `RulesResponse.parse` — the TypeScript gate has to assert the key set
explicitly, and it does. On this side `extra="forbid"` closes the same door from
the other direction.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# Transcribed from `packages/contract/src/enums.ts:72-81`. See the module
# docstring for why these are not imported from `db/models.py`.
RuleStatus = Literal["live", "pending", "retired"]
RuleOrigin = Literal["spec", "escalation", "reconciliation", "complaint", "senior"]


class RuleResponse(BaseModel):
    """One rulebook entry, in the nine fields `Rule` parses and no more.

    🔴 `from_attributes` WAS SET HERE AND IS DELIBERATELY GONE (2026-09-05).
    It let `RuleResponse.model_validate(row)` read a `db.models.Rule` directly,
    from anywhere — which is the thing `CONVENTIONS.md` §10 rules against, and a
    gate rule saying "a router may not build a DTO from a model" is a lint on top
    of an affordance that still works. Without it Pydantic refuses to read
    attributes off an arbitrary object at all, so `api/mappers/rules.py` is the
    only way to get from a row to this model, structurally. `created_at` is no
    longer dropped by a declared-fields rule; it is absent because the mapper
    writes no line for it.

    `id` is a `UUID` and not a `str`: the column is `UUID(as_uuid=True)`, the
    contract is `z.string()`, and Pydantic's JSON serialiser renders a UUID as its
    canonical lowercase string. Typing it `str` would push the conversion onto
    every caller and would refuse the row object outright.

    **The four `str` fields are not `Field(...)`-annotated** unlike `health.py`'s,
    which describes each of its two. Those two are a platform surface with no other
    document; these nine are specified in `entities.ts` and a `description=` here
    would be a second copy of that specification, free to drift.
    """

    model_config = ConfigDict(extra="forbid")

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


class RuleHistoryResponse(BaseModel):
    """Every version carried under one rule code. `GET /api/rules/{code}`.

    **THE ROW SHAPE IS `RuleResponse` AND IS NOT RE-DECLARED HERE.** That model is
    transcribed from `packages/contract/src/entities.ts` and checked against it by
    `tests/test_rules_contract_parity.py` and `apps/web/contract-parity.test.ts`
    together, so reusing it means a rule on this endpoint is the same document as a
    rule on `/api/rules`, proved by the machine that already exists. A parallel
    model here would be a second transcription of the same nine columns, and the
    two would be free to drift with nothing comparing them.

    **`code` IS ECHOED AT THE TOP LEVEL EVEN THOUGH EVERY ELEMENT REPEATS IT**, and
    that is not redundancy for a reader — it is the only member that survives when
    the list is empty. It does not survive today, because the router refuses an
    unknown code with a 404 rather than serving an empty history (`api/routers/
    rules.py` says why), so the echo is currently provable-equal to every
    `versions[i].code`. `tests/test_rule_history_contract_parity.py` asserts that
    equality rather than assuming it: the day a caller is allowed an empty history,
    the echo is what tells them which code they asked about, and it must already be
    the asked-for code and not a value read back off the first row.

    `versions`, not `rules`: the members of this list are versions OF one rule, and
    calling them rules would make `{"rules": [...]}` mean two different sets on two
    endpoints of the same service.

    NO COUNT FIELD. `len(versions)` is the count, and a second place to compute it
    is a second place for it to be wrong — CLAUDE.md's "UI never re-derives counts"
    cuts both ways, and a server that emits a count the client can already see has
    published a claim it now has to keep true.
    """

    model_config = ConfigDict(extra="forbid")

    code: str
    versions: list[RuleResponse]

"""The rulebook, rendered from storage rows onto the wire.

Three functions and one shape between them. `render_rule` is the whole mapping;
the two envelope functions are the wrappers `endpoints.ts` specifies, and they
exist separately because the envelope is part of the contract and not an
implementation detail a caller should be free to reassemble.

## Why the fields are written out rather than validated off the row

This was `RulesResponse.from_rows`, and it read the row with
`RuleResponse.model_validate(row)` under `from_attributes=True`. That works and
it is shorter. It is also the exact shape `CONVENTIONS.md` §10 names as this
system's failure mode: a mapping that is invisible, so a rename on either side
silently changes what goes over the wire or starts raising at a boundary far
from the edit.

The nine assignments below are the mapping. `created_at` is on the row and is
NOT on the wire — it is absent here because a line was not written for it, which
is a reader-visible fact, rather than because a declared-fields rule dropped it
somewhere inside Pydantic.

## A dict and `model_validate`, not keyword arguments, and the reason is the enums

`Rule.origin` and `Rule.status` are `Mapped[str]`; `RuleResponse.origin` and
`.status` are `Literal`s transcribed from `packages/contract/src/enums.ts`.
Written as `RuleResponse(origin=row.origin, …)` that widening is a pyright
strict error, and the only two ways to silence it — `cast` and an ignore comment
— are both banned by `scripts/check_backend_rules.py`. Narrowing it here with a
hand-written membership test would need the five labels spelled out a SECOND
time, in this file, free to drift from the transcription the contract test
actually checks.

So the nine fields are assembled as a mapping and handed to the model's own
validator. Every field is still named on its own line, which is the property
this package exists for; the label check stays with the `Literal`s that declare
it, and a label that is in the database enum and not in the contract's is caught
HERE, as a `ValidationError` at the boundary, rather than as a 200 the browser
refuses. `tests/test_rules_contract_parity.py` asserts that with a bad row.

This is NOT the `from_attributes` path it replaces. That one read whatever
attributes the object happened to have; this one reads nine named columns, and
`RuleResponse` no longer sets `from_attributes` at all, so passing a row here
instead of a mapping fails rather than quietly working.

## Order is the repository's decision and is preserved, not restated

`RuleRepository.list_all` orders by `(code, version, id)` and its docstring
calls that a WIRE-STABILITY decision it owns. `history_for` owns its own. Both
comprehensions below preserve arrival order exactly; a `sorted(...)` here would
move that decision into this file and make two docstrings false at once.
`tests/test_rules_contract_parity.py::test_the_mapper_preserves_arrival_order…`
measured that substitution and it is not hypothetical.
"""

from __future__ import annotations

from collections.abc import Iterable

from titlepipe_core.api.schemas.rules import RuleHistoryResponse, RuleResponse, RulesResponse
from titlepipe_core.db.models import Rule


def render_rule(row: Rule) -> RuleResponse:
    """One row, nine fields, no inference.

    Every column is named. Nothing here reads a value to decide what another
    value means — the rulebook has no absence states and no citations, so this
    mapper is as flat as one in this package ever gets. The mappers that follow
    it will not be, and this one's shape is what they are answerable to.
    """
    return RuleResponse.model_validate(
        {
            "id": row.id,
            "code": row.code,
            "text": row.text,
            "origin": row.origin,
            "status": row.status,
            "jurisdiction_scope": row.jurisdiction_scope,
            "version": row.version,
            "confirmed_by": row.confirmed_by,
            "source_doc_ref": row.source_doc_ref,
        }
    )


def render_rules(rows: Iterable[Rule]) -> RulesResponse:
    """`GET /api/rules` — the whole rulebook, wrapped. `endpoints.ts:621`."""
    return RulesResponse(rules=[render_rule(row) for row in rows])


def render_rule_history(code: str, rows: Iterable[Rule]) -> RuleHistoryResponse:
    """`GET /api/rules/{code}` — every version carried under one code.

    `code` comes from the CALLER'S PATH and not from `rows[0].code`. The two are
    equal on every response this service can produce, and reading it off a row
    would still be wrong: it would make the echoed value a fact about whatever
    the query returned rather than an answer to what was asked, and there is no
    row to read it from when the list is empty.
    """
    return RuleHistoryResponse(code=code, versions=[render_rule(row) for row in rows])

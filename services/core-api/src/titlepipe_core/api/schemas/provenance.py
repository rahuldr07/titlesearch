"""`CitedValue` — the per-field envelope, and the machine that refuses half a
citation.

PLAN.md §4: "Field provenance envelope is non-negotiable per field: every field
the backend serves needs `value`, `na_reason`, `source_doc_id`, `source_page`,
`source_snippet`, and a server-assigned `state`." Transcribed from
`packages/contract/src/entities.ts:102-117` and `enums.ts:8-41` — the other
author's document — for the reason `api/schemas/rules.py` gives: importing the
spellings from `db/models.py` would make this module's claim "the wire matches
the storage", which is not the claim that needs proving.

## Citation completeness is BINARY, and this is where it is enforced

CLAUDE.md: "half a citation is not a weaker citation, it is none." A response
carrying a `source_doc_id` with no `source_page` renders as uncited on the
client, so a backend that emits one has published a value it cannot cite while
believing it did — principle 6, caught six times in prototyping.

**The machine is `_citation_is_whole`**, a Pydantic model validator that raises
before the object exists. It is not a comment, not a convention and not a review
item: an assembly step that produced a doc id without a page cannot construct a
`CitedValue` at all, and the failure is a `ValidationError` at the boundary
naming the field rather than a screen quietly showing an uncited value as though
it were sourced.

`source_snippet` is deliberately NOT part of the pair. A snippet is the excerpt
shown beside the value and its absence degrades the reader's experience; a page
reference's absence changes whether the value is CITED. Requiring the snippet
would refuse readings from engines that locate a page but return no excerpt,
which is the same fabrication pressure `db/models.py` records for
`field_readings.line_coords`: an engine without the capability declares null
rather than inventing one.

## The two NA states never collapse, and `pending` is not one of them

`NaReason` has exactly four labels. **`pending` is deliberately ABSENT** —
CONVENTIONS §4: pending is a pipeline state, not a reason for absence, and it
lives in `state` where it already is. `NOT_PRESENT` (structurally absent in this
jurisdiction, correct, never surfaced) and `PRESENT_UNREADABLE` (on the page and
unreadable) route differently and mean different things to a reviewer; collapsing
them loses the routing.

**`needs_review` IS NEVER DERIVED FROM `value is None`.** There is no code here
that computes `state`, and that absence is the point: `state` arrives as a field
and is server-assigned upstream of this envelope. A helper here that inferred it
would be exactly the client-side derivation CLAUDE.md forbids, moved one layer
down where it would be harder to see.

## Nothing constrains `na_reason` against `value`

A value AND a reason for its absence is contradictory, and this module does NOT
refuse it. That is a deliberate omission rather than an oversight: which
combinations are legal is a DOMAIN question the rulebook answers, the field model
does not exist yet, and a guess encoded here would have to be unwound rather than
extended. It is listed as an unproven residual in
`hive/design/backend-2026-09/build-api-layer.md` §4 with the ruling it needs.
"""

from __future__ import annotations

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Transcribed from `packages/contract/src/enums.ts:35-41`. Four labels, and see
# the module docstring for why `pending` is not among them.
NaReason = Literal["NOT_PRESENT", "NOT_FOUND", "NOT_STATED", "PRESENT_UNREADABLE"]

# Transcribed from `packages/contract/src/enums.ts:8-15`. Server-assigned; no
# function in this module computes one.
FieldState = Literal[
    "pending", "auto_confirmed", "needs_review", "confirmed", "corrected", "escalated"
]

_HALF_A_CITATION = (
    "A citation is a document AND a page. This value carries one without the "
    "other, which renders as uncited: emit both or neither."
)


class CitedValue(BaseModel):
    """One field's value with the provenance that makes it citable.

    Every member is REQUIRED-AND-NULLABLE and carries no default. `entities.ts`
    spells all five of the nullable ones `.nullable()`, which under Zod requires
    the key to be PRESENT — so a `= None` here would make the field optional on
    input and one `exclude_none` on the serialisation path would drop a key the
    browser refuses the response for. `api/schemas/rules.py` records the same
    trap at length; it is the single most repeatable way to break a screen from
    this side.

    This is a MIXIN for the field-shaped responses, not a response itself. It
    carries no `id`, no `order_id` and no `path`: those identify WHICH field, and
    this class is about what is known of its value. `extra="forbid"` closes the
    door an embedding response would otherwise leave open.
    """

    model_config = ConfigDict(extra="forbid")

    value: str | None = Field(description="The extracted value, or null when absent.")
    na_reason: NaReason | None = Field(
        description="Why the value is absent. Null when a value is present."
    )
    state: FieldState = Field(description="Server-assigned. Never derived by a client.")
    source_doc_id: str | None = Field(description="Document the value was read from.")
    source_page: int | None = Field(description="1-based page within that document.")
    source_snippet: str | None = Field(description="Excerpt shown beside the value.")

    @model_validator(mode="after")
    def _citation_is_whole(self) -> Self:
        """Refuse a document without a page, or a page without a document.

        `mode="after"` so both members are already parsed and typed; a `before`
        validator would be comparing raw input and would miss a page that arrived
        as a string. Raising here means no `CitedValue` naming half a citation can
        exist — including one built in a test, which is what makes
        `tests/test_provenance_envelope.py` a proof about the type rather than
        about one call site.

        `ValueError` and not a `DomainError`: this is Pydantic's own protocol and
        it is what makes the failure a `ValidationError` carrying the FIELD
        LOCATION. `api/errors.py::sanitise_validation_errors` then keeps the code
        and the location and drops the message, so the response names the field
        without echoing the value — `tests/test_errors.py` holds that.
        """
        if (self.source_doc_id is None) != (self.source_page is None):
            raise ValueError(_HALF_A_CITATION)
        return self

"""Wire shapes. **Pydantic is the authority here, and the ORM is not.**

`db/models.py` describes what is STORED; this package describes what is SENT. They
are different documents with different owners — `rules` carries a `created_at` the
contract has never listed, and the response shape is the router's to choose rather
than the schema's to dictate (`db/models.Rule`'s docstring says so from the other
side). Keeping them in one class would make every storage column a wire promise.

ADR-0001's third amendment (2026-08-05) puts the wire under Pydantic/OpenAPI,
migrated endpoint by endpoint. `packages/contract`'s Zod is **not** demoted by
that: `openapi-fetch` ships no validation, so Zod stays the browser's runtime
boundary parser and every model here has to survive it. What proves it does is
`tests/test_rules_contract_parity.py` plus `apps/web/contract-parity.test.ts`,
which are two gates over one committed fixture and neither is sufficient alone.

## RESIDUAL: THERE IS NO FIELD ENVELOPE ON THE WIRE, AND NOTHING GUARDS ONE

This package held a `CitedValue` mixin whose `model_validator` refused half a
citation — a `source_doc_id` without a `source_page`, which renders as UNCITED
on the client. It had ZERO importers, no endpoint served a field, and the
docstring cited `tests/test_provenance_envelope.py` as its proof; that file was
never written. Deleted rather than proved, because a test over a type nothing
constructs reads as coverage and is not, and because every claim it made has a
live home with a real machine behind it: `0090`'s `ck_fields_citation_is_whole`
for the pair (`tests/test_field_citation_is_whole.py`, watched red at 0080),
`db/models/enums.py` for the four NA labels and why `pending` is not among them,
`0006`'s `titlepipe_field_transition` plus the grant that omits `state` for "no
client derives a state", and `api/schemas/rules.py` for the required-and-nullable
`exclude_none` trap.

**WHAT IS NOT CLOSED, AND IT IS NOT WHAT THE DELETED MODULE COVERED EITHER.**
`0090` constrains ROWS IN `fields`. It says nothing about a PROJECTION of one.
When the field endpoint lands, a mapper that carries `source_doc_id` and drops
`source_page` — a redaction path, an outer join that missed, one
`model_dump(exclude_none=True)` — emits half a citation from a wholly-cited row
and no machine in this system refuses it. What would close it is the validator
that was here, on the response model that actually gets served, plus a test that
constructs the half shape and watches it raise. Write both with the endpoint;
neither is worth carrying without one.
"""

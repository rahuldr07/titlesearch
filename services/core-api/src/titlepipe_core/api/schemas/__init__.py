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
"""

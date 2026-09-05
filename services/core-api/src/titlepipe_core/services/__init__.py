"""Use cases. One transaction each, and the business rules that decide them.

`CONVENTIONS.md` §10's third layer. A service is called by a handler, calls
repositories, and returns MODELS — the handler renders them through a mapper.
Between those two facts sit the rulings, which is the whole reason the layer
exists rather than the handler calling a repository directly:

* whether an empty result is an answer or a refusal;
* whether a caller may see a row at all;
* what happens between two writes that must both land or neither.

A service raises `DomainError` and never `HTTPException`, imports neither
`fastapi` nor `starlette`, and knows no status codes. `api/errors.py` owns the
mapping from a refusal to a number, in one place, so the same refusal reads the
same over HTTP wherever it is raised. `scripts/check_backend_rules.py` enforces
that as `layer-service-http`.

NO `domain/` PACKAGE, deliberately, and §10 rules on it: with four layers this
is simpler and sufficient. The point at which a service both orchestrates AND
holds predicates — call it ~300 lines — is when the pure predicates move to
`services/rules/`. Do not pre-build that; an empty indirection is this
codebase's documented failure mode, which is a safety property that appears
enforced without being enforced.
"""

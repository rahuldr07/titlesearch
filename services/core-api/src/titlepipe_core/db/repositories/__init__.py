"""The repository layer: SQL, and nothing above it.

`CONVENTIONS.md` §10 names four layers and this is the bottom one that is not a
table. A repository takes a session, issues statements, and returns MODELS. It
never returns a DTO, never imports anything under `api/`, and never decides what
a caller should do with an empty result — `history_for` returning zero rows is a
fact, and whether that fact is a 404 is the service's ruling.

WHY THIS PACKAGE EXISTS AS A DIRECTORY rather than the two flat modules it
replaces: `db/repository.py` (the base) and `db/rules.py` (one repository) were
siblings of `models.py`, `engine.py` and `session.py`, which made the layer a
naming convention rather than a location. §10's first machine-enforceable rule
is about a PATH — `api/routers/**` may not import `db/repositories`. A rule
about a path needs the path to exist.

`base.py` holds `TenantRepository` and `refuse_unscoped_session`, the refusal
both kinds of repository make. `rules.py` holds `RuleRepository`, the global
table's, which is a SIBLING of `TenantRepository` and not a subclass — `base.py`
argues why at length, including why the plan's stated reason for the same
conclusion is false.

Nothing is re-exported here. `db/__init__.py` is the package's public surface
and already lists what a caller outside `db/` needs; a second list in here would
be a second thing to keep true.
"""

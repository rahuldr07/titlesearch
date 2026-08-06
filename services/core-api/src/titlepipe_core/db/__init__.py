"""Database layer: the declarative base, and later the session and repositories.

**This package is the one place under `src/` where raw SQL is permitted.**
`scripts/check_backend_rules.py` exempts `db/` from rule 3 (`text` /
`exec_driver_sql`) because the handful of statements that must be raw — `SET
LOCAL`, health checks, server defaults — live here and are reviewed as such.
The exemption is anchored to `db/` being the FIRST path component below the
distribution package, so an `api/db/` would not inherit it. Nothing else in the
gate is relaxed here: `Any`, `cast(`, `begin_nested(`, `print(` and the HTTP
exception type are as banned in this package as anywhere else.

That last one is `HTTPException`, and this paragraph is now allowed to name it.
`scripts/check_backend_rules.py` walks the AST for the banned names, where a
docstring is a string constant and not a name, so prose about the rule is not
matched by the rule. Its own module docstring is where that decision is argued:
"a rule that flags the sentence documenting the rule is a rule that teaches
people to stop writing the documentation."

🔴 THIS PARAGRAPH USED TO SPELL THE TYPE OUT RATHER THAN NAME IT, AND CITED A
TEST THAT NO LONGER EXISTS. It said
`tests/test_errors.py::test_domain_and_service_code_never_import_httpexception`
"scans every file under `src/` for the literal string and has no notion of a
comment", and concluded that this file "works around the stricter of them
rather than changing a test it does not own". Commit `6df3eaa` DELETED that
test — it was wrong in both directions, passing a real
`from fastapi import HTTPException` under the `errors.py` exemption and failing
on prose that merely mentioned the type. `tests/test_errors.py` carries the
measurement where the test used to be. The workaround outlived the thing it
worked around, and the citation was the one test reference in this tree that
resolved to nothing.

`models.py` holds `Base` and the seven skeleton tables. `engine.py` holds
`make_engine`, the pool's `checkin` listener and `make_sessionmaker` — the
CONNECTION-lifetime half of the tenant seam — and `session.py` holds
`tenant_session`, the only scoped way to open a session. `repository.py` holds
the base every later repository is built on.

🔴 `make_engine` AND `make_sessionmaker` MOVED OUT OF `session.py` ON 2026-08-06
AND NO CALLER'S IMPORT LINE CHANGED, which is the whole point of re-exporting
here. `from titlepipe_core.db import make_engine, make_sessionmaker,
tenant_session` reads identically on both sides of the split. The move was forced
by `scripts/check_backend_rules.py` rule 6 — `session.py` had reached exactly 400
lines, and the alternative was a `rules-allow-file(file-length)` on the most
security-critical module in the tree.

Everything a caller outside this package needs is re-exported here, so that the
import that reaches the database is `from titlepipe_core.db import
tenant_session` rather than a module path somebody could sidestep. `Base` is
included because `TenantRepository`'s bound is stated in terms of it and a caller
writing an annotation needs the same symbol.

The one module that reaches past this `__init__` is `migrations/env.py`, for
`engine.DENY_SENTINEL_OPTIONS`. That constant is deliberately absent from the
list below: this file re-exports what a caller needs in order to REACH the
database, and one libpq connection parameter is not that.

🔴 `make_sessionmaker` IS IN THAT LIST, AND IT IS AN UNSCOPED DOOR. Calling the
sessionmaker it returns gives an `AsyncSession` with no tenant listener on it, so
"the only scoped way" above is a claim about `tenant_session` and not about the
reachable surface of this package. The export is kept on purpose — an application
builds one sessionmaker at startup and passes it to `tenant_session` per request,
and removing it would hide the door rather than close it. What closes it is
`TenantRepository.__init__`, which refuses a session that carries no
`TENANT_SCOPED_MARK`; `session.py`'s opening records the correction in full, and
the sessionmaker itself now lives in `engine.py`.

A gate rule was proposed for this door and DECLINED on 2026-08-06 — see
`scripts/check_backend_rules.py`, known hole 7. The short version is that the
script keys on identifiers with no type resolution, so the affordable rule is "a
call on something named `sessionmaker`" and a parameter named `session_factory`
walks through it; the mark above is a check on the object rather than on a word,
and is what actually closes the path.
"""

from titlepipe_core.db.engine import make_engine, make_sessionmaker
from titlepipe_core.db.models import Base
from titlepipe_core.db.repository import TenantRepository
from titlepipe_core.db.session import tenant_session

__all__ = [
    "Base",
    "TenantRepository",
    "make_engine",
    "make_sessionmaker",
    "tenant_session",
]

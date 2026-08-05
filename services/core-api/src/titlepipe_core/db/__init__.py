"""Database layer: the declarative base, and later the session and repositories.

**This package is the one place under `src/` where raw SQL is permitted.**
`scripts/check_backend_rules.py` exempts `db/` from rule 3 (`text` /
`exec_driver_sql`) because the handful of statements that must be raw — `SET
LOCAL`, health checks, server defaults — live here and are reviewed as such.
The exemption is anchored to `db/` being the FIRST path component below the
distribution package, so an `api/db/` would not inherit it. Nothing else in the
gate is relaxed here: `Any`, `cast(`, `begin_nested(`, `print(` and the HTTP
exception type are as banned in this package as anywhere else.

That last one is spelled out rather than named, deliberately.
`tests/test_errors.py::test_domain_and_service_code_never_import_httpexception`
scans every file under `src/` for the literal string and has no notion of a
comment, so writing the name here — in prose, arguing that it is forbidden —
fails that test. See the module docstring of `scripts/check_backend_rules.py`
for why the structural gate parses instead: "a rule that flags the sentence
documenting the rule is a rule that teaches people to stop writing the
documentation". The two disagree, and this file works around the stricter of
them rather than changing a test it does not own.

`models.py` holds `Base` and the seven skeleton tables. `session.py` holds the
engine, the sessionmaker and `tenant_session` — the only scoped way to open a
session — and `repository.py` holds the base every later repository is built on.

Everything a caller outside this package needs is re-exported here, so that the
import that reaches the database is `from titlepipe_core.db import
tenant_session` rather than a module path somebody could sidestep. `Base` is
included because `TenantRepository`'s bound is stated in terms of it and a caller
writing an annotation needs the same symbol.
"""

from titlepipe_core.db.models import Base
from titlepipe_core.db.repository import TenantRepository
from titlepipe_core.db.session import make_engine, make_sessionmaker, tenant_session

__all__ = [
    "Base",
    "TenantRepository",
    "make_engine",
    "make_sessionmaker",
    "tenant_session",
]

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

"""Database layer: the declarative base, the session, the repositories.

**This package is the one place under `src/` where raw SQL is permitted.**
`scripts/check_backend_rules.py` exempts `db/` from rule 3 (`text` /
`exec_driver_sql`) because the handful of statements that must be raw — `SET
LOCAL`, health checks, server defaults — live here and are reviewed as such.
The exemption is anchored to `db/` being the FIRST path component below the
distribution package, so an `api/db/` would not inherit it. Nothing else in the
gate is relaxed here: `Any`, `cast(`, `begin_nested(`, `print(` and the HTTP
exception type are as banned in this package as anywhere else.

The rule for what appears below: this file re-exports what a caller OUTSIDE the
package needs in order to REACH the database, so the import that does is `from
titlepipe_core.db import tenant_session` rather than a module path somebody
could sidestep. `Base` qualifies because `TenantRepository`'s bound is stated in
terms of it. A name only interesting inside `db/` — `refuse_unscoped_session`,
`TENANT_SCOPED_MARK` — does not, and is imported by module path between the
files here instead. Why `RuleRepository` does not extend `TenantRepository` is
argued in `repositories/base.py`; both are exported because callers outside this
package construct both.

`engine.DENY_SENTINEL_OPTIONS` IS DELIBERATELY ABSENT, and `migrations/env.py`
is the one module that reaches past this `__init__` to get it. One libpq
connection parameter is not something a caller needs in order to reach the
database, so the criterion above excludes it and the reach is intentional.

`make_sessionmaker` IS IN THE LIST, AND IT IS AN UNSCOPED DOOR. Calling the
sessionmaker it returns gives an `AsyncSession` with no tenant listener on it, so
"the only scoped way" is a claim about `tenant_session` and not about the
reachable surface of this package. The export is kept on purpose — an application
builds one sessionmaker at startup and passes it to `tenant_session` per request,
and removing it would hide the door rather than close it. What closes it is
`TenantRepository.__init__`, refusing a session that carries no
`TENANT_SCOPED_MARK`.

A gate rule was proposed for that door and DECLINED on 2026-08-06 — see
`scripts/check_backend_rules.py`, known hole 7. The script keys on identifiers
with no type resolution, so the affordable rule is "a call on something named
`sessionmaker`" and a parameter named `session_factory` walks through it; the
mark is a check on the object rather than on a word, and is what actually closes
the path.
"""

from titlepipe_core.db.engine import make_engine, make_sessionmaker
from titlepipe_core.db.golden import GoldenRepository
from titlepipe_core.db.health import check_database
from titlepipe_core.db.models import Base
from titlepipe_core.db.repositories.base import TenantRepository
from titlepipe_core.db.repositories.rules import RuleRepository
from titlepipe_core.db.session import tenant_session

__all__ = [
    "Base",
    "GoldenRepository",
    "RuleRepository",
    "TenantRepository",
    "check_database",
    "make_engine",
    "make_sessionmaker",
    "tenant_session",
]

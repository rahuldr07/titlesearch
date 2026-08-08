# Plan 01 — what actually happened

> **Audience: whoever writes Plan 02.** `00-HOW-TO-EXECUTE.md` §9 says plans
> 02–06 are written after 01 lands *"so each is informed by what actually
> happened rather than what was predicted."* This is that record. It was spread
> across nineteen commit messages until it was collected here on 2026-08-06.
>
> This is **not** a narrative and not a status report. It is four things a later
> plan needs and cannot get from the plan document: the interface it will call,
> the constraints it will hit, what the gate will refuse, and what is still open.

Read `01-postgres-correctness.md` for the tasks as specified. Read this for what
the specification turned out to be wrong about. Where the two disagree, this one
is later.

**Every claim below was re-verified against the tree at `7e6165a` on
2026-08-06** — the interfaces by reading the code, the counts by running the
suites, the open items by looking for each one. There is deliberately no blanket
warrant sentence: Plan 01 opened with one ("every SQL claim below was executed
against PostgreSQL 18.4 and produced the stated result"), it was never true, and
`a9a973a` deleted it. A warrant that cannot age is a warrant that makes the
reader stop checking.

---

## 1. The interface Plans 02–06 consume

All of it is in `services/core-api/src/titlepipe_core/db/`, plus the canon in
`libs/domain/src/titlepipe_domain/tenancy.py`.

### The canon — `libs/domain/src/titlepipe_domain/tenancy.py`

```python
TenantId = NewType("TenantId", UUID)
TENANT_GUC: Final = "app.current_tenant"
NO_TENANT_GUC_VALUE: Final = ""

def tenant_guc_value(tenant_id: TenantId | None) -> str: ...
```

`TENANT_GUC` and `tenant_guc_value` are re-exported from `titlepipe_domain`
itself. `tenant_guc_value` **parses** the UUID rather than trusting the
annotation — `TenantId` is a `NewType` and erased at runtime — so a malformed
tenant raises `ValueError` at the call site instead of reaching the server and
turning a denial into a 500.

### The connection floor — `db/engine.py`

```python
def make_engine(dsn: str, *, pool_size: int = 5, max_overflow: int = 10) -> AsyncEngine: ...
def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]: ...

DENY_SENTINEL_OPTIONS: Final = f"-c {TENANT_GUC}="   # NOT re-exported from db/
```

### The scope — `db/session.py`

```python
TENANT_SCOPED_MARK: Final = "titlepipe.tenant_scoped"

@asynccontextmanager
async def tenant_session(
    sessionmaker: async_sessionmaker[AsyncSession], tenant: TenantId | None
) -> AsyncGenerator[AsyncSession]: ...
```

### The repository base — `db/repository.py`

```python
class TenantRepository[T: Base]:
    def __init__(self, session: AsyncSession, model: type[T]) -> None: ...
    async def get(self, id_: UUID) -> T | None: ...
    async def add(self, entity: T) -> None: ...
```

### Where they live, and the split that does not change your import line

`engine.py` **was split out of `session.py` on 2026-08-06** (`7e6165a`).
`session.py` had reached exactly 400 lines — the structural gate's rule-6 cap —
so the next line anybody added to the most security-critical module in the tree
would have tripped the gate, and the cheap way out was a
`rules-allow-file(file-length)` on precisely the file that must stay reviewable.
The split takes the CONNECTION-lifetime half (`make_engine`, the pool `checkin`
listener, `make_sessionmaker`) and leaves the TRANSACTION-lifetime half
(`tenant_session`).

**No caller's import line changed.** `db/__init__.py` re-exports, so

```python
from titlepipe_core.db import Base, TenantRepository, make_engine, make_sessionmaker, tenant_session
```

reads identically on both sides of the split. That five-name list is exactly
`db.__all__`. The one module that reaches past the package `__init__` is
`migrations/env.py`, for `titlepipe_core.db.engine.DENY_SENTINEL_OPTIONS` —
deliberately not re-exported, because `__init__` re-exports what a caller needs
in order to *reach* the database and one libpq connection parameter is not that.

**Do not take the signatures from Plan 01's Task 5 contract.** It was amended
twice after the task ran (`88dd361`): the return annotation is `AsyncGenerator`,
not the `AsyncIterator` it was specified with — pyright 1.1.411 strict rejects
`AsyncIterator` under `@asynccontextmanager` as deprecated, and the only
alternative was a `# pyright: ignore`, which the gate bans — and `tenant_session`
**commits on clean exit**, which the contract did not say and every write in
Plans 02–06 depends on.

### The shape a later plan is expected to write

```python
async with tenant_session(sessionmaker, tenant) as session:
    orders = TenantRepository(session, Order)
    row = await orders.get(order_id)
```

The tenant is not a `WHERE` clause and no repository method takes one. It is the
session GUC `app.current_tenant`, applied by an `after_begin` listener and read
by revision `0002`'s `tenant_isolation` policy on all seven tables.
`TenantRepository.add` **flushes** so a policy violation surfaces at the
statement that caused it rather than at the context manager's exit; it does not
commit, because the unit of work is the `tenant_session` block.

---

## 2. What is *not* wired — the gap Plan 02 inherits

Verified 2026-08-06 by grepping `services/core-api/src` for every seam name:
**nothing outside `db/` calls any of it.** Concretely, Plan 02 must supply all
three of these before it can serve a request off the database:

| missing | where it has to land |
|---|---|
| a database URL setting | `titlepipe_core/settings.py` has **no DSN field at all**. `TP_TEST_DATABASE_URL` is a *test* override read by `tests/conftest.py`; it is not an application setting |
| engine + sessionmaker ownership | `ServiceResources` in `titlepipe_core/lifespan.py` holds `settings`, `clock`, `id_factory`, `metrics`, `started_at` — no engine. `lifespan.py`'s own opening states the rule it must be built under: nothing at import time |
| a readiness check that touches the database | `ServiceResources.readiness()` returns exactly `{"startup_complete": …}`, and its docstring says this "must be extended — not replaced — as the database, object store and queue land" |

`app.py` includes exactly one router, `api/routers/health.py`. `/health` and
`/ready` exist and **predate this branch** (`916d4c9`, 2026-07-22).

---

## 3. The constraints a later plan will hit, each with its measurement

Each of these was measured, not predicted. Each is pinned by a test, and the
test is named so you can read the measurement rather than take this table's word
for it.

### 3.1 `FORCE RLS` makes every tenant table invisible to `titlepipe_owner` — the role every migration runs as

MEASURED against postgres:18.4, connected as `titlepipe_migration` with
`SET ROLE titlepipe_owner`, two seeded rows in two different tenants:

```
UPDATE orders SET tenant_id = tenant_id;   ->  UPDATE 0
SELECT count(*) FROM orders;               ->  0
```

No error. **Any data migration written from `0002` on is a silent no-op that
reports success.** The remedy is two statements, and the order matters:

```sql
BEGIN;
SET LOCAL row_security = off;                      -- the guard
ALTER TABLE orders NO FORCE ROW LEVEL SECURITY;    -- the permission
UPDATE orders SET tenant_id = tenant_id;           -- UPDATE 2
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
COMMIT;
```

`SET LOCAL row_security = off` is the half that must never be omitted, because
it is the half that turns silence into noise: with `FORCE` still on it does not
permit the write, it **refuses** it with `42501 query would be affected by
row-level security policy` and a HINT naming its own fix. Omit it and you get
`UPDATE 0` and exit 0. Pinned by
`tests/test_forced_rls_and_grants.py::test_a_migration_shaped_write_is_a_silent_no_op_until_it_says_so`;
argued in full in `migrations/versions/0002_forced_rls_and_grants.py`'s opening.

A second policy keyed on an `app.migration` GUC was **rejected**, and the reason
generalises: any role can `SET` its own custom GUC, so that policy would hand
`titlepipe_app` a bypass switch. The escape hatch has to be a privilege, not a
setting.

### 3.2 RLS defends a **forgotten** `WHERE` clause and not a **concatenated** one

A custom placeholder GUC carries no ACL, so `set_config` on it is callable by
every role. MEASURED 2026-08-06 as `titlepipe_app`, tenant `1111…` established,
in ONE statement, no stacked queries, no second round trip:

```
-- one line earlier, same session: SELECT id FROM orders -> ['eb1b546f-…']
SELECT id, tenant_id FROM orders
  WHERE (SELECT set_config('app.current_tenant', '2222…', true)) IS NOT NULL;
-> 5d16bcc1-… | 22222222-…
-- and afterwards, still inside the block:
current_setting('app.current_tenant', true) -> '2222…'
```

That row belongs to the other tenant, and the session held the other tenant's id
for the rest of the transaction. **There is no PostgreSQL-side fix** — a custom
GUC has no ACL to revoke, so nothing can be taken away from `titlepipe_app`.

Consequences for Plans 02–06, stated plainly because an earlier version of
`session.py` claimed the opposite ("it survives a query nobody in this
repository wrote"):

- **parameterisation is load-bearing on its own**, not belt-and-braces on a
  policy;
- **a review that waves an injection through because "RLS would catch it" is
  waving through a cross-tenant read.**

The half that *is* closed is the leak outliving the request: `engine.py`'s
`_restore_deny_sentinel` `RESET`s the GUC on pool `checkin`, so a non-local
`set_config` does not survive into the next checkout. Pinned by
`test_tenant_session.py::test_a_non_local_set_config_does_not_survive_the_pool_checkin`.

### 3.3 A superuser bypasses RLS unconditionally, and `FORCE` does not stop them

Any isolation test that connects as a superuser passes while proving nothing.
Task 6's whole design is that it connects as `titlepipe_app`. The injection —
run the same seven assertions as the superuser — fails **all seven**; Plan 01
had predicted three, and a count of exactly three would have meant four
assertions were not working. This is also in `00-HOW-TO-EXECUTE.md` §7.

### 3.4 `TenantRepository` now refuses a session that did not come from `tenant_session`

`make_sessionmaker` is in `db.__all__` and an `async_sessionmaker` is callable,
so an `AsyncSession` with no tenant listener is reachable. The export **stays** —
an application builds one sessionmaker at startup and hands it to
`tenant_session` per request, so deleting it removes the sign rather than the
door. What closes the door is a check on the object: `tenant_session` writes
`TENANT_SCOPED_MARK` into `Session.info`, and `TenantRepository.__init__` raises
`RuntimeError` when it is absent.

It is a **wiring** check, not a security boundary. The security boundary is the
GUC; a constructor that is not `async` cannot see the GUC without a round trip.
What it buys is that the mistake surfaces one line after it is made rather than
as an empty result set from somewhere else. `RuntimeError` and not a
`DomainError`, deliberately: `api/errors.py` would give a `DomainError` an HTTP
status and turn a programming error into a response a caller is invited to
interpret.

### 3.5 `begin_nested` is banned in `src/`, and the reason is **erasure**, not GUC-unwinding

The ban's original justification was false and stayed in place for as long as the
ban did. MEASURED: a GUC set *before* a savepoint survives `ROLLBACK TO`
(`'AAAA'` → `SAVEPOINT` → `ROLLBACK TO` → `'AAAA'`), and `after_begin` sets the
tenant on the OUTER transaction — so "the next statement runs under the wrong
tenant" does not follow.

The real cost, RE-MEASURED 2026-08-06 with a cross-tenant `INSERT` in the middle
of a batch of three, on a `FORCE`d table as a non-owner login role:

```
without a savepoint:  row-1 ok · cross 42501 · row-3 25P02 · COMMIT -> 0 rows
with a savepoint:     row-1 ok · cross 42501 (swallowed) · row-3 ok · COMMIT -> 2 rows
```

Not a leak — an **erasure**. A savepoint is precisely the construct for "try
this, and carry on if the database refuses", and in a tenant-scoped system
carrying on after RLS refused converts a security event into a skipped row.

**This reason is stated once**, in `scripts/check_backend_rules.py` rule 2.
`db/session.py` and `test_tenant_isolation.py`'s assertion 4 cite it rather than
re-argue it, because two units working in parallel each invented a *different*
replacement reason without knowing about the other, and a rule with two reasons
in two files is a rule that gets half-repealed by whoever finds the weaker one
first. If a later plan needs a savepoint, argue against that paragraph.

Related and easy to miss: `after_begin` **also fires on nested transactions**
(`transaction.nested` in firing order → `[False, True]`), so the listener does
run inside a savepoint. It is harmless for exactly one reason — the value it
writes is identical — which is a coupling, not a fact. A handler that wrote a
different value when `transaction.nested`, or that fired only then, breaks it,
and both are one edit away.

### 3.6 `after_begin` is ORM-only, so Alembic and any worker are outside the seam

MEASURED against SQLAlchemy 2.0.51: `after_begin` is absent from both
`ConnectionEvents` and `PoolEvents`. `ConnectionEvents` *does* have `begin`,
which is the trap. So a raw `engine.connect()`, Alembic, and any future queue
worker never have a tenant applied. **They are not thereby unscoped — they are
denied**, which is the direction to fail in.

**But not by the same line of code.** The deny pin is a property of
`make_engine`'s `connect_args`, and `migrations/env.py` builds its own engine
with `engine_from_config(...)`. Alembic is pinned only because it *asks*: that
call passes `connect_args={"options": DENY_SENTINEL_OPTIONS}`, importing the
constant rather than respelling it. **A queue worker written in Plan 06 gets
nothing automatically** — it must either use `make_engine` or pass the same
constant. Without it, a data migration under an exported `PGOPTIONS` reports
`UPDATE 1` where the invariant is unconditionally `0`, and a non-zero count
reads as success while every other tenant is silently skipped.

### 3.7 `PGOPTIONS` can preset the GUC to a valid tenant

MEASURED as `titlepipe_app` with
`PGOPTIONS='-c app.current_tenant=3333…'` exported:

```
create_async_engine("postgresql+psycopg://…")  -> '3333…'
make_engine("postgresql+psycopg://…")          -> ''
```

The preset is CONNECTION-scoped, so it survives `SET LOCAL` plus a rollback on a
pooled connection. `tests/conftest.py` strips the whole `PG*` family from the
pytest process — that is the harness protecting itself, not the application.
The application's own defence is `make_engine`'s `connect_args`.

### 3.8 The sentinel is `''`, never NULL, and every policy must `nullif` it

`current_setting(x, true)` answers NULL for a GUC never assigned in the session
and `''` for one assigned and since reverted. `DENY_SENTINEL_OPTIONS`, the
`checkin` `RESET`, and `is_local=True` reverting at COMMIT all produce the
second. `''::uuid` raises `invalid input syntax for type uuid: ""` — **a 500
where a denial belongs** — so every policy expression is
`<key> = nullif(current_setting('app.current_tenant', true), '')::uuid`, built
in one place (`0002._tenant_predicate`) so it cannot be present on six tables and
missing from the seventh.

### 3.9 The composite primary key is `(tenant_id, id)`, and it is a security decision

`PRIMARY KEY (id)` under `FORCE RLS` is a cross-tenant existence oracle: unique
enforcement runs *before* the policy's `WITH CHECK`, so inserting an id held by
another tenant raises while an unheld id succeeds — two answers for two rows the
tenant cannot see. Bounded today only because ids are 128-bit and
server-generated; unbounded the moment PRD §7's order number or page index
lands.

Two consequences for a later plan:

- `Session.get` **cannot be used** — it wants a complete primary key, and asking
  the caller for the tenant is the parameter `TenantRepository` exists not to
  have. `TenantRepository.get` uses `select(...).filter_by(id=…)` instead, and
  the policy supplies the other half.
- `TenantRepository.get` returns `None` for both "no such row" and "another
  tenant's row", on purpose. Distinguishing them in the repository would re-open
  the oracle one layer up.

### 3.10 `schema public` cannot be granted from a migration

Schema `public` belongs to `pg_database_owner` from PostgreSQL 15 on, and
`titlepipe_owner` holds no grant option, so `0002`'s `GRANT USAGE ON SCHEMA
public` is a **WARNING and a no-op** — and `op.execute` does not raise on a
warning. The grant lives in `migrations/sql/roles.sql`, which runs as the
operator. `0002` reads the privilege back and refuses (`_require_schema_usage`)
rather than exiting 0 over a database where `titlepipe_app` holds SELECT on
every table and is told the tables do not exist. End to end, after
`REVOKE USAGE ON SCHEMA public FROM PUBLIC`:

```
before   alembic exit=1, titlepipe_app: 42P01 relation "orders" does not exist
after    alembic exit=0, titlepipe_app sees orders
```

Anything a later migration wants to grant at *schema* or *database* scope has
the same problem and belongs in `roles.sql`.

### 3.11 Smaller ones, each measured

- **`SET LOCAL` outside a transaction is a no-op that reports success.** It emits
  `WARNING: SET LOCAL can only be used in transaction blocks` and then `SET`.
  psycopg raises nothing and `ON_ERROR_STOP` never sees a warning. This is why
  the tenant is applied from `after_begin`, an event that cannot fire outside a
  transaction.
- **`set_config` has exactly one signature**, `(text, text, boolean)`. There is
  no two-argument form: `SELECT set_config('app.current_tenant','x')` is
  `42883`.
- **`expire_on_commit=False` on the sessionmaker is a decision.** With the
  default, `tenant_session`'s exit commit expires every loaded attribute and the
  first read *after* the block raises `DetachedInstanceError`.
- **`titlepipe_owner` is `NOLOGIN` and has `PASSWORD NULL`.** Nothing can connect
  as it. An injection or a plan step that asks you to is asking for a connection
  that must not exist — Task 4's original injection did exactly that.
- **`titlepipe_migration` holds `titlepipe_owner` `WITH INHERIT FALSE, SET
  TRUE`**, so Alembic must `SET ROLE` explicitly and the `SET ROLE` must be
  connection-scoped and never reset. After `RESET ROLE`, reading
  `alembic_version` fails with permission denied for the TABLE.
- **`alembic_version` must stay out of any "tenant tables" derivation**, or
  Alembic is locked out of its own version table.
- **`audit_log` is append-only via two BEFORE STATEMENT triggers** and grants
  `SELECT`/`INSERT` only — `titlepipe_app` gets `42501` on an UPDATE before the
  trigger's `0A000` is reachable. `DELETE` and `TRUNCATE` are asserted absent on
  all seven tables, so a `GRANT ALL` cannot satisfy the positive assertions.
- **The grantee set on all seven tables is asserted to be exactly
  `{titlepipe_owner, titlepipe_app}`, and `titlepipe_worker` is asserted to hold
  nothing.** A later plan that wants the worker to read a table has to change
  that assertion deliberately. `has_table_privilege` alone would not have
  noticed: it answers about the *effective* privilege, so a `GRANT … TO PUBLIC`
  satisfies it.
- **The permissive policy set on each table is asserted to be exactly
  `{tenant_isolation}`, with `with_check` NULL and `pg_policies.roles` = PUBLIC.**
  Permissive policies OR together, so a second `FOR UPDATE USING (true)` policy
  hands every tenant every other tenant's rows on the write path — and shipped
  195 green before that assertion existed.
- **An `UPDATE … WHERE` cannot detect a broken UPDATE policy.** PostgreSQL
  applies the SELECT policy to an UPDATE that reads columns, so a cross-tenant
  `UPDATE … WHERE` touches 0 rows even under the leak. Only an unqualified
  `UPDATE … SET tenant_id = :a` reads nothing and goes straight through the
  UPDATE policy.
- **`pre-commit run --all-files` MUTATES the working tree** (whitespace, EOF, and
  `ruff --fix` rewrote ten files per run). Do not point it at uncommitted work.

---

## 4. What the structural gate will refuse

`scripts/check_backend_rules.py`, run as `python scripts/check_backend_rules.py`
from the repository root. It parses the AST (so comments and docstrings are not
code, and `scrub_text(` is not `text(`) and tokenizes separately for the comment
rules. Scope is `services/*/src` and `libs/*/src` — **49 files at `7e6165a`,
exit 0**. Tests live *beside* `src/` and are out of scope by location; a `tests`
package *inside* `src/` is scanned like anything else.

Finding **nothing** exits non-zero. A gate that cannot find the code has not
checked it.

| rule id | refuses | scope / carve-out |
|---|---|---|
| `any-type` | `Any`, `cast(`, `# type: ignore`, `# pyright: ignore`, `# pyright: basic\|standard`, `# pyright: reportFoo=false`, a PEP-484 type comment saying `Any` | all of `src/` |
| `savepoint` | `begin_nested`, **and `begin(` with any argument at all** | all of `src/` |
| `raw-sql` | `text`, `literal_column`, `exec_driver_sql`, `raw_connection`, **`TextClause`, `ColumnClause`** | `src/` **except** a `db` package directly inside a distribution package |
| `http-exception` | `HTTPException` | `src/` except each package's own `api/errors.py` |
| `http-response` (**"4b"**) | `JSONResponse`, `ORJSONResponse`, `UJSONResponse`, `HTMLResponse`, `PlainTextResponse`, `RedirectResponse`, `StreamingResponse`, `FileResponse` | `src/` except each package's whole `api` package |
| `print` | `print`, **and `.write`/`.writelines` on any dotted base containing `stdout`/`stderr`** | all of `src/` |
| `file-length` | a file over **400 lines** | all of `src/` |
| (rule 7) | a `rules-allow` whose reason is under 12 characters, or that names no rule, or that names an unknown rule | every scanned file |

**The bolded entries are the ones added after the original seven-rule table**
(`6df3eaa`, `7e6165a`), each because the plain form scored a *clean file*
against the gate that had the rule in it. If you are writing Plan 02 against the
rules as Plan 01's Task 0 describes them, these are the ones you will not know
about.

Shapes that fire, beyond the obvious call: **any import that binds the name**
(including `from sqlalchemy import text as sql`, reported on the alias's line),
**any reference that reads it** (`_emit = print`, `savepoint = session.begin_nested`),
and an **attribute read** for every banned name except `text`. Also
`q = sa.text` followed anywhere in the same file by `q(...)`.

Deliberately silent, so you do not file these as bugs: `response.text` and any
other plain `.text` read; a parameter or local the file binds for itself; a
keyword argument `text=`; an attribute *assignment*; `def text(...)`/`class Text`;
and bare `Response`, because `httpx.Response` is what an engine adapter will
annotate.

**Exemptions.** `# rules-allow(<rule-id>): <reason>` on the violating physical
line, or `# rules-allow-file(<rule-id>): <reason>` as a comment of its own. Both
are rule-scoped — one honest reason for a `cast` must not launder a `print`
beside it — and both must be *the* comment, not a sentence quoting one: a
substring test let a line of documentation switch rule 5 off for a whole file.
The line form can never grant `file-length`, which is attached to no line; it is
now rejected by name rather than silently ignored.

### The holes it documents rather than pretends to cover

Seven, written down in the module docstring on the grounds that an enforcement
script is trusted exactly as far as its stated scope:

1. **An annotated assignment from an `Any`-typed expression** —
   `scope_state: dict[str, object] | None = request.scope.get("state")` makes the
   identical unverified assertion as a `cast(` with the token removed. It is the
   spelling a developer reaches for *the moment this gate complains about
   `cast(`*.
2. **Rule 6 counts lines, so `;` defeats it.** Ruff's formatter is the real
   control.
3. **A name assembled at runtime** — `getattr(sa, "t" + "ext")`, `globals()[…]`,
   `importlib`, `eval`. Banning `getattr` was measured (six legitimate calls in
   `src/` today) and rejected.
4. **A banned thing bound and never called in the same file** — `q = sa.text;
   return q`, a module-level `QUERY = sa.text` consumed by an importer, and
   `self.q = sa.text`.
5. **A response object handed through rather than constructed**, and bare
   `Response(...)`.
6. **Writes to a stream it cannot spell** — `open("/dev/stdout").write(v)`,
   `os.write(1, …)`, a handle passed in as a parameter.
7. **An `AsyncSession` obtained without naming a tenant — a rule for this was
   proposed and DECLINED on 2026-08-06.** The gate keys on identifiers and has
   no type resolution, so the affordable rule is "a `Call` on something named
   `sessionmaker`" and a parameter named `session_factory` walks straight
   through — a rule people route around by renaming, leaving no trace.
   `TenantRepository`'s mark (§3.4) is a check on the object instead. **The
   residual that nothing catches:** a raw `session.execute(...)` /
   `session.scalars(...)` in `src/` outside the `db` package. It is still
   tenant-scoped if the session came from `tenant_session`, so it is a layering
   violation rather than a leak — but it is yours to catch in review.

> The honest boundary, in the gate's own words: it catches renames and idioms,
> not adversaries. `"t" + "ext"` is what somebody writes to get past the file,
> and at that point the control is review.

`check_backend_rules.py` does **not** scan `migrations/`. Recorded in
`migrations/__init__.py`.

---

## 5. The lesson, stated once

Plan 01's long form is `01-postgres-correctness.md` §"What eight tasks taught
this plan about injections", including the per-task table and the injection
checklist. **Read it before writing an injection.** This section adds the half
that is not in it, and states the two findings in the form you can apply while
writing rather than discover at review.

### Seven of eight injections shipped unable to fail

One restated its own PROOF (Task 3). One required connecting as a role another
task deliberately makes `NOLOGIN` (Task 4). One forward-referenced a task that
must not exist yet (Task 5). One could not fail on the machine it ran on — it
named port 5432 as "16.14 on the dev box", and WSL's 5432 *is* 18.4 (Task 1).
One could not fail across the connection it was checked on — transactional DDL,
rolled back, versus a catalog test on a separate connection (Task 2). One tested
only the canonical spelling of each rule, against a gate three one-token changes
walked through (Task 0). One **did not exist**, and neither did its PROOF (Task
7). Task 6's held, and is the shape to copy.

**Three separate times the fix was the same: add a positive control.** The
argument for *why*, with the measurement, now lives in
[`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) §1.1 and is not repeated here —
this plan's own gate rules that a reason stated in two places gets half-repealed
by whoever finds the weaker one first. What belongs here is the three instances. A
cardinality floor satisfied by five decoy roles; an enum test comparing a
constant to a value derived from that constant; and every assertion of the form
*"this tenant sees nothing"*, which is equally true of a system that denies
everyone, a broken DSN, and an empty table. A suite of denials cannot tell
*isolated* from *broken*. **And the control must cover the whole derived set**:
the isolation proof's positive control covered `orders` alone, so respelling the
other six tables plus `tenants` to hand every established tenant every other
tenant's rows shipped `192 passed`.

### The other family: a check that matched a *name*, or compared a value to *itself*

Five instances, each of which shipped a fully green suite over a real defect:

| the check | what it matched | what got through |
|---|---|---|
| the `na_reason` enum test | the live `pg_enum` against a constant imported from the module under test — and the live enum was built from the migration's copy of that same tuple | renaming `NOT_PRESENT`/`PRESENT_UNREADABLE` to `NA`/`ALSO_NA` in *both* files left 131 green, violating a CLAUDE.md hard rule |
| the RLS policy assertion | `assert "nullif" in qual.lower()` — a substring | keep `nullif`, replace the comparison with `IS NOT NULL`: every established tenant sees every other tenant's rows, `192 passed` |
| Task 7's CI drift test | the script's *name* appearing somewhere in the workflow YAML | five bypasses, each green: the name inside an `echo`, `if: false` on the step, an `if:` on the whole job naming a trigger that does not exist, `continue-on-error`, and the name in a shell comment |
| the structural gate itself | identifiers | six behaviours reachable without typing the banned name — `s.begin(nested=True)`, `q = sa.text` then `q(...)`, `sys.stdout.write`, `TextClause(...)` direct, an exemption *quoted in prose*, and `HTTPException` evaded by *returning* a response |
| Task 1's version assertion | a numeric version compared to a string derived from the same source | it could not fail independently of the assertion beside it |

Two more of the same shape sit in the catalog helpers rather than in tests, and
are worth knowing because a later plan will reach for them:
`has_table_privilege` and `has_schema_privilege` answer about the **effective**
privilege, so a grant to `PUBLIC` satisfies both — the grantee is a separate
question and has to be asked separately.

### The checklist, in the order you write

Plan 01's checklist tells you what an injection must satisfy. This one tells you
what to do at each point in *writing* a task, so the failure is designed out
rather than reviewed out.

**While writing the PROOF:**

1. **Name the role, the connection and the transaction** each assertion runs
   under. Three of Plan 01's defects were invisible until someone asked "as
   whom?" — superuser bypass, `NOLOGIN`, and rolled-back DDL on another
   connection.
2. **For every denial you assert, write the matching permission.** "A sees
   nothing" needs "B sees exactly its own rows" beside it. If your proof is a
   set of denials, at least one assertion must point the other way.
3. **Make the positive control cover the derived set**, not one member of it. If
   the test derives its tables (or roles, or policies) from the catalog, loop the
   control over the same derivation.
4. **Never compare a value to something derived from the same source.** If the
   expected value comes from the module under test, the test asserts internal
   consistency and says nothing about the contract. Write the literal, and cite
   the document that fixes it.
5. **Assert the shape, anchored, not a substring.** `"nullif" in qual` is the
   assertion that let a cross-tenant leak ship. Match the whole expression with
   the key column and the GUC name as named groups.
6. **Ask what a *zero result* proves.** Zero rows is true of isolation, of a
   broken DSN, of an empty table, and of a role that does not exist. Zero
   affected rows is true of a working `WHERE` and of an RLS refusal.
7. **Assert the grantee, not just the privilege.** `has_*_privilege` cannot tell
   an explicit grant from `PUBLIC`'s.

**While writing the INJECTION:**

8. **Break the behaviour, not one spelling of it.** For anything enforced by a
   name — a gate rule, a workflow step, a catalog check — inject the alias, the
   rebinding, the near-miss and the quoted-in-prose form, not only the textbook
   one.
9. **Check the injection is reachable on this machine, as this role, on this
   connection**, before you write it into the plan.
10. **Check it is not the PROOF restated.** If nothing is broken, it is not an
    injection.
11. **Keep it inside the task.** A task whose proof lives in a later task has no
    proof.
12. **Name the exact assertion that must fail, and the message it must print.**
    "The test must fail" is not falsifiable; "assert 5 == 1" is.

**After it runs:** if the injection reveals that an assertion passed when it
should not have, that is the injection working — Task 6's assertion 4 passed
under the superuser injection because a floor, an `after == before` and a GUC
string are all true of a connection that bypasses RLS. Fix the assertion; do not
narrow the injection.

---

## 6. Open items Plan 01 hands over

Each was checked against the tree at `7e6165a` on 2026-08-06 and is still open.

**1. `scripts/` is type-checked by nothing.** VERIFIED: there is no
`scripts/pyproject.toml`, and no project's `[tool.pyright] include` names
`scripts` — `libs/domain`, `libs/test-support`, `services/blind-svc`,
`services/extraction-svc` and `services/render-svc` are all `["src", "tests"]`,
and `services/core-api` is `["src", "tests", "migrations"]`. The workaround
proposed during Plan 01 — adding `"../../scripts/*.py"` to core-api's `include` —
was measured and **does not work**: a single star does not recurse, so it covers
four files, and pyright's "31 files analysed" was counting followed imports. It
leaves `scripts/tests` and `scripts/gate0` exactly as unchecked as before. The
clean answer is `scripts/pyproject.toml` plus a seventh entry in the CI project
matrix. The matrix-coverage test in `scripts/tests/test_backend_workflow.py`
makes the omission fail loudly the moment anyone adds one.

**2. Migrations are absent from the container image, while `alembic` ships in
it.** VERIFIED: `alembic>=1.18.5,<1.19` is a runtime dependency in
`services/core-api/pyproject.toml`, not a dev group. `.dockerignore` denies by
default and re-includes only `pyproject.toml`, `uv.lock` and `src/` per service —
`migrations/` and `alembic.ini` are in neither list. And re-including them would
**not** be enough: `infra/containers/Dockerfile.core-api`'s runtime stage copies
only `/build/services/core-api/.venv`. So the image carries the migration tool
and none of the migrations. Deciding *how* schema changes reach a deployment —
migration job, init container, or an image that carries `migrations/` — is a
Plan 02-or-later ruling that nobody has made.

**3. `0002._require_schema_usage` uses `has_schema_privilege`, which cannot
distinguish an explicit grant from `PUBLIC`'s.** VERIFIED, still
`WHERE NOT has_schema_privilege(role, 'public', 'USAGE')`. On a stock cluster it
passes even if `roles.sql` granted nothing, so it reads stronger than it is. It
is covered by `roles.sql`'s own guard, which reads `aclexplode(nspacl)` for an
explicit entry, and by a test — but the migration's own check would only start
failing the day somebody hardened the cluster.

**4. `pg_default_acl` is not a shared catalog, so default-privilege convergence
reaches only the database it runs against.** VERIFIED in `roles.sql`'s header —
MEASURED `relisshared`: `pg_authid` t, `pg_auth_members` t,
`pg_db_role_setting` t, `pg_default_acl` **f**, `pg_namespace` f. The per-role
GUC pass immediately above generates its database-scoped statements *from the
catalog* precisely so drift planted against another database is repaired from
here; that trick is unavailable for default privileges because the rows are not
visible from here at all. **A stray `ALTER DEFAULT PRIVILEGES` in a database
this file is never run against survives forever.** No owner.

**5. The seam is not wired into the application at all.** See §2 — no DSN
setting, no engine on `ServiceResources`, no database check in `readiness()`.
Found while writing this document; it is not in any commit message as an open
item, because each task built the piece it was asked for and no task was asked
for the wiring.

**6. Plan 01 is green inside a red workflow.** Seven of twelve jobs failed on the
last `main` run, all predating this plan: hygiene, security, four container jobs,
and `services/blind-svc` — the last of which this branch fixes. Do not read a red
`backend` workflow as a Plan 02 regression without checking which job.

**7. The client-data guard is red on `main`** over 81 tracked files (77 `.png`,
1 `.zip`, 3 `.docx`) and runs *before* the hygiene job's later steps. That is why
all five hygiene gates now carry `if: ${{ !cancelled() }}` — without it, every
step after the guard would never execute. The tracked files themselves are still
there. (`scripts/check_no_client_data.py` is owned by another unit as of
2026-08-06; this entry records the state, not a fix.)

**8. `alembic check` does not compare enum labels** — verified during Task 3: a
fifth label and a reordering both leave it green. The `pg_enum` test is the only
thing catching either. Anything that adds an enum needs its own catalog
assertion.

**9. The `na_reason` taxonomy is settled in the schema and unsettled in the
documents.** Found while writing this; not in any commit message. The shipped
enum is four labels, in this order: `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
`PRESENT_UNREADABLE` (`db/models.NA_REASON_LABELS`, repeated verbatim in `0001`,
asserted against the live `pg_enum` on both count and `enumsortorder`). Plan 01's
Global Contract rules exactly those four, citing nothing. But **PRD §7 says "Two
NA states throughout: `NOT_PRESENT` vs `PRESENT_UNREADABLE`"**, CONTEXT §11
describes *three* (structurally absent · not found · plus `PRESENT_UNREADABLE`
for degraded scans), and HANDOFF §2 records the taxonomy as needing a ruling
"before Gate 6 writes the field model" — which `0001` has now done. CLAUDE.md's
hard rule (the `NOT_PRESENT`/`PRESENT_UNREADABLE` pair must never collapse) is
satisfied and is asserted by a test citing CLAUDE.md and CONTEXT §11. **`NOT_STATED`
is the label no document explains.** Adding or removing a label after data exists
is a migration on a live enum; a plan that touches `fields` should get this ruled
first — and see item 8: `alembic check` will not notice the change.

**10. Known weakness in the isolation proof, recorded rather than papered over.**
Assertion 2 ("A may not write B's row") stays green under the
listener-removal injection, because "A may not write B's row" and "an
unestablished session may not write anything" are the same refusal with the same
SQLSTATE. `test_2b` is the positive write control that partially covers it.

---

## 7. How to check this document is still true

```
cd services/core-api && uv run pytest      # 212 passed  (verified 2026-08-06)
cd libs/domain       && uv run pytest      # 134 passed
python scripts/check_backend_rules.py      # clean, 49 files, exit 0
uv run --with pytest python -m pytest -q scripts/tests   # 194 passed
```

Database tests start their own ephemeral `postgres:18.4` through
testcontainers — no service container, no host cluster, and
`TP_TEST_DATABASE_URL` is validated rather than trusted (it refuses a hostless
URL, a non-PostgreSQL backend, a loopback host without an explicit
acknowledgement, and a `?host=`/`?hostaddr=` query override, because libpq's
query parameters beat the URL host and that reached the developer's own cluster
by peer auth three separate times).

Nineteen commits, `160fcff`…`7e6165a`. Eight of them built a task; the other
eleven corrected the plan before a task could run, or closed the findings of a
review after one had. That ratio is the most honest thing in this document.

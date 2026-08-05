# Plan 01 — Postgres correctness (Gate 2)

> **For agentic execution.** Each task is self-contained: it names its files, the
> exact signatures it consumes and produces, the proof it must pass, and the
> injection that proves the proof is not vacuous. Execute in order. Do not skip a
> task's ANTI-VACUITY step — it is the only thing standing between "the tests
> pass" and "the code works", and on this repo those have diverged every single
> time they were allowed to.

**Goal:** a schema whose tenant isolation is *proven*. No HTTP routes.

**Why first:** every route in Plans 02–06 is tenant-scoped. Retrofitting the
tenant GUC into written handlers is the exact leak ADR-0001 finding 4 records as
*verified in the wild*.

**Parent:** [`docs/backend/BUILD-PLAN.md`](../../backend/BUILD-PLAN.md) §4.

---

## Global constraints — every task inherits these

- **Portable.** Assume only PostgreSQL 18.4, `CREATE ROLE`, and
  `ALTER TABLE … FORCE ROW LEVEL SECURITY`. No provider-specific SQL.
- **Four no-value states:** `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
  `PRESENT_UNREADABLE`. `pending` / `unsettled` are pipeline states, **not**
  members of this enum.
- **Pins stay:** `ruff==0.15.*`, `pyright==1.1.*`, `fastapi==0.139.*`. Upgrading
  is a separate reviewed task.
- **Gate, run from `services/core-api`:** `uv run ruff check .` ·
  `uv run ruff format --check .` · `uv run pyright` · `uv run pytest` ·
  `uv run python ../../scripts/check_backend_rules.py`
- **No `Any`, no `# type: ignore`, no `cast()`** without a `rules-allow:` comment
  carrying a reason ≥12 characters. Task 0 enforces this mechanically.
- **Deps land at the gate that needs them.** This plan adds SQLAlchemy, psycopg,
  Alembic. It adds **no** WorkOS, boto3, Procrastinate or OTel.

### 🔴 HUMAN GATES — an agent must STOP, not improvise

| Gate | Why an agent cannot resolve it |
|---|---|
| **Role count: 4 or 6** | Task 2 encodes it. Proposal in Task 2; needs a ruling. |
| **A running PostgreSQL 18.4** | Tasks 6–7 are meaningless without one. An agent with no database *will* write a test that passes. |
| **Real credentials** | Never invent one. Never commit one. |

---

## Task 0 · The canon and the rules gate — BUILD THIS FIRST

**This is the task that makes the rest safe.** Everything downstream imports from
here instead of re-deriving. Two files in Task 5 that each write their own tenant
scoping is a data leak; two normalizers that disagree is a corrupted accuracy
measurement.

**Files**
- Create `libs/domain/src/titlepipe_domain/tenancy.py`
- Modify `libs/domain/src/titlepipe_domain/__init__.py` — re-export
- Create `scripts/check_backend_rules.py`
- Create `libs/domain/tests/test_tenancy.py`

**Produces** — every later task imports these, and defines no local equivalent:

```python
TenantId = NewType("TenantId", UUID)

TENANT_GUC: Final[str] = "app.current_tenant"

def tenant_guc_value(tenant: TenantId | None) -> str:
    """The GUC payload. `None` → "" — the empty string, never the word 'None'.

    The policy reads this back through nullif(…, '')::uuid, so "" is the ONLY
    value that means "deny everything" without raising. str(None) would be
    "None", which fails the uuid cast and produces a 500 rather than a denial.
    """
```

**The rules gate.** Mechanically checkable product rules only — judgment calls
stay in review, absent rather than badly approximated. Mirror the header style of
`apps/web-v2/scripts/check-rules.mjs`, including an honest list of what it cannot
catch.

| rule | rationale |
|---|---|
| No `Any`, `# type: ignore`, `cast(` outside an escape | pyright strict is the contract |
| No `begin_nested(` under `src/` | a SAVEPOINT unwinds the tenant GUC (Task 5) |
| No `text(` / raw SQL outside `db/` and `migrations/` | tenant scoping must be structural |
| No `HTTPException` outside `api/errors.py` | already a test; make it a gate |
| No `print(` | structlog with redaction is the only output |
| File ≤400 lines under `src/` | the frontend uses 150; Python modules run longer |
| `rules-allow:` needs a reason ≥12 chars | a bare escape hatch is not an escape hatch |

**Proof** — `test_tenancy.py`:
`tenant_guc_value(None) == ""`, `tenant_guc_value(TenantId(u)) == str(u)`, and
**explicitly** `tenant_guc_value(None) != "None"`.

**ANTI-VACUITY.** Add a file containing `x: Any = 1` under `src/`. The gate must
exit non-zero and name the file. Delete it. Then add `# rules-allow: short` — the
gate must *still* fail, on the reason length. Both are hardening the gate against
the first evasion, which is what defeated 9 of 11 frontend rules on audit.

**Done when** the gate runs clean on the existing tree and both injections fail it.

---

## Task 1 · Dependencies and the database seam

**Files**
- Modify `services/core-api/pyproject.toml`
- Create `services/core-api/tests/db.py`

```toml
"sqlalchemy>=2.0.51,<2.1",          # the <2.1 cap is REQUIRED: 2.1.0b3 is on PyPI and is NEWER than stable
"psycopg[binary,pool]>=3.3.4,<3.4",
"alembic>=1.18.5,<1.19",
# dev group:
"testcontainers[postgres]>=4.15.0,<5.0",
```

**TRAP: `testcontainers[postgres]`'s extra is EMPTY** and installs no driver. The
`psycopg[binary]` above is what makes it work. Without it the container starts and
nothing can connect — and the error names the container, not the missing driver.

**Produces**

```python
def resolve_dsn() -> str:
    """Explicit DSN wins; otherwise a throwaway container.

    Both dev machines run the same suite unchanged.
    """

@pytest.fixture(scope="session")
def database_url() -> str: ...
```

Pin **`postgres:18.4`** in the container spec. Not `postgres:latest` — the
isolation proof must not silently change server version between runs.

**Proof:** a test asserting `SELECT version()` reports 18.x.

**ANTI-VACUITY:** point `TITLEPIPE_TEST_DATABASE_URL` at a Postgres 16 container.
The version test must fail. (If you have no second container, assert the test
reads the *actual* server string rather than a constant — a test that hardcodes
"18" and never queries is the failure mode here.)

---

## Task 2 · Roles

### 🔴 HUMAN GATE — the count

`PLAN.md:150` says four. `IMPLEMENTATION_PLAN.md:492-499` lists six. **Proposal: four.**

| role | purpose |
|---|---|
| `titlepipe_migration` | runs Alembic. DDL only. **Not** the table owner |
| `titlepipe_app` | core-api |
| `titlepipe_worker` | extraction / render |
| `titlepipe_blind` | blind-svc — *separate database entirely* |

`_readonly` is a grant pattern, not a principal — nothing connects as it.
`_blind_migration` collapses into `_migration`: the blind database has its own
migration *run*, not its own role vocabulary.

**THE RULE THAT MATTERS:** every role is `NOSUPERUSER NOBYPASSRLS`, and **none of
them owns a table.** A table owner bypasses RLS *by default* — that is the single
most common way a policy set that reads correctly protects nothing. The owner is
a separate principal used only by the DDL that creates the tables, and it never
appears in a connection string.

**Files:** `services/core-api/migrations/sql/roles.sql` (idempotent, hand-written)

**Proof** — a catalog test, for every role: `rolsuper = false`,
`rolbypassrls = false`, and the role does not appear as `pg_class.relowner` for
any tenant table.

**ANTI-VACUITY:** grant `BYPASSRLS` to `titlepipe_app` in a scratch transaction.
The catalog test must fail. Roll back.

---

## Task 3 · Schema and first migration

**Files**
- `services/core-api/alembic.ini`, `migrations/env.py`
- `migrations/versions/0001_initial.py` — **hand-written**
- `src/titlepipe_core/db/models.py`

**`--autogenerate` cannot see policies, grants, roles or enums-in-use.** All of
that is written by hand. Autogenerate is for column drift *after* this point.

Tables: `tenants`, `orders`, `packages`, `pages`, `fields`, `field_readings`,
`audit_log` — the minimum that makes isolation testable, not the whole model.

**Three decisions with teeth:**

**`na_reason` is a Postgres ENUM with exactly four labels** — not text with a
check constraint. An enum makes an unknown value a *write* error rather than a
read-time surprise, and adding a fifth state later becomes a visible migration
rather than a silent widening.

**`field_readings.line_coords` is NULLABLE, and that is load-bearing.** Engines
without coordinate support declare `null`; they never fake a box. Reader A is a
VLM and genuinely cannot cite — provenance is *recovered* by span-matching against
Reader B, not taken from the reader that produced the value.

**`audit_log` is append-only, enforced by a trigger** that raises on UPDATE and
DELETE. Not by convention, not by application discipline — those are the two
things that fail under deadline.

Set a **naming convention on the MetaData** so constraint names are deterministic
and diffs stay readable across machines.

**Proof:** `alembic upgrade head → downgrade base → upgrade head` clean on a fresh
container; the enum has exactly four labels; an `UPDATE audit_log` raises.

**ANTI-VACUITY:** the downgrade must actually drop things. Run
`upgrade → downgrade → upgrade`; if the second upgrade fails on "already exists",
the downgrade was a no-op and the test was passing on nothing.

---

## Task 4 · Forced RLS and the policy form

**Files:** `migrations/versions/0002_rls_policies.py` — hand-written

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;   -- without FORCE the owner still bypasses
CREATE POLICY tenant_isolation ON <t>
  USING      (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
```

**Three details, each of which silently defeats isolation:**

1. **`nullif(…, '')`** — an unset GUC returns `''`, and `''::uuid` **raises**
   rather than denying. Deny must be *zero rows*, not a 500. Without this the
   failure looks like a bug and gets "fixed" by removing the policy.
2. **`current_setting(…, true)`** — returns NULL instead of raising when the
   setting is missing entirely. Both guards are needed; they cover *different*
   absences.
3. **`WITH CHECK` as well as `USING`.** `USING` filters reads. Without
   `WITH CHECK`, a tenant can **insert rows belonging to another tenant** — it
   just cannot read them back. Worse than a read leak, because it is invisible
   from the writing side.

**Proof:** catalog test asserting `relrowsecurity AND relforcerowsecurity` per
tenant table, the policy name, and **both clauses present** (`pg_policies.qual`
*and* `pg_policies.with_check` non-null).

**Squawk will not catch any of this** — it lints lock safety and has no rules for
GRANT, POLICY, RLS or roles. Task 7 states that explicitly so nobody assumes it.

**ANTI-VACUITY:** drop `WITH CHECK` from one policy. The catalog test must fail.
If it still passes, it is only checking that a policy *exists*.

---

## Task 5 · Tenant-scoped session and repository base — THE shared component

**Every database access in every later plan goes through this.** It is the reason
tenant scoping cannot be forgotten: there is no un-scoped path to reach for.

**Files**
- `src/titlepipe_core/db/session.py`
- `src/titlepipe_core/db/repository.py`

**Produces** — Plans 02–06 consume these exact signatures:

```python
def make_engine(dsn: str) -> AsyncEngine: ...
def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]: ...

@asynccontextmanager
async def tenant_session(
    sessionmaker: async_sessionmaker[AsyncSession],
    tenant: TenantId | None,
) -> AsyncIterator[AsyncSession]:
    """The ONLY way to reach the database in a request path.

    `tenant=None` is legal and means deny-everything — used by health checks and
    by the migration path, which must not silently inherit a previous tenant.
    """

class TenantRepository[T: Base]:
    """Base for every repository. Holds a session; never opens one."""
    model: ClassVar[type[T]]
    def __init__(self, session: AsyncSession) -> None: ...
    async def get(self, id_: UUID) -> T | None: ...
    async def add(self, entity: T) -> None: ...
```

The hook:

```python
@event.listens_for(Session, "after_begin")
def _apply_tenant(session: Session, transaction: object, connection: Connection) -> None:
    connection.exec_driver_sql(
        "SELECT set_config(%s, %s, true)",           # true = SET LOCAL semantics
        (TENANT_GUC, tenant_guc_value(session.info.get("tenant_id"))),
    )
```

**Three traps, each verified, each silently fatal:**

**TRAP 1 — `SET LOCAL` outside a transaction is a documented no-op** that emits
only a WARNING, never an error. Any path reaching the database in autocommit runs
with *no tenant set*. Under a permissive policy, that reads everything.

**TRAP 2 — `SAVEPOINT` unwinds the GUC.** Postgres cancels `SET LOCAL` effects
when rolling back to a savepoint earlier than the command. SQLAlchemy's
`begin_nested()` issues savepoints. **Task 0's gate bans it under `src/`.**

**TRAP 3 — `after_begin` is ORM-only.** It lives on `SessionEvents`, not
`ConnectionEvents` or `PoolEvents`. Raw `engine.connect()`, Alembic, ad-hoc
scripts and Procrastinate's own connection usage **bypass it entirely**. Anything
tenant-scoped goes through a Session; the paths that legitimately do not
(migrations) run as `_migration`, which is not `_app`.

Note: **pgbouncer in transaction-pooling mode is compatible** with this, because
the GUC dies with the transaction — exactly the pooling boundary. Session pooling
would be the dangerous one.

**Proof:** `tenant_session` applies the GUC (assert `current_setting` inside);
`tenant=None` yields `''`; the repository base cannot be constructed with a raw
connection.

**ANTI-VACUITY:** remove `, true` from `set_config` — making it session-scoped
rather than transaction-scoped. Task 6's assertion 1 must fail. This is the exact
leak ADR-0001 documents, so if Task 6 still passes, Task 6 is not testing what it
claims.

---

## Task 6 · The leak test — the deliverable

### 🔴 HUMAN GATE: needs a real PostgreSQL 18.4. Do not simulate it.

Everything above is scaffolding for this.

**Shape — two tenants, ONE pooled connection, interleaved:**

```
A: open session → write 3 orders → commit → close → connection returns to pool
B: open session → SAME pooled connection → SELECT * FROM orders → MUST be 0 of A's
```

**`pool_size=1, max_overflow=0` for this test, or it proves nothing.** With a
larger pool, B may get a *fresh* connection and pass for the wrong reason. That is
the single easiest way to write a leak test that always passes.

Six assertions, each closing a distinct hole:

| # | asserts | closes |
|---|---|---|
| 1 | cross-read is zero after pool reuse | the GUC surviving checkout — the ADR's verified leak |
| 2 | cross-write refused: B inserting A's `tenant_id` raises | `WITH CHECK` (Task 4) |
| 3 | unset tenant reads zero rows and does **not** raise | the `nullif` guard |
| 4 | tenant still applied after a savepoint rollback | TRAP 2 |
| 5 | raw `engine.connect()` sees nothing without an explicit tenant | TRAP 3 |
| 6 | `titlepipe_app` cannot `SET ROLE` to the owner | Task 2's ownership rule |

**Exit criterion:** all six green on a fresh `postgres:18.4`. `PLAN.md §5` item 5
— *"nothing ships until this passes"* — refers to this test.

**ANTI-VACUITY, mandatory, all three:**
- Set `pool_size=5`. Assertion 1 should become unreliable → proves it depends on
  pool reuse rather than passing incidentally.
- Apply Task 5's injection (drop `, true`). Assertion 1 must fail.
- Apply Task 4's injection (drop `WITH CHECK`). Assertion 2 must fail.

**If any injection leaves the suite green, the suite is decorative.** Fix the test
before proceeding — this is the whole gate.

---

## Task 7 · CI

**Files:** `.github/workflows/backend.yml`

Add: a Postgres 18.4 service, `alembic upgrade head`, the pytest run including
Tasks 6's suite, `squawk-cli==2.61.0` on changed migration SQL, and Task 0's
rules gate.

**State plainly in the workflow what Squawk does not cover:** GRANT, CREATE
POLICY, RLS, roles. `PLAN.md:150` bundles "Alembic + Squawk … the four DB roles …
RLS policies" into one line, which reads as if the linter checks security posture.
It does not. **Task 4's catalog test is what covers that**, and the job should
name both so nobody later assumes one implies the other.

---

## Definition of done — mechanically checkable

```
uv run ruff check .                        clean
uv run ruff format --check .               clean
uv run pyright                             0 errors
uv run pytest                              green, incl. all six leak assertions
uv run python scripts/check_backend_rules.py   clean
squawk                                     clean on changed migrations
alembic upgrade head → downgrade base → upgrade head    no error
```

Plus, and these are the ones that actually matter:

- Every tenant table has `relrowsecurity AND relforcerowsecurity`.
- No role is superuser, bypassrls, or a table owner.
- **Every ANTI-VACUITY injection has been run and observed to fail.** Record which,
  in the commit message. "Tests pass" is not evidence; "tests fail without the
  fix" is.

**Not in this plan:** any HTTP route, WorkOS, R2, Procrastinate, OTel. Those land
at the gate that first needs them, so an unused dependency never reaches a
production image.

# Plan 01 — Postgres correctness (Gate 2)

**Goal:** a schema whose tenant isolation is *proven*, not asserted. No HTTP
routes. Nothing in Plans 02–06 may start until the leak test is green.

**Why first:** every route in every later plan is tenant-scoped. Retrofitting the
tenant GUC into handlers already written is the exact leak ADR-0001 finding 4
names as *verified in the wild*.

**Format:** dense — decisions, traps and proofs. Ask for `expand Task N` to get
full step-by-step TDD for any single task.

**Parent:** [`docs/backend/BUILD-PLAN.md`](../../backend/BUILD-PLAN.md) §4.

---

## Constraints this plan operates under

- **Portable.** May assume only PostgreSQL 18.4, `CREATE ROLE`, and
  `ALTER TABLE … FORCE ROW LEVEL SECURITY`. No provider-specific SQL — deployment
  is undecided (ruling 4) and several managed providers restrict exactly these.
- **Four no-value states** (ruling 1): `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
  `PRESENT_UNREADABLE`. `pending` and `unsettled` are *pipeline* states and are
  **not** members of this enum.
- **Testcontainers on the second dev machine** (ruling 2), behind a
  `_resolve_dsn()` seam so a local server also works.
- **Deps land at the gate that needs them.** This plan adds SQLAlchemy, psycopg
  and Alembic to `core-api`. It does **not** add WorkOS, boto3, Procrastinate or
  OTel.
- Current pins stay: `ruff==0.15.*`, `pyright==1.1.*`, `fastapi==0.139.*`.
  Upgrading is a separate reviewed task.

---

## Task 1 · Dependencies and the test-database seam

**Adds to `services/core-api/pyproject.toml`:**

```toml
"sqlalchemy>=2.0.51,<2.1",     # the <2.1 cap is REQUIRED — 2.1.0b3 is on PyPI and is NEWER than stable
"psycopg[binary,pool]>=3.3.4,<3.4",
"alembic>=1.18.5,<1.19",
```

dev group: `testcontainers[postgres]>=4.15.0,<5.0`.

**TRAP: `testcontainers[postgres]`'s extra is EMPTY** and installs no driver.
`psycopg[binary]` above is what makes it work — without it the container starts
and nothing can connect.

**The seam** (`tests/db.py`):

```python
def _resolve_dsn() -> str:
    """Explicit DSN wins; otherwise a throwaway container."""
    if dsn := os.getenv("TITLEPIPE_TEST_DATABASE_URL"):
        return dsn
    return _postgres_container().get_connection_url()
```

Both machines run the same suite unchanged. **Pin `postgres:18.4`** in the
container spec — not `postgres:latest`, or the isolation proof silently changes
server version between runs.

**Proof:** a test asserting `SELECT version()` reports 18.x, so a wrong server
fails loudly rather than passing a weaker check.

---

## Task 2 · Roles, and the count reconciliation

**Decide first — the test encodes whichever we pick.** `PLAN.md:150` says four;
`IMPLEMENTATION_PLAN.md:492-499` lists six.

**Proposed: four**, because the two extras do not earn a role.

| role | purpose | grants |
|---|---|---|
| `titlepipe_migration` | runs Alembic | DDL on the schema; **NOT** table owner |
| `titlepipe_app` | core-api | SELECT/INSERT/UPDATE on tenant tables |
| `titlepipe_worker` | extraction/render | as `app`, minus the tables it must never write |
| `titlepipe_blind` | blind-svc | **separate database entirely** — see below |

`_readonly` is a grant pattern, not a principal — nothing connects as it.
`_blind_migration` collapses into `_migration` because the blind database has its
own migration run, not its own role vocabulary.

**Every role is `NOSUPERUSER NOBYPASSRLS` and none owns a table.** A table owner
bypasses RLS *by default* — that is the single most common way a policy set that
looks correct protects nothing. The owner is a fifth principal used only by the
DDL that creates them, and it never appears in a connection string.

**Proof:** a catalog test asserting, for every role,
`rolsuper = false AND rolbypassrls = false`, and that none of them appears as
`pg_class.relowner` for any tenant table.

---

## Task 3 · Schema, first revision

Hand-written Alembic revision. **`--autogenerate` cannot see policies, grants or
roles**, so all of that is written by hand and autogenerate is used only for
column-level drift after this point.

Tables this plan creates (the minimum that makes isolation testable, not the
whole model): `tenants`, `orders`, `packages`, `pages`, `fields`,
`field_readings`, `audit_log`.

**`na_reason` as a Postgres enum with exactly four members.** Not a text column
with a check constraint — an enum makes an unknown value a write error rather
than a read-time surprise, and it is the one shape where adding a fifth state
later is a visible migration rather than a silent widening.

**`field_readings.line_coords` is NULLABLE and that is load-bearing.** Engines
without coordinate support declare `null`; they never fake a box. Reader A
(a VLM) genuinely cannot cite, which is why provenance is *recovered* by span
matching against Reader B rather than taken from the reader that produced the
value.

**`audit_log` is append-only**, enforced by a rule/trigger that raises on UPDATE
and DELETE — not by convention and not by application discipline.

**Naming convention set on the MetaData** so constraint names are deterministic
and Alembic diffs stay readable across machines.

**Proof:** the migration runs up, down, and up again on a fresh container with no
error, and the enum has exactly four labels.

---

## Task 4 · Forced RLS and the policy form

Every tenant table gets:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <t> FORCE ROW LEVEL SECURITY;   -- without FORCE, the owner still bypasses
CREATE POLICY tenant_isolation ON <t>
  USING      (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
```

**Three details, each of which silently defeats isolation if wrong:**

1. **`nullif(…, '')`** — an unset GUC returns `''`, and `''::uuid` **raises**
   rather than denying. Deny must be *zero rows*, not a 500. Without `nullif` the
   failure mode is an error page, which looks like a bug and gets "fixed" by
   removing the policy.
2. **The `true` second argument** to `current_setting` returns NULL instead of
   raising when the setting is missing entirely. Both guards are needed; they
   cover different absences.
3. **`WITH CHECK` as well as `USING`.** `USING` filters reads. Without
   `WITH CHECK`, a tenant can *insert rows belonging to another tenant* — they
   just cannot read them back. That is a worse bug than a read leak because it is
   invisible from the writing side.

**Proof:** a catalog test asserting `relrowsecurity AND relforcerowsecurity` for
every tenant table, plus the expected policy name and both clauses present.
**Squawk will not catch any of this** — it lints lock safety, not security
posture, and has no rules for GRANT, POLICY, RLS or roles.

---

## Task 5 · Tenant context, and the three ways it leaks

```python
@event.listens_for(Session, "after_begin")
def _apply_tenant(session, transaction, connection):
    tenant = session.info.get("tenant_id")
    connection.exec_driver_sql(
        "SELECT set_config('app.current_tenant', %s, true)", (str(tenant) if tenant else "",)
    )
```

`is_local=true` is the third argument — SET LOCAL semantics, scoped to the
transaction.

**TRAP 1 — `SET LOCAL` outside a transaction is a documented no-op** that emits
only a WARNING, never an error. Any path reaching the database in autocommit runs
with **no tenant set**. Under a permissive policy that reads everything.

**TRAP 2 — `SAVEPOINT` unwinds the GUC.** Postgres cancels `SET LOCAL` effects
when rolling back to a savepoint earlier than the command. SQLAlchemy's
`begin_nested()` issues savepoints. **Ban `begin_nested()` in request paths**, or
re-apply after every savepoint rollback. This plan bans it and adds a check.

**TRAP 3 — `after_begin` is ORM-only.** It lives on `SessionEvents`, not
`ConnectionEvents` or `PoolEvents`. Raw `engine.connect()`, Alembic, ad-hoc
scripts and **Procrastinate's own connection usage** bypass it entirely. Anything
that must be tenant-scoped goes through a Session, and the ones that legitimately
do not (migrations) run as `_migration`, which is not `_app`.

**Also: pgbouncer in transaction-pooling mode is compatible with SET LOCAL** —
because the GUC dies with the transaction, which is exactly the pooling
boundary. Session-pooling mode would be the dangerous one.

---

## Task 6 · The leak test — the deliverable

This is why Plan 01 exists. Everything above is scaffolding for it.

**Shape:** two tenants, **one pooled connection**, interleaved.

```
tenant A opens session → writes 3 orders → commits → session closes → conn returns to pool
tenant B opens session → gets the SAME pooled connection
                       → SELECT * FROM orders
                       → MUST see 0 rows of A's
```

Six assertions, each closing a distinct hole:

1. **Cross-read is zero** after a pool checkout that previously served another tenant.
2. **Cross-write is refused** — B inserting with A's `tenant_id` violates `WITH CHECK`.
3. **Unset tenant reads zero rows**, and does *not* raise. (The `nullif` guard.)
4. **After a savepoint rollback**, the tenant is still applied. (Trap 2.)
5. **A raw `engine.connect()` sees nothing** without an explicit tenant — proving
   Core access is not accidentally privileged. (Trap 3.)
6. **The `app` role cannot `SET ROLE` to the owner** or otherwise bypass.

**Pool size must be 1** for this test, or it proves nothing — with a larger pool
B may get a fresh connection and pass for the wrong reason. That is the single
easiest way to write a leak test that always passes.

**Exit criterion:** all six green on a fresh `postgres:18.4` container.
`PLAN.md §5` item 5 — *"nothing ships until this passes"* — refers to this test.

---

## Task 7 · Squawk in CI, honestly scoped

Add `squawk-cli==2.61.0` to the backend workflow, linting migration SQL for lock
safety on the diff.

**State plainly what it does not cover:** GRANT, CREATE POLICY, RLS, roles.
`PLAN.md:150` bundles "Alembic + Squawk … the four DB roles … RLS policies" into
one gate line, which reads as if the linter checks the security posture. It does
not. **Task 4's catalog test is what covers that**, and the CI job should name
both so nobody later assumes one implies the other.

---

## Definition of done

```
uv run ruff check .          clean
uv run ruff format --check . clean
uv run pyright               0 errors
uv run pytest                all green, including the six leak assertions
squawk                       clean on the migration
alembic upgrade head → downgrade base → upgrade head   no error
```

Plus: the catalog test proves forced RLS on every tenant table, and no role is
superuser, bypassrls, or a table owner.

**Not in this plan:** any HTTP route, WorkOS, R2, Procrastinate, OTel. Those land
at the gate that first needs them, so an unused dependency never reaches a
production image.

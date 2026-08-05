# Plan 01 — Postgres correctness

> **Read [`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) first.** It defines the
> dispatch/verify/inject/review loop, what to tell each subagent, and when to
> stop. This file is *what to build and how to prove it*.

**Ships:** a schema whose tenant isolation is proven. No HTTP routes.

**Why first:** every route in Plans 02–06 is tenant-scoped. Retrofitting the
tenant GUC into handlers already written is the leak ADR-0001 finding 4 records
as verified in the wild.

**Every SQL claim below was executed against PostgreSQL 18.4 on 2026-08-05 and
produced the stated result.** Surprises are recorded where they happened.

---

## How this plan specifies things

Each task gives a **CONTRACT** (what must be true when it is done), a **PROOF**
(how you know), and an **INJECTION** (what to break so you know the proof works).

It deliberately does *not* dictate every column and function body. The executing
subagent can read the repo and run the database; it decides the code. **The
proofs are written to enumerate from the live catalog rather than from a list in
this file**, so they hold whatever the subagent chose.

Where a decision genuinely cannot be derived — a ruling, a credential — it is a
🔴 HUMAN GATE and you stop.

---

## Global contract

- **PostgreSQL 18.4.** Not 16, not 19. **Supplied by an ephemeral container**
  (`postgres:18.4`), not by a host cluster — ruled 2026-08-05, see below.
- **Portable:** only `CREATE ROLE` and `FORCE ROW LEVEL SECURITY` are assumed.
  No provider-specific SQL — deployment is undecided.
- **Four no-value states**, exactly: `NOT_PRESENT`, `NOT_FOUND`, `NOT_STATED`,
  `PRESENT_UNREADABLE`. (`pending`/`unsettled` are pipeline states, not members.)
- **Pins stay:** `ruff==0.15.*`, `pyright==1.1.*`, `fastapi==0.139.*`.
- **`uv.lock` is regenerated and committed** whenever `pyproject.toml` changes;
  CI runs `uv sync --frozen`.
- **`pytest.mark.skip` / `xfail` are forbidden in this plan's tests.** A skipped
  isolation test is a failed one.

**Gate — run from `services/core-api` unless stated:**

```
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
cd ../../libs/domain && uv run pytest      # Task 0 lives here and is NOT collected above
uv run python ../../scripts/check_backend_rules.py
```

That second `pytest` is not a nicety: `services/core-api/pyproject.toml` sets
`testpaths = ["tests"]`, so the core-api gate never sees `libs/domain/tests/`.

### 🔴 HUMAN GATES

**All three are resolved. They are kept, with their answers, because a gate that
vanishes once answered gets re-opened by the next executor.**

| gate | resolution, 2026-08-05 |
|---|---|
| **Role passwords** | `TITLEPIPE_{MIGRATION,APP,WORKER,BLIND}_PASSWORD`. `titlepipe_owner` is NOLOGIN and has none. **No values supplied and none needed** — `roles.sql` reads the environment and fails loudly when unset; tests inject per-session throwaways. A real value must never reach this repository. |
| **A running PostgreSQL 18.4** | An ephemeral `postgres:18.4` container, not a host cluster. `TP_TEST_DATABASE_URL` overrides, and is validated so it cannot silently reach the developer's own cluster. See Task 1. |
| **PRD §7 vs skeleton columns** | **Skeleton.** `id`, `tenant_id`, `created_at` plus the two typed columns, no FKs. See Task 3 for what asking exposed in §7. |

---

## Task 0 · The canon and the rules gate

**Build this first — everything imports from it rather than re-deriving.** Two
modules that each invent tenant scoping is a data leak; two normalizers that
disagree is a corrupted accuracy measurement.

**CONTRACT**

`libs/domain` exports `TenantId`, `TENANT_GUC`, and `tenant_guc_value()`.

`tenant_guc_value(None)` returns the **empty string** — never `"None"`, never
`None`. *Proven 2026-08-05: `''::uuid` raises `invalid input syntax for type
uuid: ""`, while `nullif('','')::uuid` is NULL and denies cleanly. The empty
string is the only correct sentinel, and only because the policy wraps it in
`nullif`.*

`scripts/check_backend_rules.py` exits non-zero on any of:

| rule | scope |
|---|---|
| `Any`, `# type: ignore`, `cast(` | `src/` |
| `begin_nested(` | `src/` — a SAVEPOINT unwinds the tenant GUC |
| `text(` / `exec_driver_sql(` | `src/` **except** `*/db/` |
| `HTTPException` | `src/` except `api/errors.py` |
| `print(` | `src/` |
| file > 400 lines | `src/` |
| `rules-allow:` with a reason under 12 chars | everywhere |

Scan roots resolve from the **repo root**, not `cwd`: `services/*/src`,
`libs/*/src`. **`tests/` is never scanned** — later tasks require raw SQL there.

**⚠ The gate will not be clean on the current tree.** Existing code predates
these rules. Part of this task is to bring `services/*/src` and `libs/*/src` into
compliance, or to record a specific, reasoned `rules-allow:` where the existing
code is right and the rule is too blunt. Report which you did and why.

**PROOF** — `libs/domain/tests/test_tenancy.py`, run from `libs/domain`:
`tenant_guc_value(None) == ""`, and explicitly `!= "None"`.

**INJECTION — all seven, one at a time.** Add a file under `src/` violating each
rule; each must exit non-zero and name the file. Then `# rules-allow: short` —
must still fail, on reason length. *A gate exercised on one rule is a gate tested
on one rule; this repo's frontend equivalent was defeated on 9 of 11 rules by the
first evasion tried.*

**That is not sufficient, and was proven not to be on 2026-08-05.** All ten
injections above passed against a gate that three one-token changes walked
straight through. Testing only the *canonical spelling* of each rule is the same
vacuity as a catalog proof against an empty database. Also inject, and require a
non-zero exit for each:

- **the aliased and rebound spellings** — `from sqlalchemy import text as sql`,
  `_emit = print`, `savepoint = session.begin_nested`. The first of these is the
  *conventional* SQLAlchemy import, so this is an accident waiting to happen, not
  an adversary. A gate keyed on the token being followed by `(` misses all three.
- **the other suppression comment** — this repo type-checks with **pyright**, so
  `# pyright: ignore` must be banned alongside `# type: ignore`. Six were sitting
  in scanned `src/` when the rule was written, unflagged.
- **the near-miss path exemptions** — `notapi/errors.py` must fire (a suffix
  match exempts it) and `api/db/routes.py` must fire (a substring match gives a
  route handler the raw-SQL carve-out).
- **a scan that finds nothing must FAIL.** Point the script at a nonexistent
  root: `Scanned 0 files` with exit 0 is the failure mode this script is most
  likely to have in the wild, and it reads as success. Same cardinality floor the
  catalog proofs need.

And require the **negative** direction, which is what separates a gate from a
grep: `response.text`, a parameter named `text`, `scrub_text(`, and every banned
name inside a string literal or a comment must **not** fire. A rule that flags
the sentence documenting the rule gets the documentation deleted.

**Known hole, not closeable by this gate — say so rather than implying cover.**
An annotated assignment from an `Any`-typed expression is a fourth spelling of
type erasure: `x: dict[str, object] | None = request.scope.get("state")` makes
the identical unverified assertion as `cast(...)` with the token that advertises
it removed, and pyright accepts it because assigning `Any` to a declared type is
always allowed. *Verified: the rewrite passes pyright, passes the tests, and
passes this gate with no exemption at all.* It is the spelling a developer
reaches for the moment the gate complains about `cast(`. The countermeasure is
review, plus preferring runtime-checked construction (`[dict(e) for e in raw]`)
over assertion.

---

## Task 1 · Dependencies and the database seam

**CONTRACT**

`services/core-api` depends on `sqlalchemy>=2.0.51,<2.1` (the `<2.1` cap is
required — `2.1.0b3` is on PyPI and is *newer* than stable),
`psycopg[binary,pool]>=3.3.4,<3.4`, `alembic>=1.18.5,<1.19`, and dev
`testcontainers[postgres]>=4.15.0,<5.0`. `uv.lock` regenerated and committed.

`services/core-api/tests/conftest.py` exposes session-scoped fixtures giving
**three distinct DSNs**, because they are three different privilege levels:

| fixture | connects as | used for |
|---|---|---|
| `admin_dsn` | superuser | `roles.sql`, seeding |
| `migration_dsn` | `titlepipe_migration` | Alembic |
| `app_dsn` | `titlepipe_app` | **every isolation assertion** |

**Fixtures must live in `conftest.py`.** pytest does not collect fixtures from
arbitrary modules such as `tests/db.py`.

**Three traps, all verified:**

- `PostgresContainer.get_connection_url()` returns **`postgresql+psycopg2://`**
  by default. psycopg2 is deliberately not a dependency. Pass
  `driver="psycopg"`.
- `testcontainers[postgres]`'s extra is **empty** and installs no driver;
  `psycopg[binary]` is what makes it connect.
- The override env var **must not start with `TITLEPIPE_`**. `settings.py` sets
  `env_prefix="TITLEPIPE_"` with `extra="forbid"`, so `CoreApiSettings` would
  reject its own test variable. Use `TP_TEST_DATABASE_URL`.

**PROOF** A test reads `SELECT current_setting('server_version')` and asserts it
starts with `18.`, **and** asserts `180000 <= server_version_num < 190000`.

*An earlier revision of this line justified the numeric check by saying a
prefix "would be confused by a future `180.x`". That is wrong —
`"180.1".startswith("18.")` is `False`. It also suggested `>= 180000`, which
cannot fail independently: `server_version_num` is `major*10000 + minor`, so the
prefix assertion passing already implies it. The bounded range is the version
that can actually fail on its own, which is the only reason to write a second
assertion at all.*

**INJECTION — the one this plan originally specified does not work here, and
would have recorded a pass as proof.** The original text read *"point
`TP_TEST_DATABASE_URL` at port 5432 (16.14 on the dev box); the version test
must fail."* Measured on the actual dev machine, 2026-08-05:

| where | what is really there |
|---|---|
| WSL `127.0.0.1:5432` | cluster `18/main`, online, **PostgreSQL 18.4** — the *right* major |
| WSL `127.0.0.1:5433` | nothing listening |
| Windows host `172.24.192.1:5432` and `:5433` | unreachable from WSL (NAT + firewall) |
| majors installed in WSL | **18 only.** There is no 16 to point at. |

So the specified injection points the version test at an 18.4 server, the test
**passes**, and a green injection gets written into the commit as evidence — the
precise vacuity this protocol exists to prevent.

**Replacement, verified runnable before being written here:** run the wrong
major as a container and point `TP_TEST_DATABASE_URL` at it.

```
docker run --rm postgres:16   postgres --version   →  16.14   ← the wrong major
docker run --rm postgres:18.4 postgres --version   →  18.4
```

`postgres:16` resolves to exactly the 16.14 the original text names. This needs
no second cluster, is re-runnable, and exercises the `testcontainers` path this
task already depends on.

**This is also why the database is a container and not the host cluster.** Task
3 runs `upgrade head → downgrade base → upgrade head` against a *fresh*
database and Task 6 seeds tenants into it. Doing that to a developer's
persistent cluster is worse than disposable. `00-HOW-TO-EXECUTE.md` §7 already
lists Docker as an acceptable source.

**Correction, 2026-08-05 — an earlier revision of this section claimed the host
cluster "could not be authenticated to anyway". That was false, and it was
false in the direction that matters.** It was concluded from two failures — TCP
to `127.0.0.1:5432` (password auth, `.pgpass` entry stale) and `sudo -u
postgres` (wants an interactive password) — without trying the default path:

```
psql -tAc "select current_user, current_setting('server_version')"
  rahul|18.4 (Ubuntu 18.4-1.pgdg26.04+1)
```

**Peer auth over the unix socket succeeds.** So the developer's real 18.4
cluster is one `TP_TEST_DATABASE_URL='postgresql:///postgres'` away from being
dropped and re-seeded by Task 3, and *proven reachable with Docker switched
off*:

```
DOCKER_HOST=tcp://127.0.0.1:1 TP_TEST_DATABASE_URL='postgresql:///postgres' pytest
  3 passed
```

That is a green suite with no container, no isolation, and the ruling on this
page bypassed. `TP_TEST_DATABASE_URL` is therefore **not** an unguarded escape
hatch: the fixture must reject a hostless (unix-socket) URL and any non-
PostgreSQL backend, so the override cannot silently become the thing this
ruling exists to prevent. An override that can defeat the rule it lives under is
not an override, it is a hole.

---

## Task 2 · Roles

**CONTRACT**

Five roles. The owner is the one that matters and it is **`NOLOGIN`**:

| role | login | purpose |
|---|---|---|
| `titlepipe_owner` | **no** | owns every table; nothing connects as it |
| `titlepipe_migration` | yes | runs Alembic; member of `titlepipe_owner` |
| `titlepipe_app` | yes | core-api |
| `titlepipe_worker` | yes | extraction / render |
| `titlepipe_blind` | yes | blind-svc, separate database |

All five: `NOSUPERUSER NOBYPASSRLS`. **A table owner bypasses RLS unless `FORCE`
is set**, which is why ownership sits with a role nothing logs in as.

`migrations/sql/roles.sql` is **idempotent and creates all five**, taking
passwords from the environment — never a literal. Name the variables in the file
and fail loudly if unset.

**🔴 HUMAN GATE — RESOLVED 2026-08-05.** The variable names are:

```
TITLEPIPE_MIGRATION_PASSWORD
TITLEPIPE_APP_PASSWORD
TITLEPIPE_WORKER_PASSWORD
TITLEPIPE_BLIND_PASSWORD
```

`titlepipe_owner` has none, by design — it is `NOLOGIN`, and giving the role
that owns every table a way to log in is the whole failure this arrangement
prevents.

**No value was supplied and none is needed.** `roles.sql` reads these from the
environment and must fail loudly, naming the missing variable, when one is
unset. Test runs inject per-session throwaways generated by Task 1's
`role_passwords` fixture (`secrets.token_urlsafe(32)`, distinct per role)
against a container destroyed at the end of the session. A real value belongs in
a deployment environment and must never reach this repository.

**`CREATE TABLE` sets the owner to the CURRENT role, not to a role you merely
inherit.** So `migrations/env.py` must issue `SET ROLE titlepipe_owner` on the
connection immediately after connect, before `context.begin_transaction()`.
Without it, tables are owned by whoever ran Alembic and the contract fails.

**PostgreSQL 15+ revoked `CREATE` on schema `public` from `PUBLIC`.** *Proven:
without an explicit grant, `CREATE TABLE` as the owner fails with `permission
denied for schema public`.* `roles.sql` must grant it.

**PROOF** — a catalog test that **enumerates roles from `pg_roles`**, not from a
list here:
- every `titlepipe_*` role: `rolsuper = false`, `rolbypassrls = false`;
- `titlepipe_owner`: `rolcanlogin = false`;
- every table in `public`: `relowner` is `titlepipe_owner`;
- no LOGIN role appears as any table's `relowner`.

**INJECTION — the specified one cannot work; it is replaced.** The original read
*"`ALTER ROLE titlepipe_app BYPASSRLS;` in a transaction you roll back. The
catalog test must fail."* `ALTER ROLE` is transactional DDL, so an uncommitted
change is invisible outside its own session — and the catalog test runs on a
**separate connection**. It would query `pg_roles`, see `rolbypassrls = false`,
and pass. A green injection recorded as proof, again.

**Replacement — commit it, assert, then put it back:**

```sql
ALTER ROLE titlepipe_app BYPASSRLS;      -- committed, not rolled back
-- run the catalog test: it MUST fail on rolbypassrls
ALTER ROLE titlepipe_app NOBYPASSRLS;    -- restore
-- run it again: green
```

This is safe here only because the database is an ephemeral container that is
destroyed at the end of the session. **Never run this against a shared or
persistent cluster** — it grants a login role the ability to read every tenant's
rows for as long as it is set.

Also inject the **cardinality floor** below by dropping four of the five roles
and confirming the test fails on the count rather than passing over a short
list.

---

## Task 3 · Schema and first migration

**🔴 HUMAN GATE — RESOLVED 2026-08-05: (a) skeleton.** Each of the seven tables
carries `id`, `tenant_id` and `created_at`, plus the two typed columns below.
**No FKs between them.** Plan 01 is a security gate; every column added now is a
column migrated later, and the domain above these tables is still moving.

*Why the question was asked at all, and what it exposed:* `docs/PRD.md` §7
defines 24 tables, of which this plan needs 7. Its header says **"every table
has tenant_id"**, but the per-table lists spell `tenant_id` out only on `users`,
`clients`, `orders` and `audit_log` — **not** on `packages`, `pages`,
`documents`, `fields` or `field_readings`, which are exactly the tables Task 4
must write a policy on. That is almost certainly shorthand rather than intent,
but "almost certainly" is not a sound basis for the one column every RLS policy
keys on. If those tables genuinely lacked `tenant_id`, isolation would have to
join up a four-level FK chain — weaker, slower, and a different Task 4.

**The skeleton settles it in the direction RLS needs: every tenant table carries
its own `tenant_id`, and no policy ever joins to find one.** When the real model
lands, §7 must be corrected to say so explicitly for all six.

**CONTRACT**

Tables: `tenants`, `orders`, `packages`, `pages`, `fields`, `field_readings`,
`audit_log`.

**`tenants` is the registry, not a tenant table** — its PK *is* the tenant id, so
its policy is on `id`. The other six are **tenant tables** and each carries
`tenant_id uuid NOT NULL`.

Two typed columns are not negotiable whichever option is chosen:
- `fields.na_reason` — a Postgres **ENUM named `na_reason`** with exactly the
  four labels. An enum makes an unknown value a *write* error rather than a
  read-time surprise.
- `field_readings.line_coords jsonb NULL` — **nullable is load-bearing.** Engines
  without coordinate support declare `null` and never fake a box. Reader A is a
  VLM and genuinely cannot cite.

`audit_log` is append-only, enforced by a trigger that is **`FOR EACH
STATEMENT`**. *`FOR EACH ROW` never fires: under RLS an UPDATE with a mismatched
tenant matches zero rows, so a row-level trigger is silent and the proof passes
vacuously. Proven — the statement-level trigger raises regardless of matched
rows.*

`Base` is a plain `DeclarativeBase` (not `MappedAsDataclass`) in
`src/titlepipe_core/db/models.py`, carrying a `MetaData` naming convention so
constraint names are deterministic. Task 5 imports this exact symbol.

Alembic revision ids are the literal strings `"0001"` and `"0002"`, so Task 4's
`down_revision` matches. `migrations/` needs `__init__.py` or ruff reports
`INP001`.

**Hand-write the migration. `--autogenerate` cannot see policies, grants, roles
or enums.**

**Task 0's rules gate does not scan `migrations/`.** Its scan roots are
`services/*/src` and `libs/*/src`, so a `print(`, an `Any` or an un-scoped raw
statement in a migration is invisible to it — *verified 2026-08-05: a migration
carrying all three reported clean*. That is the correct default (a migration is
almost entirely raw SQL by nature), but it means the migrations are reviewed by
hand and nothing else. Either widen the scan roots and give `migrations/` the
same carve-out `*/db/` has, or state in the migration package's `__init__.py`
that it is deliberately outside the gate. Do not leave it unstated.

**PROOF**
- `upgrade head → downgrade base → upgrade head` clean on a fresh database;
- `na_reason` has exactly four labels, in order;
- `UPDATE audit_log` raises;
- if models.py declares mapped classes, `alembic check` reports no diff.

**A defect in the PROOF above, before the injections.** *"`UPDATE audit_log`
raises"* does not distinguish a `FOR EACH STATEMENT` trigger from a `FOR EACH
ROW` one — **when the UPDATE matches rows, both fire.** The whole reason this
task specifies STATEMENT is the case where it matches *nothing*. So the proof
must `UPDATE audit_log … WHERE id = <an id that does not exist>` and still
require the raise. An UPDATE that matches rows proves nothing about the choice
of trigger, and under Task 4's RLS every cross-tenant UPDATE matches zero rows —
which is exactly when a row-level trigger goes silent and the proof passes
vacuously.

**INJECTION — the specified one is not an injection.** It read: *"The second
`upgrade` must succeed. If it fails on 'already exists', the downgrade was a
no-op."* That is the third clause of the PROOF restated, plus a diagnostic hint.
Nothing is broken and nothing is required to fail. Replaced with four, one per
clause of the proof:

| # | break this | this must fail |
|---|---|---|
| 1 | delete `DROP TYPE na_reason` from `0001`'s downgrade | the second `upgrade` — with `type "na_reason" already exists`. **`DROP TABLE` does not drop a type**, so this is the likeliest real bug in the whole task, not a hypothetical |
| 2 | delete one `op.drop_table` from the downgrade | the second `upgrade`, on `already exists` |
| 3 | add a fifth label to the `na_reason` enum, then separately reorder two | the label test — **on both count and order**, separately |
| 4 | change the trigger to `FOR EACH ROW` | the append-only test, *via the zero-match UPDATE above*. With a matching UPDATE it stays green, which is the point |
| 5 | add a column to `models.py` and no migration | `alembic check` |

**And the containment lesson from Task 2 applies here.** A test that enumerates
tables from `pg_class` and asserts a property of each is satisfied by the wrong
seven tables as readily as the right ones — five decoy roles defeated Task 2's
cardinality floor exactly this way. Assert the **exact expected set** of table
names, not a count and not a subset.

**Hand-offs from Task 2, measured against 18.4 — `env.py` will hit all three:**

- `SET ROLE titlepipe_owner` must be issued on the connection after connect and
  before `context.begin_transaction()`. The database now *enforces* this:
  `titlepipe_migration` holds membership `WITH INHERIT FALSE`, so a forgotten
  `SET ROLE` is `permission denied for schema public` rather than a table
  silently owned by a LOGIN role.
- **`SET ROLE` must be connection-scoped and never `SET LOCAL` or reset.** After
  `RESET ROLE`, reading `alembic_version` fails with `permission denied for
  table alembic_version` — *not* for the schema. `alembic current`, `stamp` and
  `downgrade` all read that table.
- `CREATE SCHEMA` as the owner fails with `permission denied for database`. The
  owner has no `CREATE ON DATABASE`, so a migration creating any non-`public`
  schema breaks.

`roles.sql` is **not Alembic's to run** — it creates the role Alembic
authenticates as.

---

## Task 4 · Forced RLS and the grants

**CONTRACT**

Every tenant table: `ENABLE` **and** `FORCE ROW LEVEL SECURITY`, with

```sql
CREATE POLICY tenant_isolation ON <t>
  USING (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid);
```

`tenants` uses `id` instead of `tenant_id`.

**Then the GRANTs.** *RLS is evaluated **after** the privilege check, never
instead of it.* Without them `titlepipe_app` gets `permission denied` — and a
read test would pass for entirely the wrong reason:

```sql
GRANT USAGE ON SCHEMA public TO titlepipe_app, titlepipe_worker;
GRANT SELECT, INSERT, UPDATE ON <all seven tables> TO titlepipe_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO titlepipe_app;
```

Include `tenants` — the seed and the FK checks need it.

**Two corrections to earlier drafts, both proven, both counter-intuitive:**

1. **`WITH CHECK` is not required to stop cross-tenant INSERT.** PostgreSQL
   applies the `USING` expression as the check when `WITH CHECK` is absent. The
   forged INSERT was refused under `USING` alone. Add `WITH CHECK` only if reads
   and writes need *different* conditions.
2. **`current_setting(x, true)` and `nullif(…,'')` guard different absences.**
   Never set → NULL → no error. Set to `''` (our own sentinel) → **raises**. Both
   are needed; only the `nullif` saves us.

**PROOF** — a catalog test that **enumerates tenant tables from `pg_class`**
(every table in `public` except `tenants`, or by the presence of a `tenant_id`
column — derive it, do not hardcode):
- `relrowsecurity AND relforcerowsecurity` for each;
- a `tenant_isolation` policy exists on each;
- **the policy's `qual` from `pg_policies` contains `nullif`** — Task 0's whole
  argument for the empty-string sentinel is that the policy wraps it. Nothing in
  Task 0 can enforce that; `test_tenancy.py` can only compare one string literal
  to another. Write the policy without `nullif` and an unset GUC hits
  `''::uuid`, which *raises* — a 500 in place of a clean denial. This assertion
  is where that claim finally becomes checkable, so it is not optional;
- `has_table_privilege('titlepipe_app', t, 'SELECT')` and `'INSERT'` for each.

**Cardinality floor — these proofs pass on an empty database.** Enumerating from
`pg_class` and asserting a property of every row returned is vacuously true when
zero rows come back. Assert at least **6 tenant tables** before asserting
anything about them, and likewise at least 5 `titlepipe_*` roles in Task 2.

**INJECTION — the specified one is impossible, and conflates two things.** It
read: *"Drop `FORCE` from one table, connect as `titlepipe_owner`, and the
catalog test must fail."* **Nothing can connect as `titlepipe_owner`** — Task 2
makes it `NOLOGIN`, deliberately, because a table's owner bypasses RLS unless
`FORCE` is set. And the catalog test reads `pg_class.relforcerowsecurity`, which
*any* connection can see, so it never needed that login in the first place. The
sentence asks for a connection that must not exist in order to run a check that
does not need it.

Underneath it is a real proof worth keeping, reachable a different way: with
`FORCE` dropped, a role that has *become* the owner sees every tenant's rows.
`titlepipe_migration` can `SET ROLE titlepipe_owner` — that is exactly the path
Task 2's `WITH INHERIT FALSE, SET TRUE` grant leaves open, and exactly the path
Task 2's membership convergence exists to keep to one role.

**Run all five, one at a time, restoring between:**

| # | break | must fail |
|---|---|---|
| 1 | drop `FORCE` from one table | the catalog test, on `relforcerowsecurity` — from an ordinary connection |
| 2 | with `FORCE` dropped, `SET ROLE titlepipe_owner` from `titlepipe_migration` and select | **every tenant's rows are returned.** Restore `FORCE`: the same statement returns only the set tenant's. This is the proof the original injection was reaching for |
| 3 | drop the `tenant_isolation` policy from one table | the catalog test, on the policy's absence — *and* the cardinality floor must fire first if the derivation returns nothing |
| 4 | remove `nullif` from one policy's `USING` | the `pg_policies` assertion, **and** a session with the GUC set to `''` must raise `invalid input syntax for type uuid: ""` rather than deny |
| 5 | revoke `SELECT` on one table from `titlepipe_app` | the privilege assertion. *RLS is evaluated **after** the privilege check* — without the grants a read test passes for entirely the wrong reason |

**Squawk will not catch any of this** — it lints lock safety and has no rules for
GRANT, POLICY, RLS or roles.

### Measured before this task was written. All of it applies to `0002`.

A throwaway `0002` doing exactly this task was built and run against 18.4 on
2026-08-05. What it hit:

- **`FORCE RLS` makes every tenant table invisible to `titlepipe_owner`, which
  is the role every migration runs as.** After `0002`, `UPDATE orders SET
  tenant_id = tenant_id` returns `UPDATE 0`. No error, no warning. **Every
  backfill, correction or delete written after this task is a silent no-op.**
  `SET LOCAL row_security = off` turns the silence into a loud
  `ERROR: 42501: query would be affected by row-level security policy`. Decide
  which a data migration must do, state it here, and note in `0001` that after
  `0002` those tables are no longer freely writable by migrations.
- **`alembic_version` must be excluded from the derivation explicitly.** It
  lives in `public`, is owned by `titlepipe_owner`, and has no `tenant_id`, so
  deriving "tenant tables" naively gives it an `id`-keyed policy and locks
  Alembic out of its own version table.
- **`GRANT … UPDATE` on `audit_log`** — which this task's contract specifies for
  "all seven tables" — contradicts the append-only trigger. The trigger refuses
  it anyway, so the grant only misstates intent. `DELETE` is correctly not
  granted, which makes the trigger's `DELETE` branch unreachable for
  `titlepipe_app`; belt and braces, worth stating rather than discovering.
- **`GRANT USAGE, SELECT ON ALL SEQUENCES` is a no-op.** Every PK is
  `gen_random_uuid()`; there are no sequences. Harmless, but it does not do what
  a reader assumes.
- **A `REVOKE` in the downgrade only reaches grants it can act as grantor for** —
  the same class as the `GRANTED BY … CASCADE` bug already fixed for
  `pg_auth_members`. Converge the ACL rather than mirroring the upgrade's
  grants, or accept documented debris.
- **`titlepipe_owner` has no `USAGE` grant on schema `public`** — it inherits it
  from `PUBLIC`. On a hardened cluster (`REVOKE USAGE ON SCHEMA public FROM
  PUBLIC`) migrations break. This task grants `USAGE` to `titlepipe_app` and
  `titlepipe_worker`; add the owner.
- **Default privileges belong in `roles.sql`, not here.** It already converges
  `pg_default_acl`, and a grant this task makes to a role will be silently
  widened by any default-ACL drift `roles.sql` does not repair.

**Both counter-intuitive claims above were re-measured and hold:** `USING` alone
does refuse a cross-tenant INSERT (`new row violates row-level security policy`)
with no `WITH CHECK` present, and the `nullif` guard is load-bearing — unset GUC
denies cleanly, GUC set to `''` denies cleanly, and the unwrapped form raises.

---

## Task 5 · Tenant session and repository base

**Every database access in every later plan goes through this.** It exists so
there is no un-scoped path to reach for.

**CONTRACT** — Plans 02–06 consume these signatures:

```python
def make_engine(dsn: str, *, pool_size: int = 5, max_overflow: int = 10) -> AsyncEngine
def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]

@asynccontextmanager
async def tenant_session(
    sessionmaker: async_sessionmaker[AsyncSession], tenant: TenantId | None
) -> AsyncIterator[AsyncSession]

class TenantRepository[T: Base]:
    def __init__(self, session: AsyncSession, model: type[T]) -> None
    async def get(self, id_: UUID) -> T | None
    async def add(self, entity: T) -> None
```

`make_engine` **must expose `max_overflow`** — Task 6 needs `pool_size=1,
max_overflow=0` and cannot get it otherwise.

`model` is a **constructor parameter, not `ClassVar[type[T]]`.** The typing spec
forbids type variables inside `ClassVar`; pyright 1.1.411 — what `pyright==1.1.*`
resolves to — reports *"ClassVar type cannot include type variables"*.

`tenant=None` is legal and means deny-everything. Health checks use it.

The GUC is applied via an `after_begin` listener on `Session`, calling
`set_config(TENANT_GUC, tenant_guc_value(...), true)`. **`set_config` has exactly
one signature** — `(text, text, boolean)`. There is no two-argument form.

**Three traps, all verified:**

- **`SET LOCAL` outside a transaction is a no-op.** *Proven: `WARNING: SET LOCAL
  can only be used in transaction blocks`, and it then reports `SET`. Silently
  does nothing, claims success.*
- **`SAVEPOINT` unwinds the GUC.** Task 0's gate bans `begin_nested()` under
  `src/`. **Tests may still use savepoints** — that is how Task 6 assertion 4
  checks the behaviour, and `tests/` is not scanned.
- **`after_begin` is ORM-only.** Verified absent from `ConnectionEvents` and
  `PoolEvents` — though `ConnectionEvents` *does* have `begin`, so someone may
  believe they are covered at Core level and not be. Raw `engine.connect()`,
  Alembic and Procrastinate bypass it entirely.

**PROOF** `tenant_session` applies the GUC (assert `current_setting` inside it);
`tenant=None` yields `""`; `TenantRepository` requires a `model` argument.

**INJECTION** Remove the `after_begin` listener. Task 6 assertion 1b must fail —
every tenant then sees nothing.

---

## Task 6 · The isolation proof

### 🔴 Requires PostgreSQL 18.4. `skip` is forbidden. Connect as `titlepipe_app`.

**Superusers bypass RLS unconditionally — `FORCE` does not stop them.** *Proven:
as `postgres`, a correctly forced table still returned every tenant's rows.* An
isolation test on the admin DSN passes while proving nothing.

**CONTRACT — the fixture.** A session-scoped fixture on `admin_dsn` seeds, before
any app-role connection opens: tenants **A** and **B**, **two** orders for A,
**exactly one** for B. Seeding must set the tenant GUC per tenant — *proven: even
the migration role, inheriting the owner, is refused by policy under `FORCE`.*

**Engine: `pool_size=1, max_overflow=0`.** With a larger pool, B may get a fresh
connection and pass for the wrong reason.

**Seven assertions:**

| # | assertion | expected | closes |
|---|---|---|---|
| 1 | A writes and commits; B's txn on the **same** connection, no tenant set | **0 rows** | the GUC surviving pool checkout |
| 1b | **POSITIVE CONTROL** — B with its own tenant | **exactly 1, not 0** | a system that denies everything |
| 2 | A inserts a row carrying B's `tenant_id` | raises **SQLSTATE 42501** | write-side isolation |
| 3 | no tenant set, select | **0 rows, no exception** | the `nullif` guard |
| 4 | inside one txn: set tenant, savepoint, rollback to it, re-select | still A's rows | the SAVEPOINT trap |
| 5 | raw `engine.connect()`, no tenant | 0 rows | `after_begin` is ORM-only |
| 6 | `SET ROLE titlepipe_owner` as app | raises `permission denied to set role` | Task 2's ownership rule |

**1b is not optional.** Assertions 1, 3 and 5 are all satisfied by a database
that denies everything to everyone. Without the control the suite cannot tell
"isolated" from "broken".

**Assert on SQLSTATE, not on "raises".** A typo'd column, a NOT NULL violation
and an RLS refusal all raise. Match `42501` specifically.

*Assertions 1, 1b, 2, 3 and 6 were executed on 2026-08-05 against 18.4 as a
non-superuser and produced exactly these results.*

**INJECTION — both, and both re-runnable:**
- Connect as the **superuser** instead of `titlepipe_app`. Assertions 1, 2 and 6
  must all fail.
- Remove the `after_begin` listener (Task 5's injection). **1b** must fail.

---

## Task 7 · CI

**CONTRACT** `.github/workflows/backend.yml` gains a `postgres:18.4` service,
runs `roles.sql` before Alembic, `alembic upgrade head`, the core-api suite,
**the `libs/domain` suite** (otherwise Task 0's proof never runs), and the rules
gate.

**Squawk lints `.sql`, and the migrations are Python.** Either emit SQL with
`alembic upgrade head --sql` and lint that, or scope Squawk to
`migrations/sql/` — and **say which in the workflow**. Do not leave a CI line
implying coverage that does not exist.

State in the workflow that **Squawk does not cover GRANT, POLICY, RLS or
roles** — Tasks 2 and 4's catalog tests do.

---

## Done

```
uv run ruff check .                             clean
uv run ruff format --check .                    clean
uv run pyright                                  0 errors
uv run pytest                    (core-api)     green, all 7 assertions
cd libs/domain && uv run pytest                 green
python scripts/check_backend_rules.py           clean
alembic upgrade head → downgrade base → upgrade head    no error
uv sync --frozen                                succeeds
```

Plus, and these are the ones that matter:

- every tenant table has `relrowsecurity AND relforcerowsecurity` and is owned by
  `titlepipe_owner`;
- no LOGIN role is superuser, bypassrls, or owns a table;
- `titlepipe_app` holds SELECT/INSERT/UPDATE on all seven tables;
- **every injection was run and observed to fail**, named in the commit message.

**Not in this plan:** any HTTP route, WorkOS, R2, Procrastinate, OTel. Those land
at the gate that first needs them, so an unused dependency never reaches a
production image.

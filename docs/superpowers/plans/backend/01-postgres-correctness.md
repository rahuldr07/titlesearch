# Plan 01 — Postgres correctness

> **Read [`00-HOW-TO-EXECUTE.md`](./00-HOW-TO-EXECUTE.md) first.** It defines the
> dispatch/verify/inject/review loop, what to tell each subagent, and when to
> stop. This file is *what to build and how to prove it*.

**Ships:** a schema whose tenant isolation is proven. No HTTP routes.

**Why first:** every route in Plans 02–06 is tenant-scoped. Retrofitting the
tenant GUC into handlers already written is the leak ADR-0001 finding 4 records
as verified in the wild.

**Claims marked as measured were measured** — most against PostgreSQL 18.4 on
2026-08-05, the rest against this repository's pinned toolchain. **Several were
later found false. Every correction is recorded inline, at the sentence that was
wrong.** Surprises are recorded where they happened.

> **Correction, 2026-08-06.** This header used to read: *"Every SQL claim below
> was executed against PostgreSQL 18.4 on 2026-08-05 and produced the stated
> result."* That is a blanket warrant over the whole document, and by the time
> the eight tasks landed it was false three ways.
>
> **Not every claim was SQL,** so "executed against PostgreSQL" could not have
> covered them. Task 1's `<2.1` cap on sqlalchemy is a claim about uv's
> resolver; Task 1's `TITLEPIPE_` prefix rule is a claim about
> pydantic-settings. Both were written as measured fact and **both were wrong**
> — see the corrections in that task.
>
> **Claims that were SQL got overtaken rather than mismeasured.** Task 4's
> schema `USAGE` grant moved to `roles.sql`; Task 6's seeding contract
> contradicted its own opening line. A warrant reading "produced the stated
> result" gives a reader no way to tell a live measurement from a stale one.
>
> **And it pushed the reader the wrong way.** A sentence whose function is *stop
> checking* is the exact failure `00-HOW-TO-EXECUTE.md` §1 exists to prevent.
> Verify the claim you are about to act on. The corrections below are what that
> verification produced the several times someone did it.

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

## What eight tasks taught this plan about injections

**Read this before writing an injection into any later plan.** It is the most
transferable thing Plan 01 produced. It was spread across seventeen commit
messages until it was collected here on 2026-08-06.

**Seven of this plan's eight injections did not work as written.** Five could
not fail at all; a sixth did not exist; the seventh passed on every spelling it
tested while three one-token changes walked through the gate untouched. Each was
written by someone who believed it. Each was found only because the executing
agent tried to run it.

| task | what the injection said | why it did not work |
|---|---|---|
| 0 | violate each of the seven rules | **it tested only the canonical spelling.** All ten injections passed against a gate that `from sqlalchemy import text as sql`, `_emit = print` and `savepoint = session.begin_nested` walked straight through |
| 1 | point `TP_TEST_DATABASE_URL` at port 5432, "16.14 on the dev box" | **could not fail on the machine it ran on.** WSL's 5432 *is* 18.4 and no 16 is installed, so the version test passes and a green run gets recorded as evidence |
| 2 | `ALTER ROLE … BYPASSRLS` in a transaction you roll back | **could not fail across the connection it was checked on.** `ALTER ROLE` is transactional DDL and the catalog test runs on a *separate* connection, which reads `rolbypassrls = false` and passes |
| 3 | "the second `upgrade` must succeed" | **it restated the third clause of its own PROOF.** Nothing is broken and nothing is required to fail |
| 4 | drop `FORCE`, connect as `titlepipe_owner` | **it required connecting as a role Task 2 deliberately makes `NOLOGIN`** — for exactly the reason `FORCE` exists. And the check it asked for reads `pg_class.relforcerowsecurity`, which any connection can see, so it never needed that login |
| 5 | remove the `after_begin` listener; "Task 6 assertion 1b must fail" | **it forward-referenced a task that must not exist yet.** A task whose proof lives in a later task has no proof |
| 7 | — | **it did not exist.** Neither did the PROOF |

**Task 6's is the one that held**, and it is worth reading for the shape: it
names a *specific* assertion that must fail, in the *same* task, through a
change reachable on the machine, surviving the connection the check runs on.
Even so, running it found a weak assertion — assertion 4 passed under the
superuser injection, because a cardinality floor, an `after == before` and a GUC
string are all true of a connection that bypasses RLS. **The injection caught
it. Nothing else in the suite would have.**

### Three separate times, the fix was the same: add a positive control

1. **Task 2's cardinality floor** — satisfied by five decoy roles exactly as
   readily as by the five real ones.
2. **Task 3's enum test** — compared a constant against a value derived from
   that same constant, so renaming `NOT_PRESENT` to `NA` in both the model and
   the migration left the suite green.
3. **Task 5, and Task 6's assertion 1b** — every assertion of the form *"this
   tenant sees nothing"* is satisfied by a system that denies everyone, by a
   broken DSN, and by an empty table.

The pattern under all three: **a suite of denials cannot tell *isolated* from
*broken*.** Nor can a catalog sweep tell *compliant* from *empty*, nor a
derived-against-derived test tell *correct* from *consistently wrong*. Each
needs one assertion pointing the other way — one that would fail if the subject
were simply absent.

**And the control must cover the whole derived set, not one member of it.** The
isolation proof's positive control covered `orders` alone. Six tables plus
`tenants` could then be respelled to hand every established tenant every other
tenant's rows, and the suite reported `192 passed` (`9ddeefc`).

### The checklist this produces

An injection is only an injection if all of these hold:

- it names the **specific assertion** that must fail, not "the test";
- that assertion lives in **this** task, not a later one;
- the change is **reachable** — no role that cannot log in, no server version
  that is not installed, no fixture from a task not yet written;
- it survives the **transaction and the connection** the check actually runs on;
- it is not the PROOF restated;
- it breaks the **behaviour**, not one spelling of it — inject the alias, the
  rebinding and the near-miss path, not only the textbook form;
- and where the proof is a set of denials or a catalog sweep, at least one
  injection must break the **positive control** rather than another denial.

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

| rule id | what it catches | scope |
|---|---|---|
| `any-type` | `Any`, `cast(`, `# type: ignore`, `# pyright: ignore`, `# pyright: basic`/`standard`, `# pyright: report…=false`, and `Any` inside a PEP-484 type comment | `src/` |
| `savepoint` | `begin_nested(` — a SAVEPOINT unwinds the tenant GUC | `src/` |
| `raw-sql` | `text`, `literal_column`, `exec_driver_sql`, `raw_connection` | `src/` **except** the `db` package directly inside a distribution package |
| `http-exception` | `HTTPException` | `src/` except each package's own `api/errors.py` |
| `print` | `print(` | `src/` |
| `file-length` | file > 400 lines | `src/` |
| — | `rules-allow(<id>)` / `rules-allow-file(<id>)` with a reason under 12 chars, and the rule-less `rules-allow:` form | everywhere |

> **Correction, 2026-08-06 — the gate is stricter than this table was, which is
> the wrong direction for a contract to be wrong in.** The table used to list
> only `Any`, `# type: ignore`, `cast(` on row 1 and `text(` / `exec_driver_sql(`
> on row 3, and it named no rule ids at all. Three enforced rules were absent:
> **`# pyright: ignore`** (this repo type-checks with pyright, and six were
> sitting in scanned `src/` when the rule was written — the task's own INJECTION
> section already demanded it, and the table was never updated to match),
> **`literal_column`** and **`raw_connection`**. Verified against
> `scripts/check_backend_rules.py:336-370` (`NAME_RULES`) and `:567-590`
> (`_comment_suppressions`).
>
> Two more corrections in the same table. The `raw-sql` carve-out is **not**
> `*/db/` as a substring — that spelling hands the raw-SQL exemption to a `db`
> directory at any depth, including `api/db/`, where route handlers live. The
> gate matches `module[:1] == ("db",)`, the `db` package directly inside the
> distribution package (`_path_exemption`, `:409-428`). And `rules-allow` is
> **rule-scoped in both forms**, `rules-allow(<id>)` and
> `rules-allow-file(<id>)`; the rule-less `rules-allow:` is recognised only so
> that writing it earns an explanation rather than being swallowed (`:311-316`).
> The reason floor is `MIN_ALLOW_REASON_LENGTH = 12` (`:278`).

Scan roots resolve from the **repo root**, not `cwd`: `services/*/src`,
`libs/*/src` (`SCAN_ROOT_GLOBS`, `:269`). Test code is out of scope **by
location**: this repository's tests live at `services/*/tests` and
`libs/*/tests`, *beside* `src/` and outside the scan roots entirely. Later tasks
require raw SQL there.

> **Correction, 2026-08-06.** This line used to read: *"**`tests/` is never
> scanned** — later tasks require raw SQL there."* It is no longer true, and the
> reason it was ever written was wrong. `tests` was a member of
> `SKIPPED_DIRECTORY_NAMES` and **is deliberately gone** — see
> `scripts/check_backend_rules.py:280-292`. Skipping the *name* was never what
> exempted this repo's tests; their *location* outside `services/*/src` was. What
> the name skip actually achieved was excusing a real shipped package:
> `…/src/titlepipe_probe/tests/queries.py` scanned clean with a `text(…)` and a
> `print(…)` in it while the identical body one directory over was caught.
>
> **A `tests` package inside `src/` is scanned now**, like any other module,
> because it imports and runs like any other module. One that genuinely needs
> raw SQL can earn a `rules-allow-file`. Do not write an injection that assumes
> the old behaviour.

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

`services/core-api` depends on `sqlalchemy[asyncio]>=2.0.51,<2.1`,
`psycopg[binary,pool]>=3.3.4,<3.4`, `alembic>=1.18.5,<1.19`, and dev
`testcontainers[postgres]>=4.15.0,<5.0`. `uv.lock` regenerated and committed.

> **Correction, 2026-08-06 — the cap is right and the stated reason is not.**
> This line used to read: *"`sqlalchemy>=2.0.51,<2.1` (the `<2.1` cap is
> required — `2.1.0b3` is on PyPI and is *newer* than stable)"*. Commit
> `4adfa5b`'s message claims this was corrected in the plan's text; it changed
> zero lines of this file. **Re-measured here, 2026-08-06:**
>
> ```
> uv pip compile <<< 'sqlalchemy>=2.0.51'                     ->  sqlalchemy==2.0.51
> uv pip compile --prerelease=allow <<< 'sqlalchemy>=2.0.51'  ->  sqlalchemy==2.1.0b3
> ```
>
> `2.1.0b3` is indeed on PyPI and does sort newer than every 2.0 release — but
> uv, like pip, **never selects a pre-release while a stable satisfies the
> range**, so a bare `>=2.0.51` would not pull it. The cap is not required for
> that. What `<2.1` actually buys is **exclusion of 2.1.0 *stable***, an
> unreviewed major-minor that would otherwise arrive on its release day through
> a plain `uv lock`. `services/core-api/pyproject.toml:13-21` carries this
> reasoning verbatim; the plan was the only place still asserting the beta
> story.
>
> The extra is also part of the pin: **`[asyncio]`**, without which greenlet is
> undeclared on `arm64` and the first `create_async_engine` call is an
> `ImportError` (`pyproject.toml:23-42`).

`services/core-api/tests/conftest.py` exposes session-scoped fixtures giving
**three distinct DSNs**, because they are three different privilege levels:

| fixture | connects as | used for |
|---|---|---|
| `admin_dsn` | superuser | `roles.sql`, seeding |
| `migration_dsn` | `titlepipe_migration` | Alembic |
| `app_dsn` | `titlepipe_app` | **every isolation assertion** |

**Fixtures must live in `conftest.py`.** pytest does not collect fixtures from
arbitrary modules such as `tests/db.py`.

**Three traps — two real, and the third is not a trap at all.** *(This heading
used to read "Three traps, all verified." It was three-for-three only in the
sense that nobody had checked the third.)*

- `PostgresContainer.get_connection_url()` returns **`postgresql+psycopg2://`**
  by default. psycopg2 is deliberately not a dependency. Pass
  `driver="psycopg"`.
- `testcontainers[postgres]`'s extra is **empty** and installs no driver;
  `psycopg[binary]` is what makes it connect.
- The override env var is **`TP_TEST_DATABASE_URL`**, and it deliberately does
  not start with `TITLEPIPE_` — but not for the reason this plan gave. See the
  correction directly below.

> **Correction, 2026-08-06 — this trap does not exist, and it was never a trap.**
> The third bullet used to read: *"The override env var **must not start with
> `TITLEPIPE_`**. `settings.py` sets `env_prefix="TITLEPIPE_"` with
> `extra="forbid"`, so `CoreApiSettings` would reject its own test variable."*
> Commit `4adfa5b`'s message claims this was corrected in the plan's text;
> `git show --numstat 4adfa5b -- docs/` is **empty**. It changed zero plan lines.
>
> **Re-measured here, 2026-08-06** against pydantic-settings 2.14.2, with
> `TITLEPIPE_BOGUS_UNKNOWN=1` exported (and `TITLEPIPE_ENVIRONMENT` supplied,
> because `environment` has no default):
>
> ```
> CoreApiSettings()   ->  constructs cleanly
> ```
>
> `EnvSettingsSource` walks the **model's fields** and looks each one up in the
> environment. It never walks the environment, so a `TITLEPIPE_`-prefixed
> variable matching no field is invisible and `extra="forbid"` never sees it.
> Both spellings construct. The config is real —
> `services/core-api/src/titlepipe_core/settings.py:77,79` — the inference from
> it was not.
>
> **The name is still `TP_TEST_DATABASE_URL`, on the reason that survives
> measurement:** a harness variable that does not share the application's prefix
> cannot be read as application configuration — by a person, or by some later
> settings source that *does* walk the environment. There is no test for that,
> because there is nothing to assert. The comment above
> `DATABASE_URL_OVERRIDE` in `services/core-api/tests/conftest.py` records the
> same correction at the constant.

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
GRANT SELECT, INSERT, UPDATE ON <the six tenant tables + tenants> TO titlepipe_app;
GRANT SELECT, INSERT         ON audit_log                         TO titlepipe_app;
```

Include `tenants` — the seed and the FK checks need it.

> **Correction, 2026-08-06 — this contract was overtaken by three separate
> measurements and never amended. All three are now in the code.** The block
> used to read:
>
> ```sql
> GRANT USAGE ON SCHEMA public TO titlepipe_app, titlepipe_worker;
> GRANT SELECT, INSERT, UPDATE ON <all seven tables> TO titlepipe_app;
> GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO titlepipe_app;
> ```
>
> **1. The schema `USAGE` grant is not `0002`'s to make.** Schema `public`
> belongs to `pg_database_owner` from PostgreSQL 15 on. `migrations/env.py` runs
> every statement as `titlepipe_owner`, which is not the database owner and
> holds no grant option, so its `GRANT` is a `WARNING: no privileges were
> granted for "public"` and an **exit 0**. Commit `9ddeefc` moved the grant to
> `migrations/sql/roles.sql`, which runs as the operator and can land it, and
> widened it to three roles — `GRANT USAGE ON SCHEMA public TO titlepipe_owner,
> titlepipe_app, titlepipe_worker`. The measurement and the reasoning are in
> that file's header section **"WHY `GRANT USAGE ON SCHEMA public` IS HERE, AND
> WHICH THREE ROLES IT NAMES"**.
>
> `0002` still **issues** the statement — `upgrade()`'s
> `GRANT USAGE ON SCHEMA public TO {SCHEMA_USAGE_ROLES}` in
> `migrations/versions/0002_forced_rls_and_grants.py` — but only so that its
> read-back, **`_require_schema_usage`**, can refuse a cluster where the
> privilege is genuinely absent. Do not read that line as the place the grant
> lands.
>
> **2. `audit_log` gets `SELECT, INSERT` and never `UPDATE`.** "All seven
> tables" contradicted `0001`'s append-only trigger. The trigger refuses UPDATE
> and DELETE whatever the ACL says, so the grant changed no behaviour and only
> misstated the intent — an ACL reading `arwU` on the one table this system
> promises never to edit in place. Ruled in `19f2638`, written in `upgrade()`
> under the comment *"🔴 `audit_log` GETS NO `UPDATE`, AND IT IS THE ONE GRANT
> THAT DIFFERS"*, and asserted by
> `tests/test_forced_rls_and_grants.py:810::test_audit_log_is_granted_insert_but_never_update`
> — which requires `UPDATE is False` and `DELETE is False`. **The Done section
> still demanded the opposite until 2026-08-06; see the correction there.**
>
> **3. The sequence grant is deliberately omitted.** Every PK defaults to
> `gen_random_uuid()`; `pg_class` holds zero relations of kind `S` in `public`,
> so the statement would grant nothing to nobody while reading like a covered
> case. See `upgrade()`'s *"🔴 NO `GRANT USAGE, SELECT ON ALL SEQUENCES`"*
> comment, with
> `tests/test_forced_rls_and_grants.py:956::test_there_are_no_sequences_for_a_sequence_grant_to_reach`
> asserting the count is zero — which is what will notice the day a `serial`
> column arrives.

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
- **the policy's `qual` from `pg_policies` matches the whole predicate,
  anchored** — not "contains `nullif`". See the correction below; this is the
  one assertion in Plan 01 that was measured to let a leaking database ship
  green;
- `has_table_privilege('titlepipe_app', t, 'SELECT')` and `'INSERT'` for each.

> **Correction, 2026-08-06 — this bullet specified the weak assertion, and the
> weak assertion was measured to pass over a database leaking six of seven
> tables.** It used to read: *"**the policy's `qual` from `pg_policies` contains
> `nullif`** — Task 0's whole argument for the empty-string sentinel is that the
> policy wraps it … This assertion is where that claim finally becomes
> checkable, so it is not optional."* The motivation is right and the assertion
> it produces is not.
>
> Measured in `9ddeefc` with `0002::_isolate` patched so `orders` keeps its real
> predicate and the other six plus `tenants` get
>
> ```sql
> USING (nullif(current_setting('app.current_tenant', true), '') IS NOT NULL)
> ```
>
> — TRUE for every row as soon as *any* tenant is established, i.e. handing
> every established tenant every other tenant's rows. It contains `nullif`, so
> this assertion passed. It denies an unestablished session, so every deny
> assertion passed. **`192 passed`.** *"Contains `nullif`"* never asks whether
> the predicate compares the key column to anything.
>
> **What it must be instead.** `pg_policies.qual` is the server's *deparse* of
> the expression tree, so it is canonical and the whole thing can be matched:
>
> ```
> (tenant_id = (NULLIF(current_setting('app.current_tenant'::text, true), ''::text))::uuid)
> ```
>
> Anchor at both ends (`\A`/`\Z`) so nothing can hide in a gap; normalise
> whitespace only; extract the **key column** and the **GUC name** as named
> groups and compare them case-**sensitively** against the expected column and
> the `tenant_guc` fixture, so `re.IGNORECASE` covers only SQL's own
> upper-casing of its keywords. `TENANT_PREDICATE_SHAPE` and
> `_tenant_predicate_fault` in `tests/test_forced_rls_and_grants.py` are the
> landed form, with the measurement above recorded beside them.
>
> **Injection 4 below inherits the defect** — "remove `nullif` from one policy's
> `USING`" only ever exercised the substring test. Add the mutation that
> actually shipped green: leave `nullif` in place and replace the comparison
> with `IS NOT NULL` on one table. That must fail the `qual` assertion **and**
> the positive control.

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

**No migration linter runs anywhere in this repository, and none is claimed.**
The catalog assertions above are the only thing that would catch any of this.

> **Correction, 2026-08-06 — Squawk survived the commit that deleted it.** This
> line used to read: *"**Squawk will not catch any of this** — it lints lock
> safety and has no rules for GRANT, POLICY, RLS or roles."* Commit `9ddeefc`
> states *"Squawk is deleted from the plan"* and removed Task 7's three
> paragraphs about it — but missed this sentence, which sits in Task 4.
>
> The observation was true and is now beside the point: **Squawk is configured
> nowhere in this repository.** It has no config file, no pre-commit hook and no
> workflow step; the only surviving mention is a comment in
> `.github/workflows/backend.yml:219-222` explaining why there is no migration
> linter. It also could not read these migrations if it were installed — it
> lints `.sql`, and `0001`/`0002` are Python. Naming a tool the reader cannot
> find invites them to go looking for it.

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
  PUBLIC`) migrations break. **RESOLVED 2026-08-06, and not by this task:** the
  finding is real and the fix is `roles.sql`'s
  `GRANT USAGE ON SCHEMA public TO titlepipe_owner, titlepipe_app,
  titlepipe_worker`, which names all three.

  > **Correction, 2026-08-06.** This bullet used to end: *"This task grants
  > `USAGE` to `titlepipe_app` and `titlepipe_worker`; add the owner."* It
  > cannot. Measured in `9ddeefc` against a hardened `postgres:18.4`, one
  > throwaway container per run, with `REVOKE USAGE ON SCHEMA public FROM
  > PUBLIC` applied before anything else touched it: `0002`'s grant runs as
  > `titlepipe_owner`, which holds no grant option on a schema owned by
  > `pg_database_owner`, so it is a `WARNING` and a no-op. End to end —
  >
  > ```
  > before   alembic exit=1; titlepipe_app: 42P01 relation "orders" does not exist
  > after    alembic exit=0; titlepipe_app sees orders
  > ```
  >
  > — where "after" is `roles.sql` naming the three roles. `0002`'s
  > `_require_schema_usage` read-back stays: it is what catches an *operator*
  > that could not grant. Naming the roles in `roles.sql` is what stops it
  > firing. See the correction under this task's GRANT block.
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
) -> AsyncGenerator[AsyncSession]      # NOT AsyncIterator — see below

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

**Two amendments to this contract, made while implementing it. Plans 02–06 read
the signatures above, so they are recorded here rather than only in the code.**

1. **The return annotation is `AsyncGenerator[AsyncSession]`, not
   `AsyncIterator`.** Annotating an `@asynccontextmanager` as `AsyncIterator` is
   deprecated in typeshed and pyright strict *rejects* it — `The function
   "asynccontextmanager" is deprecated … Use -> AsyncGenerator[Foo] instead
   (reportDeprecated)`. The only alternative was a `# pyright: ignore`, which
   Task 0's gate bans. **The annotation moved; the behaviour did not** — callers
   still receive an identical `_AsyncGeneratorContextManager[AsyncSession]`.
2. **`tenant_session` commits on clean exit** and discards the transaction on any
   exception. This was unspecified and is load-bearing rather than decorative: a
   GUC set with `is_local` reverts only at COMMIT, so a session that never
   commits never exercises the pooled-reuse case and injection 3 below would be
   unprovable. If a later plan needs the caller to own the commit, it is a
   three-line change — but it must then find another way to prove the revert.

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

**INJECTION — the specified one cannot be run at this point in the plan.** It
read: *"Remove the `after_begin` listener. Task 6 assertion 1b must fail — every
tenant then sees nothing."* Task 6 does not exist yet, and building it here to
satisfy this task's injection is exactly the scope-widening the execution
protocol forbids. **A task whose proof lives in a later task has no proof.**

The instinct behind it is right and belongs *here*: removing the listener makes
every tenant see nothing, and **a suite that only asserts denial goes green when
everything is broken.** So Task 5 needs its own positive control — which it can
now have, because Task 4 landed policies and there are tables to seed.

**Run all five, one at a time:**

| # | break | must fail |
|---|---|---|
| 1 | remove the `after_begin` listener | the **positive control** — with a tenant set, a seeded row must be visible. Every denial assertion in this task stays green, which is the point |
| 2 | make `tenant_guc_value(None)` return `"None"` | the deny path must go from *0 rows* to `invalid input syntax for type uuid: "None"` — a 500 in place of a denial |
| 3 | pass `is_local=false` to `set_config` | the GUC must leak past the transaction onto the pooled connection; assert the next checkout starts denied |
| 4 | drop `max_overflow` from `make_engine`'s signature | Task 6 needs `pool_size=1, max_overflow=0` and cannot get it otherwise. A signature test must fail |
| 5 | give `TenantRepository` a default `model` | the constructor must refuse; `ClassVar[type[T]]` is forbidden by the typing spec and pyright reports *"ClassVar type cannot include type variables"* |

**The positive control is not optional.** Assertions of the form "no tenant sees
nothing" are satisfied by a system that denies everyone, by a broken DSN, and by
an empty table. Without a control the suite cannot tell *isolated* from *broken*
— the same defect that made Task 2's cardinality floor insufficient and Task 3's
enum test compare a constant to itself.

**Two things Task 4 measured that land on this task:**

- **The `''` case is Task 5's own doing.** `current_setting(x, true)` returns
  NULL when never assigned and `''` once assigned and reverted — and
  `set_config(…, is_local=true)` reverting at commit is precisely what produces
  `''` on a pooled connection. So `nullif` guards *this task's* footprint, not a
  hypothetical. Assert both absences: a fresh connection and a reused one.
- **`connect_args={"options": "-c app.current_tenant="}` belongs on
  `make_engine`.** The test suite pins this at the fixture layer, but that layer
  strips `PG*` from the process first, so the connection-level pin is unreachable
  there and currently unverified. Task 5 is where it becomes real: a pooled
  connection must start at the deny sentinel so only `SET LOCAL` can move it.

---

## Task 6 · The isolation proof

### 🔴 Requires PostgreSQL 18.4. `skip` is forbidden. Connect as `titlepipe_app`.

**Superusers bypass RLS unconditionally — `FORCE` does not stop them.** *Proven:
as `postgres`, a correctly forced table still returned every tenant's rows.* An
isolation test on the admin DSN passes while proving nothing.

**CONTRACT — the fixture.** A **module-scoped** fixture on `admin_dsn` seeds,
before any app-role connection in the module opens: tenants **A** and **B**,
**two** orders for A, **exactly one** for B.

> **Correction, 2026-08-06 — this said *session*-scoped, and pytest refuses it.**
> The seed must follow `alembic upgrade head`, so it depends on
> `migrated_database` — and *that* fixture is module-scoped for a reason of its
> own: session scope leaves `alembic_version` in place and
> `tests/test_roles.py::test_a_table_created_after_set_role_belongs_to_the_owner`
> then fails with `DuplicateTable` (see the `migrated_database` fixture in
> `services/core-api/tests/conftest.py`). A session-scoped fixture may not
> request a module-scoped one. **Measured against pytest 9.1.1**, the seed
> respelled `scope="session"` and nothing else changed:
>
> ```
> ScopeMismatch: You tried to access the module scoped fixture
> migrated_database with a session scoped request object.
> ```
>
> Module scope delivers the property this contract is actually about — the seed
> is committed **before any app-role connection in the module opens**, because
> every test in the module requests it and pytest builds it first. Widening it
> further buys nothing: the tables do not outlive the module. The
> `_isolation_seed_result` fixture in `conftest.py` records the deviation in its
> own docstring; this is the amendment the plan was missing.

> **Correction, 2026-08-06.** This contract used to add: *"Seeding must set the
> tenant GUC per tenant — proven: even the migration role, inheriting the owner,
> is refused by policy under `FORCE`."* Both halves are now wrong.
>
> `admin_dsn` is the **container superuser**, and this task's own opening line
> says superusers bypass RLS unconditionally. A superuser seeding two tenants
> needs no GUC at all — the requirement contradicts the sentence above it.
>
> And "the migration role, inheriting the owner" describes a grant that no
> longer exists: Task 2 now grants membership `WITH INHERIT FALSE, SET TRUE`, so
> `titlepipe_migration` inherits nothing and must `SET ROLE` explicitly. Having
> done so it *is* refused by policy under `FORCE` — Task 4 measured exactly that
> — but for a different reason than the sentence gives.
>
> **Seed as the superuser and say in the fixture why no GUC is needed.** If you
> seed any other way, the GUC becomes mandatory and the reason must be the
> measured one, not the stale one.

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

**CONTRACT** `.github/workflows/backend.yml` runs the rules gate as a step of its
own, and every database proof in Tasks 1–6 actually executes there.

> **Three premises in the original contract are stale or wrong. Checked
> 2026-08-06.**
>
> **"gains a `postgres:18.4` service" — probably not.** Every database test
> starts its own `postgres:18.4` through **testcontainers**, and GitHub's
> `ubuntu-24.04` runner has Docker. A service container is redundant unless
> `TP_TEST_DATABASE_URL` points at it — and if it does, the Task-1 validator
> **refuses it**, because a service container answers on `localhost` and loopback
> now requires `TP_TEST_DATABASE_URL_LOOPBACK_IS_DELIBERATE`. Decide, and if you
> add a service, say why testcontainers was not enough and set the
> acknowledgement variable deliberately rather than discovering it.
>
> **"runs `roles.sql` before Alembic, `alembic upgrade head`" — the suite already
> does both.** `roles_applied` runs `roles.sql`; `migrated_database` runs
> `upgrade head` and `downgrade base`. A separate CI step would run them against
> a *different* database from the one under test, or the same one twice.
>
> **"the `libs/domain` suite (otherwise Task 0's proof never runs)" — it already
> runs.** The `project` matrix has carried `libs/domain` since before this plan
> was written. Verified.
>
> **What is genuinely missing is the rules gate.** It reaches CI only through
> `uvx pre-commit run --all-files` in the `hygiene` job — real, but that job is
> currently red on `main` for unrelated whitespace in `apps/web-v2` and
> `design-export`, so a new violation lands in existing noise. A direct step is
> the one line this task most needs.

**Also unresolved:** `scripts/` is type-checked by nothing. CI runs `pyright` per
uv project and `scripts/` is not one — **4,536 lines of Python** across 13
files, including two security controls. Measured: `include = [..., "scripts"]`
does **not** work (29 strict errors in `scripts/tests`, 248 in the `gate0`
archive); `include = [..., "../../scripts/*.py"]` reports 0 errors, but **that
glob reaches only the four top-level scripts**. The clean answer is a
`scripts/pyproject.toml` and a seventh matrix entry.

> **Correction, 2026-08-06 — the figure was stale when it was written, and it
> counted the wrong thing.** This paragraph used to say *"1,121 lines"*.
> Recounted here:
>
> | | files | lines |
> |---|---|---|
> | `scripts/*.py` (top level) | 4 | **1,211** |
> | `scripts/tests/` | 4 | **1,947** |
> | `scripts/gate0/` | 5 | **1,378** |
> | **total** | **13** | **4,536** |
>
> 1,211 is `116 + 847 + 67 + 181`. **1,121 was the correct total at commit
> `160fcff`**, when `check_backend_rules.py` was 757 lines; it grew to 847 at
> `6df3eaa`, seven commits before `3a5a652` wrote this paragraph. The other
> three scripts have not changed size since.
>
> **And the proposed `include` reaches neither subdirectory.** Measured from
> `services/core-api`: `../../scripts/*.py` matches exactly 4 paths — a single
> `*` does not recurse — while `../../scripts/**/*.py` matches 13. The "31 files"
> pyright reported is source plus followed imports, not the 31 files of
> `scripts/`. So the `include` line would leave `scripts/tests` (1,947 lines,
> and the only test of the rules gate) and `scripts/gate0` (1,378) exactly as
> unchecked as they are now. A `scripts/pyproject.toml` is the answer for that
> reason too, not only for tidiness.

**PROOF — this task had none, which is why it is written out here.**

A workflow cannot be run locally, so the proof cannot be "CI passed". It must be
that **the workflow and the local gate cannot drift apart silently**:

- a test parses `.github/workflows/backend.yml` and asserts every gate the repo
  defines appears as a step — **derived by parsing, not compared to a hardcoded
  list**, or it becomes the same constant-against-itself defect that let Task 3's
  enum test pass while the two NA states were collapsed;
- the YAML parses and every command it names exists and is runnable;
- the `project` matrix covers every directory that has a `pyproject.toml`, so a
  new package cannot be added and silently go unchecked.

**INJECTION — this task had none either. All four must fail:**

| # | break | must fail |
|---|---|---|
| 1 | delete the rules-gate step from the workflow | the drift test |
| 2 | remove one project from the `project` matrix | the matrix-coverage test |
| 3 | add a directory with a `pyproject.toml` and no matrix entry | the same test — this is the direction that actually happens |
| 4 | corrupt the workflow YAML | the parse test, with a message naming the file |

**The `hygiene` job is red on `main` for reasons predating this plan** — trailing
whitespace in `apps/web-v2` and `design-export`, plus four container jobs and the
security job. Fixing those is out of scope for Plan 01, but **say so in the
report**: a green Plan 01 sitting inside a red workflow is not the same thing as
a green pipeline, and nobody should discover that later.

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
- `titlepipe_app` holds SELECT/INSERT/UPDATE on the six tenant tables and
  `tenants`, and **SELECT/INSERT only on `audit_log`** — no UPDATE, no DELETE;
- **every injection was run and observed to fail**, named in the commit message.

> **Correction, 2026-08-06 — this acceptance criterion demanded the opposite of
> what the code deliberately does.** It used to read: *"`titlepipe_app` holds
> SELECT/INSERT/UPDATE on all seven tables"*.
>
> `0002` grants `SELECT, INSERT` on `audit_log` and nothing more —
> `op.execute("GRANT SELECT, INSERT ON audit_log TO titlepipe_app")` in
> `migrations/versions/0002_forced_rls_and_grants.py::upgrade` — and
> `tests/test_forced_rls_and_grants.py:810::test_audit_log_is_granted_insert_but_never_update`
> asserts `UPDATE is False` and `DELETE is False`. The decision is recorded in
> commit `19f2638` and reasoned in the *"🔴 `audit_log` GETS NO `UPDATE`"*
> comment beside the statement: `0001`'s append-only trigger refuses UPDATE and
> DELETE whatever the ACL says, so the grant would change no behaviour and only
> misstate the intent.
>
> **Anyone checking Plan 01 against its own Done section concluded it had
> failed.** The acceptance list was never amended when the contract was; see the
> matching correction in Task 4.

**Not in this plan:** any HTTP route, WorkOS, R2, Procrastinate, OTel. Those land
at the gate that first needs them, so an unused dependency never reaches a
production image.

# Plan 02 — what actually happened

> **Audience: whoever writes Plan 03.** `00-HOW-TO-EXECUTE.md` §9 says each plan
> is written after the last one lands *"so each is informed by what actually
> happened rather than what was predicted."* This is that record for Plan 02,
> collected on 2026-08-06 rather than left across six commit messages.
>
> Like `01-WHAT-HAPPENED.md`, this is not a narrative and not a status report. It
> is the interface Plan 03 will call, the constraints it will hit, what the gates
> refuse now, and what is still open.

Read `02-first-vertical-slice.md` for the tasks as specified. Read this for what
the specification turned out to be wrong about. Where the two disagree, this one
is later.

**Every claim below was verified by the lead running it**, not taken from a
subagent's report. Where something was not verified, it says so. There is
deliberately no blanket warrant sentence — Plan 01 opened with one, it was never
true, and `a9a973a` deleted it.

Six commits, `b6653f3`…`8b27405`.

---

## 1. The interface Plans 03–06 consume

### The read path — `services/core-api/src/titlepipe_core/db/`

```python
from titlepipe_core.db import RuleRepository, refuse_unscoped_session

class RuleRepository:
    def __init__(self, session: AsyncSession) -> None: ...
    async def list_all(self) -> Sequence[Rule]: ...
```

`list_all` returns **every rule, every status, unfiltered**, ordered by
`(code, version, id)`. It is a **sibling of `TenantRepository`, not a subclass**
— see §3.1 for why the plan's stated reason for that was false.

`db.__all__` is now six names: the five from Plan 01 plus `RuleRepository`.
`RuleRepository` lives in `db/rules.py`, not `db/repository.py` — the split
happened because the fixes took `repository.py` to 416 lines, 16 over the
structural gate's cap, and a `rules-allow-file` there is the exact trade
`engine.py` was split out of `session.py` to refuse. **No import line changed.**

`refuse_unscoped_session(session, repository)` is **public** — a private name read
across modules is a pyright strict error and the gate bans the ignore. Both
repositories call it; it is one helper, not two copies. The message names the
class it was raised for and takes the caller-specific half as an argument.

### The wire — `services/core-api/src/titlepipe_core/api/schemas/rules.py`

```python
class RuleResponse(BaseModel): ...      # the contract's nine fields
class RulesResponse(BaseModel):
    rules: list[RuleResponse]
    @classmethod
    def from_rows(cls, rows: Iterable[Rule]) -> RulesResponse: ...
```

`from_rows` **must not re-sort** — the ordering decision belongs to the
repository, and moving it here makes that docstring false. `created_at` is on the
row and never reaches the wire.

### The database probe

```python
# titlepipe_core/db/health.py
async def check_database(engine: AsyncEngine) -> None: ...   # SELECT 1

# titlepipe_core/lifespan.py
async def probe_database(engine, timeout: float = DATABASE_PROBE_TIMEOUT_SECONDS) -> bool: ...
```

`check_database` is in `db/` and not `api/` for a real reason, measured: `api/`
is not carved out of the structural gate's `raw-sql` rule, so `text("SELECT 1")`
there yields two `[raw-sql]` violations.

`ServiceResources` now carries `engine`, `sessionmaker` and `database_answered`.
`readiness()` was **extended, not replaced** — `startup_complete` is unchanged and
unconditional, and the database key appears **only when a DSN is configured**.

### Settings

`app_database_url` ← `TITLEPIPE_APP_DATABASE_URL`. **This is a different variable
and a different role from `TITLEPIPE_DATABASE_URL`**, which `migrations/env.py`
reads as `titlepipe_migration`'s DSN. Sharing them would point the request path at
the role that holds the owner `WITH INHERIT FALSE` and no grants of its own.

**A deployed environment now REFUSES TO START without it.** Development and test
do not, so core-api still boots DB-less and Task 0's harness works.

### Errors

`api/errors.py` gained `mapped_status_for(error) -> int | None`. `status_for` is
behaviourally unchanged. See §3.7.

---

## 2. What Plan 03 inherits, unwired

- **There is no authentication of any kind.** `GET /api/rules` has no principal,
  no role header, no settings flag, and nothing defaulting to a permissive
  identity — deliberately, and verified under review. Plan 03 brings WorkOS.
  `handlers.ts:405`'s missing-header-defaults-to-admin is *not* reproduced.
- **`/health` and `/ready` are deliberately outside `/api`**, because Plan 03 will
  authenticate that prefix and a platform probe needing a session reports an
  outage every time identity is down.
- **`app.py` has two routers**: `health` and `rules`.
- **Readiness is a startup snapshot.** A database that dies after boot leaves
  `/ready` green. Measured against a real container. Making it live requires
  `readiness()` to become `async`, which changes `api/routers/health.py`.

---

## 3. Constraints a later plan will hit, each with its measurement

### 3.1 `TenantRepository` adds no tenant predicate, and the plan said otherwise

Plan 02 Task 2 asks for `RuleRepository` to inherit `TenantRepository` on the
promise that a `tenant=None` read would "quietly filter to nothing". **The base
adds no `WHERE` of any kind** — `get` is `select(model).filter_by(id=id_)`, and
its own docstring says the scoping "is not a `WHERE` clause anybody here can
forget". Filtering lives in the RLS policy, and `rules` has none.

MEASURED: with `class RuleRepository(TenantRepository[Rule])`, the whole
`services/core-api` suite was **224 passed**, identical to the tree without it,
pyright clean.

**This was the second of two injections in Plan 02 that could not fail, both for
the same reason: the plan attributed filtering to the layer that is easiest to
see.** Task 1's assumed a hardcoded table list where the derivation reads the
catalog; Task 2's assumed the repository scopes rows where the policy does.
**Distrust any remaining claim in Plans 03–06 that a Python layer filters.**

### 3.2 There is no "connect only" on an engine this application builds

`db/engine.py`'s pool `checkin` listener runs `RESET app.current_tenant` on every
return, so the wire is touched whether or not a caller executes anything.
MEASURED: `async with engine.connect(): pass` against a terminated backend raised
`psycopg.errors.AdminShutdown` **from `_restore_deny_sentinel`**.

Consequence for anyone testing connection-level behaviour: a "did it issue a
statement" test cannot be written as connect-versus-connect-and-execute. It is
written by **observation** instead — a `before_cursor_execute` listener on two
identically-built engines — and that works only because `_restore_deny_sentinel`
uses a raw DBAPI cursor, which that event does not see.

### 3.3 `vite preview` inherits `server.proxy`

MEASURED on vite 8.1.5: `resolvePreviewOptions` reads `preview?.proxy ?? server.proxy`.
A dev-only proxy is *not* lost in preview. Both are declared anyway, because the
app's dependence on that fallback should not be silent.

### 3.4 `process.env` and `import.meta.env` diverge, and `.env` reaches only one

Vite merges prefixed `process.env` **into** `import.meta.env`, never the reverse,
and `defineConfig`'s object form never calls `loadEnv`. MEASURED: with
`apps/web-v2/.env` holding `VITE_API_MODE=live`, the bundle came out byte-identical
to a real live build — MSW gated off — while the config saw nothing and configured
no proxy. No mocks and no backend, and `.env` is gitignored so review sees nothing.
Closed by the function form plus `loadEnv` with a pinned `envDir`.

### 3.5 `pnpm build` empties `dist/` wholesale

So the mock e2e run and the live harness collided until the harness bundles moved
to `dist-harness/`. They can now run concurrently — verified by running them at
the same time.

### 3.6 An unseeded but migrated database answers `200 {"rules":[]}`, not 503

MEASURED. So a CI job that drops its seed step fails as an **empty rulebook**, not
as an outage. Anything depending on rows must assert rows.

### 3.7 `if status >= 500` is not "unmapped"

`DependencyUnavailableError: 503` is registered in `DOMAIN_ERROR_STATUS`, and
`handle_domain_error` logged `domain_error_unmapped` at ERROR for every one of
them, because the guard read the number rather than the lookup. This service had
never returned a 503 before Plan 02. `mapped_status_for` now answers the question
that was actually being asked.

### 3.8 SQLAlchemy's `ENUM` result processor guards before Pydantic sees anything

MEASURED, forcing a `rule_origin` column to return a non-`str` via a psycopg
adapter: `LookupError: '_WireOrigin.spec' is not among the defined enum values`,
raised **inside `RuleRepository.list_all`**. So a `Literal` on the wire model has an
outer guard nobody had written down, and a bad driver return surfaces as a driver
error rather than a `ValidationError`.

### 3.9 `alembic check` still does not compare enum labels

Re-confirmed for `rule_status` and `rule_origin`: a changed label and a reordering
both leave it green. The `pg_enum` catalog assertion is the only thing catching
either. `01-WHAT-HAPPENED.md` §3.11 item 8 recorded this for `na_reason`; it holds
for every enum.

### 3.10 `/ready` distinguishes "no DSN" from "bad DSN", and `curl -f` does not

MEASURED, all three: DSN unset → **200 with the key absent**; DSN wrong → **503,
`database_answers:false`**; correct → **200, true**. A wait loop that only checks
`curl -f` catches the typo and sails past the omission.

### 3.11 The frozen e2e suite cannot run against a partially migrated backend

MEASURED: the whole of `apps/web-v2/e2e` against the live build, 118 tests,
nothing filtered — **44 passed, 74 failed.** The failures need endpoints that do
not exist until Plans 03–06. See §5 for the plan defect this exposes.

---

## 4. What the gates refuse now

Everything `01-WHAT-HAPPENED.md` §4 lists, unchanged, plus:

| gate | added |
|---|---|
| `.github/workflows/migration-harness.yml` | **a third workflow**, the only one whose path filter spans `apps/**`, `packages/**`, `services/**`, `libs/**` **and** `contract-fixtures/**`. It stands up Postgres, applies `roles.sql`, migrates, seeds, and runs both the contract-parity vitest project and the live browser harness |
| `backend.yml` | `contract-fixtures/**` in its paths |
| `scripts/tests/test_backend_workflow.py` | 198 tests (was 194). New: the shared contract fixture triggers the workflows that gate it; the harness runs the contract gate from a genuinely **enforcing** step — `continue-on-error` and a command replaced by an `echo` both fail it |
| `check_backend_rules.py` | 54 files (was 49) |

**A Pydantic field named `text` under `api/` does NOT trip the `raw-sql` rule.** I
probed it directly. Name the wire field honestly; do not add a `rules-allow` you
do not need.

---

## 5. The lesson, stated once

**Every task in this plan shipped a proof that scored full marks against a broken
system, and every one took a deliberate positive control to close.** This is not a
subagent failure mode. It is what denial-shaped proofs do by default, and the
lead made the same error too (§6, item 1).

| task | what passed while proving nothing |
|---|---|
| 0 | the proxy torn out of both `server` and `preview` — the denial still passed |
| 1 | the globality control passed against an **empty `orders` table**; the first repair, comparing what the seed wrote to what the table held, **still passed**, because both were empty mappings |
| 2 | `list_all` opening its own session off the same engine — 4 passed, both positive controls included |
| 3 | the Zod parity gate never ran on a backend change, so a regenerated fixture was checked only against the Python that produced it |
| 4 | `return False` as the first statement of the database probe — 243 passed |
| 5 | the project labelled "THE DELIVERABLE" passes **7 of 7 against MSW** |

**Two of the plan's five injections were unrunnable as written** (§3.1), and a
third — Task 0's proof — forward-referenced Task 4.

### What actually distinguishes live from mock

One assertion, in `e2e-live/reaches-core-api.spec.ts`: the `id` of every returned
rule matches a UUID, because the seed writes no `id` and lets
`gen_random_uuid()` mint it while MSW returns `rule_r13`. Verified in both
directions — against the MSW bundle it fails on `x-request-id` being null;
against a stub that stamps a request id **and** serves the mock's rows, it fails
on the UUID.

**Plan 02's evidence that a browser rendered a row out of Postgres rests on that
one assertion.** The `live-frozen-rulebook` project proves the frozen specs pass
*unmodified against the live build* — Task 5's stated CONTRACT, and worth having
— and nothing more. Six of its seven tests pass with core-api **stopped**.

### For writing an injection, added to Plan 01's checklist

13. **"Fails with no backend" is not "fails with the wrong backend."** Only the
    second distinguishes live from mock. Stopping the server proves a test needs
    *a* backend; pointing it at the mock proves it needs *this* one. The lead ran
    the first and reported the second.

---

## 6. Open items Plan 02 hands over

**1. The CI job has never been executed by anyone here.** `migration-harness.yml`
is traced end to end by reading, and every command in it was run by hand locally
in that order — but GitHub Actions cannot run in this environment. The branch is
pushed; read the run before trusting the job.

**2. Readiness is a startup snapshot.** §2. The caveat is in the OpenAPI field
description — the surface an operator reads — and asserted end to end, but the
behaviour is unchanged.

**3. `sqlalchemy.exc.TimeoutError` is in the retryable allowlist by argument, not
by test.** Nothing in the suite exhausts a pool.

**4. The probe's blackholed-host scenario is not reproduced.** It needs an
unroutable address, and a suite that assumed one would pass for the wrong reason
on any network that RSTs. That the bound is *enforced* is proven; the *number* is
a judgement, and the comment says so.

**5. `UNIQUE (code, version)` on `rules` is unruled.** The ordering is total on
today's schema (`code, version, id`) rather than on a constraint nobody has
decided. Whether two rules may share a code and version is a rulebook question and
this repo refuses to resolve one without a rule. **Plan 05 owns it**, being where
rule writes land.

**6. `psql` is now a runtime dependency of `pnpm --filter web-v2 test:e2e:live`,**
and so is a migrated, seeded database plus an exported `TITLEPIPE_DATABASE_URL`.
`.claude/CLAUDE.md` documents all three; the seed script refuses by name without
them. This was stale for several hours after Task 5 and was caught only by running
the documented command.

**7. `models.py` is 373 of the gate's 400 lines.** The next model added there trips
rule 6, and the honest answer is a split, not a `rules-allow-file`.

**8. The 13 files escalated on `rahuldr07/backend-plan01` for possible client data
are still with the owner.** Untouched by this plan, as instructed.

**9. Plan 02's own `Done` list contained an unachievable gate**, corrected in
place at `02-first-vertical-slice.md`'s Done section rather than quietly
reinterpreted. §3.11 has the measurement.

---

## 7. How to check this document is still true

```
cd services/core-api && uv run pytest              # 249 passed
cd libs/domain       && uv run pytest              # 134 passed
python scripts/check_backend_rules.py              # clean, 54 files, exit 0
uv run --with pytest python -m pytest -q scripts/tests   # 198 passed
pnpm --filter web-v2 test                          # 613 passed
pnpm --filter web-v2 test:e2e                      # 118 passed
git status --short apps/web-v2/e2e                 # EMPTY — frozen for Plan 02
```

The live harness needs the three prerequisites in §6 item 6:

```
pnpm --filter web-v2 test:e2e:live                 # 13 passed
```

`.github/workflows/migration-harness.yml` is the executable version of that
setup; read it rather than reassembling the commands by hand.

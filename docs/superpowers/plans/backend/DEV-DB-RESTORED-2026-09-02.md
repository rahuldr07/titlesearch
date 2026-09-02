# The dev database was dropped, and is restored — 2026-09-02

Companion note to `LIVE-DB-VERIFICATION-2026-09-01.md`. That document measured
the live dev database; between 07:07 and 07:55 UTC on 2026-09-02 the schema it
described was destroyed by scratch work, and two agents worked around the wreck
instead of repairing it. This records the repair, the credential state, and the
cause.

**Timing caveat, stated honestly.** When this node began at 07:55:07 UTC the
nine tables were *already* back and owned by `titlepipe_owner`, while
`titlepipe_migration` still carried the scratch password — so between the
coordinator's "0 tables in public" observation and this node, something (most
likely a concurrent agent running `alembic upgrade head`, or an earlier partial
`dev-db.sh`) had re-created the schema without reapplying `roles.sql`. That is a
worse state than an empty database, because it looks healthy while the migration
credential is wrong. This node ran the full `dev-db.sh up` anyway, which is
idempotent, and the numbers below are measured *after* that run.

## 1. State now (verified, 2026-09-02 07:55 UTC)

`scripts/dev-db.sh up` was run against the existing container
`titlepipe-db-postgres-1` (database `titlepipe`, loopback `127.0.0.1:55432`).
It is the documented path and it is idempotent: roles → `alembic upgrade head`
(0001 → 0002 → 0003) → rulebook seed.

Measured after the run, and matching `LIVE-DB-VERIFICATION` exactly:

```
tables in public                     9   (7 tenant tables + rules + alembic_version)
columns, excluding alembic_version  32
rules columns                       10
alembic_version                   0003
rows in rules                        4   (R13, R22, ESC-TAX-01 live; DRAFT-HOA-AGE pending)
RLS enabled+forced        all 7 tenant tables; rules neither, which is correct
roles                     5, owner NOLOGIN, none superuser, none BYPASSRLS
```

**One number in the task brief is wrong and should not be propagated:**
`rules=10` in `LIVE-DB-VERIFICATION` §1 is the **column** count of `rules`, not
a row count — that block is the per-table column census summing to 32. The
rulebook seeds **4** rows, because `seedRulebook.mjs` derives them from
`packages/mocks/src/data.ts::demoRules`, which holds four. A future agent that
"fixes" the seed to produce ten rules is chasing a misread table.

`titlepipe_app` can `SELECT` from `rules` (returns 4) and holds nothing more, so
the grant set survived the rebuild.

## 2. The `pw_scratch` credential — resolved, nothing to document

`gap-live-db-vs-audit` reported running
`ALTER ROLE titlepipe_migration PASSWORD 'pw_scratch'` without restoring it.
The intended credential source is **`scripts/dev-db.sh`**, not `.env`:

- `scripts/dev-db.sh` sets `DB_PASSWORD="${TITLEPIPE_DEV_DB_PASSWORD:-local-dev-not-a-real-secret}"`
  and builds both DSNs from it. It is a checked-in throwaway on purpose (the
  server is loopback-only and holds no client data).
- `.env.example` documents `TITLEPIPE_DATABASE_URL` / `TITLEPIPE_APP_DATABASE_URL`
  by NAME with the value elided, and the four `TITLEPIPE_*_PASSWORD` variables
  are name-only there by design. There is no `.env` in the tree.
- `migrations/sql/roles.sql` reads those four variables and is **convergent** —
  it re-`ALTER ROLE … PASSWORD`s on every run.

So the repair was automatic: running `dev-db.sh up` reapplied `roles.sql` and
reset the password back to `local-dev-not-a-real-secret`. Confirmed from the
host:

```
local-dev-not-a-real-secret  → connects
pw_scratch                   → FATAL: password authentication failed
```

No phantom auth failure remains, and no new password needs documenting. The
general rule this leaves behind: **a role password clobbered by scratch work is
never something to write down — `scripts/dev-db.sh up` converges it.**

## 3. Who dropped the schema

Nobody deleted the volume: the five roles survived, and `pw_scratch` was still
in place when this node started. That rules out `dev-db.sh reset` and
`compose down -v`. The damage was DDL inside the `titlepipe` database itself.

The container log carries the fingerprint (`docker logs titlepipe-db-postgres-1`):

- 07:21–07:22 UTC — scratch relations `t`, `n`, `c2`, `c3`, `parent`, `g` and
  errors like `column "v" of relation "n" contains null values`. This is
  constraint-semantics probing (`gap-constraint-counts`) run **against the live
  dev database**, not against a scratch one.
- 07:54:05 / 07:54:10 / 07:54:15 UTC — `permission denied for schema public`
  on `CREATE TABLE alembic_version`, followed at 07:54:31 by
  `WARNING: no privileges were granted for "public"`.

That pairing is diagnostic. `permission denied for schema public` for the
migration role, on a cluster where migrations previously worked, is what you get
**after `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`** — the recreated
schema is owned by the recreating role with the `roles.sql` grants gone, so
every table vanishes *and* Alembic can no longer create the first one. The
schema was dropped and recreated by scratch cleanup, and the agent that did it
then hit the permission error, gave up, and moved to a scratch database
(`tp_audit_check`, still present) rather than repairing what it had broken.

**Rule for the next agent, and the actual fix here:** scratch DDL never runs in
`titlepipe`. Create a throwaway database (`CREATE DATABASE tp_<topic>;`) or use
the `pytest` testcontainer, which is what `services/core-api/tests/conftest.py`
exists for. If you do break it, the repair is one command — `scripts/dev-db.sh up` —
and it is cheaper than the workaround both prior nodes chose.

`tp_audit_check` is left in place; it is inert, and dropping another agent's
scratch database is the same mistake in the other direction.

## 4. What I did not check

- I did not re-verify the `tenant_isolation` policy bodies or the exact grantee
  sets, only that RLS is enabled and forced per table (same gap as
  `LIVE-DB-VERIFICATION` §7).
- I did not run the `pytest` suite or the live e2e harness against the restored
  database; the verification is SQL-level plus a successful `alembic upgrade head`
  and rulebook seed.
- I did not confirm which specific agent issued the `DROP SCHEMA` — the
  statement itself is not in the log, only its aftermath. The attribution above
  is inferred from the error signature and timing.

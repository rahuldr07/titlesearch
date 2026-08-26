---
title: Running the backend locally
date: 2026-08-26
status: authoritative
owner: rahuldr07
tags:
  - titlepipe
  - backend
  - runbook
aliases:
  - Backend Runbook
  - Local Development Database
---

# Running the backend locally

Everything needed to get `core-api` serving real rows out of a real PostgreSQL
on your machine, and the browser app pointed at it.

`.github/workflows/migration-harness.yml` runs this same sequence in CI and is
the authority. When this document and that workflow disagree, the workflow is
right — read it rather than reassembling the commands by hand.

## 0. Prerequisites

| Tool | Why | Floor |
|---|---|---|
| Docker + Compose | runs the database | any current version |
| `psql` | `roles.sql` is a psql script, and the rulebook seed pipes SQL to it | **15+** — `\getenv` does not exist before it |
| `uv` | runs `alembic` out of core-api's locked environment | — |
| Node | runs the rulebook seed | **22.18+** (type stripping, no flag) |
| `pnpm` | the frontend, if you want one | 10.33.2 |

On Debian/Ubuntu, `psql` comes from `postgresql-client-18`. You do **not** need
a PostgreSQL *server* installed — the database runs in Docker.

## 1. The whole thing, in one command

```bash
scripts/dev-db.sh
```

That starts the database, applies the five roles, migrates the schema, and seeds
the rulebook. It is idempotent: run it as often as you like. Then:

```bash
eval "$(scripts/dev-db.sh env)"          # exports the three variables
cd services/core-api
uv run uvicorn titlepipe_core.app:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

And the frontend against it, in another shell:

```bash
VITE_API_MODE=live VITE_API_PROXY_TARGET=http://127.0.0.1:8000 pnpm --filter web-v2 dev
```

### Verify — grep the body, do not trust the status code

```bash
curl -sS http://127.0.0.1:8000/ready
```

The body must contain `"database_answers":true`. **A 200 alone is not enough.**
`api/routers/health.py` states the rule in the schema itself: a key is present
only for a dependency this deployment is *configured for*, so an absent key
means "not configured", never "healthy". Measured against this tree:

| `TITLEPIPE_APP_DATABASE_URL` | `/ready` |
|---|---|
| unset | `200 {"ready":true,…,"checks":{"startup_complete":true}}` |
| wrong | `503 {"ready":false,…,"database_answers":false}` |
| correct | `200 {"ready":true,…,"database_answers":true}` |

So `curl -f` catches the typo and sails straight past the omission — and the
omission is the likelier mistake. A working run looks like this:

```console
$ curl -sS http://127.0.0.1:8000/ready
{"ready":true,"service":"core-api","checks":{"startup_complete":true,"database_answers":true}}

$ curl -sS http://127.0.0.1:8000/api/rules
{"rules":[{"id":"a6cf564d-72ea-479c-8dc3-d8a20ecadec7","code":"DRAFT-HOA-AGE",…
```

Those `id`s are **database-minted UUIDs**. MSW answers `rule_r13` for the same
row, so a UUID is how you know you are looking at Postgres and not at the mock.

## 2. The other subcommands

```bash
scripts/dev-db.sh              # start + roles + schema + rulebook (idempotent)
scripts/dev-db.sh --no-seed    # everything but the rulebook
scripts/dev-db.sh reset        # destroy the volume, then rebuild all of it
scripts/dev-db.sh seed         # re-seed the rulebook only
scripts/dev-db.sh env          # print the three export lines, nothing else
scripts/dev-db.sh down         # stop the container, KEEP the data
```

`down` keeps the volume. `reset` is the only thing that discards it.

Overridable, all with sane defaults: `TITLEPIPE_DEV_DB_PORT` (55432),
`TITLEPIPE_DEV_DB_HOST`, `TITLEPIPE_DEV_DB_NAME` (titlepipe),
`TITLEPIPE_DEV_DB_PASSWORD`.

## 3. What the script actually does, and why the order is not guessable

Four steps. Two of them take **different DSNs naming different roles**, and that
is the part worth understanding before you debug anything.

**1 — `docker compose -f infra/compose/compose.db.yaml up -d`.** `postgres:18.4`,
the same tag CI's service container and `tests/conftest.py`'s testcontainer use.
Published on **127.0.0.1:55432**, not 5432 — see §5.

**2 — the five roles**, as the superuser, before any schema exists.
`migrations/sql/roles.sql` is *not Alembic's to run*: it creates
`titlepipe_migration`, which is the role Alembic connects **as**, so it cannot be
a revision. It is idempotent and convergent, and it refuses outright if any of
the four `TITLEPIPE_*_PASSWORD` variables is unset.

**3 — the schema**, `alembic upgrade head`, connecting as **`titlepipe_migration`**
via `TITLEPIPE_DATABASE_URL`. `migrations/env.py` refuses any other role. It is
the only one that can `SET ROLE titlepipe_owner`, and the owner is what every
object must belong to — a table created without that `SET ROLE` comes out owned
by a LOGIN role, which is exactly the RLS bypass the role split exists to
prevent.

**4 — the rulebook**, `apps/web-v2/e2e-live/seedRulebook.mjs`, also over the
migration role. `0003_rules.py` grants `titlepipe_app` `SELECT` and deliberately
no `INSERT`, so the app's DSN *cannot* seed. The four rules are derived from
`packages/mocks/src/data.ts` rather than written beside it, which is why the
frozen browser specs find the rule codes they name.

### 🔴 The two-variable trap

```
TITLEPIPE_DATABASE_URL       → titlepipe_migration   → alembic, and the seed
TITLEPIPE_APP_DATABASE_URL   → titlepipe_app         → the running core-api
```

They differ by one word. The roles behind them differ by every privilege that
matters. Pointing the request path at the migration role gives you a service
that can create tables — and it does **not** fail cleanly: `titlepipe_migration`
holds the owner `WITH INHERIT FALSE` and no table privileges of its own, so your
first read comes back as a permission error naming a table that plainly exists.

## 4. Checks, which need none of the above

The Python suite starts its own testcontainer, so these want a Docker daemon and
nothing else — no `dev-db.sh`, no exported DSN. From `services/core-api`, exactly
as CI runs them:

```bash
uv sync --frozen --all-groups
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run pytest
```

## 5. Traps, all of them measured on a real machine

**Port 5432 is probably taken.** The first machine this was built on had a native
`postgresql-18` cluster on it (`pg_lsclusters` → `18 main 5432 online`), and the
container refused to start: `failed to bind host port 127.0.0.1:5432/tcp:
address already in use`. That is the *good* failure. The bad one is silent — a
DSN pointed at 5432 on a machine that has both servers reaches whichever won the
port, and a schema applied to the wrong cluster looks exactly like success. Hence
55432. Nothing reads the number; every consumer takes a whole DSN.

**`postgres:18` changed where the volume goes.** Mount `/var/lib/postgresql`, not
`/var/lib/postgresql/data`. With the old path the container does not die — it
goes `unhealthy`, so the symptom is a health check that never passes rather than
an error anyone reads. 18+ puts the cluster in a major-version-specific
subdirectory under the parent, which is what makes `pg_upgrade --link` work
without crossing a mount boundary (docker-library/postgres#1259).

**`postgresql+psycopg://` is SQLAlchemy's spelling and `psql` rejects it.** The
seed script strips the `+driver` itself so one exported variable serves both
`alembic upgrade head` and the seed. If you hand-write a `psql` command, drop it.

**Wait on the health check, not the port.** A published port answers before
initdb has created the database, so a naive wait hands the roles step a server
that refuses the database by name.

**`roles.sql` needs psql 15+ *and* server 16+.** It checks both itself and says
so. The `INHERIT FALSE` on the owner membership is 16 syntax and is load-bearing.

## 6. Working without a database at all

```bash
cd services/core-api
TITLEPIPE_ENVIRONMENT=development uv run uvicorn titlepipe_core.app:create_app \
  --factory --host 127.0.0.1 --port 8000
```

This boots. `app_database_url` is optional outside a deployed environment, and
`/ready` answers 200 carrying no database check at all — `apps/web-v2/e2e-live`
depends on exactly that. `GET /api/rules` answers 503. Fine for route and
contract work; useless for a screen with rows.

Staging and production are different: they **refuse to start** without the DSN,
because a deployed replica without one is invisible on both surfaces an operator
watches — `/health` green (liveness consults no dependency), `/ready` green (a
missing DSN is not a failed check, it is *no* check) — while every product
request answers 503 forever.

## 7. Related

- `.github/workflows/migration-harness.yml` — the executable version of this
  document, and the authority when the two disagree
- `.env.example` — every backend variable, with names and safe examples only
- `infra/compose/compose.db.yaml` — the database this stands up
- `infra/compose/compose.yaml` — the Gate 1 service containers; separate
  lifecycle, and deliberately not wired to the database yet
- [`BUILD-PLAN.md`](BUILD-PLAN.md) — the canonical backend build plan

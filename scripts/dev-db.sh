#!/usr/bin/env bash
#
# Stand up the local development database and bring it to the state a running
# core-api expects: five roles, the migrated schema, and the rulebook seeded.
#
#     scripts/dev-db.sh              # start + roles + schema + rulebook (idempotent)
#     scripts/dev-db.sh --no-seed    # everything but the rulebook
#     scripts/dev-db.sh reset        # destroy the volume, then do all of the above
#     scripts/dev-db.sh env          # print the two export lines, nothing else
#     scripts/dev-db.sh down         # stop the container, keep the data
#
# The narrative version, including how to run core-api and the frontend against
# what this produces, is docs/backend/RUNNING-LOCALLY.md.
#
# WHY A SCRIPT AT ALL, when the six commands fit on a page: the ORDER is not
# guessable and two of the steps take DIFFERENT DSNs naming DIFFERENT ROLES.
# `roles.sql` is not Alembic's to run — it creates the role Alembic connects as,
# so it cannot be a revision, and it must be applied before `alembic upgrade` is
# called at all. `alembic upgrade head` then takes `TITLEPIPE_DATABASE_URL` (the
# MIGRATION role, the only one that can `SET ROLE titlepipe_owner`), while
# core-api takes `TITLEPIPE_APP_DATABASE_URL` (the APP role, `SELECT` on `rules`
# and nothing else). Those two variable names differ by one word and the roles
# behind them differ by every privilege that matters; swapping them produces a
# service that can create tables, and it does not fail cleanly.
#
# `.github/workflows/migration-harness.yml` runs the same sequence in CI and is
# the authority. This file is its local twin, and the two are meant to be read
# side by side.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/infra/compose/compose.db.yaml"

DB_HOST="${TITLEPIPE_DEV_DB_HOST:-127.0.0.1}"
# 55432 AND NOT 5432. A developer box with a native `postgresql` cluster already
# listening on 5432 is the ordinary case — the first machine this ran on was one
# — so the default that collides is the wrong default. See the long note in
# `compose.db.yaml`, which covers the silent version of the same problem: a DSN
# pointed at 5432 where both servers exist reaches whichever won the port, and a
# schema applied to the wrong cluster looks exactly like success.
DB_PORT="${TITLEPIPE_DEV_DB_PORT:-55432}"
DB_NAME="${TITLEPIPE_DEV_DB_NAME:-titlepipe}"

# ONE THROWAWAY FOR ALL FOUR ROLES, and it is checked in on purpose — the same
# reasoning as the harness workflow's `DB_PASSWORD`. The server this reaches is
# bound to loopback by `compose.db.yaml`, holds no client data, and is rebuilt
# by `reset` whenever anyone wants. What the roles are actually FOR — the owner
# cannot log in, the app holds `SELECT` and nothing else — is enforced by
# `roles.sql` and by `0002_forced_rls_and_grants.py`, and no password here
# changes any of it. Distinct per-role passwords would buy separation between
# four roles that only this machine can reach, at the cost of four values to
# keep in step with two DSNs.
#
# Override it for a database that is NOT disposable. Nothing else needs to change.
DB_PASSWORD="${TITLEPIPE_DEV_DB_PASSWORD:-local-dev-not-a-real-secret}"

MIGRATION_DSN="postgresql+psycopg://titlepipe_migration:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
APP_DSN="postgresql+psycopg://titlepipe_app:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mdev-db:\033[0m %s\n' "$*" >&2; exit 1; }

# Each tool is checked with the reason it is wanted, because the native failures
# are all unhelpful: docker's is a bare `command not found`, and psql's arrives
# from inside `seedRulebook.mjs` as an `ENOENT` naming no purpose.
require_tools() {
  command -v docker >/dev/null 2>&1 \
    || die "docker is not on PATH. It runs the Postgres in infra/compose/compose.db.yaml."
  command -v psql >/dev/null 2>&1 \
    || die "psql is not on PATH. roles.sql is a psql script (it uses \\getenv, so psql 15+), and the rulebook seed pipes SQL to it."
  command -v uv >/dev/null 2>&1 \
    || die "uv is not on PATH. It runs alembic out of services/core-api's locked environment."
}

# TITLEPIPE_DEV_DB_PORT is EXPORTED, not just set: `compose.db.yaml` interpolates
# it in the `ports:` mapping, and compose reads it from this process's
# environment. Without the export the file falls back to its own default and the
# container publishes a port this script is not talking to.
compose() { TITLEPIPE_DEV_DB_PORT="${DB_PORT}" docker compose -f "${COMPOSE_FILE}" "$@"; }

# Waits on the HEALTH CHECK rather than on the port. A published port answers
# before initdb has created ${DB_NAME}, so `pg_isready`-less waiting hands the
# roles step a server that refuses the database by name.
wait_for_health() {
  local container
  container="$(compose ps -q postgres)"
  [ -n "${container}" ] || die "the postgres container did not start; try: docker compose -f ${COMPOSE_FILE} logs postgres"

  local status
  for _ in $(seq 1 60); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "${container}" 2>/dev/null || echo unknown)"
    case "${status}" in
      healthy) return 0 ;;
      unhealthy) break ;;
    esac
    sleep 1
  done
  compose logs --tail 40 postgres >&2
  die "postgres never became healthy (last status: ${status:-unknown})"
}

# THE FIVE ROLES, before any schema exists, as the superuser — the only role in
# a fresh cluster that can create the other five and grant on `public`.
# `roles.sql` is idempotent and convergent, so this is safe to rerun, and it
# REFUSES outright if any of the four password variables is unset or empty.
apply_roles() {
  say "roles (migrations/sql/roles.sql, as the superuser)"
  PGPASSWORD=postgres \
  TITLEPIPE_MIGRATION_PASSWORD="${DB_PASSWORD}" \
  TITLEPIPE_APP_PASSWORD="${DB_PASSWORD}" \
  TITLEPIPE_WORKER_PASSWORD="${DB_PASSWORD}" \
  TITLEPIPE_BLIND_PASSWORD="${DB_PASSWORD}" \
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U postgres -d "${DB_NAME}" \
      -v ON_ERROR_STOP=1 -q -f "${REPO_ROOT}/services/core-api/migrations/sql/roles.sql"
}

apply_schema() {
  say "schema (alembic upgrade head, as titlepipe_migration)"
  ( cd "${REPO_ROOT}/services/core-api" \
    && TITLEPIPE_DATABASE_URL="${MIGRATION_DSN}" uv run alembic upgrade head )
}

# The rulebook, DERIVED from packages/mocks rather than written beside it, which
# is why the browser suite's frozen specs find the rule codes they name. It
# connects as the migration role and `SET ROLE`s to the owner, because
# `0003_rules.py` grants `titlepipe_app` `SELECT` and deliberately no `INSERT`.
seed_rulebook() {
  say "rulebook (e2e-live/seedRulebook.mjs, as titlepipe_owner)"
  ( cd "${REPO_ROOT}/apps/web" \
    && TITLEPIPE_DATABASE_URL="${MIGRATION_DSN}" node e2e-live/seedRulebook.mjs )
}

print_env() {
  cat <<ENV
export TITLEPIPE_ENVIRONMENT=development
export TITLEPIPE_APP_DATABASE_URL='${APP_DSN}'
export TITLEPIPE_DATABASE_URL='${MIGRATION_DSN}'
ENV
}

seed=true
command=up
for argument in "$@"; do
  case "${argument}" in
    --no-seed) seed=false ;;
    up|reset|down|env|seed) command="${argument}" ;;
    -h|--help) sed -n '3,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown argument: ${argument}" ;;
  esac
done

case "${command}" in
  env)
    print_env
    ;;

  down)
    compose down
    say "stopped. The volume is kept — 'scripts/dev-db.sh reset' is what discards it."
    ;;

  seed)
    require_tools
    seed_rulebook
    ;;

  up|reset)
    require_tools
    if [ "${command}" = reset ]; then
      say "discarding the volume"
      compose down -v
    fi

    say "starting postgres:18.4 on ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    compose up -d
    wait_for_health

    apply_roles
    apply_schema
    if [ "${seed}" = true ]; then seed_rulebook; fi

    cat <<DONE

$(say "ready. Export these, then start core-api:")

$(print_env)

    cd services/core-api
    uv run uvicorn titlepipe_core.app:create_app --factory --host 127.0.0.1 --port 8000 --reload

Then, in another shell, the frontend against it:

    VITE_API_MODE=live VITE_API_PROXY_TARGET=http://127.0.0.1:8000 pnpm --filter @titlepipe/web dev

Verify with 'curl -sS http://127.0.0.1:8000/ready' — the body must contain
"database_answers":true. A 200 alone is not enough: an unset DSN also answers
200, carrying no database check at all.
DONE
    ;;
esac

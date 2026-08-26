# TitlePipe

Title-search report automation for a US title-abstracting operation (~2,000
orders/month, target 20,000). County search packages — 36–181-page scanned PDFs —
are machine-extracted into 132 structured fields by an ensemble of independent
readers; human reviewers resolve only the fields the machine cannot prove; a
formatted report ships with measured quality. The target is **zero shipped
defects, not zero errors**: everything uncertain routes to a person, and every
value carries provenance (source document, page, snippet, engine, rule).

Internal production system. Data in scope is GLBA NPI; ALTA Pillar 3 applies.

## Orientation

Read in this order before writing code:

1. [`CLAUDE.md`](CLAUDE.md) — the repo guide and hard rules (byte-identical to `AGENTS.md`).
2. [`docs/HANDOFF.md`](docs/HANDOFF.md) — current project state. **Wins conflicts.**
3. [`docs/CONTEXT.md`](docs/CONTEXT.md) — domain facts; §11 is mandatory and not derivable from code.
4. [`docs/PRD.md`](docs/PRD.md) — the build document: data model, API contract, release gates.

[`docs/INDEX.md`](docs/INDEX.md) classifies every document in the tree —
authoritative vs. historical record vs. superseded.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web-v2/` | The frontend (React 19 · Vite 8 · TS strict · Tailwind v4). The only app; `apps/web` was deleted at rebuild. |
| `packages/` | pnpm workspace source: `contract` (Zod 4 wire schemas), `mocks` (MSW — the backend until FastAPI routes land), `ui-tokens`. **Not** county packages — those never enter VCS. |
| `services/` | Python 3.13 services, one uv project each: `core-api` (FastAPI, ADR-0001), `blind-svc`, `extraction-svc`, `render-svc`. |
| `libs/` | Shared Python: `domain` (tenant canon), `test-support`. |
| `scripts/` | Repo-wide gates: client-data guard, backend structural rules, lock and dependency audits. |
| `infra/` | Compose, containers, observability contract. |
| `docs/` | All documentation — see `docs/INDEX.md`. |
| `contract-fixtures/` | The wire fixture core-api's Pydantic models and `packages/contract`'s Zod schemas are both answerable to. Belongs to neither tree, which is why it sits at the root. |

## Commands

Frontend (repo root):

```bash
pnpm --filter web-v2 dev        # Vite on :5174, MSW serves all data
pnpm --filter web-v2 build      # tsc -b + vite build
pnpm --filter web-v2 test       # Vitest
pnpm --filter web-v2 test:e2e   # Playwright
pnpm --filter web-v2 lint       # eslint
pnpm --filter web-v2 check:rules
pnpm typecheck                  # all TS projects
```

Backend checks (from each `services/*` or `libs/*` directory). The Python suite
starts its own testcontainer, so these need a Docker daemon and nothing else:

```bash
uv sync --frozen --all-groups
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run pytest
```

Backend *running*, with a real database — full runbook in
[`docs/backend/RUNNING-LOCALLY.md`](docs/backend/RUNNING-LOCALLY.md):

```bash
scripts/dev-db.sh                   # postgres + the five roles + schema + rulebook
eval "$(scripts/dev-db.sh env)"     # exports the three variables
cd services/core-api && uv run uvicorn titlepipe_core.app:create_app \
  --factory --host 127.0.0.1 --port 8000 --reload
```

Then `curl -sS http://127.0.0.1:8000/ready` and check the body carries
`"database_answers":true` — a 200 alone is not enough, because an unset DSN
also answers 200, carrying no database check at all.

Repo-wide hygiene (run with the project interpreter — the codebase is
Python ≥3.13):

```bash
python scripts/check_locks.py
python scripts/check_no_client_data.py $(git ls-files)
python scripts/check_backend_rules.py
uvx pre-commit run --all-files
```

## Non-negotiables

The full list lives in `CLAUDE.md`; the ones that shape everything: never
generate backend logic from the UI; never emit a value you can't cite; the two
NA states never collapse; the server owns all state machines and thresholds;
judgments never auto-confirm in v1; county packages and seed databases never
enter version control.

Current phase: **P0** — see `docs/HANDOFF.md` §8/§10.

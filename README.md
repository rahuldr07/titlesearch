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

Before changing code, also read [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) —
the binding engineering conventions. §10 (handler/service/repository/mapper
layering) and §11 (comment discipline; one fact, one home) bind every change,
frontend included.

[`docs/INDEX.md`](docs/INDEX.md) classifies every document in the tree —
authoritative vs. historical record vs. superseded.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web/` | The frontend (React 19 · Vite 8 · TS strict · Tailwind v4), package `@titlepipe/web`. The only app; `apps/web-v2` was the rebuild's scratch copy and was deleted once its work landed here. |
| `packages/` | pnpm workspace source: `contract` (Zod 4 wire schemas), `mocks` (MSW — the backend until FastAPI routes land), `ui-tokens`. **Not** county packages — those never enter VCS. |
| `services/` | Python 3.13 services, one uv project each: `core-api` (FastAPI, ADR-0001), `blind-svc`, `worker`. |
| `libs/` | Shared Python: `domain` (tenant canon, redaction), `http-kit` (the HTTP layer both API services share), `service-kit` (service scaffolding: settings, logging, lifespan), `test-support`. |
| `scripts/` | Repo-wide gates: client-data guard, backend structural rules, lock and dependency audits. |
| `infra/` | Compose, containers, observability contract. |
| `docs/` | All documentation — see `docs/INDEX.md`. |
| `contract-fixtures/` | The wire fixture core-api's Pydantic models and `packages/contract`'s Zod schemas are both answerable to. Belongs to neither tree, which is why it sits at the root. |

## Setup

Prerequisites: Node + pnpm 10, [uv](https://docs.astral.sh/uv/) (which manages
Python 3.13 itself), and a running Docker daemon for the integration suites
(they start their own `postgres` testcontainer). Then:

```bash
pnpm install                                      # JS/TS workspaces
uv sync --frozen --all-groups                     # in each services/* and libs/* project
pnpm --filter @titlepipe/web exec playwright install chromium
```

## Commands

The root command surface — format, lint, typecheck, unit/integration/e2e
tests, architecture and dead-code gates, with per-command prerequisites — is
one table with one home:
[`docs/refactor-2026-09/COMMANDS.md`](docs/refactor-2026-09/COMMANDS.md).
The short version: **`pnpm check`** is the fast development subset,
**`pnpm verify`** is everything.

Beyond that table:

```bash
pnpm --filter @titlepipe/web dev   # Vite on :5174, MSW serves all data
```

Inside a single Python project, the same checks run directly: `uv run ruff
check .`, `uv run pyright`, `uv run pytest`.

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

Repo-wide hygiene not in the command table (run with the project interpreter —
the codebase is Python ≥3.13; `check_backend_rules.py` already runs inside
`pnpm check:architecture`):

```bash
python scripts/check_locks.py
python scripts/check_no_client_data.py $(git ls-files)
uvx pre-commit run --all-files
```

## Contributing

- Branch from `main`; keep a branch to one concern. Never commit county
  packages, seed databases, or anything under `/data/`.
- Before opening a PR: `pnpm check` at minimum (`pnpm verify` before merge),
  plus `uvx pre-commit run --all-files` — the hooks enforce, among other
  things, that every markdown link resolves (`check_doc_links.py`) and that
  `CLAUDE.md` and `AGENTS.md` stay byte-identical (`check_agents_sync.py`), so
  an edit to one is an edit to both.
- The PR template's four sections are all required, and the evidence section
  wants pasted command output — a ticked box is not evidence. For a bugfix or
  a new refusal, show the red before the green.
- When a document lands or changes class, update
  [`docs/INDEX.md`](docs/INDEX.md) in the same commit (its own standing rule).
- Review findings are tracked in
  [`docs/refactor-2026-09/REVIEW-LEDGER.md`](docs/refactor-2026-09/REVIEW-LEDGER.md);
  a finding closes with a named mechanism and a verified run, never with prose.
- A failing test may be correct behavior — check the rulebook and the
  provenance tag before "fixing" it, and never weaken an assertion to make a
  change fit.

## Non-negotiables

The full list lives in `CLAUDE.md`; the ones that shape everything: never
generate backend logic from the UI; never emit a value you can't cite; the two
NA states never collapse; the server owns all state machines and thresholds;
judgments never auto-confirm in v1; county packages and seed databases never
enter version control.

Current phase: **P0** — see `docs/HANDOFF.md` §8/§10.

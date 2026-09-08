# Root commands

One interface for the whole repository, run from the root as `pnpm <command>`. Every command
delegates to tools that already exist — the TypeScript side through pnpm filters, the Python side
through `scripts/run_python_checks.py`, which discovers the Python projects from the filesystem
(`scripts/` plus every `libs/*` and `services/*` directory holding a `pyproject.toml`) so the list
has one home and a new project is covered on the commit that creates it. A discovered project
without a `uv.lock`, or a missing prerequisite (uv; a reachable Docker daemon for the integration
subset), is a named failure, never a silent skip. Composites chain with `&&`: the first failing
sub-check fails the whole command.

| Command | What it runs | Prerequisites |
| --- | --- | --- |
| `pnpm format:check` | `prettier --check .` in `apps/web` + `ruff format --check .` per Python project | pnpm install, uv |
| `pnpm format` | `prettier --write .` in `apps/web` + `ruff format .` per Python project | pnpm install, uv |
| `pnpm lint` | `eslint .` in `apps/web` + `ruff check .` per Python project | pnpm install, uv |
| `pnpm typecheck` | `tsc` in every workspace package with a `typecheck` script + `pyright` per Python project | pnpm install, uv |
| `pnpm check:architecture` | `apps/web` `check:rules` + `check:imports` + `python3 scripts/check_backend_rules.py` | pnpm install, python3 |
| `pnpm check:dead-code` | `knip` in `apps/web` (its default rules cover unused files, exports **and** dependencies) | pnpm install |
| `pnpm test:unit` | `vitest run` in `apps/web` + `pytest` in the six Python projects that need no database (`scripts`, `libs/*`, `services/blind-svc`) | pnpm install, uv, Playwright chromium (vitest browser mode) |
| `pnpm test:integration` | `pytest` in the two suites that stand up `postgres:18.4` through testcontainers (`services/core-api`, `services/worker`) | uv, running Docker daemon |
| `pnpm test:e2e` | `playwright test` in `apps/web` (builds, then runs against a preview server on a worktree-derived port) | pnpm install, Playwright chromium |
| `pnpm check` | fast development subset: `format:check` → `lint` → `typecheck` → `check:architecture` → `test:unit` | union of the above minus Docker |
| `pnpm verify` | everything: `check` → `check:dead-code` → `test:integration` → `test:e2e` | union of all of the above |

The unit/integration split is derived, not listed twice: a Python project whose `pyproject.toml`
declares `testcontainers` is an integration suite. Prettier's scope is `apps/web` (where the only
prettier config lives), unchanged from the existing per-app script. `check:imports` is wired ahead
of its landing in `apps/web`; until it exists there, `check:architecture` fails with pnpm's named
"no such script" error rather than passing without it.

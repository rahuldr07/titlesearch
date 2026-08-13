# ZCode project config — TitlePipe

Pointer file. The repo guide, hard rules and current commands live in
[`CLAUDE.md`](../CLAUDE.md) (root) and [`.claude/CLAUDE.md`](../.claude/CLAUDE.md);
document classification lives in [`docs/INDEX.md`](../docs/INDEX.md). Read those —
this file only carries what is ZCode-specific and repeats nothing that can drift.

An earlier version of this file described the pre-rebuild stack (`apps/web`,
oxlint, 116 specs) and a document-precedence chain ending in three since-superseded
backend docs. It is retired; the guides above are the source of truth.

## ZCode-specific notes

- **Document precedence:** `docs/HANDOFF.md` → `docs/CONTEXT.md` §11 → `docs/PRD.md`
  → `docs/backend/BUILD-PLAN.md` (canonical for the backend build since 2026-08-04).
- **Backend:** seven independent uv projects (`services/*`, `libs/*`, `scripts/`), each with its own
  committed `uv.lock`. Run tooling from each project directory:
  `uv sync --frozen --all-groups` · `uv run ruff check .` · `uv run ruff format
  --check .` · `uv run pyright` · `uv run pytest`.
- **Repo-wide hygiene** (Python ≥3.13 — `scripts/check_backend_rules.py` parses
  PEP 695 generics and fails on older interpreters):
  `python scripts/check_locks.py` · `python scripts/check_no_client_data.py
  $(git ls-files)` · `python scripts/check_backend_rules.py` ·
  `uvx pre-commit run --all-files`.
- **Never** commit or push unless asked. No county packages, seed DBs, PDFs,
  uploads, `.env` or venvs in VCS — `scripts/check_no_client_data.py` is the gate.

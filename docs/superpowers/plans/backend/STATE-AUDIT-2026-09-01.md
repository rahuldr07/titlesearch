# Backend state audit, measured 2026-09-01

Fourth companion to `LEAD-MEASUREMENTS-2026-09-01.md`. Counted from the tree by
the lead. Where a number here disagrees with a document, this file is the
later measurement.

---

## Code and tests, by component

| component | src LOC | tests | serves |
|---|---:|---:|---|
| `services/core-api` | 3,520 | 210 | `GET /api/rules`, `/health`, `/ready` |
| `services/blind-svc` | 1,301 | 19 | `/health`, `/ready` only |
| `services/render-svc` | 425 | 16 | nothing — a CLI that refuses to run |
| `services/extraction-svc` | 415 | 15 | nothing — a CLI that refuses to run |
| `libs/domain` | 836 | 46 | canon: redaction, tenancy, errors, clock, ids |
| `libs/test-support` | 57 | 7 | fixtures |

Backend total: **249 tests, all passing** (`uv run pytest`, 20.25s).

## The proportion worth reading

Of core-api's 3,520 lines, the entire rulebook feature — repository, router and
schemas — is **504 lines**. The other **3,016 (85%)** is seam and plumbing:
`api/errors.py` (386), `db/models.py` (373), `lifespan.py` (301),
`db/session.py` (296), `settings.py` (292), `db/repository.py` (282),
`api/request_context.py` (258), `db/engine.py` (225).

That ratio is not a criticism. It is the shape Plans 01 and 02 deliberately
built: the tenant seam, the forced-RLS proof, the error envelope and the
structural gate all had to exist before the first domain endpoint could be
trusted. But it means **the marginal cost of endpoint #2 is far below the cost
of endpoint #1**, and a plan that extrapolates "one endpoint took two plans"
into a schedule will be badly wrong in the pessimistic direction.

## Two services are scaffolding that refuses to run, honestly

`extraction-svc` and `render-svc` are each a 155-line CLI with two commands:
`check` validates configuration and exits 0/non-zero for a deploy gate, and
`run` **refuses to start** — because there is no queue yet, and
`cli.py:8-10` states the reason: *"a worker that silently idles is
indistinguishable from one that is broken."*

That is the right call and it should be preserved. The extraction pipeline,
the engine adapters, the ensemble and the DOCX render path are **entirely
unbuilt** — not partially built.

`blind-svc` is 1,301 lines and serves only `/health` and `/ready`. Its bulk is
`api/errors.py` (341), `api/request_context.py` (258) and
`telemetry/sensitivity.py` — the PII-redaction machinery for a seat that
handles NPI. So the compliance scaffolding landed before the endpoints, which
is the correct order for this data, but `POST /api/blind/{order}/entries` —
the seat's one mutation and its only write — does not exist.

## Migrations

Three revisions: `0001_skeleton`, `0002_forced_rls_and_grants`, `0003_rules`.
Column counts and the gap are in `SCHEMA-GAP-2026-09-01.md`. `0002` is
14 + 7 raw `op.execute` statements; RLS, policies and grants are not
expressible through Alembic's schema API and are written as SQL.

## What the structural gate refuses

`scripts/check_backend_rules.py` is an AST checker, clean at **54 files**. Its
rule ids: `any-type`, `file-length`, `http-exception`, `http-response`,
`print`, `raw-sql`, `savepoint`, `begin`. Exemptions must be written as
`rules-allow(<rule-id>): <reason>` with a reason of at least 12 characters;
the old bare `rules-allow:` form is still *recognised* specifically so that
writing it earns an explanation rather than being silently swallowed
(`check_backend_rules.py:563-566`).

## CI

`.github/workflows/backend.yml` runs four jobs. `hygiene`: backend structural
rules, lock currency, guard/gate tests, a client-data guard over the whole
tree, markdown link resolution, an assertion that `CLAUDE.md` and `AGENTS.md`
are byte-identical, and pre-commit over all files. Per-project matrix: frozen
install, `ruff check`, `ruff format --check`, **pyright strict**, tests, build
distributions, dependency audit. Container matrix: build image, verify it does
**not run as root**, verify no reload or debug flag in the runtime command.
Plus SBOM and vulnerability scanning.

This is a serious pipeline. It is also, per `LEAD-MEASUREMENTS §3`, one that
has **never run on the current frontend branch** — the last recorded run on
`main` was a failure on 2026-08-26.

## The honest summary

The backend has an excellent foundation and almost no product. The tenant
seam, redaction, error envelope, structural gate, container hardening and RLS
proof are real and tested. The pipeline that turns a county package into a
delivered report — extraction, assembly, review workflow, render, delivery —
is **not started**. One domain endpoint of ~47 is served.

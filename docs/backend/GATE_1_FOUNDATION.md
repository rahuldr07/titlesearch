---
title: Gate 1 — Python Backend Foundation
date: 2026-07-22
status: local-foundation-complete-official-gate-partial
owner: rahuldr07
tags:
  - titlepipe
  - backend
  - gate-1
  - foundation
aliases:
  - Gate 1 Foundation Record
  - Backend Foundation
---

# Gate 1 — Python backend foundation

> [!warning] **Gate 1: LOCAL FOUNDATION COMPLETE — OFFICIAL GATE PARTIAL**
>
> Every source, tooling, lock, test and build criterion passes, and the
> foundation is complete enough to develop Gate 2 on. That is the working
> status: **local-development complete**.
>
> The **official** gate stays partial. **Docker and WSL2 are not installed**, so
> the container build, run, non-root and health-check evidence does not exist,
> and nothing has been pushed so remote CI has never run. Both are deferred
> until before staging, deliberately — neither blocks Gate 2, which needs
> Testcontainers and therefore needs the same Docker install.
>
> No container criterion is claimed. A written CI step is not evidence that it
> passed.

## 1. What exists

Six independent Python projects, each with its own `pyproject.toml`, its own
committed `uv.lock` and its own virtualenv. There is no uv workspace and no
shared environment: a workspace produces one lockfile across all members, which
is exactly the "one giant Python environment" the plan rejects.

```text
TitleSearch/
├─ libs/
│  ├─ domain/                       # framework-free primitives, imported by all four services
│  │  └─ src/titlepipe_domain/
│  │     ├─ errors.py               # the domain error taxonomy — no HTTP, no status codes
│  │     ├─ redaction.py            # ONE shared implementation; see §5
│  │     ├─ clock.py                # Clock protocol + SystemClock (tz-aware UTC)
│  │     ├─ identifiers.py          # IdFactory protocol + Uuid4IdFactory
│  │     └─ runtime.py              # Environment / ServiceName / LogRenderer
│  └─ test-support/                 # FrozenClock, SequenceIdFactory — test doubles only
│
├─ services/
│  ├─ core-api/src/titlepipe_core/
│  │  ├─ settings.py                # typed config + deployed-environment refusals
│  │  ├─ app.py                     # create_app() factory — no module-level app
│  │  ├─ lifespan.py                # ServiceResources, explicit open/close, readiness
│  │  ├─ api/errors.py              # the one error-mapping layer
│  │  ├─ api/request_context.py     # correlation id: generate, propagate, bind, reset
│  │  ├─ api/routers/health.py      # /health, /ready
│  │  └─ telemetry/
│  │     ├─ logging.py              # structlog chain; redaction LAST, before the renderer
│  │     └─ hooks.py                # narrow tracing/metrics seam (no OTel dependency)
│  ├─ blind-svc/src/titlepipe_blind/     # same shape; stricter redaction; isolation refusals
│  ├─ extraction-svc/src/titlepipe_extraction/
│  │  ├─ settings.py                # concurrency + spend ceilings (Decimal)
│  │  └─ cli.py                     # check / run, named exit codes
│  └─ render-svc/src/titlepipe_render/
│     ├─ settings.py                # converter must be internal
│     └─ cli.py                     # check / run
│
├─ infra/
│  ├─ containers/Dockerfile.{core-api,blind-svc,extraction-svc,render-svc}
│  ├─ compose/compose.yaml
│  └─ observability/README.md       # the telemetry contract, before the collectors
│
├─ scripts/
│  ├─ check_locks.py                # every uv.lock matches its pyproject.toml
│  ├─ check_no_client_data.py       # refuses PDFs, DOCX, .seed, uploads/
│  ├─ audit_dependencies.py         # pip-audit over each frozen lock
│  └─ tests/                        # the client-data guard is a control, so it has tests
│
├─ .github/workflows/backend.yml
├─ .pre-commit-config.yaml
├─ .dockerignore                    # deny-by-default build context; see §9
├─ ruff.toml                        # shared lint config; does not merge environments
└─ .env.example                     # names and safe examples only
```

## 2. Service responsibilities and forbidden imports

| Service | Responsibility | Must never import / hold |
|---|---|---|
| `core-api` | HTTP orchestration, contracts, auth, RBAC, RLS context, presigning, domain commands | Blind database credentials; engine adapters |
| `blind-svc` | Blind assignment and entry capture only | `titlepipe_core`, `titlepipe_extraction`, `titlepipe_render`; any Core database URL; any storage prefix but `blind-input` |
| `extraction-svc` | Validation, segmentation, classification, extraction, assembly, routing | Another engine's output; render templates |
| `render-svc` | DOCX generation, PDF conversion, versioning, delivery preparation | A publicly reachable converter |
| `libs/domain` | Shared vocabulary | FastAPI, SQLAlchemy, WorkOS, PgQueuer, boto3, any vendor SDK |
| `libs/test-support` | Test doubles | Production secrets, client data, county packages, seed fixtures |

Three of these are **enforced by tests**, not documentation:

- `libs/domain/tests/test_import_boundary.py` **parses** every module with `ast`
  and rejects a forbidden import wherever it appears — module level, function
  body, `TYPE_CHECKING` block or conditional.

  > Corrected after review. The original test imported each module and diffed
  > `sys.modules`, and its docstring claimed that caught a lazy import inside a
  > function body. It does not: importing a module does not execute its function
  > bodies, so `def load(): import boto3` passed. The AST scan catches it, and
  > `test_the_scan_detects_a_lazy_import` proves the scan itself works. The
  > `sys.modules` check is kept, rescoped to what it genuinely covers —
  > *transitive* arrivals that no source file names.
- `services/blind-svc/tests/test_blind_boundary.py` asserts both that the blind
  package does not import Core or the workers **and** that those packages are
  not installed in its environment at all — so a future import cannot reach
  them either.
- `services/core-api/tests/test_errors.py::test_domain_and_service_code_never_import_httpexception`
  scans the package for `HTTPException` outside the mapping layer.

## 3. Commands

Run from each project directory. Every one of these was executed for this
record; results are in §8.

```bash
uv sync --frozen --all-groups     # frozen install; fails if the lock has drifted
uv run ruff check .
uv run ruff format --check .
uv run pyright                     # strict
uv run pytest
uv build                           # wheel + sdist
```

Repository-wide, from the root:

```bash
python scripts/check_locks.py            # all six locks current
python scripts/audit_dependencies.py     # pip-audit over each frozen lock
uv run --with pytest python -m pytest scripts/tests   # the client-data guard's own tests
git ls-files -z | xargs -0 python scripts/check_no_client_data.py
uvx pre-commit run --all-files           # verified to pass twice from a clean tree
```

Workers, directly:

```bash
cd services/extraction-svc && uv run titlepipe-extraction check
cd services/render-svc     && uv run titlepipe-render check
```

Docker (**not yet executed — see §9**):

```bash
docker build -f infra/containers/Dockerfile.core-api -t titlepipe/core-api:dev .
docker compose -f infra/compose/compose.yaml build
docker compose -f infra/compose/compose.yaml up -d core-api blind-api
docker compose -f infra/compose/compose.yaml run --rm extraction-worker check
```

Note the build context is the **repository root** for every image, because each
service depends on `libs/domain` by path.

## 4. Dependency and lock strategy

- One `pyproject.toml` and one committed `uv.lock` per deployable. No workspace.
- `requires-python = ">=3.13,<3.14"`. Python 3.13.14 via `uv`; the machine's
  global 3.14.5 is not used by any service.
- Gate 1 dependencies are only what each shell needs. SQLAlchemy, psycopg,
  Alembic, WorkOS, PgQueuer, boto3, HTTPX, pikepdf, pypdfium2, docxtpl and the
  provider SDKs land at the gate that first uses them, so an unused dependency
  never reaches a production image or slows an earlier CI run.
- `libs/domain` and `libs/test-support` are path dependencies, editable for
  development and installed as real copies in images (`uv sync --no-editable`).

### Two version deviations from `TOOLCHAIN.md`, both forced

| Manifest says | Resolved to | Why |
|---|---|---|
| `pytest-cov` (unpinned in the manifest; `8.*` attempted) | `7.*` | 8.x does not exist. Latest is 7.1.0. |
| `httpx==0.28.*` as the TestClient dependency | `httpx2>=2,<3` | Starlette 1.1 emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`, and its TestClient is typed against `httpx2`. With plain `httpx`, Pyright strict reported **86 errors in test files** from unresolved types. Following Starlette's own instruction dropped that to **0** and removed the warning. This is a dev/test dependency only; no service ships either package. |

## 5. Application foundation

### App factory and lifespan

`create_app()` builds an application; importing the module does not. There is no
module-level `app`, no import-time client and no process-global mutable state —
`ServiceResources` is attached to the app instance, so two apps in one test
process hold independent settings. Tests assert all of this, including that
resources open and close **exactly once** (counted, not asserted once: a
lifespan that runs twice opens two pools).

### Error envelope

Every non-2xx response, from every service:

```json
{
  "error": {
    "code": "RULE_REQUIRED",
    "message": "Resolution requires an existing or drafted rule.",
    "request_id": "opaque-id",
    "details": {}
  }
}
```

Domain code raises `DomainError`; only `api/errors.py` knows what status that
becomes. The mapping walks the MRO, so a future
`EscalationRequiresRuleError(RefusalError)` maps to 422 without registration,
and an unregistered failure becomes 500 rather than silently reporting success.

| Domain error | Status | Code |
|---|---:|---|
| `ValidationError` | 422 | `VALIDATION_FAILED` |
| `RefusalError` | 422 | `REFUSED` |
| `UnauthenticatedError` | 401 | `UNAUTHENTICATED` |
| `PermissionDeniedError` | 403 | `PERMISSION_DENIED` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `DependencyUnavailableError` | 503 | `DEPENDENCY_UNAVAILABLE` |

Two things the layer refuses to pass through:

- **Submitted values.** FastAPI echoes the offending input in validation errors
  by default. On this system that input is a grantor name or a legal
  description, so `input`, `ctx` and `url` are stripped and only the field
  location and the failed rule survive. Tested with a literal party name.
- **Internals.** In a deployed environment an unhandled exception yields a
  generic 500 with no type, message or traceback; the detail goes to the log
  bound to the same `request_id`. Tested with a connection string containing a
  password.

### Request correlation

`X-Request-ID` on every response. An inbound value is accepted only after
passing a strict character and length check — the value lands in every log line
for that request, so an unvalidated header is log injection and unbounded
growth. A rejected header is not an error: the caller loses correlation, the
request succeeds.

The context is always reset in `finally`, so a recycled task cannot inherit the
previous request's identity. **This is the same mechanism the tenant context
uses at Gate 2**, which is the main reason it is built and proven now.

> **A real defect this found.** The correlation id was initially resolved from a
> `ContextVar` alone. Starlette's `ServerErrorMiddleware` — which invokes the
> handler for an unhandled exception — sits *outside* the request-context
> middleware and therefore runs *after* its reset, so every unhandled 500
> returned `"request_id": null`: absent on precisely the response whose id a
> caller most needs to quote. The id is now also written into the ASGI scope,
> which outlives the middleware frame, and `request_id_for(request)` reads it
> from there. Regression test:
> `test_an_unhandled_exception_leaks_nothing_in_production` asserts a non-empty
> `request_id`.

### Logging and redaction

Chain order: **context merge → level → timestamp → exception formatting →
redaction → render.** Redaction is **last, immediately before the renderer.**

> **Corrected after review — this was a real NPI and credential leak.**
> The first version put redaction *first*, on the theory that nothing
> downstream could then see an unredacted value. That is wrong, because
> processors after it **create** fields. `format_exc_info` builds the traceback
> string after redaction had already run, so an exception message reached
> stdout verbatim — and `handle_unexpected` calls `log.exception` on every
> unhandled error in production. A `RuntimeError` carrying a connection string
> or a party name was logged in full.
>
> Two further gaps found at the same time: `database_url` and
> `connection_string` matched no key rule, and the defect existed in all four
> duplicated copies of the module.
>
> The property that actually matters is that **no processor runs after
> redaction except the renderer**, which is now asserted structurally by
> `test_nothing_runs_after_redaction_except_the_renderer`.

**Redaction now lives once, in `libs/domain/redaction.py`.** It is pure
dict-and-string manipulation with no framework import, so it belongs there, and
a compliance control that must be byte-identical in four processes should never
have been copy-pasted. That duplication is exactly why one defect became four.

Three mechanisms, because key-matching alone is insufficient:

1. **By key** — substring match on a normalised key, so `grantor`,
   `grantor_name` and `mortgagor_names` all match without an exhaustive list.
   Diagnostic keys (`request_id`, `event`, `status_code`, `duration_ms`,
   `page_count`) are explicitly exempt: redaction that eats the diagnostics gets
   switched off by whoever is on call, which is how the rest stops being
   enforced.
2. **By shape, in any string value** — a credential does not become safe by
   being logged under a friendly name. Presigned URLs are truncated at the
   query string; `scheme://user:password@host` is masked wherever it appears,
   including inside a `detail` message or a traceback; `password=` / `token=` /
   `api_key=` pairs in a connection string are masked. The host survives,
   because *which* database was unreachable is the diagnostic value.
3. **Exception text** — in a deployed environment the traceback keeps its
   **frames** (file, line, function) and its exception **type**, and drops every
   message and echoed source line. Frames are code structure and identify no
   one; a message is arbitrary data-controlled text. Locally the full text is
   kept — there is no real NPI in development and a redacted traceback wastes an
   afternoon — but credentials are masked even there.

Recursion is depth-bounded, so a cyclic structure cannot turn a log call into a
hang.

Rendering is the only thing that varies by environment — console locally, JSON
when deployed. **Event names and field names are identical**, so a line a
developer read locally is greppable in staging.

The redaction tests include a **control case**: with `redaction_enabled=False`
the value appears in the output. Without it, the passing tests would not
distinguish "the processor removed it" from "the formatter happened not to
print it".

The blind service redacts strictly more, via `extra_sensitive_parts` in
`telemetry/sensitivity.py`: anything named for an engine, reading, confidence,
model, extraction state, golden value, reconciliation or the other seat. These
**extend** the shared rules rather than replacing them. None of that should
exist in that process; if it appears in a log record it is a boundary failure,
and redaction keeps it out of the shipper while the boundary tests keep it out
of the code.

> **A second real defect.** The worker CLI held a module-level
> `_log = get_logger(__name__)`. structlog caches a bound logger on first use,
> so a proxy created at import time pins whatever configuration was active first
> and silently ignores the one the command just installed — the JSON renderer
> never took effect. Loggers are now acquired inside each command, after
> `configure_logging`.

### Telemetry seam

`RequestMetrics` is a protocol with a `NullRequestMetrics` implementation. It
takes a fixed argument list — method, templated route, status code, duration —
and **no attribute bag**, because an attribute bag is how tenant and order
identifiers end up in Prometheus labels: a cardinality explosion and a leak in
one mistake. No OpenTelemetry or Sentry dependency exists yet; the contract they
must satisfy is written down in `infra/observability/README.md`.

### Injected clock and identifiers

`Clock` and `IdFactory` are protocols in `libs/domain`, with `FrozenClock` and
`SequenceIdFactory` in `libs/test-support`. `FrozenClock` rejects a naive
datetime at construction rather than letting one reach the code under test.
Startup time and correlation ids are therefore equality assertions, not ranges.

## 6. Settings safety

One typed settings schema per deployable, one code path across environments.
Development and production differ in *configuration and rendering*, never in
business behaviour; there is no second settings implementation and no
`if development:` around a domain rule.

`extra="forbid"` means a typo in a deployment variable fails loudly instead of
silently leaving the safe default in place. `frozen=True` means settings cannot
be mutated after validation. Secrets are `SecretStr`, so a secret is absent from
`repr` and `str` — tested — and nothing logs the settings object.

**Staging carries production's rules.** `Environment.is_deployed` covers both,
because staging integrates with real WorkOS, R2 and providers: an unsafe knob
there is a real exposure, not a rehearsal.

Refusals in a deployed environment — each with its own test:

| Refusal | core-api | blind-svc | workers |
|---|:-:|:-:|:-:|
| debug enabled | ✓ | ✓ | ✓ |
| reload enabled | ✓ | ✓ | — |
| mock auth enabled | ✓ | ✓ | — |
| public API docs enabled | ✓ | ✓ | — |
| log redaction disabled | ✓ | ✓ | ✓ |
| wildcard CORS origin | ✓ | ✓ | — |
| empty CORS allowlist | ✓ | ✓ | — |
| placeholder seal password | ✓ | ✓ | — |
| loopback-only host | ✓ | ✓ | — |

Refusals that apply in **every** environment, including development:

- **Seal password must be exactly 32 characters** (WorkOS sealed sessions). Fail
  at startup, not at first login.
- **The blind service refuses any Core database URL.** A developer who can reach
  the Core database from the blind service will write code that assumes it, and
  the isolation is already lost by the time staging refuses.
- **The blind service refuses any storage prefix but `blind-input`.**
- **The render worker refuses a non-internal converter URL.** Pointing at a
  hosted converter sends client documents to a third party, and that is not less
  true on a laptop.
- **The extraction worker refuses a per-order spend ceiling above the daily
  one** — it would never bind, which is a bound that only looks like one. Both
  ceilings are `Decimal`, never float.

## 7. Health, readiness and worker checks

- **`/health`** — process liveness. Never consults a dependency. If it did, a
  database blip would fail liveness on every replica and turn a recoverable
  outage into a restart storm.
- **`/ready`** — 200 with per-check results, or **503** when not ready, so the
  platform routes around the replica. At this gate the only truthful check is
  `startup_complete`. It must be **extended, not replaced**, as the database,
  object store and queue land: a probe that reports healthy for something it
  never checked silently converts an outage into a stream of 500s.
- **Workers** — `titlepipe-extraction check` / `titlepipe-render check` exit `0`
  on valid configuration and `2` on invalid, with the failing **field names**
  logged and never the values, because a rejected setting may be a credential.
  `run` exits `3` until the queue exists: a worker that starts, finds nothing
  and loops quietly looks healthy on every dashboard while doing nothing.

Named exit codes: `0` ok · `2` invalid configuration · `3` not implemented ·
`70` unexpected. A deploy gate must be able to tell "you misconfigured it" from
"it broke".

**No product `/api/*` route exists.** Asserted from the generated OpenAPI
schema.

> **A third real defect, in the tests themselves.** The route assertion was
> originally `isinstance(route, starlette.routing.Route)`. FastAPI's `APIRoute`
> is **not** a subclass of that class in this version, and an included router
> appears in `app.routes` as an opaque `_IncludedRouter` with `path = None` and
> no children. The filter therefore matched only `/docs` and `/openapi.json`,
> and the assertion passed **without ever inspecting a product endpoint** — it
> would have stayed green after someone added `/api/orders`. It now reads
> `app.openapi()["paths"]`, which is what the service actually serves.

## 8. Verification results

Executed on this machine, 2026-07-22. Windows 11 Pro for Workstations
10.0.26200, x86_64. git 2.54.0 · uv 0.11.26 · CPython 3.13.14 (uv-managed) ·
Node v24.15.0 · pnpm 10.33.2.

### Per project

| Project | `sync --frozen` | ruff check | ruff format | pyright strict | pytest | `uv build` |
|---|:-:|:-:|:-:|:-:|---:|:-:|
| `libs/domain` | pass | pass | pass | pass | **77 passed** | pass |
| `libs/test-support` | pass | pass | pass | pass | **7 passed** | pass |
| `services/core-api` | pass | pass | pass | pass | **73 passed** | pass |
| `services/blind-svc` | pass | pass | pass | pass | **39 passed** | pass |
| `services/extraction-svc` | pass | pass | pass | pass | **13 passed** | pass |
| `services/render-svc` | pass | pass | pass | pass | **20 passed** | pass |
| | | | | | **229 total** | |

Up from 191 before review. The redaction rules and the import-boundary scan
moved into `libs/domain` — which is why its count grew and `core-api`'s fell —
and the review findings added tests of their own.

Pyright ran in **strict** mode with **0 errors, 0 warnings** in every project.

### Repository-wide

| Command | Result |
|---|---|
| `python scripts/check_locks.py` | pass — all six locks current |
| `python scripts/audit_dependencies.py` | pass — no known vulnerabilities |
| `uv run --with pytest python -m pytest scripts/tests` | **20 passed** — the client-data guard's own tests |
| `git ls-files -z \| xargs -0 python scripts/check_no_client_data.py` | pass over every tracked file |
| `uvx pre-commit run --all-files` | **pass, twice consecutively** from a clean tree |
| `git diff --check` | clean |
| YAML parse: workflow, pre-commit, compose | all three parse |

The pre-commit run is the one that previously failed. Its first pass added a
trailing newline to two pre-existing frontend files (`apps/web/package.json`,
`apps/web/public/favicon.svg`) — a one-byte, content-preserving change, and
exactly what `end-of-file-fixer` is for. The second pass was clean.

### Frontend regression, run once after all Gate 1 work

| Command | Result |
|---|---|
| `pnpm --filter web typecheck` | pass |
| `pnpm --filter web test` | **22 passed** (2 files) |
| `pnpm --filter web lint` | exit 0, **10 warnings**, 0 errors |
| `pnpm --filter web build` | pass, built in 711 ms |
| `pnpm --filter web test:e2e` | **116 passed** |

Re-run after the review fixes, not carried over from the first pass.

### Known warnings

The 10 oxlint warnings are **pre-existing and unchanged** by this work — all
`react(only-export-components)` in `src/components/notice.tsx` (1),
`src/components/field.tsx` (8) and `src/router.tsx` (1). Count and locations
identical before and after Gate 1.

No Python warnings remain: the Starlette TestClient deprecation warning was
resolved by adopting `httpx2` (§4).

## 9. Build context and container verification

### Build context — `.dockerignore`

Every image builds with the repository root as its context, because each service
has a path dependency on `libs/domain`. There was **no `.dockerignore`**, so the
whole tree would have been sent to the Docker daemon or a remote builder on
every build.

Measured on this checkout, that is **678 MB** of material with no business in an
image: 258 MB of `node_modules`, 417 MB of service virtualenvs, and 3 MB of
`.git`. `.gitignore` does not apply to a build context — a file being untracked
says nothing about whether Docker ships it — so anything sitting in a gitignored
`/data` or uploads directory would have gone too. That makes it a compliance
issue, not a build-speed one.

The policy is **deny-by-default**: exclude everything, then re-include the
manifests, locks and `src/` trees the builds actually need, then re-exclude
virtualenvs, caches, tests, `.env` files and every client-data file type even
inside the allowed paths. A new service has to be added deliberately, which is
the point.

### Blocked — container verification

**Docker is not installed. WSL2 is not installed.** `docker --version` reports
not found; `wsl --list` reports the subsystem is not installed. Hyper-V is
present (`HypervisorPresent = True`), so no BIOS change is needed.

Not produced, and not claimed:

- [ ] Build all four images
- [ ] Core and Blind health/readiness inside containers
- [ ] Extraction and Render `check` inside containers
- [ ] Containers run as non-root
- [ ] Production commands carry no reload/debug flag
- [ ] Trivy image scan and SBOM generation

- [ ] Confirm `.dockerignore` actually excludes what it claims (`docker build`
      reports the context size it transferred)
- [ ] Resolve and pin base-image **digests**, and pin GitHub Actions by **SHA**

The Dockerfiles, compose file and `.dockerignore` are written and reviewed, and
the CI workflow contains real steps for every one of these checks — including a
runtime `uid` assertion and a `Config.Cmd` scan for `--reload`/`--debug` — but a
written step is not evidence that it passed.

On pinning: uv, Python, Semgrep, pip-audit and every Python dependency are
pinned to exact versions. GitHub Actions and the base images are pinned by
**tag**, which is mutable. Moving to SHA and digest pins needs a registry
resolution that has never been performed on this machine, and pinning to a
digest nobody has verified would be worse than an honest tag — so it is listed
here as blocked on the same Docker install, not quietly done.

**To unblock**, from an administrator PowerShell:

```powershell
wsl --install          # then reboot
# install Docker Desktop with the WSL2 backend, then:
docker --version
docker compose -f infra/compose/compose.yaml build
```

Enable BitLocker before any real client NPI is stored on this machine.

## 10. Gate 1 exit checklist

| Criterion | State | Evidence |
|---|---|---|
| `services/`, `libs/`, `infra/` layout created | **PASS** | §1 — every committed directory holds config, source, tests or documentation; no placeholder forest |
| Python 3.13 installed through `uv` | **PASS** | CPython 3.13.14, uv-managed; global 3.14.5 unused |
| Per-service `pyproject.toml` + exact locks | **PASS** | six projects, six committed `uv.lock` |
| Ruff, Pyright strict, pytest, pre-commit configured | **PASS** | §8; `.pre-commit-config.yaml` |
| CI skeleton including security scans and SBOM | **PASS (unrun)** | `.github/workflows/backend.yml` — real steps, valid YAML, equivalents run locally; not pushed, so remote CI is **PENDING REVIEW** |
| CI protects the enforcement surface | **PASS** | Path filters cover `scripts/**`, `.pre-commit-config.yaml`, `.dockerignore`, `.gitattributes`, `.env.example`; a `hygiene` job runs the full pre-commit suite and the client-data guard over every tracked file |
| Pre-commit runs clean from a fresh checkout | **PASS** | Twice consecutively; §8 |
| Build context is bounded | **PASS (unbuilt)** | `.dockerignore`, deny-by-default; excludes 678 MB measured. Cannot be *observed* until a build runs — §9 |
| Typed settings and startup safety checks | **PASS** | §6 |
| `/health` and `/ready` | **PASS** | §7 |
| Frozen install succeeds from a clean checkout | **PASS** | `uv sync --frozen --all-groups`, all six |
| All service shells build and run **in containers** | **BLOCKED** | §9 — Docker absent |
| CI green without application features | **PENDING REVIEW** | not pushed; local equivalents pass |

> [!warning] **Gate 1: LOCAL FOUNDATION COMPLETE — OFFICIAL GATE PARTIAL.**
> Source, tooling, lock, test and build criteria all pass; the foundation is
> ready to build Gate 2 on. The container criterion and remote CI are
> **deferred until before staging** and are not claimed. Neither blocks Gate 2,
> which needs the same Docker install for Testcontainers — so the install
> unblocks both at once.

## 10a. What the review changed

Six blocking findings and four secondary ones were raised against the first
submission. All were reproduced before being fixed; none was disputed.

| # | Finding | Resolution |
|---|---|---|
| 1 | Gate 0 marked COMPLETE against its own failing exits | Now **PARTIAL**, with two named closure paths and a recommendation. Durable hash-verified archive replaces the temp-directory copy. |
| 2 | **Redaction bypassed by traceback text and DSN keys — a real NPI/credential leak in all four services** | Redaction moved to `libs/domain` (one implementation), reordered to run last, exception text sanitised, credentials masked by shape. Reproduction re-run against the fix. |
| 3 | Reported pre-commit verification was false | Hooks rescoped (JSONC, line endings), script lint fixed. Verified passing twice from a clean tree. |
| 4 | CI path filters omitted the enforcement surface | Filters widened; `hygiene` job added running the full suite plus the guard over every tracked file. |
| 5 | Client-data guard had a `packages/` bypass | Extension rule now applies everywhere; the exemption is scoped to the directory rule alone. 20 tests, starting with the reported bypass. |
| 6 | No `.dockerignore`; 678 MB context including possible client data | Deny-by-default policy added. |
| P2 | Boundary test could not detect lazy imports despite claiming to | Replaced with an AST scan; the `sys.modules` check kept and rescoped to what it does cover. |
| P2 | Empty CORS allowlist refused, blocking same-origin deployment | `same_origin_deployment` opt-in; contradictory configuration refused. |
| P3 | AI attribution in the Gate 0 executor field | Removed. |
| P3 | Base images and actions tag-pinned, not digest-pinned | Semgrep pinned; the rest documented as blocked on the Docker install rather than silently left. §9. |

Two of these — the redaction leak and the guard bypass — were controls that
were being *cited as evidence* while not holding. Both now have tests that fail
if the defect returns.

## 11. Deliberately deferred

- **A shared `libs/platform` for the HTTP wiring.** The error envelope, request
  context and redaction chain are currently duplicated between `core-api` and
  `blind-svc`, and the redaction/logging pair again in each worker. That is a
  real drift risk and it is recorded as one. It is deferred because the gate
  instruction is to keep deployment-specific wiring local until a shared
  abstraction has proved stable, and because the blind service's isolation is
  the one place where sharing a package is least obviously safe. **Revisit when
  a third API service appears, or at Gate 4** when authentication wiring would
  otherwise be duplicated too — that is the point at which the abstraction has
  enough evidence.
- **OpenTelemetry, Prometheus, Sentry.** Seam only. The contract they must meet
  is in `infra/observability/README.md`.
- **PostgreSQL in compose.** Arrives at Gate 2 with the roles, forced RLS and
  tenant-context lifecycle. Standing one up now would invite a service to
  connect to it before any of that exists.
- **Gotenberg in compose.** Arrives at Gate 8, pinned by digest on an
  internal-only network.
- **`orjson`, msgspec, Granian.** Rejected or deferred pending
  production-shaped benchmarks.

## 12. What Gate 2 inherits

- A proven contextvar set/reset discipline in ASGI middleware — the same
  mechanism the tenant context needs, including the lesson that the outermost
  error handler runs after the reset.
- A readiness structure designed to be extended with real dependency checks.
- A lifespan that owns resources explicitly, ready to hold the engine and pool.
- An error taxonomy with `ConflictError` and `RefusalError` already mapped, for
  the state-machine refusals.
- `check_no_client_data.py` and `check_locks.py` in pre-commit.
- Six locks and a CI matrix that will not merge environments as services grow.

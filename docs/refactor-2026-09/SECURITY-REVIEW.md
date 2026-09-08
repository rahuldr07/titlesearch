# RB-9 — Security and sensitive-data validation (2026-09-08)

Tree: `integration/backend-2026-09` @ `e9a0ab6`. Countable checks passed: 30
migration files excluding `__init__`, four `libs/` entries including
`http-kit`. Review only — no application source was modified; every probe ran
against synthetic payloads written outside the working tree, judged by calling
`scripts/check_no_client_data.py::violation_for` directly, plus name-only
paths that never existed on disk. No probe commit was made.

**Nothing here is critical and actively exploitable.** Every finding below
either needs an operator to stage a file, or is a ceiling on a control that
already holds for the cases its author named. Read against the prior audits
(`hive/design/backend-2026-09/audit-{injection,authz,exposure}.md`) and
`BASELINE.md` §3: nothing from those is re-reported except where re-verified
and marked so.

## 1. The client-data guard — what it now does NOT do

The rebuilt `scripts/check_no_client_data.py` was probed adversarially,
per the brief. First, what it demonstrably stops now (all REFUSED by
execution): `pkg.pdf.bak`, `pkg.PdF`, an extensionless PDF by signature, an
extensionless Access database by signature, a `grantor,grantee`-headed
delimited extract with data rows, a dashed SSN in any text file, `.eml` by
extension, `.csv` by extension. The pre-commit hook passes staged paths and
CI runs `--tree` (`backend.yml:168`); the INSERT-threshold numbers are pinned
by `scripts/tests/test_check_no_client_data.py::test_the_insert_marker_*`
(three tests, present, lines 319–336). The documented ceilings in the module
docstring (column-inserts form, single multi-row INSERT, staged-vs-worktree,
gitignored paths) were confirmed and are not re-reported.

What still gets past it — each row is a reproduction, run 2026-09-08 via
`violation_for` on a synthetic file:

| # | Payload | Verdict | Why |
|---|---|---|---|
| G-1 | Prose OCR text of a deed — owner name, property address, loan number, **no SSN** — as `.txt` | **ACCEPTED** | The extract rule's only value-shape detectors are dump markers, a dashed SSN, and a tabular identity header. Prose is none of them. |
| G-1b | Engine-output JSON: `{"field": "owner_name", "value": "TIMOTHY R BUCHANAN", ...}` as `.json` | **ACCEPTED** | Same: not tabular, no SSN, valid text. |
| G-2 | `412559911` (undashed), `412 55 9911`, `412.55.9911`, `412–55–9911` (en-dash) in `.txt` | **ACCEPTED** (all four) | `SSN_SHAPED` matches exactly one spelling: `\d{3}-\d{2}-\d{4}` with ASCII hyphens. The dashed control is refused. |
| G-3 | `owner_name,address,parcel_number,county` header over data rows, as `.txt` | **ACCEPTED** | `IDENTITY_COLUMNS` has `borrower`/`grantor`/`property_address` but not `owner_name`, `address`, `name`, `parcel_number`, `owner`, `buyer`, `seller`. Two known columns are required; this header has zero. |
| G-4 | UTF-16LE (and UTF-16+BOM) borrower CSV **containing a dashed SSN**, named `.txt` | **ACCEPTED** | UTF-16 has null bytes → `_as_text` returns `None` → the whole extract rule is silent. Under 512 KB the binary backstop does not fire either. |
| G-5 | BMP bytes (`BM`) and PSD bytes (`8BPS`) with no extension | **ACCEPTED** | `.bmp`/`.psd` are on the extension list but have no `CONTENT_SIGNATURES` entry, so the rename that the signature rule exists to defeat works for exactly these formats. Base64-wrapped PDF bytes in a `.txt` also pass. |

Severity and why G-1/G-3 lead: **the natural output of this very pipeline is
the shape the guard cannot see.** An OCR run's page text, an engine's field
extraction, a golden-set export keyed `owner_name` — recorded title data in
most counties carries **no SSN at all** (recorders redact them), so the NPI
this system actually handles is names + addresses + loan numbers, which is
precisely the residue every rule waves through. G-3 is sharpened by the
repo's own vocabulary: `golden_fields` speaks `owner_name`, so the extract
this system itself would emit uses the exact header the rule does not know.
G-4 matters on this machine specifically: the packaged app runs against WSL2,
and PowerShell's default text encoding is UTF-16LE — a Windows-side export is
UTF-16 without anyone choosing it, and it carries even a dashed SSN through.

Trust boundary crossed: working tree → permanent git history (the CONTEXT §19
boundary). All five require an operator to put the file in the tree — no
network attacker — which is the same operator model as the 644 MB incident.

Suggested dispositions (report-only; not applied): G-2 is a regex widening;
G-4 is a BOM-sniff + `utf-16` decode attempt in `_as_text`; G-3 is vocabulary
(`owner_name`, `owner`, `address`, `parcel_number`, `legal_description`);
G-5 is two magic entries (`BM`, `8BPS`). G-1 has **no clean rule** — a name
detector is an NLP problem and a false-refusal machine; the honest move is to
add G-1's shape to the module's own "what this guard does NOT do" section so
the guard is never quoted as covering extracted prose, and to keep relying on
the storage convention (out-of-tree absolute paths) as the primary control
for OCR/engine output, which is what already keeps the real Lincoln County
runs out of this repo.

## 2. Package-generation tools (named by the owner)

`scripts/gate0/make_synthetic_package.py`: clean. Fully synthetic, invented
parties, deterministic bytes, no dependency, writes only to its explicit
`output` argument. Nothing in it reads real data.

`scripts/gate0/make_synthetic_reports.py`: sound design with two residuals,
both informational:

- It reads **real client order identifiers and delivered-report filenames**
  from the out-of-VCS prototype at run time (`seed.SOURCES`) and embeds them
  in the "synthetic" fixtures it writes (body line `ORDER #: {order_no}` and
  the filename itself). That is the right trade — hardcoding them here was
  caught in review and refused — but it means the *outputs* are not fully
  synthetic: they carry client-derived order numbers. If the caller-supplied
  `root` ever pointed inside the repo, the guard would refuse the files
  (verified: `.pdf`/`.docx` by extension, and they land under
  `<root>/uploads/`, which the directory rule refuses) — so the backstop
  holds; the residual is confined to the developer's filesystem.
- `sources_from_prototype` does `sys.path.insert(0, prototype)` + import —
  executing arbitrary code from the `--prototype` path. A dev-only tool run
  by the developer against their own archive; recorded so nobody later wires
  it to an untrusted path.

## 3. What changed since the audits, checked area by area

The scope areas were swept over the **delta** `9866da7..e9a0ab6` (the prior
audits at `ceccc9b` and BASELINE §3 cover the rest; duplicates skipped).

**Authorization.** Route inventory unchanged: every mounted route is still a
GET (`/health`, `/ready`, `/rules`, `/rules/{code}`, `/queue/next`, twice
over for blind-svc's two). The audit-authz headline — the authz table has no
server to run on — stands unchanged; not re-reported. `MOCK_AUTH_HEADERS`
still contains only `x-mock-role` (`mock_auth_guard.py:63`), so the
`x-mock-actor` note from audit-authz also stands — still moot, since no
core-api handler reads that header.

**Migration 0121 (the one new DB surface).** Golden-signer seat predicate:
reviewed and validated. The ordering (resolver before predicate, so an
ambiguous subject keeps `0102`'s refusal), the DROP-and-CREATE discipline,
`REVOKE EXECUTE FROM PUBLIC` on the fresh function, `ENABLE ALWAYS` with a
read-back, distinct SQLSTATEs (`28000` identity vs `42501` authority), and a
downgrade body pinned character-for-character against `0102` are all
correct. Executed: `pytest tests/test_golden_set.py
tests/test_trigger_function_bodies.py` — all green (67 tests, real Postgres
via testcontainers). The interpolations in `signer_body()` are f-strings over
module constants only — no caller value reaches them. Two knowns, not new:
the `titlepipe_owner` ceiling (documented in the file itself), and the seat
check being write-time only (a later role change does not re-verify old
signatures — inherent to the design).

**Settings / V-15 regression check.** The FX-25/FX-39 consolidation moved
`CoreApiSettings` into the sealed `BaseHttpServiceSettings` hierarchy — the
exact kind of move that could have dropped the V-15 fix. Executed with a
password-bearing DSN and a bad seal password in the environment,
`TITLEPIPE_ENVIRONMENT=production`:

    SettingsValidationError
    CoreApiSettings is misconfigured (1 problem); values are omitted
    deliberately: <cross-field rule>: Value error, unsafe configuration ...

No DSN, no password, no `input_value` dict. The seal is now structural:
`BaseServiceSettings.__pydantic_init_subclass__` refuses any subclass whose
merged `model_config` does not hold `hide_input_in_errors=True` (checked at
the post-merge hook, where the effective config is visible), and
`redacted_settings_error` guards the inherited `from_environment`. Control
holds after the move.

**Sensitive logging.** The delta adds zero new log call sites; the only
f-string log call tree-wide is still the safe
`db/reads.py:157` event-name composition (V-7's live-caller check,
re-verified). The V-1..V-6 redaction value-shape holes remain exactly as
BASELINE §3 groups them — latent, not live, not re-reported.

**HTML generation.** None exists to review: zero `dangerouslySetInnerHTML` /
`innerHTML` / `insertAdjacentHTML` / `srcdoc` in `apps/web/src` and
`packages/`, zero `HTMLResponse`/`text/html` in any service or lib. The
browser boundary is React's default escaping plus JSON responses throughout.

**File paths / development servers.** The one custom file-serving surface is
`apps/web/vite.config.ts::scanRasters` — a dev middleware serving **real
county-package rasters** from `TITLEPIPE_SCAN_DIR`. Attacked on paper and
against Vite's shipped source, and it holds:

- Traversal: `basename()` strips directories, then the name must match
  `^page_\d{4}\.png$` exactly or be the literal `package.pdf`. No caller
  path segment reaches the filesystem.
- Network reach: `server: { port: 5174 }` with no `host`, so the bind is
  loopback. DNS rebinding is the real threat to a dev server, and the
  ordering was verified in the installed Vite (8.2.2,
  `dist/node/chunks/node.js` middleware assembly): `hostValidationMiddleware`
  is registered **before** the `configureServer` hooks run, so `/scan` sits
  behind the default `allowedHosts` check; the default CORS middleware is
  likewise ahead of it and allows localhost origins only.
- `apply: "serve"` keeps it out of every build.

Residual, stated not fixed: on WSL2, Windows-side processes reach WSL
loopback via localhost forwarding, so "loopback-only" means "this user's
machine", which is the intended trust domain for a tool that exists to view
a package the same user already has on disk.

**Uploads.** No upload path exists on this tree to review — no route, no
handler, no `UploadFile` anywhere in `services/`. `packages.py`'s model and
the storage convention are the only artifacts. Recorded as unreviewable, not
as safe: the CONTEXT §19 incident lived exactly here, and the ingest door
will need its own review the day it lands.

**Blind-service separation.** blind-svc's delta since the exposure audit is
the sealed-settings adoption (10 files), reconciled in BASELINE §3; its route
surface is still `/health` + `/ready`. V-13 (isolation validator holds) and
V-14 (settings control ≠ process-environment control) stand as filed; nothing
new to add and nothing re-attacked.

**Tenant isolation.** No new tenancy surface in the delta. 0121's seat
lookup is tenant-scoped (`u.tenant_id = NEW.tenant_id`). The FORCE RLS
design and the GUC lattice were proven at the injection audit (T2) and are
unchanged; the two known context facts (deliberate FORCE RLS; the
`titlepipe_owner` ceiling) are not re-reported.

**Dependency exposure.** The delta changes **no** lockfile and no manifest
except root `package.json` scripts. The queue's runtime surface remains as
audit-exposure §4 measured it (procrastinate + psycopg; testcontainers/docker
correctly dev-only). Nothing new entered.

## 4. Coverage limitations — what this review did NOT reach

- **No live DB bench of my own.** 0121's runtime behavior was validated by
  executing the repo's testcontainers suite, not by hand-driven SQL as the
  prior auditors did. The shared Postgres on 5432 was deliberately left
  untouched (shared machine state; report-only task). A hand-driven probe of
  e.g. the ambiguous-subject path under 0121 specifically was not run.
- **No end-to-end guard commit test.** V-11's full-chain reproduction
  (stage → hook → CI command) was not repeated; probes called
  `violation_for` directly. The wiring (hook entry, CI `--tree`) was read,
  not driven. Six workers are live in source and a probe commit on a
  report-only branch was judged not worth the collision risk.
- **The mock-auth hardening** (48 frontend files, landed between the audits
  and the baseline) was accepted on BASELINE §3's reconciliation and not
  re-attacked here.
- **The Vite host/CORS claims** were verified by reading the installed
  8.2.2 dist source (middleware registration order), not by driving a
  running dev server — the owner's own dev server on 5174 is off-limits.
- **The live migration harness and gate0 runner** were not run (the former
  needs a dedicated DB; the latter needs the out-of-VCS archive and
  `pdftotext`).
- **Transitive JS dependency tree** not audited; dependency review was
  scoped to the manifest/lock delta (which was empty).
- **Real-data handling on the developer machine** (the out-of-VCS OCR runs,
  the prototype archive, `TITLEPIPE_SCAN_DIR` contents) is outside what a
  repo review can see; every statement above about it is about the repo's
  controls, not about the state of that filesystem.

## 5. Summary table

| # | Finding | Result | Severity | Boundary |
|---|---|---|---|---|
| G-1/G-1b | Guard: prose/JSON extract with names+addresses, no SSN, passes | EXPLOITED (probe) | **medium-high** — the pipeline's own natural output shape | tree → git history |
| G-4 | Guard: UTF-16 text invisible to extract rule, SSN included | EXPLOITED (probe) | medium — Windows tooling writes UTF-16 by default | tree → git history |
| G-3 | Guard: identity-column vocabulary misses `owner_name`/`address`/`parcel` | EXPLOITED (probe) | medium | tree → git history |
| G-2 | Guard: SSN regex matches one spelling of four+ | EXPLOITED (probe) | low-medium | tree → git history |
| G-5 | Guard: BMP/PSD lack magic entries; base64 wrapping | EXPLOITED (probe) | low — needs deliberate evasion | tree → git history |
| R-1 | gate0 report fixtures carry real order numbers; guard backstop verified | residual, informational | low | dev filesystem only |
| S-1 | V-15 redaction survives the settings consolidation | **BLOCKED** — control holds, executed | — | boot → stderr |
| S-2 | Migration 0121 seat predicate | **SOUND** — reviewed + suite executed | — | DB write path |
| D-1 | scanRasters dev middleware (traversal, rebinding, CORS) | **BLOCKED** — control holds | — | dev server |
| — | HTML generation | none exists; nothing to escape | — | — |
| — | Uploads | no surface exists; review owed when it lands | — | — |
| — | Dependency delta since baseline | empty | — | — |

The one sentence: the rebuilt guard genuinely closed everything the last
audit exploited, and its remaining ceiling is exactly the one it cannot close
by listing harder — **client data that has stopped looking like a container
and started looking like prose** — which is why the out-of-tree storage
convention, not the guard, has to stay the primary control for OCR and
engine output.

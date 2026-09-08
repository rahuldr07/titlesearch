# TitlePipe engineering conventions — the shared contract

Binding on every change. Written as the shared contract of the 2026-09 backend
build and adopted into the tree 2026-09-08 so that it can actually be read;
substance unchanged. Where this file and `docs/backend/BUILD-PLAN.md` disagree,
raise it to the maintainer rather than choosing.

## 0. Attribution — absolute
Commits read as ordinary engineering work. No tool-generated attribution
trailers or banners anywhere: not in commit messages, not in code comments, not
in docstrings, not in docs — no `Co-Authored-By` tooling trailers, no
"Generated with" lines. Every merge is audited for this.

## 1. Tenancy — structural, never disciplinary
- Every tenant-scoped table carries a REAL `tenant_id uuid NOT NULL` column. No policy ever JOINs to
  discover a tenant.
- Primary key is composite `(tenant_id, id)`. This closes a cross-tenant existence oracle that RLS
  alone cannot, because unique-constraint enforcement runs before `WITH CHECK`.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` on every one, with a
  policy, in the same migration that creates the table. A table without all three is a defect.
- No foreign key exists except in the composite `(tenant_id, ...)` form. A single-column FK to a
  tenant-scoped table is a defect.
- Global tables (today: `rules`) have NO `tenant_id`. Their repositories are SIBLINGS of the
  tenant-scoped ones, never subclasses.

## 2. Identity
- Ids are server-generated 128-bit UUIDs, `uuid` column type, generated in the application, never by a
  client and never a database sequence.
- No natural key (order number, page index) may become a primary key or a standalone unique key without
  the `tenant_id` prefix — the composite convention must hold before any natural key is added, not be
  retrofitted after.

## 3. Naming
- Tables: `snake_case`, plural (`orders`, `field_readings`). Join tables name both sides.
- Columns: `snake_case`, no abbreviations that aren't domain terms. Booleans read as assertions
  (`is_delivered`, not `delivered_flag`).
- Timestamps: `timestamptz` always, never `timestamp`. `created_at`, `updated_at`; a domain event gets
  its own verb-past name (`signed_off_at`, `delivered_at`).
- Postgres enum types: `<domain>_<concept>` (`order_status`, `na_reason`).
- Constraints and indexes carry the object in the name: `pk_<table>`, `uq_<table>__<cols>`,
  `fk_<table>__<target>`, `ck_<table>__<rule>`, `ix_<table>__<cols>`.
- Python modules and packages: `snake_case`; classes `PascalCase`; no module named after a layer
  keyword it does not belong to.

## 4. Enums and absence
- An unknown enum value is a WRITE-time error, never a read-time surprise. Do not add a catch-all
  member.
- `na_reason` has exactly four labels and `pending` is deliberately ABSENT — pending is a pipeline
  state, not a reason for absence.
- A column that cannot be honestly populated is NULL and stays NULL. Never fabricate a value to satisfy
  a NOT NULL — `field_readings.line_coords` is the precedent: an engine without coordinate support
  declares null rather than inventing a citation.

## 5. Audit
- The audit log is append-only, written by `ENABLE ALWAYS` triggers, never by application code. An
  application-enforced audit is a defect.
- The audit write happens in the same transaction as the change it records.

## 6. Layer discipline (carried forward from `core-api`)
- The repository layer REFUSES an unscoped DB session — structurally, not by convention.
- Every response parses at the boundary through a schema.
- `HTTPException` and HTTP-error mapping exist in the API layer ONLY.
- Raw SQL is confined to the DB layer.
- No `Any`. No savepoints.
- Resources (engine, sessionmaker) open at application startup via a lifespan hook, NEVER at import
  time.
- Shared scaffolding (settings, structured logging with NPI/credential redaction, health/readiness
  routers, lifespan) lives in the shared library package, not duplicated per service.

## 7. The per-endpoint idiom — the only one
`GET /api/rules` is the sole place in the repo where wire contract, Pydantic model, Zod schema and a
real table already agree. Every endpoint lands in that shape, and this generalises by ruling:
  router + repository + schema + contract-parity test + error contract.
**"Does a parity test exist" is the per-endpoint definition of done.**

## 8. Migrations — chain hygiene during parallel work
- One migration file per logical change, named `<rev>_<verb>_<object>.py`.
- Several branches write migrations at once, so **do NOT guess `down_revision`**. Set it to the
  current head as you found it and state your assumed parent in the file's docstring. The integrator
  linearizes the chain at merge. Do not rebase another author's migration.
- Every migration has a real `downgrade()`. `pass` is a defect.
- A migration that creates a tenant-scoped table without RLS+FORCE+policy in the SAME migration is a
  defect (see §1).

## 9. Failure posture
This codebase's characteristic failure is FALSE ASSURANCE. Every safety property you implement must
NAME THE MACHINE that enforces it (a constraint, a trigger, a policy, a test, a gate), and a missed
path must fail LOUD rather than succeed silently. If you cannot name the machine, say so in your pull
request as an unproven residual instead of writing a comment that asserts the property.

## 10. Layering — handlers, services, mappers, repositories
Owner ruling, 2026-09-05. Binding on every endpoint from here on, including the ~68 not yet built.

```
api/routers/      HANDLERS   HTTP only. Parse, authorise, map errors to status codes.
api/schemas/      DTOs       Request and response shapes. The wire.
api/mappers/      MAPPERS    model -> DTO. The ONLY place both are imported.
services/         SERVICES   Use cases. One transaction each. Owns the business rules.
db/repositories/  REPOS      SQL only. Returns models, never DTOs.
db/models/        MODELS     Tables.
```

**The dependency rule points ONE way.** `routers -> services -> repositories -> models`, with
`mappers` used by routers to render what services return. Nothing points back up. A repository that
imports a schema, or a service that raises `HTTPException`, is a defect.

**Why mappers exist here, when most codebases skip them.** In this system the model-to-DTO step is
where the application can silently LIE, so it gets a name and one home:
- a citation is whole or it is not one (`_citation_is_whole`: a `source_doc_id` without a
  `source_page` cannot be CONSTRUCTED, tests included);
- `NOT_PRESENT` and `PRESENT_UNREADABLE` are never collapsed;
- `state` is READ from the server, never derived from `value is None`.
Those are decisions, not field copies. One chokepoint means they happen once.

**The rules this makes machine-enforceable** — add them to `scripts/check_backend_rules.py`, which
already enforces things no linter expresses:
1. `api/routers/**` may NOT import from `db/models` or `db/repositories`. Only mappers import models;
   only services call repositories.
2. `services/**` may NOT import `fastapi` or raise `HTTPException`. It raises `DomainError`.
3. `db/repositories/**` may NOT import from `api/`.
4. A router function may not construct a response DTO directly from a model — it calls a mapper.
**Do NOT add these gates before the code satisfies them.** The gate runs in pre-commit, so a gate that
fails blocks every subsequent commit, including the ones fixing it. Refactor first, gate last.

**Business rules live in `services/`.** No separate `domain/` package yet — with four layers this is
simpler and sufficient. When a service passes ~300 lines because it both orchestrates AND holds
predicates, pull the pure predicates into `services/rules/`. Do not pre-build that.

**What is deliberately NOT adopted:** no abstract repository interfaces, no DI container, no CQRS.
This codebase's failure mode is FALSE ASSURANCE, and every extra layer of indirection is one more place
a safety property can appear enforced without being enforced.

**Naming:** the handler folder stays `api/routers/` — FastAPI's own word, and what the tree already
uses. Same layer, whatever it is called.


## 10a. CORRECTION to §10, 2026-09-05 — the mapper justification was FALSE ASSURANCE

Adversarial review attacked §10's own reasoning and broke it. §10 justifies `api/mappers/` with three
properties. **None of them is implemented in a mapper.** Recorded here rather than quietly edited
above, because a convention document that silently rewrites its own history is the same disease it is
trying to prevent.

- **The whole-citation guard is real but is NOT in a mapper.** `_citation_is_whole` is a Pydantic
  validator in `api/schemas/provenance.py`. That is a STRONGER placement than a mapper, not a weaker
  one — a DTO that cannot be CONSTRUCTED half-cited beats a mapper that declines to build one. The
  property stands; §10's attribution of it was wrong.
- **`CitedValue` has ZERO importers.** It is a dead module, and its docstring cites
  `tests/test_provenance_envelope.py` as its proof. **That file does not exist anywhere in the repo.**
  A safety property whose named proof is a file that was never written is precisely the failure mode
  this whole plan is organised against, and it got into the conventions under my own hand.
- **`NOT_PRESENT` vs `PRESENT_UNREADABLE` is real** — a live CHECK on `fields`, verified against the
  catalog. Not a mapper either.
- **"`state` is never derived from `value is None`" has NO backend machine at all.** It is a rule in
  `CLAUDE.md` and nothing enforces it server-side.

**The ruling stands; the reasoning is corrected.** Mappers remain the right home for model -> DTO, and
routers still may not import models. But the justification is now: *the wire shape is enforced by
schema validators at construction; mappers exist so that the model-to-DTO step has ONE place, not so
that they are where the enforcement lives.*

**A FIFTH GATE RULE IS OWED.** §10 ruled four. The review executed a service that imports and
constructs a wire DTO and `check_backend_rules.py` passed it clean — `services/` -> `api/` is UNGATED.
There is no violation in the tree today. Add: **`services/**` may not import from `api/`.**
*(Since landed: `check_backend_rules.py` carries the `layer-service-api` arrow — closure verified in
`docs/refactor-2026-09/BASELINE.md` §3, 2026-09-08.)*

## 11. Comment density, reuse, and structure — owner ruling 2026-09-08
Binding. This section exists because the density was MEASURED, not felt: review found the four-layer
API at two endpoints came to 1,298 lines of which 212 were code — 84% prose.

### 11.1 Comments: delete what restates, keep what cannot be re-derived
**DELETE** a comment that says what the next line already says; that narrates structure ("now we
validate"); that explains a language feature; that repeats the function name; that documents a
parameter whose type and name already say it; or that is a banner, a divider, or an emoji marker.

**KEEP** — and these are the ONLY categories that earn their lines:
1. **A MEASUREMENT.** "MEASURED 2026-08-05 against postgres:18.4: `UPDATE orders` -> UPDATE 0, no
   error." Nobody can re-derive that by reading; it cost someone a day.
2. **A RESIDUAL OR CEILING.** What this does NOT protect against, and what would close it. Every
   instance of a claim without this qualifier has turned into a finding.
3. **A DECISION WITH A REJECTED ALTERNATIVE.** "AFTER and not BEFORE: a BEFORE version answered ahead
   of every CHECK and turned eleven unrelated 23514 refusals into 28000."
4. **A NON-OBVIOUS ORDERING OR NAMING DEPENDENCY.** "This trigger name sorts before
   `audit_log_chain_link`; same-timing row triggers fire alphabetically."
5. **A POINTER TO THE MACHINE** that enforces a property, when it is not in the same file.

If a comment is longer than the code it guards, it is probably a design note: move it to the migration
docstring or the pull request, and leave a one-line pointer.

### 11.2 Reuse: the rule that would have prevented today's defect family
**One fact, one home, read by every consumer.** The whole 34-finding review came down to several lists
that had to agree and silently stopped agreeing — `UNSCOPED_TABLES` vs `ISOLATION_GLOBAL_TABLES` vs
`EXPECTED_GLOBAL_TABLES`; `SAFE_KEY_EXCEPTIONS` vs `SAFE_DIAGNOSTIC_KEYS`; the queue tables in four
places. When you find the same set of names in two places, the fix is not to update both — it is to
delete one and import the other. Adding a fifth copy while fixing the fourth is the failure.

### 11.3 Structure
Layering is §10 and does not change. Beyond it: a module is named for what it holds, not the layer it
sits in; a file over the 400-line cap gets SPLIT BY DOMAIN, never by "part 1 / part 2"; a package's
`__init__` re-exports its public surface and nothing else; and dead code is deleted, not commented out
— `CitedValue` sat unimported with a docstring citing a test file that was never written.

### 11.4 What NOT to do in the name of tidiness
Do not delete a docstring recording a measurement to hit a line cap. Do not collapse two constants that
merely happen to be equal today. Do not rename for taste alone across a boundary another author owns.
Do not "simplify" a refusal into a subset check. Tidiness never buys a weakened assertion.

# Prioritised checklist — the real work, ordered by risk (2026-09-08)

Ordering rule: what can silently corrupt truth or block every later batch
outranks what is merely red, and what is red outranks what is merely untidy.
Each item cites the evidence in [BASELINE.md](BASELINE.md) (§) or
[DEPENDENCY-MAP.md](DEPENDENCY-MAP.md) (edge ids).

1. **Triage the 56 red e2e tests before any refactor batch touches
   `apps/web`** (§1.2). The suite is the executable form of the product
   refusals; while it is red, no frontend move can prove it changed nothing.
   Triage, not blanket-fix: per the repo's own rule, each failure needs a
   rulebook/provenance check first — some failures may be correct behavior
   pinning a real app defect. 14 spec files, multiple root causes; treat as a
   dedicated batch with its own red/green ledger. Note the job was already red
   on `main`'s last CI run, so bisecting integration-branch frontend changes
   (48 files) against main will separate inherited red from introduced red.

2. **Put a machine on the contract↔DDL enum coupling before anything moves in
   `packages/contract` or `migrations/`** (X1). Enum values are hand-copied
   from `enums.ts` into committed Postgres enum types, pinned only by
   line-number comments; refactors renumber lines and desynchronise silently.
   A direct enum-diff parity test (both lists, one assertion) is small and
   must be shown red first against a deliberate mismatch.

3. **The authenticated-request root cause** (FX-29 cluster, §3). One cause
   behind five standing findings: `require_seat` has zero callers and no
   mutating route exists. Every read that ports from MSW to core-api inherits
   the same-tenant IDOR until a seat-scoping dependency is on the path. This
   is the gate for all endpoint-porting batches — land the dependency and its
   refusal tests with the *first* ported read, not after.

4. **CI is not running anywhere that matters** (§1.4). Zero runs on the
   integration branch (never pushed); `main`'s last push failed all three
   workflows. Whatever the integration strategy, the refactor programme is
   currently ungated by CI in fact, however green the tree is locally. Owner/
   god decision: push the integration branch (or a mirror) so the matrix runs,
   or accept local-runner ledgers like this one as the only gate and say so.

5. **The redaction value-shape family — one file, six findings** (V-1..V-6,
   §3.2; `libs/domain/redaction.py`). Exposure-class defects that fail open
   (list-wrapped values, uppercase DSN schemes, bare bearer tokens, `File "`
   prefix smuggling). Self-contained batch: every fix has an executable red.

6. **FX-39 — finish the core-api settings seal, correct the telemetry-shim
   ledger** (§3.1). Already `doing` (worker-97): coordinate, don't duplicate.
   The baseline adds one fact for that worker: the shim's importer comment
   undercounts — six src importers, only one under `api/`.

7. **FX-40 — `audit_dependencies.py` refuses unknown projects** (§3.1,
   reproduced by execution). Small, has an obvious red demonstration, and the
   same defect class (silent no-op exit 0) was already fixed once in
   `check_no_client_data.py` (V-12) — copy that pattern.

8. **FX-34 needs a ruling, not code** (§3.1). "Which seats may establish
   ground truth" is a product decision the owner must sign; 0102 deliberately
   left it open. Escalate; do not build past OPEN.

9. **Prettier: decide, then do it in one quiet commit** (§1.1). 185 files
   drifted because `--check` is enforced nowhere. Either add it to CI/pre-
   commit and land one format-everything commit *between* refactor batches
   (it will conflict with everything open), or delete the pretense. A
   format-all commit mid-programme is the worst of both.

10. **Stale-prose sweep — cheap, and it keeps lying to every reader**:
    `playwright.config.ts:9` + `frontend.yml:106-115` (claim e2e is all
    skipped; it is 0% skipped), `apps/web/src/shared/api.ts:65` (names a test
    file that does not exist), `.gitignore:58-60` (names dead tooling),
    `worker`/`blind-svc` pyproject descriptions (read as feature lists for
    unbuilt features), `core-api/telemetry/logging.py:5-7` (wrong importer
    census — item 6), and the X3 quartet (files hardcoding "core-api doesn't
    have this yet" — grep them at every endpoint landing).

11. **Cutover tripwires to carry on every endpoint-porting batch**: J1 (mock
    is the default build — the edge to cut), J4/X4 (frontend unit test parses
    core-api Python — renames break it), X3 (absence assumptions), X5 (live
    mode only exercised by the migration harness), and the queue fixture that
    nothing on the TS side reads (§2, contract-fixtures row).

12. **Golden-set residuals** (§3.3): engine-promotion provenance (golden-3),
    ACL-less actor GUCs (T3/golden-6), prefix-only engine ids (golden-7),
    unreconciled `revision` (golden-9). Real, documented, and mostly blocked
    on either the FX-34 ruling or the first golden write path — schedule with
    that work, not before it.

13. **Packaging hygiene, lowest risk** (P2/P4, J2/J3): test-support's
    over-declared runtime dep, bare-name gate imports, deep imports past
    export maps (three gates break silently if `tokens.css` moves — do this
    *before* any batch that moves `packages/ui-tokens`).

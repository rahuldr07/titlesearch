# CONTEXT999 — the one file to read first

**Written 2026-09-08. Single source of truth for picking this project up on another machine.**
If this file and any other document disagree, this file is newer — but check `git log` before
trusting either. Nothing here is inferred; every number was produced by running the command.

---

## 1. Where everything is

| Thing | Where |
|---|---|
| Repository | `github.com/rahuldr07/titlesearch` |
| Branch all work happened on | `integration/backend-2026-09` |
| Draft PR (first CI runs live here) | #13 |
| Integration tip at time of writing | `542862b merge agent/worker-116-security` |
| `main` now | **`bc7c6de`** — landed 2026-09-08, 242 commits, fast-forward |
| `main` before that | `ddaae50` — untouched for the whole programme, deliberately |
| Rescued work in progress | branch `wip/naming-cleanup-2026-09-08` — see §10 |

To resume on a new machine:

```bash
git clone https://github.com/rahuldr07/titlesearch.git && cd titlesearch
pnpm install --frozen-lockfile
pnpm verify          # everything; see docs/refactor-2026-09/COMMANDS.md for the smaller gates
```

Prerequisites: Node 22, pnpm, `uv`, Docker (testcontainers uses `postgres:18.4`), and the
Playwright chromium browser (`pnpm --filter @titlepipe/web exec playwright install chromium`).

---

## 2. State, measured — not claimed

**Green, verified on `542862b` immediately before landing:**

| Check | Result |
|---|---|
| pyright strict | **0 errors** across all **seven** Python projects |
| Python tests | 7 projects + `scripts/tests`, every one exit 0 (~1,207 tests) |
| vitest | **452 passed**, exit 0 |
| tsc (all workspace projects) | clean |
| `check:imports` (new module graph) | **clean, 365 modules** — was 23 violations |
| `check:rules` | **clean** — was 9, then 1 |
| prettier | clean (first time ever enforced) |
| pre-commit | **17/17 hooks** |
| migrations | **30 revisions, single head `0121`**, down-to-base/up-to-head round trip proven |
| CI `hygiene` job | passes |
| CI project matrix | all 7 pass |

**Known red, deliberately not hidden:**

| Issue | Detail |
|---|---|
| **e2e: 56 failed / 104 passed of 160** | Triage in flight (`RB-15`). Critically, **e2e was already red on `main`'s last CI run (2026-09-03)** — an unknown share is inherited, not introduced |
| Live harness (`e2e-live`) | `seedRulebook.mjs:41` imports `data.ts` by path; node strips types but does **not** remap `.js`→`.ts`, so `data.ts:387`'s `./realPackage.js` fails. Never worked. Owned by `RB-15` |
| Semgrep: 3 blocking findings | `avoid-sqlalchemy-text` in `migrations/env.py`. Awaiting a per-site verdict — see §5 |
| Storybook flake | `RB-17`. Two `.stories.tsx` files intermittently fail dynamic import under parallel load; pass in isolation and on re-run |

---

## 3. The one idea that explains this codebase

**FALSE ASSURANCE is this repository's characteristic failure mode**, and every practice below
exists because of a specific instance of it.

Nine adversarial reviews produced **34 findings on a tree whose suite was green (412 passing)**.
Among them: **four tests that could not fail** and **two named proof files that had never been
written**, cited five times between them.

So the standing rule, which produced every good result in this programme:

> **Every gate or test must demonstrate its own RED before you trust its GREEN.**

And its generalisation, which a worker taught me after auditing my own work:

> A threshold pinned only by its refusing case is a rule with no ceiling. Pin **both** sides.

Recent proof that the rule pays: `pre-commit --all-files` had **never run** and failed on seven
files; `pyright` had been **red on core-api the whole time**; `trivy-action@0.28.0` **did not
exist**; the container build could not see a library that had been added that morning. Every one
was invisible until something actually executed.

**A missing gate and an unrun gate look identical from the inside.** This repo had the second kind.

---

## 4. Rulings — settled, do not relitigate

| # | Ruling | Where it lives |
|---|---|---|
| **No AI attribution, anywhere** | No `authorship trailer`, no generated-with lines, no the assistant/AI/model references in commits, comments, docstrings or docs. Audited every merge; tree is clean | Absolute standing rule |
| **Blind is DEFERRED** | Not cancelled. Isolation invariants already in the schema STAY enforced — deferring a feature is not relaxing a landed invariant | `board.md`, 2026-09-05 |
| **Double-click override is deliberate** | An `auto_confirmed` misread has no other correction route. Covers **reachability only** | `docs/adr/0002-double-click-override.md` |
| **Ground truth: senior, engineer, admin** | Not reviewer, ops or typist. One predicate, exactly where the engineer predicted | migration `0121` |
| **`libs/http-kit` exists** | 258 byte-identical lines in two API services had already caused a real defect. `service-kit`'s no-web-framework boundary stands and was NOT relaxed | `libs/http-kit` |
| **Error envelope shape does NOT unify** | core-api answers flat (a *measured* browser contract), blind-svc nested. Unifying them breaks a contract | `libs/http-kit/error_contract` |
| **`extraction-svc` / `render-svc` are not created** | They existed as refuse-to-run shells and were **retired into `services/worker`** at `61a1945`. Four deployables became three | `docs/refactor-2026-09/ARCHITECTURE.md` |

---

## 5. Open questions and traps for whoever picks this up

1. **Semgrep's 3 findings in `migrations/env.py`.** The repo has already made the counter-argument
   in writing for ruff's S608: *"There is no request-scoped or caller-supplied value anywhere in a
   migration; it fires on the shape of the string, not on a reachable injection path."* That is
   probably right — which is exactly why it needs a **per-site trace showing where each interpolated
   value is assigned**, not a confident restatement. A well-written exemption that is wrong is this
   project's signature bug.
2. **Enum values are hand-transcribed** from `packages/contract` TypeScript into Postgres DDL, and
   **only a line-number comment holds them equal.** Highest-risk coupling in the repository. A parity
   test was commissioned; verify it exists and was demonstrated red.
3. **`VITE_API_MODE` defaults to mock**, so the *default* production build is the mock build.
4. **core-api serves 3 product endpoints against 70 MSW handlers.** The mock layer is far ahead of
   the real one, so a handler is often the only written statement of an endpoint's contract.
5. **`blind-svc` and `worker` are shells** (705 and 1,118 lines) carrying feature-list descriptions
   in their `pyproject` metadata.
6. **The repo used to lie about itself**: `playwright.config.ts` claimed every invariants spec was
   `test.skip`. Measured: **zero skips, 116 active tests**. Assume other self-descriptions may be
   stale; measure before believing.
7. **Branch protection is NOT configured.** Committing a workflow file makes *no* check required.
   That is a manual GitHub setting and must be done by hand — see `docs/refactor-2026-09/CI.md` for
   the exact check names.

---

## 6. Deliberate duplication — do NOT "clean up"

These look like copy-paste and are load-bearing. Each has its reason written at the site.

- `test_forced_rls_and_grants` keeps a **literal** queue-table set so a fifth table arriving with the
  marker passes the derivation and **still fails the literal**.
- `0060::QUEUE_TABLES` is a frozen migration snapshot.
- Rulebook enum `Literal`s in `api/schemas/rules.py` are held to `db/models` by
  `test_rules_contract_parity`.
- `imported_roots` is duplicated in two test suites because extracting it to `test-support` would
  create a dependency cycle. Each copy names the other and records the obstacle.

---

## 7. Task ledger

**101 done · 3 in flight · 10 open · 0 blocked on the owner.**

Full structured ledger with every result field: `docs/hive/tasks.json`.
Narrative history and every ruling: `docs/hive/board.md`.

### DOING (6)

| id | pri | owner | what |
|---|---|---|---|
| `RB-15` | P0 | worker-111-susruta-ii | E2E triage - 56 of 160 failing, and it was red on main first |
| `RB-16` | P0 | worker-112-kautilya | rules-allow suppressions are line-coupled, so any formatter deletes them |
| `TP-22` | P1 | worker-105-sushruta | Double-click opens a write surface on a field a single click cannot even select (auto_confirmed) |
| `RB-5` | P1 | worker-113-panini-ii | Split the largest modules by responsibility |
| `RB-5b` | P1 | worker-114-charaka-ii | Split the largest modules - TypeScript half |
| `RB-4` | P2 | worker-110-aryabhata-ii | Naming and public interfaces |

### TODO (11)

| id | pri | owner | what |
|---|---|---|---|
| `RB-9` | P0 | — | Security and sensitive-data validation |
| `RB-14` | P0 | — | Integrated verification, then land on main |
| `FX-29` | P1 | — | Nothing scopes by SEAT - same-tenant IDOR opens the moment reads port to core-api |
| `FX-35` | P1 | — | 0090 constrains rows, not projections - a mapper can still emit half a citation |
| `RB-7` | P1 | — | Frontend correctness and maintainability review |
| `RB-8` | P1 | — | Backend correctness and contract compatibility |
| `RB-12` | P1 | — | Test suite hardening |
| `TP-14` | P2 | aryabhata | Six-engine bake-off harness + first Leaderboard CSV |
| `FX-37` | P2 | — | MAX_PAGE_SIZE is a cited premise in migration 0112 that nothing enforces - no endpoint pages |
| `RB-6` | P2 | — | Comment cleanup on the frontend, and exemption hygiene |
| `RB-13` | P2 | — | Review process and documentation |

---

## 8. Where the reasoning lives

| Document | What it holds |
|---|---|
| `docs/CONVENTIONS.md` | **The binding engineering contract.** §10 layering (handlers → services → repositories, mappers, schemas), §11 comment discipline and one-fact-one-home |
| `docs/refactor-2026-09/BASELINE.md` | Every command, exit code, count, failure, warning, skip and blocker — measured, with failures reconciled against the standing review findings |
| `docs/refactor-2026-09/ARCHITECTURE.md` | Where new code belongs |
| `docs/refactor-2026-09/DEPENDENCY-MAP.md` | What depends on what; boundary risks |
| `docs/refactor-2026-09/CI.md` | What runs; required-on-paper vs required-in-GitHub |
| `docs/refactor-2026-09/COMMANDS.md` | The command table |
| `docs/refactor-2026-09/SECURITY-REVIEW.md` | Findings with reproductions **and stated coverage limits** |
| `docs/refactor-2026-09/REVIEW-LEDGER.md` | Findings, severity, resolution, verified closure |
| `docs/adr/` | Decisions with their rejected alternatives |
| `docs/hive/` | The full working record: ledger, narrative board, and the orchestrator's own log of what went wrong |
| `docs/CONTEXT.md` §11 | Domain traps — none derivable from code or screens |

---

## 9. Comment discipline, in one paragraph

A comment earns its place only as a **measurement**, a **residual/ceiling**, a **decision with its
rejected alternative**, a non-obvious **ordering dependency**, or a **pointer to the machine** that
enforces it. Delete anything that restates the line below it, narrates structure, or is a banner.

`services/core-api` sits at **63% prose and that is the correct number** — it was measured, and a
restatement detector over the whole tree returned three hits, all banners. What remains is argument,
not narration: the measurements, the ceilings, and the alternatives that were tried and rejected.
**Do not take another run at that number.**

---

## 10. Work in progress that was rescued, and will conflict

When `main` was landed, its working tree held **90 modified files and 28 untracked paths that had
never been committed** — mostly a camelCase → kebab-case rename under
`apps/web/src/components/ui/`, plus `apps/web/scripts/dev-real.mjs`,
`apps/web/e2e/real-package/`, and edits to `scripts/check_no_client_data.py`.

That is the "naming cleanup already underway" the programme was told to complete without undoing.
It is **not** on the branch that landed.

It was committed onto **`wip/naming-cleanup-2026-09-08`** (based on `ddaae50`) and pushed, so it
survives the machine it was made on. The landing itself was a fast-forward and **modified nothing in
any working tree**.

**Expect real conflicts when reconciling it**, for two specific reasons:

1. Every file under `components/ui` was reformatted by the first prettier pass — which had never
   been enforced, and failed on 185 files.
2. `scripts/check_no_client_data.py` was independently rebuilt on three axes (type, signature,
   content) and its INSERT threshold raised from one row to three, with four tests added covering
   both the refusing and the passing cases.

So: reconcile by hand, file by file. **Do not apply it wholesale.** The rename is still worth
finishing — kebab-case is the right target and `docs/CONVENTIONS.md` §3 covers naming — but it has to
be redone against the landed tree rather than replayed over it.

# Lead measurements, 2026-09-01

Established by the lead running the commands, not reported by a subagent. The
master plan must start from these numbers rather than from any document's
account of them.

---

## 1. The endpoint surface — three different counts, one authoritative

| set | how measured | count |
|---|---|---|
| named in contract comments | `grep -ohE '(GET\|POST\|PUT\|PATCH\|DELETE) /api/[A-Za-z0-9/{}_.-]+' packages/contract/src/*.ts \| sort -u` | **41** |
| handled by MSW | `grep -rhoE 'http\.(get\|post\|patch\|put\|delete)\("([^"]+)"' packages/mocks/src/*.ts \| sort -u` | **70** |
| called by live frontend code | `apps/web/src/shared/*Queries.ts` + `features/` + `app/` | **44** |
| **served by the backend today** | `grep -rhn '@router\.' services/*/src --include=*.py` | **1 domain endpoint** |

The one domain endpoint is `GET /api/rules`
(`services/core-api/src/titlepipe_core/api/routers/rules.py:144`). `/health` and
`/ready` predate all backend plan work.

**The contract comments undercount by 29.** Anyone sizing this work from
`endpoints.ts` alone will be wrong. The MSW handler set is the real
specification, because it is what the frontend was built and tested against.

**MSW handles 26 more endpoints than the frontend calls.** Some of that surplus
serves the nine screens deleted in `7f04340` — `/api/bench/results`,
`/api/golden*`, `/api/reconciliation/*`, `/api/engines/leaderboard`,
`/api/complaints*`. Dead surface must be identified before it is built; that is
what `endpoint-reconciliation` resolves.

## 2. The prototype archive is not on this machine

```
$ python3 scripts/gate0/verify_archive.py
archive not found at /home/rahul/.local/TitlePipe/gate0-prototype-archive
```

`GATE_0_ARCHIVE_MANIFEST.md:8` gives the location as
`%LOCALAPPDATA%\TitlePipe\gate0-prototype-archive\` — a **Windows** path. This
host is Linux, not WSL, with no `/mnt` drives. So the 2,786-line Flask
prototype, its 177-test safety net, and the five standalone bug-fix patches
exist only on another machine.

**Consequence:** every plan task of the form *"port `validators.py`"* or *"fold
in the five bug fixes"* is **not executable on this host today**. A plan that
schedules one is scheduling a task that cannot start.

Compounding it, `GATE_0_ARCHIVE_MANIFEST.md:17-19` records that the prototype
tests **embed real party names and one street address** from real county
packages, so committing the source is an owner decision that has not been made
(`GATE_0_RECOVERY.md` §4).

What *does* survive on this host is `scripts/gate0/`: `gate0-closure.patch`,
`make_synthetic_package.py`, `make_synthetic_reports.py`, `requirements.lock`,
`run_prototype_suite.py`, `test_v14_r15.py`, `verify_archive.py`. How much of
the safety net that reconstructs is an open question, not an assumption.

## 3. Verified state of the tree at `c9c4b74`

Green: `tsc -b`, `vite build`, `eslint` (0 errors, 6 known warnings),
390 unit tests / 63 files, `check:rules` (383 files), `knip`, `size-limit`,
backend `pytest` 249 passed, `ruff check`, `ruff format --check`,
`scripts/check_backend_rules.py` (54 files).

Red: `pnpm test:e2e` — **52 failed, 81 passed**. CI has never run on
`frontend/rebuild-2026-08`, so upstream's 24 commits shipped with a red e2e
suite nobody had seen. Two root causes, both real defects rather than flake:

1. **Deleted screens, surviving invariants.** `7f04340` removed nine screens.
   `/queue` now renders "Nothing lives at this address" while
   `packages/contract/src/authz.ts:62` still declares
   `screen.queue.enter` a door for `reviewer` and `admin`. The router and the
   frozen authz table disagree. ~26 failures.
2. **`min-width: 1360px` against a suite asserting 900/1024/1280px.**
   `apps/web/src/styles.css:35` sets `body { min-width: 1360px }`, so at
   Playwright's default 1280px viewport the body measures 1360 and the document
   scrolls sideways by exactly 80px — measured with a DOM walk, not inferred.
   `playwright.config.ts` sets no viewport at all. 7 failures.

Both spec files say verbatim that a test which cannot pass against the new
design is a conflict in the design, to be reported rather than weakened. They
are recorded here, unweakened.

### A trap that cost a run

An orphaned `vite preview` on port 4274, left by an earlier interrupted run,
silently served a **stale build** to the next one and produced `61 failed` —
a number that was wrong. `playwright.config.ts` sets `reuseExistingServer:
false`, but that does not help when the port is already held. Check
`ss -lptn 'sport = :4274'` before believing any e2e result.

## 4. Sizing, stated honestly

The frontend calls 44 endpoints. The backend serves one. Every state machine
the UI renders — field states, order stages, escalation lifecycle, countersign,
delivery and reissue — lives today in `packages/mocks/src/` (5,453 lines) and
has no server implementation. That is the gap the master plan has to sequence.

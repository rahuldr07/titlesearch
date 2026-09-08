# CI — what runs, what is actually required, and the proof each gate can fail

Batch RB-11, 2026-09-08, measured on `integration/backend-2026-09` at `9866da7`
plus this batch's changes. Nothing in this repository has ever been pushed to a
remote, so **no workflow in `.github/workflows/` has ever executed on GitHub**.
Everything below that could be run locally was run locally; the container and
Trivy jobs remain unexercised hypotheses until the first real push.

## 1. What runs

### backend.yml
| Job | What it does | Timeout |
| --- | --- | --- |
| `hygiene` | every repo gate as its own step (structural rules, locks, gate tests, client-data guard over the whole tree, doc links, CLAUDE/AGENTS sync), then the full pre-commit hook set | 20 min |
| `<project>` ×8 matrix (`scripts`, `libs/domain`, `libs/test-support`, `libs/service-kit`, `libs/http-kit`, `services/core-api`, `services/blind-svc`, `services/worker`) | `uv sync --frozen` → ruff check → ruff format --check → pyright strict → pytest (junit) → executed-test floor → junit artifact → `uv build` → dependency audit | 30 min |
| `container / <service>` ×3 | image build, non-root check, no-reload check, production smoke probes, refuses-empty-environment check, Trivy scan, SBOM artifact | 45 min |
| `security` | Trivy filesystem scan, Semgrep | 30 min |

### frontend.yml
| Job | What it does | Timeout |
| --- | --- | --- |
| `gates` | install → check:rules → eslint → **prettier --check** (new) → **knip** (new) → tsc -b → vite build → **size-limit** (new) → playwright chromium → vitest incl. Storybook a11y (junit) → **executed-test floor** (new) → junit artifact → storybook build | 30 min |
| `invariants` | Playwright e2e (all 111 harvested rules still `test.skip`; the job says so in its own output), failure artifacts, coverage notice | 20 min |

### migration-harness.yml
Unchanged by this batch. Job `browser app against core-api`: real Postgres,
Alembic, seeded rulebook, live browser slice. Reviewed: it already pins
`ubuntu-24.04`, sets `timeout-minutes: 25`, `permissions: contents: read`,
and installs with `--frozen-lockfile` / `uv sync --frozen`.

Both push and PR triggers carry path filters; the enforcement surface
(`scripts/**`, lockfiles, the workflow file itself, `**/pyproject.toml`,
`contract-fixtures/**`) is named in `backend.yml` so a change to a gate cannot
merge without the gate's workflow running. `scripts/tests/test_backend_workflow.py`
(14 tests, green) holds the matrix, the hook list and the fixture paths in
sync with the tree, so drift fails on a developer's machine, not silently.

Source-coverage note: `packages/contract`, `packages/mocks` and
`packages/ui-tokens` are covered by `pnpm typecheck` (their only script) and
by the workspace install; eslint, prettier, knip and vitest all scope to
`apps/web` because that is where those tools are configured. If the packages
ever grow logic worth testing, they need their own scripts and steps — a gap
named here rather than papered over with steps that would run nothing.

Independent verdicts: every gate step carries
`if: ${{ !cancelled() && steps.<setup>.outcome == 'success' }}` — a contributor
learns about lint AND type AND test failures from one run, while a failed
install fails once instead of five more times as noise.

## 2. Required on paper vs required in GitHub

**Committing a workflow file makes nothing mandatory.** Until branch
protection (or a ruleset) is configured in GitHub's settings — by hand, by the
owner, after the first push — every check above is advisory: a red X a merge
button will still accept. This cannot be done from inside the repository.

When the repo first lands on GitHub, mark these check names required on `main`
(names are the job `name:` fields; matrix jobs expand to one check per entry):

- backend: `hygiene`, `scripts`, `libs/domain`, `libs/test-support`,
  `libs/service-kit`, `libs/http-kit`, `services/core-api`,
  `services/blind-svc`, `services/worker`, `container / core-api`,
  `container / blind-svc`, `container / worker`, `security`
- frontend: `gates (rules · lint · format · types · dead code · tests · size)`
- migration harness: `browser app against core-api`

`harvested invariants (e2e)` should become required only when its suites stop
being all-skip; a required check that is green by vacuum teaches people to
ignore required checks. Note the trade-off of required + path filters: a PR
touching no matching path reports no check at all, and GitHub treats a missing
required check as pending. If that bites, the standard fix is a
paths-ignore-mirrored no-op workflow with the same job names; deliberately not
added until the problem is real.

## 3. Every gate, shown failing

Rule: a gate without a demonstrated red is decoration. Each command below was
run on this tree on 2026-09-08; violations were constructed, shown to fail,
and reverted. Exit codes are the gate's own.

| Gate | Deliberate violation | Result |
| --- | --- | --- |
| `scripts/check_backend_rules.py` | `print("unredacted")` in a temp `services/core-api/src/titlepipe_core/` module | exit 1, names the file and line |
| `scripts/check_no_client_data.py` | `lincoln_county_search_package.zip` touched in the tree, passed to the guard | exit 1, ".zip files may contain client documents" |
| `scripts/check_doc_links.py` | markdown file linking `docs/never-written.md` | exit 1, names the dead link |
| `scripts/check_agents_sync.py` | one drifted byte appended to `AGENTS.md` | exit 1 |
| `scripts/check_locks.py` | dependency added to `libs/domain/pyproject.toml` without relocking | exit 1, `FAIL libs/domain` (and every project that path-depends on it) |
| `apps/web/scripts/check-rules.mjs` | TSX file with `color: "#ff0000"` inline style | exit 1, `[hardcoded-colour]` + `[inline-style]` |
| `scripts/check_test_counts.py` (new) | junit with `tests="0"`; junit with `tests="9" skipped="9"`; missing file; unparseable file | exit 1 on each; unit tests in `scripts/tests/test_check_test_counts.py` |
| `scripts/audit_dependencies.py` (FX-40 fix) | `python scripts/audit_dependencies.py services/typo-api` | exit 1, "no such project" — **before the fix this printed `skip (no uv.lock)` and exited 0**, shown red by running the new test against the pre-fix code |
| size-limit | JS budget temporarily lowered to 10 kB | exit 1, "exceeded by 270 kB" |
| knip | the `src/components/ui/**` ignore removed | exit 1, 25 unused exports |
| prettier | none needed — **red on the tree today** (§5) | exit 1, 185 files |

Every gate could be made to fail; there is no gate to name as unfalsifiable.

Not demonstrable locally: the container jobs (Docker build + Trivy) and
anything that needs GitHub itself (path-filter behaviour, `!cancelled()`
step semantics, artifact upload). Those stay hypotheses until the first push;
actionlint is not installed on this machine, so the YAML was verified by
parser + the workflow-drift test suite only.

## 4. knip: the entry-list premise, and what the ignore hides

The RB-11 brief said knip's graph was rooted at the workbench because
`src/main.tsx` / `index.html` are absent from the entry list. **Measured
false on this tree**: knip's Vite plugin roots the graph at `index.html`'s
rollup input already. Adding `src/main.tsx` to `entry` makes knip itself
report "Remove redundant entry pattern", and removing the ignore surfaces
zero unused *files* — the application is fully reachable. The config moved to
`apps/web/knip.jsonc` so both facts are stated where they are enforced.

The ignore IS still load-bearing. Removing it yields exactly (knip 6.32.3):

- **25 unused exports** — all in `src/components/ui/` (mostly the
  `index.ts` barrel): FieldLabel ×2 (field-set.tsx, field.tsx),
  disabledAttributes, FieldGroup, FieldContent, FieldTitle,
  InputGroupTextarea, CommandPalette, statusColumn, DataCell,
  TooltipTrigger, BreadcrumbTrail, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbCurrent, BreadcrumbSeparator, Avatar, AvatarLabel, Spinner,
  useSidebar, SIDEBAR_KEY ×2 (index.ts, sidebar-context.ts), headerBand,
  headerType (overlaySurface.ts)
- **42 unused exported types** — same directory (AlertTone ×2, ButtonProps,
  LinkButtonProps, SlotProps, CheckboxGroupProps ×2, OptionProps ×3,
  Disablement, DisabledAttributes, ToggleProps, SelectProps, ComboBoxProps,
  CommandPaletteProps, CommandItemProps, TableProps, ColumnAlign, RowStatus,
  DialogProps, SurfacePopoverProps, ChipTooltipProps, BreadcrumbTrailProps,
  TabsProps, TabProps, TabPanelProps, Mark, ProgressMeterProps, CardProps,
  SegmentedControlProps, SegmentProps, AlertProps, AvatarProps, SpinnerProps,
  ScrollAreaProps, SplitProps, SplitPanelProps, InputProps, RadioGroupProps,
  RadioGroupItemProps, SwitchProps). These are `"types": "warn"` under the
  current rules, so only the 25 exports gate.

No file may be deleted by this batch: dead-code removal is owned by a later
batch. Until it lands, the ignore stays and carries this pointer.

## 5. Red on the tree today (found, not fixed — not this batch's to fix)

- **`prettier --check` fails on 185 files in `apps/web`** (83 under
  `src/features`, 51 `src/components`, 23 `src/entities`, 8 `src/app`,
  6 `src/shared`, 4 `src/workbench`, plus scripts/e2e stragglers). The new
  `Prettier check` step will be red until the owning batch runs
  `pnpm --filter @titlepipe/web format` and commits. Deliberately not run
  here: a 185-file mechanical diff belongs to its own commit, not inside a
  CI batch.
- Everything else measured green on this tree: `pre-commit run --all-files`
  (the brief's "seven failing files" and backend.yml's "81 guard-refused
  files" comment were both stale — fixed upstream since; the workflow comment
  now says so), the client-data guard over the whole tree, all six gates,
  vitest (431/431), scripts pytest (293), size-limit (280/320 kB JS,
  14.19/40 kB CSS), knip (with the documented ignore).

## 6. Also fixed in this batch

- **FX-40**: `scripts/audit_dependencies.py` now fails on a project name with
  no `pyproject.toml` (and on a project without `uv.lock`) instead of
  printing `skip` and exiting 0. Tests: `scripts/tests/test_audit_dependencies.py`,
  including a check that every `PROJECTS` entry exists on disk with a lock.
- Same latent class in `scripts/check_locks.py` (`skip (no pyproject.toml)` →
  exit 0): hardened identically. Tests: `scripts/tests/test_check_locks.py`.
- `libs/http-kit` was already present in the backend matrix and in
  `audit_dependencies.PROJECTS` at `9866da7`; verified, nothing to add.

## 7. Deliberately not done here

- `check:imports` and the root pnpm commands belong to other RB workers; no
  step referencing them was wired. god adds those at integration.
- No application source was changed to make a gate pass; the prettier red is
  reported above with counts instead.
- Branch protection cannot be configured from the repository (§2) — that is a
  by-hand owner step in GitHub settings after the first push.

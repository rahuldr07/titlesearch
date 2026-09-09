# Frontend handoff — 2026-09-03

Read `docs/HANDOFF.md` first; this is the delta on top of it.

## Run it

```
pnpm --filter @titlepipe/web dev            # port 5174, MSW serves everything
```

Four OPTIONAL env vars turn on the real-package demos. Without them the app is
complete and a real order is simply one whose source pages render as text.

```
TITLEPIPE_SCAN_DIR=<ocr-run-dir>    # one package:  /scan/page_0001.png …
TITLEPIPE_SCAN_PDF=<file.pdf>       #               /scan/package.pdf
TITLEPIPE_SCAN_ROOT=<runs-dir>      # many packages: /scan/<job>/page_0001.png …
                                    #                /scan/<job>/package.pdf   (= <runs>/<job>/source.pdf)
TITLEPIPE_REPORT_DIR=<reports-dir>  # rendered reports: /scan/<job>/report-v<N>.pdf
```

All are absolute paths OUTSIDE the working tree. `vite.config.ts` reads them
(dev server and `vite preview`, so the Playwright server too when they are
exported); nothing is served if they are unset, and anything else under
`/scan` is 404, never the SPA shell.

```
pnpm --filter @titlepipe/web dev:real       # dev with ALL FOUR set:
                                            #   ~/projects/ocr/runs, ~/projects/titlepipe-data/reports,
                                            #   and the single-package pair pointed at web_1786595970_6ef37d
                                            # refuses by name if any of them is missing
```

`ord_real_1` predates the multi-package middleware and names `/scan/page_NNNN.png` and
`/scan/package.pdf` — the SINGLE-package addresses, served only from
`TITLEPIPE_SCAN_DIR`/`_PDF`. With just the two roots set, that order's source
pane fell back to text and its certified artifact's "View" answered 404.

**`Artifact.href` is nullable.** Null means the server holds the artifact's
record and not its bytes, which is the ordinary state of a seeded delivery —
they were rendering `/api/artifacts/{id}`, an endpoint in no handler, and
following it is a top-level navigation no service worker answers, so "View" on
a certified deliverable landed on the app's own not-found screen. The row now
shows the digest with the action held and its reason; only an artifact with a
file behind it links.

**Guard.** `scripts/check_no_client_data.py` now has a third rule: a tracked
package fixture (`packages/mocks/src/realPackage.json`,
`packages/mocks/src/bundles/*.json`) whose content arrays are non-empty is
refused by content. Commit only the empty shape; the populated file stays
local. Run locally with the populated file present, the whole-tree scan is
red on exactly that file — that is the rule working, not a bug.

## `realPackage.json` is empty on purpose

`packages/mocks/src/realPackage.json` is the empty shape. Populated, it holds
a real county search package — named people, their addresses, and judgments
entered against them — and **this repository is public**.

```
node packages/mocks/scripts/build-real-package.mjs <ocr-run-dir> \
     packages/mocks/src/realPackage.json
```

Run that locally and **leave the result uncommitted**. `realPackage.ts`
carries the type so both states compile.

## The upload demo: `final_package.pdf` end to end

Dropping the real PDF on `/ingest` creates an order hydrated from a bundle
keyed by the file's own SHA-256 — the same 101-page Lincoln County package
the OCR run under `web_1788415544_a714e1` was produced from. The bundle is a
package fixture like the one above: **committed empty, populated locally.**

```
# populated bundle + the Shape A report PDF it certifies, in one pass
node packages/mocks/scripts/build-package-bundle.mjs \
     --render ~/projects/titlepipe-data/reports/web_1788415544_a714e1

node packages/mocks/scripts/check-bundle.mjs \
     packages/mocks/src/bundles/final-package-lincoln-mo.json

# the shape that is safe to stage — write it somewhere else and stage THAT
node packages/mocks/scripts/build-package-bundle.mjs \
     ~/projects/ocr/runs/web_1788415544_a714e1 <path> --empty
```

Defaults, all overridable positionally or by env: the run directory
`~/projects/ocr/runs/web_1788415544_a714e1`, the output
`packages/mocks/src/bundles/final-package-lincoln-mo.json`, the cross-engine
comparison `TITLEPIPE_COMPARISON`, and `TITLEPIPE_RENDERED_AT` (pinned, so a
re-run renders byte-identical PDF).

What the generator decides and the app then serves verbatim: the state
(`auto_confirmed` only where two readers agree on a clean page and the field
is neither a judgment nor T1), the routing reason, and the typed absence.
**The stated value is always the primary reader's reading** — it was
extracted, off a named page and a box — because a null value with a null
`na_reason` means "not yet extracted", which is false of any field that
carries a reading. `check-bundle.mjs` enforces that, along with provenance,
the two-reading maximum, and the judgment/T1 refusals.

**One order in the shop is already finished** — `ord_done_1`, ref `4176061-8`.
Open `/orders/ord_done_1/review` to read a completed examination: every decision
answered, every T1 ruling countersigned by the second examiner, all five gates
green on `/orders/ord_done_1/release`. It stops short of release on purpose —
the signature is the one act the product asks a human for, and `ord_demo_5` is
the seeded order that is already delivered. It is built by doing the work
through the same routes, not by declaring the outcome, so `POST /api/demo/reset`
rebuilds it rather than restoring it.

It is seeded from **the richest bundle the checkout holds** (`bestSeedBundle`):
the county package where it has been populated locally — 112 fields over 101
pages, judgments, T1 exposure, typed absences, rasters — and the synthetic
sample where it has not, so the order still exists in a clean checkout and in
CI with the same shape and the same tests over it. Being SEEDED rather than
uploaded, it keeps the package's own digest wherever one is shown but stays out
of the de-duplication ledger: the first real upload of that package is a first
intake, not a duplicate of a row nobody filed.

The e2e walk of the whole flow:

```
TITLEPIPE_REAL_PACKAGE=~/projects/ocr/runs/web_1788415544_a714e1/source.pdf \
TITLEPIPE_SCAN_ROOT=~/projects/ocr/runs \
TITLEPIPE_REPORT_DIR=~/projects/titlepipe-data/reports \
pnpm --filter @titlepipe/web exec playwright test e2e/real-package/ --workers=1
```

It skips itself by name when `TITLEPIPE_REAL_PACKAGE` is unset, and refuses to
upload anything whose digest is not the package's.

## Tests: unit green, Playwright not

```
pnpm --filter @titlepipe/web test        # 411/411 pass
pnpm --filter @titlepipe/web typecheck   # clean
pnpm --filter @titlepipe/web check:rules # clean, 389 files
pnpm --filter @titlepipe/web lint        # 0 errors, 8 react-refresh warnings
pnpm --filter @titlepipe/web knip        # clean
pnpm --filter @titlepipe/web test:e2e    # 64 failures — READ THIS FIRST
```

**Do not assume you broke the e2e suite.** Measured on 2026-09-03 by running
the same suite in a worktree at the previous commit:

| | failures |
|---|---|
| previous commit | 47 |
| this commit | 62 |

Of the 15 difference, **9 are a NEW gate** — `e2e/smoke/a11y-routes.spec.ts`
did not exist before, so the baseline never ran it. It finds mostly
pre-existing WCAG contrast issues, chiefly `#6e7480` on the app canvas at
11px = 4.04:1, which `components/ui/field-chrome.ts` already documents as a
known residual. One violation inside it WAS introduced and is fixed
(`#babfc9` at 1.84:1).

The remaining ~6 (responsive-frame, shell-frame, two sidebar fold tests, ux
pass-refusal, screens-drawn audit log) are **unattributed** — nobody has
established whether they predate this work. Several reference a rail toggle
and a `/queue` route this app does not have, which suggests they are old.

**2026-09-04: 65 failures, 91 passed, 3 skipped** (the real-package specs skip
without `TITLEPIPE_REAL_PACKAGE`), on a tree that also carries someone else's
in-flight sidebar refactor. The upload-demo work was isolated rather than
assumed innocent: `review.spec.ts` + `ux.spec.ts` were run twice, once with
this work's two app-visible changes (the countersign-ledger invalidation and
the orders search's unscoped ref) reverted and once with them in. Both runs:
**12 failed, 11 passed** — identical, so neither change moves the suite.

The 65th, `escalations.spec.ts:25 "citing an existing rule resolves the
cluster"`, passed in the morning run and fails now. It is NOT a regression and
was not assumed to be one: it reproduces 3/3 at 1280x720 (Playwright's default
viewport) and not at all at 1400x900, the `R13` option detaching from the DOM
under the combobox popover while it repositions — and it fails identically in a
clean `git worktree` at HEAD carrying none of this work. Pre-existing, viewport
-dependent, and the config's rAF-starvation note is not the cause.

## Open, and needing an owner ruling

- **`CorrectFieldRequest.reason` is optional**, relaxed 2026-09-02 for the
  build phase so an inline row edit can file a value. `services/core-api`
  still enforces `min(1)`: the wire and the server disagree.
  `correction-reason.test.ts` is the tripwire; it fails the day the contract
  is re-tightened and names the file that must change with it.
- **Release gates g3/g4/g5 on `ord_real_1` are stand-ins** that pass while
  saying `NOT PERFORMED` on screen. No chain analysis, ruinous-exposure
  classification or completeness check exists. Re-close them when they do.
- Button heights: RECIPES says 38, the prototype says 40, ours are 44 and 30.
- `CLAUDE.md` bans the SOC 2 event trail, the auto-scaling claim and the
  4-swatch NA legend; `RULING-2026-08-29 §1` orders them "built as drawn".
  Those two documents contradict each other.
- Delivered is still both an order-scoped record (`?order=`) and an ops index
  (no key). Decide whether it stays both.
- `GET /api/orders/{id}/deliveries` does not exist, so the order-scoped view
  filters client-side.

## Known defects, not fixed

- **Double-click to edit fails on rows further down the queue.** Measured:
  the list reflows 595px between the two clicks, so the second lands
  elsewhere. Works on the open row and on rows near it. The cause of the
  reflow is not isolated — the only `scrollIntoView` is in the right pane.
- Hub: the kicker duplicates the verdict's red, two accent primaries on one
  screen, six nested white cards where the design draws rails, and the
  telemetry terminal clips 63px mid-line with no scrollbar.

## Where things live

- `features/review/DecisionColumn.tsx` — extracted from `WorkstationScreen`
- `features/review/InlineEdit.tsx` / `useEditAsk.ts` — inline row editing
- `app/deliverySearch.ts` — `/delivery?order=`
- `packages/mocks/scripts/build-real-package.mjs` — OCR run → fixture

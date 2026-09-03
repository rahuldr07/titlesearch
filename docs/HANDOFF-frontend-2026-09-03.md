# Frontend handoff — 2026-09-03

Read `docs/HANDOFF.md` first; this is the delta on top of it.

## Run it

```
pnpm --filter @titlepipe/web dev            # port 5174, MSW serves everything
```

Two OPTIONAL env vars turn on the real-package demo. Without them the app is
complete and `ord_real_1` is simply an order the server holds nothing for.

```
TITLEPIPE_SCAN_DIR=<ocr-run-dir>   # serves /scan/page_0001.png … (dev only)
TITLEPIPE_SCAN_PDF=<file.pdf>      # serves /scan/package.pdf   (dev only)
```

Both are absolute paths OUTSIDE the working tree. `vite.config.ts` reads
them; nothing is served if they are unset.

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

## Tests: unit green, Playwright not

```
pnpm --filter @titlepipe/web test        # 411/411 pass
pnpm --filter @titlepipe/web typecheck   # clean
pnpm --filter @titlepipe/web check:rules # clean, 389 files
pnpm --filter @titlepipe/web lint        # 0 errors, 8 react-refresh warnings
pnpm --filter @titlepipe/web knip        # clean
pnpm --filter @titlepipe/web test:e2e    # 62 failures — READ THIS FIRST
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

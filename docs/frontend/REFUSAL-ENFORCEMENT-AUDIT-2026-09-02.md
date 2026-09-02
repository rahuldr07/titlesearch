# Refusal enforcement audit — analysis surfaces, 2026-09-02

Node `cd-gap-aggregate-headline-enforcement`. AGENTS.md and CONTEXT §14 both say
**refusals are product requirements → Playwright tests**. This audits whether
that held for the three analysis-surface refusals, and closes the gap it found.

## The claim under test

The coordinator's probe found refusal tests for THROUGHPUT only, and no test for
the aggregate-headline refusal. **Confirmed, and it was worse than that** — all
three analysis-surface refusals were doc-only.

## Method

Exhaustive grep of both suites, not a sample:

```
grep -rniE "headline|aggregate|promot|probe|leaderboard|accuracy|catch_rate|seat" \
  apps/web/e2e apps/web/e2e-live
```

32 files (26 in `e2e/`, 6 in `e2e-live/`). Zero `test.skip` in either suite, so
"no match" means genuinely unenforced rather than skipped.

## Findings — the enforcement gap, as it stood

| Refusal | Source | Enforced before? |
|---|---|---|
| no aggregate headline accuracy number | PRD:169, CONTEXT:470, HANDOFF:88 | **NO** |
| no auto-promotion | PRD:169, CONTEXT §15 | **NO** |
| no probe visibility | CONTEXT:470, `entities.ts:17` | **NO** |
| no throughput counters | CONTEXT:470 | yes — `queue.spec.ts:21`, `review.spec.ts:118` |
| no approve-all | CONTEXT:470 | yes — `review.spec.ts:118` |
| no queue cherry-picking | CONTEXT:470 | yes — `queue.spec.ts:9` |
| escalation refused without a rule | INVARIANTS:109 | yes — `escalations.spec.ts` |

Only the seven matches the grep returned were incidental — the word "seat" in
`sidebar.spec.ts:45`, "headline" in a `ux.spec.ts:22` comment about a draft
banner, "promotes" in `server-owns-state.spec.ts:79` (a confidence/state rule,
a different subject). **No match was a refusal assertion for any of the three.**

## Root cause: there was no surface to test

Not neglect. The three refusals govern screens that **do not exist**:

- `authz.ts:68,73,74` declare the doors `/dashboard`, `/bench`, `/leaderboard`.
- `staticRoutes.tsx:23` builds routes by looping `UNBUILT_SCREENS`.
- `unbuiltScreens.ts` has **11 entries and none of those three** — verified
  against `grep -c "path:"`.

So all three paths fall through to `rootRoute.tsx:97`'s `notFoundComponent`.
A rendered-surface refusal test could not have been written; there is nothing
to assert absence *on*.

## Resolution: enforced at the wire, plus a tripwire

`apps/web/e2e/invariants/analysis-refusals.spec.ts` — 11 tests, all green.

The contract boundary is the correct enforcement surface here, not a fallback:
an aggregate headline can only be drawn from a number the server sent, and a
probe can only be rendered from a probe shape the client can see. Refusing both
at the wire is what makes a future screen structurally unable to violate the
rule. `review-refusals.spec.ts` already establishes the precedent — *"a rule the
client alone enforces is not enforced"* — and the mock IS the backend today.

**Test 1 is a tripwire, and it is the important one.** It asserts all three
doors render `not-found`. The day a screen lands at `/leaderboard`, that test
fails, and whoever built it must return and write the rendered half of each
refusal. The gap is now self-reporting instead of silent.

Coverage:

- **aggregate headline** (4 tests) — leaderboard payload is `["cells"]` exactly,
  so no sibling key can hold a roll-up; each cell is keyed by all three axes
  (engine × section × jurisdiction), so a roll-up would have to drop an axis and
  has nowhere to live; `accuracy_by_tag` stays a per-tag-class map, never one
  number; `NO TRUTH YET` cells carry `null` rather than an averaged-in figure;
  bench cells expose `fields`+`passed` (the denominator) and never the quotient;
  a recursive key sweep over `/api/metrics` and `/api/bench/results` rejects any
  key named `accuracy`/`pass_rate`/`score`/`overall`/`aggregate`/`headline`.
- **no auto-promotion** (3 tests) — a seat flip with an empty `evidence_url` is
  refused 422 and the seat does not move; a `reviewer` is refused 403 at the
  wire whatever a screen draws; positive control, an `engineer` flip succeeds
  and records `approved_by` + `approved_at` + `evidence_url`.
- **no probe visibility** (3 tests) — the only probe-named keys reachable are
  `probes_planted` and `probes_caught` (asserted as an exact set, so a
  `probe_list` addition fails); no `/api/derived/{signal}` opens on probes, with
  `corrections` as the positive control so 404 means refused not broken; no
  order/fields/timeline/queue payload carries a probe marking at any depth.

## Validation — mutation-tested, not just green

Green tests prove nothing about a *refusal*: an assertion that something is
absent passes trivially if it is looking in the wrong place. So each was made
to fail on purpose. Five injected violations in `packages/mocks/src/handlers.ts`:

| injected violation | caught by | result |
|---|---|---|
| `accuracy: 0.97` on `/api/metrics` | metrics sweep | ✗ failed as intended |
| `probe_list: [...]` on `/api/metrics` | probe exact-set | ✗ failed as intended |
| `overall_accuracy` beside leaderboard cells | leaderboard key check | ✗ failed as intended |
| `pass_rate: 0.96` on `/api/bench/results` | bench sweep | ✗ failed as intended |
| removed the `routing.flip` guard | reviewer-cannot-flip | ✗ failed as intended |

Each failure landed on **exactly** the intended test and no other. Fixture
restored and verified clean by `git diff --stat` after each round.

Also: `pnpm typecheck` clean; `pnpm lint` clean (6 pre-existing warnings in
`table.tsx`, unrelated). The existing throughput tests were read and left
untouched — `queue.spec.ts` and `review.spec.ts` are unmodified.

## What remains doc-only

Two anti-patterns from CONTEXT:470 are still unenforced, both for the same
missing-surface reason, and both are out of this node's scope:

- **no auto-tuning on the extraction bench** — `/bench` has no screen and no
  write endpoint, so there is no tuning action to refuse.
- **no timer on golden-set capture** — `/golden` (`authz.ts:71`) likewise has no
  screen. `review.spec.ts:121` covers timers on the workstation only.

The tripwire test does not cover `/golden`, deliberately: it is not one of the
three refusals this node was scoped to. Adding it would be the natural next step.

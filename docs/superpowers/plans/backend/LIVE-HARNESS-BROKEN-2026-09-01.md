# The live harness is broken, measured 2026-09-01

Ninth companion to `LEAD-MEASUREMENTS-2026-09-01.md`, and the one that
**invalidates a claim in the master plan**.

`BACKEND-MASTER-PLAN.md` states the exit criterion as *"the mock can be
switched off and the invariants still pass"*, and treats
`apps/web/e2e-live/` as the machinery that proves it. **That machinery does
not currently work**, and worse, it fails in the specific way
`00-HOW-TO-EXECUTE §1.1` exists to warn about.

---

## What I measured

All five specs in `apps/web/e2e-live/` navigate to **`/rulebook`**. Run against
a real production build:

```
/rulebook          → "Nothing lives at this address. /rulebook is not a
                      door in this application."
/account?tab=rules → renders the rulebook: "R13 | senior | Live", 4 of 4 shown
```

The rulebook moved into an account tab during the rebuild. `/rulebook` has no
route in `unbuiltScreens.ts` and no door in `authz.ts`.

**And the testid is gone too.** All five specs key on
`getByTestId("rule-row-R13")`. A DOM scan of the live account tab returns
**zero elements** whose testid contains `rule`. Nothing in `apps/web/src` or
`packages/` emits `rule-row` any more — the only references left in the tree
are the seven inside `e2e-live/` itself.

So the harness is broken twice over: wrong URL, and a selector nothing renders.

## Why this is worse than five failing tests

Count the assertion kinds across the five files:

| assertion | count | behaviour at `/rulebook` today |
|---|---|---|
| `toBeVisible()` on `rule-row-R13`/`R22` | 5 | **fails loudly** — correct |
| `toHaveCount(0)` on `rule-row-R13` | 6 | **passes vacuously** |

The six `toHaveCount(0)` assertions are the *denial* half of this suite. They
say things like *"the rulebook halts rather than falling back to mock rows"*
(`halts-without-core-api.spec.ts:16`) and *"live mode refuses to start when a
mock worker is still registered"*.

Every one of them **passes against a 404 page**, because a 404 page contains no
`rule-row-R13` either. A suite that cannot tell *"the app correctly refused to
fall back to mock data"* from *"the app rendered Nothing lives at this address"*
is not proving the fallback control.

This is precisely `00-HOW-TO-EXECUTE §1.1`'s measured lesson, recurring in a
different file:

> Look at what those three have in common: **every one of them is satisfied by
> a database that denies everybody everything.** [...] for every proof you
> write, ask what a broken-in-the-obvious-way system would score on it. If the
> answer is "full marks", you have written a denial test and called it an
> isolation test.

Here the broken-in-the-obvious-way system is *a missing route*, and it scores
full marks on six of eleven assertions.

## What it means for the plan

`BACKEND-MASTER-PLAN §1` Plan 03's entry gate and the whole exit criterion
assume this harness works. It does not. **Repointing it is a prerequisite for
every later plan's acceptance test**, not a cleanup task, because it is the
only mechanism that proves an endpoint is served by core-api rather than by
MSW.

The repair is small and its shape is clear:

1. Repoint all five specs from `/rulebook` to `/account?tab=rules`.
2. Restore a stable per-rule testid, or re-key the assertions onto whatever
   `RulesPanel` now renders.
3. **Add the positive control the suite lacks**: assert the row is visible in
   the *same* run that asserts it is absent, so a missing route fails both
   halves instead of passing one.

Step 3 is the one that matters. Without it, repointing the URL fixes today's
symptom and leaves the vacuity.

## Why nobody caught it

`migration-harness.yml:303` runs `pnpm test:e2e:live`, but that workflow is
path-filtered and **CI has never run on `frontend/rebuild-2026-08`**
(`LEAD-MEASUREMENTS §3`). The specs were last touched by `8bc3fb7` on
2026-08-31 — a comment-only commit — so the rebuild moved the screen out from
under them and nothing executed them afterwards.

## What I did not check

I did not run `pnpm test:e2e:live` end to end. It needs Postgres, the roles,
an Alembic run and a seeded rulebook (`seedRulebook.mjs`), and standing that
up is a task in its own right. The measurements above are from a real
production build served by `vite preview`, driven by the Playwright CLI — which
is enough to establish the URL is dead and the selector renders nothing, but
not enough to say what the full live suite reports once those are fixed.

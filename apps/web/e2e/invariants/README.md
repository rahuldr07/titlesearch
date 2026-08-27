# Harvested invariants

**111 specs, every one `test.skip`.** Migrated from `apps/web` at commit `ade49af` — the
last commit before frontend rebuild work began, and therefore the last state in which these
specs asserted the rules rather than a previous rebuild's output.

Full method, classification and counts: `docs/frontend/test-harvest.md` Part II.

## What a green run means today

**Nothing.** Every test is skipped, so the suite passes vacuously. It becomes a real gate
one feature at a time during BRIEF §5 Phase 5. Do not read a green run here as evidence the
app works until the un-skipped count is reported alongside it.

Track progress by the un-skipped count. The bar is **111 e2e + 22 Vitest = 133**.

## Working with these files

Each test carries a `TODO(rebuild) [CLASS] — rule:` line stating, in prose, the product rule
it protects. That line is the point of the file. The selectors below it are disposable; the
rule is not.

- **Rewrite selectors freely.** They target a UI that no longer exists.
- **Never weaken an assertion.** If a test cannot pass against the new design, that is a
  `CONFLICT` in the design, not a stale test — stop and report it (BRIEF §5 Phase 5, §12).
- **`test.skip` → `test`** only when the feature actually lands, not to make a run look better.

## Classes

| Tag                             | Meaning                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVARIANT`                     | asserts a product rule. Survives; selectors change, assertions do not.                                                                                                      |
| `ORPHAN RULE`                   | asserts a rule written down **nowhere else in this repository**. Deleting one of these deletes the rule. 16 of them.                                                        |
| `INVARIANT (mechanism changed)` | the rule survives but its implementation must change. Exactly one: `sidebar` #8, whose collapse preference moves from `localStorage` (forbidden, §9.11) to the server (§7). |

## What is not here

Five specs were dropped as `STRUCTURAL` — they asserted the old UI's layout with no rule
behind them. Each is recorded in place as a `// DROPPED —` comment naming why, so the
decision is visible at the point it was made rather than only in the harvest doc. They
remain in git at `ade49af`.

`helpers/net.ts` is not a spec. It is the in-page fetch wrapper that makes network-level
blindness provable at all — Playwright's `page.route` cannot see MSW-handled fetches, so
without it `blind-blindness.spec` #1 cannot be written.

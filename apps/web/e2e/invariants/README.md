# Invariants

Each spec asserts product rules. A `// Rule:` line above each test states, in
prose, the rule it protects; that line is the point of the file. The selectors
below it are disposable; the rule is not. A rule marked "recorded nowhere else"
exists only in that test — deleting it deletes the rule.

- **Rewrite selectors freely.** They target the UI, which moves.
- **Never weaken an assertion.** If a test cannot pass against the new design,
  that is a conflict in the design, not a stale test — stop and report it.

`helpers/net.ts` is not a spec. It is the in-page fetch wrapper that makes
network-level assertions possible at all — Playwright's `page.route` cannot see
MSW-handled fetches.

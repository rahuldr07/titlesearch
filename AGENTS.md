# TitlePipe — repo guide

Read before writing code, in this order:
1. `docs/HANDOFF.md` — most current state (2026-07-17). **Supersedes the others where they conflict** (e.g., frontend is React 19/Vite v2 per HANDOFF §5, not vanilla .dc.html; services layout per HANDOFF §4).
2. `docs/CONTEXT.md` — domain facts and history. §11 (domain traps) is mandatory; none of it is derivable from code or screens.
3. `docs/PRD.md` — build document: data model, API contract, release gates.

## Hard rules (violations are design defects, not style)

- **Never generate backend logic from the UI/screens.** The backend is upstream; the rules live in the rulebook, not the pixels.
- **County search packages and seed DBs never enter VCS.** Local upload storage lives outside the working tree at an absolute configured path; `/data/` is the gitignored dev default. Never write uploads into the repo (644 MB incident, CONTEXT §19). Note: the workspace dir `packages/` (contract/ui/mocks source) IS tracked — the compliance rule is about county packages, not the pnpm convention.
- **Never emit a value you can't cite.** Provenance on everything (principle 6 — caught 6 times in prototyping).
- **Two NA states** — `NOT_PRESENT` vs `PRESENT_UNREADABLE` — never collapse; never derive `needs_review` from `value === null`.
- **Server owns all state machines and thresholds.** UI never computes `state` from confidence, never re-derives counts, chain termination, or release resolution.
- **Anti-patterns stay out:** no throughput counters anywhere, no probe visibility, no aggregate accuracy headline, no auto-tuning, no approve-all, no queue cherry-picking. Refusals are product requirements → Playwright tests.
- **Escalation resolution is refused without a rule.** PENDING rules cannot affect the pipeline until engineer-confirmed.
- **Judgments never auto-confirm in v1.** Engine self-confidence never gates auto-confirm.
- **Engines never see each other's output.** Adapters ≤300 lines; cost + latency recorded per call; capabilities declared, not faked.
- **A failing test may be correct behavior.** Check the rulebook and provenance tag (`RULED`/`DERIVED`/`OPEN`/`CONFLICT`) before "fixing" assembly output. Do not build past `OPEN`.
- **v99 stays deliberately empty:** land+building is never checked against total (mixed valuation bases are correct).
- **Accuracy first, cost second** (owner mandate). Don't optimize the ensemble away. Settled, don't relitigate: I/O-bound workload, Max plan is dev-only never a backend, LLMWhisperer-now/Paddle-at-scale.

## Working style

Direct, technical, no cheerleading. Bias to producing artifacts over discussing. Challenge wrong assumptions plainly, grounded in the actual documents. Terse answers are answers.

Current phase: **P0** — see HANDOFF §8/§10 for the parallel work items.

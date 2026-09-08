# Working record

The programme that built this backend ran as a set of parallel agents. This directory is their
record, copied here so it survives the machine it was produced on.

- `tasks.json` — the structured ledger. Every card carries a `result` field saying what was actually
  done and, where it matters, what was rejected and why.
- `board.md` — the narrative. Rulings, integration state, and the reasoning behind each decision, in
  the order it happened.
- `orchestrator-memory.md` — durable facts and, more usefully, the mistakes: the branch-base trap,
  the stale-premise dispatches, the parser error that nearly reported a zero-test run.

These are a historical record and are not maintained. `CONTEXT999.md` at the repository root is the
document to read first; where it and these disagree, it is newer.

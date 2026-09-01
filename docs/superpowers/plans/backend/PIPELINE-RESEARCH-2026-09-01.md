# Pipeline research, 2026-09-01

Seventh companion to `LEAD-MEASUREMENTS-2026-09-01.md`. What the extraction
pipeline must be, and how much of it is already decided.

**The headline finding: the pipeline is not an open design problem.**
`docs/CONTEXT.md` §5, §6 and §8 specify it to adapter-signature level. A plan
that "designs the extraction architecture" is re-doing settled work. What is
missing is not design; it is that **none of it is built** (`STATE-AUDIT`:
`extraction-svc` and `render-svc` are 155-line CLIs whose `run` refuses to
start).

---

## 1. The stages, and which one the plan will underestimate

`ingest/segment → triage → extract → assemble → render → deliver`
(`CONTEXT.md:66`).

`CONTEXT.md:74-76` calls the shot in advance, and it should be quoted into the
master plan rather than rediscovered:

> **Assemble is the expensive stage. Budget it as its own stage with its own
> tests. Do not let it hide inside "extraction."**
>
> Extracting `$220,224.00` from a scan is solved. Knowing that the 2011
> assignment attaches to the 2008 DOT and not the 2015 subordinate one [...]
> that is relational reasoning across documents, and it is where reviewers will
> find your errors.

Two structural constraints on the whole tier:

- **Extract is queue-based, never request/response** (`CONTEXT.md:71`). A
  181-page package through a vision model is minutes and real money.
- **The web tier never does minutes-long work** (`CONTEXT.md:78`).

So a job queue is not an optimisation to defer. It is load-bearing from the
first extraction endpoint, and `POST /api/orders/{id}/pipeline/replay` — which
the frontend already calls — presumes it exists.

## 2. Why OCR is stage one, measured

Text-layer coverage across the five reference packages (`CONTEXT.md:82-90`):
Greene NY 13%, Mecklenburg NC 22%, Houston GA 5%, Clayton GA 8%, Wheeler St OH
57%. **Median well under 25%.**

And the counter-lesson that justifies the whole product: **5 of the 7 confirmed
defects are on machine-readable pages.** The `Not Available` problem is
overwhelmingly *extraction failure under a clock*, not absent source.

## 3. The adapter contract — hard requirements, already written

`CONTEXT.md:222-229`:

- **≤300 lines.** An engine needing more *"doesn't fit — wrap it externally."*
- **Cost and latency recorded per call**, attributed to engine + order + tenant.
- **Engines never see each other's output.** Independence is what makes
  disagreement meaningful.
- Config-driven registry, enable/disable per environment, no deploy.
- Missing capabilities (no confidence, no boxes) are **declared, not faked**.
- **`RuleContext` carries R13–R24 field instructions. Prompts are generated
  from the rulebook.** A rule change regenerates prompts for every engine.
  **No per-engine prompt surgery.**

That last one is the deepest architectural commitment in the document and the
easiest to violate accidentally. It means the rulebook is an *input to
extraction*, not merely a validation pass afterwards — so `GET /api/rules`,
the one endpoint that exists, is closer to the pipeline's spine than its
sequence position suggests.

## 4. The seven-engine roster and the routing rule

`CONTEXT.md:233-241`. Reader A is Gemini 2.5 Flash (vlm_image); Reader B is
LLMWhisperer high_quality (ocr_text, supplies line coords for click-to-source);
Claude API is second opinion on amounts, legals and judgment TYPE/STATUS;
Tesseract is a confidence oracle and **never a reader of record**; pdftotext
handles born-digital; Gemini Flash-Lite classifies pages; PaddleOCR-VL is the
Reader-B challenger and the self-host/PII path.

The two readers are chosen for **uncorrelated failure modes**: image-VLM
hallucinations are plausible-but-wrong, OCR errors are visibly garbled.
Different alarms. That is why the ensemble cannot be "optimised" down to one
reader without destroying the signal.

Routing (`CONTEXT.md:246-252`):

```
agree(A,B) ∧ redundancy_pass ∧ validators_pass  → AUTO_CONFIRM
high_stakes(field) → additionally require Claude agreement
section == judgments                            → NEEDS_REVIEW (v1, always)
else                                            → NEEDS_REVIEW
```

`agree()` uses canonical comparison — token-sorted names, normalised amounts
and dates — and **the bug-4 normalizer is the shared canon**. That normalizer
lives in the prototype, which is not on this host.

**Engine self-reported confidence is never an auto-confirm gate.** Documented
as miscalibrated; it is one prioritisation signal among four, ranked last after
A/B disagreement, redundancy failures and Tesseract region confidence.

## 5. What CONTEXT §6 gives that the skeleton does not

`CONTEXT.md:103-142` is the **authoritative data model**, and it is materially
larger than what `SCHEMA-GAP` counted from the contract, because several tables
back no screen:

- `documents(... segmentation_state)` — R24 instrument boundaries. No table
  today, and assemble cannot run without it.
- `engine_runs(id, engine_id, order_id, pages, cost_usd, latency_ms, error)` —
  the per-run cost ledger.
- `probes(id, order_id, field_path, planted_value, caught, reviewer_action)` —
  the reviewer catch-rate mechanism. Note the anti-pattern rule: **no probe
  visibility** in the UI. The table exists; the surface must not.
- `users`, `clients` — neither exists.

So the real table count is higher than `SCHEMA-GAP`'s ten-missing figure. That
document counted against the contract; this one counts against the domain.

Also stated there and not yet honoured anywhere: **field-level envelope
encryption at the application layer for DOBs and bankruptcy details**, distinct
from at-rest encryption.

## 6. Settled, and not to be relitigated

`CONTEXT.md:481-486`:

- **Accuracy first, cost second.** Explicit owner mandate; cost optimisation
  was considered and rejected as the primary goal. *"Do not 'optimize' the
  ensemble away."*
- **The workload is I/O-bound, not CPU-bound.** Compiled languages are
  irrelevant here.
- **A Max plan is development only — never a backend.** Billing is API keys
  with hard spend caps, Batch and prompt caching.
- Self-hosting PaddleOCR is a **cost valve** past ~8–10K orders/month, not a
  launch decision.

## 7. The P0 item that predates the backend

`CONTEXT.md:520`: *"a six-engine bake-off on the 20 worst pages [...] One
afternoon, one CSV, and the Leaderboard opens with real local-vs-cloud data on
the actual worst documents — **before a line of the new backend exists.**"*

This is unbuilt, and it is the cheapest de-risking available: it decides the
roster empirically before any adapter is written against it. It also needs
**real county packages**, which are not in VCS by hard rule and are not on this
host — the same logistics blocker as the prototype archive.

Worth flagging to the owner as a single question: **can this machine get the
reference packages and the prototype archive?** Both P0 items depend on it.

## 8. What the plan should conclude

The pipeline needs no design phase. It needs, in order: a job queue and worker
topology, an object store at a configured absolute path outside the working
tree, the `documents`/`engine_runs`/`probes` tables, the adapter interface with
its cost/latency ledger, `RuleContext` generation from the rulebook, the
ensemble router, and only then engines. Assemble gets its own plan with its own
tests, per the document's own instruction.

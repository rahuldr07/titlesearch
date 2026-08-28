import { ContractGap } from "../../entities/contract/ContractGap";

/**
 * WHAT THIS CORPUS IS, SAID BEFORE ANY OF IT IS SHOWN — and the one thing the
 * shape cannot say.
 *
 * Split out of `GoldenScreen` because it is the only part of it that is an
 * ARGUMENT rather than a rendering, and because the argument is the screen's
 * reason to exist. PRODUCT.md: "the durable product is the arena + golden set +
 * rulebook, never a vendor… a competitor could copy the extraction; they could
 * not copy the accumulated rulebook or the measured golden set."
 *
 * ══ THE HONEST SENTENCE, QUOTED RATHER THAN SOFTENED ═══════════════════════
 *
 * CONTEXT §420 is the most important line about this corpus and it is a warning
 * about the corpus itself: "Be honest about what the seed is: it is anchored on
 * TYPIST BEHAVIOUR, NOT TRUTH… a seed built from these reports will happily
 * score a model that reproduces the error." A screen that renders the ruler
 * without that sentence is a screen that presents typist habit as ground truth,
 * which is the precise failure the blind fifty exists to cover.
 */
export function GoldenPreamble() {
  return (
    <header className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Golden set
        </h1>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          The measured ground truth every engine, every bench run and every
          delivered report is scored against. Sampling found 7 material defects
          across 6 of 10 delivered reports, 5 of them on machine-readable pages
          (CONTEXT §12); those seven are the seed this corpus grew from.
        </p>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          It is anchored on typist behaviour, not on truth. It cannot measure
          what typists get wrong systematically — judgment type was wrong 3 of 3
          — so a row here is a recorded reading with a stated provenance, never
          a verdict. There is no score on this screen and no summary of one:
          per-row facts only.
        </p>
      </div>

      {/*
       * Rule 14 is unsatisfiable against this shape, and saying so is the only
       * honest option. A `Field` carries `na_reason` and `readCited`
       * (shared/provenance.ts) classifies it into the four typed absences; a
       * `GoldenField` carries a bare nullable `value`. So `SeedValue` refuses
       * to print a dash and states the one fact it has, and the missing three
       * are asked for here rather than invented.
       */}
      <ContractGap
        drawn="The typed absence of a seed value — structurally absent / not found in the package / not stated in the instrument / page unreadable (rule 14, the four-state NA taxonomy)"
        has={
          <>
            A bare nullable <code className="font-mono text-label">value</code>{" "}
            on <code className="font-mono text-label">GoldenField</code>{" "}
            (entities.ts:188), and nothing else. No{" "}
            <code className="font-mono text-label">na_reason</code>, no{" "}
            <code className="font-mono text-label">source_doc_id</code>, no{" "}
            <code className="font-mono text-label">source_page</code> — so a
            null seed cannot say whether the document is silent, the page is
            unreadable, or nobody searched. One row in the live payload
            (judgments.1.plaintiff_attorney) is exactly this.
          </>
        }
        needs={
          <>
            The <code className="font-mono text-label">NaReason</code> the
            contract already ships (enums.ts:41-48) carried on a golden field,
            the way <code className="font-mono text-label">Field</code> carries
            it. Until then this screen states the absence and declines to
            classify it: collapsing four reasons into one dash is the render
            INVARIANTS 7 forbids, and guessing which one applies would be
            emitting a value nobody can cite.
          </>
        }
      />
    </header>
  );
}

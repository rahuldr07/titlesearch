import type { QuarantineResponse } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * THE BANNER'S GATE STRIP — README §22's "rulebook banner (amber until
 * quarantine passes, then green)", built as a RENDERING of server state and
 * nothing more.
 *
 * Green is not a client verdict: it is the sentence for "every step the server
 * sent says `passed`" — the server's own word per step (design2.ts:14-20), with
 * no threshold evaluated, no step invented, and no aggregate the server did not
 * imply. The other tones are the same discipline: a failed step prints the
 * SERVER'S label and `detail` verbatim, an unfinished one prints the server's
 * own state word, and where no response exists at all the strip is amber with
 * that stated as the reason — which is true, where "waiting on a shape that
 * does not exist" no longer is (2026-08-28 ruling).
 */
const TONES = {
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
  settled:
    "border-state-settled-border bg-state-settled-surface text-state-settled",
} as const;

interface Verdict {
  readonly tone: keyof typeof TONES;
  readonly state: "unrun" | "empty" | "failed" | "open" | "passed";
  readonly sentence: string;
}

function verdict(quarantine: QuarantineResponse | null): Verdict {
  if (quarantine === null) {
    return {
      tone: "attend",
      state: "unrun",
      sentence:
        "Quarantine has not run — no package has been uploaded against an order yet, so nothing has cleared.",
    };
  }
  if (quarantine.steps.length === 0) {
    return {
      tone: "attend",
      state: "empty",
      sentence:
        "The server sent no gateway steps for this order. Nothing is assumed to have cleared in their place.",
    };
  }
  const failed = quarantine.steps.find((step) => step.state === "failed");
  if (failed !== undefined) {
    return {
      tone: "halt",
      state: "failed",
      sentence:
        failed.detail === null
          ? `Quarantine failed at ${failed.label}.`
          : `Quarantine failed at ${failed.label} — ${failed.detail}`,
    };
  }
  const open = quarantine.steps.find((step) => step.state !== "passed");
  if (open !== undefined) {
    return {
      tone: "attend",
      state: "open",
      sentence: `Quarantine has not cleared — the server reports ${open.label} as ${open.state}.`,
    };
  }
  return {
    tone: "settled",
    state: "passed",
    sentence:
      "Quarantine passed — every gateway step the server ran reports passed.",
  };
}

export function QuarantineGate(props: {
  readonly quarantine: QuarantineResponse | null;
}) {
  const v = verdict(props.quarantine);
  return (
    <p
      data-testid="rulebook-gate"
      data-state={v.state}
      className={cx(
        "rounded-md border px-6 py-5 font-sans text-meta leading-body",
        TONES[v.tone],
      )}
    >
      {v.sentence}
    </p>
  );
}

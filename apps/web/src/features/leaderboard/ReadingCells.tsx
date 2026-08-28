import type { LeaderboardCell } from "@titlepipe/contract";

/**
 * ONE ENGINE'S READING FOR ONE TAG, AND THE THREE REASONS THERE MAY BE NO
 * NUMBER — kept apart, because collapsing them is the defect.
 *
 *   1. `no_truth_yet` — `entities.ts:271-274`: "a cell below golden coverage
 *      threshold shows NO NUMBER AT ALL". The SERVER decided the threshold and
 *      the client does not second-guess it by printing whatever it measured
 *      anyway. This is not a bad score; it is the absence of ground truth.
 *   2. `accuracy_by_tag === null` — the engine declares no reading for this
 *      section. `pdftotext` returns null on the scan-heavy sections: it has no
 *      capability there and the contract records that as null rather than as a
 *      zero. AGENTS.md: capabilities are DECLARED, not faked. A zero here would
 *      be the browser faking one.
 *   3. the tag is simply not in this cell's record — nothing of that kind was
 *      measured.
 *
 * A blank cell would read as all three at once, and rule 14 ("absence is typed,
 * never a blank") is the rule that forbids it. Each says which it is, in words
 * that differ, so the distinction survives a grey-scale print and a screen
 * reader.
 *
 * ══ THE NUMBER IS PRINTED AS THE SERVER SENT IT ════════════════════════════
 *
 * `0.959`, not `95.9%`. The contract types `accuracy_by_tag` as a record of
 * numbers and says nothing about their presentation; multiplying by a hundred
 * and appending a sign is the client restating a server value in a unit the
 * server did not use, and it rounds — `0.959` and `0.9594` become one string.
 * The rule this screen is most at risk of breaking is "never emit a value you
 * can't cite", and the safest citation is the value itself.
 */
export function TagReading({
  cell,
  tag,
}: {
  readonly cell: LeaderboardCell;
  readonly tag: string;
}) {
  if (cell.no_truth_yet) {
    return (
      <Absent
        short="no truth yet"
        full="No truth yet — golden coverage is below the threshold, so the server states no number."
      />
    );
  }
  if (cell.accuracy_by_tag === null) {
    return (
      <Absent
        short="not declared"
        full="This engine declares no reading for this section."
      />
    );
  }
  const value = cell.accuracy_by_tag[tag];
  if (value === undefined) {
    return (
      <Absent
        short="not measured"
        full="Nothing with this golden tag was measured in this cell."
      />
    );
  }
  return (
    <span className="font-mono text-meta leading-close font-semibold text-ink-primary">
      {value}
    </span>
  );
}

/**
 * A number the server sent, or the fact that it did not. Used for golden
 * coverage, cost and latency — all `nullable` in `entities.ts:276-286`.
 */
export function StatedNumber({ value }: { readonly value: number | null }) {
  if (value === null) {
    return <Absent short="not stated" full="The run states no figure here." />;
  }
  return (
    <span className="font-mono text-meta leading-close text-ink-secondary">{value}</span>
  );
}

/** Typed absence: a short word on screen, the whole sentence for a reader. */
function Absent({ short, full }: { readonly short: string; readonly full: string }) {
  return (
    <span className="truncate text-label leading-close text-ink-faint">
      <span aria-hidden>{short}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

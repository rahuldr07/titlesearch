import type {
  ClientOverride,
  ClientRecord,
  EffectiveChecklist,
  EffectiveLine,
  LineApplication,
  OverrideType,
} from "@titlepipe/contract";

/**
 * A client paired with the checklist the server resolved for it against the
 * selected product. Pairing is the only join the comparison does — a client
 * with no resolved checklist for that product gets no column at all, rather
 * than a column of assumed baseline dots.
 */
export interface CompareColumn {
  client: ClientRecord;
  checklist: EffectiveChecklist;
}

/**
 * How a resolved line is DRAWN. Presentation only.
 *
 * Nothing here resolves anything: the application on a line is the server's
 * answer and the type on an override is the override's own field. This maps
 * that pair to a mark, so the matrix cannot disagree with what an order
 * actually gets — the claim the whole screen rests on.
 *
 * A DOT MEANS "TAKES THE BASELINE AS WRITTEN", and it is drawn rather than left
 * blank. Blank would read as missing data; the dot says the server resolved
 * this line and found nothing special, which makes the marks the entire set of
 * differences and a column of dots a client with nothing to argue about.
 */
export type CompareMark = "baseline" | "narrowed" | "replaced" | "waived" | "added";

const SYMBOL: Readonly<Record<CompareMark, string>> = {
  baseline: "·", narrowed: "◐", replaced: "≠", waived: "✕", added: "＋",
};

const LABEL: Readonly<Record<CompareMark, string>> = {
  baseline: "same as baseline",
  narrowed: "narrowed",
  replaced: "replaced",
  waived: "waived — off this client’s list",
  added: "client-added line",
};

export const COMPARE_LEGEND: readonly { mark: CompareMark; symbol: string; label: string }[] =
  (["baseline", "narrowed", "replaced", "waived", "added"] as const).map((mark) => ({
    mark,
    symbol: SYMBOL[mark],
    label: LABEL[mark],
  }));

export const markSymbol = (mark: CompareMark): string => SYMBOL[mark];
export const markLabel = (mark: CompareMark): string => LABEL[mark];

/** The override that moved a line off the baseline, or null if none did. */
export function overrideFor(
  line: EffectiveLine,
  overrides: readonly ClientOverride[],
): ClientOverride | null {
  if (line.override_id === null) return null;
  return overrides.find((o) => o.id === line.override_id) ?? null;
}

/**
 * APPLICATION FIRST, override type second. The server's application decides
 * whether the line is on the client's list at all; the override only explains
 * why. Reading the override first would let a "replace" that the server
 * resolved as excluded render as if the line were still being answered.
 */
/** Internal — `markOf` is the exported entry point. */
function markFor(
  application: LineApplication,
  override: OverrideType | null,
): CompareMark {
  if (application === "excluded") return "waived";
  if (application === "narrowed") return "narrowed";
  if (override === "replace") return "replaced";
  if (override === "add") return "added";
  return "baseline";
}

export const markOf = (
  line: EffectiveLine,
  overrides: readonly ClientOverride[],
): CompareMark => markFor(line.application, overrideFor(line, overrides)?.type ?? null);

/** How the row's treatment is named next to it — the override's own word. */
export const treatmentLabel = (override: ClientOverride | null): string =>
  override === null
    ? "from baseline"
    : override.type === "waive"
      ? "waived"
      : override.type === "narrow"
        ? "narrowed"
        : override.type === "replace"
          ? "replaces standard"
          : "client-added";

export const deltaLabel = (count: number): string =>
  count === 0 ? "no deltas" : `${count} delta${count === 1 ? "" : "s"}`;

export const stackedCountLabel = (count: number): string =>
  count === 0 ? "takes the baseline as written" : deltaLabel(count);

/** The lines this client does not take as the baseline states them. */
export const deltasOf = (
  lines: readonly EffectiveLine[],
  overrides: readonly ClientOverride[],
): readonly EffectiveLine[] => lines.filter((l) => markOf(l, overrides) !== "baseline");

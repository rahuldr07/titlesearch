/**
 * Every active client against one product baseline, as marks.
 *
 * CONTRACT GAP: like `effective.ts`, these marks are TRANSCRIBED server output.
 * The matrix's whole claim is that it cannot disagree with what an order
 * actually gets, which is only true while one resolver produces both — so
 * nothing here re-derives a client's treatment from its override list.
 *
 * A DOT MEANS "TAKES THE BASELINE AS WRITTEN", and it is drawn rather than left
 * blank. Blank would read as missing data; the dot says the server resolved
 * this line and found nothing special, which makes the marks the entire set of
 * differences and a column of dots a client with nothing to argue about.
 */
export type CompareMark = "baseline" | "narrowed" | "replaced" | "waived" | "added";

export const COMPARE_LEGEND: readonly {
  mark: CompareMark;
  symbol: string;
  label: string;
}[] = [
  { mark: "baseline", symbol: "·", label: "same as baseline" },
  { mark: "narrowed", symbol: "◐", label: "narrowed" },
  { mark: "replaced", symbol: "≠", label: "replaced" },
  { mark: "waived", symbol: "✕", label: "waived — off this client’s list" },
  { mark: "added", symbol: "＋", label: "client-added line" },
];

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

export const markSymbol = (mark: CompareMark): string => SYMBOL[mark];
export const markLabel = (mark: CompareMark): string => LABEL[mark];

/** Sparse: absent means the server resolved that line as baseline. */
const MARKS: Readonly<Record<string, Readonly<Record<number, CompareMark>>>> = {
  svb: { 9: "narrowed", 11: "waived", 12: "replaced" },
  cactus: { 6: "waived" },
};

export interface AddedLine {
  key: string;
  label: string;
}

const ADDED: Readonly<Record<string, readonly AddedLine[]>> = {
  cactus: [{ key: "ctp-add", label: "HOA estoppel / CC&R reference attached" }],
};

export const markFor = (clientId: string, n: number): CompareMark =>
  MARKS[clientId]?.[n] ?? "baseline";

export const addedFor = (clientId: string): readonly AddedLine[] => ADDED[clientId] ?? [];

export const deltaCount = (clientId: string): number =>
  Object.keys(MARKS[clientId] ?? {}).length + addedFor(clientId).length;

export function deltaLabel(clientId: string): string {
  const n = deltaCount(clientId);
  return n === 0 ? "no deltas" : `${n} delta${n === 1 ? "" : "s"}`;
}

export function stackedCountLabel(clientId: string): string {
  const n = deltaCount(clientId);
  return n === 0 ? "takes the baseline as written" : deltaLabel(clientId);
}

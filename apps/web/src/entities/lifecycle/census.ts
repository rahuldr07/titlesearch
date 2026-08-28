import type { LifecycleResponse } from "@titlepipe/contract";

/**
 * THE FOUR HEADLINE FIGURES OF `LifecycleResponse`, NAMED ONCE.
 *
 * `total` / `halted` / `moving` / `failed` are drawn on two screens — the
 * Overview's stat row and the lifecycle board's census strip — and each screen
 * was spelling the four labels and their four tones itself. Two literals for
 * one fact is rule 11 ("Numbers reconcile across screens — one variable, never
 * two literals"), and the failure mode is quiet: rename "Halted" on one screen
 * and the two disagree with nothing to catch it. The strings happened to match
 * because they were matched BY HAND, which is the thing rule 11 says not to
 * rely on.
 *
 * ══ WHY THE TONE IS HERE TOO ═══════════════════════════════════════════════
 *
 * Because it is part of what the figure MEANS, not of how one screen chooses to
 * draw it. `failed` is the halt register wherever it appears; a board that
 * painted it amber and a stat card that painted it red would be two answers to
 * "how bad is this", and the reader has no way to know which is the product's.
 *
 * The tone is a STATIC property of the category and never a function of the
 * value — a `failed` card that turned red only above zero would be the browser
 * deciding when a figure is bad, which is the server's call and nobody asked
 * it.
 *
 * ══ WHY `entities/` ════════════════════════════════════════════════════════
 *
 * It is a domain fact about a contract shape, imported by two features, and it
 * fetches nothing — so it clears `presentational-fetches` and sits below both
 * screens rather than inside either. `member` is keyed to `LifecycleResponse`,
 * so a renamed member is a compile error rather than a blank card.
 */
export type CensusTone = "primary" | "secondary" | "attend" | "halt";

export type CensusFigure = {
  readonly member: keyof Pick<
    LifecycleResponse,
    "total" | "halted" | "moving" | "failed"
  >;
  readonly label: string;
  readonly tone: CensusTone;
};

export const CENSUS_FIGURES: readonly CensusFigure[] = [
  { member: "total", label: "Total in the shop", tone: "primary" },
  { member: "halted", label: "Halted", tone: "attend" },
  { member: "moving", label: "Moving", tone: "secondary" },
  { member: "failed", label: "Failed", tone: "halt" },
];

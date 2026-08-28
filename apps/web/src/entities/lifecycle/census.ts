import type { LifecycleResponse } from "@titlepipe/contract";

/**

 * THE FOUR HEADLINE FIGURES OF `LifecycleResponse`, NAMED ONCE. `total` / `halted` /

 * `moving` / `failed` are drawn on two screens — the Overview's stat row and the

 * lifecycle board's census strip — and each screen was spelling the four…

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

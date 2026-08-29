/**
 * The codes the order book actually carries (`mocks/src/data.ts`). The picker
 * offers these and nothing else — a code the server has never been asked for is
 * a guess, and this screen does not guess.
 */
export const JURISDICTION_CODES = [
  { code: "clayton-ga", name: "Clayton, GA" },
  { code: "greene-ga", name: "Greene, GA" },
  { code: "houston-ga", name: "Houston, GA" },
  { code: "greene-ny", name: "Greene, NY" },
  { code: "mecklenburg-nc", name: "Mecklenburg, NC" },
] as const;

export const DEFAULT_JURISDICTION_CODE = "clayton-ga";

export function isJurisdictionCode(value: string): boolean {
  return JURISDICTION_CODES.some((entry) => entry.code === value);
}

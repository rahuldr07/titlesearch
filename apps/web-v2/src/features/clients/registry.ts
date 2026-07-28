/**
 * The client records and the product chips the screen resolves against.
 *
 * CONTRACT GAP: no clients endpoint. See `baseline.ts` for why this whole layer
 * is fixtures. The values are the design's demonstration set — two synthetic
 * firms, not customers.
 *
 * A CLIENT HOLDS DELTAS, NEVER A COPY OF THE LIST, and the shape enforces it:
 * `overrides` is a short list of differences against whatever the baseline
 * currently says. Storing a client's own copy of the 13 lines would be easier
 * and would quietly stop a baseline change from reaching anybody.
 */

export interface ProductChip {
  id: string;
  code: string;
  name: string;
  /** Products sharing a key share a baseline; the span differs, the lines do not. */
  gridKey: "cos" | "tos" | "update" | "y";
}

export const PRODUCT_CHIPS: readonly ProductChip[] = [
  { id: "cos", code: "COS", name: "Current Owner Search", gridKey: "cos" },
  { id: "tos", code: "TOS", name: "Two-Owner Search", gridKey: "tos" },
  { id: "update", code: "Update", name: "Update Search", gridKey: "update" },
  { id: "y20", code: "20 Year", name: "20-Year Search", gridKey: "y" },
  { id: "y40", code: "40 Year", name: "40-Year Search", gridKey: "y" },
  { id: "y60", code: "60 Year", name: "60-Year Search", gridKey: "y" },
];

export const DEFAULT_PRODUCT_ID = "y40";

/**
 * The four ways a client may differ. WAIVE is the one worth naming separately:
 * the others change how a line is answered, waive removes the obligation
 * entirely — and on a load-bearing line that is a claim about what the search
 * covered, not a preference.
 */
export type OverrideType = "waive" | "narrow" | "replace" | "add";

export interface OverrideRecord {
  id: string;
  type: OverrideType;
  /** What it does, in the list's own words — "Line 9 narrowed". */
  desc: string;
  /** Why, or the text it substitutes. Never empty: a delta owes a reason. */
  note: string;
}

export interface ClientRecord {
  id: string;
  code: string;
  name: string;
  contact: string;
  retired: boolean;
  overrides: readonly OverrideRecord[];
}

export const CLIENTS: readonly ClientRecord[] = [
  {
    id: "svb",
    code: "SVB",
    name: "Summit Valley Bank, N.A.",
    contact: "ops@summitvalley.example",
    retired: false,
    overrides: [
      {
        id: "svb-9",
        type: "narrow",
        desc: "Line 9 narrowed",
        note: "against the current owner only · recorded in the last 24 months",
      },
      {
        id: "svb-12",
        type: "replace",
        desc: "Line 12 replaced",
        note: "Client-specified merge order (rev 3), replaces the standard sequence.",
      },
      {
        id: "svb-11",
        type: "waive",
        desc: "Line 11 waived",
        note: "Summit supplies its own GIS parcel map; plat not required.",
      },
    ],
  },
  {
    id: "cactus",
    code: "CTP",
    name: "Cactus Title Partners",
    contact: "orders@cactustitle.example",
    retired: false,
    overrides: [
      {
        id: "ctp-add",
        type: "add",
        desc: "Add · HOA estoppel / CC&R reference attached",
        note: "Cactus onboarding requirement",
      },
      {
        id: "ctp-6",
        type: "waive",
        desc: "Line 6 waived",
        note: "Cactus waives deed-chain completeness — accepts current vesting only.",
      },
    ],
  },
];

export const OVERRIDE_ACTIONS = [
  { value: "waive", label: "Waive" },
  { value: "narrow", label: "Narrow scope" },
  { value: "replace", label: "Replace standard" },
  { value: "add", label: "Add line" },
] as const;

export const CONFIG_VERSION = "config v4";

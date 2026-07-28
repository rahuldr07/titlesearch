import type { Derivation } from "./catalogue";

/**
 * The sign-off line catalogue — the ONE vocabulary every product and client
 * draws from.
 *
 * CONTRACT GAP: no endpoint serves these. See `catalogue.ts` for why the whole
 * intake-config layer is fixtures rather than a locally-widened contract type.
 *
 * `version` is on every line because editing the wording MINTS A VERSION, it
 * does not correct history — two orders can be answered against two wordings
 * and each order records which one it used. A catalogue without a version
 * column cannot express that, which is why it is here before there is anything
 * to increment it.
 */

/** A baseline cell. Three states, never two — "narrowed" is not a soft yes. */
export type CellMark = "applies" | "narrowed" | "na";

export const CELL_MARKS: readonly { value: CellMark; symbol: string; label: string }[] = [
  { value: "applies", symbol: "●", label: "applies" },
  { value: "narrowed", symbol: "◐", label: "narrowed" },
  { value: "na", symbol: "—", label: "n/a" },
];

export interface SignoffLine {
  id: string;
  n: number;
  label: string;
  group: string;
  answers: string;
  commentOnNo: string;
  /** The line carries the order's computed period rather than a fixed span. */
  period: boolean;
  /** Null means human-answered only — never a silent "we checked it anyway". */
  machineCheck: string | null;
  standardText: string | null;
  version: number;
  retired: boolean;
  cells: Readonly<Record<Derivation, CellMark>>;
  /** Only meaningful where the cell is `narrowed`. */
  scope: Readonly<Partial<Record<Derivation, string>>>;
}

const REQ = "Comment required on NO";
const OPT = "Comment optional on NO";
const YN = "YES / NO";
const YNA = "YES / NO / N/A";
const ALL = { cos: "applies", tos: "applies", update: "applies", y: "applies" } as const;

export const SIGNOFF_LINES: readonly SignoffLine[] = [
  {
    id: "L01", n: 1, label: "Taxes and assessors pulled for all parcels",
    group: "Taxes", answers: YNA, commentOnNo: REQ, period: false,
    machineCheck: "Treasurer parcel record segmented", standardText: null,
    version: 1, retired: false, cells: ALL, scope: {},
  },
  {
    id: "L02", n: 2, label: "Name search and GI run for all names",
    group: "Name search", answers: YN, commentOnNo: REQ, period: true,
    machineCheck: "Name/GI index result segmented", standardText: null,
    version: 1, retired: false,
    cells: { cos: "narrowed", tos: "narrowed", update: "narrowed", y: "applies" },
    scope: {
      cos: "current owner only", tos: "current + one prior owner",
      update: "names added since the prior effective date",
      y: "all names in the period",
    },
  },
  {
    id: "L03", n: 3, label: "Vesting deed names match per customer",
    group: "Vesting", answers: YN, commentOnNo: REQ, period: false,
    machineCheck: "Grantee vs order name compare", standardText: null,
    version: 1, retired: false, cells: ALL, scope: {},
  },
  {
    id: "L04", n: 4, label: "Full Value Deed found",
    group: "Vesting", answers: YNA, commentOnNo: REQ, period: false,
    machineCheck: "FVD instrument segmented", standardText: null,
    version: 1, retired: false,
    cells: { cos: "applies", tos: "applies", update: "na", y: "applies" }, scope: {},
  },
  {
    id: "L05", n: 5, label: "FVD covers PIQ; legal description page included",
    group: "Vesting", answers: YN, commentOnNo: REQ, period: false,
    machineCheck: null, standardText: null, version: 1, retired: false,
    cells: { cos: "applies", tos: "applies", update: "na", y: "applies" }, scope: {},
  },
  {
    id: "L06", n: 6, label: "Deed chain complete",
    group: "Vesting", answers: YNA, commentOnNo: REQ, period: true,
    machineCheck: "Chain depth vs required span", standardText: null,
    version: 1, retired: false,
    cells: { cos: "na", tos: "narrowed", update: "narrowed", y: "applies" },
    scope: {
      tos: "vesting deed and one prior",
      update: "from the prior effective date forward", y: "the full period",
    },
  },
  {
    id: "L07", n: 7, label: "All open mortgages and related documents considered",
    group: "Mortgages", answers: YN, commentOnNo: REQ, period: false,
    machineCheck: "Deed-of-trust instruments segmented", standardText: null,
    version: 1, retired: false, cells: ALL, scope: {},
  },
  {
    id: "L08", n: 8, label: "Mortgage covering additional property: assessor + taxes",
    group: "Mortgages", answers: YNA, commentOnNo: OPT, period: false,
    machineCheck: "Additional-property parcel + tax record segmented",
    standardText: null, version: 1, retired: false, cells: ALL, scope: {},
  },
  {
    id: "L09", n: 9, label: "All liens and UCC per standard criteria",
    group: "Name search", answers: YN, commentOnNo: REQ, period: true,
    machineCheck: "Lien/UCC index result segmented", standardText: null,
    version: 1, retired: false,
    cells: { cos: "narrowed", tos: "narrowed", update: "narrowed", y: "applies" },
    scope: {
      cos: "against the current owner", tos: "against both owners",
      update: "recorded since the prior effective date",
      y: "all owners in the period",
    },
  },
  {
    id: "L10", n: 10, label: "More than 10 judgments: first 10 listed, standard comment",
    group: "Name search", answers: YNA, commentOnNo: OPT, period: false,
    machineCheck: null, version: 1, retired: false, cells: ALL, scope: {},
    standardText:
      "“Additional judgments of record; first ten listed. Remaining matters available on request.”",
  },
  {
    id: "L11", n: 11, label: "Plat map, or tax/GIS map, included",
    group: "Legal", answers: YNA, commentOnNo: OPT, period: false,
    machineCheck: "Plat/GIS image segmented", standardText: null,
    version: 1, retired: false,
    cells: { cos: "applies", tos: "applies", update: "na", y: "applies" }, scope: {},
  },
  {
    id: "L12", n: 12, label: "Merging sequence followed",
    group: "Merging", answers: YN, commentOnNo: REQ, period: false,
    machineCheck: null, version: 1, retired: false, cells: ALL, scope: {},
    standardText: "Stacking order: Vesting → Open DOTs → Liens/Judgments → Taxes → Legal/Plat.",
  },
  {
    id: "L13", n: 13, label: "Name search, judgment and UCC indexes provided",
    group: "Name search", answers: YN, commentOnNo: REQ, period: false,
    machineCheck: "Index images attached", standardText: null,
    version: 1, retired: false, cells: ALL, scope: {},
  },
];

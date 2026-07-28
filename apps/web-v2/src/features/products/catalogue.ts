/**
 * The product records and the drawer's option lists.
 *
 * CONTRACT GAP: there is no products endpoint. `packages/contract` has no
 * `Product`, no `SignoffLine`, no baseline grid and no config version, and
 * `packages/mocks` serves none of them. This layer is the OPEN part of the
 * system — the intake config the owner still edits by hand — so the screen
 * renders fixtures rather than inventing a wire shape the backend has not
 * agreed to. Widening a contract locally to make a screen work is exactly the
 * failure the boundary parse exists to prevent.
 *
 * Everything below is DEMONSTRATION DATA. The codes are the design's own
 * example set, not a customer's configuration.
 */

/**
 * Which baseline-grid column a product reads.
 *
 * Year products share ONE column deliberately: 20/40/60-year searches differ in
 * span, not in which lines apply, and giving each its own column would invite
 * three copies of one decision that then drift apart.
 */
export type Derivation = "cos" | "tos" | "update" | "y";

export interface ProductRecord {
  id: string;
  code: string;
  full: string;
  /** The one-line description the drawer edits. */
  sub: string;
  /** Rendered as "Period: …" — how the search window is computed. */
  period: string;
  gridKey: Derivation;
  retired: boolean;
}

export const PRODUCTS: readonly ProductRecord[] = [
  {
    id: "cos", code: "COS", full: "Current Owner Search",
    sub: "Current owner — vesting deed + open matters",
    period: "Current owner only", gridKey: "cos", retired: false,
  },
  {
    id: "tos", code: "TOS", full: "Two-Owner Search",
    sub: "Current owner + one prior owner",
    period: "Two owners", gridKey: "tos", retired: false,
  },
  {
    id: "update", code: "Update", full: "Update Search",
    sub: "New matter since a prior effective date",
    period: "From prior effective date", gridKey: "update", retired: false,
  },
  {
    id: "y20", code: "20 Year", full: "20-Year Search",
    sub: "Full search · 20 years back",
    period: "20 years back", gridKey: "y", retired: false,
  },
  {
    id: "y40", code: "40 Year", full: "40-Year Search",
    sub: "Full search · 40 years back",
    period: "40 years back", gridKey: "y", retired: false,
  },
  {
    id: "y60", code: "60 Year", full: "60-Year Search",
    sub: "Full search · 60 years back",
    period: "60 years back", gridKey: "y", retired: false,
  },
];

/**
 * CONTRACT GAP: the config version is server-owned and monotonic — the number
 * an order is stamped with at intake. There is no endpoint to read it, so this
 * is a fixture and the screen never increments it: only a publish the server
 * accepted may move it.
 */
export const CONFIG_VERSION = "config v4";

export const CONFIG_TABS = [
  { value: "products", label: "Products" },
  { value: "lines", label: "Sign-off lines" },
  { value: "grid", label: "Baseline grid" },
  { value: "clients", label: "Clients" },
] as const;

/** The drawer's fixed vocabularies — a line's group, and its answer shape. */
export const LINE_GROUPS = [
  "Taxes", "Name search", "Vesting", "Mortgages", "Legal", "Merging",
] as const;

export const ANSWER_CHOICES = [
  { value: "YN", label: "YES / NO" },
  { value: "YNA", label: "YES / NO / N/A" },
] as const;

export const COMMENT_CHOICES = [
  { value: "req", label: "Required on NO" },
  { value: "opt", label: "Optional on NO" },
] as const;

export const DERIVATION_CHOICES = [
  { value: "year", label: "Fixed years back" },
  { value: "owner", label: "Current / owners" },
  { value: "update", label: "From prior effective date" },
] as const;

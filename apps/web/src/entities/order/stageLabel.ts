import type { OrderRow } from "@titlepipe/contract";

/**
 * The enum's own words, capitalised — so `stage:gate` still finds the "Gate"
 * row. One table, in `entities/` rather than in either feature: the browse
 * table and the Overview's recent-orders table print the same column, and the
 * Overview was printing the bare enum (`gate`, `intake`, `escalated`) beside a
 * browse screen that printed `Gate`, `Intake`, `Escalated`. Two spellings of
 * one value in one app is a defect however small either half looks.
 *
 * A `Record` keyed on the contract union, so a stage added to the contract is
 * a type error here rather than an undefined cell.
 */
export const STAGE_LABEL: Readonly<Record<OrderRow["stage"], string>> = {
  unassigned: "Unassigned",
  intake: "Intake",
  machine: "Machine",
  gate: "Gate",
  review: "Review",
  escalated: "Escalated",
  delivered: "Delivered",
};

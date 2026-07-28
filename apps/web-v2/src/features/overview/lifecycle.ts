/**
 * The vocabulary of the lifecycle board, and the figures it prints.
 *
 * ONE STAGE MOVES BY ITSELF. Every other column on this board is an order
 * stopped on a person, and that is the product working as intended rather than
 * a backlog to be burnt down. The types below keep that distinction structural:
 * a stage declares its `kind`, and `kind` is what decides whether the column
 * carries the "stopped" mark — nobody infers it from a count.
 *
 * NOTHING HERE IS DERIVED FROM THE ROWS. Both the per-stage `count` and the
 * four figures in `DEMO_TALLY` are stored values standing in for server ones.
 * Counting the visible cards instead would silently redefine every number as
 * "what this role can see" — and this board is role-scoped, so a reviewer and a
 * senior would read two different totals off the same screen and both would be
 * told they were looking at the shop.
 */

/**
 * `idle` nobody has it · `halt` stopped on a person · `machine` advancing on
 * its own · `done` finished. Exactly one kind moves without a person.
 */
export type StageKind = "idle" | "halt" | "machine" | "done";

export interface LifecycleOrder {
  readonly order: string;
  readonly addr: string;
  /** How long it has sat, as SERVER TEXT. Nothing on this screen counts up. */
  readonly waited: string;
  /** What it is stopped on, in words — never a status code. */
  readonly waitOn: string;
  /** This one is the viewer's own. The design stamps it "yours". */
  readonly yours: boolean;
}

export interface LifecycleStage {
  readonly id: string;
  readonly label: string;
  readonly sub: string;
  /** Who it is stopped on — "abstractor", "a person", "nobody", "—". */
  readonly on: string;
  readonly kind: StageKind;
  /** The server's number. Never `orders.length`. */
  readonly count: number;
  readonly orders: readonly LifecycleOrder[];
}

export interface FailedOrder {
  readonly order: string;
  /** Why it left the pipeline, in the server's words. */
  readonly state: string;
  readonly addr: string;
  readonly waited: string;
  readonly waitOn: string;
}

/**
 * CONTRACT GAP: there is no lifecycle endpoint. No stage census, no per-stage
 * order list, no failed set. The four tallies below are the shape a server
 * would have to answer with — a client cannot compute them, because it cannot
 * see the orders it is not scoped to.
 */
export const DEMO_TALLY = {
  total: 9,
  halted: 4,
  moving: 1,
  failed: 2,
} as const;

/**
 * CONTRACT GAP: same absent endpoint. A failed order is tracked separately from
 * the stages because it is not IN one — see FailedBanner for why that matters.
 */
export const DEMO_FAILED: readonly FailedOrder[] = [
  {
    order: "DEMO-0008",
    state: "Failed validation",
    addr: "808 Specimen St, Demo County AZ",
    waited: "1d 4h",
    waitOn: "Needs a person to put it back",
  },
  {
    order: "DEMO-0009",
    state: "Delivery failed",
    addr: "909 Fixture Loop, Demo County AZ",
    waited: "3h 15m",
    waitOn: "Needs a person to put it back",
  },
];

/**
 * The scope sentence. It is not a caption — it tells the reader whether the
 * board is the shop or their corner of it, and without it a reviewer would read
 * "4 stopped" as a fact about the business.
 *
 * CONTRACT GAP: the real sentence depends on the caller's scope, which only the
 * server knows.
 */
export const DEMO_SCOPE_NOTE =
  "Scoped to your orders plus anything unclaimed — the same gate as the queue. A senior sees all of them.";

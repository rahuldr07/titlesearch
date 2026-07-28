import type { LifecycleStage } from "./lifecycle";

/**
 * The seven stages, in pipeline order, with obviously-synthetic occupants.
 *
 * The ORDER of this list is the argument the screen makes: intake, machine,
 * gates, review, escalation, delivery — read left to right it is one order's
 * life, and the single `machine` column sitting among six person-columns is the
 * whole shape of the product in one glance.
 *
 * CONTRACT GAP: no lifecycle endpoint exists, so both the census and the cards
 * are invented here. `count` is stored rather than measured from `orders` for
 * the reason spelled out in lifecycle.ts — the server owns every number.
 */
export const DEMO_STAGES: readonly LifecycleStage[] = [
  {
    id: "unassigned",
    label: "Unassigned",
    sub: "nobody has taken it",
    on: "nobody",
    kind: "idle",
    count: 1,
    orders: [
      {
        order: "DEMO-0001",
        addr: "101 Example Rd, Demo County AZ",
        waited: "—",
        waitOn: "Unclaimed — nobody has taken it",
        yours: false,
      },
    ],
  },
  {
    id: "intake",
    label: "Intake & sign-off",
    sub: "answering the lines",
    on: "abstractor",
    kind: "halt",
    count: 1,
    orders: [
      {
        order: "DEMO-0002",
        addr: "202 Sample Ave, Demo County AZ",
        waited: "3h 10m",
        waitOn: "Sign-off open",
        yours: true,
      },
    ],
  },
  {
    id: "machine",
    label: "Machine run",
    sub: "extracting fields",
    on: "machine",
    kind: "machine",
    count: 1,
    orders: [
      {
        order: "DEMO-0003",
        addr: "303 Placeholder Way, Demo County AZ",
        waited: "12m",
        waitOn: "Extract fields",
        yours: false,
      },
    ],
  },
  {
    id: "gate",
    label: "Gates",
    sub: "the run has stopped",
    on: "a person",
    kind: "halt",
    count: 1,
    orders: [
      {
        order: "DEMO-0004",
        addr: "404 Stub Ln, Demo County AZ",
        waited: "1h 05m",
        waitOn: "Package incomplete",
        yours: false,
      },
    ],
  },
  {
    id: "review",
    label: "Review",
    sub: "decisions open",
    on: "reviewer",
    kind: "halt",
    count: 1,
    orders: [
      {
        order: "DEMO-0005",
        addr: "505 Mock Blvd, Demo County AZ",
        waited: "2h 40m",
        waitOn: "Decisions open",
        yours: true,
      },
    ],
  },
  {
    id: "escalated",
    label: "Escalated",
    sub: "sent up",
    on: "senior",
    kind: "halt",
    count: 1,
    orders: [
      {
        order: "DEMO-0006",
        addr: "606 Dummy Ct, Demo County AZ",
        waited: "6h 40m",
        waitOn: "Waiting on a senior",
        yours: false,
      },
    ],
  },
  {
    id: "delivered",
    label: "Delivered",
    sub: "signed and sent",
    on: "—",
    kind: "done",
    count: 1,
    orders: [
      {
        order: "DEMO-0007",
        addr: "707 Synthetic Dr, Demo County AZ",
        waited: "Delivered recently",
        waitOn: "Delivered",
        yours: false,
      },
    ],
  },
];
